"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import {
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  UserCheck,
} from "lucide-react";
import {
  obtenerProspectosChatAction,
  actualizarEstadoProspectoAction,
  type ProspectoChat,
} from "../acciones";

export function BandejaProspectosChat() {
  const [prospectos, setProspectos] = useState<ProspectoChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("NUEVO");
  const [toastExito, setToastExito] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modal para nota al cambiar estado
  const [modalNota, setModalNota] = useState<{
    abierto: boolean;
    prospectoId: string;
    nuevoEstado: "CONTACTADO" | "CONVERTIDO" | "DESCARTADO" | "NUEVO";
    nombre: string;
  }>({
    abierto: false,
    prospectoId: "",
    nuevoEstado: "CONTACTADO",
    nombre: "",
  });
  const [textoNota, setTextoNota] = useState("");

  const cargarProspectos = useCallback(async () => {
    setCargando(true);
    try {
      const res = await obtenerProspectosChatAction(filtroEstado);
      if (res.ok && res.datos) {
        setProspectos(res.datos);
      } else {
        setToastError(res.error || "No se pudieron cargar los prospectos.");
      }
    } catch (err) {
      setToastError(err instanceof Error ? err.message : "Error al cargar prospectos.");
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    void cargarProspectos();
  }, [cargarProspectos]);

  const abrirCambioEstado = (
    p: ProspectoChat,
    nuevoEstado: "CONTACTADO" | "CONVERTIDO" | "DESCARTADO" | "NUEVO"
  ) => {
    setModalNota({
      abierto: true,
      prospectoId: p.psp_id,
      nuevoEstado,
      nombre: p.psp_nombre,
    });
    setTextoNota("");
  };

  const confirmarCambioEstado = () => {
    if (!modalNota.prospectoId) return;

    startTransition(async () => {
      const res = await actualizarEstadoProspectoAction(
        modalNota.prospectoId,
        modalNota.nuevoEstado,
        textoNota.trim() ? textoNota.trim() : undefined
      );

      if (res.ok) {
        setToastExito(`✅ Contacto ${modalNota.nombre} marcado como ${modalNota.nuevoEstado}.`);
        setTimeout(() => setToastExito(null), 4000);
        setModalNota({ abierto: false, prospectoId: "", nuevoEstado: "CONTACTADO", nombre: "" });
        setTextoNota("");
        cargarProspectos();
      } else {
        setToastError(res.error || "No se pudo actualizar el estado.");
        setTimeout(() => setToastError(null), 5000);
      }
    });
  };

  const obtenerBadgeEstado = (estado: string) => {
    switch (estado) {
      case "NUEVO":
        return {
          bg: "var(--acento-diluido)",
          color: "var(--acento-hondo)",
          border: "var(--acento-linea)",
          label: "Nuevo",
        };
      case "CONTACTADO":
        return {
          bg: "var(--aviso-diluido)",
          color: "var(--aviso-texto)",
          border: "var(--aviso-linea)",
          label: "Contactado",
        };
      case "CONVERTIDO":
        return {
          bg: "var(--exito-diluido)",
          color: "var(--exito-texto)",
          border: "var(--exito-linea)",
          label: "Convertido",
        };
      case "DESCARTADO":
        return {
          bg: "var(--error-diluido)",
          color: "var(--error)",
          border: "var(--error-linea)",
          label: "Descartado",
        };
      default:
        return {
          bg: "var(--fondo-hundido)",
          color: "var(--texto-2)",
          border: "var(--linea)",
          label: estado,
        };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toast Notificación */}
      {toastExito && (
        <div
          style={{
            background: "#0E6648",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "10px",
            fontSize: "0.88rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <CheckCircle2 size={18} />
          {toastExito}
        </div>
      )}

      {toastError && (
        <div
          style={{
            background: "var(--error)",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "10px",
            fontSize: "0.88rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <AlertCircle size={18} />
          {toastError}
        </div>
      )}

      {/* Barra de Filtros y Acciones */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid var(--linea)",
          borderRadius: "12px",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        {/* Píldoras de Filtro por Estado */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { clave: "NUEVO", label: "Nuevos" },
            { clave: "CONTACTADO", label: "Contactados" },
            { clave: "CONVERTIDO", label: "Convertidos" },
            { clave: "DESCARTADO", label: "Descartados" },
            { clave: "TODOS", label: "Todos" },
          ].map((item) => (
            <button
              key={item.clave}
              type="button"
              onClick={() => setFiltroEstado(item.clave)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: filtroEstado === item.clave ? "1px solid var(--acento)" : "1px solid var(--linea)",
                background: filtroEstado === item.clave ? "var(--acento-diluido)" : "#FFFFFF",
                color: filtroEstado === item.clave ? "var(--acento)" : "var(--texto-suave)",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={cargarProspectos}
          disabled={cargando}
          className="btn-responsive-accion"
          style={{
            background: "var(--fondo-suave)",
            color: "var(--texto-2)",
            border: "1px solid var(--linea-fuerte)",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: cargando ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
          title="Recargar prospectos de chat"
          aria-label="Recargar prospectos de chat"
        >
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
          <span className="btn-texto-responsive">Recargar</span>
        </button>
      </div>

      {/* Tabla de Prospectos */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--texto-suave)", fontSize: "0.9rem" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
          Cargando contactos del chat...
        </div>
      ) : prospectos.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "50px 20px",
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px dashed var(--linea-fuerte)",
          }}
        >
          <MessageSquare size={40} color="var(--texto-tenue)" style={{ marginBottom: "12px" }} />
          <h3 style={{ margin: "0 0 6px 0", color: "var(--texto-2)", fontSize: "1.1rem" }}>
            Aún no hay contactos del chat.
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--texto-suave)" }}>
            Los contactos captados por el buddie conversacional de la landing aparecerán en esta bandeja.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid var(--linea)",
            borderRadius: "16px",
            overflowX: "auto",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--fondo-suave)", borderBottom: "2px solid var(--linea)", color: "var(--texto-2)", fontWeight: 700 }}>
                <th style={{ padding: "12px 14px" }}>Fecha</th>
                <th style={{ padding: "12px 14px" }}>Nombre & Contacto</th>
                <th style={{ padding: "12px 14px" }}>Ubicación</th>
                <th style={{ padding: "12px 14px" }}>Interés & SKU</th>
                <th style={{ padding: "12px 14px" }}>Estado</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prospectos.map((p) => {
                const badge = obtenerBadgeEstado(p.psp_estado);
                const digitsWa = (p.psp_whatsapp || "").replace(/\D/g, "");
                const waUrl = `https://wa.me/${digitsWa}`;

                return (
                  <tr key={p.psp_id} style={{ borderBottom: "1px solid var(--fondo-hundido)" }}>
                    {/* Fecha */}
                    <td style={{ padding: "12px 14px", color: "var(--texto-suave)", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                      <div style={{ fontWeight: 600, color: "var(--texto-2)" }}>
                        {new Date(p.psp_creado_en).toLocaleDateString("es-EC", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div style={{ fontSize: "0.75rem" }}>
                        {new Date(p.psp_creado_en).toLocaleTimeString("es-EC", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>

                    {/* Nombre & Contacto */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700, color: "var(--texto)", fontSize: "0.9rem" }}>
                        {p.psp_nombre}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "4px" }}>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "var(--exito)",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          <Phone size={13} />
                          {p.psp_whatsapp}
                          <ExternalLink size={11} />
                        </a>
                        {p.psp_correo && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--texto-suave)", fontSize: "0.78rem" }}>
                            <Mail size={12} />
                            {p.psp_correo}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Ciudad */}
                    <td style={{ padding: "12px 14px", color: "var(--texto-2)" }}>
                      {p.psp_ciudad ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={13} color="var(--texto-suave)" />
                          <span>{p.psp_ciudad}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--texto-tenue)" }}>-</span>
                      )}
                    </td>

                    {/* Interés & SKU */}
                    <td style={{ padding: "12px 14px", maxWidth: "260px" }}>
                      {p.psp_servicio_sku && (
                        <div style={{ marginBottom: "4px" }}>
                          <span
                            style={{
                              background: "var(--fondo-hundido)",
                              color: "var(--acento)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              fontFamily: "monospace",
                            }}
                          >
                            {p.psp_servicio_sku}
                          </span>
                        </div>
                      )}
                      <div style={{ color: "var(--texto-2)", fontSize: "0.82rem", lineHeight: 1.4 }}>
                        {p.psp_interes || <span style={{ color: "var(--texto-tenue)" }}>Sin detalle de interés</span>}
                      </div>
                      {p.psp_detalle_prospecto?.token_nombre && (
                        <div style={{ fontSize: "0.72rem", color: "var(--texto-tenue)", marginTop: "4px" }}>
                          Origen: {p.psp_detalle_prospecto.token_nombre}
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          display: "inline-block",
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        {p.psp_estado === "NUEVO" && (
                          <button
                            type="button"
                            onClick={() => abrirCambioEstado(p, "CONTACTADO")}
                            className="btn-responsive-accion"
                            title="Marcar como contactado"
                            aria-label="Marcar como contactado"
                            style={{
                              background: "var(--aviso-diluido)",
                              color: "var(--aviso-texto)",
                              border: "1px solid var(--aviso-linea)",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <UserCheck size={14} />
                            <span className="btn-texto-responsive">Marcar contactado</span>
                          </button>
                        )}

                        {p.psp_estado !== "CONVERTIDO" && (
                          <button
                            type="button"
                            onClick={() => abrirCambioEstado(p, "CONVERTIDO")}
                            className="btn-responsive-accion"
                            title="Convertir a cliente"
                            aria-label="Convertir a cliente"
                            style={{
                              background: "var(--exito-diluido)",
                              color: "var(--exito-texto)",
                              border: "1px solid var(--exito-linea)",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span className="btn-texto-responsive">Convertido</span>
                          </button>
                        )}

                        {p.psp_estado !== "DESCARTADO" && (
                          <button
                            type="button"
                            onClick={() => abrirCambioEstado(p, "DESCARTADO")}
                            className="btn-responsive-accion"
                            title="Descartar prospecto"
                            aria-label="Descartar prospecto"
                            style={{
                              background: "var(--error-diluido)",
                              color: "var(--error)",
                              border: "1px solid var(--error-linea)",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <XCircle size={14} />
                            <span className="btn-texto-responsive">Descartar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para Confirmación y Nota Opcional */}
      {modalNota.abierto && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--texto)" }}>
              Cambiar Estado a {modalNota.nuevoEstado}
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--texto-suave)" }}>
              Actualizando contacto de <strong>{modalNota.nombre}</strong>. Puedes añadir una nota opcional de seguimiento.
            </p>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "6px" }}>
                Nota u observación (opcional):
              </label>
              <textarea
                rows={3}
                placeholder="ej. Llamado el día de hoy, interesado en divorcio mutuo acuerdo..."
                value={textoNota}
                onChange={(e) => setTextoNota(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--linea-fuerte)",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setModalNota({ abierto: false, prospectoId: "", nuevoEstado: "CONTACTADO", nombre: "" })}
                disabled={isPending}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--linea-fuerte)",
                  background: "#FFFFFF",
                  color: "var(--texto-2)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCambioEstado}
                disabled={isPending}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--acento)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: isPending ? "wait" : "pointer",
                }}
              >
                {isPending ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
