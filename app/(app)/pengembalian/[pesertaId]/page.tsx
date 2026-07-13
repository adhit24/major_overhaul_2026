import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { HapusPengembalianButton } from "@/components/HapusPengembalianButton";
import { EditDetailButton } from "@/components/EditDetailButton";
import { KondisiBadge } from "@/components/KondisiBadge";
import { formatRupiah } from "@/lib/pengembalian";
import { APD_LABELS, type ApdItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function RiwayatPengembalianPage({
  params,
}: {
  params: Promise<{ pesertaId: string }>;
}) {
  const { pesertaId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: p } = await supabase
    .from("peserta")
    .select("id, nama, no_badge, no_erp, departemen, status_badge, jabatan_deskripsi")
    .eq("id", Number(pesertaId))
    .single();
  if (!p) notFound();

  const { data: kejadian } = await supabase
    .from("pengembalian")
    .select("id, tanggal, petugas, catatan, is_migrasi, pengembalian_detail(id, item, kondisi, potongan)")
    .eq("peserta_id", p.id)
    .order("tanggal", { ascending: false });

  const { data: tarifRows } = await supabase.from("tarif_potongan").select("item, tarif_hilang");
  const tarif: Record<string, number> = {};
  for (const t of tarifRows ?? []) tarif[t.item] = Number(t.tarif_hilang);

  return (
    <>
      <TopBar title={`Riwayat Pengembalian — ${p.nama}`} email={userData.user?.email} />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <Link href="/pengembalian" className="text-sm text-slate-400 hover:text-slate-700">← Kembali ke daftar</Link>

        <div className="card">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">No Badge</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">{p.no_badge ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">PIN</p>
              <p className="mt-0.5 text-sm tabular-nums text-slate-700">{p.no_erp ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Divisi</p>
              <p className="mt-0.5 text-sm text-slate-700">{p.departemen ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Jabatan</p>
              <p className="mt-0.5 text-sm text-slate-700">{p.jabatan_deskripsi ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
              <div className="mt-1"><StatusBadge status={p.status_badge} /></div>
            </div>
          </div>
        </div>

        {(kejadian ?? []).length === 0 && (
          <div className="card text-center text-slate-400">Belum ada pengembalian tercatat.</div>
        )}

        {(kejadian ?? []).map((g) => {
          const det = (g.pengembalian_detail as { id: number; item: string; kondisi: string; potongan: number }[] | null) ?? [];
          const total = det.reduce((s, d) => s + Number(d.potongan), 0);
          return (
            <div key={g.id} className="card space-y-3 p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
                <div className="text-sm font-semibold text-slate-700">
                  {g.tanggal} {g.is_migrasi && <span className="ml-2 badge-pill bg-slate-100 text-slate-500">migrasi</span>}
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <Link href={`/pengembalian/${p.id}/bukti/${g.id}`} className="text-brand-600 hover:underline">Cetak Bukti</Link>
                  <HapusPengembalianButton pengembalianId={g.id} pesertaId={p.id} />
                </div>
              </div>
              <div className="overflow-x-auto px-5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Item</th>
                      <th className="py-2 pr-3 font-semibold">Kondisi</th>
                      <th className="py-2 pr-3 text-right font-semibold">Potongan</th>
                      <th className="py-2 pl-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                  {det.map((d) => (
                    <tr key={d.item} className="border-t border-slate-50">
                      <td className="py-2 pr-3 text-slate-700">{APD_LABELS[d.item as ApdItem]}</td>
                      <td className="py-2 pr-3"><KondisiBadge kondisi={d.kondisi} /></td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{Number(d.potongan) ? formatRupiah(Number(d.potongan)) : "-"}</td>
                      <td className="py-2 pl-3 text-right">
                        <EditDetailButton
                          detailId={d.id}
                          pesertaId={p.id}
                          item={d.item as ApdItem}
                          kondisiAwal={d.kondisi}
                          potonganAwal={Number(d.potongan)}
                          tarif={tarif}
                        />
                      </td>
                    </tr>
                  ))}
                  {total > 0 && (
                    <tr className="border-t border-slate-100"><td className="pt-2 font-semibold text-slate-700" colSpan={2}>Total potongan</td><td className="pt-2 text-right font-semibold tabular-nums text-red-600">{formatRupiah(total)}</td><td /></tr>
                  )}
                </tbody>
                </table>
              </div>
              <div className="space-y-1 px-5 pb-4">
                {g.catatan && <p className="text-xs text-slate-500">Catatan: {g.catatan}</p>}
                <p className="text-xs text-slate-400">Petugas: {g.petugas ?? "-"}</p>
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
