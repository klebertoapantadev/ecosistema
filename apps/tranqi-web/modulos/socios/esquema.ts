import { z } from "zod";

// Portales oficiales de verificacion (PLT-... / TRQ-001 regla "verificacion
// asistida"). Enlazamos al dominio raiz, no a una ruta profunda especifica
// -- no hay certeza de que el path exacto de consulta de titulos/matricula
// se mantenga estable, y un enlace roto en un formulario legal es peor que
// uno generico. Confirmar/ajustar el path exacto con el equipo antes de
// promocionar esto como el flujo definitivo.
export const ENLACES_VERIFICACION = {
  senescyt: "https://www.senescyt.gob.ec/",
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

// TRQ-001: solicitud de registro de socio abogado. Campos definidos en esta
// implementacion (no existia el documento de plan referenciado en
// especificacion-tecnica.md -- ver nota ahi). MFA no es requisito para
// enviarla -- ver gobernanza/productos/tranqi/especificacion-funcional.md.
export const esquemaSolicitudSocio = z.object({
  cedula: z.string().trim().min(10, "Cédula inválida").max(13, "Cédula inválida"),
  matriculaProfesional: z.string().trim().min(1, "Requerido"),
  universidad: z.string().trim().min(1, "Requerido"),
  anioGraduacion: z.coerce.number().int().min(1960, "Año inválido").max(ANIO_ACTUAL, "Año inválido"),
  anosExperiencia: z.coerce.number().int().min(0, "No puede ser negativo").max(70, "Revisa el valor"),
  resumenProfesional: z.string().trim().min(30, "Cuéntanos un poco más (mínimo 30 caracteres)"),
  telefonoContacto: z.string().trim().optional(),
  materiaIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una especialidad"),
  provinciaIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una provincia de cobertura"),
  experiencia: z.array(esquemaExperienciaLaboral).default([]),
  enlaceSenescytVerificado: z.boolean().refine((v) => v === true, {
    message: "Confirma que verificaste tu título en SENESCYT",
  }),
  enlaceForoVerificado: z.boolean().refine((v) => v === true, {
    message: "Confirma que verificaste tu matrícula en el Foro de Abogados",
  }),
  declaracionVeracidad: z.boolean().refine((v) => v === true, {
    message: "Debes confirmar que la información es verídica",
  }),
});
export type DatosSolicitudSocio = z.infer<typeof esquemaSolicitudSocio>;

export const esquemaDecisionSolicitud = z.object({
  solicitudId: z.string().uuid(),
  decision: z.enum(["aceptada", "rechazada"]),
  comentario: z.string().trim().optional(),
});
export type DatosDecisionSolicitud = z.infer<typeof esquemaDecisionSolicitud>;
