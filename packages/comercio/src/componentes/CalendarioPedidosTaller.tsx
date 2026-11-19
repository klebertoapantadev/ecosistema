"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Hammer,
  MapPin,
  Send,
  Trash2,
} from "lucide-react";
import {
  esEntregaConfirmadaOrden,
  esPedidoDeElaboracionEnFecha,
  formatearFechaEntregaHumana,
  formatearHorarioEntregaOrden,
  generarCuadriculaMesCalendario,
  inferirClasificacionPedido,
  inferirFranjaDesdeHoraExacta,
  normalizarFranjaHorariaTienda,
  obtenerDefinicionClasificacionPedido,
  obtenerFechaHoyEcuadorYmd,
  obtenerRangoSemanaLunesADomingo,
  sumarDiasYmd,
  type ClasificacionOperativaPedido,
  type EstadoOrdenTaller,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";
import {
  BarraFiltroClasificacionPedido,
  IconoClasificacionPedido,
  InsigniaClasificacionPedido,
  ModalVisorEvidenciaEntrega,
  type DatosVisorEvidenciaModal,
} from "./InsigniaClasificacionPedido";

export type VistaCalendarioPedidos = "hoy" | "semana" | "mes";

export interface PropsCalendarioPedidosTaller {
  ordenes: OrdenTrabajoTaller[];
  modo: "despacho" | "taller";
  vistaInicial?: VistaCalendarioPedidos;
  onEnviarATaller?: (orden: OrdenTrabajoTaller) => void;
  onCambiarEstadoTaller?: (orden: OrdenTrabajoTaller, nuevoEstado: EstadoOrdenTaller) => void;
  onEditarOrden?: (orden: OrdenTrabajoTaller) => void;
  onEliminarOrden?: (orden: OrdenTrabajoTaller) => void;
  idProcesando?: string | null;
}

const NOMBRES_DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function badgeEstadoTaller(estado: EstadoOrdenTaller): {
  etiqueta: string;
  fondo: string;
  borde: string;
  color: string;
} {
  switch (estado) {
    case "PENDIENTE_ENVIO":
      return {
        etiqueta: "Por enviar",
        fondo: "#FAF6EE",
        borde: "#E5D7BC",
        color: "#745622",
      };
    case "ENVIADO_TALLER":
      return {
        etiqueta: "En Taller",
        fondo: "#EFECE6",
        borde: "#DDD8CE",
        color: "#3A3530",
      };
    case "EN_PREPARACION":
      return {
        etiqueta: "En preparación",
        fondo: "#F5EFE3",
        borde: "#E5D7BC",
        color: "#745622",
      };
    case "LISTO_ENTREGA":
      return {
        etiqueta: "Listo entrega",
        fondo: "#F2F6F3",
        borde: "#CEDDD3",
        color: "#2F4737",
      };
    case "ENTREGADO":
      return {
        etiqueta: "Confirmado",
        fondo: "#E6E2DA",
        borde: "#D5CFC4",
        color: "#57524C",
      };
    default:
      return {
        etiqueta: estado,
        fondo: "#F4F2EE",
        borde: "#E6E2DA",
        color: "#847D74",
      };
  }
}

function resolverClasificacionOrden(o: OrdenTrabajoTaller): ClasificacionOperativaPedido {
  return inferirClasificacionPedido({
    clasificacionExplicita: o.clasificacionPedido,
    origenTipo: o.origenTipo,
    retiroEnLocal: o.retiroEnLocal,
    salaServicio: o.salaServicio,
    productoResumen: o.productoResumen,
    ubicacionEntrega: o.ubicacionEntrega,
    metodoPago: o.metodoPago,
    tarjetaTipo: o.tarjetaTipo,
    items: o.items,
  });
}

function abrirDatosEvidenciaDesdeOrden(o: OrdenTrabajoTaller): DatosVisorEvidenciaModal {
  const clasif = resolverClasificacionOrden(o);
  return {
    codigo: o.codigo,
    clasificacion: clasif,
    productoResumen: o.productoResumen,
    quienSolicita: o.clienteSolicita,
    destinatarioFallecido: o.destinatarioFallecido,
    salaServicio: o.salaServicio,
    fechaEntrega: o.fechaEntrega,
    horaEntrega: o.horaEspecifica || o.franjaHoraria,
    direccionEntrega: o.retiroEnLocal
      ? "Retiro en Tienda"
      : o.evidenciaDireccionGps || o.ubicacionEntrega || null,
    entregadoEn: o.entregadoEn,
    entregadorNombre: o.entregadoPorNombre || o.repartidorNombre,
    fotoUrl: o.evidenciaFotoUrl,
    mapaUrl: o.evidenciaMapaUrl,
    latitud: o.evidenciaLatitud ?? o.rutaLatitud,
    longitud: o.evidenciaLongitud ?? o.rutaLongitud,
    numeroInforme: o.numeroInforme,
  };
}

export function CalendarioPedidosTaller({
  ordenes,
  modo,
  vistaInicial = "hoy",
  onEnviarATaller,
  onCambiarEstadoTaller,
  onEditarOrden,
  onEliminarOrden,
  idProcesando = null,
}: PropsCalendarioPedidosTaller) {
  const hoyYmd = useMemo(() => obtenerFechaHoyEcuadorYmd(), []);
  const [vista, setVista] = useState<VistaCalendarioPedidos>(vistaInicial);
  const [fechaCursor, setFechaCursor] = useState<string>(hoyYmd);
  const [filtroClasificacion, setFiltroClasificacion] = useState<
    ClasificacionOperativaPedido | "TODOS"
  >("TODOS");
  const [mostrarConfirmadas, setMostrarConfirmadas] = useState<boolean>(true);
  const [visorEvidencia, setVisorEvidencia] = useState<DatosVisorEvidenciaModal | null>(null);

  const [anioCursor, mesCursor] = useMemo(() => {
    const [y, m] = (fechaCursor || hoyYmd).split("-").map((n) => Number(n));
    return [y || 2026, m || 11];
  }, [fechaCursor, hoyYmd]);

  const ordenesValidas = useMemo(
    () => ordenes.filter((o) => o.estadoTaller !== "ANULADO"),
    [ordenes]
  );

  const conteosClasificacion = useMemo(() => {
    const mapa: Partial<Record<ClasificacionOperativaPedido, number>> = {};
    for (const o of ordenesValidas) {
      if (!mostrarConfirmadas && esEntregaConfirmadaOrden(o)) continue;
      const c = resolverClasificacionOrden(o);
      mapa[c] = (mapa[c] ?? 0) + 1;
    }
    return mapa;
  }, [ordenesValidas, mostrarConfirmadas]);

  const totalConfirmadasGlobal = useMemo(
    () => ordenesValidas.filter((o) => esEntregaConfirmadaOrden(o)).length,
    [ordenesValidas]
  );

  const ordenesFiltradas = useMemo(() => {
    return ordenesValidas.filter((o) => {
      const confirmada = esEntregaConfirmadaOrden(o);
      if (!mostrarConfirmadas && confirmada) return false;
      if (filtroClasificacion !== "TODOS") {
        return resolverClasificacionOrden(o) === filtroClasificacion;
      }
      return true;
    });
  }, [ordenesValidas, mostrarConfirmadas, filtroClasificacion]);

  const ordenesPorFechaEntrega = useMemo(() => {
    const mapa = new Map<string, OrdenTrabajoTaller[]>();
    for (const o of ordenesFiltradas) {
      const f = (o.fechaEntrega || hoyYmd).slice(0, 10);
      const lista = mapa.get(f) ?? [];
      lista.push(o);
      mapa.set(f, lista);
    }
    // Ordenar en cada día: primero pendientes (Exequiales primero), al final las ya confirmadas (tono opaco)
    for (const [k, lista] of mapa.entries()) {
      lista.sort((a, b) => {
        const confA = esEntregaConfirmadaOrden(a) ? 1 : 0;
        const confB = esEntregaConfirmadaOrden(b) ? 1 : 0;
        if (confA !== confB) return confA - confB;
        const exA = resolverClasificacionOrden(a) === "EXEQUIALES" ? 0 : 1;
        const exB = resolverClasificacionOrden(b) === "EXEQUIALES" ? 0 : 1;
        if (exA !== exB) return exA - exB;
        return String(a.horaEspecifica || a.franjaHoraria || "").localeCompare(
          String(b.horaEspecifica || b.franjaHoraria || "")
        );
      });
      mapa.set(k, lista);
    }
    return mapa;
  }, [ordenesFiltradas, hoyYmd]);

  const ordenesElaboracionDiaSeleccionado = useMemo(() => {
    const lista = ordenesFiltradas.filter((o) =>
      esPedidoDeElaboracionEnFecha(o, fechaCursor, hoyYmd)
    );
    return lista.sort((a, b) => {
      const confA = esEntregaConfirmadaOrden(a) ? 1 : 0;
      const confB = esEntregaConfirmadaOrden(b) ? 1 : 0;
      if (confA !== confB) return confA - confB;
      return 0;
    });
  }, [ordenesFiltradas, fechaCursor, hoyYmd]);

  const semanaActual = useMemo(
    () => obtenerRangoSemanaLunesADomingo(fechaCursor),
    [fechaCursor]
  );

  const celdasMes = useMemo(
    () => generarCuadriculaMesCalendario(anioCursor, mesCursor),
    [anioCursor, mesCursor]
  );

  const navegarAnterior = () => {
    if (vista === "hoy") {
      setFechaCursor((prev) => sumarDiasYmd(prev, -1));
    } else if (vista === "semana") {
      setFechaCursor((prev) => sumarDiasYmd(prev, -7));
    } else {
      const mNuevo = mesCursor === 1 ? 12 : mesCursor - 1;
      const yNuevo = mesCursor === 1 ? anioCursor - 1 : anioCursor;
      setFechaCursor(`${yNuevo}-${String(mNuevo).padStart(2, "0")}-01`);
    }
  };

  const navegarSiguiente = () => {
    if (vista === "hoy") {
      setFechaCursor((prev) => sumarDiasYmd(prev, 1));
    } else if (vista === "semana") {
      setFechaCursor((prev) => sumarDiasYmd(prev, 7));
    } else {
      const mNuevo = mesCursor === 12 ? 1 : mesCursor + 1;
      const yNuevo = mesCursor === 12 ? anioCursor + 1 : anioCursor;
      setFechaCursor(`${yNuevo}-${String(mNuevo).padStart(2, "0")}-01`);
    }
  };

  const renderTarjetaCompacta = (o: OrdenTrabajoTaller, mostrarFechaEntregaExplicita = false) => {
    const clasif = resolverClasificacionOrden(o);
    const defCat = obtenerDefinicionClasificacionPedido(clasif);
    const confirmada = esEntregaConfirmadaOrden(o);
    const esExeq = clasif === "EXEQUIALES";
    const est = badgeEstadoTaller(confirmada ? "ENTREGADO" : o.estadoTaller);
    const procesando = idProcesando === o.id;
    const entregaDistinta = (o.fechaEntrega || "").slice(0, 10) !== fechaCursor;

    const acentoIzq = confirmada ? defCat.acentoOpacoHex : defCat.acentoHex;
    const fondoTarjeta = confirmada ? defCat.fondoOpacoHex : "#FFFFFF";
    const bordeTarjeta = confirmada ? defCat.bordeOpacoHex : defCat.bordeHex;

    return (
      <div
        key={o.id}
        style={{
          background: fondoTarjeta,
          borderTop: `1px solid ${bordeTarjeta}`,
          borderRight: `1px solid ${bordeTarjeta}`,
          borderBottom: `1px solid ${bordeTarjeta}`,
          borderLeft: `4px solid ${acentoIzq}`,
          borderRadius: "10px",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          opacity: confirmada ? 0.72 : 1,
          boxShadow: confirmada ? "none" : "0 1px 3px rgba(15, 23, 42, 0.05)",
          transition: "opacity 0.15s ease",
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
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
            <strong
              style={{
                fontSize: "0.81rem",
                color: confirmada ? "#57524C" : "#1F1C19",
              }}
            >
              {o.codigo}
            </strong>

            <InsigniaClasificacionPedido
              clasificacion={clasif}
              opaco={confirmada}
              compacto
              sufijoTexto={esExeq && o.salaServicio ? o.salaServicio : null}
            />

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 7px",
                borderRadius: "6px",
                fontSize: "0.67rem",
                fontWeight: 700,
                background: est.fondo,
                border: `1px solid ${est.borde}`,
                color: est.color,
              }}
            >
              {confirmada && <CheckCircle2 size={11} color="#2F4737" />}
              <span>{est.etiqueta}</span>
            </span>
          </div>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: confirmada ? "#847D74" : "#57524C",
            }}
          >
            <Clock size={11} />
            <span>
              {formatearHorarioEntregaOrden({
                franjaHoraria: o.franjaHoraria,
                horaEspecifica: o.horaEspecifica,
                esExequiales: esExeq,
              })}
            </span>
          </span>
        </div>

        <div
          style={{
            fontSize: "0.83rem",
            fontWeight: 700,
            color: confirmada ? "#57524C" : "#221E1B",
            textDecoration: confirmada ? "none" : "none",
          }}
        >
          {o.productoResumen}
        </div>

        <div
          style={{
            fontSize: "0.74rem",
            color: confirmada ? "#847D74" : "#57524C",
            lineHeight: 1.42,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {esExeq ? (
            <>
              <div>
                <strong>Solicita:</strong> {o.clienteSolicita || "—"}
                {o.salaServicio ? ` · Sala: ${o.salaServicio}` : ""}
              </div>
              <div>
                <strong>Fallecido:</strong> {o.destinatarioFallecido || "Pendiente registrar"}
              </div>
            </>
          ) : (
            <div>
              <strong>Solicita:</strong> {o.clienteSolicita || "—"} ·{" "}
              <strong>Recibe:</strong> {o.destinatarioFallecido || o.clienteSolicita}
            </div>
          )}

          {!esExeq && (o.retiroEnLocal || o.ubicacionEntrega) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <MapPin size={11} style={{ flexShrink: 0 }} />
              <span>
                {o.retiroEnLocal ? "Retiro en Tienda" : o.ubicacionEntrega}
              </span>
            </div>
          )}
        </div>

        {(mostrarFechaEntregaExplicita || entregaDistinta) && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "2px 8px",
              borderRadius: "6px",
              background: confirmada ? "#E6E2DA" : entregaDistinta ? "#F4F2EE" : "#F2F6F3",
              border: `1px solid ${
                confirmada ? "#D5CFC4" : entregaDistinta ? "#DDD8CE" : "#CEDDD3"
              }`,
              color: confirmada ? "#57524C" : entregaDistinta ? "#221E1B" : "#2F4737",
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            {entregaDistinta
              ? `Elaborar hoy → Entrega: ${formatearFechaEntregaHumana(o.fechaEntrega, hoyYmd).etiquetaPrincipal}`
              : `Entrega: ${formatearFechaEntregaHumana(o.fechaEntrega, hoyYmd).etiquetaPrincipal}`}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "2px" }}>
          {confirmada && (
            <button
              type="button"
              onClick={() => setVisorEvidencia(abrirDatosEvidenciaDesdeOrden(o))}
              title="Ver ficha permanente y fotografía de confirmación de entrega"
              aria-label="Ver Evidencia"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 9px",
                borderRadius: "6px",
                border: "1px solid #847D74",
                background: "#FFFFFF",
                color: "#57524C",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Camera size={12} color="#2F4737" />
              <span>{o.evidenciaFotoUrl ? "Ver Foto" : "Detalle Entrega"}</span>
            </button>
          )}

          {modo === "despacho" &&
            !confirmada &&
            o.estadoTaller === "PENDIENTE_ENVIO" &&
            onEnviarATaller && (
              <button
                type="button"
                disabled={procesando}
                onClick={() => onEnviarATaller(o)}
                title="Validar y enviar este pedido al Taller ahora"
                aria-label="Enviar a Taller"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border: "none",
                  background: "#1F1C19",
                  color: "#FFFFFF",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  cursor: procesando ? "wait" : "pointer",
                }}
              >
                <Send size={12} />
                <span>A Taller</span>
              </button>
            )}

          {modo === "taller" && !confirmada && onCambiarEstadoTaller && (
            <>
              <button
                type="button"
                disabled={procesando || o.estadoTaller === "EN_PREPARACION"}
                onClick={() => onCambiarEstadoTaller(o, "EN_PREPARACION")}
                title="Marcar pedido como En preparación en mesa de armado"
                aria-label="En Preparación"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border:
                    o.estadoTaller === "EN_PREPARACION"
                      ? "1.5px solid #745622"
                      : "1px solid #D5CFC4",
                  background: o.estadoTaller === "EN_PREPARACION" ? "#F5EFE3" : "#FFFFFF",
                  color: o.estadoTaller === "EN_PREPARACION" ? "#745622" : "#57524C",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  cursor: procesando ? "wait" : "pointer",
                }}
              >
                <Hammer size={12} />
                <span>Preparación</span>
              </button>

              <button
                type="button"
                disabled={procesando || o.estadoTaller === "LISTO_ENTREGA"}
                onClick={() => onCambiarEstadoTaller(o, "LISTO_ENTREGA")}
                title="Marcar arreglo como Listo para entrega"
                aria-label="Listo Entrega"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border: "none",
                  background: o.estadoTaller === "LISTO_ENTREGA" ? "#2F4737" : "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  cursor: procesando ? "wait" : "pointer",
                }}
              >
                <CheckCircle2 size={12} />
                <span>Listo</span>
              </button>
            </>
          )}

          {onEditarOrden && (
            <button
              type="button"
              onClick={() => onEditarOrden(o)}
              title="Editar clasificación, fecha, sala o detalles del pedido"
              aria-label="Editar Pedido"
              style={{
                padding: "4px 9px",
                borderRadius: "6px",
                border: "1px solid #D5CFC4",
                background: "#F8F7F4",
                color: "#57524C",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Editar
            </button>
          )}

          {modo === "despacho" && onEliminarOrden && (
            <button
              type="button"
              onClick={() => onEliminarOrden(o)}
              title="Eliminar pedido"
              aria-label="Eliminar Pedido"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 9px",
                borderRadius: "6px",
                border: "1px solid #E5CACA",
                background: "#FAF2F2",
                color: "#8A2E2E",
                fontSize: "0.72rem",
                fontWeight: 600,
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
  };

  // Agrupar la vista HOY por bloques horarios de elaboración y entregas confirmadas
  const bloquesHoy = useMemo(() => {
    const exequiales: OrdenTrabajoTaller[] = [];
    const franjaA: OrdenTrabajoTaller[] = [];
    const franjaB: OrdenTrabajoTaller[] = [];
    const franjaC: OrdenTrabajoTaller[] = [];
    const anticipadosFuturos: OrdenTrabajoTaller[] = [];
    const confirmadosDia: OrdenTrabajoTaller[] = [];

    for (const o of ordenesElaboracionDiaSeleccionado) {
      if (esEntregaConfirmadaOrden(o)) {
        confirmadosDia.push(o);
        continue;
      }
      if ((o.fechaEntrega || "").slice(0, 10) > fechaCursor) {
        anticipadosFuturos.push(o);
        continue;
      }
      if (resolverClasificacionOrden(o) === "EXEQUIALES") {
        exequiales.push(o);
        continue;
      }
      const norm = o.horaEspecifica
        ? inferirFranjaDesdeHoraExacta(o.horaEspecifica)
        : normalizarFranjaHorariaTienda(o.franjaHoraria);
      if (norm.startsWith("A)")) franjaA.push(o);
      else if (norm.startsWith("B)")) franjaB.push(o);
      else franjaC.push(o);
    }

    return [
      {
        id: "exeq",
        titulo: "Exequiales / Hora Puntual",
        colorBorde: "#DDD8CE",
        fondo: "#F4F2EE",
        items: exequiales,
      },
      {
        id: "a",
        titulo: "Franja A · 09:00 – 13:00",
        colorBorde: "#DDD8CE",
        fondo: "#F4F2EE",
        items: franjaA,
      },
      {
        id: "b",
        titulo: "Franja B · 13:00 – 17:00",
        colorBorde: "#E5D7BC",
        fondo: "#FAF6EE",
        items: franjaB,
      },
      {
        id: "c",
        titulo: "Franja C · 17:00 – 20:00",
        colorBorde: "#DDD8CE",
        fondo: "#F4F2EE",
        items: franjaC,
      },
      {
        id: "fut",
        titulo: "Elaboración Anticipada (Entregas Futuras)",
        colorBorde: "#CEDDD3",
        fondo: "#F2F6F3",
        items: anticipadosFuturos,
      },
      {
        id: "conf",
        titulo: "Entregas Confirmadas en la Fecha",
        colorBorde: "#D5CFC4",
        fondo: "#F8F7F4",
        items: confirmadosDia,
      },
    ];
  }, [ordenesElaboracionDiaSeleccionado, fechaCursor]);

  const ordenesFechaSeleccionadaMes = ordenesPorFechaEntrega.get(fechaCursor) ?? [];
  const pendientesMesSel = ordenesFechaSeleccionadaMes.filter(
    (x) => !esEntregaConfirmadaOrden(x)
  ).length;
  const confirmadasMesSel = ordenesFechaSeleccionadaMes.length - pendientesMesSel;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E6E2DA",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Barra superior del Calendario */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Calendar size={18} color="#2F4737" />
          <strong style={{ fontSize: "0.96rem", color: "#1F1C19" }}>
            {vista === "hoy"
              ? `Agenda Operativa — ${formatearFechaEntregaHumana(fechaCursor, hoyYmd).etiquetaPrincipal}`
              : vista === "semana"
                ? `Semana: ${formatearFechaEntregaHumana(semanaActual.inicioLunes, hoyYmd).etiquetaPrincipal} → ${formatearFechaEntregaHumana(semanaActual.finDomingo, hoyYmd).etiquetaPrincipal}`
                : `${NOMBRES_MESES[mesCursor - 1]} ${anioCursor}`}
          </strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              onClick={navegarAnterior}
              title="Periodo anterior"
              aria-label="Anterior"
              style={{
                padding: "6px 9px",
                borderRadius: "8px",
                border: "1px solid #D5CFC4",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setFechaCursor(hoyYmd)}
              title="Ir al día de hoy"
              aria-label="Ir a Hoy"
              style={{
                padding: "6px 11px",
                borderRadius: "8px",
                border: "1px solid #D5CFC4",
                background: fechaCursor === hoyYmd ? "#F2F6F3" : "#FFFFFF",
                color: fechaCursor === hoyYmd ? "#2B4A36" : "#57524C",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={navegarSiguiente}
              title="Periodo siguiente"
              aria-label="Siguiente"
              style={{
                padding: "6px 9px",
                borderRadius: "8px",
                border: "1px solid #D5CFC4",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Selector de Vistas: Hoy / Semana / Mes */}
          <div
            style={{
              display: "inline-flex",
              background: "#F4F2EE",
              padding: "3px",
              borderRadius: "10px",
              gap: "3px",
            }}
          >
            {(
              [
                { id: "hoy", label: "Día" },
                { id: "semana", label: "Semana" },
                { id: "mes", label: "Mes" },
              ] as Array<{ id: VistaCalendarioPedidos; label: string }>
            ).map((v) => {
              const activa = vista === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVista(v.id);
                    if (v.id === "hoy") setFechaCursor(hoyYmd);
                  }}
                  title={`Cambiar a vista ${v.label}`}
                  aria-label={v.label}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: activa ? "#1F1C19" : "transparent",
                    color: activa ? "#FFFFFF" : "#57524C",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leyenda Interactiva por Clasificación + Distinción Visual de Entregas Confirmadas */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          padding: "10px 12px",
          borderRadius: "12px",
          background: "#F8F7F4",
          border: "1px solid #E6E2DA",
        }}
      >
        <BarraFiltroClasificacionPedido
          seleccionada={filtroClasificacion}
          onSeleccionar={setFiltroClasificacion}
          conteos={conteosClasificacion}
          totalGeneral={
            mostrarConfirmadas
              ? ordenesValidas.length
              : ordenesValidas.length - totalConfirmadasGlobal
          }
          compacta
        />

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "4px 10px",
              borderRadius: "8px",
              background: "#FFFFFF",
              border: "1px solid #E6E2DA",
              fontSize: "0.71rem",
              color: "#57524C",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "3px",
                  background: "#2F4737",
                }}
              />
              <span>Pendiente</span>
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontWeight: 700,
                opacity: 0.75,
              }}
            >
              <CheckCircle2 size={12} color="#57524C" />
              <span>Confirmada (opaco)</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMostrarConfirmadas((prev) => !prev)}
            title="Mostrar u ocultar entregas ya confirmadas en la misma fecha"
            aria-label="Confirmadas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              borderRadius: "8px",
              border: mostrarConfirmadas ? "1px solid #847D74" : "1px solid #D5CFC4",
              background: mostrarConfirmadas ? "#E6E2DA" : "#FFFFFF",
              color: "#57524C",
              fontSize: "0.73rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {mostrarConfirmadas ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Confirmadas ({totalConfirmadasGlobal})</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          VISTA 1: DÍA — PEDIDOS POR FRANJA Y CONFIRMADAS EN TONO OPACO
      ===================================================================== */}
      {vista === "hoy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {ordenesElaboracionDiaSeleccionado.length === 0 ? (
            <div
              style={{
                padding: "24px",
                borderRadius: "12px",
                background: "#F8F7F4",
                border: "1px dashed #D5CFC4",
                textAlign: "center",
                color: "#847D74",
                fontSize: "0.85rem",
              }}
            >
              No hay pedidos registrados para esta fecha ({fechaCursor}) con el filtro actual.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(275px, 1fr))",
                gap: "12px",
              }}
            >
              {bloquesHoy
                .filter((b) => b.items.length > 0)
                .map((bloque) => (
                  <div
                    key={bloque.id}
                    style={{
                      background: bloque.fondo,
                      border: `1px solid ${bloque.colorBorde}`,
                      borderRadius: "13px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <strong style={{ fontSize: "0.81rem", color: "#1F1C19" }}>
                        {bloque.titulo}
                      </strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "#FFFFFF",
                          border: "1px solid #E6E2DA",
                          fontSize: "0.71rem",
                          fontWeight: 800,
                          color: "#1F1C19",
                        }}
                      >
                        {bloque.items.length}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {bloque.items.map((o) => renderTarjetaCompacta(o, false))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VISTA 2: SEMANA — 7 COLUMNAS CON COLORES POR CATEGORÍA Y OPACOS
      ===================================================================== */}
      {vista === "semana" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
            gap: "10px",
          }}
        >
          {semanaActual.dias.map((ymd, idx) => {
            const delDia = ordenesPorFechaEntrega.get(ymd) ?? [];
            const pendientes = delDia.filter((x) => !esEntregaConfirmadaOrden(x)).length;
            const confirmadas = delDia.length - pendientes;
            const todoConfirmado = delDia.length > 0 && pendientes === 0;
            const esHoy = ymd === hoyYmd;

            return (
              <div
                key={ymd}
                style={{
                  background: esHoy
                    ? "#F2F6F3"
                    : todoConfirmado
                      ? "#F8F7F4"
                      : "#FFFFFF",
                  border: esHoy
                    ? "2px solid #2F4737"
                    : todoConfirmado
                      ? "1px solid #D5CFC4"
                      : "1px solid #E6E2DA",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minHeight: "185px",
                }}
              >
                <div
                  onClick={() => {
                    setFechaCursor(ymd);
                    setVista("hoy");
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    paddingBottom: "6px",
                    borderBottom: "1px solid #E6E2DA",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.71rem",
                        fontWeight: 700,
                        color: esHoy ? "#2F4737" : "#847D74",
                        textTransform: "uppercase",
                      }}
                    >
                      {NOMBRES_DIAS_CORTO[idx]} {esHoy ? "· HOY" : ""}
                    </div>
                    <strong style={{ fontSize: "0.94rem", color: "#1F1C19" }}>
                      {ymd.slice(8, 10)}/{ymd.slice(5, 7)}
                    </strong>
                  </div>

                  {delDia.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {pendientes > 0 && (
                        <span
                          title={`${pendientes} pendiente(s)`}
                          style={{
                            padding: "2px 7px",
                            borderRadius: "999px",
                            background: "#1F1C19",
                            color: "#FFFFFF",
                            fontSize: "0.7rem",
                            fontWeight: 800,
                          }}
                        >
                          {pendientes}
                        </span>
                      )}
                      {confirmadas > 0 && (
                        <span
                          title={`${confirmadas} entrega(s) confirmada(s)`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px",
                            padding: "2px 6px",
                            borderRadius: "999px",
                            background: "#E6E2DA",
                            color: "#57524C",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                          }}
                        >
                          <CheckCircle2 size={10} color="#2F4737" />
                          <span>{confirmadas}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {delDia.length === 0 ? (
                  <span style={{ fontSize: "0.74rem", color: "#847D74" }}>Sin entregas</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {delDia.map((o) => renderTarjetaCompacta(o, false))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          VISTA 3: MES — CUADRÍCULA PROFESIONAL CON ÍCONOS Y CONFIRMACIONES OPACAS
      ===================================================================== */}
      {vista === "mes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "6px",
            }}
          >
            {NOMBRES_DIAS_CORTO.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontSize: "0.73rem",
                  fontWeight: 800,
                  color: "#57524C",
                  padding: "4px 0",
                }}
              >
                {d}
              </div>
            ))}

            {celdasMes.map((celda) => {
              const delDia = ordenesPorFechaEntrega.get(celda.ymd) ?? [];
              const pendientesDia = delDia.filter((x) => !esEntregaConfirmadaOrden(x)).length;
              const confirmadasDia = delDia.length - pendientesDia;
              const todoDiaConfirmado = delDia.length > 0 && pendientesDia === 0;
              const esHoy = celda.ymd === hoyYmd;
              const seleccionada = celda.ymd === fechaCursor;

              return (
                <button
                  key={celda.ymd}
                  type="button"
                  onClick={() => setFechaCursor(celda.ymd)}
                  title={`${celda.ymd}: ${pendientesDia} pendiente(s), ${confirmadasDia} confirmada(s)`}
                  aria-label={`Día ${celda.ymd}`}
                  style={{
                    minHeight: "92px",
                    padding: "6px",
                    borderRadius: "10px",
                    border: seleccionada
                      ? "2px solid #1F1C19"
                      : esHoy
                        ? "2px solid #2F4737"
                        : todoDiaConfirmado
                          ? "1px solid #D5CFC4"
                          : delDia.length > 0
                            ? "1px solid #847D74"
                            : "1px solid #E6E2DA",
                    background: !celda.enMesActual
                      ? "#F8F7F4"
                      : todoDiaConfirmado
                        ? "#F8F7F4"
                        : "#FFFFFF",
                    opacity: celda.enMesActual ? 1 : 0.48,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    justifyContent: "space-between",
                    gap: "5px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "3px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "0.78rem",
                        color: esHoy ? "#2F4737" : todoDiaConfirmado ? "#847D74" : "#1F1C19",
                      }}
                    >
                      {celda.diaMes}
                    </strong>

                    {delDia.length > 0 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        {pendientesDia > 0 && (
                          <span
                            style={{
                              padding: "1px 5px",
                              borderRadius: "999px",
                              background: "#1F1C19",
                              color: "#FFFFFF",
                              fontSize: "0.63rem",
                              fontWeight: 800,
                            }}
                          >
                            {pendientesDia}
                          </span>
                        )}
                        {confirmadasDia > 0 && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              padding: "1px 5px",
                              borderRadius: "999px",
                              background: "#E6E2DA",
                              color: "#57524C",
                              fontSize: "0.62rem",
                              fontWeight: 800,
                            }}
                          >
                            ✓{confirmadasDia}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {delDia.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {delDia.slice(0, 3).map((o) => {
                        const clasif = resolverClasificacionOrden(o);
                        const def = obtenerDefinicionClasificacionPedido(clasif);
                        const conf = esEntregaConfirmadaOrden(o);
                        return (
                          <span
                            key={o.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.63rem",
                              fontWeight: conf ? 600 : 700,
                              padding: "2px 5px",
                              borderRadius: "4px",
                              borderLeft: `3px solid ${conf ? def.acentoOpacoHex : def.acentoHex}`,
                              background: conf ? def.fondoOpacoHex : def.fondoHex,
                              color: conf ? def.textoOpacoHex : def.textoHex,
                              opacity: conf ? 0.68 : 1,
                              overflow: "hidden",
                            }}
                          >
                            {conf ? (
                              <CheckCircle2
                                size={10}
                                color="#57524C"
                                style={{ flexShrink: 0 }}
                              />
                            ) : (
                              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                                <IconoClasificacionPedido
                                  clasificacion={clasif}
                                  size={10}
                                  color={def.acentoHex}
                                />
                              </span>
                            )}
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {clasif === "EXEQUIALES" && o.salaServicio
                                ? `${o.salaServicio} · `
                                : ""}
                              {o.productoResumen}
                            </span>
                          </span>
                        );
                      })}
                      {delDia.length > 3 && (
                        <span style={{ fontSize: "0.61rem", color: "#847D74", fontWeight: 700 }}>
                          +{delDia.length - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detalle del día seleccionado en la vista mensual */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "#F8F7F4",
              border: "1px solid #E6E2DA",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
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
              <strong style={{ fontSize: "0.87rem", color: "#1F1C19" }}>
                Pedidos del {formatearFechaEntregaHumana(fechaCursor, hoyYmd).etiquetaPrincipal} (
                {ordenesFechaSeleccionadaMes.length})
              </strong>
              {ordenesFechaSeleccionadaMes.length > 0 && (
                <div style={{ display: "flex", gap: "8px", fontSize: "0.74rem", fontWeight: 700 }}>
                  <span style={{ color: "#2F4737" }}>Pendientes: {pendientesMesSel}</span>
                  <span style={{ color: "#847D74" }}>·</span>
                  <span style={{ color: "#57524C" }}>Confirmadas: {confirmadasMesSel}</span>
                </div>
              )}
            </div>

            {ordenesFechaSeleccionadaMes.length === 0 ? (
              <span style={{ fontSize: "0.8rem", color: "#847D74" }}>
                Selecciona cualquier fecha del calendario para consultar sus pedidos pendientes y
                entregas confirmadas.
              </span>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
                  gap: "10px",
                }}
              >
                {ordenesFechaSeleccionadaMes.map((o) => renderTarjetaCompacta(o, true))}
              </div>
            )}
          </div>
        </div>
      )}

      <ModalVisorEvidenciaEntrega
        datos={visorEvidencia}
        onCerrar={() => setVisorEvidencia(null)}
      />
    </div>
  );
}
