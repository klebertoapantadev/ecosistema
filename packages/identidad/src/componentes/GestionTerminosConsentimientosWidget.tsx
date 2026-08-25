"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileText, Save, Eye, Edit3, CheckCircle2, ShieldCheck, Bell, MessageSquare, Briefcase, Scale, Calendar, Tag, RefreshCw } from "lucide-react";
import { guardarConfiguracionTerminos, obtenerConfiguracionTerminos } from "../acciones";
import { BarraVariablesDinamicas } from "./BarraVariablesDinamicas";

interface Props {
  negocio?: string;
  onGuardarExito?: () => void;
}

export interface CategoriaTerminoDef {
  key: string;
  nombre: string;
  tipo: "terminos" | "beneficios" | "contratos";
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
    tipo: "terminos",
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
    tipo: "terminos",
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
    tipo: "terminos",
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
    tipo: "terminos",
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
    tipo: "terminos",
    descripcion: "Términos de Servicio y Autorización de Verificación LOPDP para postulantes a Socio Abogado.",
    icono: ShieldCheck,
    color: "#5000BA",
    defaultVersion: "v1.0.0",
    defaultMarkdown: `Autorizo expresamente a **tranqi** a verificar la autenticidad de mi título profesional en el portal de la **SENESCYT**, la vigencia de mi matrícula en el **Foro de Abogados del Consejo de la Judicatura** y la veracidad de la información y documentación proporcionada conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP).`,
  },
  {
    key: "incorporacion_red",
    nombre: "Beneficios & Red de Socios",
    tipo: "beneficios",
    descripcion: "Texto preliminar y beneficios que se muestran al postulante antes de iniciar el registro.",
    icono: Briefcase,
    color: "#05876E",
    defaultVersion: "v1.0.0",
    defaultMarkdown: `### Únete a la Red Jurídica Oficial de tranqi

Al formar parte de nuestro equipo de profesionales y socios acreditados, obtendrás:

- **Red Nacional de Clientes:** Acceso a usuarios y empresas que requieren asesoría legal en todo el Ecuador.
- **Cuenta Digital y Expedientes Cifrados:** Gestión autónoma de trámites, consultas y documentos protegidos con cifrado de alta seguridad.
- **Cobros y Pagos Seguros:** Liquidación puntual y transparente de tus honorarios profesionales.
- **Acompañamiento y Tecnología:** Respaldo de nuestra plataforma tecnológica, firma electrónica y soporte operativo continuo.
- **Capacitación Continua:** Acceso a actualizaciones normativas, jurisprudencia y talleres especializados.`,
  },
  {
    key: "contrato_socio",
    nombre: "Contrato de Sociedad & Servicios",
    tipo: "contratos",
    descripcion: "Plantilla oficial del contrato que el socio debe firmar tras ser aprobada su acreditación.",
    icono: FileText,
    color: "#5000BA",
    defaultVersion: "v1.0.0",
    defaultMarkdown: `# CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES Y SOCIEDAD

Por medio del presente documento, se celebra el Contrato de Prestación de Servicios y Acreditación de Socio Abogado entre **tranqi** y el profesional **{{nombre_completo}}**, portador de la cédula de identidad Nro. **{{cedula}}**.

## ANTECEDENTES Y OBJETO
El Socio Abogado declara ser un profesional del derecho debidamente registrado y verificado en la SENESCYT y el Foro de Abogados del Ecuador. tranqi provee al Socio Abogado de una cuenta digital para acceder a solicitudes de asesoría jurídica y clientes en todo el territorio nacional.

## CLÁUSULAS
1. **Confidencialidad:** Las partes se obligan a mantener absoluta confidencialidad sobre toda la información y casos de clientes tratados a través del portal.
2. **Veracidad:** El Socio Abogado garantiza que toda la información académica, certificaciones y matrículas cargadas son reales y vigentes.
3. **Firma y Retorno:** El Socio Abogado acepta descargar este contrato, firmarlo de forma manuscrita o digital en formato PDF o Word y subirlo al portal de tranqi para activar sus credenciales operativas.

En Quito, a la fecha de aceptación de la solicitud.`,
  },
];

export function GestionTerminosConsentimientosWidget({ negocio = "tranqi", onGuardarExito }: Props) {
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "terminos" | "beneficios" | "contratos">("todos");
  const [catSeleccionada, setCatSeleccionada] = useState<string>("notificaciones");
  const [version, setVersion] = useState<string>("v1.5.0");
  const [tituloDocumento, setTituloDocumento] = useState<string>("");
  const [fechaVigencia, setFechaVigencia] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [requiereAceptacion, setRequiereAceptacion] = useState(true);
  const [markdownText, setMarkdownText] = useState("");
  const [modoVista, setModoVista] = useState<"editor" | "previsualizacion">("editor");

  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const categoriasVisibles = CATEGORIAS_TERMINOS.filter((c) => {
    if (filtroTipo === "todos") return true;
    return c.tipo === filtroTipo;
  });

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
          setTituloDocumento(parsed.titulo || targetDef.nombre);
          setFechaVigencia(parsed.fechaVigencia || (new Date().toISOString().split("T")[0] as string));
          setRequiereAceptacion(parsed.requiereAceptacionObligatoria ?? true);
          setMarkdownText(parsed.contenidoMarkdown || targetDef.defaultMarkdown);
        } else {
          const res = await obtenerConfiguracionTerminos(negocio);
          if (res.ok && res.data && res.data[catSeleccionada]) {
            const configServer = res.data[catSeleccionada];
            setVersion(configServer.version || targetDef.defaultVersion);
            setTituloDocumento((configServer as any).titulo || targetDef.nombre);
            setFechaVigencia(configServer.fechaVigencia || (new Date().toISOString().split("T")[0] as string));
            setRequiereAceptacion(configServer.requiereAceptacionObligatoria);
            setMarkdownText(configServer.contenidoMarkdown || targetDef.defaultMarkdown);
          } else {
            setVersion(targetDef.defaultVersion);
            setTituloDocumento(targetDef.nombre);
            setFechaVigencia(new Date().toISOString().split("T")[0] as string);
            setRequiereAceptacion(true);
            setMarkdownText(targetDef.defaultMarkdown);
          }
        }
      } catch {
        setVersion(targetDef.defaultVersion);
        setTituloDocumento(targetDef.nombre);
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
      setMensaje({ tipo: "error", texto: "El contenido no puede estar vacío." });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const payload = {
      negocio,
      categoria: catSeleccionada,
      titulo: tituloDocumento.trim() || catActualDef.nombre,
      version: version.trim(),
      fechaVigencia: String(fechaVigencia || "2026-08-16"),
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
        texto: res.data.mensaje || `'${catActualDef.nombre}' guardado y actualizado para todo el ecosistema.`,
      });
      if (onGuardarExito) onGuardarExito();
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudo guardar la configuración." });
    }
  };

  const insertarVariable = (variable: string) => {
    const textoAInsertar = `{{${variable}}}`;
    if (textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const nuevoTexto = markdownText.substring(0, start) + textoAInsertar + markdownText.substring(end);
      setMarkdownText(nuevoTexto);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + textoAInsertar.length, start + textoAInsertar.length);
      }, 50);
    } else {
      setMarkdownText((prev) => prev + ` ${textoAInsertar} `);
    }
  };

  function renderizarPrevisualizacion() {
    let contenido = markdownText;
    // Interpolar tags dinámicos estándar
    contenido = contenido
      .replace(/\{\{nombre_completo\}\}/g, "**[DRA. CAROLINA COLCHA]**")
      .replace(/\{\{cedula\}\}/g, "**[1715489623]**")
      .replace(/\{\{correo\}\}/g, "**[abogada.carolina@gmail.com]**")
      .replace(/\{\{telefono\}\}/g, "**[0998765432]**")
      .replace(/\{\{whatsapp\}\}/g, "**[+593 998765432]**")
      .replace(/\{\{fecha_actual\}\}/g, `**[${new Date().toLocaleDateString("es-EC")}]**`)
      .replace(/\{\{ciudad\}\}/g, "**[Quito, D.M.]**")
      .replace(/\{\{matricula_profesional\}\}/g, "**[17-2020-89]**")
      .replace(/\{\{universidad\}\}/g, "**[Universidad Central del Ecuador]**")
      .replace(/\{\{titulo_profesional\}\}/g, "**[Abogada de los Tribunales de la República]**")
      .replace(/\{\{representante_legal\}\}/g, "**[Dr. Kleber Toapanta]**")
      .replace(/\{\{negocio\}\}/g, `**${negocio.toUpperCase()}**`)
      // Interpolar cualquier otra variable personalizada {{variable}}
      .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, "**[$1]**");

    return contenido;
  }

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
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
            <FileText size={20} color="var(--violeta, #5000BA)" /> Configuración de Términos, Contratos & Beneficios
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
            Consola unificada para Operadores y Administradores ({negocio.toUpperCase()}): gestión de cláusulas LOPDP, contratos de sociedad y textos informativos de beneficios.
          </p>
        </div>

        {/* Filtros Principales por Tipo de Documento */}
        <div style={{ display: "flex", gap: "6px", background: "var(--panel-papel, #F7F6FA)", padding: "4px", borderRadius: "10px", border: "1px solid var(--panel-linea, #E4E4E4)" }}>
          <button
            type="button"
            onClick={() => setFiltroTipo("todos")}
            style={{
              background: filtroTipo === "todos" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: filtroTipo === "todos" ? 800 : 600,
              color: filtroTipo === "todos" ? "var(--violeta, #5000BA)" : "#737373",
              cursor: "pointer",
              boxShadow: filtroTipo === "todos" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Todos ({CATEGORIAS_TERMINOS.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltroTipo("terminos");
              const primera = CATEGORIAS_TERMINOS.find((c) => c.tipo === "terminos");
              if (primera && catActualDef.tipo !== "terminos") setCatSeleccionada(primera.key);
            }}
            style={{
              background: filtroTipo === "terminos" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: filtroTipo === "terminos" ? 800 : 600,
              color: filtroTipo === "terminos" ? "var(--violeta, #5000BA)" : "#737373",
              cursor: "pointer",
              boxShadow: filtroTipo === "terminos" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Términos & LOPDP
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltroTipo("beneficios");
              const primera = CATEGORIAS_TERMINOS.find((c) => c.tipo === "beneficios");
              if (primera) setCatSeleccionada(primera.key);
            }}
            style={{
              background: filtroTipo === "beneficios" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: filtroTipo === "beneficios" ? 800 : 600,
              color: filtroTipo === "beneficios" ? "var(--esmeralda, #05876E)" : "#737373",
              cursor: "pointer",
              boxShadow: filtroTipo === "beneficios" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Beneficios de Red
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltroTipo("contratos");
              const primera = CATEGORIAS_TERMINOS.find((c) => c.tipo === "contratos");
              if (primera) setCatSeleccionada(primera.key);
            }}
            style={{
              background: filtroTipo === "contratos" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: filtroTipo === "contratos" ? 800 : 600,
              color: filtroTipo === "contratos" ? "#B45309" : "#737373",
              cursor: "pointer",
              boxShadow: filtroTipo === "contratos" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Contratos
          </button>
        </div>
      </div>

      {/* Tabs por Categorías de Consentimientos */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", borderBottom: "1px solid var(--panel-linea, #E4E4E4)" }}>
        {categoriasVisibles.map((cat) => {
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
              {cat.tipo === "beneficios" && (
                <span style={{ fontSize: "0.62rem", background: "rgba(5,135,110,0.12)", color: "#05876E", padding: "1px 5px", borderRadius: "999px", fontWeight: 800 }}>
                  Beneficios
                </span>
              )}
              {cat.tipo === "contratos" && (
                <span style={{ fontSize: "0.62rem", background: "rgba(180,83,9,0.12)", color: "#B45309", padding: "1px 5px", borderRadius: "999px", fontWeight: 800 }}>
                  Contrato
                </span>
              )}
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
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--negro, #111111)" }}>
              {catActualDef.nombre}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: "4px",
                background: catActualDef.tipo === "contratos" ? "#FEF3C7" : catActualDef.tipo === "beneficios" ? "#D1FAE5" : "#EDE9FE",
                color: catActualDef.tipo === "contratos" ? "#92400E" : catActualDef.tipo === "beneficios" ? "#065F46" : "#5B21B6",
              }}
            >
              {catActualDef.tipo.toUpperCase()}
            </span>
          </div>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--panel-gris, #737373)" }}>
            {catActualDef.descripcion}
          </p>
        </div>

        {/* Botón para restaurar plantilla por defecto */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`¿Deseas restaurar la plantilla predeterminada de '${catActualDef.nombre}'?`)) {
              setMarkdownText(catActualDef.defaultMarkdown);
              setVersion(catActualDef.defaultVersion);
              setTituloDocumento(catActualDef.nombre);
            }
          }}
          title="Restaurar plantilla inicial predeterminada"
          style={{
            background: "transparent",
            border: "1px solid var(--panel-linea, #E4E4E4)",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "0.72rem",
            color: "var(--panel-gris, #737373)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <RefreshCw size={12} /> Restaurar Default
        </button>
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
        {/* Fila de Metadatos: Título, Versión, Fecha de Vigencia y Checkbox Obligatorio */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.82rem", fontWeight: 700 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <FileText size={14} color="var(--violeta, #5000BA)" /> Título del Documento
            </span>
            <input
              type="text"
              value={tituloDocumento}
              onChange={(e) => setTituloDocumento(e.target.value)}
              placeholder="ej. Contrato de Prestación de Servicios"
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
              <Tag size={14} color="var(--violeta, #5000BA)" /> Código de Versión
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

          <div style={{ display: "flex", alignItems: "center", paddingTop: "18px" }}>
            <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.83rem", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={requiereAceptacion}
                onChange={(e) => setRequiereAceptacion(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              Exigir Aceptación / Firma Obligatoria
            </label>
          </div>
        </div>

        {/* Variables dinámicas para Contratos, Términos y Registro */}
        <BarraVariablesDinamicas onInsertarVariable={insertarVariable} negocio={negocio} />

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
            ref={textareaRef}
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            disabled={cargando}
            rows={12}
            placeholder="Escribe aquí el contenido en formato Markdown..."
            style={{
              width: "100%",
              padding: "14px 16px",
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
              minHeight: "240px",
              padding: "20px 24px",
              borderRadius: "10px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              background: "#FFFFFF",
              fontSize: "0.88rem",
              lineHeight: 1.6,
              color: "#222222",
              whiteSpace: "pre-wrap",
              boxSizing: "border-box",
            }}
          >
            {renderizarPrevisualizacion()}
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
              {guardando ? "Guardando Configuración..." : `Guardar '${catActualDef.nombre}' (${version})`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
