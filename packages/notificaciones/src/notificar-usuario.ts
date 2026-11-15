import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { enviarCorreo } from "./enviar-correo";

function resolverMetaNegocioNotif(negocioRaw?: string | null): {
  canon: string;
  notifCode: string;
  nombreVisible: string;
  codigos: string[];
  codigosUpper: Set<string>;
} {
  const limpio = (negocioRaw || "tranqi").trim().toLowerCase();
  if (limpio === "tinkay" || limpio === "tnk") {
    const codigos = ["tinkay", "TINKAY", "tnk", "TNK"];
    return {
      canon: "tinkay",
      notifCode: "TINKAY",
      nombreVisible: "Tinkay",
      codigos,
      codigosUpper: new Set(codigos.map((c) => c.toUpperCase())),
    };
  }
  if (limpio === "fastfix" || limpio === "ffh") {
    const codigos = ["fastfix", "FASTFIX", "ffh", "FFH"];
    return {
      canon: "fastfix",
      notifCode: "FASTFIX",
      nombreVisible: "FastFix Home",
      codigos,
      codigosUpper: new Set(codigos.map((c) => c.toUpperCase())),
    };
  }
  if (limpio === "margaritas" || limpio === "mrg") {
    const codigos = ["margaritas", "MARGARITAS", "mrg", "MRG"];
    return {
      canon: "margaritas",
      notifCode: "MARGARITAS",
      nombreVisible: "Margaritas Floristería",
      codigos,
      codigosUpper: new Set(codigos.map((c) => c.toUpperCase())),
    };
  }
  if (limpio === "tranqi" || limpio === "tranq" || limpio === "legal") {
    const codigos = ["tranqi", "TRANQI", "tranq", "TRANQ", "legal", "LEGAL"];
    return {
      canon: "tranqi",
      notifCode: "TRANQ",
      nombreVisible: "Tranqi",
      codigos,
      codigosUpper: new Set(codigos.map((c) => c.toUpperCase())),
    };
  }
  const codigos = Array.from(new Set([limpio, limpio.toUpperCase()]));
  return {
    canon: limpio,
    notifCode: limpio.toUpperCase(),
    nombreVisible: negocioRaw?.trim() || "Plataforma",
    codigos,
    codigosUpper: new Set(codigos.map((c) => c.toUpperCase())),
  };
}

export interface ParametrosNuevoUsuarioNotif {
  usuarioId: string;
  nombres?: string | null;
  apellidos?: string | null;
  correo: string;
  negocio: string;
}

export interface ResultadoAutoafiliacionConvenio {
  tieneConvenio: boolean;
  cupoAgotado?: boolean;
  cupoSuspendido?: boolean;
  empresaNombre?: string;
  convenioId?: string;
  cupoColaboradores?: number;
  colaboradoresRegistrados?: number;
  correoBienvenidaEnviado?: boolean;
}

export function construirHtmlBienvenidaConvenio(params: {
  nombreColaborador: string;
  correoColaborador: string;
  empresaNombre: string;
  empresaRuc?: string;
  dominioCorreo?: string;
  consultasGratis: number;
  frecuenciaConsultas: string;
  descuentoGeneralPct: number;
  excepciones: Array<{ producto_nombre: string; descuento_pct: number }>;
  bonoBilletera?: number;
  validoHasta?: string | null;
  negocio?: string;
}): string {
  const {
    nombreColaborador,
    correoColaborador,
    empresaNombre,
    empresaRuc,
    dominioCorreo,
    consultasGratis,
    frecuenciaConsultas,
    descuentoGeneralPct,
    excepciones,
    bonoBilletera = 0,
    validoHasta,
    negocio,
  } = params;
  const metaNeg = resolverMetaNegocioNotif(negocio);
  const esTranqi = metaNeg.canon === "tranqi";

  const textoFrecuencia =
    frecuenciaConsultas === "MENSUAL"
      ? "mensuales"
      : frecuenciaConsultas === "SEMESTRAL"
      ? "semestrales"
      : frecuenciaConsultas === "UNICA"
      ? "incluidas"
      : "anuales";

  const vigenciaTexto = validoHasta
    ? new Date(validoHasta).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" })
    : "Indefinida (Convenio Activo)";

  const htmlExcepciones =
    Array.isArray(excepciones) && excepciones.length > 0
      ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #CBD5E1;">
        <div style="font-size: 13px; font-weight: 800; color: #334155; margin-bottom: 6px;">
          🎯 Descuentos Específicos por Trámite / Servicio:
        </div>
        <ul style="margin: 0; padding-left: 18px; font-size: 13.5px; color: #475569; line-height: 1.6;">
          ${excepciones
            .map(
              (ex) =>
                `<li><strong>${ex.producto_nombre}:</strong> <span style="color: #05876E; font-weight: 800;">${ex.descuento_pct}% de descuento</span></li>`
            )
            .join("")}
        </ul>
      </div>
      `
      : "";

  const htmlBono =
    Number(bonoBilletera) > 0
      ? `
      <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
        <div style="font-size: 14px; font-weight: 800; color: #B45309;">
          💰 Bono Corporativo en Billetera: $${Number(bonoBilletera).toFixed(2)} USD
        </div>
        <div style="font-size: 13px; color: #78350F; margin-top: 2px;">
          Acreditado automáticamente en tu cuenta para consumo en servicios legales.
        </div>
      </div>
      `
      : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Bienvenido a tu Convenio Corporativo ${empresaNombre} — ${metaNeg.nombreVisible}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <div style="max-width: 600px; margin: 28px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0;">
    
    <!-- Cabecera Corporativa -->
    <div style="background: linear-gradient(135deg, #1E1B4B 0%, #5000BA 100%); padding: 30px 28px; text-align: center;">
      <span style="display: inline-block; background-color: #10B981; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.08em;">
        Convenio Corporativo Activo · ${empresaNombre}
      </span>
      <h1 style="color: #FFFFFF; margin: 12px 0 4px 0; font-size: 24px; font-weight: 800;">
        ¡Bienvenido/a a ${metaNeg.nombreVisible}, ${nombreColaborador}!
      </h1>
      <p style="color: #E0E7FF; margin: 0; font-size: 14px;">
        Tu cuenta corporativa (<strong>${correoColaborador}</strong>) ha sido vinculada exitosamente.
      </p>
    </div>

    <!-- Cuerpo y Resumen de Beneficios -->
    <div style="padding: 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
        Como colaborador habilitado bajo el convenio empresarial de <strong>${empresaNombre}</strong>${empresaRuc ? ` (RUC: ${empresaRuc})` : ""}, cuentas con beneficios preferenciales exclusivos activados de forma inmediata en <strong>${metaNeg.nombreVisible}</strong>:
      </p>

      <div style="background-color: #F8FAFC; border: 1.5px solid #A7F3D0; border-radius: 14px; padding: 20px; margin: 22px 0;">
        <h3 style="margin: 0 0 14px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #05876E; font-weight: 800;">
          🎁 Tus Beneficios con el Convenio ${empresaNombre}
        </h3>

        ${esTranqi ? `
        <!-- Beneficio 1: Consultas Telemáticas -->
        <div style="background: #FFFFFF; border: 1px solid #D1FAE5; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
          <div style="font-size: 15px; font-weight: 800; color: #0F172A;">
            ⚖️ ${consultasGratis} Consulta(s) Jurídica(s) Telemática(s) al 100% ($0.00)
          </div>
          <div style="font-size: 13px; color: #475569; margin-top: 3px;">
            Tienes <strong>${consultasGratis} citas telemáticas ${textoFrecuencia} sin costo</strong> (100% subsidiadas por tu convenio) con abogados especialistas verificados.
          </div>
        </div>` : ""}

        <!-- Beneficio 2: Descuento General -->
        <div style="background: #FFFFFF; border: 1px solid #E0E7FF; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
          <div style="font-size: 15px; font-weight: 800; color: #4F46E5;">
            🏷️ ${descuentoGeneralPct}% de Descuento Corporativo Preferencial
          </div>
          <div style="font-size: 13px; color: #475569; margin-top: 3px;">
            Descuento automático aplicado sobre tus compras y servicios en ${metaNeg.nombreVisible}.
          </div>
        </div>

        ${htmlBono}
        ${htmlExcepciones}
      </div>

      <!-- Datos de control del convenio -->
      <div style="background-color: #F1F5F9; border-radius: 10px; padding: 12px 16px; font-size: 12.5px; color: #475569; margin-bottom: 24px;">
        <div><strong>Empresa Aliada:</strong> ${empresaNombre}</div>
        ${dominioCorreo ? `<div><strong>Dominio Afiliado:</strong> ${dominioCorreo}</div>` : ""}
        <div><strong>Vigencia del Convenio:</strong> ${vigenciaTexto}</div>
      </div>

      ${esTranqi ? `
      <!-- CTA -->
      <div style="text-align: center; margin: 26px 0 10px;">
        <a href="https://www.tranqi24.com/panel/clientes?widget=mis_beneficios_corporativos" style="display: inline-block; background: linear-gradient(135deg, #05876E 0%, #047857 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 28px; border-radius: 10px;">
          Ver Mis Beneficios y Agendar Consulta ($0.00)
        </a>
      </div>` : ""}
    </div>

    <!-- Pie -->
    <div style="background-color: #0F172A; padding: 18px 28px; text-align: center; color: #94A3B8; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} ${metaNeg.nombreVisible} · Beneficios Corporativos.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Verifica si el usuario que se registra pertenece a un convenio corporativo,
 * controla el cupo máximo de colaboradores habilitados, registra al colaborador
 * y le envía el correo de bienvenida detallando todos los beneficios de su convenio.
 */
export async function procesarAutoafiliacionYBienvenidaConvenio(
  params: ParametrosNuevoUsuarioNotif & { forzarReenvio?: boolean }
): Promise<ResultadoAutoafiliacionConvenio> {
  try {
    const correoLimpio = (params.correo || "").toLowerCase().trim();
    if (!correoLimpio || !correoLimpio.includes("@")) {
      return { tieneConvenio: false };
    }

    const adminSupabase = crearClienteAdmin() || (await crearClienteServidor());
    if (!adminSupabase) return { tieneConvenio: false };

    const metaNeg = resolverMetaNegocioNotif(params.negocio);
    const negocioSlug = metaNeg.canon;
    const dominio = correoLimpio.substring(correoLimpio.indexOf("@"));
    const nombreCompleto =
      [params.nombres, params.apellidos].filter(Boolean).join(" ").trim() ||
      correoLimpio.split("@")[0] ||
      "Colaborador";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminSupabase as any;

    // 1. Buscar convenio activo en comun_comercio.com_convenio_empresa (estrictamente del negocio actual)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let convenioEncontrado: any = null;
    try {
      const { data: listaConvenios } = await db
        .schema("comun_comercio")
        .from("com_convenio_empresa")
        .select("*")
        .in("cve_negocio", metaNeg.codigos)
        .eq("cve_activo", true);

      if (Array.isArray(listaConvenios)) {
        convenioEncontrado = listaConvenios.find((c) => {
          const domCve = (c.cve_dominio_correo || "").toLowerCase().trim();
          const domCveNorm = domCve.startsWith("@") ? domCve : domCve ? `@${domCve}` : "";
          const dominiosAut: string[] = Array.isArray(c.cve_detalle_convenio?.dominios_autorizados)
            ? c.cve_detalle_convenio.dominios_autorizados.map((d: string) => {
                const dl = String(d || "").toLowerCase().trim();
                return dl.startsWith("@") ? dl : `@${dl}`;
              })
            : [];
          return domCveNorm === dominio || dominiosAut.includes(dominio);
        });
      }
    } catch {}

    // 2. Fallback: revisar convenios guardados en comun_configuracion.cfg_negocio (estrictamente del negocio actual)
    if (!convenioEncontrado) {
      try {
        const { data: cfg } = await db
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .in("cfg_negocio", metaNeg.codigos)
          .limit(1)
          .maybeSingle();

        const listaCfg = cfg?.cfg_detalle_configuracion?.convenios_b2b;
        if (Array.isArray(listaCfg)) {
          convenioEncontrado = listaCfg.find((c: any) => {
            if (!c || c.cve_activo === false) return false;
            const domCve = (c.cve_dominio_correo || "").toLowerCase().trim();
            const domCveNorm = domCve.startsWith("@") ? domCve : domCve ? `@${domCve}` : "";
            const dominiosAut: string[] = Array.isArray(c.cve_detalle_convenio?.dominios_autorizados)
              ? c.cve_detalle_convenio.dominios_autorizados.map((d: string) => {
                  const dl = String(d || "").toLowerCase().trim();
                  return dl.startsWith("@") ? dl : `@${dl}`;
                })
              : [];
            return domCveNorm === dominio || dominiosAut.includes(dominio);
          });
        }
      } catch {}
    }

    if (!convenioEncontrado) {
      return { tieneConvenio: false };
    }

    const convenioId = convenioEncontrado.cve_id;
    const empresaNombre = convenioEncontrado.cve_empresa_nombre || "Empresa Aliada";
    const empresaRuc = convenioEncontrado.cve_empresa_ruc || "";
    const cupoColaboradores = Math.max(
      1,
      Number(
        convenioEncontrado.cve_cupo_colaboradores ??
          convenioEncontrado.cve_detalle_convenio?.cupo_colaboradores_habilitados ??
          50
      )
    );

    const paquete = convenioEncontrado.cve_detalle_convenio?.paquete_beneficios || {};
    const consultasGratis = Number(paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2);
    const frecuenciaConsultas = String(paquete?.bolsa_derechos?.consultas_telematicas?.frecuencia || "ANUAL");
    const descuentoGeneralPct = Number(paquete?.reglas_descuento?.descuento_general_servicios_pct ?? 15);
    const excepciones = Array.isArray(paquete?.reglas_descuento?.excepciones_por_producto)
      ? paquete.reglas_descuento.excepciones_por_producto
      : [];
    const bonoBilletera = Number(paquete?.billetera_bono_inicial ?? convenioEncontrado.cve_monto_bono_inicial ?? 0);

    // 3. Controlar el cupo de colaboradores registrados en com_beneficiario_empresa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let beneficiariosActuales: any[] = [];
    try {
      const { data: filasBnf } = await db
        .schema("comun_comercio")
        .from("com_beneficiario_empresa")
        .select("*")
        .eq("bnf_convenio_id", convenioId);
      if (Array.isArray(filasBnf)) {
        beneficiariosActuales = filasBnf.filter((b: any) => !b.bnf_eliminado_en);
      }
    } catch {}

    const existente = beneficiariosActuales.find(
      (b: any) =>
        (b.bnf_correo_corporativo || "").toLowerCase().trim() === correoLimpio ||
        (b.bnf_identificacion || "").toLowerCase().trim() === correoLimpio ||
        (params.usuarioId && b.bnf_usuario_vinculado_id === params.usuarioId)
    );

    if (existente && existente.bnf_estado === "INACTIVO") {
      return {
        tieneConvenio: false,
        cupoSuspendido: true,
        empresaNombre,
        convenioId,
      };
    }

    const activosCount = beneficiariosActuales.filter(
      (b: any) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
    ).length;

    if (!existente && activosCount >= cupoColaboradores) {
      return {
        tieneConvenio: false,
        cupoAgotado: true,
        empresaNombre,
        convenioId,
        cupoColaboradores,
        colaboradoresRegistrados: activosCount,
      };
    }

    const yaEnviado = Boolean(existente?.bnf_detalle_beneficiario?.correo_bienvenida_enviado);
    let bnfId = existente?.bnf_id || null;
    let totalRegistradosFinal = activosCount;

    if (!existente) {
      try {
        const { data: nuevoBnf } = await db
          .schema("comun_comercio")
          .from("com_beneficiario_empresa")
          .insert({
            bnf_negocio: negocioSlug,
            bnf_convenio_id: convenioId,
            bnf_identificacion: correoLimpio,
            bnf_correo_corporativo: correoLimpio,
            bnf_nombres: nombreCompleto,
            bnf_usuario_vinculado_id: params.usuarioId || null,
            bnf_estado: "VINCULADO",
            bnf_vinculado_en: new Date().toISOString(),
            bnf_detalle_beneficiario: {
              auto_afiliado_por_dominio: dominio,
              fecha_registro: new Date().toISOString(),
              correo_bienvenida_enviado: false,
            },
          })
          .select("bnf_id")
          .maybeSingle();

        if (nuevoBnf?.bnf_id) {
          bnfId = nuevoBnf.bnf_id;
        }
        totalRegistradosFinal = activosCount + 1;
      } catch {}
    } else {
      try {
        await db
          .schema("comun_comercio")
          .from("com_beneficiario_empresa")
          .update({
            bnf_usuario_vinculado_id: params.usuarioId || existente.bnf_usuario_vinculado_id || null,
            bnf_nombres: nombreCompleto || existente.bnf_nombres,
            bnf_correo_corporativo: correoLimpio,
            bnf_estado: "VINCULADO",
            bnf_vinculado_en: existente.bnf_vinculado_en || new Date().toISOString(),
          })
          .eq("bnf_id", existente.bnf_id);
      } catch {}
    }

    // 4. Enviar correo de bienvenida con los beneficios del convenio si aún no se ha enviado
    let correoEnviadoAhora = false;
    if (!yaEnviado || params.forzarReenvio) {
      const htmlBienvenida = construirHtmlBienvenidaConvenio({
        nombreColaborador: nombreCompleto,
        correoColaborador: correoLimpio,
        empresaNombre,
        empresaRuc,
        dominioCorreo: convenioEncontrado.cve_dominio_correo || dominio,
        consultasGratis,
        frecuenciaConsultas,
        descuentoGeneralPct,
        excepciones,
        bonoBilletera,
        validoHasta: convenioEncontrado.cve_valido_hasta,
        negocio: negocioSlug,
      });

      const resCorreo = await enviarCorreo({
        negocio: negocioSlug,
        para: correoLimpio,
        asunto: `🎁 ¡Bienvenido/a al Convenio ${empresaNombre}! Conoce tus beneficios en ${metaNeg.nombreVisible}`,
        html: htmlBienvenida,
      });

      correoEnviadoAhora = resCorreo.ok;

      // Registrar también notificación In-App de bienvenida al convenio para el colaborador
      if (params.usuarioId) {
        try {
          const negocioUpper = metaNeg.notifCode;
          await db
            .schema("comun_notificacion")
            .from("not_registro")
            .insert({
              not_usuario_id: params.usuarioId,
              not_negocio: negocioUpper,
              not_canal: "IN_APP",
              not_titulo: `🎁 Convenio ${empresaNombre} Activo: ${descuentoGeneralPct}% Desc.`,
              not_contenido_html: `
                <div style="font-family: sans-serif; color: #0F172A;">
                  <p>¡Bienvenido/a <strong>${nombreCompleto}</strong>! Tu cuenta ha sido registrada bajo el convenio corporativo de <strong>${empresaNombre}</strong> en <strong>${metaNeg.nombreVisible}</strong>.</p>
                  <ul>
                    ${metaNeg.canon === "tranqi" ? `<li><strong>${consultasGratis} Consultas Telemáticas ($0.00)</strong> al 100% de subsidio (${frecuenciaConsultas}).</li>` : ""}
                    <li><strong>${descuentoGeneralPct}% de descuento general</strong> corporativo.</li>
                    ${excepciones.map((e: any) => `<li><strong>${e.producto_nombre}:</strong> ${e.descuento_pct}% de descuento.</li>`).join("")}
                  </ul>
                </div>
              `,
              not_url_accion: metaNeg.canon === "tranqi" ? "/panel/clientes?widget=mis_beneficios_corporativos" : "/panel",
              not_creado_en: new Date().toISOString(),
            });
        } catch {}
      }

      // Marcar bienvenida enviada en com_beneficiario_empresa
      if (bnfId) {
        try {
          await db
            .schema("comun_comercio")
            .from("com_beneficiario_empresa")
            .update({
              bnf_detalle_beneficiario: {
                ...(existente?.bnf_detalle_beneficiario || {}),
                auto_afiliado_por_dominio: dominio,
                correo_bienvenida_enviado: true,
                correo_bienvenida_fecha: new Date().toISOString(),
              },
            })
            .eq("bnf_id", bnfId);
        } catch {}
      }
    }

    return {
      tieneConvenio: true,
      empresaNombre,
      convenioId,
      cupoColaboradores,
      colaboradoresRegistrados: totalRegistradosFinal,
      correoBienvenidaEnviado: yaEnviado || correoEnviadoAhora,
    };
  } catch (err) {
    console.warn("Aviso en procesarAutoafiliacionYBienvenidaConvenio:", err);
    return { tieneConvenio: false };
  }
}

export async function notificarNuevoUsuarioRegistrado(params: ParametrosNuevoUsuarioNotif): Promise<void> {
  try {
    // 0. Verificar y procesar auto-afiliación a convenio corporativo + envío de correo de bienvenida con beneficios
    const infoConvenio = await procesarAutoafiliacionYBienvenidaConvenio(params);

    const adminSupabase = crearClienteAdmin() || await crearClienteServidor();
    const nombreCompleto = [params.nombres, params.apellidos].filter(Boolean).join(" ") || params.correo;
    const metaNeg = resolverMetaNegocioNotif(params.negocio);
    const negocioUpper = metaNeg.notifCode;
    const titulo = infoConvenio.tieneConvenio
      ? `Nuevo Colaborador Convenio ${infoConvenio.empresaNombre}: ${nombreCompleto}`
      : `Nuevo Usuario Registrado (${metaNeg.nombreVisible}): ${nombreCompleto}`;
    const urlAccion = `/panel/usuarios?buscar=${encodeURIComponent(params.correo)}`;

    const bloqueConvenioStaff = infoConvenio.tieneConvenio
      ? `<p style="background: #ECFDF5; border: 1px solid #10B981; padding: 10px 14px; border-radius: 8px; color: #065F46; font-weight: 600;">
           🏢 Registrado bajo el <strong>Convenio Corporativo ${infoConvenio.empresaNombre}</strong> (Cupo utilizado: ${infoConvenio.colaboradoresRegistrados}/${infoConvenio.cupoColaboradores} colaboradores). Se envió correo de bienvenida con beneficios.
         </p>`
      : infoConvenio.cupoAgotado
      ? `<p style="background: #FEF2F2; border: 1px solid #EF4444; padding: 10px 14px; border-radius: 8px; color: #991B1B; font-weight: 600;">
           ⚠️ El usuario pertenece al dominio de <strong>${infoConvenio.empresaNombre}</strong>, pero el convenio alcanzó el límite máximo de <strong>${infoConvenio.cupoColaboradores} colaboradores habilitados</strong>.
         </p>`
      : "";

    const contenidoHTML = `
      <div style="font-family: sans-serif; padding: 16px; color: #111;">
        <h3 style="color: #5000BA; margin-top: 0;">${titulo}</h3>
        <p>El usuario <strong>${nombreCompleto}</strong> (<code>${params.correo}</code>) se ha registrado exitosamente en <strong>${metaNeg.nombreVisible}</strong>.</p>
        ${bloqueConvenioStaff}
        <p><a href="${urlAccion}" style="display: inline-block; padding: 10px 18px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Ver Datos del Usuario</a></p>
      </div>
    `;

    // 1. Obtener usuarios con perfil Operador, Administrador o SuperAdmin ESTRICTAMENTE en este negocio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membresiasStaff } = await (adminSupabase as any)
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select(`
        mem_id,
        mem_usuario_id,
        mem_negocio,
        mem_rol,
        mem_estado,
        seg_usuario (
          usu_id,
          usu_correo
        ),
        seg_membresia_perfil (
          seg_perfil (
            per_clave
          )
        )
      `)
      .in("mem_negocio", metaNeg.codigos)
      .eq("mem_estado", "ACTIVO");

    const destinatarios: { id: string; correo: string }[] = [];
    const correosVistos = new Set<string>();

    if (Array.isArray(membresiasStaff)) {
      for (const m of membresiasStaff) {
        const usu = Array.isArray(m.seg_usuario) ? m.seg_usuario[0] : m.seg_usuario;
        const usuId = usu?.usu_id || m.mem_usuario_id;
        const usuCorreo = (usu?.usu_correo || "").trim();
        if (!usuId || usuId === params.usuarioId || !usuCorreo) continue;

        const mNeg = (m.mem_negocio || "").toUpperCase();
        if (!metaNeg.codigosUpper.has(mNeg)) continue;

        const rolMem = (m.mem_rol || "").toUpperCase();
        let esStaff =
          rolMem === "OPERADOR" || rolMem === "ADMINISTRADOR" || rolMem === "SUPERADMIN";

        if (!esStaff && Array.isArray(m.seg_membresia_perfil)) {
          for (const mp of m.seg_membresia_perfil) {
            const perObj = Array.isArray(mp.seg_perfil) ? mp.seg_perfil[0] : mp.seg_perfil;
            const clave = (perObj?.per_clave || "").toUpperCase();
            if (clave === "OPERADOR" || clave === "ADMINISTRADOR" || clave === "SUPERADMIN") {
              esStaff = true;
              break;
            }
          }
        }

        const correoLower = usuCorreo.toLowerCase();
        if (esStaff && !correosVistos.has(correoLower)) {
          correosVistos.add(correoLower);
          destinatarios.push({ id: usuId, correo: usuCorreo });
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

    // 3. Enviar correo SMTP a cada operador/admin usando el SMTP propio del negocio
    for (const d of destinatarios) {
      try {
        await enviarCorreo({
          negocio: metaNeg.canon,
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
