"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  Printer,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";
import {
  confirmarOrdenTransferenciaProformaAction,
  type ProformaEventoPublica,
} from "../acciones-logistica";
import {
  obtenerConfiguracionTiendaCheckoutAction,
  subirComprobanteTransferenciaAction,
} from "../acciones-tienda-checkout";
import { type PagoPluxConsultado } from "../acciones-plux";
import { type FacturaElectronicaResumen } from "../acciones";
import {
  construirUrlWhatsappTienda,
  crearConfiguracionTiendaCheckoutPorDefecto,
  type ComprobanteTransferenciaSubido,
  type ConfiguracionTiendaCheckout,
} from "../configuracion-tienda-checkout";
import {
  descargarArchivoFacturaRideSri,
  imprimirFacturaRideSri,
  type ConfiguracionEmisorSri,
} from "../ride-sri";
import { BotonPagoPlux } from "./BotonPagoPlux";

export interface PropsVistaLinkPagoCliente {
  proformaInicial: ProformaEventoPublica;
  ambientePlux: string;
  tarjetaHabilitada: boolean;
  configCheckoutInicial?: ConfiguracionTiendaCheckout | null;
}

const ESTADOS_PAGADOS = new Set([
  "APROBADA",
  "PAGADO",
  "FACTURADA",
  "EN_PREPARACION",
  "DESPACHADO",
  "ENTREGADO",
]);

function nombreMarcaNegocio(negocio: string): string {
  const n = (negocio || "tinkay").trim().toLowerCase();
  if (n.includes("tinkay")) return "Tinkay Floristería";
  if (n.includes("margarita")) return "Margaritas Floristería";
  if (n.includes("fastfix")) return "FastFix Home";
  return "Tranqi";
}

export function VistaLinkPagoCliente({
  proformaInicial,
  ambientePlux,
  tarjetaHabilitada,
  configCheckoutInicial = null,
}: PropsVistaLinkPagoCliente) {
  const [proforma, setProforma] = useState<ProformaEventoPublica>(proformaInicial);
  const [configCheckout, setConfigCheckout] = useState<ConfiguracionTiendaCheckout>(
    () => configCheckoutInicial ?? crearConfiguracionTiendaCheckoutPorDefecto(proformaInicial.negocio)
  );

  const tarjetaDisponible =
    tarjetaHabilitada && configCheckout.tarjetaCreditoHabilitada !== false;
  const transferenciaDisponible = configCheckout.transferencia.habilitada !== false;

  const [mostrarPagoTarjeta, setMostrarPagoTarjeta] = useState<boolean>(
    !transferenciaDisponible && tarjetaDisponible
  );

  const [emailOpcionalInput, setEmailOpcionalInput] = useState(
    proformaInicial.comprador.correo || ""
  );
  const [emailConfirmadoPlux, setEmailConfirmadoPlux] = useState(
    proformaInicial.comprador.correo || ""
  );
  const [telefonoOpcionalInput, setTelefonoOpcionalInput] = useState(
    proformaInicial.comprador.whatsapp || ""
  );
  const [telefonoConfirmadoPlux, setTelefonoConfirmadoPlux] = useState(
    proformaInicial.comprador.whatsapp || ""
  );
  const tieneTelefonoInicial = Boolean(
    (proformaInicial.comprador.whatsapp || "").replace(/\D+/g, "").length >= 7
  );

  const [comprobanteSubido, setComprobanteSubido] =
    useState<ComprobanteTransferenciaSubido | null>(null);
  const [notaTransferencia, setNotaTransferencia] = useState("");
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [confirmandoTransferencia, setConfirmandoTransferencia] = useState(false);
  const [campoCopiado, setCampoCopiado] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );
  const [facturaEmitida, setFacturaEmitida] = useState<{
    factura: FacturaElectronicaResumen;
    emisor?: ConfiguracionEmisorSri | null;
    autorizacion?: string | null;
  } | null>(null);

  useEffect(() => {
    if (configCheckoutInicial) return;
    obtenerConfiguracionTiendaCheckoutAction(proforma.negocio)
      .then((cfg) => {
        if (cfg) {
          setConfigCheckout(cfg);
          if (cfg.tarjetaCreditoHabilitada === false) {
            setMostrarPagoTarjeta(false);
          }
        }
      })
      .catch(() => {});
  }, [proforma.negocio, configCheckoutInicial]);

  useEffect(() => {
    if (!tarjetaDisponible && mostrarPagoTarjeta) {
      setMostrarPagoTarjeta(false);
    }
  }, [tarjetaDisponible, mostrarPagoTarjeta]);

  const estaPagado =
    ESTADOS_PAGADOS.has(proforma.estado) ||
    (proforma.montoAbonadoUsd >= proforma.total - 0.01 && proforma.total > 0);
  const esTransferenciaConfirmada = proforma.estado === "ORDEN_CONFIRMADA";
  const estaVencidoORechazado =
    proforma.estado === "RECHAZADA" || proforma.estado === "VENCIDA";

  const conceptoPrincipal = useMemo(() => {
    const primero = proforma.items?.[0]?.descripcion?.trim();
    if (primero) return primero;
    return `Pago ${proforma.codigoProforma}`;
  }, [proforma]);

  const pagadorPlux = useMemo(() => {
    const nombreBase =
      proforma.comprador.nombreCompleto &&
      !/^(cliente chat|consumidor final)$/i.test(proforma.comprador.nombreCompleto.trim())
        ? proforma.comprador.nombreCompleto.trim()
        : "Cliente";
    const email =
      emailConfirmadoPlux.trim() ||
      configCheckout.transferencia.correoTitular ||
      "clientes@tinkay.com";
    const telefono =
      telefonoConfirmadoPlux.replace(/\D+/g, "") ||
      (proforma.comprador.whatsapp || "").replace(/\D+/g, "") ||
      "0999999999";
    return {
      nombre: nombreBase,
      identificacion: "9999999999",
      email,
      telefono,
      direccion: proforma.ubicacion?.direccion?.trim() || "Quito, Ecuador",
    };
  }, [
    proforma.comprador.nombreCompleto,
    proforma.comprador.whatsapp,
    proforma.ubicacion?.direccion,
    emailConfirmadoPlux,
    telefonoConfirmadoPlux,
    configCheckout.transferencia.correoTitular,
  ]);

  const copiarTexto = async (clave: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCampoCopiado(clave);
      setTimeout(() => setCampoCopiado((prev) => (prev === clave ? null : prev)), 2000);
    } catch {
      // Sin acceso al portapapeles
    }
  };

  const handlePagoPluxAprobado = (identificador: string, pago: PagoPluxConsultado) => {
    setProforma((prev) => ({
      ...prev,
      estado: "APROBADA",
      montoAbonadoUsd: prev.total,
      saldoPendienteUsd: 0,
      ultimoPagoPlux: {
        identificador,
        autorizacion: pago.autorizacion || identificador,
        marca: pago.marcaTarjeta || undefined,
        ultimosDigitos: pago.ultimosDigitos || undefined,
        montoUsd: prev.total,
        confirmadoEn: new Date().toISOString(),
      },
    }));
    if (pago.facturaElectronica) {
      setFacturaEmitida({
        factura: pago.facturaElectronica,
        emisor: pago.emisorFactura ?? null,
        autorizacion: pago.autorizacion ?? null,
      });
    }
    setFeedback({
      tipo: "ok",
      texto: "¡Pago con tarjeta aprobado! Tu pedido queda confirmado al instante.",
    });
  };

  const handleSubirComprobante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoComprobante(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.set("negocio", proforma.negocio);
      fd.set("archivo", file);
      const res = await subirComprobanteTransferenciaAction(fd);
      if (!res.ok) {
        setFeedback({ tipo: "error", texto: res.error });
      } else {
        setComprobanteSubido(res.comprobante);
      }
    } catch {
      setFeedback({ tipo: "error", texto: "No se pudo subir el comprobante. Intenta nuevamente." });
    } finally {
      setSubiendoComprobante(false);
    }
  };

  const handleConfirmarTransferencia = async () => {
    if (!comprobanteSubido) {
      setFeedback({
        tipo: "error",
        texto: "Adjunta la foto o PDF de tu comprobante de pago antes de confirmar.",
      });
      return;
    }
    setConfirmandoTransferencia(true);
    setFeedback(null);
    try {
      const res = await confirmarOrdenTransferenciaProformaAction({
        tokenAprobacion: proforma.tokenAprobacion,
        modalidadCobro: "TOTAL_100",
        notaTransferencia: notaTransferencia.trim() || undefined,
        comprobanteTransferencia: comprobanteSubido,
      });
      if (!res.ok) {
        setFeedback({ tipo: "error", texto: res.error });
        return;
      }
      setProforma((prev) => ({ ...prev, estado: "ORDEN_CONFIRMADA" }));
      setFeedback({
        tipo: "ok",
        texto: "¡Comprobante enviado! Nuestro equipo verificará la acreditación y confirmará tu pedido.",
      });
    } finally {
      setConfirmandoTransferencia(false);
    }
  };

  const marca = nombreMarcaNegocio(proforma.negocio);
  const urlWhatsappAyuda = construirUrlWhatsappTienda(
    configCheckout.whatsappTienda,
    `Hola ${marca}, tengo una consulta sobre mi link de pago ${proforma.codigoProforma} ($${proforma.total.toFixed(2)}).`
  );

  const estiloInput: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #D6D3D1",
    background: "#FFFFFF",
    color: "#1C1917",
    fontSize: "0.9rem",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FAF8F5 0%, #F3EFE8 100%)",
        color: "#1C1917",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "20px 14px 48px",
      }}
    >
      <div style={{ maxWidth: "560px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Barra superior de marca y seguridad */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "4px 2px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "11px",
                background: "#2D4734",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              {marca.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "#1C1917", lineHeight: 1.15 }}>
                {marca}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.73rem",
                  color: "#2D4734",
                  fontWeight: 600,
                }}
              >
                <Lock size={11} />
                <span>Enlace de pago verificado</span>
              </div>
            </div>
          </div>

          <Link
            href="/"
            title="Explorar tienda"
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#57534E",
              textDecoration: "none",
              padding: "7px 12px",
              borderRadius: "999px",
              background: "#FFFFFF",
              border: "1px solid #E7E5E4",
            }}
          >
            Ir a la tienda
          </Link>
        </header>

        {/* Tarjeta principal de cobro */}
        <section
          style={{
            background: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #E7E5E4",
            boxShadow: "0 10px 32px rgba(28, 25, 23, 0.06)",
            overflow: "hidden",
          }}
        >
          {/* Resumen del valor */}
          <div
            style={{
              padding: "22px 22px 18px",
              background: "linear-gradient(135deg, #2D4734 0%, #1F352C 100%)",
              color: "#FFFFFF",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(255, 255, 255, 0.14)",
                  color: "#F5F5F4",
                }}
              >
                Ref. {proforma.codigoProforma}
              </span>

              <span
                style={{
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: estaPagado
                    ? "#DCFCE7"
                    : esTransferenciaConfirmada
                      ? "#FEF3C7"
                      : "rgba(255,255,255,0.16)",
                  color: estaPagado
                    ? "#166534"
                    : esTransferenciaConfirmada
                      ? "#92400E"
                      : "#FFFFFF",
                }}
              >
                {estaPagado
                  ? "Pagado"
                  : esTransferenciaConfirmada
                    ? "Comprobante enviado"
                    : estaVencidoORechazado
                      ? "No disponible"
                      : "Pendiente de pago"}
              </span>
            </div>

            <div style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.88)", fontWeight: 500 }}>
              {conceptoPrincipal}
            </div>

            <div
              style={{
                marginTop: "6px",
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                ${proforma.total.toFixed(2)}
              </span>
              <span style={{ fontSize: "0.88rem", opacity: 0.85, fontWeight: 600 }}>USD</span>
            </div>

            {proforma.iva > 0 && (
              <div style={{ marginTop: "6px", fontSize: "0.76rem", opacity: 0.82 }}>
                Subtotal ${proforma.subtotal.toFixed(2)} + IVA (15%) ${proforma.iva.toFixed(2)}
              </div>
            )}
          </div>

          <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {feedback && (
              <div
                role="alert"
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: feedback.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
                  border: feedback.tipo === "ok" ? "1px solid #BBF7D0" : "1px solid #FECACA",
                  color: feedback.tipo === "ok" ? "#166534" : "#B91C1C",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                {feedback.tipo === "ok" ? (
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                ) : (
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                )}
                <span>{feedback.texto}</span>
              </div>
            )}

            {/* Estado final: Pagado o Transferencia enviada */}
            {estaPagado || esTransferenciaConfirmada ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: estaPagado ? "#F0FDF4" : "#FFFBEB",
                    border: estaPagado ? "1px solid #BBF7D0" : "1px solid #FDE68A",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: estaPagado ? "#166534" : "#92400E",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    <CheckCircle2 size={20} />
                    <span>
                      {estaPagado
                        ? "¡Gracias! Tu pago fue confirmado"
                        : "Comprobante recibido en verificación"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#44403C", lineHeight: 1.5 }}>
                    {estaPagado
                      ? `Hemos registrado el pago de $${proforma.total.toFixed(2)} USD correspondiente a "${conceptoPrincipal}".`
                      : `Recibimos tu comprobante de transferencia por $${proforma.total.toFixed(2)} USD. ${configCheckout.transferencia.advertenciaAcreditacion}`}
                  </p>
                  {proforma.ultimoPagoPlux?.autorizacion && (
                    <div style={{ marginTop: "4px", fontSize: "0.78rem", color: "#166534", fontWeight: 600 }}>
                      Autorización: {proforma.ultimoPagoPlux.autorizacion}
                      {proforma.ultimoPagoPlux.marca
                        ? ` · ${proforma.ultimoPagoPlux.marca}${
                            proforma.ultimoPagoPlux.ultimosDigitos
                              ? ` •••• ${proforma.ultimoPagoPlux.ultimosDigitos}`
                              : ""
                          }`
                        : ""}
                    </div>
                  )}
                </div>

                {facturaEmitida && (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: "#FAF8F5",
                      border: "1px solid #E7E5E4",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <strong style={{ fontSize: "0.86rem", color: "#1C1917" }}>
                      Factura Electrónica SRI · {facturaEmitida.factura.numero_comprobante}
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const f = facturaEmitida.factura;
                          descargarArchivoFacturaRideSri({
                            negocio: proforma.negocio,
                            emisor: facturaEmitida.emisor,
                            numeroComprobante: f.numero_comprobante,
                            claveAcceso: f.clave_acceso,
                            estadoSri: f.estado,
                            ambiente: f.ambiente,
                            fechaEmision: f.fecha_emision,
                            fechaAutorizacion: f.fecha_autorizacion,
                            comprador: {
                              razonSocial:
                                f.comprador?.razon_social || pagadorPlux.nombre || "CONSUMIDOR FINAL",
                              identificacion:
                                f.comprador?.identificacion ||
                                pagadorPlux.identificacion ||
                                "9999999999999",
                              correo: f.comprador?.correo || pagadorPlux.email,
                              telefono: f.comprador?.telefono || pagadorPlux.telefono,
                              direccion: f.comprador?.direccion || pagadorPlux.direccion,
                            },
                            lineas: f.lineas,
                            rubroPrincipal: f.rubro_facturado,
                            codigoRubroPrincipal: f.codigo_rubro,
                            subtotal15: f.subtotal_15,
                            subtotal0: f.subtotal_0,
                            subtotalGeneral: f.subtotal,
                            iva15: f.iva,
                            total: f.total,
                            formaPagoTexto: "19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)",
                            referenciaPago: facturaEmitida.autorizacion || proforma.codigoProforma,
                          });
                        }}
                        title="Descargar comprobante electrónico RIDE"
                        aria-label="Descargar RIDE"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "9px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: "#2D4734",
                          color: "#FFFFFF",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Download size={15} />
                        <span>Descargar RIDE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const f = facturaEmitida.factura;
                          imprimirFacturaRideSri({
                            negocio: proforma.negocio,
                            emisor: facturaEmitida.emisor,
                            numeroComprobante: f.numero_comprobante,
                            claveAcceso: f.clave_acceso,
                            estadoSri: f.estado,
                            ambiente: f.ambiente,
                            fechaEmision: f.fecha_emision,
                            fechaAutorizacion: f.fecha_autorizacion,
                            comprador: {
                              razonSocial:
                                f.comprador?.razon_social || pagadorPlux.nombre || "CONSUMIDOR FINAL",
                              identificacion:
                                f.comprador?.identificacion ||
                                pagadorPlux.identificacion ||
                                "9999999999999",
                              correo: f.comprador?.correo || pagadorPlux.email,
                              telefono: f.comprador?.telefono || pagadorPlux.telefono,
                              direccion: f.comprador?.direccion || pagadorPlux.direccion,
                            },
                            lineas: f.lineas,
                            rubroPrincipal: f.rubro_facturado,
                            codigoRubroPrincipal: f.codigo_rubro,
                            subtotal15: f.subtotal_15,
                            subtotal0: f.subtotal_0,
                            subtotalGeneral: f.subtotal,
                            iva15: f.iva,
                            total: f.total,
                            formaPagoTexto: "19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)",
                            referenciaPago: facturaEmitida.autorizacion || proforma.codigoProforma,
                          });
                        }}
                        title="Imprimir factura"
                        aria-label="Imprimir"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "9px 14px",
                          borderRadius: "10px",
                          border: "1px solid #D6D3D1",
                          background: "#FFFFFF",
                          color: "#1C1917",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Printer size={15} />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>
                )}

                <a
                  href={urlWhatsappAyuda}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "#16A34A",
                    color: "#FFFFFF",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  <MessageCircle size={18} />
                  <span>Volver al WhatsApp</span>
                </a>
              </div>
            ) : estaVencidoORechazado ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#991B1B",
                  fontSize: "0.88rem",
                }}
              >
                Este enlace de pago ya no se encuentra vigente. Solicita uno nuevo a tu asesor por WhatsApp.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* 1. PRIORIDAD: TRANSFERENCIA / DEPÓSITO BANCARIO Y QR DEUNA */}
                {transferenciaDisponible && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {/* Datos bancarios primero */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "14px",
                        background: "#FAF8F5",
                        border: "1px solid #E7E5E4",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <strong style={{ fontSize: "0.86rem", color: "#1C1917" }}>
                        Transferencia / Depósito Bancario
                      </strong>
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "#44403C",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div>
                          <strong>Titular:</strong> {configCheckout.transferencia.nombreTitular}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span>
                            <strong>{configCheckout.transferencia.tipoIdentificacionTitular}:</strong>{" "}
                            {configCheckout.transferencia.identificacionTitular}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void copiarTexto("id", configCheckout.transferencia.identificacionTitular)
                            }
                            title="Copiar identificación"
                            aria-label="Copiar identificación"
                            style={{
                              border: "1px solid #D6D3D1",
                              background: "#FFFFFF",
                              borderRadius: "6px",
                              padding: "2px 6px",
                              fontSize: "0.7rem",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            {campoCopiado === "id" ? <Check size={11} color="#166534" /> : <Copy size={11} />}
                            <span>{campoCopiado === "id" ? "Copiado" : "Copiar"}</span>
                          </button>
                        </div>
                        {configCheckout.transferencia.correoTitular && (
                          <div>
                            <strong>Correo:</strong> {configCheckout.transferencia.correoTitular}
                          </div>
                        )}
                      </div>

                      {configCheckout.transferencia.cuentas.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                          {configCheckout.transferencia.cuentas.map((cta, i) => (
                            <div
                              key={`${cta.banco}-${cta.numeroCuenta}-${i}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                padding: "8px 10px",
                                borderRadius: "9px",
                                background: "#FFFFFF",
                                border: "1px solid #E7E5E4",
                              }}
                            >
                              <div style={{ fontSize: "0.8rem" }}>
                                <div style={{ fontWeight: 700, color: "#1C1917" }}>
                                  {cta.banco} ({cta.tipoCuenta})
                                </div>
                                <div style={{ fontFamily: "monospace", color: "#2D4734", fontWeight: 700 }}>
                                  {cta.numeroCuenta}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void copiarTexto(`cta-${i}`, cta.numeroCuenta)}
                                title="Copiar número de cuenta"
                                aria-label={`Copiar cuenta ${cta.banco}`}
                                style={{
                                  border: "1px solid #D6D3D1",
                                  background: "#FAF8F5",
                                  borderRadius: "7px",
                                  padding: "5px 9px",
                                  fontSize: "0.74rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {campoCopiado === `cta-${i}` ? (
                                  <Check size={13} color="#166534" />
                                ) : (
                                  <Copy size={13} />
                                )}
                                <span>{campoCopiado === `cta-${i}` ? "Copiado" : "Copiar"}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Link directo DeUna */}
                    {configCheckout.transferencia.linkDeuna && (
                      <div
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          background: "#F5F3FF",
                          border: "1px solid #DDD6FE",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#4C1D95" }}>
                          <Smartphone size={18} />
                          <strong style={{ fontSize: "0.9rem" }}>Pago rápido con DeUna</strong>
                        </div>
                        <a
                          href={configCheckout.transferencia.linkDeuna}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "11px 14px",
                            borderRadius: "10px",
                            background: "#5B21B6",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontSize: "0.88rem",
                          }}
                        >
                          <span>Abrir DeUna</span>
                          <ExternalLink size={15} />
                        </a>
                      </div>
                    )}

                    {/* QR DeUna (sin nombres visibles) */}
                    {configCheckout.transferencia.qrDeunaUrl && (
                      <div
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          background: "#FAF8F5",
                          border: "1px solid #E7E5E4",
                          textAlign: "center",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <strong style={{ fontSize: "0.82rem", color: "#44403C" }}>
                          Escanea el código QR DeUna
                        </strong>
                        <img
                          src={configCheckout.transferencia.qrDeunaUrl}
                          alt="Código QR DeUna"
                          style={{
                            width: "168px",
                            height: "168px",
                            objectFit: "contain",
                            borderRadius: "10px",
                            background: "#FFFFFF",
                            border: "1px solid #E7E5E4",
                            padding: "6px",
                          }}
                        />
                      </div>
                    )}

                    {/* Subir comprobante */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          padding: "12px",
                          borderRadius: "12px",
                          border: comprobanteSubido ? "1.5px solid #16A34A" : "1.5px dashed #A8A29E",
                          background: comprobanteSubido ? "#F0FDF4" : "#FAF8F5",
                          color: comprobanteSubido ? "#166534" : "#44403C",
                          fontWeight: 700,
                          fontSize: "0.84rem",
                          cursor: subiendoComprobante ? "wait" : "pointer",
                        }}
                      >
                        {subiendoComprobante ? (
                          <Loader2 size={16} />
                        ) : comprobanteSubido ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Upload size={16} />
                        )}
                        <span>
                          {subiendoComprobante
                            ? "Subiendo comprobante…"
                            : comprobanteSubido
                              ? `Comprobante listo: ${comprobanteSubido.nombreArchivo}`
                              : "Subir comprobante (Foto o PDF)"}
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={subiendoComprobante}
                          onChange={(e) => void handleSubirComprobante(e)}
                          style={{ display: "none" }}
                        />
                      </label>

                      <input
                        type="text"
                        placeholder="Número de comprobante o nota (opcional)"
                        value={notaTransferencia}
                        onChange={(e) => setNotaTransferencia(e.target.value)}
                        style={estiloInput}
                      />

                      <button
                        type="button"
                        disabled={!comprobanteSubido || confirmandoTransferencia}
                        onClick={() => void handleConfirmarTransferencia()}
                        title="Confirmar pago por transferencia o DeUna"
                        aria-label="Confirmar Pago"
                        style={{
                          width: "100%",
                          padding: "13px 16px",
                          borderRadius: "12px",
                          border: "none",
                          background: comprobanteSubido ? "#2D4734" : "#A8A29E",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "0.94rem",
                          cursor:
                            !comprobanteSubido || confirmandoTransferencia
                              ? "not-allowed"
                              : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        {confirmandoTransferencia ? (
                          <Loader2 size={17} />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}
                        <span>Confirmar Pago</span>
                      </button>

                      {configCheckout.transferencia.advertenciaAcreditacion && (
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "#78716C", textAlign: "center" }}>
                          {configCheckout.transferencia.advertenciaAcreditacion}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. ÚLTIMA OPCIÓN AL FINAL: PAGO CON TARJETA (DÉBITO / CRÉDITO) */}
                {tarjetaDisponible && (
                  <div
                    style={{
                      paddingTop: transferenciaDisponible ? "14px" : "0",
                      borderTop: transferenciaDisponible ? "1px solid #E7E5E4" : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {transferenciaDisponible && (
                      <button
                        type="button"
                        onClick={() => setMostrarPagoTarjeta((prev) => !prev)}
                        title="Pagar con tarjeta de débito o crédito"
                        aria-label="Pagar con tarjeta"
                        aria-expanded={mostrarPagoTarjeta}
                        style={{
                          width: "100%",
                          padding: "11px 14px",
                          borderRadius: "12px",
                          border: "1px solid #D6D3D1",
                          background: mostrarPagoTarjeta ? "#FAF8F5" : "#FFFFFF",
                          color: "#44403C",
                          fontWeight: 700,
                          fontSize: "0.84rem",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        <CreditCard size={16} color="#57534E" />
                        <span>Pagar con Tarjeta (Débito / Crédito)</span>
                        {mostrarPagoTarjeta ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )}

                    {mostrarPagoTarjeta && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {!tieneTelefonoInicial && (
                          <input
                            type="tel"
                            placeholder="Tu teléfono / WhatsApp (opcional)"
                            value={telefonoOpcionalInput}
                            onChange={(e) => setTelefonoOpcionalInput(e.target.value)}
                            onBlur={() => setTelefonoConfirmadoPlux(telefonoOpcionalInput.trim())}
                            style={estiloInput}
                          />
                        )}

                        <input
                          type="email"
                          placeholder="Correo electrónico (opcional, para recibo)"
                          value={emailOpcionalInput}
                          onChange={(e) => setEmailOpcionalInput(e.target.value)}
                          onBlur={() => setEmailConfirmadoPlux(emailOpcionalInput.trim())}
                          style={estiloInput}
                        />

                        <BotonPagoPlux
                          negocio={proforma.negocio}
                          proformaId={proforma.id}
                          tokenAprobacion={proforma.tokenAprobacion}
                          modalidadCobro="TOTAL_100"
                          pagador={pagadorPlux}
                          ambiente={ambientePlux}
                          autoIniciar={true}
                          omitirFacturaAutomatica={true}
                          etiqueta={`Pagar $${proforma.total.toFixed(2)} con Tarjeta`}
                          alPagoAprobado={handlePagoPluxAprobado}
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            fontSize: "0.75rem",
                            color: "#78716C",
                          }}
                        >
                          <ShieldCheck size={14} color="#2D4734" />
                          <span>Pago encriptado procesado por PLUX · Visa, Mastercard, Diners</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Ayuda WhatsApp */}
        <footer style={{ textAlign: "center" }}>
          <a
            href={urlWhatsappAyuda}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#2D4734",
              textDecoration: "none",
            }}
          >
            <MessageCircle size={15} />
            <span>¿Necesitas ayuda? Escríbenos por WhatsApp</span>
          </a>
        </footer>
      </div>
    </main>
  );
}
