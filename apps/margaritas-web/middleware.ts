import { type NextRequest } from "next/server";
import { actualizarSesion } from "@eco/supabase/middleware";

export async function middleware(request: NextRequest) {
  return actualizarSesion(request);
}

// Solo donde hace falta refrescar la sesion o capturar el fallback OAuth (/?code=...).
export const config = {
  matcher: [
    "/panel/:path*",
    "/auth/:path*",
    "/api/:path*",
    "/bienvenida/:path*",
    "/tv-taller/:path*",
    { source: "/", has: [{ type: "query", key: "code" }] },
  ],
};
