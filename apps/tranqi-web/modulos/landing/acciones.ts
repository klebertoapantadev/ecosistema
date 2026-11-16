"use server";

import { crearClienteAdmin } from "@eco/supabase/servidor";
import { enviarCorreo } from "@eco/notificaciones/enviar-correo";
import { esquemaContactoLanding, type ContactoLanding } from "./esquema";

/** Buzón de operaciones de tranqi: el mismo que recibe los contactos de empresa. */
const CORREO_OPERACIONES = "admin.operaciones@tranqi24.com";

const TITULO: Record<ContactoLanding["tipo"], string> = {
  persona: "Persona interesada en la membresía",
  empresa: "Empresa interesada en el plan corporativo",
  abogado: "Abogado interesado en la red",
};

// Solo lo que esta acción usa de PostgREST: el esquema tranqui_legal no está en
// los tipos generados de @eco/db.
type ClienteContacto = {
  schema: (s: "tranqui_legal") => {
    from: (t: "trq_contacto_empresa") => {
      insert: (fila: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

const html = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type ResultadoContacto = { ok: true } | { ok: false; error: string; campo?: string };

/**
 * Recibe el formulario «Escríbenos» de la landing y avisa a operaciones por
 * correo. La empresa queda además registrada en `trq_contacto_empresa`, la
 * misma bandeja que llena `/empresas/contacto`.
 */
export async function enviarContactoLanding(datos: unknown): Promise<ResultadoContacto> {
  const r = esquemaContactoLanding.safeParse(datos);
  if (!r.success) {
    const p = r.error.issues[0];
    return { ok: false, error: p?.message ?? "Revisa los datos del formulario.", campo: p?.path[0]?.toString() };
  }
  const d = r.data;
  // Un robot rellenó el campo oculto: se responde como si nada para no darle pistas.
  if (d.sitio) return { ok: true };

  // Basta con que llegue por una vía: la bandeja de empresas o el correo.
  let registrado = false;
  if (d.tipo === "empresa") {
    const admin = crearClienteAdmin() as unknown as ClienteContacto | null;
    if (admin) {
      const { error } = await admin
        .schema("tranqui_legal")
        .from("trq_contacto_empresa")
        .insert({
          cte_empresa: d.empresa,
          cte_nombre_contacto: d.nombre,
          cte_correo: d.correo,
          cte_telefono: d.telefono,
          cte_mensaje: d.mensaje,
          cte_estado: "PENDIENTE",
          cte_detalles: { origen: "landing_contacto", fecha_solicitud: new Date().toISOString() },
        });
      if (error) console.error("[landing] trq_contacto_empresa:", error.message);
      registrado = !error;
    }
  }

  const filas: Array<[string, string | undefined]> = [
    ["Nombre", d.nombre],
    ["Correo", d.correo],
    ["Teléfono", d.telefono],
    ["Empresa y colaboradores", d.empresa],
    ["Especialidad y ciudad", d.especialidad],
    ["Mensaje", d.mensaje],
  ];
  const cuerpo = filas
    .filter(([, v]) => v)
    .map(([k, v]) => `<p style="margin:0 0 10px"><b>${k}:</b><br>${html(v!).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const envio = await enviarCorreo({
    negocio: "tranqi",
    para: CORREO_OPERACIONES,
    asunto: `[Landing] ${TITULO[d.tipo]}: ${d.nombre}`,
    html: `<div style="font-family:Arial,sans-serif;color:#111"><h2 style="color:#5000BA">${TITULO[d.tipo]}</h2>${cuerpo}<p style="color:#666;font-size:12px">Formulario «Escríbenos» de tranqi24.com</p></div>`,
  });

  if (!envio.ok && !registrado) {
    return { ok: false, error: "No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos a hola@tranqi24.com." };
  }
  return { ok: true };
}
