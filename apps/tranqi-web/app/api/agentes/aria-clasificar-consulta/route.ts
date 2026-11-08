import { NextResponse } from "next/server";
import { crearClienteServidor } from "@eco/supabase/servidor";
import {
  clasificarProblemaLegalConAria,
  type MensajeTriajeAria,
} from "@/modulos/agenda/clasificador-aria";
import {
  listarMateriasAgendables,
  obtenerConfiguracionAgendaNegocio,
} from "@/modulos/agenda/consultas";

export async function POST(req: Request) {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Sesión requerida" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      mensajes?: MensajeTriajeAria[];
    };

    const mensajes = Array.isArray(body.mensajes) ? body.mensajes : [];
    if (mensajes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Describe brevemente tu problema para que ARIA pueda ayudarte." },
        { status: 400 },
      );
    }

    const [materias, config] = await Promise.all([
      listarMateriasAgendables(),
      obtenerConfiguracionAgendaNegocio(),
    ]);

    const resultado = await clasificarProblemaLegalConAria(
      mensajes,
      materias,
      config.materia_defecto_nombre || "Civil",
    );

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error al clasificar la consulta con ARIA",
      },
      { status: 500 },
    );
  }
}

