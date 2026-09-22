import { buildPrompt, parseClassification, type Classification } from '@alio/ui';

/**
 * Classify arbitrary text and return the answer without writing anything.
 * Exists so the evaluation harness can measure the *real* prompt rather than a
 * copy of it — `eval/pending-classifier/run.mjs` posts here for every message
 * in the set.
 *
 * **Development only.** In production this 404s, and it has to: unlike
 * `/api/classify`, it accepts text straight from the caller, so a deployed
 * version would be a free model proxy on our key for anyone who found the URL.
 * That is exactly the thing the main route was written to avoid, and the only
 * reason it is tolerable here is that it never leaves a laptop.
 */

const MODEL = 'models/gemma-4-26b-a4b-it';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 20_000;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'GOOGLE_API_KEY is not set in apps/family/.env.local' },
      { status: 503 },
    );
  }

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return Response.json({ error: 'expected JSON body' }, { status: 400 });
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    return Response.json({ error: 'text required' }, { status: 400 });
  }

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
          temperature: 0.2,
          maxOutputTokens: 64,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      // Surfaced rather than swallowed: during evaluation an error is
      // information, not something to hide behind a missing card.
      return Response.json({ error: `model ${response.status}`, detail }, { status: 502 });
    }

    const body = await response.json();
    const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== 'string') {
      return Response.json({ error: 'unexpected response shape', body }, { status: 502 });
    }

    const result: Classification | null = parseClassification(raw);
    if (!result) {
      return Response.json({ error: 'unparseable', raw }, { status: 502 });
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
