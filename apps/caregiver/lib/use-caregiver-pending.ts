'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  CAREGIVER_ID,
  selectPending,
  selectRecentlyConfirmed,
  useFamilyMessages,
} from '@alio/ui';
import { supabase } from './supabase';
import {
  demoConfirmationsVersion,
  demoConfirmed,
  demoPending,
  subscribeDemoConfirmations,
} from './pending-fixtures';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What the caregiver has waiting and what they have confirmed — for every
 * surface that shows either: the Home bell (spec §2.1), the Inbox cards
 * (§2.2) and the Pending screen (§3).
 *
 * One helper rather than a copy per screen. Three copies of this merge is
 * three chances for the bell to disagree with the screen it opens, which is
 * exactly what happened while the bell read a hardcoded fixture instead.
 *
 * Live Supabase rows first, then the demo fixtures, everything re-sorted
 * through the same two selectors, so ordering and membership are identical
 * wherever they are read.
 *
 * `error` comes straight from the hook, for the surfaces that have room to
 * say so — the Inbox cards and the Pending screen both render a line instead
 * of a confident zero. The Home bell deliberately does not: a badge can only
 * show a number, and a number cannot express "I don't know". It keeps
 * counting what it has, and the screen it opens tells the truth.
 */
export function useCaregiverPending(now: Date) {
  const since = useMemo(() => new Date(Date.now() - SEVEN_DAYS_MS), []);
  const { messages, error, patch } = useFamilyMessages(supabase, {
    by: 'recipient',
    recipientId: CAREGIVER_ID,
    since,
  });

  // Demo confirmations are held outside React (see `pending-fixtures`), so
  // every mounted surface has to be told when one lands.
  useSyncExternalStore(subscribeDemoConfirmations, demoConfirmationsVersion, () => 0);

  const pending = selectPending([...messages, ...demoPending()], CAREGIVER_ID);
  const confirmed = selectRecentlyConfirmed(
    [...messages, ...demoConfirmed()],
    CAREGIVER_ID,
    now,
  );

  return { pending, confirmed, error, patch };
}
