"use client";

import { useEffect, useRef } from "react";

/** Cifra que sube desde cero al entrar en pantalla (TRQ-013, variante 10A:
 *  la idea de CountUp de React Bits, reescrita sin la librería `motion`).
 *
 *  El servidor ya pinta el valor final: sin JavaScript, o con "reducir
 *  movimiento", se ve la cifra correcta y no un cero. La animación escribe
 *  directo en el nodo, sin estado de React: son 90 fotogramas por cifra y no
 *  hace falta re-renderizar nada para eso.
 *
 *  El número que se anima está oculto al lector de pantalla; este lee solo el
 *  valor final, en un span aparte. Si no, anunciaría cifras a medio contar. */
export function CifraQueCuenta({
  valor,
  decimales = 0,
  prefijo = "",
}: {
  valor: number;
  decimales?: number;
  prefijo?: string;
}) {
  const nodo = useRef<HTMLSpanElement>(null);
  const formato = (v: number) =>
    prefijo + v.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

  useEffect(() => {
    const el = nodo.current;
    if (!el || valor === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fmt = (v: number) =>
      prefijo + v.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    let fotograma = 0;
    const contar = () => {
      const t0 = performance.now();
      el.textContent = fmt(0);
      const paso = (t: number) => {
        const p = Math.min(1, (t - t0) / 1500);
        // Sale rápido y frena al llegar (ease-out exponencial).
        el.textContent = fmt(p === 1 ? valor : valor * (1 - Math.pow(2, -10 * p)));
        if (p < 1) fotograma = requestAnimationFrame(paso);
      };
      fotograma = requestAnimationFrame(paso);
    };
    const vigia = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          vigia.disconnect();
          contar();
        }
      },
      { threshold: 0.4 },
    );
    vigia.observe(el);
    return () => {
      vigia.disconnect();
      cancelAnimationFrame(fotograma);
    };
  }, [valor, decimales, prefijo]);

  return (
    <>
      <span ref={nodo} className="cifra-numero" aria-hidden="true">
        {formato(valor)}
      </span>
      <span className="lector-oculto">{formato(valor)}</span>
    </>
  );
}
