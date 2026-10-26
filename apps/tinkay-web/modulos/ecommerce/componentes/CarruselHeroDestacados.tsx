'use client';

import React, { useState, useEffect } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Clock, ShieldCheck, Heart } from 'lucide-react';

const SLIDES_HERO = [
  {
    id: 'slide-coreano',
    productoId: 'tinkay-bouq-mix',
    etiqueta: 'TENDENCIA COREANA 2026',
    titulo: 'Bouquets Estilo Coreano',
    subtitulo: 'Plisados vaporosos, capas translúcidas y rosas de exportación con base hidratada.',
    imagen: 'https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1792605252605-coreano_l__1_.jpg',
    precioDesde: '$28.00',
    botonTexto: 'Ver Colección Coreana',
  },
  {
    id: 'slide-box',
    productoId: 'box-florales',
    etiqueta: 'COLECCIÓN EXCLUSIVA',
    titulo: 'Box Florales de Lujo',
    subtitulo: 'Cajas rígidas de alta costura con rosas frescas seleccionadas y orquídeas en base hidratada OASIS.',
    imagen: 'https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1792674929601-box_floral_m__2_.jpg',
    precioDesde: '$40.00 (Box M)',
    botonTexto: 'Explorar Box Florales',
  },
  {
    id: 'slide-100rosas',
    productoId: 'tinkay-bouq-florero',
    etiqueta: 'ROSAS DE EXPORTACIÓN',
    titulo: 'Ramos Clásicos para Florero',
    subtitulo: 'Tallos largos de 70 cm en espiral (25, 50 y 100 rosas) con sobre de nutriente Chrysal incluido.',
    imagen: 'https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1792605329074-bouquet50__1_.png',
    precioDesde: '$23.00',
    botonTexto: 'Ver Ramos para Florero',
  },
  {
    id: 'slide-tienda',
    productoId: '',
    etiqueta: 'TIENDA FÍSICA EN QUITO',
    titulo: 'Visita Nuestro Taller Floral',
    subtitulo: 'Conoce nuestras instalaciones en Quito, retira tus pedidos o recibe asesoría personalizada.',
    imagen: '/img/logo/tinkay-tienda-neon.jpg',
    precioDesde: 'Quito',
    botonTexto: '📍 Abrir en Google Maps',
    enlaceExterno: 'https://maps.app.goo.gl/D56gQohzuwha4sLf8',
  },
];

export function CarruselHeroDestacados() {
  const { setProductoSeleccionadoModal, productos } = useCarrito();
  const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
  const [slideActivo, setSlideActivo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideActivo((prev) => (prev + 1) % SLIDES_HERO.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES_HERO[slideActivo] ?? SLIDES_HERO[0]!;

  const handleVerProducto = () => {
    if (slide.enlaceExterno) {
      window.open(slide.enlaceExterno, '_blank', 'noopener,noreferrer');
      return;
    }
    const prod = catalogo.find((p) => p.id === slide.productoId || p.slug === slide.productoId);
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
