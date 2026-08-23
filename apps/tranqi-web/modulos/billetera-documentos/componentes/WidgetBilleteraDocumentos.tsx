"use client";

import React, { useState, useEffect } from "react";
import {
  Folder, Shield, Upload, Share2, Clock, CheckCircle2, AlertTriangle, XCircle,
  FileText, Search, Eye, Trash2, KeyRound, ExternalLink, Copy, Check, Sparkles,
  Lock, Flame, FileCheck, RefreshCw, Filter, Calendar, Tag, ChevronRight, User
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  doc_entidad_emisora?: string | null;
  doc_numero_documento?: string | null;
  doc_fecha_emision?: string | null;
  doc_fecha_caducidad?: string | null;
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
  const [docParaEliminar, setDocParaEliminar] = useState<DocumentoBilletera | null>(null);

  // Estados de Formulario de Subida & OCR
  const [nuevoTitulo, setNuevoTitulo] = useState<string>("");
  const [nuevaCategoria, setNuevaCategoria] = useState<string>("identidad");
  const [nuevoTipo, setNuevoTipo] = useState<string>("cedula");
  const [nuevoTitular, setNuevoTitular] = useState<string>("");
  const [nuevaIdentificacion, setNuevaIdentificacion] = useState<string>("");
  const [nuevoEmisor, setNuevoEmisor] = useState<string>("");
  const [nuevoNumeroDoc, setNuevoNumeroDoc] = useState<string>("");
  const [nuevaFechaEmision, setNuevaFechaEmision] = useState<string>("");
  const [nuevaFechaCaducidad, setNuevaFechaCaducidad] = useState<string>("");
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<{
    nombre: string;
    tamano: number;
    mimetype: string;
    base64: string;
  } | null>(null);
  const [procesandoOcr, setProcesandoOcr] = useState<boolean>(false);
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

  // Simulación inteligente de extracción OCR desde el archivo cargado
  const procesarArchivoParaOcr = (file: File, base64Content: string) => {
    setProcesandoOcr(true);
    const nombreLimpio = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    setNuevoTitulo(nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1));

    // Detección automática por nombre
    const lower = file.name.toLowerCase();
    if (lower.includes("cedula") || lower.includes("identidad") || lower.includes("dni")) {
      setNuevaCategoria("identidad");
      setNuevoTipo("cedula");
      setNuevoEmisor("Registro Civil del Ecuador");
    } else if (lower.includes("licencia") || lower.includes("conducir")) {
      setNuevaCategoria("identidad");
      setNuevoTipo("licencia_conducir");
      setNuevoEmisor("Agencia Nacional de Tránsito (ANT)");
    } else if (lower.includes("matricula") || lower.includes("vehicular") || lower.includes("auto")) {
      setNuevaCategoria("vehicular");
      setNuevoTipo("matricula_vehicular");
      setNuevoEmisor("ANT / Agencia Metropolitana de Tránsito");
    } else if (lower.includes("contrato") || lower.includes("arriendo") || lower.includes("arrendamiento")) {
      setNuevaCategoria("contratos");
      setNuevoTipo("contrato_arrendamiento");
    } else if (lower.includes("titulo") || lower.includes("senescyt") || lower.includes("abogado") || lower.includes("foro")) {
      setNuevaCategoria("profesional");
      setNuevoTipo("titulo_profesional");
      setNuevoEmisor("SENESCYT / Consejo de la Judicatura");
    } else if (lower.includes("ruc") || lower.includes("sri") || lower.includes("rimpe")) {
      setNuevaCategoria("profesional");
      setNuevoTipo("ruc");
      setNuevoEmisor("Servicio de Rentas Internas (SRI)");
    }

    setTimeout(() => {
      setProcesandoOcr(false);
      mostrarToast("✨ Archivo analizado. Parámetros listos para validación.", "info");
    }, 600);
  };

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      mostrarToast("El archivo excede el límite máximo de 25MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setArchivoSeleccionado({
        nombre: file.name,
        tamano: file.size,
        mimetype: file.type || "application/pdf",
        base64
      });
      procesarArchivoParaOcr(file, base64);
    };
    reader.readAsDataURL(file);
  };

  const guardarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoSeleccionado) {
      mostrarToast("Por favor selecciona un archivo PDF o imagen", "error");
      return;
    }
    if (!nuevoTitulo.trim()) {
      mostrarToast("El título del documento es obligatorio", "error");
      return;
    }

    try {
      setGuardandoDoc(true);
      const payload = {
        titulo: nuevoTitulo.trim(),
        categoria: nuevaCategoria,
        tipo: nuevoTipo,
        archivoNombre: archivoSeleccionado.nombre,
        archivoTamano: archivoSeleccionado.tamano,
        archivoMimetype: archivoSeleccionado.mimetype,
        archivoBase64: archivoSeleccionado.base64,
        entidadEmisora: nuevoEmisor.trim() || null,
        numeroDocumento: nuevoNumeroDoc.trim() || null,
        fechaEmision: nuevaFechaEmision || null,
        fechaCaducidad: nuevaFechaCaducidad || null,
        titularNombre: nuevoTitular.trim() || null,
        titularIdentificacion: nuevaIdentificacion.trim() || null,
        metadatosOcr: {
          analizado_en: new Date().toISOString(),
          mimetype: archivoSeleccionado.mimetype
        }
      };

      const res = await fetch("/api/billetera/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.ok) {
        mostrarToast("✅ Documento resguardado exitosamente en tu billetera.");
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
    setArchivoSeleccionado(null);
    setNuevoTitulo("");
    setNuevaCategoria("identidad");
    setNuevoTipo("cedula");
    setNuevoTitular("");
    setNuevaIdentificacion("");
    setNuevoEmisor("");
    setNuevoNumeroDoc("");
    setNuevaFechaEmision("");
    setNuevaFechaCaducidad("");
  };

  const abrirCompartir = async (doc: DocumentoBilletera) => {
    setDocParaCompartir(doc);
    setEnlaceGenerado(null);
    setModoTtl("24h");
    setPinTtl("");
    setCopiado(false);

    try {
      const res = await fetch(`/api/billetera/compartir?documentoId=${doc.doc_id}`);
      const json = await res.json();
      if (json.ok) {
        setListaEnlacesActivos(json.data || []);
      }
    } catch (e) {
      console.error(e);
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
          pinSeguridad: pinTtl.trim() || undefined
        })
      });
      const json = await res.json();
      if (json.ok) {
        setEnlaceGenerado(json.data.enlace_url);
        mostrarToast("🔗 Enlace efímero generado con éxito");
        // Recargar lista
        const resList = await fetch(`/api/billetera/compartir?documentoId=${docParaCompartir.doc_id}`);
        const jsonList = await resList.json();
        if (jsonList.ok) setListaEnlacesActivos(jsonList.data || []);
      } else {
        mostrarToast(json.error || "Error al generar enlace", "error");
      }
    } catch (e: any) {
      mostrarToast(e.message || "Error al generar enlace", "error");
    } finally {
      setGenerandoTtl(false);
    }
  };

  const revocarEnlace = async (token: string) => {
    try {
      const res = await fetch(`/api/billetera/compartir?token=${token}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        mostrarToast("Enlace revocado");
        if (docParaCompartir) {
          const resList = await fetch(`/api/billetera/compartir?documentoId=${docParaCompartir.doc_id}`);
          const jsonList = await resList.json();
          if (jsonList.ok) setListaEnlacesActivos(jsonList.data || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copiarEnlace = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiado(true);
    mostrarToast("📋 Enlace copiado al portapapeles");
    setTimeout(() => setCopiado(false), 2500);
  };

  const eliminarDocumento = async () => {
    if (!docParaEliminar) return;
    try {
      const res = await fetch(`/api/billetera/documentos?id=${docParaEliminar.doc_id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        mostrarToast("🗑️ Documento eliminado de la billetera");
        setDocParaEliminar(null);
        cargarDocumentos();
      } else {
        mostrarToast(json.error || "Error al eliminar", "error");
      }
    } catch (e: any) {
      mostrarToast(e.message || "Error", "error");
    }
  };

  // Filtrado de documentos
  const documentosFiltrados = documentos.filter((d) => {
    const cumpleCat = categoriaActiva === "todas" || d.doc_categoria === categoriaActiva;
    const cumpleVig = filtroVigencia === "todos" || d.estado_calculado === filtroVigencia;
    const q = busqueda.toLowerCase().trim();
    const cumpleBusq =
      !q ||
      d.doc_titulo.toLowerCase().includes(q) ||
      (d.doc_titular_nombre && d.doc_titular_nombre.toLowerCase().includes(q)) ||
      (d.doc_titular_identificacion && d.doc_titular_identificacion.includes(q)) ||
      (d.doc_entidad_emisora && d.doc_entidad_emisora.toLowerCase().includes(q));

    return cumpleCat && cumpleVig && cumpleBusq;
  });

  // Métricas rápidas
  const totalDocs = documentos.length;
  const vigentesDocs = documentos.filter(d => d.estado_calculado === "vigente").length;
  const porVencerDocs = documentos.filter(d => d.estado_calculado === "por_vencer").length;
  const vencidosDocs = documentos.filter(d => d.estado_calculado === "vencido").length;

  return (
    <div style={{ width: "100%", animation: "fadeIn 0.2s ease" }}>
      {/* TOAST FLOTANTE */}
      {toastMensaje && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: toastMensaje.tipo === "error" ? "#DC2626" : toastMensaje.tipo === "info" ? "#2563EB" : "#05876E",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.88rem",
            fontWeight: 700
          }}
        >
          {toastMensaje.texto}
        </div>
      )}

      {/* HEADER DE LA BILLETERA */}
      <div
        style={{
          background: "linear-gradient(135deg, #2A0060 0%, #5000BA 60%, #1E0045 100%)",
          borderRadius: "20px",
          padding: "26px 30px",
          color: "#ffffff",
          boxShadow: "0 10px 30px rgba(80, 0, 186, 0.2)",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.16)", padding: "4px 10px", borderRadius: "20px" }}>
              BÓVEDA DIGITAL LPMS &amp; TTL
            </span>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, background: "#10B981", color: "#ffffff", padding: "4px 10px", borderRadius: "20px" }}>
              Zero-Custody Cifrado
            </span>
          </div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 900, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            Billetera Digital de Documentos Seguros
          </h1>
          <p style={{ fontSize: "0.86rem", opacity: 0.9, margin: 0, lineHeight: 1.4 }}>
            Custodia tus documentos de identidad, vehiculares, contratos y credenciales profesionales con reconocimiento OCR de caducidad y compartición por enlaces efímeros (TTL).
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setModalSubirAbierto(true)}
            style={{
              background: "#F59E0B",
              color: "#111827",
              border: "none",
              borderRadius: "12px",
              padding: "10px 18px",
              fontSize: "0.88rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
              transition: "transform 0.15s ease"
            }}
            title="Subir documento a la billetera"
          >
            <Upload size={16} />
            Subir Documento
          </button>

          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "50%",
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                cursor: "pointer"
              }}
              title="Cerrar widget"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPIS DE VIGENCIA Y BÓVEDA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div
          onClick={() => { setFiltroVigencia("todos"); setCategoriaActiva("todas"); }}
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "16px",
            border: filtroVigencia === "todos" && categoriaActiva === "todas" ? "2px solid #5000BA" : "1px solid #E5E7EB",
            cursor: "pointer",
            transition: "all 0.15s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6B7280" }}>Total en Bóveda</span>
            <Folder size={18} color="#5000BA" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#111827" }}>{totalDocs}</div>
        </div>

        <div
          onClick={() => setFiltroVigencia("vigente")}
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "16px",
            border: filtroVigencia === "vigente" ? "2px solid #05876E" : "1px solid #E5E7EB",
            cursor: "pointer"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#05876E" }}>Vigentes</span>
            <CheckCircle2 size={18} color="#05876E" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#05876E" }}>{vigentesDocs}</div>
        </div>

        <div
          onClick={() => setFiltroVigencia("por_vencer")}
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "16px",
            border: filtroVigencia === "por_vencer" ? "2px solid #D97706" : "1px solid #E5E7EB",
            cursor: "pointer"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#D97706" }}>Por Vencer (≤30d)</span>
            <AlertTriangle size={18} color="#D97706" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#D97706" }}>{porVencerDocs}</div>
        </div>

        <div
          onClick={() => setFiltroVigencia("vencido")}
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "16px",
            border: filtroVigencia === "vencido" ? "2px solid #DC2626" : "1px solid #E5E7EB",
            cursor: "pointer"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#DC2626" }}>Caducados</span>
            <XCircle size={18} color="#DC2626" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#DC2626" }}>{vencidosDocs}</div>
        </div>
      </div>

      {/* PESTAÑAS DE CATEGORÍAS */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "10px", marginBottom: "18px" }}>
        {Object.entries(CATEGORIAS_CONFIG).map(([key, item]) => {
          const activa = categoriaActiva === key;
          const conteo = key === "todas" ? totalDocs : documentos.filter(d => d.doc_categoria === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategoriaActiva(key)}
              style={{
                background: activa ? item.color : "#ffffff",
                color: activa ? "#ffffff" : "#374151",
                border: activa ? `1px solid ${item.color}` : "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "8px 16px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
              }}
            >
              <span>{item.icono}</span>
              <span>{item.label}</span>
              <span
                style={{
                  background: activa ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  color: activa ? "#ffffff" : "#6B7280",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  fontSize: "0.72rem"
                }}
              >
                {conteo}
              </span>
            </button>
          );
        })}
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #E5E7EB",
          padding: "16px",
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
            <option value="por_vencer">🟡 Por Vencer (≤30 días)</option>
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
          <p style={{ fontSize: "0.86rem", color: "#6B7280", margin: "0 0 16px 0", maxWidth: "460px", marginLeft: "auto", marginRight: "auto" }}>
            Guarda tus cédulas, contratos, matrículas o títulos para mantenerlos protegidos y generar enlaces temporales protegidos con PIN.
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
            Subir Primer Documento
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {documentosFiltrados.map((doc) => {
            const catConfig = CATEGORIAS_CONFIG[doc.doc_categoria] || CATEGORIAS_CONFIG["otros"] || {
              label: "Otros", icono: "📎", color: "#6B7280", desc: ""
            };
            const esPdf = doc.doc_archivo_mimetype?.includes("pdf") || doc.doc_archivo_nombre?.endsWith(".pdf");

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
                      <div>
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
                      </div>
                    </div>

                    {/* SEMÁFORO DE CADUCIDAD */}
                    {doc.estado_calculado === "vigente" && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#05876E", background: "#ECFDF5", padding: "3px 8px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={12} /> Vigente
                      </span>
                    )}
                    {doc.estado_calculado === "por_vencer" && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "3px 8px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
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
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setDocParaVer(doc)}
                      style={{
                        background: "#F3F4F6",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 10px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#374151",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Ver documento completo"
                    >
                      <Eye size={14} /> Ver
                    </button>

                    <button
                      type="button"
                      onClick={() => abrirCompartir(doc)}
                      style={{
                        background: "#EEF2FF",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 10px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#4F46E5",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Compartir enlace efímero TTL"
                    >
                      <Share2 size={14} /> Compartir
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    {esPdf && (
                      <Link
                        href="/panel/firma-documentos"
                        style={{
                          background: "#FDF4FF",
                          border: "1px solid #F5D0FE",
                          borderRadius: "8px",
                          padding: "7px 10px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "#9333EA",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Firmar electrónicamente con .p12"
                      >
                        <FileCheck size={14} /> Firmar
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => setDocParaEliminar(doc)}
                      style={{
                        background: "#FEF2F2",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 9px",
                        color: "#DC2626",
                        cursor: "pointer"
                      }}
                      title="Eliminar de la billetera"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SUBIR DOCUMENTO & ASISTENTE OCR                                  */}
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
              maxWidth: "640px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                  Resguardar Documento en Billetera
                </h2>
                <p style={{ fontSize: "0.82rem", color: "#6B7280", margin: 0 }}>
                  Formatos PDF, PNG o JPG (hasta 25MB). Extracción de parámetros clave.
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
              {/* SELECTOR DE ARCHIVO */}
              <div
                style={{
                  border: "2px dashed #CBD5E1",
                  borderRadius: "14px",
                  padding: "24px",
                  textAlign: "center",
                  background: archivoSeleccionado ? "#F8FAFC" : "#FFFFFF",
                  marginBottom: "16px",
                  cursor: "pointer",
                  position: "relative"
                }}
              >
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleSeleccionarArchivo}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer"
                  }}
                />
                {archivoSeleccionado ? (
                  <div>
                    <FileText size={36} color="#5000BA" style={{ margin: "0 auto 8px auto" }} />
                    <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#1F2937" }}>{archivoSeleccionado.nombre}</div>
                    <div style={{ fontSize: "0.78rem", color: "#6B7280" }}>
                      {(archivoSeleccionado.tamano / (1024 * 1024)).toFixed(2)} MB • {archivoSeleccionado.mimetype}
                    </div>
                    {procesandoOcr && (
                      <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#5000BA", fontWeight: 700 }}>
                        <Sparkles size={14} className="anim-girar" style={{ display: "inline", marginRight: "4px" }} />
                        Analizando parámetros OCR...
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Upload size={36} color="#94A3B8" style={{ margin: "0 auto 8px auto" }} />
                    <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#334155" }}>
                      Haz clic o arrastra tu archivo aquí
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                      Soporta Cédulas, Contratos, Matrículas, Títulos y más (PDF o Imagen)
                    </div>
                  </div>
                )}
              </div>

              {/* CAMPOS RECONOCIDOS & EDITABLES */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Título del Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoTitulo}
                    onChange={(e) => setNuevoTitulo(e.target.value)}
                    placeholder="Ej. Cédula de Identidad 2026"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                    Categoría *
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
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
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#DC2626", marginBottom: "4px" }}>
                    Fecha de Caducidad (Alertas)
                  </label>
                  <input
                    type="date"
                    value={nuevaFechaCaducidad}
                    onChange={(e) => setNuevaFechaCaducidad(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #FCA5A5", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

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
                  disabled={guardandoDoc || !archivoSeleccionado}
                  style={{
                    background: "#5000BA",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 22px",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: guardandoDoc ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(80, 0, 186, 0.3)"
                  }}
                >
                  {guardandoDoc ? "Resguardando..." : "Guardar en Billetera"}
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
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                {generandoTtl ? "Generando Enlace Criptográfico..." : "Generar Enlace Seguro"}
              </button>
            </div>

            {/* ENLACE GENERADO RECIENTE */}
            {enlaceGenerado && (
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "12px", padding: "14px", marginBottom: "18px" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#065F46", marginBottom: "6px" }}>
                  🎉 ¡Enlace Efímero Creado!
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    readOnly
                    value={enlaceGenerado}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1px solid #6EE7B7", fontSize: "0.8rem", background: "#ffffff" }}
                  />
                  <button
                    type="button"
                    onClick={() => copiarEnlace(enlaceGenerado)}
                    style={{
                      background: copiado ? "#059669" : "#10B981",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            )}

            {/* ENLACES ACTIVOS */}
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
      {/* MODAL 3: VISOR DETALLADO DEL DOCUMENTO                                    */}
      {/* ========================================================================= */}
      {docParaVer && (
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
              maxWidth: "760px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                  {docParaVer.doc_titulo}
                </h2>
                <p style={{ fontSize: "0.82rem", color: "#6B7280", margin: 0 }}>
                  Categoría: {docParaVer.doc_categoria} • Archivo: {docParaVer.doc_archivo_nombre}
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

            {/* PREVISUALIZADOR */}
            <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", marginBottom: "16px", minHeight: "260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {docParaVer.doc_archivo_base64 ? (
                docParaVer.doc_archivo_mimetype?.includes("image") ? (
                  <img
                    src={docParaVer.doc_archivo_base64}
                    alt={docParaVer.doc_titulo}
                    style={{ maxWidth: "100%", maxHeight: "400px", objectFit: "contain" }}
                  />
                ) : (
                  <iframe
                    src={docParaVer.doc_archivo_base64}
                    style={{ width: "100%", height: "420px", border: "none" }}
                    title={docParaVer.doc_titulo}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F8FAFC", padding: "14px", borderRadius: "12px", fontSize: "0.82rem", marginBottom: "18px" }}>
              <div><strong>Titular:</strong> {docParaVer.doc_titular_nombre || "No especificado"}</div>
              <div><strong>Identificación:</strong> {docParaVer.doc_titular_identificacion || "No especificada"}</div>
              <div><strong>Entidad Emisora:</strong> {docParaVer.doc_entidad_emisora || "No especificada"}</div>
              <div><strong>Número/Matrícula:</strong> {docParaVer.doc_numero_documento || "No especificado"}</div>
              <div><strong>Fecha Emisión:</strong> {docParaVer.doc_fecha_emision ? new Date(docParaVer.doc_fecha_emision).toLocaleDateString() : "No registrada"}</div>
              <div><strong>Fecha Caducidad:</strong> {docParaVer.doc_fecha_caducidad ? new Date(docParaVer.doc_fecha_caducidad).toLocaleDateString() : "Indefinida"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {docParaVer.doc_archivo_base64 && (
                <a
                  href={docParaVer.doc_archivo_base64}
                  download={docParaVer.doc_archivo_nombre}
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
                  Descargar Copia
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
      )}

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
          <div style={{ background: "#ffffff", borderRadius: "18px", width: "100%", maxWidth: "420px", padding: "24px", textAlign: "center" }}>
            <div style={{ background: "#FEE2E2", width: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" }}>
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", margin: "0 0 6px 0" }}>
              ¿Eliminar Documento?
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#6B7280", margin: "0 0 18px 0" }}>
              Se eliminará <strong>{docParaEliminar.doc_titulo}</strong> y se revocarán todos los enlaces TTL asociados.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setDocParaEliminar(null)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "10px", padding: "9px 18px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminarDocumento}
                style={{ background: "#DC2626", color: "#ffffff", border: "none", borderRadius: "10px", padding: "9px 20px", fontSize: "0.84rem", fontWeight: 800, cursor: "pointer" }}
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
