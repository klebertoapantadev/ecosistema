import { crearServidorMcpCatalogo } from "@eco/agentes-ia";
import {
  cotizarEnvioDesdeEntradaAction,
  obtenerCatalogoProductosAction,
  obtenerConfiguracionLogisticaAction,
} from "@eco/comercio";

const manejarMcp = crearServidorMcpCatalogo({
  negocioPorDefecto: "tinkay",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS",
  consultarProductos: async (negocioId) => {
    return await obtenerCatalogoProductosAction(negocioId);
  },
  cotizarEnvio: async (negocioId, params) => {
    const cfg = await obtenerConfiguracionLogisticaAction(negocioId);
    const resultado = await cotizarEnvioDesdeEntradaAction({
      negocio: negocioId,
      enlaceOTexto: params.enlace_o_direccion,
      lat: params.lat,
      lng: params.lng,
      retiroEnLocal: params.retiro_en_local,
      deliveryIncluidoProducto: params.delivery_incluido_producto,
      recargoLogisticoProducto: params.recargo_logistico_producto_usd,
    });

    if (!resultado.ok) {
      return {
        ok: false,
        error: resultado.error,
        politica_general: {
          zona_envio_gratis: cfg.zonaGratisNombre,
          tienda_fisica_maps: cfg.origenMapaUrl,
        },
      };
    }

    const c = resultado.cotizacion;
    const mostrarKm = cfg.mostrarKilometrosCliente !== false;
    return {
      ok: true,
      dentro_cobertura: c.dentroCobertura,
      zona_detectada: c.zonaDetectada?.nombre ?? null,
      ...(mostrarKm ? { distancia_vial_km: c.distanciaVialKm } : {}),
      mostrar_kilometros_cliente: mostrarKm,
      costo_envio_usd: c.costoTotalEnvio,
      etiqueta_resumen: c.etiquetaResumen,
      direccion_detectada: resultado.direccionDetectada ?? null,
      detalle_direccion: c.detalleDireccion ?? null,
      url_google_maps_destino: c.urlGoogleMapsDestino,
      tienda_fisica_maps: cfg.origenMapaUrl,
      instruccion_presentacion_cliente: mostrarKm
        ? "Informa únicamente el costo final de envío (puedes indicar los kilómetros). Nunca menciones tarifas por km ni descuentos internos."
        : "Informa únicamente el costo final de envío SIN mencionar kilómetros ni fórmulas internas.",
    };
  },
});

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejarMcp(peticion);
}

export async function GET() {
  return new Response(
    JSON.stringify({
      nombre: "mcp-catalogo-tinkay",
      version: "1.0.0",
      protocolo: "Model Context Protocol (JSON-RPC 2.0 / streamable_http)",
      descripcion: "Servidor MCP de consulta de catálogo para Tinkay Floristería",
      autenticacion: "Authorization: Bearer eco_live_...",
      endpoints: {
        mcp: "POST /api/mcp/catalogo",
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
