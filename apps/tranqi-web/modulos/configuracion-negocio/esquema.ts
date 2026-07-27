import { z } from "zod";

// PLT-008 / PLT-011: identidad legal del negocio. Redes sociales, canales y
// terminos (tambien PLT-008) quedan en cfg_detalle_configuracion -- se
// agregan a este formulario cuando existan pantallas para ellos.
export const esquemaConfiguracionNegocio = z.object({
  identificacion: z.string().trim().optional(),
  nombreComercial: z.string().trim().min(1, "Requerido"),
  razonSocial: z.string().trim().optional(),
});
export type DatosConfiguracionNegocio = z.infer<typeof esquemaConfiguracionNegocio>;
