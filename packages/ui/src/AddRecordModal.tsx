'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { IconClose, IconPlus, IconPills, IconMedicalRecord, IconListView } from './icons';
import type { RecordType, MedicalRecord } from '@alio/mock-data';

type AddRecordType = Extract<RecordType, 'Prescription' | 'Lab report'> | 'Doctor notes';

const TYPES: { value: AddRecordType; label: string; Icon: typeof IconPills }[] = [
  { value: 'Prescription', label: 'Prescription', Icon: IconPills },
  { value: 'Lab report', label: 'Lab report', Icon: IconMedicalRecord },
  { value: 'Doctor notes', label: 'Doctor notes', Icon: IconListView },
];

/**
 * AddRecordModal — popup overlay shown from the Records page "+" FAB.
 * Figma FM-add-records (388:4224 → pop up 766:2137): bottom sheet on a
 * brand-tint-1 panel with a photo picker, name/date fields, a 3-up record
 * type picker, and a single full-width "Save Record" button.
 */
export function AddRecordModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (record: Omit<MedicalRecord, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AddRecordType>('Lab report');
  const [date, setDate] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      type: type === 'Doctor notes' ? 'Other' : type,
      date: date.trim() || formatToday(),
    });
    setTitle('');
    setDate('');
    setType('Lab report');
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center">
      {/* Backdrop — dims the page (Figma uses 60% opacity overlay) */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-gray-100/40 backdrop-blur-[2px]"
      />

      {/* Modal panel — bottom sheet, brand-tint-1 panel with rounded top */}
      <form
        onSubmit={handleSubmit}
        className={clsx(
          'relative w-full max-w-[393px] rounded-t-[16px] bg-brand-tint-1 px-[20px] pb-[24px] pt-[14px]',
          'shadow-[0px_0px_9.9px_0px_rgba(0,0,0,0.25)]',
        )}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-[12px] h-[4px] w-[38px] rounded-full bg-gray-30" />

        {/* Header */}
        <div className="flex items-center gap-[16px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-[36px] shrink-0 items-center justify-center rounded-[10px] bg-white transition-colors active:bg-brand-border"
          >
            <IconClose className="size-[20px] text-gray-80" />
          </button>
          <h2 className="text-[16px] font-bold text-gray-80">Add Record</h2>
        </div>

        {/* Photo picker — existing photo + add slot */}
        <div className="mt-[19px] flex gap-[17px]">
          <div className="h-[132px] w-[108px] overflow-hidden rounded-[12px] bg-gray-30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/records/sample-notebook.png"
              alt="Uploaded record photo"
              className="size-full object-cover"
            />
          </div>
          <button
            type="button"
            aria-label="Add photo"
            className="flex h-[132px] w-[108px] items-center justify-center rounded-[12px] border border-dashed border-black/45 bg-white transition-colors active:bg-brand-tint-1"
          >
            <span className="flex size-[36px] items-center justify-center rounded-[10px] bg-brand-primary">
              <IconPlus className="size-[16px] text-white" />
            </span>
          </button>
        </div>

        {/* Form fields */}
        <div className="mt-[22px] flex flex-col gap-[15px]">
          {/* Name */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[14px] font-bold text-[#6C6E76]" htmlFor="record-title">
              Record Name
            </label>
            <input
              id="record-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Eye check-up"
              className="h-[50px] rounded-[12px] bg-white px-[18px] text-[14px] font-bold text-gray-80 placeholder:text-[#6C6E76] outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[14px] font-bold text-[#6C6E76]" htmlFor="record-date">
              Record Date
            </label>
            <input
              id="record-date"
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="12/21/2025"
              className="h-[50px] rounded-[12px] bg-white px-[18px] text-[14px] font-bold text-gray-80 placeholder:text-[#6C6E76] outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-[8px]">
            <span className="text-[14px] font-bold text-[#6C6E76]">Record Type</span>
            <div className="flex gap-[15px]">
              {TYPES.map(({ value, label, Icon }) => {
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={clsx(
                      'flex h-[80px] flex-1 flex-col items-center justify-center gap-[8px] rounded-[12px] bg-white transition-colors',
                      active ? 'border-2 border-brand-primary' : 'border border-transparent',
                    )}
                  >
                    <Icon className={clsx('size-[24px]', active ? 'text-brand-primary' : 'text-gray-80')} />
                    <span className={clsx('text-[12px] font-bold', active ? 'text-brand-primary' : 'text-gray-80')}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={!title.trim()}
          className="mt-[32px] h-[50px] w-full rounded-[12px] bg-brand-primary text-[16px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          Save Record
        </button>
      </form>
    </div>
  );
}

function formatToday(): string {
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}
