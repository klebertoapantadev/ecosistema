import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@eco/identidad";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerCampanasServidor } from "../almacen";

interface RegistroNotificacion {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal?: string;
  not_pospuesta_hasta?: string | null;
  not_eliminada?: boolean;
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
        const esAutorizado = Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = crearClienteAdmin() || await crearClienteServidor();

        let query = client
          .schema("comun_notificacion")
          .from("not_registro")
          .select("not_id, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_creado_en, not_canal, not_detalles")
          .order("not_creado_en", { ascending: false })
          .limit(50);

        if (!esAutorizado) {
          query = query.eq("not_usuario_id", perfil.usu_id);
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
            not_detalles?: { eliminada?: boolean; pospuesta_hasta?: string } | null;
          }>).forEach(r => {
            const detalles = r.not_detalles ?? {};
            if (detalles.eliminada) return;

            notificaciones.push({
              not_id: r.not_id,
              not_titulo: interpolarParaPerfil(r.not_titulo, perfil),
              not_contenido_html: interpolarParaPerfil(r.not_contenido_html, perfil),
              not_url_accion: r.not_url_accion || "/panel",
              not_leido_en: r.not_leido_en,
              not_creado_en: r.not_creado_en,
              not_canal: r.not_canal || "IN_APP",
              not_pospuesta_hasta: detalles.pospuesta_hasta || null,
              not_eliminada: Boolean(detalles.eliminada)
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
          // Ordenar cronológicamente descendente
          revs.sort((a, b) => new Date(b.rev_creado_en).getTime() - new Date(a.rev_creado_en).getTime());

          // Solo sintetizar la última resolución activa para evitar spam / alertas repetidas
          if (revs.length > 0 && revs[0]) {
            const ultimaRev = revs[0];
            const esAprobada = ultimaRev.rev_decision === "aceptada";
            const titulo = esAprobada
              ? "🎉 ¡Tu Acreditación como Socio Abogado fue APROBADA!"
              : "⚠️ Observación en tu Solicitud de Socio Abogado";
            const cuerpo = esAprobada
              ? `<p>Tu postulación ha sido aprobada. Por favor <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">descarga tu contrato pre-llenado y súbelo firmado</a> para activar tu cuenta de Abogado.</p>`
              : `<p>${ultimaRev.rev_comentario || "Se identificaron observaciones en tu solicitud. Por favor revisa y actualiza los documentos."}</p>`;

            const yaExiste = notificaciones.some(n => n.not_id === ultimaRev.rev_id || n.not_titulo.includes(titulo));
            if (!yaExiste) {
              notificaciones.unshift({
                not_id: ultimaRev.rev_id || `sol-rev-${miSol.ssc_id}`,
                not_titulo: titulo,
                not_contenido_html: cuerpo,
                not_url_accion: "/panel/solicitud-socio",
                not_leido_en: null,
                not_creado_en: ultimaRev.rev_creado_en || miSol.ssc_actualizado_en || miSol.ssc_creado_en,
                not_canal: "IN_APP"
              });
            }
          }
        }

        // Si el usuario es administrador u operador, sintetizar alertas para contratos firmados recibidos y postulaciones pendientes
        if (esAutorizado) {
          try {
            const { data: solicitudesConContrato } = await client
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

            if (solicitudesConContrato && Array.isArray(solicitudesConContrato)) {
              for (const sol of solicitudesConContrato) {
                const docs = (sol.trq_documento_socio || []) as Array<{ dcs_tipo: string; dcs_comentario?: string; dcs_creado_en: string }>;
                const tieneContrato = docs.some(d => d.dcs_tipo === "contrato_socio" || d.dcs_comentario?.includes("[tipo:contrato_socio]"));
                if (tieneContrato) {
                  const { data: uPost } = await client
                    .schema("comun_seguridad")
                    .from("seg_usuario")
                    .select("usu_nombres, usu_apellidos, usu_correo")
                    .eq("usu_id", sol.ssc_usuario_id)
                    .maybeSingle();

                  const nombrePost = [uPost?.usu_nombres, uPost?.usu_apellidos].filter(Boolean).join(" ") || uPost?.usu_correo || "Postulante";
                  const titulo = `📝 Contrato Firmado Recibido — Postulante: ${nombrePost}`;
                  const yaExiste = notificaciones.some(n => n.not_id === `contrato-${sol.ssc_id}` || n.not_titulo.includes(nombrePost));
                  if (!yaExiste) {
                    notificaciones.unshift({
                      not_id: `contrato-${sol.ssc_id}`,
                      not_titulo: titulo,
                      not_contenido_html: `<p>El postulante <strong>${nombrePost}</strong> ha subido su contrato firmado. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #05876E; font-weight: 700;">Verificar Contrato y Activar Socio</a> para completar su incorporación.</p>`,
                      not_url_accion: `/panel/socios/${sol.ssc_id}`,
                      not_leido_en: null,
                      not_creado_en: sol.ssc_actualizado_en || new Date().toISOString(),
                      not_canal: "IN_APP"
                    });
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
          not_canal: (c.canales && c.canales.includes("PUSH")) ? "PUSH" : "IN_APP"
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
    const { not_id, accion, horas } = body;

    if (!not_id || !accion) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = crearClienteAdmin() || await crearClienteServidor();

    if (accion === "aceptar") {
      // 1. Confirmar lectura
      await client
        .schema("comun_notificacion")
        .from("not_registro")
        .update({ not_leido_en: new Date().toISOString() })
        .eq("not_id", not_id);
    } else if (accion === "eliminar") {
      // 2. Eliminar (ocultar para el usuario, mantener para auditoría)
      await client
        .schema("comun_notificacion")
        .from("not_registro")
        .update({
          not_detalles: { eliminada: true, eliminada_en: new Date().toISOString() },
          not_leido_en: new Date().toISOString()
        })
        .eq("not_id", not_id);
    } else if (accion === "posponer") {
      // 3. Posponer por N horas
      const horasNum = Number(horas) || 3;
      const fechaPospuesta = new Date(Date.now() + horasNum * 3600 * 1000).toISOString();
      await client
        .schema("comun_notificacion")
        .from("not_registro")
        .update({
          not_detalles: { pospuesta_hasta: fechaPospuesta, pospuesta_horas: horasNum }
        })
        .eq("not_id", not_id);
    }

    return NextResponse.json({ success: true, not_id, accion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar la acción";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
