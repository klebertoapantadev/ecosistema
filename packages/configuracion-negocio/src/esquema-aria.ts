import { z } from "zod";

export const URL_ARIA_DEFECTO = "https://aria.midomo.site";
export const MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER = "google/gemini-2.5-flash-image";
export const MODELO_ESTUDIO_IA_DEFECTO_GEMINI = "gemini-2.5-flash-image";
export type ProveedorEstudioIa = "openrouter" | "gemini";

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
  // Configuración Canal WhatsApp Business (YCloud)
  ycloudHabilitado?: boolean;
  ycloudNumeroEmisor?: string;
  ycloudNumerosPermitidos?: string;
  whatsappAgenteId?: string;
  ycloudWebhookToken?: string;
  respaldoWebhookAriaPrevio?: string;
  tieneYcloudApiKey?: boolean;
  tieneYcloudWebhookSecret?: boolean;
  tieneWhatsappAgenteKey?: boolean;
  tieneSttApiKey?: boolean;
  // Configuración Estudio IA (Generador de Fotos OpenRouter / Gemini en Vault)
  estudioIaProveedor?: ProveedorEstudioIa;
  estudioIaModelo?: string;
  estudioIaActivo?: boolean;
  tieneEstudioIaApiKey?: boolean;
}

export const esquemaAria = z.object({
  baseUrl: z
    .string()
    .trim()
    .url("Indica una URL válida para ARIA_BASE (ej. https://aria.midomo.site)")
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

