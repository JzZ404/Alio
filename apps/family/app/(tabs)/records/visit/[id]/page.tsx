'use client';

import { useParams, useRouter } from 'next/navigation';
import { IconBox, IconChevronLeft } from '@alio/ui';
import { ReportCard } from '@/components/ReportCard';

export default function FamilyVisitDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background: 'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center gap-[16px]">
        <IconBox size={42} aria-label="Back" onClick={() => router.back()}>
          <IconChevronLeft className="size-6 text-gray-100" />
        </IconBox>
        <span className="flex h-[42px] items-center rounded-[10px] bg-brand-tint-1 px-[12px] text-[16px] font-bold text-black">
          Visit Report
        </span>
      </header>

      <div className="absolute bottom-[110px] left-0 right-0 top-[122px] overflow-y-auto px-[25px] py-[12px]">
        <div className="mx-auto w-full max-w-[380px]">
          {id ? <ReportCard reportId={id} /> : null}
        </div>
      </div>
    </div>
  );
}
