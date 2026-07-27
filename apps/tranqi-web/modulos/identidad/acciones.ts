"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esquemaRegistro,
  esquemaIngreso,
  esquemaBienvenida,
  type DatosRegistro,
  type DatosIngreso,
  type DatosBienvenida,
} from "./esquema";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function obtenerOrigen() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

const NEGOCIO = "tranqi";

// Rol CLIENTE automatico en Tranqi al registrarse (PLT-003 regla 1). Usa
// upsert con ignoreDuplicates: si ya tenia membresia (ej. re-login), no
// falla ni la pisa -- la politica RLS solo permite insertar como CLIENTE,
// nunca escalar un rol existente desde aqui.
export async function asegurarMembresiaCliente(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  usuarioId: string,
) {
  await supabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .upsert(
      { mem_usuario_id: usuarioId, mem_negocio: NEGOCIO, mem_rol: "CLIENTE" },
      { onConflict: "mem_usuario_id,mem_negocio", ignoreDuplicates: true },
    );
}

type ResultadoRegistro =
  | { ok: true; sesionActiva: boolean }
  | { ok: false; error: string };

// El registro por correo exige confirmar el correo (decision del usuario:
// solo el flujo de correo/contraseña, Google conecta directo porque Google
// ya lo verifico). Sin confirmar, signUp() no crea sesion -- sesionActiva
// le dice al formulario si redirigir al panel o mostrar "revisa tu correo".
// emailRedirectTo apunta al mismo callback que usa OAuth: al confirmar,
// exchangeCodeForSession establece la sesion y la auto-reparacion del
// layout del panel completa la membresia CLIENTE si quedo pendiente.
export async function registrarUsuario(datos: DatosRegistro): Promise<ResultadoRegistro> {
  const parseo = esquemaRegistro.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const origen = await obtenerOrigen();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: parseo.data.correo,
    password: parseo.data.contrasena,
    options: {
      data: {
        given_name: parseo.data.nombres,
        family_name: parseo.data.apellidos,
      },
      emailRedirectTo: `${origen}/auth/callback`,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "No se pudo crear el usuario" };

  const sesionActiva = data.session !== null;
  if (sesionActiva) {
    await asegurarMembresiaCliente(supabase, data.user.id);
  }

  return { ok: true, sesionActiva };
}

export async function iniciarSesion(datos: DatosIngreso): Promise<Resultado> {
  const parseo = esquemaIngreso.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: parseo.data.correo,
    password: parseo.data.contrasena,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// PLT-001 regla 2: confirma identidad (Google no siempre da un nombre claro)
// y guarda la autorizacion de WhatsApp -- opt-in real, nunca se asume.
// Marca usu_onboarding_completo para no repetir esta pantalla.
export async function completarBienvenida(datos: DatosBienvenida): Promise<Resultado> {
  const parseo = esquemaBienvenida.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada" };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .update({
      usu_nombres: parseo.data.nombres,
      usu_apellidos: parseo.data.apellidos,
      usu_whatsapp: parseo.data.autorizaWhatsapp ? parseo.data.whatsapp : null,
      usu_autorizacion_whatsapp: parseo.data.autorizaWhatsapp,
      usu_onboarding_completo: true,
    })
    .eq("usu_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel");
  return { ok: true, data: undefined };
}

export async function cerrarSesion(): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
