import { describe, expect, it } from "vitest";
import {
  construirDetalleDireccionDesdeNominatim,
  cotizarEnvioDomicilio,
  crearConfiguracionLogisticaPorDefecto,
  extraerCoordenadasDeTextoOUrl,
  puntoEnPoligono,
  redondearTarifaComercialEnvio,
} from "./logistica";

describe("Motor de logística y cobertura Tinkay", () => {
  const config = crearConfiguracionLogisticaPorDefecto("tinkay");

  it("extrae el pin exacto !3d!4d de Google Maps por encima del viewport @", () => {
    const url =
      "https://www.google.com/maps/place/Tinkay+G%26F/@-0.1648075,-78.4687499,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-0.1648075!4d-78.466175";
    const coords = extraerCoordenadasDeTextoOUrl(url);
    expect(coords).toEqual({ lat: -0.1648075, lng: -78.466175 });
  });

  it("extrae coordenadas de enlaces de Apple Maps, Waze y texto plano", () => {
    expect(
      extraerCoordenadasDeTextoOUrl("https://maps.apple.com/?ll=-0.18412,-78.48471&q=Carolina")
    ).toEqual({ lat: -0.18412, lng: -78.48471 });

    expect(
      extraerCoordenadasDeTextoOUrl("https://waze.com/ul?ll=-0.20510%2C-78.43520&navigate=yes")
    ).toEqual({ lat: -0.2051, lng: -78.4352 });

    expect(extraerCoordenadasDeTextoOUrl("Mi ubicación es -0.19815, -78.48122 gracias")).toEqual({
      lat: -0.19815,
      lng: -78.48122,
    });
  });

  it("aplica $0.00 (Envío Gratis) dentro de Centro-Norte de Quito (ej. La Carolina / González Suárez)", () => {
    const laCarolina = { lat: -0.184, lng: -78.4846 };
    expect(puntoEnPoligono(laCarolina, config.zonas[0]!.poligono)).toBe(true);

    const res = cotizarEnvioDomicilio({
      config,
      destino: laCarolina,
      distanciaVialKm: 3.4,
    });
    expect(res.dentroCobertura).toBe(true);
    expect(res.reglaAplicada).toBe("ZONA_GRATIS");
    expect(res.costoTotalEnvio).toBe(0);
    expect(res.zonaDetectada?.codigo).toBe("centro_norte_quito");

    // Verificar isodistancia real de 5 km en auto: incluye sectores alcanzables por calles (Quicentro, El Inca)
    // y excluye áreas sin calles vehiculares (bosque interior Parque Metropolitano) o >5 km en auto (Plaza Foch)
    expect(puntoEnPoligono({ lat: -0.1763, lng: -78.4793 }, config.zonas[0]!.poligono)).toBe(true);
    expect(puntoEnPoligono({ lat: -0.1455, lng: -78.4712 }, config.zonas[0]!.poligono)).toBe(true);
    expect(puntoEnPoligono({ lat: -0.178, lng: -78.46 }, config.zonas[0]!.poligono)).toBe(false);
    expect(puntoEnPoligono({ lat: -0.2014, lng: -78.4912 }, config.zonas[0]!.poligono)).toBe(false);
  });

  it("aplica Entrega $1 (5-7 km en auto) y Entrega $2 (7-9 km en auto) alrededor de la zona gratuita", () => {
    // Plaza Foch / La Mariscal (~5.25 km en auto): cae en Entrega $1 y Entrega $2 -> gana tarifa más baja ($1.00)
    const plazaFoch = { lat: -0.2014, lng: -78.4912 };
    const res1 = cotizarEnvioDomicilio({
      config,
      destino: plazaFoch,
      distanciaVialKm: 5.25,
    });
    expect(res1.reglaAplicada).toBe("ZONA_TARIFA_FIJA");
    expect(res1.zonaDetectada?.nombre).toBe("Entrega $1");
    expect(res1.costoTotalEnvio).toBe(1.0);

    // Centro Histórico (~8.59 km en auto): fuera de Entrega $1, dentro de Entrega $2 -> $2.00
    const centroHistorico = { lat: -0.2201, lng: -78.5123 };
    const res2 = cotizarEnvioDomicilio({
      config,
      destino: centroHistorico,
      distanciaVialKm: 8.59,
    });
    expect(res2.reglaAplicada).toBe("ZONA_TARIFA_FIJA");
    expect(res2.zonaDetectada?.nombre).toBe("Entrega $2");
    expect(res2.costoTotalEnvio).toBe(2.0);

    // El Condado Shopping (~10.26 km en auto): dentro de Entrega $3 (11 km) -> $3.00
    const condado = { lat: -0.1045, lng: -78.4975 };
    const res3 = cotizarEnvioDomicilio({
      config,
      destino: condado,
      distanciaVialKm: 10.26,
    });
    expect(res3.zonaDetectada?.nombre).toBe("Entrega $3");
    expect(res3.costoTotalEnvio).toBe(3.0);

    // Carcelén (~12.47 km en auto): fuera de Entrega $3 (11 km), dentro de Entrega $4 (13 km)
    const carcelen = { lat: -0.0885, lng: -78.474 };
    expect(puntoEnPoligono(carcelen, config.zonas.find((z) => z.codigo === "entrega_3_usd")!.poligono)).toBe(false);
    expect(puntoEnPoligono(carcelen, config.zonas.find((z) => z.codigo === "entrega_4_usd")!.poligono)).toBe(true);
    // Zona dentro de Entrega $4 sin otra zona fija más barata (ej. Mena del Hierro / El Condado Oeste) -> $4.00
    const condadoOeste = { lat: -0.118, lng: -78.52 };
    const res4 = cotizarEnvioDomicilio({
      config,
      destino: condadoOeste,
      distanciaVialKm: 12.8,
    });
    expect(res4.zonaDetectada?.nombre).toBe("Entrega $4");
    expect(res4.costoTotalEnvio).toBe(4.0);

    // Calderón / Carapungo (~14.26 km en auto): dentro de Entrega $5 (15 km) -> $5.00
    const calderon = { lat: -0.095, lng: -78.423 };
    const res5 = cotizarEnvioDomicilio({
      config,
      destino: calderon,
      distanciaVialKm: 14.26,
    });
    expect(res5.costoTotalEnvio).toBe(4.0); // POR_KM (14.26*0.5-3=4.13->4.00) o Entrega $5 ($5.00): gana la tarifa más baja ($4.00)
    expect(puntoEnPoligono(calderon, config.zonas.find((z) => z.codigo === "entrega_5_usd")!.poligono)).toBe(true);

    // El Recreo (~15.90 km en auto): dentro de Entrega $6 (17 km)
    const elRecreo = { lat: -0.252, lng: -78.522 };
    expect(puntoEnPoligono(elRecreo, config.zonas.find((z) => z.codigo === "entrega_6_usd")!.poligono)).toBe(true);
    expect(puntoEnPoligono(elRecreo, config.zonas.find((z) => z.codigo === "entrega_5_usd")!.poligono)).toBe(false);
  });

  it("aplica tarifa fija de zona en Cumbayá ($3.50)", () => {
    const parqueCumbaya = { lat: -0.205, lng: -78.435 };
    const res = cotizarEnvicilioHelper(config, parqueCumbaya, 9.8);
    expect(res.reglaAplicada).toBe("ZONA_TARIFA_FIJA");
    expect(res.zonaDetectada?.codigo).toBe("cumbaya_nayon");
    expect(res.costoTotalEnvio).toBe(3.5);
  });

  it("aplica fórmula (km * $0.50 - $3.00) con mínimo $1.00 fuera de zona gratis cuando es POR_KM", () => {
    // Sur de Quito - Villaflora (7 km viales: 7*0.5 - 3 = 0.50 -> aplica mínimo $1.00)
    const villaflora = { lat: -0.245, lng: -78.518 };
    const resCerca = cotizarEnvioDomicilio({
      config,
      destino: villaflora,
      distanciaVialKm: 7.0,
    });
    expect(resCerca.reglaAplicada).toBe("CALCULO_POR_KM");
    expect(resCerca.costoTotalEnvio).toBe(1.0);

    // Quitumbe (18 km viales: 18*0.5 - 3 = $6.00)
    const quitumbe = { lat: -0.298, lng: -78.552 };
    const resLejos = cotizarEnvioDomicilio({
      config,
      destino: quitumbe,
      distanciaVialKm: 18.0,
    });
    expect(resLejos.reglaAplicada).toBe("CALCULO_POR_KM");
    expect(resLejos.costoTotalEnvio).toBe(6.0);
  });

  it("bloquea cobro automático fuera del radio máximo de Pichincha (ej. Guayaquil)", () => {
    const guayaquil = { lat: -2.1894, lng: -79.8891 };
    const res = cotizarEnvioDomicilio({
      config,
      destino: guayaquil,
    });
    expect(res.dentroCobertura).toBe(false);
    expect(res.reglaAplicada).toBe("FUERA_DE_COBERTURA");
  });

  it("respeta mostrarKilometrosCliente en etiquetaResumen sin exponer la fórmula en ella, conservando formulaDetalle para el pedido", () => {
    const fueraDePoligonos = { lat: -0.02, lng: -78.38 }; // Pichincha fuera de polígonos fijos
    const conKm = cotizarEnvioDomicilio({
      config: { ...config, mostrarKilometrosCliente: true },
      destino: fueraDePoligonos,
      distanciaVialKm: 17.84,
    });
    expect(conKm.etiquetaResumen).toBe("Envío a domicilio (17.8 km)");
    expect(conKm.etiquetaResumen).not.toContain("$0.50");
    expect(conKm.formulaDetalle).toContain("17.8 km × $0.50/km");

    const sinKm = cotizarEnvioDomicilio({
      config: { ...config, mostrarKilometrosCliente: false },
      destino: fueraDePoligonos,
      distanciaVialKm: 17.84,
    });
    expect(sinKm.etiquetaResumen).toBe("Envío a domicilio");
    expect(sinKm.etiquetaResumen).not.toContain("km");
    expect(sinKm.formulaDetalle).toContain("17.8 km × $0.50/km");
    expect(sinKm.costoTotalEnvio).toBe(6.0);
  });

  it("aplica redondeo comercial en tramos (<25 ctv baja a .00, 25-50 ctv a .50, >50 ctv sube al entero)", () => {
    expect(redondearTarifaComercialEnvio(0)).toBe(0);
    expect(redondearTarifaComercialEnvio(5.03)).toBe(5.0);
    expect(redondearTarifaComercialEnvio(5.24)).toBe(5.0);
    expect(redondearTarifaComercialEnvio(5.25)).toBe(5.5);
    expect(redondearTarifaComercialEnvio(5.38)).toBe(5.5);
    expect(redondearTarifaComercialEnvio(5.5)).toBe(5.5);
    expect(redondearTarifaComercialEnvio(5.51)).toBe(6.0);
    expect(redondearTarifaComercialEnvio(5.92)).toBe(6.0);

    const surQuito = { lat: -0.298, lng: -78.552 }; // Quitumbe (fuera de anillos de tarifa fija hasta 17 km)

    // 16.06 km * $0.50 - $3.00 = $5.03 -> menos de 25 ctv -> $5.00
    const casoMenos25 = cotizarEnvioDomicilio({
      config,
      destino: surQuito,
      distanciaVialKm: 16.06,
    });
    expect(casoMenos25.costoTotalEnvio).toBe(5.0);
    expect(casoMenos25.formulaDetalle).toContain("= $5.03 → aproximado $5.00");

    // 14.70 km * $0.50 - $3.00 = $4.35 -> entre 25 y 50 ctv -> $4.50
    const casoEntre25y50 = cotizarEnvioDomicilio({
      config,
      destino: surQuito,
      distanciaVialKm: 14.7,
    });
    expect(casoEntre25y50.costoTotalEnvio).toBe(4.5);
    expect(casoEntre25y50.formulaDetalle).toContain("= $4.35 → aproximado $4.50");

    // 17.84 km * $0.50 - $3.00 = $5.92 -> más de 50 ctv -> $6.00
    const casoMas50 = cotizarEnvioDomicilio({
      config,
      destino: surQuito,
      distanciaVialKm: 17.84,
    });
    expect(casoMas50.costoTotalEnvio).toBe(6.0);
    expect(casoMas50.formulaDetalle).toContain("= $5.92 → aproximado $6.00");
  });

  it("construye detalle de dirección inversa con calles, sector y parroquia sin duplicados ni ruido administrativo", () => {
    const detalleVillaflora = construirDetalleDireccionDesdeNominatim(
      {
        display_name:
          "Av. Rodrigo de Chávez, Villaflora, Chimbacalle, Administración Zonal Eloy Alfaro, Quito, Pichincha, 170111, Ecuador",
        address: {
          road: "Av. Rodrigo de Chávez",
          house_number: "OE2-44",
          neighbourhood: "Villaflora",
          suburb: "Chimbacalle",
          city_district: "Administración Zonal Eloy Alfaro",
          city: "Quito",
          state: "Pichincha",
          postcode: "170111",
        },
      },
      "Edificio Mirador Sur"
    );

    expect(detalleVillaflora).not.toBeNull();
    expect(detalleVillaflora?.callePrincipal).toBe("Edificio Mirador Sur (Av. Rodrigo de Chávez OE2-44)");
    expect(detalleVillaflora?.sectorBarrio).toBe("Villaflora");
    expect(detalleVillaflora?.parroquia).toBe("Chimbacalle");
    expect(detalleVillaflora?.ciudad).toBe("Quito");
    expect(detalleVillaflora?.resumenDireccion).toContain("Villaflora");
    expect(detalleVillaflora?.resumenDireccion).toContain("Parroquia Chimbacalle");
    expect(detalleVillaflora?.resumenDireccion).not.toContain("Administración Zonal");
  });

  it("permite áreas solapadas y aplica siempre la tarifa más baja sin importar el orden de prioridad", () => {
    const puntoPuembo = { lat: -0.2, lng: -78.36 }; // Cae en Tumbaco/Puembo ($6.00, prioridad 3)
    const configConSolapamiento = {
      ...config,
      zonas: [
        ...config.zonas,
        // Caso 1: área superpuesta más cara ($8.00) -> debe ganar la de $6.00
        {
          id: "zon-puembo-cara",
          codigo: "puembo_cara",
          nombre: "Puembo Extendido",
          provincia: "Pichincha",
          modoCobro: "TARIFA_FIJA" as const,
          tarifaFija: 8.0,
          prioridad: 1, // Incluso con prioridad 1, $6.00 es menor que $8.00
          activo: true,
          color: "#4F46E5",
          sectoresReferencia: ["Puembo"],
          poligono: [
            [-0.25, -78.4],
            [-0.25, -78.33],
            [-0.16, -78.33],
            [-0.16, -78.4],
          ] as [number, number][],
        },
      ],
    };

    const resEntre6y8 = cotizarEnvioDomicilio({
      config: configConSolapamiento,
      destino: puntoPuembo,
      distanciaVialKm: 24.5,
    });
    expect(resEntre6y8.costoTotalEnvio).toBe(6.0);
    expect(resEntre6y8.zonaDetectada?.codigo).toBe("tumbaco_puembo");
    expect(resEntre6y8.zonasCoincidentes?.length).toBe(2);
    expect(resEntre6y8.formulaDetalle).toContain("Áreas solapadas");

    // Caso 2: área promocional más económica ($4.00, prioridad 99) superpuesta sobre $6.00 y $8.00 -> gana $4.00
    const configConSubzonaBarata = {
      ...configConSolapamiento,
      zonas: [
        ...configConSolapamiento.zonas,
        {
          id: "zon-ruta-viva-promo",
          codigo: "ruta_viva_promo",
          nombre: "Ruta Viva Cercana",
          provincia: "Pichincha",
          modoCobro: "TARIFA_FIJA" as const,
          tarifaFija: 4.0,
          prioridad: 99,
          activo: true,
          color: "#10B981",
          sectoresReferencia: ["Ruta Viva"],
          poligono: [
            [-0.22, -78.38],
            [-0.22, -78.34],
            [-0.18, -78.34],
            [-0.18, -78.38],
          ] as [number, number][],
        },
      ],
    };

    const resConPromo4 = cotizarEnvioDomicilio({
      config: configConSubzonaBarata,
      destino: puntoPuembo,
      distanciaVialKm: 24.5,
    });
    expect(resConPromo4.costoTotalEnvio).toBe(4.0);
    expect(resConPromo4.zonaDetectada?.codigo).toBe("ruta_viva_promo");
    expect(resConPromo4.zonasCoincidentes?.length).toBe(3);
  });

  it("para clientes NO registrados no aplica zona gratuita y cobra tarifa mínima $1.00 + $0.50 por km (calculando ahorro por registrarse)", () => {
    const laCarolina = { lat: -0.184, lng: -78.4846 };

    // 1. Mismo punto en Centro-Norte (2.0 km): Registrado = $0.00 vs No Registrado = $1.00 + 2.0 * $0.50 = $2.00
    const cotRegistrado = cotizarEnvioDomicilio({
      config,
      destino: laCarolina,
      distanciaVialKm: 2.0,
      clienteRegistrado: true,
    });
    expect(cotRegistrado.costoTotalEnvio).toBe(0);
    expect(cotRegistrado.reglaAplicada).toBe("ZONA_GRATIS");

    const cotNoRegistrado = cotizarEnvioDomicilio({
      config,
      destino: laCarolina,
      distanciaVialKm: 2.0,
      clienteRegistrado: false,
    });
    expect(cotNoRegistrado.reglaAplicada).toBe("TARIFA_NO_REGISTRADO_KM");
    expect(cotNoRegistrado.clienteRegistrado).toBe(false);
    expect(cotNoRegistrado.costoTotalEnvio).toBe(2.0);
    expect(cotNoRegistrado.costoSiFueraRegistradoUsd).toBe(0);
    expect(cotNoRegistrado.ahorroPorRegistrarseUsd).toBe(2.0);
    expect(cotNoRegistrado.etiquetaResumen).not.toContain("Gratis");

    // 2. Distancia muy corta (0.2 km): $1.00 + $0.10 = $1.10 -> respeta tarifa mínima $1.00
    const cotMinima = cotizarEnvioDomicilio({
      config,
      destino: laCarolina,
      distanciaVialKm: 0.2,
      clienteRegistrado: false,
    });
    expect(cotMinima.costoTotalEnvio).toBe(1.0);

    // 3. Retiro en tienda sigue siendo $0.00 incluso para visitantes no registrados
    const cotRetiroInvitado = cotizarEnvioDomicilio({
      config,
      destino: laCarolina,
      retiroEnLocal: true,
      clienteRegistrado: false,
    });
    expect(cotRetiroInvitado.costoTotalEnvio).toBe(0);
    expect(cotRetiroInvitado.reglaAplicada).toBe("RETIRO_LOCAL");
  });
});

function cotizarEnvicilioHelper(
  config: ReturnType<typeof crearConfiguracionLogisticaPorDefecto>,
  destino: { lat: number; lng: number },
  distanciaVialKm: number
) {
  return cotizarEnvioDomicilio({ config, destino, distanciaVialKm });
}

