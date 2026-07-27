import type { Metadata } from "next";
import { EliminarCuenta, HistorialAccesos, obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const metadata: Metadata = { title: "Mi cuenta — Margaritas Floristería" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  return (
    <div>
      <h1>Mi cuenta</h1>
      <HistorialAccesos historial={historial} />
      <EliminarCuenta />
    </div>
  );
}
