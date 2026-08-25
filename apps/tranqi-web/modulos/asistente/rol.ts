import { cookies } from "next/headers";
import { obtenerPerfiles } from "@eco/identidad";

// Server-only. UNA sola fuente de verdad para "con que asistente habla este
// usuario".
//
// POR QUE EXISTE ESTE FICHERO. Antes la decision estaba en dos sitios: el
// layout dibujaba la barra segun `modoActivo` (cookie de modo de rol), y
// /api/asistente elegia el agente segun el flag de superadmin. Para un
// superadmin viendo el panel como cliente eso daba dos respuestas distintas:
// la barra salia como cliente, pero la capsula se firmaba como ADMINISTRADOR y
// el MCP de cliente la rechazaba con 401. Dos criterios que deben coincidir y
// no coincidian.
//
// Ahora los dos llaman aqui. Si el criterio cambia, cambia en un sitio.

export type RolConAsistente = "CLIENTE" | "ABOGADO";

/** Mismo orden de precedencia que app/panel/layout.tsx. */
function modoValido(valor: string | undefined): string | null {
  if (!valor || !valor.trim()) return null;
  return valor.toLowerCase().trim();
}

function modoDePerfiles(perfiles: string[]): string {
  if (perfiles.includes("SUPERADMIN")) return "superadmin";
  if (perfiles.includes("ADMINISTRADOR")) return "admin";
  if (perfiles.includes("ABOGADO")) return "abogado";
  if (perfiles.includes("OPERADOR")) return "operador";
  return perfiles[0]?.toLowerCase() ?? "cliente";
}

/**
 * El modo activo del panel, tal y como lo resuelve el layout.
 *
 * Solo lee la cookie que escribe el servidor y los perfiles reales. El
 * parametro `?modo=` de la URL NO cuenta: CapaPerfilRail lo usa para recolorear
 * el rail en cliente, y el color es apariencia — pero que aparezca un asistente
 * CON herramientas sobre datos personales es una capacidad, y una capacidad no
 * se concede desde la barra de direcciones.
 */
export async function modoActivoDelPanel(negocio: string): Promise<string> {
  const cookieStore = await cookies();
  const deCookie =
    modoValido(cookieStore.get("tranqi_modo_rol")?.value) ??
    modoValido(cookieStore.get("tranqi_rol_favorito")?.value);
  if (deCookie) return deCookie;
  return modoDePerfiles(await obtenerPerfiles(negocio));
}

/**
 * Traduce el modo activo al rol de asistente, o `null` si ese modo no tiene
 * agente propio todavia.
 *
 * Operador, tecnico, administracion y superadmin devuelven null a proposito:
 * su asistente es TRQ-ADM-002 y no existe. Darles el de cliente seria
 * ofrecerles una herramienta que no responde a su trabajo, y ademas firmaria
 * una capsula que el MCP de cliente rechazaria.
 */
export function rolConAsistente(modoActivo: string): RolConAsistente | null {
  const modo = modoActivo.toLowerCase();
  if (modo === "cliente") return "CLIENTE";
  if (modo === "abogado" || modo === "socio") return "ABOGADO";
  return null;
}
