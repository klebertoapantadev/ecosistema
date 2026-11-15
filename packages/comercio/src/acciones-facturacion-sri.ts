"use server";

// Acciones de servidor para Configuración y Gestión de Facturación Electrónica SRI (PLT-006).
// Diseñado con persistencia transaccional vía RPCs en comun_comercio (hacia comun_facturacion + Supabase Vault)
// y sincronización resiliente de metadatos no sensibles en comun_configuracion.cfg_negocio.

import { revalidatePath } from "next/cache";
import forge from "node-forge";
import { z } from "zod";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import {
  obtenerEmisorDefectoPorNegocio,
  type CertificadoFirmaSriResumen,
  type ConfiguracionEmisorSri,
  type RegimenTributarioSri,
  type SecuencialSriResumen,
} from "./ride-sri";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

export interface EstadoConfiguracionFacturacionSri {
  ok: boolean;
  error?: string;
  emisor: ConfiguracionEmisorSri;
  secuenciales: SecuencialSriResumen[];
  certificados: CertificadoFirmaSriResumen[];
  esSuperadmin: boolean;
  almacenamientoVaultDisponible: boolean;
  datosNegocioSugeridos: {
    ruc: string | null;
    razonSocial: string | null;
    nombreComercial: string | null;
    direccion: string | null;
    correo: string | null;
  };
}

const esquemaEmisorSri = z.object({
  ruc: z
    .string()
    .trim()
    .regex(/^[0-9]{13}$/, "El RUC debe tener exactamente 13 dígitos numéricos.")
    .refine((v) => v.endsWith("001"), "El RUC ecuatoriano debe terminar en 001."),
  razonSocial: z.string().trim().min(3, "Ingresa la Razón Social registrada en el SRI.").max(300),
  nombreComercial: z.string().trim().max(300).optional().default(""),
  direccionMatriz: z.string().trim().min(5, "Ingresa la dirección de la matriz.").max(300),
  direccionEstablecimiento: z.string().trim().max(300).optional().default(""),
  establecimiento: z
    .string()
    .trim()
    .regex(/^[0-9]{3}$/, "El establecimiento debe tener 3 dígitos (ej. 001)."),
  puntoEmision: z
    .string()
    .trim()
    .regex(/^[0-9]{3}$/, "El punto de emisión debe tener 3 dígitos (ej. 001)."),
  obligadoContabilidad: z.boolean(),
  regimen: z.enum(["GENERAL", "RIMPE_EMPRENDEDOR", "RIMPE_NEGOCIO_POPULAR"]),
  contribuyenteEspecial: z.string().trim().max(20).nullable().optional(),
  agenteRetencion: z.string().trim().max(20).nullable().optional(),
  correoCopia: z
    .union([z.literal(""), z.string().trim().email("Correo de copia inválido.")])
    .nullable()
    .optional(),
  emisionAutomatica: z.boolean(),
  activo: z.boolean(),
});

// Arcos OID privados de Entidades Certificadoras acreditadas en Ecuador (BCE, Security Data, Uanataca).
const ARCOS_OID_CA_ECUADOR = [
  "1.3.6.1.4.1.37746.", // Banco Central del Ecuador
  "1.3.6.1.4.1.37947.", // Security Data
  "1.3.6.1.4.1.47286.", // Uanataca / Consejo de la Judicatura
];

function extraerMetadatosPkcs12Ecuador(
  bytesP12: Buffer,
  claveP12: string,
): {
  titular: string;
  identificacion: string | null;
  identificacionesCandidatas: string[];
  emisorCa: string;
  numeroSerie: string;
  validoDesde: string;
  validoHasta: string;
  huellaSha1: string;
} {
  if (!bytesP12 || bytesP12.length < 64) {
    throw new Error("El archivo .p12 está vacío o corrupto.");
  }
  if (bytesP12.length > 512 * 1024) {
    throw new Error("El archivo .p12 supera el tamaño máximo permitido (512 KB).");
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const derStr = bytesP12.toString("binary");
    const asn1 = forge.asn1.fromDer(derStr);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, claveP12);
  } catch {
    throw new Error("No se pudo abrir el archivo .p12. Verifica que la contraseña sea correcta.");
  }

  const pkcs8Oid = String((forge.pki.oids as any).pkcs8ShroudedKeyBag || "1.2.840.113549.1.12.10.1.2");
  const keyOid = String((forge.pki.oids as any).keyBag || "1.2.840.113549.1.12.10.1.1");
  const certOid = String((forge.pki.oids as any).certBag || "1.2.840.113549.1.12.10.1.3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p12Any = p12 as any;
  const keyBags: any[] = [
    ...(p12Any.getBags({ bagType: pkcs8Oid })[pkcs8Oid] ?? []),
    ...(p12Any.getBags({ bagType: keyOid })[keyOid] ?? []),
  ].filter((b: any) => Boolean(b.key));

  const certBags: any[] = (
    p12Any.getBags({ bagType: certOid })[certOid] ?? []
  ).filter((b: any) => Boolean(b.cert));

  if (keyBags.length === 0 || certBags.length === 0) {
    throw new Error("El archivo .p12 no contiene una clave privada y certificado X.509 válidos.");
  }

  // Emparejar certificado firmante con su clave privada RSA y uso digitalSignature / nonRepudiation
  let certElegido: forge.pki.Certificate | null = null;
  for (const cb of certBags) {
    const cert = cb.cert!;
    const pubN = (cert.publicKey as forge.pki.rsa.PublicKey | undefined)?.n?.toString(16);
    if (!pubN) continue;
    const tieneClave = keyBags.some(
      (kb: any) => (kb.key as forge.pki.rsa.PrivateKey | undefined)?.n?.toString(16) === pubN,
    );
    if (!tieneClave) continue;

    const extUso = cert.getExtension("keyUsage") as
      | { digitalSignature?: boolean; nonRepudiation?: boolean }
      | undefined;
    if (extUso && !extUso.digitalSignature && !extUso.nonRepudiation) {
      continue;
    }
    certElegido = cert;
    if (extUso?.digitalSignature || extUso?.nonRepudiation) break;
  }

  if (!certElegido && certBags[0]?.cert) {
    certElegido = certBags[0].cert;
  }

  if (!certElegido) {
    throw new Error("No se encontró un certificado X.509 válido en el archivo .p12.");
  }

  const ahora = new Date();
  if (certElegido.validity.notAfter < ahora) {
    throw new Error(
      `El certificado electrónico venció el ${certElegido.validity.notAfter.toLocaleDateString("es-EC")}.`,
    );
  }

  const attrCn = certElegido.subject.getField("CN");
  const attrIssuerCn = certElegido.issuer.getField("CN") || certElegido.issuer.getField("O");
  const titular = String(attrCn?.value || "Titular Firma Electrónica").trim();
  const emisorCa = String(attrIssuerCn?.value || "Entidad Certificadora Acreditada").trim();

  // Extraer RUC (13) o Cédula (10) desde SERIALNUMBER y extensiones de CA ecuatorianas
  const textosId: string[] = [];
  for (const attr of certElegido.subject.attributes) {
    if (attr.type === "2.5.4.5" && attr.value) {
      textosId.push(String(attr.value));
    }
  }
  for (const ext of (certElegido.extensions || []) as Array<{ id?: string; value?: string }>) {
    if (!ext.id || !ext.value) continue;
    if (ARCOS_OID_CA_ECUADOR.some((arco) => ext.id!.startsWith(arco))) {
      try {
        const nodo = forge.asn1.fromDer(ext.value, false);
        if (typeof nodo.value === "string") {
          textosId.push(nodo.value);
        }
      } catch {
        textosId.push(ext.value);
      }
    }
  }
  const candidatas = Array.from(
    new Set(
      textosId.flatMap((t) => t.match(/(?<![0-9])([0-9]{13}|[0-9]{10})(?![0-9])/g) ?? []),
    ),
  );
  const identificacion =
    candidatas.find((c) => c.length === 13) || candidatas.find((c) => c.length === 10) || null;

  const derCert = forge.asn1.toDer(forge.pki.certificateToAsn1(certElegido)).getBytes();
  const mdSha1 = forge.md.sha1.create();
  mdSha1.update(derCert);
  const huellaSha1 = mdSha1.digest().toHex().toUpperCase();

  return {
    titular,
    identificacion,
    identificacionesCandidatas: candidatas,
    emisorCa,
    numeroSerie: String(certElegido.serialNumber || "").toUpperCase(),
    validoDesde: certElegido.validity.notBefore.toISOString(),
    validoHasta: certElegido.validity.notAfter.toISOString(),
    huellaSha1,
  };
}

function mapearEmisorDesdeFila(negocio: string, raw: any): ConfiguracionEmisorSri {
  const base = obtenerEmisorDefectoPorNegocio(negocio);
  if (!raw || typeof raw !== "object") return base;
  return {
    negocio,
    ruc: String(raw.emi_ruc ?? raw.ruc ?? base.ruc),
    razonSocial: String(raw.emi_razon_social ?? raw.razonSocial ?? raw.razon_social ?? base.razonSocial),
    nombreComercial: String(
      raw.emi_nombre_comercial ?? raw.nombreComercial ?? raw.nombre_comercial ?? base.nombreComercial,
    ),
    direccionMatriz: String(
      raw.emi_direccion_matriz ?? raw.direccionMatriz ?? raw.direccion_matriz ?? base.direccionMatriz,
    ),
    direccionEstablecimiento: String(
      raw.emi_direccion_establecimiento ??
        raw.direccionEstablecimiento ??
        raw.direccion_establecimiento ??
        raw.emi_direccion_matriz ??
        raw.direccionMatriz ??
        base.direccionEstablecimiento,
    ),
    establecimiento: String(raw.emi_establecimiento ?? raw.establecimiento ?? base.establecimiento)
      .padStart(3, "0")
      .slice(-3),
    puntoEmision: String(raw.emi_punto_emision ?? raw.puntoEmision ?? raw.punto_emision ?? base.puntoEmision)
      .padStart(3, "0")
      .slice(-3),
    obligadoContabilidad:
      typeof raw.emi_obligado_contabilidad === "boolean"
        ? raw.emi_obligado_contabilidad
        : typeof raw.obligadoContabilidad === "boolean"
          ? raw.obligadoContabilidad
          : base.obligadoContabilidad,
    regimen: ((raw.emi_regimen ?? raw.regimen ?? base.regimen) as RegimenTributarioSri) || base.regimen,
    contribuyenteEspecial:
      raw.emi_contribuyente_especial ?? raw.contribuyenteEspecial ?? base.contribuyenteEspecial ?? null,
    agenteRetencion: raw.emi_agente_retencion ?? raw.agenteRetencion ?? base.agenteRetencion ?? null,
    correoCopia: raw.emi_correo_copia ?? raw.correoCopia ?? base.correoCopia ?? null,
    ambiente: Number(raw.emi_ambiente ?? raw.ambiente ?? base.ambiente) === 2 ? 2 : 1,
    produccionHabilitada: Boolean(
      raw.emi_produccion_habilitada ?? raw.produccionHabilitada ?? base.produccionHabilitada,
    ),
    emisionAutomatica:
      typeof raw.emi_emision_automatica === "boolean"
        ? raw.emi_emision_automatica
        : typeof raw.emisionAutomatica === "boolean"
          ? raw.emisionAutomatica
          : base.emisionAutomatica,
    activo:
      typeof raw.emi_activo === "boolean"
        ? raw.emi_activo
        : typeof raw.activo === "boolean"
          ? raw.activo
          : base.activo,
    actualizadoEn: raw.emi_actualizado_en ?? raw.actualizadoEn ?? null,
  };
}

/**
 * Consulta pública (sin secretos) de los datos tributarios del emisor para renderizar
 * el RIDE de Facturas Electrónicas en vistas de cliente, checkout y panel operativo.
 */
export async function obtenerEmisorRideNegocioAction(
  negocio = "tinkay",
): Promise<ConfiguracionEmisorSri> {
  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const db: any = admin || supabase;

  // 1. Intentar vía RPC pública en comun_comercio -> comun_facturacion.fac_emisor
  try {
    const { data: rpcRes, error: rpcErr } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_obtener_emisor_ride_publico", { p_negocio: negPrincipal });
    if (!rpcErr && rpcRes?.ok && rpcRes?.emisor) {
      return mapearEmisorDesdeFila(negPrincipal, rpcRes.emisor);
    }
  } catch {
    // Continúa al respaldo en cfg_negocio
  }

  // 2. Respaldo desde comun_configuracion.cfg_negocio (expuesto en PostgREST)
  try {
    const { data: cfgRow } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_identificacion, cfg_razon_social, cfg_nombre_comercial, cfg_detalle_configuracion")
      .eq("cfg_negocio", negPrincipal)
      .maybeSingle();

    if (cfgRow) {
      const det = (cfgRow.cfg_detalle_configuracion as Record<string, any>) || {};
      const sriGuardado = det.facturacion_sri?.emisor || null;
      if (sriGuardado) {
        return mapearEmisorDesdeFila(negPrincipal, sriGuardado);
      }

      const base = obtenerEmisorDefectoPorNegocio(negPrincipal);
      const rucCfg =
        cfgRow.cfg_identificacion && /^[0-9]{13}$/.test(String(cfgRow.cfg_identificacion).trim())
          ? String(cfgRow.cfg_identificacion).trim()
          : base.ruc;
      return {
        ...base,
        ruc: rucCfg,
        razonSocial: cfgRow.cfg_razon_social || base.razonSocial,
        nombreComercial: cfgRow.cfg_nombre_comercial || base.nombreComercial,
        direccionMatriz: det.direccion || det.logistica?.origenDireccion || base.direccionMatriz,
        direccionEstablecimiento:
          det.logistica?.origenDireccion || det.direccion || base.direccionEstablecimiento,
        correoCopia: det.correo_contacto || base.correoCopia,
      };
    }
  } catch {
    // Retornar valores por defecto del negocio
  }

  return obtenerEmisorDefectoPorNegocio(negPrincipal);
}

/**
 * Carga la configuración integral de Facturación Electrónica SRI (Emisor, Secuenciales,
 * Certificados en Vault y datos base del negocio para sincronización rápida).
 */
export async function obtenerConfiguracionFacturacionSriAction(
  negocio = "tinkay",
): Promise<EstadoConfiguracionFacturacionSri> {
  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const db: any = admin || supabase;

  let esSuperadmin = false;
  try {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (uid) {
      const { data: usuRow } = await (db || supabase)
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_superadmin_plataforma")
        .eq("usu_id", uid)
        .maybeSingle();
      esSuperadmin = Boolean(usuRow?.usu_superadmin_plataforma);
    }
  } catch {
    // Sin sesión o lectura restringida
  }

  // Leer cfg_negocio para sugerencias y respaldo híbrido
  let cfgRow: any = null;
  try {
    const { data } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_identificacion, cfg_razon_social, cfg_nombre_comercial, cfg_detalle_configuracion")
      .eq("cfg_negocio", negPrincipal)
      .maybeSingle();
    cfgRow = data;
  } catch {
    // Ignorar
  }

  const detCfg = (cfgRow?.cfg_detalle_configuracion as Record<string, any>) || {};
  const datosNegocioSugeridos = {
    ruc: cfgRow?.cfg_identificacion || null,
    razonSocial: cfgRow?.cfg_razon_social || null,
    nombreComercial: cfgRow?.cfg_nombre_comercial || null,
    direccion: detCfg.direccion || detCfg.logistica?.origenDireccion || null,
    correo: detCfg.correo_contacto || null,
  };

  // 1. Vía canónica: RPC en comun_comercio que lee comun_facturacion (fac_emisor, fac_secuencial, fac_certificado)
  try {
    const { data: rpcRes, error: rpcErr } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_obtener_configuracion_facturacion_sri", { p_negocio: negPrincipal });

    if (!rpcErr && rpcRes?.ok) {
      const emisorRpc = mapearEmisorDesdeFila(negPrincipal, rpcRes.emisor);
      const secuencialesRpc: SecuencialSriResumen[] = Array.isArray(rpcRes.secuenciales)
        ? rpcRes.secuenciales.map((s: any) => ({
            negocio: negPrincipal,
            ambiente: Number(s.sec_ambiente ?? s.ambiente ?? 1) === 2 ? 2 : 1,
            establecimiento: String(s.sec_establecimiento ?? s.establecimiento ?? emisorRpc.establecimiento),
            puntoEmision: String(s.sec_punto_emision ?? s.puntoEmision ?? emisorRpc.puntoEmision),
            tipoComprobante: (s.sec_tipo_comprobante ?? s.tipoComprobante ?? "01") as "01" | "04",
            ultimoNumero: Number(s.sec_ultimo_numero ?? s.ultimoNumero ?? 0),
          }))
        : [];

      const certificadosRpc: CertificadoFirmaSriResumen[] = Array.isArray(rpcRes.certificados)
        ? rpcRes.certificados.map((c: any) => ({
            id: String(c.cer_id ?? c.id),
            negocio: negPrincipal,
            titular: String(c.cer_titular ?? c.titular ?? ""),
            identificacionCertificado:
              c.cer_identificacion_certificado ?? c.identificacionCertificado ?? null,
            emisorCa: String(c.cer_emisor_ca ?? c.emisorCa ?? ""),
            numeroSerie: String(c.cer_numero_serie ?? c.numeroSerie ?? ""),
            validoDesde: String(c.cer_valido_desde ?? c.validoDesde ?? ""),
            validoHasta: String(c.cer_valido_hasta ?? c.validoHasta ?? ""),
            huellaSha1: String(c.cer_huella_sha1 ?? c.huellaSha1 ?? ""),
            activo: Boolean(c.cer_activo ?? c.activo),
            creadoEn: c.cer_creado_en ?? c.creadoEn,
          }))
        : [];

      return {
        ok: true,
        emisor: emisorRpc,
        secuenciales:
          secuencialesRpc.length > 0
            ? secuencialesRpc
            : construirSecuencialesPorDefecto(negPrincipal, emisorRpc),
        certificados: certificadosRpc,
        esSuperadmin: Boolean(rpcRes.es_superadmin ?? esSuperadmin),
        almacenamientoVaultDisponible: true,
        datosNegocioSugeridos,
      };
    }
  } catch {
    // Si la migración RPC aún no ha sido aplicada en Supabase, usar respaldo híbrido en cfg_negocio
  }

  const sriRespaldo = detCfg.facturacion_sri || {};
  const emisorRespaldo = sriRespaldo.emisor
    ? mapearEmisorDesdeFila(negPrincipal, sriRespaldo.emisor)
    : await obtenerEmisorRideNegocioAction(negPrincipal);

  const secuencialesRespaldo: SecuencialSriResumen[] = Array.isArray(sriRespaldo.secuenciales)
    ? sriRespaldo.secuenciales
    : construirSecuencialesPorDefecto(negPrincipal, emisorRespaldo);

  const certificadosRespaldo: CertificadoFirmaSriResumen[] = Array.isArray(
    sriRespaldo.certificados_metadatos,
  )
    ? sriRespaldo.certificados_metadatos
    : [];

  return {
    ok: true,
    emisor: emisorRespaldo,
    secuenciales: secuencialesRespaldo,
    certificados: certificadosRespaldo,
    esSuperadmin,
    almacenamientoVaultDisponible: false,
    datosNegocioSugeridos,
  };
}

function construirSecuencialesPorDefecto(
  negocio: string,
  emisor: ConfiguracionEmisorSri,
): SecuencialSriResumen[] {
  return [
    {
      negocio,
      ambiente: 1,
      establecimiento: emisor.establecimiento,
      puntoEmision: emisor.puntoEmision,
      tipoComprobante: "01",
      ultimoNumero: 0,
    },
    {
      negocio,
      ambiente: 1,
      establecimiento: emisor.establecimiento,
      puntoEmision: emisor.puntoEmision,
      tipoComprobante: "04",
      ultimoNumero: 0,
    },
    {
      negocio,
      ambiente: 2,
      establecimiento: emisor.establecimiento,
      puntoEmision: emisor.puntoEmision,
      tipoComprobante: "01",
      ultimoNumero: 0,
    },
    {
      negocio,
      ambiente: 2,
      establecimiento: emisor.establecimiento,
      puntoEmision: emisor.puntoEmision,
      tipoComprobante: "04",
      ultimoNumero: 0,
    },
  ];
}

/**
 * Guarda los parámetros tributarios del Emisor SRI (RUC, Razón Social, Matriz,
 * Establecimiento, Punto de Emisión, Régimen RIMPE/General, Contabilidad, Emisión Automática).
 */
export async function guardarConfiguracionFacturacionSriAction(
  negocio: string,
  entrada: z.input<typeof esquemaEmisorSri>,
): Promise<{ ok: boolean; error?: string; emisor?: ConfiguracionEmisorSri }> {
  const validado = esquemaEmisorSri.safeParse(entrada);
  if (!validado.success) {
    return {
      ok: false,
      error: validado.error.issues[0]?.message || "Revisa los parámetros tributarios ingresados.",
    };
  }

  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const d = validado.data;
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const db: any = admin || supabase;

  const payloadRpc = {
    ruc: d.ruc,
    razon_social: d.razonSocial,
    nombre_comercial: d.nombreComercial || d.razonSocial,
    direccion_matriz: d.direccionMatriz,
    direccion_establecimiento: d.direccionEstablecimiento || d.direccionMatriz,
    establecimiento: d.establecimiento,
    punto_emision: d.puntoEmision,
    obligado_contabilidad: d.obligadoContabilidad,
    regimen: d.regimen,
    contribuyente_especial: d.contribuyenteEspecial?.trim() || null,
    agente_retencion: d.agenteRetencion?.trim() || null,
    correo_copia: d.correoCopia?.trim() || null,
    emision_automatica: d.emisionAutomatica,
    activo: d.activo,
  };

  let guardadoEnRpc = false;
  let errorRpcMsg: string | null = null;

  try {
    const { data: rpcRes, error: rpcErr } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_guardar_configuracion_facturacion_sri", {
        p_negocio: negPrincipal,
        p_datos: payloadRpc,
      });

    if (!rpcErr && rpcRes?.ok) {
      guardadoEnRpc = true;
    } else if (rpcErr && rpcErr.code !== "PGRST202") {
      errorRpcMsg = rpcErr.message;
    } else if (rpcRes?.error) {
      errorRpcMsg = String(rpcRes.error);
    }
  } catch (e: any) {
    errorRpcMsg = e?.message || null;
  }

  // Sincronizar también en comun_configuracion.cfg_negocio (garantiza disponibilidad inmediata en RIDE público y respaldo híbrido)
  let guardadoEnCfg = false;
  let errorCfgMsg: string | null = null;
  try {
    const { data: cfgActual } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", negPrincipal)
      .maybeSingle();

    const detPrev = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
    const sriPrev = detPrev.facturacion_sri || {};
    const emisorPrev = sriPrev.emisor || {};
    const nuevoEmisor = mapearEmisorDesdeFila(negPrincipal, {
      ...emisorPrev,
      ...payloadRpc,
      emi_actualizado_en: new Date().toISOString(),
    });

    const { error: errUpd } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_identificacion: d.ruc,
        cfg_razon_social: d.razonSocial,
        cfg_nombre_comercial: d.nombreComercial || d.razonSocial,
        cfg_detalle_configuracion: {
          ...detPrev,
          facturacion_sri: {
            ...sriPrev,
            emisor: nuevoEmisor,
          },
        },
        cfg_actualizado_en: new Date().toISOString(),
      })
      .eq("cfg_negocio", negPrincipal);

    if (!errUpd) {
      guardadoEnCfg = true;
    } else {
      errorCfgMsg = errUpd.message;
    }
  } catch (e: any) {
    errorCfgMsg = e?.message || null;
  }

  if (!guardadoEnRpc && !guardadoEnCfg) {
    return {
      ok: false,
      error:
        errorRpcMsg ||
        errorCfgMsg ||
        "No tienes permisos para modificar los parámetros de facturación de este negocio.",
    };
  }

  try {
    revalidatePath("/panel");
    revalidatePath("/panel/facturacion");
    revalidatePath("/panel/facturacion-sri");
    revalidatePath("/panel/configuracion");
  } catch {
    // Ignorar fuera de contexto Next
  }

  const estadoActualizado = await obtenerConfiguracionFacturacionSriAction(negPrincipal);
  return { ok: true, emisor: estadoActualizado.emisor };
}

/**
 * Ajusta el último número secuencial emitido para Facturas (01) o Notas de Crédito (04).
 */
export async function fijarSecuencialFacturacionSriAction(datos: {
  negocio: string;
  ambiente: 1 | 2;
  tipoComprobante: "01" | "04";
  ultimoNumero: number;
}): Promise<{ ok: boolean; error?: string; secuenciales?: SecuencialSriResumen[] }> {
  const negPrincipal = normalizarIdentificadorNegocio(datos.negocio).principal;
  const ultimo = Math.floor(Number(datos.ultimoNumero));
  if (!Number.isFinite(ultimo) || ultimo < 0 || ultimo > 999999999) {
    return { ok: false, error: "El secuencial debe ser un entero entre 0 y 999999999." };
  }

  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const db: any = admin || supabase;

  let guardadoRpc = false;
  let errorRpc: string | null = null;
  try {
    const { data: rpcRes, error: errRpc } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_fijar_secuencial_sri", {
        p_negocio: negPrincipal,
        p_ambiente: datos.ambiente,
        p_tipo_comprobante: datos.tipoComprobante,
        p_ultimo_numero: ultimo,
      });
    if (!errRpc && rpcRes?.ok) {
      guardadoRpc = true;
    } else if (errRpc && errRpc.code !== "PGRST202") {
      errorRpc = errRpc.message;
    } else if (rpcRes?.error) {
      errorRpc = String(rpcRes.error);
    }
  } catch (e: any) {
    errorRpc = e?.message || null;
  }

  let guardadoCfg = false;
  try {
    const { data: cfgActual } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negPrincipal)
      .maybeSingle();

    const detPrev = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
    const sriPrev = detPrev.facturacion_sri || {};
    const emisorActual = mapearEmisorDesdeFila(negPrincipal, sriPrev.emisor);
    const baseSecs: SecuencialSriResumen[] = Array.isArray(sriPrev.secuenciales)
      ? sriPrev.secuenciales
      : construirSecuencialesPorDefecto(negPrincipal, emisorActual);

    let encontrado = false;
    const nuevosSecs = baseSecs.map((s) => {
      if (s.ambiente === datos.ambiente && s.tipoComprobante === datos.tipoComprobante) {
        encontrado = true;
        return {
          ...s,
          establecimiento: emisorActual.establecimiento,
          puntoEmision: emisorActual.puntoEmision,
          ultimoNumero: ultimo,
        };
      }
      return s;
    });
    if (!encontrado) {
      nuevosSecs.push({
        negocio: negPrincipal,
        ambiente: datos.ambiente,
        establecimiento: emisorActual.establecimiento,
        puntoEmision: emisorActual.puntoEmision,
        tipoComprobante: datos.tipoComprobante,
        ultimoNumero: ultimo,
      });
    }

    const { error: errUpd } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrev,
          facturacion_sri: {
            ...sriPrev,
            secuenciales: nuevosSecs,
          },
        },
      })
      .eq("cfg_negocio", negPrincipal);

    if (!errUpd) guardadoCfg = true;
  } catch {
    // Ignorar
  }

  if (!guardadoRpc && !guardadoCfg) {
    return { ok: false, error: errorRpc || "No se pudo actualizar el secuencial." };
  }

  try {
    revalidatePath("/panel/facturacion-sri");
  } catch {}

  const estado = await obtenerConfiguracionFacturacionSriAction(negPrincipal);
  return { ok: true, secuenciales: estado.secuenciales };
}

/**
 * Conmuta el ambiente SRI activo del negocio (1 = Pruebas CELCER, 2 = Producción CEL).
 */
export async function cambiarAmbienteFacturacionSriAction(
  negocio: string,
  ambiente: 1 | 2,
): Promise<{ ok: boolean; error?: string; emisor?: ConfiguracionEmisorSri }> {
  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const db: any = admin || supabase;

  let guardadoRpc = false;
  let errorRpc: string | null = null;
  try {
    const { data: rpcRes, error: errRpc } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_cambiar_ambiente_sri", {
        p_negocio: negPrincipal,
        p_ambiente: ambiente,
      });
    if (!errRpc && rpcRes?.ok) {
      guardadoRpc = true;
    } else if (errRpc && errRpc.code !== "PGRST202") {
      errorRpc = errRpc.message;
    } else if (rpcRes?.error) {
      errorRpc = String(rpcRes.error);
    }
  } catch (e: any) {
    errorRpc = e?.message || null;
  }

  if (errorRpc) {
    return { ok: false, error: errorRpc };
  }

  let guardadoCfg = false;
  try {
    const { data: cfgActual } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negPrincipal)
      .maybeSingle();

    const detPrev = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
    const sriPrev = detPrev.facturacion_sri || {};
    const emisorActual = mapearEmisorDesdeFila(negPrincipal, sriPrev.emisor);
    if (ambiente === 2 && !emisorActual.produccionHabilitada && !guardadoRpc) {
      return {
        ok: false,
        error: "Primero debes habilitar el pase a Producción SRI con rol SuperAdmin.",
      };
    }

    const { error: errUpd } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrev,
          facturacion_sri: {
            ...sriPrev,
            emisor: { ...emisorActual, ambiente },
          },
        },
      })
      .eq("cfg_negocio", negPrincipal);
    if (!errUpd) guardadoCfg = true;
  } catch {}

  if (!guardadoRpc && !guardadoCfg) {
    return { ok: false, error: "No se pudo cambiar el ambiente de facturación." };
  }

  try {
    revalidatePath("/panel/facturacion-sri");
    revalidatePath("/panel/facturacion");
  } catch {}

  const estado = await obtenerConfiguracionFacturacionSriAction(negPrincipal);
  return { ok: true, emisor: estado.emisor };
}

/**
 * Habilita o revoca la autorización de emisión en Producción SRI (exclusivo SuperAdmin).
 */
export async function habilitarProduccionFacturacionSriAction(
  negocio: string,
  habilitar: boolean,
): Promise<{ ok: boolean; error?: string; emisor?: ConfiguracionEmisorSri }> {
  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const db: any = admin || supabase;

  let guardadoRpc = false;
  let errorRpc: string | null = null;
  try {
    const { data: rpcRes, error: errRpc } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_habilitar_produccion_sri", {
        p_negocio: negPrincipal,
        p_habilitar: habilitar,
      });
    if (!errRpc && rpcRes?.ok) {
      guardadoRpc = true;
    } else if (errRpc && errRpc.code !== "PGRST202") {
      errorRpc = errRpc.message;
    } else if (rpcRes?.error) {
      errorRpc = String(rpcRes.error);
    }
  } catch (e: any) {
    errorRpc = e?.message || null;
  }

  if (errorRpc) {
    return { ok: false, error: errorRpc };
  }

  let guardadoCfg = false;
  try {
    const { data: cfgActual } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negPrincipal)
      .maybeSingle();

    const detPrev = (cfgActual?.cfg_detalle_configuracion as Record<string, any>) || {};
    const sriPrev = detPrev.facturacion_sri || {};
    const emisorActual = mapearEmisorDesdeFila(negPrincipal, sriPrev.emisor);
    const { error: errUpd } = await (db || supabase)
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrev,
          facturacion_sri: {
            ...sriPrev,
            emisor: {
              ...emisorActual,
              produccionHabilitada: habilitar,
              ambiente: habilitar ? emisorActual.ambiente : 1,
            },
          },
        },
      })
      .eq("cfg_negocio", negPrincipal);
    if (!errUpd) guardadoCfg = true;
  } catch {}

  if (!guardadoRpc && !guardadoCfg) {
    return { ok: false, error: "No se pudo actualizar la autorización de Producción." };
  }

  try {
    revalidatePath("/panel/facturacion-sri");
  } catch {}

  const estado = await obtenerConfiguracionFacturacionSriAction(negPrincipal);
  return { ok: true, emisor: estado.emisor };
}

/**
 * Valida en memoria un certificado de firma electrónica .p12/.pfx ecuatoriano con su clave
 * y lo almacena cifrado en Supabase Vault mediante RPC SECURITY DEFINER (nunca en claro).
 */
export async function subirCertificadoFirmaSriAction(
  formData: FormData,
): Promise<{
  ok: boolean;
  error?: string;
  certificado?: CertificadoFirmaSriResumen;
}> {
  const negocioRaw = String(formData.get("negocio") || "tinkay");
  const negPrincipal = normalizarIdentificadorNegocio(negocioRaw).principal;
  const claveP12 = String(formData.get("clave") || "");
  const archivo = formData.get("archivo") as File | null;

  if (!archivo || typeof archivo.arrayBuffer !== "function") {
    return { ok: false, error: "Selecciona un archivo de firma electrónica (.p12 o .pfx)." };
  }
  if (!claveP12) {
    return { ok: false, error: "Ingresa la contraseña del certificado .p12." };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  let meta: ReturnType<typeof extraerMetadatosPkcs12Ecuador>;
  try {
    meta = extraerMetadatosPkcs12Ecuador(buffer, claveP12);
  } catch (e: any) {
    return { ok: false, error: e?.message || "Certificado .p12 inválido o contraseña incorrecta." };
  }

  // Verificar coherencia RUC / Cédula contra el RUC configurado del negocio si el certificado declara identificación
  const estadoActual = await obtenerConfiguracionFacturacionSriAction(negPrincipal);
  const rucEmisor = estadoActual.emisor.ruc;
  if (meta.identificacionesCandidatas.length > 0 && rucEmisor) {
    const cedulaBaseRuc = rucEmisor.slice(0, 10);
    const coincide = meta.identificacionesCandidatas.some(
      (id) => id === rucEmisor || id === cedulaBaseRuc || rucEmisor.startsWith(id),
    );
    if (!coincide) {
      return {
        ok: false,
        error: `La identificación del certificado (${meta.identificacion || meta.identificacionesCandidatas[0]}) no coincide con el RUC configurado (${rucEmisor}). Actualiza primero el RUC del emisor si corresponde a otro contribuyente.`,
      };
    }
  }

  const p12Base64 = buffer.toString("base64");
  const supabase: any = await crearClienteServidor();

  // Almacenar en Supabase Vault vía RPC SECURITY DEFINER en comun_comercio
  const { data: rpcRes, error: rpcErr } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_registrar_certificado_sri", {
      p_negocio: negPrincipal,
      p_p12_base64: p12Base64,
      p_clave_p12: claveP12,
      p_metadatos: {
        titular: meta.titular,
        identificacion: meta.identificacion,
        emisor_ca: meta.emisorCa,
        numero_serie: meta.numeroSerie,
        valido_desde: meta.validoDesde,
        valido_hasta: meta.validoHasta,
        huella_sha1: meta.huellaSha1,
      },
    });

  if (rpcErr) {
    if (rpcErr.code === "PGRST202") {
      return {
        ok: false,
        error:
          "El certificado (.p12) fue validado correctamente (" +
          meta.titular +
          "), pero falta ejecutar la migración SQL de Vault (20261115000005) en Supabase para custodiar la clave privada cifrada.",
      };
    }
    return { ok: false, error: rpcErr.message };
  }

  if (!rpcRes?.ok) {
    return {
      ok: false,
      error: String(rpcRes?.error || "No se pudo custodiar el certificado en Supabase Vault."),
    };
  }

  try {
    revalidatePath("/panel/facturacion-sri");
  } catch {}

  return {
    ok: true,
    certificado: {
      id: String(rpcRes.certificado_id),
      negocio: negPrincipal,
      titular: meta.titular,
      identificacionCertificado: meta.identificacion,
      emisorCa: meta.emisorCa,
      numeroSerie: meta.numeroSerie,
      validoDesde: meta.validoDesde,
      validoHasta: meta.validoHasta,
      huellaSha1: meta.huellaSha1,
      activo: true,
    },
  };
}

/**
 * Desactiva un certificado de firma electrónica y elimina sus secretos de Supabase Vault.
 */
export async function desactivarCertificadoFirmaSriAction(
  negocio: string,
  certificadoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const supabase: any = await crearClienteServidor();

  const { data: rpcRes, error: rpcErr } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_desactivar_certificado_sri", {
      p_negocio: negPrincipal,
      p_certificado_id: certificadoId,
    });

  if (rpcErr) {
    return { ok: false, error: rpcErr.message };
  }
  if (!rpcRes?.ok) {
    return { ok: false, error: String(rpcRes?.error || "No se pudo desactivar el certificado.") };
  }

  try {
    revalidatePath("/panel/facturacion-sri");
  } catch {}

  return { ok: true };
}
