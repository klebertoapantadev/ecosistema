import { z } from "zod";

export const URL_ARIA_DEFECTO = "https://logs-testing.mysatcomla.com/agentes";

/**
 * Vista segura (sin secretos) de la fila `comun_configuracion.cfg_aria`.
 * Las claves (`ARIA_AGENT_KEY`, `ARIA_TENANT_KEY`, `ARIA_GATE_KEY`) viven en
 * Supabase Vault y jamás se retornan al navegador ni al código de aplicación:
 * únicamente se expone si existen (`tieneApiKey`, etc.).
 */
export interface ConfiguracionAriaVista {
  negocio: string;
  baseUrl: string;
  agenteId: string;
  nombreAgente: string;
  activo: boolean;
  tieneApiKey: boolean;
  tieneTenantKey: boolean;
  tieneGateKey: boolean;
  actualizadoEn: string | null;
}

export const esquemaAria = z.object({
  baseUrl: z
    .string()
    .trim()
    .url("Indica una URL válida para ARIA_BASE (ej. https://logs-testing.mysatcomla.com/agentes)")
    .optional()
    .or(z.literal("")),
  agenteId: z.string().trim().max(120, "ID demasiado largo").optional().or(z.literal("")),
  nombreAgente: z.string().trim().max(120, "Nombre demasiado largo").optional().or(z.literal("")),
  apiKey: z.string().trim().optional().or(z.literal("")),
  tenantKey: z.string().trim().optional().or(z.literal("")),
  gateKey: z.string().trim().optional().or(z.literal("")),
  activo: z.boolean(),
});

export type DatosAria = z.infer<typeof esquemaAria>;

export function faltaParaActivarAria(datos: DatosAria, yaTieneApiKey: boolean): string | null {
  if (!datos.activo) return null;
  if (!datos.baseUrl) return "Indica la URL base de ARIA (ARIA_BASE) antes de activar el agente.";
  if (!datos.agenteId) return "Indica el ID del agente (ARIA_AGENT_ID) antes de activar el agente.";
  if (!datos.apiKey && !yaTieneApiKey) {
    return "Indica la API Key del agente (ARIA_AGENT_KEY) antes de activarlo.";
  }
  return null;
}

