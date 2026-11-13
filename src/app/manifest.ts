import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NOVA — Inteligência Financeira (PF & PJ)",
    short_name: "NOVA",
    description:
      "Plataforma de gestão financeira, planejamento, reservas e investimentos para Celular, Tablet e Desktop.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F5F6FA",
    theme_color: "#6C5CE7",
    lang: "pt-BR",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
