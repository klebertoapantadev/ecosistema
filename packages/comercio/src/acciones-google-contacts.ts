"use server";

import { normalizarIdentificadorNegocio } from "./utils/negocio";

function normalizarNegocioComercio(negocio: string): string {
  return normalizarIdentificadorNegocio(negocio).principal;
}
import type { FichaAgendaCruda } from "./depurador-agenda";
import {
  aplicarLoteOperacionesGooglePeople,
  asegurarGruposGoogleContacts,
  leerTodosContactosGooglePeople,
  obtenerCredencialesEnvGoogleContacts,
  refrescarAccessTokenGoogle,
  resolverCredencialesAppGoogleContacts,
  type ConexionGoogleContactsInfo,
  type OperacionEscrituraGoogleContacts,
} from "./google-contacts-servidor";

export type { ConexionGoogleContactsInfo, OperacionEscrituraGoogleContacts };

export async function obtenerEstadoGoogleContactsAction(negocio: string): Promise<
  | {
      ok: true;
      esAdmin: boolean;
      credencialesConfiguradas: boolean;
      origenCredenciales: "env" | "vault" | "ninguno";
      clientIdActual: string | null;
      conexiones: ConexionGoogleContactsInfo[];
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const { data, error } = await (supabase.schema("comun_comercio") as any).rpc(
      "com_fn_omnicanal_google_contacts_obtener_estado",
      { p_negocio: neg }
    );

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "Error consultando estado Google Contacts.") };
    }

    const envCreds = obtenerCredencialesEnvGoogleContacts();
    const tieneVault = Boolean(data.tieneCredencialesVault);

    return {
      ok: true,
      esAdmin: Boolean(data.esAdmin),
      credencialesConfiguradas: Boolean(envCreds || tieneVault),
      origenCredenciales: envCreds ? "env" : tieneVault ? "vault" : "ninguno",
      clientIdActual: envCreds?.clientId ?? (data.clientIdVault ? String(data.clientIdVault) : null),
      conexiones: Array.isArray(data.conexiones)
        ? (data.conexiones as ConexionGoogleContactsInfo[])
        : [],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error consultando Google Contacts.",
    };
  }
}

export async function guardarAppOauthGoogleContactsAction(entrada: {
  negocio: string;
  clientId: string;
  clientSecret?: string | null;
}): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const { data, error } = await (supabase.schema("comun_comercio") as any).rpc(
      "com_fn_omnicanal_google_contacts_guardar_app_oauth",
      {
        p_negocio: neg,
        p_client_id: entrada.clientId.trim(),
        p_client_secret: entrada.clientSecret?.trim() || null,
      }
    );

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return {
        ok: false,
        error: String(data?.error || "No se pudieron guardar las credenciales OAuth."),
      };
    }
    return { ok: true, clientId: String(data.clientId || entrada.clientId.trim()) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error guardando credenciales OAuth.",
    };
  }
}

export async function desconectarGoogleContactsAction(entrada: {
  negocio: string;
  conexionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const { data, error } = await (supabase.schema("comun_comercio") as any).rpc(
      "com_fn_omnicanal_google_contacts_desconectar",
      {
        p_negocio: neg,
        p_conexion_id: entrada.conexionId,
      }
    );

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) return { ok: false, error: String(data?.error || "No se pudo desconectar.") };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconectando cuenta Google.",
    };
  }
}

async function obtenerAccessTokenParaConexion(
  supabase: any,
  negocio: string,
  conexionId: string
): Promise<
  | { ok: true; accessToken: string; correoGoogle: string }
  | { ok: false; error: string }
> {
  const creds = await resolverCredencialesAppGoogleContacts(supabase, negocio);
  if (!creds.ok) return creds;

  const { data: rtData, error: rtErr } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_omnicanal_google_contacts_obtener_refresh_token", {
      p_negocio: negocio,
      p_conexion_id: conexionId,
    });

  if (rtErr) return { ok: false, error: rtErr.message };
  if (!rtData?.ok || !rtData.refreshToken) {
    return {
      ok: false,
      error: String(rtData?.error || "Token de Google no disponible. Reconecta tu cuenta."),
    };
  }

  const tokenRes = await refrescarAccessTokenGoogle({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    refreshToken: String(rtData.refreshToken),
  });
  if (!tokenRes.ok) return tokenRes;

  return {
    ok: true,
    accessToken: tokenRes.accessToken,
    correoGoogle: String(rtData.correoGoogle || ""),
  };
}

export async function leerContactosDesdeGoogleAction(entrada: {
  negocio: string;
  conexionId: string;
  esAgendaPersonal?: boolean;
}): Promise<
  | { ok: true; correoGoogle: string; fichas: FichaAgendaCruda[]; totalGrupos: number }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const auth = await obtenerAccessTokenParaConexion(supabase, neg, entrada.conexionId);
    if (!auth.ok) return auth;

    const lectura = await leerTodosContactosGooglePeople(auth.accessToken, {
      correoGoogle: auth.correoGoogle,
      esAgendaPersonal: entrada.esAgendaPersonal !== false,
    });
    if (!lectura.ok) return lectura;

    await (supabase.schema("comun_comercio") as any).rpc(
      "com_fn_omnicanal_google_contacts_registrar_sync",
      {
        p_negocio: neg,
        p_conexion_id: entrada.conexionId,
        p_tipo: "LECTURA",
        p_cantidad: lectura.fichas.length,
        p_detalle: { totalGrupos: lectura.totalGrupos },
      }
    );

    return {
      ok: true,
      correoGoogle: auth.correoGoogle,
      fichas: lectura.fichas,
      totalGrupos: lectura.totalGrupos,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error leyendo contactos desde Google.",
    };
  }
}

export async function prepararGruposGoogleContactsAction(entrada: {
  negocio: string;
  conexionId: string;
  nombresGrupos: string[];
}): Promise<{ ok: true; mapaGrupos: Record<string, string> } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const auth = await obtenerAccessTokenParaConexion(supabase, neg, entrada.conexionId);
    if (!auth.ok) return auth;

    return await asegurarGruposGoogleContacts(auth.accessToken, entrada.nombresGrupos);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error preparando etiquetas en Google.",
    };
  }
}

export async function aplicarLoteDepuracionGoogleAction(entrada: {
  negocio: string;
  conexionId: string;
  mapaGrupos: Record<string, string>;
  operaciones: OperacionEscrituraGoogleContacts[];
  esUltimoLote?: boolean;
  resumenFinal?: Record<string, unknown>;
}): Promise<
  | {
      ok: true;
      actualizados: number;
      etiquetadosCategoria: number;
      etiquetadosDuplicados: number;
      eliminadosPapelera: number;
      errores: string[];
      detallesLog: string[];
      rateLimited: boolean;
      retryAfterSegundos: number;
      operacionesPendientes429: OperacionEscrituraGoogleContacts[];
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const auth = await obtenerAccessTokenParaConexion(supabase, neg, entrada.conexionId);
    if (!auth.ok) return auth;

    const resultado = await aplicarLoteOperacionesGooglePeople({
      accessToken: auth.accessToken,
      mapaGrupos: entrada.mapaGrupos,
      operaciones: entrada.operaciones,
    });

    if (entrada.esUltimoLote && !resultado.rateLimited) {
      await (supabase.schema("comun_comercio") as any).rpc(
        "com_fn_omnicanal_google_contacts_registrar_sync",
        {
          p_negocio: neg,
          p_conexion_id: entrada.conexionId,
          p_tipo: "ESCRITURA",
          p_cantidad:
            resultado.actualizados +
            resultado.etiquetadosCategoria +
            resultado.etiquetadosDuplicados +
            resultado.eliminadosPapelera,
          p_detalle: entrada.resumenFinal ?? {},
        }
      );
    }

    return { ok: true, ...resultado };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error aplicando cambios en Google Contacts.",
    };
  }
}
