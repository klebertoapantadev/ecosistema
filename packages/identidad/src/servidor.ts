import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@eco/db";
import { crearClienteAdmin } from "@eco/supabase/servidor";
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
    const oauthErrorDesc = searchParams.get("error_description") || searchParams.get("error");
    const destinoCookie = request.cookies.get("tranqi_destino")?.value;
    const destinoDecodificado = destinoCookie ? decodeURIComponent(destinoCookie) : "";
    const siguiente = searchParams.get("next") || destinoDecodificado || "/panel";

    if (oauthErrorDesc && !code) {
      return NextResponse.redirect(
        `${origin}/ingresar?error=${encodeURIComponent(oauthErrorDesc)}`
      );
    }

    if (code) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
      const key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        "";

      const cookiesPendientes: Array<{
        name: string;
        value: string;
        options?: Record<string, unknown>;
      }> = [];

      const supabase = createServerClient<Database>(url, key, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              cookiesPendientes.push({ name, value, options });
            });
          },
        },
      });

      const redirigirConCookies = (urlDestino: string) => {
        const respuesta = NextResponse.redirect(urlDestino);
        for (const c of cookiesPendientes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          respuesta.cookies.set(c.name, c.value, c.options as any);
        }
        return respuesta;
      };

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await asegurarMembresiaCliente(supabase as any, data.user.id, negocioCanon);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await asegurarTerminosAceptados(supabase as any, data.user.id);

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

        // Guardar únicamente columnas con GRANT UPDATE para authenticated (usu_correo_verificado_en se confirma vía RPC SECURITY DEFINER abajo)
        await db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({
            usu_detalle_usuario: {
              ...detallePrevio,
              registros_negocio: mapaRegistros,
            },
            usu_actualizado_en: ahoraIso,
          })
          .eq("usu_id", data.user.id);

        // Reclamar de forma atómica cualquier invitación de rol pendiente y confirmar correo verificado de OAuth en DB
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.schema("comun_seguridad") as any).rpc(
            "seg_fn_sincronizar_acceso_rol_tinkay",
            {
              p_negocio: negocioCanon,
              p_crear_cliente_si_no_existe: false,
            }
          );
        } catch {
          // Ignorar si la migración aún no está desplegada
        }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await registrarAcceso(supabase as any, data.user.id, ip, request.headers.get("user-agent"), negocioCanon);
        const rutaDestinoSegura = siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/panel";
        if (faltaOnboarding) {
          return redirigirConCookies(
            `${origin}/bienvenida?destino=${encodeURIComponent(rutaDestinoSegura)}`
          );
        }
        return redirigirConCookies(`${origin}${rutaDestinoSegura}`);
      }

      if (error) {
        console.error("[oauth-callback] exchangeCodeForSession error:", error.message);
        return NextResponse.redirect(
          `${origin}/ingresar?error=${encodeURIComponent(error.message || "No se pudo iniciar sesión con Google")}`
        );
      }
    }

    return NextResponse.redirect(`${origin}/ingresar?error=No se pudo iniciar sesión con Google`);
  };
}
