'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChatBubble,
  IconBox,
  IconChevronLeft,
  IconSearch,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
} from '@alio/ui';
import {
  SAMPLE_FM_CHAT_THREADS,
  SAMPLE_FM_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';
import { supabase, type FamilyMessageRow } from '@/lib/supabase';
import { ReportCard } from '@/components/ReportCard';

// Map a family-side chat thread ID to the Supabase thread_id that the
// caregiver app writes to. Add entries as more caregivers/patients come online.
const SUPABASE_THREAD_FOR: Record<string, string | undefined> = {
  'sarah-caregiver': 'caregiver-001__dorothy-chen',
};

/**
 * Family Chat conversation — same layout as Caregiver Chat conversation,
 * just sourcing from the family fixture (`SAMPLE_FM_*`).
 */
export default function FamilyChatConversationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const thread = SAMPLE_FM_CHAT_THREADS.find((t) => t.id === id);
  const initial = SAMPLE_FM_CONVERSATIONS[id] ?? [];
  const supabaseThreadId = SUPABASE_THREAD_FOR[id];

  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  // messageId -> compiled_reports.id, for messages that should render as a
  // structured ReportCard instead of a plain chat bubble.
  const [reportIdByMessage, setReportIdByMessage] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');

  // Subscribe to live messages from the caregiver app via Supabase realtime.
  // Initial fetch loads any messages we missed before the subscription opened.
  useEffect(() => {
    if (!supabaseThreadId) return;

    let cancelled = false;
    const seen = new Set<string>();

    const toChatMessage = (row: FamilyMessageRow): ChatMessage => ({
      id: row.id,
      sender: 'them',
      text: row.text,
    });

    (async () => {
      const { data } = await supabase
        .from('family_messages')
        .select('*')
        .eq('thread_id', supabaseThreadId)
        .order('created_at');
      if (cancelled || !data) return;
      const fresh = (data as FamilyMessageRow[]).filter((r) => !seen.has(r.id));
      fresh.forEach((r) => seen.add(r.id));
      setMessages((prev) => [...prev, ...fresh.map(toChatMessage)]);
      setReportIdByMessage((prev) => {
        const next = { ...prev };
        for (const r of fresh) if (r.report_id) next[r.id] = r.report_id;
        return next;
      });
    })();

    const channel = supabase
      .channel(`family_messages:${supabaseThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_messages',
          filter: `thread_id=eq.${supabaseThreadId}`,
        },
        (payload) => {
          const row = payload.new as FamilyMessageRow;
          if (seen.has(row.id)) return;
          seen.add(row.id);
          setMessages((prev) => [...prev, toChatMessage(row)]);
          if (row.report_id) {
            setReportIdByMessage((prev) => ({ ...prev, [row.id]: row.report_id! }));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabaseThreadId]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, sender: 'me', text },
    ]);
    setDraft('');
  };

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — back + avatar + name/status + search, at top-60 */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center gap-[12px]">
        <IconBox
          size={42}
          shape="pill"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <IconChevronLeft className="size-[20px] text-gray-100" />
        </IconBox>

        <span className="relative flex size-[42px] shrink-0">
          {thread?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thread.avatarUrl}
              alt={thread.name}
              className="size-full rounded-full object-cover"
              width={42}
              height={42}
            />
          ) : (
            <span className="size-full rounded-full bg-gray-30" />
          )}
          {thread?.status === 'online' && (
            <span className="absolute bottom-0 right-0 size-[10px] rounded-full border-2 border-brand-tint-2 bg-brand-accent" />
          )}
        </span>

        <div className="flex flex-1 flex-col gap-[2px] leading-none">
          <span className="text-[16px] font-bold text-brand-primary">
            {thread?.name ?? 'Unknown'}
          </span>
          <span className="text-[12px] text-gray-60">
            {thread?.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>

        <IconBox size={42} shape="pill" aria-label="Search this conversation">
          <IconSearch className="size-[20px] text-gray-100" />
        </IconBox>
      </header>

      {/* Messages */}
      <div className="absolute bottom-[200px] left-0 right-0 top-[129px] overflow-y-auto px-[16px] py-[12px]">
        {messages.length === 0 ? (
          <p className="mt-12 text-center text-sm text-gray-60">
            No messages yet — say hi 👋
          </p>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {messages.map((m) => {
              const reportId = reportIdByMessage[m.id];
              if (reportId) {
                return (
                  <div key={m.id} className="flex">
                    <ReportCard reportId={reportId} />
                  </div>
                );
              }
              return <ChatBubble key={m.id} message={m} />;
            })}
          </div>
        )}
      </div>

      {/* Quick actions row */}
      <div className="absolute bottom-[152px] left-0 right-0 flex items-center justify-center gap-[10px] px-[16px]">
        <QuickAction icon={IconReminder} label="Send Notes" />
        <QuickAction icon={IconRefresh} label="Status Update" />
        <QuickAction icon={IconProfile} label="Contact" />
      </div>

      {/* Input row */}
      <div className="absolute bottom-[100px] left-0 right-0 flex items-center gap-[10px] px-[16px]">
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
              if (e.key === 'Enter') handleSend();
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
