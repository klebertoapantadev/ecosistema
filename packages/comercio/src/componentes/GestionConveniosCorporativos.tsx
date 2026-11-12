"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Percent,
  Video,
  Users,
  Edit2,
  Trash2,
  Mail,
  Calendar,
  X,
  Save,
  RefreshCw,
  Gift,
  UserPlus,
  Send,
  AlertTriangle,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  obtenerConveniosEmpresaAction,
  guardarConvenioEmpresaAction,
  alternarEstadoConvenioAction,
  eliminarConvenioEmpresaAction,
  obtenerBeneficiariosConvenioAction,
  registrarBeneficiarioConvenioAction,
  cambiarEstadoBeneficiarioConvenioAction,
  eliminarBeneficiarioConvenioAction,
  enviarCorreoBienvenidaConvenioAction,
  type ConvenioEmpresa,
  type BeneficiarioEmpresa,
  type ReglaDescuentoProducto,
} from "../acciones-convenios";
import { obtenerCatalogoProductosAction, type ProductoCatalogo } from "../acciones";

interface Props {
  negocio?: string;
  modoVista?: "admin" | "operador";
}

export function GestionConveniosCorporativos({ negocio = "tranqi" }: Props) {
  const [convenios, setConvenios] = useState<ConvenioEmpresa[]>([]);
  const [productosDisponibles, setProductosDisponibles] = useState<ProductoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");

  // Modal de Crear / Editar Convenio
  const [modalAbierto, setModalAbierto] = useState(false);
  const [convenioEnEdicion, setConvenioEnEdicion] = useState<ConvenioEmpresa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensajeNotificacion, setMensajeNotificacion] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Formulario de edición de convenio
  const [formNombre, setFormNombre] = useState("");
  const [formRuc, setFormRuc] = useState("");
  const [formDominio, setFormDominio] = useState("");
  const [formValidoHasta, setFormValidoHasta] = useState("");
  const [formCupoColaboradores, setFormCupoColaboradores] = useState(50);
  const [formActivo, setFormActivo] = useState(true);

  // Paquete de Beneficios
  const [formConsultasGratis, setFormConsultasGratis] = useState(2);
  const [formFrecuenciaConsultas, setFormFrecuenciaConsultas] = useState<"ANUAL" | "MENSUAL">("ANUAL");
  const [formDescuentoGeneral, setFormDescuentoGeneral] = useState(15);
  const [formExcepciones, setFormExcepciones] = useState<ReglaDescuentoProducto[]>([
    { producto_nombre: "Notarización de Documentos & Poderes", producto_slug: "notarizacion-documentos-poderes", descuento_pct: 10 },
  ]);
  const [formBonoBilletera, setFormBonoBilletera] = useState(0);
  const [formContactoRrhhNombre, setFormContactoRrhhNombre] = useState("");
  const [formContactoRrhhCorreo, setFormContactoRrhhCorreo] = useState("");

  // Modal de Control de Colaboradores Registrados bajo un Convenio
  const [convenioColaboradoresModal, setConvenioColaboradoresModal] = useState<ConvenioEmpresa | null>(null);
  const [listaColaboradores, setListaColaboradores] = useState<BeneficiarioEmpresa[]>([]);
  const [cargandoColaboradores, setCargandoColaboradores] = useState(false);
  const [busquedaColaborador, setBusquedaColaborador] = useState("");
  const [nuevoColabNombre, setNuevoColabNombre] = useState("");
  const [nuevoColabCorreo, setNuevoColabCorreo] = useState("");
  const [nuevoColabIdentificacion, setNuevoColabIdentificacion] = useState("");
  const [nuevoColabCargo, setNuevoColabCargo] = useState("");
  const [nuevoColabEnviarBienvenida, setNuevoColabEnviarBienvenida] = useState(true);
  const [procesandoColaborador, setProcesandoColaborador] = useState(false);
  const [enviandoCorreoId, setEnviandoCorreoId] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`tranqi_convenios_b2b_${negocio}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setConvenios(parsed);
            }
          } catch {}
        }
      }

      const [listaConvenios, catalogo] = await Promise.all([
        obtenerConveniosEmpresaAction(negocio),
        obtenerCatalogoProductosAction(negocio, "ECOMMERCE_WEB"),
      ]);

      if (Array.isArray(listaConvenios) && listaConvenios.length > 0) {
        setConvenios(listaConvenios);
        if (typeof window !== "undefined") {
          localStorage.setItem(`tranqi_convenios_b2b_${negocio}`, JSON.stringify(listaConvenios));
        }
      }
      setProductosDisponibles(catalogo);
    } catch (err) {
      console.error("Error al cargar convenios:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

  const obtenerCupoHabilitado = (c: ConvenioEmpresa): number => {
    const val = c.cve_cupo_colaboradores ?? c.cve_detalle_convenio?.cupo_colaboradores_habilitados ?? 50;
    return Number(val) > 0 ? Number(val) : 50;
  };

  const abrirModalCrear = () => {
    setConvenioEnEdicion(null);
    setFormNombre("");
    setFormRuc("");
    setFormDominio("@");
    setFormValidoHasta(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] || "");
    setFormCupoColaboradores(50);
    setFormActivo(true);
    setFormConsultasGratis(2);
    setFormFrecuenciaConsultas("ANUAL");
    setFormDescuentoGeneral(15);
    setFormExcepciones([
      { producto_nombre: "Notarización de Documentos & Poderes", producto_slug: "notarizacion-documentos-poderes", descuento_pct: 10 },
    ]);
    setFormBonoBilletera(0);
    setFormContactoRrhhNombre("");
    setFormContactoRrhhCorreo("");
    setModalAbierto(true);
  };

  const abrirModalEditar = (c: ConvenioEmpresa) => {
    setConvenioEnEdicion(c);
    setFormNombre(c.cve_empresa_nombre || "");
    setFormRuc(c.cve_empresa_ruc || "");
    setFormDominio(c.cve_dominio_correo || c.cve_detalle_convenio?.dominios_autorizados?.[0] || "");
    setFormValidoHasta(c.cve_valido_hasta ? (c.cve_valido_hasta.split("T")[0] || "") : "");
    setFormCupoColaboradores(obtenerCupoHabilitado(c));
    setFormActivo(c.cve_activo);

    const paquete = c.cve_detalle_convenio?.paquete_beneficios;
    setFormConsultasGratis(paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2);
    setFormFrecuenciaConsultas(paquete?.bolsa_derechos?.consultas_telematicas?.frecuencia === "MENSUAL" ? "MENSUAL" : "ANUAL");
    setFormDescuentoGeneral(paquete?.reglas_descuento?.descuento_general_servicios_pct ?? 15);
    setFormExcepciones(paquete?.reglas_descuento?.excepciones_por_producto || []);
    setFormBonoBilletera(paquete?.billetera_bono_inicial || 0);
    setFormContactoRrhhNombre(c.cve_detalle_convenio?.contacto_rrhh?.nombre || "");
    setFormContactoRrhhCorreo(c.cve_detalle_convenio?.contacto_rrhh?.correo || "");
    setModalAbierto(true);
  };

  const abrirModalColaboradores = async (c: ConvenioEmpresa) => {
    setConvenioColaboradoresModal(c);
    setBusquedaColaborador("");
    setNuevoColabNombre("");
    setNuevoColabCorreo(c.cve_dominio_correo && c.cve_dominio_correo.startsWith("@") ? "" : "");
    setNuevoColabIdentificacion("");
    setNuevoColabCargo("");
    setNuevoColabEnviarBienvenida(true);
    setCargandoColaboradores(true);
    try {
      const res = await obtenerBeneficiariosConvenioAction(c.cve_id, negocio);
      setListaColaboradores(res.beneficiarios || []);
      // Actualizar conteos en la tarjeta del convenio
      setConvenios((prev) =>
        prev.map((item) =>
          item.cve_id === c.cve_id
            ? {
                ...item,
                total_beneficiarios: res.beneficiarios.length,
                beneficiarios_activos: res.registradosActivos,
              }
            : item
        )
      );
    } catch (err) {
      console.error("Error al cargar colaboradores del convenio:", err);
    } finally {
      setCargandoColaboradores(false);
    }
  };

  const handleGuardarConvenio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      setMensajeNotificacion({ tipo: "error", texto: "El nombre de la empresa es obligatorio." });
      return;
    }

    const cupoValidado = Math.max(1, Number(formCupoColaboradores) || 1);

    setGuardando(true);
    try {
      const detalleConvenio = {
        ...(convenioEnEdicion?.cve_detalle_convenio || {}),
        cupo_colaboradores_habilitados: cupoValidado,
        paquete_beneficios: {
          bolsa_derechos: {
            consultas_telematicas: {
              cupos_incluidos: Number(formConsultasGratis),
              frecuencia: formFrecuenciaConsultas,
              precio_liquidado: 0.0,
              reagendamiento_gratuito: false,
            },
          },
          reglas_descuento: {
            descuento_general_servicios_pct: Number(formDescuentoGeneral),
            excepciones_por_producto: formExcepciones,
          },
          billetera_bono_inicial: Number(formBonoBilletera),
        },
        dominios_autorizados: formDominio.trim() ? [formDominio.trim()] : [],
        auto_afiliacion_dominio: Boolean(formDominio.trim()),
        contacto_rrhh: {
          nombre: formContactoRrhhNombre.trim(),
          correo: formContactoRrhhCorreo.trim(),
        },
      };

      const payload: Partial<ConvenioEmpresa> & { negocio?: string } = {
        cve_id: convenioEnEdicion?.cve_id,
        cve_empresa_nombre: formNombre.trim(),
        cve_empresa_ruc: formRuc.trim(),
        cve_dominio_correo: formDominio.trim(),
        cve_monto_bono_inicial: Number(formBonoBilletera),
        cve_porcentaje_subsidio: 100,
        cve_cupo_colaboradores: cupoValidado,
        cve_activo: formActivo,
        cve_valido_hasta: formValidoHasta ? `${formValidoHasta}T23:59:59Z` : null,
        cve_detalle_convenio: detalleConvenio,
        total_beneficiarios: convenioEnEdicion?.total_beneficiarios ?? 0,
        beneficiarios_activos: convenioEnEdicion?.beneficiarios_activos ?? 0,
        negocio,
      };

      const res = await guardarConvenioEmpresaAction(payload);
      if (res.ok && res.convenio) {
        setConvenios((prev) => {
          const idx = prev.findIndex(
            (c) =>
              c.cve_id === res.convenio!.cve_id ||
              (convenioEnEdicion && c.cve_id === convenioEnEdicion.cve_id) ||
              c.cve_empresa_nombre.toLowerCase() === res.convenio!.cve_empresa_nombre.toLowerCase()
          );
          let nuevaLista: ConvenioEmpresa[];
          if (idx >= 0) {
            nuevaLista = [...prev];
            nuevaLista[idx] = {
              ...res.convenio!,
              total_beneficiarios: prev[idx]?.total_beneficiarios ?? res.convenio!.total_beneficiarios ?? 0,
              beneficiarios_activos: prev[idx]?.beneficiarios_activos ?? res.convenio!.beneficiarios_activos ?? 0,
            };
          } else {
            nuevaLista = [res.convenio!, ...prev];
          }

          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`tranqi_convenios_b2b_${negocio}`, JSON.stringify(nuevaLista));
            } catch {}
          }

          return nuevaLista;
        });
        setModalAbierto(false);
        setMensajeNotificacion({
          tipo: "ok",
          texto: `Convenio con ${formNombre} guardado (${cupoValidado} colaboradores habilitados).`,
        });
      } else {
        setMensajeNotificacion({ tipo: "error", texto: res.error || "No se pudo guardar el convenio." });
      }
    } catch (err: any) {
      setMensajeNotificacion({ tipo: "error", texto: err.message || "Error al procesar el convenio." });
    } finally {
      setGuardando(false);
    }
  };

  const handleRegistrarColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convenioColaboradoresModal) return;

    const cupoMax = obtenerCupoHabilitado(convenioColaboradoresModal);
    const activosCount = listaColaboradores.filter(
      (b) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
    ).length;

    if (activosCount >= cupoMax) {
      setMensajeNotificacion({
        tipo: "error",
        texto: `El convenio con ${convenioColaboradoresModal.cve_empresa_nombre} alcanzó su límite de ${cupoMax} colaboradores habilitados.`,
      });
      return;
    }

    setProcesandoColaborador(true);
    try {
      const res = await registrarBeneficiarioConvenioAction({
        convenioId: convenioColaboradoresModal.cve_id,
        negocio,
        nombres: nuevoColabNombre,
        correoCorporativo: nuevoColabCorreo,
        identificacion: nuevoColabIdentificacion,
        cargo: nuevoColabCargo,
        enviarBienvenida: nuevoColabEnviarBienvenida,
      });

      if (res.ok && res.beneficiario) {
        const nuevaLista = [
          res.beneficiario,
          ...listaColaboradores.filter(
            (b) =>
              b.bnf_id !== res.beneficiario!.bnf_id &&
              (b.bnf_correo_corporativo || "").toLowerCase() !== (res.beneficiario!.bnf_correo_corporativo || "").toLowerCase()
          ),
        ];
        setListaColaboradores(nuevaLista);
        const nuevosActivos = nuevaLista.filter(
          (b) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
        ).length;

        setConvenios((prev) =>
          prev.map((c) =>
            c.cve_id === convenioColaboradoresModal.cve_id
              ? { ...c, total_beneficiarios: nuevaLista.length, beneficiarios_activos: nuevosActivos }
              : c
          )
        );

        setNuevoColabNombre("");
        setNuevoColabCorreo("");
        setNuevoColabIdentificacion("");
        setNuevoColabCargo("");

        setMensajeNotificacion({
          tipo: "ok",
          texto: nuevoColabEnviarBienvenida
            ? `Colaborador registrado en ${convenioColaboradoresModal.cve_empresa_nombre} y correo de bienvenida con beneficios enviado.`
            : `Colaborador registrado en ${convenioColaboradoresModal.cve_empresa_nombre}.`,
        });
      } else {
        setMensajeNotificacion({
          tipo: "error",
          texto: res.error || "No se pudo registrar al colaborador.",
        });
      }
    } catch (err: any) {
      setMensajeNotificacion({
        tipo: "error",
        texto: err?.message || "Error al registrar colaborador.",
      });
    } finally {
      setProcesandoColaborador(false);
    }
  };

  const handleCambiarEstadoColaborador = async (b: BeneficiarioEmpresa) => {
    if (!convenioColaboradoresModal) return;
    const nuevoEstado: "VINCULADO" | "INACTIVO" = b.bnf_estado === "INACTIVO" ? "VINCULADO" : "INACTIVO";
    const res = await cambiarEstadoBeneficiarioConvenioAction({
      bnfId: b.bnf_id,
      convenioId: convenioColaboradoresModal.cve_id,
      nuevoEstado,
      negocio,
    });
    if (!res.ok) {
      setMensajeNotificacion({ tipo: "error", texto: res.error || "No se pudo cambiar el estado." });
      return;
    }

    const actualizada = listaColaboradores.map((item) =>
      item.bnf_id === b.bnf_id ? { ...item, bnf_estado: nuevoEstado } : item
    );
    setListaColaboradores(actualizada);
    const activos = actualizada.filter(
      (item) => item.bnf_estado === "VINCULADO" || item.bnf_estado === "PENDIENTE"
    ).length;
    setConvenios((prev) =>
      prev.map((c) =>
        c.cve_id === convenioColaboradoresModal.cve_id
          ? { ...c, beneficiarios_activos: activos, total_beneficiarios: actualizada.length }
          : c
      )
    );
  };

  const handleEliminarColaborador = async (b: BeneficiarioEmpresa) => {
    if (!convenioColaboradoresModal) return;
    if (!confirm(`¿Quitar a "${b.bnf_nombres || b.bnf_correo_corporativo}" del convenio y liberar su cupo?`)) {
      return;
    }
    const res = await eliminarBeneficiarioConvenioAction({
      bnfId: b.bnf_id,
      convenioId: convenioColaboradoresModal.cve_id,
      negocio,
    });
    if (res.ok) {
      const actualizada = listaColaboradores.filter((item) => item.bnf_id !== b.bnf_id);
      setListaColaboradores(actualizada);
      const activos = actualizada.filter(
        (item) => item.bnf_estado === "VINCULADO" || item.bnf_estado === "PENDIENTE"
      ).length;
      setConvenios((prev) =>
        prev.map((c) =>
          c.cve_id === convenioColaboradoresModal.cve_id
            ? { ...c, beneficiarios_activos: activos, total_beneficiarios: actualizada.length }
            : c
        )
      );
      setMensajeNotificacion({ tipo: "ok", texto: "Colaborador retirado del convenio y cupo liberado." });
    }
  };

  const handleReenviarBienvenida = async (b: BeneficiarioEmpresa) => {
    if (!convenioColaboradoresModal) return;
    const correo = b.bnf_correo_corporativo || b.bnf_identificacion;
    if (!correo || !correo.includes("@")) {
      setMensajeNotificacion({ tipo: "error", texto: "El colaborador no tiene un correo electrónico válido." });
      return;
    }
    setEnviandoCorreoId(b.bnf_id);
    try {
      const res = await enviarCorreoBienvenidaConvenioAction({
        bnfId: b.bnf_id,
        convenioId: convenioColaboradoresModal.cve_id,
        correo,
        nombres: b.bnf_nombres,
        negocio,
      });
      if (res.ok) {
        const ahora = new Date().toISOString();
        setListaColaboradores((prev) =>
          prev.map((item) =>
            item.bnf_id === b.bnf_id
              ? {
                  ...item,
                  bnf_detalle_beneficiario: {
                    ...(item.bnf_detalle_beneficiario || {}),
                    correo_bienvenida_enviado: true,
                    correo_bienvenida_fecha: ahora,
                  },
                }
              : item
          )
        );
        setMensajeNotificacion({
          tipo: "ok",
          texto: `Correo de bienvenida con los beneficios del convenio enviado a ${correo}.`,
        });
      } else {
        setMensajeNotificacion({
          tipo: "error",
          texto: res.error || "No se pudo enviar el correo de bienvenida.",
        });
      }
    } finally {
      setEnviandoCorreoId(null);
    }
  };

  const handleAlternarEstado = async (cveId: string, estadoActual: boolean) => {
    const nuevoEstado = !estadoActual;
    setConvenios((prev) =>
      prev.map((c) => (c.cve_id === cveId ? { ...c, cve_activo: nuevoEstado } : c))
    );
    await alternarEstadoConvenioAction(cveId, nuevoEstado, negocio);
  };

  const handleEliminarConvenio = async (cveId: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar definitivamente el convenio con "${nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setConvenios((prev) => prev.filter((c) => c.cve_id !== cveId));
    await eliminarConvenioEmpresaAction(cveId, negocio);
    setMensajeNotificacion({ tipo: "ok", texto: `Convenio con ${nombre} eliminado exitosamente.` });
  };

  const handleAgregarExcepcion = (productoNombre: string, productoSlug: string) => {
    if (formExcepciones.some((e) => e.producto_nombre === productoNombre)) return;
    setFormExcepciones((prev) => [
      ...prev,
      { producto_nombre: productoNombre, producto_slug: productoSlug, descuento_pct: 10 },
    ]);
  };

  const handleQuitarExcepcion = (index: number) => {
    setFormExcepciones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleActualizarDescuentoExcepcion = (index: number, pct: number) => {
    setFormExcepciones((prev) =>
      prev.map((e, i) => (i === index ? { ...e, descuento_pct: pct } : e))
    );
  };

  const conveniosFiltrados = useMemo(() => {
    return convenios.filter((c) => {
      if (filtroEstado === "activos" && !c.cve_activo) return false;
      if (filtroEstado === "inactivos" && c.cve_activo) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const coincideNombre = c.cve_empresa_nombre?.toLowerCase().includes(q);
        const coincideRuc = c.cve_empresa_ruc?.toLowerCase().includes(q);
        const coincideDominio = c.cve_dominio_correo?.toLowerCase().includes(q);
        if (!coincideNombre && !coincideRuc && !coincideDominio) return false;
      }
      return true;
    });
  }, [convenios, filtroEstado, busqueda]);

  const colaboradoresFiltrados = useMemo(() => {
    if (!busquedaColaborador.trim()) return listaColaboradores;
    const q = busquedaColaborador.toLowerCase().trim();
    return listaColaboradores.filter(
      (b) =>
        b.bnf_nombres?.toLowerCase().includes(q) ||
        b.bnf_correo_corporativo?.toLowerCase().includes(q) ||
        b.bnf_identificacion?.toLowerCase().includes(q)
    );
  }, [listaColaboradores, busquedaColaborador]);

  const totalActivos = convenios.filter((c) => c.cve_activo).length;
  const totalRegistradosGlobal = convenios.reduce(
    (acc, c) => acc + (c.beneficiarios_activos ?? c.total_beneficiarios ?? 0),
    0
  );
  const totalCuposHabilitadosGlobal = convenios
    .filter((c) => c.cve_activo)
    .reduce((acc, c) => acc + obtenerCupoHabilitado(c), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Banner Notificación */}
      {mensajeNotificacion && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "12px",
            background: mensajeNotificacion.tipo === "ok" ? "#ECFDF5" : "#FEF2F2",
            border: mensajeNotificacion.tipo === "ok" ? "1px solid #10B981" : "1px solid #EF4444",
            color: mensajeNotificacion.tipo === "ok" ? "#065F46" : "#991B1B",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {mensajeNotificacion.tipo === "ok" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{mensajeNotificacion.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeNotificacion(null)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit" }}
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Cabecera & Métricas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
            color: "#FFFFFF",
            padding: "18px 20px",
            borderRadius: "16px",
            boxShadow: "0 8px 24px -10px rgba(30, 27, 75, 0.5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85 }}>
              Convenios Activos
            </span>
            <Building2 size={20} opacity={0.8} />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{totalActivos}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.75, marginTop: "4px" }}>
            Empresas y entidades corporativas aliadas
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            padding: "18px 20px",
            borderRadius: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
              Beneficios Desplegados
            </span>
            <Gift size={20} color="#0284C7" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A" }}>2 Citas + 15% Desc.</div>
          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
            Bienvenida automática por correo al registrarse
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            padding: "18px 20px",
            borderRadius: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
              Control de Colaboradores
            </span>
            <Users size={20} color="#10B981" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A" }}>
            {totalRegistradosGlobal}{" "}
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#64748B" }}>
              / {totalCuposHabilitadosGlobal} habilitados
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
            {Math.max(0, totalCuposHabilitadosGlobal - totalRegistradosGlobal)} cupos disponibles en convenios activos
          </div>
        </div>
      </div>

      {/* Barra de Controles y Búsqueda */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "#FFFFFF",
          padding: "14px 18px",
          borderRadius: "14px",
          border: "1px solid #E2E8F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Buscar empresa por nombre, RUC o dominio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", background: "#F1F5F9", padding: "3px", borderRadius: "10px" }}>
            <button
              type="button"
              onClick={() => setFiltroEstado("todos")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.78rem",
                fontWeight: 700,
                background: filtroEstado === "todos" ? "#FFFFFF" : "transparent",
                color: filtroEstado === "todos" ? "#0F172A" : "#64748B",
                boxShadow: filtroEstado === "todos" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
              }}
            >
              Todos ({convenios.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("activos")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.78rem",
                fontWeight: 700,
                background: filtroEstado === "activos" ? "#FFFFFF" : "transparent",
                color: filtroEstado === "activos" ? "#16A34A" : "#64748B",
                boxShadow: filtroEstado === "activos" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
              }}
            >
              Activos ({totalActivos})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("inactivos")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.78rem",
                fontWeight: 700,
                background: filtroEstado === "inactivos" ? "#FFFFFF" : "transparent",
                color: filtroEstado === "inactivos" ? "#DC2626" : "#64748B",
                boxShadow: filtroEstado === "inactivos" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
              }}
            >
              Inactivos ({convenios.length - totalActivos})
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={cargarDatos}
            className="btn-responsive-accion"
            title="Actualizar lista de convenios"
            aria-label="Actualizar lista de convenios"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} />
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
          <button
            type="button"
            onClick={abrirModalCrear}
            className="btn-responsive-accion"
            title="Crear nuevo convenio corporativo"
            aria-label="Crear nuevo convenio corporativo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              background: "#10B981",
              color: "#FFFFFF",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            }}
          >
            <Plus size={16} />
            <span className="btn-texto-responsive">Nuevo Convenio</span>
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Convenios */}
      {cargando ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748B", fontSize: "0.9rem" }}>
          Cargando convenios corporativos...
        </div>
      ) : conveniosFiltrados.length === 0 ? (
        <div
          style={{
            padding: "50px 20px",
            textAlign: "center",
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1.5px dashed #CBD5E1",
          }}
        >
          <Building2 size={40} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: "1.1rem" }}>No se encontraron convenios</h3>
          <p style={{ margin: "0 0 16px", color: "#64748B", fontSize: "0.85rem" }}>
            No hay convenios corporativos que coincidan con los criterios de búsqueda.
          </p>
          <button
            type="button"
            onClick={abrirModalCrear}
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#10B981",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Nuevo Convenio
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "16px",
          }}
        >
          {conveniosFiltrados.map((c) => {
            const paquete = c.cve_detalle_convenio?.paquete_beneficios;
            const consultas = paquete?.bolsa_derechos?.consultas_telematicas?.cupos_incluidos ?? 2;
            const frecuencia = paquete?.bolsa_derechos?.consultas_telematicas?.frecuencia === "MENSUAL" ? "mensuales" : "anuales";
            const descGeneral = paquete?.reglas_descuento?.descuento_general_servicios_pct ?? 15;
            const excepciones = paquete?.reglas_descuento?.excepciones_por_producto || [];

            const cupoMax = obtenerCupoHabilitado(c);
            const registrados = c.beneficiarios_activos ?? c.total_beneficiarios ?? 0;
            const disponibles = Math.max(0, cupoMax - registrados);
            const pctUso = Math.min(100, Math.round((registrados / cupoMax) * 100));
            const cupoLleno = registrados >= cupoMax;

            return (
              <article
                key={c.cve_id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  border: c.cve_activo ? "1.5px solid #E2E8F0" : "1.5px dashed #CBD5E1",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  boxShadow: "0 4px 16px -6px rgba(0,0,0,0.05)",
                  opacity: c.cve_activo ? 1 : 0.75,
                }}
              >
                {/* Cabecera Tarjeta */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: c.cve_activo ? "#EEF2FF" : "#F1F5F9",
                        color: c.cve_activo ? "#4F46E5" : "#64748B",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        fontSize: "1.1rem",
                      }}
                    >
                      {c.cve_empresa_nombre.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
                        {c.cve_empresa_nombre}
                      </h3>
                      {c.cve_empresa_ruc && (
                        <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
                          RUC: {c.cve_empresa_ruc}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAlternarEstado(c.cve_id, c.cve_activo)}
                    title={c.cve_activo ? "Convenio activo. Clic para pausar." : "Convenio pausado. Clic para activar."}
                    aria-label={c.cve_activo ? "Pausar convenio" : "Activar convenio"}
                    style={{
                      border: "none",
                      background: c.cve_activo ? "#DCFCE7" : "#F1F5F9",
                      color: c.cve_activo ? "#166534" : "#64748B",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {c.cve_activo ? "🟢 ACTIVO" : "⚪ PAUSADO"}
                  </button>
                </div>

                {/* Dominio & Auto-afiliación */}
                {c.cve_dominio_correo && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      fontSize: "0.78rem",
                      color: "#4F46E5",
                      background: "#EEF2FF",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Mail size={14} />
                      <span>
                        Auto-afiliación: <strong>{c.cve_dominio_correo}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#05876E", fontWeight: 800 }}>
                      ✉️ Bienvenida Activa
                    </span>
                  </div>
                )}

                {/* Control de Cupo de Colaboradores Habilitados */}
                <div
                  style={{
                    background: cupoLleno ? "#FEF2F2" : "#F0FDF4",
                    border: cupoLleno ? "1px solid #FECACA" : "1px solid #BBF7D0",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 800, color: "#0F172A" }}>
                      <Users size={15} color={cupoLleno ? "#DC2626" : "#059669"} />
                      <span>
                        Colaboradores: {registrados} / {cupoMax} habilitados
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: cupoLleno ? "#FEE2E2" : "#DCFCE7",
                        color: cupoLleno ? "#991B1B" : "#166534",
                      }}
                    >
                      {cupoLleno ? "Cupo Lleno" : `${disponibles} disponibles`}
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "7px",
                      borderRadius: "999px",
                      background: "#E2E8F0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pctUso}%`,
                        height: "100%",
                        borderRadius: "999px",
                        background: cupoLleno ? "#EF4444" : pctUso >= 80 ? "#F59E0B" : "#10B981",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Resumen del Paquete de Beneficios */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569" }}>
                    🎁 Paquete de Beneficios (Enviado en Correo de Bienvenida):
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "#0F172A" }}>
                    <Video size={16} color="#0284C7" />
                    <span>
                      <strong>{consultas} Consultas Telemáticas ({frecuencia})</strong> al 100% ($0.00).
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "#0F172A" }}>
                    <Percent size={16} color="#10B981" />
                    <span>
                      <strong>{descGeneral}% de descuento</strong> general en servicios jurídicos.
                    </span>
                  </div>

                  {excepciones.length > 0 && (
                    <div style={{ marginTop: "2px", borderTop: "1px dashed #CBD5E1", paddingTop: "6px", fontSize: "0.78rem", color: "#64748B" }}>
                      <strong style={{ color: "#334155" }}>Reglas específicas:</strong>
                      <ul style={{ margin: "4px 0 0", paddingLeft: "16px" }}>
                        {excepciones.map((ex, idx) => (
                          <li key={idx}>
                            {ex.producto_nombre}: <strong>{ex.descuento_pct}% descuento</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Pie de Tarjeta / Acciones */}
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid #F1F5F9", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748B", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Calendar size={13} />
                    <span>Vence: {c.cve_valido_hasta ? new Date(c.cve_valido_hasta).toLocaleDateString() : "Indefinido"}</span>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => abrirModalColaboradores(c)}
                      className="btn-responsive-accion"
                      title="Controlar personas registradas bajo este convenio"
                      aria-label="Controlar colaboradores del convenio"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid #A7F3D0",
                        background: "#ECFDF5",
                        color: "#065F46",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Users size={13} />
                      <span className="btn-texto-responsive">Colaboradores ({registrados}/{cupoMax})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => abrirModalEditar(c)}
                      className="btn-responsive-accion"
                      title="Editar convenio y cupo de colaboradores"
                      aria-label="Editar convenio"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#0F172A",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Edit2 size={13} />
                      <span className="btn-texto-responsive">Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEliminarConvenio(c.cve_id, c.cve_empresa_nombre)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "8px",
                        border: "1px solid #FCA5A5",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                      title="Eliminar convenio"
                      aria-label="Eliminar convenio"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Crear / Editar Convenio */}
      {modalAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              width: "min(660px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Building2 size={22} color="#4F46E5" />
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0F172A" }}>
                  {convenioEnEdicion ? `Editar Convenio · ${convenioEnEdicion.cve_empresa_nombre}` : "Nuevo Convenio Corporativo B2B"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748B" }}
                title="Cerrar modal"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarConvenio} style={{ display: "grid", gap: "14px" }}>
              {/* Sección 1: Datos de la Empresa */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Razón Social / Nombre Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. SATCOM"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    RUC Corporativo
                  </label>
                  <input
                    type="text"
                    placeholder="1790019283001"
                    value={formRuc}
                    onChange={(e) => setFormRuc(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Dominio de Correo (Auto-afiliación)
                  </label>
                  <input
                    type="text"
                    placeholder="@satcom.com.ec"
                    value={formDominio}
                    onChange={(e) => setFormDominio(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={formValidoHasta}
                    onChange={(e) => setFormValidoHasta(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              {/* Control de Número de Colaboradores Habilitados */}
              <div
                style={{
                  background: "#ECFDF5",
                  border: "1.5px solid #A7F3D0",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", fontWeight: 800, color: "#065F46", marginBottom: "4px" }}>
                    <Users size={15} color="#059669" />
                    N° de Colaboradores Habilitados *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={50000}
                    value={formCupoColaboradores}
                    onChange={(e) => setFormCupoColaboradores(Math.max(1, Number(e.target.value) || 1))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #10B981",
                      background: "#FFFFFF",
                      fontSize: "0.92rem",
                      fontWeight: 800,
                      color: "#0F172A",
                    }}
                  />
                  <span style={{ display: "block", fontSize: "0.72rem", color: "#047857", marginTop: "3px", fontWeight: 600 }}>
                    Registrados: {convenioEnEdicion?.beneficiarios_activos ?? 0} · Disponibles:{" "}
                    {Math.max(0, formCupoColaboradores - (convenioEnEdicion?.beneficiarios_activos ?? 0))}
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#065F46", marginBottom: "4px" }}>
                    Correo Contacto RRHH (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="rrhh@empresa.com"
                    value={formContactoRrhhCorreo}
                    onChange={(e) => setFormContactoRrhhCorreo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #A7F3D0",
                      background: "#FFFFFF",
                      fontSize: "0.85rem",
                    }}
                  />
                  <span style={{ display: "block", fontSize: "0.72rem", color: "#047857", marginTop: "3px" }}>
                    Control de nómina y alertas de cupo
                  </span>
                </div>
              </div>

              {/* Sección 2: Configuración del Paquete de Beneficios */}
              <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "14px", padding: "14px 16px", display: "grid", gap: "12px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1E1B4B", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Gift size={16} color="#4F46E5" /> Canasta de Beneficios Corporativos
                </div>

                {/* 1. Consultas Telemáticas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                      ⚖️ Consultas Telemáticas ($0.00):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={formConsultasGratis}
                      onChange={(e) => setFormConsultasGratis(Number(e.target.value))}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                      Frecuencia de Renovación:
                    </label>
                    <select
                      value={formFrecuenciaConsultas}
                      onChange={(e: any) => setFormFrecuenciaConsultas(e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                    >
                      <option value="ANUAL">Anual ({formConsultasGratis} al año)</option>
                      <option value="MENSUAL">Mensual ({formConsultasGratis} al mes)</option>
                    </select>
                  </div>
                </div>

                {/* 2. Descuento General */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                    🏷️ Descuento General en Servicios (%):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formDescuentoGeneral}
                      onChange={(e) => setFormDescuentoGeneral(Number(e.target.value))}
                      style={{ width: "120px", padding: "7px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.85rem", fontWeight: 700 }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                      Aplica para todo el tarifario de trámites y servicios legales
                    </span>
                  </div>
                </div>

                {/* 3. Excepciones / Descuentos específicos por producto */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                      🎯 Excepciones de Descuento por Producto:
                    </label>
                    {productosDisponibles.length > 0 && (
                      <select
                        onChange={(e) => {
                          const p = productosDisponibles.find((prod) => prod.pro_id === e.target.value);
                          if (p) handleAgregarExcepcion(p.pro_nombre, p.pro_slug);
                        }}
                        defaultValue=""
                        style={{ fontSize: "0.72rem", padding: "3px 6px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
                      >
                        <option value="" disabled>+ Agregar producto específico...</option>
                        {productosDisponibles.map((p) => (
                          <option key={p.pro_id} value={p.pro_id}>{p.pro_nombre}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: "6px" }}>
                    {formExcepciones.map((ex, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          fontSize: "0.8rem",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#0F172A", flex: 1 }}>{ex.producto_nombre}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={ex.descuento_pct}
                            onChange={(e) => handleActualizarDescuentoExcepcion(index, Number(e.target.value))}
                            style={{ width: "60px", padding: "4px 6px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.78rem", fontWeight: 700, textAlign: "center" }}
                          />
                          <span style={{ fontSize: "0.78rem", color: "#64748B" }}>%</span>
                          <button
                            type="button"
                            onClick={() => handleQuitarExcepcion(index)}
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#DC2626", padding: "2px" }}
                            title="Quitar excepción"
                            aria-label="Quitar excepción"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nota informativa del correo automático */}
                <div
                  style={{
                    background: "#EEF2FF",
                    border: "1px solid #C7D2FE",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "0.75rem",
                    color: "#3730A3",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Mail size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Cuando una persona se registra con este convenio (dentro de los <strong>{formCupoColaboradores} colaboradores habilitados</strong>), recibe automáticamente un <strong>correo de bienvenida</strong> con el detalle de estos beneficios.
                  </span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px", borderTop: "1px solid #F1F5F9", paddingTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#4F46E5",
                    color: "#FFFFFF",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Save size={16} /> {guardando ? "Guardando..." : "Guardar Convenio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Control de Colaboradores Registrados bajo el Convenio */}
      {convenioColaboradoresModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              width: "min(840px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Cabecera del Modal de Colaboradores */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", display: "grid", placeItems: "center" }}>
                  <Users size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0F172A" }}>
                    Control de Colaboradores · {convenioColaboradoresModal.cve_empresa_nombre}
                  </h2>
                  <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                    Dominio: <strong>{convenioColaboradoresModal.cve_dominio_correo || "Manual"}</strong> · RUC:{" "}
                    {convenioColaboradoresModal.cve_empresa_ruc || "N/D"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConvenioColaboradoresModal(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748B" }}
                title="Cerrar ventana"
                aria-label="Cerrar ventana"
              >
                <X size={20} />
              </button>
            </div>

            {/* Indicadores de Cupo del Convenio */}
            {(() => {
              const cupoMax = obtenerCupoHabilitado(convenioColaboradoresModal);
              const activos = listaColaboradores.filter(
                (b) => b.bnf_estado === "VINCULADO" || b.bnf_estado === "PENDIENTE"
              ).length;
              const disponibles = Math.max(0, cupoMax - activos);
              const lleno = activos >= cupoMax;

              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Colaboradores Habilitados
                    </div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                      {cupoMax}
                    </div>
                  </div>

                  <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "12px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4338CA", textTransform: "uppercase" }}>
                      Personas Registradas
                    </div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#312E81", marginTop: "2px" }}>
                      {activos}
                    </div>
                  </div>

                  <div
                    style={{
                      background: lleno ? "#FEF2F2" : "#ECFDF5",
                      border: lleno ? "1px solid #FECACA" : "1px solid #A7F3D0",
                      borderRadius: "12px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: lleno ? "#991B1B" : "#065F46", textTransform: "uppercase" }}>
                      Cupos Disponibles
                    </div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: lleno ? "#DC2626" : "#059669", marginTop: "2px" }}>
                      {disponibles}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Formulario para Registrar Nuevo Colaborador bajo el Convenio */}
            <form
              onSubmit={handleRegistrarColaborador}
              style={{
                background: "#F8FAFC",
                border: "1.5px solid #E2E8F0",
                borderRadius: "14px",
                padding: "14px 16px",
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                <UserPlus size={15} color="#059669" />
                <span>Registrar / Habilitar Persona en este Convenio</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
                <input
                  type="text"
                  required
                  placeholder="Nombres y Apellidos *"
                  value={nuevoColabNombre}
                  onChange={(e) => setNuevoColabNombre(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
                />
                <input
                  type="email"
                  required
                  placeholder={`Correo (${convenioColaboradoresModal.cve_dominio_correo || "corporativo"}) *`}
                  value={nuevoColabCorreo}
                  onChange={(e) => setNuevoColabCorreo(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
                />
                <input
                  type="text"
                  placeholder="Cédula / ID (opcional)"
                  value={nuevoColabIdentificacion}
                  onChange={(e) => setNuevoColabIdentificacion(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "#334155", fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={nuevoColabEnviarBienvenida}
                    onChange={(e) => setNuevoColabEnviarBienvenida(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "#059669" }}
                  />
                  <span>Enviar correo de bienvenida indicando los beneficios del convenio</span>
                </label>

                <button
                  type="submit"
                  disabled={procesandoColaborador}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#059669",
                    color: "#FFFFFF",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <UserPlus size={14} />
                  <span>{procesandoColaborador ? "Registrando..." : "Agregar Colaborador"}</span>
                </button>
              </div>
            </form>

            {/* Buscador y Tabla de Personas Registradas */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                <input
                  type="text"
                  placeholder="Buscar colaborador por nombre, correo o cédula..."
                  value={busquedaColaborador}
                  onChange={(e) => setBusquedaColaborador(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 32px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                  }}
                />
              </div>
              <span style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: 600 }}>
                Mostrando {colaboradoresFiltrados.length} de {listaColaboradores.length} personas
              </span>
            </div>

            {cargandoColaboradores ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                Verificando personas registradas bajo el convenio...
              </div>
            ) : colaboradoresFiltrados.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  background: "#F8FAFC",
                  borderRadius: "12px",
                  border: "1px dashed #CBD5E1",
                  color: "#64748B",
                  fontSize: "0.85rem",
                }}
              >
                Aún no hay personas registradas en este convenio o que coincidan con tu búsqueda.
              </div>
            ) : (
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "12px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "10px 12px", fontWeight: 800 }}>Colaborador</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800 }}>Estado Cupo</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800 }}>Correo Bienvenida</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradoresFiltrados.map((b) => {
                      const activo = b.bnf_estado !== "INACTIVO";
                      const bienvenidaEnviada = Boolean(b.bnf_detalle_beneficiario?.correo_bienvenida_enviado);

                      return (
                        <tr key={b.bnf_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A" }}>
                              {b.bnf_nombres || "Colaborador Corporativo"}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#4F46E5", fontWeight: 600 }}>
                              {b.bnf_correo_corporativo || b.bnf_identificacion}
                            </div>
                            {b.bnf_identificacion && b.bnf_identificacion !== b.bnf_correo_corporativo && (
                              <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                                ID: {b.bnf_identificacion}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "3px 8px",
                                borderRadius: "999px",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                background: activo ? "#DCFCE7" : "#F1F5F9",
                                color: activo ? "#166534" : "#64748B",
                              }}
                            >
                              {activo ? "🟢 Habilitado" : "⚪ Pausado"}
                            </span>
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            {bienvenidaEnviada ? (
                              <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.75rem" }}>
                                ✓ Enviado con beneficios
                              </span>
                            ) : (
                              <span style={{ color: "#D97706", fontWeight: 600, fontSize: "0.75rem" }}>
                                Pendiente de envío
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleReenviarBienvenida(b)}
                                disabled={enviandoCorreoId === b.bnf_id}
                                className="btn-responsive-accion"
                                title="Enviar correo de bienvenida con los beneficios del convenio"
                                aria-label="Enviar bienvenida"
                                style={{
                                  padding: "5px 9px",
                                  borderRadius: "7px",
                                  border: "1px solid #C7D2FE",
                                  background: "#EEF2FF",
                                  color: "#4338CA",
                                  fontSize: "0.74rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Send size={12} />
                                <span className="btn-texto-responsive">
                                  {enviandoCorreoId === b.bnf_id ? "Enviando..." : "Bienvenida"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCambiarEstadoColaborador(b)}
                                className="btn-responsive-accion"
                                title={activo ? "Pausar colaborador y liberar cupo" : "Reactivar colaborador en el convenio"}
                                aria-label={activo ? "Pausar colaborador" : "Activar colaborador"}
                                style={{
                                  padding: "5px 9px",
                                  borderRadius: "7px",
                                  border: "1px solid #CBD5E1",
                                  background: "#FFFFFF",
                                  color: "#334155",
                                  fontSize: "0.74rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {activo ? <UserX size={12} /> : <UserCheck size={12} />}
                                <span className="btn-texto-responsive">{activo ? "Pausar" : "Activar"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEliminarColaborador(b)}
                                title="Quitar colaborador del convenio"
                                aria-label="Quitar colaborador"
                                style={{
                                  padding: "5px 7px",
                                  borderRadius: "7px",
                                  border: "1px solid #FCA5A5",
                                  background: "#FEF2F2",
                                  color: "#DC2626",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
