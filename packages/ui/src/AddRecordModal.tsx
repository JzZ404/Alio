'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { IconClose, IconUpload, IconCalendar } from './icons';
import { Button } from './Button';
import type { RecordType, MedicalRecord } from '@alio/mock-data';

const TYPES: RecordType[] = ['Lab report', 'Prescription', 'Other'];

/**
 * AddRecordModal — popup overlay shown from the Records page "+" FAB.
 * Figma FM-add-records (388:4224) dims the page background and surfaces this
 * form. Submit appends to the parent's record list (via onSave).
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
  const [type, setType] = useState<RecordType>('Lab report');
  const [date, setDate] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      type,
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

      {/* Modal panel — bottom sheet style with rounded top */}
      <form
        onSubmit={handleSubmit}
        className={clsx(
          'relative w-full max-w-[360px] rounded-t-[24px] bg-white px-[24px] pb-[24px] pt-[20px]',
          'shadow-[0_-4px_24px_rgba(0,0,0,0.15)]',
        )}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-[16px] h-[4px] w-[40px] rounded-full bg-gray-30" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold text-gray-100">Add Record</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="flex size-[32px] items-center justify-center rounded-full bg-brand-tint-1 transition-colors active:bg-brand-border"
          >
            <IconClose className="size-[18px] text-gray-100" />
          </button>
        </div>

        {/* Form */}
        <div className="mt-[20px] flex flex-col gap-[16px]">
          {/* Type pills */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-bold text-gray-60">Type</label>
            <div className="flex flex-wrap gap-[8px]">
              {TYPES.map((t) => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={clsx(
                      'h-[32px] rounded-full px-[14px] text-[12px] font-bold transition-colors',
                      active
                        ? 'bg-brand-primary text-white'
                        : 'bg-brand-tint-1 text-gray-90 active:bg-brand-border',
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-bold text-gray-60" htmlFor="record-title">
              Record name
            </label>
            <input
              id="record-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cardiology Follow-up"
              className="h-[44px] rounded-[12px] bg-brand-tint-1 px-[14px] text-[14px] text-gray-100 placeholder:text-gray-60 outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-bold text-gray-60" htmlFor="record-date">
              Date
            </label>
            <div className="flex h-[44px] items-center gap-[8px] rounded-[12px] bg-brand-tint-1 px-[14px]">
              <input
                id="record-date"
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder={formatToday()}
                className="flex-1 bg-transparent text-[14px] text-gray-100 placeholder:text-gray-60 outline-none"
              />
              <IconCalendar className="size-[20px] text-gray-60" />
            </div>
          </div>

          {/* Upload (placeholder) */}
          <button
            type="button"
            className="flex h-[64px] items-center justify-center gap-[10px] rounded-[12px] border-2 border-dashed border-brand-border bg-brand-tint-1/60 transition-colors active:bg-brand-tint-1"
          >
            <IconUpload className="size-[20px] text-brand-primary" />
            <span className="text-[14px] font-bold text-brand-primary">Upload document</span>
          </button>
        </div>

        {/* Actions */}
        <div className="mt-[20px] flex gap-[10px]">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatToday(): string {
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}
