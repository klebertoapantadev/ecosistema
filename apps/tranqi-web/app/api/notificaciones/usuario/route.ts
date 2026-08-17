import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { obtenerCampanasServidor } from "../almacen";

interface RegistroNotificacion {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal?: string;
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
        const { crearClienteAdmin } = await import("@eco/supabase/servidor");

        const perfilesTranqi = await obtenerPerfiles("tranqi");
        const perfilesTRANQ = await obtenerPerfiles("TRANQ");
        const perfiles = Array.from(new Set([...perfilesTranqi, ...perfilesTRANQ]));
        const esAutorizado = Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = crearClienteAdmin() || await crearClienteServidor();

        let query = client
          .schema("comun_notificacion")
          .from("not_registro")
          .select("not_id, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_creado_en, not_canal")
          .order("not_creado_en", { ascending: false })
          .limit(30);

        if (!esAutorizado) {
          query = query.eq("not_usuario_id", perfil.usu_id);
        }

        const { data: registros } = await query;

        if (registros && Array.isArray(registros)) {
          (registros as unknown as RegistroNotificacion[]).forEach(r => {
            notificaciones.push({
              not_id: r.not_id,
              not_titulo: interpolarParaPerfil(r.not_titulo, perfil),
              not_contenido_html: interpolarParaPerfil(r.not_contenido_html, perfil),
              not_url_accion: r.not_url_accion || "/panel",
              not_leido_en: r.not_leido_en,
              not_creado_en: r.not_creado_en,
              not_canal: r.not_canal || "IN_APP"
            });
          });
        }

        // Obtener historial y estado de solicitud de socio propia para garantizar notificaciones de acreditación
        const { data: miSol } = await client
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .select("ssc_id, ssc_estado, ssc_actualizado_en, trq_revision_solicitud(*)")
          .eq("ssc_usuario_id", perfil.usu_id)
          .is("ssc_eliminado_en", null)
          .maybeSingle();

        if (miSol) {
          const revs = (miSol.trq_revision_solicitud ?? []) as Array<{ rev_id: string; rev_decision: string; rev_comentario?: string | null; rev_creado_en: string }>;
          revs.forEach((rev) => {
            const esAprobada = rev.rev_decision === "aceptada";
            const titulo = esAprobada
              ? "🎉 ¡Tu Acreditación como Socio Abogado fue APROBADA!"
              : "⚠️ Observación en tu Solicitud de Socio Abogado";
            const cuerpo = esAprobada
              ? `<p>Tu solicitud ha sido aprobada. Por favor <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">descarga tu contrato pre-llenado y súbelo firmado</a> para activar tu cuenta de Abogado.</p>`
              : `<p>${rev.rev_comentario || "Se identificaron observaciones en tu solicitud. Por favor revisa y actualiza los documentos."}</p>`;

            if (!notificaciones.some(n => n.not_id === rev.rev_id)) {
              notificaciones.push({
                not_id: rev.rev_id,
                not_titulo: titulo,
                not_contenido_html: cuerpo,
                not_url_accion: "/panel/solicitud-socio",
                not_leido_en: null,
                not_creado_en: rev.rev_creado_en || miSol.ssc_actualizado_en || new Date().toISOString(),
                not_canal: "IN_APP"
              });
            }
          });
        }
      } catch (errApi) {
        console.error("Error al consultar notificaciones en API:", errApi);
      }
    }

    // Incluir campañas de transmisión (TODOS) activas en la consola
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
