import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, VerificacionCorreo } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const metadata: Metadata = { title: "Verificar correo — tranqi" };

export default async function PaginaVerificarCorreo() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");

  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  // Si el usuario ingresó por Google OAuth, su correo ya fue verificado por Google
  const esGoogle =
    user?.app_metadata?.provider === "google" ||
    user?.app_metadata?.providers?.includes("google");

  if (perfil.usu_correo_verificado_en || esGoogle) {
    if (esGoogle && !perfil.usu_correo_verificado_en) {
      await supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({ usu_correo_verificado_en: new Date().toISOString() })
        .eq("usu_id", perfil.usu_id);
    }

    const cookieStore = await cookies();
    const intencionCookie = cookieStore.get("tranqi_intencion")?.value;
    const destinoCookie = cookieStore.get("tranqi_destino")?.value;

    const esAbogado = intencionCookie === "abogado" || destinoCookie?.includes("solicitud-socio");
    const destinoFinal = destinoCookie || (esAbogado ? "/panel/solicitud-socio" : "/panel");

    if (!perfil.usu_onboarding_completo) {
      redirect("/bienvenida");
    }

    redirect(destinoFinal);
  }

  return (
    <div className="pagina-mfa">
      <h1>Verifica tu correo</h1>
      <VerificacionCorreo correo={perfil.usu_correo} negocio="tranqi" nombres={perfil.usu_nombres} />
    </div>
  );
}
