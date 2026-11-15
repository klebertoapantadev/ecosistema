import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { asegurarMembresiaCliente, asegurarTerminosAceptados } from "./acciones";
import { registrarAcceso } from "./acceso";
import {
  claveNegocioCanonica,
  codigosNegocio,
  obtenerRegistroNegocioDetalle,
  resolverOnboardingNegocio,
} from "./negocio";

export function crearManejadorCallbackOAuth(negocio: string) {
  const negocioCanon = claveNegocioCanonica(negocio);

  return async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const siguiente = searchParams.get("next") ?? "/panel";

    if (code) {
      const supabase = await crearClienteServidor();
      const { error, data } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        const db = crearClienteAdmin() ?? supabase;
        const [{ data: usuarioPrevio }, { data: membresiaPrevia }] = await Promise.all([
          db
            .schema("comun_seguridad")
            .from("seg_usuario")
            .select(
              "usu_correo_verificado_en, usu_onboarding_completo, usu_superadmin_plataforma, usu_nombres, usu_apellidos, usu_correo, usu_detalle_usuario"
            )
            .eq("usu_id", data.user.id)
            .maybeSingle(),
          db
            .schema("comun_seguridad")
            .from("seg_membresia")
            .select("mem_id, mem_estado")
            .eq("mem_usuario_id", data.user.id)
            .in("mem_negocio", codigosNegocio(negocioCanon))
            .eq("mem_estado", "ACTIVO")
            .limit(1)
            .maybeSingle(),
        ]);

        const teniaMembresiaNegocio = Boolean(membresiaPrevia);
        const faltaOnboarding = !resolverOnboardingNegocio(
          usuarioPrevio,
          teniaMembresiaNegocio,
          negocioCanon
        );

        await asegurarMembresiaCliente(supabase, data.user.id, negocioCanon);
        await asegurarTerminosAceptados(supabase, data.user.id);

        const ahoraIso = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detallePrevio = (usuarioPrevio?.usu_detalle_usuario as Record<string, any>) || {};
        const mapaRegistros =
          detallePrevio.registros_negocio && typeof detallePrevio.registros_negocio === "object"
            ? { ...detallePrevio.registros_negocio }
            : {};
        const regActual = obtenerRegistroNegocioDetalle(detallePrevio, negocioCanon);

        // Si entra por primera vez a ESTE negocio con Google, inicializar su sub-registro
        // con onboarding_completo = false para exigir bienvenida + consentimiento WhatsApp propio del negocio.
        if (!teniaMembresiaNegocio && faltaOnboarding) {
          mapaRegistros[negocioCanon] = {
            ...(regActual || {}),
            nombres:
              regActual?.nombres ||
              data.user.user_metadata?.given_name ||
              usuarioPrevio?.usu_nombres ||
              null,
            apellidos:
              regActual?.apellidos ||
              data.user.user_metadata?.family_name ||
              usuarioPrevio?.usu_apellidos ||
              null,
            onboarding_completo: false,
            notificado_registro_staff: false,
            registrado_en: ahoraIso,
          };
        }

        // Google OAuth ya verificó la identidad del correo. Auto-confirmar en DB
        await db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({
            usu_correo_verificado_en: usuarioPrevio?.usu_correo_verificado_en || ahoraIso,
            usu_detalle_usuario: {
              ...detallePrevio,
              registros_negocio: mapaRegistros,
            },
            usu_actualizado_en: ahoraIso,
          })
          .eq("usu_id", data.user.id);

        // Si ya es SuperAdmin o tenía onboarding completo sin notificar aún en este negocio
        if (!teniaMembresiaNegocio && !faltaOnboarding) {
          const { notificarNuevoUsuarioRegistrado } = await import("@eco/notificaciones/notificar-usuario");
          await notificarNuevoUsuarioRegistrado({
            usuarioId: data.user.id,
            nombres: usuarioPrevio?.usu_nombres || data.user.user_metadata?.given_name || "",
            apellidos: usuarioPrevio?.usu_apellidos || data.user.user_metadata?.family_name || "",
            correo: data.user.email || "",
            negocio: negocioCanon,
          });
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await registrarAcceso(supabase, data.user.id, ip, request.headers.get("user-agent"), negocioCanon);
        const rutaDestinoSegura = siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/panel";
        if (faltaOnboarding) {
          return NextResponse.redirect(
            `${origin}/bienvenida?destino=${encodeURIComponent(rutaDestinoSegura)}`
          );
        }
        return NextResponse.redirect(`${origin}${rutaDestinoSegura}`);
      }
    }

    return NextResponse.redirect(`${origin}/ingresar?error=No se pudo iniciar sesión con Google`);
  };
}
