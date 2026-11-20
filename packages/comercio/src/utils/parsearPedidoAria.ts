import {
  inferirClasificacionPedido,
  normalizarFranjaHorariaTienda,
  obtenerFechaHoyEcuadorYmd,
  type ClasificacionOperativaPedido,
} from "../operaciones-taller";

export interface ResultadoParseoPedidoAria {
  clasificacionPedido: ClasificacionOperativaPedido;
  origenTipo: "EXEQUIALES_LLAMADA" | "MANUAL_ADMIN";
  fechaEntrega: string;
  franjaHoraria?: string | null;
  horaEspecifica?: string | null;
  productoResumen: string;
  items: Array<{ descripcion: string; cantidad: number }>;
  clienteSolicita: string;
  clienteTelefono: string;
  destinatarioFallecido: string;
  salaServicio?: string | null;
  ubicacionEntrega: string;
  enlaceMapa?: string | null;
  retiroEnLocal: boolean;
  dedicatoria: string;
  observaciones: string;
  totalUsd?: number;
  estadoInicial: string;
  faltantes: string[];
  usadoIa: boolean;
  modeloIa?: string;
}

const MESES_ES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalizarTelefonoEcuador(raw: string): string {
  const m = raw.match(/(\+?\d[\d\s-]{7,15}\d)/);
  return m ? m[1]!.replace(/\s+/g, "") : "";
}

function quitarTelefonoDeTexto(raw: string): string {
  return raw
    .replace(/(\+?\d[\d\s-]{7,15}\d)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function resolverFechaDesdeTextoEs(texto: string, hoyYmd: string): string {
  const iso = texto.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1]!;

  const low = texto.toLowerCase();
  if (/\bma[ñn]ana\b/.test(low)) {
    const [y, m, d] = hoyYmd.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
    return dt.toISOString().slice(0, 10);
  }

  const mFecha = low.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?/i
  );
  if (mFecha) {
    const dia = Number(mFecha[1]);
    const mes = MESES_ES[mFecha[2]!.toLowerCase()] ?? 1;
    const anio = mFecha[3] ? Number(mFecha[3]) : Number(hoyYmd.slice(0, 4));
    if (dia >= 1 && dia <= 31) {
      return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    }
  }

  return hoyYmd;
}

function resolverHorarioDesdeTexto(
  textoHora: string,
  esExequiales: boolean
): { franjaHoraria: string | null; horaEspecifica: string | null } {
  const limpio = textoHora.trim();
  const low = limpio.toLowerCase();
  if (!limpio) {
    return esExequiales
      ? { franjaHoraria: null, horaEspecifica: "Lo antes posible" }
      : { franjaHoraria: "A) 09:00 - 13:00", horaEspecifica: null };
  }

  if (low.includes("antes posible") || low.includes("urgente")) {
    return { franjaHoraria: null, horaEspecifica: "Lo antes posible" };
  }

  const rangoHora = limpio.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:a|-|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (rangoHora) {
    let h1 = Number(rangoHora[1]);
    const suf1 = (rangoHora[3] || rangoHora[6] || "").toLowerCase();
    if (suf1 === "pm" && h1 < 12) h1 += 12;
    if (suf1 === "am" && h1 === 12) h1 = 0;

    if (h1 >= 17) return { franjaHoraria: "C) 17:00 - 20:00", horaEspecifica: limpio };
    if (h1 >= 13) return { franjaHoraria: "B) 13:00 - 17:00", horaEspecifica: limpio };
    if (h1 >= 12) return { franjaHoraria: "A) 09:00 - 13:00", horaEspecifica: limpio };
    return { franjaHoraria: "A) 09:00 - 13:00", horaEspecifica: limpio };
  }

  const horaUnica = limpio.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (horaUnica) {
    let h = Number(horaUnica[1]);
    const min = horaUnica[2] ? Number(horaUnica[2]) : 0;
    const suf = (horaUnica[3] || "").toLowerCase();
    if (suf === "pm" && h < 12) h += 12;
    if (suf === "am" && h === 12) h = 0;
    const hhmm = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    return { franjaHoraria: normalizarFranjaHorariaTienda(limpio), horaEspecifica: hhmm };
  }

  return { franjaHoraria: normalizarFranjaHorariaTienda(limpio), horaEspecifica: limpio };
}

/**
 * Parsea de forma determinística mensajes estructurados (Telegram / ManyChat / WhatsApp)
 * y frases cortas en lenguaje natural ("Exequiales sala 4, pedido por cristina").
 * Sirve tanto como extractor inmediato como respaldo si el proveedor IA no está disponible.
 */
export function parsearMensajePedidoDeterministico(
  textoOriginal: string,
  hoyYmdParam?: string
): ResultadoParseoPedidoAria {
  const texto = String(textoOriginal || "").replace(/\r/g, "").trim();
  const hoyYmd = hoyYmdParam || obtenerFechaHoyEcuadorYmd();
  const lineas = texto.split("\n").map((l) => l.trim());
  const lowFull = texto.toLowerCase();

  // Extraer bloques por etiquetas conocidas (Fecha:, Hora:, Arreglo:, Color:, Mensaje:, Sector:, Dirección:, Recibe:, Envia:, ManyChat:, Nombre:, Celular:)
  const leerCampo = (etiquetas: string[]): string => {
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]!;
      for (const et of etiquetas) {
        const re = new RegExp(`^${et}\\s*:\\s*(.*)$`, "i");
        const m = l.match(re);
        if (m) return m[1]!.trim();
      }
    }
    return "";
  };

  // Extraer bloque multi-línea de Arreglo: hasta Color: o TARJETA o línea vacía
  let arregloBloque = "";
  const idxArreglo = lineas.findIndex((l) => /^arreglo\s*:/i.test(l));
  if (idxArreglo >= 0) {
    const primera = lineas[idxArreglo]!.replace(/^arreglo\s*:\s*/i, "").trim();
    const partes = primera ? [primera] : [];
    for (let j = idxArreglo + 1; j < lineas.length; j++) {
      const sig = lineas[j]!;
      if (
        !sig ||
        /^(color|fecha|hora|mensaje|de\b|para\b|firma|sector|direcci[oó]n|recibe|env[ií]a|manychat|nombre|celular|✍|🚚|👤|🛒)/i.test(
          sig
        )
      ) {
        break;
      }
      partes.push(sig);
    }
    arregloBloque = partes.join(" + ");
  }

  // Extraer Mensaje de tarjeta (puede tener múltiples líneas)
  let mensajeTarjeta = "";
  let firmaTarjeta = "";
  let deTarjeta = "";
  let paraTarjeta = "";
  const idxMsg = lineas.findIndex((l) => /^mensaje\s*:/i.test(l));
  if (idxMsg >= 0) {
    const primera = lineas[idxMsg]!.replace(/^mensaje\s*:\s*/i, "").trim();
    const partesMsg = primera ? [primera] : [];
    for (let j = idxMsg + 1; j < lineas.length; j++) {
      const sig = lineas[j]!;
      if (/^(🚚|👤|datos entrega|cliente|sector|direcci[oó]n|recibe|env[ií]a|arreglo\s*:)/i.test(sig)) {
        break;
      }
      if (/^de\s*[: ]/i.test(sig)) {
        deTarjeta = sig.replace(/^de\s*[: ]+/i, "").trim();
        continue;
      }
      if (/^para\s*[: ]/i.test(sig)) {
        paraTarjeta = sig.replace(/^para\s*[: ]+/i, "").trim();
        continue;
      }
      if (/^firma\s*:/i.test(sig)) {
        firmaTarjeta = sig.replace(/^firma\s*:\s*/i, "").trim();
        continue;
      }
      if (sig) partesMsg.push(sig);
    }
    mensajeTarjeta = partesMsg.join("\n").trim();
  }

  // Sector (puede continuar en la siguiente línea antes de Dirección:)
  let sectorBloque = "";
  const idxSector = lineas.findIndex((l) => /^sector\s*:/i.test(l));
  if (idxSector >= 0) {
    const primera = lineas[idxSector]!.replace(/^sector\s*:\s*/i, "").trim();
    const partesSec = primera ? [primera] : [];
    for (let j = idxSector + 1; j < lineas.length; j++) {
      const sig = lineas[j]!;
      if (!sig || /^(direcci[oó]n|recibe|env[ií]a|manychat|nombre|celular)/i.test(sig)) break;
      partesSec.push(sig);
    }
    sectorBloque = partesSec.join(" · ");
  }

  const fechaRaw = leerCampo(["fecha"]);
  const horaRaw = leerCampo(["hora"]);
  const colorRaw = leerCampo(["color"]);
  const dirRaw = leerCampo(["direcci[oó]n", "direccion"]);
  const recibeRaw = leerCampo(["recibe", "destinatario"]);
  const enviaRaw = leerCampo(["env[ií]a", "envia"]);
  const nombreCliRaw = leerCampo(["nombre", "cliente"]);
  const celCliRaw = leerCampo(["celular", "tel[eé]fono", "telefono", "whatsapp"]);
  const manychatRaw = leerCampo(["manychat"]);

  // Detectar sala exequiales en texto libre ("sala 4", "salea 4", "exequiales sala 2")
  const mSala = texto.match(/\bsal(?:a|ea)\s*(?:n[°ºo.]?\s*)?(\d{1,2}|[a-z])\b/i);
  const salaServicio = mSala ? `Sala ${mSala[1]!.toUpperCase()}` : null;

  // Detectar "pedido por Cristina" / "solicita Cristina" / "de parte de ..."
  const mPedidoPor = texto.match(
    /(?:pedido\s+por|solicita(?:do\s+por)?|pide|de\s+parte\s+de)\s+([a-záéíóúñ\s]{2,45}?)(?:[.,;\n]|$)/i
  );

  // Detectar mapa URL
  const mMapa = (dirRaw || texto).match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps)\S+/i);
  const enlaceMapa = mMapa ? mMapa[0] : null;

  const esExeqPorTexto =
    /\b(exequial|exequiales|iess|fallecid|difunt|velaci[oó]n|sala\s*\d|salea\s*\d)\b/i.test(lowFull);

  const clasificacionPedido = inferirClasificacionPedido({
    clasificacionExplicita: esExeqPorTexto ? "EXEQUIALES" : null,
    origenTipo: esExeqPorTexto ? "EXEQUIALES_LLAMADA" : "MANUAL_ADMIN",
    retiroEnLocal: /\b(retiro\s+en\s+(tienda|local)|retira\s+en\s+local)\b/i.test(lowFull),
    salaServicio,
    productoResumen: arregloBloque || texto,
    ubicacionEntrega: sectorBloque || dirRaw,
    tarjetaTipo: mensajeTarjeta ? "DIPTICO" : null,
  });

  const esExeq = clasificacionPedido === "EXEQUIALES";
  const fechaEntrega = resolverFechaDesdeTextoEs(fechaRaw || texto, hoyYmd);
  const horario = resolverHorarioDesdeTexto(horaRaw, esExeq);

  const telEnvia = normalizarTelefonoEcuador(enviaRaw || celCliRaw || texto);
  const telRecibe = normalizarTelefonoEcuador(recibeRaw);
  const recibeLimpio = quitarTelefonoDeTexto(recibeRaw);
  const enviaLimpio = quitarTelefonoDeTexto(enviaRaw || nombreCliRaw);

  const clienteSolicita =
    mPedidoPor?.[1]?.trim() ||
    enviaLimpio ||
    deTarjeta ||
    (esExeq ? "Exequiales IESS" : "Cliente");

  const destinatarioFallecido =
    recibeLimpio ||
    paraTarjeta ||
    (esExeq && salaServicio ? `Por confirmar (${salaServicio})` : esExeq ? "Por confirmar" : clienteSolicita);

  const productoResumen =
    arregloBloque ||
    (esExeq ? "Set condolencias (3 arreglos)" : texto.replace(/^nuevo\s+pedido\s*:\s*/i, "").slice(0, 120));

  const items = productoResumen
    .split(/\s*\+\s*|\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((descripcion) => ({ descripcion, cantidad: 1 }));

  const ubicacionEntrega = esExeq
    ? [sectorBloque || "Exequiales del IESS", salaServicio].filter(Boolean).join(" · ")
    : [sectorBloque, dirRaw.replace(enlaceMapa || "", "").trim()].filter(Boolean).join(" — ") ||
      (enlaceMapa ? "Ubicación en enlace de mapa" : "Por coordinar");

  const notasPartes: string[] = [];
  if (colorRaw && /falta/i.test(colorRaw)) notasPartes.push("Color: FALTA confirmar");
  else if (colorRaw) notasPartes.push(`Color: ${colorRaw}`);
  if (telRecibe) notasPartes.push(`Tel. recibe: ${telRecibe}`);
  if (firmaTarjeta) notasPartes.push(`Firma tarjeta: ${firmaTarjeta}`);
  if (manychatRaw) notasPartes.push(`ManyChat: ${manychatRaw}`);

  const faltantes: string[] = [];
  if (colorRaw && /falta/i.test(colorRaw)) faltantes.push("Color del arreglo");
  if (esExeq && /por confirmar/i.test(destinatarioFallecido)) faltantes.push("Nombre del fallecido");
  if (!horaRaw) faltantes.push("Hora de entrega");
  if (!esExeq && !ubicacionEntrega || ubicacionEntrega === "Por coordinar") {
    faltantes.push("Dirección exacta");
  }

  return {
    clasificacionPedido,
    origenTipo: esExeq ? "EXEQUIALES_LLAMADA" : "MANUAL_ADMIN",
    fechaEntrega,
    franjaHoraria: horario.franjaHoraria,
    horaEspecifica: horario.horaEspecifica,
    productoResumen,
    items: items.length > 0 ? items : [{ descripcion: productoResumen, cantidad: 1 }],
    clienteSolicita,
    clienteTelefono: telEnvia,
    destinatarioFallecido,
    salaServicio,
    ubicacionEntrega,
    enlaceMapa,
    retiroEnLocal: /\b(retiro\s+en\s+(tienda|local)|retira\s+en\s+local)\b/i.test(lowFull),
    dedicatoria: mensajeTarjeta,
    observaciones: notasPartes.join(" · "),
    estadoInicial: "NUEVO_POR_CONFIRMAR",
    faltantes,
    usadoIa: false,
  };
}
