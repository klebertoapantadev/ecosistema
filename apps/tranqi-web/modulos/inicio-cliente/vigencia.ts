// Lógica pura, sin Supabase: se prueba en vigencia.test.ts.

export type EstadoVigencia = "vigente" | "por_vencer" | "vencido" | "sin_caducidad";

const MS_DIA = 1000 * 60 * 60 * 24;

/** Mismo cálculo que `app/api/billetera/documentos/route.ts`: "por vencer" es
 *  entrar en la ventana de aviso que el propio usuario configuró (meses de
 *  anticipación, 3 por defecto), no un umbral fijo de la pantalla. Con la
 *  alerta desactivada, un documento que aún no venció es "vigente". */
export function estadoVigencia(
  fechaCaducidad: string | null,
  alertar: boolean | null,
  mesesAnticipacion: number | null,
  ahora: Date,
): { estado: EstadoVigencia; diasParaVencer: number | null } {
  if (!fechaCaducidad) return { estado: "sin_caducidad", diasParaVencer: null };
  const dias = Math.ceil((new Date(fechaCaducidad).getTime() - ahora.getTime()) / MS_DIA);
  if (dias < 0) return { estado: "vencido", diasParaVencer: dias };
  if (alertar !== false && dias <= (mesesAnticipacion ?? 3) * 30) return { estado: "por_vencer", diasParaVencer: dias };
  return { estado: "vigente", diasParaVencer: dias };
}
