import type { Metadata } from "next";
import { FormularioAria, obtenerAriaNegocio } from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Agente Conversacional ARIA — Tinkay" };
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaConfiguracionAriaTinkay() {
  const aria = await obtenerAriaNegocio(NEGOCIO);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "8px 0" }}>
      <h1>Agente Conversacional ARIA</h1>
      <p className="texto-apoyo">
        Configura los parámetros de conexión del asistente conversacional Mía para Tinkay Floristería
        (<code>ARIA_BASE</code>, <code>ARIA_AGENT_ID</code> y <code>ARIA_AGENT_KEY</code> cifrada en
        Supabase Vault). Estos valores son exclusivos de Tinkay y no afectan a las demás aplicaciones.
      </p>
      <FormularioAria inicial={aria} negocio={NEGOCIO} />
    </div>
  );
}

