'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/peserta',
    label: 'Peserta',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/manpower',
    label: 'Manpower',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16" />
        <path d="M9 21V9h6v12" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    href: '/deposit',
    label: 'Deposit',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    href: '/pengembalian',
    label: 'Pengembalian',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 12a9 9 0 0 1 15.5-6.4M21 12a9 9 0 0 1-15.5 6.4" />
        <path d="M18.5 2v4h-4M5.5 22v-4h4" />
      </svg>
    ),
  },
  {
    href: '/pengembalian/kehilangan',
    label: 'Hilang',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="6" y1="15" x2="10" y2="15" />
        <line x1="6" y1="17.5" x2="12" y2="17.5" />
        <line x1="15" y1="9" x2="19" y2="13" />
        <line x1="19" y1="9" x2="15" y2="13" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden print:hidden">
      <div className="flex h-16 items-stretch pb-[env(safe-area-inset-bottom)]">
        {NAV.map((item) => {
          const matches = NAV.filter((n) => pathname === n.href || pathname.startsWith(n.href + '/'));
          const best = [...matches].sort((a, b) => b.href.length - a.href.length)[0];
          const active = best?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                active ? 'text-brand-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="bottomnav-active-pill"
                  className="absolute inset-x-1 top-1 bottom-1 rounded-xl bg-brand-50 ring-1 ring-brand-100"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  aria-hidden="true"
                />
              ) : null}
              <span className={`relative ${active ? 'text-brand-600' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              <span className="relative max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
