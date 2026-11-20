"use client";

import { useEffect, useRef, useState } from "react";
import { obtenerConfiguracionMarketingPublicaAction } from "../acciones-marketing-meta";
import {
  capturarYPersistirAtribucionNavegador,
  dispararEventoPixelNavegador,
} from "../marketing-meta";

export interface PropsProveedorMarketingMeta {
  negocio: string;
  pixelId?: string | null;
  activo?: boolean;
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: unknown;
  }
}

function asegurarBootstrapPixel(pixelId: string): void {
  if (typeof window === "undefined" || !pixelId) return;
  const limpio = pixelId.replace(/[^0-9]/g, "");
  if (!limpio) return;

  if (!window.fbq) {
    const n: any = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        n.queue.push(args);
      }
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  const claveInit = `__eco_meta_pixel_init_${limpio}`;
  if (!(window as any)[claveInit]) {
    (window as any)[claveInit] = true;
    window.fbq?.("init", limpio);
  }
}

/**
 * Captura en todas las páginas los parámetros de atribución publicitaria (`utm_*`, `fbclid`,
 * `_fbc`, `_fbp`) para ARIA y el checkout, e inicializa el Pixel de Meta del negocio cuando
 * está activo y configurado en `/panel/configuracion`.
 */
export function ProveedorMarketingMeta({
  negocio,
  pixelId,
  activo,
}: PropsProveedorMarketingMeta) {
  const [cfgDinamica, setCfgDinamica] = useState<{
    pixelId: string | null;
    activo: boolean;
  }>({
    pixelId: pixelId ?? null,
    activo: Boolean(activo ?? pixelId),
  });
  const ultimaUrlRastreada = useRef<string>("");

  useEffect(() => {
    if (pixelId !== undefined) {
      setCfgDinamica({ pixelId: pixelId ?? null, activo: Boolean(activo ?? pixelId) });
      return;
    }
    let cancelado = false;
    obtenerConfiguracionMarketingPublicaAction(negocio)
      .then((cfg) => {
        if (!cancelado) {
          setCfgDinamica({ pixelId: cfg.pixelId, activo: cfg.activo });
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [negocio, pixelId, activo]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sincronizarVista = () => {
      const urlActual = `${window.location.pathname}${window.location.search || ""}`;
      capturarYPersistirAtribucionNavegador(negocio, { rutaActual: urlActual });

      if (cfgDinamica.activo && cfgDinamica.pixelId) {
        asegurarBootstrapPixel(cfgDinamica.pixelId);
        if (ultimaUrlRastreada.current !== urlActual) {
          ultimaUrlRastreada.current = urlActual;
          dispararEventoPixelNavegador("PageView");
        }
      }
    };

    sincronizarVista();
    window.addEventListener("popstate", sincronizarVista);
    return () => {
      window.removeEventListener("popstate", sincronizarVista);
    };
  }, [negocio, cfgDinamica.pixelId, cfgDinamica.activo]);

  return null;
}
