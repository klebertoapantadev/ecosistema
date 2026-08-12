"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { completarBienvenida } from "../acciones";
import { PAISES_TELEFONO, PAIS_TELEFONO_DEFECTO } from "../paises";
import { ModalTerminosWhatsapp } from "./ModalTerminosWhatsapp";

interface Props {
  nombresIniciales: string;
  apellidosIniciales: string;
  intencion?: string;
  destinoFinal?: string;
}

export function FormularioBienvenida({ nombresIniciales, apellidosIniciales, intencion = "", destinoFinal = "" }: Props) {
  const router = useRouter();
  const [nombres, setNombres] = useState(nombresIniciales);
  const [apellidos, setApellidos] = useState(apellidosIniciales);
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(false);
  const [aceptaTerminosWhatsapp, setAceptaTerminosWhatsapp] = useState(false);
  const [modalWhatsappAbierto, setModalWhatsappAbierto] = useState(false);
  const [paisWhatsapp, setPaisWhatsapp] = useState<CountryCode>(PAIS_TELEFONO_DEFECTO);
  const [numeroWhatsapp, setNumeroWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const esAbogado = intencion === "abogado" || destinoFinal.includes("solicitud-socio");
  const paisSeleccionado = PAISES_TELEFONO.find((p) => p.codigo === paisWhatsapp)!;

  function alCambiarNumero(valor: string) {
    setNumeroWhatsapp(new AsYouType(paisWhatsapp).input(valor));
  }

  function toggleAutorizaWhatsapp(chequeado: boolean) {
    setAutorizaWhatsapp(chequeado);
    if (chequeado && !aceptaTerminosWhatsapp) {
      setModalWhatsappAbierto(true);
    }
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let whatsapp = "";
    if (autorizaWhatsapp) {
      if (!aceptaTerminosWhatsapp) {
        setModalWhatsappAbierto(true);
        return;
      }
      if (!isValidPhoneNumber(numeroWhatsapp, paisWhatsapp)) {
        setError(`Ingresa un número de WhatsApp válido de ${paisSeleccionado.nombre}`);
        return;
      }
      whatsapp = parsePhoneNumberFromString(numeroWhatsapp, paisWhatsapp)!.number;
    }

    setCargando(true);
    const resultado = await completarBienvenida({ nombres, apellidos, autorizaWhatsapp, whatsapp });
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    if (esAbogado) {
      document.cookie = `tranqi_modo_rol=abogado; path=/; max-age=86400`;
      document.cookie = `tranqi_rol_favorito=abogado; path=/; max-age=86400`;
    }

    const destinoTarget = destinoFinal || (esAbogado ? "/panel/solicitud-socio" : "/panel");
    router.push(destinoTarget);
    router.refresh();
  }

  return (
    <form onSubmit={alEnviar} className="form-auth">
      <label className="etiqueta-campo">
        ¿Cómo quieres que te llamemos?
        <input value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Nombres" required />
      </label>
      <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" required />

      <div style={{ margin: "16px 0 8px 0" }}>
        <label className="campo-check" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={autorizaWhatsapp}
            onChange={(e) => toggleAutorizaWhatsapp(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#5000BA" }}
          />
          <span>¿Podemos contactarte por WhatsApp?</span>
        </label>
      </div>

      {autorizaWhatsapp && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#F9FAFB", padding: "14px", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "12px" }}>
          <div className="campo-telefono" style={{ margin: 0 }}>
            <select
              value={paisWhatsapp}
              onChange={(e) => {
                setPaisWhatsapp(e.target.value as CountryCode);
                setNumeroWhatsapp("");
              }}
            >
              {PAISES_TELEFONO.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.prefijo} {p.nombre}
                </option>
              ))}
            </select>
            <input
              value={numeroWhatsapp}
              onChange={(e) => alCambiarNumero(e.target.value)}
              type="tel"
              placeholder="Número de WhatsApp"
              autoComplete="tel-national"
              required
            />
          </div>

          <label
            style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.8rem", color: "#374151", fontWeight: 600 }}
            onClick={(e) => {
              e.preventDefault();
              setModalWhatsappAbierto(true);
            }}
          >
            <input
              type="checkbox"
              checked={aceptaTerminosWhatsapp}
              readOnly
              style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "#059669" }}
            />
            <span>
              Autorizo expresamente la{" "}
              <span style={{ color: "#059669", fontWeight: 800, textDecoration: "underline" }}>
                Cláusula LOPDP para Notificaciones y Contacto por WhatsApp
              </span>
            </span>
          </label>

          {!aceptaTerminosWhatsapp && (
            <p style={{ fontSize: "0.76rem", color: "#DC2626", fontWeight: 700, margin: 0 }}>
              ⚠️ Debes leer y autorizar la cláusula de WhatsApp hasta el final para guardar tu teléfono.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="error-auth" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-auth btn-primario"
        disabled={cargando || (autorizaWhatsapp && !aceptaTerminosWhatsapp)}
        style={{
          width: "100%",
          padding: "14px 24px",
          background: (autorizaWhatsapp && !aceptaTerminosWhatsapp)
            ? "#D1D5DB"
            : "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)",
          color: (autorizaWhatsapp && !aceptaTerminosWhatsapp) ? "#6B7280" : "#ffffff",
          border: "none",
          borderRadius: "12px",
          fontWeight: 800,
          fontSize: "0.98rem",
          cursor: (cargando || (autorizaWhatsapp && !aceptaTerminosWhatsapp)) ? "not-allowed" : "pointer",
          boxShadow: (autorizaWhatsapp && !aceptaTerminosWhatsapp) ? "none" : "0 4px 16px rgba(80, 0, 186, 0.3)",
          transition: "all 0.2s ease",
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {cargando ? "Guardando..." : esAbogado ? "Continuar al Registro de Abogado ➔" : "Continuar"}
      </button>

      <ModalTerminosWhatsapp
        abierto={modalWhatsappAbierto}
        alCerrar={() => setModalWhatsappAbierto(false)}
        alAceptar={() => setAceptaTerminosWhatsapp(true)}
      />
    </form>
  );
}
