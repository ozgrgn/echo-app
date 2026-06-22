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
  survey: boolean;
  feedback: boolean;
  tenant: boolean;
}

export const MOCK_CONFIG: MockConfig = {
  reviews: false,  // REAL — Bronze layer shipped
  venues: false,   // REAL — /v1/venues shipped
  scores: false,   // REAL — Gold layer (M3) shipped
  survey: false,   // LIVE — surfaces 404 until /v1/surveys/* lands (intentional)
  feedback: false, // LIVE — surfaces 404 until /v1/feedback lands (intentional)
  tenant: false    // LIVE — surfaces 404 until /v1/tenants/me lands (intentional)
};

/** @deprecated Use MOCK_CONFIG.<domain>. Kept as `true` only so any
 *  not-yet-migrated reference still resolves; will be removed. */
export const USE_MOCK = true;

// Default: production Railway service per AGENT_USAGE.md.
// Override at app startup via setApiBaseUrl() — typically called once from
// apps/echo-panel/src/lib/api/client.ts with import.meta.env.PUBLIC_ECHO_API_URL.
let _baseUrl = 'https://backend-production-5c03.up.railway.app/v1';

export function getApiBaseUrl(): string {
  return _baseUrl;
}

export function setApiBaseUrl(url: string): void {
  // Strip trailing slash for consistency — endpoints always start with /
  _baseUrl = url.replace(/\/$/, '');
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

export async function login(creds: AuthCredentials): Promise<AuthTokenResponse> {
  // Always real — mock data domains still need a valid JWT for the real backend.
  const res = await fetch(`${getApiBaseUrl()}/auth/token`, {
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

export async function fetchTenant(token: string): Promise<Tenant> {
  if (USE_MOCK) {
    const { MOCK_TENANT } = await import('./mock/tenant.js');
    _cachedTenant = MOCK_TENANT;
    return MOCK_TENANT;
  }
  const res = await fetch(`${getApiBaseUrl()}/tenants/me`, {
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

export async function listVenues(token: string): Promise<Venue[]> {
  if (USE_MOCK) {
    const { MOCK_VENUES } = await import('./mock/venues.js');
    return MOCK_VENUES;
  }
  const res = await fetch(`${getApiBaseUrl()}/venues?limit=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.items ?? data;
}

// ─── Hotel scores ───────────────────────────────────────────────────────────

export async function getHotelScore(
  venueSlug: string,
  period: string | undefined,
  token: string,
  /** Per-channel snapshot, e.g. 'tripadvisor'. Omit (or 'all') for the blended
   *  cross-platform score. Backend reads ?platform= (scores/read.ts). */
  platform?: string
): Promise<HotelScore> {
  if (MOCK_CONFIG.scores) {
    const { MOCK_HOTEL_SCORE } = await import('./mock/hotel-score.js');
    return MOCK_HOTEL_SCORE;
  }
  // No period → backend returns the latest snapshot for this venue.
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  if (platform && platform !== 'all') params.set('platform', platform);
  const qs = params.toString();
  const url = `${getApiBaseUrl()}/scores/${venueSlug}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`getHotelScore failed: ${res.status}`);
  return res.json();
}

export async function getCompetitorScores(
  venueSlug: string,
  period: string | undefined,
  token: string
): Promise<CompetitorScore[]> {
  if (MOCK_CONFIG.scores) {
    const { MOCK_COMPETITORS } = await import('./mock/competitors.js');
    return MOCK_COMPETITORS;
  }
  const url = period
    ? `${getApiBaseUrl()}/scores/${venueSlug}/competitors?period=${encodeURIComponent(period)}`
    : `${getApiBaseUrl()}/scores/${venueSlug}/competitors`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`getCompetitorScores failed: ${res.status}`);
  return res.json();
}

export async function getPortfolioScore(
  period: string,
  token: string
): Promise<PortfolioScore> {
  if (MOCK_CONFIG.scores) {
    const { MOCK_PORTFOLIO } = await import('./mock/portfolio.js');
    return MOCK_PORTFOLIO;
  }
  const res = await fetch(`${getApiBaseUrl()}/scores/portfolio?scope=tenant&period=${period}`, {
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
  token: string
): Promise<{ items: Review[]; nextCursor: string | null }> {
  if (MOCK_CONFIG.reviews) {
    const { MOCK_REVIEWS } = await import('./mock/reviews.js');
    return { items: MOCK_REVIEWS, nextCursor: null };
  }
  const params = new URLSearchParams({
    venueSlug,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
  } as Record<string, string>);
  const res = await fetch(`${getApiBaseUrl()}/reviews?${params}`, {
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
  token: string
): Promise<{ items: MentionRow[] }> {
  const params = new URLSearchParams({
    venueSlug,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
  } as Record<string, string>);
  const res = await fetch(`${getApiBaseUrl()}/mentions?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getMentions failed: ${res.status}`);
  return res.json();
}

// ─── Segments (audience breakdown: language + tripType) ─────────────────────

export interface SegmentBucket {
  /** Raw value ('en', 'FAMILY', …) or 'unknown'. */
  key: string;
  count: number;
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
  platform?: string
): Promise<SegmentsResponse> {
  const params = new URLSearchParams({ venueSlug, ...(platform ? { platform } : {}) });
  const res = await fetch(`${getApiBaseUrl()}/segments?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`getSegments failed: ${res.status}`);
  return res.json();
}

// ─── Venue Settings ─────────────────────────────────────────────────────────

export async function getVenueSettings(
  venueSlug: string,
  token: string,
): Promise<EchoVenueSettings> {
  const res = await fetch(`${getApiBaseUrl()}/venues/${encodeURIComponent(venueSlug)}/settings`, {
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
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/venues/${encodeURIComponent(venueSlug)}/settings`, {
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
  token: string
): Promise<SurveyResponse[]> {
  if (USE_MOCK) {
    const { MOCK_SURVEY_RESPONSES } = await import('./mock/survey.js');
    return MOCK_SURVEY_RESPONSES;
  }
  const res = await fetch(`${getApiBaseUrl()}/surveys/${venueSlug}/responses`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function getSurveyTemplates(
  venueSlug: string,
  token: string
): Promise<SurveyTemplate[]> {
  if (USE_MOCK) {
    const { MOCK_SURVEY_TEMPLATES } = await import('./mock/survey-templates.js');
    return MOCK_SURVEY_TEMPLATES;
  }
  const res = await fetch(`${getApiBaseUrl()}/surveys/${venueSlug}/templates`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// ─── GR Feedback (Hoops-Integrated mode only) ───────────────────────────────

export async function getFeedback(venueSlug: string, token: string): Promise<GRFeedback[]> {
  if (USE_MOCK) {
    const { MOCK_FEEDBACK } = await import('./mock/feedback.js');
    return MOCK_FEEDBACK;
  }
  const res = await fetch(`${getApiBaseUrl()}/feedback?venueSlug=${venueSlug}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}
