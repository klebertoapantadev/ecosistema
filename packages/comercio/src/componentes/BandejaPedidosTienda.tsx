"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, SelectConBuscador, type ColumnaDataGrid } from "@eco/datagrid";
import {
  Camera,
  CheckCircle2,
  ClipboardList,
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
  Table2,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  actualizarEstadoPedidoTiendaAction,
  obtenerPedidosTiendaAction,
  type PedidoTiendaRegistrado,
} from "../acciones-logistica";
import {
  actualizarClasificacionPedidoAction,
  eliminarPedidoOperativoAction,
  guardarEdicionPedidoYTarjetaAction,
  restaurarPedidoEliminadoAction,
} from "../acciones-operaciones-taller";
import {
  CLASIFICACIONES_OPERATIVAS_PEDIDO,
  OPCIONES_SALA_EXEQUIALES,
  RANGOS_HORARIO_ENTREGA_TIENDA,
  construirValoresHorarioGuardar,
  esNombreFallecidoPendiente,
  formatearHorarioEntregaOrden,
  inferirClasificacionPedido,
  obtenerDefinicionClasificacionPedido,
  resolverEstadoInicialHorario,
  type ClasificacionOperativaPedido,
  type ModoSelectorHorarioEntrega,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";
import {
  BarraFiltroClasificacionPedido,
  InsigniaClasificacionPedido,
  ModalVisorEvidenciaEntrega,
  type DatosVisorEvidenciaModal,
} from "./InsigniaClasificacionPedido";
import { ModalEditarVariacionProforma } from "./ModalEditarVariacionProforma";
import { ModalImprimirTarjetaTaller } from "./ModalImprimirTarjetaTaller";

interface PropsBandejaPedidosTienda {
  negocio: string;
  pedidosIniciales?: PedidoTiendaRegistrado[];
}

const ESTADOS_PEDIDO: Array<{
  valor: string;
  etiqueta: string;
  colorFondo: string;
  colorTexto: string;
}> = [
  { valor: "ENVIADA", etiqueta: "Proforma Emitida", colorFondo: "#F3E8FF", colorTexto: "#6B21A8" },
  { valor: "PENDIENTE_PAGO", etiqueta: "Pendiente Pago", colorFondo: "#FEF3C7", colorTexto: "#92400E" },
  { valor: "ORDEN_CONFIRMADA", etiqueta: "Orden Confirmada", colorFondo: "#FEF9C3", colorTexto: "#854D0E" },
  { valor: "RESERVADA_70", etiqueta: "Reserva 70%", colorFondo: "#DBEAFE", colorTexto: "#1D4ED8" },
  { valor: "APROBADA", etiqueta: "Confirmado", colorFondo: "#DCFCE7", colorTexto: "#166534" },
  { valor: "NO_ACEPTADA", etiqueta: "No Aceptada", colorFondo: "#F1F5F9", colorTexto: "#64748B" },
  { valor: "EN_PREPARACION", etiqueta: "En Taller", colorFondo: "#E0F2FE", colorTexto: "#0369A1" },
  { valor: "EN_RUTA", etiqueta: "En Ruta", colorFondo: "#E0E7FF", colorTexto: "#3730A3" },
  { valor: "ENTREGADO", etiqueta: "Entregado", colorFondo: "#F0FDF4", colorTexto: "#15803D" },
  { valor: "CANCELADO", etiqueta: "Cancelado", colorFondo: "#FEE2F2", colorTexto: "#991B1B" },
];

function estiloEstado(estado: string) {
  const encontrado = ESTADOS_PEDIDO.find((e) => e.valor === estado);
  return (
    encontrado ?? {
      valor: estado,
      etiqueta: estado,
      colorFondo: "#F4F4F5",
      colorTexto: "#27272A",
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
  const [modoVista, setModoVista] = useState<"tabla" | "kanban">("tabla");
  const [busquedaKanban, setBusquedaKanban] = useState<string>("");
  const [arrastrandoPedidoId, setArrastrandoPedidoId] = useState<string | null>(null);
  const [estadoHoverKanban, setEstadoHoverKanban] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const guardado = localStorage.getItem(`eco_pedidos_modo_vista_${negocio.trim().toLowerCase()}`);
      if (guardado === "kanban" || guardado === "tabla") {
        setModoVista(guardado);
      }
    } catch {
      // Ignorar
    }
  }, [negocio]);

  const cambiarModoVista = useCallback(
    (nuevo: "tabla" | "kanban") => {
      setModoVista(nuevo);
      try {
        localStorage.setItem(`eco_pedidos_modo_vista_${negocio.trim().toLowerCase()}`, nuevo);
      } catch {
        // Ignorar
      }
    },
    [negocio]
  );

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

  const conteosClasificacion = useMemo(() => {
    const mapa: Partial<Record<ClasificacionOperativaPedido, number>> = {};
    for (const p of pedidos) {
      const c = resolverClasificacionPedidoTienda(p);
      mapa[c] = (mapa[c] ?? 0) + 1;
    }
    return mapa;
  }, [pedidos]);

  const pedidosFiltrados = useMemo(() => {
    const base = verPapelera && esAdminEstricto ? pedidosEliminados : pedidos;
    if (filtroClasificacion === "TODOS") return base;
    return base.filter((p) => resolverClasificacionPedidoTienda(p) === filtroClasificacion);
  }, [verPapelera, esAdminEstricto, pedidosEliminados, pedidos, filtroClasificacion]);

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

    for (const def of ESTADOS_PEDIDO) {
      const itemsCol = agrupados.get(def.valor);
      if (itemsCol && itemsCol.length > 0) {
        columnas.push({ ...def, items: itemsCol });
        agrupados.delete(def.valor);
      }
    }

    // Cualquier estado adicional no listado en ESTADOS_PEDIDO que tenga pedidos
    for (const [valor, itemsCol] of agrupados.entries()) {
      if (itemsCol.length > 0) {
        const est = estiloEstado(valor);
        columnas.push({ ...est, items: itemsCol });
      }
    }

    return columnas;
  }, [pedidosFiltrados, busquedaKanban, pedidoEnfocado]);

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
                <strong style={{ color: "#111827", fontSize: "0.84rem" }}>{p.codigoOrden}</strong>
                <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                  {new Date(p.creadoEn).toLocaleString("es-EC", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1E293B" }}>
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
                  color: "#334155",
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
              <strong style={{ fontSize: "0.81rem", color: "#0F172A" }}>
                {esExeq ? `Solicita: ${p.compradorNombre}` : p.compradorNombre}
              </strong>
              {esExeq ? (
                <>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4C1D95" }}>
                    Fallecido: {fallecido || "Pendiente registrar"}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 600 }}>
                    Sala: {sala || "Por confirmar"}
                  </span>
                </>
              ) : (
                <>
                  {p.logistica.destinatarioNombre &&
                    p.logistica.destinatarioNombre !== p.compradorNombre && (
                      <span style={{ fontSize: "0.74rem", color: "#334155", fontWeight: 600 }}>
                        {esCondol ? "Destinatario / Difunto" : "Recibe"}:{" "}
                        {p.logistica.destinatarioNombre}
                      </span>
                    )}
                  <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
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
                  color: "#0F172A",
                }}
              >
                <Clock size={12} color="#0D9488" />
                <span>
                  {p.logistica.fechaEntrega || "Sin fecha"}
                  {horarioTexto ? ` · ${horarioTexto}` : ""}
                </span>
              </span>

              <span style={{ fontSize: "0.74rem", color: "#475569", lineHeight: 1.35 }}>
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
                      border: "1px solid #99F6E4",
                      background: "#F0FDFA",
                      color: "#115E59",
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
                        background: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        color: "#1E40AF",
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
              <strong style={{ fontSize: "0.85rem", color: "#111827" }}>
                {esConvenio && p.total === 0 ? "Convenio IESS" : `$${p.total.toFixed(2)}`}
              </strong>
              {typeof p.montoAbonadoUsd === "number" && p.montoAbonadoUsd > 0 && (
                <span style={{ fontSize: "0.7rem", color: "#1D4ED8", fontWeight: 700 }}>
                  Abono: ${p.montoAbonadoUsd.toFixed(2)} · Saldo: $
                  {Math.max(0, p.saldoPendienteUsd ?? p.total - p.montoAbonadoUsd).toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: "0.69rem", color: "#6B7280", textTransform: "uppercase" }}>
                {p.metodoPago}
              </span>
              {p.comprobanteTransferencia?.url && (
                <span
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    color: "#065F46",
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    borderRadius: "6px",
                    padding: "1px 6px",
                    alignSelf: "flex-start",
                  }}
                >
                  Comprobante
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "estado",
        encabezado: "Estado y Acciones",
        valor: (p) => estiloEstado(p.estado).etiqueta,
        render: (p) => {
          if (p.eliminadoEn) {
            if (!esAdminEstricto) return null;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: "7px",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
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
                      border: "1px solid #10B981",
                      background: "#ECFDF5",
                      color: "#065F46",
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
                      background: "#DC2626",
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

          const est = estiloEstado(p.estado);
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
                {ESTADOS_PEDIDO.map((op) => (
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
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
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
                          ? "1px solid #F59E0B"
                          : editadaCliente
                            ? "1.5px solid #D97706"
                            : "1px solid #0284C7",
                      background:
                        impresiones > 0 ? "#FEF3C7" : editadaCliente ? "#FEF3C7" : "#F0F9FF",
                      color:
                        impresiones > 0 ? "#92400E" : editadaCliente ? "#92400E" : "#0369A1",
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
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      color: "#B91C1C",
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
    ]
  );

  const totalVentas = pedidosFiltrados.reduce((acc, p) => acc + p.total, 0);
  const totalEnvios = pedidosFiltrados.reduce((acc, p) => acc + p.costoEnvio, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Resumen superior */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#F0FDFA",
              border: "1px solid #99F6E4",
              color: "#0F766E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClipboardList size={20} />
          </div>
          <div>
            <strong style={{ fontSize: "0.96rem", color: "#111827" }}>
              Historial Permanente de Pedidos ({pedidosFiltrados.length})
            </strong>
            <div style={{ fontSize: "0.78rem", color: "#6B7280" }}>
              Ventas acumuladas: <strong>${totalVentas.toFixed(2)}</strong> · Recaudado en transporte:{" "}
              <strong>${totalEnvios.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <a
            href="/panel/envio-pedidos"
            title="Ir a validación, calendario y envío diario de pedidos a Taller"
            aria-label="Enviar Pedidos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 13px",
              borderRadius: "8px",
              background: "#0F172A",
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <span>Enviar a Taller</span>
          </a>

          <a
            href="/panel/taller"
            title="Abrir pantalla de producción del Taller"
            aria-label="Ver Taller"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 13px",
              borderRadius: "8px",
              border: "1px solid #86EFAC",
              background: "#ECFDF5",
              color: "#065F46",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <span>Taller</span>
          </a>

          <a
            href="/panel/entregas"
            title="Abrir consola de confirmación fotográfica de entregas e informes IESS"
            aria-label="Entregas GPS"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 13px",
              borderRadius: "8px",
              border: "1px solid #99F6E4",
              background: "#F0FDFA",
              color: "#115E59",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <Camera size={14} />
            <span>Entregas GPS</span>
          </a>

          <button
            type="button"
            onClick={() => void cargarPedidos()}
            disabled={cargando}
            title="Actualizar historial permanente de pedidos"
            aria-label="Actualizar"
            className="btn-responsive-accion"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #D4D4D8",
              background: "#FFFFFF",
              color: "#18181B",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: cargando ? "wait" : "pointer",
            }}
          >
            {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Barra profesional de Clasificación Operativa */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <BarraFiltroClasificacionPedido
          seleccionada={filtroClasificacion}
          onSeleccionar={setFiltroClasificacion}
          conteos={conteosClasificacion}
          totalGeneral={pedidos.length}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div
            role="group"
            aria-label="Modo de visualización"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px",
              borderRadius: "999px",
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              gap: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => cambiarModoVista("tabla")}
              title="Vista de tabla detallada con exportación Excel/CSV"
              aria-label="Modo Tabla"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 11px",
                borderRadius: "999px",
                border: "none",
                background: modoVista === "tabla" ? "#0F172A" : "transparent",
                color: modoVista === "tabla" ? "#FFFFFF" : "#475569",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Table2 size={13} />
              <span>Tabla</span>
            </button>
            <button
              type="button"
              onClick={() => cambiarModoVista("kanban")}
              title="Tablero Kanban por estado (oculta columnas vacías)"
              aria-label="Modo Kanban"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 11px",
                borderRadius: "999px",
                border: "none",
                background: modoVista === "kanban" ? "#0F172A" : "transparent",
                color: modoVista === "kanban" ? "#FFFFFF" : "#475569",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Columns3 size={13} />
              <span>Kanban</span>
            </button>
          </div>

          {esAdminEstricto && (
            <button
              type="button"
              onClick={() => setVerPapelera((prev) => !prev)}
              title="Ver pedidos eliminados lógicamente por el equipo (solo Administrador)"
              aria-label="Papelera de Pedidos"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "999px",
                border: verPapelera ? "1px solid #DC2626" : "1px solid #FECACA",
                background: verPapelera ? "#DC2626" : "#FEF2F2",
                color: verPapelera ? "#FFFFFF" : "#991B1B",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              <span>
                {verPapelera
                  ? `Viendo Papelera (${pedidosEliminados.length}) · Volver`
                  : `Papelera (${pedidosEliminados.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#B91C1C",
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
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E3A8A",
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
              border: "1px solid #93C5FD",
              background: "#FFFFFF",
              color: "#1D4ED8",
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
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "clamp(10px, 2.5vw, 16px)",
          minWidth: 0,
        }}
      >
        {modoVista === "kanban" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  position: "relative",
                  flex: "1 1 260px",
                  maxWidth: "420px",
                }}
              >
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="search"
                  value={busquedaKanban}
                  onChange={(e) => setBusquedaKanban(e.target.value)}
                  placeholder="Buscar en Kanban por código, cliente, fallecido, sala o producto..."
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    borderRadius: "9px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.81rem",
                    color: "#0F172A",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
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
                  padding: "36px 16px",
                  textAlign: "center",
                  color: "#64748B",
                  fontSize: "0.86rem",
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px dashed #CBD5E1",
                }}
              >
                No hay pedidos disponibles en esta vista o filtro.
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
                        background: esDropHover ? "#EFF6FF" : "#F8FAFC",
                        border: esDropHover ? "2px dashed #3B82F6" : "1px solid #E2E8F0",
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
                                    ? "1.5px solid #3B82F6"
                                    : "1px solid #E2E8F0",
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
                                <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>
                                  {p.codigoOrden}
                                </strong>
                                <InsigniaClasificacionPedido
                                  clasificacion={clasif}
                                  sufijoTexto={sala}
                                  compacto
                                />
                              </div>

                              <div style={{ fontSize: "0.78rem", color: "#1E293B", fontWeight: 600 }}>
                                {p.items.map((it) => `${it.cantidad}× ${it.descripcion}`).join(" + ") ||
                                  "Arreglo floral"}
                              </div>

                              <div style={{ fontSize: "0.74rem", color: "#475569", lineHeight: 1.35 }}>
                                <div>
                                  <strong>Solicita:</strong> {solicita}
                                </div>
                                {esExeq && fallecido ? (
                                  <div style={{ color: "#581C87" }}>
                                    <strong>Fallecido:</strong> {fallecido}
                                  </div>
                                ) : fallecido && fallecido !== solicita ? (
                                  <div>
                                    <strong>Para:</strong> {fallecido}
                                  </div>
                                ) : null}
                                {sala ? (
                                  <div style={{ color: "#6B21A8", fontWeight: 600 }}>
                                    Sala: {sala}
                                  </div>
                                ) : p.logistica.direccion ? (
                                  <div style={{ color: "#64748B" }}>
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
                                  color: "#0F766E",
                                  background: "#F0FDFA",
                                  padding: "4px 7px",
                                  borderRadius: "6px",
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>
                                  🕒 {p.logistica.fechaEntrega || "Hoy"} · {horaMostrar}
                                </span>
                                <strong style={{ color: "#0F172A" }}>
                                  {esExeq ? "IESS" : `$${p.total.toFixed(2)}`}
                                </strong>
                              </div>

                              {p.eliminadoEn && esAdminEstricto ? (
                                <div
                                  style={{
                                    padding: "5px 7px",
                                    borderRadius: "6px",
                                    background: "#FEF2F2",
                                    border: "1px solid #FECACA",
                                    color: "#991B1B",
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
                                    border: "1px solid #CBD5E1",
                                    background: col.colorFondo,
                                    color: col.colorTexto,
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {ESTADOS_PEDIDO.map((op) => (
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
                                        border: "1px solid #10B981",
                                        background: "#ECFDF5",
                                        color: "#065F46",
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
                                        background: "#DC2626",
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
                                          border: "1px solid #A7F3D0",
                                          background: "#ECFDF5",
                                          color: "#065F46",
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
                                        border: "1px solid #CBD5E1",
                                        background: "#FFFFFF",
                                        color: "#334155",
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
                                              ? "1px solid #F59E0B"
                                              : "1px solid #0284C7",
                                          background: impresiones > 0 ? "#FEF3C7" : "#F0F9FF",
                                          color: impresiones > 0 ? "#92400E" : "#0369A1",
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
                                          border: "1px solid #FECACA",
                                          background: "#FEF2F2",
                                          color: "#B91C1C",
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
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                }}
              >
                {/* 1. Auditoría Interna de Logística, Sala y Dirección */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0F172A" }}>
                      <Truck size={15} color="#0D9488" />
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
                          border: "1px solid #0284C7",
                          background: "#F0F9FF",
                          color: "#0369A1",
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

                  <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.48 }}>
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
                      <div style={{ fontSize: "0.74rem", color: "#0F766E" }}>
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

                    {!esExeq && typeof p.logistica.distanciaVialKm === "number" && (
                      <div>
                        <strong>Distancia vial calculada:</strong>{" "}
                        {p.logistica.distanciaVialKm.toFixed(2)} km
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "6px",
                        padding: "7px 9px",
                        borderRadius: "7px",
                        background: esExeq ? "#F5F3FF" : "#F0FDF4",
                        border: `1px solid ${esExeq ? "#DDD6FE" : "#BBF7D0"}`,
                        color: esExeq ? "#4C1D95" : "#166534",
                        fontSize: "0.75rem",
                      }}
                    >
                      <strong>Registro interno:</strong> {p.logistica.formulaCalculoInterno}
                    </div>
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
                          background: "#18181B",
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
                    border: "1px solid #E2E8F0",
                    borderRadius: "9px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0F172A" }}>
                    <PackageCheck size={15} color="#2563EB" />
                    <strong style={{ fontSize: "0.82rem" }}>
                      {esExeq
                        ? `Detalle del Servicio Exequial (${p.items.length})`
                        : `Detalle del Producto y Dedicatorias (${p.items.length})`}
                    </strong>
                  </div>

                  {p.items.map((it, idx) => (
                    <div
                      key={`${p.id}-it-${idx}`}
                      style={{
                        borderTop: idx === 0 ? "none" : "1px solid #F1F5F9",
                        paddingTop: idx === 0 ? 0 : "6px",
                        fontSize: "0.78rem",
                        color: "#1E293B",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <strong>
                          {it.cantidad}× {it.descripcion}
                        </strong>
                        {it.totalLinea > 0 && <span>${it.totalLinea.toFixed(2)}</span>}
                      </div>
                      {it.dedicatoria?.mensaje && (
                        <div
                          style={{
                            marginTop: "3px",
                            fontSize: "0.73rem",
                            color: "#475569",
                            background: "#FFFBEB",
                            border: "1px solid #FDE68A",
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
                  ))}

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
                          background: "#FFFBEB",
                          border: "1px solid #FDE68A",
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
                          <strong style={{ fontSize: "0.77rem", color: "#92400E" }}>
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
                                  background: "#0F172A",
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
                                background: editCli ? "#DCFCE7" : editStaff ? "#DBEAFE" : "#FEF3C7",
                                color: editCli ? "#166534" : editStaff ? "#1E40AF" : "#92400E",
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
                                  background: "#E0F2FE",
                                  color: "#0369A1",
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
                                  background: "#FDE68A",
                                  color: "#78350F",
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
                                  background: "#F3E8FF",
                                  color: "#6B21A8",
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

                        <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                          {msgTarj ? (
                            <>
                              &ldquo;{msgTarj}&rdquo;
                              {!esCondolTarj && p.tarjeta?.musicaTitulo ? (
                                <span style={{ display: "block", fontSize: "0.7rem", color: "#6B21A8", marginTop: "2px" }}>
                                  🎵 {p.tarjeta.musicaTitulo}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span style={{ fontStyle: "italic", color: "#94A3B8" }}>
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
                              background: "#0284C7",
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
                                border: "1px solid #99F6E4",
                                background: "#F0FDFA",
                                color: "#0F766E",
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
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#0F172A",
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
                      borderTop: "1px solid #E2E8F0",
                      fontSize: "0.75rem",
                      color: "#475569",
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
                          background: "#FDF2F8",
                          border: "1px solid #FBCFE8",
                          color: "#9D174D",
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
                        <strong>Facturación SRI:</strong> {p.compradorNombre} · ID:{" "}
                        {p.compradorIdentificacion || "—"} · {p.compradorCorreo || "—"}
                        {p.autorizaWhatsapp ? " · ✓ LOPDP WhatsApp" : ""}
                      </div>
                    )}

                    {p.comprobanteTransferencia?.url && (
                      <div
                        style={{
                          padding: "9px 11px",
                          borderRadius: "8px",
                          background: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          color: "#065F46",
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
                          <strong>
                            Comprobante adjunto:{" "}
                            {p.comprobanteTransferencia.nombreArchivo || "Archivo"}
                          </strong>
                          <a
                            href={p.comprobanteTransferencia.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={p.comprobanteTransferencia.nombreArchivo || "comprobante"}
                            title="Ver o descargar comprobante de transferencia subido por el cliente"
                            aria-label="Ver Comprobante"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "#047857",
                              color: "#FFFFFF",
                              textDecoration: "none",
                              fontSize: "0.73rem",
                              fontWeight: 700,
                            }}
                          >
                            <span>Ver Comprobante</span>
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
                              border: "1px solid #6EE7B7",
                              background: "#FFFFFF",
                            }}
                          />
                        )}
                      </div>
                    )}

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
                            background: "#BE185D",
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
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: "#0F172A",
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
                            background: "#059669",
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
                    border: "1px solid #E2E8F0",
                    borderRadius: "9px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0F172A" }}>
                    <Camera size={15} color="#0D9488" />
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
                          border: "1px solid #CBD5E1",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#0F172A",
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

                      <div style={{ fontSize: "0.75rem", color: "#334155", lineHeight: 1.42 }}>
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
                            background: "#0F172A",
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
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                textDecoration: "none",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                              }}
                            >
                              <MapPin size={13} color="#0D9488" />
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
                        border: "1px dashed #CBD5E1",
                        background: "#F8FAFC",
                        fontSize: "0.76rem",
                        color: "#64748B",
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
                          background: "#0D9488",
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
          onActualizarOrden={() => {
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
                <strong style={{ fontSize: "1rem", color: "#0F172A" }}>
                  ✏️ Editar Datos del Pedido ({formEdicionPedido.pedidoBase.codigoOrden})
                </strong>
                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
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
                  background: "#F1F5F9",
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
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  padding: "8px 11px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#B91C1C",
                }}
              >
                {errorModalEdicion}
              </div>
            )}

            {/* 1. TIPO / CLASIFICACIÓN DE PEDIDO */}
            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
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
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
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
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
                />
              </div>

              {formEdicionPedido.clasificacionPedido === "EXEQUIALES" ? (
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#4C1D95", marginBottom: "3px" }}>
                    Sala Exequiales
                  </label>
                  <SelectConBuscador
                    value={formEdicionPedido.salaServicio}
                    onChange={(e) =>
                      setFormEdicionPedido((prev) =>
                        prev ? { ...prev, salaServicio: e.target.value } : null
                      )
                    }
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
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
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
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
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem" }}
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
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#0F766E", marginBottom: "3px" }}>
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
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #0D9488", fontSize: "0.84rem", fontWeight: 700, boxSizing: "border-box" }}
                    />
                  </div>
                )}
              </div>
            ) : (
              formEdicionPedido.modoHorario === "HORA_EXACTA" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#0F766E", marginBottom: "3px" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #0D9488", fontSize: "0.84rem", fontWeight: 700, boxSizing: "border-box" }}
                  />
                </div>
              )
            )}

            {/* 3. COMPRADOR / QUIÉN SOLICITA (+ TELÉFONO EXCEPTO EN EXEQUIALES) */}
            {formEdicionPedido.clasificacionPedido === "EXEQUIALES" ? (
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
                />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
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
                      ? "#4C1D95"
                      : "#334155",
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
                      ? "1.5px solid #8B5CF6"
                      : "1px solid #CBD5E1",
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
                    <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "#334155" }}>
                      Dirección de Entrega
                    </label>
                    <label style={{ fontSize: "0.74rem", color: "#475569", display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "#334155" }}>
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
                        color: "#0284C7",
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
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: "3px" }}>
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
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setFormEdicionPedido(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#475569",
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
                  background: "#059669",
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
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#991B1B" }}>
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
                  color: "#64748B",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: "9px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                fontSize: "0.82rem",
                color: "#334155",
              }}
            >
              <strong>{pedidoAEliminar.compradorNombre}</strong>
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "3px" }}>
                {pedidoAEliminar.items.map((it) => `${it.cantidad}x ${it.descripcion}`).join(", ")} · $
                {pedidoAEliminar.total.toFixed(2)}
              </div>
            </div>

            {pedidoAEliminar.eliminadoEn ? (
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#991B1B", lineHeight: 1.45 }}>
                Esta acción eliminará el registro de forma <strong>permanente e irreversible</strong>{" "}
                de la base de datos.
              </p>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: "0.81rem", color: "#475569", lineHeight: 1.45 }}>
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
                      color: "#334155",
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
                      border: "1px solid #CBD5E1",
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
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
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
                    border: "1px solid #FCA5A5",
                    background: esAdminEstricto ? "#FEF2F2" : "#DC2626",
                    color: esAdminEstricto ? "#991B1B" : "#FFFFFF",
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
                    background: "#DC2626",
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
    </div>
  );
}
