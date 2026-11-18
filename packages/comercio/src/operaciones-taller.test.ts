import { describe, expect, it } from "vitest";
import {
  CLASIFICACIONES_OPERATIVAS_PEDIDO,
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
  OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES,
  OPCIONES_SALA_EXEQUIALES,
  RANGOS_HORARIO_ENTREGA_TIENDA,
  SOLICITANTES_EXEQUIALES_FRECUENTES,
  consolidarFotosInventario,
  esEntregaConfirmadaOrden,
  esPedidoDeElaboracionEnFecha,
  extraerConteoJsonDesdeRespuestaAria,
  formatearFechaCorteInventario,
  formatearFechaEntregaHumana,
  formatearResumenInventarioTexto,
  generarCuadriculaMesCalendario,
  inferirClasificacionPedido,
  normalizarFranjaHorariaTienda,
  obtenerRangoSemanaLunesADomingo,
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
    expect(SOLICITANTES_EXEQUIALES_FRECUENTES).toEqual(["Cristian Montaluisa", "Cristina"]);
  });

  it("normaliza los 3 rangos horarios oficiales A/B/C y calcula calendario Hoy/Semana/Mes", () => {
    expect(RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => r.valor)).toEqual([
      "A) 09:00 - 13:00",
      "B) 13:00 - 17:00",
      "C) 17:00 - 20:00",
    ]);
    expect(normalizarFranjaHorariaTienda("manana")).toBe("A) 09:00 - 13:00");
    expect(normalizarFranjaHorariaTienda("tarde")).toBe("B) 13:00 - 17:00");
    expect(normalizarFranjaHorariaTienda("C) 17:00 - 20:00")).toBe("C) 17:00 - 20:00");

    const sem = obtenerRangoSemanaLunesADomingo("2026-11-18");
    expect(sem.dias).toHaveLength(7);
    expect(sem.inicioLunes).toBe("2026-11-16");
    expect(sem.finDomingo).toBe("2026-11-22");

    const mes = generarCuadriculaMesCalendario(2026, 11);
    expect(mes).toHaveLength(42);

    // Pedido enviado a elaboración hoy (16 Nov) pero cuya entrega es el miércoles 18 Nov
    expect(
      esPedidoDeElaboracionEnFecha(
        {
          fechaEntrega: "2026-11-18",
          fechaElaboracion: "2026-11-16",
          estadoTaller: "ENVIADO_TALLER",
        },
        "2026-11-16",
        "2026-11-16"
      )
    ).toBe(true);

    expect(formatearFechaEntregaHumana("2026-11-17", "2026-11-16").horizonte).toBe("MANANA");
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

  it("clasifica los pedidos en las 5 categorías operativas y detecta entregas confirmadas para el calendario", () => {
    expect(CLASIFICACIONES_OPERATIVAS_PEDIDO.map((c) => c.clave)).toEqual([
      "DOMICILIO",
      "LOCAL",
      "EXEQUIALES",
      "EVENTOS",
      "MOBILIARIO",
    ]);

    expect(
      inferirClasificacionPedido({
        origenTipo: "EXEQUIALES_LLAMADA",
        salaServicio: "Sala 1",
        productoResumen: "Set condolencias (3 arreglos)",
      })
    ).toBe("EXEQUIALES");

    expect(
      inferirClasificacionPedido({
        retiroEnLocal: true,
        productoResumen: "Bouquet 24 rosas",
      })
    ).toBe("LOCAL");

    expect(
      inferirClasificacionPedido({
        origenTipo: "PROFORMA_EVENTO",
        productoResumen: "Arco floral ceremonia",
      })
    ).toBe("EVENTOS");

    expect(
      inferirClasificacionPedido({
        productoResumen: "Juego de 3 pedestales dorados en renta",
      })
    ).toBe("MOBILIARIO");

    expect(
      inferirClasificacionPedido({
        productoResumen: "Box floral mediano",
        ubicacionEntrega: "Av. República del Salvador",
      })
    ).toBe("DOMICILIO");

    expect(
      esEntregaConfirmadaOrden({
        estadoTaller: "EN_PREPARACION",
        evidenciaFotoUrl: null,
      })
    ).toBe(false);

    expect(
      esEntregaConfirmadaOrden({
        estadoTaller: "ENTREGADO",
        evidenciaFotoUrl: "https://cdn/evidencia.jpg",
      })
    ).toBe(true);
  });
});
