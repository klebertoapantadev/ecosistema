import { invocarAgente, resolverAgenteDesdeEntorno } from "@eco/agentes-ia";

export interface MensajeTriajeAria {
  autor?: "usuario" | "aria";
  texto?: string;
  rol?: "user" | "assistant";
  contenido?: string;
}

export interface MateriaOpcion {
  mat_id: string;
  mat_nombre: string;
}

export interface ResultadoClasificacionAria {
  materia_id: string;
  materia_nombre: string;
  es_por_defecto: boolean;
  confianza: "alta" | "media" | "por_defecto";
  respuesta_aria: string;
  motivo_resumido: string;
  modalidad_sugerida: "virtual" | "presencial";
  necesita_aclaracion: boolean;
  run_id?: string | null;
}

export type ResultadoTriajeAria = ResultadoClasificacionAria;

const REGLAS_HEURISTICAS_MATERIA: Array<{
  patrones: RegExp[];
  nombresMateria: string[];
  explicacion: string;
}> = [
  {
    patrones: [
      /\b(arriendo|arrendamiento|inquilino|arrendador|desahucio de inquilino|alquiler|canon|renta|departamento|local comercial|garant[ií]a de arriendo|desalojo)\b/i,
    ],
    nombresMateria: ["Arrendamiento e Inquilinato", "Inquilinato", "Civil"],
    explicacion:
      "Entiendo tu situación sobre el inmueble y contrato de arriendo. Para este caso te asignaremos un abogado especialista en Arrendamiento e Inquilinato que revisará tus derechos, plazos y acciones legales.",
  },
  {
    patrones: [
      /\b(divorcio|separaci[oó]n|pensi[oó]n|alimentos|alimenticia|tenencia|patria potestad|visitas|hijo|hija|menor|ni[nñ]ez|familia|c[oó]nyuge|esposo|esposa|uni[oó]n de hecho|bienes del matrimonio|salida del pa[ií]s)\b/i,
    ],
    nombresMateria: ["Familia y Niñez", "Familia", "Civil"],
    explicacion:
      "Comprendo lo importante que es resolver este tema familiar con tranquilidad. Te atenderá un especialista en Derecho de Familia y Niñez para guiarte paso a paso en el proceso y los requisitos.",
  },
  {
    patrones: [
      /\b(despido|intempestivo|trabajo|laboral|empleador|jefe|empresa me debe|liquidaci[oó]n|finiquito|sueldo|salario|iess|afiliaci[oó]n|visto bueno|acoso laboral|renuncia|horas extras|utilidades|d[eé]cimo)\b/i,
    ],
    nombresMateria: ["Laboral", "Derecho Laboral"],
    explicacion:
      "Entiendo tu situación laboral. Un abogado especialista en Derecho Laboral analizará tu relación de trabajo, calculará los valores que te corresponden por ley y te indicará cómo proceder ante el Ministerio del Trabajo o vía judicial.",
  },
  {
    patrones: [
      /\b(choque|accidente|tr[aá]nsito|multa|citaci[oó]n|ant|licencia|puntos|veh[ií]culo retenido|patio de retenci[oó]n|atropello|alcoholemia|radar|fotomulta)\b/i,
    ],
    nombresMateria: ["Tránsito", "Transito", "Penal"],
    explicacion:
      "Comprendo el inconveniente de tránsito. Te conectaremos con un abogado especialista en Tránsito para revisar la citación, el parte policial o los daños y definir la impugnación o defensa técnica.",
  },
  {
    patrones: [
      /\b(denuncia|fiscal[ií]a|delito|robo|hurto|estafa|amenaza|agresi[oó]n|lesiones|penal|detenido|prisi[oó]n|boleta|calumnia|injuria|extorsi[oó]n|violencia)\b/i,
    ],
    nombresMateria: ["Penal", "Derecho Penal"],
    explicacion:
      "Entiendo la urgencia y delicadeza del asunto. Te asignaremos un abogado especialista en Derecho Penal para evaluar los hechos, proteger tus garantías y definir la estrategia ante la Fiscalía o judicatura.",
  },
  {
    patrones: [
      /\b(sri|impuesto|iva|renta|tributario|clausura|glosa|multa tributaria|ruc|rimpe|declaraci[oó]n|aduana|senae)\b/i,
    ],
    nombresMateria: ["Tributario", "Administrativo"],
    explicacion:
      "He tomado nota de tu consulta tributaria. Un especialista en Derecho Tributario revisará tus obligaciones, notificaciones del SRI y las alternativas de reclamo o regularización.",
  },
  {
    patrones: [
      /\b(compa[nñ][ií]a|constituir|sas|sociedad|acciones|accionista|socio|estatuto|supercias|nombramiento|junta general|corporativo|mercantil)\b/i,
    ],
    nombresMateria: ["Societario y Corporativo", "Societario", "Civil"],
    explicacion:
      "Perfecto, para estructurar o resolver este asunto empresarial te atenderá un abogado especialista en Derecho Societario y Corporativo.",
  },
  {
    patrones: [
      /\b(visa|migraci[oó]n|migratorio|extranjero|pasaporte|residencia|deportaci[oó]n|nacionalidad|naturalizaci[oó]n|apostilla)\b/i,
    ],
    nombresMateria: ["Migratorio", "Administrativo"],
    explicacion:
      "Entiendo tu requerimiento migratorio. Te asignaremos un especialista en Derecho Migratorio para revisar tu estatus, requisitos de visa o regularización en el país.",
  },
  {
    patrones: [
      /\b(marca|patente|senadi|propiedad intelectual|derechos de autor|nombre comercial|logo|registro de marca|software)\b/i,
    ],
    nombresMateria: ["Propiedad Intelectual", "Societario y Corporativo"],
    explicacion:
      "Para proteger tu marca o creación te atenderá un abogado especialista en Propiedad Intelectual y registros ante el SENADI.",
  },
  {
    patrones: [
      /\b(municipio|alcald[ií]a|ministerio|contralor[ií]a|sercop|contrataci[oó]n p[uú]blica|servidor p[uú]blico|sumario administrativo|acto administrativo|multa municipal)\b/i,
    ],
    nombresMateria: ["Administrativo", "Constitucional"],
    explicacion:
      "Comprendo tu caso frente a una entidad pública. Te asignaremos un abogado especialista en Derecho Administrativo para revisar el procedimiento e impugnaciones correspondientes.",
  },
  {
    patrones: [
      /\b(acci[oó]n de protecci[oó]n|habeas corpus|habeas data|constitucional|derechos fundamentales|medida cautelar constitucional)\b/i,
    ],
    nombresMateria: ["Constitucional", "Administrativo"],
    explicacion:
      "Entiendo la vulneración de derechos que describes. Un especialista en Derecho Constitucional evaluará la viabilidad de garantías jurisdiccionales y acciones constitucionales.",
  },
  {
    patrones: [
      /\b(deuda|pagar[eé]|letra de cambio|contrato|incumplimiento|compraventa|escritura|herencia|posesi[oó]n efectiva|terreno|propiedad|casa|hipoteca|notar[ií]a|poder|da[nñ]os y perjuicios|cobro)\b/i,
    ],
    nombresMateria: ["Civil", "Derecho Civil"],
    explicacion:
      "Entiendo tu situación. Este caso corresponde al área de Derecho Civil (contratos, obligaciones, patrimonio o sucesiones). Te asignaremos un especialista civil para revisar tu caso a detalle.",
  },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buscarMateriaEnCatalogo(
  materias: MateriaOpcion[],
  nombreBuscado: string | null | undefined,
): MateriaOpcion | null {
  if (!nombreBuscado) return null;
  const nBuscado = normalizar(nombreBuscado);
  if (!nBuscado || nBuscado === "por_defecto" || nBuscado === "defecto") return null;

  return (
    materias.find((m) => normalizar(m.mat_nombre) === nBuscado) ??
    materias.find(
      (m) =>
        normalizar(m.mat_nombre).includes(nBuscado) ||
        nBuscado.includes(normalizar(m.mat_nombre)),
    ) ??
    null
  );
}

function obtenerMateriaPorDefecto(
  materias: MateriaOpcion[],
  nombreDefecto = "Civil",
): MateriaOpcion {
  return (
    buscarMateriaEnCatalogo(materias, nombreDefecto) ??
    buscarMateriaEnCatalogo(materias, "Civil") ??
    materias[0] ?? { mat_id: "", mat_nombre: "Civil" }
  );
}

function extraerJson(texto: string): Record<string, unknown> | null {
  const limpio = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const ini = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (ini < 0 || fin <= ini) return null;
  try {
    return JSON.parse(limpio.slice(ini, fin + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clasificarPorHeuristica(
  textoConsolidado: string,
  materias: MateriaOpcion[],
  materiaDefectoNombre: string,
): ResultadoClasificacionAria {
  const limpio = textoConsolidado.trim();
  const matDefecto = obtenerMateriaPorDefecto(materias, materiaDefectoNombre);
  const pidePresencial = /\b(presencial|en persona|en oficina|en el despacho|ir a la oficina)\b/i.test(limpio);
  const modalidad: "virtual" | "presencial" = pidePresencial ? "presencial" : "virtual";

  // Si el usuario escribió muy poco (ej. un saludo corto sin explicar el problema)
  if (limpio.length < 12 && !/\b(divorcio|arriendo|despido|deuda|choque|multa|contrato|herencia|denuncia|demanda|alimentos|visa|marca)\b/i.test(limpio)) {
    return {
      materia_id: matDefecto.mat_id,
      materia_nombre: matDefecto.mat_nombre,
      es_por_defecto: true,
      confianza: "por_defecto",
      respuesta_aria:
        "¡Con gusto te ayudo! Cuéntame en un par de líneas qué ocurrió o qué problema necesitas resolver (por ejemplo: un tema de trabajo, familia, arriendo, una deuda o un contrato). Si prefieres no dar detalles ahora, también puedes continuar directamente con una consulta general.",
      motivo_resumido: limpio || "Consulta jurídica general",
      modalidad_sugerida: modalidad,
      necesita_aclaracion: true,
    };
  }

  for (const regla of REGLAS_HEURISTICAS_MATERIA) {
    if (regla.patrones.some((rx) => rx.test(limpio))) {
      for (const candidato of regla.nombresMateria) {
        const encontrada = buscarMateriaEnCatalogo(materias, candidato);
        if (encontrada) {
          return {
            materia_id: encontrada.mat_id,
            materia_nombre: encontrada.mat_nombre,
            es_por_defecto: false,
            confianza: "alta",
            respuesta_aria: regla.explicacion,
            motivo_resumido: limpio.slice(0, 450),
            modalidad_sugerida: modalidad,
            necesita_aclaracion: false,
          };
        }
      }
    }
  }

  return {
    materia_id: matDefecto.mat_id,
    materia_nombre: matDefecto.mat_nombre,
    es_por_defecto: true,
    confianza: "por_defecto",
    respuesta_aria: `Gracias por contarme tu caso. He registrado los detalles principales y he asignado la especialidad de ${matDefecto.mat_nombre} (nuestra especialidad base para consultas generales y patrimoniales) para que un abogado revise tu situación a fondo en la cita.`,
    motivo_resumido: limpio.slice(0, 450),
    modalidad_sugerida: modalidad,
    necesita_aclaracion: false,
  };
}

/**
 * Invoca a ARIA (IA) para conversar con el cliente, entender su problema en
 * términos sencillos y clasificar automáticamente la especialidad legal
 * requerida, o asignar la especialidad por defecto si el caso es general.
 */
export async function clasificarProblemaLegalConAria(
  mensajes: MensajeTriajeAria[],
  materias: MateriaOpcion[],
  materiaDefectoNombre = "Civil",
): Promise<ResultadoClasificacionAria> {
  const mensajesUsuario = mensajes
    .filter((m) => m.autor === "usuario" || m.rol === "user")
    .map((m) => (m.texto ?? m.contenido ?? "").trim())
    .filter(Boolean);
  const textoConsolidado = mensajesUsuario.join(". ").trim();
  const baseHeuristica = clasificarPorHeuristica(textoConsolidado, materias, materiaDefectoNombre);

  // Si es solo un saludo de 1-2 palabras, respondemos al instante pidiendo un poco más de contexto
  if (baseHeuristica.necesita_aclaracion) {
    return baseHeuristica;
  }

  const config = resolverAgenteDesdeEntorno("TRQ_CLIENTE") || resolverAgenteDesdeEntorno("ARIA");
  if (!config) {
    return baseHeuristica;
  }

  const listaNombresMaterias = materias.map((m) => m.mat_nombre).join(", ");
  const historialTexto = mensajes
    .slice(-6)
    .map((m) => {
      const esUsuario = m.autor === "usuario" || m.rol === "user";
      const txt = m.texto ?? m.contenido ?? "";
      return `${esUsuario ? "Cliente" : "Tranqi"}: ${txt}`;
    })
    .join("\n");

  const promptClasificacion = `Eres Tranqi, el asistente de orientación e ingreso legal de Tranqi en Ecuador.
El cliente no conoce términos jurídicos y está explicando su problema para agendar una consulta con un abogado.

Catálogo oficial de especialidades legales disponibles en Tranqi:
[${listaNombresMaterias}]
Especialidad por defecto si no encaja claramente en ninguna: "${materiaDefectoNombre}".

Conversación con el cliente:
${historialTexto}

Analiza el problema del cliente y devuelve EXCLUSIVAMENTE un objeto JSON válido, sin bloques markdown alrededor:
{
  "materia_nombre": "Nombre EXACTO de la especialidad del catálogo oficial que mejor atiende este problema, o '${materiaDefectoNombre}' si es general o ambiguo",
  "es_por_defecto": false si identificaste la especialidad con claridad, true si usaste la especialidad por defecto,
  "confianza": "alta" | "media" | "por_defecto",
  "respuesta_aria": "Respuesta cálida, empática y en lenguaje sencillo (máximo 2 a 3 oraciones) explicándole al cliente que comprendiste su problema y por qué un abogado de esa especialidad le ayudará en la cita. NO des un dictamen legal definitivo ni uses jerga complicada.",
  "motivo_resumido": "Resumen claro en 1 o 2 oraciones del problema y motivo de la consulta jurídica para que lo lea el abogado antes de la cita",
  "modalidad_sugerida": "virtual" o "presencial" ("virtual" por defecto salvo que el cliente pida ir en persona),
  "necesita_aclaracion": false (pon true SOLO si el cliente aún no ha dicho cuál es su problema y necesitas hacerle una pregunta breve en respuesta_aria)
}`;

  try {
    const respuesta = await invocarAgente(
      config,
      promptClasificacion,
      undefined,
      undefined,
      undefined,
      undefined,
      20_000,
    );

    const json = extraerJson(respuesta.response);
    if (!json) {
      return { ...baseHeuristica, run_id: respuesta.runId ?? null };
    }

    const nombreElegido = typeof json.materia_nombre === "string" ? json.materia_nombre.trim() : null;
    const materiaResuelta = buscarMateriaEnCatalogo(materias, nombreElegido);
    const matDefecto = obtenerMateriaPorDefecto(materias, materiaDefectoNombre);
    const materiaFinal = materiaResuelta ?? ( !baseHeuristica.es_por_defecto ? { mat_id: baseHeuristica.materia_id, mat_nombre: baseHeuristica.materia_nombre } : matDefecto );
    const esPorDefecto = !materiaResuelta && baseHeuristica.es_por_defecto
      ? true
      : Boolean(json.es_por_defecto === true && baseHeuristica.es_por_defecto);

    const respuestaAria =
      typeof json.respuesta_aria === "string" && json.respuesta_aria.trim().length > 10
        ? json.respuesta_aria.trim()
        : baseHeuristica.respuesta_aria;

    const motivoResumido =
      typeof json.motivo_resumido === "string" && json.motivo_resumido.trim().length > 5
        ? json.motivo_resumido.trim().slice(0, 480)
        : baseHeuristica.motivo_resumido;

    const modalidadSugerida =
      json.modalidad_sugerida === "presencial" ? "presencial" : baseHeuristica.modalidad_sugerida;

    return {
      materia_id: materiaFinal.mat_id,
      materia_nombre: materiaFinal.mat_nombre,
      es_por_defecto: esPorDefecto,
      confianza: esPorDefecto ? "por_defecto" : json.confianza === "media" ? "media" : "alta",
      respuesta_aria: respuestaAria,
      motivo_resumido: motivoResumido,
      modalidad_sugerida: modalidadSugerida,
      necesita_aclaracion: Boolean(json.necesita_aclaracion === true && textoConsolidado.length < 20),
      run_id: respuesta.runId ?? null,
    };
  } catch {
    return baseHeuristica;
  }
}
