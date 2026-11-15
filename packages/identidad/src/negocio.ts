export type NegocioCanonico = "tranqi" | "tinkay" | "fastfix" | "margaritas";

const MAPA_CODIGOS_NEGOCIO: Record<NegocioCanonico, readonly string[]> = {
  tranqi: ["tranqi", "TRANQI", "tranq", "TRANQ", "legal", "LEGAL"],
  tinkay: ["tinkay", "TINKAY", "tnk", "TNK"],
  fastfix: ["fastfix", "FASTFIX", "ffh", "FFH"],
  margaritas: ["margaritas", "MARGARITAS", "mrg", "MRG"],
};

const NOMBRES_VISIBLES_NEGOCIO: Record<NegocioCanonico, string> = {
  tranqi: "Tranqi",
  tinkay: "Tinkay",
  fastfix: "FastFix Home",
  margaritas: "Margaritas Floristería",
};

const CODIGO_NOTIFICACION_NEGOCIO: Record<NegocioCanonico, string> = {
  tranqi: "TRANQ",
  tinkay: "TINKAY",
  fastfix: "FASTFIX",
  margaritas: "MARGARITAS",
};

/**
 * Normaliza cualquier alias ("TNK", "TINKAY", "tinkay", "TRANQ", etc.)
 * a su slug canónico en minúsculas ("tinkay", "tranqi", "fastfix", "margaritas").
 */
export function claveNegocioCanonica(negocio: string | null | undefined): string {
  const limpio = (negocio || "").trim().toLowerCase();
  if (!limpio) return "tranqi";
  if (limpio === "tranqi" || limpio === "tranq" || limpio === "legal") return "tranqi";
  if (limpio === "tinkay" || limpio === "tnk") return "tinkay";
  if (limpio === "fastfix" || limpio === "ffh") return "fastfix";
  if (limpio === "margaritas" || limpio === "mrg") return "margaritas";
  return limpio;
}

/**
 * Retorna estrictamente las variantes válidas en BDD para un negocio específico,
 * sin mezclar jamás códigos de otro negocio.
 */
export function codigosNegocio(negocio: string | null | undefined): string[] {
  const canon = claveNegocioCanonica(negocio) as NegocioCanonico;
  if (canon in MAPA_CODIGOS_NEGOCIO) {
    return [...MAPA_CODIGOS_NEGOCIO[canon]];
  }
  const base = (negocio || "").trim();
  if (!base) return [...MAPA_CODIGOS_NEGOCIO.tranqi];
  return Array.from(new Set([base.toLowerCase(), base.toUpperCase()]));
}

export function perteneceAlNegocio(
  valorBd: string | null | undefined,
  negocioObjetivo: string | null | undefined
): boolean {
  if (!valorBd || !negocioObjetivo) return false;
  return claveNegocioCanonica(valorBd) === claveNegocioCanonica(negocioObjetivo);
}

export function nombreVisibleNegocio(negocio: string | null | undefined): string {
  const canon = claveNegocioCanonica(negocio) as NegocioCanonico;
  return NOMBRES_VISIBLES_NEGOCIO[canon] ?? ((negocio || "").trim() || "Plataforma");
}

export function codigoNotificacionNegocio(negocio: string | null | undefined): string {
  const canon = claveNegocioCanonica(negocio) as NegocioCanonico;
  return CODIGO_NOTIFICACION_NEGOCIO[canon] ?? ((negocio || "").trim().toUpperCase() || "TRANQ");
}

export interface RegistroPerfilNegocio {
  nombres?: string | null;
  apellidos?: string | null;
  whatsapp?: string | null;
  codigo_pais_whatsapp?: string | null;
  autoriza_whatsapp?: boolean;
  onboarding_completo?: boolean;
  terminos_version?: string | null;
  terminos_aceptados_en?: string | null;
  notificado_registro_staff?: boolean;
  registrado_en?: string | null;
  actualizado_en?: string | null;
  consentimiento_whatsapp_info?: {
    autorizado: boolean;
    finalidad: string;
    aceptado_en: string;
    negocio: string;
  } | null;
}

/**
 * Extrae el sub-perfil registrado específicamente en un negocio dentro de `usu_detalle_usuario.registros_negocio`.
 */
export function obtenerRegistroNegocioDetalle(
  detalleUsuario: unknown,
  negocio: string | null | undefined
): RegistroPerfilNegocio | null {
  if (!detalleUsuario || typeof detalleUsuario !== "object") return null;
  const canon = claveNegocioCanonica(negocio);
  const mapa = (detalleUsuario as Record<string, unknown>).registros_negocio;
  if (!mapa || typeof mapa !== "object") return null;
  const reg = (mapa as Record<string, unknown>)[canon];
  if (!reg || typeof reg !== "object") return null;
  return reg as RegistroPerfilNegocio;
}

/**
 * Determina si un usuario completó el onboarding/consentimiento propio de `negocio`.
 * - Si es SuperAdmin de plataforma: siempre true.
 * - Si no tiene membresía activa en `negocio`: false.
 * - Si existe `registros_negocio[canon]`: usa estrictamente `registros_negocio[canon].onboarding_completo`.
 * - Si existen `registros_negocio` de OTROS negocios pero NO de `canon`: false (evita saltar bienvenida al cambiar de negocio).
 * - Si `registros_negocio` está vacío (usuario legado previo a aislamiento por negocio) y ya tenía membresía activa en `negocio`:
 *   respeta `usu_onboarding_completo` global para no interrumpir cuentas históricas de ese mismo negocio.
 */
export function resolverOnboardingNegocio(
  usuario: {
    usu_onboarding_completo?: boolean | null;
    usu_superadmin_plataforma?: boolean | null;
    usu_detalle_usuario?: unknown;
  } | null,
  tieneMembresiaActivaEnNegocio: boolean,
  negocio: string
): boolean {
  if (!usuario) return false;
  if (usuario.usu_superadmin_plataforma) return true;
  if (!tieneMembresiaActivaEnNegocio) return false;

  const detalle =
    usuario.usu_detalle_usuario && typeof usuario.usu_detalle_usuario === "object"
      ? (usuario.usu_detalle_usuario as Record<string, unknown>)
      : {};
  const mapa =
    detalle.registros_negocio && typeof detalle.registros_negocio === "object"
      ? (detalle.registros_negocio as Record<string, unknown>)
      : null;

  const canon = claveNegocioCanonica(negocio);
  if (mapa && canon in mapa) {
    const reg = mapa[canon] as RegistroPerfilNegocio | null;
    return Boolean(reg?.onboarding_completo);
  }

  if (mapa && Object.keys(mapa).length > 0) {
    return false;
  }

  return Boolean(usuario.usu_onboarding_completo);
}

/**
 * Proyecta sobre la fila `seg_usuario` los datos de identidad y consentimiento propios de `negocio`
 * sin contaminar con datos registrados en otros negocios.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function proyectarPerfilPorNegocio<T extends Record<string, any>>(
  perfil: T | null,
  negocio?: string,
  tieneMembresiaActivaEnNegocio: boolean = true
): T | null {
  if (!perfil) return null;
  if (!negocio) return perfil;

  const detalle =
    perfil.usu_detalle_usuario && typeof perfil.usu_detalle_usuario === "object"
      ? (perfil.usu_detalle_usuario as Record<string, unknown>)
      : {};
  const mapa =
    detalle.registros_negocio && typeof detalle.registros_negocio === "object"
      ? (detalle.registros_negocio as Record<string, unknown>)
      : null;

  const reg = obtenerRegistroNegocioDetalle(detalle, negocio);
  const onboardingNegocio = resolverOnboardingNegocio(
    perfil,
    tieneMembresiaActivaEnNegocio,
    negocio
  );

  if (reg) {
    return {
      ...perfil,
      usu_nombres: reg.nombres ?? perfil.usu_nombres ?? null,
      usu_apellidos: reg.apellidos ?? perfil.usu_apellidos ?? null,
      usu_whatsapp: reg.autoriza_whatsapp ? (reg.whatsapp ?? null) : null,
      usu_autorizacion_whatsapp: Boolean(reg.autoriza_whatsapp),
      usu_onboarding_completo: onboardingNegocio,
    };
  }

  // Si tiene registros en otros negocios pero NO en este, no heredar el WhatsApp ni consentimiento de otro negocio
  if (mapa && Object.keys(mapa).length > 0 && !perfil.usu_superadmin_plataforma) {
    return {
      ...perfil,
      usu_whatsapp: null,
      usu_autorizacion_whatsapp: false,
      usu_onboarding_completo: onboardingNegocio,
    };
  }

  return {
    ...perfil,
    usu_onboarding_completo: onboardingNegocio,
  };
}
