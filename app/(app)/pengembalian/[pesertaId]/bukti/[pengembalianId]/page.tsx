import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { formatRupiah } from "@/lib/pengembalian";
import { APD_LABELS, type ApdItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BuktiPage({
  params,
}: {
  params: Promise<{ pesertaId: string; pengembalianId: string }>;
}) {
  const { pesertaId, pengembalianId } = await params;
  const supabase = await createClient();

  const [{ data: p }, { data: g }] = await Promise.all([
    supabase.from("peserta").select("id, nama, no_badge, no_erp, departemen, jabatan_deskripsi").eq("id", Number(pesertaId)).single(),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, petugas, catatan, pengembalian_detail(item, kondisi, potongan)").eq("id", Number(pengembalianId)).single(),
  ]);
  if (!p || !g || g.peserta_id !== p.id) notFound();

  const det = (g.pengembalian_detail as { item: string; kondisi: string; potongan: number }[] | null) ?? [];
  const total = det.reduce((s, d) => s + Number(d.potongan), 0);

  return (
    <main className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_cps_transparent.png" alt="Cirebon Power" className="h-12 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold">BUKTI SERAH TERIMA</h1>
          <p className="text-sm">Pengembalian ID Card & APD — MOH PLTU Cirebon 1</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <p><span className="inline-block w-28 text-slate-500">Nama</span>: <b>{p.nama}</b></p>
        <p><span className="inline-block w-28 text-slate-500">No Badge</span>: {p.no_badge ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">Divisi</span>: {p.departemen ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">PIN / No ERP</span>: {p.no_erp ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">Jabatan</span>: {p.jabatan_deskripsi ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">Tanggal</span>: {g.tanggal}</p>
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="px-3 py-2">No</th>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Kondisi</th>
            <th className="px-3 py-2 text-right">Potongan</th>
          </tr>
        </thead>
        <tbody>
          {det.map((d, i) => (
            <tr key={d.item} className="border-b border-slate-200">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{APD_LABELS[d.item as ApdItem]}</td>
              <td className="px-3 py-2">{d.kondisi}</td>
              <td className="px-3 py-2 text-right">{Number(d.potongan) ? formatRupiah(Number(d.potongan)) : "-"}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total Potongan Deposit</td>
            <td className="px-3 py-2 text-right font-bold">{total ? formatRupiah(total) : "-"}</td>
          </tr>
        </tbody>
      </table>

      {g.catatan && <p className="mt-3 text-sm"><span className="text-slate-500">Catatan:</span> {g.catatan}</p>}

      <section className="mt-12 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p>Yang Menyerahkan,</p>
          <div className="mx-auto mt-20 w-48 border-b border-slate-400" />
          <p className="mt-1 font-medium">{p.nama}</p>
        </div>
        <div>
          <p>Penerima (HSE),</p>
          <div className="mx-auto mt-20 w-48 border-b border-slate-400" />
          <p className="mt-1 font-medium">{g.petugas ?? "(............................)"}</p>
        </div>
      </section>
    </main>
  );
}
