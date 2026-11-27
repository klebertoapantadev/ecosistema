"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Megaphone,
  Rss,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  borrarTokenMarketingMetaAction,
  cargarMarketingMetaAction,
  guardarMarketingMetaAction,
  probarEventoMetaCapiAction,
} from "../acciones-marketing-meta";
import type { ConfiguracionMarketingMetaVista } from "../esquema-marketing-meta";
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

export interface PropsFormularioMarketingMeta {
  negocio: string;
  inicial?: ConfiguracionMarketingMetaVista | null;
}

const FORMULA_UTM_META_ADS =
  "utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}";

export function FormularioMarketingMeta({ negocio, inicial = null }: PropsFormularioMarketingMeta) {
  const claveCacheLocal = `eco_cfg_marketing_meta_v1_${negocio.toLowerCase()}`;

  const [pixelId, setPixelId] = useState(inicial?.pixelId ?? "");
  const [dominioVerificacion, setDominioVerificacion] = useState(
    inicial?.dominioVerificacion ?? ""
  );
  const [testEventCode, setTestEventCode] = useState(inicial?.testEventCode ?? "");
  const [capiToken, setCapiToken] = useState("");
  const [catalogoActivo, setCatalogoActivo] = useState(inicial?.catalogoActivo ?? true);
  const [activo, setActivo] = useState(inicial?.activo ?? false);
  const [tieneCapiToken, setTieneCapiToken] = useState(Boolean(inicial?.tieneCapiToken));
  const [urlOrigen, setUrlOrigen] = useState("");
  const [copiadoClave, setCopiadoClave] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const [guardando, iniciarGuardado] = useTransition();
  const [probando, iniciarPrueba] = useTransition();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrlOrigen(window.location.origin);
      if (!inicial) {
        try {
          const cache = window.localStorage.getItem(claveCacheLocal);
          if (cache) {
            const parsed = JSON.parse(cache) as Partial<ConfiguracionMarketingMetaVista>;
            if (typeof parsed.pixelId === "string") setPixelId(parsed.pixelId);
            if (typeof parsed.dominioVerificacion === "string") {
              setDominioVerificacion(parsed.dominioVerificacion);
            }
            if (typeof parsed.testEventCode === "string") setTestEventCode(parsed.testEventCode);
            if (typeof parsed.catalogoActivo === "boolean") {
              setCatalogoActivo(parsed.catalogoActivo);
            }
            if (typeof parsed.activo === "boolean") setActivo(parsed.activo);
            if (typeof parsed.tieneCapiToken === "boolean") {
              setTieneCapiToken(parsed.tieneCapiToken);
            }
          }
        } catch {
          // Ignorar caché corrupto
        }
      }
    }

    let cancelado = false;
    if (!inicial) {
      cargarMarketingMetaAction(negocio).then((res) => {
        if (cancelado || !res.ok || !res.data) return;
        setPixelId(res.data.pixelId);
        setDominioVerificacion(res.data.dominioVerificacion);
        setTestEventCode(res.data.testEventCode);
        setCatalogoActivo(res.data.catalogoActivo);
        setActivo(res.data.activo);
        setTieneCapiToken(res.data.tieneCapiToken);
        try {
          window.localStorage.setItem(claveCacheLocal, JSON.stringify(res.data));
        } catch {
          // Ignorar
        }
      });
    }
    return () => {
      cancelado = true;
    };
  }, [negocio, inicial, claveCacheLocal]);

  const urlFeedCatalogo = `${urlOrigen || `https://${negocio}-web.vercel.app`}/api/catalogo/meta-feed.xml`;

  function copiarTexto(clave: string, valor: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(valor).then(() => {
      setCopiadoClave(clave);
      setTimeout(() => setCopiadoClave((actual) => (actual === clave ? null : actual)), 2200);
    });
  }

  function manejarGuardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    iniciarGuardado(async () => {
      const res = await guardarMarketingMetaAction(
        {
          pixelId,
          dominioVerificacion,
          testEventCode,
          capiToken,
          catalogoActivo,
          activo,
        },
        negocio
      );

      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }

      const nuevoTieneToken = Boolean(capiToken.trim()) || tieneCapiToken;
      setTieneCapiToken(nuevoTieneToken);
      setCapiToken("");
      try {
        window.localStorage.setItem(
          claveCacheLocal,
          JSON.stringify({
            negocio,
            pixelId: pixelId.trim(),
            dominioVerificacion: dominioVerificacion.trim(),
            testEventCode: testEventCode.trim(),
            catalogoActivo,
            activo,
            tieneCapiToken: nuevoTieneToken,
          })
        );
      } catch {
        // Ignorar
      }
      setMensaje({
        tipo: "ok",
        texto:
          "Configuración de Meta Pixel, Conversions API y Catálogo guardada correctamente para este negocio.",
      });
    });
  }

  function manejarBorrarToken() {
    setMensaje(null);
    iniciarGuardado(async () => {
      const res = await borrarTokenMarketingMetaAction(negocio);
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setTieneCapiToken(false);
      setCapiToken("");
      setMensaje({ tipo: "ok", texto: "Token de Conversions API eliminado de Supabase Vault." });
    });
  }

  function manejarProbarCapi() {
    setMensaje(null);
    iniciarPrueba(async () => {
      const res = await probarEventoMetaCapiAction(negocio, testEventCode);
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setMensaje({ tipo: "ok", texto: res.data.mensaje });
    });
  }

  const tonoEstado = activo && pixelId ? "activo" : tieneCapiToken || pixelId ? "guardado" : "pendiente";
  const textoEstado =
    activo && pixelId
      ? tieneCapiToken
        ? "Pixel + CAPI Activos"
        : "Pixel Activo (Sin CAPI)"
      : pixelId
        ? "Pausado"
        : "Sin configurar";

  return (
    <form onSubmit={manejarGuardar} style={estiloTarjetaConfig}>
      <div style={estiloCabeceraTarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={estiloCajaIconoCabecera}>
            <Megaphone size={18} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "0.98rem",
                fontWeight: 600,
                color: "var(--ct-1f1c19, #1F1C19)",
              }}
            >
              Meta Pixel, Conversions API (CAPI) y Catálogo Facebook / WhatsApp
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--ct-6b7280, #6B7280)" }}>
              Un único Pixel por negocio con deduplicación servidor, catálogo vivo y atribución de campañas para ARIA.
            </p>
          </div>
        </div>
        <span style={estiloPastillaEstado(tonoEstado)}>{textoEstado}</span>
      </div>

      <div style={estiloCuerpoTarjeta}>
        {mensaje && <div style={estiloAlertaMensaje(mensaje.tipo)}>{mensaje.texto}</div>}

        <div style={estiloSubtituloBloque}>1 · Pixel e Identidad de Dominio en Meta</div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor="meta-pixel-id" style={estiloEtiquetaCampo}>
              <span>Identificador del Conjunto de Datos (Pixel ID)</span>
              <code style={estiloCodigoBadge}>Pixel ID</code>
            </label>
            <input
              id="meta-pixel-id"
              type="text"
              inputMode="numeric"
              placeholder="Ej. 108492837465192"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value.replace(/[^0-9]/g, ""))}
              style={estiloInputMonoespaciado}
            />
            <span style={estiloTextoAyuda}>
              Un solo Pixel para toda la tienda. Envía automáticamente los SKU de variante (ej.{" "}
              <code>TIN-VAR-7</code>) en cada evento.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor="meta-domain-verif" style={estiloEtiquetaCampo}>
              <span>Verificación de Dominio Meta (Opcional)</span>
              <code style={estiloCodigoBadge}>meta-tag</code>
            </label>
            <input
              id="meta-domain-verif"
              type="text"
              placeholder="Ej. x8k2p9m4n7q1w3e5r6t8y0u2i4o6p8"
              value={dominioVerificacion}
              onChange={(e) => setDominioVerificacion(e.target.value)}
              style={estiloInputMonoespaciado}
            />
            <span style={estiloTextoAyuda}>
              Inyecta automáticamente{" "}
              <code>&lt;meta name=&quot;facebook-domain-verification&quot; /&gt;</code> en el encabezado web.
            </span>
          </div>
        </div>

        <div style={estiloSubtituloBloque}>
          2 · API de Conversiones (Servidor CAPI en Supabase Vault)
        </div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor="meta-capi-token" style={estiloEtiquetaCampo}>
              <ShieldCheck size={15} color="#059669" />
              <span>Token de Acceso de API de Conversiones</span>
              {tieneCapiToken && (
                <span style={estiloPastillaEstado("activo")}>Cifrado en Vault</span>
              )}
            </label>
            <input
              id="meta-capi-token"
              type="password"
              autoComplete="new-password"
              placeholder={
                tieneCapiToken
                  ? "•••••••••••••••••••••••• (dejar vacío para conservar el actual)"
                  : "EAA..."
              }
              value={capiToken}
              onChange={(e) => setCapiToken(e.target.value)}
              style={estiloInputMonoespaciado}
            />
            <span style={estiloTextoAyuda}>
              Permite registrar compras aprobadas en PLUX y también comprobantes aprobados de{" "}
              <strong>Transferencia / QR DeUna</strong> sin bloqueadores de navegador.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor="meta-test-code" style={estiloEtiquetaCampo}>
              <span>Código de Prueba de Eventos (Opcional)</span>
              <code style={estiloCodigoBadge}>TEST_EVENT_CODE</code>
            </label>
            <input
              id="meta-test-code"
              type="text"
              placeholder="Ej. TEST48291 (dejar vacío en producción normal)"
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              style={estiloInputMonoespaciado}
            />
            <span style={estiloTextoAyuda}>
              Úsalo temporalmente mientras pruebas con tu agencia en «Probar eventos» de Meta; bórralo al lanzar campañas reales.
            </span>
          </div>
        </div>

        <label style={estiloCajaToggle}>
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            style={{ marginTop: "3px", width: "17px", height: "17px", cursor: "pointer" }}
          />
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ct-111827, #111827)" }}>
              Activar Meta Pixel y API de Conversiones en este negocio
            </div>
            <div style={estiloTextoAyuda}>
              Dispara <code>PageView</code>, <code>ViewContent</code>, <code>AddToCart</code>,{" "}
              <code>InitiateCheckout</code>, <code>Lead</code> (proformas) y <code>Purchase</code>{" "}
              (solo al aprobarse el pago real, con deduplicación exacta por <code>event_id</code>).
            </div>
          </div>
        </label>

        <div style={estiloSubtituloBloque}>
          3 · Catálogo Automático para Facebook, Instagram y WhatsApp Business
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid var(--cb-e5e7eb, #E5E7EB)",
            background: "var(--cf-f9fafb, #F9FAFB)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={catalogoActivo}
              onChange={(e) => setCatalogoActivo(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--ct-111827, #111827)" }}>
              Publicar Feed XML vivo de productos y variantes activas / en temporada
            </span>
          </label>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                flex: "1 1 280px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--cb-d1d5db, #D1D5DB)",
                background: "var(--cf-ffffff, #FFFFFF)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.8rem",
                color: "var(--ct-1f2937, #1F2937)",
                overflowX: "auto",
              }}
            >
              <Rss size={15} color="#EA580C" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>{urlFeedCatalogo}</span>
            </div>
            <button
              type="button"
              onClick={() => copiarTexto("feed", urlFeedCatalogo)}
              className="btn-responsive-accion"
              title="Copiar URL del Feed de Catálogo Meta"
              aria-label="Copiar URL del Feed de Catálogo Meta"
              style={estiloBotonSecundario}
            >
              {copiadoClave === "feed" ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
              <span className="btn-texto-responsive">
                {copiadoClave === "feed" ? "Copiado" : "Copiar Feed"}
              </span>
            </button>
          </div>

          <span style={estiloTextoAyuda}>
            Pega esta URL en <strong>Meta Commerce Manager → Orígenes de datos → Lista programada</strong>.
            Ese mismo catálogo alimenta simultáneamente Facebook Shop, Anuncios Dinámicos de Instagram y el{" "}
            <strong>Catálogo de WhatsApp Business</strong>.
          </span>
        </div>

        <div style={estiloSubtituloBloque}>
          4 · Fórmula de Atribución para que ARIA conozca el Anuncio e Intención
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid var(--cb-e0e7ff, #E0E7FF)",
            background: "var(--cf-eef2ff, #EEF2FF)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ct-312e81, #312E81)" }}>
            <Sparkles size={16} />
            <strong style={{ fontSize: "0.85rem" }}>
              Parámetros de URL para pegar en tus anuncios de Meta Ads
            </strong>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              readOnly
              value={FORMULA_UTM_META_ADS}
              aria-label="Fórmula de parámetros UTM para Meta Ads"
              style={{ ...estiloInputMonoespaciado, flex: "1 1 280px", background: "var(--cf-ffffff, #FFFFFF)" }}
            />
            <button
              type="button"
              onClick={() => copiarTexto("utm", FORMULA_UTM_META_ADS)}
              className="btn-responsive-accion"
              title="Copiar parámetros UTM para Meta Ads"
              aria-label="Copiar parámetros UTM para Meta Ads"
              style={estiloBotonSecundario}
            >
              {copiadoClave === "utm" ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
              <span className="btn-texto-responsive">
                {copiadoClave === "utm" ? "Copiado" : "Copiar UTM"}
              </span>
            </button>
          </div>
          <span style={{ ...estiloTextoAyuda, color: "var(--ct-3730a3, #3730A3)" }}>
            Con esto (y automáticamente en anuncios Clic a WhatsApp de YCloud), ARIA detecta si el
            cliente viene por <strong>Eventos</strong>, <strong>Condolencias</strong>,{" "}
            <strong>Entrega Inmediata</strong> o un arreglo puntual y adapta su tono y recomendaciones desde el primer saludo.
          </span>
        </div>
      </div>

      <div style={estiloPieTarjeta}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {tieneCapiToken && (
            <button
              type="button"
              disabled={guardando || probando}
              onClick={manejarProbarCapi}
              className="btn-responsive-accion"
              title="Enviar evento de verificación a Meta Conversions API"
              aria-label="Enviar evento de verificación a Meta Conversions API"
              style={estiloBotonSecundario}
            >
              <Send size={15} />
              <span className="btn-texto-responsive">
                {probando ? "Probando…" : "Probar CAPI"}
              </span>
            </button>
          )}
          {tieneCapiToken && (
            <button
              type="button"
              disabled={guardando || probando}
              onClick={manejarBorrarToken}
              className="btn-responsive-accion"
              title="Eliminar Token CAPI guardado en Vault"
              aria-label="Eliminar Token CAPI guardado en Vault"
              style={estiloBotonPeligroSuave}
            >
              <Trash2 size={15} />
              <span className="btn-texto-responsive">Borrar Token</span>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="btn-responsive-accion"
          title="Guardar configuración de Marketing y Meta"
          aria-label="Guardar configuración de Marketing y Meta"
          style={estiloBotonPrimario}
        >
          <Save size={16} />
          <span className="btn-texto-responsive">
            {guardando ? "Guardando…" : "Guardar Meta"}
          </span>
        </button>
      </div>
    </form>
  );
}
