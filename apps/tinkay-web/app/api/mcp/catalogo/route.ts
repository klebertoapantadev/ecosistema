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
          tarifa_por_km_fuera_zona_usd: cfg.tarifaPorKm,
          subsidio_base_absorbido_usd: cfg.subsidioBaseUsd,
          recargo_minimo_fuera_zona_usd: cfg.recargoMinimoExtra,
          tienda_fisica_maps: cfg.origenMapaUrl,
        },
      };
    }

    const c = resultado.cotizacion;
    return {
      ok: true,
      dentro_cobertura: c.dentroCobertura,
      regla_aplicada: c.reglaAplicada,
      zona_detectada: c.zonaDetectada?.nombre ?? null,
      distancia_vial_km: c.distanciaVialKm,
      fuente_distancia: c.fuenteDistancia,
      costo_envio_usd: c.costoTotalEnvio,
      etiqueta_resumen: c.etiquetaResumen,
      formula_detalle: c.formulaDetalle,
      direccion_detectada: resultado.direccionDetectada ?? null,
      url_google_maps_destino: c.urlGoogleMapsDestino,
      tienda_fisica_maps: cfg.origenMapaUrl,
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
