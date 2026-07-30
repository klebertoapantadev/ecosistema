"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarUsuario } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";
import { IconoGoogle } from "./IconoGoogle";

export function FormularioRegistro({ negocio }: { negocio: string }) {
  const router = useRouter();
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await registrarUsuario({ nombres, apellidos, correo, contrasena, aceptaTerminos }, negocio);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    // Registro por correo: falta verificar el código de 6 dígitos que se
    // acaba de enviar (Google OAuth, en cambio, entra directo -- Google ya
    // verificó el correo).
    router.push("/verificar-correo");
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
        <IconoGoogle />
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
          value={nombres}
          onChange={(e) => setNombres(e.target.value)}
          placeholder="Nombres"
          autoComplete="given-name"
          required
        />
        <input
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          placeholder="Apellidos"
          autoComplete="family-name"
          required
        />
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
          placeholder="Contraseña (mínimo 8 caracteres)"
          autoComplete="new-password"
          required
        />
        <label className="campo-check">
          <input type="checkbox" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} />
          Acepto los{" "}
          <a href="/terminos" target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
            Términos de Servicio
          </a>
        </label>
        {error && (
          <p className="error-auth" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primario" disabled={cargando || !aceptaTerminos}>
          {cargando ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
