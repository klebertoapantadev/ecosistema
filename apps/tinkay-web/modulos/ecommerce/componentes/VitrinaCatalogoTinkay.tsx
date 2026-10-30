'use client';

import React, { useState, useMemo } from 'react';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import { Search, SlidersHorizontal, Feather, Sparkles } from 'lucide-react';

export function VitrinaCatalogoTinkay() {
  const { productos, categorias } = useCarrito();
  const catalogoProductos = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
  const catalogoCategorias = categorias && categorias.length > 0 ? categorias : CATEGORIAS_TINKAY;

  const [categoriaActiva, setCategoriaActiva] = useState<string>('cat-todos');
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [filtroPresupuesto, setFiltroPresupuesto] = useState<string>('todos');

  const esModoCondolencias = categoriaActiva === 'cat-ocas-condol';

  // Categorías visibles: ocultar categorías de tipo "Extras" / complementos de la barra principal
  const categoriasVisibles = useMemo(() => {
    return catalogoCategorias.filter((cat) => {
      const nombreLower = (cat.nombre || '').toLowerCase();
      const slugLower = (cat.slug || '').toLowerCase();
      return (
        !nombreLower.includes('extra') &&
        !slugLower.includes('extra') &&
        cat.tipo !== 'COMPLEMENTO'
      );
    });
  }, [catalogoCategorias]);

  const productosFiltrados = useMemo(() => {
    return catalogoProductos.filter((p) => {
      // 1. Ocultar estrictamente productos de la categoría "Extras" del catálogo principal
      if (p.esExtra || p.esComplemento) return false;
      if (p.categoriaPrincipal?.toLowerCase().includes('extra')) return false;
      if (p.categoriaNombre?.toLowerCase().includes('extra')) return false;

      // Filtro de categoría y ocasión multidimensional
      if (categoriaActiva !== 'cat-todos') {
        const coincidePrincipal = p.categoriaPrincipal === categoriaActiva;
        const coincideSecundaria = p.categoriasSecundarias?.includes(categoriaActiva);

        // Cruce multidimensional con usos y ocasiones de compra
        const catActivaLower = categoriaActiva.toLowerCase();
        let coincideUso = false;
        if (catActivaLower.includes('aniv')) {
          coincideUso = (p.usos || []).some((u) => u.includes('aniv')) || p.categoriasSecundarias?.includes('cat-ocas-aniv');
        } else if (catActivaLower.includes('amor')) {
          coincideUso = (p.usos || []).some((u) => u.includes('amor') || u.includes('romance') || u.includes('pedida')) || p.categoriasSecundarias?.includes('cat-ocas-amor');
        } else if (catActivaLower.includes('cumple')) {
          coincideUso = (p.usos || []).some((u) => u.includes('cumple') || u.includes('festejo')) || p.categoriasSecundarias?.includes('cat-ocas-cumple');
        } else if (catActivaLower.includes('condol')) {
          coincideUso = p.esCondolencias || (p.usos || []).some((u) => u.includes('condol') || u.includes('duelo')) || p.categoriasSecundarias?.includes('cat-ocas-condol');
        } else {
          coincideUso = (p.usos || []).some((u) => u === catActivaLower || u.includes(catActivaLower));
        }

        if (!coincidePrincipal && !coincideSecundaria && !coincideUso) return false;
      }

      // Filtro de búsqueda por texto
      if (terminoBusqueda.trim()) {
        const query = terminoBusqueda.toLowerCase().trim();
        const coincideNombre = p.nombre.toLowerCase().includes(query);
        const coincideDesc = p.descripcionCorta.toLowerCase().includes(query);
        const coincideEtiqueta = p.etiquetas.some((e) => e.toLowerCase().includes(query));
        if (!coincideNombre && !coincideDesc && !coincideEtiqueta) return false;
      }

      // Filtro de presupuesto
      if (filtroPresupuesto !== 'todos') {
        const precioMin = Math.min(...p.variantes.map((v) => v.pvp));
        if (filtroPresupuesto === 'menor-30' && precioMin > 30) return false;
        if (filtroPresupuesto === '30-50' && (precioMin < 30 || precioMin > 50)) return false;
        if (filtroPresupuesto === 'mayor-50' && precioMin < 50) return false;
      }

      return true;
    });
  }, [categoriaActiva, terminoBusqueda, filtroPresupuesto, catalogoProductos]);

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
