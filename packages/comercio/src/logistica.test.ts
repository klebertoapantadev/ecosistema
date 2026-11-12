import { describe, expect, it } from "vitest";
import {
  cotizarEnvioDomicilio,
  crearConfiguracionLogisticaPorDefecto,
  extraerCoordenadasDeTextoOUrl,
  puntoEnPoligono,
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
  });
});

function cotizarEnvicilioHelper(
  config: ReturnType<typeof crearConfiguracionLogisticaPorDefecto>,
  destino: { lat: number; lng: number },
  distanciaVialKm: number
) {
  return cotizarEnvioDomicilio({ config, destino, distanciaVialKm });
}

