import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { PanelCuentaModular } from "./PanelCuentaModular";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  return (
    <div style={{ width: "100%" }}>
      {/* Componente Modular con Galería de Accesos, Hero Card condicional y Favoritos */}
      <PanelCuentaModular perfil={perfil} historial={historial} />
    </div>
  );
}
