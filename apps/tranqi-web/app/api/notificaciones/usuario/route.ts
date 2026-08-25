import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@eco/identidad";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerCampanasServidor } from "../almacen";

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
        const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com" || correo === "satcomla.ti@gmail.com";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = crearClienteAdmin() || await crearClienteServidor();

        // Consultar membresía directa para asegurar que rol OPERADOR/ADMINISTRADOR esté siempre detectado
        const { data: memUser } = await client
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_rol, mem_estado")
          .eq("mem_usuario_id", perfil.usu_id)
          .eq("mem_estado", "ACTIVO");

        const rolesMembresia = ((memUser || []) as Array<{ mem_rol?: string | null }>).map(m => (m.mem_rol || "").toUpperCase());
        const esStaffMembresia = rolesMembresia.includes("OPERADOR") || rolesMembresia.includes("ADMINISTRADOR") || rolesMembresia.includes("SUPERADMIN") || rolesMembresia.includes("AUXILIAR");
        const esAutorizado = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR") || perfiles.includes("SUPERADMIN") || esStaffMembresia;

        let query = client
          .schema("comun_notificacion")
          .from("not_registro")
          .select("not_id, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_creado_en, not_canal, not_detalles")
          .order("not_creado_en", { ascending: false })
          .limit(100);

        if (!esAutorizado) {
          query = query.eq("not_usuario_id", perfil.usu_id);
        } else {
          query = query.or(`not_usuario_id.eq.${perfil.usu_id},not_negocio.eq.TRANQ`);
        }

        const { data: registros } = await query;

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

            notificaciones.push({
              not_id: r.not_id,
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

        // Si no hay registros explícitos en not_registro para el usuario, sintetizar la notificación activa más reciente de su postulación
        const { data: miSol } = await client
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .select("ssc_id, ssc_estado, ssc_actualizado_en, ssc_creado_en, trq_revision_solicitud(*)")
          .eq("ssc_usuario_id", perfil.usu_id)
          .is("ssc_eliminado_en", null)
          .maybeSingle();

        if (miSol) {
          const revs = (miSol.trq_revision_solicitud ?? []) as Array<{ rev_id: string; rev_decision: string; rev_comentario?: string | null; rev_creado_en: string }>;
          revs.sort((a, b) => new Date(b.rev_creado_en).getTime() - new Date(a.rev_creado_en).getTime());

          if (revs.length > 0 && revs[0]) {
            const ultimaRev = revs[0];
            const esAprobada = ultimaRev.rev_decision === "aceptada";
            const titulo = esAprobada
              ? "¡Tu Acreditación como Socio Abogado fue APROBADA!"
              : "Observación en tu Solicitud de Socio Abogado";
            const cuerpo = esAprobada
              ? `<p>Tu postulación ha sido aprobada. Por favor <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">descarga tu contrato pre-llenado y súbelo firmado</a> para activar tu cuenta de Abogado.</p>`
              : `<p>${ultimaRev.rev_comentario || "Se identificaron observaciones en tu solicitud. Por favor revisa y actualiza los documentos."}</p>`;

            const synthId = ultimaRev.rev_id || `sol-rev-${miSol.ssc_id}`;
            const yaExiste = notificaciones.some(n => n.not_id === synthId || n.not_titulo.includes(titulo));
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

        // Si el usuario es administrador u operador, sintetizar alertas para nuevas postulaciones, propuestas y contratos pendientes
        if (esAutorizado) {
          try {
            // 1. Nuevas postulaciones de socio abogado recibidas y pendientes de evaluación
            const { data: solicitudesPendientes } = await client
              .schema("tranqui_legal")
              .from("trq_solicitud_socio")
              .select("ssc_id, ssc_usuario_id, ssc_estado, ssc_actualizado_en, ssc_creado_en")
              .in("ssc_estado", ["enviada", "pendiente", "revision"])
              .is("ssc_eliminado_en", null)
              .order("ssc_creado_en", { ascending: false });

            if (solicitudesPendientes && Array.isArray(solicitudesPendientes)) {
              for (const sol of solicitudesPendientes) {
                const { data: uPost } = await client
                  .schema("comun_seguridad")
                  .from("seg_usuario")
                  .select("usu_nombres, usu_apellidos, usu_correo")
                  .eq("usu_id", sol.ssc_usuario_id)
                  .maybeSingle();

                const nombrePost = [uPost?.usu_nombres, uPost?.usu_apellidos].filter(Boolean).join(" ") || uPost?.usu_correo || "Postulante";
                const titulo = `Nueva Postulación de Socio Abogado: ${nombrePost}`;
                const synthSolId = `postulacion-${sol.ssc_id}`;
                const yaExiste = notificaciones.some(n => n.not_id === synthSolId || n.not_titulo.includes(nombrePost));
                if (!yaExiste) {
                  notificaciones.unshift({
                    not_id: synthSolId,
                    not_titulo: titulo,
                    not_contenido_html: `<p>El profesional <strong>${nombrePost}</strong> (<code>${uPost?.usu_correo || ""}</code>) ha registrado una postulación como Socio Abogado en tranqi. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #5000BA; font-weight: 700;">Evaluar Solicitud de Socio</a> para revisar su matrícula y registro SENESCYT.</p>`,
                    not_url_accion: `/panel/socios/${sol.ssc_id}`,
                    not_leido_en: null,
                    not_creado_en: sol.ssc_actualizado_en || sol.ssc_creado_en || new Date().toISOString(),
                    not_canal: "IN_APP",
                    not_eliminada: false
                  });
                }
              }
            }

            // 2. Alertas para contratos firmados recibidos y propuestas de modificación
            const { data: solicitudesConDocs } = await client
              .schema("tranqui_legal")
              .from("trq_solicitud_socio")
              .select(`
                ssc_id,
                ssc_usuario_id,
                ssc_estado,
                ssc_actualizado_en,
                trq_documento_socio (dcs_tipo, dcs_comentario, dcs_creado_en)
              `)
              .is("ssc_eliminado_en", null)
              .order("ssc_actualizado_en", { ascending: false });

            if (solicitudesConDocs && Array.isArray(solicitudesConDocs)) {
              for (const sol of solicitudesConDocs) {
                const docs = (sol.trq_documento_socio || []) as Array<{ dcs_tipo: string; dcs_comentario?: string; dcs_creado_en: string }>;
                const tieneContrato = docs.some(d => d.dcs_tipo === "contrato_socio" || d.dcs_comentario?.includes("[tipo:contrato_socio]"));
                const tienePropuesta = docs.some(d => d.dcs_comentario?.includes("[PROPUESTA_MODIFICACION_CONTRATO]"));

                if (tieneContrato || tienePropuesta) {
                  const { data: uPost } = await client
                    .schema("comun_seguridad")
                    .from("seg_usuario")
                    .select("usu_nombres, usu_apellidos, usu_correo")
                    .eq("usu_id", sol.ssc_usuario_id)
                    .maybeSingle();

                  const nombrePost = [uPost?.usu_nombres, uPost?.usu_apellidos].filter(Boolean).join(" ") || uPost?.usu_correo || "Postulante";

                  if (tieneContrato) {
                    const tituloContrato = `Contrato Firmado Recibido — Postulante: ${nombrePost}`;
                    const synthContratoId = `contrato-${sol.ssc_id}`;
                    const yaExiste = notificaciones.some(n => n.not_id === synthContratoId);
                    if (!yaExiste) {
                      notificaciones.unshift({
                        not_id: synthContratoId,
                        not_titulo: tituloContrato,
                        not_contenido_html: `<p>El postulante <strong>${nombrePost}</strong> ha subido su contrato firmado. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #05876E; font-weight: 700;">Verificar Contrato y Activar Socio</a> para completar su incorporación.</p>`,
                        not_url_accion: `/panel/socios/${sol.ssc_id}`,
                        not_leido_en: null,
                        not_creado_en: sol.ssc_actualizado_en || new Date().toISOString(),
                        not_canal: "IN_APP",
                        not_eliminada: false
                      });
                    }
                  }

                  if (tienePropuesta) {
                    const tituloPropuesta = `Propuesta de Modificación al Contrato — Postulante: ${nombrePost}`;
                    const synthPropuestaId = `propuesta-${sol.ssc_id}`;
                    const yaExiste = notificaciones.some(n => n.not_id === synthPropuestaId);
                    if (!yaExiste) {
                      notificaciones.unshift({
                        not_id: synthPropuestaId,
                        not_titulo: tituloPropuesta,
                        not_contenido_html: `<p>El postulante <strong>${nombrePost}</strong> ha enviado una propuesta de cambios al contrato en formato Word. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #D97706; font-weight: 700;">Revisar Propuesta</a>.</p>`,
                        not_url_accion: `/panel/socios/${sol.ssc_id}`,
                        not_leido_en: null,
                        not_creado_en: sol.ssc_actualizado_en || new Date().toISOString(),
                        not_canal: "IN_APP",
                        not_eliminada: false
                      });
                    }
                  }
                }
              }
            }
          } catch (errStaffSync) {
            console.warn("Aviso en sync staff notificaciones:", errStaffSync);
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

    if (!not_id || !accion) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const nombreActor = [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || perfil.usu_correo;
    const actorInfo = {
      usuario_id: perfil.usu_id,
      usuario_nombre: nombreActor,
      usuario_correo: perfil.usu_correo,
      fecha: new Date().toISOString()
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = crearClienteAdmin() || await crearClienteServidor();

    // 1. Verificar si el registro existe en comun_notificacion.not_registro
    const { data: registroExistente } = await client
      .schema("comun_notificacion")
      .from("not_registro")
      .select("not_id, not_detalles, not_leido_en")
      .eq("not_id", not_id)
      .maybeSingle();

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

      await client
        .schema("comun_notificacion")
        .from("not_registro")
        .update({
          not_leido_en: nuevoLeidoEn,
          not_detalles: nuevosDetalles
        })
        .eq("not_id", not_id);

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
        await client
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
