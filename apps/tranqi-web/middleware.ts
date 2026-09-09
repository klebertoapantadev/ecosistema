import { type NextRequest } from "next/server";
import { actualizarSesion } from "@eco/supabase/middleware";

export async function middleware(request: NextRequest) {
  return actualizarSesion(request);
}

// Solo donde hace falta refrescar la sesion. Antes el matcher cubria el sitio
// entero, asi que un fallo hablando con Supabase se llevaba por delante tambien
// la portada, /ingresar y /registro -- paginas que no necesitan sesion para nada.
// Quedan fuera a proposito: "/", /terminos, /vacantes, /ingresar, /registro,
// /recuperar, /restablecer-contrasena, /verificar-correo y /compartir (publica
// por token).
export const config = {
  matcher: ["/panel/:path*", "/auth/:path*", "/api/:path*", "/bienvenida/:path*"],
};
