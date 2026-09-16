# Pending Confirmations — Human Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family member can mark a chat message "Needs response"; the caregiver confirms it from the bubble, a Pending list, a pinned bar in the thread, or the Home bell — and both apps see the same state live.

**Architecture:** No new tables. Nine nullable columns on Supabase `family_messages` carry the tag and confirmation. Both Next.js apps read and write that table straight from the browser (the existing pattern — see ARCHITECTURE.md) through one shared hook, `useFamilyMessages`, which does an initial select plus realtime INSERT/UPDATE merged by id. Every Pending surface is a pure selector over that list, so confirming anywhere updates everywhere.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind 3.4 with the `@alio/theme` preset, `@supabase/supabase-js` 2.x (realtime `postgres_changes`), pnpm workspaces. New: Vitest + jsdom + React Testing Library in `packages/ui`.

**Spec:** [docs/superpowers/specs/2026-09-15-pending-confirmations-design.md](../specs/2026-09-15-pending-confirmations-design.md)

**Branch:** `feat/pending-confirmations`, cut from `main` at `e912621`.

## Scope

This plan is **spec build-order steps 1–4** plus the prerequisite the spec does not list: today the chat is not a real two-way thread. The caregiver's `chat/[id]` page reads only mock data, and the family page reads Supabase but its Send button never writes. Tasks 3, 5 and 6 fix that.

Out of scope, each needing its own plan:
- **Step 5, timeout follow-up** — needs a scheduler and a way to notify the sender. Neither exists.
- **Step 6, model suggestion** — Ollama job, `suggested_tier` hint UI, labelled eval set. The columns are added here (Task 1) so that plan starts with no migration.

## Global Constraints

- **Vocabulary (spec §0), exact UI strings:** `Needs response`, `Pending`, `Confirm`, `Confirmed`, `Nothing pending`. Code identifiers: `tier = 'action'`, `acknowledged_at`, `acknowledge`.
- **Banned in code, copy and comments:** ticket, approve/approval, notification hub, inbox, task (for this feature — `task` already belongs to the routine system).
- **All UI copy is English.**
- **Only human-set `final_tier = 'action'` enters any Pending surface.** `suggested_tier` never does.
- **Pending ordering: oldest first.** `Waiting N hours` appears only once 2 hours have passed. Badge caps at `9+`, hidden at 0. Confirmed section keeps the last **7** days.
- **Single confirm state.** Nothing ever un-confirms a message except rolling back a failed network write.
- **v1 tagging is family-side only.** The caregiver composer gets no toggle (spec §9, no caregiver self-tagging).
- **Never hardcode colors** — tokens from `packages/theme` only (CLAUDE.md). The existing inline page-background gradient is the one established exception; copy it, don't add new ones.
- **Prototype identities, no auth:** caregiver `caregiver-001` ("Sarah Lee"), family member `janet-chen` ("Janet Chen"), live thread `caregiver-001__erin-yeung`.
- **Schema changes live in `supabase/schema.sql` and are applied by hand** in the Supabase SQL editor. That database is shared with the team.

## File map

| File | Responsibility |
|---|---|
| `supabase/schema.sql` | Task 1 — columns, backfill, pending index, confirm-only update permission |
| `CLAUDE.md`, `ARCHITECTURE.md` | Task 1 — house rule matches reality; table docs |
| `packages/ui/vitest.config.ts` | Task 2 — test runner |
| `packages/ui/src/messaging/types.ts` | Task 2 — `Tier`, `FamilyMessageRow`, `ThreadMessage`, `fromRow` |
| `packages/ui/src/messaging/participants.ts` | Task 2 — prototype identities and thread-id maps |
| `packages/ui/src/messaging/pending.ts` | Task 2 — pure selectors, formatters, `mergeMessage` |
| `packages/ui/src/messaging/client.ts` | Task 3 — `sendMessage`, `acknowledgeMessage` |
| `packages/ui/src/messaging/useFamilyMessages.ts` | Task 3 — load + realtime hook |
| `packages/theme/src/tokens.ts`, `tailwind-preset.ts` | Task 4 — provisional `attention` colors |
| `packages/ui/src/MessageBubble.tsx` | Task 4 — bubble with Needs response / Confirm / Pending / Confirmed |
| `packages/ui/src/NeedsResponseToggle.tsx` | Task 4 — composer toggle |
| `apps/family/app/(tabs)/chat/[id]/page.tsx` | Task 5 — real send with tag, live bubbles |
| `apps/caregiver/app/(tabs)/logs/report/[id]/page.tsx` | Task 5 — report inserts carry sender/recipient |
| `apps/caregiver/app/(tabs)/chat/[id]/page.tsx` | Tasks 6, 7, 8 — live thread, Confirm, focus, pinned bar |
| `packages/ui/src/PendingCard.tsx` | Task 7 — one list card |
| `apps/caregiver/components/PendingScreen.tsx` | Task 7 — the Pending list |
| `apps/caregiver/app/(tabs)/layout.tsx` | Task 7 — navigation into Pending and back |
| `packages/ui/src/PendingPinnedBar.tsx` | Task 8 — thread pinned bar |
| `apps/caregiver/app/(tabs)/home/page.tsx` | Task 7 — bell opens Pending; Task 9 — badge count |
| `packages/ui/src/index.ts` | Tasks 2–8 — exports |

**Known collision:** `renew-ui-sep02` (jwei2000-code, unmerged) also edits `apps/caregiver/app/(tabs)/layout.tsx`. Keep the layout edits in Task 7 to the lines shown. When her branch lands on `main`, run `git merge main` here and resolve that one file. This plan deliberately does not touch `packages/mock-data`, which she also edits.

---

### Task 1: Schema, house rule and architecture docs

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)
- Modify: `CLAUDE.md` (sections "Scope of this folder", "Stubbing rules", "Never do rules")
- Modify: `ARCHITECTURE.md` (the `family_messages` table section)

**Interfaces:**
- Produces: nine nullable columns on `family_messages` — `sender_id text`, `recipient_id text`, `final_tier text`, `tagged_by text`, `suggested_tier text`, `suggested_by text`, `acknowledged_at timestamptz`, `acknowledged_by text`, `followup_sent_at timestamptz`. The browser may UPDATE only `acknowledged_at` and `acknowledged_by`, only on a row where `final_tier = 'action' and acknowledged_at is null`.

- [ ] **Step 1: Append the migration to `supabase/schema.sql`**

```sql

-- =============================================================
-- Pending Confirmations
-- docs/superpowers/specs/2026-09-15-pending-confirmations-design.md §6
--
-- No new tables. suggested_tier and final_tier stay separate on purpose: the
-- gap between them is the adoption rate and the miss rate.
-- Safe to re-run: every statement is guarded.
-- =============================================================
alter table family_messages add column if not exists sender_id text;
alter table family_messages add column if not exists recipient_id text;
alter table family_messages add column if not exists final_tier text
  check (final_tier in ('action', 'fyi', 'social'));
alter table family_messages add column if not exists tagged_by text
  check (tagged_by in ('sender_manual', 'sender_confirmed_ai'));
alter table family_messages add column if not exists suggested_tier text
  check (suggested_tier in ('action', 'fyi', 'social'));
alter table family_messages add column if not exists suggested_by text
  check (suggested_by in ('model'));
alter table family_messages add column if not exists acknowledged_at timestamptz;
alter table family_messages add column if not exists acknowledged_by text;
alter table family_messages add column if not exists followup_sent_at timestamptz;

-- Every row written to the live thread before sender_id existed came from the
-- caregiver app's "Send to family" button, so its direction is known.
update family_messages
  set sender_id = 'caregiver-001', recipient_id = 'janet-chen'
  where thread_id = 'caregiver-001__erin-yeung' and sender_id is null;

-- The Pending list is a view over this index, not a store (spec §1).
create index if not exists family_messages_pending_idx
  on family_messages (recipient_id, created_at)
  where final_tier = 'action' and acknowledged_at is null;

-- Confirm is the only update the browser may make: two columns, only on an
-- unconfirmed "Needs response" message, and never back to unconfirmed.
revoke update on family_messages from anon, authenticated;
grant update (acknowledged_at, acknowledged_by) on family_messages to anon, authenticated;

drop policy if exists "family_messages anon acknowledge" on family_messages;
create policy "family_messages anon acknowledge" on family_messages
  for update
  using (final_tier = 'action' and acknowledged_at is null)
  with check (acknowledged_at is not null);
```

- [ ] **Step 2: Apply it to Supabase — the new block only**

Open Supabase Dashboard → SQL Editor. Paste **only the block from Step 1**, not the whole file: the older `create policy` statements earlier in `schema.sql` are not guarded and will error on a database that already has them. Run.

Expected: `Success. No rows returned`.

This is the team's shared database. Tell the team in chat before running it. Every column is nullable, so the existing report-send path and `backend/api.py` keep working unchanged.

- [ ] **Step 3: Verify columns exist**

Run in the SQL editor:

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'family_messages'
order by ordinal_position;
```

Expected: the original six columns followed by `sender_id`, `recipient_id`, `final_tier`, `tagged_by`, `suggested_tier`, `suggested_by`, `acknowledged_at` (`timestamp with time zone`), `acknowledged_by`, `followup_sent_at` (`timestamp with time zone`).

- [ ] **Step 4: Verify the browser can confirm but cannot rewrite a message**

Run each separately. Neither changes data — no row matches `'__verify__'`, and privileges are checked before any row is touched.

```sql
begin;
set local role anon;
update family_messages set text = 'tampered' where thread_id = '__verify__';
rollback;
```

Expected: `ERROR: permission denied for table family_messages`.

```sql
begin;
set local role anon;
update family_messages set acknowledged_at = now(), acknowledged_by = 'caregiver-001'
  where thread_id = '__verify__';
rollback;
```

Expected: success, `0 rows` affected.

- [ ] **Step 5: Update `CLAUDE.md` so the house rule matches the repo**

Replace this block under `## Scope of this folder`:

```markdown
**UI-only prototype.** Translate hi-fi Figma screens into a clickable, demoable Next.js app.
```

with:

```markdown
**Prototype with a live data layer.** It began as a UI-only translation of hi-fi Figma screens; Phase 2 (May 2026) wired FastAPI, Gemma and Supabase behind the caregiver and family apps. Screens still start from Figma.
```

In the **Never** build list, delete these two lines:

```markdown
- Supabase, database, persistence
- FastAPI, Gemma, real AI calls
```

Replace:

```markdown
Engineer wires real backend later. This folder is UI only.
```

with:

```markdown
Backend and schema work is in scope when a feature spec calls for it — e.g. `docs/superpowers/specs/2026-09-15-pending-confirmations-design.md`. Schema changes go in `supabase/schema.sql`, guarded so they are safe to re-run, and are applied by hand in the Supabase SQL editor after telling the team.
```

Under `## Stubbing rules`, replace:

```markdown
- **Real-time chat** → pre-seeded message threads, fake "typing..." animations, timed "new message" arrivals
```

with:

```markdown
- **Real-time chat** → pre-seeded message threads, fake "typing..." animations, timed "new message" arrivals — except the Sarah ↔ Janet care thread (`caregiver-001__erin-yeung`), which is live over Supabase realtime
```

Under `## "Never do" rules`, replace:

```markdown
- Never write backend code (Supabase, FastAPI, auth, real API calls)
```

with:

```markdown
- Never add auth, sessions or login flows — identities stay hardcoded until auth is its own project
```

- [ ] **Step 6: Document the columns in `ARCHITECTURE.md`**

In the `### family_messages` table, replace the `sender` row:

```markdown
| `sender` | text | "Sarah Lee" |
```

with:

```markdown
| `sender` | text | display name, e.g. "Sarah Lee" |
| `sender_id` / `recipient_id` | text \| null | `'caregiver-001'` / `'janet-chen'` for the live thread; null on rows from other writers |
| `final_tier` | text \| null | `'action'` = the sender marked it **Needs response**. Only this drives Pending surfaces |
| `tagged_by` | text \| null | `'sender_manual'` today; `'sender_confirmed_ai'` once suggestions ship |
| `suggested_tier` / `suggested_by` | text \| null | model output — never drives Pending. Reserved for the suggestion plan |
| `acknowledged_at` / `acknowledged_by` | timestamptz / text \| null | set by **Confirm**. The only columns the browser may update |
| `followup_sent_at` | timestamptz \| null | reserved for the timeout follow-up plan |
```

Directly after that table's closing row, add:

```markdown

The Pending list, the chat pinned bar and the Home bell are all the same query —
`recipient_id = me and final_tier = 'action' and acknowledged_at is null`, oldest
first — backed by `family_messages_pending_idx`. See
`docs/superpowers/specs/2026-09-15-pending-confirmations-design.md`.
```

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql CLAUDE.md ARCHITECTURE.md
git commit -m "feat(schema): add Pending Confirmations columns to family_messages

Nine nullable columns from the spec's data section, plus sender_id and
recipient_id so a message knows who it is waiting on. The browser may update
only acknowledged_at/acknowledged_by, and only on an unconfirmed action
message. CLAUDE.md no longer forbids the Supabase work Phase 2 already did.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Test harness and the pure Pending logic

**Files:**
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/messaging/types.ts`
- Create: `packages/ui/src/messaging/participants.ts`
- Create: `packages/ui/src/messaging/pending.ts`
- Test: `packages/ui/src/messaging/pending.test.ts`
- Modify: `packages/ui/package.json` (script + devDependencies)
- Modify: `package.json` (root `test` script)
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `type Tier = 'action' | 'fyi' | 'social'`
  - `interface FamilyMessageRow` (all 15 columns) and `interface ThreadMessage { id; threadId; senderId: string | null; recipientId: string | null; senderName; text; reportId: string | null; finalTier: Tier | null; acknowledgedAt: string | null; createdAt }`
  - `fromRow(row: FamilyMessageRow): ThreadMessage`
  - `CAREGIVER_ID`, `FAMILY_MEMBER_ID`, `CARE_THREAD_ID`, `DISPLAY_NAME`, `SUPABASE_THREAD_FOR_CAREGIVER`, `SUPABASE_THREAD_FOR_FAMILY`, `CAREGIVER_THREAD_FOR_SUPABASE`, `otherParticipant(userId: string): string`
  - `isPendingFor(m, userId): boolean`, `selectPending(messages, userId): ThreadMessage[]`, `selectRecentlyConfirmed(messages, userId, now: Date, days = 7): ThreadMessage[]`, `formatBadge(count: number): string | null`, `waitingLabel(createdAt: string, now: Date): string | null`, `pinnedBarLabel(messages, userId): string | null`, `formatMessageTime(iso: string, timeZone?: string): string`, `mergeMessage(list, next): ThreadMessage[]`

- [ ] **Step 1: Install the test tooling**

```bash
pnpm --filter @alio/ui add -D vitest jsdom @testing-library/react @testing-library/dom
```

Expected: `packages/ui/package.json` gains the four devDependencies; `pnpm-lock.yaml` changes.

- [ ] **Step 2: Add the scripts and runner config**

In `packages/ui/package.json`, change `"scripts"` to:

```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

In the root `package.json` `"scripts"`, add after `"typecheck"`:

```json
    "test": "pnpm -r --if-present run test",
```

Create `packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig says jsx: "preserve" for Next; tests need React's automatic runtime.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 3: Write the types and identities**

Create `packages/ui/src/messaging/types.ts`:

```ts
export type Tier = 'action' | 'fyi' | 'social';

/** One `family_messages` row exactly as Supabase returns it. */
export interface FamilyMessageRow {
  id: string;
  thread_id: string;
  sender: string;
  sender_id: string | null;
  recipient_id: string | null;
  text: string;
  report_id: string | null;
  final_tier: Tier | null;
  tagged_by: 'sender_manual' | 'sender_confirmed_ai' | null;
  suggested_tier: Tier | null;
  suggested_by: 'model' | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  followup_sent_at: string | null;
  created_at: string;
}

/**
 * The shape screens work with. Deliberately omits suggested_tier: a model
 * suggestion must never reach a Pending surface (spec §9).
 */
export interface ThreadMessage {
  id: string;
  threadId: string;
  senderId: string | null;
  recipientId: string | null;
  senderName: string;
  text: string;
  reportId: string | null;
  finalTier: Tier | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export function fromRow(row: FamilyMessageRow): ThreadMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderName: row.sender,
    text: row.text,
    reportId: row.report_id,
    finalTier: row.final_tier,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}
```

Create `packages/ui/src/messaging/participants.ts`:

```ts
/**
 * Prototype identities. There is no auth (ARCHITECTURE.md → Identity): each app
 * is signed in as exactly one person, and the only live thread is the
 * Sarah ↔ Janet dyad about Erin. Replace with the session user when auth lands.
 */
export const CAREGIVER_ID = 'caregiver-001';
export const FAMILY_MEMBER_ID = 'janet-chen';

export const CARE_THREAD_ID = 'caregiver-001__erin-yeung';

export const DISPLAY_NAME: Record<string, string> = {
  [CAREGIVER_ID]: 'Sarah Lee',
  [FAMILY_MEMBER_ID]: 'Janet Chen',
};

/** Caregiver app chat-list thread id → Supabase thread_id. */
export const SUPABASE_THREAD_FOR_CAREGIVER: Record<string, string | undefined> = {
  'janet-chen': CARE_THREAD_ID,
};

/** Family app chat-list thread id → Supabase thread_id. */
export const SUPABASE_THREAD_FOR_FAMILY: Record<string, string | undefined> = {
  'sarah-caregiver': CARE_THREAD_ID,
};

/** Supabase thread_id → caregiver app chat-list thread id, for jump-to-message. */
export const CAREGIVER_THREAD_FOR_SUPABASE: Record<string, string | undefined> = {
  [CARE_THREAD_ID]: 'janet-chen',
};

/** In a dyad, whoever isn't the sender is the recipient. */
export function otherParticipant(userId: string): string {
  return userId === CAREGIVER_ID ? FAMILY_MEMBER_ID : CAREGIVER_ID;
}
```

- [ ] **Step 4: Write the failing tests**

Create `packages/ui/src/messaging/pending.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from './types';
import { CAREGIVER_ID, FAMILY_MEMBER_ID, otherParticipant } from './participants';
import {
  formatBadge,
  formatMessageTime,
  isPendingFor,
  mergeMessage,
  pinnedBarLabel,
  selectPending,
  selectRecentlyConfirmed,
  waitingLabel,
} from './pending';

const NOW = new Date('2026-09-15T12:00:00Z');

function msg(overrides: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: 'm1',
    threadId: 'caregiver-001__erin-yeung',
    senderId: FAMILY_MEMBER_ID,
    recipientId: CAREGIVER_ID,
    senderName: 'Janet Chen',
    text: 'Pick up prescription, order 4471',
    reportId: null,
    finalTier: 'action',
    acknowledgedAt: null,
    createdAt: '2026-09-15T09:00:00Z',
    ...overrides,
  };
}

describe('otherParticipant', () => {
  it('maps each side of the dyad to the other', () => {
    expect(otherParticipant(CAREGIVER_ID)).toBe(FAMILY_MEMBER_ID);
    expect(otherParticipant(FAMILY_MEMBER_ID)).toBe(CAREGIVER_ID);
  });
});

describe('isPendingFor', () => {
  it('is true only for an unconfirmed action message addressed to the user', () => {
    expect(isPendingFor(msg({}), CAREGIVER_ID)).toBe(true);
    expect(isPendingFor(msg({}), FAMILY_MEMBER_ID)).toBe(false);
    expect(isPendingFor(msg({ finalTier: null }), CAREGIVER_ID)).toBe(false);
    expect(isPendingFor(msg({ finalTier: 'fyi' }), CAREGIVER_ID)).toBe(false);
    expect(isPendingFor(msg({ acknowledgedAt: '2026-09-15T10:00:00Z' }), CAREGIVER_ID)).toBe(false);
  });
});

describe('selectPending', () => {
  it('returns the longest-waiting item first', () => {
    const newer = msg({ id: 'newer', createdAt: '2026-09-15T11:00:00Z' });
    const older = msg({ id: 'older', createdAt: '2026-09-15T08:00:00Z' });
    const confirmed = msg({ id: 'done', acknowledgedAt: '2026-09-15T11:30:00Z' });
    expect(selectPending([newer, confirmed, older], CAREGIVER_ID).map((m) => m.id)).toEqual([
      'older',
      'newer',
    ]);
  });

  it('orders by instant, not by string, when offsets are written differently', () => {
    const a = msg({ id: 'a', createdAt: '2026-09-15T10:00:00.000Z' });
    const b = msg({ id: 'b', createdAt: '2026-09-15T09:30:00+00:00' });
    expect(selectPending([a, b], CAREGIVER_ID).map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('selectRecentlyConfirmed', () => {
  it('keeps the last 7 days, most recently confirmed first', () => {
    const recent = msg({ id: 'recent', acknowledgedAt: '2026-09-15T11:00:00Z' });
    const earlier = msg({ id: 'earlier', acknowledgedAt: '2026-09-10T11:00:00Z' });
    const stale = msg({ id: 'stale', acknowledgedAt: '2026-09-07T11:00:00Z' });
    const pending = msg({ id: 'pending' });
    expect(
      selectRecentlyConfirmed([earlier, stale, pending, recent], CAREGIVER_ID, NOW).map((m) => m.id),
    ).toEqual(['recent', 'earlier']);
  });
});

describe('formatBadge', () => {
  it('hides at zero and caps at 9+', () => {
    expect(formatBadge(0)).toBeNull();
    expect(formatBadge(1)).toBe('1');
    expect(formatBadge(9)).toBe('9');
    expect(formatBadge(10)).toBe('9+');
  });
});

describe('waitingLabel', () => {
  it('appears only once two hours have passed', () => {
    expect(waitingLabel('2026-09-15T10:01:00Z', NOW)).toBeNull();
    expect(waitingLabel('2026-09-15T10:00:00Z', NOW)).toBe('Waiting 2 hours');
    expect(waitingLabel('2026-09-15T06:30:00Z', NOW)).toBe('Waiting 5 hours');
  });
});

describe('pinnedBarLabel', () => {
  it('shows the count and the longest-waiting item', () => {
    const newer = msg({ id: 'n', text: 'Call me after lunch', createdAt: '2026-09-15T11:00:00Z' });
    const older = msg({ id: 'o', createdAt: '2026-09-15T08:00:00Z' });
    expect(pinnedBarLabel([newer, older], CAREGIVER_ID)).toBe(
      '2 pending · Pick up prescription, order 4471',
    );
  });

  it('is null when nothing is pending, which hides the bar', () => {
    expect(pinnedBarLabel([msg({ finalTier: null })], CAREGIVER_ID)).toBeNull();
  });
});

describe('formatMessageTime', () => {
  it('formats as hour and minute', () => {
    expect(formatMessageTime('2026-09-15T14:05:00Z', 'UTC')).toBe('2:05 PM');
  });
});

describe('mergeMessage', () => {
  it('replaces by id and keeps chronological order', () => {
    const first = msg({ id: 'a', createdAt: '2026-09-15T08:00:00Z' });
    const second = msg({ id: 'b', createdAt: '2026-09-15T09:00:00Z' });
    const echo = msg({ id: 'b', createdAt: '2026-09-15T09:00:00Z', text: 'edited' });
    const merged = mergeMessage(mergeMessage([second], first), echo);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
    expect(merged[1].text).toBe('edited');
  });

  it('never un-confirms a message because of a stale event', () => {
    const confirmed = msg({ acknowledgedAt: '2026-09-15T10:00:00Z' });
    const staleInsertEcho = msg({ acknowledgedAt: null });
    expect(mergeMessage([confirmed], staleInsertEcho)[0].acknowledgedAt).toBe(
      '2026-09-15T10:00:00Z',
    );
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — `Failed to resolve import "./pending"`.

- [ ] **Step 6: Implement `pending.ts`**

Create `packages/ui/src/messaging/pending.ts`:

```ts
import type { ThreadMessage } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Compare instants, not strings: Supabase writes "+00:00", toISOString() writes "Z". */
const instant = (iso: string) => Date.parse(iso);

/** An unconfirmed, human-tagged "Needs response" message addressed to this user. */
export function isPendingFor(m: ThreadMessage, userId: string): boolean {
  return m.recipientId === userId && m.finalTier === 'action' && m.acknowledgedAt === null;
}

/** The Pending view (spec §1): longest-waiting first. */
export function selectPending(messages: ThreadMessage[], userId: string): ThreadMessage[] {
  return messages
    .filter((m) => isPendingFor(m, userId))
    .sort((a, b) => instant(a.createdAt) - instant(b.createdAt));
}

/** The collapsed Confirmed section (spec §3): last `days` days, most recently confirmed first. */
export function selectRecentlyConfirmed(
  messages: ThreadMessage[],
  userId: string,
  now: Date,
  days = 7,
): ThreadMessage[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return messages
    .filter(
      (m): m is ThreadMessage & { acknowledgedAt: string } =>
        m.recipientId === userId &&
        m.finalTier === 'action' &&
        m.acknowledgedAt !== null &&
        instant(m.acknowledgedAt) >= cutoff,
    )
    .sort((a, b) => instant(b.acknowledgedAt) - instant(a.acknowledgedAt));
}

/** Bell badge text (spec §2.1): hidden at zero, capped at 9+. */
export function formatBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

/** "Waiting 5 hours", only once two hours have passed (spec §3). */
export function waitingLabel(createdAt: string, now: Date): string | null {
  const hours = Math.floor((now.getTime() - instant(createdAt)) / HOUR_MS);
  return hours >= 2 ? `Waiting ${hours} hours` : null;
}

/** Chat pinned bar (spec §2.2): count plus the longest-waiting item. Null hides the bar. */
export function pinnedBarLabel(messages: ThreadMessage[], userId: string): string | null {
  const pending = selectPending(messages, userId);
  if (pending.length === 0) return null;
  return `${pending.length} pending · ${pending[0].text}`;
}

export function formatMessageTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/**
 * Insert or replace by id, keeping chronological order, so realtime echoes of
 * our own writes are harmless. Confirmation is one-way: an event that arrives
 * late carrying acknowledged_at = null must not undo it.
 */
export function mergeMessage(list: ThreadMessage[], next: ThreadMessage): ThreadMessage[] {
  const prev = list.find((m) => m.id === next.id);
  const merged =
    prev?.acknowledgedAt && !next.acknowledgedAt
      ? { ...next, acknowledgedAt: prev.acknowledgedAt }
      : next;
  return [...list.filter((m) => m.id !== next.id), merged].sort(
    (a, b) => instant(a.createdAt) - instant(b.createdAt),
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS, 12 tests.

- [ ] **Step 8: Export from the package**

In `packages/ui/src/index.ts`, add above the `// Caesarzkn icons` comment:

```ts
// Messaging — Pending Confirmations
export * from './messaging/types';
export * from './messaging/participants';
export * from './messaging/pending';

```

Run: `pnpm --filter @alio/ui typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/ui package.json pnpm-lock.yaml
git commit -m "feat(ui): add Pending selectors and the packages/ui test harness

Pure logic every Pending surface shares: oldest-first ordering, 9+ badge,
Waiting N hours after two hours, 7-day Confirmed window, and a merge that
never un-confirms on a stale realtime event. First JS tests in the repo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Supabase writes and the live message hook

**Files:**
- Create: `packages/ui/src/messaging/client.ts`
- Create: `packages/ui/src/messaging/useFamilyMessages.ts`
- Test: `packages/ui/src/messaging/client.test.ts`
- Modify: `packages/ui/package.json` (dependency)
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `FamilyMessageRow`, `ThreadMessage`, `fromRow`, `mergeMessage`, `DISPLAY_NAME`, `otherParticipant` (Task 2)
- Produces:
  - `sendMessage(client: SupabaseClient, params: { threadId: string; senderId: string; text: string; needsResponse: boolean }): Promise<FamilyMessageRow>`
  - `acknowledgeMessage(client: SupabaseClient, params: { messageId: string; userId: string; at?: Date }): Promise<void>`
  - `type MessageScope = { by: 'thread'; threadId: string } | { by: 'recipient'; recipientId: string; since: Date }`
  - `useFamilyMessages(client: SupabaseClient, scope: MessageScope | null): { messages: ThreadMessage[]; patch(id: string, changes: Partial<ThreadMessage>): void; upsert(row: FamilyMessageRow): void }`

- [ ] **Step 1: Add the Supabase dependency for its types**

```bash
pnpm --filter @alio/ui add @supabase/supabase-js@^2.105.4
```

Expected: same range both apps already use; no second copy in the lockfile.

- [ ] **Step 2: Write the failing tests**

Create `packages/ui/src/messaging/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acknowledgeMessage, sendMessage } from './client';

/**
 * Records every builder call and resolves the chain with `result`, mirroring
 * how supabase-js query builders are awaited.
 */
function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: Array<[string, unknown[]]> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: result.data ?? null, error: result.error ?? null });
        }
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return builder;
        };
      },
    },
  );
  return { client: builder as SupabaseClient, calls };
}

const argsOf = (calls: Array<[string, unknown[]]>, name: string) =>
  calls.find(([n]) => n === name)?.[1];

describe('sendMessage', () => {
  it('writes an untagged message addressed to the other participant', async () => {
    const { client, calls } = fakeClient({ data: { id: 'row-1' } });
    const row = await sendMessage(client, {
      threadId: 'caregiver-001__erin-yeung',
      senderId: 'caregiver-001',
      text: 'On my way',
      needsResponse: false,
    });
    expect(row).toEqual({ id: 'row-1' });
    expect(argsOf(calls, 'from')).toEqual(['family_messages']);
    expect(argsOf(calls, 'insert')).toEqual([
      {
        thread_id: 'caregiver-001__erin-yeung',
        sender: 'Sarah Lee',
        sender_id: 'caregiver-001',
        recipient_id: 'janet-chen',
        text: 'On my way',
        final_tier: null,
        tagged_by: null,
      },
    ]);
  });

  it('tags Needs response as a manual sender tag', async () => {
    const { client, calls } = fakeClient({ data: { id: 'row-2' } });
    await sendMessage(client, {
      threadId: 'caregiver-001__erin-yeung',
      senderId: 'janet-chen',
      text: 'Pick up prescription, order 4471',
      needsResponse: true,
    });
    expect(argsOf(calls, 'insert')).toEqual([
      expect.objectContaining({
        sender: 'Janet Chen',
        recipient_id: 'caregiver-001',
        final_tier: 'action',
        tagged_by: 'sender_manual',
      }),
    ]);
  });

  it('throws when Supabase rejects the write', async () => {
    const { client } = fakeClient({ error: { message: 'network down' } });
    await expect(
      sendMessage(client, { threadId: 't', senderId: 'janet-chen', text: 'x', needsResponse: false }),
    ).rejects.toThrow('sendMessage: network down');
  });
});

describe('acknowledgeMessage', () => {
  it('sets both columns, only on a still-unconfirmed row', async () => {
    const { client, calls } = fakeClient({});
    await acknowledgeMessage(client, {
      messageId: 'row-2',
      userId: 'caregiver-001',
      at: new Date('2026-09-15T12:00:00Z'),
    });
    expect(argsOf(calls, 'update')).toEqual([
      { acknowledged_at: '2026-09-15T12:00:00.000Z', acknowledged_by: 'caregiver-001' },
    ]);
    expect(argsOf(calls, 'eq')).toEqual(['id', 'row-2']);
    expect(argsOf(calls, 'is')).toEqual(['acknowledged_at', null]);
  });

  it('throws when Supabase rejects the write', async () => {
    const { client } = fakeClient({ error: { message: 'denied' } });
    await expect(
      acknowledgeMessage(client, { messageId: 'row-2', userId: 'caregiver-001' }),
    ).rejects.toThrow('acknowledgeMessage: denied');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — `Failed to resolve import "./client"`.

- [ ] **Step 4: Implement `client.ts`**

Create `packages/ui/src/messaging/client.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FamilyMessageRow } from './types';
import { DISPLAY_NAME, otherParticipant } from './participants';

/** Writes one chat message. `needsResponse` is the sender's own tag, never a model's. */
export async function sendMessage(
  client: SupabaseClient,
  params: { threadId: string; senderId: string; text: string; needsResponse: boolean },
): Promise<FamilyMessageRow> {
  const { data, error } = await client
    .from('family_messages')
    .insert({
      thread_id: params.threadId,
      sender: DISPLAY_NAME[params.senderId] ?? params.senderId,
      sender_id: params.senderId,
      recipient_id: otherParticipant(params.senderId),
      text: params.text,
      final_tier: params.needsResponse ? 'action' : null,
      tagged_by: params.needsResponse ? 'sender_manual' : null,
    })
    .select()
    .single();
  if (error) throw new Error(`sendMessage: ${error.message}`);
  return data as FamilyMessageRow;
}

/**
 * Confirm (spec §0: `acknowledge`). Filtered on acknowledged_at is null so a
 * second tap, or a second device, cannot overwrite the first confirmation time.
 */
export async function acknowledgeMessage(
  client: SupabaseClient,
  params: { messageId: string; userId: string; at?: Date },
): Promise<void> {
  const { error } = await client
    .from('family_messages')
    .update({
      acknowledged_at: (params.at ?? new Date()).toISOString(),
      acknowledged_by: params.userId,
    })
    .eq('id', params.messageId)
    .is('acknowledged_at', null);
  if (error) throw new Error(`acknowledgeMessage: ${error.message}`);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS, 17 tests.

- [ ] **Step 6: Implement the hook**

Create `packages/ui/src/messaging/useFamilyMessages.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromRow, type FamilyMessageRow, type ThreadMessage } from './types';
import { mergeMessage } from './pending';

export type MessageScope =
  | { by: 'thread'; threadId: string }
  | { by: 'recipient'; recipientId: string; since: Date };

/**
 * Live `family_messages` for one scope: an initial select, then realtime INSERT
 * and UPDATE merged by id. The channel opens before the select so nothing that
 * lands in between is lost; mergeMessage makes the overlap harmless.
 *
 * `patch` is for optimistic updates — a Confirm tap should not wait on the
 * network. `upsert` takes the row a write returned.
 */
export function useFamilyMessages(client: SupabaseClient, scope: MessageScope | null) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  const filter =
    scope === null
      ? null
      : scope.by === 'thread'
        ? `thread_id=eq.${scope.threadId}`
        : `recipient_id=eq.${scope.recipientId}`;
  const since = scope?.by === 'recipient' ? scope.since.toISOString() : null;

  useEffect(() => {
    if (scope === null || filter === null) return;
    let cancelled = false;
    setMessages([]);

    const apply = (row: FamilyMessageRow) => {
      if (!cancelled) setMessages((prev) => mergeMessage(prev, fromRow(row)));
    };

    const channel = client
      .channel(`family_messages:${filter}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_messages', filter },
        (payload) => apply(payload.new as FamilyMessageRow),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'family_messages', filter },
        (payload) => apply(payload.new as FamilyMessageRow),
      )
      .subscribe();

    (async () => {
      const base = client.from('family_messages').select('*');
      const query =
        scope.by === 'thread'
          ? base.eq('thread_id', scope.threadId)
          : base
              .eq('recipient_id', scope.recipientId)
              .eq('final_tier', 'action')
              .or(`acknowledged_at.is.null,acknowledged_at.gte.${since}`);
      const { data, error } = await query.order('created_at');
      if (error) {
        console.error('useFamilyMessages:', error.message);
        return;
      }
      for (const row of (data ?? []) as FamilyMessageRow[]) apply(row);
    })();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
    // `filter` and `since` are the scope's identity; the object is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filter, since]);

  const patch = useCallback((id: string, changes: Partial<ThreadMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
  }, []);

  const upsert = useCallback((row: FamilyMessageRow) => {
    setMessages((prev) => mergeMessage(prev, fromRow(row)));
  }, []);

  return { messages, patch, upsert };
}
```

Note: `since` must be stable across renders for a recipient scope, or the effect re-subscribes every render. Callers create it with `useMemo(..., [])` (Tasks 7 and 9). The hook has no unit test — it is glue over `mergeMessage` (tested) and supabase-js, and Tasks 5 and 6 verify it against the live database in two browsers.

- [ ] **Step 7: Export, typecheck, commit**

In `packages/ui/src/index.ts`, extend the Messaging block:

```ts
// Messaging — Pending Confirmations
export * from './messaging/types';
export * from './messaging/participants';
export * from './messaging/pending';
export * from './messaging/client';
export * from './messaging/useFamilyMessages';
```

Run: `pnpm --filter @alio/ui typecheck && pnpm --filter @alio/ui test`
Expected: no type errors; 17 tests pass.

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): add sendMessage, acknowledgeMessage and useFamilyMessages

One hook for both apps: initial select plus realtime INSERT and UPDATE,
merged by id. Confirm writes are filtered on acknowledged_at is null so a
second tap cannot move the confirmation time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Attention tokens, MessageBubble and the Needs response toggle

**Files:**
- Modify: `packages/theme/src/tokens.ts`
- Modify: `packages/theme/src/tailwind-preset.ts`
- Create: `packages/ui/src/MessageBubble.tsx`
- Create: `packages/ui/src/NeedsResponseToggle.tsx`
- Test: `packages/ui/src/MessageBubble.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `ThreadMessage` (Task 2); `IconAttention` from `./icons`
- Produces:
  - Tailwind classes `bg-attention-surface`, `border-attention-border`, `text-attention-text`, `ring-attention-border`
  - `MessageBubble({ message: ThreadMessage; viewerId: string; onConfirm?: (messageId: string) => void; highlighted?: boolean })` — root element carries `data-message-id={message.id}`
  - `NeedsResponseToggle({ pressed: boolean; onToggle: () => void })`

- [ ] **Step 1: Add the provisional tokens**

In `packages/theme/src/tokens.ts`, inside `colors`, after the `info` block:

```ts
  // PROVISIONAL — matched by eye to the Pending Confirmations mockup
  // (docs/superpowers/specs/2026-09-15-pending-confirmations-design.md),
  // not yet in Figma. When design finalizes, change the values here only.
  attention: {
    surface: '#F5DEAB',
    border: '#E3A73A',
    text: '#6B4A12',
  },
```

In `packages/theme/src/tailwind-preset.ts`, after `info: colors.info.blue,`:

```ts
        attention: {
          surface: colors.attention.surface,
          border: colors.attention.border,
          text: colors.attention.text,
        },
```

Run: `pnpm --filter @alio/theme typecheck`
Expected: no errors.

- [ ] **Step 2: Write the failing tests**

Create `packages/ui/src/MessageBubble.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import { NeedsResponseToggle } from './NeedsResponseToggle';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const tagged: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: 'Pick up prescription, order 4471',
  reportId: null,
  finalTier: 'action',
  acknowledgedAt: null,
  createdAt: '2026-09-15T09:00:00Z',
};

describe('MessageBubble', () => {
  it('gives the recipient a Confirm button that reports the message id', () => {
    const onConfirm = vi.fn();
    render(<MessageBubble message={tagged} viewerId="caregiver-001" onConfirm={onConfirm} />);
    expect(screen.getByText('Needs response')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('m1');
  });

  it('shows the sender Pending, with no Confirm button', () => {
    render(<MessageBubble message={tagged} viewerId="janet-chen" />);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });

  it('shows both sides Confirmed once acknowledged', () => {
    const done = { ...tagged, acknowledgedAt: '2026-09-15T10:00:00Z' };
    render(<MessageBubble message={done} viewerId="caregiver-001" onConfirm={() => {}} />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    cleanup();
    render(<MessageBubble message={done} viewerId="janet-chen" />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
  });

  it('renders an untagged message as a plain bubble', () => {
    render(<MessageBubble message={{ ...tagged, finalTier: null }} viewerId="caregiver-001" />);
    expect(screen.getByText('Pick up prescription, order 4471')).toBeTruthy();
    expect(screen.queryByText('Needs response')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('marks its root with the message id for jump-to-message', () => {
    const { container } = render(<MessageBubble message={tagged} viewerId="caregiver-001" />);
    expect(container.querySelector('[data-message-id="m1"]')).not.toBeNull();
  });
});

describe('NeedsResponseToggle', () => {
  it('exposes its state and reports taps', () => {
    const onToggle = vi.fn();
    render(<NeedsResponseToggle pressed onToggle={onToggle} />);
    const toggle = screen.getByRole('button', { name: 'Needs response' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — `Failed to resolve import "./MessageBubble"`.

- [ ] **Step 4: Implement both components**

Create `packages/ui/src/MessageBubble.tsx`:

```tsx
import clsx from 'clsx';
import { IconAttention } from './icons';
import type { ThreadMessage } from './messaging/types';

/**
 * A live chat message. The primary Pending surface (spec §2.3): a
 * "Needs response" message carries its Confirm button in the bubble, and both
 * sides see the state — the recipient gets Confirm, the sender sees Pending,
 * everyone sees Confirmed.
 *
 * Confirm renders only when `onConfirm` is passed, so a screen that cannot
 * confirm never shows a dead button.
 */
export function MessageBubble({
  message,
  viewerId,
  onConfirm,
  highlighted = false,
}: {
  message: ThreadMessage;
  viewerId: string;
  onConfirm?: (messageId: string) => void;
  highlighted?: boolean;
}) {
  const isMine = message.senderId === viewerId;
  const needsResponse = message.finalTier === 'action';
  const confirmed = message.acknowledgedAt !== null;
  const canConfirm =
    onConfirm !== undefined && needsResponse && !confirmed && message.recipientId === viewerId;

  return (
    <div
      data-message-id={message.id}
      className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-[75%] rounded-[20px] px-[14px] py-[12px] transition-shadow duration-300',
          isMine ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]',
          needsResponse
            ? 'border border-attention-border bg-attention-surface text-attention-text'
            : isMine
              ? 'bg-brand-primary text-white'
              : 'bg-white text-gray-100',
          highlighted && 'ring-2 ring-brand-primary ring-offset-2',
        )}
      >
        {needsResponse && (
          <p className="mb-[6px] flex items-center gap-[6px] text-[12px] font-bold">
            <IconAttention aria-hidden className="size-[16px]" />
            Needs response
          </p>
        )}
        <p className="whitespace-pre-wrap text-[14px] leading-snug">{message.text}</p>
        {canConfirm && (
          <button
            type="button"
            onClick={() => onConfirm?.(message.id)}
            className="mt-[10px] h-[38px] w-full rounded-lg bg-gray-10 text-[14px] font-bold text-gray-100 transition-colors active:bg-gray-30"
          >
            Confirm
          </button>
        )}
        {needsResponse && !canConfirm && (
          <p className="mt-[8px] text-[12px] font-bold">{confirmed ? 'Confirmed' : 'Pending'}</p>
        )}
      </div>
    </div>
  );
}
```

Create `packages/ui/src/NeedsResponseToggle.tsx`:

```tsx
import clsx from 'clsx';
import { IconAttention } from './icons';

/**
 * Composer toggle: the sender marks the next message "Needs response".
 *
 * preventDefault on mousedown keeps focus in the text field, so tapping the
 * toggle does not blur the input mid-composition. Spec §10 still requires a
 * check on a real device with a non-Latin input method.
 */
export function NeedsResponseToggle({
  pressed,
  onToggle,
}: {
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Needs response"
      aria-pressed={pressed}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className={clsx(
        'flex size-[44px] shrink-0 items-center justify-center rounded-full transition-colors',
        pressed
          ? 'bg-attention-surface text-attention-text ring-1 ring-attention-border'
          : 'bg-white/70 text-gray-100 active:bg-white',
      )}
    >
      <IconAttention aria-hidden className="size-[22px]" />
    </button>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS, 23 tests.

- [ ] **Step 6: Export, typecheck, commit**

In `packages/ui/src/index.ts`, under `// Chat`, after `export { ChatBubble } from './ChatBubble';`:

```ts
export { MessageBubble } from './MessageBubble';
export { NeedsResponseToggle } from './NeedsResponseToggle';
```

Run: `pnpm --filter @alio/ui typecheck && pnpm --filter @alio/ui test`
Expected: no type errors; 23 tests pass.

```bash
git add packages/theme packages/ui
git commit -m "feat(ui): add MessageBubble and NeedsResponseToggle

Confirm lives in the bubble; the recipient sees Confirm, the sender sees
Pending, both see Confirmed. Amber attention tokens are provisional, matched
to the mockup, and changeable in one place.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Family chat sends for real, with Needs response

**Files:**
- Modify: `apps/family/app/(tabs)/chat/[id]/page.tsx` (replace lines 1–117 and the input row, lines 200–238)
- Modify: `apps/family/lib/supabase.ts` (delete `FamilyMessageRow`, lines 8–15)
- Modify: `apps/caregiver/app/(tabs)/logs/report/[id]/page.tsx` (the insert at line 68)
- Modify: `apps/caregiver/lib/supabase.ts` (delete the unused `FamilyMessageRow`, lines 21–27)

**Interfaces:**
- Consumes: `useFamilyMessages`, `sendMessage`, `MessageBubble`, `NeedsResponseToggle`, `FAMILY_MEMBER_ID`, `CAREGIVER_ID`, `SUPABASE_THREAD_FOR_FAMILY` from `@alio/ui`

- [ ] **Step 1: Replace the family page's data layer**

In `apps/family/app/(tabs)/chat/[id]/page.tsx`, replace everything from line 1 through the end of `handleSend` (line 117) with:

```tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChatBubble,
  FAMILY_MEMBER_ID,
  IconBox,
  IconChevronLeft,
  IconSearch,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
  MessageBubble,
  NeedsResponseToggle,
  SUPABASE_THREAD_FOR_FAMILY,
  sendMessage,
  useFamilyMessages,
} from '@alio/ui';
import {
  SAMPLE_FM_CHAT_THREADS,
  SAMPLE_FM_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';
import { supabase } from '@/lib/supabase';
import { ReportCard } from '@/components/ReportCard';

/**
 * Family Chat conversation — same layout as Caregiver Chat conversation.
 * Threads with a Supabase mapping show mock history, then the live thread;
 * sends are written to Supabase and can be marked Needs response.
 */
export default function FamilyChatConversationPage({ id: propId, onBack }: { id?: string; onBack?: () => void } = {}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = propId ?? params?.id ?? '';
  const handleBack = onBack ?? (() => router.back());

  const thread = SAMPLE_FM_CHAT_THREADS.find((t) => t.id === id);
  const supabaseThreadId = SUPABASE_THREAD_FOR_FAMILY[id];

  const [mockMessages, setMockMessages] = useState<ChatMessage[]>(SAMPLE_FM_CONVERSATIONS[id] ?? []);
  const { messages: live, upsert } = useFamilyMessages(
    supabase,
    supabaseThreadId ? { by: 'thread', threadId: supabaseThreadId } : null,
  );
  const [draft, setDraft] = useState('');
  const [needsResponse, setNeedsResponse] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (!supabaseThreadId) {
      setMockMessages((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text }]);
      return;
    }
    try {
      upsert(
        await sendMessage(supabase, {
          threadId: supabaseThreadId,
          senderId: FAMILY_MEMBER_ID,
          text,
          needsResponse,
        }),
      );
      setNeedsResponse(false);
      setSendError('');
    } catch (e) {
      console.error(e);
      setDraft(text);
      setSendError("Message didn't send. Check your connection and try again.");
    }
  };
```

- [ ] **Step 2: Render mock history, then live messages**

In the same file, replace the messages block (the `{messages.length === 0 ? (` expression through its closing `)}`) with:

```tsx
        {mockMessages.length === 0 && live.length === 0 ? (
          <p className="mt-12 text-center text-sm text-gray-60">
            No messages yet — say hi 👋
          </p>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {mockMessages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {live.map((m) =>
              m.reportId ? (
                <div key={m.id} className="flex" data-message-id={m.id}>
                  <ReportCard reportId={m.reportId} />
                </div>
              ) : (
                <MessageBubble key={m.id} message={m} viewerId={FAMILY_MEMBER_ID} />
              ),
            )}
          </div>
        )}
```

- [ ] **Step 3: Add the toggle and the send error to the input row**

Replace the input row (`{/* Input row */}` through its closing `</div>`) with:

```tsx
      {/* Input row */}
      <div className="absolute bottom-[16px] left-0 right-0 flex flex-col gap-[6px] px-[16px]">
        {sendError && (
          <p role="alert" className="text-center text-[12px] font-bold text-alert">
            {sendError}
          </p>
        )}
        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            aria-label="Record voice message"
            className="flex size-[44px] items-center justify-center rounded-full bg-white/70 transition-colors active:bg-white"
          >
            <IconMicrophone className="size-[22px] text-gray-100" />
          </button>

          {supabaseThreadId && (
            <NeedsResponseToggle
              pressed={needsResponse}
              onToggle={() => setNeedsResponse((v) => !v)}
            />
          )}

          <div className="flex h-[44px] flex-1 items-center gap-2 rounded-full bg-white/70 px-[14px]">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // isComposing: Enter that commits an IME candidate must not send.
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
              }}
              placeholder=""
              className="flex-1 bg-transparent text-[14px] text-gray-100 placeholder:text-gray-60 outline-none"
            />
            <button
              type="button"
              aria-label="Insert emoji"
              className="flex size-[24px] items-center justify-center text-gray-60"
            >
              <span className="text-[18px]">☺</span>
            </button>
          </div>

          <button
            type="button"
            aria-label="More actions"
            onClick={handleSend}
            className="flex size-[44px] items-center justify-center rounded-[12px] bg-white/70 transition-colors active:bg-white"
          >
            <IconPlus className="size-[22px] text-gray-100" />
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Delete the app-local row types**

In `apps/family/lib/supabase.ts`, delete the `FamilyMessageRow` interface (lines 8–15). In `apps/caregiver/lib/supabase.ts`, delete its unused `FamilyMessageRow` interface (lines 21–27). `@alio/ui` now owns the row type.

- [ ] **Step 5: Stamp report messages with sender and recipient**

In `apps/caregiver/app/(tabs)/logs/report/[id]/page.tsx`, add to the `@alio/ui` import list:

```tsx
  CAREGIVER_ID,
  FAMILY_MEMBER_ID,
```

and change the insert to:

```tsx
      const { error: insertError } = await supabase.from('family_messages').insert({
        thread_id: threadIdFor(row.caregiver_id, row.patient_id),
        sender: CAREGIVER_NAME,
        sender_id: CAREGIVER_ID,
        recipient_id: FAMILY_MEMBER_ID,
        text,
        report_id: row.id,
      });
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @alio/family typecheck`
Expected: only the four pre-existing `PageProps` errors in `.next/types` (`chat/page.ts`, `chat/[id]/page.ts`, `records/page.ts`, `records/visit/[id]/page.ts`). No error mentions `FamilyMessageRow`, `MessageBubble` or `sendMessage`.

- [ ] **Step 7: Verify against the live database**

Both apps need `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (copy `.env.example`). Run: `pnpm dev`

1. Open http://localhost:3002 → Chat → **Sarah**. Existing report cards still render.
2. Type `Test plain message`, press Enter. It appears right-aligned, blue.
3. Tap the **!** toggle (it turns amber), type `Pick up prescription, order 4471`, press Enter. It appears amber with **Needs response** and **Pending**. The toggle resets.
4. Reload. Both messages are still there.
5. In Supabase Table Editor → `family_messages`: the tagged row has `sender_id = janet-chen`, `recipient_id = caregiver-001`, `final_tier = action`, `tagged_by = sender_manual`, `acknowledged_at = null`.

- [ ] **Step 8: Commit**

```bash
git add apps/family apps/caregiver/lib/supabase.ts "apps/caregiver/app/(tabs)/logs/report/[id]/page.tsx"
git commit -m "feat(family): send chat messages to Supabase, with Needs response

The family Send button never wrote anything; now it does, and the sender can
mark a message Needs response. Report sends from the caregiver app record
sender and recipient so the thread knows its direction.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Caregiver chat goes live, with Confirm in the bubble

Completes spec build-order step 1.

**Files:**
- Modify: `apps/caregiver/app/(tabs)/chat/[id]/page.tsx` (replace lines 1–47 and the messages block, lines 101–113)

**Interfaces:**
- Consumes: `useFamilyMessages`, `sendMessage`, `acknowledgeMessage`, `MessageBubble`, `CAREGIVER_ID`, `SUPABASE_THREAD_FOR_CAREGIVER` from `@alio/ui`
- Produces: `ChatConversationPage` accepts `{ id?: string; onBack?: () => void; focusMessageId?: string; onOpenPending?: () => void }`. `focusMessageId` and `onOpenPending` are accepted now and used in Tasks 7 and 8.

- [ ] **Step 1: Replace the caregiver page's data layer**

In `apps/caregiver/app/(tabs)/chat/[id]/page.tsx`, replace lines 1–47 with:

```tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CAREGIVER_ID,
  ChatBubble,
  IconBox,
  IconChevronLeft,
  IconSearch,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
  MessageBubble,
  SUPABASE_THREAD_FOR_CAREGIVER,
  acknowledgeMessage,
  sendMessage,
  useFamilyMessages,
} from '@alio/ui';
import {
  SAMPLE_CHAT_THREADS,
  SAMPLE_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';
import { supabase } from '@/lib/supabase';

/**
 * Caregiver Chat conversation — Figma: `GC - Chat - conversation` (388:3940).
 * Header with back + avatar + name + online + search, message bubbles
 * (right=me, left=them), quick actions row, input bar. Threads with a Supabase
 * mapping show mock history, then the live thread, where Needs response
 * messages carry Confirm in the bubble.
 */
export default function ChatConversationPage({
  id: propId,
  onBack,
  focusMessageId,
  onOpenPending,
}: {
  id?: string;
  onBack?: () => void;
  focusMessageId?: string;
  onOpenPending?: () => void;
} = {}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = propId ?? params?.id ?? '';
  const handleBack = onBack ?? (() => router.back());

  const thread = SAMPLE_CHAT_THREADS.find((t) => t.id === id);
  const supabaseThreadId = SUPABASE_THREAD_FOR_CAREGIVER[id];

  const [mockMessages, setMockMessages] = useState<ChatMessage[]>(SAMPLE_CONVERSATIONS[id] ?? []);
  const { messages: live, patch, upsert } = useFamilyMessages(
    supabase,
    supabaseThreadId ? { by: 'thread', threadId: supabaseThreadId } : null,
  );
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (!supabaseThreadId) {
      setMockMessages((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text }]);
      return;
    }
    try {
      upsert(
        await sendMessage(supabase, {
          threadId: supabaseThreadId,
          senderId: CAREGIVER_ID,
          text,
          needsResponse: false,
        }),
      );
      setSendError('');
    } catch (e) {
      console.error(e);
      setDraft(text);
      setSendError("Message didn't send. Check your connection and try again.");
    }
  };

  const handleConfirm = async (messageId: string) => {
    const at = new Date();
    patch(messageId, { acknowledgedAt: at.toISOString() });
    try {
      await acknowledgeMessage(supabase, { messageId, userId: CAREGIVER_ID, at });
    } catch (e) {
      console.error(e);
      patch(messageId, { acknowledgedAt: null });
      setSendError("Couldn't confirm. Check your connection and tap Confirm again.");
    }
  };
```

- [ ] **Step 2: Render mock history, then live messages with Confirm**

Replace the messages block (`{messages.length === 0 ? (` through its closing `)}`) with:

```tsx
        {mockMessages.length === 0 && live.length === 0 ? (
          <p className="mt-12 text-center text-sm text-gray-60">
            No messages yet — say hi 👋
          </p>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {mockMessages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {live.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                viewerId={CAREGIVER_ID}
                onConfirm={handleConfirm}
              />
            ))}
          </div>
        )}
```

- [ ] **Step 3: Show the send error above the input row**

Directly above `{/* Input row — anchored above tab bar */}`, add:

```tsx
      {sendError && (
        <p
          role="alert"
          className="absolute bottom-[112px] left-0 right-0 px-[16px] text-center text-[12px] font-bold text-alert"
        >
          {sendError}
        </p>
      )}
```

In the input's `onKeyDown`, change the condition to `if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @alio/caregiver typecheck`
Expected: only the three pre-existing `PageProps` errors (`chat/[id]/page.ts`, `chat/page.ts`, `logs/page.ts`).

- [ ] **Step 5: Verify the loop end to end**

With `pnpm dev` running, put http://localhost:3002 (family) and http://localhost:3001 (caregiver) side by side.

1. Caregiver → Chat → **Janet Chen**. The message tagged in Task 5 shows amber with **Needs response** and a **Confirm** button.
2. Family → Chat → **Sarah**, tag and send `Can you refill the pill organizer?`. Within about a second it appears in the caregiver thread with **Confirm**, without a reload.
3. Caregiver taps **Confirm**. Its button is replaced by **Confirmed** at once.
4. Within about a second, the family bubble changes from **Pending** to **Confirmed**, without a reload.
5. Caregiver sends `On my way`. It appears right-aligned on the caregiver side and left-aligned on the family side.
6. Reload both apps. States persist.

- [ ] **Step 6: Commit**

```bash
git add "apps/caregiver/app/(tabs)/chat/[id]/page.tsx"
git commit -m "feat(caregiver): make the Janet thread live, with Confirm in the bubble

Spec build step 1. The caregiver thread read only mock data; it now reads and
writes the same Supabase thread as the family app, and confirming updates the
family's bubble in real time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: People, waiting time and day grouping

Revised 2026-09-16 against the caregiver screens. Pure data and logic — no
screens. Everything here is consumed by Tasks 8 and 9.

**Files:**
- Modify: `packages/ui/src/messaging/participants.ts`
- Modify: `packages/ui/src/messaging/pending.ts`
- Modify: `packages/ui/src/messaging/pending.test.ts`
- Create: `apps/caregiver/lib/pending-fixtures.ts`

**Interfaces:**
- Consumes: `ThreadMessage`, `selectPending`, `selectRecentlyConfirmed` (Task 2)
- Produces:
  - `PEOPLE: Record<string, { name: string; relationship: string }>`
  - `personLabel(senderId: string | null, fallbackName: string): string` → `"Emily · Granddaughter"`, or just the name when the id is unknown
  - `waitingLabel(createdAt: string, now: Date): string` — **signature changes: never returns null**
  - `oldestWaitingLabel(pending: ThreadMessage[], now: Date): string | null` → `"Oldest: 5h"`
  - `waitingSinceLabel(pending: ThreadMessage[], timeZone?: string): string | null` → `"Waiting since 9:14 AM"`
  - `confirmedRecencyLabel(confirmed: ThreadMessage[], now: Date): string | null` → `"Today"` / `"Yesterday"` / `"Earlier"`
  - `groupConfirmedByDay(confirmed: ThreadMessage[], now: Date): { label: 'TODAY' | 'YESTERDAY' | 'EARLIER'; items: ThreadMessage[] }[]`
  - `DEMO_PENDING(now: Date): ThreadMessage[]` and `DEMO_CONFIRMED(now: Date): ThreadMessage[]` from the fixtures file

- [ ] **Step 1: Write the failing tests**

Replace the whole `describe('waitingLabel', …)` block in
`packages/ui/src/messaging/pending.test.ts` with:

```ts
describe('waitingLabel', () => {
  it('counts minutes below an hour and hours above it', () => {
    expect(waitingLabel('2026-09-15T11:20:00Z', NOW)).toBe('Waiting 40m');
    expect(waitingLabel('2026-09-15T11:01:00Z', NOW)).toBe('Waiting 59m');
    expect(waitingLabel('2026-09-15T11:00:00Z', NOW)).toBe('Waiting 1h');
    expect(waitingLabel('2026-09-15T09:00:00Z', NOW)).toBe('Waiting 3h');
  });

  it('never shows less than a minute', () => {
    expect(waitingLabel('2026-09-15T11:59:50Z', NOW)).toBe('Waiting 1m');
  });
});
```

Append these blocks to the same file:

```ts
describe('personLabel', () => {
  it('adds the relationship when the person is known', () => {
    expect(personLabel('janet-chen', 'Janet Chen')).toBe('Janet Chen · Daughter');
  });

  it('falls back to the name alone for an unknown sender', () => {
    expect(personLabel('someone-else', 'Pat')).toBe('Pat');
    expect(personLabel(null, 'Pat')).toBe('Pat');
  });
});

describe('oldestWaitingLabel', () => {
  it('reports the longest wait, or nothing when nothing is pending', () => {
    const older = msg({ id: 'o', createdAt: '2026-09-15T07:00:00Z' });
    const newer = msg({ id: 'n', createdAt: '2026-09-15T11:30:00Z' });
    expect(oldestWaitingLabel(selectPending([newer, older], CAREGIVER_ID), NOW)).toBe('Oldest: 5h');
    expect(oldestWaitingLabel([], NOW)).toBeNull();
  });
});

describe('waitingSinceLabel', () => {
  it('reports the clock time the oldest item arrived', () => {
    const older = msg({ id: 'o', createdAt: '2026-09-15T09:14:00Z' });
    expect(waitingSinceLabel([older], 'UTC')).toBe('Waiting since 9:14 AM');
    expect(waitingSinceLabel([], 'UTC')).toBeNull();
  });
});

describe('confirmedRecencyLabel', () => {
  it('summarises how recent the newest confirmation is', () => {
    const today = msg({ acknowledgedAt: '2026-09-15T09:00:00Z' });
    const yesterday = msg({ acknowledgedAt: '2026-09-14T09:00:00Z' });
    const older = msg({ acknowledgedAt: '2026-09-11T09:00:00Z' });
    expect(confirmedRecencyLabel([today], NOW)).toBe('Today');
    expect(confirmedRecencyLabel([yesterday], NOW)).toBe('Yesterday');
    expect(confirmedRecencyLabel([older], NOW)).toBe('Earlier');
    expect(confirmedRecencyLabel([], NOW)).toBeNull();
  });
});

describe('groupConfirmedByDay', () => {
  it('splits into TODAY, YESTERDAY and EARLIER, newest first, dropping empty groups', () => {
    const today = msg({ id: 't', acknowledgedAt: '2026-09-15T09:00:00Z' });
    const yesterdayEarly = msg({ id: 'y1', acknowledgedAt: '2026-09-14T08:00:00Z' });
    const yesterdayLate = msg({ id: 'y2', acknowledgedAt: '2026-09-14T16:41:00Z' });
    const older = msg({ id: 'e', acknowledgedAt: '2026-09-11T11:20:00Z' });
    const groups = groupConfirmedByDay([yesterdayEarly, older, today, yesterdayLate], NOW);
    expect(groups.map((g) => g.label)).toEqual(['TODAY', 'YESTERDAY', 'EARLIER']);
    expect(groups[0].items.map((m) => m.id)).toEqual(['t']);
    expect(groups[1].items.map((m) => m.id)).toEqual(['y2', 'y1']);
    expect(groups[2].items.map((m) => m.id)).toEqual(['e']);
    expect(groupConfirmedByDay([today], NOW).map((g) => g.label)).toEqual(['TODAY']);
  });
});
```

Add the new names to the existing import from `./pending`, and `personLabel`
to the existing import from `./participants`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — `waitingLabel` returns `null` where a string is expected, and
the new names are not exported.

- [ ] **Step 3: Add people to `participants.ts`**

Replace the `DISPLAY_NAME` block with:

```ts
/**
 * Prototype directory. Relationship is what the caregiver screens show beside a
 * name ("Emily · Granddaughter"); it has no home in the database yet, so it
 * lives here until a people table exists.
 */
export const PEOPLE: Record<string, { name: string; relationship: string }> = {
  [CAREGIVER_ID]: { name: 'Sarah Lee', relationship: 'Caregiver' },
  [FAMILY_MEMBER_ID]: { name: 'Janet Chen', relationship: 'Daughter' },
  'emily-chen': { name: 'Emily', relationship: 'Granddaughter' },
  'charles-chen': { name: 'Charles', relationship: 'Son' },
  'miranda-chen': { name: 'Miranda', relationship: 'Daughter' },
};

export const DISPLAY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(PEOPLE).map(([id, person]) => [id, person.name]),
);

/** "Emily · Granddaughter" for a known sender, the plain name otherwise. */
export function personLabel(senderId: string | null, fallbackName: string): string {
  const person = senderId === null ? undefined : PEOPLE[senderId];
  return person ? `${person.name} · ${person.relationship}` : fallbackName;
}
```

- [ ] **Step 4: Rewrite the time helpers in `pending.ts`**

Replace `waitingLabel` with:

```ts
const MINUTE_MS = 60 * 1000;

/**
 * "Waiting 40m" below an hour, "Waiting 3h" above it (spec §3, revised
 * 2026-09-16 — it used to stay silent under two hours, which the screens
 * contradict). Never below a minute: a fresh item still reads as waiting.
 */
export function waitingLabel(createdAt: string, now: Date): string {
  const elapsed = Math.max(now.getTime() - instant(createdAt), MINUTE_MS);
  const minutes = Math.floor(elapsed / MINUTE_MS);
  return minutes < 60 ? `Waiting ${minutes}m` : `Waiting ${Math.floor(minutes / 60)}h`;
}
```

Append:

```ts
/** "Oldest: 5h" for the section header. Null when nothing is pending. */
export function oldestWaitingLabel(pending: ThreadMessage[], now: Date): string | null {
  const oldest = pending[0];
  if (!oldest) return null;
  return `Oldest: ${waitingLabel(oldest.createdAt, now).replace('Waiting ', '')}`;
}

/** "Waiting since 9:14 AM" for the Inbox card. Null when nothing is pending. */
export function waitingSinceLabel(pending: ThreadMessage[], timeZone?: string): string | null {
  const oldest = pending[0];
  if (!oldest) return null;
  return `Waiting since ${formatMessageTime(oldest.createdAt, timeZone)}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** How recent the newest confirmation is, for the Inbox card. */
export function confirmedRecencyLabel(confirmed: ThreadMessage[], now: Date): string | null {
  const newest = confirmed[0];
  if (!newest?.acknowledgedAt) return null;
  const days = Math.round((startOfDay(now) - startOfDay(new Date(newest.acknowledgedAt))) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return 'Earlier';
}

export type ConfirmedGroup = { label: 'TODAY' | 'YESTERDAY' | 'EARLIER'; items: ThreadMessage[] };

/** Confirmed rows grouped by calendar day, newest first, empty groups dropped. */
export function groupConfirmedByDay(confirmed: ThreadMessage[], now: Date): ConfirmedGroup[] {
  const buckets: ConfirmedGroup[] = [
    { label: 'TODAY', items: [] },
    { label: 'YESTERDAY', items: [] },
    { label: 'EARLIER', items: [] },
  ];
  const sorted = [...confirmed].sort(
    (a, b) => instant(b.acknowledgedAt ?? b.createdAt) - instant(a.acknowledgedAt ?? a.createdAt),
  );
  for (const m of sorted) {
    const days = Math.round((startOfDay(now) - startOfDay(new Date(m.acknowledgedAt ?? m.createdAt))) / DAY_MS);
    const bucket = days <= 0 ? buckets[0] : days === 1 ? buckets[1] : buckets[2];
    bucket.items.push(m);
  }
  return buckets.filter((b) => b.items.length > 0);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS. The `selectPending`/`PendingCard` callers still compile because
`waitingLabel` only became non-nullable.

- [ ] **Step 6: Export and add the demo fixtures**

Add `personLabel` and the four new pending helpers to the existing export
blocks in `packages/ui/src/index.ts` (they are covered by the existing
`export *` lines — verify, and add nothing if so).

Create `apps/caregiver/lib/pending-fixtures.ts`:

```ts
import type { ThreadMessage } from '@alio/ui';
import { CAREGIVER_ID, CARE_THREAD_ID, PEOPLE } from '@alio/ui';

/**
 * Demo people for the caregiver screens. The live thread has exactly one family
 * member (Janet); these fixtures let the Pending and Confirmed screens show the
 * range of senders the design calls for. They follow the codebase's existing
 * pattern of mock history alongside live rows (see the chat pages), and they
 * are display-only — confirming one updates local state, never the database.
 */
const ago = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

function demo(
  id: string,
  senderId: string,
  text: string,
  createdAt: string,
  acknowledgedAt: string | null,
): ThreadMessage {
  return {
    id,
    threadId: CARE_THREAD_ID,
    senderId,
    recipientId: CAREGIVER_ID,
    senderName: PEOPLE[senderId].name,
    text,
    reportId: null,
    finalTier: 'action',
    acknowledgedAt,
    createdAt,
  };
}

export function DEMO_PENDING(now: Date): ThreadMessage[] {
  return [
    demo(
      'demo-pending-emily',
      'emily-chen',
      "Could you check whether she still has enough of the blue blood pressure pills? I'll order more tonight if she's low.",
      ago(now, 40),
      null,
    ),
    demo(
      'demo-pending-charles',
      'charles-chen',
      "Mom's cardiology appointment moved to Thursday at 2:15. Can you take her then instead of Friday?",
      ago(now, 180),
      null,
    ),
  ];
}

export function DEMO_CONFIRMED(now: Date): ThreadMessage[] {
  const day = 24 * 60;
  return [
    demo(
      'demo-confirmed-walker',
      'miranda-chen',
      'Can you bring the walker in from the porch before you leave?',
      ago(now, 300),
      ago(now, 240),
    ),
    demo(
      'demo-confirmed-grocery',
      'emily-chen',
      'Grocery list is on the fridge — she wants the oat milk this time.',
      ago(now, day + 400),
      ago(now, day + 300),
    ),
    demo(
      'demo-confirmed-water',
      'charles-chen',
      'Remind her to drink a full glass of water with lunch.',
      ago(now, day + 600),
      ago(now, day + 500),
    ),
    demo(
      'demo-confirmed-mail',
      'miranda-chen',
      'Bring the mail up on Tuesday, please.',
      ago(now, 4 * day),
      ago(now, 4 * day - 60),
    ),
  ];
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @alio/ui test && pnpm --filter @alio/ui typecheck && pnpm --filter @alio/caregiver build`
Expected: tests pass, typecheck clean, build completes.

```bash
git add packages/ui apps/caregiver/lib/pending-fixtures.ts
git commit -m "feat(ui): show waiting time in minutes, add people and day grouping

The caregiver screens show 'Waiting 40m' and group confirmed items by day, so
the waiting label no longer stays silent under two hours and rows now carry
'name · relationship'. Relationship has no database home yet and lives in the
prototype directory next to the other hardcoded identities.

Demo senders let the screens show the range the design calls for while the live
thread still has one real family member.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The Pending screen — screens 2 and 3

Revised 2026-09-16. Builds `GC - Chat - pending` and `GC - Chat - confirmed`
exactly: one screen, two tabs.

**Files:**
- Create: `packages/ui/src/SegmentedTabs.tsx`
- Create: `packages/ui/src/PendingCard.tsx`
- Create: `packages/ui/src/ConfirmedRow.tsx`
- Test: `packages/ui/src/PendingCard.test.tsx` (covers all three)
- Modify: `packages/ui/src/icons/custom.tsx` (add `IconCheck`)
- Modify: `packages/ui/src/index.ts`
- Create: `apps/caregiver/components/PendingScreen.tsx`
- Modify: `apps/caregiver/app/(tabs)/layout.tsx`

**Interfaces:**
- Consumes: Task 7's helpers and fixtures; `useFamilyMessages`, `acknowledgeMessage`, `CAREGIVER_ID` (Task 3)
- Produces:
  - `SegmentedTabs<T extends string>({ tabs, value, onChange })` where `tabs: { value: T; label: string; badge?: number }[]`
  - `PendingCard({ message, now, onConfirm, onOpen, leaving })`
  - `ConfirmedRow({ message })`
  - `PendingScreen({ initialTab, onBack, onOpenMessage })`, `initialTab: 'pending' | 'confirmed'`
  - Layout `SubPage` gains `{ type: 'pending'; tab: 'pending' | 'confirmed' }`

**Visual spec — follow exactly.** Colors come from tokens only.

Screen chrome (both tabs):
- Page background: the app gradient, `linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)` inline, as every other screen does.
- Header at `top-[60px] left-[25px] right-[25px]`, `flex items-center justify-between`: back `IconBox size={42} shape="pill"` with `IconChevronLeft`, then a `Inbox` pill (`h-[42px] rounded-[10px] bg-brand-tint-1 px-[12px] text-[20px] font-bold text-black`), then on the right a `gap-[12px]` pair of `IconBox size={42} shape="pill"`: `IconSearch` (aria-label "Search") and `IconFilter` (aria-label "Filter").
- Segmented control below the header: full width, `h-[52px] rounded-full bg-white/50 p-[5px] flex`. Each segment `flex-1 rounded-full flex items-center justify-center gap-[8px] text-[16px] font-bold`; selected: `bg-white text-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.08)]`; unselected: `text-gray-60`. A badge renders when `badge` is set and above zero: `flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand-primary px-[6px] text-[12px] font-bold text-white`.
- Scrollable content below.

Pending tab:
- Section header row: `WAITING ON YOU` (`text-[12px] font-bold uppercase tracking-[0.08em] text-gray-60`) on the left, `Oldest: 5h` (`text-[12px] font-bold text-brand-primary`) on the right, hidden when nothing is pending.
- `PendingCard`: `rounded-[16px] bg-white px-[16px] py-[16px]`.
  - Top row: `personLabel(...)` as `text-[15px] font-bold text-gray-100`, and on the right the waiting pill: `rounded-full bg-brand-tint-1 px-[10px] py-[4px] text-[12px] font-bold text-brand-primary`.
  - Message: `mt-[12px] whitespace-pre-wrap text-[16px] leading-[1.45] text-gray-100`. Never truncated.
  - Confirm: `mt-[16px] h-[48px] w-full rounded-[12px] bg-brand-active text-[16px] font-bold text-white transition-colors active:bg-brand-primary`. (`brand-active`, not `brand-primary`: white on primary is 4.35:1 and misses AA; on active it is 5.18:1.)
  - Tapping the card body — not the button — calls `onOpen(message)`.
  - `leaving` adds `translate-x-6 opacity-0` for the 300ms exit.
- Cards `gap-[12px]`, oldest first.
- Empty: `Nothing pending`, `text-[14px] text-gray-60`, centred with `py-[24px]`.

Confirmed tab:
- For each group: label (`TODAY`/`YESTERDAY`/`EARLIER`) as `mt-[20px] mb-[8px] text-[12px] font-bold uppercase tracking-[0.08em] text-gray-60`.
- `ConfirmedRow`: `flex gap-[10px] rounded-[16px] bg-white px-[16px] py-[14px]`; `IconCheck` `mt-[2px] size-[18px] shrink-0 text-brand-primary` with `aria-hidden`; then a column: message `text-[15px] leading-snug text-gray-100`, then `mt-[4px] text-[12px] text-gray-60` reading `personLabel(...) · formatMessageTime(acknowledgedAt)`.
- Rows `gap-[10px]`.
- Empty: `Nothing confirmed yet`, same styling as the pending empty state.

- [ ] **Step 1: Add the check icon**

Append to `packages/ui/src/icons/custom.tsx`:

```tsx
/**
 * IconCheck — plain check mark for confirmed rows. The generated Caesarzkn set
 * only has circled/boxed checklist variants; the screens use a bare tick.
 */
export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4 12.5L9.5 18L20 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/ui/src/PendingCard.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PendingCard } from './PendingCard';
import { ConfirmedRow } from './ConfirmedRow';
import { SegmentedTabs } from './SegmentedTabs';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const NOW = new Date('2026-09-15T12:00:00Z');
const LONG_TEXT =
  'Could you check whether she still has enough of the blue blood pressure pills? ' +
  "I'll order more tonight if she's low, and I can drop them off on Thursday.";

const pending: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'emily-chen',
  recipientId: 'caregiver-001',
  senderName: 'Emily',
  text: LONG_TEXT,
  reportId: null,
  finalTier: 'action',
  acknowledgedAt: null,
  createdAt: '2026-09-15T11:20:00Z',
};

describe('PendingCard', () => {
  it('shows sender with relationship, the waiting pill and the full text', () => {
    render(<PendingCard message={pending} now={NOW} onOpen={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText('Emily · Granddaughter')).toBeTruthy();
    expect(screen.getByText('Waiting 40m')).toBeTruthy();
    expect(screen.getByText(LONG_TEXT)).toBeTruthy();
  });

  it('confirms from the button and opens the thread from the body', () => {
    const onConfirm = vi.fn();
    const onOpen = vi.fn();
    render(<PendingCard message={pending} now={NOW} onOpen={onOpen} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('m1');
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(LONG_TEXT));
    expect(onOpen).toHaveBeenCalledWith(pending);
  });
});

describe('ConfirmedRow', () => {
  it('reads as one line: message, then who and when', () => {
    render(
      <ConfirmedRow
        message={{ ...pending, acknowledgedAt: '2026-09-15T09:14:00Z' }}
      />,
    );
    expect(screen.getByText(LONG_TEXT)).toBeTruthy();
    expect(screen.getByText(/Emily · Granddaughter ·/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });
});

describe('SegmentedTabs', () => {
  it('marks the selected tab, shows a badge and reports a change', () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        tabs={[
          { value: 'pending', label: 'Pending', badge: 3 },
          { value: 'confirmed', label: 'Confirmed' },
        ]}
        value="pending"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: /Pending/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Confirmed' }));
    expect(onChange).toHaveBeenCalledWith('confirmed');
  });

  it('hides a zero badge', () => {
    render(
      <SegmentedTabs
        tabs={[
          { value: 'pending', label: 'Pending', badge: 0 },
          { value: 'confirmed', label: 'Confirmed' },
        ]}
        value="confirmed"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — the three components do not exist.

- [ ] **Step 4: Build the three components**

Write `SegmentedTabs.tsx`, `PendingCard.tsx` and `ConfirmedRow.tsx` to the
visual spec above. `SegmentedTabs` uses `role="tablist"` on the container and
`role="tab"` with `aria-selected` on each segment. `PendingCard` composes
`personLabel(message.senderId, message.senderName)` and
`waitingLabel(message.createdAt, now)`; `ConfirmedRow` composes
`personLabel(...)` and `formatMessageTime(message.acknowledgedAt ?? message.createdAt)`.
Keep each file to its one component.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS.

Export all three from `packages/ui/src/index.ts`, next to `MessageBubble`.

- [ ] **Step 6: Build the screen**

Create `apps/caregiver/components/PendingScreen.tsx`, a `'use client'`
component (not a route) with `{ initialTab, onBack, onOpenMessage }`:

- `useFamilyMessages(supabase, { by: 'recipient', recipientId: CAREGIVER_ID, since })`
  with `since` memoised to 7 days ago, exactly as before.
- A `useNow(60_000)` hook local to the file keeps the waiting labels current.
- Live items come from `selectPending(messages, CAREGIVER_ID)` and
  `selectRecentlyConfirmed(messages, CAREGIVER_ID, now)`.
- Demo items come from `DEMO_PENDING(now)` / `DEMO_CONFIRMED(now)`, held in
  component state so confirming one moves it to the Confirmed tab locally. Merge
  live and demo with live first, then re-sort with the same helpers so ordering
  stays oldest-first (pending) and newest-first (confirmed).
- Confirming a live item calls `acknowledgeMessage` with the optimistic
  patch/rollback and 300ms exit animation from the previous version of this
  screen. Confirming a demo item only updates local state — never call Supabase
  with a `demo-` id.
- Tab state starts at `initialTab` and is switchable.
- Tapping a card body calls `onOpenMessage(message)`; for a demo item, do
  nothing (there is no real thread position to jump to).

- [ ] **Step 7: Wire it into the layout**

In `apps/caregiver/app/(tabs)/layout.tsx`:

```tsx
const PendingScreen = dynamic(
  () => import('@/components/PendingScreen').then((m) => m.PendingScreen),
  { ssr: false },
);
```

`SubPage` becomes:

```tsx
type SubPage =
  | { type: 'chat'; id: string; focusMessageId?: string; from?: 'pending' }
  | { type: 'report'; id: string }
  | { type: 'pending'; tab: 'pending' | 'confirmed' }
  | null;
```

Render it, and give the chat sub-page a back route home:

```tsx
          {subPage?.type === 'chat'    && <ChatDetail   id={subPage.id} focusMessageId={subPage.focusMessageId} onBack={() => setSubPage(subPage.from === 'pending' ? { type: 'pending', tab: 'pending' } : null)} />}
          {subPage?.type === 'pending' && <PendingScreen initialTab={subPage.tab} onBack={() => setSubPage(null)} onOpenMessage={(m) => { const chatId = CAREGIVER_THREAD_FOR_SUPABASE[m.threadId]; if (chatId) setSubPage({ type: 'chat', id: chatId, focusMessageId: m.id, from: 'pending' }); }} />}
```

Import `CAREGIVER_THREAD_FOR_SUPABASE` from `@alio/ui`.

- [ ] **Step 8: Verify and commit**

Run: `pnpm --filter @alio/ui test && pnpm --filter @alio/ui typecheck && pnpm --filter @alio/caregiver build`
Expected: tests pass, typecheck shows only the known `PageProps` errors, build completes.

```bash
git add packages/ui apps/caregiver
git commit -m "feat(caregiver): build the Pending and Confirmed screens

Two tabs on one screen, per the caregiver designs: pending cards carry the
sender's relationship, a waiting pill and Confirm; confirmed rows group by day
behind a check mark. Demo senders sit alongside the live thread so the screens
show the range the design calls for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The Inbox screen, the bell, and final verification

Revised 2026-09-16. Builds `GC - Chat - initial page` and finishes the feature.

**Files:**
- Modify: `apps/caregiver/app/(tabs)/chat/page.tsx`
- Modify: `apps/caregiver/app/(tabs)/home/page.tsx`
- Modify: `apps/caregiver/app/(tabs)/layout.tsx`
- Create: `packages/ui/src/InboxSummaryCard.tsx`
- Test: `packages/ui/src/InboxSummaryCard.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 7's `waitingSinceLabel`, `confirmedRecencyLabel`; Task 8's `PendingScreen` sub-page
- Produces: `InboxSummaryCard({ count, label, detail, onOpen })`; `CaregiverChatPage` accepts `{ onOpenThread?, onOpenPending? }`; `CaregiverHomePage` accepts `{ onOpenPending? }`

**Visual spec:**
- Header pill text changes from `Chat` to `Inbox`. The second header button changes from `IconChat` to `IconFilter`, `aria-label="Filter chats"`. Search stays.
- Two cards directly under the header, above the thread list: a `flex gap-[12px]` row, each card `flex-1`, `rounded-[14px] bg-brand-primary px-[14px] py-[12px] text-left text-white transition-colors active:bg-brand-active`.
  - Count: `text-[28px] font-bold leading-none`.
  - Label: `mt-[6px] text-[14px] font-bold leading-none` — `Pending` / `Confirmed`.
  - Detail: `mt-[6px] text-[12px] leading-none text-white/80` — `waitingSinceLabel(...)` or `confirmedRecencyLabel(...)`; render an empty string when null so the cards keep equal height.
- The cards are always visible, including at zero (spec §2.2, revised).
- The thread list starts below the cards.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/InboxSummaryCard.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InboxSummaryCard } from './InboxSummaryCard';

afterEach(cleanup);

describe('InboxSummaryCard', () => {
  it('shows the count, label and detail, and reports taps', () => {
    const onOpen = vi.fn();
    render(
      <InboxSummaryCard count={2} label="Pending" detail="Waiting since 9:14 AM" onOpen={onOpen} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Waiting since 9:14 AM')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pending/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('still renders at zero', () => {
    render(<InboxSummaryCard count={0} label="Pending" detail={null} onOpen={() => {}} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @alio/ui test` → FAIL, component missing.

- [ ] **Step 3: Build the card, export it, see the test pass**

Write `packages/ui/src/InboxSummaryCard.tsx` to the visual spec, export it from
the barrel, and run the suite again — PASS.

- [ ] **Step 4: Rebuild the Inbox screen**

In `apps/caregiver/app/(tabs)/chat/page.tsx`: add `'use client'`, take
`{ onOpenThread, onOpenPending }`, swap the pill copy and the icon, read the
counts from `useFamilyMessages` + `selectPending`/`selectRecentlyConfirmed`
merged with `DEMO_PENDING`/`DEMO_CONFIRMED` exactly as `PendingScreen` does, and
render the two cards above the list. Keep the list's existing appearance.

- [ ] **Step 5: Point the bell at the Pending screen**

In `home/page.tsx`, keep the badge work from before and make the bell call
`onOpenPending`. In `layout.tsx`:

```tsx
          {!subPage && active === 'home'     && <HomeTab onOpenPending={() => setSubPage({ type: 'pending', tab: 'pending' })} />}
          {!subPage && active === 'chat'     && <ChatTab    onOpenThread={(id) => setSubPage({ type: 'chat',   id })} onOpenPending={(tab) => setSubPage({ type: 'pending', tab })} />}
```

- [ ] **Step 6: Full verification**

```bash
pnpm test
pnpm -r typecheck
pnpm -r build
git diff main --stat -- backend    # must be empty
```

Expected: all tests pass; typecheck shows only the known `PageProps` errors;
both apps build; backend untouched.

Then check the banned vocabulary (note `inbox` was un-banned on 2026-09-16 for
the chat-list header only):

```bash
git diff main --name-only | grep -E '\.(ts|tsx|sql)$' \
  | xargs grep -n -i -E '\b(ticket|approv|notification hub)' || echo "clean"
```

- [ ] **Step 7: Commit**

```bash
git add packages/ui apps/caregiver
git commit -m "feat(caregiver): rebuild the Inbox with Pending and Confirmed cards

The chat list becomes the Inbox: two always-visible cards summarising what is
waiting and what was confirmed, either one opening the Pending screen on its
tab. The header's second action is now a filter. The Home bell opens the same
screen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---


## After this plan

- **Open a pull request** from `feat/pending-confirmations` into `main` for review, rather than pushing to `main`.
- **Real-device check (spec §10):** on an iPhone with a Chinese input method, start composing, tap the **!** toggle mid-composition, and confirm the candidate box survives. Enter to commit a candidate must not send (handled by `isComposing` in Tasks 5 and 6).
- **Design:** swap the provisional `attention` token values in `packages/theme/src/tokens.ts` when Figma has them.
- **Next plans:** timeout follow-up (spec §5) and model suggestion (spec §4). The columns already exist.
