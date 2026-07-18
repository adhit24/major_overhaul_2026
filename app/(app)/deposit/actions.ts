"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEPARTEMEN, DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";

export async function createDepositBatch(formData: FormData) {
  const tanggal = String(formData.get("tanggal") ?? "");
  const departemenSection = String(formData.get("departemen_section") ?? "");
  const keterangan = String(formData.get("keterangan") ?? "").trim() || null;
  const rentangNoId = String(formData.get("rentang_no_id") ?? "").trim() || null;
  const jumlahKartu = Number(formData.get("jumlah_kartu") ?? 0);
  const tarifKartu = Number(formData.get("tarif_kartu") ?? 50000);
  const dueDate = String(formData.get("due_date") ?? "") || null;
  const statusBatch = String(formData.get("status_batch") ?? "PENDING");
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  const errors: string[] = [];
  if (!tanggal) errors.push("Tanggal wajib diisi.");
  if (!DEPARTEMEN_SECTION.includes(departemenSection as (typeof DEPARTEMEN_SECTION)[number]))
    errors.push("Departemen/Section wajib dipilih.");
  if (!jumlahKartu || jumlahKartu <= 0) errors.push("Jumlah kartu wajib diisi dan lebih dari 0.");
  if (!STATUS_BATCH.includes(statusBatch as (typeof STATUS_BATCH)[number])) errors.push("Status batch wajib dipilih.");

  if (errors.length) {
    redirect(`/deposit?error=${encodeURIComponent(errors.join(" "))}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("deposit_batch").insert({
    tanggal,
    departemen_section: departemenSection,
    keterangan,
    rentang_no_id: rentangNoId,
    jumlah_kartu: jumlahKartu,
    tarif_kartu: tarifKartu,
    due_date: dueDate,
    status_batch: statusBatch,
    remarks,
  });

  if (error) {
    redirect(`/deposit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/deposit");
  revalidatePath("/dashboard");
  redirect("/deposit?saved=1");
}

export async function createCpsRefund(formData: FormData) {
  const tanggal = String(formData.get("tanggal") ?? "");
  const departemen = String(formData.get("departemen") ?? "");
  const jumlahKartu = Number(formData.get("jumlah_kartu") ?? 0);
  const jumlahUang = Number(formData.get("jumlah_uang") ?? 0);
  const noReferensi = String(formData.get("no_referensi") ?? "").trim() || null;
  const petugas = String(formData.get("petugas") ?? "").trim() || null;
  const keterangan = String(formData.get("keterangan") ?? "").trim() || null;

  const errors: string[] = [];
  if (!tanggal) errors.push("Tanggal wajib diisi.");
  if (!DEPARTEMEN.includes(departemen as (typeof DEPARTEMEN)[number])) errors.push("Departemen wajib dipilih.");
  if (!jumlahKartu || jumlahKartu <= 0) errors.push("Jumlah kartu wajib diisi dan lebih dari 0.");
  if (!formData.get("jumlah_uang") || jumlahUang < 0 || Number.isNaN(jumlahUang)) errors.push("Jumlah uang wajib diisi.");

  if (errors.length) {
    redirect(`/deposit?error=${encodeURIComponent(errors.join(" "))}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cps_deposit_refund").insert({
    tanggal,
    departemen,
    jumlah_kartu: jumlahKartu,
    jumlah_uang: jumlahUang,
    no_referensi: noReferensi,
    petugas,
    keterangan,
  });

  if (error) {
    redirect(`/deposit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/deposit");
  redirect("/deposit?saved=1");
}

export async function hapusCpsRefund(formData: FormData): Promise<{ error: string | null }> {
  const id = Number(formData.get("id") ?? 0);
  if (!id) return { error: "ID tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("cps_deposit_refund").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/deposit");
  return { error: null };
}
