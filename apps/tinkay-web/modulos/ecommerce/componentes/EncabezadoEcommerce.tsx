'use client';

import React from 'react';
import Link from 'next/link';
import { useCarrito } from '../contexto-carrito';
import { ShoppingBag, Feather } from 'lucide-react';

export function EncabezadoEcommerce() {
  const { cantidadTotal, setDrawerAbierto } = useCarrito();

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

        <nav className="nav-enlaces-floristeria">
          <a href="#catalogo">Catálogo</a>
          <a href="#catalogo">Box Florales</a>
          <a href="#catalogo">Estilo Coreano</a>
          <a href="#catalogo">Para Florero</a>
          <a href="#catalogo" className="enlace-condolencias">
            <Feather size={14} />
            <span>Condolencias</span>
          </a>
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
