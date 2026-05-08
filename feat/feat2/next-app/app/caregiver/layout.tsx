import BottomNav from "@/components/BottomNav";

export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="max-w-[390px] mx-auto flex flex-col bg-[#EEEEF5]"
      style={{ height: "100dvh" }}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar pb-2">{children}</div>
      <BottomNav role="caregiver" />
    </div>
  );
}
