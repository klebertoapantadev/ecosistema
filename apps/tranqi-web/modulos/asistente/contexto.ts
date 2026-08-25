import { acunarTokenSupabase, verificarCapsula, type SesionAsistente } from "@eco/agentes-ia";
import { crearClienteConToken, type ClienteConToken } from "@eco/supabase/token";

// Server-only. Este modulo acuña credenciales; no puede acabar en un bundle
// de navegador ni por accidente.

export interface ContextoAsistente {
  sesion: SesionAsistente;
  /** Cliente PostgREST que actua como el usuario. RLS decide que ve. */
  supabase: ClienteConToken;
}

/**
 * Autentica una peticion entrante de ARIA y devuelve el contexto de trabajo.
 *
 * Es el unico punto donde se resuelve "quien esta hablando", y lo hace desde el
 * header `Authorization`, que ARIA rellena con la capsula que firmo esta misma
 * app (ver `capsula.ts`). No se lee ningun identificador del cuerpo de la
 * peticion: lo que venga por ahi lo eligio el modelo.
 *
 * Devuelve `null` ante cualquier problema, sin distinguir el motivo. El
 * servidor MCP lo traduce a 401 y el agente le dira al usuario que no pudo
 * consultar sus datos — que es exactamente lo que debe pasar cuando la
 * identidad no esta acreditada.
 */
export async function autenticarPeticionMcp(
  peticion: Request,
  rolesPermitidos: SesionAsistente["rol"][],
): Promise<ContextoAsistente | null> {
  const secretoCapsula = process.env.ASISTENTE_CAPSULA_SECRETO;
  const secretoJwt = process.env.SUPABASE_JWT_SECRET;
  const urlProyecto = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secretoCapsula || !secretoJwt || !urlProyecto) {
    // Falta configuracion: se rechaza en vez de degradar a "sin identidad".
    console.error("[asistente] faltan ASISTENTE_CAPSULA_SECRETO, SUPABASE_JWT_SECRET o NEXT_PUBLIC_SUPABASE_URL");
    return null;
  }

  const cabecera = peticion.headers.get("authorization") ?? "";
  const token = cabecera.toLowerCase().startsWith("bearer ") ? cabecera.slice(7).trim() : "";
  if (!token) return null;

  const sesion = await verificarCapsula(token, secretoCapsula);
  if (!sesion) return null;

  // Cada MCP sirve a un rol. Que el asistente del abogado no pueda ser
  // alcanzado con una capsula de cliente no depende solo de que ARIA tenga
  // enganchado el MCP correcto: se comprueba aqui tambien, porque la
  // configuracion de un agente se cambia desde una pantalla y las pantallas se
  // equivocan.
  if (!rolesPermitidos.includes(sesion.rol)) return null;

  const tokenUsuario = await acunarTokenSupabase(sesion.usuarioId, secretoJwt, urlProyecto);
  return { sesion, supabase: crearClienteConToken(tokenUsuario) };
}
