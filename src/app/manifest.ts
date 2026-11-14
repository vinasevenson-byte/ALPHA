import type { MetadataRoute } from "next";

/**
 * Manifesto PWA do ALPHA/NOVA (sem cache offline de dados financeiros).
 * O endereço / mantém o fluxo de autenticação e redirecionamento existente.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ALPHA / NOVA — Inteligência Financeira (PF & PJ)",
    short_name: "NOVA",
    description:
      "Plataforma de gestão e inteligência financeira ALPHA/NOVA para Celular, Tablet e Desktop.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F5F6FA",
    theme_color: "#6C5CE7",
    lang: "pt-BR",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/nova-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/nova-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/nova-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
