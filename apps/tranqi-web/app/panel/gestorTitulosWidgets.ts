"use client";

import { useState, useEffect } from "react";

export interface CustomizacionWidget {
  titulo: string;
  subtitulo: string;
}

export type MapaCustomizacionesWidget = Record<string, CustomizacionWidget>;

const CLAVE_LOCAL_STORAGE = "tranqi_custom_widgets_config";
const NOMBRE_EVENTO_CUSTOM = "tranqi_widget_custom_updated";

/**
 * Lee todas las customizaciones almacenadas en localStorage
 */
export function obtenerCustomizacionesWidgets(): MapaCustomizacionesWidget {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL_STORAGE);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Recupera la versión con título y subtítulo personalizados para un widget específico
 */
export function obtenerCustomizacionWidget(
  id: string,
  tituloPorDefecto: string,
  subtituloPorDefecto: string,
  mapa?: MapaCustomizacionesWidget
): { titulo: string; subtitulo: string } {
  const customMap = mapa ?? obtenerCustomizacionesWidgets();
  const custom = customMap[id];
  return {
    titulo: custom?.titulo?.trim() ? custom.titulo : tituloPorDefecto,
    subtitulo: custom?.subtitulo?.trim() ? custom.subtitulo : subtituloPorDefecto,
  };
}

/**
 * Guarda o actualiza el título y subtítulo personalizados de un widget
 */
export function guardarCustomizacionWidget(id: string, titulo: string, subtitulo: string) {
  if (typeof window === "undefined") return;
  try {
    const mapaActual = obtenerCustomizacionesWidgets();
    mapaActual[id] = {
      titulo: titulo.trim(),
      subtitulo: subtitulo.trim(),
    };
    localStorage.setItem(CLAVE_LOCAL_STORAGE, JSON.stringify(mapaActual));
    window.dispatchEvent(
      new CustomEvent(NOMBRE_EVENTO_CUSTOM, {
        detail: { id, titulo: titulo.trim(), subtitulo: subtitulo.trim() },
      })
    );
  } catch (err) {
    console.error("Error al guardar la customización del widget:", err);
  }
}

/**
 * Hook para consumir y mantenerse reactivo ante cambios en los títulos/subtítulos de widgets
 */
export function useCustomWidgets() {
  const [customizaciones, setCustomizaciones] = useState<MapaCustomizacionesWidget>({});

  useEffect(() => {
    setCustomizaciones(obtenerCustomizacionesWidgets());

    const manejarEvento = () => {
      setCustomizaciones(obtenerCustomizacionesWidgets());
    };

    window.addEventListener(NOMBRE_EVENTO_CUSTOM, manejarEvento);
    window.addEventListener("storage", manejarEvento);

    return () => {
      window.removeEventListener(NOMBRE_EVENTO_CUSTOM, manejarEvento);
      window.removeEventListener("storage", manejarEvento);
    };
  }, []);

  const getWidgetInfo = (id: string, tituloDef: string, subtituloDef: string) => {
    return obtenerCustomizacionWidget(id, tituloDef, subtituloDef, customizaciones);
  };

  return { customizaciones, getWidgetInfo, guardarWidget: guardarCustomizacionWidget };
}
