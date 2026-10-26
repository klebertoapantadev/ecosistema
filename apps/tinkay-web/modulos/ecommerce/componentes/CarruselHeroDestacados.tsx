'use client';

import React, { useState, useEffect } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Clock, ShieldCheck, Heart } from 'lucide-react';

const SLIDES_HERO = [
  {
    id: 'slide-coreano',
    productoId: 'tinkay-bouq-coreano',
    etiqueta: 'EDICIÓN ESPECIAL 2026',
    titulo: 'Bouquets Estilo Coreano',
    subtitulo: 'Plisados vaporosos, capas translúcidas y rosas de exportación con apertura perfecta.',
    imagen: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1400&q=85',
    precioDesde: '$25.00',
    botonTexto: 'Ver Colección Coreana',
  },
  {
    id: 'slide-100rosas',
    productoId: 'tinkay-bouq-florero',
    etiqueta: 'ROMANCE & PEDIDA DE MANO',
    titulo: '100 Rosas de Gran Impacto',
    subtitulo: 'Tallos largos de 70 cm preparados en espiral para deslumbrar en cualquier espacio.',
    imagen: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=85',
    precioDesde: '$20.00',
    botonTexto: 'Explorar Ramos de Rosas',
  },
  {
    id: 'slide-mix',
    productoId: 'tinkay-bouq-mix',
    etiqueta: 'BOTÁNICA ANDINA SOSTENIBLE',
    titulo: 'Mix Exótico de Temporada',
    subtitulo: 'Orquídeas, hortensias celestes y follaje aromático de eucalipto fresco.',
    imagen: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1400&q=85',
    precioDesde: '$35.00',
    botonTexto: 'Descubrir Mix Exótico',
  },
];

export function CarruselHeroDestacados() {
  const { setProductoSeleccionadoModal } = useCarrito();
  const [slideActivo, setSlideActivo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideActivo((prev) => (prev + 1) % SLIDES_HERO.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES_HERO[slideActivo] ?? SLIDES_HERO[0]!;

  const handleVerProducto = () => {
    const prod = PRODUCTOS_TINKAY.find((p) => p.id === slide.productoId);
    if (prod) {
      setProductoSeleccionadoModal(prod);
    }
  };

  return (
    <div className="hero-carrusel-contenedor">
      {/* Fondo con imagen y degradado botánico */}
      <div
        className="hero-fondo-imagen"
        style={{ backgroundImage: `url(${slide.imagen})` }}
      >
        <div className="hero-overlay-gradiente" />
      </div>

      {/* Contenido Editorial */}
      <div className="hero-contenido-editorial">
        <div className="hero-badge-superior">
          <Sparkles size={14} className="icono-dorado" />
          <span>{slide.etiqueta}</span>
        </div>

        <h1 className="hero-titulo-display">{slide.titulo}</h1>

        <p className="hero-descripcion-lead">{slide.subtitulo}</p>

        <div className="hero-fila-cta">
          <button
            type="button"
            className="btn-hero-primario"
            onClick={handleVerProducto}
          >
            <span>{slide.botonTexto}</span>
            <ArrowRight size={18} />
          </button>

          <div className="hero-precio-etiqueta">
            <span className="precio-desde">Desde</span>
            <span className="precio-cifra">{slide.precioDesde}</span>
          </div>
        </div>

        {/* Pilares de Valor de Tinkay */}
        <div className="hero-pilares">
          <div className="pilar-item">
            <Clock size={16} />
            <span>Entrega puntual en Quito &amp; Valles</span>
          </div>
          <div className="pilar-item">
            <ShieldCheck size={16} />
            <span>Rosas de exportación garantizadas</span>
          </div>
          <div className="pilar-item">
            <Heart size={16} />
            <span>Tarjeta caligráfica personalizada</span>
          </div>
        </div>
      </div>

      {/* Controles de Navegación del Hero */}
      <div className="hero-controles">
        <button
          type="button"
          className="btn-nav-hero"
          onClick={() => setSlideActivo((prev) => (prev === 0 ? SLIDES_HERO.length - 1 : prev - 1))}
          aria-label="Slide anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="indicadores-hero">
          {SLIDES_HERO.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`indicador-barra ${i === slideActivo ? 'activo' : ''}`}
              onClick={() => setSlideActivo(i)}
              aria-label={`Ir al slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn-nav-hero"
          onClick={() => setSlideActivo((prev) => (prev + 1) % SLIDES_HERO.length)}
          aria-label="Siguiente slide"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
