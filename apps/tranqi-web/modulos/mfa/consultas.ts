import { crearClienteServidor } from "@eco/supabase/servidor";

// Server-only. Nivel de verificacion (aal) de la sesion actual -- Supabase
// Auth MFA nativo (TOTP), no una implementacion propia. "aal2" = segundo
// factor verificado en esta sesion; "aal1" = solo password/OAuth.
export async function obtenerNivelAal() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { currentLevel: null as string | null, nextLevel: null as string | null };
  return data;
}
