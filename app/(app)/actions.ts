"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updatePeserta(
  id: number,
  data: {
    status_badge?: string;
    no_badge?: string | null;
    no_erp?: string | null;
    jabatan_deskripsi?: string | null;
    leader?: string | null;
    tanggal_induction?: string | null;
    due_date?: string | null;
    ktp?: boolean;
    sks?: boolean;
    sertifikat?: boolean;
    remarks?: string | null;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("peserta").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/manpower");
  revalidatePath("/peserta");
}
