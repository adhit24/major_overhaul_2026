import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MotionStagger } from "@/components/MotionStagger";

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M6 15h5M14 9h4M14 13h4" />
    </svg>
  );
}

function IconCheckBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export const dynamic = "force-dynamic";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Supabase/PostgREST membatasi maksimum 1000 baris per request walau range()
  // diminta lebih besar - query yang populasinya bisa >1000 (peserta id, kejadian
  // pengembalian) WAJIB dipecah 2 batch range(0,999)+range(1000,1999), pola yang
  // sama dipakai di app/(app)/manpower/page.tsx.
  const [
    totalBadgeTervalidasi, deposits, recentPeserta,
    pengembalian1, pengembalian2, wajibKembali1, wajibKembali2,
  ] = await Promise.all([
    supabase
      .from("peserta")
      .select("*", { count: "exact", head: true })
      .eq("tervalidasi_induction", true)
      .not("no_badge", "is", null),
    supabase.from("deposit_batch").select("jumlah_kartu, total_deposit, status_batch"),
    supabase
      .from("peserta")
      .select("id, nama, departemen, no_badge, status_badge, tanggal_induction")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("pengembalian").select("peserta_id, pengembalian_detail(item, kondisi)").range(0, 999),
    supabase.from("pengembalian").select("peserta_id, pengembalian_detail(item, kondisi)").range(1000, 1999),
    supabase.from("peserta").select("id").eq("tervalidasi_induction", true).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).range(0, 999),
    supabase.from("peserta").select("id").eq("tervalidasi_induction", true).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).range(1000, 1999),
  ]);
  const pengembalianRes = { data: [...(pengembalian1.data ?? []), ...(pengembalian2.data ?? [])] };
  const totalWajibKembali = { data: [...(wajibKembali1.data ?? []), ...(wajibKembali2.data ?? [])] };

  // "Sudah Ada Badge" dihitung dari baris yang tervalidasi_induction = true, yaitu baris
  // yang sudah dicocokkan 1:1 ke master HRD (SUMMARY_INDUCTION&APD.xlsx, sheet INDUCTION).
  // Bukan COUNT(*) polos (kena duplikat entri lama) atau COUNT(DISTINCT no_badge) (meremehkan
  // badge yang sengaja dipakai ulang untuk orang berbeda dari waktu ke waktu).
  const totalBadgeValid = totalBadgeTervalidasi.count ?? 0;

  const allBatches   = deposits.data ?? [];
  const doneBatches  = allBatches.filter((b) => b.status_batch === "DONE");
  const totalKartu   = doneBatches.reduce((s, b) => s + Number(b.jumlah_kartu ?? 0), 0);
  const totalDeposit = doneBatches.reduce((sum, row) => sum + Number(row.total_deposit ?? 0), 0);
  const tarifKartuRata = totalKartu > 0 ? totalDeposit / totalKartu : 50000;

  const validIds = new Set((totalWajibKembali.data ?? []).map((r) => r.id));
  const kartuKondisiByPeserta = new Map<number, string>();
  for (const g of pengembalianRes.data ?? []) {
    if (!validIds.has(g.peserta_id)) continue;
    for (const d of (g.pengembalian_detail as { item: string; kondisi: string }[] | null) ?? []) {
      if (d.item === "KARTU") kartuKondisiByPeserta.set(g.peserta_id, d.kondisi);
    }
  }
  const nKartuKembali = [...kartuKondisiByPeserta.values()].filter((k) => k !== "HILANG").length;
  const nKartuTersisa = Math.max(totalKartu - nKartuKembali, 0);
  const nominalSisaPengembalian = nKartuTersisa * tarifKartuRata;

  return (
    <>
      <TopBar title="Dashboard" email={userData.user?.email} />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <MotionStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Kartu Diajukan" value={totalKartu} hint="batch DONE" icon={<IconCard />} />
          <StatCard label="Sudah Ada Badge" value={totalBadgeValid} tone="success" icon={<IconCheckBadge />} />
          <StatCard
            label="ID Badge Sudah Kembali"
            value={nKartuKembali}
            tone="success"
            hint="Kartu fisik sudah kembali"
            href="/pengembalian"
            icon={<IconCheckBadge />}
          />
          <StatCard
            label="ID Badge Tersisa"
            value={nKartuTersisa}
            tone={nKartuTersisa ? "warning" : "default"}
            hint="Belum tercatat kembali"
            href="/pengembalian"
            icon={<IconWarning />}
          />
          <StatCard label="Total Deposit Tercatat" value={formatRupiah(totalDeposit)} hint={`${doneBatches.length} batch DONE`} icon={<IconMoney />} />
          <StatCard
            label="Nominal Sisa Pengembalian"
            value={formatRupiah(nominalSisaPengembalian)}
            tone={nominalSisaPengembalian > 0 ? "warning" : "default"}
            hint={`${nKartuTersisa} ID badge tersisa`}
            href="/deposit"
            icon={<IconWarning />}
          />
        </MotionStagger>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Input Terbaru</h2>
            <Link href="/peserta" className="text-sm font-medium text-brand-600 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-4">Nama</th>
                  <th className="py-2 pr-4">Departemen</th>
                  <th className="py-2 pr-4">No Badge</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Tanggal Induction</th>
                </tr>
              </thead>
              <tbody>
                {(recentPeserta.data ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 font-medium text-slate-800">{p.nama}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {p.departemen ?? <span className="badge-pill bg-orange-50 text-orange-700">Perlu Verifikasi</span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{p.no_badge ?? "-"}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={p.status_badge} />
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{p.tanggal_induction ?? "-"}</td>
                  </tr>
                ))}
                {(recentPeserta.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Belum ada data. Mulai input lewat menu Database Peserta.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
