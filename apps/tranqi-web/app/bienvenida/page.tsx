import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerPerfilActual } from "@/modulos/identidad/consultas";
import { FormularioBienvenida } from "@/modulos/identidad/componentes/FormularioBienvenida";

export const metadata: Metadata = { title: "Hola — tranqi" };

export default async function PaginaBienvenida() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  if (perfil.usu_onboarding_completo) redirect("/panel");

  return (
    <div className="pagina-bienvenida">
      <div className="tarjeta-bienvenida">
        <div className="saludo-bienvenida">hola,</div>
        <p>
          Antes de empezar, confirma cómo quieres que te llamemos — a veces tu cuenta de Google no lo deja del
          todo claro.
        </p>
        <FormularioBienvenida
          nombresIniciales={perfil.usu_nombres ?? ""}
          apellidosIniciales={perfil.usu_apellidos ?? ""}
        />
      </div>
    </div>
  );
}
