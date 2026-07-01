'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

type DeptStat = {
  dept: string;
  total: number;
  active: number;
  pending: number;
  returned: number;
};

const DEPT_STYLE: Record<string, { card: string; dot: string; badge: string; ring: string; num: string }> = {
  "BOILER":     { card: "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/60",  dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700", ring: "ring-orange-400",  num: "text-orange-900" },
  "TBN-BOP":    { card: "border-blue-200   bg-gradient-to-br from-blue-50   to-blue-100/60",    dot: "bg-blue-400",   badge: "bg-blue-100   text-blue-700",   ring: "ring-blue-400",    num: "text-blue-900"   },
  "ONE PLANT":  { card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-400", num: "text-emerald-900" },
  "INDIRECT":   { card: "border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/60",  dot: "bg-violet-400", badge: "bg-violet-100 text-violet-700", ring: "ring-violet-400",  num: "text-violet-900" },
  "SUPPORTING": { card: "border-slate-200  bg-gradient-to-br from-slate-50  to-slate-100/60",   dot: "bg-slate-400",  badge: "bg-slate-100  text-slate-600",  ring: "ring-slate-400",   num: "text-slate-800"  },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
};

export function ManpowerCards({
  deptStats,
  selectedDept,
}: {
  deptStats: DeptStat[];
  selectedDept?: string;
}) {
  const totalPending  = deptStats.reduce((s, d) => s + d.pending,  0);
  const totalReturned = deptStats.reduce((s, d) => s + d.returned, 0);
  const totalActive   = deptStats.reduce((s, d) => s + d.active,   0);
  const totalAll      = deptStats.reduce((s, d) => s + d.total,    0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6"
    >
      {/* ── 5 Dept Cards ── */}
      {deptStats.map(({ dept, total, active, pending, returned }) => {
        const style      = DEPT_STYLE[dept] ?? DEPT_STYLE['SUPPORTING'];
        const isSelected = selectedDept === dept;
        const pct        = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;

        return (
          <motion.div key={dept} variants={cardVariants}>
            <Link
              href={`/manpower?dept=${encodeURIComponent(dept)}`}
              className={`group flex h-full flex-col rounded-2xl border-2 p-4 shadow-sm transition-all duration-200 ${style.card} ${
                isSelected ? `ring-2 ring-offset-2 ${style.ring} shadow-lg` : 'hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {/* Label */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot} shadow-sm`} />
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 truncate">{dept}</p>
                </div>
                <span className="text-[10px] text-slate-400">{pct}%</span>
              </div>

              {/* Number */}
              <p className={`text-4xl font-black tabular-nums leading-none ${style.num}`}>{total}</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">orang</p>

              {/* Progress bar */}
              <div className="mt-3 h-1 w-full rounded-full bg-black/5">
                <div
                  className={`h-1 rounded-full ${style.dot} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Stats */}
              <div className="mt-3 space-y-0.5">
                <p className="text-[10px] font-semibold text-emerald-600">● ACTIVE: {active}</p>
                <p className="text-[10px] font-semibold text-amber-600">● PENDING: {pending}</p>
                {returned > 0 && (
                  <p className="text-[10px] font-semibold text-slate-400">● RETURNED: {returned}</p>
                )}
              </div>
            </Link>
          </motion.div>
        );
      })}

      {/* ── Pending / Return Card ── */}
      <motion.div variants={cardVariants}>
        <Link
          href="/manpower?view=perlu-tindak"
          className={`group flex h-full flex-col rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50/60 p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
            selectedDept === undefined ? '' : ''
          }`}
        >
          {/* Label */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Perlu Tindak</p>
          </div>

          {/* Pending */}
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Pending</p>
            <p className="text-4xl font-black tabular-nums leading-none text-amber-700">{totalPending}</p>
            <p className="text-[10px] text-amber-500 mt-0.5">menunggu badge</p>
          </div>

          <div className="h-px bg-amber-200/60 my-1" />

          {/* Returned */}
          <div className="mt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-0.5">Returned</p>
            <p className="text-3xl font-black tabular-nums leading-none text-rose-600">{totalReturned}</p>
            <p className="text-[10px] text-rose-400 mt-0.5">badge dikembalikan</p>
          </div>

          {/* Progress bars */}
          <div className="mt-3 space-y-1.5">
            {deptStats.filter(d => d.pending > 0 || d.returned > 0).map(d => (
              <div key={d.dept} className="flex items-center gap-2">
                <p className="text-[9px] font-bold text-slate-400 w-14 truncate uppercase">{d.dept.split(' ')[0]}</p>
                <div className="flex-1 flex gap-0.5 items-center">
                  {d.pending  > 0 && <div className="h-1.5 rounded-full bg-amber-400" style={{ flex: d.pending  }} />}
                  {d.returned > 0 && <div className="h-1.5 rounded-full bg-rose-400"  style={{ flex: d.returned }} />}
                </div>
                <p className="text-[9px] text-slate-400 tabular-nums">{d.pending + d.returned}</p>
              </div>
            ))}
          </div>

          {/* CTA hint */}
          <div className="mt-auto pt-3 flex items-center gap-1 text-[10px] font-semibold text-amber-500 group-hover:text-amber-700 transition-colors">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            Lihat & edit semua
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
