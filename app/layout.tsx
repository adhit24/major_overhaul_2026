import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PT KOIN | Induction & Badge Control",
  description: "Sistem input data induction, badge, dan deposit kartu PT KOIN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="font-sans">{children}</body>
    </html>
  );
}
