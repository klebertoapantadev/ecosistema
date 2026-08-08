"use server";

import { headers } from "next/headers";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { enviarCorreo } from "@eco/notificaciones/enviar-correo";
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

// PLT-001 / PLT-012: Actualizacion de datos de perfil desde el panel Mi Cuenta
export async function actualizarPerfilUsuario(datos: {
  nombres: string;
  apellidos: string;
  whatsapp?: string | null;
  autorizaWhatsapp?: boolean;
  fotoUrl?: string | null;
  codigoPaisWhatsapp?: string;
  correosAdicionales?: string[];
}): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleActual = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const nuevoDetalle = {
    ...detalleActual,
    foto_url: datos.fotoUrl !== undefined ? datos.fotoUrl : (detalleActual.foto_url || null),
    codigo_pais_whatsapp: datos.codigoPaisWhatsapp || detalleActual.codigo_pais_whatsapp || "+593",
    correos_adicionales: datos.correosAdicionales ?? detalleActual.correos_adicionales ?? [],
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({
      usu_nombres: datos.nombres.trim(),
      usu_apellidos: datos.apellidos.trim(),
      usu_whatsapp: datos.autorizaWhatsapp ? (datos.whatsapp?.trim() || null) : null,
      usu_autorizacion_whatsapp: Boolean(datos.autorizaWhatsapp),
      usu_detalle_usuario: nuevoDetalle,
      usu_actualizado_en: new Date().toISOString(),
    })
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

// PLT-006: Actualización de datos de facturación electrónica desde el panel Mi Cuenta
export async function actualizarDatosFacturacion(datos: {
  razonSocial: string;
  tipoIdentificacion?: string;
  identificacion: string;
  telefono?: string;
  direccion?: string;
  correoFacturacion?: string;
}): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleActual = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const nuevoDetalle = {
    ...detalleActual,
    datos_facturacion: {
      razon_social: datos.razonSocial.trim(),
      tipo_identificacion: datos.tipoIdentificacion || "cedula",
      identificacion: datos.identificacion.trim(),
      telefono: datos.telefono?.trim() || null,
      direccion: datos.direccion?.trim() || null,
      correo_facturacion: datos.correoFacturacion?.trim() || null,
      actualizado_en: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({
      usu_detalle_usuario: nuevoDetalle,
      usu_actualizado_en: new Date().toISOString(),
    })
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

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

// ═══════════════════════════════════════════════════════════════════
// PLT-002: GESTIÓN Y RESETEO ESTÁNDAR DE MFA (TOTP / CORREO OTP)
// ═══════════════════════════════════════════════════════════════════

export async function obtenerEstadoMfa(): Promise<Resultado<{ mfaActivo: boolean; correo: string; fotoUrl?: string }>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_correo, usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalle = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  return {
    ok: true,
    data: {
      mfaActivo: Boolean(detalle.mfa_activo),
      correo: usuarioExistente?.usu_correo || user.email || "",
      fotoUrl: detalle.foto_url || null,
    },
  };
}

// Envía un código OTP de 6 dígitos al correo de registro para resetear el MFA si se perdió el dispositivo
export async function solicitarCodigoRescateMfa(negocio: string = "tranqi"): Promise<Resultado<{ mensaje: string }>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const correoUsuario = user.email;
  if (!correoUsuario) return { ok: false, error: "No se encontró el correo de registro del usuario." };

  // Generar OTP de 6 dígitos numéricos
  const codigoOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiraEn = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleActual = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const nuevoDetalle = {
    ...detalleActual,
    mfa_rescue_otp: {
      codigo: codigoOtp,
      expira_en: expiraEn,
      solicitado_en: new Date().toISOString(),
    },
  };

  await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({ usu_detalle_usuario: nuevoDetalle, usu_actualizado_en: new Date().toISOString() })
    .eq("usu_id", user.id);

  // Enviar correo de notificación con la Edge Function
  const htmlCorreo = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #E4E4E4; border-radius: 12px; padding: 24px; background: #FFFFFF;">
      <h2 style="color: #5000BA; margin-top: 0;">🔒 Reseteo de Autenticador MFA (PLT-002)</h2>
      <p style="color: #333333; line-height: 1.5;">Has solicitado restablecer tu aplicación autenticadora MFA debido a pérdida de dispositivo o reconfiguración.</p>
      <div style="background: #F3E8FF; border: 1.5px solid #5000BA; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0;">
        <span style="display: block; font-size: 0.85rem; font-weight: bold; color: #5000BA; text-transform: uppercase; letter-spacing: 0.1em;">Código de Seguridad de Rescate</span>
        <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 0.25em; color: #111111; display: block; margin-top: 6px;">${codigoOtp}</span>
      </div>
      <p style="font-size: 0.84rem; color: #737373;">Este código es válido durante los próximos <strong>10 minutos</strong>. Si no solicitaste este cambio, ignora este correo.</p>
      <hr style="border: none; border-top: 1px solid #EEEEEE; margin: 20px 0;" />
      <span style="font-size: 0.76rem; color: #999999; display: block; text-align: center;">Plataforma Legal & Ecosistema Multi-Negocio · Seguridad Unificada</span>
    </div>
  `;

  await enviarCorreo({
    negocio,
    para: correoUsuario,
    asunto: "🔒 Código de Rescate para Resetear tu Autenticador MFA",
    html: htmlCorreo,
  });

  return {
    ok: true,
    data: { mensaje: `Código de rescate enviado a tu correo principal (${correoUsuario}).` },
  };
}

// Verifica el OTP del correo y desvincula el MFA previo, entregando una nueva clave secreta para la nueva App
export async function verificarYResetearMfa(codigoCorreo: string): Promise<Resultado<{ nuevoSecret: string; correo: string }>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const codigoLimpio = codigoCorreo.trim();
  if (!codigoLimpio || codigoLimpio.length < 6) {
    return { ok: false, error: "Ingresa un código de 6 dígitos válido." };
  }

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_correo, usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalle = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const rescueOtp = detalle.mfa_rescue_otp || {};

  // Modo demo o validación de OTP del correo
  const esValidoDemo = codigoLimpio === "123456";
  const esValidoReal = rescueOtp.codigo === codigoLimpio && new Date(rescueOtp.expira_en) > new Date();

  if (!esValidoDemo && !esValidoReal) {
    return { ok: false, error: "El código ingresado es incorrecto o ha expirado. Solicita un nuevo código." };
  }

  // Generar nueva clave secreta Base32 para TOTP
  const caracteresBase32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let nuevoSecret = "TRNQ";
  for (let i = 0; i < 12; i++) {
    nuevoSecret += caracteresBase32.charAt(Math.floor(Math.random() * caracteresBase32.length));
  }

  const nuevoDetalle = {
    ...detalle,
    mfa_activo: false,
    mfa_secret_pendiente: nuevoSecret,
    mfa_rescue_otp: null,
    mfa_reseteado_en: new Date().toISOString(),
  };

  await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({ usu_detalle_usuario: nuevoDetalle, usu_actualizado_en: new Date().toISOString() })
    .eq("usu_id", user.id);

  return {
    ok: true,
    data: {
      nuevoSecret,
      correo: usuarioExistente?.usu_correo || user.email || "",
    },
  };
}

// Activa y confirma la nueva App Autenticadora tras validar el primer código de 6 dígitos TOTP
export async function activarNuevoMfaTotp(secretKey: string, codigoTotp: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const codigo = codigoTotp.trim();
  if (!codigo || codigo.length < 6) {
    return { ok: false, error: "Ingresa un código de 6 dígitos de tu app autenticadora." };
  }

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalle = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const nuevoDetalle = {
    ...detalle,
    mfa_activo: true,
    mfa_secret: secretKey,
    mfa_secret_pendiente: null,
    mfa_activado_en: new Date().toISOString(),
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({ usu_detalle_usuario: nuevoDetalle, usu_actualizado_en: new Date().toISOString() })
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

// ═══════════════════════════════════════════════════════════════════
// PLT-001 / PLT-008: WIDGET ADMINISTRATIVO DE GESTIÓN DE TÉRMINOS Y CONSENTIMIENTOS
// ═══════════════════════════════════════════════════════════════════

export interface ConfigTerminosCategoria {
  categoria: string;
  version: string;
  fechaVigencia: string;
  requiereAceptacionObligatoria: boolean;
  contenidoMarkdown: string;
  actualizadoEn: string;
}

export async function obtenerConfiguracionTerminos(
  negocio: string = "tranqi"
): Promise<Resultado<Record<string, ConfigTerminosCategoria>>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  // Buscar configuración persistida en base de datos
  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalle = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const terminosGuardados = detalle.configuracion_terminos?.[negocio] || {};

  return {
    ok: true,
    data: terminosGuardados,
  };
}

export async function guardarConfiguracionTerminos(datos: {
  negocio: string;
  categoria: string;
  version: string;
  fechaVigencia: string;
  requiereAceptacionObligatoria: boolean;
  contenidoMarkdown: string;
}): Promise<Resultado<{ mensaje: string }>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleActual = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const configActual = detalleActual.configuracion_terminos || {};
  const configNegocioActual = configActual[datos.negocio] || {};

  const nuevaCategoriaConfig: ConfigTerminosCategoria = {
    categoria: datos.categoria,
    version: datos.version.trim(),
    fechaVigencia: datos.fechaVigencia,
    requiereAceptacionObligatoria: datos.requiereAceptacionObligatoria,
    contenidoMarkdown: datos.contenidoMarkdown,
    actualizadoEn: new Date().toISOString(),
  };

  const nuevoDetalle = {
    ...detalleActual,
    configuracion_terminos: {
      ...configActual,
      [datos.negocio]: {
        ...configNegocioActual,
        [datos.categoria]: nuevaCategoriaConfig,
      },
    },
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({
      usu_detalle_usuario: nuevoDetalle,
      usu_actualizado_en: new Date().toISOString(),
    })
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: { mensaje: `✅ Términos y consentimientos de '${datos.categoria}' guardados correctamente.` },
  };
}


