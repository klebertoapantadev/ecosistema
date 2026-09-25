/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerCampanasServidor } from "../../almacen";

export interface NotificacionUsuarioAdminItem {
  not_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_correo: string;
  emisor_id?: string | null;
  emisor_nombre?: string | null;
  emisor_correo?: string | null;
  emisor_tipo?: "SISTEMA" | "POSTULANTE" | "ADMINISTRADOR" | "CLIENTE" | "ABOGADO" | string | null;
  not_negocio: string;
  not_canal: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string | null;
  not_leido_en?: string | null;
  not_pospuesta_hasta?: string | null;
  not_pospuesta_horas?: number | null;
  not_eliminada: boolean;
  not_eliminada_en?: string | null;
  not_creado_en: string;
  not_detalles?: Record<string, unknown>;
  confirmada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
  pospuesta_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string; horas?: number } | null;
  eliminada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
  restaurada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
}

export async function GET(request: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const perfilesTranqi = await obtenerPerfiles("tranqi");
    const perfilesTRANQ = await obtenerPerfiles("TRANQ");
    const perfiles = Array.from(new Set([...perfilesTranqi, ...perfilesTRANQ]));
    const correo = (perfil.usu_correo || "").toLowerCase().trim();
    const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";
    const esAutorizado = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR") || perfiles.includes("SUPERADMIN");

    if (!esAutorizado) {
      return NextResponse.json({ error: "Acceso Denegado: Se requiere rol de Operador o Administrador." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filtroUsuarioId = searchParams.get("usuario_id");
    const filtroNegocio = searchParams.get("negocio") || "TRANQ";

    const client: any = crearClienteAdmin() || await crearClienteServidor();

    // 1. Obtener catálogo completo de usuarios para correlacionar nombres y correos
    let usuarios: Array<{ usu_id: string; usu_nombres?: string | null; usu_apellidos?: string | null; usu_correo: string; usu_superadmin_plataforma?: boolean }> = [];
    try {
      const { data: dbUsers } = await client
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma");
      if (Array.isArray(dbUsers)) {
        usuarios = dbUsers;
      }
    } catch (errUsers) {
      console.warn("Aviso al consultar seg_usuario en API admin:", errUsers);
    }

    // Fallback con RPC si directo falló por RLS
    if (usuarios.length === 0) {
      try {
        const { data: rpcUsers } = await client
          .schema("comun_seguridad")
          .rpc("seg_fn_listar_usuarios_directorio");
        if (Array.isArray(rpcUsers)) {
          usuarios = rpcUsers;
        }
      } catch (errRpcU) {
        console.warn("Aviso seg_fn_listar_usuarios_directorio:", errRpcU);
      }
    }

    const mapaUsuarios = new Map<string, { id: string; nombre: string; correo: string }>();
    usuarios.forEach(u => {
      const nombre = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || u.usu_correo;
      mapaUsuarios.set(u.usu_id, { id: u.usu_id, nombre, correo: u.usu_correo });
    });

    const lista: NotificacionUsuarioAdminItem[] = [];
    const idsVistos = new Set<string>();

    // 2. Intentar RPC comun_seguridad.seg_fn_monitoreo_notificaciones (esquema expuesto a PostgREST)
    try {
      const { data: rpcNotifs, error: errRpcNotifs } = await client
        .schema("comun_seguridad")
        .rpc("seg_fn_monitoreo_notificaciones", {
          p_negocio: filtroNegocio,
          p_usuario_id: filtroUsuarioId || null
        });

      if (!errRpcNotifs && Array.isArray(rpcNotifs)) {
        rpcNotifs.forEach((r: any) => {
          if (!idsVistos.has(r.not_id)) {
            idsVistos.add(r.not_id);
            const uInfo = mapaUsuarios.get(r.usuario_id) || { id: r.usuario_id, nombre: r.usuario_nombre || "Usuario", correo: r.usuario_correo || "—" };
            const detalles = (r.not_detalles as Record<string, unknown>) || {};

            lista.push({
              not_id: r.not_id,
              usuario_id: r.usuario_id,
              usuario_nombre: uInfo.nombre,
              usuario_correo: uInfo.correo,
              emisor_id: r.emisor_id || null,
              emisor_nombre: r.emisor_nombre || "Sistema " + filtroNegocio,
              emisor_correo: r.emisor_correo || "sistema@tranqi24.com",
              emisor_tipo: r.emisor_tipo || "SISTEMA",
              not_negocio: r.not_negocio || filtroNegocio,
              not_canal: r.not_canal || "IN_APP",
              not_titulo: r.not_titulo,
              not_contenido_html: r.not_contenido_html,
              not_url_accion: r.not_url_accion,
              not_leido_en: r.not_leido_en,
              not_pospuesta_hasta: r.not_pospuesta_hasta || (detalles.pospuesta_hasta as string) || null,
              not_pospuesta_horas: r.not_pospuesta_horas || (detalles.pospuesta_horas as number) || null,
              not_eliminada: Boolean(r.not_eliminada ?? detalles.eliminada),
              not_eliminada_en: r.not_eliminada_en || (detalles.eliminada_en as string) || null,
              not_creado_en: r.not_creado_en,
              not_detalles: detalles,
              confirmada_por: (detalles.confirmada_por as any) || (detalles.confirmada_usuario_nombre ? { usuario_id: detalles.confirmada_usuario_id as string, usuario_nombre: detalles.confirmada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.confirmada_en as string) || "" } : null),
              pospuesta_por: (detalles.pospuesta_por as any) || (detalles.pospuesta_usuario_nombre ? { usuario_id: detalles.pospuesta_usuario_id as string, usuario_nombre: detalles.pospuesta_usuario_nombre as string, usuario_correo: "", fecha: (detalles.pospuesta_en as string) || "", horas: detalles.pospuesta_horas as number } : null),
              eliminada_por: (detalles.eliminada_por as any) || (detalles.eliminada_usuario_nombre ? { usuario_id: detalles.eliminada_usuario_id as string, usuario_nombre: detalles.eliminada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.eliminada_en as string) || "" } : null),
              restaurada_por: (detalles.restaurada_por as any) || (detalles.restaurada_usuario_nombre ? { usuario_id: detalles.restaurada_usuario_id as string, usuario_nombre: detalles.restaurada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.restaurada_en as string) || "" } : null)
            });
          }
        });
      }
    } catch (errRpc) {
      console.warn("Aviso seg_fn_monitoreo_notificaciones no disponible aún:", errRpc);
    }

    // 3. Consultar comun_notificacion.not_registro directamente si no vino de la RPC
    try {
      let queryNotRegistro = client
        .schema("comun_notificacion")
        .from("not_registro")
        .select("not_id, not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_detalles, not_creado_en")
        .order("not_creado_en", { ascending: false })
        .limit(300);

      if (filtroUsuarioId) {
        queryNotRegistro = queryNotRegistro.eq("not_usuario_id", filtroUsuarioId);
      }

      const { data: registrosDirectos } = await queryNotRegistro;
      if (registrosDirectos && Array.isArray(registrosDirectos)) {
        registrosDirectos.forEach((r: any) => {
          if (!idsVistos.has(r.not_id)) {
            idsVistos.add(r.not_id);
            const uInfo = mapaUsuarios.get(r.not_usuario_id) || { id: r.not_usuario_id, nombre: "Usuario", correo: "—" };
            const detalles = (r.not_detalles as Record<string, unknown>) || {};
            const emisorInfo = (detalles.emisor as Record<string, unknown>) || {};

            lista.push({
              not_id: r.not_id,
              usuario_id: r.not_usuario_id,
              usuario_nombre: uInfo.nombre,
              usuario_correo: uInfo.correo,
              emisor_id: (emisorInfo.id as string) || null,
              emisor_nombre: (emisorInfo.nombre as string) || "Sistema " + (r.not_negocio || filtroNegocio),
              emisor_correo: (emisorInfo.correo as string) || "sistema@tranqi24.com",
              emisor_tipo: (emisorInfo.tipo as string) || "SISTEMA",
              not_negocio: r.not_negocio || filtroNegocio,
              not_canal: r.not_canal || "IN_APP",
              not_titulo: r.not_titulo,
              not_contenido_html: r.not_contenido_html,
              not_url_accion: r.not_url_accion,
              not_leido_en: r.not_leido_en,
              not_pospuesta_hasta: (detalles.pospuesta_hasta as string) || null,
              not_pospuesta_horas: (detalles.pospuesta_horas as number) || null,
              not_eliminada: Boolean(detalles.eliminada),
              not_eliminada_en: (detalles.eliminada_en as string) || null,
              not_creado_en: r.not_creado_en,
              not_detalles: detalles,
              confirmada_por: (detalles.confirmada_por as any) || (detalles.confirmada_usuario_nombre ? { usuario_id: detalles.confirmada_usuario_id as string, usuario_nombre: detalles.confirmada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.confirmada_en as string) || "" } : null),
              pospuesta_por: (detalles.pospuesta_por as any) || (detalles.pospuesta_usuario_nombre ? { usuario_id: detalles.pospuesta_usuario_id as string, usuario_nombre: detalles.pospuesta_usuario_nombre as string, usuario_correo: "", fecha: (detalles.pospuesta_en as string) || "", horas: detalles.pospuesta_horas as number } : null),
              eliminada_por: (detalles.eliminada_por as any) || (detalles.eliminada_usuario_nombre ? { usuario_id: detalles.eliminada_usuario_id as string, usuario_nombre: detalles.eliminada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.eliminada_en as string) || "" } : null),
              restaurada_por: (detalles.restaurada_por as any) || (detalles.restaurada_usuario_nombre ? { usuario_id: detalles.restaurada_usuario_id as string, usuario_nombre: detalles.restaurada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.restaurada_en as string) || "" } : null)
            });
          }
        });
      }
    } catch (errDirect) {
      console.warn("Aviso al consultar not_registro directo:", errDirect);
    }

    // 4. Agregar eventos auditables del sistema desde esquemas transaccionales expuestos (tranqui_legal)
    try {
      // 4.1 Obtener solicitudes de socio
      let solicitudesSocio: any[] = [];
      const { data: dbSols, error: errSols } = await client
        .schema("tranqui_legal")
        .from("trq_solicitud_socio")
        .select("*")
        .is("ssc_eliminado_en", null)
        .order("ssc_actualizado_en", { ascending: false })
        .limit(200);

      if (!errSols && Array.isArray(dbSols)) {
        solicitudesSocio = dbSols;
      }

      if (solicitudesSocio.length > 0) {
        // 4.2 Obtener documentos de respaldo
        let todosDocumentos: any[] = [];
        try {
          const { data: dbDocs } = await client
            .schema("tranqui_legal")
            .from("trq_documento_socio")
            .select("dcs_id, dcs_solicitud_id, dcs_tipo, dcs_comentario, dcs_creado_en");
          if (Array.isArray(dbDocs)) todosDocumentos = dbDocs;
        } catch (errDocs) {
          console.warn("Aviso al consultar trq_documento_socio:", errDocs);
        }

        // 4.3 Obtener revisiones de evaluadores
        let todasRevisiones: any[] = [];
        try {
          const { data: dbRevs } = await client
            .schema("tranqui_legal")
            .from("trq_revision_solicitud")
            .select("rev_id, rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario, rev_creado_en");
          if (Array.isArray(dbRevs)) todasRevisiones = dbRevs;
        } catch (errRevs) {
          console.warn("Aviso al consultar trq_revision_solicitud:", errRevs);
        }

        for (const sol of solicitudesSocio) {
          const uPost = mapaUsuarios.get(sol.ssc_usuario_id) || { id: sol.ssc_usuario_id, nombre: "Postulante Abogado", correo: "postulante@tranqi24.com" };
          const docs = todosDocumentos.filter(d => d.dcs_solicitud_id === sol.ssc_id);
          const revs = todasRevisiones.filter(r => r.rev_solicitud_id === sol.ssc_id);
          revs.sort((a, b) => new Date(b.rev_creado_en).getTime() - new Date(a.rev_creado_en).getTime());

          const tieneContrato = docs.some(d => d.dcs_tipo === "contrato_socio" || d.dcs_comentario?.includes("[tipo:contrato_socio]"));
          const tienePropuesta = docs.some(d => d.dcs_comentario?.includes("[PROPUESTA_MODIFICACION_CONTRATO]"));

          // A) Alerta: Contrato firmado subido por el postulante
          if (tieneContrato) {
            const synthContratoId = `contrato-${sol.ssc_id}`;
            if (!idsVistos.has(synthContratoId)) {
              idsVistos.add(synthContratoId);
              lista.push({
                not_id: synthContratoId,
                usuario_id: sol.ssc_usuario_id,
                usuario_nombre: "Staff Operaciones (Tranqi Legal)",
                usuario_correo: "staff@tranqi24.com",
                emisor_id: sol.ssc_usuario_id,
                emisor_nombre: `${uPost.nombre} (Postulante)`,
                emisor_correo: uPost.correo,
                emisor_tipo: "POSTULANTE",
                not_negocio: "TRANQ",
                not_canal: "IN_APP",
                not_titulo: `Contrato Firmado Recibido — Postulante: ${uPost.nombre}`,
                not_contenido_html: `<p>El postulante <strong>${uPost.nombre}</strong> ha subido su contrato firmado. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #05876E; font-weight: 700;">Verificar Contrato y Activar Socio</a> para completar su incorporación.</p>`,
                not_url_accion: `/panel/socios/${sol.ssc_id}`,
                not_leido_en: sol.ssc_estado === "aceptada" ? sol.ssc_actualizado_en : null,
                not_eliminada: false,
                not_creado_en: sol.ssc_actualizado_en || sol.ssc_creado_en
              });
            }
          }

          // B) Alerta: Propuesta de modificación de contrato enviada por el postulante
          if (tienePropuesta) {
            const synthPropuestaId = `propuesta-${sol.ssc_id}`;
            if (!idsVistos.has(synthPropuestaId)) {
              idsVistos.add(synthPropuestaId);
              lista.push({
                not_id: synthPropuestaId,
                usuario_id: sol.ssc_usuario_id,
                usuario_nombre: "Staff Operaciones (Tranqi Legal)",
                usuario_correo: "staff@tranqi24.com",
                emisor_id: sol.ssc_usuario_id,
                emisor_nombre: `${uPost.nombre} (Postulante)`,
                emisor_correo: uPost.correo,
                emisor_tipo: "POSTULANTE",
                not_negocio: "TRANQ",
                not_canal: "IN_APP",
                not_titulo: `Propuesta de Modificación al Contrato — Postulante: ${uPost.nombre}`,
                not_contenido_html: `<p>El postulante <strong>${uPost.nombre}</strong> ha enviado una propuesta de cambios al contrato en formato Word. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #D97706; font-weight: 700;">Revisar Propuesta</a>.</p>`,
                not_url_accion: `/panel/socios/${sol.ssc_id}`,
                not_leido_en: null,
                not_eliminada: false,
                not_creado_en: sol.ssc_actualizado_en || sol.ssc_creado_en
              });
            }
          }

          // C) Alerta: Solicitud inicial de socio enviada/pendiente
          const synthPostulacionId = `postulacion-${sol.ssc_id}`;
          if (!idsVistos.has(synthPostulacionId)) {
            idsVistos.add(synthPostulacionId);
            lista.push({
              not_id: synthPostulacionId,
              usuario_id: sol.ssc_usuario_id,
              usuario_nombre: "Staff Operaciones (Tranqi Legal)",
              usuario_correo: "staff@tranqi24.com",
              emisor_id: sol.ssc_usuario_id,
              emisor_nombre: `${uPost.nombre} (Postulante)`,
              emisor_correo: uPost.correo,
              emisor_tipo: "POSTULANTE",
              not_negocio: "TRANQ",
              not_canal: "IN_APP",
              not_titulo: `Nueva Postulación de Socio Abogado: ${uPost.nombre}`,
              not_contenido_html: `<p>El profesional <strong>${uPost.nombre}</strong> (<code>${uPost.correo}</code>) ha registrado una postulación como Socio Abogado en tranqi. Haz clic en <a href="/panel/socios/${sol.ssc_id}" style="color: #5000BA; font-weight: 700;">Evaluar Solicitud de Socio</a> para revisar su matrícula y registro SENESCYT.</p>`,
              not_url_accion: `/panel/socios/${sol.ssc_id}`,
              not_leido_en: sol.ssc_estado === "aceptada" ? sol.ssc_actualizado_en : null,
              not_eliminada: false,
              not_creado_en: sol.ssc_creado_en
            });
          }

          // D) Resoluciones emitidas desde la administración hacia el postulante
          if (revs.length > 0) {
            for (const rev of revs) {
              const synthRevId = `rev-${rev.rev_id}`;
              if (!idsVistos.has(synthRevId)) {
                idsVistos.add(synthRevId);
                const uRev = mapaUsuarios.get(rev.rev_admin_id) || { id: rev.rev_admin_id, nombre: "Evaluador Staff Tranqi", correo: "evaluador@tranqi24.com" };
                const esAprobada = rev.rev_decision === "aceptada";

                lista.push({
                  not_id: synthRevId,
                  usuario_id: sol.ssc_usuario_id,
                  usuario_nombre: uPost.nombre,
                  usuario_correo: uPost.correo,
                  emisor_id: rev.rev_admin_id,
                  emisor_nombre: `${uRev.nombre} (Evaluador Staff)`,
                  emisor_correo: uRev.correo,
                  emisor_tipo: "ADMINISTRADOR",
                  not_negocio: "TRANQ",
                  not_canal: "IN_APP",
                  not_titulo: esAprobada
                    ? "¡Tu Acreditación como Socio Abogado fue APROBADA!"
                    : "Observación en tu Solicitud de Socio Abogado",
                  not_contenido_html: esAprobada
                    ? `<p>Tu postulación ha sido aprobada. Por favor <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">descarga tu contrato pre-llenado y súbelo firmado</a> para activar tu cuenta de Abogado.</p>`
                    : `<p>${rev.rev_comentario || "Se identificaron observaciones en tu solicitud."}</p>`,
                  not_url_accion: "/panel/solicitud-socio",
                  not_leido_en: null,
                  not_eliminada: false,
                  not_creado_en: rev.rev_creado_en
                });
              }
            }
          } else if (sol.ssc_estado === "aceptada") {
            // Notificación sintética de aprobación si la solicitud está aceptada
            const synthAprobadaId = `aprobacion-${sol.ssc_id}`;
            if (!idsVistos.has(synthAprobadaId)) {
              idsVistos.add(synthAprobadaId);
              lista.push({
                not_id: synthAprobadaId,
                usuario_id: sol.ssc_usuario_id,
                usuario_nombre: uPost.nombre,
                usuario_correo: uPost.correo,
                emisor_id: null,
                emisor_nombre: "Staff Evaluador Tranqi",
                emisor_correo: "staff@tranqi24.com",
                emisor_tipo: "ADMINISTRADOR",
                not_negocio: "TRANQ",
                not_canal: "IN_APP",
                not_titulo: "¡Tu Acreditación como Socio Abogado fue APROBADA!",
                not_contenido_html: `<p>Tu postulación ha sido aprobada. Por favor <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">descarga tu contrato pre-llenado y súbelo firmado</a> para activar tu cuenta de Abogado.</p>`,
                not_url_accion: "/panel/solicitud-socio",
                not_leido_en: null,
                not_eliminada: false,
                not_creado_en: sol.ssc_actualizado_en || sol.ssc_creado_en
              });
            }
          }
        }
      }
    } catch (errSols) {
      console.warn("Aviso al consultar trq_solicitud_socio en admin notificaciones:", errSols);
    }

    // 5. Agregar campañas emitidas desde la Consola Transversal
    const campanas = obtenerCampanasServidor();
    campanas.forEach(c => {
      if (!idsVistos.has(c.id)) {
        idsVistos.add(c.id);
        lista.push({
          not_id: c.id,
          usuario_id: "AUDIENCIA_" + c.audiencia,
          usuario_nombre: `Audiencia: ${c.audiencia}`,
          usuario_correo: c.destinatariosDetalle && c.destinatariosDetalle.length > 0 ? c.destinatariosDetalle.slice(0, 3).join(", ") + (c.destinatariosDetalle.length > 3 ? "..." : "") : "Todos los miembros",
          emisor_id: c.emisorId || null,
          emisor_nombre: `${c.emisorNombre || "Administrador"} (Emisión Consola)`,
          emisor_correo: c.emisorCorreo || "admin@tranqi24.com",
          emisor_tipo: "ADMINISTRADOR",
          not_negocio: filtroNegocio,
          not_canal: c.canales && c.canales.length > 0 ? c.canales.join(", ") : "IN_APP",
          not_titulo: c.asunto,
          not_contenido_html: c.contenidoHTML || `<p>${c.asunto}</p>`,
          not_url_accion: "/panel",
          not_leido_en: null,
          not_eliminada: false,
          not_creado_en: c.fecha || new Date().toISOString()
        });
      }
    });

    // 6. Filtrar por usuario específico si fue solicitado (remitente o destinatario)
    let listaFiltrada = lista;
    if (filtroUsuarioId) {
      listaFiltrada = lista.filter(n => n.usuario_id === filtroUsuarioId || n.emisor_id === filtroUsuarioId);
    }

    // Ordenar cronológicamente descendente
    listaFiltrada.sort((a, b) => new Date(b.not_creado_en).getTime() - new Date(a.not_creado_en).getTime());

    return NextResponse.json({
      success: true,
      total: listaFiltrada.length,
      notificaciones: listaFiltrada,
      usuariosDisponibles: Array.from(mapaUsuarios.values()).map(u => ({
        id: u.id,
        nombre: u.nombre,
        correo: u.correo
      }))
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener notificaciones para administración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const perfilesTranqi = await obtenerPerfiles("tranqi");
    const perfilesTRANQ = await obtenerPerfiles("TRANQ");
    const perfiles = Array.from(new Set([...perfilesTranqi, ...perfilesTRANQ]));
    const correo = (perfil.usu_correo || "").toLowerCase().trim();
    const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";
    const esAutorizado = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR") || perfiles.includes("SUPERADMIN");

    if (!esAutorizado) {
      return NextResponse.json({ error: "Acceso Denegado" }, { status: 403 });
    }

    const body = await request.json();
    const { not_id, accion } = body;

    if (!not_id || !accion) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const client: any = crearClienteAdmin() || await crearClienteServidor();

    const { data: registro } = await client
      .schema("comun_notificacion")
      .from("not_registro")
      .select("not_id, not_detalles")
      .eq("not_id", not_id)
      .maybeSingle();

    const detalles = (registro?.not_detalles as Record<string, unknown>) || {};
    const ahora = new Date().toISOString();

    if (registro) {
      if (accion === "restaurar") {
        await client
          .schema("comun_notificacion")
          .from("not_registro")
          .update({
            not_detalles: { ...detalles, eliminada: false, restaurada_por_admin: perfil.usu_id, restaurada_en: ahora }
          })
          .eq("not_id", not_id);
      } else if (accion === "marcar_leida") {
        await client
          .schema("comun_notificacion")
          .from("not_registro")
          .update({
            not_leido_en: ahora
          })
          .eq("not_id", not_id);
      }
    }

    return NextResponse.json({ success: true, not_id, accion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar acción de administración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
