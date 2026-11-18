"use client";
import { SelectConBuscador } from "@eco/datagrid";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { completarBienvenida } from "../acciones";
import { PAISES_TELEFONO, PAIS_TELEFONO_DEFECTO } from "../paises";
import { ModalTerminosWhatsapp } from "./ModalTerminosWhatsapp";

interface Props {
  nombresIniciales: string;
  apellidosIniciales: string;
  negocio?: string;
  intencion?: string;
  destinoFinal?: string;
}

export function FormularioBienvenida({
  nombresIniciales,
  apellidosIniciales,
  negocio = "tranqi",
  intencion = "",
  destinoFinal = "",
}: Props) {
  const router = useRouter();
  const [nombres, setNombres] = useState(nombresIniciales);
  const [apellidos, setApellidos] = useState(apellidosIniciales);
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(true);
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
    if (!chequeado) {
      setNumeroWhatsapp("");
      setAceptaTerminosWhatsapp(false);
    }
  }

  const puedeEnviar =
    !cargando &&
    nombres.trim() !== "" &&
    apellidos.trim() !== "" &&
    (!autorizaWhatsapp || (numeroWhatsapp.trim() !== "" && aceptaTerminosWhatsapp));

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
    const resultado = await completarBienvenida({ nombres, apellidos, autorizaWhatsapp, whatsapp }, negocio);
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
          <span>Registrar mi WhatsApp para cotizaciones y seguimiento</span>
        </label>
      </div>

      {autorizaWhatsapp && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#F9FAFB", padding: "14px", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
            <SelectConBuscador
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
            </SelectConBuscador>
            <input
              value={numeroWhatsapp}
              onChange={(e) => alCambiarNumero(e.target.value)}
              type="tel"
              placeholder="Ej: 099 123 4567"
              autoComplete="tel-national"
              style={{ flex: 1, minWidth: 0, margin: 0 }}
            />
          </div>

          <label
            style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.8rem", color: "#374151", fontWeight: 600 }}
          >
            <input
              type="checkbox"
              checked={aceptaTerminosWhatsapp}
              onChange={(e) => setAceptaTerminosWhatsapp(e.target.checked)}
              style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0, accentColor: "#059669", cursor: "pointer" }}
            />
            <span>
              Autorizo que me contacten y envíen cotizaciones e información por WhatsApp conforme a la{" "}
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

          {!aceptaTerminosWhatsapp && (
            <p style={{ fontSize: "0.76rem", color: "#DC2626", fontWeight: 700, margin: 0 }}>
              Marca la autorización LOPDP para guardar tu número de WhatsApp (o desmarca la opción si prefieres omitirlo).
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
        disabled={!puedeEnviar}
        style={{
          width: "100%",
          padding: "14px 24px",
          background: puedeEnviar
            ? "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)"
            : "#D1D5DB",
          color: puedeEnviar ? "#ffffff" : "#6B7280",
          border: "none",
          borderRadius: "12px",
          fontWeight: 800,
          fontSize: "0.98rem",
          cursor: puedeEnviar ? "pointer" : "not-allowed",
          boxShadow: puedeEnviar ? "0 4px 16px rgba(80, 0, 186, 0.3)" : "none",
          transition: "all 0.2s ease",
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {cargando ? "Guardando..." : esAbogado ? "Continuar al Registro de Abogado " : "Continuar"}
      </button>

      <ModalTerminosWhatsapp
        abierto={modalWhatsappAbierto}
        alCerrar={() => setModalWhatsappAbierto(false)}
        alAceptar={() => setAceptaTerminosWhatsapp(true)}
      />
    </form>
  );
}
