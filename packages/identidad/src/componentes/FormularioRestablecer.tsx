"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { restablecerContrasena } from "../acciones";

export function FormularioRestablecer() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  if (!token) {
    return (
      <div className="tarjeta-auth">
        <p className="error-auth">Este enlace no es válido. Pide uno nuevo desde &quot;¿Olvidaste tu contraseña?&quot;.</p>
      </div>
    );
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await restablecerContrasena(token, contrasena);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/ingresar");
  }

  return (
    <div className="tarjeta-auth">
      <form onSubmit={alEnviar} className="form-auth">
        <input
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          type="password"
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          autoComplete="new-password"
          required
        />
        {error && (
          <p className="error-auth" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primario" disabled={cargando}>
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
