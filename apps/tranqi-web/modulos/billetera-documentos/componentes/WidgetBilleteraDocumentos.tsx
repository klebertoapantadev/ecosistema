"use client";

import React, { useState, useEffect } from "react";
import {
  Folder, Shield, Upload, Share2, Clock, CheckCircle2, AlertTriangle, XCircle,
  FileText, Search, Eye, Trash2, KeyRound, ExternalLink, Copy, Check, Sparkles,
  Lock, Flame, FileCheck, RefreshCw, Filter, Calendar, Tag, ChevronRight, User,
  Plus, X, Image as ImageIcon, Bell, BellRing, Info
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ArchivoAdjunto {
  id: string;
  nombre: string;
  tamano: number;
  mimetype: string;
  url?: string | null;
  base64?: string | null;
}

export interface DocumentoBilletera {
  doc_id: string;
  doc_titulo: string;
  doc_categoria: "identidad" | "vehicular" | "contratos" | "profesional" | "otros" | string;
  doc_tipo: string;
  doc_archivo_nombre: string;
  doc_archivo_tamano: number;
  doc_archivo_mimetype: string;
  doc_archivo_url?: string | null;
  doc_archivo_base64?: string | null;
  doc_archivos?: ArchivoAdjunto[];
  doc_entidad_emisora?: string | null;
  doc_numero_documento?: string | null;
  doc_fecha_emision?: string | null;
  doc_fecha_caducidad?: string | null;
  doc_fecha_nacimiento?: string | null;
  doc_alertar_caducidad?: boolean;
  doc_meses_anticipacion_alerta?: number;
  doc_titular_nombre?: string | null;
  doc_titular_identificacion?: string | null;
  doc_metadatos_ocr?: Record<string, any>;
  doc_creado_en: string;
  estado_calculado?: "vigente" | "por_vencer" | "vencido" | "sin_caducidad";
  dias_para_vencer?: number | null;
}

export interface EnlaceTTL {
  ttl_id: string;
  ttl_token: string;
  ttl_modo_expiracion: string;
  ttl_expira_en: string;
  ttl_una_sola_vista: boolean;
  ttl_visitas_conteo: number;
  ttl_activo: boolean;
  requiere_pin: boolean;
  esta_vigente: boolean;
  esta_expirado: boolean;
  enlace_url: string;
}

const CATEGORIAS_CONFIG: Record<string, { label: string; icono: string; color: string; desc: string }> = {
  todas: { label: "Todos los Documentos", icono: "📁", color: "#5000BA", desc: "Bóveda completa de documentos personales y profesionales" },
  identidad: { label: "Identidad & Personal", icono: "🪪", color: "#2563EB", desc: "Cédulas, licencias de conducir, pasaportes y votación" },
  vehicular: { label: "Vehicular & Seguros", icono: "🚗", color: "#05876E", desc: "Matrículas vehiculares, SOAT y pólizas de auto" },
  contratos: { label: "Contratos & Servicios", icono: "📜", color: "#D97706", desc: "Arrendamientos, servicios residenciales y seguros médicos" },
  profesional: { label: "Profesional & RUC", icono: "🎓", color: "#7C3AED", desc: "Títulos universitarios, Foro de Abogados, RUC y nombramientos" },
  otros: { label: "Otros Documentos", icono: "📎", color: "#6B7280", desc: "Garantías, certificaciones y comprobantes varios" }
};

const OPCIONES_ANTICIPACION_ALERTA = [
  { meses: 1, label: "1 mes antes (30 días)" },
  { meses: 2, label: "2 meses antes (60 días)" },
  { meses: 3, label: "3 meses antes (Recomendado - 90 días)" },
  { meses: 6, label: "6 meses antes (180 días)" },
  { meses: 12, label: "1 año antes (365 días)" }
];

interface Props {
  negocio?: string;
  onCerrar?: () => void;
}

export function WidgetBilleteraDocumentos({ negocio = "TRANQ", onCerrar }: Props) {
  const router = useRouter();
  const [documentos, setDocumentos] = useState<DocumentoBilletera[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [categoriaActiva, setCategoriaActiva] = useState<string>("todas");
  const [filtroVigencia, setFiltroVigencia] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");

  // Modales
  const [modalSubirAbierto, setModalSubirAbierto] = useState<boolean>(false);
  const [docParaCompartir, setDocParaCompartir] = useState<DocumentoBilletera | null>(null);
  const [docParaVer, setDocParaVer] = useState<DocumentoBilletera | null>(null);
  const [indiceArchivoVer, setIndiceArchivoVer] = useState<number>(0);
  const [docParaEliminar, setDocParaEliminar] = useState<DocumentoBilletera | null>(null);

  // Estados de Formulario de Subida Multi-Archivo & Aria IA
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<Array<{
    id: string;
    nombre: string;
    tamano: number;
    mimetype: string;
    base64: string;
  }>>([]);
  const [nuevoTitulo, setNuevoTitulo] = useState<string>("");
  const [nuevaCategoria, setNuevaCategoria] = useState<string>("identidad");
  const [nuevoTipo, setNuevoTipo] = useState<string>("cedula");
  const [nuevoTitular, setNuevoTitular] = useState<string>("");
  const [nuevaIdentificacion, setNuevaIdentificacion] = useState<string>("");
  const [nuevaFechaNacimiento, setNuevaFechaNacimiento] = useState<string>("");
  const [nuevoEmisor, setNuevoEmisor] = useState<string>("");
  const [nuevoNumeroDoc, setNuevoNumeroDoc] = useState<string>("");
  const [nuevaFechaEmision, setNuevaFechaEmision] = useState<string>("");
  const [nuevaFechaCaducidad, setNuevaFechaCaducidad] = useState<string>("");
  const [alertarCaducidad, setAlertarCaducidad] = useState<boolean>(true);
  const [mesesAnticipacionAlerta, setMesesAnticipacionAlerta] = useState<number>(3);
  
  const [analizandoConAria, setAnalizandoConAria] = useState<boolean>(false);
  const [resumenAria, setResumenAria] = useState<string | null>(null);
  const [guardandoDoc, setGuardandoDoc] = useState<boolean>(false);

  // Estados de Compartir TTL
  const [modoTtl, setModoTtl] = useState<string>("24h");
  const [pinTtl, setPinTtl] = useState<string>("");
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [generandoTtl, setGenerandoTtl] = useState<boolean>(false);
  const [copiado, setCopiado] = useState<boolean>(false);
  const [listaEnlacesActivos, setListaEnlacesActivos] = useState<EnlaceTTL[]>([]);

  // Notificación toast
  const [toastMensaje, setToastMensaje] = useState<{ tipo: "exito" | "error" | "info"; texto: string } | null>(null);

  const mostrarToast = (texto: string, tipo: "exito" | "error" | "info" = "exito") => {
    setToastMensaje({ texto, tipo });
    setTimeout(() => setToastMensaje(null), 4000);
  };

  const cargarDocumentos = async () => {
    try {
      setCargando(true);
      const res = await fetch("/api/billetera/documentos");
      const json = await res.json();
      if (json.ok) {
        setDocumentos(json.data || []);
      }
    } catch (e) {
      console.error("Error al cargar billetera:", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDocumentos();
  }, []);

  // Función para ejecutar el análisis inteligente con el agente Aria
  const ejecutarAnalisisAria = async (archivosAnalizar = archivosSeleccionados) => {
    if (archivosAnalizar.length === 0) return;

    try {
      setAnalizandoConAria(true);
      setResumenAria(null);

      const res = await fetch("/api/billetera/aria-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivos: archivosAnalizar.map(a => ({
            nombre: a.nombre,
            tamano: a.tamano,
            mimetype: a.mimetype,
            base64: a.base64
          })),
          nombreContexto: nuevoTitulo
        })
      });

      const json = await res.json();
      if (json.ok && json.analisis) {
        const a = json.analisis;
        if (a.tituloSugerido && !nuevoTitulo) setNuevoTitulo(a.tituloSugerido);
        if (a.categoriaSugerida) setNuevaCategoria(a.categoriaSugerida);
        if (a.tipoSugerido) setNuevoTipo(a.tipoSugerido);
        if (a.titularNombre && !nuevoTitular) setNuevoTitular(a.titularNombre);
        if (a.titularIdentificacion && !nuevaIdentificacion) setNuevaIdentificacion(a.titularIdentificacion);
        if (a.fechaNacimiento && !nuevaFechaNacimiento) setNuevaFechaNacimiento(a.fechaNacimiento);
        if (a.entidadEmisora && !nuevoEmisor) setNuevoEmisor(a.entidadEmisora);
        if (a.numeroDocumento && !nuevoNumeroDoc) setNuevoNumeroDoc(a.numeroDocumento);
        if (a.fechaEmision && !nuevaFechaEmision) setNuevaFechaEmision(a.fechaEmision);
        if (a.fechaCaducidad && !nuevaFechaCaducidad) setNuevaFechaCaducidad(a.fechaCaducidad);

        setResumenAria(a.resumenOcr || "✨ Análisis de Aria completado. Metadatos listos.");
        mostrarToast("✨ Aria analizó los documentos y autocompletó los metadatos.", "info");
      }
    } catch (err) {
      console.warn("Aviso en análisis Aria:", err);
    } finally {
      setAnalizandoConAria(false);
    }
  };

  // Manejo de carga multi-archivo (Imágenes y PDF únicamente)
  const handleSeleccionarArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const FORMATOS_VALIDOS = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

    const archivosNuevos: Array<{
      id: string;
      nombre: string;
      tamano: number;
      mimetype: string;
      base64: string;
    }> = [];

    let rechazados = 0;
    let procesados = 0;

    files.forEach((file, index) => {
      const mime = (file.type || "").toLowerCase();
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const esValido = FORMATOS_VALIDOS.includes(mime) || ["png", "jpg", "jpeg", "webp", "pdf"].includes(ext);

      if (!esValido) {
        rechazados++;
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        mostrarToast(`'${file.name}' excede el límite de 25MB`, "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        archivosNuevos.push({
          id: `file-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          nombre: file.name,
          tamano: file.size,
          mimetype: file.type || "application/pdf",
          base64
        });

        procesados++;
        if (procesados === files.length - rechazados) {
          const listaActualizada = [...archivosSeleccionados, ...archivosNuevos];
          setArchivosSeleccionados(listaActualizada);

          // Si es el primer archivo y no hay título, sugerir título base
          if (!nuevoTitulo && archivosNuevos[0]) {
            const nombreLimpio = archivosNuevos[0].nombre.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            setNuevoTitulo(nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1));
          }

          // Ejecutar Aria para los archivos combinados
          ejecutarAnalisisAria(listaActualizada);
        }
      };
      reader.readAsDataURL(file);
    });

    if (rechazados > 0) {
      mostrarToast(`${rechazados} archivo(s) no soportados. Únicamente se aceptan imágenes (PNG, JPG, WebP) o PDFs.`, "error");
    }
  };

  const eliminarArchivoDeLista = (idArchivo: string) => {
    const filtrados = archivosSeleccionados.filter(a => a.id !== idArchivo);
    setArchivosSeleccionados(filtrados);
    if (filtrados.length > 0) {
      ejecutarAnalisisAria(filtrados);
    } else {
      setResumenAria(null);
    }
  };

  const guardarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (archivosSeleccionados.length === 0) {
      mostrarToast("Por favor adjunta al menos un archivo (PDF o Imagen)", "error");
      return;
    }

    try {
      setGuardandoDoc(true);
      const tituloFinal = nuevoTitulo.trim() || archivosSeleccionados[0]?.nombre.replace(/\.[^/.]+$/, "") || "Documento Seguro";

      const payload = {
        titulo: tituloFinal,
        categoria: nuevaCategoria,
        tipo: nuevoTipo,
        archivos: archivosSeleccionados.map(a => ({
          id: a.id,
          nombre: a.nombre,
          tamano: a.tamano,
          mimetype: a.mimetype,
          base64: a.base64
        })),
        archivoNombre: archivosSeleccionados[0]?.nombre,
        archivoTamano: archivosSeleccionados[0]?.tamano,
        archivoMimetype: archivosSeleccionados[0]?.mimetype,
        archivoBase64: archivosSeleccionados[0]?.base64,
        entidadEmisora: nuevoEmisor.trim() || null,
        numeroDocumento: nuevoNumeroDoc.trim() || null,
        fechaEmision: nuevaFechaEmision || null,
        fechaCaducidad: nuevaFechaCaducidad || null,
        fechaNacimiento: nuevaFechaNacimiento || null,
        alertarCaducidad: alertarCaducidad,
        mesesAnticipacionAlerta: mesesAnticipacionAlerta,
        titularNombre: nuevoTitular.trim() || null,
        titularIdentificacion: nuevaIdentificacion.trim() || null,
        metadatosOcr: {
          analizado_por: "Aria IA",
          total_archivos: archivosSeleccionados.length,
          analizado_en: new Date().toISOString()
        }
      };

      const res = await fetch("/api/billetera/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.ok) {
        mostrarToast("✅ Documento y sus partes resguardados exitosamente.");
        setModalSubirAbierto(false);
        limpiarFormularioSubida();
        cargarDocumentos();
      } else {
        mostrarToast(json.error || "Error al guardar documento", "error");
      }
    } catch (e: any) {
      mostrarToast(e.message || "Error de red", "error");
    } finally {
      setGuardandoDoc(false);
    }
  };

  const limpiarFormularioSubida = () => {
    setArchivosSeleccionados([]);
    setNuevoTitulo("");
    setNuevaCategoria("identidad");
    setNuevoTipo("cedula");
    setNuevoTitular("");
    setNuevaIdentificacion("");
    setNuevaFechaNacimiento("");
    setNuevoEmisor("");
    setNuevoNumeroDoc("");
    setNuevaFechaEmision("");
    setNuevaFechaCaducidad("");
    setAlertarCaducidad(true);
    setMesesAnticipacionAlerta(3);
    setResumenAria(null);
  };

  const abrirCompartir = async (doc: DocumentoBilletera) => {
    setDocParaCompartir(doc);
    setModoTtl("24h");
    setPinTtl("");
    setEnlaceGenerado(null);
    setCopiado(false);

    try {
      const res = await fetch(`/api/billetera/compartir?doc_id=${doc.doc_id}`);
      const json = await res.json();
      if (json.ok) {
        setListaEnlacesActivos(json.data || []);
      }
    } catch {
      setListaEnlacesActivos([]);
    }
  };

  const generarEnlaceTtl = async () => {
    if (!docParaCompartir) return;

    try {
      setGenerandoTtl(true);
      const res = await fetch("/api/billetera/compartir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentoId: docParaCompartir.doc_id,
          modoExpiracion: modoTtl,
          pin: pinTtl || null,
          unaSolaVista: modoTtl === "una_vista"
        })
      });
      const json = await res.json();

      if (json.ok && json.data) {
        setEnlaceGenerado(json.data.enlaceCompleto);
        mostrarToast("🔗 Enlace efímero generado.");
        abrirCompartir(docParaCompartir);
      } else {
        mostrarToast(json.error || "Error al generar enlace", "error");
      }
    } catch (e: any) {
      mostrarToast(e.message || "Error de red", "error");
    } finally {
      setGenerandoTtl(false);
    }
  };

  const copiarEnlace = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiado(true);
    mostrarToast("📋 Enlace copiado al portapapeles");
    setTimeout(() => setCopiado(false), 2500);
  };

  const revocarEnlace = async (token: string) => {
    try {
      const res = await fetch(`/api/billetera/compartir?token=${token}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        mostrarToast("🗑️ Enlace revocado.");
        if (docParaCompartir) abrirCompartir(docParaCompartir);
      }
    } catch (e: any) {
      mostrarToast("Error al revocar enlace", "error");
    }
  };

  const confirmarEliminar = async () => {
    if (!docParaEliminar) return;

    try {
      const res = await fetch(`/api/billetera/documentos?id=${docParaEliminar.doc_id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        mostrarToast("🗑️ Documento eliminado de la billetera.");
        setDocParaEliminar(null);
        cargarDocumentos();
      } else {
        mostrarToast(json.error || "Error al eliminar", "error");
      }
    } catch (e: any) {
      mostrarToast(e.message || "Error de red", "error");
    }
  };

  const abrirVisor = (doc: DocumentoBilletera) => {
    setDocParaVer(doc);
    setIndiceArchivoVer(0);
  };

  // Filtrado reactivo de documentos
  const documentosFiltrados = documentos.filter((d) => {
    if (categoriaActiva !== "todas" && d.doc_categoria !== categoriaActiva) return false;
    if (filtroVigencia !== "todos" && d.estado_calculado !== filtroVigencia) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      const matchTitulo = (d.doc_titulo || "").toLowerCase().includes(q);
      const matchTitular = (d.doc_titular_nombre || "").toLowerCase().includes(q);
      const matchId = (d.doc_titular_identificacion || "").toLowerCase().includes(q);
      const matchEmisor = (d.doc_entidad_emisora || "").toLowerCase().includes(q);
      const matchArchivo = (d.doc_archivo_nombre || "").toLowerCase().includes(q);
      if (!matchTitulo && !matchTitular && !matchId && !matchEmisor && !matchArchivo) return false;
    }
    return true;
  });

  const conteoPorCategoria = documentos.reduce((acc, d) => {
    acc[d.doc_categoria] = (acc[d.doc_categoria] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "16px 8px" }}>
      {/* TOAST FLOTANTE */}
      {toastMensaje && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: toastMensaje.tipo === "exito" ? "#05876E" : toastMensaje.tipo === "error" ? "#DC2626" : "#5000BA",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "12px",
            fontSize: "0.86rem",
            fontWeight: 700,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease"
          }}
        >
          <span>{toastMensaje.texto}</span>
        </div>
      )}

      {/* HEADER HERO */}
      <section
        style={{
          background: "linear-gradient(135deg, #2A085C 0%, #5000BA 100%)",
          color: "#ffffff",
          borderRadius: "20px",
          padding: "24px 28px",
          marginBottom: "24px",
          boxShadow: "0 10px 30px rgba(80, 0, 186, 0.2)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", position: "relative", zIndex: 2 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 800, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <Shield size={13} /> Bóveda Digital Cifrada • Agente Aria IA
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0 0 8px 0", letterSpacing: "-0.5px" }}>
              Billetera Digital de Documentos Seguros
            </h1>
            <p style={{ fontSize: "0.88rem", opacity: 0.9, margin: 0, maxWidth: "680px", lineHeight: 1.45 }}>
              Custodia tus cédulas (anverso y reverso), matrículas, contratos, certificados y títulos. Extracción inteligente de metadatos con <strong>Aria IA</strong>, alertas automáticas de caducidad (3 meses) y enlaces efímeros protegidos (TTL).
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setModalSubirAbierto(true)}
              style={{
                background: "#05876E",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                padding: "12px 20px",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(5, 135, 110, 0.4)",
                transition: "transform 0.15s ease"
              }}
            >
              <Upload size={17} /> Subir Documento (Multi-Archivo)
            </button>

            {onCerrar && (
              <button
                type="button"
                onClick={onCerrar}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  width: "42px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
                title="Cerrar módulo"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* PESTAÑAS DE CATEGORÍAS */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "18px" }}>
        {Object.entries(CATEGORIAS_CONFIG).map(([key, cfg]) => {
          const esActiva = categoriaActiva === key;
          const conteo = key === "todas" ? documentos.length : (conteoPorCategoria[key] || 0);

          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategoriaActiva(key)}
              style={{
                background: esActiva ? "#5000BA" : "#ffffff",
                color: esActiva ? "#ffffff" : "#374151",
                border: esActiva ? "1px solid #5000BA" : "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "10px 16px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                boxShadow: esActiva ? "0 4px 12px rgba(80, 0, 186, 0.25)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <span>{cfg.icono}</span>
              <span>{cfg.label}</span>
              <span
                style={{
                  background: esActiva ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  color: esActiva ? "#ffffff" : "#6B7280",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: "999px"
                }}
              >
                {conteo}
              </span>
            </button>
          );
        })}
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO DE VIGENCIA */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #E5E7EB",
          padding: "14px 18px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div style={{ position: "relative", flex: "1 1 280px" }}>
          <Search size={16} color="#9CA3AF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, titular, cédula o entidad emisora..."
            style={{
              width: "100%",
              padding: "10px 14px 10px 38px",
              borderRadius: "10px",
              border: "1px solid #D1D5DB",
              fontSize: "0.85rem"
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={filtroVigencia}
            onChange={(e) => setFiltroVigencia(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #D1D5DB",
              fontSize: "0.82rem",
              fontWeight: 700,
              background: "#ffffff"
            }}
          >
            <option value="todos">Todos los Estados</option>
            <option value="vigente">🟢 Solo Vigentes</option>
            <option value="por_vencer">🟡 Por Vencer (Alerta Activa)</option>
            <option value="vencido">🔴 Caducados</option>
          </select>

          <button
            type="button"
            onClick={cargarDocumentos}
            style={{
              background: "#F3F4F6",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
            title="Refrescar lista"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* LISTA GRID DE DOCUMENTOS */}
      {cargando ? (
        <div style={{ padding: "50px", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1px solid #E5E7EB" }}>
          <RefreshCw size={28} className="anim-girar" color="#5000BA" style={{ marginBottom: "10px" }} />
          <p style={{ fontSize: "0.9rem", color: "#6B7280", margin: 0 }}>Cargando documentos de la bóveda segura...</p>
        </div>
      ) : documentosFiltrados.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1.5px dashed #D1D5DB" }}>
          <Folder size={44} color="#9CA3AF" style={{ marginBottom: "12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1F2937", margin: "0 0 6px 0" }}>
            No hay documentos en esta categoría
          </h3>
          <p style={{ fontSize: "0.86rem", color: "#6B7280", margin: "0 0 16px 0", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
            Guarda tus cédulas (anverso y reverso), contratos, matrículas o títulos para mantenerlos protegidos y generar enlaces temporales con PIN.
          </p>
          <button
            type="button"
            onClick={() => setModalSubirAbierto(true)}
            style={{
              background: "#5000BA",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "0.86rem",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Subir Documento
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {documentosFiltrados.map((doc) => {
            const catConfig = CATEGORIAS_CONFIG[doc.doc_categoria] || CATEGORIAS_CONFIG["otros"] || {
              label: "Otros", icono: "📎", color: "#6B7280", desc: ""
            };
            const listaAdjuntos = doc.doc_archivos || (doc.doc_archivo_nombre ? [{
              id: "p1",
              nombre: doc.doc_archivo_nombre,
              tamano: doc.doc_archivo_tamano || 0,
              mimetype: doc.doc_archivo_mimetype || "application/pdf"
            }] : []);

            const totalPartes = listaAdjuntos.length;
            const mesesAlerta = doc.doc_meses_anticipacion_alerta ?? 3;

            return (
              <div
                key={doc.doc_id}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #E5E7EB",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
                }}
              >
                <div>
                  {/* CABECERA TARJETA */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "1.3rem" }}>{catConfig.icono}</span>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            color: catConfig.color,
                            background: `${catConfig.color}15`,
                            padding: "2px 8px",
                            borderRadius: "6px"
                          }}
                        >
                          {doc.doc_tipo.replace(/_/g, " ")}
                        </span>
                        {totalPartes > 1 && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              color: "#5000BA",
                              background: "#F3E8FF",
                              padding: "2px 8px",
                              borderRadius: "6px"
                            }}
                          >
                            🗂️ {totalPartes} partes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SEMÁFORO DE CADUCIDAD */}
                    {doc.estado_calculado === "vigente" && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#05876E", background: "#ECFDF5", padding: "3px 8px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={12} /> Vigente
                      </span>
                    )}
                    {doc.estado_calculado === "por_vencer" && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "3px 8px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "4px" }} title={`Alerta activa a ${mesesAlerta} meses de caducidad`}>
                        <AlertTriangle size={12} /> Vence en {doc.dias_para_vencer}d
                      </span>
                    )}
                    {doc.estado_calculado === "vencido" && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "3px 8px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <XCircle size={12} /> Caducado
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#111827", margin: "0 0 6px 0", lineHeight: 1.3 }}>
                    {doc.doc_titulo}
                  </h3>

                  {/* METADATOS EXTRACTOS */}
                  <div style={{ fontSize: "0.78rem", color: "#4B5563", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }}>
                    {doc.doc_titular_nombre && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={13} color="#6B7280" />
                        <span>Titular: <strong>{doc.doc_titular_nombre}</strong></span>
                      </div>
                    )}
                    {doc.doc_titular_identificacion && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Tag size={13} color="#6B7280" />
                        <span>Cédula/RUC: <code>{doc.doc_titular_identificacion}</code></span>
                      </div>
                    )}
                    {doc.doc_entidad_emisora && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Shield size={13} color="#6B7280" />
                        <span>Emisor: {doc.doc_entidad_emisora}</span>
                      </div>
                    )}
                    {doc.doc_fecha_caducidad && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Calendar size={13} color="#6B7280" />
                        <span>Caduca: {new Date(doc.doc_fecha_caducidad).toLocaleDateString()}</span>
                        {doc.doc_alertar_caducidad !== false && (
                          <span style={{ fontSize: "0.68rem", color: "#5000BA", background: "#F3E8FF", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                            🔔 {mesesAlerta}m
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => abrirVisor(doc)}
                      style={{
                        background: "#F3F4F6",
                        color: "#1F2937",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 12px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Ver archivos y metadatos"
                    >
                      <Eye size={13} /> Ver ({totalPartes})
                    </button>

                    <button
                      type="button"
                      onClick={() => abrirCompartir(doc)}
                      style={{
                        background: "#EEF2FF",
                        color: "#4F46E5",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 12px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Compartir mediante enlace efímero con tiempo de expiración"
                    >
                      <Share2 size={13} /> Compartir TTL
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDocParaEliminar(doc)}
                    style={{
                      background: "transparent",
                      color: "#9CA3AF",
                      border: "none",
                      padding: "6px",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                    title="Eliminar documento"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SUBIR NUEVO DOCUMENTO (MULTI-ARCHIVO CON AGENTE ARIA)            */}
      {/* ========================================================================= */}
      {modalSubirAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Upload size={20} color="#5000BA" /> Resguardar Documento en Billetera
                </h2>
                <p style={{ fontSize: "0.8rem", color: "#6B7280", margin: 0 }}>
                  Formatos PDF o Imágenes (PNG, JPG, WebP). Puedes adjuntar varias partes (ej. anverso y reverso).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSubirAbierto(false)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarDocumento}>
              {/* ZONA DE CARGA MULTI-ARCHIVO */}
              <div
                style={{
                  border: "2px dashed #DDD6FE",
                  borderRadius: "14px",
                  padding: "18px",
                  textAlign: "center",
                  background: "#FAF5FF",
                  marginBottom: "14px",
                  position: "relative"
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleSeleccionarArchivos}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    zIndex: 2
                  }}
                />
                <div>
                  <Upload size={32} color="#7C3AED" style={{ margin: "0 auto 6px auto" }} />
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#4C1D95" }}>
                    Haz clic o arrastra 1 o más archivos aquí
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#6B7280" }}>
                    Imágenes (PNG, JPG, WebP) o PDFs (hasta 25MB c/u). Ej. Anverso + Reverso de Cédula.
                  </div>
                </div>
              </div>

              {/* LISTA DE ARCHIVOS ADJUNTOS */}
              {archivosSeleccionados.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#374151" }}>
                      📁 Archivos Adjuntos ({archivosSeleccionados.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => ejecutarAnalisisAria()}
                      disabled={analizandoConAria}
                      style={{
                        background: "#F3E8FF",
                        color: "#5000BA",
                        border: "1px solid #DDD6FE",
                        borderRadius: "8px",
                        padding: "4px 10px",
                        fontSize: "0.74rem",
                        fontWeight: 800,
                        cursor: analizandoConAria ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Sparkles size={13} className={analizandoConAria ? "anim-girar" : ""} />
                      {analizandoConAria ? "Aria Analizando..." : "✨ Re-analizar con Aria (IA)"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                    {archivosSeleccionados.map((arch, idx) => {
                      const esImg = arch.mimetype.includes("image");
                      return (
                        <div
                          key={arch.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            fontSize: "0.78rem"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                            {esImg ? <ImageIcon size={15} color="#2563EB" /> : <FileText size={15} color="#DC2626" />}
                            <span style={{ fontWeight: 700, color: "#1F2937", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "340px" }}>
                              Parte {idx + 1}: {arch.nombre}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "#6B7280" }}>
                              ({(arch.tamano / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => eliminarArchivoDeLista(arch.id)}
                            style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer", padding: "2px" }}
                            title="Quitar este archivo"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BANNER INFORMATIVO DE ARIA IA */}
              {resumenAria && (
                <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "10px 14px", borderRadius: "10px", marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.78rem", color: "#5000BA" }}>
                  <Sparkles size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong>Agente Aria IA:</strong> {resumenAria}
                    <div style={{ fontSize: "0.72rem", color: "#6B7280", marginTop: "2px" }}>
                      Los campos fueron completados de manera asistida. Puedes modificarlos libremente (ningún dato es obligatorio).
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS RECONOCIDOS & EDITABLES */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Título del Documento
                  </label>
                  <input
                    type="text"
                    value={nuevoTitulo}
                    onChange={(e) => setNuevoTitulo(e.target.value)}
                    placeholder="Ej. Cédula de Identidad y Votación"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Categoría
                  </label>
                  <select
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  >
                    <option value="identidad">🪪 Identidad & Personal</option>
                    <option value="vehicular">🚗 Vehicular & Seguros</option>
                    <option value="contratos">📜 Contratos & Servicios</option>
                    <option value="profesional">🎓 Profesional & RUC</option>
                    <option value="otros">📎 Otros Documentos</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Nombre del Titular
                  </label>
                  <input
                    type="text"
                    value={nuevoTitular}
                    onChange={(e) => setNuevoTitular(e.target.value)}
                    placeholder="Nombres y Apellidos"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Cédula / RUC / Pasaporte
                  </label>
                  <input
                    type="text"
                    value={nuevaIdentificacion}
                    onChange={(e) => setNuevaIdentificacion(e.target.value)}
                    placeholder="1715000000"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Entidad Emisora
                  </label>
                  <input
                    type="text"
                    value={nuevoEmisor}
                    onChange={(e) => setNuevoEmisor(e.target.value)}
                    placeholder="Ej. Registro Civil, ANT, SRI, Notaría"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Número / Matrícula
                  </label>
                  <input
                    type="text"
                    value={nuevoNumeroDoc}
                    onChange={(e) => setNuevoNumeroDoc(e.target.value)}
                    placeholder="Ej. MAT-2026-99"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={nuevaFechaEmision}
                    onChange={(e) => setNuevaFechaEmision(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Fecha de Nacimiento (Opcional)
                  </label>
                  <input
                    type="date"
                    value={nuevaFechaNacimiento}
                    onChange={(e) => setNuevaFechaNacimiento(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              {/* SECCIÓN DE ALERTAS DE CADUCIDAD CONFIGURABLE */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: alertarCaducidad ? "12px" : "0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 800, color: "#1E293B", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={alertarCaducidad}
                      onChange={(e) => setAlertarCaducidad(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#5000BA" }}
                    />
                    <BellRing size={16} color="#5000BA" /> Alertar Caducidad de este Documento
                  </label>
                  <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                    Notificaciones en campana y correo
                  </span>
                </div>

                {alertarCaducidad && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", paddingTop: "8px", borderTop: "1px solid #E2E8F0" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#DC2626", marginBottom: "4px" }}>
                        Fecha de Caducidad / Expiración
                      </label>
                      <input
                        type="date"
                        value={nuevaFechaCaducidad}
                        onChange={(e) => setNuevaFechaCaducidad(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #FCA5A5", fontSize: "0.85rem", background: "#FFF" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Anticipación de Alerta
                      </label>
                      <select
                        value={mesesAnticipacionAlerta}
                        onChange={(e) => setMesesAnticipacionAlerta(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem", background: "#FFF", fontWeight: 700 }}
                      >
                        {OPCIONES_ANTICIPACION_ALERTA.map((op) => (
                          <option key={op.meses} value={op.meses}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTONES ACCIÓN */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setModalSubirAbierto(false)}
                  style={{ background: "#F3F4F6", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoDoc || archivosSeleccionados.length === 0}
                  style={{
                    background: "#5000BA",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 22px",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: guardandoDoc || archivosSeleccionados.length === 0 ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(80, 0, 186, 0.3)"
                  }}
                >
                  {guardandoDoc ? "Resguardando..." : `Guardar en Billetera (${archivosSeleccionados.length} archivo${archivosSeleccionados.length === 1 ? "" : "s"})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COMPARTIR MEDIANTE ENLACES EFÍMEROS (TTL)                        */}
      {/* ========================================================================= */}
      {docParaCompartir && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "580px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "#EEF2FF", padding: "10px", borderRadius: "12px" }}>
                  <Share2 size={22} color="#4F46E5" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                    Compartir Enlace Efímero (TTL)
                  </h2>
                  <p style={{ fontSize: "0.82rem", color: "#6B7280", margin: 0 }}>
                    {docParaCompartir.doc_titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDocParaCompartir(null)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* GENERADOR DE ENLACE */}
            <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "18px", border: "1px solid #E2E8F0", marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                ⏱️ Tiempo de Expiración (TTL)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
                {[
                  { id: "1h", label: "1 Hora" },
                  { id: "3h", label: "3 Horas" },
                  { id: "6h", label: "6 Horas" },
                  { id: "24h", label: "24 Horas" },
                  { id: "7d", label: "7 Días" },
                  { id: "una_vista", label: "🔥 1 Sola Vista" }
                ].map(op => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setModoTtl(op.id)}
                    style={{
                      background: modoTtl === op.id ? "#4F46E5" : "#ffffff",
                      color: modoTtl === op.id ? "#ffffff" : "#334155",
                      border: modoTtl === op.id ? "1px solid #4F46E5" : "1px solid #CBD5E1",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              {modoTtl === "una_vista" && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "8px 12px", borderRadius: "8px", fontSize: "0.76rem", color: "#991B1B", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Flame size={16} /> <strong>Modo Burn-on-Read:</strong> El enlace se destruirá y revocará de inmediato tras la 1ra apertura.
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  🔒 PIN de Seguridad (Opcional, 4 dígitos)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pinTtl}
                  onChange={(e) => setPinTtl(e.target.value)}
                  placeholder="Ej. 1234"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem", letterSpacing: "2px" }}
                />
              </div>

              <button
                type="button"
                onClick={generarEnlaceTtl}
                disabled={generandoTtl}
                style={{
                  width: "100%",
                  background: "#4F46E5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px",
                  fontSize: "0.86rem",
                  fontWeight: 800,
                  cursor: generandoTtl ? "not-allowed" : "pointer"
                }}
              >
                {generandoTtl ? "Generando..." : "Generar Enlace Seguro"}
              </button>
            </div>

            {enlaceGenerado && (
              <div style={{ background: "#ECFDF5", border: "1.5px solid #A7F3D0", borderRadius: "14px", padding: "16px", marginBottom: "18px" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#065F46", marginBottom: "6px" }}>
                  ✅ Enlace Efímero Generado:
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    readOnly
                    value={enlaceGenerado}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1px solid #6EE7B7", fontSize: "0.78rem", background: "#ffffff" }}
                  />
                  <button
                    type="button"
                    onClick={() => copiarEnlace(enlaceGenerado)}
                    style={{ background: "#05876E", color: "#ffffff", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "0.78rem", fontWeight: 800, cursor: "pointer" }}
                  >
                    {copiado ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* HISTORIAL DE ENLACES ACTIVOS */}
            <div>
              <h4 style={{ fontSize: "0.84rem", fontWeight: 800, color: "#374151", margin: "0 0 8px 0" }}>
                Enlaces Generados para este Documento
              </h4>
              {listaEnlacesActivos.length === 0 ? (
                <div style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>No hay enlaces activos en este momento.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {listaEnlacesActivos.map((enl) => (
                    <div
                      key={enl.ttl_id}
                      style={{
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.78rem"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: enl.esta_vigente ? "#111827" : "#9CA3AF" }}>
                          Modo: {enl.ttl_modo_expiracion} {enl.ttl_una_sola_vista && "🔥 (1 vista)"} {enl.requiere_pin && "🔒 (PIN)"}
                        </div>
                        <div style={{ color: "#6B7280", fontSize: "0.72rem" }}>
                          {enl.esta_vigente ? `Expira: ${new Date(enl.ttl_expira_en).toLocaleString()}` : "Inactivo / Expirado"} • Vistas: {enl.ttl_visitas_conteo}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        {enl.esta_vigente && (
                          <button
                            type="button"
                            onClick={() => copiarEnlace(enl.enlace_url)}
                            style={{ background: "#E0E7FF", color: "#3730A3", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontWeight: 700 }}
                          >
                            Copiar
                          </button>
                        )}
                        {enl.ttl_activo && (
                          <button
                            type="button"
                            onClick={() => revocarEnlace(enl.ttl_token)}
                            style={{ background: "#FEE2E2", color: "#991B1B", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontWeight: 700 }}
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VISOR DETALLADO DEL DOCUMENTO (SOPORTE MULTI-ARCHIVO)             */}
      {/* ========================================================================= */}
      {docParaVer && (() => {
        const archivosVisor = docParaVer.doc_archivos || (docParaVer.doc_archivo_nombre ? [{
          id: "p1",
          nombre: docParaVer.doc_archivo_nombre,
          tamano: docParaVer.doc_archivo_tamano || 0,
          mimetype: docParaVer.doc_archivo_mimetype || "application/pdf",
          base64: docParaVer.doc_archivo_base64,
          url: docParaVer.doc_archivo_url
        }] : []);

        const archivoActual = archivosVisor[indiceArchivoVer] || archivosVisor[0] || {
          nombre: docParaVer.doc_archivo_nombre,
          mimetype: docParaVer.doc_archivo_mimetype,
          base64: docParaVer.doc_archivo_base64
        };

        const esImg = archivoActual?.mimetype?.includes("image");

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px"
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "780px",
                maxHeight: "92vh",
                overflowY: "auto",
                padding: "26px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                    {docParaVer.doc_titulo}
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "#6B7280", margin: 0 }}>
                    Categoría: {docParaVer.doc_categoria} • {archivosVisor.length} archivo(s) adjunto(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocParaVer(null)}
                  style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* PESTAÑAS DE ARCHIVOS EN VISOR MULTI-ARCHIVO */}
              {archivosVisor.length > 1 && (
                <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "12px", paddingBottom: "4px" }}>
                  {archivosVisor.map((arch, idx) => (
                    <button
                      key={arch.id || idx}
                      type="button"
                      onClick={() => setIndiceArchivoVer(idx)}
                      style={{
                        background: indiceArchivoVer === idx ? "#5000BA" : "#F3F4F6",
                        color: indiceArchivoVer === idx ? "#ffffff" : "#374151",
                        border: "none",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      <span>Parte {idx + 1}:</span>
                      <span>{arch.nombre}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* PREVISUALIZADOR */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", marginBottom: "16px", minHeight: "260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {archivoActual?.base64 ? (
                  esImg ? (
                    <img
                      src={archivoActual.base64}
                      alt={archivoActual.nombre}
                      style={{ maxWidth: "100%", maxHeight: "420px", objectFit: "contain" }}
                    />
                  ) : (
                    <iframe
                      src={archivoActual.base64}
                      style={{ width: "100%", height: "430px", border: "none" }}
                      title={archivoActual.nombre}
                    />
                  )
                ) : (
                  <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
                    <FileText size={40} color="#9CA3AF" style={{ margin: "0 auto 8px auto" }} />
                    <div>Previsualizador no disponible en modo offline</div>
                  </div>
                )}
              </div>

              {/* METADATOS TÉCNICOS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#F8FAFC", padding: "14px", borderRadius: "12px", fontSize: "0.8rem", marginBottom: "18px" }}>
                <div><strong>Titular:</strong> {docParaVer.doc_titular_nombre || "No especificado"}</div>
                <div><strong>Identificación:</strong> {docParaVer.doc_titular_identificacion || "No especificada"}</div>
                {docParaVer.doc_fecha_nacimiento && (
                  <div><strong>Fecha Nacimiento:</strong> {new Date(docParaVer.doc_fecha_nacimiento).toLocaleDateString()}</div>
                )}
                <div><strong>Entidad Emisora:</strong> {docParaVer.doc_entidad_emisora || "No especificada"}</div>
                <div><strong>Número/Matrícula:</strong> {docParaVer.doc_numero_documento || "No especificado"}</div>
                <div><strong>Fecha Emisión:</strong> {docParaVer.doc_fecha_emision ? new Date(docParaVer.doc_fecha_emision).toLocaleDateString() : "No registrada"}</div>
                <div>
                  <strong>Fecha Caducidad:</strong> {docParaVer.doc_fecha_caducidad ? new Date(docParaVer.doc_fecha_caducidad).toLocaleDateString() : "Indefinida"}
                  {docParaVer.doc_alertar_caducidad !== false && docParaVer.doc_fecha_caducidad && (
                    <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#5000BA", background: "#F3E8FF", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                      🔔 Alerta a {docParaVer.doc_meses_anticipacion_alerta ?? 3}m
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                {archivoActual?.base64 && (
                  <a
                    href={archivoActual.base64}
                    download={archivoActual.nombre}
                    style={{
                      background: "#05876E",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "9px 18px",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    Descargar Parte Actual
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setDocParaVer(null)}
                  style={{ background: "#F3F4F6", border: "none", borderRadius: "10px", padding: "9px 18px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRMAR ELIMINACIÓN                                            */}
      {/* ========================================================================= */}
      {docParaEliminar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              textAlign: "center"
            }}
          >
            <div style={{ background: "#FEE2E2", width: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" }}>
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", margin: "0 0 6px 0" }}>
              ¿Eliminar este documento?
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#6B7280", margin: "0 0 20px 0" }}>
              Se eliminará <strong>{docParaEliminar.doc_titulo}</strong> y se revocarán todos los enlaces efímeros vinculados.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setDocParaEliminar(null)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                style={{ background: "#DC2626", color: "#ffffff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "0.84rem", fontWeight: 800, cursor: "pointer" }}
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
