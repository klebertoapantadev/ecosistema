"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import {
  eliminarVariacionesProformaClienteAction,
  type ResumenMiProformaEvento,
} from "@eco/comercio";

interface Props {
  proformasIniciales: ResumenMiProformaEvento[];
}

export function ListaMisProformasCliente({ proformasIniciales }: Props) {
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

  if (proformasVisibles.length === 0) return null;

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
    <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
          Mis Proformas de Eventos y Órdenes ({proformasVisibles.length})
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
          gap: "14px",
        }}
      >
        {proformasVisibles.slice(0, 12).map((prf) => {
          const esProformaEvento = prf.tipoOrigen === "PROFORMA_EVENTO";
          const puedeEliminar =
            esProformaEvento &&
            !prf.bloqueadaPorPagoGrupo &&
            prf.tokenAprobacion.length >= 8;
          const totalHermanas = contarHermanas(prf.grupoProformaId ?? prf.id);

          const etiquetaEstado =
            prf.estado === "RESERVADA_70"
              ? "Reserva 70%"
              : prf.estado === "APROBADA"
              ? "Pagada"
              : prf.estado === "ORDEN_CONFIRMADA"
              ? "Orden Confirmada"
              : prf.estado === "NO_ACEPTADA"
              ? "No Aceptada"
              : "Emitida";

          const colorFondoEstado =
            prf.estado === "APROBADA"
              ? "#DCFCE7"
              : prf.estado === "RESERVADA_70" || prf.estado === "ORDEN_CONFIRMADA"
              ? "#DBEAFE"
              : prf.estado === "NO_ACEPTADA"
              ? "#F3F4F6"
              : "#FAF5FF";

          const colorTextoEstado =
            prf.estado === "APROBADA"
              ? "#166534"
              : prf.estado === "RESERVADA_70" || prf.estado === "ORDEN_CONFIRMADA"
              ? "#1D4ED8"
              : prf.estado === "NO_ACEPTADA"
              ? "#6B7280"
              : "#6B21A8";

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
                    {esProformaEvento && (
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
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: "999px",
                        background: colorFondoEstado,
                        color: colorTextoEstado,
                      }}
                    >
                      {etiquetaEstado}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: "13px", color: "#4B5563" }}>
                  {prf.tipoEvento ? `${prf.tipoEvento}` : "Orden Tinkay"}
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
                  {esProformaEvento && prf.tokenAprobacion && (
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
    </section>
  );
}
