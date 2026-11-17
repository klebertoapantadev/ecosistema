import { NextRequest, NextResponse } from "next/server";
import { ErrorSinConfiguracionAria, invocarAgentePorNegocio } from "@eco/agentes-ia";
import {
  cotizarEnvioDesdeEntradaAction,
  extraerCoordenadasDeTextoOUrl,
  extraerPrimeraUrlDeTexto,
  listarEntregaInmediataAction,
  obtenerConfiguracionLogisticaAction,
  registrarInteraccionChatWebAction,
  sincronizarHiloPublicoChatWebAction,
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

export async function GET(req: NextRequest) {
  const convId = req.nextUrl.searchParams.get("conversation_id") ?? "";
  if (!FORMATO_CONVERSACION.test(convId)) {
    return NextResponse.json({
      ok: true,
      existe: false,
      estadoAtencion: "BOT_ACTIVO",
      mensajesHumanos: [],
    });
  }

  try {
    const estado = await sincronizarHiloPublicoChatWebAction(NEGOCIO, convId);
    return NextResponse.json(estado);
  } catch {
    return NextResponse.json({
      ok: true,
      existe: false,
      estadoAtencion: "BOT_ACTIVO",
      mensajesHumanos: [],
    });
  }
}

export async function POST(req: NextRequest) {
  let prompt: unknown;
  let conversationId: unknown;
  let visitante: unknown;
  let respuestaRespaldo: unknown;
  try {
    ({
      prompt,
      conversation_id: conversationId,
      visitante,
      respuesta_respaldo: respuestaRespaldo,
    } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const conversacion =
    typeof conversationId === "string" && FORMATO_CONVERSACION.test(conversationId)
      ? conversationId
      : undefined;

  if (typeof respuestaRespaldo === "string" && respuestaRespaldo.trim() && conversacion) {
    try {
      await registrarInteraccionChatWebAction({
        negocio: NEGOCIO,
        claveHilo: conversacion,
        fase: "RESPUESTA_ARIA",
        contenido: respuestaRespaldo.trim().slice(0, LARGO_MAXIMO_PROMPT),
        metadatos: {
          nombre_agente: "Mía (Catálogo Web)",
        },
      });
    } catch {
      // No interrumpir el flujo público
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt vacío" }, { status: 400 });
  }
  if (prompt.length > LARGO_MAXIMO_PROMPT) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 413 });
  }

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

  const origenTienda = (
    req.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://tinkay-web.vercel.app"
  ).replace(/\/+$/, "");

  let bloqueEntregaInmediata = "";
  try {
    const resInm = await listarEntregaInmediataAction(NEGOCIO, false);
    if (resInm.ok && resInm.items.length > 0) {
      const resumenInm = resInm.items
        .slice(0, 6)
        .map(
          (i) =>
            `"${i.nombre}" a $${Number(i.precio).toFixed(2)} USD (${i.tiempoEntregaTexto}${
              i.imagenUrl && /^https?:\/\//i.test(i.imagenUrl)
                ? `, foto: ![${i.nombre}](${i.imagenUrl})`
                : ""
            }, link: ${origenTienda}/producto/${i.slug})`
        )
        .join("; ");
      bloqueEntregaInmediata =
        `\n[ARREGLOS LISTOS EN TIENDA PARA ENTREGA INMEDIATA (1 A 2 HORAS): ${resumenInm}. ` +
        `Ver todos en ${origenTienda}/categoria/entrega-inmediata. Ofrécelos con prioridad si el cliente busca entrega rápida hoy.]`;
    }
  } catch {
    // Continuar sin bloquear chat
  }

  const guiaEnlacesTienda =
    `[ENLACES DIRECTOS E-COMMERCE TINKAY: ` +
    `Para redirigir al cliente a una categoría usa ${origenTienda}/categoria/{slug} ` +
    `(ej. Entrega Inmediata: ${origenTienda}/categoria/entrega-inmediata, Eventos: ${origenTienda}/categoria/eventos-y-ceremonias, Box Florales: ${origenTienda}/categoria/box-florales, Estilo Coreano: ${origenTienda}/categoria/cat-coreanos, Condolencias: ${origenTienda}/categoria/condolencias). ` +
    `Para redirigir directamente a un producto usa el campo url_tienda_producto del catálogo (${origenTienda}/producto/{slug}). ` +
    `Incluye el link directo cuando recomiendes una colección o arreglo específico.]` +
    bloqueEntregaInmediata;

  let promptParaAria = `${textoLimpio}\n\n${guiaEnlacesTienda}`;

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
          `NUNCA menciones fórmulas internas, tarifas por km ni descuentos absorbidos.]\n` +
          guiaEnlacesTienda;
      }
    } catch {
      // Si falla la resolución externa de mapas no bloqueamos la conversación con ARIA
    }
  }

  const claveHiloOmnicanal = conversacion ?? `web-anon-${Date.now()}`;
  let silenciarAriaPorHumano = false;
  let asesoraNombreActiva: string | null = null;
  let conversacionOmnicanalId: string | null = null;

  const datosVisitante =
    visitante && typeof visitante === "object" ? (visitante as Record<string, unknown>) : {};
  const nombreVisitante =
    typeof datosVisitante.nombre === "string" ? datosVisitante.nombre.trim().slice(0, 90) : "";
  const correoVisitante =
    typeof datosVisitante.correo === "string" ? datosVisitante.correo.trim().slice(0, 120) : "";
  const telefonoVisitante =
    typeof datosVisitante.telefono === "string" ? datosVisitante.telefono.trim().slice(0, 32) : "";

  try {
    const trazaEntrada = await registrarInteraccionChatWebAction({
      negocio: NEGOCIO,
      claveHilo: claveHiloOmnicanal,
      fase: "ENTRADA_CLIENTE",
      contenido: textoLimpio,
      metadatos: {
        origen_url: origenTienda,
        ...(nombreVisitante ? { nombre_cliente: nombreVisitante } : {}),
        ...(correoVisitante ? { correo: correoVisitante } : {}),
        ...(telefonoVisitante ? { telefono: telefonoVisitante } : {}),
        ...(cotizacionEnvio ? { cotizacion_envio: cotizacionEnvio } : {}),
      },
    });
    silenciarAriaPorHumano = trazaEntrada.silenciarAria;
    asesoraNombreActiva = trazaEntrada.asesoraNombre ?? null;
    conversacionOmnicanalId = trazaEntrada.conversacionId ?? null;
  } catch {
    // No interrumpir la venta en vivo si la bitácora omnicanal tarda
  }

  if (silenciarAriaPorHumano) {
    return NextResponse.json({
      response: null,
      modoHumano: true,
      asesoraNombre: asesoraNombreActiva ?? "Asesora Tinkay",
      conversacionOmnicanalId,
      cotizacionEnvio,
    });
  }

  try {
    const data = await invocarAgentePorNegocio(NEGOCIO, promptParaAria, {
      conversationId: conversacion,
      tiempoMaximoMs: ESPERA_ARIA_MS,
    });

    if (data.response) {
      try {
        await registrarInteraccionChatWebAction({
          negocio: NEGOCIO,
          claveHilo: claveHiloOmnicanal,
          fase: "RESPUESTA_ARIA",
          contenido: data.response,
          metadatos: {
            nombre_agente: "Mía (ARIA IA)",
            ...(cotizacionEnvio ? { cotizacion_envio: cotizacionEnvio } : {}),
          },
        });
      } catch {
        // Ignorar fallo de bitácora secundaria
      }
    }

    return NextResponse.json({
      response: data.response,
      conversacionOmnicanalId,
      cotizacionEnvio,
    });
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
