"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { APD_ITEMS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";

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
    .from("peserta").select("id, status_badge").eq("id", pesertaId).single();
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

  const { data: kejadian, error: insErr } = await supabase
    .from("pengembalian")
    .insert({ peserta_id: pesertaId, tanggal, catatan, petugas })
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
