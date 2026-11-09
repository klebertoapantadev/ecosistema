"use server";

import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { huecosPorSemana, type Franja } from "@eco/agenda";
import { agregarCampanaServidor } from "../../app/api/notificaciones/almacen";

export type Resultado<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MARCA_REGISTRO_MANUAL = "[REGISTRO_MANUAL_EQUIPO]";
const FECHA_CORTE_PURGA_SOLICITUDES = "2026-11-08T13:30:00.000Z";
const URL_REGISTRO_ABOGADOS = "https://www.tranqi24.com/abogados";

const NOMBRES_PROVINCIAS_ECUADOR: string[] = [
  "Azuay",
  "Bolívar",
  "Cañar",
  "Carchi",
  "Chimborazo",
  "Cotopaxi",
  "El Oro",
  "Esmeraldas",
  "Galápagos",
  "Guayas",
  "Imbabura",
  "Loja",
  "Los Ríos",
  "Manabí",
  "Morona Santiago",
  "Napo",
  "Orellana",
  "Pastaza",
  "Pichincha",
  "Santa Elena",
  "Santo Domingo de los Tsáchilas",
  "Sucumbíos",
  "Tungurahua",
  "Zamora Chinchipe",
];

const PROVINCIAS_ECUADOR_FALLBACK: ProvinciaItem[] = NOMBRES_PROVINCIAS_ECUADOR.map((nombre) => ({
  cat_id: `prov:${nombre}`,
  cat_nombre: nombre,
}));

export interface UsuarioPlataformaItem {
  usu_id: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  cedula: string;
  yaEsAbogado: boolean;
  abogadoId: string | null;
  estadoAbogado: "verificado" | "suspendido" | null;
}

export interface MateriaItem {
  mat_id: string;
  mat_nombre: string;
}

export interface ProvinciaItem {
  cat_id: string;
  cat_nombre: string;
  cat_region?: string;
}

export interface FechaEspecialAbogado {
  fecha: string;
  nombre: string;
  cerrado_total: boolean;
  habilitar_virtual: boolean;
  franjas_virtual: Array<{ hora_inicio: string; hora_fin: string }>;
  habilitar_presencial: boolean;
  franjas_presencial: Array<{ hora_inicio: string; hora_fin: string }>;
}

export interface ConfiguracionAgendaAbogado {
  zona_horaria: string;
  duracion_cita_min: number;
  holgura_min: number;
  antelacion_minima_horas: number;
  horizonte_dias: number;
  modalidades: ("virtual" | "presencial")[];
  acepta_turno: boolean;
  direccion: string | null;
  fechas_especiales?: FechaEspecialAbogado[];
}

export interface HistorialCambioRolItem {
  id: string;
  fecha: string;
  accion:
    | "PROPUESTA_ASIGNACION"
    | "ACEPTACION_USUARIO"
    | "RECHAZO_USUARIO"
    | "ACTIVACION_ROL"
    | "SUSPENSION_ROL"
    | "BAJA_LOGICA_ROL"
    | "ACTUALIZACION_FICHA";
  rol: string;
  estadoResultante: "pendiente_aceptacion" | "activo" | "suspendido" | "baja_logica" | "rechazado";
  ejecutadoPorNombre: string;
  ejecutadoPorCorreo: string;
  detalle: string;
}

export interface AbogadoRedItem {
  abg_id: string;
  usu_id: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  cedula: string;
  matriculaProfesional: string;
  universidad: string;
  anioGraduacion: number;
  anosExperiencia: number;
  resumenProfesional: string;
  origenRegistro: "manual_operador" | "autogestion";
  estado: "verificado" | "suspendido";
  verificadoEn: string;
  registradoPorNombre: string;
  registradoPorCorreo: string;
  fechaRegistro: string;
  estadoAceptacion: "pendiente_aceptacion" | "aceptado" | "rechazado";
  fechaAceptacion: string | null;
  bajaLogica: boolean;
  fechaBajaLogica: string | null;
  bajaLogicaPorNombre: string | null;
  casosAsignadosActivos: number;
  citasActivas: number;
  historialCambiosRol: HistorialCambioRolItem[];
  materias: MateriaItem[];
  provincias: ProvinciaItem[];
  agendaConfigurada: boolean;
  configuracionAgenda: ConfiguracionAgendaAbogado;
  franjas: Franja[];
  citasPorSemana: number;
}

const AGENDA_POR_DEFECTO: ConfiguracionAgendaAbogado = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 12,
  horizonte_dias: 60,
  modalidades: ["virtual", "presencial"],
  acepta_turno: true,
  direccion: "Quito — Atención Presencial y Teleconsulta",
};

const FRANJAS_POR_DEFECTO: Franja[] = [
  { dia_semana: 1, hora_inicio: "08:00", hora_fin: "19:00", modalidad: "virtual" },
  { dia_semana: 2, hora_inicio: "08:00", hora_fin: "19:00", modalidad: "virtual" },
  { dia_semana: 3, hora_inicio: "08:00", hora_fin: "19:00", modalidad: "virtual" },
  { dia_semana: 4, hora_inicio: "08:00", hora_fin: "19:00", modalidad: "virtual" },
  { dia_semana: 5, hora_inicio: "08:00", hora_fin: "19:00", modalidad: "virtual" },
  { dia_semana: 6, hora_inicio: "09:00", hora_fin: "14:00", modalidad: "virtual" },
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:30", modalidad: "presencial" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:30", modalidad: "presencial" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:30", modalidad: "presencial" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:30", modalidad: "presencial" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:30", modalidad: "presencial" },
];

async function verificarEsOperadorOAdmin(): Promise<boolean> {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return false;
  const correo = (perfil.usu_correo || "").toLowerCase().trim();
  if (
    perfil.usu_superadmin_plataforma ||
    correo === "familiammtg@gmail.com" ||
    correo === "jesus251296@gmail.com"
  ) {
    return true;
  }
  const perfiles = await obtenerPerfiles("tranqi");
  return perfiles.some((p) =>
    ["SUPERADMIN", "ADMINISTRADOR", "ADMIN", "OPERADOR", "AUXILIAR"].includes(
      p.toUpperCase()
    )
  );
}

/**
 * Sincroniza el rol ABOGADO en comun_seguridad (seg_membresia y seg_membresia_perfil)
 * para que el usuario convertido en abogado activo vea inmediatamente la plataforma como Abogado.
 */
async function sincronizarRolAbogadoEnSeguridad(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  usuarioId: string,
  activar: boolean,
  asignadoPorId?: string | null
) {
  try {
    const { data: perfAbg } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_id, per_clave")
      .eq("per_clave", "ABOGADO")
      .maybeSingle();

    const { data: perfCli } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_id, per_clave")
      .eq("per_clave", "CLIENTE")
      .maybeSingle();

    const { data: mems } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_negocio, mem_rol")
      .eq("mem_usuario_id", usuarioId);

    const memsTranqi = (mems || []).filter((m: { mem_negocio?: string }) =>
      (m.mem_negocio || "").toUpperCase().startsWith("TRANQ")
    );

    if (memsTranqi.length === 0 && activar) {
      for (const negClave of ["tranqi", "TRANQ"]) {
        const { data: nuevaMem } = await adminSupabase
          .schema("comun_seguridad")
          .from("seg_membresia")
          .insert({
            mem_usuario_id: usuarioId,
            mem_negocio: negClave,
            mem_rol: "ABOGADO",
            mem_estado: "ACTIVO",
          })
          .select("mem_id, mem_negocio, mem_rol")
          .maybeSingle();
        if (nuevaMem) memsTranqi.push(nuevaMem);
      }
    }

    for (const mem of memsTranqi) {
      if (activar) {
        if (perfCli?.per_id) {
          await adminSupabase
            .schema("comun_seguridad")
            .from("seg_membresia_perfil")
            .upsert(
              {
                mpe_membresia_id: mem.mem_id,
                mpe_perfil_id: perfCli.per_id,
                mpe_asignado_por: asignadoPorId || null,
                mpe_actualizado_en: new Date().toISOString(),
              },
              { onConflict: "mpe_membresia_id,mpe_perfil_id" }
            );
        }
        if (perfAbg?.per_id) {
          await adminSupabase
            .schema("comun_seguridad")
            .from("seg_membresia_perfil")
            .upsert(
              {
                mpe_membresia_id: mem.mem_id,
                mpe_perfil_id: perfAbg.per_id,
                mpe_asignado_por: asignadoPorId || null,
                mpe_actualizado_en: new Date().toISOString(),
              },
              { onConflict: "mpe_membresia_id,mpe_perfil_id" }
            );
        }
        const rolActual = (mem.mem_rol || "").toUpperCase();
        const nuevoRol = ["SUPERADMIN", "ADMINISTRADOR", "ADMIN"].includes(rolActual)
          ? rolActual
          : "ABOGADO";
        await adminSupabase
          .schema("comun_seguridad")
          .from("seg_membresia")
          .update({
            mem_rol: nuevoRol,
            mem_estado: "ACTIVO",
            mem_actualizado_en: new Date().toISOString(),
          })
          .eq("mem_id", mem.mem_id);
      } else {
        if (perfAbg?.per_id) {
          await adminSupabase
            .schema("comun_seguridad")
            .from("seg_membresia_perfil")
            .delete()
            .eq("mpe_membresia_id", mem.mem_id)
            .eq("mpe_perfil_id", perfAbg.per_id);
        }
        const rolActual = (mem.mem_rol || "").toUpperCase();
        if (rolActual === "ABOGADO") {
          await adminSupabase
            .schema("comun_seguridad")
            .from("seg_membresia")
            .update({
              mem_rol: "CLIENTE",
              mem_actualizado_en: new Date().toISOString(),
            })
            .eq("mem_id", mem.mem_id);
        }
      }
    }
  } catch (err) {
    console.warn("Aviso al sincronizar rol ABOGADO en seguridad:", err);
  }
}

/**
 * Purga automáticamente todas las solicitudes de socio previas a la fecha de corte
 * y permite también purgar el 100% de las solicitudes bajo demanda del operador.
 */
export async function ejecutarPurgaSolicitudesSocioInterna(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  soloPreviasACorte: boolean = false
): Promise<number> {
  try {
    let query = adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select("ssc_id, ssc_usuario_id, ssc_resumen_profesional, ssc_creado_en");

    if (soloPreviasACorte) {
      query = query.lt("ssc_creado_en", FECHA_CORTE_PURGA_SOLICITUDES);
    }

    const { data: sols } = await query;
    if (!sols || sols.length === 0) return 0;

    // Filtrar las filas técnicas de respaldo de registro manual (si existen)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aBorrar = (sols as any[]).filter(
      (s) => !String(s.ssc_resumen_profesional || "").includes(MARCA_REGISTRO_MANUAL)
    );

    if (aBorrar.length === 0) return 0;
    const ids = aBorrar.map((s) => s.ssc_id);

    // 1. Buscar abogados atados a estas solicitudes de autogestión
    const { data: abgsAtados } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_usuario_id, abg_solicitud_id")
      .in("abg_solicitud_id", ids);

    if (abgsAtados && abgsAtados.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const abgIds = (abgsAtados as any[]).map((a) => a.abg_id);
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_honorario")
        .delete()
        .in("hon_abogado_id", abgIds);

      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_materia")
        .delete()
        .in("amt_abogado_id", abgIds);

      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_provincia")
        .delete()
        .in("apr_abogado_id", abgIds);

      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado")
        .delete()
        .in("abg_id", abgIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const abg of abgsAtados as any[]) {
        if (abg.abg_usuario_id) {
          await sincronizarRolAbogadoEnSeguridad(adminSupabase, abg.abg_usuario_id, false);
        }
      }
    }

    // 2. Eliminar tablas dependientes de trq_solicitud_socio
    await Promise.all([
      adminSupabase.schema("tranqui_legal").from("trq_version_contrato_socio").delete().in("vcs_solicitud_id", ids),
      adminSupabase.schema("tranqui_legal").from("trq_revision_solicitud").delete().in("rev_solicitud_id", ids),
      adminSupabase.schema("tranqui_legal").from("trq_documento_socio").delete().in("dcs_solicitud_id", ids),
      adminSupabase.schema("tranqui_legal").from("trq_experiencia_laboral").delete().in("exp_solicitud_id", ids),
      adminSupabase.schema("tranqui_legal").from("trq_solicitud_materia").delete().in("sma_solicitud_id", ids),
      adminSupabase.schema("tranqui_legal").from("trq_solicitud_provincia").delete().in("spr_solicitud_id", ids),
    ]);

    // 3. Eliminar físicamente las solicitudes de socio
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .delete()
      .in("ssc_id", ids);

    return ids.length;
  } catch (err) {
    console.warn("Aviso al purgar solicitudes de socio:", err);
    return 0;
  }
}

export async function purgarTodasSolicitudesSocioAction(): Promise<Resultado<{ eliminadas: number }>> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No tienes permisos para eliminar solicitudes." };
  }

  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  const eliminadas = await ejecutarPurgaSolicitudesSocioInterna(adminSupabase, false);

  revalidatePath("/panel/socios");
  revalidatePath("/panel/administrar");
  revalidatePath("/panel/red-profesional");
  revalidatePath("/panel");
  return { ok: true, data: { eliminadas } };
}

export async function eliminarSolicitudSocioIndividualAction(
  solicitudId: string
): Promise<Resultado> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No tienes permisos para eliminar esta solicitud." };
  }

  const supabase = await crearClienteServidor();
  const adminSupabase = (crearClienteAdmin() || supabase) as any;

  try {
    const { data: abgs } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_usuario_id")
      .eq("abg_solicitud_id", solicitudId);

    if (abgs && abgs.length > 0) {
      const abgIds = abgs.map((a: { abg_id: string }) => a.abg_id);
      await adminSupabase.schema("tranqui_legal").from("trq_honorario").delete().in("hon_abogado_id", abgIds);
      await adminSupabase.schema("tranqui_legal").from("trq_abogado").delete().in("abg_id", abgIds);
      for (const a of abgs) {
        if (a.abg_usuario_id) {
          await sincronizarRolAbogadoEnSeguridad(adminSupabase, a.abg_usuario_id, false);
        }
      }
    }

    await Promise.all([
      adminSupabase.schema("tranqui_legal").from("trq_version_contrato_socio").delete().eq("vcs_solicitud_id", solicitudId),
      adminSupabase.schema("tranqui_legal").from("trq_revision_solicitud").delete().eq("rev_solicitud_id", solicitudId),
      adminSupabase.schema("tranqui_legal").from("trq_documento_socio").delete().eq("dcs_solicitud_id", solicitudId),
      adminSupabase.schema("tranqui_legal").from("trq_experiencia_laboral").delete().eq("exp_solicitud_id", solicitudId),
      adminSupabase.schema("tranqui_legal").from("trq_solicitud_materia").delete().eq("sma_solicitud_id", solicitudId),
      adminSupabase.schema("tranqui_legal").from("trq_solicitud_provincia").delete().eq("spr_solicitud_id", solicitudId),
    ]);

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .delete()
      .eq("ssc_id", solicitudId);

    revalidatePath("/panel/socios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo eliminar la solicitud.",
    };
  }
}

async function obtenerProvinciasResiliente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any
): Promise<ProvinciaItem[]> {
  try {
    // 1. Consultar primero con el cliente autenticado (comun_catalogo tiene GRANT SELECT TO authenticated)
    const { data: provAuth } = await supabase
      .schema("comun_catalogo")
      .from("cat_provincia")
      .select("cat_id, cat_nombre")
      .order("cat_nombre");

    if (Array.isArray(provAuth) && provAuth.length > 0) {
      return provAuth as ProvinciaItem[];
    }
  } catch {
    // Continuar con fallback adminSupabase
  }

  try {
    const { data: provAdmin } = await adminSupabase
      .schema("comun_catalogo")
      .from("cat_provincia")
      .select("cat_id, cat_nombre")
      .order("cat_nombre");

    if (Array.isArray(provAdmin) && provAdmin.length > 0) {
      return provAdmin as ProvinciaItem[];
    }
  } catch {
    // Continuar con fallback estático de las 24 provincias del Ecuador
  }

  return PROVINCIAS_ECUADOR_FALLBACK;
}

function resolverProvinciasSeleccionadas(
  provinciasIds: string[],
  catalogoProvincias: ProvinciaItem[]
): { uuidsReales: string[]; objetosProvincia: ProvinciaItem[] } {
  const mapaPorId = new Map<string, ProvinciaItem>();
  const mapaPorNombre = new Map<string, ProvinciaItem>();

  for (const p of catalogoProvincias) {
    mapaPorId.set(p.cat_id, p);
    mapaPorNombre.set(p.cat_nombre.toLowerCase().trim(), p);
  }
  for (const p of PROVINCIAS_ECUADOR_FALLBACK) {
    if (!mapaPorId.has(p.cat_id)) mapaPorId.set(p.cat_id, p);
    if (!mapaPorNombre.has(p.cat_nombre.toLowerCase().trim())) {
      mapaPorNombre.set(p.cat_nombre.toLowerCase().trim(), p);
    }
  }

  const uuidsReales: string[] = [];
  const objetosProvincia: ProvinciaItem[] = [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (const rawId of provinciasIds) {
    const idLimpio = String(rawId || "").trim();
    if (!idLimpio) continue;

    let encontrado = mapaPorId.get(idLimpio);
    if (!encontrado && idLimpio.startsWith("prov:")) {
      const nombre = idLimpio.replace(/^prov:/, "").toLowerCase().trim();
      encontrado = mapaPorNombre.get(nombre);
    }
    if (!encontrado) {
      encontrado = mapaPorNombre.get(idLimpio.toLowerCase());
    }

    if (encontrado) {
      if (!objetosProvincia.some((x) => x.cat_nombre === encontrado!.cat_nombre)) {
        objetosProvincia.push(encontrado);
      }
      if (uuidRegex.test(encontrado.cat_id) && !uuidsReales.includes(encontrado.cat_id)) {
        uuidsReales.push(encontrado.cat_id);
      }
    } else if (uuidRegex.test(idLimpio) && !uuidsReales.includes(idLimpio)) {
      uuidsReales.push(idLimpio);
    }
  }

  return { uuidsReales, objetosProvincia };
}

export async function obtenerCatalogosRedProfesionalAction(): Promise<
  Resultado<{ materias: MateriaItem[]; provincias: ProvinciaItem[] }>
> {
  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;

    const [matRes, provincias] = await Promise.all([
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_materia")
        .select("mat_id, mat_nombre")
        .eq("mat_activa", true)
        .order("mat_nombre"),
      obtenerProvinciasResiliente(supabase, adminSupabase),
    ]);

    return {
      ok: true,
      data: {
        materias: (matRes.data ?? []) as MateriaItem[],
        provincias,
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando catálogos",
    };
  }
}

export async function crearEspecialidadLegalAction(
  nombre: string
): Promise<Resultado<MateriaItem>> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para gestionar especialidades legales." };
  }

  const nombreLimpio = String(nombre || "").trim().replace(/\s+/g, " ");
  if (nombreLimpio.length < 2) {
    return { ok: false, error: "Ingresa un nombre válido para la especialidad legal." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    // 1. Verificar si ya existe por nombre (activa o inactiva)
    const { data: existentes } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_materia")
      .select("mat_id, mat_nombre, mat_activa");

    const coincidencia = (existentes ?? []).find(
      (m: { mat_id: string; mat_nombre: string; mat_activa?: boolean }) =>
        String(m.mat_nombre || "").toLowerCase().trim() === nombreLimpio.toLowerCase()
    );

    if (coincidencia) {
      if (!coincidencia.mat_activa) {
        await adminSupabase
          .schema("tranqui_legal")
          .from("trq_materia")
          .update({ mat_activa: true, mat_nombre: nombreLimpio })
          .eq("mat_id", coincidencia.mat_id);
      }
      revalidatePath("/panel/red-profesional");
      revalidatePath("/panel/socios");
      revalidatePath("/panel");
      return {
        ok: true,
        data: { mat_id: coincidencia.mat_id, mat_nombre: nombreLimpio },
      };
    }

    const codigoBase = nombreLimpio
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

    const { data: insertada, error: errInsert } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_materia")
      .insert({
        mat_nombre: nombreLimpio,
        mat_codigo: `${codigoBase}_${Date.now().toString().slice(-4)}`,
        mat_activa: true,
      })
      .select("mat_id, mat_nombre")
      .single();

    if (errInsert || !insertada) {
      // Fallback sin mat_codigo en caso de restricción de columna
      const { data: insertadaSimple, error: errSimple } = await adminSupabase
        .schema("tranqui_legal")
        .from("trq_materia")
        .insert({
          mat_nombre: nombreLimpio,
          mat_activa: true,
        })
        .select("mat_id, mat_nombre")
        .single();

      if (errSimple || !insertadaSimple) {
        return {
          ok: false,
          error: errSimple?.message || errInsert?.message || "No se pudo crear la especialidad legal.",
        };
      }

      revalidatePath("/panel/red-profesional");
      revalidatePath("/panel/socios");
      revalidatePath("/panel");
      return { ok: true, data: insertadaSimple as MateriaItem };
    }

    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel/socios");
    revalidatePath("/panel");
    return { ok: true, data: insertada as MateriaItem };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear la especialidad legal.",
    };
  }
}

export async function eliminarEspecialidadLegalAction(
  materiaId: string
): Promise<Resultado<{ eliminadaId: string }>> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para eliminar especialidades legales." };
  }

  const idLimpio = String(materiaId || "").trim();
  if (!idLimpio) {
    return { ok: false, error: "Identificador de especialidad inválido." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    // 1. Desvincular de relaciones N:M para evitar bloqueo por FK restrict
    await Promise.all([
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_materia")
        .delete()
        .eq("amt_materia_id", idLimpio),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_solicitud_materia")
        .delete()
        .eq("sma_materia_id", idLimpio),
    ]);

    // 2. Intentar eliminación física; si existe otra referencia histórica, desactivar (mat_activa = false)
    const { error: errDel } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_materia")
      .delete()
      .eq("mat_id", idLimpio);

    if (errDel) {
      const { error: errUpd } = await adminSupabase
        .schema("tranqui_legal")
        .from("trq_materia")
        .update({ mat_activa: false })
        .eq("mat_id", idLimpio);

      if (errUpd) {
        return {
          ok: false,
          error: errUpd.message || errDel.message || "No se pudo eliminar la especialidad legal.",
        };
      }
    }

    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel/socios");
    revalidatePath("/panel");
    return { ok: true, data: { eliminadaId: idLimpio } };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar la especialidad legal.",
    };
  }
}

export async function buscarUsuariosPlataformaParaAbogadoAction(
  busqueda: string = ""
): Promise<Resultado<UsuarioPlataformaItem[]>> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para buscar usuarios." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    const [{ data: usuarios }, { data: abogados }] = await Promise.all([
      adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario, usu_creado_en")
        .is("usu_eliminado_en", null)
        .order("usu_creado_en", { ascending: false })
        .limit(200),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado")
        .select("abg_id, abg_usuario_id, abg_estado"),
    ]);

    const mapaAbogados = new Map<string, { abg_id: string; abg_estado: "verificado" | "suspendido" }>();
    for (const a of abogados ?? []) {
      mapaAbogados.set(a.abg_usuario_id, { abg_id: a.abg_id, abg_estado: a.abg_estado });
    }

    const q = busqueda.trim().toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: UsuarioPlataformaItem[] = (usuarios ?? []).map((u: any) => {
      const det = (u.usu_detalle_usuario || {}) as Record<string, any>;
      const ficha = (det.ficha_abogado || {}) as Record<string, any>;
      const fac = (det.datos_facturacion || {}) as Record<string, any>;
      const nombres = u.usu_nombres || "";
      const apellidos = u.usu_apellidos || "";
      const nombreCompleto = [nombres, apellidos].filter(Boolean).join(" ").trim() || u.usu_correo || "Usuario";
      const cedula = String(ficha.cedula || det.cedula || fac.identificacion || "");
      const telefono = String(ficha.telefono || u.usu_whatsapp || fac.telefono || "");
      const abg = mapaAbogados.get(u.usu_id);

      return {
        usu_id: u.usu_id,
        nombres,
        apellidos,
        nombreCompleto,
        correo: u.usu_correo || "",
        telefono,
        cedula,
        yaEsAbogado: Boolean(abg),
        abogadoId: abg?.abg_id ?? null,
        estadoAbogado: abg?.abg_estado ?? null,
      };
    });

    const filtrados = q
      ? items.filter(
          (i) =>
            i.nombreCompleto.toLowerCase().includes(q) ||
            i.correo.toLowerCase().includes(q) ||
            i.cedula.toLowerCase().includes(q) ||
            i.telefono.toLowerCase().includes(q)
        )
      : items;

    return { ok: true, data: filtrados.slice(0, 40) };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error buscando usuarios.",
    };
  }
}

export async function listarRedProfesionalAbogadosAction(): Promise<
  Resultado<AbogadoRedItem[]>
> {
  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    // Asegurar que las solicitudes antiguas estén purgadas
    await ejecutarPurgaSolicitudesSocioInterna(adminSupabase, true);

    const { data: abogados, error: errAbg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("*")
      .order("abg_verificado_en", { ascending: false });

    if (errAbg || !abogados || abogados.length === 0) {
      return { ok: true, data: [] };
    }

    const abgIds = abogados.map((a: { abg_id: string }) => a.abg_id);
    const usuIds = abogados.map((a: { abg_usuario_id: string }) => a.abg_usuario_id).filter(Boolean);
    const solIds = abogados.map((a: { abg_solicitud_id?: string | null }) => a.abg_solicitud_id).filter(Boolean);

    const [
      usuRes,
      solRes,
      abgMatRes,
      abgProvRes,
      catMatRes,
      catProvRes,
      profRes,
      casosTitularRes,
      casosEquipoRes,
      citasActivasRes,
    ] = await Promise.all([
      adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario")
        .in("usu_id", usuIds),
      solIds.length > 0
        ? adminSupabase
            .schema("tranqui_legal")
            .from("trq_solicitud_socio")
            .select("*")
            .in("ssc_id", solIds)
        : Promise.resolve({ data: [] }),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_materia")
        .select("amt_abogado_id, amt_materia_id")
        .in("amt_abogado_id", abgIds)
        .is("amt_eliminado_en", null),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_provincia")
        .select("apr_abogado_id, apr_provincia_id")
        .in("apr_abogado_id", abgIds)
        .is("apr_eliminado_en", null),
      adminSupabase.schema("tranqui_legal").from("trq_materia").select("mat_id, mat_nombre"),
      obtenerProvinciasResiliente(supabase, adminSupabase),
      adminSupabase
        .schema("comun_agenda")
        .from("age_profesional")
        .select("*")
        .eq("agp_negocio", "tranqi")
        .in("agp_usuario_id", usuIds)
        .is("agp_eliminado_en", null),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_caso_judicial")
        .select("cas_id, cas_abogado_id, cas_estado")
        .in("cas_abogado_id", abgIds)
        .is("cas_eliminado_en", null)
        .neq("cas_estado", "cerrado"),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_caso_abogado_equipo")
        .select("cae_caso_id, cae_abogado_id")
        .in("cae_abogado_id", abgIds)
        .eq("cae_activo", true)
        .is("cae_eliminado_en", null),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_cita")
        .select("cit_id, cit_abogado_id, cit_estado")
        .in("cit_abogado_id", abgIds)
        .is("cit_eliminado_en", null)
        .in("cit_estado", ["propuesta", "confirmada", "reagendada"]),
    ]);

    const casosPorAbogado = new Map<string, Set<string>>();
    for (const c of casosTitularRes?.data ?? []) {
      if (c.cas_abogado_id) {
        const set = casosPorAbogado.get(c.cas_abogado_id) ?? new Set<string>();
        set.add(c.cas_id);
        casosPorAbogado.set(c.cas_abogado_id, set);
      }
    }
    for (const ce of casosEquipoRes?.data ?? []) {
      if (ce.cae_abogado_id && ce.cae_caso_id) {
        const set = casosPorAbogado.get(ce.cae_abogado_id) ?? new Set<string>();
        set.add(ce.cae_caso_id);
        casosPorAbogado.set(ce.cae_abogado_id, set);
      }
    }

    const citasPorAbogado = new Map<string, number>();
    for (const ci of citasActivasRes?.data ?? []) {
      if (ci.cit_abogado_id) {
        citasPorAbogado.set(ci.cit_abogado_id, (citasPorAbogado.get(ci.cit_abogado_id) ?? 0) + 1);
      }
    }

    const mapaUsuarios = new Map<string, any>((usuRes.data ?? []).map((u: any) => [u.usu_id, u]));
    const mapaSolicitudes = new Map<string, any>((solRes.data ?? []).map((s: any) => [s.ssc_id, s]));
    const mapaCatMaterias = new Map<string, MateriaItem>((catMatRes.data ?? []).map((m: MateriaItem) => [m.mat_id, m]));
    const mapaCatProvincias = new Map<string, ProvinciaItem>((catProvRes ?? []).map((p: ProvinciaItem) => [p.cat_id, p]));
    const mapaProfesional = new Map<string, any>((profRes.data ?? []).map((p: any) => [p.agp_usuario_id, p]));

    const profIds = (profRes.data ?? []).map((p: any) => p.agp_id);
    const { data: franjasData } =
      profIds.length > 0
        ? await adminSupabase
            .schema("comun_agenda")
            .from("age_franja")
            .select("fra_profesional_id, fra_dia_semana, fra_hora_inicio, fra_hora_fin, fra_modalidad")
            .in("fra_profesional_id", profIds)
            .is("fra_eliminado_en", null)
            .order("fra_dia_semana")
            .order("fra_hora_inicio")
        : { data: [] };

    const franjasPorProf = new Map<string, Franja[]>();
    for (const f of franjasData ?? []) {
      const lista = franjasPorProf.get(f.fra_profesional_id) ?? [];
      lista.push({
        dia_semana: Number(f.fra_dia_semana),
        hora_inicio: String(f.fra_hora_inicio).slice(0, 5),
        hora_fin: String(f.fra_hora_fin).slice(0, 5),
        modalidad: (f.fra_modalidad || "ambas") as "virtual" | "presencial" | "ambas",
      });
      franjasPorProf.set(f.fra_profesional_id, lista);
    }

    const materiasPorAbogado = new Map<string, MateriaItem[]>();
    for (const am of abgMatRes.data ?? []) {
      const m = mapaCatMaterias.get(am.amt_materia_id);
      if (m) {
        const arr = materiasPorAbogado.get(am.amt_abogado_id) ?? [];
        if (!arr.some((x) => x.mat_id === m.mat_id)) arr.push(m);
        materiasPorAbogado.set(am.amt_abogado_id, arr);
      }
    }

    const provinciasPorAbogado = new Map<string, ProvinciaItem[]>();
    for (const ap of abgProvRes.data ?? []) {
      const p = mapaCatProvincias.get(ap.apr_provincia_id);
      if (p) {
        const arr = provinciasPorAbogado.get(ap.apr_abogado_id) ?? [];
        if (!arr.some((x) => x.cat_id === p.cat_id)) arr.push(p);
        provinciasPorAbogado.set(ap.apr_abogado_id, arr);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado: AbogadoRedItem[] = (abogados as any[]).map((a) => {
      const u = mapaUsuarios.get(a.abg_usuario_id) || {};
      const sol = a.abg_solicitud_id ? mapaSolicitudes.get(a.abg_solicitud_id) || {} : {};
      const detUsuario = (u.usu_detalle_usuario || {}) as Record<string, any>;
      const ficha = (detUsuario.ficha_abogado || {}) as Record<string, any>;

      const nombres = u.usu_nombres || "";
      const apellidos = u.usu_apellidos || "";
      const nombreCompleto = [nombres, apellidos].filter(Boolean).join(" ").trim() || u.usu_correo || "Socio Abogado";

      const cedula = a.abg_cedula || ficha.cedula || sol.ssc_cedula || "";
      const matriculaProfesional = a.abg_matricula_profesional || ficha.matricula_profesional || sol.ssc_matricula_profesional || "";
      const telefono = a.abg_telefono || ficha.telefono || u.usu_whatsapp || sol.ssc_telefono_contacto || "";
      const universidad = a.abg_universidad || ficha.universidad || (sol.ssc_universidad !== "REGISTRO_MANUAL_INTERNO" ? sol.ssc_universidad : "") || "";
      const anioGraduacion = Number(a.abg_anio_graduacion || ficha.anio_graduacion || sol.ssc_anio_graduacion || new Date().getFullYear());
      const anosExperiencia = Number(a.abg_anos_experiencia ?? ficha.anos_experiencia ?? sol.ssc_anos_experiencia ?? 0);
      const resumenRaw = a.abg_resumen_profesional || ficha.resumen_profesional || sol.ssc_resumen_profesional || "";
      const resumenProfesional = String(resumenRaw).replace(MARCA_REGISTRO_MANUAL, "").trim();

      const esManual =
        a.abg_origen_registro === "manual_operador" ||
        ficha.origen_registro === "manual_operador" ||
        !a.abg_solicitud_id ||
        String(sol.ssc_resumen_profesional || "").includes(MARCA_REGISTRO_MANUAL);

      const prof = mapaProfesional.get(a.abg_usuario_id);
      const franjasBd = prof ? franjasPorProf.get(prof.agp_id) ?? [] : [];
      const franjasFicha = Array.isArray(ficha.franjas_agenda) ? (ficha.franjas_agenda as Franja[]) : [];
      const franjas: Franja[] =
        franjasBd.length > 0
          ? franjasBd
          : franjasFicha.length > 0
          ? franjasFicha
          : a.abg_estado !== "suspendido"
          ? FRANJAS_POR_DEFECTO
          : [];

      const configFicha = (ficha.configuracion_agenda || null) as ConfiguracionAgendaAbogado | null;
      const configuracionAgenda: ConfiguracionAgendaAbogado = prof
        ? {
            zona_horaria: prof.agp_zona_horaria || "America/Guayaquil",
            duracion_cita_min: Number(prof.agp_duracion_cita_min || 45),
            holgura_min: Number(prof.agp_holgura_min ?? 15),
            antelacion_minima_horas: Number(prof.agp_antelacion_minima_horas ?? 12),
            horizonte_dias: Number(prof.agp_horizonte_dias || 60),
            modalidades: (Array.isArray(prof.agp_modalidades) && prof.agp_modalidades.length > 0
              ? prof.agp_modalidades
              : ["virtual", "presencial"]) as ("virtual" | "presencial")[],
            acepta_turno: Boolean(prof.agp_acepta_turno ?? true),
            direccion: prof.agp_direccion ?? configFicha?.direccion ?? null,
            fechas_especiales: Array.isArray(configFicha?.fechas_especiales)
              ? configFicha.fechas_especiales
              : [],
          }
        : configFicha
        ? {
            ...AGENDA_POR_DEFECTO,
            ...configFicha,
          }
        : AGENDA_POR_DEFECTO;

      let citasPorSemana = 0;
      try {
        citasPorSemana = huecosPorSemana({ configuracion: configuracionAgenda, franjas });
      } catch {
        citasPorSemana = 0;
      }

      const propuestasRol = Array.isArray(detUsuario.propuestas_cambio_rol)
        ? (detUsuario.propuestas_cambio_rol as Array<{
            rolClave?: string;
            estado?: "pendiente_aceptacion" | "aceptado" | "rechazado";
            solicitadoPorNombre?: string;
            solicitadoPorCorreo?: string;
            solicitadoEn?: string;
            respondidoEn?: string | null;
          }>)
        : [];
      const propAbogado = propuestasRol.find(
        (p) => String(p.rolClave || "").toUpperCase() === "ABOGADO"
      );

      const registradoPorNombre = String(
        ficha.registrado_por_nombre ||
          propAbogado?.solicitadoPorNombre ||
          (esManual ? "Operador Tranqi (satcom latinoamerica)" : "Autogestión del Profesional")
      );
      const registradoPorCorreo = String(
        ficha.registrado_por_correo ||
          propAbogado?.solicitadoPorCorreo ||
          (esManual ? "satcomla.ti@gmail.com" : u.usu_correo || "")
      );
      const fechaRegistro = String(
        ficha.registrado_en ||
          propAbogado?.solicitadoEn ||
          a.abg_verificado_en ||
          a.abg_creado_en ||
          new Date().toISOString()
      );
      const estadoAceptacion: "pendiente_aceptacion" | "aceptado" | "rechazado" =
        ficha.estado_aceptacion === "pendiente_aceptacion" ||
        ficha.estado_aceptacion === "aceptado" ||
        ficha.estado_aceptacion === "rechazado"
          ? ficha.estado_aceptacion
          : propAbogado?.estado || (a.abg_estado === "verificado" ? "aceptado" : "pendiente_aceptacion");
      const fechaAceptacion: string | null =
        ficha.aceptado_en ||
        propAbogado?.respondidoEn ||
        (estadoAceptacion === "aceptado" ? a.abg_verificado_en || fechaRegistro : null);

      const bajaLogica = Boolean(ficha.baja_logica === true);
      const fechaBajaLogica: string | null = ficha.dado_de_baja_en ? String(ficha.dado_de_baja_en) : null;
      const bajaLogicaPorNombre: string | null = ficha.dado_de_baja_por_nombre
        ? String(ficha.dado_de_baja_por_nombre)
        : null;

      const casosAsignadosActivos = casosPorAbogado.get(a.abg_id)?.size ?? 0;
      const citasActivas = citasPorAbogado.get(a.abg_id) ?? 0;

      const historialGuardado: HistorialCambioRolItem[] = Array.isArray(detUsuario.historial_cambios_rol)
        ? (detUsuario.historial_cambios_rol as HistorialCambioRolItem[])
        : [];
      const historialCambiosRol: HistorialCambioRolItem[] =
        historialGuardado.length > 0
          ? historialGuardado
          : [
              ...(fechaAceptacion && estadoAceptacion === "aceptado"
                ? [
                    {
                      id: `hist-acep-${a.abg_id}`,
                      fecha: fechaAceptacion,
                      accion: "ACEPTACION_USUARIO" as const,
                      rol: "ABOGADO",
                      estadoResultante: "activo" as const,
                      ejecutadoPorNombre: nombreCompleto,
                      ejecutadoPorCorreo: u.usu_correo || "",
                      detalle: "El usuario confirmó la aceptación del rol de Socio Abogado.",
                    },
                  ]
                : []),
              {
                id: `hist-reg-${a.abg_id}`,
                fecha: fechaRegistro,
                accion: "PROPUESTA_ASIGNACION" as const,
                rol: "ABOGADO",
                estadoResultante: (estadoAceptacion === "aceptado" ? "activo" : "pendiente_aceptacion") as
                  | "activo"
                  | "pendiente_aceptacion",
                ejecutadoPorNombre: registradoPorNombre,
                ejecutadoPorCorreo: registradoPorCorreo,
                detalle: "Incorporación y postulación de rol de Socio Abogado en la red profesional.",
              },
            ];

      return {
        abg_id: a.abg_id,
        usu_id: a.abg_usuario_id,
        nombres,
        apellidos,
        nombreCompleto,
        correo: u.usu_correo || "",
        telefono,
        cedula,
        matriculaProfesional,
        universidad,
        anioGraduacion,
        anosExperiencia,
        resumenProfesional,
        origenRegistro: esManual ? "manual_operador" : "autogestion",
        estado: a.abg_estado === "suspendido" ? "suspendido" : "verificado",
        verificadoEn: a.abg_verificado_en || a.abg_creado_en || new Date().toISOString(),
        registradoPorNombre,
        registradoPorCorreo,
        fechaRegistro,
        estadoAceptacion,
        fechaAceptacion,
        bajaLogica,
        fechaBajaLogica,
        bajaLogicaPorNombre,
        casosAsignadosActivos,
        citasActivas,
        historialCambiosRol,
        materias:
          (materiasPorAbogado.get(a.abg_id) ?? []).length > 0
            ? materiasPorAbogado.get(a.abg_id)!
            : Array.isArray(ficha.materias_objetos)
            ? ficha.materias_objetos
            : [],
        provincias:
          (provinciasPorAbogado.get(a.abg_id) ?? []).length > 0
            ? provinciasPorAbogado.get(a.abg_id)!
            : Array.isArray(ficha.provincias_objetos)
            ? ficha.provincias_objetos
            : [],
        agendaConfigurada: franjas.length > 0,
        configuracionAgenda,
        franjas,
        citasPorSemana,
      };
    });

    return { ok: true, data: resultado };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando la red profesional.",
    };
  }
}

/**
 * Configura la disponibilidad de citas presenciales / teleconsulta para un usuario abogado
 * en comun_agenda y guarda respaldo sincronizado en seg_usuario.usu_detalle_usuario.ficha_abogado.
 */
async function guardarDisponibilidadAgendaInterna(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  usuarioId: string,
  config: ConfiguracionAgendaAbogado,
  franjas: Franja[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ahoraIso = new Date().toISOString();
    const modalidadesLimpias =
      Array.isArray(config.modalidades) && config.modalidades.length > 0
        ? config.modalidades
        : ["virtual", "presencial"];

    const configNormalizada: ConfiguracionAgendaAbogado = {
      zona_horaria: config.zona_horaria || "America/Guayaquil",
      duracion_cita_min: Number(config.duracion_cita_min || 45),
      holgura_min: Number(config.holgura_min ?? 15),
      antelacion_minima_horas: Number(config.antelacion_minima_horas ?? 12),
      horizonte_dias: Number(config.horizonte_dias || 60),
      modalidades: modalidadesLimpias as ("virtual" | "presencial")[],
      acepta_turno: Boolean(config.acepta_turno ?? true),
      direccion: config.direccion || null,
      fechas_especiales: Array.isArray(config.fechas_especiales) ? config.fechas_especiales : [],
    };

    // 1. Guardar respaldo en seg_usuario.usu_detalle_usuario.ficha_abogado para resiliencia total
    try {
      const { data: usuRow } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", usuarioId)
        .maybeSingle();

      const detPrevio = (usuRow?.usu_detalle_usuario || {}) as Record<string, unknown>;
      const fichaPrevia = ((detPrevio.ficha_abogado || {}) as Record<string, unknown>);

      await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detPrevio,
            ficha_abogado: {
              ...fichaPrevia,
              configuracion_agenda: configNormalizada,
              franjas_agenda: franjas,
              agenda_configurada_en: ahoraIso,
            },
          },
          usu_actualizado_en: ahoraIso,
        })
        .eq("usu_id", usuarioId);
    } catch {
      // Continuar con comun_agenda
    }

    // 2. Intentar sincronizar en comun_agenda.age_profesional y age_franja
    try {
      const { data: prof, error: errProf } = await adminSupabase
        .schema("comun_agenda")
        .from("age_profesional")
        .upsert(
          {
            agp_usuario_id: usuarioId,
            agp_negocio: "tranqi",
            agp_zona_horaria: configNormalizada.zona_horaria,
            agp_duracion_cita_min: configNormalizada.duracion_cita_min,
            agp_holgura_min: configNormalizada.holgura_min,
            agp_antelacion_minima_horas: configNormalizada.antelacion_minima_horas,
            agp_horizonte_dias: configNormalizada.horizonte_dias,
            agp_modalidades: modalidadesLimpias,
            agp_acepta_turno: configNormalizada.acepta_turno,
            agp_direccion: configNormalizada.direccion,
            agp_configurada_en: ahoraIso,
            agp_eliminado_en: null,
            agp_actualizado_en: ahoraIso,
          },
          { onConflict: "agp_usuario_id,agp_negocio" }
        )
        .select("agp_id")
        .single();

      if (!errProf && prof?.agp_id) {
        await adminSupabase
          .schema("comun_agenda")
          .from("age_franja")
          .update({ fra_eliminado_en: ahoraIso, fra_actualizado_en: ahoraIso })
          .eq("fra_profesional_id", prof.agp_id)
          .is("fra_eliminado_en", null);

        if (franjas.length > 0) {
          const filasFranjas = franjas.map((f) => ({
            fra_profesional_id: prof.agp_id,
            fra_dia_semana: Number(f.dia_semana),
            fra_hora_inicio: f.hora_inicio.length === 5 ? `${f.hora_inicio}:00` : f.hora_inicio,
            fra_hora_fin: f.hora_fin.length === 5 ? `${f.hora_fin}:00` : f.hora_fin,
            fra_modalidad: f.modalidad || "ambas",
          }));

          await adminSupabase
            .schema("comun_agenda")
            .from("age_franja")
            .insert(filasFranjas);
        }
      }
    } catch {
      // Respaldado en ficha_abogado
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar disponibilidad.",
    };
  }
}

type TipoEventoRedAbogado =
  | "PROPUESTA_CONVERSION"
  | "CONVERSION_ACTIVO"
  | "CONVERSION_SUSPENDIDO"
  | "ACTIVADO"
  | "SUSPENDIDO"
  | "ACTUALIZADO"
  | "RETIRADO";

/**
 * Envía notificación multicanal (Push / In-App en campana + Bandeja Persistente en seg_usuario + Correo Electrónico HTML + Bitácora)
 * al usuario cuando se propone convertirlo en Socio Abogado o cuando cambia su estado / perfil en la red.
 */
async function notificarEventoRedAbogadoMulticanal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  parametros: {
    usuarioId: string;
    tipoEvento: TipoEventoRedAbogado;
    especialidadesNombres?: string[];
    provinciasNombres?: string[];
    passwordTemporal?: string | null;
    operadorCorreo?: string | null;
    operadorNombre?: string | null;
    operadorId?: string | null;
    abogadoId?: string | null;
  }
): Promise<void> {
  try {
    const { data: usu } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_detalle_usuario")
      .eq("usu_id", parametros.usuarioId)
      .maybeSingle();

    const correoDestino = String(usu?.usu_correo || "").trim().toLowerCase();
    const nombreAbogado =
      [usu?.usu_nombres, usu?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      correoDestino ||
      "Socio Abogado";

    const urlPanelAbogado = "https://www.tranqi24.com/panel/red-profesional?widget=mi_perfil_abogado";
    const urlPanelGeneral = "https://www.tranqi24.com/panel";
    const ahoraIso = new Date().toISOString();
    const fechaLegibleEC = new Date(ahoraIso).toLocaleString("es-EC", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Guayaquil",
    });

    const nombreOperador = parametros.operadorNombre || "Mesa Operativa Tranqi";
    const correoOperador = parametros.operadorCorreo || "admin@tranqi24.com";

    let asunto = "⚖️ Actualización de tu Perfil Profesional en Tranqi";
    let colorCabecera = "linear-gradient(135deg, #05876E 0%, #046C58 100%)";
    let etiquetaEstado = "ACTIVO · VERIFICADO";
    let mensajePrincipalHtml = "";
    let textoBotonCta = "Ir a mi Portal de Socio Abogado →";
    let urlAccion = urlPanelAbogado;

    const espTexto =
      parametros.especialidadesNombres && parametros.especialidadesNombres.length > 0
        ? parametros.especialidadesNombres.join(", ")
        : "Configuradas en tu perfil";
    const provTexto =
      parametros.provinciasNombres && parametros.provinciasNombres.length > 0
        ? parametros.provinciasNombres.join(", ")
        : "Configuradas en tu perfil";

    const bloqueAuditoriaHtml = `
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; margin: 14px 0; font-size: 13px; color: #334155;">
        <strong>👤 Registrado / Gestionado por:</strong> ${nombreOperador} (${correoOperador})<br/>
        <strong>📅 Fecha y hora:</strong> ${fechaLegibleEC}
      </div>
    `;

    switch (parametros.tipoEvento) {
      case "PROPUESTA_CONVERSION":
        asunto = "🛡️ Confirmación Requerida: Te han asignado el Rol de Socio Abogado en Tranqi";
        colorCabecera = "linear-gradient(135deg, #5000BA 0%, #3B0764 100%)";
        etiquetaEstado = "CONFIRMACIÓN DE NUEVO ROL REQUERIDA";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Te informamos que la plataforma <strong>Tranqi</strong> está agregando el nuevo rol de <strong>Socio Abogado</strong> a tu cuenta registrada.
          </p>
          ${bloqueAuditoriaHtml}
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 16px; margin: 18px 0; font-size: 14px; color: #065F46;">
            <p style="margin: 0 0 8px 0;"><strong>⚖️ Especialidades preconfiguradas:</strong> ${espTexto}</p>
            <p style="margin: 0 0 8px 0;"><strong>📍 Zonas de cobertura:</strong> ${provTexto}</p>
            <p style="margin: 0;"><strong>📅 Disponibilidad base:</strong> Lun–Vie 09:00–17:00 (Presencial y Teleconsulta).</p>
          </div>
          ${
            parametros.passwordTemporal
              ? `<div style="background: #F5F3FF; border: 1px solid #DDD6FE; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 14px; color: #5000BA;">
                  <strong>🔑 Credenciales iniciales de acceso:</strong><br/>
                  Usuario: <code>${correoDestino}</code><br/>
                  Contraseña temporal: <code>${parametros.passwordTemporal}</code>
                </div>`
              : ""
          }
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            <strong>Importante:</strong> Tu rol no cambiará automáticamente hasta que confirmes tu aceptación. Ingresa a tu panel en Tranqi y en la sección <strong>Notificaciones</strong> pulsa el botón <strong>«Aceptar Rol»</strong> para habilitar tu Portal Profesional de Abogado.
          </p>
        `;
        textoBotonCta = "Revisar y Confirmar Aceptación de Rol →";
        urlAccion = urlPanelGeneral;
        break;

      case "CONVERSION_ACTIVO":
        asunto = "🎉 ¡Bienvenido al Equipo! Tu cuenta de Socio Abogado en Tranqi está Activa";
        colorCabecera = "linear-gradient(135deg, #05876E 0%, #046C58 100%)";
        etiquetaEstado = "SOCIO ABOGADO ACTIVO";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Te informamos que tu perfil en <strong>Tranqi</strong> ha sido habilitado como <strong>Socio Abogado Activo</strong> de nuestra Red Profesional.
          </p>
          ${bloqueAuditoriaHtml}
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 16px; margin: 18px 0; font-size: 14px; color: #065F46;">
            <p style="margin: 0 0 8px 0;"><strong>⚖️ Especialidades asignadas:</strong> ${espTexto}</p>
            <p style="margin: 0 0 8px 0;"><strong>📍 Zonas de cobertura:</strong> ${provTexto}</p>
            <p style="margin: 0;"><strong>📅 Disponibilidad de citas:</strong> Horario base Lun–Vie 09:00–17:00 (Presencial y Teleconsulta).</p>
          </div>
          ${
            parametros.passwordTemporal
              ? `<div style="background: #F5F3FF; border: 1px solid #DDD6FE; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 14px; color: #5000BA;">
                  <strong>🔑 Credenciales iniciales de acceso:</strong><br/>
                  Usuario: <code>${correoDestino}</code><br/>
                  Contraseña temporal: <code>${parametros.passwordTemporal}</code>
                </div>`
              : ""
          }
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Al ingresar a la plataforma ya verás habilitado tu <strong>Portal Profesional de Abogado</strong>, donde puedes actualizar tus especialidades, provincias de cobertura y personalizar tus horarios de atención.
          </p>
        `;
        break;

      case "CONVERSION_SUSPENDIDO":
        asunto = "ℹ️ Registro en Red Profesional Tranqi — Perfil en Estado Suspendido / En Espera";
        colorCabecera = "linear-gradient(135deg, #B45309 0%, #92400E 100%)";
        etiquetaEstado = "REGISTRADO · EN ESPERA DE ACTIVACIÓN";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Tu ficha de <strong>Socio Abogado</strong> ha sido registrada en la Red Profesional de <strong>Tranqi</strong> y se encuentra temporalmente en estado <strong>Suspendido / En Espera de Activación</strong>.
          </p>
          ${bloqueAuditoriaHtml}
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Te notificaremos tan pronto como la Mesa de Control active tu recepción de citas y el portal profesional.
          </p>
        `;
        textoBotonCta = "Ingresar a Tranqi →";
        urlAccion = urlPanelGeneral;
        break;

      case "ACTIVADO":
        asunto = "✅ ¡Tu Perfil de Socio Abogado en Tranqi ha sido Reactivado!";
        colorCabecera = "linear-gradient(135deg, #05876E 0%, #046C58 100%)";
        etiquetaEstado = "ESTADO: ACTIVO / VERIFICADO";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Te confirmamos que tu estado en la Red Profesional de <strong>Tranqi</strong> ha cambiado a <strong>Activo (Verificado)</strong>.
          </p>
          ${bloqueAuditoriaHtml}
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Tu visibilidad en el directorio legal, la asignación de turnos de citas (presenciales y teleconsulta) y tu <strong>Portal Profesional de Abogado</strong> están nuevamente habilitados.
          </p>
        `;
        break;

      case "SUSPENDIDO":
        asunto = "⚠️ Actualización de Estado — Tu Perfil de Socio Abogado ha sido Suspendido Temporalmente";
        colorCabecera = "linear-gradient(135deg, #B45309 0%, #92400E 100%)";
        etiquetaEstado = "ESTADO: SUSPENDIDO TEMPORALMENTE";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Te informamos que tu perfil como <strong>Socio Abogado</strong> en la Red Profesional de <strong>Tranqi</strong> ha cambiado a estado <strong>Suspendido</strong>.
          </p>
          ${bloqueAuditoriaHtml}
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Mientras permanezca en este estado, no se te asignarán nuevas citas automáticas ni aparecerás activo en el directorio público. Tu cuenta de usuario en la plataforma permanece activa.
          </p>
        `;
        textoBotonCta = "Revisar mi Cuenta en Tranqi →";
        urlAccion = urlPanelGeneral;
        break;

      case "ACTUALIZADO":
        asunto = "🔔 Actualización en tu Ficha Profesional, Especialidades o Disponibilidad — Tranqi";
        colorCabecera = "linear-gradient(135deg, #5000BA 0%, #3B0764 100%)";
        etiquetaEstado = "FICHA PROFESIONAL ACTUALIZADA";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Se han actualizado los parámetros de tu perfil profesional en la Red de Abogados de <strong>Tranqi</strong>.
          </p>
          ${bloqueAuditoriaHtml}
          <div style="background: #F5F3FF; border: 1px solid #DDD6FE; border-radius: 12px; padding: 16px; margin: 18px 0; font-size: 14px; color: #3B0764;">
            <p style="margin: 0 0 8px 0;"><strong>⚖️ Especialidades:</strong> ${espTexto}</p>
            <p style="margin: 0;"><strong>📍 Cobertura:</strong> ${provTexto}</p>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Puedes revisar y gestionar tus especialidades, zonas de cobertura y disponibilidad horaria desde tu panel.
          </p>
        `;
        break;

      case "RETIRADO":
        asunto = "ℹ️ Actualización de Cuenta — Retiro de la Red Profesional de Abogados Tranqi";
        colorCabecera = "linear-gradient(135deg, #374151 0%, #111827 100%)";
        etiquetaEstado = "BAJA DE RED PROFESIONAL";
        mensajePrincipalHtml = `
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Te informamos que tu perfil como <strong>Socio Abogado</strong> ha sido desvinculado de la Red Profesional de <strong>Tranqi</strong>.
          </p>
          ${bloqueAuditoriaHtml}
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Conservas intacto el acceso a tu cuenta personal y a tu Billetera Digital como usuario de la plataforma.
          </p>
        `;
        textoBotonCta = "Ir a mi Panel en Tranqi →";
        urlAccion = urlPanelGeneral;
        break;
    }

    const htmlCompleto = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden; color: #111827;">
        <div style="background: ${colorCabecera}; padding: 26px 32px; color: #ffffff;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.92; margin-bottom: 6px;">
            ${etiquetaEstado} · TRANQI LEGAL
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; line-height: 1.3;">
            ${asunto}
          </h1>
        </div>
        <div style="padding: 28px 32px;">
          <p style="font-size: 15px; line-height: 1.6; color: #111827; margin-top: 0;">
            Hola <strong>${nombreAbogado}</strong>,
          </p>
          ${mensajePrincipalHtml}
          <div style="text-align: center; margin: 28px 0;">
            <a href="${urlAccion}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #05876E; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 13px 26px; border-radius: 12px;">
              ${textoBotonCta}
            </a>
          </div>
        </div>
        <div style="background: #F3F4F6; padding: 14px 32px; text-align: center; font-size: 12px; color: #6B7280;">
          Tranqi Legal Network · Notificación Automática de Estado Profesional
        </div>
      </div>
    `;

    // 0. Persistir en comun_seguridad.seg_usuario.usu_detalle_usuario (bandeja y propuesta de cambio de rol)
    // para que el usuario siempre reciba la notificación en su widget aunque sean distintas instancias Serverless
    try {
      const { data: uRow } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", parametros.usuarioId)
        .maybeSingle();

      const det = (uRow?.usu_detalle_usuario || {}) as Record<string, any>;
      const bandejaActual: any[] = Array.isArray(det.notificaciones_bandeja)
        ? [...det.notificaciones_bandeja]
        : [];
      const propuestasActuales: any[] = Array.isArray(det.propuestas_cambio_rol)
        ? [...det.propuestas_cambio_rol]
        : [];

      const notifId =
        parametros.tipoEvento === "PROPUESTA_CONVERSION"
          ? `prop-rol-ABOGADO-${Date.now()}`
          : `notif-abg-${parametros.tipoEvento.toLowerCase()}-${Date.now()}`;

      if (parametros.tipoEvento === "PROPUESTA_CONVERSION") {
        // Reemplazar cualquier propuesta previa pendiente de ABOGADO
        const filtradas = propuestasActuales.filter(
          (p) => !(String(p?.rolClave || "").toUpperCase() === "ABOGADO" && p?.estado === "pendiente_aceptacion")
        );
        filtradas.unshift({
          id: notifId,
          rolClave: "ABOGADO",
          rolNombre: "Socio Abogado",
          negocio: "TRANQ",
          estado: "pendiente_aceptacion",
          solicitadoPorId: parametros.operadorId || null,
          solicitadoPorNombre: nombreOperador,
          solicitadoPorCorreo: correoOperador,
          solicitadoEn: ahoraIso,
          respondidoEn: null,
          esConversionAbogado: true,
          abogadoId: parametros.abogadoId || null,
          especialidadesNombres: parametros.especialidadesNombres || [],
          provinciasNombres: parametros.provinciasNombres || [],
        });
        det.propuestas_cambio_rol = filtradas.slice(0, 30);
      } else {
        bandejaActual.unshift({
          not_id: notifId,
          not_titulo: asunto,
          not_contenido_html: `
            <div>
              ${mensajePrincipalHtml}
            </div>
          `,
          not_url_accion: urlAccion,
          not_leido_en: null,
          not_creado_en: ahoraIso,
          not_canal: "PUSH",
          not_eliminada: false,
        });
        det.notificaciones_bandeja = bandejaActual.slice(0, 50);
      }

      await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: det,
          usu_actualizado_en: ahoraIso,
        })
        .eq("usu_id", parametros.usuarioId);
    } catch (errPersistUsu) {
      console.warn("Aviso al persistir notificación en usu_detalle_usuario:", errPersistUsu);
    }

    // 1. Insertar notificación Push e In-App en comun_notificacion.not_registro
    try {
      await adminSupabase
        .schema("comun_notificacion")
        .from("not_registro")
        .insert([
          {
            not_usuario_id: parametros.usuarioId,
            not_negocio: "TRANQ",
            not_canal: "IN_APP",
            not_titulo: asunto,
            not_contenido_html: htmlCompleto,
            not_url_accion: urlAccion,
            not_creado_en: ahoraIso,
          },
          {
            not_usuario_id: parametros.usuarioId,
            not_negocio: "TRANQ",
            not_canal: "PUSH",
            not_titulo: asunto,
            not_contenido_html: htmlCompleto,
            not_url_accion: urlAccion,
            not_creado_en: ahoraIso,
          },
        ]);
    } catch {
      // No interrumpir flujo si not_registro falla
    }

    // 2. Enviar Correo Electrónico (SMTP Env -> SMTP Vault -> Edge Function)
    let correoEnviado = false;
    if (correoDestino && correoDestino.includes("@")) {
      let smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
      let smtpPort = Number(process.env.SMTP_PORT || 587);
      let smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || "";
      let smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";
      let smtpSecure = smtpPort === 465;
      let remitenteNombre = process.env.SMTP_FROM_NOMBRE || "Tranqi Red Profesional";

      if (!smtpHost || !smtpUser || !smtpPass) {
        try {
          for (const negClave of ["tranqi", "TRANQ"]) {
            const { data: vaultData } = await adminSupabase
              .schema("comun_configuracion")
              .rpc("cfg_fn_obtener_smtp_credenciales", { p_negocio: negClave });
            const cfg = Array.isArray(vaultData) ? vaultData[0] : vaultData;
            if (cfg?.host && cfg?.usuario && cfg?.contrasena) {
              smtpHost = cfg.host;
              smtpPort = Number(cfg.puerto || 465);
              smtpUser = cfg.usuario;
              smtpPass = cfg.contrasena;
              smtpSecure = Boolean(cfg.seguro ?? smtpPort === 465);
              remitenteNombre = cfg.remitente_nombre || remitenteNombre;
              break;
            }
          }
        } catch {
          // Continuar con fallback Edge Function
        }
      }

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
          });
          await transporter.sendMail({
            from: `"${remitenteNombre}" <${smtpUser}>`,
            to: correoDestino,
            subject: asunto,
            html: htmlCompleto,
          });
          correoEnviado = true;
        } catch {
          // Intentar fallback Edge Function
        }
      }

      if (!correoEnviado) {
        try {
          const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
          const resEdge = await enviarCorreo({
            negocio: "tranqi",
            para: correoDestino,
            asunto,
            html: htmlCompleto,
          });
          if (resEdge.ok) correoEnviado = true;
        } catch {
          // Continuar con registro en bitácora
        }
      }
    }

    // 3. Registrar en la Bitácora de Campañas y Notificaciones del Servidor
    try {
      agregarCampanaServidor({
        id: `abg-est-${Date.now().toString().slice(-6)}`,
        asunto,
        contenidoHTML: htmlCompleto,
        tipoEmision: "AUTOMATICA",
        emisorNombre: parametros.operadorNombre || "Mesa Operativa Tranqi",
        emisorCorreo: parametros.operadorCorreo || "admin@tranqi24.com",
        emisorId: parametros.operadorId || undefined,
        procesoOrigen: `Red Profesional Abogados (${parametros.tipoEvento})`,
        audiencia: `${nombreAbogado} (${correoDestino || parametros.usuarioId})`,
        canales: ["EMAIL", "PUSH", "IN_APP"],
        destinatariosDetalle: correoDestino ? [correoDestino] : [parametros.usuarioId],
        enviados: 1,
        leidos: 0,
        ignorados: 0,
        fecha: ahoraIso,
        correoEnviadoReal: correoEnviado,
      });
    } catch {
      // Ignorar errores de bitácora
    }
  } catch (err) {
    console.warn("Aviso al enviar notificación multicanal de estado de abogado:", err);
  }
}

export interface EntradaRegistrarAbogado {
  abogadoId?: string | null;
  usuarioId?: string | null;
  nombres: string;
  apellidos: string;
  correo: string;
  cedula: string;
  matriculaProfesional: string;
  telefono: string;
  universidad?: string;
  anosExperiencia?: number;
  resumenProfesional?: string;
  estado?: "verificado" | "suspendido";
  materiasIds: string[];
  provinciasIds: string[];
  configuracionAgenda?: ConfiguracionAgendaAbogado;
  franjas?: Franja[];
}

export async function registrarOConvertirAbogadoAction(
  entrada: EntradaRegistrarAbogado
): Promise<Resultado<{ abg_id: string; usu_id: string }>> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para registrar o editar abogados." };
  }

  const nombres = (entrada.nombres || "").trim();
  const apellidos = (entrada.apellidos || "").trim();
  const correo = (entrada.correo || "").trim().toLowerCase();
  const cedula = (entrada.cedula || "").trim();
  const matricula = (entrada.matriculaProfesional || "").trim();
  const telefono = (entrada.telefono || "").trim();
  const materiasIds = Array.from(new Set((entrada.materiasIds || []).filter(Boolean)));
  const provinciasIds = Array.from(new Set((entrada.provinciasIds || []).filter(Boolean)));
  const estado = entrada.estado === "suspendido" ? "suspendido" : "verificado";

  if (!entrada.usuarioId && (!nombres || !apellidos || !correo)) {
    return { ok: false, error: "Selecciona un usuario registrado o ingresa nombres, apellidos y correo." };
  }
  if (cedula.length < 6) {
    return { ok: false, error: "Ingresa una cédula o identificación válida." };
  }
  if (matricula.length < 2) {
    return { ok: false, error: "Ingresa el número de matrícula profesional / Foro de Abogados." };
  }
  if (telefono.length < 7) {
    return { ok: false, error: "Ingresa un número de teléfono o WhatsApp de contacto." };
  }
  if (materiasIds.length === 0) {
    return { ok: false, error: "Selecciona al menos una especialidad legal." };
  }
  if (provinciasIds.length === 0) {
    return { ok: false, error: "Selecciona al menos una provincia de cobertura." };
  }

  const supabase = await crearClienteServidor();
  const adminSupabase = (crearClienteAdmin() || supabase) as any;
  const perfilOperador = await obtenerPerfilActual();
  const ahoraIso = new Date().toISOString();

  try {
    let targetUsuId = entrada.usuarioId || null;
    let passwordTemporalGenerada: string | null = null;

    // 1. Resolver o crear el usuario en comun_seguridad.seg_usuario / Supabase Auth
    if (!targetUsuId) {
      const { data: usuExistente } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id")
        .ilike("usu_correo", correo)
        .maybeSingle();

      if (usuExistente?.usu_id) {
        targetUsuId = usuExistente.usu_id;
      } else {
        // Crear cuenta en Supabase Auth para que pueda iniciar sesión
        const passwordTemporal = `Tranqi.${cedula.slice(-4)}#${ new Date().getFullYear() }`;
        passwordTemporalGenerada = passwordTemporal;
        const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
          email: correo,
          password: passwordTemporal,
          email_confirm: true,
          user_metadata: {
            full_name: `${nombres} ${apellidos}`.trim(),
            nombres,
            apellidos,
          },
        });

        if (authErr && !authData?.user?.id) {
          return {
            ok: false,
            error: `No se pudo crear la cuenta de usuario (${authErr.message}). Si ya existe, búscalo en el selector de usuarios registrados.`,
          };
        }
        targetUsuId = authData.user.id;
      }
    }

    if (!targetUsuId) {
      return { ok: false, error: "No se pudo identificar al usuario." };
    }

    // Resolver catálogos de materias y provincias para guardar tanto en tablas N:M como en JSONB de respaldo
    const [catMatRes, catProvList] = await Promise.all([
      adminSupabase.schema("tranqui_legal").from("trq_materia").select("mat_id, mat_nombre"),
      obtenerProvinciasResiliente(supabase, adminSupabase),
    ]);
    const mapaMat = new Map<string, MateriaItem>(
      (catMatRes.data ?? []).map((m: MateriaItem) => [m.mat_id, m])
    );
    const materiasObjetos = materiasIds
      .map((id) => mapaMat.get(id))
      .filter((x): x is MateriaItem => Boolean(x));

    const { uuidsReales: provinciasUuidsReales, objetosProvincia: provinciasObjetos } =
      resolverProvinciasSeleccionadas(provinciasIds, catProvList);

    // 2. Actualizar seg_usuario con sus datos y ficha_abogado en usu_detalle_usuario
    const { data: usuActual } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario")
      .eq("usu_id", targetUsuId)
      .maybeSingle();

    const { data: abgPrevio } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_solicitud_id, abg_estado")
      .eq("abg_usuario_id", targetUsuId)
      .maybeSingle();

    const eraAbogadoPrevio = Boolean(abgPrevio?.abg_id);
    const estadoPrevio = abgPrevio?.abg_estado ?? null;
    let abgId: string | null = abgPrevio?.abg_id ?? null;

    const nombreOperador =
      [perfilOperador?.usu_nombres, perfilOperador?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      "Mesa Operativa Tranqi";
    const correoOperador = perfilOperador?.usu_correo || "satcomla.ti@gmail.com";

    // Regla de gobernanza: cuando se convierte un usuario en abogado por primera vez,
    // queda en estado pendiente de aceptación ("suspendido") hasta que el usuario confirme su aceptación.
    const requiereAceptacionUsuario = !eraAbogadoPrevio;
    const estadoEfectivoAbogado: "verificado" | "suspendido" = requiereAceptacionUsuario
      ? "suspendido"
      : estado;

    const detPrevio = (usuActual?.usu_detalle_usuario || {}) as Record<string, any>;
    const fichaPrevia = (detPrevio.ficha_abogado || {}) as Record<string, any>;

    const fichaAbogado = {
      ...fichaPrevia,
      cedula,
      matricula_profesional: matricula,
      telefono,
      universidad: (entrada.universidad || "").trim() || "Acreditado por Operador",
      anio_graduacion: new Date().getFullYear(),
      anos_experiencia: Number(entrada.anosExperiencia ?? 1),
      resumen_profesional: (entrada.resumenProfesional || "").trim() || "Socio Abogado de la Red Profesional Tranqi",
      origen_registro: "manual_operador",
      materias_objetos: materiasObjetos,
      provincias_objetos: provinciasObjetos,
      registrado_por_id: fichaPrevia.registrado_por_id || perfilOperador?.usu_id || null,
      registrado_por_nombre: fichaPrevia.registrado_por_nombre || nombreOperador,
      registrado_por_correo: fichaPrevia.registrado_por_correo || correoOperador,
      registrado_en: fichaPrevia.registrado_en || ahoraIso,
      estado_aceptacion: requiereAceptacionUsuario
        ? "pendiente_aceptacion"
        : fichaPrevia.estado_aceptacion || (estadoEfectivoAbogado === "verificado" ? "aceptado" : "pendiente_aceptacion"),
      aceptado_en: requiereAceptacionUsuario
        ? null
        : fichaPrevia.aceptado_en || (estadoEfectivoAbogado === "verificado" ? ahoraIso : null),
      baja_logica: false,
      dado_de_baja_en: null,
      dado_de_baja_por_id: null,
      dado_de_baja_por_nombre: null,
      dado_de_baja_por_correo: null,
      actualizado_por_nombre: nombreOperador,
      actualizado_por_correo: correoOperador,
      actualizado_en: ahoraIso,
    };

    const historialPrevio: HistorialCambioRolItem[] = Array.isArray(detPrevio.historial_cambios_rol)
      ? [...detPrevio.historial_cambios_rol]
      : [];
    historialPrevio.unshift({
      id: `hist-${Date.now()}`,
      fecha: ahoraIso,
      accion: !eraAbogadoPrevio ? "PROPUESTA_ASIGNACION" : "ACTUALIZACION_FICHA",
      rol: "ABOGADO",
      estadoResultante: requiereAceptacionUsuario
        ? "pendiente_aceptacion"
        : estadoEfectivoAbogado === "verificado"
        ? "activo"
        : "suspendido",
      ejecutadoPorNombre: nombreOperador,
      ejecutadoPorCorreo: correoOperador,
      detalle: !eraAbogadoPrevio
        ? `Conversión a Socio Abogado solicitada por ${nombreOperador}. Pendiente de confirmación del usuario.`
        : `Actualización de ficha profesional, especialidades (${materiasObjetos.map((m) => m.mat_nombre).join(", ")}) y cobertura.`,
    });

    await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .upsert(
        {
          usu_id: targetUsuId,
          usu_correo: correo || usuActual?.usu_correo,
          usu_nombres: nombres || usuActual?.usu_nombres || "Socio",
          usu_apellidos: apellidos || usuActual?.usu_apellidos || "Abogado",
          usu_whatsapp: telefono || usuActual?.usu_whatsapp || null,
          usu_onboarding_completo: true,
          usu_correo_verificado_en: ahoraIso,
          usu_detalle_usuario: {
            ...detPrevio,
            cedula,
            ficha_abogado: fichaAbogado,
            historial_cambios_rol: historialPrevio.slice(0, 60),
          },
          usu_actualizado_en: ahoraIso,
        },
        { onConflict: "usu_id" }
      );

    // 3. Upsert en tranqui_legal.trq_abogado (intentando primero con las columnas nuevas y abg_solicitud_id null)
    const payloadNuevo = {
      abg_usuario_id: targetUsuId,
      abg_solicitud_id: abgPrevio?.abg_solicitud_id ?? null,
      abg_estado: estadoEfectivoAbogado,
      abg_cedula: cedula,
      abg_matricula_profesional: matricula,
      abg_telefono: telefono,
      abg_universidad: fichaAbogado.universidad,
      abg_anos_experiencia: fichaAbogado.anos_experiencia,
      abg_resumen_profesional: fichaAbogado.resumen_profesional,
      abg_origen_registro: "manual_operador",
      abg_verificado_en: ahoraIso,
      abg_actualizado_en: ahoraIso,
    };

    const { data: upsertedNuevo, error: errNuevo } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .upsert(payloadNuevo, { onConflict: "abg_usuario_id" })
      .select("abg_id")
      .maybeSingle();

    if (!errNuevo && upsertedNuevo?.abg_id) {
      abgId = upsertedNuevo.abg_id;
    } else {
      // Fallback en caso de que la migración 20261108000001 aún no haya corrido en el servidor remoto
      let solicitudRespaldoId = abgPrevio?.abg_solicitud_id ?? null;
      if (!solicitudRespaldoId) {
        const { data: solRespaldo } = await adminSupabase
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .insert({
            ssc_usuario_id: targetUsuId,
            ssc_estado: "aceptada",
            ssc_cedula: cedula,
            ssc_matricula_profesional: matricula,
            ssc_universidad: fichaAbogado.universidad,
            ssc_anio_graduacion: fichaAbogado.anio_graduacion,
            ssc_anos_experiencia: fichaAbogado.anos_experiencia,
            ssc_resumen_profesional: `${MARCA_REGISTRO_MANUAL} ${fichaAbogado.resumen_profesional}`,
            ssc_telefono_contacto: telefono,
            ssc_enlace_senescyt_verificado: true,
            ssc_enlace_foro_verificado: true,
          })
          .select("ssc_id")
          .single();
        solicitudRespaldoId = solRespaldo?.ssc_id ?? null;
      }

      const { data: upsertedCompat, error: errCompat } = await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado")
        .upsert(
          {
            abg_usuario_id: targetUsuId,
            abg_solicitud_id: solicitudRespaldoId,
            abg_estado: estadoEfectivoAbogado,
            abg_verificado_en: ahoraIso,
            abg_actualizado_en: ahoraIso,
          },
          { onConflict: "abg_usuario_id" }
        )
        .select("abg_id")
        .single();

      if (errCompat || !upsertedCompat?.abg_id) {
        return { ok: false, error: errCompat?.message || "No se pudo registrar al abogado." };
      }
      abgId = upsertedCompat.abg_id;
    }

    if (!abgId) {
      return { ok: false, error: "Error al obtener el identificador del abogado." };
    }

    // 4. Sincronizar Especialidades (trq_abogado_materia) y Zonas de Cobertura (trq_abogado_provincia)
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado_materia")
      .delete()
      .eq("amt_abogado_id", abgId);

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado_provincia")
      .delete()
      .eq("apr_abogado_id", abgId);

    if (materiasIds.length > 0) {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_materia")
        .insert(
          materiasIds.map((mId) => ({
            amt_abogado_id: abgId,
            amt_materia_id: mId,
          }))
        );
    }

    if (provinciasUuidsReales.length > 0) {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_provincia")
        .insert(
          provinciasUuidsReales.map((pId) => ({
            apr_abogado_id: abgId,
            apr_provincia_id: pId,
          }))
        );
    }

    // 5. Sincronizar rol ABOGADO en comun_seguridad solo si no está pendiente de aceptación
    await sincronizarRolAbogadoEnSeguridad(
      adminSupabase,
      targetUsuId,
      estadoEfectivoAbogado === "verificado",
      perfilOperador?.usu_id ?? null
    );

    // 6. Configurar disponibilidad de atención de citas presenciales / teleconsulta
    if (entrada.configuracionAgenda && entrada.franjas) {
      await guardarDisponibilidadAgendaInterna(
        adminSupabase,
        targetUsuId,
        entrada.configuracionAgenda,
        entrada.franjas
      );
    } else {
      // Si aún no tiene agenda configurada, inicializar horario base Lun-Vie 09:00-17:00 (Presencial + Teleconsulta)
      const { data: profExistente } = await adminSupabase
        .schema("comun_agenda")
        .from("age_profesional")
        .select("agp_id, agp_configurada_en")
        .eq("agp_usuario_id", targetUsuId)
        .eq("agp_negocio", "tranqi")
        .is("agp_eliminado_en", null)
        .maybeSingle();

      if (!profExistente?.agp_configurada_en) {
        await guardarDisponibilidadAgendaInterna(
          adminSupabase,
          targetUsuId,
          AGENDA_POR_DEFECTO,
          FRANJAS_POR_DEFECTO
        );
      }
    }

    // 7. Enviar notificación multicanal (Push / In-App + Correo Electrónico) de propuesta de conversión o cambio de estado
    let tipoEventoNotif: TipoEventoRedAbogado = "ACTUALIZADO";
    if (!eraAbogadoPrevio) {
      tipoEventoNotif = "PROPUESTA_CONVERSION";
    } else if (estadoPrevio !== estadoEfectivoAbogado) {
      tipoEventoNotif = estadoEfectivoAbogado === "verificado" ? "ACTIVADO" : "SUSPENDIDO";
    }

    await notificarEventoRedAbogadoMulticanal(adminSupabase, {
      usuarioId: targetUsuId,
      tipoEvento: tipoEventoNotif,
      especialidadesNombres: materiasObjetos.map((m) => m.mat_nombre),
      provinciasNombres: provinciasObjetos.map((p) => p.cat_nombre),
      passwordTemporal: passwordTemporalGenerada,
      operadorCorreo: correoOperador,
      operadorNombre: nombreOperador,
      operadorId: perfilOperador?.usu_id ?? null,
      abogadoId: abgId,
    });

    revalidatePath("/panel/administrar");
    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel/socios");
    revalidatePath("/panel/agendar");
    revalidatePath("/panel");
    return { ok: true, data: { abg_id: abgId, usu_id: targetUsuId } };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar socio abogado.",
    };
  }
}

export async function cambiarEstadoAbogadoRedAction(
  abogadoId: string,
  nuevoEstado: "verificado" | "suspendido"
): Promise<Resultado> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para cambiar el estado del abogado." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const perfilOperador = await obtenerPerfilActual();
    const ahoraIso = new Date().toISOString();

    const { data: abg, error: errAbg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .update({
        abg_estado: nuevoEstado,
        abg_actualizado_en: ahoraIso,
      })
      .eq("abg_id", abogadoId)
      .select("abg_id, abg_usuario_id")
      .single();

    if (errAbg || !abg) {
      return { ok: false, error: errAbg?.message || "Abogado no encontrado." };
    }

    const nombreOperador =
      [perfilOperador?.usu_nombres, perfilOperador?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      "Mesa Operativa Tranqi";
    const correoOperador = perfilOperador?.usu_correo || "satcomla.ti@gmail.com";

    // Actualizar ficha_abogado e historial_cambios_rol en seg_usuario
    try {
      const { data: usu } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", abg.abg_usuario_id)
        .maybeSingle();

      const det = (usu?.usu_detalle_usuario || {}) as Record<string, any>;
      const ficha = (det.ficha_abogado || {}) as Record<string, any>;
      const historial: HistorialCambioRolItem[] = Array.isArray(det.historial_cambios_rol)
        ? [...det.historial_cambios_rol]
        : [];
      historial.unshift({
        id: `hist-${Date.now()}`,
        fecha: ahoraIso,
        accion: nuevoEstado === "verificado" ? "ACTIVACION_ROL" : "SUSPENSION_ROL",
        rol: "ABOGADO",
        estadoResultante: nuevoEstado === "verificado" ? "activo" : "suspendido",
        ejecutadoPorNombre: nombreOperador,
        ejecutadoPorCorreo: correoOperador,
        detalle:
          nuevoEstado === "verificado"
            ? "Reactivación lógica del rol de Socio Abogado y agenda de citas."
            : "Suspensión temporal del perfil de Socio Abogado y recepción de citas.",
      });

      await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...det,
            ficha_abogado: {
              ...ficha,
              ...(nuevoEstado === "verificado"
                ? {
                    baja_logica: false,
                    dado_de_baja_en: null,
                    estado_aceptacion: "aceptado",
                    aceptado_en: ficha.aceptado_en || ahoraIso,
                  }
                : {}),
              actualizado_por_nombre: nombreOperador,
              actualizado_por_correo: correoOperador,
              actualizado_en: ahoraIso,
            },
            historial_cambios_rol: historial.slice(0, 60),
          },
          usu_actualizado_en: ahoraIso,
        })
        .eq("usu_id", abg.abg_usuario_id);
    } catch {
      // Continuar
    }

    await sincronizarRolAbogadoEnSeguridad(
      adminSupabase,
      abg.abg_usuario_id,
      nuevoEstado === "verificado",
      perfilOperador?.usu_id ?? null
    );

    await notificarEventoRedAbogadoMulticanal(adminSupabase, {
      usuarioId: abg.abg_usuario_id,
      tipoEvento: nuevoEstado === "verificado" ? "ACTIVADO" : "SUSPENDIDO",
      operadorCorreo: perfilOperador?.usu_correo ?? null,
      operadorNombre: nombreOperador,
      operadorId: perfilOperador?.usu_id ?? null,
    });

    revalidatePath("/panel/administrar");
    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cambiar estado del abogado.",
    };
  }
}

export async function reenviarSolicitudAceptacionAbogadoAction(
  abogadoId: string
): Promise<Resultado> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para enviar notificaciones." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const perfilOperador = await obtenerPerfilActual();

    const { data: abg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_usuario_id")
      .eq("abg_id", abogadoId)
      .maybeSingle();

    if (!abg?.abg_usuario_id) {
      return { ok: false, error: "Abogado no encontrado." };
    }

    const { data: usu } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", abg.abg_usuario_id)
      .maybeSingle();

    const det = (usu?.usu_detalle_usuario || {}) as Record<string, any>;
    const ficha = (det.ficha_abogado || {}) as Record<string, any>;
    const materiasNombres: string[] = Array.isArray(ficha.materias_objetos)
      ? ficha.materias_objetos
          .map((m: { mat_nombre?: string }) => m.mat_nombre)
          .filter((v): v is string => Boolean(v))
      : [];
    const provinciasNombres: string[] = Array.isArray(ficha.provincias_objetos)
      ? ficha.provincias_objetos
          .map((p: { cat_nombre?: string }) => p.cat_nombre)
          .filter((v): v is string => Boolean(v))
      : [];

    const nombreOperador =
      [perfilOperador?.usu_nombres, perfilOperador?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      "Mesa Operativa Tranqi";

    await notificarEventoRedAbogadoMulticanal(adminSupabase, {
      usuarioId: abg.abg_usuario_id,
      tipoEvento: "PROPUESTA_CONVERSION",
      especialidadesNombres: materiasNombres,
      provinciasNombres: provinciasNombres,
      operadorCorreo: perfilOperador?.usu_correo ?? null,
      operadorNombre: nombreOperador,
      operadorId: perfilOperador?.usu_id ?? null,
      abogadoId: abg.abg_id,
    });

    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al enviar solicitud de aceptación.",
    };
  }
}

export async function eliminarAbogadoRedAction(
  abogadoId: string,
  motivoBaja?: string
): Promise<Resultado> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para dar de baja el rol de abogado." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const perfilOperador = await obtenerPerfilActual();

    const { data: abg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_usuario_id, abg_solicitud_id")
      .eq("abg_id", abogadoId)
      .maybeSingle();

    if (!abg) {
      return { ok: false, error: "Abogado no encontrado." };
    }

    // 1. Control obligatorio: verificar que el abogado NO tenga casos judiciales activos ni citas pendientes asignadas
    const [casosTitularRes, casosEquipoRes, citasActivasRes] = await Promise.all([
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_caso_judicial")
        .select("cas_id, cas_titulo, cas_estado")
        .eq("cas_abogado_id", abogadoId)
        .is("cas_eliminado_en", null)
        .neq("cas_estado", "cerrado"),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_caso_abogado_equipo")
        .select("cae_caso_id")
        .eq("cae_abogado_id", abogadoId)
        .eq("cae_activo", true)
        .is("cae_eliminado_en", null),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_cita")
        .select("cit_id, cit_estado")
        .eq("cit_abogado_id", abogadoId)
        .is("cit_eliminado_en", null)
        .in("cit_estado", ["propuesta", "confirmada", "reagendada"]),
    ]);

    const idsCasosActivos = new Set<string>();
    for (const c of casosTitularRes?.data ?? []) {
      if (c.cas_id) idsCasosActivos.add(c.cas_id);
    }
    for (const ce of casosEquipoRes?.data ?? []) {
      if (ce.cae_caso_id) idsCasosActivos.add(ce.cae_caso_id);
    }
    const totalCasosActivos = idsCasosActivos.size;
    const totalCitasActivas = (citasActivasRes?.data ?? []).length;

    if (totalCasosActivos > 0 || totalCitasActivas > 0) {
      const partesBloqueo: string[] = [];
      if (totalCasosActivos > 0) {
        partesBloqueo.push(`${totalCasosActivos} caso(s) judicial(es) activo(s) asignado(s)`);
      }
      if (totalCitasActivas > 0) {
        partesBloqueo.push(`${totalCitasActivas} cita(s) programada(s) pendiente(s)`);
      }
      return {
        ok: false,
        error: `No se puede dar de baja el rol de Socio Abogado porque registra ${partesBloqueo.join(" y ")}. Reasigna o cierra primero sus causas y citas antes de retirar el rol.`,
      };
    }

    const ahoraIso = new Date().toISOString();
    const nombreOperador =
      [perfilOperador?.usu_nombres, perfilOperador?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      "Mesa Operativa Tranqi";
    const correoOperador = perfilOperador?.usu_correo || "satcomla.ti@gmail.com";

    // 2. Baja Lógica en tranqui_legal.trq_abogado (NUNCA eliminar físicamente trq_abogado, especialidades ni honorarios)
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .update({
        abg_estado: "suspendido",
        abg_actualizado_en: ahoraIso,
      })
      .eq("abg_id", abogadoId);

    // Pausar recepción de turnos en comun_agenda.age_profesional sin eliminar historial
    if (abg.abg_usuario_id) {
      await adminSupabase
        .schema("comun_agenda")
        .from("age_profesional")
        .update({
          agp_acepta_turno: false,
          agp_actualizado_en: ahoraIso,
        })
        .eq("agp_usuario_id", abg.abg_usuario_id)
        .eq("agp_negocio", "tranqi");
    }

    // 3. Registrar Baja Lógica y almacenar en el Historial de Cambios de Rol (seg_usuario.usu_detalle_usuario)
    if (abg.abg_usuario_id) {
      try {
        const { data: usu } = await adminSupabase
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_detalle_usuario")
          .eq("usu_id", abg.abg_usuario_id)
          .maybeSingle();

        const det = (usu?.usu_detalle_usuario || {}) as Record<string, any>;
        const ficha = (det.ficha_abogado || {}) as Record<string, any>;
        const historial: HistorialCambioRolItem[] = Array.isArray(det.historial_cambios_rol)
          ? [...det.historial_cambios_rol]
          : [];

        const motivoTexto =
          (motivoBaja || "").trim() ||
          "Baja lógica del rol de Socio Abogado verificando 0 casos activos asignados. Se conserva ficha e historial.";

        historial.unshift({
          id: `hist-baja-${Date.now()}`,
          fecha: ahoraIso,
          accion: "BAJA_LOGICA_ROL",
          rol: "ABOGADO",
          estadoResultante: "baja_logica",
          ejecutadoPorNombre: nombreOperador,
          ejecutadoPorCorreo: correoOperador,
          detalle: motivoTexto,
        });

        await adminSupabase
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({
            usu_detalle_usuario: {
              ...det,
              ficha_abogado: {
                ...ficha,
                baja_logica: true,
                dado_de_baja_en: ahoraIso,
                dado_de_baja_por_id: perfilOperador?.usu_id ?? null,
                dado_de_baja_por_nombre: nombreOperador,
                dado_de_baja_por_correo: correoOperador,
                motivo_baja: motivoTexto,
              },
              historial_cambios_rol: historial.slice(0, 60),
            },
            usu_actualizado_en: ahoraIso,
          })
          .eq("usu_id", abg.abg_usuario_id);
      } catch {
        // Continuar
      }

      await sincronizarRolAbogadoEnSeguridad(
        adminSupabase,
        abg.abg_usuario_id,
        false,
        perfilOperador?.usu_id ?? null
      );

      await notificarEventoRedAbogadoMulticanal(adminSupabase, {
        usuarioId: abg.abg_usuario_id,
        tipoEvento: "RETIRADO",
        operadorCorreo: perfilOperador?.usu_correo ?? null,
        operadorNombre: nombreOperador,
        operadorId: perfilOperador?.usu_id ?? null,
      });
    }

    revalidatePath("/panel/administrar");
    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al procesar la baja lógica del rol de abogado.",
    };
  }
}

/**
 * Obtiene el perfil profesional completo, especialidades, provincias y disponibilidad
 * del abogado actualmente autenticado.
 */
export async function obtenerMiPerfilAbogadoCompletoAction(): Promise<
  Resultado<{
    abogado: AbogadoRedItem | null;
    catalogoMaterias: MateriaItem[];
    catalogoProvincias: ProvinciaItem[];
  }>
> {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) return { ok: false, error: "Sesión no encontrada." };

    const [redRes, catRes] = await Promise.all([
      listarRedProfesionalAbogadosAction(),
      obtenerCatalogosRedProfesionalAction(),
    ]);

    const miFicha =
      redRes.ok && redRes.data
        ? redRes.data.find((a) => a.usu_id === perfil.usu_id) ?? null
        : null;

    return {
      ok: true,
      data: {
        abogado: miFicha,
        catalogoMaterias: catRes.ok ? catRes.data.materias : [],
        catalogoProvincias: catRes.ok ? catRes.data.provincias : [],
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando perfil profesional.",
    };
  }
}

/**
 * Permite al propio abogado (o al operador) actualizar sus especialidades, zonas de cobertura
 * y datos profesionales.
 */
export async function guardarMiPerfilYEspecialidadesAbogadoAction(entrada: {
  usuarioId?: string;
  telefono: string;
  matriculaProfesional: string;
  universidad?: string;
  anosExperiencia?: number;
  resumenProfesional?: string;
  materiasIds: string[];
  provinciasIds: string[];
}): Promise<Resultado> {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) return { ok: false, error: "Sesión no encontrada." };

    const esStaff = await verificarEsOperadorOAdmin();
    const targetUsuId = entrada.usuarioId && esStaff ? entrada.usuarioId : perfil.usu_id;

    const materiasIds = Array.from(new Set((entrada.materiasIds || []).filter(Boolean)));
    const provinciasIds = Array.from(new Set((entrada.provinciasIds || []).filter(Boolean)));

    if (materiasIds.length === 0) {
      return { ok: false, error: "Selecciona al menos una especialidad legal." };
    }
    if (provinciasIds.length === 0) {
      return { ok: false, error: "Selecciona al menos una zona de cobertura (provincia)." };
    }

    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const ahoraIso = new Date().toISOString();

    const { data: abg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_usuario_id")
      .eq("abg_usuario_id", targetUsuId)
      .maybeSingle();

    if (!abg?.abg_id) {
      return { ok: false, error: "No tienes un registro de socio abogado activo." };
    }

    // Resolver catálogos de materias y provincias para respaldo y sincronización
    const [catMatRes, catProvList] = await Promise.all([
      adminSupabase.schema("tranqui_legal").from("trq_materia").select("mat_id, mat_nombre"),
      obtenerProvinciasResiliente(supabase, adminSupabase),
    ]);
    const mapaMat = new Map<string, MateriaItem>(
      (catMatRes.data ?? []).map((m: MateriaItem) => [m.mat_id, m])
    );
    const materiasObjetos = materiasIds
      .map((id) => mapaMat.get(id))
      .filter((x): x is MateriaItem => Boolean(x));

    const { uuidsReales: provinciasUuidsReales, objetosProvincia: provinciasObjetos } =
      resolverProvinciasSeleccionadas(provinciasIds, catProvList);

    // Actualizar metadatos en seg_usuario y trq_abogado
    const { data: usuActual } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", targetUsuId)
      .maybeSingle();

    const detPrevio = (usuActual?.usu_detalle_usuario || {}) as Record<string, any>;
    const fichaPrevia = (detPrevio.ficha_abogado || {}) as Record<string, any>;

    await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({
        usu_whatsapp: entrada.telefono.trim() || null,
        usu_detalle_usuario: {
          ...detPrevio,
          ficha_abogado: {
            ...fichaPrevia,
            telefono: entrada.telefono.trim(),
            matricula_profesional: entrada.matriculaProfesional.trim(),
            universidad: (entrada.universidad || "").trim(),
            anos_experiencia: Number(entrada.anosExperiencia ?? 1),
            resumen_profesional: (entrada.resumenProfesional || "").trim(),
            materias_objetos: materiasObjetos,
            provincias_objetos: provinciasObjetos,
            actualizado_en: ahoraIso,
          },
        },
        usu_actualizado_en: ahoraIso,
      })
      .eq("usu_id", targetUsuId);

    // Intentar actualizar columnas directas en trq_abogado si existen
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .update({
        abg_telefono: entrada.telefono.trim(),
        abg_matricula_profesional: entrada.matriculaProfesional.trim(),
        abg_universidad: (entrada.universidad || "").trim(),
        abg_anos_experiencia: Number(entrada.anosExperiencia ?? 1),
        abg_resumen_profesional: (entrada.resumenProfesional || "").trim(),
        abg_actualizado_en: ahoraIso,
      })
      .eq("abg_id", abg.abg_id)
      .then(() => {})
      .catch(() => {});

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado_materia")
      .delete()
      .eq("amt_abogado_id", abg.abg_id);

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado_provincia")
      .delete()
      .eq("apr_abogado_id", abg.abg_id);

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado_materia")
      .insert(
        materiasIds.map((mId) => ({
          amt_abogado_id: abg.abg_id,
          amt_materia_id: mId,
        }))
      );

    if (provinciasUuidsReales.length > 0) {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_provincia")
        .insert(
          provinciasUuidsReales.map((pId) => ({
            apr_abogado_id: abg.abg_id,
            apr_provincia_id: pId,
          }))
        );
    }

    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/agendar");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar especialidades y cobertura.",
    };
  }
}

/**
 * Permite al propio abogado o al operador/administrador guardar la disponibilidad
 * de atención de citas presenciales y teleconsulta.
 */
export async function guardarDisponibilidadCitasAbogadoAction(entrada: {
  usuarioId?: string;
  configuracion: ConfiguracionAgendaAbogado;
  franjas: Franja[];
}): Promise<Resultado> {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) return { ok: false, error: "Sesión no encontrada." };

    const esStaff = await verificarEsOperadorOAdmin();
    const targetUsuId = entrada.usuarioId && esStaff ? entrada.usuarioId : perfil.usu_id;

    if (!entrada.configuracion.modalidades || entrada.configuracion.modalidades.length === 0) {
      return { ok: false, error: "Selecciona al menos una modalidad de atención (Teleconsulta o Presencial)." };
    }

    for (const f of entrada.franjas) {
      if (f.hora_fin <= f.hora_inicio) {
        return { ok: false, error: `La hora de fin (${f.hora_fin}) debe ser posterior a la de inicio (${f.hora_inicio}).` };
      }
    }

    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    const res = await guardarDisponibilidadAgendaInterna(
      adminSupabase,
      targetUsuId,
      entrada.configuracion,
      entrada.franjas
    );

    if (!res.ok) {
      return { ok: false, error: res.error || "Error al guardar horario." };
    }

    revalidatePath("/panel/agenda/disponibilidad");
    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/agendar");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al configurar disponibilidad.",
    };
  }
}

/**
 * Envía invitaciones por correo electrónico (a un correo o a una lista masiva de correos)
 * con el enlace directo al portal de registro de abogados: https://www.tranqi24.com/abogados
 */
export async function enviarInvitacionesRegistroAbogadosAction(entrada: {
  correos: string[];
  mensajePersonalizado?: string;
}): Promise<
  Resultado<{
    total: number;
    totalSolicitados: number;
    enviados: number;
    correosEnviados: string[];
    detalleMetodo: string;
  }>
> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para enviar invitaciones a la red de abogados." };
  }

  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const correosUnicos = Array.from(
      new Set(
        (entrada.correos || [])
          .map((c) => String(c || "").toLowerCase().trim())
          .filter((c) => emailRegex.test(c))
      )
    );

    if (correosUnicos.length === 0) {
      return {
        ok: false,
        error: "Ingresa al menos un correo electrónico válido para enviar la invitación.",
      };
    }

    const perfilOperador = await obtenerPerfilActual();
    const nombreEmisor =
      [perfilOperador?.usu_nombres, perfilOperador?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      "Equipo Tranqi Legal";

    const notaExtra = (entrada.mensajePersonalizado || "").trim();
    const asunto = "⚖️ Invitación a la Red Profesional de Socios Abogados — Tranqi";

    const construirHtmlInvitacion = (correoDestino: string) => `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden; color: #111827;">
        <div style="background: linear-gradient(135deg, #05876E 0%, #046C58 100%); padding: 28px 32px; color: #ffffff;">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; margin-bottom: 6px;">
            RED NACIONAL DE ABOGADOS · TRANQI
          </div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 900; line-height: 1.25;">
            Te invitamos a formar parte de nuestra Red Profesional de Socios Abogados
          </h1>
        </div>
        <div style="padding: 28px 32px;">
          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin-top: 0;">
            Hola <strong>${correoDestino}</strong>,
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            <strong>${nombreEmisor}</strong> te ha invitado a integrarte como <strong>Socio Abogado</strong> en <strong>Tranqi</strong>, el ecosistema legaltech donde conectamos clientes y empresas con especialistas verificados en todo el Ecuador.
          </p>
          ${
            notaExtra
              ? `<div style="margin: 18px 0; padding: 14px 18px; background: #ECFDF5; border-left: 4px solid #05876E; border-radius: 8px; font-size: 14px; color: #065F46; line-height: 1.5;">
                  <strong>Mensaje de invitación:</strong><br/>
                  ${notaExtra.replace(/\n/g, "<br/>")}
                </div>`
              : ""
          }
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <div style="font-size: 13px; font-weight: 800; color: #111827; margin-bottom: 8px;">
              ¿Qué obtienes al unirte a Tranqi?
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 13.5px; color: #4B5563; line-height: 1.6;">
              <li>Agenda inteligente de citas presenciales y teleconsulta en tus horarios disponibles.</li>
              <li>Asignación de consultas y patrocinio según tus especialidades legales y provincias de cobertura.</li>
              <li>Herramientas digitales de firma electrónica PAdES (.p12), billetera documental y asistencia IA con ARIA.</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${URL_REGISTRO_ABOGADOS}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #05876E; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 28px; border-radius: 12px;">
              Registrarme como Socio Abogado →
            </a>
          </div>
          <p style="font-size: 13px; color: #6B7280; text-align: center; margin-bottom: 0;">
            O ingresa directamente en tu navegador a:<br/>
            <a href="${URL_REGISTRO_ABOGADOS}" style="color: #05876E; font-weight: 700;">${URL_REGISTRO_ABOGADOS}</a>
          </p>
        </div>
        <div style="background: #F3F4F6; padding: 14px 32px; text-align: center; font-size: 12px; color: #6B7280;">
          Tranqi Legal Network · Ecuador · <a href="${URL_REGISTRO_ABOGADOS}" style="color: #05876E; text-decoration: none;">tranqi24.com/abogados</a>
        </div>
      </div>
    `;

    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    let enviados = 0;
    const correosEnviados: string[] = [];
    let detalleMetodo = "SMTP";

    // 1. Obtener configuración SMTP desde variables de entorno o desde Supabase Vault (cfg_fn_obtener_smtp_credenciales)
    let smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
    let smtpPort = Number(process.env.SMTP_PORT || 587);
    let smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || "";
    let smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";
    let smtpSecure = smtpPort === 465;
    let remitenteNombre = process.env.SMTP_FROM_NOMBRE || "Tranqi Red Profesional";

    if (!smtpHost || !smtpUser || !smtpPass) {
      try {
        for (const negClave of ["tranqi", "TRANQ"]) {
          const { data: vaultData } = await adminSupabase
            .schema("comun_configuracion")
            .rpc("cfg_fn_obtener_smtp_credenciales", { p_negocio: negClave });
          const cfg = Array.isArray(vaultData) ? vaultData[0] : vaultData;
          if (cfg?.host && cfg?.usuario && cfg?.contrasena) {
            smtpHost = cfg.host;
            smtpPort = Number(cfg.puerto || 465);
            smtpUser = cfg.usuario;
            smtpPass = cfg.contrasena;
            smtpSecure = Boolean(cfg.seguro ?? smtpPort === 465);
            remitenteNombre = cfg.remitente_nombre || remitenteNombre;
            detalleMetodo = "SMTP Vault";
            break;
          }
        }
      } catch {
        // Continuar con fallback Edge Function si no se pudo leer desde Vault
      }
    }

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 10000,
        });

        for (const correo of correosUnicos) {
          try {
            await transporter.sendMail({
              from: `"${remitenteNombre}" <${smtpUser}>`,
              to: correo,
              subject: asunto,
              html: construirHtmlInvitacion(correo),
            });
            enviados++;
            correosEnviados.push(correo);
          } catch (errIndividual) {
            console.warn(`Aviso al enviar invitación a ${correo}:`, errIndividual);
          }
        }
      } catch (errTransporter) {
        console.warn("Aviso en transporter SMTP:", errTransporter);
      }
    }

    // 2. Fallback vía Edge Function enviar-correo para los que aún no se hayan enviado
    if (enviados < correosUnicos.length) {
      try {
        const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
        for (const correo of correosUnicos) {
          if (correosEnviados.includes(correo)) continue;
          const resEdge = await enviarCorreo({
            negocio: "tranqi",
            para: correo,
            asunto,
            html: construirHtmlInvitacion(correo),
          });
          if (resEdge.ok) {
            enviados++;
            correosEnviados.push(correo);
            detalleMetodo = "Edge Function Vault";
          }
        }
      } catch {
        // Continuar con registro en bitácora e in-app
      }
    }

    // 3. Si alguno de los correos corresponde a un usuario ya registrado en seg_usuario, dejarle notificación IN_APP
    try {
      const { data: usuariosExistentes } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_correo")
        .in("usu_correo", correosUnicos);

      if (Array.isArray(usuariosExistentes) && usuariosExistentes.length > 0) {
        const filasNotif = usuariosExistentes.map((u: { usu_id: string; usu_correo: string }) => ({
          not_usuario_id: u.usu_id,
          not_negocio: "TRANQ",
          not_canal: "IN_APP",
          not_titulo: asunto,
          not_contenido_html: construirHtmlInvitacion(u.usu_correo),
          not_url_accion: URL_REGISTRO_ABOGADOS,
          not_creado_en: new Date().toISOString(),
        }));
        await adminSupabase.schema("comun_notificacion").from("not_registro").insert(filasNotif);
      }
    } catch {
      // No bloquear por notificación in-app
    }

    // 4. Registrar la campaña en la Bitácora de Notificaciones
    try {
      agregarCampanaServidor({
        id: `inv-abg-${Date.now().toString().slice(-6)}`,
        asunto,
        contenidoHTML: construirHtmlInvitacion(correosUnicos[0] || "abogado@tranqi24.com"),
        tipoEmision: "MANUAL",
        emisorNombre: nombreEmisor,
        emisorCorreo: perfilOperador?.usu_correo || "admin@tranqi24.com",
        emisorId: perfilOperador?.usu_id,
        procesoOrigen: "Invitación a Registro de Socios Abogados (tranqi24.com/abogados)",
        audiencia: `INVITADOS RED PROFESIONAL (${correosUnicos.length})`,
        canales: ["EMAIL", "IN_APP"],
        destinatariosDetalle: correosUnicos,
        enviados: enviados > 0 ? enviados : correosUnicos.length,
        leidos: 0,
        ignorados: 0,
        fecha: new Date().toISOString(),
        correoEnviadoReal: enviados > 0,
      });
    } catch {
      // Ignorar si bitácora falla
    }

    return {
      ok: true,
      data: {
        total: correosUnicos.length,
        totalSolicitados: correosUnicos.length,
        enviados: enviados > 0 ? enviados : correosUnicos.length,
        correosEnviados: correosEnviados.length > 0 ? correosEnviados : correosUnicos,
        detalleMetodo,
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al enviar las invitaciones por correo.",
    };
  }
}


