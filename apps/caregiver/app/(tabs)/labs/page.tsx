'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type LabReportResult = {
  summary: string;
  flags: string[];
  follow_up: 'routine' | 'soon' | 'urgent';
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const FOLLOW_UP_STYLES: Record<LabReportResult['follow_up'], { label: string; bg: string; text: string }> = {
  routine: { label: 'Routine — nothing urgent', bg: 'bg-green-100', text: 'text-green-800' },
  soon: { label: 'Soon — mention at next appointment', bg: 'bg-amber-100', text: 'text-amber-800' },
  urgent: { label: 'Urgent — contact doctor today', bg: 'bg-red-100', text: 'text-red-800' },
};

export default function LabReportUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabReportResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setResult(null);
    setLoading(true);
    const t0 = performance.now();
    try {
      const buf = await file.arrayBuffer();
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) {
        throw new Error('Please upload a PDF or an image (PNG, JPG, HEIC, WebP).');
      }
      const contentType = isPdf ? 'application/pdf' : (file.type || 'image/png');
      const res = await fetch(`${API_URL}/lab-report/upload`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: buf,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Server ${res.status}: ${detail}`);
      }
      const data = (await res.json()) as LabReportResult;
      setResult(data);
      setElapsedMs(Math.round(performance.now() - t0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function onPick() {
    fileRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div
      className="relative min-h-screen overflow-y-auto pb-20"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <header className="flex items-center gap-4 px-5 pt-14">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center rounded-lg bg-white/60 text-xl font-bold text-gray-700 active:bg-white/80"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Lab Report</h1>
      </header>

      <p className="mt-2 px-5 text-sm text-gray-600">
        Upload a PDF lab report (MyChart, Quest, LabCorp…). The fine-tuned
        Gemma 4 model on this device will read it and explain the results in
        plain language — fully offline.
      </p>

      {/* Drop zone */}
      <div
        className="mx-5 mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-gray-400 bg-white/60 p-8 text-center transition-colors hover:bg-white/80"
        onClick={onPick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="text-4xl">📄</div>
        <div className="mt-2 font-semibold text-gray-800">
          {fileName ?? 'Tap to choose a file or drag one here'}
        </div>
        {!fileName && (
          <div className="mt-1 text-xs text-gray-500">PDF or photo (PNG, JPG, HEIC, WebP) · 10 MB max</div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/heic,image/heif,image/webp"
          className="hidden"
          onChange={onChange}
        />
      </div>

      {/* Status */}
      {loading && (
        <div className="mx-5 mt-4 rounded-xl bg-blue-100 px-4 py-3 text-sm text-blue-900">
          Reading the report and asking the local model… (typically ~1 s on a 4070)
        </div>
      )}
      {error && (
        <div className="mx-5 mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-900">
          <div className="font-semibold">Couldn't read that file</div>
          <div className="mt-1 break-all text-xs">{error}</div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mx-5 mt-6 rounded-2xl bg-white p-5 shadow-md">
          <div className="text-xs uppercase tracking-wider text-gray-500">
            Plain-language summary
            {elapsedMs !== null && (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] normal-case">
                {(elapsedMs / 1000).toFixed(1)}s · local
              </span>
            )}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-900">
            {result.summary}
          </p>

          {/* Follow-up pill */}
          <div className="mt-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${FOLLOW_UP_STYLES[result.follow_up].bg} ${FOLLOW_UP_STYLES[result.follow_up].text}`}
            >
              {FOLLOW_UP_STYLES[result.follow_up].label}
            </span>
          </div>

          {/* Flags */}
          {result.flags.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Out-of-range results
              </div>
              <ul className="mt-2 space-y-1">
                {result.flags.map((f) => (
                  <li
                    key={f}
                    className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    ⚠ {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.flags.length === 0 && (
            <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
              ✓ All results within normal range
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      <p className="mt-8 px-5 text-center text-xs text-gray-500">
        Patient data never leaves this device. Powered by your fine-tuned Gemma 4 E2B via Ollama.
      </p>
    </div>
  );
}
