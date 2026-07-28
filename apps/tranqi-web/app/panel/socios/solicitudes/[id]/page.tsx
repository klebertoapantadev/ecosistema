import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSolicitudDetalle } from "../../../../../modulos/socios/consultas";
import { AccionesSolicitud } from "../../../../../modulos/socios/componentes/AccionesSolicitud";
import { ENLACES_VERIFICACION } from "../../../../../modulos/socios/esquema";

export const metadata: Metadata = { title: "Detalle de solicitud — tranqi" };

export default async function PaginaDetalleSolicitud({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await obtenerSolicitudDetalle(id);
  if (!detalle) notFound();

  const { solicitud, usuario, experiencia, materias, provincias, revisiones } = detalle;
  const pendiente = solicitud.ssc_estado === "enviada" || solicitud.ssc_estado === "en_revision";

  return (
    <div>
      <Link href="/panel/socios/solicitudes">← Volver a solicitudes</Link>
      <h1>{[usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo}</h1>
      <p className="historial-fecha">
        {usuario?.usu_correo} {usuario?.usu_whatsapp ? `· ${usuario.usu_whatsapp}` : ""}
      </p>

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Datos profesionales</h2>
        <dl className="lista-detalle">
          <dt>Cédula</dt>
          <dd>{solicitud.ssc_cedula}</dd>
          <dt>Matrícula profesional</dt>
          <dd>{solicitud.ssc_matricula_profesional}</dd>
          <dt>Universidad</dt>
          <dd>{solicitud.ssc_universidad}</dd>
          <dt>Año de graduación</dt>
          <dd>{solicitud.ssc_anio_graduacion}</dd>
          <dt>Años de experiencia</dt>
          <dd>{solicitud.ssc_anos_experiencia}</dd>
          <dt>Teléfono de contacto</dt>
          <dd>{solicitud.ssc_telefono_contacto || "—"}</dd>
        </dl>
        <h3>Resumen profesional</h3>
        <p>{solicitud.ssc_resumen_profesional}</p>
      </div>

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Especialidades y cobertura</h2>
        <p><strong>Materias:</strong> {materias.map((m) => m.mat_nombre).join(", ") || "—"}</p>
        <p><strong>Provincias:</strong> {provincias.map((p) => p.cat_nombre).join(", ") || "—"}</p>
      </div>

      {experiencia.length > 0 && (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Experiencia laboral</h2>
          <ul className="lista-experiencia">
            {experiencia.map((e) => (
              <li key={e.exp_id}>
                <strong>{e.exp_cargo}</strong> — {e.exp_empresa}
                <span className="historial-fecha">
                  {" "}
                  ({e.exp_fecha_inicio} – {e.exp_fecha_fin || "actual"})
                </span>
                {e.exp_descripcion && <p>{e.exp_descripcion}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Verificación asistida (autodeclarada por el solicitante)</h2>
        <p>
          {solicitud.ssc_enlace_senescyt_verificado ? "✅" : "❌"} Título verificado en{" "}
          <a href={ENLACES_VERIFICACION.senescyt} target="_blank" rel="noopener noreferrer">SENESCYT ↗</a>
        </p>
        <p>
          {solicitud.ssc_enlace_foro_verificado ? "✅" : "❌"} Matrícula verificada en el{" "}
          <a href={ENLACES_VERIFICACION.foroAbogados} target="_blank" rel="noopener noreferrer">Foro de Abogados ↗</a>
        </p>
        <p className="aviso-borrador">Esto es autodeclarado por el solicitante — confirma tú también antes de aceptar.</p>
      </div>

      {revisiones.length > 0 && (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Historial de revisión</h2>
          <ul className="lista-experiencia">
            {revisiones.map((r) => (
              <li key={r.rev_id}>
                <strong>{r.rev_decision}</strong>
                <span className="historial-fecha"> — {new Date(r.rev_creado_en).toLocaleString("es-EC")}</span>
                {r.rev_comentario && <p>{r.rev_comentario}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendiente ? (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Decisión</h2>
          <AccionesSolicitud solicitudId={solicitud.ssc_id} />
        </div>
      ) : (
        <p className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`}>
          Solicitud ya {solicitud.ssc_estado === "aceptada" ? "aceptada" : "rechazada"}
        </p>
      )}
    </div>
  );
}
