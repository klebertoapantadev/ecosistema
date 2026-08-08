"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Star, X, CheckCircle2, ChevronRight, ShieldCheck, Briefcase, Pencil, Receipt, Lock, QrCode, type LucideIcon } from "lucide-react";
import { FormularioPerfil } from "@eco/identidad/componentes/FormularioPerfil";
import { FormularioPerfilAbogado } from "@eco/identidad/componentes/FormularioPerfilAbogado";
import { FormularioDatosFacturacion } from "@eco/identidad/componentes/FormularioDatosFacturacion";
import { WidgetConfiguracionMfa } from "@eco/identidad/componentes/WidgetConfiguracionMfa";
import { HistorialAccesos } from "@eco/identidad/componentes/HistorialAccesos";
import { EliminarCuenta } from "@eco/identidad/componentes/EliminarCuenta";
import { cerrarSesionYRedirigir } from "../acciones";
import { SelectorRolActivo, type RolOpcionDef } from "../SelectorRolActivo";
import { useCustomWidgets } from "../gestorTitulosWidgets";
import { ModalEditarWidget } from "../ModalEditarWidget";
import { ModalVerificarMFAWidget } from "../ModalVerificarMFAWidget";

export interface PerfilUsuario {
  usu_id?: string;
  usu_nombres?: string | null;
  apellidos?: string | null;
  usu_apellidos?: string | null;
  usu_correo?: string | null;
  usu_whatsapp?: string | null;
  usu_autorizacion_whatsapp?: boolean | null;
  usu_superadmin_plataforma?: boolean | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usu_detalle_usuario?: any | null;
}

export interface FilaAcceso {
  acc_id: string;
  acc_ip: string | null;
  acc_user_agent: string | null;
  acc_creado_en: string;
  acc_negocio?: string | null;
}

interface Props {
  perfil: PerfilUsuario | null;
  historial: FilaAcceso[];
  puedeConmutar?: boolean;
  rolesDisponibles?: RolOpcionDef[];
}

export interface WidgetDef {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: LucideIcon;
  colorIcono: string;
  categoria: string;
  esPeligro?: boolean;
}

const WIDGETS_BASE: WidgetDef[] = [
  {
    id: "perfil",
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado, correos adicionales y WhatsApp",
    icono: User,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Datos Personales"
  },
  {
    id: "facturacion",
    titulo: "Datos de Facturación & Comprobantes",
    subtitulo: "Razón social, RUC/Cédula, dirección fiscal y correo electrónico de facturación",
    icono: Receipt,
    colorIcono: "var(--esmeralda, #05876E)",
    categoria: "Facturación & Cobros"
  },
  {
    id: "perfil_abogado",
    titulo: "Perfil Profesional de Abogado (MFA)",
    subtitulo: "Visualiza y edita tus datos de registro, SENESCYT, matrícula del Foro y especialidades (Protegido por MFA)",
    icono: Briefcase,
    colorIcono: "var(--esmeralda, #05876E)",
    categoria: "Socio Abogado"
  },
  {
    id: "historial",
    titulo: "Historial de Accesos",
    subtitulo: "Seguridad de inicio de sesión, IP y dispositivos",
    icono: History,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Auditoría"
  },
  {
    id: "mfa_seguridad",
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configura tu app autenticadora (TOTP) o resetea el acceso por pérdida de dispositivo vía correo",
    icono: QrCode,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Seguridad"
  },
  {
    id: "sesion",
    titulo: "Sesión & Claves de Seguridad",
    subtitulo: "Gestión de sesión activa y cierre de sesión",
    icono: KeyRound,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Seguridad"
  },
  {
    id: "rol_activo",
    titulo: "Ver Como",
    subtitulo: "Alternar la vista previa del portal entre Cliente, Socio Abogado y Administrador",
    icono: ShieldCheck,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Gobernanza"
  },
  {
    id: "peligro",
    titulo: "Baja de Cuenta",
    subtitulo: "Eliminación permanente conforme a Ley LOPDP",
    icono: ShieldAlert,
    colorIcono: "#B00020",
    categoria: "Zona de Peligro",
    esPeligro: true
  }
];

export function PanelCuentaModular({ perfil, historial, puedeConmutar = true, rolesDisponibles }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null);
  const [widgetEditar, setWidgetEditar] = useState<{
    id: string;
    titulo: string;
    subtitulo: string;
    iconoKey?: string;
    requiereMfa?: boolean;
    tiempoMfaMinutos?: number;
  } | null>(null);

  const [widgetMfaPendiente, setWidgetMfaPendiente] = useState<{
    id: string;
    titulo: string;
    tiempoMinutos: number;
  } | null>(null);

  const { getWidgetInfo, guardarWidget, obtenerIconoComponente } = useCustomWidgets();
  const esAdminOSuper = Boolean(puedeConmutar || perfil?.usu_superadmin_plataforma);

  const widgetsDisponibles = puedeConmutar
    ? WIDGETS_BASE
    : WIDGETS_BASE.filter(w => w.id !== "rol_activo");

  // Cargar favoritos de localStorage
  useEffect(() => {
    try {
      const guardados = localStorage.getItem("tranqi_favoritos_cuenta");
      if (guardados) {
        setFavoritos(JSON.parse(guardados));
      } else {
        setFavoritos(["perfil"]);
      }
    } catch {
      setFavoritos(["perfil"]);
    }
  }, []);

  // Alternar estado de favorito
  const toggleFavorito = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let nuevos: string[];
    if (favoritos.includes(id)) {
      nuevos = favoritos.filter((f) => f !== id);
    } else {
      nuevos = [...favoritos, id];
    }
    setFavoritos(nuevos);
    try {
      localStorage.setItem("tranqi_favoritos_cuenta", JSON.stringify(nuevos));
    } catch {
      // Ignore
    }
  };

  const handleIntentarAbrirWidget = (id: string, w: WidgetDef) => {
    const infoCustom = getWidgetInfo(id, w.titulo, w.subtitulo);
    if (infoCustom.requiereMfa) {
      const rawTs = typeof window !== "undefined" ? localStorage.getItem(`tranqi_mfa_widget_ts_${id}`) : null;
      const ts = rawTs ? Number(rawTs) : 0;
      const minutosTranscurridos = (Date.now() - ts) / (1000 * 60);

      if (!ts || infoCustom.tiempoMfaMinutos === 0 || minutosTranscurridos > infoCustom.tiempoMfaMinutos) {
        setWidgetMfaPendiente({
          id,
          titulo: infoCustom.titulo,
          tiempoMinutos: infoCustom.tiempoMfaMinutos || 0,
        });
        return;
      }
    }
    setWidgetActivo(id);
  };

  const handleConfirmarMfaExitoso = () => {
    if (widgetMfaPendiente) {
      try {
        localStorage.setItem(`tranqi_mfa_widget_ts_${widgetMfaPendiente.id}`, Date.now().toString());
      } catch { /* Ignorar */ }
      setWidgetActivo(widgetMfaPendiente.id);
      setWidgetMfaPendiente(null);
    }
  };

  // Reorganizar widgets poniendo los favoritos primero
  const widgetsOrdenados = [...widgetsDisponibles].sort((a, b) => {
    const esFavA = favoritos.includes(a.id);
    const esFavB = favoritos.includes(b.id);
    if (esFavA && !esFavB) return -1;
    if (!esFavA && esFavB) return 1;
    return 0;
  });

  const widgetActualDef = widgetsDisponibles.find((w) => w.id === widgetActivo);
  const widgetInfoActual = widgetActualDef ? getWidgetInfo(widgetActualDef.id, widgetActualDef.titulo, widgetActualDef.subtitulo) : null;
  const IconoActualWidget = widgetActualDef && widgetInfoActual ? obtenerIconoComponente(widgetInfoActual.iconoKey, widgetActualDef.icono) : User;

  // VISTA 2: SI HAY UN WIDGET SELECCIONADO (VISTA A PANTALLA COMPLETA CON BOTÓN X DE CIERRE)
  if (widgetActivo && widgetActualDef && widgetInfoActual) {
    return (
      <div style={{ width: "100%", animation: "fadeIn 0.2s ease" }}>
        <section
          style={{
            background: "var(--blanco, #ffffff)",
            border: "1px solid var(--panel-linea, #E4E4E4)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
          }}
        >
          {/* Header del Widget con Título, Icono, Subtítulo y Botón Cierre X */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
              paddingBottom: "16px",
              marginBottom: "20px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: widgetActualDef.esPeligro ? "rgba(176, 0, 32, 0.1)" : "var(--panel-linea-suave, #FAFAF9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: widgetActualDef.esPeligro ? "#B00020" : widgetActualDef.colorIcono,
                  border: "1px solid var(--panel-linea, #E4E4E4)"
                }}
              >
                <IconoActualWidget size={22} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--negro, #111111)", margin: 0 }}>
                    {widgetInfoActual.titulo}
                  </h2>
                  {favoritos.includes(widgetActivo) && (
                    <span className="pildora-estado" style={{ background: "var(--amarillo)", color: "var(--negro)", fontSize: "0.65rem" }}>
                      ⭐ Favorito
                    </span>
                  )}
                  {widgetInfoActual.requiereMfa && (
                    <span className="pildora-estado" style={{ background: "rgba(80, 0, 186, 0.12)", color: "var(--violeta, #5000BA)", fontSize: "0.65rem", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Lock size={12} /> MFA Protegido
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                  {widgetInfoActual.subtitulo}
                </span>
              </div>
            </div>

            {/* Botón Circular de Cerrar (X) */}
            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              title="Cerrar widget y volver a Mi Cuenta"
              style={{
                background: "var(--blanco, #ffffff)",
                border: "1.5px solid var(--panel-linea, #E4E4E4)",
                color: "var(--negro, #111111)",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                flexShrink: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                transition: "all 0.15s ease"
              }}
            >
              <X size={18} />
            </button>
          </header>

          {/* Cuerpo a 100% de Ancho */}
          <div style={{ padding: "20px 16px", width: "100%" }}>
            {widgetActivo === "perfil" && (
              <FormularioPerfil
                inicial={{
                  nombres: perfil?.usu_nombres || "",
                  apellidos: perfil?.usu_apellidos || perfil?.apellidos || "",
                  correo: perfil?.usu_correo || "",
                  whatsapp: perfil?.usu_whatsapp || "",
                  autorizaWhatsapp: Boolean(perfil?.usu_autorizacion_whatsapp),
                  fotoUrl: perfil?.usu_detalle_usuario?.foto_url || null,
                  codigoPaisWhatsapp: perfil?.usu_detalle_usuario?.codigo_pais_whatsapp || "+593",
                  correosAdicionales: perfil?.usu_detalle_usuario?.correos_adicionales || [],
                }}
              />
            )}

            {widgetActivo === "facturacion" && (
              <FormularioDatosFacturacion
                nombresRegistro={perfil?.usu_nombres || ""}
                apellidosRegistro={perfil?.usu_apellidos || perfil?.apellidos || ""}
                correoRegistro={perfil?.usu_correo || ""}
                inicial={{
                  razonSocial: perfil?.usu_detalle_usuario?.datos_facturacion?.razon_social,
                  tipoIdentificacion: perfil?.usu_detalle_usuario?.datos_facturacion?.tipo_identificacion,
                  identificacion: perfil?.usu_detalle_usuario?.datos_facturacion?.identificacion,
                  telefono: perfil?.usu_detalle_usuario?.datos_facturacion?.telefono,
                  direccion: perfil?.usu_detalle_usuario?.datos_facturacion?.direccion,
                  correoFacturacion: perfil?.usu_detalle_usuario?.datos_facturacion?.correo_facturacion,
                }}
              />
            )}

            {widgetActivo === "perfil_abogado" && (
              <FormularioPerfilAbogado
                inicial={{
                  nombres: perfil?.usu_nombres || "",
                  apellidos: perfil?.usu_apellidos || perfil?.apellidos || "",
                  correo: perfil?.usu_correo || "",
                  whatsapp: perfil?.usu_whatsapp || "",
                  autorizaWhatsapp: Boolean(perfil?.usu_autorizacion_whatsapp),
                  tituloSenescyt: "Abogado de los Tribunales de la República",
                  matriculaForo: "",
                  anosExperiencia: 5,
                  detalles: "",
                  mfaVerificadoInicial: false
                }}
              />
            )}

            {/* WIDGET 2: HISTORIAL DE ACCESOS */}
            {widgetActivo === "historial" && <HistorialAccesos historial={historial} />}

            {/* WIDGET 2.5: SEGURIDAD MFA & AUTENTICADOR */}
            {widgetActivo === "mfa_seguridad" && (
              <div style={{ width: "100%", maxWidth: "680px" }}>
                <WidgetConfiguracionMfa
                  correoUsuario={perfil?.usu_correo || ""}
                  onExitoAccion={() => setWidgetActivo(null)}
                />
              </div>
            )}

            {/* WIDGET 3: SEGURIDAD Y SESIÓN */}
            {widgetActivo === "sesion" && (
              <div className="bloque-seguridad">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <CheckCircle2 size={24} color="var(--esmeralda, #05876e)" />
                  <div>
                    <strong style={{ display: "block", color: "var(--negro, #111111)" }}>Sesión Activa Segura</strong>
                    <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
                      Tu cuenta está conectada de forma cifrada mediante autenticación unificada.
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", marginTop: "16px" }}>
                  <button
                    type="button"
                    onClick={() => cerrarSesionYRedirigir()}
                    className="btn-mini"
                    style={{
                      background: "rgba(176, 0, 32, 0.08)",
                      border: "1px solid rgba(176, 0, 32, 0.3)",
                      color: "#B00020",
                      padding: "10px 20px",
                      fontWeight: 700
                    }}
                  >
                    Cerrar Sesión en este Dispositivo
                  </button>
                </div>
              </div>
            )}

            {/* WIDGET 3.5: ACTIVE ROLE SWITCHER (Gobernanza) */}
            {widgetActivo === "rol_activo" && (
              <div style={{ width: "100%", maxWidth: "800px" }}>
                <SelectorRolActivo ocultarEtiqueta roles={rolesDisponibles} />
              </div>
            )}

            {/* WIDGET 4: ZONA DE PELIGRO - BAJA DE CUENTA */}
            {widgetActivo === "peligro" && (
              <div style={{ width: "100%", maxWidth: "640px" }}>
                <EliminarCuenta />
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // VISTA 1: REJILLA PRINCIPAL DE WIDGETS DE MI CUENTA
  return (
    <div style={{ width: "100%" }}>
      {/* Header Hero Card del Panel Mi Cuenta */}
      <section className="tarjeta-proteccion" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Centro de Configuración de Cuenta</div>
            <div className="tarjeta-proteccion-plan">
              Mi Cuenta — <i>Identidad & Preferencias</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Gestiona tu información personal, correo electrónico, WhatsApp, historial de accesos y seguridad de la cuenta.
            </div>
          </div>
        </div>
      </section>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Widgets de Mi Cuenta
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
            ⭐ {favoritos.length} Favoritos
          </span>
        </div>

        {/* Rejilla de Widgets */}
        <div className="accesos-cliente">
          {widgetsOrdenados.map((w) => {
            const infoCustom = getWidgetInfo(w.id, w.titulo, w.subtitulo);
            const IconoComponente = obtenerIconoComponente(infoCustom.iconoKey, w.icono);
            const esFav = favoritos.includes(w.id);

            return (
              <div
                key={w.id}
                onClick={() => handleIntentarAbrirWidget(w.id, w)}
                className="tarjeta-acceso"
                style={{
                  border: w.esPeligro ? "1px solid rgba(176, 0, 32, 0.3)" : "1px solid var(--panel-linea, #E4E4E4)",
                  background: w.esPeligro ? "rgba(176, 0, 32, 0.02)" : undefined,
                  cursor: "pointer",
                  position: "relative",
                  textDecoration: "none",
                  color: "inherit"
                }}
              >
                {/* Acciones en esquina superior derecha (Estrella Favorito + Botón Lápiz Edición para Admin/Superadmin) */}
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    zIndex: 2
                  }}
                >
                  {esAdminOSuper && (
                    <button
                      type="button"
                      title="Editar Título, Descripción e Ícono del Widget"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWidgetEditar({
                          id: w.id,
                          titulo: infoCustom.titulo,
                          subtitulo: infoCustom.subtitulo,
                          iconoKey: infoCustom.iconoKey,
                          requiereMfa: infoCustom.requiereMfa,
                          tiempoMfaMinutos: infoCustom.tiempoMfaMinutos,
                        });
                      }}
                      style={{
                        background: "rgba(255,255,255,0.9)",
                        border: "1px solid var(--panel-linea, #E4E4E4)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        padding: "4px",
                        color: "var(--panel-gris, #737373)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  <button
                    type="button"
                    title={esFav ? "Quitar de favoritos" : "Marcar como favorito"}
                    onClick={e => toggleFavorito(e, w.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "3px",
                      color: esFav ? "#D97706" : "var(--panel-gris, #737373)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Star size={16} fill={esFav ? "#FEE300" : "none"} stroke={esFav ? "#D97706" : "currentColor"} />
                  </button>
                </div>

                <div className="tarjeta-acceso-icono" style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconoComponente size={20} color={w.esPeligro ? "#B00020" : undefined} />
                </div>

                <div style={{ minWidth: 0, marginTop: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {esFav && (
                      <span
                        style={{
                          fontSize: "0.58rem",
                          fontWeight: 800,
                          color: "#92400E",
                          background: "var(--amarillo, #FEE300)",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          letterSpacing: "0.04em"
                        }}
                      >
                        FAVORITO
                      </span>
                    )}
                    {infoCustom.requiereMfa && (
                      <span
                        style={{
                          fontSize: "0.58rem",
                          fontWeight: 800,
                          color: "var(--violeta, #5000BA)",
                          background: "var(--violeta-suave, #F3E8FF)",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px"
                        }}
                      >
                        <Lock size={10} /> MFA
                      </span>
                    )}
                  </div>

                  <strong style={{ display: "block", color: w.esPeligro ? "#B00020" : undefined, lineHeight: 1.25 }}>
                    {infoCustom.titulo}
                  </strong>
                </div>

                <p style={{ margin: "4px 0 0 0" }}>{infoCustom.subtitulo}</p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    marginTop: "auto",
                    paddingTop: "10px",
                    color: w.esPeligro ? "#B00020" : "var(--violeta, #5000BA)"
                  }}
                >
                  <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para Editar Título, Subtítulo, Ícono y MFA de Widget */}
      {widgetEditar && (
        <ModalEditarWidget
          abierto={Boolean(widgetEditar)}
          onCerrar={() => setWidgetEditar(null)}
          widgetId={widgetEditar.id}
          tituloActual={widgetEditar.titulo}
          subtituloActual={widgetEditar.subtitulo}
          iconoActualKey={widgetEditar.iconoKey}
          requiereMfaActual={widgetEditar.requiereMfa}
          tiempoMfaActualMinutos={widgetEditar.tiempoMfaMinutos}
          onGuardar={(id, nuevoTitulo, nuevoSubtitulo, nuevoIconoKey, nuevoRequiereMfa, nuevoTiempoMfaMinutos) => {
            guardarWidget(id, nuevoTitulo, nuevoSubtitulo, nuevoIconoKey, nuevoRequiereMfa, nuevoTiempoMfaMinutos);
          }}
        />
      )}

      {/* Modal para Verificación MFA por Inactividad */}
      {widgetMfaPendiente && (
        <ModalVerificarMFAWidget
          abierto={Boolean(widgetMfaPendiente)}
          onCerrar={() => setWidgetMfaPendiente(null)}
          tituloWidget={widgetMfaPendiente.titulo}
          tiempoInactividadMinutos={widgetMfaPendiente.tiempoMinutos}
          onVerificado={handleConfirmarMfaExitoso}
        />
      )}
    </div>
  );
}
