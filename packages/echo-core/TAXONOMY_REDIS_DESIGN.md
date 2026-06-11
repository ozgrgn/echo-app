# Taxonomy in Redis — Design

How the taxonomy moves from a bundled JSON file to a Redis-served, shared,
versioned config that all services (absa-service, echo-backend, echo-panel)
read independently — with NO shared code package.

> Current state (done): taxonomy is `taxonomy.json` in review-core, loaded
> synchronously by `categories.ts`. This doc specifies the next step.

---

## Goal & principles

- **Single source of runtime truth:** Redis holds the active taxonomy. All
  services read it; none import a shared taxonomy package.
- **Shared-nothing code:** no `@talkwo/echo-core` runtime dependency across
  repos. Each service owns its own loader + types (copied or locally defined).
- **Versioned:** taxonomy changes are versioned; services cache by version and
  invalidate cleanly. Critical for ABSA prompt caching (see below).
- **Durable source + hot cache:** Redis is volatile. The authoritative seed is
  a committed `taxonomy.json` (per service or a seed repo). Redis = hot cache,
  seeded from JSON on first boot / deploy.

---

## Redis key layout

```
taxonomy:current            → JSON string of the active taxonomy (full blob)
taxonomy:version            → version string, e.g. "resort_taxonomy_v1.0.0"
taxonomy:v<X>               → versioned snapshot (immutable, for rollback)
taxonomy:tenant:<key>       → (future) per-tenant override blob, merged over current
```

Blob shape = exactly today's `taxonomy.json`:
```json
{
  "version": "resort_taxonomy_v1.0.0",
  "categories":      [ { key, label, labelEn, weight, inGpi, alertOnly?, informationalOnly?, primaryOwner, subcategories } ],
  "subcategories":   [ { key, category, label, labelEn, weight, severityBase? } ],
  "disambiguationRules": [ { pattern, category, subcategory, excludeCategories, rationale? } ]
}
```

---

## Per-service loader pattern

Each service implements its OWN loader (no shared package). Pseudocode:

```
async function loadTaxonomy(redis):
    raw = await redis.get('taxonomy:current')
    if raw is null:
        # cold cache — seed from local committed taxonomy.json
        raw = readFileSync('./taxonomy.json')
        await redis.set('taxonomy:current', raw)
        await redis.set('taxonomy:version', JSON.parse(raw).version)
    taxonomy = JSON.parse(raw)
    validate(taxonomy)        # service-local Zod/manual check (boundary validation)
    return buildDerived(taxonomy)   # CATEGORY_LIST, SUBCATEGORY_MAP, etc.
```

- **Validation at the boundary:** each service validates the blob shape itself
  (shared-nothing — no shared validator). Reject/alert on malformed taxonomy.
- **In-process cache:** after load, hold derived structures in module memory.
  Re-load on version change (see invalidation).

---

## The sync → async problem (the real work)

Today `categories.ts` exports are **synchronous module-level constants**
(`CATEGORY_LIST`, `SUBCATEGORY_MAP`, …). Redis reads are **async**. You cannot
`await` at module top-level in every consumer cleanly.

Options per service:
1. **Boot-time load (recommended):** on service startup, `await loadTaxonomy()`
   ONCE, store in a module singleton, then expose sync getters. Nothing serves
   traffic until taxonomy is loaded. Simple, safe.
2. **Lazy + cached:** first access triggers async load, caches result. Needs all
   call sites to be async-aware. More invasive.

ABSA specifically: the system prompt is built from the taxonomy at startup
(`SYSTEM_PROMPT` constant). With Redis, prompt build must happen AFTER taxonomy
load — i.e. `buildSystemPrompt()` becomes part of boot, not module-eval.

---

## Versioning & invalidation (critical for ABSA prompt caching)

- ABSA's OpenAI prompt caching requires the system prompt to be byte-identical
  across requests. The prompt embeds the taxonomy. So:
  - Pin the built prompt to `taxonomy:version`.
  - While version is unchanged → prompt is stable → OpenAI cache hits continue.
  - When taxonomy changes → bump version → rebuild prompt → cache naturally
    re-warms. Also bump `TAXONOMY_VERSION` in versions.ts so AbsaPatchPayload
    records which taxonomy produced each result.
- Services detect version change by polling `taxonomy:version` (cheap) or via a
  pub/sub channel `taxonomy:updated`. On change → reload → rebuild derived data.

---

## Update flow (how taxonomy changes ship)

```
1. Edit taxonomy.json (or an admin tool writes new blob).
2. Bump version field.
3. Write to Redis: SET taxonomy:v<new>, SET taxonomy:current, SET taxonomy:version.
4. PUBLISH taxonomy:updated (optional, for live reload).
5. Services reload on next poll / pub-sub event → rebuild prompt/validation/scoring.
```

Rollback = `SET taxonomy:current = taxonomy:v<previous>`.

---

## Migration steps (incremental, each leaves system working)

1. ✅ **Done:** taxonomy extracted to `taxonomy.json`, loaded sync in review-core.
2. **Add Redis loader** in each service that reads taxonomy (absa-service first,
   then echo-backend). Seed from local taxonomy.json on cold cache.
3. **Switch derived exports to boot-time async load** (Option 1). ABSA prompt
   build moves into boot.
4. **Drop the `@talkwo/echo-core` taxonomy dependency** per service — each
   carries its own copy of `taxonomy.json` (seed) + loader + types.
5. **Scoring code** (review-core) → moves into echo-backend (only consumer).
   Types → copied per service (shared-nothing). review-core can then be retired
   or shrunk to a seed-data repo.

---

## What stays where (end state — shared-nothing)

| Thing | Location |
|---|---|
| Taxonomy DATA (active) | Redis `taxonomy:current` |
| Taxonomy SEED (durable) | committed `taxonomy.json` per service |
| Taxonomy TYPES | defined per service (copied) |
| Scoring functions | echo-backend only |
| ABSA prompt/validation | absa-service only |
| Boundary validation (Zod/manual) | each service, at its edges |

No shared runtime package. Services communicate via Redis (taxonomy) + HTTP
(aspects, scores). Contracts are JSON shapes, validated at each boundary.
