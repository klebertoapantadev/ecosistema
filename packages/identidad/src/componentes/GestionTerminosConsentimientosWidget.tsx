"use client";

import React, { useState, useEffect } from "react";
import { FileText, Save, Eye, Edit3, CheckCircle2, ShieldCheck, Bell, MessageSquare, Briefcase, Scale, Calendar, Tag, RefreshCw } from "lucide-react";
import { guardarConfiguracionTerminos, obtenerConfiguracionTerminos } from "../acciones";

interface Props {
  negocio?: string;
  onGuardarExito?: () => void;
}

export interface CategoriaTerminoDef {
  key: string;
  nombre: string;
  descripcion: string;
  icono: React.ElementType;
  color: string;
  defaultMarkdown: string;
  defaultVersion: string;
}

const CATEGORIAS_TERMINOS: CategoriaTerminoDef[] = [
  {
    key: "notificaciones",
    nombre: "Notificaciones & Comunicaciones",
    descripcion: "Términos de envío y recepción de alertas in-app, correo transaccional y avisos generales.",
    icono: Bell,
    color: "#D97706",
    defaultVersion: "v1.5.0",
    defaultMarkdown: `### Términos y Condiciones de Notificaciones Legales y Comunicaciones

1. **Objeto y Alcance:** Al aceptar estas condiciones, el usuario autoriza la recepción de avisos operativos, notificaciones sobre el estado de sus trámites o casos, y alertas de seguridad del sistema.
2. **Canales de Despacho:** Las notificaciones se entregarán mediante la bandeja in-app, correo electrónico registrado y alertas push web/móvil.
3. **Privacidad de Comunicaciones:** Ningún contenido confidencial de expedientes será expuesto en notificaciones públicas.`,
  },
  {
    key: "whatsapp",
    nombre: "Contacto por WhatsApp (Opt-In)",
    descripcion: "Consentimiento explícito para mensajes y seguimiento de casos vía WhatsApp.",
    icono: MessageSquare,
    color: "#05876E",
    defaultVersion: "v1.2.0",
    defaultMarkdown: `### Consentimiento Explicito de Contacto via WhatsApp

1. **Autorización Voluntaria:** El usuario autoriza ser contactado al número de celular/WhatsApp provisto únicamente para avisos de casos, seguimiento de consultas y recordatorios de citas.
2. **Revocación en Cualquier Momento:** El usuario puede desmarcar esta opción desde su perfil ('Mi Cuenta') en cualquier momento sin penalización ni restricción de servicio.
3. **No Spam:** La empresa se compromete a no enviar contenido promocional masivo no solicitado por WhatsApp.`,
  },
  {
    key: "empleo_lopdp",
    nombre: "Bolsa de Empleo & LOPDP Talentos",
    descripcion: "Cláusula de tratamiento de datos personales de postulantes (Ley LOPDP Ecuador).",
    icono: Briefcase,
    color: "#5000BA",
    defaultVersion: "v2.0.0",
    defaultMarkdown: `### Cláusula LOPDP de Protección de Datos para Postulantes y Bolsa de Empleo

1. **Tratamiento Legítimo de Hoja de Vida:** Conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador), el postulante autoriza la recopilación, almacenamiento y revisión de su Hoja de Vida (CV) y documentos adjuntos.
2. **Verificación de Antecedentes:** Se autoriza la verificación estricta de certificaciones académicas, títulos SENESCYT y trayectoria profesional expresada en la postulación.
3. **Período de Conservación:** Los expedientes de candidatos no seleccionados se conservarán por un máximo de 12 meses en repositorio seguro privado antes de su depuración.`,
  },
  {
    key: "servicios_legales",
    nombre: "Servicios Legales & Confidencialidad",
    descripcion: "Consentimiento de cifrado (pgcrypto) y conservación de documentos confidenciales.",
    icono: Scale,
    color: "#111827",
    defaultVersion: "v1.8.0",
    defaultMarkdown: `### Consentimiento de Confidencialidad y Tratamiento Seguro de Documentos Legales

1. **Cifrado de Alta Seguridad:** Todos los documentos personales y expedientes judiciales o administrativos cargados por el cliente son cifrados a nivel de columna mediante tecnología pgcrypto / Vault.
2. **Secreto Profesional & Custodia:** Los abogados y especialistas del ecosistema están cobijados por el secreto profesional y deber de custodia estricta de la información personal y legal.
3. **Derechos ARCO:** El titular puede solicitar el acceso, rectificación o cancelación de sus datos conforme a los protocolos establecidos en la plataforma.`,
  },
  {
    key: "solicitud_socio",
    nombre: "Solicitud Socio Abogado & LOPDP",
    descripcion: "Términos de Servicio y Autorización de Verificación LOPDP para postulantes a Socio Abogado.",
    icono: ShieldCheck,
    color: "#5000BA",
    defaultVersion: "v1.0.0",
    defaultMarkdown: `Autorizo expresamente a **tranqi** a verificar la autenticidad de mi título profesional en el portal de la **SENESCYT**, la vigencia de mi matrícula en el **Foro de Abogados del Consejo de la Judicatura** y la veracidad de la información y documentación proporcionada conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP).`,
  },
];

export function GestionTerminosConsentimientosWidget({ negocio = "tranqi", onGuardarExito }: Props) {
  const [catSeleccionada, setCatSeleccionada] = useState<string>("notificaciones");
  const [version, setVersion] = useState<string>("v1.5.0");
  const [fechaVigencia, setFechaVigencia] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [requiereAceptacion, setRequiereAceptacion] = useState(true);
  const [markdownText, setMarkdownText] = useState("");
  const [modoVista, setModoVista] = useState<"editor" | "previsualizacion">("editor");

  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const catActualDef: CategoriaTerminoDef = (CATEGORIAS_TERMINOS.find((c) => c.key === catSeleccionada) || CATEGORIAS_TERMINOS[0]) as CategoriaTerminoDef;

  // Cargar configuración guardada al cambiar de categoría
  useEffect(() => {
    async function cargarTerminos() {
      setCargando(true);
      setMensaje(null);

      const targetDef: CategoriaTerminoDef = (CATEGORIAS_TERMINOS.find((c) => c.key === catSeleccionada) || CATEGORIAS_TERMINOS[0]) as CategoriaTerminoDef;

      // Cargar respaldo local o desde servidor
      try {
        const localKey = `tranqi_config_terminos_${negocio}_${catSeleccionada}`;
        const localData = typeof window !== "undefined" ? localStorage.getItem(localKey) : null;

        if (localData) {
          const parsed = JSON.parse(localData);
          setVersion(parsed.version || targetDef.defaultVersion);
          setFechaVigencia(parsed.fechaVigencia || (new Date().toISOString().split("T")[0] as string));
          setRequiereAceptacion(parsed.requiereAceptacionObligatoria ?? true);
          setMarkdownText(parsed.contenidoMarkdown || targetDef.defaultMarkdown);
        } else {
          const res = await obtenerConfiguracionTerminos(negocio);
          if (res.ok && res.data && res.data[catSeleccionada]) {
            const configServer = res.data[catSeleccionada];
            setVersion(configServer.version || targetDef.defaultVersion);
            setFechaVigencia(configServer.fechaVigencia || (new Date().toISOString().split("T")[0] as string));
            setRequiereAceptacion(configServer.requiereAceptacionObligatoria);
            setMarkdownText(configServer.contenidoMarkdown || targetDef.defaultMarkdown);
          } else {
            setVersion(targetDef.defaultVersion);
            setFechaVigencia(new Date().toISOString().split("T")[0] as string);
            setRequiereAceptacion(true);
            setMarkdownText(targetDef.defaultMarkdown);
          }
        }
      } catch {
        setVersion(targetDef.defaultVersion);
        setMarkdownText(targetDef.defaultMarkdown);
      } finally {
        setCargando(false);
      }
    }

    cargarTerminos();
  }, [catSeleccionada, negocio]);

  // Guardar cambios en servidor y localStorage
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el código de versión (ej. v1.5.0)." });
      return;
    }
    if (!markdownText.trim()) {
      setMensaje({ tipo: "error", texto: "El contenido de los términos no puede estar vacío." });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const payload = {
      negocio,
      categoria: catSeleccionada,
      version: version.trim(),
      fechaVigencia: String(fechaVigencia || "2026-08-08"),
      requiereAceptacionObligatoria: requiereAceptacion,
      contenidoMarkdown: markdownText,
    };

    // Respaldar localmente de inmediato
    try {
      localStorage.setItem(`tranqi_config_terminos_${negocio}_${catSeleccionada}`, JSON.stringify(payload));
    } catch { /* Ignorar */ }

    const res = await guardarConfiguracionTerminos(payload);
    setGuardando(false);

    if (res.ok) {
      setMensaje({
        tipo: "exito",
        texto: res.data.mensaje || "✅ Términos y consentimientos guardados correctamente.",
      });
      if (onGuardarExito) onGuardarExito();
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudieron guardar los términos." });
    }
  };

  const IconoCatActual = catActualDef.icono;

  return (
    <div
      style={{
        background: "var(--blanco, #ffffff)",
        borderRadius: "14px",
        border: "1px solid var(--panel-linea, #E4E4E4)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header del Widget */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "var(--negro, #111111)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FileText size={20} color="var(--violeta, #5000BA)" /> Configuración de Términos, Consentimientos & LOPDP
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
            Módulo administrativo común ({negocio.toUpperCase()}) para personalizar cláusulas legales, versión y avisos de privacidad.
          </p>
        </div>
      </div>

      {/* Tabs por Categorías de Consentimientos */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", borderBottom: "1px solid var(--panel-linea, #E4E4E4)" }}>
        {CATEGORIAS_TERMINOS.map((cat) => {
          const IconoTab = cat.icono;
          const esActivo = cat.key === catSeleccionada;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCatSeleccionada(cat.key)}
              className="btn-responsive-accion"
              style={{
                background: esActivo ? "var(--violeta-suave, #F3E8FF)" : "transparent",
                border: esActivo ? "1.5px solid var(--violeta, #5000BA)" : "1px solid transparent",
                color: esActivo ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
                fontWeight: esActivo ? 800 : 600,
                fontSize: "0.82rem",
                padding: "8px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <IconoTab size={15} color={esActivo ? "var(--violeta, #5000BA)" : cat.color} />
              <span className="btn-texto-responsive">{cat.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* Tarjeta de Descripción de la Categoría Activa */}
      <div
        style={{
          background: "var(--panel-papel, #F7F6FA)",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          borderRadius: "10px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#FFFFFF",
            border: "1px solid #E0E0E0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconoCatActual size={18} color={catActualDef.color} />
        </div>
        <div>
          <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--negro, #111111)" }}>
            {catActualDef.nombre}
          </span>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--panel-gris, #737373)" }}>
            {catActualDef.descripcion}
          </p>
        </div>
      </div>

      {/* Mensajes de Alerta */}
      {mensaje && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: mensaje.tipo === "exito" ? "rgba(5, 135, 110, 0.12)" : "rgba(176, 0, 32, 0.12)",
            border: mensaje.tipo === "exito" ? "1px solid var(--esmeralda, #05876e)" : "1px solid #B00020",
            color: mensaje.tipo === "exito" ? "var(--esmeralda, #05876e)" : "#B00020",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Formulario Principal de Configuración */}
      <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Fila de Metadatos: Versión, Fecha de Vigencia y Checkbox Obligatorio */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.82rem", fontWeight: 700 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Tag size={14} color="var(--violeta, #5000BA)" /> Código de Versión (LOPDP)
            </span>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
              placeholder="Ej: v1.5.0"
              style={{
                height: "38px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                fontSize: "0.88rem",
                fontWeight: 700,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.82rem", fontWeight: 700 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Calendar size={14} color="var(--esmeralda, #05876E)" /> Fecha de Vigencia
            </span>
            <input
              type="date"
              value={fechaVigencia}
              onChange={(e) => setFechaVigencia(e.target.value)}
              required
              style={{
                height: "38px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                fontSize: "0.88rem",
              }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", paddingTop: "20px" }}>
            <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.83rem", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={requiereAceptacion}
                onChange={(e) => setRequiereAceptacion(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              Exigir Aceptación Obligatoria en Registro
            </label>
          </div>
        </div>

        {/* Conmutador de Modo: Editor vs Previsualización */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--negro, #111111)" }}>
            Contenido en Formato Markdown (.md)
          </span>

          <div style={{ display: "flex", gap: "6px", background: "#F1F1F5", padding: "3px", borderRadius: "8px" }}>
            <button
              type="button"
              onClick={() => setModoVista("editor")}
              className="btn-responsive-accion"
              style={{
                background: modoVista === "editor" ? "#FFFFFF" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "5px 12px",
                fontSize: "0.78rem",
                fontWeight: modoVista === "editor" ? 800 : 600,
                color: modoVista === "editor" ? "var(--violeta, #5000BA)" : "#666",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: modoVista === "editor" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Edit3 size={13} />
              <span className="btn-texto-responsive">Editor Markdown</span>
            </button>

            <button
              type="button"
              onClick={() => setModoVista("previsualizacion")}
              className="btn-responsive-accion"
              style={{
                background: modoVista === "previsualizacion" ? "#FFFFFF" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "5px 12px",
                fontSize: "0.78rem",
                fontWeight: modoVista === "previsualizacion" ? 800 : 600,
                color: modoVista === "previsualizacion" ? "var(--esmeralda, #05876E)" : "#666",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: modoVista === "previsualizacion" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Eye size={13} />
              <span className="btn-texto-responsive">Previsualizar</span>
            </button>
          </div>
        </div>

        {/* Área del Editor / Previsualización */}
        {modoVista === "editor" ? (
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            disabled={cargando}
            rows={10}
            placeholder="Escribe aquí los términos legales en formato Markdown..."
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              fontFamily: "monospace",
              fontSize: "0.86rem",
              lineHeight: 1.5,
              background: "#FAFAFD",
              color: "#111111",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              minHeight: "220px",
              padding: "16px 20px",
              borderRadius: "10px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              background: "#FFFFFF",
              fontSize: "0.86rem",
              lineHeight: 1.6,
              color: "#222222",
              whiteSpace: "pre-wrap",
              boxSizing: "border-box",
            }}
          >
            {markdownText}
          </div>
        )}

        {/* Botón de Guardado General */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
          <button
            type="submit"
            disabled={guardando || cargando}
            className="btn-primario btn-responsive-accion"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 24px",
              fontSize: "0.88rem",
              fontWeight: 800,
            }}
          >
            <Save size={16} />
            <span className="btn-texto-responsive">
              {guardando ? "Guardando Términos..." : `Guardar Términos (${version})`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
