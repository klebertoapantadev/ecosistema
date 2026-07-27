import { crearClienteServidor } from "@/lib/supabase/server";

const NEGOCIO = "tranqi";

export async function obtenerConfiguracionNegocio() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("*")
    .eq("cfg_negocio", NEGOCIO)
    .maybeSingle();

  return data;
}
