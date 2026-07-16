# UI Backlog

Deferred UI/UX work — captured so it isn't lost, not yet scheduled.

## Mention list — real backend pagination

**Where:** `/os/department/[dept]` page → `MentionExplorer` (mention list under the
"Departman skoru trendi" chart).

**Current state (2026-07-17):** The client only ever holds up to **60** mentions.
`loadMentions()` in `apps/echo-panel/src/routes/(os)/os/department/[dept]/+page.svelte`
requests `limit: 60` (v2) / `limit: 40` (legacy fallback) and then re-caps with
`.slice(0, 60)`. The header "381 mention" is the total count, but the list never
shows all of them. There is no pagination and no "load more".

**Decision:** We will build **real pagination on the backend** — NOT a client-side
"show more" over the 60 already fetched. The list must be able to page through the
full mention set (all ~381 for a busy department), fetched on demand.

**Scope when picked up:**
- Backend API: add offset/cursor + page-size params to the mentions endpoint
  (the `/api/os/data?resource=mentions…` path the panel calls), returning a page
  plus a total/next-cursor so the client knows there is more.
- Drop the hard `limit: 60` / `.slice(0, 60)` cap in `loadMentions()`; fetch page
  by page instead.
- `MentionExplorer`: add pagination controls (page nav or infinite "load more")
  driven by the backend cursor, and keep the polarity filter tabs + `mentionScope`
  narrowing working across pages.

**Why deferred:** touches the backend/API contract, not just the panel — bigger
than the same-session UI fixes, so parked here for a dedicated pass.
