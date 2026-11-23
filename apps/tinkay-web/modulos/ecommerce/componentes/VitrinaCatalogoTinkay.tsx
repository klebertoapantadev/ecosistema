'use client';
import { SelectConBuscador } from "@eco/comercio";

import React, { useState, useMemo } from 'react';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import {
  CLASIFICACIONES_PRINCIPALES_TINKAY,
  esIdentificadorClasificacionVirtual,
  esProductoEntregaInmediata,
  expandirProductosVitrina,
  obtenerCategoriasVisibles,
  obtenerClasificacionPrincipalDeCategoria,
  obtenerClasificacionPrincipalPorId,
  obtenerEtiquetasBusquedaDisponibles,
  obtenerJerarquiaCatalogoTinkay,
  obtenerNombreProductoIndividual,
  obtenerPvpProducto,
  obtenerSubcategoriasDeClasificacion,
  productoCoincideConBusqueda,
  productoCoincideConCategoria,
  productoCoincideConEtiquetas,
  productoTieneOferta,
} from '../filtrado-catalogo';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import {
  Search,
  SlidersHorizontal,
  Feather,
  Sparkles,
  ArrowUpDown,
  Link2,
  Check,
  Tag,
  Hash,
  X,
  Flame,
  Zap,
  Heart,
} from 'lucide-react';

export { obtenerNombreProductoIndividual, obtenerPvpProducto, productoTieneOferta };

export function VitrinaCatalogoTinkay() {
  const {
    productos,
    categorias,
    categoriaActiva,
    setCategoriaActiva,
    terminoBusqueda,
    setTerminoBusqueda,
    obtenerEnlaceCategoriaActual,
    favoritosIds,
    totalFavoritos,
    totalMeGustaGlobalCatalogo,
    obtenerMeGustaProducto,
  } = useCarrito();

  const [linkCatCopiado, setLinkCatCopiado] = useState(false);

  const handleCopiarEnlaceCategoria = async () => {
    const url = obtenerEnlaceCategoriaActual(categoriaActiva);
    try {
      await navigator.clipboard.writeText(url);
      setLinkCatCopiado(true);
      setTimeout(() => setLinkCatCopiado(false), 2200);
    } catch {
      // Fallback silencioso
    }
  };

  const catalogoProductos = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
  const catalogoCategorias = categorias && categorias.length > 0 ? categorias : CATEGORIAS_TINKAY;

  const [filtroPresupuesto, setFiltroPresupuesto] = useState<string>('todos');
  const [criterioOrden, setCriterioOrden] = useState<
    'recomendados' | 'mas-deseados' | 'precio-desc' | 'precio-asc' | 'destacados' | 'nombre-asc'
  >('recomendados');
  const [etiquetasActivas, setEtiquetasActivas] = useState<string[]>([]);

  // 1. Expandir todas las variaciones como productos individuales (excepto categoría Extras)
  const productosBaseDesplegados = useMemo(
    () => expandirProductosVitrina(catalogoProductos),
    [catalogoProductos]
  );

  // 2. Categorías visibles: ocultar extras Y ocultar estrictamente grupos/categorías sin productos
  const categoriasVisibles = useMemo(
    () => obtenerCategoriasVisibles(catalogoCategorias, productosBaseDesplegados),
    [catalogoCategorias, productosBaseDesplegados]
  );

  const clasificacionActiva = useMemo(
    () => obtenerClasificacionPrincipalDeCategoria(categoriaActiva, categoriasVisibles),
    [categoriaActiva, categoriasVisibles]
  );

  const subcategoriasActivas = useMemo(
    () =>
      obtenerSubcategoriasDeClasificacion(
        clasificacionActiva,
        categoriasVisibles,
        productosBaseDesplegados
      ),
    [clasificacionActiva, categoriasVisibles, productosBaseDesplegados]
  );

  // Si la categoría activa quedó sin productos o se ocultó, regresar a 'cat-todos'
  React.useEffect(() => {
    if (
      categoriaActiva !== 'cat-todos' &&
      !esIdentificadorClasificacionVirtual(categoriaActiva) &&
      categoriasVisibles.length > 0 &&
      !categoriasVisibles.some((c) => c.id === categoriaActiva)
    ) {
      setCategoriaActiva('cat-todos');
    }
  }, [categoriasVisibles, categoriaActiva, setCategoriaActiva]);

  // Conteo reactivo de productos en oferta y entrega inmediata
  const totalOfertasDisponibles = useMemo(() => {
    return productosBaseDesplegados.filter((p) => productoTieneOferta(p)).length;
  }, [productosBaseDesplegados]);

  const totalEntregaInmediata = useMemo(() => {
    return productosBaseDesplegados.filter((p) => esProductoEntregaInmediata(p)).length;
  }, [productosBaseDesplegados]);

  const coincideConCategoriaActiva = (
    p: (typeof productosBaseDesplegados)[number],
    catId: string
  ) => {
    if (catId === 'cat-todos') return true;
    if (catId === 'grupo-favoritos') return favoritosIds.includes(p.id);
    return productoCoincideConCategoria(p, catId, catalogoCategorias);
  };

  const handleCambioBusqueda = (nuevoValor: string) => {
    setTerminoBusqueda(nuevoValor);
    const limpio = nuevoValor.trim();
    if (!limpio) return;

    const hayEnAmbitoActual = productosBaseDesplegados.some(
      (p) =>
        coincideConCategoriaActiva(p, categoriaActiva) &&
        productoCoincideConEtiquetas(p, etiquetasActivas) &&
        productoCoincideConBusqueda(p, limpio, catalogoCategorias)
    );
    if (hayEnAmbitoActual) return;

    if (etiquetasActivas.length > 0) {
      const haySinEtiquetas = productosBaseDesplegados.some(
        (p) =>
          coincideConCategoriaActiva(p, categoriaActiva) &&
          productoCoincideConBusqueda(p, limpio, catalogoCategorias)
      );
      if (haySinEtiquetas) {
        setEtiquetasActivas([]);
        return;
      }
    }

    if (categoriaActiva !== 'cat-todos') {
      const hayEnTodoCatalogo = productosBaseDesplegados.some((p) =>
        productoCoincideConBusqueda(p, limpio, catalogoCategorias)
      );
      if (hayEnTodoCatalogo) {
        setCategoriaActiva('cat-todos');
        if (etiquetasActivas.length > 0) {
          setEtiquetasActivas([]);
        }
      }
    }
  };

  const handleSeleccionarCategoria = (catId: string) => {
    setCategoriaActiva(catId);
    if (catId !== 'cat-todos' && terminoBusqueda.trim()) {
      const hayConBusqueda = productosBaseDesplegados.some(
        (p) =>
          coincideConCategoriaActiva(p, catId) &&
          productoCoincideConBusqueda(p, terminoBusqueda, catalogoCategorias)
      );
      if (!hayConBusqueda) {
        setTerminoBusqueda('');
      }
    }
    if (etiquetasActivas.length > 0) {
      const hayConEtiquetas = productosBaseDesplegados.some(
        (p) =>
          coincideConCategoriaActiva(p, catId) &&
          productoCoincideConEtiquetas(p, etiquetasActivas)
      );
      if (!hayConEtiquetas) {
        setEtiquetasActivas([]);
      }
    }
  };

  const handleToggleEtiqueta = (claveEtiqueta: string) => {
    setEtiquetasActivas((prev) =>
      prev.includes(claveEtiqueta)
        ? prev.filter((item) => item !== claveEtiqueta)
        : [...prev, claveEtiqueta]
    );
  };

  // Productos base del ámbito actual (antes del filtro por chips de etiquetas) para listar etiquetas útiles
  const productosAmbitoActual = useMemo(() => {
    return productosBaseDesplegados.filter((p) => {
      if (categoriaActiva === 'grupo-favoritos') {
        if (!favoritosIds.includes(p.id)) return false;
      } else if (categoriaActiva !== 'cat-todos') {
        if (!productoCoincideConCategoria(p, categoriaActiva, catalogoCategorias)) {
          return false;
        }
      }

      if (terminoBusqueda.trim()) {
        if (!productoCoincideConBusqueda(p, terminoBusqueda, catalogoCategorias)) {
          return false;
        }
      }

      if (filtroPresupuesto !== 'todos') {
        const pvp = obtenerPvpProducto(p);
        if (filtroPresupuesto === 'menor-30' && pvp > 30) return false;
        if (filtroPresupuesto === '30-50' && (pvp < 30 || pvp > 50)) return false;
        if (filtroPresupuesto === '50-80' && (pvp < 50 || pvp > 80)) return false;
        if (filtroPresupuesto === 'mayor-80' && pvp < 80) return false;
      }

      return true;
    });
  }, [
    categoriaActiva,
    terminoBusqueda,
    filtroPresupuesto,
    favoritosIds,
    productosBaseDesplegados,
    catalogoCategorias,
  ]);

  const etiquetasDisponibles = useMemo(() => {
    const base = obtenerEtiquetasBusquedaDisponibles(productosAmbitoActual);
    if (etiquetasActivas.length === 0) return base;
    const existentes = new Set(base.map((e) => e.clave));
    const extrasActivas = etiquetasActivas
      .filter((cl) => !existentes.has(cl))
      .map((cl) => ({ clave: cl, etiqueta: cl, cantidad: 0 }));
    return [...extrasActivas, ...base];
  }, [productosAmbitoActual, etiquetasActivas]);

  // 3. Filtrado reactivo final incluyendo etiquetas semánticas de búsqueda seleccionadas
  const productosFiltrados = useMemo(() => {
    if (etiquetasActivas.length === 0) return productosAmbitoActual;
    return productosAmbitoActual.filter((p) => productoCoincideConEtiquetas(p, etiquetasActivas));
  }, [productosAmbitoActual, etiquetasActivas]);

  // 4. Ordenamiento reactivo con jerarquía estructural:
  //    Nivel 1: Flores destacadas (Primero)
  //    Nivel 2: Flores resto (Luego el resto)
  //    Nivel 3: Condolencias (Trasantepenúltimo)
  //    Nivel 4: Eventos (Penúltimo)
  //    Nivel 5: Mobiliario (Último)
  const productosFinales = useMemo(() => {
    const lista = [...productosFiltrados];

    return lista.sort((a, b) => {
      if (criterioOrden === 'mas-deseados') {
        const likesA = obtenerMeGustaProducto(a, a.varianteInicialSku);
        const likesB = obtenerMeGustaProducto(b, b.varianteInicialSku);
        if (likesA !== likesB) return likesB - likesA;
        return obtenerPvpProducto(b) - obtenerPvpProducto(a);
      }

      // En "Todo el Catálogo" (vista general), preservar estrictamente los 5 niveles estructurales
      if (categoriaActiva === 'cat-todos') {
        const jA = obtenerJerarquiaCatalogoTinkay(a);
        const jB = obtenerJerarquiaCatalogoTinkay(b);
        if (jA !== jB) {
          return jA - jB;
        }
      }

      // Ordenamiento dentro del mismo nivel o cuando se filtra por una categoría específica
      switch (criterioOrden) {
        case 'precio-desc':
          return obtenerPvpProducto(b) - obtenerPvpProducto(a);
        case 'precio-asc':
          return obtenerPvpProducto(a) - obtenerPvpProducto(b);
        case 'nombre-asc':
          return a.nombre.localeCompare(b.nombre);
        case 'destacados':
        case 'recomendados':
        default: {
          if (a.destacado !== b.destacado) {
            return (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0);
          }
          return obtenerPvpProducto(b) - obtenerPvpProducto(a);
        }
      }
    });
  }, [productosFiltrados, criterioOrden, categoriaActiva, obtenerMeGustaProducto]);

  const clasifPrincipalObj = obtenerClasificacionPrincipalPorId(categoriaActiva);
  const subcategoriaActivaObj = subcategoriasActivas.find((s) => s.id === categoriaActiva);
  const categoriaActivaObj = categoriasVisibles.find((c) => c.id === categoriaActiva);
  const esModoCondolencias =
    clasificacionActiva === 'grupo-condolencias' ||
    Boolean(categoriaActivaObj?.modoVisualSobrio) ||
    categoriaActiva === 'cat-ocas-condol' ||
    (Boolean(terminoBusqueda.trim()) &&
      productosFinales.length > 0 &&
      productosFinales.every((p) => p.esCondolencias));

  const tituloVitrinaActual =
    categoriaActiva === 'grupo-ofertas'
      ? 'Ofertas y Descuentos Activos'
      : categoriaActiva === 'grupo-entrega-inmediata'
      ? 'Arreglos con Entrega Inmediata'
      : categoriaActiva === 'grupo-favoritos'
      ? 'Mis Productos Favoritos'
      : esModoCondolencias
      ? 'Arreglos de Condolencias & Respeto'
      : clasifPrincipalObj
      ? clasifPrincipalObj.tituloVitrina
      : subcategoriaActivaObj
      ? subcategoriaActivaObj.nombre
      : categoriaActivaObj && categoriaActiva !== 'cat-todos'
      ? categoriaActivaObj.nombre
      : 'Flores con Historia, Para Cada Momento';

  const subtituloVitrinaActual =
    categoriaActiva === 'grupo-ofertas'
      ? 'Aprovecha nuestros arreglos seleccionados con descuento especial vigente.'
      : categoriaActiva === 'grupo-entrega-inmediata'
      ? 'Diseños florales frescos listos para despachar el mismo día en 1 a 2 horas en Quito y Valles.'
      : categoriaActiva === 'grupo-favoritos'
      ? totalFavoritos > 0
        ? `Tienes ${totalFavoritos} ${totalFavoritos === 1 ? 'arreglo guardado' : 'arreglos guardados'} con Me gusta para revisar o pedir cuando desees.`
        : 'Pulsa el ícono de corazón en cualquier arreglo para guardarlo en tu lista personal.'
      : esModoCondolencias
      ? 'Composiciones solemnes en blanco y follajes andinos para acompañar en los momentos más difíciles con entrega puntual en velaciones e iglesias.'
      : clasifPrincipalObj
      ? clasifPrincipalObj.descripcionVitrina
      : categoriaActivaObj && categoriaActiva !== 'cat-todos' && categoriaActivaObj.descripcion
      ? categoriaActivaObj.descripcion
      : 'Explora nuestros arreglos florales para toda ocasión, eventos y condolencias preparados con rosas frescas de exportación.';

  const nombreEnlaceActual =
    categoriaActiva === 'grupo-ofertas'
      ? 'Ofertas'
      : categoriaActiva === 'grupo-entrega-inmediata'
      ? 'Entrega Inmediata'
      : categoriaActiva === 'grupo-favoritos'
      ? 'Me gusta'
      : clasifPrincipalObj
      ? clasifPrincipalObj.nombre
      : subcategoriaActivaObj
      ? subcategoriaActivaObj.nombre
      : categoriaActivaObj && categoriaActiva !== 'cat-todos'
      ? categoriaActivaObj.nombre
      : '';

  return (
    <section
      className={`seccion-vitrina-catalogo ${esModoCondolencias ? 'vitrina-modo-condolencias' : ''}`}
      id="catalogo"
    >
      <div className="contenedor-maximo">
        {/* Cabecera de la vitrina */}
        <div className="cabecera-vitrina">
          <div className="titulos-vitrina">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="etiqueta-pequena">
                {esModoCondolencias ? (
                  <>
                    <Feather size={13} />
                    <span>Acompañamiento &amp; Respeto</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Catálogo Floristería Tinkay</span>
                  </>
                )}
              </span>
              {totalMeGustaGlobalCatalogo > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setCriterioOrden((prev) =>
                      prev === 'mas-deseados' ? 'recomendados' : 'mas-deseados'
                    )
                  }
                  aria-pressed={criterioOrden === 'mas-deseados'}
                  title="Ver primero los productos más deseados según los Me gusta acumulados de todos los clientes"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border:
                      criterioOrden === 'mas-deseados'
                        ? '1px solid #BE123C'
                        : '1px solid #FBCFE8',
                    background:
                      criterioOrden === 'mas-deseados' ? '#BE123C' : '#FFF1F2',
                    color: criterioOrden === 'mas-deseados' ? '#FFFFFF' : '#BE123C',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={12} fill="currentColor" />
                  <span>{totalMeGustaGlobalCatalogo} Me gusta</span>
                </button>
              )}
            </div>
            <h2 className="titulo-seccion-vitrina">{tituloVitrinaActual}</h2>
            <p className="subtitulo-seccion-vitrina">{subtituloVitrinaActual}</p>
          </div>

          {/* Barra de Búsqueda, Ordenamiento y Filtros Rápidos */}
          <div className="barra-busqueda-vitrina">
            <div className="campo-busqueda-icono">
              <Search size={18} className="icono-busqueda" />
              <input
                type="text"
                placeholder="Buscar por nombre, etiqueta (#orquídeas, rosas), uso u ocasión..."
                value={terminoBusqueda}
                onChange={(e) => handleCambioBusqueda(e.target.value)}
                className="input-busqueda-catalogo"
                aria-label="Buscar productos por nombre, etiqueta de búsqueda, categoría o uso"
              />
              {terminoBusqueda && (
                <button
                  type="button"
                  onClick={() => setTerminoBusqueda('')}
                  className="btn-limpiar-busqueda"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>

            {/* Selectores compactos: en móvil se disponen en 2 columnas para ahorrar scroll */}
            <div className="fila-selectores-vitrina">
              {/* Selector de Ordenamiento por Precio / Relevancia */}
              <div className="selector-orden-wrapper" title="Ordenar catálogo">
                <ArrowUpDown size={15} />
                <SelectConBuscador
                  value={criterioOrden}
                  onChange={(e) =>
                    setCriterioOrden(
                      e.target.value as
                        | 'recomendados'
                        | 'mas-deseados'
                        | 'precio-desc'
                        | 'precio-asc'
                        | 'destacados'
                        | 'nombre-asc'
                    )
                  }
                  className="select-criterio-orden"
                  aria-label="Ordenar productos por recomendación, más deseados, precio o destacados"
                >
                  <option value="recomendados">Recomendados Tinkay</option>
                  <option value="mas-deseados">Más deseados (❤️)</option>
                  <option value="destacados">Más Pedidos / Destacados</option>
                  <option value="precio-desc">Mayor a menor ($$$ → $)</option>
                  <option value="precio-asc">Menor a mayor ($ → $$$)</option>
                  <option value="nombre-asc">Nombre: A — Z</option>
                </SelectConBuscador>
              </div>

              {/* Selector de Rango de Presupuesto */}
              <div className="selector-presupuesto-wrapper" title="Filtrar por presupuesto">
                <SlidersHorizontal size={15} />
                <SelectConBuscador
                  value={filtroPresupuesto}
                  onChange={(e) => setFiltroPresupuesto(e.target.value)}
                  className="select-filtro-presupuesto"
                  aria-label="Filtrar por rango de presupuesto"
                >
                  <option value="todos">Cualquier Presupuesto</option>
                  <option value="menor-30">Hasta $30.00</option>
                  <option value="30-50">$30.00 - $50.00</option>
                  <option value="50-80">$50.00 - $80.00</option>
                  <option value="mayor-80">Más de $80.00</option>
                </SelectConBuscador>
              </div>
            </div>
          </div>
        </div>

        {/* Nivel 1: Primera Clasificación + Ofertas + Entrega Inmediata + Me gusta + Copiar link */}
        <div
          className="fila-categorias-y-enlace"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'nowrap',
            marginBottom: '6px',
          }}
        >
          <div
            className="pills-categorias-scroll pills-clasificacion-principal"
            style={{ flex: 1, minWidth: 0 }}
            role="tablist"
            aria-label="Primera clasificación de consulta y filtros rápidos"
          >
            {totalFavoritos > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={clasificacionActiva === 'grupo-favoritos'}
                title={`Revisar mis ${totalFavoritos} productos marcados con Me gusta`}
                className={`pill-categoria pill-favoritos con-likes ${
                  clasificacionActiva === 'grupo-favoritos' ? 'pill-activa' : ''
                }`}
                onClick={() => handleSeleccionarCategoria('grupo-favoritos')}
              >
                <Heart size={14} fill="currentColor" />
                <span>Me gusta</span>
                <span className="badge-pill-contador">{totalFavoritos}</span>
              </button>
            )}
            {CLASIFICACIONES_PRINCIPALES_TINKAY.map((clasif) => {
              const estaActiva = clasificacionActiva === clasif.id;
              return (
                <button
                  key={clasif.id}
                  type="button"
                  role="tab"
                  aria-selected={estaActiva}
                  title={`${clasif.nombre} — ${clasif.subtitulo}`}
                  className={`pill-categoria pill-clasificacion-principal ${
                    estaActiva ? 'pill-activa' : ''
                  } ${clasif.modoVisualSobrio ? 'pill-condolencias' : ''}`}
                  onClick={() => handleSeleccionarCategoria(clasif.id)}
                >
                  {clasif.modoVisualSobrio && <Feather size={14} className="icono-pill" />}
                  <span>{clasif.nombre}</span>
                  {clasif.id === 'grupo-arreglos-florales' && (
                    <span className="pill-subtexto-ocasion">(Para toda ocasión)</span>
                  )}
                </button>
              );
            })}
            {totalOfertasDisponibles > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={clasificacionActiva === 'grupo-ofertas'}
                title={`Filtrar ${totalOfertasDisponibles} productos en oferta`}
                className={`pill-categoria pill-ofertas ${
                  clasificacionActiva === 'grupo-ofertas' ? 'pill-activa' : ''
                }`}
                onClick={() => handleSeleccionarCategoria('grupo-ofertas')}
              >
                <Flame size={14} />
                <span>Ofertas</span>
                <span className="badge-pill-contador">{totalOfertasDisponibles}</span>
              </button>
            )}
            {totalEntregaInmediata > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={clasificacionActiva === 'grupo-entrega-inmediata'}
                title="Filtrar arreglos con entrega inmediata"
                className={`pill-categoria pill-inmediata ${
                  clasificacionActiva === 'grupo-entrega-inmediata' ? 'pill-activa' : ''
                }`}
                onClick={() => handleSeleccionarCategoria('grupo-entrega-inmediata')}
              >
                <Zap size={14} />
                <span>Entrega Inmediata</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={clasificacionActiva === 'cat-todos'}
              title="Ver todo el catálogo"
              className={`pill-categoria ${
                clasificacionActiva === 'cat-todos' ? 'pill-activa' : ''
              }`}
              onClick={() => handleSeleccionarCategoria('cat-todos')}
            >
              <span>Todo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopiarEnlaceCategoria}
            className="btn-responsive-accion"
            title={
              nombreEnlaceActual
                ? `Copiar link directo de "${nombreEnlaceActual}" para WhatsApp o Chat`
                : 'Copiar link directo del catálogo para WhatsApp o Chat'
            }
            aria-label="Copiar link de categoría"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 13px',
              borderRadius: '999px',
              border: linkCatCopiado ? '1px solid var(--verde)' : '1px solid var(--linea)',
              background: linkCatCopiado ? 'rgba(61, 90, 69, 0.1)' : 'var(--blanco)',
              color: linkCatCopiado ? 'var(--verde)' : 'var(--tinta)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {linkCatCopiado ? <Check size={14} /> : <Link2 size={14} />}
            <span className="btn-texto-responsive">
              {linkCatCopiado ? 'Link copiado' : 'Copiar link'}
            </span>
          </button>
        </div>

        {/* Nivel 2: Sub-colecciones contextuales (dentro de Arreglos Florales, Todo o Eventos) */}
        {subcategoriasActivas.length > 0 && (
          <div className="fila-subcategorias-vitrina" aria-label="Sub-colecciones">
            <span className="etiqueta-riel-filtro">
              {clasificacionActiva === 'grupo-eventos' ? 'Tipo:' : 'Colección:'}
            </span>
            <div className="riel-chips-secundarios">
              <button
                type="button"
                className={`chip-subcategoria ${
                  categoriaActiva === clasificacionActiva ||
                  (clasificacionActiva === 'cat-todos' && categoriaActiva === 'cat-todos')
                    ? 'activo'
                    : ''
                }`}
                onClick={() =>
                  handleSeleccionarCategoria(
                    clasificacionActiva === 'cat-todos' ? 'cat-todos' : clasificacionActiva
                  )
                }
              >
                {clasificacionActiva === 'grupo-eventos' ? 'Todo en Eventos' : 'Todas'}
              </button>
              {subcategoriasActivas.map((sub) => {
                const estaActiva = categoriaActiva === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className={`chip-subcategoria ${estaActiva ? 'activo' : ''}`}
                    onClick={() => handleSeleccionarCategoria(sub.id)}
                  >
                    {sub.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nivel 3: Filtro interactivo por Etiquetas Semánticas de Búsqueda (Keywords IA) */}
        {etiquetasDisponibles.length > 0 && (
          <div className="fila-etiquetas-busqueda-vitrina" aria-label="Filtrar por etiquetas de búsqueda">
            <span className="etiqueta-riel-filtro">
              <Tag size={13} />
              <span>Etiquetas:</span>
            </span>
            <div className="riel-chips-secundarios">
              {etiquetasDisponibles.map((item) => {
                const activa = etiquetasActivas.includes(item.clave);
                return (
                  <button
                    key={item.clave}
                    type="button"
                    aria-pressed={activa}
                    title={
                      activa
                        ? `Quitar filtro de etiqueta "${item.etiqueta}"`
                        : `Filtrar resultados por etiqueta "${item.etiqueta}"`
                    }
                    className={`chip-etiqueta-busqueda ${activa ? 'activa' : ''}`}
                    onClick={() => handleToggleEtiqueta(item.clave)}
                  >
                    <Hash size={12} />
                    <span>{item.etiqueta}</span>
                    {activa && <X size={12} />}
                  </button>
                );
              })}
              {etiquetasActivas.length > 0 && (
                <button
                  type="button"
                  className="btn-limpiar-etiquetas"
                  onClick={() => setEtiquetasActivas([])}
                  title="Limpiar etiquetas seleccionadas"
                  aria-label="Limpiar etiquetas"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Grid de Productos con Carruseles Fotográficos */}
        {productosFinales.length === 0 ? (
          <div className="vacio-catalogo-alerta">
            <p>
              {categoriaActiva === 'grupo-favoritos'
                ? 'Aún no has marcado productos con Me gusta. Pulsa el corazón en cualquier arreglo para guardarlo aquí.'
                : 'No encontramos arreglos con los filtros seleccionados.'}
            </p>
            <button
              type="button"
              className="btn btn-mini"
              onClick={() => {
                setCategoriaActiva('cat-todos');
                setTerminoBusqueda('');
                setEtiquetasActivas([]);
                setFiltroPresupuesto('todos');
                setCriterioOrden('recomendados');
              }}
            >
              {categoriaActiva === 'grupo-favoritos' ? 'Explorar catálogo' : 'Restablecer filtros'}
            </button>
          </div>
        ) : (
          <div className="grid-productos-vitrina">
            {productosFinales.map((producto) => {
              const esPrimariaCondolencias = Boolean(
                producto.esCondolencias &&
                  (!producto.categoriaNombre ||
                    producto.categoriaNombre.toLowerCase().includes('condol'))
              );
              return (
                <TarjetaProductoConCarrusel
                  key={producto.id}
                  producto={producto}
                  modoSobrio={esModoCondolencias || esPrimariaCondolencias}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
