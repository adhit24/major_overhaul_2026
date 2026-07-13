import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TarifCard } from "@/components/TarifCard";
import { CatatPengembalianButton } from "@/components/CatatPengembalianModal";
import { computeStatusPengembalian, formatRupiah } from "@/lib/pengembalian";
import { APD_LABELS, DEPARTEMEN, type ApdItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  LENGKAP: "bg-emerald-50 text-emerald-700",
  KURANG: "bg-amber-50 text-amber-700",
  BELUM: "bg-slate-100 text-slate-500",
};

export default async function PengembalianPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; status?: string }>;
}) {
  const { q, dept, status } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Populasi dibatasi ke peserta tervalidasi_induction=true agar konsisten dengan
  // kartu "Sudah Ada Badge" di Dashboard (baris yang sudah dicocokkan 1:1 ke master HRD).
  // Supabase/PostgREST membatasi maksimum 1000 baris per request walau range()
  // diminta lebih besar - semua query yang populasinya bisa >1000 dipecah 2 batch.
  const cols = "id, no_badge, no_erp, nama, departemen, status_badge";
  const [p1, p2, g1, g2, tarifRes] = await Promise.all([
    supabase.from("peserta").select(cols).eq("tervalidasi_induction", true).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).order("nama").range(0, 999),
    supabase.from("peserta").select(cols).eq("tervalidasi_induction", true).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).order("nama").range(1000, 1999),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, pengembalian_detail(item, kondisi, potongan)").range(0, 999),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, pengembalian_detail(item, kondisi, potongan)").range(1000, 1999),
    supabase.from("tarif_potongan").select("item, tarif_hilang"),
  ]);
  const peserta = [...(p1.data ?? []), ...(p2.data ?? [])];
  const kejadian = [...(g1.data ?? []), ...(g2.data ?? [])];
  const tarif: Record<string, number> = {};
  for (const t of tarifRes.data ?? []) tarif[t.item] = Number(t.tarif_hilang);

  // agregasi per peserta
  const itemsByPeserta = new Map<number, string[]>();
  const potonganByPeserta = new Map<number, number>();
  for (const g of kejadian) {
    const det = (g.pengembalian_detail as { item: string; potongan: number }[] | null) ?? [];
    const arr = itemsByPeserta.get(g.peserta_id) ?? [];
    for (const d of det) {
      arr.push(d.item);
      potonganByPeserta.set(g.peserta_id, (potonganByPeserta.get(g.peserta_id) ?? 0) + Number(d.potongan));
    }
    itemsByPeserta.set(g.peserta_id, arr);
  }

  const rows = peserta.map((p) => {
    const items = itemsByPeserta.get(p.id) ?? [];
    const { status: st, missing } = computeStatusPengembalian(items);
    return { ...p, st, missing, items, potongan: potonganByPeserta.get(p.id) ?? 0 };
  });

  const nLengkap = rows.filter((r) => r.st === "LENGKAP").length;
  const nKurang = rows.filter((r) => r.st === "KURANG").length;
  const nBelum = rows.filter((r) => r.st === "BELUM").length;
  const totalPotongan = rows.reduce((s, r) => s + r.potongan, 0);

  const qLower = (q ?? "").toLowerCase();
  const filtered = rows.filter((r) => {
    if (dept && r.departemen !== dept) return false;
    if (status && r.st !== status) return false;
    if (qLower && !(`${r.nama} ${r.no_badge ?? ""} ${r.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
    return true;
  });

  return (
    <>
      <TopBar title="Pengembalian ID Card & APD" email={userData.user?.email} />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card"><p className="text-xs text-slate-500">Lengkap</p><p className="text-xl font-bold text-emerald-600">{nLengkap}</p></div>
          <div className="card"><p className="text-xs text-slate-500">Kurang</p><p className="text-xl font-bold text-amber-600">{nKurang}</p></div>
          <div className="card"><p className="text-xs text-slate-500">Belum Kembali</p><p className="text-xl font-bold text-slate-700">{nBelum}</p></div>
          <div className="card"><p className="text-xs text-slate-500">Total Potongan</p><p className="text-xl font-bold text-red-600">{formatRupiah(totalPotongan)}</p></div>
        </div>

        <TarifCard tarif={tarif} />

        <form method="get" className="flex flex-wrap items-end gap-3">
          <input name="q" defaultValue={q ?? ""} placeholder="Cari nama / badge / PIN" className="input-field w-64" />
          <select name="dept" defaultValue={dept ?? ""} className="input-field">
            <option value="">Semua Divisi</option>
            {DEPARTEMEN.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ""} className="input-field">
            <option value="">Semua Status</option>
            <option value="LENGKAP">LENGKAP</option>
            <option value="KURANG">KURANG</option>
            <option value="BELUM">BELUM</option>
          </select>
          <button type="submit" className="btn-primary text-sm">Filter</button>
        </form>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">No Badge</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Divisi</th>
                  <th className="px-4 py-3">Status Badge</th>
                  <th className="px-4 py-3">Pengembalian</th>
                  <th className="px-4 py-3 text-right">Potongan</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5">{r.no_badge ?? "-"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      <Link href={`/pengembalian/${r.id}`} className="hover:text-brand-600 hover:underline">{r.nama}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.departemen ?? "-"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status_badge} /></td>
                    <td className="px-4 py-2.5">
                      <span className={`badge-pill ${STATUS_STYLE[r.st]}`}>{r.st}</span>
                      {r.st === "KURANG" && (
                        <span className="ml-2 text-xs text-slate-400">
                          kurang: {r.missing.map((m) => APD_LABELS[m as ApdItem]).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{r.potongan ? formatRupiah(r.potongan) : "-"}</td>
                    <td className="px-4 py-2.5">
                      <CatatPengembalianButton
                        peserta={{ id: r.id, nama: r.nama, no_badge: r.no_badge }}
                        sudahTercatat={r.items}
                        tarif={tarif}
                      />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Tidak ada data cocok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
