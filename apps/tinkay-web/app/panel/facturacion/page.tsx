import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WidgetFacturacionElectronica } from "@eco/comercio";
import { obtenerPerfilActual, obtenerPerfiles, obtenerWidgetsVisibles } from "@eco/identidad";

export const metadata: Metadata = {
  title: "Facturación Electrónica SRI y Cobros — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaFacturacionTinkay() {
  const perfil = await obtenerPerfilActual(NEGOCIO);
  if (!perfil) redirect("/ingresar");

  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdmin =
    Boolean(perfil.usu_superadmin_plataforma) ||
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "familiammtg@gmail.com" ||
    correo === "jesus251296@gmail.com" ||
    correo === "tinkay.uio@gmail.com";

  const [perfiles, widgets] = await Promise.all([
    obtenerPerfiles(NEGOCIO),
    obtenerWidgetsVisibles(perfil.usu_id, esSuperAdmin, NEGOCIO),
  ]);

  const esOperadorOAdmin =
    esSuperAdmin ||
    perfiles.some((p) =>
      ["ADMINISTRADOR", "SUPERADMIN", "OPERADOR", "VENTAS", "VENDEDOR"].includes(
        p.toUpperCase().trim(),
      ),
    ) ||
    widgets.some((w) =>
      ["facturacion_electronica", "gestion_usuarios", "configuracion_negocio"].includes(
        w.wdg_clave,
      ),
    );

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <WidgetFacturacionElectronica
        negocio={NEGOCIO}
        modoVistaForzado={esOperadorOAdmin ? "operador" : "cliente"}
      />
    </div>
  );
}
