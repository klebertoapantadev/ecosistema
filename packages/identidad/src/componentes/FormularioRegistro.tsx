"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { registrarUsuario } from "../acciones";
import { crearClienteNavegador } from "@eco/supabase";
import { PAISES_TELEFONO, PAIS_TELEFONO_DEFECTO } from "../paises";
import { IconoGoogle } from "./IconoGoogle";
import { ModalTerminosServicio } from "./ModalTerminosServicio";
import { ModalTerminosWhatsapp } from "./ModalTerminosWhatsapp";

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
  const [paisWhatsapp, setPaisWhatsapp] = useState<CountryCode>(PAIS_TELEFONO_DEFECTO);
  const [numeroWhatsapp, setNumeroWhatsapp] = useState("");
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(false);
  const [modalWhatsappAbierto, setModalWhatsappAbierto] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [modalTerminosAbierto, setModalTerminosAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const paisSeleccionado = PAISES_TELEFONO.find((p) => p.codigo === paisWhatsapp) ?? {
    codigo: PAIS_TELEFONO_DEFECTO,
    nombre: "Ecuador",
    prefijo: "+593",
  };
  const esAbogado = intencion === "abogado" || destino.includes("solicitud-socio");
  const destinoTarget = destino || (esAbogado ? "/panel/solicitud-socio" : "/panel");

  useEffect(() => {
    if (intencion) {
      document.cookie = `tranqi_intencion=${intencion}; path=/; max-age=86400`;
    }
    if (destinoTarget) {
      document.cookie = `tranqi_destino=${encodeURIComponent(destinoTarget)}; path=/; max-age=86400`;
    }
  }, [intencion, destinoTarget]);

  function alCambiarWhatsapp(valor: string) {
    setNumeroWhatsapp(new AsYouType(paisWhatsapp).input(valor));
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!aceptaTerminos) {
      setModalTerminosAbierto(true);
      return;
    }
    if (!isValidPhoneNumber(numeroWhatsapp, paisWhatsapp)) {
      setError(`Ingresa un número de WhatsApp válido de ${paisSeleccionado.nombre}.`);
      return;
    }
    if (!autorizaWhatsapp) {
      setError("Debes autorizar el contacto y envío de información por WhatsApp para continuar.");
      return;
    }
    const whatsappFormateado = parsePhoneNumberFromString(numeroWhatsapp, paisWhatsapp)?.number ?? numeroWhatsapp.trim();

    setError(null);
    setCargando(true);
    const resultado = await registrarUsuario(
      {
        nombres,
        apellidos,
        correo,
        contrasena,
        whatsapp: whatsappFormateado,
        codigoPaisWhatsapp: paisSeleccionado.prefijo,
        autorizaWhatsapp,
        aceptaTerminos,
      },
      negocio
    );
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

      {/* Bloque de Consentimiento y Términos de Servicio (Ubicado en la parte superior) */}
      <div
        style={{
          marginBottom: "16px",
          padding: "12px 14px",
          borderRadius: "10px",
          background: aceptaTerminos ? "rgba(5, 135, 110, 0.05)" : "rgba(80, 0, 186, 0.04)",
          border: `1.5px solid ${aceptaTerminos ? "#05876E" : "rgba(80, 0, 186, 0.2)"}`,
          transition: "all 0.2s ease",
        }}
      >
        <label
          className="campo-check"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#1F2937",
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

        {!aceptaTerminos ? (
          <p style={{ fontSize: "0.75rem", color: "#DC2626", fontWeight: 700, margin: "6px 0 0 28px", lineHeight: "1.3" }}>
            Para habilitar el botón debes leer los Términos hasta el final.
          </p>
        ) : (
          <p style={{ fontSize: "0.75rem", color: "#05876E", fontWeight: 700, margin: "6px 0 0 28px", lineHeight: "1.3" }}>
            ✓ Términos de servicio aceptados. Registro habilitado.
          </p>
        )}
      </div>

      <button type="button" className="btn-google" onClick={conGoogle} disabled={cargando || !aceptaTerminos} style={{ opacity: aceptaTerminos ? 1 : 0.6, cursor: aceptaTerminos ? "pointer" : "not-allowed" }}>
        <IconoGoogle />
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

        {/* Campo WhatsApp + Consentimiento explícito LOPDP (PLT-001 / PLT-011.12) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "12px",
            borderRadius: "10px",
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
          }}
        >
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151" }}>
            Número de WhatsApp
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
            <select
              value={paisWhatsapp}
              aria-label="Código de país de WhatsApp"
              onChange={(e) => {
                setPaisWhatsapp(e.target.value as CountryCode);
                setNumeroWhatsapp("");
              }}
              style={{
                width: "125px",
                flexShrink: 0,
                padding: "10px 8px",
                borderRadius: "8px",
                border: "1px solid #D1D5DB",
                background: "#FFFFFF",
                fontSize: "0.88rem",
                fontWeight: 600,
                color: "#111827",
                margin: 0,
              }}
            >
              {PAISES_TELEFONO.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.prefijo} {p.codigo}
                </option>
              ))}
            </select>
            <input
              value={numeroWhatsapp}
              onChange={(e) => alCambiarWhatsapp(e.target.value)}
              type="tel"
              placeholder="Ej: 099 123 4567"
              autoComplete="tel-national"
              required
              style={{ flex: 1, minWidth: 0, margin: 0 }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              cursor: "pointer",
              fontSize: "0.8rem",
              lineHeight: 1.4,
              color: "#374151",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={autorizaWhatsapp}
              onChange={(e) => setAutorizaWhatsapp(e.target.checked)}
              style={{ width: "17px", height: "17px", marginTop: "2px", flexShrink: 0, accentColor: "#059669", cursor: "pointer" }}
            />
            <span>
              Autorizo que me contacten y envíen cotizaciones, estados de pedido e información por WhatsApp conforme a la{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalWhatsappAbierto(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#059669",
                  fontWeight: 800,
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "inherit",
                  fontFamily: "inherit",
                }}
              >
                Cláusula LOPDP de WhatsApp
              </button>
              .
            </span>
          </label>
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

      <ModalTerminosWhatsapp
        abierto={modalWhatsappAbierto}
        alCerrar={() => setModalWhatsappAbierto(false)}
        alAceptar={() => setAutorizaWhatsapp(true)}
      />
    </div>
  );
}
