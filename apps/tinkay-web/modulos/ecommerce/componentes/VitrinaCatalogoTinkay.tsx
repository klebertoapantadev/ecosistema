'use client';

import React, { useState, useMemo } from 'react';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import { ProductoEcommerce } from '../tipos';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import { Search, SlidersHorizontal, Feather, Sparkles } from 'lucide-react';

function productoCoincideConCategoria(
  p: ProductoEcommerce,
  catId: string
): boolean {
  if (p.esExtra || p.esComplemento) return false;
  if (p.categoriaPrincipal?.toLowerCase().includes('extra')) return false;
  if (p.categoriaNombre?.toLowerCase().includes('extra')) return false;

  if (catId === 'cat-todos') return true;

  const coincidePrincipal = p.categoriaPrincipal === catId;
  const coincideSecundaria = p.categoriasSecundarias?.includes(catId);

  const catLower = catId.toLowerCase();
  let coincideUso = false;
  if (catLower.includes('aniv')) {
    coincideUso = (p.usos || []).some((u) => u.includes('aniv')) || Boolean(p.categoriasSecundarias?.includes('cat-ocas-aniv'));
  } else if (catLower.includes('amor')) {
    coincideUso = (p.usos || []).some((u) => u.includes('amor') || u.includes('romance') || u.includes('pedida')) || Boolean(p.categoriasSecundarias?.includes('cat-ocas-amor'));
  } else if (catLower.includes('cumple')) {
    coincideUso = (p.usos || []).some((u) => u.includes('cumple') || u.includes('festejo')) || Boolean(p.categoriasSecundarias?.includes('cat-ocas-cumple'));
  } else if (catLower.includes('condol')) {
    coincideUso = Boolean(p.esCondolencias) || (p.usos || []).some((u) => u.includes('condol') || u.includes('duelo')) || Boolean(p.categoriasSecundarias?.includes('cat-ocas-condol'));
  } else {
    coincideUso = (p.usos || []).some((u) => u === catLower || u.includes(catLower));
  }

  return coincidePrincipal || Boolean(coincideSecundaria) || coincideUso;
}

export function VitrinaCatalogoTinkay() {
  const { productos, categorias } = useCarrito();
  const catalogoProductos = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
  const catalogoCategorias = categorias && categorias.length > 0 ? categorias : CATEGORIAS_TINKAY;

  const [categoriaActiva, setCategoriaActiva] = useState<string>('cat-todos');
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [filtroPresupuesto, setFiltroPresupuesto] = useState<string>('todos');

  const esModoCondolencias = categoriaActiva === 'cat-ocas-condol';

  // 1. Expandir productos que deben desplegarse como variantes individuales (ej. Box Florales)
  const productosBaseDesplegados = useMemo(() => {
    return catalogoProductos.flatMap((p) => {
      // Ocultar estrictamente productos de la categoría "Extras" del catálogo principal
      if (p.esExtra || p.esComplemento) return [];
      if (p.categoriaPrincipal?.toLowerCase().includes('extra')) return [];
      if (p.categoriaNombre?.toLowerCase().includes('extra')) return [];

      const esBoxFlorales =
        p.slug === 'box-florales' ||
        p.categoriaPrincipal === 'box-florales' ||
        p.categoriaNombre?.toLowerCase().includes('box floral') ||
        p.nombre.toLowerCase().includes('box floral');

      if (esBoxFlorales && p.variantes && p.variantes.length > 1) {
        // Galería completa de todas las variaciones para las miniaturas del modal
        const todasLasFotosModal = p.variantes
          .map((v) => v.foto)
          .filter((f): f is string => Boolean(f));

        return p.variantes.map((v) => {
          // Para la tarjeta individual de la vitrina: ÚNICAMENTE la foto de esta variación
          const fotosTarjetaIndividual = v.foto ? [v.foto] : p.fotos.slice(0, 1);

          const productoIndividual: ProductoEcommerce = {
            ...p,
            id: `${p.id}__${v.sku}`,
            slug: `${p.slug}-${v.sku.toLowerCase()}`,
            nombre: v.nombre, // ej: "Box Floral (L)", "Mix Floral (XXL)", etc.
            descripcionCorta: v.detalle || p.descripcionCorta,
            fotos: fotosTarjetaIndividual, // En la vitrina: SOLO muestra la imagen de esta variación individual
            fotosModal: todasLasFotosModal.length > 0 ? todasLasFotosModal : p.fotos, // En el modal: galería de todas las variaciones
            variantes: p.variantes, // En el modal: lista completa de variantes para alternar
            varianteInicialSku: v.sku, // Marca cuál variante abrió el usuario
            destacado: p.destacado,
          };
          return productoIndividual;
        });
      }

      return [p];
    });
  }, [catalogoProductos]);

  // 2. Categorías visibles: ocultar extras Y ocultar estrictamente grupos/categorías sin productos
  const categoriasVisibles = useMemo(() => {
    const candidatas = catalogoCategorias.filter((cat) => {
      const nombreLower = (cat.nombre || '').toLowerCase();
      const slugLower = (cat.slug || '').toLowerCase();
      return (
        !nombreLower.includes('extra') &&
        !slugLower.includes('extra') &&
        cat.tipo !== 'COMPLEMENTO'
      );
    });

    // Descartar grupos o categorías sin productos activos disponibles
    return candidatas.filter((cat) => {
      if (cat.id === 'cat-todos') return true;
      return productosBaseDesplegados.some((p) => productoCoincideConCategoria(p, cat.id));
    });
  }, [catalogoCategorias, productosBaseDesplegados]);

  // Si la categoría activa quedó sin productos o se ocultó, regresar a 'cat-todos'
  React.useEffect(() => {
    if (
      categoriaActiva !== 'cat-todos' &&
      categoriasVisibles.length > 0 &&
      !categoriasVisibles.some((c) => c.id === categoriaActiva)
    ) {
      setCategoriaActiva('cat-todos');
    }
  }, [categoriasVisibles, categoriaActiva]);

  // 3. Filtrado reactivo de productos por categoría, búsqueda y presupuesto
  const productosFiltrados = useMemo(() => {
    return productosBaseDesplegados.filter((p) => {
      // Filtro de categoría y ocasión
      if (categoriaActiva !== 'cat-todos') {
        if (!productoCoincideConCategoria(p, categoriaActiva)) return false;
      }

      // Filtro de búsqueda por texto
      if (terminoBusqueda.trim()) {
        const query = terminoBusqueda.toLowerCase().trim();
        const coincideNombre = p.nombre.toLowerCase().includes(query);
        const coincideDesc = p.descripcionCorta.toLowerCase().includes(query);
        const coincideEtiqueta = p.etiquetas.some((e) => e.toLowerCase().includes(query));
        if (!coincideNombre && !coincideDesc && !coincideEtiqueta) return false;
      }

      // Filtro de presupuesto individual
      if (filtroPresupuesto !== 'todos') {
        const pvp = p.variantes[0]?.pvp ?? 0;
        if (filtroPresupuesto === 'menor-30' && pvp > 30) return false;
        if (filtroPresupuesto === '30-50' && (pvp < 30 || pvp > 50)) return false;
        if (filtroPresupuesto === 'mayor-50' && pvp < 50) return false;
      }

      return true;
    });
  }, [categoriaActiva, terminoBusqueda, filtroPresupuesto, productosBaseDesplegados]);

  return (
    <section className={`seccion-vitrina-catalogo ${esModoCondolencias ? 'vitrina-modo-condolencias' : ''}`} id="catalogo">
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
                : 'Flores con Historia, Para Cada Momento'}
            </h2>
            <p className="subtitulo-seccion-vitrina">
              {esModoCondolencias
                ? 'Composiciones solemnes en blanco y follajes andinos para acompañar en los momentos más difíciles con entrega puntual en velaciones e iglesias.'
                : 'Explora nuestros bouquets coreanos, ramos para florero y complementos gourmet preparados con rosas frescas de exportación.'}
            </p>
          </div>

          {/* Barra de Búsqueda y Filtros Rápidos */}
          <div className="barra-busqueda-vitrina">
            <div className="campo-busqueda-icono">
              <Search size={18} className="icono-busqueda" />
              <input
                type="text"
                placeholder="Buscar por flores, estilo, ocasión (ej. rosas rojas, coreano)..."
                value={terminoBusqueda}
                onChange={(e) => setTerminoBusqueda(e.target.value)}
                className="input-busqueda-catalogo"
              />
              {terminoBusqueda && (
                <button
                  type="button"
                  onClick={() => setTerminoBusqueda('')}
                  className="btn-limpiar-busqueda"
                >
                  ×
                </button>
              )}
            </div>

            <div className="selector-presupuesto-wrapper">
              <SlidersHorizontal size={16} />
              <select
                value={filtroPresupuesto}
                onChange={(e) => setFiltroPresupuesto(e.target.value)}
                className="select-filtro-presupuesto"
                aria-label="Filtrar por rango de presupuesto"
              >
                <option value="todos">Cualquier Presupuesto</option>
                <option value="menor-30">Hasta $30.00</option>
                <option value="30-50">$30.00 - $50.00</option>
                <option value="mayor-50">Más de $50.00</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pestañas de Categorías Multidimensionales */}
        <div className="pills-categorias-scroll">
          {categoriasVisibles.map((cat) => {
            const estaActiva = cat.id === categoriaActiva;
            return (
              <button
                key={cat.id}
                type="button"
                className={`pill-categoria ${estaActiva ? 'pill-activa' : ''} ${cat.modoVisualSobrio ? 'pill-condolencias' : ''}`}
                onClick={() => setCategoriaActiva(cat.id)}
              >
                {cat.modoVisualSobrio && <Feather size={14} className="icono-pill" />}
                <span>{cat.nombre}</span>
              </button>
            );
          })}
        </div>

        {/* Grid de Productos con Carruseles Fotográficos */}
        {productosFiltrados.length === 0 ? (
          <div className="vacio-catalogo-alerta">
            <p>No encontramos arreglos con los filtros seleccionados.</p>
            <button
              type="button"
              className="btn btn-mini"
              onClick={() => {
                setCategoriaActiva('cat-todos');
                setTerminoBusqueda('');
                setFiltroPresupuesto('todos');
              }}
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          <div className="grid-productos-vitrina">
            {productosFiltrados.map((producto) => (
              <TarjetaProductoConCarrusel
                key={producto.id}
                producto={producto}
                modoSobrio={esModoCondolencias}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
