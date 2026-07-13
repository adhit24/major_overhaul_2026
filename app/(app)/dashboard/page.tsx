import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { APD_ITEMS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const [totalBadgeTervalidasi, totalPending, totalPerluVerifikasi, deposits, recentPeserta, pengembalianRes, totalWajibKembali] = await Promise.all([
    supabase
      .from("peserta")
      .select("*", { count: "exact", head: true })
      .eq("tervalidasi_induction", true)
      .not("no_badge", "is", null),
    supabase.from("peserta").select("*", { count: "exact", head: true }).eq("status_badge", "PENDING"),
    supabase.from("peserta").select("*", { count: "exact", head: true }).is("departemen", null),
    supabase.from("deposit_batch").select("jumlah_kartu, total_deposit, status_batch"),
    supabase
      .from("peserta")
      .select("id, nama, departemen, no_badge, status_badge, tanggal_induction")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("pengembalian").select("peserta_id, pengembalian_detail(item)").range(0, 1999),
    supabase
      .from("peserta")
      .select("id")
      .eq("tervalidasi_induction", true)
      .in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"])
      .range(0, 1999),
  ]);

  // "Sudah Ada Badge" dihitung dari baris yang tervalidasi_induction = true, yaitu baris
  // yang sudah dicocokkan 1:1 ke master HRD (SUMMARY_INDUCTION&APD.xlsx, sheet INDUCTION).
  // Bukan COUNT(*) polos (kena duplikat entri lama) atau COUNT(DISTINCT no_badge) (meremehkan
  // badge yang sengaja dipakai ulang untuk orang berbeda dari waktu ke waktu).
  const totalBadgeValid = totalBadgeTervalidasi.count ?? 0;

  const allBatches   = deposits.data ?? [];
  const doneBatches  = allBatches.filter((b) => b.status_batch === "DONE");
  const totalKartu   = doneBatches.reduce((s, b) => s + Number(b.jumlah_kartu ?? 0), 0);
  const totalDeposit = doneBatches.reduce((sum, row) => sum + Number(row.total_deposit ?? 0), 0);

  const validIds = new Set((totalWajibKembali.data ?? []).map((r) => r.id));
  const itemsByPeserta = new Map<number, Set<string>>();
  for (const g of pengembalianRes.data ?? []) {
    if (!validIds.has(g.peserta_id)) continue;
    const set = itemsByPeserta.get(g.peserta_id) ?? new Set<string>();
    for (const d of (g.pengembalian_detail as { item: string }[] | null) ?? []) set.add(d.item);
    itemsByPeserta.set(g.peserta_id, set);
  }
  const nLengkap = [...itemsByPeserta.values()].filter((s) => APD_ITEMS.every((i) => s.has(i))).length;

  return (
    <>
      <TopBar title="Dashboard" email={userData.user?.email} />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard label="Total Kartu Diajukan" value={totalKartu} hint="batch DONE" />
          <StatCard label="Sudah Ada Badge" value={totalBadgeValid} tone="success" />
          <StatCard
            label="Belum Ada Badge (PENDING)"
            value={totalPending.count ?? 0}
            tone={totalPending.count ? "warning" : "default"}
          />
          <Link href="/peserta?departemen=__PERLU_VERIFIKASI__" className="block">
            <StatCard
              label="Departemen Perlu Verifikasi"
              value={totalPerluVerifikasi.count ?? 0}
              tone={totalPerluVerifikasi.count ? "warning" : "default"}
              hint="Klik untuk lihat daftarnya"
            />
          </Link>
          <StatCard label="Total Deposit Tercatat" value={formatRupiah(totalDeposit)} hint={`${doneBatches.length} batch DONE`} />
          <Link href="/pengembalian" className="block">
            <StatCard label="Pengembalian Lengkap" value={`${nLengkap} / ${validIds.size}`} tone="success" hint="Klik untuk detail" />
          </Link>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Input Terbaru</h2>
            <a href="/peserta" className="text-sm font-medium text-brand-600 hover:underline">
              Lihat semua →
            </a>
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
