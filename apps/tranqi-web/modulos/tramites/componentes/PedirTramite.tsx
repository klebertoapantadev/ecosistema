"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, FileCheck2 } from "lucide-react";
import { ModalCheckoutPayphone } from "@eco/comercio";
import { CaminoRecorrido, HITOS_TRAMITE } from "../../agenda/componentes/CaminoRecorrido";
import type { TramiteDetectado } from "../esquema";

function formatearUSD(monto: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(monto);
}

interface Props {
  detectado: TramiteDetectado;
  relato: string;
  /** Vuelve a la pregunta para reescribir lo contado. */
  alCambiar: () => void;
  /** El cliente prefiere hablarlo antes con un abogado: sigue el camino de la cita. */
  alPreferirAbogado: () => void;
  /** «Resolver otra cosa» tras pedirlo. */
  alResolverOtraCosa: () => void;
}

/**
 * Camino del trámite dentro del recorrido del inicio (TRQ-043): lo que entendimos, qué
 * hacemos por el cliente, la opción del catálogo, los requisitos y el pago. Todo sale del
 * catálogo de comercio; el pago es el checkout de siempre.
 */
export default function PedirTramite({ detectado, relato, alCambiar, alPreferirAbogado, alResolverOtraCosa }: Props) {
  const router = useRouter();
  const { tramite } = detectado;
  const [opcionId, setOpcionId] = useState(detectado.opcionId);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [pedido, setPedido] = useState(false);

  const opcion = useMemo(
    () => tramite.opciones.find((o) => o.variante.var_id === opcionId) ?? tramite.opciones[0],
    [tramite.opciones, opcionId],
  );
  if (!opcion) return null;

  if (pedido) {
    return (
      <section className="recorrido-resolver" id="resolver" aria-label="Resolver una necesidad legal">
        <CaminoRecorrido hito={4} etiquetas={HITOS_TRAMITE} />
        <div className="recorrido-en-marcha" role="status">
          <span className="en-marcha-sello" aria-hidden="true">
            <Check size={26} strokeWidth={2.6} />
          </span>
          <div>
            <h2>Tu trámite ya está en marcha</h2>
            <p>
              <strong>{opcion.nombre}</strong>
              {tramite.tiempoEntrega ? `. Listo en ${tramite.tiempoEntrega}.` : "."}
            </p>
            <ol className="en-marcha-pasos">
              <li className="es-hecho">
                <b>Recibimos tu pedido y tu pago</b>
                <span>Lo tienes en Mis necesidades.</span>
              </li>
              <li>
                <b>Te contactamos para coordinarlo</b>
                <span>Revisamos contigo los requisitos antes de ir a la notaría.</span>
              </li>
              <li>
                <b>Lo gestionamos por ti</b>
                <span>No tienes que hacer filas: te avisamos cuando esté listo.</span>
              </li>
            </ol>
            <div className="en-marcha-acciones">
              <Link href="/panel/agendamiento?widget=mis_citas" className="btn btn-primario">
                Ver mis necesidades
              </Link>
              <button type="button" className="btn btn-neutro" onClick={alResolverOtraCosa}>
                Resolver otra cosa
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="recorrido-resolver" id="resolver" aria-label="Resolver una necesidad legal">
      <CaminoRecorrido hito={2} etiquetas={HITOS_TRAMITE} />

      <div className="recorrido-bloque recorrido-bloque-primero">
        <div className="recorrido-contado">
          <div>
            <div className="recorrido-eyebrow">Nos contaste</div>
            <p>«{relato}»</p>
          </div>
          <button type="button" className="recorrido-enlace" onClick={alCambiar}>
            Cambiar
          </button>
        </div>

        <div className="tramite-entendimos">
          <div className="tramite-que">
            <div className="recorrido-eyebrow" style={{ color: "var(--panel-accion)" }}>Lo que entendimos</div>
            <h3>
              <span className="chip-tramite">Trámite</span>
              {tramite.nombre}
            </h3>
            {tramite.descripcion && <p>{tramite.descripcion}</p>}
          </div>
          <div className="tramite-hacemos">
            <div className="recorrido-eyebrow">Lo hacemos por ti</div>
            <ul>
              <li>
                <FileCheck2 size={16} aria-hidden="true" />
                Gestionamos todo en la notaría
              </li>
              {tramite.tiempoEntrega && (
                <li>
                  <Clock size={16} aria-hidden="true" />
                  Listo en {tramite.tiempoEntrega}
                </li>
              )}
            </ul>
            <button type="button" className="recorrido-enlace" onClick={alPreferirAbogado}>
              Prefiero hablarlo antes con un abogado
            </button>
          </div>
        </div>
      </div>

      <div className="recorrido-bloque">
        {tramite.opciones.length > 1 && (
          <fieldset className="tramite-opciones">
            <legend>¿Cuál necesitas?</legend>
            {tramite.opciones.map((o) => (
              <label key={o.variante.var_id} className={o.variante.var_id === opcion.variante.var_id ? "es-elegida" : undefined}>
                <input
                  type="radio"
                  name="opcion-tramite"
                  value={o.variante.var_id}
                  checked={o.variante.var_id === opcion.variante.var_id}
                  onChange={() => setOpcionId(o.variante.var_id)}
                />
                <span className="tramite-opcion-texto">
                  <b>{o.nombre}</b>
                  {o.descripcion && <span>{o.descripcion}</span>}
                </span>
                <span className="tramite-opcion-precio">{formatearUSD(o.variante.precio_total)}</span>
              </label>
            ))}
          </fieldset>
        )}

        {tramite.requisitos.length > 0 && (
          <div className="tramite-requisitos">
            <b>Lo que necesitamos de ti</b>
            <ul>
              {tramite.requisitos.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <small>No hace falta tenerlos ahora: te los pedimos al coordinar.</small>
          </div>
        )}

        <div className="tramite-cierre">
          <div>
            <b>{opcion.nombre}</b>
            <span>{formatearUSD(opcion.variante.precio_total)} con IVA. Factura electrónica al instante.</span>
          </div>
          <button type="button" className="btn btn-primario" onClick={() => setPagoAbierto(true)}>
            Pagar {formatearUSD(opcion.variante.precio_total)} y pedir
          </button>
        </div>
      </div>

      <ModalCheckoutPayphone
        abierto={pagoAbierto}
        alCerrar={() => setPagoAbierto(false)}
        productoNombre={`${tramite.nombre} — ${opcion.nombre}`}
        variante={opcion.variante}
        negocio="tranqi"
        alPagoExitoso={() => {
          setPagoAbierto(false);
          setPedido(true);
          router.refresh();
        }}
      />
    </section>
  );
}
