"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { completarBienvenida } from "../acciones";
import { PAISES_TELEFONO, PAIS_TELEFONO_DEFECTO } from "../paises";

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
  const [paisWhatsapp, setPaisWhatsapp] = useState<CountryCode>(PAIS_TELEFONO_DEFECTO);
  const [numeroWhatsapp, setNumeroWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const esAbogado = intencion === "abogado" || destinoFinal.includes("solicitud-socio");
  const paisSeleccionado = PAISES_TELEFONO.find((p) => p.codigo === paisWhatsapp)!;

  function alCambiarNumero(valor: string) {
    setNumeroWhatsapp(new AsYouType(paisWhatsapp).input(valor));
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let whatsapp = "";
    if (autorizaWhatsapp) {
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

      <label className="campo-check">
        <input type="checkbox" checked={autorizaWhatsapp} onChange={(e) => setAutorizaWhatsapp(e.target.checked)} />
        ¿Podemos contactarte por WhatsApp?
      </label>

      {autorizaWhatsapp && (
        <div className="campo-telefono">
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
      )}

      {error && (
        <p className="error-auth" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-auth" disabled={cargando}>
        {cargando ? "Guardando..." : esAbogado ? "Continuar al Registro de Abogado ➔" : "Continuar"}
      </button>
    </form>
  );
}
