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
        <span>🌸 Entrega puntual hoy en Quito &amp; Valles • Rosas de exportación frescas cada mañana</span>
      </div>

      <div className="contenedor-cabecera-principal">
        <Link href="/" className="logo-tinkay-marca">
          <span>tinkay</span>
        </Link>

        <nav className="nav-enlaces-floristeria">
          <a href="#catalogo">Catálogo</a>
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
