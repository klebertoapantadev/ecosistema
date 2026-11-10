import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { generarContenidoIcsCita } from "../../../../modulos/agenda/calendario-ics";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const citaId = searchParams.get("cita_id") || "";
  const seqParam = Number(searchParams.get("seq") || "0");
  const metodoParam = searchParams.get("method") === "CANCEL" ? "CANCEL" : "REQUEST";

  if (!citaId) {
    return NextResponse.json({ error: "cita_id requerido" }, { status: 400 });
  }

  try {
    const supabase = await crearClienteServidor();
    const db = crearClienteAdmin() ?? supabase;

    const { data: cita } = await db
      .schema("tranqui_legal")
      .from("trq_cita")
      .select(
        "cit_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_enlace, cit_lugar, cit_asignacion",
      )
      .eq("cit_id", citaId)
      .maybeSingle();

    if (!cita) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    let clienteNombre = "Cliente Tranqi";
    let clienteCorreo: string | null = null;
    let clienteWhatsapp: string | null = null;
    if (cita.cit_cliente_id) {
      const { data: uCli } = await db
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario")
        .eq("usu_id", cita.cit_cliente_id)
        .maybeSingle();
      if (uCli) {
        clienteNombre =
          [uCli.usu_nombres, uCli.usu_apellidos].filter(Boolean).join(" ").trim() ||
          uCli.usu_correo ||
          clienteNombre;
        clienteCorreo = uCli.usu_correo ?? null;
        const det = (uCli.usu_detalle_usuario ?? {}) as Record<string, unknown>;
        clienteWhatsapp =
          uCli.usu_whatsapp ||
          (typeof det.whatsapp === "string" ? det.whatsapp : null) ||
          (typeof det.celular === "string" ? det.celular : null) ||
          (typeof det.telefono === "string" ? det.telefono : null);
      }
    }

    let abogadoNombre: string | null = null;
    let abogadoCorreo: string | null = null;
    if (cita.cit_abogado_id && cita.cit_asignacion !== "contingencia") {
      const { data: abg } = await db
        .schema("tranqui_legal")
        .from("trq_abogado")
        .select("abg_usuario_id")
        .eq("abg_id", cita.cit_abogado_id)
        .maybeSingle();
      if (abg?.abg_usuario_id) {
        const { data: uAbg } = await db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_nombres, usu_apellidos, usu_correo")
          .eq("usu_id", abg.abg_usuario_id)
          .maybeSingle();
        if (uAbg) {
          abogadoNombre =
            [uAbg.usu_nombres, uAbg.usu_apellidos].filter(Boolean).join(" ").trim() ||
            uAbg.usu_correo ||
            "Abogado Tranqi";
          abogadoCorreo = uAbg.usu_correo ?? null;
        }
      }
    }

    const ics = generarContenidoIcsCita({
      citaId: String(cita.cit_id),
      inicioIso: String(cita.cit_inicio_en),
      finIso: cita.cit_fin_en ? String(cita.cit_fin_en) : null,
      modalidad: String(cita.cit_modalidad ?? "virtual"),
      motivo: cita.cit_motivo ? String(cita.cit_motivo) : null,
      clienteNombre,
      clienteCorreo,
      clienteWhatsapp,
      abogadoNombre,
      abogadoCorreo,
      enlaceVideollamada: cita.cit_enlace ? String(cita.cit_enlace) : null,
      lugarPresencial: cita.cit_lugar ? String(cita.cit_lugar) : null,
      sequence: Number.isFinite(seqParam) ? seqParam : 0,
      metodo: cita.cit_estado === "cancelada" ? "CANCEL" : metodoParam,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": `text/calendar; charset=utf-8; method=${
          cita.cit_estado === "cancelada" ? "CANCEL" : metodoParam
        }`,
        "Content-Disposition": `attachment; filename="cita-tranqi-${citaId.slice(0, 8)}.ics"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el archivo de calendario" }, { status: 500 });
  }
}

