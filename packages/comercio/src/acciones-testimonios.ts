'use server';

import { revalidatePath } from 'next/cache';
import { crearClienteServidor, crearClienteAdmin } from '@eco/supabase/servidor';
import { normalizarIdentificadorNegocio } from './utils/negocio';

export interface TestimonioDB {
  tes_id: string;
  tes_negocio: string;
  tes_nombre_cliente: string;
  tes_ciudad: string;
  tes_ocasion: string;
  tes_comentario: string;
  tes_imagen_url: string;
  tes_calificacion: number;
  tes_orden: number;
  tes_activo: boolean;
  tes_destacado: boolean;
  tes_detalle_testimonio?: Record<string, any>;
  tes_creado_en?: string;
  tes_actualizado_en?: string;
}

export interface DatosGuardarTestimonio {
  tes_id?: string;
  tes_nombre_cliente: string;
  tes_ciudad: string;
  tes_ocasion: string;
  tes_comentario: string;
  tes_imagen_url: string;
  tes_calificacion: number;
  tes_orden?: number;
  tes_activo?: boolean;
  tes_destacado?: boolean;
}

/**
 * Obtiene todos los testimonios de un negocio.
 * Si es administrador obtiene todos; para cliente solo los activos.
 */
export async function obtenerTestimoniosNegocioAction(
  negocioRaw: string,
  soloActivos = false
): Promise<{ ok: boolean; testimonios: TestimonioDB[]; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(negocioRaw);
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const cliente = admin || supabase;

    let query = cliente
      .schema('comun_comercio')
      .from('com_testimonio')
      .select('*')
      .eq('tes_negocio', principal)
      .order('tes_orden', { ascending: true })
      .order('tes_creado_en', { ascending: false });

    if (soloActivos) {
      query = query.eq('tes_activo', true);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, testimonios: [], error: error.message };
    }

    return { ok: true, testimonios: data || [] };
  } catch (err: any) {
    return { ok: false, testimonios: [], error: err.message || 'Error al obtener testimonios.' };
  }
}

/**
 * Guarda (crea o actualiza) un testimonio en la base de datos.
 */
export async function guardarTestimonioAction(
  datos: DatosGuardarTestimonio,
  negocioRaw: string
): Promise<{ ok: boolean; testimonio?: TestimonioDB; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(negocioRaw);
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const cliente = admin || supabase;

    const payload = {
      tes_negocio: principal,
      tes_nombre_cliente: datos.tes_nombre_cliente.trim(),
      tes_ciudad: datos.tes_ciudad.trim() || 'Quito',
      tes_ocasion: datos.tes_ocasion.trim() || '💐 Entrega Floral',
      tes_comentario: datos.tes_comentario.trim(),
      tes_imagen_url: datos.tes_imagen_url.trim(),
      tes_calificacion: Number(datos.tes_calificacion) || 5,
      tes_orden: datos.tes_orden ?? 0,
      tes_activo: datos.tes_activo ?? true,
      tes_destacado: datos.tes_destacado ?? true,
      tes_actualizado_en: new Date().toISOString(),
    };

    let resData: any = null;

    if (datos.tes_id) {
      // Actualizar existente
      const { data, error } = await cliente
        .schema('comun_comercio')
        .from('com_testimonio')
        .update(payload)
        .eq('tes_id', datos.tes_id)
        .eq('tes_negocio', principal)
        .select('*')
        .single();

      if (error) return { ok: false, error: error.message };
      resData = data;
    } else {
      // Crear nuevo
      const { data, error } = await cliente
        .schema('comun_comercio')
        .from('com_testimonio')
        .insert(payload)
        .select('*')
        .single();

      if (error) return { ok: false, error: error.message };
      resData = data;
    }

    // Revalidar rutas para refrescar de inmediato el ecommerce
    try {
      revalidatePath('/');
      revalidatePath('/panel/testimonios');
    } catch {
      // Ignorar en contextos fuera de Next.js
    }

    return { ok: true, testimonio: resData };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error al guardar testimonio.' };
  }
}

/**
 * Elimina un testimonio por ID.
 */
export async function eliminarTestimonioAction(
  testimonioId: string,
  negocioRaw: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(negocioRaw);
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const cliente = admin || supabase;

    const { error } = await cliente
      .schema('comun_comercio')
      .from('com_testimonio')
      .delete()
      .eq('tes_id', testimonioId)
      .eq('tes_negocio', principal);

    if (error) return { ok: false, error: error.message };

    try {
      revalidatePath('/');
      revalidatePath('/panel/testimonios');
    } catch {}

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error al eliminar testimonio.' };
  }
}

/**
 * Alterna el estado activo/inactivo de un testimonio.
 */
export async function alternarEstadoTestimonioAction(
  testimonioId: string,
  activo: boolean,
  negocioRaw: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { principal } = normalizarIdentificadorNegocio(negocioRaw);
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const cliente = admin || supabase;

    const { error } = await cliente
      .schema('comun_comercio')
      .from('com_testimonio')
      .update({ tes_activo: activo, tes_actualizado_en: new Date().toISOString() })
      .eq('tes_id', testimonioId)
      .eq('tes_negocio', principal);

    if (error) return { ok: false, error: error.message };

    try {
      revalidatePath('/');
      revalidatePath('/panel/testimonios');
    } catch {}

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error al alternar estado del testimonio.' };
  }
}
