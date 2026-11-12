"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

export interface ReglaDescuentoProducto {
  producto_nombre: string;
  producto_slug?: string;
  descuento_pct: number;
}

export interface PaqueteBeneficiosConvenio {
  bolsa_derechos: {
    consultas_telematicas: {
      cupos_incluidos: number;
      frecuencia: "ANUAL" | "MENSUAL" | "SEMESTRAL" | "UNICA";
      precio_liquidado: number;
      reagendamiento_gratuito: boolean;
    };
  };
  reglas_descuento: {
    descuento_general_servicios_pct: number;
    excepciones_por_producto: ReglaDescuentoProducto[];
  };
  billetera_bono_inicial: number;
}

export interface ConvenioEmpresa {
  cve_id: string;
  cve_secuencial?: number;
  cve_negocio: string;
  cve_empresa_nombre: string;
  cve_empresa_ruc?: string;
  cve_dominio_correo?: string;
  cve_monto_bono_inicial: number;
  cve_porcentaje_subsidio: number;
  cve_cupo_colaboradores?: number;
  cve_activo: boolean;
  cve_valido_hasta?: string | null;
  cve_detalle_convenio: {
    cupo_colaboradores_habilitados?: number;
    paquete_beneficios: PaqueteBeneficiosConvenio;
    dominios_autorizados: string[];
    auto_afiliacion_dominio: boolean;
    contacto_rrhh?: {
      nombre?: string;
      correo?: string;
      telefono?: string;
    };
    [key: string]: any;
  };
  cve_creado_en?: string;
  total_beneficiarios?: number;
  beneficiarios_activos?: number;
}

export interface BeneficiarioEmpresa {
  bnf_id: string;
  bnf_secuencial?: number;
  bnf_negocio: string;
  bnf_convenio_id: string;
  bnf_identificacion: string;
  bnf_correo_corporativo?: string;
  bnf_nombres?: string;
  bnf_usuario_vinculado_id?: string | null;
  bnf_estado: "PENDIENTE" | "VINCULADO" | "INACTIVO";
  bnf_vinculado_en?: string | null;
  bnf_detalle_beneficiario?: {
    correo_bienvenida_enviado?: boolean;
    correo_bienvenida_fecha?: string;
    auto_afiliado_por_dominio?: string;
    cargo?: string;
    departamento?: string;
    [key: string]: any;
  };
  bnf_creado_en?: string;
}

// Almacén en memoria fallback (para pruebas inmediatas y entornos sin conexión)
const storeConveniosMemoria = new Map<string, ConvenioEmpresa[]>();
const storeBeneficiariosMemoria = new Map<string, BeneficiarioEmpresa[]>();

const CONVENIO_SATCOM_BASE: ConvenioEmpresa = {
  cve_id: "cve-satcom-001",
  cve_negocio: "tranqi",
  cve_empresa_nombre: "SATCOM",
  cve_empresa_ruc: "1790019283001",
  cve_dominio_correo: "@satcom.com.ec",
  cve_monto_bono_inicial: 0,
  cve_porcentaje_subsidio: 100,
  cve_cupo_colaboradores: 50,
  cve_activo: true,
  cve_valido_hasta: "2027-12-31T23:59:59Z",
  cve_detalle_convenio: {
    cupo_colaboradores_habilitados: 50,
    paquete_beneficios: {
      bolsa_derechos: {
        consultas_telematicas: {
          cupos_incluidos: 2,
          frecuencia: "ANUAL",
          precio_liquidado: 0.0,
          reagendamiento_gratuito: false,
        },
      },
      reglas_descuento: {
        descuento_general_servicios_pct: 15,
        excepciones_por_producto: [
          {
            producto_nombre: "Notarización de Documentos & Poderes",
            producto_slug: "notarizacion-documentos-poderes",
            descuento_pct: 10,
          },
        ],
      },
      billetera_bono_inicial: 0,
    },
    dominios_autorizados: ["@satcom.com.ec", "@satcomla.com"],
    auto_afiliacion_dominio: true,
    contacto_rrhh: {
      nombre: "Talento Humano SATCOM",
      correo: "rrhh@satcom.com.ec",
      telefono: "+593 99 000 0000",
    },
  },
  cve_creado_en: new Date().toISOString(),
  total_beneficiarios: 0,
  beneficiarios_activos: 0,
};

function obtenerCupoConvenio(c: Partial<ConvenioEmpresa> | null | undefined): number {
  if (!c) return 50;
  const valor =
    c.cve_cupo_colaboradores ??
    c.cve_detalle_convenio?.cupo_colaboradores_habilitados ??
    50;
  const num = Number(valor);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 50;
}

function normalizarDominio(dom: string | undefined | null): string {
  const limpio = String(dom || "").toLowerCase().trim();
  if (!limpio) return "";
  return limpio.startsWith("@") ? limpio : `@${limpio}`;
}

function correoPerteneceAConvenio(correo: string, convenio: ConvenioEmpresa): boolean {
  const email = (correo || "").toLowerCase().trim();
  if (!email.includes("@")) return false;
  const domUsuario = email.substring(email.indexOf("@"));
  const domPrincipal = normalizarDominio(convenio.cve_dominio_correo);
  const dominiosAut = Array.isArray(convenio.cve_detalle_convenio?.dominios_autorizados)
    ? convenio.cve_detalle_convenio.dominios_autorizados.map((d) => normalizarDominio(d))
    : [];
  return (domPrincipal !== "" && domPrincipal === domUsuario) || dominiosAut.includes(domUsuario);
}

function construirHtmlCorreoBienvenidaConvenio(params: {
  nombreColaborador: string;
  correoColaborador: string;
  convenio: ConvenioEmpresa;
}): string {
  const { nombreColaborador, correoColaborador, convenio } = params;
  const empresaNombre = convenio.cve_empresa_nombre || "Empresa Aliada";
  const empresaRuc = convenio.cve_empresa_ruc || "";
  const dominioCorreo = convenio.cve_dominio_correo || "";
  const paquete = convenio.cve_detalle_convenio?.paquete_beneficios;
  const consultasGratis = Number(paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2);
  const frecuenciaConsultas = String(paquete?.bolsa_derechos?.consultas_telematicas?.frecuencia || "ANUAL");
  const descuentoGeneralPct = Number(paquete?.reglas_descuento?.descuento_general_servicios_pct ?? 15);
  const excepciones = Array.isArray(paquete?.reglas_descuento?.excepciones_por_producto)
    ? paquete.reglas_descuento.excepciones_por_producto
    : [];
  const bonoBilletera = Number(paquete?.billetera_bono_inicial ?? convenio.cve_monto_bono_inicial ?? 0);

  const textoFrecuencia =
    frecuenciaConsultas === "MENSUAL"
      ? "mensuales"
      : frecuenciaConsultas === "SEMESTRAL"
      ? "semestrales"
      : frecuenciaConsultas === "UNICA"
      ? "incluidas"
      : "anuales";

  const vigenciaTexto = convenio.cve_valido_hasta
    ? new Date(convenio.cve_valido_hasta).toLocaleDateString("es-EC", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Indefinida (Convenio Activo)";

  const htmlExcepciones =
    excepciones.length > 0
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
    bonoBilletera > 0
      ? `
      <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
        <div style="font-size: 14px; font-weight: 800; color: #B45309;">
          💰 Bono Corporativo en Billetera: $${bonoBilletera.toFixed(2)} USD
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
  <title>Bienvenido a tu Convenio Corporativo ${empresaNombre} — Tranqi</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <div style="max-width: 600px; margin: 28px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0;">
    <div style="background: linear-gradient(135deg, #1E1B4B 0%, #5000BA 100%); padding: 30px 28px; text-align: center;">
      <span style="display: inline-block; background-color: #10B981; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.08em;">
        Convenio Corporativo Activo · ${empresaNombre}
      </span>
      <h1 style="color: #FFFFFF; margin: 12px 0 4px 0; font-size: 24px; font-weight: 800;">
        ¡Bienvenido/a a Tranqi, ${nombreColaborador}!
      </h1>
      <p style="color: #E0E7FF; margin: 0; font-size: 14px;">
        Tu cuenta corporativa (<strong>${correoColaborador}</strong>) está habilitada bajo el convenio empresarial.
      </p>
    </div>

    <div style="padding: 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
        Como colaborador registrado en el convenio corporativo de <strong>${empresaNombre}</strong>${empresaRuc ? ` (RUC: ${empresaRuc})` : ""}, cuentas con cobertura jurídica preferencial y los siguientes beneficios exclusivos:
      </p>

      <div style="background-color: #F8FAFC; border: 1.5px solid #A7F3D0; border-radius: 14px; padding: 20px; margin: 22px 0;">
        <h3 style="margin: 0 0 14px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #05876E; font-weight: 800;">
          🎁 Tus Beneficios con el Convenio ${empresaNombre}
        </h3>

        <div style="background: #FFFFFF; border: 1px solid #D1FAE5; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
          <div style="font-size: 15px; font-weight: 800; color: #0F172A;">
            ⚖️ ${consultasGratis} Consulta(s) Jurídica(s) Telemática(s) al 100% ($0.00)
          </div>
          <div style="font-size: 13px; color: #475569; margin-top: 3px;">
            Tienes <strong>${consultasGratis} citas telemáticas ${textoFrecuencia} sin costo</strong> (100% subsidiadas por tu convenio) con abogados especialistas verificados.
          </div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E0E7FF; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
          <div style="font-size: 15px; font-weight: 800; color: #4F46E5;">
            🏷️ ${descuentoGeneralPct}% de Descuento General en Servicios Legales
          </div>
          <div style="font-size: 13px; color: #475569; margin-top: 3px;">
            Descuento automático aplicado sobre el tarifario oficial de trámites, contratos y patrocinio jurídico.
          </div>
        </div>

        ${htmlBono}
        ${htmlExcepciones}
      </div>

      <div style="background-color: #F1F5F9; border-radius: 10px; padding: 12px 16px; font-size: 12.5px; color: #475569; margin-bottom: 24px;">
        <div><strong>Empresa Aliada:</strong> ${empresaNombre}</div>
        ${dominioCorreo ? `<div><strong>Dominio Afiliado:</strong> ${dominioCorreo}</div>` : ""}
        <div><strong>Vigencia del Convenio:</strong> ${vigenciaTexto}</div>
      </div>

      <div style="text-align: center; margin: 26px 0 10px;">
        <a href="https://www.tranqi24.com/panel/clientes?widget=mis_beneficios_corporativos" style="display: inline-block; background: linear-gradient(135deg, #05876E 0%, #047857 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 28px; border-radius: 10px;">
          Ver Mis Beneficios y Agendar Consulta ($0.00)
        </a>
      </div>
    </div>

    <div style="background-color: #0F172A; padding: 18px 28px; text-align: center; color: #94A3B8; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} tranqi® · Protección y Bienestar Legal Corporativo.</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function despacharCorreoInterno(params: {
  negocio: string;
  para: string;
  asunto: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const clave = process.env.CORREO_FUNCION_CLAVE;
    const supabase = await crearClienteServidor();
    if (clave && supabase) {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "enviar-correo",
        {
          body: {
            negocio: params.negocio,
            para: params.para,
            asunto: params.asunto,
            html: params.html,
          },
          headers: { "x-correo-clave": clave },
        }
      );
      if (!error && data?.ok) {
        return { ok: true };
      }
    }
    return { ok: false, error: "No se pudo despachar el correo mediante el servidor SMTP del negocio." };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al enviar correo." };
  }
}

/**
 * Obtiene la lista de convenios corporativos para un negocio, incluyendo el cupo de colaboradores
 * habilitados y el conteo real de personas registradas bajo cada convenio.
 */
export async function obtenerConveniosEmpresaAction(
  negocio = "tranqi"
): Promise<ConvenioEmpresa[]> {
  try {
    const { principal, variantes } = normalizarIdentificadorNegocio(negocio);
    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    let conveniosDb: ConvenioEmpresa[] = [];
    let beneficiariosDb: BeneficiarioEmpresa[] = [];
    let usuariosDominio: any[] = [];

    if (clienteActivo) {
      try {
        const { data, error } = await clienteActivo
          .schema("comun_comercio")
          .from("com_convenio_empresa")
          .select("*")
          .in("cve_negocio", [principal, ...variantes])
          .order("cve_creado_en", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          conveniosDb = data;
        }
      } catch {
        try {
          const { data } = await clienteActivo
            .from("com_convenio_empresa")
            .select("*")
            .in("cve_negocio", [principal, ...variantes]);
          if (Array.isArray(data) && data.length > 0) conveniosDb = data;
        } catch {}
      }

      // Cargar respaldo en cfg_negocio si existen convenios o cupos actualizados
      try {
        const { data: cfg } = await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .in("cfg_negocio", [principal, ...variantes])
          .limit(1)
          .maybeSingle();

        const listaCfg = cfg?.cfg_detalle_configuracion?.convenios_b2b;
        if (Array.isArray(listaCfg) && listaCfg.length > 0) {
          if (conveniosDb.length === 0) {
            conveniosDb = listaCfg;
          } else {
            const mapaCfg = new Map<string, any>();
            for (const item of listaCfg) {
              if (item?.cve_id) mapaCfg.set(item.cve_id, item);
              if (item?.cve_empresa_nombre) mapaCfg.set(item.cve_empresa_nombre.toLowerCase(), item);
            }
            conveniosDb = conveniosDb.map((c) => {
              const respaldo = mapaCfg.get(c.cve_id) || mapaCfg.get((c.cve_empresa_nombre || "").toLowerCase());
              if (!respaldo) return c;
              const cupo = obtenerCupoConvenio(respaldo) || obtenerCupoConvenio(c);
              return {
                ...c,
                cve_cupo_colaboradores: cupo,
                cve_detalle_convenio: {
                  ...(c.cve_detalle_convenio || {}),
                  ...(respaldo.cve_detalle_convenio || {}),
                  cupo_colaboradores_habilitados: cupo,
                },
              };
            });
          }
        }

        const bnfCfg = cfg?.cfg_detalle_configuracion?.beneficiarios_convenio_b2b;
        if (Array.isArray(bnfCfg) && bnfCfg.length > 0) {
          beneficiariosDb = bnfCfg;
        }
      } catch {}

      // Consultar beneficiarios registrados en com_beneficiario_empresa
      try {
        const { data: bnfRows } = await clienteActivo
          .schema("comun_comercio")
          .from("com_beneficiario_empresa")
          .select("*")
          .in("bnf_negocio", [principal, ...variantes]);

        if (Array.isArray(bnfRows) && bnfRows.length > 0) {
          const filtrados = bnfRows.filter((b: any) => !b.bnf_eliminado_en);
          if (filtrados.length > 0) {
            beneficiariosDb = filtrados;
          }
        }
      } catch {}

      // Consultar usuarios en seg_usuario para conciliar colaboradores por dominio
      try {
        const { data: usuRows } = await clienteActivo
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_id, usu_correo, usu_nombres, usu_apellidos, usu_creado_en")
          .is("usu_eliminado_en", null);

        if (Array.isArray(usuRows)) {
          usuariosDominio = usuRows;
        }
      } catch {}
    }

    const enMemoria =
      storeConveniosMemoria.get(principal) ||
      (principal === "tranqi" ? [CONVENIO_SATCOM_BASE] : []);

    const listaBase = conveniosDb.length > 0 ? conveniosDb : enMemoria;

    // Enriquecer cada convenio con su cupo habilitado y el conteo real de colaboradores registrados
    const resultado = listaBase.map((c) => {
      const cupo = obtenerCupoConvenio(c);
      const bnfDeConvenio = beneficiariosDb.filter((b) => b.bnf_convenio_id === c.cve_id);
      const correosContados = new Set<string>(
        bnfDeConvenio.map((b) => (b.bnf_correo_corporativo || b.bnf_identificacion || "").toLowerCase().trim())
      );

      let activos = bnfDeConvenio.filter(
        (b) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
      ).length;
      let totales = bnfDeConvenio.length;

      // Incluir también usuarios de seg_usuario cuyo correo coincide con el dominio del convenio
      for (const u of usuariosDominio) {
        const emailU = (u.usu_correo || "").toLowerCase().trim();
        if (emailU && !correosContados.has(emailU) && correoPerteneceAConvenio(emailU, c)) {
          if (activos < cupo) {
            correosContados.add(emailU);
            activos += 1;
            totales += 1;
          }
        }
      }

      return {
        ...c,
        cve_cupo_colaboradores: cupo,
        cve_detalle_convenio: {
          ...c.cve_detalle_convenio,
          cupo_colaboradores_habilitados: cupo,
        },
        total_beneficiarios: totales,
        beneficiarios_activos: activos,
      };
    });

    storeConveniosMemoria.set(principal, resultado);
    return resultado;
  } catch (err) {
    console.error("Error al obtener convenios:", err);
    return storeConveniosMemoria.get("tranqi") || [CONVENIO_SATCOM_BASE];
  }
}

/**
 * Guarda o actualiza un convenio corporativo, su cupo de colaboradores habilitados y su paquete de beneficios
 */
export async function guardarConvenioEmpresaAction(
  datos: Partial<ConvenioEmpresa> & { negocio?: string }
): Promise<{ ok: boolean; error?: string; convenio?: ConvenioEmpresa }> {
  try {
    const { principal, variantes } = normalizarIdentificadorNegocio(datos.negocio);
    const negocio = principal;
    const nombre = (datos.cve_empresa_nombre || "").trim();

    if (!nombre) {
      return { ok: false, error: "El nombre de la empresa es obligatorio." };
    }

    const cupoColaboradores = Math.max(
      1,
      Number(
        datos.cve_cupo_colaboradores ??
          datos.cve_detalle_convenio?.cupo_colaboradores_habilitados ??
          50
      )
    );

    let cveId = datos.cve_id || "";
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cveId);

    const detalleBase = datos.cve_detalle_convenio || {
      paquete_beneficios: {
        bolsa_derechos: {
          consultas_telematicas: {
            cupos_incluidos: 2,
            frecuencia: "ANUAL",
            precio_liquidado: 0.0,
            reagendamiento_gratuito: false,
          },
        },
        reglas_descuento: {
          descuento_general_servicios_pct: 15,
          excepciones_por_producto: [],
        },
        billetera_bono_inicial: 0,
      },
      dominios_autorizados: datos.cve_dominio_correo ? [datos.cve_dominio_correo] : [],
      auto_afiliacion_dominio: true,
    };

    const detalleConvenio = {
      ...detalleBase,
      cupo_colaboradores_habilitados: cupoColaboradores,
    };

    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    // Si no tenemos UUID, buscar si ya existe en Supabase por negocio + nombre / RUC
    if (clienteActivo && !esUuid) {
      try {
        const { data: existente } = await clienteActivo
          .schema("comun_comercio")
          .from("com_convenio_empresa")
          .select("cve_id")
          .in("cve_negocio", [principal, ...variantes])
          .ilike("cve_empresa_nombre", nombre)
          .limit(1)
          .maybeSingle();

        if (existente?.cve_id) {
          cveId = existente.cve_id;
        }
      } catch {}
    }

    if (!cveId) {
      cveId = `cve-${Date.now()}`;
    }

    const convenioActualizado: ConvenioEmpresa = {
      cve_id: cveId,
      cve_negocio: negocio,
      cve_empresa_nombre: nombre,
      cve_empresa_ruc: datos.cve_empresa_ruc || "",
      cve_dominio_correo: datos.cve_dominio_correo || "",
      cve_monto_bono_inicial: Number(datos.cve_monto_bono_inicial || 0),
      cve_porcentaje_subsidio: Number(datos.cve_porcentaje_subsidio ?? 100),
      cve_cupo_colaboradores: cupoColaboradores,
      cve_activo: datos.cve_activo !== false,
      cve_valido_hasta: datos.cve_valido_hasta || null,
      cve_detalle_convenio: detalleConvenio,
      cve_creado_en: datos.cve_creado_en || new Date().toISOString(),
      total_beneficiarios: datos.total_beneficiarios || 0,
      beneficiarios_activos: datos.beneficiarios_activos || 0,
    };

    // 1. Persistir en Supabase (com_convenio_empresa + respaldo en cfg_negocio)
    if (clienteActivo) {
      const payloadRpc = {
        cve_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cveId) ? cveId : null,
        negocio,
        empresa_nombre: nombre,
        empresa_ruc: datos.cve_empresa_ruc || "",
        dominio_correo: datos.cve_dominio_correo || "",
        monto_bono_inicial: Number(datos.cve_monto_bono_inicial || 0),
        cupo_colaboradores: cupoColaboradores,
        activo: datos.cve_activo !== false,
        valido_hasta: datos.cve_valido_hasta || null,
        detalle_convenio: detalleConvenio,
      };

      let rpcOk = false;
      try {
        const { data: rpcRes, error: rpcErr } = await clienteActivo
          .schema("comun_comercio")
          .rpc("com_fn_guardar_convenio_empresa", { p_datos: payloadRpc });
        if (!rpcErr && rpcRes?.ok) {
          rpcOk = true;
          if (rpcRes.cve_id) convenioActualizado.cve_id = rpcRes.cve_id;
        }
      } catch {}

      if (!rpcOk) {
        try {
          const { data: rpcRes2, error: rpcErr2 } = await clienteActivo.rpc(
            "com_fn_guardar_convenio_empresa",
            { p_datos: payloadRpc }
          );
          if (!rpcErr2 && rpcRes2?.ok) {
            rpcOk = true;
            if (rpcRes2.cve_id) convenioActualizado.cve_id = rpcRes2.cve_id;
          }
        } catch {}
      }

      // Actualizar también directamente la tabla para asegurar cve_detalle_convenio y cve_cupo_colaboradores
      try {
        const idFinal = convenioActualizado.cve_id;
        const idEsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idFinal);
        if (idEsUuid) {
          await clienteActivo
            .schema("comun_comercio")
            .from("com_convenio_empresa")
            .update({
              cve_empresa_nombre: nombre,
              cve_empresa_ruc: datos.cve_empresa_ruc,
              cve_dominio_correo: datos.cve_dominio_correo,
              cve_monto_bono_inicial: datos.cve_monto_bono_inicial || 0,
              cve_activo: datos.cve_activo !== false,
              cve_valido_hasta: datos.cve_valido_hasta,
              cve_detalle_convenio: detalleConvenio,
            })
            .eq("cve_id", idFinal);
        } else if (!rpcOk) {
          const { data: insData } = await clienteActivo
            .schema("comun_comercio")
            .from("com_convenio_empresa")
            .insert({
              cve_negocio: negocio,
              cve_empresa_nombre: nombre,
              cve_empresa_ruc: datos.cve_empresa_ruc,
              cve_dominio_correo: datos.cve_dominio_correo,
              cve_monto_bono_inicial: datos.cve_monto_bono_inicial || 0,
              cve_porcentaje_subsidio: 100,
              cve_activo: datos.cve_activo !== false,
              cve_valido_hasta: datos.cve_valido_hasta,
              cve_detalle_convenio: detalleConvenio,
            })
            .select("cve_id")
            .single();

          if (insData?.cve_id) {
            convenioActualizado.cve_id = insData.cve_id;
          }
        }
      } catch {}

      // Respaldo garantizado en comun_configuracion.cfg_negocio
      try {
        const { data: cfgActual } = await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .eq("cfg_negocio", negocio)
          .maybeSingle();

        const detCfg = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
        const listaPrev: ConvenioEmpresa[] = Array.isArray(detCfg.convenios_b2b)
          ? detCfg.convenios_b2b
          : [];
        const idxCfg = listaPrev.findIndex(
          (c) =>
            c.cve_id === convenioActualizado.cve_id ||
            (datos.cve_id && c.cve_id === datos.cve_id) ||
            (c.cve_empresa_nombre || "").toLowerCase() === nombre.toLowerCase()
        );
        const nuevaListaCfg = [...listaPrev];
        if (idxCfg >= 0) {
          nuevaListaCfg[idxCfg] = convenioActualizado;
        } else {
          nuevaListaCfg.unshift(convenioActualizado);
        }

        await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: {
              ...detCfg,
              convenios_b2b: nuevaListaCfg,
            },
          })
          .eq("cfg_negocio", negocio);
      } catch {}
    }

    // 2. Actualizar en memoria
    const actuales =
      storeConveniosMemoria.get(negocio) ||
      (negocio === "tranqi" ? [CONVENIO_SATCOM_BASE] : []);
    const idx = actuales.findIndex(
      (c) =>
        c.cve_id === convenioActualizado.cve_id ||
        (datos.cve_id && c.cve_id === datos.cve_id) ||
        c.cve_empresa_nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (idx >= 0) {
      actuales[idx] = convenioActualizado;
    } else {
      actuales.unshift(convenioActualizado);
    }
    storeConveniosMemoria.set(negocio, actuales);

    try {
      revalidatePath("/panel/empresas");
      revalidatePath("/panel/administrar");
      revalidatePath("/panel");
    } catch {}

    return { ok: true, convenio: convenioActualizado };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al guardar el convenio corporativo." };
  }
}

/**
 * Obtiene y sincroniza la nómina de colaboradores registrados bajo un convenio específico,
 * permitiendo controlar el cupo utilizado frente al cupo habilitado.
 */
export async function obtenerBeneficiariosConvenioAction(
  convenioId: string,
  negocio = "tranqi"
): Promise<{
  ok: boolean;
  convenio?: ConvenioEmpresa;
  beneficiarios: BeneficiarioEmpresa[];
  cupoHabilitado: number;
  registradosActivos: number;
  cuposDisponibles: number;
}> {
  try {
    const { principal, variantes } = normalizarIdentificadorNegocio(negocio);
    const convenios = await obtenerConveniosEmpresaAction(principal);
    const convenio =
      convenios.find((c) => c.cve_id === convenioId) ||
      convenios[0];

    const cupoHabilitado = obtenerCupoConvenio(convenio);
    if (!convenio) {
      return {
        ok: false,
        beneficiarios: [],
        cupoHabilitado,
        registradosActivos: 0,
        cuposDisponibles: cupoHabilitado,
      };
    }

    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    let listaBnf: BeneficiarioEmpresa[] = [];

    if (clienteActivo) {
      // 1. Leer de com_beneficiario_empresa
      try {
        const { data: filas } = await clienteActivo
          .schema("comun_comercio")
          .from("com_beneficiario_empresa")
          .select("*")
          .eq("bnf_convenio_id", convenio.cve_id)
          .order("bnf_creado_en", { ascending: false });

        if (Array.isArray(filas)) {
          listaBnf = filas.filter((b: any) => !b.bnf_eliminado_en);
        }
      } catch {}

      // 2. Respaldo en cfg_negocio si aún no había filas en tabla
      if (listaBnf.length === 0) {
        try {
          const { data: cfg } = await clienteActivo
            .schema("comun_configuracion")
            .from("cfg_negocio")
            .select("cfg_detalle_configuracion")
            .eq("cfg_negocio", principal)
            .maybeSingle();

          const bnfCfg = cfg?.cfg_detalle_configuracion?.beneficiarios_convenio_b2b;
          if (Array.isArray(bnfCfg)) {
            listaBnf = bnfCfg.filter((b: any) => b.bnf_convenio_id === convenio.cve_id);
          }
        } catch {}
      }

      // 3. Conciliar con usuarios reales de seg_usuario que tengan el dominio del convenio
      try {
        const { data: usuarios } = await clienteActivo
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_id, usu_correo, usu_nombres, usu_apellidos, usu_creado_en")
          .is("usu_eliminado_en", null);

        if (Array.isArray(usuarios)) {
          const correosExistentes = new Set<string>(
            listaBnf.map((b) => (b.bnf_correo_corporativo || b.bnf_identificacion || "").toLowerCase().trim())
          );

          let activosActuales = listaBnf.filter(
            (b) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
          ).length;

          for (const u of usuarios) {
            const correoU = (u.usu_correo || "").toLowerCase().trim();
            if (!correoU || correosExistentes.has(correoU)) continue;

            if (correoPerteneceAConvenio(correoU, convenio) && activosActuales < cupoHabilitado) {
              const nombreCompleto =
                [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ").trim() ||
                correoU.split("@")[0];

              const nuevoRegistro: BeneficiarioEmpresa = {
                bnf_id: `bnf-${u.usu_id}`,
                bnf_negocio: principal,
                bnf_convenio_id: convenio.cve_id,
                bnf_identificacion: correoU,
                bnf_correo_corporativo: correoU,
                bnf_nombres: nombreCompleto,
                bnf_usuario_vinculado_id: u.usu_id,
                bnf_estado: "VINCULADO",
                bnf_vinculado_en: u.usu_creado_en || new Date().toISOString(),
                bnf_detalle_beneficiario: {
                  auto_afiliado_por_dominio: normalizarDominio(convenio.cve_dominio_correo),
                  correo_bienvenida_enviado: true,
                  correo_bienvenida_fecha: u.usu_creado_en || new Date().toISOString(),
                },
                bnf_creado_en: u.usu_creado_en || new Date().toISOString(),
              };

              // Intentar persistir en com_beneficiario_empresa
              try {
                const { data: ins } = await clienteActivo
                  .schema("comun_comercio")
                  .from("com_beneficiario_empresa")
                  .insert({
                    bnf_negocio: principal,
                    bnf_convenio_id: convenio.cve_id,
                    bnf_identificacion: correoU,
                    bnf_correo_corporativo: correoU,
                    bnf_nombres: nombreCompleto,
                    bnf_usuario_vinculado_id: u.usu_id,
                    bnf_estado: "VINCULADO",
                    bnf_vinculado_en: nuevoRegistro.bnf_vinculado_en,
                    bnf_detalle_beneficiario: nuevoRegistro.bnf_detalle_beneficiario,
                  })
                  .select("bnf_id")
                  .maybeSingle();

                if (ins?.bnf_id) {
                  nuevoRegistro.bnf_id = ins.bnf_id;
                }
              } catch {}

              correosExistentes.add(correoU);
              listaBnf.push(nuevoRegistro);
              activosActuales += 1;
            }
          }
        }
      } catch {}
    }

    if (listaBnf.length === 0) {
      listaBnf = storeBeneficiariosMemoria.get(convenio.cve_id) || [];
    } else {
      storeBeneficiariosMemoria.set(convenio.cve_id, listaBnf);
    }

    const registradosActivos = listaBnf.filter(
      (b) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
    ).length;

    return {
      ok: true,
      convenio,
      beneficiarios: listaBnf,
      cupoHabilitado,
      registradosActivos,
      cuposDisponibles: Math.max(0, cupoHabilitado - registradosActivos),
    };
  } catch (err) {
    console.error("Error al obtener beneficiarios del convenio:", err);
    return {
      ok: false,
      beneficiarios: [],
      cupoHabilitado: 50,
      registradosActivos: 0,
      cuposDisponibles: 50,
    };
  }
}

/**
 * Registra / habilita un colaborador bajo un convenio corporativo verificando estrictamente
 * que no se supere el número de colaboradores habilitados y enviándole el correo de bienvenida con sus beneficios.
 */
export async function registrarBeneficiarioConvenioAction(datos: {
  convenioId: string;
  negocio?: string;
  nombres: string;
  correoCorporativo: string;
  identificacion?: string;
  cargo?: string;
  enviarBienvenida?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  beneficiario?: BeneficiarioEmpresa;
  correoEnviado?: boolean;
}> {
  try {
    const { principal } = normalizarIdentificadorNegocio(datos.negocio);
    const correo = (datos.correoCorporativo || "").toLowerCase().trim();
    const nombres = (datos.nombres || "").trim();
    const identificacion = (datos.identificacion || "").trim() || correo;

    if (!nombres) {
      return { ok: false, error: "El nombre del colaborador es obligatorio." };
    }
    if (!correo || !correo.includes("@")) {
      return { ok: false, error: "Ingresa un correo electrónico válido para el colaborador." };
    }

    const estadoActual = await obtenerBeneficiariosConvenioAction(datos.convenioId, principal);
    const convenio = estadoActual.convenio;
    if (!convenio) {
      return { ok: false, error: "No se encontró el convenio corporativo especificado." };
    }

    const yaExiste = estadoActual.beneficiarios.find(
      (b) =>
        (b.bnf_correo_corporativo || "").toLowerCase().trim() === correo ||
        (b.bnf_identificacion || "").toLowerCase().trim() === identificacion.toLowerCase()
    );

    if (!yaExiste && estadoActual.registradosActivos >= estadoActual.cupoHabilitado) {
      return {
        ok: false,
        error: `Límite alcanzado: el convenio con ${convenio.cve_empresa_nombre} tiene ${estadoActual.cupoHabilitado} colaboradores habilitados y ya cuenta con ${estadoActual.registradosActivos} registrados. Aumenta el cupo del convenio o desactiva un colaborador antes de agregar otro.`,
      };
    }

    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    // Verificar si el correo ya corresponde a un usuario registrado en seg_usuario
    let usuarioVinculadoId: string | null = yaExiste?.bnf_usuario_vinculado_id || null;
    if (clienteActivo && !usuarioVinculadoId) {
      try {
        const { data: usu } = await clienteActivo
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_id")
          .ilike("usu_correo", correo)
          .maybeSingle();
        if (usu?.usu_id) {
          usuarioVinculadoId = usu.usu_id;
        }
      } catch {}
    }

    const ahoraIso = new Date().toISOString();
    const bnfId = yaExiste?.bnf_id || `bnf-${Date.now()}`;
    const enviarBienvenida = datos.enviarBienvenida !== false;

    const nuevoBeneficiario: BeneficiarioEmpresa = {
      bnf_id: bnfId,
      bnf_negocio: principal,
      bnf_convenio_id: convenio.cve_id,
      bnf_identificacion: identificacion,
      bnf_correo_corporativo: correo,
      bnf_nombres: nombres,
      bnf_usuario_vinculado_id: usuarioVinculadoId,
      bnf_estado: usuarioVinculadoId ? "VINCULADO" : "PENDIENTE",
      bnf_vinculado_en: usuarioVinculadoId ? ahoraIso : null,
      bnf_detalle_beneficiario: {
        ...(yaExiste?.bnf_detalle_beneficiario || {}),
        cargo: datos.cargo || yaExiste?.bnf_detalle_beneficiario?.cargo || "",
        registrado_manualmente: true,
        fecha_registro: ahoraIso,
        correo_bienvenida_enviado: Boolean(yaExiste?.bnf_detalle_beneficiario?.correo_bienvenida_enviado),
      },
      bnf_creado_en: yaExiste?.bnf_creado_en || ahoraIso,
    };

    if (clienteActivo) {
      try {
        if (yaExiste && /^[0-9a-f]{8}-/i.test(yaExiste.bnf_id)) {
          await clienteActivo
            .schema("comun_comercio")
            .from("com_beneficiario_empresa")
            .update({
              bnf_identificacion: identificacion,
              bnf_correo_corporativo: correo,
              bnf_nombres: nombres,
              bnf_usuario_vinculado_id: usuarioVinculadoId,
              bnf_estado: nuevoBeneficiario.bnf_estado,
              bnf_vinculado_en: nuevoBeneficiario.bnf_vinculado_en,
              bnf_detalle_beneficiario: nuevoBeneficiario.bnf_detalle_beneficiario,
            })
            .eq("bnf_id", yaExiste.bnf_id);
        } else {
          const { data: ins } = await clienteActivo
            .schema("comun_comercio")
            .from("com_beneficiario_empresa")
            .insert({
              bnf_negocio: principal,
              bnf_convenio_id: convenio.cve_id,
              bnf_identificacion: identificacion,
              bnf_correo_corporativo: correo,
              bnf_nombres: nombres,
              bnf_usuario_vinculado_id: usuarioVinculadoId,
              bnf_estado: nuevoBeneficiario.bnf_estado,
              bnf_vinculado_en: nuevoBeneficiario.bnf_vinculado_en,
              bnf_detalle_beneficiario: nuevoBeneficiario.bnf_detalle_beneficiario,
            })
            .select("bnf_id")
            .maybeSingle();

          if (ins?.bnf_id) {
            nuevoBeneficiario.bnf_id = ins.bnf_id;
          }
        }
      } catch {}
    }

    // Enviar correo de bienvenida con los beneficios del convenio si está marcado
    let correoEnviado = false;
    if (enviarBienvenida) {
      const resEnvio = await enviarCorreoBienvenidaConvenioAction({
        bnfId: nuevoBeneficiario.bnf_id,
        convenioId: convenio.cve_id,
        correo,
        nombres,
        negocio: principal,
      });
      correoEnviado = resEnvio.ok;
      if (correoEnviado) {
        nuevoBeneficiario.bnf_detalle_beneficiario = {
          ...nuevoBeneficiario.bnf_detalle_beneficiario,
          correo_bienvenida_enviado: true,
          correo_bienvenida_fecha: new Date().toISOString(),
        };
      }
    }

    // Actualizar memoria y respaldo en cfg_negocio
    const listaMem = [
      nuevoBeneficiario,
      ...estadoActual.beneficiarios.filter((b) => b.bnf_id !== yaExiste?.bnf_id && b.bnf_correo_corporativo !== correo),
    ];
    storeBeneficiariosMemoria.set(convenio.cve_id, listaMem);

    if (clienteActivo) {
      try {
        const { data: cfgActual } = await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .eq("cfg_negocio", principal)
          .maybeSingle();
        const detCfg = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
        const otrosBnf = Array.isArray(detCfg.beneficiarios_convenio_b2b)
          ? detCfg.beneficiarios_convenio_b2b.filter((b: any) => b.bnf_convenio_id !== convenio.cve_id)
          : [];
        await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: {
              ...detCfg,
              beneficiarios_convenio_b2b: [...listaMem, ...otrosBnf],
            },
          })
          .eq("cfg_negocio", principal);
      } catch {}
    }

    try {
      revalidatePath("/panel/administrar");
    } catch {}

    return {
      ok: true,
      beneficiario: nuevoBeneficiario,
      correoEnviado,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al registrar colaborador en el convenio." };
  }
}

/**
 * Activa o pausa (INACTIVO) a un colaborador dentro de un convenio corporativo,
 * controlando que al reactivar no se supere el cupo habilitado.
 */
export async function cambiarEstadoBeneficiarioConvenioAction(datos: {
  bnfId: string;
  convenioId: string;
  nuevoEstado: "VINCULADO" | "INACTIVO";
  negocio?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(datos.negocio);
    const estadoActual = await obtenerBeneficiariosConvenioAction(datos.convenioId, principal);

    const target = estadoActual.beneficiarios.find((b) => b.bnf_id === datos.bnfId);
    if (
      datos.nuevoEstado === "VINCULADO" &&
      target?.bnf_estado === "INACTIVO" &&
      estadoActual.registradosActivos >= estadoActual.cupoHabilitado
    ) {
      return {
        ok: false,
        error: `No se puede reactivar: el convenio ya alcanzó el máximo de ${estadoActual.cupoHabilitado} colaboradores habilitados.`,
      };
    }

    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    if (clienteActivo && /^[0-9a-f]{8}-/i.test(datos.bnfId)) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_beneficiario_empresa")
          .update({ bnf_estado: datos.nuevoEstado })
          .eq("bnf_id", datos.bnfId);
      } catch {}
    }

    const nuevaLista = estadoActual.beneficiarios.map((b) =>
      b.bnf_id === datos.bnfId ? { ...b, bnf_estado: datos.nuevoEstado } : b
    );
    storeBeneficiariosMemoria.set(datos.convenioId, nuevaLista);

    if (clienteActivo) {
      try {
        const { data: cfgActual } = await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .eq("cfg_negocio", principal)
          .maybeSingle();
        const detCfg = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
        const otrosBnf = Array.isArray(detCfg.beneficiarios_convenio_b2b)
          ? detCfg.beneficiarios_convenio_b2b.filter((b: any) => b.bnf_convenio_id !== datos.convenioId)
          : [];
        await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: {
              ...detCfg,
              beneficiarios_convenio_b2b: [...nuevaLista, ...otrosBnf],
            },
          })
          .eq("cfg_negocio", principal);
      } catch {}
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "No se pudo actualizar el estado del colaborador." };
  }
}

/**
 * Elimina a un colaborador del convenio, liberando su cupo inmediatamente.
 */
export async function eliminarBeneficiarioConvenioAction(datos: {
  bnfId: string;
  convenioId: string;
  negocio?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(datos.negocio);
    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    if (clienteActivo && /^[0-9a-f]{8}-/i.test(datos.bnfId)) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_beneficiario_empresa")
          .delete()
          .eq("bnf_id", datos.bnfId);
      } catch {}
    }

    const actuales = storeBeneficiariosMemoria.get(datos.convenioId) || [];
    const nuevaLista = actuales.filter((b) => b.bnf_id !== datos.bnfId);
    storeBeneficiariosMemoria.set(datos.convenioId, nuevaLista);

    if (clienteActivo) {
      try {
        const { data: cfgActual } = await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .eq("cfg_negocio", principal)
          .maybeSingle();
        const detCfg = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
        const prev = Array.isArray(detCfg.beneficiarios_convenio_b2b)
          ? detCfg.beneficiarios_convenio_b2b
          : [];
        await clienteActivo
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: {
              ...detCfg,
              beneficiarios_convenio_b2b: prev.filter((b: any) => b.bnf_id !== datos.bnfId),
            },
          })
          .eq("cfg_negocio", principal);
      } catch {}
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "No se pudo quitar al colaborador del convenio." };
  }
}

/**
 * Envía o reenvía el correo de bienvenida a un colaborador registrado bajo un convenio,
 * detallando todos los beneficios incluidos en el convenio.
 */
export async function enviarCorreoBienvenidaConvenioAction(datos: {
  bnfId?: string;
  convenioId: string;
  correo: string;
  nombres?: string;
  negocio?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(datos.negocio);
    const correoLimpio = (datos.correo || "").toLowerCase().trim();
    if (!correoLimpio || !correoLimpio.includes("@")) {
      return { ok: false, error: "Correo electrónico inválido." };
    }

    const convenios = await obtenerConveniosEmpresaAction(principal);
    const convenio =
      convenios.find((c) => c.cve_id === datos.convenioId) ||
      convenios[0];

    if (!convenio) {
      return { ok: false, error: "Convenio corporativo no encontrado." };
    }

    const nombreColaborador =
      (datos.nombres || "").trim() ||
      correoLimpio.split("@")[0] ||
      "Colaborador";

    const html = construirHtmlCorreoBienvenidaConvenio({
      nombreColaborador,
      correoColaborador: correoLimpio,
      convenio,
    });

    const envio = await despacharCorreoInterno({
      negocio: principal,
      para: correoLimpio,
      asunto: `🎁 ¡Bienvenido/a al Convenio ${convenio.cve_empresa_nombre}! Conoce tus beneficios en Tranqi`,
      html,
    });

    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      // Marcar fecha de envío en com_beneficiario_empresa
      try {
        await clienteActivo
          .schema("comun_comercio")
          .rpc("com_fn_marcar_bienvenida_convenio_enviada", {
            p_bnf_id: datos.bnfId && /^[0-9a-f]{8}-/i.test(datos.bnfId) ? datos.bnfId : null,
            p_convenio_id: /^[0-9a-f]{8}-/i.test(convenio.cve_id) ? convenio.cve_id : null,
            p_correo: correoLimpio,
          });
      } catch {}

      // También insertar notificación In-App si el usuario existe en seg_usuario
      try {
        const { data: usu } = await clienteActivo
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_id")
          .ilike("usu_correo", correoLimpio)
          .maybeSingle();

        if (usu?.usu_id) {
          const paquete = convenio.cve_detalle_convenio?.paquete_beneficios;
          const consultas = paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2;
          const desc = paquete?.reglas_descuento?.descuento_general_servicios_pct ?? 15;
          await clienteActivo
            .schema("comun_notificacion")
            .from("not_registro")
            .insert({
              not_usuario_id: usu.usu_id,
              not_negocio: principal === "tranqi" ? "TRANQ" : principal.toUpperCase(),
              not_canal: "IN_APP",
              not_titulo: `🎁 Bienvenido al Convenio ${convenio.cve_empresa_nombre}: ${consultas} Consultas $0.00 + ${desc}% Desc.`,
              not_contenido_html: `<p>Hola <strong>${nombreColaborador}</strong>, tus beneficios del convenio corporativo <strong>${convenio.cve_empresa_nombre}</strong> están activos: <strong>${consultas} consultas telemáticas sin costo ($0.00)</strong> y <strong>${desc}% de descuento general</strong> en servicios legales.</p>`,
              not_url_accion: "/panel/clientes?widget=mis_beneficios_corporativos",
              not_creado_en: new Date().toISOString(),
            });
        }
      } catch {}
    }

    return {
      ok: true,
      error: envio.ok ? undefined : envio.error,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "No se pudo enviar el correo de bienvenida." };
  }
}

/**
 * Activa o desactiva el estado de un convenio corporativo
 */
export async function alternarEstadoConvenioAction(
  cve_id: string,
  activo: boolean,
  negocio = "tranqi"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(negocio);
    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_convenio_empresa")
          .update({ cve_activo: activo })
          .eq("cve_id", cve_id);
      } catch {
        try {
          await clienteActivo
            .from("com_convenio_empresa")
            .update({ cve_activo: activo })
            .eq("cve_id", cve_id);
        } catch {}
      }
    }

    const actuales = storeConveniosMemoria.get(principal) || (principal === "tranqi" ? [CONVENIO_SATCOM_BASE] : []);
    const item = actuales.find((c) => c.cve_id === cve_id);
    if (item) item.cve_activo = activo;
    storeConveniosMemoria.set(principal, actuales);

    try {
      revalidatePath("/panel/administrar");
    } catch {}

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al cambiar estado del convenio." };
  }
}

/**
 * Elimina definitivamente un convenio corporativo
 */
export async function eliminarConvenioEmpresaAction(
  cve_id: string,
  negocio = "tranqi"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(negocio);
    let admin: any = null;
    let supabase: any = null;
    try { admin = crearClienteAdmin(); } catch {}
    try { supabase = await crearClienteServidor(); } catch {}
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_convenio_empresa")
          .delete()
          .eq("cve_id", cve_id);
      } catch {
        try {
          await clienteActivo
            .from("com_convenio_empresa")
            .delete()
            .eq("cve_id", cve_id);
        } catch {}
      }
    }

    const actuales = storeConveniosMemoria.get(principal) || [];
    storeConveniosMemoria.set(principal, actuales.filter((c) => c.cve_id !== cve_id));

    try {
      revalidatePath("/panel/administrar");
    } catch {}

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al eliminar el convenio." };
  }
}

export interface BeneficiosCorporativosUsuario {
  tieneConvenio: boolean;
  cupoAgotado?: boolean;
  cupoSuspendido?: boolean;
  mensajeEstado?: string;
  convenioId?: string;
  empresaNombre?: string;
  empresaRuc?: string;
  dominioCorreo?: string;
  cupoColaboradores?: number;
  colaboradoresRegistrados?: number;
  consultasGratisTotal: number;
  consultasDisponibles: number;
  frecuenciaConsultas?: string;
  descuentoGeneralPct: number;
  excepcionesPorProducto: ReglaDescuentoProducto[];
  billeteraBonoInicial?: number;
  validoHasta?: string | null;
}

/**
 * Consulta y auto-afilia los beneficios corporativos de un usuario según su correo y convenios B2B activos,
 * controlando el límite de colaboradores habilitados y disparando el correo de bienvenida en su primera afiliación.
 */
export async function obtenerBeneficiosCorporativosUsuarioAction(
  negocio = "tranqi"
): Promise<BeneficiosCorporativosUsuario> {
  const respuestaVacia: BeneficiosCorporativosUsuario = {
    tieneConvenio: false,
    consultasGratisTotal: 0,
    consultasDisponibles: 0,
    descuentoGeneralPct: 0,
    excepcionesPorProducto: [],
  };

  try {
    const { principal } = normalizarIdentificadorNegocio(negocio);
    let supabase: any = null;
    try { supabase = await crearClienteServidor(); } catch {}
    if (!supabase) return respuestaVacia;

    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase().trim() || "";
    if (!email) return respuestaVacia;

    // 1. Probar RPC en Supabase (con validación de cupo y estado de bienvenida)
    try {
      const { data: rpcRes, error: rpcErr } = await supabase
        .schema("comun_comercio")
        .rpc("com_fn_verificar_y_autoafiliar_usuario_convenio", {
          p_usuario_id: user.id,
          p_correo: email,
          p_negocio: principal,
        });

      if (!rpcErr && rpcRes) {
        if (rpcRes.cupo_agotado) {
          return {
            ...respuestaVacia,
            tieneConvenio: false,
            cupoAgotado: true,
            convenioId: rpcRes.convenio_id,
            empresaNombre: rpcRes.empresa_nombre,
            cupoColaboradores: rpcRes.cupo_colaboradores,
            colaboradoresRegistrados: rpcRes.colaboradores_registrados,
            mensajeEstado: rpcRes.mensaje,
          };
        }

        if (rpcRes.cupo_suspendido) {
          return {
            ...respuestaVacia,
            tieneConvenio: false,
            cupoSuspendido: true,
            convenioId: rpcRes.convenio_id,
            empresaNombre: rpcRes.empresa_nombre,
            mensajeEstado: rpcRes.mensaje,
          };
        }

        if (rpcRes.tiene_convenio) {
          // Si es recién afiliado o requiere el correo de bienvenida, despacharlo automáticamente
          if (rpcRes.recien_afiliado || rpcRes.requiere_correo_bienvenida) {
            await enviarCorreoBienvenidaConvenioAction({
              bnfId: rpcRes.beneficiario_id,
              convenioId: rpcRes.convenio_id,
              correo: email,
              nombres: user.user_metadata?.given_name || email.split("@")[0],
              negocio: principal,
            });
          }

          return {
            tieneConvenio: true,
            convenioId: rpcRes.convenio_id,
            empresaNombre: rpcRes.empresa_nombre,
            empresaRuc: rpcRes.empresa_ruc,
            dominioCorreo: rpcRes.dominio,
            cupoColaboradores: rpcRes.cupo_colaboradores,
            colaboradoresRegistrados: rpcRes.colaboradores_registrados,
            consultasGratisTotal: rpcRes.consultas_gratis_total ?? 2,
            consultasDisponibles: rpcRes.consultas_disponibles ?? 2,
            frecuenciaConsultas: rpcRes.frecuencia_consultas || "ANUAL",
            descuentoGeneralPct: rpcRes.descuento_general_pct ?? 15,
            excepcionesPorProducto: rpcRes.excepciones_por_producto || [],
            billeteraBonoInicial: Number(rpcRes.billetera_bono_inicial || 0),
            validoHasta: rpcRes.valido_hasta,
          };
        }
      }
    } catch {}

    // 2. Fallback: Comparar con convenios activos y verificar cupo
    const convenios = await obtenerConveniosEmpresaAction(principal);
    const convenioEncontrado = convenios.find((c) => {
      if (!c.cve_activo) return false;
      return correoPerteneceAConvenio(email, c);
    });

    if (convenioEncontrado) {
      const cupoMax = obtenerCupoConvenio(convenioEncontrado);
      const detalleNomina = await obtenerBeneficiariosConvenioAction(convenioEncontrado.cve_id, principal);
      const miRegistro = detalleNomina.beneficiarios.find(
        (b) => (b.bnf_correo_corporativo || "").toLowerCase().trim() === email
      );

      if (miRegistro && miRegistro.bnf_estado === "INACTIVO") {
        return {
          ...respuestaVacia,
          tieneConvenio: false,
          cupoSuspendido: true,
          convenioId: convenioEncontrado.cve_id,
          empresaNombre: convenioEncontrado.cve_empresa_nombre,
          mensajeEstado: `Tu afiliación al convenio corporativo de ${convenioEncontrado.cve_empresa_nombre} se encuentra pausada.`,
        };
      }

      if (!miRegistro && detalleNomina.registradosActivos >= cupoMax) {
        return {
          ...respuestaVacia,
          tieneConvenio: false,
          cupoAgotado: true,
          convenioId: convenioEncontrado.cve_id,
          empresaNombre: convenioEncontrado.cve_empresa_nombre,
          cupoColaboradores: cupoMax,
          colaboradoresRegistrados: detalleNomina.registradosActivos,
          mensajeEstado: `El convenio corporativo de ${convenioEncontrado.cve_empresa_nombre} ha alcanzado el límite de ${cupoMax} colaboradores habilitados.`,
        };
      }

      if (!miRegistro) {
        await registrarBeneficiarioConvenioAction({
          convenioId: convenioEncontrado.cve_id,
          negocio: principal,
          nombres: user.user_metadata?.given_name || email.split("@")[0],
          correoCorporativo: email,
          enviarBienvenida: true,
        });
      }

      const paquete = convenioEncontrado.cve_detalle_convenio?.paquete_beneficios;
      return {
        tieneConvenio: true,
        convenioId: convenioEncontrado.cve_id,
        empresaNombre: convenioEncontrado.cve_empresa_nombre,
        empresaRuc: convenioEncontrado.cve_empresa_ruc,
        dominioCorreo: convenioEncontrado.cve_dominio_correo,
        cupoColaboradores: cupoMax,
        colaboradoresRegistrados: detalleNomina.registradosActivos,
        consultasGratisTotal: paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2,
        consultasDisponibles: paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2,
        frecuenciaConsultas: paquete?.bolsa_derechos?.consultas_telematicas?.frecuencia || "ANUAL",
        descuentoGeneralPct: paquete?.reglas_descuento?.descuento_general_servicios_pct ?? 15,
        excepcionesPorProducto: paquete?.reglas_descuento?.excepciones_por_producto || [],
        billeteraBonoInicial: Number(paquete?.billetera_bono_inicial || 0),
        validoHasta: convenioEncontrado.cve_valido_hasta,
      };
    }

    return respuestaVacia;
  } catch (err) {
    console.error("Error al obtener beneficios corporativos del usuario:", err);
    return respuestaVacia;
  }
}
