"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completarBienvenida } from "../acciones";

interface Props {
  nombresIniciales: string;
  apellidosIniciales: string;
}

export function FormularioBienvenida({ nombresIniciales, apellidosIniciales }: Props) {
  const router = useRouter();
  const [nombres, setNombres] = useState(nombresIniciales);
  const [apellidos, setApellidos] = useState(apellidosIniciales);
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await completarBienvenida({ nombres, apellidos, autorizaWhatsapp, whatsapp });
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  return (
    <form onSubmit={alEnviar} className="form-auth">
      <label className="etiqueta-campo">
        ¿Cómo quieres que te llamemos?
        <input value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Nombres" required />
      </label>
      <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" required />

      <label className="campo-check">
        <input type="checkbox" checked={autorizaWhatsapp} onChange={(e) => setAutorizaWhatsapp(e.target.checked)} />
        ¿Podemos contactarte por WhatsApp?
      </label>

      {autorizaWhatsapp && (
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          type="tel"
          placeholder="Tu número de WhatsApp"
          autoComplete="tel"
        />
      )}

      {error && (
        <p className="error-auth" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primario" disabled={cargando}>
        {cargando ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}
