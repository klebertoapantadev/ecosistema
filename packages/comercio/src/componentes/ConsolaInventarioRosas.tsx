"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  Flower2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  analizarFotoBonchesConAriaAction,
  guardarCorteInventarioRosasAction,
  listarVariedadesRosaAction,
  obtenerInventarioRosasAction,
} from "../acciones-operaciones-taller";
import {
  CATALOGO_SEMILLA_VARIEDADES_ROSAS,
  COLORES_ORQUIDEA_CYMBIDIUM,
  calcularResumenColoresDesdeItems,
  consolidarVariedadesDesdeFotos,
  convertirConteoColoresAItemsVariedad,
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
        ? `${v.cantidad} vara(s) ${v.variedadNombre}${v.numeroFlores ? ` (${v.numeroFlores} flores)` : ""}`
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
  }, [cargarCatalogo]);

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

  const handleCambiarFloresOrquidea = (fotoId: string, itemId: string, delta: number) => {
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) =>
        it.id === itemId
          ? { ...it, numeroFlores: Math.max(0, (Number(it.numeroFlores) || 0) + delta) }
          : it
      )
    );
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
    const def = COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === nuevoColor);
    actualizarItemsDeFoto(fotoId, (items) =>
      items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              colorClave: nuevoColor,
              variedadNombre: def?.etiqueta ?? `Cymbidium ${nuevoColor}`,
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
    if (tipo === "orquidea") {
      const defOrq =
        COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === color) ?? COLORES_ORQUIDEA_CYMBIDIUM[0]!;
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
    setMensajeExito(`Agregado manualmente: ${nuevoItem.cantidad} ${nuevoItem.variedadNombre}.`);
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
      `Inventario publicado: ${formatearFechaCorteInventario(res.corte.fechaCorte)} (${consolidadoEnCurso.totalPaquetes} paq. rosas${consolidadoEnCurso.totalVarasOrquidea > 0 ? `, ${consolidadoEnCurso.totalVarasOrquidea} vara(s) / ${consolidadoEnCurso.totalFloresOrquidea} flores Cymbidium` : ""}).`
    );

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ultimoCorte: res.corte, historial: nuevoHistorial })
      );
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
            <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
              {formatearFechaCorteInventario(c.fechaCorte)}
            </strong>
            <span style={{ fontSize: "0.73rem", color: "#64748B" }}>
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
                  padding: "3px 9px",
                  borderRadius: "999px",
                  background: "#ECFDF5",
                  color: "#065F46",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  width: "fit-content",
                }}
              >
                {cons.totalPaquetes > 0 ? cons.totalPaquetes : c.totalPaquetes} paq.
              </span>
              {cons.totalVarasOrquidea > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "#FEFCE8",
                    color: "#854D0E",
                    fontWeight: 700,
                    fontSize: "0.74rem",
                    width: "fit-content",
                  }}
                >
                  {cons.totalVarasOrquidea} vara(s) · {cons.totalFloresOrquidea} flores
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
          <span style={{ fontSize: "0.82rem", color: "#1E293B" }}>
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
            <span style={{ fontSize: "0.78rem", color: "#475569" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* BARRA DE PESTAÑAS: CONTEO E INVENTARIO | CATÁLOGO DE VARIEDADES */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setPestanaActiva("conteo")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 15px",
            borderRadius: "10px",
            border: pestanaActiva === "conteo" ? "none" : "1px solid #CBD5E1",
            background: pestanaActiva === "conteo" ? "#0F172A" : "#FFFFFF",
            color: pestanaActiva === "conteo" ? "#FFFFFF" : "#334155",
            fontSize: "0.84rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Camera size={15} />
          <span>Conteo e Inventario</span>
        </button>

        <button
          type="button"
          onClick={() => setPestanaActiva("catalogo")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 15px",
            borderRadius: "10px",
            border: pestanaActiva === "catalogo" ? "none" : "1px solid #CBD5E1",
            background: pestanaActiva === "catalogo" ? "#0F172A" : "#FFFFFF",
            color: pestanaActiva === "catalogo" ? "#FFFFFF" : "#334155",
            fontSize: "0.84rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <BookOpen size={15} />
          <span>Catálogo Variedades ({catalogoVariedades.length})</span>
        </button>
      </div>

      {pestanaActiva === "catalogo" ? (
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
          {/* CABECERA PERMANENTE DEL ÚLTIMO INVENTARIO REALIZADO */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
              color: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "rgba(236, 127, 167, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#F472B6",
                  }}
                >
                  <Flower2 size={22} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.73rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#94A3B8",
                      fontWeight: 700,
                    }}
                  >
                    Último Inventario Realizado en Tienda
                  </div>
                  <div style={{ fontSize: "1.06rem", fontWeight: 700, marginTop: "2px" }}>
                    {ultimoCorte ? (
                      <>
                        <span style={{ color: "#34D399" }}>
                          {formatearFechaCorteInventario(ultimoCorte.fechaCorte)}
                        </span>
                        {" : "}
                        <span>
                          {formatearTextoConsolidadoVariedades(ultimoCorte, catalogoVariedades)}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "#CBD5E1" }}>
                        Aún no se ha registrado un corte de inventario fotográfico
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {ultimoCorte && (
                  <div
                    style={{
                      padding: "6px 13px",
                      borderRadius: "999px",
                      background: "rgba(52, 211, 153, 0.16)",
                      border: "1px solid rgba(52, 211, 153, 0.4)",
                      color: "#6EE7B7",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                    }}
                  >
                    Rosas:{" "}
                    {consolidadoUltimoCorte && consolidadoUltimoCorte.totalPaquetes > 0
                      ? consolidadoUltimoCorte.totalPaquetes
                      : ultimoCorte.totalPaquetes}{" "}
                    paq.
                  </div>
                )}
                {consolidadoUltimoCorte && consolidadoUltimoCorte.totalVarasOrquidea > 0 && (
                  <div
                    style={{
                      padding: "6px 13px",
                      borderRadius: "999px",
                      background: "rgba(250, 204, 21, 0.18)",
                      border: "1px solid rgba(250, 204, 21, 0.45)",
                      color: "#FDE047",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                    }}
                  >
                    Orquídeas: {consolidadoUltimoCorte.totalVarasOrquidea} vara(s) ·{" "}
                    {consolidadoUltimoCorte.totalFloresOrquidea} flores
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
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#FFFFFF",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
                  <span className="btn-texto-responsive">Actualizar</span>
                </button>
              </div>
            </div>

            {ultimoCorte && consolidadoUltimoCorte && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                {consolidadoUltimoCorte.resumenVariedades.map((item, idx) => {
                  const colInfo =
                    item.tipoFlor === "orquidea"
                      ? COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === item.colorClave)
                      : categoriasColores.find((c) => c.clave === item.colorClave);
                  return (
                    <span
                      key={`${item.tipoFlor}-${item.colorClave}-${item.variedadNombre}-${idx}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.1)",
                        fontSize: "0.79rem",
                        fontWeight: 600,
                      }}
                    >
                      {item.imagenUrl ? (
                        <img
                          src={item.imagenUrl}
                          alt={item.variedadNombre}
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid rgba(255,255,255,0.5)",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            background: colInfo?.colorHex ?? "#94A3B8",
                          }}
                        />
                      )}
                      {item.tipoFlor === "orquidea"
                        ? `${item.cantidad} vara(s) ${item.variedadNombre} (${item.numeroFlores ?? 0} flores)`
                        : `${item.cantidad} ${item.variedadNombre}`}
                    </span>
                  );
                })}
                <span style={{ fontSize: "0.75rem", color: "#94A3B8", marginLeft: "6px" }}>
                  <Clock size={12} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                  Registrado por {ultimoCorte.registradoNombre}
                </span>
              </div>
            )}
          </div>

          {migracionPendiente && (
            <div
              style={{
                padding: "11px 14px",
                borderRadius: "10px",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                color: "#92400E",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} />
              <span>
                Ejecuta la migración{" "}
                <code>20261115000010_herramientas_taller_inventario_inmediata_y_entregas_iess.sql</code>{" "}
                en Supabase para habilitar la persistencia del inventario.
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

          {/* SECCIÓN DE NUEVO CORTE POR FOTOS CON ARIA + MANUALES */}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
                  Nuevo Conteo Fotográfico de Rosas y Orquídeas Cymbidium (ARIA)
                </h2>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <label
                  title="Tomar foto directa de los bonches u orquídeas"
                  aria-label="Tomar foto"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 14px",
                    borderRadius: "10px",
                    background: "#0F172A",
                    color: "#FFFFFF",
                    fontSize: "0.83rem",
                    fontWeight: 700,
                    cursor: subiendoFotos ? "wait" : "pointer",
                  }}
                >
                  {subiendoFotos ? <Loader2 size={15} /> : <Camera size={15} />}
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
                    gap: "7px",
                    padding: "9px 14px",
                    borderRadius: "10px",
                    background: "#EC7FA7",
                    color: "#FFFFFF",
                    fontSize: "0.83rem",
                    fontWeight: 700,
                    cursor: subiendoFotos ? "wait" : "pointer",
                  }}
                >
                  {subiendoFotos ? <Loader2 size={15} /> : <Upload size={15} />}
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
                    gap: "6px",
                    padding: "9px 13px",
                    borderRadius: "10px",
                    border: mostrarPanelManual ? "1px solid #0F172A" : "1px solid #CBD5E1",
                    background: mostrarPanelManual ? "#F1F5F9" : "#FFFFFF",
                    color: "#0F172A",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={15} />
                  <span>Agregar Manual</span>
                </button>
              </div>
            </div>

            {/* PANEL RÁPIDO PARA AGREGAR PAQUETES / ORQUÍDEAS MANUALES (NO EN FOTOS) */}
            {mostrarPanelManual && (
              <form
                onSubmit={handleAgregarPaqueteManualSinFoto}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
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
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: "0.88rem", color: "#0F172A" }}>
                    Agregar Paquetes u Orquídeas sin Fotografía
                  </strong>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setManualTipoFlor("rosa");
                        setManualColor("rojo");
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: manualTipoFlor === "rosa" ? "none" : "1px solid #CBD5E1",
                        background: manualTipoFlor === "rosa" ? "#0F172A" : "#FFFFFF",
                        color: manualTipoFlor === "rosa" ? "#FFFFFF" : "#334155",
                        fontSize: "0.77rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Rosa (Paquetes)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualTipoFlor("orquidea");
                        setManualColor("amarillo");
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: manualTipoFlor === "orquidea" ? "none" : "1px solid #CBD5E1",
                        background: manualTipoFlor === "orquidea" ? "#CA8A04" : "#FFFFFF",
                        color: manualTipoFlor === "orquidea" ? "#FFFFFF" : "#334155",
                        fontSize: "0.77rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Orquídea / Cymbidium
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                    alignItems: "end",
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#334155" }}>
                    Color
                    <select
                      value={manualColor}
                      onChange={(e) => setManualColor(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        fontSize: "0.83rem",
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

                  {manualTipoFlor === "rosa" && (
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#334155" }}>
                      Variedad
                      <select
                        value={manualVariedadId}
                        onChange={(e) => setManualVariedadId(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          fontSize: "0.83rem",
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

                  <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#334155" }}>
                    {manualTipoFlor === "orquidea" ? "Varas" : "Paquetes (Bonches)"}
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={manualCantidad}
                      onChange={(e) => setManualCantidad(Math.max(1, Number(e.target.value) || 1))}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        fontSize: "0.84rem",
                      }}
                    />
                  </label>

                  {manualTipoFlor === "orquidea" && (
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#334155" }}>
                      Nº Flores / Campanas
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={manualNumeroFlores}
                        onChange={(e) =>
                          setManualNumeroFlores(Math.max(1, Number(e.target.value) || 1))
                        }
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          fontSize: "0.84rem",
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
                      gap: "6px",
                      padding: "9px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#059669",
                      color: "#FFFFFF",
                      fontSize: "0.83rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={15} />
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
                    .filter((it) => it.tipoFlor !== "orquidea")
                    .reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
                  const subtotalOrqVaras = items
                    .filter((it) => it.tipoFlor === "orquidea")
                    .reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
                  const subtotalOrqFlores = items
                    .filter((it) => it.tipoFlor === "orquidea")
                    .reduce((acc, it) => acc + (Number(it.numeroFlores) || 0), 0);

                  return (
                    <div
                      key={foto.id}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "14px",
                        padding: "12px",
                        background: "#F8FAFC",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "14px",
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
                            flex: "1 1 160px",
                            maxWidth: "220px",
                            minWidth: 0,
                          }}
                        >
                          <img
                            src={foto.imagenUrl}
                            alt={`Foto inventario ${idx + 1}`}
                            style={{
                              width: "100%",
                              height: "155px",
                              objectFit: "cover",
                              borderRadius: "10px",
                              border: "1px solid #CBD5E1",
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
                                padding: "6px 10px",
                                borderRadius: "8px",
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: analizando ? "wait" : "pointer",
                              }}
                            >
                              {analizando ? <Loader2 size={13} /> : <Sparkles size={13} />}
                              <span>{analizando ? "Contando..." : "Recontar IA"}</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
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
                            <strong style={{ fontSize: "0.9rem", color: "#0F172A" }}>
                              {foto.esManual || !foto.imagenUrl
                                ? "Paquetes Manuales (Sin Foto)"
                                : `Foto #${idx + 1}`}
                              {" — "}
                              {subtotalRosas > 0 ? `${subtotalRosas} paq.` : ""}
                              {subtotalRosas > 0 && subtotalOrqVaras > 0 ? " + " : ""}
                              {subtotalOrqVaras > 0
                                ? `${subtotalOrqVaras} vara(s) (${subtotalOrqFlores} flores)`
                                : subtotalRosas === 0
                                  ? "0"
                                  : ""}
                            </strong>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.75rem",
                                color: analizando ? "#0284C7" : "#475569",
                              }}
                            >
                              <Bot size={13} />
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
                                borderRadius: "8px",
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Plus size={13} />
                              <span>Variedad</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setFotosActuales((prev) => prev.filter((x) => x.id !== foto.id))
                              }
                              title="Quitar esta foto o lote"
                              aria-label="Quitar"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 9px",
                                borderRadius: "8px",
                                border: "1px solid #FECACA",
                                background: "#FEF2F2",
                                color: "#B91C1C",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={13} />
                              <span>Quitar</span>
                            </button>
                          </div>
                        </div>

                        {/* Lista de variedades detectadas / agregadas con selector de variedad */}
                        {items.length > 0 ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
                              gap: "8px",
                              minWidth: 0,
                            }}
                          >
                            {items.map((item) => {
                              const esOrq = item.tipoFlor === "orquidea";
                              const colDef = esOrq
                                ? COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === item.colorClave)
                                : categoriasColores.find((c) => c.clave === item.colorClave);
                              const opcionesVariedad = esOrq
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
                                    borderRadius: "10px",
                                    background: colDef?.fondoHex ?? "#FFFFFF",
                                    border: `1px solid ${colDef?.colorHex ?? "#CBD5E1"}`,
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
                                            width: "34px",
                                            height: "34px",
                                            borderRadius: "8px",
                                            objectFit: "cover",
                                            background: "#0B0F19",
                                            flexShrink: 0,
                                          }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            width: "34px",
                                            height: "34px",
                                            borderRadius: "8px",
                                            background: colDef?.colorHex ?? "#EAB308",
                                            color: "#FFFFFF",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                          }}
                                        >
                                          <Flower2 size={18} />
                                        </div>
                                      )}

                                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                                        <span
                                          style={{
                                            fontSize: "0.7rem",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            color: colDef?.textoHex ?? "#334155",
                                          }}
                                        >
                                          {esOrq ? "Orquídea Cymbidium" : colDef?.etiqueta ?? item.colorClave}
                                        </span>

                                        {esOrq ? (
                                          <select
                                            value={item.colorClave}
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
                                              border: "1px solid #CBD5E1",
                                              background: "#FFFFFF",
                                              fontSize: "0.8rem",
                                              fontWeight: 700,
                                              color: "#0F172A",
                                              width: "100%",
                                            }}
                                          >
                                            {COLORES_ORQUIDEA_CYMBIDIUM.map((c) => (
                                              <option key={c.clave} value={c.clave}>
                                                {c.etiqueta}
                                              </option>
                                            ))}
                                          </select>
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
                                              border: "1px solid #CBD5E1",
                                              background: "#FFFFFF",
                                              fontSize: "0.8rem",
                                              fontWeight: 700,
                                              color: "#0F172A",
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
                                        color: "#94A3B8",
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
                                      <span style={{ fontSize: "0.73rem", color: "#475569", fontWeight: 600 }}>
                                        {esOrq ? "Varas:" : "Paq.:"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCambiarCantidadItem(foto.id, item.id, -1)}
                                        style={{
                                          width: "24px",
                                          height: "24px",
                                          borderRadius: "6px",
                                          border: "1px solid #CBD5E1",
                                          background: "#FFFFFF",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <strong
                                        style={{
                                          minWidth: "22px",
                                          textAlign: "center",
                                          fontSize: "0.86rem",
                                          color: "#0F172A",
                                        }}
                                      >
                                        {item.cantidad}
                                      </strong>
                                      <button
                                        type="button"
                                        onClick={() => handleCambiarCantidadItem(foto.id, item.id, 1)}
                                        style={{
                                          width: "24px",
                                          height: "24px",
                                          borderRadius: "6px",
                                          border: "1px solid #CBD5E1",
                                          background: "#FFFFFF",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>

                                    {esOrq && (
                                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <span style={{ fontSize: "0.73rem", color: "#854D0E", fontWeight: 700 }}>
                                          Flores:
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCambiarFloresOrquidea(foto.id, item.id, -1)
                                          }
                                          style={{
                                            width: "24px",
                                            height: "24px",
                                            borderRadius: "6px",
                                            border: "1px solid #FDE047",
                                            background: "#FFFFFF",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <Minus size={12} />
                                        </button>
                                        <strong
                                          style={{
                                            minWidth: "22px",
                                            textAlign: "center",
                                            fontSize: "0.86rem",
                                            color: "#854D0E",
                                          }}
                                        >
                                          {item.numeroFlores ?? 0}
                                        </strong>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCambiarFloresOrquidea(foto.id, item.id, 1)
                                          }
                                          style={{
                                            width: "24px",
                                            height: "24px",
                                            borderRadius: "6px",
                                            border: "1px solid #FDE047",
                                            background: "#FFFFFF",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <Plus size={12} />
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
                            <div style={{ fontSize: "0.8rem", color: "#64748B" }}>
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
                              border: "1px dashed #94A3B8",
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
                                setInlineColor(t === "orquidea" ? "amarillo" : "rojo");
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "7px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.78rem",
                              }}
                            >
                              <option value="rosa">Rosa</option>
                              <option value="orquidea">Orquídea Cymbidium</option>
                            </select>

                            <select
                              value={inlineColor}
                              onChange={(e) => setInlineColor(e.target.value)}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "7px",
                                border: "1px solid #CBD5E1",
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

                            {inlineTipoFlor === "rosa" && (
                              <select
                                value={inlineVariedadId}
                                onChange={(e) => setInlineVariedadId(e.target.value)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #CBD5E1",
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

                            <input
                              type="number"
                              min={1}
                              value={inlineCantidad}
                              onChange={(e) =>
                                setInlineCantidad(Math.max(1, Number(e.target.value) || 1))
                              }
                              title={inlineTipoFlor === "orquidea" ? "Varas" : "Paquetes"}
                              style={{
                                width: "62px",
                                padding: "6px 8px",
                                borderRadius: "7px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.78rem",
                              }}
                            />

                            {inlineTipoFlor === "orquidea" && (
                              <input
                                type="number"
                                min={1}
                                value={inlineNumeroFlores}
                                onChange={(e) =>
                                  setInlineNumeroFlores(Math.max(1, Number(e.target.value) || 1))
                                }
                                placeholder="Flores"
                                title="Número de flores"
                                style={{
                                  width: "70px",
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #CBD5E1",
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
                                background: "#059669",
                                color: "#FFFFFF",
                                fontSize: "0.78rem",
                                fontWeight: 700,
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
                    padding: "16px 18px",
                    borderRadius: "14px",
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                    <strong style={{ fontSize: "0.95rem", color: "#065F46" }}>
                      Consolidado Total ({fotosActuales.length} foto/lote):{" "}
                      {consolidadoEnCurso.totalPaquetes} paq. rosas
                      {consolidadoEnCurso.totalVarasOrquidea > 0
                        ? ` · ${consolidadoEnCurso.totalVarasOrquidea} vara(s) / ${consolidadoEnCurso.totalFloresOrquidea} flores Cymbidium`
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
                            border: "1px solid #A7F3D0",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            color: "#065F46",
                          }}
                        >
                          {v.imagenUrl && (
                            <img
                              src={v.imagenUrl}
                              alt={v.variedadNombre}
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          {v.tipoFlor === "orquidea"
                            ? `${v.cantidad} vara(s) ${v.variedadNombre} (${v.numeroFlores ?? 0} flores)`
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
                        marginTop: "4px",
                        padding: "8px 11px",
                        borderRadius: "8px",
                        border: "1px solid #A7F3D0",
                        background: "#FFFFFF",
                        fontSize: "0.82rem",
                        maxWidth: "460px",
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
                      gap: "7px",
                      padding: "11px 18px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#059669",
                      color: "#FFFFFF",
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      cursor: guardando ? "wait" : "pointer",
                    }}
                  >
                    {guardando ? <Loader2 size={16} /> : <Save size={16} />}
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
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#0F172A" }}>
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
                    <div style={{ fontSize: "0.82rem", color: "#334155" }}>
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
                            border: "1px solid #E2E8F0",
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
                          <div style={{ fontSize: "0.75rem", color: "#0F172A", fontWeight: 600 }}>
                            {itemsFoto.length > 0
                              ? itemsFoto
                                  .map((it) =>
                                    it.tipoFlor === "orquidea"
                                      ? `${it.cantidad} vara(s) ${it.variedadNombre} (${it.numeroFlores ?? 0} fl.)`
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
