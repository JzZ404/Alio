/**
 * Stand-in for the classifier in spec §4, so the suggestion card can be seen and
 * tuned before a model exists. Deliberately crude: a request aimed at someone
 * else usually asks, and asks about an errand.
 *
 * Replace this with the model call; keep the signature. Its mistakes are not
 * evidence about the model's accuracy.
 */
const ASKS = /\b(can|could|would|will) you\b|\bplease\b|\?/i;
const ERRAND =
  /\b(prescription|pharmacy|pill|pills|medication|appointment|doctor|refill|pick up|drop off|bring|remind)\b/i;

export function suggestsPending(text: string): boolean {
  return ASKS.test(text) && ERRAND.test(text);
}
