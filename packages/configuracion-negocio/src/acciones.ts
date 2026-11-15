"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@eco/db";
import { esquemaConfiguracionNegocio, type DatosConfiguracionNegocio } from "./esquema";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function actualizarConfiguracionNegocio(
  datos: DatosConfiguracionNegocio,
  negocio: string,
): Promise<Resultado> {
  const parseo = esquemaConfiguracionNegocio.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();

  const { data: actual } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("cfg_detalle_configuracion")
    .eq("cfg_negocio", negocio)
    .maybeSingle();

  const previo = ((actual?.cfg_detalle_configuracion as Record<string, Json | undefined> | null) ?? {});
  const tiendaCheckoutPrev =
    previo.tienda_checkout && typeof previo.tienda_checkout === "object" && !Array.isArray(previo.tienda_checkout)
      ? (previo.tienda_checkout as Record<string, Json | undefined>)
      : {};
  const whatsappLimpio = (parseo.data.whatsappTienda || "").trim();
  const whatsappPrevio =
    typeof previo.whatsappTienda === "string" ? previo.whatsappTienda : null;

  const detalle: Record<string, Json | undefined> = {
    ...previo,
    correoNotificaciones: parseo.data.correoNotificaciones || null,
    whatsappTienda: whatsappLimpio || whatsappPrevio,
    ...(whatsappLimpio
      ? {
          tienda_checkout: {
            ...tiendaCheckoutPrev,
            whatsappTienda: whatsappLimpio,
          },
        }
      : {}),
  };

  const { error } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .update({
      cfg_identificacion: parseo.data.identificacion || null,
      cfg_nombre_comercial: parseo.data.nombreComercial,
      cfg_razon_social: parseo.data.razonSocial || null,
      cfg_detalle_configuracion: detalle,
    })
    .eq("cfg_negocio", negocio);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}
