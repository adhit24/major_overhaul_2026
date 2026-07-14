import { APD_ITEMS, type ApdItem } from "@/lib/constants";

export type StatusPengembalian = "LENGKAP" | "KURANG" | "BELUM";

export function computeStatusPengembalian(items: string[]): {
  status: StatusPengembalian;
  missing: ApdItem[];
} {
  const have = new Set(items);
  const missing = APD_ITEMS.filter((i) => !have.has(i));
  if (missing.length === APD_ITEMS.length) return { status: "BELUM", missing };
  if (missing.length === 0) return { status: "LENGKAP", missing };
  return { status: "KURANG", missing };
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Petugas disimpan sebagai email login (mis. hseadmin@koinpratama.com); di cetakan/PDF
// domainnya selalu sama untuk semua baris jadi tidak perlu ditampilkan - cukup bagian depannya
// supaya tidak memaksa kolom pecah di tengah kata.
export function formatPetugas(email: string | null | undefined) {
  if (!email) return "-";
  return email.split("@")[0];
}
