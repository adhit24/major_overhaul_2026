import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
