"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaConfiguracionNegocio, type DatosConfiguracionNegocio } from "./esquema";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const NEGOCIO = "tranqi";

// Escritura simple guardada por RLS (cfg_negocio_admin_escritura exige
// seg_fn_es_admin_negocio) -- no es una transicion de estado irreversible
// como aprobar/pagar, no necesita RPC dedicado.
export async function actualizarConfiguracionNegocio(datos: DatosConfiguracionNegocio): Promise<Resultado> {
  const parseo = esquemaConfiguracionNegocio.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .update({
      cfg_identificacion: parseo.data.identificacion || null,
      cfg_nombre_comercial: parseo.data.nombreComercial,
      cfg_razon_social: parseo.data.razonSocial || null,
    })
    .eq("cfg_negocio", NEGOCIO);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}
