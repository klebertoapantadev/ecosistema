"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// TRQ-ABG-005 — el dictamen de Aria, tal y como lo ven las dos partes.
//
// El mismo componente sirve al postulante (que puede lanzar la verificación de
// sus documentos) y al operador en la mesa de control (que solo lee). Cambia
// `puedeVerificar`, no el contenido: los dos tienen que ver exactamente lo
// mismo, porque si al postulante se le oculta un reparo, discutirá una decisión
// que no entiende.

export type NivelAria = "APROBADO" | "OBSERVACION" | "RECHAZADO";

export interface DocumentoAuditado {
  documento_id?: string;
  titular?: string | null;
  identificacion?: string | null;
  nivel?: NivelAria;
  score?: number;
}

export interface DictamenAria {
  estado?: NivelAria;
  score?: number;
  documentos_auditados?: Record<string, DocumentoAuditado>;
  observaciones?: string[];
  evaluado_en?: string;
  identidad_base?: { titular: string; identificacion: string } | null;
}

interface Props {
  dictamen: DictamenAria | null;
  /** Documentos subidos que se pueden analizar, por tipo. */
  documentos?: Array<{ id: string; tipo: "cedula" | "titulo" | "matricula" | "ruc" | "otro"; etiqueta: string }>;
  solicitudId?: string;
  /** Solo la cédula declarada: el nombre lo toma el servidor del perfil. */
  datosReferencia?: { cedula: string };
  /** El operador solo lee; el postulante puede lanzar el análisis. */
  puedeVerificar?: boolean;
}

const ETIQUETA: Record<NivelAria, string> = {
  APROBADO: "Identidad verificada",
  OBSERVACION: "Requiere revisión",
  RECHAZADO: "No se pudo verificar",
};

const ETIQUETA_TIPO: Record<string, string> = {
  cedula: "Cédula de identidad",
  titulo: "Título universitario",
  matricula: "Matrícula del Foro",
  ruc: "RUC",
  otro: "Otro documento",
};

function claseNivel(nivel?: NivelAria): string {
  if (nivel === "APROBADO") return "aria-nivel aria-nivel-verde";
  if (nivel === "OBSERVACION") return "aria-nivel aria-nivel-ambar";
  return "aria-nivel aria-nivel-rojo";
}

export default function InspeccionIdentidadAria({
  dictamen,
  documentos = [],
  solicitudId,
  datosReferencia,
  puedeVerificar = false,
}: Props) {
  const router = useRouter();
  const [analizando, setAnalizando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verificar(documentoId: string, tipo: string) {
    if (!solicitudId) return;
    setError(null);
    setAnalizando(documentoId);
    try {
      const r = await fetch("/api/agentes/aria-verificacion-identidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, documentoId, tipoDocumento: tipo, datosReferencia }),
      });
      const json = await r.json();
      if (!json.ok) {
        // Un 503 significa que Aria no está disponible, no que el documento sea
        // malo. Se dice tal cual: el expediente puede seguir su curso.
        setError(json.error ?? "No se pudo analizar el documento.");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servicio de verificación.");
    } finally {
      setAnalizando(null);
    }
  }

  const auditados = Object.entries(dictamen?.documentos_auditados ?? {});
  const sinAnalizar = !dictamen?.estado;

  return (
    <section className="aria-inspeccion">
      <header className="aria-inspeccion-cabeza">
        <h3>Inspección de identidad</h3>
        {!sinAnalizar && (
          <span className={claseNivel(dictamen?.estado)}>
            {ETIQUETA[dictamen?.estado ?? "RECHAZADO"]}
            {typeof dictamen?.score === "number" && ` · ${Math.round(dictamen.score * 100)}%`}
          </span>
        )}
      </header>

      {sinAnalizar ? (
        <p className="aria-nota">
          Todavía no se ha analizado ningún documento.{" "}
          {puedeVerificar
            ? "Puedes lanzar la comprobación de cada documento que hayas subido."
            : "El postulante aún no ha pasado la verificación automática; revisa el expediente a mano."}
        </p>
      ) : (
        <>
          {dictamen?.identidad_base && (
            <p className="aria-identidad-base">
              Identidad de referencia: <strong>{dictamen.identidad_base.titular}</strong> (
              {dictamen.identidad_base.identificacion}). El resto de documentos se compara contra ella.
            </p>
          )}

          <ul className="aria-documentos">
            {auditados.map(([tipo, d]) => (
              <li key={tipo} className="aria-documento">
                <span className={claseNivel(d.nivel)}>{d.nivel === "APROBADO" ? "✓" : d.nivel === "OBSERVACION" ? "!" : "✕"}</span>
                <span className="aria-documento-tipo">{ETIQUETA_TIPO[tipo] ?? tipo}</span>
                <span className="aria-documento-titular">
                  {d.titular ?? "sin titular legible"}
                  {d.identificacion ? ` · ${d.identificacion}` : ""}
                </span>
                {typeof d.score === "number" && (
                  <span className="aria-documento-score">{Math.round(d.score * 100)}%</span>
                )}
              </li>
            ))}
          </ul>

          {(dictamen?.observaciones?.length ?? 0) > 0 && (
            <ul className="aria-observaciones">
              {dictamen?.observaciones?.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}

          <p className="aria-nota">
            Esta comprobación es una ayuda, no una acreditación. La verificación final contra el
            Registro Civil, el SENESCYT y el Foro de Abogados sigue siendo del operador.
          </p>
        </>
      )}

      {error && <p className="editor-error">{error}</p>}

      {puedeVerificar && documentos.length > 0 && (
        <div className="aria-acciones">
          {documentos.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="accion-menor"
              onClick={() => verificar(doc.id, doc.tipo)}
              disabled={analizando !== null}
            >
              {analizando === doc.id ? "Analizando…" : `Verificar ${doc.etiqueta}`}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
