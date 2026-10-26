'use client';

import React, { useRef } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export function CarruselProductosDestacados() {
  const { productos } = useCarrito();
  const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
  const scrollRef = useRef<HTMLDivElement>(null);
  const productosDestacados = catalogo.filter((p) => p.destacado);

  const scroll = (direccion: 'izq' | 'der') => {
    if (!scrollRef.current) return;
    const offset = direccion === 'izq' ? -340 : 340;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section className="seccion-carrusel-destacados">
      <div className="cabecera-carrusel-destacados">
        <div className="titulos-seccion-destacados">
          <div className="badge-seccion">
            <Sparkles size={14} />
            <span>Colección Seleccionada</span>
          </div>
          <h2>Lo Más Solicitado de Tinkay</h2>
          <p>Arreglos botánicos icónicos preparados frescos cada mañana en nuestro taller.</p>
        </div>

        <div className="botones-flechas-carrusel">
          <button
            type="button"
            className="btn-flecha-scroll"
            onClick={() => scroll('izq')}
            aria-label="Desplazar a la izquierda"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="btn-flecha-scroll"
            onClick={() => scroll('der')}
            aria-label="Desplazar a la derecha"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="riel-carrusel-destacados" ref={scrollRef}>
        {productosDestacados.map((producto) => (
          <div key={producto.id} className="item-riel-destacados">
            <TarjetaProductoConCarrusel producto={producto} />
          </div>
        ))}
      </div>
    </section>
  );
}
