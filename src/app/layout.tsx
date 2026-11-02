import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVA — Inteligência Financeira | Pacote 01 & Pacote 02",
  description:
    "Seu dinheiro organizado. Seu futuro planejado. Plataforma financeira independente para Pessoas Físicas (PF) e Empresas (PJ).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#F4F7FA] text-[#142D43] antialiased selection:bg-[#69E2C0]/40 selection:text-[#142D43]">
        {children}
      </body>
    </html>
  );
}
