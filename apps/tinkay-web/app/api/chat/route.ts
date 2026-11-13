import { NextRequest, NextResponse } from "next/server";
import { ErrorSinConfiguracionAria, invocarAgentePorNegocio } from "@eco/agentes-ia";
import {
  cotizarEnvioDesdeEntradaAction,
  extraerCoordenadasDeTextoOUrl,
  extraerPrimeraUrlDeTexto,
  obtenerConfiguracionLogisticaAction,
} from "@eco/comercio";

// Chat publico de la tienda (Mía). Pasa por packages/agentes-ia como exige el
// ADR-0002: la API key del agente vive cifrada en Supabase Vault (cfg_aria +
// Edge Function invocar-aria) con respaldo a variables de entorno del servidor.
//
// El prompt de Mía NO esta aqui: se edita en el panel de ARIA, en la identidad
// del agente cuyo id se administra en /panel/aria (o ARIA_AGENT_ID).

export const maxDuration = 60;

const NEGOCIO = "tinkay";

// Por debajo de maxDuration, para que la ruta alcance a responder el error y
// el chat use su texto de respaldo en vez de recibir un 504 sin cuerpo.
const ESPERA_ARIA_MS = 50000;

// La ruta es publica (sin sesion): se acota el tamano permitiendo enlaces largos de Google Maps.
const LARGO_MAXIMO_PROMPT = 1800;
const FORMATO_CONVERSACION = /^[A-Za-z0-9_-]{8,64}$/;

const PATRON_DOMINIO_MAPA =
  /(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google|maps\.apple\.com|waze\.com|openstreetmap\.org)/i;

export async function POST(req: NextRequest) {
  let prompt: unknown;
  let conversationId: unknown;
  try {
    ({ prompt, conversation_id: conversationId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt vacío" }, { status: 400 });
  }
  if (prompt.length > LARGO_MAXIMO_PROMPT) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 413 });
  }
  const conversacion =
    typeof conversationId === "string" && FORMATO_CONVERSACION.test(conversationId)
      ? conversationId
      : undefined;

  const textoLimpio = prompt.trim();
  const urlEnMensaje = extraerPrimeraUrlDeTexto(textoLimpio);
  const coordDirecta = extraerCoordenadasDeTextoOUrl(textoLimpio);
  const tieneUbicacionMapa =
    Boolean(coordDirecta) || Boolean(urlEnMensaje && PATRON_DOMINIO_MAPA.test(urlEnMensaje));

  let cotizacionEnvio:
    | {
        etiquetaResumen: string;
        costoTotalEnvio: number;
        dentroCobertura: boolean;
        zonaDetectadaNombre?: string;
        distanciaVialKm?: number;
        direccionReferencial?: string;
        callePrincipal?: string;
        sectorBarrio?: string;
        parroquia?: string;
        enlaceMapa: string;
        lat: number;
        lng: number;
      }
    | undefined;

  let promptParaAria = textoLimpio;

  if (tieneUbicacionMapa) {
    try {
      const [cfg, resCot] = await Promise.all([
        obtenerConfiguracionLogisticaAction(NEGOCIO),
        cotizarEnvioDesdeEntradaAction({
          negocio: NEGOCIO,
          enlaceOTexto: urlEnMensaje ?? textoLimpio,
        }),
      ]);
      if (resCot.ok) {
        const c = resCot.cotizacion;
        const detGeo = c.detalleDireccion;
        const direccionRef = detGeo?.resumenDireccion || resCot.direccionDetectada;
        const mostrarKm = cfg.mostrarKilometrosCliente !== false;
        const enlaceFinal =
          urlEnMensaje && /^https?:\/\//i.test(urlEnMensaje)
            ? urlEnMensaje
            : c.urlGoogleMapsDestino;
        cotizacionEnvio = {
          etiquetaResumen: c.etiquetaResumen,
          costoTotalEnvio: c.costoTotalEnvio,
          dentroCobertura: c.dentroCobertura,
          zonaDetectadaNombre: c.zonaDetectada?.nombre,
          ...(mostrarKm ? { distanciaVialKm: c.distanciaVialKm } : {}),
          ...(direccionRef ? { direccionReferencial: direccionRef } : {}),
          ...(detGeo?.callePrincipal ? { callePrincipal: detGeo.callePrincipal } : {}),
          ...(detGeo?.sectorBarrio ? { sectorBarrio: detGeo.sectorBarrio } : {}),
          ...(detGeo?.parroquia ? { parroquia: detGeo.parroquia } : {}),
          enlaceMapa: enlaceFinal,
          lat: c.destino.lat,
          lng: c.destino.lng,
        };

        promptParaAria =
          `${textoLimpio}\n\n` +
          `[DATOS OFICIALES DE ENVÍO TINKAY PARA ESTA UBICACIÓN GPS: ` +
          `Dentro de cobertura=${c.dentroCobertura ? "SÍ" : "NO"}; ` +
          `Zona=${c.zonaDetectada?.nombre ?? "Domicilio"}; ` +
          (direccionRef ? `Dirección referencial=${direccionRef}; ` : "") +
          (mostrarKm ? `Distancia=${c.distanciaVialKm.toFixed(1)} km; ` : "") +
          `Costo final de envío=$${c.costoTotalEnvio.toFixed(2)} USD. ` +
          `Usa exactamente este costo final al responder al cliente y puedes confirmar amablemente el sector o calle detectada. ` +
          `${
            mostrarKm
              ? "Puedes indicar la distancia en km."
              : "NO menciones distancia en kilómetros."
          } ` +
          `NUNCA menciones fórmulas internas, tarifas por km ni descuentos absorbidos.]`;
      }
    } catch {
      // Si falla la resolución externa de mapas no bloqueamos la conversación con ARIA
    }
  }

  try {
    const data = await invocarAgentePorNegocio(NEGOCIO, promptParaAria, {
      conversationId: conversacion,
      tiempoMaximoMs: ESPERA_ARIA_MS,
    });
    return NextResponse.json({ response: data.response, cotizacionEnvio });
  } catch (e) {
    if (e instanceof ErrorSinConfiguracionAria) {
      return NextResponse.json({ error: e.message, cotizacionEnvio }, { status: 503 });
    }
    return NextResponse.json(
      { error: String((e as Error).message ?? e), cotizacionEnvio },
      { status: 502 }
    );
  }
}
