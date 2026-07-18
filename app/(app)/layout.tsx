import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { IdleLogout } from "@/components/IdleLogout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <IdleLogout />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 sm:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
