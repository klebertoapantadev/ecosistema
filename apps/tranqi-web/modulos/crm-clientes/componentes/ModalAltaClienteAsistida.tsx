"use client";

import React, { useState, useTransition } from "react";
import {
  X, User, Building2, ShieldCheck, AlertTriangle, Sparkles, Upload,
  FileText, CheckCircle2, ArrowRight, Calendar, Scale, Info, Check, Eye,
  Copy, Layers, FileCheck, HelpCircle, Briefcase, ChevronDown, ChevronUp,
  UserCheck, Send, CheckSquare, Hash, Award, Building
} from "lucide-react";
import {
  validarCedulaEcuador,
  validarRucEcuador,
  analizarIdentificacionConAria,
  analizarNombramientoConAria,
  verificarDuplicado,
  verificarConflictoIntereses,
  crearClienteManual,
  type DatosCreacionCliente,
  type ResultadoAriaIdentificacion,
  type ResultadoAriaNombramiento,
  type ItemLogExtraccionAria,
} from "../acciones";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  alGuardarExitoso: (resultado: {
    clienteId: string;
    usuarioId: string;
    nombreCompleto: string;
    identificacion: string;
    accionContinuidad: "solo_guardar" | "radicar_expediente" | "agendar_cita";
  }) => void;
}

function IndicadorOrigenCampo({ esAria, esModificado }: { esAria?: boolean; esModificado?: boolean }) {
  if (esAria && !esModificado) {
    return (
      <span
        title="Dato extraído y mapeado automáticamente por ARIA OCR"
        style={{
          background: "#ECFDF5",
          color: "#047857",
          border: "1px solid #A7F3D0",
          borderRadius: "4px",
          padding: "1px 6px",
          fontSize: "0.68rem",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: "3px"
        }}
      >
        <Sparkles size={10} /> Leído por ARIA
      </span>
    );
  }
  if (esModificado) {
    return (
      <span
        title="Dato ingresado o modificado manualmente"
        style={{
          background: "#F1F5F9",
          color: "#475569",
          border: "1px solid #CBD5E1",
          borderRadius: "4px",
          padding: "1px 6px",
          fontSize: "0.68rem",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: "3px"
        }}
      >
        ✍️ Digitado
      </span>
    );
  }
  return null;
}

export function ModalAltaClienteAsistida({ abierto, alCerrar, alGuardarExitoso }: Props) {
  const [isPending, startTransition] = useTransition();

  // Tipo de personería
  const [tipoPersoneria, setTipoPersoneria] = useState<"natural" | "juridica">("natural");
  const [tipoIdentificacion, setTipoIdentificacion] = useState<"cedula" | "ruc" | "pasaporte">("cedula");

  // Formulario de identificación base
  const [identificacion, setIdentificacion] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [actividadEconomica, setActividadEconomica] = useState("");

  // Contacto y Domicilio
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [casilleroJudicial, setCasilleroJudicial] = useState("");
  const [casilleroElectronico, setCasilleroElectronico] = useState("");

  // Representante Legal (Persona Jurídica)
  const [repNombres, setRepNombres] = useState("");
  const [repCedula, setRepCedula] = useState("");
  const [repCargo, setRepCargo] = useState("Gerente General");
  const [repVencimientoNombramiento, setRepVencimientoNombramiento] = useState("");
  const [repCorreo, setRepCorreo] = useState("");
  const [repCelular, setRepCelular] = useState("");
  const [nombramientoValidadoAria, setNombramientoValidadoAria] = useState(false);

  // Apoderado / Representante Legal Opcional (Persona Natural)
  const [tieneApoderadoNatural, setTieneApoderadoNatural] = useState(false);
  const [apoNombres, setApoNombres] = useState("");
  const [apoCedula, setApoCedula] = useState("");
  const [apoCalidadPoder, setApoCalidadPoder] = useState("Apoderado General");
  const [apoNotariaVigencia, setApoNotariaVigencia] = useState("");

  // Contraparte y Conflict Check
  const [contraparteNombres, setContraparteNombres] = useState("");
  const [contraparteIdentificacion, setContraparteIdentificacion] = useState("");
  const [alertaConflicto, setAlertaConflicto] = useState<string | null>(null);

  // Excepciones y Bypass
  const [omitirValidacionAlgoritmo, setOmitirValidacionAlgoritmo] = useState(false);
  const [motivoExcepcion, setMotivoExcepcion] = useState("");

  // Estados de ARIA OCR, Metadatos y Log de Auditoría
  const [procesandoAriaId, setProcesandoAriaId] = useState(false);
  const [procesandoAriaNom, setProcesandoAriaNom] = useState(false);
  const [badgeAriaId, setBadgeAriaId] = useState<string | null>(null);
  const [badgeAriaNom, setBadgeAriaNom] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [metadatosAria, setMetadatosAria] = useState<Record<string, unknown> | null>(null);
  const [logExtraccionAria, setLogExtraccionAria] = useState<ItemLogExtraccionAria[]>([]);
  const [mostrarLogDetallado, setMostrarLogDetallado] = useState(false);
  const [filtroLog, setFiltroLog] = useState<"todos" | "mapeados" | "metadatos">("todos");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Registro de origen de campos: Leído por ARIA vs Digitado Manualmente
  const [camposAria, setCamposAria] = useState<Record<string, boolean>>({});
  const [camposModificados, setCamposModificados] = useState<Record<string, boolean>>({});

  const marcarCampoModificado = (campo: string) => {
    setCamposModificados((prev) => ({ ...prev, [campo]: true }));
  };

  const copiarAlPortapapeles = (texto: string, clave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(clave);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  if (!abierto) return null;

  // Manejo de carga digital con ARIA OCR (Cédula / RUC / Pasaporte)
  const manejarCargaArchivoId = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoAriaId(true);
    setErrorValidacion(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const res: ResultadoAriaIdentificacion = await analizarIdentificacionConAria(base64, file.name);
      setProcesandoAriaId(false);

      if (res.ok) {
        const nuevosCamposAria: Record<string, boolean> = {};

        if (res.tipoPersoneria) {
          setTipoPersoneria(res.tipoPersoneria);
        }

        if (res.nombres) {
          setNombres(res.nombres);
          nuevosCamposAria["nombres"] = true;
        }
        if (res.apellidos) {
          setApellidos(res.apellidos);
          nuevosCamposAria["apellidos"] = true;
        }
        if (res.razonSocial) {
          setRazonSocial(res.razonSocial);
          nuevosCamposAria["razonSocial"] = true;
        }
        if (res.nombreComercial) {
          setNombreComercial(res.nombreComercial);
          nuevosCamposAria["nombreComercial"] = true;
        }
        if (res.actividadEconomica) {
          setActividadEconomica(res.actividadEconomica);
          nuevosCamposAria["actividadEconomica"] = true;
        }
        if (res.representanteNombres) {
          setRepNombres(res.representanteNombres);
          nuevosCamposAria["repNombres"] = true;
        }
        if (res.representanteCedula) {
          setRepCedula(res.representanteCedula);
          nuevosCamposAria["repCedula"] = true;
        }
        if (res.identificacion) {
          setIdentificacion(res.identificacion);
          setTipoIdentificacion(res.tipoIdentificacion || (res.identificacion.length === 13 ? "ruc" : "cedula"));
          nuevosCamposAria["identificacion"] = true;
        }

        if (res.metadatosAdicionales) {
          setMetadatosAria(res.metadatosAdicionales);
        }

        if (res.logExtraccion && res.logExtraccion.length > 0) {
          setLogExtraccionAria(res.logExtraccion);
        }

        setCamposAria((prev) => ({ ...prev, ...nuevosCamposAria }));
        // Limpiar modificaciones manuales previas para los campos leídos
        setCamposModificados((prev) => {
          const copia = { ...prev };
          Object.keys(nuevosCamposAria).forEach((k) => delete copia[k]);
          return copia;
        });

        const numMapeados = res.logExtraccion
          ? res.logExtraccion.filter(l => l.estado === "mapeado_formulario").length
          : Object.keys(nuevosCamposAria).length;
        const total = res.logExtraccion?.length || numMapeados;

        setBadgeAriaId(`✨ ARIA OCR: ${total} datos identificados (${numMapeados} mapeados al formulario · ${res.confianza}% confianza)`);
        setMostrarLogDetallado(true);
      } else {
        setErrorValidacion(res.mensaje || "No se pudo extraer la identificación.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Manejo de carga de Nombramiento de Representante Legal con ARIA OCR
  const manejarCargaNombramiento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoAriaNom(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const res: ResultadoAriaNombramiento = await analizarNombramientoConAria(base64, file.name);
      setProcesandoAriaNom(false);

      if (res.ok) {
        const nuevosCamposAria: Record<string, boolean> = {};
        if (res.razonSocial && !razonSocial) {
          setRazonSocial(res.razonSocial);
          nuevosCamposAria["razonSocial"] = true;
        }
        if (res.ruc && !identificacion) {
          setIdentificacion(res.ruc);
          nuevosCamposAria["identificacion"] = true;
        }
        if (res.representanteNombres) {
          setRepNombres(res.representanteNombres);
          nuevosCamposAria["repNombres"] = true;
        }
        if (res.representanteCedula) {
          setRepCedula(res.representanteCedula);
          nuevosCamposAria["repCedula"] = true;
        }
        if (res.cargo) {
          setRepCargo(res.cargo);
          nuevosCamposAria["repCargo"] = true;
        }
        if (res.fechaVencimientoCalculada) {
          setRepVencimientoNombramiento(res.fechaVencimientoCalculada);
          nuevosCamposAria["repVencimientoNombramiento"] = true;
        }
        if (res.logExtraccion && res.logExtraccion.length > 0) {
          setLogExtraccionAria((prev) => [...prev, ...(res.logExtraccion || [])]);
        }

        setNombramientoValidadoAria(true);
        setCamposAria((prev) => ({ ...prev, ...nuevosCamposAria }));
        setBadgeAriaNom(`✨ Nombramiento Mercantil Vigente certificado por ARIA (Vence: ${res.fechaVencimientoCalculada || "2 años"})`);
        setMostrarLogDetallado(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Conflict Check en tiempo real al ingresar contraparte
  const ejecutarConflictCheck = async (idContraparte: string, nomContraparte: string) => {
    if ((idContraparte && idContraparte.length >= 9) || (nomContraparte && nomContraparte.length >= 4)) {
      const res = await verificarConflictoIntereses(idContraparte, nomContraparte);
      if (res.conflictoDetectado) {
        setAlertaConflicto(res.mensaje || "Advertencia: la contraparte figura en casos activos.");
      } else {
        setAlertaConflicto(null);
      }
    } else {
      setAlertaConflicto(null);
    }
  };

  const manejarGuardar = (accionContinuidad: "solo_guardar" | "radicar_expediente" | "agendar_cita") => {
    setErrorValidacion(null);

    if (!identificacion || identificacion.trim().length < 5) {
      setErrorValidacion("Debe ingresar un número de identificación válido.");
      return;
    }

    if (tipoPersoneria === "natural" && (!nombres || !apellidos)) {
      setErrorValidacion("Nombres y Apellidos son obligatorios para personas naturales.");
      return;
    }

    if (tipoPersoneria === "juridica" && !razonSocial) {
      setErrorValidacion("La Razón Social es obligatoria para personas jurídicas.");
      return;
    }

    startTransition(async () => {
      try {
        const datos: DatosCreacionCliente = {
          tipoPersoneria,
          tipoIdentificacion,
          identificacion: identificacion.trim(),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          razonSocial: razonSocial.trim(),
          nombreComercial: nombreComercial.trim(),
          actividadEconomica: actividadEconomica.trim() || undefined,
          correo: correo.trim(),
          celular: celular.trim(),
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          casilleroJudicial: casilleroJudicial.trim(),
          casilleroElectronico: casilleroElectronico.trim(),
          representanteLegal: (tipoPersoneria === "juridica" && repNombres) ? {
            nombres: repNombres.trim(),
            cedula: repCedula.trim(),
            cargo: repCargo.trim(),
            nombramientoVence: repVencimientoNombramiento.trim() || undefined,
            documentoValidadoAria: nombramientoValidadoAria,
            correo: repCorreo.trim() || undefined,
            celular: repCelular.trim() || undefined,
          } : undefined,
          apoderadoPersonaNatural: (tipoPersoneria === "natural" && tieneApoderadoNatural && apoNombres) ? {
            nombres: apoNombres.trim(),
            cedula: apoCedula.trim(),
            calidadPoder: apoCalidadPoder.trim(),
            notariaVigencia: apoNotariaVigencia.trim() || undefined,
          } : undefined,
          contrapartePreliminar: contraparteNombres ? {
            nombres: contraparteNombres.trim(),
            identificacion: contraparteIdentificacion.trim() || undefined,
          } : undefined,
          omitirValidacionAlgoritmo,
          motivoExcepcion: omitirValidacionAlgoritmo ? motivoExcepcion : undefined,
          metadatosAria: metadatosAria || undefined,
          camposAutocompletadosAria: Object.keys(camposAria).filter((k) => camposAria[k]),
          logExtraccionAria: logExtraccionAria.length > 0 ? logExtraccionAria : undefined,
        };

        const res = await crearClienteManual(datos);
        alGuardarExitoso({
          clienteId: res.clienteId,
          usuarioId: res.usuarioId,
          nombreCompleto: res.nombreCompleto,
          identificacion: res.identificacion,
          accionContinuidad,
        });
      } catch (err: any) {
        setErrorValidacion(err?.message || "Error al registrar cliente.");
      }
    });
  };

  // Filtrado de logs para la tabla de auditoría OCR
  const logsFiltrados = logExtraccionAria.filter((item) => {
    if (filtroLog === "mapeados") return item.estado === "mapeado_formulario";
    if (filtroLog === "metadatos") return item.estado === "metadato_perfil_jsonb";
    return true;
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
              <Scale size={20} color="#0284C7" />
              Alta Manual Asistida de Cliente · CRM Jurídico
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748B" }}>
              Ingreso para Personas Naturales, Empresas, Representantes y Litigios Telemáticos
            </p>
          </div>
          <button
            onClick={alCerrar}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "50%",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Conmutador de Personería */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                setTipoPersoneria("natural");
                setTipoIdentificacion("cedula");
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: tipoPersoneria === "natural" ? "2px solid #0284C7" : "1px solid #CBD5E1",
                background: tipoPersoneria === "natural" ? "#F0F9FF" : "#FFFFFF",
                color: tipoPersoneria === "natural" ? "#0369A1" : "#475569",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <User size={18} />
              Persona Natural (Ciudadano)
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoPersoneria("juridica");
                setTipoIdentificacion("ruc");
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: tipoPersoneria === "juridica" ? "2px solid #0284C7" : "1px solid #CBD5E1",
                background: tipoPersoneria === "juridica" ? "#F0F9FF" : "#FFFFFF",
                color: tipoPersoneria === "juridica" ? "#0369A1" : "#475569",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Building2 size={18} />
              Persona Jurídica (Empresa / S.A.S.)
            </button>
          </div>

          {/* Banner de Carga con ARIA OCR */}
          <div
            style={{
              border: "1.5px dashed #0284C7",
              background: "#F8FAFC",
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "#E0F2FE", padding: "8px", borderRadius: "8px", color: "#0284C7" }}>
                <Sparkles size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#0F172A" }}>
                  Autocompletado Inteligente con ARIA (OCR & Mapeo Automático)
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                  Carga la Cédula, RUC digital SRI, Pasaporte o Nombramiento y ARIA mapeará los campos al instante
                </p>
              </div>
            </div>
            <label
              style={{
                background: "#0284C7",
                color: "#FFFFFF",
                padding: "7px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <Upload size={14} />
              {procesandoAriaId ? "Analizando..." : "Cargar Identificación / RUC"}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={manejarCargaArchivoId}
                style={{ display: "none" }}
                disabled={procesandoAriaId}
              />
            </label>
          </div>

          {/* Log Interactivo de Extracción y Auditoría de Mapeo de ARIA OCR */}
          {(badgeAriaId || logExtraccionAria.length > 0) && (
            <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", padding: "12px 14px", borderRadius: "10px", fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="#16A34A" />
                  {badgeAriaId || `✨ Documento extraído con ${logExtraccionAria.length} datos identificados`}
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarLogDetallado(!mostrarLogDetallado)}
                  style={{
                    background: "#DCFCE7",
                    border: "1px solid #86EFAC",
                    color: "#15803D",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Eye size={12} />
                  {mostrarLogDetallado ? "Ocultar Log de Extracción" : "Ver Log de Extracción y Mapeo ARIA"}
                  {mostrarLogDetallado ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* Panel Desplegable de Log de Extracción y Mapeo */}
              {mostrarLogDetallado && (
                <div style={{ background: "#FFFFFF", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "12px", marginTop: "2px" }}>
                  {/* Filtros de Pestañas del Log */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setFiltroLog("todos")}
                        style={{
                          background: filtroLog === "todos" ? "#0284C7" : "#F1F5F9",
                          color: filtroLog === "todos" ? "#FFFFFF" : "#475569",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Todos ({logExtraccionAria.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroLog("mapeados")}
                        style={{
                          background: filtroLog === "mapeados" ? "#059669" : "#F1F5F9",
                          color: filtroLog === "mapeados" ? "#FFFFFF" : "#475569",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        🟢 Mapeados en Pantalla ({logExtraccionAria.filter(i => i.estado === "mapeado_formulario").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroLog("metadatos")}
                        style={{
                          background: filtroLog === "metadatos" ? "#6366F1" : "#F1F5F9",
                          color: filtroLog === "metadatos" ? "#FFFFFF" : "#475569",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        🔵 Perfil Digital JSONB ({logExtraccionAria.filter(i => i.estado === "metadato_perfil_jsonb").length})
                      </button>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                      Trazabilidad Inmutable del Documento Oficial
                    </span>
                  </div>

                  {/* Tabla / Grid de Log de Datos Extraídos */}
                  {logsFiltrados.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px", maxHeight: "220px", overflowY: "auto", paddingRight: "4px" }}>
                      {logsFiltrados.map((item, idx) => {
                        const esMapeado = item.estado === "mapeado_formulario";
                        const claveUnica = `${item.campoDetectado}_${idx}`;
                        return (
                          <div
                            key={claveUnica}
                            style={{
                              background: esMapeado ? "#F0FDF4" : "#F8FAFC",
                              border: esMapeado ? "1px solid #86EFAC" : "1px solid #E2E8F0",
                              borderRadius: "6px",
                              padding: "8px 10px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "4px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: esMapeado ? "#15803D" : "#475569" }}>
                                {item.campoDetectado}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  fontWeight: 700,
                                  background: esMapeado ? "#DCFCE7" : "#E0E7FF",
                                  color: esMapeado ? "#166534" : "#3730A3",
                                }}
                              >
                                {esMapeado ? `➔ Campo: ${item.campoMapeadoEnFormulario}` : "JSONB"}
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                              <strong style={{ fontSize: "0.78rem", color: "#0F172A", wordBreak: "break-all" }}>
                                {item.valorOriginal}
                              </strong>
                              <button
                                type="button"
                                title="Copiar dato"
                                onClick={() => copiarAlPortapapeles(item.valorOriginal, claveUnica)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: copiadoId === claveUnica ? "#10B981" : "#94A3B8",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                {copiadoId === claveUnica ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: "10px 0", fontSize: "0.75rem", color: "#64748B", textAlign: "center" }}>
                      No hay registros para este filtro.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Datos de Identificación Base */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                  Tipo Identificación
                </label>
              </div>
              <select
                value={tipoIdentificacion}
                onChange={(e) => {
                  setTipoIdentificacion(e.target.value as any);
                  marcarCampoModificado("tipoIdentificacion");
                }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
              >
                <option value="cedula">Cédula de Identidad</option>
                <option value="ruc">RUC (Registro Único de Contribuyentes)</option>
                <option value="pasaporte">Pasaporte / ID Extranjero</option>
              </select>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                  {tipoPersoneria === "juridica" ? "Número de RUC de la Empresa *" : "Número de Identificación *"}
                </label>
                <IndicadorOrigenCampo
                  esAria={camposAria["identificacion"]}
                  esModificado={camposModificados["identificacion"]}
                />
              </div>
              <input
                type="text"
                value={identificacion}
                onChange={async (e) => {
                  const val = e.target.value;
                  setIdentificacion(val);
                  marcarCampoModificado("identificacion");
                  if (val.length >= 10) {
                    const dup = await verificarDuplicado(val);
                    if (dup.existe) setAvisoDuplicado(dup.mensaje || "Identificación ya registrada.");
                    else setAvisoDuplicado(null);
                  }
                }}
                placeholder={tipoPersoneria === "natural" ? "1719103986" : "1792345678001"}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: camposAria["identificacion"] && !camposModificados["identificacion"]
                    ? "1.5px solid #10B981"
                    : "1px solid #CBD5E1",
                  background: camposAria["identificacion"] && !camposModificados["identificacion"]
                    ? "#F0FDF4"
                    : "#FFFFFF",
                  fontSize: "0.85rem"
                }}
              />
            </div>
          </div>

          {avisoDuplicado && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF", padding: "8px 12px", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <Info size={16} />
              {avisoDuplicado}
            </div>
          )}

          {/* Casilla de Bypass de Validación Algorítmica */}
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", padding: "10px 14px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 600, color: "#92400E", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={omitirValidacionAlgoritmo}
                onChange={(e) => setOmitirValidacionAlgoritmo(e.target.checked)}
              />
              Omitir validación de algoritmo (Cédula especial / Extranjería / Pasaporte)
            </label>
            {omitirValidacionAlgoritmo && (
              <input
                type="text"
                placeholder="Motivo de la excepción (ej. Pasaporte diplomático o cédula de naturalización)"
                value={motivoExcepcion}
                onChange={(e) => setMotivoExcepcion(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #FCD34D", fontSize: "0.8rem" }}
              />
            )}
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: FORMULARIO PERSONA NATURAL (CIUDADANO) */}
          {/* ========================================================================= */}
          {tipoPersoneria === "natural" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                      Nombres *
                    </label>
                    <IndicadorOrigenCampo
                      esAria={camposAria["nombres"]}
                      esModificado={camposModificados["nombres"]}
                    />
                  </div>
                  <input
                    type="text"
                    value={nombres}
                    onChange={(e) => {
                      setNombres(e.target.value);
                      marcarCampoModificado("nombres");
                    }}
                    placeholder="KLEBER MANUEL"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: camposAria["nombres"] && !camposModificados["nombres"]
                        ? "1.5px solid #10B981"
                        : "1px solid #CBD5E1",
                      background: camposAria["nombres"] && !camposModificados["nombres"]
                        ? "#F0FDF4"
                        : "#FFFFFF",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                      Apellidos *
                    </label>
                    <IndicadorOrigenCampo
                      esAria={camposAria["apellidos"]}
                      esModificado={camposModificados["apellidos"]}
                    />
                  </div>
                  <input
                    type="text"
                    value={apellidos}
                    onChange={(e) => {
                      setApellidos(e.target.value);
                      marcarCampoModificado("apellidos");
                    }}
                    placeholder="TOAPANTA CHANCUSI"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: camposAria["apellidos"] && !camposModificados["apellidos"]
                        ? "1.5px solid #10B981"
                        : "1px solid #CBD5E1",
                      background: camposAria["apellidos"] && !camposModificados["apellidos"]
                        ? "#F0FDF4"
                        : "#FFFFFF",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>
              </div>

              {/* Sección Opcional de Apoderado / Representante Legal en Persona Natural */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px", background: "#F8FAFC" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={tieneApoderadoNatural}
                    onChange={(e) => setTieneApoderadoNatural(e.target.checked)}
                  />
                  <span>¿Actúa a través de Apoderado, Tutor o Representante Legal? (Opcional)</span>
                </label>
                <p style={{ margin: "2px 0 8px 24px", fontSize: "0.73rem", color: "#64748B" }}>
                  Aplica para ecuatorianos en el exterior con poder especial, menores en juicios de alimentos, tutores o albaceas.
                </p>

                {tieneApoderadoNatural && (
                  <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Nombres y Apellidos del Apoderado / Tutor
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Ab. Carlos Andrade M."
                        value={apoNombres}
                        onChange={(e) => setApoNombres(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Cédula / Pasaporte del Apoderado
                      </label>
                      <input
                        type="text"
                        placeholder="1712345678"
                        value={apoCedula}
                        onChange={(e) => setApoCedula(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Calidad / Tipo de Representación
                      </label>
                      <select
                        value={apoCalidadPoder}
                        onChange={(e) => setApoCalidadPoder(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                      >
                        <option value="Apoderado General">Apoderado General (Poder Amplio)</option>
                        <option value="Apoderado Especial">Apoderado Especial (Procuración Judicial)</option>
                        <option value="Representante Legal Menor">Representante Legal (Madre/Padre - Alimentos)</option>
                        <option value="Albacea Hereditario">Albacea / Administrador Hereditario</option>
                        <option value="Tutor o Curador">Tutor / Curador Judicial</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Notaría / Consulado y Vigencia
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Consulado Ecuador en Madrid / Notaría 5"
                        value={apoNotariaVigencia}
                        onChange={(e) => setApoNotariaVigencia(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* TAB 2: FORMULARIO PERSONA JURÍDICA (EMPRESAS / S.A.S.) */
            /* ========================================================================= */
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                      Razón Social de la Empresa *
                    </label>
                    <IndicadorOrigenCampo
                      esAria={camposAria["razonSocial"]}
                      esModificado={camposModificados["razonSocial"]}
                    />
                  </div>
                  <input
                    type="text"
                    value={razonSocial}
                    onChange={(e) => {
                      setRazonSocial(e.target.value);
                      marcarCampoModificado("razonSocial");
                    }}
                    placeholder="INMOBILIARIA & CONSTRUCTORA ANDINA S.A.S."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: camposAria["razonSocial"] && !camposModificados["razonSocial"]
                        ? "1.5px solid #10B981"
                        : "1px solid #CBD5E1",
                      background: camposAria["razonSocial"] && !camposModificados["razonSocial"]
                        ? "#F0FDF4"
                        : "#FFFFFF",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                      Nombre Comercial / Fantasía (Opcional)
                    </label>
                    <IndicadorOrigenCampo
                      esAria={camposAria["nombreComercial"]}
                      esModificado={camposModificados["nombreComercial"]}
                    />
                  </div>
                  <input
                    type="text"
                    value={nombreComercial}
                    onChange={(e) => {
                      setNombreComercial(e.target.value);
                      marcarCampoModificado("nombreComercial");
                    }}
                    placeholder="Andina Construcciones"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Actividad Económica / Sector (Opcional)
                </label>
                <input
                  type="text"
                  value={actividadEconomica}
                  onChange={(e) => setActividadEconomica(e.target.value)}
                  placeholder="Ej. Construcción y Promoción Inmobiliaria / Servicios Legales y Corporativos"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                />
              </div>

              {/* Representante Legal Principal con ARIA OCR */}
              <div style={{ border: "1px solid #BAE6FD", borderRadius: "10px", padding: "12px", background: "#F0F9FF" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0369A1", display: "flex", alignItems: "center", gap: "6px" }}>
                    <UserCheck size={16} />
                    Representante Legal Principal (Obligatorio para Contratos y Demandas)
                  </span>
                  <label style={{ fontSize: "0.75rem", color: "#0284C7", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Upload size={12} />
                    {procesandoAriaNom ? "Analizando Nombramiento..." : "Cargar Nombramiento PDF"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={manejarCargaNombramiento}
                      style={{ display: "none" }}
                      disabled={procesandoAriaNom}
                    />
                  </label>
                </div>

                {badgeAriaNom && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", padding: "6px 10px", borderRadius: "6px", fontSize: "0.75rem", marginBottom: "8px" }}>
                    {badgeAriaNom}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#475569", marginBottom: "2px" }}>
                      Nombres del Representante
                    </label>
                    <input
                      type="text"
                      placeholder="Carlos Alberto Pérez Mena"
                      value={repNombres}
                      onChange={(e) => {
                        setRepNombres(e.target.value);
                        marcarCampoModificado("repNombres");
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["repNombres"] && !camposModificados["repNombres"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["repNombres"] && !camposModificados["repNombres"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#475569", marginBottom: "2px" }}>
                      Cédula / Pasaporte
                    </label>
                    <input
                      type="text"
                      placeholder="1719103986"
                      value={repCedula}
                      onChange={(e) => {
                        setRepCedula(e.target.value);
                        marcarCampoModificado("repCedula");
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["repCedula"] && !camposModificados["repCedula"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["repCedula"] && !camposModificados["repCedula"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#475569", marginBottom: "2px" }}>
                      Cargo Estatutario
                    </label>
                    <input
                      type="text"
                      placeholder="Gerente General"
                      value={repCargo}
                      onChange={(e) => {
                        setRepCargo(e.target.value);
                        marcarCampoModificado("repCargo");
                      }}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#475569", marginBottom: "2px" }}>
                      Vigencia Nombramiento / Registro Mercantil
                    </label>
                    <input
                      type="date"
                      value={repVencimientoNombramiento}
                      onChange={(e) => setRepVencimientoNombramiento(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#475569", marginBottom: "2px" }}>
                      Correo Directo Representante (Opcional)
                    </label>
                    <input
                      type="email"
                      placeholder="gerencia@empresa.com"
                      value={repCorreo}
                      onChange={(e) => setRepCorreo(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contacto y Casillero Judicial */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                {tipoPersoneria === "juridica" ? "Correo Facturación / Notificaciones *" : "Correo Electrónico *"}
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder={tipoPersoneria === "juridica" ? "facturacion@empresa.com" : "cliente@correo.com"}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Celular / WhatsApp (Contacto)
              </label>
              <input
                type="tel"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="0991234567"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Casillero Judicial Electrónico
              </label>
              <input
                type="text"
                value={casilleroElectronico}
                onChange={(e) => setCasilleroElectronico(e.target.value)}
                placeholder="1719103986@funcionjudicial.gob.ec"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
              />
            </div>
          </div>

          {/* Sección de Contraparte y Conflict Check */}
          <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 14px", background: "#F8FAFC" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "6px" }}>
              Contraparte Preliminar (Verificación de Conflicto de Intereses)
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <input
                type="text"
                placeholder="Nombres de la Contraparte (Demandado / Cónyuge / Empresa Opositora)"
                value={contraparteNombres}
                onChange={(e) => {
                  setContraparteNombres(e.target.value);
                  ejecutarConflictCheck(contraparteIdentificacion, e.target.value);
                }}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
              />
              <input
                type="text"
                placeholder="Cédula/RUC de la Contraparte"
                value={contraparteIdentificacion}
                onChange={(e) => {
                  setContraparteIdentificacion(e.target.value);
                  ejecutarConflictCheck(e.target.value, contraparteNombres);
                }}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
              />
            </div>

            {alertaConflicto && (
              <div style={{ marginTop: "8px", background: "#FEF3C7", border: "1px solid #F59E0B", color: "#92400E", padding: "8px 10px", borderRadius: "6px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} />
                {alertaConflicto}
              </div>
            )}
          </div>

          {errorValidacion && (
            <div style={{ background: "#FEF2F2", border: "1px solid #F87171", color: "#991B1B", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem" }}>
              {errorValidacion}
            </div>
          )}
        </div>

        {/* Pie de Acciones Multiopción */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={alCerrar}
            disabled={isPending}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => manejarGuardar("solo_guardar")}
              disabled={isPending}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#0F172A",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isPending ? "Guardando..." : "Solo Guardar"}
            </button>

            <button
              type="button"
              onClick={() => manejarGuardar("agendar_cita")}
              disabled={isPending}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #0284C7",
                background: "#F0F9FF",
                color: "#0284C7",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Calendar size={15} />
              Guardar y Agendar Cita
            </button>

            <button
              type="button"
              onClick={() => manejarGuardar("radicar_expediente")}
              disabled={isPending}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#0284C7",
                color: "#FFFFFF",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(2, 132, 199, 0.25)",
              }}
            >
              <Scale size={15} />
              Guardar y Radicar Expediente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
