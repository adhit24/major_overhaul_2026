import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { formatPetugas, formatRupiah } from "@/lib/pengembalian";
import { DEPARTEMEN } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Row = {
  potongan: number;
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

export default async function CetakKehilanganPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; batch?: string }>;
}) {
  const { q, dept, batch } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pengembalian_detail")
    .select("potongan, pengembalian(tanggal, petugas, batch, urutan, departemen, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
    .eq("item", "KARTU")
    .eq("kondisi", "HILANG");

  const qLower = (q ?? "").toLowerCase();
  const rowsBeforeBatch = ((data ?? []) as unknown as Row[]).filter((r) => {
    const p = r.pengembalian?.peserta;
    if (!p) return false;
    if (dept && p.departemen !== dept) return false;
    if (qLower && !(`${p.nama} ${p.no_badge ?? ""} ${p.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
    return true;
  });

  const availableBatches = [...new Set(rowsBeforeBatch.map((r) => r.pengembalian?.batch).filter((b): b is number => b != null))].sort((a, b) => a - b);
  const batchFilter = batch ? Number(batch) : null;
  const rows = batchFilter == null ? rowsBeforeBatch : rowsBeforeBatch.filter((r) => r.pengembalian?.batch === batchFilter);

  const tabHref = (b: number | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (dept) params.set("dept", dept);
    if (b != null) params.set("batch", String(b));
    const qs = params.toString();
    return `/pengembalian/cetak/kehilangan${qs ? `?${qs}` : ""}`;
  };

  // Kartu HILANG tidak memakai slot urutan bersama (lihat catatPengembalian), jadi tiap
  // SECTION diurutkan dari No Badge terkecil ke terbesar, dan "No" di tabel = nomor lokal
  // 1..N per section (bukan urutan dari daftar Pengembalian yang sudah kembali).
  const badgeNum = (badge: string | null | undefined) => {
    const n = Number(badge);
    return Number.isFinite(n) && badge ? n : Infinity;
  };
  const sections: { dept: string; rows: Row[] }[] = DEPARTEMEN.map((dName) => ({
    dept: dName as string,
    rows: rows
      .filter((r) => (r.pengembalian?.peserta?.departemen ?? "") === dName)
      .sort((a, b) => badgeNum(a.pengembalian?.peserta?.no_badge) - badgeNum(b.pengembalian?.peserta?.no_badge)),
  })).filter((s) => s.rows.length > 0);

  const tanpaDivisi = rows
    .filter((r) => !r.pengembalian?.peserta?.departemen)
    .sort((a, b) => badgeNum(a.pengembalian?.peserta?.no_badge) - badgeNum(b.pengembalian?.peserta?.no_badge));
  if (tanpaDivisi.length > 0) sections.push({ dept: "Tanpa Divisi", rows: tanpaDivisi });

  const grandTotal = rows.length;
  const grandTotalPotongan = rows.reduce((s, r) => s + Number(r.potongan), 0);
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
          <h1 className="text-lg font-bold">DAFTAR KARTU ID HILANG{batchFilter != null ? ` — BATCH ${batchFilter}` : ""}</h1>
          <p className="text-sm">PT. JO Koin One Plant — Dicetak: {dicetak}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      <div className="mt-3 text-xs text-slate-500">
        {batchFilter != null && <>Batch: <b>{batchFilter}</b> · </>}
        {dept && <>Divisi: <b>{dept}</b> · </>}
        {q && <>Cari: &quot;{q}&quot; · </>}
        Total: <b>{grandTotal}</b> kartu · Total Potongan: <b>{formatRupiah(grandTotalPotongan)}</b>
      </div>

      {sections.map((section, si) => {
        const subtotalPotongan = section.rows.reduce((s, r) => s + Number(r.potongan), 0);
        return (
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
                <col className="w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className="border-y border-slate-300 bg-slate-50 text-left">
                  <th className="px-1.5 py-2">No</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">Tanggal</th>
                  <th className="px-1.5 py-2">Badge</th>
                  <th className="px-1.5 py-2">Nama</th>
                  <th className="px-1.5 py-2">PIN</th>
                  <th className="px-1.5 py-2">Jabatan</th>
                  <th className="px-1.5 py-2">Batch</th>
                  <th className="px-1.5 py-2">Petugas</th>
                  <th className="px-1.5 py-2 text-right">Potongan</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r, i) => {
                  const p = r.pengembalian?.peserta;
                  return (
                    <tr key={i} className="border-b border-slate-200" style={{ breakInside: "avoid" }}>
                      <td className="px-1.5 py-1 whitespace-nowrap">{i + 1}</td>
                      <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.tanggal ?? "-"}</td>
                      <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_badge ?? "-"}</td>
                      <td className="px-1.5 py-1 break-words">{p?.nama ?? "-"}</td>
                      <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_erp ?? "-"}</td>
                      <td className="px-1.5 py-1 break-words">{p?.jabatan_deskripsi ?? "-"}</td>
                      <td className="px-1.5 py-1 whitespace-nowrap">{batchLabel(r.pengembalian?.batch)}</td>
                      <td className="px-1.5 py-1 whitespace-nowrap">{formatPetugas(r.pengembalian?.petugas)}</td>
                      <td className="px-1.5 py-1 whitespace-nowrap text-right">{formatRupiah(Number(r.potongan))}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-800 font-semibold">
                  <td colSpan={7} className="px-1.5 py-1.5 text-right">SUBTOTAL {section.dept}</td>
                  <td className="px-1.5 py-1.5 tabular-nums">{section.rows.length}</td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">{formatRupiah(subtotalPotongan)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      <table className="mt-4 w-full border-collapse text-xs" style={{ breakInside: "avoid" }}>
        <tbody>
          <tr className="border-t-4 border-double border-slate-800">
            <td className="py-2 pr-8 text-sm font-bold">GRAND TOTAL</td>
            <td className="py-2 text-right text-sm font-bold tabular-nums">{grandTotal} kartu</td>
            <td className="py-2 pl-8 text-right text-sm font-bold tabular-nums">{formatRupiah(grandTotalPotongan)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 text-xs text-slate-600" style={{ breakInside: "avoid" }}>
        <p className="font-semibold">Catatan:</p>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>Daftar ini khusus kartu ID yang dinyatakan HILANG (tidak kembali secara fisik) - kartu yang kembali (kondisi baik maupun rusak) ada di Daftar Pengembalian.</li>
          <li>Kartu HILANG tidak memakai nomor urut Daftar Pengembalian - nomor No di sini adalah nomor lokal 1..N per departemen, diurutkan dari No Badge terkecil ke terbesar.</li>
          <li>Potongan mengikuti tarif kehilangan yang berlaku saat kejadian dicatat.</li>
        </ol>
      </div>
    </main>
  );
}
