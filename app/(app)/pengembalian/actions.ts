"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { APD_ITEMS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";

// Batas kunci tiap batch pengembalian (tanggal terakhir yang masuk batch tsb, inklusif).
// Begitu satu batch dikunci pada tanggal tertentu, tambahkan entri baru di sini alih-alih
// mengubah baris yang sudah ada - urutan tetap berkelanjutan per departemen lintas batch,
// cuma label batch-nya yang berganti otomatis begitu tanggal pengembalian lewat cutoff.
const BATCH_CUTOFFS: { through: string; batch: number }[] = [
  { through: "2026-07-15", batch: 1 },
  { through: "2026-07-20", batch: 2 },
];
function batchForTanggal(tanggal: string): number {
  for (const c of BATCH_CUTOFFS) if (tanggal <= c.through) return c.batch;
  return BATCH_CUTOFFS[BATCH_CUTOFFS.length - 1].batch + 1;
}

function revalidateAll() {
  revalidatePath("/pengembalian");
  revalidatePath("/dashboard");
  revalidatePath("/deposit");
  revalidatePath("/peserta");
}

export async function catatPengembalian(formData: FormData) {
  const pesertaId = Number(formData.get("peserta_id"));
  const tanggal = String(formData.get("tanggal") ?? "") || null;
  const catatan = String(formData.get("catatan") ?? "").trim() || null;

  const items: { item: ApdItem; kondisi: string; potongan: number }[] = [];
  for (const item of APD_ITEMS) {
    if (formData.get(`item_${item}`) !== "on") continue;
    const kondisi = String(formData.get(`kondisi_${item}`) ?? "KEMBALI");
    const potongan = Number(formData.get(`potongan_${item}`) ?? 0);
    if (!KONDISI_ITEM.includes(kondisi as (typeof KONDISI_ITEM)[number]))
      return { error: `Kondisi tidak valid untuk ${item}.` };
    if (!Number.isFinite(potongan) || potongan < 0)
      return { error: `Potongan tidak valid untuk ${item}.` };
    items.push({ item, kondisi, potongan });
  }

  if (!pesertaId) return { error: "Peserta tidak valid." };
  if (!tanggal) return { error: "Tanggal wajib diisi." };
  if (items.length === 0) return { error: "Pilih minimal satu item yang dikembalikan." };

  const supabase = await createClient();

  const { data: peserta, error: pesertaErr } = await supabase
    .from("peserta").select("id, status_badge, departemen").eq("id", pesertaId).single();
  if (pesertaErr || !peserta) return { error: "Peserta tidak ditemukan." };

  // item yang sudah pernah tercatat utk peserta ini (lintas kejadian)
  const { data: existing } = await supabase
    .from("pengembalian")
    .select("id, pengembalian_detail(item)")
    .eq("peserta_id", pesertaId);
  const sudah = new Set(
    (existing ?? []).flatMap((g) =>
      (g.pengembalian_detail as { item: string }[] | null ?? []).map((d) => d.item)
    )
  );
  const dobel = items.filter((i) => sudah.has(i.item));
  if (dobel.length)
    return { error: `Item sudah pernah tercatat: ${dobel.map((d) => d.item).join(", ")}.` };

  const { data: userData } = await supabase.auth.getUser();
  const petugas = userData.user?.email ?? null;

  // Batch sebuah kejadian ditentukan dari tanggal pengembaliannya lewat BATCH_CUTOFFS (batch
  // yang sudah lewat cutoff-nya tidak pernah di-renumber lagi). Penomoran "urutan" berlanjut
  // dari yang terakhir DALAM DEPARTEMEN PESERTA ITU SAJA (bukan lintas departemen, dan lintas
  // semua batch - bukan reset per batch), supaya laporan per divisi tetap bernomor rapi 1..N.
  // Kartu HILANG tetap dapat label batch (untuk modul Kartu Hilang) tapi TIDAK memakai slot
  // urutan - urutan itu daftar kartu yang benar-benar kembali saja, supaya nomornya tidak
  // "dimakan" kartu hilang yang justru punya daftar/cetak sendiri.
  const kartuItem = items.find((i) => i.item === "KARTU");
  let batchFields:
    | { batch: number; urutan: number; departemen: string | null }
    | { batch: number; departemen: string | null }
    | { departemen: string | null } = {
    departemen: peserta.departemen,
  };
  if (kartuItem && kartuItem.kondisi === "HILANG") {
    batchFields = { batch: batchForTanggal(tanggal), departemen: peserta.departemen };
  } else if (kartuItem) {
    // .eq("departemen", null) serializes as a literal equality (matches nothing), not an
    // IS NULL check - peserta tanpa departemen butuh .is() supaya lookup MAX(urutan)-nya
    // tetap benar dan tidak selalu jatuh ke 1 (yang akan bikin urutan dobel diam-diam).
    let maxQuery = supabase
      .from("pengembalian")
      .select("urutan")
      .not("urutan", "is", null)
      .order("urutan", { ascending: false })
      .limit(1);
    maxQuery = peserta.departemen
      ? maxQuery.eq("departemen", peserta.departemen)
      : maxQuery.is("departemen", null);
    const { data: maxRow } = await maxQuery.maybeSingle();
    batchFields = { batch: batchForTanggal(tanggal), urutan: (maxRow?.urutan ?? 0) + 1, departemen: peserta.departemen };
  }

  const { data: kejadian, error: insErr } = await supabase
    .from("pengembalian")
    .insert({ peserta_id: pesertaId, tanggal, catatan, petugas, ...batchFields })
    .select("id")
    .single();
  if (insErr || !kejadian) return { error: insErr?.message ?? "Gagal menyimpan kejadian." };

  const { error: detErr } = await supabase.from("pengembalian_detail").insert(
    items.map((i) => ({ pengembalian_id: kejadian.id, item: i.item, kondisi: i.kondisi, potongan: i.potongan }))
  );
  if (detErr) {
    await supabase.from("pengembalian").delete().eq("id", kejadian.id);
    return { error: detErr.message };
  }

  const kartu = items.find((i) => i.item === "KARTU");
  if (kartu) {
    const newStatus = kartu.kondisi === "HILANG" ? "HANGUS" : "RETURNED";
    await supabase.from("peserta").update({ status_badge: newStatus }).eq("id", pesertaId);
  }

  revalidateAll();
  return { ok: true };
}

export async function updatePengembalianDetail(formData: FormData) {
  const detailId = Number(formData.get("detail_id"));
  const pesertaId = Number(formData.get("peserta_id"));
  const item = String(formData.get("item") ?? "");
  const kondisi = String(formData.get("kondisi") ?? "");
  const potongan = Number(formData.get("potongan") ?? 0);

  if (!detailId || !pesertaId) return { error: "Data tidak valid." };
  if (!KONDISI_ITEM.includes(kondisi as (typeof KONDISI_ITEM)[number]))
    return { error: "Kondisi tidak valid." };
  if (!Number.isFinite(potongan) || potongan < 0) return { error: "Potongan tidak valid." };

  const supabase = await createClient();

  // Kartu HILANG tidak memakai slot urutan (lihat catatPengembalian) - kalau kondisi KARTU
  // diubah masuk/keluar dari HILANG lewat edit, lepas atau berikan slot urutan supaya
  // aturan itu tetap konsisten, bukan cuma berlaku saat input pertama.
  if (item === "KARTU") {
    const { data: detailRow } = await supabase
      .from("pengembalian_detail")
      .select("kondisi, pengembalian_id, pengembalian(urutan, departemen)")
      .eq("id", detailId)
      .single();
    const oldKondisi = detailRow?.kondisi;
    const g = detailRow?.pengembalian as unknown as { urutan: number | null; departemen: string | null } | null;
    if (oldKondisi && oldKondisi !== "HILANG" && kondisi === "HILANG" && g?.urutan != null) {
      await supabase.from("pengembalian").update({ urutan: null }).eq("id", detailRow!.pengembalian_id);
    } else if (oldKondisi === "HILANG" && kondisi !== "HILANG" && g && g.urutan == null) {
      let maxQuery = supabase.from("pengembalian").select("urutan").not("urutan", "is", null).order("urutan", { ascending: false }).limit(1);
      maxQuery = g.departemen ? maxQuery.eq("departemen", g.departemen) : maxQuery.is("departemen", null);
      const { data: maxRow } = await maxQuery.maybeSingle();
      await supabase.from("pengembalian").update({ urutan: (maxRow?.urutan ?? 0) + 1 }).eq("id", detailRow!.pengembalian_id);
    }
  }

  const { error } = await supabase
    .from("pengembalian_detail")
    .update({ kondisi, potongan })
    .eq("id", detailId);
  if (error) return { error: error.message };

  if (item === "KARTU") {
    const newStatus = kondisi === "HILANG" ? "HANGUS" : "RETURNED";
    await supabase.from("peserta").update({ status_badge: newStatus }).eq("id", pesertaId);
  }

  revalidateAll();
  return { ok: true };
}

export async function batalkanPengembalianDetail(formData: FormData) {
  const detailId = Number(formData.get("detail_id"));
  const pesertaId = Number(formData.get("peserta_id"));
  const item = String(formData.get("item") ?? "");
  if (!detailId || !pesertaId) return { error: "Data tidak valid." };

  const supabase = await createClient();

  const { data: detailRow } = await supabase
    .from("pengembalian_detail")
    .select("id, pengembalian_id")
    .eq("id", detailId)
    .single();
  if (!detailRow) return { error: "Data pengembalian tidak ditemukan." };

  const { error: delErr } = await supabase.from("pengembalian_detail").delete().eq("id", detailId);
  if (delErr) return { error: delErr.message };

  // kejadian yang jadi kosong (semua item-nya dibatalkan) ikut dibersihkan
  const { data: sisaDetail } = await supabase
    .from("pengembalian_detail")
    .select("id")
    .eq("pengembalian_id", detailRow.pengembalian_id);
  const kejadianKosong = !sisaDetail || sisaDetail.length === 0;
  if (kejadianKosong) {
    await supabase.from("pengembalian").delete().eq("id", detailRow.pengembalian_id);
  } else if (item === "KARTU") {
    // kejadian masih punya item lain (mis. HELM) - lepas slot nomor urut KARTU-nya,
    // kejadian & item lainnya tetap aman
    await supabase.from("pengembalian").update({ urutan: null }).eq("id", detailRow.pengembalian_id);
  }

  if (item === "KARTU") {
    await supabase.from("peserta").update({ status_badge: "ACTIVE" }).eq("id", pesertaId);
  }

  revalidateAll();
  return { ok: true };
}

export async function hapusPengembalian(formData: FormData) {
  const pengembalianId = Number(formData.get("pengembalian_id"));
  const pesertaId = Number(formData.get("peserta_id"));
  if (!pengembalianId || !pesertaId) return { error: "Data tidak valid." };

  const supabase = await createClient();

  const { data: detail } = await supabase
    .from("pengembalian_detail")
    .select("item")
    .eq("pengembalian_id", pengembalianId);
  const punyaKartu = (detail ?? []).some((d) => d.item === "KARTU");

  const { error } = await supabase.from("pengembalian").delete().eq("id", pengembalianId);
  if (error) return { error: error.message };

  if (punyaKartu) {
    // masih ada kejadian KARTU lain? (harusnya tidak, tapi cek utk aman)
    const { data: sisa } = await supabase
      .from("pengembalian")
      .select("id, pengembalian_detail(item)")
      .eq("peserta_id", pesertaId);
    const masihAdaKartu = (sisa ?? []).some((g) =>
      (g.pengembalian_detail as { item: string }[] | null ?? []).some((d) => d.item === "KARTU")
    );
    if (!masihAdaKartu) {
      await supabase.from("peserta").update({ status_badge: "ACTIVE" }).eq("id", pesertaId);
    }
  }

  revalidateAll();
  return { ok: true };
}

export async function updateTarif(formData: FormData) {
  const supabase = await createClient();
  for (const item of APD_ITEMS) {
    const raw = formData.get(`tarif_${item}`);
    if (raw === null) continue;
    const tarif = Number(raw);
    if (!Number.isFinite(tarif) || tarif < 0) return { error: `Tarif tidak valid untuk ${item}.` };
    const { error } = await supabase
      .from("tarif_potongan")
      .update({ tarif_hilang: tarif, updated_at: new Date().toISOString() })
      .eq("item", item);
    if (error) return { error: error.message };
  }
  revalidatePath("/pengembalian");
  return { ok: true };
}
