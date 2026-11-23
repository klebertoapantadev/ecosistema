'use client';

import React from 'react';
import {
  anexarParametroRefUrl,
  construirUrlWhatsappTienda,
  extraerCodigoRefWhatsappDeUrl,
  generarCodigoRefVisitanteWeb,
} from '@eco/comercio';

const CLAVE_CONVERSACION_STORAGE = 'eco_chat_conv_tinkay';
const CLAVE_VISITANTE_STORAGE = 'eco_chat_visitante_tinkay';
const CLAVE_WREF_ACTIVO_STORAGE = 'tnk_wref_activo';

interface VisitanteGuardadoStorage {
  nombre?: string;
  correo?: string;
  telefono?: string;
}

export function IconoWhatsappVector({
  size = 17,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <path
        fill={color}
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.77 14.07c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.14-.97-.32-1.67-.62-2.94-1.27-4.86-4.24-5.01-4.44-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.39-.44.52-.15.15-.3.31-.13.61.17.3.76 1.26 1.64 2.04 1.13 1 2.08 1.31 2.38 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.35.07.12.07.72-.17 1.4Z"
      />
    </svg>
  );
}

export function obtenerContextoVisitanteOmnicanal(): {
  claveHiloWeb: string;
  refWeb: string;
  wrefActivo: string | null;
  visitante: VisitanteGuardadoStorage;
} {
  if (typeof window === 'undefined') {
    return {
      claveHiloWeb: 'web-ssr',
      refWeb: 'TNK-WEB000',
      wrefActivo: null,
      visitante: {},
    };
  }

  let claveHiloWeb = window.localStorage.getItem(CLAVE_CONVERSACION_STORAGE) || '';
  if (!claveHiloWeb || !/^[A-Za-z0-9_-]{8,64}$/.test(claveHiloWeb)) {
    claveHiloWeb =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      window.localStorage.setItem(CLAVE_CONVERSACION_STORAGE, claveHiloWeb);
    } catch {
      // Ignorar modo privado sin storage
    }
  }

  let visitante: VisitanteGuardadoStorage = {};
  try {
    const rawVis = window.localStorage.getItem(CLAVE_VISITANTE_STORAGE);
    if (rawVis) {
      visitante = JSON.parse(rawVis) as VisitanteGuardadoStorage;
    }
  } catch {
    // Ignorar JSON inválido
  }

  let wrefActivo: string | null = null;
  try {
    wrefActivo =
      extraerCodigoRefWhatsappDeUrl(window.location.href) ||
      window.localStorage.getItem(CLAVE_WREF_ACTIVO_STORAGE) ||
      null;
  } catch {
    wrefActivo = null;
  }

  return {
    claveHiloWeb,
    refWeb: generarCodigoRefVisitanteWeb(claveHiloWeb, 'tinkay'),
    wrefActivo,
    visitante,
  };
}

function despacharBeaconPuente(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const cuerpo = JSON.stringify({ negocio: 'tinkay', ...payload });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([cuerpo], { type: 'application/json' });
      const enviado = navigator.sendBeacon('/api/omnicanal/puente-web', blob);
      if (enviado) return;
    }
  } catch {
    // Fallback a fetch keepalive
  }
  void fetch('/api/omnicanal/puente-web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Detecta si el cliente llegó a la web desde un enlace enviado en WhatsApp (`?wref=WA-XXXXXX`)
 * y registra la correlación bidireccional con su sesión del navegador.
 */
export function capturarWrefEntranteNavegador(): string | null {
  if (typeof window === 'undefined') return null;
  const wrefUrl = extraerCodigoRefWhatsappDeUrl(window.location.href);
  if (!wrefUrl) return null;

  try {
    window.localStorage.setItem(CLAVE_WREF_ACTIVO_STORAGE, wrefUrl);
  } catch {
    // Ignorar cuota
  }

  const ctx = obtenerContextoVisitanteOmnicanal();
  despacharBeaconPuente({
    direccion: 'WHATSAPP_A_WEB',
    wref: wrefUrl,
    refWeb: ctx.refWeb,
    claveHiloWeb: ctx.claveHiloWeb,
    urlPagina: window.location.href,
    visitanteNombre: ctx.visitante.nombre || null,
    visitanteCorreo: ctx.visitante.correo || null,
    visitanteTelefono: ctx.visitante.telefono || null,
  });

  return wrefUrl;
}

/**
 * Cuando un cliente que vino desde WhatsApp abre la ficha de un producto en la web,
 * notifica en tiempo real al hilo de WhatsApp qué arreglo está viendo.
 */
export function notificarVisitaProductoDesdeWhatsapp(params: {
  productoNombre: string;
  productoSlug?: string | null;
  varianteNombre?: string | null;
  pvp?: number | null;
  urlPagina?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const ctx = obtenerContextoVisitanteOmnicanal();
  if (!ctx.wrefActivo) return;

  despacharBeaconPuente({
    direccion: 'WHATSAPP_A_WEB',
    wref: ctx.wrefActivo,
    refWeb: ctx.refWeb,
    claveHiloWeb: ctx.claveHiloWeb,
    productoNombre: params.productoNombre,
    productoSlug: params.productoSlug || null,
    varianteNombre: params.varianteNombre || null,
    pvp: params.pvp ?? null,
    urlPagina: params.urlPagina || window.location.href,
    visitanteNombre: ctx.visitante.nombre || null,
    visitanteCorreo: ctx.visitante.correo || null,
    visitanteTelefono: ctx.visitante.telefono || null,
  });
}

/**
 * Construye el enlace oficial `https://wa.me/...` con código `TNK-XXXXXX`, registra
 * el contexto del visitante/producto en el puente omnicanal y abre WhatsApp.
 */
export function abrirWhatsappTiendaConPuenteOmnicanal(params: {
  whatsappTienda?: string | null;
  productoNombre?: string | null;
  productoSlug?: string | null;
  varianteNombre?: string | null;
  precioUsd?: number | null;
  urlProducto?: string | null;
  consultaInicial?: string | null;
}): void {
  const ctx = obtenerContextoVisitanteOmnicanal();
  const numeroTienda = params.whatsappTienda || '+593 99 292 2343';
  const urlActual =
    params.urlProducto ||
    (typeof window !== 'undefined' ? window.location.href : 'https://tinkay-web.vercel.app');
  const urlConRef = anexarParametroRefUrl(urlActual, 'ref', ctx.refWeb);

  despacharBeaconPuente({
    direccion: 'WEB_A_WHATSAPP',
    refWeb: ctx.refWeb,
    wref: ctx.wrefActivo,
    claveHiloWeb: ctx.claveHiloWeb,
    productoNombre: params.productoNombre || null,
    productoSlug: params.productoSlug || null,
    varianteNombre: params.varianteNombre || null,
    pvp: params.precioUsd ?? null,
    urlPagina: urlConRef,
    visitanteNombre: ctx.visitante.nombre || null,
    visitanteCorreo: ctx.visitante.correo || null,
    visitanteTelefono: ctx.visitante.telefono || null,
  });

  let mensaje = '';
  if (params.productoNombre) {
    const detalleVar =
      params.varianteNombre && params.varianteNombre !== params.productoNombre
        ? ` (${params.varianteNombre})`
        : '';
    const detallePrecio =
      params.precioUsd != null && params.precioUsd > 0
        ? ` — $${params.precioUsd.toFixed(2)} USD`
        : '';
    mensaje = `Hola Tinkay 🌿, deseo más información sobre *${params.productoNombre}*${detalleVar}${detallePrecio}.\n🔗 ${urlConRef}`;
  } else if (params.consultaInicial && params.consultaInicial.trim()) {
    mensaje = `${params.consultaInicial.trim()}\n(Ref Web: ${ctx.refWeb})`;
  } else {
    mensaje = `Hola Tinkay 🌿, vengo desde la tienda web y deseo asesoría personalizada.\n(Ref Web: ${ctx.refWeb})`;
  }

  const hrefWa = construirUrlWhatsappTienda(numeroTienda, mensaje);
  if (typeof window !== 'undefined') {
    window.open(hrefWa, '_blank', 'noopener,noreferrer');
  }
}
