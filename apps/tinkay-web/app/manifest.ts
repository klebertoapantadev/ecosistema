import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tinkay — Operaciones, Entregas y Tienda",
    short_name: "Tinkay App",
    description:
      "Confirmación de entregas georreferenciadas offline, órdenes de trabajo Exequiales IESS, entrega inmediata e inventario floral.",
    start_url: "/panel/entregas",
    scope: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#1B2E22",
    icons: [
      {
        src: "/tinkay-isotipo.jpg",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        src: "/tinkay-logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  };
}
