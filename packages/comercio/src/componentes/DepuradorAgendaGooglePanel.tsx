"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportarHojasAExcel, leerHojasDesdeExcelBuffer } from "@eco/datagrid";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  Copy,
  Download,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Split,
  Terminal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  aplicarLoteDepuracionGoogleAction,
  desconectarGoogleContactsAction,
  guardarAppOauthGoogleContactsAction,
  leerContactosDesdeGoogleAction,
  obtenerEstadoGoogleContactsAction,
  prepararGruposGoogleContactsAction,
  type ConexionGoogleContactsInfo,
  type OperacionEscrituraGoogleContacts,
} from "../acciones-google-contacts";
import { importarContactosDirectorioLoteAction } from "../acciones-omnicanal";
import { REGLAS_CLASIFICACION_DEFECTO, type ClasificacionContacto } from "../contactos-omnicanal";
import {
  depurarAgenda2D,
  expandirFichasDepuradasParaDirectorio,
  generarCsvGoogleContacts,
  generarHojasAuditoriaDepuracion,
  generarVcfLimpioV3,
  OPCIONES_DEPURADOR_DEFECTO,
  parsearTablaAFichasAgenda,
  parsearVcfAFichasAgenda,
  separarFichaDepurada,
  type FichaAgendaCruda,
  type FichaAgendaDepurada,
  type FichaAgendaExcluida,
  type FormatoTelefonoAgenda,
  type OpcionesDepuradorAgenda,
  type ResumenDepuracionAgenda,
} from "../depurador-agenda";

export interface DepuradorAgendaGooglePanelProps {
  negocio: string;
  onDirectorioActualizado?: () => Promise<void> | void;
}

type FiltroDepurador =
  | "todos"
  | "fusionados"
  | "tel_corregidos"
  | "nombres_limpiados"
  | "clientes"
  | "personales"
  | "proveedores"
  | "equipo";

interface EntradaLogSync {
  hora: string;
  nivel: "info" | "ok" | "aviso" | "error";
  texto: string;
}

interface CheckpointSyncGoogle {
  version: 1;
  conexionId: string;
  correoGoogle: string;
  modoDuplicados: "ETIQUETAR" | "PAPELERA";
  mapaGrupos: Record<string, string>;
  operaciones: OperacionEscrituraGoogleContacts[];
  siguienteIndice: number;
  actualizados: number;
  etiquetadosCategoria?: number;
  etiquetadosDuplicados: number;
  eliminadosPapelera: number;
  errores: string[];
  logs: EntradaLogSync[];
  iniciadoEn: string;
  actualizadoEn: string;
}

interface CheckpointSyncApp {
  version: 1;
  origen: "GOOGLE_CONTACTS" | "VCF";
  contactos: ReturnType<typeof expandirFichasDepuradasParaDirectorio>;
  siguienteIndice: number;
  creados: number;
  actualizados: number;
  hilosProtegidos: number;
  errores: string[];
  logs: EntradaLogSync[];
  iniciadoEn: string;
  actualizadoEn: string;
}

interface EstadoModalSync {
  abierto: boolean;
  modo: "google" | "app" | "lectura_google";
  estado: "ejecutando" | "pausando" | "pausado" | "error" | "completado";
  titulo: string;
  subtitulo: string;
  hechos: number;
  total: number;
  loteActual: number;
  totalLotes: number;
  etapaActual: string;
  iniciadoMs: number;
  hechosAlInicioSesion: number;
  kpis: Array<{ label: string; valor: number; color: string }>;
  logs: EntradaLogSync[];
  errorMensaje: string | null;
  wakeLockActivo: boolean;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

const TAMANO_LOTE_GOOGLE = 60;
const TAMANO_LOTE_APP = 150;
const MAX_LOGS_SYNC = 120;

function crearEntradaLog(nivel: EntradaLogSync["nivel"], texto: string): EntradaLogSync {
  const ahora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hora: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`,
    nivel,
    texto,
  };
}

function anexarLogs(actuales: EntradaLogSync[], nuevas: EntradaLogSync[]): EntradaLogSync[] {
  const combinados = [...actuales, ...nuevas];
  return combinados.length > MAX_LOGS_SYNC
    ? combinados.slice(combinados.length - MAX_LOGS_SYNC)
    : combinados;
}

function formatearDuracionSeg(segundos: number): string {
  const segs = Math.max(0, Math.round(segundos));
  const m = Math.floor(segs / 60);
  const s = segs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function guardarCheckpointLocal<T>(clave: string, valor: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Ignorar si el navegador bloquea storage o excede cuota
  }
}

function leerCheckpointLocal<T>(clave: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(clave);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function borrarCheckpointLocal(clave: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(clave);
  } catch {
    // noop
  }
}

function esperarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ESTILO_CAT: Record<
  ClasificacionContacto,
  { etiqueta: string; fondo: string; texto: string; borde: string }
> = {
  PERSONAL: {
    etiqueta: "🔒 Personal",
    fondo: "var(--cf-f3e8ff, #F3E8FF)",
    texto: "var(--ct-6b21a8, #6B21A8)",
    borde: "var(--cb-ddd6fe, #DDD6FE)",
  },
  CLIENTE: {
    etiqueta: "💼 Cliente",
    fondo: "var(--cf-dcfce7, #DCFCE7)",
    texto: "var(--ct-166534, #166534)",
    borde: "var(--cb-bbf7d0, #BBF7D0)",
  },
  PROVEEDOR: {
    etiqueta: "🚚 Proveedor",
    fondo: "var(--cf-fef3c7, #FEF3C7)",
    texto: "var(--ct-92400e, #92400E)",
    borde: "var(--cb-fde68a, #FDE68A)",
  },
  EQUIPO_INTERNO: {
    etiqueta: "👥 Equipo",
    fondo: "var(--cf-dbeafe, #DBEAFE)",
    texto: "var(--ct-1e40af, #1E40AF)",
    borde: "var(--cb-bfdbfe, #BFDBFE)",
  },
  BLOQUEADO_SPAM: {
    etiqueta: "🚫 Bloqueado",
    fondo: "var(--cf-fee2e2, #FEE2E2)",
    texto: "var(--ct-991b1b, #991B1B)",
    borde: "var(--cb-fecaca, #FECACA)",
  },
};

function descargarArchivoTexto(contenido: string, nombreArchivo: string, mime: string) {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DepuradorAgendaGooglePanel({
  negocio,
  onDirectorioActualizado,
}: DepuradorAgendaGooglePanelProps) {
  const negNorm = negocio.trim().toLowerCase();

  // Estado Google OAuth / People API
  const [cargandoEstadoGoogle, setCargandoEstadoGoogle] = useState<boolean>(true);
  const [esAdmin, setEsAdmin] = useState<boolean>(false);
  const [credencialesConfiguradas, setCredencialesConfiguradas] = useState<boolean>(false);
  const [origenCredenciales, setOrigenCredenciales] = useState<"env" | "vault" | "ninguno">(
    "ninguno"
  );
  const [clientIdInput, setClientIdInput] = useState<string>("");
  const [clientSecretInput, setClientSecretInput] = useState<string>("");
  const [guardandoAppOauth, setGuardandoAppOauth] = useState<boolean>(false);
  const [conexionesGoogle, setConexionesGoogle] = useState<ConexionGoogleContactsInfo[]>([]);
  const [conexionActivaId, setConexionActivaId] = useState<string | null>(null);
  const [leyendoGoogleId, setLeyendoGoogleId] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState<string>("");
  const [copioCallback, setCopioCallback] = useState<boolean>(false);

  // Estado del Depurador 2D
  const [fichasCrudas, setFichasCrudas] = useState<FichaAgendaCruda[]>([]);
  const [fuentesResumen, setFuentesResumen] = useState<Array<{ nombre: string; total: number }>>(
    []
  );
  const [fichasDepuradas, setFichasDepuradas] = useState<FichaAgendaDepurada[]>([]);
  const [fichasExcluidas, setFichasExcluidas] = useState<FichaAgendaExcluida[]>([]);
  const [resumen, setResumen] = useState<ResumenDepuracionAgenda | null>(null);

  // Opciones de estandarización
  const [formatoTelefono, setFormatoTelefono] = useState<FormatoTelefonoAgenda>("E164_LEGIBLE");
  const [fusionarPorNombreSimilar, setFusionarPorNombreSimilar] = useState<boolean>(true);
  const [limpiarSimbolosInicio, setLimpiarSimbolosInicio] = useState<boolean>(true);
  const [normalizarMayusculas, setNormalizarMayusculas] = useState<boolean>(false);
  const [quitarEmojis, setQuitarEmojis] = useState<boolean>(false);
  const [guardarAliasEnNotas, setGuardarAliasEnNotas] = useState<boolean>(true);
  const [asignarEtiquetasCategoria, setAsignarEtiquetasCategoria] = useState<boolean>(true);
  const [excluirSinTelefono, setExcluirSinTelefono] = useState<boolean>(true);
  const [patronesExcluirTxt, setPatronesExcluirTxt] = useState<string>(
    negNorm === "tinkay" ? "cs" : ""
  );

  // Filtros y paginación
  const [filtro, setFiltro] = useState<FiltroDepurador>("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  const [pagina, setPagina] = useState<number>(1);
  const [porPagina, setPorPagina] = useState<number>(50);

  // Escritura en Google / Tinkay + Checkpoint reanudable + Modal bloqueante
  const [modoDuplicadosGoogle, setModoDuplicadosGoogle] = useState<"ETIQUETAR" | "PAPELERA">(
    "ETIQUETAR"
  );
  const [aplicandoGoogle, setAplicandoGoogle] = useState<boolean>(false);
  const [progresoGoogle, setProgresoGoogle] = useState<string | null>(null);
  const [guardandoTinkay, setGuardandoTinkay] = useState<boolean>(false);
  const [progresoTinkay, setProgresoTinkay] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [checkpointGoogle, setCheckpointGoogle] = useState<CheckpointSyncGoogle | null>(null);
  const [checkpointApp, setCheckpointApp] = useState<CheckpointSyncApp | null>(null);
  const [modalSync, setModalSync] = useState<EstadoModalSync | null>(null);
  const [ahoraMs, setAhoraMs] = useState<number>(() => Date.now());

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const resultadosRef = useRef<HTMLDivElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const pausarSyncRef = useRef<boolean>(false);
  const syncEnCursoRef = useRef<boolean>(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const claveCheckpointGoogle = `eco_gcontacts_sync_job_${negNorm}`;
  const claveCheckpointApp = `eco_app_dir_sync_job_${negNorm}`;

  const activarWakeLock = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return false;
    try {
      const sentinel = await nav.wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      return true;
    } catch {
      return false;
    }
  }, []);

  const liberarWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
    } catch {
      // noop
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  // Cargar checkpoints pendientes desde localStorage al montar
  useEffect(() => {
    const savedGoogle = leerCheckpointLocal<CheckpointSyncGoogle>(claveCheckpointGoogle);
    if (
      savedGoogle &&
      savedGoogle.version === 1 &&
      Array.isArray(savedGoogle.operaciones) &&
      savedGoogle.siguienteIndice < savedGoogle.operaciones.length
    ) {
      setCheckpointGoogle(savedGoogle);
    }
    const savedApp = leerCheckpointLocal<CheckpointSyncApp>(claveCheckpointApp);
    if (
      savedApp &&
      savedApp.version === 1 &&
      Array.isArray(savedApp.contactos) &&
      savedApp.siguienteIndice < savedApp.contactos.length
    ) {
      setCheckpointApp(savedApp);
    }
  }, [claveCheckpointGoogle, claveCheckpointApp]);

  // Cronómetro en vivo mientras sincroniza
  useEffect(() => {
    if (
      !modalSync?.abierto ||
      (modalSync.estado !== "ejecutando" && modalSync.estado !== "pausando")
    ) {
      return;
    }
    setAhoraMs(Date.now());
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [modalSync?.abierto, modalSync?.estado]);

  // Auto-scroll del log en vivo
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [modalSync?.logs.length]);

  // Bloquear scroll del fondo mientras el modal bloqueante está abierto
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!modalSync?.abierto) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [modalSync?.abierto]);

  // Detectar bloqueo de pantalla / cambio de app en móvil y re-adquirir Wake Lock
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (!syncEnCursoRef.current) return;
      if (document.visibilityState === "hidden") {
        setModalSync((prev) =>
          prev
            ? {
                ...prev,
                wakeLockActivo: false,
                logs: anexarLogs(prev.logs, [
                  crearEntradaLog(
                    "aviso",
                    "📱 Pantalla bloqueada o cambiaste de app — el progreso queda guardado lote a lote para reanudar sin reiniciar."
                  ),
                ]),
              }
            : prev
        );
      } else if (document.visibilityState === "visible") {
        void activarWakeLock().then((activo) => {
          setModalSync((prev) =>
            prev
              ? {
                  ...prev,
                  wakeLockActivo: activo,
                  logs: anexarLogs(prev.logs, [
                    crearEntradaLog("info", "📱 Volviste a la app — verificando lote en curso…"),
                  ]),
                }
              : prev
          );
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void liberarWakeLock();
    };
  }, [activarWakeLock, liberarWakeLock]);

  const opcionesActuales = useMemo<OpcionesDepuradorAgenda>(
    () => ({
      ...OPCIONES_DEPURADOR_DEFECTO,
      formatoTelefono,
      fusionarPorNombreSimilar,
      limpiarSimbolosInicio,
      normalizarMayusculas,
      quitarEmojis,
      guardarAliasEnNotas,
      asignarEtiquetasCategoria,
      excluirSinTelefono,
      patronesExcluir: patronesExcluirTxt
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      reglasClasificacion: REGLAS_CLASIFICACION_DEFECTO,
    }),
    [
      formatoTelefono,
      fusionarPorNombreSimilar,
      limpiarSimbolosInicio,
      normalizarMayusculas,
      quitarEmojis,
      guardarAliasEnNotas,
      asignarEtiquetasCategoria,
      excluirSinTelefono,
      patronesExcluirTxt,
    ]
  );

  const cargarEstadoGoogle = useCallback(async () => {
    setCargandoEstadoGoogle(true);
    const res = await obtenerEstadoGoogleContactsAction(negNorm);
    setCargandoEstadoGoogle(false);
    if (!res.ok) return;
    setEsAdmin(res.esAdmin);
    setCredencialesConfiguradas(res.credencialesConfiguradas);
    setOrigenCredenciales(res.origenCredenciales);
    if (res.clientIdActual) setClientIdInput(res.clientIdActual);
    setConexionesGoogle(res.conexiones);
  }, [negNorm]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCallbackUrl(`${window.location.origin}/api/omnicanal/google-contacts/callback`);
      const sp = new URLSearchParams(window.location.search);
      const okEmail = sp.get("google_ok");
      const errMsg = sp.get("google_error");
      if (okEmail) {
        setMensaje({
          tipo: "ok",
          texto: `Cuenta Google Contacts conectada: ${okEmail}. Ahora pulsa «Leer Google» para traer todos tus contactos.`,
        });
      } else if (errMsg) {
        setMensaje({ tipo: "error", texto: errMsg });
      }
      if (okEmail || errMsg) {
        sp.delete("google_ok");
        sp.delete("google_error");
        const nuevaQuery = sp.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${nuevaQuery ? `?${nuevaQuery}` : ""}`
        );
      }
    }
    void cargarEstadoGoogle();
  }, [cargarEstadoGoogle]);

  // Recalcular depuración 2D automáticamente cuando cambian las fichas o las opciones
  useEffect(() => {
    if (fichasCrudas.length === 0) {
      setFichasDepuradas([]);
      setFichasExcluidas([]);
      setResumen(null);
      return;
    }
    const { fichas, excluidas, resumen: res } = depurarAgenda2D(fichasCrudas, opcionesActuales);
    setFichasDepuradas(fichas);
    setFichasExcluidas(excluidas);
    setResumen(res);
  }, [fichasCrudas, opcionesActuales]);

  useEffect(() => {
    setPagina(1);
  }, [filtro, busqueda, porPagina, fichasDepuradas.length]);

  const desplazarAResultados = () => {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
  };

  const handleGuardarAppOauth = async () => {
    setMensaje(null);
    if (!clientIdInput.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el Client ID de Google Cloud OAuth." });
      return;
    }
    setGuardandoAppOauth(true);
    const res = await guardarAppOauthGoogleContactsAction({
      negocio: negNorm,
      clientId: clientIdInput,
      clientSecret: clientSecretInput || null,
    });
    setGuardandoAppOauth(false);
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setClientSecretInput("");
    setMensaje({
      tipo: "ok",
      texto: "Credenciales Google Contacts guardadas de forma segura en Supabase Vault. Ya puedes pulsar «Conectar Google».",
    });
    await cargarEstadoGoogle();
  };

  const handleDesconectarGoogle = async (con: ConexionGoogleContactsInfo) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`¿Desconectar la cuenta Google ${con.correoGoogle}?`)
    ) {
      return;
    }
    const res = await desconectarGoogleContactsAction({ negocio: negNorm, conexionId: con.id });
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    if (conexionActivaId === con.id) setConexionActivaId(null);
    setMensaje({ tipo: "ok", texto: `Cuenta ${con.correoGoogle} desconectada.` });
    await cargarEstadoGoogle();
  };

  const handleLeerDesdeGoogle = async (con: ConexionGoogleContactsInfo) => {
    setLeyendoGoogleId(con.id);
    setMensaje(null);
    const wakeOk = await activarWakeLock();
    setModalSync({
      abierto: true,
      modo: "lectura_google",
      estado: "ejecutando",
      titulo: "Leyendo Google Contacts",
      subtitulo: con.correoGoogle,
      hechos: 0,
      total: 0,
      loteActual: 1,
      totalLotes: 1,
      etapaActual: "Conectando con Google People API y descargando contactos y etiquetas…",
      iniciadoMs: Date.now(),
      hechosAlInicioSesion: 0,
      kpis: [],
      logs: [
        crearEntradaLog("info", `Conectando con ${con.correoGoogle}…`),
        crearEntradaLog("info", "Paginando contactos y grupos desde Google People API…"),
      ],
      errorMensaje: null,
      wakeLockActivo: wakeOk,
    });

    try {
      const res = await leerContactosDesdeGoogleAction({
        negocio: negNorm,
        conexionId: con.id,
        esAgendaPersonal: true,
      });

      if (!res.ok) {
        setModalSync((prev) =>
          prev
            ? {
                ...prev,
                estado: "error",
                etapaActual: "No se pudo leer tu cuenta de Google.",
                errorMensaje: res.error,
                logs: anexarLogs(prev.logs, [crearEntradaLog("error", res.error)]),
              }
            : null
        );
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }

      const etiquetaFuenteGoogle = `Google (${res.correoGoogle})`;
      const nombreResumenGoogle = `Google: ${res.correoGoogle}`;
      const nuevosRecursos = new Set(
        res.fichas.map((f) => f.googleResourceName).filter(Boolean)
      );

      setConexionActivaId(con.id);
      // Reemplazar lecturas anteriores de la misma cuenta Google (jamás duplicar el mismo resourceName)
      setFichasCrudas((prev) => [
        ...prev.filter(
          (f) =>
            f.etiquetaFuente !== etiquetaFuenteGoogle &&
            (!f.googleResourceName || !nuevosRecursos.has(f.googleResourceName))
        ),
        ...res.fichas,
      ]);
      setFuentesResumen((prev) => [
        ...prev.filter((s) => s.nombre !== nombreResumenGoogle),
        { nombre: nombreResumenGoogle, total: res.fichas.length },
      ]);
      setModalSync(null);
      setMensaje({
        tipo: "ok",
        texto: `Se leyeron ${res.fichas.length} contactos en vivo desde ${res.correoGoogle}. Revisa la depuración abajo.`,
      });
      await cargarEstadoGoogle();
      desplazarAResultados();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error de red leyendo Google Contacts.";
      setModalSync((prev) =>
        prev
          ? {
              ...prev,
              estado: "error",
              etapaActual: "Conexión interrumpida al leer Google Contacts.",
              errorMensaje: errMsg,
              logs: anexarLogs(prev.logs, [crearEntradaLog("error", errMsg)]),
            }
          : null
      );
      setMensaje({ tipo: "error", texto: errMsg });
    } finally {
      setLeyendoGoogleId(null);
      await liberarWakeLock();
    }
  };

  const handleSubirArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMensaje(null);
    const nuevas: FichaAgendaCruda[] = [];
    const nuevasFuentes: Array<{ nombre: string; total: number }> = [];

    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      try {
        if (ext === "vcf" || ext === "vcard") {
          const txt = await file.text();
          const parsed = parsearVcfAFichasAgenda(txt, {
            etiquetaFuente: file.name,
            esAgendaPersonal: true,
          });
          nuevas.push(...parsed);
          nuevasFuentes.push({ nombre: file.name, total: parsed.length });
        } else if (ext === "csv" || ext === "xlsx" || ext === "xls") {
          const buf = await file.arrayBuffer();
          const hojas = leerHojasDesdeExcelBuffer(buf);
          const filas = Object.values(hojas).flat();
          const parsed = parsearTablaAFichasAgenda(filas, ext === "csv" ? "CSV" : "XLSX", {
            etiquetaFuente: file.name,
            esAgendaPersonal: true,
          });
          nuevas.push(...parsed);
          nuevasFuentes.push({ nombre: file.name, total: parsed.length });
        } else {
          setMensaje({
            tipo: "error",
            texto: `Formato no soportado en «${file.name}». Usa .vcf, .csv o .xlsx.`,
          });
        }
      } catch (err) {
        setMensaje({
          tipo: "error",
          texto: `Error leyendo «${file.name}»: ${err instanceof Error ? err.message : "archivo inválido"}`,
        });
      }
    }

    if (nuevas.length > 0) {
      setFichasCrudas((prev) => [...prev, ...nuevas]);
      setFuentesResumen((prev) => [...prev, ...nuevasFuentes]);
      setMensaje({
        tipo: "ok",
        texto: `${nuevas.length} fichas cargadas y depuradas automáticamente.`,
      });
      desplazarAResultados();
    }
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  };

  const actualizarFicha = (id: string, parcial: Partial<FichaAgendaDepurada>) => {
    setFichasDepuradas((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...parcial };
        if (parcial.clasificacion) {
          next.etiquetaCategoriaGoogle =
            parcial.clasificacion === "CLIENTE"
              ? "Clientes"
              : parcial.clasificacion === "PROVEEDOR"
                ? "Proveedores"
                : parcial.clasificacion === "EQUIPO_INTERNO"
                  ? "Equipo"
                  : parcial.clasificacion === "BLOQUEADO_SPAM"
                    ? "Bloqueados"
                    : "Personal";
          if (parcial.clasificacion !== "CLIENTE") {
            next.politicaIa = "SIEMPRE_MANUAL";
            next.visibilidad = "IGNORAR_TOTAL";
          } else {
            next.politicaIa = "SEGUN_LINEA";
            next.visibilidad = "EQUIPO_VENTAS";
          }
        }
        return next;
      })
    );
  };

  const handleSepararFicha = (fichaId: string) => {
    setFichasDepuradas((prev) => separarFichaDepurada(prev, fichaId, opcionesActuales));
  };

  const handleDescargarCsvGoogle = () => {
    const csv = generarCsvGoogleContacts(fichasDepuradas, {
      incluirEtiquetaCategoria: asignarEtiquetasCategoria,
    });
    descargarArchivoTexto(
      csv,
      `contacts-google-limpio-${negNorm}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const handleDescargarVcfLimpio = () => {
    const vcf = generarVcfLimpioV3(fichasDepuradas, {
      incluirEtiquetaCategoria: asignarEtiquetasCategoria,
    });
    descargarArchivoTexto(
      vcf,
      `contacts-limpio-${negNorm}.vcf`,
      "text/vcard;charset=utf-8;"
    );
  };

  const handleDescargarExcelAuditoria = () => {
    const { hojaLimpios, hojaCambios } = generarHojasAuditoriaDepuracion(
      fichasDepuradas,
      fichasExcluidas
    );
    exportarHojasAExcel(`auditoria-depuracion-agenda-${negNorm}`, [
      {
        nombre: "Agenda Depurada",
        filas: hojaLimpios,
        anchosColumnas: [28, 15, 18, 18, 18, 18, 24, 22, 12, 15, 16, 30, 32],
      },
      {
        nombre: "Fusiones y Cambios",
        filas: hojaCambios,
        anchosColumnas: [22, 26, 32, 24, 24, 34],
      },
    ]);
  };

  const handlePausarSync = () => {
    pausarSyncRef.current = true;
    setModalSync((prev) =>
      prev && prev.estado === "ejecutando"
        ? {
            ...prev,
            estado: "pausando",
            etapaActual: "Pausando de forma segura al terminar el lote actual…",
            logs: anexarLogs(prev.logs, [
              crearEntradaLog(
                "aviso",
                "⏸️ Pausa solicitada — esperando fin del lote actual para guardar punto exacto…"
              ),
            ]),
          }
        : prev
    );
  };

  const ejecutarLoopSyncApp = async (jobInicial: CheckpointSyncApp) => {
    let job: CheckpointSyncApp = {
      ...jobInicial,
      errores: [...jobInicial.errores],
      logs: [...jobInicial.logs],
    };
    const total = job.contactos.length;
    const totalLotes = Math.max(1, Math.ceil(total / TAMANO_LOTE_APP));
    const inicioLote = Math.floor(job.siguienteIndice / TAMANO_LOTE_APP);
    const inicioSesionMs = Date.now();
    const hechosInicioSesion = job.siguienteIndice;

    pausarSyncRef.current = false;
    syncEnCursoRef.current = true;
    setGuardandoTinkay(true);
    setMensaje(null);

    const wakeOk = await activarWakeLock();
    const logInicio = crearEntradaLog(
      "info",
      job.siguienteIndice > 0
        ? `▶ Reanudando guardado en Directorio desde contacto ${job.siguienteIndice + 1}/${total} (lote ${inicioLote + 1}/${totalLotes})…`
        : `▶ Iniciando guardado de ${total} contactos en ${totalLotes} lote(s) (bloqueando chats personales)…`
    );
    job.logs = anexarLogs(job.logs, [logInicio]);
    guardarCheckpointLocal(claveCheckpointApp, job);
    setCheckpointApp(job);

    const actualizarModalApp = (
      estado: EstadoModalSync["estado"],
      loteActual: number,
      etapaActual: string,
      errorMensaje: string | null = null
    ) => {
      setModalSync({
        abierto: true,
        modo: "app",
        estado,
        titulo: "Guardando en Directorio WhatsApp",
        subtitulo: `Oculta chats personales y protege IA en ${negNorm}`,
        hechos: job.siguienteIndice,
        total,
        loteActual,
        totalLotes,
        etapaActual,
        iniciadoMs: inicioSesionMs,
        hechosAlInicioSesion: hechosInicioSesion,
        kpis: [
          { label: "Nuevos", valor: job.creados, color: "#15803D" },
          { label: "Actualizados", valor: job.actualizados, color: "#1D4ED8" },
          { label: "Chats ocultados", valor: job.hilosProtegidos, color: "#7C3AED" },
          { label: "Errores", valor: job.errores.length, color: "#B91C1C" },
        ],
        logs: job.logs,
        errorMensaje,
        wakeLockActivo: wakeOk,
      });
    };

    actualizarModalApp(
      "ejecutando",
      inicioLote + 1,
      `Procesando lote ${inicioLote + 1} de ${totalLotes}…`
    );

    try {
      for (let i = inicioLote; i < totalLotes; i++) {
        if (pausarSyncRef.current) {
          job.actualizadoEn = new Date().toISOString();
          job.logs = anexarLogs(job.logs, [
            crearEntradaLog(
              "aviso",
              `⏸️ Pausado en ${job.siguienteIndice}/${total}. Puedes reanudar exactamente desde el lote ${i + 1}/${totalLotes}.`
            ),
          ]);
          guardarCheckpointLocal(claveCheckpointApp, job);
          setCheckpointApp(job);
          actualizarModalApp(
            "pausado",
            i + 1,
            `Pausado en ${job.siguienteIndice} de ${total} contactos.`
          );
          return;
        }

        const inicioIdx = i * TAMANO_LOTE_APP;
        const chunk = job.contactos.slice(inicioIdx, inicioIdx + TAMANO_LOTE_APP);
        const progresoTxt = `Lote ${i + 1}/${totalLotes} (${Math.min(inicioIdx + chunk.length, total)}/${total})`;
        setProgresoTinkay(progresoTxt);
        job.logs = anexarLogs(job.logs, [
          crearEntradaLog("info", `Enviando lote ${i + 1}/${totalLotes} (${chunk.length} contactos)…`),
        ]);
        actualizarModalApp(
          pausarSyncRef.current ? "pausando" : "ejecutando",
          i + 1,
          `Guardando lote ${i + 1} de ${totalLotes} (${chunk.length} contactos)…`
        );

        let respuestaOk: {
          creados: number;
          actualizados: number;
          hilosProtegidos: number;
        } | null = null;
        let ultimoError = "";

        for (let intento = 0; intento < 3; intento++) {
          try {
            const res = await importarContactosDirectorioLoteAction({
              negocio: negNorm,
              origen: job.origen,
              ocultarChatsPersonalesExistentes: true,
              contactos: chunk,
            });
            if (res.ok) {
              respuestaOk = {
                creados: res.creados,
                actualizados: res.actualizados,
                hilosProtegidos: res.hilosProtegidos,
              };
              break;
            }
            ultimoError = res.error;
          } catch (err) {
            ultimoError =
              err instanceof Error
                ? err.message
                : "Conexión interrumpida (pantalla bloqueada o red móvil).";
          }

          if (intento < 2) {
            const esperaSeg = intento === 0 ? 1.5 : 3;
            job.logs = anexarLogs(job.logs, [
              crearEntradaLog(
                "aviso",
                `⚠️ Reintentando lote ${i + 1}/${totalLotes} en ${esperaSeg}s (${ultimoError.slice(0, 90)})…`
              ),
            ]);
            actualizarModalApp(
              "ejecutando",
              i + 1,
              `Reintentando lote ${i + 1}/${totalLotes} tras corte temporal…`
            );
            await esperarMs(esperaSeg * 1000);
          }
        }

        if (!respuestaOk) {
          job.errores = [...job.errores, `Lote ${i + 1}: ${ultimoError}`];
          job.actualizadoEn = new Date().toISOString();
          job.logs = anexarLogs(job.logs, [
            crearEntradaLog(
              "error",
              `❌ Detenido en lote ${i + 1}/${totalLotes}: ${ultimoError}. Progreso guardado en ${job.siguienteIndice}/${total} para reanudar.`
            ),
          ]);
          guardarCheckpointLocal(claveCheckpointApp, job);
          setCheckpointApp(job);
          actualizarModalApp(
            "error",
            i + 1,
            `Pausado por corte en lote ${i + 1}/${totalLotes}. Pulsa «Reanudar» para continuar sin repetir.`,
            ultimoError
          );
          setMensaje({
            tipo: "error",
            texto: `Guardado detenido en lote ${i + 1}/${totalLotes} (${job.siguienteIndice}/${total} guardados). Pulsa «Reanudar» para continuar desde ahí.`,
          });
          return;
        }

        job.creados += respuestaOk.creados;
        job.actualizados += respuestaOk.actualizados;
        job.hilosProtegidos += respuestaOk.hilosProtegidos;
        job.siguienteIndice = Math.min(inicioIdx + chunk.length, total);
        job.actualizadoEn = new Date().toISOString();
        job.logs = anexarLogs(job.logs, [
          crearEntradaLog(
            "ok",
            `✓ Lote ${i + 1}/${totalLotes}: +${respuestaOk.creados} nuevos, ${respuestaOk.actualizados} actualizados` +
              (respuestaOk.hilosProtegidos > 0
                ? `, ${respuestaOk.hilosProtegidos} chat(s) personales ocultados`
                : "")
          ),
        ]);
        guardarCheckpointLocal(claveCheckpointApp, job);
        setCheckpointApp({ ...job });
        actualizarModalApp(
          pausarSyncRef.current ? "pausando" : "ejecutando",
          i + 1,
          `Completado lote ${i + 1} de ${totalLotes} (${job.siguienteIndice}/${total}).`
        );
      }

      // Completado al 100%
      borrarCheckpointLocal(claveCheckpointApp);
      setCheckpointApp(null);
      job.logs = anexarLogs(job.logs, [
        crearEntradaLog(
          "ok",
          `🎉 Directorio actualizado al 100%: ${job.creados} nuevos, ${job.actualizados} actualizados, ${job.hilosProtegidos} chat(s) personales protegidos/ocultados.`
        ),
      ]);
      actualizarModalApp(
        "completado",
        totalLotes,
        "Guardado completado al 100%. Los chats personales ya están ocultos del chat en vivo."
      );
      setMensaje({
        tipo: "ok",
        texto: `Directorio WhatsApp actualizado: ${job.creados} nuevos, ${job.actualizados} actualizados, ${job.hilosProtegidos} chat(s) personales protegidos/ocultados.`,
      });
      await onDirectorioActualizado?.();
    } finally {
      syncEnCursoRef.current = false;
      setGuardandoTinkay(false);
      setProgresoTinkay(null);
      await liberarWakeLock();
    }
  };

  const handleGuardarEnDirectorioTinkay = async () => {
    const lote = expandirFichasDepuradasParaDirectorio(fichasDepuradas);
    if (lote.length === 0) {
      setMensaje({ tipo: "error", texto: "No hay contactos seleccionados con teléfono válido." });
      return;
    }

    const ahoraIso = new Date().toISOString();
    const nuevoJob: CheckpointSyncApp = {
      version: 1,
      origen: conexionActivaId ? "GOOGLE_CONTACTS" : "VCF",
      contactos: lote,
      siguienteIndice: 0,
      creados: 0,
      actualizados: 0,
      hilosProtegidos: 0,
      errores: [],
      logs: [],
      iniciadoEn: ahoraIso,
      actualizadoEn: ahoraIso,
    };
    await ejecutarLoopSyncApp(nuevoJob);
  };

  const handleReanudarSyncApp = async () => {
    if (!checkpointApp) return;
    await ejecutarLoopSyncApp(checkpointApp);
  };

  const ejecutarLoopSyncGoogle = async (jobInicial: CheckpointSyncGoogle) => {
    // Blindaje extra para checkpoints guardados antes del fix: nunca borrar un resourceName que figure como principal
    const recursosProtegidosJob = new Set<string>(
      jobInicial.operaciones
        .filter((o) => o.tipo === "ACTUALIZAR" || o.tipo === "ASIGNAR_ETIQUETA")
        .map((o) => o.resourceName)
    );
    const operacionesSaneadas = jobInicial.operaciones.filter(
      (o, idx) =>
        idx < jobInicial.siguienteIndice ||
        o.tipo !== "ELIMINAR_DUPLICADO" ||
        !recursosProtegidosJob.has(o.resourceName)
    );

    let job: CheckpointSyncGoogle = {
      ...jobInicial,
      etiquetadosCategoria: jobInicial.etiquetadosCategoria ?? 0,
      operaciones: operacionesSaneadas,
      errores: [...jobInicial.errores],
      logs: [...jobInicial.logs],
    };
    const total = job.operaciones.length;
    const totalLotes = Math.max(1, Math.ceil(total / TAMANO_LOTE_GOOGLE));
    const inicioSesionMs = Date.now();
    const hechosInicioSesion = job.siguienteIndice;

    const compactarYGuardarCheckpoint = (cp: CheckpointSyncGoogle) => {
      // Compactar operaciones ya completadas para mantener localStorage liviano (<100 KB en móvil)
      const opsCompactas = cp.operaciones.map((op, idx) =>
        idx < cp.siguienteIndice
          ? ({ tipo: op.tipo, resourceName: op.resourceName } as OperacionEscrituraGoogleContacts)
          : op
      );
      const cpCompacto: CheckpointSyncGoogle = { ...cp, operaciones: opsCompactas };
      guardarCheckpointLocal(claveCheckpointGoogle, cpCompacto);
      setCheckpointGoogle(cpCompacto);
    };

    pausarSyncRef.current = false;
    syncEnCursoRef.current = true;
    setAplicandoGoogle(true);
    setMensaje(null);

    const wakeOk = await activarWakeLock();
    const loteInicial = Math.min(totalLotes, Math.floor(job.siguienteIndice / TAMANO_LOTE_GOOGLE) + 1);
    job.logs = anexarLogs(job.logs, [
      crearEntradaLog(
        "info",
        job.siguienteIndice > 0
          ? `▶ Reanudando Google Contacts desde ${job.siguienteIndice + 1}/${total} (lote ${loteInicial}/${totalLotes}, modo Batch rápido) sin repetir los ya aplicados…`
          : `▶ Sincronizando ${total} operación(es) en ${totalLotes} lote(s) Batch con ${job.correoGoogle || "Google Contacts"}…`
      ),
    ]);
    compactarYGuardarCheckpoint(job);

    const actualizarModalGoogle = (
      estado: EstadoModalSync["estado"],
      loteActual: number,
      etapaActual: string,
      errorMensaje: string | null = null
    ) => {
      const kpisLista: Array<{ label: string; valor: number; color: string }> = [
        { label: "Actualizados", valor: job.actualizados, color: "#15803D" },
      ];
      if ((job.etiquetadosCategoria ?? 0) > 0) {
        kpisLista.push({
          label: "Solo etiqueta",
          valor: job.etiquetadosCategoria ?? 0,
          color: "#0F766E",
        });
      }
      kpisLista.push(
        {
          label: job.modoDuplicados === "PAPELERA" ? "A Papelera" : "Dup. etiq.",
          valor:
            job.modoDuplicados === "PAPELERA"
              ? job.eliminadosPapelera
              : job.etiquetadosDuplicados,
          color: "#7C3AED",
        },
        { label: "Pendientes", valor: Math.max(0, total - job.siguienteIndice), color: "#1D4ED8" },
        { label: "Avisos", valor: job.errores.length, color: "#B91C1C" }
      );

      setModalSync({
        abierto: true,
        modo: "google",
        estado,
        titulo: "Sincronizando Google Contacts",
        subtitulo: job.correoGoogle || "Cuenta Google conectada",
        hechos: job.siguienteIndice,
        total,
        loteActual,
        totalLotes,
        etapaActual,
        iniciadoMs: inicioSesionMs,
        hechosAlInicioSesion: hechosInicioSesion,
        kpis: kpisLista,
        logs: job.logs,
        errorMensaje,
        wakeLockActivo: wakeOk,
      });
    };

    actualizarModalGoogle(
      "ejecutando",
      loteInicial,
      `Enviando lote Batch ${loteInicial} de ${totalLotes}…`
    );

    try {
      while (job.siguienteIndice < total) {
        const loteActual = Math.min(
          totalLotes,
          Math.floor(job.siguienteIndice / TAMANO_LOTE_GOOGLE) + 1
        );

        if (pausarSyncRef.current) {
          job.actualizadoEn = new Date().toISOString();
          job.logs = anexarLogs(job.logs, [
            crearEntradaLog(
              "aviso",
              `⏸️ Pausado exactamente en ${job.siguienteIndice}/${total}. Cuando vuelvas, pulsa «Reanudar» para seguir sin perder nada.`
            ),
          ]);
          compactarYGuardarCheckpoint(job);
          actualizarModalGoogle(
            "pausado",
            loteActual,
            `Pausado en ${job.siguienteIndice} de ${total}.`
          );
          return;
        }

        const inicioIdx = job.siguienteIndice;
        const finIdx = Math.min(inicioIdx + TAMANO_LOTE_GOOGLE, total);
        const bloque = job.operaciones.slice(inicioIdx, finIdx);
        const esUltimo = finIdx >= total;
        setProgresoGoogle(`Google ${finIdx}/${total} (lote ${loteActual}/${totalLotes})`);

        const primerNombre = bloque[0]?.nombreLimpio || bloque[0]?.resourceName || "";
        job.logs = anexarLogs(job.logs, [
          crearEntradaLog(
            "info",
            `Lote ${loteActual}/${totalLotes}: aplicando ${bloque.length} operación(es) en Batch${primerNombre ? ` (desde «${primerNombre}»)` : ""}…`
          ),
        ]);
        actualizarModalGoogle(
          pausarSyncRef.current ? "pausando" : "ejecutando",
          loteActual,
          `Aplicando lote Batch ${loteActual} de ${totalLotes} (${bloque.length} operaciones)…`
        );

        let resLote: {
          actualizados: number;
          etiquetadosCategoria: number;
          etiquetadosDuplicados: number;
          eliminadosPapelera: number;
          errores: string[];
          detallesLog: string[];
          rateLimited: boolean;
          retryAfterSegundos: number;
          operacionesPendientes429: OperacionEscrituraGoogleContacts[];
        } | null = null;
        let ultimoError = "";

        for (let intento = 0; intento < 3; intento++) {
          try {
            const res = await aplicarLoteDepuracionGoogleAction({
              negocio: negNorm,
              conexionId: job.conexionId,
              mapaGrupos: job.mapaGrupos,
              operaciones: bloque,
              esUltimoLote: esUltimo,
              resumenFinal: {
                actualizados: job.actualizados,
                etiquetadosCategoria: job.etiquetadosCategoria ?? 0,
                etiquetadosDuplicados: job.etiquetadosDuplicados,
                eliminadosPapelera: job.eliminadosPapelera,
              },
            });
            if (res.ok) {
              resLote = {
                actualizados: res.actualizados,
                etiquetadosCategoria: res.etiquetadosCategoria ?? 0,
                etiquetadosDuplicados: res.etiquetadosDuplicados,
                eliminadosPapelera: res.eliminadosPapelera,
                errores: res.errores,
                detallesLog: res.detallesLog ?? [],
                rateLimited: Boolean(res.rateLimited),
                retryAfterSegundos: res.retryAfterSegundos ?? 0,
                operacionesPendientes429: res.operacionesPendientes429 ?? [],
              };
              break;
            }
            ultimoError = res.error;
          } catch (err) {
            ultimoError =
              err instanceof Error
                ? err.message
                : "Conexión interrumpida (teléfono bloqueado o cambio de aplicación).";
          }

          if (intento < 2) {
            const esperaSeg = intento === 0 ? 1.5 : 3;
            job.logs = anexarLogs(job.logs, [
              crearEntradaLog(
                "aviso",
                `⚠️ Corte temporal en lote ${loteActual}/${totalLotes}. Reintentando en ${esperaSeg}s (${ultimoError.slice(0, 90)})…`
              ),
            ]);
            actualizarModalGoogle(
              "ejecutando",
              loteActual,
              `Reintentando lote ${loteActual}/${totalLotes} automáticamente…`
            );
            await esperarMs(esperaSeg * 1000);
          }
        }

        if (!resLote) {
          job.actualizadoEn = new Date().toISOString();
          job.logs = anexarLogs(job.logs, [
            crearEntradaLog(
              "error",
              `❌ Pausado por red/sesión en lote ${loteActual}/${totalLotes}: ${ultimoError}. Punto guardado en ${job.siguienteIndice}/${total}.`
            ),
          ]);
          compactarYGuardarCheckpoint(job);
          actualizarModalGoogle(
            "error",
            loteActual,
            `Se detuvo en lote ${loteActual}/${totalLotes} (${job.siguienteIndice}/${total} ya aplicados). Pulsa «Reanudar» para continuar exactamente aquí.`,
            ultimoError
          );
          setMensaje({
            tipo: "error",
            texto: `Google Contacts pausado en ${job.siguienteIndice}/${total}. Pulsa «Reanudar» arriba para continuar donde quedó.`,
          });
          return;
        }

        job.actualizados += resLote.actualizados;
        job.etiquetadosCategoria = (job.etiquetadosCategoria ?? 0) + resLote.etiquetadosCategoria;
        job.etiquetadosDuplicados += resLote.etiquetadosDuplicados;
        job.eliminadosPapelera += resLote.eliminadosPapelera;
        if (resLote.errores.length > 0) {
          job.errores = [...job.errores, ...resLote.errores].slice(-80);
        }

        // Manejo sin pérdida de cuota Google (HTTP 429): reencola exactamente las pendientes y hace cooldown automático
        if (resLote.rateLimited && resLote.operacionesPendientes429.length > 0) {
          const hechasEnBloque = Math.max(
            0,
            bloque.length - resLote.operacionesPendientes429.length
          );
          const nuevoIndice = Math.min(finIdx, inicioIdx + hechasEnBloque);
          // Reemplazar solo la porción pendiente del bloque con las operaciones exactas que devolvió el 429
          const opsActualizadas = [
            ...job.operaciones.slice(0, nuevoIndice),
            ...resLote.operacionesPendientes429,
            ...job.operaciones.slice(finIdx),
          ];
          job.operaciones = opsActualizadas;
          job.siguienteIndice = nuevoIndice;
          job.actualizadoEn = new Date().toISOString();

          const esperaSeg = Math.max(15, Math.min(65, resLote.retryAfterSegundos || 25));
          job.logs = anexarLogs(job.logs, [
            ...resLote.detallesLog.slice(0, 3).map((l) => crearEntradaLog("info", l)),
            crearEntradaLog(
              "aviso",
              `⏳ Cuota temporal de Google (HTTP 429). Esperando ${esperaSeg}s para reintentar ${resLote.operacionesPendientes429.length} operación(es) sin perder ninguna…`
            ),
          ]);
          compactarYGuardarCheckpoint(job);

          for (let s = esperaSeg; s > 0; s--) {
            if (pausarSyncRef.current) break;
            actualizarModalGoogle(
              "ejecutando",
              loteActual,
              `⏳ Cuota de Google (429): enfriando ${s}s antes de reintentar ${resLote.operacionesPendientes429.length} ficha(s)…`
            );
            await esperarMs(1000);
          }
          continue;
        }

        job.siguienteIndice = finIdx;
        job.actualizadoEn = new Date().toISOString();

        const entradasLote: EntradaLogSync[] = [];
        entradasLote.push(
          crearEntradaLog(
            "ok",
            `✓ Lote ${loteActual}/${totalLotes} (${finIdx}/${total}):` +
              (resLote.actualizados > 0 ? ` ${resLote.actualizados} act.` : "") +
              (resLote.etiquetadosCategoria > 0
                ? ` · ${resLote.etiquetadosCategoria} solo-etiqueta`
                : "") +
              (resLote.etiquetadosDuplicados > 0
                ? ` · ${resLote.etiquetadosDuplicados} dup. etiq.`
                : "") +
              (resLote.eliminadosPapelera > 0
                ? ` · ${resLote.eliminadosPapelera} papelera`
                : "")
          )
        );
        for (const det of resLote.detallesLog.slice(0, 4)) {
          entradasLote.push(crearEntradaLog("info", det));
        }
        for (const errLinea of resLote.errores.slice(0, 2)) {
          entradasLote.push(crearEntradaLog("aviso", `⚠️ ${errLinea}`));
        }

        job.logs = anexarLogs(job.logs, entradasLote);
        compactarYGuardarCheckpoint(job);
        actualizarModalGoogle(
          pausarSyncRef.current ? "pausando" : "ejecutando",
          loteActual,
          `Completado lote ${loteActual} de ${totalLotes} (${finIdx}/${total}).`
        );
      }

      // Completado al 100%
      borrarCheckpointLocal(claveCheckpointGoogle);
      setCheckpointGoogle(null);
      const resumenFinalTxt =
        `Google Contacts actualizado: ${job.actualizados} fichas actualizadas` +
        ((job.etiquetadosCategoria ?? 0) > 0
          ? `, ${job.etiquetadosCategoria} etiquetadas por categoría`
          : "") +
        (job.etiquetadosDuplicados > 0
          ? `, ${job.etiquetadosDuplicados} duplicados etiquetados`
          : "") +
        (job.eliminadosPapelera > 0
          ? `, ${job.eliminadosPapelera} duplicados enviados a Papelera (30 días)`
          : "") +
        (job.errores.length > 0 ? ` · ${job.errores.length} aviso(s)` : "") +
        ".";

      job.logs = anexarLogs(job.logs, [crearEntradaLog("ok", `🎉 ${resumenFinalTxt}`)]);
      actualizarModalGoogle("completado", totalLotes, "¡Sincronización con Google Contacts completada!");
      setMensaje({
        tipo: job.errores.length > 0 && job.actualizados === 0 && (job.etiquetadosCategoria ?? 0) === 0 ? "error" : "ok",
        texto: resumenFinalTxt,
      });
      await cargarEstadoGoogle();
    } finally {
      syncEnCursoRef.current = false;
      setAplicandoGoogle(false);
      setProgresoGoogle(null);
      await liberarWakeLock();
    }
  };

  const handleAplicarEnGoogleContacts = async () => {
    if (!conexionActivaId) {
      setMensaje({
        tipo: "error",
        texto: "Primero lee tu agenda con el botón «Leer Google» para sincronizar cambios hacia Google Contacts.",
      });
      return;
    }

    const operaciones: OperacionEscrituraGoogleContacts[] = [];
    const gruposNecesarios = new Set<string>();
    // Invariante de seguridad: jamás permitir que un resourceName principal sea etiquetado o enviado a Papelera como duplicado
    const recursosPrincipalesProtegidos = new Set<string>();
    for (const f of fichasDepuradas) {
      if (f.googleResourceNamePrincipal) {
        recursosPrincipalesProtegidos.add(f.googleResourceNamePrincipal.trim());
      }
    }
    const duplicadosYaEncolados = new Set<string>();

    for (const f of fichasDepuradas) {
      if (!f.seleccionado || !f.googleResourceNamePrincipal) continue;
      const necesitaUpdateDatos =
        f.fichasOrigen.length > 1 ||
        f.algunTelefonoCorregido ||
        f.nombreFueLimpiado;

      const etiquetaObjetivo =
        asignarEtiquetasCategoria && f.etiquetaCategoriaGoogle
          ? f.etiquetaCategoriaGoogle
          : null;
      const yaTieneEtiqueta =
        !etiquetaObjetivo ||
        f.etiquetasOriginales.some(
          (e) => e.trim().toLowerCase() === etiquetaObjetivo.trim().toLowerCase()
        );

      if (necesitaUpdateDatos) {
        if (etiquetaObjetivo && !yaTieneEtiqueta) {
          gruposNecesarios.add(etiquetaObjetivo);
        }
        operaciones.push({
          tipo: "ACTUALIZAR",
          resourceName: f.googleResourceNamePrincipal,
          etag: f.googleEtagPrincipal,
          nombreLimpio: f.nombreLimpio,
          telefonos: f.telefonos.map((t) => ({
            valorFormateado: t.valorFormateado,
            tipo: t.tipo,
          })),
          correos: f.correos,
          empresa: f.empresa,
          cargo: f.cargo,
          notas: f.notas,
          etiquetaGrupo: etiquetaObjetivo && !yaTieneEtiqueta ? etiquetaObjetivo : null,
        });
      } else if (etiquetaObjetivo && !yaTieneEtiqueta) {
        // Solo asignar etiqueta vía members:modify (sin consumir cuota de updateContact)
        gruposNecesarios.add(etiquetaObjetivo);
        operaciones.push({
          tipo: "ASIGNAR_ETIQUETA",
          resourceName: f.googleResourceNamePrincipal,
          nombreLimpio: f.nombreLimpio,
          etiquetaGrupo: etiquetaObjetivo,
        });
      }

      for (const rawDupRes of f.googleResourceNamesDuplicados) {
        const dupRes = rawDupRes.trim();
        if (
          !dupRes ||
          dupRes === f.googleResourceNamePrincipal.trim() ||
          recursosPrincipalesProtegidos.has(dupRes) ||
          duplicadosYaEncolados.has(dupRes)
        ) {
          continue;
        }
        duplicadosYaEncolados.add(dupRes);
        if (modoDuplicadosGoogle === "PAPELERA") {
          operaciones.push({
            tipo: "ELIMINAR_DUPLICADO",
            resourceName: dupRes,
            nombreLimpio: f.nombreLimpio,
          });
        } else {
          gruposNecesarios.add("Duplicado - Revisar");
          operaciones.push({
            tipo: "ETIQUETAR_DUPLICADO",
            resourceName: dupRes,
            nombreLimpio: f.nombreLimpio,
          });
        }
      }
    }

    if (operaciones.length === 0) {
      setMensaje({ tipo: "ok", texto: "Tu agenda de Google ya está limpia y etiquetada; no hay cambios pendientes." });
      return;
    }

    const totalUpdates = operaciones.filter((o) => o.tipo === "ACTUALIZAR").length;
    const totalSoloEtiqueta = operaciones.filter((o) => o.tipo === "ASIGNAR_ETIQUETA").length;
    const totalDups = operaciones.filter(
      (o) => o.tipo === "ELIMINAR_DUPLICADO" || o.tipo === "ETIQUETAR_DUPLICADO"
    ).length;

    const okConfirm =
      typeof window === "undefined" ||
      window.confirm(
        `Se aplicarán ${operaciones.length} operación(es) en modo Batch rápido sobre Google Contacts:\n` +
          `• ${totalUpdates} fichas con datos modificados (teléfonos, nombres o fusiones)\n` +
          (totalSoloEtiqueta > 0
            ? `• ${totalSoloEtiqueta} fichas solo etiqueta (sin tocar nombre/teléfono)\n`
            : "") +
          `• ${totalDups} duplicados ${
            modoDuplicadosGoogle === "PAPELERA"
              ? "movidos a la Papelera de Google (recuperables 30 días)"
              : "etiquetados como «Duplicado - Revisar» (sin borrar nada)"
          }\n\n` +
          `Primero se descargará automáticamente un respaldo .vcf de seguridad. Si se pausa o cambias de app, podrás reanudar exactamente donde quedó. ¿Continuar?`
      );
    if (!okConfirm) return;

    // 1. Respaldo .vcf automático obligatorio antes de modificar Google Contacts
    const backupFichas = depurarAgenda2D(fichasCrudas, {
      ...OPCIONES_DEPURADOR_DEFECTO,
      fusionarPorNombreSimilar: false,
      limpiarSimbolosInicio: false,
      excluirSinTelefono: false,
      patronesExcluir: [],
    }).fichas;
    const vcfBackup = generarVcfLimpioV3(backupFichas, { incluirEtiquetaCategoria: false });
    descargarArchivoTexto(
      vcfBackup,
      `respaldo-google-antes-depurar-${new Date().toISOString().slice(0, 10)}.vcf`,
      "text/vcard;charset=utf-8;"
    );

    const correoActivo =
      conexionesGoogle.find((c) => c.id === conexionActivaId)?.correoGoogle || "Google Contacts";

    setAplicandoGoogle(true);
    setProgresoGoogle("Preparando etiquetas en Google…");
    setMensaje(null);
    setModalSync({
      abierto: true,
      modo: "google",
      estado: "ejecutando",
      titulo: "Sincronizando Google Contacts",
      subtitulo: correoActivo,
      hechos: 0,
      total: operaciones.length,
      loteActual: 0,
      totalLotes: Math.max(1, Math.ceil(operaciones.length / TAMANO_LOTE_GOOGLE)),
      etapaActual: "Verificando y creando etiquetas en Google Contacts…",
      iniciadoMs: Date.now(),
      hechosAlInicioSesion: 0,
      kpis: [
        { label: "Actualizados", valor: 0, color: "#15803D" },
        {
          label: modoDuplicadosGoogle === "PAPELERA" ? "A Papelera" : "Etiquetados",
          valor: 0,
          color: "#7C3AED",
        },
        { label: "Pendientes", valor: operaciones.length, color: "#1D4ED8" },
        { label: "Avisos", valor: 0, color: "#B91C1C" },
      ],
      logs: [
        crearEntradaLog("ok", "✓ Respaldo .vcf de seguridad descargado."),
        crearEntradaLog(
          "info",
          `Preparando ${gruposNecesarios.size} etiqueta(s) en ${correoActivo}…`
        ),
      ],
      errorMensaje: null,
      wakeLockActivo: false,
    });

    const prep = await prepararGruposGoogleContactsAction({
      negocio: negNorm,
      conexionId: conexionActivaId,
      nombresGrupos: Array.from(gruposNecesarios),
    });

    if (!prep.ok) {
      setAplicandoGoogle(false);
      setProgresoGoogle(null);
      setModalSync((prev) =>
        prev
          ? {
              ...prev,
              estado: "error",
              etapaActual: "No se pudieron preparar las etiquetas en Google.",
              errorMensaje: prep.error,
              logs: anexarLogs(prev.logs, [crearEntradaLog("error", prep.error)]),
            }
          : null
      );
      setMensaje({ tipo: "error", texto: prep.error });
      return;
    }

    const ahoraIso = new Date().toISOString();
    const nuevoJob: CheckpointSyncGoogle = {
      version: 1,
      conexionId: conexionActivaId,
      correoGoogle: correoActivo,
      modoDuplicados: modoDuplicadosGoogle,
      mapaGrupos: prep.mapaGrupos,
      operaciones,
      siguienteIndice: 0,
      actualizados: 0,
      etiquetadosDuplicados: 0,
      eliminadosPapelera: 0,
      errores: [],
      logs: [
        crearEntradaLog("ok", "✓ Respaldo .vcf de seguridad descargado."),
        crearEntradaLog(
          "ok",
          `✓ Etiquetas listas en Google (${Object.keys(prep.mapaGrupos).length} grupos).`
        ),
      ],
      iniciadoEn: ahoraIso,
      actualizadoEn: ahoraIso,
    };

    await ejecutarLoopSyncGoogle(nuevoJob);
  };

  const handleReanudarSyncGoogle = async () => {
    if (!checkpointGoogle) return;
    await ejecutarLoopSyncGoogle(checkpointGoogle);
  };

  const handleDescartarCheckpointGoogle = () => {
    borrarCheckpointLocal(claveCheckpointGoogle);
    setCheckpointGoogle(null);
  };

  const handleDescartarCheckpointApp = () => {
    borrarCheckpointLocal(claveCheckpointApp);
    setCheckpointApp(null);
  };

  const contadores = useMemo(() => {
    let fusionados = 0;
    let telCorregidos = 0;
    let nombresLimpiados = 0;
    let clientes = 0;
    let personales = 0;
    let proveedores = 0;
    let equipo = 0;
    let seleccionados = 0;
    let conGoogle = 0;
    for (const f of fichasDepuradas) {
      if (f.fichasOrigen.length > 1) fusionados++;
      if (f.algunTelefonoCorregido) telCorregidos++;
      if (f.nombreFueLimpiado) nombresLimpiados++;
      if (f.clasificacion === "CLIENTE") clientes++;
      else if (f.clasificacion === "PROVEEDOR") proveedores++;
      else if (f.clasificacion === "EQUIPO_INTERNO") equipo++;
      else personales++;
      if (f.seleccionado) seleccionados++;
      if (f.googleResourceNamePrincipal) conGoogle++;
    }
    return {
      total: fichasDepuradas.length,
      fusionados,
      telCorregidos,
      nombresLimpiados,
      clientes,
      personales,
      proveedores,
      equipo,
      seleccionados,
      conGoogle,
    };
  }, [fichasDepuradas]);

  const fichasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return fichasDepuradas.filter((f) => {
      if (filtro === "fusionados" && f.fichasOrigen.length <= 1) return false;
      if (filtro === "tel_corregidos" && !f.algunTelefonoCorregido) return false;
      if (filtro === "nombres_limpiados" && !f.nombreFueLimpiado) return false;
      if (filtro === "clientes" && f.clasificacion !== "CLIENTE") return false;
      if (filtro === "personales" && f.clasificacion !== "PERSONAL") return false;
      if (filtro === "proveedores" && f.clasificacion !== "PROVEEDOR") return false;
      if (filtro === "equipo" && f.clasificacion !== "EQUIPO_INTERNO") return false;
      if (q) {
        const hay = [
          f.nombreLimpio,
          f.empresa,
          f.notas,
          ...f.nombresCandidatos,
          ...f.telefonos.map((t) => `${t.valorFormateado} ${t.valorE164}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fichasDepuradas, filtro, busqueda]);

  const totalPaginas = useMemo(
    () => (porPagina <= 0 ? 1 : Math.max(1, Math.ceil(fichasFiltradas.length / porPagina))),
    [fichasFiltradas.length, porPagina]
  );
  const paginaSegura = Math.min(pagina, totalPaginas);
  const fichasPaginadas = useMemo(() => {
    if (porPagina <= 0) return fichasFiltradas;
    const ini = (paginaSegura - 1) * porPagina;
    return fichasFiltradas.slice(ini, ini + porPagina);
  }, [fichasFiltradas, paginaSegura, porPagina]);

  const porcentajeModal =
    modalSync && modalSync.total > 0
      ? Math.min(100, Math.round((modalSync.hechos / modalSync.total) * 100))
      : 0;

  const segundosTranscurridos = modalSync
    ? Math.max(0, Math.floor((ahoraMs - modalSync.iniciadoMs) / 1000))
    : 0;

  const etaSegundos = (() => {
    if (!modalSync || modalSync.total <= 0) return null;
    const hechosEstaSesion = modalSync.hechos - modalSync.hechosAlInicioSesion;
    const pendientes = modalSync.total - modalSync.hechos;
    if (hechosEstaSesion <= 0 || pendientes <= 0 || segundosTranscurridos < 2) return null;
    const ritmoPorSeg = hechosEstaSesion / segundosTranscurridos;
    return ritmoPorSeg > 0 ? Math.ceil(pendientes / ritmoPorSeg) : null;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <style>{`@keyframes ecoSyncSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* BANNER REANUDABLE: GOOGLE CONTACTS PENDIENTE */}
      {checkpointGoogle && !modalSync?.abierto && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid #F59E0B",
            background: "var(--cf-fffbeb, #FFFBEB)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1 1 230px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#92400E" }}>
              ⏸️ Sincronización Google pausada en {checkpointGoogle.siguienteIndice} /{" "}
              {checkpointGoogle.operaciones.length} (
              {Math.round(
                (checkpointGoogle.siguienteIndice /
                  Math.max(1, checkpointGoogle.operaciones.length)) *
                  100
              )}
              %)
            </div>
            <div style={{ fontSize: "0.74rem", color: "#78350F", lineHeight: 1.4 }}>
              Cuenta: <strong>{checkpointGoogle.correoGoogle}</strong> · Faltan{" "}
              <strong>
                {checkpointGoogle.operaciones.length - checkpointGoogle.siguienteIndice}
              </strong>{" "}
              ficha(s). Se continuará exactamente desde el lote{" "}
              {Math.floor(checkpointGoogle.siguienteIndice / TAMANO_LOTE_GOOGLE) + 1}/
              {Math.ceil(checkpointGoogle.operaciones.length / TAMANO_LOTE_GOOGLE)} sin repetir lo
              ya aplicado.
            </div>
          </div>
          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void handleReanudarSyncGoogle()}
              title="Reanudar sincronización con Google Contacts exactamente donde quedó"
              aria-label="Reanudar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "8px 13px",
                borderRadius: "8px",
                border: "1px solid #15803D",
                background: "#15803D",
                color: "#FFFFFF",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Play size={14} />
              <span>Reanudar</span>
            </button>
            <button
              type="button"
              onClick={handleDescartarCheckpointGoogle}
              title="Descartar esta sincronización pendiente"
              aria-label="Descartar"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #FCD34D",
                background: "#FFFFFF",
                color: "#92400E",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* BANNER REANUDABLE: GUARDADO EN DIRECTORIO APP PENDIENTE */}
      {checkpointApp && !modalSync?.abierto && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid #3B82F6",
            background: "var(--cf-eef4ff, #EFF6FF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1 1 230px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#1E40AF" }}>
              ⏸️ Guardado en App pausado en {checkpointApp.siguienteIndice} /{" "}
              {checkpointApp.contactos.length} (
              {Math.round(
                (checkpointApp.siguienteIndice / Math.max(1, checkpointApp.contactos.length)) * 100
              )}
              %)
            </div>
            <div style={{ fontSize: "0.74rem", color: "#1E3A8A" }}>
              Faltan{" "}
              <strong>{checkpointApp.contactos.length - checkpointApp.siguienteIndice}</strong>{" "}
              contacto(s) por guardar en tu Directorio WhatsApp.
            </div>
          </div>
          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void handleReanudarSyncApp()}
              title="Reanudar guardado en Directorio WhatsApp exactamente donde quedó"
              aria-label="Reanudar App"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "8px 13px",
                borderRadius: "8px",
                border: "1px solid #1D4ED8",
                background: "#1D4ED8",
                color: "#FFFFFF",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Play size={14} />
              <span>Reanudar</span>
            </button>
            <button
              type="button"
              onClick={handleDescartarCheckpointApp}
              title="Descartar este guardado pendiente"
              aria-label="Descartar App"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #93C5FD",
                background: "#FFFFFF",
                color: "#1E40AF",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            border:
              mensaje.tipo === "ok"
                ? "1px solid var(--cb-bbf7d0, #BBF7D0)"
                : "1px solid var(--cb-fecaca, #FECACA)",
            background:
              mensaje.tipo === "ok"
                ? "var(--cf-f0fdf4, #F0FDF4)"
                : "var(--cf-fef2f2, #FEF2F2)",
            color:
              mensaje.tipo === "ok"
                ? "var(--ct-166534, #166534)"
                : "var(--ct-991b1b, #991B1B)",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* BLOQUE 1: GOOGLE CONTACTS OAUTH + ARCHIVOS */}
      <div
        style={{
          background: "var(--cf-ffffff, #FFFFFF)",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          borderRadius: "14px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              🧹 Depurador 2D de Agenda & Sincronización Google Contacts
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "0.79rem", color: "var(--ct-6e6861, #6E6861)", lineHeight: 1.45 }}>
              Elimina duplicados por teléfono y por persona, corrige números pre-2012, limpia nombres, organiza etiquetas y devuelve tu libreta lista para tu celular o la aplica directo en Google Contacts.
            </p>
          </div>
          {fichasCrudas.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFichasCrudas([]);
                setFuentesResumen([]);
                setConexionActivaId(null);
                setMensaje(null);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid var(--cb-fecaca, #FECACA)",
                background: "var(--cf-fef2f2, #FEF2F2)",
                color: "var(--ct-b91c1c, #B91C1C)",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Limpiar Sesión
            </button>
          )}
        </div>

        {/* Dos fuentes: Google Contacts en vivo + Archivo local .vcf/.csv/.xlsx */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
          }}
        >
          {/* Tarjeta Google Contacts */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid var(--cb-bfdbfe, #BFDBFE)",
              background: "var(--cf-eef4ff, #F4F8FF)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", fontWeight: 700, fontSize: "0.86rem", color: "var(--ct-1e40af, #1E40AF)" }}>
                <Link2 size={16} />
                <span>Google Contacts (Directo)</span>
              </div>
              <span
                style={{
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "999px",
                  background: credencialesConfiguradas ? "#DCFCE7" : "#FEF3C7",
                  color: credencialesConfiguradas ? "#166534" : "#92400E",
                }}
              >
                {cargandoEstadoGoogle
                  ? "Verificando…"
                  : credencialesConfiguradas
                    ? `OAuth listo (${origenCredenciales === "env" ? "Env" : "Vault"})`
                    : "Falta OAuth"}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ct-57524c, #475569)", lineHeight: 1.45 }}>
              Conecta cualquier cuenta Gmail (ej. tu correo personal, esposa u operador) <strong>sin cerrar tu sesión actual</strong>. Lee miles de contactos y aplica la limpieza directo en Google.
            </p>

            {/* Lista de cuentas conectadas */}
            {conexionesGoogle.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {conexionesGoogle.map((con) => (
                  <div
                    key={con.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      flexWrap: "wrap",
                      padding: "8px 10px",
                      borderRadius: "9px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border:
                        conexionActivaId === con.id
                          ? "1px solid #16A34A"
                          : "1px solid var(--cb-e6e2da, #E6E2DA)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.79rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)", wordBreak: "break-all" }}>
                        {con.correoGoogle}
                      </div>
                      <div style={{ fontSize: "0.69rem", color: "var(--ct-6e6861, #6E6861)" }}>
                        {con.totalContactosLeidos > 0
                          ? `Última lectura: ${con.totalContactosLeidos} contactos`
                          : "Conectada y lista"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        disabled={leyendoGoogleId === con.id}
                        onClick={() => void handleLeerDesdeGoogle(con)}
                        title="Leer todos los contactos desde esta cuenta Google"
                        aria-label="Leer Google"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 10px",
                          borderRadius: "7px",
                          border: "1px solid #1D4ED8",
                          background: "#1D4ED8",
                          color: "#FFFFFF",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: leyendoGoogleId === con.id ? "wait" : "pointer",
                        }}
                      >
                        <CloudDownload size={14} />
                        <span>{leyendoGoogleId === con.id ? "Leyendo…" : "Leer Google"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDesconectarGoogle(con)}
                        title="Desconectar esta cuenta Google"
                        aria-label="Desconectar"
                        style={{
                          padding: "6px 8px",
                          borderRadius: "7px",
                          border: "1px solid var(--cb-fecaca, #FECACA)",
                          background: "var(--cf-fef2f2, #FEF2F2)",
                          color: "var(--ct-b91c1c, #B91C1C)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {credencialesConfiguradas ? (
                <a
                  href="/api/omnicanal/google-contacts/conectar"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 13px",
                    borderRadius: "8px",
                    border: "1px solid #1E40AF",
                    background: "#1E40AF",
                    color: "#FFFFFF",
                    fontSize: "0.79rem",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  <Link2 size={14} />
                  <span>
                    {conexionesGoogle.length > 0 ? "Agregar otra cuenta" : "Conectar Google"}
                  </span>
                </a>
              ) : (
                <span style={{ fontSize: "0.75rem", color: "#92400E", fontWeight: 600 }}>
                  Abre «Configurar Google Cloud» abajo para activar el botón de conexión en 2 minutos.
                </span>
              )}
              <button
                type="button"
                onClick={() => void cargarEstadoGoogle()}
                title="Actualizar estado de cuentas Google"
                aria-label="Refrescar"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-3a3530, #3A3530)",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={13} />
                <span>Refrescar</span>
              </button>
            </div>
          </div>

          {/* Tarjeta Subir Archivo .vcf / .csv / .xlsx */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              border: "1px dashed #94A3B8",
              background: "var(--cf-f8fafc, #F8FAFC)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", fontWeight: 700, fontSize: "0.86rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                <FileSpreadsheet size={16} color="#16A34A" />
                <span>Subir .vcf / CSV Google / Excel</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--ct-6e6861, #64748B)", lineHeight: 1.45 }}>
                Funciona de inmediato sin configurar Google Cloud. Sube 1 o varios archivos (<code>contacts.vcf</code> de tu celular o CSV de Google Contacts) para fusionar, estandarizar y descargar la agenda impecable.
              </p>
            </div>

            <input
              ref={inputArchivoRef}
              type="file"
              multiple
              accept=".vcf,.vcard,.csv,.xlsx,.xls"
              onChange={(e) => void handleSubirArchivos(e.target.files)}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => inputArchivoRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "9px 13px",
                borderRadius: "8px",
                border: "1px solid #16A34A",
                background: "#16A34A",
                color: "#FFFFFF",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Upload size={15} />
              <span>Elegir Archivos</span>
            </button>
          </div>
        </div>

        {/* Configuración Google Cloud OAuth en Vault (plegable, solo Admin) */}
        {esAdmin && (
          <details
            open={!credencialesConfiguradas}
            style={{
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "10px",
              padding: "10px 12px",
              background: "var(--cf-f8f7f4, #FAF9F6)",
            }}
          >
            <summary style={{ cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, color: "var(--ct-3a3530, #3A3530)" }}>
              🔑 Configurar Google Cloud OAuth (People API · cifrado en Supabase Vault)
            </summary>
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--ct-57524c, #57524C)", lineHeight: 1.5 }}>
                <strong>Pasos únicos en Google Cloud Console:</strong>
                <ol style={{ margin: "4px 0 0 18px", padding: 0 }}>
                  <li>En tu proyecto Google Cloud, habilita <strong>Google People API</strong>.</li>
                  <li>En <em>APIs y servicios → Credenciales → ID de cliente OAuth (Aplicación web)</em>, agrega esta <strong>URI de redirección autorizada</strong>:</li>
                </ol>
              </div>

              {callbackUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <code
                    style={{
                      flex: "1 1 240px",
                      padding: "7px 10px",
                      borderRadius: "7px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.74rem",
                      wordBreak: "break-all",
                    }}
                  >
                    {callbackUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(callbackUrl);
                      setCopioCallback(true);
                      window.setTimeout(() => setCopioCallback(false), 2000);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "7px 10px",
                      borderRadius: "7px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-1f1c19, #1F1C19)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copioCallback ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                    <span>{copioCallback ? "Copiado" : "Copiar URL"}</span>
                  </button>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "10px",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--ct-3a3530, #3A3530)" }}>
                  Google OAuth Client ID
                  <input
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="1234567890-xxxx.apps.googleusercontent.com"
                    style={{
                      padding: "7px 9px",
                      borderRadius: "7px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.78rem",
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--ct-3a3530, #3A3530)" }}>
                  Google OAuth Client Secret (se cifra en Vault)
                  <input
                    type="password"
                    value={clientSecretInput}
                    onChange={(e) => setClientSecretInput(e.target.value)}
                    placeholder={credencialesConfiguradas ? "•••••••• (dejar vacío para conservar)" : "GOCSPX-..."}
                    style={{
                      padding: "7px 9px",
                      borderRadius: "7px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.78rem",
                    }}
                  />
                </label>
              </div>

              <div>
                <button
                  type="button"
                  disabled={guardandoAppOauth}
                  onClick={() => void handleGuardarAppOauth()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 13px",
                    borderRadius: "8px",
                    border: "1px solid #1F1C19",
                    background: "#1F1C19",
                    color: "#FFFFFF",
                    fontSize: "0.77rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <KeyRound size={14} />
                  <span>{guardandoAppOauth ? "Guardando…" : "Guardar en Vault"}</span>
                </button>
              </div>
            </div>
          </details>
        )}

        {/* Opciones de Estandarización y Fusión 2D */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "11px",
            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
            background: "var(--cf-f8f7f4, #FCFBF9)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
            ⚙️ Reglas de Depuración y Estandarización
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "10px",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--ct-3a3530, #3A3530)" }}>
              Formato estándar de teléfono
              <select
                value={formatoTelefono}
                onChange={(e) => setFormatoTelefono(e.target.value as FormatoTelefonoAgenda)}
                style={{
                  padding: "7px 9px",
                  borderRadius: "7px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  fontSize: "0.79rem",
                }}
              >
                <option value="E164_LEGIBLE">+593 99 123 4567 (Legible)</option>
                <option value="E164_COMPACTO">+593991234567 (E.164 Compacto)</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--ct-3a3530, #3A3530)" }}>
              Excluir / descartar patrones (coma)
              <input
                value={patronesExcluirTxt}
                onChange={(e) => setPatronesExcluirTxt(e.target.value)}
                placeholder="cs"
                style={{
                  padding: "7px 9px",
                  borderRadius: "7px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  fontSize: "0.79rem",
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))",
              gap: "7px",
              fontSize: "0.76rem",
              color: "var(--ct-3a3530, #3A3530)",
            }}
          >
            {[
              {
                checked: fusionarPorNombreSimilar,
                set: setFusionarPorNombreSimilar,
                label: "Fusionar misma persona (unir 2+ teléfonos en 1 ficha)",
              },
              {
                checked: limpiarSimbolosInicio,
                set: setLimpiarSimbolosInicio,
                label: "Quitar espacios invisibles y símbolos basura (⠀, :::, #)",
              },
              {
                checked: normalizarMayusculas,
                set: setNormalizarMayusculas,
                label: "Normalizar Mayúsculas/Minúsculas (respeta BPAC/VIP)",
              },
              {
                checked: quitarEmojis,
                set: setQuitarEmojis,
                label: "Quitar emojis de los nombres",
              },
              {
                checked: guardarAliasEnNotas,
                set: setGuardarAliasEnNotas,
                label: "Conservar alias fusionados en Notas",
              },
              {
                checked: asignarEtiquetasCategoria,
                set: setAsignarEtiquetasCategoria,
                label: "Asignar etiquetas Google (Clientes, Personal, Proveedores)",
              },
              {
                checked: excluirSinTelefono,
                set: setExcluirSinTelefono,
                label: "Descartar fichas sin teléfono válido",
              },
            ].map((sw) => (
              <label
                key={sw.label}
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={sw.checked}
                  onChange={(e) => sw.set(e.target.checked)}
                />
                <span>{sw.label}</span>
              </label>
            ))}
          </div>

          {fuentesResumen.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}>
                Fuentes cargadas:
              </span>
              {fuentesResumen.map((f, idx) => (
                <span
                  key={`${f.nombre}-${idx}`}
                  style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "var(--cf-dbeafe, #DBEAFE)",
                    color: "var(--ct-1e40af, #1E40AF)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  {f.nombre} ({f.total})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BLOQUE 2: RESULTADOS DEPURADOS, EXPORTACIÓN Y SYNC GOOGLE */}
      {resumen && fichasDepuradas.length > 0 && (
        <div
          ref={resultadosRef}
          style={{
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
            borderRadius: "14px",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            scrollMarginTop: "16px",
          }}
        >
          {/* KPIs Antes vs Después */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
              gap: "8px",
            }}
          >
            {[
              {
                label: "Originales → Limpios",
                val: `${resumen.totalFichasOriginales} → ${contadores.total}`,
                color: "var(--ct-1f1c19, #1F1C19)",
                bg: "var(--cf-f8f7f4, #F8F7F4)",
              },
              {
                label: "🔀 Duplicados unidos",
                val: `${resumen.duplicadosEliminados}`,
                color: "#7C3AED",
                bg: "var(--cf-faf5ff, #FAF5FF)",
              },
              {
                label: "📞 Tel. estandarizados",
                val: `${resumen.telefonosEstandarizados}${resumen.telefonosPre2012Corregidos > 0 ? ` (${resumen.telefonosPre2012Corregidos} pre-2012)` : ""}`,
                color: "#1D4ED8",
                bg: "var(--cf-eef4ff, #EEF4FF)",
              },
              {
                label: "✨ Nombres limpiados",
                val: `${resumen.nombresLimpiados}`,
                color: "#0F766E",
                bg: "#F0FDFA",
              },
              {
                label: "🗑️ Excluidos",
                val: `${resumen.excluidosPorRegla + resumen.excluidosSinTelefono}`,
                color: "#991B1B",
                bg: "var(--cf-fef2f2, #FEF2F2)",
              },
            ].map((k) => (
              <div
                key={k.label}
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  background: k.bg,
                  border: "1px solid var(--cb-eae6de, #EAE6DE)",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--ct-6e6861, #6E6861)" }}>
                  {k.label}
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: k.color, marginTop: "2px" }}>
                  {k.val}
                </div>
              </div>
            ))}
          </div>

          {/* Barra de Exportación y Guardado */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleDescargarCsvGoogle}
              title="Descargar CSV nativo listo para importar en contacts.google.com con etiquetas"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #1D4ED8",
                background: "#1D4ED8",
                color: "#FFFFFF",
                fontSize: "0.79rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Download size={14} />
              <span>CSV Google ({contadores.seleccionados})</span>
            </button>

            <button
              type="button"
              onClick={handleDescargarVcfLimpio}
              title="Descargar vCard 3.0 UTF-8 compatible con Android, iPhone e iCloud"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #0F766E",
                background: "#0F766E",
                color: "#FFFFFF",
                fontSize: "0.79rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Download size={14} />
              <span>vCard (.vcf)</span>
            </button>

            <button
              type="button"
              onClick={handleDescargarExcelAuditoria}
              title="Descargar Excel con agenda limpia y hoja de auditoría de cambios"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: "var(--cf-ffffff, #FFFFFF)",
                color: "var(--ct-2e2a26, #2E2A26)",
                fontSize: "0.79rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <FileSpreadsheet size={14} />
              <span>Excel Auditoría</span>
            </button>

            <button
              type="button"
              disabled={guardandoTinkay}
              onClick={() => void handleGuardarEnDirectorioTinkay()}
              title="Guardar estos contactos depurados en tu Directorio WhatsApp"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 13px",
                borderRadius: "8px",
                border: "1px solid #2F4737",
                background: "#2F4737",
                color: "#FFFFFF",
                fontSize: "0.79rem",
                fontWeight: 700,
                cursor: guardandoTinkay ? "wait" : "pointer",
              }}
            >
              <Save size={14} />
              <span>{guardandoTinkay ? progresoTinkay || "Guardando…" : "Guardar en App"}</span>
            </button>
          </div>

          {/* Escritura directa a Google Contacts (solo si se leyeron fichas de Google) */}
          {conexionActivaId && contadores.conGoogle > 0 && (
            <div
              style={{
                padding: "11px 13px",
                borderRadius: "10px",
                border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
                background: "var(--cf-f0fdf4, #F0FDF4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 260px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.81rem", fontWeight: 700, color: "#166534" }}>
                  <Shield size={15} />
                  <span>Aplicar limpieza directo en Google Contacts ({contadores.conGoogle} fichas)</span>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "0.74rem", color: "#166534" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="modoDupGoogle"
                      checked={modoDuplicadosGoogle === "ETIQUETAR"}
                      onChange={() => setModoDuplicadosGoogle("ETIQUETAR")}
                    />
                    <span>Seguro: solo etiquetar duplicados (sin borrar)</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="modoDupGoogle"
                      checked={modoDuplicadosGoogle === "PAPELERA"}
                      onChange={() => setModoDuplicadosGoogle("PAPELERA")}
                    />
                    <span>Mover duplicados a Papelera (30 días)</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                disabled={aplicandoGoogle}
                onClick={() => void handleAplicarEnGoogleContacts()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1px solid #166534",
                  background: "#166534",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: aplicandoGoogle ? "wait" : "pointer",
                }}
              >
                <CloudUpload size={15} />
                <span>{aplicandoGoogle ? progresoGoogle || "Aplicando…" : "Aplicar en Google"}</span>
              </button>
            </div>
          )}

          {/* Filtros y búsqueda */}
          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, teléfono, alias, empresa…"
              style={{
                flex: "1 1 200px",
                padding: "7px 10px",
                borderRadius: "8px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                fontSize: "0.8rem",
              }}
            />
            {(
              [
                { id: "todos", label: `Todos (${contadores.total})` },
                { id: "fusionados", label: `🔀 Fusionados (${contadores.fusionados})` },
                { id: "tel_corregidos", label: `📞 Tel. corregidos (${contadores.telCorregidos})` },
                { id: "nombres_limpiados", label: `✨ Limpiados (${contadores.nombresLimpiados})` },
                { id: "clientes", label: `💼 Clientes (${contadores.clientes})` },
                { id: "personales", label: `🔒 Personales (${contadores.personales})` },
                { id: "proveedores", label: `🚚 Proveedores (${contadores.proveedores})` },
                { id: "equipo", label: `👥 Equipo (${contadores.equipo})` },
              ] as Array<{ id: FiltroDepurador; label: string }>
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                style={{
                  padding: "5px 9px",
                  borderRadius: "999px",
                  border: filtro === f.id ? "1px solid #1F1C19" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: filtro === f.id ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                  color: filtro === f.id ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
                  fontSize: "0.73rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Paginación superior */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--ct-57524c, #57524C)" }}>
            <span>
              Mostrando{" "}
              <strong>
                {fichasFiltradas.length === 0
                  ? 0
                  : porPagina <= 0
                    ? `1–${fichasFiltradas.length}`
                    : `${(paginaSegura - 1) * porPagina + 1}–${Math.min(
                        paginaSegura * porPagina,
                        fichasFiltradas.length
                      )}`}
              </strong>{" "}
              de <strong>{fichasFiltradas.length}</strong> fichas limpias
            </span>

            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={porPagina}
                onChange={(e) => setPorPagina(Number(e.target.value))}
                style={{
                  padding: "4px 7px",
                  borderRadius: "7px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  fontSize: "0.74rem",
                }}
              >
                <option value={50}>50 / pág</option>
                <option value={100}>100 / pág</option>
                <option value={250}>250 / pág</option>
                <option value={0}>Ver todos ({fichasFiltradas.length})</option>
              </select>
              {totalPaginas > 1 && (
                <>
                  <button
                    type="button"
                    disabled={paginaSegura <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "7px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      fontSize: "0.74rem",
                      cursor: paginaSegura <= 1 ? "not-allowed" : "pointer",
                      opacity: paginaSegura <= 1 ? 0.5 : 1,
                    }}
                  >
                    ← Anterior
                  </button>
                  <strong>
                    {paginaSegura} / {totalPaginas}
                  </strong>
                  <button
                    type="button"
                    disabled={paginaSegura >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "7px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      fontSize: "0.74rem",
                      cursor: paginaSegura >= totalPaginas ? "not-allowed" : "pointer",
                      opacity: paginaSegura >= totalPaginas ? 0.5 : 1,
                    }}
                  >
                    Siguiente →
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Lista de fichas depuradas (100% responsive móvil) */}
          <div
            style={{
              maxHeight: "560px",
              overflowY: "auto",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {fichasPaginadas.map((f) => {
              const est = ESTILO_CAT[f.clasificacion];
              return (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--cb-f1efea, #F1EFEA)",
                    background: f.seleccionado
                      ? "var(--cf-ffffff, #FFFFFF)"
                      : "var(--cf-f8f7f4, #F8F7F4)",
                    opacity: f.seleccionado ? 1 : 0.55,
                    fontSize: "0.78rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "9px", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={f.seleccionado}
                      onChange={(e) => actualizarFicha(f.id, { seleccionado: e.target.checked })}
                      style={{ marginTop: "4px", flexShrink: 0 }}
                    />

                    <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {f.tieneConflictoNombre ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", flex: "1 1 180px" }}>
                            <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0 }} />
                            <select
                              value={f.nombreLimpio}
                              onChange={(e) => actualizarFicha(f.id, { nombreLimpio: e.target.value })}
                              style={{
                                flex: 1,
                                padding: "3px 6px",
                                borderRadius: "6px",
                                border: "1px solid #F59E0B",
                                background: "#FFFBEB",
                                color: "#1F1C19",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              {f.nombresCandidatos.map((nom) => (
                                <option key={nom} value={nom}>
                                  {nom}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <strong style={{ color: "var(--ct-1f1c19, #1F1C19)", wordBreak: "break-word" }}>
                            {f.nombreLimpio}
                          </strong>
                        )}

                        <span
                          style={{
                            padding: "1px 7px",
                            borderRadius: "999px",
                            border: `1px solid ${est.borde}`,
                            background: est.fondo,
                            color: est.texto,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                          }}
                        >
                          {f.etiquetaCategoriaGoogle}
                        </span>

                        {f.fichasOrigen.length > 1 && (
                          <span
                            style={{
                              padding: "1px 7px",
                              borderRadius: "999px",
                              background: "#F3E8FF",
                              color: "#6B21A8",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                            }}
                          >
                            🔀 {f.fichasOrigen.length} fichas unidas
                          </span>
                        )}
                      </div>

                      {/* Teléfonos estandarizados (puede tener 1..4) */}
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {f.telefonos.map((t) => (
                          <span
                            key={t.valorE164}
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.74rem",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              background: t.fuePre2012Ecuador
                                ? "#DBEAFE"
                                : "var(--cf-f8f7f4, #F3F4F6)",
                              color: t.fuePre2012Ecuador
                                ? "#1E40AF"
                                : "var(--ct-2e2a26, #2E2A26)",
                              fontWeight: 600,
                            }}
                            title={
                              t.fueCorregido ? `Antes: ${t.valorOriginal}` : "Teléfono ya estándar"
                            }
                          >
                            {t.valorFormateado}
                            {t.fuePre2012Ecuador ? " (EC pre-2012)" : ""}
                          </span>
                        ))}
                        {f.correos.map((em) => (
                          <span
                            key={em}
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--ct-57524c, #57524C)",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              border: "1px solid var(--cb-eae6de, #EAE6DE)",
                            }}
                          >
                            ✉️ {em}
                          </span>
                        ))}
                      </div>

                      {(f.cambiosResumen.length > 0 || f.notas) && (
                        <div style={{ fontSize: "0.7rem", color: "var(--ct-6e6861, #7B746B)" }}>
                          {f.cambiosResumen.join(" · ")}
                          {f.notas ? ` — ${f.notas}` : ""}
                        </div>
                      )}
                    </div>

                    {/* Acciones por ficha: cambiar categoría + separar fusión */}
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        aria-label={`Categoría de ${f.nombreLimpio}`}
                        value={f.clasificacion}
                        onChange={(e) =>
                          actualizarFicha(f.id, {
                            clasificacion: e.target.value as ClasificacionContacto,
                          })
                        }
                        style={{
                          padding: "4px 7px",
                          borderRadius: "7px",
                          border: `1px solid ${est.borde}`,
                          background: est.fondo,
                          color: est.texto,
                          fontSize: "0.73rem",
                          fontWeight: 700,
                        }}
                      >
                        <option value="PERSONAL">🔒 Personal</option>
                        <option value="CLIENTE">💼 Cliente</option>
                        <option value="PROVEEDOR">🚚 Proveedor</option>
                        <option value="EQUIPO_INTERNO">👥 Equipo</option>
                      </select>

                      {f.fichasOrigen.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleSepararFicha(f.id)}
                          title="Deshacer esta fusión y mantener las fichas por separado"
                          aria-label="Separar"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "7px",
                            border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                            background: "var(--cf-ffffff, #FFFFFF)",
                            color: "var(--ct-3a3530, #3A3530)",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Split size={12} />
                          <span>Separar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL BLOQUEANTE DE SINCRONIZACIÓN CON SPINNER, PROGRESO, LOG EN VIVO Y REANUDACIÓN */}
      {modalSync?.abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modalSync.titulo}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.72)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "16px",
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E2E8F0)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "13px",
            }}
          >
            {/* Cabecera con Spinner / Estado */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: 0 }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      modalSync.estado === "completado"
                        ? "#DCFCE7"
                        : modalSync.estado === "error"
                          ? "#FEE2E2"
                          : modalSync.estado === "pausado"
                            ? "#FEF3C7"
                            : "#DBEAFE",
                    color:
                      modalSync.estado === "completado"
                        ? "#15803D"
                        : modalSync.estado === "error"
                          ? "#B91C1C"
                          : modalSync.estado === "pausado"
                            ? "#B45309"
                            : "#1D4ED8",
                  }}
                >
                  {modalSync.estado === "ejecutando" || modalSync.estado === "pausando" ? (
                    <Loader2
                      size={22}
                      style={{ animation: "ecoSyncSpin 0.95s linear infinite" }}
                    />
                  ) : modalSync.estado === "completado" ? (
                    <CheckCircle2 size={22} />
                  ) : modalSync.estado === "pausado" ? (
                    <Pause size={21} />
                  ) : (
                    <AlertTriangle size={22} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.96rem", fontWeight: 800, color: "var(--ct-1f1c19, #0F172A)" }}>
                    {modalSync.titulo}
                  </div>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: "var(--ct-6e6861, #64748B)",
                      wordBreak: "break-word",
                    }}
                  >
                    {modalSync.subtitulo}
                  </div>
                </div>
              </div>

              {(modalSync.estado === "completado" ||
                modalSync.estado === "pausado" ||
                modalSync.estado === "error") && (
                <button
                  type="button"
                  onClick={() => setModalSync(null)}
                  title="Cerrar ventana"
                  aria-label="Cerrar"
                  style={{
                    padding: "6px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #CBD5E1)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-3a3530, #475569)",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Barra de Progreso + Lote + Tiempo / ETA */}
            {modalSync.total > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "var(--ct-1f1c19, #0F172A)" }}>
                    {modalSync.hechos} / {modalSync.total} ({porcentajeModal}%)
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ct-57524c, #475569)" }}>
                    Lote {Math.max(1, modalSync.loteActual)} / {modalSync.totalLotes} ·{" "}
                    {formatearDuracionSeg(segundosTranscurridos)}
                    {etaSegundos !== null &&
                      (modalSync.estado === "ejecutando" || modalSync.estado === "pausando") &&
                      ` · ~${formatearDuracionSeg(etaSegundos)} rest.`}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "11px",
                    borderRadius: "999px",
                    background: "var(--cf-e5e7eb, #E2E8F0)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${porcentajeModal}%`,
                      height: "100%",
                      borderRadius: "999px",
                      transition: "width 0.3s ease",
                      background:
                        modalSync.estado === "error"
                          ? "#DC2626"
                          : modalSync.estado === "pausado"
                            ? "#D97706"
                            : "#15803D",
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--ct-57524c, #475569)", fontWeight: 500 }}>
                  {modalSync.etapaActual}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "var(--cf-f8fafc, #F8FAFC)",
                  border: "1px solid var(--cb-e6e2da, #E2E8F0)",
                  fontSize: "0.79rem",
                  color: "var(--ct-3a3530, #334155)",
                  fontWeight: 600,
                }}
              >
                {modalSync.etapaActual} · {formatearDuracionSeg(segundosTranscurridos)}
              </div>
            )}

            {/* Aviso Wake Lock / Protección móvil */}
            {(modalSync.estado === "ejecutando" || modalSync.estado === "pausando") && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 10px",
                  borderRadius: "9px",
                  background: modalSync.wakeLockActivo ? "#F0FDF4" : "#EFF6FF",
                  border: modalSync.wakeLockActivo ? "1px solid #BBF7D0" : "1px solid #BFDBFE",
                  color: modalSync.wakeLockActivo ? "#166534" : "#1E40AF",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                }}
              >
                <Smartphone size={14} style={{ flexShrink: 0 }} />
                <span>
                  {modalSync.wakeLockActivo
                    ? "Pantalla protegida contra bloqueo (Wake Lock activo). Si cambias de app, el punto exacto queda guardado para reanudar."
                    : "El progreso se guarda automáticamente tras cada lote; si bloqueas el teléfono o cambias de app podrás reanudar exactamente aquí."}
                </span>
              </div>
            )}

            {/* KPIs en vivo */}
            {modalSync.kpis.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
                  gap: "7px",
                }}
              >
                {modalSync.kpis.map((k) => (
                  <div
                    key={k.label}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "9px",
                      background: "var(--cf-f8f7f4, #F8FAFC)",
                      border: "1px solid var(--cb-eae6de, #E2E8F0)",
                    }}
                  >
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ct-6e6861, #64748B)" }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: "0.96rem", fontWeight: 800, color: k.color }}>
                      {k.valor}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error destacado si ocurrió corte */}
            {modalSync.errorMensaje && (
              <div
                style={{
                  padding: "9px 11px",
                  borderRadius: "9px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#991B1B",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  wordBreak: "break-word",
                }}
              >
                {modalSync.errorMensaje}
              </div>
            )}

            {/* Consola / Log en tiempo real */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  color: "var(--ct-57524c, #475569)",
                }}
              >
                <Terminal size={13} />
                <span>Registro en vivo ({modalSync.logs.length})</span>
              </div>
              <div
                ref={logBoxRef}
                style={{
                  maxHeight: "200px",
                  minHeight: "96px",
                  overflowY: "auto",
                  borderRadius: "10px",
                  padding: "9px 11px",
                  background: "#0F172A",
                  color: "#E2E8F0",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "0.71rem",
                  lineHeight: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {modalSync.logs.map((entry, idx) => (
                  <div
                    key={`${entry.hora}-${idx}`}
                    style={{
                      color:
                        entry.nivel === "ok"
                          ? "#86EFAC"
                          : entry.nivel === "aviso"
                            ? "#FDE68A"
                            : entry.nivel === "error"
                              ? "#FCA5A5"
                              : "#CBD5E1",
                      wordBreak: "break-word",
                    }}
                  >
                    <span style={{ color: "#64748B", marginRight: "6px" }}>[{entry.hora}]</span>
                    {entry.texto}
                  </div>
                ))}
              </div>
            </div>

            {/* Botones de control del Modal */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
              {(modalSync.estado === "ejecutando" || modalSync.estado === "pausando") &&
                modalSync.modo !== "lectura_google" && (
                  <button
                    type="button"
                    disabled={modalSync.estado === "pausando"}
                    onClick={handlePausarSync}
                    title="Pausar al finalizar el lote en curso y guardar el punto exacto para reanudar luego"
                    aria-label="Pausar"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid #D97706",
                      background: modalSync.estado === "pausando" ? "#FEF3C7" : "#D97706",
                      color: modalSync.estado === "pausando" ? "#92400E" : "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: modalSync.estado === "pausando" ? "wait" : "pointer",
                    }}
                  >
                    <Pause size={14} />
                    <span>{modalSync.estado === "pausando" ? "Pausando…" : "Pausar"}</span>
                  </button>
                )}

              {(modalSync.estado === "pausado" || modalSync.estado === "error") &&
                modalSync.modo === "google" &&
                checkpointGoogle && (
                  <button
                    type="button"
                    onClick={() => void handleReanudarSyncGoogle()}
                    title="Reanudar sincronización Google Contacts exactamente desde el último lote pendiente"
                    aria-label="Reanudar"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 15px",
                      borderRadius: "8px",
                      border: "1px solid #15803D",
                      background: "#15803D",
                      color: "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Play size={14} />
                    <span>Reanudar</span>
                  </button>
                )}

              {(modalSync.estado === "pausado" || modalSync.estado === "error") &&
                modalSync.modo === "app" &&
                checkpointApp && (
                  <button
                    type="button"
                    onClick={() => void handleReanudarSyncApp()}
                    title="Reanudar guardado en Directorio WhatsApp desde el lote pendiente"
                    aria-label="Reanudar"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 15px",
                      borderRadius: "8px",
                      border: "1px solid #1D4ED8",
                      background: "#1D4ED8",
                      color: "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Play size={14} />
                    <span>Reanudar</span>
                  </button>
                )}

              {(modalSync.estado === "pausado" ||
                modalSync.estado === "error" ||
                modalSync.estado === "completado") && (
                <button
                  type="button"
                  onClick={() => setModalSync(null)}
                  title={
                    modalSync.estado === "completado"
                      ? "Finalizar y volver a la agenda"
                      : "Cerrar esta ventana (el punto guardado permanecerá arriba para reanudar luego)"
                  }
                  aria-label={modalSync.estado === "completado" ? "Listo" : "Cerrar"}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border:
                      modalSync.estado === "completado"
                        ? "1px solid #15803D"
                        : "1px solid var(--cb-d5cfc4, #CBD5E1)",
                    background:
                      modalSync.estado === "completado"
                        ? "#15803D"
                        : "var(--cf-ffffff, #FFFFFF)",
                    color:
                      modalSync.estado === "completado"
                        ? "#FFFFFF"
                        : "var(--ct-2e2a26, #334155)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {modalSync.estado === "completado" ? "Listo" : "Cerrar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
