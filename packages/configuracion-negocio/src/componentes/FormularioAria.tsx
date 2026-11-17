"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  MessageCircle,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  borrarClaveAria,
  guardarAria,
  guardarWhatsappYcloudAction,
  probarConexionAria,
} from "../acciones-aria";
import { URL_ARIA_DEFECTO, type ConfiguracionAriaVista } from "../esquema-aria";
import {
  estiloAlertaMensaje,
  estiloBotonPeligroSuave,
  estiloBotonPrimario,
  estiloBotonSecundario,
  estiloCabeceraTarjeta,
  estiloCajaIconoCabecera,
  estiloCajaToggle,
  estiloCodigoBadge,
  estiloCuerpoTarjeta,
  estiloEtiquetaCampo,
  estiloGrillaDosColumnas,
  estiloGrupoCampo,
  estiloInputCampo,
  estiloInputMonoespaciado,
  estiloPastillaEstado,
  estiloPieTarjeta,
  estiloSubtituloBloque,
  estiloTarjetaConfig,
  estiloTextoAyuda,
} from "./estilos-configuracion";

interface BorradorNoSecretoAria {
  baseUrl: string;
  agenteId: string;
  nombreAgente: string;
  activo: boolean;
}

const SUGERENCIA_AGENTE_POR_NEGOCIO: Record<string, string> = {
  tinkay: "Mía — Asesora Floral",
  tranqi: "Asistente Legal Tranqi",
  fastfix: "Asesor Técnico FastFix",
  margaritas: "Asesora Floral Margaritas",
};

const AGENTE_ID_DEFECTO_POR_NEGOCIO: Record<string, string> = {
  tinkay: "c717f44a-028e-4e9c-a190-4eb0b774c588",
};

function claveLocalBorrador(negocio: string): string {
  return `eco_cfg_aria_meta_v1_${negocio.trim().toLowerCase()}`;
}

// PLT-008 / PLT-004 (ADR-0002): parámetros de conexión a ARIA por negocio.
// Las claves secretas viven en Supabase Vault y nunca se precargan ni se guardan en localStorage.
export function FormularioAria({
  inicial,
  negocio,
}: {
  inicial: ConfiguracionAriaVista | null;
  negocio: string;
}) {
  const codigoNegocio = negocio.trim().toLowerCase();
  const sugerenciaNombre =
    SUGERENCIA_AGENTE_POR_NEGOCIO[codigoNegocio] ?? `Agente ARIA (${codigoNegocio})`;

  const [nombreAgente, setNombreAgente] = useState(
    inicial?.nombreAgente || SUGERENCIA_AGENTE_POR_NEGOCIO[codigoNegocio] || "",
  );
  const [baseUrl, setBaseUrl] = useState(inicial?.baseUrl ?? URL_ARIA_DEFECTO);
  const [agenteId, setAgenteId] = useState(
    inicial?.agenteId || AGENTE_ID_DEFECTO_POR_NEGOCIO[codigoNegocio] || "",
  );
  const [apiKey, setApiKey] = useState("");
  const [tenantKey, setTenantKey] = useState("");
  const [gateKey, setGateKey] = useState("");
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [mostrarAvanzadas, setMostrarAvanzadas] = useState(false);
  const [mensajePrueba, setMensajePrueba] = useState("");

  const [tieneApiKey, setTieneApiKey] = useState(inicial?.tieneApiKey ?? false);
  const [tieneTenantKey, setTieneTenantKey] = useState(inicial?.tieneTenantKey ?? false);
  const [tieneGateKey, setTieneGateKey] = useState(inicial?.tieneGateKey ?? false);

  // Estado Canal WhatsApp Business (YCloud)
  const [ycloudHabilitado, setYcloudHabilitado] = useState<boolean>(
    inicial?.ycloudHabilitado ?? false
  );
  const [ycloudNumeroEmisor, setYcloudNumeroEmisor] = useState<string>(
    inicial?.ycloudNumeroEmisor || (codigoNegocio === "tinkay" ? "+593996438873" : "")
  );
  const [ycloudNumerosPermitidos, setYcloudNumerosPermitidos] = useState<string>(
    inicial?.ycloudNumerosPermitidos ?? (codigoNegocio === "tinkay" ? "+593 99 972 7844" : "")
  );
  const [whatsappAgenteId, setWhatsappAgenteId] = useState<string>(
    inicial?.whatsappAgenteId ?? ""
  );
  const [ycloudApiKey, setYcloudApiKey] = useState<string>("");
  const [ycloudWebhookSecret, setYcloudWebhookSecret] = useState<string>("");
  const [whatsappAgenteKey, setWhatsappAgenteKey] = useState<string>("");
  const [webhookToken, setWebhookToken] = useState<string>(inicial?.ycloudWebhookToken ?? "");
  const [tieneYcloudApiKey, setTieneYcloudApiKey] = useState<boolean>(
    inicial?.tieneYcloudApiKey ?? false
  );
  const [tieneWebhookSecret, setTieneWebhookSecret] = useState<boolean>(
    inicial?.tieneYcloudWebhookSecret ?? false
  );
  const [tieneWhatsappAgenteKey, setTieneWhatsappAgenteKey] = useState<boolean>(
    inicial?.tieneWhatsappAgenteKey ?? false
  );
  const [mostrarAvanzadasYcloud, setMostrarAvanzadasYcloud] = useState<boolean>(false);
  const [guardandoYcloud, setGuardandoYcloud] = useState<boolean>(false);
  const [mensajeYcloud, setMensajeYcloud] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );
  const [copiadoTipo, setCopiadoTipo] = useState<"nuevo" | "anterior" | null>(null);
  const [origenActual, setOrigenActual] = useState<string>(
    codigoNegocio === "tinkay" ? "https://tinkay-web.vercel.app" : ""
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigenActual(window.location.origin.replace(/\/+$/, ""));
    }
  }, []);

  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [respuestaPrueba, setRespuestaPrueba] = useState<string | null>(null);

  useEffect(() => {
    if (inicial) return;
    try {
      const crudo = window.localStorage.getItem(claveLocalBorrador(codigoNegocio));
      if (!crudo) return;
      const borrador = JSON.parse(crudo) as Partial<BorradorNoSecretoAria>;
      if (typeof borrador.baseUrl === "string" && borrador.baseUrl) setBaseUrl(borrador.baseUrl);
      if (typeof borrador.agenteId === "string" && borrador.agenteId) setAgenteId(borrador.agenteId);
      if (typeof borrador.nombreAgente === "string" && borrador.nombreAgente) {
        setNombreAgente(borrador.nombreAgente);
      }
      if (typeof borrador.activo === "boolean") setActivo(borrador.activo);
    } catch {
      // Ignorar errores de parseo de localStorage
    }
  }, [inicial, codigoNegocio]);

  function persistirMetadatosNoSensibles(datos: BorradorNoSecretoAria) {
    try {
      window.localStorage.setItem(claveLocalBorrador(codigoNegocio), JSON.stringify(datos));
    } catch {
      // Ignorar si el navegador restringe almacenamiento
    }
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setRespuestaPrueba(null);

    persistirMetadatosNoSensibles({ baseUrl, agenteId, nombreAgente, activo });

    setGuardando(true);
    const resultado = await guardarAria(
      {
        baseUrl,
        agenteId,
        nombreAgente,
        apiKey,
        tenantKey,
        gateKey,
        activo,
      },
      codigoNegocio,
    );
    setGuardando(false);

    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.error });
      return;
    }

    if (apiKey.trim()) setTieneApiKey(true);
    if (tenantKey.trim()) setTieneTenantKey(true);
    if (gateKey.trim()) setTieneGateKey(true);
    setApiKey("");
    setTenantKey("");
    setGateKey("");
    setMensaje({
      tipo: "ok",
      texto: activo
        ? "Configuración ARIA guardada y activa en Supabase Vault."
        : "Configuración ARIA guardada (agente desactivado).",
    });
  }

  async function alProbarAgente() {
    setMensaje(null);
    setRespuestaPrueba(null);
    setProbando(true);
    const resultado = await probarConexionAria(
      {
        baseUrl,
        agenteId,
        apiKey: apiKey.trim() || undefined,
        mensajePrueba: mensajePrueba.trim() || undefined,
      },
      codigoNegocio,
    );
    setProbando(false);

    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.error });
      return;
    }

    setRespuestaPrueba(resultado.data.respuesta);
    setMensaje({ tipo: "ok", texto: "Conexión verificada en vivo con el agente ARIA." });
  }

  async function alEliminarClave() {
    setMensaje(null);
    setRespuestaPrueba(null);
    setBorrando(true);
    const resultado = await borrarClaveAria(codigoNegocio, "agent");
    setBorrando(false);

    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.error });
      return;
    }

    setTieneApiKey(false);
    setActivo(false);
    setMensaje({
      tipo: "ok",
      texto: "Clave eliminada de Supabase Vault. El agente quedó desactivado.",
    });
  }

  const ocupado = guardando || probando || borrando;
  const tonoEstado = tieneApiKey && activo ? "activo" : tieneApiKey ? "guardado" : "pendiente";

  const urlWebhookTinkay = webhookToken
    ? `${origenActual || "https://tinkay-web.vercel.app"}/api/webhooks/ycloud/${webhookToken}`
    : "";
  const urlRespaldoAriaPrevio =
    inicial?.respaldoWebhookAriaPrevio ||
    "https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf";

  async function copiarAlPortapapeles(texto: string, tipo: "nuevo" | "anterior") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoTipo(tipo);
      setTimeout(() => setCopiadoTipo(null), 2200);
    } catch {
      // Ignorar
    }
  }

  async function alGuardarYcloud(e: React.FormEvent) {
    e.preventDefault();
    setMensajeYcloud(null);
    setGuardandoYcloud(true);

    const res = await guardarWhatsappYcloudAction(
      {
        habilitado: ycloudHabilitado,
        numeroEmisor: ycloudNumeroEmisor,
        numerosPermitidos: ycloudNumerosPermitidos,
        whatsappAgenteId,
        ycloudApiKey,
        ycloudWebhookSecret,
        whatsappAgenteKey,
      },
      codigoNegocio
    );
    setGuardandoYcloud(false);

    if (!res.ok) {
      setMensajeYcloud({ tipo: "error", texto: res.error });
      return;
    }

    if (res.data.webhookToken) setWebhookToken(res.data.webhookToken);
    setTieneYcloudApiKey(res.data.tieneYcloudApiKey);
    setTieneWebhookSecret(res.data.tieneWebhookSecret);
    setTieneWhatsappAgenteKey(res.data.tieneWhatsappAgenteKey);
    setYcloudApiKey("");
    setYcloudWebhookSecret("");
    setWhatsappAgenteKey("");
    setMensajeYcloud({
      tipo: "ok",
      texto: ycloudHabilitado
        ? "Canal WhatsApp YCloud guardado y habilitado. Copia el Endpoint URL de abajo y pégalo en YCloud."
        : "Parámetros de WhatsApp YCloud guardados (modo monitoreo pasivo: sin auto-respuesta IA).",
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
    <form onSubmit={alEnviar} style={estiloTarjetaConfig}>
      {/* Cabecera sobria con estado de Vault */}
      <div style={estiloCabeceraTarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={estiloCajaIconoCabecera}>
            <Bot size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#111827" }}>
              Agente Conversacional ARIA
            </div>
            <div style={{ fontSize: "0.82rem", color: "#6B7280", marginTop: "2px" }}>
              Credenciales aisladas para el chat de <strong>{codigoNegocio}</strong> (cifradas en Supabase Vault).
            </div>
          </div>
        </div>

        <span style={estiloPastillaEstado(tonoEstado)}>
          <KeyRound size={13} />
          {tieneApiKey && activo
            ? "Activo en Vault"
            : tieneApiKey
              ? "Clave en Vault (Inactivo)"
              : "Sin clave en Vault"}
        </span>
      </div>

      {/* Cuerpo del formulario */}
      <div style={estiloCuerpoTarjeta}>
        <div style={estiloSubtituloBloque}>Identificación y endpoint del agente</div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`aria-nombre-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>Nombre descriptivo del agente</span>
            </label>
            <input
              id={`aria-nombre-${codigoNegocio}`}
              style={estiloInputCampo}
              value={nombreAgente}
              onChange={(e) => setNombreAgente(e.target.value)}
              placeholder={sugerenciaNombre}
            />
            <span style={estiloTextoAyuda}>
              Etiqueta interna para identificar qué agente atiende en este negocio.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`aria-base-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>URL Base del Servidor</span>
              <span style={estiloCodigoBadge}>ARIA_BASE</span>
            </label>
            <input
              id={`aria-base-${codigoNegocio}`}
              style={estiloInputMonoespaciado}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              type="url"
              placeholder={URL_ARIA_DEFECTO}
            />
            <span style={estiloTextoAyuda}>
              Raíz del motor de agentes (sin barra final), por defecto {URL_ARIA_DEFECTO}.
            </span>
          </div>
        </div>

        <div style={estiloGrupoCampo}>
          <label htmlFor={`aria-id-${codigoNegocio}`} style={estiloEtiquetaCampo}>
            <span>ID del Agente</span>
            <span style={estiloCodigoBadge}>ARIA_AGENT_ID</span>
          </label>
          <input
            id={`aria-id-${codigoNegocio}`}
            style={estiloInputMonoespaciado}
            value={agenteId}
            onChange={(e) => setAgenteId(e.target.value)}
            placeholder="c717f44a-028e-4e9c-a190-4eb0b774c588"
            spellCheck={false}
          />
          <span style={estiloTextoAyuda}>
            UUID del agente dentro de la consola de ARIA donde administras su identidad y herramientas.
          </span>
        </div>

        <div style={estiloSubtituloBloque}>Seguridad y Vault</div>

        <div style={estiloGrupoCampo}>
          <label htmlFor={`aria-key-${codigoNegocio}`} style={estiloEtiquetaCampo}>
            <span>Token / API Key del Agente</span>
            <span style={estiloCodigoBadge}>ARIA_AGENT_KEY</span>
          </label>
          <input
            id={`aria-key-${codigoNegocio}`}
            style={estiloInputCampo}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={
              tieneApiKey
                ? "Guardada en Vault — escribe solo si deseas reemplazarla"
                : "Pega aquí el token Bearer del agente"
            }
          />
          <span style={estiloTextoAyuda}>
            {tieneApiKey
              ? "Existe una clave cifrada en Supabase Vault. Por seguridad jamás se devuelve al navegador; déjala en blanco para conservarla."
              : "Se guarda cifrada en Supabase Vault y solo se descifra en el servidor al invocar el agente."}
          </span>
        </div>

        {/* Acordeón discreto para claves avanzadas opcionales */}
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "10px",
            background: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setMostrarAvanzadas((v) => !v)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#FAFAFA",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.84rem",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            <span>Claves avanzadas de consola ARIA (opcionales)</span>
            {mostrarAvanzadas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {mostrarAvanzadas && (
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid #E5E7EB",
                ...estiloGrillaDosColumnas,
              }}
            >
              <div style={estiloGrupoCampo}>
                <label htmlFor={`aria-tenant-${codigoNegocio}`} style={estiloEtiquetaCampo}>
                  <span>Tenant Key</span>
                  <span style={estiloCodigoBadge}>ARIA_TENANT_KEY</span>
                </label>
                <input
                  id={`aria-tenant-${codigoNegocio}`}
                  style={estiloInputCampo}
                  value={tenantKey}
                  onChange={(e) => setTenantKey(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    tieneTenantKey
                      ? "Guardada en Vault — escribe para reemplazar"
                      : "Opcional (sincronización de consola)"
                  }
                />
              </div>

              <div style={estiloGrupoCampo}>
                <label htmlFor={`aria-gate-${codigoNegocio}`} style={estiloEtiquetaCampo}>
                  <span>Gate Key</span>
                  <span style={estiloCodigoBadge}>ARIA_GATE_KEY</span>
                </label>
                <input
                  id={`aria-gate-${codigoNegocio}`}
                  style={estiloInputCampo}
                  value={gateKey}
                  onChange={(e) => setGateKey(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    tieneGateKey
                      ? "Guardada en Vault — escribe para reemplazar"
                      : "Opcional (compuerta administrativa)"
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Interruptor de activación */}
        <label
          style={{
            ...estiloCajaToggle,
            background: activo ? "#F0FDF4" : "#F9FAFB",
            borderColor: activo ? "#BBF7D0" : "#E5E7EB",
          }}
        >
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>
              Activar agente conversacional ARIA en este negocio
            </div>
            <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "2px" }}>
              Cuando está activo, el chat público de la tienda consulta en tiempo real a este agente.
            </div>
          </div>
        </label>

        {/* Caja de verificación rápida en vivo */}
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid #E5E7EB",
            background: "#F9FAFB",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#1F2937" }}>
              Verificación de respuesta en vivo
            </span>
            <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
              Envía un mensaje corto para comprobar latencia y credenciales
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              style={{ ...estiloInputCampo, flex: "1 1 240px" }}
              value={mensajePrueba}
              onChange={(e) => setMensajePrueba(e.target.value)}
              placeholder="Ej. Hola, ¿qué arreglo me recomiendas para aniversario?"
            />
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={alProbarAgente}
              disabled={ocupado}
              title="Enviar mensaje de prueba al agente ARIA"
              aria-label="Enviar mensaje de prueba al agente ARIA"
              style={{ ...estiloBotonSecundario, opacity: ocupado ? 0.65 : 1 }}
            >
              <Sparkles size={15} />
              <span className="btn-texto-responsive">
                {probando ? "Consultando…" : "Probar Agente"}
              </span>
            </button>
          </div>

          {respuestaPrueba && (
            <div
              style={{
                marginTop: "4px",
                padding: "12px 14px",
                borderRadius: "9px",
                border: "1px solid #BBF7D0",
                background: "#FFFFFF",
                color: "#14532D",
                fontSize: "0.86rem",
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  marginBottom: "4px",
                  color: "#15803D",
                }}
              >
                <CheckCircle2 size={15} />
                <span>Respuesta recibida desde ARIA:</span>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#1F2937" }}>{respuestaPrueba}</p>
            </div>
          )}
        </div>

        {mensaje && <div style={estiloAlertaMensaje(mensaje.tipo)}>{mensaje.texto}</div>}
      </div>

      {/* Pie de acciones */}
      <div style={estiloPieTarjeta}>
        <div>
          {tieneApiKey && (
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={alEliminarClave}
              disabled={ocupado}
              title="Eliminar clave secreta de ARIA en Vault"
              aria-label="Eliminar clave secreta de ARIA en Vault"
              style={{ ...estiloBotonPeligroSuave, opacity: ocupado ? 0.65 : 1 }}
            >
              <Trash2 size={14} />
              <span className="btn-texto-responsive">
                {borrando ? "Eliminando…" : "Eliminar Clave"}
              </span>
            </button>
          )}
        </div>

        <button
          type="submit"
          className="btn-responsive-accion"
          disabled={ocupado}
          title="Guardar parámetros de ARIA en este negocio"
          aria-label="Guardar parámetros de ARIA en este negocio"
          style={{ ...estiloBotonPrimario, opacity: ocupado ? 0.65 : 1 }}
        >
          <Save size={15} />
          <span className="btn-texto-responsive">
            {guardando ? "Guardando…" : "Guardar Configuración"}
          </span>
        </button>
      </div>
    </form>

    {/* ========================================================================
        TARJETA 2: CANAL WHATSAPP BUSINESS (YCLOUD) — ORQUESTACIÓN HITL + ROLLBACK
    ======================================================================== */}
    <form onSubmit={alGuardarYcloud} style={estiloTarjetaConfig}>
      <div style={estiloCabeceraTarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              ...estiloCajaIconoCabecera,
              background: "#ECFDF5",
              color: "#059669",
              borderColor: "#A7F3D0",
            }}
          >
            <MessageCircle size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#111827" }}>
              Canal WhatsApp Business (YCloud) — Ventas en Vivo & Tomar Control
            </div>
            <div style={{ fontSize: "0.82rem", color: "#6B7280", marginTop: "2px" }}>
              Recibe mensajes de WhatsApp en <code>/panel/conversaciones</code>, responde con Mía (ARIA) y permite intervención humana directa.
            </div>
          </div>
        </div>

        <span
          style={estiloPastillaEstado(
            tieneYcloudApiKey && ycloudHabilitado
              ? "activo"
              : tieneYcloudApiKey
                ? "guardado"
                : "pendiente"
          )}
        >
          <KeyRound size={13} />
          {tieneYcloudApiKey && ycloudHabilitado
            ? "WhatsApp Activo"
            : tieneYcloudApiKey
              ? "API Key en Vault"
              : "Pendiente YCloud Key"}
        </span>
      </div>

      <div style={estiloCuerpoTarjeta}>
        {/* URL DEL WEBHOOK A PEGAR EN YCLOUD */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#F0FDF4",
            border: "1px solid #86EFAC",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: "0.84rem", color: "#14532D" }}>
              1. Endpoint URL para pegar en YCloud → Developers → Webhooks
            </strong>
            {urlWebhookTinkay && (
              <button
                type="button"
                onClick={() => void copiarAlPortapapeles(urlWebhookTinkay, "nuevo")}
                title="Copiar URL del Webhook de Tinkay"
                aria-label="Copiar URL"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 11px",
                  borderRadius: "8px",
                  border: "1px solid #16A34A",
                  background: "#FFFFFF",
                  color: "#15803D",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiadoTipo === "nuevo" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiadoTipo === "nuevo" ? "Copiado" : "Copiar URL"}</span>
              </button>
            )}
          </div>
          <code
            style={{
              display: "block",
              padding: "8px 10px",
              borderRadius: "7px",
              background: "#FFFFFF",
              border: "1px solid #BBF7D0",
              fontSize: "0.79rem",
              color: "#0F172A",
              wordBreak: "break-all",
            }}
          >
            {urlWebhookTinkay ||
              "Pulsa «Guardar WhatsApp» una vez tras ejecutar la migración SQL para generar tu URL única con token."}
          </code>
          <span style={{ fontSize: "0.76rem", color: "#166534" }}>
            Importante: al activar este webhook en YCloud, apaga el switch <strong>«Habilitado»</strong> del canal <code>Tinkay-YCloud</code> en <code>consola.aria.midomo.site → Canales</code> (no lo borres, solo desactívalo) para que Mía no responda duplicado.
          </span>
        </div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label style={estiloEtiquetaCampo}>
              <span>API Key (YCloud)</span>
              <span style={estiloCodigoBadge}>Vault</span>
            </label>
            <input
              style={estiloInputCampo}
              type="password"
              autoComplete="new-password"
              value={ycloudApiKey}
              onChange={(e) => setYcloudApiKey(e.target.value)}
              placeholder={
                tieneYcloudApiKey
                  ? "Guardada en Vault — escribe solo para reemplazarla"
                  : "Pega tu API Key de YCloud (Developers → API key)"
              }
            />
            <span style={estiloTextoAyuda}>
              Necesaria para enviar respuestas de Mía y de las asesoras al WhatsApp del cliente.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label style={estiloEtiquetaCampo}>
              <span>Número emisor WhatsApp (E.164)</span>
            </label>
            <input
              style={estiloInputMonoespaciado}
              type="text"
              value={ycloudNumeroEmisor}
              onChange={(e) => setYcloudNumeroEmisor(e.target.value)}
              placeholder="+593996438873"
            />
            <span style={estiloTextoAyuda}>
              Número oficial conectado en tu cuenta YCloud (ej. +593996438873).
            </span>
          </div>
        </div>

        <div style={estiloGrupoCampo}>
          <label style={estiloEtiquetaCampo}>
            <span>Responder automáticamente con Mía (IA) solo a estos números</span>
          </label>
          <textarea
            style={{ ...estiloInputMonoespaciado, minHeight: "64px", resize: "vertical" }}
            value={ycloudNumerosPermitidos}
            onChange={(e) => setYcloudNumerosPermitidos(e.target.value)}
            placeholder="Vacío = responde a todos los clientes. Ej. de prueba: +593 99 972 7844"
          />
          <span style={estiloTextoAyuda}>
            Idéntico al filtro de ARIA: uno por línea o separados por coma. <strong>Vacío = Mía responde a todos.</strong> Los demás números igual aparecerán en vivo en <code>/panel/conversaciones</code> para atención humana sin que la IA dispare respuestas por accidente.
          </span>
        </div>

        {/* Acordeón opcional: Agente específico de WhatsApp y Signing Secret */}
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "10px",
            background: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setMostrarAvanzadasYcloud((v) => !v)}
            style={{
              width: "100%",
              padding: "11px 16px",
              background: "#FAFAFA",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.83rem",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            <span>
              Opcional: Agente ARIA separado para WhatsApp (`Mía · Tinkay WhatsApp`) y Endpoint Secret
            </span>
            {mostrarAvanzadasYcloud ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {mostrarAvanzadasYcloud && (
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "#4B5563" }}>
                Si en ARIA usas un agente distinto para WhatsApp que para la Web, pega aquí su UUID y su Token; si lo dejas vacío, reutiliza automáticamente el agente principal configurado arriba.
              </span>
              <div style={estiloGrillaDosColumnas}>
                <div style={estiloGrupoCampo}>
                  <label style={estiloEtiquetaCampo}>
                    <span>ID Agente ARIA WhatsApp (opcional)</span>
                  </label>
                  <input
                    style={estiloInputMonoespaciado}
                    value={whatsappAgenteId}
                    onChange={(e) => setWhatsappAgenteId(e.target.value)}
                    placeholder="Vacío = usar ARIA_AGENT_ID principal"
                  />
                </div>

                <div style={estiloGrupoCampo}>
                  <label style={estiloEtiquetaCampo}>
                    <span>Token Agente ARIA WhatsApp (opcional)</span>
                  </label>
                  <input
                    style={estiloInputCampo}
                    type="password"
                    autoComplete="new-password"
                    value={whatsappAgenteKey}
                    onChange={(e) => setWhatsappAgenteKey(e.target.value)}
                    placeholder={
                      tieneWhatsappAgenteKey
                        ? "Guardado en Vault — escribe para reemplazar"
                        : "Vacío = usar ARIA_AGENT_KEY principal"
                    }
                  />
                </div>
              </div>

              <div style={estiloGrupoCampo}>
                <label style={estiloEtiquetaCampo}>
                  <span>Endpoint Signing Secret de YCloud (opcional)</span>
                </label>
                <input
                  style={estiloInputCampo}
                  type="password"
                  autoComplete="new-password"
                  value={ycloudWebhookSecret}
                  onChange={(e) => setYcloudWebhookSecret(e.target.value)}
                  placeholder={
                    tieneWebhookSecret
                      ? "Guardado en Vault — escribe para reemplazar"
                      : "Opcional (cabecera YCloud-Signature)"
                  }
                />
              </div>
            </div>
          )}
        </div>

        <label
          style={{
            ...estiloCajaToggle,
            background: ycloudHabilitado ? "#F0FDF4" : "#F9FAFB",
            borderColor: ycloudHabilitado ? "#BBF7D0" : "#E5E7EB",
          }}
        >
          <input
            type="checkbox"
            checked={ycloudHabilitado}
            onChange={(e) => setYcloudHabilitado(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>
              Habilitar respuesta automática de Mía (ARIA) en WhatsApp vía Tinkay
            </div>
            <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "2px" }}>
              Cuando una asesora pulsa «Tomar Control» en una conversación o responde desde el celular, Mía se silencia automáticamente en ese chat.
            </div>
          </div>
        </label>

        {/* CAJA DE RESPALDO / ROLLBACK INMEDIATO */}
        {codigoNegocio === "tinkay" && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
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
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "#92400E",
                }}
              >
                <RotateCcw size={14} />
                Respaldo de Configuración Previa (Rollback en 10s si necesitas volver atrás)
              </span>
              <button
                type="button"
                onClick={() => void copiarAlPortapapeles(urlRespaldoAriaPrevio, "anterior")}
                title="Copiar el Webhook anterior directo de ARIA"
                aria-label="Copiar Anterior"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 9px",
                  borderRadius: "7px",
                  border: "1px solid #F59E0B",
                  background: "#FFFFFF",
                  color: "#92400E",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiadoTipo === "anterior" ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiadoTipo === "anterior" ? "Copiado" : "Copiar Anterior"}</span>
              </button>
            </div>
            <code style={{ fontSize: "0.75rem", color: "#78350F", wordBreak: "break-all" }}>
              {urlRespaldoAriaPrevio}
            </code>
            <span style={{ fontSize: "0.74rem", color: "#92400E" }}>
              Canal previo en <code>consola.aria.midomo.site → Canales</code>: <strong>Tinkay-YCloud</strong> · Emisor <code>+593 996438873</code> · Filtro prueba <code>+593 99 972 7844</code>. Para revertir: vuelve a pegar ese URL en YCloud y enciende «Habilitado» en ARIA.
            </span>
          </div>
        )}

        {mensajeYcloud && (
          <div style={estiloAlertaMensaje(mensajeYcloud.tipo)}>{mensajeYcloud.texto}</div>
        )}
      </div>

      <div style={estiloPieTarjeta}>
        <div />
        <button
          type="submit"
          className="btn-responsive-accion"
          disabled={guardandoYcloud}
          title="Guardar credenciales y configuración de WhatsApp YCloud"
          aria-label="Guardar WhatsApp"
          style={{ ...estiloBotonPrimario, opacity: guardandoYcloud ? 0.65 : 1 }}
        >
          <Save size={15} />
          <span className="btn-texto-responsive">
            {guardandoYcloud ? "Guardando…" : "Guardar WhatsApp"}
          </span>
        </button>
      </div>
    </form>
    </div>
  );
}
