import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from './types';
import { CAREGIVER_ID, FAMILY_MEMBER_ID, otherParticipant, personLabel } from './participants';
import {
  formatBadge,
  formatMessageDate,
  formatMessageTime,
  isPendingFor,
  mergeMessage,
  selectPending,
  selectRecentlyConfirmed,
  waitingLabel,
  oldestWaitingLabel,
  waitingSinceLabel,
  confirmedRecencyLabel,
  groupConfirmedByDay,
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
  it('returns the newest item first (revised 2026-09-17)', () => {
    const newer = msg({ id: 'newer', createdAt: '2026-09-15T11:00:00Z' });
    const older = msg({ id: 'older', createdAt: '2026-09-15T08:00:00Z' });
    const confirmed = msg({ id: 'done', acknowledgedAt: '2026-09-15T11:30:00Z' });
    expect(selectPending([older, confirmed, newer], CAREGIVER_ID).map((m) => m.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('orders by instant, not by string, when offsets are written differently', () => {
    // 2026-09-14T20:00:00+12:00 is 2026-09-14T08:00:00Z (earlier).
    // 2026-09-14T09:00:00-11:00 is 2026-09-14T20:00:00Z (later).
    // Lexicographically '20' > '09' so the older item's string sorts after
    // the newer item's — a naive descending string sort would put the older
    // item first. Instant comparison must get this right.
    const older = msg({ id: 'older', createdAt: '2026-09-14T20:00:00+12:00' });
    const newer = msg({ id: 'newer', createdAt: '2026-09-14T09:00:00-11:00' });
    expect(selectPending([older, newer], CAREGIVER_ID).map((m) => m.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('finds the oldest item for the waiting labels regardless of the newest-first order (the ordering trap)', () => {
    const oldest = msg({ id: 'oldest', createdAt: '2026-09-15T09:14:00Z' });
    const middle = msg({ id: 'middle', createdAt: '2026-09-15T10:30:00Z' });
    const newest = msg({ id: 'newest', createdAt: '2026-09-15T11:50:00Z' });
    const pending = selectPending([middle, newest, oldest], CAREGIVER_ID);

    // selectPending is newest first...
    expect(pending.map((m) => m.id)).toEqual(['newest', 'middle', 'oldest']);

    // ...but the header and the "waiting since" label must still describe
    // the OLDEST item, not pending[0]. If either helper started indexing
    // into the list instead of searching it, this would report a ~10 minute
    // wait and a ~11:50 AM start time instead of the ~2h45m / 9:14 AM truth.
    expect(oldestWaitingLabel(pending, NOW)).toBe('Oldest: 2h');
    expect(waitingSinceLabel(pending, 'UTC')).toBe('Waiting since 9:14 AM');
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

describe('formatMessageDate', () => {
  it('formats as a short month and day', () => {
    expect(formatMessageDate('2026-09-14T16:41:00Z', 'UTC')).toBe('Sep 14');
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

  it('never un-tags a message because of a stale event', () => {
    const tagged = msg({ finalTier: 'action' });
    const staleUntagged = msg({ finalTier: null });
    expect(mergeMessage([tagged], staleUntagged)[0].finalTier).toBe('action');
  });

  it('keeps a confirmed item in exactly one list when the stale row is also untagged', () => {
    // The interaction is the dangerous case: carrying acknowledgedAt forward
    // while letting finalTier revert produces a row that isPendingFor rejects
    // (no tag) *and* selectRecentlyConfirmed rejects (it requires 'action'),
    // so the caregiver's evidence that they responded simply vanishes.
    const confirmed = msg({ finalTier: 'action', acknowledgedAt: '2026-09-15T10:00:00Z' });
    const stale = msg({ finalTier: null, acknowledgedAt: null });
    const [merged] = mergeMessage([confirmed], stale);

    expect(merged.finalTier).toBe('action');
    expect(merged.acknowledgedAt).toBe('2026-09-15T10:00:00Z');
    expect(selectPending([merged], CAREGIVER_ID)).toHaveLength(0);
    expect(selectRecentlyConfirmed([merged], CAREGIVER_ID, NOW)).toHaveLength(1);
  });
});

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

  it('orders by instant, not by string, when offsets are written differently', () => {
    // 2026-09-14T20:00:00+12:00 is 2026-09-14T08:00:00Z (08:00 UTC, earlier)
    // 2026-09-14T09:00:00-11:00 is 2026-09-14T20:00:00Z (20:00 UTC, later)
    // Lexicographically '20' > '09' so the first sorts later as a string,
    // but chronologically it is 12 hours earlier. A naive string compare would
    // get this backwards.
    const early = msg({ id: 'early', acknowledgedAt: '2026-09-14T20:00:00+12:00' });
    const late = msg({ id: 'late', acknowledgedAt: '2026-09-14T09:00:00-11:00' });
    const groups = groupConfirmedByDay([early, late], NOW);
    expect(groups.map((g) => g.label)).toEqual(['YESTERDAY']);
    expect(groups[0].items.map((m) => m.id)).toEqual(['late', 'early']);
  });

  it('returns nothing when there is nothing confirmed', () => {
    expect(groupConfirmedByDay([], NOW)).toEqual([]);
  });
});
