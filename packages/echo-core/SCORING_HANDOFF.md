# Scoring Handoff — Aspect Aggregation Mechanisms

**Audience:** backend team implementing production GPI computation (echo-backend / ops-engine).

**Status:** reference implementation lives in `src/scoring.ts`. Production values
are backend-authoritative; this document specifies the behaviour the backend must
reproduce (in TypeScript via import, or re-implemented in Python/Go).

**Scope:** these mechanisms run AFTER ABSA produces aspects, DURING aggregation
into GPI. ABSA itself only emits raw aspects (category, subcategory, sentiment,
polarity, intensity, confidence, severity_hint). It does not score.

---

## Pipeline order

```
ABSA aspects (per review)
   ↓
1. distributeAttribution      → intra-category share (anti over-split)
   ↓
2. applyCategoryRankDamping   → cross-category share damping (anti long-form bias)
   ↓
3. computeMentionScore        → per-aspect score × share
   ↓  (aggregate across reviews)
4. computeSubcategoryScore    → mean of mention scores (null if < MIN_MENTIONS)
   ↓
5. computeCategoryAspectScore → subcategory-weighted avg, using
                                resolveCategoryWeight(cat, isSolo) for the
                                category's GPI weight (anti low-weight-silencing)
   ↓
6. computeOverallGpi          → inGpi-weighted avg + Bayesian smoothing
```

Steps 1, 2, 5(solo-boost) are the NEW mechanisms added in this work. Steps 3, 4, 6
already existed.

---

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `ATTRIBUTION_CONFIDENCE_FLOOR` | 0.6 | Drop aspects below this confidence before attribution |
| `ATTRIBUTION_SHARE_FLOOR` | 0.2 | Drop aspects whose post-normalisation share is below this |
| `CATEGORY_RANK_DECAY` | 0.5 | Diminishing-returns decay for cross-category damping |
| `SOLO_CATEGORY_WEIGHT_FLOOR` | avg inGpi weight (≈0.083) | Floor for a lone category's effective weight |

---

## 1. distributeAttribution — intra-category soft attribution

**Problem:** ABSA may emit several aspects in the SAME category for one review
(e.g. `FOOD/breakfast` + `FOOD/food_quality_taste` from one breakfast sentence,
or the same subcategory twice). Naive counting double-counts one signal and
inflates the category score.

**Rule:** distribute ONE "mention unit" per (review, category) across that
category's aspects, weighted by confidence.

**Algorithm (per review):**
1. Drop aspects with `confidence < ATTRIBUTION_CONFIDENCE_FLOOR` (0.6).
   If none remain, return empty.
2. Group surviving aspects by category.
3. For each category: `share[i] = confidence[i] / Σ(confidence in category)`.
4. Drop aspects with `share < ATTRIBUTION_SHARE_FLOOR` (0.2).
   - Edge case: if ALL shares fall below floor (e.g. 6 equally-weak aspects each
     ≈0.17), keep only the single highest-confidence aspect with `share = 1.0`.
5. Re-normalise remaining shares within each category so they sum to 1.0.

**Invariant:** after this step, `Σ(share)` within each category = 1.0.

**Examples:**
- 2 FOOD aspects (conf 0.96, 0.93) → shares 0.508, 0.492 (sum 1.0)
- Same subcategory twice (conf 0.97, 0.92) → 0.513, 0.487 (sum 1.0)
- 1 FOOD aspect conf 0.96 + 1 FOOD aspect conf 0.55 → 0.55 dropped, 0.96 → share 1.0

---

## 2. applyCategoryRankDamping — cross-category long-form damping

**Problem:** a review touching 10 categories should not contribute ~10× a review
touching 1 category. (Measured: without damping, 10-category review ≈ 11× an
average single-category review.)

**Rule:** rank the review's categories by their strongest aspect's confidence
(most confident = rank 0). Multiply each aspect's `share` by a rank factor:

```
factor(rank) = 1 / (1 + CATEGORY_RANK_DECAY × rank)
DECAY = 0.5  →  rank0=1.00, rank1=0.67, rank2=0.50, rank3=0.40, rank4=0.33, …
```

**Input:** aspects already carrying intra-category `share` (output of step 1).
**Output:** same aspects, `share` multiplied by their category's rank factor.

**Important:** this damps the category-COUNT axis only. It does NOT touch the
category-WEIGHT axis (FOOD 0.17 vs GENERAL 0.02 importance) — that inequality is
intentional and stays.

**Effect:** 10-category review drops from ~11× to ~5.4× an average single-category
review (vs ratio target of "not a 10× jump for 1-vs-10 categories").

---

## 3. resolveCategoryWeight — solo-category weight floor (anti-silencing)

**Problem:** a review mentioning exactly ONE category, where that category is
lightweight (GENERAL at 0.02), contributes almost nothing — even if it's a strong
5★ "tek kelimeyle mükemmeldi" signal.

**Rule:** when a review has exactly one surviving category, that category's
effective GPI weight is `max(staticWeight, SOLO_CATEGORY_WEIGHT_FLOOR)`.

```
resolveCategoryWeight(category, isSolo):
    meta = category metadata
    if not meta.inGpi:  return meta.weight          # informational/alert never boosted
    if isSolo:          return max(meta.weight, SOLO_CATEGORY_WEIGHT_FLOOR)
    else:               return meta.weight
```

- `isSolo` = true when the review (after attribution) has exactly one category.
- Heavy categories unaffected: `max(0.17, 0.083) = 0.17` (FOOD unchanged).
- Light solo categories lifted: `max(0.02, 0.083) = 0.083` (GENERAL boosted ≈4.2×).

---

## Combined edge-case behaviour (verified)

| Review | GPI-weighted contribution |
|---|---|
| "Tek kelimeyle mükemmeldi" (GENERAL solo) | 0.055 (was 0.013 without solo-boost) |
| "Yemek mükemmeldi" (FOOD solo) | 0.119 (unchanged — heavy category) |
| 2 categories (FOOD + STAFF) | 0.165 |
| 10-category narrative | 0.261 |

Resulting ratios after all three mechanisms:
- 10-category / average-single ≈ **5.4×** (was 11×)
- 10-category / GENERAL-solo ≈ **4.8×** (was 47×)
- GENERAL-solo / FOOD-solo ≈ **0.46×** (was 0.12×)

---

## Backward compatibility

- `MentionScoreInput.share?` is optional, defaults to 1.0. Callers that don't run
  attribution behave exactly as before.
- All three new functions are pure and side-effect free.
- `distributeAttribution` and `applyCategoryRankDamping` operate per-review;
  `resolveCategoryWeight` is used during cross-review category aggregation.

---

## Not in scope (still open)

- **Tip 4 (wrong-category) residuals:** handled in ABSA prompt (disambiguation
  rules + few-shot), not in scoring. A wrong-category aspect still scores in its
  (wrong) category — soft attribution does not fix misclassification.
- **raw_aspects vs dashboard_aspects split:** not implemented. Currently one
  aspect stream. If a dedup/collapse layer is later wanted for dashboard display,
  it should preserve raw aspects for audit and collapse only for presentation.
