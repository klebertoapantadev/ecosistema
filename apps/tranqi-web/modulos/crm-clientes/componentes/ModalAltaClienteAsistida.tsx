"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X, User, Building2, ShieldCheck, AlertTriangle, Sparkles, Upload,
  CheckCircle2, Scale, Check, Eye,
  Copy, ChevronDown, ChevronUp,
  UserCheck, Wallet,
  Trash2, RotateCcw, Edit3
} from "lucide-react";
import {
  analizarIdentificacionConAria,
  analizarNombramientoConAria,
  verificarDuplicado,
  verificarConflictoIntereses,
  crearClienteManual,
  actualizarClienteCRMAction,
  type DatosCreacionCliente,
  type DocumentoBilleteraCarga,
  type ResultadoAriaIdentificacion,
  type ResultadoAriaNombramiento,
  type ItemLogExtraccionAria,
  type ResultadoVerificacionCliente,
} from "../acciones";

interface ClienteEditarCRM {
  clp_id: string;
  clp_usuario_id?: string | null;
  clp_tipo_personeria?: string | null;
  clp_tipo_identificacion?: string | null;
  clp_identificacion?: string | null;
  clp_nombres?: string | null;
  clp_apellidos?: string | null;
  clp_razon_social?: string | null;
  clp_nombre_comercial?: string | null;
  clp_correo?: string | null;
  clp_celular?: string | null;
  clp_telefono?: string | null;
  clp_direccion?: string | null;
  clp_casillero_judicial?: string | null;
  clp_casillero_electronico?: string | null;
  clp_detalle_cliente?: {
    nacionalidad?: string | null;
    fecha_nacimiento?: string | null;
    lugar_nacimiento?: string | null;
    sexo?: string | null;
    estado_civil?: string | null;
    conyuge?: string | null;
    fecha_expiracion_documento?: string | null;
    actividad_economica?: string | null;
    representante_legal?: {
      nombres?: string;
      cedula?: string;
      cargo?: string;
      nombramientoVence?: string;
      correo?: string;
      celular?: string;
    } | null;
    apoderado_persona_natural?: {
      nombres?: string;
      cedula?: string;
      calidadPoder?: string;
      notariaVigencia?: string;
    } | null;
    [key: string]: unknown;
  } | null;
}

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  clienteAEditar?: ClienteEditarCRM | null;
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
  resultadoOcr?: ResultadoAriaIdentificacion | ResultadoAriaNombramiento | Record<string, unknown>;
}

function IndicadorOrigenCampo({ esAria, esModificado }: { esAria?: boolean; esModificado?: boolean }) {
  if (esAria && !esModificado) {
    return (
      <span
        title="Dato extraído y mapeado automáticamente por Tranqi OCR"
        style={{
          background: "var(--exito-diluido)",
          color: "var(--exito-texto)",
          border: "1px solid var(--exito-linea)",
          borderRadius: "4px",
          padding: "1px 6px",
          fontSize: "0.68rem",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: "3px"
        }}
      >
        <Sparkles size={10} /> Leído por Tranqi
      </span>
    );
  }
  if (esModificado) {
    return (
      <span
        title="Dato ingresado o modificado manualmente"
        style={{
          background: "var(--fondo-hundido)",
          color: "var(--texto-2)",
          border: "1px solid var(--linea-fuerte)",
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

export function ModalAltaClienteAsistida({ abierto, alCerrar, clienteAEditar, alGuardarExitoso }: Props) {
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

  // Precargar datos si se abre en modo edición
  useEffect(() => {
    if (clienteAEditar) {
      setTipoPersoneria((clienteAEditar.clp_tipo_personeria || "natural") as "natural" | "juridica");
      setTipoIdentificacion((clienteAEditar.clp_tipo_identificacion || "cedula") as "cedula" | "ruc" | "pasaporte");
      setIdentificacion(clienteAEditar.clp_identificacion || "");
      setNombres(clienteAEditar.clp_nombres || "");
      setApellidos(clienteAEditar.clp_apellidos || "");
      setRazonSocial(clienteAEditar.clp_razon_social || "");
      setNombreComercial(clienteAEditar.clp_nombre_comercial || "");
      setCorreo(clienteAEditar.clp_correo || "");
      setCelular(clienteAEditar.clp_celular || "");
      setTelefono(clienteAEditar.clp_telefono || "");
      setDireccion(clienteAEditar.clp_direccion || "");
      setCasilleroJudicial(clienteAEditar.clp_casillero_judicial || "");
      setCasilleroElectronico(clienteAEditar.clp_casillero_electronico || "");

      const det = clienteAEditar.clp_detalle_cliente || {};
      setNacionalidad(det.nacionalidad || "ECUATORIANA");
      setFechaNacimiento(det.fecha_nacimiento || "");
      setLugarNacimiento(det.lugar_nacimiento || "");
      setSexo(det.sexo || "HOMBRE");
      setEstadoCivil(det.estado_civil || "SOLTERO");
      setConyuge(det.conyuge || "");
      setFechaExpiracionDocumento(det.fecha_expiracion_documento || "");
      setActividadEconomica(det.actividad_economica || "");

      if (det.representante_legal) {
        setRepNombres(det.representante_legal.nombres || "");
        setRepCedula(det.representante_legal.cedula || "");
        setRepCargo(det.representante_legal.cargo || "Gerente General");
        setRepVencimientoNombramiento(det.representante_legal.nombramientoVence || "");
        setRepCorreo(det.representante_legal.correo || "");
        setRepCelular(det.representante_legal.celular || "");
      }

      if (det.apoderado_persona_natural) {
        setTieneApoderadoNatural(true);
        setApoNombres(det.apoderado_persona_natural.nombres || "");
        setApoCedula(det.apoderado_persona_natural.cedula || "");
        setApoCalidadPoder(det.apoderado_persona_natural.calidadPoder || "Apoderado General");
        setApoNotariaVigencia(det.apoderado_persona_natural.notariaVigencia || "");
      }
    }
  }, [clienteAEditar]);

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
  const [_avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
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

        setBadgeAriaId(`✨ Tranqi OCR: ${total} datos identificados (${numMapeados} mapeados al formulario · ${res.confianza}% confianza)`);
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
        setBadgeAriaRepCedula(`✨ Cédula del Representante Legal verificada por Tranqi (${repNomCompleto || res.identificacion})`);
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
        setBadgeAriaNom(`✨ Nombramiento Mercantil Vigente certificado por Tranqi (Vence: ${res.fechaVencimientoCalculada || "2 años"})`);
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

  // Limpiar y resetear el formulario completo a su estado inicial
  const limpiarFormulario = () => {
    setTipoPersoneria("natural");
    setTipoIdentificacion("cedula");
    setIdentificacion("");
    setNombres("");
    setApellidos("");
    setRazonSocial("");
    setNombreComercial("");
    setActividadEconomica("");
    setNacionalidad("ECUATORIANA");
    setFechaNacimiento("");
    setLugarNacimiento("");
    setSexo("HOMBRE");
    setEstadoCivil("SOLTERO");
    setConyuge("");
    setFechaExpiracionDocumento("");
    setCorreo("");
    setCelular("");
    setTelefono("");
    setDireccion("");
    setCasilleroJudicial("");
    setCasilleroElectronico("");
    setRepNombres("");
    setRepCedula("");
    setRepCargo("Gerente General");
    setRepVencimientoNombramiento("");
    setRepCorreo("");
    setRepCelular("");
    setNombramientoValidadoAria(false);
    setTieneApoderadoNatural(false);
    setApoNombres("");
    setApoCedula("");
    setApoCalidadPoder("Apoderado General");
    setApoNotariaVigencia("");
    setContraparteNombres("");
    setContraparteIdentificacion("");
    setAlertaConflicto(null);
    setOmitirValidacionAlgoritmo(false);
    setMotivoExcepcion("");
    setArchivoCedulaNatural(null);
    setArchivoRepCedula(null);
    setArchivoNombramiento(null);
    setArchivoRucSRI(null);
    setBadgeAriaId(null);
    setBadgeAriaNom(null);
    setBadgeAriaRepCedula(null);
    setErrorValidacion(null);
    setAvisoDuplicado(null);
    setResVerificacion(null);
    setMetadatosAria(null);
    setLogExtraccionAria([]);
    setMostrarLogDetallado(false);
    setCamposAria({});
    setCamposModificados({});
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
      if (!archivoCedulaNatural && !omitirValidacionAlgoritmo && !clienteAEditar) {
        setErrorValidacion("⚠️ La Cédula de Identidad es obligatoria para Persona Natural. Sube el documento para que Tranqi lo analice y archive en la Billetera Digital (o activa la casilla 'Omitir validación por excepción').");
        return;
      }
    }

    if (tipoPersoneria === "juridica") {
      if (!razonSocial) {
        setErrorValidacion("La Razón Social es obligatoria para personas jurídicas.");
        return;
      }
      if (!archivoRepCedula && !omitirValidacionAlgoritmo && !clienteAEditar) {
        setErrorValidacion("⚠️ La Cédula de Identidad del Representante Legal es obligatoria para Empresas. Súbela en la sección de documentos (o activa 'Omitir validación por excepción').");
        return;
      }
      if (!archivoNombramiento && !omitirValidacionAlgoritmo && !clienteAEditar) {
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
            metadatosOcr: (archivoCedulaNatural.resultadoOcr || {}) as Record<string, unknown>,
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
              metadatosOcr: (archivoRepCedula.resultadoOcr || {}) as Record<string, unknown>,
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
              metadatosOcr: (archivoNombramiento.resultadoOcr || {}) as Record<string, unknown>,
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
              metadatosOcr: (archivoRucSRI.resultadoOcr || {}) as Record<string, unknown>,
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

        if (clienteAEditar?.clp_id) {
          const res = await actualizarClienteCRMAction(clienteAEditar.clp_id, datos);
          if (!res.ok) {
            setErrorValidacion(res.error || "Error al actualizar cliente.");
            return;
          }
          limpiarFormulario();
          alGuardarExitoso({
            clienteId: clienteAEditar.clp_id,
            usuarioId: clienteAEditar.clp_usuario_id || "",
            nombreCompleto: datos.tipoPersoneria === "juridica" ? (datos.razonSocial || datos.identificacion) : `${datos.nombres} ${datos.apellidos}`.trim(),
            identificacion: datos.identificacion,
            accionContinuidad,
          });
        } else {
          const res = await crearClienteManual(datos);
          if (!res.ok) {
            setErrorValidacion(res.error || "Error al registrar cliente.");
            return;
          }
          limpiarFormulario();
          alGuardarExitoso({
            clienteId: res.clienteId || "",
            usuarioId: res.usuarioId || "",
            nombreCompleto: res.nombreCompleto || "",
            identificacion: res.identificacion || "",
            accionContinuidad,
          });
        }
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        setErrorValidacion(mensaje || "Error al procesar la solicitud.");
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
            borderBottom: "1px solid var(--linea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--fondo-suave)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--texto)", display: "flex", alignItems: "center", gap: "8px" }}>
              {clienteAEditar ? <Edit3 size={20} color="var(--acento)" /> : <Scale size={20} color="var(--acento)" />}
              {clienteAEditar ? "Editar Datos del Cliente · CRM Jurídico" : "Alta Manual Asistida de Cliente · CRM Jurídico"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--texto-suave)" }}>
              {clienteAEditar ? `Actualizando ficha de ${clienteAEditar.clp_identificacion}` : "Ingreso para Personas Naturales, Empresas, Representantes y Litigios Telemáticos"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={limpiarFormulario}
              title="Limpiar y vaciar todos los campos del formulario"
              style={{
                background: "var(--fondo-hundido)",
                border: "1px solid var(--linea-fuerte)",
                color: "var(--texto-2)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "0.78rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <RotateCcw size={13} />
              Limpiar Formulario
            </button>
            <button
              onClick={() => {
                limpiarFormulario();
                alCerrar();
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--texto-suave)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "50%",
              }}
            >
              <X size={20} />
            </button>
          </div>
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
                border: tipoPersoneria === "natural" ? "2px solid var(--acento)" : "1px solid var(--linea-fuerte)",
                background: tipoPersoneria === "natural" ? "var(--acento-diluido)" : "#FFFFFF",
                color: tipoPersoneria === "natural" ? "var(--acento-hondo)" : "var(--texto-2)",
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
                border: tipoPersoneria === "juridica" ? "2px solid var(--acento)" : "1px solid var(--linea-fuerte)",
                background: tipoPersoneria === "juridica" ? "var(--acento-diluido)" : "#FFFFFF",
                color: tipoPersoneria === "juridica" ? "var(--acento-hondo)" : "var(--texto-2)",
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
                  background: "var(--exito-diluido)",
                  border: "1.5px solid var(--exito-linea)",
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
                  <div style={{ background: "var(--exito-diluido)", padding: "8px", borderRadius: "8px", color: "var(--exito)" }}>
                    <Wallet size={20} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--exito-texto)" }}>
                        Cédula de Identidad Cargada (Requisito Obligatorio)
                      </p>
                      <span style={{ background: "var(--exito-diluido)", color: "var(--exito-texto)", fontSize: "0.68rem", fontWeight: 700, padding: "1px 6px", borderRadius: "4px" }}>
                        En Billetera Digital
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--texto-2)" }}>
                      📄 {archivoCedulaNatural.nombre} ({(archivoCedulaNatural.tamano / 1024).toFixed(1)} KB) · Extraído y certificado por Tranqi
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <label
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid var(--exito-linea)",
                      color: "var(--exito-texto)",
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
                      background: "var(--error-diluido)",
                      border: "1px solid var(--error-linea)",
                      color: "var(--error)",
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
                  border: "1.5px dashed var(--acento)",
                  background: "var(--fondo-suave)",
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
                  <div style={{ background: "var(--acento-diluido)", padding: "8px", borderRadius: "8px", color: "var(--acento)" }}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--texto)" }}>
                        Cédula de Identidad (Requisito Obligatorio · Billetera Digital)
                      </p>
                      <span style={{ background: "var(--aviso-diluido)", color: "var(--aviso-texto)", fontSize: "0.68rem", fontWeight: 700, padding: "1px 6px", borderRadius: "4px" }}>
                        Obligatorio
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--texto-suave)" }}>
                      Sube la cédula en PDF o imagen: Tranqi autocompletará el formulario y la archivará en la Billetera Digital del cliente.
                    </p>
                  </div>
                </div>
                <label
                  style={{
                    background: "var(--acento)",
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
                  {procesandoAriaId ? "Analizando con Tranqi..." : "Cargar Cédula de Identidad"}
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
                border: "1px solid var(--acento-linea)",
                background: "var(--acento-diluido)",
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
                <div style={{ background: "var(--acento-diluido)", padding: "8px", borderRadius: "8px", color: "var(--acento)" }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--acento-hondo)" }}>
                    Registro de Empresa / Persona Jurídica (S.A.S., Cía. Ltda., S.A.)
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--texto-2)" }}>
                    Requisitos obligatorios: Identificación del Representante Legal y Nombramiento Vigente Inscrito en Registro Mercantil.
                  </p>
                </div>
              </div>
              <label
                style={{
                  background: "var(--acento)",
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

          {/* Barra Compacta de Estado ARIA OCR (Log Desplegable Opcional) */}
          {(badgeAriaId || badgeAriaNom || badgeAriaRepCedula || logExtraccionAria.length > 0) && (
            <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", color: "var(--exito-texto)", padding: "8px 12px", borderRadius: "10px", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--exito)" />
                  {badgeAriaId || badgeAriaNom || badgeAriaRepCedula || `✨ ${logExtraccionAria.length} datos identificados y mapeados al formulario`}
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarLogDetallado(!mostrarLogDetallado)}
                  style={{
                    background: "var(--exito-diluido)",
                    border: "1px solid var(--exito-linea)",
                    color: "var(--exito-texto)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Eye size={12} />
                  {mostrarLogDetallado ? "Ocultar Datos Brutos" : `Ver Datos Brutos (${logExtraccionAria.length})`}
                  {mostrarLogDetallado ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* Panel Desplegable de Log de Extracción y Mapeo */}
              {mostrarLogDetallado && (
                <div style={{ background: "#FFFFFF", border: "1px solid var(--exito-linea)", borderRadius: "8px", padding: "10px", marginTop: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", borderBottom: "1px solid var(--linea)", paddingBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setFiltroLog("todos")}
                        style={{
                          background: filtroLog === "todos" ? "var(--acento)" : "var(--fondo-hundido)",
                          color: filtroLog === "todos" ? "#FFFFFF" : "var(--texto-2)",
                          border: "none",
                          borderRadius: "4px",
                          padding: "2px 7px",
                          fontSize: "0.7rem",
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
                          background: filtroLog === "mapeados" ? "var(--exito)" : "var(--fondo-hundido)",
                          color: filtroLog === "mapeados" ? "#FFFFFF" : "var(--texto-2)",
                          border: "none",
                          borderRadius: "4px",
                          padding: "2px 7px",
                          fontSize: "0.7rem",
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
                          background: filtroLog === "metadatos" ? "var(--acento)" : "var(--fondo-hundido)",
                          color: filtroLog === "metadatos" ? "#FFFFFF" : "var(--texto-2)",
                          border: "none",
                          borderRadius: "4px",
                          padding: "2px 7px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        🔵 Metadatos JSONB ({logExtraccionAria.filter(i => i.estado === "metadato_perfil_jsonb").length})
                      </button>
                    </div>
                  </div>

                  {logsFiltrados.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                      {logsFiltrados.map((item, idx) => {
                        const esMapeado = item.estado === "mapeado_formulario";
                        const claveUnica = `${item.campoDetectado}_${idx}`;
                        return (
                          <div
                            key={claveUnica}
                            style={{
                              background: esMapeado ? "var(--exito-diluido)" : "var(--fondo-suave)",
                              border: esMapeado ? "1px solid var(--exito-linea)" : "1px solid var(--linea)",
                              borderRadius: "6px",
                              padding: "6px 8px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "2px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: esMapeado ? "var(--exito-texto)" : "var(--texto-2)" }}>
                                {item.campoDetectado}
                              </span>
                              <span style={{ fontSize: "0.6rem", padding: "1px 4px", borderRadius: "3px", fontWeight: 700, background: esMapeado ? "var(--exito-diluido)" : "var(--acento-diluido)", color: esMapeado ? "var(--exito-texto)" : "var(--acento-hondo)" }}>
                                {esMapeado ? `➔ ${item.campoMapeadoEnFormulario}` : "JSONB"}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                              <strong style={{ fontSize: "0.74rem", color: "var(--texto)", wordBreak: "break-all" }}>
                                {item.valorOriginal}
                              </strong>
                              <button
                                type="button"
                                title="Copiar dato"
                                onClick={() => copiarAlPortapapeles(item.valorOriginal, claveUnica)}
                                style={{ background: "transparent", border: "none", color: copiadoId === claveUnica ? "var(--exito)" : "var(--texto-tenue)", cursor: "pointer", padding: "2px" }}
                              >
                                {copiadoId === claveUnica ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px", color: "var(--texto-suave)", fontSize: "0.72rem" }}>
                      No hay campos para el filtro seleccionado.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bloque de Advertencias: Usuario Web Registrado, Plan Activo o Duplicados */}
          {resVerificacion && (resVerificacion.esUsuarioWeb || resVerificacion.tienePlanActivo || resVerificacion.clienteCRM) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {resVerificacion.esUsuarioWeb && (
                <div style={{ background: "var(--acento-diluido)", border: "1px solid var(--acento-linea)", color: "var(--acento-hondo)", padding: "8px 12px", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <UserCheck size={16} style={{ color: "var(--acento)", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--acento-hondo)" }}>Usuario Web Registrado en la Plataforma</div>
                    <div style={{ color: "var(--acento-hondo)", marginTop: "1px" }}>
                      Cuenta activa asociada a <strong>{resVerificacion.usuarioWeb?.correo}</strong> ({resVerificacion.usuarioWeb?.nombreCompleto}). Su ficha en el CRM quedará vinculada automáticamente a su acceso web.
                    </div>
                  </div>
                </div>
              )}

              {resVerificacion.tienePlanActivo && resVerificacion.planActivo && (
                <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", color: "var(--exito-texto)", padding: "8px 12px", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <Sparkles size={16} style={{ color: "var(--exito)", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--exito-texto)" }}>
                      ✨ Plan Activo Vigente: {resVerificacion.planActivo.planNombre}
                    </div>
                    <div style={{ color: "var(--exito-texto)", marginTop: "1px" }}>
                      Modalidad <strong>{resVerificacion.planActivo.frecuencia}</strong> ({resVerificacion.planActivo.esGratuito ? "Suscripción Gratuita $0.00" : `$${resVerificacion.planActivo.monto.toFixed(2)}`})
                      {resVerificacion.planActivo.consultasDisponibles !== null && (
                        <span> • <strong>{resVerificacion.planActivo.consultasDisponibles}</strong> consulta(s) disponibles este periodo</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {resVerificacion.clienteCRM && (
                <div style={{ background: "var(--aviso-diluido)", border: "1px solid var(--aviso-linea)", color: "var(--aviso-texto)", padding: "8px 12px", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <AlertTriangle size={16} style={{ color: "var(--aviso)", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--aviso-texto)" }}>Cliente ya Registrado en el CRM Legal</div>
                    <div style={{ color: "var(--aviso-texto)", marginTop: "1px" }}>
                      Ficha registrada a nombre de <strong>{resVerificacion.clienteCRM.clp_razon_social || `${resVerificacion.clienteCRM.clp_nombres || ""} ${resVerificacion.clienteCRM.clp_apellidos || ""}`.trim()}</strong> (ID: {resVerificacion.clienteCRM.clp_identificacion}).
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: FORMULARIO PERSONA NATURAL (CIUDADANO) DIRECTAMENTE EDITABLE */}
          {/* ========================================================================= */}
          {tipoPersoneria === "natural" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Bloque 1: Identificación y Nombres Completos (Editable) */}
              <div style={{ border: "1px solid var(--linea)", borderRadius: "10px", padding: "12px 14px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--texto)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <User size={15} color="var(--acento)" /> Identificación y Nombres del Titular
                </span>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "3px" }}>
                      Tipo Documento
                    </label>
                    <select
                      value={tipoIdentificacion}
                      onChange={(e) => {
                        setTipoIdentificacion(e.target.value as "cedula" | "ruc" | "pasaporte");
                        marcarCampoModificado("tipoIdentificacion");
                      }}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.82rem" }}
                    >
                      <option value="cedula">Cédula de Identidad</option>
                      <option value="ruc">RUC Personal (13 dígitos)</option>
                      <option value="pasaporte">Pasaporte / Extranjería</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Número de Identificación *
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["identificacion"]} esModificado={camposModificados["identificacion"]} />
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
                      placeholder="1714898226"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["identificacion"] && !camposModificados["identificacion"]
                          ? "1px solid var(--exito-linea)"
                          : "1px solid var(--linea-fuerte)",
                        background: camposAria["identificacion"] && !camposModificados["identificacion"]
                          ? "var(--exito-diluido)"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Nombres *
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["nombres"]} esModificado={camposModificados["nombres"]} />
                    </div>
                    <input
                      type="text"
                      value={nombres}
                      onChange={(e) => {
                        setNombres(e.target.value);
                        marcarCampoModificado("nombres");
                      }}
                      placeholder="Como figuran en la cédula"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["nombres"] && !camposModificados["nombres"]
                          ? "1px solid var(--exito-linea)"
                          : "1px solid var(--linea-fuerte)",
                        background: camposAria["nombres"] && !camposModificados["nombres"]
                          ? "var(--exito-diluido)"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Apellidos *
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["apellidos"]} esModificado={camposModificados["apellidos"]} />
                    </div>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(e) => {
                        setApellidos(e.target.value);
                        marcarCampoModificado("apellidos");
                      }}
                      placeholder="Como figuran en la cédula"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: camposAria["apellidos"] && !camposModificados["apellidos"]
                          ? "1px solid var(--exito-linea)"
                          : "1px solid var(--linea-fuerte)",
                        background: camposAria["apellidos"] && !camposModificados["apellidos"]
                          ? "var(--exito-diluido)"
                          : "#FFFFFF",
                        fontSize: "0.82rem"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 2: Datos de Filiación, Cédula y Registro Civil (Editable) */}
              <div style={{ border: "1px solid var(--linea)", borderRadius: "10px", padding: "12px 14px", background: "var(--fondo-suave)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--texto)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Scale size={14} color="var(--acento)" /> Datos de Identidad, Cédula & Registro Civil
                </span>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                  {/* Nacionalidad */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Nacionalidad *
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["nacionalidad"]} esModificado={camposModificados["nacionalidad"]} />
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
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["nacionalidad"] && !camposModificados["nacionalidad"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["nacionalidad"] && !camposModificados["nacionalidad"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>

                  {/* Fecha de Nacimiento */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Fecha de Nacimiento *
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["fechaNacimiento"]} esModificado={camposModificados["fechaNacimiento"]} />
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
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["fechaNacimiento"] && !camposModificados["fechaNacimiento"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["fechaNacimiento"] && !camposModificados["fechaNacimiento"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>

                  {/* Lugar de Nacimiento */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Lugar de Nacimiento
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["lugarNacimiento"]} esModificado={camposModificados["lugarNacimiento"]} />
                    </div>
                    <input
                      type="text"
                      value={lugarNacimiento}
                      onChange={(e) => {
                        setLugarNacimiento(e.target.value);
                        marcarCampoModificado("lugarNacimiento");
                      }}
                      placeholder="PICHINCHA QUITO"
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["lugarNacimiento"] && !camposModificados["lugarNacimiento"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["lugarNacimiento"] && !camposModificados["lugarNacimiento"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                  {/* Sexo / Género */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Sexo / Género
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["sexo"]} esModificado={camposModificados["sexo"]} />
                    </div>
                    <select
                      value={sexo}
                      onChange={(e) => {
                        setSexo(e.target.value);
                        marcarCampoModificado("sexo");
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["sexo"] && !camposModificados["sexo"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["sexo"] && !camposModificados["sexo"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    >
                      <option value="HOMBRE">HOMBRE</option>
                      <option value="MUJER">MUJER</option>
                      <option value="NO ESPECIFICA">NO ESPECIFICA / OTRO</option>
                    </select>
                  </div>

                  {/* Estado Civil */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Estado Civil *
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["estadoCivil"]} esModificado={camposModificados["estadoCivil"]} />
                    </div>
                    <select
                      value={estadoCivil}
                      onChange={(e) => {
                        setEstadoCivil(e.target.value);
                        marcarCampoModificado("estadoCivil");
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["estadoCivil"] && !camposModificados["estadoCivil"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["estadoCivil"] && !camposModificados["estadoCivil"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    >
                      <option value="SOLTERO">SOLTERO(A)</option>
                      <option value="CASADO">CASADO(A)</option>
                      <option value="UNION DE HECHO">UNIÓN DE HECHO</option>
                      <option value="DIVORCIADO">DIVORCIADO(A)</option>
                      <option value="VIUDO">VIUDO(A)</option>
                    </select>
                  </div>

                  {/* Cónyuge / Conviviente */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Cónyuge / Conviviente
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["conyuge"]} esModificado={camposModificados["conyuge"]} />
                    </div>
                    <input
                      type="text"
                      value={conyuge}
                      onChange={(e) => {
                        setConyuge(e.target.value);
                        marcarCampoModificado("conyuge");
                      }}
                      placeholder="GUERRERO TORRES NANCY GIOCONDA"
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["conyuge"] && !camposModificados["conyuge"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["conyuge"] && !camposModificados["conyuge"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>

                  {/* Fecha de Expiración Cédula */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--texto-2)" }}>
                        Vencimiento Cédula
                      </label>
                      <IndicadorOrigenCampo esAria={camposAria["fechaExpiracionDocumento"]} esModificado={camposModificados["fechaExpiracionDocumento"]} />
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
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: camposAria["fechaExpiracionDocumento"] && !camposModificados["fechaExpiracionDocumento"] ? "1px solid var(--exito-linea)" : "1px solid var(--linea-fuerte)",
                        background: camposAria["fechaExpiracionDocumento"] && !camposModificados["fechaExpiracionDocumento"] ? "var(--exito-diluido)" : "#FFFFFF",
                        fontSize: "0.8rem"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Sección Opcional de Apoderado / Representante Legal en Persona Natural */}
              <div style={{ border: "1px solid var(--linea)", borderRadius: "10px", padding: "12px", background: "var(--fondo-suave)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 600, color: "var(--texto)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={tieneApoderadoNatural}
                    onChange={(e) => setTieneApoderadoNatural(e.target.checked)}
                  />
                  <span>Actúa mediante apoderado, tutor o representante legal</span>
                </label>
                <p style={{ margin: "2px 0 8px 24px", fontSize: "0.73rem", color: "var(--texto-suave)" }}>
                  Poder especial desde el exterior, menores en juicios de alimentos, tutores o albaceas.
                </p>

                {tieneApoderadoNatural && (
                  <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "3px" }}>
                        Nombre del apoderado o tutor
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Ab. Carlos Andrade M."
                        value={apoNombres}
                        onChange={(e) => setApoNombres(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "3px" }}>
                        Cédula o pasaporte
                      </label>
                      <input
                        type="text"
                        placeholder="1712345678"
                        value={apoCedula}
                        onChange={(e) => setApoCedula(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "3px" }}>
                        Tipo de representación
                      </label>
                      <select
                        value={apoCalidadPoder}
                        onChange={(e) => setApoCalidadPoder(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
                      >
                        <option value="Apoderado General">Apoderado General (Poder Amplio)</option>
                        <option value="Apoderado Especial">Apoderado Especial (Procuración Judicial)</option>
                        <option value="Representante Legal Menor">Representante Legal (Madre/Padre - Alimentos)</option>
                        <option value="Albacea Hereditario">Albacea / Administrador Hereditario</option>
                        <option value="Tutor o Curador">Tutor / Curador Judicial</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "3px" }}>
                        Notaría o consulado y vigencia
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Consulado Ecuador en Madrid / Notaría 5"
                        value={apoNotariaVigencia}
                        onChange={(e) => setApoNotariaVigencia(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
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
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--texto-2)" }}>
                      Razón social *
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
                    placeholder="Como figura en el RUC"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: camposAria["razonSocial"] && !camposModificados["razonSocial"]
                        ? "1px solid var(--exito-linea)"
                        : "1px solid var(--linea-fuerte)",
                      background: camposAria["razonSocial"] && !camposModificados["razonSocial"]
                        ? "var(--exito-diluido)"
                        : "#FFFFFF",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--texto-2)" }}>
                      Nombre comercial (opcional)
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--linea-fuerte)", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "4px" }}>
                  Actividad económica (opcional)
                </label>
                <input
                  type="text"
                  value={actividadEconomica}
                  onChange={(e) => setActividadEconomica(e.target.value)}
                  placeholder="p. ej. construcción"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--linea-fuerte)", fontSize: "0.85rem" }}
                />
              </div>

              {/* Bóveda de Documentación Obligatoria de la Empresa (Billetera Digital) */}
              <div style={{ border: "1.5px solid var(--acento-linea)", borderRadius: "12px", padding: "14px", background: "var(--acento-diluido)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--acento-hondo)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={18} />
                    Documentación Legal Obligatoria de la Empresa (Billetera Digital)
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--acento-hondo)", fontWeight: 600, background: "var(--acento-diluido)", padding: "2px 8px", borderRadius: "6px" }}>
                    Cédula + Nombramiento Inscrito
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {/* Tarjeta A: Cédula del Representante Legal (Obligatorio) */}
                  <div style={{ background: "#FFFFFF", border: archivoRepCedula ? "1.5px solid var(--exito-linea)" : "1.5px dashed var(--acento)", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--texto)" }}>
                          1. Cédula del Representante *
                        </span>
                        <span style={{ background: archivoRepCedula ? "var(--exito-diluido)" : "var(--aviso-diluido)", color: archivoRepCedula ? "var(--exito-texto)" : "var(--aviso-texto)", fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: "4px" }}>
                          {archivoRepCedula ? "Cargada" : "Obligatorio"}
                        </span>
                      </div>
                    </div>

                    {archivoRepCedula ? (
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: "var(--texto-2)" }}>
                          📄 {archivoRepCedula.nombre} ({(archivoRepCedula.tamano / 1024).toFixed(1)} KB)
                        </p>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <label style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", color: "var(--exito-texto)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Upload size={11} /> Reemplazar
                            <input type="file" accept="image/*,application/pdf" onChange={manejarCargaArchivoRepCedula} style={{ display: "none" }} disabled={procesandoAriaRepCedula} />
                          </label>
                          <button type="button" onClick={() => setArchivoRepCedula(null)} style={{ background: "var(--error-diluido)", border: "1px solid var(--error-linea)", color: "var(--error)", padding: "4px 6px", borderRadius: "6px", cursor: "pointer" }} title="Quitar archivo">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "var(--texto-suave)" }}>
                          Sube la cédula o pasaporte del representante legal para extracción y archivo seguro.
                        </p>
                        <label style={{ background: "var(--acento)", color: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Upload size={12} />
                          {procesandoAriaRepCedula ? "Analizando..." : "Cargar Cédula Representante"}
                          <input type="file" accept="image/*,application/pdf" onChange={manejarCargaArchivoRepCedula} style={{ display: "none" }} disabled={procesandoAriaRepCedula} />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta B: Nombramiento Inscrito en Registro Mercantil (Obligatorio) */}
                  <div style={{ background: "#FFFFFF", border: archivoNombramiento ? "1.5px solid var(--exito-linea)" : "1.5px dashed var(--acento)", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--texto)" }}>
                          2. Nombramiento Inscrito *
                        </span>
                        <span style={{ background: archivoNombramiento ? "var(--exito-diluido)" : "var(--aviso-diluido)", color: archivoNombramiento ? "var(--exito-texto)" : "var(--aviso-texto)", fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: "4px" }}>
                          {archivoNombramiento ? "Cargado" : "Obligatorio"}
                        </span>
                      </div>
                    </div>

                    {archivoNombramiento ? (
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: "var(--texto-2)" }}>
                          📄 {archivoNombramiento.nombre} ({(archivoNombramiento.tamano / 1024).toFixed(1)} KB)
                        </p>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <label style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", color: "var(--exito-texto)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Upload size={11} /> Reemplazar
                            <input type="file" accept="application/pdf,image/*" onChange={manejarCargaNombramiento} style={{ display: "none" }} disabled={procesandoAriaNom} />
                          </label>
                          <button type="button" onClick={() => setArchivoNombramiento(null)} style={{ background: "var(--error-diluido)", border: "1px solid var(--error-linea)", color: "var(--error)", padding: "4px 6px", borderRadius: "6px", cursor: "pointer" }} title="Quitar archivo">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "var(--texto-suave)" }}>
                          Sube el nombramiento inscrito para certificar el cargo, periodo y facultades estatutarias.
                        </p>
                        <label style={{ background: "var(--acento)", color: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
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
                      <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", color: "var(--exito-texto)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem" }}>
                        {badgeAriaRepCedula}
                      </div>
                    )}
                    {badgeAriaNom && (
                      <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", color: "var(--exito-texto)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem" }}>
                        {badgeAriaNom}
                      </div>
                    )}
                  </div>
                )}

                {/* Campos Formulario del Representante Legal */}
                <div style={{ borderTop: "1px solid var(--acento-linea)", paddingTop: "10px", marginTop: "2px" }}>
                  <span style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--acento-hondo)", marginBottom: "8px" }}>
                    Datos del Representante Legal Mapeados
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--texto-2)" }}>
                          Nombres *
                        </label>
                        <IndicadorOrigenCampo esAria={camposAria["repNombres"]} esModificado={camposModificados["repNombres"]} />
                      </div>
                      <input
                        type="text"
                        placeholder="Nombres y apellidos"
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
                            ? "1px solid var(--exito-linea)"
                            : "1px solid var(--linea-fuerte)",
                          background: camposAria["repNombres"] && !camposModificados["repNombres"]
                            ? "var(--exito-diluido)"
                            : "#FFFFFF",
                          fontSize: "0.8rem"
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--texto-2)" }}>
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
                            ? "1px solid var(--exito-linea)"
                            : "1px solid var(--linea-fuerte)",
                          background: camposAria["repCedula"] && !camposModificados["repCedula"]
                            ? "var(--exito-diluido)"
                            : "#FFFFFF",
                          fontSize: "0.8rem"
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--texto-2)" }}>
                          Cargo
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
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--texto-2)" }}>
                          Vigencia Nombramiento (Calculada / Mercantil)
                        </label>
                        <IndicadorOrigenCampo esAria={camposAria["repVencimientoNombramiento"]} esModificado={camposModificados["repVencimientoNombramiento"]} />
                      </div>
                      <input
                        type="date"
                        value={repVencimientoNombramiento}
                        onChange={(e) => setRepVencimientoNombramiento(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "2px" }}>
                        Correo del representante (opcional)
                      </label>
                      <input
                        type="email"
                        placeholder="gerencia@empresa.com"
                        value={repCorreo}
                        onChange={(e) => setRepCorreo(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
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
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "4px" }}>
                {tipoPersoneria === "juridica" ? "Correo de facturación y notificaciones *" : "Correo electrónico *"}
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
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--linea-fuerte)", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "4px" }}>
                Celular o WhatsApp
              </label>
              <input
                type="tel"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="0991234567"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--linea-fuerte)", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--texto-2)", marginBottom: "4px" }}>
                Casillero judicial electrónico
              </label>
              <input
                type="text"
                value={casilleroElectronico}
                onChange={(e) => setCasilleroElectronico(e.target.value)}
                placeholder="nombre@funcionjudicial.gob.ec"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--linea-fuerte)", fontSize: "0.85rem" }}
              />
            </div>
          </div>

          {/* Sección de Contraparte y Conflict Check */}
          <div>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--texto)", display: "block" }}>
              Contraparte
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--texto-suave)", display: "block", marginBottom: "8px" }}>
              Opcional. Sirve para comprobar conflictos de intereses antes de aceptar el caso.
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <input
                type="text"
                placeholder="Nombre de la contraparte"
                value={contraparteNombres}
                onChange={(e) => {
                  setContraparteNombres(e.target.value);
                  ejecutarConflictCheck(contraparteIdentificacion, e.target.value);
                }}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
              />
              <input
                type="text"
                placeholder="Cédula o RUC"
                value={contraparteIdentificacion}
                onChange={(e) => {
                  setContraparteIdentificacion(e.target.value);
                  ejecutarConflictCheck(e.target.value, contraparteNombres);
                }}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--linea-fuerte)", fontSize: "0.8rem" }}
              />
            </div>

            {alertaConflicto && (
              <div style={{ marginTop: "8px", background: "var(--aviso-diluido)", color: "var(--aviso-texto)", padding: "8px 10px", borderRadius: "6px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} strokeWidth={1.8} />
                {alertaConflicto}
              </div>
            )}
          </div>

          {/* Banner de Sincronización con Billetera Digital */}
          <div
            style={{
              background: "var(--fondo-suave)",
              border: "1px solid var(--linea)",
              borderRadius: "8px",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.74rem",
              color: "var(--texto-2)",
            }}
          >
            <Wallet size={15} color="var(--acento)" />
            <span>
              <strong>Billetera Digital Activa:</strong> Todos los documentos cargados (cédulas, nombramiento, RUC) serán cifrados y guardados en la bóveda digital personal del cliente para emisión inmediata de poderes, minutas y contratos.
            </span>
          </div>

          {errorValidacion && (
            <div style={{ background: "var(--error-diluido)", color: "var(--error-texto)", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem" }}>
              {errorValidacion}
            </div>
          )}
        </div>

        {/* Pie de Acciones Multiopción */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--linea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                limpiarFormulario();
                alCerrar();
              }}
              disabled={isPending}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid var(--linea-fuerte)",
                background: "#FFFFFF",
                color: "var(--texto-2)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={limpiarFormulario}
              disabled={isPending}
              title="Limpiar todos los campos y documentos"
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: "1px solid var(--linea)",
                background: "var(--fondo-suave)",
                color: "var(--texto-suave)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <RotateCcw size={14} />
              Limpiar Formulario
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => manejarGuardar("solo_guardar")}
              disabled={isPending}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid var(--linea-fuerte)",
                background: "#FFFFFF",
                color: "var(--texto)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isPending ? "Guardando…" : "Guardar"}
            </button>

            <button
              type="button"
              onClick={() => manejarGuardar("agendar_cita")}
              disabled={isPending}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid var(--linea-fuerte)",
                background: "#FFFFFF",
                color: "var(--texto)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Guardar y agendar cita
            </button>

            <button
              type="button"
              onClick={() => manejarGuardar("radicar_expediente")}
              disabled={isPending}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: "var(--acento)",
                color: "#FFFFFF",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Guardar y radicar expediente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
