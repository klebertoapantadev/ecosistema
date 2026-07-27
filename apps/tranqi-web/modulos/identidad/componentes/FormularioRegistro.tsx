"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarUsuario } from "../acciones";
import { crearClienteNavegador } from "@/lib/supabase/client";

export function FormularioRegistro() {
  const router = useRouter();
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [revisarCorreo, setRevisarCorreo] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const resultado = await registrarUsuario({ nombres, apellidos, correo, contrasena });
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    if (!resultado.sesionActiva) {
      // Registro por correo: exige confirmar el enlace enviado al correo
      // antes de tener sesión (Google OAuth, en cambio, entra directo).
      setRevisarCorreo(true);
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  if (revisarCorreo) {
    return (
      <div className="tarjeta-auth">
        <p>
          Te enviamos un enlace de confirmación a <strong>{correo}</strong>. Ábrelo para activar tu cuenta —
          con Google Sign-In no hace falta este paso.
        </p>
      </div>
    );
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
        {error && <p className="error-auth" role="alert">{error}</p>}
        <button type="submit" className="btn btn-amarillo" disabled={cargando}>
          {cargando ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
