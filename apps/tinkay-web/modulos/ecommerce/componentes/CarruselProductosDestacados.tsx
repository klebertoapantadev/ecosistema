'use client';

import React, { useRef } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export function CarruselProductosDestacados() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { productos } = useCarrito();
  const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
  const productosDestacados = catalogo.filter(
    (p) =>
      p.destacado &&
      !p.esExtra &&
      !p.esComplemento &&
      !p.categoriaPrincipal?.toLowerCase().includes('extra') &&
      !p.categoriaNombre?.toLowerCase().includes('extra')
  );

  const scroll = (direccion: 'izq' | 'der') => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const paso = 340;

    if (direccion === 'der') {
      // Si ya está al final (o a menos de 25px del final), vuelve fluidamente al inicio
      if (el.scrollLeft >= maxScroll - 25) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const nuevoScroll = Math.min(el.scrollLeft + paso, maxScroll);
        el.scrollTo({ left: nuevoScroll, behavior: 'smooth' });
      }
    } else {
      // Si ya está al inicio (o a menos de 25px del inicio), va fluidamente al final
      if (el.scrollLeft <= 25) {
        el.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        const nuevoScroll = Math.max(el.scrollLeft - paso, 0);
        el.scrollTo({ left: nuevoScroll, behavior: 'smooth' });
      }
    }
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
