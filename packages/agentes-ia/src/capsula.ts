// Capsula de sesion del asistente: como viaja la identidad del usuario desde
// la app hasta las herramientas del agente, sin pasar nunca por el modelo.
//
// EL PROBLEMA. ARIA guarda los headers de sus herramientas en base de datos, y
// son estaticos. Para una API de servicio eso basta. Para datos personales no:
// si el MCP recibiera el identificador del usuario como ARGUMENTO de tool, ese
// argumento lo elige el modelo, y un modelo se puede convencer con texto. El
// propio prompt del asistente dice "nunca uses un identificador que el usuario
// te dicte" — pero una instruccion en el prompt no es una frontera.
//
// LA SOLUCION. La app, que ya tiene la sesion de Supabase en la cookie y sabe
// con certeza quien esta hablando, firma una capsula de vida corta. La manda a
// ARIA en `tool_context`, y ARIA la sustituye en el header `{{sesion}}` del MCP
// (ver runtime_tools.render_contexto en el backend de ARIA). El modelo nunca la
// ve, no aparece en el prompt ni en el historial, y no puede fabricar otra.
//
// El MCP la verifica y acuña con ella un token de usuario de Supabase, de modo
// que toda consulta va por PostgREST bajo RLS. Nada usa service_role.

import { firmarJwtHs256, verificarJwtHs256 } from "./jwt";

export type RolAsistente = "CLIENTE" | "ABOGADO" | "ADMINISTRADOR";

export interface SesionAsistente {
  usuarioId: string;
  rol: RolAsistente;
  /** El hilo de conversacion (trq_conversacion.cnv_id). Solo para trazar. */
  conversacionId: string;
}

/**
 * Vida de la capsula. Tiene que cubrir un turno completo del agente —que puede
 * encadenar varias llamadas a herramientas y reintentos— y nada mas. Cinco
 * minutos es holgado para lo primero y corto para que sirva de algo si se
 * filtrara de un log.
 */
const VIGENCIA_CAPSULA_SEGUNDOS = 300;

/**
 * Vida del token de Supabase acuñado. Mucho mas corta: no sale del proceso que
 * lo crea, solo viaja al PostgREST del propio proyecto y se usa de inmediato.
 */
const VIGENCIA_TOKEN_SUPABASE_SEGUNDOS = 120;

export async function firmarCapsula(
  sesion: SesionAsistente,
  secreto: string,
): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  return firmarJwtHs256(
    {
      sub: sesion.usuarioId,
      rol: sesion.rol,
      cnv: sesion.conversacionId,
      iat: ahora,
      exp: ahora + VIGENCIA_CAPSULA_SEGUNDOS,
    },
    secreto,
  );
}

/** Devuelve la sesion, o `null` si la capsula es invalida, caduco o viene mal formada. */
export async function verificarCapsula(
  token: string,
  secreto: string,
): Promise<SesionAsistente | null> {
  const contenido = await verificarJwtHs256(token, secreto);
  if (!contenido) return null;

  const usuarioId = contenido.sub;
  const rol = contenido.rol;
  const conversacionId = contenido.cnv;
  if (typeof usuarioId !== "string" || !usuarioId) return null;
  if (rol !== "CLIENTE" && rol !== "ABOGADO" && rol !== "ADMINISTRADOR") return null;
  if (typeof conversacionId !== "string") return null;

  return { usuarioId, rol, conversacionId };
}

/**
 * Acuña un token de acceso de Supabase para un usuario concreto.
 *
 * Es el paso que convierte "se quien es" en "PostgREST lo sabe": con este token
 * `auth.uid()` devuelve `usuarioId` y las politicas RLS deciden solas. Por eso
 * los asistentes no necesitan service_role, que ademas se saltaria RLS entero.
 *
 * `aal: "aal1"` NO es relleno. Hay politicas de tranqi que exigen aal2 leyendo
 * ese claim (tranqui_legal.trq_fn_es_admin_mfa_verificado). Una sesion de
 * asistente no ha pasado por MFA, asi que declararlo aal1 es la verdad y ademas
 * garantiza que este token no pueda alcanzar nunca lo que el MFA protege.
 * Omitir el claim tendria el mismo efecto hoy —el coalesce lo trata como no
 * verificado— pero dejaria el resultado a merced de como se escriba la proxima
 * politica. Se afirma explicitamente.
 */
export async function acunarTokenSupabase(
  usuarioId: string,
  secretoJwt: string,
  urlProyecto: string,
): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  return firmarJwtHs256(
    {
      sub: usuarioId,
      role: "authenticated",
      aud: "authenticated",
      iss: `${urlProyecto.replace(/\/$/, "")}/auth/v1`,
      aal: "aal1",
      iat: ahora,
      exp: ahora + VIGENCIA_TOKEN_SUPABASE_SEGUNDOS,
    },
    secretoJwt,
  );
}
