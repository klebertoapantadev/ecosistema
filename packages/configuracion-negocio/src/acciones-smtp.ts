"use server";

import { revalidatePath } from "next/cache";
import { esquemaSmtp, faltaParaActivar, type DatosSmtp } from "./esquema-smtp";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function guardarSmtp(datos: DatosSmtp, negocio: string): Promise<Resultado> {
  const contrasenaLimpia = datos.contrasena ? datos.contrasena.replace(/\s+/g, "").trim() : "";
  const datosNormalizados: DatosSmtp = {
    ...datos,
    contrasena: contrasenaLimpia,
  };

  const parseo = esquemaSmtp.safeParse(datosNormalizados);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { crearClienteServidor, crearClienteAdmin } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Debes iniciar sesión para configurar el servidor de correo." };
  }

  const userEmail = (user.email || "").toLowerCase().trim();
  const esPropietarioOAdmin =
    userEmail === "kleber.toapanta.ch@gmail.com" ||
    userEmail === "tinkay.uio@gmail.com" ||
    userEmail === "familiammtg@gmail.com" ||
    userEmail === "jesus251296@gmail.com";

  const { data: filaActual } = await supabase
    .schema("comun_configuracion")
    .from("cfg_smtp")
    .select("smt_secreto_id")
    .eq("smt_negocio", negocio)
    .maybeSingle();

  const falta = faltaParaActivar(parseo.data, filaActual?.smt_secreto_id != null);
  if (falta) return { ok: false, error: falta };

  const nulo = (v: string | undefined) => (v || null) as unknown as string;

  const payloadRpc = {
    p_negocio: negocio,
    p_host: nulo(parseo.data.host),
    p_puerto: parseo.data.puerto,
    p_seguro: parseo.data.seguro,
    p_usuario: nulo(parseo.data.usuario),
    p_remitente_nombre: nulo(parseo.data.remitenteNombre),
    p_activo: parseo.data.activo,
    p_contrasena: contrasenaLimpia || undefined,
  };

  // 1. Intentar con cliente de sesión del usuario
  let { error } = await supabase.schema("comun_configuracion").rpc("cfg_fn_guardar_smtp", payloadRpc);

  // 2. Si falla por autorización y el usuario es propietario o administrador verificado, usar cliente admin
  if (error && esPropietarioOAdmin && adminSupabase) {
    const resAdmin = await adminSupabase.schema("comun_configuracion").rpc("cfg_fn_guardar_smtp", payloadRpc);
    if (!resAdmin.error) {
      error = null;
    }
  }

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/correo");
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
