"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Save,
  ShoppingBag,
  Star,
  StickyNote,
  User,
  X,
} from "lucide-react";
import {
  SUGERENCIAS_NOTAS_CLIENTE_OMNICANAL,
  describirCalificacionCliente,
  generarCodigoRefVisitanteWeb,
  generarCodigoRefWhatsapp,
  normalizarTelefonoOmnicanal,
  type CanalOmnicanal,
  type ContactoUnificadoOmnicanal,
  type ConversacionOmnicanal,
} from "../omnicanal";
import {
  guardarFichaClienteOmnicanalAction,
  type PedidoWebConTipoCliente,
  type RespuestaGuardarFichaClienteOmnicanal,
} from "../acciones-omnicanal";
import {
  AvatarConCanalOmnicanal,
  IconoVectorCanal,
  nombreLegibleCanal,
} from "./IconoCanalOmnicanal";

export interface PropiedadesModalFichaClienteOmnicanal {
  abierto: boolean;
  negocio: string;
  esMovil?: boolean;
  conversacion?: ConversacionOmnicanal | null;
  contactoDirectorio?: ContactoUnificadoOmnicanal | null;
  todasConversaciones: ConversacionOmnicanal[];
  pedidosWeb: PedidoWebConTipoCliente[];
  onCerrar: () => void;
  onSeleccionarConversacion?: (conversacionId: string) => void;
  onGuardado: (resultado: RespuestaGuardarFichaClienteOmnicanal) => void;
}

function construirEnlaceDirectoWhatsappCliente(telefono?: string | null): string | null {
  const limpio = String(telefono || "").replace(/[^\d]/g, "");
  if (limpio.length < 8) return null;
  const intl =
    limpio.startsWith("09") && limpio.length === 10
      ? `593${limpio.slice(1)}`
      : limpio.length === 9 && limpio.startsWith("9")
        ? `593${limpio}`
        : limpio;
  return `https://wa.me/${intl}`;
}

export function ModalFichaClienteOmnicanal({
  abierto,
  negocio,
  esMovil = false,
  conversacion = null,
  contactoDirectorio = null,
  todasConversaciones,
  pedidosWeb,
  onCerrar,
  onSeleccionarConversacion,
  onGuardado,
}: PropiedadesModalFichaClienteOmnicanal) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [estrellas, setEstrellas] = useState<number | null>(null);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [copiadoCampo, setCopiadoCampo] = useState<"tel" | "mail" | null>(null);

  // Hidratar formulario al abrir o cambiar de cliente
  useEffect(() => {
    if (!abierto) return;
    setErrorLocal(null);
    setCopiadoCampo(null);

    if (conversacion) {
      setNombre(
        conversacion.fichaCliente?.nombrePersonalizado ||
          conversacion.remitenteNombre ||
          ""
      );
      setTelefono(conversacion.remitenteTelefono || contactoDirectorio?.telefono || "");
      setCorreo(conversacion.remitenteCorreo || contactoDirectorio?.correo || "");
      setEstrellas(
        conversacion.fichaCliente?.calificacionEstrellas ??
          contactoDirectorio?.calificacionEstrellas ??
          null
      );
      setNotas(
        conversacion.fichaCliente?.notasCliente ??
          contactoDirectorio?.notasCliente ??
          ""
      );
      return;
    }

    if (contactoDirectorio) {
      setNombre(contactoDirectorio.nombre || "");
      setTelefono(contactoDirectorio.telefono || "");
      setCorreo(contactoDirectorio.correo || "");
      setEstrellas(contactoDirectorio.calificacionEstrellas ?? null);
      setNotas(contactoDirectorio.notasCliente || "");
    }
  }, [
    abierto,
    conversacion?.id,
    conversacion?.remitenteNombre,
    conversacion?.remitenteTelefono,
    conversacion?.remitenteCorreo,
    conversacion?.fichaCliente?.nombrePersonalizado,
    conversacion?.fichaCliente?.calificacionEstrellas,
    conversacion?.fichaCliente?.notasCliente,
    contactoDirectorio?.claveUnica,
  ]);

  // Conversaciones vinculadas al mismo cliente a través de cualquier canal
  const conversacionesCliente = useMemo(() => {
    if (!abierto) return [];
    const telBase = normalizarTelefonoOmnicanal(
      telefono || conversacion?.remitenteTelefono || contactoDirectorio?.telefono
    );
    const mailBase = String(
      correo || conversacion?.remitenteCorreo || contactoDirectorio?.correo || ""
    )
      .trim()
      .toLowerCase();
    const usuBase = conversacion?.usuarioId || contactoDirectorio?.usuarioId || null;
    const cliBase = conversacion?.clienteId || contactoDirectorio?.clienteId || null;
    const refWebBase = conversacion?.puenteOmnicanal?.refWeb || null;

    return todasConversaciones.filter((c) => {
      if (conversacion && c.id === conversacion.id) return true;
      const telC = normalizarTelefonoOmnicanal(c.remitenteTelefono);
      if (telBase && telBase.length >= 8 && telC === telBase) return true;
      const mailC = String(c.remitenteCorreo || "").trim().toLowerCase();
      if (mailBase && mailC && mailC === mailBase) return true;
      if (usuBase && c.usuarioId && c.usuarioId === usuBase) return true;
      if (cliBase && c.clienteId && c.clienteId === cliBase) return true;
      if (refWebBase && c.puenteOmnicanal?.refWeb && c.puenteOmnicanal.refWeb === refWebBase) {
        return true;
      }
      return false;
    });
  }, [
    abierto,
    todasConversaciones,
    conversacion,
    contactoDirectorio,
    telefono,
    correo,
  ]);

  // Pedidos / Proformas Web relacionados
  const pedidosCliente = useMemo(() => {
    if (!abierto) return [];
    const telBase = normalizarTelefonoOmnicanal(
      telefono || conversacion?.remitenteTelefono || contactoDirectorio?.telefono
    );
    const mailBase = String(
      correo || conversacion?.remitenteCorreo || contactoDirectorio?.correo || ""
    )
      .trim()
      .toLowerCase();

    return pedidosWeb.filter((p) => {
      if (mailBase && p.compradorCorreo && p.compradorCorreo.trim().toLowerCase() === mailBase) {
        return true;
      }
      const telP = normalizarTelefonoOmnicanal(p.compradorTelefono);
      if (telBase && telBase.length >= 8 && telP === telBase) return true;
      return false;
    });
  }, [abierto, pedidosWeb, conversacion, contactoDirectorio, telefono, correo]);

  // Datos consolidados del puente Web <-> WhatsApp
  const resumenPuente = useMemo(() => {
    const convConPuente =
      conversacionesCliente.find((c) => c.puenteOmnicanal?.ultimoProductoVistoWeb) ??
      conversacionesCliente.find((c) => c.puenteOmnicanal?.refWeb || c.puenteOmnicanal?.wref) ??
      conversacion;

    const convWeb = conversacionesCliente.find((c) => c.canal === "web");
    const convWa = conversacionesCliente.find((c) => c.canal === "whatsapp");

    const refWeb =
      convConPuente?.puenteOmnicanal?.refWeb ||
      (convWeb ? generarCodigoRefVisitanteWeb(convWeb.claveHilo, negocio) : null);
    const wref =
      convConPuente?.puenteOmnicanal?.wref ||
      (convWa && /^[0-9a-f-]{36}$/i.test(convWa.id)
        ? generarCodigoRefWhatsapp(convWa.id)
        : null);

    const historial = convConPuente?.puenteOmnicanal?.historialVisitasWeb ?? [];
    const ultimoProd =
      convConPuente?.puenteOmnicanal?.ultimoProductoVistoWeb ?? historial[0] ?? null;

    return {
      refWeb,
      wref,
      ultimoProd,
      historial,
    };
  }, [conversacionesCliente, conversacion, negocio]);

  if (!abierto || (!conversacion && !contactoDirectorio)) return null;

  const canalPrincipal: CanalOmnicanal = conversacion?.canal ?? "web";
  const urlWaDirecto = construirEnlaceDirectoWhatsappCliente(telefono);

  const copiarAlPortapapeles = async (valor: string, tipo: "tel" | "mail") => {
    if (!valor.trim() || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(valor.trim());
      setCopiadoCampo(tipo);
      setTimeout(() => setCopiadoCampo(null), 1800);
    } catch {
      // Ignorar si navegador restringe portapapeles
    }
  };

  const alternarChipNota = (etiquetaChip: string) => {
    const actual = notas.trim();
    const patron = new RegExp(`(^|[·,\\n]\\s*)${etiquetaChip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s*($|[·,\\n]))`, "i");
    if (patron.test(actual)) {
      return;
    }
    const separador = actual.length > 0 ? (actual.endsWith(".") ? " " : " · ") : "";
    setNotas(`${actual}${separador}${etiquetaChip}`);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorLocal("Ingresa el nombre del cliente para guardarlo en el registro.");
      return;
    }
    setGuardando(true);
    setErrorLocal(null);

    const convDestinoId =
      conversacion?.id ?? conversacionesCliente[0]?.id ?? null;

    const res = await guardarFichaClienteOmnicanalAction({
      negocio,
      conversacionId: convDestinoId,
      clienteId: conversacion?.clienteId ?? contactoDirectorio?.clienteId ?? null,
      usuarioId: conversacion?.usuarioId ?? contactoDirectorio?.usuarioId ?? null,
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      correo: correo.trim() || null,
      calificacionEstrellas: estrellas,
      notasCliente: notas.trim() || null,
    });

    setGuardando(false);
    if (!res.ok) {
      setErrorLocal(res.error);
      return;
    }

    onGuardado(res);
    onCerrar();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ficha e información del cliente"
      onClick={() => {
        if (!guardando) onCerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9995,
        background: "rgba(24, 24, 27, 0.52)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: esMovil ? "flex-end" : "center",
        justifyContent: "center",
        padding: esMovil ? 0 : "16px",
      }}
    >
      <form
        onSubmit={handleGuardar}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: esMovil ? "100%" : "540px",
          maxHeight: esMovil ? "92dvh" : "88vh",
          background: "var(--cf-ffffff, #FFFFFF)",
          borderRadius: esMovil ? "18px 18px 0 0" : "16px",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          boxShadow: "0 24px 60px rgba(24, 24, 27, 0.24)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera fija */}
        <div
          style={{
            padding: esMovil ? "14px 16px 12px" : "16px 20px 14px",
            borderBottom: "1px solid var(--cb-ece8e1, #ECE8E1)",
            background: "var(--cf-faf8f5, #FAF8F5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: 0 }}>
            <AvatarConCanalOmnicanal
              nombre={nombre || conversacion?.remitenteNombre || contactoDirectorio?.nombre || "Cliente"}
              canal={canalPrincipal}
              size={42}
            />
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <strong
                  style={{
                    fontSize: "0.95rem",
                    color: "var(--ct-1f1c19, #1F1C19)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: esMovil ? "210px" : "300px",
                  }}
                >
                  {nombre || "Ficha del Cliente"}
                </strong>
                {conversacion && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      color: "var(--ct-57524c, #57524C)",
                    }}
                  >
                    <IconoVectorCanal canal={conversacion.canal} size={12} />
                    <span>{nombreLegibleCanal(conversacion.canal)}</span>
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.73rem", color: "var(--ct-6e6861, #6E6861)" }}>
                Registro unificado para WhatsApp, Tienda Web y redes sociales
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ficha del cliente"
            aria-label="Cerrar"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "9px",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-57524c, #57524C)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo desplazable */}
        <div
          style={{
            padding: esMovil ? "14px 16px" : "16px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {errorLocal && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "9px",
                background: "var(--cf-faf2f2, #FAF2F2)",
                border: "1px solid var(--cb-e5caca, #E5CACA)",
                color: "var(--ct-8a2e2e, #8A2E2E)",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              {errorLocal}
            </div>
          )}

          {/* 1. Calificación de 1 a 5 estrellas */}
          <div
            style={{
              padding: "11px 13px",
              borderRadius: "12px",
              background: "var(--cf-faf8f5, #FAF8F5)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
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
              <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                Calificación del cliente
              </span>
              {estrellas != null && (
                <button
                  type="button"
                  onClick={() => setEstrellas(null)}
                  title="Quitar calificación de estrellas"
                  aria-label="Quitar estrellas"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--ct-847d74, #847D74)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  Quitar
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((valor) => {
                const activa = estrellas != null && valor <= estrellas;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setEstrellas(valor)}
                    title={`Calificar con ${valor} ${valor === 1 ? "estrella" : "estrellas"}`}
                    aria-label={`${valor} estrellas`}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      border: activa ? "1px solid var(--cb-e8dec6, #E8DEC6)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                      background: activa ? "var(--cf-fffbeb, #FFFBEB)" : "var(--cf-ffffff, #FFFFFF)",
                      color: activa ? "var(--ct-d97706, #D97706)" : "#C7C2BA",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <Star size={19} fill={activa ? "#D97706" : "none"} />
                  </button>
                );
              })}
              <span
                style={{
                  marginLeft: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: estrellas != null ? "var(--ct-745622, #745622)" : "var(--ct-847d74, #847D74)",
                }}
              >
                {describirCalificacionCliente(estrellas)}
              </span>
            </div>
          </div>

          {/* 2. Nombre editable + WhatsApp/Teléfono + Correo */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label
                htmlFor="ficha-cliente-nombre"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--ct-221e1b, #221E1B)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <User size={13} />
                <span>Nombre en nuestro registro (editable) *</span>
              </label>
              <input
                id="ficha-cliente-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: María Fernanda Gómez - Eventos"
                style={{
                  width: "100%",
                  minHeight: "40px",
                  padding: "8px 11px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-1f1c19, #1F1C19)",
                  fontSize: esMovil ? "16px" : "0.84rem",
                  fontWeight: 600,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: esMovil ? "1fr" : "1fr 1fr",
                gap: "10px",
              }}
            >
              {/* WhatsApp / Teléfono */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label
                  htmlFor="ficha-cliente-telefono"
                  style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--ct-221e1b, #221E1B)" }}
                >
                  WhatsApp / Teléfono
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <input
                    id="ficha-cliente-telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+59399..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: "38px",
                      padding: "7px 10px",
                      borderRadius: "9px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-1f1c19, #1F1C19)",
                      fontSize: esMovil ? "16px" : "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                  {telefono.trim() && (
                    <button
                      type="button"
                      onClick={() => void copiarAlPortapapeles(telefono, "tel")}
                      title="Copiar número de WhatsApp"
                      aria-label="Copiar teléfono"
                      style={{
                        width: "36px",
                        height: "38px",
                        borderRadius: "9px",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        background: "var(--cf-f8f7f4, #F8F7F4)",
                        color: copiadoCampo === "tel" ? "var(--ct-15803d, #15803D)" : "var(--ct-57524c, #57524C)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {copiadoCampo === "tel" ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  )}
                  {urlWaDirecto && (
                    <a
                      href={urlWaDirecto}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir chat externo en WhatsApp"
                      aria-label="Abrir WhatsApp"
                      style={{
                        width: "36px",
                        height: "38px",
                        borderRadius: "9px",
                        border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
                        background: "var(--cf-f0fdf4, #F0FDF4)",
                        color: "var(--ct-15803d, #15803D)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                    >
                      <IconoVectorCanal canal="whatsapp" size={15} />
                    </a>
                  )}
                </div>
              </div>

              {/* Correo electrónico */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label
                  htmlFor="ficha-cliente-correo"
                  style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--ct-221e1b, #221E1B)" }}
                >
                  Correo electrónico
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <input
                    id="ficha-cliente-correo"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="cliente@correo.com"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: "38px",
                      padding: "7px 10px",
                      borderRadius: "9px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-1f1c19, #1F1C19)",
                      fontSize: esMovil ? "16px" : "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                  {correo.trim() && (
                    <button
                      type="button"
                      onClick={() => void copiarAlPortapapeles(correo, "mail")}
                      title="Copiar correo electrónico"
                      aria-label="Copiar correo"
                      style={{
                        width: "36px",
                        height: "38px",
                        borderRadius: "9px",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        background: "var(--cf-f8f7f4, #F8F7F4)",
                        color: copiadoCampo === "mail" ? "var(--ct-15803d, #15803D)" : "var(--ct-57524c, #57524C)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {copiadoCampo === "mail" ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Notas del cliente + etiquetas rápidas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="ficha-cliente-notas"
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--ct-221e1b, #221E1B)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <StickyNote size={13} />
              <span>Notas internas del cliente (visibles en todos sus canales)</span>
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {SUGERENCIAS_NOTAS_CLIENTE_OMNICANAL.map((chip) => {
                const incluido = notas.toLowerCase().includes(chip.toLowerCase());
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => alternarChipNota(chip)}
                    title={`Agregar "${chip}" a las notas del cliente`}
                    aria-label={`Agregar nota ${chip}`}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      border: incluido ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                      background: incluido ? "#221E1B" : "var(--cf-f8f7f4, #F8F7F4)",
                      color: incluido ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {incluido ? `✓ ${chip}` : `+ ${chip}`}
                  </button>
                );
              })}
            </div>

            <textarea
              id="ficha-cliente-notas"
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Cliente de eventos corporativos, Recomendado Nancy, prefiere tonos pastel, atención cuidadosa..."
              style={{
                width: "100%",
                padding: "9px 11px",
                borderRadius: "10px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: "var(--cf-fffdf9, #FFFDF9)",
                color: "var(--ct-1f1c19, #1F1C19)",
                fontSize: esMovil ? "16px" : "0.82rem",
                lineHeight: 1.45,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            {conversacion?.fichaCliente?.actualizadoEn && (
              <span style={{ fontSize: "0.69rem", color: "var(--ct-847d74, #847D74)" }}>
                Última edición:{" "}
                {conversacion.fichaCliente.actualizadoPorNombre || "Equipo"} ·{" "}
                {new Date(conversacion.fichaCliente.actualizadoEn).toLocaleString("es-EC", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>

          {/* 4. Puente Omnicanal Web <-> WhatsApp y todos sus canales */}
          {(conversacionesCliente.length > 0 ||
            resumenPuente.ultimoProd ||
            resumenPuente.refWeb ||
            resumenPuente.wref) && (
            <div
              style={{
                padding: "11px 13px",
                borderRadius: "12px",
                background: "var(--cf-f8f7f4, #F8F7F4)",
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
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
                  gap: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                  Actividad y correlación entre canales ({conversacionesCliente.length})
                </span>
                <div style={{ display: "inline-flex", gap: "5px", flexWrap: "wrap" }}>
                  {resumenPuente.refWeb && (
                    <span
                      title="Código único de sesión en Tienda Web para vincular con WhatsApp"
                      style={{
                        fontSize: "0.66rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "6px",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        color: "var(--ct-3a3530, #3A3530)",
                      }}
                    >
                      Web: {resumenPuente.refWeb}
                    </span>
                  )}
                  {resumenPuente.wref && (
                    <span
                      title="Código de atribución para links enviados desde WhatsApp hacia la Web"
                      style={{
                        fontSize: "0.66rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "6px",
                        background: "var(--cf-f0fdf4, #F0FDF4)",
                        border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
                        color: "var(--ct-15803d, #15803D)",
                      }}
                    >
                      WA: {resumenPuente.wref}
                    </span>
                  )}
                </div>
              </div>

              {resumenPuente.ultimoProd && (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: "9px",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ct-2f4737, #2F4737)" }}>
                      🛍️ Último producto revisado en Tienda Web
                    </span>
                    <strong
                      style={{
                        fontSize: "0.79rem",
                        color: "var(--ct-1f1c19, #1F1C19)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {resumenPuente.ultimoProd.productoNombre || "Catálogo Tinkay"}
                      {resumenPuente.ultimoProd.varianteNombre
                        ? ` · ${resumenPuente.ultimoProd.varianteNombre}`
                        : ""}
                      {resumenPuente.ultimoProd.pvp != null
                        ? ` ($${Number(resumenPuente.ultimoProd.pvp).toFixed(2)})`
                        : ""}
                    </strong>
                  </div>
                  {resumenPuente.ultimoProd.urlPagina && (
                    <a
                      href={resumenPuente.ultimoProd.urlPagina}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver producto en la tienda web"
                      aria-label="Ver producto"
                      style={{
                        padding: "5px 8px",
                        borderRadius: "7px",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        background: "var(--cf-faf8f5, #FAF8F5)",
                        color: "var(--ct-221e1b, #221E1B)",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 0,
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>Ver</span>
                    </a>
                  )}
                </div>
              )}

              {conversacionesCliente.map((c) => {
                const esActual = conversacion?.id === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "9px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border: esActual ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <IconoVectorCanal canal={c.canal} size={15} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                          {nombreLegibleCanal(c.canal)}
                          {esActual ? " (Actual)" : ""}
                        </div>
                        <div style={{ fontSize: "0.69rem", color: "var(--ct-847d74, #847D74)" }}>
                          Cliente: {c.mensajesClienteConteo} · ARIA: {c.mensajesIaConteo} · Humano:{" "}
                          {c.mensajesHumanoConteo}
                        </div>
                      </div>
                    </div>

                    {!esActual && onSeleccionarConversacion && (
                      <button
                        type="button"
                        onClick={() => {
                          onSeleccionarConversacion(c.id);
                          onCerrar();
                        }}
                        title={`Cambiar al hilo en ${nombreLegibleCanal(c.canal)}`}
                        aria-label="Ir al chat"
                        style={{
                          padding: "5px 9px",
                          borderRadius: "7px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background: "var(--cf-faf8f5, #FAF8F5)",
                          color: "var(--ct-1f1c19, #1F1C19)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          flexShrink: 0,
                        }}
                      >
                        <MessageCircle size={12} />
                        <span>Ir al chat</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 5. Historial resumido de Compras / Proformas Web */}
          {pedidosCliente.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--ct-1f1c19, #1F1C19)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <ShoppingBag size={13} />
                <span>Compras y Proformas en Tienda Web ({pedidosCliente.length})</span>
              </span>
              {pedidosCliente.slice(0, 5).map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    padding: "7px 10px",
                    borderRadius: "9px",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.77rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                      {ord.codigoOrden}
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--ct-847d74, #847D74)", marginLeft: "6px" }}>
                      {ord.estado} ·{" "}
                      {new Date(ord.creadoEn).toLocaleDateString("es-EC", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <strong style={{ fontSize: "0.78rem", color: "var(--ct-2f4737, #2F4737)" }}>
                    ${Number(ord.total).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pie fijo de acciones */}
        <div
          style={{
            padding: esMovil
              ? "11px 16px calc(11px + env(safe-area-inset-bottom, 0px))"
              : "12px 20px",
            borderTop: "1px solid var(--cb-ece8e1, #ECE8E1)",
            background: "var(--cf-faf8f5, #FAF8F5)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            type="button"
            disabled={guardando}
            onClick={onCerrar}
            title="Cerrar sin guardar cambios"
            aria-label="Cancelar"
            style={{
              minHeight: "40px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-57524c, #57524C)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: guardando ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={guardando}
            title="Guardar nombre, estrellas y notas del cliente en todos los canales"
            aria-label="Guardar ficha"
            style={{
              minHeight: "40px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              background: "#221E1B",
              color: "#FFFFFF",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: guardando ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {guardando ? <Loader2 size={15} /> : <Save size={15} />}
            <span>{guardando ? "Guardando…" : "Guardar ficha"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
