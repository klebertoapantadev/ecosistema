import { URL_ARIA_DEFECTO, type ConfiguracionAriaVista } from "./esquema-aria";
import type { ConfiguracionMarketingMetaVista } from "./esquema-marketing-meta";

interface FilaCfgAria {
  ari_negocio: string;
  ari_base_url: string | null;
  ari_agente_id: string | null;
  ari_nombre_agente: string | null;
  ari_secreto_id: string | null;
  ari_tenant_secreto_id: string | null;
  ari_gate_secreto_id: string | null;
  ari_ycloud_api_secreto_id?: string | null;
  ari_ycloud_webhook_secreto_id?: string | null;
  ari_whatsapp_agente_secreto_id?: string | null;
  ari_stt_secreto_id?: string | null;
  ari_detalle_aria?: Record<string, unknown> | null;
  ari_activo: boolean;
  ari_actualizado_en: string | null;
}

interface ConsultaCfgAria {
  from(tabla: "cfg_aria"): {
    select(columnas: string): {
      eq(columna: string, valor: string): {
        maybeSingle(): Promise<{ data: FilaCfgAria | null; error: { message: string } | null }>;
      };
    };
  };
}

export async function obtenerConfiguracionNegocio(negocio: string) {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("*")
    .eq("cfg_negocio", negocio)
    .maybeSingle();

  return data;
}

export async function obtenerSmtpNegocio(negocio: string) {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_smtp")
    .select("*")
    .eq("smt_negocio", negocio)
    .maybeSingle();

  return data;
}

export async function obtenerAriaNegocio(negocio: string): Promise<ConfiguracionAriaVista | null> {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaCfg = supabase.schema("comun_configuracion") as unknown as ConsultaCfgAria;
  const negNorm = negocio.trim().toLowerCase();
  const { data } = await esquemaCfg
    .from("cfg_aria")
    .select("*")
    .eq("ari_negocio", negNorm)
    .maybeSingle();

  if (!data) return null;

  const det = (data.ari_detalle_aria ?? {}) as Record<string, unknown>;

  return {
    negocio: data.ari_negocio,
    baseUrl: data.ari_base_url ?? URL_ARIA_DEFECTO,
    agenteId: data.ari_agente_id ?? "",
    nombreAgente: data.ari_nombre_agente ?? "",
    activo: Boolean(data.ari_activo),
    tieneApiKey: data.ari_secreto_id != null,
    tieneTenantKey: data.ari_tenant_secreto_id != null,
    tieneGateKey: data.ari_gate_secreto_id != null,
    actualizadoEn: data.ari_actualizado_en,
    ycloudHabilitado: Boolean(det.ycloud_habilitado),
    ycloudNumeroEmisor:
      typeof det.ycloud_numero_emisor === "string"
        ? det.ycloud_numero_emisor
        : negNorm === "tinkay"
          ? "+593996438873"
          : "",
    ycloudNumerosPermitidos:
      typeof det.ycloud_numeros_permitidos === "string"
        ? det.ycloud_numeros_permitidos
        : negNorm === "tinkay"
          ? "+593 99 972 7844"
          : "",
    whatsappAgenteId:
      typeof det.whatsapp_agente_id === "string" ? det.whatsapp_agente_id : "",
    ycloudWebhookToken:
      typeof det.ycloud_webhook_token === "string" ? det.ycloud_webhook_token : "",
    respaldoWebhookAriaPrevio:
      typeof det.respaldo_webhook_aria_previo === "string"
        ? det.respaldo_webhook_aria_previo
        : negNorm === "tinkay"
          ? "https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf"
          : "",
    tieneYcloudApiKey: data.ari_ycloud_api_secreto_id != null,
    tieneYcloudWebhookSecret: data.ari_ycloud_webhook_secreto_id != null,
    tieneWhatsappAgenteKey: data.ari_whatsapp_agente_secreto_id != null,
    tieneSttApiKey: data.ari_stt_secreto_id != null,
  };
}

export async function obtenerMarketingMetaNegocio(
  negocio: string
): Promise<ConfiguracionMarketingMetaVista | null> {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase: any = await crearClienteServidor();
  const negNorm = negocio.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .schema("comun_configuracion")
      .from("cfg_marketing_meta")
      .select("*")
      .eq("mkm_negocio", negNorm)
      .maybeSingle();

    if (!error && data) {
      return {
        negocio: String(data.mkm_negocio || negNorm),
        pixelId: String(data.mkm_pixel_id || ""),
        dominioVerificacion: String(data.mkm_dominio_verificacion || ""),
        testEventCode: String(data.mkm_test_event_code || ""),
        catalogoActivo: data.mkm_catalogo_activo !== false,
        activo: Boolean(data.mkm_activo),
        tieneCapiToken: data.mkm_capi_secreto_id != null,
        actualizadoEn: data.mkm_actualizado_en ?? null,
      };
    }

    const { data: filaNeg } = await supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negNorm)
      .maybeSingle();

    const mkm = (filaNeg?.cfg_detalle_configuracion as any)?.marketing_meta;
    if (mkm && typeof mkm === "object") {
      return {
        negocio: negNorm,
        pixelId: String(mkm.pixel_id || ""),
        dominioVerificacion: String(mkm.dominio_verificacion || ""),
        testEventCode: String(mkm.test_event_code || ""),
        catalogoActivo: mkm.catalogo_activo !== false,
        activo: Boolean(mkm.activo),
        tieneCapiToken: false,
        actualizadoEn: null,
      };
    }
  } catch {
    // Tabla aún no migrada o sin fila
  }

  return null;
}
