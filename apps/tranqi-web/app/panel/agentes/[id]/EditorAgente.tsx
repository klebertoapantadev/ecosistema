"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgenteResumen, ServidorMcp } from "../../../../modulos/agentes/consultas";

// Editor de un agente. Todo pasa por /api/aria, que vuelve a comprobar rol y
// aal2 y filtra la ruta contra su lista blanca: este componente no tiene
// ninguna credencial, solo la cookie de sesion del usuario.

interface Props {
  agente: AgenteResumen;
  servidoresMcp: ServidorMcp[];
  mcpEnganchados: string[];
}

type Estado = { tipo: "quieto" } | { tipo: "guardando" } | { tipo: "error"; mensaje: string };

export function EditorAgente({ agente, servidoresMcp, mcpEnganchados }: Props) {
  const router = useRouter();
  const [identidad, setIdentidad] = useState(agente.identity ?? "");
  const [secciones, setSecciones] = useState(agente.system_sections ?? []);
  const [modelo, setModelo] = useState(agente.model);
  const [activo, setActivo] = useState(agente.enabled);
  const [enganchados, setEnganchados] = useState<string[]>(mcpEnganchados);
  const [estado, setEstado] = useState<Estado>({ tipo: "quieto" });
  const [guardado, setGuardado] = useState(false);

  async function pedir(metodo: string, ruta: string, cuerpo?: unknown) {
    const respuesta = await fetch(`/api/aria${ruta}`, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => null);
      throw new Error(datos?.error ?? datos?.detail ?? `ARIA respondió ${respuesta.status}`);
    }
    return respuesta.status === 204 ? null : respuesta.json();
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado({ tipo: "guardando" });
    setGuardado(false);
    try {
      await pedir("PATCH", `/v1/agents/${agente.id}`, {
        identity: identidad,
        system_sections: secciones,
        model: modelo,
        enabled: activo,
      });
      setGuardado(true);
      // Refresca el Server Component para que lo que se ve venga de ARIA, no
      // del estado local: si ARIA normalizo algo, se ve normalizado.
      router.refresh();
    } catch (e) {
      setEstado({ tipo: "error", mensaje: (e as Error).message });
      return;
    }
    setEstado({ tipo: "quieto" });
  }

  async function alternarMcp(servidor: ServidorMcp) {
    const estaba = enganchados.includes(servidor.id);
    // Optimista: enganchar un MCP es reversible con un clic, y esperar al
    // servidor para mover una casilla se siente roto.
    setEnganchados((previos) =>
      estaba ? previos.filter((x) => x !== servidor.id) : [...previos, servidor.id],
    );
    try {
      await pedir(
        estaba ? "DELETE" : "POST",
        `/v1/agents/${agente.id}/mcp-servers/${servidor.id}`,
      );
    } catch (e) {
      setEnganchados((previos) =>
        estaba ? [...previos, servidor.id] : previos.filter((x) => x !== servidor.id),
      );
      setEstado({ tipo: "error", mensaje: (e as Error).message });
    }
  }

  function cambiarSeccion(indice: number, campo: "title" | "content", valor: string) {
    setSecciones((previas) =>
      previas.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)),
    );
  }

  return (
    <form className="editor-agente" onSubmit={guardar}>
      <fieldset className="tarjeta-panel bloque-editor" disabled={estado.tipo === "guardando"}>
        <legend>Comportamiento</legend>

        <label className="campo-editor">
          <span>Identidad</span>
          <small>Quién es el agente y cómo habla. Es lo primero que lee el modelo.</small>
          <textarea rows={6} value={identidad} onChange={(e) => setIdentidad(e.target.value)} />
        </label>

        {secciones.map((seccion, indice) => (
          <label className="campo-editor" key={indice}>
            <span>Sección: {seccion.title}</span>
            <input
              value={seccion.title}
              onChange={(e) => cambiarSeccion(indice, "title", e.target.value)}
              aria-label={`Título de la sección ${indice + 1}`}
            />
            <textarea
              rows={8}
              value={seccion.content}
              onChange={(e) => cambiarSeccion(indice, "content", e.target.value)}
              aria-label={`Contenido de la sección ${indice + 1}`}
            />
          </label>
        ))}

        <label className="campo-editor">
          <span>Modelo</span>
          <small>Formato proveedor/modelo, por ejemplo openrouter/qwen/qwen3-235b-a22b-2507.</small>
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </label>

        <label className="campo-interruptor">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span>Agente activo</span>
        </label>
      </fieldset>

      <fieldset className="tarjeta-panel bloque-editor" disabled={estado.tipo === "guardando"}>
        <legend>Herramientas (MCP)</legend>
        <p className="agentes-nota">
          Lo que el agente puede consultar. Desenganchar un servidor no rompe la conversación: el
          asistente sigue respondiendo, pero deja de tener acceso a esos datos.
        </p>
        {servidoresMcp.length === 0 ? (
          <p className="agentes-vacio">No hay servidores MCP registrados en este tenant.</p>
        ) : (
          servidoresMcp.map((servidor) => (
            <label className="campo-interruptor" key={servidor.id}>
              <input
                type="checkbox"
                checked={enganchados.includes(servidor.id)}
                onChange={() => void alternarMcp(servidor)}
              />
              <span>
                {servidor.name} <small>{servidor.transport}</small>
              </span>
            </label>
          ))
        )}
      </fieldset>

      <div className="acciones-editor">
        <button type="submit" className="boton-primario" disabled={estado.tipo === "guardando"}>
          {estado.tipo === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        {guardado && estado.tipo === "quieto" && (
          <span className="editor-ok" role="status">
            Guardado. El cambio aplica en la próxima respuesta del agente.
          </span>
        )}
        {estado.tipo === "error" && (
          <span className="editor-error" role="alert">
            {estado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}
