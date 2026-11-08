"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  Scale,
  MapPin,
  Pencil,
  Trash2,
  Video,
  Building2,
  RefreshCw,
  ShieldCheck,
  Clock,
  Plus,
  X,
  Mail,
  Upload,
  Send,
  ExternalLink,
  Bell,
  History,
  Briefcase,
} from "lucide-react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { ModalNotificacionPush } from "@eco/notificaciones";
import { DIAS_SEMANA, huecosPorSemana, type Franja } from "@eco/agenda";
import {
  listarRedProfesionalAbogadosAction,
  obtenerCatalogosRedProfesionalAction,
  buscarUsuariosPlataformaParaAbogadoAction,
  registrarOConvertirAbogadoAction,
  cambiarEstadoAbogadoRedAction,
  reenviarSolicitudAceptacionAbogadoAction,
  eliminarAbogadoRedAction,
  guardarDisponibilidadCitasAbogadoAction,
  purgarTodasSolicitudesSocioAction,
  enviarInvitacionesRegistroAbogadosAction,
  crearEspecialidadLegalAction,
  eliminarEspecialidadLegalAction,
  type AbogadoRedItem,
  type MateriaItem,
  type ProvinciaItem,
  type UsuarioPlataformaItem,
  type ConfiguracionAgendaAbogado,
} from "../acciones-red-profesional";

const PROVINCIAS_ECUADOR_INICIALES: ProvinciaItem[] = [
  { cat_id: "00000000-0000-4000-8000-000000000101", cat_nombre: "Azuay", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000102", cat_nombre: "Bolívar", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000103", cat_nombre: "Cañar", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000104", cat_nombre: "Carchi", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000105", cat_nombre: "Chimborazo", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000106", cat_nombre: "Cotopaxi", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000107", cat_nombre: "El Oro", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000108", cat_nombre: "Esmeraldas", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000109", cat_nombre: "Galápagos", cat_region: "Insular" },
  { cat_id: "00000000-0000-4000-8000-000000000110", cat_nombre: "Guayas", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000111", cat_nombre: "Imbabura", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000112", cat_nombre: "Loja", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000113", cat_nombre: "Los Ríos", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000114", cat_nombre: "Manabí", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000115", cat_nombre: "Morona Santiago", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000116", cat_nombre: "Napo", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000117", cat_nombre: "Orellana", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000118", cat_nombre: "Pastaza", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000119", cat_nombre: "Pichincha", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000120", cat_nombre: "Santa Elena", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000121", cat_nombre: "Santo Domingo de los Tsáchilas", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000122", cat_nombre: "Sucumbíos", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000123", cat_nombre: "Tungurahua", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000124", cat_nombre: "Zamora Chinchipe", cat_region: "Amazonía" },
];

const CONFIG_AGENDA_BASE: ConfiguracionAgendaAbogado = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 12,
  horizonte_dias: 60,
  modalidades: ["virtual", "presencial"],
  acepta_turno: true,
  direccion: "Quito — Atención Presencial y Teleconsulta",
};

const FRANJAS_BASE: Franja[] = [
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
];

export function GestionRedProfesionalWidget() {
  const [abogados, setAbogados] = useState<AbogadoRedItem[]>([]);
  const [materiasCat, setMateriasCat] = useState<MateriaItem[]>([]);
  const [provinciasCat, setProvinciasCat] = useState<ProvinciaItem[]>(PROVINCIAS_ECUADOR_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Modal de Alta / Conversión / Edición de Socio Abogado
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoOrigenUsuario, setModoOrigenUsuario] = useState<"existente" | "nuevo">("existente");
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [usuariosEncontrados, setUsuariosEncontrados] = useState<UsuarioPlataformaItem[]>([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);

  // Estado del formulario de Abogado
  const [editandoAbogadoId, setEditandoAbogadoId] = useState<string | null>(null);
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState<string | null>(null);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [cedula, setCedula] = useState("");
  const [matricula, setMatricula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [universidad, setUniversidad] = useState("");
  const [anosExperiencia, setAnosExperiencia] = useState<number>(3);
  const [resumenProfesional, setResumenProfesional] = useState("");
  const [estadoAbogado, setEstadoAbogado] = useState<"verificado" | "suspendido">("verificado");
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState<string[]>([]);
  const [provinciasSeleccionadas, setProvinciasSeleccionadas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Modal de Configuración de Disponibilidad (Citas Presenciales / Teleconsulta)
  const [abogadoAgendaModal, setAbogadoAgendaModal] = useState<AbogadoRedItem | null>(null);
  const [configAgenda, setConfigAgenda] = useState<ConfiguracionAgendaAbogado>(CONFIG_AGENDA_BASE);
  const [franjasAgenda, setFranjasAgenda] = useState<Franja[]>(FRANJAS_BASE);
  const [guardandoAgenda, setGuardandoAgenda] = useState(false);

  // Modal de Invitación por Correo (Individual o Lista Masiva) hacia https://www.tranqi24.com/abogados
  const [modalInvitarAbierto, setModalInvitarAbierto] = useState(false);
  const [textoCorreosEntrada, setTextoCorreosEntrada] = useState("");
  const [listaCorreosInvitar, setListaCorreosInvitar] = useState<string[]>([]);
  const [mensajePersonalizadoInvitacion, setMensajePersonalizadoInvitacion] = useState("");
  const [enviandoInvitaciones, setEnviandoInvitaciones] = useState(false);

  // Gestión de Especialidades Legales (Agregar / Eliminar en catálogo trq_materia)
  const [modalEspecialidadesAbierto, setModalEspecialidadesAbierto] = useState(false);
  const [modoGestionarEspecialidadesEnModal, setModoGestionarEspecialidadesEnModal] = useState(false);
  const [nuevaEspecialidadNombre, setNuevaEspecialidadNombre] = useState("");
  const [creandoEspecialidad, setCreandoEspecialidad] = useState(false);
  const [eliminandoEspecialidadId, setEliminandoEspecialidadId] = useState<string | null>(null);

  // Modal de Historial de Cambios de Rol y Estado
  const [abogadoHistorialModal, setAbogadoHistorialModal] = useState<AbogadoRedItem | null>(null);

  // Modal de Confirmación Personalizado de la Plataforma (reemplaza window.confirm)
  const [modalConfirmacion, setModalConfirmacion] = useState<{
    abierto: boolean;
    tipo: "exito" | "error" | "info" | "advertencia" | "push";
    titulo: string;
    mensaje: string;
    textoBoton?: string;
    textoCancelar?: string;
    mostrarConfirmacion?: boolean;
    alAceptar: () => void;
    alCancelar?: () => void;
  }>({
    abierto: false,
    tipo: "advertencia",
    titulo: "",
    mensaje: "",
    alAceptar: () => {},
  });

  const cerrarModalConfirmacion = () => {
    setModalConfirmacion((prev) => ({ ...prev, abierto: false }));
  };

  const handleAgregarEspecialidad = async (seleccionarAutomaticamente: boolean = false) => {
    const nombreLimpio = nuevaEspecialidadNombre.trim();
    if (!nombreLimpio) return;
    setCreandoEspecialidad(true);
    setMensaje(null);
    try {
      const res = await crearEspecialidadLegalAction(nombreLimpio);
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      const nueva = res.data;
      setMateriasCat((prev) => {
        const filtrada = prev.filter((m) => m.mat_id !== nueva.mat_id);
        return [...filtrada, nueva].sort((a, b) => a.mat_nombre.localeCompare(b.mat_nombre, "es"));
      });
      if (seleccionarAutomaticamente) {
        setMateriasSeleccionadas((prev) =>
          prev.includes(nueva.mat_id) ? prev : [...prev, nueva.mat_id]
        );
      }
      setNuevaEspecialidadNombre("");
      setMensaje({
        tipo: "ok",
        texto: `Especialidad legal "${nueva.mat_nombre}" agregada al catálogo.`,
      });
    } finally {
      setCreandoEspecialidad(false);
    }
  };

  const handleEliminarEspecialidad = (mat: MateriaItem) => {
    setModalConfirmacion({
      abierto: true,
      tipo: "advertencia",
      titulo: "Eliminar Especialidad Legal",
      mensaje: `¿Estás seguro de eliminar o desactivar la especialidad legal "${mat.mat_nombre}" del catálogo?\n\nSi existen expedientes históricos asociados, el sistema aplicará baja lógica para conservar la integridad referencial.`,
      textoBoton: "Eliminar Especialidad",
      textoCancelar: "Cancelar",
      mostrarConfirmacion: true,
      alAceptar: async () => {
        cerrarModalConfirmacion();
        setEliminandoEspecialidadId(mat.mat_id);
        setMensaje(null);
        try {
          const res = await eliminarEspecialidadLegalAction(mat.mat_id);
          if (!res.ok) {
            setMensaje({ tipo: "error", texto: res.error });
            return;
          }
          setMateriasCat((prev) => prev.filter((m) => m.mat_id !== mat.mat_id));
          setMateriasSeleccionadas((prev) => prev.filter((id) => id !== mat.mat_id));
          setMensaje({
            tipo: "ok",
            texto: `Especialidad legal "${mat.mat_nombre}" eliminada del catálogo.`,
          });
        } finally {
          setEliminandoEspecialidadId(null);
        }
      },
      alCancelar: cerrarModalConfirmacion,
    });
  };

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [redRes, catRes] = await Promise.all([
        listarRedProfesionalAbogadosAction(),
        obtenerCatalogosRedProfesionalAction(),
      ]);
      if (redRes.ok) setAbogados(redRes.data);
      if (catRes.ok) {
        if (catRes.data.materias.length > 0) setMateriasCat(catRes.data.materias);
        if (catRes.data.provincias.length > 0) {
          setProvinciasCat(catRes.data.provincias);
        } else {
          setProvinciasCat(PROVINCIAS_ECUADOR_INICIALES);
        }
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    if (!modalAbierto || editandoAbogadoId || modoOrigenUsuario !== "existente") return;
    let cancelado = false;
    setBuscandoUsuarios(true);
    const timer = setTimeout(async () => {
      const res = await buscarUsuariosPlataformaParaAbogadoAction(busquedaUsuario);
      if (!cancelado) {
        if (res.ok) setUsuariosEncontrados(res.data);
        setBuscandoUsuarios(false);
      }
    }, 220);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [busquedaUsuario, modalAbierto, editandoAbogadoId, modoOrigenUsuario]);

  const abrirModalNuevo = () => {
    setEditandoAbogadoId(null);
    setModoOrigenUsuario("existente");
    setUsuarioSeleccionadoId(null);
    setBusquedaUsuario("");
    setNombres("");
    setApellidos("");
    setCorreo("");
    setCedula("");
    setMatricula("");
    setTelefono("");
    setUniversidad("");
    setAnosExperiencia(3);
    setResumenProfesional("");
    setEstadoAbogado("verificado");
    setMateriasSeleccionadas(materiasCat.slice(0, 2).map((m) => m.mat_id));
    const listaProv = provinciasCat.length > 0 ? provinciasCat : PROVINCIAS_ECUADOR_INICIALES;
    const pichincha = listaProv.find((p) => p.cat_nombre.toLowerCase().includes("pichincha"));
    setProvinciasSeleccionadas(
      pichincha ? [pichincha.cat_id] : listaProv.slice(0, 1).map((p) => p.cat_id)
    );
    setMensaje(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (abg: AbogadoRedItem) => {
    setEditandoAbogadoId(abg.abg_id);
    setModoOrigenUsuario("existente");
    setUsuarioSeleccionadoId(abg.usu_id);
    setNombres(abg.nombres);
    setApellidos(abg.apellidos);
    setCorreo(abg.correo);
    setCedula(abg.cedula);
    setMatricula(abg.matriculaProfesional);
    setTelefono(abg.telefono);
    setUniversidad(abg.universidad);
    setAnosExperiencia(abg.anosExperiencia || 1);
    setResumenProfesional(abg.resumenProfesional);
    setEstadoAbogado(abg.estado);
    setMateriasSeleccionadas(abg.materias.map((m) => m.mat_id));
    const listaProv = provinciasCat.length > 0 ? provinciasCat : PROVINCIAS_ECUADOR_INICIALES;
    const idsProvResueltos = abg.provincias.map((p) => {
      const porId = listaProv.find((cat) => cat.cat_id === p.cat_id);
      if (porId) return porId.cat_id;
      const porNombre = listaProv.find(
        (cat) => cat.cat_nombre.toLowerCase() === p.cat_nombre.toLowerCase()
      );
      return porNombre ? porNombre.cat_id : p.cat_id;
    });
    setProvinciasSeleccionadas(idsProvResueltos);
    setMensaje(null);
    setModalAbierto(true);
  };

  const extraerCorreosValidos = (texto: string): string[] => {
    const coincidencias =
      texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    return Array.from(new Set(coincidencias.map((c) => c.trim().toLowerCase())));
  };

  const abrirModalInvitar = () => {
    setTextoCorreosEntrada("");
    setListaCorreosInvitar([]);
    setMensajePersonalizadoInvitacion("");
    setMensaje(null);
    setModalInvitarAbierto(true);
  };

  const agregarCorreosALista = () => {
    const extraidos = extraerCorreosValidos(textoCorreosEntrada);
    if (extraidos.length === 0) {
      setMensaje({
        tipo: "error",
        texto: "No se detectaron correos electrónicos válidos en el texto ingresado.",
      });
      return;
    }
    setListaCorreosInvitar((prev) => Array.from(new Set([...prev, ...extraidos])));
    setTextoCorreosEntrada("");
  };

  const handleCargarArchivoCorreos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = (ev) => {
      const contenido = String(ev.target?.result ?? "");
      const extraidos = extraerCorreosValidos(contenido);
      if (extraidos.length === 0) {
        setMensaje({
          tipo: "error",
          texto: `El archivo "${archivo.name}" no contiene direcciones de correo electrónico válidas.`,
        });
        return;
      }
      setListaCorreosInvitar((prev) => Array.from(new Set([...prev, ...extraidos])));
      setMensaje({
        tipo: "ok",
        texto: `Se cargaron ${extraidos.length} correo(s) desde "${archivo.name}".`,
      });
    };
    lector.readAsText(archivo);
    e.target.value = "";
  };

  const handleEnviarInvitaciones = async (e: React.FormEvent) => {
    e.preventDefault();
    const pendientesTexto = extraerCorreosValidos(textoCorreosEntrada);
    const todos = Array.from(new Set([...listaCorreosInvitar, ...pendientesTexto]));
    if (todos.length === 0) {
      setMensaje({
        tipo: "error",
        texto: "Agrega al menos un correo o carga una lista antes de enviar las invitaciones.",
      });
      return;
    }
    setEnviandoInvitaciones(true);
    setMensaje(null);
    try {
      const res = await enviarInvitacionesRegistroAbogadosAction({
        correos: todos,
        mensajePersonalizado: mensajePersonalizadoInvitacion,
      });
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: `Se enviaron ${res.data.enviados} de ${res.data.total} invitaciones con el enlace de registro (https://www.tranqi24.com/abogados).`,
      });
      setModalInvitarAbierto(false);
      setListaCorreosInvitar([]);
      setTextoCorreosEntrada("");
    } finally {
      setEnviandoInvitaciones(false);
    }
  };

  const seleccionarUsuarioPlataforma = (u: UsuarioPlataformaItem) => {
    setUsuarioSeleccionadoId(u.usu_id);
    setNombres(u.nombres);
    setApellidos(u.apellidos);
    setCorreo(u.correo);
    if (u.cedula) setCedula(u.cedula);
    if (u.telefono) setTelefono(u.telefono);
  };

  const toggleMateria = (id: string) => {
    setMateriasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleProvincia = (id: string) => {
    setProvinciasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGuardarAbogado = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await registrarOConvertirAbogadoAction({
        abogadoId: editandoAbogadoId,
        usuarioId: modoOrigenUsuario === "existente" ? usuarioSeleccionadoId : null,
        nombres,
        apellidos,
        correo,
        cedula,
        matriculaProfesional: matricula,
        telefono,
        universidad,
        anosExperiencia,
        resumenProfesional,
        estado: estadoAbogado,
        materiasIds: materiasSeleccionadas,
        provinciasIds: provinciasSeleccionadas,
      });

      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }

      setMensaje({
        tipo: "ok",
        texto: editandoAbogadoId
          ? "Ficha profesional, especialidades y cobertura actualizadas correctamente."
          : "Solicitud de incorporación registrada y notificación Push + Correo enviada al usuario para que confirme su aceptación del nuevo rol de Socio Abogado.",
      });
      setModalAbierto(false);
      await cargarTodo();
    } finally {
      setGuardando(false);
    }
  };

  const handleReenviarNotificacionAceptacion = async (abg: AbogadoRedItem) => {
    setMensaje(null);
    const res = await reenviarSolicitudAceptacionAbogadoAction(abg.abg_id);
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setMensaje({
      tipo: "ok",
      texto: `Notificación Push / In-App y correo electrónico de aceptación enviados a ${abg.nombreCompleto} (${abg.correo}).`,
    });
    await cargarTodo();
  };

  const abrirModalDisponibilidad = (abg: AbogadoRedItem) => {
    setAbogadoAgendaModal(abg);
    setConfigAgenda(abg.configuracionAgenda || CONFIG_AGENDA_BASE);
    setFranjasAgenda(abg.franjas.length > 0 ? abg.franjas : FRANJAS_BASE);
    setMensaje(null);
  };

  const handleGuardarDisponibilidad = async () => {
    if (!abogadoAgendaModal) return;
    setGuardandoAgenda(true);
    setMensaje(null);
    try {
      const res = await guardarDisponibilidadCitasAbogadoAction({
        usuarioId: abogadoAgendaModal.usu_id,
        configuracion: configAgenda,
        franjas: franjasAgenda,
      });
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: `Disponibilidad de citas presenciales y teleconsulta actualizada para ${abogadoAgendaModal.nombreCompleto}.`,
      });
      setAbogadoAgendaModal(null);
      await cargarTodo();
    } finally {
      setGuardandoAgenda(false);
    }
  };

  const handleCambiarEstado = async (abg: AbogadoRedItem) => {
    const nuevo = abg.estado === "verificado" ? "suspendido" : "verificado";
    const res = await cambiarEstadoAbogadoRedAction(abg.abg_id, nuevo);
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setMensaje({
      tipo: "ok",
      texto:
        nuevo === "verificado"
          ? `${abg.nombreCompleto} activado como Socio Abogado.`
          : `${abg.nombreCompleto} suspendido temporalmente.`,
    });
    await cargarTodo();
  };

  const handleEliminarAbogado = (abg: AbogadoRedItem) => {
    // 1. Validar preventivamente en interfaz si tiene casos o citas activas asignadas
    if ((abg.casosAsignadosActivos || 0) > 0 || (abg.citasActivas || 0) > 0) {
      setModalConfirmacion({
        abierto: true,
        tipo: "error",
        titulo: "Baja de Rol Bloqueada — Casos Asignados",
        mensaje: `No se puede dar de baja el rol de Socio Abogado a "${abg.nombreCompleto}" porque registra:\n\n• ${abg.casosAsignadosActivos || 0} caso(s) judicial(es) activo(s) asignado(s)\n• ${abg.citasActivas || 0} cita(s) programada(s) pendiente(s)\n\nDebes reasignar o cerrar primero sus causas y citas activas antes de desactivar su rol.`,
        textoBoton: "Entendido",
        mostrarConfirmacion: false,
        alAceptar: cerrarModalConfirmacion,
      });
      return;
    }

    setModalConfirmacion({
      abierto: true,
      tipo: "advertencia",
      titulo: "Confirmar Baja Lógica de Rol Abogado",
      mensaje: `¿Confirmas dar de baja lógica el rol de Socio Abogado para "${abg.nombreCompleto}" (${abg.correo})?\n\n• Se verificó que tiene 0 casos activos asignados.\n• La baja es LÓGICA (no se eliminan sus registros históricos ni credenciales).\n• Quedará registrado en el Historial de Cambios de Rol y el usuario conservará su cuenta base de Cliente.`,
      textoBoton: "Confirmar Baja de Rol",
      textoCancelar: "Cancelar",
      mostrarConfirmacion: true,
      alAceptar: async () => {
        cerrarModalConfirmacion();
        const res = await eliminarAbogadoRedAction(abg.abg_id);
        if (!res.ok) {
          setModalConfirmacion({
            abierto: true,
            tipo: "error",
            titulo: "No se pudo dar de baja el rol",
            mensaje: res.error,
            textoBoton: "Entendido",
            mostrarConfirmacion: false,
            alAceptar: cerrarModalConfirmacion,
          });
          return;
        }
        setMensaje({
          tipo: "ok",
          texto: `Baja lógica del rol de Socio Abogado aplicada a ${abg.nombreCompleto}. Cambio registrado en el historial.`,
        });
        await cargarTodo();
      },
      alCancelar: cerrarModalConfirmacion,
    });
  };

  const handlePurgarSolicitudes = () => {
    setModalConfirmacion({
      abierto: true,
      tipo: "advertencia",
      titulo: "Purgar Solicitudes de Postulación",
      mensaje:
        "¿Confirmas eliminar las solicitudes de postulación iniciales pendientes en la bandeja de solicitudes?",
      textoBoton: "Confirmar Purga",
      textoCancelar: "Cancelar",
      mostrarConfirmacion: true,
      alAceptar: async () => {
        cerrarModalConfirmacion();
        const res = await purgarTodasSolicitudesSocioAction();
        if (!res.ok) {
          setMensaje({ tipo: "error", texto: res.error });
          return;
        }
        setMensaje({
          tipo: "ok",
          texto: `Solicitudes de postulación purgadas (${res.data.eliminadas} registros).`,
        });
        await cargarTodo();
      },
      alCancelar: cerrarModalConfirmacion,
    });
  };

  const kpis = useMemo(() => {
    const total = abogados.length;
    const activos = abogados.filter((a) => a.estado === "verificado").length;
    const manuales = abogados.filter((a) => a.origenRegistro === "manual_operador").length;
    const conAgenda = abogados.filter((a) => a.agendaConfigurada && a.citasPorSemana > 0).length;
    return { total, activos, manuales, conAgenda };
  }, [abogados]);

  const huecosCalculadosModal = useMemo(() => {
    try {
      return huecosPorSemana({ configuracion: configAgenda, franjas: franjasAgenda });
    } catch {
      return 0;
    }
  }, [configAgenda, franjasAgenda]);

  const columnas: ColumnaDataGrid<AbogadoRedItem>[] = [
    {
      id: "profesional",
      encabezado: "Abogado / Contacto",
      valor: (a) => `${a.nombreCompleto} ${a.correo}`,
      render: (a) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <strong style={{ color: "#111827", fontSize: "0.88rem" }}>{a.nombreCompleto}</strong>
          <span style={{ fontSize: "0.76rem", color: "#4B5563" }}>{a.correo}</span>
          {a.telefono && (
            <span style={{ fontSize: "0.73rem", color: "#05876E", fontWeight: 600 }}>
              Tel: {a.telefono}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "credenciales",
      encabezado: "Cédula / Matrícula",
      valor: (a) => `${a.cedula} ${a.matriculaProfesional}`,
      render: (a) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.78rem" }}>
          <span>
            <b>CI:</b> {a.cedula || "—"}
          </span>
          <span style={{ color: "#5000BA", fontWeight: 700 }}>
            <b>Foro:</b> {a.matriculaProfesional || "—"}
          </span>
        </div>
      ),
    },
    {
      id: "origen",
      encabezado: "Registro / Aceptación",
      valor: (a) =>
        `${a.origenRegistro === "manual_operador" ? "Equipo Manual" : "Autogestión"} ${a.registradoPorNombre} ${a.registradoPorCorreo} ${a.estadoAceptacion}`,
      render: (a) => {
        const fechaAlta = a.fechaRegistro
          ? new Date(a.fechaRegistro).toLocaleString("es-EC", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          : "—";
        const fechaConfirm = a.fechaAceptacion
          ? new Date(a.fechaAceptacion).toLocaleString("es-EC", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          : null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "0.73rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 7px",
                  borderRadius: "999px",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  background: a.origenRegistro === "manual_operador" ? "#EEF2FF" : "#F3F4F6",
                  color: a.origenRegistro === "manual_operador" ? "#4338CA" : "#374151",
                }}
              >
                {a.origenRegistro === "manual_operador" ? "Equipo Manual" : "Autogestión"}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 7px",
                  borderRadius: "999px",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  background:
                    a.estadoAceptacion === "aceptado"
                      ? "#ECFDF5"
                      : a.estadoAceptacion === "rechazado"
                        ? "#FEF2F2"
                        : "#FEF3C7",
                  color:
                    a.estadoAceptacion === "aceptado"
                      ? "#065F46"
                      : a.estadoAceptacion === "rechazado"
                        ? "#991B1B"
                        : "#92400E",
                }}
              >
                {a.estadoAceptacion === "aceptado"
                  ? "✓ Aceptado"
                  : a.estadoAceptacion === "rechazado"
                    ? "✕ Rechazado"
                    : "⏳ Pendiente Aceptación"}
              </span>
            </div>
            <span style={{ color: "#374151" }}>
              <b>Por:</b> {a.registradoPorNombre}
            </span>
            <span style={{ color: "#6B7280", fontSize: "0.7rem" }}>
              <b>Alta:</b> {fechaAlta}
            </span>
            {fechaConfirm && a.estadoAceptacion === "aceptado" && (
              <span style={{ color: "#05876E", fontSize: "0.7rem", fontWeight: 700 }}>
                <b>Aceptó:</b> {fechaConfirm}
              </span>
            )}
            {a.bajaLogica && a.fechaBajaLogica && (
              <span style={{ color: "#991B1B", fontSize: "0.7rem", fontWeight: 700 }}>
                <b>Baja Lógica:</b>{" "}
                {new Date(a.fechaBajaLogica).toLocaleString("es-EC", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {a.bajaLogicaPorNombre ? ` (${a.bajaLogicaPorNombre})` : ""}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "especialidades",
      encabezado: "Especialidades",
      valor: (a) => a.materias.map((m) => m.mat_nombre).join(", "),
      render: (a) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "240px" }}>
          {a.materias.length === 0 ? (
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>Sin asignar</span>
          ) : (
            a.materias.slice(0, 3).map((m) => (
              <span
                key={m.mat_id}
                style={{
                  fontSize: "0.7rem",
                  background: "#F5F3FF",
                  color: "#5000BA",
                  border: "1px solid #DDD6FE",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  fontWeight: 700,
                }}
              >
                {m.mat_nombre}
              </span>
            ))
          )}
          {a.materias.length > 3 && (
            <span style={{ fontSize: "0.7rem", color: "#6B7280", fontWeight: 700 }}>
              +{a.materias.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "cobertura",
      encabezado: "Cobertura",
      valor: (a) => a.provincias.map((p) => p.cat_nombre).join(", "),
      render: (a) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "200px" }}>
          {a.provincias.length === 0 ? (
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>Sin zona</span>
          ) : a.provincias.length >= 20 ? (
            <span
              style={{
                fontSize: "0.72rem",
                background: "#ECFDF5",
                color: "#065F46",
                borderRadius: "6px",
                padding: "2px 7px",
                fontWeight: 800,
              }}
            >
              Nacional ({a.provincias.length} prov.)
            </span>
          ) : (
            <>
              {a.provincias.slice(0, 2).map((p) => (
                <span
                  key={p.cat_id}
                  style={{
                    fontSize: "0.7rem",
                    background: "#F0F9FF",
                    color: "#0369A1",
                    border: "1px solid #BAE6FD",
                    borderRadius: "6px",
                    padding: "2px 6px",
                    fontWeight: 700,
                  }}
                >
                  {p.cat_nombre}
                </span>
              ))}
              {a.provincias.length > 2 && (
                <span style={{ fontSize: "0.7rem", color: "#0369A1", fontWeight: 700 }}>
                  +{a.provincias.length - 2}
                </span>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      id: "disponibilidad",
      encabezado: "Atención Citas",
      valor: (a) => `${a.citasPorSemana} citas/sem`,
      render: (a) => {
        const mods = a.configuracionAgenda.modalidades || [];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {mods.includes("virtual") && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    background: "#EFF6FF",
                    color: "#1D4ED8",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  Teleconsulta
                </span>
              )}
              {mods.includes("presencial") && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    background: "#FEF3C7",
                    color: "#92400E",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  Presencial
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.74rem", color: a.citasPorSemana > 0 ? "#05876E" : "#DC2626", fontWeight: 700 }}>
              {a.citasPorSemana > 0 ? `${a.citasPorSemana} cupos/sem` : "Sin franjas"}
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                color: (a.casosAsignadosActivos || 0) > 0 ? "#B45309" : "#6B7280",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Briefcase size={11} />
              {a.casosAsignadosActivos || 0} caso(s) · {a.citasActivas || 0} cita(s)
            </span>
          </div>
        );
      },
    },
    {
      id: "estado",
      encabezado: "Estado",
      valor: (a) =>
        a.bajaLogica
          ? "Baja Lógica (Inactivo)"
          : a.estado === "verificado"
            ? "Activo"
            : "Suspendido",
      render: (a) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 9px",
            borderRadius: "999px",
            fontSize: "0.73rem",
            fontWeight: 800,
            background: a.bajaLogica
              ? "#F1F5F9"
              : a.estado === "verificado"
                ? "#ECFDF5"
                : "#FEF2F2",
            color: a.bajaLogica
              ? "#475569"
              : a.estado === "verificado"
                ? "#065F46"
                : "#991B1B",
            border: a.bajaLogica
              ? "1px solid #94A3B8"
              : a.estado === "verificado"
                ? "1px solid #10B981"
                : "1px solid #F87171",
          }}
        >
          {a.estado === "verificado" && !a.bajaLogica ? (
            <CheckCircle2 size={12} />
          ) : (
            <XCircle size={12} />
          )}
          {a.bajaLogica
            ? "Baja Lógica"
            : a.estado === "verificado"
              ? "Activo"
              : "Suspendido"}
        </span>
      ),
    },
    {
      id: "acciones",
      encabezado: "Acciones",
      valor: () => "",
      render: (a) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => abrirModalEditar(a)}
            className="btn-responsive-accion"
            title="Editar datos, especialidades y zonas de cobertura del abogado"
            aria-label="Editar abogado"
            style={{
              background: "#F5F3FF",
              color: "#5000BA",
              border: "1px solid #DDD6FE",
              borderRadius: "8px",
              padding: "5px 9px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Pencil size={13} />
            <span className="btn-texto-responsive">Editar</span>
          </button>

          <button
            type="button"
            onClick={() => abrirModalDisponibilidad(a)}
            className="btn-responsive-accion"
            title="Configurar disponibilidad de citas presenciales y teleconsulta"
            aria-label="Configurar horarios de citas"
            style={{
              background: "#ECFDF5",
              color: "#05876E",
              border: "1px solid #A7F3D0",
              borderRadius: "8px",
              padding: "5px 9px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Calendar size={13} />
            <span className="btn-texto-responsive">Horarios</span>
          </button>

          <button
            type="button"
            onClick={() => handleReenviarNotificacionAceptacion(a)}
            className="btn-responsive-accion"
            title="Enviar notificación Push/In-App y correo electrónico de confirmación de nuevo rol al abogado"
            aria-label="Notificar al abogado"
            style={{
              background: "#EFF6FF",
              color: "#1D4ED8",
              border: "1px solid #BFDBFE",
              borderRadius: "8px",
              padding: "5px 9px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Bell size={13} />
            <span className="btn-texto-responsive">Notificar</span>
          </button>

          <button
            type="button"
            onClick={() => setAbogadoHistorialModal(a)}
            className="btn-responsive-accion"
            title="Ver historial completo de asignación, aceptación y cambios de rol"
            aria-label="Ver historial de cambios de rol"
            style={{
              background: "#F8FAFC",
              color: "#334155",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "5px 9px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <History size={13} />
            <span className="btn-texto-responsive">Historial</span>
          </button>

          <button
            type="button"
            onClick={() => handleCambiarEstado(a)}
            className="btn-responsive-accion"
            title={a.estado === "verificado" ? "Suspender socio abogado" : "Activar / Reactivar rol de socio abogado"}
            aria-label={a.estado === "verificado" ? "Suspender abogado" : "Activar abogado"}
            style={{
              background: a.estado === "verificado" ? "#FFFBEB" : "#ECFDF5",
              color: a.estado === "verificado" ? "#B45309" : "#065F46",
              border: a.estado === "verificado" ? "1px solid #FDE68A" : "1px solid #A7F3D0",
              borderRadius: "8px",
              padding: "5px 9px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ShieldCheck size={13} />
            <span className="btn-texto-responsive">
              {a.estado === "verificado" ? "Suspender" : "Activar"}
            </span>
          </button>

          {!a.bajaLogica && (
            <button
              type="button"
              onClick={() => handleEliminarAbogado(a)}
              className="btn-responsive-accion"
              title="Dar de baja lógica el rol de socio abogado (verifica que no tenga casos asignados y registra en el historial)"
              aria-label="Dar de baja rol de abogado"
              style={{
                background: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                padding: "5px 9px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Trash2 size={13} />
              <span className="btn-texto-responsive">Baja Rol</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {/* Cabecera y Acciones Principales */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "linear-gradient(135deg, #05876E 0%, #046A56 100%)",
          color: "#ffffff",
          padding: "20px 24px",
          borderRadius: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: "rgba(255,255,255,0.18)",
              padding: "3px 9px",
              borderRadius: "999px",
            }}
          >
            Red Profesional tranqi
          </span>
          <h3 style={{ margin: "6px 0 4px 0", fontSize: "1.25rem", fontWeight: 900 }}>
            Gestión de Abogados, Especialidades y Disponibilidad
          </h3>
          <p style={{ margin: 0, fontSize: "0.84rem", opacity: 0.92 }}>
            Convierte usuarios registrados en socios abogados o incorpóralos manualmente con sus especialidades, provincias y citas presenciales/teleconsulta.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={abrirModalNuevo}
            className="btn-responsive-accion"
            title="Buscar un usuario registrado o incorporar manualmente un nuevo socio abogado"
            aria-label="Incorporar socio abogado"
            style={{
              background: "#FEE300",
              color: "#111827",
              border: "none",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "0.84rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            <UserPlus size={16} />
            <span className="btn-texto-responsive">Incorporar Abogado</span>
          </button>

          <button
            type="button"
            onClick={abrirModalInvitar}
            className="btn-responsive-accion"
            title="Invitar a uno o varios abogados por correo electrónico al portal de registro (https://www.tranqi24.com/abogados)"
            aria-label="Invitar abogados por correo"
            style={{
              background: "#5000BA",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "0.84rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            <Mail size={16} />
            <span className="btn-texto-responsive">Invitar Abogados</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNuevaEspecialidadNombre("");
              setMensaje(null);
              setModalEspecialidadesAbierto(true);
            }}
            className="btn-responsive-accion"
            title="Gestionar catálogo de especialidades legales (agregar o eliminar materias)"
            aria-label="Gestionar especialidades legales"
            style={{
              background: "rgba(255,255,255,0.22)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.45)",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Scale size={15} />
            <span className="btn-texto-responsive">Especialidades</span>
          </button>

          <button
            type="button"
            onClick={handlePurgarSolicitudes}
            className="btn-responsive-accion"
            title="Eliminar por completo todas las solicitudes de postulación existentes"
            aria-label="Purgar solicitudes de socios"
            style={{
              background: "rgba(255,255,255,0.16)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Trash2 size={15} />
            <span className="btn-texto-responsive">Purgar Solicitudes</span>
          </button>

          <button
            type="button"
            onClick={cargarTodo}
            className="btn-responsive-accion"
            title="Actualizar lista de la red profesional"
            aria-label="Actualizar lista"
            style={{
              background: "rgba(255,255,255,0.16)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "10px",
              padding: "10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
        }}
      >
        <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px 16px" }}>
          <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 700 }}>Total Red Profesional</span>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#111827", marginTop: "4px" }}>{kpis.total}</div>
          <span style={{ fontSize: "0.72rem", color: "#05876E" }}>Abogados registrados</span>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px 16px" }}>
          <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 700 }}>Socios Activos</span>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#05876E", marginTop: "4px" }}>{kpis.activos}</div>
          <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>Con vista de Abogado habilitada</span>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px 16px" }}>
          <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 700 }}>Alta Manual / Equipo</span>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#5000BA", marginTop: "4px" }}>{kpis.manuales}</div>
          <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>Incorporados por operador</span>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px 16px" }}>
          <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 700 }}>Con Agenda Activa</span>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0284C7", marginTop: "4px" }}>{kpis.conAgenda}</div>
          <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>Presencial y Teleconsulta</span>
        </div>
      </div>

      {mensaje && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "0.85rem",
            fontWeight: 700,
            background: mensaje.tipo === "ok" ? "#ECFDF5" : "#FEF2F2",
            color: mensaje.tipo === "ok" ? "#065F46" : "#991B1B",
            border: mensaje.tipo === "ok" ? "1px solid #10B981" : "1px solid #F87171",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{mensaje.texto}</span>
          <button
            type="button"
            onClick={() => setMensaje(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabla principal de Abogados */}
      <DataGrid<AbogadoRedItem>
        filas={abogados}
        columnas={columnas}
        idFila={(a) => a.abg_id}
        nombreExportacion="red_profesional_abogados_tranqi"
      />

      {/* MODAL 1: Incorporar / Convertir Usuario en Abogado o Editar Ficha */}
      {modalAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "780px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#111827" }}>
                  {editandoAbogadoId
                    ? "Editar Ficha Profesional, Especialidades y Cobertura"
                    : "Incorporar Socio Abogado al Equipo"}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "#6B7280" }}>
                  {editandoAbogadoId
                    ? "Actualiza los datos mínimos, materias legales y zonas de cobertura."
                    : "Busca un usuario ya registrado en la plataforma para convertirlo en abogado o registra uno nuevo."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {!editandoAbogadoId && (
              <div style={{ marginBottom: "18px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setModoOrigenUsuario("existente")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      border: modoOrigenUsuario === "existente" ? "2px solid #05876E" : "1px solid #D1D5DB",
                      background: modoOrigenUsuario === "existente" ? "#ECFDF5" : "#ffffff",
                      color: modoOrigenUsuario === "existente" ? "#065F46" : "#374151",
                    }}
                  >
                    1. Buscar Usuario Registrado en Plataforma
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoOrigenUsuario("nuevo");
                      setUsuarioSeleccionadoId(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      border: modoOrigenUsuario === "nuevo" ? "2px solid #5000BA" : "1px solid #D1D5DB",
                      background: modoOrigenUsuario === "nuevo" ? "#F5F3FF" : "#ffffff",
                      color: modoOrigenUsuario === "nuevo" ? "#5000BA" : "#374151",
                    }}
                  >
                    2. Crear Usuario Nuevo Directamente
                  </button>
                </div>

                {modoOrigenUsuario === "existente" && (
                  <div
                    style={{
                      background: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <Search size={16} color="#6B7280" />
                      <input
                        type="text"
                        value={busquedaUsuario}
                        onChange={(e) => setBusquedaUsuario(e.target.value)}
                        placeholder="Buscar usuario por nombre, correo, cédula o teléfono..."
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #D1D5DB",
                          fontSize: "0.84rem",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: "150px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {buscandoUsuarios ? (
                        <span style={{ fontSize: "0.78rem", color: "#6B7280", padding: "6px" }}>
                          Buscando usuarios en la plataforma...
                        </span>
                      ) : usuariosEncontrados.length === 0 ? (
                        <span style={{ fontSize: "0.78rem", color: "#6B7280", padding: "6px" }}>
                          No se encontraron usuarios con ese criterio.
                        </span>
                      ) : (
                        usuariosEncontrados.map((u) => {
                          const seleccionado = usuarioSeleccionadoId === u.usu_id;
                          return (
                            <button
                              key={u.usu_id}
                              type="button"
                              onClick={() => seleccionarUsuarioPlataforma(u)}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                textAlign: "left",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: seleccionado ? "2px solid #05876E" : "1px solid #E5E7EB",
                                background: seleccionado ? "#ECFDF5" : "#ffffff",
                                cursor: "pointer",
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: "0.82rem", color: "#111827" }}>
                                  {u.nombreCompleto}
                                </strong>
                                <span style={{ fontSize: "0.76rem", color: "#6B7280", marginLeft: "8px" }}>
                                  {u.correo}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 800,
                                  padding: "2px 7px",
                                  borderRadius: "999px",
                                  background: u.yaEsAbogado ? "#EDE9FE" : seleccionado ? "#05876E" : "#F3F4F6",
                                  color: u.yaEsAbogado ? "#5B21B6" : seleccionado ? "#ffffff" : "#374151",
                                }}
                              >
                                {u.yaEsAbogado
                                  ? "Ya es Abogado (Editar)"
                                  : seleccionado
                                    ? "Seleccionado ✓"
                                    : "Seleccionar"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleGuardarAbogado} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Datos mínimos de identidad y contacto */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Nombres *
                  <input
                    type="text"
                    required
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="Ej. Carlos Andrés"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Apellidos *
                  <input
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej. Mendoza Paredes"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Correo Electrónico *
                  <input
                    type="email"
                    required
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="abogado@dominio.com"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Cédula / RUC *
                  <input
                    type="text"
                    required
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="1700000000"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  N.° Matrícula Foro / Credencial *
                  <input
                    type="text"
                    required
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ej. 17-2019-452"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Teléfono / WhatsApp *
                  <input
                    type="text"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="0990000000"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Estado en la Red *
                  <select
                    value={estadoAbogado}
                    onChange={(e) => setEstadoAbogado(e.target.value as "verificado" | "suspendido")}
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontWeight: 700 }}
                  >
                    <option value="verificado">Activo (Verificado — Ve portal de Abogado)</option>
                    <option value="suspendido">Suspendido / Inactivo</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Años de Experiencia
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={anosExperiencia}
                    onChange={(e) => setAnosExperiencia(Number(e.target.value))}
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                  Universidad (Opcional)
                  <input
                    type="text"
                    value={universidad}
                    onChange={(e) => setUniversidad(e.target.value)}
                    placeholder="Ej. PUCE / USFQ / UCE"
                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  />
                </label>
              </div>

              {/* Selección y Gestión de Especialidades Legales */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111827", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Scale size={15} color="#5000BA" />
                    Especialidades Legales ({materiasSeleccionadas.length} seleccionadas) *
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setModoGestionarEspecialidadesEnModal((prev) => !prev)}
                      style={{
                        background: modoGestionarEspecialidadesEnModal ? "#5000BA" : "#F5F3FF",
                        color: modoGestionarEspecialidadesEnModal ? "#ffffff" : "#5000BA",
                        border: "1px solid #DDD6FE",
                        borderRadius: "999px",
                        padding: "3px 10px",
                        fontSize: "0.73rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Plus size={12} />
                      {modoGestionarEspecialidadesEnModal ? "Cerrar gestión" : "Gestionar / Agregar"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMateriasSeleccionadas(
                          materiasSeleccionadas.length === materiasCat.length
                            ? []
                            : materiasCat.map((m) => m.mat_id)
                        )
                      }
                      style={{ background: "none", border: "none", color: "#5000BA", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer" }}
                    >
                      {materiasSeleccionadas.length === materiasCat.length ? "Limpiar" : "Seleccionar todas"}
                    </button>
                  </div>
                </div>

                {modoGestionarEspecialidadesEnModal && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      marginBottom: "10px",
                      background: "#ffffff",
                      border: "1px solid #DDD6FE",
                      borderRadius: "10px",
                      padding: "8px 10px",
                    }}
                  >
                    <input
                      type="text"
                      value={nuevaEspecialidadNombre}
                      onChange={(e) => setNuevaEspecialidadNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAgregarEspecialidad(true);
                        }
                      }}
                      placeholder="Nueva especialidad legal (ej. Derecho Ambiental, Aduanero...)"
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid #D1D5DB",
                        fontSize: "0.8rem",
                      }}
                    />
                    <button
                      type="button"
                      disabled={creandoEspecialidad || !nuevaEspecialidadNombre.trim()}
                      onClick={() => handleAgregarEspecialidad(true)}
                      className="btn-responsive-accion"
                      title="Agregar nueva especialidad legal al catálogo y seleccionarla"
                      aria-label="Agregar especialidad"
                      style={{
                        background: "#5000BA",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Plus size={14} />
                      <span className="btn-texto-responsive">
                        {creandoEspecialidad ? "Agregando..." : "Agregar"}
                      </span>
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {materiasCat.map((m) => {
                    const activa = materiasSeleccionadas.includes(m.mat_id);
                    return (
                      <div
                        key={m.mat_id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: "999px",
                          border: activa ? "1.5px solid #5000BA" : "1px solid #D1D5DB",
                          background: activa ? "#5000BA" : "#ffffff",
                          color: activa ? "#ffffff" : "#374151",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleMateria(m.mat_id)}
                          style={{
                            padding: modoGestionarEspecialidadesEnModal ? "5px 6px 5px 10px" : "5px 10px",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                          }}
                        >
                          {m.mat_nombre}
                        </button>
                        {modoGestionarEspecialidadesEnModal && (
                          <button
                            type="button"
                            disabled={eliminandoEspecialidadId === m.mat_id}
                            onClick={() => handleEliminarEspecialidad(m)}
                            title={`Eliminar especialidad "${m.mat_nombre}" del catálogo`}
                            aria-label={`Eliminar ${m.mat_nombre}`}
                            style={{
                              padding: "5px 8px 5px 4px",
                              border: "none",
                              background: "transparent",
                              color: activa ? "#FECACA" : "#DC2626",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selección de Zonas de Cobertura (Provincias) */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111827", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <MapPin size={15} color="#05876E" />
                    Zonas de Cobertura — Provincias ({provinciasSeleccionadas.length} seleccionadas) *
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setProvinciasSeleccionadas(
                        provinciasSeleccionadas.length === provinciasCat.length
                          ? []
                          : provinciasCat.map((p) => p.cat_id)
                      )
                    }
                    style={{ background: "none", border: "none", color: "#05876E", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer" }}
                  >
                    {provinciasSeleccionadas.length === provinciasCat.length
                      ? "Limpiar"
                      : "Cobertura Nacional (Todas)"}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "125px", overflowY: "auto" }}>
                  {provinciasCat.map((p) => {
                    const activa = provinciasSeleccionadas.includes(p.cat_id);
                    return (
                      <button
                        key={p.cat_id}
                        type="button"
                        onClick={() => toggleProvincia(p.cat_id)}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "999px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          border: activa ? "1.5px solid #05876E" : "1px solid #D1D5DB",
                          background: activa ? "#05876E" : "#ffffff",
                          color: activa ? "#ffffff" : "#374151",
                        }}
                      >
                        {p.cat_nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: "1px solid #D1D5DB",
                    background: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#05876E",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {guardando ? "Guardando..." : editandoAbogadoId ? "Guardar Cambios" : "Convertir y Activar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Configuración de Disponibilidad de Citas Presenciales / Teleconsulta */}
      {abogadoAgendaModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.12rem", fontWeight: 900, color: "#111827" }}>
                  Disponibilidad de Citas — {abogadoAgendaModal.nombreCompleto}
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: "0.8rem", color: "#6B7280" }}>
                  Configura modalidades (Presencial y Teleconsulta), duración y franjas horarias semanales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbogadoAgendaModal(null)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Modalidades Habilitadas */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111827", display: "block", marginBottom: "8px" }}>
                  Modalidades de Atención Habilitadas
                </span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: configAgenda.modalidades.includes("virtual") ? "2px solid #0284C7" : "1px solid #D1D5DB",
                      background: configAgenda.modalidades.includes("virtual") ? "#F0F9FF" : "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={configAgenda.modalidades.includes("virtual")}
                      onChange={(e) => {
                        const nuevas = e.target.checked
                          ? Array.from(new Set([...configAgenda.modalidades, "virtual" as const]))
                          : configAgenda.modalidades.filter((m) => m !== "virtual");
                        setConfigAgenda({ ...configAgenda, modalidades: nuevas });
                      }}
                    />
                    <Video size={16} color="#0284C7" />
                    Teleconsulta (Videollamada)
                  </label>

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: configAgenda.modalidades.includes("presencial") ? "2px solid #05876E" : "1px solid #D1D5DB",
                      background: configAgenda.modalidades.includes("presencial") ? "#ECFDF5" : "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={configAgenda.modalidades.includes("presencial")}
                      onChange={(e) => {
                        const nuevas = e.target.checked
                          ? Array.from(new Set([...configAgenda.modalidades, "presencial" as const]))
                          : configAgenda.modalidades.filter((m) => m !== "presencial");
                        setConfigAgenda({ ...configAgenda, modalidades: nuevas });
                      }}
                    />
                    <Building2 size={16} color="#05876E" />
                    Atención Presencial (Consultorio / Despacho)
                  </label>
                </div>

                {configAgenda.modalidades.includes("presencial") && (
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700, marginTop: "12px" }}>
                    Dirección del Consultorio / Despacho Presencial
                    <input
                      type="text"
                      value={configAgenda.direccion ?? ""}
                      onChange={(e) => setConfigAgenda({ ...configAgenda, direccion: e.target.value })}
                      placeholder="Ej. Av. República del Salvador y Naciones Unidas, Edif. Citiplaza, Of. 402"
                      style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                    />
                  </label>
                )}
              </div>

              {/* Parámetros de cita */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 700 }}>
                  Duración Cita
                  <select
                    value={configAgenda.duracion_cita_min}
                    onChange={(e) => setConfigAgenda({ ...configAgenda, duracion_cita_min: Number(e.target.value) })}
                    style={{ padding: "8px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  >
                    {[15, 30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>{n} minutos</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 700 }}>
                  Descanso entre Citas
                  <select
                    value={configAgenda.holgura_min}
                    onChange={(e) => setConfigAgenda({ ...configAgenda, holgura_min: Number(e.target.value) })}
                    style={{ padding: "8px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  >
                    {[0, 5, 10, 15, 30].map((n) => (
                      <option key={n} value={n}>{n} minutos</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 700 }}>
                  Antelación Mínima
                  <select
                    value={configAgenda.antelacion_minima_horas}
                    onChange={(e) => setConfigAgenda({ ...configAgenda, antelacion_minima_horas: Number(e.target.value) })}
                    style={{ padding: "8px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                  >
                    {[1, 2, 6, 12, 24, 48].map((n) => (
                      <option key={n} value={n}>{n} horas</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Franjas Horarias */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#111827", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={15} color="#5000BA" />
                    Franjas Horarias Semanales ({huecosCalculadosModal} citas/semana)
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setFranjasAgenda(FRANJAS_BASE)}
                      style={{
                        background: "#EEF2FF",
                        color: "#4338CA",
                        border: "1px solid #C7D2FE",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "0.73rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Lun–Vie 09:00–17:00
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFranjasAgenda((prev) => [
                          ...prev,
                          { dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
                        ])
                      }
                      style={{
                        background: "#05876E",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "4px 9px",
                        fontSize: "0.73rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Plus size={12} /> Añadir Franja
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {franjasAgenda.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr 1fr 1.3fr auto",
                        gap: "8px",
                        alignItems: "center",
                        background: "#ffffff",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <select
                        value={f.dia_semana}
                        onChange={(e) =>
                          setFranjasAgenda((arr) =>
                            arr.map((item, i) =>
                              i === idx ? { ...item, dia_semana: Number(e.target.value) } : item
                            )
                          )
                        }
                        style={{ padding: "6px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.8rem" }}
                      >
                        {DIAS_SEMANA.map((d: string, n: number) => (
                          <option key={n} value={n}>{d}</option>
                        ))}
                      </select>

                      <input
                        type="time"
                        value={f.hora_inicio.slice(0, 5)}
                        onChange={(e) =>
                          setFranjasAgenda((arr) =>
                            arr.map((item, i) =>
                              i === idx ? { ...item, hora_inicio: e.target.value } : item
                            )
                          )
                        }
                        style={{ padding: "6px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.8rem" }}
                      />

                      <input
                        type="time"
                        value={f.hora_fin.slice(0, 5)}
                        onChange={(e) =>
                          setFranjasAgenda((arr) =>
                            arr.map((item, i) =>
                              i === idx ? { ...item, hora_fin: e.target.value } : item
                            )
                          )
                        }
                        style={{ padding: "6px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.8rem" }}
                      />

                      <select
                        value={f.modalidad}
                        onChange={(e) =>
                          setFranjasAgenda((arr) =>
                            arr.map((item, i) =>
                              i === idx
                                ? { ...item, modalidad: e.target.value as Franja["modalidad"] }
                                : item
                            )
                          )
                        }
                        style={{ padding: "6px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.8rem" }}
                      >
                        <option value="ambas">Presencial y Teleconsulta</option>
                        <option value="virtual">Solo Teleconsulta</option>
                        <option value="presencial">Solo Presencial</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setFranjasAgenda((arr) => arr.filter((_, i) => i !== idx))}
                        title="Quitar franja"
                        style={{
                          background: "#FEF2F2",
                          color: "#DC2626",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setAbogadoAgendaModal(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: "1px solid #D1D5DB",
                    background: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardandoAgenda}
                  onClick={handleGuardarDisponibilidad}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#05876E",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {guardandoAgenda ? "Guardando..." : "Guardar Disponibilidad"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Invitar Abogados por Correo (Individual o Lista Masiva) hacia https://www.tranqi24.com/abogados */}
      {modalInvitarAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: "#F5F3FF",
                    color: "#5000BA",
                    padding: "3px 9px",
                    borderRadius: "999px",
                  }}
                >
                  Convocatoria de Red Profesional
                </span>
                <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.15rem", fontWeight: 900, color: "#111827" }}>
                  Invitar Abogados por Correo Electrónico
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6B7280" }}>
                  Ingresa uno o varios correos o carga un archivo con tu lista para enviar el enlace oficial de registro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalInvitarAbierto(false)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEnviarInvitaciones} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Enlace destino informativo */}
              <div
                style={{
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#065F46" }}>
                  <strong>Enlace incluido en el correo:</strong>{" "}
                  <a
                    href="https://www.tranqi24.com/abogados"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#05876E", fontWeight: 800, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    https://www.tranqi24.com/abogados <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Entrada de correo individual o pegado de lista + carga de archivo CSV/TXT */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111827" }}>
                    1. Ingresar correo(s) o pegar lista de correos
                  </span>
                  <label
                    className="btn-responsive-accion"
                    title="Cargar un archivo .CSV o .TXT con una lista de correos electrónicos"
                    aria-label="Cargar lista de correos desde archivo"
                    style={{
                      background: "#F5F3FF",
                      color: "#5000BA",
                      border: "1px solid #DDD6FE",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Upload size={14} />
                    <span className="btn-texto-responsive">Cargar Lista (.CSV / .TXT)</span>
                    <input
                      type="file"
                      accept=".csv,.txt,text/plain,text/csv"
                      onChange={handleCargarArchivoCorreos}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                <textarea
                  rows={3}
                  value={textoCorreosEntrada}
                  onChange={(e) => setTextoCorreosEntrada(e.target.value)}
                  placeholder="Ejemplo: abogado1@firma.ec, abogado2@estudio.com&#10;Puedes pegar varios correos separados por coma, punto y coma o salto de línea..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    fontSize: "0.82rem",
                    fontFamily: "inherit",
                  }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.74rem", color: "#6B7280" }}>
                    Detecta automáticamente todos los correos pegados o del archivo cargado.
                  </span>
                  <button
                    type="button"
                    onClick={agregarCorreosALista}
                    className="btn-responsive-accion"
                    title="Agregar los correos escritos a la lista de destinatarios"
                    aria-label="Agregar correos"
                    style={{
                      background: "#05876E",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Plus size={14} />
                    <span className="btn-texto-responsive">Agregar a Lista</span>
                  </button>
                </div>
              </div>

              {/* Lista de destinatarios en cola */}
              <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#111827" }}>
                    Destinatarios en lista ({listaCorreosInvitar.length})
                  </span>
                  {listaCorreosInvitar.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setListaCorreosInvitar([])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#DC2626",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Vaciar lista
                    </button>
                  )}
                </div>

                {listaCorreosInvitar.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#9CA3AF" }}>
                    Aún no has agregado correos a la lista (también puedes escribir arriba y pulsar directamente &quot;Enviar Invitaciones&quot;).
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
                    {listaCorreosInvitar.map((c) => (
                      <span
                        key={c}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#F5F3FF",
                          color: "#5000BA",
                          border: "1px solid #DDD6FE",
                          borderRadius: "999px",
                          padding: "3px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => setListaCorreosInvitar((prev) => prev.filter((item) => item !== c))}
                          title={`Quitar ${c}`}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#5000BA",
                            cursor: "pointer",
                            padding: 0,
                            display: "inline-flex",
                          }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mensaje personalizado opcional */}
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                Mensaje adicional en la invitación (Opcional)
                <textarea
                  rows={2}
                  value={mensajePersonalizadoInvitacion}
                  onChange={(e) => setMensajePersonalizadoInvitacion(e.target.value)}
                  placeholder="Ej. Estimado colega, te invitamos a formar parte de nuestra red nacional de especialistas en Tranqi..."
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    fontSize: "0.82rem",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setModalInvitarAbierto(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: "1px solid #D1D5DB",
                    background: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoInvitaciones}
                  className="btn-responsive-accion"
                  title="Enviar correo de invitación con el enlace https://www.tranqi24.com/abogados"
                  aria-label="Enviar invitaciones"
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#5000BA",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Send size={15} />
                  <span className="btn-texto-responsive">
                    {enviandoInvitaciones ? "Enviando..." : "Enviar Invitaciones"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Gestión del Catálogo de Especialidades Legales (Agregar / Eliminar) */}
      {modalEspecialidadesAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "620px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: "#F5F3FF",
                    color: "#5000BA",
                    padding: "3px 9px",
                    borderRadius: "999px",
                  }}
                >
                  Catálogo Jurídico · tranqi
                </span>
                <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.15rem", fontWeight: 900, color: "#111827" }}>
                  Gestionar Especialidades Legales ({materiasCat.length})
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6B7280" }}>
                  Agrega nuevas especialidades o elimina las que ya no requieras en el directorio profesional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalEspecialidadesAbierto(false)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Formulario para agregar nueva especialidad */}
              <div
                style={{
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "12px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={nuevaEspecialidadNombre}
                  onChange={(e) => setNuevaEspecialidadNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAgregarEspecialidad(false);
                    }
                  }}
                  placeholder="Escribe el nombre de la especialidad (ej. Derecho Ambiental, Aduanero...)"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    fontSize: "0.84rem",
                  }}
                />
                <button
                  type="button"
                  disabled={creandoEspecialidad || !nuevaEspecialidadNombre.trim()}
                  onClick={() => handleAgregarEspecialidad(false)}
                  className="btn-responsive-accion"
                  title="Agregar nueva especialidad legal"
                  aria-label="Agregar especialidad legal"
                  style={{
                    background: "#5000BA",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Plus size={15} />
                  <span className="btn-texto-responsive">
                    {creandoEspecialidad ? "Agregando..." : "Agregar"}
                  </span>
                </button>
              </div>

              {/* Lista de especialidades existentes */}
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "12px",
                  maxHeight: "340px",
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                  gap: "8px",
                }}
              >
                {materiasCat.length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>
                    No hay especialidades registradas.
                  </span>
                ) : (
                  materiasCat.map((m) => (
                    <div
                      key={m.mat_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        background: "#ffffff",
                      }}
                    >
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#111827", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Scale size={14} color="#5000BA" />
                        {m.mat_nombre}
                      </span>
                      <button
                        type="button"
                        disabled={eliminandoEspecialidadId === m.mat_id}
                        onClick={() => handleEliminarEspecialidad(m)}
                        title={`Eliminar especialidad "${m.mat_nombre}"`}
                        aria-label={`Eliminar ${m.mat_nombre}`}
                        style={{
                          background: "#FEF2F2",
                          color: "#DC2626",
                          border: "1px solid #FECACA",
                          borderRadius: "6px",
                          padding: "4px 6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setModalEspecialidadesAbierto(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#05876E",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Historial de Asignación, Aceptación y Cambios de Rol */}
      {abogadoHistorialModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "88vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
              border: "1px solid #E5E7EB",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: "#F5F3FF",
                    color: "#5000BA",
                    padding: "3px 9px",
                    borderRadius: "999px",
                  }}
                >
                  Trazabilidad & Auditoría de Rol
                </span>
                <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.15rem", fontWeight: 900, color: "#111827" }}>
                  Historial de Cambios de Rol — {abogadoHistorialModal.nombreCompleto}
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6B7280" }}>
                  {abogadoHistorialModal.correo} · Cédula: {abogadoHistorialModal.cedula || "—"} · Casos activos:{" "}
                  <b>{abogadoHistorialModal.casosAsignadosActivos || 0}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbogadoHistorialModal(null)}
                style={{
                  background: "#F3F4F6",
                  border: "none",
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(abogadoHistorialModal.historialCambiosRol || []).length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "#6B7280", textAlign: "center", padding: "20px" }}>
                  No se registran movimientos adicionales en el historial.
                </p>
              ) : (
                abogadoHistorialModal.historialCambiosRol.map((item) => {
                  const fechaFmt = item.fecha
                    ? new Date(item.fecha).toLocaleString("es-EC", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";
                  const badgeColor =
                    item.estadoResultante === "activo"
                      ? { bg: "#ECFDF5", fg: "#065F46", label: "✓ Rol Activo" }
                      : item.estadoResultante === "baja_logica"
                        ? { bg: "#FEF2F2", fg: "#991B1B", label: "Baja Lógica" }
                        : item.estadoResultante === "suspendido"
                          ? { bg: "#FFFBEB", fg: "#92400E", label: "Suspendido" }
                          : item.estadoResultante === "rechazado"
                            ? { bg: "#FEF2F2", fg: "#991B1B", label: "Rechazado" }
                            : { bg: "#EFF6FF", fg: "#1D4ED8", label: "Pendiente Aceptación" };

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        background: "#F9FAFB",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: badgeColor.bg,
                              color: badgeColor.fg,
                            }}
                          >
                            {badgeColor.label}
                          </span>
                          <strong style={{ fontSize: "0.84rem", color: "#111827" }}>
                            {item.accion.replace(/_/g, " ")} ({item.rol})
                          </strong>
                        </div>
                        <span style={{ fontSize: "0.76rem", color: "#6B7280", fontWeight: 700 }}>
                          {fechaFmt}
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151" }}>{item.detalle}</p>

                      <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                        <b>Ejecutado por:</b> {item.ejecutadoPorNombre}{" "}
                        {item.ejecutadoPorCorreo ? `(${item.ejecutadoPorCorreo})` : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => setAbogadoHistorialModal(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                }}
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PERSONALIZADO DE LA PLATAFORMA */}
      <ModalNotificacionPush
        abierto={modalConfirmacion.abierto}
        tipo={modalConfirmacion.tipo}
        titulo={modalConfirmacion.titulo}
        mensaje={modalConfirmacion.mensaje}
        textoBoton={modalConfirmacion.textoBoton}
        textoCancelar={modalConfirmacion.textoCancelar}
        mostrarConfirmacion={modalConfirmacion.mostrarConfirmacion}
        alAceptar={modalConfirmacion.alAceptar}
        alCancelar={modalConfirmacion.alCancelar || cerrarModalConfirmacion}
      />
    </div>
  );
}
