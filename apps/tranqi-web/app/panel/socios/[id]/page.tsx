import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, ExternalLink, Download, FileText } from "lucide-react";
import { obtenerSolicitudDetalle, obtenerAbogadoPorSolicitud } from "../../../../modulos/socios/consultas";
import { AccionesSolicitud } from "../../../../modulos/socios/componentes/AccionesSolicitud";
import { BotonConfirmarContrato } from "../../../../modulos/socios/componentes/BotonConfirmarContrato";
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
  foto_perfil: "Foto de perfil profesional",
  foto: "Foto de perfil profesional",
  perfil: "Foto de perfil profesional",
  titulo: "Título profesional",
  matricula: "Matrícula profesional",
  cedula: "Documento de Identificación (Cédula / Pasaporte)",
  identificacion: "Documento de Identificación (Cédula / Pasaporte)",
  identidad: "Documento de Identificación (Cédula / Pasaporte)",
  cv: "Hoja de Vida (CV)",
  curriculum: "Hoja de Vida (CV)",
  contrato_socio: "Contrato de sociedad firmado",
  otro: "Certificado / Respaldo",
  respaldo_revision: "Respaldo de revisión (admin)",
};

export default async function PaginaDetalleSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await obtenerSolicitudDetalle(id);
  if (!detalle) notFound();

  const { solicitud, usuario, experiencia, materias, provincias, revisiones, documentos } = detalle;
  const pendiente = solicitud.ssc_estado === "enviada" || solicitud.ssc_estado === "en_revision";
  const abogado = solicitud.ssc_estado === "aceptada" ? await obtenerAbogadoPorSolicitud(id) : null;

  // Buscar foto de perfil en los documentos cargados o en el perfil de usuario registrado
  const docFoto = documentos.find((d) => d.dcs_tipo === "foto_perfil" || d.dcs_tipo === "foto" || d.dcs_tipo === "perfil");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleUsu = (usuario as any)?.usu_detalle_usuario as Record<string, any> | undefined;
  const urlFoto = docFoto?.url || detalleUsu?.foto_url || detalleUsu?.avatar_url || null;

  return (
    <div>
      <Link href="/panel/socios">← Volver a socios</Link>
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "16px", marginBottom: "16px" }}>
        {urlFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFoto}
            alt="Foto de perfil"
            style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "2px solid #5000BA" }}
          />
        ) : (
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", fontWeight: 700 }}>
            {usuario?.usu_nombres?.[0] || "?"}
          </div>
        )}
        <div>
          <h1 style={{ margin: 0 }}>{[usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo}</h1>
          <p className="historial-fecha" style={{ margin: "4px 0 0 0" }}>
            {usuario?.usu_correo} {usuario?.usu_whatsapp ? `· ${usuario.usu_whatsapp}` : ""}
          </p>
        </div>
      </div>

      <span className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`}>{ETIQUETA_ESTADO[solicitud.ssc_estado]}</span>

      {solicitud.ssc_estado === "aceptada" && (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Estado del socio</h2>
          {(() => {
            const s = solicitud as typeof solicitud & { ssc_contrato_confirmado_en?: string | null };
            return abogado ? (
              <dl className="lista-detalle">
                <dt>Verificado desde</dt>
                <dd>{new Date(abogado.abg_verificado_en).toLocaleDateString("es-EC")}</dd>
                <dt>MFA configurado</dt>
                <dd>{abogado.abg_mfa_verificado ? "Sí" : "Pendiente — se exigirá para activar capacidades críticas"}</dd>
                <dt>Contrato verificado</dt>
                <dd>
                  {s.ssc_contrato_confirmado_en
                    ? `Confirmado el ${new Date(s.ssc_contrato_confirmado_en).toLocaleString("es-EC")}`
                    : "Confirmado automáticamente"}
                </dd>
              </dl>
            ) : (
              <div>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#4B5563" }}>
                  <strong>Aprobado (Paso 1).</strong> En espera de que el socio firme y suba el contrato de sociedad en PDF.
                </p>
                {documentos.some((d) => d.dcs_tipo === "contrato_socio") ? (
                  <BotonConfirmarContrato solicitudId={solicitud.ssc_id} />
                ) : (
                  <p style={{ marginTop: "8px", fontSize: "0.82rem", color: "#DC2626", fontWeight: 600 }}>
                    ⏳ El postulante aún no ha cargado el contrato firmado.
                  </p>
                )}
              </div>
            );
          })()}
          <div style={{ marginTop: "12px", borderTop: "1px solid #E5E7EB", paddingTop: "12px" }}>
            <a
              href={`/panel/solicitud-socio/contrato/imprimir?solicitudId=${solicitud.ssc_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "#FFFFFF",
                border: "1px solid #D1D5DB",
                color: "#374151",
                fontSize: "0.82rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <FileText size={14} /> Ver/Imprimir Contrato Generado
            </a>
          </div>
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
        <h3 style={{ marginTop: "18px", marginBottom: "8px" }}>Resumen profesional</h3>
        <div
          style={{
            background: "#F9FAFB",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "#111827",
            overflowX: "auto"
          }}
          dangerouslySetInnerHTML={{
            __html: solicitud.ssc_resumen_profesional || "<p>Sin resumen especificado.</p>"
          }}
        />
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
        <h2>Documentos y Adjuntos ({documentos.length})</h2>
        {documentos.length === 0 ? (
          <p>Sin documentos adjuntos todavía.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
            {documentos.map((d) => (
              <div
                key={d.dcs_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ padding: "10px", borderRadius: "10px", background: "#EEF2FF", color: "#4F46E5" }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.9rem", color: "#111827", display: "block" }}>
                      {ETIQUETA_TIPO[d.dcs_tipo] ?? d.dcs_tipo}
                      {d.dcs_subido_por !== usuario?.usu_id && <span className="chip-admin-doc"> admin</span>}
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                      {d.dcs_nombre_archivo || "Documento Adjunto"}
                    </span>
                    {d.dcs_comentario && <p style={{ fontSize: "0.78rem", color: "#4B5563", margin: "4px 0 0 0" }}>{d.dcs_comentario}</p>}
                  </div>
                </div>
                {d.url ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        background: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        color: "#374151",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        textDecoration: "none"
                      }}
                    >
                      <ExternalLink size={14} /> Ver
                    </a>
                    <a
                      href={d.url}
                      download={d.dcs_nombre_archivo || "adjunto_socio"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        background: "#05876E",
                        color: "#FFFFFF",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        textDecoration: "none"
                      }}
                    >
                      <Download size={14} /> Descargar
                    </a>
                  </div>
                ) : (
                  <span className="historial-fecha">Enlace no disponible</span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="aviso-borrador" style={{ marginTop: "12px" }}>Enlace firmado temporal (60 min) — se regenera de forma segura al consultar la solicitud.</p>
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
