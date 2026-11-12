import { URL_ARIA_DEFECTO, type ConfiguracionAriaVista } from "./esquema-aria";

interface FilaCfgAria {
  ari_negocio: string;
  ari_base_url: string | null;
  ari_agente_id: string | null;
  ari_nombre_agente: string | null;
  ari_secreto_id: string | null;
  ari_tenant_secreto_id: string | null;
  ari_gate_secreto_id: string | null;
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
  const { data } = await esquemaCfg
    .from("cfg_aria")
    .select(
      "ari_negocio, ari_base_url, ari_agente_id, ari_nombre_agente, ari_secreto_id, ari_tenant_secreto_id, ari_gate_secreto_id, ari_activo, ari_actualizado_en",
    )
    .eq("ari_negocio", negocio.trim().toLowerCase())
    .maybeSingle();

  if (!data) return null;

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
  };
}
