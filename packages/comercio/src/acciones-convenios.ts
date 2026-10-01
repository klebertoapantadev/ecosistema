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
  cve_activo: boolean;
  cve_valido_hasta?: string | null;
  cve_detalle_convenio: {
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
  bnf_usuario_vinculado_id?: string;
  bnf_estado: "PENDIENTE" | "VINCULADO" | "INACTIVO";
  bnf_vinculado_en?: string;
  bnf_detalle_beneficiario?: any;
  bnf_creado_en?: string;
}

// Almacén en memoria fallback (para pruebas inmediatas y entornos sin conexión)
const storeConveniosMemoria = new Map<string, ConvenioEmpresa[]>();

const CONVENIO_SATCOM_BASE: ConvenioEmpresa = {
  cve_id: "cve-satcom-001",
  cve_negocio: "tranqi",
  cve_empresa_nombre: "SATCOM",
  cve_empresa_ruc: "1790019283001",
  cve_dominio_correo: "@satcom.com.ec",
  cve_monto_bono_inicial: 0,
  cve_porcentaje_subsidio: 100,
  cve_activo: true,
  cve_valido_hasta: "2027-12-31T23:59:59Z",
  cve_detalle_convenio: {
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
  total_beneficiarios: 14,
  beneficiarios_activos: 12,
};

/**
 * Obtiene la lista de convenios corporativos para un negocio
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

    let conveniosDb: any[] = [];
    if (clienteActivo) {
      try {
        const { data, error } = await clienteActivo
          .schema("comun_comercio")
          .from("com_convenio_empresa")
          .select("*, com_beneficiario_empresa(count)")
          .in("cve_negocio", [principal, ...variantes])
          .order("cve_creado_en", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          conveniosDb = data.map((d: any) => ({
            ...d,
            total_beneficiarios: d.com_beneficiario_empresa?.[0]?.count || 0,
          }));
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
    }

    const enMemoria = storeConveniosMemoria.get(principal) || (principal === "tranqi" ? [CONVENIO_SATCOM_BASE] : []);

    if (conveniosDb.length > 0) {
      // Sincronizar memoria con lo que viene de la BDD
      storeConveniosMemoria.set(principal, conveniosDb);
      return conveniosDb;
    }

    return enMemoria;
  } catch (err) {
    console.error("Error al obtener convenios:", err);
    return storeConveniosMemoria.get("tranqi") || [CONVENIO_SATCOM_BASE];
  }
}

/**
 * Guarda o actualiza un convenio corporativo y su paquete de beneficios
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

    let cveId = datos.cve_id || "";
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cveId);

    const detalleConvenio = datos.cve_detalle_convenio || {
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
      cve_activo: datos.cve_activo !== false,
      cve_valido_hasta: datos.cve_valido_hasta || null,
      cve_detalle_convenio: detalleConvenio,
      cve_creado_en: datos.cve_creado_en || new Date().toISOString(),
      total_beneficiarios: datos.total_beneficiarios || 0,
      beneficiarios_activos: datos.beneficiarios_activos || 0,
    };

    // 1. Persistir en Supabase
    if (clienteActivo) {
      const payloadRpc = {
        cve_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cveId) ? cveId : null,
        negocio,
        empresa_nombre: nombre,
        empresa_ruc: datos.cve_empresa_ruc || "",
        dominio_correo: datos.cve_dominio_correo || "",
        monto_bono_inicial: Number(datos.cve_monto_bono_inicial || 0),
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

      if (!rpcOk) {
        try {
          const idEsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cveId);
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
              .eq("cve_id", cveId);
          } else {
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
      }
    }

    // 2. Actualizar en memoria (reemplazando cualquier versión previa por ID o Nombre)
    const actuales = storeConveniosMemoria.get(negocio) || (negocio === "tranqi" ? [CONVENIO_SATCOM_BASE] : []);
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
