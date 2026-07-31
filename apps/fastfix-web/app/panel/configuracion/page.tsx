import type { Metadata } from "next";
import { obtenerConfiguracionNegocio, FormularioConfiguracionNegocio } from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Configuración del negocio — FastFix Home" };

const NEGOCIO = "fastfix";

export default async function PaginaConfiguracionNegocio() {
  const configuracion = await obtenerConfiguracionNegocio(NEGOCIO);

  return (
    <div>
      <h1>Configuración del negocio</h1>
      <FormularioConfiguracionNegocio inicial={configuracion} negocio={NEGOCIO} />
    </div>
  );
}
