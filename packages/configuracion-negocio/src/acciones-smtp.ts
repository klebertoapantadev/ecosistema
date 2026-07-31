"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { esquemaSmtp, faltaParaActivar, type DatosSmtp } from "./esquema-smtp";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// A diferencia de actualizarConfiguracionNegocio(), esto NO es un update
// directo guardado por RLS: guardar la contrasena en Vault y la fila en
// cfg_smtp tiene que ser una sola operacion atomica, y la contrasena no puede
// pasar por una tabla que alguien pueda leer. Por eso hay un RPC dedicado y
// cfg_smtp no tiene politica de escritura.
export async function guardarSmtp(datos: DatosSmtp, negocio: string): Promise<Resultado> {
  const parseo = esquemaSmtp.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await crearClienteServidor();

  // Si ya hay contrasena guardada se comprueba aqui y no con lo que diga el
  // cliente: el formulario lo sabe, pero un formulario es solo una sugerencia.
  // La lectura la sigue filtrando RLS, asi que esto no revela nada a quien no
  // sea admin de ese negocio.
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
    // null explicito = conservar la contrasena que ya estaba guardada.
    p_contrasena: parseo.data.contrasena || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}

export async function borrarContrasenaSmtp(negocio: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_configuracion")
    .rpc("cfg_fn_borrar_smtp_contrasena", { p_negocio: negocio });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}
