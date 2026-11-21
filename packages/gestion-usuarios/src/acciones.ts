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
    const negNorm = (negocio || "TRANQ").trim().toLowerCase();
    const esTinkay = negNorm === "tinkay" || negNorm === "tnk";

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 10;

    const correo = (user.email || "").toLowerCase().trim();
    if (esTinkay) {
      if (correo === "tinkay.uio@gmail.com" || correo === "kleber.toapanta.ch@gmail.com") {
        return 100;
      }
    } else if (
      correo === "kleber.toapanta.ch@gmail.com" ||
      correo === "familiammtg@gmail.com" ||
      correo === "jesus251296@gmail.com"
    ) {
      return 100;
    }

    const adminClient = crearClienteAdmin() || supabase;
    const { data: uData } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_superadmin_plataforma, usu_detalle_usuario")
      .eq("usu_id", user.id)
      .maybeSingle();

    if (!esTinkay && uData?.usu_superadmin_plataforma) return 100;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tieneRolExplicitoTinkay = Boolean((uData as any)?.usu_detalle_usuario?.roles_explicitos_tinkay);
    const rol = (mem?.mem_rol || "").toUpperCase();
    if (esTinkay && !tieneRolExplicitoTinkay && (rol === "SUPERADMIN" || rol === "ADMINISTRADOR" || rol === "ADMIN")) {
      return 10;
    }

    if (rol === "SUPERADMIN") return 100;
    if (rol === "ADMIN" || rol === "ADMINISTRADOR") return 80;
    if (rol === "ABOGADO" || rol === "TECNICO") return 50;
    if (rol === "OPERADOR" || rol === "AUXILIAR") return 30;
    if (rol === "VENTAS" || rol === "VENDEDOR") return 20;
    if (rol === "TALLER" || rol === "FLORISTA") return 18;
    if (rol === "DELIVERY" || rol === "REPARTIDOR") return 15;
    if (rol === "DELIVERY_EXTERNO" || rol === "SUBCONTRATADO") return 12;
    return 10;
  } catch {
    return 10;
  }
}

export async function obtenerDatosGestionUsuariosAction(consulta: string = "", negocio: string = "TRANQ") {
  try {
    const [{ data: usuarios, error }, perfiles, nivelMaximoGestor] = await Promise.all([
      buscarUsuarios(consulta, negocio),
      obtenerPerfilesAsignables(negocio),
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
  const esTinkay = negocioUpper === "TINKAY" || negocioUpper === "TNK";

  try {
    if (perfilClaveUpper === "DELIVERY" || perfilClaveUpper === "VENTAS") {
      try {
        await adminClient
          .schema("comun_seguridad")
          .from("seg_perfil")
          .upsert(
            [
              {
                per_clave: "DELIVERY",
                per_nombre: "Delivery / Repartidor",
                per_nivel: 15,
                per_activo: true,
                per_asignable: true,
              },
              {
                per_clave: "VENTAS",
                per_nombre: "Ventas / Asesor Comercial",
                per_nivel: 20,
                per_activo: true,
                per_asignable: true,
              },
            ],
            { onConflict: "per_clave" }
          );
      } catch {
        // Continuar
      }
    }

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
    let nombreOperador = authUser?.email || (esTinkay ? "Administrador Tinkay" : "Administrador de Plataforma");
    let correoOperador = authUser?.email || (esTinkay ? "tinkay.uio@gmail.com" : "admin@tranqi24.com");
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

    // Obtener datos del usuario objetivo
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

    // En Tinkay Floristería (Ventas / Taller / Operador / Delivery / Administrador), aplicar rol vía RPC transaccional SECURITY DEFINER
    if (esTinkay) {
      const { data: rpcAsignacion, error: rpcAsigErr } = await (supabase
        .schema("comun_seguridad") as any)
        .rpc("seg_fn_asignar_perfil_negocio", {
          p_usuario_id: usuarioId,
          p_negocio: "tinkay",
          p_perfil: perfilClaveUpper,
        });

      if (!rpcAsigErr && rpcAsignacion) {
        if (!rpcAsignacion.ok) {
          return { ok: false, error: rpcAsignacion.error || "No se pudo asignar el rol en la base de datos." };
        }
      } else {
        const { data: memsExistentes } = await adminClient
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_id, mem_negocio, mem_rol")
          .eq("mem_usuario_id", usuarioId)
          .in("mem_negocio", ["tinkay", "TINKAY", "tnk", "TNK"]);

        let memId = memsExistentes?.[0]?.mem_id;
        if (!memId) {
          const { data: nuevaMem, error: errInsMem } = await adminClient
            .schema("comun_seguridad")
            .from("seg_membresia")
            .insert({
              mem_usuario_id: usuarioId,
              mem_negocio: "tinkay",
              mem_rol: perfilClaveUpper,
              mem_estado: "ACTIVO",
            })
            .select("mem_id")
            .single();
          if (errInsMem || !nuevaMem?.mem_id) {
            return {
              ok: false,
              error: errInsMem?.message || "No se pudo guardar la membresía en PostgreSQL (verifica la migración SQL de roles).",
            };
          }
          memId = nuevaMem.mem_id;
        } else {
          const { data: updMem, error: errUpdMem } = await adminClient
            .schema("comun_seguridad")
            .from("seg_membresia")
            .update({
              mem_rol: perfilClaveUpper,
              mem_estado: "ACTIVO",
              mem_actualizado_en: ahoraIso,
            })
            .eq("mem_id", memId)
            .select("mem_id");
          if (errUpdMem || !updMem || updMem.length === 0) {
            return {
              ok: false,
              error: errUpdMem?.message || "Permiso RLS insuficiente para actualizar el rol. Ejecuta la migración SQL pendiente en Supabase.",
            };
          }
        }

        if (memId && dbPerfil.per_id) {
          await adminClient
            .schema("comun_seguridad")
            .from("seg_membresia_perfil")
            .upsert(
              {
                mpe_membresia_id: memId,
                mpe_perfil_id: dbPerfil.per_id,
              },
              { onConflict: "mpe_membresia_id,mpe_perfil_id" }
            );
        }

        const detTinkay = (usuTarget.usu_detalle_usuario || {}) as Record<string, any>;
        await adminClient
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({
            usu_detalle_usuario: {
              ...detTinkay,
              roles_explicitos_tinkay: true,
            },
            usu_actualizado_en: ahoraIso,
          })
          .eq("usu_id", usuarioId);
      }

      // Notificar por correo electrónico de Tinkay
      if (usuTarget.usu_correo && usuTarget.usu_correo.includes("@")) {
        try {
          const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
          const nombreTargetTinkay =
            [usuTarget.usu_nombres, usuTarget.usu_apellidos].filter(Boolean).join(" ").trim() ||
            usuTarget.usu_correo;
          await enviarCorreo({
            negocio: "tinkay",
            para: usuTarget.usu_correo,
            asunto: `🌸 Rol asignado en Tinkay Floristería: ${rolNombreLegible}`,
            html: `
              <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #E5DFD5; border-radius: 16px; overflow: hidden; color: #1C261F;">
                <div style="background: #1C261F; padding: 24px 28px; color: #F5F2EB;">
                  <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #C27D5F; margin-bottom: 6px;">
                    TINKAY FLORISTERÍA · ACCESO AL PORTAL
                  </div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700;">
                    Nuevo rol habilitado: ${rolNombreLegible}
                  </h1>
                </div>
                <div style="padding: 24px 28px;">
                  <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
                    Hola <strong>${nombreTargetTinkay}</strong>,
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #4A544C;">
                    El administrador de <strong>Tinkay Floristería</strong> (${nombreOperador}) ha habilitado el rol <strong>${rolNombreLegible} (${perfilClaveUpper})</strong> en tu cuenta.
                  </p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="https://tinkay-web.vercel.app/panel" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #2D3D30; color: #F5F2EB; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px;">
                      Ingresar al Portal Tinkay →
                    </a>
                  </div>
                </div>
              </div>
            `,
          });
        } catch {
          // Continuar
        }
      }

      revalidatePath("/panel/usuarios");
      revalidatePath("/panel");
      return {
        ok: true,
        data: undefined,
        mensaje: `Rol ${rolNombreLegible} asignado a ${usuTarget.usu_correo} y notificado por correo.`,
      };
    }
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

  // 1. Intentar primero con RPC de negocio (sincroniza mem_rol + seg_membresia_perfil)
  const { data: rpcQuitarNeg, error: errQuitarNeg } = await (supabase
    .schema("comun_seguridad") as any)
    .rpc("seg_fn_quitar_perfil_negocio", {
      p_usuario_id: usuarioId,
      p_negocio: negocioUpper.toLowerCase(),
      p_perfil: perfilClaveUpper,
    });

  if (!errQuitarNeg && rpcQuitarNeg) {
    if (!rpcQuitarNeg.ok) {
      return { ok: false, error: rpcQuitarNeg.error || "No se pudo retirar el perfil." };
    }
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  }

  // 1b. Fallback a RPC clásico seg_fn_quitar_perfil
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

    if (memExistente?.mem_id) {
      if (dbPerfil?.per_id) {
        await adminClient
          .schema("comun_seguridad")
          .from("seg_membresia_perfil")
          .delete()
          .eq("mpe_membresia_id", memExistente.mem_id)
          .eq("mpe_perfil_id", dbPerfil.per_id);
      }

      // Sincronizar nuevo mem_rol remanente
      const { data: mpList } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .select("seg_perfil(per_clave, per_nivel)")
        .eq("mpe_membresia_id", memExistente.mem_id);

      const perfilesOrdenados = ((mpList || []) as any[])
        .map((x) => x.seg_perfil)
        .filter((p) => p && String(p.per_clave || "").toUpperCase() !== perfilClaveUpper)
        .sort((a, b) => b.per_nivel - a.per_nivel);

      const rolRemanente = perfilesOrdenados[0]?.per_clave || "CLIENTE";

      await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({
          mem_rol: rolRemanente,
          mem_actualizado_en: new Date().toISOString(),
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

function obtenerClavesNegocioCompatibles(negocio: string): string[] {
  const nLower = (negocio || "tranqi").toLowerCase().trim();
  const nUpper = (negocio || "TRANQ").toUpperCase().trim();
  if (nLower.startsWith("tranq") || nLower === "legal") {
    return Array.from(new Set([nLower, nUpper, "tranqi", "tranq", "TRANQ", "TRANQI"]));
  }
  return Array.from(new Set([nLower, nUpper]));
}

function resolverClaveCfgNegocio(negocio: string): string {
  const n = (negocio || "tranqi").toLowerCase().trim();
  if (n.startsWith("tranq") || n === "legal") return "tranqi";
  if (n === "ffh" || n.startsWith("fastfix")) return "fastfix";
  if (n === "tnk" || n.startsWith("tinkay")) return "tinkay";
  if (n === "mrg" || n.startsWith("margarita")) return "margaritas";
  return n;
}

export async function guardarAsignacionWidget(
  perfilClave: string,
  widgetClave: string,
  negocio: string,
  asignar: boolean,
  panelId?: string
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const adminSupabase = (crearClienteAdmin() || supabase) as any;
  const negocioNorm = (negocio || "tranqi").toLowerCase().trim().startsWith("tranq")
    ? "tranqi"
    : (negocio || "tranqi").toLowerCase().trim();

  // Resolver el UUID del widget si se pasó la clave textual
  let widgetUuid = widgetClave;
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(widgetClave);
  if (!esUuid) {
    const { data: wRow } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_widget")
      .select("wdg_id")
      .eq("wdg_clave", widgetClave.toLowerCase().trim())
      .in("wdg_negocio", obtenerClavesNegocioCompatibles(negocio))
      .limit(1)
      .maybeSingle();

    if (wRow?.wdg_id) {
      widgetUuid = wRow.wdg_id;
    } else {
      // Si el widget aún no existe en seg_widget, el estado por panel ya queda persistido en seg_perfil.per_detalle_perfil
      revalidatePath("/panel/configuracion");
      revalidatePath("/panel/administrar");
      revalidatePath("/panel");
      return { ok: true, data: undefined };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    rlw_rol: perfilClave.toUpperCase().trim(),
    rlw_widget_id: widgetUuid,
    rlw_negocio: negocioNorm,
    rlw_visible: Boolean(asignar),
    ...(panelId ? { rlw_panel_id: panelId } : {})
  };

  if (asignar) {
    const { error } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .upsert(
        {
          rlw_rol: payload.rlw_rol,
          rlw_widget_id: payload.rlw_widget_id,
          rlw_negocio: payload.rlw_negocio,
          rlw_visible: true
        },
        { onConflict: "rlw_negocio, rlw_rol, rlw_widget_id" }
      );

    if (error) return { ok: false, error: error.message };
  } else {
    // Marcar rlw_visible = false o actualizar para que no se pierda el rastro de desasignación
    const { error } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .upsert(
        {
          rlw_rol: payload.rlw_rol,
          rlw_widget_id: payload.rlw_widget_id,
          rlw_negocio: payload.rlw_negocio,
          rlw_visible: false
        },
        { onConflict: "rlw_negocio, rlw_rol, rlw_widget_id" }
      );

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
  titulosWidgetsPorPanel?: Record<string, string>,
  widgetsRetiradosPorPanel?: Record<string, string[]>
): Promise<Resultado> {
  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;
    const perfilClaveUpper = (perfilClave || "").toUpperCase().trim();
    const clavesNegocio = obtenerClavesNegocioCompatibles(negocio);
    const negocioNorm = clavesNegocio[0] || "tranqi";
    const cfgNegocioKey = resolverClaveCfgNegocio(negocio);

    if (!perfilClaveUpper) return { ok: false, error: "Clave de perfil no válida" };

    const ahoraIso = new Date().toISOString();

    // 1. PERSISTENCIA PRIMARIA EN comun_configuracion.cfg_negocio (GRANT SELECT anon/authenticated + GRANT UPDATE authenticated con RLS seg_fn_es_admin_negocio)
    let guardadoEnCfg = false;
    let errorCfg: string | null = null;

    try {
      const { data: cfgActual } = await (supabase
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .select("cfg_id, cfg_detalle_configuracion")
        .eq("cfg_negocio", cfgNegocioKey) as any)
        .maybeSingle();

      const detalleCfgPrevio = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
      const perfilesNavPrevios = (detalleCfgPrevio.perfiles_navegacion as Record<string, any>) || {};
      const perfilCfgPrevio = (perfilesNavPrevios[perfilClaveUpper] as Record<string, any>) || {};

      const titulosMergedCfg = {
        ...(perfilCfgPrevio.titulosWidgetsPorPanel || {}),
        ...(titulosWidgetsPorPanel || {})
      };

      const retiradosMergedCfg: Record<string, string[]> = {
        ...(perfilCfgPrevio.widgetsRetiradosPorPanel || {}),
        ...(widgetsRetiradosPorPanel || {})
      };

      for (const [pId, wActivos] of Object.entries(widgetsAsignadosPorPanel || {})) {
        if (Array.isArray(wActivos) && Array.isArray(retiradosMergedCfg[pId])) {
          const setActivos = new Set(wActivos);
          retiradosMergedCfg[pId] = retiradosMergedCfg[pId].filter(w => !setActivos.has(w));
        }
      }

      const snapshotPerfilCfg = {
        clave: perfilClaveUpper,
        configuradoExplicitamente: true,
        panelesAsignados,
        widgetsAsignadosPorPanel,
        widgetsPorPanel: widgetsAsignadosPorPanel,
        widgetsRetiradosPorPanel: retiradosMergedCfg,
        titulosWidgetsPorPanel: titulosMergedCfg,
        actualizadoEn: ahoraIso
      };

      const nuevoDetalleCfg = {
        ...detalleCfgPrevio,
        perfiles_navegacion: {
          ...perfilesNavPrevios,
          [perfilClaveUpper]: snapshotPerfilCfg
        }
      };

      const { data: filasCfg, error: errUpdCfg } = await (supabase
        .schema("comun_configuracion")
        .from("cfg_negocio") as any)
        .update({
          cfg_detalle_configuracion: nuevoDetalleCfg,
          cfg_actualizado_en: ahoraIso
        })
        .eq("cfg_negocio", cfgNegocioKey)
        .select("cfg_id");

      if (!errUpdCfg && Array.isArray(filasCfg) && filasCfg.length > 0) {
        guardadoEnCfg = true;
      } else if (errUpdCfg) {
        errorCfg = errUpdCfg.message;
      }
    } catch (eCfg: any) {
      errorCfg = eCfg?.message || "Error actualizando cfg_negocio";
    }

    // 2. PERSISTENCIA SECUNDARIA EN comun_seguridad.seg_perfil (cuando exista política UPDATE o service_role)
    let guardadoEnSegPerfil = false;
    try {
      const { data: perfilRow } = await (adminSupabase
        .schema("comun_seguridad")
        .from("seg_perfil")
        .select("per_detalle_perfil")
        .eq("per_clave", perfilClaveUpper) as any)
        .maybeSingle();

      const detalleActual = (perfilRow?.per_detalle_perfil as Record<string, any>) || {};
      const negociosMap = { ...(detalleActual.negocios || {}) };
      const negocioConfigActual =
        negociosMap[negocioNorm] ||
        clavesNegocio.map(k => negociosMap[k]).find(Boolean) ||
        {};

      const titulosMerged = {
        ...(detalleActual.titulosWidgetsPorPanel || {}),
        ...(negocioConfigActual.titulosWidgetsPorPanel || {}),
        ...(titulosWidgetsPorPanel || {})
      };

      const retiradosMerged: Record<string, string[]> = {
        ...(detalleActual.widgetsRetiradosPorPanel || {}),
        ...(negocioConfigActual.widgetsRetiradosPorPanel || {}),
        ...(widgetsRetiradosPorPanel || {})
      };

      for (const [pId, wActivos] of Object.entries(widgetsAsignadosPorPanel || {})) {
        if (Array.isArray(wActivos) && Array.isArray(retiradosMerged[pId])) {
          const setActivos = new Set(wActivos);
          retiradosMerged[pId] = retiradosMerged[pId].filter(w => !setActivos.has(w));
        }
      }

      const snapshotNegocio = {
        ...negocioConfigActual,
        configuradoExplicitamente: true,
        panelesAsignados,
        widgetsAsignadosPorPanel,
        widgetsPorPanel: widgetsAsignadosPorPanel,
        widgetsRetiradosPorPanel: retiradosMerged,
        titulosWidgetsPorPanel: titulosMerged,
        actualizadoEn: ahoraIso
      };

      for (const k of clavesNegocio) {
        negociosMap[k] = snapshotNegocio;
      }

      const nuevoDetalle = {
        ...detalleActual,
        configuradoExplicitamente: true,
        negocios: negociosMap,
        panelesAsignados,
        widgetsAsignadosPorPanel,
        widgetsPorPanel: widgetsAsignadosPorPanel,
        widgetsRetiradosPorPanel: retiradosMerged,
        titulosWidgetsPorPanel: titulosMerged,
        actualizadoEn: ahoraIso
      };

      const { error: updErr } = await (adminSupabase
        .schema("comun_seguridad")
        .from("seg_perfil") as any)
        .update({
          per_detalle_perfil: nuevoDetalle,
          per_actualizado_en: ahoraIso
        })
        .eq("per_clave", perfilClaveUpper);

      if (!updErr) {
        guardadoEnSegPerfil = true;
      }
    } catch {
      // Ignorar si seg_perfil no tiene GRANT UPDATE para authenticated
    }

    if (!guardadoEnCfg && !guardadoEnSegPerfil) {
      return { ok: false, error: errorCfg || "No se pudo guardar la configuración del perfil en la base de datos" };
    }

    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel/herramientas");
    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/cuenta");
    revalidatePath("/panel");

    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error inesperado en guardarConfiguracionPanelesPerfilAction:", err);
    return { ok: false, error: err.message };
  }
}

export interface ConfiguracionPerfilPersistida {
  clave: string;
  configuradoExplicitamente: boolean;
  panelesAsignados?: string[];
  widgetsAsignadosPorPanel?: Record<string, string[]>;
  widgetsRetiradosPorPanel?: Record<string, string[]>;
  titulosWidgetsPorPanel?: Record<string, string>;
  actualizadoEn?: string;
}

export async function obtenerConfiguracionTodosPerfilesAction(
  negocio: string
): Promise<Resultado<Record<string, ConfiguracionPerfilPersistida>>> {
  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;
    const clavesNegocio = obtenerClavesNegocioCompatibles(negocio);
    const cfgNegocioKey = resolverClaveCfgNegocio(negocio);
    const resultado: Record<string, ConfiguracionPerfilPersistida> = {};

    // 1. Leer primero desde comun_configuracion.cfg_negocio (fuente primaria en producción con lectura pública/autenticada)
    try {
      const { data: cfgRow } = await (supabase
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .select("cfg_detalle_configuracion")
        .eq("cfg_negocio", cfgNegocioKey) as any)
        .maybeSingle();

      const perfilesNav = (cfgRow?.cfg_detalle_configuracion as Record<string, any>)?.perfiles_navegacion;
      if (perfilesNav && typeof perfilesNav === "object") {
        for (const [k, val] of Object.entries(perfilesNav as Record<string, any>)) {
          const clave = String(k || "").toUpperCase().trim();
          if (!clave || !val || typeof val !== "object") continue;
          const widgetsMap = val.widgetsAsignadosPorPanel || val.widgetsPorPanel;
          const panelesArr = val.panelesAsignados;
          const retiradosMap = val.widgetsRetiradosPorPanel;
          const titulosMap = val.titulosWidgetsPorPanel;
          if (widgetsMap || panelesArr || retiradosMap) {
            resultado[clave] = {
              clave,
              configuradoExplicitamente: Boolean(val.configuradoExplicitamente || widgetsMap),
              panelesAsignados: Array.isArray(panelesArr) ? panelesArr.map(String) : undefined,
              widgetsAsignadosPorPanel: widgetsMap && typeof widgetsMap === "object" ? widgetsMap : undefined,
              widgetsRetiradosPorPanel: retiradosMap && typeof retiradosMap === "object" ? retiradosMap : undefined,
              titulosWidgetsPorPanel: titulosMap && typeof titulosMap === "object" ? titulosMap : undefined,
              actualizadoEn: val.actualizadoEn
            };
          }
        }
      }
    } catch {
      // Continuar con fallback a seg_perfil
    }

    // 2. Complementar con comun_seguridad.seg_perfil si existe alguna fila más reciente
    try {
      const { data: filas } = await (adminSupabase
        .schema("comun_seguridad")
        .from("seg_perfil")
        .select("per_clave, per_detalle_perfil") as any);

      for (const fila of (filas || []) as any[]) {
        const clave = String(fila?.per_clave || "").toUpperCase().trim();
        if (!clave) continue;
        const detalle = (fila?.per_detalle_perfil || {}) as Record<string, any>;
        const negocioCfg =
          clavesNegocio.map(k => detalle.negocios?.[k]).find(Boolean) ||
          null;

        const widgetsMap =
          negocioCfg?.widgetsAsignadosPorPanel ||
          negocioCfg?.widgetsPorPanel ||
          detalle.widgetsAsignadosPorPanel ||
          detalle.widgetsPorPanel;

        const panelesArr =
          negocioCfg?.panelesAsignados ||
          detalle.panelesAsignados;

        const retiradosMap =
          negocioCfg?.widgetsRetiradosPorPanel ||
          detalle.widgetsRetiradosPorPanel;

        const titulosMap =
          negocioCfg?.titulosWidgetsPorPanel ||
          detalle.titulosWidgetsPorPanel;

        const tsSeg = Date.parse(negocioCfg?.actualizadoEn || detalle.actualizadoEn || "") || 0;
        const tsExistente = Date.parse(resultado[clave]?.actualizadoEn || "") || 0;

        if ((widgetsMap || panelesArr || retiradosMap) && (!resultado[clave] || tsSeg > tsExistente)) {
          resultado[clave] = {
            clave,
            configuradoExplicitamente: Boolean(
              negocioCfg?.configuradoExplicitamente ||
              detalle.configuradoExplicitamente ||
              widgetsMap
            ),
            panelesAsignados: Array.isArray(panelesArr) ? panelesArr.map(String) : undefined,
            widgetsAsignadosPorPanel: widgetsMap && typeof widgetsMap === "object" ? widgetsMap : undefined,
            widgetsRetiradosPorPanel: retiradosMap && typeof retiradosMap === "object" ? retiradosMap : undefined,
            titulosWidgetsPorPanel: titulosMap && typeof titulosMap === "object" ? titulosMap : undefined,
            actualizadoEn: negocioCfg?.actualizadoEn || detalle.actualizadoEn
          };
        }
      }
    } catch {
      // Ignorar error de lectura secundaria
    }

    return { ok: true, data: resultado };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error consultando configuración de perfiles" };
  }
}

export async function obtenerConfiguracionNavegacionRolAction(
  perfilClave: string,
  negocio: string
): Promise<Resultado<{ widgetsPorPanel: Record<string, string[]>; panelesAsignados: string[]; widgetsRetiradosPorPanel?: Record<string, string[]>; titulosWidgetsPorPanel?: Record<string, string>; configuradoExplicitamente?: boolean; actualizadoEn?: string }>> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;
  const variantesNegocio = obtenerClavesNegocioCompatibles(negocio);
  const cfgNegocioKey = resolverClaveCfgNegocio(negocio);
  const rolUpper = (perfilClave || "CLIENTE").toUpperCase().trim();

  const widgetsPorPanel: Record<string, string[]> = {};
  let panelesAsignados: string[] = [];
  let widgetsRetiradosPorPanel: Record<string, string[]> = {};
  let titulosWidgetsPorPanel: Record<string, string> = {};
  let configuradoExplicitamente = false;
  let actualizadoEn: string | undefined = undefined;
  const matrizRol = MATRIZ_FUNCIONAL_ROLES[rolUpper] || MATRIZ_FUNCIONAL_ROLES["CLIENTE"] || { paneles: [], widgetsPorPanel: {} };

  // 1. Inicializar valores base desde MATRIZ_FUNCIONAL_ROLES (solo para paneles que no hayan sido personalizados)
  for (const [panelId, widgets] of Object.entries(matrizRol.widgetsPorPanel)) {
    widgetsPorPanel[panelId] = [...widgets];
  }
  panelesAsignados = [...(matrizRol.paneles || ["panel_inicio", "panel_cuenta"])];

  // 2. Buscar configuración persistida primero en comun_configuracion.cfg_negocio y luego en comun_seguridad.seg_perfil
  try {
    let bddWidgetsPorPanel: Record<string, string[]> | null = null;
    let bddPaneles: string[] | null = null;
    let bddRetirados: Record<string, string[]> = {};
    let bddTitulos: Record<string, string> = {};
    let bddTs = 0;

    // 2a. Fuente primaria: comun_configuracion.cfg_negocio.cfg_detalle_configuracion.perfiles_navegacion
    try {
      const { data: cfgRow } = await (supabase
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .select("cfg_detalle_configuracion")
        .eq("cfg_negocio", cfgNegocioKey) as any)
        .maybeSingle();

      const cfgPerfil = (cfgRow?.cfg_detalle_configuracion as Record<string, any>)?.perfiles_navegacion?.[rolUpper];
      if (cfgPerfil && typeof cfgPerfil === "object") {
        bddWidgetsPorPanel = cfgPerfil.widgetsAsignadosPorPanel || cfgPerfil.widgetsPorPanel || null;
        bddPaneles = Array.isArray(cfgPerfil.panelesAsignados) ? cfgPerfil.panelesAsignados : null;
        bddRetirados = cfgPerfil.widgetsRetiradosPorPanel || {};
        bddTitulos = cfgPerfil.titulosWidgetsPorPanel || {};
        actualizadoEn = cfgPerfil.actualizadoEn;
        bddTs = Date.parse(cfgPerfil.actualizadoEn || "") || 0;
      }
    } catch {
      // Fallback a seg_perfil
    }

    // 2b. Fuente secundaria: comun_seguridad.seg_perfil.per_detalle_perfil (si es más reciente o si cfg_negocio no tenía entrada)
    try {
      const { data: perfilRow } = await (adminSupabase
        .schema("comun_seguridad")
        .from("seg_perfil")
        .select("per_detalle_perfil")
        .eq("per_clave", rolUpper) as any)
        .maybeSingle();

      if (perfilRow?.per_detalle_perfil) {
        const detalle = perfilRow.per_detalle_perfil as Record<string, any>;
        const negocioConfig =
          variantesNegocio.map(k => detalle.negocios?.[k]).find(Boolean) ||
          null;

        const segWidgets =
          negocioConfig?.widgetsAsignadosPorPanel ||
          negocioConfig?.widgetsPorPanel ||
          detalle.widgetsAsignadosPorPanel ||
          detalle.widgetsPorPanel;
        const segTs = Date.parse(negocioConfig?.actualizadoEn || detalle.actualizadoEn || "") || 0;

        if (segWidgets && (!bddWidgetsPorPanel || segTs > bddTs)) {
          bddWidgetsPorPanel = segWidgets;
          bddPaneles = negocioConfig?.panelesAsignados || detalle.panelesAsignados || bddPaneles;
          bddRetirados = negocioConfig?.widgetsRetiradosPorPanel || detalle.widgetsRetiradosPorPanel || bddRetirados;
          bddTitulos = negocioConfig?.titulosWidgetsPorPanel || detalle.titulosWidgetsPorPanel || bddTitulos;
          actualizadoEn = negocioConfig?.actualizadoEn || detalle.actualizadoEn || actualizadoEn;
        }
      }
    } catch {
      // Ignorar error secundario
    }

    widgetsRetiradosPorPanel = bddRetirados;

    if (bddWidgetsPorPanel && typeof bddWidgetsPorPanel === "object") {
      configuradoExplicitamente = true;
      for (const [pId, wList] of Object.entries(bddWidgetsPorPanel)) {
        if (Array.isArray(wList)) {
          const retiradosPanel = new Set<string>(Array.isArray(bddRetirados[pId]) ? bddRetirados[pId].map(String) : []);
          const normalizados = wList
            .map(String)
            .map((w) => (w === "facturacion_electronica" ? "historial_pagos" : w))
            .filter((w) => !retiradosPanel.has(w) && !(w === "historial_pagos" && retiradosPanel.has("facturacion_electronica")));

          // Respetar exactamente la lista guardada para este panel sin re-inyectar widgets canónicos eliminados
          widgetsPorPanel[pId] = Array.from(new Set(normalizados));
        }
      }
    }

    // Aplicar exclusión de widgetsRetiradosPorPanel sobre cualquier panel restante
    for (const [pId, retList] of Object.entries(bddRetirados)) {
      if (Array.isArray(retList) && retList.length > 0 && Array.isArray(widgetsPorPanel[pId])) {
        const retSet = new Set(retList.map(String));
        widgetsPorPanel[pId] = widgetsPorPanel[pId].filter(
          (w) => !retSet.has(w) && !(w === "historial_pagos" && retSet.has("facturacion_electronica"))
        );
      }
    }

    if (Array.isArray(bddPaneles) && bddPaneles.length > 0) {
      panelesAsignados = Array.from(new Set(bddPaneles.map(String)));
    }
    if (rolUpper === "CLIENTE") {
      if (!panelesAsignados.includes("panel_productos_servicios")) {
        panelesAsignados = [
          "panel_inicio",
          "panel_productos_servicios",
          ...panelesAsignados.filter((id) => id !== "panel_inicio"),
        ];
      }
      if (!widgetsPorPanel["panel_productos_servicios"] || widgetsPorPanel["panel_productos_servicios"].length === 0) {
        widgetsPorPanel["panel_productos_servicios"] = ["productos_servicios"];
      }
    }
    titulosWidgetsPorPanel = bddTitulos;
  } catch (e) {
    console.error("Error leyendo configuración de perfil:", e);
  }

  return {
    ok: true,
    data: {
      widgetsPorPanel,
      panelesAsignados,
      widgetsRetiradosPorPanel,
      titulosWidgetsPorPanel,
      configuradoExplicitamente,
      actualizadoEn
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
  const esSuperAdminEmail =
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "familiammtg@gmail.com" ||
    correo === "jesus251296@gmail.com";

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

// ============================================================================
// INVITACIONES DE EQUIPO POR CORREO Y CONTROL DE ACCESO POR ROL (TINKAY / TIENDAS)
// ============================================================================

export type RolEquipoPortal =
  | "VENTAS"
  | "TALLER"
  | "DELIVERY"
  | "DELIVERY_EXTERNO"
  | "OPERADOR"
  | "ADMINISTRADOR";

export interface InvitacionEquipoPortal {
  id: string;
  correo: string;
  nombre?: string;
  rol: RolEquipoPortal;
  estado: "PENDIENTE" | "ACEPTADA";
  invitadoPorCorreo: string;
  creadoEn: string;
  aceptadoEn?: string;
}

const ETIQUETA_ROL_PORTAL: Record<string, string> = {
  VENTAS: "Ventas / Asesor Comercial",
  TALLER: "Taller Floral",
  DELIVERY: "Delivery Interno",
  DELIVERY_EXTERNO: "Delivery Subcontratado",
  OPERADOR: "Operador General",
  ADMINISTRADOR: "Administrador de Tienda",
  CLIENTE: "Cliente",
};

const PERMISOS_RESUMEN_ROL: Record<string, string[]> = {
  VENTAS: [
    "Ventas y Chats en Vivo (atención comercial, etiquetas y respuestas rápidas)",
    "Enviar Pedidos a Taller y programación de órdenes de trabajo",
    "Pedidos de Tienda y Proformas de Eventos (cotizar, variaciones V2/V3 y confirmar pagos)",
    "Galería de Entrega Inmediata (1–2h) y consulta de Inventario de Rosas",
  ],
  TALLER: [
    "Consola de Taller Floral (cola de elaboración en tiempo real y actualización de estado: En Preparación / Listo Entrega, sin precios)",
    "Inventario Fotográfico de Rosas con conteo IA ARIA",
    "Galería de Disponibles para Entrega Inmediata (subir arreglos listos en tienda)",
  ],
  DELIVERY: [
    "Confirmación de Entregas GPS (Offline-First): ver pedidos listos y asignados",
    "Botón Iniciar Ruta para compartir ubicación GPS en vivo mientras está en camino",
    "Captura de fotografía con sello GPS y confirmación de entrega",
  ],
  DELIVERY_EXTERNO: [
    "Confirmación de Entregas GPS restringida únicamente a los pedidos asignados explícitamente a su cuenta",
    "Compartir ubicación GPS en ruta y confirmar entrega con fotografía georreferenciada",
  ],
  OPERADOR: [
    "Coordinación operativa integral: Enviar Pedidos, Taller Floral, Entregas e Informes Quincenales IESS",
    "Inventario de Rosas, Entrega Inmediata, Pedidos, Catálogo y Cobertura Logística",
  ],
  ADMINISTRADOR: [
    "Acceso administrativo completo al portal (Ventas, Taller, Entregas/Informes, Facturación, Catálogo, Usuarios/Roles, Pasarelas, Logística, Correo y ARIA)",
  ],
};

export async function obtenerInvitacionesEquipoAction(
  negocio: string = "tinkay"
): Promise<{ ok: true; invitaciones: InvitacionEquipoPortal[] } | { ok: false; error: string }> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const supabase = await crearClienteServidor();
  const db: any = crearClienteAdmin() ?? supabase;

  const { data: fila, error } = await db
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("cfg_detalle_configuracion")
    .eq("cfg_negocio", negNorm)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  const det = (fila?.cfg_detalle_configuracion ?? {}) as Record<string, any>;
  const lista: InvitacionEquipoPortal[] = Array.isArray(det.invitaciones_equipo)
    ? det.invitaciones_equipo
    : [];

  return { ok: true, invitaciones: lista };
}

export async function invitarUsuarioPorCorreoAction(entrada: {
  correo: string;
  nombre?: string;
  rol: string;
  negocio?: string;
}): Promise<Resultado<{ invitacion: InvitacionEquipoPortal; aplicadoInmediato: boolean }>> {
  const negNorm = (entrada.negocio || "tinkay").trim().toLowerCase();
  const correoLimpio = (entrada.correo || "").trim().toLowerCase();
  const nombreLimpio = (entrada.nombre || "").trim();
  const rolUpper = (entrada.rol || "VENTAS").trim().toUpperCase() as RolEquipoPortal;

  if (!correoLimpio || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
    return { ok: false, error: "Ingresa un correo electrónico válido." };
  }

  if (
    !["VENTAS", "TALLER", "DELIVERY", "DELIVERY_EXTERNO", "OPERADOR", "ADMINISTRADOR"].includes(
      rolUpper
    )
  ) {
    return {
      ok: false,
      error:
        "Selecciona un rol válido (Ventas, Taller, Delivery Interno, Delivery Subcontratado, Operador o Administrador).",
    };
  }

  const nivelGestor = await obtenerNivelMaximoGestor(negNorm);
  if (nivelGestor < 80) {
    return { ok: false, error: "Solo el Administrador de la tienda puede enviar invitaciones de equipo." };
  }

  const supabase = await crearClienteServidor();
  const db: any = crearClienteAdmin() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const correoAdmin = user?.email || "tinkay.uio@gmail.com";
  const ahoraIso = new Date().toISOString();

  // 1. Ejecutar RPC transaccional SECURITY DEFINER (garantiza persistencia real en PostgreSQL sin depender de service_role en Vercel)
  let nuevaInvitacion: InvitacionEquipoPortal | null = null;
  let aplicadoInmediato = false;

  const { data: rpcInv, error: rpcInvErr } = await (supabase
    .schema("comun_seguridad") as any)
    .rpc("seg_fn_invitar_miembro_equipo", {
      p_negocio: negNorm,
      p_correo: correoLimpio,
      p_nombre: nombreLimpio || null,
      p_rol: rolUpper,
    });

  if (!rpcInvErr && rpcInv) {
    if (!rpcInv.ok || !rpcInv.invitacion) {
      return {
        ok: false,
        error: rpcInv.error || "No se pudo guardar la invitación en la base de datos.",
      };
    }
    nuevaInvitacion = rpcInv.invitacion as InvitacionEquipoPortal;
    aplicadoInmediato = Boolean(rpcInv.aplicadoInmediato);
  } else {
    // Fallback con validación estricta de filas afectadas (Cero Supresión Silenciosa de Errores)
    try {
      await db
        .schema("comun_seguridad")
        .from("seg_perfil")
        .upsert(
          [
            {
              per_clave: "DELIVERY_EXTERNO",
              per_nombre: "Delivery Subcontratado",
              per_nivel: 12,
              per_activo: true,
              per_asignable: true,
            },
            {
              per_clave: "DELIVERY",
              per_nombre: "Delivery Interno",
              per_nivel: 15,
              per_activo: true,
              per_asignable: true,
            },
            {
              per_clave: "TALLER",
              per_nombre: "Taller Floral",
              per_nivel: 18,
              per_activo: true,
              per_asignable: true,
            },
            {
              per_clave: "VENTAS",
              per_nombre: "Ventas / Asesor Comercial",
              per_nivel: 20,
              per_activo: true,
              per_asignable: true,
            },
          ],
          { onConflict: "per_clave" }
        );
    } catch {
      // Continuar
    }

    const { data: usuarioExistente } = await db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_detalle_usuario")
      .ilike("usu_correo", correoLimpio)
      .maybeSingle();

    if (usuarioExistente?.usu_id) {
      const { data: mems } = await db
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_id")
        .eq("mem_usuario_id", usuarioExistente.usu_id)
        .in("mem_negocio", [negNorm, negNorm.toUpperCase(), "tnk", "TNK"]);

      const memId = mems?.[0]?.mem_id;
      if (memId) {
        const { data: dbPerfil } = await db
          .schema("comun_seguridad")
          .from("seg_perfil")
          .select("per_id")
          .eq("per_clave", rolUpper)
          .maybeSingle();

        const { data: memUpd, error: errMemUpd } = await db
          .schema("comun_seguridad")
          .from("seg_membresia")
          .update({
            mem_rol: rolUpper,
            mem_estado: "ACTIVO",
            mem_actualizado_en: ahoraIso,
          })
          .eq("mem_id", memId)
          .select("mem_id");

        if (!errMemUpd && Array.isArray(memUpd) && memUpd.length > 0) {
          if (dbPerfil?.per_id) {
            await db
              .schema("comun_seguridad")
              .from("seg_membresia_perfil")
              .upsert(
                {
                  mpe_membresia_id: memId,
                  mpe_perfil_id: dbPerfil.per_id,
                },
                { onConflict: "mpe_membresia_id,mpe_perfil_id" }
              );
          }

          const detUsr = (usuarioExistente.usu_detalle_usuario || {}) as Record<string, any>;
          await db
            .schema("comun_seguridad")
            .from("seg_usuario")
            .update({
              usu_detalle_usuario: {
                ...detUsr,
                roles_explicitos_tinkay: true,
              },
              usu_actualizado_en: ahoraIso,
            })
            .eq("usu_id", usuarioExistente.usu_id);

          aplicadoInmediato = true;
        }
      }
    }

    const { data: cfgActual, error: errCfgRead } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", negNorm)
      .maybeSingle();

    if (errCfgRead) {
      return { ok: false, error: `Error leyendo configuración del negocio: ${errCfgRead.message}` };
    }

    const detCfg = (cfgActual?.cfg_detalle_configuracion ?? {}) as Record<string, any>;
    const prevInvitaciones: InvitacionEquipoPortal[] = Array.isArray(detCfg.invitaciones_equipo)
      ? detCfg.invitaciones_equipo
      : [];

    nuevaInvitacion = {
      id: `inv-${Date.now()}`,
      correo: correoLimpio,
      nombre:
        nombreLimpio ||
        (usuarioExistente
          ? [usuarioExistente.usu_nombres, usuarioExistente.usu_apellidos].filter(Boolean).join(" ").trim()
          : undefined),
      rol: rolUpper,
      estado: aplicadoInmediato ? "ACEPTADA" : "PENDIENTE",
      invitadoPorCorreo: correoAdmin,
      creadoEn: ahoraIso,
      ...(aplicadoInmediato ? { aceptadoEn: ahoraIso } : {}),
    };

    const invitacionesActualizadas = [
      nuevaInvitacion,
      ...prevInvitaciones.filter((i) => i.correo.toLowerCase() !== correoLimpio),
    ].slice(0, 100);

    if (cfgActual?.cfg_id) {
      const { data: filasCfg, error: errUpdCfg } = await db
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .update({
          cfg_detalle_configuracion: {
            ...detCfg,
            invitaciones_equipo: invitacionesActualizadas,
          },
          cfg_actualizado_en: ahoraIso,
        })
        .eq("cfg_id", cfgActual.cfg_id)
        .select("cfg_id");

      if (errUpdCfg || !Array.isArray(filasCfg) || filasCfg.length === 0) {
        return {
          ok: false,
          error:
            errUpdCfg?.message ||
            "PostgreSQL rechazó guardar la invitación por permisos RLS. Ejecuta en Supabase la migración 20261118000001_fix_invitaciones_equipo_y_sincronizacion_roles_tinkay.sql.",
        };
      }
    } else {
      const { data: filasIns, error: errInsCfg } = await db
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .insert({
          cfg_negocio: negNorm,
          cfg_nombre_comercial: "Tinkay Floristería",
          cfg_detalle_configuracion: {
            ...detCfg,
            invitaciones_equipo: invitacionesActualizadas,
          },
        })
        .select("cfg_id");

      if (errInsCfg || !Array.isArray(filasIns) || filasIns.length === 0) {
        return {
          ok: false,
          error:
            errInsCfg?.message ||
            "No se pudo persistir la invitación en la base de datos. Ejecuta en Supabase la migración 20261118000001_fix_invitaciones_equipo_y_sincronizacion_roles_tinkay.sql.",
        };
      }
    }
  }

  // 4. Enviar correo de invitación con el rol y permisos asignados
  const etiquetaRol = ETIQUETA_ROL_PORTAL[rolUpper] || rolUpper;
  const permisosRol = PERMISOS_RESUMEN_ROL[rolUpper] || [];
  const urlBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://tinkay-web.vercel.app";
  const qsRegistro = new URLSearchParams({ correo: correoLimpio });
  if (nuevaInvitacion.nombre) {
    qsRegistro.set("nombre", nuevaInvitacion.nombre);
  }
  const urlDestino = aplicadoInmediato
    ? `${urlBase}/panel`
    : `${urlBase}/registro?${qsRegistro.toString()}`;

  try {
    const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
    await enviarCorreo({
      negocio: negNorm,
      para: correoLimpio,
      asunto: `🌸 Invitación al Portal Tinkay Floristería — Rol: ${etiquetaRol}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E5DFD5; border-radius: 16px; overflow: hidden; color: #1C261F;">
          <div style="background: #1C261F; padding: 26px 30px; color: #F5F2EB;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #C27D5F; margin-bottom: 6px;">
              TINKAY · ARTE FLORAL &amp; DETALLES
            </div>
            <h1 style="margin: 0; font-size: 21px; font-weight: 700; line-height: 1.3;">
              Invitación al equipo de Tinkay Floristería
            </h1>
          </div>
          <div style="padding: 26px 30px;">
            <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
              Hola${nuevaInvitacion.nombre ? ` <strong>${nuevaInvitacion.nombre}</strong>` : ""},
            </p>
            <p style="font-size: 14.5px; line-height: 1.6; color: #4A544C;">
              Has sido invitado(a) por la administración de <strong>Tinkay Floristería</strong> para colaborar en el portal operativo con el siguiente nivel de acceso:
            </p>
            <div style="background: #F5F2EB; border: 1px solid #E5DFD5; border-radius: 12px; padding: 16px 18px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6B746C; margin-bottom: 4px;">
                ROL ASIGNADO EN EL PORTAL
              </div>
              <div style="font-size: 17px; font-weight: 800; color: #1C261F; margin-bottom: 10px;">
                ${etiquetaRol} (${rolUpper})
              </div>
              <div style="font-size: 12.5px; color: #4A544C; font-weight: 600; margin-bottom: 6px;">
                Módulos habilitados para tu perfil:
              </div>
              <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #2D3D30; line-height: 1.55;">
                ${permisosRol.map((p) => `<li style="margin-bottom: 4px;">${p}</li>`).join("")}
              </ul>
            </div>
            <p style="font-size: 13.5px; line-height: 1.6; color: #4A544C;">
              ${
                aplicadoInmediato
                  ? `Tu cuenta (<strong>${correoLimpio}</strong>) ya tiene activo este rol. Ingresa directamente con tus credenciales:`
                  : `Regístrate o inicia sesión usando exactamente el correo <strong>${correoLimpio}</strong> para que el portal active tu rol de forma automática:`
              }
            </p>
            <div style="text-align: center; margin: 26px 0 12px;">
              <a href="${urlDestino}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #2D3D30; color: #F5F2EB; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 28px; border-radius: 10px;">
                ${aplicadoInmediato ? "Ingresar al Portal Tinkay →" : "Crear Cuenta y Activar Rol →"}
              </a>
            </div>
          </div>
        </div>
      `,
    });
  } catch (errMail) {
    console.warn("Aviso al enviar correo de invitación Tinkay:", errMail);
  }

  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return {
    ok: true,
    data: { invitacion: nuevaInvitacion, aplicadoInmediato },
    mensaje: aplicadoInmediato
      ? `Invitación enviada a ${correoLimpio}. Como ya tenía cuenta registrada, el rol ${etiquetaRol} quedó activo de inmediato.`
      : `Invitación enviada por correo a ${correoLimpio} con el rol ${etiquetaRol}. Se activará automáticamente apenas inicie sesión o se registre.`,
  };
}

export async function eliminarInvitacionEquipoAction(
  invitacionId: string,
  negocio: string = "tinkay",
  correoInvitacion?: string
): Promise<Resultado> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const nivelGestor = await obtenerNivelMaximoGestor(negNorm);
  if (nivelGestor < 80) {
    return { ok: false, error: "No tienes permisos para eliminar invitaciones." };
  }

  const supabase = await crearClienteServidor();
  const db: any = crearClienteAdmin() ?? supabase;

  const { data: rpcDel, error: rpcDelErr } = await (supabase
    .schema("comun_seguridad") as any)
    .rpc("seg_fn_eliminar_invitacion_equipo", {
      p_negocio: negNorm,
      p_invitacion_id: invitacionId,
      p_correo: correoInvitacion ? correoInvitacion.trim().toLowerCase() : null,
    });

  if (!rpcDelErr && rpcDel) {
    if (!rpcDel.ok) {
      return { ok: false, error: rpcDel.error || "No se pudo eliminar la invitación." };
    }
    revalidatePath("/panel/usuarios");
    return { ok: true };
  }

  const { data: cfgActual, error: errRead } = await db
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("cfg_id, cfg_detalle_configuracion")
    .eq("cfg_negocio", negNorm)
    .maybeSingle();

  if (errRead) return { ok: false, error: errRead.message };
  if (!cfgActual?.cfg_id) return { ok: true };

  const detCfg = (cfgActual.cfg_detalle_configuracion ?? {}) as Record<string, any>;
  const prevInvitaciones: InvitacionEquipoPortal[] = Array.isArray(detCfg.invitaciones_equipo)
    ? detCfg.invitaciones_equipo
    : [];
  const correoNorm = (correoInvitacion || "").trim().toLowerCase();

  const { data: filasUpd, error: errUpd } = await db
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .update({
      cfg_detalle_configuracion: {
        ...detCfg,
        invitaciones_equipo: prevInvitaciones.filter(
          (i) =>
            i.id !== invitacionId &&
            (!correoNorm || i.correo.toLowerCase() !== correoNorm)
        ),
      },
      cfg_actualizado_en: new Date().toISOString(),
    })
    .eq("cfg_id", cfgActual.cfg_id)
    .select("cfg_id");

  if (errUpd || !Array.isArray(filasUpd) || filasUpd.length === 0) {
    return {
      ok: false,
      error:
        errUpd?.message ||
        "No se pudo eliminar la invitación en PostgreSQL (permiso RLS denegado). Ejecuta la migración SQL pendiente en Supabase.",
    };
  }

  revalidatePath("/panel/usuarios");
  return { ok: true };
}

/**
 * Sincroniza el rol del usuario autenticado al entrar al panel de Tinkay:
 * 1. Invoca el RPC `SECURITY DEFINER` `seg_fn_sincronizar_acceso_rol_tinkay`, que reclama de forma
 *    transaccional cualquier invitación pendiente para su correo (sin depender de `service_role`),
 *    actualiza `seg_membresia` + `seg_membresia_perfil` y marca la invitación como `ACEPTADA`.
 * 2. Si NO es propietario (`tinkay.uio@gmail.com` / `kleber.toapanta.ch@gmail.com`) y no tiene
 *    asignación explícita en Tinkay (`roles_explicitos_tinkay`), normaliza cualquier rol
 *    `SUPERADMIN` heredado de otro negocio a `CLIENTE`.
 */
export async function sincronizarAccesoRolTinkayAction(): Promise<{
  rolEfectivo:
    | "SUPERADMIN"
    | "ADMINISTRADOR"
    | "OPERADOR"
    | "VENTAS"
    | "TALLER"
    | "DELIVERY"
    | "DELIVERY_EXTERNO"
    | "CLIENTE";
  tieneMembresia?: boolean;
}> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { rolEfectivo: "CLIENTE", tieneMembresia: false };

    const correo = (user.email || "").trim().toLowerCase();
    const esPropietarioTinkay =
      correo === "tinkay.uio@gmail.com" || correo === "kleber.toapanta.ch@gmail.com";

    // Ejecutar primero el RPC transaccional SECURITY DEFINER en PostgreSQL
    const { data: rpcSync, error: rpcSyncErr } = await (supabase
      .schema("comun_seguridad") as any)
      .rpc("seg_fn_sincronizar_acceso_rol_tinkay", {
        p_negocio: "tinkay",
        p_crear_cliente_si_no_existe: false,
      });

    if (!rpcSyncErr && rpcSync?.ok && rpcSync?.rolEfectivo) {
      if (rpcSync.invitacionAplicada) {
        try {
          revalidatePath("/panel/usuarios");
          revalidatePath("/panel");
        } catch {
          // Ignorar si se invoca durante render de Server Component
        }
      }
      return {
        rolEfectivo: esPropietarioTinkay ? "SUPERADMIN" : rpcSync.rolEfectivo,
        tieneMembresia: Boolean(esPropietarioTinkay || rpcSync.tieneMembresia),
      };
    }

    if (esPropietarioTinkay) {
      return { rolEfectivo: "SUPERADMIN", tieneMembresia: true };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    const ahoraIso = new Date().toISOString();

    // 1. Revisar si tiene una invitación en cfg_negocio para Tinkay
    const { data: cfgFila } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", "tinkay")
      .maybeSingle();

    const detCfg = (cfgFila?.cfg_detalle_configuracion ?? {}) as Record<string, any>;
    const invitaciones: InvitacionEquipoPortal[] = Array.isArray(detCfg.invitaciones_equipo)
      ? detCfg.invitaciones_equipo
      : [];
    const invPendiente = invitaciones.find(
      (i) => i.correo.toLowerCase() === correo && i.estado === "PENDIENTE"
    );

    const { data: uRow } = await db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_detalle_usuario")
      .eq("usu_id", user.id)
      .maybeSingle();

    const detUsr = (uRow?.usu_detalle_usuario ?? {}) as Record<string, any>;
    let tieneRolExplicitoTinkay = Boolean(detUsr.roles_explicitos_tinkay);

    const { data: mems } = await db
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_rol, mem_negocio")
      .eq("mem_usuario_id", user.id)
      .in("mem_negocio", ["tinkay", "TINKAY", "tnk", "TNK"]);

    let memActual = mems?.[0];

    if (invPendiente) {
      const rolInv = invPendiente.rol;
      const { data: dbPerfil } = await db
        .schema("comun_seguridad")
        .from("seg_perfil")
        .select("per_id")
        .eq("per_clave", rolInv)
        .maybeSingle();

      let memId = memActual?.mem_id;
      if (!memId) {
        const { data: nuevaMem } = await db
          .schema("comun_seguridad")
          .from("seg_membresia")
          .insert({
            mem_usuario_id: user.id,
            mem_negocio: "tinkay",
            mem_rol: rolInv,
            mem_estado: "ACTIVO",
          })
          .select("mem_id, mem_rol")
          .single();
        memId = nuevaMem?.mem_id;
        memActual = nuevaMem;
      } else {
        await db
          .schema("comun_seguridad")
          .from("seg_membresia")
          .update({
            mem_rol: rolInv,
            mem_estado: "ACTIVO",
            mem_actualizado_en: ahoraIso,
          })
          .eq("mem_id", memId);
        memActual = { ...memActual, mem_rol: rolInv };
      }

      if (memId && dbPerfil?.per_id) {
        await db
          .schema("comun_seguridad")
          .from("seg_membresia_perfil")
          .upsert(
            {
              mpe_membresia_id: memId,
              mpe_perfil_id: dbPerfil.per_id,
            },
            { onConflict: "mpe_membresia_id,mpe_perfil_id" }
          );
      }

      await db
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detUsr,
            roles_explicitos_tinkay: true,
          },
          usu_actualizado_en: ahoraIso,
        })
        .eq("usu_id", user.id);

      if (cfgFila?.cfg_id) {
        const actualizadas = invitaciones.map((i) =>
          i.id === invPendiente.id ? { ...i, estado: "ACEPTADA", aceptadoEn: ahoraIso } : i
        );
        await db
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: {
              ...detCfg,
              invitaciones_equipo: actualizadas,
            },
            cfg_actualizado_en: ahoraIso,
          })
          .eq("cfg_id", cfgFila.cfg_id);
      }

      tieneRolExplicitoTinkay = true;
      return { rolEfectivo: rolInv };
    }

    // 2. Si no tiene membresía en Tinkay, crearla como CLIENTE
    if (!memActual?.mem_id) {
      await db
        .schema("comun_seguridad")
        .from("seg_membresia")
        .insert({
          mem_usuario_id: user.id,
          mem_negocio: "tinkay",
          mem_rol: "CLIENTE",
          mem_estado: "ACTIVO",
        });
      return { rolEfectivo: "CLIENTE" };
    }

    const rolMem = String(memActual.mem_rol || "CLIENTE").toUpperCase();

    // 3. Si tenía SUPERADMIN o ADMINISTRADOR auto-heredado sin invitación ni asignación explícita en Tinkay, normalizar a CLIENTE
    if (
      !tieneRolExplicitoTinkay &&
      (rolMem === "SUPERADMIN" || rolMem === "ADMINISTRADOR" || rolMem === "ADMIN")
    ) {
      await db
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({
          mem_rol: "CLIENTE",
          mem_actualizado_en: ahoraIso,
        })
        .eq("mem_id", memActual.mem_id);

      // Limpiar perfiles administrativos heredados en seg_membresia_perfil para esta membresía
      const { data: perCliente } = await db
        .schema("comun_seguridad")
        .from("seg_perfil")
        .select("per_id")
        .eq("per_clave", "CLIENTE")
        .maybeSingle();

      if (perCliente?.per_id) {
        await db
          .schema("comun_seguridad")
          .from("seg_membresia_perfil")
          .delete()
          .eq("mpe_membresia_id", memActual.mem_id)
          .neq("mpe_perfil_id", perCliente.per_id);
      }

      return { rolEfectivo: "CLIENTE" };
    }

    // 4. Evaluar perfiles asignados explícitamente a esta membresía
    const { data: mpRows } = await db
      .schema("comun_seguridad")
      .from("seg_membresia_perfil")
      .select("seg_perfil(per_clave, per_nivel)")
      .eq("mpe_membresia_id", memActual.mem_id);

    const claves = new Set<string>([rolMem]);
    for (const r of mpRows ?? []) {
      const c = String((r as any)?.seg_perfil?.per_clave || "").toUpperCase();
      if (c) claves.add(c);
    }

    if (tieneRolExplicitoTinkay && (claves.has("ADMINISTRADOR") || claves.has("ADMIN"))) {
      return { rolEfectivo: "ADMINISTRADOR" };
    }
    if (claves.has("OPERADOR") || claves.has("AUXILIAR")) return { rolEfectivo: "OPERADOR" };
    if (claves.has("VENTAS") || claves.has("VENDEDOR")) return { rolEfectivo: "VENTAS" };
    if (claves.has("TALLER") || claves.has("FLORISTA")) return { rolEfectivo: "TALLER" };
    if (claves.has("DELIVERY") || claves.has("REPARTIDOR")) return { rolEfectivo: "DELIVERY" };
    if (claves.has("DELIVERY_EXTERNO") || claves.has("SUBCONTRATADO")) {
      return { rolEfectivo: "DELIVERY_EXTERNO" };
    }

    return { rolEfectivo: "CLIENTE" };
  } catch {
    return { rolEfectivo: "CLIENTE" };
  }
}
