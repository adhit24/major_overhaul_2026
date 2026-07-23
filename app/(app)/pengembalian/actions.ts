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
  { through: "2026-07-23", batch: 3 },
];
function batchForTanggal(tanggal: string): number {
  for (const c of BATCH_CUTOFFS) if (tanggal <= c.through) return c.batch;
  return BATCH_CUTOFFS[BATCH_CUTOFFS.length - 1].batch + 1;
}

function isLockedBatch(batch: number | null | undefined): batch is number {
  return batch != null && BATCH_CUTOFFS.some((c) => c.batch === batch);
}

function lockedBatchError(batch: number) {
  return `Batch ${batch} sudah ditutup/dikunci. Data di batch terkunci tidak bisa ditambah, diedit, dibatalkan, atau dihapus.`;
}

// Kartu HILANG tidak memakai slot urutan (lihat catatPengembalian). Untuk kartu yang
// benar-benar kembali, urutan HARUS mengikuti No Badge terkecil -> terbesar di dalam batch
// yang sama (permintaan user) - jadi tiap kali ada insert baru atau kondisi HILANG berubah
// jadi kembali, seluruh batch+departemen itu dinomori ulang dari No Badge, bukan cuma
// ditambah di akhir. Batch lain (termasuk yang sudah lewat cutoff-nya) tidak pernah disentuh.
async function renumberBatchByBadge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departemen: string | null,
  batch: number
) {
  if (isLockedBatch(batch)) return;

  let q = supabase
    .from("pengembalian")
    .select("id, urutan, peserta(no_badge), pengembalian_detail(item, kondisi)")
    .eq("batch", batch);
  q = departemen ? q.eq("departemen", departemen) : q.is("departemen", null);
  const { data: rows } = await q;

  const eligible = (rows ?? []).filter((r) => {
    const det = (r.pengembalian_detail as { item: string; kondisi: string }[] | null) ?? [];
    const kartu = det.find((d) => d.item === "KARTU");
    return !!kartu && kartu.kondisi !== "HILANG";
  });
  if (eligible.length === 0) return;

  let prevMaxQuery = supabase
    .from("pengembalian")
    .select("urutan")
    .not("urutan", "is", null)
    .lt("batch", batch)
    .order("urutan", { ascending: false })
    .limit(1);
  prevMaxQuery = departemen ? prevMaxQuery.eq("departemen", departemen) : prevMaxQuery.is("departemen", null);
  const { data: prevMaxRow } = await prevMaxQuery.maybeSingle();
  const offset = prevMaxRow?.urutan ?? 0;

  const badgeNum = (badge: string | null | undefined) => {
    const n = Number(String(badge ?? "").replace(/[^0-9]/g, ""));
    return Number.isFinite(n) && badge ? n : Number.MAX_SAFE_INTEGER;
  };

  const sorted = [...eligible].sort((a, b) => {
    const pa = a.peserta as unknown as { no_badge: string | null } | null;
    const pb = b.peserta as unknown as { no_badge: string | null } | null;
    return badgeNum(pa?.no_badge) - badgeNum(pb?.no_badge);
  });

  await Promise.all(
    sorted.map((row, i) => {
      const newUrutan = offset + i + 1;
      if (row.urutan === newUrutan) return null;
      return supabase.from("pengembalian").update({ urutan: newUrutan }).eq("id", row.id);
    })
  );
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
  // yang sudah lewat cutoff-nya tidak pernah di-renumber lagi). Urutan-nya sendiri baru
  // dihitung SETELAH insert lewat renumberBatchByBadge (badge terkecil -> terbesar per
  // departemen dalam batch itu) - kartu HILANG tetap dapat label batch tapi tidak dinomori.
  const kartuItem = items.find((i) => i.item === "KARTU");
  let batchFields: { batch: number; departemen: string | null } | { departemen: string | null };
  if (kartuItem) {
    const batchKartu = batchForTanggal(tanggal);
    if (isLockedBatch(batchKartu)) return { error: lockedBatchError(batchKartu) };
    batchFields = { batch: batchKartu, departemen: peserta.departemen };
  } else {
    batchFields = { departemen: peserta.departemen };
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
    if (kartu.kondisi !== "HILANG" && "batch" in batchFields) {
      await renumberBatchByBadge(supabase, peserta.departemen, batchFields.batch);
    }
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

  // Perlu tahu kondisi/batch lama sebelum update supaya batch yang sudah ditutup benar-benar
  // tidak berubah lewat jalur edit.
  let oldKondisi: string | undefined;
  let g: { urutan: number | null; departemen: string | null; batch: number | null } | null = null;
  let pengembalianId: number | undefined;
  const { data: detailRow } = await supabase
    .from("pengembalian_detail")
    .select("kondisi, pengembalian_id, pengembalian(urutan, departemen, batch)")
    .eq("id", detailId)
    .single();
  if (!detailRow) return { error: "Data pengembalian tidak ditemukan." };

  oldKondisi = detailRow.kondisi;
  pengembalianId = detailRow.pengembalian_id;
  g = detailRow.pengembalian as unknown as { urutan: number | null; departemen: string | null; batch: number | null } | null;
  if (isLockedBatch(g?.batch)) {
    return { error: lockedBatchError(g.batch) };
  }

  const { error } = await supabase
    .from("pengembalian_detail")
    .update({ kondisi, potongan })
    .eq("id", detailId);
  if (error) return { error: error.message };

  if (item === "KARTU") {
    const newStatus = kondisi === "HILANG" ? "HANGUS" : "RETURNED";
    await supabase.from("peserta").update({ status_badge: newStatus }).eq("id", pesertaId);

    if (oldKondisi && oldKondisi !== "HILANG" && kondisi === "HILANG" && pengembalianId) {
      if (g?.urutan != null) {
        await supabase.from("pengembalian").update({ urutan: null }).eq("id", pengembalianId);
      }
      if (g?.batch != null) {
        await renumberBatchByBadge(supabase, g.departemen, g.batch);
      }
    } else if (oldKondisi === "HILANG" && kondisi !== "HILANG" && g?.batch != null) {
      // kondisi pengembalian_detail sudah ter-update di atas, jadi renumberBatchByBadge
      // sekarang akan menganggap baris ini layak dinomori dan menyisipkannya di posisi
      // No Badge yang benar bersama sisa batch itu.
      await renumberBatchByBadge(supabase, g.departemen, g.batch);
    }
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
    .select("id, pengembalian_id, kondisi, pengembalian(departemen, batch)")
    .eq("id", detailId)
    .single();
  if (!detailRow) return { error: "Data pengembalian tidak ditemukan." };
  const g = detailRow.pengembalian as unknown as { departemen: string | null; batch: number | null } | null;
  if (isLockedBatch(g?.batch)) {
    return { error: lockedBatchError(g.batch) };
  }

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
    if (g?.batch != null && detailRow.kondisi !== "HILANG") {
      await renumberBatchByBadge(supabase, g.departemen, g.batch);
    }
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
    .select("item, kondisi")
    .eq("pengembalian_id", pengembalianId);
  const punyaKartu = (detail ?? []).some((d) => d.item === "KARTU");
  const kartuDinomori = (detail ?? []).some((d) => d.item === "KARTU" && d.kondisi !== "HILANG");
  const { data: pengembalianRow } = await supabase
    .from("pengembalian")
    .select("departemen, batch")
    .eq("id", pengembalianId)
    .single();
  const lockedRow = pengembalianRow as { departemen: string | null; batch: number | null } | null;
  if (isLockedBatch(lockedRow?.batch)) {
    return { error: lockedBatchError(lockedRow.batch) };
  }

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
    const g = pengembalianRow as { departemen: string | null; batch: number | null } | null;
    if (kartuDinomori && g?.batch != null) {
      await renumberBatchByBadge(supabase, g.departemen, g.batch);
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
