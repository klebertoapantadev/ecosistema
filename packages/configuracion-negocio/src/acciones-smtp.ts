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

  const { error } = await supabase.schema("comun_configuracion").rpc("cfg_fn_guardar_smtp", {
    p_negocio: negocio,
    p_host: parseo.data.host || null,
    p_puerto: parseo.data.puerto,
    p_seguro: parseo.data.seguro,
    p_usuario: parseo.data.usuario || null,
    p_remitente_nombre: parseo.data.remitenteNombre || null,
    p_activo: parseo.data.activo,
    p_contrasena: parseo.data.contrasena || null,
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
