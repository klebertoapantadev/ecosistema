/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@eco/identidad";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerCampanasServidor, limpiarCampanasServidor } from "../almacen";

export interface RegistroNotificacion {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal?: string;
  not_pospuesta_hasta?: string | null;
  not_pospuesta_horas?: number | null;
  not_eliminada?: boolean;
  not_eliminada_en?: string | null;
}

// Reemplazo dinámico estricto de variables para el perfil autenticado
function interpolarParaPerfil(
  plantilla: string,
  perfil: { usu_nombres?: string | null; usu_apellidos?: string | null; usu_correo: string },
  negocio: string = "tranqi"
): string {
  if (!plantilla) return "";
  const nombreCompleto = ([perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || perfil.usu_correo.split("@")[0]) || "Usuario";
  const primerNombre = (nombreCompleto.split(" ")[0]) || "Usuario";
  const fechaEC = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });

  return plantilla
    .replace(/\{\{\s*nombre_usuario\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombrecompleto\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombre_completo\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombre\s*\}\}/gi, primerNombre)
    .replace(/\{\{\s*mail\s*\}\}/gi, perfil.usu_correo)
    .replace(/\{\{\s*correo\s*\}\}/gi, perfil.usu_correo)
    .replace(/\{\{\s*negocio\s*\}\}/gi, negocio)
    .replace(/\{\{\s*fecha\s*\}\}/gi, fechaEC)
    .replace(/\{Mail\}/gi, perfil.usu_correo)
    .replace(/\{nombre\}/gi, primerNombre)
    .replace(/\{nombrecompleto\}/gi, nombreCompleto);
}

export async function GET() {
  try {
    const perfil = await obtenerPerfilActual();
    const notificaciones: RegistroNotificacion[] = [];

    if (perfil) {
      try {
        const { obtenerPerfiles } = await import("@eco/identidad");
        const perfilesTranqi = await obtenerPerfiles("tranqi");
        const perfilesTRANQ = await obtenerPerfiles("TRANQ");
        const perfiles = Array.from(new Set([...perfilesTranqi, ...perfilesTRANQ]));
        const correo = (perfil.usu_correo || "").toLowerCase().trim();
        const esSuperAdminEmail = correo === "familiammtg@gmail.com" || correo === "jesus251296@gmail.com";

        let client = null;
        try {
          client = crearClienteAdmin();
        } catch (err) {
          console.warn("[notificaciones] Error creando cliente admin:", err);
          client = null;
        }
        if (!client) {
          client = await crearClienteServidor();
        }
        if (!client) {
          return NextResponse.json({ ok: false, error: "No se pudo conectar a la base de datos" }, { status: 500 });
        }

        // Consultar membresía directa para asegurar que rol OPERADOR/ADMINISTRADOR esté siempre detectado
        const { data: memUser } = await client
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_rol, mem_estado")
          .eq("mem_usuario_id", perfil.usu_id)
          .eq("mem_estado", "ACTIVO");

        const rolesMembresia = ((memUser || []) as Array<{ mem_rol?: string | null }>).map(m => (m.mem_rol || "").toUpperCase());
        const esStaffMembresia = rolesMembresia.includes("OPERADOR") || rolesMembresia.includes("ADMINISTRADOR") || rolesMembresia.includes("SUPERADMIN") || rolesMembresia.includes("AUXILIAR");
        const _esAutorizado = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR") || perfiles.includes("SUPERADMIN") || esStaffMembresia;

        let query = client
          .schema("comun_notificacion")
          .from("not_registro")
          .select("not_id, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_creado_en, not_canal, not_detalles")
          .order("not_creado_en", { ascending: false })
          .limit(100);

        query = query.eq("not_usuario_id", perfil.usu_id);

        let registros: any[] = [];
        try {
          const resQuery = await query;
          if (resQuery && Array.isArray(resQuery.data)) {
            registros = resQuery.data;
          }
        } catch (errQuery) {
          console.warn("Aviso al consultar not_registro:", errQuery);
        }

        const registrosClavesVistas = new Set<string>();

        if (registros && Array.isArray(registros)) {
          (registros as unknown as Array<{
            not_id: string;
            not_titulo: string;
            not_contenido_html: string;
            not_url_accion?: string;
            not_leido_en?: string | null;
            not_creado_en: string;
            not_canal?: string;
            not_detalles?: { eliminada?: boolean; eliminada_en?: string; pospuesta_hasta?: string; pospuesta_horas?: number; clave_original?: string } | null;
          }>).forEach(r => {
            const detalles = r.not_detalles ?? {};
            const claveOrig = (detalles.clave_original as string) || r.not_id;
            registrosClavesVistas.add(claveOrig);
            registrosClavesVistas.add(r.not_id);

            notificaciones.push({
              not_id: claveOrig,
              not_titulo: interpolarParaPerfil(r.not_titulo, perfil),
              not_contenido_html: interpolarParaPerfil(r.not_contenido_html, perfil),
              not_url_accion: r.not_url_accion || "/panel",
              not_leido_en: r.not_leido_en,
              not_creado_en: r.not_creado_en,
              not_canal: r.not_canal || "IN_APP",
              not_pospuesta_hasta: detalles.pospuesta_hasta || null,
              not_pospuesta_horas: detalles.pospuesta_horas || null,
              not_eliminada: Boolean(detalles.eliminada),
              not_eliminada_en: detalles.eliminada_en || null
            });
          });
        }

        // Si no hay registros explícitos en not_registro para el usuario, sintetizar la notificación activa si la postulación está activa y no cancelada
        const { data: miSol } = await client
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .select("ssc_id, ssc_estado, ssc_actualizado_en, ssc_creado_en, trq_revision_solicitud(*)")
          .eq("ssc_usuario_id", perfil.usu_id)
          .is("ssc_eliminado_en", null)
          .not("ssc_estado", "in", '("cancelada","rechazada","inactiva")')
          .maybeSingle();

        if (miSol && miSol.ssc_estado !== "cancelada" && miSol.ssc_estado !== "rechazada") {
          const revs = (miSol.trq_revision_solicitud ?? []) as Array<{ rev_id: string; rev_decision: string; rev_comentario?: string | null; rev_creado_en: string }>;
          revs.sort((a, b) => new Date(b.rev_creado_en).getTime() - new Date(a.rev_creado_en).getTime());

          if (revs.length > 0 && revs[0] && miSol.ssc_estado === "aceptada") {
            const ultimaRev = revs[0];
            const esAprobada = ultimaRev.rev_decision === "aceptada";
            const titulo = esAprobada
              ? "¡Tu Acreditación como Socio Abogado fue APROBADA!"
              : "Observación en tu Solicitud de Socio Abogado";
            const cuerpo = esAprobada
              ? `<p>Tu postulación ha sido aprobada. Por favor <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">descarga tu contrato pre-llenado y súbelo firmado</a> para activar tu cuenta de Abogado.</p>`
              : `<p>${ultimaRev.rev_comentario || "Se identificaron observaciones en tu solicitud. Por favor revisa y actualiza los documentos."}</p>`;

            const synthId = ultimaRev.rev_id || `sol-rev-${miSol.ssc_id}`;
            const yaExiste = registrosClavesVistas.has(synthId) || notificaciones.some(n => n.not_id === synthId || n.not_titulo.includes(titulo));
            if (!yaExiste) {
              notificaciones.unshift({
                not_id: synthId,
                not_titulo: titulo,
                not_contenido_html: cuerpo,
                not_url_accion: "/panel/solicitud-socio",
                not_leido_en: null,
                not_creado_en: ultimaRev.rev_creado_en || miSol.ssc_actualizado_en || miSol.ssc_creado_en,
                not_canal: "IN_APP",
                not_eliminada: false
              });
            }
          }
        }


      } catch (errApi) {
        console.error("Error al consultar notificaciones en API:", errApi);
      }
    }

    // Incluir campañas de transmisión (TODOS) activas
    const campanas = obtenerCampanasServidor();
    campanas.forEach(c => {
      if (!notificaciones.some(n => n.not_id === c.id)) {
        const perfilTarget = perfil || { usu_correo: "usuario@tranqi24.com", usu_nombres: "Usuario" };
        notificaciones.push({
          not_id: c.id,
          not_titulo: interpolarParaPerfil(c.asunto, perfilTarget),
          not_contenido_html: interpolarParaPerfil(c.contenidoHTML || `<p>${c.asunto}</p>`, perfilTarget),
          not_url_accion: "/panel",
          not_leido_en: null,
          not_creado_en: new Date().toISOString(),
          not_canal: (c.canales && c.canales.includes("PUSH")) ? "PUSH" : "IN_APP",
          not_eliminada: false
        });
      }
    });

    return NextResponse.json({ success: true, notificaciones });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener notificaciones";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { not_id, accion, horas, titulo, contenido_html, url_accion } = body;

    const nombreActor = [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || perfil.usu_correo;
    const actorInfo = {
      usuario_id: perfil.usu_id,
      usuario_nombre: nombreActor,
      usuario_correo: perfil.usu_correo,
      fecha: new Date().toISOString()
    };

    let client = null;
    try {
      client = crearClienteAdmin();
    } catch (err) {
      console.warn("[notificaciones] Error creando cliente admin:", err);
      client = null;
    }
    if (!client) {
      client = await crearClienteServidor();
    }

    if (accion === "eliminar_todas") {
      limpiarCampanasServidor();
      const ahora = new Date().toISOString();
      try {
        await (client as any)
          .schema("comun_notificacion")
          .from("not_registro")
          .update({
            not_leido_en: ahora,
            not_detalles: { eliminada: true, eliminada_en: ahora, eliminada_por: actorInfo }
          })
          .eq("not_usuario_id", perfil.usu_id);
      } catch (errClear) {
        console.warn("Aviso al limpiar notificaciones en BDD:", errClear);
      }
      return NextResponse.json({ success: true, accion: "eliminar_todas" });
    }

    if (!not_id || !accion) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const esUUIDValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(not_id);

    // 1. Verificar si el registro existe en comun_notificacion.not_registro para este usuario
    let queryExistente = client
      .schema("comun_notificacion")
      .from("not_registro")
      .select("not_id, not_detalles, not_leido_en");

    if (esUUIDValido) {
      queryExistente = queryExistente.eq("not_id", not_id);
    } else {
      queryExistente = queryExistente
        .eq("not_usuario_id", perfil.usu_id)
        .contains("not_detalles", { clave_original: not_id });
    }

    const { data: registroExistente } = await queryExistente.maybeSingle();

    const ahora = new Date().toISOString();
    const detallesActuales = (registroExistente?.not_detalles as Record<string, unknown>) || {};

    if (registroExistente) {
      let nuevosDetalles = { ...detallesActuales };
      let nuevoLeidoEn = registroExistente.not_leido_en;

      if (accion === "aceptar") {
        nuevoLeidoEn = ahora;
        nuevosDetalles = {
          ...nuevosDetalles,
          confirmada_por: actorInfo,
          confirmada_en: ahora,
          confirmada_usuario_id: perfil.usu_id,
          confirmada_usuario_nombre: nombreActor
        };
      } else if (accion === "eliminar") {
        nuevosDetalles = {
          ...nuevosDetalles,
          eliminada: true,
          eliminada_en: ahora,
          eliminada_por: actorInfo,
          eliminada_usuario_id: perfil.usu_id,
          eliminada_usuario_nombre: nombreActor
        };
        if (!nuevoLeidoEn) nuevoLeidoEn = ahora;
      } else if (accion === "restaurar") {
        nuevosDetalles = {
          ...nuevosDetalles,
          eliminada: false,
          restaurada_en: ahora,
          restaurada_por: actorInfo,
          restaurada_usuario_id: perfil.usu_id,
          restaurada_usuario_nombre: nombreActor
        };
      } else if (accion === "posponer") {
        const horasNum = Number(horas) || 3;
        const fechaPospuesta = new Date(Date.now() + horasNum * 3600 * 1000).toISOString();
        nuevosDetalles = {
          ...nuevosDetalles,
          pospuesta_hasta: fechaPospuesta,
          pospuesta_horas: horasNum,
          pospuesta_en: ahora,
          pospuesta_por: actorInfo,
          pospuesta_usuario_id: perfil.usu_id,
          pospuesta_usuario_nombre: nombreActor
        };
      }

      await (client as any)
        .schema("comun_notificacion")
        .from("not_registro")
        .update({
          not_leido_en: nuevoLeidoEn,
          not_detalles: nuevosDetalles
        })
        .eq("not_id", registroExistente.not_id);

    } else {
      let detallesInsertar: Record<string, unknown> = {};
      let leidoEnInsertar: string | null = null;

      if (accion === "aceptar") {
        leidoEnInsertar = ahora;
        detallesInsertar = { confirmada_por: actorInfo, confirmada_en: ahora, confirmada_usuario_id: perfil.usu_id, confirmada_usuario_nombre: nombreActor };
      } else if (accion === "eliminar") {
        detallesInsertar = { eliminada: true, eliminada_en: ahora, eliminada_por: actorInfo, eliminada_usuario_id: perfil.usu_id, eliminada_usuario_nombre: nombreActor };
        leidoEnInsertar = ahora;
      } else if (accion === "restaurar") {
        detallesInsertar = { eliminada: false, restaurada_en: ahora, restaurada_por: actorInfo, restaurada_usuario_id: perfil.usu_id, restaurada_usuario_nombre: nombreActor };
      } else if (accion === "posponer") {
        const horasNum = Number(horas) || 3;
        const fechaPospuesta = new Date(Date.now() + horasNum * 3600 * 1000).toISOString();
        detallesInsertar = {
          pospuesta_hasta: fechaPospuesta,
          pospuesta_horas: horasNum,
          pospuesta_en: ahora,
          pospuesta_por: actorInfo,
          pospuesta_usuario_id: perfil.usu_id,
          pospuesta_usuario_nombre: nombreActor
        };
      }

      const esUUIDValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(not_id);

      const filaInsertar: Record<string, unknown> = {
        not_usuario_id: perfil.usu_id,
        not_negocio: "TRANQ",
        not_canal: "IN_APP",
        not_titulo: titulo || "Notificación de Sistema",
        not_contenido_html: contenido_html || "<p>Notificación</p>",
        not_url_accion: url_accion || "/panel",
        not_leido_en: leidoEnInsertar,
        not_detalles: { ...detallesInsertar, clave_original: not_id },
        not_creado_en: ahora
      };

      if (esUUIDValido) {
        filaInsertar.not_id = not_id;
      }

      try {
        await (client as any)
          .schema("comun_notificacion")
          .from("not_registro")
          .insert(filaInsertar);
      } catch (errInsert) {
        console.warn("Aviso al insertar not_registro en POST:", errInsert);
      }
    }

    return NextResponse.json({ success: true, not_id, accion, actor: actorInfo });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar la acción";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    limpiarCampanasServidor();

    let client = null;
    try {
      client = crearClienteAdmin();
    } catch {
      client = null;
    }
    if (!client) {
      client = await crearClienteServidor();
    }

    if (client) {
      const ahora = new Date().toISOString();
      try {
        await (client as any)
          .schema("comun_notificacion")
          .from("not_registro")
          .update({
            not_leido_en: ahora,
            not_detalles: { eliminada: true, eliminada_en: ahora }
          })
          .eq("not_usuario_id", perfil.usu_id);
      } catch (errDel) {
        console.warn("Aviso al eliminar notificaciones:", errDel);
      }
    }

    return NextResponse.json({ success: true, message: "Todas las notificaciones han sido eliminadas." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al eliminar notificaciones";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

