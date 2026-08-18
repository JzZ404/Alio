import { VitalTile } from './VitalTile';
import { Button } from './Button';
import {
  IconBloodPressure,
  IconHeartRate,
  IconStethoscope,
  IconMedicalPrescription,
  IconPills,
  IconBloodBag,
} from './icons';
import type { Vital, Medication } from '@alio/mock-data';

const iconForVital = {
  'blood-count': IconBloodBag,
  'blood-status': IconBloodPressure,
  'heart-rate': IconHeartRate,
  'pressure': IconMedicalPrescription,
  'medications': IconPills,
} as const;

/**
 * TodayStatusCard — purple "Today's Status" card. Matches Figma 254:2828–2879.
 *
 * Outer: brand-primary bg, rounded-[12px], pl-[18px] pr-[16px] py-[18px], gap-[16px] internal.
 * Header: "Today's Status" 14px Bold + "Harold is stable today." 20px Bold (both white).
 * Vitals row: Medications card (96px wide) + 2x2 grid of VitalTiles.
 * Footer: separator + "Last visit by..." (14px regular) + "Today, 2:30 PM" (16px Bold) + View Notes button (lavender, black text).
 */
export function TodayStatusCard({
  statusLine,
  medications,
  vitals,
  lastVisitBy,
  lastVisitTime,
  onViewNotes,
}: {
  elderName?: string;
  statusLine: string;
  medications: Medication[];
  vitals: Vital[];
  lastVisitBy: string;
  lastVisitTime: string;
  onViewNotes?: () => void;
}) {
  return (
    <div className="flex flex-col gap-[16px] rounded-[12px] bg-brand-primary pb-[18px] pl-[18px] pr-[16px] pt-[18px]">
      {/* Header */}
      <div className="flex flex-col gap-[12px] font-bold text-white">
        <p className="text-[14px] leading-tight">Today&apos;s Status</p>
        <p className="text-[20px] leading-tight">{statusLine}</p>
      </div>

      {/* Vitals row: Medications card + 2x2 vitals grid */}
      <div className="flex items-stretch gap-[8px]">
        <MedicationsTile medications={medications} />
        <div className="grid flex-1 grid-cols-2 gap-[8px]">
          {vitals.slice(0, 4).map((v) => {
            const Icon = iconForVital[v.iconHint] ?? IconStethoscope;
            return <VitalTile key={v.id} label={v.label} value={v.value} Icon={Icon} />;
          })}
        </div>
      </div>

      {/* Footer — separator + "last visit" + View Notes button */}
      <div className="flex items-end gap-[10px] border-t-[0.5px] border-white pt-[10px]">
        <div className="flex flex-1 flex-col gap-[6px] py-[5px] pl-[8px] pr-[8px] text-white">
          <p className="text-[14px] font-normal leading-tight">Last visit by {lastVisitBy}</p>
          <p className="text-[16px] font-bold leading-tight">Today, {lastVisitTime}</p>
        </div>
        <Button variant="secondary" onClick={onViewNotes} className="w-[101px] shrink-0 px-0">
          View Notes
        </Button>
      </div>
    </div>
  );
}

/**
 * MedicationsTile — left tile in the vitals row. White card, 96px wide.
 * Layout: top row (label + count chip), then pill icon + drug name/dose stack.
 *
 * Text scale (shared with VitalTile for consistency):
 *   • label  = 10px bold
 *   • value  = 12px bold
 *   • dose   = 10px regular (secondary)
 *   • count chip "2" = 10px bold inside a 16×16 chip
 */
function MedicationsTile({ medications }: { medications: Medication[] }) {
  const med = medications[0];
  return (
    <div className="flex w-[96px] shrink-0 flex-col gap-[7px] rounded-[12px] bg-white px-[8px] py-[10px]">
      {/* Top: "Medications" label + count chip */}
      <div className="flex items-center justify-between gap-[6px]">
        <span className="text-[10px] font-bold text-gray-90 leading-none">Medications</span>
        <span className="flex size-[16px] items-center justify-center rounded-[3px] bg-brand-tint-2">
          <span className="text-[10px] font-bold text-gray-90 leading-none">{medications.length}</span>
        </span>
      </div>

      {/* Pill icon box */}
      <span className="flex w-[30px] items-center justify-center rounded-[8px] bg-brand-tint-2 p-[5px]">
        <IconPills className="size-5 text-brand-primary" />
      </span>

      {/* Drug name + dose */}
      {med && (
        <div className="flex flex-col gap-[2px] leading-none text-gray-90">
          <span className="text-[12px] font-bold">{med.name}</span>
          <span className="text-[10px] font-normal">{med.dose}</span>
        </div>
      )}
    </div>
  );
}
