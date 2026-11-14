"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { obtenerCampanasInformativasAction, type CampanaInformativa } from "@eco/comercio/acciones-informativos";

/** Aviso legal discreto del inicio del panel (TRQ-CLI-001).
 *
 *  Sustituye a la banda azul de `BannerInformativoSuperior`: misma fuente de
 *  datos (las campañas informativas que se publican desde administración),
 *  apariencia de tranqi. Maqueta aprobada el 7-nov-2026 (TRANQUI/demo/
 *  planes.html, opción «Aviso discreto»). Cada aviso se puede ocultar y no
 *  vuelve a salir en este navegador.
 *
 *  Sin carrusel (corrección del cliente, 14-nov-2026): se muestra un solo
 *  aviso, el de más prioridad; al ocultarlo aparece el siguiente. */

type Audiencia = "TODOS" | "ABOGADOS" | "CLIENTES" | "EMPRESAS";

const CLAVE_OCULTOS = "tranqi_avisos_ocultos";

const ETIQUETA_TIPO: Record<string, string> = {
  ALERTA_REGULATORIA: "Novedad legal",
  BENEFICIO_CONVENIO: "Convenio",
  NOTICIA_TRIBUTARIA_MUNICIPAL: "Tributario",
  COMUNICADO_GENERAL: "Comunicado",
};

function leerOcultos(): string[] {
  try {
    const raw = localStorage.getItem(CLAVE_OCULTOS);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function AvisoLegalDiscreto({ negocio = "tranqi", audiencia = "TODOS" }: { negocio?: string; audiencia?: Audiencia }) {
  const [avisos, setAvisos] = useState<CampanaInformativa[]>([]);

  // Se lee en un efecto y no al renderizar: localStorage no existe en el
  // servidor y leerlo antes desajusta la hidratación.
  useEffect(() => {
    let vigente = true;
    obtenerCampanasInformativasAction({
      negocio,
      // Sin filtrar por ubicación, igual que la banda a la que sustituye.
      audiencia: audiencia === "TODOS" ? undefined : audiencia,
      incluirInactivos: false,
    })
      .then((data) => {
        if (!vigente || !Array.isArray(data)) return;
        const ocultos = new Set(leerOcultos());
        const orden = { ALTA: 0, MEDIA: 1, BAJA: 2 } as const;
        setAvisos(
          data
            .filter((c) => c.inf_activo !== false && !ocultos.has(c.inf_id))
            .sort((a, b) => (orden[a.inf_prioridad] ?? 3) - (orden[b.inf_prioridad] ?? 3)),
        );
      })
      .catch(() => {
        if (vigente) setAvisos([]);
      });
    return () => {
      vigente = false;
    };
  }, [negocio, audiencia]);

  const aviso = avisos[0];
  if (!aviso) return null;

  const detalle = (aviso.inf_detalle || {}) as Record<string, any>;
  const etiqueta = ETIQUETA_TIPO[aviso.inf_tipo] || detalle.categoria || "Aviso";
  const enlace = typeof detalle.cta_url === "string" && detalle.cta_url.trim() ? detalle.cta_url.trim() : null;
  const externo = enlace ? /^https?:\/\//i.test(enlace) : false;

  function ocultar() {
    try {
      localStorage.setItem(CLAVE_OCULTOS, JSON.stringify([...leerOcultos(), aviso!.inf_id].slice(-100)));
    } catch {
      /* sin almacenamiento: se oculta solo en esta visita */
    }
    setAvisos((lista) => lista.filter((c) => c.inf_id !== aviso!.inf_id));
  }

  return (
    <div className="aviso-legal" role="status">
      <span className="aviso-legal-etiqueta">{etiqueta}</span>
      <p key={aviso.inf_id} className="aviso-legal-texto">
        <b>{aviso.inf_titulo}.</b> {aviso.inf_subtitulo}
      </p>
      {enlace && (
        <a
          className="aviso-legal-enlace"
          href={enlace}
          {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {detalle.cta_texto || "Ver más"} →
        </a>
      )}
      <button type="button" className="aviso-legal-boton" onClick={ocultar} aria-label="Ocultar aviso" title="Ocultar aviso">
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
