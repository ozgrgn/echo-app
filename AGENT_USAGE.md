# Revora API — Agent Usage Guide

A self-contained guide for an AI agent (e.g., another Claude) to integrate with the Revora hotel review aggregation API.

---

## What is Revora?

A multi-tenant Bronze-layer review aggregation API. You give it a hotel and a platform (TripAdvisor, Google, HolidayCheck), it scrapes the reviews via Apify and stores them in MongoDB. You can then query the raw reviews back.

**Currently supported platforms:** `tripadvisor`, `google`, `holidaycheck`
**Coming soon:** `check24`

---

## Connection Credentials

```env
BASE_URL=https://backend-production-5c03.up.railway.app
TENANT_KEY=TEN_LAGO_HOTELS
CLIENT_SECRET=cs_2ynCatJLjeLDuRjuvFq-WpKtbBs1YBVvWSXWwfDtGmo
```

> **Note:** This is a dev/staging credential. The MongoDB cluster is shared between local dev and prod. Treat with care.

---

## 1. Authentication (do this once, then reuse the token)

Revora uses JWT Bearer tokens (OAuth 2.0 Client Credentials). You exchange `tenantKey` + `clientSecret` for a short-lived access token (1 hour TTL).

### Request

```bash
curl -X POST https://backend-production-5c03.up.railway.app/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenantKey": "TEN_LAGO_HOTELS",
    "clientSecret": "cs_2ynCatJLjeLDuRjuvFq-WpKtbBs1YBVvWSXWwfDtGmo"
  }'
```

### Response (200)

```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

### Use the token

Include in every subsequent request:

```
Authorization: Bearer eyJhbGciOi...
```

When you get `401 Token expired`, just re-issue with the same credentials.

---

## 2. List Registered Hotels

```bash
curl https://backend-production-5c03.up.railway.app/v1/venues \
  -H "Authorization: Bearer eyJhbGciOi..."
```

### Response (200)

```json
{
  "items": [
    {
      "venueId": "6a08aa75b2f780ab0c068737",
      "slug": "lago-hotel-sorgun",
      "name": "Lago Hotel Sorgun",
      "platforms": {
        "tripadvisor": { "locationId": 545626, "url": "..." },
        "google": { "url": "https://www.google.com/maps/place/LAGO+HOTEL/..." },
        "holidaycheck": { "url": "https://www.holidaycheck.de/hr/..." }
      },
      "isOwned": true,
      "source": "manual",
      "status": "active",
      "createdAt": "2026-05-16T17:33:41.103Z",
      "updatedAt": "2026-05-18T19:50:00.000Z"
    }
  ],
  "nextCursor": null
}
```

Currently Lago Hotel Sorgun is registered with all 3 platforms. You can fetch its reviews immediately.

---

## 3. Register a New Hotel

If you want to add a hotel that isn't in the system, POST to `/v1/venues`. You only need to provide the platform identifiers you have — you can omit ones you don't know.

```bash
curl -X POST https://backend-production-5c03.up.railway.app/v1/venues \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "rixos-premium-belek",
    "name": "Rixos Premium Belek",
    "platforms": {
      "tripadvisor": {
        "locationId": 12345,
        "url": "https://www.tripadvisor.com/Hotel_Review-..."
      }
    }
  }'
```

### How to find platform identifiers

| Platform | What you need | How to find |
|---|---|---|
| TripAdvisor | `locationId` (number) + `url` | The `d{NUMBER}` part of the TripAdvisor URL is the `locationId` |
| Google | `url` (preferred) or `placeId` | Search the hotel on Google Maps and copy the URL |
| HolidayCheck | `url` | Search on holidaycheck.de, copy the URL (works with `/hi/` or `/hr/bewertungen-...` formats) |

POSTing the same `slug` again with updated `platforms` will upsert (not duplicate).

---

## 4. Fetch Reviews from a Platform

This is the main scraping call. It triggers an Apify run, waits for it to finish (sync), parses results, and stores them in MongoDB.

### Endpoint

```
POST /v1/fetch/:platform
```

`:platform` is one of: `tripadvisor`, `google`, `holidaycheck`.

### Request

```bash
curl -X POST https://backend-production-5c03.up.railway.app/v1/fetch/tripadvisor \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "venueSlug": "lago-hotel-sorgun",
    "maxItems": 50
  }'
```

### Response (200)

```json
{
  "ok": true,
  "platform": "tripadvisor",
  "provider": "apify",
  "venue": { "slug": "lago-hotel-sorgun", "venueId": "6a08aa75b2f780ab0c068737" },
  "collection": "tripadvisor_apify",
  "stats": { "fetched": 50, "inserted": 5, "updated": 45, "skipped": 0 },
  "durationMs": 18234,
  "runId": "abc123..."
}
```

### Time/cost expectations

| Platform | Speed | Cost |
|---|---|---|
| TripAdvisor | ~30 s / 200 reviews | $0.50 / 1K reviews |
| Google | ~10 s / 10 reviews | $0.60 / 1K reviews |
| HolidayCheck | ~14 s for **all** reviews (Lexis actor ignores `maxItems`) | $30/month subscription |

### Idempotency

Calling fetch repeatedly with the same `venueSlug` is safe — duplicate reviews are detected and merged (you'll see them in the `updated` count, not `inserted`).

---

## 5. Batch Fetch (Multiple Hotels + Auto-Create)

Fetch reviews for the home hotel + competitor hotels in a single call. Competitors not in the system are **automatically created**.

```bash
curl -X POST https://backend-production-5c03.up.railway.app/v1/fetch/batch \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "tripadvisor",
    "maxItemsPerVenue": 20,
    "venues": [
      { "slug": "lago-hotel-sorgun" },
      {
        "ref": {
          "tripadvisor": {
            "locationId": 1175553,
            "url": "https://www.tripadvisor.com/Hotel_Review-g297962-d1175553-..."
          }
        },
        "name": "Crystal Sunset Resort"
      }
    ]
  }'
```

Each `venues[]` entry must include **either**:
- `slug` — for a known venue (already in DB)
- `ref` + `name` — for a new competitor hotel (auto-created with `source: "auto"`, `isOwned: false`)

### Response (200)

```json
{
  "ok": true,
  "platform": "tripadvisor",
  "totalVenues": 2,
  "results": [
    {
      "slug": "lago-hotel-sorgun",
      "isOwned": true,
      "autoCreated": false,
      "ok": true,
      "stats": { "fetched": 20, "inserted": 0, "updated": 20 }
    },
    {
      "slug": "crystal-sunset-resort",
      "isOwned": false,
      "autoCreated": true,
      "ok": true,
      "stats": { "fetched": 20, "inserted": 20, "updated": 0 }
    }
  ]
}
```

If you call again with the same `ref`, no duplicate venue is created — lookup is by `platformRefs.<platform>.<id>`.

---

## 6. Query Stored Reviews

```bash
curl "https://backend-production-5c03.up.railway.app/v1/reviews?platform=tripadvisor&venueSlug=lago-hotel-sorgun&limit=20" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

### Query parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `platform` | enum (required) | — | `tripadvisor` / `google` / `holidaycheck` |
| `venueSlug` | string | — | Filter to one hotel |
| `lang` | string | — | ISO 639-1 (`en`, `de`, `tr`, `ru`, ...) |
| `since` | ISO 8601 datetime | — | Only reviews fetched after this |
| `cursor` | string | — | From previous response's `nextCursor` |
| `limit` | int (1-200) | 50 | Page size |

### Response (200)

```json
{
  "items": [
    {
      "_id": "...",
      "tenantKey": "TEN_LAGO_HOTELS",
      "venueId": "...",
      "_platform": "tripadvisor",
      "_provider": "apify",
      "_externalId": "1058930133",
      "_fetchedAt": "2026-05-16T17:36:54.981Z",
      "_updatedAt": "2026-05-18T19:55:00.000Z",
      "rating": 5,
      "title": "Wonderful stay",
      "text": "...",
      "lang": "en",
      "publishedDate": "2026-05-04",
      "user": { "name": "John D", "username": "johnd123", "..." },
      "ownerResponse": { "text": "Thank you...", "..." },
      "placeInfo": { "name": "Lago Hotel", "rating": 4.1, "numberOfReviews": 4064 }
    }
  ],
  "nextCursor": "eyJfaWQiOi..."
}
```

The doc contains the **raw provider payload** (Bronze layer) plus Revora metadata fields prefixed with `_`. Schema follows the provider's response exactly — no normalization.

### Pagination

```bash
# Page 1
curl "...?platform=tripadvisor&limit=50" -H "Authorization: ..."
# → response includes "nextCursor": "abc..."

# Page 2
curl "...?platform=tripadvisor&limit=50&cursor=abc..." -H "Authorization: ..."
```

When `nextCursor` is `null`, you've reached the end.

---

## 7. Currently Available Data (Lago Hotel Sorgun)

You can fetch the following for Lago immediately:

| Platform | Reviews already in DB | Field count per review |
|---|---|---|
| TripAdvisor | 200 | 22 fields (id, rating, title, text, lang, user, ownerResponse, ...) |
| Google | 10 | 61 fields (placeId, cid, fid, categoryName, reviewDetailedRating, responseFromOwnerText, isLocalGuide, ...) |
| HolidayCheck | 1984 | 16 fields (author, date, reviewId, reviewUrl, stars, title, ...) |
| Check24 | 0 | _(provider not implemented yet — returns 501)_ |

---

## 8. Health Endpoints (no auth needed)

```bash
curl https://backend-production-5c03.up.railway.app/health
# {"status":"ok","service":"revora-api","uptime":1234.5}

curl https://backend-production-5c03.up.railway.app/readiness
# {"status":"ready","checks":{"mongo":"ok"}}
```

---

## 9. Error Format (RFC 7807 Problem+JSON)

All errors look like:

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Token expired",
  "instance": "/v1/fetch/tripadvisor",
  "requestId": "08174e03-c960-4238-8619-8276d863aaa9"
}
```

| Status | When |
|---|---|
| `400` | Validation failed — `errors` field has details |
| `401` | Missing/invalid/expired token, wrong credentials |
| `404` | Venue or route not found |
| `422` | Logical conflict — e.g. fetching `google` for a venue that has no `google` ref |
| `501` | Platform/provider not registered (e.g. `check24` currently) |
| `502` | Apify call failed |
| `500` | Unexpected server error |

Always include `requestId` when reporting an issue.

---

## 10. Complete Walkthrough Example

A self-contained shell script that:
1. Gets a token
2. Fetches 20 fresh TripAdvisor reviews for Lago
3. Reads back the first 5

```bash
#!/usr/bin/env bash
set -e

BASE="https://backend-production-5c03.up.railway.app"
TENANT="TEN_LAGO_HOTELS"
SECRET="cs_2ynCatJLjeLDuRjuvFq-WpKtbBs1YBVvWSXWwfDtGmo"

# 1. Get token
TOKEN=$(curl -s -X POST "$BASE/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"tenantKey\":\"$TENANT\",\"clientSecret\":\"$SECRET\"}" \
  | jq -r .accessToken)
echo "Token obtained (expires in 1h)"

# 2. Fetch 20 reviews (takes ~10-15 seconds)
echo "Fetching reviews from TripAdvisor..."
curl -s -X POST "$BASE/v1/fetch/tripadvisor" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"venueSlug":"lago-hotel-sorgun","maxItems":20}' | jq

# 3. Read back 5 reviews
echo ""
echo "Reading reviews..."
curl -s "$BASE/v1/reviews?platform=tripadvisor&venueSlug=lago-hotel-sorgun&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.items[] | { rating, title, lang, publishedDate }'
```

---

## 11. Endpoint Quick Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Liveness probe |
| `GET` | `/readiness` | none | Mongo ping |
| `POST` | `/v1/auth/token` | clientSecret | Issue JWT |
| `POST` | `/v1/venues` | Bearer | Create/update hotel |
| `GET` | `/v1/venues` | Bearer | List hotels (cursor pagination) |
| `GET` | `/v1/venues/:slug` | Bearer | Get hotel detail |
| `POST` | `/v1/fetch/:platform` | Bearer | Scrape single hotel sync |
| `POST` | `/v1/fetch/batch` | Bearer | Scrape multi-hotel + auto-create competitors |
| `GET` | `/v1/reviews` | Bearer | Query stored reviews (filter + cursor) |

---

## Common Patterns

### Pattern A: Get fresh reviews and analyze
```
1. POST /v1/fetch/tripadvisor   { venueSlug, maxItems: 100 }
2. GET  /v1/reviews?platform=tripadvisor&venueSlug=X&limit=100
3. Analyze the items[]
```

### Pattern B: Compare hotel vs competitors
```
1. POST /v1/fetch/batch  { platform, venues: [own, comp1, comp2, ...] }
2. For each venueSlug returned:
   GET /v1/reviews?platform=X&venueSlug=...
```

### Pattern C: Multi-platform aggregation
```
1. POST /v1/fetch/tripadvisor   { venueSlug }
2. POST /v1/fetch/google         { venueSlug }
3. POST /v1/fetch/holidaycheck   { venueSlug }
4. GET  /v1/reviews?platform=tripadvisor&venueSlug=...
5. GET  /v1/reviews?platform=google&venueSlug=...
6. GET  /v1/reviews?platform=holidaycheck&venueSlug=...
```

---

## Limitations & Notes

- **`POST /v1/fetch/*` is synchronous** — for >500 reviews per call, the HTTP request may time out. Use sensible `maxItems` (≤300 for TripAdvisor/Google). HolidayCheck ignores `maxItems` and fetches all (currently Lago = 1984 in ~14s, OK).
- **HolidayCheck actor (Lexis Solutions)** doesn't respect `maxItems`. Whatever value you pass, it fetches all reviews on the URL.
- **Async mode (jobs + webhooks)** for large fetches (4000+ reviews) is not implemented yet — coming in Faz 6.
- **Reviews are stored raw** (Bronze layer). Each platform has its own schema. Don't expect normalized fields across platforms.
- **MongoDB cluster is shared** between local dev and prod (same Railway MongoDB service). Treat data carefully.
- **clientSecret in this doc is the current dev secret** — rotate before production launch.
