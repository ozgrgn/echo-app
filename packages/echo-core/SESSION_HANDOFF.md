# Session Handoff — ECHO ABSA / Scoring / Architecture

**Purpose:** complete context for a fresh session. Everything decided, why, what's
done, what's next. Read this first.

**Date of handoff:** 2026-05-29
**User:** Ozgur (responds in Turkish; code comments in English; prefers seeing
real PASS/FAIL + actual model outputs, not just claims).

---

## 0. The system in one picture

```
Review sources → echo-backend (stores reviews, computes GPI) 
                      ↑ GET candidates / PATCH aspects
                 absa-service (ABSA: review text → aspects via OpenAI Batch API)
                      ↓ aspects
                 echo-backend computes GPI (scoring) → snapshot
                      ↓
                 echo-panel (dashboard)
```

- **absa-service** (`~/projects/talkwo/reviews/absa-service`): standalone repo. ABSA
  pipeline. Calls OpenAI. Produces aspects. Does NOT score.
- **echo-backend** (`reviews/echo-backend`): TO BE
  BUILT. Owns review storage + GPI scoring + dashboard API.
- **review-core** (`reviews/echo-frontend/packages/echo-core`): shared
  contract today (types + taxonomy + scoring reference). Being dismantled toward
  shared-nothing (see §6).
- **echo-panel** (`reviews/echo-frontend/apps/echo-panel`): Svelte dashboard.

> NOTE: `echo-frontend` is misnamed — it's actually a pnpm monorepo containing
> frontend + shared packages + (old copy of) absa-service. User runs services as
> separate GitHub repos deployed as separate Railway services in one project
> (polyrepo + shared platform). See §6 for the architectural direction.

---

## 1. What this whole effort is about

ABSA = Aspect-Based Sentiment Analysis for Antalya all-inclusive resort hotel
reviews. Pipeline: review text → list of aspects, each with category,
subcategory, sentiment, polarity, intensity, confidence, severity_hint,
critical_flags. Backend then aggregates aspects into a GPI (Guest Performance
Index) score per venue.

**Target domain (important for all taxonomy decisions):** Antalya 5★
all-inclusive resorts. Families, multiple restaurants, pools, beach, kids club,
animation, SPA. Later this will split by hotel type (boutique, city, thermal) —
that's WHY taxonomy is being made configurable (Redis).

---

## 2. Taxonomy — current state & decisions

**14 categories, 107 subcategories, 29 disambiguation rules.**
Lives in: `packages/echo-core/src/taxonomy.json` (DATA) +
`categories.ts` (loader that derives CATEGORY_LIST, SUBCATEGORY_MAP, etc.).

### Categories (key, GPI weight)
FOOD 17%, ROOM 17%, STAFF 11%, FRONT 8%, POOL 8%, BEACH 7%, FACILITY 7%,
VALUE 7%, ENTERTAINMENT 6%, KIDS 6%, SPA 4%, GENERAL 2%, LOCATION (info, 0%),
SECURITY (alert, 0%). GPI weights sum to 1.0 across inGpi categories.

### Key taxonomy decisions made this session
- **Removed `department` field entirely.** ABSA produces aspects; department
  routing is a downstream concern, NOT part of taxonomy. Was cluttering it.
- **Collapsed 19 alias subcategories** into canonical keys (e.g. `breakfast_quality`
  → `breakfast`, `massage_quality` → `massage_treatment`). Aliases were
  mock-data leftovers that confused the model and inflated subcategory error.
- **`food_quality_taste` (taste) and `food_variety` (variety) kept SEPARATE** —
  user insisted they're distinct concepts. The combined `food_variety_taste`
  alias was removed.
- **`mini_club_activities` → KIDS/kids_club.** "Mini club / kids club / animators
  with children" = KIDS, not ENTERTAINMENT. ENTERTAINMENT is adult animation.
- **Added 10 AI-resort-specific canonicals:** late_night_food,
  alcohol_quality_brands, restaurant_reservation, cabana_pavilion (POOL),
  beach_cabana (BEACH), pier_access + water_sports (split from pier_water_sports),
  teen_activities, upselling_pressure (VALUE), smoking_policy_violation (SECURITY).
- **Cabana:** two keys — POOL/cabana_pavilion + BEACH/beach_cabana (can't share
  one key across categories; validator enforces one category per subcategory).
- **Removed KIDS/family_friendliness** (umbrella, blurred the model).
- **Merged LOCATION/proximity_to_beach into sea_access_quality.**
- **kids_club vs children_activities:** kids_club = fixed venue/program (mini
  club, kids disco). children_activities = venue-agnostic (pool games, animator
  attention). Disambiguation rule encodes this.
- **TR + EN labels** added to every subcategory (`label`, `labelEn` fields).
  Frontend uses `getSubcategoryLabel(key, lang='tr')`. Unknown key → returns key.

---

## 3. ABSA prompt — current state

`absa-service/src/prompt/system.ts` → `SYSTEM_PROMPT` constant (~3500 tokens,
8 few-shot examples). Built at module-eval (sync) from taxonomy snapshot.

### Prompt structure (order matters for OpenAI prompt caching — stable first)
1. Role + task
2. Output field rules
3. Language handling (any language; category/subcategory/sentiment in English;
   excerpt/target_text in original language)
4. **Aspect granularity (anti over-split)** — added this session
5. Taxonomy block (rendered from taxonomy)
6. Disambiguation rules (29, multilingual patterns)
7. Few-shot examples (8): TR multi-aspect, DE waiter→FOOD, EN food-poisoning→
   SECURITY, breakfast no-over-split, extra-charge→VALUE, mini-club→KIDS,
   vague-praise→single GENERAL, SPA-pricing→both fields SPA.

### Few-shot beats text rules for gpt-4o-mini
Repeatedly observed: a concrete INPUT→OUTPUT example fixes model behaviour that
abstract "do not X" rules cannot. EXAMPLE 8 (SPA pricing) fixed a stubborn
VALUE/spa_price_reservation invalid-pair that disambiguation text couldn't.

---

## 4. Eval — current state: ✅ PASS

`absa-service/evals/run-eval.ts`, 50 golden examples (tr/de/en/ru).
Run: `cd ~/projects/talkwo/reviews/absa-service && node_modules/.bin/tsx evals/run-eval.ts`
(needs OPENAI_API_KEY in .env — already loaded via `import 'dotenv/config'`).

### Latest gates (all pass)
- Category accuracy: ~96.8% (gate ≥85%)
- Subcategory accuracy: ~81-85% (gate ≥75%) — fluctuates run-to-run (gpt-4o-mini
  not fully deterministic even at temperature=0)
- Sentiment accuracy: ~95% (gate ≥85%)
- Invalid cat/sub pairs: 0
- **Schema error rate: 0%** (gate <1%)
- Empty-when-expected: 0%
- Spurious aspect rate: ~35% (NO gate — see §5)

### Eval artifacts (absa-service/evals/results/)
- `detailed-categorization-v2.md` — all 50 reviews, golden vs model, per-aspect
- `system-prompt-final.md` — full prompt + token stats
- `side-by-side.md` — compact comparison

---

## 5. Spurious aspects — analyzed, mechanism built (review-core scoring)

**Spurious = model aspect with no golden counterpart.** ~35% rate. We classified
5 types: (1) second-clause = second aspect, (2) dual-character (golden under-
labeled), (3) same-subcategory twice, (4) wrong-category inference, (5) golden
genuinely incomplete. Types 2 & 5 are "good spurious" (model more thorough than
golden). Spurious has NO eval gate — it's a model-behaviour signal, not pass/fail.

### What spurious actually harms (user asked, we proved with numbers)
- Eval gate: nothing (not gated).
- GPI score: YES — same signal counted 2-3× inflates category scores.
- Dashboard: same complaint appears in multiple chips.
This is why we built scoring-side dampening (below), NOT a hard prompt clamp.

### Scoring mechanisms added to review-core/scoring.ts (see SCORING_HANDOFF.md)
Three NEW functions, all reference-impl (backend-authoritative in production):

1. **`distributeAttribution(aspects)`** — intra-category soft attribution.
   Distributes ONE mention-unit per (review, category) across its aspects,
   weighted by confidence. Drops conf < 0.6, then shares < 0.2, re-normalises.
   Fixes over-split: 2 FOOD aspects → 0.5/0.5 share, sum 1.0.
   Constants: ATTRIBUTION_CONFIDENCE_FLOOR=0.6, ATTRIBUTION_SHARE_FLOOR=0.2.

2. **`applyCategoryRankDamping(aspects)`** — cross-category long-form damping.
   Ranks categories by peak confidence; factor = 1/(1 + 0.5×rank). A 10-category
   review drops from ~11× to ~5.4× an average single-category review.
   Constant: CATEGORY_RANK_DECAY=0.5. USER CONFIRMED: "10x yerine 5x iyi."

3. **`resolveCategoryWeight(category, isSolo)`** — solo-category weight floor.
   When a review has exactly ONE category, light categories (GENERAL 0.02) are
   floored at avg weight (~0.083) so "tek kelimeyle mükemmeldi" 5★ isn't silenced.
   Heavy categories unaffected (max(w, floor)).
   Constant: SOLO_CATEGORY_WEIGHT_FLOOR ≈ 0.083.

### The big design discussion (user's key questions — RESOLVED)
- **"Why not distribute a dual-concern aspect across both?"** → That's exactly
  what soft attribution does (intra-category). Confirmed correct.
- **"Long-form bias: should 10 categories = 10× a 1-category review?"** →
  No. Decided: damping to ~5×. NOT review-normalization (1/N) — user rejected
  that: "yoruma girmeye değerse puana da değer" (if worth mentioning, worth
  scoring). So each mentioned category gets full intra-category unit; only the
  cross-category COUNT axis is damped, not the per-category contribution.
- **"Does few/many categories change a category's own contribution?"** → No
  (philosophy A). FOOD contribution is the same whether the review mentions 1 or
  10 categories. Damping only reduces the tail categories' rank factor.
- **Star rating vs aspect:** headline score = 70% normalized stars + 30% aspect
  (`SCORE_WEIGHTS.headlineExperienceScore`). Operational ranking = 80% aspect.
  So scoring tweaks move operational ranking strongly, headline mildly.

### NOT done re: spurious
- Golden refresh (would convert type-2/5 spurious to matches, lower the rate).
- Dashboard raw_aspects vs dashboard_aspects collapse layer (user liked the idea
  in principle; deferred).

---

## 6. Architecture direction — shared-nothing + Redis taxonomy (DECIDED)

User runs polyrepo: each service its own GitHub repo, deployed as separate
Railway services in one project. The `file:../review-core` symlink DOES NOT
survive this (it already broke when echo-frontend was moved — we fixed it by
updating absa-service/package.json to `file:../reviews/echo-frontend/...`).

### Decided model: SHARED-NOTHING
- **No shared runtime code package.** review-core gets dismantled.
- **Shared DATA (taxonomy) → Redis.** All services read `taxonomy:current`.
- **Types → copied per service** (not shared). Validate at boundaries (Zod/manual).
- **Scoring code → echo-backend only** (ABSA doesn't score — proven by grep,
  ABSA calls ZERO scoring functions; it only uses types + taxonomy + deriveSeverity).
- **Validation at the boundary, not in a shared validator** (user's choice).

### What ABSA actually imports from review-core (verified)
Types (CategoryKey, AbsaAspect, AbsaOutput, SentimentLabel, ReviewCandidate),
taxonomy (CATEGORY_LIST, SUBCATEGORY_MAP), `deriveSeverity`. NOTE: SEVERITY_WEIGHTS
is COPIED in absa-service/src/batch/parser.ts ("mirrors scoring.ts") — a small
existing sync-debt.

### Migration (incremental — see TAXONOMY_REDIS_DESIGN.md for full detail)
1. ✅ DONE: taxonomy → `taxonomy.json` + sync loader in categories.ts. Nothing
   broke (eval PASS, all 3 layers type-clean).
2. NEXT: add Redis loader per service (absa first). Seed from local taxonomy.json
   on cold cache.
3. Switch derived exports to boot-time async load. ABSA's SYSTEM_PROMPT build
   moves from module-eval into boot (the sync→async problem — see design doc).
4. Each service carries own taxonomy.json seed + loader + types; drop review-core dep.
5. Scoring → echo-backend; types copied per service; review-core retired.

---

## 7. Backend (echo-backend) — ready to build

Folder: `reviews/echo-backend/` with:
- **CLAUDE.md** — architecture, review-core contract, scoring pipeline order,
  ABSA integration endpoints, conventions.
- **BACKEND_SCOPE.md** — 3 milestones, payload shapes, non-goals, open questions.

### ABSA integration contract (ABSA already calls these — backend MUST provide)
- `GET /v1/reviews/absa-candidates?limit=N` → `{ reviews: ReviewCandidate[] }`
- `PATCH /v1/reviews/:id/absa-result` → accepts AbsaPatchPayload; 409 if
  source_text_hash changed.
- `GET /v1/feedback/absa-candidates` + `PATCH /v1/feedback/:id/absa-result` (GR
  Feedback / ops-engine; excluded from GPI).
- Auth: Bearer token. Shapes fixed by absa-service/src/api/echo-backend.ts.

### Backend open questions (user must answer)
- Storage: Mongo for reviews+snapshots, Redis for hot score cache? Confirm.
- Scoring trigger: incremental on each ABSA write, or scheduled batch recompute
  per venue? (Recency weighting implies periodic recompute even with no new reviews.)
- Multi-tenant isolation model (tenantKey scopes everything).

---

## 8. Outstanding TODOs (deferred this session)

From the original plan, NOT yet done:
1. **Mock data** — add example reviews/scores for the 10 NEW canonicals
   (upselling_pressure, late_night_food, cabana_pavilion, etc.) so they appear
   in the dashboard. (Frontend prototype work; mock files were moved/deleted —
   see §9 git state.)
2. **subcategoryLabel duplication** — 4 svelte files have local `subcategoryLabel`
   functions that now just delegate to `getSubcategoryLabel`. Could delete the
   locals and import directly. Cosmetic cleanup.
3. **Golden data refresh** — update golden for taxonomy changes (old keys like
   mini_club_activities), add missing type-2/5 aspects. Would raise subcategory
   accuracy and lower spurious organically.

---

## 9. Repo hygiene WARNINGS (address before committing)

- **echo-frontend has many uncommitted changes** beyond our work: mock/ files
  DELETED (`packages/echo-core/src/mock/*`), `api.ts` deleted, pnpm-workspace
  modified. These look like a separate in-progress refactor (moving mock to
  review-ui?). DO NOT blindly commit — review what's intentional.
- **`taxonomy.json` is untracked** (new file, ours). Must be committed for the
  build to work.
- **`_tmp_6_*` files** in echo-frontend root — stray temp files, should be removed.
- **absa-service sits inside `/Users/lucky` git repo** (home dir is a git repo —
  likely accidental). absa-service itself isn't a clean standalone repo yet.
- **Two absa-service copies exist:** `~/projects/talkwo/reviews/absa-service` (THE REAL
  ONE, has EXAMPLE 8, our work) and `reviews/echo-frontend/packages/absa-service`
  (older, no system.ts). Don't confuse them.

---

## 10. Reference docs (all in packages/echo-core/ unless noted)

- **SESSION_HANDOFF.md** — this file.
- **SCORING_HANDOFF.md** — scoring mechanism spec for backend (the 3 functions).
- **TAXONOMY_REDIS_DESIGN.md** — Redis migration design, sync→async, versioning.
- echo-backend/CLAUDE.md + BACKEND_SCOPE.md — backend build guide.
- absa-service/evals/results/*.md — eval outputs.

---

## 11. How to verify nothing is broken (sanity checks)

```bash
# review-core types
cd ~/projects/talkwo/reviews/echo-frontend/packages/echo-core && npx tsc --noEmit

# absa-service types + eval (THE integration test)
cd ~/projects/talkwo/reviews/absa-service && npx tsc --noEmit
node_modules/.bin/tsx evals/run-eval.ts   # expect OVERALL ✅ PASS

# frontend
cd ~/projects/talkwo/reviews/echo-frontend/apps/echo-panel && npm run check
```

All three are currently clean + eval PASSES as of this handoff.

---

## 12. Working-style notes (user preferences)

- Responds in Turkish. Code comments in English.
- Wants real outputs shown (PASS/FAIL + actual model aspects), not just "done".
- Strongly architecture-minded — questions assumptions ("is this ABSA's job?",
  "why 10x not 5x?", "why not Redis?"). Engage the reasoning, don't just execute.
- Prefers incremental, verifiable steps that leave the system working.
- Decisions are deliberate — when user picks an approach (e.g. shared-nothing,
  damping to 5x, food taste/variety separate), treat it as settled.
