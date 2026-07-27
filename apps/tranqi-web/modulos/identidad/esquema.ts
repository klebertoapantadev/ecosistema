import { z } from "zod";

// PLT-001 regla 6: version de terminos vigente. Subir este numero cuando el
// texto de /terminos cambie de forma sustantiva -- queda registrado por
// usuario en usu_terminos_version, quien acepto una version vieja se puede
// identificar y renotificar.
export const TERMINOS_VERSION = "v1";

// PLT-001: registro cero-friccion via correo -- exactamente 4 campos + el
// consentimiento de terminos (PLT-001 regla 6), obligatorio para ambos
// caminos de registro.
export const esquemaRegistro = z.object({
  nombres: z.string().min(1, "Requerido"),
  apellidos: z.string().min(1, "Requerido"),
  correo: z.string().email("Correo invalido"),
  contrasena: z.string().min(8, "Minimo 8 caracteres"),
  aceptaTerminos: z.boolean().refine((v) => v === true, { message: "Debes aceptar los Términos de Servicio" }),
});
export type DatosRegistro = z.infer<typeof esquemaRegistro>;

export const esquemaIngreso = z.object({
  correo: z.string().email("Correo invalido"),
  contrasena: z.string().min(1, "Requerido"),
});
export type DatosIngreso = z.infer<typeof esquemaIngreso>;

// PLT-001 regla 2: confirmar identidad (Google no siempre da un nombre claro
// -- ej. cuentas de correo comerciales) + WhatsApp opt-in, siempre opcional.
export const esquemaBienvenida = z
  .object({
    nombres: z.string().trim().min(1, "Requerido"),
    apellidos: z.string().trim().min(1, "Requerido"),
    autorizaWhatsapp: z.boolean(),
    whatsapp: z.string().trim().optional(),
  })
  .refine((d) => !d.autorizaWhatsapp || (d.whatsapp && d.whatsapp.length >= 7), {
    message: "Ingresa un número válido para que podamos contactarte",
    path: ["whatsapp"],
  });
export type DatosBienvenida = z.infer<typeof esquemaBienvenida>;
