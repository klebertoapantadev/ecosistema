import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Bell } from "lucide-react";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { EmisionNotificacionesWidget } from "@eco/notificaciones";

export const metadata: Metadata = { title: "Emisión Notificaciones — tranqi" };

const NEGOCIO = "tranqi";

export default async function EmisionNotificacionesPage() {
  const perfil = await obtenerPerfilActual();
  const perfiles = await obtenerPerfiles(NEGOCIO);
  const esAutorizado = Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR");

  if (!esAutorizado) {
    return (
      <div className="contenedor-panel" style={{ maxWidth: "780px", margin: "40px auto", padding: "0 16px" }}>
        <section className="tarjeta-seccion" style={{ borderLeft: "4px solid #ef4444", padding: "36px 28px", textAlign: "center", background: "#0d1117" }}>
          <ShieldAlert style={{ width: 52, height: 52, color: "#ef4444", margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f87171", marginBottom: "8px" }}>
            Acceso Restringido — Consola de Emisión
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#8b949e", lineHeight: 1.6, marginBottom: "16px" }}>
            Tu usuario <strong style={{ color: "#c9d1d9" }}>{perfil?.usu_correo}</strong> cuenta únicamente con el perfil <strong style={{ color: "#a5d6ff" }}>CLIENTE</strong>.
          </p>
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", padding: "14px", marginBottom: "24px", fontSize: "0.8rem", color: "#8b949e", textAlign: "left" }}>
            <span style={{ color: "#388bfd", fontWeight: 700, display: "block", marginBottom: "4px" }}>
              ℹ️ Política de Seguridad de Notificaciones:
            </span>
            La emisión masiva y despacho multicanal (In-App, Push, Email y WhatsApp) está estrictamente restringida a <strong>SuperAdministradores</strong> y <strong>Administradores del Negocio</strong>. Los clientes únicamente tienen acceso a consultar y gestionar sus notificaciones recibidas.
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/panel/notificaciones"
              style={{
                fontSize: "0.82rem",
                color: "#fff",
                background: "#1f6feb",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Bell size={16} /> Ver Mis Notificaciones Recibidas
            </Link>
            <Link
              href="/panel"
              style={{
                fontSize: "0.82rem",
                color: "#c9d1d9",
                background: "#21262d",
                border: "1px solid #30363d",
                borderRadius: "6px",
                padding: "8px 16px",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ArrowLeft size={16} /> Volver al Panel Principal
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <EmisionNotificacionesWidget negocio={NEGOCIO} />
    </div>
  );
}
