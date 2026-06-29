"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";

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
