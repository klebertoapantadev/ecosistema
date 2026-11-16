"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Upload,
  Wifi,
} from "lucide-react";
import {
  actualizarEntregaEvidenciaAction,
  emitirInformeQuincenalAction,
  obtenerTableroEntregasAction,
  registrarOSincronizarEntregaAction,
  type DatosTableroEntregas,
} from "../acciones-operaciones-taller";
import {
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
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
  comprimirYEstamparFotoArchivo,
  dataUrlABlob,
  generarTarjetaMapaGpsDataUrl,
  subirArchivoOperativoStorage,
} from "../utils/evidenciaImagenGps";

export interface PropsConsolaConfirmacionEntregas {
  negocio: string;
  datosIniciales?: DatosTableroEntregas | null;
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
}: PropsConsolaConfirmacionEntregas) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_tablero_entregas_${negNorm}`;

  const [tablero, setTablero] = useState<DatosTableroEntregas>(
    datosIniciales ?? {
      usuarioActualId: null,
      usuarioActualNombre: "Colaborador",
      esAdminOperador: true,
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

  const [pestana, setPestana] = useState<PestanaEntregas>("captura");
  const [enLinea, setEnLinea] = useState<boolean>(true);
  const [colaOffline, setColaOffline] = useState<ItemColaOfflineEntrega[]>([]);
  const [sincronizandoOffline, setSincronizandoOffline] = useState<boolean>(false);
  const [eventoInstalacionPwa, setEventoInstalacionPwa] = useState<any>(null);

  const [cargando, setCargando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // =========================================================================
  // ESTADO DE CAPTURA EN CAMPO (ONLINE + OFFLINE)
  // =========================================================================
  const [tipoOrigenCaptura, setTipoOrigenCaptura] = useState<TipoOrigenEntrega>(
    "ORDEN_TRABAJO_CONVENIO"
  );
  const [otSeleccionadaId, setOtSeleccionadaId] = useState<string>("");
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string>("");

  const [fallecidoDestinatario, setFallecidoDestinatario] = useState<string>("");
  const [ubicacionNombre, setUbicacionNombre] = useState<string>("");
  const [descripcionServicio, setDescripcionServicio] = useState<string>(
    "Set de condolencias (3 arreglos florales)"
  );
  const [coordinadorNombre, setCoordinadorNombre] = useState<string>("");
  const [recursosUtilizados, setRecursosUtilizados] = useState<string>(
    "Flores, follaje, bases y oasis"
  );
  const [observacionesCaptura, setObservacionesCaptura] = useState<string>("");

  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [precisionMetros, setPrecisionMetros] = useState<number | null>(null);
  const [obteniendoGps, setObteniendoGps] = useState<boolean>(false);
  const [estadoGpsTexto, setEstadoGpsTexto] = useState<string>("Listo para capturar GPS");

  const [fotoCapturadaDataUrl, setFotoCapturadaDataUrl] = useState<string>("");
  const [mapaGeneradoDataUrl, setMapaGeneradoDataUrl] = useState<string>("");
  const [horaCapturaIso, setHoraCapturaIso] = useState<string>("");
  const [procesandoFoto, setProcesandoFoto] = useState<boolean>(false);
  const [guardandoEntrega, setGuardandoEntrega] = useState<boolean>(false);

  // =========================================================================
  // ESTADO DE PROGRAMACIÓN RÁPIDA DE ORDEN DE TRABAJO (TALLER / ADMIN)
  // =========================================================================
  const [otNuevaFallecido, setOtNuevaFallecido] = useState<string>("");
  const [otNuevaUbicacion, setOtNuevaUbicacion] = useState<string>("");
  const [otNuevaDescripcion, setOtNuevaDescripcion] = useState<string>(
    "Set de condolencias (3 arreglos florales)"
  );
  const [otNuevaCoordinador, setOtNuevaCoordinador] = useState<string>("");
  const [creandoOt, setCreandoOt] = useState<boolean>(false);

  // Edición de entrega antes del informe
  const [entregaEditando, setEntregaEditando] = useState<RegistroEntregaEvidencia | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);

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
    const onBeforeInstall = (ev: Event) => {
      ev.preventDefault();
      setEventoInstalacionPwa(ev);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-operaciones.js").catch(() => {});
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
    };
  }, [datosIniciales, cacheKey, recargarTablero, refrescarColaOffline]);

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
          if (upFoto.ok) fotoUrlFinal = upFoto.publicUrl;
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
          if (upMapa.ok) mapaUrlFinal = upMapa.publicUrl;
        }

        const resSync = await registrarOSincronizarEntregaAction({
          negocio: negNorm,
          uuidCliente: item.uuidCliente,
          entregaId: item.entregaIdProgramada ?? null,
          tipoOrigen: item.tipoOrigen,
          convenioId: item.convenioId,
          proformaId: item.proformaId,
          entregadorNombre: item.entregadorNombre,
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

  // Captura de coordenadas GPS del dispositivo (funciona incluso sin datos usando chip GPS)
  const capturarUbicacionGps = useCallback((): Promise<{
    lat: number;
    lng: number;
    acc: number;
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
          setEstadoGpsTexto(
            `GPS listo: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(acc)}m)`
          );
          try {
            const mapaData = await generarTarjetaMapaGpsDataUrl(lat, lng, acc, ubicacionNombre);
            setMapaGeneradoDataUrl(mapaData);
          } catch {
            // Ignorar
          }
          resolve({ lat, lng, acc });
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

  const handleSeleccionarOtProgramada = (otId: string) => {
    setOtSeleccionadaId(otId);
    const ot = otsProgramadas.find((x) => x.id === otId);
    if (ot) {
      setFallecidoDestinatario(ot.fallecidoDestinatario);
      setUbicacionNombre(ot.ubicacionNombre);
      setDescripcionServicio(ot.descripcionServicio);
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
      setDescripcionServicio(ped.resumenItems);
    }
  };

  const handleTomarOSubirFotoEntrega = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setProcesandoFoto(true);
    setErrorMsg(null);

    let coords =
      latitud != null && longitud != null
        ? { lat: latitud, lng: longitud, acc: precisionMetros ?? 15 }
        : null;
    if (!coords) {
      coords = await capturarUbicacionGps();
    }

    const instanteIso = new Date().toISOString();
    setHoraCapturaIso(instanteIso);

    try {
      const estampada = await comprimirYEstamparFotoArchivo(archivo, 1280, 0.84, {
        latitud: coords?.lat ?? latitud,
        longitud: coords?.lng ?? longitud,
        precisionMetros: coords?.acc ?? precisionMetros,
        fechaHoraIso: instanteIso,
        ubicacionTexto: ubicacionNombre || undefined,
        entregadorNombre: tablero.usuarioActualNombre,
      });
      setFotoCapturadaDataUrl(estampada);

      if (coords && !mapaGeneradoDataUrl) {
        const mapa = await generarTarjetaMapaGpsDataUrl(
          coords.lat,
          coords.lng,
          coords.acc,
          ubicacionNombre
        );
        setMapaGeneradoDataUrl(mapa);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo procesar la fotografía");
    } finally {
      setProcesandoFoto(false);
    }
  };

  const limpiarFormularioCaptura = () => {
    setOtSeleccionadaId("");
    setPedidoSeleccionadoId("");
    setFallecidoDestinatario("");
    setUbicacionNombre("");
    setCoordinadorNombre("");
    setObservacionesCaptura("");
    setFotoCapturadaDataUrl("");
    setMapaGeneradoDataUrl("");
    setHoraCapturaIso("");
  };

  const handleRegistrarEntregaCampo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotoCapturadaDataUrl) {
      setErrorMsg("Toma o adjunta la fotografía de respaldo de la entrega.");
      return;
    }
    if (!fallecidoDestinatario.trim()) {
      setErrorMsg(
        tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
          ? "Ingresa el nombre del fallecido / servicio."
          : "Selecciona el pedido o ingresa el destinatario."
      );
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

    const paqueteOffline: ItemColaOfflineEntrega = {
      uuidCliente: uuidCli,
      negocio: negNorm,
      entregaIdProgramada: otSeleccionadaId || null,
      tipoOrigen: tipoOrigenCaptura,
      convenioId: convenioPrincipal?.id ?? null,
      proformaId: tipoOrigenCaptura === "PEDIDO_TIENDA" ? pedidoSeleccionadoId || null : null,
      entregadorNombre: tablero.usuarioActualNombre,
      fallecidoDestinatario: fallecidoDestinatario.trim(),
      fechaServicio: instante,
      capturadoEn: instante,
      descripcionServicio: descripcionServicio.trim() || "Entrega floral",
      ubicacionNombre: ubicacionNombre.trim(),
      coordinadorNombre: coordinadorNombre.trim() || undefined,
      recursosUtilizados: recursosUtilizados.trim() || undefined,
      latitud,
      longitud,
      precisionMetros,
      fotoDataUrl: fotoCapturadaDataUrl,
      mapaDataUrl: mapaGeneradoDataUrl || null,
      observaciones: observacionesCaptura.trim() || undefined,
      intentosSync: 0,
    };

    // Si estamos sin internet, guardar directamente en IndexedDB
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await guardarEntregaEnColaOffline(paqueteOffline);
        await refrescarColaOffline();
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
      const upFoto = await subirArchivoOperativoStorage(
        supabase,
        "evidencias-entregas",
        negNorm,
        dataUrlABlob(fotoCapturadaDataUrl),
        "jpg",
        "image/jpeg"
      );

      if (!upFoto.ok) {
        throw new Error(upFoto.error);
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
        if (upMapa.ok) mapaUrlSubida = upMapa.publicUrl;
      }

      const res = await registrarOSincronizarEntregaAction({
        negocio: negNorm,
        uuidCliente: uuidCli,
        entregaId: otSeleccionadaId || null,
        tipoOrigen: tipoOrigenCaptura,
        convenioId: convenioPrincipal?.id ?? null,
        proformaId: tipoOrigenCaptura === "PEDIDO_TIENDA" ? pedidoSeleccionadoId || null : null,
        entregadorNombre: tablero.usuarioActualNombre,
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
        fotoUrl: upFoto.publicUrl,
        mapaUrl: mapaUrlSubida,
        observaciones: paqueteOffline.observaciones,
      });

      if (!res.ok) {
        throw new Error(res.error);
      }

      limpiarFormularioCaptura();
      setMensajeExito(`✅ Entrega registrada y georreferenciada (${res.codigoOt}).`);
      await recargarTablero(true);
    } catch (errRed) {
      try {
        await guardarEntregaEnColaOffline(paqueteOffline);
        await refrescarColaOffline();
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
    if (!otNuevaFallecido.trim()) return;
    setCreandoOt(true);
    setErrorMsg(null);

    const uuidCli =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-0000-4000-8000-111111111111`;

    const res = await registrarOSincronizarEntregaAction({
      negocio: negNorm,
      uuidCliente: uuidCli,
      tipoOrigen: "ORDEN_TRABAJO_CONVENIO",
      convenioId: convenioPrincipal?.id ?? null,
      soloProgramarOt: true,
      fallecidoDestinatario: otNuevaFallecido.trim(),
      ubicacionNombre: otNuevaUbicacion.trim(),
      descripcionServicio:
        otNuevaDescripcion.trim() || "Set de condolencias (3 arreglos florales)",
      coordinadorNombre: otNuevaCoordinador.trim() || undefined,
    });

    setCreandoOt(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setOtNuevaFallecido("");
    setOtNuevaUbicacion("");
    setOtNuevaCoordinador("");
    setMensajeExito(`Orden de Trabajo ${res.codigoOt} creada y lista para el repartidor.`);
    await recargarTablero(true);
  };

  const handleGuardarEdicionEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entregaEditando) return;
    setGuardandoEdicion(true);
    const res = await actualizarEntregaEvidenciaAction({
      negocio: negNorm,
      entregaId: entregaEditando.id,
      cambios: {
        fallecidoDestinatario: entregaEditando.fallecidoDestinatario,
        fechaServicio: entregaEditando.fechaServicio,
        descripcionServicio: entregaEditando.descripcionServicio,
        ubicacionNombre: entregaEditando.ubicacionNombre,
        coordinadorNombre: entregaEditando.coordinadorNombre ?? "",
        recursosUtilizados: entregaEditando.recursosUtilizados ?? "",
        entregadorNombre: entregaEditando.entregadorNombre,
        facturaReferencia: entregaEditando.facturaReferencia ?? "",
        documentosAdjuntos: entregaEditando.documentosAdjuntos ?? "",
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
            <strong style={{ fontSize: "0.84rem", color: "#0F172A" }}>{r.codigoOt}</strong>
            <span style={{ fontSize: "0.73rem", color: "#64748B" }}>
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
            <strong style={{ fontSize: "0.85rem", color: "#1E293B" }}>
              {r.fallecidoDestinatario}
            </strong>
            <span style={{ fontSize: "0.74rem", color: "#64748B" }}>{r.descripcionServicio}</span>
          </div>
        ),
      },
      {
        id: "ubicacion",
        encabezado: "Ubicación y Coordinador",
        valor: (r) => `${r.ubicacionNombre} ${r.coordinadorNombre || ""}`,
        render: (r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.82rem", color: "#0F172A" }}>
              {r.ubicacionNombre || "Por definir"}
            </span>
            {r.coordinadorNombre && (
              <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {r.fotoUrl && (
              <a href={r.fotoUrl} target="_blank" rel="noreferrer" title="Abrir fotografía">
                <img
                  src={r.fotoUrl}
                  alt="Evidencia"
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "8px",
                    objectFit: "cover",
                    border: "1px solid #CBD5E1",
                  }}
                />
              </a>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0F172A" }}>
                {r.entregadorNombre}
              </span>
              {r.latitud != null && r.longitud != null ? (
                <a
                  href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.72rem", color: "#2563EB", textDecoration: "none" }}
                >
                  📍 Ver Pin GPS
                </a>
              ) : (
                <span style={{ fontSize: "0.71rem", color: "#94A3B8" }}>Sin GPS aún</span>
              )}
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
                  background: esProg ? "#FEF3C7" : esInf ? "#DBEAFE" : "#DCFCE7",
                  color: esProg ? "#92400E" : esInf ? "#1E40AF" : "#166534",
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
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
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
    [tablero.esAdminOperador]
  );

  const columnasInformesHistoricos = useMemo<ColumnaDataGrid<InformeQuincenalEntregas>[]>(
    () => [
      {
        id: "numero",
        encabezado: "N.º de Informe",
        valor: (i) => i.numeroInforme,
        render: (i) => <strong style={{ color: "#0F172A" }}>{i.numeroInforme}</strong>,
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
              background: "#0F172A",
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
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
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
                  border: activa ? "1px solid #0F172A" : "1px solid #E2E8F0",
                  background: activa ? "#0F172A" : "#F8FAFC",
                  color: activa ? "#FFFFFF" : "#334155",
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
                    background: activa ? "rgba(255,255,255,0.2)" : "#E2E8F0",
                    color: activa ? "#FFFFFF" : "#475569",
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
              background: enLinea ? "#ECFDF5" : "#FFFBEB",
              border: `1px solid ${enLinea ? "#A7F3D0" : "#FDE68A"}`,
              color: enLinea ? "#047857" : "#B45309",
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
                background: "#EA580C",
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

          {eventoInstalacionPwa && (
            <button
              type="button"
              onClick={() => {
                eventoInstalacionPwa.prompt();
                setEventoInstalacionPwa(null);
              }}
              title="Instalar aplicación en la pantalla de inicio del celular para uso sin internet"
              aria-label="Instalar App"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "9px",
                border: "1px solid #10B981",
                background: "#ECFDF5",
                color: "#065F46",
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

      {tablero.migracionPendiente && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            color: "#92400E",
            fontSize: "0.81rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={16} />
          <span>
            Ejecuta la migración{" "}
            <code>20261115000010_herramientas_taller_inventario_inmediata_y_entregas_iess.sql</code>{" "}
            en Supabase para habilitar el almacenamiento centralizado (las capturas en teléfono ya
            funcionan offline).
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
            fontSize: "0.84rem",
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
          PESTAÑA 1: CAPTURA MÓVIL DE ENTREGA (SIN PUBLICIDAD + OFFLINE)
      ===================================================================== */}
      {pestana === "captura" && (
        <form
          onSubmit={(e) => void handleRegistrarEntregaCampo(e)}
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
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setTipoOrigenCaptura("ORDEN_TRABAJO_CONVENIO");
                limpiarFormularioCaptura();
                setDescripcionServicio("Set de condolencias (3 arreglos florales)");
              }}
              style={{
                flex: "1 1 240px",
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                    ? "2px solid #0F172A"
                    : "1px solid #CBD5E1",
                background:
                  tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" ? "#F8FAFC" : "#FFFFFF",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.9rem", color: "#0F172A" }}>
                🕊️ Orden de Trabajo — Exequiales IESS
              </strong>
              <span style={{ fontSize: "0.76rem", color: "#64748B" }}>
                Foto + Georreferencia obligatoria para el informe quincenal
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTipoOrigenCaptura("PEDIDO_TIENDA");
                limpiarFormularioCaptura();
                setDescripcionServicio("Entrega de pedido floral");
              }}
              style={{
                flex: "1 1 240px",
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  tipoOrigenCaptura === "PEDIDO_TIENDA"
                    ? "2px solid #059669"
                    : "1px solid #CBD5E1",
                background: tipoOrigenCaptura === "PEDIDO_TIENDA" ? "#ECFDF5" : "#FFFFFF",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.9rem", color: "#065F46" }}>
                🛍️ Resto de Pedidos de la Tienda ({tablero.pedidosPendientesTienda.length})
              </strong>
              <span style={{ fontSize: "0.76rem", color: "#047857" }}>
                Confirmar entrega fotográfica de pedidos Web / WhatsApp / Tienda
              </span>
            </button>
          </div>

          {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO" && otsProgramadas.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  marginBottom: "6px",
                }}
              >
                Órdenes de Trabajo Programadas Pendientes ({otsProgramadas.length})
              </label>
              <select
                value={otSeleccionadaId}
                onChange={(e) => handleSeleccionarOtProgramada(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.86rem",
                  background: "#F8FAFC",
                }}
              >
                <option value="">-- Nueva entrega directa en sitio (sin OT previa) --</option>
                {otsProgramadas.map((ot) => (
                  <option key={ot.id} value={ot.id}>
                    {ot.codigoOt} · {ot.fallecidoDestinatario} ({ot.ubicacionNombre || "Sin sala"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {tipoOrigenCaptura === "PEDIDO_TIENDA" && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  marginBottom: "6px",
                }}
              >
                Seleccionar Pedido Pendiente de Entrega
              </label>
              <select
                value={pedidoSeleccionadoId}
                onChange={(e) => handleSeleccionarPedidoTienda(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.86rem",
                }}
              >
                <option value="">-- Selecciona un pedido o llena manualmente abajo --</option>
                {tablero.pedidosPendientesTienda.map((p) => (
                  <option key={p.proformaId} value={p.proformaId}>
                    {p.codigoOrden} · {p.destinatarioNombre} — {p.direccionEntrega}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CÁMARA + GPS EN UN SOLO BLOQUE TÁCTIL */}
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
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
                  style={{ color: latitud != null ? "#059669" : "#D97706" }}
                />
                <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#1E293B" }}>
                  {estadoGpsTexto}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void capturarUbicacionGps()}
                  disabled={obteniendoGps}
                  title="Obtener coordenadas GPS actuales del teléfono"
                  aria-label="Capturar GPS"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 13px",
                    borderRadius: "9px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#0F172A",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: obteniendoGps ? "wait" : "pointer",
                  }}
                >
                  {obteniendoGps ? <Loader2 size={14} /> : <Navigation size={14} />}
                  <span>Capturar GPS</span>
                </button>

                <label
                  title="Abrir cámara del teléfono y estampar hora y coordenadas GPS automáticamente"
                  aria-label="Tomar foto entrega"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 15px",
                    borderRadius: "9px",
                    background: "#0F172A",
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
                  title="Subir foto desde galería del teléfono"
                  aria-label="Subir desde galería"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 13px",
                    borderRadius: "9px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
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
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <img
                  src={fotoCapturadaDataUrl}
                  alt="Vista previa evidencia georreferenciada"
                  style={{
                    maxWidth: "300px",
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "2px solid #10B981",
                  }}
                />
                {mapaGeneradoDataUrl && (
                  <img
                    src={mapaGeneradoDataUrl}
                    alt="Tarjeta Mapa GPS"
                    style={{
                      width: "142px",
                      height: "200px",
                      objectFit: "cover",
                      borderRadius: "10px",
                      border: "1px solid #CBD5E1",
                    }}
                  />
                )}
              </div>
            )}
          </div>

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
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                {tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                  ? "Nombre del Fallecido *"
                  : "Destinatario / Orden *"}
              </label>
              <input
                type="text"
                required
                value={fallecidoDestinatario}
                onChange={(e) => setFallecidoDestinatario(e.target.value)}
                placeholder={
                  tipoOrigenCaptura === "ORDEN_TRABAJO_CONVENIO"
                    ? "Ej. Rodríguez Navarrete Myrian Graciela"
                    : "Nombre de quien recibe"
                }
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
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
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Ubicación / Funeraria / Edificio *
              </label>
              <input
                type="text"
                required
                value={ubicacionNombre}
                onChange={(e) => setUbicacionNombre(e.target.value)}
                placeholder="Ej. Funeraria América / Sala Exequiales IESS"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
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
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Descripción del Servicio
              </label>
              <input
                type="text"
                value={descripcionServicio}
                onChange={(e) => setDescripcionServicio(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
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
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  Coordinador del Servicio (IESS)
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
                    border: "1px solid #CBD5E1",
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
              borderTop: "1px solid #F1F5F9",
            }}
          >
            <span style={{ fontSize: "0.79rem", color: "#64748B" }}>
              Entregador identificado: <strong>{tablero.usuarioActualNombre}</strong>
            </span>

            <button
              type="submit"
              disabled={guardandoEntrega}
              title="Registrar entrega georreferenciada (en línea o en memoria offline)"
              aria-label="Confirmar entrega"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 22px",
                borderRadius: "10px",
                border: "none",
                background: "#059669",
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
          <form
            onSubmit={(e) => void handleProgramarOt(e)}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#0F172A" }}>
              Programar Nueva Orden de Trabajo — Exequiales del IESS
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "10px",
              }}
            >
              <input
                type="text"
                required
                value={otNuevaFallecido}
                onChange={(e) => setOtNuevaFallecido(e.target.value)}
                placeholder="Nombre del Fallecido *"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.84rem",
                }}
              />
              <input
                type="text"
                value={otNuevaUbicacion}
                onChange={(e) => setOtNuevaUbicacion(e.target.value)}
                placeholder="Funeraria / Edificio"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.84rem",
                }}
              />
              <input
                type="text"
                value={otNuevaDescripcion}
                onChange={(e) => setOtNuevaDescripcion(e.target.value)}
                placeholder="Descripción (ej. Set de condolencias 3 arreglos)"
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.84rem",
                }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={otNuevaCoordinador}
                  onChange={(e) => setOtNuevaCoordinador(e.target.value)}
                  placeholder="Coordinador IESS"
                  style={{
                    flex: 1,
                    padding: "9px 11px",
                    borderRadius: "9px",
                    border: "1px solid #CBD5E1",
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
                    background: "#0F172A",
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

          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
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
              <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "#0F172A" }}>
                Configuración y Numeración del Informe Quincenal (Formato Oficial Proveedores)
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "0.81rem", color: "#64748B" }}>
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
                    border: "1px solid #CBD5E1",
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
                    border: "1px solid #CBD5E1",
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
                    border: "1px solid #CBD5E1",
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
                    border: "1px solid #CBD5E1",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {/* Datos editables de la Sección 1 del Proveedor */}
            <details
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "12px 14px",
                background: "#F8FAFC",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  color: "#0F172A",
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
                        color: "#475569",
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
                        border: "1px solid #CBD5E1",
                        fontSize: "0.81rem",
                        background: "#FFFFFF",
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
                  border: "1px solid #CBD5E1",
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
                  border: "1px solid #CBD5E1",
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
                  background: "#0F172A",
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
                      border: `1px solid ${incluida ? "#CBD5E1" : "#E2E8F0"}`,
                      background: incluida ? "#FFFFFF" : "#F8FAFC",
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
                        <strong style={{ fontSize: "0.86rem", color: "#0F172A", display: "block" }}>
                          {item.fallecidoDestinatario}
                        </strong>
                        <span style={{ fontSize: "0.76rem", color: "#64748B" }}>
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
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
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
          PESTAÑA 4: HISTÓRICO DE INFORMES EMITIDOS Y PEDIDOS REGULARES
      ===================================================================== */}
      {pestana === "historico" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#0F172A" }}>
              Histórico de Informes Quincenales Emitidos ({tablero.informes.length})
            </h3>
            <DataGrid
              columnas={columnasInformesHistoricos}
              filas={tablero.informes}
              idFila={(i) => i.id}
              nombreExportacion={`informes-quincenales-${negNorm}`}
            />
          </div>

          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#0F172A" }}>
              Entregas Confirmadas del Resto de Pedidos de la Tienda
            </h3>
            <DataGrid
              columnas={columnasOrdenesOt}
              filas={tablero.entregas.filter((e) => e.tipoOrigen === "PEDIDO_TIENDA")}
              idFila={(r) => r.id}
              nombreExportacion={`entregas-pedidos-tienda-${negNorm}`}
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
              background: "#FFFFFF",
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
            <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "#0F172A" }}>
              Editar Registro de Servicio ({entregaEditando.codigoOt})
            </h3>

            {(
              [
                ["fallecidoDestinatario", "Nombre del Fallecido / Destinatario"],
                ["descripcionServicio", "Descripción del Servicio"],
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
                    color: "#334155",
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
                    border: "1px solid #CBD5E1",
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
                  color: "#334155",
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
                  border: "1px solid #CBD5E1",
                  fontSize: "0.84rem",
                }}
              />
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
                title="Guardar cambios en la entrega"
                aria-label="Guardar cambios"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#059669",
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
    </div>
  );
}
