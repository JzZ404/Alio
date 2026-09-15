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

### Task 7: The Pending list

Completes spec build-order step 2.

**Files:**
- Create: `packages/ui/src/PendingCard.tsx`
- Test: `packages/ui/src/PendingCard.test.tsx`
- Create: `apps/caregiver/components/PendingScreen.tsx`
- Modify: `apps/caregiver/app/(tabs)/layout.tsx` (lines 13–18, 54, 56)
- Modify: `apps/caregiver/app/(tabs)/home/page.tsx` (signature, bell `onClick`)
- Modify: `apps/caregiver/app/(tabs)/chat/[id]/page.tsx` (focus + highlight)
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `selectPending`, `selectRecentlyConfirmed`, `waitingLabel`, `formatMessageTime`, `useFamilyMessages`, `acknowledgeMessage`, `CAREGIVER_ID`, `CAREGIVER_THREAD_FOR_SUPABASE`, `ThreadMessage`
- Produces:
  - `PendingCard({ message: ThreadMessage; now: Date; onOpen: (message: ThreadMessage) => void; onConfirm?: (messageId: string) => void; leaving?: boolean })`
  - `PendingScreen({ onBack: () => void; onOpenMessage: (message: ThreadMessage) => void })`
  - Layout `SubPage` gains `{ type: 'pending' }`; the chat variant gains `focusMessageId?: string; from?: 'pending'`
  - `CaregiverHomePage` accepts `{ onOpenPending?: () => void }` and its bell calls it

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/src/PendingCard.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PendingCard } from './PendingCard';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const NOW = new Date('2026-09-15T12:00:00Z');
const LONG_TEXT =
  'Please pick up her prescription on the way back, order 4471 at the Walgreens on 45th — ' +
  'they close at six, and ask the pharmacist whether the new dose replaces the old bottle.';

const pending: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: LONG_TEXT,
  reportId: null,
  finalTier: 'action',
  acknowledgedAt: null,
  createdAt: '2026-09-15T07:00:00Z',
};

describe('PendingCard', () => {
  it('shows sender, the full untruncated text and how long it has waited', () => {
    render(<PendingCard message={pending} now={NOW} onOpen={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText('Janet Chen')).toBeTruthy();
    expect(screen.getByText(LONG_TEXT)).toBeTruthy();
    expect(screen.getByText('Waiting 5 hours')).toBeTruthy();
  });

  it('hides the waiting label before two hours', () => {
    render(
      <PendingCard
        message={{ ...pending, createdAt: '2026-09-15T11:00:00Z' }}
        now={NOW}
        onOpen={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText(/Waiting/)).toBeNull();
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

  it('shows Confirmed and no button once acknowledged', () => {
    render(
      <PendingCard
        message={{ ...pending, acknowledgedAt: '2026-09-15T11:00:00Z' }}
        now={NOW}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.queryByText(/Waiting/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — `Failed to resolve import "./PendingCard"`.

- [ ] **Step 3: Implement `PendingCard`**

Create `packages/ui/src/PendingCard.tsx`:

```tsx
import clsx from 'clsx';
import { formatMessageTime, waitingLabel } from './messaging/pending';
import type { ThreadMessage } from './messaging/types';

/**
 * One item in the Pending list (spec §3). The text is never truncated — the
 * caregiver must be able to act without leaving the screen. The body opens the
 * message in its thread; only the button confirms.
 */
export function PendingCard({
  message,
  now,
  onOpen,
  onConfirm,
  leaving = false,
}: {
  message: ThreadMessage;
  now: Date;
  onOpen: (message: ThreadMessage) => void;
  onConfirm?: (messageId: string) => void;
  leaving?: boolean;
}) {
  const confirmed = message.acknowledgedAt !== null;
  const waiting = confirmed ? null : waitingLabel(message.createdAt, now);

  return (
    <article
      className={clsx(
        'rounded-2xl bg-white px-[16px] py-[14px] transition-all duration-300 ease-out',
        leaving && 'translate-x-6 opacity-0',
        confirmed && 'opacity-70',
      )}
    >
      <button type="button" onClick={() => onOpen(message)} className="block w-full text-left">
        <span className="flex items-baseline justify-between gap-[8px]">
          <span className="text-[14px] font-bold text-gray-100">{message.senderName}</span>
          <time dateTime={message.createdAt} className="shrink-0 text-[12px] text-gray-60">
            {formatMessageTime(message.createdAt)}
          </time>
        </span>
        {waiting && (
          <span className="mt-[2px] block text-[12px] font-bold text-attention-text">{waiting}</span>
        )}
        <span className="mt-[8px] block whitespace-pre-wrap text-[14px] leading-snug text-gray-100">
          {message.text}
        </span>
      </button>

      {confirmed ? (
        <p className="mt-[10px] text-[12px] font-bold text-gray-60">Confirmed</p>
      ) : (
        onConfirm && (
          <button
            type="button"
            onClick={() => onConfirm?.(message.id)}
            className="mt-[12px] h-[42px] w-full rounded-lg bg-brand-primary text-[14px] font-bold text-white transition-colors active:bg-brand-active"
          >
            Confirm
          </button>
        )
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS, 27 tests.

In `packages/ui/src/index.ts`, after the `NeedsResponseToggle` export, add:

```ts
export { PendingCard } from './PendingCard';
```

- [ ] **Step 5: Build the screen**

Create `apps/caregiver/components/PendingScreen.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  CAREGIVER_ID,
  IconBox,
  IconChevronDown,
  IconChevronLeft,
  PendingCard,
  acknowledgeMessage,
  selectPending,
  selectRecentlyConfirmed,
  useFamilyMessages,
  type ThreadMessage,
} from '@alio/ui';
import { supabase } from '@/lib/supabase';

const CONFIRMED_DAYS = 7;
const LEAVE_MS = 300;

/** Re-renders every `intervalMs` so "Waiting N hours" stays current. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * The Pending list (spec §3) — a view over family_messages, not a store.
 * Oldest first; confirming animates the card out into the collapsed Confirmed
 * section, which stays open when nothing is pending so the screen never dead-ends.
 */
export function PendingScreen({
  onBack,
  onOpenMessage,
}: {
  onBack: () => void;
  onOpenMessage: (message: ThreadMessage) => void;
}) {
  const since = useMemo(() => new Date(Date.now() - CONFIRMED_DAYS * 24 * 60 * 60 * 1000), []);
  const { messages, patch } = useFamilyMessages(supabase, {
    by: 'recipient',
    recipientId: CAREGIVER_ID,
    since,
  });
  const now = useNow(60_000);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [error, setError] = useState('');

  const pending = selectPending(messages, CAREGIVER_ID);
  const confirmed = selectRecentlyConfirmed(messages, CAREGIVER_ID, now, CONFIRMED_DAYS);
  const confirmedOpen = showConfirmed || pending.length === 0;

  async function handleConfirm(messageId: string) {
    const at = new Date();
    setError('');
    setLeaving((prev) => new Set(prev).add(messageId));
    const outcome = acknowledgeMessage(supabase, { messageId, userId: CAREGIVER_ID, at }).then(
      () => null,
      (e: unknown) => e,
    );
    await new Promise((resolve) => window.setTimeout(resolve, LEAVE_MS));
    patch(messageId, { acknowledgedAt: at.toISOString() });
    setLeaving((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    const failure = await outcome;
    if (failure) {
      console.error(failure);
      patch(messageId, { acknowledgedAt: null });
      setError("Couldn't confirm. Check your connection and tap Confirm again.");
    }
  }

  return (
    <div
      className="relative min-h-full pb-32"
      style={{
        background: 'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <header className="flex items-center gap-[12px] px-[25px] pt-[60px]">
        <IconBox size={42} shape="pill" aria-label="Back" onClick={onBack}>
          <IconChevronLeft className="size-[20px] text-gray-100" />
        </IconBox>
        <h1 className="text-[20px] font-bold text-gray-100">Pending</h1>
      </header>

      {error && (
        <p role="alert" className="mt-[12px] px-[25px] text-[12px] font-bold text-alert">
          {error}
        </p>
      )}

      <section className="mt-[20px] flex flex-col gap-[10px] px-[16px]">
        {pending.length === 0 ? (
          <p className="py-[24px] text-center text-[14px] text-gray-60">Nothing pending</p>
        ) : (
          pending.map((m) => (
            <PendingCard
              key={m.id}
              message={m}
              now={now}
              leaving={leaving.has(m.id)}
              onConfirm={handleConfirm}
              onOpen={onOpenMessage}
            />
          ))
        )}
      </section>

      {confirmed.length > 0 && (
        <section className="mt-[24px] px-[16px]">
          <button
            type="button"
            aria-expanded={confirmedOpen}
            onClick={() => setShowConfirmed((v) => !v)}
            className="flex w-full items-center justify-between px-[4px] py-[8px] text-[14px] font-bold text-gray-60"
          >
            Confirmed
            <IconChevronDown
              aria-hidden
              className={clsx('size-[18px] transition-transform', confirmedOpen && 'rotate-180')}
            />
          </button>
          {confirmedOpen && (
            <div className="mt-[8px] flex flex-col gap-[10px]">
              {confirmed.map((m) => (
                <PendingCard key={m.id} message={m} now={now} onOpen={onOpenMessage} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire it into the layout**

In `apps/caregiver/app/(tabs)/layout.tsx`, add after the `ReportDetail` dynamic import (line 14):

```tsx
const PendingScreen = dynamic(
  () => import('@/components/PendingScreen').then((m) => m.PendingScreen),
  { ssr: false },
);
```

Add to the imports at the top:

```tsx
import { CAREGIVER_THREAD_FOR_SUPABASE } from '@alio/ui';
```

Replace the `SubPage` type (line 18) with:

```tsx
type SubPage =
  | { type: 'chat'; id: string; focusMessageId?: string; from?: 'pending' }
  | { type: 'report'; id: string }
  | { type: 'pending' }
  | null;
```

Replace the `ChatDetail` line (line 54) with these two lines:

```tsx
          {subPage?.type === 'chat'    && <ChatDetail   id={subPage.id} focusMessageId={subPage.focusMessageId} onBack={() => setSubPage(subPage.from === 'pending' ? { type: 'pending' } : null)} onOpenPending={() => setSubPage({ type: 'pending' })} />}
          {subPage?.type === 'pending' && <PendingScreen onBack={() => setSubPage(null)} onOpenMessage={(m) => { const chatId = CAREGIVER_THREAD_FOR_SUPABASE[m.threadId]; if (chatId) setSubPage({ type: 'chat', id: chatId, focusMessageId: m.id, from: 'pending' }); }} />}
```

Replace the `HomeTab` line (line 56) with:

```tsx
          {!subPage && active === 'home'     && <HomeTab onOpenPending={() => setSubPage({ type: 'pending' })} />}
```

In `apps/caregiver/app/(tabs)/home/page.tsx`, change the component signature from:

```tsx
export default function CaregiverHomePage() {
```

to:

```tsx
export default function CaregiverHomePage({ onOpenPending }: { onOpenPending?: () => void } = {}) {
```

and add `onClick={onOpenPending}` to the `aria-label="Notifications"` button, directly after `type="button"`. The badge still shows mock data until Task 9.

- [ ] **Step 7: Scroll to and highlight the focused message**

In `apps/caregiver/app/(tabs)/chat/[id]/page.tsx`, change the React import to:

```tsx
import { useEffect, useRef, useState } from 'react';
```

After `handleConfirm`, add:

```tsx
  // Arriving from the Pending list: once the message has rendered, scroll it
  // into view and highlight it briefly (spec §3). Runs once per visit.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const focused = useRef(false);
  useEffect(() => {
    if (!focusMessageId || focused.current) return;
    const el = document.querySelector(`[data-message-id="${focusMessageId}"]`);
    if (!el) return; // not loaded yet; runs again when `live` changes
    focused.current = true;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightedId(focusMessageId);
    const timer = window.setTimeout(() => setHighlightedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, live]);
```

In the live messages map, add the prop to `MessageBubble`:

```tsx
                highlighted={highlightedId === m.id}
```

- [ ] **Step 8: Typecheck and test**

Run: `pnpm --filter @alio/ui test && pnpm --filter @alio/ui typecheck && pnpm --filter @alio/caregiver typecheck`
Expected: 27 tests pass; `@alio/ui` clean; caregiver shows the three pre-existing `PageProps` errors plus **one new one for `home/page.ts`**, from the `onOpenPending` prop. It is the same pattern as the other seven across both apps (see `docs/restructure-2026-09-02.md` → Deliberately not done), and `ignoreBuildErrors: true` keeps builds green. `components/PendingScreen.tsx` is not a route, so it adds none.

- [ ] **Step 9: Verify in the browser**

1. From the family app, send three tagged messages a few seconds apart: `First`, `Second`, `Third`.
2. Caregiver Home → tap the bell. The Pending screen lists them **First, Second, Third** — oldest on top — each with sender, time, full text and **Confirm**.
3. Tap **Confirm** on `Second`. It slides out, and **Confirmed** appears below with `Second` in it.
4. Tap the body of `First`. The Janet thread opens, scrolls to `First` and rings it for about a second and a half. Tap Back: you return to Pending, not Home.
5. Confirm the remaining two. **Nothing pending** shows, with the Confirmed section open beneath it.
6. In Supabase, set one confirmed row's `created_at` to eight hours ago and its `acknowledged_at` to null. It returns to Pending showing **Waiting 8 hours**.

- [ ] **Step 10: Commit**

```bash
git add packages/ui apps/caregiver
git commit -m "feat(caregiver): add the Pending list

Spec build step 2. A view over family_messages: oldest first, full text,
Waiting N hours after two hours, Confirm animates into a 7-day Confirmed
section, and tapping a card opens the message in its thread, highlighted.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Pinned bar in the chat thread

Completes spec build-order step 3.

**Files:**
- Create: `packages/ui/src/PendingPinnedBar.tsx`
- Test: `packages/ui/src/PendingPinnedBar.test.tsx`
- Modify: `apps/caregiver/app/(tabs)/chat/[id]/page.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `pinnedBarLabel` (Task 2), `onOpenPending` prop (Task 6), layout wiring (Task 7)
- Produces: `PendingPinnedBar({ label: string | null; onOpen: () => void })` — renders nothing when `label` is null

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/src/PendingPinnedBar.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PendingPinnedBar } from './PendingPinnedBar';

afterEach(cleanup);

describe('PendingPinnedBar', () => {
  it('renders nothing when nothing is pending', () => {
    const { container } = render(<PendingPinnedBar label={null} onOpen={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the label and opens the Pending list on tap', () => {
    const onOpen = vi.fn();
    render(
      <PendingPinnedBar label="1 pending · Pick up prescription, order 4471" onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /1 pending/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @alio/ui test`
Expected: FAIL — `Failed to resolve import "./PendingPinnedBar"`.

- [ ] **Step 3: Implement it**

Create `packages/ui/src/PendingPinnedBar.tsx`:

```tsx
import { IconPinFilled } from './icons';

/**
 * Thread pinned bar (spec §2.2): count plus the longest-waiting item. Exists
 * only while something is pending — never a permanent fixture. Truncating the
 * preview is fine here; the list it opens shows full text.
 */
export function PendingPinnedBar({
  label,
  onOpen,
}: {
  label: string | null;
  onOpen: () => void;
}) {
  if (label === null) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-[10px] rounded-2xl border border-attention-border bg-attention-surface px-[14px] py-[10px] text-left text-attention-text"
    >
      <IconPinFilled aria-hidden className="size-[18px] shrink-0" />
      <span className="truncate text-[14px] font-bold">{label}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @alio/ui test`
Expected: PASS, 29 tests.

In `packages/ui/src/index.ts`, after the `PendingCard` export, add:

```ts
export { PendingPinnedBar } from './PendingPinnedBar';
```

- [ ] **Step 5: Put it in the thread**

In `apps/caregiver/app/(tabs)/chat/[id]/page.tsx`, add `PendingPinnedBar` and `pinnedBarLabel` to the `@alio/ui` import list. After the `highlightedId` effect, add:

```tsx
  const pinnedLabel = pinnedBarLabel(live, CAREGIVER_ID);
```

Directly after the closing `</header>`, add:

```tsx
      {onOpenPending && pinnedLabel && (
        <div className="absolute left-[16px] right-[16px] top-[114px] z-10">
          <PendingPinnedBar label={pinnedLabel} onOpen={onOpenPending} />
        </div>
      )}
```

Change the messages container's opening tag from:

```tsx
      <div className="absolute bottom-[120px] left-0 right-0 top-[129px] overflow-y-auto px-[16px] py-[12px]">
```

to:

```tsx
      <div
        className={`absolute bottom-[120px] left-0 right-0 overflow-y-auto px-[16px] py-[12px] ${
          onOpenPending && pinnedLabel ? 'top-[172px]' : 'top-[129px]'
        }`}
      >
```

- [ ] **Step 6: Verify**

Run: `pnpm --filter @alio/caregiver typecheck`
Expected: only the four `PageProps` errors present after Task 7 (`chat/[id]/page.ts`, `chat/page.ts`, `logs/page.ts`, `home/page.ts`).

In the browser:
1. With nothing pending, open the Janet thread. No bar.
2. From the family app, tag and send `Pick up prescription, order 4471`. The bar appears live: `1 pending · Pick up prescription, order 4471`.
3. Tag and send `Call me after lunch`. The bar reads `2 pending · Pick up prescription, order 4471` — still the oldest.
4. Tap the bar. The Pending list opens.
5. Confirm both, go back to the thread. The bar is gone.

- [ ] **Step 7: Commit**

```bash
git add packages/ui "apps/caregiver/app/(tabs)/chat/[id]/page.tsx"
git commit -m "feat(caregiver): pin the longest-waiting item to the top of the thread

Spec build step 3. Shows only while something is pending and opens the
Pending list.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Home bell badge, and final verification

Completes spec build-order step 4.

**Files:**
- Modify: `apps/caregiver/app/(tabs)/home/page.tsx` (top of file through `const router = useRouter();`, and the bell button)

**Interfaces:**
- Consumes: `useFamilyMessages`, `selectPending`, `formatBadge`, `CAREGIVER_ID`; `onOpenPending` prop and layout wiring (Task 7)

- [ ] **Step 1: Read the pending count on Home**

In `apps/caregiver/app/(tabs)/home/page.tsx`, replace everything from the top of the file through `const router = useRouter();` with:

```tsx
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CAREGIVER_ID,
  PatientCard,
  IconBox,
  IconProfile,
  IconNotificationFilled,
  IconPlus,
  formatBadge,
  selectPending,
  useFamilyMessages,
} from '@alio/ui';
import { SAMPLE_PATIENTS, SAMPLE_CG_USER } from '@alio/mock-data';
import { supabase } from '@/lib/supabase';

/**
 * Caregiver Home — Figma CG-Home (390:4831) + CG-Home-patientcarddropdown (390:4151).
 *
 * Layout (top to bottom):
 *   1. User header (caregiver avatar + name + role + profile + Pending bell)
 *   2. "Upcoming Schedule" title + add button
 *   3. List of patient cards (first is expanded by default)
 *
 * The bell sits outside the dashboard's flag stream on purpose (spec §2.1).
 */
export default function CaregiverHomePage({ onOpenPending }: { onOpenPending?: () => void } = {}) {
  const router = useRouter();
  // Home needs only the pending count, so load no confirmed history.
  const since = useMemo(() => new Date(), []);
  const { messages } = useFamilyMessages(supabase, {
    by: 'recipient',
    recipientId: CAREGIVER_ID,
    since,
  });
  const pendingCount = selectPending(messages, CAREGIVER_ID).length;
  const badge = formatBadge(pendingCount);
```

- [ ] **Step 2: Turn the notifications button into the Pending bell**

Replace the `aria-label="Notifications"` `<button>`, from its opening tag through `</button>`, with:

```tsx
        <button
          type="button"
          aria-label={badge ? `Pending, ${pendingCount}` : 'Pending'}
          onClick={onOpenPending}
          className="relative flex size-[42px] items-center justify-center rounded-lg bg-brand-tint-1 transition-colors active:bg-brand-border"
        >
          <IconNotificationFilled className="size-[22px] text-gray-100" />
          {badge && (
            <span className="absolute -right-[4px] -top-[4px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-primary px-[4px] text-[11px] font-bold text-white">
              {badge}
            </span>
          )}
        </button>
```

`SAMPLE_CG_USER.notifications` is no longer read here. Leave it in `packages/mock-data` — that file is also being edited on `renew-ui-sep02`.

- [ ] **Step 3: Verify the bell**

With `pnpm dev` running:
1. Confirm everything pending. Home shows the bell with **no badge**.
2. From the family app, tag and send one message. The badge shows **1** live, without a reload.
3. Tap the bell. The Pending list opens. Tap Back. Home.
4. Tag and send ten more. The badge reads **9+**.
5. Confirm one from the thread bubble. The badge count drops on returning to Home.

- [ ] **Step 4: Full verification**

Run:

```bash
pnpm test
pnpm -r typecheck
pnpm -r build
cd backend && pytest && cd ..
```

Expected:
- `pnpm test` — 29 tests pass in `@alio/ui`.
- `pnpm -r typecheck` — `@alio/mock-data`, `@alio/theme`, `@alio/ui` clean. The apps report only `PageProps` errors in `.next/types`: the seven that existed on `main` plus the one for `home/page.ts` added in Task 7 — eight total, one root cause.
- `pnpm -r build` — both apps build.
- `pytest` — 21 passed. Nothing in `backend/` changed.

Then grep the new code for the spec's banned vocabulary:

```bash
git diff main --name-only | grep -E '\.(ts|tsx|sql)$' \
  | xargs grep -n -i -E '\b(ticket|approv|inbox|notification hub)' || echo "clean"
```

Expected: `clean`. (Docs are excluded because the spec and this plan name the banned terms in order to ban them.)

- [ ] **Step 5: Commit**

```bash
git add "apps/caregiver/app/(tabs)/home/page.tsx"
git commit -m "feat(caregiver): show the pending count on the Home bell

Spec build step 4. No badge at zero, caps at 9+, opens the Pending list.
Completes the human loop: tag, Confirm in the bubble, Pending list, pinned
bar, bell.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## After this plan

- **Open a pull request** from `feat/pending-confirmations` into `main` for review, rather than pushing to `main`.
- **Real-device check (spec §10):** on an iPhone with a Chinese input method, start composing, tap the **!** toggle mid-composition, and confirm the candidate box survives. Enter to commit a candidate must not send (handled by `isComposing` in Tasks 5 and 6).
- **Design:** swap the provisional `attention` token values in `packages/theme/src/tokens.ts` when Figma has them.
- **Next plans:** timeout follow-up (spec §5) and model suggestion (spec §4). The columns already exist.
