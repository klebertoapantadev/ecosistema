import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, VerificacionCorreo } from "@eco/identidad";

export const metadata: Metadata = { title: "Verificar correo — tinkay" };

export default async function PaginaVerificarCorreo() {
  const perfil = await obtenerPerfilActual("tinkay");
  if (!perfil) redirect("/ingresar");
  if (perfil.usu_correo_verificado_en) {
    const cookieStore = await cookies();
    const destinoCookie = cookieStore.get("tranqi_destino")?.value;
    const destinoDecodificado = destinoCookie ? decodeURIComponent(destinoCookie) : "";
    const destinoSeguro =
      destinoDecodificado.startsWith("/") && !destinoDecodificado.startsWith("//")
        ? destinoDecodificado
        : "/panel";
    redirect(destinoSeguro);
  }

  return (
    <div className="pagina-mfa">
      <h1>Verifica tu correo</h1>
      <VerificacionCorreo correo={perfil.usu_correo} negocio="tinkay" nombres={perfil.usu_nombres} />
    </div>
  );
}
