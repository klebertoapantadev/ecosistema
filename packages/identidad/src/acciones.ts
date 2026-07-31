"use server";

import { headers } from "next/headers";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { enviarCorreo } from "@eco/notificaciones";
import {
  esquemaRegistro,
  esquemaIngreso,
  esquemaBienvenida,
  esquemaSolicitarRecuperacion,
  esquemaRestablecerContrasena,
  TERMINOS_VERSION,
  type DatosRegistro,
  type DatosIngreso,
  type DatosBienvenida,
} from "./esquema";
import { registrarAcceso } from "./acceso";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function obtenerIpYAgente() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip, userAgent: h.get("user-agent") };
}

async function obtenerOrigen() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

// Rol CLIENTE automatico al registrarse en un negocio (PLT-003 regla 1). Usa
// upsert con ignoreDuplicates: si ya tenia membresia (ej. re-login), no
// falla ni la pisa -- la politica RLS solo permite insertar como CLIENTE,
// nunca escalar un rol existente desde aqui. Comun a los 4 negocios --
// "negocio" es el slug del que llama ("tranqi" | "fastfix" | "tinkay" |
// "margaritas").
export async function asegurarMembresiaCliente(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  usuarioId: string,
  negocio: string,
) {
  // PLT-003 regla 2: el alta crea membresia Y perfil CLIENTE. Va por RPC y no
  // por upsert directo porque seg_membresia_perfil no tiene politica de
  // escritura -- es donde se aplica el techo jerarquico de la regla 5, y
  // abrirla al cliente lo saltaria. El RPC solo actua sobre auth.uid(), asi
  // que `usuarioId` ya no hace falta.
  await supabase.schema("comun_seguridad").rpc("seg_fn_asegurar_membresia_cliente", { p_negocio: negocio });
}

// PLT-001 regla 6: registra la aceptacion de terminos para el camino de
// Google OAuth, donde no se puede inyectar raw_user_meta_data propia. Solo
// escribe si todavia no habia aceptado (no pisa la fecha de una aceptacion
// anterior en logins siguientes). Es a nivel de usuario (comun_seguridad),
// no por negocio -- un usuario acepta los terminos globales una sola vez.
export async function asegurarTerminosAceptados(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  usuarioId: string,
) {
  await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({ usu_terminos_aceptados_en: new Date().toISOString(), usu_terminos_version: TERMINOS_VERSION })
    .eq("usu_id", usuarioId)
    .is("usu_terminos_aceptados_en", null);
}

// El registro por correo ya no depende del link magico de Supabase Auth (un
// solo remitente de SMTP a nivel de proyecto, compartido por los 4
// negocios -- no puede salir "de" cada negocio). "Confirm email" esta
// desactivado en el proyecto Supabase: signUp() entrega sesion activa de
// inmediato y la verificacion pasa a ser 100% nuestra
// (usu_correo_verificado_en), via un OTP de 6 digitos que mandamos con el
// SMTP que ese negocio configuro en su consola (@eco/notificaciones ->
// Edge Function enviar-correo, ver ADR-0005). Google OAuth sigue sin pasar
// por esto -- Google ya verifico el correo (ver seg_fn_provisionar_usuario()).
export async function registrarUsuario(datos: DatosRegistro, negocio: string): Promise<Resultado> {
  const parseo = esquemaRegistro.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: parseo.data.correo,
    password: parseo.data.contrasena,
    options: {
      data: {
        given_name: parseo.data.nombres,
        family_name: parseo.data.apellidos,
        // Leido por seg_fn_provisionar_usuario() -- Google OAuth no permite
        // inyectar metadata propia, por eso ese camino registra la
        // aceptacion en el callback en vez de aqui.
        terminos_version: TERMINOS_VERSION,
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user || !data.session) return { ok: false, error: "No se pudo crear el usuario" };

  await asegurarMembresiaCliente(supabase, data.user.id, negocio);
  const { ip, userAgent } = await obtenerIpYAgente();
  await registrarAcceso(supabase, data.user.id, ip, userAgent, negocio);

  const { data: codigo, error: errorOtp } = await supabase.schema("comun_seguridad").rpc("seg_fn_generar_otp_registro");
  if (errorOtp || !codigo) return { ok: false, error: errorOtp?.message ?? "No se pudo generar el código de verificación" };

  const envio = await enviarCorreo({
    negocio,
    para: parseo.data.correo,
    asunto: "Tu código de verificación",
    html: `<p>Hola${parseo.data.nombres ? ` ${parseo.data.nombres}` : ""},</p><p>Tu código de verificación es <strong style="font-size:1.4em; letter-spacing:0.2em;">${codigo}</strong></p><p>Vence en 15 minutos.</p>`,
  });
  // La cuenta ya quedo creada: no se revierte el registro porque el correo
  // falle. Se avisa para que la pantalla de verificacion ofrezca reenviar en
  // vez de dejar al usuario esperando un codigo que nunca llegara.
  if (!envio.ok) {
    return { ok: false, error: "Tu cuenta se creó, pero no pudimos enviarte el código. Usa «Reenviar código»." };
  }

  return { ok: true, data: undefined };
}

// Reenvío desde la pantalla de verificación -- mismo RPC, sin volver a crear
// el usuario. `negocio` si hace falta desde PLT-008: el SMTP ya no es el de
// la app que llama sino el que ese negocio configuro en su pantalla de
// Configuracion del Negocio.
export async function reenviarOtpRegistro(
  correo: string,
  negocio: string,
  nombres?: string | null,
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: codigo, error } = await supabase.schema("comun_seguridad").rpc("seg_fn_generar_otp_registro");
  if (error || !codigo) return { ok: false, error: error?.message ?? "No se pudo generar el código de verificación" };

  const envio = await enviarCorreo({
    negocio,
    para: correo,
    asunto: "Tu código de verificación",
    html: `<p>Hola${nombres ? ` ${nombres}` : ""},</p><p>Tu código de verificación es <strong style="font-size:1.4em; letter-spacing:0.2em;">${codigo}</strong></p><p>Vence en 15 minutos.</p>`,
  });
  if (!envio.ok) return { ok: false, error: envio.error };

  return { ok: true, data: undefined };
}

export async function verificarOtpRegistro(codigo: string): Promise<Resultado<boolean>> {
  const supabase = await crearClienteServidor();
  const { data: valido, error } = await supabase.schema("comun_seguridad").rpc("seg_fn_verificar_otp_registro", { p_codigo: codigo });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: valido ?? false };
}

export async function iniciarSesion(datos: DatosIngreso, negocio: string): Promise<Resultado> {
  const parseo = esquemaIngreso.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parseo.data.correo,
    password: parseo.data.contrasena,
  });

  if (error) return { ok: false, error: error.message };

  const { ip, userAgent } = await obtenerIpYAgente();
  await registrarAcceso(supabase, data.user.id, ip, userAgent, negocio);

  return { ok: true, data: undefined };
}

// Solicitud de recuperacion de contraseña -- SIEMPRE responde ok:true, exista
// o no la cuenta (evita que este formulario sirva para averiguar que correos
// estan registrados). seg_fn_solicitar_recuperacion() ya hace ese mismo
// trabajo del lado de la base: retorna null tanto si el correo no existe
// como si hay un token sin usar pedido hace menos de 60s.
export async function solicitarRecuperacion(correo: string, negocio: string): Promise<Resultado> {
  const parseo = esquemaSolicitarRecuperacion.safeParse({ correo });
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const { data: token, error } = await supabase.schema("comun_seguridad").rpc("seg_fn_solicitar_recuperacion", {
    p_correo: parseo.data.correo,
  });
  // El mensaje al usuario es SIEMPRE el mismo (por diseño, ver comentario de
  // arriba) -- pero un error real (permisos, conexion) no debe pasar
  // desapercibido solo porque el resultado visible es igual al de "no existe".
  if (error) console.error("solicitarRecuperacion: seg_fn_solicitar_recuperacion falló", error);

  if (token) {
    const origen = await obtenerOrigen();
    // No se propaga el fallo de envio: la respuesta al usuario es siempre la
    // misma por diseño (ver comentario de arriba). Un error distinto cuando
    // el correo no sale delataria que la cuenta si existe.
    await enviarCorreo({
      negocio,
      para: parseo.data.correo,
      asunto: "Restablece tu contraseña",
      html: `<p>Para elegir una nueva contraseña, abre este enlace (vence en 30 minutos):</p><p><a href="${origen}/restablecer-contrasena?token=${token}">${origen}/restablecer-contrasena?token=${token}</a></p><p>Si no pediste este cambio, ignora este correo.</p>`,
    });
  }

  return { ok: true, data: undefined };
}

// El cambio real de contraseña lo hace la Edge Function
// restablecer-contrasena (unico lugar con service_role -- el usuario no
// tiene sesion en este flujo, llego por un link de correo).
export async function restablecerContrasena(token: string, contrasena: string): Promise<Resultado> {
  const parseo = esquemaRestablecerContrasena.safeParse({ token, contrasena });
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("restablecer-contrasena", {
    body: { token: parseo.data.token, nuevaContrasena: parseo.data.contrasena },
  });

  if (error || !data?.ok) {
    return { ok: false, error: data?.error ?? error?.message ?? "No se pudo restablecer la contraseña" };
  }

  return { ok: true, data: undefined };
}

// PLT-001 regla 2: confirma identidad (Google no siempre da un nombre claro)
// y guarda la autorizacion de WhatsApp -- opt-in real, nunca se asume.
// Marca usu_onboarding_completo para no repetir esta pantalla. A nivel de
// usuario (comun_seguridad), no por negocio.
export async function completarBienvenida(datos: DatosBienvenida): Promise<Resultado> {
  const parseo = esquemaBienvenida.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({
      usu_nombres: parseo.data.nombres,
      usu_apellidos: parseo.data.apellidos,
      usu_whatsapp: parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null,
      usu_autorizacion_whatsapp: parseo.data.autorizaWhatsapp,
      usu_onboarding_completo: true,
    })
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

// PLT-012: baja de cuenta / derecho al olvido. Delega toda la decision
// (eliminar vs. rechazar) al RPC -- ver seg_fn_eliminar_cuenta() y su
// comentario sobre el chequeo de historial transaccional pendiente para
// cuando exista comun_facturacion. A nivel de usuario, no por negocio --
// elimina la identidad completa del ecosistema, no solo una membresia.
export async function eliminarCuenta(): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("comun_seguridad").rpc("seg_fn_eliminar_cuenta");
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  return { ok: true, data: undefined };
}

export async function cerrarSesion(): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
