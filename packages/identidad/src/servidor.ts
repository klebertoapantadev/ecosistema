import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { asegurarMembresiaCliente, asegurarTerminosAceptados } from "./acciones";
import { registrarAcceso } from "./acceso";

export function crearManejadorCallbackOAuth(negocio: string) {
  return async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const siguiente = searchParams.get("next") ?? "/panel";

    if (code) {
      const supabase = await crearClienteServidor();
      const { error, data } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        const { data: usuarioPrevio } = await supabase
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_correo_verificado_en, usu_nombres, usu_apellidos, usu_correo")
          .eq("usu_id", data.user.id)
          .maybeSingle();

        const esNuevo = !usuarioPrevio?.usu_correo_verificado_en;

        await asegurarMembresiaCliente(supabase, data.user.id, negocio);
        await asegurarTerminosAceptados(supabase, data.user.id);

        // Google OAuth ya verificó la identidad del correo. Auto-confirmar en DB
        await supabase
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({ usu_correo_verificado_en: new Date().toISOString() })
          .eq("usu_id", data.user.id)
          .is("usu_correo_verificado_en", null);

        if (esNuevo) {
          const { notificarNuevoUsuarioRegistrado } = await import("@eco/notificaciones/notificar-usuario");
          await notificarNuevoUsuarioRegistrado({
            usuarioId: data.user.id,
            nombres: usuarioPrevio?.usu_nombres || data.user.user_metadata?.given_name || "",
            apellidos: usuarioPrevio?.usu_apellidos || data.user.user_metadata?.family_name || "",
            correo: data.user.email || "",
            negocio,
          });
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await registrarAcceso(supabase, data.user.id, ip, request.headers.get("user-agent"), negocio);
        return NextResponse.redirect(`${origin}${siguiente}`);
      }
    }

    return NextResponse.redirect(`${origin}/ingresar?error=No se pudo iniciar sesión con Google`);
  };
}
