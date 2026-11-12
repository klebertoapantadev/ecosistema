"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, KeyRound, Save, Sparkles, Trash2 } from "lucide-react";
import { borrarClaveAria, guardarAria, probarConexionAria } from "../acciones-aria";
import { URL_ARIA_DEFECTO, type ConfiguracionAriaVista } from "../esquema-aria";

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

// PLT-008 / PLT-010 (ADR-0002): parámetros de conexión a ARIA por negocio.
// Las claves secretas (ARIA_AGENT_KEY, ARIA_TENANT_KEY, ARIA_GATE_KEY) viven en
// Supabase Vault y nunca se precargan ni se guardan en localStorage: solo se
// informa si ya existe una clave cifrada y dejar el campo en blanco la conserva.
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

  const [tieneApiKey, setTieneApiKey] = useState(inicial?.tieneApiKey ?? false);
  const [tieneTenantKey, setTieneTenantKey] = useState(inicial?.tieneTenantKey ?? false);
  const [tieneGateKey, setTieneGateKey] = useState(inicial?.tieneGateKey ?? false);

  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [respuestaPrueba, setRespuestaPrueba] = useState<string | null>(null);

  // Hidratación híbrida (solo metadatos no sensibles si la BDD aún no tiene fila)
  useEffect(() => {
    if (inicial) return;
    try {
      const crudo = window.localStorage.getItem(claveLocalBorrador(codigoNegocio));
      if (!crudo) return;
      const borrador = JSON.parse(crudo) as Partial<BorradorNoSecretoAria>;
      if (typeof borrador.baseUrl === "string" && borrador.baseUrl) setBaseUrl(borrador.baseUrl);
      if (typeof borrador.agenteId === "string") setAgenteId(borrador.agenteId);
      if (typeof borrador.nombreAgente === "string") setNombreAgente(borrador.nombreAgente);
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

    // Resiliencia: respaldar metadatos públicos antes del guardado remoto (jamás las claves)
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
        ? "Configuración ARIA guardada y activa para este negocio."
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
      },
      codigoNegocio,
    );
    setProbando(false);

    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.error });
      return;
    }

    setRespuestaPrueba(resultado.data.respuesta);
    setMensaje({ tipo: "ok", texto: "Conexión verificada correctamente con ARIA." });
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

  return (
    <form onSubmit={alEnviar} className="form-panel">
      {/* Cinta de estado por negocio */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.85rem 1rem",
          borderRadius: "10px",
          border: "1px solid var(--borde, #e2e8f0)",
          background: "var(--superficie-suave, #f8fafc)",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Bot size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: "block", fontSize: "0.92rem" }}>
              Parámetros aislados del negocio: <code>{codigoNegocio}</code>
            </strong>
            <small style={{ color: "var(--texto-suave, #64748b)", fontSize: "0.8rem" }}>
              Cada aplicación gestiona aquí su propio agente sin compartir claves con los demás negocios.
            </small>
          </div>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.28rem 0.65rem",
            borderRadius: "999px",
            fontSize: "0.78rem",
            fontWeight: 600,
            background: tieneApiKey && activo ? "#dcfce7" : tieneApiKey ? "#fef9c3" : "#f1f5f9",
            color: tieneApiKey && activo ? "#166534" : tieneApiKey ? "#854d0e" : "#475569",
          }}
        >
          <KeyRound size={13} />
          {tieneApiKey && activo
            ? "Activo en Vault"
            : tieneApiKey
              ? "Clave guardada (Inactivo)"
              : "Sin clave en Vault"}
        </span>
      </div>

      <label>
        Nombre descriptivo del agente
        <input
          value={nombreAgente}
          onChange={(e) => setNombreAgente(e.target.value)}
          placeholder={sugerenciaNombre}
        />
        <small>Identificador interno para reconocer qué agente atiende en este negocio.</small>
      </label>

      <label>
        URL Base del Servidor ARIA (<code>ARIA_BASE</code>)
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          type="url"
          placeholder={URL_ARIA_DEFECTO}
        />
        <small>
          Dirección raíz del motor de agentes (sin barra final), por defecto{" "}
          <code>{URL_ARIA_DEFECTO}</code>.
        </small>
      </label>

      <label>
        ID del Agente (<code>ARIA_AGENT_ID</code>)
        <input
          value={agenteId}
          onChange={(e) => setAgenteId(e.target.value)}
          placeholder="ej. 7f8c3b20-1234-4abc-9def-0123456789ab"
          spellCheck={false}
        />
        <small>
          Identificador único del agente en el panel de ARIA (donde se edita su prompt e instrucciones).
        </small>
      </label>

      <label>
        API Key del Agente (<code>ARIA_AGENT_KEY</code>)
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          autoComplete="new-password"
          placeholder={
            tieneApiKey
              ? "Guardada en Vault — escribe solo si deseas reemplazarla"
              : "Pega aquí la clave secreta del agente (ARIA_AGENT_KEY)"
          }
        />
        <small>
          {tieneApiKey
            ? "Existe una clave cifrada en Supabase Vault. Nunca puede leerse de vuelta desde el navegador; déjala vacía para mantener la actual."
            : "Se almacena cifrada en Supabase Vault y solo la Edge Function del servidor puede usarla."}
        </small>
      </label>

      <details
        style={{
          border: "1px solid var(--borde, #e2e8f0)",
          borderRadius: "8px",
          padding: "0.75rem 0.9rem",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.88rem",
            userSelect: "none",
          }}
        >
          Claves avanzadas de consola ARIA (opcionales)
        </summary>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.9rem",
            marginTop: "0.85rem",
          }}
        >
          <label>
            Tenant Key (<code>ARIA_TENANT_KEY</code>)
            <input
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={
                tieneTenantKey
                  ? "Guardada en Vault — escribe solo para reemplazarla"
                  : "Opcional: solo si la app sincroniza herramientas de consola"
              }
            />
          </label>

          <label>
            Gate Key (<code>ARIA_GATE_KEY</code>)
            <input
              value={gateKey}
              onChange={(e) => setGateKey(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={
                tieneGateKey
                  ? "Guardada en Vault — escribe solo para reemplazarla"
                  : "Opcional: llave de compuerta de administración ARIA"
              }
            />
          </label>
        </div>
      </details>

      <label className="campo-casilla">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activar este agente conversacional ARIA para atender el chat de este negocio
      </label>

      {mensaje && (
        <p className={mensaje.tipo === "error" ? "error-auth" : "mensaje-ok"}>{mensaje.texto}</p>
      )}

      {respuestaPrueba && (
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#14532d",
            fontSize: "0.88rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 700,
              marginBottom: "0.3rem",
            }}
          >
            <CheckCircle2 size={16} />
            <span>Respuesta en vivo del agente ARIA:</span>
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{respuestaPrueba}</p>
        </div>
      )}

      <div className="fila-botones" style={{ flexWrap: "wrap", gap: "0.6rem" }}>
        <button
          type="submit"
          className="btn btn-negro btn-responsive-accion"
          disabled={ocupado}
          title="Guardar parámetros de ARIA en este negocio"
          aria-label="Guardar parámetros de ARIA en este negocio"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Save size={16} />
          <span className="btn-texto-responsive">
            {guardando ? "Guardando…" : "Guardar Configuración"}
          </span>
        </button>

        <button
          type="button"
          className="btn-mini btn-responsive-accion"
          onClick={alProbarAgente}
          disabled={ocupado}
          title="Enviar mensaje de prueba al agente ARIA"
          aria-label="Enviar mensaje de prueba al agente ARIA"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Sparkles size={15} />
          <span className="btn-texto-responsive">
            {probando ? "Probando…" : "Probar Agente"}
          </span>
        </button>

        {tieneApiKey && (
          <button
            type="button"
            className="btn-mini btn-responsive-accion"
            onClick={alEliminarClave}
            disabled={ocupado}
            title="Eliminar clave secreta de ARIA en Vault"
            aria-label="Eliminar clave secreta de ARIA en Vault"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Trash2 size={15} />
            <span className="btn-texto-responsive">
              {borrando ? "Eliminando…" : "Eliminar Clave"}
            </span>
          </button>
        )}
      </div>
    </form>
  );
}

