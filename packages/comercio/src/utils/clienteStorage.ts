import { crearClienteNavegador } from "@eco/supabase/cliente";
import { normalizarIdentificadorNegocio } from "./negocio";
import { subirImagenCatalogoAction } from "../acciones";

/**
 * Optimiza y comprime una imagen en el navegador mediante HTML5 Canvas antes de transferirla.
 * - Archivos vectoriales (SVG) o animados (GIF) se mantienen idénticos para no romperlos.
 * - Archivos que ya pesen menos de 400 KB no se tocan.
 * - Fotos pesadas tomadas con smartphones o cámaras (2 MB a 15 MB) se redimensionan proporcionalmente
 *   a un ancho/alto máximo de 1920px y compresión 0.85, reduciendo el peso en ~85% sin pérdida visual perceptible.
 */
export async function optimizarImagenParaWeb(
  file: File,
  maxDimension = 1920,
  calidad = 0.85
): Promise<File | Blob> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return file;
  }

  // Preservar SVG y GIF sin alterar
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  // Si ya es liviana (< 400 KB), subir directamente
  if (file.size < 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Si las dimensiones son pequeñas y pesa menos de 1 MB, no redimensionar
      if (width <= maxDimension && height <= maxDimension && file.size < 1024 * 1024) {
        return resolve(file);
      }

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);

      const tipoDestino = file.type === "image/png" && file.size > 2 * 1024 * 1024 ? "image/webp" : file.type || "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const extension = tipoDestino === "image/webp" ? "webp" : file.name.split(".").pop() || "jpg";
            const nuevoNombre = file.name.replace(/\.[^/.]+$/, `.${extension}`);
            const archivoOpt = new File([blob], nuevoNombre, {
              type: blob.type || tipoDestino,
              lastModified: Date.now(),
            });
            resolve(archivoOpt);
          } else {
            resolve(file);
          }
        },
        tipoDestino,
        calidad
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Sube una imagen de catálogo con estrategia dual:
 * 1. Optimiza la imagen en el cliente (canvas) para máxima velocidad.
 * 2. Intenta subida directa a Supabase Storage (bypassa límites de servidor de Next.js/Vercel).
 * 3. Si falla la subida directa (por RLS o conectividad), usa el Server Action con fallback.
 */
export async function subirImagenClienteOAccion(
  file: File,
  negocioRaw: string,
  carpeta = "portadas"
): Promise<{ ok: boolean; urlPublica?: string; error?: string; nombreArchivo?: string }> {
  try {
    // Validar límite estricto de 5MB por imagen
    const LIMITE_5MB = 5 * 1024 * 1024;
    if (file.size > LIMITE_5MB) {
      const tamanoMb = (file.size / (1024 * 1024)).toFixed(2);
      return {
        ok: false,
        error: `La imagen "${file.name}" supera el tamaño máximo permitido de 5 MB (tamaño actual: ${tamanoMb} MB). Por favor selecciona un archivo menor a 5 MB.`,
      };
    }

    const { principal } = normalizarIdentificadorNegocio(negocioRaw);
    const archivoParaSubir = await optimizarImagenParaWeb(file);

    // Intento 1: Subida directa cliente -> Supabase Storage (CDN)
    try {
      const supabase = crearClienteNavegador();
      const ext = file.name.split(".").pop() || "jpg";
      const nombreLimpio = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .toLowerCase()
        .substring(0, 40);
      const rutaArchivo = `${principal}/${carpeta}/${Date.now()}-${nombreLimpio}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("catalogo")
        .upload(rutaArchivo, archivoParaSubir, {
          contentType: (archivoParaSubir as File).type || file.type || "image/jpeg",
          upsert: true,
        });

      if (!uploadError && uploadData?.path) {
        const { data: pubData } = supabase.storage
          .from("catalogo")
          .getPublicUrl(uploadData.path);

        if (pubData?.publicUrl) {
          return {
            ok: true,
            urlPublica: pubData.publicUrl,
            nombreArchivo: file.name,
          };
        }
      }
    } catch {
      // Continuar con fallback a Server Action
    }

    // Intento 2: Server Action con FormData
    const formData = new FormData();
    formData.append("file", archivoParaSubir as Blob, file.name);
    formData.append("negocio", negocioRaw);
    formData.append("carpeta", carpeta);

    return await subirImagenCatalogoAction(formData);
  } catch (err: any) {
    return {
      ok: false,
      error: `Error al procesar la subida del archivo: ${err.message || err}`,
    };
  }
}
