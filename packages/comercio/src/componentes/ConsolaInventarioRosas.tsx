"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Flower2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  analizarFotoBonchesConAriaAction,
  guardarColoresOfertaInventarioAction,
  guardarCorteInventarioRosasAction,
  listarVariedadesRosaAction,
  obtenerColoresInventarioTiendaAction,
  obtenerInventarioRosasAction,
  verificarYAlertarInventarioRosasAction,
} from "../acciones-operaciones-taller";
import {
  HORAS_LIMITE_ALERTA_INVENTARIO_ROSAS,
  evaluarVigenciaInventarioRosas,
  normalizarClaveColorRosaPersonalizacion,
  normalizarClaveOfertaInventario,
} from "../utils/personalizacionFloral";
import {
  CATALOGO_SEMILLA_VARIEDADES_ROSAS,
  COLORES_ORQUIDEA_CYMBIDIUM,
  calcularResumenColoresDesdeItems,
  consolidarVariedadesDesdeFotos,
  convertirConteoColoresAItemsVariedad,
  normalizarColorOrquideaClave,
  obtenerVariedadDefectoPorColor,
  obtenerVariedadesPorColor,
  type ItemConteoVariedad,
  type TipoFlorInventario,
  type VariedadRosaCatalogo,
} from "../catalogo-variedades-rosas";
import {
  COLORES_ROSAS_ESTANDAR,
  formatearFechaCorteInventario,
  formatearResumenInventarioTexto,
  type CorteInventarioRosas,
  type DefinicionColorRosa,
  type FotoConteoBonches,
} from "../operaciones-taller";
import {
  comprimirYEstamparFotoArchivo,
  dataUrlABlob,
  subirArchivoOperativoStorage,
} from "../utils/evidenciaImagenGps";
import { CatalogoVariedadesRosas } from "./CatalogoVariedadesRosas";

export interface PropsConsolaInventarioRosas {
  negocio: string;
  ultimoCorteInicial?: CorteInventarioRosas | null;
  historialInicial?: CorteInventarioRosas[];
  migracionPendienteInicial?: boolean;
}

function formatearTextoConsolidadoVariedades(
  corte: CorteInventarioRosas | null,
  catalogo: VariedadRosaCatalogo[]
): string {
  if (!corte) return "0 paquetes";
  const cons = consolidarVariedadesDesdeFotos(corte.fotos || [], catalogo);
  if (cons.resumenVariedades.length === 0) {
    return formatearResumenInventarioTexto(corte.resumenColores);
  }
  return cons.resumenVariedades
    .map((v) =>
      v.tipoFlor === "orquidea"
        ? `${v.numeroFlores ?? v.cantidad} ${v.variedadNombre}${v.cantidad > 0 ? ` (${v.cantidad} vara${v.cantidad === 1 ? "" : "s"})` : ""}`
        : v.tipoFlor === "girasol"
          ? `${v.cantidad} Girasoles`
          : `${v.cantidad} ${v.variedadNombre}`
    )
    .join(", ");
}

export function ConsolaInventarioRosas({
  negocio,
  ultimoCorteInicial = null,
  historialInicial = [],
  migracionPendienteInicial = false,
}: PropsConsolaInventarioRosas) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_inventario_rosas_${negNorm}`;

  const [pestanaActiva, setPestanaActiva] = useState<"conteo" | "catalogo">("conteo");
  const [esMovil, setEsMovil] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sincronizar = () => {
      const movil = mq.matches;
      setEsMovil(movil);
      if (movil) {
        setPestanaActiva("conteo");
      }
    };
    sincronizar();
    mq.addEventListener("change", sincronizar);
    return () => mq.removeEventListener("change", sincronizar);
  }, []);
  const [catalogoVariedades, setCatalogoVariedades] = useState<VariedadRosaCatalogo[]>(
    CATALOGO_SEMILLA_VARIEDADES_ROSAS
  );
  const [categoriasColores, setCategoriasColores] = useState<DefinicionColorRosa[]>(
    COLORES_ROSAS_ESTANDAR
  );
  const [migracionCatalogoPendiente, setMigracionCatalogoPendiente] = useState<boolean>(false);

  const [ultimoCorte, setUltimoCorte] = useState<CorteInventarioRosas | null>(ultimoCorteInicial);
  const [historial, setHistorial] = useState<CorteInventarioRosas[]>(historialInicial);
  const [migracionPendiente, setMigracionPendiente] = useState<boolean>(migracionPendienteInicial);

  const [fotosActuales, setFotosActuales] = useState<FotoConteoBonches[]>([]);
  const [observaciones, setObservaciones] = useState<string>("");
  const [subiendoFotos, setSubiendoFotos] = useState<boolean>(false);
  const [analizandoFotoIds, setAnalizandoFotoIds] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fotoEliminadaReciente, setFotoEliminadaReciente] = useState<{
    foto: FotoConteoBonches;
    indice: number;
  } | null>(null);

  // Panel rápido para agregar paquetes / orquídeas manualmente (que no están en las fotos)
  const [mostrarPanelManual, setMostrarPanelManual] = useState<boolean>(false);
  const [manualTipoFlor, setManualTipoFlor] = useState<TipoFlorInventario>("rosa");
  const [manualColor, setManualColor] = useState<string>("rojo");
  const [manualVariedadId, setManualVariedadId] = useState<string>("");
  const [manualCantidad, setManualCantidad] = useState<number>(1);
  const [manualNumeroFlores, setManualNumeroFlores] = useState<number>(9);

  // Selector inline para agregar otra variedad dentro de una foto específica
  const [fotoAgregandoId, setFotoAgregandoId] = useState<string | null>(null);
  const [inlineTipoFlor, setInlineTipoFlor] = useState<TipoFlorInventario>("rosa");
  const [inlineColor, setInlineColor] = useState<string>("rojo");
  const [inlineVariedadId, setInlineVariedadId] = useState<string>("");
  const [inlineCantidad, setInlineCantidad] = useState<number>(1);
  const [inlineNumeroFlores, setInlineNumeroFlores] = useState<number>(9);

  // Configuración de colores/flores en oferta con % individual por clave
  const [ofertaActiva, setOfertaActiva] = useState<boolean>(false);
  const [descuentosOfertaPorClave, setDescuentosOfertaPorClave] = useState<Record<string, number>>({});
  const [cargandoOferta, setCargandoOferta] = useState<boolean>(false);
  const [guardandoOferta, setGuardandoOferta] = useState<boolean>(false);
  const [mensajeOfertaOk, setMensajeOfertaOk] = useState<string | null>(null);
  const [errorOfertaMsg, setErrorOfertaMsg] = useState<string | null>(null);

  const clavesOfertaActivas = useMemo(
    () =>
      Object.entries(descuentosOfertaPorClave)
        .filter(([, pct]) => Number.isFinite(pct) && pct > 0)
        .map(([k]) => k),
    [descuentosOfertaPorClave]
  );

  // Alerta manual al equipo si han pasado > 15 horas sin inventario
  const [enviandoAlertaEquipo, setEnviandoAlertaEquipo] = useState<boolean>(false);
  const [mensajeAlertaEquipo, setMensajeAlertaEquipo] = useState<string | null>(null);
  const [errorAlertaEquipo, setErrorAlertaEquipo] = useState<string | null>(null);

  const cargarConfigOferta = useCallback(async () => {
    setCargandoOferta(true);
    try {
      const res = await obtenerColoresInventarioTiendaAction(negNorm);
      if (res.ok) {
        const pctDef =
          Number.isFinite(Number(res.porcentajeDescuentoOferta)) &&
          Number(res.porcentajeDescuentoOferta) > 0
            ? Number(res.porcentajeDescuentoOferta)
            : 10;
        setOfertaActiva(Boolean(res.ofertaColoresActiva));
        const mapa: Record<string, number> = {};
        if (res.descuentosPorColor && typeof res.descuentosPorColor === "object") {
          for (const [k, v] of Object.entries(res.descuentosPorColor)) {
            const cl = normalizarClaveOfertaInventario(k);
            const num = Number(v);
            if (cl && Number.isFinite(num) && num > 0) {
              mapa[cl] = Math.round(Math.min(80, Math.max(1, num)) * 100) / 100;
            }
          }
        }
        for (const rawCl of res.coloresEnOferta || []) {
          const cl = normalizarClaveOfertaInventario(rawCl);
          if (cl && !mapa[cl]) {
            mapa[cl] = pctDef;
          }
        }
        setDescuentosOfertaPorClave(mapa);
      }
    } finally {
      setCargandoOferta(false);
    }
  }, [negNorm]);

  const cargarCatalogo = useCallback(async () => {
    const res = await listarVariedadesRosaAction(negNorm);
    if (res.ok && res.items.length > 0) {
      setCatalogoVariedades(res.items);
      if (Array.isArray(res.categoriasColores) && res.categoriasColores.length > 0) {
        setCategoriasColores(res.categoriasColores);
      }
      setMigracionCatalogoPendiente(Boolean(res.migracionPendiente));
    }
  }, [negNorm]);

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await obtenerInventarioRosasAction(negNorm);
    setCargando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setUltimoCorte(res.ultimoCorte);
    setHistorial(res.historial);
    setMigracionPendiente(Boolean(res.migracionPendiente));
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ultimoCorte: res.ultimoCorte, historial: res.historial })
      );
    } catch {
      // Ignorar cuota localStorage
    }
  }, [negNorm, cacheKey]);

  useEffect(() => {
    void cargarCatalogo();
    void cargarConfigOferta();
  }, [cargarCatalogo, cargarConfigOferta]);

  useEffect(() => {
    if (!ultimoCorteInicial && historialInicial.length === 0) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            ultimoCorte?: CorteInventarioRosas | null;
            historial?: CorteInventarioRosas[];
          };
          if (parsed.ultimoCorte) setUltimoCorte(parsed.ultimoCorte);
          if (Array.isArray(parsed.historial)) setHistorial(parsed.historial);
        }
      } catch {
        // Ignorar caché corrupto
      }
      void recargar();
    } else {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ ultimoCorte: ultimoCorteInicial, historial: historialInicial })
        );
      } catch {
        // Ignorar
      }
    }
  }, [ultimoCorteInicial, historialInicial, cacheKey, recargar]);

  // Mantener variedad por defecto preseleccionada al cambiar color en el formulario manual
  useEffect(() => {
    if (manualTipoFlor === "rosa") {
      const def = obtenerVariedadDefectoPorColor(catalogoVariedades, manualColor);
      setManualVariedadId(def?.id ?? "");
    }
  }, [manualTipoFlor, manualColor, catalogoVariedades]);

  useEffect(() => {
    if (inlineTipoFlor === "rosa") {
      const def = obtenerVariedadDefectoPorColor(catalogoVariedades, inlineColor);
      setInlineVariedadId(def?.id ?? "");
    }
  }, [inlineTipoFlor, inlineColor, catalogoVariedades]);

  const consolidadoEnCurso = useMemo(
    () => consolidarVariedadesDesdeFotos(fotosActuales, catalogoVariedades),
    [fotosActuales, catalogoVariedades]
  );

  const consolidadoUltimoCorte = useMemo(
    () =>
      ultimoCorte
        ? consolidarVariedadesDesdeFotos(ultimoCorte.fotos || [], catalogoVariedades)
        : null,
    [ultimoCorte, catalogoVariedades]
  );

  const vigenciaInventario = useMemo(
    () =>
      evaluarVigenciaInventarioRosas(
        ultimoCorte?.fechaCorte ?? null,
        HORAS_LIMITE_ALERTA_INVENTARIO_ROSAS
      ),
    [ultimoCorte?.fechaCorte]
  );

  const stockPorColorUltimoCorte = useMemo(() => {
    const mapa = new Map<string, number>();
    const raw = ultimoCorte?.resumenColores ?? {};
    for (const [k, v] of Object.entries(raw)) {
      const kLow = k.trim().toLowerCase();
      if (kLow === "girasol" || kLow === "girasoles" || kLow.startsWith("orquidea_")) continue;
      const clave = normalizarClaveColorRosaPersonalizacion(k);
      const cant = Math.max(0, Math.round(Number(v) || 0));
      if (!clave || cant <= 0) continue;
      mapa.set(clave, (mapa.get(clave) ?? 0) + cant);
    }
    return mapa;
  }, [ultimoCorte?.resumenColores]);

  const stockGirasolesUltimoCorte = useMemo(() => {
    if (consolidadoUltimoCorte && consolidadoUltimoCorte.totalGirasoles > 0) {
      return consolidadoUltimoCorte.totalGirasoles;
    }
    const raw = ultimoCorte?.resumenColores ?? {};
    return Math.max(0, Math.round(Number(raw.girasol ?? raw.girasoles ?? 0) || 0));
  }, [consolidadoUltimoCorte, ultimoCorte?.resumenColores]);

  const stockOrquideasPorColorUltimoCorte = useMemo(() => {
    const mapa = new Map<string, number>();
    if (consolidadoUltimoCorte) {
      for (const item of consolidadoUltimoCorte.resumenVariedades) {
        if (item.tipoFlor !== "orquidea") continue;
        const cl = normalizarColorOrquideaClave(item.colorClave);
        const unid = Math.max(0, Math.round(Number(item.numeroFlores ?? item.cantidad) || 0));
        if (cl && unid > 0) {
          mapa.set(cl, (mapa.get(cl) ?? 0) + unid);
        }
      }
    }
    if (mapa.size === 0) {
      const raw = ultimoCorte?.resumenColores ?? {};
      for (const [k, v] of Object.entries(raw)) {
        const kLow = k.trim().toLowerCase();
        if (!kLow.startsWith("orquidea_")) continue;
        const cl = normalizarColorOrquideaClave(kLow.slice(9));
        const unid = Math.max(0, Math.round(Number(v) || 0));
        if (cl && unid > 0) {
          mapa.set(cl, (mapa.get(cl) ?? 0) + unid);
        }
      }
    }
    return mapa;
  }, [consolidadoUltimoCorte, ultimoCorte?.resumenColores]);

  const obtenerEtiquetaClaveOferta = useCallback(
    (clave: string): string => {
      if (clave === "girasol") return "Girasoles";
      if (clave.startsWith("orquidea_")) {
        const cOrq = normalizarColorOrquideaClave(clave.slice(9));
        const defOrq = COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === cOrq);
        return defOrq?.etiqueta || `Orquídea ${cOrq}`;
      }
      return categoriasColores.find((c) => c.clave === clave)?.etiqueta || clave;
    },
    [categoriasColores]
  );

  const obtenerColorHexClaveOferta = useCallback(
    (clave: string): string => {
      if (clave === "girasol") return "#EAB308";
      if (clave.startsWith("orquidea_")) {
        const cOrq = normalizarColorOrquideaClave(clave.slice(9));
        return COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === cOrq)?.colorHex || "#A855F7";
      }
      return categoriasColores.find((c) => c.clave === clave)?.colorHex || "#94A3B8";
    },
    [categoriasColores]
  );

  const toggleColorOferta = (claveRaw: string) => {
    const clave = normalizarClaveOfertaInventario(claveRaw);
    if (!clave) return;
    setMensajeOfertaOk(null);
    setErrorOfertaMsg(null);
    setDescuentosOfertaPorClave((prev) => {
      const copia = { ...prev };
      if (copia[clave] && copia[clave] > 0) {
        delete copia[clave];
      } else {
        copia[clave] = 10;
        if (!ofertaActiva) {
          setOfertaActiva(true);
        }
      }
      return copia;
    });
  };

  const actualizarPorcentajeOfertaClave = (clave: string, valor: number) => {
    const pct = Math.round(Math.min(80, Math.max(1, Number(valor) || 1)) * 100) / 100;
    setMensajeOfertaOk(null);
    setErrorOfertaMsg(null);
    setDescuentosOfertaPorClave((prev) => ({
      ...prev,
      [clave]: pct,
    }));
  };

  const handleGuardarOfertaColores = async () => {
    setGuardandoOferta(true);
    setMensajeOfertaOk(null);
    setErrorOfertaMsg(null);
    const descuentosLimpios: Record<string, number> = {};
    for (const [k, v] of Object.entries(descuentosOfertaPorClave)) {
      const cl = normalizarClaveOfertaInventario(k);
      const num = Math.round(Math.min(80, Math.max(0, Number(v) || 0)) * 100) / 100;
      if (cl && num > 0) {
        descuentosLimpios[cl] = num;
      }
    }
    const listaClaves = Object.keys(descuentosLimpios);
    const primerPct = listaClaves.length > 0 ? descuentosLimpios[listaClaves[0]!] ?? 10 : 10;

    const res = await guardarColoresOfertaInventarioAction({
      negocio: negNorm,
      activo: ofertaActiva && listaClaves.length > 0,
      porcentajeDescuento: primerPct,
      colores: listaClaves,
      descuentosPorColor: descuentosLimpios,
    });
    setGuardandoOferta(false);
    if (!res.ok) {
      setErrorOfertaMsg(res.error);
      return;
    }
    setOfertaActiva(res.oferta.activo);
    setDescuentosOfertaPorClave(res.oferta.descuentosPorColor || descuentosLimpios);
    const totalAct = Object.keys(res.oferta.descuentosPorColor || descuentosLimpios).length;
    setMensajeOfertaOk(
      res.oferta.activo
        ? `Oferta guardada para ${totalAct} color(es)/flor(es) con su descuento individual en tienda.`
        : "Ofertas desactivadas en la tienda."
    );
  };

  const handleAlertarEquipoAhora = async () => {
    setEnviandoAlertaEquipo(true);
    setMensajeAlertaEquipo(null);
    setErrorAlertaEquipo(null);
    const res = await verificarYAlertarInventarioRosasAction(negNorm, {
      horasLimite: HORAS_LIMITE_ALERTA_INVENTARIO_ROSAS,
      cooldownHoras: 0.5,
      forzar: true,
    });
    setEnviandoAlertaEquipo(false);
    if (!res.ok) {
      setErrorAlertaEquipo(res.error || "No se pudo enviar la alerta al equipo.");
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("eco:refrescar-notificaciones"));
    }
    setMensajeAlertaEquipo(
      res.pushEnviados > 0
        ? `Alerta enviada al equipo (campana + ${res.pushEnviados} notificación push).`
        : "Alerta registrada en la campana del equipo."
    );
  };

  const analizarFotoIndividualConIa = async (fotoId: string, urlPublica: string) => {
    setAnalizandoFotoIds((prev) => ({ ...prev, [fotoId]: true }));
    const resIa = await analizarFotoBonchesConAriaAction(negNorm, urlPublica);
    setAnalizandoFotoIds((prev) => ({ ...prev, [fotoId]: false }));

    if (resIa.ok) {
      const itemsFinales =
        resIa.itemsVariedad && resIa.itemsVariedad.length > 0
          ? resIa.itemsVariedad
          : convertirConteoColoresAItemsVariedad(resIa.conteoColores, catalogoVariedades, "ia");

      setFotosActuales((prev) =>
        prev.map((f) =>
          f.id === fotoId
            ? {
                ...f,
                itemsVariedad: itemsFinales.length > 0 ? itemsFinales : f.itemsVariedad ?? [],
                conteoColores:
                  itemsFinales.length > 0
                    ? calcularResumenColoresDesdeItems(itemsFinales)
                    : f.conteoColores,
                notaIa:
                  resIa.notaIa ||
                  (itemsFinales.length > 0
                    ? "Conteo detectado por ARIA Visión (variedades por defecto asignadas)"
                    : "ARIA revisó la imagen; agrega o ajusta las variedades abajo."),
                analizadoPorIa: true,
              }
            : f
        )
      );
    } else {
      setFotosActuales((prev) =>
        prev.map((f) =>
          f.id === fotoId
            ? {
                ...f,
                notaIa: resIa.error,
                analizadoPorIa: false,
              }
            : f
        )
      );
    }
  };

  const handleSeleccionarFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const listaArchivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (listaArchivos.length === 0) return;

    setErrorMsg(null);
    setMensajeExito(null);
    setSubiendoFotos(true);

    const supabase = crearClienteNavegador();
    const nuevasFotos: FotoConteoBonches[] = [];

    for (const archivo of listaArchivos) {
      try {
        const comprimida = await comprimirYEstamparFotoArchivo(archivo, 1400, 0.84, null);
        const blob = dataUrlABlob(comprimida);
        const subida = await subirArchivoOperativoStorage(
          supabase,
          "inventario-rosas",
          negNorm,
          blob,
          "jpg",
          "image/jpeg"
        );

        const idLocal = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const urlFinal = subida.ok ? subida.publicUrl : comprimida;

        nuevasFotos.push({
          id: idLocal,
          imagenUrl: urlFinal,
          nombreArchivo: archivo.name,
          conteoColores: {},
          itemsVariedad: [],
          notaIa: subida.ok
            ? "Analizando paquetes y flores con ARIA..."
            : `Cargada localmente (${subida.error}). Agrega cantidades abajo.`,
          analizadoPorIa: false,
        });
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "No se pudo procesar una de las fotografías"
        );
      }
    }

    setSubiendoFotos(false);
    if (nuevasFotos.length === 0) return;

    setFotosActuales((prev) => [...prev, ...nuevasFotos]);

    await Promise.all(
      nuevasFotos
        .filter((f) => /^https?:\/\//i.test(f.imagenUrl))
        .map((f) => analizarFotoIndividualConIa(f.id, f.imagenUrl))
    );
  };

  const actualizarItemsDeFoto = (
    fotoId: string,
    transformar: (items: ItemConteoVariedad[]) => ItemConteoVariedad[]
  ) => {
    setFotosActuales((prev) =>
      prev.map((f) => {
        if (f.id !== fotoId) return f;
        const actuales =
          f.itemsVariedad && f.itemsVariedad.length > 0
            ? f.itemsVariedad
            : convertirConteoColoresAItemsVariedad(f.conteoColores, catalogoVariedades, "manual");
        const siguientes = transformar(actuales);
        return {
          ...f,
          itemsVariedad: siguientes,
          conteoColores: calcularResumenColoresDesdeItems(siguientes),
        };
      })
    );
  };

  const handleCambiarCantidadItem = (fotoId: string, itemId: string, delta: number) => {
    actualizarItemsDeFoto(fotoId, (items) =>
      items
        .map((it) =>
          it.id === itemId ? { ...it, cantidad: Math.max(0, (Number(it.cantidad) || 0) + delta) } : it
        )
        .filter((it) => it.cantidad > 0 || (it.tipoFlor === "orquidea" && (it.numeroFlores ?? 0) > 0))
    );
  };

  const handleFijarCantidadItem = (fotoId: string, itemId: string, valor: number) => {
    const limpio = Math.max(0, Math.min(999, Math.round(Number(valor) || 0)));
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, cantidad: limpio } : it))
    );
  };

  const handleCambiarFloresOrquidea = (fotoId: string, itemId: string, delta: number) => {
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) =>
        it.id === itemId
          ? { ...it, numeroFlores: Math.max(0, (Number(it.numeroFlores) || 0) + delta) }
          : it
      )
    );
  };

  const handleFijarFloresOrquidea = (fotoId: string, itemId: string, valor: number) => {
    const limpio = Math.max(0, Math.min(999, Math.round(Number(valor) || 0)));
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, numeroFlores: limpio } : it))
    );
  };

  const handleQuitarFotoConDeshacer = (foto: FotoConteoBonches, indice: number) => {
    setFotosActuales((prev) => prev.filter((x) => x.id !== foto.id));
    setFotoEliminadaReciente({ foto, indice });
  };

  const handleDeshacerQuitarFoto = () => {
    if (!fotoEliminadaReciente) return;
    const { foto, indice } = fotoEliminadaReciente;
    setFotosActuales((prev) => {
      if (prev.some((f) => f.id === foto.id)) return prev;
      const copia = [...prev];
      copia.splice(Math.min(indice, copia.length), 0, foto);
      return copia;
    });
    setFotoEliminadaReciente(null);
  };

  const handleCambiarVariedadItem = (fotoId: string, itemId: string, nuevaVariedadId: string) => {
    const ref = catalogoVariedades.find((v) => v.id === nuevaVariedadId);
    if (!ref) return;
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              variedadId: ref.id,
              variedadNombre: ref.nombre,
              imagenUrl: ref.imagenUrl,
              colorClave: ref.colorClave,
            }
          : it
      )
    );
  };

  const handleCambiarColorOrquideaItem = (fotoId: string, itemId: string, nuevoColor: string) => {
    const claveNorm = normalizarColorOrquideaClave(nuevoColor);
    const def = COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === claveNorm);
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              colorClave: claveNorm,
              variedadNombre: def?.etiqueta ?? `Orquídea ${claveNorm}`,
            }
          : it
      )
    );
  };

  const handleEliminarItem = (fotoId: string, itemId: string) => {
    actualizarItemsDeFoto(fotoId, (items) => items.filter((it) => it.id !== itemId));
  };

  const construirNuevoItem = (
    tipo: TipoFlorInventario,
    color: string,
    variedadId: string,
    cantidad: number,
    numeroFlores: number
  ): ItemConteoVariedad => {
    if (tipo === "girasol") {
      return {
        id: `man-gir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipoFlor: "girasol",
        colorClave: "girasol",
        variedadNombre: "Girasoles",
        cantidad: Math.max(1, Math.round(cantidad || 1)),
        origen: "manual",
      };
    }

    if (tipo === "orquidea") {
      const claveNorm = normalizarColorOrquideaClave(color);
      const defOrq =
        COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === claveNorm) ??
        COLORES_ORQUIDEA_CYMBIDIUM[0]!;
      return {
        id: `man-orq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipoFlor: "orquidea",
        colorClave: defOrq.clave,
        variedadNombre: defOrq.etiqueta,
        cantidad: Math.max(1, Math.round(cantidad || 1)),
        numeroFlores: Math.max(1, Math.round(numeroFlores || 8)),
        origen: "manual",
      };
    }

    const ref =
      catalogoVariedades.find((v) => v.id === variedadId) ??
      obtenerVariedadDefectoPorColor(catalogoVariedades, color);
    return {
      id: `man-rosa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipoFlor: "rosa",
      colorClave: ref?.colorClave ?? color,
      variedadId: ref?.id,
      variedadNombre: ref?.nombre ?? color,
      imagenUrl: ref?.imagenUrl,
      cantidad: Math.max(1, Math.round(cantidad || 1)),
      origen: "manual",
    };
  };

  const handleAgregarPaqueteManualSinFoto = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevoItem = construirNuevoItem(
      manualTipoFlor,
      manualColor,
      manualVariedadId,
      manualCantidad,
      manualNumeroFlores
    );

    setFotosActuales((prev) => {
      const idxManual = prev.findIndex((f) => f.esManual || !f.imagenUrl);
      if (idxManual >= 0) {
        return prev.map((f, idx) => {
          if (idx !== idxManual) return f;
          const items = [...(f.itemsVariedad ?? []), nuevoItem];
          return {
            ...f,
            esManual: true,
            itemsVariedad: items,
            conteoColores: calcularResumenColoresDesdeItems(items),
          };
        });
      }
      const items = [nuevoItem];
      return [
        ...prev,
        {
          id: `manual-${Date.now()}`,
          imagenUrl: "",
          nombreArchivo: "Paquetes agregados manualmente (sin foto)",
          esManual: true,
          itemsVariedad: items,
          conteoColores: calcularResumenColoresDesdeItems(items),
          notaIa: "Paquetes / orquídeas ingresados manualmente que no aparecen en las fotos",
          analizadoPorIa: false,
        },
      ];
    });

    setManualCantidad(1);
    setMensajeExito(
      nuevoItem.tipoFlor === "orquidea"
        ? `Agregado manualmente: ${nuevoItem.numeroFlores ?? nuevoItem.cantidad} ${nuevoItem.variedadNombre}.`
        : nuevoItem.tipoFlor === "girasol"
          ? `Agregado manualmente: ${nuevoItem.cantidad} Girasoles.`
          : `Agregado manualmente: ${nuevoItem.cantidad} ${nuevoItem.variedadNombre}.`
    );
  };

  const handleAgregarItemEnFoto = (fotoId: string) => {
    const nuevoItem = construirNuevoItem(
      inlineTipoFlor,
      inlineColor,
      inlineVariedadId,
      inlineCantidad,
      inlineNumeroFlores
    );
    actualizarItemsDeFoto(fotoId, (items) => [...items, nuevoItem]);
    setFotoAgregandoId(null);
    setInlineCantidad(1);
  };

  const handleGuardarInventario = async () => {
    if (fotosActuales.length === 0) {
      setErrorMsg("Adjunta al menos una foto o agrega paquetes manualmente.");
      return;
    }
    setGuardando(true);
    setErrorMsg(null);
    setMensajeExito(null);

    const fotosNormalizadas = fotosActuales.map((f) => {
      const items =
        f.itemsVariedad && f.itemsVariedad.length > 0
          ? f.itemsVariedad
          : convertirConteoColoresAItemsVariedad(f.conteoColores, catalogoVariedades, "manual");
      return {
        ...f,
        itemsVariedad: items,
        conteoColores: calcularResumenColoresDesdeItems(items),
      };
    });

    const res = await guardarCorteInventarioRosasAction({
      negocio: negNorm,
      resumenColores: consolidadoEnCurso.resumenColores,
      fotos: fotosNormalizadas,
      observaciones,
    });

    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    const nuevoHistorial = [res.corte, ...historial.filter((h) => h.id !== res.corte.id)];
    setUltimoCorte(res.corte);
    setHistorial(nuevoHistorial);
    setFotosActuales([]);
    setObservaciones("");
    setMostrarPanelManual(false);
    setMensajeExito(
      `Inventario publicado: ${formatearFechaCorteInventario(res.corte.fechaCorte)} (${consolidadoEnCurso.totalPaquetes} paq. rosas${consolidadoEnCurso.totalGirasoles > 0 ? `, ${consolidadoEnCurso.totalGirasoles} girasoles` : ""}${consolidadoEnCurso.totalFloresOrquidea > 0 ? `, ${consolidadoEnCurso.totalFloresOrquidea} orquídeas` : ""}).`
    );

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ultimoCorte: res.corte, historial: nuevoHistorial })
      );
      window.dispatchEvent(new CustomEvent("eco:inventario-rosas-actualizado"));
    } catch {
      // Ignorar
    }
  };

  const columnasHistorial = useMemo<ColumnaDataGrid<CorteInventarioRosas>[]>(
    () => [
      {
        id: "fecha",
        encabezado: "Fecha y Hora del Corte",
        valor: (c) => new Date(c.fechaCorte).getTime(),
        render: (c) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1F1C19" }}>
              {formatearFechaCorteInventario(c.fechaCorte)}
            </strong>
            <span style={{ fontSize: "0.72rem", color: "#847D74" }}>
              Por: {c.registradoNombre}
            </span>
          </div>
        ),
      },
      {
        id: "total",
        encabezado: "Total",
        valor: (c) => Number(c.totalPaquetes) || 0,
        render: (c) => {
          const cons = consolidarVariedadesDesdeFotos(c.fotos || [], catalogoVariedades);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2.5px 8px",
                  borderRadius: "999px",
                  background: "#F2F6F3",
                  border: "1px solid #CEDDD3",
                  color: "#2B4A36",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  width: "fit-content",
                }}
              >
                {cons.totalPaquetes > 0 ? cons.totalPaquetes : c.totalPaquetes} paq.
              </span>
              {cons.totalGirasoles > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "#FEFCE8",
                    border: "1px solid #FDE047",
                    color: "#854D0E",
                    fontWeight: 600,
                    fontSize: "0.71rem",
                    width: "fit-content",
                  }}
                >
                  🌻 {cons.totalGirasoles} girasoles
                </span>
              )}
              {cons.totalFloresOrquidea > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "#FAF5FF",
                    border: "1px solid #E9D5FF",
                    color: "#6B21A8",
                    fontWeight: 600,
                    fontSize: "0.71rem",
                    width: "fit-content",
                  }}
                >
                  🌺 {cons.totalFloresOrquidea} orquídeas
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "desglose",
        encabezado: "Consolidado por Variedad",
        valor: (c) => formatearTextoConsolidadoVariedades(c, catalogoVariedades),
        render: (c) => (
          <span style={{ fontSize: "0.8rem", color: "#3A3530" }}>
            {formatearTextoConsolidadoVariedades(c, catalogoVariedades)}
          </span>
        ),
      },
      {
        id: "fotos",
        encabezado: "Fotos / Manual",
        valor: (c) => (Array.isArray(c.fotos) ? c.fotos.length : 0),
        render: (c) => {
          const fotosConImg = Array.isArray(c.fotos)
            ? c.fotos.filter((f) => f.imagenUrl).length
            : 0;
          const lotesManuales = Array.isArray(c.fotos)
            ? c.fotos.filter((f) => !f.imagenUrl).length
            : 0;
          return (
            <span style={{ fontSize: "0.76rem", color: "#6E6861" }}>
              {fotosConImg} foto(s){lotesManuales > 0 ? ` + ${lotesManuales} manual` : ""}
            </span>
          );
        },
      },
    ],
    [catalogoVariedades]
  );

  const variedadesColorManual = useMemo(
    () => obtenerVariedadesPorColor(catalogoVariedades, manualColor),
    [catalogoVariedades, manualColor]
  );

  const variedadesColorInline = useMemo(
    () => obtenerVariedadesPorColor(catalogoVariedades, inlineColor),
    [catalogoVariedades, inlineColor]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <style>{`@media (max-width: 767px) { .eco-inv-tabs-desktop { display: none !important; } }`}</style>

      {/* BARRA DE PESTAÑAS SOLO EN ESCRITORIO/TABLET (>=768px). En móvil vista simple directa. */}
      {!esMovil && (
        <div
          className="eco-inv-tabs-desktop"
          style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}
        >
          <button
            type="button"
            onClick={() => setPestanaActiva("conteo")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              borderRadius: "8px",
              border: pestanaActiva === "conteo" ? "1px solid #221E1B" : "1px solid #D5CFC4",
              background: pestanaActiva === "conteo" ? "#221E1B" : "#FFFFFF",
              color: pestanaActiva === "conteo" ? "#FAF8F5" : "#57524C",
              fontSize: "0.79rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Camera size={14} />
            <span>Conteo e Inventario</span>
          </button>

          <button
            type="button"
            onClick={() => setPestanaActiva("catalogo")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              borderRadius: "8px",
              border: pestanaActiva === "catalogo" ? "1px solid #221E1B" : "1px solid #D5CFC4",
              background: pestanaActiva === "catalogo" ? "#221E1B" : "#FFFFFF",
              color: pestanaActiva === "catalogo" ? "#FAF8F5" : "#57524C",
              fontSize: "0.79rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <BookOpen size={14} />
            <span>Catálogo Variedades ({catalogoVariedades.length})</span>
          </button>
        </div>
      )}

      {!esMovil && pestanaActiva === "catalogo" ? (
        <CatalogoVariedadesRosas
          negocio={negNorm}
          catalogo={catalogoVariedades}
          onCatalogoActualizado={(nuevo) => setCatalogoVariedades(nuevo)}
          categoriasColores={categoriasColores}
          onCategoriasActualizadas={setCategoriasColores}
          migracionPendiente={migracionCatalogoPendiente}
        />
      ) : (
        <>
          {/* ALERTA AUTOMÁTICA SI HAN PASADO > 15 HORAS SIN INVENTARIO */}
          {vigenciaInventario.requiereAlerta && (
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#FFFBEB",
                border: "1.5px solid #F59E0B",
                color: "#78350F",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
                boxSizing: "border-box",
                maxWidth: "100%",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  flex: "1 1 200px",
                  minWidth: 0,
                  maxWidth: "100%",
                }}
              >
                <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    flex: 1,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  <strong style={{ fontSize: "0.85rem", color: "#92400E", lineHeight: 1.35 }}>
                    {vigenciaInventario.horasDesdeUltimoCorte === null
                      ? "Inventario de rosas pendiente (sin registro previo)"
                      : `Han pasado ${vigenciaInventario.horasDesdeUltimoCorte}h desde el último inventario (límite ${vigenciaInventario.horasLimite}h)`}
                  </strong>
                  <span style={{ fontSize: "0.76rem", color: "#78350F", lineHeight: 1.4 }}>
                    Registra un nuevo conteo de bonches hoy para que la tienda muestre los colores disponibles en tiempo real.
                  </span>
                  {mensajeAlertaEquipo && (
                    <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#2B4A36", marginTop: "2px", lineHeight: 1.35 }}>
                      ✓ {mensajeAlertaEquipo}
                    </span>
                  )}
                  {errorAlertaEquipo && (
                    <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#991B1B", marginTop: "2px", lineHeight: 1.35 }}>
                      ⚠ {errorAlertaEquipo}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleAlertarEquipoAhora()}
                disabled={enviandoAlertaEquipo}
                title="Enviar notificación Push y alerta en campana a todo el equipo"
                aria-label="Notificar equipo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "9px",
                  border: "1px solid #D97706",
                  background: "#FFFFFF",
                  color: "#92400E",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: enviandoAlertaEquipo ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {enviandoAlertaEquipo ? <Loader2 size={14} /> : <Bell size={14} />}
                <span>Notificar equipo</span>
              </button>
            </div>
          )}

          {/* CABECERA SOBRIA DEL ÚLTIMO INVENTARIO REALIZADO */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "#FFFFFF",
              border: "1px solid #E6E2DA",
              borderLeft: "3px solid #2F4737",
              color: "#1F1C19",
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
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "8px",
                    background: "#F6F4F0",
                    border: "1px solid #E6E2DA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2F4737",
                    flexShrink: 0,
                  }}
                >
                  <Flower2 size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "#847D74",
                      fontWeight: 600,
                    }}
                  >
                    Último inventario en tienda
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, marginTop: "2px", color: "#1F1C19", lineHeight: 1.35 }}>
                    {ultimoCorte ? (
                      <>
                        <span style={{ color: "#2F4737" }}>
                          {formatearFechaCorteInventario(ultimoCorte.fechaCorte)}
                        </span>
                        {" · "}
                        <span>
                          {formatearTextoConsolidadoVariedades(ultimoCorte, catalogoVariedades)}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "#6E6861", fontWeight: 500 }}>
                        Aún no se ha registrado un corte de inventario fotográfico
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                {ultimoCorte && (
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: "#F2F6F3",
                      border: "1px solid #CEDDD3",
                      color: "#2B4A36",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                    }}
                  >
                    Rosas:{" "}
                    {consolidadoUltimoCorte && consolidadoUltimoCorte.totalPaquetes > 0
                      ? consolidadoUltimoCorte.totalPaquetes
                      : ultimoCorte.totalPaquetes}{" "}
                    paq.
                  </div>
                )}
                {consolidadoUltimoCorte && consolidadoUltimoCorte.totalGirasoles > 0 && (
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: "#FEFCE8",
                      border: "1px solid #FDE047",
                      color: "#854D0E",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                    }}
                  >
                    🌻 Girasoles: {consolidadoUltimoCorte.totalGirasoles} unid.
                  </div>
                )}
                {consolidadoUltimoCorte && consolidadoUltimoCorte.totalFloresOrquidea > 0 && (
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: "#FAF5FF",
                      border: "1px solid #E9D5FF",
                      color: "#6B21A8",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                    }}
                  >
                    🌺 Orquídeas: {consolidadoUltimoCorte.totalFloresOrquidea} unid.
                  </div>
                )}
                <button
                  type="button"
                  className="btn-responsive-accion"
                  onClick={() => void recargar()}
                  title="Actualizar último inventario"
                  aria-label="Actualizar"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#221E1B",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {cargando ? <Loader2 size={13} /> : <RefreshCw size={13} />}
                  <span className="btn-texto-responsive">Actualizar</span>
                </button>
              </div>
            </div>

            {ultimoCorte && consolidadoUltimoCorte && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #F1EEE8" }}>
                {consolidadoUltimoCorte.resumenVariedades.map((item, idx) => {
                  const colInfo =
                    item.tipoFlor === "orquidea"
                      ? COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === item.colorClave)
                      : item.tipoFlor === "girasol"
                        ? { colorHex: "#EAB308" }
                        : categoriasColores.find((c) => c.clave === item.colorClave);
                  return (
                    <span
                      key={`${item.tipoFlor}-${item.colorClave}-${item.variedadNombre}-${idx}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        background:
                          item.tipoFlor === "girasol"
                            ? "#FEFCE8"
                            : item.tipoFlor === "orquidea"
                              ? "#FAF5FF"
                              : "#F8F7F4",
                        border:
                          item.tipoFlor === "girasol"
                            ? "1px solid #FDE047"
                            : item.tipoFlor === "orquidea"
                              ? "1px solid #E9D5FF"
                              : "1px solid #E6E2DA",
                        color: "#2E2A26",
                        fontSize: "0.74rem",
                        fontWeight: 500,
                      }}
                    >
                      {item.imagenUrl ? (
                        <img
                          src={item.imagenUrl}
                          alt={item.variedadNombre}
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid #D5CFC4",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: colInfo?.colorHex ?? "#847D74",
                            border: "1px solid rgba(0,0,0,0.18)",
                          }}
                        />
                      )}
                      {item.tipoFlor === "orquidea"
                        ? `${item.numeroFlores ?? item.cantidad} ${item.variedadNombre}`
                        : item.tipoFlor === "girasol"
                          ? `${item.cantidad} Girasoles`
                          : `${item.cantidad} ${item.variedadNombre}`}
                    </span>
                  );
                })}
                <span style={{ fontSize: "0.72rem", color: "#847D74", marginLeft: "4px" }}>
                  <Clock size={11} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                  Registrado por {ultimoCorte.registradoNombre}
                </span>
              </div>
            )}
          </div>

          {/* PANEL DE COLORES Y FLORES EN OFERTA CON % INDIVIDUAL POR COLOR/FLOR */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "#FFFFFF",
              border: ofertaActiva && clavesOfertaActivas.length > 0 ? "1.5px solid #FBCFE8" : "1px solid #E6E2DA",
              borderLeft: ofertaActiva && clavesOfertaActivas.length > 0 ? "3px solid #BE185D" : "3px solid #D5CFC4",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxSizing: "border-box",
              maxWidth: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0, flex: "1 1 220px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: ofertaActiva ? "#FDF2F8" : "#F6F4F0",
                    border: ofertaActiva ? "1px solid #FBCFE8" : "1px solid #E6E2DA",
                    color: ofertaActiva ? "#BE185D" : "#57524C",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Tag size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: "0.86rem", color: "#1F1C19" }}>
                    Colores y Flores en Oferta en Tienda
                  </strong>
                  <span style={{ fontSize: "0.73rem", color: "#6E6861", lineHeight: 1.38 }}>
                    Define un porcentaje de descuento por cada color de rosa, girasoles u orquídeas. Al elegirlos en la tienda, el descuento se aplica automáticamente.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "6px 11px",
                    borderRadius: "999px",
                    background: ofertaActiva ? "#FDF2F8" : "#F4F2EE",
                    border: ofertaActiva ? "1px solid #FBCFE8" : "1px solid #D5CFC4",
                    color: ofertaActiva ? "#9D174D" : "#57524C",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ofertaActiva}
                    onChange={(e) => {
                      setOfertaActiva(e.target.checked);
                      setMensajeOfertaOk(null);
                      setErrorOfertaMsg(null);
                    }}
                  />
                  <span>{ofertaActiva ? "Oferta activa" : "Oferta inactiva"}</span>
                </label>

                <button
                  type="button"
                  onClick={() => void handleGuardarOfertaColores()}
                  disabled={guardandoOferta || cargandoOferta}
                  title="Guardar descuentos por color y flor para la tienda web"
                  aria-label="Guardar oferta"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "9px",
                    border: "none",
                    background: "#2F4737",
                    color: "#FFFFFF",
                    fontSize: "0.77rem",
                    fontWeight: 700,
                    cursor: guardandoOferta ? "wait" : "pointer",
                    opacity: guardandoOferta ? 0.7 : 1,
                  }}
                >
                  {guardandoOferta ? <Loader2 size={14} /> : <Save size={14} />}
                  <span>Guardar oferta</span>
                </button>
              </div>
            </div>

            {/* 1. Rosas por color */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#57524C",
                    marginBottom: "6px",
                  }}
                >
                  🌹 Rosas en oferta (toca para activar y ajusta el % abajo):
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {[...categoriasColores]
                    .sort((a, b) => {
                      const sa = stockPorColorUltimoCorte.get(a.clave) ?? 0;
                      const sb = stockPorColorUltimoCorte.get(b.clave) ?? 0;
                      if ((sa > 0) !== (sb > 0)) return sa > 0 ? -1 : 1;
                      return 0;
                    })
                    .map((col) => {
                      const claveNorm = normalizarClaveColorRosaPersonalizacion(col.clave);
                      const enStockCant = stockPorColorUltimoCorte.get(claveNorm) ?? 0;
                      const pctIndiv = descuentosOfertaPorClave[claveNorm] ?? 0;
                      const seleccionado = pctIndiv > 0;
                      return (
                        <button
                          key={col.clave}
                          type="button"
                          onClick={() => toggleColorOferta(claveNorm)}
                          aria-pressed={seleccionado}
                          title={
                            enStockCant > 0
                              ? `${col.etiqueta} (${enStockCant} paq. en inventario) — clic para ${seleccionado ? "quitar de" : "marcar en"} oferta`
                              : `${col.etiqueta} (sin stock en el último corte)`
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 11px",
                            borderRadius: "999px",
                            border: seleccionado
                              ? "2px solid #9D174D"
                              : enStockCant > 0
                                ? "1px solid #CEDDD3"
                                : "1px dashed #D5CFC4",
                            background: seleccionado
                              ? "#BE185D"
                              : enStockCant > 0
                                ? "#FFFFFF"
                                : "#FAF8F5",
                            color: seleccionado ? "#FFFFFF" : enStockCant > 0 ? "#1F1C19" : "#847D74",
                            fontSize: "0.75rem",
                            fontWeight: seleccionado ? 700 : 600,
                            cursor: "pointer",
                            opacity: !seleccionado && ultimoCorte && enStockCant === 0 ? 0.72 : 1,
                          }}
                        >
                          <span
                            style={{
                              width: "11px",
                              height: "11px",
                              borderRadius: "999px",
                              background: col.colorHex,
                              border: seleccionado ? "1.5px solid #FFFFFF" : "1px solid rgba(0,0,0,0.2)",
                              flexShrink: 0,
                            }}
                          />
                          <span>{col.etiqueta}</span>
                          {enStockCant > 0 && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                color: seleccionado ? "#FCE7F3" : "#2B4A36",
                                fontWeight: 700,
                              }}
                            >
                              ({enStockCant} paq.)
                            </span>
                          )}
                          {seleccionado && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "2px",
                                padding: "1px 6px",
                                borderRadius: "999px",
                                background: "#FFFFFF",
                                color: "#9D174D",
                                fontSize: "0.65rem",
                                fontWeight: 800,
                              }}
                            >
                              -{pctIndiv}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 2. Girasoles y 3. Orquídeas (5 colores) en oferta */}
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#57524C",
                    marginBottom: "6px",
                  }}
                >
                  🌻 Girasoles y 🌺 Orquídeas en oferta:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {/* Chip Girasoles */}
                  {(() => {
                    const pctGir = descuentosOfertaPorClave.girasol ?? 0;
                    const selGir = pctGir > 0;
                    return (
                      <button
                        type="button"
                        onClick={() => toggleColorOferta("girasol")}
                        aria-pressed={selGir}
                        title={
                          stockGirasolesUltimoCorte > 0
                            ? `Girasoles (${stockGirasolesUltimoCorte} unid. en inventario)`
                            : "Girasoles (sin stock registrado en el último corte)"
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 11px",
                          borderRadius: "999px",
                          border: selGir
                            ? "2px solid #9D174D"
                            : stockGirasolesUltimoCorte > 0
                              ? "1px solid #FDE047"
                              : "1px dashed #D5CFC4",
                          background: selGir
                            ? "#BE185D"
                            : stockGirasolesUltimoCorte > 0
                              ? "#FEFCE8"
                              : "#FAF8F5",
                          color: selGir ? "#FFFFFF" : stockGirasolesUltimoCorte > 0 ? "#854D0E" : "#847D74",
                          fontSize: "0.75rem",
                          fontWeight: selGir ? 700 : 600,
                          cursor: "pointer",
                          opacity: !selGir && ultimoCorte && stockGirasolesUltimoCorte === 0 ? 0.78 : 1,
                        }}
                      >
                        <span>🌻</span>
                        <span>Girasoles</span>
                        {stockGirasolesUltimoCorte > 0 && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: selGir ? "#FCE7F3" : "#854D0E",
                              fontWeight: 700,
                            }}
                          >
                            ({stockGirasolesUltimoCorte} unid.)
                          </span>
                        )}
                        {selGir && (
                          <span
                            style={{
                              padding: "1px 6px",
                              borderRadius: "999px",
                              background: "#FFFFFF",
                              color: "#9D174D",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                            }}
                          >
                            -{pctGir}%
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  {/* Chips de las 5 orquídeas: Blanco, Beige, Verde, Amarilla, Lila */}
                  {COLORES_ORQUIDEA_CYMBIDIUM.map((orq) => {
                    const claveOrq = `orquidea_${orq.clave}`;
                    const stockOrq = stockOrquideasPorColorUltimoCorte.get(orq.clave) ?? 0;
                    const pctOrq = descuentosOfertaPorClave[claveOrq] ?? 0;
                    const selOrq = pctOrq > 0;
                    return (
                      <button
                        key={claveOrq}
                        type="button"
                        onClick={() => toggleColorOferta(claveOrq)}
                        aria-pressed={selOrq}
                        title={
                          stockOrq > 0
                            ? `${orq.etiqueta} (${stockOrq} orquídeas en inventario)`
                            : `${orq.etiqueta} (sin stock registrado en el último corte)`
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 11px",
                          borderRadius: "999px",
                          border: selOrq
                            ? "2px solid #9D174D"
                            : stockOrq > 0
                              ? "1px solid #D8B4FE"
                              : "1px dashed #D5CFC4",
                          background: selOrq
                            ? "#BE185D"
                            : stockOrq > 0
                              ? "#FAF5FF"
                              : "#FAF8F5",
                          color: selOrq ? "#FFFFFF" : stockOrq > 0 ? "#581C87" : "#847D74",
                          fontSize: "0.75rem",
                          fontWeight: selOrq ? 700 : 600,
                          cursor: "pointer",
                          opacity: !selOrq && ultimoCorte && stockOrq === 0 ? 0.78 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: "11px",
                            height: "11px",
                            borderRadius: "999px",
                            background: orq.colorHex,
                            border: selOrq ? "1.5px solid #FFFFFF" : "1px solid rgba(0,0,0,0.22)",
                            flexShrink: 0,
                          }}
                        />
                        <span>{orq.etiqueta}</span>
                        {stockOrq > 0 && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: selOrq ? "#FCE7F3" : "#6B21A8",
                              fontWeight: 700,
                            }}
                          >
                            ({stockOrq} unid.)
                          </span>
                        )}
                        {selOrq && (
                          <span
                            style={{
                              padding: "1px 6px",
                              borderRadius: "999px",
                              background: "#FFFFFF",
                              color: "#9D174D",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                            }}
                          >
                            -{pctOrq}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editor individual de % de descuento por cada color o flor seleccionado */}
              {clavesOfertaActivas.length > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#FDF2F8",
                    border: "1px solid #FBCFE8",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#9D174D" }}>
                    Porcentaje de descuento por cada color / flor seleccionado:
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(210px, 100%), 1fr))",
                      gap: "8px",
                    }}
                  >
                    {clavesOfertaActivas.map((clave) => {
                      const pctActual = descuentosOfertaPorClave[clave] ?? 10;
                      const etiqueta = obtenerEtiquetaClaveOferta(clave);
                      const hex = obtenerColorHexClaveOferta(clave);
                      return (
                        <div
                          key={`desc-${clave}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            padding: "6px 9px",
                            borderRadius: "9px",
                            background: "#FFFFFF",
                            border: "1px solid #F9A8D4",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            {clave === "girasol" ? (
                              <span style={{ fontSize: "0.82rem" }}>🌻</span>
                            ) : (
                              <span
                                style={{
                                  width: "11px",
                                  height: "11px",
                                  borderRadius: "999px",
                                  background: hex,
                                  border: "1px solid rgba(0,0,0,0.22)",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#1F1C19",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {etiqueta}
                            </span>
                          </div>

                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                            <input
                              type="number"
                              min={1}
                              max={80}
                              step={1}
                              value={pctActual}
                              onChange={(e) =>
                                actualizarPorcentajeOfertaClave(clave, Number(e.target.value))
                              }
                              aria-label={`Descuento porcentaje para ${etiqueta}`}
                              style={{
                                width: "52px",
                                padding: "3px 5px",
                                borderRadius: "6px",
                                border: "1px solid #D5CFC4",
                                background: "#FAF8F5",
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                color: "#9D174D",
                                textAlign: "center",
                              }}
                            />
                            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#9D174D" }}>%</span>
                            <button
                              type="button"
                              onClick={() => toggleColorOferta(clave)}
                              title={`Quitar ${etiqueta} de la oferta`}
                              aria-label={`Quitar ${etiqueta}`}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "#9D174D",
                                cursor: "pointer",
                                padding: "2px",
                                display: "inline-flex",
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {ofertaActiva && clavesOfertaActivas.length > 0 && (
                <div
                  style={{
                    fontSize: "0.73rem",
                    color: "#2B4A36",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    lineHeight: 1.4,
                  }}
                >
                  🔥 En tienda aplicará automáticamente:{" "}
                  <strong>
                    {clavesOfertaActivas
                      .map((cl) => `${obtenerEtiquetaClaveOferta(cl)} (-${descuentosOfertaPorClave[cl]}%)`)
                      .join(", ")}
                  </strong>{" "}
                  (siempre que conste con stock en el inventario vigente).
                </div>
              )}
              {mensajeOfertaOk && (
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2B4A36" }}>
                  ✓ {mensajeOfertaOk}
                </div>
              )}
              {errorOfertaMsg && (
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#991B1B" }}>
                  ⚠️ {errorOfertaMsg}
                </div>
              )}
            </div>
          </div>

          {migracionPendiente && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "9px",
                background: "#FAF6EE",
                border: "1px solid #E5D7BC",
                color: "#745622",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={15} />
              <span>
                Ejecuta la migración{" "}
                <code>20261115000010_herramientas_taller_inventario_inmediata_y_entregas_iess.sql</code>{" "}
                en Supabase para habilitar la persistencia del inventario.
              </span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: "9px 12px",
                borderRadius: "9px",
                background: "#FAF2F2",
                border: "1px solid #E5CACA",
                color: "#8A2E2E",
                fontSize: "0.79rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {mensajeExito && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "9px 12px",
                borderRadius: "9px",
                background: "#F2F6F3",
                border: "1px solid #CEDDD3",
                color: "#2B4A36",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <CheckCircle2 size={15} />
              <span>{mensajeExito}</span>
            </div>
          )}

          {fotoEliminadaReciente && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "9px 12px",
                borderRadius: "9px",
                background: "#FAF6EE",
                border: "1px solid #E5D7BC",
                color: "#745622",
                fontSize: "0.79rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span>
                Se quitó {fotoEliminadaReciente.foto.esManual || !fotoEliminadaReciente.foto.imagenUrl
                  ? "el lote manual"
                  : `la Foto #${fotoEliminadaReciente.indice + 1}`}.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleDeshacerQuitarFoto}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "7px",
                    border: "1px solid #745622",
                    background: "#FFFFFF",
                    color: "#745622",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Deshacer
                </button>
                <button
                  type="button"
                  onClick={() => setFotoEliminadaReciente(null)}
                  aria-label="Cerrar aviso"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#745622",
                    cursor: "pointer",
                    padding: "2px",
                    display: "inline-flex",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN DE NUEVO CORTE POR FOTOS CON ARIA + MANUALES */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E6E2DA",
              borderRadius: "12px",
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
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "#1F1C19" }}>
                  Nuevo Conteo de Rosas, Girasoles y Orquídeas (ARIA)
                </h2>
              </div>

              <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                <label
                  title="Tomar foto directa de los bonches u orquídeas"
                  aria-label="Tomar foto"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 13px",
                    borderRadius: "8px",
                    border: "1px solid #221E1B",
                    background: "#221E1B",
                    color: "#FAF8F5",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: subiendoFotos ? "wait" : "pointer",
                  }}
                >
                  {subiendoFotos ? <Loader2 size={14} /> : <Camera size={14} />}
                  <span>Tomar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void handleSeleccionarFotos(e)}
                    disabled={subiendoFotos}
                    style={{ display: "none" }}
                  />
                </label>

                <label
                  title="Subir una o varias fotos desde galería o WhatsApp"
                  aria-label="Subir fotos"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 13px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#221E1B",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: subiendoFotos ? "wait" : "pointer",
                  }}
                >
                  {subiendoFotos ? <Loader2 size={14} /> : <Upload size={14} />}
                  <span>Subir Fotos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void handleSeleccionarFotos(e)}
                    disabled={subiendoFotos}
                    style={{ display: "none" }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setMostrarPanelManual((prev) => !prev)}
                  title="Agregar paquetes de rosas u orquídeas que no están en las fotos"
                  aria-label="Agregar manual"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: mostrarPanelManual ? "1px solid #221E1B" : "1px solid #D5CFC4",
                    background: mostrarPanelManual ? "#F1EFEA" : "#FFFFFF",
                    color: "#221E1B",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  <span>Agregar Manual</span>
                </button>
              </div>
            </div>

            {/* PANEL RÁPIDO PARA AGREGAR PAQUETES / ORQUÍDEAS MANUALES (NO EN FOTOS) */}
            {mostrarPanelManual && (
              <form
                onSubmit={handleAgregarPaqueteManualSinFoto}
                style={{
                  padding: "13px 15px",
                  borderRadius: "10px",
                  background: "#F8F7F4",
                  border: "1px solid #E6E2DA",
                  display: "flex",
                  flexDirection: "column",
                  gap: "11px",
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
                  <strong style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1F1C19" }}>
                    Agregar Rosas, Girasoles u Orquídeas Manualmente
                  </strong>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setManualTipoFlor("rosa");
                        setManualColor("rojo");
                        setManualCantidad(1);
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "7px",
                        border: manualTipoFlor === "rosa" ? "1px solid #221E1B" : "1px solid #D5CFC4",
                        background: manualTipoFlor === "rosa" ? "#221E1B" : "#FFFFFF",
                        color: manualTipoFlor === "rosa" ? "#FAF8F5" : "#57524C",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🌹 Rosas (Paq.)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualTipoFlor("girasol");
                        setManualColor("girasol");
                        setManualCantidad(10);
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "7px",
                        border: manualTipoFlor === "girasol" ? "1px solid #854D0E" : "1px solid #D5CFC4",
                        background: manualTipoFlor === "girasol" ? "#854D0E" : "#FFFFFF",
                        color: manualTipoFlor === "girasol" ? "#FEFCE8" : "#57524C",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🌻 Girasoles
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualTipoFlor("orquidea");
                        setManualColor("blanco");
                        setManualCantidad(1);
                        setManualNumeroFlores(9);
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "7px",
                        border: manualTipoFlor === "orquidea" ? "1px solid #6B21A8" : "1px solid #D5CFC4",
                        background: manualTipoFlor === "orquidea" ? "#6B21A8" : "#FFFFFF",
                        color: manualTipoFlor === "orquidea" ? "#FAF5FF" : "#57524C",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🌺 Orquídeas
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "10px",
                    alignItems: "end",
                  }}
                >
                  {manualTipoFlor !== "girasol" && (
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.74rem", fontWeight: 600, color: "#57524C" }}>
                      Color
                      <select
                        value={manualColor}
                        onChange={(e) => setManualColor(e.target.value)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          fontSize: "0.8rem",
                          color: "#1F1C19",
                        }}
                      >
                        {(manualTipoFlor === "orquidea"
                          ? COLORES_ORQUIDEA_CYMBIDIUM
                          : categoriasColores
                        ).map((c) => (
                          <option key={c.clave} value={c.clave}>
                            {c.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {manualTipoFlor === "rosa" && (
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.74rem", fontWeight: 600, color: "#57524C" }}>
                      Variedad
                      <select
                        value={manualVariedadId}
                        onChange={(e) => setManualVariedadId(e.target.value)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          fontSize: "0.8rem",
                          color: "#1F1C19",
                        }}
                      >
                        {variedadesColorManual.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.esDefecto ? `★ ${v.nombre}` : v.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {manualTipoFlor === "orquidea" ? (
                    <>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.74rem", fontWeight: 700, color: "#6B21A8" }}>
                        Nº de Orquídeas (flores)
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={manualNumeroFlores}
                          onChange={(e) =>
                            setManualNumeroFlores(Math.max(1, Number(e.target.value) || 1))
                          }
                          style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1.5px solid #C084FC",
                            background: "#FFFFFF",
                            fontSize: "0.81rem",
                            fontWeight: 700,
                            color: "#581C87",
                          }}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.74rem", fontWeight: 600, color: "#57524C" }}>
                        Varas (opcional)
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={manualCantidad}
                          onChange={(e) => setManualCantidad(Math.max(1, Number(e.target.value) || 1))}
                          style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1px solid #D5CFC4",
                            background: "#FFFFFF",
                            fontSize: "0.81rem",
                            color: "#1F1C19",
                          }}
                        />
                      </label>
                    </>
                  ) : (
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.74rem", fontWeight: 600, color: "#57524C" }}>
                      {manualTipoFlor === "girasol" ? "Nº de Girasoles (unidades)" : "Paquetes (Bonches)"}
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={manualCantidad}
                        onChange={(e) => setManualCantidad(Math.max(1, Number(e.target.value) || 1))}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          fontSize: "0.81rem",
                          color: "#1F1C19",
                        }}
                      />
                    </label>
                  )}

                  <button
                    type="submit"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      padding: "8px 13px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#2F4737",
                      color: "#FFFFFF",
                      fontSize: "0.79rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                    <span>Agregar</span>
                  </button>
                </div>
              </form>
            )}

            {/* TARJETAS INDIVIDUALES POR FOTO O LOTE MANUAL */}
            {fotosActuales.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {fotosActuales.map((foto, idx) => {
                  const analizando = Boolean(analizandoFotoIds[foto.id]);
                  const items =
                    foto.itemsVariedad && foto.itemsVariedad.length > 0
                      ? foto.itemsVariedad
                      : convertirConteoColoresAItemsVariedad(
                          foto.conteoColores,
                          catalogoVariedades,
                          "ia"
                        );
                  const subtotalRosas = items
                    .filter((it) => it.tipoFlor !== "orquidea" && it.tipoFlor !== "girasol")
                    .reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
                  const subtotalGirasoles = items
                    .filter((it) => it.tipoFlor === "girasol")
                    .reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
                  const subtotalOrqFlores = items
                    .filter((it) => it.tipoFlor === "orquidea")
                    .reduce((acc, it) => acc + (Number(it.numeroFlores ?? it.cantidad) || 0), 0);

                  return (
                    <div
                      key={foto.id}
                      style={{
                        border: "1px solid #E6E2DA",
                        borderRadius: "10px",
                        padding: "12px",
                        background: "#F8F7F4",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "12px",
                        alignItems: "flex-start",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      {foto.imagenUrl && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            flex: "1 1 150px",
                            maxWidth: "200px",
                            minWidth: 0,
                          }}
                        >
                          <img
                            src={foto.imagenUrl}
                            alt={`Foto inventario ${idx + 1}`}
                            style={{
                              width: "100%",
                              height: "144px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid #D5CFC4",
                            }}
                          />
                          {/^https?:\/\//i.test(foto.imagenUrl) && (
                            <button
                              type="button"
                              onClick={() => void analizarFotoIndividualConIa(foto.id, foto.imagenUrl)}
                              disabled={analizando}
                              title="Volver a contar esta fotografía con ARIA IA"
                              aria-label="Recontar con IA"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                                padding: "5px 9px",
                                borderRadius: "7px",
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#221E1B",
                                fontSize: "0.73rem",
                                fontWeight: 600,
                                cursor: analizando ? "wait" : "pointer",
                              }}
                            >
                              {analizando ? <Loader2 size={12} /> : <Sparkles size={12} />}
                              <span>{analizando ? "Contando..." : "Recontar IA"}</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "9px",
                          flex: "999 1 250px",
                          minWidth: 0,
                          width: "100%",
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
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1F1C19" }}>
                              {foto.esManual || !foto.imagenUrl
                                ? "Conteo Manual (Sin Foto)"
                                : `Foto #${idx + 1}`}
                              {" — "}
                              {[
                                subtotalRosas > 0 ? `${subtotalRosas} paq. rosas` : "",
                                subtotalGirasoles > 0 ? `${subtotalGirasoles} girasoles` : "",
                                subtotalOrqFlores > 0 ? `${subtotalOrqFlores} orquídeas` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ") || "0"}
                            </strong>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.73rem",
                                color: analizando ? "#2F4737" : "#6E6861",
                              }}
                            >
                              <Bot size={12} />
                              {analizando
                                ? "ARIA analizando rosas y orquídeas..."
                                : foto.notaIa || "Cambia la variedad o ajusta con +/-"}
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() =>
                                setFotoAgregandoId((prev) => (prev === foto.id ? null : foto.id))
                              }
                              title="Agregar otra variedad o color en esta tarjeta"
                              aria-label="Agregar variedad"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 9px",
                                borderRadius: "7px",
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#221E1B",
                                fontSize: "0.73rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Plus size={12} />
                              <span>Variedad</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuitarFotoConDeshacer(foto, idx)}
                              title="Quitar esta foto o lote"
                              aria-label="Quitar"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 9px",
                                borderRadius: "7px",
                                border: "1px solid #E5CACA",
                                background: "#FAF2F2",
                                color: "#8A2E2E",
                                fontSize: "0.73rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={12} />
                              <span>Quitar</span>
                            </button>
                          </div>
                        </div>

                        {/* Lista de variedades detectadas / agregadas con selector de variedad */}
                        {items.length > 0 ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(min(215px, 100%), 1fr))",
                              gap: "8px",
                              minWidth: 0,
                            }}
                          >
                            {items.map((item) => {
                              const esOrq = item.tipoFlor === "orquidea";
                              const esGir = item.tipoFlor === "girasol";
                              const colDef = esOrq
                                ? COLORES_ORQUIDEA_CYMBIDIUM.find(
                                    (c) => c.clave === normalizarColorOrquideaClave(item.colorClave)
                                  )
                                : esGir
                                  ? { etiqueta: "Girasoles", colorHex: "#EAB308" }
                                  : categoriasColores.find((c) => c.clave === item.colorClave);
                              const opcionesVariedad =
                                esOrq || esGir
                                  ? []
                                  : obtenerVariedadesPorColor(catalogoVariedades, item.colorClave);

                              return (
                                <div
                                  key={item.id}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "7px",
                                    padding: "9px 10px",
                                    borderRadius: "9px",
                                    background: "#FFFFFF",
                                    border: "1px solid #E6E2DA",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      justifyContent: "space-between",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                                      {item.imagenUrl ? (
                                        <img
                                          src={item.imagenUrl}
                                          alt={item.variedadNombre}
                                          style={{
                                            width: "32px",
                                            height: "32px",
                                            borderRadius: "7px",
                                            objectFit: "cover",
                                            background: "#1F1C19",
                                            flexShrink: 0,
                                          }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            width: "32px",
                                            height: "32px",
                                            borderRadius: "7px",
                                            background: "#F6F4F0",
                                            border: "1px solid #E6E2DA",
                                            color: "#57524C",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                          }}
                                        >
                                          <Flower2 size={16} />
                                        </div>
                                      )}

                                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1 }}>
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            fontSize: "0.68rem",
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                            color: "#6E6861",
                                          }}
                                        >
                                          <span
                                            style={{
                                              width: "7px",
                                              height: "7px",
                                              borderRadius: "50%",
                                              background: colDef?.colorHex ?? "#847D74",
                                              border: "1px solid rgba(0,0,0,0.14)",
                                              flexShrink: 0,
                                            }}
                                          />
                                          {esOrq ? "Orquídea" : esGir ? "🌻 Girasoles" : colDef?.etiqueta ?? item.colorClave}
                                        </span>

                                        {esOrq ? (
                                          <select
                                            value={normalizarColorOrquideaClave(item.colorClave)}
                                            onChange={(e) =>
                                              handleCambiarColorOrquideaItem(
                                                foto.id,
                                                item.id,
                                                e.target.value
                                              )
                                            }
                                            style={{
                                              padding: "3px 6px",
                                              borderRadius: "6px",
                                              border: "1px solid #D5CFC4",
                                              background: "#FFFFFF",
                                              fontSize: "0.78rem",
                                              fontWeight: 600,
                                              color: "#1F1C19",
                                              width: "100%",
                                            }}
                                          >
                                            {COLORES_ORQUIDEA_CYMBIDIUM.map((c) => (
                                              <option key={c.clave} value={c.clave}>
                                                {c.etiqueta}
                                              </option>
                                            ))}
                                          </select>
                                        ) : esGir ? (
                                          <strong style={{ fontSize: "0.79rem", color: "#854D0E" }}>
                                            Girasoles (Unidades)
                                          </strong>
                                        ) : (
                                          <select
                                            value={item.variedadId ?? ""}
                                            onChange={(e) =>
                                              handleCambiarVariedadItem(
                                                foto.id,
                                                item.id,
                                                e.target.value
                                              )
                                            }
                                            title="Cambiar variedad de este color"
                                            style={{
                                              padding: "3px 6px",
                                              borderRadius: "6px",
                                              border: "1px solid #D5CFC4",
                                              background: "#FFFFFF",
                                              fontSize: "0.78rem",
                                              fontWeight: 600,
                                              color: "#1F1C19",
                                              width: "100%",
                                            }}
                                          >
                                            {!item.variedadId && (
                                              <option value="">{item.variedadNombre}</option>
                                            )}
                                            {opcionesVariedad.map((v) => (
                                              <option key={v.id} value={v.id}>
                                                {v.esDefecto ? `★ ${v.nombre}` : v.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleEliminarItem(foto.id, item.id)}
                                      title="Quitar esta variedad"
                                      aria-label="Quitar variedad"
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#847D74",
                                        cursor: "pointer",
                                        padding: "2px",
                                      }}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>

                                  {/* Controles de cantidad (y Nº flores para Cymbidium) */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                      <span style={{ fontSize: "0.72rem", color: "#6E6861", fontWeight: 500 }}>
                                        {esOrq ? "Varas:" : esGir ? "Unid.:" : "Paq.:"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCambiarCantidadItem(foto.id, item.id, -1)}
                                        aria-label={esOrq ? `Disminuir varas de ${item.variedadNombre}` : `Disminuir paquetes de ${item.variedadNombre}`}
                                        title="Disminuir cantidad"
                                        style={{
                                          minWidth: "36px",
                                          minHeight: "36px",
                                          borderRadius: "8px",
                                          border: "1px solid #D5CFC4",
                                          background: "#FFFFFF",
                                          color: "#221E1B",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <input
                                        type="number"
                                        min={0}
                                        max={999}
                                        inputMode="numeric"
                                        value={item.cantidad}
                                        onChange={(e) => handleFijarCantidadItem(foto.id, item.id, Number(e.target.value))}
                                        aria-label={esOrq ? `Varas de ${item.variedadNombre}` : `Paquetes de ${item.variedadNombre}`}
                                        style={{
                                          width: "48px",
                                          height: "36px",
                                          textAlign: "center",
                                          fontSize: "0.84rem",
                                          fontWeight: 600,
                                          color: "#1F1C19",
                                          borderRadius: "8px",
                                          border: "1px solid #D5CFC4",
                                          background: "#FFFFFF",
                                          padding: "0 4px",
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleCambiarCantidadItem(foto.id, item.id, 1)}
                                        aria-label={esOrq ? `Aumentar varas de ${item.variedadNombre}` : `Aumentar paquetes de ${item.variedadNombre}`}
                                        title="Aumentar cantidad"
                                        style={{
                                          minWidth: "36px",
                                          minHeight: "36px",
                                          borderRadius: "8px",
                                          border: "1px solid #D5CFC4",
                                          background: "#FFFFFF",
                                          color: "#221E1B",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>

                                    {esOrq && (
                                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <span style={{ fontSize: "0.72rem", color: "#6B21A8", fontWeight: 700 }}>
                                          Nº Orq.:
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCambiarFloresOrquidea(foto.id, item.id, -1)
                                          }
                                          aria-label={`Disminuir flores de ${item.variedadNombre}`}
                                          title="Disminuir número de flores"
                                          style={{
                                            minWidth: "36px",
                                            minHeight: "36px",
                                            borderRadius: "8px",
                                            border: "1px solid #E5D7BC",
                                            background: "#FFFFFF",
                                            color: "#745622",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <Minus size={14} />
                                        </button>
                                        <input
                                          type="number"
                                          min={0}
                                          max={999}
                                          inputMode="numeric"
                                          value={item.numeroFlores ?? 0}
                                          onChange={(e) =>
                                            handleFijarFloresOrquidea(foto.id, item.id, Number(e.target.value))
                                          }
                                          aria-label={`Número de flores de ${item.variedadNombre}`}
                                          style={{
                                            width: "48px",
                                            height: "36px",
                                            textAlign: "center",
                                            fontSize: "0.84rem",
                                            fontWeight: 600,
                                            color: "#745622",
                                            borderRadius: "8px",
                                            border: "1px solid #E5D7BC",
                                            background: "#FFFFFF",
                                            padding: "0 4px",
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCambiarFloresOrquidea(foto.id, item.id, 1)
                                          }
                                          aria-label={`Aumentar flores de ${item.variedadNombre}`}
                                          title="Aumentar número de flores"
                                          style={{
                                            minWidth: "36px",
                                            minHeight: "36px",
                                            borderRadius: "8px",
                                            border: "1px solid #E5D7BC",
                                            background: "#FFFFFF",
                                            color: "#745622",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <Plus size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          !analizando && (
                            <div style={{ fontSize: "0.8rem", color: "#847D74" }}>
                              Sin variedades cargadas aún. Usa el botón <strong>+ Variedad</strong>{" "}
                              para añadir manualmente.
                            </div>
                          )
                        )}

                        {/* Formulario inline para agregar otra variedad a esta foto */}
                        {fotoAgregandoId === foto.id && (
                          <div
                            style={{
                              padding: "10px",
                              borderRadius: "10px",
                              background: "#FFFFFF",
                              border: "1px dashed #847D74",
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <select
                              value={inlineTipoFlor}
                              onChange={(e) => {
                                const t = e.target.value as TipoFlorInventario;
                                setInlineTipoFlor(t);
                                setInlineColor(
                                  t === "orquidea" ? "blanco" : t === "girasol" ? "girasol" : "rojo"
                                );
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "7px",
                                border: "1px solid #D5CFC4",
                                fontSize: "0.78rem",
                              }}
                            >
                              <option value="rosa">🌹 Rosa (Paq.)</option>
                              <option value="girasol">🌻 Girasoles (Unid.)</option>
                              <option value="orquidea">🌺 Orquídea</option>
                            </select>

                            {inlineTipoFlor !== "girasol" && (
                              <select
                                value={inlineColor}
                                onChange={(e) => setInlineColor(e.target.value)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #D5CFC4",
                                  fontSize: "0.78rem",
                                }}
                              >
                                {(inlineTipoFlor === "orquidea"
                                  ? COLORES_ORQUIDEA_CYMBIDIUM
                                  : categoriasColores
                                ).map((c) => (
                                  <option key={c.clave} value={c.clave}>
                                    {c.etiqueta}
                                  </option>
                                ))}
                              </select>
                            )}

                            {inlineTipoFlor === "rosa" && (
                              <select
                                value={inlineVariedadId}
                                onChange={(e) => setInlineVariedadId(e.target.value)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #D5CFC4",
                                  fontSize: "0.78rem",
                                }}
                              >
                                {variedadesColorInline.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.esDefecto ? `★ ${v.nombre}` : v.nombre}
                                  </option>
                                ))}
                              </select>
                            )}

                            {inlineTipoFlor === "orquidea" ? (
                              <>
                                <input
                                  type="number"
                                  min={1}
                                  value={inlineNumeroFlores}
                                  onChange={(e) =>
                                    setInlineNumeroFlores(Math.max(1, Number(e.target.value) || 1))
                                  }
                                  placeholder="Nº Orq."
                                  title="Número de orquídeas (flores)"
                                  style={{
                                    width: "76px",
                                    padding: "6px 8px",
                                    borderRadius: "7px",
                                    border: "1.5px solid #C084FC",
                                    fontSize: "0.78rem",
                                  }}
                                />
                                <input
                                  type="number"
                                  min={1}
                                  value={inlineCantidad}
                                  onChange={(e) =>
                                    setInlineCantidad(Math.max(1, Number(e.target.value) || 1))
                                  }
                                  placeholder="Varas"
                                  title="Varas"
                                  style={{
                                    width: "60px",
                                    padding: "6px 8px",
                                    borderRadius: "7px",
                                    border: "1px solid #D5CFC4",
                                    fontSize: "0.78rem",
                                  }}
                                />
                              </>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                value={inlineCantidad}
                                onChange={(e) =>
                                  setInlineCantidad(Math.max(1, Number(e.target.value) || 1))
                                }
                                title={inlineTipoFlor === "girasol" ? "Nº de Girasoles" : "Paquetes"}
                                style={{
                                  width: "66px",
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #D5CFC4",
                                  fontSize: "0.78rem",
                                }}
                              />
                            )}

                            <button
                              type="button"
                              onClick={() => handleAgregarItemEnFoto(foto.id)}
                              style={{
                                padding: "6px 11px",
                                borderRadius: "7px",
                                border: "none",
                                background: "#2F4737",
                                color: "#FFFFFF",
                                fontSize: "0.76rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Añadir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* RESUMEN CONSOLIDADO DE TODAS LAS FOTOS + MANUALES ANTES DE GUARDAR */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: "#F8F7F4",
                    border: "1px solid #DFDAD0",
                    borderLeft: "3px solid #2F4737",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px", flex: 1, minWidth: "220px" }}>
                    <strong style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F1C19" }}>
                      Consolidado Total ({fotosActuales.length} foto/lote):{" "}
                      <span style={{ color: "#2F4737" }}>
                        {consolidadoEnCurso.totalPaquetes} paq. rosas
                      </span>
                      {consolidadoEnCurso.totalGirasoles > 0
                        ? ` · 🌻 ${consolidadoEnCurso.totalGirasoles} girasoles`
                        : ""}
                      {consolidadoEnCurso.totalFloresOrquidea > 0
                        ? ` · 🌺 ${consolidadoEnCurso.totalFloresOrquidea} orquídeas`
                        : ""}
                    </strong>

                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {consolidadoEnCurso.resumenVariedades.map((v, i) => (
                        <span
                          key={`${v.tipoFlor}-${v.colorClave}-${v.variedadNombre}-${i}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 9px",
                            borderRadius: "999px",
                            background: "#FFFFFF",
                            border: "1px solid #E2DDD4",
                            fontSize: "0.74rem",
                            fontWeight: 600,
                            color: "#2E2A26",
                          }}
                        >
                          {v.imagenUrl && (
                            <img
                              src={v.imagenUrl}
                              alt={v.variedadNombre}
                              style={{
                                width: "15px",
                                height: "15px",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          {v.tipoFlor === "orquidea"
                            ? `🌺 ${v.numeroFlores ?? v.cantidad} ${v.variedadNombre}`
                            : v.tipoFlor === "girasol"
                              ? `🌻 ${v.cantidad} Girasoles`
                              : `${v.cantidad} ${v.variedadNombre}`}
                        </span>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Nota opcional (ej. Rosas frescas llegada de finca Tabacundo)..."
                      style={{
                        marginTop: "2px",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "1px solid #D5CFC4",
                        background: "#FFFFFF",
                        color: "#1F1C19",
                        fontSize: "0.79rem",
                        maxWidth: "440px",
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleGuardarInventario()}
                    disabled={guardando}
                    title="Consolidar y publicar este inventario como el corte vigente de la tienda"
                    aria-label="Guardar corte"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#2F4737",
                      color: "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: guardando ? "wait" : "pointer",
                    }}
                  >
                    {guardando ? <Loader2 size={15} /> : <Save size={15} />}
                    <span>{guardando ? "Guardando..." : "Guardar Corte"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* HISTORIAL DE CORTES EN DATAGRID ESTÁNDAR */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E6E2DA",
              borderRadius: "12px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#1F1C19" }}>
              Historial de Cortes de Inventario
            </h3>
            <DataGrid
              columnas={columnasHistorial}
              filas={historial}
              idFila={(c) => c.id}
              nombreExportacion={`inventario-rosas-${negNorm}`}
              contenidoExpandible={(c) => (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0" }}>
                  {c.observaciones && (
                    <div style={{ fontSize: "0.82rem", color: "#57524C" }}>
                      <strong>Observaciones:</strong> {c.observaciones}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {(c.fotos || []).map((f, i) => {
                      const itemsFoto =
                        f.itemsVariedad && f.itemsVariedad.length > 0
                          ? f.itemsVariedad
                          : convertirConteoColoresAItemsVariedad(
                              f.conteoColores,
                              catalogoVariedades,
                              "ia"
                            );
                      return (
                        <div
                          key={f.id || i}
                          style={{
                            border: "1px solid #E6E2DA",
                            borderRadius: "10px",
                            padding: "8px",
                            background: "#FFFFFF",
                            width: "210px",
                          }}
                        >
                          {f.imagenUrl && (
                            <img
                              src={f.imagenUrl}
                              alt={`Corte foto ${i + 1}`}
                              style={{
                                width: "100%",
                                height: "110px",
                                objectFit: "cover",
                                borderRadius: "6px",
                                marginBottom: "6px",
                              }}
                            />
                          )}
                          <div style={{ fontSize: "0.75rem", color: "#1F1C19", fontWeight: 600 }}>
                            {itemsFoto.length > 0
                              ? itemsFoto
                                  .map((it) =>
                                    it.tipoFlor === "orquidea"
                                      ? `${it.numeroFlores ?? it.cantidad} ${it.variedadNombre}`
                                      : it.tipoFlor === "girasol"
                                        ? `${it.cantidad} Girasoles`
                                        : `${it.cantidad} ${it.variedadNombre}`
                                  )
                                  .join(", ")
                              : formatearResumenInventarioTexto(f.conteoColores)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
