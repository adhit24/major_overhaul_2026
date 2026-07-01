import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { EditPesertaButton } from "@/components/EditPesertaModal";
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
  searchParams: Promise<{ dept?: string; sort?: string; dir?: string }>;
}) {
  const { dept, sort: sortParam, dir: dirParam } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Validasi sort param
  const sortCol = sortParam && SORTABLE[sortParam] ? sortParam : "no_badge";
  const sortAsc = dirParam !== "desc";

  // Pagination: Supabase cap 1000 baris/request, ambil dua batch parallel
  const [batch1, batch2] = await Promise.all([
    supabase.from("peserta").select("id, departemen, status_badge").range(0, 999),
    supabase.from("peserta").select("id, departemen, status_badge").range(1000, 1999),
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

  return (
    <>
      <TopBar title="Manpower per Divisi" email={userData.user?.email} />
      <main className="flex-1 space-y-6 p-4 sm:p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Total seluruh divisi:{" "}
            <span className="font-semibold text-slate-800">{totalAll} orang</span>
          </p>
          {dept && (
            <Link href="/manpower" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
              ← Semua divisi
            </Link>
          )}
        </div>

        {/* Dept cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {deptStats.map(({ dept: d, total, active, pending, returned }) => {
            const style = DEPT_STYLE[d] ?? DEPT_STYLE["SUPPORTING"];
            const isSelected = dept === d;
            return (
              <Link
                key={d}
                href={`/manpower?dept=${encodeURIComponent(d)}`}
                className={`rounded-xl border-2 p-4 transition-all shadow-sm ${style.card} ${
                  isSelected ? "ring-2 ring-offset-1 ring-brand-500 shadow-md" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">{d}</p>
                </div>
                <p className="text-3xl font-bold text-slate-800 sm:text-4xl">{total}</p>
                <p className="mt-1 text-[11px] text-slate-500">orang</p>
                <div className="mt-3 space-y-0.5">
                  <p className="text-[10px] text-emerald-600">● ACTIVE: {active}</p>
                  <p className="text-[10px] text-amber-600">● PENDING: {pending}</p>
                  {returned > 0 && <p className="text-[10px] text-slate-400">● RETURNED: {returned}</p>}
                </div>
              </Link>
            );
          })}
        </div>

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

            <div className="overflow-x-auto">
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
