"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Hammer,
  Loader2,
  MapPin,
  Save,
  ShoppingBag,
  User,
} from "lucide-react";
import { cotizarEnvioDesdeEntradaAction } from "../acciones-logistica";
import { guardarDatosVentaOmnicanalAction } from "../acciones-omnicanal";
import { crearOActualizarPedidoOperadorAction } from "../acciones-operaciones-taller";
import {
  autoCompletarDatosVentaDesdeMensajes,
  calcularTotalDatosVenta,
  type ConversacionOmnicanal,
  type DatosVentaConversacion,
  type EstadoCobroChatVenta,
  type MensajeOmnicanal,
} from "../omnicanal";

export interface PropsPanelCamposVentaChat {
  negocio: string;
  conversacion: ConversacionOmnicanal;
  mensajes: MensajeOmnicanal[];
  onGuardado?: (datos: DatosVentaConversacion, remitenteNombre?: string) => void;
  onNotificar?: (mensaje: string) => void;
}

const FRANJAS_HORARIAS_SUGERIDAS = [
  "",
  "A) 09:00 - 13:00",
  "B) 13:00 - 17:00",
  "C) 17:00 - 20:00",
  "Inmediata (1-2h)",
  "Exequial Urgente",
];

function fechaIsoOffsetDias(dias: number): string {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toLocaleDateString("sv-SE", { timeZone: "America/Guayaquil" });
}

export function PanelCamposVentaChat({
  negocio,
  conversacion,
  mensajes,
  onGuardado,
  onNotificar,
}: PropsPanelCamposVentaChat) {
  const [seccion, setSeccion] = useState<"pedido" | "entrega" | "tarjeta">("pedido");
  const [form, setForm] = useState<DatosVentaConversacion>(() =>
    autoCompletarDatosVentaDesdeMensajes(conversacion.datosVenta, mensajes, conversacion)
  );
  const [guardando, setGuardando] = useState<boolean>(false);
  const [cotizandoGps, setCotizandoGps] = useState<boolean>(false);
  const [enviandoTaller, setEnviandoTaller] = useState<boolean>(false);
  const [guardadoReciente, setGuardadoReciente] = useState<boolean>(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Sincronizar cuando cambia de conversación o llegan nuevos mensajes con link de mapa
  useEffect(() => {
    setForm(
      autoCompletarDatosVentaDesdeMensajes(conversacion.datosVenta, mensajes, conversacion)
    );
    setErrorLocal(null);
    setGuardadoReciente(false);
  }, [conversacion.id]);

  // Si el cliente acaba de enviar un link GPS en la conversación activa y aún estaba vacío, sugerirlo
  useEffect(() => {
    setForm((prev) => {
      const sugerido = autoCompletarDatosVentaDesdeMensajes(prev, mensajes, conversacion);
      if (
        sugerido.ubicacionUrl !== prev.ubicacionUrl ||
        sugerido.codigoPedido !== prev.codigoPedido
      ) {
        return sugerido;
      }
      return prev;
    });
  }, [mensajes.length]);

  const totalCalculado = calcularTotalDatosVenta(form);

  const actualizarCampo = <K extends keyof DatosVentaConversacion>(
    clave: K,
    valor: DatosVentaConversacion[K]
  ) => {
    setGuardadoReciente(false);
    setForm((prev) => ({ ...prev, [clave]: valor }));
  };

  const persistirDatos = async (datosGuardar: DatosVentaConversacion = form) => {
    if (conversacion.id.startsWith("rt-")) return;
    setGuardando(true);
    setErrorLocal(null);
    const res = await guardarDatosVentaOmnicanalAction({
      negocio,
      conversacionId: conversacion.id,
      datosVenta: datosGuardar,
    });
    setGuardando(false);

    if (!res.ok) {
      setErrorLocal(res.error);
      return;
    }

    setGuardadoReciente(true);
    onGuardado?.(res.datosVenta, res.remitenteNombre);
  };

  const handleCotizarGps = async () => {
    const entradaGps = (form.ubicacionUrl || form.direccionReferencia || "").trim();
    if (!entradaGps) {
      setErrorLocal("Pega primero el enlace de Google Maps / Waze o coordenadas en Ubicación.");
      return;
    }
    setCotizandoGps(true);
    setErrorLocal(null);
    try {
      const res = await cotizarEnvioDesdeEntradaAction({
        negocio,
        enlaceOTexto: entradaGps,
      });
      if (!res.ok) {
        setErrorLocal(res.error || "No se pudo calcular el envío desde ese enlace.");
        return;
      }
      const c = res.cotizacion;
      const actualizado: DatosVentaConversacion = {
        ...form,
        costoEnvio: c.costoTotalEnvio,
        sector: c.zonaDetectada?.nombre || c.detalleDireccion?.parroquia || form.sector || "",
        direccionReferencia:
          form.direccionReferencia ||
          c.detalleDireccion?.resumenDireccion ||
          res.direccionDetectada ||
          "",
      };
      setForm(actualizado);
      await persistirDatos(actualizado);
    } finally {
      setCotizandoGps(false);
    }
  };

  const handleEnviarATaller = async () => {
    const resumenProd = [
      form.producto?.trim(),
      form.preferenciasDetalle?.trim() ? `(${form.preferenciasDetalle.trim()})` : null,
      form.extras?.trim() ? `+ Extras: ${form.extras.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    if (!resumenProd) {
      setSeccion("pedido");
      setErrorLocal("Indica el Producto antes de enviar la orden a Taller.");
      return;
    }

    const fechaFinal = form.fechaEntrega || fechaIsoOffsetDias(0);
    setEnviandoTaller(true);
    setErrorLocal(null);

    try {
      const dedicatoriaCompleta = [
        form.dedicatoriaTarjeta?.trim(),
        form.firmaTarjeta?.trim() ? `— ${form.firmaTarjeta.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await crearOActualizarPedidoOperadorAction({
        negocio,
        origenTipo: "MANUAL_ADMIN",
        enviarATaller: true,
        fechaEntrega: fechaFinal,
        franjaHoraria: form.franjaHora || "A) 09:00 - 13:00",
        productoResumen: resumenProd,
        clienteSolicita: form.nombreCliente?.trim() || conversacion.remitenteNombre,
        clienteTelefono: conversacion.remitenteTelefono || undefined,
        destinatarioFallecido: form.quienRecibe?.trim() || undefined,
        ubicacionEntrega:
          [form.sector?.trim(), form.direccionReferencia?.trim()].filter(Boolean).join(" · ") ||
          undefined,
        enlaceMapa: form.ubicacionUrl?.trim() || undefined,
        dedicatoria: dedicatoriaCompleta || undefined,
        observaciones: form.preferenciasDetalle?.trim() || undefined,
        totalUsd: totalCalculado > 0 ? totalCalculado : undefined,
        estadoPago: form.estadoCobro === "PAGADO" ? "PAGADO" : "PENDIENTE",
      });

      if (!res.ok) {
        setErrorLocal(res.error);
        return;
      }

      const conCodigo: DatosVentaConversacion = {
        ...form,
        fechaEntrega: fechaFinal,
        codigoPedido: res.codigo,
      };
      setForm(conCodigo);
      await persistirDatos(conCodigo);
      onNotificar?.(`Pedido ${res.codigo} enviado en vivo al Taller Floral.`);
    } finally {
      setEnviandoTaller(false);
    }
  };

  const estiloLabel: React.CSSProperties = {
    fontSize: "0.69rem",
    fontWeight: 700,
    color: "#475569",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  };

  const estiloInput: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: "7px",
    border: "1px solid #CBD5E1",
    fontSize: "0.79rem",
    background: "#FFFFFF",
    color: "#0F172A",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "12px",
        padding: "11px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Cabecera + Total en vivo */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <strong style={{ fontSize: "0.78rem", color: "#0F172A" }}>
          📋 Campos de Venta
        </strong>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "999px",
            background: totalCalculado > 0 ? "#DCFCE7" : "#F1F5F9",
            color: totalCalculado > 0 ? "#15803D" : "#64748B",
            fontSize: "0.74rem",
            fontWeight: 800,
          }}
        >
          Total: ${totalCalculado.toFixed(2)}
        </span>
      </div>

      {/* Pestañas compactas de las 3 secciones depuradas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "4px",
          background: "#F8FAFC",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid #E2E8F0",
        }}
      >
        {(
          [
            { id: "pedido" as const, texto: "🛒 Pedido", icono: ShoppingBag },
            { id: "entrega" as const, texto: "📍 Entrega", icono: MapPin },
            { id: "tarjeta" as const, texto: "✍🏼 Tarjeta", icono: User },
          ] as const
        ).map((tab) => {
          const act = seccion === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeccion(tab.id)}
              style={{
                minHeight: "36px",
                padding: "6px 4px",
                borderRadius: "6px",
                border: "none",
                background: act ? "#0F172A" : "transparent",
                color: act ? "#FFFFFF" : "#475569",
                fontSize: "0.73rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab.texto}
            </button>
          );
        })}
      </div>

      {/* SECCIÓN 1: PRODUCTO, EXTRAS Y VALORES */}
      {seccion === "pedido" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={estiloLabel}>
            <span>🛒 Producto / Arreglo</span>
            <input
              type="text"
              value={form.producto ?? ""}
              onChange={(e) => actualizarCampo("producto", e.target.value)}
              placeholder="Ej: Bouquet Coreano Mediano / Abanico XL"
              style={estiloInput}
            />
          </label>

          <label style={estiloLabel}>
            <span>🎨 Colores, tallos y notas Taller</span>
            <textarea
              rows={2}
              value={form.preferenciasDetalle ?? ""}
              onChange={(e) => actualizarCampo("preferenciasDetalle", e.target.value)}
              placeholder="Ej: Rosas rojas + papel negro, 6 girasoles…"
              style={{ ...estiloInput, resize: "vertical" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <label style={estiloLabel}>
              <span>$ Producto</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precioProducto ?? ""}
                onChange={(e) =>
                  actualizarCampo(
                    "precioProducto",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder="0.00"
                style={estiloInput}
              />
            </label>

            <label style={estiloLabel}>
              <span>$ Envío</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.costoEnvio ?? ""}
                onChange={(e) =>
                  actualizarCampo(
                    "costoEnvio",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder="0.00"
                style={estiloInput}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "6px" }}>
            <label style={estiloLabel}>
              <span>🎁 Extras</span>
              <input
                type="text"
                value={form.extras ?? ""}
                onChange={(e) => actualizarCampo("extras", e.target.value)}
                placeholder="Ferrero, globo, cinta…"
                style={estiloInput}
              />
            </label>

            <label style={estiloLabel}>
              <span>$ Extras</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precioExtras ?? ""}
                onChange={(e) =>
                  actualizarCampo(
                    "precioExtras",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder="0.00"
                style={estiloInput}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <label style={estiloLabel}>
              <span>💳 Estado cobro</span>
              <select
                value={form.estadoCobro || "COTIZANDO"}
                onChange={(e) =>
                  actualizarCampo("estadoCobro", e.target.value as EstadoCobroChatVenta)
                }
                style={estiloInput}
              >
                <option value="COTIZANDO">Cotizando</option>
                <option value="PAGO_SOLICITADO">Pago solicitado</option>
                <option value="PAGADO">✅ Pagado</option>
              </select>
            </label>

            <label style={estiloLabel}>
              <span>#️⃣ Código pedido</span>
              <input
                type="text"
                value={form.codigoPedido ?? ""}
                onChange={(e) => actualizarCampo("codigoPedido", e.target.value)}
                placeholder="TNK-ORD-..."
                style={estiloInput}
              />
            </label>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: CUÁNDO, HORA, SECTOR Y UBICACIÓN GPS */}
      {seccion === "entrega" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#475569" }}>
                📅 Cuándo (Fecha entrega)
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => actualizarCampo("fechaEntrega", fechaIsoOffsetDias(0))}
                  style={{
                    padding: "1px 6px",
                    borderRadius: "5px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => actualizarCampo("fechaEntrega", fechaIsoOffsetDias(1))}
                  style={{
                    padding: "1px 6px",
                    borderRadius: "5px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mañana
                </button>
              </div>
            </div>
            <input
              type="date"
              value={form.fechaEntrega ?? ""}
              onChange={(e) => actualizarCampo("fechaEntrega", e.target.value)}
              style={estiloInput}
            />
          </div>

          <label style={estiloLabel}>
            <span>🕙 Hora / Rango de entrega</span>
            <select
              value={form.franjaHora ?? ""}
              onChange={(e) => actualizarCampo("franjaHora", e.target.value)}
              style={estiloInput}
            >
              {FRANJAS_HORARIAS_SUGERIDAS.map((fr) => (
                <option key={fr || "vacio"} value={fr}>
                  {fr || "— Seleccionar horario —"}
                </option>
              ))}
            </select>
          </label>

          <label style={estiloLabel}>
            <span>📍 Sector</span>
            <input
              type="text"
              value={form.sector ?? ""}
              onChange={(e) => actualizarCampo("sector", e.target.value)}
              placeholder="Ej: Centro-Norte, Cumbayá, Sur…"
              style={estiloInput}
            />
          </label>

          <label style={estiloLabel}>
            <span>🏠 Dónde (Dirección / Sala / Referencia)</span>
            <textarea
              rows={2}
              value={form.direccionReferencia ?? ""}
              onChange={(e) => actualizarCampo("direccionReferencia", e.target.value)}
              placeholder="Calle, edificio/casa o Sala funeraria…"
              style={{ ...estiloInput, resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#475569" }}>
                🗺️ Enlace Ubicación GPS
              </span>
              {form.ubicacionUrl && /^https?:\/\//i.test(form.ubicacionUrl) && (
                <a
                  href={form.ubicacionUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.68rem",
                    color: "#0284C7",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  Abrir mapa <ExternalLink size={10} />
                </a>
              )}
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="text"
                value={form.ubicacionUrl ?? ""}
                onChange={(e) => actualizarCampo("ubicacionUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                style={{ ...estiloInput, flex: 1 }}
              />
              <button
                type="button"
                disabled={cotizandoGps}
                onClick={() => void handleCotizarGps()}
                title="Calcular automáticamente Sector y Costo de Envío desde el link GPS"
                aria-label="Cotizar GPS"
                style={{
                  padding: "6px 8px",
                  borderRadius: "7px",
                  border: "1px solid #0284C7",
                  background: "#F0F9FF",
                  color: "#0369A1",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  cursor: cotizandoGps ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cotizandoGps ? "…" : "Cotizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: CLIENTE, QUIÉN RECIBE Y DEDICATORIA */}
      {seccion === "tarjeta" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={estiloLabel}>
            <span>🤵🏻 Nombre del Cliente (compra)</span>
            <input
              type="text"
              value={form.nombreCliente ?? ""}
              onChange={(e) => actualizarCampo("nombreCliente", e.target.value)}
              placeholder="Nombre de quien realiza el pedido"
              style={estiloInput}
            />
          </label>

          <label style={estiloLabel}>
            <span>💐 Quién Recibe (Nombre y Celular)</span>
            <input
              type="text"
              value={form.quienRecibe ?? ""}
              onChange={(e) => actualizarCampo("quienRecibe", e.target.value)}
              placeholder="Ej: María Pérez · 099..."
              style={estiloInput}
            />
          </label>

          <label style={estiloLabel}>
            <span>✍🏼 Mensaje de Tarjeta / Cinta</span>
            <textarea
              rows={3}
              value={form.dedicatoriaTarjeta ?? ""}
              onChange={(e) => actualizarCampo("dedicatoriaTarjeta", e.target.value)}
              placeholder="Texto exacto para imprimir en la tarjeta…"
              style={{ ...estiloInput, resize: "vertical" }}
            />
          </label>

          <label style={estiloLabel}>
            <span>✒️ Firma de la Tarjeta</span>
            <input
              type="text"
              value={form.firmaTarjeta ?? ""}
              onChange={(e) => actualizarCampo("firmaTarjeta", e.target.value)}
              placeholder="Ej: Con amor, Carlos / Anónimo"
              style={estiloInput}
            />
          </label>
        </div>
      )}

      {errorLocal && (
        <div
          style={{
            padding: "6px 8px",
            borderRadius: "7px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.72rem",
          }}
        >
          {errorLocal}
        </div>
      )}

      {/* Botonera inferior: Guardar Campos + Enviar directo a Taller */}
      <div style={{ display: "flex", gap: "8px", paddingTop: "2px" }}>
        <button
          type="button"
          disabled={guardando}
          onClick={() => void persistirDatos()}
          title="Guardar datos recolectados en este chat"
          aria-label="Guardar campos"
          style={{
            flex: 1,
            minHeight: "40px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            padding: "8px 10px",
            borderRadius: "9px",
            border: "1px solid #CBD5E1",
            background: guardadoReciente ? "#ECFDF5" : "#F8FAFC",
            color: guardadoReciente ? "#047857" : "#0F172A",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: guardando ? "wait" : "pointer",
          }}
        >
          {guardando ? (
            <Loader2 size={14} />
          ) : guardadoReciente ? (
            <Check size={14} />
          ) : (
            <Save size={14} />
          )}
          <span>{guardadoReciente ? "Guardado" : "Guardar"}</span>
        </button>

        <button
          type="button"
          disabled={enviandoTaller}
          onClick={() => void handleEnviarATaller()}
          title="Generar Orden de Trabajo con estos campos y enviarla directo a Taller"
          aria-label="Enviar a Taller"
          style={{
            flex: 1.2,
            minHeight: "40px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            padding: "8px 10px",
            borderRadius: "9px",
            border: "none",
            background: "#15803D",
            color: "#FFFFFF",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: enviandoTaller ? "wait" : "pointer",
          }}
        >
          {enviandoTaller ? <Loader2 size={14} /> : <Hammer size={14} />}
          <span>A Taller</span>
        </button>
      </div>
    </div>
  );
}
