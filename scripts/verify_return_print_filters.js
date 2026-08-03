const fs = require("fs");

const src = fs.readFileSync("app/(app)/pengembalian/cetak/kembali/page.tsx", "utf8");

if (!src.includes("status_badge")) {
  throw new Error("Print query/type must include peserta.status_badge");
}

if (!src.includes('p.status_badge === "ACTIVE"')) {
  throw new Error("Returned-card print page must exclude ACTIVE badge holders");
}

console.log("return print filter behavior ok");
