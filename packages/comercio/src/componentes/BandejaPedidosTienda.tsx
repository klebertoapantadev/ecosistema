"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import {
  ClipboardList,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";
import {
  actualizarEstadoPedidoTiendaAction,
  obtenerPedidosTiendaAction,
  type PedidoTiendaRegistrado,
} from "../acciones-logistica";

interface PropsBandejaPedidosTienda {
  negocio: string;
  pedidosIniciales?: PedidoTiendaRegistrado[];
}

const ESTADOS_PEDIDO: Array<{ valor: string; etiqueta: string; colorFondo: string; colorTexto: string }> = [
  { valor: "PENDIENTE_PAGO", etiqueta: "Pendiente Pago", colorFondo: "#FEF3C7", colorTexto: "#92400E" },
  { valor: "APROBADA", etiqueta: "Confirmado", colorFondo: "#DCFCE7", colorTexto: "#166534" },
  { valor: "EN_PREPARACION", etiqueta: "En Taller", colorFondo: "#DBEAFE", colorTexto: "#1E40AF" },
  { valor: "EN_RUTA", etiqueta: "En Ruta", colorFondo: "#E0E7FF", colorTexto: "#3730A3" },
  { valor: "ENTREGADO", etiqueta: "Entregado", colorFondo: "#F0FDF4", colorTexto: "#15803D" },
  { valor: "CANCELADO", etiqueta: "Cancelado", colorFondo: "#FEE2E2", colorTexto: "#991B1B" },
];

function estiloEstado(estado: string) {
  const encontrado = ESTADOS_PEDIDO.find((e) => e.valor === estado);
  return (
    encontrado ?? {
      valor: estado,
      etiqueta: estado,
      colorFondo: "#F4F4F5",
      colorTexto: "#27272A",
    }
  );
}

export function BandejaPedidosTienda({
  negocio,
  pedidosIniciales,
}: PropsBandejaPedidosTienda) {
  const cacheKey = `eco_pedidos_tienda_${negocio.trim().toLowerCase()}`;
  const [pedidos, setPedidos] = useState<PedidoTiendaRegistrado[]>(pedidosIniciales ?? []);
  const [cargando, setCargando] = useState<boolean>(!pedidosIniciales);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  const cargarPedidos = useCallback(async () => {
    setCargando(true);
    setErrorMsg(null);
    const res = await obtenerPedidosTiendaAction(negocio);
    if (!res.ok) {
      setErrorMsg(res.error);
      setCargando(false);
      return;
    }
    setPedidos(res.pedidos);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(res.pedidos));
    } catch {
      // Ignorar cuota de almacenamiento local
    }
    setCargando(false);
  }, [negocio, cacheKey]);

  useEffect(() => {
    if (!pedidosIniciales) {
      try {
        const guardado = localStorage.getItem(cacheKey);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPedidos(parsed as PedidoTiendaRegistrado[]);
          }
        }
      } catch {
        // Ignorar caché inválido
      }
      void cargarPedidos();
    } else {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(pedidosIniciales));
      } catch {
        // Ignorar cuota
      }
    }
  }, [pedidosIniciales, cacheKey, cargarPedidos]);

  const cambiarEstado = useCallback(
    async (pedidoId: string, nuevoEstado: string) => {
      setActualizandoId(pedidoId);
      setErrorMsg(null);
      const res = await actualizarEstadoPedidoTiendaAction(negocio, pedidoId, nuevoEstado);
      setActualizandoId(null);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPedidos((prev) => {
        const nuevaLista = prev.map((p) =>
          p.id === pedidoId ? { ...p, estado: nuevoEstado } : p
        );
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nuevaLista));
        } catch {
          // Ignorar cuota
        }
        return nuevaLista;
      });
    },
    [negocio, cacheKey]
  );

  const columnas = useMemo<ColumnaDataGrid<PedidoTiendaRegistrado>[]>(
    () => [
      {
        id: "orden",
        encabezado: "Orden",
        valor: (p) => p.codigoOrden,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ color: "#111827", fontSize: "0.84rem" }}>{p.codigoOrden}</strong>
            <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
              {new Date(p.creadoEn).toLocaleString("es-EC", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>
        ),
      },
      {
        id: "cliente",
        encabezado: "Comprador",
        valor: (p) => `${p.compradorNombre} ${p.compradorIdentificacion} ${p.compradorTelefono}`,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.82rem", color: "#1F2937" }}>{p.compradorNombre}</strong>
            <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
              {p.compradorTelefono || p.compradorCorreo}
            </span>
          </div>
        ),
      },
      {
        id: "entrega",
        encabezado: "Zona / Destino",
        valor: (p) =>
          p.logistica.retiroEnLocal
            ? "Retiro en Tienda"
            : p.logistica.zonaDetectada || p.logistica.direccion || "Domicilio",
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>
              {p.logistica.retiroEnLocal
                ? "🏪 Retiro en Tienda"
                : `📍 ${p.logistica.zonaDetectada || "Domicilio"}`}
            </span>
            <span style={{ fontSize: "0.72rem", color: "#4B5563" }}>
              {p.logistica.fechaEntrega} · {p.logistica.franjaHoraria}
              {typeof p.logistica.distanciaVialKm === "number" && !p.logistica.retiroEnLocal
                ? ` · ${p.logistica.distanciaVialKm.toFixed(1)} km`
                : ""}
            </span>
          </div>
        ),
      },
      {
        id: "envio_interno",
        encabezado: "Envío y Cálculo Interno",
        valor: (p) => `${p.costoEnvio.toFixed(2)} ${p.logistica.formulaCalculoInterno}`,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "290px" }}>
            <strong
              style={{
                fontSize: "0.82rem",
                color: p.costoEnvio === 0 ? "#15803D" : "#0F172A",
              }}
            >
              {p.costoEnvio === 0 ? "$0.00 (Gratis)" : `$${p.costoEnvio.toFixed(2)} USD`}
            </strong>
            <span style={{ fontSize: "0.71rem", color: "#475569", lineHeight: 1.35 }}>
              {p.logistica.formulaCalculoInterno}
            </span>
          </div>
        ),
      },
      {
        id: "total",
        encabezado: "Total Orden",
        valor: (p) => p.total,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.86rem", color: "#111827" }}>
              ${p.total.toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.7rem", color: "#6B7280", textTransform: "uppercase" }}>
              {p.metodoPago}
            </span>
          </div>
        ),
      },
      {
        id: "estado",
        encabezado: "Estado",
        valor: (p) => estiloEstado(p.estado).etiqueta,
        render: (p) => {
          const est = estiloEstado(p.estado);
          return (
            <select
              value={p.estado}
              disabled={actualizandoId === p.id}
              onChange={(e) => void cambiarEstado(p.id, e.target.value)}
              aria-label={`Estado de ${p.codigoOrden}`}
              style={{
                padding: "4px 8px",
                borderRadius: "999px",
                border: "1px solid rgba(0,0,0,0.08)",
                background: est.colorFondo,
                color: est.colorTexto,
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {ESTADOS_PEDIDO.map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.etiqueta}
                </option>
              ))}
            </select>
          );
        },
      },
    ],
    [actualizandoId, cambiarEstado]
  );

  const totalVentas = pedidos.reduce((acc, p) => acc + p.total, 0);
  const totalEnvios = pedidos.reduce((acc, p) => acc + p.costoEnvio, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Resumen superior */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClipboardList size={20} />
          </div>
          <div>
            <strong style={{ fontSize: "0.96rem", color: "#111827" }}>
              Pedidos Recibidos ({pedidos.length})
            </strong>
            <div style={{ fontSize: "0.78rem", color: "#6B7280" }}>
              Ventas acumuladas: <strong>${totalVentas.toFixed(2)}</strong> · Recaudado en transporte:{" "}
              <strong>${totalEnvios.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void cargarPedidos()}
          disabled={cargando}
          title="Actualizar listado de pedidos de la tienda"
          aria-label="Actualizar"
          className="btn-responsive-accion"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #D4D4D8",
            background: "#FFFFFF",
            color: "#18181B",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: cargando ? "wait" : "pointer",
          }}
        >
          {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
          <span className="btn-texto-responsive">Actualizar</span>
        </button>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#B91C1C",
          }}
        >
          {errorMsg}
        </div>
      )}

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <DataGrid
          columnas={columnas}
          filas={pedidos}
          idFila={(p) => p.id}
          nombreExportacion={`pedidos-tienda-${negocio}`}
          contenidoExpandible={(p) => (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "14px",
                padding: "12px",
                background: "#F8FAFC",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
              }}
            >
              {/* Auditoría Interna de Logística y Ruta GPS */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "9px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0F172A" }}>
                  <Truck size={15} color="#16A34A" />
                  <strong style={{ fontSize: "0.82rem" }}>
                    Detalle Logístico Interno (Exclusivo Tienda)
                  </strong>
                </div>
                <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.45 }}>
                  <div>
                    <strong>Destinatario:</strong> {p.logistica.destinatarioNombre || "—"} (
                    {p.logistica.destinatarioTelefono || "—"})
                  </div>
                  <div>
                    <strong>Dirección:</strong> {p.logistica.direccion || "—"}
                    {p.logistica.referencia ? ` · Ref: ${p.logistica.referencia}` : ""}
                  </div>
                  {p.logistica.detalleDireccionGeo && (
                    <div style={{ fontSize: "0.74rem", color: "#0F766E" }}>
                      <strong>Mapa (Calle / Sector / Parroquia):</strong>{" "}
                      {[
                        p.logistica.detalleDireccionGeo.callePrincipal,
                        p.logistica.detalleDireccionGeo.sectorBarrio
                          ? `Sector ${p.logistica.detalleDireccionGeo.sectorBarrio}`
                          : null,
                        p.logistica.detalleDireccionGeo.parroquia
                          ? `Parroquia ${p.logistica.detalleDireccionGeo.parroquia}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || p.logistica.detalleDireccionGeo.resumenDireccion}
                    </div>
                  )}
                  <div>
                    <strong>Fecha / Franja:</strong> {p.logistica.fechaEntrega} ·{" "}
                    {p.logistica.franjaHoraria}
                    {p.logistica.horaExacta ? ` (${p.logistica.horaExacta})` : ""}
                  </div>
                  {typeof p.logistica.distanciaVialKm === "number" && (
                    <div>
                      <strong>Distancia vial calculada:</strong>{" "}
                      {p.logistica.distanciaVialKm.toFixed(2)} km
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "7px 9px",
                      borderRadius: "7px",
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      color: "#166534",
                      fontSize: "0.75rem",
                    }}
                  >
                    <strong>Cálculo aplicado:</strong> {p.logistica.formulaCalculoInterno}
                  </div>
                </div>

                {p.logistica.enlaceMapa && (
                  <div style={{ marginTop: "4px" }}>
                    <a
                      href={p.logistica.enlaceMapa}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir ubicación exacta de entrega en Google Maps"
                      aria-label="Abrir Mapa"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "6px 11px",
                        borderRadius: "7px",
                        background: "#18181B",
                        color: "#FFFFFF",
                        textDecoration: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      <MapPin size={13} />
                      <span>Abrir Mapa</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* Ítems y Dedicatorias */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "9px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0F172A" }}>
                  <PackageCheck size={15} color="#2563EB" />
                  <strong style={{ fontSize: "0.82rem" }}>
                    Arreglos, Complementos y Dedicatorias ({p.items.length})
                  </strong>
                </div>

                {p.items.map((it, idx) => (
                  <div
                    key={`${p.id}-it-${idx}`}
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid #F1F5F9",
                      paddingTop: idx === 0 ? 0 : "6px",
                      fontSize: "0.78rem",
                      color: "#1E293B",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                      <strong>
                        {it.cantidad}× {it.descripcion}
                      </strong>
                      <span>${it.totalLinea.toFixed(2)}</span>
                    </div>
                    {it.dedicatoria?.mensaje && (
                      <div
                        style={{
                          marginTop: "3px",
                          fontSize: "0.73rem",
                          color: "#475569",
                          background: "#FFFBEB",
                          border: "1px solid #FDE68A",
                          borderRadius: "6px",
                          padding: "5px 8px",
                        }}
                      >
                        💌 <strong>Para:</strong> {it.dedicatoria.para || "—"} ·{" "}
                        <strong>De:</strong> {it.dedicatoria.de || "—"} — &ldquo;
                        {it.dedicatoria.mensaje}&rdquo;
                      </div>
                    )}
                  </div>
                ))}

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "8px",
                    borderTop: "1px solid #E2E8F0",
                    fontSize: "0.75rem",
                    color: "#475569",
                  }}
                >
                  <strong>Facturación SRI:</strong> {p.compradorNombre} · ID:{" "}
                  {p.compradorIdentificacion || "—"} · {p.compradorCorreo}
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}

