"use client";

import React, { useState, useTransition } from "react";
import {
  X, User, Building2, ShieldCheck, AlertTriangle, Sparkles, Upload,
  FileText, CheckCircle2, ArrowRight, Calendar, Scale, Info, Check, Eye
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

export function ModalAltaClienteAsistida({ abierto, alCerrar, alGuardarExitoso }: Props) {
  const [isPending, startTransition] = useTransition();

  // Tipo de personería
  const [tipoPersoneria, setTipoPersoneria] = useState<"natural" | "juridica">("natural");
  const [tipoIdentificacion, setTipoIdentificacion] = useState<"cedula" | "ruc" | "pasaporte">("cedula");

  // Formulario de identificación
  const [identificacion, setIdentificacion] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");

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
  const [nombramientoValidadoAria, setNombramientoValidadoAria] = useState(false);

  // Contraparte y Conflict Check
  const [contraparteNombres, setContraparteNombres] = useState("");
  const [contraparteIdentificacion, setContraparteIdentificacion] = useState("");
  const [alertaConflicto, setAlertaConflicto] = useState<string | null>(null);

  // Excepciones y Bypass
  const [omitirValidacionAlgoritmo, setOmitirValidacionAlgoritmo] = useState(false);
  const [motivoExcepcion, setMotivoExcepcion] = useState("");

  // Estados de IA y validación
  const [procesandoAriaId, setProcesandoAriaId] = useState(false);
  const [procesandoAriaNom, setProcesandoAriaNom] = useState(false);
  const [badgeAriaId, setBadgeAriaId] = useState<string | null>(null);
  const [badgeAriaNom, setBadgeAriaNom] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);

  if (!abierto) return null;

  // Manejo de carga digital con ARIA OCR
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
        if (res.nombres) setNombres(res.nombres);
        if (res.apellidos) setApellidos(res.apellidos);
        if (res.identificacion) {
          setIdentificacion(res.identificacion);
          setTipoIdentificacion(res.tipoIdentificacion || "cedula");
        }
        setBadgeAriaId(`✨ Identificación Validada por ARIA (${res.confianza}% confianza)`);
      } else {
        setErrorValidacion(res.mensaje || "No se pudo extraer la identificación.");
      }
    };
    reader.readAsDataURL(file);
  };

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
        if (res.razonSocial && !razonSocial) setRazonSocial(res.razonSocial);
        if (res.ruc && !identificacion) setIdentificacion(res.ruc);
        if (res.representanteNombres) setRepNombres(res.representanteNombres);
        if (res.representanteCedula) setRepCedula(res.representanteCedula);
        if (res.cargo) setRepCargo(res.cargo);
        if (res.fechaVencimientoCalculada) setRepVencimientoNombramiento(res.fechaVencimientoCalculada);
        setNombramientoValidadoAria(true);
        setBadgeAriaNom(`✨ Nombramiento Mercantil Vigente certificado por ARIA (Vence: ${res.fechaVencimientoCalculada || "2 años"})`);
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
          correo: correo.trim(),
          celular: celular.trim(),
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          casilleroJudicial: casilleroJudicial.trim(),
          casilleroElectronico: casilleroElectronico.trim(),
          representanteLegal: repNombres ? {
            nombres: repNombres,
            cedula: repCedula,
            cargo: repCargo,
            nombramientoVence: repVencimientoNombramiento,
            documentoValidadoAria: nombramientoValidadoAria,
          } : undefined,
          contrapartePreliminar: contraparteNombres ? {
            nombres: contraparteNombres,
            identificacion: contraparteIdentificacion,
          } : undefined,
          omitirValidacionAlgoritmo,
          motivoExcepcion: omitirValidacionAlgoritmo ? motivoExcepcion : undefined,
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
          maxWidth: "840px",
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
              Ingreso rápido para mostrador, consultas telefónicas y expedientes telemáticos
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
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "#E0F2FE", padding: "8px", borderRadius: "8px", color: "#0284C7" }}>
                <Sparkles size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#0F172A" }}>
                  Autocompletado Inteligente con ARIA (OCR)
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                  Carga la fotografía o PDF de la Cédula/RUC y ARIA extraerá los datos al instante
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
              {procesandoAriaId ? "Analizando..." : "Cargar Identificación"}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={manejarCargaArchivoId}
                style={{ display: "none" }}
                disabled={procesandoAriaId}
              />
            </label>
          </div>

          {badgeAriaId && (
            <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", padding: "8px 12px", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} />
              {badgeAriaId}
            </div>
          )}

          {/* Datos de Identificación */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Tipo Identificación
              </label>
              <select
                value={tipoIdentificacion}
                onChange={(e) => setTipoIdentificacion(e.target.value as any)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
              >
                <option value="cedula">Cédula de Identidad</option>
                <option value="ruc">RUC</option>
                <option value="pasaporte">Pasaporte / ID Extranjero</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Número de Identificación *
              </label>
              <input
                type="text"
                value={identificacion}
                onChange={async (e) => {
                  const val = e.target.value;
                  setIdentificacion(val);
                  if (val.length >= 10) {
                    const dup = await verificarDuplicado(val);
                    if (dup.existe) setAvisoDuplicado(dup.mensaje || "Identificación ya registrada.");
                    else setAvisoDuplicado(null);
                  }
                }}
                placeholder={tipoPersoneria === "natural" ? "1719103986" : "1792345678001"}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
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

          {/* Campos Persona Natural vs Jurídica */}
          {tipoPersoneria === "natural" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Nombres *
                </label>
                <input
                  type="text"
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Carlos Alberto"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Apellidos *
                </label>
                <input
                  type="text"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Pérez Mena"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Razón Social de la Empresa *
                </label>
                <input
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="INMOBILIARIA & CONSTRUCTORA ANDINA S.A.S."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                />
              </div>

              {/* Representante Legal con ARIA OCR */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px", background: "#F8FAFC" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A" }}>
                    Representante Legal (Opcional)
                  </span>
                  <label style={{ fontSize: "0.75rem", color: "#0284C7", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Upload size={12} />
                    {procesandoAriaNom ? "Analizando..." : "Cargar Nombramiento"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={manejarCargaNombramiento}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                {badgeAriaNom && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", padding: "6px 10px", borderRadius: "6px", fontSize: "0.75rem", marginBottom: "8px" }}>
                    {badgeAriaNom}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Nombres del Representante"
                    value={repNombres}
                    onChange={(e) => setRepNombres(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                  />
                  <input
                    type="text"
                    placeholder="Cédula Representante"
                    value={repCedula}
                    onChange={(e) => setRepCedula(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8rem" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contacto y Casillero Judicial */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Correo Electrónico
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="cliente@correo.com"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Celular / WhatsApp
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
                placeholder="Nombres de la Contraparte (Demandado / Cónyuge)"
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
