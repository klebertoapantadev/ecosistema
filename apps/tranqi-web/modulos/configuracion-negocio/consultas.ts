import { crearClienteServidor } from "@eco/supabase/servidor";

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
