"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEPARTEMEN, KATEGORI, STATUS_BADGE } from "@/lib/constants";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : null;
}

export async function createPeserta(formData: FormData) {
  const nama = cleanText(formData.get("nama"));
  const tanggalInduction = String(formData.get("tanggal_induction") ?? "");
  const departemen = String(formData.get("departemen") ?? "");
  const kategori = String(formData.get("kategori") ?? "");
  const statusBadge = String(formData.get("status_badge") ?? "");
  const noBadge = cleanText(formData.get("no_badge"));
  const noErp = cleanText(formData.get("no_erp"));
  const jobNo = cleanText(formData.get("job_no"));
  const jabatan = cleanText(formData.get("jabatan_deskripsi"));
  const leader = cleanText(formData.get("leader"));
  const dueDate = String(formData.get("due_date") ?? "") || null;
  const remarks = cleanText(formData.get("remarks"));
  const ktp = formData.get("ktp") === "on";
  const sks = formData.get("sks") === "on";
  const sertifikat = formData.get("sertifikat") === "on";

  const errors: string[] = [];
  if (!nama) errors.push("Nama wajib diisi.");
  if (!tanggalInduction) errors.push("Tanggal Induction wajib diisi dengan format tanggal yang valid.");
  if (!DEPARTEMEN.includes(departemen as (typeof DEPARTEMEN)[number])) errors.push("Departemen wajib dipilih.");
  if (!KATEGORI.includes(kategori as (typeof KATEGORI)[number])) errors.push("Kategori wajib dipilih.");
  if (!STATUS_BADGE.includes(statusBadge as (typeof STATUS_BADGE)[number])) errors.push("Status Badge wajib dipilih.");
  if (statusBadge !== "PENDING" && !noBadge) errors.push("No Badge wajib diisi kecuali Status Badge = PENDING.");

  const supabase = await createClient();

  // No badge BOLEH dipakai ulang oleh orang berbeda (kartu fisik beda corak per departemen/
  // gelombang induction) - itu sah, bukan error. Yang benar-benar duplikat cuma kalau nama +
  // no badge + departemen semuanya persis sama (record ganda dari orang yang sama).
  if (!errors.length && noBadge && statusBadge !== "PENDING") {
    const { data: dupes } = await supabase
      .from("peserta")
      .select("id, nama")
      .eq("no_badge", noBadge)
      .eq("departemen", departemen)
      .neq("status_badge", "PENDING");
    const normNama = (nama ?? "").toUpperCase().replace(/[.'`",-]/g, " ").replace(/\s+/g, " ").trim();
    const trueDup = (dupes ?? []).some((d) => {
      const dn = (d.nama ?? "").toUpperCase().replace(/[.'`",-]/g, " ").replace(/\s+/g, " ").trim();
      return dn === normNama;
    });
    if (trueDup) {
      errors.push(`'${nama}' dengan No Badge '${noBadge}' di departemen ${departemen} sudah ada di database.`);
    }
  }

  if (errors.length) {
    redirect(`/peserta/baru?error=${encodeURIComponent(errors.join(" "))}`);
  }

  const { error } = await supabase.from("peserta").insert({
    nama,
    tanggal_induction: tanggalInduction,
    departemen,
    kategori,
    status_badge: statusBadge,
    no_badge: noBadge,
    no_erp: noErp,
    job_no: jobNo,
    jabatan_deskripsi: jabatan,
    leader,
    due_date: dueDate,
    remarks,
    ktp,
    sks,
    sertifikat,
  });

  if (error) {
    redirect(`/peserta/baru?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/peserta");
  revalidatePath("/dashboard");
  redirect("/peserta?saved=1");
}
