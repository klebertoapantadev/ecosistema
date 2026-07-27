import { z } from "zod";

// PLT-008 / PLT-011: identidad legal del negocio. Redes sociales, canales y
// terminos (tambien PLT-008) quedan en cfg_detalle_configuracion -- se
// agregan a este formulario cuando existan pantallas para ellos.
export const esquemaConfiguracionNegocio = z.object({
  identificacion: z.string().trim().optional(),
  nombreComercial: z.string().trim().min(1, "Requerido"),
  razonSocial: z.string().trim().optional(),
  // PLT-008 regla 2 (canal "Correo de Soporte/Notificaciones"). Por ahora
  // solo se captura el dato -- el envio real de correos transaccionales
  // (reset de contrasena, etc.) sigue saliendo del remitente unico de
  // Supabase Auth hasta que se decida proveedor/dominio por negocio.
  correoNotificaciones: z.string().trim().toLowerCase().email("Correo inválido").optional().or(z.literal("")),
});
export type DatosConfiguracionNegocio = z.infer<typeof esquemaConfiguracionNegocio>;
