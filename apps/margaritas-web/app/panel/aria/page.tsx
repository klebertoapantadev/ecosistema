import type { Metadata } from "next";
import { FormularioAria, obtenerAriaNegocio } from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Agente Conversacional ARIA — Margaritas Floristería" };
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaConfiguracionAriaMargaritas() {
  const aria = await obtenerAriaNegocio(NEGOCIO);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "8px 0" }}>
      <h1>Agente Conversacional ARIA</h1>
      <p className="texto-apoyo">
        Configura los parámetros de conexión del agente conversacional ARIA para Margaritas
        Floristería (<code>ARIA_BASE</code>, <code>ARIA_AGENT_ID</code> y <code>ARIA_AGENT_KEY</code>{" "}
        cifrada en Supabase Vault).
      </p>
      <FormularioAria inicial={aria} negocio={NEGOCIO} />
    </div>
  );
}

