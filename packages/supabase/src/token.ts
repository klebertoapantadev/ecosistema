import { createClient } from "@supabase/supabase-js";
import type { Database } from "@eco/db";

/**
 * Cliente que actua EN NOMBRE de un usuario concreto usando un access token ya
 * acuñado, sin cookies ni sesion de navegador.
 *
 * Existe para los servidores MCP de los asistentes: corren en un Route Handler
 * al que ARIA llama de servidor a servidor, asi que no hay cookie que leer,
 * pero las consultas TIENEN que ir bajo la identidad del usuario para que RLS
 * decida. La alternativa —service_role y filtrar a mano por usuario— se
 * descarto: se salta RLS entero y convierte cada `where` olvidado en una fuga.
 *
 * `persistSession: false` y `autoRefreshToken: false` porque no hay nada que
 * persistir ni que refrescar: el token dura un par de minutos y muere con la
 * peticion. Sin esto, supabase-js intentaria escribir en un storage que en el
 * servidor no existe.
 */
export function crearClienteConToken(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
}

export type ClienteConToken = ReturnType<typeof crearClienteConToken>;
