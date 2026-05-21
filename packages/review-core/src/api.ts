// In Phase 1, USE_MOCK=true and all functions return mock data.
// In Phase 2, set USE_MOCK=false and point BASE_URL to the Revora API.
//
// Auth model (per API.md §2-3): OAuth 2.0 Client Credentials.
// The panel signs in once with { tenantKey, clientSecret } and receives a JWT
// access token with a 1-hour TTL. On 401, re-auth transparently and retry.
//
// BASE_URL convention: includes the /v1 prefix. All endpoint paths below are
// relative to BASE_URL and do NOT add /v1 themselves. Matches PUBLIC_API_URL
// env var in spec §11.

import type {
  Tenant,
  RevoraSubscription,
  Venue,
  HotelScore,
  CompetitorScore,
  PortfolioScore,
  Review,
  SurveyResponse,
  SurveyTemplate,
  GRFeedback
} from './types.js';

export const USE_MOCK = true;

// Default: production Railway service per AGENT_USAGE.md.
// Override at app startup via setApiBaseUrl() — typically called once from
// apps/revora-panel/src/lib/api/client.ts with import.meta.env.PUBLIC_REVORA_API_URL.
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
  if (USE_MOCK) {
    return { accessToken: 'mock-jwt-token', tokenType: 'Bearer', expiresIn: 3600 };
  }
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

/** Returns the Revora subscription row for the current tenant, or null if
 *  not subscribed. Read synchronously — assumes fetchTenant() was called
 *  at login. */
export function getMySubscription(): RevoraSubscription | null {
  if (!_cachedTenant) return null;
  const sub = _cachedTenant.subscriptions.find((s) => s.module === 'revora');
  return (sub as RevoraSubscription | undefined) ?? null;
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
  period: string,
  token: string
): Promise<HotelScore> {
  if (USE_MOCK) {
    const { MOCK_HOTEL_SCORE } = await import('./mock/hotel-score.js');
    return MOCK_HOTEL_SCORE;
  }
  const res = await fetch(`${getApiBaseUrl()}/scores/${venueSlug}?period=${period}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function getCompetitorScores(
  venueSlug: string,
  period: string,
  token: string
): Promise<CompetitorScore[]> {
  if (USE_MOCK) {
    const { MOCK_COMPETITORS } = await import('./mock/competitors.js');
    return MOCK_COMPETITORS;
  }
  const res = await fetch(`${getApiBaseUrl()}/scores/${venueSlug}/competitors?period=${period}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function getPortfolioScore(
  period: string,
  token: string
): Promise<PortfolioScore> {
  if (USE_MOCK) {
    const { MOCK_PORTFOLIO } = await import('./mock/portfolio.js');
    return MOCK_PORTFOLIO;
  }
  const res = await fetch(`${getApiBaseUrl()}/scores/portfolio?scope=tenant&period=${period}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export interface ReviewFilters {
  platform?: string;
  category?: string;
  sentiment?: string;
  lang?: string;
  cursor?: string;
  limit?: number;
}

export async function getReviews(
  venueSlug: string,
  filters: ReviewFilters,
  token: string
): Promise<{ items: Review[]; nextCursor: string | null }> {
  if (USE_MOCK) {
    const { MOCK_REVIEWS } = await import('./mock/reviews.js');
    return { items: MOCK_REVIEWS, nextCursor: null };
  }
  const params = new URLSearchParams({ venueSlug, ...(filters as Record<string, string>) });
  const res = await fetch(`${getApiBaseUrl()}/reviews?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
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
