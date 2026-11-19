"use client";

import { WidgetNotificacionesCliente } from "@eco/notificaciones";
import { presentarNotificacion, useAlertaEnVivo } from "./presentacionNotificaciones";

/** Bandeja de notificaciones del inicio del panel. Presentación en presentacionNotificaciones.ts. */
export function NotificacionesPanel({ esAdmin }: { esAdmin: boolean }) {
  const mostrar = useAlertaEnVivo();
  return (
    <WidgetNotificacionesCliente negocio="tranqi" esAdmin={esAdmin} alAlertaEnVivo={mostrar} presentar={presentarNotificacion} />
  );
}
