'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import { TarjetaProductoConCarrusel } from './TarjetaProductoConCarrusel';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

function reposicionarScrollSinSalto(el: HTMLDivElement, nuevoLeft: number) {
  const prevSnap = el.style.scrollSnapType;
  const prevBehavior = el.style.scrollBehavior;
  el.style.scrollSnapType = 'none';
  el.style.scrollBehavior = 'auto';
  el.scrollLeft = nuevoLeft;
  void el.offsetWidth;
  el.style.scrollSnapType = prevSnap;
  el.style.scrollBehavior = prevBehavior;
}

export function CarruselProductosDestacados() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ajustandoRef = useRef(false);
  const { productos } = useCarrito();
  const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;

  const productosDestacados = useMemo(
    () =>
      catalogo.filter(
        (p) =>
          p.destacado &&
          !p.esExtra &&
          !p.esComplemento &&
          !p.categoriaPrincipal?.toLowerCase().includes('extra') &&
          !p.categoriaNombre?.toLowerCase().includes('extra')
      ),
    [catalogo]
  );

  const esInfinito = productosDestacados.length > 1;
  const itemsRenderizados = useMemo(() => {
    if (!esInfinito) {
      return productosDestacados.map((producto, idx) => ({
        key: `${producto.id}-0-${idx}`,
        producto,
        copia: 0,
      }));
    }
    return [0, 1, 2].flatMap((copia) =>
      productosDestacados.map((producto, idx) => ({
        key: `${producto.id}-${copia}-${idx}`,
        producto,
        copia,
      }))
    );
  }, [esInfinito, productosDestacados]);

  const obtenerMetricasCiclo = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !esInfinito) return null;
    const totalBase = productosDestacados.length;
    const hijos = el.children;
    if (hijos.length < totalBase * 2) return null;
    const primero = hijos[0] as HTMLElement | undefined;
    const segundo = hijos[1] as HTMLElement | undefined;
    const inicioCopiaMedia = hijos[totalBase] as HTMLElement | undefined;
    if (!primero || !inicioCopiaMedia) return null;
    const anchoCiclo = inicioCopiaMedia.offsetLeft - primero.offsetLeft;
    if (anchoCiclo <= 0) return null;
    const paso = segundo ? Math.max(200, segundo.offsetLeft - primero.offsetLeft) : 340;
    return { el, anchoCiclo, paso };
  }, [esInfinito, productosDestacados.length]);

  const normalizarPosicion = useCallback(() => {
    const m = obtenerMetricasCiclo();
    if (!m || ajustandoRef.current) return;
    const { el, anchoCiclo } = m;
    if (el.scrollLeft >= anchoCiclo * 2 - 4) {
      ajustandoRef.current = true;
      reposicionarScrollSinSalto(el, el.scrollLeft - anchoCiclo);
      ajustandoRef.current = false;
    } else if (el.scrollLeft <= anchoCiclo * 0.5) {
      ajustandoRef.current = true;
      reposicionarScrollSinSalto(el, el.scrollLeft + anchoCiclo);
      ajustandoRef.current = false;
    }
  }, [obtenerMetricasCiclo]);

  // Posicionar inicialmente en el inicio de la copia central para permitir avance infinito en ambos sentidos
  useEffect(() => {
    if (!esInfinito) return;
    const centrar = () => {
      const m = obtenerMetricasCiclo();
      if (!m) return;
      ajustandoRef.current = true;
      reposicionarScrollSinSalto(m.el, m.anchoCiclo);
      ajustandoRef.current = false;
    };
    const raf = requestAnimationFrame(centrar);
    return () => cancelAnimationFrame(raf);
  }, [esInfinito, obtenerMetricasCiclo]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !esInfinito) return;

    const alScroll = () => {
      if (ajustandoRef.current) return;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        normalizarPosicion();
      }, 150);
    };

    const alScrollEnd = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      normalizarPosicion();
    };

    el.addEventListener('scroll', alScroll, { passive: true });
    el.addEventListener('scrollend', alScrollEnd as EventListener, { passive: true });
    return () => {
      el.removeEventListener('scroll', alScroll);
      el.removeEventListener('scrollend', alScrollEnd as EventListener);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [esInfinito, normalizarPosicion]);

  const scroll = (direccion: 'izq' | 'der') => {
    const el = scrollRef.current;
    if (!el) return;
    const m = obtenerMetricasCiclo();

    if (!m) {
      const paso = 340;
      el.scrollBy({ left: direccion === 'der' ? paso : -paso, behavior: 'smooth' });
      return;
    }

    const { anchoCiclo, paso } = m;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (direccion === 'der') {
      // Si el próximo paso cruza la copia final, reubicamos silenciosamente un ciclo atrás y seguimos avanzando
      if (el.scrollLeft + paso >= anchoCiclo * 2 - 4) {
        ajustandoRef.current = true;
        reposicionarScrollSinSalto(el, el.scrollLeft - anchoCiclo);
        ajustandoRef.current = false;
      }
      el.scrollTo({ left: el.scrollLeft + paso, behavior: 'smooth' });
    } else {
      if (el.scrollLeft - paso <= anchoCiclo * 0.5) {
        ajustandoRef.current = true;
        reposicionarScrollSinSalto(el, el.scrollLeft + anchoCiclo);
        ajustandoRef.current = false;
      }
      el.scrollTo({ left: el.scrollLeft - paso, behavior: 'smooth' });
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
          <p className="texto-oculto-movil-ecommerce">
            Arreglos botánicos icónicos preparados frescos cada mañana en nuestro taller.
          </p>
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
        {itemsRenderizados.map(({ key, producto }) => (
          <div key={key} className="item-riel-destacados">
            <TarjetaProductoConCarrusel producto={producto} />
          </div>
        ))}
      </div>
    </section>
  );
}
