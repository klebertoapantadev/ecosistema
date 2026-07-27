"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniciarSesion } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";

export function FormularioIngreso() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await iniciarSesion({ correo, contrasena });
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  async function conGoogle() {
    setCargando(true);
    const supabase = crearClienteNavegador();
    const { error: errorGoogle } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (errorGoogle) {
      setError(errorGoogle.message);
      setCargando(false);
    }
  }

  return (
    <div className="tarjeta-auth">
      <button type="button" className="btn-google" onClick={conGoogle} disabled={cargando}>
        Continuar con Google
      </button>
      <p className="aviso-terminos">
        Al continuar, aceptas los{" "}
        <a href="/terminos" target="_blank" rel="noopener">
          Términos de Servicio
        </a>
        .
      </p>
      <div className="separador">o con correo</div>
      <form onSubmit={alEnviar} className="form-auth">
        <input
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          type="email"
          placeholder="Correo electrónico"
          autoComplete="email"
          required
        />
        <input
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="error-auth" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primario" disabled={cargando}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
