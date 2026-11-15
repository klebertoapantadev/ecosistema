"use client";

import { useState, useTransition } from "react";
import { Mail, Send, Trash2, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import {
  invitarUsuarioPorCorreoAction,
  eliminarInvitacionEquipoAction,
  type InvitacionEquipoPortal,
  type RolEquipoPortal,
} from "../acciones";

const OPCIONES_ROL: Array<{
  clave: RolEquipoPortal;
  etiqueta: string;
  resumen: string;
  colorFondo: string;
  colorTexto: string;
}> = [
  {
    clave: "VENTAS",
    etiqueta: "Ventas / Asesor Comercial",
    resumen: "Acceso a Pedidos de Tienda, Proformas de Eventos (V2/V3), Catálogo y Testimonios.",
    colorFondo: "#EFF6FF",
    colorTexto: "#1D4ED8",
  },
  {
    clave: "OPERADOR",
    etiqueta: "Operador / Taller Floral",
    resumen: "Acceso a Pedidos, Taller Floral, Hoja de Ruta, Catálogo y Cobertura Logística.",
    colorFondo: "#F0FDF4",
    colorTexto: "#15803D",
  },
  {
    clave: "DELIVERY",
    etiqueta: "Delivery / Repartidor",
    resumen: "Acceso exclusivo a Despachos, Destinatarios, Enlace GPS (Waze/Maps) y Estado de Ruta.",
    colorFondo: "#FEF3C7",
    colorTexto: "#B45309",
  },
  {
    clave: "ADMINISTRADOR",
    etiqueta: "Administrador de Tienda",
    resumen: "Acceso completo a Operación, Usuarios/Roles y Configuración de Tienda.",
    colorFondo: "#F3E8FF",
    colorTexto: "#6B21A8",
  },
];

export function FormularioInvitacionEquipo({
  negocio = "tinkay",
  invitacionesIniciales = [],
}: {
  negocio?: string;
  invitacionesIniciales?: InvitacionEquipoPortal[];
}) {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolEquipoPortal>("VENTAS");
  const [invitaciones, setInvitaciones] = useState<InvitacionEquipoPortal[]>(invitacionesIniciales);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rolSeleccionadoInfo =
    OPCIONES_ROL.find((r) => r.clave === rol) ?? OPCIONES_ROL[0]!;

  function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    setMensajeExito(null);
    setMensajeError(null);

    startTransition(async () => {
      const res = await invitarUsuarioPorCorreoAction({
        correo,
        nombre,
        rol,
        negocio,
      });

      if (!res.ok || !res.data) {
        setMensajeError(res.error || "No se pudo enviar la invitación.");
        return;
      }

      const nueva = res.data.invitacion;
      setInvitaciones((prev) => [
        nueva,
        ...prev.filter((i) => i.correo.toLowerCase() !== nueva.correo.toLowerCase()),
      ]);
      setCorreo("");
      setNombre("");
      setMensajeExito(
        res.mensaje ||
          `Invitación enviada a ${nueva.correo} con el rol ${rolSeleccionadoInfo.etiqueta}.`
      );
    });
  }

  function manejarEliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarInvitacionEquipoAction(id, negocio);
      if (res.ok) {
        setInvitaciones((prev) => prev.filter((i) => i.id !== id));
      }
    });
  }

  return (
    <section
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5DFD5",
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        boxShadow: "0 4px 18px rgba(28, 38, 31, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#F5F2EB",
              color: "#2D3D30",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mail size={18} />
          </span>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#1C261F",
              }}
            >
              Invitar Miembro del Equipo por Correo
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#6B746C" }}>
              Envía una invitación al correo electrónico definiendo su nivel de acceso en el portal (Ventas, Operador, Delivery o Administrador).
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={manejarEnvio}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#4A544C",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Correo Electrónico *
          </label>
          <input
            type="email"
            required
            placeholder="ejemplo@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #D6CFC2",
              fontSize: "0.88rem",
              color: "#1C261F",
              background: "#FDFBF7",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#4A544C",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Nombre (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ej. María Gómez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #D6CFC2",
              fontSize: "0.88rem",
              color: "#1C261F",
              background: "#FDFBF7",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#4A544C",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Rol en el Portal *
          </label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as RolEquipoPortal)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #D6CFC2",
              fontSize: "0.88rem",
              fontWeight: 600,
              color: "#1C261F",
              background: "#FDFBF7",
              boxSizing: "border-box",
            }}
          >
            {OPCIONES_ROL.map((op) => (
              <option key={op.clave} value={op.clave}>
                {op.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            title="Enviar invitación por correo electrónico con el rol seleccionado"
            aria-label="Enviar invitación por correo electrónico con el rol seleccionado"
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#2D3D30",
              color: "#F5F2EB",
              fontSize: "0.86rem",
              fontWeight: 700,
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.75 : 1,
            }}
          >
            <Send size={15} />
            <span>{isPending ? "Enviando..." : "Enviar Invitación"}</span>
          </button>
        </div>
      </form>

      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 10,
          background: "#F5F2EB",
          border: "1px solid #E5DFD5",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.8rem",
          color: "#2D3D30",
        }}
      >
        <ShieldCheck size={16} style={{ flexShrink: 0, color: "#C27D5F" }} />
        <span>
          <strong>Permisos de {rolSeleccionadoInfo.etiqueta}:</strong> {rolSeleccionadoInfo.resumen}
        </span>
      </div>

      {mensajeExito && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            fontSize: "0.83rem",
            fontWeight: 600,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.83rem",
            fontWeight: 600,
          }}
        >
          {mensajeError}
        </div>
      )}

      {invitaciones.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#6B746C",
              marginBottom: 10,
            }}
          >
            Invitaciones Enviadas ({invitaciones.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {invitaciones.map((inv) => {
              const infoRol =
                OPCIONES_ROL.find((r) => r.clave === inv.rol) ?? OPCIONES_ROL[0]!;
              return (
                <div
                  key={inv.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #E5DFD5",
                    background: "#FDFBF7",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "#1C261F" }}>
                      {inv.nombre ? `${inv.nombre} (${inv.correo})` : inv.correo}
                    </span>
                    <span
                      style={{
                        padding: "3px 9px",
                        borderRadius: 999,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: infoRol.colorFondo,
                        color: infoRol.colorTexto,
                      }}
                    >
                      {infoRol.etiqueta}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        color: inv.estado === "ACEPTADA" ? "#15803D" : "#B45309",
                      }}
                    >
                      {inv.estado === "ACEPTADA" ? (
                        <>
                          <CheckCircle2 size={13} /> Activo en portal
                        </>
                      ) : (
                        <>
                          <Clock size={13} /> Pendiente de registro
                        </>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => manejarEliminar(inv.id)}
                    disabled={isPending}
                    title="Revocar invitación de correo"
                    aria-label="Revocar invitación de correo"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      color: "#B91C1C",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Quitar</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
