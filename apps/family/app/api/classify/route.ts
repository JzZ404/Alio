import { createClient } from '@supabase/supabase-js';
import {
  buildPrompt,
  parseClassification,
  suggestionToWrite,
  type Classification,
} from '@alio/ui';

/**
 * Ask the model whether a message is a request, and record what it thought
 * (spec §4).
 *
 * This runs on the server — on Vercel in production, in `next dev` locally —
 * because it holds the Google API key. The key must never reach the browser,
 * which is the whole reason this is a route handler rather than a function the
 * chat screen calls directly.
 *
 * It takes a message **id**, never message text. The text is read from the
 * database here. Otherwise this is an open endpoint that will send anything
 * you post to it to Google on our key: a free model proxy for whoever finds
 * the URL. Reading from the database means it can only ever classify messages
 * that genuinely exist in a thread.
 *
 * Nothing here can mark a message Pending. It writes `suggested_tier` and
 * `suggested_by` only; the database trigger refuses anything else from this
 * role, and spec §9 keeps suggestions out of the Pending list entirely.
 * Failure is silent by design (spec §4.3) — the message has already sent, and
 * an absent gray card is the correct way for this to break.
 */

/**
 * Small and fast: ~4B parameters active per call. Classifying one short
 * message does not need the 31B model the report pipeline uses, and this is
 * called once per sent message rather than once per report.
 */
const MODEL = 'models/gemma-4-26b-a4b-it';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
/** Past this, the suggestion is not worth waiting for. The message is long gone. */
const TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    // Deliberately not a 500: this is the expected state on a deployment
    // where nobody has set the key yet, and it is not the sender's problem.
    console.warn('classify: not configured (GOOGLE_API_KEY missing?), skipping');
    return Response.json({ classified: false, reason: 'not-configured' });
  }

  let messageId: unknown;
  try {
    ({ messageId } = await request.json());
  } catch {
    return Response.json({ error: 'expected JSON body' }, { status: 400 });
  }
  if (typeof messageId !== 'string' || messageId.length === 0) {
    return Response.json({ error: 'messageId required' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // `suggested_tier is null` is both the guard and the idempotency check: the
  // database allows a suggestion to be recorded once, so re-posting the same
  // id is free rather than a second call to Google.
  const { data: row, error: readError } = await supabase
    .from('family_messages')
    .select('id, text, suggested_tier')
    .eq('id', messageId)
    .maybeSingle();

  if (readError) {
    console.error('classify: could not read message', readError.message);
    return Response.json({ classified: false, reason: 'read-failed' });
  }
  if (!row) {
    return Response.json({ error: 'no such message' }, { status: 404 });
  }
  if (row.suggested_tier !== null) {
    return Response.json({ classified: false, reason: 'already-classified' });
  }

  const result = await classify(row.text as string, apiKey);
  const tier = suggestionToWrite(result);
  if (tier === null) {
    return Response.json({ classified: false, reason: 'no-confident-answer' });
  }

  const { error: writeError } = await supabase
    .from('family_messages')
    .update({ suggested_tier: tier, suggested_by: 'model' })
    .eq('id', messageId)
    .is('suggested_tier', null);

  if (writeError) {
    console.error('classify: could not record suggestion', writeError.message);
    return Response.json({ classified: false, reason: 'write-failed' });
  }

  return Response.json({ classified: true, tier });
}

/**
 * The model call itself. Returns null on anything that goes wrong — a timeout,
 * a non-200, output that is not the JSON we asked for — because every one of
 * those means the same thing to the person who sent the message: no card.
 */
async function classify(text: string, apiKey: string): Promise<Classification | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(text) }] }],
        generationConfig: {
          // Low, not zero: this is a judgement, and a little spread is
          // healthier than a model locked onto its first instinct.
          temperature: 0.2,
          // Enough for the JSON object and nothing more.
          maxOutputTokens: 64,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.error('classify: model returned', response.status, await response.text());
      return null;
    }

    const body = await response.json();
    const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== 'string') {
      console.error('classify: unexpected response shape');
      return null;
    }
    return parseClassification(raw);
  } catch (e) {
    console.error('classify: model call failed', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
