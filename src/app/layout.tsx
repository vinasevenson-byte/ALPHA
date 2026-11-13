import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#6C5CE7",
};

export const metadata: Metadata = {
  title: "NOVA — Plataforma de Inteligência Financeira (PF & PJ)",
  description:
    "Seu dinheiro organizado. Seu futuro planejado. Plataforma financeira adaptada para Celular, Tablet e Desktop (PF & PJ).",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NOVA",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-[100dvh] bg-[#F5F6FA] text-[#1E1B39] antialiased touch-manipulation selection:bg-[#6C5CE7]/20 selection:text-[#1E1B39]">
        {children}
      </body>
    </html>
  );
}
