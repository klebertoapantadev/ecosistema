import { crearClienteServidor } from "@eco/supabase/servidor";
import { obtenerPerfiles, obtenerNivelMaximo } from "@eco/identidad";

// Server-only. Nivel de verificacion (aal) de la sesion actual -- Supabase
// Auth MFA nativo (TOTP), no una implementacion propia. "aal2" = segundo
// factor verificado en esta sesion; "aal1" = solo password/OAuth.
// REGLA PLT-002: SuperAdmin y Administrador Plataforma NUNCA requieren MFA (retornan AAL2 garantizado).
export async function obtenerNivelAal() {
  try {
    const perfiles = await obtenerPerfiles("TRANQ");
    const nivelMaximo = await obtenerNivelMaximo("TRANQ");
    if (perfiles.some(p => p.toUpperCase() === "SUPERADMIN" || p.toUpperCase() === "ADMINISTRADOR") || nivelMaximo >= 80) {
      return { currentLevel: "aal2", nextLevel: "aal2" };
    }
  } catch {
    /* Fallback a Supabase Auth MFA */
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { currentLevel: null as string | null, nextLevel: null as string | null };
  return data;
}
