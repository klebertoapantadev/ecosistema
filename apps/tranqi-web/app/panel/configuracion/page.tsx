import type { Metadata } from "next";
import { obtenerConfiguracionNegocio } from "@/modulos/configuracion-negocio/consultas";
import { FormularioConfiguracionNegocio } from "@/modulos/configuracion-negocio/componentes/FormularioConfiguracionNegocio";

export const metadata: Metadata = { title: "Configuración del negocio — tranqi" };

export default async function PaginaConfiguracionNegocio() {
  const configuracion = await obtenerConfiguracionNegocio();

  return (
    <div>
      <h1>Configuración del negocio</h1>
      <FormularioConfiguracionNegocio inicial={configuracion} />
    </div>
  );
}
