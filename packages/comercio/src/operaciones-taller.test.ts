import { describe, expect, it } from "vitest";
import {
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
  OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES,
  OPCIONES_SALA_EXEQUIALES,
  consolidarFotosInventario,
  extraerConteoJsonDesdeRespuestaAria,
  formatearFechaCorteInventario,
  formatearResumenInventarioTexto,
} from "./operaciones-taller";
import { generarPdfInformeQuincenalIess } from "./pdf-informe-iess";

describe("operaciones-taller y pdf-informe-iess", () => {
  it("consolida múltiples fotos de bonches por color y formatea el resumen", () => {
    const res = consolidarFotosInventario([
      { id: "f1", imagenUrl: "https://x/1.jpg", conteoColores: { rojo: 6, blanco: 3, rosado: 2 } },
      { id: "f2", imagenUrl: "https://x/2.jpg", conteoColores: { rojos: 4, blancos: 2 } },
    ]);

    expect(res.totalPaquetes).toBe(17);
    expect(res.resumenColores).toEqual({ rojo: 10, blanco: 5, rosado: 2 });
    expect(formatearResumenInventarioTexto(res.resumenColores)).toBe(
      "10 rojos, 5 blancos, 2 rosados"
    );
  });

  it("extrae conteo desde JSON de ARIA o texto natural en español", () => {
    const desdeJson = extraerConteoJsonDesdeRespuestaAria(
      '```json\n{"colores": {"rojo": 10, "blanco": 5, "rosado": 2}, "nota": "Lote completo"}\n```'
    );
    expect(desdeJson.conteoColores).toEqual({ rojo: 10, blanco: 5, rosado: 2 });
    expect(desdeJson.notaIa).toBe("Lote completo");

    const desdeTexto = extraerConteoJsonDesdeRespuestaAria(
      "Veo 8 rojos, 4 blancos y 3 rozados en la mesa."
    );
    expect(desdeTexto.conteoColores).toEqual({ rojo: 8, blanco: 4, rosado: 3 });
  });

  it("formatea la fecha del último inventario al estilo 'Lunes 16Nov 8:00AM'", () => {
    // 2026-11-16 13:00:00Z = Lunes 16 Nov 8:00 AM en America/Guayaquil (UTC-5)
    const texto = formatearFechaCorteInventario("2026-11-16T13:00:00.000Z");
    expect(texto).toContain("Lunes");
    expect(texto).toContain("16Nov");
    expect(texto).toContain("8:00AM");
  });

  it("expone exactamente las 5 salas exequiales y las opciones base de descripción de servicio", () => {
    expect(OPCIONES_SALA_EXEQUIALES).toEqual([
      "Sala 1",
      "Sala 2",
      "Sala 3",
      "Sala 4",
      "Capilla / Oficina",
    ]);
    expect(OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES).toEqual([
      "Set condolencias (3 arreglos)",
      "Cubre cofre (1 arreglo)",
    ]);
  });

  it("genera el PDF oficial INFORME DE SERVICIO PROVEEDORES con portada, sala y fichas", async () => {
    const bytes = await generarPdfInformeQuincenalIess({
      numeroInforme: "INF-IESS-2026-001",
      fechaInforme: "2026-11-15",
      fechaInicio: "2026-11-01",
      fechaFin: "2026-11-15",
      datosProveedor: DATOS_PROVEEDOR_TINKAY_DEFECTO,
      incluirPortadaResumen: true,
      entregas: [
        {
          id: "ent-1",
          uuidCliente: "00000000-0000-4000-8000-000000000001",
          codigoOt: "OT-0001",
          tipoOrigen: "ORDEN_TRABAJO_CONVENIO",
          entregadorNombre: "Carlos Repartidor",
          salaServicio: "Sala 2",
          fallecidoDestinatario: "Por confirmar (Sala 2)",
          fechaServicio: "2026-11-10T14:30:00.000Z",
          capturadoEn: "2026-11-10T14:30:00.000Z",
          descripcionServicio: "Set condolencias (3 arreglos)",
          ubicacionNombre: "",
          coordinadorNombre: "Cristian Montaluiza",
          recursosUtilizados: "Flores, follaje, bases y oasis",
          latitud: -0.176234,
          longitud: -78.479812,
          precisionMetros: 12,
          estado: "ENTREGADA_PENDIENTE_INFORME",
        },
      ],
    });

    expect(bytes.byteLength).toBeGreaterThan(1500);
  });
});
