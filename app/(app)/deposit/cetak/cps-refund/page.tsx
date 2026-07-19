import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { DEPARTEMEN } from "@/lib/constants";

export const dynamic = "force-dynamic";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

type RefundRow = {
  id: number;
  tanggal: string;
  departemen: string;
  jumlah_kartu: number;
  jumlah_uang: number;
  no_referensi: string | null;
  petugas: string | null;
  keterangan: string | null;
};

export default async function CetakCpsRefundPage() {
  const supabase = await createClient();

  const { data: batches } = await supabase.from("deposit_batch").select("departemen_section, total_deposit");
  const { data: cpsRefunds } = await supabase
    .from("cps_deposit_refund")
    .select("*")
    .order("departemen", { ascending: true })
    .order("tanggal", { ascending: true });

  const { data: kembaliRows } = await supabase
    .from("pengembalian_detail")
    .select("pengembalian(departemen)")
    .eq("item", "KARTU")
    .neq("kondisi", "HILANG");

  const depositByDept = new Map<string, number>();
  for (const b of batches ?? []) {
    const dept = b.departemen_section ?? "Tanpa Divisi";
    depositByDept.set(dept, (depositByDept.get(dept) ?? 0) + Number(b.total_deposit ?? 0));
  }
  const totalDeposit = [...depositByDept.values()].reduce((s, v) => s + v, 0);

  const kartuKembaliByDept = new Map<string, number>();
  for (const r of (kembaliRows ?? []) as unknown as { pengembalian: { departemen: string | null } | null }[]) {
    const dept = r.pengembalian?.departemen ?? "Tanpa Divisi";
    kartuKembaliByDept.set(dept, (kartuKembaliByDept.get(dept) ?? 0) + 1);
  }
  const totalKembali = [...kartuKembaliByDept.values()].reduce((s, v) => s + v, 0);

  const rows = (cpsRefunds ?? []) as RefundRow[];
  const sections: { dept: string; rows: RefundRow[] }[] = DEPARTEMEN
    .map((d) => ({ dept: d as string, rows: rows.filter((r) => r.departemen === d) }))
    .filter((s) => s.rows.length > 0 || depositByDept.has(s.dept));

  const totalDikembalikanCps = rows.reduce((s, r) => s + Number(r.jumlah_uang), 0);
  const totalKartuDicairkanCps = rows.reduce((s, r) => s + r.jumlah_kartu, 0);
  const standingBalanceTotal = totalDeposit - totalDikembalikanCps;
  const selisihKartuTotal = totalKembali - totalKartuDicairkanCps;

  const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  return (
    <main className="mx-auto max-w-5xl bg-white p-8 text-slate-900 print:p-0">
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_cps_transparent.png" alt="Cirebon Power" className="h-12 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold">LAPORAN STANDING DANA DEPOSIT ID CARD — CPS</h1>
          <p className="text-sm">PT. JO Koin One Plant — Dicetak: {dicetak}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      {/* Ringkasan keseluruhan */}
      <table className="mt-4 w-full border-collapse text-xs" style={{ breakInside: "avoid" }}>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="py-1 pr-4 text-slate-500">Total Deposit</td>
            <td className="py-1 text-right font-semibold tabular-nums">{formatRupiah(totalDeposit)}</td>
            <td className="py-1 pl-8 pr-4 text-slate-500">Kartu Sudah Kembali (pekerja)</td>
            <td className="py-1 text-right font-semibold tabular-nums">{totalKembali}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-1 pr-4 text-slate-500">Total Dikembalikan CPS</td>
            <td className="py-1 text-right font-semibold tabular-nums">{formatRupiah(totalDikembalikanCps)}</td>
            <td className="py-1 pl-8 pr-4 text-slate-500">Kartu Sudah Dicairkan CPS</td>
            <td className="py-1 text-right font-semibold tabular-nums">{totalKartuDicairkanCps}</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-slate-500">Standing Balance</td>
            <td className="py-1 text-right font-bold tabular-nums">{formatRupiah(standingBalanceTotal)}</td>
            <td className="py-1 pl-8 pr-4 text-slate-500">Selisih Kartu</td>
            <td className={`py-1 text-right font-bold tabular-nums ${selisihKartuTotal < 0 ? "text-red-600" : ""}`}>{selisihKartuTotal}</td>
          </tr>
        </tbody>
      </table>

      {sections.map((section, si) => {
        const dep = depositByDept.get(section.dept) ?? 0;
        const dikembalikan = section.rows.reduce((s, r) => s + Number(r.jumlah_uang), 0);
        const kartuKembali = kartuKembaliByDept.get(section.dept) ?? 0;
        const kartuDicairkan = section.rows.reduce((s, r) => s + r.jumlah_kartu, 0);
        return (
          <section key={section.dept} className="mt-6" style={{ breakInside: "avoid" }}>
            <h2 className="bg-slate-800 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
              SECTION {si + 1}: {section.dept}
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              Total Deposit: <b>{formatRupiah(dep)}</b> · Dikembalikan CPS: <b>{formatRupiah(dikembalikan)}</b> ·
              {" "}Standing Balance: <b>{formatRupiah(dep - dikembalikan)}</b> · Kartu Kembali: <b>{kartuKembali}</b> ·
              {" "}Kartu Dicairkan: <b>{kartuDicairkan}</b> · Selisih: <b className={kartuKembali - kartuDicairkan < 0 ? "text-red-600" : ""}>{kartuKembali - kartuDicairkan}</b>
            </p>
            {section.rows.length === 0 ? (
              <p className="mt-1 text-[10px] italic text-slate-400">Belum ada transaksi pengembalian dana dari CPS untuk departemen ini.</p>
            ) : (
              <table className="mt-1 w-full table-fixed border-collapse text-[11px]">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                  <col className="w-[39%]" />
                </colgroup>
                <thead>
                  <tr className="border-y border-slate-300 bg-slate-50 text-left">
                    <th className="px-1.5 py-2">Tanggal</th>
                    <th className="px-1.5 py-2">Jml Kartu</th>
                    <th className="px-1.5 py-2">Jumlah Uang</th>
                    <th className="px-1.5 py-2">No. Referensi</th>
                    <th className="px-1.5 py-2">Petugas</th>
                    <th className="px-1.5 py-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-200" style={{ breakInside: "avoid" }}>
                      <td className="px-1.5 py-1 whitespace-nowrap">{r.tanggal}</td>
                      <td className="px-1.5 py-1 tabular-nums">{r.jumlah_kartu}</td>
                      <td className="px-1.5 py-1 tabular-nums whitespace-nowrap">{formatRupiah(Number(r.jumlah_uang))}</td>
                      <td className="px-1.5 py-1 break-words">{r.no_referensi ?? "-"}</td>
                      <td className="px-1.5 py-1 break-words">{r.petugas ?? "-"}</td>
                      <td className="px-1.5 py-1 break-words">{r.keterangan ?? "-"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-800 font-semibold">
                    <td className="px-1.5 py-1.5 text-right" colSpan={1}>SUBTOTAL {section.dept}</td>
                    <td className="px-1.5 py-1.5 tabular-nums">{kartuDicairkan}</td>
                    <td className="px-1.5 py-1.5 tabular-nums whitespace-nowrap">{formatRupiah(dikembalikan)}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      <table className="mt-4 w-full border-collapse text-xs" style={{ breakInside: "avoid" }}>
        <tbody>
          <tr className="border-t-4 border-double border-slate-800">
            <td className="py-2 pr-8 text-sm font-bold">GRAND TOTAL — Standing Balance</td>
            <td className="py-2 text-right text-sm font-bold tabular-nums">{formatRupiah(standingBalanceTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 text-xs text-slate-600" style={{ breakInside: "avoid" }}>
        <p className="font-semibold">Catatan:</p>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>Standing Balance = Total Deposit − Total Dikembalikan CPS, dihitung per departemen dan keseluruhan.</li>
          <li>Nominal Dikembalikan CPS diinput manual berdasarkan kwitansi/bukti transfer dari CPS — tidak dihitung otomatis dari jumlah kartu yang kembali, karena pencairan CPS tidak selalu proporsional/real-time.</li>
          <li>Selisih Kartu = Kartu Sudah Kembali (pekerja) − Kartu Sudah Dicairkan CPS. Nilai negatif berarti CPS mencatat lebih banyak kartu cair daripada yang benar-benar kembali secara fisik — perlu ditelusuri.</li>
        </ol>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-6 text-xs" style={{ breakInside: "avoid" }}>
        <div className="text-center">
          <p>Dibuat oleh,</p>
          <div className="mt-16 border-t border-slate-800 pt-1">
            <p className="text-slate-400">(Nama &amp; Tanggal)</p>
          </div>
        </div>
        <div className="text-center">
          <p>Diperiksa oleh,</p>
          <div className="mt-16 border-t border-slate-800 pt-1">
            <p className="text-slate-400">(Nama &amp; Tanggal)</p>
          </div>
        </div>
        <div className="text-center">
          <p>Disetujui oleh,</p>
          <div className="mt-16 border-t border-slate-800 pt-1">
            <p className="text-slate-400">(Nama &amp; Tanggal)</p>
          </div>
        </div>
      </div>
    </main>
  );
}
