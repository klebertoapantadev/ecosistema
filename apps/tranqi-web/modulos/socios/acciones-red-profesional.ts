"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { huecosPorSemana, type Franja } from "@eco/agenda";

export type Resultado<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const MARCA_REGISTRO_MANUAL = "[REGISTRO_MANUAL_EQUIPO]";
const FECHA_CORTE_PURGA_SOLICITUDES = "2026-11-08T13:30:00.000Z";

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
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
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

export async function obtenerCatalogosRedProfesionalAction(): Promise<
  Resultado<{ materias: MateriaItem[]; provincias: ProvinciaItem[] }>
> {
  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;

    const [matRes, provRes] = await Promise.all([
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_materia")
        .select("mat_id, mat_nombre")
        .eq("mat_activa", true)
        .order("mat_nombre"),
      adminSupabase
        .schema("comun_catalogo")
        .from("cat_provincia")
        .select("cat_id, cat_nombre")
        .order("cat_nombre"),
    ]);

    return {
      ok: true,
      data: {
        materias: (matRes.data ?? []) as MateriaItem[],
        provincias: (provRes.data ?? []) as ProvinciaItem[],
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando catálogos",
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
      adminSupabase.schema("comun_catalogo").from("cat_provincia").select("cat_id, cat_nombre"),
      adminSupabase
        .schema("comun_agenda")
        .from("age_profesional")
        .select("*")
        .eq("agp_negocio", "tranqi")
        .in("agp_usuario_id", usuIds)
        .is("agp_eliminado_en", null),
    ]);

    const mapaUsuarios = new Map<string, any>((usuRes.data ?? []).map((u: any) => [u.usu_id, u]));
    const mapaSolicitudes = new Map<string, any>((solRes.data ?? []).map((s: any) => [s.ssc_id, s]));
    const mapaCatMaterias = new Map<string, MateriaItem>((catMatRes.data ?? []).map((m: MateriaItem) => [m.mat_id, m]));
    const mapaCatProvincias = new Map<string, ProvinciaItem>((catProvRes.data ?? []).map((p: ProvinciaItem) => [p.cat_id, p]));
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
      const franjas = prof ? franjasPorProf.get(prof.agp_id) ?? [] : [];
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
            direccion: prof.agp_direccion ?? null,
          }
        : AGENDA_POR_DEFECTO;

      let citasPorSemana = 0;
      try {
        citasPorSemana = huecosPorSemana({ configuracion: configuracionAgenda, franjas });
      } catch {
        citasPorSemana = 0;
      }

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
        materias: materiasPorAbogado.get(a.abg_id) ?? [],
        provincias: provinciasPorAbogado.get(a.abg_id) ?? [],
        agendaConfigurada: Boolean(prof?.agp_configurada_en && franjas.length > 0),
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
 * Configura la disponibilidad de citas presenciales / teleconsulta para un usuario abogado en comun_agenda.
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

    const { data: prof, error: errProf } = await adminSupabase
      .schema("comun_agenda")
      .from("age_profesional")
      .upsert(
        {
          agp_usuario_id: usuarioId,
          agp_negocio: "tranqi",
          agp_zona_horaria: config.zona_horaria || "America/Guayaquil",
          agp_duracion_cita_min: Number(config.duracion_cita_min || 45),
          agp_holgura_min: Number(config.holgura_min ?? 15),
          agp_antelacion_minima_horas: Number(config.antelacion_minima_horas ?? 12),
          agp_horizonte_dias: Number(config.horizonte_dias || 60),
          agp_modalidades: modalidadesLimpias,
          agp_acepta_turno: Boolean(config.acepta_turno ?? true),
          agp_direccion: config.direccion || null,
          agp_configurada_en: ahoraIso,
          agp_eliminado_en: null,
          agp_actualizado_en: ahoraIso,
        },
        { onConflict: "agp_usuario_id,agp_negocio" }
      )
      .select("agp_id")
      .single();

    if (errProf || !prof?.agp_id) {
      return { ok: false, error: errProf?.message || "No se pudo guardar el perfil de agenda." };
    }

    // Reemplazar franjas activas
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

      const { error: errFra } = await adminSupabase
        .schema("comun_agenda")
        .from("age_franja")
        .insert(filasFranjas);

      if (errFra) {
        return { ok: false, error: errFra.message };
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar disponibilidad.",
    };
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

    // 2. Actualizar seg_usuario con sus datos y ficha_abogado en usu_detalle_usuario
    const { data: usuActual } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario")
      .eq("usu_id", targetUsuId)
      .maybeSingle();

    const detPrevio = (usuActual?.usu_detalle_usuario || {}) as Record<string, unknown>;
    const fichaAbogado = {
      cedula,
      matricula_profesional: matricula,
      telefono,
      universidad: (entrada.universidad || "").trim() || "Acreditado por Operador",
      anio_graduacion: new Date().getFullYear(),
      anos_experiencia: Number(entrada.anosExperiencia ?? 1),
      resumen_profesional: (entrada.resumenProfesional || "").trim() || "Socio Abogado de la Red Profesional Tranqi",
      origen_registro: "manual_operador",
      actualizado_en: ahoraIso,
    };

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
          },
          usu_actualizado_en: ahoraIso,
        },
        { onConflict: "usu_id" }
      );

    // 3. Upsert en tranqui_legal.trq_abogado (intentando primero con las columnas nuevas y abg_solicitud_id null)
    const { data: abgPrevio } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_solicitud_id")
      .eq("abg_usuario_id", targetUsuId)
      .maybeSingle();

    let abgId: string | null = abgPrevio?.abg_id ?? null;

    const payloadNuevo = {
      abg_usuario_id: targetUsuId,
      abg_solicitud_id: abgPrevio?.abg_solicitud_id ?? null,
      abg_estado: estado,
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
            abg_estado: estado,
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

    if (provinciasIds.length > 0) {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_abogado_provincia")
        .insert(
          provinciasIds.map((pId) => ({
            apr_abogado_id: abgId,
            apr_provincia_id: pId,
          }))
        );
    }

    // 5. Sincronizar rol ABOGADO en comun_seguridad según si está activo ('verificado') o suspendido
    await sincronizarRolAbogadoEnSeguridad(
      adminSupabase,
      targetUsuId,
      estado === "verificado",
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

    const { data: abg, error: errAbg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .update({
        abg_estado: nuevoEstado,
        abg_actualizado_en: new Date().toISOString(),
      })
      .eq("abg_id", abogadoId)
      .select("abg_id, abg_usuario_id")
      .single();

    if (errAbg || !abg) {
      return { ok: false, error: errAbg?.message || "Abogado no encontrado." };
    }

    await sincronizarRolAbogadoEnSeguridad(
      adminSupabase,
      abg.abg_usuario_id,
      nuevoEstado === "verificado",
      perfilOperador?.usu_id ?? null
    );

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

export async function eliminarAbogadoRedAction(abogadoId: string): Promise<Resultado> {
  const autorizado = await verificarEsOperadorOAdmin();
  if (!autorizado) {
    return { ok: false, error: "No autorizado para retirar abogados de la red." };
  }

  try {
    const supabase = await crearClienteServidor();
    const adminSupabase = (crearClienteAdmin() || supabase) as any;

    const { data: abg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_usuario_id, abg_solicitud_id")
      .eq("abg_id", abogadoId)
      .maybeSingle();

    if (!abg) {
      return { ok: false, error: "Abogado no encontrado." };
    }

    await Promise.all([
      adminSupabase.schema("tranqui_legal").from("trq_honorario").delete().eq("hon_abogado_id", abogadoId),
      adminSupabase.schema("tranqui_legal").from("trq_abogado_materia").delete().eq("amt_abogado_id", abogadoId),
      adminSupabase.schema("tranqui_legal").from("trq_abogado_provincia").delete().eq("apr_abogado_id", abogadoId),
    ]);

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .delete()
      .eq("abg_id", abogadoId);

    if (abg.abg_solicitud_id) {
      await eliminarSolicitudSocioIndividualAction(abg.abg_solicitud_id);
    }

    if (abg.abg_usuario_id) {
      await sincronizarRolAbogadoEnSeguridad(adminSupabase, abg.abg_usuario_id, false);
    }

    revalidatePath("/panel/administrar");
    revalidatePath("/panel/red-profesional");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al retirar abogado de la red.",
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

    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado_provincia")
      .insert(
        provinciasIds.map((pId) => ({
          apr_abogado_id: abg.abg_id,
          apr_provincia_id: pId,
        }))
      );

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

