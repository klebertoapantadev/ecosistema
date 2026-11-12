import type { Metadata } from "next";
import { FormularioAria, obtenerAriaNegocio } from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Agente Conversacional ARIA — Tranqi" };
export const dynamic = "force-dynamic";

const NEGOCIO = "tranqi";

export default async function PaginaConfiguracionAriaTranqi() {
  const aria = await obtenerAriaNegocio(NEGOCIO);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "8px 0" }}>
      <h1>Agente Conversacional ARIA</h1>
      <p className="texto-apoyo">
        Configura los parámetros de conexión de ARIA propios de Tranqi (<code>ARIA_BASE</code>,{" "}
        <code>ARIA_AGENT_ID</code> y <code>ARIA_AGENT_KEY</code> cifrada en Supabase Vault). Si no
        activas un agente aquí, el sistema utilizará como respaldo las variables de entorno del servidor.
      </p>
      <FormularioAria inicial={aria} negocio={NEGOCIO} />
    </div>
  );
}

