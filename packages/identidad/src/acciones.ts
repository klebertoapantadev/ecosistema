"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
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
import { obtenerPerfiles } from "./consultas";
import {
  claveNegocioCanonica,
  codigosNegocio,
  obtenerRegistroNegocioDetalle,
  perteneceAlNegocio,
} from "./negocio";
import {
  notificarNuevoUsuarioRegistrado,
  procesarAutoafiliacionYBienvenidaConvenio,
} from "@eco/notificaciones/notificar-usuario";

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
): Promise<Resultado> {
  const negocioCanon = claveNegocioCanonica(negocio);
  const adminDb = crearClienteAdmin();
  const db = adminDb ?? supabase;
  const errores: string[] = [];

  const verificarMembresiaActiva = async (): Promise<boolean> => {
    const { data, error } = await db
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_negocio, mem_estado")
      .eq("mem_usuario_id", usuarioId)
      .eq("mem_estado", "ACTIVO");
    if (error) {
      console.error("[identidad] Error verificando seg_membresia activa:", error.message);
      return false;
    }
    return (data ?? []).some((m) => perteneceAlNegocio(m.mem_negocio, negocioCanon));
  };

  // 1. Intento principal: RPC transaccional seg_fn_asegurar_membresia_cliente
  const { error: errRpc } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_asegurar_membresia_cliente", { p_negocio: negocioCanon });
  if (errRpc) {
    console.error("[identidad] seg_fn_asegurar_membresia_cliente falló:", errRpc.message);
    errores.push(`seg_fn_asegurar_membresia_cliente: ${errRpc.message}`);
  }

  if (!errRpc && (await verificarMembresiaActiva())) {
    return { ok: true, data: undefined };
  }

  // 2. Respaldo SECURITY DEFINER: reclama invitación pendiente, reactiva/crea CLIENTE y confirma correo OAuth
  let syncConfirmoMembresia = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: syncData, error: errSync } = await (supabase.schema("comun_seguridad") as any).rpc(
      "seg_fn_sincronizar_acceso_rol_tinkay",
      {
        p_negocio: negocioCanon,
        p_crear_cliente_si_no_existe: true,
      },
    );
    if (errSync) {
      console.error("[identidad] seg_fn_sincronizar_acceso_rol_tinkay falló:", errSync.message);
      errores.push(`seg_fn_sincronizar_acceso_rol_tinkay: ${errSync.message}`);
    } else if (syncData?.tieneMembresia) {
      syncConfirmoMembresia = true;
      if (await verificarMembresiaActiva()) {
        return { ok: true, data: undefined };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[identidad] Excepción en seg_fn_sincronizar_acceso_rol_tinkay:", msg);
    errores.push(msg);
  }

  // 3. Respaldo directo (RLS seg_membresia_propia_insert_cliente o adminDb)
  const ahoraIso = new Date().toISOString();
  if (adminDb) {
    const { data: filasPrevias } = await adminDb
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_negocio, mem_estado")
      .eq("mem_usuario_id", usuarioId);
    const filaExistente = (filasPrevias ?? []).find((m) =>
      perteneceAlNegocio(m.mem_negocio, negocioCanon),
    );
    if (filaExistente?.mem_id) {
      const { error: errAct } = await adminDb
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({ mem_estado: "ACTIVO", mem_actualizado_en: ahoraIso })
        .eq("mem_id", filaExistente.mem_id);
      if (errAct) {
        console.error("[identidad] adminDb reactivación seg_membresia falló:", errAct.message);
        errores.push(`admin update seg_membresia: ${errAct.message}`);
      }
    } else {
      const { error: errIns } = await adminDb
        .schema("comun_seguridad")
        .from("seg_membresia")
        .insert({
          mem_usuario_id: usuarioId,
          mem_negocio: negocioCanon,
          mem_rol: "CLIENTE",
          mem_estado: "ACTIVO",
        });
      if (errIns && errIns.code !== "23505") {
        console.error("[identidad] adminDb insert seg_membresia falló:", errIns.message);
        errores.push(`admin insert seg_membresia: ${errIns.message}`);
      }
    }
  } else {
    const { error: errInsCliente } = await supabase
      .schema("comun_seguridad")
      .from("seg_membresia")
      .insert({
        mem_usuario_id: usuarioId,
        mem_negocio: negocioCanon,
        mem_rol: "CLIENTE",
        mem_estado: "ACTIVO",
      });
    if (errInsCliente && errInsCliente.code !== "23505") {
      console.error("[identidad] insert seg_membresia fallback falló:", errInsCliente.message);
      errores.push(`insert seg_membresia: ${errInsCliente.message}`);
    }
  }

  if (await verificarMembresiaActiva()) {
    return { ok: true, data: undefined };
  }

  if (syncConfirmoMembresia) {
    console.error(
      "[identidad] ADVERTENCIA: RPC SECURITY DEFINER confirmó membresía activa pero SELECT directo no devolvió filas.",
    );
    return { ok: true, data: undefined };
  }

  return {
    ok: false,
    error:
      errores.length > 0
        ? `No se pudo activar tu membresía en ${negocioCanon}: ${errores.join(" | ")}`
        : `No se pudo activar tu membresía en ${negocioCanon}. Intenta nuevamente.`,
  };
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
export async function registrarUsuario(datos: DatosRegistro, negocio: string): Promise<Resultado<{ requiereVerificacionCorreo: boolean }>> {
  const parseo = esquemaRegistro.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const negocioCanon = claveNegocioCanonica(negocio);
  const codigosNeg = codigosNegocio(negocioCanon);
  const supabase = await crearClienteServidor();
  const adminDb = crearClienteAdmin();

  const { data, error } = await supabase.auth.signUp({
    email: parseo.data.correo,
    password: parseo.data.contrasena,
    options: {
      data: {
        given_name: parseo.data.nombres,
        family_name: parseo.data.apellidos,
        terminos_version: TERMINOS_VERSION,
      },
    },
  });

  let usuarioId: string | null = data?.user?.id ?? null;

  if (error) {
    const esCorreoExistente = /already registered|already been registered|exists|registrado/i.test(
      error.message
    );
    if (!esCorreoExistente) {
      return { ok: false, error: error.message };
    }

    // Verificar si ya está registrado específicamente en ESTE negocio
    if (adminDb) {
      const { data: usrExistente } = await adminDb
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id")
        .ilike("usu_correo", parseo.data.correo.trim())
        .limit(1)
        .maybeSingle();

      if (usrExistente?.usu_id) {
        const { data: memEsteNegocio } = await adminDb
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_id")
          .eq("mem_usuario_id", usrExistente.usu_id)
          .in("mem_negocio", codigosNeg)
          .eq("mem_estado", "ACTIVO")
          .limit(1)
          .maybeSingle();

        if (memEsteNegocio?.mem_id) {
          return {
            ok: false,
            error: "Este correo ya tiene una cuenta activa en este portal. Inicia sesión o recupera tu contraseña.",
          };
        }
      }
    }

    // La credencial existía en otro negocio independiente: autenticar su clave actual
    // para darle de alta su cuenta y consentimientos propios en ESTE negocio sin pisar el otro.
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: parseo.data.correo,
      password: parseo.data.contrasena,
    });

    if (signInErr || !signInData.user) {
      return {
        ok: false,
        error:
          "Ya existe una credencial asociada a este correo. Ingresa tu contraseña actual para registrarte aquí, usa «Continuar con Google» o restablece tu contraseña en «¿Olvidaste tu contraseña?».",
      };
    }

    // Doble chequeo con sesión ya autenticada: si ya tenía membresía en este negocio, avisar
    const dbCheck = adminDb ?? supabase;
    const { data: memCheck } = await dbCheck
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id")
      .eq("mem_usuario_id", signInData.user.id)
      .in("mem_negocio", codigosNeg)
      .eq("mem_estado", "ACTIVO")
      .limit(1)
      .maybeSingle();

    if (memCheck?.mem_id) {
      return {
        ok: false,
        error: "Este correo ya tiene una cuenta activa en este portal. Inicia sesión directamente.",
      };
    }

    usuarioId = signInData.user.id;
  }

  if (!usuarioId) {
    return { ok: false, error: "No se pudo crear el usuario" };
  }

  const resMembresia = await asegurarMembresiaCliente(supabase, usuarioId, negocioCanon);
  if (!resMembresia.ok) {
    return { ok: false, error: resMembresia.error };
  }
  await asegurarTerminosAceptados(supabase, usuarioId);

  let correoYaVerificado = false;

  // PLT-001: Persistir identidad, WhatsApp y consentimiento LOPDP AISLADOS por negocio
  try {
    const dbCliente = adminDb ?? supabase;
    const [{ data: usrPrevio }, { data: otrasMembresias }] = await Promise.all([
      dbCliente
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_whatsapp, usu_correo_verificado_en, usu_detalle_usuario")
        .eq("usu_id", usuarioId)
        .maybeSingle(),
      dbCliente
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_id, mem_negocio")
        .eq("mem_usuario_id", usuarioId)
        .eq("mem_estado", "ACTIVO"),
    ]);

    correoYaVerificado = Boolean(usrPrevio?.usu_correo_verificado_en);
    const codigosSetUpper = new Set(codigosNeg.map((c) => c.toUpperCase()));
    const tieneOtrosNegocios = (otrasMembresias || []).some(
      (m) => !codigosSetUpper.has((m.mem_negocio || "").toUpperCase())
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detalleActual = (usrPrevio?.usu_detalle_usuario as Record<string, any>) || {};
    const mapaRegistros =
      detalleActual.registros_negocio && typeof detalleActual.registros_negocio === "object"
        ? { ...detalleActual.registros_negocio }
        : {};
    const ahoraIso = new Date().toISOString();

    const registroEsteNegocio = {
      nombres: parseo.data.nombres,
      apellidos: parseo.data.apellidos,
      whatsapp: parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null,
      codigo_pais_whatsapp: parseo.data.codigoPaisWhatsapp || "+593",
      autoriza_whatsapp: Boolean(parseo.data.autorizaWhatsapp),
      onboarding_completo: true,
      terminos_version: TERMINOS_VERSION,
      terminos_aceptados_en: ahoraIso,
      notificado_registro_staff: true,
      registrado_en: ahoraIso,
      actualizado_en: ahoraIso,
      consentimiento_whatsapp_info: {
        autorizado: Boolean(parseo.data.autorizaWhatsapp),
        finalidad: "CONTACTO_COMERCIAL_PROFORMAS_E_INFORMACION",
        aceptado_en: ahoraIso,
        negocio: negocioCanon,
      },
    };

    mapaRegistros[negocioCanon] = registroEsteNegocio;

    // Si pertenece también a otro negocio, no sobrescribir las columnas globales de aquel negocio
    const payloadUpdateUsuario: {
      usu_nombres?: string | null;
      usu_apellidos?: string | null;
      usu_whatsapp?: string | null;
      usu_autorizacion_whatsapp?: boolean;
      usu_onboarding_completo: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      usu_detalle_usuario: any;
      usu_actualizado_en: string;
    } = {
      usu_onboarding_completo: true,
      usu_detalle_usuario: {
        ...detalleActual,
        registros_negocio: mapaRegistros,
      },
      usu_actualizado_en: ahoraIso,
    };

    if (!tieneOtrosNegocios) {
      payloadUpdateUsuario.usu_nombres = parseo.data.nombres;
      payloadUpdateUsuario.usu_apellidos = parseo.data.apellidos;
      payloadUpdateUsuario.usu_whatsapp = parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null;
      payloadUpdateUsuario.usu_autorizacion_whatsapp = Boolean(parseo.data.autorizaWhatsapp);
    } else {
      if (!usrPrevio?.usu_nombres) payloadUpdateUsuario.usu_nombres = parseo.data.nombres;
      if (!usrPrevio?.usu_apellidos) payloadUpdateUsuario.usu_apellidos = parseo.data.apellidos;
    }

    await dbCliente
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update(payloadUpdateUsuario)
      .eq("usu_id", usuarioId);

    // Guardar copia de los datos y consentimientos en la membresía propia del negocio
    if (adminDb) {
      await adminDb
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({
          mem_detalle_membresia: registroEsteNegocio,
          mem_actualizado_en: ahoraIso,
        })
        .eq("mem_usuario_id", usuarioId)
        .in("mem_negocio", codigosNeg);
    }

    // Registrar evidencia auditable de consentimiento LOPDP por negocio
    try {
      const { ip, userAgent } = await obtenerIpYAgente();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (dbCliente.schema("comun_seguridad") as any)
        .from("seg_usuario_consentimiento")
        .insert({
          usc_usuario_id: usuarioId,
          usc_negocio: negocioCanon.toUpperCase(),
          usc_clave_documento: "consentimiento_whatsapp_lopdp",
          usc_version: TERMINOS_VERSION,
          usc_estado: parseo.data.autorizaWhatsapp ? "ACEPTADO" : "RECHAZADO",
          usc_ip: ip,
          usc_user_agent: userAgent,
          usc_metadatos: {
            whatsapp: parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null,
            finalidad: "CONTACTO_COMERCIAL_PROFORMAS_E_INFORMACION",
            negocio: negocioCanon,
          },
        });
    } catch {
      // Tabla opcional en entornos antiguos
    }
  } catch (errWa) {
    console.warn("Advertencia al guardar WhatsApp por negocio en registro:", errWa);
  }

  const { ip, userAgent } = await obtenerIpYAgente();
  await registrarAcceso(supabase, usuarioId, ip, userAgent, negocioCanon);

  // Reclamar cualquier invitación pendiente de rol de equipo para este negocio (ej. VENTAS / TALLER / DELIVERY en Tinkay)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.schema("comun_seguridad") as any).rpc("seg_fn_sincronizar_acceso_rol_tinkay", {
      p_negocio: negocioCanon,
      p_crear_cliente_si_no_existe: false,
    });
  } catch {
    // Ignorar si la migración aún no está desplegada
  }

  // Despachar notificación multicanal ESTRICTAMENTE a Operadores y Administradores de ESTE negocio
  await notificarNuevoUsuarioRegistrado({
    usuarioId,
    nombres: parseo.data.nombres,
    apellidos: parseo.data.apellidos,
    correo: parseo.data.correo,
    negocio: negocioCanon,
  });

  if (!correoYaVerificado) {
    try {
      const { data: codigo, error: errorOtp } = await supabase
        .schema("comun_seguridad")
        .rpc("seg_fn_generar_otp_registro");
      if (!errorOtp && codigo) {
        const envio = await enviarCorreo({
          negocio: negocioCanon,
          para: parseo.data.correo,
          asunto: "Tu código de verificación",
          html: `<p>Hola${parseo.data.nombres ? ` ${parseo.data.nombres}` : ""},</p><p>Tu código de verificación es <strong style="font-size:1.4em; letter-spacing:0.2em;">${codigo}</strong></p><p>Vence en 15 minutos.</p>`,
        });
        if (!envio.ok) {
          console.warn("SMTP no disponible en registro:", envio.error);
        }
      }
    } catch (errOtp) {
      console.warn("Error secundario generando OTP:", errOtp);
    }
  }

  return { ok: true, data: { requiereVerificacionCorreo: !correoYaVerificado } };
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

  const negocioCanon = claveNegocioCanonica(negocio);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parseo.data.correo,
    password: parseo.data.contrasena,
  });

  if (error) return { ok: false, error: error.message };

  // PLT-001 / PLT-003: Validar aislamiento estricto por negocio.
  // Si el usuario existe en otro negocio pero NO se ha registrado en este,
  // cerrar la sesión de inmediato e invitarlo a registrarse aquí.
  const db = crearClienteAdmin() ?? supabase;
  const [{ data: usr }, { data: mem }] = await Promise.all([
    db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_superadmin_plataforma, usu_correo")
      .eq("usu_id", data.user.id)
      .maybeSingle(),
    db
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_estado")
      .eq("mem_usuario_id", data.user.id)
      .in("mem_negocio", codigosNegocio(negocioCanon))
      .eq("mem_estado", "ACTIVO")
      .limit(1)
      .maybeSingle(),
  ]);

  const correoLower = (usr?.usu_correo || data.user.email || "").toLowerCase().trim();
  const esSuperAdminPlataforma =
    Boolean(usr?.usu_superadmin_plataforma) ||
    correoLower === "kleber.toapanta.ch@gmail.com" ||
    correoLower === "jesus251296@gmail.com" ||
    correoLower === "familiammtg@gmail.com" ||
    (negocioCanon === "tinkay" && correoLower === "tinkay.uio@gmail.com");

  let tieneMembresiaOInvitacion = Boolean(mem);
  try {
    // Reclamar invitación pendiente si el correo fue invitado a este negocio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: syncInv } = await (supabase.schema("comun_seguridad") as any).rpc(
      "seg_fn_sincronizar_acceso_rol_tinkay",
      {
        p_negocio: negocioCanon,
        p_crear_cliente_si_no_existe: false,
      }
    );
    if (syncInv?.tieneMembresia || syncInv?.invitacionAplicada) {
      tieneMembresiaOInvitacion = true;
    }
  } catch {
    // Ignorar si el RPC aún no está disponible
  }

  if (!tieneMembresiaOInvitacion && !esSuperAdminPlataforma) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        "No encontramos una cuenta registrada en este portal con ese correo. Crea tu cuenta en «Regístrate» para continuar.",
    };
  }

  const { ip, userAgent } = await obtenerIpYAgente();
  await registrarAcceso(supabase, data.user.id, ip, userAgent, negocioCanon);

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

// PLT-001 / PLT-012: Actualizacion de datos de perfil desde el panel Mi Cuenta (aislado por negocio)
export async function actualizarPerfilUsuario(
  datos: {
    nombres: string;
    apellidos: string;
    whatsapp?: string | null;
    autorizaWhatsapp?: boolean;
    fotoUrl?: string | null;
    codigoPaisWhatsapp?: string;
    correosAdicionales?: string[];
  },
  negocio?: string,
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const adminDb = crearClienteAdmin();
  const db = adminDb ?? supabase;
  const [{ data: usuarioExistente }, { data: membresiasUsuario }] = await Promise.all([
    db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", user.id)
      .maybeSingle(),
    db
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_negocio")
      .eq("mem_usuario_id", user.id)
      .eq("mem_estado", "ACTIVO"),
  ]);

  const negocioCanon = negocio ? claveNegocioCanonica(negocio) : null;
  const codigosSetUpper = negocioCanon
    ? new Set(codigosNegocio(negocioCanon).map((c) => c.toUpperCase()))
    : null;
  const tieneOtrosNegocios = Boolean(
    codigosSetUpper &&
      (membresiasUsuario || []).some(
        (m) => !codigosSetUpper.has((m.mem_negocio || "").toUpperCase())
      )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleActual = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const mapaRegistros =
    detalleActual.registros_negocio && typeof detalleActual.registros_negocio === "object"
      ? { ...detalleActual.registros_negocio }
      : {};
  const ahoraIso = new Date().toISOString();

  if (negocioCanon) {
    const regPrevio = obtenerRegistroNegocioDetalle(detalleActual, negocioCanon);
    mapaRegistros[negocioCanon] = {
      ...(regPrevio || {}),
      nombres: datos.nombres.trim(),
      apellidos: datos.apellidos.trim(),
      whatsapp: datos.autorizaWhatsapp ? (datos.whatsapp?.trim() || null) : null,
      codigo_pais_whatsapp: datos.codigoPaisWhatsapp || regPrevio?.codigo_pais_whatsapp || "+593",
      autoriza_whatsapp: Boolean(datos.autorizaWhatsapp),
      onboarding_completo: true,
      actualizado_en: ahoraIso,
    };
  }

  const nuevoDetalle = {
    ...detalleActual,
    foto_url: datos.fotoUrl !== undefined ? datos.fotoUrl : (detalleActual.foto_url || null),
    codigo_pais_whatsapp: datos.codigoPaisWhatsapp || detalleActual.codigo_pais_whatsapp || "+593",
    correos_adicionales: datos.correosAdicionales ?? detalleActual.correos_adicionales ?? [],
    ...(negocioCanon ? { registros_negocio: mapaRegistros } : {}),
  };

  const payloadUpdate: {
    usu_nombres?: string | null;
    usu_apellidos?: string | null;
    usu_whatsapp?: string | null;
    usu_autorizacion_whatsapp?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usu_detalle_usuario: any;
    usu_actualizado_en: string;
  } = {
    usu_detalle_usuario: nuevoDetalle,
    usu_actualizado_en: ahoraIso,
  };

  if (!tieneOtrosNegocios) {
    payloadUpdate.usu_nombres = datos.nombres.trim();
    payloadUpdate.usu_apellidos = datos.apellidos.trim();
    payloadUpdate.usu_whatsapp = datos.autorizaWhatsapp ? (datos.whatsapp?.trim() || null) : null;
    payloadUpdate.usu_autorizacion_whatsapp = Boolean(datos.autorizaWhatsapp);
  }

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update(payloadUpdate)
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  if (negocioCanon) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.schema("comun_seguridad") as any).rpc("seg_fn_sincronizar_acceso_rol_tinkay", {
        p_negocio: negocioCanon,
        p_crear_cliente_si_no_existe: false,
      });
    } catch {
      // Ignorar si la migración aún no está desplegada
    }
  }

  if (user.email && negocioCanon) {
    await procesarAutoafiliacionYBienvenidaConvenio({
      usuarioId: user.id,
      nombres: datos.nombres.trim(),
      apellidos: datos.apellidos.trim(),
      correo: user.email,
      negocio: negocioCanon,
    });
  }

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

// PLT-006: Consulta de datos de facturación electrónica del usuario autenticado
export async function obtenerDatosFacturacionUsuario(): Promise<Resultado<{
  tienePerfilFacturacion: boolean;
  razonSocial: string;
  tipoIdentificacion: string;
  identificacion: string;
  telefono: string;
  direccion: string;
  correoFacturacion: string;
}>> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { data: usuario } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  if (!usuario) {
    return { ok: false, error: "Usuario no encontrado" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalle = (usuario.usu_detalle_usuario as Record<string, any>) || {};
  const datosFact = detalle.datos_facturacion;

  if (datosFact && (datosFact.razon_social || datosFact.identificacion)) {
    return {
      ok: true,
      data: {
        tienePerfilFacturacion: true,
        razonSocial: datosFact.razon_social || "",
        tipoIdentificacion: datosFact.tipo_identificacion || "cedula",
        identificacion: datosFact.identificacion || "",
        telefono: datosFact.telefono || usuario.usu_whatsapp || "",
        direccion: datosFact.direccion || "",
        correoFacturacion: datosFact.correo_facturacion || usuario.usu_correo || "",
      },
    };
  }

  // Fallback con datos de registro si aún no tiene perfil de facturación configurado
  const nombreCompleto = [usuario.usu_nombres, usuario.usu_apellidos].filter(Boolean).join(" ");
  return {
    ok: true,
    data: {
      tienePerfilFacturacion: false,
      razonSocial: nombreCompleto || "",
      tipoIdentificacion: "cedula",
      identificacion: "",
      telefono: usuario.usu_whatsapp || "",
      direccion: "",
      correoFacturacion: usuario.usu_correo || "",
    },
  };
}

// PLT-001 regla 2: confirma identidad (Google no siempre da un nombre claro)
// y guarda la autorizacion de WhatsApp -- opt-in real, aislado por negocio.
export async function completarBienvenida(
  datos: DatosBienvenida,
  negocio: string = "tranqi",
): Promise<Resultado> {
  const parseo = esquemaBienvenida.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const negocioCanon = claveNegocioCanonica(negocio);
  const codigosNeg = codigosNegocio(negocioCanon);
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const resMembresia = await asegurarMembresiaCliente(supabase, user.id, negocioCanon);
  await asegurarTerminosAceptados(supabase, user.id);

  const adminDb = crearClienteAdmin();
  const db = adminDb ?? supabase;

  const [{ data: usrPrevio }, { data: otrasMembresias }] = await Promise.all([
    db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_detalle_usuario")
      .eq("usu_id", user.id)
      .maybeSingle(),
    db
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_negocio")
      .eq("mem_usuario_id", user.id)
      .eq("mem_estado", "ACTIVO"),
  ]);

  const codigosSetUpper = new Set(codigosNeg.map((c) => c.toUpperCase()));
  const tieneOtrosNegocios = (otrasMembresias || []).some(
    (m) => !codigosSetUpper.has((m.mem_negocio || "").toUpperCase())
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detallePrevio = (usrPrevio?.usu_detalle_usuario as Record<string, any>) || {};
  const regPrevio = obtenerRegistroNegocioDetalle(detallePrevio, negocioCanon);
  const yaNotificadoStaff = Boolean(regPrevio?.notificado_registro_staff);
  const mapaRegistros =
    detallePrevio.registros_negocio && typeof detallePrevio.registros_negocio === "object"
      ? { ...detallePrevio.registros_negocio }
      : {};
  const ahoraIso = new Date().toISOString();

  const registroEsteNegocio = {
    ...(regPrevio || {}),
    nombres: parseo.data.nombres,
    apellidos: parseo.data.apellidos,
    whatsapp: parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null,
    autoriza_whatsapp: Boolean(parseo.data.autorizaWhatsapp),
    onboarding_completo: true,
    terminos_version: TERMINOS_VERSION,
    terminos_aceptados_en: regPrevio?.terminos_aceptados_en || ahoraIso,
    notificado_registro_staff: true,
    registrado_en: regPrevio?.registrado_en || ahoraIso,
    actualizado_en: ahoraIso,
    consentimiento_whatsapp_info: {
      autorizado: Boolean(parseo.data.autorizaWhatsapp),
      finalidad: "CONTACTO_COMERCIAL_PROFORMAS_E_INFORMACION",
      aceptado_en: ahoraIso,
      negocio: negocioCanon,
    },
  };

  mapaRegistros[negocioCanon] = registroEsteNegocio;

  const payloadUpdate: {
    usu_nombres?: string | null;
    usu_apellidos?: string | null;
    usu_whatsapp?: string | null;
    usu_autorizacion_whatsapp?: boolean;
    usu_onboarding_completo: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usu_detalle_usuario: any;
    usu_actualizado_en: string;
  } = {
    usu_onboarding_completo: true,
    usu_detalle_usuario: {
      ...detallePrevio,
      registros_negocio: mapaRegistros,
    },
    usu_actualizado_en: ahoraIso,
  };

  if (!tieneOtrosNegocios) {
    payloadUpdate.usu_nombres = parseo.data.nombres;
    payloadUpdate.usu_apellidos = parseo.data.apellidos;
    payloadUpdate.usu_whatsapp = parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null;
    payloadUpdate.usu_autorizacion_whatsapp = parseo.data.autorizaWhatsapp;
  } else {
    if (!usrPrevio?.usu_nombres) payloadUpdate.usu_nombres = parseo.data.nombres;
    if (!usrPrevio?.usu_apellidos) payloadUpdate.usu_apellidos = parseo.data.apellidos;
  }

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update(payloadUpdate)
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  // Reclamar invitación pendiente de equipo y asegurar membresía activa + correo OAuth tras confirmar bienvenida
  let membresiaConfirmada = resMembresia.ok;
  let errorSyncMembresia: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: syncData, error: syncErr } = await (supabase.schema("comun_seguridad") as any).rpc(
      "seg_fn_sincronizar_acceso_rol_tinkay",
      {
        p_negocio: negocioCanon,
        p_crear_cliente_si_no_existe: true,
      },
    );
    if (syncErr) {
      errorSyncMembresia = syncErr.message;
      console.error("[identidad] completarBienvenida sync falló:", syncErr.message);
    } else if (syncData?.tieneMembresia || syncData?.invitacionAplicada) {
      membresiaConfirmada = true;
    }
  } catch (errSync) {
    errorSyncMembresia = errSync instanceof Error ? errSync.message : String(errSync);
    console.error("[identidad] completarBienvenida sync excepción:", errorSyncMembresia);
  }

  if (!membresiaConfirmada) {
    const detalleError = !resMembresia.ok
      ? resMembresia.error
      : errorSyncMembresia
        ? `No se pudo activar tu cuenta en ${negocioCanon}: ${errorSyncMembresia}`
        : `No se pudo confirmar tu membresía activa en ${negocioCanon}. Intenta nuevamente.`;
    return { ok: false, error: detalleError };
  }

  if (adminDb) {
    await adminDb
      .schema("comun_seguridad")
      .from("seg_membresia")
      .update({
        mem_detalle_membresia: registroEsteNegocio,
        mem_actualizado_en: ahoraIso,
      })
      .eq("mem_usuario_id", user.id)
      .in("mem_negocio", codigosNeg);
  }

  try {
    const { ip, userAgent } = await obtenerIpYAgente();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.schema("comun_seguridad") as any)
      .from("seg_usuario_consentimiento")
      .insert({
        usc_usuario_id: user.id,
        usc_negocio: negocioCanon.toUpperCase(),
        usc_clave_documento: "consentimiento_whatsapp_lopdp",
        usc_version: TERMINOS_VERSION,
        usc_estado: parseo.data.autorizaWhatsapp ? "ACEPTADO" : "RECHAZADO",
        usc_ip: ip,
        usc_user_agent: userAgent,
        usc_metadatos: {
          whatsapp: parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null,
          finalidad: "CONTACTO_COMERCIAL_PROFORMAS_E_INFORMACION",
          negocio: negocioCanon,
        },
      });
  } catch {
    // Ignorar en entornos sin tabla de consentimiento
  }

  if (user.email) {
    if (!yaNotificadoStaff) {
      await notificarNuevoUsuarioRegistrado({
        usuarioId: user.id,
        nombres: parseo.data.nombres,
        apellidos: parseo.data.apellidos,
        correo: user.email,
        negocio: negocioCanon,
      });
    } else {
      await procesarAutoafiliacionYBienvenidaConvenio({
        usuarioId: user.id,
        nombres: parseo.data.nombres,
        apellidos: parseo.data.apellidos,
        correo: user.email,
        negocio: negocioCanon,
      });
    }
  }

  return { ok: true, data: undefined };
}

// PLT-012: baja de cuenta / derecho al olvido aislada por negocio.
// Si se indica `negocio`, elimina únicamente la membresía y datos registrados en ese negocio,
// conservando intactas las cuentas que el usuario pueda tener en otros negocios independientes.
export async function eliminarCuenta(negocio?: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  if (negocio) {
    const negocioCanon = claveNegocioCanonica(negocio);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.schema("comun_seguridad") as any).rpc(
      "seg_fn_eliminar_cuenta_negocio",
      { p_negocio: negocioCanon }
    );

    if (error) {
      // Fallback solo si el RPC aún no fue desplegado y el usuario no pertenece a otros negocios
      if (/seg_fn_eliminar_cuenta_negocio/i.test(error.message)) {
        const { error: errLegacy } = await supabase
          .schema("comun_seguridad")
          .rpc("seg_fn_eliminar_cuenta");
        if (errLegacy) return { ok: false, error: errLegacy.message };
      } else {
        return { ok: false, error: error.message };
      }
    }
    await supabase.auth.signOut();
    return { ok: true, data: undefined };
  }

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
function esBase32Valido(secret: unknown): secret is string {
  if (typeof secret !== "string" || secret.length < 8) return false;
  return /^[A-Z2-7]+$/i.test(secret);
}

function generarSecretoBase32(longitud: number = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "TRNQ";
  for (let i = 0; i < longitud - 4; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

export async function obtenerEstadoMfa(): Promise<Resultado<{
  mfaActivo: boolean;
  correo: string;
  secretKey: string;
  fotoUrl?: string;
}>> {
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
  let secretKey = detalle.mfa_secret || detalle.mfa_secret_pendiente;

  if (!esBase32Valido(secretKey)) {
    secretKey = generarSecretoBase32(16);
    const nuevoDetalle = {
      ...detalle,
      mfa_secret_pendiente: secretKey,
    };
    await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({ usu_detalle_usuario: nuevoDetalle, usu_actualizado_en: new Date().toISOString() })
      .eq("usu_id", user.id);
  }

  return {
    ok: true,
    data: {
      mfaActivo: Boolean(detalle.mfa_activo),
      correo: usuarioExistente?.usu_correo || user.email || "",
      secretKey,
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
      <h2 style="color: #5000BA; margin-top: 0;">Reseteo de Autenticador MFA (PLT-002)</h2>
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
    asunto: "Código de Rescate para Resetear tu Autenticador MFA",
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

function base32Decode(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output = new Uint8Array(Math.floor((cleaned.length * 5) / 8));
  let index = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned.charAt(i);
    const charIndex = alphabet.indexOf(char);
    if (charIndex === -1) continue;
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

/**
 * Valida criptográficamente un código TOTP de 6 dígitos contra la clave secreta Base32 (RFC 6238 HMAC-SHA1).
 */
function validarCodigoTotpSecret(secretBase32: string, codigoIngresado: string): boolean {
  if (!secretBase32 || !codigoIngresado) return false;
  const key = base32Decode(secretBase32);
  if (key.length === 0) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const currentCounter = Math.floor(nowSeconds / timeStep);
  const codigoLimpio = codigoIngresado.replace(/[\s-]/g, "").trim();

  // Permite ventana de tolerancia amplia de ±4 pasos (120s atras/adelante por desfase de reloj)
  for (let delta = -4; delta <= 4; delta++) {
    const counter = currentCounter + delta;
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac("sha1", Buffer.from(key));
    hmac.update(buffer);
    const digest = hmac.digest();

    const lastByte = digest[digest.length - 1] ?? 0;
    const offset = lastByte & 0xf;
    const b0 = digest[offset] ?? 0;
    const b1 = digest[offset + 1] ?? 0;
    const b2 = digest[offset + 2] ?? 0;
    const b3 = digest[offset + 3] ?? 0;

    const codeInt =
      ((b0 & 0x7f) << 24) |
      ((b1 & 0xff) << 16) |
      ((b2 & 0xff) << 8) |
      (b3 & 0xff);

    const otp = (codeInt % 1000000).toString().padStart(6, "0");
    if (otp === codigoLimpio) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica el código TOTP ingresado por el usuario en tiempo real contra el secret asignado a su cuenta.
 * SuperAdmin y Administrador Plataforma BYPASS (PLT-002 Rule: SuperAdmin no requiere MFA jamás).
 */
export async function verificarCodigoTotpUsuario(
  codigoTotp: string,
  negocio: string = "tranqi",
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada. Inicia sesión nuevamente." };

  // 1. REGLA PLT-002: SuperAdmin y Administradores Plataforma NUNCA requieren ni son bloqueados por MFA
  const perfilesUsuario = await obtenerPerfiles(claveNegocioCanonica(negocio));
  if (perfilesUsuario.includes("SUPERADMIN") || perfilesUsuario.includes("ADMINISTRADOR")) {
    return { ok: true, data: undefined };
  }

  const codigo = codigoTotp.replace(/[\s-]/g, "").trim();
  if (!codigo || codigo.length < 6) {
    return { ok: false, error: "Ingresa un código de 6 dígitos válido de tu aplicación autenticadora." };
  }

  const { data: usuarioExistente } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_detalle_usuario")
    .eq("usu_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalle = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
  const secretBase32 = detalle.mfa_secret || detalle.mfa_secret_pendiente;

  if (!esBase32Valido(secretBase32)) {
    return {
      ok: false,
      error: "No tienes un autenticador MFA configurado. Ve a Mi Cuenta -> Configurar MFA para escanear tu código QR.",
    };
  }

  const esValido = validarCodigoTotpSecret(secretBase32, codigo);

  if (!esValido) {
    return {
      ok: false,
      error: "Código TOTP inválido. Asegúrate de ingresar el código generado por la aplicación autenticadora (Google Authenticator) vinculada a esta cuenta.",
    };
  }

  // Si el código coincidió con un secret pendiente (re-registro reciente), promover a activo automáticamente
  if (detalle.mfa_secret_pendiente && validarCodigoTotpSecret(detalle.mfa_secret_pendiente, codigo)) {
    const nuevoDetalle = {
      ...detalle,
      mfa_activo: true,
      mfa_secret: detalle.mfa_secret_pendiente,
      mfa_secret_pendiente: null,
      mfa_activado_en: new Date().toISOString(),
    };
    await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({ usu_detalle_usuario: nuevoDetalle, usu_actualizado_en: new Date().toISOString() })
      .eq("usu_id", user.id);
  }

  return { ok: true, data: undefined };
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

  const esValido = validarCodigoTotpSecret(secretKey, codigo);
  if (!esValido) {
    return {
      ok: false,
      error: "El código de 6 dígitos no coincide con la clave secreta QR escaneada. Verifica que la app tenga la hora sincronizada.",
    };
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
// GESTIÓN DE TÉRMINOS, CLAUSULAS LOPDP, CONTRATOS & VERSIONAMIENTO
// ═══════════════════════════════════════════════════════════════════

export interface ConfigTerminosCategoria {
  categoria: string;
  titulo?: string;
  tipo?: string;
  version: string;
  fechaVigencia: string;
  requiereAceptacionObligatoria: boolean;
  contenidoMarkdown: string;
  actualizadoEn: string;
  notasCambio?: string;
}

export interface HistorialVersionTermino {
  id: string;
  negocio: string;
  clave: string;
  version: string;
  titulo: string;
  fechaVigencia: string;
  requiereAceptacion: boolean;
  contenidoMarkdown: string;
  notasCambio?: string | null;
  creadoPor?: string | null;
  creadoEn: string;
}

export interface RegistroConsentimientoUsuario {
  id: string;
  usuarioId: string;
  usuarioNombre?: string;
  usuarioCorreo?: string;
  negocio: string;
  claveDocumento: string;
  tituloDocumento?: string;
  version: string;
  estado: "ACEPTADO" | "RECHAZADO" | "REVOCADO";
  fechaAccion: string;
  ip?: string | null;
  userAgent?: string | null;
  hashContenido?: string | null;
  metadatos?: Record<string, unknown>;
}

export async function obtenerConfiguracionTerminos(
  negocio: string = "tranqi"
): Promise<Resultado<Record<string, ConfigTerminosCategoria>>> {
  const supabase = await crearClienteServidor();
  const negKey = (negocio || "tranqi").toUpperCase();

  try {
    // 1. Consultar tabla dedicada en base de datos comun_seguridad.seg_termino_documento
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docs, error } = await (supabase.schema("comun_seguridad") as any)
      .from("seg_termino_documento")
      .select("*")
      .or(`ted_negocio.eq.${negKey},ted_negocio.eq.${negocio.toLowerCase()}`)
      .eq("ted_activo", true);

    if (!error && docs && docs.length > 0) {
      const mapa: Record<string, ConfigTerminosCategoria> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const d of docs as any[]) {
        mapa[d.ted_clave] = {
          categoria: d.ted_clave,
          titulo: d.ted_titulo,
          tipo: d.ted_tipo,
          version: d.ted_version_actual,
          fechaVigencia: d.ted_fecha_vigencia,
          requiereAceptacionObligatoria: d.ted_requiere_aceptacion,
          contenidoMarkdown: d.ted_contenido_markdown,
          actualizadoEn: d.ted_actualizado_en,
        };
      }
      return { ok: true, data: mapa };
    }
  } catch (errBdd) {
    console.warn("Tabla seg_termino_documento no disponible, buscando fallback:", errBdd);
  }

  // Fallback 2: Consultar detalle usuario si aún no hay migración
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: usuarioExistente } = await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", user.id)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detalle = (usuarioExistente?.usu_detalle_usuario as Record<string, any>) || {};
    const terminosGuardados = detalle.configuracion_terminos?.[negocio] || detalle.configuracion_terminos?.[negKey] || {};
    return { ok: true, data: terminosGuardados };
  }

  return { ok: true, data: {} };
}

export async function guardarConfiguracionTerminos(datos: {
  negocio: string;
  categoria: string;
  titulo?: string;
  tipo?: string;
  version: string;
  fechaVigencia: string;
  requiereAceptacionObligatoria: boolean;
  contenidoMarkdown: string;
  notasCambio?: string;
}): Promise<Resultado<{ mensaje: string; versionId?: string }>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const negKey = (datos.negocio || "tranqi").toUpperCase();

  try {
    // 1. Upsert en tabla maestra comun_seguridad.seg_termino_documento
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docGuardado, error: errDoc } = await (supabase.schema("comun_seguridad") as any)
      .from("seg_termino_documento")
      .upsert(
        {
          ted_negocio: negKey,
          ted_clave: datos.categoria,
          ted_titulo: datos.titulo || datos.categoria,
          ted_tipo: datos.tipo || "terminos",
          ted_version_actual: datos.version.trim(),
          ted_fecha_vigencia: datos.fechaVigencia || new Date().toISOString().split("T")[0],
          ted_requiere_aceptacion: datos.requiereAceptacionObligatoria,
          ted_contenido_markdown: datos.contenidoMarkdown,
          ted_activo: true,
          ted_actualizado_en: new Date().toISOString(),
        },
        { onConflict: "ted_negocio,ted_clave" }
      )
      .select("ted_id")
      .maybeSingle();

    if (errDoc) {
      console.warn("Error guardando seg_termino_documento:", errDoc);
    }

    // 2. Registrar en historial inmutable de versiones comun_seguridad.seg_termino_historial_version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errHist } = await (supabase.schema("comun_seguridad") as any)
      .from("seg_termino_historial_version")
      .insert({
        thv_documento_id: docGuardado?.ted_id || null,
        thv_negocio: negKey,
        thv_clave: datos.categoria,
        thv_version: datos.version.trim(),
        thv_titulo: datos.titulo || datos.categoria,
        thv_fecha_vigencia: datos.fechaVigencia || new Date().toISOString().split("T")[0],
        thv_requiere_aceptacion: datos.requiereAceptacionObligatoria,
        thv_contenido_markdown: datos.contenidoMarkdown,
        thv_notas_cambio: datos.notasCambio || `Publicación de versión ${datos.version.trim()}`,
        thv_creado_por: user?.id || null,
        thv_creado_en: new Date().toISOString(),
      });

    if (errHist) {
      console.warn("Error insertando seg_termino_historial_version:", errHist);
    }
  } catch (errBdd) {
    console.warn("Error secundario en tablas BDD de términos:", errBdd);
  }

  // Respaldo en detalle_usuario para compatibilidad
  if (user) {
    try {
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
        titulo: datos.titulo,
        tipo: datos.tipo,
        version: datos.version.trim(),
        fechaVigencia: datos.fechaVigencia,
        requiereAceptacionObligatoria: datos.requiereAceptacionObligatoria,
        contenidoMarkdown: datos.contenidoMarkdown,
        actualizadoEn: new Date().toISOString(),
        notasCambio: datos.notasCambio,
      };

      await supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detalleActual,
            configuracion_terminos: {
              ...configActual,
              [datos.negocio]: {
                ...configNegocioActual,
                [datos.categoria]: nuevaCategoriaConfig,
              },
            },
          },
          usu_actualizado_en: new Date().toISOString(),
        })
        .eq("usu_id", user.id);
    } catch { /* Ignorar fallback */ }
  }

  return {
    ok: true,
    data: {
      mensaje: `Versión ${datos.version.trim()} de '${datos.titulo || datos.categoria}' guardada e indexada en el historial.`,
    },
  };
}

export async function obtenerHistorialVersionesTermino(
  negocio: string,
  categoria: string
): Promise<Resultado<HistorialVersionTermino[]>> {
  const supabase = await crearClienteServidor();
  const negKey = (negocio || "tranqi").toUpperCase();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: historial, error } = await (supabase.schema("comun_seguridad") as any)
      .from("seg_termino_historial_version")
      .select("*")
      .or(`thv_negocio.eq.${negKey},thv_negocio.eq.${negocio.toLowerCase()}`)
      .eq("thv_clave", categoria)
      .order("thv_creado_en", { ascending: false });

    if (error) return { ok: false, error: error.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: HistorialVersionTermino[] = (historial || []).map((h: any) => ({
      id: h.thv_id,
      negocio: h.thv_negocio,
      clave: h.thv_clave,
      version: h.thv_version,
      titulo: h.thv_titulo,
      fechaVigencia: h.thv_fecha_vigencia,
      requiereAceptacion: h.thv_requiere_aceptacion,
      contenidoMarkdown: h.thv_contenido_markdown,
      notasCambio: h.thv_notas_cambio,
      creadoPor: h.thv_creado_por,
      creadoEn: h.thv_creado_en,
    }));

    return { ok: true, data: items };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error consultando historial de versiones" };
  }
}

export async function registrarConsentimientoUsuario(datos: {
  negocio: string;
  claveDocumento: string;
  version: string;
  estado?: "ACEPTADO" | "RECHAZADO" | "REVOCADO";
  hashContenido?: string;
  metadatos?: Record<string, unknown>;
}): Promise<Resultado<{ id: string }>> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Usuario no autenticado" };

  const { ip, userAgent } = await obtenerIpYAgente();
  const negKey = (datos.negocio || "tranqi").toUpperCase();
  const estadoFinal = datos.estado || "ACEPTADO";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: nuevo, error } = await (supabase.schema("comun_seguridad") as any)
      .from("seg_usuario_consentimiento")
      .insert({
        usc_usuario_id: user.id,
        usc_negocio: negKey,
        usc_clave_documento: datos.claveDocumento,
        usc_version: datos.version.trim(),
        usc_estado: estadoFinal,
        usc_ip: ip,
        usc_user_agent: userAgent,
        usc_hash_contenido: datos.hashContenido || null,
        usc_metadatos: datos.metadatos || {},
      })
      .select("usc_id")
      .single();

    if (error) return { ok: false, error: error.message };

    // Si es consentimiento de términos globales, actualizar también seg_usuario
    if (datos.claveDocumento === "terminos_globales" || datos.claveDocumento === "terminos") {
      await supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_terminos_aceptados_en: new Date().toISOString(),
          usu_terminos_version: datos.version.trim(),
        })
        .eq("usu_id", user.id);
    }

    return { ok: true, data: { id: nuevo.usc_id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error registrando consentimiento" };
  }
}

export async function obtenerHistorialConsentimientos(
  negocio?: string,
  claveDocumento?: string
): Promise<Resultado<RegistroConsentimientoUsuario[]>> {
  const supabase = await crearClienteServidor();
  const adminClient = crearClienteAdmin() || supabase;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminClient.schema("comun_seguridad") as any)
      .from("seg_usuario_consentimiento")
      .select(`
        usc_id,
        usc_usuario_id,
        usc_negocio,
        usc_clave_documento,
        usc_version,
        usc_estado,
        usc_fecha_accion,
        usc_ip,
        usc_user_agent,
        usc_hash_contenido,
        usc_metadatos,
        seg_usuario (
          usu_nombres,
          usu_apellidos,
          usu_correo
        )
      `)
      .order("usc_fecha_accion", { ascending: false })
      .limit(500);

    if (negocio && negocio !== "todos") {
      query = query.or(`usc_negocio.eq.${negocio.toUpperCase()},usc_negocio.eq.${negocio.toLowerCase()}`);
    }
    if (claveDocumento && claveDocumento !== "todas") {
      query = query.eq("usc_clave_documento", claveDocumento);
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registros: RegistroConsentimientoUsuario[] = (data || []).map((row: any) => {
      const u = row.seg_usuario;
      const nombreComp = u ? `${u.usu_nombres || ""} ${u.usu_apellidos || ""}`.trim() : "Usuario Anónimo";
      return {
        id: row.usc_id,
        usuarioId: row.usc_usuario_id,
        usuarioNombre: nombreComp || "Sin Nombre",
        usuarioCorreo: u?.usu_correo || "Sin Correo",
        negocio: row.usc_negocio,
        claveDocumento: row.usc_clave_documento,
        version: row.usc_version,
        estado: row.usc_estado,
        fechaAccion: row.usc_fecha_accion,
        ip: row.usc_ip,
        userAgent: row.usc_user_agent,
        hashContenido: row.usc_hash_contenido,
        metadatos: row.usc_metadatos,
      };
    });

    return { ok: true, data: registros };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error obteniendo auditoría de consentimientos" };
  }
}




// TRQ-040: tema del panel. Se guarda en el perfil (no solo en el navegador)
// para que la elección siga al usuario en cualquier dispositivo; el panel
// además la deja en localStorage para pintarla antes del primer render.
const TEMAS_PANEL = ["claro", "oscuro", "sistema"] as const;
export async function guardarPreferenciaTema(tema: string): Promise<Resultado> {
  if (!(TEMAS_PANEL as readonly string[]).includes(tema)) return { ok: false, error: "Tema no válido" };
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };
  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({ usu_preferencia_tema: tema })
    .eq("usu_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
