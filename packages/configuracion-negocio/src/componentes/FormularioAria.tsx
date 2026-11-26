"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  MessageCircle,
  RotateCcw,
  Save,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  borrarClaveAria,
  borrarClaveEstudioIaAction,
  borrarClaveMetaMensajeriaAction,
  guardarAria,
  guardarEstudioIaAction,
  guardarMetaMensajeriaAction,
  guardarWhatsappYcloudAction,
  probarConexionAria,
  probarEstudioIaAction,
} from "../acciones-aria";
import {
  MODELO_ESTUDIO_IA_DEFECTO_GEMINI,
  MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER,
  URL_ARIA_DEFECTO,
  type ConfiguracionAriaVista,
  type ProveedorEstudioIa,
} from "../esquema-aria";
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
  const [ycloudModoManualDefecto, setYcloudModoManualDefecto] = useState<boolean>(
    inicial?.ycloudModoManualDefecto ?? false
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
  const [sttApiKey, setSttApiKey] = useState<string>("");
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
  const [tieneSttApiKey, setTieneSttApiKey] = useState<boolean>(
    inicial?.tieneSttApiKey ?? false
  );
  const [mostrarAvanzadasYcloud, setMostrarAvanzadasYcloud] = useState<boolean>(false);
  const [guardandoYcloud, setGuardandoYcloud] = useState<boolean>(false);
  const [mensajeYcloud, setMensajeYcloud] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );

  // Estado Canal Redes Sociales Meta (Facebook Messenger e Instagram Direct)
  const [metaFbHabilitado, setMetaFbHabilitado] = useState<boolean>(
    inicial?.metaFbHabilitado ?? false
  );
  const [metaIgHabilitado, setMetaIgHabilitado] = useState<boolean>(
    inicial?.metaIgHabilitado ?? false
  );
  const [metaModoManualDefecto, setMetaModoManualDefecto] = useState<boolean>(
    inicial?.metaModoManualDefecto ?? true
  );
  const [metaPageId, setMetaPageId] = useState<string>(
    inicial?.metaPageId || (codigoNegocio === "tinkay" ? "109525757999859" : "")
  );
  const [metaIgAccountId, setMetaIgAccountId] = useState<string>(
    inicial?.metaIgAccountId || (codigoNegocio === "tinkay" ? "17841448407645348" : "")
  );
  const [metaPageAccessToken, setMetaPageAccessToken] = useState<string>("");
  const [metaIgAccessToken, setMetaIgAccessToken] = useState<string>("");
  const [metaAppSecret, setMetaAppSecret] = useState<string>("");
  const [metaWebhookToken, setMetaWebhookToken] = useState<string>(
    inicial?.metaWebhookToken ?? ""
  );
  const [metaVerifyToken, setMetaVerifyToken] = useState<string>(
    inicial?.metaVerifyToken ?? ""
  );
  const [tieneMetaPageToken, setTieneMetaPageToken] = useState<boolean>(
    inicial?.tieneMetaPageToken ?? false
  );
  const [tieneMetaIgToken, setTieneMetaIgToken] = useState<boolean>(
    inicial?.tieneMetaIgToken ?? false
  );
  const [tieneMetaAppSecret, setTieneMetaAppSecret] = useState<boolean>(
    inicial?.tieneMetaAppSecret ?? false
  );
  const [mostrarAvanzadasMeta, setMostrarAvanzadasMeta] = useState<boolean>(false);
  const [guardandoMeta, setGuardandoMeta] = useState<boolean>(false);
  const [borrandoMeta, setBorrandoMeta] = useState<boolean>(false);
  const [mensajeMeta, setMensajeMeta] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );

  // Estado Estudio IA (Generador de Fotos Estudio + Taller vía OpenRouter / Gemini en Vault)
  const [estudioIaProveedor, setEstudioIaProveedor] = useState<ProveedorEstudioIa>(
    inicial?.estudioIaProveedor === "gemini" ? "gemini" : "openrouter"
  );
  const [estudioIaModelo, setEstudioIaModelo] = useState<string>(
    inicial?.estudioIaModelo || MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER
  );
  const [estudioIaApiKey, setEstudioIaApiKey] = useState<string>("");
  const [estudioIaActivo, setEstudioIaActivo] = useState<boolean>(
    inicial?.estudioIaActivo ?? true
  );
  const [tieneEstudioIaApiKey, setTieneEstudioIaApiKey] = useState<boolean>(
    inicial?.tieneEstudioIaApiKey ?? false
  );
  const [guardandoEstudioIa, setGuardandoEstudioIa] = useState<boolean>(false);
  const [probandoEstudioIa, setProbandoEstudioIa] = useState<boolean>(false);
  const [borrandoEstudioIa, setBorrandoEstudioIa] = useState<boolean>(false);
  const [mensajeEstudioIa, setMensajeEstudioIa] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);
  const [copiadoTipo, setCopiadoTipo] = useState<
    "nuevo" | "anterior" | "meta_url" | "meta_verify" | null
  >(null);
  const [origenActual, setOrigenActual] = useState<string>(
    codigoNegocio === "tinkay" ? "https://www.tinkay.net" : ""
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

  const ocupadoEstudioIa = guardandoEstudioIa || probandoEstudioIa || borrandoEstudioIa;
  const tonoEstadoEstudioIa =
    tieneEstudioIaApiKey && estudioIaActivo
      ? "activo"
      : tieneEstudioIaApiKey
        ? "guardado"
        : "pendiente";

  function alCambiarProveedorEstudioIa(nuevo: ProveedorEstudioIa) {
    setEstudioIaProveedor(nuevo);
    const modeloActual = estudioIaModelo.trim();
    if (
      !modeloActual ||
      modeloActual === MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER ||
      modeloActual === MODELO_ESTUDIO_IA_DEFECTO_GEMINI
    ) {
      setEstudioIaModelo(
        nuevo === "gemini"
          ? MODELO_ESTUDIO_IA_DEFECTO_GEMINI
          : MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER
      );
    }
  }

  async function alGuardarEstudioIa(e: React.FormEvent) {
    e.preventDefault();
    setMensajeEstudioIa(null);
    setGuardandoEstudioIa(true);
    const res = await guardarEstudioIaAction(
      {
        proveedor: estudioIaProveedor,
        modelo: estudioIaModelo,
        activo: estudioIaActivo,
        apiKey: estudioIaApiKey,
      },
      codigoNegocio
    );
    setGuardandoEstudioIa(false);

    if (!res.ok) {
      setMensajeEstudioIa({ tipo: "error", texto: res.error });
      return;
    }

    setTieneEstudioIaApiKey(res.data.tieneApiKey);
    setEstudioIaProveedor(res.data.proveedor);
    setEstudioIaModelo(res.data.modelo);
    setEstudioIaActivo(res.data.activo);
    setEstudioIaApiKey("");
    setMensajeEstudioIa({
      tipo: "ok",
      texto: res.data.activo
        ? `Estudio IA guardado y activo con ${res.data.proveedor === "openrouter" ? "OpenRouter" : "Google Gemini"} en Supabase Vault.`
        : "Configuración de Estudio IA guardada en Supabase Vault (desactivada).",
    });
  }

  async function alProbarEstudioIa() {
    setMensajeEstudioIa(null);
    setProbandoEstudioIa(true);
    const res = await probarEstudioIaAction(
      {
        proveedor: estudioIaProveedor,
        apiKey: estudioIaApiKey.trim() || undefined,
      },
      codigoNegocio
    );
    setProbandoEstudioIa(false);

    if (!res.ok) {
      setMensajeEstudioIa({ tipo: "error", texto: res.error });
      return;
    }

    setMensajeEstudioIa({ tipo: "ok", texto: res.data.detalle });
  }

  async function alEliminarClaveEstudioIa() {
    setMensajeEstudioIa(null);
    setBorrandoEstudioIa(true);
    const res = await borrarClaveEstudioIaAction(codigoNegocio);
    setBorrandoEstudioIa(false);

    if (!res.ok) {
      setMensajeEstudioIa({ tipo: "error", texto: res.error });
      return;
    }

    setTieneEstudioIaApiKey(false);
    setEstudioIaActivo(false);
    setEstudioIaApiKey("");
    setMensajeEstudioIa({
      tipo: "ok",
      texto: "Clave de Estudio IA eliminada de Supabase Vault.",
    });
  }

  const ocupado = guardando || probando || borrando;
  const tonoEstado = tieneApiKey && activo ? "activo" : tieneApiKey ? "guardado" : "pendiente";

  const urlWebhookTinkay = webhookToken
    ? `${origenActual || "https://www.tinkay.net"}/api/webhooks/ycloud/${webhookToken}`
    : "";
  const urlWebhookMeta = metaWebhookToken
    ? `${origenActual || "https://www.tinkay.net"}/api/webhooks/meta/${metaWebhookToken}`
    : "";
  const urlRespaldoAriaPrevio =
    inicial?.respaldoWebhookAriaPrevio ||
    "https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf";

  async function copiarAlPortapapeles(
    texto: string,
    tipo: "nuevo" | "anterior" | "meta_url" | "meta_verify"
  ) {
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
        modoManualDefecto: ycloudModoManualDefecto,
        numeroEmisor: ycloudNumeroEmisor,
        numerosPermitidos: ycloudNumerosPermitidos,
        whatsappAgenteId,
        ycloudApiKey,
        ycloudWebhookSecret,
        whatsappAgenteKey,
        sttApiKey,
      },
      codigoNegocio
    );
    setGuardandoYcloud(false);

    if (!res.ok) {
      setMensajeYcloud({ tipo: "error", texto: res.error });
      return;
    }

    if (res.data.webhookToken) setWebhookToken(res.data.webhookToken);
    setYcloudModoManualDefecto(res.data.modoManualDefecto);
    setTieneYcloudApiKey(res.data.tieneYcloudApiKey);
    setTieneWebhookSecret(res.data.tieneWebhookSecret);
    setTieneWhatsappAgenteKey(res.data.tieneWhatsappAgenteKey);
    if (res.data.tieneSttApiKey !== undefined) setTieneSttApiKey(res.data.tieneSttApiKey);
    setYcloudApiKey("");
    setYcloudWebhookSecret("");
    setWhatsappAgenteKey("");
    setSttApiKey("");
    setMensajeYcloud({
      tipo: "ok",
      texto: ycloudHabilitado
        ? ycloudModoManualDefecto
          ? "Canal WhatsApp YCloud guardado en modo Manual por defecto (activa IA individualmente en cada chat)."
          : "Canal WhatsApp YCloud guardado y habilitado. Copia el Endpoint URL de abajo y pégalo en YCloud."
        : "Parámetros de WhatsApp YCloud guardados (modo monitoreo pasivo: sin auto-respuesta IA).",
    });
  }

  const ocupadoMeta = guardandoMeta || borrandoMeta;
  const tonoEstadoMeta =
    (metaFbHabilitado || metaIgHabilitado) && (tieneMetaPageToken || tieneMetaIgToken)
      ? "activo"
      : tieneMetaPageToken || tieneMetaIgToken
        ? "guardado"
        : "pendiente";

  async function alGuardarMeta(e: React.FormEvent) {
    e.preventDefault();
    setMensajeMeta(null);
    setGuardandoMeta(true);

    const res = await guardarMetaMensajeriaAction(
      {
        fbHabilitado: metaFbHabilitado,
        igHabilitado: metaIgHabilitado,
        modoManualDefecto: metaModoManualDefecto,
        pageId: metaPageId,
        igAccountId: metaIgAccountId,
        pageAccessToken: metaPageAccessToken,
        igAccessToken: metaIgAccessToken,
        appSecret: metaAppSecret,
        verifyToken: metaVerifyToken,
      },
      codigoNegocio
    );
    setGuardandoMeta(false);

    if (!res.ok) {
      setMensajeMeta({ tipo: "error", texto: res.error });
      return;
    }

    if (res.data.webhookToken) setMetaWebhookToken(res.data.webhookToken);
    if (res.data.verifyToken) setMetaVerifyToken(res.data.verifyToken);
    setMetaFbHabilitado(res.data.fbHabilitado);
    setMetaIgHabilitado(res.data.igHabilitado);
    setMetaModoManualDefecto(res.data.modoManualDefecto);
    setTieneMetaPageToken(res.data.tienePageToken);
    setTieneMetaIgToken(res.data.tieneIgToken);
    setTieneMetaAppSecret(res.data.tieneAppSecret);
    setMetaPageAccessToken("");
    setMetaIgAccessToken("");
    setMetaAppSecret("");
    setMensajeMeta({
      tipo: "ok",
      texto: res.data.modoManualDefecto
        ? "Configuración de Facebook e Instagram guardada en Supabase Vault. Todos los chats nuevos entrarán en modo Manual."
        : "Configuración de Facebook e Instagram guardada en Supabase Vault con respuesta automática de Mía (ARIA).",
    });
  }

  async function alEliminarClavesMeta() {
    setMensajeMeta(null);
    setBorrandoMeta(true);
    const res = await borrarClaveMetaMensajeriaAction(codigoNegocio, "todas");
    setBorrandoMeta(false);

    if (!res.ok) {
      setMensajeMeta({ tipo: "error", texto: res.error });
      return;
    }

    setTieneMetaPageToken(false);
    setTieneMetaIgToken(false);
    setTieneMetaAppSecret(false);
    setMetaFbHabilitado(false);
    setMetaIgHabilitado(false);
    setMensajeMeta({
      tipo: "ok",
      texto: "Credenciales de Facebook e Instagram eliminadas de Supabase Vault.",
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
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#1F1C19" }}>
              Agente Conversacional ARIA
            </div>
            <div style={{ fontSize: "0.82rem", color: "#847D74", marginTop: "2px" }}>
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
            border: "1px solid #E6E2DA",
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
              background: "#F8F7F4",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.84rem",
              fontWeight: 600,
              color: "#57524C",
            }}
          >
            <span>Claves avanzadas de consola ARIA (opcionales)</span>
            {mostrarAvanzadas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {mostrarAvanzadas && (
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid #E6E2DA",
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
            background: activo ? "#F2F6F3" : "#F8F7F4",
            borderColor: activo ? "#BBF7D0" : "#E6E2DA",
          }}
        >
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
              Activar agente conversacional ARIA en este negocio
            </div>
            <div style={{ fontSize: "0.78rem", color: "#847D74", marginTop: "2px" }}>
              Cuando está activo, el chat público de la tienda consulta en tiempo real a este agente.
            </div>
          </div>
        </label>

        {/* Caja de verificación rápida en vivo */}
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid #E6E2DA",
            background: "#F8F7F4",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#2E2A26" }}>
              Verificación de respuesta en vivo
            </span>
            <span style={{ fontSize: "0.75rem", color: "#847D74" }}>
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
                  color: "#2F4737",
                }}
              >
                <CheckCircle2 size={15} />
                <span>Respuesta recibida desde ARIA:</span>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#2E2A26" }}>{respuestaPrueba}</p>
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
              background: "#F2F6F3",
              color: "#2F4737",
              borderColor: "#CEDDD3",
            }}
          >
            <MessageCircle size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#1F1C19" }}>
              Canal WhatsApp Business (YCloud) — Ventas en Vivo & Tomar Control
            </div>
            <div style={{ fontSize: "0.82rem", color: "#847D74", marginTop: "2px" }}>
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
            background: "#F2F6F3",
            border: "1px solid #CEDDD3",
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
                  border: "1px solid #2F4737",
                  background: "#FFFFFF",
                  color: "#2F4737",
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
              color: "#1F1C19",
              wordBreak: "break-all",
            }}
          >
            {urlWebhookTinkay ||
              "Pulsa «Guardar WhatsApp» una vez tras ejecutar la migración SQL para generar tu URL única con token."}
          </code>
          <span style={{ fontSize: "0.76rem", color: "#2B4A36" }}>
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

        <div style={estiloGrupoCampo}>
          <label style={estiloEtiquetaCampo}>
            <span>🎙️ Clave IA para Escuchar y Transcribir Notas de Voz (Gemini / OpenRouter)</span>
            <span style={estiloCodigoBadge}>Vault</span>
          </label>
          <input
            style={estiloInputCampo}
            type="password"
            autoComplete="new-password"
            value={sttApiKey}
            onChange={(e) => setSttApiKey(e.target.value)}
            placeholder={
              tieneSttApiKey
                ? "Guardada en Vault — escribe solo para reemplazarla"
                : "Pega tu API Key de Google AI Studio (AIza...) u OpenRouter (sk-or-...)"
            }
          />
          <span style={estiloTextoAyuda}>
            Permite que al llegar una <strong>Nota de Voz</strong> por WhatsApp, el sistema la escuche automáticamente, registre la transcripción como <strong>Nota Interna</strong> en el panel y le pase el texto a Mía (ARIA) para responder al cliente.
          </span>
        </div>

        {/* Acordeón opcional: Agente específico de WhatsApp y Signing Secret */}
        <div
          style={{
            border: "1px solid #E6E2DA",
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
              background: "#F8F7F4",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.83rem",
              fontWeight: 600,
              color: "#57524C",
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
                borderTop: "1px solid #E6E2DA",
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
            background: ycloudHabilitado ? "#F2F6F3" : "#F8F7F4",
            borderColor: ycloudHabilitado ? "#BBF7D0" : "#E6E2DA",
          }}
        >
          <input
            type="checkbox"
            checked={ycloudHabilitado}
            onChange={(e) => setYcloudHabilitado(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
              Habilitar respuesta automática de Mía (ARIA) en WhatsApp vía Tinkay
            </div>
            <div style={{ fontSize: "0.78rem", color: "#847D74", marginTop: "2px" }}>
              Cuando una asesora pulsa «Pausar IA» en una conversación o responde desde el celular, Mía se silencia automáticamente en ese chat.
            </div>
          </div>
        </label>

        <label
          style={{
            ...estiloCajaToggle,
            background: ycloudModoManualDefecto ? "#FAF6EE" : "#F8F7F4",
            borderColor: ycloudModoManualDefecto ? "#E5D7BC" : "#E6E2DA",
          }}
        >
          <input
            type="checkbox"
            checked={ycloudModoManualDefecto}
            onChange={(e) => setYcloudModoManualDefecto(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
              Iniciar chats nuevos de WhatsApp en modo Manual (activar IA individual por chat)
            </div>
            <div style={{ fontSize: "0.78rem", color: "#847D74", marginTop: "2px" }}>
              Si lo marcas, los clientes nuevos llegan en modo Manual para tus asesoras y Mía (ARIA) solo responderá en los chats donde pulses «Activar IA».
            </div>
          </div>
        </label>

        {/* CAJA DE RESPALDO / ROLLBACK INMEDIATO */}
        {codigoNegocio === "tinkay" && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#FAF6EE",
              border: "1px solid #E5D7BC",
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
                  color: "#745622",
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
                  border: "1px solid #8F6A2E",
                  background: "#FFFFFF",
                  color: "#745622",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiadoTipo === "anterior" ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiadoTipo === "anterior" ? "Copiado" : "Copiar Anterior"}</span>
              </button>
            </div>
            <code style={{ fontSize: "0.75rem", color: "#745622", wordBreak: "break-all" }}>
              {urlRespaldoAriaPrevio}
            </code>
            <span style={{ fontSize: "0.74rem", color: "#745622" }}>
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

    {/* ========================================================================
        TARJETA 2B: CANAL FACEBOOK MESSENGER E INSTAGRAM DIRECT (META GRAPH API)
    ======================================================================== */}
    <form id="meta-mensajeria" onSubmit={alGuardarMeta} style={estiloTarjetaConfig}>
      <div style={estiloCabeceraTarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              ...estiloCajaIconoCabecera,
              background: "#EEF4FD",
              color: "#1877F2",
              borderColor: "#C7DCFA",
            }}
          >
            <Share2 size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#1F1C19" }}>
              Canal Facebook Messenger e Instagram Direct (Meta API · $0/msg)
            </div>
            <div style={{ fontSize: "0.82rem", color: "#847D74", marginTop: "2px" }}>
              Recibe y responde chats de Facebook e Instagram directo en <code>/panel/conversaciones</code> con modo Manual por defecto y activación individual de Mía (ARIA).
            </div>
          </div>
        </div>

        <span style={estiloPastillaEstado(tonoEstadoMeta)}>
          <KeyRound size={13} />
          {metaFbHabilitado && metaIgHabilitado && (tieneMetaPageToken || tieneMetaIgToken)
            ? "FB + IG Activos"
            : metaFbHabilitado && tieneMetaPageToken
              ? "Facebook Activo"
              : metaIgHabilitado && (tieneMetaPageToken || tieneMetaIgToken)
                ? "Instagram Activo"
                : tieneMetaPageToken || tieneMetaIgToken
                  ? "Token en Vault"
                  : "Pendiente Meta Token"}
        </span>
      </div>

      <div style={estiloCuerpoTarjeta}>
        {/* URL DEL WEBHOOK Y VERIFY TOKEN PARA META FOR DEVELOPERS */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#F4F7FC",
            border: "1px solid #D3E1F7",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
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
            <strong style={{ fontSize: "0.84rem", color: "#1E3A8A" }}>
              1. Callback URL y Verify Token para Meta for Developers → Webhooks (Messenger & Instagram)
            </strong>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {urlWebhookMeta && (
                <button
                  type="button"
                  onClick={() => void copiarAlPortapapeles(urlWebhookMeta, "meta_url")}
                  title="Copiar Callback URL del Webhook de Meta"
                  aria-label="Copiar URL"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 11px",
                    borderRadius: "8px",
                    border: "1px solid #1877F2",
                    background: "#FFFFFF",
                    color: "#1877F2",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {copiadoTipo === "meta_url" ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiadoTipo === "meta_url" ? "Copiado" : "Copiar URL"}</span>
                </button>
              )}
              {metaVerifyToken && (
                <button
                  type="button"
                  onClick={() => void copiarAlPortapapeles(metaVerifyToken, "meta_verify")}
                  title="Copiar Verify Token para verificación GET de Meta"
                  aria-label="Copiar Verify Token"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 11px",
                    borderRadius: "8px",
                    border: "1px solid #1E3A8A",
                    background: "#FFFFFF",
                    color: "#1E3A8A",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {copiadoTipo === "meta_verify" ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiadoTipo === "meta_verify" ? "Copiado" : "Copiar Verify"}</span>
                </button>
              )}
            </div>
          </div>

          <code
            style={{
              display: "block",
              padding: "8px 10px",
              borderRadius: "7px",
              background: "#FFFFFF",
              border: "1px solid #C7DCFA",
              fontSize: "0.79rem",
              color: "#1F1C19",
              wordBreak: "break-all",
            }}
          >
            {urlWebhookMeta ||
              "Pulsa «Guardar Meta» una vez para generar tu Callback URL única con token."}
          </code>

          {metaVerifyToken && (
            <div style={{ fontSize: "0.77rem", color: "#1E3A8A", wordBreak: "break-all" }}>
              <strong>Verify Token:</strong> <code>{metaVerifyToken}</code>
            </div>
          )}

          <span style={{ fontSize: "0.76rem", color: "#334155" }}>
            Suscribe los campos <code>messages</code>, <code>messaging_postbacks</code>, <code>messaging_referrals</code> y <code>message_echoes</code> en tu App de Meta (`developers.facebook.com`).
          </span>
        </div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`meta-page-id-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>Facebook Page ID</span>
              <span style={estiloCodigoBadge}>Messenger</span>
            </label>
            <input
              id={`meta-page-id-${codigoNegocio}`}
              style={estiloInputMonoespaciado}
              value={metaPageId}
              onChange={(e) => setMetaPageId(e.target.value)}
              disabled={ocupadoMeta}
              placeholder="Ej. 109525757999859"
            />
            <span style={estiloTextoAyuda}>
              ID numérico de la Página de Facebook vinculada a este negocio.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`meta-ig-id-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>Instagram Business Account ID</span>
              <span style={estiloCodigoBadge}>Instagram</span>
            </label>
            <input
              id={`meta-ig-id-${codigoNegocio}`}
              style={estiloInputMonoespaciado}
              value={metaIgAccountId}
              onChange={(e) => setMetaIgAccountId(e.target.value)}
              disabled={ocupadoMeta}
              placeholder="Ej. 17841448407645348"
            />
            <span style={estiloTextoAyuda}>
              ID de la cuenta profesional de Instagram enlazada a la Página.
            </span>
          </div>
        </div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`meta-page-token-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>Page / System User Access Token</span>
              <span style={estiloCodigoBadge}>Vault</span>
            </label>
            <input
              id={`meta-page-token-${codigoNegocio}`}
              style={estiloInputCampo}
              type="password"
              autoComplete="new-password"
              value={metaPageAccessToken}
              onChange={(e) => setMetaPageAccessToken(e.target.value)}
              disabled={ocupadoMeta}
              placeholder={
                tieneMetaPageToken
                  ? "Guardado en Vault — escribe solo para reemplazarlo"
                  : "Pega tu token permanente (EAA...) con pages_messaging e instagram_manage_messages"
              }
            />
            <span style={estiloTextoAyuda}>
              Un solo System User Token del Business Manager sirve tanto para Facebook Messenger como para Instagram Direct.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`meta-app-secret-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>Meta App Secret</span>
              <span style={estiloCodigoBadge}>HMAC-SHA256</span>
            </label>
            <input
              id={`meta-app-secret-${codigoNegocio}`}
              style={estiloInputCampo}
              type="password"
              autoComplete="new-password"
              value={metaAppSecret}
              onChange={(e) => setMetaAppSecret(e.target.value)}
              disabled={ocupadoMeta}
              placeholder={
                tieneMetaAppSecret
                  ? "Guardado en Vault — escribe solo para reemplazarlo"
                  : "App Secret (Configuración básica en developers.facebook.com)"
              }
            />
            <span style={estiloTextoAyuda}>
              Verifica criptográficamente la cabecera <code>X-Hub-Signature-256</code> de cada webhook entrante.
            </span>
          </div>
        </div>

        {/* Acordeón opcional: Instagram Login Token dedicado y Verify Token */}
        <div
          style={{
            border: "1px solid #E6E2DA",
            borderRadius: "10px",
            background: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setMostrarAvanzadasMeta((v) => !v)}
            style={{
              width: "100%",
              padding: "11px 16px",
              background: "#F8F7F4",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.83rem",
              fontWeight: 600,
              color: "#57524C",
            }}
          >
            <span>Opcional: Token dedicado Instagram Login (IGA...) y Verify Token personalizado</span>
            {mostrarAvanzadasMeta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {mostrarAvanzadasMeta && (
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid #E6E2DA",
                ...estiloGrillaDosColumnas,
              }}
            >
              <div style={estiloGrupoCampo}>
                <label style={estiloEtiquetaCampo}>
                  <span>Token Instagram dedicado (opcional)</span>
                  <span style={estiloCodigoBadge}>Vault</span>
                </label>
                <input
                  style={estiloInputCampo}
                  type="password"
                  autoComplete="new-password"
                  value={metaIgAccessToken}
                  onChange={(e) => setMetaIgAccessToken(e.target.value)}
                  disabled={ocupadoMeta}
                  placeholder={
                    tieneMetaIgToken
                      ? "Guardado en Vault — escribe para reemplazar"
                      : "Vacío = reutiliza Page / System User Token"
                  }
                />
              </div>

              <div style={estiloGrupoCampo}>
                <label style={estiloEtiquetaCampo}>
                  <span>Verify Token personalizado</span>
                </label>
                <input
                  style={estiloInputMonoespaciado}
                  value={metaVerifyToken}
                  onChange={(e) => setMetaVerifyToken(e.target.value)}
                  disabled={ocupadoMeta}
                  placeholder="Se autogenera si lo dejas vacío"
                />
              </div>
            </div>
          )}
        </div>

        {/* Interruptor clave: MODO MANUAL POR DEFECTO */}
        <label
          style={{
            ...estiloCajaToggle,
            background: metaModoManualDefecto ? "#FAF6EE" : "#F2F6F3",
            borderColor: metaModoManualDefecto ? "#E5D7BC" : "#BBF7D0",
          }}
        >
          <input
            type="checkbox"
            checked={metaModoManualDefecto}
            onChange={(e) => setMetaModoManualDefecto(e.target.checked)}
            disabled={ocupadoMeta}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
              Modo Manual por defecto en Facebook e Instagram (Recomendado)
            </div>
            <div style={{ fontSize: "0.78rem", color: "#847D74", marginTop: "2px" }}>
              Todos los chats nuevos entran en modo <strong>Manual</strong> para tus asesoras sin respuesta automática. En cualquier conversación individual podrás pulsar <strong>«Activar IA»</strong> para que Mía (ARIA) atienda solo ese chat.
            </div>
          </div>
        </label>

        <div style={estiloGrillaDosColumnas}>
          <label
            style={{
              ...estiloCajaToggle,
              background: metaFbHabilitado ? "#EEF4FD" : "#F8F7F4",
              borderColor: metaFbHabilitado ? "#BFDBFE" : "#E6E2DA",
            }}
          >
            <input
              type="checkbox"
              checked={metaFbHabilitado}
              onChange={(e) => setMetaFbHabilitado(e.target.checked)}
              disabled={ocupadoMeta}
              style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
                Activar Facebook Messenger
              </div>
              <div style={{ fontSize: "0.77rem", color: "#847D74", marginTop: "2px" }}>
                Recibe chats de la Página en vivo y habilita respuestas directas + IA individual.
              </div>
            </div>
          </label>

          <label
            style={{
              ...estiloCajaToggle,
              background: metaIgHabilitado ? "#FDF2F8" : "#F8F7F4",
              borderColor: metaIgHabilitado ? "#FBCFE8" : "#E6E2DA",
            }}
          >
            <input
              type="checkbox"
              checked={metaIgHabilitado}
              onChange={(e) => setMetaIgHabilitado(e.target.checked)}
              disabled={ocupadoMeta}
              style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
                Activar Instagram Direct
              </div>
              <div style={{ fontSize: "0.77rem", color: "#847D74", marginTop: "2px" }}>
                Recibe mensajes directos e historias en vivo con respuesta directa + IA individual.
              </div>
            </div>
          </label>
        </div>

        {mensajeMeta && <div style={estiloAlertaMensaje(mensajeMeta.tipo)}>{mensajeMeta.texto}</div>}
      </div>

      <div style={estiloPieTarjeta}>
        <div>
          {(tieneMetaPageToken || tieneMetaIgToken || tieneMetaAppSecret) && (
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={alEliminarClavesMeta}
              disabled={ocupadoMeta}
              title="Eliminar credenciales de Facebook e Instagram en Vault"
              aria-label="Eliminar Claves"
              style={{ ...estiloBotonPeligroSuave, opacity: ocupadoMeta ? 0.65 : 1 }}
            >
              <Trash2 size={14} />
              <span className="btn-texto-responsive">
                {borrandoMeta ? "Eliminando…" : "Eliminar Claves"}
              </span>
            </button>
          )}
        </div>

        <button
          type="submit"
          className="btn-responsive-accion"
          disabled={ocupadoMeta}
          title="Guardar configuración de Facebook Messenger e Instagram Direct"
          aria-label="Guardar Meta"
          style={{ ...estiloBotonPrimario, opacity: ocupadoMeta ? 0.65 : 1 }}
        >
          <Save size={15} />
          <span className="btn-texto-responsive">
            {guardandoMeta ? "Guardando…" : "Guardar Meta"}
          </span>
        </button>
      </div>
    </form>

    {/* ========================================================================
        TARJETA 3: ESTUDIO IA — GENERADOR DE FOTOS (OPENROUTER / GEMINI EN VAULT)
    ======================================================================== */}
    {codigoNegocio === "tinkay" && (
      <form id="estudio-ia" onSubmit={alGuardarEstudioIa} style={estiloTarjetaConfig}>
        <div style={estiloCabeceraTarjeta}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                ...estiloCajaIconoCabecera,
                background: "#FAF6EE",
                color: "#8F6A2E",
                borderColor: "#E5D7BC",
              }}
            >
              <Camera size={19} />
            </div>
            <div>
              <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#1F1C19" }}>
                Estudio IA — Generador de Fotos (OpenRouter / Gemini)
              </div>
              <div style={{ fontSize: "0.82rem", color: "#847D74", marginTop: "2px" }}>
                Genera automáticamente fotografías de <strong>Estudio</strong> y <strong>Taller</strong> (3:4) desde <code>/panel/entrega-inmediata</code> con clave cifrada en Supabase Vault.
              </div>
            </div>
          </div>

          <span style={estiloPastillaEstado(tonoEstadoEstudioIa)}>
            <KeyRound size={13} />
            {tieneEstudioIaApiKey && estudioIaActivo
              ? `Activo (${estudioIaProveedor === "openrouter" ? "OpenRouter" : "Gemini"})`
              : tieneEstudioIaApiKey
                ? "Clave en Vault"
                : "Sin clave IA"}
          </span>
        </div>

        <div style={estiloCuerpoTarjeta}>
          <div style={estiloGrillaDosColumnas}>
            <div style={estiloGrupoCampo}>
              <label htmlFor={`estudio-ia-prov-${codigoNegocio}`} style={estiloEtiquetaCampo}>
                <span>Proveedor de Generación IA</span>
              </label>
              <select
                id={`estudio-ia-prov-${codigoNegocio}`}
                style={estiloInputCampo}
                value={estudioIaProveedor}
                onChange={(e) =>
                  alCambiarProveedorEstudioIa(e.target.value as ProveedorEstudioIa)
                }
                disabled={ocupadoEstudioIa}
              >
                <option value="openrouter">OpenRouter (Recomendado · tu cuenta openrouter.ai)</option>
                <option value="gemini">Google AI Studio (Gemini directo)</option>
              </select>
              <span style={estiloTextoAyuda}>
                Con OpenRouter usas tu saldo ya recargado y accedes a <code>google/gemini-2.5-flash-image</code>.
              </span>
            </div>

            <div style={estiloGrupoCampo}>
              <label htmlFor={`estudio-ia-modelo-${codigoNegocio}`} style={estiloEtiquetaCampo}>
                <span>Modelo de Imagen</span>
                <span style={estiloCodigoBadge}>3:4</span>
              </label>
              <input
                id={`estudio-ia-modelo-${codigoNegocio}`}
                style={estiloInputMonoespaciado}
                value={estudioIaModelo}
                onChange={(e) => setEstudioIaModelo(e.target.value)}
                disabled={ocupadoEstudioIa}
                placeholder={
                  estudioIaProveedor === "gemini"
                    ? MODELO_ESTUDIO_IA_DEFECTO_GEMINI
                    : MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER
                }
              />
              <span style={estiloTextoAyuda}>
                Por defecto: <code>{estudioIaProveedor === "gemini" ? MODELO_ESTUDIO_IA_DEFECTO_GEMINI : MODELO_ESTUDIO_IA_DEFECTO_OPENROUTER}</code>.
              </span>
            </div>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`estudio-ia-key-${codigoNegocio}`} style={estiloEtiquetaCampo}>
              <span>
                API Key ({estudioIaProveedor === "openrouter" ? "OpenRouter" : "Google Gemini"})
              </span>
              <span style={estiloCodigoBadge}>Supabase Vault</span>
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                id={`estudio-ia-key-${codigoNegocio}`}
                style={{ ...estiloInputCampo, flex: "1 1 260px" }}
                type="password"
                autoComplete="new-password"
                value={estudioIaApiKey}
                onChange={(e) => setEstudioIaApiKey(e.target.value)}
                disabled={ocupadoEstudioIa}
                placeholder={
                  tieneEstudioIaApiKey
                    ? "Guardada y cifrada en Vault — escribe solo para reemplazarla"
                    : estudioIaProveedor === "openrouter"
                      ? "Pega tu clave de OpenRouter (sk-or-v1-...)"
                      : "Pega tu clave de Google AI Studio (AIza...)"
                }
              />
              <button
                type="button"
                className="btn-responsive-accion"
                onClick={alProbarEstudioIa}
                disabled={ocupadoEstudioIa}
                title="Verificar conexión de la clave sin generar costo"
                aria-label="Probar Clave"
                style={{ ...estiloBotonSecundario, opacity: ocupadoEstudioIa ? 0.65 : 1 }}
              >
                <Sparkles size={15} />
                <span className="btn-texto-responsive">
                  {probandoEstudioIa ? "Verificando…" : "Probar Clave"}
                </span>
              </button>
            </div>
            <span style={estiloTextoAyuda}>
              Se guarda cifrada en <strong>Supabase Vault</strong>. Jamás se expone al navegador ni requiere tocar variables de Vercel.
            </span>
          </div>

          <label
            style={{
              ...estiloCajaToggle,
              background: estudioIaActivo ? "#F2F6F3" : "#F8F7F4",
              borderColor: estudioIaActivo ? "#BBF7D0" : "#E6E2DA",
            }}
          >
            <input
              type="checkbox"
              checked={estudioIaActivo}
              onChange={(e) => setEstudioIaActivo(e.target.checked)}
              disabled={ocupadoEstudioIa}
              style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
                Activar Estudio IA en Entrega Inmediata
              </div>
              <div style={{ fontSize: "0.78rem", color: "#847D74", marginTop: "2px" }}>
                Habilita el botón «Generar IA» en <code>/panel/entrega-inmediata</code> para producir las tomas Estudio y Taller en paralelo.
              </div>
            </div>
          </label>

          {mensajeEstudioIa && (
            <div style={estiloAlertaMensaje(mensajeEstudioIa.tipo)}>{mensajeEstudioIa.texto}</div>
          )}
        </div>

        <div style={estiloPieTarjeta}>
          <div>
            {tieneEstudioIaApiKey && (
              <button
                type="button"
                className="btn-responsive-accion"
                onClick={alEliminarClaveEstudioIa}
                disabled={ocupadoEstudioIa}
                title="Eliminar API Key de Estudio IA en Vault"
                aria-label="Eliminar Clave"
                style={{ ...estiloBotonPeligroSuave, opacity: ocupadoEstudioIa ? 0.65 : 1 }}
              >
                <Trash2 size={14} />
                <span className="btn-texto-responsive">
                  {borrandoEstudioIa ? "Eliminando…" : "Eliminar Clave"}
                </span>
              </button>
            )}
          </div>

          <button
            type="submit"
            className="btn-responsive-accion"
            disabled={ocupadoEstudioIa}
            title="Guardar configuración y clave de Estudio IA en Vault"
            aria-label="Guardar Estudio IA"
            style={{ ...estiloBotonPrimario, opacity: ocupadoEstudioIa ? 0.65 : 1 }}
          >
            <Save size={15} />
            <span className="btn-texto-responsive">
              {guardandoEstudioIa ? "Guardando…" : "Guardar Estudio IA"}
            </span>
          </button>
        </div>
      </form>
    )}
    </div>
  );
}
