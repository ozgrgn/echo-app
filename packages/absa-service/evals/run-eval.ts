/**
 * run-eval.ts — ABSA golden eval runner
 *
 * Usage:
 *   pnpm eval              # calls OpenAI API for each golden example
 *   pnpm eval:dry          # dry-run: validates schema + prints prompt only,
 *                          # does NOT call OpenAI (no API key needed)
 *
 * Environment:
 *   OPENAI_API_KEY         required unless --dry-run
 *   ABSA_EVAL_MODEL        overrides ABSA_MODEL for this eval run
 *   ABSA_EVAL_CONCURRENCY  max parallel OpenAI calls (default: 5)
 *
 * Output:
 *   Prints a metrics report to stdout.
 *   Writes detailed per-example results to evals/results/<timestamp>.jsonl
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { validateAbsaOutput } from '../src/contract/schema.js';
import type { AbsaOutput } from '../src/contract/schema.js';
import { ABSA_MODEL, ABSA_ENDPOINT, MIN_ASPECT_CONFIDENCE } from '../src/contract/versions.js';
import { ABSA_OUTPUT_JSON_SCHEMA } from '../src/contract/schema.js';
import {
  matchAspectsToGolden,
  computeAggregateMetrics,
  formatReport
} from './metrics.js';
import type { GoldenExample, EvalRunResult } from './metrics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Args & config ────────────────────────────────────────────────────────────

const DRY_RUN     = process.argv.includes('--dry-run');
const MODEL       = process.env['ABSA_EVAL_MODEL'] ?? ABSA_MODEL;
const CONCURRENCY = parseInt(process.env['ABSA_EVAL_CONCURRENCY'] ?? '5', 10);

// ─── Load golden examples ─────────────────────────────────────────────────────

function loadGoldenFile(filename: string): GoldenExample[] {
  const path = join(__dirname, 'golden', filename);
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map((line, i) => {
        try {
          return JSON.parse(line) as GoldenExample;
        } catch (e) {
          throw new Error(`Parse error in ${filename} line ${i + 1}: ${e}`);
        }
      });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

function loadAllGolden(): GoldenExample[] {
  return [
    ...loadGoldenFile('tr.jsonl'),
    ...loadGoldenFile('de.jsonl'),
    ...loadGoldenFile('en.jsonl'),
    ...loadGoldenFile('ru.jsonl'),
  ];
}

// ─── System prompt (inline for eval — real prompt lives in prompt/system.ts) ──

function buildSystemPrompt(): string {
  // Minimal version for eval runner. Full prompt is built in prompt/system.ts.
  return [
    'You are an Aspect-Based Sentiment Analysis (ABSA) engine for hotel reviews.',
    'Extract all hotel-experience aspects from the review text.',
    'Return JSON matching the provided schema exactly.',
    'Rules:',
    '- category must be one of the 14 allowed values.',
    '- subcategory should be a snake_case English key from the taxonomy.',
    '- polarity: -1 (very negative) to +1 (very positive).',
    '- intensity: 0 (mild) to 1 (strong feeling).',
    '- confidence: 0 to 1 (your certainty).',
    '- excerpt: verbatim ≤80 chars from the review, original language.',
    '- critical_flags: list if food_poisoning, theft, harassment, food_safety, or guest_safety is mentioned.',
    '- severity_hint: low/medium/high/critical based on impact.',
    '- target_text: specific entity mentioned (e.g. "klima"), null if unspecified.',
    '- concept_key: null for now.',
    '- If no hotel aspects detected, return empty aspects array with a no_aspect_reason.',
  ].join('\n');
}

function buildUserMessage(example: GoldenExample): string {
  return [
    `Platform: ${example.platform}`,
    `Language: ${example.lang}`,
    `Star rating: ${example.rating}/5`,
    '',
    'Review:',
    example.text,
  ].join('\n');
}

// ─── OpenAI call ─────────────────────────────────────────────────────────────

async function callOpenAI(example: GoldenExample): Promise<AbsaOutput | string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) return 'OPENAI_API_KEY not set';

  const body = {
    model:           MODEL,
    response_format: {
      type:        'json_schema',
      json_schema: ABSA_OUTPUT_JSON_SCHEMA
    },
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: buildUserMessage(example) }
    ],
    temperature: 0,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return `HTTP ${res.status}: ${err}`;
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  };

  try {
    return JSON.parse(data.choices[0].message.content) as AbsaOutput;
  } catch {
    return `JSON parse error: ${data.choices[0].message.content.slice(0, 200)}`;
  }
}

// ─── Process single example ───────────────────────────────────────────────────

async function processExample(example: GoldenExample): Promise<EvalRunResult> {
  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] ${example.id} (${example.lang} / ${example.platform})`);
    console.log('  System:', buildSystemPrompt().split('\n')[0], '...');
    console.log('  User:',   buildUserMessage(example).split('\n')[0], '...');
    console.log('  Expected:', JSON.stringify(example.expected));

    // In dry-run, simulate a perfect output to exercise the metric logic
    const mockOutput: AbsaOutput = {
      aspects: example.expected.map(e => ({
        category:       e.category as AbsaOutput['aspects'][0]['category'],
        subcategory:    e.subcategory,
        sentiment:      e.sentiment,
        polarity:       e.sentiment === 'positive' ? 0.7 : e.sentiment === 'negative' ? -0.7 : 0,
        intensity:      0.6,
        confidence:     0.9,
        excerpt:        example.text.slice(0, 60),
        target_text:    null,
        concept_key:    null,
        severity_hint:  'low',
        critical_flags: e.critical_flags ?? []
      })),
      overall_sentiment: example.expected.length === 0 ? 'neutral'
        : example.expected.some(e => e.sentiment === 'negative')
          && example.expected.some(e => e.sentiment === 'positive') ? 'mixed'
          : example.expected[0].sentiment,
      no_aspect_reason: example.expected.length === 0 ? 'no aspects in text' : null
    };

    const result = matchAspectsToGolden(example.id, example.expected, mockOutput.aspects, example.tags);
    result.output = mockOutput;
    return result;
  }

  const raw = await callOpenAI(example);

  if (typeof raw === 'string') {
    // API / parse error
    const result = matchAspectsToGolden(example.id, example.expected, [], example.tags);
    result.schemaError = raw;
    return result;
  }

  // Validate schema
  const validation = validateAbsaOutput(raw);
  if (!validation.valid) {
    const result = matchAspectsToGolden(example.id, example.expected, [], example.tags);
    result.schemaError = validation.errors.join('; ');
    if (validation.warnings.length > 0) {
      console.warn(`  [WARN] ${example.id}:`, validation.warnings.join('; '));
    }
    return result;
  }

  if (validation.warnings.length > 0) {
    console.warn(`  [WARN] ${example.id}:`, validation.warnings.join('; '));
  }

  // Filter low-confidence aspects
  const filteredAspects = raw.aspects.filter(a => a.confidence >= MIN_ASPECT_CONFIDENCE);

  const result = matchAspectsToGolden(example.id, example.expected, filteredAspects, example.tags);
  result.output = { ...raw, aspects: filteredAspects };
  return result;
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items:   T[],
  limit:   number,
  fn:      (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const examples = loadAllGolden();
  console.log(`\nLoaded ${examples.length} golden examples`);
  console.log(`Model: ${MODEL}  |  Dry-run: ${DRY_RUN}  |  Concurrency: ${CONCURRENCY}\n`);

  if (!DRY_RUN && !process.env['OPENAI_API_KEY']) {
    console.error('ERROR: OPENAI_API_KEY not set. Use --dry-run or set the env var.');
    process.exit(1);
  }

  const allResults = await runWithConcurrency(examples, CONCURRENCY, async (ex, i) => {
    if (!DRY_RUN) {
      process.stdout.write(`  [${i + 1}/${examples.length}] ${ex.id} ... `);
    }
    const r = await processExample(ex);
    if (!DRY_RUN) {
      const status = r.schemaError ? '❌ schema error' : `${r.matches.filter(m => m.categoryMatch).length}/${r.matches.length} cat matches`;
      console.log(status);
    }
    return r;
  });

  // Write results file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const resultsPath = join(resultsDir, `${timestamp}.jsonl`);
  writeFileSync(resultsPath, allResults.map(r => JSON.stringify(r)).join('\n'), 'utf-8');
  console.log(`\nDetailed results written to: evals/results/${timestamp}.jsonl`);

  // Print report
  const metrics = computeAggregateMetrics(allResults);
  console.log('\n' + formatReport(metrics));

  process.exit(metrics.qualityGatePass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal eval error:', err);
  process.exit(1);
});
