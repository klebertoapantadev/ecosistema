"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import {
  ClipboardList,
  ExternalLink,
  FilePlus2,
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
import { ModalEditarVariacionProforma } from "./ModalEditarVariacionProforma";

interface PropsBandejaPedidosTienda {
  negocio: string;
  pedidosIniciales?: PedidoTiendaRegistrado[];
}

const ESTADOS_PEDIDO: Array<{ valor: string; etiqueta: string; colorFondo: string; colorTexto: string }> = [
  { valor: "ENVIADA", etiqueta: "Proforma Emitida", colorFondo: "#F3E8FF", colorTexto: "#6B21A8" },
  { valor: "PENDIENTE_PAGO", etiqueta: "Pendiente Pago", colorFondo: "#FEF3C7", colorTexto: "#92400E" },
  { valor: "ORDEN_CONFIRMADA", etiqueta: "Orden Confirmada", colorFondo: "#FEF9C3", colorTexto: "#854D0E" },
  { valor: "RESERVADA_70", etiqueta: "Reserva 70%", colorFondo: "#DBEAFE", colorTexto: "#1D4ED8" },
  { valor: "APROBADA", etiqueta: "Confirmado", colorFondo: "#DCFCE7", colorTexto: "#166534" },
  { valor: "NO_ACEPTADA", etiqueta: "No Aceptada", colorFondo: "#F1F5F9", colorTexto: "#64748B" },
  { valor: "EN_PREPARACION", etiqueta: "En Taller", colorFondo: "#E0F2FE", colorTexto: "#0369A1" },
  { valor: "EN_RUTA", etiqueta: "En Ruta", colorFondo: "#E0E7FF", colorTexto: "#3730A3" },
  { valor: "ENTREGADO", etiqueta: "Entregado", colorFondo: "#F0FDF4", colorTexto: "#15803D" },
  { valor: "CANCELADO", etiqueta: "Cancelado", colorFondo: "#FEE2F2", colorTexto: "#991B1B" },
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
  const [pedidoEnfocado, setPedidoEnfocado] = useState<string>("");
  const [proformaEditandoVariacion, setProformaEditandoVariacion] =
    useState<PedidoTiendaRegistrado | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sincronizarDesdeUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const cod = (params.get("pedido") || params.get("codigo") || "").trim();
        if (cod) {
          setPedidoEnfocado(cod);
        }
      } catch {
        // Ignorar
      }
    };
    sincronizarDesdeUrl();
    window.addEventListener("eco:abrir-ruta-push", sincronizarDesdeUrl);
    return () => window.removeEventListener("eco:abrir-ruta-push", sincronizarDesdeUrl);
  }, []);

  const idsExpandidosIniciales = useMemo(() => {
    if (!pedidoEnfocado) return undefined;
    const upper = pedidoEnfocado.toUpperCase();
    const encontrados = pedidos
      .filter((p) => p.codigoOrden.toUpperCase().includes(upper) || p.id === pedidoEnfocado)
      .map((p) => p.id);
    return encontrados.length > 0 ? encontrados : undefined;
  }, [pedidoEnfocado, pedidos]);

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
        encabezado: "Orden / Proforma",
        valor: (p) => `${p.codigoOrden} ${p.tipoOrigen || ""}`,
        render: (p) => {
          const esProforma = p.tipoOrigen === "PROFORMA_EVENTO";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <strong style={{ color: "#111827", fontSize: "0.84rem" }}>{p.codigoOrden}</strong>
                <span
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "999px",
                    background: esProforma ? "#FAF5FF" : "#F1F5F9",
                    color: esProforma ? "#7E22CE" : "#475569",
                    border: `1px solid ${esProforma ? "#E9D5FF" : "#E2E8F0"}`,
                  }}
                >
                  {esProforma ? "✨ Evento" : "🛍️ Tienda"}
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
                {new Date(p.creadoEn).toLocaleString("es-EC", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
          );
        },
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
            {typeof p.montoAbonadoUsd === "number" && p.montoAbonadoUsd > 0 && (
              <span style={{ fontSize: "0.7rem", color: "#1D4ED8", fontWeight: 700 }}>
                Abono: ${p.montoAbonadoUsd.toFixed(2)} · Saldo: $
                {Math.max(0, p.saldoPendienteUsd ?? p.total - p.montoAbonadoUsd).toFixed(2)}
              </span>
            )}
            <span style={{ fontSize: "0.7rem", color: "#6B7280", textTransform: "uppercase" }}>
              {p.metodoPago}
            </span>
            {p.comprobanteTransferencia?.url && (
              <span
                style={{
                  fontSize: "0.66rem",
                  fontWeight: 700,
                  color: "#065F46",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  borderRadius: "999px",
                  padding: "1px 6px",
                  alignSelf: "flex-start",
                }}
              >
                📎 Comprobante
              </span>
            )}
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

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <a
            href="/panel/envio-pedidos"
            title="Ir a validación, calendario y envío diario de pedidos a Taller"
            aria-label="Enviar Pedidos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 13px",
              borderRadius: "8px",
              background: "#0F172A",
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <span>📤 Enviar a Taller</span>
          </a>

          <a
            href="/panel/taller"
            title="Abrir pantalla de producción del Taller"
            aria-label="Ver Taller"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 13px",
              borderRadius: "8px",
              border: "1px solid #86EFAC",
              background: "#ECFDF5",
              color: "#065F46",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <span>🔨 Taller</span>
          </a>

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

      {pedidoEnfocado && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E3A8A",
            fontSize: "0.82rem",
          }}
        >
          <span>
            📦 Mostrando acceso directo al pedido modificado: <strong>{pedidoEnfocado}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setPedidoEnfocado("");
              if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                params.delete("pedido");
                params.delete("codigo");
                const qs = params.toString();
                window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
              }
            }}
            title="Mostrar todos los pedidos de la tienda"
            aria-label="Ver todos"
            style={{
              padding: "5px 11px",
              borderRadius: "8px",
              border: "1px solid #93C5FD",
              background: "#FFFFFF",
              color: "#1D4ED8",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ver todos
          </button>
        </div>
      )}

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "clamp(10px, 2.5vw, 16px)",
          minWidth: 0,
        }}
      >
        <DataGrid
          columnas={columnas}
          filas={pedidos}
          idFila={(p) => p.id}
          nombreExportacion={`pedidos-tienda-${negocio}`}
          busquedaInicial={pedidoEnfocado}
          filasExpandidasIniciales={idsExpandidosIniciales}
          contenidoExpandible={(p) => (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
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
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {p.evento && (
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: "7px",
                        background: "#FAF5FF",
                        border: "1px solid #E9D5FF",
                        color: "#581C87",
                      }}
                    >
                      <strong>✨ Evento:</strong> {p.evento.tipoEvento || "Evento"} · Fecha:{" "}
                      {p.evento.fechaEvento || "—"}
                      {p.evento.horaEvento ? ` (${p.evento.horaEvento})` : ""}
                      {p.evento.paletaColores ? ` · Paleta: ${p.evento.paletaColores}` : ""}
                      {p.evento.notasEvento ? (
                        <div style={{ marginTop: "3px" }}>
                          <strong>Notas:</strong> {p.evento.notasEvento}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div>
                    <strong>Facturación SRI:</strong> {p.compradorNombre} · ID:{" "}
                    {p.compradorIdentificacion || "—"} · {p.compradorCorreo || "—"}
                    {p.autorizaWhatsapp ? " · ✓ LOPDP WhatsApp" : ""}
                  </div>

                  {p.comprobanteTransferencia?.url && (
                    <div
                      style={{
                        padding: "9px 11px",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                        color: "#065F46",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong>
                          📎 Comprobante adjunto:{" "}
                          {p.comprobanteTransferencia.nombreArchivo || "Archivo"}
                        </strong>
                        <a
                          href={p.comprobanteTransferencia.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={p.comprobanteTransferencia.nombreArchivo || "comprobante"}
                          title="Ver o descargar comprobante de transferencia subido por el cliente"
                          aria-label="Ver Comprobante"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: "#047857",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            fontSize: "0.73rem",
                            fontWeight: 700,
                          }}
                        >
                          <span>Ver Comprobante</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      {p.comprobanteTransferencia.mimeType?.startsWith("image/") && (
                        <img
                          src={p.comprobanteTransferencia.url}
                          alt="Comprobante de pago"
                          style={{
                            maxWidth: "220px",
                            maxHeight: "150px",
                            objectFit: "contain",
                            borderRadius: "6px",
                            border: "1px solid #6EE7B7",
                            background: "#FFFFFF",
                          }}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {p.tipoOrigen === "PROFORMA_EVENTO" && (
                      <button
                        type="button"
                        onClick={() => setProformaEditandoVariacion(p)}
                        title="Actualizar proforma creando una nueva variación y enviar PDF original + actualizado por correo al cliente"
                        aria-label="Nueva Variación"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          borderRadius: "7px",
                          border: "none",
                          background: "#7C3AED",
                          color: "#FFFFFF",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <FilePlus2 size={13} />
                        <span>Nueva Variación</span>
                      </button>
                    )}
                    {p.tokenAprobacion && (
                      <a
                        href={`/proforma/${p.tokenAprobacion}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir proforma pública con selector de variaciones y pago"
                        aria-label="Ver Proforma"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          borderRadius: "7px",
                          background: "#2D4A3E",
                          color: "#FFFFFF",
                          textDecoration: "none",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <span>Ver Proforma</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {p.tokenAprobacion && (
                      <a
                        href={`/api/proforma/${p.tokenAprobacion}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Descargar archivo PDF de esta versión"
                        aria-label="Descargar PDF"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          borderRadius: "7px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#0F172A",
                          textDecoration: "none",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <span>Descargar PDF</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {p.compradorTelefono && (
                      <a
                        href={`https://wa.me/${p.compradorTelefono.replace(/\D+/g, "")}?text=${encodeURIComponent(
                          `Hola ${p.compradorNombre}, te escribimos de ${negocio.toUpperCase()} respecto a tu proforma ${p.codigoOrden}${
                            p.tokenAprobacion
                              ? ` (${typeof window !== "undefined" ? window.location.origin : ""}/proforma/${p.tokenAprobacion})`
                              : ""
                          }.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Contactar al cliente por WhatsApp"
                        aria-label="WhatsApp"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          borderRadius: "7px",
                          background: "#059669",
                          color: "#FFFFFF",
                          textDecoration: "none",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <span>WhatsApp</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      {proformaEditandoVariacion && (
        <ModalEditarVariacionProforma
          pedidoBase={proformaEditandoVariacion}
          alCerrar={() => setProformaEditandoVariacion(null)}
          alVariacionCreada={() => {
            cargarPedidos();
          }}
        />
      )}
    </div>
  );
}

