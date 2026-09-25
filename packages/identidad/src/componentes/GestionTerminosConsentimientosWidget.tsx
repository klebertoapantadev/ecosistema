"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Save,
  Eye,
  Edit3,
  CheckCircle2,
  ShieldCheck,
  Bell,
  MessageSquare,
  Briefcase,
  Scale,
  Calendar,
  Tag,
  RefreshCw,
  History,
  Users,
  Search,
  Check,
  AlertCircle,
  FileCode,
  ArrowRight,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
  FileCheck
} from "lucide-react";
import {
  guardarConfiguracionTerminos,
  obtenerConfiguracionTerminos,
  obtenerHistorialVersionesTermino,
  obtenerHistorialConsentimientos,
  type HistorialVersionTermino,
  type RegistroConsentimientoUsuario,
  type ConfigTerminosCategoria,
} from "../acciones";
import { BarraVariablesDinamicas } from "./BarraVariablesDinamicas";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";

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
    defaultMarkdown: `Autorizo expresamente a **{{negocio}}** a verificar la autenticidad de mi título profesional en el portal de la **SENESCYT**, la vigencia de mi matrícula en el **Foro de Abogados del Consejo de la Judicatura** y la veracidad de la información y documentación proporcionada conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP).`,
  },
  {
    key: "incorporacion_red",
    nombre: "Beneficios & Red de Socios",
    tipo: "beneficios",
    descripcion: "Texto preliminar y beneficios que se muestran al postulante antes de iniciar el registro.",
    icono: Briefcase,
    color: "#05876E",
    defaultVersion: "v1.0.0",
    defaultMarkdown: `### Únete a la Red Jurídica Oficial de {{negocio}}

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

Por medio del presente documento, se celebra el Contrato de Prestación de Servicios y Acreditación de Socio Profesional entre **{{negocio}}** y el profesional **{{nombre_completo}}**, portador de la cédula de identidad Nro. **{{cedula}}**.

## ANTECEDENTES Y OBJETO
El Socio Profesional declara ser un profesional debidamente acreditado y habilitado en el Ecuador. {{negocio}} provee al profesional de una cuenta digital para acceder a solicitudes de servicio y clientes en todo el territorio nacional.

## CLÁUSULAS
1. **Confidencialidad:** Las partes se obligan a mantener absoluta confidencialidad sobre toda la información y casos de clientes tratados a través del portal.
2. **Veracidad:** El Socio Profesional garantiza que toda la información académica, certificaciones y datos cargados son reales y vigentes.
3. **Firma y Retorno:** El Socio Profesional acepta firmar este contrato de forma electrónica o manuscrita para activar sus credenciales operativas.

En Quito, a la fecha de aceptación de la solicitud.`,
  },
];

export function GestionTerminosConsentimientosWidget({ negocio = "tranqi", onGuardarExito }: Props) {
  // Pestañas principales
  const [pestanaPrincipal, setPestanaPrincipal] = useState<"editor" | "historial" | "auditoria">("editor");

  // Filtro y selección de documento
  const [busquedaDoc, setBusquedaDoc] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "terminos" | "beneficios" | "contratos">("todos");
  const [catSeleccionada, setCatSeleccionada] = useState<string>("notificaciones");

  // Estados del editor
  const [version, setVersion] = useState<string>("v1.5.0");
  const [tituloDocumento, setTituloDocumento] = useState<string>("");
  const [fechaVigencia, setFechaVigencia] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [requiereAceptacion, setRequiereAceptacion] = useState(true);
  const [markdownText, setMarkdownText] = useState("");
  const [notasCambio, setNotasCambio] = useState("");
  const [modoVista, setModoVista] = useState<"editor" | "previsualizacion">("editor");

  // Estados de consulta y guardado
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Estados de Historial y Auditoría
  const [listaHistorial, setListaHistorial] = useState<HistorialVersionTermino[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [versionSeleccionadaHistorial, setVersionSeleccionadaHistorial] = useState<HistorialVersionTermino | null>(null);

  const [listaConsentimientos, setListaConsentimientos] = useState<RegistroConsentimientoUsuario[]>([]);
  const [cargandoConsentimientos, setCargandoConsentimientos] = useState(false);
  const [filtroNegocioAudit, setFiltroNegocioAudit] = useState<string>("todos");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const catActualDef: CategoriaTerminoDef =
    (CATEGORIAS_TERMINOS.find((c) => c.key === catSeleccionada) || CATEGORIAS_TERMINOS[0]) as CategoriaTerminoDef;

  // Filtrado de documentos para el selector lateral
  const categoriasVisibles = CATEGORIAS_TERMINOS.filter((c) => {
    const coincideTipo = filtroTipo === "todos" || c.tipo === filtroTipo;
    const coincideBusqueda =
      !busquedaDoc.trim() ||
      c.nombre.toLowerCase().includes(busquedaDoc.toLowerCase()) ||
      c.descripcion.toLowerCase().includes(busquedaDoc.toLowerCase()) ||
      c.key.toLowerCase().includes(busquedaDoc.toLowerCase());
    return coincideTipo && coincideBusqueda;
  });

  // Cargar configuración guardada al cambiar de categoría
  useEffect(() => {
    async function cargarTerminos() {
      setCargando(true);
      setMensaje(null);

      const targetDef: CategoriaTerminoDef =
        (CATEGORIAS_TERMINOS.find((c) => c.key === catSeleccionada) || CATEGORIAS_TERMINOS[0]) as CategoriaTerminoDef;

      try {
        const localKey = `tranqi_config_terminos_${negocio}_${catSeleccionada}`;
        const localData = typeof window !== "undefined" ? localStorage.getItem(localKey) : null;

        const res = await obtenerConfiguracionTerminos(negocio);
        if (res.ok && res.data && res.data[catSeleccionada]) {
          const configServer = res.data[catSeleccionada];
          setVersion(configServer.version || targetDef.defaultVersion);
          setTituloDocumento(configServer.titulo || targetDef.nombre);
          setFechaVigencia(configServer.fechaVigencia || (new Date().toISOString().split("T")[0] as string));
          setRequiereAceptacion(configServer.requiereAceptacionObligatoria ?? true);
          setMarkdownText(configServer.contenidoMarkdown || targetDef.defaultMarkdown);
          setNotasCambio(configServer.notasCambio || "");
        } else if (localData) {
          const parsed = JSON.parse(localData);
          setVersion(parsed.version || targetDef.defaultVersion);
          setTituloDocumento(parsed.titulo || targetDef.nombre);
          setFechaVigencia(parsed.fechaVigencia || (new Date().toISOString().split("T")[0] as string));
          setRequiereAceptacion(parsed.requiereAceptacionObligatoria ?? true);
          setMarkdownText(parsed.contenidoMarkdown || targetDef.defaultMarkdown);
        } else {
          setVersion(targetDef.defaultVersion);
          setTituloDocumento(targetDef.nombre);
          setFechaVigencia(new Date().toISOString().split("T")[0] as string);
          setRequiereAceptacion(true);
          setMarkdownText(targetDef.defaultMarkdown);
          setNotasCambio("");
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

  // Cargar historial de versiones al abrir la pestaña
  useEffect(() => {
    if (pestanaPrincipal === "historial") {
      cargarHistorial();
    } else if (pestanaPrincipal === "auditoria") {
      cargarAuditoria();
    }
  }, [pestanaPrincipal, catSeleccionada, negocio, filtroNegocioAudit]);

  async function cargarHistorial() {
    setCargandoHistorial(true);
    const res = await obtenerHistorialVersionesTermino(negocio, catSeleccionada);
    if (res.ok && res.data) {
      setListaHistorial(res.data);
      if (res.data.length > 0) {
        setVersionSeleccionadaHistorial(res.data[0] || null);
      }
    }
    setCargandoHistorial(false);
  }

  async function cargarAuditoria() {
    setCargandoConsentimientos(true);
    const res = await obtenerHistorialConsentimientos(filtroNegocioAudit, "todas");
    if (res.ok && res.data) {
      setListaConsentimientos(res.data);
    }
    setCargandoConsentimientos(false);
  }

  // Guardar cambios en servidor e indexar versión
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
      tipo: catActualDef.tipo,
      version: version.trim(),
      fechaVigencia: String(fechaVigencia || new Date().toISOString().split("T")[0]),
      requiereAceptacionObligatoria: requiereAceptacion,
      contenidoMarkdown: markdownText,
      notasCambio: notasCambio.trim() || `Actualización y versionamiento a ${version.trim()}`,
    };

    try {
      localStorage.setItem(`tranqi_config_terminos_${negocio}_${catSeleccionada}`, JSON.stringify(payload));
    } catch { /* Ignorar */ }

    const res = await guardarConfiguracionTerminos(payload);
    setGuardando(false);

    if (res.ok) {
      setMensaje({
        tipo: "exito",
        texto: res.data?.mensaje || `'${catActualDef.nombre}' versionado y publicado exitosamente.`,
      });
      if (onGuardarExito) onGuardarExito();
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudo guardar la versión." });
    }
  };

  const restaurarVersionHistorica = (hist: HistorialVersionTermino) => {
    setVersion(hist.version);
    setTituloDocumento(hist.titulo);
    setFechaVigencia(hist.fechaVigencia);
    setRequiereAceptacion(hist.requiereAceptacion);
    setMarkdownText(hist.contenidoMarkdown);
    setNotasCambio(`Restaurado a partir de la versión histórica ${hist.version} (${new Date(hist.creadoEn).toLocaleDateString("es-EC")})`);
    setPestanaPrincipal("editor");
    setMensaje({
      tipo: "exito",
      texto: `Versión ${hist.version} cargada en el editor. Puedes revisarla y publicarla.`,
    });
    setTimeout(() => setMensaje(null), 4000);
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

  function renderizarPrevisualizacion(textoMd?: string) {
    let html = textoMd !== undefined ? textoMd : (markdownText || "");

    // Interpolar tags dinámicos estándar con formato destacado
    html = html
      .replace(/\{\{nombre_completo\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[DRA. CAROLINA COLCHA]</strong>')
      .replace(/\{\{cedula\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[1715489623]</strong>')
      .replace(/\{\{correo\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[abogada.carolina@gmail.com]</strong>')
      .replace(/\{\{telefono\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[0998765432]</strong>')
      .replace(/\{\{whatsapp\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[+593 998765432]</strong>')
      .replace(/\{\{fecha_actual\}\}/g, `<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[${new Date().toLocaleDateString("es-EC")}]</strong>`)
      .replace(/\{\{ciudad\}\}/g, '<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Quito, D.M.]</strong>')
      .replace(/\{\{matricula_profesional\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[17-2020-89]</strong>')
      .replace(/\{\{universidad\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Universidad Central del Ecuador]</strong>')
      .replace(/\{\{titulo_profesional\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Abogada de los Tribunales de la República]</strong>')
      .replace(/\{\{representante_legal\}\}/g, '<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Dr. Kleber Toapanta]</strong>')
      .replace(/\{\{negocio\}\}/g, `<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[${negocio.toUpperCase()}]</strong>`)
      .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '<strong style="color: #6B21A8; background: rgba(107,33,168,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[$1]</strong>');

    // Parseo Markdown
    html = html.replace(/^# (.*?)$/gm, '<h1 style="font-size: 1.4rem; color: #111827; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-top: 20px; margin-bottom: 12px; font-weight: 800;">$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h2 style="font-size: 1.18rem; color: #1F2937; margin-top: 18px; margin-bottom: 10px; font-weight: 700;">$1</h2>');
    html = html.replace(/^### (.*?)$/gm, '<h3 style="font-size: 1.05rem; color: #374151; margin-top: 16px; margin-bottom: 8px; font-weight: 700;">$1</h3>');
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #E5E7EB; margin: 16px 0;" />');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: #111827;">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>');
    html = html.replace(/^\d+\.\s+(.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px; font-size: 0.9rem; line-height: 1.6; color: #374151;">$1</li>');
    html = html.replace(/^[-*]\s+(.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px; font-size: 0.9rem; line-height: 1.6; color: #374151; list-style-type: disc;">$1</li>');
    html = html.split("\n\n").map((p) => {
      const limpio = p.trim();
      if (!limpio) return "";
      if (limpio.startsWith("<h") || limpio.startsWith("<li") || limpio.startsWith("<hr")) return limpio;
      return `<p style="margin-bottom: 12px; font-size: 0.9rem; line-height: 1.65; color: #374151;">${limpio.replace(/\n/g, "<br/>")}</p>`;
    }).join("");

    return html;
  }

  // Columnas para el DataGrid de Auditoría de Consentimientos
  const COLUMNAS_AUDITORIA: ColumnaDataGrid<RegistroConsentimientoUsuario>[] = [
    {
      id: "usuario",
      encabezado: "Usuario / Titular",
      valor: (r) => `${r.usuarioNombre} ${r.usuarioCorreo}`,
      render: (r) => (
        <div>
          <strong style={{ display: "block", color: "#0F172A", fontSize: "0.85rem" }}>{r.usuarioNombre}</strong>
          <span style={{ fontSize: "0.75rem", color: "#64748B" }}>{r.usuarioCorreo}</span>
        </div>
      ),
    },
    {
      id: "negocio",
      encabezado: "Negocio",
      valor: (r) => r.negocio,
      render: (r) => (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "6px",
            background: "#F3E8FF",
            color: "#6B21A8",
            fontWeight: 800,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
          }}
        >
          {r.negocio}
        </span>
      ),
    },
    {
      id: "documento",
      encabezado: "Documento / Cláusula",
      valor: (r) => {
        const cat = CATEGORIAS_TERMINOS.find((c) => c.key === r.claveDocumento);
        return cat ? cat.nombre : r.claveDocumento;
      },
      render: (r) => {
        const cat = CATEGORIAS_TERMINOS.find((c) => c.key === r.claveDocumento);
        return (
          <div>
            <strong style={{ color: "#334155", fontSize: "0.82rem", display: "block" }}>
              {cat ? cat.nombre : r.claveDocumento}
            </strong>
            <code style={{ fontSize: "0.7rem", color: "#64748B" }}>clave: {r.claveDocumento}</code>
          </div>
        );
      },
    },
    {
      id: "version",
      encabezado: "Versión Aceptada",
      valor: (r) => r.version,
      render: (r) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            borderRadius: "6px",
            background: "#ECFDF5",
            color: "#065F46",
            fontWeight: 700,
            fontSize: "0.75rem",
          }}
        >
          <Tag size={12} /> {r.version}
        </span>
      ),
    },
    {
      id: "estado",
      encabezado: "Estado Acción",
      valor: (r) => r.estado,
      render: (r) => {
        const esAceptado = r.estado === "ACEPTADO";
        const esRechazado = r.estado === "RECHAZADO";
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "6px",
              background: esAceptado ? "#ECFDF5" : esRechazado ? "#FEF2F2" : "#FFFBEB",
              color: esAceptado ? "#047857" : esRechazado ? "#B91C1C" : "#B45309",
              fontWeight: 800,
              fontSize: "0.72rem",
            }}
          >
            {esAceptado ? <Check size={13} /> : <AlertCircle size={13} />}
            {r.estado}
          </span>
        );
      },
    },
    {
      id: "fecha",
      encabezado: "Fecha y Hora",
      valor: (r) => new Date(r.fechaAccion).getTime(),
      render: (r) => (
        <span style={{ fontSize: "0.78rem", color: "#475569" }}>
          {new Date(r.fechaAccion).toLocaleString("es-EC", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      ),
    },
    {
      id: "ip",
      encabezado: "IP / Red",
      valor: (r) => r.ip || "N/A",
      render: (r) => (
        <span style={{ fontSize: "0.75rem", color: "#64748B", fontFamily: "monospace" }}>
          {r.ip || "No registrada"}
        </span>
      ),
    },
  ];

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
      {/* Header Principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "var(--negro, #111111)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <ShieldCheck size={22} color="var(--violeta, #5000BA)" /> Consola Central de Términos, Cláusulas LOPDP & Consentimientos
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.83rem", color: "var(--panel-gris, #737373)" }}>
            Versionamiento inmutable, plantillas de contratos y bitácora de aceptación multi-negocio ({negocio.toUpperCase()}).
          </p>
        </div>

        {/* Pestañas Principales de Modo */}
        <div style={{ display: "flex", gap: "6px", background: "var(--panel-papel, #F7F6FA)", padding: "4px", borderRadius: "10px", border: "1px solid var(--panel-linea, #E4E4E4)" }}>
          <button
            type="button"
            onClick={() => setPestanaPrincipal("editor")}
            style={{
              background: pestanaPrincipal === "editor" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "0.78rem",
              fontWeight: pestanaPrincipal === "editor" ? 800 : 600,
              color: pestanaPrincipal === "editor" ? "var(--violeta, #5000BA)" : "#737373",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: pestanaPrincipal === "editor" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Edit3 size={14} /> Editor & Configuración
          </button>
          <button
            type="button"
            onClick={() => setPestanaPrincipal("historial")}
            style={{
              background: pestanaPrincipal === "historial" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "0.78rem",
              fontWeight: pestanaPrincipal === "historial" ? 800 : 600,
              color: pestanaPrincipal === "historial" ? "var(--violeta, #5000BA)" : "#737373",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: pestanaPrincipal === "historial" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <History size={14} /> Historial de Versiones
          </button>
          <button
            type="button"
            onClick={() => setPestanaPrincipal("auditoria")}
            style={{
              background: pestanaPrincipal === "auditoria" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "0.78rem",
              fontWeight: pestanaPrincipal === "auditoria" ? 800 : 600,
              color: pestanaPrincipal === "auditoria" ? "var(--esmeralda, #05876E)" : "#737373",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: pestanaPrincipal === "auditoria" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Users size={14} /> Bitácora de Consentimientos
          </button>
        </div>
      </div>

      {/* Mensaje de Estado / Feedback */}
      {mensaje && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: mensaje.tipo === "exito" ? "#ECFDF5" : "#FEF2F2",
            color: mensaje.tipo === "exito" ? "#065F46" : "#991B1B",
            border: `1px solid ${mensaje.tipo === "exito" ? "#A7F3D0" : "#FECACA"}`,
          }}
        >
          {mensaje.tipo === "exito" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {mensaje.texto}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODO 1: EDITOR & CONFIGURACIÓN DE TÉRMINOS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {pestanaPrincipal === "editor" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "20px", alignItems: "start" }}>
          {/* PANEL IZQUIERDO: SELECTOR DE DOCUMENTOS ERGONÓMICO */}
          <div
            style={{
              background: "#F8FAFC",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Documentos ({CATEGORIAS_TERMINOS.length})
              </span>
            </div>

            {/* Buscador Rápido de Documentos */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Buscar término o contrato..."
                value={busquedaDoc}
                onChange={(e) => setBusquedaDoc(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 30px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.8rem",
                  background: "#FFFFFF",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Filtro por Categoría */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              {(["todos", "terminos", "beneficios", "contratos"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFiltroTipo(t)}
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: filtroTipo === t ? "1px solid #5000BA" : "1px solid #E2E8F0",
                    background: filtroTipo === t ? "#5000BA" : "#FFFFFF",
                    color: filtroTipo === t ? "#FFFFFF" : "#64748B",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t === "todos" ? "Todos" : t === "terminos" ? "LOPDP & Términos" : t === "beneficios" ? "Beneficios" : "Contratos"}
                </button>
              ))}
            </div>

            {/* Lista Vertical de Tarjetas de Selección */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "560px", overflowY: "auto", paddingRight: "2px" }}>
              {categoriasVisibles.map((cat) => {
                const IconoCat = cat.icono;
                const esActivo = cat.key === catSeleccionada;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCatSeleccionada(cat.key)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "4px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: esActivo ? "1.5px solid #5000BA" : "1px solid #E2E8F0",
                      background: esActivo ? "#FFFFFF" : "#FFFFFF",
                      boxShadow: esActivo ? "0 2px 8px rgba(80,0,186,0.12)" : "0 1px 2px rgba(0,0,0,0.02)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            background: `${cat.color}15`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconoCat size={16} color={cat.color} />
                        </div>
                        <strong style={{ fontSize: "0.82rem", color: esActivo ? "#5000BA" : "#1E293B", fontWeight: 800 }}>
                          {cat.nombre}
                        </strong>
                      </div>
                      <ChevronRight size={14} color={esActivo ? "#5000BA" : "#CBD5E1"} />
                    </div>

                    <p style={{ margin: "2px 0 0 0", fontSize: "0.72rem", color: "#64748B", lineHeight: 1.3 }}>
                      {cat.descripcion}
                    </p>

                    <div style={{ display: "flex", gap: "6px", marginTop: "4px", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "#F1F5F9",
                          color: "#475569",
                        }}
                      >
                        {cat.defaultVersion}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: cat.tipo === "contratos" ? "#FEF3C7" : cat.tipo === "beneficios" ? "#ECFDF5" : "#EDE9FE",
                          color: cat.tipo === "contratos" ? "#92400E" : cat.tipo === "beneficios" ? "#065F46" : "#5B21B6",
                        }}
                      >
                        {cat.tipo}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PANEL DERECHO: FORMULARIO DEL EDITOR */}
          <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Cabecera del Documento Activo */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                background: "#FAF5FF",
                border: "1px solid #E9D5FF",
                padding: "12px 16px",
                borderRadius: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: `${catActualDef.color}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconoCatActual size={20} color={catActualDef.color} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#5000BA" }}>
                    {catActualDef.nombre}
                  </h4>
                  <span style={{ fontSize: "0.75rem", color: "#6B21A8" }}>{catActualDef.descripcion}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setVersion(catActualDef.defaultVersion);
                    setTituloDocumento(catActualDef.nombre);
                    setMarkdownText(catActualDef.defaultMarkdown);
                    setNotasCambio("Restaurado a valores estándar");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "0.75rem",
                    color: "#64748B",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={12} /> Restaurar Default
                </button>
              </div>
            </div>

            {/* Parámetros de Versión, Título y Vigencia */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.2fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Título del Documento
                </label>
                <input
                  type="text"
                  value={tituloDocumento}
                  onChange={(e) => setTituloDocumento(e.target.value)}
                  placeholder={catActualDef.nombre}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Código de Versión
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1.5.0"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    color: "#5000BA",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Fecha de Vigencia
                </label>
                <input
                  type="date"
                  value={fechaVigencia}
                  onChange={(e) => setFechaVigencia(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "20px" }}>
                <input
                  type="checkbox"
                  id="chk_obligatoria"
                  checked={requiereAceptacion}
                  onChange={(e) => setRequiereAceptacion(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#5000BA", cursor: "pointer" }}
                />
                <label htmlFor="chk_obligatoria" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1E293B", cursor: "pointer" }}>
                  Exigir Aceptación Obligatoria
                </label>
              </div>
            </div>

            {/* Notas del Cambio / Histórico */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Notas de la Versión (Razón del cambio para el historial inmutable)
              </label>
              <input
                type="text"
                value={notasCambio}
                onChange={(e) => setNotasCambio(e.target.value)}
                placeholder="Ej. Actualización de cláusula 2 por nueva disposición de la LOPDP / Actualización de honorarios"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Inserción de Variables Dinámicas */}
            <BarraVariablesDinamicas onInsertarVariable={insertarVariable} />

            {/* Conmutador Editor / Previsualización */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155" }}>
                Contenido del Documento en Markdown (.md)
              </span>

              <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "3px", borderRadius: "8px" }}>
                <button
                  type="button"
                  onClick={() => setModoVista("editor")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: modoVista === "editor" ? "#FFFFFF" : "transparent",
                    color: modoVista === "editor" ? "#5000BA" : "#64748B",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: modoVista === "editor" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <Edit3 size={13} /> Editor Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setModoVista("previsualizacion")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: modoVista === "previsualizacion" ? "#FFFFFF" : "transparent",
                    color: modoVista === "previsualizacion" ? "#5000BA" : "#64748B",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: modoVista === "previsualizacion" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <Eye size={13} /> Previsualizar
                </button>
              </div>
            </div>

            {/* Área de Texto o Previsualización */}
            {modoVista === "editor" ? (
              <textarea
                ref={textareaRef}
                value={markdownText}
                onChange={(e) => setMarkdownText(e.target.value)}
                rows={12}
                placeholder="Escribe el contenido legal en Markdown..."
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1.5px solid #CBD5E1",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            ) : (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: "8px",
                  padding: "20px",
                  minHeight: "260px",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)",
                }}
                dangerouslySetInnerHTML={{ __html: renderizarPrevisualizacion() }}
              />
            )}

            {/* Botón de Guardado y Publicación */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="submit"
                disabled={guardando || cargando}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--violeta, #5000BA)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: guardando ? "not-allowed" : "pointer",
                  opacity: guardando ? 0.7 : 1,
                  boxShadow: "0 2px 6px rgba(80,0,186,0.25)",
                }}
              >
                <Save size={16} /> {guardando ? "Publicando Versión..." : "Publicar y Guardar Versión"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODO 2: HISTORIAL DE VERSIONES DEL DOCUMENTO */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {pestanaPrincipal === "historial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
            }}
          >
            <div>
              <strong style={{ fontSize: "0.95rem", color: "#0F172A", display: "block" }}>
                Historial Inmutable de Versiones: {catActualDef.nombre}
              </strong>
              <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                Registro cronológico de todas las versiones publicadas en la base de datos para {negocio.toUpperCase()}.
              </span>
            </div>

            <button
              type="button"
              onClick={cargarHistorial}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={12} /> Refrescar
            </button>
          </div>

          {cargandoHistorial ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Cargando versiones archivadas...</div>
          ) : listaHistorial.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1" }}>
              <History size={32} color="#94A3B8" style={{ marginBottom: "8px" }} />
              <p style={{ margin: 0, fontWeight: 700, color: "#334155" }}>Aún no hay versiones archivadas en la base de datos</p>
              <p style={{ margin: "4px 0 12px 0", fontSize: "0.8rem", color: "#64748B" }}>
                Al guardar cambios en el editor, cada versión quedará registrada inmutablemente con su fecha y notas.
              </p>
              <button
                type="button"
                onClick={() => setPestanaPrincipal("editor")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  background: "#5000BA",
                  color: "#FFFFFF",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                Ir al Editor y Publicar Versión Actual
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "16px" }}>
              {/* Lista de Versiones */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "500px", overflowY: "auto" }}>
                {listaHistorial.map((hist, index) => {
                  const esSeleccionado = versionSeleccionadaHistorial?.id === hist.id;
                  return (
                    <div
                      key={hist.id}
                      onClick={() => setVersionSeleccionadaHistorial(hist)}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: esSeleccionado ? "1.5px solid #5000BA" : "1px solid #E2E8F0",
                        background: esSeleccionado ? "#FAF5FF" : "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, color: "#5000BA", fontSize: "0.88rem" }}>
                          {hist.version}
                        </span>
                        {index === 0 && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "#ECFDF5", color: "#065F46" }}>
                            🟢 Vigente
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: "0.78rem", color: "#334155", fontWeight: 600 }}>{hist.titulo}</span>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748B" }}>
                        {hist.notasCambio || "Sin notas de versión"}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.68rem", color: "#94A3B8", marginTop: "4px" }}>
                        <Clock size={11} /> {new Date(hist.creadoEn).toLocaleString("es-EC")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visor de Contenido de la Versión Seleccionada */}
              {versionSeleccionadaHistorial ? (
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F1F5F9", paddingBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "0.95rem", color: "#0F172A" }}>
                        Versión {versionSeleccionadaHistorial.version} · {versionSeleccionadaHistorial.titulo}
                      </strong>
                      <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                        Publicada: {new Date(versionSeleccionadaHistorial.creadoEn).toLocaleString("es-EC")} · Vigencia: {versionSeleccionadaHistorial.fechaVigencia}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => restaurarVersionHistorica(versionSeleccionadaHistorial)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "#05876E",
                        color: "#FFFFFF",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      <RefreshCw size={12} /> Cargar en Editor
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "12px",
                      background: "#F8FAFC",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      maxHeight: "360px",
                      overflowY: "auto",
                      fontSize: "0.85rem",
                    }}
                    dangerouslySetInnerHTML={{ __html: renderizarPrevisualizacion(versionSeleccionadaHistorial.contenidoMarkdown) }}
                  />
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Selecciona una versión para inspeccionar</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODO 3: BITÁCORA DE AUDITORÍA DE CONSENTIMIENTOS DE USUARIOS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {pestanaPrincipal === "auditoria" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Barra de Filtros de Auditoría */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              background: "#F8FAFC",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
            }}
          >
            <div>
              <strong style={{ fontSize: "0.95rem", color: "#0F172A", display: "block" }}>
                Bitácora de Aceptación y Rechazo de Consentimientos
              </strong>
              <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                Registro inmutable de aceptaciones por usuario, versión exacta, fecha, IP y dispositivo.
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={filtroNegocioAudit}
                onChange={(e) => setFiltroNegocioAudit(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.78rem",
                  background: "#FFFFFF",
                  fontWeight: 600,
                }}
              >
                <option value="todos">Todos los Negocios</option>
                <option value="TRANQ">Tranqi (TRANQ)</option>
                <option value="FASTF">FastFix Home (FASTF)</option>
                <option value="TINKA">Tinkay (TINKA)</option>
                <option value="MARGA">Margaritas (MARGA)</option>
              </select>

              <button
                type="button"
                onClick={cargarAuditoria}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={12} /> Refrescar
              </button>
            </div>
          </div>

          {/* Grid Estandarizado @eco/datagrid */}
          {cargandoConsentimientos ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
              Cargando bitácora de consentimientos...
            </div>
          ) : (
            <DataGrid
              columnas={COLUMNAS_AUDITORIA}
              filas={listaConsentimientos}
              idFila={(r) => r.id}
              nombreExportacion={`auditoria-consentimientos-${negocio}`}
              contenidoExpandible={(r) => (
                <div style={{ padding: "12px 16px", background: "#F8FAFC", borderRadius: "8px", fontSize: "0.78rem", border: "1px solid #E2E8F0" }}>
                  <p style={{ margin: "0 0 6px 0", fontWeight: 800, color: "#1E293B" }}>
                    🔍 Metadatos Técnicos del Consentimiento (ID: {r.id})
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px" }}>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>User Agent:</span>
                      <code style={{ fontSize: "0.72rem", color: "#334155" }}>{r.userAgent || "No disponible"}</code>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Hash Contenido Aceptado:</span>
                      <code style={{ fontSize: "0.72rem", color: "#334155" }}>{r.hashContenido || "sha256:default"}</code>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Usuario ID (auth.uid):</span>
                      <code style={{ fontSize: "0.72rem", color: "#334155" }}>{r.usuarioId}</code>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
