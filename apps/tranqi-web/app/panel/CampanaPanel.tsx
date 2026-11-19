"use client";

import { CampanaNotificaciones } from "@eco/notificaciones";
import { presentarNotificacion, useAlertaEnVivo } from "./presentacionNotificaciones";

/**
 * Campana del rail (TRQ-031). La alerta nueva sale con el aviso 9A del panel y
 * no con la ventana oscura de la campana, que tapaba el menú de la cuenta
 * arriba a la derecha. La lista se pinta igual que la bandeja del inicio.
 */
export function CampanaPanel({ negocio, usuarioId }: { negocio: string; usuarioId?: string }) {
  const mostrar = useAlertaEnVivo();
  return <CampanaNotificaciones negocio={negocio} usuarioId={usuarioId} alAlertaEnVivo={mostrar} presentar={presentarNotificacion} />;
}
