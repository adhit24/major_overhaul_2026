import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { EditPesertaButton } from "@/components/EditPesertaModal";
import { ManpowerCards } from "@/components/ManpowerCards";
import { DEPARTEMEN } from "@/lib/constants";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DEPT_STYLE: Record<string, { card: string; badge: string; dot: string }> = {
  "BOILER":     { card: "border-orange-200 bg-orange-50  hover:bg-orange-100",   badge: "bg-orange-100 text-orange-700",   dot: "bg-orange-400" },
  "TBN-BOP":    { card: "border-blue-200   bg-blue-50    hover:bg-blue-100",     badge: "bg-blue-100   text-blue-700",     dot: "bg-blue-400"   },
  "ONE PLANT":  { card: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  "INDIRECT":   { card: "border-violet-200 bg-violet-50  hover:bg-violet-100",   badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-400" },
  "SUPPORTING": { card: "border-slate-200  bg-slate-50   hover:bg-slate-100",    badge: "bg-slate-100  text-slate-600",    dot: "bg-slate-400"  },
};

const SORTABLE: Record<string, string> = {
  no_badge:          "NO BADGE",
  nama:              "NAMA",
  status_badge:      "STATUS",
  kategori:          "KATEGORI",
  no_erp:            "NO ERP",
  job_no:            "JOB NO",
  jabatan_deskripsi: "JABATAN",
  leader:            "LEADER",
  tanggal_induction: "TGL INDUCTION",
  due_date:          "DUE DATE",
};

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return (
    <span className="ml-1 text-slate-300 text-[10px]">↕</span>
  );
  return (
    <span className="ml-1 text-brand-500 text-[10px]">{asc ? "↑" : "↓"}</span>
  );
}

export default async function ManpowerPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; sort?: string; dir?: string; view?: string; psort?: string; pdir?: string }>;
}) {
  const { dept, sort: sortParam, dir: dirParam, view } = await searchParams;
  const showPerluTindak = view === "perlu-tindak";
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Validasi sort param
  const sortCol = sortParam && SORTABLE[sortParam] ? sortParam : "no_badge";
  const sortAsc = dirParam !== "desc";

  // Pagination: Supabase cap 1000 baris/request, ambil dua batch parallel
  const [batch1, batch2] = await Promise.all([
    supabase.from("peserta").select("id, departemen, status_badge, no_erp, kategori").range(0, 999),
    supabase.from("peserta").select("id, departemen, status_badge, no_erp, kategori").range(1000, 1999),
  ]);
  const allPeserta = [...(batch1.data ?? []), ...(batch2.data ?? [])];

  const deptStats = DEPARTEMEN.map((d) => {
    const list = allPeserta.filter((p) => p.departemen === d);
    return {
      dept: d,
      total:    list.length,
      active:   list.filter((p) => p.status_badge === "ACTIVE").length,
      pending:  list.filter((p) => p.status_badge === "PENDING").length,
      returned: list.filter((p) => p.status_badge === "RETURNED").length,
    };
  });

  const totalAll = allPeserta.length;

  // Rekap Section HRD (mengikuti MP List HRD): section ditentukan dari awalan PIN/No ERP.
  // 1xxxx = INDIRECT (HO), 2xxxx = INDIRECT (Local), 3xxxx = DIRECT, 4xxxx = Operator & Driver.
  // KARYAWAN tanpa PIN = EXPAT / belum terpetakan. Non-KARYAWAN tidak dihitung (subcont dsb).
  const hrdKaryawan = allPeserta.filter((p) => p.kategori === "KARYAWAN");
  const sectionOf = (erp: string | null) => {
    const s = String(erp ?? "");
    if (s.startsWith("1")) return "B";
    if (s.startsWith("2")) return "C";
    if (s.startsWith("3")) return "D";
    if (s.startsWith("4")) return "E";
    return "A";
  };
  const SECTION_LABELS: [string, string][] = [
    ["A", "EXPAT / Tanpa PIN"],
    ["B", "INDIRECT (HO)"],
    ["C", "INDIRECT (Local)"],
    ["D", "DIRECT"],
    ["E", "Operator & Driver"],
  ];
  const sectionStats = SECTION_LABELS.map(([code, label]) => ({
    code,
    label,
    total: hrdKaryawan.filter((p) => sectionOf(p.no_erp as string | null) === code).length,
  }));
  const totalKaryawan = hrdKaryawan.length;

  // Sort untuk tabel Perlu Tindak (pakai psort/pdir agar terpisah dari sort dept)
  const PT_SORTABLE: Record<string, string> = {
    no_badge: "NO BADGE", nama: "NAMA", status_badge: "STATUS", departemen: "DIVISI",
    jabatan_deskripsi: "JABATAN", leader: "LEADER", tanggal_induction: "TGL INDUCTION",
  };
  const ptSortParam = (await searchParams).psort as string | undefined;
  const ptDirParam  = (await searchParams).pdir as string | undefined;
  const ptSortCol   = ptSortParam && PT_SORTABLE[ptSortParam] ? ptSortParam : "status_badge";
  const ptSortAsc   = ptDirParam !== "desc";

  // Query semua Pending + Returned (lintas divisi)
  let perluTindakWorkers: Record<string, unknown>[] | null = null;
  if (showPerluTindak) {
    const cols = "id, no_badge, nama, departemen, kategori, no_erp, job_no, jabatan_deskripsi, leader, tanggal_induction, due_date, status_badge, ktp, sks, sertifikat, remarks";
    const ptOrder = { ascending: ptSortAsc, nullsFirst: false };
    const [pt1, pt2] = await Promise.all([
      supabase.from("peserta").select(cols).in("status_badge", ["PENDING", "RETURNED"]).order(ptSortCol, ptOrder).range(0, 999),
      supabase.from("peserta").select(cols).in("status_badge", ["PENDING", "RETURNED"]).order(ptSortCol, ptOrder).range(1000, 1999),
    ]);
    perluTindakWorkers = [...(pt1.data ?? []), ...(pt2.data ?? [])];
  }

  function ptSortUrl(col: string) {
    const newDir = col === ptSortCol && ptSortAsc ? "desc" : "asc";
    return `/manpower?view=perlu-tindak&psort=${col}&pdir=${newDir}`;
  }

  // Query detail worker dengan sort & pagination
  let workers: Record<string, unknown>[] | null = null;
  if (dept) {
    const cols = "id, no_badge, nama, kategori, no_erp, job_no, jabatan_deskripsi, leader, tanggal_induction, due_date, status_badge, ktp, sks, sertifikat, remarks";
    const orderOpt = { ascending: sortAsc, nullsFirst: false };
    const [wb1, wb2] = await Promise.all([
      supabase.from("peserta").select(cols).eq("departemen", dept).order(sortCol, orderOpt).range(0, 999),
      supabase.from("peserta").select(cols).eq("departemen", dept).order(sortCol, orderOpt).range(1000, 1999),
    ]);
    workers = [...(wb1.data ?? []), ...(wb2.data ?? [])];
  }

  const selectedStyle = dept ? (DEPT_STYLE[dept] ?? DEPT_STYLE["SUPPORTING"]) : null;

  // Helper: buat URL sort — toggle asc/desc jika kolom sama
  function sortUrl(col: string) {
    const newDir = col === sortCol && sortAsc ? "desc" : "asc";
    return `/manpower?dept=${encodeURIComponent(dept ?? "")}&sort=${col}&dir=${newDir}`;
  }

  const totalPending  = deptStats.reduce((s, d) => s + d.pending,  0);
  const totalReturned = deptStats.reduce((s, d) => s + d.returned, 0);
  const totalActive   = deptStats.reduce((s, d) => s + d.active,   0);

  return (
    <>
      <TopBar title="Manpower per Divisi" email={userData.user?.email} />
      <main className="flex-1 p-4 sm:p-6 space-y-5">

        {/* ── Stat strip ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-xs text-slate-500">Total</span>
            <span className="text-sm font-bold text-slate-800">{totalAll}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-500">Active</span>
            <span className="text-sm font-bold text-emerald-700">{totalActive}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-600">Pending</span>
            <span className="text-sm font-bold text-amber-700">{totalPending}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-xs text-rose-500">Returned</span>
            <span className="text-sm font-bold text-rose-600">{totalReturned}</span>
          </div>
          {dept && (
            <Link href="/manpower" className="ml-auto text-xs text-slate-400 hover:text-slate-700 transition-colors">
              ← Semua divisi
            </Link>
          )}
        </div>

        {/* ── Animated dept + pending/return cards ── */}
        <ManpowerCards deptStats={deptStats} selectedDept={dept} />

        {/* ── Rekap Section HRD (sinkron MP List HRD) ── */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-sm font-bold text-slate-700">Manpower per Section (HRD)</span>
            <span className="text-xs text-slate-400">kategori KARYAWAN, section dari awalan PIN</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-2.5">Section</th>
                  <th className="px-4 py-2.5 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {sectionStats.map((s) => (
                  <tr key={s.code} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 text-slate-700">
                      {s.code} – {s.label}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{s.total}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-5 py-2.5 font-bold text-slate-800">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">{totalKaryawan}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Tabel Perlu Tindak ── */}
        {showPerluTindak && perluTindakWorkers !== null && (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
                <span className="text-sm font-bold text-slate-700">Perlu Tindak Lanjut</span>
                <span className="text-xs text-slate-400">— {perluTindakWorkers.length} orang (Pending + Returned)</span>
              </div>
              <Link href="/manpower" className="text-xs text-slate-400 hover:text-slate-700">
                Tutup ×
              </Link>
            </div>
            {/* Mobile: kartu (< sm) */}
            <div className="flex flex-col gap-2.5 p-3.5 sm:hidden">
              {perluTindakWorkers.map((p) => (
                <div key={p.id as string} className="data-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{p.nama as string}</p>
                      <p className="text-xs text-slate-400">
                        {(p.no_badge as string | null) ? `Badge ${p.no_badge}` : "Belum ada badge"}
                        {p.departemen ? ` · ${p.departemen}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={(p.status_badge as string | null) ?? "PENDING"} />
                  </div>
                  <div className="my-2.5 border-t border-slate-100" />
                  <div className="data-card-row">
                    <span className="data-card-label">Jabatan</span>
                    <span className="data-card-value">{(p.jabatan_deskripsi as string | null) ?? "-"}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Leader</span>
                    <span className="data-card-value">{(p.leader as string | null) ?? "-"}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Tgl Induction</span>
                    <span className="data-card-value">{(p.tanggal_induction as string | null) ?? "-"}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Dok</span>
                    <span className="data-card-value flex justify-end gap-1">
                      {p.ktp        ? <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-1 py-0.5 font-semibold">KTP</span>  : null}
                      {p.sks        ? <span className="text-[10px] rounded bg-blue-100   text-blue-700   px-1 py-0.5 font-semibold">SKS</span>  : null}
                      {p.sertifikat ? <span className="text-[10px] rounded bg-violet-100 text-violet-700 px-1 py-0.5 font-semibold">SERT</span> : null}
                      {!p.ktp && !p.sks && !p.sertifikat ? <span className="text-slate-300">—</span> : null}
                    </span>
                  </div>
                  {(p.remarks as string | null) ? (
                    <p className="mt-1 text-xs text-slate-400">{p.remarks as string}</p>
                  ) : null}
                  <div className="mt-3 flex justify-end border-t border-slate-100 pt-2.5">
                    <EditPesertaButton peserta={{
                      id:                p.id as number,
                      nama:              p.nama as string,
                      no_badge:          p.no_badge as string | null,
                      no_erp:            p.no_erp as string | null,
                      status_badge:      p.status_badge as string | null,
                      jabatan_deskripsi: p.jabatan_deskripsi as string | null,
                      leader:            p.leader as string | null,
                      tanggal_induction: p.tanggal_induction as string | null,
                      due_date:          p.due_date as string | null,
                      ktp:               p.ktp as boolean,
                      sks:               p.sks as boolean,
                      sertifikat:        p.sertifikat as boolean,
                      remarks:           p.remarks as string | null,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop/tablet: tabel (>= sm) */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
                    {([
                      ["no_badge",          "px-5 py-3", "No Badge"],
                      ["nama",              "px-4 py-3", "Nama"],
                      ["status_badge",      "px-4 py-3", "Status"],
                      ["departemen",        "px-4 py-3", "Divisi"],
                      ["jabatan_deskripsi", "px-4 py-3", "Jabatan"],
                      ["leader",            "px-4 py-3", "Leader"],
                      ["tanggal_induction", "px-4 py-3", "Tgl Induction"],
                    ] as const).map(([col, cls, label]) => (
                      <th key={col} className={`whitespace-nowrap ${cls}`}>
                        <Link
                          href={ptSortUrl(col)}
                          className="inline-flex items-center hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          {label}
                          {ptSortCol === col
                            ? <span className="ml-1 text-brand-500 text-[10px]">{ptSortAsc ? "↑" : "↓"}</span>
                            : <span className="ml-1 text-slate-300 text-[10px]">↕</span>}
                        </Link>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center whitespace-nowrap">Dok</th>
                    <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {perluTindakWorkers.map((p, i) => (
                    <tr key={p.id as string} className={`transition-colors hover:bg-amber-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                      <td className="px-5 py-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {(p.no_badge as string | null) ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{p.nama as string}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={(p.status_badge as string | null) ?? "PENDING"} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-500">{(p.departemen as string | null) ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-[140px]">
                        <span className="line-clamp-1">{(p.jabatan_deskripsi as string | null) ?? <span className="text-slate-300">—</span>}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{(p.leader as string | null) ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{(p.tanggal_induction as string | null) ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="flex items-center justify-center gap-1">
                          {p.ktp        ? <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-1 py-0.5 font-semibold">KTP</span>  : null}
                          {p.sks        ? <span className="text-[10px] rounded bg-blue-100   text-blue-700   px-1 py-0.5 font-semibold">SKS</span>  : null}
                          {p.sertifikat ? <span className="text-[10px] rounded bg-violet-100 text-violet-700 px-1 py-0.5 font-semibold">SERT</span> : null}
                          {!p.ktp && !p.sks && !p.sertifikat ? <span className="text-slate-300 text-xs">—</span> : null}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[160px]">
                        <span className="line-clamp-1">{(p.remarks as string | null) ?? ""}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <EditPesertaButton peserta={{
                          id:                p.id as number,
                          nama:              p.nama as string,
                          no_badge:          p.no_badge as string | null,
                          no_erp:            p.no_erp as string | null,
                          status_badge:      p.status_badge as string | null,
                          jabatan_deskripsi: p.jabatan_deskripsi as string | null,
                          leader:            p.leader as string | null,
                          tanggal_induction: p.tanggal_induction as string | null,
                          due_date:          p.due_date as string | null,
                          ktp:               p.ktp as boolean,
                          sks:               p.sks as boolean,
                          sertifikat:        p.sertifikat as boolean,
                          remarks:           p.remarks as string | null,
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-amber-50/40 px-5 py-3 text-xs text-slate-500">
              <span className="text-amber-600 font-semibold">{perluTindakWorkers.filter(p => p.status_badge === "PENDING").length} Pending</span>
              {" · "}
              <span className="text-rose-500 font-semibold">{perluTindakWorkers.filter(p => p.status_badge === "RETURNED").length} Returned</span>
              {" · klik ✏️ untuk update status"}
            </div>
          </div>
        )}

        {/* Detail tabel */}
        {dept && workers !== null && (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${selectedStyle!.badge}`}>
                  {dept}
                </span>
                <span className="text-sm text-slate-500">{workers.length} orang</span>
                <span className="text-xs text-slate-400">
                  · diurutkan: <span className="font-medium text-slate-600">{SORTABLE[sortCol]}</span> {sortAsc ? "↑" : "↓"}
                </span>
              </div>
              <Link href="/manpower" className="text-xs text-slate-400 hover:text-slate-700">
                Tutup ×
              </Link>
            </div>

            {/* Mobile: kartu (< sm) */}
            <div className="flex flex-col gap-2.5 p-3.5 sm:hidden">
              {workers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Tidak ada data untuk divisi ini.</p>
              ) : (
                workers.map((p) => (
                  <div key={p.id as string} className="data-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{p.nama as string}</p>
                        <p className="text-xs text-slate-400">
                          {(p.no_badge as string | null) ? `Badge ${p.no_badge}` : "Belum ada badge"}
                          {p.no_erp ? ` · ERP ${p.no_erp}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={(p.status_badge as string | null) ?? "PENDING"} />
                    </div>
                    <div className="my-2.5 border-t border-slate-100" />
                    <div className="data-card-row">
                      <span className="data-card-label">Kategori</span>
                      <span className="data-card-value">{(p.kategori as string | null) ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Job No</span>
                      <span className="data-card-value">{(p.job_no as string | null) ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Jabatan</span>
                      <span className="data-card-value">{(p.jabatan_deskripsi as string | null) ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Leader</span>
                      <span className="data-card-value">{(p.leader as string | null) ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Tgl Induction</span>
                      <span className="data-card-value">{(p.tanggal_induction as string | null) ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Due Date</span>
                      <span className="data-card-value">{(p.due_date as string | null) ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Dok</span>
                      <span className="data-card-value flex justify-end gap-1">
                        {p.ktp        ? <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-1 py-0.5 font-semibold">KTP</span>  : null}
                        {p.sks        ? <span className="text-[10px] rounded bg-blue-100   text-blue-700   px-1 py-0.5 font-semibold">SKS</span>  : null}
                        {p.sertifikat ? <span className="text-[10px] rounded bg-violet-100 text-violet-700 px-1 py-0.5 font-semibold">SERT</span> : null}
                        {!p.ktp && !p.sks && !p.sertifikat ? <span className="text-slate-300">—</span> : null}
                      </span>
                    </div>
                    {(p.remarks as string | null) ? (
                      <p className="mt-1 text-xs text-slate-400">{p.remarks as string}</p>
                    ) : null}
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-2.5">
                      <EditPesertaButton peserta={{
                        id:                p.id as number,
                        nama:              p.nama as string,
                        no_badge:          p.no_badge as string | null,
                        no_erp:            p.no_erp as string | null,
                        status_badge:      p.status_badge as string | null,
                        jabatan_deskripsi: p.jabatan_deskripsi as string | null,
                        leader:            p.leader as string | null,
                        tanggal_induction: p.tanggal_induction as string | null,
                        due_date:          p.due_date as string | null,
                        ktp:               p.ktp as boolean,
                        sks:               p.sks as boolean,
                        sertifikat:        p.sertifikat as boolean,
                        remarks:           p.remarks as string | null,
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop/tablet: tabel (>= sm) */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
                    {(Object.entries(SORTABLE) as [string, string][]).map(([col, label]) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 first:px-5">
                        <Link
                          href={sortUrl(col)}
                          className="inline-flex items-center hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          {label}
                          <SortIcon active={sortCol === col} asc={sortAsc} />
                        </Link>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center whitespace-nowrap">DOK</th>
                    <th className="px-4 py-3 whitespace-nowrap">REMARKS</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {workers.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-5 py-10 text-center text-slate-400">
                        Tidak ada data untuk divisi ini.
                      </td>
                    </tr>
                  ) : (
                    workers.map((p, i) => (
                      <tr
                        key={p.id as string}
                        className={`transition-colors hover:bg-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                      >
                        <td className="px-5 py-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {(p.no_badge as string | null) ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{p.nama as string}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={(p.status_badge as string | null) ?? "PENDING"} />
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {(p.kategori as string | null) ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">
                          {(p.no_erp as string | null) ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {(p.job_no as string | null) ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[160px]">
                          <span className="line-clamp-1">{(p.jabatan_deskripsi as string | null) ?? <span className="text-slate-300">—</span>}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {(p.leader as string | null) ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{(p.tanggal_induction as string | null) ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{(p.due_date as string | null) ?? "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="flex items-center justify-center gap-1">
                            {p.ktp        ? <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-1 py-0.5 font-semibold">KTP</span>  : null}
                            {p.sks        ? <span className="text-[10px] rounded bg-blue-100   text-blue-700   px-1 py-0.5 font-semibold">SKS</span>  : null}
                            {p.sertifikat ? <span className="text-[10px] rounded bg-violet-100 text-violet-700 px-1 py-0.5 font-semibold">SERT</span> : null}
                            {!p.ktp && !p.sks && !p.sertifikat ? <span className="text-slate-300 text-xs">—</span> : null}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[200px]">
                          <span className="line-clamp-1">{(p.remarks as string | null) ?? ""}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <EditPesertaButton peserta={{
                            id:                p.id as number,
                            nama:              p.nama as string,
                            no_badge:          p.no_badge as string | null,
                            no_erp:            p.no_erp as string | null,
                            status_badge:      p.status_badge as string | null,
                            jabatan_deskripsi: p.jabatan_deskripsi as string | null,
                            leader:            p.leader as string | null,
                            tanggal_induction: p.tanggal_induction as string | null,
                            due_date:          p.due_date as string | null,
                            ktp:               p.ktp as boolean,
                            sks:               p.sks as boolean,
                            sertifikat:        p.sertifikat as boolean,
                            remarks:           p.remarks as string | null,
                          }} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              Menampilkan <span className="font-semibold text-slate-700">{workers.length}</span> orang
              · klik header kolom untuk mengurutkan
            </div>
          </div>
        )}

        {!dept && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">Klik salah satu divisi di atas untuk melihat detail man power</p>
          </div>
        )}

      </main>
    </>
  );
}
