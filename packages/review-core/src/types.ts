// ─── Taxonomy ─────────────────────────────────────────────────────────────────

export type CategoryKey =
  | 'FOOD' | 'ROOM' | 'STAFF' | 'POOL' | 'ANIM'
  | 'FRONT' | 'FACILITY' | 'VALUE' | 'SPA' | 'GENERAL';

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

// Platform is intentionally an open string — Revora keeps adding sources and
// pricing is per-platform. Use PLATFORM_REGISTRY to render UI for known
// platforms (label, icon, status); unknown values must still display gracefully.
export type Platform = string;

export type PlatformStatus = 'shipped' | 'planned' | 'beta';

export interface PlatformMeta {
  key: string;
  label: string;
  icon: string;
  status: PlatformStatus;
}

export const PLATFORM_REGISTRY: Record<string, PlatformMeta> = {
  tripadvisor:  { key: 'tripadvisor',  label: 'TripAdvisor',  icon: '🦉', status: 'shipped' },
  google:       { key: 'google',       label: 'Google',       icon: '🔍', status: 'planned' },
  holidaycheck: { key: 'holidaycheck', label: 'HolidayCheck', icon: '🇩🇪', status: 'planned' },
  check24:      { key: 'check24',      label: 'Check24',      icon: '✅', status: 'planned' }
};

export type DataSource = 'review' | 'survey' | 'gr_feedback';

// ─── Category metadata ────────────────────────────────────────────────────────

export interface CategoryMeta {
  key: CategoryKey;
  label: string;           // display name (Turkish)
  labelEn: string;
  weight: number;          // 0–1, sum = 1.0
  subcategories: string[];
  department: string;      // responsible department manager
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export interface CategoryScore {
  category: CategoryKey;
  gpi: number;             // 0–100, Bayesian-smoothed
  rawGpi: number;          // pre-smoothing
  reviewCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  trend: number;           // delta vs 30 days ago (e.g. +2.3)
  topIssues: TopIssue[];
  topPraises: TopIssue[];
}

export interface TopIssue {
  subcategory: string;
  count: number;
  sampleExcerpt: string;
}

export interface HotelScore {
  venueSlug: string;       // canonical identifier (LAD-6)
  venueName: string;
  period: string;          // 'YYYY-MM' or 'YYYY-QN'
  gpi: number;             // weighted average of category GPIs
  rpi: number | null;      // null if no competitors configured
  reviewCount: number;
  categoryScores: CategoryScore[];
  updatedAt: string;       // ISO date
}

export interface CompetitorScore {
  venueSlug: string;
  venueName: string;
  gpi: number;
  reviewCount: number;
  categoryScores: Pick<CategoryScore, 'category' | 'gpi'>[];
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  platform: Platform;
  publishedDate: string;   // ISO
  rating: number;          // 1–5 (normalized)
  title: string;
  text: string;
  lang: string;            // ISO 639-1
  travelType: string;
  sentiments: SentimentItem[];
  ownerResponse?: string;
  sourceUrl?: string;      // link to platform (for "Open in TripAdvisor")
}

export interface SentimentItem {
  category: CategoryKey;
  subcategory: string;
  sentiment: Sentiment;
  intensity: number;       // 0–1
  excerpt: string;
}

// ─── Survey ──────────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  key: string;
  label: string;
  type: 'rating_5' | 'rating_10' | 'text' | 'choice';
  category?: CategoryKey;
  choices?: { value: string; label: string }[];
  required: boolean;
}

export interface SurveyTemplate {
  id: string;
  venueSlug: string;
  name: string;
  questions: SurveyQuestion[];
  active: boolean;
  createdAt: string;
}

export interface SurveyResponse {
  id: string;
  submittedAt: string;
  guestName?: string;
  roomNumber?: string;
  stayDates: { checkIn: string; checkOut: string };
  answers: Record<string, number | string | null>;
  derivedGpi: number;
}

// ─── Alerts (GR Feedback) ────────────────────────────────────────────────────

export interface GRFeedback {
  id: string;
  createdAt: string;
  category: CategoryKey;
  subcategory: string;
  severity: 'low' | 'medium' | 'high';
  text: string;
  resolvedAt?: string;
  department: string;
}

// ─── Venues ──────────────────────────────────────────────────────────────────

export interface Venue {
  venueId: string;         // MongoDB ObjectId (internal — rarely used in UI)
  slug: string;            // canonical, URL-friendly id
  name: string;
  platforms: Partial<Record<string, { locationId?: number; placeId?: string; url?: string }>>;
  region?: {
    area: string;
    district: string;
    province: string;
    country_code: string;
  };
  tz?: string;             // IANA timezone, e.g. 'Europe/Istanbul'
  isOwned: boolean;        // true = tenant owns; false = competitor
  source: 'manual' | 'auto';
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string;
}

// ─── Tenant & subscription ───────────────────────────────────────────────────

export interface Tenant {
  tenantKey: string;
  name: string;
  subscriptions: TenantSubscription[];
  createdAt: string;
}

export interface TenantSubscription {
  module: 'hoops' | 'revora' | string;
  tier: string;
  status: 'active' | 'trial' | 'paused' | 'cancelled';
  features: string[];
  limits: Record<string, number>;
  activatedAt: string;
  validUntil?: string;
}

/** Revora-module-specific subscription with strongly-typed usage/limits.
 *  See LAD-8 for the dimension list. */
export interface RevoraSubscription extends TenantSubscription {
  module: 'revora';
  usage: {
    responseDraftsThisMonth: number;
    responseDraftsResetAt: string;
  };
  limits: {
    platforms: number;
    competitors: number;
    reviewsPerMonth: number;
    responseDraftsPerMonth: number;
    requestsPerMinute: number;
    fetchesPerDay: number;
  };
}

// ─── Portfolio (cross-venue chain dashboard) ─────────────────────────────────

export interface PortfolioScore {
  period: string;
  kpis: {
    venueCount: number;
    avgGpi: number;
    totalReviewCount: number;
    activeAlertCount: number;
  };
  venues: HotelScore[];
  updatedAt: string;
}
