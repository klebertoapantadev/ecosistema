"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DataGrid,
  exportarHojasAExcel,
  leerHojasDesdeExcelBuffer,
  type ColumnaDataGrid,
} from "@eco/datagrid";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardPaste,
  Contact,
  Database,
  Download,
  EyeOff,
  FileSpreadsheet,
  Lock,
  MessageSquare,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import {
  actualizarContactoDirectorioAction,
  importarContactosDirectorioLoteAction,
  listarDirectorioContactosAction,
} from "../acciones-omnicanal";
import {
  consolidarContactosJoinMerge,
  mapearPoliticaPersonalAVisibilidad,
  parsearContactosPickerNativo,
  parsearFilasTablaContactos,
  parsearListaRapidaContactos,
  parsearVcfContactos,
  REGLAS_CLASIFICACION_DEFECTO,
  type ClasificacionContacto,
  type ContactoConsolidadoPreview,
  type ContactoCrudoImportado,
  type ContactoDirectorioRegistro,
  type LineaWhatsappConfig,
  type OrigenImportacionContacto,
  type PoliticaIaContacto,
  type PoliticaPersonalesLinea,
  type ReglasClasificacionContactos,
  type SemillaCrmContacto,
  type VisibilidadContacto,
} from "../contactos-omnicanal";
import { GestorLineasWhatsappPanel } from "./GestorLineasWhatsappPanel";

export interface ConsolaDirectorioContactosProps {
  negocio: string;
}

type PestanaDirectorio = "importar" | "directorio" | "lineas";
type FiltroPreview = "todos" | "conflictos" | "personales" | "clientes" | "otros" | "nuevos";

const ESTILO_CLASIFICACION: Record<
  ClasificacionContacto,
  { etiqueta: string; fondo: string; texto: string; borde: string }
> = {
  PERSONAL: {
    etiqueta: "🔒 Personal",
    fondo: "#F3E8FF",
    texto: "#6B21A8",
    borde: "#DDD6FE",
  },
  CLIENTE: {
    etiqueta: "💼 Cliente",
    fondo: "#DCFCE7",
    texto: "#166534",
    borde: "#BBF7D0",
  },
  PROVEEDOR: {
    etiqueta: "🚚 Proveedor",
    fondo: "#FEF3C7",
    texto: "#92400E",
    borde: "#FDE68A",
  },
  EQUIPO_INTERNO: {
    etiqueta: "👥 Equipo",
    fondo: "#DBEAFE",
    texto: "#1E40AF",
    borde: "#BFDBFE",
  },
  BLOQUEADO_SPAM: {
    etiqueta: "🚫 Bloqueado",
    fondo: "#FEE2E2",
    texto: "#991B1B",
    borde: "#FECACA",
  },
};

const ETIQUETA_VISIBILIDAD: Record<VisibilidadContacto, string> = {
  IGNORAR_TOTAL: "Ignorar Total (solo celular)",
  SOLO_ADMIN: "Oculto a Ventas (solo Admin)",
  SOLO_TITULAR: "Privado (solo titular)",
  EQUIPO_VENTAS: "Visible a Ventas",
};

const ETIQUETA_POLITICA_IA: Record<PoliticaIaContacto, string> = {
  SIEMPRE_MANUAL: "✋ Siempre Manual",
  AUTO_IA: "⚡ IA Automática",
  SEGUN_LINEA: "📱 Según teléfono",
};

interface ContactPickerNavigator extends Navigator {
  contacts?: {
    select: (
      properties: Array<"name" | "tel" | "email">,
      options?: { multiple?: boolean }
    ) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
  };
}

export function ConsolaDirectorioContactos({ negocio }: ConsolaDirectorioContactosProps) {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const cacheKey = `eco_directorio_contactos_${negNorm}`;

  const [pestana, setPestana] = useState<PestanaDirectorio>("importar");
  const [cargando, setCargando] = useState<boolean>(true);
  const [esAdmin, setEsAdmin] = useState<boolean>(false);
  const [contactosGuardados, setContactosGuardados] = useState<ContactoDirectorioRegistro[]>([]);
  const [crmSemilla, setCrmSemilla] = useState<SemillaCrmContacto[]>([]);
  const [lineasWhatsapp, setLineasWhatsapp] = useState<LineaWhatsappConfig[]>([]);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Estado del asistente de extracción + Join/Merge
  const [lineaSeleccionadaId, setLineaSeleccionadaId] = useState<string>("");
  const [esAgendaPersonalImport, setEsAgendaPersonalImport] = useState<boolean>(true);
  const [brutosAcumulados, setBrutosAcumulados] = useState<ContactoCrudoImportado[]>([]);
  const [fuentesCargadasResumen, setFuentesCargadasResumen] = useState<
    Array<{ etiqueta: string; cantidad: number; origen: OrigenImportacionContacto }>
  >([]);
  const [textoPegado, setTextoPegado] = useState<string>("");
  const [patronesClienteTxt, setPatronesClienteTxt] = useState<string>(
    REGLAS_CLASIFICACION_DEFECTO.patronesCliente.join(", ")
  );
  const [patronesProveedorTxt, setPatronesProveedorTxt] = useState<string>(
    REGLAS_CLASIFICACION_DEFECTO.patronesProveedor.join(", ")
  );
  const [politicaPersonalDefecto, setPoliticaPersonalDefecto] =
    useState<PoliticaPersonalesLinea>("IGNORAR_TOTAL");
  const [ocultarExistentes, setOcultarExistentes] = useState<boolean>(true);
  const [previewItems, setPreviewItems] = useState<ContactoConsolidadoPreview[]>([]);
  const [resumenMerge, setResumenMerge] = useState<ReturnType<
    typeof consolidarContactosJoinMerge
  >["resumen"] | null>(null);
  const [filtroPreview, setFiltroPreview] = useState<FiltroPreview>("todos");
  const [busquedaPreview, setBusquedaPreview] = useState<string>("");
  const [guardandoLote, setGuardandoLote] = useState<boolean>(false);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [filtroClasifDirectorio, setFiltroClasifDirectorio] = useState<string>("TODOS");
  const [soportaContactPicker, setSoportaContactPicker] = useState<boolean>(false);

  const inputArchivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const nav = navigator as ContactPickerNavigator;
      setSoportaContactPicker(Boolean(nav.contacts && typeof nav.contacts.select === "function"));
    }
  }, []);

  const cargarDirectorio = useCallback(async () => {
    setCargando(true);
    const res = await listarDirectorioContactosAction(negNorm);
    setCargando(false);
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setEsAdmin(res.esAdmin);
    setContactosGuardados(res.contactos);
    setCrmSemilla(res.crmSemilla);
    setLineasWhatsapp(res.lineasWhatsapp);
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(res.contactos));
    } catch {
      // Ignorar cuota localStorage
    }
  }, [cacheKey, negNorm]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setContactosGuardados(parsed as ContactoDirectorioRegistro[]);
      }
    } catch {
      // Ignorar
    }
    void cargarDirectorio();
  }, [cacheKey, cargarDirectorio]);

  const reglasActuales = useMemo<ReglasClasificacionContactos>(
    () => ({
      patronesCliente: patronesClienteTxt
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      patronesProveedor: patronesProveedorTxt
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      patronesEquipo: REGLAS_CLASIFICACION_DEFECTO.patronesEquipo,
      politicaPersonalDefecto,
      politicaIaClientesDefecto: "SEGUN_LINEA",
      visibilidadClientesDefecto: "EQUIPO_VENTAS",
    }),
    [patronesClienteTxt, patronesProveedorTxt, politicaPersonalDefecto]
  );

  const recalcularConsolidacion = useCallback(
    (brutos: ContactoCrudoImportado[], reglasOverride?: ReglasClasificacionContactos) => {
      if (brutos.length === 0) {
        setPreviewItems([]);
        setResumenMerge(null);
        return;
      }
      const { items, resumen } = consolidarContactosJoinMerge({
        brutos,
        existentesDirectorio: contactosGuardados,
        semillaCrm: crmSemilla,
        reglas: reglasOverride ?? reglasActuales,
      });
      setPreviewItems(items);
      setResumenMerge(resumen);
    },
    [contactosGuardados, crmSemilla, reglasActuales]
  );

  const lineaSeleccionadaObj = useMemo(
    () => lineasWhatsapp.find((l) => l.id === lineaSeleccionadaId) ?? null,
    [lineasWhatsapp, lineaSeleccionadaId]
  );

  const agregarFuenteABrutos = (
    nuevos: ContactoCrudoImportado[],
    etiqueta: string,
    origen: OrigenImportacionContacto
  ) => {
    if (nuevos.length === 0) {
      setMensaje({
        tipo: "error",
        texto: `No se encontraron números de teléfono válidos en «${etiqueta}».`,
      });
      return;
    }
    const combinados = [...brutosAcumulados, ...nuevos];
    setBrutosAcumulados(combinados);
    setFuentesCargadasResumen((prev) => [...prev, { etiqueta, cantidad: nuevos.length, origen }]);
    recalcularConsolidacion(combinados);
    setMensaje({
      tipo: "ok",
      texto: `Se extrajeron ${nuevos.length} número(s) desde «${etiqueta}» y se consolidaron con Join/Merge.`,
    });
  };

  const handleArchivosSeleccionados = async (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) return;
    setMensaje(null);

    const etiquetaLinea = lineaSeleccionadaObj?.nombre || "Agenda importada";
    const acumuladosNuevos: ContactoCrudoImportado[] = [];
    const resumenNuevasFuentes: Array<{
      etiqueta: string;
      cantidad: number;
      origen: OrigenImportacionContacto;
    }> = [];

    for (const archivo of Array.from(archivos)) {
      const ext = (archivo.name.split(".").pop() || "").toLowerCase();
      try {
        if (ext === "vcf" || ext === "vcard") {
          const texto = await archivo.text();
          const parsed = parsearVcfContactos(texto, {
            lineaWhatsappId: lineaSeleccionadaId || null,
            lineaNombre: etiquetaLinea,
            etiquetaFuente: archivo.name,
            esAgendaPersonal: esAgendaPersonalImport,
          });
          acumuladosNuevos.push(...parsed);
          resumenNuevasFuentes.push({ etiqueta: archivo.name, cantidad: parsed.length, origen: "VCF" });
        } else if (ext === "csv" || ext === "xlsx" || ext === "xls") {
          const buffer = await archivo.arrayBuffer();
          const hojas = leerHojasDesdeExcelBuffer(buffer);
          const todasFilas = Object.values(hojas).flat();
          const origenArchivo: "CSV" | "XLSX" = ext === "csv" ? "CSV" : "XLSX";
          const parsed = parsearFilasTablaContactos(todasFilas, {
            origen: origenArchivo,
            lineaWhatsappId: lineaSeleccionadaId || null,
            lineaNombre: etiquetaLinea,
            etiquetaFuente: archivo.name,
            esAgendaPersonal: esAgendaPersonalImport,
          });
          acumuladosNuevos.push(...parsed);
          resumenNuevasFuentes.push({
            etiqueta: archivo.name,
            cantidad: parsed.length,
            origen: origenArchivo,
          });
        } else if (ext === "txt") {
          const texto = await archivo.text();
          const parsed = parsearListaRapidaContactos(texto, {
            origen: "LISTA_IGNORAR",
            lineaWhatsappId: lineaSeleccionadaId || null,
            lineaNombre: etiquetaLinea,
            etiquetaFuente: archivo.name,
            esAgendaPersonal: esAgendaPersonalImport,
          });
          acumuladosNuevos.push(...parsed);
          resumenNuevasFuentes.push({
            etiqueta: archivo.name,
            cantidad: parsed.length,
            origen: "LISTA_IGNORAR",
          });
        } else {
          setMensaje({
            tipo: "error",
            texto: `Formato no soportado en «${archivo.name}». Usa .vcf, .csv, .xlsx o .txt.`,
          });
        }
      } catch (err) {
        setMensaje({
          tipo: "error",
          texto: `Error leyendo «${archivo.name}»: ${err instanceof Error ? err.message : "archivo inválido"}`,
        });
      }
    }

    if (acumuladosNuevos.length > 0) {
      const combinados = [...brutosAcumulados, ...acumuladosNuevos];
      setBrutosAcumulados(combinados);
      setFuentesCargadasResumen((prev) => [...prev, ...resumenNuevasFuentes]);
      recalcularConsolidacion(combinados);
      setMensaje({
        tipo: "ok",
        texto: `Extracción lista: ${acumuladosNuevos.length} número(s) extraídos de ${resumenNuevasFuentes.length} archivo(s). Revisa el resultado Join/Merge abajo antes de guardar.`,
      });
    } else if (resumenNuevasFuentes.length > 0) {
      setMensaje({
        tipo: "error",
        texto: "Los archivos cargados no contenían números de teléfono reconocibles.",
      });
    }

    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  };

  const handleContactPickerCelular = async () => {
    setMensaje(null);
    const nav = navigator as ContactPickerNavigator;
    if (!nav.contacts?.select) {
      setMensaje({
        tipo: "error",
        texto:
          "Tu navegador no expone la libreta nativa. En iPhone o PC exporta tus contactos a archivo .vcf o Google Contacts .csv y súbelo arriba.",
      });
      return;
    }
    try {
      const elegidos = await nav.contacts.select(["name", "tel", "email"], { multiple: true });
      const parsed = parsearContactosPickerNativo(elegidos, {
        lineaWhatsappId: lineaSeleccionadaId || null,
        lineaNombre: lineaSeleccionadaObj?.nombre || "Celular actual",
        esAgendaPersonal: esAgendaPersonalImport,
      });
      agregarFuenteABrutos(parsed, "Libreta nativa del celular", "CONTACT_PICKER");
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto:
          err instanceof Error
            ? `Selección cancelada o bloqueada: ${err.message}`
            : "No se pudo leer la libreta del celular.",
      });
    }
  };

  const handleCargarTextoPegado = (forzarPersonal: boolean) => {
    setMensaje(null);
    if (!textoPegado.trim()) {
      setMensaje({ tipo: "error", texto: "Pega al menos un número o lista de contactos." });
      return;
    }
    const parsed = parsearListaRapidaContactos(textoPegado, {
      origen: forzarPersonal ? "LISTA_IGNORAR" : "CSV",
      lineaWhatsappId: lineaSeleccionadaId || null,
      lineaNombre: lineaSeleccionadaObj?.nombre || "Lista pegada",
      etiquetaFuente: forzarPersonal ? "Lista Personal a Ignorar" : "Lista rápida",
      esAgendaPersonal: forzarPersonal ? true : esAgendaPersonalImport,
      forzarClasificacion: forzarPersonal ? "PERSONAL" : null,
    });
    agregarFuenteABrutos(
      parsed,
      forzarPersonal ? "Lista Personal a Ignorar" : "Texto pegado",
      forzarPersonal ? "LISTA_IGNORAR" : "CSV"
    );
    if (parsed.length > 0) setTextoPegado("");
  };

  const handleCruzarConCrm = () => {
    setMensaje(null);
    if (crmSemilla.length === 0) {
      setMensaje({ tipo: "error", texto: "No se encontraron clientes o chats previos en el CRM." });
      return;
    }
    const brutosCrm: ContactoCrudoImportado[] = crmSemilla.map((c) => ({
      nombre: c.nombre,
      telefono: c.telefonoE164,
      correo: c.correo,
      origen: "CRM",
      etiquetaFuente: `CRM (${c.origen})`,
      esAgendaPersonal: false,
      clasificacionSugerida: "CLIENTE",
    }));
    agregarFuenteABrutos(brutosCrm, "CRM Compras, Usuarios y Chats", "CRM");
  };

  const handleLimpiarBorrador = () => {
    setBrutosAcumulados([]);
    setFuentesCargadasResumen([]);
    setPreviewItems([]);
    setResumenMerge(null);
    setMensaje(null);
  };

  const previewFiltrado = useMemo(() => {
    const q = busquedaPreview.trim().toLowerCase();
    return previewItems.filter((item) => {
      if (filtroPreview === "conflictos" && !item.tieneConflictoNombre) return false;
      if (filtroPreview === "personales" && item.clasificacion !== "PERSONAL") return false;
      if (filtroPreview === "clientes" && item.clasificacion !== "CLIENTE") return false;
      if (
        filtroPreview === "otros" &&
        (item.clasificacion === "PERSONAL" || item.clasificacion === "CLIENTE")
      ) {
        return false;
      }
      if (filtroPreview === "nuevos" && item.yaExisteEnDirectorio) return false;

      if (q) {
        const texto = [
          item.nombreConsolidado,
          item.telefonoE164,
          item.correo,
          item.motivoClasificacion,
          ...item.nombresCandidatos,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [previewItems, filtroPreview, busquedaPreview]);

  const actualizarItemPreview = (
    clave: string,
    parcial: Partial<ContactoConsolidadoPreview>
  ) => {
    setPreviewItems((prev) =>
      prev.map((it) => {
        if (it.claveConsolidacion !== clave) return it;
        const actualizado = { ...it, ...parcial };
        if (parcial.clasificacion && parcial.clasificacion !== "CLIENTE") {
          actualizado.politicaIa = "SIEMPRE_MANUAL";
          if (actualizado.visibilidad === "EQUIPO_VENTAS") {
            actualizado.visibilidad = mapearPoliticaPersonalAVisibilidad(politicaPersonalDefecto);
          }
        } else if (parcial.clasificacion === "CLIENTE") {
          if (actualizado.visibilidad === "IGNORAR_TOTAL") {
            actualizado.visibilidad = "EQUIPO_VENTAS";
          }
          if (actualizado.politicaIa === "SIEMPRE_MANUAL") {
            actualizado.politicaIa = "SEGUN_LINEA";
          }
        }
        return actualizado;
      })
    );
  };

  const aplicarAccionMasivaPreview = (
    modo: "PERSONAL_IGNORAR" | "PERSONAL_ADMIN" | "CLIENTE_LINEA" | "CLIENTE_AUTO" | "SELECCIONAR_TODOS" | "DESELECCIONAR_TODOS"
  ) => {
    const clavesVisibles = new Set(previewFiltrado.map((p) => p.claveConsolidacion));
    setPreviewItems((prev) =>
      prev.map((it) => {
        if (!clavesVisibles.has(it.claveConsolidacion)) return it;
        switch (modo) {
          case "PERSONAL_IGNORAR":
            return {
              ...it,
              clasificacion: "PERSONAL",
              politicaIa: "SIEMPRE_MANUAL",
              visibilidad: "IGNORAR_TOTAL",
              motivoClasificacion: "Marcado masivamente como Personal (Ignorar Total)",
            };
          case "PERSONAL_ADMIN":
            return {
              ...it,
              clasificacion: "PERSONAL",
              politicaIa: "SIEMPRE_MANUAL",
              visibilidad: "SOLO_ADMIN",
              motivoClasificacion: "Marcado masivamente como Personal (Solo Admin)",
            };
          case "CLIENTE_LINEA":
            return {
              ...it,
              clasificacion: "CLIENTE",
              politicaIa: "SEGUN_LINEA",
              visibilidad: "EQUIPO_VENTAS",
              motivoClasificacion: "Marcado masivamente como Cliente",
            };
          case "CLIENTE_AUTO":
            return {
              ...it,
              clasificacion: "CLIENTE",
              politicaIa: "AUTO_IA",
              visibilidad: "EQUIPO_VENTAS",
              motivoClasificacion: "Cliente con IA Automática activada",
            };
          case "SELECCIONAR_TODOS":
            return { ...it, seleccionado: true };
          case "DESELECCIONAR_TODOS":
            return { ...it, seleccionado: false };
        }
      })
    );
  };

  const handleExportarPreviewExcel = () => {
    const filas = previewItems.map((it) => ({
      Nombre_Consolidado: it.nombreConsolidado,
      Telefono_E164: it.telefonoE164,
      Correo: it.correo || "",
      Clasificacion: it.clasificacion,
      Politica_IA: it.politicaIa,
      Privacidad: it.visibilidad,
      Compras_CRM: it.totalComprasCrm,
      Duplicados_Fusionados: it.duplicadosFusionados,
      Alias_Encontrados: it.nombresCandidatos.join(" | "),
      Motivo: it.motivoClasificacion,
    }));
    exportarHojasAExcel(`contactos-depurados-${negNorm}`, [
      {
        nombre: "Contactos Depurados",
        filas,
        anchosColumnas: [28, 18, 24, 15, 16, 18, 12, 14, 34, 34],
      },
    ]);
  };

  const handleGuardarLoteConsolidado = async () => {
    const seleccionados = previewItems.filter((p) => p.seleccionado);
    if (seleccionados.length === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos un contacto para guardar." });
      return;
    }

    setGuardandoLote(true);
    setMensaje(null);
    const origenPrincipal = fuentesCargadasResumen[0]?.origen ?? "VCF";

    const res = await importarContactosDirectorioLoteAction({
      negocio: negNorm,
      lineaWhatsappId: lineaSeleccionadaId || null,
      origen: origenPrincipal,
      ocultarChatsPersonalesExistentes: ocultarExistentes,
      contactos: seleccionados.map((it) => ({
        telefonoE164: it.telefonoE164,
        nombreConsolidado: it.nombreConsolidado,
        correo: it.correo,
        clasificacion: it.clasificacion,
        politicaIa: it.politicaIa,
        visibilidad: it.visibilidad,
        detalle: {
          alias: it.nombresCandidatos,
          motivoClasificacion: it.motivoClasificacion,
          notas: it.notas || null,
        },
        fuentes: it.fuentes,
      })),
    });
    setGuardandoLote(false);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    setMensaje({
      tipo: "ok",
      texto: `Lista consolidada guardada: ${res.creados} nuevos, ${res.actualizados} actualizados, ${res.hilosProtegidos} chat(s) existentes protegidos.`,
    });
    handleLimpiarBorrador();
    await cargarDirectorio();
    setPestana("directorio");
  };

  const handleActualizarContacto = async (
    contacto: ContactoDirectorioRegistro,
    cambios: {
      clasificacion?: ClasificacionContacto;
      politicaIa?: PoliticaIaContacto;
      visibilidad?: VisibilidadContacto;
      eliminar?: boolean;
    }
  ) => {
    setActualizandoId(contacto.id);
    setMensaje(null);
    const res = await actualizarContactoDirectorioAction({
      negocio: negNorm,
      contactoId: contacto.id,
      clasificacion: cambios.clasificacion,
      politicaIa: cambios.politicaIa,
      visibilidad: cambios.visibilidad,
      eliminar: cambios.eliminar,
    });
    setActualizandoId(null);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    await cargarDirectorio();
    setMensaje({
      tipo: "ok",
      texto: cambios.eliminar
        ? `Contacto «${contacto.nombreConsolidado}» eliminado del directorio.`
        : `Regla actualizada para «${contacto.nombreConsolidado}».`,
    });
  };

  const contactosDirectorioFiltrados = useMemo(() => {
    if (filtroClasifDirectorio === "TODOS") return contactosGuardados;
    return contactosGuardados.filter((c) => c.clasificacion === filtroClasifDirectorio);
  }, [contactosGuardados, filtroClasifDirectorio]);

  const kpisDirectorio = useMemo(() => {
    let personales = 0;
    let ignorarTotal = 0;
    let clientes = 0;
    let proveedores = 0;
    for (const c of contactosGuardados) {
      if (c.clasificacion === "PERSONAL") personales++;
      if (c.clasificacion === "CLIENTE") clientes++;
      if (c.clasificacion === "PROVEEDOR" || c.clasificacion === "EQUIPO_INTERNO") proveedores++;
      if (c.visibilidad === "IGNORAR_TOTAL") ignorarTotal++;
    }
    return {
      total: contactosGuardados.length,
      personales,
      ignorarTotal,
      clientes,
      proveedores,
    };
  }, [contactosGuardados]);

  const columnasDirectorio: ColumnaDataGrid<ContactoDirectorioRegistro>[] = useMemo(
    () => [
      {
        id: "nombre",
        encabezado: "Contacto Consolidado",
        valor: (r) => r.nombreConsolidado,
        render: (r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ color: "#1F1C19", fontSize: "0.84rem" }}>{r.nombreConsolidado}</strong>
            {r.correo && <span style={{ fontSize: "0.73rem", color: "#7B746B" }}>{r.correo}</span>}
          </div>
        ),
      },
      {
        id: "telefono",
        encabezado: "Teléfono (E.164)",
        valor: (r) => r.telefonoE164,
        render: (r) => (
          <span style={{ fontFamily: "monospace", fontSize: "0.81rem", color: "#2E2A26" }}>
            {r.telefonoE164}
          </span>
        ),
      },
      {
        id: "clasificacion",
        encabezado: "Clasificación",
        valor: (r) => r.clasificacion,
        render: (r) => {
          const est = ESTILO_CLASIFICACION[r.clasificacion] || ESTILO_CLASIFICACION.PERSONAL;
          return (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: "999px",
                background: est.fondo,
                color: est.texto,
                border: `1px solid ${est.borde}`,
                fontSize: "0.73rem",
                fontWeight: 700,
              }}
            >
              {est.etiqueta}
            </span>
          );
        },
      },
      {
        id: "politicaIa",
        encabezado: "Respuesta IA",
        valor: (r) => ETIQUETA_POLITICA_IA[r.politicaIa] || r.politicaIa,
        render: (r) => (
          <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#3A3530" }}>
            {ETIQUETA_POLITICA_IA[r.politicaIa] || r.politicaIa}
          </span>
        ),
      },
      {
        id: "visibilidad",
        encabezado: "Privacidad / Consola",
        valor: (r) => ETIQUETA_VISIBILIDAD[r.visibilidad] || r.visibilidad,
        render: (r) => (
          <span style={{ fontSize: "0.75rem", color: "#57524C" }}>
            {ETIQUETA_VISIBILIDAD[r.visibilidad] || r.visibilidad}
          </span>
        ),
      },
      {
        id: "fuentes",
        encabezado: "Fuentes / Celulares",
        valor: (r) =>
          (r.fuentes || [])
            .map((f) => f.lineaNombre || f.propietarioNombre || f.origen)
            .join(", ") || r.titularNombre || "Manual",
        render: (r) => (
          <span style={{ fontSize: "0.75rem", color: "#57524C" }}>
            {r.fuentes?.length
              ? `${r.fuentes.length} fuente(s): ${r.fuentes
                  .slice(0, 2)
                  .map((f) => f.lineaNombre || f.origen)
                  .join(", ")}`
              : r.titularNombre || "Manual"}
          </span>
        ),
      },
      {
        id: "compras",
        encabezado: "Compras CRM",
        valor: (r) => r.totalComprasCrm ?? 0,
        render: (r) => (
          <span style={{ fontSize: "0.78rem", fontWeight: (r.totalComprasCrm ?? 0) > 0 ? 700 : 400 }}>
            {(r.totalComprasCrm ?? 0) > 0
              ? `${r.totalComprasCrm} ($${Number(r.montoAcumuladoCrm || 0).toFixed(2)})`
              : "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
      {/* Barra superior con KPIs y pestañas */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "14px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#F3E8FF",
                border: "1px solid #DDD6FE",
                color: "#6B21A8",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Contact size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.06rem", fontWeight: 700, color: "#1F1C19" }}>
                Extracción, Consolidación (Join/Merge) y Listas WhatsApp
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#7B746B" }}>
                Depura agendas de múltiples celulares, bloquea respuestas automáticas en contactos personales (Ignorar Total) y gestiona líneas WhatsApp.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Link
              href="/panel/conversaciones"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "9px",
                border: "1px solid #D5CFC4",
                background: "#FFFFFF",
                color: "#2E2A26",
                fontSize: "0.8rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <MessageSquare size={14} />
              <span>Ir a Chats</span>
            </Link>
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => void cargarDirectorio()}
              disabled={cargando}
              title="Actualizar directorio de contactos"
              aria-label="Actualizar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 11px",
                borderRadius: "9px",
                border: "1px solid #D5CFC4",
                background: "#F8F7F4",
                color: "#3A3530",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} />
              <span className="btn-texto-responsive">Actualizar</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            { label: "Total Consolidados", val: kpisDirectorio.total, color: "#1F1C19", bg: "#F8F7F4" },
            { label: "🔒 Personales", val: kpisDirectorio.personales, color: "#6B21A8", bg: "#FAF5FF" },
            { label: "📵 Ignorar Total", val: kpisDirectorio.ignorarTotal, color: "#991B1B", bg: "#FEF2F2" },
            { label: "💼 Clientes", val: kpisDirectorio.clientes, color: "#166534", bg: "#F0FDF4" },
            { label: "📱 Teléfonos WA", val: lineasWhatsapp.length, color: "#1D4ED8", bg: "#EEF4FF" },
          ].map((k) => (
            <div
              key={k.label}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                background: k.bg,
                border: "1px solid #EAE6DE",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6E6861" }}>{k.label}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: k.color, marginTop: "2px" }}>
                {k.val}
              </div>
            </div>
          ))}
        </div>

        {/* Pestañas */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #F1EFEA", paddingTop: "12px" }}>
          {[
            { id: "importar" as const, label: "Extraer & Join/Merge", icono: Upload },
            { id: "directorio" as const, label: `Directorio (${kpisDirectorio.total})`, icono: Users },
            { id: "lineas" as const, label: `Teléfonos WhatsApp (${lineasWhatsapp.length})`, icono: Smartphone },
          ].map((t) => {
            const Icono = t.icono;
            const activo = pestana === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPestana(t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "9px",
                  border: activo ? "1px solid #1F1C19" : "1px solid #D5CFC4",
                  background: activo ? "#1F1C19" : "#FFFFFF",
                  color: activo ? "#FFFFFF" : "#3A3530",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Icono size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {mensaje && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            border: mensaje.tipo === "ok" ? "1px solid #BBF7D0" : "1px solid #FECACA",
            background: mensaje.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
            color: mensaje.tipo === "ok" ? "#166534" : "#991B1B",
            fontSize: "0.83rem",
            fontWeight: 600,
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 1: EXTRACCIÓN MULTI-FUENTE + JOIN/MERGE + DEPURACIÓN        */}
      {/* =================================================================== */}
      {pestana === "importar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Paso 1: Configurar origen/teléfono y cargar fuentes */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E6E2DA",
              borderRadius: "14px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ fontSize: "0.94rem", fontWeight: 700, color: "#1F1C19" }}>
              1. Extraer contactos y elegir a qué teléfono pertenecen
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "12px",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Teléfono / Propietario que aporta esta lista
                <select
                  value={lineaSeleccionadaId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLineaSeleccionadaId(id);
                    const lin = lineasWhatsapp.find((l) => l.id === id);
                    if (lin) {
                      setEsAgendaPersonalImport(lin.rolLinea !== "VENTAS");
                      setPoliticaPersonalDefecto(lin.politicaPersonales);
                    }
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.84rem",
                  }}
                >
                  <option value="">Mi agenda personal (global)</option>
                  {lineasWhatsapp.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} ({l.numeroE164})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Política por defecto para contactos PERSONALES
                <select
                  value={politicaPersonalDefecto}
                  onChange={(e) =>
                    setPoliticaPersonalDefecto(e.target.value as PoliticaPersonalesLinea)
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.84rem",
                  }}
                >
                  <option value="IGNORAR_TOTAL">🔒 Ignorar Total (solo se ve en el celular)</option>
                  <option value="OCULTO_ADMIN">🛡️ Manual · Oculto a Ventas (solo Admin)</option>
                  <option value="SOLO_TITULAR">👤 Manual · Solo visible al Titular</option>
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: esAgendaPersonalImport ? "1px solid #DDD6FE" : "1px solid #BBF7D0",
                  background: esAgendaPersonalImport ? "#FAF5FF" : "#F0FDF4",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={esAgendaPersonalImport}
                  onChange={(e) => setEsAgendaPersonalImport(e.target.checked)}
                />
                <div style={{ fontSize: "0.78rem", color: "#2E2A26" }}>
                  <strong>Modo seguro (Agenda Personal):</strong> todo contacto que NO diga «cliente» ni tenga compras se clasifica como <strong>PERSONAL</strong>.
                </div>
              </label>
            </div>

            {/* Tarjetas de métodos de extracción */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {/* Método A: Subir archivos .vcf / .csv / .xlsx */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "11px",
                  border: "1px dashed #94A3B8",
                  background: "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontWeight: 700, fontSize: "0.84rem", color: "#1F1C19" }}>
                  <FileSpreadsheet size={16} color="#1D4ED8" />
                  <span>Subir .vcf / .csv / .xlsx</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B", lineHeight: 1.45 }}>
                  Exporta desde iPhone/Android (<code>.vcf</code>) o Google Contacts (<code>.csv</code>/Excel). Puedes seleccionar varios archivos a la vez para hacer Join/Merge.
                </p>
                <input
                  ref={inputArchivoRef}
                  type="file"
                  multiple
                  accept=".vcf,.vcard,.csv,.xlsx,.xls,.txt"
                  onChange={(e) => void handleArchivosSeleccionados(e.target.files)}
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
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #1D4ED8",
                    background: "#1D4ED8",
                    color: "#FFFFFF",
                    fontSize: "0.79rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={14} />
                  <span>Elegir Archivos</span>
                </button>
              </div>

              {/* Método B: Libreta nativa del celular (Contact Picker) */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "11px",
                  border: "1px solid #E6E2DA",
                  background: "#FCFBF9",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontWeight: 700, fontSize: "0.84rem", color: "#1F1C19" }}>
                  <Smartphone size={16} color="#16A34A" />
                  <span>Extraer del Celular</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#6E6861", lineHeight: 1.45 }}>
                  {soportaContactPicker
                    ? "Tu celular soporta lectura directa de agenda (Contact Picker). Elige contactos en 1 toque."
                    : "Disponible directamente en Android Chrome/PWA. En iPhone o PC exporta .vcf desde Contactos/iCloud."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleContactPickerCelular()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #16A34A",
                    background: soportaContactPicker ? "#16A34A" : "#FFFFFF",
                    color: soportaContactPicker ? "#FFFFFF" : "#166534",
                    fontSize: "0.79rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Contact size={14} />
                  <span>Abrir Libreta</span>
                </button>
              </div>

              {/* Método C: Cruzar con CRM / Compras / Chats */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "11px",
                  border: "1px solid #E6E2DA",
                  background: "#FCFBF9",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontWeight: 700, fontSize: "0.84rem", color: "#1F1C19" }}>
                  <Database size={16} color="#7C3AED" />
                  <span>Cruzar con CRM Actual</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#6E6861", lineHeight: 1.45 }}>
                  Detectados <strong>{crmSemilla.length}</strong> teléfonos en compras, usuarios web y chats. Únelos al Join/Merge para identificar clientes antiguos.
                </p>
                <button
                  type="button"
                  onClick={handleCruzarConCrm}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #7C3AED",
                    background: "#FAF5FF",
                    color: "#6B21A8",
                    fontSize: "0.79rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={14} />
                  <span>Cargar CRM ({crmSemilla.length})</span>
                </button>
              </div>
            </div>

            {/* Pegado rápido de lista a ignorar o contactos */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#F8F7F4",
                border: "1px solid #EAE6DE",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700, color: "#3A3530" }}>
                <ClipboardPaste size={14} />
                <span>Pegado rápido (1 contacto por línea: «Nombre, 099...» o solo el número)</span>
              </div>
              <textarea
                value={textoPegado}
                onChange={(e) => setTextoPegado(e.target.value)}
                rows={3}
                placeholder={"Mamá, 099 123 4567\nCliente Juan Perez - +593 99 888 7777\n0987654321"}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  fontSize: "0.81rem",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleCargarTextoPegado(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: "1px solid #6B21A8",
                    background: "#6B21A8",
                    color: "#FFFFFF",
                    fontSize: "0.77rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Lock size={13} />
                  <span>Cargar a Ignorar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCargarTextoPegado(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#2E2A26",
                    fontSize: "0.77rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Users size={13} />
                  <span>Agregar y Clasificar</span>
                </button>
              </div>
            </div>

            {/* Reglas de auto-clasificación editables */}
            <details
              style={{
                border: "1px solid #E6E2DA",
                borderRadius: "10px",
                padding: "10px 12px",
                background: "#FFFFFF",
              }}
            >
              <summary style={{ cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, color: "#3A3530" }}>
                ⚙️ Reglas de auto-clasificación (palabras clave de «Cliente» vs «Proveedor»)
              </summary>
              <div
                style={{
                  marginTop: "10px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "10px",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#57524C" }}>
                  Patrones que detectan CLIENTE (separados por coma)
                  <input
                    value={patronesClienteTxt}
                    onChange={(e) => setPatronesClienteTxt(e.target.value)}
                    style={{ padding: "7px 9px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.8rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#57524C" }}>
                  Patrones de PROVEEDOR (IA siempre deshabilitada)
                  <input
                    value={patronesProveedorTxt}
                    onChange={(e) => setPatronesProveedorTxt(e.target.value)}
                    style={{ padding: "7px 9px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.8rem" }}
                  />
                </label>
              </div>
              {brutosAcumulados.length > 0 && (
                <button
                  type="button"
                  onClick={() => recalcularConsolidacion(brutosAcumulados)}
                  style={{
                    marginTop: "10px",
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: "1px solid #1F1C19",
                    background: "#1F1C19",
                    color: "#FFFFFF",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Aplicar Reglas
                </button>
              )}
            </details>

            {/* Fuentes cargadas en sesión */}
            {fuentesCargadasResumen.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#57524C" }}>
                  Fuentes en Join/Merge:
                </span>
                {fuentesCargadasResumen.map((f, idx) => (
                  <span
                    key={`${f.etiqueta}-${idx}`}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "#EEF4FF",
                      color: "#1D4ED8",
                      fontSize: "0.73rem",
                      fontWeight: 600,
                    }}
                  >
                    {f.etiqueta} ({f.cantidad})
                  </span>
                ))}
                <button
                  type="button"
                  onClick={handleLimpiarBorrador}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "7px",
                    border: "1px solid #FECACA",
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Limpiar Borrador
                </button>
              </div>
            )}
          </div>

          {/* Paso 2: Resultado interactivo del Join/Merge + Depuración antes de guardar */}
          {resumenMerge && previewItems.length > 0 && (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E6E2DA",
                borderRadius: "14px",
                padding: "16px 18px",
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
                <div>
                  <div style={{ fontSize: "0.94rem", fontWeight: 700, color: "#1F1C19" }}>
                    2. Vista Previa Consolidada (Join/Merge) — Revisa y Guarda
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#6E6861", marginTop: "2px" }}>
                    <strong>{resumenMerge.totalRegistrosBrutos}</strong> registros leídos →{" "}
                    <strong>{resumenMerge.totalConsolidados}</strong> contactos únicos (
                    <strong>{resumenMerge.duplicadosFusionados}</strong> duplicados fusionados ·{" "}
                    <strong>{resumenMerge.conflictosNombre}</strong> con varios nombres ·{" "}
                    <strong>{resumenMerge.coincidenciasCrm}</strong> coinciden con CRM).
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleExportarPreviewExcel}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "7px 11px",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      color: "#2E2A26",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} />
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    type="button"
                    disabled={guardandoLote}
                    onClick={() => void handleGuardarLoteConsolidado()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 15px",
                      borderRadius: "9px",
                      border: "1px solid #2F4737",
                      background: "#2F4737",
                      color: "#FFFFFF",
                      fontSize: "0.81rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: guardandoLote ? 0.65 : 1,
                    }}
                  >
                    <Save size={15} />
                    <span>
                      {guardandoLote
                        ? "Guardando…"
                        : `Guardar (${previewItems.filter((p) => p.seleccionado).length})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Filtros y acciones masivas */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={busquedaPreview}
                  onChange={(e) => setBusquedaPreview(e.target.value)}
                  placeholder="Buscar nombre, teléfono, alias…"
                  style={{
                    flex: "1 1 200px",
                    padding: "7px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    fontSize: "0.8rem",
                  }}
                />
                {(
                  [
                    { id: "todos", label: `Todos (${previewItems.length})` },
                    { id: "conflictos", label: `⚠️ Conflictos (${resumenMerge.conflictosNombre})` },
                    { id: "personales", label: `🔒 Personales (${resumenMerge.totalPersonales})` },
                    { id: "clientes", label: `💼 Clientes (${resumenMerge.totalClientes})` },
                    { id: "otros", label: `🚚 Otros (${resumenMerge.totalProveedoresOInternos})` },
                    { id: "nuevos", label: `✨ Nuevos (${resumenMerge.nuevos})` },
                  ] as Array<{ id: FiltroPreview; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroPreview(f.id)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "999px",
                      border: filtroPreview === f.id ? "1px solid #1F1C19" : "1px solid #D5CFC4",
                      background: filtroPreview === f.id ? "#1F1C19" : "#FFFFFF",
                      color: filtroPreview === f.id ? "#FFFFFF" : "#3A3530",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: "9px",
                  background: "#F8F7F4",
                  border: "1px solid #EAE6DE",
                }}
              >
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#57524C" }}>
                  Aplicar a los {previewFiltrado.length} visibles:
                </span>
                <button
                  type="button"
                  onClick={() => aplicarAccionMasivaPreview("PERSONAL_IGNORAR")}
                  style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid #DDD6FE", background: "#FAF5FF", color: "#6B21A8", fontSize: "0.73rem", fontWeight: 700, cursor: "pointer" }}
                >
                  🔒 Personal (Ignorar Total)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAccionMasivaPreview("PERSONAL_ADMIN")}
                  style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid #DDD6FE", background: "#FFFFFF", color: "#6B21A8", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer" }}
                >
                  🛡️ Personal (Solo Admin)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAccionMasivaPreview("CLIENTE_LINEA")}
                  style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#166534", fontSize: "0.73rem", fontWeight: 700, cursor: "pointer" }}
                >
                  💼 Cliente (Según Línea)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAccionMasivaPreview("CLIENTE_AUTO")}
                  style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid #BBF7D0", background: "#FFFFFF", color: "#166534", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer" }}
                >
                  ⚡ Cliente + IA Auto
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAccionMasivaPreview("SELECCIONAR_TODOS")}
                  style={{ padding: "4px 8px", borderRadius: "7px", border: "1px solid #D5CFC4", background: "#FFFFFF", color: "#3A3530", fontSize: "0.72rem", cursor: "pointer" }}
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  onClick={() => aplicarAccionMasivaPreview("DESELECCIONAR_TODOS")}
                  style={{ padding: "4px 8px", borderRadius: "7px", border: "1px solid #D5CFC4", background: "#FFFFFF", color: "#3A3530", fontSize: "0.72rem", cursor: "pointer" }}
                >
                  Desmarcar
                </button>
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "0.78rem", color: "#3A3530", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ocultarExistentes}
                  onChange={(e) => setOcultarExistentes(e.target.checked)}
                />
                Bloquear IA y ocultar automáticamente chats WhatsApp abiertos que coincidan con contactos marcados como Personales.
              </label>

              {/* Lista editable de filas consolidadas (máximo 200 visibles por página ligera) */}
              <div
                style={{
                  maxHeight: "480px",
                  overflowY: "auto",
                  border: "1px solid #E6E2DA",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {previewFiltrado.slice(0, 200).map((it) => {
                  const est = ESTILO_CLASIFICACION[it.clasificacion];
                  return (
                    <div
                      key={it.claveConsolidacion}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px minmax(180px, 1.4fr) 135px 145px 150px 165px",
                        gap: "8px",
                        alignItems: "center",
                        padding: "9px 12px",
                        borderBottom: "1px solid #F1EFEA",
                        background: it.seleccionado ? "#FFFFFF" : "#F8F7F4",
                        opacity: it.seleccionado ? 1 : 0.6,
                        fontSize: "0.78rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={it.seleccionado}
                        onChange={(e) =>
                          actualizarItemPreview(it.claveConsolidacion, {
                            seleccionado: e.target.checked,
                          })
                        }
                      />

                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                        {it.tieneConflictoNombre ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0 }} />
                            <select
                              value={it.nombreConsolidado}
                              onChange={(e) =>
                                actualizarItemPreview(it.claveConsolidacion, {
                                  nombreConsolidado: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "3px 6px",
                                borderRadius: "6px",
                                border: "1px solid #F59E0B",
                                background: "#FFFBEB",
                                fontSize: "0.77rem",
                                fontWeight: 700,
                              }}
                            >
                              {it.nombresCandidatos.map((nom) => (
                                <option key={nom} value={nom}>
                                  {nom}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <strong style={{ color: "#1F1C19", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.nombreConsolidado}
                          </strong>
                        )}
                        <span style={{ fontSize: "0.7rem", color: "#7B746B" }}>
                          {it.motivoClasificacion}
                          {it.duplicadosFusionados > 0
                            ? ` · ${it.duplicadosFusionados + 1} registros fusionados`
                            : ""}
                        </span>
                      </div>

                      <div style={{ fontFamily: "monospace", fontSize: "0.77rem", color: "#2E2A26" }}>
                        {it.telefonoE164}
                      </div>

                      <select
                        value={it.clasificacion}
                        onChange={(e) =>
                          actualizarItemPreview(it.claveConsolidacion, {
                            clasificacion: e.target.value as ClasificacionContacto,
                          })
                        }
                        style={{
                          padding: "4px 6px",
                          borderRadius: "7px",
                          border: `1px solid ${est.borde}`,
                          background: est.fondo,
                          color: est.texto,
                          fontSize: "0.74rem",
                          fontWeight: 700,
                        }}
                      >
                        <option value="PERSONAL">🔒 Personal</option>
                        <option value="CLIENTE">💼 Cliente</option>
                        <option value="PROVEEDOR">🚚 Proveedor</option>
                        <option value="EQUIPO_INTERNO">👥 Equipo</option>
                        <option value="BLOQUEADO_SPAM">🚫 Bloqueado</option>
                      </select>

                      <select
                        value={it.politicaIa}
                        disabled={it.clasificacion !== "CLIENTE"}
                        onChange={(e) =>
                          actualizarItemPreview(it.claveConsolidacion, {
                            politicaIa: e.target.value as PoliticaIaContacto,
                          })
                        }
                        style={{
                          padding: "4px 6px",
                          borderRadius: "7px",
                          border: "1px solid #D5CFC4",
                          background: it.clasificacion !== "CLIENTE" ? "#F3F4F6" : "#FFFFFF",
                          fontSize: "0.74rem",
                        }}
                      >
                        <option value="SIEMPRE_MANUAL">✋ Siempre Manual</option>
                        <option value="SEGUN_LINEA">📱 Según teléfono</option>
                        <option value="AUTO_IA">⚡ IA Automática</option>
                      </select>

                      <select
                        value={it.visibilidad}
                        onChange={(e) =>
                          actualizarItemPreview(it.claveConsolidacion, {
                            visibilidad: e.target.value as VisibilidadContacto,
                          })
                        }
                        style={{
                          padding: "4px 6px",
                          borderRadius: "7px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          fontSize: "0.73rem",
                        }}
                      >
                        <option value="IGNORAR_TOTAL">📵 Ignorar Total</option>
                        <option value="SOLO_ADMIN">🛡️ Solo Admin</option>
                        <option value="SOLO_TITULAR">👤 Solo Titular</option>
                        <option value="EQUIPO_VENTAS">💬 Ventas y Admin</option>
                      </select>
                    </div>
                  );
                })}
                {previewFiltrado.length > 200 && (
                  <div style={{ padding: "10px 12px", fontSize: "0.76rem", color: "#6E6861", background: "#FAF9F6" }}>
                    Mostrando primeros 200 de {previewFiltrado.length} contactos filtrados. Todos los contactos marcados se guardarán al pulsar <strong>Guardar</strong>.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 2: DIRECTORIO CONSOLIDADO EN DATAGRID ESTÁNDAR (@eco/datagrid) */}
      {/* =================================================================== */}
      {pestana === "directorio" && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E6E2DA",
            borderRadius: "14px",
            padding: "16px 18px",
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
              {[
                { id: "TODOS", label: `Todos (${kpisDirectorio.total})` },
                { id: "PERSONAL", label: `🔒 Personales (${kpisDirectorio.personales})` },
                { id: "CLIENTE", label: `💼 Clientes (${kpisDirectorio.clientes})` },
                { id: "PROVEEDOR", label: "🚚 Proveedores" },
                { id: "EQUIPO_INTERNO", label: "👥 Equipo" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroClasifDirectorio(f.id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "999px",
                    border:
                      filtroClasifDirectorio === f.id ? "1px solid #1F1C19" : "1px solid #D5CFC4",
                    background: filtroClasifDirectorio === f.id ? "#1F1C19" : "#FFFFFF",
                    color: filtroClasifDirectorio === f.id ? "#FFFFFF" : "#3A3530",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: "0.75rem", color: "#7B746B" }}>
              {esAdmin
                ? "Vista Administrador: ves clientes y listas personales de todos los teléfonos."
                : "Vista protegida: ves clientes comerciales y únicamente tus propios contactos personales."}
            </span>
          </div>

          <DataGrid
            columnas={columnasDirectorio}
            filas={contactosDirectorioFiltrados}
            idFila={(r) => r.id}
            nombreExportacion={`directorio-contactos-${negNorm}`}
            contenidoExpandible={(r) => (
              <div
                style={{
                  padding: "12px 14px",
                  background: "#FCFBF9",
                  borderRadius: "10px",
                  border: "1px solid #E6E2DA",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#3A3530" }}>
                    Acciones rápidas:
                  </span>
                  <button
                    type="button"
                    disabled={actualizandoId === r.id}
                    onClick={() =>
                      void handleActualizarContacto(r, {
                        clasificacion: "PERSONAL",
                        politicaIa: "SIEMPRE_MANUAL",
                        visibilidad: "IGNORAR_TOTAL",
                      })
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "1px solid #DDD6FE",
                      background: "#FAF5FF",
                      color: "#6B21A8",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <EyeOff size={13} />
                    <span>Ignorar Total</span>
                  </button>
                  <button
                    type="button"
                    disabled={actualizandoId === r.id}
                    onClick={() =>
                      void handleActualizarContacto(r, {
                        clasificacion: "CLIENTE",
                        politicaIa: "SEGUN_LINEA",
                        visibilidad: "EQUIPO_VENTAS",
                      })
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "1px solid #BBF7D0",
                      background: "#F0FDF4",
                      color: "#166534",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <UserCheck size={13} />
                    <span>Pasar a Cliente</span>
                  </button>
                  <button
                    type="button"
                    disabled={actualizandoId === r.id}
                    onClick={() =>
                      void handleActualizarContacto(r, {
                        clasificacion: "CLIENTE",
                        politicaIa: "AUTO_IA",
                        visibilidad: "EQUIPO_VENTAS",
                      })
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "1px solid #2F4737",
                      background: "#2F4737",
                      color: "#FFFFFF",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Bot size={13} />
                    <span>Cliente + IA Auto</span>
                  </button>
                  <button
                    type="button"
                    disabled={actualizandoId === r.id}
                    onClick={() =>
                      void handleActualizarContacto(r, {
                        clasificacion: "PERSONAL",
                        politicaIa: "SIEMPRE_MANUAL",
                        visibilidad: "SOLO_ADMIN",
                      })
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "1px solid #C7DAFE",
                      background: "#EEF4FF",
                      color: "#1D4ED8",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Shield size={13} />
                    <span>Oculto Admin</span>
                  </button>
                  <button
                    type="button"
                    disabled={actualizandoId === r.id}
                    onClick={() => void handleActualizarContacto(r, { eliminar: true })}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      color: "#B91C1C",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </div>

                {/* Historial de fuentes aportadas (Join/Merge provenance) */}
                <div style={{ fontSize: "0.76rem", color: "#57524C" }}>
                  <strong>Trazabilidad de fuentes ({r.fuentes?.length || 0}):</strong>
                  {r.fuentes && r.fuentes.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "5px" }}>
                      {r.fuentes.map((f, idx) => (
                        <div
                          key={f.id || idx}
                          style={{
                            padding: "5px 9px",
                            borderRadius: "7px",
                            background: "#FFFFFF",
                            border: "1px solid #EAE6DE",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>
                            <strong>{f.nombreOriginal}</strong> · {f.origen}
                            {f.lineaNombre ? ` · 📱 ${f.lineaNombre}` : ""}
                            {f.propietarioNombre ? ` · Aportado por ${f.propietarioNombre}` : ""}
                          </span>
                          <span style={{ fontWeight: 600, color: "#6B21A8" }}>
                            {f.clasificacionOrigen} ({f.politicaPersonal})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span> Sin fuentes adicionales registradas.</span>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 3: GESTOR MULTI-LÍNEA WHATSAPP                              */}
      {/* =================================================================== */}
      {pestana === "lineas" && (
        <GestorLineasWhatsappPanel
          negocio={negNorm}
          onLineasActualizadas={(ls) => setLineasWhatsapp(ls)}
        />
      )}
    </div>
  );
}
