'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface Result {
  id: string;
  nama: string;
  no_badge: string | null;
  no_erp: string | null;
  departemen: string | null;
  status_badge: string | null;
}

function statusColor(s: string | null) {
  if (s === 'ACTIVE')   return 'bg-emerald-100 text-emerald-700';
  if (s === 'PENDING')  return 'bg-amber-100 text-amber-700';
  if (s === 'RETURNED') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-400';
}

const AVATAR_COLORS = [
  'bg-blue-500','bg-emerald-500','bg-violet-500',
  'bg-orange-500','bg-rose-500','bg-teal-500','bg-indigo-500',
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-slate-300" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
    </svg>
  );
}

export function CommandPalette() {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Ctrl+K + Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(v => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  // Focus + reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
      setQuery(''); setResults([]); setSelected(0);
    }
  }, [open]);

  // Debounced search — 280ms
  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const term = query.trim();
      const { data } = await supabase
        .from('peserta')
        .select('id, nama, no_badge, no_erp, departemen, status_badge')
        .or(`nama.ilike.%${term}%,no_badge.ilike.%${term}%,no_erp.ilike.%${term}%`)
        .order('nama')
        .limit(7);
      setResults(data ?? []);
      setSelected(0);
      setLoading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [query, supabase]);

  const handleSelect = useCallback((p: Result) => {
    setOpen(false);
    router.push(`/peserta?q=${encodeURIComponent(p.nama)}`);
  }, [router]);

  // Arrow key + Enter navigation
  useEffect(() => {
    if (!open || results.length === 0) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); handleSelect(results[selected]); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, results, selected, handleSelect]);

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Cari peserta (Ctrl+K)"
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 hover:border-slate-300 hover:bg-white hover:text-slate-600 transition-colors"
      >
        <SearchIcon />
        <span className="hidden sm:inline text-xs">Cari peserta</span>
        <kbd className="hidden sm:inline rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
          Ctrl K
        </kbd>
      </button>

      {/* ── Palette overlay ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <motion.div
              key="dialog"
              role="dialog"
              aria-modal
              aria-label="Pencarian peserta"
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{ opacity: 0, scale: 0.96,    y: -12 }}
              transition={{ type: 'spring', mass: 0.7, damping: 20, stiffness: 220 }}
              className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/20"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Cari nama, No Badge, atau No ERP..."
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                  autoComplete="off"
                />
                {loading
                  ? <SpinIcon />
                  : query && (
                    <button onClick={() => setQuery('')} className="text-slate-300 hover:text-slate-500 text-lg leading-none" aria-label="Hapus pencarian">×</button>
                  )
                }
                <kbd className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                  ESC
                </kbd>
              </div>

              {/* Results list */}
              <AnimatePresence mode="wait">
                {results.length > 0 ? (
                  <motion.ul
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="max-h-72 overflow-y-auto py-1.5"
                    role="listbox"
                  >
                    {results.map((p, i) => {
                      const initial = p.nama.trim().charAt(0).toUpperCase();
                      return (
                        <motion.li
                          key={p.id}
                          role="option"
                          aria-selected={selected === i}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <button
                            onClick={() => handleSelect(p)}
                            onMouseEnter={() => setSelected(i)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              selected === i ? 'bg-slate-50' : ''
                            }`}
                          >
                            {/* Avatar */}
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(p.nama)}`}>
                              {initial}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{p.nama}</p>
                              <p className="truncate text-xs text-slate-400">
                                {p.no_badge  ? `Badge #${p.no_badge}` : 'Belum ada badge'}
                                {p.no_erp    ? ` · ERP ${p.no_erp}`  : ''}
                                {p.departemen ? ` · ${p.departemen}`  : ''}
                              </p>
                            </div>

                            {/* Status chip */}
                            {p.status_badge && (
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(p.status_badge)}`}>
                                {p.status_badge}
                              </span>
                            )}

                            {/* Arrow hint when selected */}
                            {selected === i && (
                              <svg className="h-3.5 w-3.5 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                ) : query.trim() && !loading ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-4 py-10 text-center"
                  >
                    <p className="text-sm font-medium text-slate-500">
                      Tidak ditemukan: <span className="text-slate-800">&ldquo;{query}&rdquo;</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Coba nama lengkap atau nomor badge yang berbeda
                    </p>
                  </motion.div>
                ) : !query ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-300">
                    Ketik nama, nomor badge, atau nomor ERP untuk mencari
                  </div>
                ) : null}
              </AnimatePresence>

              {/* Footer keyboard hints */}
              {results.length > 0 && (
                <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[10px] text-slate-300">
                  <span><kbd className="font-mono">↑ ↓</kbd> navigasi</span>
                  <span><kbd className="font-mono">Enter</kbd> pilih</span>
                  <span><kbd className="font-mono">ESC</kbd> tutup</span>
                  <span className="ml-auto">{results.length} hasil ditemukan</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
