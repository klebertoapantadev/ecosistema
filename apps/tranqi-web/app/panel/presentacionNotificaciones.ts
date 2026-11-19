"use client";

import { useCallback } from "react";
import type { NotificacionItem } from "@eco/notificaciones";
import { useAvisos } from "./AvisosPanel";

/**
 * Cómo se ven las notificaciones en el panel de tranqi (TRQ-025, TRQ-027,
 * TRQ-031). Lo usan la bandeja del inicio (NotificacionesPanel) y la campana
 * del rail (CampanaPanel), que reciben las mismas notificaciones.
 *
 * - La que llega con el panel abierto se muestra con el aviso flotante 9A
 *   (abajo a la izquierda), no con las ventanas que pinta el paquete. Lo que
 *   pide una decisión (propuesta de rol, cita de hoy sin abogado) es «urgente».
 * - Cada módulo guarda sus notificaciones con su propio HTML (correos de venta
 *   con cabecera verde, cajas, emoji); aquí todas se pintan igual: título sin
 *   emoji, hasta cuatro líneas de texto y un enlace. No se toca lo guardado.
 */

// La bandeja y la campana pueden avisar de la misma notificación: una vez basta.
const yaAvisadas = new Set<string>();

export function useAlertaEnVivo() {
  const { avisar } = useAvisos();
  return useCallback(
    (n: NotificacionItem) => {
      if (yaAvisadas.has(n.not_id)) return;
      yaAvisadas.add(n.not_id);
      const urgente = Boolean(n.es_propuesta_rol) || n.not_id.startsWith("prop-rol-") || n.not_id.startsWith("alerta-dia-sin-abg-");
      const { titulo, lineas } = resumir(n);
      const texto = lineas.join(" · ");
      avisar(urgente ? "urgente" : "info", titulo, texto.length > 120 ? `${texto.slice(0, 117)}…` : texto);
    },
    [avisar]
  );
}

const MAX_LINEAS = 4;

export function presentarNotificacion(n: NotificacionItem) {
  const { titulo, lineas, enlace } = resumir(n);
  const cuerpo = lineas
    .slice(0, MAX_LINEAS)
    .map((l) => `<p>${escapar(l)}</p>`)
    .join("");
  const accion = enlace ? `<p class="notif-enlace"><a href="${escapar(enlace.href)}">${escapar(enlace.texto)}</a></p>` : "";
  return { titulo, html: cuerpo + accion };
}

/**
 * Título limpio, líneas de texto del cuerpo y la acción. La acción es el primer
 * enlace interno del panel; si no hay, `not_url_accion`. Los enlaces externos
 * (una sala de videollamada) quedan como texto en su línea.
 */
function resumir(n: NotificacionItem) {
  const titulo = limpiar(n.not_titulo);
  if (typeof document === "undefined") return { titulo, lineas: [] as string[], enlace: null };

  const doc = new DOMParser().parseFromString(n.not_contenido_html || "", "text/html");
  let enlace: { href: string; texto: string } | null = null;
  const interno = [...doc.querySelectorAll("a[href]")].find((a) => /^\/(?!\/)/.test(a.getAttribute("href") ?? ""));
  if (interno) {
    enlace = { href: interno.getAttribute("href")!, texto: limpiar(interno.textContent || "").replace(/[→»]+/g, "").trim() || "Ver detalle" };
    interno.remove();
  } else if (n.not_url_accion && /^\/(?!\/)/.test(n.not_url_accion)) {
    enlace = { href: n.not_url_accion, texto: "Ver detalle" };
  }

  // Cada bloque (párrafo, caja, fila) y cada <br> es una línea.
  doc.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  doc.querySelectorAll("p, div, li, tr, table, h1, h2, h3, h4, h5, h6").forEach((e) => e.append("\n"));
  const vistas = new Set<string>();
  const lineas = (doc.body.textContent || "")
    .split("\n")
    .map((l) => limpiar(l))
    .filter((l) => {
      if (!l || vistas.has(l)) return false;
      vistas.add(l);
      // Repite el título, o es la cabecera en mayúsculas de un correo.
      if (titulo.includes(l)) return false;
      if (l.length < 60 && /[A-ZÁÉÍÓÚÑ]/.test(l) && l === l.toUpperCase()) return false;
      return true;
    });
  return { titulo, lineas, enlace };
}

/** Sin emoji ni espacios repetidos: el sistema visual no usa emoji (§5). */
function limpiar(texto: string) {
  return texto
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s·:,-]+/, "")
    .trim();
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
