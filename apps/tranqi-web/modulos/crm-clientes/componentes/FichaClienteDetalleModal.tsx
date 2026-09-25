"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X, User, Building2, Scale, Calendar, Folder, Printer,
  Phone, Mail,
  Plus, History, Pencil
} from "lucide-react";
import {
  obtenerDetalleCliente360,
  obtenerHistorialAuditoriaCliente,
  registrarEventoAuditoriaCliente
} from "../acciones";

interface DetalleCliente360Estado {
  perfil: Awaited<ReturnType<typeof obtenerDetalleCliente360>>["perfil"];
  expedientes: Array<{
    cas_id: string;
    cas_codigo_expediente?: string | null;
    cas_titulo?: string | null;
    cas_tipo_tramite?: string | null;
    cas_etapa_procesal?: string | null;
    cas_estado: string;
  }>;
  citas: Array<{
    cit_id: string;
    cit_inicio_en: string;
    cit_modalidad?: string | null;
    cit_motivo?: string | null;
    cit_estado: string;
  }>;
}

interface EventoAuditoriaCliente {
  reg_id: string;
  reg_operacion: string;
  reg_creado_en: string;
  reg_datos_nuevos?: {
    detalle?: string;
    usuario_email?: string;
    [key: string]: unknown;
  } | null;
}

interface Props {
  clienteId: string | null;
  alCerrar: () => void;
  alEditarCliente?: () => void;
  alRadicarExpediente?: (clienteId: string, nombreCompleto: string) => void;
  alAgendarCita?: (clienteId: string, nombreCompleto: string) => void;
}

export function FichaClienteDetalleModal({ clienteId, alCerrar, alEditarCliente, alRadicarExpediente, alAgendarCita }: Props) {
  const [tabActiva, setTabActiva] = useState<"general" | "expedientes" | "billetera" | "citas" | "auditoria">("general");
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<DetalleCliente360Estado | null>(null);
  const [auditoriaEventos, setAuditoriaEventos] = useState<EventoAuditoriaCliente[]>([]);

  useEffect(() => {
    if (!clienteId) return;

    setCargando(true);
    obtenerDetalleCliente360(clienteId)
      .then((res) => {
        setDetalle(res as unknown as DetalleCliente360Estado);
        return obtenerHistorialAuditoriaCliente(clienteId);
      })
      .then((aud) => {
        setAuditoriaEventos(aud as unknown as EventoAuditoriaCliente[]);
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
            borderBottom: "1px solid var(--linea)",
            background: "var(--fondo-suave)",
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
                background: perfil?.clp_tipo_personeria === "juridica" ? "var(--acento-diluido)" : "var(--acento-diluido)",
                color: perfil?.clp_tipo_personeria === "juridica" ? "var(--acento)" : "#7E22CE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {perfil?.clp_tipo_personeria === "juridica" ? <Building2 size={24} /> : <User size={24} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--texto)" }}>
                  {nombreMostrado || "Cargando cliente..."}
                </h2>
                {perfil?.clp_activo ? (
                  <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: 700, background: "var(--exito-diluido)", color: "var(--exito-texto)" }}>
                    Activo
                  </span>
                ) : (
                  <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: 700, background: "var(--aviso-diluido)", color: "var(--aviso-texto)" }}>
                    Inactivo (Pendiente Pago)
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--texto-suave)" }}>
                {perfil?.clp_tipo_identificacion?.toUpperCase()}: {perfil?.clp_identificacion} · {perfil?.clp_tipo_personeria === "juridica" ? "Persona Jurídica (Empresa)" : "Persona Natural"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {alEditarCliente && (
              <button
                type="button"
                onClick={alEditarCliente}
                title="Editar datos del cliente"
                style={{
                  background: "var(--acento)",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(2, 132, 199, 0.25)",
                }}
              >
                <Pencil size={14} />
                Editar Datos
              </button>
            )}
            <button
              type="button"
              onClick={manejarImprimir}
              title="Imprimir o Exportar Ficha"
              style={{
                background: "#FFFFFF",
                border: "1px solid var(--linea-fuerte)",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--texto-2)",
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

        {/* Barra de Pestañas (Tabs) */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--linea)", padding: "0 24px", background: "#FFFFFF" }}>
          {[
            { id: "general", label: "📋 Datos Generales", icon: User },
            { id: "expedientes", label: `📁 Expedientes (${detalle?.expedientes?.length || 0})`, icon: Scale },
            { id: "citas", label: `📅 Citas & Agenda (${detalle?.citas?.length || 0})`, icon: Calendar },
            { id: "billetera", label: "📂 Billetera Documental", icon: Folder },
            { id: "auditoria", label: `🕒 Tracking & Auditoría (${auditoriaEventos.length})`, icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id as "general" | "expedientes" | "billetera" | "citas" | "auditoria")}
              style={{
                padding: "12px 16px",
                border: "none",
                borderBottom: tabActiva === tab.id ? "2px solid var(--acento)" : "2px solid transparent",
                background: "transparent",
                color: tabActiva === tab.id ? "var(--acento)" : "var(--texto-suave)",
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
            <div style={{ textAlign: "center", padding: "40px", color: "var(--texto-suave)" }}>
              Cargando información 360° del cliente...
            </div>
          ) : (
            <>
              {/* TAB 1: DATOS GENERALES */}
              {tabActiva === "general" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                    <div style={{ background: "var(--fondo-suave)", padding: "14px", borderRadius: "10px", border: "1px solid var(--linea)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--texto-suave)", textTransform: "uppercase", fontWeight: 700 }}>Contacto Principal</span>
                      <p style={{ margin: "6px 0 2px", fontSize: "0.88rem", fontWeight: 600, color: "var(--texto)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Mail size={15} color="var(--acento)" /> {perfil?.clp_correo || "Sin correo"}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.88rem", fontWeight: 600, color: "var(--texto)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={15} color="var(--exito)" /> {perfil?.clp_celular || perfil?.clp_telefono || "Sin teléfono"}
                      </p>
                    </div>

                    <div style={{ background: "var(--fondo-suave)", padding: "14px", borderRadius: "10px", border: "1px solid var(--linea)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--texto-suave)", textTransform: "uppercase", fontWeight: 700 }}>Casillero Judicial</span>
                      <p style={{ margin: "6px 0 2px", fontSize: "0.88rem", fontWeight: 600, color: "var(--texto)" }}>
                        Físico: {perfil?.clp_casillero_judicial || "No registrado"}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--texto-2)" }}>
                        Electrónico: {perfil?.clp_casillero_electronico || "No registrado"}
                      </p>
                    </div>
                  </div>

                  {/* Representante Legal si aplica */}
                  {perfil?.clp_detalle_cliente?.representante_legal && (
                    <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", padding: "14px", borderRadius: "10px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--exito-texto)", textTransform: "uppercase", fontWeight: 700 }}>
                        Representante Legal Certificado (Inscripción Mercantil)
                      </span>
                      <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: "var(--exito-texto)", fontSize: "0.95rem" }}>
                            {perfil.clp_detalle_cliente.representante_legal.nombres}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--exito-texto)" }}>
                            C.I. {perfil.clp_detalle_cliente.representante_legal.cedula} · Cargo: {perfil.clp_detalle_cliente.representante_legal.cargo || "Gerente General"}
                          </p>
                        </div>
                        {perfil.clp_detalle_cliente.representante_legal.nombramientoVence && (
                          <div style={{ background: "var(--exito-diluido)", padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "var(--exito-texto)", fontWeight: 600 }}>
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
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--texto-2)" }}>
                      Causas y Trámites Radicados
                    </span>
                    {alRadicarExpediente && (
                      <button
                        type="button"
                        onClick={() => alRadicarExpediente(clienteId, nombreMostrado)}
                        style={{
                          background: "var(--acento)",
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
                    <div style={{ background: "var(--fondo-suave)", padding: "30px", borderRadius: "10px", textAlign: "center", color: "var(--texto-suave)" }}>
                      El cliente aún no tiene expedientes radicados.
                    </div>
                  ) : (
                    detalle?.expedientes?.map((exp) => (
                      <div
                        key={exp.cas_id}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid var(--linea)",
                          borderRadius: "10px",
                          padding: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--acento)", background: "var(--acento-diluido)", padding: "2px 8px", borderRadius: "4px" }}>
                            {exp.cas_codigo_expediente || "TRQ-MAT"}
                          </span>
                          <h4 style={{ margin: "6px 0 2px", fontSize: "0.92rem", color: "var(--texto)" }}>
                            {exp.cas_titulo}
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--texto-suave)" }}>
                            Tipo: {exp.cas_tipo_tramite} · Etapa: {exp.cas_etapa_procesal}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: exp.cas_estado === "en_curso" ? "var(--exito)" : "var(--aviso)" }}>
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
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--texto-2)" }}>
                      Historial de Videoconsultas y Turnos
                    </span>
                    {alAgendarCita && (
                      <button
                        type="button"
                        onClick={() => alAgendarCita(clienteId, nombreMostrado)}
                        style={{
                          background: "var(--acento)",
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
                    <div style={{ background: "var(--fondo-suave)", padding: "30px", borderRadius: "10px", textAlign: "center", color: "var(--texto-suave)" }}>
                      No registra citas agendadas en plataforma.
                    </div>
                  ) : (
                    detalle?.citas?.map((cit) => (
                      <div key={cit.cit_id} style={{ background: "#FFFFFF", border: "1px solid var(--linea)", borderRadius: "8px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "var(--texto)" }}>
                            {new Date(cit.cit_inicio_en).toLocaleDateString()} · {new Date(cit.cit_inicio_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--texto-suave)" }}>
                            Modalidad: {cit.cit_modalidad} · Motivo: {cit.cit_motivo || "Orientación"}
                          </p>
                        </div>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: cit.cit_estado === "confirmada" ? "var(--exito)" : "var(--texto-suave)" }}>
                          {cit.cit_estado.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: BILLETERA */}
              {tabActiva === "billetera" && (
                <div style={{ background: "var(--fondo-suave)", padding: "24px", borderRadius: "10px", textAlign: "center" }}>
                  <Folder size={36} color="var(--acento)" style={{ margin: "0 auto 10px" }} />
                  <h4 style={{ margin: "0 0 6px", fontSize: "0.95rem", color: "var(--texto)" }}>
                    Billetera Digital Universal (TRQ-COM-001)
                  </h4>
                  <p style={{ margin: "0 auto 16px", maxWidth: "420px", fontSize: "0.82rem", color: "var(--texto-suave)" }}>
                    Documentos custodiados del cliente (Cédulas, Títulos, Nombramientos y Poderes) vinculables a expedientes sin duplicar archivos.
                  </p>
                  <Link
                    href="/panel/billetera-documentos"
                    style={{
                      background: "var(--acento)",
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
                  </Link>
                </div>
              )}

              {/* TAB 5: AUDITORÍA Y TRACKING */}
              {tabActiva === "auditoria" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--texto-2)" }}>
                    Línea de Tiempo de Accesos, Consultas e Impresiones
                  </span>

                  {auditoriaEventos.length === 0 ? (
                    <div style={{ background: "var(--fondo-suave)", padding: "20px", borderRadius: "8px", textAlign: "center", color: "var(--texto-suave)", fontSize: "0.85rem" }}>
                      Sin eventos previos registrados.
                    </div>
                  ) : (
                    auditoriaEventos.map((ev) => (
                      <div
                        key={ev.reg_id}
                        style={{
                          borderLeft: "3px solid var(--acento)",
                          background: "var(--fondo-suave)",
                          padding: "10px 14px",
                          borderRadius: "0 8px 8px 0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--texto)" }}>
                            {ev.reg_operacion}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--texto-2)" }}>
                            {ev.reg_datos_nuevos?.detalle || "Acción registrada en el sistema."}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--texto-suave)", display: "block" }}>
                            {new Date(ev.reg_creado_en).toLocaleString()}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--acento)", fontWeight: 600 }}>
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
