"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  Bot,
  Calculator,
  CheckCircle2,
  Loader2,
  Save,
  Users,
  X,
} from "lucide-react";
import {
  calcularBaseComisionableVenta,
  calcularParticipacionChatOmnicanal,
  calcularRepartoComisionesVenta,
  type ReglaRepartoComision,
  type VentaComisionRegistrada,
} from "../comisiones";
import { registrarVentaComisionAction } from "../acciones-comisiones";
import type {
  ConversacionOmnicanal,
  MensajeOmnicanal,
  MiembroEquipoOmnicanal,
} from "../omnicanal";
import type { PedidoTiendaRegistrado } from "../acciones-logistica";

export interface PropiedadesModalCierreVentaComision {
  abierto: boolean;
  negocio: string;
  esAdmin: boolean;
  esMovil?: boolean;
  conversacion?: ConversacionOmnicanal | null;
  mensajes?: MensajeOmnicanal[];
  equipo: MiembroEquipoOmnicanal[];
  comprasVinculadas?: PedidoTiendaRegistrado[];
  tasasPorUsuarioId: Record<string, number>;
  tasaPorDefectoPct?: number;
  ventaExistente?: VentaComisionRegistrada | null;
  onCerrar: () => void;
  onGuardado: (venta: VentaComisionRegistrada) => void;
}

const COLORES_BARRA = ["#221E1B", "#2F4737", "#745622", "#57524C", "#8A2E2E"];

export function ModalCierreVentaComision({
  abierto,
  negocio,
  esAdmin,
  esMovil = false,
  conversacion = null,
  mensajes = [],
  equipo,
  comprasVinculadas = [],
  tasasPorUsuarioId,
  tasaPorDefectoPct = 5,
  ventaExistente = null,
  onCerrar,
  onGuardado,
}: PropiedadesModalCierreVentaComision) {
  const [clienteNombre, setClienteNombre] = useState("");
  const [codigoPedido, setCodigoPedido] = useState("");
  const [productoResumen, setProductoResumen] = useState("");

  const [valorProducto, setValorProducto] = useState("0");
  const [valorExtras, setValorExtras] = useState("0");
  const [extrasComisionan, setExtrasComisionan] = useState(true);
  const [deliveryFijo, setDeliveryFijo] = useState("0");
  const [deliveryExtra, setDeliveryExtra] = useState("0");
  const [descuentos, setDescuentos] = useState("0");
  const [comisionPasarela, setComisionPasarela] = useState("0");
  const [ventaTotalManual, setVentaTotalManual] = useState("");

  const [regla, setRegla] = useState<ReglaRepartoComision>("GANADOR_UNICO");
  const [ganadorClave, setGanadorClave] = useState<string | null>(null);
  const [porcentajesManuales, setPorcentajesManuales] = useState<Record<string, number>>({});
  const [notaAdmin, setNotaAdmin] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const participacionChat = useMemo(
    () => calcularParticipacionChatOmnicanal(mensajes, equipo),
    [mensajes, equipo]
  );

  // Lista combinada de humanos elegibles: quienes hablaron en el chat + resto del equipo (para reparto libre)
  const candidatosHumanos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        clave: string;
        usuarioId: string | null;
        nombre: string;
        porcentajeReal: number;
        porcentajeHumano: number;
      }
    >();

    if (ventaExistente) {
      for (const a of ventaExistente.asignaciones) {
        mapa.set(a.clave, {
          clave: a.clave,
          usuarioId: a.usuarioId,
          nombre: a.asesorNombre,
          porcentajeReal: a.porcentajeParticipacionChat,
          porcentajeHumano: a.porcentajeParticipacionChat,
        });
      }
    } else {
      for (const p of participacionChat.participantes) {
        if (p.esIa) continue;
        mapa.set(p.clave, {
          clave: p.clave,
          usuarioId: p.usuarioId,
          nombre: p.nombre,
          porcentajeReal: p.porcentajeReal,
          porcentajeHumano: p.porcentajeHumano,
        });
      }
    }

    for (const m of equipo) {
      const clave = `usu:${m.usuarioId}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          usuarioId: m.usuarioId,
          nombre: m.nombre,
          porcentajeReal: 0,
          porcentajeHumano: 0,
        });
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => b.porcentajeReal - a.porcentajeReal || a.nombre.localeCompare(b.nombre)
    );
  }, [ventaExistente, participacionChat.participantes, equipo]);

  // Hidratar al abrir
  useEffect(() => {
    if (!abierto) return;
    setErrorMsg(null);

    if (ventaExistente) {
      setClienteNombre(ventaExistente.clienteNombre);
      setCodigoPedido(ventaExistente.codigoPedido || "");
      setProductoResumen(ventaExistente.productoResumen || "");
      setValorProducto(String(ventaExistente.desglose.valorProductoUsd));
      setValorExtras(String(ventaExistente.desglose.valorExtrasUsd));
      setExtrasComisionan(ventaExistente.desglose.extrasComisionan);
      setDeliveryFijo(String(ventaExistente.desglose.deliveryFijoUsd));
      setDeliveryExtra(String(ventaExistente.desglose.deliveryExtraUsd));
      setDescuentos(String(ventaExistente.desglose.descuentosUsd));
      setComisionPasarela(String(ventaExistente.desglose.comisionPasarelaUsd));
      setVentaTotalManual(String(ventaExistente.desglose.ventaTotalUsd));
      setRegla(ventaExistente.reglaReparto);
      setNotaAdmin(ventaExistente.notaAdmin || "");

      const ganadorPrev = [...ventaExistente.asignaciones].sort(
        (a, b) => b.porcentajeComisionAsignado - a.porcentajeComisionAsignado
      )[0];
      setGanadorClave(ganadorPrev?.clave ?? null);

      const mapaManual: Record<string, number> = {};
      for (const a of ventaExistente.asignaciones) {
        mapaManual[a.clave] = a.porcentajeComisionAsignado;
      }
      setPorcentajesManuales(mapaManual);
      return;
    }

    const dv = conversacion?.datosVenta;
    const compraReciente = comprasVinculadas[0] ?? null;

    setClienteNombre(
      conversacion?.fichaCliente?.nombrePersonalizado ||
        conversacion?.remitenteNombre ||
        compraReciente?.compradorNombre ||
        "Cliente"
    );
    setCodigoPedido(dv?.codigoPedido || compraReciente?.codigoOrden || "");
    setProductoResumen(
      dv?.producto ||
        compraReciente?.items?.map((i) => i.descripcion).join(", ") ||
        ""
    );

    const pProd = Number(dv?.precioProducto ?? 0);
    const pExt = Number(dv?.precioExtras ?? 0);
    const pEnv = Number(dv?.costoEnvio ?? compraReciente?.costoEnvio ?? 0);
    const pEnvExtra = Number(compraReciente?.recargoHorarioExacto ?? 0);
    const totalOrden = Number(compraReciente?.total ?? 0);

    setValorProducto(
      pProd > 0
        ? String(pProd)
        : totalOrden > 0
          ? String(Math.max(0, Math.round((totalOrden - pEnv - pEnvExtra) * 100) / 100))
          : "0"
    );
    setValorExtras(String(pExt > 0 ? pExt : 0));
    setExtrasComisionan(true);
    setDeliveryFijo(String(pEnv > 0 ? pEnv : 0));
    setDeliveryExtra(String(pEnvExtra > 0 ? pEnvExtra : 0));
    setDescuentos("0");
    setComisionPasarela("0");
    setVentaTotalManual("");
    setNotaAdmin("");

    // Por defecto: Ganador único preseleccionando al líder humano de mayor % en el chat
    setRegla("GANADOR_UNICO");
    const lider = participacionChat.liderHumano;
    setGanadorClave(lider?.clave ?? candidatosHumanos[0]?.clave ?? null);

    const manualInit: Record<string, number> = {};
    for (const h of candidatosHumanos) {
      manualInit[h.clave] = h.porcentajeReal;
    }
    setPorcentajesManuales(manualInit);
  }, [abierto, ventaExistente?.id, conversacion?.id]);

  const desgloseCalculado = useMemo(() => {
    const prod = Number(valorProducto) || 0;
    const ext = Number(valorExtras) || 0;
    const delF = Number(deliveryFijo) || 0;
    const delE = Number(deliveryExtra) || 0;
    const desc = Number(descuentos) || 0;
    const pas = Number(comisionPasarela) || 0;
    const sumaAuto = Math.max(0, Math.round((prod + ext + delF + delE - desc) * 100) / 100);
    const totalEfectivo =
      ventaTotalManual.trim() !== "" && Number(ventaTotalManual) >= 0
        ? Number(ventaTotalManual)
        : sumaAuto;

    return calcularBaseComisionableVenta({
      ventaTotalUsd: totalEfectivo,
      valorProductoUsd: prod,
      valorExtrasUsd: ext,
      extrasComisionan,
      deliveryFijoUsd: delF,
      deliveryExtraUsd: delE,
      descuentosUsd: desc,
      comisionPasarelaUsd: pas,
    });
  }, [
    valorProducto,
    valorExtras,
    extrasComisionan,
    deliveryFijo,
    deliveryExtra,
    descuentos,
    comisionPasarela,
    ventaTotalManual,
  ]);

  const reparto = useMemo(
    () =>
      calcularRepartoComisionesVenta({
        baseComisionableUsd: desgloseCalculado.baseComisionableUsd,
        participantesHumanos: candidatosHumanos,
        regla,
        ganadorClave,
        porcentajesManuales,
        tasasPorUsuarioId,
        tasaPorDefectoPct,
      }),
    [
      desgloseCalculado.baseComisionableUsd,
      candidatosHumanos,
      regla,
      ganadorClave,
      porcentajesManuales,
      tasasPorUsuarioId,
      tasaPorDefectoPct,
    ]
  );

  if (!abierto) return null;

  const sumaManualExcede = reparto.totalPorcentajeAsignado > 100.01;
  const porcentajeIaEfectivo = ventaExistente
    ? ventaExistente.porcentajeIaChat
    : participacionChat.porcentajeIa;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (desgloseCalculado.ventaTotalUsd <= 0) {
      setErrorMsg("Ingresa el valor de la venta antes de guardar.");
      return;
    }
    if (sumaManualExcede) {
      setErrorMsg(
        `La suma de porcentajes asignados (${reparto.totalPorcentajeAsignado}%) no puede superar el 100%.`
      );
      return;
    }

    setGuardando(true);
    setErrorMsg(null);

    const asignacionesGuardar = reparto.asignaciones.filter(
      (a) => a.porcentajeComisionAsignado > 0 || a.porcentajeParticipacionChat > 0
    );

    const res = await registrarVentaComisionAction({
      negocio,
      id: ventaExistente?.id ?? null,
      conversacionId: ventaExistente?.conversacionId ?? conversacion?.id ?? null,
      proformaId: ventaExistente?.proformaId ?? comprasVinculadas[0]?.id ?? null,
      codigoPedido: codigoPedido.trim() || null,
      clienteNombre: clienteNombre.trim() || "Cliente",
      clienteTelefono:
        ventaExistente?.clienteTelefono ?? conversacion?.remitenteTelefono ?? null,
      canal: ventaExistente?.canal ?? conversacion?.canal ?? "whatsapp",
      productoResumen: productoResumen.trim() || null,
      desglose: desgloseCalculado,
      porcentajeIaChat: porcentajeIaEfectivo,
      reglaReparto: regla,
      liderHumanoNombre:
        participacionChat.liderHumano?.nombre ??
        ventaExistente?.liderHumanoNombre ??
        null,
      asignaciones: asignacionesGuardar,
      notaAdmin: notaAdmin.trim() || null,
    });

    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    onGuardado(res.venta);
    onCerrar();
  };

  const estiloInput: React.CSSProperties = {
    width: "100%",
    minHeight: "36px",
    padding: "6px 9px",
    borderRadius: "8px",
    border: "1px solid #D5CFC4",
    background: "#FFFFFF",
    color: "#1F1C19",
    fontSize: esMovil ? "16px" : "0.82rem",
    boxSizing: "border-box",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cierre de venta y reparto de comisiones"
      onClick={() => {
        if (!guardando) onCerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9996,
        background: "rgba(24, 24, 27, 0.54)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: esMovil ? "flex-end" : "center",
        justifyContent: "center",
        padding: esMovil ? 0 : "14px",
      }}
    >
      <form
        onSubmit={handleGuardar}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: esMovil ? "100%" : "640px",
          maxHeight: esMovil ? "93dvh" : "90vh",
          background: "#FFFFFF",
          borderRadius: esMovil ? "18px 18px 0 0" : "16px",
          border: "1px solid #E6E2DA",
          boxShadow: "0 24px 60px rgba(24, 24, 27, 0.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #ECE8E1",
            background: "#FAF8F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#221E1B",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Calculator size={18} />
            </div>
            <div>
              <strong style={{ fontSize: "0.94rem", color: "#1F1C19", display: "block" }}>
                {ventaExistente ? "Editar reparto y comisión" : "Cierre de Venta y Comisión"}
              </strong>
              <span style={{ fontSize: "0.73rem", color: "#6E6861" }}>
                Desglose financiero y asignación por participación real en el chat
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ventana"
            aria-label="Cerrar"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "9px",
              border: "1px solid #E6E2DA",
              background: "#FFFFFF",
              color: "#57524C",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo desplazable */}
        <div
          style={{
            padding: "14px 18px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {errorMsg && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "9px",
                background: "#FAF2F2",
                border: "1px solid #E5CACA",
                color: "#8A2E2E",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* 1. Participación real detectada en el chat */}
          <div
            style={{
              padding: "11px 13px",
              borderRadius: "12px",
              background: "#FAF8F5",
              border: "1px solid #E6E2DA",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "#1F1C19",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Users size={14} />
                <span>Participación en la atención del chat</span>
              </span>
              {participacionChat.liderHumano && (
                <span
                  style={{
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "#F2F6F3",
                    border: "1px solid #CEDDD3",
                    color: "#2F4737",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Award size={11} />
                  <span>Mayor aporte: {participacionChat.liderHumano.nombre}</span>
                </span>
              )}
            </div>

            {participacionChat.totalMensajesAtencion > 0 ? (
              <>
                <div
                  style={{
                    display: "flex",
                    height: "8px",
                    borderRadius: "999px",
                    overflow: "hidden",
                    background: "#E6E2DA",
                  }}
                >
                  {participacionChat.participantes.map((p, i) => (
                    <div
                      key={p.clave}
                      title={`${p.nombre}: ${p.porcentajeReal}% (${p.mensajesConteo} msg)`}
                      style={{
                        width: `${p.porcentajeReal}%`,
                        background: p.esIa
                          ? "#6E8F79"
                          : COLORES_BARRA[i % COLORES_BARRA.length],
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {participacionChat.participantes.map((p) => (
                    <span
                      key={p.clave}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: p.esIa ? "#F2F6F3" : "#FFFFFF",
                        border: "1px solid #E6E2DA",
                        color: p.esIa ? "#2F4737" : "#221E1B",
                        fontSize: "0.71rem",
                        fontWeight: 700,
                      }}
                    >
                      {p.esIa && <Bot size={11} />}
                      <span>
                        {p.nombre}: {p.porcentajeReal}%
                      </span>
                      <span style={{ color: "#847D74", fontWeight: 500 }}>
                        ({p.mensajesConteo})
                      </span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span style={{ fontSize: "0.74rem", color: "#847D74" }}>
                Sin mensajes salientes registrados aún en este ciclo. Puedes asignar el reparto manualmente abajo.
              </span>
            )}
          </div>

          {/* 2. Datos básicos + Desglose Financiero */}
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: esMovil ? "1fr" : "1.3fr 1fr",
                gap: "8px",
              }}
            >
              <div>
                <label style={{ fontSize: "0.71rem", fontWeight: 700, color: "#57524C" }}>
                  Cliente
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.71rem", fontWeight: 700, color: "#57524C" }}>
                  Código de pedido / orden
                </label>
                <input
                  type="text"
                  value={codigoPedido}
                  onChange={(e) => setCodigoPedido(e.target.value)}
                  placeholder="TNK-ORD-..."
                  style={estiloInput}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.71rem", fontWeight: 700, color: "#57524C" }}>
                Arreglo / Producto vendido
              </label>
              <input
                type="text"
                value={productoResumen}
                onChange={(e) => setProductoResumen(e.target.value)}
                placeholder="Ej: Bouquet Coreano 24 rosas + Ferrero"
                style={estiloInput}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: esMovil ? "1fr 1fr" : "repeat(3, 1fr)",
                gap: "8px",
              }}
            >
              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C" }}>
                  Arreglo / Producto ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorProducto}
                  onChange={(e) => {
                    setValorProducto(e.target.value);
                    setVentaTotalManual("");
                  }}
                  style={estiloInput}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C" }}>
                  Extras ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorExtras}
                  onChange={(e) => {
                    setValorExtras(e.target.value);
                    setVentaTotalManual("");
                  }}
                  style={estiloInput}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C" }}>
                  Delivery fijo ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryFijo}
                  onChange={(e) => {
                    setDeliveryFijo(e.target.value);
                    setVentaTotalManual("");
                  }}
                  style={estiloInput}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C" }}>
                  Cargo extra delivery ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryExtra}
                  onChange={(e) => {
                    setDeliveryExtra(e.target.value);
                    setVentaTotalManual("");
                  }}
                  style={estiloInput}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C" }}>
                  Descuento ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={descuentos}
                  onChange={(e) => {
                    setDescuentos(e.target.value);
                    setVentaTotalManual("");
                  }}
                  style={estiloInput}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C" }}>
                  Comisión pasarela ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={comisionPasarela}
                  onChange={(e) => setComisionPasarela(e.target.value)}
                  style={estiloInput}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                padding: "9px 12px",
                borderRadius: "10px",
                background: "#F2F6F3",
                border: "1px solid #CEDDD3",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: "#2B4A36",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={extrasComisionan}
                  onChange={(e) => setExtrasComisionan(e.target.checked)}
                />
                <span>Incluir extras en base comisionable</span>
              </label>

              <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.76rem", color: "#57524C" }}>
                  Venta Total:{" "}
                  <strong style={{ color: "#1F1C19" }}>
                    ${desgloseCalculado.ventaTotalUsd.toFixed(2)}
                  </strong>
                </span>
                <span style={{ fontSize: "0.8rem", color: "#2F4737" }}>
                  Base Comisionable:{" "}
                  <strong>${desgloseCalculado.baseComisionableUsd.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 3. Regla de Reparto de Comisión */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <strong style={{ fontSize: "0.78rem", color: "#1F1C19" }}>
                ¿Cómo asignar la comisión?
              </strong>
              <span style={{ fontSize: "0.71rem", color: "#6E6861" }}>
                Total asignado:{" "}
                <strong style={{ color: sumaManualExcede ? "#8A2E2E" : "#2F4737" }}>
                  {reparto.totalPorcentajeAsignado}%
                </strong>{" "}
                · Comisión total:{" "}
                <strong style={{ color: "#1F1C19" }}>
                  ${reparto.totalComisionUsd.toFixed(2)}
                </strong>
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(
                [
                  { id: "GANADOR_UNICO", etiqueta: "Ganador único (100%)" },
                  { id: "PROPORCIONAL_REAL", etiqueta: "Proporcional real (IA tienda)" },
                  { id: "PROPORCIONAL_HUMANOS", etiqueta: "Proporcional humanos (100%)" },
                  { id: "MANUAL", etiqueta: "Manual libre (%)" },
                ] as const
              ).map((op) => {
                const activa = regla === op.id;
                const deshabilitada = !esAdmin && op.id !== "GANADOR_UNICO";
                return (
                  <button
                    key={op.id}
                    type="button"
                    disabled={deshabilitada}
                    onClick={() => {
                      setRegla(op.id);
                      if (op.id === "MANUAL") {
                        const mapa: Record<string, number> = {};
                        for (const a of reparto.asignaciones) {
                          mapa[a.clave] = a.porcentajeComisionAsignado;
                        }
                        setPorcentajesManuales(mapa);
                      }
                    }}
                    title={
                      deshabilitada
                        ? "Solo el Administrador puede cambiar la regla de reparto"
                        : op.etiqueta
                    }
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: activa ? "1px solid #221E1B" : "1px solid #D5CFC4",
                      background: activa ? "#221E1B" : "#FFFFFF",
                      color: activa ? "#FFFFFF" : "#57524C",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      cursor: deshabilitada ? "not-allowed" : "pointer",
                      opacity: deshabilitada ? 0.5 : 1,
                    }}
                  >
                    {op.etiqueta}
                  </button>
                );
              })}
            </div>

            {/* Tabla de asesores y comisiones resultantes */}
            <div
              style={{
                border: "1px solid #E6E2DA",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              {reparto.asignaciones.map((asig) => {
                const esGanador = regla === "GANADOR_UNICO" && asig.clave === ganadorClave;
                return (
                  <div
                    key={asig.clave}
                    style={{
                      display: "grid",
                      gridTemplateColumns: esMovil
                        ? "1.4fr 0.8fr 0.8fr"
                        : "1.4fr 0.75fr 0.95fr 0.65fr 0.8fr",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderBottom: "1px solid #F4F2EE",
                      background: asig.porcentajeComisionAsignado > 0 ? "#FAF8F5" : "#FFFFFF",
                      fontSize: "0.76rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                      {regla === "GANADOR_UNICO" && (
                        <input
                          type="radio"
                          name="ganador_comision"
                          checked={esGanador}
                          disabled={!esAdmin}
                          onChange={() => setGanadorClave(asig.clave)}
                          aria-label={`Asignar 100% a ${asig.asesorNombre}`}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            color: "#1F1C19",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {asig.asesorNombre}
                        </strong>
                        <span style={{ fontSize: "0.67rem", color: "#847D74" }}>
                          Chat: {asig.porcentajeParticipacionChat}% · Tasa: {asig.tasaComisionAsesorPct}%
                        </span>
                      </div>
                    </div>

                    {!esMovil && (
                      <span style={{ color: "#6E6861", textAlign: "right" }}>
                        {asig.porcentajeParticipacionChat}% chat
                      </span>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                      {regla === "MANUAL" ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={porcentajesManuales[asig.clave] ?? 0}
                          onChange={(e) =>
                            setPorcentajesManuales((prev) => ({
                              ...prev,
                              [asig.clave]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            }))
                          }
                          aria-label={`Porcentaje para ${asig.asesorNombre}`}
                          style={{
                            width: "62px",
                            padding: "4px 6px",
                            borderRadius: "6px",
                            border: "1px solid #D5CFC4",
                            textAlign: "right",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                          }}
                        />
                      ) : (
                        <strong style={{ color: "#221E1B" }}>
                          {asig.porcentajeComisionAsignado}%
                        </strong>
                      )}
                      {regla === "MANUAL" && <span style={{ color: "#6E6861" }}>%</span>}
                    </div>

                    {!esMovil && (
                      <span style={{ color: "#6E6861", textAlign: "right" }}>
                        × {asig.tasaComisionAsesorPct}%
                      </span>
                    )}

                    <strong style={{ color: "#2F4737", textAlign: "right" }}>
                      ${asig.montoComisionUsd.toFixed(2)}
                    </strong>
                  </div>
                );
              })}
            </div>

            {esAdmin && (
              <input
                type="text"
                value={notaAdmin}
                onChange={(e) => setNotaAdmin(e.target.value)}
                placeholder="Nota del administrador (opcional, ej. Nan cerró la venta tras seguimiento de IA)…"
                style={estiloInput}
              />
            )}
          </div>
        </div>

        {/* Pie fijo */}
        <div
          style={{
            padding: esMovil
              ? "11px 16px calc(11px + env(safe-area-inset-bottom, 0px))"
              : "12px 18px",
            borderTop: "1px solid #ECE8E1",
            background: "#FAF8F5",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            type="button"
            disabled={guardando}
            onClick={onCerrar}
            title="Cancelar sin registrar venta"
            aria-label="Cancelar"
            style={{
              minHeight: "40px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid #D5CFC4",
              background: "#FFFFFF",
              color: "#57524C",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: guardando ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={guardando || sumaManualExcede}
            title="Registrar venta cerrada y asignación de comisión"
            aria-label="Guardar venta"
            style={{
              minHeight: "40px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              background: "#221E1B",
              color: "#FFFFFF",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: guardando || sumaManualExcede ? "not-allowed" : "pointer",
              opacity: sumaManualExcede ? 0.5 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {guardando ? (
              <Loader2 size={15} />
            ) : ventaExistente ? (
              <Save size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            <span>{guardando ? "Guardando…" : "Guardar venta"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
