"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import {
  generarXmlCatalogoMeta,
  type ConfiguracionMarketingPublica,
  type ItemEventoMeta,
  type ProductoFeedCatalogoMeta,
} from "./marketing-meta";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

function sha256Hex(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

function normalizarEmailHash(email?: string | null): string | undefined {
  const limpio = (email || "").trim().toLowerCase();
  if (!limpio || !limpio.includes("@") || limpio.startsWith("consumidorfinal@")) {
    return undefined;
  }
  return sha256Hex(limpio);
}

function normalizarTelefonoEcuadorHash(telefono?: string | null): string | undefined {
  let digitos = (telefono || "").replace(/\D+/g, "");
  if (digitos.length < 8 || /^9+$/.test(digitos) || /^0+$/.test(digitos)) {
    return undefined;
  }
  if (digitos.startsWith("09") && digitos.length === 10) {
    digitos = `593${digitos.slice(1)}`;
  } else if (digitos.startsWith("9") && digitos.length === 9) {
    digitos = `593${digitos}`;
  } else if (digitos.startsWith("0") && digitos.length === 9) {
    digitos = `593${digitos.slice(1)}`;
  }
  return sha256Hex(digitos);
}

function dividirNombreApellidoHash(nombreCompleto?: string | null): {
  fn?: string;
  ln?: string;
} {
  const limpio = (nombreCompleto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!limpio || limpio === "consumidor final" || limpio === "cliente") {
    return {};
  }
  const partes = limpio.split(" ");
  const fn = partes[0] ? sha256Hex(partes[0]) : undefined;
  const ln = partes.length > 1 ? sha256Hex(partes.slice(1).join(" ")) : undefined;
  return { fn, ln };
}

export async function obtenerConfiguracionMarketingPublicaAction(
  negocio: string
): Promise<ConfiguracionMarketingPublica> {
  const negNorm = normalizarIdentificadorNegocio(negocio).principal;
  const envPixelEspecifico =
    process.env[`NEXT_PUBLIC_META_PIXEL_ID_${negNorm.toUpperCase()}`]?.trim() ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
    null;
  const envDominioVerif =
    process.env[`NEXT_PUBLIC_META_DOMAIN_VERIFICATION_${negNorm.toUpperCase()}`]?.trim() ||
    process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION?.trim() ||
    null;

  try {
    const admin: any = crearClienteAdmin();
    if (admin) {
      const { data: pubRpc, error: errRpc } = await admin
        .schema("comun_configuracion")
        .rpc("cfg_fn_obtener_marketing_publico", { p_negocio: negNorm });

      if (!errRpc && pubRpc && typeof pubRpc === "object") {
        const pixel = (pubRpc.pixel_id ? String(pubRpc.pixel_id).trim() : "") || envPixelEspecifico;
        const dom =
          (pubRpc.dominio_verificacion ? String(pubRpc.dominio_verificacion).trim() : "") ||
          envDominioVerif;
        return {
          activo: Boolean(pubRpc.activo ?? Boolean(pixel)),
          pixelId: pixel || null,
          dominioVerificacion: dom || null,
          catalogoActivo: pubRpc.catalogo_activo !== false,
        };
      }
    }

    // Lectura pública sin cookies() para compatibilidad total con generateMetadata() estático en Next.js build
    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const sbAnon = (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
    ).trim();

    if (sbUrl && sbAnon) {
      const respRpc = await fetch(
        `${sbUrl}/rest/v1/rpc/cfg_fn_obtener_marketing_publico`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: sbAnon,
            Authorization: `Bearer ${sbAnon}`,
            "Content-Profile": "comun_configuracion",
          },
          body: JSON.stringify({ p_negocio: negNorm }),
          next: { revalidate: 120 },
        } as RequestInit
      );
      if (respRpc.ok) {
        const pubRpc: any = await respRpc.json().catch(() => null);
        if (pubRpc && typeof pubRpc === "object") {
          const pixel =
            (pubRpc.pixel_id ? String(pubRpc.pixel_id).trim() : "") || envPixelEspecifico;
          const dom =
            (pubRpc.dominio_verificacion ? String(pubRpc.dominio_verificacion).trim() : "") ||
            envDominioVerif;
          return {
            activo: Boolean(pubRpc.activo ?? Boolean(pixel)),
            pixelId: pixel || null,
            dominioVerificacion: dom || null,
            catalogoActivo: pubRpc.catalogo_activo !== false,
          };
        }
      }
    }
  } catch {
    // Continuar con respaldo por entorno
  }

  return {
    activo: Boolean(envPixelEspecifico),
    pixelId: envPixelEspecifico,
    dominioVerificacion: envDominioVerif,
    catalogoActivo: true,
  };
}

export interface EntradaEventoConversionMetaServidor {
  negocio: string;
  eventName: "Purchase" | "Lead" | "InitiateCheckout" | "AddToCart" | "ViewContent";
  eventId: string;
  eventSourceUrl?: string;
  valorUsd?: number;
  moneda?: string;
  codigoOrden?: string;
  contentIds?: string[];
  contents?: ItemEventoMeta[];
  contentName?: string;
  comprador?: {
    email?: string | null;
    telefono?: string | null;
    nombreCompleto?: string | null;
    usuarioId?: string | null;
  };
  atribucion?: {
    fbc?: string | null;
    fbp?: string | null;
    ctwaClid?: string | null;
  };
  esPrueba?: boolean;
  testEventCodeOverride?: string;
}

export async function enviarEventoConversionMetaServidorAction(
  entrada: EntradaEventoConversionMetaServidor
): Promise<{ ok: boolean; omitido?: boolean; error?: string; respuesta?: unknown }> {
  try {
    const negNorm = normalizarIdentificadorNegocio(entrada.negocio).principal;
    let clientIp: string | undefined;
    let userAgent: string | undefined;
    let refererUrl: string | undefined;

    try {
      const hdrs = await headers();
      const xff = hdrs.get("x-forwarded-for");
      clientIp = xff ? xff.split(",")[0]?.trim() : hdrs.get("x-real-ip") ?? undefined;
      userAgent = hdrs.get("user-agent") ?? undefined;
      refererUrl = hdrs.get("referer") ?? undefined;
    } catch {
      // Llamado fuera de un request HTTP interactivo
    }

    const em = normalizarEmailHash(entrada.comprador?.email);
    const ph = normalizarTelefonoEcuadorHash(entrada.comprador?.telefono);
    const { fn, ln } = dividirNombreApellidoHash(entrada.comprador?.nombreCompleto);
    const country = sha256Hex("ec");
    const externalId = entrada.comprador?.usuarioId
      ? sha256Hex(entrada.comprador.usuarioId.trim().toLowerCase())
      : undefined;

    const userData: Record<string, unknown> = {
      country: [country],
    };
    if (em) userData.em = [em];
    if (ph) userData.ph = [ph];
    if (fn) userData.fn = [fn];
    if (ln) userData.ln = [ln];
    if (externalId) userData.external_id = [externalId];
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;
    if (entrada.atribucion?.fbc) userData.fbc = entrada.atribucion.fbc;
    if (entrada.atribucion?.fbp) userData.fbp = entrada.atribucion.fbp;
    if (entrada.atribucion?.ctwaClid) userData.ctwa_clid = entrada.atribucion.ctwaClid;

    const customData: Record<string, unknown> = {
      currency: (entrada.moneda || "USD").toUpperCase(),
    };
    if (typeof entrada.valorUsd === "number" && Number.isFinite(entrada.valorUsd)) {
      customData.value = Math.round(entrada.valorUsd * 100) / 100;
    }
    if (entrada.contentIds && entrada.contentIds.length > 0) {
      customData.content_ids = entrada.contentIds;
      customData.content_type = "product";
    }
    if (entrada.contents && entrada.contents.length > 0) {
      customData.contents = entrada.contents;
    }
    if (entrada.contentName) customData.content_name = entrada.contentName;
    if (entrada.codigoOrden) customData.order_id = entrada.codigoOrden;

    const actionSource = entrada.atribucion?.ctwaClid ? "business_messaging" : "website";
    const eventoPayload: Record<string, unknown> = {
      event_name: entrada.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: entrada.eventId,
      action_source: actionSource,
      ...(actionSource === "business_messaging" ? { messaging_channel: "whatsapp" } : {}),
      ...(entrada.eventSourceUrl || refererUrl
        ? { event_source_url: entrada.eventSourceUrl || refererUrl }
        : {}),
      user_data: userData,
      custom_data: customData,
    };

    const supabase: any = crearClienteAdmin() ?? (await crearClienteServidor());
    const { data: resRpc, error: errRpc } = await supabase
      .schema("comun_configuracion")
      .rpc("cfg_fn_enviar_evento_meta_capi", {
        p_negocio: negNorm,
        p_evento: eventoPayload,
        p_es_prueba: Boolean(entrada.esPrueba),
        p_test_event_code_override: entrada.testEventCodeOverride ?? null,
      });

    if (!errRpc && resRpc && typeof resRpc === "object") {
      if (resRpc.ok) {
        return { ok: true, respuesta: resRpc.respuesta_meta };
      }
      if (!resRpc.omitido && entrada.esPrueba) {
        return { ok: false, error: String(resRpc.error || "Meta rechazó el evento de prueba") };
      }
      if (resRpc.omitido) {
        // Intentar respaldo opcional con variables de entorno del servidor si existen
        const envPixel =
          process.env[`NEXT_PUBLIC_META_PIXEL_ID_${negNorm.toUpperCase()}`]?.trim() ||
          process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
        const envToken =
          process.env[`META_CAPI_ACCESS_TOKEN_${negNorm.toUpperCase()}`]?.trim() ||
          process.env.META_CAPI_ACCESS_TOKEN?.trim();
        if (!envPixel || !envToken) {
          return { ok: false, omitido: true, error: String(resRpc.error || "Omitido") };
        }
        return await enviarDirectoGraphApiMeta({
          pixelId: envPixel,
          accessToken: envToken,
          eventoPayload,
          testEventCode:
            entrada.testEventCodeOverride ||
            process.env[`META_TEST_EVENT_CODE_${negNorm.toUpperCase()}`]?.trim() ||
            process.env.META_TEST_EVENT_CODE?.trim(),
        });
      }
      return { ok: false, error: String(resRpc.error || "No se pudo despachar el evento a Meta") };
    }

    // Respaldo por variables de entorno si la migración 20261119000008 aún no se ha aplicado
    const envPixel =
      process.env[`NEXT_PUBLIC_META_PIXEL_ID_${negNorm.toUpperCase()}`]?.trim() ||
      process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
    const envToken =
      process.env[`META_CAPI_ACCESS_TOKEN_${negNorm.toUpperCase()}`]?.trim() ||
      process.env.META_CAPI_ACCESS_TOKEN?.trim();

    if (envPixel && envToken) {
      return await enviarDirectoGraphApiMeta({
        pixelId: envPixel,
        accessToken: envToken,
        eventoPayload,
        testEventCode: entrada.testEventCodeOverride,
      });
    }

    return {
      ok: false,
      omitido: !entrada.esPrueba,
      error: errRpc?.message || "Ejecuta la migración 20261119000008 en Supabase y guarda el Token CAPI en /panel/configuracion.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado en Meta CAPI",
    };
  }
}

async function enviarDirectoGraphApiMeta(params: {
  pixelId: string;
  accessToken: string;
  eventoPayload: Record<string, unknown>;
  testEventCode?: string;
}): Promise<{ ok: boolean; error?: string; respuesta?: unknown }> {
  const body: Record<string, unknown> = { data: [params.eventoPayload] };
  if (params.testEventCode?.trim()) {
    body.test_event_code = params.testEventCode.trim();
  }
  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(params.pixelId)}/events?access_token=${encodeURIComponent(params.accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    }
  );
  const json = await resp.json().catch(() => ({}));
  if (resp.ok) {
    return { ok: true, respuesta: json };
  }
  return {
    ok: false,
    error: String((json as any)?.error?.message || `Meta HTTP ${resp.status}`),
    respuesta: json,
  };
}

// ═══════════ Generador Servidor del Feed XML Vivo de Catálogo por Negocio ═══════════

function productoVigenteHoy(detalle: any, activo = true, hoy = new Date()): boolean {
  if (activo === false) return false;
  const tipo = detalle?.vigencia_tipo || "SIEMPRE";
  if (tipo === "SIEMPRE") return true;
  const inicio = typeof detalle?.fecha_inicio === "string" ? detalle.fecha_inicio.trim() : "";
  const fin = typeof detalle?.fecha_fin === "string" ? detalle.fecha_fin.trim() : "";
  if (!inicio || !fin) return true;

  if (tipo === "RANGO_FECHAS") {
    const hoyYmd = hoy.toISOString().split("T")[0] ?? "";
    return Boolean(hoyYmd >= inicio && hoyYmd <= fin);
  }
  if (tipo === "ESTACIONAL_ANUAL") {
    const aMd = (v: string) => {
      const p = v.split("-");
      return p.length === 3 ? `${p[1]}-${p[2]}` : v;
    };
    const hoyMd = (hoy.toISOString().split("T")[0] ?? "").slice(5);
    const iniMd = aMd(inicio);
    const finMd = aMd(fin);
    return iniMd <= finMd ? hoyMd >= iniMd && hoyMd <= finMd : hoyMd >= iniMd || hoyMd <= finMd;
  }
  return true;
}

function nombreMarcaPorDefecto(negocio: string): string {
  switch (negocio) {
    case "tinkay":
      return "Tinkay Flores y Eventos";
    case "margaritas":
      return "Margaritas Floristería";
    case "fastfix":
      return "FastFix Home";
    default:
      return "Tranqi";
  }
}

export async function generarFeedXmlCatalogoMetaNegocio(params: {
  negocio: string;
  urlBaseTienda: string;
}): Promise<{ ok: boolean; xml: string; totalItems: number }> {
  const negNorm = normalizarIdentificadorNegocio(params.negocio).principal;
  const urlBase = params.urlBaseTienda.replace(/\/+$/, "");
  const marcaDefecto = nombreMarcaPorDefecto(negNorm);

  const cfgPub = await obtenerConfiguracionMarketingPublicaAction(negNorm);
  if (!cfgPub.catalogoActivo) {
    const xmlVacio = generarXmlCatalogoMeta({
      tituloTienda: `${marcaDefecto} — Catálogo Desactivado`,
      descripcionTienda: `Feed de productos de ${marcaDefecto}`,
      urlBaseTienda: urlBase,
      items: [],
    });
    return { ok: true, xml: xmlVacio, totalItems: 0 };
  }

  const supabase: any = crearClienteAdmin() ?? (await crearClienteServidor());
  const [{ data: cfgNeg }, { data: categoriasRows }, { data: productosRows }] = await Promise.all([
    supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_nombre_comercial, cfg_eslogan")
      .eq("cfg_negocio", negNorm)
      .maybeSingle(),
    supabase
      .schema("comun_comercio")
      .from("com_categoria")
      .select("ctg_id, ctg_nombre, ctg_activo, ctg_eliminado_en")
      .eq("ctg_negocio", negNorm)
      .is("ctg_eliminado_en", null),
    supabase
      .schema("comun_comercio")
      .from("com_producto")
      .select(
        "pro_id, pro_slug, pro_nombre, pro_descripcion, pro_categoria_principal_id, pro_activo, pro_eliminado_en, pro_detalle_producto, com_variante(var_id, var_sku, var_nombre, var_precio, var_tarifa_iva_porcentaje, var_precio_comparacion, var_activo, var_eliminado_en, var_detalle_variante)"
      )
      .eq("pro_negocio", negNorm)
      .eq("pro_activo", true)
      .is("pro_eliminado_en", null),
  ]);

  const marca = (cfgNeg?.cfg_nombre_comercial || marcaDefecto).trim();
  const descripcionTienda =
    (cfgNeg?.cfg_eslogan || `Catálogo oficial sincronizado de ${marca}`).trim();

  const mapaCategorias = new Map<string, string>();
  for (const c of Array.isArray(categoriasRows) ? categoriasRows : []) {
    if (c?.ctg_id && c?.ctg_activo !== false) {
      mapaCategorias.set(String(c.ctg_id), String(c.ctg_nombre || ""));
    }
  }

  const itemsFeed: ProductoFeedCatalogoMeta[] = [];

  for (const prod of Array.isArray(productosRows) ? productosRows : []) {
    const detProd = (prod.pro_detalle_producto ?? {}) as Record<string, any>;
    if (!productoVigenteHoy(detProd, prod.pro_activo !== false)) continue;
    if (detProd.sincronizar_meta === false) continue;

    // Si tiene canales_visibilidad explícitos y oculta el ecommerce público, no exponer en anuncios
    if (
      Array.isArray(detProd.canales_visibilidad) &&
      detProd.canales_visibilidad.length > 0 &&
      !detProd.canales_visibilidad.some((c: unknown) =>
        ["WEB", "TIENDA", "ECOMMERCE", "PUBLICO", "META", "WHATSAPP"].includes(
          String(c || "").toUpperCase()
        )
      )
    ) {
      continue;
    }

    const slug = String(prod.pro_slug || prod.pro_id || "").trim();
    if (!slug) continue;

    const imgProd = typeof detProd.imagen_url === "string" ? detProd.imagen_url.trim() : "";
    const galeriaProd: string[] = Array.isArray(detProd.galeria_urls)
      ? detProd.galeria_urls.map((u: unknown) => String(u || "").trim()).filter(Boolean)
      : [];
    const categoriaTexto = prod.pro_categoria_principal_id
      ? mapaCategorias.get(String(prod.pro_categoria_principal_id))
      : undefined;
    const variantes: any[] = Array.isArray(prod.com_variante)
      ? prod.com_variante.filter((v: any) => v && v.var_activo !== false && !v.var_eliminado_en)
      : [];

    for (const v of variantes) {
      const detVar = (v.var_detalle_variante ?? {}) as Record<string, any>;
      const sku = String(v.var_sku || v.var_id || "").trim();
      if (!sku) continue;

      const tarifaIva =
        typeof v.var_tarifa_iva_porcentaje === "number"
          ? v.var_tarifa_iva_porcentaje
          : typeof detProd.tarifa_iva_predeterminada === "number"
            ? detProd.tarifa_iva_predeterminada
            : 0;
      const basePrecio = Number(v.var_precio ?? 0);
      const pvpCalculado =
        typeof detVar.pvp_nominal === "number" && detVar.pvp_nominal > 0
          ? detVar.pvp_nominal
          : Math.round(basePrecio * (1 + tarifaIva / 100) * 100) / 100;

      if (!Number.isFinite(pvpCalculado) || pvpCalculado <= 0) continue;

      const comparacion = Number(v.var_precio_comparacion ?? 0);
      const tieneComparacion = comparacion > pvpCalculado;
      const precioRegularUsd = tieneComparacion ? comparacion : pvpCalculado;
      const precioOfertaUsd = tieneComparacion ? pvpCalculado : null;

      const imgCruda =
        (typeof detVar.portada_url === "string" && detVar.portada_url.trim()) ||
        imgProd ||
        galeriaProd[0] ||
        "";
      const normalizarUrlImg = (u: string) =>
        u.startsWith("/") ? `${urlBase}${u}` : u;
      const imgPrincipal = normalizarUrlImg(imgCruda);
      if (!/^https?:\/\//i.test(imgPrincipal)) continue;

      const galeriaVar: string[] = Array.isArray(detVar.galeria_urls)
        ? detVar.galeria_urls
            .map((u: unknown) => normalizarUrlImg(String(u || "").trim()))
            .filter(Boolean)
        : [];
      const galeriaProdAbs = galeriaProd.map(normalizarUrlImg);

      const nombreVar = String(v.var_nombre || "").trim();
      const nombreProd = String(prod.pro_nombre || "").trim();
      const tituloCompleto =
        nombreVar && nombreVar.toLowerCase() !== nombreProd.toLowerCase() && variantes.length > 1
          ? `${nombreProd} — ${nombreVar}`
          : nombreProd;

      const descripcion =
        (typeof detVar.detalle === "string" && detVar.detalle.trim()) ||
        (typeof prod.pro_descripcion === "string" && prod.pro_descripcion.trim()) ||
        (typeof detProd.descripcion_corta === "string" && detProd.descripcion_corta.trim()) ||
        tituloCompleto;

      itemsFeed.push({
        idVarianteSku: sku,
        idGrupoProducto: slug,
        titulo: tituloCompleto,
        descripcion,
        enlaceProducto: `${urlBase}/producto/${encodeURIComponent(slug)}?variante=${encodeURIComponent(sku)}`,
        imagenPrincipalUrl: imgPrincipal,
        imagenesAdicionalesUrls: [...galeriaVar, ...galeriaProdAbs],
        precioRegularUsd,
        precioOfertaUsd,
        disponibilidad: "in stock",
        marca,
        categoriaTexto,
      });
    }
  }

  const xml = generarXmlCatalogoMeta({
    tituloTienda: `${marca} — Catálogo Oficial`,
    descripcionTienda,
    urlBaseTienda: urlBase,
    items: itemsFeed,
  });

  return { ok: true, xml, totalItems: itemsFeed.length };
}
