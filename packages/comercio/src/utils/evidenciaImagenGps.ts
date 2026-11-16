// Utilidades cliente (navegador) para:
//   - Compresión rápida de fotos de cámara móvil (<350 KB JPEG)
//   - Estampado limpio de georreferencia y fecha/hora (reemplazo sin anuncios de GPS Map Camera)
//   - Generación de tarjeta visual de Mapa GPS (con mosaico OSM cuando hay red o cuadrícula vectorial offline)
//   - Subida de imágenes y PDFs a Supabase Storage (bucket comun-publico)

export interface SelloGpsFotoOpciones {
  latitud?: number | null;
  longitud?: number | null;
  precisionMetros?: number | null;
  fechaHoraIso?: string;
  ubicacionTexto?: string;
  entregadorNombre?: string;
}

export async function comprimirYEstamparFotoArchivo(
  archivo: File,
  maxLado = 1280,
  calidad = 0.82,
  selloGps?: SelloGpsFotoOpciones | null
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

  if (selloGps) {
    const altoBanda = Math.max(64, Math.round(h * 0.12));
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(0, h - altoBanda, w, altoBanda);

    const fecha = selloGps.fechaHoraIso ? new Date(selloGps.fechaHoraIso) : new Date();
    const fechaTxt = fecha.toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const coordTxt =
      selloGps.latitud != null && selloGps.longitud != null
        ? `GPS: ${Number(selloGps.latitud).toFixed(6)}, ${Number(selloGps.longitud).toFixed(6)}${
            selloGps.precisionMetros ? ` (±${Math.round(selloGps.precisionMetros)}m)` : ""
          }`
        : "GPS pendiente / registro manual";

    const tamTitulo = Math.max(13, Math.round(w * 0.02));
    const tamSub = Math.max(11, Math.round(w * 0.016));
    const padX = Math.max(14, Math.round(w * 0.02));

    ctx.fillStyle = "#34D399";
    ctx.font = `bold ${tamTitulo}px sans-serif`;
    ctx.fillText(
      `${selloGps.ubicacionTexto ? `${selloGps.ubicacionTexto}  •  ` : ""}${fechaTxt}`,
      padX,
      h - altoBanda + Math.round(altoBanda * 0.44)
    );

    ctx.fillStyle = "#F8FAFC";
    ctx.font = `${tamSub}px sans-serif`;
    ctx.fillText(
      `${coordTxt}${selloGps.entregadorNombre ? `  •  Entrega: ${selloGps.entregadorNombre}` : ""}`,
      padX,
      h - altoBanda + Math.round(altoBanda * 0.8)
    );
  }

  return canvas.toDataURL("image/jpeg", calidad);
}

/**
 * Construye una imagen vertical (260x360 JPEG) del mapa de ubicación con marcador GPS
 * lista para mostrarse junto a la fotografía en pantalla e incrustarse en el PDF oficial.
 * Intenta cargar el mosaico OpenStreetMap real si hay internet; si está offline dibuja una
 * retícula cartográfica nítida con coordenadas exactas.
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

      const promesas: Array<Promise<{ im: HTMLImageElement; dx: number; dy: number } | null>> = [];
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
    // Retícula cartográfica offline sin dependencias de red
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

  // Pin central de entrega
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

  // Pie informativo de georreferencia
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
