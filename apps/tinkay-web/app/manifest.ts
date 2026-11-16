import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/panel/entregas",
    name: "Tinkay — Operaciones, Entregas y Tienda",
    short_name: "Tinkay",
    description:
      "Confirmación de entregas georreferenciadas offline, órdenes de trabajo Exequiales IESS, entrega inmediata e inventario floral.",
    start_url: "/panel/entregas",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF7F2",
    theme_color: "#1B2E22",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
