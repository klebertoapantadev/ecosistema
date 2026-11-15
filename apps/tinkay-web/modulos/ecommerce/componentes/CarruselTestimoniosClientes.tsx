'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle2,
  ExternalLink,
  ZoomIn,
  X,
  MessageSquareHeart,
  Camera,
} from 'lucide-react';
import {
  TESTIMONIOS_TINKAY,
  ENLACE_ALBUM_GOOGLE_PHOTOS,
  type TestimonioCliente,
} from '../datos-testimonios';

export function CarruselTestimoniosClientes() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [listaTestimonios, setListaTestimonios] = useState<TestimonioCliente[]>(TESTIMONIOS_TINKAY);
  const [testimonioSeleccionado, setTestimonioSeleccionado] = useState<TestimonioCliente | null>(null);

  useEffect(() => {
    async function sincronizarBDD() {
      try {
        const { obtenerTestimoniosNegocioAction } = await import('@eco/comercio');
        const res = await obtenerTestimoniosNegocioAction('tinkay', true);
        if (res.ok && res.testimonios && res.testimonios.length > 0) {
          const mapeados: TestimonioCliente[] = res.testimonios.map((t) => ({
            id: t.tes_id,
            nombreCliente: t.tes_nombre_cliente,
            ciudad: t.tes_ciudad,
            ocasion: t.tes_ocasion,
            comentario: t.tes_comentario,
            imagenUrl: t.tes_imagen_url,
            calificacion: t.tes_calificacion,
            destacado: t.tes_destacado,
          }));
          setListaTestimonios(mapeados);
        }
      } catch {
        // Conserva TESTIMONIOS_TINKAY estático
      }
    }
    sincronizarBDD();
  }, []);

  const scroll = (direccion: 'izq' | 'der') => {
    if (!scrollRef.current) return;
    const offset = direccion === 'izq' ? -360 : 360;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Manejo de teclado para cerrar el lightbox con Escape o navegar con flechas
  useEffect(() => {
    if (!testimonioSeleccionado) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTestimonioSeleccionado(null);
      } else if (e.key === 'ArrowRight') {
        const idx = listaTestimonios.findIndex((t) => t.id === testimonioSeleccionado.id);
        if (idx !== -1 && idx < listaTestimonios.length - 1) {
          const sig = listaTestimonios[idx + 1];
          if (sig) setTestimonioSeleccionado(sig);
        }
      } else if (e.key === 'ArrowLeft') {
        const idx = listaTestimonios.findIndex((t) => t.id === testimonioSeleccionado.id);
        if (idx > 0) {
          const ant = listaTestimonios[idx - 1];
          if (ant) setTestimonioSeleccionado(ant);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testimonioSeleccionado, listaTestimonios]);

  return (
    <section className="seccion-testimonios-tinkay" aria-label="Testimonios de Clientes Tinkay">
      <div className="contenedor-maximo">
        {/* Cabecera Editorial */}
        <div className="cabecera-seccion-testimonios">
          <div className="titulos-testimonios">
            <div className="badge-social-proof">
              <MessageSquareHeart size={15} />
              <span>Prueba Social &amp; Entregas Reales</span>
            </div>
            <h2>Momentos Tinkay: La voz de quienes confían en nosotros</h2>
            <p>
              Capturas reales de conversaciones y entregas compartidas por nuestros clientes tras recibir
              sus arreglos en Quito y los Valles.
            </p>
          </div>

          <div className="acciones-cabecera-testimonios">
            <div className="botones-flechas-carrusel">
              <button
                type="button"
                className="btn-flecha-scroll"
                onClick={() => scroll('izq')}
                title="Desplazar a la izquierda"
                aria-label="Desplazar testimonios a la izquierda"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="btn-flecha-scroll"
                onClick={() => scroll('der')}
                title="Desplazar a la derecha"
                aria-label="Desplazar testimonios a la derecha"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Riel Horizontal Deslizable */}
        <div className="riel-testimonios-tinkay" ref={scrollRef}>
          {listaTestimonios.map((testimonio) => (
            <article key={testimonio.id} className="tarjeta-testimonio-card">
              {/* Marco de Captura / Fotografía */}
              <div
                className="marco-foto-testimonio"
                onClick={() => setTestimonioSeleccionado(testimonio)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTestimonioSeleccionado(testimonio);
                  }
                }}
                title="Clic para ampliar foto o captura de chat"
                aria-label={`Ampliar testimonio de ${testimonio.nombreCliente}`}
              >
                <img
                  src={testimonio.imagenUrl}
                  alt={`Testimonio y entrega floral para ${testimonio.nombreCliente}`}
                  className="foto-testimonio-img"
                  loading="lazy"
                />
                <span className="pildora-ocasion-testimonio">{testimonio.ocasion}</span>
                <div className="overlay-lupa-testimonio">
                  <ZoomIn size={18} />
                  <span>Ampliar</span>
                </div>
              </div>

              {/* Información y Mensaje del Cliente */}
              <div className="cuerpo-testimonio">
                <div className="fila-estrellas-verificado">
                  <div className="estrellas-calificacion" aria-label="Calificación 5 de 5 estrellas">
                    {[...Array(testimonio.calificacion)].map((_, i) => (
                      <Star key={i} size={15} fill="currentColor" />
                    ))}
                  </div>
                  <span className="badge-cliente-verificado">
                    <CheckCircle2 size={13} />
                    <span>Verificado</span>
                  </span>
                </div>

                <blockquote className="comentario-cita-testimonio">
                  {testimonio.comentario}
                </blockquote>

                <footer className="autor-testimonio">
                  <div className="datos-autor-linea">
                    <strong className="nombre-cliente">{testimonio.nombreCliente}</strong>
                    <span className="separador-punto">•</span>
                    <span className="ciudad-cliente">{testimonio.ciudad}</span>
                  </div>
                  {testimonio.fecha && <span className="fecha-testimonio">{testimonio.fecha}</span>}
                </footer>
              </div>
            </article>
          ))}

          {/* Tarjeta Final: Enlace al Álbum de Google Photos */}
          <div className="tarjeta-cta-album-google">
            <div className="icono-album-circulo">
              <Camera size={32} />
            </div>
            <h3>+100 Entregas y Momentos Reales</h3>
            <p>
              Explora fotos de entregas en vivo, reacciones de clientes y arreglos en nuestro álbum oficial
              de Google Photos.
            </p>
            <a
              href={ENLACE_ALBUM_GOOGLE_PHOTOS}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ver-album-google"
              title="Abrir álbum oficial en Google Photos"
              aria-label="Abrir álbum de fotos de entregas en Google Photos"
            >
              <span>Ver Álbum en Google Photos</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* Barra inferior destacada de confianza */}
        <div className="banner-social-proof-inferior">
          <div className="item-metrica-social">
            <span className="numero-metrica">4.9 / 5.0</span>
            <span className="etiqueta-metrica">Promedio de satisfacción</span>
          </div>
          <div className="separador-barra-social" />
          <div className="item-metrica-social">
            <span className="numero-metrica">+1,200</span>
            <span className="etiqueta-metrica">Arreglos entregados en Quito</span>
          </div>
          <div className="separador-barra-social" />
          <div className="item-metrica-social">
            <span className="numero-metrica">100%</span>
            <span className="etiqueta-metrica">Garantía de frescura andina</span>
          </div>
          <div className="separador-barra-social" />
          <div className="cta-enlace-album-inline">
            <a
              href={ENLACE_ALBUM_GOOGLE_PHOTOS}
              target="_blank"
              rel="noopener noreferrer"
              className="enlace-discreto-album"
              title="Abrir galería fotográfica externa"
            >
              <Camera size={16} />
              <span>Ver todas las fotos en nuestro álbum digital ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Modal Lightbox para Ampliar Screenshot */}
      {testimonioSeleccionado && (
        <div
          className="modal-lightbox-backdrop"
          onClick={() => setTestimonioSeleccionado(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle ampliado de testimonio"
        >
          <div
            className="modal-lightbox-contenido"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn-cerrar-lightbox"
              onClick={() => setTestimonioSeleccionado(null)}
              title="Cerrar vista ampliada (Esc)"
              aria-label="Cerrar vista ampliada"
            >
              <X size={22} />
            </button>

            <div className="lightbox-grid-layout">
              <div className="lightbox-lado-imagen">
                <img
                  src={testimonioSeleccionado.imagenUrl}
                  alt={`Captura o foto de entrega para ${testimonioSeleccionado.nombreCliente}`}
                  className="lightbox-imagen-grande"
                />
              </div>

              <div className="lightbox-lado-info">
                <div className="pildora-ocasion-testimonio" style={{ alignSelf: 'flex-start' }}>
                  {testimonioSeleccionado.ocasion}
                </div>

                <div className="fila-estrellas-verificado" style={{ marginTop: '8px' }}>
                  <div className="estrellas-calificacion">
                    {[...Array(testimonioSeleccionado.calificacion)].map((_, i) => (
                      <Star key={i} size={18} fill="currentColor" />
                    ))}
                  </div>
                  <span className="badge-cliente-verificado">
                    <CheckCircle2 size={15} />
                    <span>Cliente Verificado</span>
                  </span>
                </div>

                <blockquote className="lightbox-comentario-texto">
                  {testimonioSeleccionado.comentario}
                </blockquote>

                <div className="lightbox-datos-autor">
                  <strong>{testimonioSeleccionado.nombreCliente}</strong>
                  <span>{testimonioSeleccionado.ciudad}</span>
                  {testimonioSeleccionado.fecha && (
                    <small style={{ color: 'var(--gris-suave)' }}>
                      {testimonioSeleccionado.fecha}
                    </small>
                  )}
                </div>

                <div className="lightbox-acciones-footer">
                  <a
                    href={ENLACE_ALBUM_GOOGLE_PHOTOS}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ver-album-google"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span>Ver más entregas en Google Photos</span>
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
