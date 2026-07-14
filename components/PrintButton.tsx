"use client";

import { useState } from "react";

export function PrintButton() {
  const [preparing, setPreparing] = useState(false);

  function handleClick() {
    setPreparing(true);
    // window.print() blocks the main thread while the browser paginates the page -
    // defer it a tick so the click is acknowledged (button repaints) before the freeze.
    setTimeout(() => {
      window.print();
      setPreparing(false);
    }, 50);
  }

  return (
    <button
      onClick={handleClick}
      disabled={preparing}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70 print:hidden"
    >
      {preparing ? "Menyiapkan..." : "Cetak / Simpan PDF"}
    </button>
  );
}
