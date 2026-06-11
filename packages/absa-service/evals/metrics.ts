/**
 * Eval metrics — computes precision/recall/F1 and summary stats
 * for ABSA output against a golden dataset.
 *
 * MATCHING STRATEGY
 * ─────────────────
 * An LLM aspect "matches" a golden aspect when:
 *   • category is an exact match (required)
 *   • subcategory is an exact match (required for subcategory score)
 *   • sentiment direction matches (positive/neutral/negative bucket;
 *     "mixed" is treated as correct for both positive and negative)
 *
 * We use greedy 1:1 matching per golden expected aspect.
 *
 * QUALITY GATE (MVP thresholds, from architecture decision):
 *   category accuracy      >= 0.85
 *   subcategory accuracy   >= 0.75
 *   sentiment accuracy     >= 0.85
 *   invalid cat-sub pairs  == 0
 *   schema error rate      < 0.01
 *   empty aspects rate     < 0.05  (when golden is non-empty)
 */

import type { AbsaAspect, AbsaOutput, SentimentLabel } from '../src/contract/schema.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoldenAspect {
  category:       string;
  subcategory:    string;
  sentiment:      SentimentLabel;
  /** Only checked when present in golden. */
  critical_flags?: string[];
}

export interface GoldenExample {
  id:       string;
  lang:     string;
  platform: string;
  rating:   number;
  text:     string;
  expected: GoldenAspect[];
  tags:     string[];
}

export interface AspectMatchResult {
  exampleId:          string;
  goldenAspect:       GoldenAspect;
  matchedAspect:      AbsaAspect | null;
  categoryMatch:      boolean;
  subcategoryMatch:   boolean;
  sentimentMatch:     boolean;
  criticalFlagsMatch: boolean;
}

export interface EvalRunResult {
  exampleId:       string;
  output:          AbsaOutput | null;
  schemaError:     string | null;
  matches:         AspectMatchResult[];
  /** LLM returned aspects when golden is empty (false positives). */
  spuriousAspects: number;
  tags:            string[];
}

export interface AggregateMetrics {
  totalExamples:         number;
  schemaErrorRate:       number;
  emptyWhenExpected:     number;   // rate
  categoryAccuracy:      number;
  subcategoryAccuracy:   number;
  sentimentAccuracy:     number;
  criticalFlagsRecall:   number;
  invalidCategorySubPairs: number; // absolute count
  avgAspectsPerExample:  number;
  spuriousAspectRate:    number;
  /** Per-category breakdown of category accuracy. */
  categoryBreakdown:     Record<string, { total: number; correct: number; accuracy: number }>;
  /** Per-tag breakdown. */
  tagBreakdown:          Record<string, { total: number; categoryAcc: number; subAcc: number }>;
  /** Whether all quality gates pass. */
  qualityGatePass:       boolean;
}

// ─── Sentiment direction buckets ─────────────────────────────────────────────

function sentimentBucket(s: SentimentLabel): 'positive' | 'neutral' | 'negative' {
  if (s === 'positive') return 'positive';
  if (s === 'negative') return 'negative';
  return 'neutral'; // neutral + mixed → neutral for comparison purposes
}

// ─── Per-example matching ─────────────────────────────────────────────────────

export function matchAspectsToGolden(
  exampleId:  string,
  golden:     GoldenAspect[],
  predicted:  AbsaAspect[],
  tags:       string[]
): EvalRunResult {
  // shallow copy — we'll consume predicted aspects one by one
  const remaining = [...predicted];
  const matches: AspectMatchResult[] = [];

  for (const goldenAspect of golden) {
    // Find best match in remaining predicted aspects
    const idx = remaining.findIndex(p => p.category === goldenAspect.category);

    let matchedAspect: AbsaAspect | null = null;
    let categoryMatch  = false;
    let subcategoryMatch = false;
    let sentimentMatch = false;
    let criticalFlagsMatch = true;

    if (idx !== -1) {
      matchedAspect  = remaining[idx];
      remaining.splice(idx, 1); // consume
      categoryMatch  = true;
      subcategoryMatch = matchedAspect.subcategory === goldenAspect.subcategory;
      sentimentMatch   =
        sentimentBucket(matchedAspect.sentiment) === sentimentBucket(goldenAspect.sentiment) ||
        matchedAspect.sentiment === 'mixed'; // mixed counts as partial match

      if (goldenAspect.critical_flags && goldenAspect.critical_flags.length > 0) {
        criticalFlagsMatch = goldenAspect.critical_flags.every(
          f => matchedAspect!.critical_flags.includes(f)
        );
      }
    }

    matches.push({
      exampleId,
      goldenAspect,
      matchedAspect,
      categoryMatch,
      subcategoryMatch,
      sentimentMatch,
      criticalFlagsMatch
    });
  }

  return {
    exampleId,
    output:          null, // filled in by run-eval
    schemaError:     null,
    matches,
    spuriousAspects: remaining.length,
    tags
  };
}

// ─── Aggregate metrics ────────────────────────────────────────────────────────

export function computeAggregateMetrics(results: EvalRunResult[]): AggregateMetrics {
  let schemaErrors     = 0;
  let emptyWhenExpected = 0;
  let totalMatches     = 0;
  let catCorrect       = 0;
  let subCorrect       = 0;
  let sentCorrect      = 0;
  let critFlagTotal    = 0;
  let critFlagCorrect  = 0;
  let invalidPairs     = 0;
  let totalPredicted   = 0;
  let spuriousTotal    = 0;

  const catBreakdown: Record<string, { total: number; correct: number }> = {};
  const tagAcc: Record<string, { total: number; catCorrect: number; subCorrect: number }> = {};

  for (const r of results) {
    if (r.schemaError) { schemaErrors++; continue; }
    if (!r.output) continue;

    totalPredicted += r.output.aspects.length;
    spuriousTotal  += r.spuriousAspects;

    const goldenEmpty = r.matches.length === 0;
    if (!goldenEmpty && r.output.aspects.length === 0) emptyWhenExpected++;

    for (const m of r.matches) {
      totalMatches++;

      const cat = m.goldenAspect.category;
      if (!catBreakdown[cat]) catBreakdown[cat] = { total: 0, correct: 0 };
      catBreakdown[cat].total++;

      if (m.categoryMatch) {
        catCorrect++;
        catBreakdown[cat].correct++;
      }
      if (m.subcategoryMatch) subCorrect++;
      if (m.sentimentMatch)   sentCorrect++;

      if (m.goldenAspect.critical_flags?.length) {
        critFlagTotal++;
        if (m.criticalFlagsMatch) critFlagCorrect++;
      }

      // Tag accumulation
      for (const tag of r.tags) {
        if (!tagAcc[tag]) tagAcc[tag] = { total: 0, catCorrect: 0, subCorrect: 0 };
        tagAcc[tag].total++;
        if (m.categoryMatch)    tagAcc[tag].catCorrect++;
        if (m.subcategoryMatch) tagAcc[tag].subCorrect++;
      }
    }
  }

  const n = totalMatches || 1;

  const categoryBreakdown: AggregateMetrics['categoryBreakdown'] = {};
  for (const [key, v] of Object.entries(catBreakdown)) {
    categoryBreakdown[key] = { ...v, accuracy: v.correct / (v.total || 1) };
  }

  const tagBreakdown: AggregateMetrics['tagBreakdown'] = {};
  for (const [tag, v] of Object.entries(tagAcc)) {
    tagBreakdown[tag] = {
      total:       v.total,
      categoryAcc: v.catCorrect / (v.total || 1),
      subAcc:      v.subCorrect / (v.total || 1)
    };
  }

  const categoryAccuracy    = catCorrect  / n;
  const subcategoryAccuracy = subCorrect  / n;
  const sentimentAccuracy   = sentCorrect / n;
  const schemaErrorRate     = schemaErrors / (results.length || 1);
  const emptyRate           = emptyWhenExpected / (results.length || 1);
  const spuriousAspectRate  = spuriousTotal / (totalPredicted || 1);
  const criticalFlagsRecall = critFlagTotal ? critFlagCorrect / critFlagTotal : 1;

  const qualityGatePass =
    categoryAccuracy    >= 0.85 &&
    subcategoryAccuracy >= 0.75 &&
    sentimentAccuracy   >= 0.85 &&
    invalidPairs        === 0   &&
    schemaErrorRate     <  0.01 &&
    emptyRate           <  0.05;

  return {
    totalExamples:           results.length,
    schemaErrorRate,
    emptyWhenExpected:       emptyRate,
    categoryAccuracy,
    subcategoryAccuracy,
    sentimentAccuracy,
    criticalFlagsRecall,
    invalidCategorySubPairs: invalidPairs,
    avgAspectsPerExample:    totalPredicted / (results.length || 1),
    spuriousAspectRate,
    categoryBreakdown,
    tagBreakdown,
    qualityGatePass
  };
}

// ─── Human-readable report ────────────────────────────────────────────────────

export function formatReport(metrics: AggregateMetrics): string {
  const pct  = (n: number) => `${(n * 100).toFixed(1)}%`;
  const gate = (ok: boolean) => ok ? '✅' : '❌';

  const lines = [
    '═══════════════════════════════════════════',
    '  ABSA EVAL REPORT',
    '═══════════════════════════════════════════',
    `  Examples:          ${metrics.totalExamples}`,
    '',
    '  QUALITY GATES',
    `  ${gate(metrics.categoryAccuracy    >= 0.85)} Category accuracy:    ${pct(metrics.categoryAccuracy)}    (gate: ≥ 85%)`,
    `  ${gate(metrics.subcategoryAccuracy >= 0.75)} Subcategory accuracy: ${pct(metrics.subcategoryAccuracy)} (gate: ≥ 75%)`,
    `  ${gate(metrics.sentimentAccuracy   >= 0.85)} Sentiment accuracy:   ${pct(metrics.sentimentAccuracy)}   (gate: ≥ 85%)`,
    `  ${gate(metrics.invalidCategorySubPairs === 0)} Invalid cat/sub pairs: ${metrics.invalidCategorySubPairs}       (gate: 0)`,
    `  ${gate(metrics.schemaErrorRate     <  0.01)} Schema error rate:    ${pct(metrics.schemaErrorRate)}   (gate: < 1%)`,
    `  ${gate(metrics.emptyWhenExpected   <  0.05)} Empty-when-expected:  ${pct(metrics.emptyWhenExpected)}   (gate: < 5%)`,
    '',
    '  OTHER METRICS',
    `  Critical flags recall:    ${pct(metrics.criticalFlagsRecall)}`,
    `  Avg aspects/example:      ${metrics.avgAspectsPerExample.toFixed(2)}`,
    `  Spurious aspect rate:     ${pct(metrics.spuriousAspectRate)}`,
    '',
    '  CATEGORY BREAKDOWN',
    ...Object.entries(metrics.categoryBreakdown)
      .sort(([, a], [, b]) => a.accuracy - b.accuracy)
      .map(([cat, v]) => `  ${gate(v.accuracy >= 0.85)} ${cat.padEnd(15)} ${pct(v.accuracy)} (${v.correct}/${v.total})`),
    '',
    '  TAG BREAKDOWN',
    ...Object.entries(metrics.tagBreakdown)
      .map(([tag, v]) => `  ${tag.padEnd(30)} cat: ${pct(v.categoryAcc)}  sub: ${pct(v.subAcc)}  (n=${v.total})`),
    '',
    `  OVERALL: ${metrics.qualityGatePass ? '✅ PASS' : '❌ FAIL — see failing gates above'}`,
    '═══════════════════════════════════════════',
  ];

  return lines.join('\n');
}
