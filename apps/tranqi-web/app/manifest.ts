import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/panel",
    name: "tranqi — Tu respaldo legal de confianza",
    short_name: "tranqi",
    description:
      "Plataforma digital de protección jurídica continua, agendamiento legal con ARIA y billetera de documentos.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#5000BA",
    theme_color: "#5000BA",
    categories: ["business", "productivity", "finance"],
    lang: "es-EC",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
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
    shortcuts: [
      {
        name: "Panel de Inicio",
        short_name: "Inicio",
        description: "Ir a mi panel principal de tranqi",
        url: "/panel",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Agendar Cita",
        short_name: "Agendar",
        description: "Agendar consulta jurídica con ARIA",
        url: "/panel/agendar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Mi Cuenta",
        short_name: "Cuenta",
        description: "Configuración de perfil y seguridad",
        url: "/panel/cuenta",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
