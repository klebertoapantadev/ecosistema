"use client";

import { useCallback } from "react";
import { WidgetNotificacionesCliente, type NotificacionItem } from "@eco/notificaciones";
import { useAvisos } from "./AvisosPanel";

/**
 * Bandeja de notificaciones del inicio del panel (TRQ-025).
 *
 * La notificación que llega con el panel abierto se muestra con el aviso
 * flotante 9A del panel (abajo a la izquierda, sobrio), no con la ventana
 * oscura que pinta el paquete por su cuenta. Lo que pide una decisión —una
 * propuesta de rol o una cita sin abogado para hoy— es «urgente»: no se va
 * solo. El resto es informativo y se va a los 5 s.
 */
export function NotificacionesPanel({ esAdmin }: { esAdmin: boolean }) {
  const { avisar } = useAvisos();

  const mostrar = useCallback(
    (n: NotificacionItem) => {
      const urgente = Boolean(n.es_propuesta_rol) || n.not_id.startsWith("prop-rol-") || n.not_id.startsWith("alerta-dia-sin-abg-");
      const texto = textoPlano(n.not_contenido_html);
      avisar(urgente ? "urgente" : "info", sinEmoji(n.not_titulo), texto.length > 120 ? `${texto.slice(0, 117)}…` : texto);
    },
    [avisar]
  );

  return <WidgetNotificacionesCliente negocio="tranqi" esAdmin={esAdmin} alAlertaEnVivo={mostrar} />;
}

/** Los títulos guardados de antes pueden empezar con emoji; el sistema visual no los usa. */
function sinEmoji(texto: string) {
  return texto.replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();
}

function textoPlano(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return sinEmoji((div.textContent || "").replace(/\s+/g, " "));
}
