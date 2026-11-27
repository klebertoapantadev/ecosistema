"use client";
import { SelectConBuscador } from "@eco/datagrid";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    resumen:
      "Aterriza directo en Ventas y Chats en Vivo. Acceso a Enviar Pedidos, Proformas (V2/V3), Entrega Inmediata e Inventario.",
    colorFondo: "#F4F2EE",
    colorTexto: "#221E1B",
  },
  {
    clave: "TALLER",
    etiqueta: "Taller Floral",
    resumen:
      "Aterriza directo en Taller (sin precios). Actualiza estado (En Preparación / Listo Entrega), Inventario de Rosas y Entrega Inmediata.",
    colorFondo: "#F2F6F3",
    colorTexto: "#2F4737",
  },
  {
    clave: "DELIVERY",
    etiqueta: "Delivery Interno",
    resumen:
      "Aterriza directo en Entregas GPS. Ve pedidos listos y asignados, comparte GPS en ruta y confirma entrega con foto.",
    colorFondo: "#FAF6EE",
    colorTexto: "#745622",
  },
  {
    clave: "DELIVERY_EXTERNO",
    etiqueta: "Delivery Subcontratado",
    resumen:
      "Aterriza directo en Entregas GPS. Ve ÚNICAMENTE los pedidos asignados a su cuenta, comparte GPS en ruta y confirma entrega.",
    colorFondo: "#FAF6EE",
    colorTexto: "#745622",
  },
  {
    clave: "OPERADOR",
    etiqueta: "Operador General",
    resumen:
      "Coordinación integral: Enviar Pedidos, Taller, Entregas e Informes IESS, Inventario, Entrega Inmediata y Logística.",
    colorFondo: "#ECFEFF",
    colorTexto: "#3A3530",
  },
  {
    clave: "ADMINISTRADOR",
    etiqueta: "Administrador de Tienda",
    resumen: "Acceso completo 360° a Operación, Facturación, Usuarios/Roles y Configuración de Tienda.",
    colorFondo: "#F4F2EE",
    colorTexto: "#3A3530",
  },
];

export function FormularioInvitacionEquipo({
  negocio = "tinkay",
  invitacionesIniciales = [],
}: {
  negocio?: string;
  invitacionesIniciales?: InvitacionEquipoPortal[];
}) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolEquipoPortal>("VENTAS");
  const [invitaciones, setInvitaciones] = useState<InvitacionEquipoPortal[]>(invitacionesIniciales);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setInvitaciones(invitacionesIniciales);
  }, [invitacionesIniciales]);

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
      router.refresh();
    });
  }

  function manejarEliminar(id: string, correoInv?: string) {
    setMensajeError(null);
    setMensajeExito(null);
    startTransition(async () => {
      const res = await eliminarInvitacionEquipoAction(id, negocio, correoInv);
      if (!res.ok) {
        setMensajeError(res.error || "No se pudo revocar la invitación.");
        return;
      }
      setInvitaciones((prev) =>
        prev.filter(
          (i) =>
            i.id !== id &&
            (!correoInv || i.correo.toLowerCase() !== correoInv.toLowerCase())
        )
      );
      router.refresh();
    });
  }

  return (
    <section
      style={{
        background: "var(--cf-ffffff, #FFFFFF)",
        border: "1px solid var(--cb-e5dfd5, #E5DFD5)",
        borderRadius: 16,
        padding: "clamp(14px, 3.5vw, 24px)",
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
              background: "var(--cf-f5f2eb, #F5F2EB)",
              color: "var(--ct-2d3d30, #2D3D30)",
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
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--ct-1c261f, #1C261F)",
              }}
            >
              Invitar Miembro del Equipo por Correo
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--ct-6b746c, #6B746C)" }}>
              Envía una invitación definiendo su rol exacto (Ventas, Taller, Delivery Interno, Delivery Subcontratado, Operador o Administrador).
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
              color: "var(--ct-4a544c, #4A544C)",
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
              border: "1px solid var(--cb-d6cfc2, #D6CFC2)",
              fontSize: "0.88rem",
              color: "var(--ct-1c261f, #1C261F)",
              background: "var(--cf-fdfbf7, #FDFBF7)",
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
              color: "var(--ct-4a544c, #4A544C)",
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
              border: "1px solid var(--cb-d6cfc2, #D6CFC2)",
              fontSize: "0.88rem",
              color: "var(--ct-1c261f, #1C261F)",
              background: "var(--cf-fdfbf7, #FDFBF7)",
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
              color: "var(--ct-4a544c, #4A544C)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Rol en el Portal *
          </label>
          <SelectConBuscador
            value={rol}
            onChange={(e) => setRol(e.target.value as RolEquipoPortal)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--cb-d6cfc2, #D6CFC2)",
              fontSize: "0.88rem",
              fontWeight: 600,
              color: "var(--ct-1c261f, #1C261F)",
              background: "var(--cf-fdfbf7, #FDFBF7)",
              boxSizing: "border-box",
            }}
          >
            {OPCIONES_ROL.map((op) => (
              <option key={op.clave} value={op.clave}>
                {op.etiqueta}
              </option>
            ))}
          </SelectConBuscador>
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
          background: "var(--cf-f5f2eb, #F5F2EB)",
          border: "1px solid var(--cb-e5dfd5, #E5DFD5)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.8rem",
          color: "var(--ct-2d3d30, #2D3D30)",
        }}
      >
        <ShieldCheck size={16} style={{ flexShrink: 0, color: "var(--ct-c27d5f, #C27D5F)" }} />
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
            background: "var(--cf-f2f6f3, #F2F6F3)",
            border: "1px solid var(--cb-ceddd3, #CEDDD3)",
            color: "var(--ct-2b4a36, #2B4A36)",
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
            background: "var(--cf-faf2f2, #FAF2F2)",
            border: "1px solid var(--cb-e5caca, #E5CACA)",
            color: "var(--ct-8a2e2e, #8A2E2E)",
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
              color: "var(--ct-6b746c, #6B746C)",
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
                    border: "1px solid var(--cb-e5dfd5, #E5DFD5)",
                    background: "var(--cf-fdfbf7, #FDFBF7)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--ct-1c261f, #1C261F)" }}>
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
                        color: inv.estado === "ACEPTADA" ? "var(--ct-2f4737, #2F4737)" : "var(--ct-745622, #745622)",
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
                    onClick={() => manejarEliminar(inv.id, inv.correo)}
                    disabled={isPending}
                    title="Revocar invitación de correo"
                    aria-label="Revocar invitación de correo"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--cb-e5caca, #E5CACA)",
                      background: "var(--cf-faf2f2, #FAF2F2)",
                      color: "var(--ct-8a2e2e, #8A2E2E)",
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
