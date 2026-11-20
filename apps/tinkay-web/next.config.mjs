import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sello de version (PLT-011): se congela en el build para que el panel pueda
// mostrar de que compilacion viene lo que se esta viendo.
//
// Se formatea AQUI y no en el componente a proposito: si se formateara en
// render, servidor y navegador usarian zonas horarias distintas y React
// tiraria un error de hidratacion en cada carga. Zona fija America/Guayaquil,
// que es donde opera el negocio -- no la del servidor de build, que en Vercel
// es UTC.
const compiladoEn = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date());

// Vercel lo inyecta en el build; en local no existe y el sello sale sin commit.
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  transpilePackages: [
    "@eco/comercio",
    "@eco/agentes-ia",
    "@eco/datagrid",
    "@eco/notificaciones",
    "@eco/supabase",
    "@eco/identidad",
    "@eco/configuracion-negocio",
    "@eco/gestion-usuarios",
    "@eco/primitivas",
  ],
  env: {
    NEXT_PUBLIC_COMPILADO_EN: compiladoEn,
    ...(commit ? { NEXT_PUBLIC_COMMIT: commit } : {}),
  },
  async rewrites() {
    return [
      {
        source: "/tempescuela",
        destination: "/tempescuela/index.html",
      },
      {
        source: "/TempEscuale",
        destination: "/tempescuela/index.html",
      },
    ];
  },
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/entrega-inmediata/generar-fotos": ["./public/img/referencias-ia/**/*"],
  },
  // Sin cache persistente de webpack en los builds de produccion (PLT-SEG-001).
  // Con Next 15.5.29 y zod >= 4.5, un build que reutiliza .next/cache (en local
  // o el que Vercel restaura entre despliegues) mezcla ids de modulo de la
  // compilacion anterior y el prerender falla con "T is not a function". En
  // dev la cache se mantiene.
  webpack: (config, { dev }) => {
    if (!dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
