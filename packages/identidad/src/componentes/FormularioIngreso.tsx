"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniciarSesion } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";

export function FormularioIngreso({ negocio }: { negocio: string }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await iniciarSesion({ correo, contrasena }, negocio);
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
        <svg viewBox="0 0 48 48" aria-hidden="true" className="logo-google">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5C29.6 34.6 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C40.7 36.8 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"
          />
        </svg>
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
