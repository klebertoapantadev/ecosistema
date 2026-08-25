"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registrarUsuario } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";
import { IconoGoogle } from "./IconoGoogle";
import { ModalTerminosServicio } from "./ModalTerminosServicio";

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
  const [modalTerminosAbierto, setModalTerminosAbierto] = useState(false);
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
    if (!aceptaTerminos) {
      setModalTerminosAbierto(true);
      return;
    }
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
    if (!aceptaTerminos) {
      setModalTerminosAbierto(true);
      return;
    }
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
            Registro de Equipo Jurídico — Abogados
          </span>
          <strong style={{ fontSize: "0.88rem", color: "#111111", display: "block", marginTop: "4px" }}>
            Únete a la Red de Abogados Verificados
          </strong>
        </div>
      )}

      <button type="button" className="btn-google" onClick={conGoogle} disabled={cargando || !aceptaTerminos} style={{ opacity: aceptaTerminos ? 1 : 0.6, cursor: aceptaTerminos ? "pointer" : "not-allowed" }}>
        <IconoGoogle />
        Continuar con Google
      </button>
      <p className="aviso-terminos">
        Al continuar, aceptas los{" "}
        <button
          type="button"
          onClick={() => setModalTerminosAbierto(true)}
          style={{ background: "none", border: "none", color: "#5000BA", textDecoration: "underline", fontWeight: 700, cursor: "pointer", padding: 0 }}
        >
          Términos de Servicio
        </button>
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

        <div style={{ margin: "14px 0" }}>
          <label
            className="campo-check"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#374151",
            }}
            onClick={(e) => {
              e.preventDefault();
              setModalTerminosAbierto(true);
            }}
          >
            <input
              type="checkbox"
              checked={aceptaTerminos}
              readOnly
              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#5000BA" }}
            />
            <span>
              Acepto los{" "}
              <span style={{ color: "#5000BA", fontWeight: 800, textDecoration: "underline" }}>
                Términos de Servicio
              </span>
            </span>
          </label>

          {!aceptaTerminos && (
            <p style={{ fontSize: "0.76rem", color: "#DC2626", fontWeight: 700, margin: "6px 0 0 26px" }}>
              Para habilitar el botón debes leer los Términos hasta el final.
            </p>
          )}
        </div>

        {error && (
          <p className="error-auth" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-auth btn-primario"
          disabled={!aceptaTerminos || cargando}
          style={{
            width: "100%",
            padding: "14px 20px",
            background: aceptaTerminos
              ? "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)"
              : "#D1D5DB",
            color: aceptaTerminos ? "#ffffff" : "#6B7280",
            border: "none",
            borderRadius: "10px",
            fontWeight: 800,
            fontSize: "0.95rem",
            cursor: !aceptaTerminos || cargando ? "not-allowed" : "pointer",
            boxShadow: aceptaTerminos ? "0 4px 14px rgba(80, 0, 186, 0.3)" : "none",
            transition: "all 0.2s ease",
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {cargando ? "Registrando..." : esAbogado ? "Registrarme como Abogado" : "Registrarme"}
        </button>
      </form>

      <ModalTerminosServicio
        abierto={modalTerminosAbierto}
        alCerrar={() => setModalTerminosAbierto(false)}
        alAceptar={() => setAceptaTerminos(true)}
        negocioNombre={negocio.toUpperCase()}
      />
    </div>
  );
}
