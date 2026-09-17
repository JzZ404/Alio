'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Which messages turned up *after* the thread was first loaded.
 *
 * A screen uses this to animate an arriving message without animating the
 * whole thread every time it opens: the first non-empty batch is taken as
 * what was already there, and everything after it counts as new.
 *
 * The cost of that rule is one case: in a thread with no history at all, the
 * very first message is treated as the seed and does not animate. Waiting for
 * the first batch is still the right trade, because the alternative — seeding
 * on mount, when `messages` is always empty — would animate every message in
 * every thread on every open.
 */
export function useArrivedIds(messages: ReadonlyArray<{ id: string }>): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null);
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (known.current === null) {
      if (messages.length === 0) return;
      known.current = new Set(messages.map((m) => m.id));
      return;
    }
    const fresh = messages.filter((m) => !known.current!.has(m.id)).map((m) => m.id);
    if (fresh.length === 0) return;
    for (const id of fresh) known.current.add(id);
    setArrived((prev) => new Set([...prev, ...fresh]));
  }, [messages]);

  return arrived;
}
