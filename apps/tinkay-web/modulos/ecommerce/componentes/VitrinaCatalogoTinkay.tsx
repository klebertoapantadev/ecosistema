'use client';

import React, { useState, useMemo } from 'react';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import {
  esIdentificadorClasificacionVirtual,
  expandirProductosVitrina,
  obtenerCategoriasVisibles,
  obtenerClasificacionPrincipalDeCategoria,
  obtenerClasificacionPrincipalPorId,
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
  SlidersHorizontal,
  Feather,
  Sparkles,
  Link2,
  Check,
  Hash,
  X,
  Heart,
} from 'lucide-react';

export { obtenerNombreProductoIndividual, obtenerPvpProducto, productoTieneOferta };

const ETIQUETAS_PRESUPUESTO: Record<string, string> = {
  'menor-30': 'Hasta $30',
  '30-50': '$30 – $50',
  '50-80': '$50 – $80',
  'mayor-80': 'Más de $80',
};

export function VitrinaCatalogoTinkay() {
  const {
    productos,
    categorias,
    categoriaActiva,
    setCategoriaActiva,
    terminoBusqueda,
    setTerminoBusqueda,
    filtroPresupuesto,
    setFiltroPresupuesto,
    criterioOrden,
    setCriterioOrden,
    etiquetasActivas,
    toggleEtiquetaActiva,
    setFiltrosPanelAbierto,
    limpiarFiltrosCatalogo,
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

  // 3. Filtrado reactivo completo (categoría/colección + búsqueda + presupuesto + etiquetas)
  const productosFiltrados = useMemo(() => {
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

      if (etiquetasActivas.length > 0) {
        if (!productoCoincideConEtiquetas(p, etiquetasActivas)) {
          return false;
        }
      }

      return true;
    });
  }, [
    categoriaActiva,
    terminoBusqueda,
    filtroPresupuesto,
    etiquetasActivas,
    favoritosIds,
    productosBaseDesplegados,
    catalogoCategorias,
  ]);

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

  const esSubcoleccionActiva =
    categoriaActiva !== 'cat-todos' &&
    !esIdentificadorClasificacionVirtual(categoriaActiva) &&
    Boolean(nombreEnlaceActual);

  const hayFiltrosSecundariosActivos =
    Boolean(terminoBusqueda.trim()) ||
    esSubcoleccionActiva ||
    etiquetasActivas.length > 0 ||
    criterioOrden !== 'recomendados' ||
    filtroPresupuesto !== 'todos';

  return (
    <section
      className={`seccion-vitrina-catalogo ${esModoCondolencias ? 'vitrina-modo-condolencias' : ''}`}
      id="catalogo"
    >
      <div className="contenedor-maximo">
        {/* Cabecera editorial limpia (sin buscador ni categorías duplicadas) */}
        <div
          className="cabecera-vitrina"
          style={{
            marginBottom: hayFiltrosSecundariosActivos ? '12px' : '18px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div className="titulos-vitrina" style={{ flex: '1 1 260px', minWidth: 0 }}>
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
                  gap: '5px',
                  padding: '3px 9px',
                  borderRadius: '999px',
                  border: linkCatCopiado ? '1px solid var(--verde)' : '1px solid #E5DFD5',
                  background: linkCatCopiado ? 'rgba(61, 90, 69, 0.1)' : '#FFFFFF',
                  color: linkCatCopiado ? 'var(--verde)' : '#57524C',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {linkCatCopiado ? <Check size={12} /> : <Link2 size={12} />}
                <span className="btn-texto-responsive">
                  {linkCatCopiado ? 'Copiado' : 'Link'}
                </span>
              </button>
            </div>
            <h2 className="titulo-seccion-vitrina">{tituloVitrinaActual}</h2>
            <p className="subtitulo-seccion-vitrina">{subtituloVitrinaActual}</p>
          </div>
        </div>

        {/* Chips removibles únicamente cuando hay filtros avanzados o búsqueda activa */}
        {hayFiltrosSecundariosActivos && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '14px',
            }}
          >
            {terminoBusqueda.trim() && (
              <button
                type="button"
                onClick={() => setTerminoBusqueda('')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid #D5CFC4',
                  background: '#FFFFFF',
                  color: '#1F1C19',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>&ldquo;{terminoBusqueda.trim()}&rdquo;</span>
                <X size={12} />
              </button>
            )}
            {esSubcoleccionActiva && (
              <button
                type="button"
                onClick={() => setCategoriaActiva('cat-todos')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid #B7D8C2',
                  background: '#F2F6F3',
                  color: '#2F4737',
                  fontSize: '0.74rem',
                  fontWeight: 700,
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
                <span>{ETIQUETAS_PRESUPUESTO[filtroPresupuesto] || filtroPresupuesto}</span>
                <X size={12} />
              </button>
            )}
            {etiquetasActivas.map((et) => (
              <button
                key={et}
                type="button"
                onClick={() => toggleEtiquetaActiva(et)}
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
              onClick={() => setFiltrosPanelAbierto(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '999px',
                border: '1px solid #D5CFC4',
                background: '#FFFFFF',
                color: '#1F1C19',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={11} />
              <span>Ajustar</span>
            </button>
            <button
              type="button"
              onClick={limpiarFiltrosCatalogo}
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
              Limpiar
            </button>
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
              onClick={limpiarFiltrosCatalogo}
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
