"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * La subvista abierta de un panel (el "widget activo") vive en la URL, en
 * `?widget=`, y cada apertura es una entrada del historial (TRQ-012).
 *
 * Antes era solo estado local: abrir "Datos de facturación" no cambiaba la URL,
 * así que el botón Atrás del navegador —o el gesto de volver del móvil— sacaba
 * de la página entera en vez de volver a Mi cuenta, y la única salida era la X.
 * Con esto:
 *  - abrir(id) empuja `?widget=id`: Atrás vuelve a la vista anterior, y abrir un
 *    widget desde otro deja rastro para retroceder entre secciones;
 *  - cerrar() retrocede si la entrada la creó este panel, y si se llegó por un
 *    enlace directo con `?widget=` solo limpia el parámetro;
 *  - la apertura directa por enlace (`?widget=facturacion`, o los antiguos
 *    `?modulo=` / `?w=`) sigue funcionando, con los alias de cada panel.
 *
 * `history.pushState` nativo en vez de `router.push`: Next 15 sincroniza sus
 * entradas con el router sin volver a pedir el árbol al servidor, que es lo que
 * haría un `router.push` por cambiar un parámetro que solo decide qué pinta el
 * cliente.
 */
export function useWidgetEnUrl(alias: Record<string, string> = {}) {
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null);
  // los alias son constantes de cada panel: basta con los del primer render
  const aliasRef = useRef(alias);
  // true si la entrada actual del historial la añadió este panel al abrir
  const empujado = useRef(false);

  useEffect(() => {
    setWidgetActivo(leerWidget(aliasRef.current));
    const alNavegar = () => {
      empujado.current = false;
      setWidgetActivo(leerWidget(aliasRef.current));
    };
    window.addEventListener("popstate", alNavegar);
    return () => window.removeEventListener("popstate", alNavegar);
  }, []);

  const abrir = useCallback((id: string) => {
    setWidgetActivo(id);
    if (leerWidget(aliasRef.current) === id) return;
    window.history.pushState(null, "", urlConWidget(id));
    empujado.current = true;
  }, []);

  const cerrar = useCallback(() => {
    if (empujado.current) {
      // el popstate resultante deja widgetActivo en lo que diga la URL anterior
      window.history.back();
      return;
    }
    setWidgetActivo(null);
    window.history.replaceState(null, "", urlConWidget(null));
  }, []);

  return { widgetActivo, abrir, cerrar };
}

// `modulo` y `w` son los nombres que ya circulan en enlaces compartidos (el
// botón "compartir módulo" de los paneles dinámicos genera `?modulo=`): se
// siguen leyendo, pero al abrir se escribe siempre `widget` y los otros se quitan.
const PARAMETROS = ["widget", "modulo", "w"] as const;

function leerWidget(alias: Record<string, string>): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const valor = PARAMETROS.map((p) => params.get(p)).find(Boolean);
  return valor ? alias[valor] || valor : null;
}

function urlConWidget(widget: string | null): string {
  const url = new URL(window.location.href);
  for (const p of PARAMETROS) url.searchParams.delete(p);
  if (widget) url.searchParams.set("widget", widget);
  return url.pathname + url.search + url.hash;
}
