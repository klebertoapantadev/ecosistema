/* eslint-disable @typescript-eslint/no-explicit-any */
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";

// Almacén en memoria global para fallback en runtime
const memoriaBilleteraGlobal: {
  documentos: Record<string, any[]>; // usu_id -> documentos[]
  enlacesTtl: any[];
} = {
  documentos: {},
  enlacesTtl: []
};

/**
 * Obtiene los documentos del usuario desde seg_usuario (usu_detalles.billetera_documentos) o memoria
 */
export async function obtenerDocumentosResilientes(usuarioId: string): Promise<any[]> {
  try {
    const admin = (crearClienteAdmin() || await crearClienteServidor()) as any;
    if (admin) {
      const { data: usuario } = await admin
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalles")
        .eq("usu_id", usuarioId)
        .single();

      if (usuario?.usu_detalles?.billetera_documentos && Array.isArray(usuario.usu_detalles.billetera_documentos)) {
        // Actualizar memoria con lo recuperado de la base
        memoriaBilleteraGlobal.documentos[usuarioId] = usuario.usu_detalles.billetera_documentos;
        return usuario.usu_detalles.billetera_documentos;
      }
    }
  } catch (err) {
    console.warn("Aviso al leer documentos desde usu_detalles:", err);
  }

  return memoriaBilleteraGlobal.documentos[usuarioId] || [];
}

/**
 * Guarda o actualiza un documento en usu_detalles y memoria
 */
export async function guardarDocumentoResiliente(usuarioId: string, docPayload: any): Promise<any> {
  const docsActuales = await obtenerDocumentosResilientes(usuarioId);
  const ahora = new Date().toISOString();

  let docFinal: any;
  let nuevaLista: any[];

  if (docPayload.doc_id) {
    // Edición
    docFinal = {
      ...docPayload,
      doc_actualizado_en: ahora
    };
    nuevaLista = docsActuales.map(d => d.doc_id === docPayload.doc_id ? docFinal : d);
  } else {
    // Inserción
    const nuevoId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    docFinal = {
      ...docPayload,
      doc_id: nuevoId,
      doc_secuencial: docsActuales.length + 1,
      doc_creado_en: ahora,
      doc_actualizado_en: ahora,
      doc_eliminado_en: null
    };
    nuevaLista = [docFinal, ...docsActuales];
  }

  // Guardar en memoria
  memoriaBilleteraGlobal.documentos[usuarioId] = nuevaLista;

  // Persistir en seg_usuario.usu_detalles
  try {
    const admin = (crearClienteAdmin() || await crearClienteServidor()) as any;
    if (admin) {
      const { data: usuario } = await admin
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalles")
        .eq("usu_id", usuarioId)
        .single();

      const detallesActuales = usuario?.usu_detalles || {};
      await admin
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalles: {
            ...detallesActuales,
            billetera_documentos: nuevaLista
          }
        })
        .eq("usu_id", usuarioId);
    }
  } catch (err) {
    console.warn("Aviso al sincronizar con usu_detalles:", err);
  }

  return docFinal;
}

/**
 * Elimina lógicamente un documento en usu_detalles y memoria
 */
export async function eliminarDocumentoResiliente(usuarioId: string, docId: string): Promise<boolean> {
  const docsActuales = await obtenerDocumentosResilientes(usuarioId);
  const nuevaLista = docsActuales.filter(d => d.doc_id !== docId);

  memoriaBilleteraGlobal.documentos[usuarioId] = nuevaLista;

  try {
    const admin = (crearClienteAdmin() || await crearClienteServidor()) as any;
    if (admin) {
      const { data: usuario } = await admin
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalles")
        .eq("usu_id", usuarioId)
        .single();

      const detallesActuales = usuario?.usu_detalles || {};
      await admin
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalles: {
            ...detallesActuales,
            billetera_documentos: nuevaLista
          }
        })
        .eq("usu_id", usuarioId);
    }
  } catch (err) {
    console.warn("Aviso al eliminar documento en usu_detalles:", err);
  }

  return true;
}

/**
 * Gestión de Enlaces TTL Resilientes
 */
export function guardarEnlaceTtlResiliente(payload: any) {
  const nuevo = {
    ...payload,
    ttl_id: payload.ttl_id || `ttl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ttl_creado_en: payload.ttl_creado_en || new Date().toISOString()
  };
  memoriaBilleteraGlobal.enlacesTtl.unshift(nuevo);
  return nuevo;
}

export function obtenerEnlaceTtlPorToken(token: string) {
  return memoriaBilleteraGlobal.enlacesTtl.find(e => e.ttl_token === token && e.ttl_activo);
}

export function listarEnlacesTtlUsuario(usuarioId: string, documentoId?: string | null) {
  return memoriaBilleteraGlobal.enlacesTtl.filter(e => {
    if (e.ttl_usuario_id !== usuarioId) return false;
    if (documentoId && e.ttl_documento_id !== documentoId) return false;
    return true;
  });
}

export function revocarEnlaceTtlResiliente(usuarioId: string, tokenOId: string) {
  const enlace = memoriaBilleteraGlobal.enlacesTtl.find(e => 
    e.ttl_usuario_id === usuarioId && (e.ttl_token === tokenOId || e.ttl_id === tokenOId)
  );
  if (enlace) {
    enlace.ttl_activo = false;
    return true;
  }
  return false;
}
