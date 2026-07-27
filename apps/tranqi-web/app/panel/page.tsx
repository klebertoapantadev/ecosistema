import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

export default async function PaginaPanel() {
  const perfil = await obtenerPerfilActual();
  const widgets = perfil
    ? await obtenerWidgetsVisibles(perfil.usu_id, perfil.usu_superadmin_plataforma, NEGOCIO)
    : [];

  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre) : null;

  return (
    <div>
      <h1>{saludo ?? `Hola, ${nombre}`}</h1>
      <p>Tienes acceso a {widgets.length} función{widgets.length === 1 ? "" : "es"} en este panel.</p>
    </div>
  );
}
