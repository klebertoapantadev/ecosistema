"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  FileText,
  ShoppingBag,
  Sparkles,
  Trash2,
  MapPin,
  Calendar,
} from "lucide-react";
import {
  eliminarVariacionesProformaClienteAction,
  type ResumenMiProformaEvento,
} from "@eco/comercio";

interface Props {
  proformasIniciales: ResumenMiProformaEvento[];
  mostrarSiempre?: boolean;
}

const ESTADOS_COMPRA_CONFIRMADA = new Set([
  "PAGADO",
  "ORDEN_CONFIRMADA",
  "EN_PREPARACION",
  "EN_RUTA",
  "DESPACHADO",
  "ENTREGADO",
  "FACTURADA",
  "RESERVADA_70",
  "APROBADA",
]);

function obtenerBadgeEstado(estado: string): {
  etiqueta: string;
  bg: string;
  color: string;
} {
  const est = (estado || "").toUpperCase();
  if (est === "PAGADO" || est === "APROBADA" || est === "FACTURADA") {
    return { etiqueta: "Pagado", bg: "#DCFCE7", color: "#166534" };
  }
  if (est === "ENTREGADO") {
    return { etiqueta: "Entregado", bg: "#DCFCE7", color: "#15803D" };
  }
  if (est === "EN_RUTA" || est === "DESPACHADO") {
    return { etiqueta: "En Ruta", bg: "#FEF3C7", color: "#B45309" };
  }
  if (est === "EN_PREPARACION") {
    return { etiqueta: "En Taller", bg: "#E0F2FE", color: "#0369A1" };
  }
  if (est === "RESERVADA_70") {
    return { etiqueta: "Reserva 70%", bg: "#DBEAFE", color: "#1D4ED8" };
  }
  if (est === "ORDEN_CONFIRMADA") {
    return { etiqueta: "Orden Confirmada", bg: "#DBEAFE", color: "#1D4ED8" };
  }
  if (est === "NO_ACEPTADA" || est === "CANCELADO") {
    return { etiqueta: "No Aceptada", bg: "#F3F4F6", color: "#6B7280" };
  }
  if (est === "PENDIENTE_PAGO") {
    return { etiqueta: "Pendiente de Pago", bg: "#FEF3C7", color: "#B45309" };
  }
  return { etiqueta: "Emitida", bg: "#FAF5FF", color: "#6B21A8" };
}

export function ListaMisProformasCliente({
  proformasIniciales,
  mostrarSiempre = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [idsEliminados, setIdsEliminados] = useState<string[]>([]);
  const [gruposEliminados, setGruposEliminados] = useState<string[]>([]);
  const [errorEliminacion, setErrorEliminacion] = useState<string | null>(null);

  const proformasVisibles = proformasIniciales.filter(
    (p) =>
      !idsEliminados.includes(p.id) &&
      !gruposEliminados.includes(p.grupoProformaId ?? p.id)
  );

  if (proformasVisibles.length === 0 && !mostrarSiempre) return null;

  const misCompras = proformasVisibles.filter(
    (p) =>
      p.tipoOrigen === "ORDEN_DIRECTA" ||
      ESTADOS_COMPRA_CONFIRMADA.has((p.estado || "").toUpperCase())
  );

  const misProformas = proformasVisibles.filter(
    (p) => p.tipoOrigen === "PROFORMA_EVENTO"
  );

  const contarHermanas = (grupoId: string) =>
    proformasVisibles.filter((p) => (p.grupoProformaId ?? p.id) === grupoId).length;

  const handleEliminar = (
    prf: ResumenMiProformaEvento,
    modo: "UNA" | "TODAS"
  ) => {
    const confirmMsg =
      modo === "TODAS"
        ? "¿Eliminar todas las variaciones de esta proforma de evento? Esta acción solo está disponible antes de confirmar el pago."
        : `¿Descartar la variación ${prf.codigo}?`;

    if (typeof window !== "undefined" && !window.confirm(confirmMsg)) {
      return;
    }

    setErrorEliminacion(null);
    startTransition(async () => {
      const res = await eliminarVariacionesProformaClienteAction({
        tokenAprobacion: prf.tokenAprobacion,
        modo,
        proformaObjetivoId: prf.id,
      });

      if (!res.ok) {
        setErrorEliminacion(res.error);
        return;
      }

      if (modo === "TODAS") {
        const gId = prf.grupoProformaId ?? prf.id;
        setGruposEliminados((prev) => [...prev, gId]);
      } else {
        setIdsEliminados((prev) => [...prev, prf.id]);
      }
      router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {errorEliminacion && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          {errorEliminacion}
        </div>
      )}

      {/* SECCIÓN 1: HISTORIAL DE MIS COMPRAS Y PEDIDOS */}
      {(misCompras.length > 0 || mostrarSiempre) && (
        <section
          id="mis-compras"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0,
                color: "#374151",
              }}
            >
              Historial de Mis Compras y Pedidos ({misCompras.length})
            </h2>
            <Link
              href="/#catalogo"
              style={{
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#2D4A3E",
                textDecoration: "none",
              }}
            >
              + Ver catálogo floral →
            </Link>
          </div>

          {misCompras.length === 0 ? (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "26px 24px",
                border: "1px solid #E5DFD5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <span
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "#F5F2EB",
                    color: "#2D3D30",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShoppingBag size={20} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#1C261F" }}>
                    Aún no registras compras en Tinkay Floristería
                  </div>
                  <div style={{ fontSize: "13px", color: "#6B746C", marginTop: "2px" }}>
                    Tus pedidos de arreglos florales, estado de entrega y comprobantes aparecerán aquí.
                  </div>
                </div>
              </div>
              <Link
                href="/#catalogo"
                title="Explorar el catálogo de arreglos florales"
                aria-label="Ver Catálogo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "10px",
                  background: "#2D3D30",
                  color: "#F5F2EB",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <ShoppingBag size={14} />
                <span>Ver Catálogo</span>
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "14px",
              }}
            >
              {misCompras.map((compra) => {
                const badge = obtenerBadgeEstado(compra.estado);
                const fechaCompra = new Date(compra.creadoEn).toLocaleDateString("es-EC", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <div
                    key={`compra-${compra.id}`}
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "14px",
                      padding: "18px 20px",
                      border: "1px solid #E5DFD5",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "12px",
                      boxShadow: "0 2px 8px rgba(28, 38, 31, 0.04)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontWeight: 700,
                            fontSize: "14px",
                            color: "#1C261F",
                          }}
                        >
                          <ShoppingBag size={15} color="#2D3D30" />
                          {compra.codigo}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "999px",
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.etiqueta}
                        </span>
                      </div>

                      <div style={{ fontSize: "12px", color: "#6B746C" }}>
                        Pedido el {fechaCompra}
                        {compra.metodoPago ? ` · ${compra.metodoPago.toUpperCase()}` : ""}
                      </div>

                      {compra.itemsResumen && compra.itemsResumen.length > 0 && (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: "#FDFBF7",
                            border: "1px solid #EFECE6",
                            fontSize: "12.5px",
                            color: "#2D3D30",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          {compra.itemsResumen.slice(0, 3).map((it, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <span>
                                <strong>{it.cantidad}x</strong> {it.nombre}
                                {it.variante ? ` (${it.variante})` : ""}
                              </span>
                              <span style={{ fontWeight: 600 }}>${it.subtotal.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(compra.destinatarioNombre || compra.fechaEntrega || compra.direccionEntrega) && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                            fontSize: "12px",
                            color: "#4A544C",
                          }}
                        >
                          {compra.destinatarioNombre && (
                            <div>
                              <strong>Para:</strong> {compra.destinatarioNombre}
                            </div>
                          )}
                          {compra.fechaEntrega && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <Calendar size={12} />
                              <span>
                                Entrega: {compra.fechaEntrega}
                                {compra.franjaHoraria ? ` (${compra.franjaHoraria})` : ""}
                              </span>
                            </div>
                          )}
                          {compra.direccionEntrega && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <MapPin size={12} />
                              <span>{compra.direccionEntrega}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          paddingTop: "4px",
                        }}
                      >
                        <strong style={{ fontSize: "16px", color: "#1C261F" }}>
                          ${compra.total.toFixed(2)} USD
                        </strong>
                        {compra.montoAbonadoUsd > 0 && compra.saldoPendienteUsd > 0 && (
                          <span style={{ fontSize: "11.5px", color: "#1D4ED8", fontWeight: 600 }}>
                            Saldo: ${compra.saldoPendienteUsd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {compra.tokenAprobacion && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          paddingTop: "8px",
                          borderTop: "1px solid #F3F4F6",
                        }}
                      >
                        <Link
                          href={`/proforma/${compra.tokenAprobacion}`}
                          title="Ver detalle del pedido y comprobante"
                          aria-label="Ver Pedido"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "#2D3D30",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          <ExternalLink size={13} />
                          <span>Ver Pedido</span>
                        </Link>
                        <a
                          href={`/api/proforma/${compra.tokenAprobacion}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descargar comprobante PDF"
                          aria-label="Descargar PDF"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            color: "#334155",
                            textDecoration: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECCIÓN 2: MIS PROFORMAS Y COTIZACIONES DE EVENTOS */}
      {(misProformas.length > 0 || mostrarSiempre) && (
        <section
          id="mis-proformas"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0,
                color: "#374151",
              }}
            >
              Mis Proformas y Cotizaciones de Eventos ({misProformas.length})
            </h2>
            <Link
              href="/?proforma=abierta"
              style={{
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#2D4A3E",
                textDecoration: "none",
              }}
            >
              + Nueva proforma en tienda →
            </Link>
          </div>

          {misProformas.length === 0 ? (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "26px 24px",
                border: "1px solid #E5DFD5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <span
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "#F5F2EB",
                    color: "#C27D5F",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileText size={20} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#1C261F" }}>
                    No tienes proformas de eventos pendientes
                  </div>
                  <div style={{ fontSize: "13px", color: "#6B746C", marginTop: "2px" }}>
                    Cotiza bodas, recepciones o eventos corporativos y descarga tu proforma PDF o reserva con el 70%.
                  </div>
                </div>
              </div>
              <Link
                href="/?proforma=abierta"
                title="Cotizar proforma floral para evento"
                aria-label="Cotizar Evento"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "10px",
                  background: "#C27D5F",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <Sparkles size={14} />
                <span>Cotizar Evento</span>
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
                gap: "14px",
              }}
            >
              {misProformas.slice(0, 12).map((prf) => {
                const puedeEliminar =
                  !prf.bloqueadaPorPagoGrupo && prf.tokenAprobacion.length >= 8;
                const totalHermanas = contarHermanas(prf.grupoProformaId ?? prf.id);
                const badge = obtenerBadgeEstado(prf.estado);

                return (
                  <div
                    key={prf.id}
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "13px",
                      padding: "18px 20px",
                      border: "1px solid #E5E7EB",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontWeight: 700,
                            fontSize: "14px",
                            color: "#111827",
                          }}
                        >
                          <FileText size={16} color="#2D4A3E" />
                          {prf.codigo}
                        </span>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: prf.esOriginal ? "#F1F5F9" : "#ECFDF5",
                              color: prf.esOriginal ? "#334155" : "#065F46",
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            {prf.esOriginal
                              ? `V${prf.versionNumero} · Original`
                              : `V${prf.versionNumero} · Asesor`}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: "999px",
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.etiqueta}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: "13px", color: "#4B5563" }}>
                        {prf.tipoEvento ? `${prf.tipoEvento}` : "Proforma Tinkay"}
                        {prf.fechaEvento ? ` · ${prf.fechaEvento}` : ""}
                        {prf.etiquetaVersion && !prf.esOriginal ? ` · ${prf.etiquetaVersion}` : ""}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginTop: "2px",
                        }}
                      >
                        <strong style={{ fontSize: "16px", color: "#111827" }}>
                          ${prf.total.toFixed(2)} USD
                        </strong>
                        {prf.montoAbonadoUsd > 0 && prf.saldoPendienteUsd > 0 && (
                          <span style={{ fontSize: "11.5px", color: "#1D4ED8", fontWeight: 600 }}>
                            Saldo: ${prf.saldoPendienteUsd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        flexWrap: "wrap",
                        paddingTop: "8px",
                        borderTop: "1px solid #F3F4F6",
                      }}
                    >
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        {prf.tokenAprobacion && (
                          <Link
                            href={`/proforma/${prf.tokenAprobacion}`}
                            title="Abrir detalle de proforma y opciones de pago"
                            aria-label="Ver Proforma"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 11px",
                              borderRadius: "8px",
                              background: "#2D4A3E",
                              color: "#FFFFFF",
                              textDecoration: "none",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>Ver / Pagar</span>
                          </Link>
                        )}
                        {prf.tokenAprobacion && (
                          <a
                            href={`/api/proforma/${prf.tokenAprobacion}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Descargar documento PDF de esta variación"
                            aria-label="Descargar PDF"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              background: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              color: "#334155",
                              textDecoration: "none",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </a>
                        )}
                      </div>

                      {puedeEliminar && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleEliminar(prf, "UNA")}
                            title="Descartar esta variación antes de confirmar el pedido"
                            aria-label="Descartar"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 9px",
                              borderRadius: "8px",
                              background: "#FFF1F2",
                              border: "1px solid #FECDD3",
                              color: "#BE123C",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: isPending ? "wait" : "pointer",
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Descartar</span>
                          </button>

                          {totalHermanas > 1 && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleEliminar(prf, "TODAS")}
                              title="Eliminar todas las variaciones de este evento antes de pagar"
                              aria-label="Eliminar Todas"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 9px",
                                borderRadius: "8px",
                                background: "#FEF2F2",
                                border: "1px solid #FCA5A5",
                                color: "#991B1B",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: isPending ? "wait" : "pointer",
                              }}
                            >
                              <span>Eliminar Todas</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
