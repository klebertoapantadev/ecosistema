import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";

export const metadata: Metadata = { title: "Panel — Margaritas Floristería" };

const NEGOCIO = "margaritas";

export default async function PaginaPanel() {
  const perfil = await obtenerPerfilActual();
  const correo = perfil?.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdmin =
    Boolean(perfil?.usu_superadmin_plataforma) ||
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "jesus251296@gmail.com" ||
    correo === "familiammtg@gmail.com";
  const widgets = perfil
    ? await obtenerWidgetsVisibles(perfil.usu_id, esSuperAdmin, NEGOCIO)
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
