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
  es_propuesta_rol?: boolean;
  rol_propuesto?: string;
  rol_nombre?: string;
  solicitado_por_nombre?: string;
  solicitado_por_correo?: string;
  solicitado_en?: string;
  estado_propuesta?: "pendiente_aceptacion" | "aceptado" | "rechazado";
}

interface PropuestaCambioRolPersistida {
  id: string;
  rolClave: string;
  rolNombre: string;
  negocio: string;
  estado: "pendiente_aceptacion" | "aceptado" | "rechazado";
  solicitadoPorId?: string | null;
  solicitadoPorNombre: string;
  solicitadoPorCorreo: string;
  solicitadoEn: string;
  respondidoEn?: string | null;
  esConversionAbogado?: boolean;
  abogadoId?: string | null;
  especialidadesNombres?: string[];
  provinciasNombres?: string[];
}

interface NotificacionBandejaPersistida {
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
  es_propuesta_rol?: boolean;
  rol_propuesto?: string;
  rol_nombre?: string;
  solicitado_por_nombre?: string;
  solicitado_por_correo?: string;
  solicitado_en?: string;
  estado_propuesta?: "pendiente_aceptacion" | "aceptado" | "rechazado";
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

        // 0. Leer bandeja persistente y propuestas de cambio de rol desde comun_seguridad.seg_usuario.usu_detalle_usuario
        try {
          const { data: usuDetalleRow } = await client
            .schema("comun_seguridad")
            .from("seg_usuario")
            .select("usu_detalle_usuario")
            .eq("usu_id", perfil.usu_id)
            .maybeSingle();

          const detUsu = (usuDetalleRow?.usu_detalle_usuario || {}) as Record<string, any>;
          const bandejaPersistida: NotificacionBandejaPersistida[] = Array.isArray(detUsu.notificaciones_bandeja)
            ? detUsu.notificaciones_bandeja
            : [];
          const propuestasRol: PropuestaCambioRolPersistida[] = Array.isArray(detUsu.propuestas_cambio_rol)
            ? detUsu.propuestas_cambio_rol
            : [];

          // Incluir primero las propuestas de cambio de rol pendientes o procesadas
          for (const prop of propuestasRol) {
            if (!prop || !prop.id) continue;
            const notifEnBandeja = bandejaPersistida.find((b) => b.not_id === prop.id);
            if (notifEnBandeja?.not_eliminada) continue;

            const fechaFormateada = new Date(prop.solicitadoEn || Date.now()).toLocaleString("es-EC", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Guayaquil",
            });

            const espHtml =
              Array.isArray(prop.especialidadesNombres) && prop.especialidadesNombres.length > 0
                ? `<br/><strong>⚖️ Especialidades:</strong> ${prop.especialidadesNombres.join(", ")}`
                : "";
            const provHtml =
              Array.isArray(prop.provinciasNombres) && prop.provinciasNombres.length > 0
                ? `<br/><strong>📍 Cobertura:</strong> ${prop.provinciasNombres.join(", ")}`
                : "";

            const estadoBadgeHtml =
              prop.estado === "aceptado"
                ? `<span style="display:inline-block;margin-top:6px;padding:3px 8px;border-radius:999px;background:#ECFDF5;color:#065F46;font-weight:800;font-size:11px;">✅ Rol Aceptado el ${new Date(prop.respondidoEn || Date.now()).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guayaquil" })}</span>`
                : prop.estado === "rechazado"
                ? `<span style="display:inline-block;margin-top:6px;padding:3px 8px;border-radius:999px;background:#FEF2F2;color:#991B1B;font-weight:800;font-size:11px;">❌ Rol Rechazado</span>`
                : `<span style="display:inline-block;margin-top:6px;padding:3px 8px;border-radius:999px;background:#FEF3C7;color:#92400E;font-weight:800;font-size:11px;">⏳ Requiere tu confirmación para activar el rol</span>`;

            const tituloProp =
              prop.estado === "aceptado"
                ? `✅ Nuevo Rol Activado: ${prop.rolNombre || prop.rolClave}`
                : prop.estado === "rechazado"
                ? `❌ Asignación de Rol Rechazada: ${prop.rolNombre || prop.rolClave}`
                : `🛡️ Confirmación de Nuevo Rol: ${prop.rolNombre || prop.rolClave}`;

            const htmlProp = `
              <div>
                <p style="margin: 0 0 6px 0;">
                  La plataforma está agregando el rol <strong>${prop.rolNombre || prop.rolClave}</strong> a tu cuenta en <strong>Tranqi</strong>.
                </p>
                <div style="font-size: 0.78rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px; margin: 6px 0;">
                  <strong>👤 Agregado por:</strong> ${prop.solicitadoPorNombre || "Administrador"} (${prop.solicitadoPorCorreo || "admin@tranqi24.com"})<br/>
                  <strong>📅 Fecha de solicitud:</strong> ${fechaFormateada}
                  ${espHtml}
                  ${provHtml}
                </div>
                ${estadoBadgeHtml}
              </div>
            `;

            registrosClavesVistas.add(prop.id);
            notificaciones.push({
              not_id: prop.id,
              not_titulo: tituloProp,
              not_contenido_html: htmlProp,
              not_url_accion: "/panel",
              not_leido_en:
                prop.estado === "pendiente_aceptacion"
                  ? null
                  : prop.respondidoEn || notifEnBandeja?.not_leido_en || new Date().toISOString(),
              not_creado_en: prop.solicitadoEn || new Date().toISOString(),
              not_canal: "PUSH",
              not_pospuesta_hasta: notifEnBandeja?.not_pospuesta_hasta || null,
              not_pospuesta_horas: notifEnBandeja?.not_pospuesta_horas || null,
              not_eliminada: Boolean(notifEnBandeja?.not_eliminada),
              not_eliminada_en: notifEnBandeja?.not_eliminada_en || null,
              es_propuesta_rol: true,
              rol_propuesto: prop.rolClave,
              rol_nombre: prop.rolNombre || prop.rolClave,
              solicitado_por_nombre: prop.solicitadoPorNombre,
              solicitado_por_correo: prop.solicitadoPorCorreo,
              solicitado_en: prop.solicitadoEn,
              estado_propuesta: prop.estado,
            });
          }

          // Incluir el resto de notificaciones de la bandeja persistida en usu_detalle_usuario
          for (const itemBandeja of bandejaPersistida) {
            if (!itemBandeja || !itemBandeja.not_id || registrosClavesVistas.has(itemBandeja.not_id)) continue;
            registrosClavesVistas.add(itemBandeja.not_id);
            notificaciones.push({
              ...itemBandeja,
              not_titulo: interpolarParaPerfil(itemBandeja.not_titulo, perfil),
              not_contenido_html: interpolarParaPerfil(itemBandeja.not_contenido_html, perfil),
            });
          }
        } catch (errBandeja) {
          console.warn("Aviso al leer bandeja en usu_detalle_usuario:", errBandeja);
        }

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
        const { data: uRow } = await (client as any)
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_detalle_usuario")
          .eq("usu_id", perfil.usu_id)
          .maybeSingle();
        const det = (uRow?.usu_detalle_usuario || {}) as Record<string, any>;
        const bandeja: NotificacionBandejaPersistida[] = Array.isArray(det.notificaciones_bandeja)
          ? det.notificaciones_bandeja
          : [];
        const bandejaMarcada = bandeja.map((b) => ({
          ...b,
          not_eliminada: true,
          not_eliminada_en: ahora,
          not_leido_en: b.not_leido_en || ahora,
        }));
        await (client as any)
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({
            usu_detalle_usuario: {
              ...det,
              notificaciones_bandeja: bandejaMarcada,
            },
            usu_actualizado_en: ahora,
          })
          .eq("usu_id", perfil.usu_id);
      } catch {
        // Ignorar
      }
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

    const ahora = new Date().toISOString();
    let rolActivadoConExito: string | null = null;

    // 0. Sincronizar estado en comun_seguridad.seg_usuario.usu_detalle_usuario (bandeja y propuestas de cambio de rol)
    try {
      const { data: uRow } = await (client as any)
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", perfil.usu_id)
        .maybeSingle();

      const det = (uRow?.usu_detalle_usuario || {}) as Record<string, any>;
      const bandeja: NotificacionBandejaPersistida[] = Array.isArray(det.notificaciones_bandeja)
        ? [...det.notificaciones_bandeja]
        : [];
      const propuestas: PropuestaCambioRolPersistida[] = Array.isArray(det.propuestas_cambio_rol)
        ? [...det.propuestas_cambio_rol]
        : [];
      let fichaAbogado = (det.ficha_abogado ? { ...det.ficha_abogado } : null) as Record<string, any> | null;

      const idxProp = propuestas.findIndex((p) => p && p.id === not_id);
      if (idxProp >= 0) {
        const prop = { ...propuestas[idxProp]! };

        if (accion === "aceptar" || accion === "aceptar_rol") {
          prop.estado = "aceptado";
          prop.respondidoEn = ahora;
          propuestas[idxProp] = prop;
          rolActivadoConExito = prop.rolClave;

          // Activar el rol en seg_membresia y seg_membresia_perfil
          const rolUpper = String(prop.rolClave || "ABOGADO").toUpperCase().trim();
          const { data: perfRow } = await (client as any)
            .schema("comun_seguridad")
            .from("seg_perfil")
            .select("per_id, per_clave, per_nivel")
            .eq("per_clave", rolUpper)
            .maybeSingle();

          const { data: perfCli } = await (client as any)
            .schema("comun_seguridad")
            .from("seg_perfil")
            .select("per_id")
            .eq("per_clave", "CLIENTE")
            .maybeSingle();

          const { data: mems } = await (client as any)
            .schema("comun_seguridad")
            .from("seg_membresia")
            .select("mem_id, mem_negocio, mem_rol")
            .eq("mem_usuario_id", perfil.usu_id);

          const memsTranqi = (mems || []).filter((m: { mem_negocio?: string }) =>
            (m.mem_negocio || "").toUpperCase().startsWith("TRANQ")
          );

          if (memsTranqi.length === 0) {
            for (const negClave of ["tranqi", "TRANQ"]) {
              const { data: nuevaMem } = await (client as any)
                .schema("comun_seguridad")
                .from("seg_membresia")
                .insert({
                  mem_usuario_id: perfil.usu_id,
                  mem_negocio: negClave,
                  mem_rol: rolUpper,
                  mem_estado: "ACTIVO",
                })
                .select("mem_id, mem_negocio, mem_rol")
                .maybeSingle();
              if (nuevaMem) memsTranqi.push(nuevaMem);
            }
          }

          for (const mem of memsTranqi) {
            if (perfCli?.per_id) {
              await (client as any)
                .schema("comun_seguridad")
                .from("seg_membresia_perfil")
                .upsert(
                  {
                    mpe_membresia_id: mem.mem_id,
                    mpe_perfil_id: perfCli.per_id,
                    mpe_asignado_por: prop.solicitadoPorId || perfil.usu_id,
                    mpe_actualizado_en: ahora,
                  },
                  { onConflict: "mpe_membresia_id,mpe_perfil_id" }
                );
            }
            if (perfRow?.per_id) {
              await (client as any)
                .schema("comun_seguridad")
                .from("seg_membresia_perfil")
                .upsert(
                  {
                    mpe_membresia_id: mem.mem_id,
                    mpe_perfil_id: perfRow.per_id,
                    mpe_asignado_por: prop.solicitadoPorId || perfil.usu_id,
                    mpe_actualizado_en: ahora,
                  },
                  { onConflict: "mpe_membresia_id,mpe_perfil_id" }
                );
            }

            // Sincronizar mem_rol con el perfil de mayor jerarquía
            const { data: mpList } = await (client as any)
              .schema("comun_seguridad")
              .from("seg_membresia_perfil")
              .select("seg_perfil(per_clave, per_nivel)")
              .eq("mpe_membresia_id", mem.mem_id);

            const perfilesOrdenados = ((mpList || []) as any[])
              .map((x) => x.seg_perfil)
              .filter(Boolean)
              .sort((a, b) => b.per_nivel - a.per_nivel);

            const rolMayor = perfilesOrdenados[0]?.per_clave || rolUpper;

            await (client as any)
              .schema("comun_seguridad")
              .from("seg_membresia")
              .update({
                mem_rol: rolMayor,
                mem_estado: "ACTIVO",
                mem_actualizado_en: ahora,
              })
              .eq("mem_id", mem.mem_id);
          }

          // Si la propuesta corresponde a Socio Abogado, activar trq_abogado y actualizar ficha_abogado
          if (rolUpper === "ABOGADO" || prop.esConversionAbogado) {
            await (client as any)
              .schema("tranqui_legal")
              .from("trq_abogado")
              .update({
                abg_estado: "verificado",
                abg_verificado_en: ahora,
                abg_actualizado_en: ahora,
              })
              .eq("abg_usuario_id", perfil.usu_id);

            if (fichaAbogado) {
              fichaAbogado = {
                ...fichaAbogado,
                estado_aceptacion: "aceptado",
                aceptado_en: ahora,
                actualizado_en: ahora,
              };
            }
          }
        } else if (accion === "rechazar_rol") {
          prop.estado = "rechazado";
          prop.respondidoEn = ahora;
          propuestas[idxProp] = prop;

          if (String(prop.rolClave || "").toUpperCase() === "ABOGADO" || prop.esConversionAbogado) {
            await (client as any)
              .schema("tranqui_legal")
              .from("trq_abogado")
              .update({
                abg_estado: "suspendido",
                abg_actualizado_en: ahora,
              })
              .eq("abg_usuario_id", perfil.usu_id);

            if (fichaAbogado) {
              fichaAbogado = {
                ...fichaAbogado,
                estado_aceptacion: "rechazado",
                rechazado_en: ahora,
                actualizado_en: ahora,
              };
            }
          }
        }
      }

      // Actualizar estado de la notificación en bandeja
      const idxBandeja = bandeja.findIndex((b) => b && b.not_id === not_id);
      if (idxBandeja >= 0) {
        const item = { ...bandeja[idxBandeja]! };
        if (accion === "aceptar" || accion === "aceptar_rol" || accion === "rechazar_rol") {
          item.not_leido_en = ahora;
          if (accion === "aceptar_rol" || accion === "aceptar") item.estado_propuesta = "aceptado";
          if (accion === "rechazar_rol") item.estado_propuesta = "rechazado";
        } else if (accion === "eliminar") {
          item.not_eliminada = true;
          item.not_eliminada_en = ahora;
          item.not_leido_en = item.not_leido_en || ahora;
        } else if (accion === "restaurar") {
          item.not_eliminada = false;
          item.not_eliminada_en = null;
        } else if (accion === "posponer") {
          const horasNum = Number(horas) || 3;
          item.not_pospuesta_hasta = new Date(Date.now() + horasNum * 3600 * 1000).toISOString();
          item.not_pospuesta_horas = horasNum;
        }
        bandeja[idxBandeja] = item;
      }

      await (client as any)
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...det,
            ...(fichaAbogado ? { ficha_abogado: fichaAbogado } : {}),
            notificaciones_bandeja: bandeja,
            propuestas_cambio_rol: propuestas,
          },
          usu_actualizado_en: ahora,
        })
        .eq("usu_id", perfil.usu_id);
    } catch (errSyncUsu) {
      console.warn("Aviso al sincronizar bandeja/propuesta en seg_usuario:", errSyncUsu);
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

    const detallesActuales = (registroExistente?.not_detalles as Record<string, unknown>) || {};

    if (registroExistente) {
      let nuevosDetalles = { ...detallesActuales };
      let nuevoLeidoEn = registroExistente.not_leido_en;

      if (accion === "aceptar" || accion === "aceptar_rol" || accion === "rechazar_rol") {
        nuevoLeidoEn = ahora;
        nuevosDetalles = {
          ...nuevosDetalles,
          confirmada_por: actorInfo,
          confirmada_en: ahora,
          confirmada_usuario_id: perfil.usu_id,
          confirmada_usuario_nombre: nombreActor,
          accion_rol: accion,
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

      if (accion === "aceptar" || accion === "aceptar_rol" || accion === "rechazar_rol") {
        leidoEnInsertar = ahora;
        detallesInsertar = { confirmada_por: actorInfo, confirmada_en: ahora, confirmada_usuario_id: perfil.usu_id, confirmada_usuario_nombre: nombreActor, accion_rol: accion };
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

    return NextResponse.json({
      success: true,
      not_id,
      accion,
      actor: actorInfo,
      rolActivado: rolActivadoConExito,
    });
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

