"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { buscarUsuarios, obtenerPerfilesAsignables } from "./consultas";
import { MATRIZ_FUNCIONAL_ROLES } from "./matriz-roles";

export interface Resultado<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  mensaje?: string;
  pendienteAceptacion?: boolean;
}

export async function obtenerNivelMaximoGestor(negocio: string): Promise<number> {
  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .schema("comun_seguridad")
      .rpc("seg_fn_nivel_maximo", { p_negocio: negocio });
    if (typeof data === "number" && data > 0) {
      return data;
    }

    // Fallback: verificar sesión actual y membresía
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 10;

    const correo = (user.email || "").toLowerCase().trim();
    if (correo === "familiammtg@gmail.com" || correo === "jesus251296@gmail.com") {
      return 100;
    }

    const adminClient = crearClienteAdmin() || supabase;
    const { data: uData } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_superadmin_plataforma")
      .eq("usu_id", user.id)
      .maybeSingle();

    if (uData?.usu_superadmin_plataforma) return 100;

    const { data: mems } = await adminClient
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_rol, mem_negocio")
      .eq("mem_usuario_id", user.id);

    const negocioUpper = (negocio || "TRANQ").toUpperCase();
    const mem = (mems || []).find((m) => {
      const dbNeg = (m.mem_negocio || "").toUpperCase();
      return (
        dbNeg === negocioUpper ||
        (negocioUpper.startsWith("TRANQ") && dbNeg.startsWith("TRANQ")) ||
        (negocioUpper.startsWith("FFH") && dbNeg.startsWith("FFH")) ||
        (negocioUpper.startsWith("FASTFIX") && dbNeg.startsWith("FASTFIX")) ||
        (negocioUpper.startsWith("TNK") && dbNeg.startsWith("TNK")) ||
        (negocioUpper.startsWith("TINKAY") && dbNeg.startsWith("TINKAY")) ||
        (negocioUpper.startsWith("MRG") && dbNeg.startsWith("MRG")) ||
        (negocioUpper.startsWith("MARGARITAS") && dbNeg.startsWith("MARGARITAS"))
      );
    });

    const rol = (mem?.mem_rol || "").toUpperCase();
    if (rol === "SUPERADMIN") return 100;
    if (rol === "ADMIN" || rol === "ADMINISTRADOR") return 80;
    if (rol === "ABOGADO" || rol === "TECNICO") return 50;
    if (rol === "OPERADOR" || rol === "AUXILIAR") return 30;
    return 10;
  } catch {
    return 80;
  }
}

export async function obtenerDatosGestionUsuariosAction(consulta: string = "", negocio: string = "TRANQ") {
  try {
    const [{ data: usuarios, error }, perfiles, nivelMaximoGestor] = await Promise.all([
      buscarUsuarios(consulta, negocio),
      obtenerPerfilesAsignables(),
      obtenerNivelMaximoGestor(negocio),
    ]);
    if (error) return { ok: false, error };
    return { ok: true, data: { usuarios, perfiles, nivelMaximoGestor } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al cargar usuarios" };
  }
}

export async function asignarPerfil(usuarioId: string, perfil: string, negocio: string = "TRANQ"): Promise<Resultado> {
  if (!perfil.trim()) return { ok: false, error: "Selecciona un perfil" };

  const nivelGestor = await obtenerNivelMaximoGestor(negocio);
  if (nivelGestor < 30) {
    return { ok: false, error: "No tienes permisos para asignar perfiles." };
  }

  const supabase = await crearClienteServidor();
  const adminClient = (crearClienteAdmin() || supabase) as any;
  const perfilClaveUpper = perfil.toUpperCase().trim();
  const negocioUpper = (negocio || "TRANQ").toUpperCase().trim();

  try {
    const { data: dbPerfil } = await adminClient
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_id, per_nombre, per_nivel, per_activo")
      .eq("per_clave", perfilClaveUpper)
      .maybeSingle();

    if (!dbPerfil?.per_id) {
      return { ok: false, error: `Perfil no encontrado en catálogo: ${perfilClaveUpper}` };
    }

    if (dbPerfil.per_nivel > nivelGestor) {
      return { ok: false, error: `No puedes asignar un perfil de jerarquía superior a la tuya (${dbPerfil.per_nivel} > ${nivelGestor})` };
    }

    // Obtener identidad del operador/administrador que realiza la solicitud
    const authUser = (await supabase.auth.getUser()).data?.user;
    let nombreOperador = authUser?.email || "Administrador de Plataforma";
    let correoOperador = authUser?.email || "admin@tranqi24.com";
    if (authUser?.id) {
      const { data: opRow } = await adminClient
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo")
        .eq("usu_id", authUser.id)
        .maybeSingle();
      if (opRow) {
        nombreOperador = [opRow.usu_nombres, opRow.usu_apellidos].filter(Boolean).join(" ").trim() || opRow.usu_correo || nombreOperador;
        correoOperador = opRow.usu_correo || correoOperador;
      }
    }

    // Obtener datos del usuario objetivo para registrar la propuesta de nuevo rol y notificarle
    const { data: usuTarget } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_detalle_usuario")
      .eq("usu_id", usuarioId)
      .maybeSingle();

    if (!usuTarget?.usu_id) {
      return { ok: false, error: "Usuario no encontrado." };
    }

    const ahoraIso = new Date().toISOString();
    const fechaLegibleEC = new Date(ahoraIso).toLocaleString("es-EC", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Guayaquil",
    });

    const rolNombreLegible = dbPerfil.per_nombre || perfilClaveUpper;
    const propId = `prop-rol-${perfilClaveUpper}-${Date.now()}`;

    const det = (usuTarget.usu_detalle_usuario || {}) as Record<string, any>;
    const propuestasActuales: any[] = Array.isArray(det.propuestas_cambio_rol)
      ? [...det.propuestas_cambio_rol]
      : [];
    const filtradas = propuestasActuales.filter(
      (p) => !(String(p?.rolClave || "").toUpperCase() === perfilClaveUpper && p?.estado === "pendiente_aceptacion")
    );
    filtradas.unshift({
      id: propId,
      rolClave: perfilClaveUpper,
      rolNombre: rolNombreLegible,
      negocio: negocioUpper,
      estado: "pendiente_aceptacion",
      solicitadoPorId: authUser?.id || null,
      solicitadoPorNombre: nombreOperador,
      solicitadoPorCorreo: correoOperador,
      solicitadoEn: ahoraIso,
      respondidoEn: null,
      esConversionAbogado: perfilClaveUpper === "ABOGADO",
    });

    const historialCambios = Array.isArray(det.historial_cambios_rol)
      ? [...det.historial_cambios_rol]
      : [];
    historialCambios.unshift({
      id: `hist-${Date.now()}`,
      fecha: ahoraIso,
      accion: "PROPUESTA_ASIGNACION",
      rol: perfilClaveUpper,
      estadoResultante: "pendiente_aceptacion",
      ejecutadoPorNombre: nombreOperador,
      ejecutadoPorCorreo: correoOperador,
      detalle: `Solicitud de nuevo rol ${rolNombreLegible} (${perfilClaveUpper}) enviada por ${nombreOperador}. Pendiente de confirmación del usuario.`,
    });

    await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({
        usu_detalle_usuario: {
          ...det,
          propuestas_cambio_rol: filtradas.slice(0, 30),
          historial_cambios_rol: historialCambios.slice(0, 60),
        },
        usu_actualizado_en: ahoraIso,
      })
      .eq("usu_id", usuarioId);

    const nombreTarget =
      [usuTarget.usu_nombres, usuTarget.usu_apellidos].filter(Boolean).join(" ").trim() ||
      usuTarget.usu_correo ||
      "Usuario";
    const asunto = `🛡️ Confirmación Requerida: Nuevo Rol (${rolNombreLegible}) Asignado en Tranqi`;
    const htmlNotif = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden; color: #111827;">
        <div style="background: linear-gradient(135deg, #5000BA 0%, #3B0764 100%); padding: 24px 28px; color: #ffffff;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; margin-bottom: 6px;">
            CONFIRMACIÓN DE ROL · TRANQI
          </div>
          <h1 style="margin: 0; font-size: 19px; font-weight: 900; line-height: 1.3;">
            ${asunto}
          </h1>
        </div>
        <div style="padding: 24px 28px;">
          <p style="font-size: 15px; line-height: 1.6; color: #111827; margin-top: 0;">
            Hola <strong>${nombreTarget}</strong>,
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Te informamos que la plataforma está agregando el nuevo rol <strong>${rolNombreLegible} (${perfilClaveUpper})</strong> a tu cuenta en <strong>Tranqi</strong>.
          </p>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; margin: 16px 0; font-size: 13.5px; color: #334155;">
            <strong>👤 Asignado por:</strong> ${nombreOperador} (${correoOperador})<br/>
            <strong>📅 Fecha y hora:</strong> ${fechaLegibleEC}
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            <strong>Importante:</strong> Tu rol no cambiará de inmediato hasta que confirmes tu aceptación. Ingresa a tu panel en Tranqi y en la sección <strong>Notificaciones</strong> pulsa el botón <strong>«Aceptar Rol»</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://www.tranqi24.com/panel" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #05876E; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 24px; border-radius: 12px;">
              Revisar y Confirmar Nuevo Rol →
            </a>
          </div>
        </div>
      </div>
    `;

    // Insertar en comun_notificacion.not_registro
    try {
      await adminClient
        .schema("comun_notificacion")
        .from("not_registro")
        .insert([
          {
            not_usuario_id: usuarioId,
            not_negocio: negocioUpper,
            not_canal: "IN_APP",
            not_titulo: asunto,
            not_contenido_html: htmlNotif,
            not_url_accion: "/panel",
            not_detalles: { clave_original: propId },
            not_creado_en: ahoraIso,
          },
          {
            not_usuario_id: usuarioId,
            not_negocio: negocioUpper,
            not_canal: "PUSH",
            not_titulo: asunto,
            not_contenido_html: htmlNotif,
            not_url_accion: "/panel",
            not_detalles: { clave_original: propId },
            not_creado_en: ahoraIso,
          },
        ]);
    } catch {
      // Continuar
    }

    // Enviar correo electrónico vía Edge Function si está disponible
    if (usuTarget.usu_correo && usuTarget.usu_correo.includes("@") && process.env.CORREO_FUNCION_CLAVE) {
      try {
        await supabase.functions.invoke("enviar-correo", {
          body: {
            negocio: "tranqi",
            para: usuTarget.usu_correo,
            asunto,
            html: htmlNotif,
          },
          headers: { "x-correo-clave": process.env.CORREO_FUNCION_CLAVE },
        });
      } catch {
        // Continuar
      }
    }

    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel");
    return {
      ok: true,
      data: undefined,
      pendienteAceptacion: true,
      mensaje: `Solicitud de nuevo rol (${rolNombreLegible}) enviada a ${usuTarget.usu_correo}. Se activará cuando el usuario confirme su aceptación en sus notificaciones.`,
    };
  } catch (errFallback: any) {
    console.warn("Aviso en asignarPerfil:", errFallback);
    return { ok: false, error: errFallback?.message || "No se pudo procesar la asignación de rol." };
  }
}

export async function quitarPerfil(usuarioId: string, perfil: string, negocio: string = "TRANQ"): Promise<Resultado> {
  const nivelGestor = await obtenerNivelMaximoGestor(negocio);
  if (nivelGestor < 30) {
    return { ok: false, error: "No tienes permisos para revocar perfiles." };
  }

  const supabase = await crearClienteServidor();
  const perfilClaveUpper = perfil.toUpperCase().trim();
  const negocioUpper = (negocio || "TRANQ").toUpperCase().trim();

  if (perfilClaveUpper === "CLIENTE") {
    return { ok: false, error: "CLIENTE es el perfil base y no se puede retirar (PLT-003 regla 2)" };
  }

  const adminClient = (crearClienteAdmin() || supabase) as any;

  // Si se intenta dar de baja el rol ABOGADO, validar que no tenga casos activos ni citas pendientes asignadas
  if (perfilClaveUpper === "ABOGADO") {
    try {
      const { data: abg } = await adminClient
        .schema("tranqui_legal")
        .from("trq_abogado")
        .select("abg_id")
        .eq("abg_usuario_id", usuarioId)
        .maybeSingle();

      if (abg?.abg_id) {
        const [casosTitularRes, casosEquipoRes, citasActivasRes] = await Promise.all([
          adminClient
            .schema("tranqui_legal")
            .from("trq_caso_judicial")
            .select("cas_id")
            .eq("cas_abogado_id", abg.abg_id)
            .is("cas_eliminado_en", null)
            .neq("cas_estado", "cerrado"),
          adminClient
            .schema("tranqui_legal")
            .from("trq_caso_abogado_equipo")
            .select("cae_caso_id")
            .eq("cae_abogado_id", abg.abg_id)
            .eq("cae_activo", true)
            .is("cae_eliminado_en", null),
          adminClient
            .schema("tranqui_legal")
            .from("trq_cita")
            .select("cit_id")
            .eq("cit_abogado_id", abg.abg_id)
            .is("cit_eliminado_en", null)
            .in("cit_estado", ["propuesta", "confirmada", "reagendada"]),
        ]);

        const idsCasos = new Set<string>();
        for (const c of casosTitularRes?.data ?? []) if (c.cas_id) idsCasos.add(c.cas_id);
        for (const ce of casosEquipoRes?.data ?? []) if (ce.cae_caso_id) idsCasos.add(ce.cae_caso_id);
        const totalCasos = idsCasos.size;
        const totalCitas = (citasActivasRes?.data ?? []).length;

        if (totalCasos > 0 || totalCitas > 0) {
          return {
            ok: false,
            error: `No se puede dar de baja el rol ABOGADO porque registra ${totalCasos} caso(s) activo(s) y ${totalCitas} cita(s) pendiente(s). Reasigna o cierra primero sus causas.`,
          };
        }

        await adminClient
          .schema("tranqui_legal")
          .from("trq_abogado")
          .update({
            abg_estado: "suspendido",
            abg_actualizado_en: new Date().toISOString(),
          })
          .eq("abg_id", abg.abg_id);
      }
    } catch {
      // Continuar
    }
  }

  // Registrar baja lógica en historial_cambios_rol y roles_asignados_logicos de seg_usuario
  try {
    const authUser = (await supabase.auth.getUser()).data?.user;
    let nombreOperador = authUser?.email || "Administrador de Plataforma";
    let correoOperador = authUser?.email || "admin@tranqi24.com";
    if (authUser?.id) {
      const { data: opRow } = await adminClient
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo")
        .eq("usu_id", authUser.id)
        .maybeSingle();
      if (opRow) {
        nombreOperador =
          [opRow.usu_nombres, opRow.usu_apellidos].filter(Boolean).join(" ").trim() ||
          opRow.usu_correo ||
          nombreOperador;
        correoOperador = opRow.usu_correo || correoOperador;
      }
    }

    const { data: usuTarget } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", usuarioId)
      .maybeSingle();

    const ahoraIso = new Date().toISOString();
    const det = (usuTarget?.usu_detalle_usuario || {}) as Record<string, any>;
    const historial = Array.isArray(det.historial_cambios_rol)
      ? [...det.historial_cambios_rol]
      : [];
    historial.unshift({
      id: `hist-baja-${Date.now()}`,
      fecha: ahoraIso,
      accion: "BAJA_LOGICA_ROL",
      rol: perfilClaveUpper,
      estadoResultante: "baja_logica",
      ejecutadoPorNombre: nombreOperador,
      ejecutadoPorCorreo: correoOperador,
      detalle: `Baja lógica del rol ${perfilClaveUpper} ejecutada por ${nombreOperador}.`,
    });

    await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({
        usu_detalle_usuario: {
          ...det,
          ...(perfilClaveUpper === "ABOGADO" && det.ficha_abogado
            ? {
                ficha_abogado: {
                  ...det.ficha_abogado,
                  baja_logica: true,
                  dado_de_baja_en: ahoraIso,
                  dado_de_baja_por_nombre: nombreOperador,
                  dado_de_baja_por_correo: correoOperador,
                },
              }
            : {}),
          historial_cambios_rol: historial.slice(0, 60),
        },
        usu_actualizado_en: ahoraIso,
      })
      .eq("usu_id", usuarioId);
  } catch {
    // Continuar
  }

  // 1. Intentar primero con RPC
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_quitar_perfil", { p_usuario_id: usuarioId, p_negocio: negocioUpper, p_perfil: perfilClaveUpper });

  if (!error) {
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  }

  // 2. Fallback resiliente con cliente Admin
  try {
    const adminClient = crearClienteAdmin() || supabase;
    const { data: dbPerfil } = await adminClient
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_id, per_nivel")
      .eq("per_clave", perfilClaveUpper)
      .maybeSingle();

    if (dbPerfil?.per_nivel && dbPerfil.per_nivel > nivelGestor) {
      return { ok: false, error: "No puedes revocar un perfil de jerarquía superior a la tuya" };
    }

    const { data: mems } = await adminClient
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_negocio")
      .eq("mem_usuario_id", usuarioId);

    const memExistente = (mems || []).find((m) => {
      const dbNeg = (m.mem_negocio || "").toUpperCase();
      return (
        dbNeg === negocioUpper ||
        (negocioUpper.startsWith("TRANQ") && dbNeg.startsWith("TRANQ")) ||
        (negocioUpper.startsWith("FFH") && dbNeg.startsWith("FFH")) ||
        (negocioUpper.startsWith("FASTFIX") && dbNeg.startsWith("FASTFIX")) ||
        (negocioUpper.startsWith("TNK") && dbNeg.startsWith("TNK")) ||
        (negocioUpper.startsWith("TINKAY") && dbNeg.startsWith("TINKAY")) ||
        (negocioUpper.startsWith("MRG") && dbNeg.startsWith("MRG")) ||
        (negocioUpper.startsWith("MARGARITAS") && dbNeg.startsWith("MARGARITAS"))
      );
    });

    if (dbPerfil?.per_id && memExistente?.mem_id) {
      const { error: errDel } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .delete()
        .eq("mpe_membresia_id", memExistente.mem_id)
        .eq("mpe_perfil_id", dbPerfil.per_id);

      if (errDel) {
        return { ok: false, error: errDel.message };
      }

      // Sincronizar nuevo mem_rol remanente
      const { data: mpList } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .select("seg_perfil(per_clave, per_nivel)")
        .eq("mpe_membresia_id", memExistente.mem_id);

      const perfilesOrdenados = ((mpList || []) as any[])
        .map((x) => x.seg_perfil)
        .filter(Boolean)
        .sort((a, b) => b.per_nivel - a.per_nivel);

      const rolRemanente = perfilesOrdenados[0]?.per_clave || "CLIENTE";

      await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({
          mem_rol: rolRemanente,
          mem_actualizado_en: new Date().toISOString()
        })
        .eq("mem_id", memExistente.mem_id);

      revalidatePath("/panel/usuarios");
      revalidatePath("/panel/administrar");
      revalidatePath("/panel");
      return { ok: true, data: undefined };
    }
  } catch (errFallback: any) {
    console.warn("Aviso en fallback quitarPerfil:", errFallback);
    return { ok: false, error: errFallback?.message || error.message };
  }

  return { ok: false, error: error.message };
}

export interface GuardarPerfilInput {
  clave: string;
  nombre: string;
  nivel: number;
  ambito: string;
  descripcion: string;
  activo: boolean;
}

export async function guardarPerfil(input: GuardarPerfilInput): Promise<Resultado> {
  if (!input.clave.trim() || !input.nombre.trim()) {
    return { ok: false, error: "La clave y el nombre del perfil son obligatorios" };
  }

  const supabase = await crearClienteServidor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    per_clave: input.clave.toUpperCase().trim(),
    per_nombre: input.nombre.trim(),
    per_nivel: input.nivel,
    per_ambito: input.ambito,
    per_descripcion: input.descripcion.trim(),
    per_activo: input.activo
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_perfil")
    .upsert(payload, { onConflict: "per_clave" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}

export interface GuardarWidgetInput {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  ruta: string;
  negocio: string;
}

export async function guardarWidget(input: GuardarWidgetInput): Promise<Resultado> {
  if (!input.clave.trim() || !input.nombre.trim()) {
    return { ok: false, error: "La clave y el nombre del widget son obligatorios" };
  }

  const supabase = await crearClienteServidor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    wdg_clave: input.clave.toLowerCase().trim(),
    wdg_nombre: input.nombre.trim(),
    wdg_descripcion: input.descripcion.trim(),
    wdg_categoria: input.categoria.trim(),
    wdg_ruta: input.ruta.trim(),
    wdg_negocio: input.negocio,
    wdg_activo: true
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_widget")
    .upsert(payload, { onConflict: "wdg_clave" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel");
  return { ok: true, data: undefined };
}

export async function guardarAsignacionWidget(
  perfilClave: string,
  widgetClave: string,
  negocio: string,
  asignar: boolean,
  panelId?: string
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const negocioNorm = (negocio || "tranqi").toLowerCase().trim();

  // Resolver el UUID del widget si se pasó la clave textual
  let widgetUuid = widgetClave;
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(widgetClave);
  if (!esUuid) {
    const { data: wRow } = await supabase
      .schema("comun_seguridad")
      .from("seg_widget")
      .select("wdg_id")
      .eq("wdg_clave", widgetClave.toLowerCase().trim())
      .eq("wdg_negocio", negocioNorm)
      .maybeSingle();

    if (wRow?.wdg_id) {
      widgetUuid = wRow.wdg_id;
    }
  }

  if (asignar) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      rlw_rol: perfilClave.toUpperCase().trim(),
      rlw_widget_id: widgetUuid,
      rlw_negocio: negocioNorm,
      rlw_visible: true
    };

    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .upsert(payload, { onConflict: "rlw_negocio, rlw_rol, rlw_widget_id" });

    if (error) return { ok: false, error: error.message };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .delete()
      .eq("rlw_rol", perfilClave.toUpperCase().trim())
      .eq("rlw_widget_id", widgetUuid)
      .eq("rlw_negocio", negocioNorm);

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/administrar");
  revalidatePath("/panel");
  return { ok: true, data: undefined };
}

export async function guardarConfiguracionPanelesPerfilAction(
  perfilClave: string,
  negocio: string,
  panelesAsignados: string[],
  widgetsAsignadosPorPanel: Record<string, string[]>,
  titulosWidgetsPorPanel?: Record<string, string>
): Promise<Resultado> {
  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;
    const perfilClaveUpper = (perfilClave || "").toUpperCase().trim();
    const negocioNorm = (negocio || "tranqi").toLowerCase().trim();

    if (!perfilClaveUpper) return { ok: false, error: "Clave de perfil no válida" };

    // 1. Obtener registro actual del perfil en seg_perfil
    const { data: perfilRow } = await (adminSupabase
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_detalle_perfil")
      .eq("per_clave", perfilClaveUpper) as any)
      .maybeSingle();

    const detalleActual = (perfilRow?.per_detalle_perfil as Record<string, any>) || {};
    const negociosMap = detalleActual.negocios || {};
    const negocioConfigActual = negociosMap[negocioNorm] || {};

    const titulosMerged = {
      ...(detalleActual.titulosWidgetsPorPanel || {}),
      ...(negocioConfigActual.titulosWidgetsPorPanel || {}),
      ...(titulosWidgetsPorPanel || {})
    };

    negociosMap[negocioNorm] = {
      ...negocioConfigActual,
      panelesAsignados,
      widgetsAsignadosPorPanel,
      titulosWidgetsPorPanel: titulosMerged,
      actualizadoEn: new Date().toISOString()
    };

    const nuevoDetalle = {
      ...detalleActual,
      negocios: negociosMap,
      // Guardar también a nivel raíz para consistencia y fallback
      panelesAsignados,
      widgetsAsignadosPorPanel,
      titulosWidgetsPorPanel: titulosMerged,
      actualizadoEn: new Date().toISOString()
    };

    const { error: updErr } = await (adminSupabase
      .schema("comun_seguridad")
      .from("seg_perfil") as any)
      .update({
        per_detalle_perfil: nuevoDetalle,
        per_actualizado_en: new Date().toISOString()
      })
      .eq("per_clave", perfilClaveUpper);

    if (updErr) {
      console.error("Error guardando configuracion en seg_perfil:", updErr);
      return { ok: false, error: updErr.message };
    }

    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel");

    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error inesperado en guardarConfiguracionPanelesPerfilAction:", err);
    return { ok: false, error: err.message };
  }
}

export async function obtenerConfiguracionNavegacionRolAction(
  perfilClave: string,
  negocio: string
): Promise<Resultado<{ widgetsPorPanel: Record<string, string[]>; panelesAsignados: string[]; titulosWidgetsPorPanel?: Record<string, string> }>> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;
  const negocioNorm = (negocio || "tranqi").toLowerCase().trim();
  const negocioUpper = (negocio || "TRANQ").toUpperCase().trim();
  const variantesNegocio = Array.from(new Set([negocioNorm, negocioUpper, "TRANQ", "tranqi"]));
  const rolUpper = (perfilClave || "CLIENTE").toUpperCase().trim();

  let widgetsPorPanel: Record<string, string[]> = {};
  let panelesAsignados: string[] = [];
  let titulosWidgetsPorPanel: Record<string, string> = {};
  const matrizRol = MATRIZ_FUNCIONAL_ROLES[rolUpper] || MATRIZ_FUNCIONAL_ROLES["CLIENTE"] || { paneles: [], widgetsPorPanel: {} };

  // 1. Inicializar siempre desde MATRIZ_FUNCIONAL_ROLES (preconfiguración canónica obligatoria)
  for (const [panelId, widgets] of Object.entries(matrizRol.widgetsPorPanel)) {
    widgetsPorPanel[panelId] = [...widgets];
  }
  panelesAsignados = [...(matrizRol.paneles || ["panel_inicio", "panel_cuenta"])];

  // 2. Fusionar con cualquier personalización adicional en seg_perfil.per_detalle_perfil sin perder widgets canónicos nuevos
  try {
    const { data: perfilRow } = await (adminSupabase
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_detalle_perfil")
      .eq("per_clave", rolUpper) as any)
      .maybeSingle();

    if (perfilRow?.per_detalle_perfil) {
      const detalle = perfilRow.per_detalle_perfil as Record<string, any>;
      const negocioConfig = detalle.negocios?.[negocioNorm] || detalle.negocios?.[negocioUpper];
      const bddWidgetsPorPanel = negocioConfig?.widgetsPorPanel || detalle.widgetsPorPanel;
      const bddPaneles = negocioConfig?.panelesAsignados || detalle.panelesAsignados;

      if (bddWidgetsPorPanel && typeof bddWidgetsPorPanel === "object") {
        for (const [pId, wList] of Object.entries(bddWidgetsPorPanel)) {
          if (Array.isArray(wList)) {
            if (rolUpper === "ABOGADO" && !["panel_inicio", "panel_agendamiento", "panel_herramientas", "panel_cuenta"].includes(pId)) {
              continue;
            }
            if (rolUpper === "CLIENTE" && !["panel_inicio", "panel_agendamiento", "panel_herramientas", "panel_cuenta", "panel_configuracion"].includes(pId)) {
              continue;
            }
            const canonicos = widgetsPorPanel[pId] || [];
            const filtrados =
              rolUpper === "ABOGADO" || rolUpper === "CLIENTE"
                ? wList.map(String).filter((w) => !["disponibilidad_abogados", "asignaciones_agenda", "gestion_red_abogados", "crm_clientes", "agentes_ia", "socios", "solicitud_socio"].includes(w))
                : wList.map(String);
            widgetsPorPanel[pId] = Array.from(new Set([...canonicos, ...filtrados]));
          }
        }
      }
      if (Array.isArray(bddPaneles)) {
        const panelesFiltrados =
          rolUpper === "ABOGADO"
            ? bddPaneles.map(String).filter((p) => ["panel_inicio", "panel_agendamiento", "panel_herramientas", "panel_cuenta"].includes(p))
            : rolUpper === "CLIENTE"
              ? bddPaneles.map(String).filter((p) => ["panel_inicio", "panel_agendamiento", "panel_herramientas", "panel_cuenta", "panel_configuracion"].includes(p))
              : bddPaneles.map(String);
        panelesAsignados = Array.from(new Set([...panelesAsignados, ...panelesFiltrados]));
      }
      titulosWidgetsPorPanel = negocioConfig?.titulosWidgetsPorPanel || detalle.titulosWidgetsPorPanel || {};
    }
  } catch (e) {
    console.error("Error leyendo per_detalle_perfil:", e);
  }

  const panelesSet = new Set<string>(panelesAsignados);

  // 3. Consultar en base de datos los permisos específicos de seg_rol_widget
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .schema("comun_seguridad")
    .from("seg_rol_widget")
    .select("rlw_widget_id, rlw_visible, seg_widget(wdg_clave, wdg_detalle_widget)") as any)
    .eq("rlw_rol", rolUpper)
    .in("rlw_negocio", variantesNegocio);

  if (!error && data && Array.isArray(data) && data.length > 0) {
    const widgetsDesactivados = new Set<string>();

    for (const r of data as any[]) {
      const widgetClave = r.seg_widget?.wdg_clave || r.rlw_widget_id;
      if (widgetClave) {
        if (r.rlw_visible === false) {
          widgetsDesactivados.add(widgetClave);
        }
      }
    }

    // Filtrar widgets desactivados explícitamente en base de datos
    if (widgetsDesactivados.size > 0) {
      for (const panelId of Object.keys(widgetsPorPanel)) {
        widgetsPorPanel[panelId] = (widgetsPorPanel[panelId] || []).filter((w) => !widgetsDesactivados.has(w));
      }
    }
  }

  return {
    ok: true,
    data: {
      widgetsPorPanel,
      panelesAsignados: Array.from(panelesSet),
      titulosWidgetsPorPanel
    }
  };
}

export async function obtenerDirectorioUsuariosPublicoAction(
  negocio: string
): Promise<Resultado<any[]>> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  // 1. Intentar RPC Security Definer o consulta a seg_usuario
  let uData: any[] | null = null;
  let uErr: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (supabase as any)
    .schema("comun_seguridad")
    .rpc("seg_fn_listar_usuarios_directorio");

  if (!rpcErr && rpcData && rpcData.length > 0) {
    uData = rpcData;
  } else {
    // Fallback 1: Consulta directa con adminSupabase leyendo estado y atributos
    const resAdmin = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_creado_en, usu_superadmin_plataforma, usu_detalle_usuario")
      .order("usu_creado_en", { ascending: false });

    uData = resAdmin.data;
    uErr = resAdmin.error;

    if (!uData || uData.length === 0) {
      // Fallback 2: Consulta con cliente de servidor
      const resServ = await supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_creado_en, usu_superadmin_plataforma, usu_detalle_usuario")
        .order("usu_creado_en", { ascending: false });
      uData = resServ.data;
      uErr = resServ.error;
    }
  }

  if (uErr) return { ok: false, error: uErr.message };
  if (!uData || uData.length === 0) return { ok: true, data: [] };

  // 2. Obtener todas las membresías relacionales
  const { data: memData } = await adminSupabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("mem_usuario_id, mem_negocio, mem_rol, mem_estado, mem_creado_en");

  // Mapa de membresías por usuario_id
  const memMap = new Map<string, any[]>();
  (memData || []).forEach(m => {
    const list = memMap.get(m.mem_usuario_id) || [];
    list.push(m);
    memMap.set(m.mem_usuario_id, list);
  });

  const negocioUpper = (negocio || "").toUpperCase();

  // 3. Mapear cada usuario de seg_usuario garantizando visualización de todos los estados (incluso ELIMINADO)
  const listaCompleta = uData.map(u => {
    const membresiasUsuario = memMap.get(u.usu_id) || [];
    const memNegocio = membresiasUsuario.find(m =>
      (m.mem_negocio || "").toUpperCase() === negocioUpper ||
      (negocioUpper === "TRANQI" && (m.mem_negocio || "").toUpperCase() === "TRANQ") ||
      (negocioUpper === "TRANQ" && (m.mem_negocio || "").toUpperCase() === "TRANQI")
    ) || membresiasUsuario[0];

    let rolFinal = memNegocio?.mem_rol || "CLIENTE";
    if (u.usu_superadmin_plataforma) {
      rolFinal = "SUPERADMIN";
    }

    const estadoDetalle = (u.usu_detalle_usuario as any)?.estado;
    const estadoFinal = estadoDetalle || memNegocio?.mem_estado || "ACTIVO";

    return {
      usuario_id: u.usu_id,
      nombres: u.usu_nombres || "Usuario",
      apellidos: u.usu_apellidos || "",
      correo: u.usu_correo || "",
      whatsapp: u.usu_whatsapp || "",
      rol: rolFinal,
      estado: estadoFinal,
      creado_en: memNegocio?.mem_creado_en || u.usu_creado_en
    };
  });

  return { ok: true, data: listaCompleta };
}

export async function eliminarUsuarioSuperAdminAction(
  targetUsuarioId: string
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  try {
    // 1. Borrar en Supabase Auth mediante GoTrue Admin API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((adminSupabase as any).auth?.admin?.deleteUser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any).auth.admin.deleteUser(targetUsuarioId);
    }

    // 2. Ejecutar RPC de borrado fisico con cascada FK en Postgres
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any)
      .schema("comun_seguridad")
      .rpc("seg_fn_superadmin_eliminar_usuario", { p_target_usuario_id: targetUsuarioId });

    if (rpcErr) {
      console.error("Error RPC seg_fn_superadmin_eliminar_usuario:", rpcErr);
      return { ok: false, error: `Error en Base de Datos Supabase: ${rpcErr.message}` };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al eliminar usuario" };
  }

  revalidatePath("/panel/administrar");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return { ok: true };
}

export async function resetearSistemaSuperAdminAction(
  negocio: string = "TRANQ"
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida o usuario no autenticado." };

  const correo = user.email?.toLowerCase().trim() || "";
  const esSuperAdminEmail = correo === "familiammtg@gmail.com" || correo === "jesus251296@gmail.com";

  const { data: uData } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_superadmin_plataforma")
    .eq("usu_id", user.id)
    .maybeSingle();

  const esSuperAdminPlataforma = Boolean(uData?.usu_superadmin_plataforma);

  const { data: perfilesData } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_perfiles", { p_negocio: negocio });

  const perfiles = (perfilesData as string[] | null) ?? [];
  const esSuperAdmin = esSuperAdminEmail || esSuperAdminPlataforma || perfiles.includes("SUPERADMIN");

  if (!esSuperAdmin) {
    return { ok: false, error: "Acceso denegado: El reset del sistema está reservado exclusivamente para el rol SuperAdmin." };
  }

  try {
    // Ejecutar RPC en Postgres con aislamiento estricto por Negocio (preserva los demas negocios y sus usuarios)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any)
      .schema("comun_seguridad")
      .rpc("seg_fn_superadmin_resetear_sistema", { p_negocio: negocio });

    if (rpcErr) {
      console.error("Error RPC seg_fn_superadmin_resetear_sistema:", rpcErr);
      return { ok: false, error: `Error en Base de Datos Supabase: ${rpcErr.message}` };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al resetear el sistema" };
  }

  revalidatePath("/panel/administrar");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return { ok: true };
}

export async function reactivarUsuarioSuperAdminAction(
  targetUsuarioId: string
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any)
      .schema("comun_seguridad")
      .rpc("seg_fn_superadmin_reactivar_usuario", { p_target_usuario_id: targetUsuarioId });

    if (rpcErr) {
      await adminSupabase.schema("comun_seguridad").from("seg_membresia").update({ mem_estado: "ACTIVO" }).eq("mem_usuario_id", targetUsuarioId);
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al reactivar usuario" };
  }

  revalidatePath("/panel/administrar");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return { ok: true };
}
