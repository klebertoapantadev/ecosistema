export async function obtenerConfiguracionNegocio(negocio: string) {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("*")
    .eq("cfg_negocio", negocio)
    .maybeSingle();

  return data;
}

export async function obtenerSmtpNegocio(negocio: string) {
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_smtp")
    .select("*")
    .eq("smt_negocio", negocio)
    .maybeSingle();

  return data;
}
