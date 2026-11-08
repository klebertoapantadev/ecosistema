// Cálculo de totales e impuestos con reparto de centavos por resto mayor.
// Port fiel de Domo.Firma.Sri/CalculadoraTotales.cs (IMPLEMENTACION.md §4).

import { TARIFAS_IVA } from "./catalogos.ts";
import type { LineaDetalle, TarifaIva, Totales, TotalesLinea, TotalGrupo } from "./comprobante.ts";
import {
  comparar,
  dividirPor100,
  formatearImporte,
  formatearTarifa,
  multiplicar,
  parsearDecimal,
  redondearMitadArriba,
  restar,
  sumar,
} from "./decimal.ts";

/**
 * Calcula bases e IVA por línea y por grupo de impuesto, repartiendo la
 * diferencia de redondeo en centavos por el método del resto mayor (empates por
 * orden de línea ascendente) para evitar el error 52 del SRI.
 */
export function calcularTotales(
  detalles: LineaDetalle[],
  tarifas: Record<string, TarifaIva> = TARIFAS_IVA,
): Totales {
  const n = detalles.length;
  const bases: string[] = new Array(n);
  const exactos: string[] = new Array(n);
  const provisional: string[] = new Array(n);
  const tarifasPorLinea: TarifaIva[] = new Array(n);

  let totalSinImpuestos = "0.00";
  let totalDescuento = "0.00";

  for (let i = 0; i < n; i++) {
    const linea = detalles[i];
    const tarifa = tarifas[linea.codigoIva];
    if (!tarifa) {
      throw new Error(`Tarifa de IVA desconocida: '${linea.codigoIva}' en la línea ${linea.orden}.`);
    }

    if (comparar(linea.cantidad, "0") <= 0) {
      throw new Error(`La cantidad debe ser mayor que cero en la línea ${linea.orden}.`);
    }

    if (comparar(linea.precioUnitario, "0") < 0) {
      throw new Error(`El precio unitario no puede ser negativo en la línea ${linea.orden}.`);
    }

    if (comparar(linea.descuento, "0") < 0) {
      throw new Error(`El descuento no puede ser negativo en la línea ${linea.orden}.`);
    }

    const bruto = multiplicar(linea.cantidad, linea.precioUnitario);
    const baseSinRedondear = restar(bruto, linea.descuento);
    if (comparar(baseSinRedondear, "0") < 0) {
      throw new Error(
        `El descuento (${linea.descuento}) supera el importe bruto (${bruto}) en la línea ${linea.orden}.`,
      );
    }

    const baseLinea = redondearMitadArriba(baseSinRedondear, 2);
    const exacto = dividirPor100(multiplicar(baseLinea, tarifa.porcentaje));

    bases[i] = baseLinea;
    exactos[i] = exacto;
    provisional[i] = redondearMitadArriba(exacto, 2);
    tarifasPorLinea[i] = tarifa;

    totalSinImpuestos = sumar(totalSinImpuestos, baseLinea);
    totalDescuento = sumar(totalDescuento, linea.descuento);
  }

  const valoresFinales = [...provisional];
  const grupos: TotalGrupo[] = [];

  // Agrupar índices por codigoPorcentaje preservando el orden de aparición y
  // ordenar los grupos por el valor numérico del código ("0", "4", "5", "6", "7", "10").
  const mapaGrupos = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const codigo = tarifasPorLinea[i].codigoPorcentaje;
    const lista = mapaGrupos.get(codigo);
    if (lista) {
      lista.push(i);
    } else {
      mapaGrupos.set(codigo, [i]);
    }
  }

  const codigosOrdenados = [...mapaGrupos.keys()].sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
  );

  for (const codigo of codigosOrdenados) {
    const indices = mapaGrupos.get(codigo)!;
    const tarifa = tarifasPorLinea[indices[0]];
    const baseGrupo = indices.reduce((acc, i) => sumar(acc, bases[i]), "0.00");
    const valorGrupo = redondearMitadArriba(
      dividirPor100(multiplicar(baseGrupo, tarifa.porcentaje)),
      2,
    );
    const sumaProvisional = indices.reduce((acc, i) => sumar(acc, provisional[i]), "0.00");

    // Tanto valorGrupo como sumaProvisional tienen exactamente 2 decimales, por lo que
    // la diferencia escalada a centavos es un entero exacto.
    const difCentavos = parsearDecimal(redondearMitadArriba(restar(valorGrupo, sumaProvisional), 2));
    const k = Number(difCentavos.valor);

    if (k > 0) {
      const afectados = [...indices]
        .sort((a, b) => {
          const restoA = restar(exactos[a], provisional[a]);
          const restoB = restar(exactos[b], provisional[b]);
          const cmp = comparar(restoB, restoA);
          return cmp !== 0 ? cmp : detalles[a].orden - detalles[b].orden;
        })
        .slice(0, k);
      for (const idx of afectados) {
        valoresFinales[idx] = formatearImporte(sumar(valoresFinales[idx], "0.01"));
      }
    } else if (k < 0) {
      const afectados = [...indices]
        .sort((a, b) => {
          const restoA = restar(exactos[a], provisional[a]);
          const restoB = restar(exactos[b], provisional[b]);
          const cmp = comparar(restoA, restoB);
          return cmp !== 0 ? cmp : detalles[a].orden - detalles[b].orden;
        })
        .slice(0, -k);
      for (const idx of afectados) {
        valoresFinales[idx] = formatearImporte(restar(valoresFinales[idx], "0.01"));
      }
    }

    grupos.push({
      codigoPorcentaje: tarifa.codigoPorcentaje,
      tarifa: formatearTarifa(tarifa.porcentaje),
      base: formatearImporte(baseGrupo),
      valor: formatearImporte(valorGrupo),
    });
  }

  const lineas: TotalesLinea[] = detalles.map((d, i) => ({
    orden: d.orden,
    base: formatearImporte(bases[i]),
    valorIva: formatearImporte(valoresFinales[i]),
    tarifa: tarifasPorLinea[i],
  }));

  const totalIva = formatearImporte(grupos.reduce((acc, g) => sumar(acc, g.valor), "0.00"));
  const totalSinImpuestosFmt = formatearImporte(totalSinImpuestos);
  const totalDescuentoFmt = formatearImporte(totalDescuento);
  const importeTotal = formatearImporte(sumar(totalSinImpuestosFmt, totalIva));

  return {
    lineas,
    grupos,
    totalSinImpuestos: totalSinImpuestosFmt,
    totalDescuento: totalDescuentoFmt,
    totalIva,
    importeTotal,
  };
}
