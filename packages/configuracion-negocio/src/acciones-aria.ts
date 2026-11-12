"use server";

import { revalidatePath } from "next/cache";
import { invocarAgente, invocarAgentePorNegocio } from "@eco/agentes-ia";
import {
  URL_ARIA_DEFECTO,
  esquemaAria,
  faltaParaActivarAria,
  type DatosAria,
} from "./esquema-aria";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

interface EsquemaRpcCfgAria {
  from(tabla: "cfg_aria"): {
    select(columnas: string): {
      eq(columna: string, valor: string): {
        maybeSingle(): Promise<{
          data: { ari_secreto_id: string | null } | null;
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
  datos: { baseUrl?: string; agenteId?: string; apiKey?: string },
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

    const correo = (user.email ?? "").trim().toLowerCase();
    let autorizado = CORREOS_SUPERADMIN_RESPALDO.has(correo);

    if (!autorizado) {
      const seg = supabase.schema("comun_seguridad") as unknown as EsquemaSeguridadRpc;
      const [{ data: esSuper }, { data: esAdmin }] = await Promise.all([
        seg.rpc("seg_fn_es_superadmin"),
        seg.rpc("seg_fn_es_admin_negocio", { p_negocio: negocio.trim().toLowerCase() }),
      ]);
      autorizado = Boolean(esSuper) || Boolean(esAdmin);
    }

    if (!autorizado) {
      return { ok: false, error: "No tienes permisos de administrador en este negocio." };
    }

    const promptPrueba = "Hola, confirma brevemente en una oración quién eres y que estás en línea.";

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
        25000,
      );
      return { ok: true, data: { respuesta: res.response } };
    }

    // De lo contrario, probamos la configuración ya almacenada en Vault (o entorno de respaldo)
    const res = await invocarAgentePorNegocio(negocio, promptPrueba, { tiempoMaximoMs: 25000 });
    return { ok: true, data: { respuesta: res.response } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No fue posible conectar con el agente ARIA",
    };
  }
}

