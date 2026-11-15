import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

// PLT-001 regla 6: version de terminos vigente, comun a los 4 negocios.
// Subir este numero cuando el texto de /terminos cambie de forma
// sustantiva -- queda registrado por usuario en usu_terminos_version, quien
// acepto una version vieja se puede identificar y renotificar.
export const TERMINOS_VERSION = "v1";

// PLT-001: registro via correo con captura de WhatsApp y consentimiento
// expreso LOPDP para contactar y enviar informacion comercial / proformas,
// mas aceptacion de Terminos de Servicio (PLT-001 regla 6).
export const esquemaRegistro = z
  .object({
    nombres: z.string().trim().min(1, "Requerido"),
    apellidos: z.string().trim().min(1, "Requerido"),
    correo: z.string().trim().email("Correo invalido"),
    contrasena: z.string().min(8, "Minimo 8 caracteres"),
    whatsapp: z.string().trim().min(1, "Ingresa tu número de WhatsApp"),
    codigoPaisWhatsapp: z.string().trim().optional(),
    autorizaWhatsapp: z.boolean().refine((v) => v === true, {
      message: "Debes autorizar el consentimiento para contactarte y enviarte información por WhatsApp",
    }),
    aceptaTerminos: z.boolean().refine((v) => v === true, { message: "Debes aceptar los Términos de Servicio" }),
  })
  .refine((d) => isValidPhoneNumber(d.whatsapp), {
    message: "Ingresa un número de WhatsApp válido",
    path: ["whatsapp"],
  });
export type DatosRegistro = z.infer<typeof esquemaRegistro>;

export const esquemaIngreso = z.object({
  correo: z.string().email("Correo invalido"),
  contrasena: z.string().min(1, "Requerido"),
});
export type DatosIngreso = z.infer<typeof esquemaIngreso>;

export const esquemaSolicitarRecuperacion = z.object({
  correo: z.string().email("Correo invalido"),
});
export type DatosSolicitarRecuperacion = z.infer<typeof esquemaSolicitarRecuperacion>;

export const esquemaRestablecerContrasena = z.object({
  token: z.string().min(1, "Enlace invalido"),
  contrasena: z.string().min(8, "Minimo 8 caracteres"),
});
export type DatosRestablecerContrasena = z.infer<typeof esquemaRestablecerContrasena>;

// PLT-001 regla 2: confirmar identidad (Google no siempre da un nombre claro
// -- ej. cuentas de correo comerciales) + WhatsApp opt-in, siempre opcional.
// El formulario compone `whatsapp` en formato E.164 (+593987654321) antes
// de enviarlo -- el pais y el conteo de digitos por pais se validan en el
// cliente con libphonenumber-js (ver componentes/FormularioBienvenida),
// esto es la validacion de respaldo en el servidor.
export const esquemaBienvenida = z
  .object({
    nombres: z.string().trim().min(1, "Requerido"),
    apellidos: z.string().trim().min(1, "Requerido"),
    autorizaWhatsapp: z.boolean(),
    whatsapp: z.string().trim().optional(),
  })
  .refine((d) => !d.autorizaWhatsapp || (d.whatsapp && isValidPhoneNumber(d.whatsapp)), {
    message: "Ingresa un número válido para que podamos contactarte",
    path: ["whatsapp"],
  });
export type DatosBienvenida = z.infer<typeof esquemaBienvenida>;
