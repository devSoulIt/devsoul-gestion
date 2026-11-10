import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Devsoul Gestión",
    short_name: "Devsoul",
    description: "Gestión interna de Devsoul: clientes, facturación, tickets y recordatorios.",
    lang: "es-AR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Recordatorios", url: "/dashboard/recordatorios", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Facturación", url: "/dashboard/facturacion", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tickets", url: "/dashboard/tickets", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
