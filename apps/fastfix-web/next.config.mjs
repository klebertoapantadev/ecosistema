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
  transpilePackages: ["@eco/supabase", "@eco/identidad", "@eco/configuracion-negocio", "@eco/gestion-usuarios", "@eco/primitivas"],
  // Monorepo pnpm: sin esto, el file tracing del build serverless no ve el
  // node_modules hoisted en la raiz del workspace y el deploy pierde
  // dependencias en runtime aunque el build local funcione.
  env: {
    NEXT_PUBLIC_COMPILADO_EN: compiladoEn,
    ...(commit ? { NEXT_PUBLIC_COMMIT: commit } : {}),
  },
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
