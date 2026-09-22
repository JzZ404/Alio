# Evaluating the Pending classifier

Does the AI catch the messages that are actually asking Sarah to do something?

That is the only question this answers, and it is the one that matters: a false
alarm is a grey card someone ignores, a miss is a prescription nobody collects.
Spec §4.5 makes recall on `action` the primary metric for exactly that reason.

## The set

`messages.json` — 63 messages, each with the answer a human thinks is right.

| group | count |
|---|---|
| `action` — asks Sarah to do something | 27 |
| `fyi` — she should know, nothing to do | 24 |
| `social` — thanks, warmth, small talk | 12 |
| of those, medication-related | 11 |

The set is deliberately unkind. Roughly a third of the `action` messages are
requests that do not look like requests — *"Her pills run out Thursday"* has no
question mark, no please, and no verb aimed at anyone. Those are the ones the
regex stub misses completely, and they are the reason a model is worth having
at all. A classifier that scores well on *"Can you pick up her prescription?"*
and badly on those has not solved the problem.

It also contains traps in the other direction: *"Can you believe she's still
doing the crossword?"* opens like a request and asks for nothing.

## The labels are opinions

Eight messages carry a `note` explaining why the answer is arguable — those are
the ones worth disagreeing with. *"The prescription should be ready at Grove by
two"* is either information or an instruction depending on how you read it.

**Correct anything you disagree with before running this.** Otherwise the score
measures how well the model matches one person's judgement, which is not the
same as whether the feature works.

## Cost

Each message is one small API call: the message plus a short instruction in,
about ten words out. Running the whole set is 63 calls.

`--limit` exists so the first run can be ten. Check the number, then decide
whether to spend the rest.
