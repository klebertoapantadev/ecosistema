'use client';

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
  Link2,
  Check,
  Tag,
  Hash,
  X,
  Flame,
  Zap,
  Heart,
  ChevronDown,
  ChevronUp,
  Layers,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export { obtenerNombreProductoIndividual, obtenerPvpProducto, productoTieneOferta };

const PRESUPUESTOS_FILTRO = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'menor-30', etiqueta: 'Hasta $30' },
  { id: '30-50', etiqueta: '$30 – $50' },
  { id: '50-80', etiqueta: '$50 – $80' },
  { id: 'mayor-80', etiqueta: 'Más de $80' },
] as const;

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
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

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

  const coleccionesParaFiltros = useMemo(() => {
    if (subcategoriasActivas.length > 0) return subcategoriasActivas;
    return categoriasVisibles.filter((c) => c.id !== 'cat-todos');
  }, [subcategoriasActivas, categoriasVisibles]);

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

  const handleLimpiarTodo = () => {
    setCategoriaActiva('cat-todos');
    setTerminoBusqueda('');
    setEtiquetasActivas([]);
    setFiltroPresupuesto('todos');
    setCriterioOrden('recomendados');
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

  // 4. Ordenamiento reactivo con jerarquía estructural
  const productosFinales = useMemo(() => {
    const lista = [...productosFiltrados];

    return lista.sort((a, b) => {
      if (criterioOrden === 'mas-deseados') {
        const likesA = obtenerMeGustaProducto(a, a.varianteInicialSku);
        const likesB = obtenerMeGustaProducto(b, b.varianteInicialSku);
        if (likesA !== likesB) return likesB - likesA;
        return obtenerPvpProducto(b) - obtenerPvpProducto(a);
      }

      if (categoriaActiva === 'cat-todos') {
        const jA = obtenerJerarquiaCatalogoTinkay(a);
        const jB = obtenerJerarquiaCatalogoTinkay(b);
        if (jA !== jB) {
          return jA - jB;
        }
      }

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
      ? 'Mis Productos con Me Gusta'
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
        ? `Tienes ${totalFavoritos} ${totalFavoritos === 1 ? 'arreglo marcado' : 'arreglos marcados'} con Me gusta para revisar o pedir cuando desees.`
        : 'Pulsa el ícono de corazón en cualquier arreglo para guardarlo en tu lista personal.'
      : esModoCondolencias
      ? 'Composiciones solemnes en blanco y follajes andinos para acompañar en los momentos más difíciles con entrega puntual en velaciones e iglesias.'
      : clasifPrincipalObj
      ? clasifPrincipalObj.descripcionVitrina
      : categoriaActivaObj && categoriaActiva !== 'cat-todos' && categoriaActivaObj.descripcion
      ? categoriaActivaObj.descripcion
      : 'Explora nuestros arreglos florales para toda ocasión, eventos y condolencias preparados con rosas frescas ecuatorianas.';

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

  const cantidadFiltrosActivos =
    (categoriaActiva !== 'cat-todos' && categoriaActiva !== 'grupo-favoritos' ? 1 : 0) +
    etiquetasActivas.length +
    (criterioOrden !== 'recomendados' ? 1 : 0) +
    (filtroPresupuesto !== 'todos' ? 1 : 0);

  const etiquetaPresupuestoActiva =
    PRESUPUESTOS_FILTRO.find((p) => p.id === filtroPresupuesto)?.etiqueta || '';

  const chipEstilo = (activo: boolean, variante?: 'oscuro' | 'rosa' | 'ambar' | 'verde') => {
    if (activo) {
      if (variante === 'rosa') {
        return {
          background: '#BE123C',
          border: '1px solid #BE123C',
          color: '#FFFFFF',
        };
      }
      if (variante === 'ambar') {
        return {
          background: '#B45309',
          border: '1px solid #B45309',
          color: '#FFFFFF',
        };
      }
      if (variante === 'verde') {
        return {
          background: '#2F4737',
          border: '1px solid #2F4737',
          color: '#FFFFFF',
        };
      }
      return {
        background: '#1F1C19',
        border: '1px solid #1F1C19',
        color: '#FFFFFF',
      };
    }
    return {
      background: '#FAF8F5',
      border: '1px solid #E5DFD5',
      color: '#3F3A35',
    };
  };

  return (
    <section
      className={`seccion-vitrina-catalogo ${esModoCondolencias ? 'vitrina-modo-condolencias' : ''}`}
      id="catalogo"
    >
      <div className="contenedor-maximo">
        {/* Cabecera editorial sobria */}
        <div className="cabecera-vitrina" style={{ marginBottom: '12px' }}>
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
                  title="Ordenar por los arreglos con más Me gusta"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border:
                      criterioOrden === 'mas-deseados'
                        ? '1px solid #BE123C'
                        : '1px solid #E7E2D8',
                    background:
                      criterioOrden === 'mas-deseados' ? '#BE123C' : '#F6F4EF',
                    color: criterioOrden === 'mas-deseados' ? '#FFFFFF' : '#6B655E',
                    fontSize: '0.72rem',
                    fontWeight: 600,
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
        </div>

        {/* ================================================================
            BARRA PRINCIPAL DE BÚSQUEDA + FILTROS + ME GUSTA DEL CLIENTE
            ================================================================ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          {/* Fila 1: Buscador por texto (control principal) */}
          <div className="campo-busqueda-icono" style={{ width: '100%' }}>
            <Search size={18} className="icono-busqueda" />
            <input
              type="text"
              placeholder="Busca por ocasión, flores, color, precio..."
              value={terminoBusqueda}
              onChange={(e) => handleCambioBusqueda(e.target.value)}
              className="input-busqueda-catalogo"
              aria-label="Busca por ocasión, flores, color o etiqueta"
              style={{
                width: '100%',
                minHeight: '46px',
                fontSize: '0.92rem',
              }}
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

          {/* Fila 2: Botón Filtros + Botón Me Gusta (Corazón del cliente) + Copiar link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Botón principal de Filtros */}
              <button
                type="button"
                onClick={() => setFiltrosAbiertos((prev) => !prev)}
                aria-expanded={filtrosAbiertos}
                aria-controls="panel-filtros-tinkay"
                title="Abrir filtros por categoría, colecciones, etiquetas, más solicitados y presupuesto"
                aria-label="Filtros del catálogo"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 14px',
                  borderRadius: '999px',
                  border:
                    filtrosAbiertos || cantidadFiltrosActivos > 0
                      ? '1.5px solid #1F1C19'
                      : '1px solid #DCD5CA',
                  background:
                    filtrosAbiertos || cantidadFiltrosActivos > 0 ? '#1F1C19' : '#FFFFFF',
                  color:
                    filtrosAbiertos || cantidadFiltrosActivos > 0 ? '#FFFFFF' : '#1F1C19',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(31,28,25,0.06)',
                }}
              >
                <SlidersHorizontal size={15} />
                <span>Filtros</span>
                {cantidadFiltrosActivos > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: '#E88FB0',
                      color: '#1F1C19',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {cantidadFiltrosActivos}
                  </span>
                )}
                {filtrosAbiertos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {/* Opción dedicada para ver los marcados con Me Gusta (Corazón) del cliente */}
              <button
                type="button"
                onClick={() =>
                  handleSeleccionarCategoria(
                    categoriaActiva === 'grupo-favoritos' ? 'cat-todos' : 'grupo-favoritos'
                  )
                }
                aria-pressed={categoriaActiva === 'grupo-favoritos'}
                title={
                  totalFavoritos > 0
                    ? `Ver mis ${totalFavoritos} arreglos marcados con Me gusta`
                    : 'Ver mis arreglos marcados con Me gusta'
                }
                aria-label="Mis Me gusta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '999px',
                  border:
                    categoriaActiva === 'grupo-favoritos'
                      ? '1.5px solid #BE123C'
                      : totalFavoritos > 0
                        ? '1px solid #F4B4C6'
                        : '1px solid #DCD5CA',
                  background:
                    categoriaActiva === 'grupo-favoritos'
                      ? '#BE123C'
                      : totalFavoritos > 0
                        ? '#FFF1F2'
                        : '#FFFFFF',
                  color:
                    categoriaActiva === 'grupo-favoritos'
                      ? '#FFFFFF'
                      : totalFavoritos > 0
                        ? '#BE123C'
                        : '#3F3A35',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(31,28,25,0.05)',
                }}
              >
                <Heart
                  size={15}
                  fill={categoriaActiva === 'grupo-favoritos' || totalFavoritos > 0 ? 'currentColor' : 'none'}
                />
                <span>Me gusta</span>
                {totalFavoritos > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background:
                        categoriaActiva === 'grupo-favoritos'
                          ? 'rgba(255,255,255,0.22)'
                          : '#BE123C',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {totalFavoritos}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopiarEnlaceCategoria}
              className="btn-responsive-accion"
              title={
                nombreEnlaceActual
                  ? `Copiar link directo de "${nombreEnlaceActual}"`
                  : 'Copiar link del catálogo'
              }
              aria-label="Copiar link"
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

          {/* Resumen compacto de filtros activos cuando el panel está cerrado */}
          {!filtrosAbiertos && cantidadFiltrosActivos > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              {categoriaActiva !== 'cat-todos' && categoriaActiva !== 'grupo-favoritos' && nombreEnlaceActual && (
                <button
                  type="button"
                  onClick={() => handleSeleccionarCategoria('cat-todos')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #D5CFC4',
                    background: '#F6F4EF',
                    color: '#221E1B',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>{nombreEnlaceActual}</span>
                  <X size={12} />
                </button>
              )}
              {criterioOrden === 'mas-deseados' && (
                <button
                  type="button"
                  onClick={() => setCriterioOrden('recomendados')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #F4B4C6',
                    background: '#FFF1F2',
                    color: '#BE123C',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={11} fill="currentColor" />
                  <span>Más solicitados</span>
                  <X size={12} />
                </button>
              )}
              {criterioOrden !== 'recomendados' && criterioOrden !== 'mas-deseados' && (
                <button
                  type="button"
                  onClick={() => setCriterioOrden('recomendados')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #D5CFC4',
                    background: '#F6F4EF',
                    color: '#221E1B',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>
                    {criterioOrden === 'precio-asc'
                      ? 'Menor precio'
                      : criterioOrden === 'precio-desc'
                        ? 'Mayor precio'
                        : 'Destacados'}
                  </span>
                  <X size={12} />
                </button>
              )}
              {filtroPresupuesto !== 'todos' && (
                <button
                  type="button"
                  onClick={() => setFiltroPresupuesto('todos')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #D5CFC4',
                    background: '#F6F4EF',
                    color: '#221E1B',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>{etiquetaPresupuestoActiva}</span>
                  <X size={12} />
                </button>
              )}
              {etiquetasActivas.map((et) => (
                <button
                  key={et}
                  type="button"
                  onClick={() => handleToggleEtiqueta(et)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #D5CFC4',
                    background: '#F6F4EF',
                    color: '#221E1B',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Hash size={11} />
                  <span>{et}</span>
                  <X size={12} />
                </button>
              ))}
              <button
                type="button"
                onClick={handleLimpiarTodo}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#6B655E',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                Limpiar todo
              </button>
            </div>
          )}

          {/* Panel de Filtros Estructurado (3.1 a 3.5) */}
          {filtrosAbiertos && (
            <div
              id="panel-filtros-tinkay"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5DFD5',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 28px rgba(31, 28, 25, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* 3.1 Categorías principales: Arreglos, Eventos, Condolencias, Ofertas, Entrega Inmediata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#221E1B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Sparkles size={13} />
                  <span>Categorías</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  <button
                    type="button"
                    onClick={() => handleSeleccionarCategoria('cat-todos')}
                    style={{
                      ...chipEstilo(categoriaActiva === 'cat-todos'),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Todo</span>
                  </button>
                  {CLASIFICACIONES_PRINCIPALES_TINKAY.map((clasif) => {
                    const estaActiva = clasificacionActiva === clasif.id;
                    return (
                      <button
                        key={clasif.id}
                        type="button"
                        onClick={() => handleSeleccionarCategoria(clasif.id)}
                        style={{
                          ...chipEstilo(estaActiva),
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 12px',
                          borderRadius: '999px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {clasif.modoVisualSobrio && <Feather size={13} />}
                        <span>{clasif.nombre}</span>
                      </button>
                    );
                  })}
                  {totalOfertasDisponibles > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSeleccionarCategoria('grupo-ofertas')}
                      style={{
                        ...chipEstilo(clasificacionActiva === 'grupo-ofertas', 'rosa'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Flame size={13} />
                      <span>Ofertas ({totalOfertasDisponibles})</span>
                    </button>
                  )}
                  {totalEntregaInmediata > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSeleccionarCategoria('grupo-entrega-inmediata')}
                      style={{
                        ...chipEstilo(clasificacionActiva === 'grupo-entrega-inmediata', 'verde'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Zap size={13} />
                      <span>Entrega Inmediata</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3.2 Colecciones */}
              {coleccionesParaFiltros.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    paddingTop: '10px',
                    borderTop: '1px solid #F0EBE3',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: '#221E1B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Layers size={13} />
                    <span>Colecciones</span>
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        handleSeleccionarCategoria(
                          clasificacionActiva === 'cat-todos' ? 'cat-todos' : clasificacionActiva
                        )
                      }
                      style={{
                        ...chipEstilo(
                          categoriaActiva === clasificacionActiva || categoriaActiva === 'cat-todos',
                          'verde'
                        ),
                        padding: '6px 11px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Todas
                    </button>
                    {coleccionesParaFiltros.map((sub) => {
                      const estaActiva = categoriaActiva === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSeleccionarCategoria(sub.id)}
                          style={{
                            ...chipEstilo(estaActiva, 'verde'),
                            padding: '6px 11px',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {sub.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3.3 Etiquetas */}
              {etiquetasDisponibles.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    paddingTop: '10px',
                    borderTop: '1px solid #F0EBE3',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#221E1B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <Tag size={13} />
                      <span>Etiquetas</span>
                    </span>
                    {etiquetasActivas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEtiquetasActivas([])}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#BE123C',
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Quitar etiquetas
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {etiquetasDisponibles.map((item) => {
                      const activa = etiquetasActivas.includes(item.clave);
                      return (
                        <button
                          key={item.clave}
                          type="button"
                          aria-pressed={activa}
                          onClick={() => handleToggleEtiqueta(item.clave)}
                          style={{
                            ...chipEstilo(activa),
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Hash size={11} />
                          <span>{item.etiqueta}</span>
                          {activa && <X size={11} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3.4 Los más solicitados (Más Me gusta) y orden */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  paddingTop: '10px',
                  borderTop: '1px solid #F0EBE3',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#221E1B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <TrendingUp size={13} />
                  <span>Popularidad y Orden</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setCriterioOrden((prev) =>
                        prev === 'mas-deseados' ? 'recomendados' : 'mas-deseados'
                      )
                    }
                    aria-pressed={criterioOrden === 'mas-deseados'}
                    style={{
                      ...chipEstilo(criterioOrden === 'mas-deseados', 'rosa'),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Heart size={13} fill="currentColor" />
                    <span>Más solicitados (Más Me gusta)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriterioOrden('recomendados')}
                    style={{
                      ...chipEstilo(criterioOrden === 'recomendados'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Recomendados
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriterioOrden('precio-asc')}
                    style={{
                      ...chipEstilo(criterioOrden === 'precio-asc'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Menor precio
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriterioOrden('precio-desc')}
                    style={{
                      ...chipEstilo(criterioOrden === 'precio-desc'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Mayor precio
                  </button>
                </div>
              </div>

              {/* 3.5 Presupuesto */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  paddingTop: '10px',
                  borderTop: '1px solid #F0EBE3',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#221E1B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <DollarSign size={13} />
                  <span>Presupuesto</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {PRESUPUESTOS_FILTRO.map((pres) => {
                    const activo = filtroPresupuesto === pres.id;
                    return (
                      <button
                        key={pres.id}
                        type="button"
                        onClick={() => setFiltroPresupuesto(pres.id)}
                        style={{
                          ...chipEstilo(activo, 'ambar'),
                          padding: '6px 12px',
                          borderRadius: '999px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {pres.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pie del panel de filtros */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid #F0EBE3',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={handleLimpiarTodo}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: '1px solid #D5CFC4',
                    background: '#FFFFFF',
                    color: '#57524C',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setFiltrosAbiertos(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#1F1C19',
                    color: '#FFFFFF',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Ver {productosFinales.length}{' '}
                  {productosFinales.length === 1 ? 'resultado' : 'resultados'}
                </button>
              </div>
            </div>
          )}
        </div>

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
              onClick={handleLimpiarTodo}
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
