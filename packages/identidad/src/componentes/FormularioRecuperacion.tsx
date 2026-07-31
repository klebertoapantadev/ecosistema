"use client";

import { useState } from "react";
import { solicitarRecuperacion } from "../acciones";

// Pide el correo y siempre muestra el mismo mensaje de exito -- ver el
// comentario en solicitarRecuperacion() sobre por que no se distingue si la
// cuenta existe o no.
export function FormularioRecuperacion({ negocio }: { negocio: string }) {
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await solicitarRecuperacion(correo, negocio);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="tarjeta-auth">
        <p>
          Si <strong>{correo}</strong> tiene una cuenta, te enviamos instrucciones para restablecer tu contraseña.
        </p>
      </div>
    );
  }

  return (
    <div className="tarjeta-auth">
      <form onSubmit={alEnviar} className="form-auth">
        <input
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          type="email"
          placeholder="Correo electrónico"
          autoComplete="email"
          required
        />
        {error && (
          <p className="error-auth" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primario" disabled={cargando}>
          {cargando ? "Enviando…" : "Enviar instrucciones"}
        </button>
      </form>
    </div>
  );
}
