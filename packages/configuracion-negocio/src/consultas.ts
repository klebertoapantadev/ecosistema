import { crearClienteServidor } from "@eco/supabase/servidor";

export async function obtenerConfiguracionNegocio(negocio: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("*")
    .eq("cfg_negocio", negocio)
    .maybeSingle();

  return data;
}
