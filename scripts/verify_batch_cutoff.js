const fs = require("fs");

const src = fs.readFileSync("app/(app)/pengembalian/actions.ts", "utf8");
const cutoffs = [...src.matchAll(/\{ through: "([^"]+)", batch: (\d+) \}/g)].map((m) => ({
  through: m[1],
  batch: Number(m[2]),
}));

function batchForTanggal(tanggal) {
  for (const cutoff of cutoffs) {
    if (tanggal <= cutoff.through) return cutoff.batch;
  }
  return cutoffs[cutoffs.length - 1].batch + 1;
}

const checks = [
  ["2026-08-03", 7],
  ["2026-08-04", 8],
];

for (const [tanggal, expected] of checks) {
  const actual = batchForTanggal(tanggal);
  if (actual !== expected) {
    throw new Error(`${tanggal} expected Batch ${expected}, got Batch ${actual}`);
  }
}

if (!cutoffs.some((c) => c.through === "2026-08-03" && c.batch === 7)) {
  throw new Error('Missing cutoff { through: "2026-08-03", batch: 7 }');
}

console.log("batch cutoff behavior ok");
