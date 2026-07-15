import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { KondisiBadge } from "@/components/KondisiBadge";
import { ExportPdfButton, type ExportPdfRow } from "@/components/ExportPdfButton";
import { TarifCard } from "@/components/TarifCard";
import { CatatPengembalianButton } from "@/components/CatatPengembalianModal";
import { computeStatusPengembalian, formatPetugas, formatRupiah } from "@/lib/pengembalian";
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
  const [p1, p2, g1, g2, tarifRes, rugiRes, kartuRes] = await Promise.all([
    supabase.from("peserta").select(cols).eq("tervalidasi_induction", true).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).order("nama").range(0, 999),
    supabase.from("peserta").select(cols).eq("tervalidasi_induction", true).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).order("nama").range(1000, 1999),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, pengembalian_detail(item, kondisi, potongan)").range(0, 999),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, pengembalian_detail(item, kondisi, potongan)").range(1000, 1999),
    supabase.from("tarif_potongan").select("item, tarif_hilang"),
    supabase
      .from("pengembalian_detail")
      .select("item, kondisi, potongan, pengembalian(id, tanggal, petugas, peserta(id, nama, no_badge, departemen))")
      .neq("kondisi", "KEMBALI")
      .order("potongan", { ascending: false }),
    supabase
      .from("pengembalian_detail")
      .select("kondisi, potongan, pengembalian(id, tanggal, petugas, is_migrasi, batch, urutan, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
      .eq("item", "KARTU")
      .neq("kondisi", "HILANG"),
  ]);
  const peserta = [...(p1.data ?? []), ...(p2.data ?? [])];
  const kejadian = [...(g1.data ?? []), ...(g2.data ?? [])];
  const tarif: Record<string, number> = {};
  for (const t of tarifRes.data ?? []) tarif[t.item] = Number(t.tarif_hilang);

  type RugiRow = {
    item: string; kondisi: string; potongan: number;
    pengembalian: { id: number; tanggal: string; petugas: string | null;
      peserta: { id: number; nama: string; no_badge: string | null; departemen: string | null } | null } | null;
  };
  // Urutkan sesuai urutan departemen resmi (bukan alfabetis) supaya mudah dipakai checklist per divisi.
  const deptRank = (d: string | null | undefined) => {
    const i = DEPARTEMEN.indexOf((d ?? "") as (typeof DEPARTEMEN)[number]);
    return i === -1 ? DEPARTEMEN.length : i;
  };
  // Di dalam satu divisi, urutkan no badge kecil -> besar (bukan alfabetis nama).
  const badgeNum = (badge: string | null | undefined) => {
    const n = Number(badge);
    return Number.isFinite(n) && badge ? n : Infinity;
  };
  const batchLabel = (b: number | null | undefined) =>
    b === 1 ? "Batch 1 (dikunci)" : b === 2 ? "Batch 2 — mulai 18 Juli 2026" : `Batch ${b ?? "-"}`;

  const rugiRows = ((rugiRes.data ?? []) as unknown as RugiRow[])
    .slice()
    .sort((a, b) =>
      deptRank(a.pengembalian?.peserta?.departemen) - deptRank(b.pengembalian?.peserta?.departemen) ||
      badgeNum(a.pengembalian?.peserta?.no_badge) - badgeNum(b.pengembalian?.peserta?.no_badge)
    );

  type KartuRow = {
    kondisi: string; potongan: number;
    pengembalian: { id: number; tanggal: string; petugas: string | null; is_migrasi: boolean;
      batch: number | null; urutan: number | null;
      peserta: { id: number; nama: string; no_badge: string | null; no_erp: string | null;
        departemen: string | null; jabatan_deskripsi: string | null } | null } | null;
  };
  // urutan sekarang per-departemen (lihat migrasi 2026-07-15), jadi urutkan departemen dulu
  // (urutan bisnis, bukan alfabetis) baru urutan di dalamnya - hasilnya tiap departemen tampil
  // sebagai blok berurutan 1..N sendiri-sendiri, sama seperti akan tercetak.
  const kartuRows = ((kartuRes.data ?? []) as unknown as KartuRow[])
    .slice()
    .sort((a, b) =>
      deptRank(a.pengembalian?.peserta?.departemen) - deptRank(b.pengembalian?.peserta?.departemen) ||
      (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity)
    );

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

  filtered.sort((a, b) => deptRank(a.departemen) - deptRank(b.departemen) || badgeNum(a.no_badge) - badgeNum(b.no_badge));

  // Pencarian (nama/badge/PIN) & filter divisi juga diterapkan ke daftar kembali & kehilangan,
  // bukan cuma ke tabel checklist utama, supaya satu kotak cari bisa dipakai untuk ketiganya.
  const matchesSearch = (p: { nama?: string; no_badge?: string | null; no_erp?: string | null; departemen?: string | null } | null | undefined) => {
    if (!p) return false;
    if (dept && p.departemen !== dept) return false;
    if (qLower && !(`${p.nama ?? ""} ${p.no_badge ?? ""} ${p.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
    return true;
  };
  const filteredKartuRows = kartuRows.filter((r) => matchesSearch(r.pengembalian?.peserta));
  const filteredRugiRows = rugiRows.filter((r) => matchesSearch(r.pengembalian?.peserta));

  const exportKartuRows: ExportPdfRow[] = filteredKartuRows.map((r) => {
    const p = r.pengembalian?.peserta;
    return {
      no: r.pengembalian?.urutan ?? 0,
      badge: p?.no_badge ?? "-",
      nama: p?.nama ?? "-",
      pin: p?.no_erp ?? "-",
      groupLabel: batchLabel(r.pengembalian?.batch),
      jabatan: p?.jabatan_deskripsi ?? "-",
      kondisi: r.kondisi,
      tanggal: r.pengembalian?.tanggal ?? "-",
      petugas: formatPetugas(r.pengembalian?.petugas),
    };
  });

  const cetakParams = new URLSearchParams();
  if (q) cetakParams.set("q", q);
  if (dept) cetakParams.set("dept", dept);
  const cetakKembaliHref = `/pengembalian/cetak/kembali${cetakParams.toString() ? `?${cetakParams.toString()}` : ""}`;

  return (
    <>
      <TopBar title="Pengembalian ID Card & APD" email={userData.user?.email} />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Lengkap" value={nLengkap} tone="success" />
          <StatCard label="Kurang" value={nKurang} tone="warning" />
          <StatCard label="Belum Kembali" value={nBelum} />
          <StatCard label="ID Card Dikembalikan" value={kartuRows.length} tone="success" hint="Klik untuk detail" href="#daftar-kembali" />
          <StatCard label="Total Potongan" value={formatRupiah(totalPotongan)} tone="danger" hint="Klik untuk detail" href="#daftar-kehilangan" />
        </div>

        <TarifCard tarif={tarif} />

        <form method="get" className="card flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label-field">Cari nama / badge / PIN</label>
            <input name="q" defaultValue={q ?? ""} placeholder="Ketik nama, no badge, atau PIN..." className="input-field" />
          </div>
          <div>
            <label className="label-field">Divisi</label>
            <select name="dept" defaultValue={dept ?? ""} className="input-field">
              <option value="">Semua Divisi</option>
              {DEPARTEMEN.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Status Checklist</label>
            <select name="status" defaultValue={status ?? ""} className="input-field">
              <option value="">Semua Status</option>
              <option value="LENGKAP">LENGKAP</option>
              <option value="KURANG">KURANG</option>
              <option value="BELUM">BELUM</option>
            </select>
          </div>
          <button type="submit" className="btn-primary text-sm">Cari</button>
          {(q || dept || status) && (
            <Link href="/pengembalian" className="btn-ghost text-sm">Reset</Link>
          )}
          <p className="w-full text-xs text-slate-400">
            Pencarian &amp; divisi berlaku untuk daftar kembali, kehilangan, dan tabel checklist di bawah. Status checklist hanya berlaku untuk tabel checklist.
          </p>
        </form>

        {filteredKartuRows.length > 0 && (
          <div id="daftar-kembali" className="card p-0 overflow-hidden scroll-mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Daftar ID Card Dikembalikan</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {filteredKartuRows.length === kartuRows.length
                    ? `${kartuRows.length} kartu sudah dikembalikan`
                    : `${filteredKartuRows.length} dari ${kartuRows.length} kartu (sesuai pencarian)`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link href={cetakKembaliHref} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:underline">
                  Cetak Daftar
                </Link>
                <ExportPdfButton
                  title="DAFTAR ID CARD DIKEMBALIKAN"
                  subtitle="Pengembalian ID Card & APD — MOH PLTU Cirebon 1"
                  rows={exportKartuRows}
                  filename={`daftar-id-card-dikembalikan-${new Date().toISOString().slice(0, 10)}.pdf`}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">No</th>
                    <th className="px-4 py-3">No Badge</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">PIN</th>
                    <th className="px-4 py-3">Jabatan</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Tanggal Kembali</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastDept: string | null | undefined = undefined;
                    return filteredKartuRows.map((r, i) => {
                      const p = r.pengembalian?.peserta;
                      const showGroup = p?.departemen !== lastDept;
                      lastDept = p?.departemen;
                      return (
                        <Fragment key={`${r.pengembalian?.id}-${i}`}>
                          {showGroup && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={9} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {p?.departemen ?? "Tanpa Divisi"}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-slate-50">
                            <td className="px-5 py-2.5 tabular-nums text-slate-500">{r.pengembalian?.urutan ?? "-"}</td>
                            <td className="px-4 py-2.5 tabular-nums">{p?.no_badge ?? "-"}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {p ? <Link href={`/pengembalian/${p.id}`} className="hover:text-brand-600 hover:underline">{p.nama}</Link> : "-"}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-500">{p?.no_erp ?? "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p?.jabatan_deskripsi ?? "-"}</td>
                            <td className="px-4 py-2.5">
                              <span className="badge-pill bg-slate-100 text-slate-600">{batchLabel(r.pengembalian?.batch)}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <KondisiBadge kondisi={r.kondisi} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">
                              {r.pengembalian?.tanggal ?? "-"}
                              {r.pengembalian?.is_migrasi && <span className="ml-2 badge-pill bg-slate-100 text-slate-500">migrasi</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{r.pengembalian?.petugas ?? "-"}</td>
                          </tr>
                        </Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredRugiRows.length > 0 && (
          <div id="daftar-kehilangan" className="card p-0 overflow-hidden scroll-mt-4">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Daftar Kehilangan / Kerusakan</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredRugiRows.length === rugiRows.length
                  ? `${rugiRows.length} item · total potongan ${formatRupiah(totalPotongan)}`
                  : `${filteredRugiRows.length} dari ${rugiRows.length} item (sesuai pencarian)`}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">No Badge</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Divisi</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Petugas</th>
                    <th className="px-4 py-3 text-right">Potongan</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastDept: string | null | undefined = undefined;
                    return filteredRugiRows.map((r, i) => {
                      const p = r.pengembalian?.peserta;
                      const showGroup = p?.departemen !== lastDept;
                      lastDept = p?.departemen;
                      return (
                        <Fragment key={`${r.pengembalian?.id}-${r.item}-${i}`}>
                          {showGroup && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={8} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {p?.departemen ?? "Tanpa Divisi"}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-slate-50">
                            <td className="px-5 py-2.5 tabular-nums">{p?.no_badge ?? "-"}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {p ? <Link href={`/pengembalian/${p.id}`} className="hover:text-brand-600 hover:underline">{p.nama}</Link> : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{p?.departemen ?? "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600">{APD_LABELS[r.item as ApdItem]}</td>
                            <td className="px-4 py-2.5">
                              <KondisiBadge kondisi={r.kondisi} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{r.pengembalian?.tanggal ?? "-"}</td>
                            <td className="px-4 py-2.5 text-slate-500">{r.pengembalian?.petugas ?? "-"}</td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums text-red-600">{formatRupiah(Number(r.potongan))}</td>
                          </tr>
                        </Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Checklist Semua Peserta</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filtered.length === rows.length
                ? `${rows.length} peserta`
                : `${filtered.length} dari ${rows.length} peserta (sesuai pencarian)`}
            </p>
          </div>
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
                {(() => {
                  let lastDept: string | null | undefined = undefined;
                  return filtered.map((r) => {
                    const showGroup = r.departemen !== lastDept;
                    lastDept = r.departemen;
                    return (
                      <Fragment key={r.id}>
                        {showGroup && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              {r.departemen ?? "Tanpa Divisi"}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b border-slate-50">
                          <td className="px-5 py-2.5 tabular-nums">{r.no_badge ?? "-"}</td>
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
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{r.potongan ? formatRupiah(r.potongan) : "-"}</td>
                          <td className="px-4 py-2.5">
                            <CatatPengembalianButton
                              peserta={{ id: r.id, nama: r.nama, no_badge: r.no_badge }}
                              sudahTercatat={r.items}
                              tarif={tarif}
                            />
                          </td>
                        </tr>
                      </Fragment>
                    );
                  });
                })()}
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
