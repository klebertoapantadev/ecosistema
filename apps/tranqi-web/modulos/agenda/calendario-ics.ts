export interface DatosEventoCalendarioCita {
  citaId: string;
  inicioIso: string;
  finIso?: string | null;
  duracionMin?: number;
  modalidad: string;
  materiaNombre?: string | null;
  motivo?: string | null;
  clienteNombre?: string | null;
  clienteCorreo?: string | null;
  clienteWhatsapp?: string | null;
  abogadoNombre?: string | null;
  abogadoCorreo?: string | null;
  enlaceVideollamada?: string | null;
  lugarPresencial?: string | null;
  sequence?: number;
  metodo?: "REQUEST" | "CANCEL";
  comentarioCambio?: string | null;
  correoInstitucional?: string | null;
}

function formatearFechaUtcIcs(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escaparTextoIcs(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function limpiarNumeroWhatsappEcuador(raw?: string | null): string | null {
  if (!raw) return null;
  const soloDigitos = raw.replace(/\D/g, "");
  if (!soloDigitos) return null;
  if (soloDigitos.startsWith("593") && soloDigitos.length >= 11) {
    return soloDigitos;
  }
  if (soloDigitos.startsWith("09") && soloDigitos.length === 10) {
    return `593${soloDigitos.slice(1)}`;
  }
  if (soloDigitos.length === 9 && soloDigitos.startsWith("9")) {
    return `593${soloDigitos}`;
  }
  return soloDigitos;
}

export function construirUrlWhatsappCliente(params: {
  telefono?: string | null;
  clienteNombre?: string | null;
  abogadoNombre?: string | null;
  fechaTexto?: string;
}): string | null {
  const num = limpiarNumeroWhatsappEcuador(params.telefono);
  if (!num) return null;
  const saludo = `Hola ${params.clienteNombre || ""}, te saluda Dr(a). ${
    params.abogadoNombre || "tu abogado asignado"
  } de Tranqi respecto a tu consulta jurídica programada${
    params.fechaTexto ? ` para el ${params.fechaTexto}` : ""
  }.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(saludo)}`;
}

export function generarContenidoIcsCita(datos: DatosEventoCalendarioCita): string {
  const inicio = new Date(datos.inicioIso);
  const durMin = datos.duracionMin ?? 45;
  const fin = datos.finIso
    ? new Date(datos.finIso)
    : new Date(inicio.getTime() + durMin * 60 * 1000);

  const metodo = datos.metodo ?? "REQUEST";
  const seq = Math.max(0, Math.trunc(datos.sequence ?? 0));
  const esPresencial = datos.modalidad === "presencial";
  const modalidadTxt = esPresencial ? "Presencial en Oficina" : "Telemática (Videollamada)";
  const materia = datos.materiaNombre || "General";
  const cliNombre = datos.clienteNombre || "Cliente Tranqi";
  const abgNombre = datos.abogadoNombre ? `Dr(a). ${datos.abogadoNombre}` : "Abogado Tranqi";
  const correoOrg = datos.correoInstitucional || "notificaciones@tranqi24.com";

  const titulo =
    metodo === "CANCEL"
      ? `[CANCELADA] Consulta Legal Tranqi (${materia}) - ${cliNombre}`
      : `Consulta Legal Tranqi (${materia}) - ${cliNombre}`;

  const ubicacion = esPresencial
    ? datos.lugarPresencial || "Oficina Tranqi"
    : datos.enlaceVideollamada || "https://tranqi24.com/panel/agendamiento";

  const lineasDesc = [
    `Consulta Jurídica en Tranqi (${modalidadTxt})`,
    `Especialidad: ${materia}`,
    `Cliente: ${cliNombre}${datos.clienteCorreo ? ` (${datos.clienteCorreo})` : ""}${
      datos.clienteWhatsapp ? ` · Cel/WhatsApp: ${datos.clienteWhatsapp}` : ""
    }`,
    `Abogado asignado: ${abgNombre}${datos.abogadoCorreo ? ` (${datos.abogadoCorreo})` : ""}`,
    datos.motivo ? `Motivo de consulta: ${datos.motivo}` : "",
    datos.comentarioCambio ? `Última actualización / comentario: ${datos.comentarioCambio}` : "",
    `Panel Tranqi: https://tranqi24.com/panel/agendamiento`,
  ].filter(Boolean);

  const attendees: string[] = [];
  if (datos.clienteCorreo && datos.clienteCorreo.includes("@")) {
    attendees.push(
      `ATTENDEE;CN="${escaparTextoIcs(cliNombre)}";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:${datos.clienteCorreo.trim()}`,
    );
  }
  if (datos.abogadoCorreo && datos.abogadoCorreo.includes("@")) {
    attendees.push(
      `ATTENDEE;CN="${escaparTextoIcs(abgNombre)}";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:${datos.abogadoCorreo.trim()}`,
    );
  }
  if (correoOrg && correoOrg.includes("@")) {
    attendees.push(
      `ATTENDEE;CN="Agenda Institucional Tranqi";CUTYPE=INDIVIDUAL;ROLE=CHAIR;PARTSTAT=ACCEPTED:mailto:${correoOrg.trim()}`,
    );
  }

  const lineasIcs = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Tranqi Legal//Agenda Juridica//ES",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${metodo}`,
    "BEGIN:VEVENT",
    `UID:cita-${datos.citaId}@tranqi24.com`,
    `SEQUENCE:${seq}`,
    `DTSTAMP:${formatearFechaUtcIcs(new Date().toISOString())}`,
    `DTSTART:${formatearFechaUtcIcs(inicio.toISOString())}`,
    `DTEND:${formatearFechaUtcIcs(fin.toISOString())}`,
    `SUMMARY:${escaparTextoIcs(titulo)}`,
    `DESCRIPTION:${escaparTextoIcs(lineasDesc.join("\n"))}`,
    `LOCATION:${escaparTextoIcs(ubicacion)}`,
    `STATUS:${metodo === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `ORGANIZER;CN="Agenda Tranqi":mailto:${correoOrg.trim()}`,
    ...attendees,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio de consulta legal en Tranqi en 30 minutos",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lineasIcs.join("\r\n");
}

export function construirEnlacesCalendarioCita(
  datos: DatosEventoCalendarioCita,
  baseUrl = "https://tranqi24.com",
) {
  const inicio = new Date(datos.inicioIso);
  const durMin = datos.duracionMin ?? 45;
  const fin = datos.finIso
    ? new Date(datos.finIso)
    : new Date(inicio.getTime() + durMin * 60 * 1000);

  const esPresencial = datos.modalidad === "presencial";
  const modalidadTxt = esPresencial ? "Presencial en Oficina" : "Videollamada";
  const materia = datos.materiaNombre || "General";
  const cliNombre = datos.clienteNombre || "Cliente";
  const abgNombre = datos.abogadoNombre ? `Dr(a). ${datos.abogadoNombre}` : "Por confirmar";

  const titulo = `Consulta Legal Tranqi (${materia}) - ${cliNombre}`;
  const ubicacion = esPresencial
    ? datos.lugarPresencial || "Oficina Tranqi"
    : datos.enlaceVideollamada || `${baseUrl}/panel/agendamiento`;

  const detalles = [
    `Consulta Jurídica en Tranqi (${modalidadTxt})`,
    `Cliente: ${cliNombre}${datos.clienteWhatsapp ? ` (Cel/WhatsApp: ${datos.clienteWhatsapp})` : ""}`,
    `Abogado: ${abgNombre}`,
    datos.motivo ? `Motivo: ${datos.motivo}` : "",
    datos.comentarioCambio ? `Nota de actualización: ${datos.comentarioCambio}` : "",
    `Gestionar cita: ${baseUrl}/panel/agendamiento`,
  ]
    .filter(Boolean)
    .join("\n");

  const fechasGoogle = `${formatearFechaUtcIcs(inicio.toISOString())}/${formatearFechaUtcIcs(
    fin.toISOString(),
  )}`;

  const googleCalendarUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(titulo)}` +
    `&dates=${encodeURIComponent(fechasGoogle)}` +
    `&details=${encodeURIComponent(detalles)}` +
    `&location=${encodeURIComponent(ubicacion)}`;

  const outlookCalendarUrl =
    `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent` +
    `&subject=${encodeURIComponent(titulo)}` +
    `&startdt=${encodeURIComponent(inicio.toISOString())}` +
    `&enddt=${encodeURIComponent(fin.toISOString())}` +
    `&body=${encodeURIComponent(detalles)}` +
    `&location=${encodeURIComponent(ubicacion)}`;

  const seq = Math.max(0, Math.trunc(datos.sequence ?? 0));
  const icsDownloadUrl = `${baseUrl}/api/agenda/ics?cita_id=${encodeURIComponent(
    datos.citaId,
  )}&seq=${seq}`;

  return {
    googleCalendarUrl,
    outlookCalendarUrl,
    icsDownloadUrl,
  };
}

export function construirBloqueHtmlCalendarioCorreo(
  datos: DatosEventoCalendarioCita,
  baseUrl = "https://tranqi24.com",
): string {
  const { googleCalendarUrl, outlookCalendarUrl, icsDownloadUrl } =
    construirEnlacesCalendarioCita(datos, baseUrl);
  const esActualizacion = (datos.sequence ?? 0) > 0;

  return `
    <div style="margin:12px 0;padding:12px 14px;border-radius:10px;background:#F5F3FF;border:1px solid #DDD6FE;">
      <strong style="display:block;font-size:0.82rem;color:#4C1D95;margin-bottom:6px;">
        📅 ${
          esActualizacion
            ? `Actualización de Agenda (Secuencia #${datos.sequence}) — Sincroniza el nuevo horario en tu calendario personal:`
            : "Agrega esta cita a tu calendario personal (Google, Outlook o Apple Calendar):"
        }
      </strong>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
        <a href="${googleCalendarUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:7px 12px;border-radius:7px;background:#5000BA;color:#FFFFFF;font-size:0.78rem;font-weight:800;text-decoration:none;margin-right:6px;">
          📅 Google Calendar
        </a>
        <a href="${outlookCalendarUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:7px 12px;border-radius:7px;background:#0284C7;color:#FFFFFF;font-size:0.78rem;font-weight:800;text-decoration:none;margin-right:6px;">
          📆 Outlook / Office 365
        </a>
        <a href="${icsDownloadUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:7px 12px;border-radius:7px;background:#05876E;color:#FFFFFF;font-size:0.78rem;font-weight:800;text-decoration:none;">
          📥 Archivo .ICS (Apple / Correo)
        </a>
      </div>
      <p style="margin:6px 0 0 0;font-size:0.73rem;color:#475569;">
        💡 También adjuntamos el archivo <code>cita-tranqi.ics</code> (ID único <code>cita-${datos.citaId.slice(
          0,
          8,
        )}</code>) para que tu gestor de correo actualice automáticamente la cita si cambia de fecha u hora.
      </p>
    </div>
  `;
}

