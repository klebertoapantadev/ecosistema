import type { Metadata } from "next";
import { EliminarCuenta, HistorialAccesos, obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const metadata: Metadata = { title: "Mi cuenta — tinkay" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual("tinkay");
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id, 10, "tinkay") : [];

  return (
    <div>
      <h1>Mi cuenta</h1>
      <HistorialAccesos historial={historial} />
      <EliminarCuenta negocio="tinkay" />
    </div>
  );
}
