/**
 * Silver-layer adapter: raw Apify TripAdvisor review payload → ECHO `Review`.
 *
 * The backend stores raw provider payloads (Bronze layer — no normalization).
 * A real TripAdvisor review has ~29 fields; our `Review` type has 9. This
 * adapter is the mapping. In Phase 2-proper this logic moves server-side
 * (the Silver normalization job, spec §12.1), but until then the frontend
 * adapts on read.
 *
 * ABSA NOTE: Bronze reviews have NO sentiment analysis. To keep category
 * filters alive until the ABSA pipeline ships, we synthesize coarse
 * `SentimentItem`s from TripAdvisor's own `subratings[]` (Value, Rooms,
 * Service, Cleanliness, Location, Sleep Quality). This is a stopgap — a
 * subrating is category-level, real ABSA is aspect-level. Synthesized items
 * are marked with subcategory `'_subrating'` so the UI / future code can
 * tell them apart from genuine ABSA output.
 */

import type { Review, SentimentItem, Sentiment, CategoryKey } from '@talkwo/echo-core';

/** Raw TripAdvisor review as stored in the Bronze collection. Only the
 *  fields we read are typed; the rest of the ~29 are ignored. */
export interface RawTripadvisorReview {
  id: string;
  _platform: string;
  lang?: string;
  rating: number;
  title: string;
  text: string;
  publishedDate: string;
  url?: string;
  tripType?: string;
  subratings?: { name: string; value: number }[];
  ownerResponse?: {
    text: string;
    publishedDate?: string;
    lang?: string;
    responder?: string;
  } | null;
}

// ── TripAdvisor subrating axis → ECHO category mapping ──
// One axis can feed multiple categories (Cleanliness touches ROOM + FACILITY).
const SUBRATING_TO_CATEGORIES: Record<string, CategoryKey[]> = {
  Value: ['VALUE'],
  Rooms: ['ROOM'],
  Service: ['STAFF'],
  Cleanliness: ['ROOM', 'FACILITY'],
  Location: ['FACILITY'],
  'Sleep Quality': ['ROOM']
};

/**
 * Convert a TripAdvisor subrating value (1–5) into a ECHO `Sentiment`.
 *
 * This threshold shapes how "harsh" the synthesized category signal looks.
 * A hotel-review 3/5 is ambiguous — "fine but not happy". Where you draw
 * the line between negative / neutral / positive directly affects the
 * category sentiment distributions the user sees on drill-down pages.
 *
 * @param value  subrating, 1–5
 * @returns      'positive' | 'neutral' | 'negative'
 *
 * Trade-off to weigh:
 *   - Lenient ("3 = neutral"): 4–5 positive, 3 neutral, 1–2 negative.
 *     Kinder to the hotel; "average" stays average.
 *   - Strict ("3 = negative"): 4–5 positive, 1–3 negative.
 *     Treats "just okay" as a problem signal — surfaces more issues.
 *
 * TODO(you): implement the mapping you think fits hotel-review reality.
 * For now it uses the lenient cut so the rest of the pipeline compiles.
 */
export function subratingToSentiment(value: number): Sentiment {
  // Placeholder — lenient threshold. Replace with your decision.
  if (value >= 4) return 'positive';
  if (value === 3) return 'neutral';
  return 'negative';
}

/** Synthesize coarse SentimentItems from a review's subratings. */
function synthesizeSentiments(raw: RawTripadvisorReview): SentimentItem[] {
  if (!raw.subratings?.length) return [];
  const items: SentimentItem[] = [];
  for (const sub of raw.subratings) {
    const categories = SUBRATING_TO_CATEGORIES[sub.name];
    if (!categories) continue;
    const sentiment = subratingToSentiment(sub.value);
    for (const category of categories) {
      const intensity = Math.abs(sub.value - 3) / 2; // 1 or 5 → 1.0, 3 → 0.0
      // Polarity: map 1–5 scale to -1..+1 via (value - 3) / 2
      const polarity = (sub.value - 3) / 2;
      items.push({
        category,
        subcategory: '_subrating', // marker: synthesized, not real ABSA
        sentiment,
        polarity,
        intensity,
        confidence: 0.70, // lower confidence for subrating-derived items
        excerpt: `TripAdvisor "${sub.name}" puanı: ${sub.value}/5`
      });
    }
  }
  return items;
}

/** Normalize TripAdvisor's UPPERCASE tripType to our lowercase travelType. */
function normalizeTravelType(tripType?: string): string {
  if (!tripType) return 'unknown';
  const map: Record<string, string> = {
    FAMILY: 'family',
    COUPLES: 'couples',
    SOLO: 'solo',
    BUSINESS: 'business',
    FRIENDS: 'friends'
  };
  return map[tripType.toUpperCase()] ?? tripType.toLowerCase();
}

/** Hours between a review's publish date and its owner-response date. */
function computeResponseTimeHours(reviewDate: string, responseDate?: string): number {
  if (!responseDate) return 0;
  const diff = new Date(responseDate).getTime() - new Date(reviewDate).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60)));
}

/** Adapt one raw Bronze TripAdvisor review into a ECHO `Review`. */
export function adaptTripadvisorReview(raw: RawTripadvisorReview): Review {
  return {
    id: raw.id,
    platform: 'tripadvisor',
    publishedDate: new Date(raw.publishedDate).toISOString(),
    rating: raw.rating,
    title: raw.title,
    text: raw.text,
    lang: raw.lang ?? 'en',
    travelType: normalizeTravelType(raw.tripType),
    sentiments: synthesizeSentiments(raw),
    sourceUrl: raw.url,
    ownerResponse: raw.ownerResponse
      ? {
          text: raw.ownerResponse.text,
          respondedAt: raw.ownerResponse.publishedDate
            ? new Date(raw.ownerResponse.publishedDate).toISOString()
            : new Date(raw.publishedDate).toISOString(),
          responseTimeHours: computeResponseTimeHours(
            raw.publishedDate,
            raw.ownerResponse.publishedDate
          ),
          language: raw.ownerResponse.lang ?? raw.lang ?? 'en'
        }
      : undefined
  };
}
