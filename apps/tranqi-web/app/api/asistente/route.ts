import { NextRequest, NextResponse } from "next/server";
import {
  firmarCapsula,
  invocarAgente,
  resolverAgenteDesdeEntorno,
  type RolAsistente,
} from "@eco/agentes-ia";
import { obtenerMembresia, obtenerPerfilActual } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

// PLT-004 dentro del panel autenticado. Distinto de /api/chat, que sigue
// sirviendo al buddie de la landing publica y NO tiene sesion ni herramientas.
//
// Aqui esta el paso que hace segura toda la cadena: el usuario se resuelve de
// la cookie de sesion, en el servidor, y se firma una capsula con esa identidad.
// El navegador nunca manda quien es, y el modelo nunca lo elige.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Esta ruta encadena varias consultas a Supabase y un turno completo del
// modelo. El limite por defecto del plan es demasiado justo para eso.
export const maxDuration = 60;

/** Prefijo de variables de entorno del agente que corresponde a cada rol. */
const PREFIJO_AGENTE: Record<RolAsistente, string> = {
  CLIENTE: "TRQ_CLIENTE",
  ABOGADO: "TRQ_ABOGADO",
  ADMINISTRADOR: "TRQ_CLIENTE",
};

function rolDe(esSuperadmin: boolean, memRol: string | null | undefined): RolAsistente {
  // Mismo criterio que clasePerfilVisual() en app/panel/layout.tsx: el flag de
  // plataforma manda sobre la membresia. Un superadmin cuya membresia en tranqi
  // es CLIENTE (caso real, lo crea asegurarMembresiaCliente) habla con el
  // asistente de cliente, que es lo coherente con lo que ve en pantalla.
  if (memRol === "ABOGADO") return "ABOGADO";
  if (esSuperadmin || memRol === "ADMINISTRADOR") return "ADMINISTRADOR";
  return "CLIENTE";
}

async function atender(req: NextRequest) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) {
    return NextResponse.json({ error: "Sin sesion", codigo: "sin_sesion" }, { status: 401 });
  }

  const secretoCapsula = process.env.ASISTENTE_CAPSULA_SECRETO;
  if (!secretoCapsula) {
    // Sin capsula el agente hablaria sin poder consultar nada. Se corta aqui en
    // vez de dejarlo responder de memoria sobre datos que no ha leido.
    return NextResponse.json(
      { error: "Falta ASISTENTE_CAPSULA_SECRETO", codigo: "sin_capsula" },
      { status: 503 },
    );
  }

  const membresia = await obtenerMembresia(perfil.usu_id, "tranqi");
  const rol = rolDe(perfil.usu_superadmin_plataforma, membresia?.mem_rol);

  const config = resolverAgenteDesdeEntorno(PREFIJO_AGENTE[rol]);
  if (!config) {
    return NextResponse.json(
      { error: `Sin credenciales del agente (${PREFIJO_AGENTE[rol]})`, codigo: "sin_agente" },
      { status: 503 },
    );
  }

  let prompt: string;
  let conversacionIdEntrante: string | undefined;
  try {
    const cuerpo = await req.json();
    prompt = typeof cuerpo?.prompt === "string" ? cuerpo.prompt.trim() : "";
    conversacionIdEntrante =
      typeof cuerpo?.conversacion_id === "string" ? cuerpo.conversacion_id : undefined;
    if (!prompt) throw new Error("prompt vacio");
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e), codigo: "peticion_invalida" },
      { status: 400 },
    );
  }

  const supabase = await crearClienteServidor();

  // El hilo. Se reutiliza el que manda el navegador SOLO si RLS confirma que es
  // suyo: si no, se abre uno nuevo. Asi un cnv_id copiado de otra sesion no
  // engancha con una conversacion ajena, ni siquiera para escribir en ella.
  let hiloExistente: string | null = null;
  if (conversacionIdEntrante) {
    const { data } = await supabase
      .schema("tranqui_legal")
      .from("trq_conversacion")
      .select("cnv_id")
      .eq("cnv_id", conversacionIdEntrante)
      .is("cnv_eliminado_en", null)
      .maybeSingle();
    if (data) hiloExistente = data.cnv_id;
  }

  let conversacionId: string;
  if (hiloExistente) {
    conversacionId = hiloExistente;
  } else {
    const { data, error } = await supabase
      .schema("tranqui_legal")
      .from("trq_conversacion")
      .insert({
        cnv_usuario_id: perfil.usu_id,
        cnv_rol: rol,
        cnv_agente_slug: config.agentId,
        // Primeras palabras como titulo, para poder listar hilos sin abrirlos.
        cnv_titulo: prompt.slice(0, 80),
      })
      .select("cnv_id")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: `No se pudo abrir la conversacion: ${error?.message ?? "sin datos"}`, codigo: "conversacion" },
        { status: 500 },
      );
    }
    conversacionId = data.cnv_id;
  }

  const { error: errorPregunta } = await supabase
    .schema("tranqui_legal")
    .from("trq_mensaje")
    .insert({ msg_conversacion_id: conversacionId, msg_autor: "usuario", msg_contenido: prompt });
  // No corta el turno —el usuario merece su respuesta aunque el historial
  // falle— pero deja de perderse en silencio.
  if (errorPregunta) console.error("[asistente] no se guardo la pregunta:", errorPregunta.message);

  const capsula = await firmarCapsula(
    { usuarioId: perfil.usu_id, rol, conversacionId },
    secretoCapsula,
  );

  try {
    const respuesta = await invocarAgente(config, prompt, conversacionId, { sesion: capsula });

    // Persistir la respuesta no debe tumbar un turno ya generado (mismo criterio
    // que _persist_run en ARIA): si el insert falla, se responde igual.
    const { error: errorMensaje } = await supabase
      .schema("tranqui_legal")
      .from("trq_mensaje")
      .insert({
        msg_conversacion_id: conversacionId,
        msg_autor: "asistente",
        msg_contenido: respuesta.response,
        msg_run_id: respuesta.runId ?? null,
      });
    if (errorMensaje) console.error("[asistente] no se guardo el mensaje:", errorMensaje.message);

    await supabase
      .schema("tranqui_legal")
      .from("trq_conversacion")
      .update({ cnv_ultimo_mensaje_en: new Date().toISOString() })
      .eq("cnv_id", conversacionId);

    return NextResponse.json({
      response: respuesta.response,
      conversacion_id: conversacionId,
      run_id: respuesta.runId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e), codigo: "aria", conversacion_id: conversacionId },
      { status: 502 },
    );
  }
}

/**
 * Envoltura que garantiza una respuesta JSON con `codigo` pase lo que pase.
 *
 * Sin esto, cualquier excepcion no prevista sale como un 500 opaco de Next; el
 * cliente falla al parsear el cuerpo y el usuario ve "se me cruzaron los
 * cables" para TODO — sesion caducada, variable ausente, permiso de tabla o
 * ARIA caido dan exactamente el mismo mensaje, y en produccion eso es
 * indiagnosticable. El `codigo` es un slug estable, sin datos internos: dice
 * en que paso se rompio sin contarle a nadie como esta hecho por dentro.
 */
export async function POST(req: NextRequest) {
  try {
    return await atender(req);
  } catch (e) {
    console.error("[asistente] excepcion no prevista:", e);
    return NextResponse.json(
      { error: "Error inesperado en el asistente", codigo: "inesperado" },
      { status: 500 },
    );
  }
}
