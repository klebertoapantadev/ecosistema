import { type NextRequest } from "next/server";
import { actualizarSesion } from "@eco/supabase/middleware";

export async function middleware(request: NextRequest) {
  return actualizarSesion(request);
}

// Solo donde hace falta refrescar la sesion o capturar el fallback OAuth (/?code=...).
// Excluye portada, catalogo publico, archivos estaticos e imagenes en /public/img/*
// para evitar invocaciones innecesarias de Middleware y CPU en Vercel.
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
