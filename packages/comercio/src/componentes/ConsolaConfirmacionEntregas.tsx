"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CloudOff,
  Download,
  Edit3,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Smartphone,
  Upload,
  Wifi,
  X,
} from "lucide-react";
import {
  actualizarEntregaEvidenciaAction,
  actualizarUbicacionRutaDeliveryAction,
  emitirInformeQuincenalAction,
  obtenerTableroEntregasAction,
  registrarOSincronizarEntregaAction,
  subirArchivoEvidenciaServidorAction,
  type DatosTableroEntregas,
} from "../acciones-operaciones-taller";
import {
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
  OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES,
  OPCIONES_SALA_EXEQUIALES,
  eliminarDeColaOfflineEntrega,
  guardarEntregaEnColaOffline,
  listarColaOfflineEntregas,
  type DatosProveedorInformeIess,
  type InformeQuincenalEntregas,
  type ItemColaOfflineEntrega,
  type RegistroEntregaEvidencia,
  type TipoOrigenEntrega,
} from "../operaciones-taller";
import { generarPdfInformeQuincenalIess } from "../pdf-informe-iess";
import {
  compartirImagenEvidenciaWhatsapp,
  dataUrlABlob,
  estamparDataUrlConTarjetaGps,
  generarTarjetaMapaGpsDataUrl,
  leerYComprimirFotoBase,
  obtenerDireccionLegibleGps,
  subirArchivoOperativoStorage,
  type DireccionGpsResuelta,
} from "../utils/evidenciaImagenGps";

export interface PropsConsolaConfirmacionEntregas {
  negocio: string;
  datosIniciales?: DatosTableroEntregas | null;
  modoRolDelivery?: "DELIVERY" | "DELIVERY_EXTERNO" | null;
}

type PestanaEntregas = "captura" | "ordenes_ot" | "informe_quincenal" | "historico";

function fechaHoyIsoCorto(): string {
  return new Date().toISOString().slice(0, 10);
}

function fechaInicioQuincenaIso(): string {
  const hoy = new Date();
  const dia = hoy.getDate();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), dia <= 15 ? 1 : 16);
  return inicio.toISOString().slice(0, 10);
}

export function ConsolaConfirmacionEntregas({
  negocio,
  datosIniciales = null,
  modoRolDelivery = null,
}: PropsConsolaConfirmacionEntregas) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_tablero_entregas_${negNorm}`;

  const [tablero, setTablero] = useState<DatosTableroEntregas>(
    datosIniciales ?? {
      usuarioActualId: null,
      usuarioActualNombre: "Colaborador",
      esAdminOperador: modoRolDelivery == null,
      esSubcontratado: modoRolDelivery === "DELIVERY_EXTERNO",
      convenios: [
        {
          id: "conv-exequiales-defecto",
          codigo: "EXEQUIALES_IESS",
          nombre: "Exequiales del IESS",
          prefijoInforme: "INF-IESS",
          siguienteNumero: 1,
          datosProveedor: DATOS_PROVEEDOR_TINKAY_DEFECTO,
        },
      ],
      entregas: [],
      informes: [],
      pedidosPendientesTienda: [],
    }
  );
  const esSubcontratado =
    modoRolDelivery === "DELIVERY_EXTERNO" || Boolean(tablero.esSubcontratado);

  const [pestana, setPestana] = useState<PestanaEntregas>("captura");
  const [enLinea, setEnLinea] = useState<boolean>(true);
  const [colaOffline, setColaOffline] = useState<ItemColaOfflineEntrega[]>([]);
  const [sincronizandoOffline, setSincronizandoOffline] = useState<boolean>(false);
  const [eventoInstalacionPwa, setEventoInstalacionPwa] = useState<any>(null);
  const [appInstalada, setAppInstalada] = useState<boolean>(false);
  const [esDispositivoIos, setEsDispositivoIos] = useState<boolean>(false);
  const [mostrarGuiaPwa, setMostrarGuiaPwa] = useState<boolean>(false);

  const [cargando, setCargando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [compartiendoWhatsapp, setCompartiendoWhatsapp] = useState<boolean>(false);
  const [ultimaFotoConfirmada, setUltimaFotoConfirmada] = useState<{
    imagenOrigen: string;
    urlPublica?: string | null;
    textoResumen: string;
    codigoOt: string;
  } | null>(null);

  // =========================================================================
  // ESTADO DE CAPTURA EN CAMPO (ONLINE + OFFLINE)
  // =========================================================================
  const [tipoOrigenCaptura, setTipoOrigenCaptura] = useState<TipoOrigenEntrega>(
    "ORDEN_TRABAJO_CONVENIO"
  );
  const [otSeleccionadaId, setOtSeleccionadaId] = useState<string>("");
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string>("");

  const [salaServicio, setSalaServicio] = useState<string>("");
  const [opcionServicio, setOpcionServicio] = useState<
    "Set condolencias (3 arreglos)" | "Cubre cofre (1 arreglo)" | "OTROS"
  >("Set condolencias (3 arreglos)");
  const [descripcionServicioLibre, setDescripcionServicioLibre] = useState<string>("");
  const [fallecidoDestinatario, setFallecidoDestinatario] = useState<string>("");
  const [ubicacionNombre, setUbicacionNombre] = useState<string>("");
  const [coordinadorNombre, setCoordinadorNombre] = useState<string>("");
  const [recursosUtilizados, setRecursosUtilizados] = useState<string>(
    "Flores, follaje, bases y oasis"
  );
  const [observacionesCaptura, setObservacionesCaptura] = useState<string>("");

  const descripcionServicio = useMemo(() => {
    if (tipoOrigenCaptura === "PEDIDO_TIENDA") {
      return descripcionServicioLibre.trim() || "Entrega de pedido floral";
    }
    if (opcionServicio === "OTROS") {
      return descripcionServicioLibre.trim() || "Arreglo exequial personalizado";
    }
    return opcionServicio;
  }, [tipoOrigenCaptura, opcionServicio, descripcionServicioLibre]);

  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [precisionMetros, setPrecisionMetros] = useState<number | null>(null);
  const [direccionGpsResuelta, setDireccionGpsResuelta] =
    useState<DireccionGpsResuelta | null>(null);
  const [obteniendoGps, setObteniendoGps] = useState<boolean>(false);
  const [estadoGpsTexto, setEstadoGpsTexto] = useState<string>("Listo para capturar GPS");
  const [enRutaActiva, setEnRutaActiva] = useState<boolean>(false);
  const [ultimoPulsoRutaTexto, setUltimoPulsoRutaTexto] = useState<string>("");
  const watchIdRutaRef = useRef<number | null>(null);
  const ultimoEnvioRutaTsRef = useRef<number>(0);

  const [fotoBaseSinSelloDataUrl, setFotoBaseSinSelloDataUrl] = useState<string>("");
  const [fotoCapturadaDataUrl, setFotoCapturadaDataUrl] = useState<string>("");
  const [mapaGeneradoDataUrl, setMapaGeneradoDataUrl] = useState<string>("");
  const [horaCapturaIso, setHoraCapturaIso] = useState<string>("");
  const [procesandoFoto, setProcesandoFoto] = useState<boolean>(false);
  const [guardandoEntrega, setGuardandoEntrega] = useState<boolean>(false);

  // =========================================================================
  // ESTADO DE PROGRAMACIÓN RÁPIDA DE ORDEN DE TRABAJO (TALLER / ADMIN)
  // =========================================================================
  const [otNuevaSala, setOtNuevaSala] = useState<string>("Sala 1");
  const [otNuevaFallecido, setOtNuevaFallecido] = useState<string>("");
  const [otNuevaUbicacion, setOtNuevaUbicacion] = useState<string>("");
  const [otNuevaOpcionServicio, setOtNuevaOpcionServicio] = useState<
    "Set condolencias (3 arreglos)" | "Cubre cofre (1 arreglo)" | "OTROS"
  >("Set condolencias (3 arreglos)");
  const [otNuevaDescripcionLibre, setOtNuevaDescripcionLibre] = useState<string>("");
  const [otNuevaCoordinador, setOtNuevaCoordinador] = useState<string>("");
  const [creandoOt, setCreandoOt] = useState<boolean>(false);

  // Edición de entrega antes del informe
  const [entregaEditando, setEntregaEditando] = useState<RegistroEntregaEvidencia | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);
  const [subiendoFotoEdicion, setSubiendoFotoEdicion] = useState<boolean>(false);
  const [filtroHistoricoEntregas, setFiltroHistoricoEntregas] = useState<
    "TODAS" | "EXEQUIALES" | "TIENDA"
  >("TODAS");

  // =========================================================================
  // ESTADO DEL GENERADOR DE INFORME QUINCENAL IESS
  // =========================================================================
  const convenioPrincipal = tablero.convenios[0];
  const [fechaInicioInf, setFechaInicioInf] = useState<string>(fechaInicioQuincenaIso());
  const [fechaFinInf, setFechaFinInf] = useState<string>(fechaHoyIsoCorto());
  const [fechaEmisionInf, setFechaEmisionInf] = useState<string>(fechaHoyIsoCorto());
  const [numeroInforme, setNumeroInforme] = useState<string>("");
  const [facturaGlobalInf, setFacturaGlobalInf] = useState<string>("");
  const [docsAdjuntosGlobalInf, setDocsAdjuntosGlobalInf] = useState<string>("");
  const [incluirPortada, setIncluirPortada] = useState<boolean>(true);
  const [datosProveedorForm, setDatosProveedorForm] = useState<DatosProveedorInformeIess>(
    convenioPrincipal?.datosProveedor ?? DATOS_PROVEEDOR_TINKAY_DEFECTO
  );
  const [idsExcluidosInforme, setIdsExcluidosInforme] = useState<Set<string>>(new Set());
  const [incluirYaLiquidadas, setIncluirYaLiquidadas] = useState<boolean>(false);
  const [generandoPdf, setGenerandoPdf] = useState<boolean>(false);

  // Inicializar sugerencia de numeración del informe
  useEffect(() => {
    if (convenioPrincipal && !numeroInforme) {
      const anio = new Date().getFullYear();
      const corr = String(convenioPrincipal.siguienteNumero || 1).padStart(3, "0");
      setNumeroInforme(`${convenioPrincipal.prefijoInforme || "INF-IESS"}-${anio}-${corr}`);
      if (convenioPrincipal.datosProveedor) {
        setDatosProveedorForm({
          ...DATOS_PROVEEDOR_TINKAY_DEFECTO,
          ...convenioPrincipal.datosProveedor,
        });
      }
    }
  }, [convenioPrincipal, numeroInforme]);

  const refrescarColaOffline = useCallback(async () => {
    const items = await listarColaOfflineEntregas(negNorm);
    setColaOffline(items);
  }, [negNorm]);

  const recargarTablero = useCallback(
    async (silencioso = false) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await refrescarColaOffline();
        return;
      }
      if (!silencioso) setCargando(true);
      const res = await obtenerTableroEntregasAction(negNorm);
      if (!silencioso) setCargando(false);
      if (!res.ok) {
        if (!silencioso) setErrorMsg(res.error);
        return;
      }
      setTablero(res.datos);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.datos));
      } catch {
        // Ignorar cuota
      }
      await refrescarColaOffline();
    },
    [negNorm, cacheKey, refrescarColaOffline]
  );

  // Registro de Service Worker Offline + detección de red + prompt de instalación PWA
  useEffect(() => {
    if (typeof window === "undefined") return;

    setEnLinea(navigator.onLine !== false);
    const onOnline = () => setEnLinea(true);
    const onOffline = () => setEnLinea(false);

    const esStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setAppInstalada(esStandalone);

    const ua = window.navigator.userAgent || "";
    setEsDispositivoIos(/iphone|ipad|ipod/i.test(ua));

    const globalPrompt = (window as unknown as { __ecoDeferredInstallPrompt?: any })
      .__ecoDeferredInstallPrompt;
    if (globalPrompt) {
      setEventoInstalacionPwa(globalPrompt);
    }

    const onBeforeInstall = (ev: Event) => {
      ev.preventDefault();
      (window as unknown as { __ecoDeferredInstallPrompt?: any }).__ecoDeferredInstallPrompt = ev;
      setEventoInstalacionPwa(ev);
    };

    const onAppInstalled = () => {
      setAppInstalada(true);
      setEventoInstalacionPwa(null);
      setMostrarGuiaPwa(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-operaciones.js", { scope: "/" }).catch(() => {});
    }

    if (!datosIniciales) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as DatosTableroEntregas;
          if (parsed && Array.isArray(parsed.entregas)) {
            setTablero(parsed);
          }
        }
      } catch {
        // Ignorar
      }
      void recargarTablero(false);
    } else {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(datosIniciales));
      } catch {
        // Ignorar
      }
      void refrescarColaOffline();
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [datosIniciales, cacheKey, recargarTablero, refrescarColaOffline]);

  const handleInstalarPwa = useCallback(async () => {
    const promptObj =
      eventoInstalacionPwa ||
      (typeof window !== "undefined"
        ? (window as unknown as { __ecoDeferredInstallPrompt?: any }).__ecoDeferredInstallPrompt
        : null);

    if (promptObj && typeof promptObj.prompt === "function") {
      try {
        await promptObj.prompt();
        const choice = await promptObj.userChoice?.catch(() => null);
        if (choice?.outcome === "accepted") {
          setAppInstalada(true);
          setEventoInstalacionPwa(null);
          (window as unknown as { __ecoDeferredInstallPrompt?: any }).__ecoDeferredInstallPrompt =
            null;
        }
        return;
      } catch {
        // Si ya fue consumido, mostrar guía rápida
      }
    }
    setMostrarGuiaPwa(true);
  }, [eventoInstalacionPwa]);

  // Sincronizador automático de la cola IndexedDB cuando vuelve el internet
  const sincronizarPendientesOffline = useCallback(async () => {
    if (sincronizandoOffline) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorMsg("El teléfono sigue sin conexión a internet. Tus entregas están seguras en memoria.");
      return;
    }

    const pendientes = await listarColaOfflineEntregas(negNorm);
    if (pendientes.length === 0) return;

    setSincronizandoOffline(true);
    setErrorMsg(null);
    const supabase = crearClienteNavegador();
    let sincronizadas = 0;

    for (const item of pendientes) {
      try {
        let fotoUrlFinal: string | null = null;
        let mapaUrlFinal: string | null = null;

        if (item.fotoDataUrl) {
          const upFoto = await subirArchivoOperativoStorage(
            supabase,
            "evidencias-entregas",
            negNorm,
            dataUrlABlob(item.fotoDataUrl),
            "jpg",
            "image/jpeg"
          );
          if (upFoto.ok) {
            fotoUrlFinal = upFoto.publicUrl;
          } else {
            const upSrv = await subirArchivoEvidenciaServidorAction({
              negocio: negNorm,
              carpeta: "evidencias-entregas",
              dataUrl: item.fotoDataUrl,
              extension: "jpg",
            });
            if (upSrv.ok) fotoUrlFinal = upSrv.publicUrl;
          }
        }

        if (item.mapaDataUrl) {
          const upMapa = await subirArchivoOperativoStorage(
            supabase,
            "evidencias-entregas",
            negNorm,
            dataUrlABlob(item.mapaDataUrl),
            "jpg",
            "image/jpeg"
          );
          if (upMapa.ok) {
            mapaUrlFinal = upMapa.publicUrl;
          } else {
            const upMapaSrv = await subirArchivoEvidenciaServidorAction({
              negocio: negNorm,
              carpeta: "evidencias-entregas",
              dataUrl: item.mapaDataUrl,
              extension: "jpg",
            });
            if (upMapaSrv.ok) mapaUrlFinal = upMapaSrv.publicUrl;
          }
        }

        const resSync = await registrarOSincronizarEntregaAction({
          negocio: negNorm,
          uuidCliente: item.uuidCliente,
          entregaId: item.entregaIdProgramada ?? null,
          tipoOrigen: item.tipoOrigen,
          convenioId: item.convenioId,
          proformaId: item.proformaId,
          entregadorNombre: item.entregadorNombre,
          salaServicio: item.salaServicio ?? undefined,
          fallecidoDestinatario: item.fallecidoDestinatario,
          fechaServicio: item.fechaServicio,
          capturadoEn: item.capturadoEn,
          descripcionServicio: item.descripcionServicio,
          ubicacionNombre: item.ubicacionNombre,
          coordinadorNombre: item.coordinadorNombre,
          recursosUtilizados: item.recursosUtilizados,
          latitud: item.latitud,
          longitud: item.longitud,
          precisionMetros: item.precisionMetros,
          direccionGps: item.direccionGps,
          fotoUrl: fotoUrlFinal,
          mapaUrl: mapaUrlFinal,
          observaciones: item.observaciones,
        });

        if (resSync.ok) {
          await eliminarDeColaOfflineEntrega(item.uuidCliente);
          sincronizadas++;
        }
      } catch {
        // Mantener en IndexedDB para el siguiente intento
      }
    }

    setSincronizandoOffline(false);
    await refrescarColaOffline();
    if (sincronizadas > 0) {
      setMensajeExito(`✅ ${sincronizadas} entrega(s) offline sincronizada(s) con el servidor.`);
      await recargarTablero(true);
    }
  }, [negNorm, sincronizandoOffline, refrescarColaOffline, recargarTablero]);

  useEffect(() => {
    if (enLinea && colaOffline.length > 0) {
      void sincronizarPendientesOffline();
    }
  }, [enLinea, colaOffline.length, sincronizarPendientesOffline]);

  // Captura de coordenadas GPS del dispositivo + geocodificación inversa legible
  const capturarUbicacionGps = useCallback((): Promise<{
    lat: number;
    lng: number;
    acc: number;
    dir: DireccionGpsResuelta | null;
  } | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setEstadoGpsTexto("GPS no soportado en este navegador");
        resolve(null);
        return;
      }
      setObteniendoGps(true);
      setEstadoGpsTexto("Obteniendo señal satelital GPS...");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          setLatitud(lat);
          setLongitud(lng);
          setPrecisionMetros(acc);
          setObteniendoGps(false);

          let dir: DireccionGpsResuelta | null = null;
          try {
            dir = await obtenerDireccionLegibleGps(lat, lng);
            setDireccionGpsResuelta(dir);
          } catch {
            // Ignorar si no hay red
          }

          setEstadoGpsTexto(
            dir?.direccionCompleta
              ? `GPS listo (±${Math.round(acc)}m): ${dir.direccionCompleta.slice(0, 58)}`
              : `GPS listo: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(acc)}m)`
          );
          try {
            const mapaData = await generarTarjetaMapaGpsDataUrl(
              lat,
              lng,
              acc,
              ubicacionNombre || dir?.direccionCompleta
            );
            setMapaGeneradoDataUrl(mapaData);
          } catch {
            // Ignorar
          }
          resolve({ lat, lng, acc, dir });
        },
        (err) => {
          setObteniendoGps(false);
          setEstadoGpsTexto(`Activa la ubicación GPS (${err.message})`);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }, [ubicacionNombre]);

  // Seleccionar una OT programada de Exequiales
  const otsProgramadas = useMemo(
    () =>
      tablero.entregas.filter(
        (e) => e.tipoOrigen === "ORDEN_TRABAJO_CONVENIO" && e.estado === "PROGRAMADA"
      ),
    [tablero.entregas]
  );

  const pedidoTiendaSeleccionadoObj = useMemo(
    () =>
      tablero.pedidosPendientesTienda.find((p) => p.proformaId === pedidoSeleccionadoId) ?? null,
    [tablero.pedidosPendientesTienda, pedidoSeleccionadoId]
  );

  // Preseleccionar automáticamente el pedido cuando se ingresa desde una notificación Push (?pedido=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const aplicarPedidoUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const cod = (params.get("pedido") || params.get("codigo") || "").trim().toUpperCase();
        if (!cod) return;

        const matchTienda = tablero.pedidosPendientesTienda.find(
          (p) =>
            p.codigoOrden.toUpperCase() === cod ||
            p.codigoOrden.toUpperCase().includes(cod) ||
            p.proformaId.toUpperCase() === cod
        );
        if (matchTienda) {
          setPestana("captura");
          setTipoOrigenCaptura("PEDIDO_TIENDA");
          setPedidoSeleccionadoId(matchTienda.proformaId);
          return;
        }

        const matchOt = tablero.entregas.find(
          (e) =>
            e.tipoOrigen === "ORDEN_TRABAJO_CONVENIO" &&
            e.estado === "PROGRAMADA" &&
            (e.codigoOt.toUpperCase() === cod || e.id.toUpperCase() === cod)
        );
        if (matchOt) {
          setPestana("captura");
          setTipoOrigenCaptura("ORDEN_TRABAJO_CONVENIO");
          setOtSeleccionadaId(matchOt.id);
          return;
        }

        const matchEntregada = tablero.entregas.find(
          (e) =>
            e.codigoOt.toUpperCase().includes(cod) ||
            (e.proformaId && e.proformaId.toUpperCase() === cod)
        );
        if (matchEntregada) {
          setPestana("historico");
        }
      } catch {
        // Ignorar
      }
    };
    aplicarPedidoUrl();
    window.addEventListener("eco:abrir-ruta-push", aplicarPedidoUrl);
    return () => window.removeEventListener("eco:abrir-ruta-push", aplicarPedidoUrl);
  }, [tablero.pedidosPendientesTienda, tablero.entregas]);

  const otSeleccionadaObj = useMemo(
    () => otsProgramadas.find((x) => x.id === otSeleccionadaId) ?? null,
    [otsProgramadas, otSeleccionadaId]
  );

  const emitirPulsoRuta = useCallback(
    async (params: { enRuta: boolean; lat?: number | null; lng?: number | null; acc?: number | null }) => {
      const ordenTallerId =
        tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
          ? otSeleccionadaObj?.ordenTallerId ?? null
          : pedidoTiendaSeleccionadoObj?.ordenTallerId ?? null;
      const entregaId =
        tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? otSeleccionadaId || null : null;
      const proformaId =
        tipoOrigenCaptura === "PEDIDO_TIENDA" ? pedidoSeleccionadoId || null : null;

      try {
        const supabase = crearClienteNavegador();
        const ch = supabase.channel(`eco-taller-${negNorm}`);
        await ch.subscribe();
        await ch.send({
          type: "broadcast",
          event: "ubicacion_delivery_ruta",
          payload: {
            ordenTallerId,
            entregaId,
            proformaId,
            enRuta: params.enRuta,
            lat: params.lat ?? null,
            lng: params.lng ?? null,
            repartidorNombre: tablero.usuarioActualNombre,
            emitidoEn: new Date().toISOString(),
          },
        });
        void supabase.removeChannel(ch);
      } catch {
        // Ignorar sin red
      }

      if (typeof navigator === "undefined" || navigator.onLine !== false) {
        await actualizarUbicacionRutaDeliveryAction({
          negocio: negNorm,
          ordenTallerId,
          entregaId,
          proformaId,
          enRuta: params.enRuta,
          latitud: params.lat ?? null,
          longitud: params.lng ?? null,
          precision: params.acc ?? null,
        }).catch(() => {});
      }
    },
    [
      negNorm,
      otSeleccionadaId,
      otSeleccionadaObj,
      pedidoSeleccionadoId,
      pedidoTiendaSeleccionadoObj,
      tablero.usuarioActualNombre,
      tipoOrigenCaptura,
    ]
  );

  const detenerSeguimientoRuta = useCallback(
    async (notificarServidor = true) => {
      if (watchIdRutaRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation?.clearWatch(watchIdRutaRef.current);
        watchIdRutaRef.current = null;
      }
      setEnRutaActiva(false);
      setUltimoPulsoRutaTexto("");
      if (notificarServidor) {
        await emitirPulsoRuta({ enRuta: false, lat: latitud, lng: longitud, acc: precisionMetros });
      }
    },
    [emitirPulsoRuta, latitud, longitud, precisionMetros]
  );

  const iniciarSeguimientoRuta = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMsg("El teléfono no permite compartir ubicación GPS en este navegador.");
      return;
    }
    if (watchIdRutaRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRutaRef.current);
    }
    setEnRutaActiva(true);
    ultimoEnvioRutaTsRef.current = 0;
    setUltimoPulsoRutaTexto("Activando GPS en vivo...");

    watchIdRutaRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        setLatitud(lat);
        setLongitud(lng);
        setPrecisionMetros(acc);
        const ahora = Date.now();
        if (ahora - ultimoEnvioRutaTsRef.current >= 14000) {
          ultimoEnvioRutaTsRef.current = ahora;
          setUltimoPulsoRutaTexto(
            `En ruta · ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} (±${Math.round(acc)}m)`
          );
          void emitirPulsoRuta({ enRuta: true, lat, lng, acc });
        }
      },
      (err) => {
        setUltimoPulsoRutaTexto(`Señal GPS débil (${err.message})`);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }, [emitirPulsoRuta]);

  useEffect(() => {
    return () => {
      if (watchIdRutaRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation?.clearWatch(watchIdRutaRef.current);
      }
    };
  }, []);

  const handleSeleccionarOtProgramada = (otId: string) => {
    setOtSeleccionadaId(otId);
    if (!otId) {
      setSalaServicio("");
      setFallecidoDestinatario("");
      setCoordinadorNombre("");
      return;
    }
    const ot = otsProgramadas.find((x) => x.id === otId);
    if (ot) {
      setSalaServicio(ot.salaServicio || "");
      setFallecidoDestinatario(
        ot.fallecidoDestinatario.startsWith("Por confirmar") ? "" : ot.fallecidoDestinatario
      );
      setUbicacionNombre(ot.ubicacionNombre || "");
      if (
        ot.descripcionServicio === "Set condolencias (3 arreglos)" ||
        ot.descripcionServicio === "Cubre cofre (1 arreglo)"
      ) {
        setOpcionServicio(ot.descripcionServicio);
        setDescripcionServicioLibre("");
      } else if (ot.descripcionServicio.toLowerCase().includes("cubre cofre")) {
        setOpcionServicio("Cubre cofre (1 arreglo)");
        setDescripcionServicioLibre("");
      } else if (ot.descripcionServicio.toLowerCase().includes("condolencia")) {
        setOpcionServicio("Set condolencias (3 arreglos)");
        setDescripcionServicioLibre("");
      } else {
        setOpcionServicio("OTROS");
        setDescripcionServicioLibre(ot.descripcionServicio);
      }
      setCoordinadorNombre(ot.coordinadorNombre || "");
      setRecursosUtilizados(ot.recursosUtilizados || "Flores, follaje, bases y oasis");
    }
  };

  const handleSeleccionarPedidoTienda = (prfId: string) => {
    setPedidoSeleccionadoId(prfId);
    const ped = tablero.pedidosPendientesTienda.find((p) => p.proformaId === prfId);
    if (ped) {
      setFallecidoDestinatario(`${ped.destinatarioNombre} (${ped.codigoOrden})`);
      setUbicacionNombre(ped.direccionEntrega);
      setDescripcionServicioLibre(ped.resumenItems);
    }
  };

  const handleTomarOSubirFotoEntrega = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setProcesandoFoto(true);
    setErrorMsg(null);

    let coords: {
      lat: number;
      lng: number;
      acc: number;
      dir: DireccionGpsResuelta | null;
    } | null =
      latitud != null && longitud != null
        ? {
            lat: latitud,
            lng: longitud,
            acc: precisionMetros ?? 15,
            dir: direccionGpsResuelta,
          }
        : null;

    if (!coords) {
      coords = await capturarUbicacionGps();
    } else if (!coords.dir) {
      try {
        const dir = await obtenerDireccionLegibleGps(coords.lat, coords.lng);
        setDireccionGpsResuelta(dir);
        coords = { ...coords, dir };
      } catch {
        // Ignorar
      }
    }

    const instanteIso = new Date().toISOString();
    setHoraCapturaIso(instanteIso);

    try {
      const baseDataUrl = await leerYComprimirFotoBase(archivo, 1360, 0.86);
      setFotoBaseSinSelloDataUrl(baseDataUrl);

      const estampada = await estamparDataUrlConTarjetaGps(baseDataUrl, {
        latitud: coords?.lat ?? latitud,
        longitud: coords?.lng ?? longitud,
        precisionMetros: coords?.acc ?? precisionMetros,
        fechaHoraIso: instanteIso,
        tituloCiudad: coords?.dir?.tituloCiudad,
        direccionGps: coords?.dir?.direccionCompleta,
        salaTexto: tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? salaServicio || undefined : undefined,
        servicioTexto: descripcionServicio,
        ubicacionTexto: ubicacionNombre || undefined,
        entregadorNombre: tablero.usuarioActualNombre,
      });
      setFotoCapturadaDataUrl(estampada);

      if (coords && !mapaGeneradoDataUrl) {
        const mapa = await generarTarjetaMapaGpsDataUrl(
          coords.lat,
          coords.lng,
          coords.acc,
          ubicacionNombre || coords.dir?.direccionCompleta
        );
        setMapaGeneradoDataUrl(mapa);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo procesar la fotografía");
    } finally {
      setProcesandoFoto(false);
    }
  };

  // Re-estampa automáticamente la tarjeta GPS sobre la foto original cuando cambia Sala o Servicio
  useEffect(() => {
    if (!fotoBaseSinSelloDataUrl) return;
    let cancelado = false;
    const timer = setTimeout(() => {
      void estamparDataUrlConTarjetaGps(fotoBaseSinSelloDataUrl, {
        latitud,
        longitud,
        precisionMetros,
        fechaHoraIso: horaCapturaIso || new Date().toISOString(),
        tituloCiudad: direccionGpsResuelta?.tituloCiudad,
        direccionGps: direccionGpsResuelta?.direccionCompleta,
        salaTexto:
          tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? salaServicio || undefined : undefined,
        servicioTexto: descripcionServicio,
        ubicacionTexto: ubicacionNombre || undefined,
        entregadorNombre: tablero.usuarioActualNombre,
      }).then((nuevaEstampada) => {
        if (!cancelado) setFotoCapturadaDataUrl(nuevaEstampada);
      });
    }, 180);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [
    fotoBaseSinSelloDataUrl,
    latitud,
    longitud,
    precisionMetros,
    direccionGpsResuelta,
    salaServicio,
    descripcionServicio,
    ubicacionNombre,
    horaCapturaIso,
    tipoOrigenCaptura,
    tablero.usuarioActualNombre,
  ]);

  const construirResumenWhatsapp = useCallback(
    (datos: {
      codigoOt?: string;
      sala?: string | null;
      servicio?: string;
      fallecido?: string;
      ubicacion?: string;
      lat?: number | null;
      lng?: number | null;
    }) => {
      const lineas = [
        `🌸 *Confirmación de Entrega — Tinkay*`,
        datos.codigoOt ? `📋 *Orden:* ${datos.codigoOt}` : null,
        datos.sala ? `🏛️ *Sala:* ${datos.sala}` : null,
        datos.servicio ? `💐 *Servicio:* ${datos.servicio}` : null,
        datos.fallecido && !datos.fallecido.startsWith("Por confirmar")
          ? `🕊️ *Destinatario:* ${datos.fallecido}`
          : null,
        datos.ubicacion ? `📍 *Ubicación:* ${datos.ubicacion}` : null,
        datos.lat != null && datos.lng != null
          ? `🗺️ *GPS:* https://maps.google.com/?q=${datos.lat},${datos.lng}`
          : null,
      ].filter(Boolean);
      return lineas.join("\n");
    },
    []
  );

  const handleCompartirWhatsapp = useCallback(
    async (opciones: {
      imagenOrigen: string;
      urlPublica?: string | null;
      textoResumen: string;
      nombreBase?: string;
    }) => {
      setCompartiendoWhatsapp(true);
      setErrorMsg(null);
      try {
        const res = await compartirImagenEvidenciaWhatsapp({
          imagenOrigen: opciones.imagenOrigen,
          nombreArchivo: `${(opciones.nombreBase || "evidencia-tinkay").replace(/[^a-zA-Z0-9-_]/g, "_")}.jpg`,
          textoResumen: opciones.textoResumen,
          urlPublicaRespaldo: opciones.urlPublica ?? null,
        });
        if (res.ok && res.modo === "whatsapp_enlace") {
          setMensajeExito(
            "📥 La imagen georreferenciada se descargó en tu equipo y se abrió WhatsApp lista para adjuntarla."
          );
        }
      } finally {
        setCompartiendoWhatsapp(false);
      }
    },
    []
  );

  const handleDescargarFotoLocal = useCallback((dataUrl: string, sufijo: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `evidencia-gps-${sufijo}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const limpiarFormularioCaptura = () => {
    setOtSeleccionadaId("");
    setPedidoSeleccionadoId("");
    setSalaServicio("");
    setFallecidoDestinatario("");
    setUbicacionNombre("");
    setCoordinadorNombre("");
    setObservacionesCaptura("");
    setFotoBaseSinSelloDataUrl("");
    setFotoCapturadaDataUrl("");
    setMapaGeneradoDataUrl("");
    setHoraCapturaIso("");
  };

  const handleRegistrarEntregaCampo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotoCapturadaDataUrl) {
      setErrorMsg("Toma o adjunta la fotografía georreferenciada de la entrega.");
      return;
    }

    if (tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO") {
      if (!salaServicio.trim()) {
        setErrorMsg("Selecciona el número de Sala (Sala 1 a 4 o Capilla / Oficina).");
        return;
      }
    } else if (!pedidoSeleccionadoId && !fallecidoDestinatario.trim()) {
      setErrorMsg("Selecciona el pedido de la tienda o ingresa el destinatario.");
      return;
    }

    setGuardandoEntrega(true);
    setErrorMsg(null);
    setMensajeExito(null);

    const uuidCli =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
    const instante = horaCapturaIso || new Date().toISOString();

    const destinatarioFinal =
      fallecidoDestinatario.trim() ||
      (tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
        ? `Por confirmar (${salaServicio.trim()})`
        : "Entrega directa tienda");

    const ubicacionFinal =
      ubicacionNombre.trim() || direccionGpsResuelta?.direccionCompleta || "";

    const fotoRespaldoParaWhatsapp = fotoCapturadaDataUrl;

    const paqueteOffline: ItemColaOfflineEntrega = {
      uuidCliente: uuidCli,
      negocio: negNorm,
      entregaIdProgramada: otSeleccionadaId || null,
      tipoOrigen: tipoOrigenCaptura,
      convenioId: convenioPrincipal?.id ?? null,
      proformaId: tipoOrigenCaptura === "PEDIDO_TIENDA" ? pedidoSeleccionadoId || null : null,
      entregadorNombre: tablero.usuarioActualNombre,
      salaServicio:
        tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? salaServicio.trim() : null,
      fallecidoDestinatario: destinatarioFinal,
      fechaServicio: instante,
      capturadoEn: instante,
      descripcionServicio: descripcionServicio.trim() || "Set condolencias (3 arreglos)",
      ubicacionNombre: ubicacionFinal,
      coordinadorNombre: coordinadorNombre.trim() || undefined,
      recursosUtilizados: recursosUtilizados.trim() || undefined,
      latitud,
      longitud,
      precisionMetros,
      direccionGps: direccionGpsResuelta?.direccionCompleta,
      fotoDataUrl: fotoCapturadaDataUrl,
      mapaDataUrl: mapaGeneradoDataUrl || null,
      observaciones: observacionesCaptura.trim() || undefined,
      intentosSync: 0,
    };

    const resumenPrevio = construirResumenWhatsapp({
      sala: paqueteOffline.salaServicio,
      servicio: paqueteOffline.descripcionServicio,
      fallecido: fallecidoDestinatario.trim(),
      ubicacion: ubicacionFinal,
      lat: latitud,
      lng: longitud,
    });

    // Si estamos sin internet, guardar directamente en IndexedDB
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await guardarEntregaEnColaOffline(paqueteOffline);
        await refrescarColaOffline();
        void detenerSeguimientoRuta(false);
        setUltimaFotoConfirmada({
          imagenOrigen: fotoRespaldoParaWhatsapp,
          urlPublica: null,
          textoResumen: resumenPrevio,
          codigoOt: salaServicio || "offline",
        });
        limpiarFormularioCaptura();
        setMensajeExito(
          "📲 Guardada en el teléfono sin internet (Offline). Se sincronizará automáticamente apenas recuperes señal."
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Error guardando en memoria offline");
      } finally {
        setGuardandoEntrega(false);
      }
      return;
    }

    // Intento online directo; si falla la red a mitad de subida, cae automáticamente a IndexedDB
    try {
      const supabase = crearClienteNavegador();
      let fotoUrlSubida: string | null = null;
      const upFoto = await subirArchivoOperativoStorage(
        supabase,
        "evidencias-entregas",
        negNorm,
        dataUrlABlob(fotoCapturadaDataUrl),
        "jpg",
        "image/jpeg"
      );

      if (upFoto.ok) {
        fotoUrlSubida = upFoto.publicUrl;
      } else {
        const upSrv = await subirArchivoEvidenciaServidorAction({
          negocio: negNorm,
          carpeta: "evidencias-entregas",
          dataUrl: fotoCapturadaDataUrl,
          extension: "jpg",
        });
        if (!upSrv.ok) {
          throw new Error(upSrv.error || upFoto.error);
        }
        fotoUrlSubida = upSrv.publicUrl;
      }

      let mapaUrlSubida: string | null = null;
      if (mapaGeneradoDataUrl) {
        const upMapa = await subirArchivoOperativoStorage(
          supabase,
          "evidencias-entregas",
          negNorm,
          dataUrlABlob(mapaGeneradoDataUrl),
          "jpg",
          "image/jpeg"
        );
        if (upMapa.ok) {
          mapaUrlSubida = upMapa.publicUrl;
        } else {
          const upMapaSrv = await subirArchivoEvidenciaServidorAction({
            negocio: negNorm,
            carpeta: "evidencias-entregas",
            dataUrl: mapaGeneradoDataUrl,
            extension: "jpg",
          });
          if (upMapaSrv.ok) mapaUrlSubida = upMapaSrv.publicUrl;
        }
      }

      const res = await registrarOSincronizarEntregaAction({
        negocio: negNorm,
        uuidCliente: uuidCli,
        entregaId: otSeleccionadaId || null,
        tipoOrigen: tipoOrigenCaptura,
        convenioId: convenioPrincipal?.id ?? null,
        proformaId: tipoOrigenCaptura === "PEDIDO_TIENDA" ? pedidoSeleccionadoId || null : null,
        entregadorNombre: tablero.usuarioActualNombre,
        salaServicio: paqueteOffline.salaServicio ?? undefined,
        fallecidoDestinatario: paqueteOffline.fallecidoDestinatario,
        fechaServicio: instante,
        capturadoEn: instante,
        descripcionServicio: paqueteOffline.descripcionServicio,
        ubicacionNombre: paqueteOffline.ubicacionNombre,
        coordinadorNombre: paqueteOffline.coordinadorNombre,
        recursosUtilizados: paqueteOffline.recursosUtilizados,
        latitud,
        longitud,
        precisionMetros,
        direccionGps: paqueteOffline.direccionGps,
        fotoUrl: fotoUrlSubida,
        mapaUrl: mapaUrlSubida,
        observaciones: paqueteOffline.observaciones,
      });

      if (!res.ok) {
        throw new Error(res.error);
      }

      void detenerSeguimientoRuta(false);
      setUltimaFotoConfirmada({
        imagenOrigen: fotoRespaldoParaWhatsapp,
        urlPublica: fotoUrlSubida,
        textoResumen: construirResumenWhatsapp({
          codigoOt: res.codigoOt,
          sala: paqueteOffline.salaServicio,
          servicio: paqueteOffline.descripcionServicio,
          fallecido: fallecidoDestinatario.trim(),
          ubicacion: ubicacionFinal,
          lat: latitud,
          lng: longitud,
        }),
        codigoOt: res.codigoOt,
      });
      limpiarFormularioCaptura();
      setMensajeExito(`✅ Entrega registrada y georreferenciada (${res.codigoOt}).`);
      await recargarTablero(true);
    } catch (errRed) {
      try {
        await guardarEntregaEnColaOffline(paqueteOffline);
        await refrescarColaOffline();
        void detenerSeguimientoRuta(false);
        setUltimaFotoConfirmada({
          imagenOrigen: fotoRespaldoParaWhatsapp,
          urlPublica: null,
          textoResumen: resumenPrevio,
          codigoOt: salaServicio || "offline",
        });
        limpiarFormularioCaptura();
        setMensajeExito(
          `📲 Red inestable (${errRed instanceof Error ? errRed.message : "corte"}): la entrega se guardó segura en el teléfono y se sincronizará sola.`
        );
      } catch {
        setErrorMsg(
          errRed instanceof Error ? errRed.message : "No se pudo guardar la confirmación"
        );
      }
    } finally {
      setGuardandoEntrega(false);
    }
  };

  // Programar nueva Orden de Trabajo Exequiales desde taller
  const handleProgramarOt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otNuevaSala.trim()) {
      setErrorMsg("Selecciona la Sala para programar la Orden de Trabajo.");
      return;
    }
    if (!otNuevaFallecido.trim()) {
      setErrorMsg("Indica el nombre de la Persona Fallecida (requerido en Exequiales).");
      return;
    }
    setCreandoOt(true);
    setErrorMsg(null);

    const uuidCli =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-0000-4000-8000-111111111111`;

    const descProgramada =
      otNuevaOpcionServicio === "OTROS"
        ? otNuevaDescripcionLibre.trim() || "Arreglo exequial personalizado"
        : otNuevaOpcionServicio;

    const res = await registrarOSincronizarEntregaAction({
      negocio: negNorm,
      uuidCliente: uuidCli,
      tipoOrigen: "ORDEN_TRABAJO_CONVENIO",
      convenioId: convenioPrincipal?.id ?? null,
      soloProgramarOt: true,
      salaServicio: otNuevaSala.trim(),
      fallecidoDestinatario: otNuevaFallecido.trim(),
      ubicacionNombre: "Exequiales",
      descripcionServicio: descProgramada,
      coordinadorNombre: otNuevaCoordinador.trim() || undefined,
    });

    setCreandoOt(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setOtNuevaFallecido("");
    setOtNuevaUbicacion("");
    setOtNuevaDescripcionLibre("");
    setOtNuevaCoordinador("");
    setMensajeExito(`Orden de Trabajo ${res.codigoOt} (${otNuevaSala}) creada.`);
    await recargarTablero(true);
  };

  const handleSubirFotoEnModalEdicion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !entregaEditando) return;
    setSubiendoFotoEdicion(true);
    setErrorMsg(null);
    try {
      const baseDataUrl = await leerYComprimirFotoBase(archivo, 1360, 0.86);
      const estampada = await estamparDataUrlConTarjetaGps(baseDataUrl, {
        latitud: entregaEditando.latitud,
        longitud: entregaEditando.longitud,
        precisionMetros: entregaEditando.precisionMetros,
        fechaHoraIso: entregaEditando.capturadoEn || entregaEditando.fechaServicio,
        direccionGps: entregaEditando.direccionGps || undefined,
        salaTexto: entregaEditando.salaServicio || undefined,
        servicioTexto: entregaEditando.descripcionServicio,
        ubicacionTexto: entregaEditando.ubicacionNombre || undefined,
        entregadorNombre: entregaEditando.entregadorNombre || tablero.usuarioActualNombre,
      });

      const supabase = crearClienteNavegador();
      let publicUrlFinal: string | null = null;
      const upCli = await subirArchivoOperativoStorage(
        supabase,
        "evidencias-entregas",
        negNorm,
        dataUrlABlob(estampada),
        "jpg",
        "image/jpeg"
      );
      if (upCli.ok) {
        publicUrlFinal = upCli.publicUrl;
      } else {
        const upSrv = await subirArchivoEvidenciaServidorAction({
          negocio: negNorm,
          carpeta: "evidencias-entregas",
          dataUrl: estampada,
          extension: "jpg",
        });
        if (!upSrv.ok) throw new Error(upSrv.error || upCli.error);
        publicUrlFinal = upSrv.publicUrl;
      }

      setEntregaEditando((prev) => (prev ? { ...prev, fotoUrl: publicUrlFinal } : null));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo subir la fotografía de confirmación"
      );
    } finally {
      setSubiendoFotoEdicion(false);
    }
  };

  const handleGuardarEdicionEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entregaEditando) return;
    setGuardandoEdicion(true);
    const res = await actualizarEntregaEvidenciaAction({
      negocio: negNorm,
      entregaId: entregaEditando.id,
      cambios: {
        salaServicio: entregaEditando.salaServicio ?? "",
        fallecidoDestinatario: entregaEditando.fallecidoDestinatario,
        fechaServicio: entregaEditando.fechaServicio,
        descripcionServicio: entregaEditando.descripcionServicio,
        ubicacionNombre: entregaEditando.ubicacionNombre,
        coordinadorNombre: entregaEditando.coordinadorNombre ?? "",
        recursosUtilizados: entregaEditando.recursosUtilizados ?? "",
        entregadorNombre: entregaEditando.entregadorNombre,
        facturaReferencia: entregaEditando.facturaReferencia ?? "",
        documentosAdjuntos: entregaEditando.documentosAdjuntos ?? "",
        fotoUrl: entregaEditando.fotoUrl ?? undefined,
      },
    });
    setGuardandoEdicion(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setEntregaEditando(null);
    setMensajeExito("Datos de la entrega actualizados correctamente.");
    await recargarTablero(true);
  };

  // =========================================================================
  // FILTRADO Y EMISIÓN DEL INFORME QUINCENAL IESS
  // =========================================================================
  const entregasExequiales = useMemo(
    () => tablero.entregas.filter((e) => e.tipoOrigen === "ORDEN_TRABAJO_CONVENIO"),
    [tablero.entregas]
  );

  const entregasEnRangoInforme = useMemo(() => {
    return entregasExequiales.filter((e) => {
      if (e.estado === "PROGRAMADA" || e.estado === "ANULADA") return false;
      if (!incluirYaLiquidadas && e.estado === "INCLUIDA_EN_INFORME") return false;
      const ymd = (e.fechaServicio || "").slice(0, 10);
      if (fechaInicioInf && ymd < fechaInicioInf) return false;
      if (fechaFinInf && ymd > fechaFinInf) return false;
      return true;
    });
  }, [entregasExequiales, fechaInicioInf, fechaFinInf, incluirYaLiquidadas]);

  const entregasSeleccionadasInforme = useMemo(
    () => entregasEnRangoInforme.filter((e) => !idsExcluidosInforme.has(e.id)),
    [entregasEnRangoInforme, idsExcluidosInforme]
  );

  const descargarBytesPdf = (bytes: Uint8Array, nombreArchivo: string) => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleEmitirYDescargarInforme = async () => {
    if (entregasSeleccionadasInforme.length === 0) {
      setErrorMsg("No hay entregas seleccionadas en este rango de fechas.");
      return;
    }

    setGenerandoPdf(true);
    setErrorMsg(null);
    setMensajeExito(null);

    try {
      const numFinal = numeroInforme.trim() || `INF-IESS-${new Date().getFullYear()}-001`;
      const pdfBytes = await generarPdfInformeQuincenalIess({
        numeroInforme: numFinal,
        fechaInforme: fechaEmisionInf,
        fechaInicio: fechaInicioInf,
        fechaFin: fechaFinInf,
        datosProveedor: datosProveedorForm,
        entregas: entregasSeleccionadasInforme,
        facturaGlobal: facturaGlobalInf,
        documentosAdjuntosGlobal: docsAdjuntosGlobalInf,
        incluirPortadaResumen: incluirPortada,
      });

      let pdfPublicUrl: string | null = null;
      const supabase = crearClienteNavegador();
      const upPdf = await subirArchivoOperativoStorage(
        supabase,
        "informes-entregas",
        negNorm,
        pdfBytes,
        "pdf",
        "application/pdf"
      );
      if (upPdf.ok) {
        pdfPublicUrl = upPdf.publicUrl;
      }

      const resInf = await emitirInformeQuincenalAction({
        negocio: negNorm,
        convenioId: convenioPrincipal?.id ?? null,
        numeroInforme: numFinal,
        fechaInforme: fechaEmisionInf,
        fechaInicio: fechaInicioInf,
        fechaFin: fechaFinInf,
        entregasIds: entregasSeleccionadasInforme.map((x) => x.id),
        datosProveedor: datosProveedorForm,
        facturaReferencia: facturaGlobalInf,
        documentosAdjuntos: docsAdjuntosGlobalInf,
        pdfUrl: pdfPublicUrl,
      });

      descargarBytesPdf(pdfBytes, `${numFinal}.pdf`);

      if (!resInf.ok) {
        setErrorMsg(
          `El PDF se descargó en tu equipo, pero hubo un aviso al guardar en BDD: ${resInf.error}`
        );
      } else {
        setMensajeExito(
          `Informe ${resInf.numeroInforme} emitido, almacenado en histórico y descargado (${entregasSeleccionadasInforme.length} entregas).`
        );
        setNumeroInforme("");
        await recargarTablero(true);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al construir el PDF quincenal");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleRegenerarInformeHistorico = async (inf: InformeQuincenalEntregas) => {
    if (inf.pdfUrl) {
      window.open(inf.pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const prov = inf.detalleInforme?.datosProveedor ?? DATOS_PROVEEDOR_TINKAY_DEFECTO;
    const ents = inf.detalleInforme?.entregas ?? [];
    if (ents.length === 0) return;
    const bytes = await generarPdfInformeQuincenalIess({
      numeroInforme: inf.numeroInforme,
      fechaInforme: inf.fechaInforme,
      fechaInicio: inf.fechaInicio,
      fechaFin: inf.fechaFin,
      datosProveedor: prov,
      entregas: ents,
      facturaGlobal: inf.facturaReferencia,
      documentosAdjuntosGlobal: inf.documentosAdjuntos,
      incluirPortadaResumen: true,
    });
    descargarBytesPdf(bytes, `${inf.numeroInforme}.pdf`);
  };

  // =========================================================================
  // COLUMNAS DATAGRID DE ÓRDENES DE TRABAJO E HISTÓRICO
  // =========================================================================
  const columnasOrdenesOt = useMemo<ColumnaDataGrid<RegistroEntregaEvidencia>[]>(
    () => [
      {
        id: "ot",
        encabezado: "OT / Fecha",
        valor: (r) => `${r.codigoOt} ${r.fechaServicio}`,
        render: (r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.84rem", color: "var(--ct-1f1c19, #1F1C19)" }}>{r.codigoOt}</strong>
            <span style={{ fontSize: "0.73rem", color: "var(--ct-847d74, #847D74)" }}>
              {new Date(r.fechaServicio).toLocaleString("es-EC", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ),
      },
      {
        id: "fallecido",
        encabezado: "Fallecido / Destinatario",
        valor: (r) => `${r.fallecidoDestinatario} ${r.descripcionServicio}`,
        render: (r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.85rem", color: "var(--ct-221e1b, #221E1B)" }}>
              {r.fallecidoDestinatario}
            </strong>
            <span style={{ fontSize: "0.74rem", color: "var(--ct-847d74, #847D74)" }}>{r.descripcionServicio}</span>
          </div>
        ),
      },
      {
        id: "ubicacion",
        encabezado: "Sala y Ubicación",
        valor: (r) => `${r.salaServicio || ""} ${r.ubicacionNombre} ${r.coordinadorNombre || ""}`,
        render: (r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {r.salaServicio && (
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "var(--cf-f2f6f3, #F2F6F3)",
                  border: "1px solid var(--cb-ceddd3, #CEDDD3)",
                  color: "var(--ct-2b4a36, #2B4A36)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                🏛️ {r.salaServicio}
              </span>
            )}
            <span style={{ fontSize: "0.81rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
              {r.ubicacionNombre || r.direccionGps || "Ubicación GPS registrada"}
            </span>
            {r.coordinadorNombre && (
              <span style={{ fontSize: "0.72rem", color: "var(--ct-847d74, #847D74)" }}>
                Coord: {r.coordinadorNombre}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "evidencia",
        encabezado: "Foto + GPS + Entregador",
        valor: (r) => `${r.entregadorNombre} ${r.latitud || ""}`,
        render: (r) => (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {r.fotoUrl && (
              <a href={r.fotoUrl} target="_blank" rel="noreferrer" title="Abrir fotografía georreferenciada">
                <img
                  src={r.fotoUrl}
                  alt="Evidencia"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    objectFit: "cover",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  }}
                />
              </a>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ct-1f1c19, #1F1C19)" }}>
                {r.entregadorNombre}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                {r.latitud != null && r.longitud != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "0.72rem", color: "var(--ct-221e1b, #221E1B)", textDecoration: "none" }}
                  >
                    📍 Mapa GPS
                  </a>
                ) : (
                  <span style={{ fontSize: "0.71rem", color: "var(--ct-847d74, #847D74)" }}>Sin GPS aún</span>
                )}
                {r.fotoUrl && (
                  <button
                    type="button"
                    disabled={compartiendoWhatsapp}
                    onClick={() =>
                      void handleCompartirWhatsapp({
                        imagenOrigen: r.fotoUrl!,
                        urlPublica: r.fotoUrl,
                        nombreBase: r.codigoOt,
                        textoResumen: construirResumenWhatsapp({
                          codigoOt: r.codigoOt,
                          sala: r.salaServicio,
                          servicio: r.descripcionServicio,
                          fallecido: r.fallecidoDestinatario,
                          ubicacion: (r.ubicacionNombre || r.direccionGps) ?? undefined,
                          lat: r.latitud,
                          lng: r.longitud,
                        }),
                      })
                    }
                    title="Compartir imagen georreferenciada por WhatsApp"
                    aria-label="Compartir por WhatsApp"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      border: "1px solid var(--cb-ceddd3, #CEDDD3)",
                      background: "var(--cf-f2f6f3, #F2F6F3)",
                      color: "var(--ct-2f4737, #2F4737)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: compartiendoWhatsapp ? "wait" : "pointer",
                    }}
                  >
                    <MessageCircle size={11} />
                    <span>WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "estado",
        encabezado: "Estado / Informe",
        valor: (r) => `${r.estado} ${r.numeroInforme || ""}`,
        render: (r) => {
          const esProg = r.estado === "PROGRAMADA";
          const esInf = r.estado === "INCLUIDA_EN_INFORME";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "3px 9px",
                  borderRadius: "999px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: esProg ? "var(--cf-faf6ee, #FAF6EE)" : esInf ? "var(--cf-efece6, #EFECE6)" : "var(--cf-f2f6f3, #F2F6F3)",
                  color: esProg ? "var(--ct-745622, #745622)" : esInf ? "var(--ct-3a3530, #3A3530)" : "var(--ct-2b4a36, #2B4A36)",
                }}
              >
                {esProg
                  ? "⏳ Programada"
                  : esInf
                    ? `📄 ${r.numeroInforme || "En Informe"}`
                    : "✅ Entregada"}
              </span>
              {tablero.esAdminOperador && (
                <button
                  type="button"
                  onClick={() => setEntregaEditando({ ...r })}
                  title="Editar datos de la entrega"
                  aria-label="Editar entrega"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    borderRadius: "7px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Edit3 size={12} />
                  <span>Editar</span>
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [
      tablero.esAdminOperador,
      compartiendoWhatsapp,
      construirResumenWhatsapp,
      handleCompartirWhatsapp,
    ]
  );

  const columnasInformesHistoricos = useMemo<ColumnaDataGrid<InformeQuincenalEntregas>[]>(
    () => [
      {
        id: "numero",
        encabezado: "N.º de Informe",
        valor: (i) => i.numeroInforme,
        render: (i) => <strong style={{ color: "var(--ct-1f1c19, #1F1C19)" }}>{i.numeroInforme}</strong>,
      },
      {
        id: "rango",
        encabezado: "Periodo Quincenal",
        valor: (i) => `${i.fechaInicio} ${i.fechaFin}`,
        render: (i) => (
          <span style={{ fontSize: "0.82rem" }}>
            {i.fechaInicio} → {i.fechaFin}
          </span>
        ),
      },
      {
        id: "fecha_emision",
        encabezado: "Fecha Informe",
        valor: (i) => i.fechaInforme,
      },
      {
        id: "total",
        encabezado: "Entregas",
        valor: (i) => i.totalEntregas,
        render: (i) => <strong>{i.totalEntregas} serv.</strong>,
      },
      {
        id: "acciones",
        encabezado: "Documento PDF",
        valor: (i) => i.pdfUrl || "generar",
        render: (i) => (
          <button
            type="button"
            onClick={() => void handleRegenerarInformeHistorico(i)}
            title="Abrir o descargar el informe PDF oficial"
            aria-label="Descargar PDF"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "none",
              background: "#1F1C19",
              color: "#FFFFFF",
              fontSize: "0.76rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            <span>Descargar PDF</span>
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* BARRA SUPERIOR DE RED, COLA OFFLINE E INSTALACIÓN MÓVIL */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "14px",
          background: "var(--cf-ffffff, #FFFFFF)",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {(
            [
              { id: "captura", label: "📸 Capturar Entrega", badge: otsProgramadas.length },
              {
                id: "ordenes_ot",
                label: "📋 Órdenes Exequiales",
                badge: entregasExequiales.length,
              },
              ...(tablero.esAdminOperador
                ? [
                    {
                      id: "informe_quincenal",
                      label: "📄 Emitir Informe IESS",
                      badge: entregasEnRangoInforme.length,
                    },
                    {
                      id: "historico",
                      label: "🗂️ Histórico",
                      badge: tablero.informes.length,
                    },
                  ]
                : []),
            ] as Array<{ id: PestanaEntregas; label: string; badge: number }>
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
                  border: activa ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                  background: activa ? "#1F1C19" : "var(--cf-f8f7f4, #F8F7F4)",
                  color: activa ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                  fontSize: "0.81rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    padding: "1px 7px",
                    borderRadius: "999px",
                    fontSize: "0.7rem",
                    background: activa ? "rgba(255,255,255,0.2)" : "var(--cf-e6e2da, #E6E2DA)",
                    color: activa ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                  }}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 11px",
              borderRadius: "999px",
              background: enLinea ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-faf6ee, #FAF6EE)",
              border: `1px solid ${enLinea ? "var(--cb-ceddd3, #CEDDD3)" : "var(--cb-e5d7bc, #E5D7BC)"}`,
              color: enLinea ? "var(--ct-2f4737, #2F4737)" : "var(--ct-745622, #745622)",
              fontSize: "0.76rem",
              fontWeight: 700,
            }}
          >
            {enLinea ? <Wifi size={13} /> : <CloudOff size={13} />}
            <span>{enLinea ? "En línea" : "Modo Offline Activo"}</span>
          </span>

          {colaOffline.length > 0 && (
            <button
              type="button"
              onClick={() => void sincronizarPendientesOffline()}
              disabled={sincronizandoOffline}
              title="Subir entregas almacenadas localmente en el teléfono"
              aria-label="Sincronizar entregas pendientes"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "9px",
                border: "none",
                background: "#8F6A2E",
                color: "#FFFFFF",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: sincronizandoOffline ? "wait" : "pointer",
              }}
            >
              {sincronizandoOffline ? <Loader2 size={14} /> : <Upload size={14} />}
              <span>Sincronizar ({colaOffline.length})</span>
            </button>
          )}

          {!appInstalada && (
            <button
              type="button"
              onClick={() => void handleInstalarPwa()}
              title="Instalar aplicación en la pantalla de inicio del celular"
              aria-label="Instalar App"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "9px",
                border: "1px solid #2F4737",
                background: "var(--cf-f2f6f3, #F2F6F3)",
                color: "var(--ct-2b4a36, #2B4A36)",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Smartphone size={14} />
              <span>Instalar App</span>
            </button>
          )}

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => void recargarTablero(false)}
            title="Actualizar órdenes y entregas"
            aria-label="Actualizar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-1f1c19, #1F1C19)",
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

      {tablero.migracionPendiente && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "var(--cf-faf6ee, #FAF6EE)",
            border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
            color: "var(--ct-745622, #745622)",
            fontSize: "0.81rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={16} />
          <span>
            Ejecuta las migraciones{" "}
            <code>20261115000010</code> y <code>20261115000011</code> en Supabase para habilitar el
            almacenamiento centralizado (las capturas en teléfono ya funcionan offline).
          </span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "var(--cf-faf2f2, #FAF2F2)",
            border: "1px solid var(--cb-e5caca, #E5CACA)",
            color: "var(--ct-8a2e2e, #8A2E2E)",
            fontSize: "0.83rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {mensajeExito && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "12px",
            background: "var(--cf-f2f6f3, #F2F6F3)",
            border: "1px solid var(--cb-ceddd3, #CEDDD3)",
            color: "var(--ct-2b4a36, #2B4A36)",
            fontSize: "0.84rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} />
            <span>{mensajeExito}</span>
          </div>
          {ultimaFotoConfirmada && (
            <button
              type="button"
              disabled={compartiendoWhatsapp}
              onClick={() =>
                void handleCompartirWhatsapp({
                  imagenOrigen: ultimaFotoConfirmada.imagenOrigen,
                  urlPublica: ultimaFotoConfirmada.urlPublica,
                  nombreBase: ultimaFotoConfirmada.codigoOt,
                  textoResumen: ultimaFotoConfirmada.textoResumen,
                })
              }
              title="Enviar la fotografía georreferenciada directamente por WhatsApp"
              aria-label="Compartir WhatsApp"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 13px",
                borderRadius: "9px",
                border: "none",
                background: "#2F4737",
                color: "#FFFFFF",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: compartiendoWhatsapp ? "wait" : "pointer",
              }}
            >
              {compartiendoWhatsapp ? <Loader2 size={14} /> : <MessageCircle size={14} />}
              <span>Compartir WhatsApp</span>
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 1: CAPTURA MÓVIL DE ENTREGA (ESTILO GPS MAP CAMERA + WHATSAPP)
      ===================================================================== */}
      {pestana === "captura" && (
        <form
          onSubmit={(e) => void handleRegistrarEntregaCampo(e)}
          style={{
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {esSubcontratado && (
              <div
                style={{
                  flex: "1 1 100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "var(--cf-faf6ee, #FAF6EE)",
                  border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                  color: "var(--ct-745622, #745622)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                🛵 Modo Delivery Subcontratado: ves únicamente las entregas asignadas a tu cuenta.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setTipoOrigenCaptura("ORDEN_TRABAJO_CONVENIO");
                limpiarFormularioCaptura();
                setOpcionServicio("Set condolencias (3 arreglos)");
                setDescripcionServicioLibre("");
              }}
              style={{
                flex: "1 1 240px",
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                    ? "2px solid var(--cb-1f1c19, #1F1C19)"
                    : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background:
                  tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? "var(--cf-f8f7f4, #F8F7F4)" : "var(--cf-ffffff, #FFFFFF)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.9rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                🕊️ Orden de Trabajo — Exequiales IESS
              </strong>
              <span style={{ fontSize: "0.76rem", color: "var(--ct-847d74, #847D74)" }}>
                Solo Foto GPS + Número de Sala obligatorios en entrega rápida
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTipoOrigenCaptura("PEDIDO_TIENDA");
                limpiarFormularioCaptura();
                setDescripcionServicioLibre("Entrega de pedido floral");
              }}
              style={{
                flex: "1 1 240px",
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  tipoOrigenCaptura === "PEDIDO_TIENDA"
                    ? "2px solid #2F4737"
                    : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: tipoOrigenCaptura === "PEDIDO_TIENDA" ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-ffffff, #FFFFFF)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.9rem", color: "var(--ct-2b4a36, #2B4A36)" }}>
                🛍️ Resto de Pedidos de la Tienda ({tablero.pedidosPendientesTienda.length})
              </strong>
              <span style={{ fontSize: "0.76rem", color: "var(--ct-2f4737, #2F4737)" }}>
                Confirmar entrega fotográfica de pedidos Web / WhatsApp / Tienda
              </span>
            </button>
          </div>

          {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" && otsProgramadas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  color: "var(--ct-1f1c19, #1F1C19)",
                }}
              >
                📋 Pedidos Exequiales Enviados desde Operador / Taller ({otsProgramadas.length}) — toca
                para precargar y confirmar (o cambiar Sala si hubo cambio)
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "8px",
                }}
              >
                {otsProgramadas.map((ot) => {
                  const sel = otSeleccionadaId === ot.id;
                  const listo = ot.estadoTaller === "LISTO_ENTREGA";
                  const enPrep = ot.estadoTaller === "EN_PREPARACION";
                  return (
                    <button
                      key={ot.id}
                      type="button"
                      onClick={() =>
                        handleSeleccionarOtProgramada(sel ? "" : ot.id)
                      }
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        border: sel
                          ? "2px solid #2F4737"
                          : listo
                            ? "1.5px solid var(--cb-ceddd3, #CEDDD3)"
                            : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: sel ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-ffffff, #FFFFFF)",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
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
                        <strong style={{ fontSize: "0.82rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                          {ot.codigoOt} {ot.salaServicio ? `· 🏛️ ${ot.salaServicio}` : ""}
                        </strong>
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: "999px",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            background: listo ? "var(--cf-f2f6f3, #F2F6F3)" : enPrep ? "var(--cf-f5efe3, #F5EFE3)" : "var(--cf-f4f2ee, #F4F2EE)",
                            color: listo ? "var(--ct-2f4737, #2F4737)" : enPrep ? "var(--ct-745622, #745622)" : "var(--ct-3a3530, #3A3530)",
                          }}
                        >
                          {listo
                            ? "🟢 Listo entrega"
                            : enPrep
                              ? "🔨 En preparación"
                              : "📨 En Taller"}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ct-221e1b, #221E1B)" }}>
                        💐 {ot.descripcionServicio}
                      </span>
                      <span style={{ fontSize: "0.73rem", color: "var(--ct-57524c, #57524C)" }}>
                        {ot.coordinadorNombre ? `Solicita: ${ot.coordinadorNombre} · ` : ""}
                        {ot.horaSolicitada ? `⏰ ${ot.horaSolicitada} · ` : ""}
                        🕊️ {ot.fallecidoDestinatario}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tipoOrigenCaptura === "PEDIDO_TIENDA" && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--ct-1f1c19, #1F1C19)",
                  marginBottom: "6px",
                }}
              >
                Seleccionar Pedido Pendiente de Entrega ({tablero.pedidosPendientesTienda.length})
              </label>
              <SelectConBuscador
                value={pedidoSeleccionadoId}
                onChange={(e) => handleSeleccionarPedidoTienda(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.86rem",
                }}
              >
                <option value="">-- Selecciona un pedido o llena manualmente abajo --</option>
                {tablero.pedidosPendientesTienda.map((p) => (
                  <option key={p.proformaId} value={p.proformaId}>
                    {p.estadoTaller === "LISTO_ENTREGA"
                      ? "🟢 [Listo] "
                      : p.estadoTaller === "EN_PREPARACION"
                        ? "🔨 [Preparación] "
                        : ""}
                    {p.codigoOrden} · {p.fechaEntrega || ""} {p.franjaHoraria ? `(${p.franjaHoraria})` : ""} ·{" "}
                    {p.destinatarioNombre} — {p.resumenItems}
                  </option>
                ))}
              </SelectConBuscador>

              {pedidoTiendaSeleccionadoObj?.enlaceMapa && (
                <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a
                    href={pedidoTiendaSeleccionadoObj.enlaceMapa}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir ubicación de destino en Google Maps / Waze"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      background: "var(--cf-f4f2ee, #F4F2EE)",
                      border: "1px solid var(--cb-ddd8ce, #DDD8CE)",
                      color: "var(--ct-221e1b, #221E1B)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    <Navigation size={13} />
                    <span>Abrir Mapa Destino</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* BARRA DE COMPARTIR UBICACIÓN GPS EN VIVO MIENTRAS ESTÁ EN RUTA */}
          {(otSeleccionadaId || pedidoSeleccionadoId || enRutaActiva) && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: enRutaActiva ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-f8f7f4, #F8F7F4)",
                border: enRutaActiva ? "1.5px solid #2F4737" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <strong
                  style={{
                    fontSize: "0.84rem",
                    color: enRutaActiva ? "var(--ct-2b4a36, #2B4A36)" : "var(--ct-1f1c19, #1F1C19)",
                  }}
                >
                  {enRutaActiva
                    ? "🛵 Compartiendo ubicación en vivo con la tienda"
                    : "🛵 ¿Ya saliste a entregar este pedido?"}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--ct-57524c, #57524C)" }}>
                  {enRutaActiva
                    ? `${ultimoPulsoRutaTexto || "GPS activo"} · Se apagará solo al confirmar la entrega.`
                    : "Activa Iniciar Ruta para que Ventas y Operaciones vean tu avance en vivo."}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  enRutaActiva ? void detenerSeguimientoRuta(true) : iniciarSeguimientoRuta()
                }
                title={
                  enRutaActiva
                    ? "Detener envío de ubicación GPS en ruta"
                    : "Compartir ubicación GPS en vivo mientras vas en camino"
                }
                aria-label={enRutaActiva ? "Detener Ruta" : "Iniciar Ruta"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "9px",
                  border: "none",
                  background: enRutaActiva ? "#8A2E2E" : "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <Navigation size={14} />
                <span>{enRutaActiva ? "Detener Ruta" : "Iniciar Ruta"}</span>
              </button>
            </div>
          )}

          {/* 1. ÚNICO CAMPO OBLIGATORIO EN EXEQUIALES: NÚMERO DE SALA */}
          {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: salaServicio ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-faf6ee, #FAF6EE)",
                border: salaServicio ? "1px solid var(--cb-ceddd3, #CEDDD3)" : "1px solid var(--cb-e5d7bc, #E5D7BC)",
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
                <label
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 800,
                    color: "var(--ct-1f1c19, #1F1C19)",
                  }}
                >
                  Número de Sala *{" "}
                  <span style={{ fontWeight: 500, fontSize: "0.76rem", color: "var(--ct-57524c, #57524C)" }}>
                    (único dato obligatorio junto a la foto)
                  </span>
                </label>
                {salaServicio && (
                  <span
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "var(--ct-2f4737, #2F4737)",
                    }}
                  >
                    ✓ Seleccionado: {salaServicio}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
                  gap: "8px",
                }}
              >
                {OPCIONES_SALA_EXEQUIALES.map((opSala) => {
                  const activa = salaServicio === opSala;
                  return (
                    <button
                      key={opSala}
                      type="button"
                      onClick={() => setSalaServicio(opSala)}
                      title={`Seleccionar ${opSala}`}
                      aria-label={opSala}
                      style={{
                        padding: "11px 10px",
                        borderRadius: "10px",
                        border: activa ? "2px solid #2F4737" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: activa ? "#2F4737" : "var(--cf-ffffff, #FFFFFF)",
                        color: activa ? "#FFFFFF" : "var(--ct-1f1c19, #1F1C19)",
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {opSala}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. DESCRIPCIÓN DEL SERVICIO: 3 OPCIONES TÁCTILES + LIBRE ESCRITURA */}
          {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                }}
              >
                Descripción del Servicio
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(
                  [
                    ...OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES.map((label) => ({
                      valor: label,
                      etiqueta: label,
                    })),
                    { valor: "OTROS" as const, etiqueta: "Otros (editable)" },
                  ] as const
                ).map((item) => {
                  const activa = opcionServicio === item.valor;
                  return (
                    <button
                      key={item.valor}
                      type="button"
                      onClick={() => setOpcionServicio(item.valor)}
                      title={`Seleccionar ${item.etiqueta}`}
                      aria-label={item.etiqueta}
                      style={{
                        flex: "1 1 180px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: activa ? "2px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: activa ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                        color: activa ? "#FFFFFF" : "var(--ct-221e1b, #221E1B)",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {item.etiqueta}
                    </button>
                  );
                })}
              </div>

              {opcionServicio === "OTROS" && (
                <input
                  type="text"
                  value={descripcionServicioLibre}
                  onChange={(e) => setDescripcionServicioLibre(e.target.value)}
                  placeholder="Escribe el detalle del arreglo (ej. 2 pedestales + corona)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--cb-847d74, #847D74)",
                    fontSize: "0.85rem",
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                  }}
                />
              )}
            </div>
          ) : (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                  marginBottom: "4px",
                }}
              >
                Descripción del Pedido
              </label>
              <input
                type="text"
                value={descripcionServicioLibre}
                onChange={(e) => setDescripcionServicioLibre(e.target.value)}
                placeholder="Detalle del pedido floral entregado"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.85rem",
                }}
              />
            </div>
          )}

          {/* 3. CÁMARA + GEORREFERENCIA ESTAMPADA EN LA IMAGEN + COMPARTIR WHATSAPP */}
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              background: "var(--cf-f8f7f4, #F8F7F4)",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin
                  size={18}
                  style={{ color: latitud != null ? "var(--ct-2f4737, #2F4737)" : "var(--ct-8f6a2e, #8F6A2E)", flexShrink: 0 }}
                />
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ct-221e1b, #221E1B)" }}>
                  {estadoGpsTexto}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void capturarUbicacionGps()}
                  disabled={obteniendoGps}
                  title="Actualizar coordenadas GPS actuales del teléfono"
                  aria-label="Capturar GPS"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 13px",
                    borderRadius: "9px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-1f1c19, #1F1C19)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: obteniendoGps ? "wait" : "pointer",
                  }}
                >
                  {obteniendoGps ? <Loader2 size={14} /> : <Navigation size={14} />}
                  <span>Capturar GPS</span>
                </button>

                <label
                  title="Abrir cámara y estampar mapa satelital, dirección, coordenadas y hora sobre la foto"
                  aria-label="Tomar foto GPS"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 15px",
                    borderRadius: "9px",
                    background: "#1F1C19",
                    color: "#FFFFFF",
                    fontSize: "0.83rem",
                    fontWeight: 700,
                    cursor: procesandoFoto ? "wait" : "pointer",
                  }}
                >
                  {procesandoFoto ? <Loader2 size={15} /> : <Camera size={15} />}
                  <span>Tomar Foto GPS</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void handleTomarOSubirFotoEntrega(e)}
                    disabled={procesandoFoto}
                    style={{ display: "none" }}
                  />
                </label>

                <label
                  title="Subir foto desde galería y estampar sello GPS"
                  aria-label="Galería"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 13px",
                    borderRadius: "9px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-57524c, #57524C)",
                    fontSize: "0.81rem",
                    fontWeight: 600,
                    cursor: procesandoFoto ? "wait" : "pointer",
                  }}
                >
                  <Upload size={14} />
                  <span>Galería</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleTomarOSubirFotoEntrega(e)}
                    disabled={procesandoFoto}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            {fotoCapturadaDataUrl && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div
                  style={{
                    background: "#1F1C19",
                    borderRadius: "12px",
                    padding: "6px",
                    border: "2px solid #2F4737",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={fotoCapturadaDataUrl}
                    alt="Fotografía con mapa GPS y georreferencia incrustada"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "440px",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={compartiendoWhatsapp}
                    onClick={() =>
                      void handleCompartirWhatsapp({
                        imagenOrigen: fotoCapturadaDataUrl,
                        nombreBase: salaServicio || "entrega-gps",
                        textoResumen: construirResumenWhatsapp({
                          sala:
                            tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                              ? salaServicio || undefined
                              : undefined,
                          servicio: descripcionServicio,
                          fallecido: fallecidoDestinatario.trim(),
                          ubicacion:
                            ubicacionNombre.trim() || direccionGpsResuelta?.direccionCompleta,
                          lat: latitud,
                          lng: longitud,
                        }),
                      })
                    }
                    title="Compartir esta imagen georreferenciada directamente por WhatsApp"
                    aria-label="Compartir WhatsApp"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "9px 15px",
                      borderRadius: "9px",
                      border: "none",
                      background: "#2F4737",
                      color: "#FFFFFF",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: compartiendoWhatsapp ? "wait" : "pointer",
                    }}
                  >
                    {compartiendoWhatsapp ? <Loader2 size={15} /> : <MessageCircle size={15} />}
                    <span>Compartir WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDescargarFotoLocal(
                        fotoCapturadaDataUrl,
                        (salaServicio || "tinkay").replace(/[^a-zA-Z0-9-_]/g, "_")
                      )
                    }
                    title="Guardar fotografía con sello GPS en la galería del teléfono"
                    aria-label="Descargar Foto"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 14px",
                      borderRadius: "9px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-1f1c19, #1F1C19)",
                      fontSize: "0.81rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} />
                    <span>Descargar Foto</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. DATOS COMPLEMENTARIOS OPCIONALES (SE PUEDEN COMPLETAR DESPUÉS PARA EL INFORME) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                  marginBottom: "4px",
                }}
              >
                {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                  ? "Nombre del Fallecido (opcional)"
                  : "Destinatario / Orden"}
              </label>
              <input
                type="text"
                value={fallecidoDestinatario}
                onChange={(e) => setFallecidoDestinatario(e.target.value)}
                placeholder={
                  tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                    ? "Opcional en entrega — editable luego"
                    : "Nombre de quien recibe"
                }
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                  marginBottom: "4px",
                }}
              >
                Ubicación / Funeraria (opcional)
              </label>
              <input
                type="text"
                value={ubicacionNombre}
                onChange={(e) => setUbicacionNombre(e.target.value)}
                placeholder="Se autocompleta con la dirección GPS si queda vacío"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--ct-57524c, #57524C)",
                    marginBottom: "4px",
                  }}
                >
                  Coordinador del Servicio IESS (opcional)
                </label>
                <input
                  type="text"
                  value={coordinadorNombre}
                  onChange={(e) => setCoordinadorNombre(e.target.value)}
                  placeholder="Ej. Cristian Montaluiza"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: "9px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              paddingTop: "8px",
              borderTop: "1px solid var(--cb-f4f2ee, #F4F2EE)",
            }}
          >
            <span style={{ fontSize: "0.79rem", color: "var(--ct-847d74, #847D74)" }}>
              Entregador identificado: <strong>{tablero.usuarioActualNombre}</strong>
            </span>

            <button
              type="submit"
              disabled={guardandoEntrega}
              title="Registrar entrega georreferenciada (en línea o en memoria offline)"
              aria-label="Confirmar Entrega"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 22px",
                borderRadius: "10px",
                border: "none",
                background: "#2F4737",
                color: "#FFFFFF",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: guardandoEntrega ? "wait" : "pointer",
              }}
            >
              {guardandoEntrega ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
              <span>{guardandoEntrega ? "Guardando..." : "Confirmar Entrega"}</span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          PESTAÑA 2: ÓRDENES DE TRABAJO DIRECTAS (EXEQUIALES DEL IESS)
      ===================================================================== */}
      {pestana === "ordenes_ot" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {tablero.esAdminOperador && (
          <form
            onSubmit={(e) => void handleProgramarOt(e)}
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Programar Nueva Orden de Trabajo — Exequiales del IESS
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
                gap: "10px",
              }}
            >
              <SelectConBuscador
                value={otNuevaSala}
                onChange={(e) => setOtNuevaSala(e.target.value)}
                aria-label="Sala de servicio"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  background: "var(--cf-f8f7f4, #F8F7F4)",
                }}
              >
                {OPCIONES_SALA_EXEQUIALES.map((s) => (
                  <option key={s} value={s}>
                    {s} *
                  </option>
                ))}
              </SelectConBuscador>

              <SelectConBuscador
                value={otNuevaOpcionServicio}
                onChange={(e) =>
                  setOtNuevaOpcionServicio(
                    e.target.value as
                      | "Set condolencias (3 arreglos)"
                      | "Cubre cofre (1 arreglo)"
                      | "OTROS"
                  )
                }
                aria-label="Descripción del servicio"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                }}
              >
                {OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
                <option value="OTROS">Otros (editable)</option>
              </SelectConBuscador>

              {otNuevaOpcionServicio === "OTROS" && (
                <input
                  type="text"
                  value={otNuevaDescripcionLibre}
                  onChange={(e) => setOtNuevaDescripcionLibre(e.target.value)}
                  placeholder="Detalle libre del servicio"
                  style={{
                    padding: "9px 11px",
                    borderRadius: "9px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                  }}
                />
              )}

              <input
                type="text"
                required
                value={otNuevaFallecido}
                onChange={(e) => setOtNuevaFallecido(e.target.value)}
                placeholder="Persona Fallecida (requerido) *"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1.5px solid var(--cb-4a453f, #4A453F)",
                  fontSize: "0.84rem",
                }}
              />

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={otNuevaCoordinador}
                  onChange={(e) => setOtNuevaCoordinador(e.target.value)}
                  placeholder="Coordinador IESS (opcional)"
                  style={{
                    flex: 1,
                    padding: "9px 11px",
                    borderRadius: "9px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                  }}
                />
                <button
                  type="submit"
                  disabled={creandoOt}
                  title="Crear Orden de Trabajo para ejecución y entrega"
                  aria-label="Crear OT"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "9px 15px",
                    borderRadius: "9px",
                    border: "none",
                    background: "#1F1C19",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: creandoOt ? "wait" : "pointer",
                  }}
                >
                  {creandoOt ? <Loader2 size={14} /> : <Plus size={14} />}
                  <span>Crear OT</span>
                </button>
              </div>
            </div>
          </form>
          )}

          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "18px",
            }}
          >
            <DataGrid
              columnas={columnasOrdenesOt}
              filas={entregasExequiales}
              idFila={(r) => r.id}
              nombreExportacion={`ordenes-exequiales-${negNorm}`}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: GENERADOR Y EDICIÓN DE INFORME QUINCENAL OFICIAL (IESS)
      ===================================================================== */}
      {pestana === "informe_quincenal" && tablero.esAdminOperador && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                Configuración y Numeración del Informe Quincenal (Formato Oficial Proveedores)
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "0.81rem", color: "var(--ct-847d74, #847D74)" }}>
                Filtra las entregas por fecha inicio – fin, edita cualquier dato en pantalla antes
                de emitir y genera el PDF oficial con fotografías y GPS.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Fecha Inicio Corte
                </label>
                <input
                  type="date"
                  value={fechaInicioInf}
                  onChange={(e) => setFechaInicioInf(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Fecha Fin Corte
                </label>
                <input
                  type="date"
                  value={fechaFinInf}
                  onChange={(e) => setFechaFinInf(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Fecha del Informe
                </label>
                <input
                  type="date"
                  value={fechaEmisionInf}
                  onChange={(e) => setFechaEmisionInf(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Numeración del Informe
                </label>
                <input
                  type="text"
                  value={numeroInforme}
                  onChange={(e) => setNumeroInforme(e.target.value)}
                  placeholder="INF-IESS-2026-001"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {/* Datos editables de la Sección 1 del Proveedor */}
            <details
              style={{
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                borderRadius: "12px",
                padding: "12px 14px",
                background: "var(--cf-f8f7f4, #F8F7F4)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  color: "var(--ct-1f1c19, #1F1C19)",
                }}
              >
                1. Información General del Proveedor ({datosProveedorForm.razonSocial} · RUC{" "}
                {datosProveedorForm.ruc}) — Clic para editar
              </summary>
              <div
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                }}
              >
                {(
                  [
                    ["nombreProveedor", "Nombre del Proveedor"],
                    ["razonSocial", "Razón Social"],
                    ["ruc", "RUC"],
                    ["direccion", "Dirección"],
                    ["telefono", "Teléfono"],
                    ["correoElectronico", "Correo Electrónico"],
                    ["personaContacto", "Persona de Contacto"],
                  ] as const
                ).map(([campo, etq]) => (
                  <div key={campo}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        color: "var(--ct-57524c, #57524C)",
                        marginBottom: "3px",
                      }}
                    >
                      {etq}
                    </label>
                    <input
                      type="text"
                      value={datosProveedorForm[campo] || ""}
                      onChange={(e) =>
                        setDatosProveedorForm((prev) => ({ ...prev, [campo]: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        borderRadius: "7px",
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.81rem",
                        background: "var(--cf-ffffff, #FFFFFF)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </details>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "10px",
              }}
            >
              <input
                type="text"
                value={facturaGlobalInf}
                onChange={(e) => setFacturaGlobalInf(e.target.value)}
                placeholder="Factura o Comprobante de Pago (opcional)"
                style={{
                  padding: "9px 11px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.83rem",
                }}
              />
              <input
                type="text"
                value={docsAdjuntosGlobalInf}
                onChange={(e) => setDocsAdjuntosGlobalInf(e.target.value)}
                placeholder="4. Documentos Adjuntos (opcional)"
                style={{
                  padding: "9px 11px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.83rem",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.82rem" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={incluirPortada}
                    onChange={(e) => setIncluirPortada(e.target.checked)}
                  />
                  <span>Incluir hoja resumen quincenal inicial</span>
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={incluirYaLiquidadas}
                    onChange={(e) => setIncluirYaLiquidadas(e.target.checked)}
                  />
                  <span>Mostrar también entregas ya incluidas en informes previos</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => void handleEmitirYDescargarInforme()}
                disabled={generandoPdf || entregasSeleccionadasInforme.length === 0}
                title="Emitir informe numerado, guardar histórico y descargar PDF con fotos"
                aria-label="Generar informe"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#1F1C19",
                  color: "#FFFFFF",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  cursor: generandoPdf ? "wait" : "pointer",
                  opacity: entregasSeleccionadasInforme.length === 0 ? 0.55 : 1,
                }}
              >
                {generandoPdf ? <Loader2 size={16} /> : <FileText size={16} />}
                <span>
                  {generandoPdf
                    ? "Generando PDF..."
                    : `Generar Informe (${entregasSeleccionadasInforme.length})`}
                </span>
              </button>
            </div>

            {/* Vista previa seleccionable y editable en pantalla */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {entregasEnRangoInforme.map((item) => {
                const incluida = !idsExcluidosInforme.has(item.id);
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: `1px solid ${incluida ? "var(--cb-d5cfc4, #D5CFC4)" : "var(--cb-e6e2da, #E6E2DA)"}`,
                      background: incluida ? "var(--cf-ffffff, #FFFFFF)" : "var(--cf-f8f7f4, #F8F7F4)",
                      opacity: incluida ? 1 : 0.6,
                      flexWrap: "wrap",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={incluida}
                        onChange={() =>
                          setIdsExcluidosInforme((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                      />
                      {item.fotoUrl && (
                        <img
                          src={item.fotoUrl}
                          alt={item.fallecidoDestinatario}
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "8px",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <div>
                        <strong style={{ fontSize: "0.86rem", color: "var(--ct-1f1c19, #1F1C19)", display: "block" }}>
                          {item.fallecidoDestinatario}
                        </strong>
                        <span style={{ fontSize: "0.76rem", color: "var(--ct-847d74, #847D74)" }}>
                          {new Date(item.fechaServicio).toLocaleDateString("es-EC")} ·{" "}
                          {item.ubicacionNombre} · {item.descripcionServicio} · Entrega:{" "}
                          {item.entregadorNombre}
                        </span>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => setEntregaEditando({ ...item })}
                      title="Editar información antes de generar el PDF"
                      aria-label="Editar fila"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "6px 11px",
                        borderRadius: "8px",
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: HISTÓRICO PERMANENTE DE TODAS LAS ENTREGAS E INFORMES EMITIDOS
      ===================================================================== */}
      {pestana === "historico" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "18px",
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
              <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                Historial Permanente de Entregas Confirmadas (Exequiales y Tienda)
              </h3>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(
                  [
                    { id: "TODAS", label: "Todas" },
                    { id: "EXEQUIALES", label: "Exequiales" },
                    { id: "TIENDA", label: "Resto de Pedidos" },
                  ] as const
                ).map((op) => {
                  const act = filtroHistoricoEntregas === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setFiltroHistoricoEntregas(op.id)}
                      style={{
                        padding: "5px 11px",
                        borderRadius: "999px",
                        border: act ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: act ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                        color: act ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {op.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <DataGrid
              columnas={columnasOrdenesOt}
              filas={tablero.entregas.filter((e) => {
                if (e.estado === "PROGRAMADA" || e.estado === "ANULADA") return false;
                if (filtroHistoricoEntregas === "EXEQUIALES") {
                  return e.tipoOrigen === "ORDEN_TRABAJO_CONVENIO";
                }
                if (filtroHistoricoEntregas === "TIENDA") {
                  return e.tipoOrigen === "PEDIDO_TIENDA";
                }
                return true;
              })}
              idFila={(r) => r.id}
              nombreExportacion={`historial-entregas-permanente-${negNorm}`}
            />
          </div>

          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Histórico de Informes Quincenales Emitidos ({tablero.informes.length})
            </h3>
            <DataGrid
              columnas={columnasInformesHistoricos}
              filas={tablero.informes}
              idFila={(i) => i.id}
              nombreExportacion={`informes-quincenales-${negNorm}`}
            />
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN PREVIA AL INFORME */}
      {entregaEditando && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <form
            onSubmit={(e) => void handleGuardarEdicionEntrega(e)}
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              borderRadius: "16px",
              padding: "22px",
              maxWidth: "560px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Editar Registro de Servicio ({entregaEditando.codigoOt})
            </h3>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                  marginBottom: "3px",
                }}
              >
                Sala del Servicio
              </label>
              <SelectConBuscador
                value={entregaEditando.salaServicio ?? ""}
                onChange={(e) =>
                  setEntregaEditando((prev) =>
                    prev ? { ...prev, salaServicio: e.target.value } : null
                  )
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                }}
              >
                <option value="">-- Sin sala asignada --</option>
                {OPCIONES_SALA_EXEQUIALES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectConBuscador>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                  marginBottom: "4px",
                }}
              >
                Descripción del Servicio
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                {OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() =>
                      setEntregaEditando((prev) =>
                        prev ? { ...prev, descripcionServicio: op } : null
                      )
                    }
                    style={{
                      padding: "5px 10px",
                      borderRadius: "8px",
                      border:
                        entregaEditando.descripcionServicio === op
                          ? "1px solid #2F4737"
                          : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background:
                        entregaEditando.descripcionServicio === op ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-f8f7f4, #F8F7F4)",
                      color:
                        entregaEditando.descripcionServicio === op ? "var(--ct-2b4a36, #2B4A36)" : "var(--ct-57524c, #57524C)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={String(entregaEditando.descripcionServicio ?? "")}
                onChange={(e) =>
                  setEntregaEditando((prev) =>
                    prev ? { ...prev, descripcionServicio: e.target.value } : null
                  )
                }
                placeholder="O escribe otra descripción libre..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                }}
              />
            </div>

            {(
              [
                ["fallecidoDestinatario", "Nombre del Fallecido / Destinatario"],
                ["ubicacionNombre", "Ubicación del Servicio / Funeraria"],
                ["coordinadorNombre", "Coordinador del Servicio"],
                ["recursosUtilizados", "Equipo y Recursos Utilizados"],
                ["entregadorNombre", "Entregado por (Colaborador)"],
                ["facturaReferencia", "Factura o Comprobante de Pago"],
                ["documentosAdjuntos", "Documentos Adjuntos"],
              ] as const
            ).map(([campo, etq]) => (
              <div key={campo}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "var(--ct-57524c, #57524C)",
                    marginBottom: "3px",
                  }}
                >
                  {etq}
                </label>
                <input
                  type="text"
                  value={String(entregaEditando[campo] ?? "")}
                  onChange={(e) =>
                    setEntregaEditando((prev) =>
                      prev ? { ...prev, [campo]: e.target.value } : null
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.84rem",
                  }}
                />
              </div>
            ))}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                  marginBottom: "3px",
                }}
              >
                Fecha y Hora del Servicio
              </label>
              <input
                type="datetime-local"
                value={(entregaEditando.fechaServicio || "").slice(0, 16)}
                onChange={(e) =>
                  setEntregaEditando((prev) =>
                    prev
                      ? { ...prev, fechaServicio: new Date(e.target.value).toISOString() }
                      : null
                  )
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                }}
              />
            </div>

            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: "var(--cf-f8f7f4, #F8F7F4)",
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #57524C)",
                }}
              >
                Fotografía de Confirmación (Informe / Evidencia Permanente)
              </label>
              {entregaEditando.fotoUrl && (
                <img
                  src={entregaEditando.fotoUrl}
                  alt="Foto confirmación"
                  style={{
                    width: "100%",
                    maxHeight: "190px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  }}
                />
              )}
              <label
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  border: "1px solid #2F4737",
                  background: "var(--cf-f2f6f3, #F2F6F3)",
                  color: "var(--ct-2b4a36, #2B4A36)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: subiendoFotoEdicion ? "wait" : "pointer",
                }}
              >
                {subiendoFotoEdicion ? <Loader2 size={14} /> : <Camera size={14} />}
                <span>
                  {subiendoFotoEdicion
                    ? "Almacenando foto..."
                    : entregaEditando.fotoUrl
                      ? "Reemplazar Foto"
                      : "Adjuntar Foto"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={subiendoFotoEdicion}
                  onChange={(ev) => void handleSubirFotoEnModalEdicion(ev)}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                paddingTop: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => setEntregaEditando(null)}
                title="Cancelar edición"
                aria-label="Cancelar"
                style={{
                  padding: "9px 14px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
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
                title="Guardar cambios en la entrega"
                aria-label="Guardar cambios"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: guardandoEdicion ? "wait" : "pointer",
                }}
              >
                {guardandoEdicion ? <Loader2 size={14} /> : <Save size={14} />}
                <span>Guardar</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE INSTALACIÓN RÁPIDA DE APLICACIÓN MÓVIL (PWA) */}
      {mostrarGuiaPwa && (
        <div
          onClick={() => setMostrarGuiaPwa(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "400px",
              background: "var(--cf-ffffff, #FFFFFF)",
              borderRadius: "18px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <strong style={{ fontSize: "1rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                📲 Instalar Aplicación en tu Celular
              </strong>
              <button
                type="button"
                onClick={() => setMostrarGuiaPwa(false)}
                title="Cerrar ventana"
                aria-label="Cerrar"
                style={{
                  border: "none",
                  background: "var(--cf-f4f2ee, #F4F2EE)",
                  borderRadius: "8px",
                  width: "30px",
                  height: "30px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {esDispositivoIos ? (
              <div
                style={{
                  background: "var(--cf-f8f7f4, #F8F7F4)",
                  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                  borderRadius: "12px",
                  padding: "13px",
                  fontSize: "0.85rem",
                  color: "var(--ct-221e1b, #221E1B)",
                  lineHeight: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div>
                  <strong>1.</strong> Toca el botón{" "}
                  <strong style={{ color: "var(--ct-221e1b, #221E1B)" }}>Compartir (↑)</strong> en la barra de Safari.
                </div>
                <div>
                  <strong>2.</strong> Selecciona{" "}
                  <strong>&ldquo;Agregar a Inicio&rdquo;</strong> y pulsa{" "}
                  <strong>Agregar</strong>.
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--cf-f8f7f4, #F8F7F4)",
                  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                  borderRadius: "12px",
                  padding: "13px",
                  fontSize: "0.85rem",
                  color: "var(--ct-221e1b, #221E1B)",
                  lineHeight: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div>
                  <strong>1.</strong> Toca el menú <strong>⋮</strong> arriba a la derecha en Chrome.
                </div>
                <div>
                  <strong>2.</strong> Pulsa{" "}
                  <strong style={{ color: "var(--ct-2f4737, #2F4737)" }}>
                    &ldquo;Instalar aplicación&rdquo;
                  </strong>{" "}
                  o <strong>&ldquo;Agregar a la pantalla principal&rdquo;</strong>.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMostrarGuiaPwa(false)}
              title="Cerrar instrucciones"
              aria-label="Entendido"
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "none",
                background: "#2F4737",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "0.86rem",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
