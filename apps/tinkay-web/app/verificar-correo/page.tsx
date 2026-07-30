import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerPerfilActual, VerificacionCorreo } from "@eco/identidad";

export const metadata: Metadata = { title: "Verificar correo — tinkay" };

export default async function PaginaVerificarCorreo() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  if (perfil.usu_correo_verificado_en) redirect("/panel");

  return (
    <div className="pagina-mfa">
      <h1>Verifica tu correo</h1>
      <VerificacionCorreo correo={perfil.usu_correo} nombres={perfil.usu_nombres} />
    </div>
  );
}
