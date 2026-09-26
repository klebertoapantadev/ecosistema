"use client";

import React, { useState, useTransition } from "react";
import {
  X, User, Building2, ShieldCheck, AlertTriangle, Sparkles, Upload,
  FileText, CheckCircle2, ArrowRight, Calendar, Scale, Info, Check, Eye,
  Copy, Layers, FileCheck, HelpCircle, Briefcase, ChevronDown, ChevronUp,
  UserCheck, Send, CheckSquare, Hash, Award, Building, Wallet, Lock, Shield,
  Trash2, FilePlus2
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
  type DocumentoBilleteraCarga,
  type ResultadoAriaIdentificacion,
  type ResultadoAriaNombramiento,
  type ItemLogExtraccionAria,
  type ResultadoVerificacionCliente,
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

interface ArchivoBilleteraEstado {
  nombre: string;
  base64: string;
  mimetype: string;
  tamano: number;
  resultadoOcr?: any;
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

  // Datos de Filiación, Cédula y Registro Civil (Persona Natural)
  const [nacionalidad, setNacionalidad] = useState("ECUATORIANA");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [lugarNacimiento, setLugarNacimiento] = useState("");
  const [sexo, setSexo] = useState("HOMBRE");
  const [estadoCivil, setEstadoCivil] = useState("SOLTERO");
  const [conyuge, setConyuge] = useState("");
  const [fechaExpiracionDocumento, setFechaExpiracionDocumento] = useState("");

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

  // Estados de Archivos para Billetera Digital
  const [archivoCedulaNatural, setArchivoCedulaNatural] = useState<ArchivoBilleteraEstado | null>(null);
  const [archivoRepCedula, setArchivoRepCedula] = useState<ArchivoBilleteraEstado | null>(null);
  const [archivoNombramiento, setArchivoNombramiento] = useState<ArchivoBilleteraEstado | null>(null);
  const [archivoRucSRI, setArchivoRucSRI] = useState<ArchivoBilleteraEstado | null>(null);

  // Estados de ARIA OCR, Metadatos y Log de Auditoría
  const [procesandoAriaId, setProcesandoAriaId] = useState(false);
  const [procesandoAriaNom, setProcesandoAriaNom] = useState(false);
  const [procesandoAriaRepCedula, setProcesandoAriaRepCedula] = useState(false);
  const [badgeAriaId, setBadgeAriaId] = useState<string | null>(null);
  const [badgeAriaNom, setBadgeAriaNom] = useState<string | null>(null);
  const [badgeAriaRepCedula, setBadgeAriaRepCedula] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [resVerificacion, setResVerificacion] = useState<ResultadoVerificacionCliente | null>(null);
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

  const evaluarDuplicadosYPlanes = async (idVal: string, mailVal: string) => {
    const idLimp = idVal ? idVal.trim() : "";
    const mailLimp = mailVal ? mailVal.trim() : "";

    if (idLimp.length >= 8 || (mailLimp.length >= 5 && mailLimp.includes("@"))) {
      try {
        const res = await verificarDuplicado(idLimp, mailLimp, "tranqi");
        setResVerificacion(res);
        if (res.advertencias.length > 0 && res.advertencias[0]) {
          setAvisoDuplicado(res.advertencias[0].descripcion);
        } else {
          setAvisoDuplicado(null);
        }
      } catch {
        // Fallback
      }
    } else {
      setResVerificacion(null);
      setAvisoDuplicado(null);
    }
  };

  if (!abierto) return null;

  // Manejo de carga digital con ARIA OCR (Cédula Persona Natural / RUC / Pasaporte)
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
        // Guardar archivo para la Billetera Digital
        const nuevoArchivoBilletera: ArchivoBilleteraEstado = {
          nombre: file.name,
          base64,
          mimetype: file.type || "application/pdf",
          tamano: file.size,
          resultadoOcr: res,
        };

        if (res.tipoPersoneria === "juridica" || (res.identificacion && res.identificacion.length === 13)) {
          setArchivoRucSRI(nuevoArchivoBilletera);
        } else {
          setArchivoCedulaNatural(nuevoArchivoBilletera);
        }

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

        if (res.nacionalidad) {
          setNacionalidad(res.nacionalidad.toUpperCase());
          nuevosCamposAria["nacionalidad"] = true;
        }
        if (res.fechaNacimiento) {
          setFechaNacimiento(res.fechaNacimiento);
          nuevosCamposAria["fechaNacimiento"] = true;
        }
        if (res.lugarNacimiento) {
          setLugarNacimiento(res.lugarNacimiento.toUpperCase());
          nuevosCamposAria["lugarNacimiento"] = true;
        }
        if (res.sexo) {
          setSexo(res.sexo.toUpperCase());
          nuevosCamposAria["sexo"] = true;
        }
        if (res.estadoCivil) {
          setEstadoCivil(res.estadoCivil.toUpperCase());
          nuevosCamposAria["estadoCivil"] = true;
        }
        if (res.conyuge) {
          setConyuge(res.conyuge.toUpperCase());
          nuevosCamposAria["conyuge"] = true;
        }
        if (res.fechaExpiracion) {
          setFechaExpiracionDocumento(res.fechaExpiracion);
          nuevosCamposAria["fechaExpiracionDocumento"] = true;
        }

        if (res.metadatosAdicionales) {
          setMetadatosAria((prev) => ({ ...(prev || {}), ...res.metadatosAdicionales }));
        }

        if (res.logExtraccion && res.logExtraccion.length > 0) {
          setLogExtraccionAria((prev) => [...prev.filter(p => !res.logExtraccion?.some(r => r.campoDetectado === p.campoDetectado)), ...(res.logExtraccion || [])]);
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

  // Manejo de carga de Cédula del Representante Legal (Persona Jurídica)
  const manejarCargaArchivoRepCedula = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoAriaRepCedula(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const res: ResultadoAriaIdentificacion = await analizarIdentificacionConAria(base64, file.name);
      setProcesandoAriaRepCedula(false);

      if (res.ok) {
        setArchivoRepCedula({
          nombre: file.name,
          base64,
          mimetype: file.type || "application/pdf",
          tamano: file.size,
          resultadoOcr: res,
        });

        const nuevosCamposAria: Record<string, boolean> = {};
        const repNomCompleto = `${res.nombres || ""} ${res.apellidos || ""}`.trim();
        if (repNomCompleto) {
          setRepNombres(repNomCompleto);
          nuevosCamposAria["repNombres"] = true;
        }
        if (res.identificacion) {
          setRepCedula(res.identificacion);
          nuevosCamposAria["repCedula"] = true;
        }

        if (res.metadatosAdicionales) {
          setMetadatosAria((prev) => ({ ...(prev || {}), representante_legal_cedula_ocr: res.metadatosAdicionales }));
        }

        if (res.logExtraccion && res.logExtraccion.length > 0) {
          setLogExtraccionAria((prev) => [...prev, ...(res.logExtraccion || [])]);
        }

        setCamposAria((prev) => ({ ...prev, ...nuevosCamposAria }));
        setBadgeAriaRepCedula(`✨ Cédula del Representante Legal verificada por ARIA (${repNomCompleto || res.identificacion})`);
        setMostrarLogDetallado(true);
      } else {
        setErrorValidacion(res.mensaje || "No se pudo extraer la cédula del representante.");
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
        setArchivoNombramiento({
          nombre: file.name,
          base64,
          mimetype: file.type || "application/pdf",
          tamano: file.size,
          resultadoOcr: res,
        });

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

    if (tipoPersoneria === "natural") {
      if (!nombres || !apellidos) {
        setErrorValidacion("Nombres y Apellidos son obligatorios para personas naturales.");
        return;
      }
      if (!archivoCedulaNatural && !omitirValidacionAlgoritmo) {
        setErrorValidacion("⚠️ La Cédula de Identidad es obligatoria para Persona Natural. Sube el documento para que ARIA lo analice y archive en la Billetera Digital (o activa la casilla 'Omitir validación por excepción').");
        return;
      }
    }

    if (tipoPersoneria === "juridica") {
      if (!razonSocial) {
        setErrorValidacion("La Razón Social es obligatoria para personas jurídicas.");
        return;
      }
      if (!archivoRepCedula && !omitirValidacionAlgoritmo) {
        setErrorValidacion("⚠️ La Cédula de Identidad del Representante Legal es obligatoria para Empresas. Súbela en la sección de documentos (o activa 'Omitir validación por excepción').");
        return;
      }
      if (!archivoNombramiento && !omitirValidacionAlgoritmo) {
        setErrorValidacion("⚠️ El Nombramiento inscrito de Representante Legal es obligatorio para Empresas. Súbelo en la sección de documentos (o activa 'Omitir validación por excepción').");
        return;
      }
    }

    startTransition(async () => {
      try {
        // Empaquetar documentos que serán archivados en la Billetera Digital
        const docsParaBilletera: DocumentoBilleteraCarga[] = [];

        if (tipoPersoneria === "natural" && archivoCedulaNatural) {
          docsParaBilletera.push({
            categoria: "identidad",
            tipo: tipoIdentificacion === "pasaporte" ? "PASAPORTE" : "CEDULA",
            titulo: `${tipoIdentificacion === "pasaporte" ? "Pasaporte" : "Cédula de Identidad"} - ${nombres} ${apellidos}`.trim(),
            archivoNombre: archivoCedulaNatural.nombre,
            archivoBase64: archivoCedulaNatural.base64,
            archivoMimetype: archivoCedulaNatural.mimetype,
            archivoTamano: archivoCedulaNatural.tamano,
            numeroDocumento: identificacion.trim(),
            titularNombre: `${nombres} ${apellidos}`.trim(),
            titularIdentificacion: identificacion.trim(),
            fechaNacimiento: fechaNacimiento || undefined,
            fechaCaducidad: fechaExpiracionDocumento || undefined,
            metadatosOcr: archivoCedulaNatural.resultadoOcr || {},
            detalles: {
              nacionalidad,
              estado_civil: estadoCivil,
              conyuge: conyuge || null,
              lugar_nacimiento: lugarNacimiento || null,
              sexo,
            }
          });
        }

        if (tipoPersoneria === "juridica") {
          if (archivoRepCedula) {
            docsParaBilletera.push({
              categoria: "identidad",
              tipo: "CEDULA",
              titulo: `Cédula de Identidad del Representante Legal - ${repNombres || "Representante"}`,
              archivoNombre: archivoRepCedula.nombre,
              archivoBase64: archivoRepCedula.base64,
              archivoMimetype: archivoRepCedula.mimetype,
              archivoTamano: archivoRepCedula.tamano,
              numeroDocumento: repCedula.trim(),
              titularNombre: repNombres.trim(),
              titularIdentificacion: repCedula.trim(),
              metadatosOcr: archivoRepCedula.resultadoOcr || {},
              detalles: {
                cargo: repCargo,
                empresa_ruc: identificacion.trim(),
                empresa_razon_social: razonSocial.trim(),
              }
            });
          }

          if (archivoNombramiento) {
            docsParaBilletera.push({
              categoria: "profesional",
              tipo: "NOMBRAMIENTO_REP_LEGAL",
              titulo: `Nombramiento Representante Legal (${repCargo || "Gerente General"}) - ${razonSocial || "Empresa"}`,
              archivoNombre: archivoNombramiento.nombre,
              archivoBase64: archivoNombramiento.base64,
              archivoMimetype: archivoNombramiento.mimetype,
              archivoTamano: archivoNombramiento.tamano,
              numeroDocumento: identificacion.trim(), // RUC
              titularNombre: repNombres.trim(),
              titularIdentificacion: repCedula.trim(),
              fechaCaducidad: repVencimientoNombramiento || undefined,
              metadatosOcr: archivoNombramiento.resultadoOcr || {},
              detalles: {
                cargo: repCargo,
                ruc_empresa: identificacion.trim(),
                fecha_vencimiento: repVencimientoNombramiento || null,
              }
            });
          }

          if (archivoRucSRI) {
            docsParaBilletera.push({
              categoria: "identidad",
              tipo: "RUC",
              titulo: `Certificado RUC SRI - ${razonSocial || "Empresa"}`,
              archivoNombre: archivoRucSRI.nombre,
              archivoBase64: archivoRucSRI.base64,
              archivoMimetype: archivoRucSRI.mimetype,
              archivoTamano: archivoRucSRI.tamano,
              numeroDocumento: identificacion.trim(),
              titularNombre: razonSocial.trim(),
              titularIdentificacion: identificacion.trim(),
              metadatosOcr: archivoRucSRI.resultadoOcr || {},
            });
          }
        }

        const datos: DatosCreacionCliente = {
          tipoPersoneria,
          tipoIdentificacion,
          identificacion: identificacion.trim(),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          razonSocial: razonSocial.trim(),
          nombreComercial: nombreComercial.trim(),
          actividadEconomica: actividadEconomica.trim() || undefined,
          // Datos de Filiación y Cédula
          nacionalidad: tipoPersoneria === "natural" ? (nacionalidad.trim() || "ECUATORIANA") : undefined,
          fechaNacimiento: tipoPersoneria === "natural" ? (fechaNacimiento.trim() || undefined) : undefined,
          lugarNacimiento: tipoPersoneria === "natural" ? (lugarNacimiento.trim() || undefined) : undefined,
          sexo: tipoPersoneria === "natural" ? (sexo.trim() || undefined) : undefined,
          estadoCivil: tipoPersoneria === "natural" ? (estadoCivil.trim() || undefined) : undefined,
          conyuge: tipoPersoneria === "natural" ? (conyuge.trim() || undefined) : undefined,
          fechaExpiracionDocumento: fechaExpiracionDocumento.trim() || undefined,
          // Contacto y Domicilio
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
          documentosBilletera: docsParaBilletera.length > 0 ? docsParaBilletera : undefined,
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

          {/* Banner de Carga con ARIA OCR y Billetera Digital */}
          {tipoPersoneria === "natural" ? (
            archivoCedulaNatural ? (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1.5px solid #86EFAC",
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
                  <div style={{ background: "#DCFCE7", padding: "8px", borderRadius: "8px", color: "#16A34A" }}>
                    <Wallet size={20} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
                        Cédula de Identidad Cargada (Requisito Obligatorio)
                      </p>
                      <span style={{ background: "#DCFCE7", color: "#15803D", fontSize: "0.68rem", fontWeight: 700, padding: "1px 6px", borderRadius: "4px" }}>
                        En Billetera Digital
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#475569" }}>
                      📄 {archivoCedulaNatural.nombre} ({(archivoCedulaNatural.tamano / 1024).toFixed(1)} KB) · Extraído y certificado por ARIA
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <label
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #86EFAC",
                      color: "#15803D",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Upload size={12} />
                    Reemplazar
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={manejarCargaArchivoId}
                      style={{ display: "none" }}
                      disabled={procesandoAriaId}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setArchivoCedulaNatural(null)}
                    style={{
                      background: "#FEE2E2",
                      border: "1px solid #FCA5A5",
                      color: "#B91C1C",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Quitar archivo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ) : (
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0F172A" }}>
                        Cédula de Identidad (Requisito Obligatorio · Billetera Digital)
                      </p>
                      <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: "0.68rem", fontWeight: 700, padding: "1px 6px", borderRadius: "4px" }}>
                        Obligatorio
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                      Sube la cédula en PDF o imagen: ARIA autocompletará el formulario y la archivará en la Billetera Digital del cliente.
                    </p>
                  </div>
                </div>
                <label
                  style={{
                    background: "#0284C7",
                    color: "#FFFFFF",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  <Upload size={14} />
                  {procesandoAriaId ? "Analizando con ARIA..." : "Cargar Cédula de Identidad"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={manejarCargaArchivoId}
                    style={{ display: "none" }}
                    disabled={procesandoAriaId}
                  />
                </label>
              </div>
            )
          ) : (
            /* Banner para Persona Jurídica */
            <div
              style={{
                border: "1px solid #BAE6FD",
                background: "#F0F9FF",
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
                  <Building2 size={20} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0369A1" }}>
                    Registro de Empresa / Persona Jurídica (S.A.S., Cía. Ltda., S.A.)
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#475569" }}>
                    Requisitos obligatorios: Identificación del Representante Legal y Nombramiento Vigente Inscrito en Registro Mercantil.
                  </p>
                </div>
              </div>
              <label
                style={{
                  background: "#0284C7",
                  color: "#FFFFFF",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Upload size={13} />
                {procesandoAriaId ? "Analizando..." : "Cargar RUC SRI (Opcional)"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={manejarCargaArchivoId}
                  style={{ display: "none" }}
                  disabled={procesandoAriaId}
                />
              </label>
            </div>
          )}

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
                  await evaluarDuplicadosYPlanes(val, correo);
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

          {/* Bloque de Advertencias: Usuario Web Registrado, Plan Activo o Duplicados */}
          {resVerificacion && (resVerificacion.esUsuarioWeb || resVerificacion.tienePlanActivo || resVerificacion.clienteCRM) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {resVerificacion.esUsuarioWeb && (
                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <UserCheck size={18} style={{ color: "#2563EB", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#1E3A8A" }}>Usuario Web Registrado en la Plataforma</div>
                    <div style={{ color: "#1E40AF", marginTop: "2px" }}>
                      Cuenta activa asociada a <strong>{resVerificacion.usuarioWeb?.correo}</strong> ({resVerificacion.usuarioWeb?.nombreCompleto}). Su ficha en el CRM quedará vinculada automáticamente a su acceso web.
                    </div>
                  </div>
                </div>
              )}

              {resVerificacion.tienePlanActivo && resVerificacion.planActivo && (
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <Sparkles size={18} style={{ color: "#16A34A", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#14532D" }}>
                      ✨ Plan Activo Vigente: {resVerificacion.planActivo.planNombre}
                    </div>
                    <div style={{ color: "#15803D", marginTop: "2px" }}>
                      Modalidad <strong>{resVerificacion.planActivo.frecuencia}</strong> ({resVerificacion.planActivo.esGratuito ? "Suscripción Gratuita $0.00" : `$${resVerificacion.planActivo.monto.toFixed(2)}`})
                      {resVerificacion.planActivo.consultasDisponibles !== null && (
                        <span> • <strong>{resVerificacion.planActivo.consultasDisponibles}</strong> consulta(s) disponibles este periodo</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {resVerificacion.clienteCRM && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <AlertTriangle size={18} style={{ color: "#D97706", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#78350F" }}>Cliente ya Registrado en el CRM Legal</div>
                    <div style={{ color: "#92400E", marginTop: "2px" }}>
                      Ficha registrada a nombre de <strong>{resVerificacion.clienteCRM.clp_razon_social || `${resVerificacion.clienteCRM.clp_nombres || ""} ${resVerificacion.clienteCRM.clp_apellidos || ""}`.trim()}</strong> (ID: {resVerificacion.clienteCRM.clp_identificacion}).
                    </div>
                  </div>
                </div>
              )}
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

              {/* Datos de Filiación, Cédula y Registro Civil (Requisitos Básicos y Opcionales) */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px", background: "#F8FAFC", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1E293B", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Scale size={14} color="#0284C7" /> Datos de Identidad, Cédula & Registro Civil
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                    Requisitos para validez procesal y escrituras notariales
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  {/* Nacionalidad (Obligatorio) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        Nacionalidad *
                      </label>
                      <IndicadorOrigenCampo
                        esAria={camposAria["nacionalidad"]}
                        esModificado={camposModificados["nacionalidad"]}
                      />
                    </div>
                    <input
                      type="text"
                      value={nacionalidad}
                      onChange={(e) => {
                        setNacionalidad(e.target.value);
                        marcarCampoModificado("nacionalidad");
                      }}
                      placeholder="ECUATORIANA"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["nacionalidad"] && !camposModificados["nacionalidad"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["nacionalidad"] && !camposModificados["nacionalidad"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>

                  {/* Fecha de Nacimiento (Obligatorio) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        Fecha de Nacimiento *
                      </label>
                      <IndicadorOrigenCampo
                        esAria={camposAria["fechaNacimiento"]}
                        esModificado={camposModificados["fechaNacimiento"]}
                      />
                    </div>
                    <input
                      type="date"
                      value={fechaNacimiento}
                      onChange={(e) => {
                        setFechaNacimiento(e.target.value);
                        marcarCampoModificado("fechaNacimiento");
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["fechaNacimiento"] && !camposModificados["fechaNacimiento"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["fechaNacimiento"] && !camposModificados["fechaNacimiento"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>

                  {/* Estado Civil (Obligatorio) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        Estado Civil *
                      </label>
                      <IndicadorOrigenCampo
                        esAria={camposAria["estadoCivil"]}
                        esModificado={camposModificados["estadoCivil"]}
                      />
                    </div>
                    <select
                      value={estadoCivil}
                      onChange={(e) => {
                        setEstadoCivil(e.target.value);
                        marcarCampoModificado("estadoCivil");
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["estadoCivil"] && !camposModificados["estadoCivil"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["estadoCivil"] && !camposModificados["estadoCivil"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    >
                      <option value="SOLTERO">SOLTERO(A)</option>
                      <option value="CASADO">CASADO(A)</option>
                      <option value="UNION DE HECHO">UNIÓN DE HECHO</option>
                      <option value="DIVORCIADO">DIVORCIADO(A)</option>
                      <option value="VIUDO">VIUDO(A)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  {/* Cónyuge / Conviviente (Condicional / Recomendado si Casado o Unión de Hecho) */}
                  {(estadoCivil === "CASADO" || estadoCivil === "UNION DE HECHO" || conyuge) && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                          Cónyuge / Conviviente {estadoCivil === "CASADO" ? "(Sociedad Conyugal) *" : "(Opcional)"}
                        </label>
                        <IndicadorOrigenCampo
                          esAria={camposAria["conyuge"]}
                          esModificado={camposModificados["conyuge"]}
                        />
                      </div>
                      <input
                        type="text"
                        value={conyuge}
                        onChange={(e) => {
                          setConyuge(e.target.value);
                          marcarCampoModificado("conyuge");
                        }}
                        placeholder="NOMBRES Y APELLIDOS DEL CÓNYUGE"
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: camposAria["conyuge"] && !camposModificados["conyuge"]
                            ? "1.5px solid #10B981"
                            : "1px solid #CBD5E1",
                          background: camposAria["conyuge"] && !camposModificados["conyuge"]
                            ? "#F0FDF4"
                            : "#FFFFFF",
                          fontSize: "0.82rem"
                        }}
                      />
                    </div>
                  )}

                  {/* Sexo / Género (Opcional) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        Sexo / Género (Opcional)
                      </label>
                      <IndicadorOrigenCampo
                        esAria={camposAria["sexo"]}
                        esModificado={camposModificados["sexo"]}
                      />
                    </div>
                    <select
                      value={sexo}
                      onChange={(e) => {
                        setSexo(e.target.value);
                        marcarCampoModificado("sexo");
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["sexo"] && !camposModificados["sexo"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["sexo"] && !camposModificados["sexo"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    >
                      <option value="HOMBRE">HOMBRE</option>
                      <option value="MUJER">MUJER</option>
                      <option value="NO ESPECIFICA">NO ESPECIFICA / OTRO</option>
                    </select>
                  </div>

                  {/* Lugar de Nacimiento (Opcional) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        Lugar de Nacimiento (Opcional)
                      </label>
                      <IndicadorOrigenCampo
                        esAria={camposAria["lugarNacimiento"]}
                        esModificado={camposModificados["lugarNacimiento"]}
                      />
                    </div>
                    <input
                      type="text"
                      value={lugarNacimiento}
                      onChange={(e) => {
                        setLugarNacimiento(e.target.value);
                        marcarCampoModificado("lugarNacimiento");
                      }}
                      placeholder="PICHINCHA / QUITO"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["lugarNacimiento"] && !camposModificados["lugarNacimiento"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["lugarNacimiento"] && !camposModificados["lugarNacimiento"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>

                  {/* Fecha de Vencimiento Documento (Opcional) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                        Vencimiento Cédula (Opcional)
                      </label>
                      <IndicadorOrigenCampo
                        esAria={camposAria["fechaExpiracionDocumento"]}
                        esModificado={camposModificados["fechaExpiracionDocumento"]}
                      />
                    </div>
                    <input
                      type="date"
                      value={fechaExpiracionDocumento}
                      onChange={(e) => {
                        setFechaExpiracionDocumento(e.target.value);
                        marcarCampoModificado("fechaExpiracionDocumento");
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["fechaExpiracionDocumento"] && !camposModificados["fechaExpiracionDocumento"]
                          ? "1.5px solid #10B981"
                          : "1px solid #CBD5E1",
                        background: camposAria["fechaExpiracionDocumento"] && !camposModificados["fechaExpiracionDocumento"]
                          ? "#F0FDF4"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>
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

              {/* Bóveda de Documentación Obligatoria de la Empresa (Billetera Digital) */}
              <div style={{ border: "1.5px solid #BAE6FD", borderRadius: "12px", padding: "14px", background: "#F0F9FF", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0369A1", display: "flex", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={18} />
                    Documentación Legal Obligatoria de la Empresa (Billetera Digital)
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#0369A1", fontWeight: 600, background: "#E0F2FE", padding: "2px 8px", borderRadius: "6px" }}>
                    Cédula + Nombramiento Inscrito
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {/* Tarjeta A: Cédula del Representante Legal (Obligatorio) */}
                  <div style={{ background: "#FFFFFF", border: archivoRepCedula ? "1.5px solid #86EFAC" : "1.5px dashed #38BDF8", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0F172A" }}>
                          1. Cédula del Representante *
                        </span>
                        <span style={{ background: archivoRepCedula ? "#DCFCE7" : "#FEF3C7", color: archivoRepCedula ? "#15803D" : "#92400E", fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: "4px" }}>
                          {archivoRepCedula ? "Cargada" : "Obligatorio"}
                        </span>
                      </div>
                    </div>

                    {archivoRepCedula ? (
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: "#475569" }}>
                          📄 {archivoRepCedula.nombre} ({(archivoRepCedula.tamano / 1024).toFixed(1)} KB)
                        </p>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <label style={{ background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Upload size={11} /> Reemplazar
                            <input type="file" accept="image/*,application/pdf" onChange={manejarCargaArchivoRepCedula} style={{ display: "none" }} disabled={procesandoAriaRepCedula} />
                          </label>
                          <button type="button" onClick={() => setArchivoRepCedula(null)} style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#B91C1C", padding: "4px 6px", borderRadius: "6px", cursor: "pointer" }} title="Quitar archivo">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "#64748B" }}>
                          Sube la cédula o pasaporte del representante legal para extracción y archivo seguro.
                        </p>
                        <label style={{ background: "#0284C7", color: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Upload size={12} />
                          {procesandoAriaRepCedula ? "Analizando..." : "Cargar Cédula Representante"}
                          <input type="file" accept="image/*,application/pdf" onChange={manejarCargaArchivoRepCedula} style={{ display: "none" }} disabled={procesandoAriaRepCedula} />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta B: Nombramiento Inscrito en Registro Mercantil (Obligatorio) */}
                  <div style={{ background: "#FFFFFF", border: archivoNombramiento ? "1.5px solid #86EFAC" : "1.5px dashed #38BDF8", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0F172A" }}>
                          2. Nombramiento Inscrito *
                        </span>
                        <span style={{ background: archivoNombramiento ? "#DCFCE7" : "#FEF3C7", color: archivoNombramiento ? "#15803D" : "#92400E", fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: "4px" }}>
                          {archivoNombramiento ? "Cargado" : "Obligatorio"}
                        </span>
                      </div>
                    </div>

                    {archivoNombramiento ? (
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: "#475569" }}>
                          📄 {archivoNombramiento.nombre} ({(archivoNombramiento.tamano / 1024).toFixed(1)} KB)
                        </p>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <label style={{ background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Upload size={11} /> Reemplazar
                            <input type="file" accept="application/pdf,image/*" onChange={manejarCargaNombramiento} style={{ display: "none" }} disabled={procesandoAriaNom} />
                          </label>
                          <button type="button" onClick={() => setArchivoNombramiento(null)} style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#B91C1C", padding: "4px 6px", borderRadius: "6px", cursor: "pointer" }} title="Quitar archivo">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "#64748B" }}>
                          Sube el nombramiento inscrito para certificar el cargo, periodo y facultades estatutarias.
                        </p>
                        <label style={{ background: "#0284C7", color: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Upload size={12} />
                          {procesandoAriaNom ? "Analizando..." : "Cargar Nombramiento PDF"}
                          <input type="file" accept="application/pdf,image/*" onChange={manejarCargaNombramiento} style={{ display: "none" }} disabled={procesandoAriaNom} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges de Estado OCR */}
                {(badgeAriaRepCedula || badgeAriaNom) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                    {badgeAriaRepCedula && (
                      <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem" }}>
                        {badgeAriaRepCedula}
                      </div>
                    )}
                    {badgeAriaNom && (
                      <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem" }}>
                        {badgeAriaNom}
                      </div>
                    )}
                  </div>
                )}

                {/* Campos Formulario del Representante Legal */}
                <div style={{ borderTop: "1px solid #BAE6FD", paddingTop: "10px", marginTop: "2px" }}>
                  <span style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#0369A1", marginBottom: "8px" }}>
                    Datos del Representante Legal Mapeados
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "#475569" }}>
                          Nombres del Representante *
                        </label>
                        <IndicadorOrigenCampo esAria={camposAria["repNombres"]} esModificado={camposModificados["repNombres"]} />
                      </div>
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "#475569" }}>
                          Cédula / Pasaporte *
                        </label>
                        <IndicadorOrigenCampo esAria={camposAria["repCedula"]} esModificado={camposModificados["repCedula"]} />
                      </div>
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "#475569" }}>
                          Cargo Estatutario
                        </label>
                        <IndicadorOrigenCampo esAria={camposAria["repCargo"]} esModificado={camposModificados["repCargo"]} />
                      </div>
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "#475569" }}>
                          Vigencia Nombramiento (Calculada / Mercantil)
                        </label>
                        <IndicadorOrigenCampo esAria={camposAria["repVencimientoNombramiento"]} esModificado={camposModificados["repVencimientoNombramiento"]} />
                      </div>
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
                onChange={async (e) => {
                  const val = e.target.value;
                  setCorreo(val);
                  marcarCampoModificado("correo");
                  await evaluarDuplicadosYPlanes(identificacion, val);
                }}
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

          {/* Banner de Sincronización con Billetera Digital */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.74rem",
              color: "#475569",
            }}
          >
            <Wallet size={15} color="#0284C7" />
            <span>
              <strong>Billetera Digital Activa:</strong> Todos los documentos cargados (cédulas, nombramiento, RUC) serán cifrados y guardados en la bóveda digital personal del cliente para emisión inmediata de poderes, minutas y contratos.
            </span>
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
