#!/usr/bin/env node
/**
 * Measure the Pending classifier against `messages.json`.
 *
 *   node eval/pending-classifier/run.mjs --limit 10     # try ten first
 *   node eval/pending-classifier/run.mjs                # the whole set
 *
 * Needs the family dev server running (`pnpm --filter @alio/family dev`) with
 * GOOGLE_API_KEY in apps/family/.env.local. It posts to that server's
 * dev-only preview route, so it measures the prompt the app actually ships
 * rather than a copy that can drift from it.
 *
 * One API call per message, made one at a time. Nothing retries, nothing
 * loops: the call count is exactly the number of messages it runs, printed at
 * the end, so the cost can never surprise anyone.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FAMILY_URL ?? 'http://localhost:3002';

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg === -1 ? Infinity : Number(args[limitArg + 1]);

const all = JSON.parse(readFileSync(join(HERE, 'messages.json'), 'utf8'));

/**
 * A partial run has to span the set, not take the front of it. The file is
 * grouped by category, so `--limit 10` originally meant "the ten easiest
 * messages" — ten obvious requests, no hard cases, and a false-alarm rate
 * computed from zero non-requests. It scored 100% and meant nothing.
 *
 * Evenly spaced instead, so a small run is a small version of the real one.
 */
const set = Number.isFinite(limit)
  ? Array.from({ length: Math.min(limit, all.length) }, (_, i) =>
      all[Math.round((i * (all.length - 1)) / Math.max(Math.min(limit, all.length) - 1, 1))],
    )
  : all;

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log(`\nClassifying ${set.length} message${set.length === 1 ? '' : 's'} via ${BASE}`);
console.log(dim(`That is ${set.length} API call${set.length === 1 ? '' : 's'}.\n`));

const results = [];
let calls = 0;

for (const [i, item] of set.entries()) {
  process.stdout.write(dim(`  ${String(i + 1).padStart(3)}/${set.length} `));
  let got = null;
  let failure = null;
  try {
    const res = await fetch(`${BASE}/api/classify/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text }),
    });
    calls += 1;
    const body = await res.json();
    if (!res.ok) {
      failure = body.error ?? `HTTP ${res.status}`;
    } else {
      got = body;
    }
  } catch (e) {
    failure = `could not reach ${BASE} — is the family dev server running? (${e.message})`;
  }

  if (failure) {
    console.log(red(`FAILED  ${failure}`));
    // A dead server or a bad key means every remaining call fails the same
    // way. Stop rather than burn the rest of the set finding that out.
    if (!got) {
      console.log(red('\nStopping. Nothing further was called.\n'));
      break;
    }
  } else {
    const ok = got.tier === item.label;
    console.log(
      `${ok ? green('ok  ') : red('MISS')} ${dim(`${item.label} → ${got.tier}`)}  ${item.text.slice(0, 52)}`,
    );
  }
  results.push({ ...item, got, failure });
}

const scored = results.filter((r) => r.got);
if (scored.length === 0) {
  console.log('\nNothing to score.\n');
  process.exit(1);
}

const actions = scored.filter((r) => r.label === 'action');
const caught = actions.filter((r) => r.got.tier === 'action');
const meds = actions.filter((r) => r.medication);
const medsCaught = meds.filter((r) => r.got.tier === 'action');
const falseAlarms = scored.filter((r) => r.label !== 'action' && r.got.tier === 'action');
const notActions = scored.filter((r) => r.label !== 'action');

const pct = (n, d) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);

console.log(`\n${bold('Results')}  (${scored.length} scored, ${calls} API calls)\n`);
console.log(
  `  ${bold('Requests caught')}      ${bold(pct(caught.length, actions.length))}  ` +
    dim(`${caught.length}/${actions.length}  ← the number that matters`),
);
console.log(
  `  Medication requests   ${pct(medsCaught.length, meds.length)}  ` +
    dim(`${medsCaught.length}/${meds.length}  (spec §4.4 wants this separately)`),
);
console.log(
  `  False alarms          ${pct(falseAlarms.length, notActions.length)}  ` +
    dim(`${falseAlarms.length}/${notActions.length} non-requests flagged as requests`),
);

const missed = actions.filter((r) => r.got.tier !== 'action');
if (missed.length > 0) {
  console.log(`\n${bold(red('Missed requests'))} ${dim('— read these, they are the failure that matters')}\n`);
  for (const r of missed) {
    console.log(`  ${red('·')} ${r.text}`);
    console.log(dim(`      said ${r.got.tier} (${r.got.confidence.toFixed(2)})${r.note ? ` — note: ${r.note}` : ''}`));
  }
}

if (falseAlarms.length > 0) {
  console.log(`\n${bold('False alarms')} ${dim('— a grey card someone ignores; worth watching, not worth chasing')}\n`);
  for (const r of falseAlarms) {
    console.log(`  · ${r.text}`);
    console.log(dim(`      expected ${r.label}, said action (${r.got.confidence.toFixed(2)})`));
  }
}

console.log('');
