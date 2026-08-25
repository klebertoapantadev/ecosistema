"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// PLT-004 dentro del panel: barra lateral, NO burbuja flotante.
//
// La diferencia no es estetica. Una burbuja tapa contenido y se abre y cierra;
// una columna convive con la pantalla, y el afiliado puede leer su expediente
// mientras pregunta por el. Es tambien lo que evita el problema que ya se
// detecto en la landing: el globo de 300px del buddie ocupaba el 80% de una
// pantalla de movil.
//
// El personaje —solo ojos, que parpadean y siguen el cursor— viene de la
// landing aprobada. La carita completa se descarto por cliche.

interface Mensaje {
  autor: "usuario" | "asistente";
  texto: string;
  /** Marca el turno en vuelo, para pintar los puntos suspensivos. */
  pensando?: boolean;
  /** Slug del fallo, si lo hubo. Se muestra pequeño bajo el mensaje. */
  codigo?: string;
}

interface Props {
  nombre: string;
  saludo: string;
}

const ANCHO_COLAPSO = 1080;
const CLAVE_PREFERENCIA = "tranqi_asistente_abierto";

/** Qué se le dice al usuario según dónde se rompió. Cada uno sugiere la
 *  salida real; "reintenta" no sirve cuando falta una variable de entorno. */
const MENSAJE_ERROR: Record<string, string> = {
  sin_sesion: "Tu sesión caducó. Vuelve a entrar y seguimos.",
  sin_capsula: "El asistente no está configurado del todo todavía. Avisa al equipo de tranqi.",
  sin_agente: "El asistente no está configurado del todo todavía. Avisa al equipo de tranqi.",
  conversacion: "No pude abrir la conversación. Avisa al equipo de tranqi.",
  aria: "No consigo hablar con el asistente ahora mismo. Inténtalo en un momento.",
  inesperado: "Algo se rompió por dentro. Avisa al equipo de tranqi.",
};

export function BarraAsistente({ nombre, saludo }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { autor: "asistente", texto: saludo },
  ]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Arranca CERRADA y se decide al montar. Dos motivos: en el servidor no hay
  // viewport que medir ni localStorage que leer, y abrir por defecto para luego
  // cerrar produce un salto de 360px en el layout que se ve feo.
  const [abierta, setAbierta] = useState(false);
  const conversacionId = useRef<string | null>(null);
  const registro = useRef<HTMLDivElement>(null);
  const ojos = useRef<HTMLDivElement>(null);

  // Manda lo que el usuario eligio la ultima vez; si nunca eligio, se abre en
  // escritorio y se queda plegada en pantallas estrechas, donde tres columnas
  // no caben. Guardar la preferencia importa: sin ella, cada navegacion dentro
  // del panel reabre una barra que el usuario acaba de cerrar.
  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_PREFERENCIA);
    if (guardado === "abierta" || guardado === "plegada") {
      setAbierta(guardado === "abierta");
      return;
    }
    setAbierta(!window.matchMedia(`(max-width: ${ANCHO_COLAPSO}px)`).matches);
  }, []);

  const cambiarVisibilidad = useCallback((valor: boolean) => {
    setAbierta(valor);
    localStorage.setItem(CLAVE_PREFERENCIA, valor ? "abierta" : "plegada");
  }, []);

  // El scroll sigue al ultimo mensaje.
  useEffect(() => {
    registro.current?.scrollTo({ top: registro.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  // Los ojos siguen al cursor. Se salta entero si el usuario pidio menos
  // movimiento: es decoracion, y la preferencia del sistema manda.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function mover(evento: MouseEvent) {
      const nodo = ojos.current;
      if (!nodo) return;
      const caja = nodo.getBoundingClientRect();
      const angulo = Math.atan2(
        evento.clientY - (caja.top + caja.height / 2),
        evento.clientX - (caja.left + caja.width / 2),
      );
      nodo.style.setProperty("--ojo-x", `${Math.cos(angulo) * 2}px`);
      nodo.style.setProperty("--ojo-y", `${Math.sin(angulo) * 2}px`);
    }
    window.addEventListener("mousemove", mover);
    return () => window.removeEventListener("mousemove", mover);
  }, []);

  const enviar = useCallback(async () => {
    const pregunta = texto.trim();
    if (!pregunta || ocupado) return;

    setTexto("");
    setOcupado(true);
    setMensajes((previos) => [
      ...previos,
      { autor: "usuario", texto: pregunta },
      { autor: "asistente", texto: "", pensando: true },
    ]);

    try {
      const respuesta = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: pregunta, conversacion_id: conversacionId.current }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !datos || datos.error) {
        throw new Error(datos?.codigo ?? `http_${respuesta.status}`);
      }
      conversacionId.current = datos.conversacion_id ?? conversacionId.current;
      setMensajes((previos) => [
        ...previos.slice(0, -1),
        { autor: "asistente", texto: datos.response },
      ]);
    } catch (e) {
      // El texto sigue siendo humano: quien viene con un problema legal no
      // necesita leer un stack trace. Pero el codigo va debajo, pequeño, porque
      // un chat que dice siempre lo mismo pase lo que pase es indiagnosticable
      // en produccion: sesion caducada y ARIA caido se veian igual.
      const codigo = (e as Error).message || "desconocido";
      setMensajes((previos) => [
        ...previos.slice(0, -1),
        {
          autor: "asistente",
          texto: MENSAJE_ERROR[codigo] ?? "Se me cruzaron los cables un momento. ¿Me lo repites?",
          codigo,
        },
      ]);
    } finally {
      setOcupado(false);
    }
  }, [texto, ocupado]);

  if (!abierta) {
    return (
      <button
        type="button"
        className="asistente-pestana"
        onClick={() => cambiarVisibilidad(true)}
        aria-expanded={false}
        aria-label={`Abrir ${nombre}`}
      >
        <Ojos referencia={null} />
        <span>{nombre}</span>
      </button>
    );
  }

  return (
    <aside className="asistente" aria-label={nombre}>
      <header className="asistente-cabecera">
        <Ojos referencia={ojos} />
        <div className="asistente-titulo">
          <b>{nombre}</b>
        </div>
        <button
          type="button"
          className="asistente-plegar"
          onClick={() => cambiarVisibilidad(false)}
          aria-label="Plegar el asistente"
          title="Plegar"
        >
          ×
        </button>
      </header>

      <div className="asistente-registro" ref={registro} aria-live="polite">
        {mensajes.map((mensaje, indice) => (
          <div key={indice} className={`asistente-msg de-${mensaje.autor}`}>
            {mensaje.pensando ? (
              <span className="asistente-puntos" aria-label="escribiendo">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <>
                {mensaje.texto}
                {mensaje.codigo && <small className="asistente-codigo">{mensaje.codigo}</small>}
              </>
            )}
          </div>
        ))}
      </div>

      <form
        className="asistente-redactor"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <input
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Pregúntame lo que quieras…"
          aria-label="Mensaje para el asistente"
          autoComplete="off"
          disabled={ocupado}
        />
        <button type="submit" disabled={ocupado || !texto.trim()}>
          Enviar
        </button>
      </form>
    </aside>
  );
}

/** El personaje: dos ojos que parpadean. Sin boca, decision de la landing. */
function Ojos({ referencia }: { referencia: React.RefObject<HTMLDivElement | null> | null }) {
  return (
    <div className="asistente-avatar" aria-hidden="true">
      <div className="asistente-ojos" ref={referencia ?? undefined}>
        <span />
        <span />
      </div>
    </div>
  );
}
