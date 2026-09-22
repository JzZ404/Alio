import type { Tier } from './types';

/**
 * The classifier's prompt, parsing and threshold (spec §4).
 *
 * Everything here is pure: no network, no key, no environment. The HTTP call
 * lives in the route handler that imports this, because that is the only place
 * the API key exists. Keeping the judgement here means it can be tested and
 * tuned without spending anything, which matters — every real call costs money
 * on a key that belongs to a teammate.
 */

/**
 * How sure the model has to be before we record that it thinks something is a
 * request. Deliberately low (spec §4.3): a false positive is a gray card
 * someone ignores, a false negative is a request nobody ever sees. Those are
 * not the same size of mistake, so the bar leans towards speaking up.
 */
export const ACTION_THRESHOLD = 0.35;

export interface Classification {
  tier: Tier;
  confidence: number;
}

/**
 * One instruction block, not a system prompt plus a user turn. Gemma models on
 * the Generative Language API do not reliably honour a separate system
 * instruction, and this is short enough that inlining costs nothing.
 *
 * The examples are the load-bearing part. The failure that matters is a
 * request that does not look like one — "Her pills run out Thursday" is an ask
 * with no question mark and no verb aimed at anyone — so the hard cases are
 * shown rather than described.
 */
export function buildPrompt(text: string): string {
  return `You sort messages in a family care chat. A family member writes to Sarah, the caregiver looking after their mother.

Decide which one this message is:

"action"  — it asks Sarah to do something, or tells her about something she will have to handle. Requests count even when they are phrased as statements, and even when no question mark appears.
"fyi"     — information Sarah should know, but nothing for her to do.
"social"  — thanks, warmth, small talk, acknowledgement.

Examples:
"Can you pick up her prescription today?" -> action, 0.95
"Her pills run out Thursday." -> action, 0.8
"She is completely out of the blue ones." -> action, 0.75
"Could you bring the walker in from the porch before you leave?" -> action, 0.95
"The pharmacy on Grove closes at 6." -> fyi, 0.6
"She slept well and ate breakfast." -> fyi, 0.9
"How was she today?" -> fyi, 0.5
"I already picked up the prescription." -> fyi, 0.8
"Thanks Sarah, that is a relief." -> social, 0.95
"Morning!" -> social, 0.95

Reply with JSON only, no other text:
{"tier": "action" | "fyi" | "social", "confidence": 0.0-1.0}

Message: ${JSON.stringify(text)}`;
}

/**
 * Read the model's answer, tolerating the ways models wrap JSON — code fences,
 * a sentence before it, trailing prose. Mirrors `_parse_json_response` in
 * `backend/medical_ai.py`, which exists because this happens in practice.
 *
 * Returns null rather than throwing on anything unusable. A classifier that
 * cannot be understood must fail the same way a classifier that is down fails:
 * no suggestion, no card, message unaffected (spec §4.3).
 */
export function parseClassification(raw: string): Classification | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { tier, confidence } = parsed as { tier?: unknown; confidence?: unknown };
  if (tier !== 'action' && tier !== 'fyi' && tier !== 'social') return null;

  // A missing or unusable confidence is treated as no confidence rather than
  // full confidence: the model not answering the question is not agreement.
  const score = typeof confidence === 'number' && Number.isFinite(confidence) ? confidence : 0;

  return { tier, confidence: Math.min(Math.max(score, 0), 1) };
}

/**
 * What to write to `suggested_tier`, or null to write nothing at all.
 *
 * An `action` the model is unsure about records nothing rather than being
 * downgraded to `fyi`. Writing `fyi` would put words in its mouth, and because
 * the database only allows a suggestion to be set once (transition 3), that
 * wrong answer would be permanent. Recording nothing leaves the row open to be
 * classified again by a better prompt or a better model.
 */
export function suggestionToWrite(result: Classification | null): Tier | null {
  if (!result) return null;
  if (result.tier === 'action') return result.confidence >= ACTION_THRESHOLD ? 'action' : null;
  return result.tier;
}
