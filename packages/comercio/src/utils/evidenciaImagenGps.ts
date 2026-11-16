// Utilidades cliente (navegador) para:
//   - Compresión rápida de fotos de cámara móvil (<420 KB JPEG)
//   - Geocodificación inversa ligera (calle, sector, ciudad, provincia)
//   - Estampado estilo GPS Map Camera sin publicidad: miniatura de mapa satelital/callejero
//     incrustada abajo a la izquierda + tarjeta oscura con dirección, coordenadas, fecha/hora GMT-05:00 y Sala
//   - Compartir la imagen georreferenciada directamente por WhatsApp (Web Share API Level 2 con archivo .jpg)
//   - Generación de tarjeta auxiliar de Mapa GPS para el PDF IESS y subida a Supabase Storage

export interface DireccionGpsResuelta {
  tituloCiudad: string;
  direccionCompleta: string;
}

export interface SelloGpsFotoOpciones {
  latitud?: number | null;
  longitud?: number | null;
  precisionMetros?: number | null;
  fechaHoraIso?: string;
  tituloCiudad?: string;
  direccionGps?: string;
  ubicacionTexto?: string;
  salaTexto?: string;
  servicioTexto?: string;
  entregadorNombre?: string;
}

function dibujarRectanguloRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

function dibujarBanderaEcuador(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number
) {
  ctx.save();
  dibujarRectanguloRedondeado(ctx, x, y, ancho, alto, 3);
  ctx.clip();

  // Amarillo (50% superior), Azul (25%), Rojo (25%)
  ctx.fillStyle = "#FACC15";
  ctx.fillRect(x, y, ancho, alto * 0.5);
  ctx.fillStyle = "#1D4ED8";
  ctx.fillRect(x, y + alto * 0.5, ancho, alto * 0.25);
  ctx.fillStyle = "#DC2626";
  ctx.fillRect(x, y + alto * 0.75, ancho, alto * 0.25);

  ctx.restore();
  ctx.save();
  dibujarRectanguloRedondeado(ctx, x, y, ancho, alto, 3);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function partirTextoEnLineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMax: number,
  maxLineas: number
): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const lineas: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= anchoMax || !actual) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas - 1) {
        // Concatenar resto y truncar con puntos suspensivos si excede
        const idxRestante = palabras.indexOf(palabra);
        let resto = palabras.slice(idxRestante).join(" ");
        while (resto.length > 4 && ctx.measureText(`${resto}…`).width > anchoMax) {
          resto = resto.slice(0, -2).trimEnd();
        }
        lineas.push(resto.length < palabras.slice(idxRestante).join(" ").length ? `${resto}…` : resto);
        return lineas;
      }
    }
  }
  if (actual && lineas.length < maxLineas) {
    lineas.push(actual);
  }
  return lineas;
}

function formatearFechaEstiloCamaraGps(iso?: string): string {
  const fecha = iso ? new Date(iso) : new Date();
  const diasEs = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(fecha);

    const mapa: Record<string, string> = {};
    for (const p of partes) mapa[p.type] = p.value;
    const idxDia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(mapa.weekday || "");
    const diaTexto = idxDia >= 0 ? diasEs[idxDia] : "Día";
    const ampm = (mapa.dayPeriod || "AM").toUpperCase();
    return `${diaTexto}, ${mapa.day}/${mapa.month}/${mapa.year} ${mapa.hour}:${mapa.minute} ${ampm} GMT -05:00`;
  } catch {
    return `${fecha.toLocaleDateString("es-EC")} ${fecha.toLocaleTimeString("es-EC")} GMT -05:00`;
  }
}

/**
 * Resuelve calle, barrio, ciudad y provincia a partir de coordenadas GPS cuando hay red.
 * Si el teléfono está offline o tarda más de 2.8s, retorna un respaldo inmediato sin bloquear.
 */
export async function obtenerDireccionLegibleGps(
  lat: number,
  lng: number
): Promise<DireccionGpsResuelta> {
  const respaldo: DireccionGpsResuelta = {
    tituloCiudad: "Quito, Pichincha, Ecuador",
    direccionCompleta: "Quito, Pichincha, Ecuador",
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return respaldo;
  }

  try {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? window.setTimeout(() => ctrl.abort(), 2800) : null;
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1&accept-language=es`,
      {
        signal: ctrl?.signal,
      }
    );
    if (timer) window.clearTimeout(timer);
    if (!resp.ok) return respaldo;

    const json = (await resp.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const addr = json.address || {};
    const ciudad =
      addr.city || addr.town || addr.municipality || addr.county || "Quito";
    const provincia = addr.state || addr.region || "Pichincha";
    const pais = addr.country || "Ecuador";
    const tituloCiudad = [ciudad, provincia, pais].filter(Boolean).join(", ");

    const via = [addr.road || addr.pedestrian || "", addr.house_number || ""]
      .filter(Boolean)
      .join(" ")
      .trim();
    const barrio = addr.suburb || addr.neighbourhood || addr.quarter || "";
    const postal = addr.postcode || "";

    const partesDir = [
      via,
      barrio,
      [postal, ciudad].filter(Boolean).join(" ").trim(),
      provincia,
      pais,
    ].filter(Boolean);

    const direccionCompleta =
      partesDir.length >= 2
        ? partesDir.join(", ")
        : json.display_name || tituloCiudad;

    return {
      tituloCiudad: tituloCiudad || respaldo.tituloCiudad,
      direccionCompleta: direccionCompleta || respaldo.direccionCompleta,
    };
  } catch {
    return respaldo;
  }
}

async function dibujarMiniMapaEnRectangulo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lado: number,
  lat?: number | null,
  lng?: number | null
) {
  ctx.save();
  dibujarRectanguloRedondeado(ctx, x, y, lado, lado, Math.max(8, Math.round(lado * 0.08)));
  ctx.clip();

  ctx.fillStyle = "#1E293B";
  ctx.fillRect(x, y, lado, lado);

  let mosaicoDibujado = false;
  if (
    lat != null &&
    lng != null &&
    (typeof navigator === "undefined" || navigator.onLine !== false)
  ) {
    try {
      const zoom = 17;
      const n = Math.pow(2, zoom);
      const xFloat = ((lng + 180) / 360) * n;
      const latRad = (lat * Math.PI) / 180;
      const yFloat =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
      const tileX = Math.floor(xFloat);
      const tileY = Math.floor(yFloat);
      const offsetPxX = Math.round((xFloat - tileX) * 256);
      const offsetPxY = Math.round((yFloat - tileY) * 256);

      const cargarTilePreferido = (tx: number, ty: number) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          const timer = window.setTimeout(() => reject(new Error("timeout")), 2200);
          im.onload = () => {
            window.clearTimeout(timer);
            resolve(im);
          };
          im.onerror = () => {
            // Respaldo a mosaico callejero OSM si el satelital falla
            const im2 = new Image();
            im2.crossOrigin = "anonymous";
            im2.onload = () => {
              window.clearTimeout(timer);
              resolve(im2);
            };
            im2.onerror = () => {
              window.clearTimeout(timer);
              reject(new Error("tile error"));
            };
            im2.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
          };
          // Mosaico satelital Esri World Imagery (idéntico al recuadro satelital de cámara GPS)
          im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
        });

      const centroX = x + Math.round(lado / 2);
      const centroY = y + Math.round(lado / 2);

      const promesas: Array<
        Promise<{ im: HTMLImageElement; dx: number; dy: number } | null>
      > = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          promesas.push(
            cargarTilePreferido(tileX + dx, tileY + dy)
              .then((im) => ({
                im,
                dx: centroX - offsetPxX + dx * 256,
                dy: centroY - offsetPxY + dy * 256,
              }))
              .catch(() => null)
          );
        }
      }

      const tiles = await Promise.all(promesas);
      for (const t of tiles) {
        if (t) {
          ctx.drawImage(t.im, t.dx, t.dy, 256, 256);
          mosaicoDibujado = true;
        }
      }
    } catch {
      mosaicoDibujado = false;
    }
  }

  if (!mosaicoDibujado) {
    // Cuadrícula cartográfica offline elegante
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(x, y, lado, lado);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.24)";
    ctx.lineWidth = 1;
    const paso = Math.max(16, Math.round(lado / 6));
    for (let gx = x + paso; gx < x + lado; gx += paso) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + lado);
      ctx.stroke();
    }
    for (let gy = y + paso; gy < y + lado; gy += paso) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + lado, gy);
      ctx.stroke();
    }
  }

  // Pin rojo central de ubicación
  const pinX = x + Math.round(lado / 2);
  const pinY = y + Math.round(lado / 2);
  const escalaPin = Math.max(0.75, lado / 150);

  ctx.beginPath();
  ctx.arc(pinX, pinY, Math.round(18 * escalaPin), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(220, 38, 38, 0.28)";
  ctx.fill();

  const rCabeza = Math.round(9 * escalaPin);
  const offsetCabezaY = Math.round(10 * escalaPin);

  ctx.beginPath();
  ctx.moveTo(pinX - Math.round(6 * escalaPin), pinY - Math.round(5 * escalaPin));
  ctx.lineTo(pinX + Math.round(6 * escalaPin), pinY - Math.round(5 * escalaPin));
  ctx.lineTo(pinX, pinY + Math.round(6 * escalaPin));
  ctx.closePath();
  ctx.fillStyle = "#DC2626";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pinX, pinY - offsetCabezaY, rCabeza, 0, Math.PI * 2);
  ctx.fillStyle = "#EF4444";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * escalaPin);
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pinX, pinY - offsetCabezaY, Math.max(2.5, Math.round(3.5 * escalaPin)), 0, Math.PI * 2);
  ctx.fillStyle = "#7F1D1D";
  ctx.fill();

  // Etiqueta inferior discreta dentro del mini-mapa
  const tamMarcaMapa = Math.max(9, Math.round(lado * 0.11));
  ctx.font = `bold ${tamMarcaMapa}px sans-serif`;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText("GPS", x + 9, y + lado - 7);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("GPS", x + 8, y + lado - 8);

  ctx.restore();

  // Borde exterior suave del mini-mapa
  ctx.save();
  dibujarRectanguloRedondeado(ctx, x, y, lado, lado, Math.max(8, Math.round(lado * 0.08)));
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Lee y comprime la fotografía base sin marca de agua para poder re-estamparla al instante
 * si el repartidor cambia el número de Sala o la Descripción del Servicio.
 */
export async function leerYComprimirFotoBase(
  archivo: File,
  maxLado = 1360,
  calidad = 0.86
): Promise<string> {
  const dataUrlOriginal = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
    reader.readAsDataURL(archivo);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Formato de imagen no soportado"));
    el.src = dataUrlOriginal;
  });

  const escala = Math.min(1, maxLado / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrlOriginal;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", calidad);
}

/**
 * Estampa sobre una imagen base (dataURL) la tarjeta completa de georreferencia al estilo
 * cámara GPS profesional: miniatura satelital/callejera a la izquierda + bloque oscuro con
 * ciudad/bandera EC, dirección, coordenadas Lat/Long, fecha GMT-05:00 y Sala/Servicio.
 */
export async function estamparDataUrlConTarjetaGps(
  fotoBaseDataUrl: string,
  selloGps?: SelloGpsFotoOpciones | null,
  calidad = 0.86
): Promise<string> {
  if (!selloGps) return fotoBaseDataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("No se pudo cargar la imagen base"));
    el.src = fotoBaseDataUrl;
  });

  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fotoBaseDataUrl;

  ctx.drawImage(img, 0, 0, w, h);

  // Dimensiones proporcionales (adaptables a fotos verticales 3:4 y horizontales 4:3)
  const margen = Math.max(14, Math.round(Math.min(w, h) * 0.026));
  const separacion = Math.max(10, Math.round(w * 0.014));
  const altoBloque = Math.max(138, Math.min(240, Math.round(Math.min(w, h) * 0.23)));
  const ladoMapa = altoBloque;
  const xMapa = margen;
  const yBloque = h - margen - altoBloque;
  const xTarjeta = xMapa + ladoMapa + separacion;
  const anchoTarjeta = Math.max(180, w - xTarjeta - margen);
  const radioTarjeta = Math.max(10, Math.round(altoBloque * 0.08));

  // 1. Miniatura de mapa satelital/callejero con pin a la izquierda
  await dibujarMiniMapaEnRectangulo(
    ctx,
    xMapa,
    yBloque,
    ladoMapa,
    selloGps.latitud,
    selloGps.longitud
  );

  // 2. Píldora superior derecha de autenticidad ("Tinkay GPS" sin anuncios externos)
  const altoBadge = Math.max(22, Math.round(altoBloque * 0.15));
  const tamFontBadge = Math.max(10, Math.round(altoBadge * 0.5));
  ctx.font = `600 ${tamFontBadge}px sans-serif`;
  const textoBadge = "Tinkay GPS Verificado";
  const anchoBadge = Math.round(ctx.measureText(textoBadge).width + altoBadge * 1.3);
  const xBadge = xTarjeta + anchoTarjeta - anchoBadge;
  const yBadge = Math.max(margen, yBloque - altoBadge - 5);

  ctx.save();
  dibujarRectanguloRedondeado(ctx, xBadge, yBadge, anchoBadge, altoBadge, 6);
  ctx.fillStyle = "rgba(15, 20, 28, 0.82)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(xBadge + Math.round(altoBadge * 0.48), yBadge + Math.round(altoBadge / 2), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#34D399";
  ctx.fill();
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(
    textoBadge,
    xBadge + Math.round(altoBadge * 0.82),
    yBadge + Math.round(altoBadge * 0.68)
  );
  ctx.restore();

  // 3. Tarjeta principal translúcida derecha
  ctx.save();
  dibujarRectanguloRedondeado(ctx, xTarjeta, yBloque, anchoTarjeta, altoBloque, radioTarjeta);
  ctx.fillStyle = "rgba(15, 20, 28, 0.77)";
  ctx.fill();
  ctx.restore();

  const padX = Math.max(12, Math.round(anchoTarjeta * 0.035));
  const anchoTextoMax = anchoTarjeta - padX * 2;
  const tamTitulo = Math.max(15, Math.round(altoBloque * 0.155));
  const tamDetalle = Math.max(11, Math.round(altoBloque * 0.098));
  const saltoLinea = Math.round(tamDetalle * 1.36);

  let cursorY = yBloque + Math.round(altoBloque * 0.21);

  // Línea 1: Ciudad, Provincia, País + Bandera EC
  const tituloCiudad = (selloGps.tituloCiudad || "Quito, Pichincha, Ecuador").trim();
  ctx.font = `bold ${tamTitulo}px sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  const anchoBandera = Math.round(tamTitulo * 1.3);
  const altoBandera = Math.round(tamTitulo * 0.88);
  let tituloAjustado = tituloCiudad;
  while (
    tituloAjustado.length > 6 &&
    ctx.measureText(tituloAjustado).width + anchoBandera + 10 > anchoTextoMax
  ) {
    tituloAjustado = `${tituloAjustado.slice(0, -3).trimEnd()}…`;
  }
  ctx.fillText(tituloAjustado, xTarjeta + padX, cursorY);
  const xBandera = Math.min(
    xTarjeta + anchoTarjeta - padX - anchoBandera,
    xTarjeta + padX + Math.round(ctx.measureText(tituloAjustado).width) + 8
  );
  dibujarBanderaEcuador(
    ctx,
    xBandera,
    cursorY - Math.round(tamTitulo * 0.78),
    anchoBandera,
    altoBandera
  );

  cursorY += Math.round(tamDetalle * 1.48);

  // Líneas 2-3: Dirección completa + Ubicación/Funeraria
  ctx.font = `${tamDetalle}px sans-serif`;
  ctx.fillStyle = "#F1F5F9";
  const dirBase = [selloGps.ubicacionTexto, selloGps.direccionGps]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" — ");
  const lineasDir = partirTextoEnLineas(
    ctx,
    dirBase || "Quito, Pichincha, Ecuador",
    anchoTextoMax,
    2
  );
  for (const lin of lineasDir) {
    ctx.fillText(lin, xTarjeta + padX, cursorY);
    cursorY += saltoLinea;
  }

  // Línea 4: Coordenadas Lat / Long
  const coordLinea =
    selloGps.latitud != null && selloGps.longitud != null
      ? `Lat ${Number(selloGps.latitud).toFixed(6)}° Long ${Number(selloGps.longitud).toFixed(6)}°${
          selloGps.precisionMetros ? ` (±${Math.round(selloGps.precisionMetros)}m)` : ""
        }`
      : "Coordenadas GPS pendientes";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(coordLinea, xTarjeta + padX, cursorY);
  cursorY += saltoLinea;

  // Línea 5: Fecha y Hora GMT-05:00
  const fechaLinea = formatearFechaEstiloCamaraGps(selloGps.fechaHoraIso);
  ctx.fillStyle = "#E2E8F0";
  ctx.fillText(fechaLinea, xTarjeta + padX, cursorY);
  cursorY += saltoLinea;

  // Línea 6: Sala + Servicio + Entregador (si cabe en la altura de la tarjeta)
  if (cursorY <= yBloque + altoBloque - Math.round(tamDetalle * 0.45)) {
    const partesNota = [
      selloGps.salaTexto ? `${selloGps.salaTexto}` : "",
      selloGps.servicioTexto ? `${selloGps.servicioTexto}` : "",
      selloGps.entregadorNombre ? `Entrega: ${selloGps.entregadorNombre}` : "",
    ].filter(Boolean);
    const textoNota =
      partesNota.length > 0
        ? `Detalle : ${partesNota.join(" • ")}`
        : "Detalle : Evidencia georreferenciada Tinkay";
    const [notaAjustada] = partirTextoEnLineas(ctx, textoNota, anchoTextoMax, 1);
    ctx.fillStyle = "#FDE68A";
    ctx.font = `600 ${tamDetalle}px sans-serif`;
    if (notaAjustada) {
      ctx.fillText(notaAjustada, xTarjeta + padX, cursorY);
    }
  }

  return canvas.toDataURL("image/jpeg", calidad);
}

export async function comprimirYEstamparFotoArchivo(
  archivo: File,
  maxLado = 1360,
  calidad = 0.85,
  selloGps?: SelloGpsFotoOpciones | null
): Promise<string> {
  const baseDataUrl = await leerYComprimirFotoBase(archivo, maxLado, calidad);
  if (!selloGps) return baseDataUrl;
  return estamparDataUrlConTarjetaGps(baseDataUrl, selloGps, calidad);
}

/**
 * Comparte directamente el archivo JPEG georreferenciado a WhatsApp (u otra app) mediante
 * Web Share API Level 2 en celulares Android/iOS. En navegadores de escritorio donde no
 * existe compartir archivos nativos, descarga la imagen y abre WhatsApp con el resumen.
 */
export async function compartirImagenEvidenciaWhatsapp(opciones: {
  imagenOrigen: string;
  nombreArchivo?: string;
  textoResumen: string;
  urlPublicaRespaldo?: string | null;
}): Promise<{ ok: boolean; modo: "archivo_nativo" | "whatsapp_enlace" | "cancelado" }> {
  const nombreJpg = (opciones.nombreArchivo || "entrega-tinkay-gps.jpg").replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );

  let blobImagen: Blob | null = null;
  try {
    if (opciones.imagenOrigen.startsWith("data:")) {
      blobImagen = dataUrlABlob(opciones.imagenOrigen);
    } else if (opciones.imagenOrigen.startsWith("http")) {
      const r = await fetch(opciones.imagenOrigen);
      if (r.ok) {
        blobImagen = await r.blob();
      }
    }
  } catch {
    blobImagen = null;
  }

  if (blobImagen && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const archivo = new File([blobImagen], nombreJpg, {
        type: blobImagen.type || "image/jpeg",
      });
      const puedeCompartirArchivo =
        typeof navigator.canShare === "function"
          ? navigator.canShare({ files: [archivo] })
          : false;

      if (puedeCompartirArchivo) {
        await navigator.share({
          files: [archivo],
          title: "Confirmación de Entrega — Tinkay",
          text: opciones.textoResumen,
        });
        return { ok: true, modo: "archivo_nativo" };
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, modo: "cancelado" };
      }
      // Continuar al respaldo si el navegador rechazó compartir archivo
    }
  }

  // Respaldo en PC / navegadores sin soporte de archivos en navigator.share:
  // descargar la imagen georreferenciada lista para adjuntar y abrir WhatsApp con el detalle
  if (blobImagen && typeof document !== "undefined") {
    try {
      const urlLocal = URL.createObjectURL(blobImagen);
      const a = document.createElement("a");
      a.href = urlLocal;
      a.download = nombreJpg;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(urlLocal), 5000);
    } catch {
      // Ignorar fallo de descarga
    }
  }

  if (typeof window !== "undefined") {
    const textoConLink = opciones.urlPublicaRespaldo
      ? `${opciones.textoResumen}\n📷 Foto GPS: ${opciones.urlPublicaRespaldo}`
      : opciones.textoResumen;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(textoConLink)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return { ok: true, modo: "whatsapp_enlace" };
}

/**
 * Construye una imagen vertical (260x360 JPEG) del mapa de ubicación con marcador GPS
 * lista para incrustarse junto a la fotografía en el PDF oficial del IESS.
 */
export async function generarTarjetaMapaGpsDataUrl(
  lat: number,
  lng: number,
  precisionMetros?: number | null,
  etiquetaLugar?: string
): Promise<string> {
  const ancho = 260;
  const alto = 360;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, ancho, alto);

  let mosaicoDibujado = false;
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    try {
      const zoom = 16;
      const n = Math.pow(2, zoom);
      const xFloat = ((lng + 180) / 360) * n;
      const latRad = (lat * Math.PI) / 180;
      const yFloat =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
      const tileX = Math.floor(xFloat);
      const tileY = Math.floor(yFloat);
      const offsetPxX = Math.round((xFloat - tileX) * 256);
      const offsetPxY = Math.round((yFloat - tileY) * 256);

      const cargarTile = (tx: number, ty: number) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          const timer = window.setTimeout(() => reject(new Error("timeout")), 2500);
          im.onload = () => {
            window.clearTimeout(timer);
            resolve(im);
          };
          im.onerror = () => {
            window.clearTimeout(timer);
            reject(new Error("tile error"));
          };
          im.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
        });

      const centroX = Math.round(ancho / 2);
      const centroY = Math.round((alto - 78) / 2);

      const promesas: Array<
        Promise<{ im: HTMLImageElement; dx: number; dy: number } | null>
      > = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          promesas.push(
            cargarTile(tileX + dx, tileY + dy)
              .then((im) => ({
                im,
                dx: centroX - offsetPxX + dx * 256,
                dy: centroY - offsetPxY + dy * 256,
              }))
              .catch(() => null)
          );
        }
      }

      const tiles = await Promise.all(promesas);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, ancho, alto - 78);
      ctx.clip();
      for (const t of tiles) {
        if (t) {
          ctx.drawImage(t.im, t.dx, t.dy, 256, 256);
          mosaicoDibujado = true;
        }
      }
      ctx.restore();
    } catch {
      mosaicoDibujado = false;
    }
  }

  if (!mosaicoDibujado) {
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(0, 0, ancho, alto - 78);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (let x = 20; x < ancho; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, alto - 78);
      ctx.stroke();
    }
    for (let y = 20; y < alto - 78; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ancho, y);
      ctx.stroke();
    }
  }

  const pinX = Math.round(ancho / 2);
  const pinY = Math.round((alto - 78) / 2);

  ctx.beginPath();
  ctx.arc(pinX, pinY, 26, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(220, 38, 38, 0.22)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pinX, pinY - 12, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#DC2626";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pinX - 7, pinY - 6);
  ctx.lineTo(pinX + 7, pinY - 6);
  ctx.lineTo(pinX, pinY + 6);
  ctx.closePath();
  ctx.fillStyle = "#DC2626";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pinX, pinY - 12, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, alto - 78, ancho, 78);

  ctx.fillStyle = "#34D399";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("UBICACIÓN GPS VERIFICADA", 12, alto - 56);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "11px monospace";
  ctx.fillText(`Lat: ${lat.toFixed(6)}`, 12, alto - 38);
  ctx.fillText(`Lng: ${lng.toFixed(6)}`, 12, alto - 23);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "10px sans-serif";
  const pieExtra = precisionMetros
    ? `Precisión ±${Math.round(precisionMetros)} m`
    : etiquetaLugar || "Pichincha, EC";
  ctx.fillText(pieExtra.slice(0, 34), 12, alto - 8);

  return canvas.toDataURL("image/jpeg", 0.86);
}

export function dataUrlABlob(dataUrl: string): Blob {
  const coma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, coma);
  const mime = meta.split(";")[0] || "image/jpeg";
  const b64 = dataUrl.slice(coma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function subirArchivoOperativoStorage(
  supabaseCliente: any,
  carpeta: "inventario-rosas" | "entrega-inmediata" | "evidencias-entregas" | "informes-entregas",
  negocio: string,
  contenido: Blob | Uint8Array,
  extension: "jpg" | "png" | "pdf",
  contentType: string
): Promise<{ ok: true; publicUrl: string; path: string } | { ok: false; error: string }> {
  try {
    const fechaCarpeta = new Date().toISOString().slice(0, 10);
    const idUnico =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ruta = `${carpeta}/${negocio.toLowerCase()}/${fechaCarpeta}/${idUnico}.${extension}`;

    const blobSubida =
      contenido instanceof Blob
        ? contenido
        : new Blob([contenido as unknown as BlobPart], { type: contentType });

    const { error } = await supabaseCliente.storage
      .from("comun-publico")
      .upload(ruta, blobSubida, {
        contentType,
        upsert: true,
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    const { data } = supabaseCliente.storage.from("comun-publico").getPublicUrl(ruta);
    return {
      ok: true,
      publicUrl: String(data?.publicUrl || ""),
      path: ruta,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo subir el archivo al servidor",
    };
  }
}
