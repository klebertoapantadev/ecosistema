import { z } from "zod";

/**
 * Vista segura (sin secretos) de `comun_configuracion.cfg_marketing_meta`.
 * El Access Token de Meta Conversions API vive exclusivamente en Supabase Vault
 * y jamás se retorna al cliente: solo se expone `tieneCapiToken`.
 */
export interface ConfiguracionMarketingMetaVista {
  negocio: string;
  pixelId: string;
  dominioVerificacion: string;
  testEventCode: string;
  catalogoActivo: boolean;
  activo: boolean;
  tieneCapiToken: boolean;
  actualizadoEn: string | null;
}

export const esquemaMarketingMeta = z.object({
  pixelId: z
    .string()
    .trim()
    .max(40, "El Pixel ID es demasiado largo")
    .refine((v) => !v || /^[0-9]{8,25}$/.test(v), "El Meta Pixel ID debe contener entre 8 y 25 dígitos")
    .optional()
    .or(z.literal("")),
  dominioVerificacion: z
    .string()
    .trim()
    .max(120, "Código de verificación demasiado largo")
    .optional()
    .or(z.literal("")),
  testEventCode: z
    .string()
    .trim()
    .max(60, "Test Event Code demasiado largo")
    .optional()
    .or(z.literal("")),
  capiToken: z.string().trim().optional().or(z.literal("")),
  catalogoActivo: z.boolean(),
  activo: z.boolean(),
});

export type DatosMarketingMeta = z.infer<typeof esquemaMarketingMeta>;
