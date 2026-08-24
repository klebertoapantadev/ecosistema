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
}

interface Props {
  nombre: string;
  saludo: string;
  descripcion: string;
}

const ANCHO_COLAPSO = 1080;

export function BarraAsistente({ nombre, saludo, descripcion }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { autor: "asistente", texto: saludo },
  ]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Abierta por defecto en escritorio; en pantallas estrechas arranca cerrada
  // para no robarle sitio al contenido. Se decide en el cliente tras montar
  // porque en el servidor no hay viewport que medir.
  const [abierta, setAbierta] = useState(true);
  const conversacionId = useRef<string | null>(null);
  const registro = useRef<HTMLDivElement>(null);
  const ojos = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const estrecha = window.matchMedia(`(max-width: ${ANCHO_COLAPSO}px)`);
    setAbierta(!estrecha.matches);
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
      const datos = await respuesta.json();
      if (!respuesta.ok || datos.error) throw new Error(datos.error ?? `Error ${respuesta.status}`);
      conversacionId.current = datos.conversacion_id ?? conversacionId.current;
      setMensajes((previos) => [
        ...previos.slice(0, -1),
        { autor: "asistente", texto: datos.response },
      ]);
    } catch {
      // Sin detalle tecnico: el mensaje de error de una API no es algo que
      // haya que ponerle delante a alguien que viene con un problema legal.
      setMensajes((previos) => [
        ...previos.slice(0, -1),
        {
          autor: "asistente",
          texto: "Se me cruzaron los cables un momento. ¿Me lo repites?",
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
        onClick={() => setAbierta(true)}
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
          <small>{descripcion}</small>
        </div>
        <button
          type="button"
          className="asistente-plegar"
          onClick={() => setAbierta(false)}
          aria-label="Ocultar el asistente"
        >
          ×
        </button>
      </header>

      <div className="asistente-registro" ref={registro} aria-live="polite">
        {mensajes.map((mensaje, indice) => (
          <div key={indice} className={`asistente-msg ${mensaje.autor}`}>
            {mensaje.pensando ? (
              <span className="asistente-puntos" aria-label="escribiendo">
                <i />
                <i />
                <i />
              </span>
            ) : (
              mensaje.texto
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
