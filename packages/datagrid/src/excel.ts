import * as XLSX from "xlsx";

export interface HojaExcelExportacion {
  nombre: string;
  filas: Record<string, unknown>[];
  anchosColumnas?: number[];
}

/**
 * Genera y descarga un archivo Excel (.xlsx) multi-hoja usando SheetJS.
 */
export function exportarHojasAExcel(
  nombreArchivo: string,
  hojas: HojaExcelExportacion[]
): void {
  const libro = XLSX.utils.book_new();

  for (const h of hojas) {
    const nombreSeguro = (h.nombre || "Hoja")
      .replace(/[\\/?*[\]:]/g, " ")
      .trim()
      .slice(0, 31) || "Hoja";

    const hoja =
      h.filas.length > 0
        ? XLSX.utils.json_to_sheet(h.filas)
        : XLSX.utils.aoa_to_sheet([["Sin registros"]]);

    if (h.anchosColumnas && h.anchosColumnas.length > 0) {
      hoja["!cols"] = h.anchosColumnas.map((wch) => ({ wch }));
    }

    XLSX.utils.book_append_sheet(libro, hoja, nombreSeguro);
  }

  const nombreFinal = nombreArchivo.toLowerCase().endsWith(".xlsx")
    ? nombreArchivo
    : `${nombreArchivo}.xlsx`;
  XLSX.writeFile(libro, nombreFinal);
}

/**
 * Lee un ArrayBuffer de archivo Excel (.xlsx / .xls) o CSV y retorna un diccionario
 * `{ [nombreHoja]: Array<Record<string, unknown>> }`.
 */
export function leerHojasDesdeExcelBuffer(
  buffer: ArrayBuffer
): Record<string, Record<string, unknown>[]> {
  const libro = XLSX.read(buffer, { type: "array" });
  const resultado: Record<string, Record<string, unknown>[]> = {};

  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
      defval: "",
      raw: false,
    });
    resultado[nombreHoja] = filas;
  }

  return resultado;
}
