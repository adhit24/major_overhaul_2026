import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { formatPetugas } from "@/lib/pengembalian";
import { DEPARTEMEN } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Row = {
  kondisi: string;
  pengembalian: {
    tanggal: string;
    petugas: string | null;
    batch: number | null;
    urutan: number | null;
    departemen: string | null;
    peserta: {
      id: number;
      nama: string;
      no_badge: string | null;
      no_erp: string | null;
      departemen: string | null;
      jabatan_deskripsi: string | null;
    } | null;
  } | null;
};

const batchLabel = (b: number | null | undefined) => (b != null ? `Batch ${b}` : "Batch -");

export default async function CetakKembaliPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; batch?: string }>;
}) {
  const { q, dept, batch } = await searchParams;
  const supabase = await createClient();

  // Kartu HILANG punya modul & cetak sendiri di /pengembalian/kehilangan - daftar ini
  // khusus kartu yang secara fisik kembali (KEMBALI atau RUSAK-tapi-kembali).
  const { data } = await supabase
    .from("pengembalian_detail")
    .select("kondisi, pengembalian(tanggal, petugas, batch, urutan, departemen, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
    .eq("item", "KARTU")
    .neq("kondisi", "HILANG");

  const qLower = (q ?? "").toLowerCase();
  // Filter dept/pencarian dulu (lepas dari batch) supaya daftar tab batch yang tersedia
  // tetap mencerminkan hasil pencarian/divisi yang sedang aktif.
  const rowsBeforeBatch = ((data ?? []) as unknown as Row[]).filter((r) => {
    const p = r.pengembalian?.peserta;
    if (!p) return false;
    if (dept && p.departemen !== dept) return false;
    if (qLower && !(`${p.nama} ${p.no_badge ?? ""} ${p.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
    return true;
  });

  // Tab batch diturunkan dari data yang benar-benar ada (bukan hardcode 1/2) supaya
  // batch 3, 4, dst otomatis muncul begitu ada pengembalian dengan batch tsb.
  const availableBatches = [...new Set(rowsBeforeBatch.map((r) => r.pengembalian?.batch).filter((b): b is number => b != null))].sort((a, b) => a - b);
  const batchFilter = batch ? Number(batch) : null;
  const rows = batchFilter == null ? rowsBeforeBatch : rowsBeforeBatch.filter((r) => r.pengembalian?.batch === batchFilter);

  const tabHref = (b: number | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (dept) params.set("dept", dept);
    if (b != null) params.set("batch", String(b));
    const qs = params.toString();
    return `/pengembalian/cetak/kembali${qs ? `?${qs}` : ""}`;
  };

  // Satu SECTION per departemen (urutan bisnis DEPARTEMEN). Tiap batch punya pool nomor
  // sendiri (Batch 1 = 1..N, Batch 2 lanjut dari situ, dst), jadi saat "Semua Batch" tampil
  // bersamaan, urutkan batch dulu baru No Badge terkecil ke terbesar DI DALAM batch itu -
  // kalau cuma diurutkan badge lintas batch, No akan terlihat loncat-loncat karena dua pool
  // nomor yang beda ikut terselang-seling. Saat satu batch difilter, ini otomatis jadi
  // urutan badge polos seperti biasa (batch-nya sudah sama semua).
  const badgeNum = (badge: string | null | undefined) => {
    const n = Number(badge);
    return Number.isFinite(n) && badge ? n : Infinity;
  };
  const rowSort = (a: Row, b: Row) =>
    (a.pengembalian?.batch ?? Infinity) - (b.pengembalian?.batch ?? Infinity) ||
    badgeNum(a.pengembalian?.peserta?.no_badge) - badgeNum(b.pengembalian?.peserta?.no_badge);
  const sections: { dept: string; rows: Row[] }[] = DEPARTEMEN.map((dName) => ({
    dept: dName as string,
    rows: rows
      .filter((r) => (r.pengembalian?.peserta?.departemen ?? "") === dName)
      .sort(rowSort),
  })).filter((s) => s.rows.length > 0);

  // baris tanpa departemen (seharusnya jarang/tidak ada) - tampilkan sebagai section terakhir
  const tanpaDivisi = rows
    .filter((r) => !r.pengembalian?.peserta?.departemen)
    .sort(rowSort);
  if (tanpaDivisi.length > 0) sections.push({ dept: "Tanpa Divisi", rows: tanpaDivisi });

  const grandTotal = rows.length;
  const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  return (
    <main className="mx-auto max-w-5xl bg-white p-8 text-slate-900 print:p-0">
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <nav className="flex flex-wrap gap-1.5">
          <a
            href={tabHref(null)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${batchFilter == null ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Semua Batch
          </a>
          {availableBatches.map((b) => (
            <a
              key={b}
              href={tabHref(b)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${batchFilter === b ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Batch {b} — Cetak
            </a>
          ))}
        </nav>
        <PrintButton />
      </div>

      <header className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_cps_transparent.png" alt="Cirebon Power" className="h-12 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold">DAFTAR PENGEMBALIAN ID CARD{batchFilter != null ? ` — BATCH ${batchFilter}` : ""}</h1>
          <p className="text-sm">PT. JO Koin One Plant — Dicetak: {dicetak}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      <div className="mt-3 text-xs text-slate-500">
        {batchFilter != null && <>Batch: <b>{batchFilter}</b> · </>}
        {dept && <>Divisi: <b>{dept}</b> · </>}
        {q && <>Cari: &quot;{q}&quot; · </>}
        Total: <b>{grandTotal}</b> kartu
      </div>

      {sections.map((section, si) => (
        <section key={section.dept} className="mt-6" style={{ breakInside: "avoid" }}>
          <h2 className="bg-slate-800 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
            SECTION {si + 1}: {section.dept}
          </h2>
          <table className="w-full table-fixed border-collapse text-[11px]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[22%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 text-left">
                <th className="px-1.5 py-2">No</th>
                <th className="px-1.5 py-2 whitespace-nowrap">Tanggal</th>
                <th className="px-1.5 py-2">Badge</th>
                <th className="px-1.5 py-2">Nama</th>
                <th className="px-1.5 py-2">PIN</th>
                <th className="px-1.5 py-2">Jabatan</th>
                <th className="px-1.5 py-2">Kondisi</th>
                <th className="px-1.5 py-2">Batch</th>
                <th className="px-1.5 py-2">Petugas</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r, i) => {
                const p = r.pengembalian?.peserta;
                return (
                  <tr key={i} className="border-b border-slate-200" style={{ breakInside: "avoid" }}>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.urutan ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.tanggal ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_badge ?? "-"}</td>
                    <td className="px-1.5 py-1 break-words">{p?.nama ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_erp ?? "-"}</td>
                    <td className="px-1.5 py-1 break-words">{p?.jabatan_deskripsi ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.kondisi}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{batchLabel(r.pengembalian?.batch)}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{formatPetugas(r.pengembalian?.petugas)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-800 font-semibold">
                <td colSpan={8} className="px-1.5 py-1.5 text-right">SUBTOTAL {section.dept}</td>
                <td className="px-1.5 py-1.5 tabular-nums">{section.rows.length}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <table className="mt-4 w-full border-collapse text-xs" style={{ breakInside: "avoid" }}>
        <tbody>
          <tr className="border-t-4 border-double border-slate-800">
            <td className="py-2 pr-8 text-sm font-bold">GRAND TOTAL</td>
            <td className="py-2 text-right text-sm font-bold tabular-nums">{grandTotal}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 text-xs text-slate-600" style={{ breakInside: "avoid" }}>
        <p className="font-semibold">Catatan:</p>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>Batch = kelompok periode pencatatan pengembalian (Batch 1, 2, 3, dst — bertambah seiring waktu). Setiap batch yang sudah tercetak/dikunci tidak pernah dinomori ulang.</li>
          <li>Nomor urut (No) berjalan berkelanjutan per departemen lintas semua batch — batch berikutnya melanjutkan nomor dari batch sebelumnya, tidak mengulang dari 1. Baris diurutkan dari No Badge terkecil ke terbesar, jadi urutan No pada kolom bisa tidak berurutan.</li>
        </ol>
      </div>
    </main>
  );
}
