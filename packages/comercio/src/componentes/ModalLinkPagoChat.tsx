"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Link2,
  Loader2,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  crearLinkPagoChatAction,
  obtenerPasarelasCheckoutAction,
  type LinkPagoChatCreado,
} from "../acciones-plux";
import { guardarDatosVentaOmnicanalAction } from "../acciones-omnicanal";
import { obtenerConfiguracionTiendaCheckoutAction } from "../acciones-tienda-checkout";
import {
  autoCompletarDatosVentaDesdeMensajes,
  calcularTotalDatosVenta,
  type ConversacionOmnicanal,
  type DatosVentaConversacion,
  type MensajeOmnicanal,
} from "../omnicanal";

export interface PropsModalLinkPagoChat {
  abierto: boolean;
  negocio: string;
  conversacion: ConversacionOmnicanal | null;
  mensajes: MensajeOmnicanal[];
  montoInicialOverride?: number | null;
  esMovil?: boolean;
  enviandoChat?: boolean;
  onCerrar: () => void;
  onEnviarLinkAlChat: (
    textoMensaje: string,
    datosVentaActualizados?: DatosVentaConversacion
  ) => Promise<void>;
  onInsertarEnCompositor: (
    textoMensaje: string,
    datosVentaActualizados?: DatosVentaConversacion
  ) => void;
}

function construirTextoMensajeLinkPago(params: {
  clienteNombre?: string;
  concepto: string;
  montoTotal: number;
  urlPago: string;
  codigo: string;
  notaAdicional?: string;
  tarjetaHabilitada: boolean;
}): string {
  const saludo =
    params.clienteNombre &&
    !/^(cliente|cliente chat|visitante web|whatsapp)/i.test(params.clienteNombre.trim())
      ? `Hola ${params.clienteNombre.trim().split(/\s+/)[0]},`
      : "Hola,";

  const lineas: string[] = [
    `${saludo} aquí tienes tu enlace seguro de pago 💳✨`,
    "",
    `• *Concepto:* ${params.concepto}`,
    `• *Valor a pagar:* $${params.montoTotal.toFixed(2)} USD`,
    `• *Referencia:* ${params.codigo}`,
    "",
    `👉 ${params.urlPago}`,
  ];

  if (params.tarjetaHabilitada) {
    lineas.push(
      "",
      "Puedes pagar al instante con tarjeta de crédito/débito o por transferencia/DeUna."
    );
  } else {
    lineas.push(
      "",
      "Desde este enlace puedes revisar el resumen y confirmar tu pago por DeUna o transferencia bancaria."
    );
  }

  if (params.notaAdicional?.trim()) {
    lineas.push("", params.notaAdicional.trim());
  }

  return lineas.join("\n");
}

export function ModalLinkPagoChat({
  abierto,
  negocio,
  conversacion,
  mensajes,
  montoInicialOverride = null,
  esMovil = false,
  enviandoChat = false,
  onCerrar,
  onEnviarLinkAlChat,
  onInsertarEnCompositor,
}: PropsModalLinkPagoChat) {
  const inputMontoRef = useRef<HTMLInputElement | null>(null);

  const [montoTexto, setMontoTexto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [ivaPorcentaje, setIvaPorcentaje] = useState<0 | 15>(0);
  const [clienteNombre, setClienteNombre] = useState("");
  const [notaAdicional, setNotaAdicional] = useState("");
  const [tarjetaActiva, setTarjetaActiva] = useState<boolean | null>(null);
  const [ambientePlux, setAmbientePlux] = useState<string>("PRUEBAS");
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [linkGenerado, setLinkGenerado] = useState<LinkPagoChatCreado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const datosSugeridos = useMemo(() => {
    if (!conversacion) return null;
    return autoCompletarDatosVentaDesdeMensajes(
      conversacion.datosVenta,
      mensajes,
      conversacion
    );
  }, [conversacion, mensajes]);

  const totalDesdeCamposChat = useMemo(() => {
    return calcularTotalDatosVenta(datosSugeridos);
  }, [datosSugeridos]);

  const desgloseOrigenChat = useMemo(() => {
    if (!datosSugeridos) return "";
    const partes: string[] = [];
    if (Number(datosSugeridos.precioProducto) > 0) {
      partes.push(`Producto $${Number(datosSugeridos.precioProducto).toFixed(2)}`);
    }
    if (Number(datosSugeridos.precioExtras) > 0) {
      partes.push(`Extras $${Number(datosSugeridos.precioExtras).toFixed(2)}`);
    }
    if (Number(datosSugeridos.costoEnvio) > 0) {
      partes.push(`Envío $${Number(datosSugeridos.costoEnvio).toFixed(2)}`);
    }
    if (
      datosSugeridos.totalManual != null &&
      Number(datosSugeridos.totalManual) > 0
    ) {
      return `Total manual en campos del chat: $${Number(datosSugeridos.totalManual).toFixed(2)}`;
    }
    return partes.length > 0 ? `Tomado de Campos de Venta: ${partes.join(" + ")}` : "";
  }, [datosSugeridos]);

  // Inicializar formulario al abrir el modal
  useEffect(() => {
    if (!abierto || !conversacion) return;

    const montoBase =
      montoInicialOverride != null && montoInicialOverride > 0
        ? montoInicialOverride
        : totalDesdeCamposChat > 0
          ? totalDesdeCamposChat
          : null;

    setMontoTexto(montoBase != null ? montoBase.toFixed(2) : "");

    const partesConcepto = [
      datosSugeridos?.producto?.trim(),
      datosSugeridos?.extras?.trim() ? `+ ${datosSugeridos.extras.trim()}` : null,
    ].filter(Boolean);
    const conceptoInicial =
      partesConcepto.length > 0
        ? partesConcepto.join(" ")
        : negocio.toLowerCase().includes("tinkay") || negocio.toLowerCase().includes("margarita")
          ? "Arreglo floral personalizado"
          : "Pedido personalizado";
    setConcepto(conceptoInicial);

    const nombreLimpio =
      datosSugeridos?.nombreCliente?.trim() ||
      (conversacion.remitenteNombre &&
      !/^(Visitante Web|WhatsApp\s*\+)/i.test(conversacion.remitenteNombre)
        ? conversacion.remitenteNombre.trim()
        : "");
    setClienteNombre(nombreLimpio);

    setIvaPorcentaje(
      negocio.toLowerCase().includes("tinkay") || negocio.toLowerCase().includes("margarita")
        ? 0
        : 15
    );
    setNotaAdicional("");
    setErrorMsg(null);
    setLinkGenerado(null);
    setCopiado(false);

    // Consultar estado real del procesador de tarjeta
    let cancelado = false;
    setCargandoEstado(true);
    Promise.all([
      obtenerConfiguracionTiendaCheckoutAction(negocio).catch(() => null),
      obtenerPasarelasCheckoutAction(negocio).catch(() => ({ ok: false as const, error: "" })),
    ])
      .then(([cfg, pasRes]) => {
        if (cancelado) return;
        const plux = pasRes.ok
          ? pasRes.data.find((p) => p.pasarela === "PLUX")
          : undefined;
        const habilitada =
          cfg?.tarjetaCreditoHabilitada !== false && Boolean(plux);
        setTarjetaActiva(habilitada);
        if (plux?.ambiente) setAmbientePlux(plux.ambiente);
      })
      .finally(() => {
        if (!cancelado) setCargandoEstado(false);
      });

    setTimeout(() => {
      inputMontoRef.current?.focus();
      inputMontoRef.current?.select();
    }, 80);

    return () => {
      cancelado = true;
    };
  }, [abierto, conversacion?.id, montoInicialOverride]);

  if (!abierto || !conversacion) return null;

  const montoNumerico = Number(montoTexto.replace(",", "."));
  const montoValido = Number.isFinite(montoNumerico) && montoNumerico >= 0.5 && montoNumerico <= 50000;

  const sincronizarDatosVentaTrasLink = async (
    creado: LinkPagoChatCreado
  ): Promise<DatosVentaConversacion | undefined> => {
    const baseDatos: DatosVentaConversacion = {
      ...(datosSugeridos ?? conversacion.datosVenta ?? {}),
      producto:
        (datosSugeridos?.producto || "").trim() || creado.concepto,
      nombreCliente:
        clienteNombre.trim() || datosSugeridos?.nombreCliente || undefined,
      estadoCobro: "PAGO_SOLICITADO",
      codigoPedido:
        (datosSugeridos?.codigoPedido || "").trim() || creado.codigo,
    };

    // Si los campos del chat no tenían total o el monto fue editado distinto al calculado, guardar totalManual
    const totalPrevio = calcularTotalDatosVenta(datosSugeridos);
    if (totalPrevio <= 0 || Math.abs(totalPrevio - creado.montoTotal) >= 0.01) {
      baseDatos.totalManual = creado.montoTotal;
    }

    try {
      await guardarDatosVentaOmnicanalAction({
        negocio,
        conversacionId: conversacion.id,
        datosVenta: baseDatos,
      });
    } catch {
      // No interrumpir el envío del link si el guardado secundario falla
    }
    return baseDatos;
  };

  const generarLink = async (accionPosterior: "ENVIAR" | "SOLO_GENERAR") => {
    setErrorMsg(null);
    if (!montoValido) {
      setErrorMsg("Ingresa un valor válido entre $0.50 y $50,000.00 USD.");
      inputMontoRef.current?.focus();
      return;
    }
    if (!concepto.trim() || concepto.trim().length < 2) {
      setErrorMsg("Ingresa el concepto o descripción del cobro.");
      return;
    }

    setGenerando(true);
    try {
      const originUrl =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : undefined;

      const res = await crearLinkPagoChatAction({
        negocio,
        montoTotal: Math.round(montoNumerico * 100) / 100,
        concepto: concepto.trim(),
        ivaPorcentaje,
        clienteNombre: clienteNombre.trim() || conversacion.remitenteNombre || "Cliente Chat",
        clienteTelefono: conversacion.remitenteTelefono || "",
        clienteCorreo: conversacion.remitenteCorreo || "",
        conversacionId: conversacion.id,
        codigoPedido: datosSugeridos?.codigoPedido || undefined,
        originUrl,
      });

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setLinkGenerado(res.data);
      const datosActualizados = await sincronizarDatosVentaTrasLink(res.data);

      if (accionPosterior === "ENVIAR") {
        const mensajeFinal = construirTextoMensajeLinkPago({
          clienteNombre: clienteNombre.trim(),
          concepto: res.data.concepto,
          montoTotal: res.data.montoTotal,
          urlPago: res.data.urlPago,
          codigo: res.data.codigo,
          notaAdicional,
          tarjetaHabilitada: res.data.tarjetaHabilitada,
        });
        await onEnviarLinkAlChat(mensajeFinal, datosActualizados);
        onCerrar();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo generar el link de pago."
      );
    } finally {
      setGenerando(false);
    }
  };

  const mensajeListo = linkGenerado
    ? construirTextoMensajeLinkPago({
        clienteNombre: clienteNombre.trim(),
        concepto: linkGenerado.concepto,
        montoTotal: linkGenerado.montoTotal,
        urlPago: linkGenerado.urlPago,
        codigo: linkGenerado.codigo,
        notaAdicional,
        tarjetaHabilitada: linkGenerado.tarjetaHabilitada,
      })
    : "";

  const handleCopiarLink = async () => {
    if (!linkGenerado) return;
    try {
      await navigator.clipboard.writeText(linkGenerado.urlPago);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      setErrorMsg("No se pudo copiar al portapapeles.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generar Link de Pago"
      onClick={() => {
        if (!generando && !enviandoChat) onCerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9992,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: esMovil ? "flex-end" : "center",
        justifyContent: "center",
        padding: esMovil ? 0 : "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: esMovil ? "100%" : "490px",
          maxHeight: esMovil ? "92dvh" : "90vh",
          overflowY: "auto",
          background: "#FFFFFF",
          borderRadius: esMovil ? "18px 18px 0 0" : "16px",
          border: "1px solid #E6E2DA",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.24)",
          padding: esMovil ? "16px 16px 22px" : "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#EAF3ED",
                border: "1px solid #C6DEC9",
                color: "#2F4737",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Link2 size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "#1F1C19" }}>
                /LinkPago — Generar Enlace
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#6E6861" }}>
                Para {conversacion.remitenteNombre}
                {conversacion.canal === "whatsapp" ? " · WhatsApp" : " · Chat Web"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={generando || enviandoChat}
            title="Cerrar ventana"
            aria-label="Cerrar"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid #E6E2DA",
              background: "#FAF8F5",
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

        {/* Estado en vivo de tarjeta de crédito */}
        {!cargandoEstado && tarjetaActiva !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 11px",
              borderRadius: "10px",
              background: tarjetaActiva ? "#F0FDF4" : "#FFFBEB",
              border: tarjetaActiva ? "1px solid #BBF7D0" : "1px solid #FDE68A",
              color: tarjetaActiva ? "#166534" : "#92400E",
              fontSize: "0.76rem",
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {tarjetaActiva ? (
              <>
                <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                <span>
                  Tarjeta de crédito/débito <strong>PLUX activa</strong> ({ambientePlux}) + Transferencia / DeUna.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  Pago con tarjeta deshabilitado en Pasarelas. El link solo mostrará Transferencia y DeUna.
                </span>
              </>
            )}
          </div>
        )}

        {/* Formulario de valor y concepto */}
        {!linkGenerado ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Campo principal: Valor USD editable */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#FAF8F5",
                border: "1px solid #E6E2DA",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                  gap: "8px",
                }}
              >
                <label
                  htmlFor="eco-link-pago-monto"
                  style={{ fontSize: "0.78rem", fontWeight: 800, color: "#221E1B" }}
                >
                  Valor a cobrar (USD) *
                </label>
                {totalDesdeCamposChat > 0 && (
                  <button
                    type="button"
                    onClick={() => setMontoTexto(totalDesdeCamposChat.toFixed(2))}
                    title="Restaurar valor tomado de Campos de Venta"
                    style={{
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      color: "#2F4737",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Campos chat: ${totalDesdeCamposChat.toFixed(2)}
                  </button>
                )}
              </div>

              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    color: "#2F4737",
                  }}
                >
                  $
                </span>
                <input
                  id="eco-link-pago-monto"
                  ref={inputMontoRef}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.50"
                  max="50000"
                  placeholder="0.00"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void generarLink("ENVIAR");
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 30px",
                    borderRadius: "10px",
                    border: "1.5px solid #2F4737",
                    background: "#FFFFFF",
                    color: "#1F1C19",
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {desgloseOrigenChat && (
                <p style={{ margin: "6px 0 0", fontSize: "0.71rem", color: "#6E6861" }}>
                  {desgloseOrigenChat} (puedes editar el valor libremente).
                </p>
              )}
            </div>

            {/* Concepto */}
            <div>
              <label
                htmlFor="eco-link-pago-concepto"
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "#57524C",
                  marginBottom: "4px",
                }}
              >
                Concepto / Detalle del pedido *
              </label>
              <input
                id="eco-link-pago-concepto"
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Bouquet 24 rosas rojas + envío Norte"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #D5CFC4",
                  fontSize: "0.85rem",
                  color: "#1F1C19",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Fila IVA + Nombre cliente */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#57524C",
                    marginBottom: "4px",
                  }}
                >
                  Tarifa IVA
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {([0, 15] as const).map((pct) => {
                    const sel = ivaPorcentaje === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setIvaPorcentaje(pct)}
                        style={{
                          padding: "8px 6px",
                          borderRadius: "8px",
                          border: sel ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                          background: sel ? "#EAF3ED" : "#FFFFFF",
                          color: sel ? "#1F352C" : "#57524C",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {pct === 0 ? "0% Flores" : "15% IVA"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="eco-link-pago-cliente"
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#57524C",
                    marginBottom: "4px",
                  }}
                >
                  Nombre cliente (opcional)
                </label>
                <input
                  id="eco-link-pago-cliente"
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: María López"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    fontSize: "0.82rem",
                    color: "#1F1C19",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Nota opcional */}
            <div>
              <label
                htmlFor="eco-link-pago-nota"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#57524C",
                  marginBottom: "4px",
                }}
              >
                Nota adicional en el mensaje (opcional)
              </label>
              <input
                id="eco-link-pago-nota"
                type="text"
                value={notaAdicional}
                onChange={(e) => setNotaAdicional(e.target.value)}
                placeholder="Ej: Incluye entrega hoy de 15h00 a 17h00"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  fontSize: "0.82rem",
                  color: "#1F1C19",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#B91C1C",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Botonera principal */}
            <div style={{ display: "flex", gap: "8px", paddingTop: "2px" }}>
              <button
                type="button"
                disabled={generando || enviandoChat || !montoValido}
                onClick={() => void generarLink("SOLO_GENERAR")}
                title="Generar el enlace sin enviarlo todavía"
                aria-label="Solo Generar"
                style={{
                  flex: 1,
                  minHeight: "42px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#221E1B",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: generando || !montoValido ? "not-allowed" : "pointer",
                  opacity: generando || !montoValido ? 0.55 : 1,
                }}
              >
                {generando ? <Loader2 size={15} /> : <Link2 size={15} />}
                <span>Solo Generar</span>
              </button>

              <button
                type="button"
                disabled={generando || enviandoChat || !montoValido}
                onClick={() => void generarLink("ENVIAR")}
                title="Generar el link de pago y enviarlo inmediatamente al cliente"
                aria-label="Generar y Enviar"
                style={{
                  flex: 1.4,
                  minHeight: "42px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: generando || enviandoChat || !montoValido ? "not-allowed" : "pointer",
                  opacity: generando || enviandoChat || !montoValido ? 0.55 : 1,
                }}
              >
                {generando || enviandoChat ? <Loader2 size={15} /> : <Send size={15} />}
                <span>Generar y Enviar</span>
              </button>
            </div>
          </div>
        ) : (
          /* Estado tras "Solo Generar": enlace listo para copiar, insertar o enviar */
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534" }}>
                <CheckCircle2 size={17} />
                <strong style={{ fontSize: "0.86rem" }}>
                  Link generado · {linkGenerado.codigo} (${linkGenerado.montoTotal.toFixed(2)} USD)
                </strong>
              </div>
              <a
                href={linkGenerado.urlPago}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.78rem",
                  color: "#15803D",
                  wordBreak: "break-all",
                  textDecoration: "underline",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{linkGenerado.urlPago}</span>
                <ExternalLink size={12} style={{ flexShrink: 0 }} />
              </a>
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                background: "#FAF8F5",
                border: "1px solid #E6E2DA",
                fontSize: "0.77rem",
                color: "#3A3530",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
                maxHeight: "170px",
                overflowY: "auto",
              }}
            >
              {mensajeListo}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                onClick={() => void handleCopiarLink()}
                title="Copiar enlace de pago"
                aria-label="Copiar Link"
                style={{
                  flex: 1,
                  minHeight: "40px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  padding: "8px 10px",
                  borderRadius: "9px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#221E1B",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiado ? <Check size={14} color="#166534" /> : <Copy size={14} />}
                <span>{copiado ? "Copiado" : "Copiar Link"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onInsertarEnCompositor(mensajeListo);
                  onCerrar();
                }}
                title="Insertar texto y link en el campo de mensaje para editarlo antes de enviar"
                aria-label="Insertar"
                style={{
                  flex: 1,
                  minHeight: "40px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  padding: "8px 10px",
                  borderRadius: "9px",
                  border: "1px solid #D5CFC4",
                  background: "#FAF8F5",
                  color: "#221E1B",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <CreditCard size={14} />
                <span>Insertar</span>
              </button>

              <button
                type="button"
                disabled={enviandoChat}
                onClick={async () => {
                  await onEnviarLinkAlChat(mensajeListo);
                  onCerrar();
                }}
                title="Enviar enlace al cliente ahora"
                aria-label="Enviar Ahora"
                style={{
                  flex: 1.3,
                  minHeight: "40px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  padding: "8px 12px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: enviandoChat ? "wait" : "pointer",
                }}
              >
                {enviandoChat ? <Loader2 size={14} /> : <Send size={14} />}
                <span>Enviar Ahora</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
