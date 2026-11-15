import type { Metadata } from "next";
import { EliminarCuenta, HistorialAccesos, obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const metadata: Metadata = { title: "Mi cuenta — FastFix Home" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual("fastfix");
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id, 10, "fastfix") : [];

  return (
    <div>
      <h1>Mi cuenta</h1>
      <HistorialAccesos historial={historial} />
      <EliminarCuenta negocio="fastfix" />
    </div>
  );
}
