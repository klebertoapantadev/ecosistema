import type { Metadata } from "next";
import { User, LogOut, ShieldAlert, History, KeyRound } from "lucide-react";
import {
  EliminarCuenta,
  HistorialAccesos,
  FormularioPerfil,
  obtenerPerfilActual,
  obtenerHistorialAccesos
} from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { cerrarSesionYRedirigir } from "../acciones";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  return (
    <div style={{ color: "#c9d1d9", width: "100%" }}>
      {/* 1. Header Hero Card del Panel */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "24px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Gobernanza de Identidad & Perfil</div>
            <div className="tarjeta-proteccion-plan">
              Mi Cuenta — <i>Identidad Unificada (tranqi)</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Gestión centralizada de datos personales, historial de accesos, preferencias de contacto y seguridad de la cuenta.
            </div>
          </div>
          <span className="badge-rol">
            <User style={{ width: 14, height: 14, marginRight: 4 }} /> Identidad Activa
          </span>
        </div>
      </section>

      {/* 2. Rejilla de 2 Columnas (Dashboard Layout) */}
      <div className="rejilla-cliente">
        {/* Columna Izquierda Principal (60% - 65%) */}
        <div className="columna-cliente">
          {/* Widget 1: Perfil de Usuario & Datos de Contacto */}
          <section className="tarjeta-seccion" aria-labelledby="t-perfil">
            <header>
              <h2 id="t-perfil" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#58a6ff" }}>
                <User size={20} color="#1f6feb" /> Perfil de Usuario & Datos de Contacto
              </h2>
            </header>

            <div style={{ marginTop: "16px" }}>
              <FormularioPerfil
                inicial={{
                  nombres: perfil?.usu_nombres || "",
                  apellidos: perfil?.usu_apellidos || "",
                  correo: perfil?.usu_correo || "",
                  whatsapp: perfil?.usu_whatsapp || "",
                  autorizaWhatsapp: perfil?.usu_autorizacion_whatsapp || false
                }}
              />
            </div>
          </section>

          {/* Widget 2: Historial de Accesos Recientes (PLT-018) */}
          <section className="tarjeta-seccion" aria-labelledby="t-historial" style={{ marginTop: "20px" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 id="t-historial" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#58a6ff" }}>
                <History size={20} color="#1f6feb" /> Historial de Accesos Recientes (PLT-018)
              </h2>
              <span className="chip-registrado" style={{ background: "#1f6feb", color: "#fff", fontWeight: 700 }}>
                {historial.length} Accesos
              </span>
            </header>

            <div style={{ marginTop: "14px" }}>
              {historial.length === 0 ? (
                <div className="vacio-seccion">
                  <b>Sin historial previo de accesos</b>
                  <span>Los registros de inicio de sesión e IP aparecerán reflejados aquí.</span>
                </div>
              ) : (
                <HistorialAccesos historial={historial} />
              )}
            </div>
          </section>
        </div>

        {/* Columna Derecha / Lateral (35% - 40%) */}
        <aside className="columna-cliente">
          {/* Widget 3: Gestión de Sesión & Seguridad */}
          <section className="tarjeta-seccion" aria-labelledby="t-sesion">
            <header>
              <h2 id="t-sesion" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#58a6ff" }}>
                <KeyRound size={20} color="#388bfd" /> Sesión & Seguridad
              </h2>
            </header>

            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "#0d1117", padding: "12px", borderRadius: "8px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Cuenta / Correo Activo:</div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#c9d1d9", marginTop: "2px" }}>
                  {perfil?.usu_correo}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#3fb950", marginTop: "4px" }}>
                  ✓ Autenticado y Verificado
                </div>
              </div>

              <form action={cerrarSesionYRedirigir}>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    background: "#21262d",
                    border: "1px solid #30363d",
                    color: "#f85149",
                    borderRadius: "6px",
                    padding: "10px",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s"
                  }}
                >
                  <LogOut size={16} /> Cerrar Sesión Segura
                </button>
              </form>
            </div>
          </section>

          {/* Widget 4: Zona de Peligro - Eliminar Mi Cuenta (PLT-012) */}
          <section className="tarjeta-seccion" aria-labelledby="t-peligro" style={{ borderLeft: "4px solid #ef4444" }}>
            <header>
              <h2 id="t-peligro" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f87171" }}>
                <ShieldAlert size={20} color="#ef4444" /> Eliminar mi Cuenta (PLT-012)
              </h2>
            </header>

            <div style={{ marginTop: "12px" }}>
              <EliminarCuenta />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
