"use client";

import { useState, type FormEvent } from "react";
import { enviarContactoLanding } from "../acciones";
import type { TipoContacto } from "../esquema";
import { Ico } from "./IconosLanding";

const OPCIONES: Array<[TipoContacto, string]> = [
  ["persona", "Para mí"],
  ["empresa", "Mi empresa"],
  ["abogado", "Soy abogado"],
];

export function FormularioContacto() {
  const [tipo, setTipo] = useState<TipoContacto>("persona");
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado">("listo");
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setEstado("enviando");
    setError(null);
    const r = await enviarContactoLanding({ ...datos, tipo });
    if (r.ok) {
      setEstado("enviado");
    } else {
      setEstado("listo");
      setError(r.error);
    }
  }

  if (estado === "enviado") {
    return (
      <div className="formulario">
        <h3>¡Gracias!</h3>
        <p className="gracias">Recibimos tu mensaje. Te escribiremos muy pronto.</p>
        <button type="button" className="btn btn-amarillo" onClick={() => setEstado("listo")}>
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form className={`formulario es-${tipo}`} onSubmit={enviar} noValidate>
      <h3>Escríbenos</h3>
      <div className="tipo" role="radiogroup" aria-label="Escribo como">
        {OPCIONES.map(([valor, texto]) => (
          <label key={valor}>
            <input type="radio" name="tipo-visible" value={valor} checked={tipo === valor} onChange={() => setTipo(valor)} />
            {texto}
          </label>
        ))}
      </div>
      <div className="campos">
        <input name="nombre" type="text" placeholder="Nombre completo" aria-label="Nombre completo" autoComplete="name" required />
        {tipo === "empresa" && (
          <input name="empresa" type="text" placeholder="Empresa y número de colaboradores" aria-label="Empresa y número de colaboradores" required />
        )}
        {tipo === "abogado" && (
          <input name="especialidad" type="text" placeholder="Especialidad y ciudad" aria-label="Especialidad y ciudad" required />
        )}
        <input name="correo" type="email" placeholder="Correo electrónico" aria-label="Correo electrónico" autoComplete="email" required />
        <input name="telefono" type="tel" placeholder="Teléfono o WhatsApp" aria-label="Teléfono o WhatsApp" autoComplete="tel" required />
        <textarea name="mensaje" placeholder="Tu mensaje" aria-label="Mensaje" required />
        <input className="trampa" name="sitio" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-amarillo" type="submit" disabled={estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviar mensaje"} <Ico nombre="flecha" />
      </button>
    </form>
  );
}
