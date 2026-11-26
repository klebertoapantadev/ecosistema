"use server";

import { revalidatePath } from "next/cache";
import { enviarEventoConversionMetaServidorAction } from "@eco/comercio";
import {
  esquemaMarketingMeta,
  type ConfiguracionMarketingMetaVista,
  type DatosMarketingMeta,
} from "./esquema-marketing-meta";
import { obtenerMarketingMetaNegocio } from "./consultas";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function cargarMarketingMetaAction(
  negocio: string
): Promise<Resultado<ConfiguracionMarketingMetaVista | null>> {
  try {
    const vista = await obtenerMarketingMetaNegocio(negocio);
    return { ok: true, data: vista };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo consultar Marketing & Meta",
    };
  }
}

export async function guardarMarketingMetaAction(
  datos: DatosMarketingMeta,
  negocio: string
): Promise<Resultado> {
  const parseo = esquemaMarketingMeta.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const codigoNegocio = negocio.trim().toLowerCase();
  if (parseo.data.activo && !parseo.data.pixelId) {
    return {
      ok: false,
      error: "Ingresa el Meta Pixel ID antes de activar la sincronización con Meta.",
    };
  }

  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase: any = await crearClienteServidor();
    const esquemaCfg = supabase.schema("comun_configuracion");

    const { error } = await esquemaCfg.rpc("cfg_fn_guardar_marketing_meta", {
      p_negocio: codigoNegocio,
      p_pixel_id: parseo.data.pixelId || null,
      p_dominio_verificacion: parseo.data.dominioVerificacion || null,
      p_test_event_code: parseo.data.testEventCode || null,
      p_catalogo_activo: parseo.data.catalogoActivo,
      p_activo: parseo.data.activo,
      p_capi_token: parseo.data.capiToken || null,
      p_detalle: null,
    });

    if (error) {
      const msg = String(error.message || "");
      const faltaMigracion =
        msg.includes("cfg_fn_guardar_marketing_meta") ||
        msg.toLowerCase().includes("could not find the function");

      // Si aún no se corrió la migración SQL y no viene secreto CAPI, respaldar campos públicos en cfg_negocio
      if (faltaMigracion && !parseo.data.capiToken) {
        const { data: filaNeg } = await esquemaCfg
          .from("cfg_negocio")
          .select("cfg_detalle_configuracion")
          .eq("cfg_negocio", codigoNegocio)
          .maybeSingle();

        const detActual = (filaNeg?.cfg_detalle_configuracion ?? {}) as Record<string, unknown>;
        const { error: errUpd } = await esquemaCfg
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: {
              ...detActual,
              marketing_meta: {
                activo: parseo.data.activo,
                pixel_id: parseo.data.pixelId || null,
                dominio_verificacion: parseo.data.dominioVerificacion || null,
                test_event_code: parseo.data.testEventCode || null,
                catalogo_activo: parseo.data.catalogoActivo,
              },
            },
          })
          .eq("cfg_negocio", codigoNegocio);

        if (errUpd) {
          return { ok: false, error: errUpd.message };
        }
      } else {
        return {
          ok: false,
          error: faltaMigracion
            ? "Ejecuta primero la migración 20261119000008_cfg_marketing_meta_capi_catalogo_y_widget.sql en Supabase para guardar el Token CAPI cifrado en Vault."
            : msg,
        };
      }
    }

    revalidatePath("/");
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/marketing-meta");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar Marketing & Meta",
    };
  }
}

export async function borrarTokenMarketingMetaAction(negocio: string): Promise<Resultado> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase: any = await crearClienteServidor();
    const { error } = await supabase
      .schema("comun_configuracion")
      .rpc("cfg_fn_borrar_marketing_meta_token", {
        p_negocio: negocio.trim().toLowerCase(),
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/marketing-meta");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al revocar el Token CAPI",
    };
  }
}

export async function probarEventoMetaCapiAction(
  negocio: string,
  testEventCodeOpcional?: string
): Promise<Resultado<{ mensaje: string }>> {
  let correoAdmin: string | undefined;
  let usuarioIdAdmin: string | undefined;
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    correoAdmin = user?.email ?? undefined;
    usuarioIdAdmin = user?.id ?? undefined;
  } catch {
    // Continuar con respaldo seguro
  }

  const res = await enviarEventoConversionMetaServidorAction({
    negocio,
    eventName: "ViewContent",
    eventId: `test-capi-${negocio}-${Date.now()}`,
    valorUsd: 60,
    moneda: "USD",
    contentIds: ["TIN-VAR-7"],
    contentName: "Prueba de Integración Meta CAPI",
    comprador: {
      email: correoAdmin || "prueba@tinkay.net",
      usuarioId: usuarioIdAdmin,
    },
    esPrueba: true,
    testEventCodeOverride: testEventCodeOpcional?.trim() || undefined,
  });

  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "No se pudo verificar el envío CAPI hacia Meta.",
    };
  }

  return {
    ok: true,
    data: {
      mensaje:
        "Evento enviado con éxito a Meta Graph API (v21.0). Revisa la pestaña «Probar eventos» en el Administrador de Eventos de Meta.",
    },
  };
}
