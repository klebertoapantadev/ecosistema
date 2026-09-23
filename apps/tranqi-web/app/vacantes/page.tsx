"use client";

import { useState } from "react";
import Link from "next/link";

interface Vacante {
  id: string;
  titulo: string;
  departamento: string;
  modalidad: string;
  ubicacion: string;
  tipoContrato: string;
  descripcion: string;
  requisitos: string[];
}

const VACANTES_INICIALES: Vacante[] = [
  {
    id: "vac-001",
    titulo: "Asistente Jurídico",
    departamento: "Operación Legal",
    modalidad: "Híbrido",
    ubicacion: "Quito, Pichincha",
    tipoContrato: "Tiempo Completo",
    descripcion: "Buscamos un Asistente Jurídico para apoyo en la revisión de expedientes, elaboración de borradores de peticiones y seguimiento de causas en la plataforma.",
    requisitos: [
      "Estudiante de los últimos semestres o egresado de la carrera de Derecho.",
      "Conocimientos sólidos en Derecho Civil, Laboral y Constitucional.",
      "Excelente redacción y capacidad de síntesis.",
      "Manejo de herramientas digitales y portales del Consejo de la Judicatura (SATJE)."
    ]
  },
  {
    id: "vac-002",
    titulo: "Secretaria / Recepción Legal",
    departamento: "Administración & Atención",
    modalidad: "Presencial",
    ubicacion: "Quito, Pichincha",
    tipoContrato: "Tiempo Completo",
    descripcion: "Encargada de la atención a clientes, gestión de agenda de citas con los abogados de la red, recepción de documentos y archivo digital.",
    requisitos: [
      "Título de tercer nivel o tecnología en Administración, Asistencia de Dirección o carreras afines.",
      "Mínimo 2 años de experiencia en recepción o asistencia administrativa.",
      "Dominio de herramientas ofimáticas y atención al cliente telefónica y presencial.",
      "Proactividad, orden y amabilidad."
    ]
  },
  {
    id: "vac-003",
    titulo: "Analista de Soporte Operativo & Clientes",
    departamento: "Atención al Cliente",
    modalidad: "Remoto / Híbrido",
    ubicacion: "Quito / Nacional",
    tipoContrato: "Tiempo Completo",
    descripcion: "Atención de consultas de primer nivel a través de la app y WhatsApp, seguimiento al agendamiento de videollamadas y resolución de incidencias.",
    requisitos: [
      "Experiencia demostrable en mesas de ayuda o atención al usuario (Call Center / Chatbot).",
      "Facilidad de comunicación verbal y escrita en español.",
      "Disponibilidad de horarios rotativos.",
      "Empatía y resolución de conflictos."
    ]
  },
  {
    id: "vac-004",
    titulo: "Mensajero / Gestor de Trámites Judiciales",
    departamento: "Operaciones de Campo",
    modalidad: "Presencial",
    ubicacion: "Quito, Pichincha",
    tipoContrato: "Medio Tiempo / Por Horas",
    descripcion: "Encargado del retiro, ingreso y entrega de escrituras, notificaciones y documentación física ante notarías, juzgados y registros de la propiedad.",
    requisitos: [
      "Bachiller culminado.",
      "Licencia de conducir vigente y vehículo/motocicleta propia (deseable).",
      "Conocimiento de la ciudad y ubicación de dependencias judiciales/notariales en Quito.",
      "Honestidad y puntualidad de entrega."
    ]
  }
];

export default function PaginaBolsaEmpleo() {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("TODAS");
  const [vacanteSeleccionada, setVacanteSeleccionada] = useState<Vacante | null>(null);
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);

  // Estado del formulario
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cvArchivo, setCvArchivo] = useState<File | null>(null);
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [aceptaLopdp, setAceptaLopdp] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<{ texto: string; error: boolean } | null>(null);

  const filtradas = categoriaFiltro === "TODAS"
    ? VACANTES_INICIALES
    : VACANTES_INICIALES.filter(v => v.departamento.toLowerCase().includes(categoriaFiltro.toLowerCase()));

  const abrirModalPostulacion = (vac: Vacante) => {
    setVacanteSeleccionada(vac);
    setMensajeEstado(null);
    setModalAbierto(true);
  };

  const handleAdjuntos = (files: FileList | null) => {
    if (!files) return;
    const seleccionados = Array.from(files);
    if (seleccionados.length > 3) {
      setMensajeEstado({ texto: "Límite: puedes adjuntar máximo 3 documentos adicionales.", error: true });
      return;
    }
    const tamanoTotal = seleccionados.reduce((acc, f) => acc + f.size, 0);
    if (tamanoTotal > 10 * 1024 * 1024) {
      setMensajeEstado({ texto: "El tamaño acumulado de los adjuntos no debe superar 10 MB.", error: true });
      return;
    }
    setAdjuntos(seleccionados);
    setMensajeEstado(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombres || !apellidos || !correo || !cvArchivo) {
      setMensajeEstado({ texto: "Por favor completa los campos obligatorios y adjunta tu Hoja de Vida.", error: true });
      return;
    }
    if (!aceptaLopdp) {
      setMensajeEstado({ texto: "Debes aceptar el tratamiento de datos personales para continuar.", error: true });
      return;
    }

    setEnviando(true);
    setMensajeEstado(null);

    // Simulación de envío exitoso
    setTimeout(() => {
      setEnviando(false);
      setMensajeEstado({ texto: "¡Postulación enviada con éxito! Revisa tu correo electrónico para la confirmación.", error: false });
      setTimeout(() => {
        setModalAbierto(false);
        setNombres("");
        setApellidos("");
        setCorreo("");
        setWhatsapp("");
        setCvArchivo(null);
        setAdjuntos([]);
        setAceptaLopdp(false);
      }, 2500);
    }, 1200);
  };

  return (
    <div className="vacantes">
      {/* Cabecera */}
      <header className="vacantes-nav">
        <Link href="/" className="vacantes-marca">
          <img src="/assets/tranqi-white.svg" alt="tranqi" />
          <span>Bolsa de empleo</span>
        </Link>
        <nav className="vacantes-enlaces">
          <Link href="/registro?intencion=abogado&destino=/panel/solicitud-socio" className="es-abogado">
            ¿Eres abogado? Únete a la red
          </Link>
          <Link href="/ingresar">
            Ingresar
          </Link>
        </nav>
      </header>

      {/* Portada */}
      <header className="vacantes-portada">
        <h1>Bolsa de empleo y oportunidades laborales</h1>
        <p>
          Sé parte del equipo que democratiza el acceso a la justicia. Explora nuestras vacantes abiertas en administración, soporte, asistencia legal y operaciones.
        </p>

        {/* Filtros */}
        <div className="vacantes-filtros" role="group" aria-label="Filtrar por área">
          {["TODAS", "Legal", "Administración", "Atención", "Operaciones"].map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={categoriaFiltro === cat}
              onClick={() => setCategoriaFiltro(cat)}
            >
              {cat === "TODAS" ? "Todas" : cat}
            </button>
          ))}
        </div>
      </header>

      {/* Lista */}
      <main className="vacantes-lista">
        <div className="rejilla-auto">
          {filtradas.map((vac) => (
            <article key={vac.id} className="vacante">
              <div className="vacante-cabecera">
                <div>
                  <span className="vacante-area">{vac.departamento}</span>
                  <h2>{vac.titulo}</h2>
                </div>
                <span className="vacante-contrato">{vac.tipoContrato}</span>
              </div>

              <p className="vacante-desc">{vac.descripcion}</p>

              <div className="vacante-requisitos">
                <b>Requisitos clave</b>
                <ul>
                  {vac.requisitos.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>

              <div className="vacante-pie">
                <span>{vac.ubicacion} · {vac.modalidad}</span>
                <button
                  type="button"
                  className="vacantes-accion es-principal"
                  onClick={() => abrirModalPostulacion(vac)}
                >
                  Postular
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Modal postulación */}
      {modalAbierto && vacanteSeleccionada && (
        <div className="vacantes-velo">
          <div className="vacantes-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-postulacion">
            <div className="vacantes-modal-cabecera">
              <div>
                <h3 id="titulo-postulacion">Postulación: {vacanteSeleccionada.titulo}</h3>
                <p>{vacanteSeleccionada.departamento} · {vacanteSeleccionada.ubicacion}</p>
              </div>
              <button
                type="button"
                className="vacantes-cerrar"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ×
              </button>
            </div>

            {mensajeEstado && (
              <div
                className={`vacantes-aviso ${mensajeEstado.error ? "es-error" : "es-exito"}`}
                role="status"
              >
                {mensajeEstado.texto}
              </div>
            )}

            <form onSubmit={handleSubmit} className="vacantes-form">
              <div className="rejilla-auto">
                <div className="vacantes-campo">
                  <label htmlFor="vac-nombres">Nombres *</label>
                  <input
                    id="vac-nombres"
                    type="text"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    required
                  />
                </div>
                <div className="vacantes-campo">
                  <label htmlFor="vac-apellidos">Apellidos *</label>
                  <input
                    id="vac-apellidos"
                    type="text"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="rejilla-auto">
                <div className="vacantes-campo">
                  <label htmlFor="vac-correo">Correo electrónico *</label>
                  <input
                    id="vac-correo"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                  />
                </div>
                <div className="vacantes-campo">
                  <label htmlFor="vac-whatsapp">WhatsApp / teléfono</label>
                  <input
                    id="vac-whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+593 99 123 4567"
                  />
                </div>
              </div>

              <div className="vacantes-campo">
                <label htmlFor="vac-cv">Hoja de vida (PDF o Word, máx. 10 MB) *</label>
                <input
                  id="vac-cv"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setCvArchivo(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <div className="vacantes-campo">
                <label htmlFor="vac-adjuntos">
                  Documentos adjuntos (certificados, títulos; máx. 3 archivos / 10 MB)
                  {adjuntos.length > 0 && <small>({adjuntos.length} seleccionado/s)</small>}
                </label>
                <input
                  id="vac-adjuntos"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  onChange={(e) => handleAdjuntos(e.target.files)}
                />
              </div>

              <div className="vacantes-consentimiento">
                <input
                  type="checkbox"
                  id="lopdpCheck"
                  checked={aceptaLopdp}
                  onChange={(e) => setAceptaLopdp(e.target.checked)}
                />
                <label htmlFor="lopdpCheck">
                  Autorizo el tratamiento de mis datos personales y almacenamiento de mi hoja de vida para esta convocatoria según la LOPDP (Ecuador).
                </label>
              </div>

              <div className="vacantes-botones">
                <button
                  type="button"
                  className="vacantes-accion es-discreta"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="vacantes-accion es-principal"
                  disabled={enviando}
                >
                  {enviando ? "Enviando…" : "Enviar postulación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
