/**
 * Motor compartido de Escalas de Descuento por Volumen y Sets/Combos Configurables (PLT-009 / ADR-0003).
 * Sin dependencias de Next.js para compatibilidad universal (Web, Capacitor, Server Actions y Vitest).
 */

export type TipoDescuentoVolumen = "PRECIO_FIJO" | "DESCUENTO_MONTO" | "DESCUENTO_PORCENTAJE";

export interface EscalaVolumenVariante {
  /** Cantidad mínima desde la cual aplica el beneficio (ej. 2 para "desde 2 o más") */
  min_cantidad: number;
  /** Modalidad del beneficio unitario */
  tipo: TipoDescuentoVolumen;
  /** Valor numérico según tipo: USD unitario fijo ($60), USD a descontar (-$10) o % (10%) */
  valor: number;
}

export interface ComponenteComboConfig {
  /** UUID o identificador del producto componente en el catálogo */
  producto_id: string;
  /** Slug de respaldo del producto componente */
  producto_slug?: string;
  /** Nombre legible de respaldo del producto componente */
  producto_nombre?: string;
  /** UUID de la variante predefinida en el Set Completo */
  variante_id?: string;
  /** SKU de respaldo de la variante predefinida en el Set Completo */
  variante_sku?: string;
  /** Nombre legible de la variante predefinida (ej. "Mediano (M)") */
  variante_nombre?: string;
  /** Cantidad incluida en el Set Completo (ej. 1 Aro, 2 Carteles) */
  cantidad_base: number;
  /** Orden visual de aparición */
  orden?: number;
}

export interface ResultadoPrecioVolumen {
  pvpUnitarioNominal: number;
  pvpUnitarioFinal: number;
  baseImponibleUnitariaFinal: number;
  subtotalLineaNominal: number;
  subtotalLineaFinal: number;
  ahorroUnitario: number;
  ahorroTotalLinea: number;
  porcentajeDescuento: number;
  tieneDescuentoVolumen: boolean;
  escalaAplicada: EscalaVolumenVariante | null;
}

/**
 * Normaliza, valida y ordena ascendentemente las reglas de descuento por volumen de una variante.
 */
export function normalizarEscalasVolumen(raw: unknown): EscalaVolumenVariante[] {
  if (!Array.isArray(raw)) return [];

  const tiposValidos: TipoDescuentoVolumen[] = [
    "PRECIO_FIJO",
    "DESCUENTO_MONTO",
    "DESCUENTO_PORCENTAJE",
  ];

  const limpias: EscalaVolumenVariante[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const minCantidad = Math.floor(Number(obj.min_cantidad));
    const tipoRaw = String(obj.tipo || "").toUpperCase() as TipoDescuentoVolumen;
    const valor = Number(obj.valor);

    if (
      !Number.isFinite(minCantidad) ||
      minCantidad < 2 ||
      !tiposValidos.includes(tipoRaw) ||
      !Number.isFinite(valor) ||
      valor <= 0
    ) {
      continue;
    }

    const idxExistente = limpias.findIndex((e) => e.min_cantidad === minCantidad);
    const entrada: EscalaVolumenVariante = {
      min_cantidad: minCantidad,
      tipo: tipoRaw,
      valor: Number(valor.toFixed(2)),
    };

    if (idxExistente >= 0) {
      limpias[idxExistente] = entrada;
    } else {
      limpias.push(entrada);
    }
  }

  return limpias.sort((a, b) => a.min_cantidad - b.min_cantidad);
}

/**
 * Normaliza y valida la lista de componentes de un Set / Combo configurable.
 */
export function normalizarComponentesCombo(raw: unknown): ComponenteComboConfig[] {
  if (!Array.isArray(raw)) return [];

  const resultado: ComponenteComboConfig[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, unknown>;
    const productoId = String(obj.producto_id || "").trim();
    const cantidadBase = Math.max(1, Math.floor(Number(obj.cantidad_base) || 1));
    if (!productoId) return;

    resultado.push({
      producto_id: productoId,
      producto_slug: obj.producto_slug ? String(obj.producto_slug).trim() : undefined,
      producto_nombre: obj.producto_nombre ? String(obj.producto_nombre).trim() : undefined,
      variante_id: obj.variante_id ? String(obj.variante_id).trim() : undefined,
      variante_sku: obj.variante_sku ? String(obj.variante_sku).trim() : undefined,
      variante_nombre: obj.variante_nombre ? String(obj.variante_nombre).trim() : undefined,
      cantidad_base: cantidadBase,
      orden: Number.isFinite(Number(obj.orden)) ? Number(obj.orden) : index + 1,
    });
  });

  return resultado.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
}

/**
 * Calcula el precio unitario y de línea aplicando la mejor escala por cantidad disponible.
 */
export function calcularPrecioPorVolumen(params: {
  pvpUnitarioNominal: number;
  tarifaIvaPorcentaje?: number;
  cantidad: number;
  escalas?: EscalaVolumenVariante[] | null;
}): ResultadoPrecioVolumen {
  const pvpNominal = Math.max(0, Number((params.pvpUnitarioNominal || 0).toFixed(2)));
  const ivaPorc = Math.max(0, Number(params.tarifaIvaPorcentaje || 0));
  const cantidad = Math.max(0, Math.floor(params.cantidad || 0));
  const escalasOrdenadas = normalizarEscalasVolumen(params.escalas || []);

  // Seleccionar el escalón más alto cuyo min_cantidad se cumpla
  let escalaAplicada: EscalaVolumenVariante | null = null;
  for (const esc of escalasOrdenadas) {
    if (cantidad >= esc.min_cantidad) {
      escalaAplicada = esc;
    }
  }

  let pvpFinal = pvpNominal;
  if (escalaAplicada && pvpNominal > 0) {
    if (escalaAplicada.tipo === "PRECIO_FIJO") {
      pvpFinal = Math.min(pvpNominal, Math.max(0.01, escalaAplicada.valor));
    } else if (escalaAplicada.tipo === "DESCUENTO_MONTO") {
      pvpFinal = Math.max(0.01, pvpNominal - escalaAplicada.valor);
    } else if (escalaAplicada.tipo === "DESCUENTO_PORCENTAJE") {
      const porc = Math.min(99, Math.max(0, escalaAplicada.valor));
      pvpFinal = Math.max(0.01, pvpNominal * (1 - porc / 100));
    }
    pvpFinal = Number(pvpFinal.toFixed(2));
  }

  const baseImponibleUnitariaFinal =
    ivaPorc > 0
      ? Number((pvpFinal / (1 + ivaPorc / 100)).toFixed(4))
      : pvpFinal;

  const subtotalNominal = Number((pvpNominal * cantidad).toFixed(2));
  const subtotalFinal = Number((pvpFinal * cantidad).toFixed(2));
  const ahorroUnitario = Math.max(0, Number((pvpNominal - pvpFinal).toFixed(2)));
  const ahorroTotalLinea = Math.max(0, Number((subtotalNominal - subtotalFinal).toFixed(2)));
  const tieneDescuentoVolumen = ahorroUnitario > 0 && cantidad > 0;
  const porcentajeDescuento =
    tieneDescuentoVolumen && pvpNominal > 0
      ? Math.round((ahorroUnitario / pvpNominal) * 100)
      : 0;

  return {
    pvpUnitarioNominal: pvpNominal,
    pvpUnitarioFinal: pvpFinal,
    baseImponibleUnitariaFinal,
    subtotalLineaNominal: subtotalNominal,
    subtotalLineaFinal: subtotalFinal,
    ahorroUnitario,
    ahorroTotalLinea,
    porcentajeDescuento,
    tieneDescuentoVolumen,
    escalaAplicada: tieneDescuentoVolumen ? escalaAplicada : null,
  };
}

/**
 * Genera una microcopia comercial concisa para mostrar el beneficio por volumen al cliente.
 * Ej: "2+ uds a $60.00 c/u (-14%)"
 */
export function describirEscalaVolumen(
  escala: EscalaVolumenVariante,
  pvpUnitarioNominal: number
): string {
  const sim = calcularPrecioPorVolumen({
    pvpUnitarioNominal,
    cantidad: escala.min_cantidad,
    escalas: [escala],
  });

  if (escala.tipo === "DESCUENTO_PORCENTAJE") {
    return `${escala.min_cantidad}+ uds: -${escala.valor}% ($${sim.pvpUnitarioFinal.toFixed(2)} c/u)`;
  }
  if (escala.tipo === "DESCUENTO_MONTO") {
    return `${escala.min_cantidad}+ uds: -$${escala.valor.toFixed(2)} c/u ($${sim.pvpUnitarioFinal.toFixed(2)} c/u)`;
  }
  return `${escala.min_cantidad}+ uds a $${sim.pvpUnitarioFinal.toFixed(2)} c/u`;
}

