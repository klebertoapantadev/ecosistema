"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, SelectConBuscador, type ColumnaDataGrid } from "@eco/datagrid";
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Columns3,
  Edit3,
  ExternalLink,
  FilePlus2,
  Loader2,
  MapPin,
  Music,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  Truck,
  Upload,
  CreditCard,
  User,
  X,
} from "lucide-react";
import {
  actualizarEstadoPedidoTiendaAction,
  adjuntarComprobantePedidoAction,
  obtenerPedidosTiendaAction,
  type PedidoTiendaRegistrado,
} from "../acciones-logistica";
import { subirComprobanteTransferenciaAction } from "../acciones-tienda-checkout";
import {
  actualizarClasificacionPedidoAction,
  eliminarPedidoOperativoAction,
  guardarEdicionPedidoYTarjetaAction,
  restaurarPedidoEliminadoAction,
} from "../acciones-operaciones-taller";
import {
  CLASIFICACIONES_OPERATIVAS_PEDIDO,
  ESTADOS_PEDIDO_DEFECTO,
  OPCIONES_SALA_EXEQUIALES,
  RANGOS_HORARIO_ENTREGA_TIENDA,
  construirValoresHorarioGuardar,
  esNombreFallecidoPendiente,
  formatearHorarioEntregaOrden,
  inferirClasificacionPedido,
  obtenerDefinicionClasificacionPedido,
  obtenerFechaHoyEcuadorYmd,
  resolverEstadoInicialHorario,
  type ClasificacionOperativaPedido,
  type EstadoPedidoConfig,
  type ModoSelectorHorarioEntrega,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";
import {
  BarraFiltroClasificacionPedido,
  InsigniaClasificacionPedido,
  ModalVisorEvidenciaEntrega,
  type DatosVisorEvidenciaModal,
} from "./InsigniaClasificacionPedido";
import { ModalAdminEstadosPedido } from "./ModalAdminEstadosPedido";
import { ModalEditarVariacionProforma } from "./ModalEditarVariacionProforma";
import { ModalImprimirTarjetaTaller } from "./ModalImprimirTarjetaTaller";
import { ModalWizardPedidoAria } from "./ModalWizardPedidoAria";

interface PropsBandejaPedidosTienda {
  negocio: string;
  pedidosIniciales?: PedidoTiendaRegistrado[];
}

function estiloEstado(estado: string, listaEstados: EstadoPedidoConfig[] = ESTADOS_PEDIDO_DEFECTO) {
  const encontrado = listaEstados.find((e) => e.valor === estado);
  return (
    encontrado ?? {
      valor: estado,
      etiqueta: estado,
      colorFondo: "#F4F2EE",
      colorTexto: "#3A3530",
    }
  );
}

function resolverClasificacionPedidoTienda(
  p: PedidoTiendaRegistrado
): ClasificacionOperativaPedido {
  return inferirClasificacionPedido({
    clasificacionExplicita: p.clasificacionPedido,
    origenTipo: p.tipoOrigen,
    retiroEnLocal: p.logistica.retiroEnLocal,
    salaServicio: p.exequiales?.salaServicio ?? p.salaServicio ?? null,
    productoResumen: p.items.map((it) => it.descripcion).join(" "),
    ubicacionEntrega: p.logistica.direccion,
    metodoPago: p.metodoPago,
    tarjetaTipo: p.tarjeta?.tipo ?? null,
    tieneEvento: Boolean(p.evento),
    items: p.items.map((it) => ({
      descripcion: it.descripcion,
      sku: it.varianteNombre,
    })),
  });
}

function convertirPedidoTiendaAOrdenTaller(p: PedidoTiendaRegistrado): OrdenTrabajoTaller {
  const primerDed = p.items.find((it) => it.dedicatoria?.mensaje)?.dedicatoria;
  const esExeq =
    p.tipoOrigen === "EXEQUIALES_LLAMADA" ||
    resolverClasificacionPedidoTienda(p) === "EXEQUIALES";
  return {
    id: p.ordenTallerId || p.id,
    proformaId: p.ordenTallerId ? p.id : p.id,
    entregaId: p.entregaId ?? p.evidenciaEntrega?.entregaId ?? null,
    codigo: p.codigoOrden,
    origenTipo: esExeq
      ? "EXEQUIALES_LLAMADA"
      : p.tipoOrigen === "PROFORMA_EVENTO"
        ? "PROFORMA_EVENTO"
        : p.tipoOrigen === "MANUAL_ADMIN"
          ? "MANUAL_ADMIN"
          : "VENTA_TIENDA",
    estadoTaller:
      p.estado === "ENTREGADO"
        ? "ENTREGADO"
        : p.estado === "EN_RUTA"
          ? "LISTO_ENTREGA"
          : p.estado === "EN_PREPARACION"
            ? "EN_PREPARACION"
            : "PENDIENTE_ENVIO",
    estadoPago: p.estado,
    metodoPago: p.metodoPago,
    fechaPedido: p.creadoEn,
    fechaEntrega: p.logistica.fechaEntrega,
    franjaHoraria: p.logistica.franjaHoraria || null,
    horaEspecifica: p.logistica.horaExacta || p.exequiales?.horaServicio || null,
    productoResumen:
      p.items.map((it) => `${it.cantidad}x ${it.descripcion}`).join(" + ") || "Arreglo floral",
    items: p.items.map((it) => ({
      descripcion: it.descripcion,
      sku: it.varianteNombre || undefined,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      dedicatoria: it.dedicatoria?.mensaje,
    })),
    clienteSolicita: p.tarjeta?.de || p.exequiales?.quienSolicita || p.compradorNombre,
    clienteTelefono: p.compradorTelefono || p.logistica.destinatarioTelefono || undefined,
    destinatarioFallecido:
      p.tarjeta?.para || p.exequiales?.nombreFallecido || p.logistica.destinatarioNombre || "",
    salaServicio: p.exequiales?.salaServicio ?? p.salaServicio ?? null,
    ubicacionEntrega: p.logistica.direccion,
    enlaceMapa: p.logistica.enlaceMapa || null,
    retiroEnLocal: p.logistica.retiroEnLocal,
    dedicatoria: p.tarjeta?.mensaje ?? primerDed?.mensaje ?? "",
    tarjetaToken: p.tarjeta?.token || p.tokenAprobacion || p.id,
    tarjetaTokenEdicion: p.tarjeta?.tokenEdicion,
    tarjetaConfidencial: Boolean(
      p.tarjeta?.confidencial ?? p.tarjeta?.metadata?.confidencial_solo_qr
    ),
    tarjetaTipo: p.tarjeta?.tipo || (esExeq ? "CONDOLENCIAS_PLANA" : "DIPTICO"),
    tarjetaDiseno: p.tarjeta?.diseno ?? p.tarjeta?.metadata?.diseno,
    tarjetaMusicaUrl: p.tarjeta?.musicaUrl ?? null,
    tarjetaMusicaTitulo: p.tarjeta?.musicaTitulo ?? null,
    tarjetaLyrics: p.tarjeta?.lyrics ?? [],
    tarjetaMetadata: p.tarjeta?.metadata ?? {},
    observaciones: p.logistica.referencia || undefined,
    totalUsd: p.total,
  };
}

interface FormularioEdicionPedido {
  pedidoBase: PedidoTiendaRegistrado;
  clasificacionPedido: ClasificacionOperativaPedido;
  compradorNombre: string;
  compradorTelefono: string;
  destinatarioNombre: string;
  direccionEntrega: string;
  enlaceMapa: string;
  retiroEnLocal: boolean;
  salaServicio: string;
  fechaEntrega: string;
  modoHorario: ModoSelectorHorarioEntrega;
  horaExacta: string;
  productoResumen: string;
  observaciones: string;
  dedicatoria: string;
}

type FiltroFechaPedidos =
  | "HOY"
  | "AYER"
  | "ESTA_SEMANA"
  | "SEMANA_MAS_MENOS_3"
  | "MES"
  | "TODOS";

const TABS_FECHA_PEDIDOS: ReadonlyArray<{
  clave: FiltroFechaPedidos;
  etiqueta: string;
  descripcion: string;
}> = [
  { clave: "HOY", etiqueta: "Hoy", descripcion: "Pedidos con entrega hoy" },
  { clave: "AYER", etiqueta: "Ayer", descripcion: "Pedidos con entrega ayer" },
  {
    clave: "ESTA_SEMANA",
    etiqueta: "Esta Semana",
    descripcion: "Lunes a domingo de la semana actual",
  },
  {
    clave: "SEMANA_MAS_MENOS_3",
    etiqueta: "Semana ±3 días",
    descripcion: "Desde hace 3 días hasta los próximos 3 días",
  },
  { clave: "MES", etiqueta: "Mes", descripcion: "Todos los pedidos del mes actual" },
  { clave: "TODOS", etiqueta: "Todos", descripcion: "Historial completo sin límite de fechas" },
];

function sumarDiasYmd(ymd: string, dias: number): string {
  const partes = ymd.split("-").map(Number);
  const anio = partes[0] || 2026;
  const mes = (partes[1] || 1) - 1;
  const dia = partes[2] || 1;
  const dt = new Date(Date.UTC(anio, mes, dia + dias));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function obtenerRangoSemanaActualYmd(hoyYmd: string): { inicio: string; fin: string } {
  const partes = hoyYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(partes[0] || 2026, (partes[1] || 1) - 1, partes[2] || 1));
  const diaSemana = dt.getUTCDay(); // 0 = Dom, 1 = Lun, ... 6 = Sab
  const diffALunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const inicio = sumarDiasYmd(hoyYmd, diffALunes);
  const fin = sumarDiasYmd(inicio, 6);
  return { inicio, fin };
}

function obtenerFechaReferenciaPedidoYmd(p: PedidoTiendaRegistrado): string {
  const entrega = String(p.logistica?.fechaEntrega || "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(entrega)) return entrega;
  const creado = String(p.creadoEn || "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(creado)) return creado;
  return "";
}

function pedidoPerteneceAFiltroFecha(
  p: PedidoTiendaRegistrado,
  filtro: FiltroFechaPedidos,
  hoyYmd: string
): boolean {
  if (filtro === "TODOS") return true;
  const f = obtenerFechaReferenciaPedidoYmd(p);
  if (!f) return false;
  if (filtro === "HOY") return f === hoyYmd;
  if (filtro === "AYER") return f === sumarDiasYmd(hoyYmd, -1);
  if (filtro === "ESTA_SEMANA") {
    const { inicio, fin } = obtenerRangoSemanaActualYmd(hoyYmd);
    return f >= inicio && f <= fin;
  }
  if (filtro === "SEMANA_MAS_MENOS_3") {
    const inicio = sumarDiasYmd(hoyYmd, -3);
    const fin = sumarDiasYmd(hoyYmd, 3);
    return f >= inicio && f <= fin;
  }
  if (filtro === "MES") {
    return f.slice(0, 7) === hoyYmd.slice(0, 7);
  }
  return true;
}

export function BandejaPedidosTienda({
  negocio,
  pedidosIniciales,
}: PropsBandejaPedidosTienda) {
  const cacheKey = `eco_pedidos_tienda_${negocio.trim().toLowerCase()}`;
  const [pedidos, setPedidos] = useState<PedidoTiendaRegistrado[]>(pedidosIniciales ?? []);
  const [cargando, setCargando] = useState<boolean>(!pedidosIniciales);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [pedidoEnfocado, setPedidoEnfocado] = useState<string>("");
  const [filtroClasificacion, setFiltroClasificacion] = useState<
    ClasificacionOperativaPedido | "TODOS"
  >("TODOS");
  const [visorEvidencia, setVisorEvidencia] = useState<DatosVisorEvidenciaModal | null>(null);
  const [proformaEditandoVariacion, setProformaEditandoVariacion] =
    useState<PedidoTiendaRegistrado | null>(null);
  const [pedidoParaTarjeta, setPedidoParaTarjeta] = useState<PedidoTiendaRegistrado | null>(null);
  const [formEdicionPedido, setFormEdicionPedido] = useState<FormularioEdicionPedido | null>(null);
  const [errorModalEdicion, setErrorModalEdicion] = useState<string | null>(null);
  const [guardandoEdicionPedido, setGuardandoEdicionPedido] = useState<boolean>(false);
  const [esAdminEstricto, setEsAdminEstricto] = useState<boolean>(false);
  const [puedeEliminarLogico, setPuedeEliminarLogico] = useState<boolean>(false);
  const [pedidosEliminados, setPedidosEliminados] = useState<PedidoTiendaRegistrado[]>([]);
  const [verPapelera, setVerPapelera] = useState<boolean>(false);
  const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoTiendaRegistrado | null>(null);
  const [motivoEliminacion, setMotivoEliminacion] = useState<string>("");
  const [procesandoEliminacion, setProcesandoEliminacion] = useState<boolean>(false);
  const [modoVista, setModoVista] = useState<"tabla" | "kanban">("kanban");
  const [filtroFecha, setFiltroFecha] = useState<FiltroFechaPedidos>("HOY");
  const [busquedaKanban, setBusquedaKanban] = useState<string>("");
  const [opcionesAbiertas, setOpcionesAbiertas] = useState<boolean>(false);
  const opcionesContenedorRef = useRef<HTMLDivElement | null>(null);
  const [arrastrandoPedidoId, setArrastrandoPedidoId] = useState<string | null>(null);
  const [estadoHoverKanban, setEstadoHoverKanban] = useState<string | null>(null);
  const [estadosConfig, setEstadosConfig] = useState<EstadoPedidoConfig[]>(ESTADOS_PEDIDO_DEFECTO);
  const [mostrarWizardAria, setMostrarWizardAria] = useState<boolean>(false);
  const [mostrarAdminEstados, setMostrarAdminEstados] = useState<boolean>(false);
  const [subiendoEvidenciaPedidoId, setSubiendoEvidenciaPedidoId] = useState<string | null>(null);
  const hoyEcuadorYmd = useMemo(() => obtenerFechaHoyEcuadorYmd(), []);

  const handleSubirComprobantePedido = async (
    pedido: PedidoTiendaRegistrado,
    archivo: File
  ) => {
    setErrorMsg(null);
    setSubiendoEvidenciaPedidoId(pedido.id);
    try {
      const fd = new FormData();
      fd.set("negocio", negocio);
      fd.set("archivo", archivo);
      const resSubida = await subirComprobanteTransferenciaAction(fd);
      if (!resSubida.ok) {
        setErrorMsg(resSubida.error);
        return;
      }
      const resAdj = await adjuntarComprobantePedidoAction({
        negocio,
        pedidoId: pedido.id,
        ordenTallerId: pedido.ordenTallerId ?? null,
        comprobante: resSubida.comprobante,
      });
      if (!resAdj.ok) {
        setErrorMsg(resAdj.error);
        return;
      }
      setPedidos((prev) => {
        const actualizado = prev.map((it) =>
          it.id === pedido.id
            ? { ...it, comprobanteTransferencia: resAdj.comprobante }
            : it
        );
        try {
          localStorage.setItem(cacheKey, JSON.stringify(actualizado));
        } catch {
          // Ignorar cuota localStorage
        }
        return actualizado;
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "No se pudo adjuntar el recibo al pedido.");
    } finally {
      setSubiendoEvidenciaPedidoId(null);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const guardado = localStorage.getItem(
        `eco_pedidos_modo_vista_v2_${negocio.trim().toLowerCase()}`
      );
      if (guardado === "kanban" || guardado === "tabla") {
        setModoVista(guardado);
      }
    } catch {
      // Ignorar
    }
  }, [negocio]);

  useEffect(() => {
    if (!opcionesAbiertas || typeof window === "undefined") return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpcionesAbiertas(false);
    };
    const onPointerDown = (ev: MouseEvent) => {
      if (
        opcionesContenedorRef.current &&
        !opcionesContenedorRef.current.contains(ev.target as Node)
      ) {
        setOpcionesAbiertas(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [opcionesAbiertas]);

  const cambiarFiltroFecha = useCallback((nuevo: FiltroFechaPedidos) => {
    setFiltroFecha(nuevo);
  }, []);

  const cambiarModoVista = useCallback(
    (nuevo: "tabla" | "kanban") => {
      setModoVista(nuevo);
      try {
        localStorage.setItem(`eco_pedidos_modo_vista_v2_${negocio.trim().toLowerCase()}`, nuevo);
      } catch {
        // Ignorar
      }
    },
    [negocio]
  );

  const restablecerOpciones = useCallback(() => {
    setFiltroFecha("HOY");
    setFiltroClasificacion("TODOS");
    setVerPapelera(false);
    setBusquedaKanban("");
  }, []);

  const abrirEdicionDatosPedido = useCallback((p: PedidoTiendaRegistrado) => {
    const primerDed = p.items.find((it) => it.dedicatoria?.mensaje)?.dedicatoria;
    const clasif = resolverClasificacionPedidoTienda(p);
    const esExeq = clasif === "EXEQUIALES";
    const destinatarioRaw =
      p.exequiales?.nombreFallecido || p.logistica.destinatarioNombre || "";
    const horarioIni = resolverEstadoInicialHorario({
      franjaHoraria: p.logistica.franjaHoraria,
      horaEspecifica: p.logistica.horaExacta || p.exequiales?.horaServicio || null,
      esExequiales: esExeq,
    });

    setErrorModalEdicion(null);
    setFormEdicionPedido({
      pedidoBase: p,
      clasificacionPedido: clasif,
      compradorNombre: p.exequiales?.quienSolicita || p.compradorNombre || "",
      compradorTelefono: p.compradorTelefono || p.logistica.destinatarioTelefono || "",
      destinatarioNombre:
        esExeq && esNombreFallecidoPendiente(destinatarioRaw) ? "" : destinatarioRaw,
      direccionEntrega: p.logistica.direccion || "",
      enlaceMapa: p.logistica.enlaceMapa || "",
      retiroEnLocal: Boolean(p.logistica.retiroEnLocal),
      salaServicio: p.exequiales?.salaServicio ?? p.salaServicio ?? "",
      fechaEntrega: (p.logistica.fechaEntrega || "").slice(0, 10),
      modoHorario: horarioIni.modo,
      horaExacta: horarioIni.horaExacta,
      productoResumen:
        p.items.map((it) => it.descripcion).join(" + ") || "Arreglo floral",
      observaciones: p.logistica.referencia || "",
      dedicatoria: p.tarjeta?.mensaje ?? primerDed?.mensaje ?? "",
    });
  }, []);

  const handleGuardarEdicionPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEdicionPedido) return;

    const esExeq = formEdicionPedido.clasificacionPedido === "EXEQUIALES";
    if (esExeq && esNombreFallecidoPendiente(formEdicionPedido.destinatarioNombre)) {
      setErrorModalEdicion(
        "En pedidos de Exequiales, el nombre de la Persona Fallecida (Destinatario) es requerido."
      );
      return;
    }
    if (formEdicionPedido.modoHorario === "HORA_EXACTA" && !formEdicionPedido.horaExacta.trim()) {
      setErrorModalEdicion("Selecciona la hora exacta de entrega.");
      return;
    }

    const horarioFinal = construirValoresHorarioGuardar(
      formEdicionPedido.modoHorario,
      formEdicionPedido.horaExacta
    );

    setGuardandoEdicionPedido(true);
    setErrorModalEdicion(null);
    setErrorMsg(null);
    const p = formEdicionPedido.pedidoBase;
    const res = await guardarEdicionPedidoYTarjetaAction({
      negocio,
      pedidoId: p.id,
      ordenTallerId: p.ordenTallerId ?? null,
      entregaId: p.entregaId ?? p.evidenciaEntrega?.entregaId ?? null,
      clasificacionPedido: formEdicionPedido.clasificacionPedido,
      compradorNombre: formEdicionPedido.compradorNombre,
      compradorTelefono: esExeq ? "" : formEdicionPedido.compradorTelefono,
      destinatarioNombre: formEdicionPedido.destinatarioNombre.trim(),
      direccionEntrega: esExeq
        ? ""
        : formEdicionPedido.retiroEnLocal
          ? "Retiro en Tienda"
          : formEdicionPedido.direccionEntrega,
      enlaceMapa: esExeq ? "" : formEdicionPedido.enlaceMapa,
      retiroEnLocal: esExeq ? false : formEdicionPedido.retiroEnLocal,
      salaServicio: esExeq ? formEdicionPedido.salaServicio || null : null,
      fechaEntrega: formEdicionPedido.fechaEntrega,
      franjaHoraria: horarioFinal.franjaHoraria,
      horaEspecifica: horarioFinal.horaEspecifica,
      productoResumen: formEdicionPedido.productoResumen,
      observaciones: formEdicionPedido.observaciones,
      dedicatoria: esExeq ? "" : formEdicionPedido.dedicatoria,
      tarjetaTipo:
        formEdicionPedido.clasificacionPedido === "CONDOLENCIAS"
          ? "CONDOLENCIAS_PLANA"
          : undefined,
    });
    setGuardandoEdicionPedido(false);
    if (!res.ok) {
      setErrorModalEdicion(res.error || "No se pudieron guardar los cambios del pedido.");
      return;
    }
    setFormEdicionPedido(null);
    await cargarPedidos();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sincronizarDesdeUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const cod = (params.get("pedido") || params.get("codigo") || "").trim();
        if (cod) {
          setPedidoEnfocado(cod);
          setFiltroClasificacion("TODOS");
        }
      } catch {
        // Ignorar
      }
    };
    sincronizarDesdeUrl();
    window.addEventListener("eco:abrir-ruta-push", sincronizarDesdeUrl);
    return () => window.removeEventListener("eco:abrir-ruta-push", sincronizarDesdeUrl);
  }, []);

  const cargarPedidos = useCallback(async () => {
    setCargando(true);
    setErrorMsg(null);
    const res = await obtenerPedidosTiendaAction(negocio);
    if (!res.ok) {
      setErrorMsg(res.error);
      setCargando(false);
      return;
    }
    setPedidos(res.pedidos);
    const adminFlag = Boolean(res.esAdminEstricto);
    setEsAdminEstricto(adminFlag);
    setPuedeEliminarLogico(Boolean(res.puedeEliminarLogico));
    setPedidosEliminados(
      adminFlag && Array.isArray(res.pedidosEliminados) ? res.pedidosEliminados : []
    );
    if (Array.isArray(res.estadosConfig) && res.estadosConfig.length > 0) {
      setEstadosConfig(res.estadosConfig);
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify(res.pedidos));
    } catch {
      // Ignorar cuota de almacenamiento local
    }
    setCargando(false);
  }, [negocio, cacheKey]);

  useEffect(() => {
    if (!pedidosIniciales) {
      try {
        const guardado = localStorage.getItem(cacheKey);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPedidos(parsed as PedidoTiendaRegistrado[]);
          }
        }
      } catch {
        // Ignorar caché inválido
      }
      void cargarPedidos();
    } else {
      setPedidos(pedidosIniciales);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(pedidosIniciales));
      } catch {
        // Ignorar cuota
      }
      void cargarPedidos();
    }
  }, [pedidosIniciales, cacheKey, cargarPedidos]);

  useEffect(() => {
    if (!pedidoEnfocado) return;
    setFiltroFecha("TODOS");
    const upper = pedidoEnfocado.toUpperCase();
    const existe = pedidos.some(
      (p) => p.codigoOrden.toUpperCase().includes(upper) || p.id === pedidoEnfocado
    );
    if (!existe) {
      void cargarPedidos();
    }
  }, [pedidoEnfocado, pedidos, cargarPedidos]);

  const cambiarEstado = useCallback(
    async (pedidoId: string, nuevoEstado: string) => {
      setActualizandoId(pedidoId);
      setErrorMsg(null);
      const res = await actualizarEstadoPedidoTiendaAction(negocio, pedidoId, nuevoEstado);
      setActualizandoId(null);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPedidos((prev) => {
        const nuevaLista = prev.map((p) =>
          p.id === pedidoId ? { ...p, estado: nuevoEstado } : p
        );
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nuevaLista));
        } catch {
          // Ignorar cuota
        }
        return nuevaLista;
      });
    },
    [negocio, cacheKey]
  );

  const cambiarClasificacion = useCallback(
    async (pedidoId: string, nuevaClasif: ClasificacionOperativaPedido) => {
      setActualizandoId(pedidoId);
      setErrorMsg(null);
      const res = await actualizarClasificacionPedidoAction({
        negocio,
        pedidoId,
        clasificacionPedido: nuevaClasif,
      });
      setActualizandoId(null);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPedidos((prev) => {
        const nuevaLista = prev.map((p) =>
          p.id === pedidoId
            ? {
                ...p,
                clasificacionPedido: res.clasificacionPedido,
              }
            : p
        );
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nuevaLista));
        } catch {
          // Ignorar cuota
        }
        return nuevaLista;
      });
    },
    [negocio, cacheKey]
  );

  const baseActivaPedidos = useMemo(
    () => (verPapelera && esAdminEstricto ? pedidosEliminados : pedidos),
    [verPapelera, esAdminEstricto, pedidosEliminados, pedidos]
  );

  const conteosFecha = useMemo(() => {
    const mapa: Record<FiltroFechaPedidos, number> = {
      HOY: 0,
      AYER: 0,
      ESTA_SEMANA: 0,
      SEMANA_MAS_MENOS_3: 0,
      MES: 0,
      TODOS: baseActivaPedidos.length,
    };
    for (const p of baseActivaPedidos) {
      if (pedidoPerteneceAFiltroFecha(p, "HOY", hoyEcuadorYmd)) mapa.HOY++;
      if (pedidoPerteneceAFiltroFecha(p, "AYER", hoyEcuadorYmd)) mapa.AYER++;
      if (pedidoPerteneceAFiltroFecha(p, "ESTA_SEMANA", hoyEcuadorYmd)) mapa.ESTA_SEMANA++;
      if (pedidoPerteneceAFiltroFecha(p, "SEMANA_MAS_MENOS_3", hoyEcuadorYmd)) {
        mapa.SEMANA_MAS_MENOS_3++;
      }
      if (pedidoPerteneceAFiltroFecha(p, "MES", hoyEcuadorYmd)) mapa.MES++;
    }
    return mapa;
  }, [baseActivaPedidos, hoyEcuadorYmd]);

  const pedidosPorFecha = useMemo(() => {
    if (filtroFecha === "TODOS") return baseActivaPedidos;
    return baseActivaPedidos.filter((p) =>
      pedidoPerteneceAFiltroFecha(p, filtroFecha, hoyEcuadorYmd)
    );
  }, [baseActivaPedidos, filtroFecha, hoyEcuadorYmd]);

  const conteosClasificacion = useMemo(() => {
    const mapa: Partial<Record<ClasificacionOperativaPedido, number>> = {};
    for (const p of pedidosPorFecha) {
      const c = resolverClasificacionPedidoTienda(p);
      mapa[c] = (mapa[c] ?? 0) + 1;
    }
    return mapa;
  }, [pedidosPorFecha]);

  const pedidosFiltrados = useMemo(() => {
    if (filtroClasificacion === "TODOS") return pedidosPorFecha;
    return pedidosPorFecha.filter((p) => resolverClasificacionPedidoTienda(p) === filtroClasificacion);
  }, [pedidosPorFecha, filtroClasificacion]);

  const columnasKanbanDisponibles = useMemo(() => {
    const q = (busquedaKanban || pedidoEnfocado || "").trim().toLowerCase();
    const filtradosTexto = q
      ? pedidosFiltrados.filter((p) => {
          const texto = [
            p.codigoOrden,
            p.compradorNombre,
            p.logistica.destinatarioNombre,
            p.exequiales?.nombreFallecido,
            p.exequiales?.quienSolicita,
            p.exequiales?.salaServicio,
            p.salaServicio,
            p.logistica.direccion,
            ...p.items.map((it) => it.descripcion),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return texto.includes(q);
        })
      : pedidosFiltrados;

    const agrupados = new Map<string, PedidoTiendaRegistrado[]>();
    for (const p of filtradosTexto) {
      const clave = String(p.estado || "ORDEN_CONFIRMADA").toUpperCase();
      const lista = agrupados.get(clave);
      if (lista) lista.push(p);
      else agrupados.set(clave, [p]);
    }

    const columnas: Array<{
      valor: string;
      etiqueta: string;
      colorFondo: string;
      colorTexto: string;
      items: PedidoTiendaRegistrado[];
    }> = [];

    for (const def of estadosConfig) {
      const itemsCol = agrupados.get(def.valor);
      if (itemsCol && itemsCol.length > 0) {
        columnas.push({ ...def, items: itemsCol });
        agrupados.delete(def.valor);
      }
    }

    // Cualquier estado adicional no listado en estadosConfig que tenga pedidos
    for (const [valor, itemsCol] of agrupados.entries()) {
      if (itemsCol.length > 0) {
        const est = estiloEstado(valor, estadosConfig);
        columnas.push({ ...est, items: itemsCol });
      }
    }

    return columnas;
  }, [pedidosFiltrados, busquedaKanban, pedidoEnfocado, estadosConfig]);

  const handleConfirmarEliminacion = useCallback(
    async (definitivo: boolean) => {
      if (!pedidoAEliminar) return;
      if (definitivo && !esAdminEstricto) {
        setErrorMsg("Solo el administrador puede eliminar pedidos de forma definitiva.");
        return;
      }
      setProcesandoEliminacion(true);
      setErrorMsg(null);
      const res = await eliminarPedidoOperativoAction({
        negocio,
        ordenTallerId: pedidoAEliminar.ordenTallerId ?? null,
        proformaId:
          pedidoAEliminar.id && pedidoAEliminar.id !== pedidoAEliminar.ordenTallerId
            ? pedidoAEliminar.id
            : null,
        entregaId: pedidoAEliminar.entregaId ?? pedidoAEliminar.evidenciaEntrega?.entregaId ?? null,
        motivo: motivoEliminacion,
        definitivo,
      });
      setProcesandoEliminacion(false);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPedidoAEliminar(null);
      setMotivoEliminacion("");
      await cargarPedidos();
    },
    [pedidoAEliminar, esAdminEstricto, negocio, motivoEliminacion, cargarPedidos]
  );

  const handleRestaurarPedido = useCallback(
    async (p: PedidoTiendaRegistrado) => {
      if (!esAdminEstricto) return;
      setActualizandoId(p.id);
      setErrorMsg(null);
      const res = await restaurarPedidoEliminadoAction({
        negocio,
        ordenTallerId: p.ordenTallerId ?? null,
        proformaId: p.id && p.id !== p.ordenTallerId ? p.id : null,
        entregaId: p.entregaId ?? p.evidenciaEntrega?.entregaId ?? null,
      });
      setActualizandoId(null);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      await cargarPedidos();
    },
    [esAdminEstricto, negocio, cargarPedidos]
  );

  const idsExpandidosIniciales = useMemo(() => {
    if (!pedidoEnfocado) return undefined;
    const upper = pedidoEnfocado.toUpperCase();
    const encontrados = pedidosFiltrados
      .filter((p) => p.codigoOrden.toUpperCase().includes(upper) || p.id === pedidoEnfocado)
      .map((p) => p.id);
    return encontrados.length > 0 ? encontrados : undefined;
  }, [pedidoEnfocado, pedidosFiltrados]);

  const abrirModalEvidencia = useCallback((p: PedidoTiendaRegistrado) => {
    const clasif = resolverClasificacionPedidoTienda(p);
    const resumenProd =
      p.items.map((it) => `${it.cantidad}x ${it.descripcion}`).join(" + ") || "Pedido floral";
    setVisorEvidencia({
      codigo: p.codigoOrden,
      clasificacion: clasif,
      productoResumen: resumenProd,
      quienSolicita: p.exequiales?.quienSolicita || p.compradorNombre,
      destinatarioFallecido:
        p.exequiales?.nombreFallecido || p.logistica.destinatarioNombre || null,
      salaServicio:
        p.exequiales?.salaServicio || p.evidenciaEntrega?.salaServicio || p.salaServicio || null,
      fechaEntrega: p.logistica.fechaEntrega,
      horaEntrega: p.logistica.horaExacta || p.logistica.franjaHoraria,
      direccionEntrega: p.logistica.retiroEnLocal
        ? "Retiro en Tienda"
        : p.evidenciaEntrega?.direccionGps || p.logistica.direccion || null,
      entregadoEn: p.evidenciaEntrega?.capturadoEn || null,
      entregadorNombre: p.evidenciaEntrega?.entregadorNombre || null,
      fotoUrl: p.evidenciaEntrega?.fotoUrl || null,
      mapaUrl: p.evidenciaEntrega?.mapaUrl || null,
      latitud: p.evidenciaEntrega?.latitud ?? p.logistica.lat ?? null,
      longitud: p.evidenciaEntrega?.longitud ?? p.logistica.lng ?? null,
      numeroInforme:
        p.evidenciaEntrega?.numeroInforme || p.exequiales?.numeroInforme || null,
    });
  }, []);

  const columnas = useMemo<ColumnaDataGrid<PedidoTiendaRegistrado>[]>(
    () => [
      {
        id: "orden",
        encabezado: "Orden y Producto",
        valor: (p) =>
          `${p.codigoOrden} ${p.items.map((it) => it.descripcion).join(" ")} ${p.tipoOrigen || ""}`,
        render: (p) => {
          const resumenProd =
            p.items.map((it) => `${it.cantidad}× ${it.descripcion}`).join(" + ") ||
            "Arreglo floral";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxWidth: "300px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <strong style={{ color: "#1F1C19", fontSize: "0.84rem" }}>{p.codigoOrden}</strong>
                <span style={{ fontSize: "0.7rem", color: "#847D74" }}>
                  {new Date(p.creadoEn).toLocaleString("es-EC", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#221E1B" }}>
                {resumenProd}
              </span>
            </div>
          );
        },
      },
      {
        id: "clasificacion",
        encabezado: "Clasificación",
        valor: (p) =>
          obtenerDefinicionClasificacionPedido(resolverClasificacionPedidoTienda(p)).etiqueta,
        render: (p) => {
          const clasif = resolverClasificacionPedidoTienda(p);
          const def = obtenerDefinicionClasificacionPedido(clasif);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <InsigniaClasificacionPedido
                clasificacion={clasif}
                compacto
                sufijoTexto={
                  clasif === "EXEQUIALES" && (p.exequiales?.salaServicio || p.salaServicio)
                    ? p.exequiales?.salaServicio || p.salaServicio
                    : null
                }
              />
              <SelectConBuscador
                value={clasif}
                disabled={actualizandoId === p.id}
                onChange={(e) =>
                  void cambiarClasificacion(p.id, e.target.value as ClasificacionOperativaPedido)
                }
                aria-label={`Clasificación de ${p.codigoOrden}`}
                title="Cambiar clasificación operativa del pedido"
                style={{
                  padding: "3px 7px",
                  borderRadius: "6px",
                  border: `1px solid ${def.bordeHex}`,
                  background: "#FFFFFF",
                  color: "#57524C",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  maxWidth: "145px",
                }}
              >
                {CLASIFICACIONES_OPERATIVAS_PEDIDO.map((op) => (
                  <option key={op.clave} value={op.clave}>
                    {op.etiqueta}
                  </option>
                ))}
              </SelectConBuscador>
            </div>
          );
        },
      },
      {
        id: "cliente",
        encabezado: "Solicita / Destinatario o Fallecido",
        valor: (p) =>
          `${p.compradorNombre} ${p.logistica.destinatarioNombre} ${
            p.exequiales?.nombreFallecido || ""
          } ${p.exequiales?.salaServicio || p.salaServicio || ""} ${p.compradorTelefono}`,
        render: (p) => {
          const clasif = resolverClasificacionPedidoTienda(p);
          const esExeq = clasif === "EXEQUIALES";
          const esCondol = clasif === "CONDOLENCIAS";
          const sala = p.exequiales?.salaServicio || p.salaServicio;
          const fallecido = p.exequiales?.nombreFallecido || p.logistica.destinatarioNombre;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "260px" }}>
              <strong style={{ fontSize: "0.81rem", color: "#1F1C19" }}>
                {esExeq ? `Solicita: ${p.compradorNombre}` : p.compradorNombre}
              </strong>
              {esExeq ? (
                <>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3A3530" }}>
                    Fallecido: {fallecido || "Pendiente registrar"}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#57524C", fontWeight: 600 }}>
                    Sala: {sala || "Por confirmar"}
                  </span>
                </>
              ) : (
                <>
                  {p.logistica.destinatarioNombre &&
                    p.logistica.destinatarioNombre !== p.compradorNombre && (
                      <span style={{ fontSize: "0.74rem", color: "#57524C", fontWeight: 600 }}>
                        {esCondol ? "Destinatario / Difunto" : "Recibe"}:{" "}
                        {p.logistica.destinatarioNombre}
                      </span>
                    )}
                  <span style={{ fontSize: "0.72rem", color: "#847D74" }}>
                    {p.compradorTelefono || p.compradorCorreo || "—"}
                  </span>
                </>
              )}
            </div>
          );
        },
      },
      {
        id: "entrega",
        encabezado: "Fecha y Hora de Entrega",
        valor: (p) =>
          `${p.logistica.fechaEntrega} ${p.logistica.horaExacta || p.logistica.franjaHoraria} ${
            p.logistica.retiroEnLocal
              ? "Retiro en Tienda"
              : p.logistica.direccion || p.logistica.zonaDetectada || ""
          }`,
        render: (p) => {
          const clasif = resolverClasificacionPedidoTienda(p);
          const esExeq = clasif === "EXEQUIALES";
          const sala = p.exequiales?.salaServicio || p.salaServicio;
          const horarioTexto = formatearHorarioEntregaOrden({
            franjaHoraria: p.logistica.franjaHoraria,
            horaEspecifica: p.logistica.horaExacta || p.exequiales?.horaServicio || null,
            esExequiales: esExeq,
          });
          const tieneEvid = Boolean(p.evidenciaEntrega?.confirmada || p.evidenciaEntrega?.fotoUrl);
          const fotoUrl = p.evidenciaEntrega?.fotoUrl;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxWidth: "285px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.77rem",
                  fontWeight: 700,
                  color: "#1F1C19",
                }}
              >
                <Clock size={12} color="#2F4737" />
                <span>
                  {p.logistica.fechaEntrega || "Sin fecha"}
                  {horarioTexto ? ` · ${horarioTexto}` : ""}
                </span>
              </span>

              <span style={{ fontSize: "0.74rem", color: "#57524C", lineHeight: 1.35 }}>
                {esExeq
                  ? sala
                    ? `Sala Exequiales: ${sala}`
                    : "Servicio Exequiales"
                  : p.logistica.retiroEnLocal
                    ? "Retiro en Tienda"
                    : p.logistica.direccion || p.logistica.zonaDetectada || "Por coordinar dirección"}
              </span>

              {tieneEvid && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                  <button
                    type="button"
                    onClick={() => abrirModalEvidencia(p)}
                    title="Abrir fotografía y comprobante permanente de confirmación de entrega"
                    aria-label="Ver Foto"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid #CEDDD3",
                      background: "#F2F6F3",
                      color: "#2B4A36",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {fotoUrl ? <Camera size={11} /> : <CheckCircle2 size={11} />}
                    <span>{fotoUrl ? "Ver Foto" : "Confirmada"}</span>
                  </button>

                  {(p.evidenciaEntrega?.numeroInforme || p.exequiales?.numeroInforme) && (
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "6px",
                        background: "#F4F2EE",
                        border: "1px solid #DDD8CE",
                        color: "#3A3530",
                        fontSize: "0.67rem",
                        fontWeight: 700,
                      }}
                    >
                      {p.evidenciaEntrega?.numeroInforme || p.exequiales?.numeroInforme}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "total",
        encabezado: "Total / Convenio",
        valor: (p) => p.total,
        render: (p) => {
          const esConvenio = p.metodoPago.toLowerCase().includes("convenio");
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong style={{ fontSize: "0.85rem", color: "#1F1C19" }}>
                {esConvenio && p.total === 0 ? "Convenio IESS" : `$${p.total.toFixed(2)}`}
              </strong>
              {typeof p.montoAbonadoUsd === "number" && p.montoAbonadoUsd > 0 && (
                <span style={{ fontSize: "0.7rem", color: "#221E1B", fontWeight: 700 }}>
                  Abono: ${p.montoAbonadoUsd.toFixed(2)} · Saldo: $
                  {Math.max(0, p.saldoPendienteUsd ?? p.total - p.montoAbonadoUsd).toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: "0.69rem", color: "#847D74", textTransform: "uppercase" }}>
                {p.metodoPago}
              </span>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {p.comprobanteTransferencia?.url && (
                  <span
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      color: "#2B4A36",
                      background: "#F2F6F3",
                      border: "1px solid #CEDDD3",
                      borderRadius: "6px",
                      padding: "1px 6px",
                    }}
                  >
                    Recibo
                  </span>
                )}
                {p.respuestaPlux && (
                  <span
                    title={`Autorización PLUX: ${p.respuestaPlux.autorizacion || p.respuestaPlux.identificador || "Aprobado"}`}
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      color: "#1E40AF",
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: "6px",
                      padding: "1px 6px",
                    }}
                  >
                    PLUX ✓
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "estado",
        encabezado: "Estado y Acciones",
        valor: (p) => estiloEstado(p.estado, estadosConfig).etiqueta,
        render: (p) => {
          if (p.eliminadoEn) {
            if (!esAdminEstricto) return null;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: "7px",
                    background: "#FAF2F2",
                    border: "1px solid #E5CACA",
                    color: "#8A2E2E",
                    fontSize: "0.7rem",
                  }}
                >
                  <div>
                    <strong>🗑️ Eliminado por:</strong> {p.eliminadoPorNombre || "Staff"}
                  </div>
                  <div>{new Date(p.eliminadoEn).toLocaleString("es-EC")}</div>
                  {p.eliminadoMotivo ? (
                    <div style={{ fontStyle: "italic" }}>Motivo: {p.eliminadoMotivo}</div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={actualizandoId === p.id}
                    onClick={() => void handleRestaurarPedido(p)}
                    title="Restaurar este pedido a la bandeja activa"
                    aria-label="Restaurar Pedido"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #2F4737",
                      background: "#F2F6F3",
                      color: "#2B4A36",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>Restaurar</span>
                  </button>
                  <button
                    type="button"
                    disabled={actualizandoId === p.id}
                    onClick={() => {
                      setMotivoEliminacion("");
                      setPedidoAEliminar(p);
                    }}
                    title="Eliminar definitivamente de la base de datos"
                    aria-label="Eliminar Definitivo"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#8A2E2E",
                      color: "#FFFFFF",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={11} />
                    <span>Eliminar Definitivo</span>
                  </button>
                </div>
              </div>
            );
          }

          const est = estiloEstado(p.estado, estadosConfig);
          const esExeq = resolverClasificacionPedidoTienda(p) === "EXEQUIALES";
          const impresiones = Number(p.tarjeta?.metadata?.impresiones ?? 0);
          const editadaCliente = Boolean(p.tarjeta?.metadata?.editado_por_cliente);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-start" }}>
              <SelectConBuscador
                value={p.estado}
                disabled={actualizandoId === p.id}
                onChange={(e) => void cambiarEstado(p.id, e.target.value)}
                aria-label={`Estado de ${p.codigoOrden}`}
                style={{
                  padding: "4px 8px",
                  borderRadius: "999px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: est.colorFondo,
                  color: est.colorTexto,
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {estadosConfig.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.etiqueta}
                  </option>
                ))}
              </SelectConBuscador>

              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => abrirEdicionDatosPedido(p)}
                  title="Editar tipo de pedido, destinatario, horario y detalles"
                  aria-label="Editar Pedido"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#57524C",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Edit3 size={11} />
                  <span>Editar</span>
                </button>

                {!esExeq && (
                  <button
                    type="button"
                    onClick={() => setPedidoParaTarjeta(p)}
                    title={
                      editadaCliente
                        ? "⚠️ El cliente modificó esta tarjeta — revisa el diseño final antes de imprimir"
                        : "Ver, editar, descargar PDF o imprimir la tarjeta dedicatoria vinculada a este pedido"
                    }
                    aria-label="Tarjeta Dedicatoria"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border:
                        impresiones > 0
                          ? "1px solid #8F6A2E"
                          : editadaCliente
                            ? "1.5px solid #8F6A2E"
                            : "1px solid #221E1B",
                      background:
                        impresiones > 0 ? "#FAF6EE" : editadaCliente ? "#FAF6EE" : "#F4F2EE",
                      color:
                        impresiones > 0 ? "#745622" : editadaCliente ? "#745622" : "#3A3530",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Printer size={11} />
                    <span>
                      {impresiones > 0
                        ? `Tarjeta (x${impresiones})`
                        : editadaCliente
                          ? "Tarjeta · Cliente"
                          : "Tarjeta"}
                    </span>
                  </button>
                )}

                {puedeEliminarLogico && (
                  <button
                    type="button"
                    onClick={() => {
                      setMotivoEliminacion("");
                      setPedidoAEliminar(p);
                    }}
                    title={
                      esAdminEstricto
                        ? "Enviar a Papelera o eliminar definitivamente"
                        : "Eliminar pedido (se enviará a Papelera)"
                    }
                    aria-label="Eliminar Pedido"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #E5CACA",
                      background: "#FAF2F2",
                      color: "#8A2E2E",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={11} />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>
            </div>
          );
        },
      },
    ],
    [
      actualizandoId,
      cambiarEstado,
      cambiarClasificacion,
      abrirModalEvidencia,
      abrirEdicionDatosPedido,
      esAdminEstricto,
      puedeEliminarLogico,
      handleRestaurarPedido,
      estadosConfig,
    ]
  );

  const etiquetaFechaActiva =
    TABS_FECHA_PEDIDOS.find((t) => t.clave === filtroFecha)?.etiqueta ?? "Hoy";
  const etiquetaClasificacionActiva =
    filtroClasificacion === "TODOS"
      ? "Todos"
      : obtenerDefinicionClasificacionPedido(filtroClasificacion).etiqueta;
  const cantidadFiltrosNoDefecto =
    (filtroFecha !== "HOY" ? 1 : 0) +
    (filtroClasificacion !== "TODOS" ? 1 : 0) +
    (verPapelera ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <style>{`
        .eco-pedidos-barra-unica {
          background: #FFFFFF;
          border: 1px solid #E6E2DA;
          border-radius: 12px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          position: relative;
        }
        .eco-pedidos-resumen-chips {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .eco-pedidos-opciones-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: min(440px, calc(100vw - 24px));
          background: #FFFFFF;
          border: 1px solid #D5CFC4;
          border-radius: 14px;
          box-shadow: 0 20px 44px rgba(24, 21, 18, 0.16);
          padding: 14px;
          z-index: 60;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-sizing: border-box;
        }
        .eco-pedidos-opciones-backdrop-movil {
          display: none;
        }
        @media (max-width: 639px) {
          .eco-solo-escritorio-pedidos {
            display: none !important;
          }
          .eco-pedidos-barra-unica {
            padding: 8px 10px;
            gap: 7px;
          }
          .eco-pedidos-buscador-wrap {
            flex: 1 1 0 !important;
            min-width: 140px !important;
            order: 1;
          }
          .eco-pedidos-btn-opciones {
            order: 2;
            margin-left: 0 !important;
          }
          .eco-pedidos-resumen-chips {
            order: 3;
            flex-basis: 100%;
          }
          .eco-pedidos-opciones-backdrop-movil {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(24, 21, 18, 0.45);
            backdrop-filter: blur(2px);
            z-index: 9998;
          }
          .eco-pedidos-opciones-popover {
            position: fixed;
            top: auto;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            max-height: 86dvh;
            overflow-y: auto;
            border-radius: 16px 16px 0 0;
            border-bottom: none;
            padding: 14px 14px calc(16px + env(safe-area-inset-bottom, 0px));
            z-index: 9999;
          }
        }
      `}</style>

      {/* BARRA ÚNICA COMPACTA: BUSCADOR / RESUMEN ACTIVO + BOTÓN "OPCIONES" */}
      <div className="eco-pedidos-barra-unica" ref={opcionesContenedorRef}>
        {modoVista === "kanban" && (
          <div className="eco-pedidos-buscador-wrap" style={{ position: "relative", flex: "1 1 190px", minWidth: 0 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#847D74",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              value={busquedaKanban}
              onChange={(e) => setBusquedaKanban(e.target.value)}
              placeholder="Buscar pedido, cliente o producto..."
              aria-label="Buscar pedidos en tablero Kanban"
              style={{
                width: "100%",
                padding: "7px 10px 7px 30px",
                borderRadius: "9px",
                border: "1px solid #D5CFC4",
                background: "#F8F7F4",
                fontSize: "0.82rem",
                color: "#1F1C19",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Resumen discreto de filtros activos (clic abre Opciones) */}
        <div
          className="eco-pedidos-resumen-chips"
          style={{ marginRight: modoVista === "tabla" ? "auto" : undefined }}
        >
          <button
            type="button"
            onClick={() => setOpcionesAbiertas((prev) => !prev)}
            title="Filtros activos — abrir Opciones"
            aria-label={`Filtros activos: ${etiquetaFechaActiva}, ${etiquetaClasificacionActiva}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              borderRadius: "999px",
              border: "1px solid #E6E2DA",
              background: "#F8F7F4",
              color: "#57524C",
              fontSize: "0.74rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Calendar size={12} color="#2F4737" />
            <span>{etiquetaFechaActiva}</span>
            {filtroClasificacion !== "TODOS" && (
              <>
                <span style={{ color: "#C5BEB4" }}>·</span>
                <span style={{ color: "#1F1C19" }}>{etiquetaClasificacionActiva}</span>
              </>
            )}
            <span
              style={{
                minWidth: "18px",
                height: "16px",
                padding: "0 5px",
                borderRadius: "999px",
                background: "#E6E2DA",
                color: "#1F1C19",
                fontSize: "0.68rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pedidosFiltrados.length}
            </span>
          </button>

          {verPapelera && (
            <button
              type="button"
              onClick={() => setVerPapelera(false)}
              title="Salir de la Papelera y volver a pedidos activos"
              aria-label="Salir de Papelera"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 9px",
                borderRadius: "999px",
                border: "1px solid #E5CACA",
                background: "#FAF2F2",
                color: "#8A2E2E",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Trash2 size={11} />
              <span>Papelera</span>
              <X size={11} />
            </button>
          )}
        </div>

        {/* BOTÓN NUEVO PEDIDO CON ARIA + OPCIONES */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: modoVista === "kanban" ? "auto" : undefined }}>
          <button
            type="button"
            onClick={() => setMostrarWizardAria(true)}
            title="Pegar mensaje de Telegram o texto corto para crear pedido con ARIA"
            aria-label="Nuevo Pedido ARIA"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "7px 12px",
              minHeight: "34px",
              borderRadius: "9px",
              border: "none",
              background: "linear-gradient(135deg, #1F1C19 0%, #4338CA 100%)",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <Sparkles size={13} />
            <span>Nuevo Pedido</span>
          </button>

          {esAdminEstricto && (
            <button
              type="button"
              onClick={() => setMostrarAdminEstados(true)}
              title="Administrar estados de pedidos y visibilidad en Taller"
              aria-label="Estados"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "7px 12px",
                minHeight: "34px",
                borderRadius: "9px",
                border: "1px solid #D5CFC4",
                background: "#FAF8F5",
                color: "#1F1C19",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <SlidersHorizontal size={13} />
              <span>Estados</span>
            </button>
          )}

          <button
            type="button"
            className="eco-pedidos-btn-opciones"
            onClick={() => setOpcionesAbiertas((prev) => !prev)}
            aria-expanded={opcionesAbiertas}
            aria-haspopup="dialog"
            title="Abrir filtros, visualización y acciones"
            aria-label="Opciones"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "7px 12px",
              minHeight: "34px",
              borderRadius: "9px",
              border: opcionesAbiertas ? "1px solid #1F1C19" : "1px solid #D5CFC4",
              background: opcionesAbiertas ? "#1F1C19" : "#FFFFFF",
              color: opcionesAbiertas ? "#FFFFFF" : "#1F1C19",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
          <SlidersHorizontal size={14} />
          <span>Opciones</span>
          {cantidadFiltrosNoDefecto > 0 && (
            <span
              style={{
                minWidth: "17px",
                height: "17px",
                padding: "0 5px",
                borderRadius: "999px",
                background: opcionesAbiertas ? "rgba(255,255,255,0.22)" : "#2F4737",
                color: "#FFFFFF",
                fontSize: "0.67rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cantidadFiltrosNoDefecto}
            </span>
          )}
        </button>
        </div>

        {/* PANEL DESPLEGABLE / HOJA INFERIOR DE OPCIONES */}
        {opcionesAbiertas && (
          <>
            <div
              className="eco-pedidos-opciones-backdrop-movil"
              onClick={() => setOpcionesAbiertas(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-label="Opciones de pedidos"
              className="eco-pedidos-opciones-popover"
            >
              {/* Encabezado del panel */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #E6E2DA",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <SlidersHorizontal size={15} color="#2F4737" />
                  <strong style={{ fontSize: "0.9rem", color: "#1F1C19" }}>Opciones</strong>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {(cantidadFiltrosNoDefecto > 0 || busquedaKanban.trim() !== "") && (
                    <button
                      type="button"
                      onClick={restablecerOpciones}
                      title="Volver a Hoy, Todos y pedidos activos"
                      aria-label="Restablecer filtros"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#2F4737",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "4px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <RotateCcw size={12} />
                      <span>Restablecer</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpcionesAbiertas(false)}
                    title="Cerrar opciones"
                    aria-label="Cerrar opciones"
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      border: "1px solid #E6E2DA",
                      background: "#F8F7F4",
                      color: "#57524C",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* 1. FILTROS: FECHA Y TIPO */}
              <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.71rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#847D74",
                      marginBottom: "6px",
                    }}
                  >
                    Filtro de fecha
                  </span>
                  <div
                    role="tablist"
                    aria-label="Filtrar pedidos por fecha"
                    style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                  >
                    {TABS_FECHA_PEDIDOS.map((tab) => {
                      const activo = filtroFecha === tab.clave;
                      const conteo = conteosFecha[tab.clave] ?? 0;
                      return (
                        <button
                          key={tab.clave}
                          type="button"
                          role="tab"
                          aria-selected={activo}
                          onClick={() => cambiarFiltroFecha(tab.clave)}
                          title={tab.descripcion}
                          aria-label={`${tab.etiqueta} (${conteo})`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "999px",
                            border: activo ? "1px solid #1F1C19" : "1px solid #E6E2DA",
                            background: activo ? "#1F1C19" : "#F8F7F4",
                            color: activo ? "#FFFFFF" : "#57524C",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <span>{tab.etiqueta}</span>
                          <span
                            style={{
                              minWidth: "18px",
                              height: "17px",
                              padding: "0 5px",
                              borderRadius: "999px",
                              background: activo ? "rgba(255,255,255,0.2)" : "#E6E2DA",
                              color: activo ? "#FFFFFF" : "#57524C",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {conteo}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.71rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#847D74",
                      marginBottom: "6px",
                    }}
                  >
                    Tipo de pedido
                  </span>
                  <BarraFiltroClasificacionPedido
                    seleccionada={filtroClasificacion}
                    onSeleccionar={setFiltroClasificacion}
                    conteos={conteosClasificacion}
                    totalGeneral={pedidosPorFecha.length}
                    ocultarSinPedidos
                  />
                </div>
              </div>

              {/* 2. VISUALIZACIÓN (Kanban por defecto / Tabla) */}
              <div style={{ paddingTop: "10px", borderTop: "1px dashed #E6E2DA" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.71rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#847D74",
                    marginBottom: "6px",
                  }}
                >
                  Visualización
                </span>
                <div
                  role="group"
                  aria-label="Modo de visualización"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    padding: "3px",
                    borderRadius: "10px",
                    background: "#F4F2EE",
                    border: "1px solid #E6E2DA",
                    gap: "4px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => cambiarModoVista("kanban")}
                    title="Tablero Kanban por estado (por defecto)"
                    aria-label="Modo Kanban"
                    aria-pressed={modoVista === "kanban"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: modoVista === "kanban" ? "#1F1C19" : "transparent",
                      color: modoVista === "kanban" ? "#FFFFFF" : "#57524C",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Columns3 size={14} />
                    <span>Kanban</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarModoVista("tabla")}
                    title="Vista de tabla detallada con exportación Excel/CSV"
                    aria-label="Modo Tabla"
                    aria-pressed={modoVista === "tabla"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: modoVista === "tabla" ? "#1F1C19" : "transparent",
                      color: modoVista === "tabla" ? "#FFFFFF" : "#57524C",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Table2 size={14} />
                    <span>Tabla</span>
                  </button>
                </div>
              </div>

              {/* 3. ACCIONES EXTRA (Actualizar, Papelera) */}
              <div
                style={{
                  paddingTop: "10px",
                  borderTop: "1px dashed #E6E2DA",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => void cargarPedidos()}
                  disabled={cargando}
                  title="Recargar pedidos desde el servidor"
                  aria-label="Actualizar pedidos"
                  style={{
                    flex: "1 1 130px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "9px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#1F1C19",
                    fontSize: "0.77rem",
                    fontWeight: 700,
                    cursor: cargando ? "wait" : "pointer",
                  }}
                >
                  {cargando ? <Loader2 size={14} className="eco-spin" /> : <RefreshCw size={14} />}
                  <span>{cargando ? "Actualizando..." : "Actualizar"}</span>
                </button>

                {esAdminEstricto && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpcionesAbiertas(false);
                      setMostrarAdminEstados(true);
                    }}
                    title="Crear, renombrar u ordenar estados de pedidos (solo Administrador)"
                    aria-label="Administrar Estados"
                    style={{
                      flex: "1 1 130px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      borderRadius: "9px",
                      border: "1px solid #D5CFC4",
                      background: "#F8F7F4",
                      color: "#1F1C19",
                      fontSize: "0.77rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <SlidersHorizontal size={13} />
                    <span>Estados</span>
                  </button>
                )}

                {esAdminEstricto && (
                  <button
                    type="button"
                    onClick={() => setVerPapelera((prev) => !prev)}
                    title="Ver pedidos eliminados lógicamente (solo Administrador)"
                    aria-label="Papelera de pedidos"
                    style={{
                      flex: "1 1 140px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      borderRadius: "9px",
                      border: verPapelera ? "1px solid #8A2E2E" : "1px solid #E5CACA",
                      background: verPapelera ? "#8A2E2E" : "#FAF2F2",
                      color: verPapelera ? "#FFFFFF" : "#8A2E2E",
                      fontSize: "0.77rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                    <span>
                      {verPapelera
                        ? `Salir Papelera (${pedidosEliminados.length})`
                        : `Papelera (${pedidosEliminados.length})`}
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpcionesAbiertas(false)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#221E1B",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ver {pedidosFiltrados.length}{" "}
                {pedidosFiltrados.length === 1 ? "pedido" : "pedidos"}
              </button>
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#FAF2F2",
            border: "1px solid #E5CACA",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#8A2E2E",
          }}
        >
          {errorMsg}
        </div>
      )}

      {pedidoEnfocado && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#F4F2EE",
            border: "1px solid #DDD8CE",
            color: "#3A3530",
            fontSize: "0.82rem",
          }}
        >
          <span>
            Mostrando acceso directo al pedido seleccionado: <strong>{pedidoEnfocado}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setPedidoEnfocado("");
              if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                params.delete("pedido");
                params.delete("codigo");
                const qs = params.toString();
                window.history.replaceState(
                  null,
                  "",
                  `${window.location.pathname}${qs ? `?${qs}` : ""}`
                );
              }
            }}
            title="Mostrar todos los pedidos de la tienda"
            aria-label="Ver todos"
            style={{
              padding: "5px 11px",
              borderRadius: "8px",
              border: "1px solid #DDD8CE",
              background: "#FFFFFF",
              color: "#221E1B",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ver todos
          </button>
        </div>
      )}

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "12px",
          padding: "clamp(10px, 2.5vw, 16px)",
          minWidth: 0,
        }}
      >
        {modoVista === "kanban" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              className="eco-solo-escritorio-pedidos"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "0.74rem", color: "#847D74", fontWeight: 600 }}>
                {columnasKanbanDisponibles.length}{" "}
                {columnasKanbanDisponibles.length === 1 ? "estado activo" : "estados activos"} ·{" "}
                {!verPapelera
                  ? "Arrastra una tarjeta o cambia su estado desde el selector"
                  : "Vista de Papelera (solo Administrador)"}
              </span>
            </div>

            {columnasKanbanDisponibles.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "#847D74",
                  fontSize: "0.85rem",
                  background: "#F8F7F4",
                  borderRadius: "10px",
                  border: "1px dashed #D5CFC4",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>
                  No hay pedidos en <strong>{etiquetaFechaActiva}</strong>
                  {filtroClasificacion !== "TODOS" ? ` (${etiquetaClasificacionActiva})` : ""}.
                </span>
                <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  {filtroFecha !== "TODOS" && (
                    <button
                      type="button"
                      onClick={() => cambiarFiltroFecha("TODOS")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #221E1B",
                        background: "#221E1B",
                        color: "#FFFFFF",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Ver todos ({conteosFecha.TODOS ?? 0})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpcionesAbiertas(true)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      color: "#1F1C19",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Abrir Opciones
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  overflowX: "auto",
                  alignItems: "flex-start",
                  paddingBottom: "8px",
                }}
              >
                {columnasKanbanDisponibles.map((col) => {
                  const esDropHover = !verPapelera && estadoHoverKanban === col.valor;
                  return (
                    <div
                      key={col.valor}
                      onDragOver={(e) => {
                        if (verPapelera) return;
                        e.preventDefault();
                        if (estadoHoverKanban !== col.valor) {
                          setEstadoHoverKanban(col.valor);
                        }
                      }}
                      onDragLeave={() => {
                        if (estadoHoverKanban === col.valor) {
                          setEstadoHoverKanban(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (verPapelera) return;
                        e.preventDefault();
                        const idArrastrado =
                          e.dataTransfer.getData("text/plain") || arrastrandoPedidoId;
                        setEstadoHoverKanban(null);
                        setArrastrandoPedidoId(null);
                        if (!idArrastrado) return;
                        const ped = pedidosFiltrados.find((x) => x.id === idArrastrado);
                        if (ped && ped.estado !== col.valor) {
                          void cambiarEstado(ped.id, col.valor);
                        }
                      }}
                      style={{
                        flex: "1 0 295px",
                        minWidth: "295px",
                        maxWidth: "360px",
                        background: esDropHover ? "#F4F2EE" : "#F8F7F4",
                        border: esDropHover ? "2px dashed #4A453F" : "1px solid #E6E2DA",
                        borderRadius: "12px",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        transition: "background 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          background: col.colorFondo,
                          color: col.colorTexto,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "999px",
                              background: col.colorTexto,
                              display: "inline-block",
                            }}
                          />
                          <strong style={{ fontSize: "0.8rem" }}>{col.etiqueta}</strong>
                        </div>
                        <span
                          style={{
                            padding: "1px 8px",
                            borderRadius: "999px",
                            background: "rgba(255,255,255,0.75)",
                            color: col.colorTexto,
                            fontSize: "0.72rem",
                            fontWeight: 800,
                          }}
                        >
                          {col.items.length}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                        {col.items.map((p) => {
                          const clasif = resolverClasificacionPedidoTienda(p);
                          const esExeq = clasif === "EXEQUIALES";
                          const sala = p.exequiales?.salaServicio || p.salaServicio;
                          const fallecido =
                            p.exequiales?.nombreFallecido || p.logistica.destinatarioNombre || "";
                          const solicita = p.exequiales?.quienSolicita || p.compradorNombre;
                          const horaMostrar =
                            p.logistica.horaExacta ||
                            p.exequiales?.horaServicio ||
                            p.logistica.franjaHoraria ||
                            "Por coordinar";
                          const fotoEvidencia = p.evidenciaEntrega?.fotoUrl;
                          const impresiones = Number(p.tarjeta?.metadata?.impresiones ?? 0);

                          return (
                            <div
                              key={p.id}
                              draggable={!verPapelera}
                              onDragStart={(e) => {
                                if (verPapelera) return;
                                setArrastrandoPedidoId(p.id);
                                e.dataTransfer.setData("text/plain", p.id);
                              }}
                              onDragEnd={() => {
                                setArrastrandoPedidoId(null);
                                setEstadoHoverKanban(null);
                              }}
                              style={{
                                background: "#FFFFFF",
                                border:
                                  arrastrandoPedidoId === p.id
                                    ? "1.5px solid #4A453F"
                                    : "1px solid #E6E2DA",
                                borderRadius: "10px",
                                padding: "11px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "7px",
                                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                                cursor: verPapelera ? "default" : "grab",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <strong style={{ fontSize: "0.82rem", color: "#1F1C19" }}>
                                  {p.codigoOrden}
                                </strong>
                                <InsigniaClasificacionPedido
                                  clasificacion={clasif}
                                  sufijoTexto={sala}
                                  compacto
                                />
                              </div>

                              <div style={{ fontSize: "0.78rem", color: "#221E1B", fontWeight: 600 }}>
                                {p.items.map((it) => `${it.cantidad}× ${it.descripcion}`).join(" + ") ||
                                  "Arreglo floral"}
                              </div>

                              <div style={{ fontSize: "0.74rem", color: "#57524C", lineHeight: 1.35 }}>
                                <div>
                                  <strong>Solicita:</strong> {solicita}
                                </div>
                                {esExeq && fallecido ? (
                                  <div style={{ color: "#3A3530" }}>
                                    <strong>Fallecido:</strong> {fallecido}
                                  </div>
                                ) : fallecido && fallecido !== solicita ? (
                                  <div>
                                    <strong>Para:</strong> {fallecido}
                                  </div>
                                ) : null}
                                {sala ? (
                                  <div style={{ color: "#3A3530", fontWeight: 600 }}>
                                    Sala: {sala}
                                  </div>
                                ) : p.logistica.direccion ? (
                                  <div style={{ color: "#847D74" }}>
                                    📍 {p.logistica.direccion}
                                  </div>
                                ) : null}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "0.72rem",
                                  color: "#2F4737",
                                  background: "#F2F6F3",
                                  padding: "4px 7px",
                                  borderRadius: "6px",
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>
                                  🕒 {p.logistica.fechaEntrega || "Hoy"} · {horaMostrar}
                                </span>
                                <strong style={{ color: "#1F1C19" }}>
                                  {esExeq ? "IESS" : `$${p.total.toFixed(2)}`}
                                </strong>
                              </div>

                              {p.eliminadoEn && esAdminEstricto ? (
                                <div
                                  style={{
                                    padding: "5px 7px",
                                    borderRadius: "6px",
                                    background: "#FAF2F2",
                                    border: "1px solid #E5CACA",
                                    color: "#8A2E2E",
                                    fontSize: "0.7rem",
                                  }}
                                >
                                  <div>
                                    <strong>🗑️ Eliminado por:</strong>{" "}
                                    {p.eliminadoPorNombre || "Staff"}
                                  </div>
                                  {p.eliminadoMotivo ? (
                                    <div style={{ fontStyle: "italic" }}>
                                      Motivo: {p.eliminadoMotivo}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <SelectConBuscador
                                  value={p.estado}
                                  disabled={actualizandoId === p.id}
                                  onChange={(e) => void cambiarEstado(p.id, e.target.value)}
                                  aria-label={`Estado de ${p.codigoOrden}`}
                                  style={{
                                    width: "100%",
                                    padding: "5px 8px",
                                    borderRadius: "7px",
                                    border: "1px solid #D5CFC4",
                                    background: col.colorFondo,
                                    color: col.colorTexto,
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {estadosConfig.map((op) => (
                                    <option key={op.valor} value={op.valor}>
                                      {op.etiqueta}
                                    </option>
                                  ))}
                                </SelectConBuscador>
                              )}

                              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                                {p.eliminadoEn && esAdminEstricto ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={actualizandoId === p.id}
                                      onClick={() => void handleRestaurarPedido(p)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #2F4737",
                                        background: "#F2F6F3",
                                        color: "#2B4A36",
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <RotateCcw size={11} />
                                      <span>Restaurar</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actualizandoId === p.id}
                                      onClick={() => {
                                        setMotivoEliminacion("");
                                        setPedidoAEliminar(p);
                                      }}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: "#8A2E2E",
                                        color: "#FFFFFF",
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Trash2 size={11} />
                                      <span>Eliminar Definitivo</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {p.creadoPor?.nombre && (
                                      <span
                                        title={`Creado por: ${p.creadoPor.nombre}${p.creadoPor.origen ? ` (${p.creadoPor.origen})` : ""}`}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          padding: "3px 7px",
                                          borderRadius: "6px",
                                          border: "1px solid #E7E5E4",
                                          background: "#FAF8F5",
                                          color: "#57534E",
                                          fontSize: "0.68rem",
                                          fontWeight: 600,
                                        }}
                                      >
                                        <User size={10} />
                                        <span>{p.creadoPor.nombre}</span>
                                      </span>
                                    )}
                                    {p.comprobanteTransferencia?.url && (
                                      <a
                                        href={p.comprobanteTransferencia.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Ver recibo de pago adjunto"
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          border: "1px solid #CEDDD3",
                                          background: "#F2F6F3",
                                          color: "#2B4A36",
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                          textDecoration: "none",
                                        }}
                                      >
                                        <ExternalLink size={11} />
                                        <span>Recibo</span>
                                      </a>
                                    )}
                                    {p.respuestaPlux && (
                                      <span
                                        title={`PLUX Aut: ${p.respuestaPlux.autorizacion || p.respuestaPlux.identificador || "Aprobado"}`}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          border: "1px solid #BFDBFE",
                                          background: "#EFF6FF",
                                          color: "#1E40AF",
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                        }}
                                      >
                                        <CreditCard size={11} />
                                        <span>PLUX ✓</span>
                                      </span>
                                    )}
                                    {fotoEvidencia && (
                                      <button
                                        type="button"
                                        onClick={() => abrirModalEvidencia(p)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          border: "1px solid #CEDDD3",
                                          background: "#F2F6F3",
                                          color: "#2B4A36",
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Camera size={11} />
                                        <span>Ver Foto</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => abrirEdicionDatosPedido(p)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #D5CFC4",
                                        background: "#FFFFFF",
                                        color: "#57524C",
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Edit3 size={11} />
                                      <span>Editar</span>
                                    </button>

                                    {!esExeq && (
                                      <button
                                        type="button"
                                        onClick={() => setPedidoParaTarjeta(p)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          border:
                                            impresiones > 0
                                              ? "1px solid #8F6A2E"
                                              : "1px solid #221E1B",
                                          background: impresiones > 0 ? "#FAF6EE" : "#F4F2EE",
                                          color: impresiones > 0 ? "#745622" : "#3A3530",
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Printer size={11} />
                                        <span>Tarjeta</span>
                                      </button>
                                    )}

                                    {puedeEliminarLogico && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setMotivoEliminacion("");
                                          setPedidoAEliminar(p);
                                        }}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          border: "1px solid #E5CACA",
                                          background: "#FAF2F2",
                                          color: "#8A2E2E",
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Trash2 size={11} />
                                        <span>Eliminar</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        <DataGrid
          columnas={columnas}
          filas={pedidosFiltrados}
          idFila={(p) => p.id}
          nombreExportacion={`historial-pedidos-${negocio}`}
          busquedaInicial={pedidoEnfocado}
          filasExpandidasIniciales={idsExpandidosIniciales}
          contenidoExpandible={(p) => {
            const clasif = resolverClasificacionPedidoTienda(p);
            const esExeq = clasif === "EXEQUIALES";
            const sala = p.exequiales?.salaServicio || p.salaServicio;
            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(255px, 100%), 1fr))",
                  gap: "14px",
                  padding: "12px",
                  background: "#F8F7F4",
                  borderRadius: "10px",
                  border: "1px solid #E6E2DA",
                }}
              >
                {/* 1. Auditoría Interna de Logística, Sala y Dirección */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D5CFC4",
                    borderRadius: "9px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1F1C19" }}>
                      <Truck size={15} color="#2F4737" />
                      <strong style={{ fontSize: "0.82rem" }}>
                        {esExeq ? "Detalle Permanente Exequiales" : "Detalle Logístico y Entrega"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => abrirEdicionDatosPedido(p)}
                        title="Modificar destinatario, dirección, horario o notas del pedido"
                        aria-label="Editar Pedido"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 9px",
                          borderRadius: "6px",
                          border: "1px solid #221E1B",
                          background: "#F4F2EE",
                          color: "#3A3530",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Edit3 size={12} />
                        <span>Editar Pedido</span>
                      </button>
                      <InsigniaClasificacionPedido clasificacion={clasif} compacto />
                    </div>
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "#57524C", lineHeight: 1.48 }}>
                    {esExeq ? (
                      <>
                        <div>
                          <strong>Sala Exequiales:</strong> {sala || "Por confirmar"}
                        </div>
                        <div>
                          <strong>Quién solicitó:</strong>{" "}
                          {p.exequiales?.quienSolicita || p.compradorNombre || "—"}
                        </div>
                        <div>
                          <strong>Persona fallecida (Destinatario):</strong>{" "}
                          {p.exequiales?.nombreFallecido || p.logistica.destinatarioNombre || "Pendiente registrar"}
                        </div>
                        {p.logistica.referencia ? (
                          <div>
                            <strong>Notas para Taller:</strong> {p.logistica.referencia}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>Comprador:</strong> {p.compradorNombre || "—"}
                          {p.compradorTelefono ? ` · Tel/WhatsApp: ${p.compradorTelefono}` : ""}
                        </div>
                        <div>
                          <strong>Destinatario:</strong> {p.logistica.destinatarioNombre || "—"}
                          {p.logistica.destinatarioTelefono
                            ? ` (${p.logistica.destinatarioTelefono})`
                            : ""}
                        </div>
                        <div>
                          <strong>Dirección de entrega:</strong>{" "}
                          {p.logistica.retiroEnLocal
                            ? "Retiro en Tienda"
                            : p.logistica.direccion || "—"}
                          {p.logistica.referencia ? ` · Ref: ${p.logistica.referencia}` : ""}
                        </div>
                      </>
                    )}

                    {!esExeq && p.logistica.detalleDireccionGeo && (
                      <div style={{ fontSize: "0.74rem", color: "#2F4737" }}>
                        <strong>Mapa (Calle / Sector / Parroquia):</strong>{" "}
                        {[
                          p.logistica.detalleDireccionGeo.callePrincipal,
                          p.logistica.detalleDireccionGeo.sectorBarrio
                            ? `Sector ${p.logistica.detalleDireccionGeo.sectorBarrio}`
                            : null,
                          p.logistica.detalleDireccionGeo.parroquia
                            ? `Parroquia ${p.logistica.detalleDireccionGeo.parroquia}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || p.logistica.detalleDireccionGeo.resumenDireccion}
                      </div>
                    )}

                    <div>
                      <strong>Fecha y Hora de entrega:</strong> {p.logistica.fechaEntrega || "—"} ·{" "}
                      {formatearHorarioEntregaOrden({
                        franjaHoraria: p.logistica.franjaHoraria,
                        horaEspecifica:
                          p.logistica.horaExacta || p.exequiales?.horaServicio || null,
                        esExequiales: esExeq,
                      })}
                    </div>

                    {!esExeq && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          color: "#1E3A8A",
                          fontSize: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px 12px",
                            fontWeight: 700,
                          }}
                        >
                          {typeof p.logistica.distanciaVialKm === "number" && (
                            <span>
                              🧭 KM reales: {p.logistica.distanciaVialKm.toFixed(2)} km
                            </span>
                          )}
                          <span>
                            🚚 Delivery cobrado:{" "}
                            {p.logistica.retiroEnLocal
                              ? "$0.00 (Retiro en tienda)"
                              : Number(p.costoEnvio || 0) === 0
                                ? "$0.00 (Gratis)"
                                : `+$${Number(p.costoEnvio).toFixed(2)} USD`}
                          </span>
                          {p.logistica.zonaDetectada && (
                            <span>📍 Zona: {p.logistica.zonaDetectada}</span>
                          )}
                          {typeof p.logistica.lat === "number" &&
                            typeof p.logistica.lng === "number" && (
                              <span style={{ fontWeight: 500, color: "#1E40AF" }}>
                                GPS: {p.logistica.lat.toFixed(5)}, {p.logistica.lng.toFixed(5)}
                              </span>
                            )}
                        </div>
                        <div style={{ fontSize: "0.73rem", color: "#1E40AF" }}>
                          <strong>Detalle de ruta:</strong> {p.logistica.formulaCalculoInterno}
                        </div>
                      </div>
                    )}
                    {esExeq && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "7px 9px",
                          borderRadius: "7px",
                          background: "#F4F2EE",
                          border: "1px solid #DDD8CE",
                          color: "#3A3530",
                          fontSize: "0.75rem",
                        }}
                      >
                        <strong>Registro interno:</strong> {p.logistica.formulaCalculoInterno}
                      </div>
                    )}
                  </div>

                  {!esExeq && p.logistica.enlaceMapa && (
                    <div style={{ marginTop: "4px" }}>
                      <a
                        href={p.logistica.enlaceMapa}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir ubicación exacta de entrega en Google Maps"
                        aria-label="Abrir Mapa"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          borderRadius: "7px",
                          background: "#221E1B",
                          color: "#FFFFFF",
                          textDecoration: "none",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <MapPin size={13} />
                        <span>Abrir Mapa</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>

                {/* 2. Ítems, Producto y Dedicatorias */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E6E2DA",
                    borderRadius: "9px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1F1C19" }}>
                    <PackageCheck size={15} color="#221E1B" />
                    <strong style={{ fontSize: "0.82rem" }}>
                      {esExeq
                        ? `Detalle del Servicio Exequial (${p.items.length})`
                        : `Detalle del Producto y Dedicatorias (${p.items.length})`}
                    </strong>
                  </div>

                  {p.items.map((it, idx) => {
                    const fotoRefItem =
                      it.personalizacionFloral?.fotoReferenciaUrl || it.imagen || null;
                    return (
                      <div
                        key={`${p.id}-it-${idx}`}
                        style={{
                          borderTop: idx === 0 ? "none" : "1px solid #F4F2EE",
                          paddingTop: idx === 0 ? 0 : "6px",
                          fontSize: "0.78rem",
                          color: "#221E1B",
                          display: "flex",
                          gap: "10px",
                          alignItems: "flex-start",
                        }}
                      >
                        {fotoRefItem && (
                          <a
                            href={fotoRefItem}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={
                              it.personalizacionFloral?.mismosColoresFoto
                                ? "Abrir foto exacta de referencia elegida por el cliente"
                                : "Abrir foto de referencia del arreglo"
                            }
                            style={{ flexShrink: 0, display: "block" }}
                          >
                            <img
                              src={fotoRefItem}
                              alt={`Referencia ${it.descripcion}`}
                              style={{
                                width: "54px",
                                height: "54px",
                                objectFit: "cover",
                                borderRadius: "8px",
                                border: it.personalizacionFloral?.mismosColoresFoto
                                  ? "2px solid #2F4737"
                                  : "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                display: "block",
                              }}
                            />
                          </a>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                            <strong>
                              {it.cantidad}× {it.descripcion}
                            </strong>
                            {it.totalLinea > 0 && <span>${it.totalLinea.toFixed(2)}</span>}
                          </div>
                          {it.personalizacionFloral?.resumenTexto && (
                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "0.73rem",
                                color: it.personalizacionFloral.mismosColoresFoto
                                  ? "#166534"
                                  : "#831843",
                                background: it.personalizacionFloral.mismosColoresFoto
                                  ? "#F0FDF4"
                                  : "#FDF2F8",
                                border: it.personalizacionFloral.mismosColoresFoto
                                  ? "1px solid #BBF7D0"
                                  : "1px solid #FBCFE8",
                                borderRadius: "6px",
                                padding: "5px 8px",
                              }}
                            >
                              <strong>
                                {it.personalizacionFloral.mismosColoresFoto
                                  ? "📸 Foto elegida:"
                                  : "🎨 Personalización floral:"}
                              </strong>{" "}
                              {it.personalizacionFloral.resumenTexto}
                            </div>
                          )}
                          {it.dedicatoria?.mensaje && (
                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "0.73rem",
                                color: "#57524C",
                                background: "#FAF6EE",
                                border: "1px solid #E5D7BC",
                                borderRadius: "6px",
                                padding: "5px 8px",
                              }}
                            >
                              <strong>Para:</strong> {it.dedicatoria.para || "—"} ·{" "}
                              <strong>De:</strong> {it.dedicatoria.de || "—"} — &ldquo;
                              {it.dedicatoria.mensaje}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* TARJETA DEDICATORIA VINCULADA 1:1 AL PEDIDO (EXCEPTO EXEQUIALES) */}
                  {!esExeq &&
                    (() => {
                    const tokenTarj = p.tarjeta?.token || p.tokenAprobacion || p.id;
                    const msgTarj =
                      p.tarjeta?.mensaje ||
                      p.items.find((i) => i.dedicatoria?.mensaje)?.dedicatoria?.mensaje ||
                      "";
                    const impTarj = Number(p.tarjeta?.metadata?.impresiones ?? 0);
                    const vistasTarj = Number(p.tarjeta?.metadata?.vistas_cliente ?? 0);
                    const editCli = Boolean(p.tarjeta?.metadata?.editado_por_cliente);
                    const editStaff = Boolean((p.tarjeta?.metadata as any)?.editado_por_staff);
                    const esCondolTarj =
                      p.tarjeta?.tipo === "CONDOLENCIAS_PLANA" ||
                      p.tipoOrigen === "EXEQUIALES_LLAMADA";
                    const tieneMusica = Boolean(!esCondolTarj && p.tarjeta?.musicaUrl);
                    const esConfidencial = Boolean(
                      p.tarjeta?.confidencial ?? p.tarjeta?.metadata?.confidencial_solo_qr
                    );
                    const tokenEdicionTarj = p.tarjeta?.tokenEdicion || "";

                    return (
                      <div
                        style={{
                          padding: "10px 11px",
                          borderRadius: "8px",
                          background: "#FAF6EE",
                          border: "1px solid #E5D7BC",
                          display: "flex",
                          flexDirection: "column",
                          gap: "7px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong style={{ fontSize: "0.77rem", color: "#745622" }}>
                            {esCondolTarj
                              ? "🕊️ Condolencias (16,8 × 11,3 cm Horizontal)"
                              : "💌 Dedicatoria (11,3 × 16,8 cm Vertical)"}
                          </strong>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", fontSize: "0.68rem" }}>
                            {esConfidencial && (
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  background: "#1F1C19",
                                  color: "#FFFFFF",
                                  fontWeight: 700,
                                }}
                              >
                                🔒 Solo QR
                              </span>
                            )}
                            <span
                              style={{
                                padding: "1px 6px",
                                borderRadius: "999px",
                                background: editCli ? "#F2F6F3" : editStaff ? "#EFECE6" : "#FAF6EE",
                                color: editCli ? "#2B4A36" : editStaff ? "#3A3530" : "#745622",
                                fontWeight: 700,
                              }}
                            >
                              {editCli
                                ? "✨ Editada Cliente"
                                : editStaff
                                  ? "✏️ Editada Staff"
                                  : "🤖 Automática"}
                            </span>
                            {vistasTarj > 0 && (
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  background: "#EFECE6",
                                  color: "#3A3530",
                                  fontWeight: 700,
                                }}
                              >
                                👀 {vistasTarj}x
                              </span>
                            )}
                            {impTarj > 0 && (
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  background: "#E5D7BC",
                                  color: "#745622",
                                  fontWeight: 700,
                                }}
                              >
                                🖨️ Impresa {impTarj}x
                              </span>
                            )}
                            {tieneMusica && (
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  background: "#F4F2EE",
                                  color: "#3A3530",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                <Music size={10} /> Melodía
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "#57524C" }}>
                          {msgTarj ? (
                            <>
                              &ldquo;{msgTarj}&rdquo;
                              {!esCondolTarj && p.tarjeta?.musicaTitulo ? (
                                <span style={{ display: "block", fontSize: "0.7rem", color: "#3A3530", marginTop: "2px" }}>
                                  🎵 {p.tarjeta.musicaTitulo}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span style={{ fontStyle: "italic", color: "#847D74" }}>
                              Sin mensaje escrito aún. Puedes editarla aquí o enviar el enlace de edición al cliente.
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setPedidoParaTarjeta(p)}
                            title="Editar tarjeta, descargar PDF o mandar a imprimir en Canon G3110"
                            aria-label="Editar e Imprimir Tarjeta"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#221E1B",
                              color: "#FFFFFF",
                              fontSize: "0.73rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <Printer size={12} />
                            <span>Editar / Imprimir / PDF</span>
                          </button>

                          {tokenEdicionTarj && (
                            <a
                              href={`/tarjeta-editar/${tokenEdicionTarj}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enlace exclusivo para editar el mensaje de la tarjeta (Cliente / Ventas)"
                              aria-label="Enlace Editar Tarjeta"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 9px",
                                borderRadius: "6px",
                                border: "1px solid #CEDDD3",
                                background: "#F2F6F3",
                                color: "#2F4737",
                                textDecoration: "none",
                                fontSize: "0.73rem",
                                fontWeight: 700,
                              }}
                            >
                              <Edit3 size={11} />
                              <span>Link Editar</span>
                            </a>
                          )}

                          {!esCondolTarj && (
                            <a
                              href={`/dedicatoria/${tokenTarj}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Vista de solo lectura de la tarjeta digital (la misma URL impresa en el QR)"
                              aria-label="Ver Tarjeta Digital"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 9px",
                                borderRadius: "6px",
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#1F1C19",
                                textDecoration: "none",
                                fontSize: "0.73rem",
                                fontWeight: 700,
                              }}
                            >
                              <span>Ver Digital</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "8px",
                      borderTop: "1px solid #E6E2DA",
                      fontSize: "0.75rem",
                      color: "#57524C",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {p.evento && (
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: "7px",
                          background: "#F8F4F2",
                          border: "1px solid #E5D8D3",
                          color: "#6E3B42",
                        }}
                      >
                        <strong>Evento:</strong> {p.evento.tipoEvento || "Evento"} · Fecha:{" "}
                        {p.evento.fechaEvento || "—"}
                        {p.evento.horaEvento ? ` (${p.evento.horaEvento})` : ""}
                        {p.evento.paletaColores ? ` · Paleta: ${p.evento.paletaColores}` : ""}
                        {p.evento.notasEvento ? (
                          <div style={{ marginTop: "3px" }}>
                            <strong>Notas:</strong> {p.evento.notasEvento}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {!esExeq && (
                      <div>
                        <strong>Contacto / Facturación:</strong> {p.compradorNombre}
                        {p.compradorTelefono ? ` · WhatsApp: ${p.compradorTelefono}` : ""}
                        {p.compradorIdentificacion && p.compradorIdentificacion !== "9999999999999"
                          ? ` · ID: ${p.compradorIdentificacion}`
                          : ""}
                        {p.compradorCorreo ? ` · ${p.compradorCorreo}` : ""}
                        {p.autorizaWhatsapp ? " · ✓ LOPDP WhatsApp" : ""}
                      </div>
                    )}

                    {/* Trazabilidad: Quién creó el pedido (manual / web / exequiales) */}
                    {p.creadoPor?.nombre && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          flexWrap: "wrap",
                          fontSize: "0.75rem",
                          color: "#44403C",
                          background: "#FAF8F5",
                          border: "1px solid #E7E5E4",
                          borderRadius: "8px",
                          padding: "5px 9px",
                        }}
                      >
                        <User size={13} color="#57534E" />
                        <span>
                          <strong>Creado por:</strong> {p.creadoPor.nombre}
                          {p.creadoPor.correo && p.creadoPor.correo !== p.creadoPor.nombre
                            ? ` (${p.creadoPor.correo})`
                            : ""}
                          {p.creadoPor.origen ? ` · ${p.creadoPor.origen.replace(/_/g, " ")}` : ""}
                        </span>
                      </div>
                    )}

                    {/* Evidencias consolidadas del pedido: Recibo manual, Respuesta PLUX, Confirmación de Entrega */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: "#F8FAF8",
                        border: "1px solid #DCE7DF",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong style={{ fontSize: "0.76rem", color: "#1F352C" }}>
                          Evidencias del Pedido
                        </strong>
                        <label
                          title="Subir o reemplazar recibo / comprobante de pago (imagen o PDF)"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 9px",
                            borderRadius: "7px",
                            border: "1px solid #2F4737",
                            background: "#FFFFFF",
                            color: "#2F4737",
                            fontSize: "0.71rem",
                            fontWeight: 700,
                            cursor: subiendoEvidenciaPedidoId === p.id ? "wait" : "pointer",
                          }}
                        >
                          {subiendoEvidenciaPedidoId === p.id ? (
                            <Loader2 size={12} />
                          ) : (
                            <Upload size={12} />
                          )}
                          <span>
                            {subiendoEvidenciaPedidoId === p.id
                              ? "Subiendo..."
                              : p.comprobanteTransferencia?.url
                                ? "Cambiar Recibo"
                                : "Subir Recibo"}
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            disabled={subiendoEvidenciaPedidoId === p.id}
                            onChange={(ev) => {
                              const f = ev.target.files?.[0];
                              ev.target.value = "";
                              if (f) void handleSubirComprobantePedido(p, f);
                            }}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>

                      {/* 1. Recibo / Comprobante subido */}
                      {p.comprobanteTransferencia?.url && (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: "#F2F6F3",
                            border: "1px solid #CEDDD3",
                            color: "#2B4A36",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontSize: "0.75rem" }}>
                              <strong>Recibo de pago:</strong>{" "}
                              {p.comprobanteTransferencia.nombreArchivo || "Archivo"}
                              {p.comprobanteTransferencia.subidoPorNombre
                                ? ` · Subido por ${p.comprobanteTransferencia.subidoPorNombre}`
                                : ""}
                            </span>
                            <a
                              href={p.comprobanteTransferencia.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={p.comprobanteTransferencia.nombreArchivo || "comprobante"}
                              title="Ver o descargar recibo de pago"
                              aria-label="Ver Comprobante"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 9px",
                                borderRadius: "6px",
                                background: "#2F4737",
                                color: "#FFFFFF",
                                textDecoration: "none",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                              }}
                            >
                              <span>Ver Recibo</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          {p.comprobanteTransferencia.mimeType?.startsWith("image/") && (
                            <img
                              src={p.comprobanteTransferencia.url}
                              alt="Comprobante de pago"
                              style={{
                                maxWidth: "220px",
                                maxHeight: "150px",
                                objectFit: "contain",
                                borderRadius: "6px",
                                border: "1px solid #CEDDD3",
                                background: "#FFFFFF",
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* 2. Respuesta oficial de PagoPlux (PLUX) */}
                      {p.respuestaPlux && (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: "#EFF6FF",
                            border: "1px solid #BFDBFE",
                            color: "#1E3A8A",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            fontSize: "0.74rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <CreditCard size={13} />
                            <strong>Respuesta PLUX ({p.respuestaPlux.estado || "APROBADO"})</strong>
                            {p.respuestaPlux.autorizacion && (
                              <span>· Aut: <code>{p.respuestaPlux.autorizacion}</code></span>
                            )}
                            {p.respuestaPlux.marcaTarjeta && (
                              <span>
                                · {p.respuestaPlux.marcaTarjeta}
                                {p.respuestaPlux.ultimosDigitos ? ` ****${p.respuestaPlux.ultimosDigitos}` : ""}
                              </span>
                            )}
                            {p.respuestaPlux.montoUsd != null && (
                              <span>· ${Number(p.respuestaPlux.montoUsd).toFixed(2)} USD</span>
                            )}
                          </div>
                          {p.respuestaPlux.identificador && (
                            <div style={{ fontSize: "0.7rem", color: "#3B82F6" }}>
                              ID Transacción: <code>{p.respuestaPlux.identificador}</code>
                              {p.respuestaPlux.confirmadoEn
                                ? ` · ${new Date(p.respuestaPlux.confirmadoEn).toLocaleString("es-EC")}`
                                : ""}
                            </div>
                          )}
                          {p.respuestaPlux.respuestaRaw ? (
                            <details style={{ marginTop: "2px" }}>
                              <summary style={{ cursor: "pointer", fontSize: "0.7rem", fontWeight: 700 }}>
                                Ver respuesta completa PLUX
                              </summary>
                              <pre
                                style={{
                                  margin: "4px 0 0",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  background: "#FFFFFF",
                                  border: "1px solid #DBEAFE",
                                  fontSize: "0.67rem",
                                  maxHeight: "150px",
                                  overflow: "auto",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  color: "#1E293B",
                                }}
                              >
                                {JSON.stringify(p.respuestaPlux.respuestaRaw, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      )}

                      {/* 3. Confirmación de Entrega (foto + GPS) */}
                      {(p.evidenciaEntrega?.confirmada || p.evidenciaEntrega?.fotoUrl) && (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: "#ECFDF5",
                            border: "1px solid #A7F3D0",
                            color: "#065F46",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            fontSize: "0.74rem",
                          }}
                        >
                          <div>
                            <strong>✓ Confirmación de Entrega</strong>
                            {p.evidenciaEntrega.entregadorNombre
                              ? ` · Por: ${p.evidenciaEntrega.entregadorNombre}`
                              : ""}
                            {p.evidenciaEntrega.capturadoEn
                              ? ` · ${new Date(p.evidenciaEntrega.capturadoEn).toLocaleString("es-EC")}`
                              : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => abrirModalEvidencia(p)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 9px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#065F46",
                              color: "#FFFFFF",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <Camera size={12} />
                            <span>Ver Entrega</span>
                          </button>
                        </div>
                      )}

                      {!p.comprobanteTransferencia?.url &&
                        !p.respuestaPlux &&
                        !p.evidenciaEntrega?.confirmada &&
                        !p.evidenciaEntrega?.fotoUrl && (
                          <span style={{ fontSize: "0.73rem", color: "#64748B" }}>
                            Aún sin evidencias adjuntas. Puedes subir el recibo de pago manualmente aquí.
                          </span>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {p.tipoOrigen === "PROFORMA_EVENTO" && (
                        <button
                          type="button"
                          onClick={() => setProformaEditandoVariacion(p)}
                          title="Actualizar proforma creando una nueva variación y enviar PDF original + actualizado por correo al cliente"
                          aria-label="Nueva Variación"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#6E3B42",
                            color: "#FFFFFF",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <FilePlus2 size={13} />
                          <span>Nueva Variación</span>
                        </button>
                      )}
                      {p.tokenAprobacion && (
                        <a
                          href={`/proforma/${p.tokenAprobacion}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir proforma pública con selector de variaciones y pago"
                          aria-label="Ver Proforma"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "7px",
                            background: "#2D4A3E",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          <span>Ver Proforma</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {p.tokenAprobacion && (
                        <a
                          href={`/api/proforma/${p.tokenAprobacion}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descargar archivo PDF de esta versión"
                          aria-label="Descargar PDF"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "7px",
                            border: "1px solid #D5CFC4",
                            background: "#FFFFFF",
                            color: "#1F1C19",
                            textDecoration: "none",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          <span>Descargar PDF</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {p.compradorTelefono && (
                        <a
                          href={`https://wa.me/${p.compradorTelefono.replace(/\D+/g, "")}?text=${encodeURIComponent(
                            `Hola ${p.compradorNombre}, te escribimos de ${negocio.toUpperCase()} respecto a tu pedido ${p.codigoOrden}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Contactar al cliente por WhatsApp"
                          aria-label="WhatsApp"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "7px",
                            background: "#2F4737",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          <span>WhatsApp</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Evidencia Fotográfica Permanente de Confirmación de Entrega */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E6E2DA",
                    borderRadius: "9px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1F1C19" }}>
                    <Camera size={15} color="#2F4737" />
                    <strong style={{ fontSize: "0.82rem" }}>
                      Confirmación Fotográfica de Entrega
                    </strong>
                  </div>

                  {p.evidenciaEntrega?.fotoUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => abrirModalEvidencia(p)}
                        title="Ampliar fotografía georreferenciada de confirmación"
                        aria-label="Ampliar Foto"
                        style={{
                          padding: 0,
                          border: "1px solid #D5CFC4",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#1F1C19",
                          cursor: "pointer",
                          maxHeight: "175px",
                        }}
                      >
                        <img
                          src={p.evidenciaEntrega.fotoUrl}
                          alt={`Evidencia ${p.codigoOrden}`}
                          style={{
                            width: "100%",
                            maxHeight: "175px",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </button>

                      <div style={{ fontSize: "0.75rem", color: "#57524C", lineHeight: 1.42 }}>
                        {p.evidenciaEntrega.capturadoEn && (
                          <div>
                            <strong>Fecha/Hora entrega:</strong>{" "}
                            {new Date(p.evidenciaEntrega.capturadoEn).toLocaleString("es-EC", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                        )}
                        {p.evidenciaEntrega.entregadorNombre && (
                          <div>
                            <strong>Entregado por:</strong> {p.evidenciaEntrega.entregadorNombre}
                          </div>
                        )}
                        {p.evidenciaEntrega.direccionGps && (
                          <div>
                            <strong>Ubicación GPS:</strong> {p.evidenciaEntrega.direccionGps}
                          </div>
                        )}
                        {(p.evidenciaEntrega.numeroInforme || p.exequiales?.numeroInforme) && (
                          <div>
                            <strong>Informe IESS:</strong>{" "}
                            {p.evidenciaEntrega.numeroInforme || p.exequiales?.numeroInforme}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => abrirModalEvidencia(p)}
                          title="Ver fotografía en tamaño completo"
                          aria-label="Ampliar Evidencia"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#1F1C19",
                            color: "#FFFFFF",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Camera size={13} />
                          <span>Ampliar Foto</span>
                        </button>

                        {p.evidenciaEntrega.latitud != null &&
                          p.evidenciaEntrega.longitud != null && (
                            <a
                              href={`https://www.google.com/maps?q=${p.evidenciaEntrega.latitud},${p.evidenciaEntrega.longitud}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver punto GPS exacto donde se tomó la foto"
                              aria-label="GPS Entrega"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 11px",
                                borderRadius: "7px",
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#1F1C19",
                                textDecoration: "none",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                              }}
                            >
                              <MapPin size={13} color="#2F4737" />
                              <span>GPS Entrega</span>
                            </a>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        border: "1px dashed #D5CFC4",
                        background: "#F8F7F4",
                        fontSize: "0.76rem",
                        color: "#847D74",
                        lineHeight: 1.45,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <span>
                        Aún no se ha subido fotografía de confirmación para este pedido. Al
                        confirmar la entrega en campo quedará almacenada permanentemente aquí y
                        disponible para informes.
                      </span>
                      <a
                        href={`/panel/entregas?pedido=${encodeURIComponent(p.codigoOrden)}`}
                        title="Ir a Confirmación de Entregas para adjuntar foto"
                        aria-label="Confirmar Entrega"
                        style={{
                          alignSelf: "flex-start",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          borderRadius: "7px",
                          background: "#2F4737",
                          color: "#FFFFFF",
                          textDecoration: "none",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                        }}
                      >
                        <Camera size={13} />
                        <span>Confirmar Entrega</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
        />
        )}
      </div>

      {proformaEditandoVariacion && (
        <ModalEditarVariacionProforma
          pedidoBase={proformaEditandoVariacion}
          alCerrar={() => setProformaEditandoVariacion(null)}
          alVariacionCreada={() => {
            void cargarPedidos();
          }}
        />
      )}

      <ModalVisorEvidenciaEntrega
        datos={visorEvidencia}
        onCerrar={() => setVisorEvidencia(null)}
      />

      {pedidoParaTarjeta && (
        <ModalImprimirTarjetaTaller
          abierto={Boolean(pedidoParaTarjeta)}
          onCerrar={() => setPedidoParaTarjeta(null)}
          orden={convertirPedidoTiendaAOrdenTaller(pedidoParaTarjeta)}
          negocio={negocio}
          onActualizarOrden={(act) => {
            const actualizarRegistro = (reg: PedidoTiendaRegistrado): PedidoTiendaRegistrado => {
              const coincide =
                reg.id === act.id ||
                reg.ordenTallerId === act.id ||
                reg.id === pedidoParaTarjeta.id;
              if (!coincide) return reg;
              const tarPrev = reg.tarjeta ?? {
                token: reg.tokenAprobacion || reg.id,
                tipo: "DIPTICO" as const,
                mensaje: "",
                para: reg.logistica.destinatarioNombre || "",
                de: reg.compradorNombre || "",
              };
              return {
                ...reg,
                tarjeta: {
                  ...tarPrev,
                  ...(act.tarjetaToken !== undefined ? { token: act.tarjetaToken } : {}),
                  ...(act.tarjetaTokenEdicion !== undefined
                    ? { tokenEdicion: act.tarjetaTokenEdicion }
                    : {}),
                  ...(act.tarjetaTipo !== undefined ? { tipo: act.tarjetaTipo } : {}),
                  ...(act.tarjetaConfidencial !== undefined
                    ? { confidencial: act.tarjetaConfidencial }
                    : {}),
                  ...(act.dedicatoria !== undefined ? { mensaje: act.dedicatoria } : {}),
                  ...(act.destinatarioFallecido !== undefined
                    ? { para: act.destinatarioFallecido }
                    : {}),
                  ...(act.clienteSolicita !== undefined ? { de: act.clienteSolicita } : {}),
                  ...(act.tarjetaDiseno !== undefined ? { diseno: act.tarjetaDiseno } : {}),
                  ...(act.tarjetaMusicaUrl !== undefined
                    ? { musicaUrl: act.tarjetaMusicaUrl }
                    : {}),
                  ...(act.tarjetaMusicaTitulo !== undefined
                    ? { musicaTitulo: act.tarjetaMusicaTitulo }
                    : {}),
                  ...(act.tarjetaLyrics !== undefined ? { lyrics: act.tarjetaLyrics } : {}),
                  ...(act.tarjetaMetadata !== undefined
                    ? { metadata: act.tarjetaMetadata }
                    : {}),
                },
              };
            };
            setPedidoParaTarjeta((prev) => (prev ? actualizarRegistro(prev) : null));
            setPedidos((prev) => {
              const siguiente = prev.map(actualizarRegistro);
              try {
                localStorage.setItem(cacheKey, JSON.stringify(siguiente));
              } catch {}
              return siguiente;
            });
            void cargarPedidos();
          }}
        />
      )}

      {formEdicionPedido && (
        <div
          onClick={() => setFormEdicionPedido(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.62)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 99998,
          }}
        >
          <form
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={(e) => void handleGuardarEdicionPedido(e)}
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "1rem", color: "#1F1C19" }}>
                  ✏️ Editar Datos del Pedido ({formEdicionPedido.pedidoBase.codigoOrden})
                </strong>
                <div style={{ fontSize: "0.75rem", color: "#847D74" }}>
                  {formEdicionPedido.clasificacionPedido === "EXEQUIALES"
                    ? "Orden Exequiales · Se sincroniza con Envíos, Taller e Informe."
                    : "Se sincroniza automáticamente con Envíos, Taller y Tarjeta Dedicatoria."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormEdicionPedido(null)}
                title="Cerrar"
                aria-label="Cerrar"
                style={{
                  border: "none",
                  background: "#F4F2EE",
                  borderRadius: "8px",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={15} />
              </button>
            </div>

            {errorModalEdicion && (
              <div
                style={{
                  background: "#FAF2F2",
                  border: "1px solid #E5CACA",
                  borderRadius: "8px",
                  padding: "8px 11px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#8A2E2E",
                }}
              >
                {errorModalEdicion}
              </div>
            )}

            {/* 1. TIPO / CLASIFICACIÓN DE PEDIDO */}
            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                Tipo de Pedido *
              </label>
              <SelectConBuscador
                value={formEdicionPedido.clasificacionPedido}
                onChange={(e) => {
                  const nuevaClasif = e.target.value as ClasificacionOperativaPedido;
                  setErrorModalEdicion(null);
                  setFormEdicionPedido((prev) => {
                    if (!prev) return null;
                    const pasaAExeq = nuevaClasif === "EXEQUIALES";
                    const modoAjustado =
                      !pasaAExeq && prev.modoHorario === "LO_ANTES_POSIBLE"
                        ? "A) 09:00 - 13:00"
                        : prev.modoHorario;
                    return {
                      ...prev,
                      clasificacionPedido: nuevaClasif,
                      modoHorario: modoAjustado,
                      destinatarioNombre:
                        pasaAExeq && esNombreFallecidoPendiente(prev.destinatarioNombre)
                          ? ""
                          : prev.destinatarioNombre,
                    };
                  });
                }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem" }}
              >
                {CLASIFICACIONES_OPERATIVAS_PEDIDO.map((op) => (
                  <option key={op.clave} value={op.clave}>
                    {op.etiqueta}
                  </option>
                ))}
              </SelectConBuscador>
            </div>

            {/* 2. FECHA DE ENTREGA Y SALA (CUANDO ES EXEQUIALES) O HORA DE ENTREGA */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                  Fecha de Entrega *
                </label>
                <input
                  type="date"
                  required
                  value={formEdicionPedido.fechaEntrega}
                  onChange={(e) =>
                    setFormEdicionPedido((prev) =>
                      prev ? { ...prev, fechaEntrega: e.target.value } : null
                    )
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                />
              </div>

              {formEdicionPedido.clasificacionPedido === "EXEQUIALES" ? (
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#3A3530", marginBottom: "3px" }}>
                    Sala Exequiales
                  </label>
                  <SelectConBuscador
                    value={formEdicionPedido.salaServicio}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, salaServicio: e.target.value } : null
                      )
                    }
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem" }}
                  >
                    <option value="">Por confirmar</option>
                    {OPCIONES_SALA_EXEQUIALES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SelectConBuscador>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                    Hora de Entrega *
                  </label>
                  <SelectConBuscador
                    value={formEdicionPedido.modoHorario}
                    onChange={(e) => {
                      const nuevoModo = e.target.value as ModoSelectorHorarioEntrega;
                      setFormEdicionPedido((prev) =>
                        prev
                          ? {
                              ...prev,
                              modoHorario: nuevoModo,
                              horaExacta:
                                nuevoModo === "HORA_EXACTA" && !prev.horaExacta
                                  ? "10:30"
                                  : prev.horaExacta,
                            }
                          : null
                      );
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem" }}
                  >
                    {RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => (
                      <option key={r.codigo} value={r.valor}>
                        {r.etiqueta}
                      </option>
                    ))}
                    <option value="HORA_EXACTA">⏰ Hora exacta</option>
                  </SelectConBuscador>
                </div>
              )}
            </div>

            {/* 2B. HORA DE ENTREGA EN EXEQUIALES O CAMPO DE HORA EXACTA CUANDO APLIQUE */}
            {formEdicionPedido.clasificacionPedido === "EXEQUIALES" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    formEdicionPedido.modoHorario === "HORA_EXACTA" ? "1fr 1fr" : "1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                    Hora de Entrega *
                  </label>
                  <SelectConBuscador
                    value={formEdicionPedido.modoHorario}
                    onChange={(e) => {
                      const nuevoModo = e.target.value as ModoSelectorHorarioEntrega;
                      setFormEdicionPedido((prev) =>
                        prev
                          ? {
                              ...prev,
                              modoHorario: nuevoModo,
                              horaExacta:
                                nuevoModo === "HORA_EXACTA" && !prev.horaExacta
                                  ? "10:30"
                                  : prev.horaExacta,
                            }
                          : null
                      );
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem" }}
                  >
                    <option value="LO_ANTES_POSIBLE">⚡ Lo antes posible</option>
                    {RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => (
                      <option key={r.codigo} value={r.valor}>
                        {r.etiqueta}
                      </option>
                    ))}
                    <option value="HORA_EXACTA">⏰ Hora exacta</option>
                  </SelectConBuscador>
                </div>

                {formEdicionPedido.modoHorario === "HORA_EXACTA" && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#2F4737", marginBottom: "3px" }}>
                      Indicar Hora Exacta *
                    </label>
                    <input
                      type="time"
                      required
                      value={formEdicionPedido.horaExacta}
                      onChange={(e) =>
                        setFormEdicionPedido((prev) =>
                          prev ? { ...prev, horaExacta: e.target.value } : null
                        )
                      }
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #2F4737", fontSize: "0.84rem", fontWeight: 700, boxSizing: "border-box" }}
                    />
                  </div>
                )}
              </div>
            ) : (
              formEdicionPedido.modoHorario === "HORA_EXACTA" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#2F4737", marginBottom: "3px" }}>
                    Indicar Hora Exacta de Entrega *
                  </label>
                  <input
                    type="time"
                    required
                    value={formEdicionPedido.horaExacta}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, horaExacta: e.target.value } : null
                      )
                    }
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #2F4737", fontSize: "0.84rem", fontWeight: 700, boxSizing: "border-box" }}
                  />
                </div>
              )
            )}

            {/* 3. COMPRADOR / QUIÉN SOLICITA (+ TELÉFONO EXCEPTO EN EXEQUIALES) */}
            {formEdicionPedido.clasificacionPedido === "EXEQUIALES" ? (
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                  Solicita / Coordinador
                </label>
                <input
                  type="text"
                  value={formEdicionPedido.compradorNombre}
                  onChange={(e) =>
                    setFormEdicionPedido((prev) =>
                      prev ? { ...prev, compradorNombre: e.target.value } : null
                    )
                  }
                  placeholder="Ej. Cristina, Cristian Montaluisa..."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                    Comprador / De parte de
                  </label>
                  <input
                    type="text"
                    value={formEdicionPedido.compradorNombre}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, compradorNombre: e.target.value } : null
                      )
                    }
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formEdicionPedido.compradorTelefono}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, compradorTelefono: e.target.value } : null
                      )
                    }
                    placeholder="099..."
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            )}

            {/* 4. DESTINATARIO / PERSONA FALLECIDA (OBLIGATORIO EN EXEQUIALES) */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color:
                    formEdicionPedido.clasificacionPedido === "EXEQUIALES"
                      ? "#3A3530"
                      : "#57524C",
                  marginBottom: "3px",
                }}
              >
                {formEdicionPedido.clasificacionPedido === "EXEQUIALES"
                  ? "Persona Fallecida (Destinatario) *"
                  : formEdicionPedido.clasificacionPedido === "CONDOLENCIAS"
                    ? "Destinatario / Persona Fallecida"
                    : formEdicionPedido.clasificacionPedido === "EVENTOS"
                      ? "Destinatario / Contacto del Evento"
                      : "Destinatario (quien recibe)"}
              </label>
              <input
                type="text"
                required={formEdicionPedido.clasificacionPedido === "EXEQUIALES"}
                value={formEdicionPedido.destinatarioNombre}
                onChange={(e) => {
                  setErrorModalEdicion(null);
                  setFormEdicionPedido((prev) =>
                    prev ? { ...prev, destinatarioNombre: e.target.value } : null
                  );
                }}
                placeholder={
                  formEdicionPedido.clasificacionPedido === "EXEQUIALES"
                    ? "Nombre completo de la persona fallecida (requerido)"
                    : "Nombre de quien recibe"
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border:
                    formEdicionPedido.clasificacionPedido === "EXEQUIALES"
                      ? "1.5px solid #4A453F"
                      : "1px solid #D5CFC4",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* 5. DIRECCIÓN, RETIRO EN TIENDA, GOOGLE MAPS Y TARJETA (NO REQUERIDOS NI MOSTRADOS EN EXEQUIALES) */}
            {formEdicionPedido.clasificacionPedido !== "EXEQUIALES" && (
              <>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "#57524C" }}>
                      Dirección de Entrega
                    </label>
                    <label style={{ fontSize: "0.74rem", color: "#57524C", display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={formEdicionPedido.retiroEnLocal}
                        onChange={(e) =>
                          setFormEdicionPedido((prev) =>
                            prev ? { ...prev, retiroEnLocal: e.target.checked } : null
                          )
                        }
                      />
                      <span>Retiro en Tienda</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={formEdicionPedido.retiroEnLocal}
                    value={formEdicionPedido.direccionEntrega}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, direccionEntrega: e.target.value } : null
                      )
                    }
                    placeholder="Sector, calles, edificio o funeraria"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                    Enlace Google Maps (opcional)
                  </label>
                  <input
                    type="text"
                    value={formEdicionPedido.enlaceMapa}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, enlaceMapa: e.target.value } : null
                      )
                    }
                    placeholder="https://maps.app.goo.gl/..."
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "#57524C" }}>
                      {formEdicionPedido.clasificacionPedido === "CONDOLENCIAS"
                        ? "Mensaje de la Tarjeta de Condolencias"
                        : "Mensaje de la Tarjeta Dedicatoria"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const p = formEdicionPedido.pedidoBase;
                        setFormEdicionPedido(null);
                        setPedidoParaTarjeta(p);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#221E1B",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Abrir vista de impresión / música →
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={formEdicionPedido.dedicatoria}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, dedicatoria: e.target.value } : null
                      )
                    }
                    placeholder="Mensaje para la tarjeta impresa y digital"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "3px" }}>
                Notas / Indicaciones para Taller
              </label>
              <input
                type="text"
                value={formEdicionPedido.observaciones}
                onChange={(e) =>
                  setFormEdicionPedido((prev) =>
                    prev ? { ...prev, observaciones: e.target.value } : null
                  )
                }
                placeholder="Papel negro, tonos pastel, referencia de entrega..."
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D5CFC4", fontSize: "0.82rem", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setFormEdicionPedido(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#57524C",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoEdicionPedido}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {guardandoEdicionPedido ? <Loader2 size={14} /> : <Save size={14} />}
                <span>Guardar Pedido</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {pedidoAEliminar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.58)",
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#8A2E2E" }}>
                {pedidoAEliminar.eliminadoEn
                  ? `Eliminar definitivamente ${pedidoAEliminar.codigoOrden}`
                  : `Eliminar pedido ${pedidoAEliminar.codigoOrden}`}
              </h3>
              <button
                type="button"
                onClick={() => setPedidoAEliminar(null)}
                aria-label="Cerrar"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#847D74",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: "9px",
                background: "#F8F7F4",
                border: "1px solid #E6E2DA",
                fontSize: "0.82rem",
                color: "#57524C",
              }}
            >
              <strong>{pedidoAEliminar.compradorNombre}</strong>
              <div style={{ fontSize: "0.75rem", color: "#847D74", marginTop: "3px" }}>
                {pedidoAEliminar.items.map((it) => `${it.cantidad}x ${it.descripcion}`).join(", ")} · $
                {pedidoAEliminar.total.toFixed(2)}
              </div>
            </div>

            {pedidoAEliminar.eliminadoEn ? (
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#8A2E2E", lineHeight: 1.45 }}>
                Esta acción eliminará el registro de forma <strong>permanente e irreversible</strong>{" "}
                de la base de datos.
              </p>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: "0.81rem", color: "#57524C", lineHeight: 1.45 }}>
                  {esAdminEstricto
                    ? "Como Administrador puedes enviarlo a Papelera (borrado lógico reversible) o eliminarlo definitivamente."
                    : "El pedido dejará de mostrarse en las bandejas operativas y quedará archivado en la Papelera (solo visible para el Administrador)."}
                </p>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "#57524C",
                      marginBottom: "4px",
                    }}
                  >
                    Motivo (opcional)
                  </label>
                  <input
                    type="text"
                    value={motivoEliminacion}
                    onChange={(e) => setMotivoEliminacion(e.target.value)}
                    placeholder="Ej. Pedido duplicado, cancelado por cliente..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={procesandoEliminacion}
                onClick={() => setPedidoAEliminar(null)}
                style={{
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#57524C",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              {!pedidoAEliminar.eliminadoEn && (
                <button
                  type="button"
                  disabled={procesandoEliminacion}
                  onClick={() => void handleConfirmarEliminacion(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #DEBABA",
                    background: esAdminEstricto ? "#FAF2F2" : "#8A2E2E",
                    color: esAdminEstricto ? "#8A2E2E" : "#FFFFFF",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: procesandoEliminacion ? "wait" : "pointer",
                  }}
                >
                  {procesandoEliminacion ? <Loader2 size={13} /> : <Trash2 size={13} />}
                  <span>{esAdminEstricto ? "Enviar a Papelera" : "Confirmar"}</span>
                </button>
              )}

              {esAdminEstricto && (
                <button
                  type="button"
                  disabled={procesandoEliminacion}
                  onClick={() => void handleConfirmarEliminacion(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#8A2E2E",
                    color: "#FFFFFF",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: procesandoEliminacion ? "wait" : "pointer",
                  }}
                >
                  {procesandoEliminacion ? <Loader2 size={13} /> : <Trash2 size={13} />}
                  <span>Eliminar Definitivo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <ModalWizardPedidoAria
        abierto={mostrarWizardAria}
        negocio={negocio}
        estadosDisponibles={estadosConfig}
        onCerrar={() => setMostrarWizardAria(false)}
        onPedidoCreado={({ codigo }) => {
          setMostrarWizardAria(false);
          setPedidoEnfocado(codigo);
          setFiltroFecha("TODOS");
          void cargarPedidos();
        }}
      />

      {esAdminEstricto && (
        <ModalAdminEstadosPedido
          abierto={mostrarAdminEstados}
          negocio={negocio}
          estadosActuales={estadosConfig}
          onCerrar={() => setMostrarAdminEstados(false)}
          onEstadosActualizados={(nuevos) => {
            setEstadosConfig(nuevos);
          }}
        />
      )}
    </div>
  );
}
