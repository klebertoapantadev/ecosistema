// Tipos y validadores de tokens MCP por negocio (PLT-022)
// Permite autenticar clientes externos de agentes de IA (WhatsApp, n8n, Claude Desktop, Cursor)
// mediante Bearer Tokens de formato `eco_live_...`.

export interface ContextoTokenMcp {
  valido: boolean;
  tokenId?: string;
  negocioId?: string;
  nombre?: string;
  alcances?: string[];
  motivo?: string;
}

export interface TokenMcpItem {
  id: string;
  secuencial: number;
  nombre: string;
  prefijo: string;
  negocio_id: string;
  alcances: string[];
  expira_en: string | null;
  ultimo_uso_en: string | null;
  revocado_en: string | null;
  activo: boolean;
  creado_en: string;
}

export interface RespuestaGenerarTokenMcp {
  token_id: string;
  secuencial: number;
  token_secreto: string;
  prefijo: string;
  nombre: string;
  negocio_id: string;
  alcances: string[];
  expira_en: string | null;
  creado_en: string;
}

/**
 * Extrae el Bearer token del encabezado Authorization de una petición HTTP.
 */
export function extraerBearerToken(peticion: Request): string | null {
  const authHeader = peticion.headers.get("Authorization") || peticion.headers.get("authorization");
  if (!authHeader) return null;

  const partes = authHeader.trim().split(/\s+/);
  const esquema = partes[0];
  const token = partes[1];
  if (partes.length === 2 && esquema && esquema.toLowerCase() === "bearer" && token) {
    return token;
  }
  return null;
}

/**
 * Valida un token MCP contra la función RPC `comun_seguridad.seg_fn_validar_token_mcp` de Supabase
 * usando fetch estándar (sin dependencias adicionales, compatible con runtime Node y Edge).
 */
export async function validarTokenMcpConRpc(
  tokenTexto: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  alcanceRequerido?: string
): Promise<ContextoTokenMcp | null> {
  if (!tokenTexto || !tokenTexto.startsWith("eco_live_")) {
    return null;
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/seg_fn_validar_token_mcp`;

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        p_token_texto: tokenTexto,
        p_alcance_requerido: alcanceRequerido ?? null,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!respuesta.ok) {
      return null;
    }

    const data = await respuesta.json();
    if (data && data.valido === true) {
      return {
        valido: true,
        tokenId: data.token_id,
        negocioId: data.negocio_id,
        nombre: data.nombre,
        alcances: Array.isArray(data.alcances) ? data.alcances : [],
      };
    }

    return null;
  } catch (err) {
    console.error("[@eco/agentes-ia] Error validando token MCP:", err);
    return null;
  }
}
