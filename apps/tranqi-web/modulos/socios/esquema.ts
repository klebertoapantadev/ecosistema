import { z } from "zod";

// Portales oficiales de verificación
export const ENLACES_VERIFICACION = {
  senescyt: "https://cdn.ecuadorlegalonline.com/modulo/senescyt/consulta-de-titulos.htm",
  foroAbogados: "https://www.funcionjudicial.gob.ec/",
};

export const esquemaExperienciaLaboral = z.object({
  empresa: z.string().trim().min(1, "Requerido"),
  cargo: z.string().trim().min(1, "Requerido"),
  fechaInicio: z.string().min(1, "Requerido"),
  fechaFin: z.string().trim().optional(),
  descripcion: z.string().trim().optional(),
});
export type DatosExperienciaLaboral = z.infer<typeof esquemaExperienciaLaboral>;

const ANIO_ACTUAL = new Date().getFullYear();

// TRQ-001: solicitud de registro de socio abogado.
export const esquemaSolicitudSocio = z.object({
  cedula: z.string().trim().min(10, "Cédula inválida").max(13, "Cédula inválida"),
  matriculaProfesional: z.string().trim().min(1, "Requerido"),
  universidad: z.string().trim().min(1, "Requerido"),
  anioGraduacion: z.coerce.number().int().min(1960, "Año inválido").max(ANIO_ACTUAL, "Año inválido"),
  anosExperiencia: z.coerce.number().int().min(0, "No puede ser negativo").max(70, "Revisa el valor"),
  resumenProfesional: z.string().trim().min(20, "Cuéntanos un poco más (mínimo 20 caracteres)"),
  telefonoContacto: z.string().trim().optional(),
  materiaIds: z.array(z.string()).min(1, "Selecciona al menos una especialidad"),
  provinciaIds: z.array(z.string()).min(1, "Selecciona al menos una provincia de cobertura"),
  experiencia: z.array(esquemaExperienciaLaboral).default([]),
  enlaceSenescytVerificado: z.boolean().default(true),
  enlaceForoVerificado: z.boolean().default(true),
  declaracionVeracidad: z.boolean().refine((v) => v === true, {
    message: "Debes autorizar la verificación de la información y aceptar los términos (LOPDP)",
  }),
});
export type DatosSolicitudSocio = z.infer<typeof esquemaSolicitudSocio>;

export const esquemaDecisionSolicitud = z.object({
  solicitudId: z.string().uuid(),
  decision: z.enum(["aceptada", "rechazada"]),
  comentario: z.string().trim().optional(),
});
export type DatosDecisionSolicitud = z.infer<typeof esquemaDecisionSolicitud>;

/**
 * Sanitiza nombres de archivo eliminando caracteres especiales, tildes, virgulillas (~),
 * espacios y símbolos incompatibles con Supabase Storage keys (S3).
 */
export function sanearNombreArchivo(nombre: string): string {
  if (!nombre) return "archivo";
  const partes = nombre.split(".");
  const extension = partes.length > 1 ? partes.pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = partes.join(".");

  // Normalizar acentos (ej. á -> a, ñ -> n)
  const sinAcentos = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Reemplazar caracteres no alfanuméricos ni guiones por _
  const baseLimpia = sinAcentos
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const nombreFinal = baseLimpia || "documento";
  return extension ? `${nombreFinal}.${extension}` : nombreFinal;
}

