import { z } from "zod";

/**
 * Formulario «Escríbenos» de la landing. Tres públicos con un mismo formulario:
 * la persona que pregunta por la membresía, la empresa interesada en el plan
 * corporativo y el abogado que quiere entrar a la red.
 */
export const TIPOS_CONTACTO = ["persona", "empresa", "abogado"] as const;
export type TipoContacto = (typeof TIPOS_CONTACTO)[number];

export const esquemaContactoLanding = z
  .object({
    tipo: z.enum(TIPOS_CONTACTO),
    nombre: z.string().trim().min(2, "Escribe tu nombre.").max(120),
    correo: z.string().trim().toLowerCase().email("Revisa tu correo electrónico.").max(160),
    telefono: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/, "Revisa tu número de teléfono."),
    // Empresa y número de colaboradores (solo «Mi empresa»).
    empresa: z.string().trim().max(160).optional(),
    // Especialidad y ciudad (solo «Soy abogado»).
    especialidad: z.string().trim().max(160).optional(),
    mensaje: z.string().trim().min(5, "Cuéntanos en qué te ayudamos.").max(2000),
    // Trampa para robots: un humano nunca ve ni rellena este campo.
    sitio: z.string().max(0).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.tipo === "empresa" && !d.empresa) {
      ctx.addIssue({ code: "custom", path: ["empresa"], message: "Escribe el nombre de tu empresa." });
    }
    if (d.tipo === "abogado" && !d.especialidad) {
      ctx.addIssue({ code: "custom", path: ["especialidad"], message: "Indica tu especialidad y ciudad." });
    }
  });

export type ContactoLanding = z.infer<typeof esquemaContactoLanding>;
