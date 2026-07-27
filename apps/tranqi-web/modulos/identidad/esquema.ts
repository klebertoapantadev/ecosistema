import { z } from "zod";

// PLT-001: registro cero-friccion via correo -- exactamente 4 campos.
export const esquemaRegistro = z.object({
  nombres: z.string().min(1, "Requerido"),
  apellidos: z.string().min(1, "Requerido"),
  correo: z.string().email("Correo invalido"),
  contrasena: z.string().min(8, "Minimo 8 caracteres"),
});
export type DatosRegistro = z.infer<typeof esquemaRegistro>;

export const esquemaIngreso = z.object({
  correo: z.string().email("Correo invalido"),
  contrasena: z.string().min(1, "Requerido"),
});
export type DatosIngreso = z.infer<typeof esquemaIngreso>;
