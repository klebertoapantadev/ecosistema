"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Eye,
  EyeOff,
  Hammer,
  Loader2,
  MapPinCheck,
  RefreshCw,
  Send,
  Volume2,
  X,
} from "lucide-react";
import {
  actualizarEstadoOrdenTallerAction,
  obtenerConsolaTallerYDespachoAction,
  type DatosConsolaTallerYDespacho,
} from "../acciones-operaciones-taller";
import {
  esPedidoDeElaboracionEnFecha,
  formatearFechaEntregaHumana,
  obtenerFechaHoyEcuadorYmd,
  type EstadoOrdenTaller,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";
import { CalendarioPedidosTaller } from "./CalendarioPedidosTaller";

export interface PropsConsolaTallerFloral {
  negocio: string;
  datosIniciales?: DatosConsolaTallerYDespacho | null;
}

type FiltroHorizonteTaller = "activos_hoy_y_futuros" | "hoy" | "futuros" | "todos";

function reproducirCampanaTaller(urgente = false) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notas = urgente ? [587.33, 783.99, 1046.5] : [523.25, 659.25];
    notas.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + idx * 0.16;
      gain.gain.setValueAtTime(0.001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.22, inicio + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.38);
    });
  } catch {
    // Ignorar si el navegador bloquea autoplay antes de interacción
  }
}

export function ConsolaTallerFloral({
  negocio,
  datosIniciales = null,
}: PropsConsolaTallerFloral) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_consola_taller_floral_${negNorm}`;
  const hoyYmd = useMemo(() => obtenerFechaHoyEcuadorYmd(), []);

  const [datos, setDatos] = useState<DatosConsolaTallerYDespacho>(
    datosIniciales ?? {
      usuarioActualNombre: "Taller",
      ordenes: [],
      productosCatalogo: [],
    }
  );
  const [filtro, setFiltro] = useState<FiltroHorizonteTaller>("activos_hoy_y_futuros");
  // Por requerimiento explícito: los históricos están OCULTOS por defecto
  const [mostrarHistoricos, setMostrarHistoricos] = useState<boolean>(false);
  const [mostrarCalendario, setMostrarCalendario] = useState<boolean>(true);
  const [cargando, setCargando] = useState<boolean>(false);
  const [idProcesando, setIdProcesando] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alertaNuevoPedido, setAlertaNuevoPedido] = useState<{
    titulo: string;
    detalle: string;
    esExequiales?: boolean;
  } | null>(null);
  const [permisoNotifNav, setPermisoNotifNav] = useState<string>("default");

  const idsConocidosRef = useRef<Set<string>>(new Set());
  const inicializadoIdsRef = useRef<boolean>(false);

  const dispararAlertaVisualYSonora = useCallback(
    (titulo: string, detalle: string, esExequiales = false) => {
      setAlertaNuevoPedido({ titulo, detalle, esExequiales });
      reproducirCampanaTaller(esExequiales);
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(titulo, {
            body: detalle,
            icon: "/icons/icon-192.png",
          });
        } catch {
          // Ignorar
        }
      }
    },
    []
  );

  const recargarTaller = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      setErrorMsg(null);
      const res = await obtenerConsolaTallerYDespachoAction(negNorm);
      if (!silencioso) setCargando(false);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      const enTallerNuevas = res.datos.ordenes.filter((o) =>
        ["ENVIADO_TALLER", "EN_PREPARACION", "LISTO_ENTREGA"].includes(o.estadoTaller)
      );

      if (!inicializadoIdsRef.current) {
        enTallerNuevas.forEach((o) => idsConocidosRef.current.add(o.id));
        inicializadoIdsRef.current = true;
      } else {
        const recienLlegadas = enTallerNuevas.filter((o) => !idsConocidosRef.current.has(o.id));
        enTallerNuevas.forEach((o) => idsConocidosRef.current.add(o.id));
        if (recienLlegadas.length > 0) {
          const primera = recienLlegadas[0]!;
          const esExeq = primera.origenTipo === "EXEQUIALES_LLAMADA";
          dispararAlertaVisualYSonora(
            esExeq
              ? `🕊️ Nuevo Pedido Exequiales (${primera.codigo})`
              : `🌸 ${recienLlegadas.length} nuevo(s) pedido(s) en Taller`,
            `${primera.productoResumen} · Entrega: ${primera.fechaEntrega}${
              primera.salaServicio ? ` · ${primera.salaServicio}` : ""
            }`,
            esExeq
          );
        }
      }

      setDatos(res.datos);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.datos));
      } catch {
        // Ignorar cuota
      }
    },
    [negNorm, cacheKey, dispararAlertaVisualYSonora]
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermisoNotifNav(Notification.permission);
    }

    if (!datosIniciales) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as DatosConsolaTallerYDespacho;
          if (parsed && Array.isArray(parsed.ordenes)) {
            setDatos(parsed);
          }
        }
      } catch {
        // Ignorar
      }
      void recargarTaller(false);
    } else {
      datosIniciales.ordenes
        .filter((o) =>
          ["ENVIADO_TALLER", "EN_PREPARACION", "LISTO_ENTREGA"].includes(o.estadoTaller)
        )
        .forEach((o) => idsConocidosRef.current.add(o.id));
      inicializadoIdsRef.current = true;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(datosIniciales));
      } catch {
        // Ignorar
      }
    }

    // Suscripción en vivo (Broadcast + Postgres Changes) + refresco periódico cada 20s
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel(`eco-taller-${negNorm}`)
      .on("broadcast", { event: "nuevo_pedido_taller" }, (payload) => {
        const p = (payload?.payload ?? {}) as {
          codigo?: string;
          resumen?: string;
          esExequiales?: boolean;
        };
        dispararAlertaVisualYSonora(
          p.esExequiales
            ? `🕊️ URGENTE Exequiales en Taller (${p.codigo || "OT"})`
            : `🌸 Nuevo Pedido Recibido (${p.codigo || "Pedido"})`,
          p.resumen || "Se envió un nuevo pedido para elaboración.",
          Boolean(p.esExequiales)
        );
        void recargarTaller(true);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "comun_comercio",
          table: "com_orden_taller",
        },
        () => {
          void recargarTaller(true);
        }
      )
      .subscribe();

    const intervalo = setInterval(() => {
      void recargarTaller(true);
    }, 20000);

    return () => {
      clearInterval(intervalo);
      void supabase.removeChannel(canal);
    };
  }, [datosIniciales, cacheKey, negNorm, recargarTaller, dispararAlertaVisualYSonora]);

  const solicitarNotificacionesNavegador = async () => {
    reproducirCampanaTaller(false);
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermisoNotifNav(perm);
      } catch {
        // Ignorar
      }
    }
  };

  // Taller recibe los pedidos enviados por el operador (ENVIADO_TALLER, EN_PREPARACION, LISTO_ENTREGA)
  // y opcionalmente los históricos (ENTREGADO / fechas pasadas completadas) cuando activa el botón.
  const todasOrdenesTaller = useMemo(
    () =>
      datos.ordenes.filter(
        (o) => o.estadoTaller !== "ANULADO" && o.estadoTaller !== "PENDIENTE_ENVIO"
      ),
    [datos.ordenes]
  );

  const esOrdenHistorica = useCallback(
    (o: OrdenTrabajoTaller) => {
      if (o.estadoTaller === "ENTREGADO") return true;
      const f = (o.fechaEntrega || "").slice(0, 10);
      return Boolean(f && f < hoyYmd && o.estadoTaller === "LISTO_ENTREGA");
    },
    [hoyYmd]
  );

  const ordenesVisiblesBase = useMemo(() => {
    if (mostrarHistoricos) return todasOrdenesTaller;
    return todasOrdenesTaller.filter((o) => !esOrdenHistorica(o));
  }, [todasOrdenesTaller, mostrarHistoricos, esOrdenHistorica]);

  const conteos = useMemo(() => {
    const activas = todasOrdenesTaller.filter((o) => !esOrdenHistorica(o));
    const hoy = activas.filter((o) => esPedidoDeElaboracionEnFecha(o, hoyYmd, hoyYmd));
    const futuros = activas.filter((o) => (o.fechaEntrega || "").slice(0, 10) > hoyYmd);
    const historicas = todasOrdenesTaller.filter((o) => esOrdenHistorica(o));
    return {
      activas: activas.length,
      hoy: hoy.length,
      futuros: futuros.length,
      historicas: historicas.length,
    };
  }, [todasOrdenesTaller, esOrdenHistorica, hoyYmd]);

  const ordenesFiltradas = useMemo(() => {
    return ordenesVisiblesBase.filter((o) => {
      const f = (o.fechaEntrega || "").slice(0, 10);
      if (filtro === "hoy") return esPedidoDeElaboracionEnFecha(o, hoyYmd, hoyYmd);
      if (filtro === "futuros") return f > hoyYmd;
      return true;
    });
  }, [ordenesVisiblesBase, filtro, hoyYmd]);

  const handleCambiarEstado = useCallback(
    async (orden: OrdenTrabajoTaller, nuevoEstado: EstadoOrdenTaller) => {
      setIdProcesando(orden.id);
      setErrorMsg(null);
      const res = await actualizarEstadoOrdenTallerAction({
        negocio: negNorm,
        ordenId: orden.id,
        nuevoEstado,
      });
      setIdProcesando(null);

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setDatos((prev) => {
        const next: DatosConsolaTallerYDespacho = {
          ...prev,
          ordenes: prev.ordenes.map((o) =>
            o.id === orden.id ? { ...o, estadoTaller: nuevoEstado } : o
          ),
        };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(next));
        } catch {
          // Ignorar
        }
        return next;
      });
    },
    [negNorm, cacheKey]
  );

  const columnasTaller = useMemo<ColumnaDataGrid<OrdenTrabajoTaller>[]>(
    () => [
      {
        id: "entrega",
        encabezado: "Fecha Entrega / Horario",
        valor: (o) => `${o.fechaEntrega} ${o.franjaHoraria || o.horaEspecifica || ""}`,
        render: (o) => {
          const info = formatearFechaEntregaHumana(o.fechaEntrega, hoyYmd);
          const esHoy = info.horizonte === "HOY";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "0.73rem",
                  fontWeight: 800,
                  background: esHoy ? "#DCFCE7" : "#DBEAFE",
                  color: esHoy ? "#15803D" : "#1D4ED8",
                }}
              >
                📅 {info.etiquetaPrincipal}
              </span>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#334155" }}>
                {o.origenTipo === "EXEQUIALES_LLAMADA"
                  ? `⏰ ${o.horaEspecifica || "Hoy"}`
                  : o.franjaHoraria || "A) 09:00 - 13:00"}
              </span>
            </div>
          );
        },
      },
      {
        id: "producto",
        encabezado: "Arreglo a Elaborar",
        valor: (o) => `${o.codigo} ${o.productoResumen} ${o.dedicatoria || ""}`,
        render: (o) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxWidth: "340px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "0.83rem", color: "#0F172A" }}>{o.codigo}</strong>
              {o.origenTipo === "EXEQUIALES_LLAMADA" && (
                <span
                  style={{
                    padding: "1px 7px",
                    borderRadius: "999px",
                    background: "#581C87",
                    color: "#FFFFFF",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                  }}
                >
                  🕊️ Exequiales {o.salaServicio ? `· ${o.salaServicio}` : ""}
                </span>
              )}
            </div>
            <strong style={{ fontSize: "0.85rem", color: "#1E293B" }}>💐 {o.productoResumen}</strong>
            {o.dedicatoria && (
              <span style={{ fontSize: "0.73rem", color: "#92400E" }}>💌 {o.dedicatoria}</span>
            )}
          </div>
        ),
      },
      {
        id: "destinatario",
        encabezado: "Solicita / Destinatario / Sala",
        valor: (o) => `${o.clienteSolicita} ${o.destinatarioFallecido} ${o.salaServicio || ""}`,
        render: (o) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.8rem", color: "#0F172A" }}>
              {o.origenTipo === "EXEQUIALES_LLAMADA"
                ? `Solicita: ${o.clienteSolicita}`
                : o.destinatarioFallecido || o.clienteSolicita}
            </strong>
            <span style={{ fontSize: "0.74rem", color: "#475569" }}>
              {o.origenTipo === "EXEQUIALES_LLAMADA"
                ? `${o.salaServicio || "Sala por confirmar"} · Fallecido: ${o.destinatarioFallecido || "Por confirmar"}`
                : o.ubicacionEntrega || "—"}
            </span>
          </div>
        ),
      },
      {
        id: "estado_taller",
        encabezado: "Actualizar Estado Taller",
        valor: (o) => o.estadoTaller,
        render: (o) => {
          const proc = idProcesando === o.id;
          if (o.estadoTaller === "ENTREGADO") {
            return (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#F1F5F9",
                  color: "#475569",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                }}
              >
                ✅ Entregado
              </span>
            );
          }

          return (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={proc}
                onClick={() => void handleCambiarEstado(o, "EN_PREPARACION")}
                title="Marcar pedido como En preparación"
                aria-label="En Preparación"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 11px",
                  borderRadius: "8px",
                  border:
                    o.estadoTaller === "EN_PREPARACION"
                      ? "2px solid #C2410C"
                      : "1px solid #CBD5E1",
                  background: o.estadoTaller === "EN_PREPARACION" ? "#FFEDD5" : "#FFFFFF",
                  color: o.estadoTaller === "EN_PREPARACION" ? "#9A3412" : "#334155",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  cursor: proc ? "wait" : "pointer",
                }}
              >
                <Hammer size={13} />
                <span>En Preparación</span>
              </button>

              <button
                type="button"
                disabled={proc}
                onClick={() => void handleCambiarEstado(o, "LISTO_ENTREGA")}
                title="Marcar arreglo como Listo para entrega"
                aria-label="Listo Entrega"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  border:
                    o.estadoTaller === "LISTO_ENTREGA" ? "2px solid #15803D" : "none",
                  background: o.estadoTaller === "LISTO_ENTREGA" ? "#DCFCE7" : "#059669",
                  color: o.estadoTaller === "LISTO_ENTREGA" ? "#14532D" : "#FFFFFF",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  cursor: proc ? "wait" : "pointer",
                }}
              >
                <CheckCircle2 size={13} />
                <span>Listo Entrega</span>
              </button>
            </div>
          );
        },
      },
    ],
    [hoyYmd, idProcesando, handleCambiarEstado]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* BANNER SONORO / VISUAL DE NUEVO PEDIDO EN VIVO */}
      {alertaNuevoPedido && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            background: alertaNuevoPedido.esExequiales ? "#581C87" : "#065F46",
            color: "#FFFFFF",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.22)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BellRing size={22} />
            <div>
              <strong style={{ display: "block", fontSize: "0.94rem" }}>
                {alertaNuevoPedido.titulo}
              </strong>
              <span style={{ fontSize: "0.82rem", opacity: 0.94 }}>
                {alertaNuevoPedido.detalle}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAlertaNuevoPedido(null)}
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
            style={{
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#FFFFFF",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.76rem",
              fontWeight: 700,
            }}
          >
            <X size={14} />
            <span>Cerrar</span>
          </button>
        </div>
      )}

      {/* BARRA SUPERIOR DE FILTROS DE HORIZONTE, HISTÓRICOS Y ALERTAS */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "14px",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
          {(
            [
              {
                id: "activos_hoy_y_futuros",
                label: `📋 Activos (${conteos.activas})`,
              },
              {
                id: "hoy",
                label: `🔥 Elaboración Hoy (${conteos.hoy})`,
              },
              {
                id: "futuros",
                label: `📅 Futuros (${conteos.futuros})`,
              },
              ...(mostrarHistoricos
                ? [{ id: "todos" as const, label: `🗂️ Todos (${todasOrdenesTaller.length})` }]
                : []),
            ] as Array<{ id: FiltroHorizonteTaller; label: string }>
          ).map((b) => {
            const activo = filtro === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setFiltro(b.id)}
                style={{
                  padding: "8px 13px",
                  borderRadius: "10px",
                  border: activo ? "1px solid #0F172A" : "1px solid #E2E8F0",
                  background: activo ? "#0F172A" : "#F8FAFC",
                  color: activo ? "#FFFFFF" : "#334155",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {b.label}
              </button>
            );
          })}

          {/* Toggle explícito de Históricos (ocultos por defecto) */}
          <button
            type="button"
            onClick={() => {
              setMostrarHistoricos((prev) => {
                const nuevo = !prev;
                if (nuevo) setFiltro("todos");
                else if (filtro === "todos") setFiltro("activos_hoy_y_futuros");
                return nuevo;
              });
            }}
            title="Mostrar u ocultar pedidos históricos ya entregados"
            aria-label="Ver Históricos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "10px",
              border: mostrarHistoricos ? "1.5px solid #2563EB" : "1px solid #CBD5E1",
              background: mostrarHistoricos ? "#EFF6FF" : "#FFFFFF",
              color: mostrarHistoricos ? "#1D4ED8" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {mostrarHistoricos ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>
              {mostrarHistoricos
                ? "Ocultar Históricos"
                : `Ver Históricos (${conteos.historicas})`}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void solicitarNotificacionesNavegador()}
            title="Activar sonido y notificaciones emergentes cuando llegue un pedido nuevo"
            aria-label="Activar Alertas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid #CBD5E1",
              background: permisoNotifNav === "granted" ? "#ECFDF5" : "#FFFBEB",
              color: permisoNotifNav === "granted" ? "#065F46" : "#92400E",
              fontSize: "0.76rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {permisoNotifNav === "granted" ? <Volume2 size={14} /> : <Bell size={14} />}
            <span>{permisoNotifNav === "granted" ? "Alertas Activas" : "Activar Sonido"}</span>
          </button>

          <Link
            href="/panel/envio-pedidos"
            title="Abrir pantalla de carga y envío de pedidos"
            aria-label="Enviar Pedidos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#0F172A",
              textDecoration: "none",
              fontSize: "0.78rem",
              fontWeight: 700,
            }}
          >
            <Send size={13} />
            <span>Enviar Pedidos</span>
          </Link>

          <Link
            href="/panel/entregas"
            title="Ir a Confirmación de Entregas GPS"
            aria-label="Confirmar Entregas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid #86EFAC",
              background: "#F0FDF4",
              color: "#166534",
              textDecoration: "none",
              fontSize: "0.78rem",
              fontWeight: 700,
            }}
          >
            <MapPinCheck size={14} />
            <span>Entregas GPS</span>
          </Link>

          <button
            type="button"
            onClick={() => void recargarTaller(false)}
            disabled={cargando}
            title="Actualizar pedidos del Taller"
            aria-label="Actualizar"
            className="btn-responsive-accion"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#0F172A",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.83rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* CALENDARIO DE PEDIDOS EN TALLER (HOY ELABORACIÓN / SEMANA / MES) */}
      {mostrarCalendario && (
        <CalendarioPedidosTaller
          ordenes={ordenesVisiblesBase}
          modo="taller"
          vistaInicial="hoy"
          onCambiarEstadoTaller={(o, est) => void handleCambiarEstado(o, est)}
          idProcesando={idProcesando}
        />
      )}

      {/* LISTADO COMPLETO DATAGRID CON AGRUPACIÓN, BÚSQUEDA Y EXPORTACIÓN */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
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
          <strong style={{ fontSize: "0.95rem", color: "#0F172A" }}>
            Cola de Producción del Taller ({ordenesFiltradas.length} pedido
            {ordenesFiltradas.length === 1 ? "" : "s"})
          </strong>
          <button
            type="button"
            onClick={() => setMostrarCalendario((v) => !v)}
            title="Mostrar u ocultar el bloque de calendario superior"
            aria-label="Alternar Calendario"
            style={{
              padding: "5px 10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            {mostrarCalendario ? "Ocultar Calendario" : "Mostrar Calendario"}
          </button>
        </div>

        <DataGrid
          columnas={columnasTaller}
          filas={ordenesFiltradas}
          idFila={(o) => o.id}
          nombreExportacion={`cola-taller-${negNorm}`}
          contenidoExpandible={(o) => (
            <div
              style={{
                padding: "12px",
                background: "#F8FAFC",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "12px",
                fontSize: "0.81rem",
              }}
            >
              <div>
                <strong>Detalle completo de elaboración:</strong>
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {o.items.map((it, idx) => (
                    <li key={idx}>
                      <strong>
                        {it.cantidad}× {it.descripcion}
                      </strong>
                      {it.dedicatoria ? ` — 💌 ${it.dedicatoria}` : ""}
                    </li>
                  ))}
                </ul>
                {o.dedicatoria && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      color: "#92400E",
                    }}
                  >
                    💌 <strong>Tarjeta:</strong> {o.dedicatoria}
                  </div>
                )}
              </div>

              <div>
                <div>
                  <strong>Fecha de Entrega:</strong> {o.fechaEntrega}{" "}
                  {o.horaEspecifica
                    ? `(${o.horaEspecifica})`
                    : o.franjaHoraria
                      ? `(${o.franjaHoraria})`
                      : ""}
                </div>
                <div>
                  <strong>Solicita:</strong> {o.clienteSolicita}
                </div>
                <div>
                  <strong>Destinatario / Fallecido:</strong> {o.destinatarioFallecido || "—"}
                </div>
                {o.salaServicio && (
                  <div>
                    <strong>Sala Exequiales:</strong> {o.salaServicio}
                  </div>
                )}
                {o.observaciones && (
                  <div style={{ marginTop: "4px" }}>
                    <strong>Notas Taller:</strong> {o.observaciones}
                  </div>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
