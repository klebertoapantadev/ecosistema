"use client";
import { SelectConBuscador } from "@eco/datagrid";

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
  CLASIFICACIONES_OPERATIVAS_PEDIDO,
  OPCIONES_SALA_EXEQUIALES,
  RANGOS_HORARIO_ENTREGA_TIENDA,
  construirValoresHorarioGuardar,
  esNombreFallecidoPendiente,
  inferirClasificacionPedido,
  type ClasificacionOperativaPedido,
  type ModoSelectorHorarioEntrega,
} from "../operaciones-taller";
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

    const clasifResuelta: ClasificacionOperativaPedido = inferirClasificacionPedido({
      clasificacionExplicita: form.clasificacionPedido,
      salaServicio: form.salaServicio,
      productoResumen: resumenProd,
      ubicacionEntrega: [form.sector, form.direccionReferencia].filter(Boolean).join(" "),
    });
    const esExeq = clasifResuelta === "EXEQUIALES";

    if (esExeq && esNombreFallecidoPendiente(form.quienRecibe)) {
      setSeccion("tarjeta");
      setErrorLocal(
        "En pedidos de Exequiales, indica el nombre de la Persona Fallecida antes de enviar a Taller."
      );
      return;
    }

    if (form.franjaHora === "HORA_EXACTA" && !(form.horaExacta || "").trim()) {
      setSeccion("entrega");
      setErrorLocal("Indica la hora exacta de entrega.");
      return;
    }

    const modoChat: ModoSelectorHorarioEntrega =
      form.franjaHora === "HORA_EXACTA" ||
      form.franjaHora === "LO_ANTES_POSIBLE" ||
      form.franjaHora === "A) 09:00 - 13:00" ||
      form.franjaHora === "B) 13:00 - 17:00" ||
      form.franjaHora === "C) 17:00 - 20:00"
        ? form.franjaHora
        : esExeq
          ? "LO_ANTES_POSIBLE"
          : "A) 09:00 - 13:00";

    const horarioChat = construirValoresHorarioGuardar(modoChat, form.horaExacta || "");
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
        origenTipo: esExeq ? "EXEQUIALES_LLAMADA" : "MANUAL_ADMIN",
        clasificacionPedido: clasifResuelta,
        enviarATaller: true,
        fechaEntrega: fechaFinal,
        franjaHoraria: horarioChat.franjaHoraria ?? undefined,
        horaEspecifica: horarioChat.horaEspecifica ?? undefined,
        productoResumen: resumenProd,
        clienteSolicita: form.nombreCliente?.trim() || conversacion.remitenteNombre,
        clienteTelefono: esExeq ? undefined : conversacion.remitenteTelefono || undefined,
        destinatarioFallecido: form.quienRecibe?.trim() || undefined,
        salaServicio: esExeq ? form.salaServicio?.trim() || undefined : undefined,
        ubicacionEntrega: esExeq
          ? "Exequiales"
          : [form.sector?.trim(), form.direccionReferencia?.trim()].filter(Boolean).join(" · ") ||
            undefined,
        enlaceMapa: esExeq ? undefined : form.ubicacionUrl?.trim() || undefined,
        dedicatoria: esExeq ? undefined : dedicatoriaCompleta || undefined,
        tarjetaTipo: clasifResuelta === "CONDOLENCIAS" ? "CONDOLENCIAS_PLANA" : undefined,
        observaciones: form.preferenciasDetalle?.trim() || undefined,
        totalUsd: totalCalculado > 0 ? totalCalculado : undefined,
        estadoPago: esExeq ? "CONVENIO_IESS" : form.estadoCobro === "PAGADO" ? "PAGADO" : "PENDIENTE",
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
        <strong style={{ fontSize: "0.79rem", color: "#18181B" }}>
          Campos de Venta
        </strong>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#F4F4F5",
            border: "1px solid #E4E4E7",
            color: totalCalculado > 0 ? "#18181B" : "#71717A",
            fontSize: "0.74rem",
            fontWeight: 700,
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
          background: "#F4F4F5",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid #E4E4E7",
        }}
      >
        {(
          [
            { id: "pedido" as const, texto: "Pedido", icono: ShoppingBag },
            { id: "entrega" as const, texto: "Entrega", icono: MapPin },
            { id: "tarjeta" as const, texto: "Tarjeta", icono: User },
          ] as const
        ).map((tab) => {
          const act = seccion === tab.id;
          const IconoTab = tab.icono;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeccion(tab.id)}
              style={{
                minHeight: "34px",
                padding: "5px 4px",
                borderRadius: "6px",
                border: "none",
                background: act ? "#18181B" : "transparent",
                color: act ? "#FFFFFF" : "#52525B",
                fontSize: "0.73rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              <IconoTab size={12} />
              <span>{tab.texto}</span>
            </button>
          );
        })}
      </div>

      {/* SECCIÓN 1: PRODUCTO, EXTRAS Y VALORES */}
      {seccion === "pedido" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={estiloLabel}>
            <span>Tipo de Pedido</span>
            <SelectConBuscador
              value={form.clasificacionPedido || "FLORISTERIA_OCASIONES"}
              onChange={(e) => actualizarCampo("clasificacionPedido", e.target.value)}
              style={estiloInput}
            >
              {CLASIFICACIONES_OPERATIVAS_PEDIDO.map((op) => (
                <option key={op.clave} value={op.clave}>
                  {op.etiqueta}
                </option>
              ))}
            </SelectConBuscador>
          </label>

          <label style={estiloLabel}>
            <span>Producto / Arreglo</span>
            <input
              type="text"
              value={form.producto ?? ""}
              onChange={(e) => actualizarCampo("producto", e.target.value)}
              placeholder="Ej: Bouquet Coreano Mediano / Abanico XL"
              style={estiloInput}
            />
          </label>

          <label style={estiloLabel}>
            <span>Colores, tallos y notas Taller</span>
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
              <span>Extras</span>
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
              <span>Estado cobro</span>
              <SelectConBuscador
                value={form.estadoCobro || "COTIZANDO"}
                onChange={(e) =>
                  actualizarCampo("estadoCobro", e.target.value as EstadoCobroChatVenta)
                }
                style={estiloInput}
              >
                <option value="COTIZANDO">Cotizando</option>
                <option value="PAGO_SOLICITADO">Pago solicitado</option>
                <option value="PAGADO">Pagado</option>
              </SelectConBuscador>
            </label>

            <label style={estiloLabel}>
              <span>Código pedido</span>
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
                Fecha de entrega
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => actualizarCampo("fechaEntrega", fechaIsoOffsetDias(0))}
                  style={{
                    padding: "1px 6px",
                    borderRadius: "5px",
                    border: "1px solid #D4D4D8",
                    background: "#FAFAFA",
                    color: "#27272A",
                    fontSize: "0.66rem",
                    fontWeight: 600,
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
                    border: "1px solid #D4D4D8",
                    background: "#FAFAFA",
                    color: "#27272A",
                    fontSize: "0.66rem",
                    fontWeight: 600,
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
            <span>Hora de entrega (Rango u Hora exacta)</span>
            <SelectConBuscador
              value={form.franjaHora || "A) 09:00 - 13:00"}
              onChange={(e) => {
                const v = e.target.value;
                actualizarCampo("franjaHora", v);
                if (v === "HORA_EXACTA" && !form.horaExacta) {
                  actualizarCampo("horaExacta", "10:30");
                }
              }}
              style={estiloInput}
            >
              {form.clasificacionPedido === "EXEQUIALES" && (
                <option value="LO_ANTES_POSIBLE">⚡ Lo antes posible</option>
              )}
              {RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => (
                <option key={r.codigo} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
              <option value="HORA_EXACTA">⏰ Hora exacta</option>
            </SelectConBuscador>
          </label>

          {form.franjaHora === "HORA_EXACTA" && (
            <label style={{ ...estiloLabel, color: "#0F766E" }}>
              <span>Indicar Hora Exacta *</span>
              <input
                type="time"
                value={form.horaExacta ?? "10:30"}
                onChange={(e) => actualizarCampo("horaExacta", e.target.value)}
                style={{ ...estiloInput, border: "1.5px solid #0D9488", fontWeight: 700 }}
              />
            </label>
          )}

          {form.clasificacionPedido === "EXEQUIALES" ? (
            <label style={{ ...estiloLabel, color: "#4C1D95" }}>
              <span>Sala Exequiales</span>
              <SelectConBuscador
                value={form.salaServicio ?? ""}
                onChange={(e) => actualizarCampo("salaServicio", e.target.value)}
                style={estiloInput}
              >
                <option value="">Por confirmar</option>
                {OPCIONES_SALA_EXEQUIALES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectConBuscador>
            </label>
          ) : (
            <>
              <label style={estiloLabel}>
                <span>Sector</span>
                <input
                  type="text"
                  value={form.sector ?? ""}
                  onChange={(e) => actualizarCampo("sector", e.target.value)}
                  placeholder="Ej: Centro-Norte, Cumbayá, Sur…"
                  style={estiloInput}
                />
              </label>

              <label style={estiloLabel}>
                <span>Dirección / Referencia</span>
                <textarea
                  rows={2}
                  value={form.direccionReferencia ?? ""}
                  onChange={(e) => actualizarCampo("direccionReferencia", e.target.value)}
                  placeholder="Calle, edificio/casa o funeraria…"
                  style={{ ...estiloInput, resize: "vertical" }}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#475569" }}>
                    Enlace Ubicación GPS
                  </span>
                  {form.ubicacionUrl && /^https?:\/\//i.test(form.ubicacionUrl) && (
                    <a
                      href={form.ubicacionUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "0.68rem",
                        color: "#27272A",
                        textDecoration: "underline",
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
                      padding: "6px 9px",
                      borderRadius: "7px",
                      border: "1px solid #D4D4D8",
                      background: "#FAFAFA",
                      color: "#18181B",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      cursor: cotizandoGps ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cotizandoGps ? "…" : "Cotizar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECCIÓN 3: CLIENTE, QUIÉN RECIBE / PERSONA FALLECIDA Y DEDICATORIA */}
      {seccion === "tarjeta" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={estiloLabel}>
            <span>
              {form.clasificacionPedido === "EXEQUIALES"
                ? "Solicita / Coordinador"
                : "Nombre del Cliente (compra)"}
            </span>
            <input
              type="text"
              value={form.nombreCliente ?? ""}
              onChange={(e) => actualizarCampo("nombreCliente", e.target.value)}
              placeholder={
                form.clasificacionPedido === "EXEQUIALES"
                  ? "Ej: Cristina / Cristian Montaluisa"
                  : "Nombre de quien realiza el pedido"
              }
              style={estiloInput}
            />
          </label>

          <label
            style={
              form.clasificacionPedido === "EXEQUIALES"
                ? { ...estiloLabel, color: "#4C1D95" }
                : estiloLabel
            }
          >
            <span>
              {form.clasificacionPedido === "EXEQUIALES"
                ? "Persona Fallecida (Destinatario) *"
                : form.clasificacionPedido === "CONDOLENCIAS"
                  ? "Destinatario / Persona Fallecida"
                  : "Quién Recibe (Nombre y Celular)"}
            </span>
            <input
              type="text"
              value={form.quienRecibe ?? ""}
              onChange={(e) => actualizarCampo("quienRecibe", e.target.value)}
              placeholder={
                form.clasificacionPedido === "EXEQUIALES"
                  ? "Nombre completo de la persona fallecida (requerido)"
                  : "Ej: María Pérez · 099..."
              }
              style={
                form.clasificacionPedido === "EXEQUIALES"
                  ? { ...estiloInput, border: "1.5px solid #8B5CF6" }
                  : estiloInput
              }
            />
          </label>

          {form.clasificacionPedido !== "EXEQUIALES" && (
            <>
              <label style={estiloLabel}>
                <span>
                  {form.clasificacionPedido === "CONDOLENCIAS"
                    ? "Mensaje de Tarjeta de Condolencias"
                    : "Mensaje de Tarjeta / Cinta"}
                </span>
                <textarea
                  rows={3}
                  value={form.dedicatoriaTarjeta ?? ""}
                  onChange={(e) => actualizarCampo("dedicatoriaTarjeta", e.target.value)}
                  placeholder="Texto exacto para imprimir en la tarjeta…"
                  style={{ ...estiloInput, resize: "vertical" }}
                />
              </label>

              <label style={estiloLabel}>
                <span>Firma de la Tarjeta</span>
                <input
                  type="text"
                  value={form.firmaTarjeta ?? ""}
                  onChange={(e) => actualizarCampo("firmaTarjeta", e.target.value)}
                  placeholder="Ej: Con amor, Carlos / Anónimo"
                  style={estiloInput}
                />
              </label>
            </>
          )}
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
            border: "1px solid #D4D4D8",
            background: guardadoReciente ? "#F4F4F5" : "#FFFFFF",
            color: "#18181B",
            fontSize: "0.78rem",
            fontWeight: 600,
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
            background: "#2D4734",
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
