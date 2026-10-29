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
 * Written as a completion, not as a request. The first real call to
 * gemma-4-26b-a4b-it ignored both `responseMimeType: application/json` and the
 * instruction "reply with JSON only", and began restating the task back in
 * markdown instead. Gemma on the Generative Language API honours neither JSON
 * mode nor a separate system instruction.
 *
 * So the prompt ends mid-pattern: ten `Message:` / `Answer:` pairs and then the
 * real message with an empty `Answer:`. The only natural continuation is the
 * JSON object, because that is what follows every other `Answer:` above it.
 *
 * The examples are the load-bearing part. The failure that matters is a
 * request that does not look like one — a supply running out is an ask with no
 * question mark and no verb aimed at anyone — so the hard cases are shown
 * rather than described.
 *
 * **No example here appears in `eval/pending-classifier/messages.json`.** An
 * earlier version reused eight sentences from that set, which would have
 * scored the model on messages it had been handed the answers to. Every
 * example teaches a distinction the set tests; none of them is a message the
 * set contains.
 *
 * Three of them encode judgements the product owner made on 2026-09-22: an
 * observation about how she is doing is `fyi` (a symptom Sarah cannot fix
 * today), an observation with something to put right is `action` (a gap she
 * can close now), and affection passed on is `social` even when it is worded
 * as a request.
 */
export function buildPrompt(text: string): string {
  return `Sort each message in a family care chat. A family member writes to Sarah, the caregiver looking after their mother.

"action"  — Sarah has something to do because of it. Requests count when phrased as statements and when no question mark appears. An observation counts when there is something she can put right: a gap, a supply running out, a thing in the wrong place.
"fyi"     — information Sarah should know, but nothing for her to do. How the mother is doing, a symptom, a schedule, or something already handled.
"social"  — thanks, warmth, small talk. A message passing on affection is social even when it is phrased as a request.

Message: "Could you grab more milk while you're out?"
Answer: {"tier":"action","confidence":0.95}

Message: "Her inhaler is nearly empty."
Answer: {"tier":"action","confidence":0.8}

Message: "The recycling needs to go out before Thursday."
Answer: {"tier":"action","confidence":0.85}

Message: "She hasn't eaten since I left."
Answer: {"tier":"action","confidence":0.7}

Message: "Her back has been aching in the mornings."
Answer: {"tier":"fyi","confidence":0.7}

Message: "I picked up her glasses yesterday."
Answer: {"tier":"fyi","confidence":0.85}

Message: "Did she manage the stairs okay?"
Answer: {"tier":"fyi","confidence":0.6}

Message: "The nurse comes on Tuesdays."
Answer: {"tier":"fyi","confidence":0.85}

Message: "Tell her the boys say hello."
Answer: {"tier":"social","confidence":0.8}

Message: "You've been brilliant this week."
Answer: {"tier":"social","confidence":0.95}

Message: ${JSON.stringify(text)}
Answer:`;
}

/**
 * Cuts the model off if it tries to carry on inventing its own Message/Answer
 * pairs after the one we asked for. Belt and braces with `maxOutputTokens`.
 */
export const STOP_SEQUENCES = ['\nMessage:'];

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

/**
 * Pull the answer out of a Generative Language API response.
 *
 * Both Gemma models on this key are thinking models, and thinking cannot be
 * switched off — `thinkingConfig` is rejected outright. So the response can
 * carry several parts, the early ones marked `thought: true` holding the
 * model's scratchpad. Reading `parts[0]` gets the scratchpad, which is exactly
 * what the first real call did: a page of markdown notes and no answer.
 *
 * Returns null when there is no answer part, which happens when the token
 * budget ran out mid-thought (`finishReason: MAX_TOKENS`). That is a real
 * failure and must read as one, not as an unparseable answer.
 */
export function extractAnswerText(body: unknown): string | null {
  const parts = (body as { candidates?: { content?: { parts?: unknown[] } }[] })?.candidates?.[0]
    ?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const { text, thought } = (part ?? {}) as { text?: unknown; thought?: unknown };
    if (thought === true) continue;
    if (typeof text === 'string' && text.trim().length > 0) return text;
  }
  return null;
}
