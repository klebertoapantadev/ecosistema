"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Hammer,
  Loader2,
  PhoneCall,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  asignarRepartidorEntregaAction,
  crearOActualizarPedidoOperadorAction,
  enviarPedidosATallerAction,
  obtenerConsolaTallerYDespachoAction,
  type DatosConsolaTallerYDespacho,
} from "../acciones-operaciones-taller";
import {
  OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES,
  OPCIONES_SALA_EXEQUIALES,
  RANGOS_HORARIO_ENTREGA_TIENDA,
  SOLICITANTES_EXEQUIALES_FRECUENTES,
  formatearFechaEntregaHumana,
  obtenerFechaHoyEcuadorYmd,
  sumarDiasYmd,
  type ItemOrdenTaller,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";
import { CalendarioPedidosTaller } from "./CalendarioPedidosTaller";

export interface PropsConsolaEnvioPedidosTaller {
  negocio: string;
  datosIniciales?: DatosConsolaTallerYDespacho | null;
}

type PestanaDespacho = "bandeja_envio" | "exequiales_llamada" | "cargar_manual" | "calendario";
type FiltroBandeja = "por_enviar" | "hoy" | "futuros" | "ya_en_taller" | "todos";

export function ConsolaEnvioPedidosTaller({
  negocio,
  datosIniciales = null,
}: PropsConsolaEnvioPedidosTaller) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_consola_despacho_taller_${negNorm}`;
  const hoyYmd = useMemo(() => obtenerFechaHoyEcuadorYmd(), []);

  const [datos, setDatos] = useState<DatosConsolaTallerYDespacho>(
    datosIniciales ?? {
      usuarioActualNombre: "Operador",
      ordenes: [],
      productosCatalogo: [],
    }
  );
  const [pestana, setPestana] = useState<PestanaDespacho>("bandeja_envio");
  const [filtroBandeja, setFiltroBandeja] = useState<FiltroBandeja>("por_enviar");
  const [cargando, setCargando] = useState<boolean>(false);
  const [enviandoLote, setEnviandoLote] = useState<boolean>(false);
  const [idProcesando, setIdProcesando] = useState<string | null>(null);
  const [seleccionadosIds, setSeleccionadosIds] = useState<Set<string>>(new Set());
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // =========================================================================
  // FORMULARIO RÁPIDO: LLAMADA EXEQUIALES (POR DEFECTO HOY + SET CONDOLENCIAS)
  // =========================================================================
  const [exeqOpcionProd, setExeqOpcionProd] = useState<
    "Set condolencias (3 arreglos)" | "Cubre cofre (1 arreglo)" | "OTROS"
  >("Set condolencias (3 arreglos)");
  const [exeqProdLibre, setExeqProdLibre] = useState<string>("");
  const [exeqFechaEntrega, setExeqFechaEntrega] = useState<string>(hoyYmd);
  const [exeqHora, setExeqHora] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [exeqSolicita, setExeqSolicita] = useState<string>("Cristian Montaluisa");
  const [exeqSala, setExeqSala] = useState<string>("Sala 1");
  const [exeqFallecido, setExeqFallecido] = useState<string>("");
  const [exeqUbicacion, setExeqUbicacion] = useState<string>("Exequiales del IESS");
  const [exeqNotas, setExeqNotas] = useState<string>("");
  const [guardandoExeq, setGuardandoExeq] = useState<boolean>(false);

  // =========================================================================
  // FORMULARIO: CARGAR PEDIDO MANUAL (ADMIN / OPERADOR / VENTAS)
  // =========================================================================
  const [manFechaEntrega, setManFechaEntrega] = useState<string>(hoyYmd);
  const [manFranja, setManFranja] = useState<string>("A) 09:00 - 13:00");
  const [manSkuSeleccionado, setManSkuSeleccionado] = useState<string>("");
  const [manCantidadSel, setManCantidadSel] = useState<number>(1);
  const [manItems, setManItems] = useState<ItemOrdenTaller[]>([]);
  const [manDetalleLibre, setManDetalleLibre] = useState<string>("");
  const [manCliente, setManCliente] = useState<string>("");
  const [manTelefono, setManTelefono] = useState<string>("");
  const [manDestinatario, setManDestinatario] = useState<string>("");
  const [manDireccion, setManDireccion] = useState<string>("");
  const [manEnlaceMapa, setManEnlaceMapa] = useState<string>("");
  const [manRetiroLocal, setManRetiroLocal] = useState<boolean>(false);
  const [manDedicatoria, setManDedicatoria] = useState<string>("");
  const [manObservaciones, setManObservaciones] = useState<string>("");
  const [manTotalUsd, setManTotalUsd] = useState<string>("");
  const [guardandoManual, setGuardandoManual] = useState<boolean>(false);

  // Modal de edición rápida de un pedido antes o después de enviarlo
  const [ordenEditando, setOrdenEditando] = useState<OrdenTrabajoTaller | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);

  const emitirBroadcastTaller = useCallback(
    async (evento: { codigo: string; resumen: string; esExequiales?: boolean }) => {
      try {
        const supabase = crearClienteNavegador();
        const ch = supabase.channel(`eco-taller-${negNorm}`);
        await ch.subscribe();
        await ch.send({
          type: "broadcast",
          event: "nuevo_pedido_taller",
          payload: {
            ...evento,
            emitidoEn: new Date().toISOString(),
          },
        });
        void supabase.removeChannel(ch);
      } catch {
        // Ignorar si no hay canal activo
      }
    },
    [negNorm]
  );

  const recargarDatos = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      setErrorMsg(null);
      const res = await obtenerConsolaTallerYDespachoAction(negNorm);
      if (!silencioso) setCargando(false);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setDatos(res.datos);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.datos));
      } catch {
        // Ignorar cuota
      }
    },
    [negNorm, cacheKey]
  );

  useEffect(() => {
    if (!datosIniciales) {
      try {
        const guardado = localStorage.getItem(cacheKey);
        if (guardado) {
          const parsed = JSON.parse(guardado) as DatosConsolaTallerYDespacho;
          if (parsed && Array.isArray(parsed.ordenes)) {
            setDatos(parsed);
          }
        }
      } catch {
        // Ignorar
      }
      void recargarDatos(false);
    } else {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(datosIniciales));
      } catch {
        // Ignorar
      }
    }

    // Escuchar ubicación GPS en vivo de repartidores en ruta + cambios de estado
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel(`eco-taller-${negNorm}`)
      .on("broadcast", { event: "ubicacion_delivery_ruta" }, (payload) => {
        const p = (payload?.payload ?? {}) as {
          ordenTallerId?: string;
          entregaId?: string;
          proformaId?: string;
          enRuta?: boolean;
          lat?: number;
          lng?: number;
          repartidorNombre?: string;
          emitidoEn?: string;
        };
        setDatos((prev) => ({
          ...prev,
          ordenes: prev.ordenes.map((o) => {
            const coincide =
              (p.ordenTallerId && o.id === p.ordenTallerId) ||
              (p.entregaId && o.entregaId === p.entregaId) ||
              (p.proformaId && (o.proformaId === p.proformaId || o.id === p.proformaId));
            if (!coincide) return o;
            return {
              ...o,
              enRuta: Boolean(p.enRuta),
              repartidorNombre: p.repartidorNombre || o.repartidorNombre,
              rutaLatitud: p.lat ?? o.rutaLatitud,
              rutaLongitud: p.lng ?? o.rutaLongitud,
              rutaActualizadaEn: p.emitidoEn || new Date().toISOString(),
            };
          }),
        }));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [datosIniciales, cacheKey, negNorm, recargarDatos]);

  // Métricas rápidas
  const ordenesActivas = useMemo(
    () => datos.ordenes.filter((o) => o.estadoTaller !== "ANULADO"),
    [datos.ordenes]
  );
  const pendientesEnvio = useMemo(
    () => ordenesActivas.filter((o) => o.estadoTaller === "PENDIENTE_ENVIO"),
    [ordenesActivas]
  );
  const pendientesEnvioHoy = useMemo(
    () => pendientesEnvio.filter((o) => (o.fechaEntrega || "").slice(0, 10) <= hoyYmd),
    [pendientesEnvio, hoyYmd]
  );
  const enTallerActivas = useMemo(
    () =>
      ordenesActivas.filter((o) =>
        ["ENVIADO_TALLER", "EN_PREPARACION", "LISTO_ENTREGA"].includes(o.estadoTaller)
      ),
    [ordenesActivas]
  );

  const filasFiltradas = useMemo(() => {
    return ordenesActivas.filter((o) => {
      const f = (o.fechaEntrega || "").slice(0, 10);
      if (filtroBandeja === "por_enviar") return o.estadoTaller === "PENDIENTE_ENVIO";
      if (filtroBandeja === "hoy") return f === hoyYmd && o.estadoTaller !== "ENTREGADO";
      if (filtroBandeja === "futuros") return f > hoyYmd && o.estadoTaller !== "ENTREGADO";
      if (filtroBandeja === "ya_en_taller") {
        return ["ENVIADO_TALLER", "EN_PREPARACION", "LISTO_ENTREGA"].includes(o.estadoTaller);
      }
      return true;
    });
  }, [ordenesActivas, filtroBandeja, hoyYmd]);

  const handleEnviarIdsATaller = useCallback(
    async (ids: string[], resumenNotif?: string) => {
      if (ids.length === 0) return;
      if (ids.length === 1) setIdProcesando(ids[0]!);
      else setEnviandoLote(true);
      setErrorMsg(null);
      setMensajeExito(null);

      const res = await enviarPedidosATallerAction({
        negocio: negNorm,
        ordenesIds: ids,
      });

      setIdProcesando(null);
      setEnviandoLote(false);

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setSeleccionadosIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

      void emitirBroadcastTaller({
        codigo: res.codigos.join(", "),
        resumen: resumenNotif || `${res.enviados} pedido(s) validados para elaboración`,
      });

      setMensajeExito(
        `✅ ${res.enviados} pedido(s) enviado(s) a Taller (${res.codigos.join(", ")}). El Taller recibió la notificación.`
      );
      await recargarDatos(true);
    },
    [negNorm, emitirBroadcastTaller, recargarDatos]
  );

  const handleGuardarLlamadaExequiales = async (e: React.FormEvent) => {
    e.preventDefault();
    const resumenProd =
      exeqOpcionProd === "OTROS"
        ? exeqProdLibre.trim() || "Arreglo exequial especial"
        : exeqOpcionProd;

    if (!exeqSolicita.trim()) {
      setErrorMsg("Indica quién solicita el servicio (ej. Cristian Montaluisa o Cristina).");
      return;
    }

    setGuardandoExeq(true);
    setErrorMsg(null);
    setMensajeExito(null);

    const res = await crearOActualizarPedidoOperadorAction({
      negocio: negNorm,
      origenTipo: "EXEQUIALES_LLAMADA",
      enviarATaller: true,
      fechaEntrega: exeqFechaEntrega || hoyYmd,
      fechaElaboracion: hoyYmd,
      horaEspecifica: exeqHora.trim() || "Lo antes posible",
      productoResumen: resumenProd,
      items: [{ descripcion: resumenProd, cantidad: 1 }],
      clienteSolicita: exeqSolicita.trim(),
      destinatarioFallecido: exeqFallecido.trim(),
      salaServicio: exeqSala || undefined,
      ubicacionEntrega: exeqUbicacion.trim() || "Exequiales del IESS",
      observaciones: exeqNotas.trim() || undefined,
    });

    setGuardandoExeq(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    void emitirBroadcastTaller({
      codigo: res.codigo,
      resumen: `${resumenProd} · ${exeqSala || "Sala por confirmar"} · Solicita: ${exeqSolicita.trim()}`,
      esExequiales: true,
    });

    setExeqFallecido("");
    setExeqNotas("");
    setMensajeExito(
      `🕊️ Orden Exequiales ${res.codigo} enviada directo a Taller (${resumenProd} · ${exeqSala || "Por confirmar"} · Solicita: ${exeqSolicita}). Ya quedó lista también para Confirmación de Entregas.`
    );
    await recargarDatos(true);
  };

  const handleAgregarItemCatalogo = () => {
    if (!manSkuSeleccionado) return;
    const encontrado = datos.productosCatalogo.find(
      (p) => `${p.productoId}::${p.sku}` === manSkuSeleccionado
    );
    if (!encontrado) return;
    const cant = Math.max(1, Number(manCantidadSel) || 1);
    const desc =
      encontrado.varianteNombre && encontrado.varianteNombre !== "Estándar"
        ? `${encontrado.productoNombre} (${encontrado.varianteNombre})`
        : encontrado.productoNombre;

    setManItems((prev) => {
      const next = [
        ...prev,
        {
          productoId: encontrado.productoId,
          sku: encontrado.sku,
          descripcion: desc,
          cantidad: cant,
          precioUnitario: encontrado.pvp,
        },
      ];
      const suma = next.reduce((acc, it) => acc + (it.precioUnitario ?? 0) * it.cantidad, 0);
      if (suma > 0) setManTotalUsd(suma.toFixed(2));
      return next;
    });
    setManSkuSeleccionado("");
    setManCantidadSel(1);
  };

  const guardarPedidoManual = async (enviarAhora: boolean) => {
    const listaFinal: ItemOrdenTaller[] =
      manItems.length > 0
        ? manItems
        : manDetalleLibre.trim()
          ? [{ descripcion: manDetalleLibre.trim(), cantidad: 1 }]
          : [];

    if (listaFinal.length === 0) {
      setErrorMsg("Agrega al menos un producto del catálogo o escribe el detalle del arreglo.");
      return;
    }
    if (!manFechaEntrega) {
      setErrorMsg("Selecciona la Fecha de Entrega del pedido.");
      return;
    }
    if (!manCliente.trim() && !manDestinatario.trim()) {
      setErrorMsg("Ingresa el nombre del comprador o destinatario.");
      return;
    }

    setGuardandoManual(true);
    setErrorMsg(null);
    setMensajeExito(null);

    const resumen = listaFinal.map((i) => `${i.cantidad}x ${i.descripcion}`).join(" + ");

    const res = await crearOActualizarPedidoOperadorAction({
      negocio: negNorm,
      origenTipo: "MANUAL_ADMIN",
      enviarATaller: enviarAhora,
      fechaEntrega: manFechaEntrega,
      fechaElaboracion: enviarAhora ? hoyYmd : undefined,
      franjaHoraria: manFranja,
      productoResumen: resumen,
      items: listaFinal,
      clienteSolicita: manCliente.trim() || manDestinatario.trim(),
      clienteTelefono: manTelefono.trim() || undefined,
      destinatarioFallecido: manDestinatario.trim() || manCliente.trim(),
      ubicacionEntrega: manRetiroLocal ? "Retiro en Tienda" : manDireccion.trim(),
      enlaceMapa: manEnlaceMapa.trim() || undefined,
      retiroEnLocal: manRetiroLocal,
      dedicatoria: manDedicatoria.trim() || undefined,
      observaciones: manObservaciones.trim() || undefined,
      totalUsd: Number(manTotalUsd) || 0,
    });

    setGuardandoManual(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    if (enviarAhora) {
      void emitirBroadcastTaller({
        codigo: res.codigo,
        resumen: `${resumen} · Entrega ${manFechaEntrega} (${manFranja})`,
      });
    }

    setManItems([]);
    setManDetalleLibre("");
    setManCliente("");
    setManTelefono("");
    setManDestinatario("");
    setManDireccion("");
    setManEnlaceMapa("");
    setManDedicatoria("");
    setManObservaciones("");
    setManTotalUsd("");
    setMensajeExito(
      enviarAhora
        ? `✅ Pedido ${res.codigo} cargado y enviado a Taller (Entrega: ${manFechaEntrega}).`
        : `📥 Pedido ${res.codigo} guardado para entrega el ${manFechaEntrega}. Queda listo en bandeja para enviarlo a Taller en el día correspondiente.`
    );
    await recargarDatos(true);
    setPestana("bandeja_envio");
  };

  const handleGuardarEdicionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordenEditando) return;
    setGuardandoEdicion(true);
    setErrorMsg(null);

    const res = await crearOActualizarPedidoOperadorAction({
      negocio: negNorm,
      ordenId: ordenEditando.id,
      origenTipo: ordenEditando.origenTipo,
      enviarATaller: ordenEditando.estadoTaller !== "PENDIENTE_ENVIO",
      fechaEntrega: ordenEditando.fechaEntrega,
      franjaHoraria: ordenEditando.franjaHoraria ?? undefined,
      horaEspecifica: ordenEditando.horaEspecifica ?? undefined,
      productoResumen: ordenEditando.productoResumen,
      items: ordenEditando.items,
      clienteSolicita: ordenEditando.clienteSolicita,
      clienteTelefono: ordenEditando.clienteTelefono,
      destinatarioFallecido: ordenEditando.destinatarioFallecido,
      salaServicio: ordenEditando.salaServicio ?? undefined,
      ubicacionEntrega: ordenEditando.ubicacionEntrega,
      enlaceMapa: ordenEditando.enlaceMapa ?? undefined,
      dedicatoria: ordenEditando.dedicatoria,
      observaciones: ordenEditando.observaciones,
    });

    setGuardandoEdicion(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setOrdenEditando(null);
    setMensajeExito(`Datos del pedido ${res.codigo} actualizados.`);
    await recargarDatos(true);
  };

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionadosIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAsignarRepartidor = useCallback(
    async (orden: OrdenTrabajoTaller, repartidorId: string) => {
      const rep = (datos.repartidoresNegocio ?? []).find((r) => r.usuarioId === repartidorId);
      setIdProcesando(orden.id);
      const res = await asignarRepartidorEntregaAction({
        negocio: negNorm,
        ordenTallerId: orden.id,
        entregaId: orden.entregaId ?? null,
        repartidorId: repartidorId || null,
        repartidorNombre: rep?.nombre ?? null,
        repartidorTipo: rep?.modalidad ?? null,
      });
      setIdProcesando(null);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setDatos((prev) => ({
        ...prev,
        ordenes: prev.ordenes.map((o) =>
          o.id === orden.id
            ? {
                ...o,
                repartidorId: res.repartidorId,
                repartidorNombre: res.repartidorNombre,
                repartidorTipo: res.repartidorTipo,
              }
            : o
        ),
      }));
      setMensajeExito(
        res.repartidorNombre
          ? `🛵 Pedido ${orden.codigo} asignado a ${res.repartidorNombre} (${res.repartidorTipo === "EXTERNO" ? "Subcontratado" : "Interno"}).`
          : `Asignación de repartidor retirada en ${orden.codigo}.`
      );
    },
    [datos.repartidoresNegocio, negNorm]
  );

  const columnasBandeja = useMemo<ColumnaDataGrid<OrdenTrabajoTaller>[]>(
    () => [
      {
        id: "sel",
        encabezado: "✓",
        valor: (o) => (seleccionadosIds.has(o.id) ? "1" : "0"),
        render: (o) =>
          o.estadoTaller === "PENDIENTE_ENVIO" ? (
            <input
              type="checkbox"
              checked={seleccionadosIds.has(o.id)}
              onChange={() => toggleSeleccion(o.id)}
              aria-label={`Seleccionar ${o.codigo}`}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
          ) : (
            <span style={{ color: "#10B981", fontWeight: 800 }}>✓</span>
          ),
      },
      {
        id: "fecha_entrega",
        encabezado: "Fecha Entrega y Horario",
        valor: (o) => `${o.fechaEntrega} ${o.franjaHoraria || o.horaEspecifica || ""}`,
        render: (o) => {
          const infoFecha = formatearFechaEntregaHumana(o.fechaEntrega, hoyYmd);
          const esHoy = infoFecha.horizonte === "HOY";
          const esManana = infoFecha.horizonte === "MANANA";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "0.73rem",
                  fontWeight: 800,
                  background: esHoy ? "#DCFCE7" : esManana ? "#DBEAFE" : "#F1F5F9",
                  color: esHoy ? "#15803D" : esManana ? "#1D4ED8" : "#334155",
                }}
              >
                📅 {infoFecha.etiquetaPrincipal}
              </span>
              <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569" }}>
                {o.origenTipo === "EXEQUIALES_LLAMADA"
                  ? `⏰ Hora: ${o.horaEspecifica || "Lo antes posible"}`
                  : o.franjaHoraria || "A) 09:00 - 13:00"}
              </span>
            </div>
          );
        },
      },
      {
        id: "pedido",
        encabezado: "Pedido / Producto",
        valor: (o) => `${o.codigo} ${o.productoResumen} ${o.origenTipo}`,
        render: (o) => {
          const esExeq = o.origenTipo === "EXEQUIALES_LLAMADA";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxWidth: "330px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.83rem", color: "#0F172A" }}>{o.codigo}</strong>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "999px",
                    background: esExeq ? "#FAF5FF" : "#F8FAFC",
                    color: esExeq ? "#6B21A8" : "#475569",
                    border: `1px solid ${esExeq ? "#D8B4FE" : "#E2E8F0"}`,
                  }}
                >
                  {esExeq
                    ? "🕊️ Exequiales"
                    : o.origenTipo === "PROFORMA_EVENTO"
                      ? "✨ Evento"
                      : o.origenTipo === "MANUAL_ADMIN"
                        ? "📝 Manual"
                        : "🛍️ Venta Web"}
                </span>
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1E293B" }}>
                💐 {o.productoResumen}
              </span>
            </div>
          );
        },
      },
      {
        id: "cliente_destino",
        encabezado: "Solicita / Destinatario / Sala",
        valor: (o) =>
          `${o.clienteSolicita} ${o.destinatarioFallecido} ${o.salaServicio || ""} ${o.ubicacionEntrega || ""}`,
        render: (o) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A" }}>
              {o.origenTipo === "EXEQUIALES_LLAMADA"
                ? `Solicita: ${o.clienteSolicita}`
                : o.destinatarioFallecido || o.clienteSolicita}
            </span>
            {o.origenTipo === "EXEQUIALES_LLAMADA" ? (
              <span style={{ fontSize: "0.74rem", color: "#581C87", fontWeight: 600 }}>
                🏛️ {o.salaServicio || "Sala por confirmar"} · 🕊️{" "}
                {o.destinatarioFallecido || "Por confirmar"}
              </span>
            ) : (
              <span style={{ fontSize: "0.73rem", color: "#64748B" }}>
                {o.retiroEnLocal ? "🏪 Retiro en Tienda" : o.ubicacionEntrega || "Sin dirección"}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "pago_taller",
        encabezado: "Estado Taller / Delivery",
        valor: (o) => `${o.estadoPago || ""} ${o.estadoTaller} ${o.repartidorNombre || ""}`,
        render: (o) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#334155" }}>
              Pago: {o.estadoPago || "APROBADA"}
              {o.totalUsd ? ` ($${o.totalUsd.toFixed(2)})` : ""}
            </span>
            <span
              style={{
                alignSelf: "flex-start",
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 700,
                background:
                  o.estadoTaller === "PENDIENTE_ENVIO"
                    ? "#FEF3C7"
                    : o.estadoTaller === "LISTO_ENTREGA"
                      ? "#DCFCE7"
                      : o.estadoTaller === "EN_PREPARACION"
                        ? "#FFEDD5"
                        : "#E0F2FE",
                color:
                  o.estadoTaller === "PENDIENTE_ENVIO"
                    ? "#92400E"
                    : o.estadoTaller === "LISTO_ENTREGA"
                      ? "#15803D"
                      : o.estadoTaller === "EN_PREPARACION"
                        ? "#C2410C"
                        : "#0369A1",
              }}
            >
              {o.estadoTaller === "PENDIENTE_ENVIO"
                ? "⏳ Pendiente Enviar"
                : o.estadoTaller === "ENVIADO_TALLER"
                  ? "📨 Enviado a Taller"
                  : o.estadoTaller === "EN_PREPARACION"
                    ? "🔨 En preparación"
                    : o.estadoTaller === "LISTO_ENTREGA"
                      ? "🟢 Listo para entrega"
                      : "✅ Entregado"}
            </span>

            {!o.retiroEnLocal &&
              o.estadoTaller !== "ENTREGADO" &&
              (datos.repartidoresNegocio?.length ?? 0) > 0 && (
                <select
                  value={o.repartidorId || ""}
                  onChange={(e) => void handleAsignarRepartidor(o, e.target.value)}
                  aria-label={`Asignar repartidor a ${o.codigo}`}
                  title="Asignar repartidor interno o subcontratado"
                  style={{
                    padding: "4px 7px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    background: o.repartidorId ? "#F0FDF4" : "#FFFFFF",
                    color: "#0F172A",
                    maxWidth: "185px",
                  }}
                >
                  <option value="">🛵 Sin asignar</option>
                  {(datos.repartidoresNegocio ?? []).map((rep) => (
                    <option key={rep.usuarioId} value={rep.usuarioId}>
                      {rep.nombre} ({rep.modalidad === "EXTERNO" ? "Externo" : "Interno"})
                    </option>
                  ))}
                </select>
              )}

            {o.enRuta && o.rutaLatitud != null && o.rutaLongitud != null && (
              <a
                href={`https://www.google.com/maps?q=${o.rutaLatitud},${o.rutaLongitud}`}
                target="_blank"
                rel="noreferrer"
                title="Ver ubicación GPS en vivo del repartidor en ruta"
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "0.69rem",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                📍 En Ruta · GPS Vivo
              </a>
            )}
          </div>
        ),
      },
      {
        id: "acciones",
        encabezado: "Acciones",
        valor: (o) => o.estadoTaller,
        render: (o) => {
          const proc = idProcesando === o.id;
          return (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {o.estadoTaller === "PENDIENTE_ENVIO" && (
                <button
                  type="button"
                  disabled={proc}
                  onClick={() => void handleEnviarIdsATaller([o.id], o.productoResumen)}
                  title="Validar datos y enviar este pedido al Taller"
                  aria-label="Enviar a Taller"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0F172A",
                    color: "#FFFFFF",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: proc ? "wait" : "pointer",
                  }}
                >
                  {proc ? <Loader2 size={13} /> : <Send size={13} />}
                  <span>Enviar a Taller</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setOrdenEditando({ ...o })}
                title="Modificar fecha de entrega, horario, sala o destinatario"
                aria-label="Editar Pedido"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 9px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Edit3 size={12} />
                <span>Editar</span>
              </button>
            </div>
          );
        },
      },
    ],
    [
      hoyYmd,
      idProcesando,
      seleccionadosIds,
      datos.repartidoresNegocio,
      toggleSeleccion,
      handleEnviarIdsATaller,
      handleAsignarRepartidor,
    ]
  );

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "4px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: "9px",
    border: "1px solid #CBD5E1",
    fontSize: "0.85rem",
    background: "#FFFFFF",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Barra Principal de Navegación Operativa */}
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
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {(
            [
              {
                id: "bandeja_envio",
                label: "📤 Validar y Enviar Ventas",
                badge: pendientesEnvio.length,
              },
              {
                id: "exequiales_llamada",
                label: "🕊️ Llamada Exequiales",
                badge: null,
              },
              {
                id: "cargar_manual",
                label: "➕ Cargar Pedido",
                badge: null,
              },
              {
                id: "calendario",
                label: "📅 Calendario Entregas",
                badge: ordenesActivas.filter((o) => o.estadoTaller !== "ENTREGADO").length,
              },
            ] as Array<{ id: PestanaDespacho; label: string; badge: number | null }>
          ).map((tab) => {
            const activa = pestana === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPestana(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 13px",
                  borderRadius: "10px",
                  border: activa ? "1px solid #0F172A" : "1px solid #E2E8F0",
                  background: activa ? "#0F172A" : "#F8FAFC",
                  color: activa ? "#FFFFFF" : "#334155",
                  fontSize: "0.81rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span
                    style={{
                      padding: "1px 7px",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      background: activa ? "rgba(255,255,255,0.22)" : "#E2E8F0",
                      color: activa ? "#FFFFFF" : "#475569",
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link
            href="/panel/taller"
            title="Abrir pantalla de producción del Taller Floral"
            aria-label="Ver Taller"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "9px",
              background: "#ECFDF5",
              border: "1px solid #86EFAC",
              color: "#065F46",
              textDecoration: "none",
              fontSize: "0.79rem",
              fontWeight: 700,
            }}
          >
            <Hammer size={14} />
            <span>Ir a Taller ({enTallerActivas.length})</span>
          </Link>

          <button
            type="button"
            onClick={() => void recargarDatos(false)}
            disabled={cargando}
            title="Sincronizar ventas y pedidos"
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
              fontSize: "0.79rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>
      </div>

      {datos.migracionPendiente && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            color: "#92400E",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={15} />
          <span>
            Operando en modo híbrido sobre ventas y entregas actuales. Ejecuta{" "}
            <code>20261116000001_despacho_pedidos_y_consola_taller.sql</code> en Supabase para
            activar la tabla dedicada <code>com_orden_taller</code> con notificaciones Realtime.
          </span>
        </div>
      )}

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

      {mensajeExito && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            fontSize: "0.83rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 1: BANDEJA DE VALIDACIÓN Y ENVÍO DIARIO A TALLER + CALENDARIO RESUMEN
      ===================================================================== */}
      {pestana === "bandeja_envio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <CalendarioPedidosTaller
            ordenes={ordenesActivas}
            modo="despacho"
            vistaInicial="hoy"
            onEnviarATaller={(o) => void handleEnviarIdsATaller([o.id], o.productoResumen)}
            onEditarOrden={(o) => setOrdenEditando({ ...o })}
            idProcesando={idProcesando}
          />

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
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(
                  [
                    { id: "por_enviar", label: `Por Enviar (${pendientesEnvio.length})` },
                    {
                      id: "hoy",
                      label: `Entrega Hoy (${ordenesActivas.filter((o) => o.fechaEntrega === hoyYmd && o.estadoTaller !== "ENTREGADO").length})`,
                    },
                    {
                      id: "futuros",
                      label: `Mañana / Futuros (${ordenesActivas.filter((o) => o.fechaEntrega > hoyYmd && o.estadoTaller !== "ENTREGADO").length})`,
                    },
                    { id: "ya_en_taller", label: `En Taller (${enTallerActivas.length})` },
                    { id: "todos", label: `Todos (${ordenesActivas.length})` },
                  ] as Array<{ id: FiltroBandeja; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroBandeja(f.id)}
                    style={{
                      padding: "6px 11px",
                      borderRadius: "999px",
                      border:
                        filtroBandeja === f.id ? "1px solid #059669" : "1px solid #CBD5E1",
                      background: filtroBandeja === f.id ? "#ECFDF5" : "#FFFFFF",
                      color: filtroBandeja === f.id ? "#065F46" : "#475569",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {seleccionadosIds.size > 0 && (
                  <button
                    type="button"
                    disabled={enviandoLote}
                    onClick={() => void handleEnviarIdsATaller(Array.from(seleccionadosIds))}
                    title="Enviar los pedidos seleccionados al Taller"
                    aria-label="Enviar Selección"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "9px",
                      border: "none",
                      background: "#059669",
                      color: "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: enviandoLote ? "wait" : "pointer",
                    }}
                  >
                    {enviandoLote ? <Loader2 size={14} /> : <Send size={14} />}
                    <span>Enviar Selección ({seleccionadosIds.size})</span>
                  </button>
                )}

                {pendientesEnvioHoy.length > 0 && (
                  <button
                    type="button"
                    disabled={enviandoLote}
                    onClick={() =>
                      void handleEnviarIdsATaller(
                        pendientesEnvioHoy.map((x) => x.id),
                        `${pendientesEnvioHoy.length} pedido(s) de entrega Hoy`
                      )
                    }
                    title="Despachar a Taller todos los pedidos pendientes cuya entrega es hoy"
                    aria-label="Enviar Pedidos Hoy"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "9px",
                      border: "none",
                      background: "#0F172A",
                      color: "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: enviandoLote ? "wait" : "pointer",
                    }}
                  >
                    {enviandoLote ? <Loader2 size={14} /> : <Send size={14} />}
                    <span>Enviar Hoy ({pendientesEnvioHoy.length})</span>
                  </button>
                )}
              </div>
            </div>

            <DataGrid
              columnas={columnasBandeja}
              filas={filasFiltradas}
              idFila={(o) => o.id}
              nombreExportacion={`despacho-pedidos-taller-${negNorm}`}
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
                    fontSize: "0.8rem",
                  }}
                >
                  <div>
                    <strong>Detalle de Productos:</strong>
                    <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                      {o.items.map((it, idx) => (
                        <li key={idx}>
                          {it.cantidad}× {it.descripcion}
                        </li>
                      ))}
                    </ul>
                    {o.dedicatoria && (
                      <div style={{ marginTop: "6px", color: "#92400E" }}>
                        💌 <strong>Dedicatoria:</strong> {o.dedicatoria}
                      </div>
                    )}
                  </div>
                  <div>
                    <div>
                      <strong>Solicita / Comprador:</strong> {o.clienteSolicita}{" "}
                      {o.clienteTelefono ? `(${o.clienteTelefono})` : ""}
                    </div>
                    <div>
                      <strong>Destinatario / Fallecido:</strong> {o.destinatarioFallecido || "—"}
                    </div>
                    {o.salaServicio && (
                      <div>
                        <strong>Sala Exequiales:</strong> {o.salaServicio}
                      </div>
                    )}
                    <div>
                      <strong>Dirección:</strong> {o.ubicacionEntrega || "—"}
                    </div>
                    {o.observaciones && (
                      <div style={{ marginTop: "4px" }}>
                        <strong>Notas:</strong> {o.observaciones}
                      </div>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: ORDEN RÁPIDA EXEQUIALES VÍA LLAMADA (5 SEGUNDOS)
      ===================================================================== */}
      {pestana === "exequiales_llamada" && (
        <form
          onSubmit={(e) => void handleGuardarLlamadaExequiales(e)}
          style={{
            background: "#FFFFFF",
            border: "2px solid #D8B4FE",
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#FAF5FF",
                color: "#6B21A8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PhoneCall size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0F172A" }}>
                Generar Pedido Exequiales por Llamada → Envío Directo a Taller
              </h3>
              <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                Notifica en vivo al Taller y deja precargada la orden para Confirmación de Entregas.
              </span>
            </div>
          </div>

          {/* Producto Exequiales (por defecto Set condolencias) */}
          <div>
            <label style={labelStyle}>Arreglo Solicitado (el equipo de Taller ya conoce la receta)</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(
                [
                  ...OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES.map((op) => ({
                    valor: op,
                    label: op,
                  })),
                  { valor: "OTROS" as const, label: "Otros (editable)" },
                ] as const
              ).map((op) => {
                const activo = exeqOpcionProd === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => setExeqOpcionProd(op.valor)}
                    style={{
                      flex: "1 1 190px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: activo ? "2px solid #581C87" : "1px solid #CBD5E1",
                      background: activo ? "#581C87" : "#FFFFFF",
                      color: activo ? "#FFFFFF" : "#1E293B",
                      fontSize: "0.83rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
            {exeqOpcionProd === "OTROS" && (
              <input
                type="text"
                value={exeqProdLibre}
                onChange={(e) => setExeqProdLibre(e.target.value)}
                placeholder="Describe el arreglo requerido..."
                style={{ ...inputStyle, marginTop: "8px" }}
              />
            )}
          </div>

          {/* Para cuándo (por defecto Hoy) y Hora */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Para cuándo (Fecha de Entrega — por defecto Hoy) *</label>
              <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <button
                  type="button"
                  onClick={() => setExeqFechaEntrega(hoyYmd)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: "1px solid #CBD5E1",
                    background: exeqFechaEntrega === hoyYmd ? "#0F172A" : "#F8FAFC",
                    color: exeqFechaEntrega === hoyYmd ? "#FFFFFF" : "#334155",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setExeqFechaEntrega(sumarDiasYmd(hoyYmd, 1))}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: "1px solid #CBD5E1",
                    background:
                      exeqFechaEntrega === sumarDiasYmd(hoyYmd, 1) ? "#0F172A" : "#F8FAFC",
                    color:
                      exeqFechaEntrega === sumarDiasYmd(hoyYmd, 1) ? "#FFFFFF" : "#334155",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mañana
                </button>
              </div>
              <input
                type="date"
                value={exeqFechaEntrega}
                onChange={(e) => setExeqFechaEntrega(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Hora del Servicio</label>
              <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <button
                  type="button"
                  onClick={() => setExeqHora("Lo antes posible")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: "1px solid #CBD5E1",
                    background: exeqHora === "Lo antes posible" ? "#581C87" : "#F8FAFC",
                    color: exeqHora === "Lo antes posible" ? "#FFFFFF" : "#334155",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ⚡ Lo antes posible
                </button>
                {["09:00", "11:00", "14:00", "16:00"].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setExeqHora(h)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "999px",
                      border: "1px solid #CBD5E1",
                      background: exeqHora === h ? "#581C87" : "#F8FAFC",
                      color: exeqHora === h ? "#FFFFFF" : "#334155",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={exeqHora}
                onChange={(e) => setExeqHora(e.target.value)}
                placeholder="Ej. 10:30 o Lo antes posible"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Quién solicita (Cristian Montaluisa / Cristina / editable) */}
          <div>
            <label style={labelStyle}>Quién solicita (Coordinador IESS) *</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              {SOLICITANTES_EXEQUIALES_FRECUENTES.map((nom) => {
                const activo = exeqSolicita === nom;
                return (
                  <button
                    key={nom}
                    type="button"
                    onClick={() => setExeqSolicita(nom)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "999px",
                      border: activo ? "2px solid #059669" : "1px solid #CBD5E1",
                      background: activo ? "#ECFDF5" : "#FFFFFF",
                      color: activo ? "#065F46" : "#334155",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    👤 {nom}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={exeqSolicita}
              onChange={(e) => setExeqSolicita(e.target.value)}
              placeholder="Ej. Cristian Montaluisa, Cristina u otro coordinador"
              style={inputStyle}
            />
          </div>

          {/* Sala (Sala 1 a 4 + Capilla / Oficina) */}
          <div>
            <label style={labelStyle}>Sala Asignada</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "8px",
              }}
            >
              {[...OPCIONES_SALA_EXEQUIALES, ""].map((s) => {
                const etiqueta = s || "Por confirmar";
                const activa = exeqSala === s;
                return (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => setExeqSala(s)}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      border: activa ? "2px solid #059669" : "1px solid #CBD5E1",
                      background: activa ? "#059669" : "#FFFFFF",
                      color: activa ? "#FFFFFF" : "#0F172A",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre del Fallecido y Notas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Nombre del Fallecido (si ya lo informaron)</label>
              <input
                type="text"
                value={exeqFallecido}
                onChange={(e) => setExeqFallecido(e.target.value)}
                placeholder="Ej. Rodríguez Navarrete Myrian Graciela (o completar al entregar)"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Notas para Taller / Cinta (opcional)</label>
              <input
                type="text"
                value={exeqNotas}
                onChange={(e) => setExeqNotas(e.target.value)}
                placeholder="Ej. Cinta institucional, tonos blancos..."
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={guardandoExeq}
              title="Generar orden Exequiales y notificar de inmediato al Taller"
              aria-label="Enviar Exequiales"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 22px",
                borderRadius: "10px",
                border: "none",
                background: "#581C87",
                color: "#FFFFFF",
                fontSize: "0.9rem",
                fontWeight: 800,
                cursor: guardandoExeq ? "wait" : "pointer",
              }}
            >
              {guardandoExeq ? <Loader2 size={16} /> : <Send size={16} />}
              <span>Enviar a Taller</span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          PESTAÑA 3: CARGAR PEDIDO MANUAL CONOCIDO DE ANTEMANO (HOY / MAÑANA / MIÉRCOLES)
      ===================================================================== */}
      {pestana === "cargar_manual" && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0F172A" }}>
              Cargar Pedido (WhatsApp / Teléfono / Tienda)
            </h3>
            <span style={{ fontSize: "0.79rem", color: "#64748B" }}>
              Programa la fecha real de entrega (hoy, mañana o cualquier día futuro) y elige si
              dejarlo pendiente de validación o enviarlo de una vez al Taller.
            </span>
          </div>

          {/* 1. FECHA DE ENTREGA (PRINCIPAL) Y RANGO DE HORARIO A / B / C */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "#F0FDF4",
              border: "1px solid #86EFAC",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "14px",
            }}
          >
            <div>
              <label style={{ ...labelStyle, color: "#065F46" }}>
                📅 Fecha de Entrega * (Dato principal)
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                {[
                  { label: "Hoy", ymd: hoyYmd },
                  { label: "Mañana", ymd: sumarDiasYmd(hoyYmd, 1) },
                  { label: "Pasado mañana", ymd: sumarDiasYmd(hoyYmd, 2) },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setManFechaEntrega(b.ymd)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: "999px",
                      border: "1px solid #059669",
                      background: manFechaEntrega === b.ymd ? "#059669" : "#FFFFFF",
                      color: manFechaEntrega === b.ymd ? "#FFFFFF" : "#065F46",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={manFechaEntrega}
                onChange={(e) => setManFechaEntrega(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ ...labelStyle, color: "#065F46" }}>
                ⏳ Rango de Horario de Entrega
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => {
                  const activo = manFranja === r.valor;
                  return (
                    <button
                      key={r.codigo}
                      type="button"
                      onClick={() => setManFranja(r.valor)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "9px",
                        border: activo ? "2px solid #0F172A" : "1px solid #CBD5E1",
                        background: activo ? "#0F172A" : "#FFFFFF",
                        color: activo ? "#FFFFFF" : "#1E293B",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      {r.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. DETALLE DEL PRODUCTO */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <label style={labelStyle}>💐 Detalle del Producto / Arreglo *</label>

            {datos.productosCatalogo.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <select
                  value={manSkuSeleccionado}
                  onChange={(e) => setManSkuSeleccionado(e.target.value)}
                  style={{ ...inputStyle, flex: "1 1 260px" }}
                >
                  <option value="">-- Seleccionar producto del catálogo Tinkay --</option>
                  {datos.productosCatalogo.map((p) => (
                    <option key={`${p.productoId}::${p.sku}`} value={`${p.productoId}::${p.sku}`}>
                      {p.productoNombre}{" "}
                      {p.varianteNombre && p.varianteNombre !== "Estándar"
                        ? `(${p.varianteNombre})`
                        : ""}{" "}
                      — ${p.pvp.toFixed(2)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={manCantidadSel}
                  onChange={(e) => setManCantidadSel(Number(e.target.value) || 1)}
                  style={{ ...inputStyle, width: "80px" }}
                />
                <button
                  type="button"
                  onClick={handleAgregarItemCatalogo}
                  title="Añadir producto al pedido"
                  aria-label="Agregar Producto"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "9px 14px",
                    borderRadius: "9px",
                    border: "none",
                    background: "#0F172A",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  <span>Agregar</span>
                </button>
              </div>
            )}

            {manItems.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {manItems.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                    }}
                  >
                    <strong>
                      {it.cantidad}× {it.descripcion}
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        setManItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      title="Quitar ítem"
                      aria-label="Quitar ítem"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#DC2626",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="text"
              value={manDetalleLibre}
              onChange={(e) => setManDetalleLibre(e.target.value)}
              placeholder="O escribe aquí el detalle libre del arreglo (ej. Bouquet 24 rosas rojas + Ferrero)"
              style={inputStyle}
            />
          </div>

          {/* 3. CLIENTE, DESTINATARIO Y DEDICATORIA */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Comprador / Quién pide *</label>
              <input
                type="text"
                value={manCliente}
                onChange={(e) => setManCliente(e.target.value)}
                placeholder="Nombre del cliente"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>WhatsApp / Teléfono</label>
              <input
                type="text"
                value={manTelefono}
                onChange={(e) => setManTelefono(e.target.value)}
                placeholder="099..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Destinatario (quien recibe)</label>
              <input
                type="text"
                value={manDestinatario}
                onChange={(e) => setManDestinatario(e.target.value)}
                placeholder="Nombre del destinatario"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Valor Total USD (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={manTotalUsd}
                onChange={(e) => setManTotalUsd(e.target.value)}
                placeholder="0.00"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Dirección de Entrega</label>
              <input
                type="text"
                value={manDireccion}
                onChange={(e) => setManDireccion(e.target.value)}
                placeholder="Sector, calles y edificio"
                disabled={manRetiroLocal}
                style={inputStyle}
              />
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.76rem",
                  marginTop: "6px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={manRetiroLocal}
                  onChange={(e) => setManRetiroLocal(e.target.checked)}
                />
                <span>🏪 Retiro en Tienda</span>
              </label>
            </div>

            <div>
              <label style={labelStyle}>Tarjeta Dedicatoria (opcional)</label>
              <input
                type="text"
                value={manDedicatoria}
                onChange={(e) => setManDedicatoria(e.target.value)}
                placeholder="Mensaje para la tarjeta impresa"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Indicaciones para Taller</label>
              <input
                type="text"
                value={manObservaciones}
                onChange={(e) => setManObservaciones(e.target.value)}
                placeholder="Papel negro, tonos pastel, etc."
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              flexWrap: "wrap",
              paddingTop: "8px",
              borderTop: "1px solid #F1F5F9",
            }}
          >
            <button
              type="button"
              disabled={guardandoManual}
              onClick={() => void guardarPedidoManual(false)}
              title="Guardar pedido programado en bandeja para enviarlo el día que corresponda"
              aria-label="Guardar Pedido"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #0F172A",
                background: "#FFFFFF",
                color: "#0F172A",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: guardandoManual ? "wait" : "pointer",
              }}
            >
              <Save size={15} />
              <span>Guardar Pedido</span>
            </button>

            <button
              type="button"
              disabled={guardandoManual}
              onClick={() => void guardarPedidoManual(true)}
              title="Guardar y enviar de inmediato al Taller con notificación"
              aria-label="Enviar a Taller"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                background: "#059669",
                color: "#FFFFFF",
                fontSize: "0.85rem",
                fontWeight: 800,
                cursor: guardandoManual ? "wait" : "pointer",
              }}
            >
              {guardandoManual ? <Loader2 size={15} /> : <Send size={15} />}
              <span>Enviar a Taller</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: CALENDARIO COMPLETO (HOY / SEMANA / MES)
      ===================================================================== */}
      {pestana === "calendario" && (
        <CalendarioPedidosTaller
          ordenes={ordenesActivas}
          modo="despacho"
          vistaInicial="mes"
          onEnviarATaller={(o) => void handleEnviarIdsATaller([o.id], o.productoResumen)}
          onEditarOrden={(o) => setOrdenEditando({ ...o })}
          idProcesando={idProcesando}
        />
      )}

      {/* MODAL DE EDICIÓN RÁPIDA DE PEDIDO */}
      {ordenEditando && (
        <div
          onClick={() => setOrdenEditando(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <form
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={(e) => void handleGuardarEdicionModal(e)}
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              maxWidth: "520px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.98rem", color: "#0F172A" }}>
                Editar Pedido ({ordenEditando.codigo})
              </strong>
              <button
                type="button"
                onClick={() => setOrdenEditando(null)}
                title="Cerrar"
                aria-label="Cerrar"
                style={{
                  border: "none",
                  background: "#F1F5F9",
                  borderRadius: "8px",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label style={labelStyle}>Fecha de Entrega *</label>
              <input
                type="date"
                value={(ordenEditando.fechaEntrega || hoyYmd).slice(0, 10)}
                onChange={(e) =>
                  setOrdenEditando((prev) =>
                    prev ? { ...prev, fechaEntrega: e.target.value } : null
                  )
                }
                style={inputStyle}
              />
            </div>

            {ordenEditando.origenTipo === "EXEQUIALES_LLAMADA" ? (
              <>
                <div>
                  <label style={labelStyle}>Hora del Servicio</label>
                  <input
                    type="text"
                    value={ordenEditando.horaEspecifica ?? ""}
                    onChange={(e) =>
                      setOrdenEditando((prev) =>
                        prev ? { ...prev, horaEspecifica: e.target.value } : null
                      )
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Sala</label>
                  <select
                    value={ordenEditando.salaServicio ?? ""}
                    onChange={(e) =>
                      setOrdenEditando((prev) =>
                        prev ? { ...prev, salaServicio: e.target.value } : null
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="">Por confirmar</option>
                    {OPCIONES_SALA_EXEQUIALES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label style={labelStyle}>Rango de Horario</label>
                <select
                  value={ordenEditando.franjaHoraria || "A) 09:00 - 13:00"}
                  onChange={(e) =>
                    setOrdenEditando((prev) =>
                      prev ? { ...prev, franjaHoraria: e.target.value } : null
                    )
                  }
                  style={inputStyle}
                >
                  {RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => (
                    <option key={r.codigo} value={r.valor}>
                      {r.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Detalle del Producto</label>
              <input
                type="text"
                value={ordenEditando.productoResumen}
                onChange={(e) =>
                  setOrdenEditando((prev) =>
                    prev ? { ...prev, productoResumen: e.target.value } : null
                  )
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Solicita / Comprador</label>
              <input
                type="text"
                value={ordenEditando.clienteSolicita}
                onChange={(e) =>
                  setOrdenEditando((prev) =>
                    prev ? { ...prev, clienteSolicita: e.target.value } : null
                  )
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Destinatario / Nombre del Fallecido</label>
              <input
                type="text"
                value={ordenEditando.destinatarioFallecido}
                onChange={(e) =>
                  setOrdenEditando((prev) =>
                    prev ? { ...prev, destinatarioFallecido: e.target.value } : null
                  )
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Notas / Observaciones</label>
              <input
                type="text"
                value={ordenEditando.observaciones ?? ""}
                onChange={(e) =>
                  setOrdenEditando((prev) =>
                    prev ? { ...prev, observaciones: e.target.value } : null
                  )
                }
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setOrdenEditando(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoEdicion}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {guardandoEdicion ? <Loader2 size={14} /> : <Save size={14} />}
                <span>Guardar</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
