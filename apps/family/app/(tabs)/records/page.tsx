'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  IconBox,
  RecordItem,
  AddRecordModal,
  IconSearch,
  IconPlus,
  IconFilter,
  IconMedicalRecord,
} from '@alio/ui';
import {
  SAMPLE_RECORDS,
  RECORDS_OWNER,
  type MedicalRecord,
  type RecordType,
} from '@alio/mock-data';
import { supabase, type CompiledReportRow } from '@/lib/supabase';
import { VisitRecordItem } from '@/components/VisitRecordItem';

// Hardcoded for the prototype (single patient). Replace with real identity
// when auth lands.
const PATIENT_ID = 'dorothy-chen';

type FilterTab = 'All' | RecordType | 'Visit';
const FILTERS: FilterTab[] = ['All', 'Visit', 'Lab report', 'Prescription', 'Other'];
const FILTER_LABELS: Record<FilterTab, string> = {
  'All':          'All',
  'Visit':        'Visit',
  'Lab report':   'Lab Report',
  'Prescription': 'Prescription',
  'Other':        'Other',
};

/**
 * Family Records — Figma FM-records (388:4141).
 * List of patient medical records with filter pills and a + FAB that opens
 * AddRecordModal. Header positioned at top-60 to match Logs/AI/Chat screens.
 */
export default function FamilyRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<MedicalRecord[]>(SAMPLE_RECORDS);
  const [visits, setVisits] = useState<CompiledReportRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch compiled visit reports for this patient on mount. Newest first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('compiled_reports')
        .select('*')
        .eq('patient_id', PATIENT_ID)
        .order('created_at', { ascending: false });
      if (!cancelled && data) setVisits(data as CompiledReportRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showVisits = activeFilter === 'All' || activeFilter === 'Visit';
  const filteredRecords =
    activeFilter === 'All'
      ? records
      : activeFilter === 'Visit'
        ? []
        : records.filter((r) => r.type === activeFilter);

  const totalCount = filteredRecords.length + (showVisits ? visits.length : 0);

  const handleSave = (rec: Omit<MedicalRecord, 'id'>) => {
    setRecords((prev) => [
      { ...rec, id: `r-${Date.now()}` },
      ...prev,
    ]);
  };

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — "Records" pill + Search + Plus (positioned at top-60 for consistency) */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center justify-between gap-[12px]">
        <span className="flex h-[42px] items-center rounded-[10px] bg-brand-tint-1 px-[12px] text-[20px] font-bold text-black">
          Records
        </span>
        <div className="flex items-center gap-[12px]">
          <IconBox size={42} aria-label="Search records">
            <IconSearch className="size-[24px] text-gray-100" />
          </IconBox>
          <button
            type="button"
            aria-label="Add record"
            onClick={() => setModalOpen(true)}
            className="flex size-[42px] items-center justify-center rounded-[12px] bg-brand-primary transition-transform active:scale-95"
          >
            <IconPlus className="size-[24px] text-white" />
          </button>
        </div>
      </header>

      {/* Filter pills + filter icon — all on one line.
       * Pills shrink-0 to keep them readable, row scrolls horizontally on tiny
       * phones; filter button stays pinned to the far right. */}
      <div className="absolute left-[25px] right-[25px] top-[116px] z-10 flex items-center gap-[8px]">
        <div
          className="flex flex-1 items-center gap-[8px] overflow-x-auto"
          // hide horizontal scrollbar — already hidden globally, but keep
          // tabular feel
          style={{ scrollbarWidth: 'none' }}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={clsx(
                  'h-[27px] shrink-0 rounded-full px-[12px] text-[12px] font-bold whitespace-nowrap transition-colors',
                  active
                    ? 'bg-brand-primary text-white'
                    : 'bg-brand-tint-1 text-gray-90 active:bg-brand-border',
                )}
              >
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Filter settings"
          className="flex size-[24px] shrink-0 items-center justify-center transition-transform active:scale-90"
        >
          <IconFilter className="size-[22px] text-brand-primary" />
        </button>
      </div>

      {/* Owner summary card + records list — scrollable */}
      <div className="absolute bottom-[110px] left-0 right-0 top-[163px] overflow-y-auto px-[25px]">
        {/* Purple summary card */}
        <div className="flex h-[70px] items-center gap-[12px] rounded-[12px] bg-brand-primary px-[12px] pr-[16px]">
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-[10px] bg-brand-tint-1">
            <IconMedicalRecord className="size-[24px] text-brand-primary" />
          </span>
          <div className="flex flex-1 flex-col gap-[4px] leading-none">
            {/* Figma uses #A7A7FF for the label — soft lavender on the brand-primary bg */}
            <span className="text-[12px] font-bold text-[#A7A7FF]">{RECORDS_OWNER.label}</span>
            <span className="text-[14px] font-bold text-white">{RECORDS_OWNER.countLabel}</span>
          </div>
          <span className="flex h-[27px] shrink-0 items-center justify-center rounded-full bg-brand-accent px-[14px] text-[12px] font-bold text-[#28292C]">
            {RECORDS_OWNER.syncStatus}
          </span>
        </div>

        {/* Records list — visits first (newest), then static medical records */}
        <ul className="mt-[14px] flex flex-col gap-[8px]">
          {totalCount === 0 ? (
            <li className="py-12 text-center text-[14px] text-gray-60">
              No {activeFilter === 'All' ? 'records' : activeFilter.toLowerCase()} yet.
            </li>
          ) : (
            <>
              {showVisits &&
                visits.map((v) => (
                  <li key={v.id}>
                    <VisitRecordItem
                      row={v}
                      onClick={() => router.push(`/records/visit/${v.id}`)}
                    />
                  </li>
                ))}
              {filteredRecords.map((r) => (
                <li key={r.id}>
                  <RecordItem record={r} />
                </li>
              ))}
            </>
          )}
        </ul>
      </div>

      {/* Add record overlay */}
      <AddRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
