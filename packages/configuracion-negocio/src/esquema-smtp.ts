import { z } from "zod";

// PLT-008: servidor SMTP propio del negocio. La contrasena viaja en este
// esquema pero NO se guarda en la tabla -- va a Supabase Vault desde el RPC
// cfg_fn_guardar_smtp (ver la migracion 20260730000006 y ADR-0005).
//
// Vacia significa "no la cambies", para que se pueda corregir el puerto sin
// volver a teclearla. Borrarla es una accion aparte y explicita.
export const esquemaSmtp = z.object({
  host: z.string().trim().optional().or(z.literal("")),
  puerto: z.coerce.number().int().min(1, "Puerto inválido").max(65535, "Puerto inválido"),
  seguro: z.boolean(),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .email("El usuario SMTP suele ser un correo válido")
    .optional()
    .or(z.literal("")),
  remitenteNombre: z.string().trim().optional().or(z.literal("")),
  contrasena: z.string().optional().or(z.literal("")),
  activo: z.boolean(),
});
export type DatosSmtp = z.infer<typeof esquemaSmtp>;

// Activar el envio exige la configuracion completa: sin esto el negocio queda
// "activo" pero cada correo falla en silencio del lado de la Edge Function.
export function faltaParaActivar(datos: DatosSmtp, yaTieneContrasena: boolean): string | null {
  if (!datos.activo) return null;
  if (!datos.host) return "Indica el servidor (host) antes de activar el envío.";
  if (!datos.usuario) return "Indica el usuario SMTP antes de activar el envío.";
  if (!datos.contrasena && !yaTieneContrasena) return "Indica la contraseña antes de activar el envío.";
  return null;
}
