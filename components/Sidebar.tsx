"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",        icon: "📊" },
  { href: "/peserta",    label: "Database Peserta",  icon: "👥" },
  { href: "/manpower",   label: "Manpower Divisi",   icon: "🏭" },
  { href: "/deposit",    label: "Summary Deposit",   icon: "💳" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white px-4 py-6 sm:flex print:hidden">
      <div className="mb-8 px-2">
        <img src="/logo_koin.png" alt="PT KOIN" className="h-10 w-auto object-contain" />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
