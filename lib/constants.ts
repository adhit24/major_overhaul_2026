export const DEPARTEMEN = ["ONE PLANT", "INDIRECT", "TBN-BOP", "BOILER", "SUPPORTING"] as const;
export const KATEGORI = ["KARYAWAN", "KONTRAKTOR", "VISITOR"] as const;
export const STATUS_BADGE = ["PENDING", "ACTIVE", "RETURNED", "HANGUS"] as const;
export const DEPARTEMEN_SECTION = DEPARTEMEN;
export const STATUS_BATCH = ["DONE", "PENDING", "PARTIAL"] as const;

export const APD_ITEMS = ["KARTU", "VEST", "HELM", "INNER", "KACAMATA"] as const;
export type ApdItem = (typeof APD_ITEMS)[number];
export const APD_LABELS: Record<ApdItem, string> = {
  KARTU: "ID Card",
  VEST: "Vest",
  HELM: "Helm",
  INNER: "Inner Helm",
  KACAMATA: "Kacamata",
};
export const KONDISI_ITEM = ["KEMBALI", "RUSAK", "HILANG"] as const;
export type KondisiItem = (typeof KONDISI_ITEM)[number];
