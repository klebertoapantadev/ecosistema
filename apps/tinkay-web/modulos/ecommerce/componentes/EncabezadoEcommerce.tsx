'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import { expandirProductosVitrina, obtenerCategoriasVisibles } from '../filtrado-catalogo';
import { ShoppingBag, Feather } from 'lucide-react';

export function EncabezadoEcommerce() {
  const {
    cantidadTotal,
    setDrawerAbierto,
    productos,
    categorias,
    categoriaActiva,
    navegarACategoria,
  } = useCarrito();

  const categoriasMenu = useMemo(() => {
    const prodsBase = expandirProductosVitrina(
      productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY
    );
    const catsBase = categorias && categorias.length > 0 ? categorias : CATEGORIAS_TINKAY;
    return obtenerCategoriasVisibles(catsBase, prodsBase);
  }, [productos, categorias]);

  const handleSeleccionMenu = (e: React.MouseEvent<HTMLAnchorElement>, catId: string) => {
    e.preventDefault();
    navegarACategoria(catId);
  };

  return (
    <header className="cabecera-ecommerce-tinkay">
      <div className="barra-superior-anuncio">
        <div className="anuncio-flex-contenido">
          <span>🌸 Entrega puntual hoy en Quito &amp; Valles • Rosas de exportación frescas cada mañana</span>
          <a
            href="https://maps.app.goo.gl/D56gQohzuwha4sLf8"
            target="_blank"
            rel="noopener noreferrer"
            className="enlace-tienda-maps-top"
            title="Ver ubicación de tienda física Tinkay en Google Maps"
          >
            📍 Ver Tienda Física en Quito (Maps)
          </a>
        </div>
      </div>

      <div className="contenedor-cabecera-principal">
        <Link href="/" className="logo-tinkay-marca" aria-label="Tinkay Flores y Eventos">
          <img
            src="/img/logo/tinkay-logo.jpg"
            alt="Tinkay Flores y Eventos"
            className="logo-tinkay-imagen-cabecera"
          />
          <span className="sr-only">Tinkay Flores y Eventos</span>
        </Link>

        <nav className="nav-enlaces-floristeria" aria-label="Categorías principales">
          {categoriasMenu.map((cat) => {
            const esTodos = cat.id === 'cat-todos';
            const estaActiva = categoriaActiva === cat.id;
            const etiquetaMenu = esTodos
              ? 'Catálogo'
              : cat.modoVisualSobrio
              ? 'Condolencias'
              : cat.nombre;

            return (
              <a
                key={cat.id}
                href="#catalogo"
                onClick={(e) => handleSeleccionMenu(e, cat.id)}
                aria-current={estaActiva ? 'true' : undefined}
                className={[
                  cat.modoVisualSobrio ? 'enlace-condolencias' : '',
                  estaActiva ? 'enlace-categoria-activo' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {cat.modoVisualSobrio && <Feather size={14} />}
                <span>{etiquetaMenu}</span>
              </a>
            );
          })}
        </nav>

        <div className="acciones-usuario-cabecera">
          <Link href="/ingresar" className="enlace-ingresar-discreto">
            Ingresar
          </Link>

          <button
            type="button"
            className="btn-carrito-cabecera btn-responsive-accion"
            onClick={() => setDrawerAbierto(true)}
            title="Ver carrito de compras"
            aria-label={`Ver carrito de compras con ${cantidadTotal} productos`}
          >
            <ShoppingBag size={20} />
            <span className="texto-carrito-btn btn-texto-responsive">Carrito</span>
            {cantidadTotal > 0 && (
              <span className="badge-cantidad-carrito">{cantidadTotal}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
