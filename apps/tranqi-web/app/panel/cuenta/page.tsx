import type { Metadata } from "next";
import { User } from "lucide-react";
import { obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { PanelCuentaModular } from "./PanelCuentaModular";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  return (
    <div style={{ color: "#c9d1d9", width: "100%" }}>
      {/* Header Hero Card del Panel */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Gobernanza de Identidad & Perfil</div>
            <div className="tarjeta-proteccion-plan">
              Mi Cuenta — <i>Identidad Unificada (tranqi)</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Acceso individualizado a widgets, gestión de perfil, historial de accesos y seguridad de la cuenta.
            </div>
          </div>
          <span className="badge-rol">
            <User style={{ width: 14, height: 14, marginRight: 4 }} /> Identidad Activa
          </span>
        </div>
      </section>

      {/* Componente Modular con Galería de Accesos y Sistema de Favoritos */}
      <PanelCuentaModular perfil={perfil} historial={historial} />
    </div>
  );
}
