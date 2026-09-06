import type { Herramienta } from "@eco/agentes-ia";
import type { ContextoAsistente } from "./contexto";
import { fechaHoraEcuador, lista } from "./formato";
import { esquemaPendiente } from "../agenda/puente-tipos";

// Herramientas de AGENDA del asistente del afiliado (TRQ-ABG-004 / PLT-020).
//
// Sustituyen a la antigua `agendar_cita`, que insertaba en trq_cita sin
// cit_abogado_id: como trq_cita_abogado_select filtra por ese campo, aquellas
// citas eran invisibles para cualquier abogado. Se agendaba contra nadie.
//
// Ahora todo pasa por RPC transaccional: el turno rotativo, el cupo del plan y
// el anti-solape se resuelven juntos o no se resuelve ninguno.
//
// REGLA QUE NO SE ROMPE (ADR-0005 §5): ninguna herramienta acepta identificador
// de usuario. Tampoco hace falta identificar al abogado: con asignacion por
// turno el afiliado pide materia y hora, no persona.

type HerramientaCliente = Herramienta<ContextoAsistente>;

const NEGOCIO = "tranqi";

/** Resuelve el texto que dio el modelo contra el catálogo real de materias. */
async function resolverMateria(
  supabase: ContextoAsistente["supabase"],
  texto: string,
): Promise<{ id: string; nombre: string }> {
  const { data, error } = await esquemaPendiente(supabase, "tranqui_legal")
    .from("trq_materia")
    .select("mat_id, mat_nombre, mat_codigo")
    .eq("mat_activa", true);
  if (error) throw new Error(error.message);

  // Comparacion insensible a tildes y mayusculas sin manosear el texto: el
  // colador de Intl ya sabe que "Transito" y "Transito" con tilde son lo mismo
  // en espanol, y evita depender de un rango de diacriticos escrito a mano.
  const colador = new Intl.Collator("es", { sensitivity: "base", usage: "search" });
  const igual = (a: string | null | undefined, b: string) =>
    typeof a === "string" && colador.compare(a.trim(), b.trim()) === 0;
  const contiene = (a: string, b: string) =>
    a.toLocaleLowerCase("es").includes(b.toLocaleLowerCase("es").trim());

  const materias = (data ?? []) as Array<{ mat_id: string; mat_nombre: string; mat_codigo: string | null }>;
  const fila =
    materias.find((m) => igual(m.mat_codigo, texto)) ??
    materias.find((m) => igual(m.mat_nombre, texto)) ??
    materias.find((m) => contiene(m.mat_nombre, texto) || contiene(texto, m.mat_nombre));

  if (!fila) {
    // El mensaje lo lee el modelo: se le devuelve el catálogo para que
    // reformule con el afiliado en vez de inventarse una materia.
    throw new Error(
      `No reconozco la materia '${texto}'. Las disponibles son: ` +
        `${materias.map((m) => m.mat_nombre).join(", ")}. Pregunta al afiliado cuál encaja.`,
    );
  }
  return { id: fila.mat_id, nombre: fila.mat_nombre };
}

const buscarHorarios: HerramientaCliente = {
  descripcion:
    "Muestra los horarios libres para atender una consulta de una materia legal. " +
    "Devuelve horas, no abogados: la asignacion es por turno rotativo y el " +
    "afiliado no elige profesional. Usala antes de reservar, siempre.",
  esquema: {
    type: "object",
    properties: {
      materia: {
        type: "string",
        description:
          "Materia legal del asunto: Civil, Penal, Laboral, Familia y Niñez, Tránsito, " +
          "Arrendamiento e Inquilinato, Tributario, Migratorio, Societario y Corporativo, " +
          "Propiedad Intelectual, Administrativo o Constitucional. Un divorcio es Familia y Niñez.",
      },
      servicio_sku: {
        type: "string",
        description:
          "SKU del servicio si ya se eligio (p. ej. TRQ-CON-ORI, TRQ-REV-CON). Omitelo para una consulta general.",
      },
      desde: {
        type: "string",
        description: "ISO-8601 con zona horaria. Omitelo para empezar desde ahora.",
      },
      dias: { type: "number", description: "Cuantos dias mirar hacia adelante. Por defecto 14." },
      modalidad: { type: "string", enum: ["virtual", "presencial"] },
    },
    required: ["materia"],
  },
  async ejecutar(argumentos, { supabase }) {
    const { materia, servicio_sku: sku, desde, dias, modalidad } = argumentos;
    if (typeof materia !== "string") throw new Error("Falta la materia.");

    const m = await resolverMateria(supabase, materia);

    const inicio = typeof desde === "string" ? new Date(desde) : new Date();
    if (Number.isNaN(inicio.getTime())) throw new Error(`No entiendo la fecha '${desde}'.`);
    const ventana = typeof dias === "number" && dias > 0 && dias <= 90 ? dias : 14;
    const fin = new Date(inicio.getTime() + ventana * 24 * 60 * 60 * 1000);

    let varianteId: string | null = null;
    if (typeof sku === "string") {
      const { data } = await esquemaPendiente(supabase, "comun_comercio")
        .from("com_variante")
        .select("var_id")
        .eq("var_negocio", NEGOCIO)
        .eq("var_sku", sku)
        .maybeSingle();
      varianteId = data?.var_id ?? null;
    }

    const { data, error } = await esquemaPendiente(supabase, "tranqui_legal").rpc("trq_fn_horarios_materia", {
      p_materia_id: m.id,
      p_desde: inicio.toISOString(),
      p_hasta: fin.toISOString(),
      p_variante_id: varianteId,
      p_modalidad: typeof modalidad === "string" ? modalidad : null,
      p_provincia_id: null,
    });
    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      // Falla informando, no en seco: el modelo necesita saber si ampliar la
      // ventana o si sencillamente no hay nadie cubriendo esa materia.
      throw new Error(
        `No hay horarios libres de ${m.nombre} en los proximos ${ventana} dias. ` +
          `Ofrece mirar mas adelante, o dile al afiliado que deje su consulta y un operador le contacta.`,
      );
    }

    // Máximo 8: el resultado de una herramienta se corta a 16 000 caracteres y
    // una lista larga tampoco ayuda a decidir por chat.
    const horarios = data.slice(0, 8);
    return (
      lista(
        `Horarios libres para ${m.nombre} (hora de Ecuador)`,
        horarios as Array<{ hueco_inicio: string }>,
        "No hay horarios libres.",
        (h) => `- ${fechaHoraEcuador(h.hueco_inicio)}`,
      ) +
      `\n\nElige uno con el afiliado y confirma fecha, hora y como se cubre antes de reservar. ` +
      `Al reservar, pasa la fecha exactamente como aparece aqui.`
    );
  },
};

const miCobertura: HerramientaCliente = {
  descripcion:
    "Dice que le cubre al afiliado su plan este periodo y cuanto le queda. " +
    "Usala ANTES de reservar para poder decirle si la cita entra en su plan o tiene costo.",
  esquema: { type: "object", properties: {} },
  async ejecutar(_argumentos, { supabase }) {
    const { data, error } = await esquemaPendiente(supabase, "comun_comercio")
      .rpc("com_fn_cobertura_usuario", { p_negocio: NEGOCIO });
    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return (
        "El afiliado no tiene ningun plan activo, asi que las consultas se cobran por separado. " +
        "Si pregunta por precios, consultalos con la herramienta de horarios indicando el servicio."
      );
    }

    return lista(
      `Cobertura vigente (${data[0].plan_nombre})`,
      data as Array<{ concepto: string; incluidos: number | null; restantes: number | null }>,
      "Sin cobertura activa.",
      (d) =>
        d.incluidos === null
          ? `- ${d.concepto}: ilimitado`
          : `- ${d.concepto}: le quedan ${d.restantes} de ${d.incluidos} este periodo`,
    );
  },
};

const reservarCita: HerramientaCliente = {
  descripcion:
    "Reserva una cita en un horario concreto de los que devolvio buscar_horarios. " +
    "Antes de llamarla DEBES haberle dicho al afiliado tres cosas y tener su si " +
    "explicito: fecha y hora, que servicio es, y como se cubre (entra en su plan " +
    "o tiene costo). El sistema asigna el abogado por turno rotativo; no lo elige " +
    "ni el afiliado ni tu. La cita queda propuesta hasta que el abogado la confirme.",
  esquema: {
    type: "object",
    properties: {
      materia: { type: "string", description: "La misma materia con la que buscaste horarios." },
      inicio_en: {
        type: "string",
        description: "ISO-8601 con zona horaria, exactamente uno de los horarios que devolvio buscar_horarios.",
      },
      servicio_sku: { type: "string", description: "SKU del servicio elegido. Omitelo si es una consulta de cortesia." },
      modalidad: { type: "string", enum: ["virtual", "presencial"] },
      motivo: { type: "string", description: "Una frase con el motivo, en palabras del afiliado." },
      caso_id: { type: "string", description: "cas_id si la cita es sobre un caso existente." },
    },
    required: ["materia", "inicio_en", "modalidad", "motivo"],
  },
  async ejecutar(argumentos, { supabase }) {
    const { materia, inicio_en: inicioEn, servicio_sku: sku, modalidad, motivo, caso_id: casoId } = argumentos;
    if (typeof materia !== "string") throw new Error("Falta la materia.");
    if (typeof inicioEn !== "string") throw new Error("Falta inicio_en.");
    if (modalidad !== "presencial" && modalidad !== "virtual") {
      throw new Error("modalidad debe ser 'presencial' o 'virtual'.");
    }

    const inicio = new Date(inicioEn);
    if (Number.isNaN(inicio.getTime())) {
      throw new Error(`No entiendo la fecha '${inicioEn}'. Usa ISO-8601 con zona horaria.`);
    }
    if (inicio.getTime() < Date.now()) {
      throw new Error(`Esa fecha ya paso (${inicioEn}). Vuelve a consultar horarios antes de reservar.`);
    }

    const m = await resolverMateria(supabase, materia);

    let varianteId: string | null = null;
    if (typeof sku === "string") {
      const { data } = await esquemaPendiente(supabase, "comun_comercio")
        .from("com_variante")
        .select("var_id")
        .eq("var_negocio", NEGOCIO)
        .eq("var_sku", sku)
        .maybeSingle();
      varianteId = data?.var_id ?? null;
    }

    const { data: citaId, error } = await esquemaPendiente(supabase, "tranqui_legal").rpc("trq_fn_reservar_cita", {
      p_materia_id: m.id,
      p_inicio_en: inicio.toISOString(),
      p_variante_id: varianteId,
      p_modalidad: modalidad,
      p_motivo: typeof motivo === "string" ? motivo : null,
      p_caso_id: typeof casoId === "string" ? casoId : null,
      p_provincia_id: null,
      p_origen: "asistente",
    });
    // El RPC devuelve mensajes escritos para que los leas y actues: si dice que
    // el horario acaba de ocuparse, vuelve a consultar y ofrece otros.
    if (error) throw new Error(error.message);

    const { data: cita } = await esquemaPendiente(supabase, "tranqui_legal")
      .from("trq_cita")
      .select("cit_inicio_en, cit_modalidad, cit_cobertura")
      .eq("cit_id", citaId)
      .maybeSingle();

    const cobertura =
      cita?.cit_cobertura === "plan"
        ? "Entra en su plan: no se le cobra."
        : cita?.cit_cobertura === "cortesia"
          ? "Es una consulta de cortesia, sin costo."
          : "Queda pendiente de pago; el afiliado recibira el enlace para completarlo.";

    return (
      `Cita reservada para el ${fechaHoraEcuador(cita?.cit_inicio_en ?? inicio.toISOString())} ` +
      `(${cita?.cit_modalidad ?? modalidad}). ${cobertura} ` +
      `Se asigno un abogado de ${m.nombre} por turno y queda pendiente de que la confirme; ` +
      `el afiliado recibira el aviso. Identificador: ${citaId}`
    );
  },
};

const cancelarCita: HerramientaCliente = {
  descripcion:
    "Cancela una cita del afiliado. Pide confirmacion explicita antes de llamarla: " +
    "si la cancela con menos de 24 horas de antelacion y estaba cubierta por su plan, " +
    "pierde esa consulta del periodo. Diselo antes.",
  esquema: {
    type: "object",
    properties: {
      cita_id: { type: "string", description: "cit_id de la cita, de mis_citas." },
      motivo: { type: "string", description: "Motivo en palabras del afiliado." },
    },
    required: ["cita_id"],
  },
  async ejecutar(argumentos, { supabase }) {
    const { cita_id: citaId, motivo } = argumentos;
    if (typeof citaId !== "string") throw new Error("Falta cita_id.");

    const { data, error } = await esquemaPendiente(supabase, "tranqui_legal").rpc("trq_fn_decidir_cita", {
      p_cita_id: citaId,
      p_decision: "cancelar",
      p_nuevo_inicio: null,
      p_motivo: typeof motivo === "string" ? motivo : null,
    });
    if (error) throw new Error(error.message);
    return `Cita cancelada (${data}). Si estaba cubierta por el plan y se cancelo con mas de 24 horas, la consulta vuelve a su cupo.`;
  },
};

const registrarConsultaRapida: HerramientaCliente = {
  descripcion:
    "Deja constancia de una consulta que resolviste tu, sin cita. Llamala cuando " +
    "termines de orientar al afiliado, con la materia que corresponda. Si el asunto " +
    "excede la orientacion general — hay documentos que revisar, plazos que corren o " +
    "una contraparte — marca resuelta=false y ofrecele agendar con un abogado.",
  esquema: {
    type: "object",
    properties: {
      pregunta: { type: "string", description: "La duda del afiliado, resumida en una frase." },
      materia: { type: "string", description: "Materia legal a la que corresponde." },
      resuelta: { type: "boolean", description: "true si quedo resuelta con tu orientacion." },
    },
    required: ["pregunta", "resuelta"],
  },
  async ejecutar(argumentos, { supabase, sesion }) {
    const { pregunta, materia, resuelta } = argumentos;
    if (typeof pregunta !== "string") throw new Error("Falta la pregunta.");

    let materiaId: string | null = null;
    if (typeof materia === "string") {
      try {
        materiaId = (await resolverMateria(supabase, materia)).id;
      } catch {
        // Una materia que no encaja no puede tumbar el registro de la consulta:
        // se guarda sin clasificar y el operador la revisa.
        materiaId = null;
      }
    }

    const { error } = await esquemaPendiente(supabase, "tranqui_legal")
      .from("trq_consulta_rapida")
      .insert({
        crp_usuario_id: sesion.usuarioId, // del contexto, JAMAS de los argumentos
        crp_conversacion_id: sesion.conversacionId,
        crp_pregunta: pregunta,
        crp_materia_sugerida_id: materiaId,
        crp_resuelta: resuelta === true,
        crp_escalada_en: resuelta === true ? null : new Date().toISOString(),
      });
    if (error) throw new Error(error.message);

    return resuelta === true
      ? "Consulta registrada como resuelta."
      : "Consulta registrada como pendiente de escalar. Ofrecele agendar con un abogado de la materia.";
  },
};

export const HERRAMIENTAS_CLIENTE_AGENDA: Record<string, HerramientaCliente> = {
  buscar_horarios: buscarHorarios,
  mi_cobertura: miCobertura,
  reservar_cita: reservarCita,
  cancelar_cita: cancelarCita,
  registrar_consulta_rapida: registrarConsultaRapida,
};
