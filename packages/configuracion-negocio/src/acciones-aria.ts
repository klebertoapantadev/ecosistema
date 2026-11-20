"use server";

import { revalidatePath } from "next/cache";
import { invocarAgente, invocarAgentePorNegocio } from "@eco/agentes-ia";
import {
  MODELO_ESTUDIO_IA_DEFECTO_GEMINI,
  MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER,
  URL_ARIA_DEFECTO,
  esquemaAria,
  faltaParaActivarAria,
  type DatosAria,
  type ProveedorEstudioIa,
} from "./esquema-aria";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

interface EsquemaRpcCfgAria {
  from(tabla: "cfg_aria"): {
    select(columnas: string): {
      eq(columna: string, valor: string): {
        maybeSingle(): Promise<{
          data: { ari_secreto_id: string | null; ari_activo?: boolean } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  rpc(
    nombre: "cfg_fn_guardar_aria" | "cfg_fn_borrar_aria_clave",
    argumentos: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

interface EsquemaSeguridadRpc {
  rpc(
    nombre: "seg_fn_es_admin_negocio" | "seg_fn_es_superadmin",
    argumentos?: Record<string, unknown>,
  ): Promise<{ data: boolean | null; error: { message: string } | null }>;
}

const CORREOS_SUPERADMIN_RESPALDO = new Set([
  "jesus251296@gmail.com",
  "kleber.toapanta.ch@gmail.com",
]);

export async function guardarAria(datos: DatosAria, negocio: string): Promise<Resultado> {
  const parseo = esquemaAria.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion") as unknown as EsquemaRpcCfgAria;
    const codigoNegocio = negocio.trim().toLowerCase();

    const { data: filaActual } = await esquemaCfg
      .from("cfg_aria")
      .select("ari_secreto_id")
      .eq("ari_negocio", codigoNegocio)
      .maybeSingle();

    const falta = faltaParaActivarAria(parseo.data, filaActual?.ari_secreto_id != null);
    if (falta) {
      return { ok: false, error: falta };
    }

    const { error } = await esquemaCfg.rpc("cfg_fn_guardar_aria", {
      p_negocio: codigoNegocio,
      p_base_url: parseo.data.baseUrl || URL_ARIA_DEFECTO,
      p_agente_id: parseo.data.agenteId || null,
      p_nombre_agente: parseo.data.nombreAgente || null,
      p_activo: parseo.data.activo,
      p_api_key: parseo.data.apiKey || null,
      p_tenant_key: parseo.data.tenantKey || null,
      p_gate_key: parseo.data.gateKey || null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/panel/aria");
    revalidatePath("/panel/configuracion");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar configuración ARIA",
    };
  }
}

export async function borrarClaveAria(
  negocio: string,
  tipo: "agent" | "tenant" | "gate" | "todas" = "agent",
): Promise<Resultado> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion") as unknown as EsquemaRpcCfgAria;

    const { error } = await esquemaCfg.rpc("cfg_fn_borrar_aria_clave", {
      p_negocio: negocio.trim().toLowerCase(),
      p_tipo: tipo,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/panel/aria");
    revalidatePath("/panel/configuracion");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al eliminar clave ARIA",
    };
  }
}

export async function probarConexionAria(
  datos: { baseUrl?: string; agenteId?: string; apiKey?: string; mensajePrueba?: string },
  negocio: string,
): Promise<Resultado<{ respuesta: string }>> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Debes iniciar sesión como administrador para probar el agente." };
    }

    const codigoNegocio = negocio.trim().toLowerCase();
    const correo = (user.email ?? "").trim().toLowerCase();
    let autorizado = CORREOS_SUPERADMIN_RESPALDO.has(correo);

    if (!autorizado) {
      const seg = supabase.schema("comun_seguridad") as unknown as EsquemaSeguridadRpc;
      const [{ data: esSuper }, { data: esAdmin }] = await Promise.all([
        seg.rpc("seg_fn_es_superadmin"),
        seg.rpc("seg_fn_es_admin_negocio", { p_negocio: codigoNegocio }),
      ]);
      autorizado = Boolean(esSuper) || Boolean(esAdmin);
    }

    if (!autorizado) {
      return { ok: false, error: "No tienes permisos de administrador en este negocio." };
    }

    const promptPrueba =
      datos.mensajePrueba?.trim() ||
      "Hola, confirma brevemente en una oración quién eres y que estás en línea.";

    // Si el administrador escribió una clave nueva en pantalla, probamos esa conexión directamente
    if (datos.apiKey?.trim() && datos.baseUrl?.trim() && datos.agenteId?.trim()) {
      const res = await invocarAgente(
        {
          baseUrl: datos.baseUrl.trim().replace(/\/+$/, ""),
          agentId: datos.agenteId.trim(),
          apiKey: datos.apiKey.trim(),
        },
        promptPrueba,
        undefined,
        undefined,
        undefined,
        undefined,
        45000,
      );
      return { ok: true, data: { respuesta: res.response } };
    }

    // Verificar si la fila en Vault existe pero está desactivada para dar un aviso claro
    const esquemaCfg = supabase.schema("comun_configuracion") as unknown as EsquemaRpcCfgAria;
    const { data: filaAria } = await esquemaCfg
      .from("cfg_aria")
      .select("ari_secreto_id, ari_activo")
      .eq("ari_negocio", codigoNegocio)
      .maybeSingle();

    if (filaAria?.ari_secreto_id && filaAria.ari_activo === false) {
      return {
        ok: false,
        error:
          "La clave ya está guardada en Vault, pero el agente está desactivado. Marca la casilla de activación y pulsa «Guardar Configuración».",
      };
    }

    // Probamos la configuración activa almacenada en Vault (o entorno de respaldo)
    const res = await invocarAgentePorNegocio(codigoNegocio, promptPrueba, {
      tiempoMaximoMs: 45000,
    });
    return { ok: true, data: { respuesta: res.response } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No fue posible conectar con el agente ARIA",
    };
  }
}

export async function guardarWhatsappYcloudAction(
  datos: {
    habilitado: boolean;
    numeroEmisor: string;
    numerosPermitidos: string;
    whatsappAgenteId?: string;
    ycloudApiKey?: string;
    ycloudWebhookSecret?: string;
    whatsappAgenteKey?: string;
    sttApiKey?: string;
    regenerarTokenUrl?: boolean;
  },
  negocio: string
): Promise<
  Resultado<{
    webhookToken: string;
    tieneYcloudApiKey: boolean;
    tieneWebhookSecret: boolean;
    tieneWhatsappAgenteKey: boolean;
    tieneSttApiKey?: boolean;
  }>
> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion") as any;
    const codigoNegocio = negocio.trim().toLowerCase();

    const payloadBase: Record<string, unknown> = {
      p_negocio: codigoNegocio,
      p_habilitado: Boolean(datos.habilitado),
      p_numero_emisor: datos.numeroEmisor.trim(),
      p_numeros_permitidos: datos.numerosPermitidos.trim(),
      p_whatsapp_agente_id: datos.whatsappAgenteId?.trim() || null,
      p_ycloud_api_key: datos.ycloudApiKey?.trim() || null,
      p_ycloud_webhook_secret: datos.ycloudWebhookSecret?.trim() || null,
      p_whatsapp_agente_key: datos.whatsappAgenteKey?.trim() || null,
      p_regenerar_token_url: Boolean(datos.regenerarTokenUrl),
    };

    let { data, error } = await esquemaCfg.rpc("cfg_fn_guardar_whatsapp_ycloud", {
      ...payloadBase,
      p_stt_api_key: datos.sttApiKey?.trim() || null,
    });

    // Compatibilidad retroactiva si la migración 20261117000005 aún no se ha corrido en Supabase
    if (error && error.message.includes("p_stt_api_key")) {
      const retry = await esquemaCfg.rpc("cfg_fn_guardar_whatsapp_ycloud", payloadBase);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return {
        ok: false,
        error: error.message.includes("cfg_fn_guardar_whatsapp_ycloud")
          ? "Ejecuta primero la migración 20261116000003_omnicanal_whatsapp_ycloud_orquestacion_e_historial.sql en el SQL Editor de Supabase."
          : error.message,
      };
    }

    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo guardar la configuración de YCloud") };
    }

    revalidatePath("/panel/aria");
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/conversaciones");

    return {
      ok: true,
      data: {
        webhookToken: String(data.webhookToken || ""),
        tieneYcloudApiKey: Boolean(data.tieneYcloudApiKey),
        tieneWebhookSecret: Boolean(data.tieneWebhookSecret),
        tieneWhatsappAgenteKey: Boolean(data.tieneWhatsappAgenteKey),
        tieneSttApiKey: Boolean(data.tieneSttApiKey),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado guardando canal WhatsApp YCloud",
    };
  }
}

export async function guardarEstudioIaAction(
  datos: {
    proveedor: ProveedorEstudioIa;
    modelo: string;
    activo: boolean;
    apiKey?: string;
  },
  negocio: string,
): Promise<
  Resultado<{
    tieneApiKey: boolean;
    proveedor: ProveedorEstudioIa;
    modelo: string;
    activo: boolean;
  }>
> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion") as any;
    const codigoNegocio = negocio.trim().toLowerCase();

    const proveedorNorm: ProveedorEstudioIa =
      datos.proveedor === "gemini" ? "gemini" : "openrouter";
    const modeloNorm =
      datos.modelo.trim() ||
      (proveedorNorm === "gemini"
        ? MODELO_ESTUDIO_IA_DEFECTO_GEMINI
        : MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER);

    const { data, error } = await esquemaCfg.rpc("cfg_fn_guardar_estudio_ia", {
      p_negocio: codigoNegocio,
      p_proveedor: proveedorNorm,
      p_modelo: modeloNorm,
      p_activo: Boolean(datos.activo),
      p_api_key: datos.apiKey?.trim() || null,
    });

    if (error) {
      return {
        ok: false,
        error: error.message.includes("cfg_fn_guardar_estudio_ia")
          ? "Ejecuta primero la migración supabase/migrations/20261120000001_cfg_estudio_ia_vault.sql en el SQL Editor de Supabase."
          : error.message,
      };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: String(data?.error || "No se pudo guardar la configuración de Estudio IA"),
      };
    }

    revalidatePath("/panel/aria");
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/entrega-inmediata");

    return {
      ok: true,
      data: {
        tieneApiKey: Boolean(data.tieneApiKey),
        proveedor: data.proveedor === "gemini" ? "gemini" : "openrouter",
        modelo: String(data.modelo || modeloNorm),
        activo: Boolean(data.activo),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado guardando Estudio IA",
    };
  }
}

export async function borrarClaveEstudioIaAction(negocio: string): Promise<Resultado> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion") as any;
    const codigoNegocio = negocio.trim().toLowerCase();

    const { data, error } = await esquemaCfg.rpc("cfg_fn_borrar_estudio_ia_clave", {
      p_negocio: codigoNegocio,
    });

    if (error) {
      return {
        ok: false,
        error: error.message.includes("cfg_fn_borrar_estudio_ia_clave")
          ? "Ejecuta primero la migración supabase/migrations/20261120000001_cfg_estudio_ia_vault.sql en el SQL Editor de Supabase."
          : error.message,
      };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: String(data?.error || "No se pudo eliminar la clave de Estudio IA"),
      };
    }

    revalidatePath("/panel/aria");
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/entrega-inmediata");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al eliminar clave de Estudio IA",
    };
  }
}

export async function probarEstudioIaAction(
  datos: { proveedor: ProveedorEstudioIa; apiKey?: string },
  negocio: string,
): Promise<Resultado<{ detalle: string }>> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion") as any;
    const codigoNegocio = negocio.trim().toLowerCase();

    const { data, error } = await esquemaCfg.rpc("cfg_fn_probar_estudio_ia", {
      p_negocio: codigoNegocio,
      p_proveedor: datos.proveedor === "gemini" ? "gemini" : "openrouter",
      p_api_key: datos.apiKey?.trim() || null,
    });

    if (error) {
      return {
        ok: false,
        error: error.message.includes("cfg_fn_probar_estudio_ia")
          ? "Ejecuta primero la migración supabase/migrations/20261120000001_cfg_estudio_ia_vault.sql en el SQL Editor de Supabase."
          : error.message,
      };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: String(data?.error || "No se pudo verificar la clave de Estudio IA"),
      };
    }

    return {
      ok: true,
      data: { detalle: String(data.detalle || "Conexión verificada correctamente.") },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado verificando Estudio IA",
    };
  }
}

