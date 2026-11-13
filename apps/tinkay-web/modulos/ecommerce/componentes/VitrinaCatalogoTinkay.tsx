'use client';

import React, { useState, useMemo } from 'react';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import {
  expandirProductosVitrina,
  obtenerCategoriasVisibles,
  obtenerNombreProductoIndividual,
  obtenerPvpProducto,
  productoCoincideConBusqueda,
  productoCoincideConCategoria,
  productoTieneOferta,
} from '../filtrado-catalogo';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import { Search, SlidersHorizontal, Feather, Sparkles, ArrowUpDown, Link2, Check } from 'lucide-react';

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
    'precio-desc' | 'precio-asc' | 'destacados' | 'nombre-asc'
  >('precio-desc');
  const [soloOfertas, setSoloOfertas] = useState<boolean>(false);

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

  // Si la categoría activa quedó sin productos o se ocultó, regresar a 'cat-todos'
  React.useEffect(() => {
    if (
      categoriaActiva !== 'cat-todos' &&
      categoriasVisibles.length > 0 &&
      !categoriasVisibles.some((c) => c.id === categoriaActiva)
    ) {
      setCategoriaActiva('cat-todos');
    }
  }, [categoriasVisibles, categoriaActiva, setCategoriaActiva]);

  // Conteo reactivo de cuántos productos tienen oferta activa
  const totalOfertasDisponibles = useMemo(() => {
    return productosBaseDesplegados.filter((p) => productoTieneOferta(p)).length;
  }, [productosBaseDesplegados]);

  const handleCambioBusqueda = (nuevoValor: string) => {
    setTerminoBusqueda(nuevoValor);
    const limpio = nuevoValor.trim();
    if (limpio && categoriaActiva !== 'cat-todos') {
      const hayEnCategoriaActual = productosBaseDesplegados.some(
        (p) =>
          productoCoincideConCategoria(p, categoriaActiva, catalogoCategorias) &&
          productoCoincideConBusqueda(p, limpio, catalogoCategorias)
      );
      if (!hayEnCategoriaActual) {
        const hayEnTodoCatalogo = productosBaseDesplegados.some((p) =>
          productoCoincideConBusqueda(p, limpio, catalogoCategorias)
        );
        if (hayEnTodoCatalogo) {
          setCategoriaActiva('cat-todos');
        }
      }
    }
  };

  const handleSeleccionarCategoria = (catId: string) => {
    setCategoriaActiva(catId);
    if (catId !== 'cat-todos' && terminoBusqueda.trim()) {
      const hayConBusqueda = productosBaseDesplegados.some(
        (p) =>
          productoCoincideConCategoria(p, catId, catalogoCategorias) &&
          productoCoincideConBusqueda(p, terminoBusqueda, catalogoCategorias)
      );
      if (!hayConBusqueda) {
        setTerminoBusqueda('');
      }
    }
  };

  // 3. Filtrado reactivo por categoría, búsqueda multidimensional (usos, nombres, categorías, detalles), presupuesto y ofertas
  const productosFiltrados = useMemo(() => {
    return productosBaseDesplegados.filter((p) => {
      if (soloOfertas && !productoTieneOferta(p)) {
        return false;
      }

      if (categoriaActiva !== 'cat-todos') {
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
    soloOfertas,
    productosBaseDesplegados,
    catalogoCategorias,
  ]);

  // 4. Ordenamiento reactivo (por defecto de mayor a menor precio)
  const productosFinales = useMemo(() => {
    const lista = [...productosFiltrados];
    switch (criterioOrden) {
      case 'precio-desc':
        return lista.sort((a, b) => obtenerPvpProducto(b) - obtenerPvpProducto(a));
      case 'precio-asc':
        return lista.sort((a, b) => obtenerPvpProducto(a) - obtenerPvpProducto(b));
      case 'destacados':
        return lista.sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));
      case 'nombre-asc':
        return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      default:
        return lista;
    }
  }, [productosFiltrados, criterioOrden]);

  const categoriaActivaObj = categoriasVisibles.find((c) => c.id === categoriaActiva);
  const esModoCondolencias =
    Boolean(categoriaActivaObj?.modoVisualSobrio) ||
    categoriaActiva === 'cat-ocas-condol' ||
    (Boolean(terminoBusqueda.trim()) &&
      productosFinales.length > 0 &&
      productosFinales.every((p) => p.esCondolencias));

  return (
    <section
      className={`seccion-vitrina-catalogo ${esModoCondolencias ? 'vitrina-modo-condolencias' : ''}`}
      id="catalogo"
    >
      <div className="contenedor-maximo">
        {/* Cabecera de la vitrina */}
        <div className="cabecera-vitrina">
          <div className="titulos-vitrina">
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
            <h2 className="titulo-seccion-vitrina">
              {esModoCondolencias
                ? 'Arreglos de Condolencias & Respeto'
                : categoriaActivaObj && categoriaActiva !== 'cat-todos'
                ? categoriaActivaObj.nombre
                : 'Flores con Historia, Para Cada Momento'}
            </h2>
            <p className="subtitulo-seccion-vitrina">
              {esModoCondolencias
                ? 'Composiciones solemnes en blanco y follajes andinos para acompañar en los momentos más difíciles con entrega puntual en velaciones e iglesias.'
                : categoriaActivaObj &&
                  categoriaActiva !== 'cat-todos' &&
                  categoriaActivaObj.descripcion
                ? categoriaActivaObj.descripcion
                : 'Explora nuestros bouquets coreanos, box florales, ramos para florero y arreglos de eventos preparados con rosas frescas de exportación.'}
            </p>
          </div>

          {/* Barra de Búsqueda, Ordenamiento y Filtros Rápidos */}
          <div className="barra-busqueda-vitrina">
            <div className="campo-busqueda-icono">
              <Search size={18} className="icono-busqueda" />
              <input
                type="text"
                placeholder="Buscar por nombre, uso, categoría, flores u ocasión (ej. condolencias, cumpleaños, orquídea)..."
                value={terminoBusqueda}
                onChange={(e) => handleCambioBusqueda(e.target.value)}
                className="input-busqueda-catalogo"
                aria-label="Buscar productos por nombre, categoría, uso o características"
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

            {/* Selector de Ordenamiento por Precio / Relevancia */}
            <div className="selector-orden-wrapper" title="Ordenar catálogo">
              <ArrowUpDown size={15} />
              <select
                value={criterioOrden}
                onChange={(e) => setCriterioOrden(e.target.value as any)}
                className="select-criterio-orden"
                aria-label="Ordenar productos por precio o destacados"
              >
                <option value="precio-desc">Mayor a menor ($$$ → $)</option>
                <option value="precio-asc">Menor a mayor ($ → $$$)</option>
                <option value="destacados">Más Pedidos / Destacados</option>
                <option value="nombre-asc">Nombre: A — Z</option>
              </select>
            </div>

            {/* Selector de Rango de Presupuesto */}
            <div className="selector-presupuesto-wrapper" title="Filtrar por presupuesto">
              <SlidersHorizontal size={15} />
              <select
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
              </select>
            </div>

            {/* Botón Filtro Rápido de Ofertas con % de descuento */}
            <button
              type="button"
              className={`btn-filtro-ofertas ${soloOfertas ? 'activo' : ''}`}
              onClick={() => setSoloOfertas(!soloOfertas)}
              title={
                soloOfertas
                  ? 'Mostrar todo el catálogo'
                  : 'Filtrar únicamente productos con oferta o descuento'
              }
              aria-pressed={soloOfertas}
            >
              <span>🔥 Solo Ofertas</span>
              {totalOfertasDisponibles > 0 && (
                <span className="badge-contador-ofertas">{totalOfertasDisponibles}</span>
              )}
            </button>
          </div>
        </div>

        {/* Pestañas de Categorías Multidimensionales + Botón Copiar Link de Categoría */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '6px',
          }}
        >
          <div className="pills-categorias-scroll" style={{ flex: 1, minWidth: 0 }}>
            {categoriasVisibles.map((cat) => {
              const estaActiva = cat.id === categoriaActiva;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`pill-categoria ${estaActiva ? 'pill-activa' : ''} ${cat.modoVisualSobrio ? 'pill-condolencias' : ''}`}
                  onClick={() => handleSeleccionarCategoria(cat.id)}
                >
                  {cat.modoVisualSobrio && <Feather size={14} className="icono-pill" />}
                  <span>{cat.nombre}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopiarEnlaceCategoria}
            className="btn-responsive-accion"
            title={
              categoriaActivaObj && categoriaActiva !== 'cat-todos'
                ? `Copiar link directo de "${categoriaActivaObj.nombre}" para WhatsApp o Chat`
                : 'Copiar link directo del catálogo para WhatsApp o Chat'
            }
            aria-label="Copiar link de categoría"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 13px',
              borderRadius: '999px',
              border: linkCatCopiado ? '1.5px solid #10B981' : '1px solid #E4E4E7',
              background: linkCatCopiado ? '#ECFDF5' : '#FFFFFF',
              color: linkCatCopiado ? '#047857' : '#27272A',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              flexShrink: 0,
            }}
          >
            {linkCatCopiado ? <Check size={14} /> : <Link2 size={14} />}
            <span className="btn-texto-responsive">
              {linkCatCopiado ? 'Link copiado' : 'Copiar link'}
            </span>
          </button>
        </div>

        {/* Grid de Productos con Carruseles Fotográficos */}
        {productosFinales.length === 0 ? (
          <div className="vacio-catalogo-alerta">
            <p>No encontramos arreglos con los filtros seleccionados.</p>
            <button
              type="button"
              className="btn btn-mini"
              onClick={() => {
                setCategoriaActiva('cat-todos');
                setTerminoBusqueda('');
                setFiltroPresupuesto('todos');
                setSoloOfertas(false);
                setCriterioOrden('precio-desc');
              }}
            >
              Restablecer filtros
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
