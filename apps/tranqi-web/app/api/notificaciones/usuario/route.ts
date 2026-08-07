import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

interface RegistroNotificacion {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal?: string;
}

interface SupabaseTypedClient {
  schema(schema: string): {
    from(table: string): {
      select(cols: string): {
        eq(col: string, val: string): {
          order(col: string, opts: { ascending: boolean }): {
            limit(n: number): Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
  };
}

export async function GET() {
  try {
    const perfil = await obtenerPerfilActual();
    const notificaciones: RegistroNotificacion[] = [];

    if (perfil) {
      try {
        const rawSupabase = await crearClienteServidor();
        const supabase = rawSupabase as unknown as SupabaseTypedClient;

        const { data: registros } = await supabase
          .schema("comun_notificaciones")
          .from("not_registro")
          .select("not_id, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_creado_en, not_canal")
          .eq("not_usuario_id", perfil.usu_id)
          .order("not_creado_en", { ascending: false })
          .limit(20);

        if (registros && Array.isArray(registros)) {
          (registros as unknown as RegistroNotificacion[]).forEach(r => {
            notificaciones.push({
              not_id: r.not_id,
              not_titulo: r.not_titulo,
              not_contenido_html: r.not_contenido_html,
              not_url_accion: r.not_url_accion || "/panel",
              not_leido_en: r.not_leido_en,
              not_creado_en: r.not_creado_en,
              not_canal: r.not_canal || "IN_APP"
            });
          });
        }
      } catch {
        /* Fallback */
      }
    }

    return NextResponse.json({ success: true, notificaciones });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener notificaciones";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
