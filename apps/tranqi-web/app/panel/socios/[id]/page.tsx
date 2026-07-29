import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { obtenerSolicitudDetalle, obtenerAbogadoPorSolicitud } from "../../../../modulos/socios/consultas";
import { AccionesSolicitud } from "../../../../modulos/socios/componentes/AccionesSolicitud";
import { SubirDocumentoRevision } from "../../../../modulos/socios/componentes/SubirDocumentoRevision";
import { ENLACES_VERIFICACION } from "../../../../modulos/socios/esquema";

export const metadata: Metadata = { title: "Detalle de socio — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Pendiente aprobación",
  en_revision: "En revisión",
  aceptada: "Aprobado",
  rechazada: "Rechazado",
};
const ETIQUETA_TIPO: Record<string, string> = {
  titulo: "Título profesional",
  matricula: "Matrícula profesional",
  otro: "Certificado",
  respaldo_revision: "Respaldo de revisión (admin)",
};

export default async function PaginaDetalleSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await obtenerSolicitudDetalle(id);
  if (!detalle) notFound();

  const { solicitud, usuario, experiencia, materias, provincias, revisiones, documentos } = detalle;
  const pendiente = solicitud.ssc_estado === "enviada" || solicitud.ssc_estado === "en_revision";
  const abogado = solicitud.ssc_estado === "aceptada" ? await obtenerAbogadoPorSolicitud(id) : null;

  return (
    <div>
      <Link href="/panel/socios">← Volver a socios</Link>
      <h1>{[usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo}</h1>
      <p className="historial-fecha">
        {usuario?.usu_correo} {usuario?.usu_whatsapp ? `· ${usuario.usu_whatsapp}` : ""}
      </p>
      <span className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`}>{ETIQUETA_ESTADO[solicitud.ssc_estado]}</span>

      {abogado && (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Estado del socio</h2>
          <dl className="lista-detalle">
            <dt>Verificado desde</dt>
            <dd>{new Date(abogado.abg_verificado_en).toLocaleDateString("es-EC")}</dd>
            <dt>MFA configurado</dt>
            <dd>{abogado.abg_mfa_verificado ? "Sí" : "Pendiente — se exigirá para activar capacidades (ver PLT-002)"}</dd>
          </dl>
        </div>
      )}

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
        <p className="linea-verificacion">
          {solicitud.ssc_enlace_senescyt_verificado ? (
            <CheckCircle2 className="icono-verificado" aria-hidden="true" strokeWidth={1.8} />
          ) : (
            <XCircle className="icono-no-verificado" aria-hidden="true" strokeWidth={1.8} />
          )}
          Título verificado en{" "}
          <a href={ENLACES_VERIFICACION.senescyt} target="_blank" rel="noopener noreferrer">
            SENESCYT <ExternalLink className="icono-enlace-externo" aria-hidden="true" strokeWidth={2} />
          </a>
        </p>
        <p className="linea-verificacion">
          {solicitud.ssc_enlace_foro_verificado ? (
            <CheckCircle2 className="icono-verificado" aria-hidden="true" strokeWidth={1.8} />
          ) : (
            <XCircle className="icono-no-verificado" aria-hidden="true" strokeWidth={1.8} />
          )}
          Matrícula verificada en el{" "}
          <a href={ENLACES_VERIFICACION.foroAbogados} target="_blank" rel="noopener noreferrer">
            Foro de Abogados <ExternalLink className="icono-enlace-externo" aria-hidden="true" strokeWidth={2} />
          </a>
        </p>
        <p className="aviso-borrador">Esto es autodeclarado por el solicitante — confirma tú también antes de aceptar.</p>
      </div>

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Documentos</h2>
        {documentos.length === 0 ? (
          <p>Sin documentos adjuntos todavía.</p>
        ) : (
          <ul className="lista-experiencia">
            {documentos.map((d) => (
              <li key={d.dcs_id}>
                <strong>{ETIQUETA_TIPO[d.dcs_tipo] ?? d.dcs_tipo}</strong>
                {d.dcs_subido_por !== usuario?.usu_id && <span className="chip-admin-doc"> admin</span>}
                {" — "}
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    {d.dcs_nombre_archivo ?? "ver documento"}{" "}
                    <ExternalLink className="icono-enlace-externo" aria-hidden="true" strokeWidth={2} />
                  </a>
                ) : (
                  <span className="historial-fecha">enlace no disponible</span>
                )}
                {d.dcs_comentario && <p>{d.dcs_comentario}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="aviso-borrador">Enlace temporal (10 min) — se regenera cada vez que abres esta página.</p>
        <SubirDocumentoRevision solicitudId={solicitud.ssc_id} />
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

      {pendiente && (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Decisión</h2>
          <AccionesSolicitud solicitudId={solicitud.ssc_id} />
        </div>
      )}
    </div>
  );
}
