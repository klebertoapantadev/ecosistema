import type { Metadata } from "next";
import { EliminarCuenta, HistorialAccesos, obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { cerrarSesionYRedirigir } from "../acciones";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  return (
    <div>
      <h1>Mi cuenta</h1>
      <div className="tarjeta-panel">
        <h2>Sesión</h2>
        <p>{perfil?.usu_correo}</p>
        <form action={cerrarSesionYRedirigir}>
          <button type="submit" className="btn-mini">Cerrar sesión</button>
        </form>
      </div>
      <HistorialAccesos historial={historial} />
      <EliminarCuenta />
    </div>
  );
}
