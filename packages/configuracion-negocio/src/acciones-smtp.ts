"use server";

import { revalidatePath } from "next/cache";
import { esquemaSmtp, faltaParaActivar, type DatosSmtp } from "./esquema-smtp";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function guardarSmtp(datos: DatosSmtp, negocio: string): Promise<Resultado> {
  const parseo = esquemaSmtp.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();

  const { data: filaActual } = await supabase
    .schema("comun_configuracion")
    .from("cfg_smtp")
    .select("smt_secreto_id")
    .eq("smt_negocio", negocio)
    .maybeSingle();

  const falta = faltaParaActivar(parseo.data, filaActual?.smt_secreto_id != null);
  if (falta) return { ok: false, error: falta };

  // `cfg_fn_guardar_smtp` declara estos parámetros como `text`, que en SQL
  // admite NULL — y pasar NULL es justamente cómo se borra un valor guardado.
  // El generador de tipos de Supabase no puede saberlo y los marca como `string`
  // a secas, así que el cast reconcilia el tipo con la firma real de la función
  // (2026-09-06, al regenerar `packages/db` con una versión más reciente de la
  // CLI). No se cambia el comportamiento: `undefined` no sirve, porque salvo
  // `p_contrasena` ninguno tiene DEFAULT y PostgREST rechazaría la llamada.
  // `nulo()` marca los campos donde NULL es un valor legítimo: así se borra un
  // dato guardado. El generador de tipos no distingue un `text` que acepta NULL
  // de uno que no, y los marca todos como `string`.
  const nulo = (v: string | undefined) => (v || null) as unknown as string;

  const { error } = await supabase.schema("comun_configuracion").rpc("cfg_fn_guardar_smtp", {
    p_negocio: negocio,
    p_host: nulo(parseo.data.host),
    p_puerto: parseo.data.puerto,
    p_seguro: parseo.data.seguro,
    p_usuario: nulo(parseo.data.usuario),
    p_remitente_nombre: nulo(parseo.data.remitenteNombre),
    p_activo: parseo.data.activo,
    p_contrasena: parseo.data.contrasena || undefined,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}

export async function borrarContrasenaSmtp(negocio: string): Promise<Resultado> {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_configuracion")
    .rpc("cfg_fn_borrar_smtp_contrasena", { p_negocio: negocio });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}
