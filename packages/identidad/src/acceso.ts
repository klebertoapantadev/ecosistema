import type { crearClienteServidor } from "@eco/supabase/servidor";

type ClienteServidor = Awaited<ReturnType<typeof crearClienteServidor>>;

// Historial de accesos por usuario/dispositivo, comun a los 4 negocios (vive
// en comun_seguridad.seg_acceso -- ver migracion 20260727000011). Alimenta
// la lista de "dispositivos recientes" en Mi cuenta y el saludo
// personalizado, calculado a partir de la fila anterior a la mas reciente.
//
// PLT-018 regla 4: el historial es UNO SOLO por usuario, no uno por
// negocio -- si el mismo usuario entra a Tranqi y despues a Margaritas,
// ve ambos accesos en cualquiera de las dos apps. acc_negocio (20260727000012)
// no cambia eso; solo etiqueta cada fila con la app de origen para que la
// lista no parezca "duplicar" accesos de otra app sin explicacion.
export async function registrarAcceso(
  supabase: ClienteServidor,
  usuarioId: string,
  ip: string | null,
  userAgent: string | null,
  negocio: string | null = null,
) {
  const { data: anterior } = await supabase
    .schema("comun_seguridad")
    .from("seg_acceso")
    .select("acc_creado_en")
    .eq("acc_usuario_id", usuarioId)
    .order("acc_creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.schema("comun_seguridad").from("seg_acceso").insert({
    acc_usuario_id: usuarioId,
    acc_ip: ip,
    acc_user_agent: userAgent,
    acc_negocio: negocio,
  });

  return anterior?.acc_creado_en ?? null;
}

export async function obtenerHistorialAccesos(supabase: ClienteServidor, usuarioId: string, limite = 10) {
  const { data } = await supabase
    .schema("comun_seguridad")
    .from("seg_acceso")
    .select("acc_id, acc_ip, acc_user_agent, acc_creado_en, acc_negocio")
    .eq("acc_usuario_id", usuarioId)
    .order("acc_creado_en", { ascending: false })
    .limit(limite);

  return data ?? [];
}

// Heuristica liviana, sin libreria de parseo de User-Agent -- solo para
// mostrar algo legible ("Chrome en Windows"), no para huella digital real.
export function etiquetaDispositivo(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";

  let sistema = "Dispositivo";
  if (/windows/i.test(userAgent)) sistema = "Windows";
  else if (/mac os|macintosh/i.test(userAgent)) sistema = "Mac";
  else if (/android/i.test(userAgent)) sistema = "Android";
  else if (/iphone|ipad|ios/i.test(userAgent)) sistema = "iOS";
  else if (/linux/i.test(userAgent)) sistema = "Linux";

  let navegador = "";
  if (/edg\//i.test(userAgent)) navegador = "Edge";
  else if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) navegador = "Chrome";
  else if (/firefox\//i.test(userAgent)) navegador = "Firefox";
  else if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) navegador = "Safari";

  return navegador ? `${navegador} en ${sistema}` : sistema;
}

const NOMBRES_NEGOCIO: Record<string, string> = {
  tranqi: "Tranqi",
  fastfix: "FastFix Home",
  tinkay: "Tinkay",
  margaritas: "Margaritas",
};

export function etiquetaNegocio(negocio: string | null): string | null {
  if (!negocio) return null;
  return NOMBRES_NEGOCIO[negocio] ?? negocio;
}

// Saludo personalizado segun cuanto paso desde el acceso anterior (no el
// actual, que recien se acaba de registrar). null = primer acceso -- ese
// caso ya lo cubre la pantalla de bienvenida, no hace falta saludo especial.
export function calcularSaludo(nombre: string, fechaAccesoAnterior: string | null): string | null {
  if (!fechaAccesoAnterior) return null;

  const dias = (Date.now() - new Date(fechaAccesoAnterior).getTime()) / (1000 * 60 * 60 * 24);

  if (dias < 1) return `Hola de nuevo, ${nombre}`;
  if (dias < 7) return `Qué bueno verte de nuevo, ${nombre}`;
  if (dias < 30) return `Cuánto tiempo sin verte, ${nombre}`;
  return `Qué gusto verte después de tanto tiempo, ${nombre}`;
}

// Helper autocontenido para usar directo desde una pagina (crea su propio
// cliente, igual que el resto de consultas.ts): la fila mas reciente es la
// del login que acaba de ocurrir, la segunda es el "acceso anterior" real.
export async function obtenerSaludo(usuarioId: string, nombre: string): Promise<string | null> {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const historial = await obtenerHistorialAccesos(supabase, usuarioId, 2);
  const anterior = historial[1]?.acc_creado_en ?? null;
  return calcularSaludo(nombre, anterior);
}
