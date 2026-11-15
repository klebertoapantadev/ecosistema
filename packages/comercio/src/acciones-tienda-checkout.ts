"use server";

import { revalidatePath } from "next/cache";
import {
  crearConfiguracionTiendaCheckoutPorDefecto,
  normalizarConfiguracionTiendaCheckout,
  type ComprobanteTransferenciaSubido,
  type ConfiguracionTiendaCheckout,
} from "./configuracion-tienda-checkout";

function normalizarClaveNegocioCfg(negocio: string): string {
  const n = (negocio || "tinkay").trim().toLowerCase();
  if (n.includes("tinkay") || n === "tnk") return "tinkay";
  if (n.includes("margarita") || n === "mrg") return "margaritas";
  if (n.includes("fastfix") || n === "ffh") return "fastfix";
  return "tranqi";
}

/**
 * Lee los parámetros configurables de checkout de la tienda (`whatsappTienda`,
 * `montoMaximoPagoSinDatosUsd` [$50 por defecto], cuentas de transferencia y QR DeUna)
 * desde `comun_configuracion.cfg_negocio.cfg_detalle_configuracion.tienda_checkout`.
 */
export async function obtenerConfiguracionTiendaCheckoutAction(
  negocio = "tinkay"
): Promise<ConfiguracionTiendaCheckout> {
  const negNorm = normalizarClaveNegocioCfg(negocio);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      const res = await fetch(
        `${url}/rest/v1/cfg_negocio?cfg_negocio=eq.${encodeURIComponent(
          negNorm
        )}&select=cfg_detalle_configuracion`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Accept-Profile": "comun_configuracion",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(4500),
        }
      );

      if (res.ok) {
        const filas = (await res.json()) as Array<{
          cfg_detalle_configuracion?: Record<string, unknown> | null;
        }>;
        const det = filas?.[0]?.cfg_detalle_configuracion;
        if (det && typeof det === "object") {
          const tiendaCheckout =
            det.tienda_checkout && typeof det.tienda_checkout === "object"
              ? (det.tienda_checkout as Record<string, unknown>)
              : {};
          const combinado: Record<string, unknown> = {
            ...tiendaCheckout,
            ...(typeof det.whatsappTienda === "string" &&
            det.whatsappTienda.trim() &&
            !tiendaCheckout.whatsappTienda
              ? { whatsappTienda: det.whatsappTienda.trim() }
              : {}),
          };
          return normalizarConfiguracionTiendaCheckout(negNorm, combinado);
        }
      }
    } catch {
      // Continuar con respaldo de servidor / valores por defecto
    }
  }

  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negNorm)
      .maybeSingle();

    const det = (data?.cfg_detalle_configuracion ?? null) as Record<
      string,
      unknown
    > | null;
    if (det) {
      const tiendaCheckout =
        det.tienda_checkout && typeof det.tienda_checkout === "object"
          ? (det.tienda_checkout as Record<string, unknown>)
          : {};
      return normalizarConfiguracionTiendaCheckout(negNorm, tiendaCheckout);
    }
  } catch {
    // Retornar configuración pre-configurada por defecto
  }

  return crearConfiguracionTiendaCheckoutPorDefecto(negNorm);
}

/**
 * Guarda los parámetros de checkout rápido, WhatsApp de contacto y cuentas de transferencia / QR DeUna
 * en `comun_configuracion.cfg_negocio.cfg_detalle_configuracion.tienda_checkout` (protegido por RLS `seg_fn_es_admin_negocio`).
 */
export async function guardarConfiguracionTiendaCheckoutAction(
  negocio: string,
  entrada: Partial<ConfiguracionTiendaCheckout>
): Promise<
  | { ok: true; data: ConfiguracionTiendaCheckout }
  | { ok: false; error: string }
> {
  const negNorm = normalizarClaveNegocioCfg(negocio);
  const normalizada = normalizarConfiguracionTiendaCheckout(
    negNorm,
    entrada as unknown as Record<string, unknown>
  );

  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data: actual } = await supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negNorm)
      .maybeSingle();

    const detallePrevio =
      ((actual?.cfg_detalle_configuracion as Record<string, unknown> | null) ??
        {});

    const payloadGuardar: ConfiguracionTiendaCheckout = {
      ...normalizada,
      actualizadoEn: new Date().toISOString(),
    };

    const nuevoDetalle: Record<string, unknown> = {
      ...detallePrevio,
      whatsappTienda: normalizada.whatsappTienda,
      tienda_checkout: payloadGuardar,
    };

    const { error } = await supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: nuevoDetalle as any,
      })
      .eq("cfg_negocio", negNorm);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/panel/pasarelas");
    revalidatePath("/panel/configuracion");
    return { ok: true, data: payloadGuardar };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "No se pudo guardar la configuración de checkout.",
    };
  }
}

/**
 * Sube un comprobante de transferencia o pago QR DeUna (imagen JPG/PNG/WebP o archivo PDF)
 * tanto para compradores registrados como invitados. Almacena en Supabase Storage
 * (`comun-publico` / `catalogo`) bajo `{negocio}/comprobantes-transferencia/{YYYY-MM}/...`
 * y aplica respaldo resiliente en Data URL si el entorno remoto aún no aplicó la política Storage.
 */
export async function subirComprobanteTransferenciaAction(
  formData: FormData
): Promise<
  | {
      ok: true;
      comprobante: ComprobanteTransferenciaSubido;
    }
  | { ok: false; error: string }
> {
  try {
    const file =
      (formData.get("archivo") as File | null) ??
      (formData.get("file") as File | null);
    const negocioRaw = String(formData.get("negocio") || "tinkay");
    const negNorm = normalizarClaveNegocioCfg(negocioRaw);

    if (!file || file.size === 0) {
      return {
        ok: false,
        error: "Selecciona una imagen o archivo PDF del comprobante de pago.",
      };
    }

    const mime = (file.type || "").toLowerCase();
    const nombreLower = (file.name || "comprobante").toLowerCase();
    const esPdf = mime === "application/pdf" || nombreLower.endsWith(".pdf");
    const esImagen =
      mime.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|heic)$/i.test(nombreLower);

    if (!esImagen && !esPdf) {
      return {
        ok: false,
        error:
          "Formato no admitido. Por favor sube una imagen (JPG, PNG, WebP) o un documento PDF.",
      };
    }

    const maxBytes = 6 * 1024 * 1024; // 6 MB
    if (file.size > maxBytes) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      return {
        ok: false,
        error: `El archivo supera el límite de 6 MB (${mb} MB). Sube una captura o PDF más liviano.`,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = esPdf ? "application/pdf" : mime || "image/jpeg";
    const ext = esPdf
      ? "pdf"
      : (nombreLower.split(".").pop() || "jpg").replace(/[^a-z0-9]/g, "") ||
        "jpg";
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase()
      .slice(0, 36);
    const ahora = new Date();
    const periodo = `${ahora.getUTCFullYear()}-${String(
      ahora.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    const sufijo = Math.random().toString(36).slice(2, 8);
    const rutaArchivo = `${negNorm}/comprobantes-transferencia/${periodo}/${Date.now()}-${sufijo}-${
      baseName || "comprobante"
    }.${ext}`;

    const { crearClienteAdmin, crearClienteServidor } = await import(
      "@eco/supabase/servidor"
    );
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteStorage = admin || supabase;

    if (clienteStorage?.storage) {
      for (const bucketName of ["comun-publico", "catalogo"]) {
        try {
          const { error: errUp } = await clienteStorage.storage
            .from(bucketName)
            .upload(rutaArchivo, buffer, {
              contentType,
              upsert: false,
            });
          if (!errUp) {
            const { data: pub } = clienteStorage.storage
              .from(bucketName)
              .getPublicUrl(rutaArchivo);
            if (pub?.publicUrl) {
              return {
                ok: true,
                comprobante: {
                  url: pub.publicUrl,
                  nombreArchivo: file.name,
                  mimeType: contentType,
                  tamanoBytes: file.size,
                  subidoEn: ahora.toISOString(),
                },
              };
            }
          }
        } catch {
          // Intentar siguiente bucket o respaldo Data URL
        }
      }
    }

    const maxInlineBytes = 4.5 * 1024 * 1024;
    if (file.size <= maxInlineBytes) {
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      return {
        ok: true,
        comprobante: {
          url: dataUrl,
          nombreArchivo: file.name,
          mimeType: contentType,
          tamanoBytes: file.size,
          subidoEn: ahora.toISOString(),
        },
      };
    }

    return {
      ok: false,
      error:
        "No fue posible almacenar el archivo grande en este momento. Comprime la imagen o PDF a menos de 4.5 MB e intenta nuevamente.",
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Error al procesar el archivo de comprobante.",
    };
  }
}
