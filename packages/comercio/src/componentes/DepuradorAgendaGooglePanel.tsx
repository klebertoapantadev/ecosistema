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
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Split,
  Trash2,
  Upload,
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

  // Escritura en Google / Tinkay
  const [modoDuplicadosGoogle, setModoDuplicadosGoogle] = useState<"ETIQUETAR" | "PAPELERA">(
    "ETIQUETAR"
  );
  const [aplicandoGoogle, setAplicandoGoogle] = useState<boolean>(false);
  const [progresoGoogle, setProgresoGoogle] = useState<string | null>(null);
  const [guardandoTinkay, setGuardandoTinkay] = useState<boolean>(false);
  const [progresoTinkay, setProgresoTinkay] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const resultadosRef = useRef<HTMLDivElement>(null);

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
    const res = await leerContactosDesdeGoogleAction({
      negocio: negNorm,
      conexionId: con.id,
      esAgendaPersonal: true,
    });
    setLeyendoGoogleId(null);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    setConexionActivaId(con.id);
    setFichasCrudas((prev) => [...prev, ...res.fichas]);
    setFuentesResumen((prev) => [
      ...prev,
      { nombre: `Google: ${res.correoGoogle}`, total: res.fichas.length },
    ]);
    setMensaje({
      tipo: "ok",
      texto: `Se leyeron ${res.fichas.length} contactos en vivo desde ${res.correoGoogle}. Revisa la depuración abajo.`,
    });
    await cargarEstadoGoogle();
    desplazarAResultados();
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

  const handleGuardarEnDirectorioTinkay = async () => {
    const lote = expandirFichasDepuradasParaDirectorio(fichasDepuradas);
    if (lote.length === 0) {
      setMensaje({ tipo: "error", texto: "No hay contactos seleccionados con teléfono válido." });
      return;
    }

    setGuardandoTinkay(true);
    setProgresoTinkay(null);
    setMensaje(null);

    const TAMANO = 150;
    const totalLotes = Math.ceil(lote.length / TAMANO);
    let creados = 0;
    let actualizados = 0;
    let hilosProtegidos = 0;

    for (let i = 0; i < totalLotes; i++) {
      const chunk = lote.slice(i * TAMANO, (i + 1) * TAMANO);
      setProgresoTinkay(`Lote ${i + 1}/${totalLotes} (${Math.min((i + 1) * TAMANO, lote.length)}/${lote.length})`);
      const res = await importarContactosDirectorioLoteAction({
        negocio: negNorm,
        origen: conexionActivaId ? "GOOGLE_CONTACTS" : "VCF",
        ocultarChatsPersonalesExistentes: true,
        contactos: chunk,
      });
      if (!res.ok) {
        setGuardandoTinkay(false);
        setProgresoTinkay(null);
        setMensaje({ tipo: "error", texto: `Error en lote ${i + 1}: ${res.error}` });
        return;
      }
      creados += res.creados;
      actualizados += res.actualizados;
      hilosProtegidos += res.hilosProtegidos;
    }

    setGuardandoTinkay(false);
    setProgresoTinkay(null);
    setMensaje({
      tipo: "ok",
      texto: `Directorio WhatsApp actualizado: ${creados} nuevos, ${actualizados} actualizados, ${hilosProtegidos} chat(s) personales protegidos.`,
    });
    await onDirectorioActualizado?.();
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

    for (const f of fichasDepuradas) {
      if (!f.seleccionado || !f.googleResourceNamePrincipal) continue;
      const necesitaUpdate =
        f.fichasOrigen.length > 1 ||
        f.algunTelefonoCorregido ||
        f.nombreFueLimpiado ||
        asignarEtiquetasCategoria;

      if (necesitaUpdate) {
        if (asignarEtiquetasCategoria && f.etiquetaCategoriaGoogle) {
          gruposNecesarios.add(f.etiquetaCategoriaGoogle);
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
          etiquetaGrupo: asignarEtiquetasCategoria ? f.etiquetaCategoriaGoogle : null,
        });
      }

      for (const dupRes of f.googleResourceNamesDuplicados) {
        if (modoDuplicadosGoogle === "PAPELERA") {
          operaciones.push({ tipo: "ELIMINAR_DUPLICADO", resourceName: dupRes });
        } else {
          gruposNecesarios.add("Duplicado - Revisar");
          operaciones.push({ tipo: "ETIQUETAR_DUPLICADO", resourceName: dupRes });
        }
      }
    }

    if (operaciones.length === 0) {
      setMensaje({ tipo: "ok", texto: "Tu agenda de Google ya está limpia; no hay cambios pendientes." });
      return;
    }

    const totalUpdates = operaciones.filter((o) => o.tipo === "ACTUALIZAR").length;
    const totalDups = operaciones.filter((o) => o.tipo !== "ACTUALIZAR").length;

    const okConfirm =
      typeof window === "undefined" ||
      window.confirm(
        `Se aplicarán ${operaciones.length} cambio(s) directo en Google Contacts:\n` +
          `• ${totalUpdates} fichas actualizadas (teléfonos estandarizados, nombres y etiquetas)\n` +
          `• ${totalDups} duplicados ${
            modoDuplicadosGoogle === "PAPELERA"
              ? "movidos a la Papelera de Google (recuperables 30 días)"
              : "etiquetados como «Duplicado - Revisar» (sin borrar nada)"
          }\n\n` +
          `Primero se descargará automáticamente un respaldo .vcf de seguridad. ¿Continuar?`
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

    setAplicandoGoogle(true);
    setProgresoGoogle("Preparando etiquetas en Google…");
    setMensaje(null);

    const prep = await prepararGruposGoogleContactsAction({
      negocio: negNorm,
      conexionId: conexionActivaId,
      nombresGrupos: Array.from(gruposNecesarios),
    });

    if (!prep.ok) {
      setAplicandoGoogle(false);
      setProgresoGoogle(null);
      setMensaje({ tipo: "error", texto: prep.error });
      return;
    }

    const TAMANO_LOTE = 20;
    const totalLotes = Math.ceil(operaciones.length / TAMANO_LOTE);
    let actTotal = 0;
    let etqTotal = 0;
    let delTotal = 0;
    const errores: string[] = [];

    for (let i = 0; i < totalLotes; i++) {
      const bloque = operaciones.slice(i * TAMANO_LOTE, (i + 1) * TAMANO_LOTE);
      const hechos = Math.min((i + 1) * TAMANO_LOTE, operaciones.length);
      setProgresoGoogle(`Google ${hechos}/${operaciones.length} (lote ${i + 1}/${totalLotes})`);

      const res = await aplicarLoteDepuracionGoogleAction({
        negocio: negNorm,
        conexionId: conexionActivaId,
        mapaGrupos: prep.mapaGrupos,
        operaciones: bloque,
        esUltimoLote: i === totalLotes - 1,
        resumenFinal: {
          actualizados: actTotal,
          etiquetadosDuplicados: etqTotal,
          eliminadosPapelera: delTotal,
        },
      });

      if (!res.ok) {
        setAplicandoGoogle(false);
        setProgresoGoogle(null);
        setMensaje({
          tipo: "error",
          texto: `Proceso detenido en lote ${i + 1}/${totalLotes} (${actTotal} actualizados): ${res.error}`,
        });
        return;
      }

      actTotal += res.actualizados;
      etqTotal += res.etiquetadosDuplicados;
      delTotal += res.eliminadosPapelera;
      if (res.errores.length > 0) errores.push(...res.errores);
    }

    setAplicandoGoogle(false);
    setProgresoGoogle(null);
    setMensaje({
      tipo: errores.length > 0 && actTotal === 0 ? "error" : "ok",
      texto:
        `Google Contacts actualizado: ${actTotal} fichas actualizadas` +
        (etqTotal > 0 ? `, ${etqTotal} duplicados etiquetados` : "") +
        (delTotal > 0 ? `, ${delTotal} duplicados enviados a Papelera (30 días)` : "") +
        (errores.length > 0 ? ` · ${errores.length} aviso(s)` : "") +
        ".",
    });
    await cargarEstadoGoogle();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
    </div>
  );
}
