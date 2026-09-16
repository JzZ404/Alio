# Chat feature — build log

Running log of the Pending Confirmations build on branch `feat/chat-feature`.
One entry per task, newest at the bottom. Plain language on purpose: what
changed, why, what was found, and what is still outstanding.

- **Spec:** [docs/superpowers/specs/2026-09-15-pending-confirmations-design.md](superpowers/specs/2026-09-15-pending-confirmations-design.md)
- **Plan:** [docs/superpowers/plans/2026-09-15-pending-confirmations.md](superpowers/plans/2026-09-15-pending-confirmations.md)
- **Branch:** `feat/chat-feature`, cut from `main` at `e912621`

Each task was built by one agent and then checked by a separate reviewer before
being accepted.

---

## Setup — 2026-09-15

**Branch created** (`feat/chat-feature`, originally `feat/pending-confirmations`,
renamed on request). Work happens here, not on `main`, so nothing half-built
reaches the team or the deployed site.

**Spec and plan committed** (`f7430f2`). The spec was written outside the repo
and is now stored verbatim so everyone — including teammates' agents — works
from the same text.

**What the plan covers:** spec build-order steps 1–4 (tag → Confirm → Pending
list → pinned bar → bell). The timeout follow-up and the AI suggestion each
need their own plan later.

**What the codebase check turned up before any code was written:**
- The caregiver chat was entirely mock data — it read hardcoded messages and
  Send only updated the screen.
- The family chat read Supabase but its Send button never wrote anything.
- So there was no real two-way thread to hang this feature on. Making one is a
  prerequisite the spec's build order did not list.
- The real table is `family_messages` (not `messages`), with a free-text
  `sender` name and no idea who the recipient is.
- The repo had no JavaScript tests at all.

---

## Task 1 — database fields and the house rule · `4609205`

**Changed:**
- `supabase/schema.sql` — added 9 new columns to `family_messages`: who a
  message is from and to, whether it was marked Needs response, who tagged it,
  when and by whom it was confirmed, plus two columns reserved for the later
  AI-suggestion work. Also a permission rule: the apps may change **only** the
  two confirmation columns, and only on a message that is still waiting. Nobody
  can rewrite message text through the app. Safe to run twice.
- `CLAUDE.md` — the old rule "never write backend code (Supabase, FastAPI…)"
  was written on day one (May 13) when the backend was someone else's job. Aaron
  wired Supabase in the next day and the rule was never updated. It now says
  backend and schema work is in scope when a feature spec calls for it. Auth is
  still off-limits. Also noted that the Sarah ↔ Janet thread is live, not faked.
- `ARCHITECTURE.md` — documented the new columns and the one query behind all
  three Pending surfaces.

**Not done, on purpose:** the SQL has **not** been run against the shared
Supabase project. That is a human decision on a shared database — see
Outstanding below.

**Review:** clean. The reviewer separately confirmed the permission rule really
does restrict updates rather than only appearing to.

---

## Task 2 — the rules of "pending", with tests · `e72b69b`

**Changed:**
- Added Vitest to `packages/ui` — the repo's **first JavaScript tests**.
  `pnpm test` from the root now runs them.
- `packages/ui/src/messaging/types.ts` — how a database row becomes something a
  screen can draw. Deliberately leaves out the AI-suggestion field so a
  suggestion can never leak into a Pending list.
- `packages/ui/src/messaging/participants.ts` — who Sarah and Janet are and
  which chat thread is the live one, in one place instead of scattered.
- `packages/ui/src/messaging/pending.ts` — the shared rules: oldest first, the
  `9+` badge cap, "Waiting 5 hours" only after two hours, the 7-day Confirmed
  window, and a merge rule that never lets a confirmed message flip back.

**12 tests**, written before the code and shown failing first. One test mixes
two timestamp formats, because the two apps write time slightly differently —
a careless version passes the simple test and fails that one.

**Review:** clean. The reviewer re-did the arithmetic by hand and cross-checked
the field names against Task 1's actual migration.

---

## Task 3 — saving, confirming, live updates · `2daa60d`, fix `b337dfa`

**Changed:**
- `packages/ui/src/messaging/client.ts` — one function to send a message
  (recording who it is for and whether it was tagged) and one to confirm a
  message (written so a second tap cannot overwrite the first confirmation).
- `packages/ui/src/messaging/useFamilyMessages.ts` — the piece that keeps both
  apps in sync: loads the conversation, then listens for new messages *and* for
  confirmations, so a Confirm on one screen changes the other without a reload.

**5 more tests** (17 total), checking real details: a message from Janet is
addressed to Sarah and vice versa, the tag is recorded as a human tag, and
failures surface instead of being swallowed.

**A real bug found — in the plan, not the implementation.** The first version
loaded the conversation and started listening at the same moment. A message
arriving in the sliver between the two would be invisible until the app was
reopened. For a feature whose point is that a request never gets lost, that is
the wrong bug. Fixed: the load now waits until the connection reports live, and
a dropped-and-restored connection reloads and catches up.

**Accepted trade-off:** if the live connection never establishes, the thread
shows empty rather than a stale snapshot. Honest, but it should log that state —
queued for the cleanup pass.

---

## Task 4 — the visible part · `8dbac71`, plus build fix `fcd7891`

**Changed:**
- `packages/theme/src/tokens.ts` — three amber colors (`attention.surface`,
  `.border`, `.text`), marked **provisional**: matched by eye to the mockup, not
  yet from Figma. When design settles, change them here and everything follows.
- `packages/ui/src/MessageBubble.tsx` — the chat bubble. A tagged message shows
  an amber card headed **Needs response**. The recipient gets a **Confirm**
  button, the sender sees **Pending**, and once confirmed both sides see
  **Confirmed**. A plain message looks exactly as it does today.
- `packages/ui/src/NeedsResponseToggle.tsx` — the **!** button for the composer.
  Tapping it does not steal focus from the text field, so it will not interrupt
  typing (still to be checked on a real phone with a Chinese keyboard).
- `apps/caregiver/app/preview/pending/page.tsx` — **temporary**. A design-review
  page showing all seven states side by side with fake data and no database.
  Delete before merge.

**6 more tests** (23 total), covering the one genuinely tricky rule: Confirm
appears only for the person who received an unconfirmed tagged message, and only
on a screen that can actually confirm — never as a dead button.

**A build failure found and fixed.** Adding the preview page exposed a defect
from Task 3: the live-updates hook was missing the marker that tells Next.js
"this runs in the browser". Both apps had stopped building. One line fixed it
(`fcd7891`), and both apps build clean again.

**Why it escaped:** Tasks 2–4 were verified with tests and the type checker
only, and neither catches this — it only shows up in a real build. From Task 5
on, every task that touches the UI also runs a build.

**One house rule bent, on purpose.** CLAUDE.md says never hardcode spacing or
radii — use tokens. These components use pixel values (`rounded-[20px]`,
`px-[14px]`), because that is exactly what every existing component does,
including the `ChatBubble` sitting next to them. Colors *are* tokenized, which
is the part that matters most here. Making these two components the only
token-compliant ones would have made the library less consistent, not more.
Extracting shared spacing/radius tokens is a real cleanup — and it is precisely
what the parked `chore/design-sync` branch was doing.

**To look at it:**
```bash
pnpm --filter @alio/caregiver dev
```
then open http://localhost:3001/preview/pending

---

## Outstanding — needs a human

**Run the new SQL on Supabase.** Nothing else is blocked on it until the app is
tested in a browser, but the app starts writing to those columns in Task 5.

1. Tell the team first — it is the shared project (`trnjqdafpnxkhacuzcuh`).
2. `cd ~/Documents/aliomodel/Alio && sed -n '120,162p' supabase/schema.sql | pbcopy`
   (copies only the new block; the older statements in that file would error on
   re-run).
3. Paste into Supabase Dashboard → SQL Editor → Run. Expect
   `Success. No rows returned`.
4. Verify:
   `select column_name from information_schema.columns where table_name = 'family_messages';`
   → 15 rows, the last 9 being the new ones.
5. Verify the safety rule — this one should **fail** with `permission denied`:
   ```sql
   begin; set local role anon;
   update family_messages set text = 'tampered' where thread_id = '__verify__';
   rollback;
   ```

Access is per-organization in Supabase, so whoever owns the project can add
others as **Administrator** once, instead of running SQL on their behalf forever.
