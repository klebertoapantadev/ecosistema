import { describe, expect, it } from "vitest";
import {
  calcularBaseComisionableVenta,
  calcularParticipacionChatOmnicanal,
  calcularRepartoComisionesVenta,
  filtrarVentasPorPeriodoYRol,
  obtenerFechaDiaEcuador,
  resumirEstadisticasVentasYAsesores,
  type VentaComisionRegistrada,
} from "./comisiones";

describe("comisiones — participación colaborativa, reparto variable y visibilidad por rol", () => {
  it("calcula exactamente IA 50%, Nan 30%, Kleber 10%, Johana 10% e identifica al líder humano", () => {
    const equipo = [
      { usuarioId: "u-nan", nombre: "Nan" },
      { usuarioId: "u-kleber", nombre: "Kleber" },
      { usuarioId: "u-johana", nombre: "Johana" },
    ];
    const msgs = [
      // 5 mensajes de IA
      ...Array.from({ length: 5 }, () => ({
        origen: "BOT_ARIA" as const,
        autorUsuarioId: null,
        autorNombre: "Mía",
        creadoEn: "2026-11-28T14:00:00.000Z",
      })),
      // 3 mensajes de Nan
      ...Array.from({ length: 3 }, () => ({
        origen: "ASESORA_HUMANA" as const,
        autorUsuarioId: "u-nan",
        autorNombre: "Nan",
        creadoEn: "2026-11-28T14:05:00.000Z",
      })),
      // 1 mensaje de Kleber
      {
        origen: "ASESORA_HUMANA" as const,
        autorUsuarioId: "u-kleber",
        autorNombre: "Kleber",
        creadoEn: "2026-11-28T14:10:00.000Z",
      },
      // 1 mensaje de Johana
      {
        origen: "ASESORA_HUMANA" as const,
        autorUsuarioId: "u-johana",
        autorNombre: "Johana",
        creadoEn: "2026-11-28T14:12:00.000Z",
      },
      // Nota interna (NO debe contar)
      {
        origen: "NOTA_INTERNA" as const,
        autorUsuarioId: "u-kleber",
        autorNombre: "Kleber",
        creadoEn: "2026-11-28T14:13:00.000Z",
      },
      // Mensaje del cliente (NO debe contar)
      {
        origen: "CLIENTE" as const,
        autorUsuarioId: null,
        autorNombre: "Cliente",
        creadoEn: "2026-11-28T14:14:00.000Z",
      },
    ];

    const res = calcularParticipacionChatOmnicanal(msgs, equipo);
    expect(res.totalMensajesAtencion).toBe(10);
    expect(res.porcentajeIa).toBe(50);
    expect(res.liderHumano?.nombre).toBe("Nan");

    const nan = res.participantes.find((p) => p.nombre === "Nan")!;
    const kleber = res.participantes.find((p) => p.nombre === "Kleber")!;
    const johana = res.participantes.find((p) => p.nombre === "Johana")!;
    expect(nan.porcentajeReal).toBe(30);
    expect(kleber.porcentajeReal).toBe(10);
    expect(johana.porcentajeReal).toBe(10);
    expect(nan.porcentajeHumano).toBe(60);
    expect(kleber.porcentajeHumano).toBe(20);
    expect(johana.porcentajeHumano).toBe(20);
  });

  it("calcula base comisionable descontando delivery fijo y extra, y aplica tasas variables por asesor en los 4 modos", () => {
    const desglose = calcularBaseComisionableVenta({
      ventaTotalUsd: 112,
      valorProductoUsd: 90,
      valorExtrasUsd: 10,
      extrasComisionan: true,
      deliveryFijoUsd: 5,
      deliveryExtraUsd: 7,
      descuentosUsd: 0,
      comisionPasarelaUsd: 0,
    });
    expect(desglose.baseComisionableUsd).toBe(100);

    const humanos = [
      { clave: "usu:u-nan", usuarioId: "u-nan", nombre: "Nan", porcentajeReal: 30, porcentajeHumano: 60 },
      { clave: "usu:u-kleber", usuarioId: "u-kleber", nombre: "Kleber", porcentajeReal: 10, porcentajeHumano: 20 },
      { clave: "usu:u-johana", usuarioId: "u-johana", nombre: "Johana", porcentajeReal: 10, porcentajeHumano: 20 },
    ];
    const tasas = { "u-nan": 10, "u-kleber": 5, "u-johana": 8 };

    // 1. Por defecto: Ganador único (Nan 100% * 10% = $10.00)
    const ganador = calcularRepartoComisionesVenta({
      baseComisionableUsd: 100,
      participantesHumanos: humanos,
      regla: "GANADOR_UNICO",
      tasasPorUsuarioId: tasas,
    });
    expect(ganador.asignaciones.find((a) => a.asesorNombre === "Nan")?.montoComisionUsd).toBe(10);
    expect(ganador.totalComisionUsd).toBe(10);

    // 2. Manual libre: Admin decide dar 50% solo a Nan ($100 * 50% * 10% = $5.00)
    const manual = calcularRepartoComisionesVenta({
      baseComisionableUsd: 100,
      participantesHumanos: humanos,
      regla: "MANUAL",
      porcentajesManuales: { "usu:u-nan": 50, "usu:u-kleber": 0, "usu:u-johana": 0 },
      tasasPorUsuarioId: tasas,
    });
    expect(manual.totalPorcentajeAsignado).toBe(50);
    expect(manual.totalComisionUsd).toBe(5);

    // 3. Proporcional real (IA 50% queda para tienda): Nan 30%*10%=3, Kleber 10%*5%=0.5, Johana 10%*8%=0.8 => $4.30
    const propReal = calcularRepartoComisionesVenta({
      baseComisionableUsd: 100,
      participantesHumanos: humanos,
      regla: "PROPORCIONAL_REAL",
      tasasPorUsuarioId: tasas,
    });
    expect(propReal.totalComisionUsd).toBe(4.3);
  });

  it("restringe estrictamente a ventas de HOY para asesores no administradores y permite semana/mes a Admin", () => {
    const ahora = new Date("2026-11-28T16:00:00.000Z"); // 11:00 AM Ecuador 2026-11-28
    expect(obtenerFechaDiaEcuador(ahora)).toBe("2026-11-28");

    const vHoy: VentaComisionRegistrada = {
      id: "v1",
      negocio: "tinkay",
      clienteNombre: "Cliente Hoy",
      canal: "whatsapp",
      desglose: calcularBaseComisionableVenta({ ventaTotalUsd: 65, deliveryFijoUsd: 5 }),
      porcentajeIaChat: 50,
      reglaReparto: "GANADOR_UNICO",
      asignaciones: [
        {
          clave: "usu:u-nan",
          usuarioId: "u-nan",
          asesorNombre: "Nan",
          porcentajeParticipacionChat: 30,
          porcentajeComisionAsignado: 100,
          tasaComisionAsesorPct: 10,
          montoComisionUsd: 6,
        },
      ],
      totalComisionUsd: 6,
      estadoLiquidacion: "PENDIENTE",
      cerradoEn: "2026-11-28T15:00:00.000Z",
      fechaDiaEc: "2026-11-28",
    };

    const vAyer: VentaComisionRegistrada = {
      ...vHoy,
      id: "v2",
      clienteNombre: "Cliente Ayer",
      cerradoEn: "2026-11-27T15:00:00.000Z",
      fechaDiaEc: "2026-11-27",
    };

    // Asesor pide "mes" -> el motor fuerza "hoy"
    const vistaAsesor = filtrarVentasPorPeriodoYRol({
      ventas: [vHoy, vAyer],
      periodo: "mes",
      esAdmin: false,
      ahora,
    });
    expect(vistaAsesor.periodoEfectivo).toBe("hoy");
    expect(vistaAsesor.ventasFiltradas).toHaveLength(1);
    expect(vistaAsesor.ventasFiltradas[0]?.id).toBe("v1");

    // Admin pide "mes" -> recibe ambas
    const vistaAdmin = filtrarVentasPorPeriodoYRol({
      ventas: [vHoy, vAyer],
      periodo: "mes",
      esAdmin: true,
      ahora,
    });
    expect(vistaAdmin.periodoEfectivo).toBe("mes");
    expect(vistaAdmin.ventasFiltradas).toHaveLength(2);

    const resumen = resumirEstadisticasVentasYAsesores(vistaAdmin.ventasFiltradas);
    expect(resumen.ventaTotalUsd).toBe(130);
    expect(resumen.deliveryFijoUsd).toBe(10);
    expect(resumen.baseComisionableUsd).toBe(120);
    expect(resumen.totalComisionesUsd).toBe(12);
    expect(resumen.porAsesor[0]?.nombre).toBe("Nan");
  });
});
