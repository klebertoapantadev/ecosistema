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

// La contrasena no esta en esta tabla (vive en Vault), asi que devolver la
// fila entera es seguro: lo mas sensible que sale de aqui es el usuario SMTP,
// y solo lo ve el ADMINISTRADOR del negocio por RLS (cfg_smtp_admin_lectura).
// `smt_secreto_id` se usa unicamente como bandera de "ya hay contrasena".
export async function obtenerSmtpNegocio(negocio: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_configuracion")
    .from("cfg_smtp")
    .select("*")
    .eq("smt_negocio", negocio)
    .maybeSingle();

  return data;
}
