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
      setMensajeEstado({ texto: "Límite estricto: Puedes adjuntar máximo 3 documentos adicionales.", error: true });
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
    <div style={{ backgroundColor: "#0d1117", minHeight: "100vh", color: "#c9d1d9", fontFamily: "sans-serif" }}>
      {/* HEADER */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 32px", borderBottom: "1px solid #21262d", backgroundColor: "#161b22" }}>
        <Link href="/" style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff", textDecoration: "none" }}>
          tranqi <span style={{ fontSize: "0.75rem", color: "#58a6ff", fontWeight: 600, border: "1px solid #1f6feb", padding: "2px 8px", borderRadius: "12px", marginLeft: "6px" }}>Bolsa de Empleo</span>
        </Link>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link href="/registro?intencion=abogado&destino=/panel/solicitud-socio" style={{ color: "#D8FFB3", textDecoration: "none", fontSize: "0.88rem", fontWeight: 700 }}>
            ¿Eres Abogado? Únete a la Red
          </Link>
          <Link href="/ingresar" style={{ color: "#8b949e", textDecoration: "none", fontSize: "0.88rem" }}>
            Ingresar
          </Link>
        </div>
      </header>

      {/* HERO BANNER */}
      <section style={{ padding: "56px 24px", textAlign: "center", background: "linear-gradient(180deg, #161b22 0%, #0d1117 100%)", borderBottom: "1px solid #21262d" }}>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#ffffff", marginBottom: "12px" }}>
          Bolsa de Empleo & Oportunidades Laborales
        </h1>
        <p style={{ fontSize: "1.05rem", color: "#8b949e", maxWidth: "640px", margin: "0 auto 24px" }}>
          Sé parte del equipo que democratiza el acceso a la justicia. Explora nuestras vacantes abiertas en administración, soporte, asistencia legal y operaciones.
        </p>

        {/* CATEGORÍAS */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "24px" }}>
          {["TODAS", "Legal", "Administración", "Atención", "Operaciones"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              style={{
                background: categoriaFiltro === cat ? "#1f6feb" : "#21262d",
                color: categoriaFiltro === cat ? "#ffffff" : "#8b949e",
                border: "1px solid",
                borderColor: categoriaFiltro === cat ? "#388bfd" : "#30363d",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {cat === "TODAS" ? "Todas las Convocatorias" : cat}
            </button>
          ))}
        </div>
      </section>

      {/* VACANTES LISTA */}
      <main style={{ maxWidth: "1040px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "24px" }}>
          {filtradas.map((vac) => (
            <article key={vac.id} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#58a6ff", backgroundColor: "rgba(56, 139, 253, 0.12)", padding: "4px 10px", borderRadius: "12px" }}>
                      {vac.departamento}
                    </span>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#ffffff", marginTop: "8px" }}>
                      {vac.titulo}
                    </h2>
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "#3fb950", border: "1px solid #2ea043", padding: "2px 8px", borderRadius: "4px" }}>
                    {vac.tipoContrato}
                  </span>
                </div>

                <p style={{ fontSize: "0.88rem", color: "#8b949e", margin: "12px 0 16px", lineHeight: "1.5" }}>
                  {vac.descripcion}
                </p>

                <div style={{ margin: "16px 0" }}>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#c9d1d9", marginBottom: "6px" }}>Requisitos clave:</p>
                  <ul style={{ paddingLeft: "18px", fontSize: "0.82rem", color: "#8b949e", lineHeight: "1.6" }}>
                    {vac.requisitos.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: "1px solid #21262d", marginTop: "16px" }}>
                <span style={{ fontSize: "0.8rem", color: "#8b949e" }}>{vac.ubicacion} ({vac.modalidad})</span>
                <button
                  onClick={() => abrirModalPostulacion(vac)}
                  style={{ background: "#238636", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Postular Ahora →
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* MODAL POSTULACIÓN */}
      {modalAbierto && vacanteSeleccionada && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "12px", width: "100%", maxWidth: "620px", padding: "28px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #21262d", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", color: "#ffffff", fontWeight: 700 }}>Postulación: {vacanteSeleccionada.titulo}</h3>
                <p style={{ fontSize: "0.8rem", color: "#58a6ff" }}>{vacanteSeleccionada.departamento} · {vacanteSeleccionada.ubicacion}</p>
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ background: "none", border: "none", color: "#8b949e", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>

            {mensajeEstado && (
              <div style={{ backgroundColor: mensajeEstado.error ? "rgba(248, 81, 73, 0.15)" : "rgba(46, 160, 67, 0.15)", border: `1px solid ${mensajeEstado.error ? "#f85149" : "#3fb950"}`, color: mensajeEstado.error ? "#ff7b72" : "#56d364", padding: "10px 14px", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "16px" }}>
                {mensajeEstado.texto}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#c9d1d9", marginBottom: "4px" }}>Nombres *</label>
                  <input type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} required style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", padding: "8px 12px", color: "#ffffff", fontSize: "0.85rem" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#c9d1d9", marginBottom: "4px" }}>Apellidos *</label>
                  <input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} required style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", padding: "8px 12px", color: "#ffffff", fontSize: "0.85rem" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#c9d1d9", marginBottom: "4px" }}>Correo Electrónico *</label>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", padding: "8px 12px", color: "#ffffff", fontSize: "0.85rem" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#c9d1d9", marginBottom: "4px" }}>WhatsApp / Teléfono</label>
                  <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+593 99 123 4567" style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", padding: "8px 12px", color: "#ffffff", fontSize: "0.85rem" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#c9d1d9", marginBottom: "4px" }}>Hoja de Vida / CV (PDF o Word, máx 10 MB) *</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvArchivo(e.target.files?.[0] || null)} required style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", padding: "6px 10px", color: "#8b949e", fontSize: "0.82rem" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#c9d1d9", marginBottom: "4px" }}>
                  Documentos Adjuntos (Certificados, títulos, máx 3 archivos / 10 MB)
                  {adjuntos.length > 0 && <span style={{ fontSize: "0.76rem", color: "#58a6ff", marginLeft: "8px" }}>({adjuntos.length} seleccionado/s)</span>}
                </label>
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={(e) => handleAdjuntos(e.target.files)} style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", padding: "6px 10px", color: "#8b949e", fontSize: "0.82rem" }} />
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginTop: "8px" }}>
                <input type="checkbox" id="lopdpCheck" checked={aceptaLopdp} onChange={(e) => setAceptaLopdp(e.target.checked)} style={{ marginTop: "3px" }} />
                <label htmlFor="lopdpCheck" style={{ fontSize: "0.78rem", color: "#8b949e", lineHeight: "1.4" }}>
                  Autorizo el tratamiento de mis datos personales y almacenamiento de mi Hoja de Vida para esta convocatoria según la LOPDP (Ecuador).
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setModalAbierto(false)} style={{ background: "#21262d", color: "#c9d1d9", border: "1px solid #30363d", padding: "8px 16px", borderRadius: "6px", fontSize: "0.85rem", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviando} style={{ background: "#238636", color: "#ffffff", border: "none", padding: "8px 20px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}>
                  {enviando ? "Enviando..." : "Enviar Postulación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
