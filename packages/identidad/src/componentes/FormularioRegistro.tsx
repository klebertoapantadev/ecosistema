"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registrarUsuario } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";
import { IconoGoogle } from "./IconoGoogle";

interface FormularioRegistroProps {
  negocio: string;
  intencion?: string;
  destino?: string;
}

export function FormularioRegistro({ negocio, intencion = "", destino = "" }: FormularioRegistroProps) {
  const router = useRouter();
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const esAbogado = intencion === "abogado" || destino.includes("solicitud-socio");
  const destinoTarget = destino || (esAbogado ? "/panel/solicitud-socio" : "/panel");

  useEffect(() => {
    if (intencion) {
      document.cookie = `tranqi_intencion=${intencion}; path=/; max-age=86400`;
    }
    if (destinoTarget) {
      document.cookie = `tranqi_destino=${destinoTarget}; path=/; max-age=86400`;
    }
  }, [intencion, destinoTarget]);

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

    if (esAbogado) {
      document.cookie = `tranqi_modo_rol=abogado; path=/; max-age=86400`;
      document.cookie = `tranqi_rol_favorito=abogado; path=/; max-age=86400`;
    }

    router.push("/verificar-correo");
    router.refresh();
  }

  async function conGoogle() {
    setCargando(true);
    const supabase = crearClienteNavegador();

    if (esAbogado) {
      document.cookie = `tranqi_intencion=abogado; path=/; max-age=86400`;
      document.cookie = `tranqi_destino=/panel/solicitud-socio; path=/; max-age=86400`;
      document.cookie = `tranqi_modo_rol=abogado; path=/; max-age=86400`;
      document.cookie = `tranqi_rol_favorito=abogado; path=/; max-age=86400`;
    }

    const { error: errorGoogle } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoTarget)}`,
      },
    });
    if (errorGoogle) {
      setError(errorGoogle.message);
      setCargando(false);
    }
  }

  return (
    <div className="tarjeta-auth">
      {esAbogado && (
        <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "10px", background: "rgba(80,0,186,0.08)", border: "1px solid rgba(80,0,186,0.2)", textAlign: "center" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#5000BA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
            ⚖️ Registro de Equipo Jurídico — Abogados
          </span>
          <strong style={{ fontSize: "0.88rem", color: "#111111", display: "block", marginTop: "4px" }}>
            Únete a la Red de Abogados Verificados
          </strong>
        </div>
      )}

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
        <button type="submit" className="btn-auth" disabled={cargando}>
          {cargando ? "Registrando..." : esAbogado ? "Registrarme como Abogado" : "Registrarme"}
        </button>
      </form>
    </div>
  );
}
