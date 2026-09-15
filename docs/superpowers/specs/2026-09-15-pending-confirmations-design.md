# Alio — Pending Confirmations

Implementation spec for the caregiver-facing surface where flagged chat messages
are collected and confirmed, plus the backend that suggests flags.

**All UI copy is English.** Any Chinese in earlier design conversations was
working shorthand between teammates, not product copy.

---

## 0. Vocabulary

Use these terms and no others, in code, copy, and design files.

| Concept | UI string | Code identifier |
|---|---|---|
| A message the sender marked as needing a response | Needs response | `tier = 'action'` |
| The unconfirmed state | Pending | `acknowledged_at IS NULL` |
| The confirm action / button | Confirm | `acknowledge` |
| The confirmed state | Confirmed | `acknowledged_at` |
| The filtered view of pending items | Pending | `PendingList` |

**Banned terms.** Each is banned for a reason, not for taste.

- **ticket** — call-center vocabulary. This is a two-person relationship, not a
  support desk.
- **approve / approval** — implies the caregiver may refuse. That turns a closed
  loop into a question of authority. They confirm; if they can't do it, they
  reply in the thread like a person.
- **notification hub** — these aren't notifications. They're messages.
- **inbox** — implies a mailbox separate from the conversation. It isn't one.
- **task** — already used by the routine/anchor system. Collision.

---

## 1. Core principle

The Pending list is a **view**, not a store.

It requires no new table and no new state. It is a query:

```sql
SELECT * FROM messages
WHERE recipient_id = :current_user
  AND final_tier = 'action'
  AND acknowledged_at IS NULL
ORDER BY created_at ASC
```

Everything follows from this. One source of truth, so confirming in any surface
updates all of them. Nothing can drift.

**Only human-confirmed tags enter this list.** A message where `suggested_tier`
is set but `final_tier` is null does not appear. The entire value of this
surface is that everything in it is real.

---

## 2. Surfaces

Three entry points, one destination.

### 2.1 Home dashboard — bell icon, top right

- Badge shows pending count. Display caps at `9+`.
- No badge when count is zero. Icon stays, stays quiet.
- Tap opens the Pending list.

This does **not** go in the dashboard's flag stream. The dashboard already
carries visit-report exceptions and symptom-pattern flags; adding a third stream
to that column makes all three unreadable. The bell sits deliberately outside
it.

### 2.2 Chat — pinned bar at top of thread

- Renders only when pending count is above zero. Never a permanent fixture.
- Content: count plus a preview of the **longest-waiting** item.
  - `1 pending · Pick up prescription, order 4471`
- Tap opens the Pending list.

### 2.3 In the bubble itself

- The confirm button lives in the message bubble, in the thread, always.
- State is visible to both parties. The family member sees `Confirmed` appear on
  their own message.

The bubble is the primary surface. The list exists for messages that have
already scrolled away.

---

## 3. Pending list screen

Vertical stack of cards, one per item. Reference layout: a standard vertical
notification detail list, one full card per item, newest at the bottom.

### Card contents

- Sender name and timestamp
- Time waiting, shown once past two hours: `Waiting 5 hours`
- **Full message text, not truncated.** The caregiver must be able to act
  without leaving the screen. Truncation forces a round trip and defeats the
  surface.
- Primary button: `Confirm`
- Tapping the card body, not the button, jumps to that message in the thread,
  scrolled into position and briefly highlighted.

### Ordering

Oldest first. Longest-waiting at the top.

This is counterintuitive for a chat product and it is the point. The surface
exists so things don't sink. Newest-first would recreate the problem it was
built to solve.

### After confirming

- Item animates out of the pending section.
- Moves to a collapsed `Confirmed` section below, retaining the last 7 days.
- Not deleted. The caregiver needs evidence they responded; the family needs to
  see that it happened.

### Empty state

- Show the `Confirmed` section from the last 7 days.
- Copy: `Nothing pending`. No illustration, no celebration.
- A dead-end blank screen makes the bell feel broken.

---

## 4. Backend — flag suggestion

### 4.1 Flow

The send path never touches the model.

```
POST /messages
  → write to DB, return 200, message renders immediately
  → enqueue classification job
      → POST localhost:11434  (local model)
      → { tier, confidence }
  → write suggested_tier
  → push to client, hint renders under the bubble
```

If the model is slow, down, or wrong, messages still send and nothing breaks.
The only visible effect is that no hint appears.

### 4.2 Model

- Local instruction-tuned model in the 4B range, served by Ollama over local
  HTTP. Verify the current model line before pinning a version.
- **Prompt-based, not fine-tuned.** Zero or few-shot. There isn't enough data to
  fine-tune and there wouldn't be much gain at this volume.
- Keep the model warm. Cold-loading a 4B model costs 10 to 20 seconds and you
  don't want that on the first message of the morning.

### 4.3 Output contract

Constrained JSON decoding. Don't let the model free-write and then parse it.

```json
{ "tier": "action" | "fyi" | "social", "confidence": 0.0-1.0 }
```

- Threshold deliberately low, around `0.35`. A false positive is a gray hint
  someone ignores. A false negative is a request that never gets seen.
- Write to `suggested_tier`, never to `final_tier`.
- Timeout or malformed output: fail silently, log it. If the failure rate climbs,
  the UI must say plainly that automatic detection is unavailable rather than
  quietly detecting nothing.

### 4.4 What is deliberately not in v1

**No drug-name dictionary, no dosage regex.** Basic model recognition only.

Documented consequence: medication-related messages now depend entirely on a
probabilistic classifier. Label medication messages as their own subset in the
eval set and report recall on that subset separately. If it comes back weak,
that's exactly when a deterministic dictionary earns its two days of work.

### 4.5 Evaluation

- Build a hand-labeled set of 150 to 200 messages before trusting any number.
- **Primary metric is recall on the `action` class.** Not accuracy. The failure
  that matters is a missed request.
- Monitor precision, don't optimize it.
- Once live, every message a human tagged that the model didn't suggest is a
  free false-negative sample. Collect them.
- Adoption below roughly 15 percent means the suggestions are wrong or the UI is
  wrong, not that users are lazy.

### 4.6 Hosting

- Development: local machine. An M-series Mac runs a quantized 4B model in under
  a second per classification, which makes prompt iteration free.
- Pilot: an always-on host. A CPU VPS with 8 to 16GB RAM is sufficient because
  nothing is waiting on the result. No GPU. Same Ollama setup, same HTTP call,
  different host.

---

## 5. Timeout follow-up

Separate mechanism. No AI involved.

```
every 30 minutes:
  find messages where
    final_tier = 'action'
    AND acknowledged_at IS NULL
    AND no message from the recipient after this one
    AND age > threshold
  → notify the SENDER
```

Two things that are easy to get wrong:

- The notification goes to the **sender**, not the caregiver. If it went to the
  caregiver, the system would be setting priority on its own.
- "No response" means no subsequent message from the recipient, not an
  unpressed button. A reply of "sure, got it" already closed the loop.

---

## 6. Data

No new tables. Fields on `messages`:

```
final_tier          -- 'action' | 'fyi' | 'social' | null
tagged_by           -- 'sender_manual' | 'sender_confirmed_ai' | null
suggested_tier      -- model output, never drives the Pending list
suggested_by        -- 'model' | null
acknowledged_at     -- timestamp | null
acknowledged_by     -- user_id | null
followup_sent_at    -- timestamp | null
```

`suggested_tier` and `final_tier` must stay separate columns. The gap between
them is the adoption rate and the miss rate. Merge them and neither is ever
computable again.

---

## 7. Later, not v1 — multilingual

Good to have. Not urgent. Build after the English path is measured.

**Translation in the thread.** Message shown in the reader's language, original
available underneath. When translation exists, show original alongside
translation for every translated message rather than special-casing certain
content types.

**Classification across languages.** Run the classifier on the original text,
not on a translation, so errors don't compound.

**Measure recall per language, never blended.** A single blended number hides
that a small model is meaningfully worse in Chinese than in English. In elder
care that isn't a metrics preference, it's a fairness problem: a blended number
lets you ship something that quietly works better for English-speaking families.

If per-language recall comes back weak, moving to a larger model is the cheapest
available fix.

---

## 8. Build order

1. Bubble-level confirm button and state sync. Nothing else works without it.
2. Pending list screen as a query view.
3. Chat pinned bar.
4. Dashboard bell and badge.
5. Timeout follow-up job. Depends only on human tags, so it can ship before any
   model work.
6. Model classification and the gray suggestion hint.

Steps 3 and 4 are thin wrappers over step 2 and should take under a day combined
once it exists.

---

## 9. Decisions already made — do not relitigate

**Single confirm state, not two.** Confirming means "I've seen this and I'm on
it," not "done." A Confirm then Complete two-step doubles interaction cost and
creates a second pending state that can rot exactly like the first. If the pilot
shows families repeatedly asking whether something got done, revisit in v2.

**No model suggestions in the Pending list.** A suggestion the sender hasn't
confirmed stays a gray hint under the bubble and goes nowhere near that screen.

**No caregiver self-tagging in v1.** It needs separate visuals and a
private-versus-shared state split, and it solves a downstream symptom of the
problem the sender-side flow already addresses.

**No cap on pending count.** But if a dyad regularly exceeds five pending, log
it. Don't design around it yet.

---

## 10. Open

- Does the family member get a mirror view of what's outstanding? Bubble-level
  state may be enough for v1.
- Group threads: whether non-primary family members can tag at all. Current lean
  is read-only for them.
- Input-method conflict: whether tapping the tag toggle interrupts the candidate
  box mid-composition in non-Latin input. Needs a real device, not a simulator.

---

## Reference material

Shared alongside this spec on 2026-09-15:

- **Mockup** (working shorthand in Chinese — copy above is authoritative): a
  chat thread with an amber pinned bar at the top ("1 pending · Pick up
  prescription, order 4471"), a right-aligned amber bubble with a circled "!"
  header reading "Needs response", the message text, and a full-width white
  button inside the bubble; the composer has a round amber "!" toggle to the left
  of the text field and a send arrow on the right. Amber colors in
  `packages/theme` are matched to this mockup and marked provisional.
- **Layout reference**: Taobao's after-sales list — a vertical stack of full
  cards, each with a small header (source + date), a bold title line, labelled
  detail rows, and one action button — and its message center, where each source
  is a row with an icon, name, one-line preview and date.
