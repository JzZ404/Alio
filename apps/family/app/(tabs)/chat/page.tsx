'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatBubble,
  CircleHeaderCard,
  FAMILY_MEMBER_ID,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
  MessageActionSheet,
  MessageBubble,
  SUPABASE_THREAD_FOR_FAMILY,
  SuggestionCard,
  findOldest,
  markPending,
  sendMessage,
  suggestsPending,
  useFamilyMessages,
  type ThreadMessage,
} from '@alio/ui';
import {
  SAMPLE_FM_CHAT_THREADS,
  SAMPLE_FM_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';
import { supabase } from '@/lib/supabase';
import { ReportCard } from '@/components/ReportCard';

/** How long a bubble jumped to via "See all" stays highlighted. */
const HIGHLIGHT_MS = 1600;

/**
 * A family deals with one circle, not a list of threads: this screen *is*
 * the Chat tab now, always Sarah's thread about Erin.
 */
const THREAD_ID = 'sarah-caregiver';

/**
 * Family Chat tab — the Care Circle itself (spec 2026-09-17). Headed by
 * `CircleHeaderCard` naming the circle, its members, and what is still
 * marked and waiting on Sarah. Below it, the conversation is unchanged:
 * mock history then live messages, the long-press action sheet, the ALIO
 * SUGGESTS card, the send path with its error line.
 */
export default function FamilyChatConversationPage() {
  const supabaseThreadId = SUPABASE_THREAD_FOR_FAMILY[THREAD_ID];

  const [mockMessages, setMockMessages] = useState<ChatMessage[]>(
    SAMPLE_FM_CONVERSATIONS[THREAD_ID] ?? [],
  );
  const { messages: live, error, patch, upsert } = useFamilyMessages(
    supabase,
    supabaseThreadId ? { by: 'thread', threadId: supabaseThreadId } : null,
  );
  const [draft, setDraft] = useState('');
  // The screen's own root, so a long-press's viewport-space rect can be
  // converted into the action sheet's overlay coordinate space (Step 1) —
  // the same positioned ancestor the overlay's `absolute inset-0` resolves
  // against.
  const frameRef = useRef<HTMLDivElement>(null);
  const [sheetFor, setSheetFor] = useState<{ message: ThreadMessage; rect: DOMRect } | null>(null);
  // Suggestions waved off with "No need". That answer writes nothing to the
  // database by design (spec §4.3), so this is the only place it lives, and
  // it lasts as long as the screen does.
  const [dismissedSuggestions, setDismissedSuggestions] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Shared banner for both the send path and the Mark-as-Pending path below.
  // Every attempt clears it up front, so a retry never shows a stale message
  // left over from a different, now-resolved failure.
  const [sendError, setSendError] = useState('');
  // Set by "See all" to ring the jumped-to bubble; cleared on its own timer.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  // The message the ALIO SUGGESTS card is attached to (spec §4).
  //
  // This reads the loaded thread rather than firing on the INSERT this device
  // just made. That is both closer to what the classifier will actually do —
  // it scores messages, not send events — and the only way to look at the
  // card twice: the old version vanished on reload, so revising its design
  // meant sending a fresh matching message every time.
  //
  // Newest match wins (the hook orders by `created_at` ascending), and
  // only one card is ever on screen, so an old message cannot quietly sprout
  // a suggestion above the one you are reading.
  const suggestedFor = useMemo(() => {
    const matches = live.filter(
      (m) =>
        m.senderId === FAMILY_MEMBER_ID &&
        m.finalTier === null &&
        !dismissedSuggestions.has(m.id) &&
        suggestsPending(m.text),
    );
    return matches.length > 0 ? matches[matches.length - 1].id : null;
  }, [live, dismissedSuggestions]);

  // What Sarah is waiting on: this family member's own messages, marked and
  // not yet confirmed.
  const markedMessages = live.filter(
    (m) => m.finalTier === 'action' && m.acknowledgedAt === null && m.senderId === FAMILY_MEMBER_ID,
  );

  // The fixtures stay the source of truth for who's in the circle.
  const circleAvatars = SAMPLE_FM_CHAT_THREADS.find((t) => t.id === 'erin-circle')?.groupAvatars ?? [];

  // The pressed bubble's rect arrives in viewport coordinates; the sheet's
  // overlay is `absolute inset-0` inside `frameRef`, so its own coordinate
  // space is relative to that element's box, not the viewport. Recomputed
  // whenever the held message changes, using the frame's current rect.
  const anchor = useMemo(() => {
    if (!sheetFor || !frameRef.current) return null;
    const frameRect = frameRef.current.getBoundingClientRect();
    return {
      top: sheetFor.rect.top - frameRect.top,
      left: sheetFor.rect.left - frameRect.left,
      width: sheetFor.rect.width,
    };
  }, [sheetFor]);

  const handleLongPress = (message: ThreadMessage, rect: DOMRect) => setSheetFor({ message, rect });

  const handleSeeAll = () => {
    // Oldest by createdAt, never list order — `live` isn't sorted that way,
    // and assuming otherwise is exactly the bug that hit the Pending list.
    const target = findOldest(markedMessages);
    if (!target) return;
    document.querySelector(`[data-message-id="${target.id}"]`)?.scrollIntoView({ block: 'center' });
    setHighlightedId(target.id);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSendError('');
    if (!supabaseThreadId) {
      setMockMessages((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text }]);
      return;
    }
    try {
      const row = await sendMessage(supabase, {
        threadId: supabaseThreadId,
        senderId: FAMILY_MEMBER_ID,
        text,
        needsResponse: false,
      });
      upsert(row);
      setSendError('');
    } catch (e) {
      console.error(e);
      setDraft(text);
      setSendError("Message didn't send. Check your connection and try again.");
    }
  };

  const handleMarkPending = async (message: ThreadMessage) => {
    setSendError('');
    patch(message.id, { finalTier: 'action' });
    setSheetFor(null);
    try {
      await markPending(supabase, { messageId: message.id, taggedBy: 'sender_manual' });
      setSendError('');
    } catch (e) {
      console.error(e);
      patch(message.id, { finalTier: null }, { rollback: true });
      setSendError("Couldn't mark that as Pending. Check your connection and try again.");
    }
  };

  // Accepting the ALIO SUGGESTS card. Same optimistic patch and rollback as
  // the long-press path, but tagged sender_confirmed_ai — never
  // sender_manual — so the two entry points stay distinguishable later.
  const handleMarkSuggested = async (message: ThreadMessage) => {
    setSendError('');
    // No dismissal needed: the card's own condition is `finalTier === null`,
    // so tagging the message is what removes it. A rollback brings it back,
    // which is right — the suggestion was never answered.
    patch(message.id, { finalTier: 'action' });
    try {
      await markPending(supabase, { messageId: message.id, taggedBy: 'sender_confirmed_ai' });
      setSendError('');
    } catch (e) {
      console.error(e);
      patch(message.id, { finalTier: null }, { rollback: true });
      setSendError("Couldn't mark that as Pending. Check your connection and try again.");
    }
  };

  // "No need" writes nothing — the suggestion is just dismissed from view.
  const handleDismissSuggestion = (messageId: string) =>
    setDismissedSuggestions((prev) => new Set(prev).add(messageId));

  const handleCopy = async (message: ThreadMessage) => {
    setSendError('');
    try {
      await navigator.clipboard.writeText(message.text);
    } catch (e) {
      console.error(e);
    }
    setSheetFor(null);
  };

  return (
    <div
      ref={frameRef}
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Care Circle header — name, members, and what's still waiting on Sarah */}
      <div className="absolute left-[16px] right-[16px] top-[60px] z-10">
        <CircleHeaderCard
          name="Sarah Lee"
          subtitle="Caregiver · Erin's circle"
          avatars={circleAvatars}
          markedCount={markedMessages.length}
          onSeeAll={handleSeeAll}
          // Adding someone to a circle is unspecified — an inert placeholder,
          // the same way Reply sits inert in the message action sheet.
          onAdd={() => {}}
        />
      </div>

      {/* Messages — start below the card; the card's own height (pinned row
          shown or not) sets where this region begins. */}
      <div
        className={`absolute bottom-[120px] left-0 right-0 overflow-y-auto px-[16px] py-[12px] ${
          markedMessages.length > 0 ? 'top-[196px]' : 'top-[150px]'
        }`}
      >
        {/* An unreachable backend must not read as an empty thread. This sits
            above whatever did load rather than replacing it. */}
        {error && (
          <p className="mb-[12px] text-center text-[13px] text-gray-60">
            {"Couldn't load — check your connection"}
          </p>
        )}
        {!error && mockMessages.length === 0 && live.length === 0 ? (
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
                <div key={m.id} className="flex flex-col">
                  <MessageBubble
                    message={m}
                    viewerId={FAMILY_MEMBER_ID}
                    onLongPress={m.senderId === FAMILY_MEMBER_ID ? handleLongPress : undefined}
                    highlighted={m.id === highlightedId}
                  />
                  {/*
                   * ALIO SUGGESTS (spec §4): only on the family member's own
                   * message, only while it is still untagged — the moment
                   * finalTier is set, by this card or by the long-press path,
                   * the card stops rendering rather than lingering.
                   */}
                  {suggestedFor === m.id && m.senderId === FAMILY_MEMBER_ID && m.finalTier === null && (
                    <SuggestionCard
                      onMark={() => handleMarkSuggested(m)}
                      onDismiss={() => handleDismissSuggestion(m.id)}
                    />
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Quick actions row */}
      <div className="absolute bottom-[72px] left-0 right-0 flex items-center justify-center gap-[10px] px-[16px]">
        <QuickAction icon={IconReminder} label="Send Notes" />
        <QuickAction icon={IconRefresh} label="Status Update" />
        <QuickAction icon={IconProfile} label="Contact" />
      </div>

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

          <div className="flex h-[44px] flex-1 items-center gap-2 rounded-full bg-white/70 px-[14px]">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // isComposing: Enter that commits an IME candidate must not send.
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
              }}
              placeholder="Message Sarah"
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
            aria-label="Send"
            onClick={handleSend}
            className="flex size-[44px] items-center justify-center rounded-[12px] bg-white/70 transition-colors active:bg-white"
          >
            <IconPlus className="size-[22px] text-gray-100" />
          </button>
        </div>
      </div>

      <MessageActionSheet
        message={sheetFor?.message ?? null}
        anchor={anchor}
        viewerId={FAMILY_MEMBER_ID}
        onMarkPending={handleMarkPending}
        onCopy={handleCopy}
        onClose={() => setSheetFor(null)}
      />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex h-[34px] items-center gap-[6px] rounded-full border border-brand-border bg-white/40 px-[12px] transition-colors active:bg-white/70"
    >
      <Icon className="size-[16px] text-gray-100" />
      <span className="text-[12px] font-bold text-gray-100">{label}</span>
    </button>
  );
}
