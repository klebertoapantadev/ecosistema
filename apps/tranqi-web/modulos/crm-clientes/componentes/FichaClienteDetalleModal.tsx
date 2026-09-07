"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Building2, Scale, Calendar, Folder, Clock, Printer,
  Shield, CheckCircle2, FileText, Phone, Mail, MapPin, ExternalLink,
  Plus, AlertCircle, History, Eye
} from "lucide-react";
import {
  obtenerDetalleCliente360,
  obtenerHistorialAuditoriaCliente,
  registrarEventoAuditoriaCliente
} from "../acciones";

interface Props {
  clienteId: string | null;
  alCerrar: () => void;
  alRadicarExpediente?: (clienteId: string, nombreCompleto: string) => void;
  alAgendarCita?: (clienteId: string, nombreCompleto: string) => void;
}

export function FichaClienteDetalleModal({ clienteId, alCerrar, alRadicarExpediente, alAgendarCita }: Props) {
  const [tabActiva, setTabActiva] = useState<"general" | "expedientes" | "billetera" | "citas" | "auditoria">("general");
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<any>(null);
  const [auditoriaEventos, setAuditoriaEventos] = useState<any[]>([]);

  useEffect(() => {
    if (!clienteId) return;

    setCargando(true);
    obtenerDetalleCliente360(clienteId)
      .then((res) => {
        setDetalle(res);
        return obtenerHistorialAuditoriaCliente(clienteId);
      })
      .then((aud) => {
        setAuditoriaEventos(aud);
      })
      .catch((err) => {
        console.error("Error al cargar detalle 360:", err);
      })
      .finally(() => {
        setCargando(false);
      });
  }, [clienteId]);

  if (!clienteId) return null;

  const perfil = detalle?.perfil;
  const nombreMostrado = perfil?.clp_razon_social || `${perfil?.clp_nombres || ""} ${perfil?.clp_apellidos || ""}`.trim();

  const manejarImprimir = async () => {
    if (clienteId) {
      await registrarEventoAuditoriaCliente(
        clienteId,
        "impresion_datos",
        `Ficha 360° del cliente impresa/exportada a documento por el usuario en sesión.`
      );
      window.print();
    }
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
          maxWidth: "920px",
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
            padding: "18px 24px",
            borderBottom: "1px solid #E2E8F0",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: perfil?.clp_tipo_personeria === "juridica" ? "#E0F2FE" : "#F3E8FF",
                color: perfil?.clp_tipo_personeria === "juridica" ? "#0284C7" : "#7E22CE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {perfil?.clp_tipo_personeria === "juridica" ? <Building2 size={24} /> : <User size={24} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#0F172A" }}>
                {nombreMostrado || "Cargando cliente..."}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748B" }}>
                {perfil?.clp_tipo_identificacion?.toUpperCase()}: {perfil?.clp_identificacion} · {perfil?.clp_tipo_personeria === "juridica" ? "Persona Jurídica (Empresa)" : "Persona Natural"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={manejarImprimir}
              title="Imprimir o Exportar Ficha"
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Printer size={15} />
              Imprimir Ficha
            </button>
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
        </div>

        {/* Barra de Pestañas (Tabs) */}
        <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", padding: "0 24px", background: "#FFFFFF" }}>
          {[
            { id: "general", label: "📋 Datos Generales", icon: User },
            { id: "expedientes", label: `📁 Expedientes (${detalle?.expedientes?.length || 0})`, icon: Scale },
            { id: "citas", label: `📅 Citas & Agenda (${detalle?.citas?.length || 0})`, icon: Calendar },
            { id: "billetera", label: "📂 Billetera Documental", icon: Folder },
            { id: "auditoria", label: `🕒 Tracking & Auditoría (${auditoriaEventos.length})`, icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id as any)}
              style={{
                padding: "12px 16px",
                border: "none",
                borderBottom: tabActiva === tab.id ? "2px solid #0284C7" : "2px solid transparent",
                background: "transparent",
                color: tabActiva === tab.id ? "#0284C7" : "#64748B",
                fontWeight: tabActiva === tab.id ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido de Pestañas */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {cargando ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
              Cargando información 360° del cliente...
            </div>
          ) : (
            <>
              {/* TAB 1: DATOS GENERALES */}
              {tabActiva === "general" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                    <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>Contacto Principal</span>
                      <p style={{ margin: "6px 0 2px", fontSize: "0.88rem", fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Mail size={15} color="#0284C7" /> {perfil?.clp_correo || "Sin correo"}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.88rem", fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={15} color="#16A34A" /> {perfil?.clp_celular || perfil?.clp_telefono || "Sin teléfono"}
                      </p>
                    </div>

                    <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>Casillero Judicial</span>
                      <p style={{ margin: "6px 0 2px", fontSize: "0.88rem", fontWeight: 600, color: "#0F172A" }}>
                        Físico: {perfil?.clp_casillero_judicial || "No registrado"}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#475569" }}>
                        Electrónico: {perfil?.clp_casillero_electronico || "No registrado"}
                      </p>
                    </div>
                  </div>

                  {/* Representante Legal si aplica */}
                  {perfil?.clp_detalle_cliente?.representante_legal && (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "14px", borderRadius: "10px" }}>
                      <span style={{ fontSize: "0.75rem", color: "#166534", textTransform: "uppercase", fontWeight: 700 }}>
                        Representante Legal Certificado (Inscripción Mercantil)
                      </span>
                      <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: "#14532D", fontSize: "0.95rem" }}>
                            {perfil.clp_detalle_cliente.representante_legal.nombres}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#166534" }}>
                            C.I. {perfil.clp_detalle_cliente.representante_legal.cedula} · Cargo: {perfil.clp_detalle_cliente.representante_legal.cargo || "Gerente General"}
                          </p>
                        </div>
                        {perfil.clp_detalle_cliente.representante_legal.nombramientoVence && (
                          <div style={{ background: "#DCFCE7", padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "#166534", fontWeight: 600 }}>
                            Vence Nombramiento: {perfil.clp_detalle_cliente.representante_legal.nombramientoVence}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EXPEDIENTES */}
              {tabActiva === "expedientes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                      Causas y Trámites Radicados
                    </span>
                    {alRadicarExpediente && (
                      <button
                        type="button"
                        onClick={() => alRadicarExpediente(clienteId, nombreMostrado)}
                        style={{
                          background: "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Plus size={14} />
                        Radicar Nuevo Expediente
                      </button>
                    )}
                  </div>

                  {detalle?.expedientes?.length === 0 ? (
                    <div style={{ background: "#F8FAFC", padding: "30px", borderRadius: "10px", textAlign: "center", color: "#64748B" }}>
                      El cliente aún no tiene expedientes radicados.
                    </div>
                  ) : (
                    detalle?.expedientes?.map((exp: any) => (
                      <div
                        key={exp.cas_id}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "10px",
                          padding: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0284C7", background: "#E0F2FE", padding: "2px 8px", borderRadius: "4px" }}>
                            {exp.cas_codigo_expediente || "TRQ-MAT"}
                          </span>
                          <h4 style={{ margin: "6px 0 2px", fontSize: "0.92rem", color: "#0F172A" }}>
                            {exp.cas_titulo}
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748B" }}>
                            Tipo: {exp.cas_tipo_tramite} · Etapa: {exp.cas_etapa_procesal}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: exp.cas_estado === "en_curso" ? "#16A34A" : "#D97706" }}>
                            {exp.cas_estado.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: CITAS & AGENDA */}
              {tabActiva === "citas" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                      Historial de Videoconsultas y Turnos
                    </span>
                    {alAgendarCita && (
                      <button
                        type="button"
                        onClick={() => alAgendarCita(clienteId, nombreMostrado)}
                        style={{
                          background: "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Plus size={14} />
                        Agendar Turno
                      </button>
                    )}
                  </div>

                  {detalle?.citas?.length === 0 ? (
                    <div style={{ background: "#F8FAFC", padding: "30px", borderRadius: "10px", textAlign: "center", color: "#64748B" }}>
                      No registra citas agendadas en plataforma.
                    </div>
                  ) : (
                    detalle?.citas?.map((cit: any) => (
                      <div key={cit.cit_id} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#0F172A" }}>
                            {new Date(cit.cit_inicio_en).toLocaleDateString()} · {new Date(cit.cit_inicio_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748B" }}>
                            Modalidad: {cit.cit_modalidad} · Motivo: {cit.cit_motivo || "Orientación"}
                          </p>
                        </div>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: cit.cit_estado === "confirmada" ? "#16A34A" : "#64748B" }}>
                          {cit.cit_estado.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: BILLETERA */}
              {tabActiva === "billetera" && (
                <div style={{ background: "#F8FAFC", padding: "24px", borderRadius: "10px", textAlign: "center" }}>
                  <Folder size={36} color="#0284C7" style={{ margin: "0 auto 10px" }} />
                  <h4 style={{ margin: "0 0 6px", fontSize: "0.95rem", color: "#0F172A" }}>
                    Billetera Digital Universal (TRQ-COM-001)
                  </h4>
                  <p style={{ margin: "0 auto 16px", maxWidth: "420px", fontSize: "0.82rem", color: "#64748B" }}>
                    Documentos custodiados del cliente (Cédulas, Títulos, Nombramientos y Poderes) vinculables a expedientes sin duplicar archivos.
                  </p>
                  <a
                    href="/panel/billetera-documentos"
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    Abrir Billetera de Documentos
                  </a>
                </div>
              )}

              {/* TAB 5: AUDITORÍA Y TRACKING */}
              {tabActiva === "auditoria" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                    Línea de Tiempo de Accesos, Consultas e Impresiones
                  </span>

                  {auditoriaEventos.length === 0 ? (
                    <div style={{ background: "#F8FAFC", padding: "20px", borderRadius: "8px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                      Sin eventos previos registrados.
                    </div>
                  ) : (
                    auditoriaEventos.map((ev) => (
                      <div
                        key={ev.reg_id}
                        style={{
                          borderLeft: "3px solid #0284C7",
                          background: "#F8FAFC",
                          padding: "10px 14px",
                          borderRadius: "0 8px 8px 0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0F172A" }}>
                            {ev.reg_operacion}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#475569" }}>
                            {ev.reg_datos_nuevos?.detalle || "Acción registrada en el sistema."}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>
                            {new Date(ev.reg_creado_en).toLocaleString()}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "#0284C7", fontWeight: 600 }}>
                            {ev.reg_datos_nuevos?.usuario_email || "Usuario del Staff"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
