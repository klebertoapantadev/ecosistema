import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerWidgetsVisiblesTranqi } from "@/modulos/identidad/consultas";

export const metadata: Metadata = { title: "Panel — tranqi" };

export default async function PaginaPanel() {
  const perfil = await obtenerPerfilActual();
  const widgets = perfil
    ? await obtenerWidgetsVisiblesTranqi(perfil.usu_id, perfil.usu_superadmin_plataforma)
    : [];

  return (
    <div>
      <h1>Hola, {perfil?.usu_nombres || perfil?.usu_correo}</h1>
      <p>Tienes acceso a {widgets.length} función{widgets.length === 1 ? "" : "es"} en este panel.</p>
    </div>
  );
}
