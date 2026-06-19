// ─── Taxonomy ─────────────────────────────────────────────────────────────────

export type CategoryKey =
  | 'FOOD' | 'ROOM' | 'STAFF' | 'FRONT'
  | 'POOL' | 'BEACH'
  | 'ENTERTAINMENT' | 'KIDS'
  | 'FACILITY' | 'SPA' | 'VALUE' | 'GENERAL'
  | 'LOCATION'   // informational only — inGpi: false
  | 'SECURITY';  // alert only    — inGpi: false

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

// Platform is intentionally an open string — ECHO keeps adding sources and
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

// Status reflects backend implementation as of AGENT_USAGE.md:
//   - tripadvisor:  shipped (Apify TripAdvisor actor, ~$0.50/1K reviews)
//   - google:       shipped (Apify Google Maps actor, ~$0.60/1K reviews)
//   - holidaycheck: shipped (Lexis Solutions actor, ~$30/mo flat, ignores maxItems — fetches all)
//   - check24:      planned (501 Not Implemented currently)
export const PLATFORM_REGISTRY: Record<string, PlatformMeta> = {
  tripadvisor:  { key: 'tripadvisor',  label: 'TripAdvisor',  icon: '🦉', status: 'shipped' },
  google:       { key: 'google',       label: 'Google',       icon: '🔍', status: 'shipped' },
  holidaycheck: { key: 'holidaycheck', label: 'HolidayCheck', icon: '🇩🇪', status: 'shipped' },
  check24:      { key: 'check24',      label: 'Check24',      icon: '✅', status: 'planned' }
};

export type DataSource = 'review' | 'survey' | 'gr_feedback';

// ─── Category metadata ────────────────────────────────────────────────────────

export interface CategoryMeta {
  key: CategoryKey;
  label: string;               // display name (Turkish)
  labelEn: string;
  weight: number;              // 0–1; 0 for LOCATION and SECURITY
  inGpi: boolean;              // false = excluded from GPI calculation
  alertOnly?: boolean;         // true for SECURITY — pure alert system
  informationalOnly?: boolean; // true for LOCATION — shown but not scored
  primaryOwner: string;        // display label for responsible dept (category-level)
  /** Seed list of English subcategory keys. NOT exhaustive — ABSA may produce
   *  new keys at runtime. Used for UI filter chips and prompt hints. */
  subcategories: string[];
}

export interface SubcategoryMeta {
  key: string;
  category: CategoryKey;
  label: string;               // Turkish display label
  labelEn: string;             // English display label
  weight: number;              // within-category importance (default 1.0)
  severityBase?: 'low' | 'medium' | 'high' | 'critical';
}

// ─── Scores ───────────────────────────────────────────────────────────────────

/**
 * Polarity distribution — 5-bucket histogram + aggregate stats.
 *
 * Computed server-side by the aggregation job from each mention's polarity
 * (continuous, -1..+1). Bucket boundaries:
 *   strong_negative: polarity ≤ -0.6
 *   negative:        -0.6 <  polarity ≤ -0.2
 *   neutral:         -0.2 <  polarity <  +0.2
 *   positive:        +0.2 ≤  polarity <  +0.6
 *   strong_positive: polarity ≥  +0.6
 *
 * Bucket counts sum to `CategoryScore.mentionCount`. The 5 buckets give UIs
 * enough resolution to draw a diverging histogram while keeping the legacy
 * 3-way split derivable (positive ∪ strong_positive, neutral, negative ∪
 * strong_negative).
 */
export interface SentimentDistribution {
  strongNegativeCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveCount: number;
  strongPositiveCount: number;
  /** Mean of all polarity values in the category, -1..+1. */
  meanPolarity: number;
  /** Population std dev of polarity values; null when mentionCount < 2. */
  stdDevPolarity: number | null;
}

export interface CategoryScore {
  category: CategoryKey;
  // Polarity-based aspect score: clamp(50 + 50×weightedPolarity, 0, 100)
  // null when mention count < MIN_MENTIONS_FOR_SCORE (5)
  aspectScore: number | null;
  // Headline score shown to users: 0.70×normalizedRating + 0.30×aspectScore
  // Falls back to normalizedRating alone when aspectScore is null
  headlineScore: number;
  mentionCount: number;   // total sentiment mentions in this category
  reviewCount: number;    // source reviews containing this category
  trend: number;          // delta vs 30 days ago (e.g. +2.3)
  topIssues: TopIssue[];
  topPraises: TopIssue[];
  /** 5-bucket polarity histogram + aggregate stats. */
  distribution: SentimentDistribution;
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
  avgStarRating: number;   // average OTA star rating (1–5)
  // Overall polarity-based aspect score across inGpi categories (0–100 | null)
  aspectScore: number | null;
  // Headline GPI shown to users: 0.70×normalizedRating + 0.30×aspectScore
  headlineScore: number;
  // Legacy alias — equals headlineScore; kept so display helpers compile
  gpi: number;
  rpi: number | null;      // null if no competitors configured
  reviewCount: number;
  categoryScores: CategoryScore[];
  responseStats: ResponseStats;
  updatedAt: string;       // ISO date

  // ── Baseline / comparison scores (computed by backend, optional) ──────────
  /** Flat 12-month average (no decay) — annual reputation baseline.
   *  Use for "Annual Reputation Baseline" KPI card, not as primary GPI.
   *  Computed when RECENCY_CONFIG.annualBaselineWindowDays reviews exist. */
  annualBaselineScore?: number | null;
  /** Same calendar period in the prior year (e.g. May 2025 → May 2026).
   *  Seasonal comparison for resort properties; null if no prior-year data.
   *  Computed when RECENCY_CONFIG.samePeriodLastYearEnabled is true. */
  samePeriodLastYearScore?: number | null;
}

/** Aggregate metrics about how well the hotel responds to its reviews.
 *  Computed by the backend per period. */
export interface ResponseStats {
  respondedCount: number;
  totalCount: number;
  rate: number;                  // 0..1
  medianResponseTimeHours: number | null;
  rateTrend: number;             // delta vs previous period in percentage points
}

export interface CompetitorScore {
  venueSlug: string;
  venueName: string;
  gpi: number;             // headlineScore — used for RPI computation
  avgStarRating: number;
  reviewCount: number;
  categoryScores: Pick<CategoryScore, 'category' | 'headlineScore' | 'aspectScore'>[];
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
  ownerResponse?: OwnerResponse;
  sourceUrl?: string;
}

/** Owner's published reply to a review. Pre-computed fields (responseTimeHours)
 *  are set by the Silver layer normalization job. */
export interface OwnerResponse {
  text: string;
  respondedAt: string;          // ISO date
  responseTimeHours: number;
  language: string;             // ISO 639-1
}

export interface SentimentItem {
  // ── LLM-produced ──────────────────────────────────────────────────────────
  category: CategoryKey;
  subcategory: string;          // English key from SubcategoryMeta (or runtime LLM value)
  sentiment: Sentiment;
  polarity: number;             // -1..+1 continuous
  intensity: number;            // 0..1 (strength of feeling)
  confidence: number;           // 0..1 (LLM certainty)
  excerpt: string;              // ≤80 chars, original language
  target_text?: string;         // free text — e.g. "klima", "duş"
  concept_key?: string | null;  // whitelist-only, null if not in whitelist
  severity_hint?: 'low' | 'medium' | 'high' | 'critical';
  critical_flags?: string[];    // e.g. ['food_poisoning', 'theft']
  // ── Backend-enriched (after severity derivation) ──────────────────────────
  severity_final?: 'low' | 'medium' | 'high' | 'critical';
  severity_weight?: number;
  subcategory_weight?: number;
  source_weight?: number;
  recency_weight?: number;
  mention_score?: number;       // signed contribution [-1..+1]
  case_recommended?: boolean;
  case_department?: string;
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
  severity: 'low' | 'medium' | 'high' | 'critical';
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
  module: 'hoops' | 'echo' | string;
  tier: string;
  status: 'active' | 'trial' | 'paused' | 'cancelled';
  features: string[];
  limits: Record<string, number>;
  activatedAt: string;
  validUntil?: string;
}

/** ECHO-module-specific subscription with strongly-typed usage/limits.
 *  See LAD-8 for the dimension list. */
export interface EchoSubscription extends TenantSubscription {
  module: 'echo';
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

// ─── Hoops Notification Settings (per-venue, stored in echo-backend) ─────────

/** Valid department keys for Hoops task routing. */
export type HoopsDepartment = 'hk' | 'fnb' | 'mnt' | 'spa' | 'gr';

/** Escalation strategy when a review goes unanswered past the SLA. */
export type HoopsEscalation = 'normal_to_urgent' | 'normal_to_high' | 'fixed_normal';

/**
 * Per-venue Hoops notification config — saved via PATCH /v1/venues/:slug/settings.
 * Controls which ECHO events trigger ops-engine workflows and for which departments.
 */
export interface HoopsNotifSettings {
  triggers: {
    /** 🔴 Kritik yorum (düşük puan): acil task oluştur. */
    critical: {
      enabled: boolean;
      ratingThreshold: number;   // reviews with rating ≤ this value
      departments: HoopsDepartment[];
      slaMinutes: number;
    };
    /** 🟡 Olumsuz yorum: yüksek öncelikli task oluştur. */
    negative: {
      enabled: boolean;
      ratingThreshold: number;
      departments: HoopsDepartment[];
      slaMinutes: number;
    };
    /** ⏳ Yanıtsız yorum: belirli süreden sonra eskalasyon. */
    unanswered: {
      enabled: boolean;
      hoursThreshold: number;
      escalation: HoopsEscalation;
    };
    /** ↔️ Aspect yönlendirme: ABSA sonucuna göre ilgili departmana yönlendir. */
    aspectRouting: {
      enabled: boolean;
    };
    /** 📅 Günlük özet: seçili departmanlara günlük review özeti gönder. */
    dailyDigest: {
      enabled: boolean;
      sendHour: number;          // 0–23 (UTC)
      departments: HoopsDepartment[];
    };
  };
}

/** Top-level ECHO per-venue settings document (stored embedded in the venue doc). */
export interface EchoVenueSettings {
  hoopsNotifications?: HoopsNotifSettings;
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
