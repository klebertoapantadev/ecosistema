import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@eco/supabase", "@eco/identidad", "@eco/configuracion-negocio", "@eco/gestion-usuarios"],
  // Monorepo pnpm: sin esto, el file tracing del build serverless no ve el
  // node_modules hoisted en la raiz del workspace y el deploy pierde
  // dependencias en runtime aunque el build local funcione.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
