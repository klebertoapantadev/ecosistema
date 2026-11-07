"use client";

// Piezas visuales del checkout (TRQ-ADM-004). Sin estado de negocio: el modal
// decide qué se muestra y aquí solo se pinta. Clases en `estilos.ts`.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Lock, Printer, RefreshCw } from "lucide-react";


export const dinero = (valor: number) => `$${(Number.isFinite(valor) ? valor : 0).toFixed(2)}`;

function prefiereSinMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Cuenta de 0 a `objetivo` tras `retrasoMs`. Devuelve el número con 2 decimales. */
export function useContador(objetivo: number, retrasoMs = 0, duracionMs = 1100): string {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (prefiereSinMovimiento()) {
      setValor(objetivo);
      return;
    }
    let cuadro = 0;
    const temporizador = window.setTimeout(() => {
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / duracionMs);
        setValor(objetivo * (1 - Math.pow(1 - t, 3)));
        if (t < 1) cuadro = requestAnimationFrame(paso);
      };
      cuadro = requestAnimationFrame(paso);
    }, retrasoMs);
    return () => {
      window.clearTimeout(temporizador);
      cancelAnimationFrame(cuadro);
    };
  }, [objetivo, retrasoMs, duracionMs]);
  return valor.toFixed(2);
}

const IconoCheck = ({ size = 12, grosor = 3.2 }: { size?: number; grosor?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// ── Pasos ────────────────────────────────────────────────────────────────
const NOMBRES_PASOS = ["Facturación", "Pago", "Recibo"];

export function Pasos({ indice }: { indice: number }) {
  return (
    <ol className="ckt-pasos" style={{ "--avance": indice / 2 } as React.CSSProperties} aria-label="Pasos del pago">
      {NOMBRES_PASOS.map((nombre, i) => {
        // El último paso es la meta: al llegar a él se da por hecho.
        const hecho = i < indice || (indice === 2 && i === 2);
        return (
          <li key={nombre} className={hecho ? "es-hecho" : i === indice ? "es-actual" : ""} aria-current={i === indice ? "step" : undefined}>
            <span className="ckt-punto">
              <IconoCheck size={14} />
            </span>
            {nombre}
          </li>
        );
      })}
    </ol>
  );
}

export function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div className="ckt-alerta" role="alert">
      <AlertTriangle size={18} />
      <div>{children}</div>
    </div>
  );
}

// ── Campos ───────────────────────────────────────────────────────────────
interface PropsCampo {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  alSalir?: () => void;
  error?: string | null;
  valido?: boolean;
  /** Se incrementa en cada envío fallido: el campo con error tiembla. */
  sacudir?: number;
  tipo?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  deshabilitado?: boolean;
  className?: string;
  mayusculas?: boolean;
}

export function Campo({
  id,
  etiqueta,
  valor,
  alCambiar,
  alSalir,
  error,
  valido,
  sacudir = 0,
  tipo = "text",
  autoComplete,
  inputMode,
  deshabilitado,
  className = "",
  mayusculas,
}: PropsCampo) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!sacudir || !error || !el) return;
    el.classList.remove("es-sacudido");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("es-sacudido");
    const quitar = () => el.classList.remove("es-sacudido");
    el.addEventListener("animationend", quitar, { once: true });
    return () => el.removeEventListener("animationend", quitar);
  }, [sacudir]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={caja} className={`ckt-campo ${valido ? "es-valido" : ""} ${error ? "es-invalido" : ""} ${className}`}>
      <input
        id={id}
        type={tipo}
        placeholder=" "
        value={valor}
        onChange={(e) => alCambiar(mayusculas ? e.target.value.toUpperCase() : e.target.value)}
        onBlur={alSalir}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={deshabilitado}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        style={mayusculas ? { textTransform: "uppercase" } : undefined}
      />
      <label htmlFor={id}>{etiqueta}</label>
      <span className="ckt-ok" aria-hidden="true">
        <IconoCheck />
      </span>
      {error && (
        <p className="ckt-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function Segmentos<T extends string>({
  nombre,
  opciones,
  valor,
  alCambiar,
  etiqueta,
}: {
  nombre: string;
  opciones: { valor: T; texto: string }[];
  valor: T;
  alCambiar: (v: T) => void;
  etiqueta: string;
}) {
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));
  return (
    <fieldset className="ckt-segmentos ckt-ancho" style={{ "--i": indice } as React.CSSProperties}>
      <legend className="ckt-solo-lectores">{etiqueta}</legend>
      {opciones.map((o) => (
        <React.Fragment key={o.valor}>
          <input type="radio" name={nombre} id={`${nombre}-${o.valor}`} checked={o.valor === valor} onChange={() => alCambiar(o.valor)} />
          <label htmlFor={`${nombre}-${o.valor}`}>{o.texto}</label>
        </React.Fragment>
      ))}
    </fieldset>
  );
}

export function Interruptor({ marcado, alCambiar, titulo, detalle }: { marcado: boolean; alCambiar: (v: boolean) => void; titulo: string; detalle?: string }) {
  return (
    <label className="ckt-interruptor">
      <input type="checkbox" checked={marcado} onChange={(e) => alCambiar(e.target.checked)} />
      <span className="ckt-pista" aria-hidden="true" />
      <span>
        <b>{titulo}</b>
        {detalle}
      </span>
    </label>
  );
}

// ── Tarjeta decorativa ───────────────────────────────────────────────────
export function TarjetaVisual({ numero, titular, vence, marca }: { numero: string; titular: string; vence: string; marca: string }) {
  const tarjeta = useRef<HTMLDivElement>(null);
  const inclinar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || prefiereSinMovimiento() || !tarjeta.current) return;
    const r = tarjeta.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tarjeta.current.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 16}deg)`;
  };
  const soltar = () => {
    if (tarjeta.current) tarjeta.current.style.transform = "";
  };
  return (
    <div className="ckt-escenario" onPointerMove={inclinar} onPointerLeave={soltar}>
      <div className="ckt-flotar">
        <div className="ckt-tarjeta" ref={tarjeta} aria-hidden="true">
          <div className="ckt-tarjeta-arriba">
            <span className="ckt-chip" />
            <span>{marca}</span>
          </div>
          <div className="ckt-tarjeta-numero">{numero}</div>
          <div className="ckt-tarjeta-abajo">
            <span>
              Titular<b>{titular || "TU NOMBRE"}</b>
            </span>
            <span>
              Vence<b>{vence || "MM/AA"}</b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Procesando ───────────────────────────────────────────────────────────
export function PanelProcesando({ pasarela, aviso, alCerrar }: { pasarela: string; aviso: string | null; alCerrar: () => void }) {
  const textos = [`Conectando con ${pasarela}`, "Tu banco está autorizando", "Registrando tu pago"];
  const [avance, setAvance] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setAvance(1), 900);
    const t2 = window.setTimeout(() => setAvance(2), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);
  return (
    <div className="ckt-paso ckt-procesando" aria-live="polite">
      <div className="ckt-anillo" aria-hidden="true">
        <svg className="ckt-giro" viewBox="0 0 128 128">
          <circle className="ckt-fondo-anillo" cx="64" cy="64" r="56" />
          <circle className="ckt-arco" cx="64" cy="64" r="56" />
        </svg>
        <span className="ckt-candado">
          <Lock size={24} />
        </span>
      </div>
      <div>
        <h3>Procesando tu pago</h3>
        <p className="ckt-bajada">No cierres esta ventana; tarda unos segundos.</p>
      </div>
      <ul className="ckt-subpasos">
        {textos.map((t, i) => (
          <li key={t} className={i < avance ? "es-hecho" : i === avance ? "es-activo" : ""}>
            <span className="ckt-marca-sub">
              <IconoCheck />
            </span>
            {t}
          </li>
        ))}
      </ul>
      {aviso && (
        <>
          <p className="ckt-pendiente">{aviso}</p>
          <button type="button" className="ckt-btn ckt-btn-secundario" onClick={alCerrar}>
            Entendido
          </button>
        </>
      )}
    </div>
  );
}

// ── Recibo ───────────────────────────────────────────────────────────────
export interface PasoSiguiente {
  titulo: string;
  detalle: string;
}

export interface DatosRecibo {
  negocio: string;
  productoNombre: string;
  varianteNombre: string;
  subtotal: number;
  iva: number;
  tarifaIva: number;
  total: number;
  cliente: string;
  documento: string;
  medio: string;
  autorizacion: string | null;
  referencia: string;
  fecha: Date;
}

const COLORES_CONFETI = [1, 2, 3, 4, 5].map((n) => `var(--ckt-confeti-${n}, ${["#2563EB", "#60A5FA", "#BBF7D0", "#FACC15", "#F9A8D4"][n - 1]})`);

function Confeti() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        "--x": `${Math.random() * 100}%`,
        "--dx": `${(Math.random() - 0.5) * 220}px`,
        "--r": `${(Math.random() - 0.5) * 900}deg`,
        "--d": `${1.6 + Math.random() * 1.6}s`,
        "--t": `${Math.random() * 0.5}s`,
        "--c": COLORES_CONFETI[i % COLORES_CONFETI.length],
      })),
    [],
  );
  return (
    <div className="ckt-confeti" aria-hidden="true">
      {piezas.map((estilo, i) => (
        <i key={i} style={estilo as React.CSSProperties} />
      ))}
    </div>
  );
}

/** Barras decorativas derivadas de la referencia: cada pago tiene las suyas. */
function CodigoBarras({ texto }: { texto: string }) {
  const { barras, ancho } = useMemo(() => {
    const lista: { x: number; w: number }[] = [];
    let x = 0;
    for (const caracter of texto) {
      const n = caracter.charCodeAt(0);
      for (let k = 0; k < 3; k++) {
        const w = ((n >> (k * 2)) & 3) + 1;
        lista.push({ x, w });
        x += w + ((n >> k) & 1) + 1;
      }
    }
    return { barras: lista, ancho: Math.max(x, 1) };
  }, [texto]);
  return (
    <svg className="ckt-codigo" viewBox={`0 0 ${ancho} 34`} preserveAspectRatio="none" aria-hidden="true">
      {barras.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={34} fill="currentColor" />
      ))}
    </svg>
  );
}

const formatoFecha = (fecha: Date) =>
  new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(fecha);
const formatoFechaCorta = (fecha: Date) =>
  new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(fecha).toUpperCase();

export function ReciboPago({
  datos,
  pasosSiguientes,
  alCerrar,
}: {
  datos: DatosRecibo;
  pasosSiguientes: PasoSiguiente[];
  alCerrar: () => void;
}) {
  const total = useContador(datos.total, 2700, 900);
  const primerNombre = datos.cliente.trim().split(/\s+/)[0] || "";
  let i = 0;
  const entra = () => ({ "--i": i++ }) as React.CSSProperties;

  return (
    <div className="ckt-paso ckt-recibo-paso">
      <Confeti />
      <div className="ckt-exito">
        <span className="ckt-exito-icono">
          <IconoCheck size={22} grosor={3} />
        </span>
        <div>
          <h3>{primerNombre ? `¡Listo, ${primerNombre}!` : "¡Listo!"}</h3>
          <p className="ckt-bajada">Pago aprobado. Este es tu recibo.</p>
        </div>
      </div>

      <div className="ckt-impresora">
        <div className="ckt-ranura" aria-hidden="true" />
        <div className="ckt-ventana">
          <article className="ckt-recibo" aria-label="Recibo de pago">
            <div className="ckt-recibo-cabeza ckt-entra" style={entra()}>
              <span className="ckt-marca">{datos.negocio}</span>
              <div>
                <b>Recibo de pago</b>
                {formatoFecha(datos.fecha)}
              </div>
            </div>
            <div className="ckt-fila ckt-entra" style={entra()}>
              <span>Cliente</span>
              <b>{datos.cliente}</b>
            </div>
            <div className="ckt-fila ckt-entra" style={entra()}>
              <span>Documento</span>
              <b>{datos.documento}</b>
            </div>
            <hr className="ckt-corte" />
            <div className="ckt-fila ckt-entra" style={entra()}>
              <span>
                {datos.productoNombre}
                {datos.varianteNombre && <small>{datos.varianteNombre}</small>}
              </span>
              <b>{dinero(datos.subtotal)}</b>
            </div>
            <div className="ckt-fila ckt-entra" style={entra()}>
              <span>IVA {datos.tarifaIva} %</span>
              <b>{dinero(datos.iva)}</b>
            </div>
            <hr className="ckt-corte" />
            <div className="ckt-fila ckt-fila-total ckt-entra" style={entra()}>
              <span>Total</span>
              <strong>
                <span className="ckt-solo-pantalla">${total}</span>
                <span className="ckt-solo-impresion">{dinero(datos.total)}</span>
              </strong>
            </div>
            <div className="ckt-fila ckt-entra" style={entra()}>
              <span>Medio</span>
              <b>{datos.medio}</b>
            </div>
            {datos.autorizacion && (
              <div className="ckt-fila ckt-entra" style={entra()}>
                <span>Autorización</span>
                <b>{datos.autorizacion}</b>
              </div>
            )}
            <CodigoBarras texto={datos.referencia} />
            <p className="ckt-codigo-texto">{datos.referencia}</p>
            <div className="ckt-sello" aria-hidden="true">
              PAGADO
              <small>{formatoFechaCorta(datos.fecha)}</small>
            </div>
          </article>
        </div>
      </div>

      <div className="ckt-despues">
        <div className="ckt-que-sigue">
          <h4>¿Qué sigue?</h4>
          <ol className="ckt-linea-tiempo">
            {pasosSiguientes.map((p, n) => (
              <li key={p.titulo} className={n === 0 ? "es-hecho" : n === 1 ? "es-ahora" : ""}>
                <span className="ckt-nodo">{n === 0 && <IconoCheck />}</span>
                <div>
                  <b>{p.titulo}</b>
                  <span>{p.detalle}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="ckt-pie">
          <button type="button" className="ckt-btn ckt-btn-secundario" onClick={() => window.print()} title="Imprimir recibo" aria-label="Imprimir recibo">
            <Printer size={18} /> Imprimir
          </button>
          <button type="button" className="ckt-btn ckt-btn-primario" onClick={alCerrar}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rechazo ──────────────────────────────────────────────────────────────
export function PanelRechazo({
  mensaje,
  enRevision = false,
  alRevisar,
  alReintentar,
  alCerrar,
}: {
  mensaje: string | null;
  /** Hubo cobro pero no cuadra (p. ej. monto distinto): ni «sin cobro» ni reintentar. */
  enRevision?: boolean;
  alRevisar: () => void;
  alReintentar: () => void;
  alCerrar: () => void;
}) {
  if (enRevision) {
    return (
      <div className="ckt-paso ckt-rechazo" role="alert">
        <span className="ckt-rechazo-icono">
          <AlertTriangle size={32} />
        </span>
        <h3>Tu pago quedó en revisión</h3>
        <p>{mensaje || "La pasarela informó algo que no cuadra con tu pedido."}</p>
        <ul className="ckt-consejos">
          <li>No intentes pagar de nuevo: podrías recibir un segundo cargo.</li>
          <li>El equipo revisará el pago y te escribirá a tu correo.</li>
        </ul>
        <div className="ckt-pie">
          <button type="button" className="ckt-btn ckt-btn-primario" onClick={alCerrar}>
            Entendido
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="ckt-paso ckt-rechazo" role="alert">
      <span className="ckt-rechazo-icono">
        <AlertTriangle size={32} />
      </span>
      <h3>Tu banco no aprobó el pago</h3>
      <p>
        <b>No se hizo ningún cobro.</b> {mensaje || "La pasarela o el banco declinaron la operación."}
      </p>
      <ul className="ckt-consejos">
        <li>Revisa que la tarjeta tenga fondos o cupo disponible.</li>
        <li>Algunas tarjetas necesitan habilitar compras por internet.</li>
        <li>Prueba con otra tarjeta o consulta a tu banco.</li>
      </ul>
      <div className="ckt-pie">
        <button type="button" className="ckt-btn ckt-btn-secundario" onClick={alRevisar}>
          Revisar datos
        </button>
        <button type="button" className="ckt-btn ckt-btn-primario" onClick={alReintentar}>
          <RefreshCw size={18} /> Reintentar
        </button>
      </div>
    </div>
  );
}
