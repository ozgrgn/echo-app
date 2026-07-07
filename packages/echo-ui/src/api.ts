// Per-function mock flags (Phase 2 incremental migration).
//
// Phase 1 had a single global USE_MOCK. As real backend endpoints come
// online they are flipped here one data-domain at a time — the "strangler
// fig" pattern. Today:
//   - reviews:  REAL  — backend ships the Bronze /v1/reviews endpoint
//   - venues:   REAL  — backend ships /v1/venues
//   - scores:   MOCK  — Gold layer (GPI/RPI) not built yet
//   - survey:   MOCK  — ops-engine proxy endpoints not wired (§12.4.1)
//   - feedback: MOCK  — same
//   - tenant:   MOCK  — subscription endpoint shape still TBD
//
// `login()` is ALWAYS real — even mock data domains need a valid JWT
// because the real backend's /v1/reviews requires a Bearer token.
//
// Auth model (per API.md §2-3): OAuth 2.0 Client Credentials.
// The panel signs in once with { tenantKey, clientSecret } and receives a JWT
// access token with a 1-hour TTL. On 401, re-auth transparently and retry.
//
// Base URL convention: includes the /v1 prefix. All endpoint paths below are
// relative to it and do NOT add /v1 themselves.

import type {
  Tenant,
  EchoSubscription,
  Venue,
  HotelScore,
  CompetitorScore,
  PortfolioScore,
  Review,
  SurveyResponse,
  SurveyTemplate,
  GRFeedback,
  EchoVenueSettings,
  HoopsNotifSettings,
} from '@talkwo/echo-core';
import { adaptTripadvisorReview } from './adapters/tripadvisor.js';

export interface MockConfig {
  reviews: boolean;
  venues: boolean;
  scores: boolean;
  competitors: boolean;
  survey: boolean;
  feedback: boolean;
  tenant: boolean;
}

export const MOCK_CONFIG: MockConfig = {
  reviews: false,     // REAL — Bronze layer shipped
  venues: false,      // REAL — /v1/venues shipped
  scores: false,      // REAL — Gold layer (M3) shipped
  competitors: false, // REAL — competitor scoring shipped (2026-07: Lago 5 rivals + RPI)
  survey: false,      // LIVE — surfaces 404 until /v1/surveys/* lands (intentional)
  feedback: false,    // LIVE — surfaces 404 until /v1/feedback lands (intentional)
  tenant: false       // LIVE — surfaces 404 until /v1/tenants/me lands (intentional)
};

// Default: production Railway service per AGENT_USAGE.md.
// Override at app startup via setApiBaseUrl() — typically called once from
// apps/echo-panel/src/lib/api/client.ts with import.meta.env.PUBLIC_ECHO_API_URL.
let _baseUrl = 'https://echo-api-production-b3a5.up.railway.app/v1';

export function getApiBaseUrl(): string {
  return _baseUrl;
}

export function setApiBaseUrl(url: string): void {
  // Strip trailing slash for consistency — endpoints always start with /
  _baseUrl = url.replace(/\/$/, '');
}

/** Optional per-call overrides for SSR: server passes an internal baseUrl and
 *  the request-scoped fetch; client callers pass nothing and get the globals. */
export interface FetchOpts {
  baseUrl?: string;
  fetch?: typeof fetch;
}

function resolveFetch(opts?: FetchOpts): { base: string; f: typeof fetch } {
  return { base: opts?.baseUrl ?? getApiBaseUrl(), f: opts?.fetch ?? fetch };
}

export interface AuthCredentials {
  tenantKey: string;
  clientSecret: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(creds: AuthCredentials, opts?: FetchOpts): Promise<AuthTokenResponse> {
  const { base, f } = resolveFetch(opts);
  // Always real — mock data domains still need a valid JWT for the real backend.
  const res = await f(`${base}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds)
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(problem.detail || `Login failed: ${res.status}`);
  }
  return res.json();
}

// ─── Tenant & subscription (populated after login, cached) ──────────────────

let _cachedTenant: Tenant | null = null;

export async function fetchTenant(token: string, opts?: FetchOpts): Promise<Tenant> {
  if (MOCK_CONFIG.tenant) {
    const { MOCK_TENANT } = await import('./mock/tenant.js');
    _cachedTenant = MOCK_TENANT;
    return MOCK_TENANT;
  }
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/tenants/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data: Tenant = await res.json();
  _cachedTenant = data;
  return data;
}

/** Returns the ECHO subscription row for the current tenant, or null if
 *  not subscribed. Read synchronously — assumes fetchTenant() was called
 *  at login. */
export function getMySubscription(): EchoSubscription | null {
  if (!_cachedTenant) return null;
  const sub = _cachedTenant.subscriptions.find((s) => s.module === 'echo');
  return (sub as EchoSubscription | undefined) ?? null;
}

export function clearTenantCache() {
  _cachedTenant = null;
}

// ─── Venues ─────────────────────────────────────────────────────────────────

export async function listVenues(token: string, opts?: FetchOpts): Promise<Venue[]> {
  if (MOCK_CONFIG.venues) {
    const { MOCK_VENUES } = await import('./mock/venues.js');
    return MOCK_VENUES;
  }
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/venues?limit=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.items ?? data;
}

/**
 * Superadmin: list ALL venues including competitors (?include=competitors). The
 * /admin surface needs both; normal listVenues default-hides competitors. Always live.
 */
export async function listAllVenues(token: string, opts?: FetchOpts): Promise<Venue[]> {
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/venues?limit=200&include=competitors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.items ?? data;
}

// ─── Superadmin: platform selection + refs + watch CRUD (panel /admin) ────────

export interface PlatformRefs {
  tripadvisor?: { locationId: number; url: string };
  google?: { placeId?: string; url?: string };
  holidaycheck?: { url: string };
  check24?: { url: string };
  booking?: { url: string };
}

async function adminWrite(path: string, method: string, body: unknown, token: string, opts?: FetchOpts): Promise<void> {
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({ detail: `${method} ${path} failed` }));
    throw new Error(problem.detail || `${method} ${path} failed: ${res.status}`);
  }
}

/** Set an owned venue's platform selection (+ optional refs). */
export function patchVenuePlatforms(
  venueId: string,
  patch: { watchedPlatforms?: string[]; platformRefs?: PlatformRefs },
  token: string,
  opts?: FetchOpts,
): Promise<void> {
  return adminWrite(`/admin/venues/${encodeURIComponent(venueId)}/platforms`, 'PATCH', patch, token, opts);
}

/** Set any venue's scraper credentials (used for competitors). */
export function patchVenueRefs(venueId: string, refs: PlatformRefs, token: string, opts?: FetchOpts): Promise<void> {
  return adminWrite(`/admin/venues/${encodeURIComponent(venueId)}/refs`, 'PATCH', refs, token, opts);
}

export interface WatchRecord {
  ownerVenueId: string;
  targetVenueId: string;
  relation: 'competitor' | 'self';
  createdAt: string;
  updatedAt: string;
}

/** List watches (optionally for one owner). */
export async function listWatches(token: string, ownerVenueId?: string, opts?: FetchOpts): Promise<WatchRecord[]> {
  const { base, f } = resolveFetch(opts);
  const q = ownerVenueId ? `?ownerVenueId=${encodeURIComponent(ownerVenueId)}` : '';
  const res = await f(`${base}/admin/watches${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.watches ?? [];
}

/** Create a watch (owner → target). */
export function createWatch(ownerVenueId: string, targetVenueId: string, token: string, opts?: FetchOpts): Promise<void> {
  return adminWrite('/admin/watches', 'POST', { ownerVenueId, targetVenueId }, token, opts);
}

/** Delete a watch. */
export function deleteWatch(ownerVenueId: string, targetVenueId: string, token: string, opts?: FetchOpts): Promise<void> {
  return adminWrite(
    `/admin/watches/${encodeURIComponent(ownerVenueId)}/${encodeURIComponent(targetVenueId)}`,
    'DELETE', undefined, token, opts,
  );
}

// ─── Hotel scores ───────────────────────────────────────────────────────────

export async function getHotelScore(
  venueSlug: string,
  period: string | undefined,
  token: string,
  /** Per-channel snapshot, e.g. 'tripadvisor'. Omit (or 'all') for the blended
   *  cross-platform score. Backend reads ?platform= (scores/read.ts). */
  platform?: string,
  /** Time window: '24mo' (default, full history) | '12mo' | '6mo' | '3mo'. Omit or
   *  '24mo' → full-history score. Backend reads ?window= (scores/read.ts). */
  window?: string,
  opts?: FetchOpts
): Promise<HotelScore> {
  if (MOCK_CONFIG.scores) {
    const { MOCK_HOTEL_SCORE } = await import('./mock/hotel-score.js');
    return MOCK_HOTEL_SCORE;
  }
  const { base, f } = resolveFetch(opts);
  // No period → backend returns the latest snapshot for this venue.
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  if (platform && platform !== 'all') params.set('platform', platform);
  if (window && window !== '24mo') params.set('window', window);
  const qs = params.toString();
  const url = `${base}/scores/${venueSlug}${qs ? `?${qs}` : ''}`;
  const res = await f(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`getHotelScore failed: ${res.status}`);
  return res.json();
}

export async function getCompetitorScores(
  venueSlug: string,
  period: string | undefined,
  token: string,
  /** Time window: '24mo' (default) | '12mo' | '6mo' | '3mo'. Ranks competitors in the
   *  same horizon as the own-venue card. Backend reads ?window= (scores/read.ts). */
  window?: string,
  opts?: FetchOpts
): Promise<CompetitorScore[]> {
  // Competitors are REAL now (2026-07: Lago's rivals scored + RPI). We still fall
  // back to the demo set if the live endpoint returns an empty list (e.g. a tenant
  // with no competitors yet), so a bare page never looks broken.
  if (MOCK_CONFIG.competitors) {
    const { MOCK_COMPETITORS } = await import('./mock/competitors.js');
    return MOCK_COMPETITORS;
  }
  const { base, f } = resolveFetch(opts);
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  if (window && window !== '24mo') params.set('window', window);
  const qs = params.toString();
  const url = `${base}/scores/${venueSlug}/competitors${qs ? `?${qs}` : ''}`;
  const res = await f(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`getCompetitorScores failed: ${res.status}`);
  const live: CompetitorScore[] = await res.json();
  if (live.length === 0) {
    const { MOCK_COMPETITORS } = await import('./mock/competitors.js');
    return MOCK_COMPETITORS;
  }
  return live;
}

export async function getPortfolioScore(
  period: string,
  token: string,
  opts?: FetchOpts
): Promise<PortfolioScore> {
  if (MOCK_CONFIG.scores) {
    const { MOCK_PORTFOLIO } = await import('./mock/portfolio.js');
    return MOCK_PORTFOLIO;
  }
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/scores/portfolio?scope=tenant&period=${period}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getPortfolioScore failed: ${res.status}`);
  return res.json();
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export interface ReviewFilters {
  platform?: string;
  category?: string;
  sentiment?: string;
  lang?: string;
  /** Filter by owner-response presence. 'with' = has response, 'without' = no response. */
  response?: 'with' | 'without';
  cursor?: string;
  limit?: number;
}

export async function getReviews(
  venueSlug: string,
  filters: ReviewFilters,
  token: string,
  opts?: FetchOpts
): Promise<{ items: Review[]; nextCursor: string | null }> {
  if (MOCK_CONFIG.reviews) {
    const { MOCK_REVIEWS } = await import('./mock/reviews.js');
    return { items: MOCK_REVIEWS, nextCursor: null };
  }
  const { base, f } = resolveFetch(opts);
  const params = new URLSearchParams({
    venueSlug,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
  } as Record<string, string>);
  const res = await f(`${base}/reviews?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getReviews failed: ${res.status}`);
  return res.json();
}

// ─── Mentions (sentence-level ABSA explorer) ────────────────────────────────

/** One flattened ABSA aspect — the unit the Semantic Mentions explorer renders. */
export interface MentionRow {
  reviewId: string;
  platform: string;
  publishedDate: string;
  category: string;
  subcategory: string;
  sentiment: string;
  /** -1..+1, signed. */
  polarity: number;
  excerpt: string;
  target_text: string | null;
}

export interface MentionFilters {
  category?: string;
  subcategory?: string;
  /** 'negative' → polarity ≤ -0.2, 'positive' → polarity ≥ +0.2. */
  polarity?: 'negative' | 'positive';
  limit?: number;
}

export async function getMentions(
  venueSlug: string,
  filters: MentionFilters,
  token: string,
  opts?: FetchOpts
): Promise<{ items: MentionRow[] }> {
  const { base, f } = resolveFetch(opts);
  const params = new URLSearchParams({
    venueSlug,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
  } as Record<string, string>);
  const res = await f(`${base}/mentions?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getMentions failed: ${res.status}`);
  return res.json();
}

// ─── Response management (OS "Yanıtlar" tab) ─────────────────────────────────
// Real analytics + prioritized unanswered inbox from /v1/responses/*.
// Sentiment buckets are rating5-based (see echo-backend reviews/responses.ts).

export interface ResponseRateSlice {
  key: 'negative' | 'neutral' | 'positive';
  total: number;
  responded: number;
  rate: number;
}

export interface PlatformResponseSlice {
  platform: string;
  total: number;
  responded: number;
  rate: number;
  medianResponseTimeHours: number | null;
}

export interface ResponseStats {
  total: number;
  withResponse: number;
  rate: number;
  medianResponseTimeHours: number | null;
  /** Replies with BOTH dates (Google replies carry no respondedAt → excluded). */
  responseTimeKnownCount: number;
  unanswered: { total: number; negative: number };
  bySentiment: ResponseRateSlice[];
  /** Present only on venue-wide requests (no platform filter). */
  byPlatform?: PlatformResponseSlice[];
}

export interface ResponseQueueItem {
  id: string;
  platform: string;
  publishedDate: string;
  rating: number | null;
  rating5: number | null;
  title: string;
  text: string;
  lang: string;
  author: string;
  url: string | null;
  ageDays: number;
  /** 0–100 triage score: negativity × freshness × has-text ("en yanan üstte"). */
  priority: number;
}

export async function getResponseStats(
  venueSlug: string,
  token: string,
  platform?: string,
  opts?: FetchOpts
): Promise<ResponseStats> {
  const { base, f } = resolveFetch(opts);
  const params = new URLSearchParams({ venueSlug, ...(platform ? { platform } : {}) });
  const res = await f(`${base}/responses/stats?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getResponseStats failed: ${res.status}`);
  return res.json();
}

export async function getResponseQueue(
  venueSlug: string,
  token: string,
  opts: { platform?: string; limit?: number } = {},
  fetchOpts?: FetchOpts
): Promise<{ items: ResponseQueueItem[] }> {
  const { base, f } = resolveFetch(fetchOpts);
  const params = new URLSearchParams({
    venueSlug,
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.limit ? { limit: String(opts.limit) } : {})
  });
  const res = await f(`${base}/responses/queue?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getResponseQueue failed: ${res.status}`);
  return res.json();
}

// ─── Department rollup (OS "Departmanlar" lens) ──────────────────────────────
// REAL data: categories grouped by taxonomy primaryOwner. Replaces MOCK_OS_DEPTS.

export interface DepartmentScore {
  /** URL-safe slug of the owner label, e.g. 'f-b-muduru'. */
  key: string;
  /** Owner label, e.g. 'F&B Müdürü'. */
  label: string;
  categories: string[];
  /** Mention-weighted mean of member scores; null when no mentions. */
  score: number | null;
  trend: number;
  mentionCount: number;
  reviewCount: number;
}

export interface DepartmentCategoryBreakdown {
  category: string;
  label: string;
  headlineScore: number;
  mentionCount: number;
  trend: number;
}

export interface DepartmentTrendPoint {
  period: string;
  score: number | null;
}

export interface DepartmentDetail extends DepartmentScore {
  breakdown: DepartmentCategoryBreakdown[];
  topIssues: { category: string; subcategory: string; count: number; sampleExcerpt: string }[];
  topPraises: { category: string; subcategory: string; count: number; sampleExcerpt: string }[];
  /** REAL per-period series; ≤1 point until enough history accrues. */
  trend_series: DepartmentTrendPoint[];
}

export async function getDepartments(
  venueSlug: string,
  token: string,
  opts: { platform?: string; period?: string; window?: string } = {},
  fetchOpts?: FetchOpts
): Promise<{ departments: DepartmentScore[] }> {
  const { base, f } = resolveFetch(fetchOpts);
  const params = new URLSearchParams({
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.period ? { period: opts.period } : {}),
    ...(opts.window ? { window: opts.window } : {})
  });
  const qs = params.toString();
  const res = await f(`${base}/departments/${encodeURIComponent(venueSlug)}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getDepartments failed: ${res.status}`);
  return res.json();
}

export async function getDepartmentDetail(
  venueSlug: string,
  deptKey: string,
  token: string,
  opts: { platform?: string; period?: string; window?: string } = {},
  fetchOpts?: FetchOpts
): Promise<DepartmentDetail> {
  const { base, f } = resolveFetch(fetchOpts);
  const params = new URLSearchParams({
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.period ? { period: opts.period } : {}),
    ...(opts.window ? { window: opts.window } : {})
  });
  const qs = params.toString();
  const res = await f(
    `${base}/departments/${encodeURIComponent(venueSlug)}/${encodeURIComponent(deptKey)}${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`getDepartmentDetail failed: ${res.status}`);
  return res.json();
}

// ─── Impact analysis (OS "neyi düzeltirsem GPI artar?") ──────────────────────
// REAL leverage: per-category GPI lift computed with the backend scoring function.

export interface CategoryImpact {
  category: string;
  label: string;
  aspectScore: number | null;
  mentionCount: number;
  /** GPI points gained if this category rose to target, all else equal. */
  liftToTarget: number;
  /** Signed points below target (negative = currently dragging GPI down). */
  dragFromTop: number;
}

export interface ImpactResponse {
  gpi: number;
  target: number;
  categories: CategoryImpact[];
  underMeasured: { category: string; label: string; mentionCount: number }[];
}

export async function getImpact(
  venueSlug: string,
  token: string,
  opts: { platform?: string; period?: string; target?: number; window?: string } = {},
  fetchOpts?: FetchOpts
): Promise<ImpactResponse> {
  const { base, f } = resolveFetch(fetchOpts);
  const params = new URLSearchParams({
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.period ? { period: opts.period } : {}),
    ...(opts.target ? { target: String(opts.target) } : {}),
    ...(opts.window ? { window: opts.window } : {})
  });
  const qs = params.toString();
  const res = await f(
    `${base}/insights/impact/${encodeURIComponent(venueSlug)}${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`getImpact failed: ${res.status}`);
  return res.json();
}

// ─── Segments (audience breakdown: language + tripType) ─────────────────────

export interface SegmentBucket {
  /** Raw value ('en', 'FAMILY', …) or 'unknown'. */
  key: string;
  count: number;
  /**
   * Language buckets only: GPI (0–100) computed from this language's analyzed
   * reviews — same unit as the venue-wide score. null when the pool is too thin
   * to score, or on the 'unknown' bucket. Absent on tripType buckets.
   */
  gpi?: number | null;
}

export interface SegmentsResponse {
  total: number;
  languageKnown: number;
  byLanguage: SegmentBucket[];
  tripTypeKnown: number;
  byTripType: SegmentBucket[];
}

export async function getSegments(
  venueSlug: string,
  token: string,
  platform?: string,
  window?: string,
  opts?: FetchOpts
): Promise<SegmentsResponse> {
  const { base, f } = resolveFetch(opts);
  const params = new URLSearchParams({
    venueSlug,
    ...(platform ? { platform } : {}),
    ...(window ? { window } : {})
  });
  const res = await f(`${base}/segments?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getSegments failed: ${res.status}`);
  return res.json();
}

// ─── Score history (GPI time-series) ────────────────────────────────────────

export interface HistoryPoint {
  period: string; // 'YYYY-MM'
  scoredAt: string;
  gpi: number;
  reviewCount: number;
}

export async function getScoreHistory(
  venueSlug: string,
  token: string,
  opts: { platform?: string; limit?: number; window?: string } = {},
  fetchOpts?: FetchOpts
): Promise<{ venueSlug: string; platform: string; points: HistoryPoint[] }> {
  const { base, f } = resolveFetch(fetchOpts);
  const params = new URLSearchParams({
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.limit ? { limit: String(opts.limit) } : {}),
    ...(opts.window ? { window: opts.window } : {})
  });
  const qs = params.toString();
  const res = await f(
    `${base}/scores/${encodeURIComponent(venueSlug)}/history${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`getScoreHistory failed: ${res.status}`);
  return res.json();
}

/** One DAILY GPI point (asOfDate 'YYYY-MM-DD'), from GET /scores/:slug/daily.
 *  Unlike HistoryPoint (monthly `period`), this is the day-resolution series used
 *  to render a short window (e.g. 3mo/6mo) at daily granularity. */
export interface DailyHistoryPoint {
  asOfDate: string; // 'YYYY-MM-DD'
  scoredAt: string;
  gpi: number;
  reviewCount: number;
}

/**
 * Daily GPI series for a venue. `from`/`to` are inclusive ISO 'YYYY-MM-DD' bounds
 * — pass `from` to fetch just the selected window at day resolution. Absent bounds
 * return the full daily history (capped by the backend's limit).
 */
export async function getDailyHistory(
  venueSlug: string,
  token: string,
  opts: { platform?: string; from?: string; to?: string; window?: string; limit?: number } = {},
  fetchOpts?: FetchOpts
): Promise<{ venueSlug: string; platform: string; points: DailyHistoryPoint[] }> {
  const { base, f } = resolveFetch(fetchOpts);
  const params = new URLSearchParams({
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.from ? { from: opts.from } : {}),
    ...(opts.to ? { to: opts.to } : {}),
    ...(opts.window ? { window: opts.window } : {}),
    ...(opts.limit ? { limit: String(opts.limit) } : {})
  });
  const qs = params.toString();
  const res = await f(
    `${base}/scores/${encodeURIComponent(venueSlug)}/daily${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`getDailyHistory failed: ${res.status}`);
  return res.json();
}

// ─── Venue Settings ─────────────────────────────────────────────────────────

export async function getVenueSettings(
  venueSlug: string,
  token: string,
  opts?: FetchOpts,
): Promise<EchoVenueSettings> {
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/venues/${encodeURIComponent(venueSlug)}/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`getVenueSettings failed: ${res.status}`);
  const data = await res.json();
  return data.settings as EchoVenueSettings;
}

export async function patchVenueSettings(
  venueSlug: string,
  patch: { hoopsNotifications?: HoopsNotifSettings },
  token: string,
  opts?: FetchOpts,
): Promise<void> {
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/venues/${encodeURIComponent(venueSlug)}/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({ detail: 'Save failed' }));
    throw new Error(problem.detail || `patchVenueSettings failed: ${res.status}`);
  }
}

// ─── Survey (Hoops-Integrated mode only) ────────────────────────────────────

export async function getSurveyResponses(
  venueSlug: string,
  token: string,
  opts?: FetchOpts
): Promise<SurveyResponse[]> {
  if (MOCK_CONFIG.survey) {
    const { MOCK_SURVEY_RESPONSES } = await import('./mock/survey.js');
    return MOCK_SURVEY_RESPONSES;
  }
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/surveys/${venueSlug}/responses`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function getSurveyTemplates(
  venueSlug: string,
  token: string,
  opts?: FetchOpts
): Promise<SurveyTemplate[]> {
  if (MOCK_CONFIG.survey) {
    const { MOCK_SURVEY_TEMPLATES } = await import('./mock/survey-templates.js');
    return MOCK_SURVEY_TEMPLATES;
  }
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/surveys/${venueSlug}/templates`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// ─── GR Feedback (Hoops-Integrated mode only) ───────────────────────────────

export async function getFeedback(venueSlug: string, token: string, opts?: FetchOpts): Promise<GRFeedback[]> {
  if (MOCK_CONFIG.feedback) {
    const { MOCK_FEEDBACK } = await import('./mock/feedback.js');
    return MOCK_FEEDBACK;
  }
  const { base, f } = resolveFetch(opts);
  const res = await f(`${base}/feedback?venueSlug=${venueSlug}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}
