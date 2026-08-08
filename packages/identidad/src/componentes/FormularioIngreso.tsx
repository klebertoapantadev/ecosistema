"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { iniciarSesion } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";
import { IconoGoogle } from "./IconoGoogle";

interface FormularioIngresoProps {
  negocio: string;
  intencion?: string;
  destino?: string;
}

export function FormularioIngreso({ negocio, intencion = "", destino = "" }: FormularioIngresoProps) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
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
    const resultado = await iniciarSesion({ correo, contrasena }, negocio);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    if (esAbogado) {
      document.cookie = `tranqi_modo_rol=abogado; path=/; max-age=86400`;
      document.cookie = `tranqi_rol_favorito=abogado; path=/; max-age=86400`;
    }

    router.push(destinoTarget);
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
            ⚖️ Acceso a Equipo Jurídico — Abogados
          </span>
          <strong style={{ fontSize: "0.88rem", color: "#111111", display: "block", marginTop: "4px" }}>
            Formulario de Registro de Socio
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
        <p className="enlace-auth">
          <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
        </p>
        {error && (
          <p className="error-auth" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-auth btn-primario"
          disabled={cargando}
          style={{
            width: "100%",
            padding: "14px 20px",
            background: "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: cargando ? "not-allowed" : "pointer",
            boxShadow: "0 4px 14px rgba(80, 0, 186, 0.3)",
            transition: "all 0.2s ease",
            marginTop: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
