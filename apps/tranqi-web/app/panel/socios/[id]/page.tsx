import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, ExternalLink, Download, FileText, X } from "lucide-react";
import {
  obtenerSolicitudDetalle,
  obtenerAbogadoPorSolicitud,
  obtenerVersionesContratoSocio,
  obtenerUltimaVersionContratoSocio,
} from "../../../../modulos/socios/consultas";
import { AccionesSolicitud } from "../../../../modulos/socios/componentes/AccionesSolicitud";
import { BotonConfirmarContrato } from "../../../../modulos/socios/componentes/BotonConfirmarContrato";
import { BotonReenviarNotificacionAceptacion } from "../../../../modulos/socios/componentes/BotonReenviarNotificacionAceptacion";
import { SubirDocumentoRevision } from "../../../../modulos/socios/componentes/SubirDocumentoRevision";
import { EditorContratoOperador } from "../../../../modulos/socios/componentes/EditorContratoOperador";
import { ENLACES_VERIFICACION } from "../../../../modulos/socios/esquema";

export const metadata: Metadata = { title: "Detalle de socio — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Pendiente de Aprobación",
  en_revision: "En Revisión Legal",
  aceptada: "Aprobada",
  rechazada: "Requiere Corrección / Observada",
  cancelada: "Cancelada",
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
  contrato_socio: "Contrato de sociedad firmado (PDF)",
  propuesta_contrato: "Propuesta de modificación al contrato (Word)",
  otro: "Certificado / Respaldo",
  respaldo_revision: "Respaldo de revisión (admin)",
};

export default async function PaginaDetalleSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await obtenerSolicitudDetalle(id);
  if (!detalle) notFound();

  const { solicitud, usuario, experiencia, materias, provincias, revisiones, documentos } = detalle;
  const pendiente = solicitud.ssc_estado !== "aceptada";
  const abogado = solicitud.ssc_estado === "aceptada" ? await obtenerAbogadoPorSolicitud(id) : null;
  const esReingreso = solicitud.ssc_estado === "enviada" && revisiones.length > 0;

  // Consultar versiones de contrato
  const [historialVersiones, ultVersion] = await Promise.all([
    obtenerVersionesContratoSocio(id),
    obtenerUltimaVersionContratoSocio(id),
  ]);

  const nombreSocio = [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo || "Postulante";
  const cedulaSocio = solicitud.ssc_cedula || "—";

  // Buscar foto de perfil en los documentos cargados o en el perfil de usuario registrado
  const docFoto = documentos.find((d) => d.dcs_tipo === "foto_perfil" || d.dcs_tipo === "foto" || d.dcs_tipo === "perfil");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detalleUsu = (usuario as any)?.usu_detalle_usuario as Record<string, any> | undefined;
  const urlFoto = docFoto?.url || detalleUsu?.foto_url || detalleUsu?.avatar_url || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contratoFirmadoCargado = documentos.some((d) => d.dcs_tipo === "contrato_socio") || Boolean((solicitud as any).ssc_archivo_contrato_url);

  return (
    <div>
      {/* Cabecera con Botón Circular de Cierre (X) unificado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.3rem" }}>⚖️</span>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#111827" }}>
              Revisión y Gestión de Socio Abogado
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#6B7280" }}>
              Expediente legal, acreditación documental y formalización de contrato
            </p>
          </div>
        </div>

        <Link
          href="/panel/socios"
          title="Cerrar y volver a socios"
          aria-label="Cerrar y volver a socios"
          style={{
            background: "#FFFFFF",
            border: "1.5px solid #E2E8F0",
            color: "#1E293B",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            textDecoration: "none",
            transition: "all 0.2s ease",
          }}
        >
          <X size={18} />
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "8px", marginBottom: "16px" }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <span className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
          {esReingreso ? "🟡 Reingreso / Actualizada (Pendiente)" : (ETIQUETA_ESTADO[solicitud.ssc_estado] || solicitud.ssc_estado)}
        </span>
        {revisiones.length > 0 && (
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6B7280", background: "#F3F4F6", padding: "4px 10px", borderRadius: "12px" }}>
            {revisiones.length} {revisiones.length === 1 ? "revisión registrada" : "revisiones / actualizaciones"}
          </span>
        )}
      </div>

      {/* Propuestas de Modificación al Contrato enviadas por el Postulante */}
      {(() => {
        const propuestasContrato = documentos.filter(
          (d) => d.dcs_comentario?.includes("[PROPUESTA_MODIFICACION_CONTRATO]") || d.dcs_tipo === "propuesta_contrato"
        );
        if (propuestasContrato.length === 0) return null;

        return (
          <div style={{
            border: "2px solid #F59E0B",
            borderRadius: "14px",
            background: "#FFFBEB",
            padding: "18px 20px",
            marginBottom: "20px",
            boxShadow: "0 4px 12px rgba(245, 158, 11, 0.12)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "1.3rem" }}>📝</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#92400E", fontWeight: 800 }}>
                  Propuestas de Modificación al Contrato ({propuestasContrato.length})
                </h2>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#B45309" }}>
                  El solicitante ha enviado observaciones y modificaciones al contrato de servicios en formato Word (.docx).
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              {propuestasContrato.map((p, idx) => (
                <div
                  key={p.dcs_id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #FDE68A",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#92400E", background: "#FEF3C7", padding: "2px 8px", borderRadius: "6px" }}>
                        Versión {propuestasContrato.length - idx}
                      </span>
                      <strong style={{ fontSize: "0.88rem", color: "#1F2937" }}>
                        {p.dcs_nombre_archivo || "Propuesta_Contrato.docx"}
                      </strong>
                      <span style={{ fontSize: "0.76rem", color: "#6B7280" }}>
                        {new Date(p.dcs_creado_en).toLocaleString("es-EC")}
                      </span>
                    </div>
                    {p.dcs_comentario && (
                      <p style={{ margin: "6px 0 0 0", fontSize: "0.84rem", color: "#4B5563" }}>
                        <strong>Motivo / Observación del Solicitante:</strong> {p.dcs_comentario.replace("[PROPUESTA_MODIFICACION_CONTRATO] ", "")}
                      </p>
                    )}
                  </div>

                  {p.url && (
                    <a
                      href={p.url}
                      download={p.dcs_nombre_archivo || "propuesta_contrato.docx"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#5000BA",
                        color: "#FFFFFF",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        textDecoration: "none",
                        boxShadow: "0 2px 6px rgba(80, 0, 186, 0.2)"
                      }}
                    >
                      <Download size={14} /> Descargar Word (.docx)
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
                  <BotonConfirmarContrato
                    solicitudId={solicitud.ssc_id}
                    urlContratoPostulante={`/api/solicitud-socio/contrato/firmado?solicitudId=${solicitud.ssc_id}`}
                  />
                ) : (
                  <p style={{ marginTop: "8px", fontSize: "0.82rem", color: "#DC2626", fontWeight: 600 }}>
                    ⏳ El postulante aún no ha cargado el contrato firmado.
                  </p>
                )}
              </div>
            );
          })()}
          <div style={{ marginTop: "16px", borderTop: "1px solid #E5E7EB", paddingTop: "14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            {contratoFirmadoCargado && (
              <a
                href={`/api/solicitud-socio/contrato/firmado?solicitudId=${solicitud.ssc_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "#05876E",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(5, 135, 110, 0.2)",
                }}
              >
                <Download size={14} /> Ver Contrato Firmado Cargado
              </a>
            )}

            <BotonReenviarNotificacionAceptacion solicitudId={solicitud.ssc_id} correo={usuario?.usu_correo} />
          </div>

          {/* Editor de Contrato en Markdown para el Operador (colapsado si ya firmó el postulante) */}
          <EditorContratoOperador
            solicitudId={solicitud.ssc_id}
            nombrePostulante={nombreSocio}
            cedulaPostulante={cedulaSocio}
            versionInicial={ultVersion.version}
            tituloInicial={ultVersion.titulo}
            contenidoInicial={ultVersion.contenido}
            historialVersiones={historialVersiones}
            inicialmenteColapsado={contratoFirmadoCargado}
          />
        </div>
      )}

      {/* Historial de Revisiones, Acciones y Observaciones Previas */}
      {revisiones.length > 0 && (
        <div className="tarjeta-panel detalle-solicitud" style={{ border: "1.5px solid #E5E7EB", borderRadius: "14px", background: "#FFFFFF", marginBottom: "20px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#111827", fontSize: "1.1rem", marginTop: 0 }}>
            📋 Historial de Revisiones, Acciones y Observaciones
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#6B7280", marginTop: "-4px", marginBottom: "16px" }}>
            Bitácora cronológica de decisiones, observaciones de admisibilidad y reingresos del postulante.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {(revisiones as Array<{ rev_id?: string; rev_decision: string; rev_comentario?: string | null; rev_creado_en: string; revisor?: { nombre: string; correo: string } | null }>).map((r, idx) => {
              const esReingresoItem = r.rev_decision === "reingreso";
              const esRechazo = r.rev_decision === "rechazada" || r.rev_decision === "rechazado";
              const esAprobado = r.rev_decision === "aceptada" || r.rev_decision === "aceptado";
              const revisorTxt = r.revisor?.nombre ? `${r.revisor.nombre} (${r.revisor.correo})` : (esReingresoItem ? "Postulante" : "Operador / Administrador");

              return (
                <div
                  key={r.rev_id || idx}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: esReingresoItem ? "rgba(243, 232, 255, 0.4)" : esRechazo ? "rgba(254, 226, 226, 0.4)" : esAprobado ? "rgba(220, 252, 231, 0.4)" : "rgba(239, 246, 255, 0.4)",
                    border: `1px solid ${esReingresoItem ? "#D8B4FE" : esRechazo ? "#FCA5A5" : esAprobado ? "#86EFAC" : "#BFDBFE"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "6px",
                          fontSize: "0.76rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          background: esReingresoItem ? "#5000BA" : esRechazo ? "#DC2626" : esAprobado ? "#05876E" : "#2563EB",
                          color: "#FFFFFF",
                        }}
                      >
                        {esReingresoItem ? "🔄 Reingreso / Actualización" : esRechazo ? "🔴 No Aceptada / Observada" : esAprobado ? "🟢 Aprobada" : "🔵 En Revisión"}
                      </span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151" }}>
                        {revisorTxt}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "#6B7280" }}>
                      {new Date(r.rev_creado_en).toLocaleString("es-EC")}
                    </span>
                  </div>

                  {r.rev_comentario && (
                    <div style={{ marginTop: "8px", padding: "8px 12px", background: "#FFFFFF", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.06)", fontSize: "0.85rem", color: "#1F2937", lineHeight: 1.45 }}>
                      <strong>Observación / Detalle:</strong> {r.rev_comentario}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Datos profesionales</h2>
        <dl className="lista-detalle">
          <dt>Cédula / RUC</dt>
          <dd>{solicitud.ssc_cedula || "—"}</dd>
          <dt>Matrícula profesional</dt>
          <dd>{solicitud.ssc_matricula_profesional}</dd>
          <dt>Universidad</dt>
          <dd>{solicitud.ssc_universidad}</dd>
          <dt>Año graduación</dt>
          <dd>{solicitud.ssc_anio_graduacion}</dd>
          <dt>Años experiencia</dt>
          <dd>{solicitud.ssc_anos_experiencia}</dd>
          <dt>Materias</dt>
          <dd>{materias.map((m) => m.mat_nombre).join(", ") || "Ninguna"}</dd>
          <dt>Provincias</dt>
          <dd>{provincias.map((p) => p.cat_nombre).join(", ") || "Ninguna"}</dd>
        </dl>
      </div>

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Resumen profesional</h2>
        <div style={{ fontSize: "0.88rem", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: solicitud.ssc_resumen_profesional || "Sin resumen profesional" }} />
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
                  ({e.exp_fecha_inicio} — {e.exp_fecha_fin ?? "Actual"})
                </span>
                {e.exp_descripcion && <p>{e.exp_descripcion}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Verificaciones externas</h2>
        <dl className="lista-detalle">
          <dt>SENESCYT verificado</dt>
          <dd>
            {solicitud.ssc_enlace_senescyt_verificado ? (
              <span className="verificado-si"><CheckCircle2 size={16} /> Verificado por el postulante</span>
            ) : (
              <span className="verificado-no"><XCircle size={16} /> No verificado</span>
            )}
          </dd>
          <dt>Foro de Abogados</dt>
          <dd>
            {solicitud.ssc_enlace_foro_verificado ? (
              <span className="verificado-si"><CheckCircle2 size={16} /> Verificado por el postulante</span>
            ) : (
              <span className="verificado-no"><XCircle size={16} /> No verificado</span>
            )}
          </dd>
        </dl>
        <div className="enlaces-ayuda">
          <a href={ENLACES_VERIFICACION.senescyt} target="_blank" rel="noopener noreferrer">
            Consultar SENESCYT <ExternalLink size={12} />
          </a>
          <a href={ENLACES_VERIFICACION.foroAbogados} target="_blank" rel="noopener noreferrer">
            Consultar Foro de Abogados <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Expediente digital y documentos adjuntos</h2>
        {documentos.length === 0 ? (
          <p className="historial-fecha">No se adjuntaron documentos a esta solicitud.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {documentos.map((d) => (
              <div
                key={d.dcs_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: "10px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#EDE9FE", color: "#5000BA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#111827", display: "block" }}>
                      {ETIQUETA_TIPO[d.dcs_tipo] || d.dcs_tipo}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#6B7280" }}>
                      {d.dcs_nombre_archivo || "Archivo adjunto"} · {new Date(d.dcs_creado_en).toLocaleString("es-EC")}
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

      {pendiente && (
        <div className="tarjeta-panel detalle-solicitud">
          <AccionesSolicitud solicitudId={solicitud.ssc_id} estadoActual={solicitud.ssc_estado} />
        </div>
      )}
    </div>
  );
}
