import { logout } from "@/app/(app)/actions";
import { CommandPalette } from "./CommandPalette";

export function TopBar({ title, email }: { title: string; email?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <CommandPalette />
        {email ? <span className="hidden text-sm text-slate-400 md:inline">{email}</span> : null}
        <form action={logout}>
          <button type="submit" className="btn-secondary text-xs">
            Keluar
          </button>
        </form>
      </div>
    </header>
  );
}
