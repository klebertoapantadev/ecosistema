import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { enviarCorreo } from "./enviar-correo";

export interface ParametrosNuevoUsuarioNotif {
  usuarioId: string;
  nombres?: string | null;
  apellidos?: string | null;
  correo: string;
  negocio: string;
}

export async function notificarNuevoUsuarioRegistrado(params: ParametrosNuevoUsuarioNotif): Promise<void> {
  try {
    const adminSupabase = crearClienteAdmin() || await crearClienteServidor();
    const nombreCompleto = [params.nombres, params.apellidos].filter(Boolean).join(" ") || params.correo;
    const negocioSlug = params.negocio || "tranqi";
    const negocioUpper = (negocioSlug === "tranqi" || negocioSlug === "TRANQI") ? "TRANQ" : negocioSlug.toUpperCase();
    const titulo = `👤 Nuevo Usuario Registrado: ${nombreCompleto}`;
    const urlAccion = `/panel/usuarios?buscar=${encodeURIComponent(params.correo)}`;

    const contenidoHTML = `
      <div style="font-family: sans-serif; padding: 16px; color: #111;">
        <h3 style="color: #5000BA; margin-top: 0;">👤 Nuevo Usuario Registrado</h3>
        <p>El usuario <strong>${nombreCompleto}</strong> (<code>${params.correo}</code>) se ha registrado exitosamente en la plataforma <strong>${negocioUpper}</strong>.</p>
        <p><a href="${urlAccion}" style="display: inline-block; padding: 10px 18px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Ver Datos del Usuario</a></p>
      </div>
    `;

    // 1. Obtener usuarios con perfil Operador, Administrador o SuperAdmin en el negocio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: todosUsuarios } = await (adminSupabase as any)
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select(`
        usu_id,
        usu_correo,
        usu_superadmin_plataforma,
        seg_membresia (
          mem_id,
          mem_negocio,
          seg_membresia_perfil (
            mpe_perfil_clave
          )
        )
      `);

    const destinatarios: { id: string; correo: string }[] = [];
    const correosVistos = new Set<string>();

    if (Array.isArray(todosUsuarios)) {
      for (const u of todosUsuarios) {
        if (u.usu_id === params.usuarioId) continue;
        const esSuper = Boolean(u.usu_superadmin_plataforma);
        let esStaff = esSuper;

        if (!esStaff && Array.isArray(u.seg_membresia)) {
          for (const m of u.seg_membresia) {
            const mNeg = (m.mem_negocio || "").toUpperCase();
            if (mNeg === negocioUpper || mNeg === "TRANQ" || mNeg === "TRANQI") {
              if (Array.isArray(m.seg_membresia_perfil)) {
                for (const mp of m.seg_membresia_perfil) {
                  const clave = (mp.mpe_perfil_clave || "").toUpperCase();
                  if (clave === "OPERADOR" || clave === "ADMINISTRADOR" || clave === "SUPERADMIN") {
                    esStaff = true;
                    break;
                  }
                }
              }
            }
            if (esStaff) break;
          }
        }

        if (esStaff && u.usu_correo && !correosVistos.has(u.usu_correo)) {
          correosVistos.add(u.usu_correo);
          destinatarios.push({ id: u.usu_id, correo: u.usu_correo });
        }
      }
    }

    if (destinatarios.length === 0) return;

    // 2. Insertar registros In-App y Push en comun_notificacion.not_registro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notifs: any[] = [];
    for (const d of destinatarios) {
      notifs.push({
        not_usuario_id: d.id,
        not_negocio: negocioUpper,
        not_canal: "IN_APP",
        not_titulo: titulo,
        not_contenido_html: contenidoHTML,
        not_url_accion: urlAccion,
        not_creado_en: new Date().toISOString()
      });
      notifs.push({
        not_usuario_id: d.id,
        not_negocio: negocioUpper,
        not_canal: "PUSH",
        not_titulo: titulo,
        not_contenido_html: contenidoHTML,
        not_url_accion: urlAccion,
        not_creado_en: new Date().toISOString()
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .schema("comun_notificacion")
      .from("not_registro")
      .insert(notifs);

    // 3. Enviar correo SMTP a cada operador/admin
    for (const d of destinatarios) {
      try {
        await enviarCorreo({
          negocio: params.negocio,
          para: d.correo,
          asunto: titulo,
          html: contenidoHTML,
        });
      } catch (errEnv) {
        console.warn("Aviso al enviar correo a operador/admin:", errEnv);
      }
    }
  } catch (err) {
    console.warn("Error en notificarNuevoUsuarioRegistrado:", err);
  }
}
