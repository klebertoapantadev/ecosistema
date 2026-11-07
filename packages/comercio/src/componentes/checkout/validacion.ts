// Validación de los datos de facturación del checkout (SRI Ecuador).
//
// Solo la cédula se comprueba a fondo (módulo 10): es un algoritmo estable y
// conocido. El RUC se valida por forma y no por dígito verificador, porque el
// SRI emite RUC de sociedades que no cumplen el módulo 11 clásico y rechazar a
// un cliente con un RUC real sería peor que dejar pasar uno mal escrito.

export type TipoIdentificacion = "cedula" | "ruc" | "pasaporte";

export type CampoFacturacion = "identificacion" | "razonSocial" | "email" | "telefono" | "direccion";

const PROVINCIA_MAXIMA = 24;
const PROVINCIA_EXTRANJEROS = 30;

function provinciaValida(digitos: string): boolean {
  const provincia = Number(digitos.slice(0, 2));
  return (provincia >= 1 && provincia <= PROVINCIA_MAXIMA) || provincia === PROVINCIA_EXTRANJEROS;
}

export function cedulaValida(valor: string): boolean {
  const c = valor.trim();
  if (!/^\d{10}$/.test(c) || !provinciaValida(c) || Number(c[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  return (10 - (suma % 10)) % 10 === Number(c[9]);
}

export function rucValido(valor: string): boolean {
  const r = valor.trim();
  if (!/^\d{13}$/.test(r) || !provinciaValida(r) || r.endsWith("000")) return false;
  const tercero = Number(r[2]);
  // 0-5 persona natural (cédula + establecimiento), 6 entidad pública, 9 sociedad.
  if (tercero <= 5) return cedulaValida(r.slice(0, 10));
  return tercero === 6 || tercero === 9;
}

export function pasaporteValido(valor: string): boolean {
  return /^[A-Za-z0-9]{5,20}$/.test(valor.trim());
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^\+?[\d\s-]{7,16}$/;

/**
 * Devuelve el mensaje de error del campo o `null` si es válido. `direccion`
 * solo es obligatoria cuando la pasarela la exige (PLUX).
 */
export function errorCampo(
  campo: CampoFacturacion,
  valor: string,
  opciones: { tipoIdentificacion: TipoIdentificacion; direccionObligatoria: boolean },
): string | null {
  const v = valor.trim();
  switch (campo) {
    case "identificacion":
      if (!v) return "Escribe tu número de documento.";
      if (opciones.tipoIdentificacion === "cedula" && !cedulaValida(v)) return "Revisa tu cédula: deben ser 10 dígitos válidos.";
      if (opciones.tipoIdentificacion === "ruc" && !rucValido(v)) return "Revisa tu RUC: deben ser 13 dígitos.";
      if (opciones.tipoIdentificacion === "pasaporte" && !pasaporteValido(v)) return "Revisa tu pasaporte: letras y números, sin espacios.";
      return null;
    // Máximos alineados con esquemaPagador de PLUX (acciones-plux.ts).
    case "razonSocial":
      if (v.length > 120) return "Máximo 120 caracteres.";
      return v.length >= 3 ? null : "Escribe el nombre o la razón social.";
    case "email":
      if (v.length > 120) return "Máximo 120 caracteres.";
      return CORREO.test(v) ? null : "Escribe un correo válido.";
    case "telefono":
      return TELEFONO.test(v) && v.replace(/\D/g, "").length >= 7 && v.length <= 20 ? null : "Escribe un teléfono válido.";
    case "direccion":
      if (v.length > 200) return "Máximo 200 caracteres.";
      if (!opciones.direccionObligatoria) return null;
      return v.length >= 5 ? null : "La pasarela exige una dirección.";
  }
}

export function normalizarTipoIdentificacion(valor: string | null | undefined): TipoIdentificacion {
  return valor === "ruc" || valor === "pasaporte" ? valor : "cedula";
}
