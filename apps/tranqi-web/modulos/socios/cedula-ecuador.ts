/**
 * Validación de cédula ecuatoriana (TRQ-ABG-005 regla 1).
 *
 * La cédula tiene un dígito verificador calculado con el algoritmo módulo 10,
 * así que un número mal tecleado o inventado se detecta **sin consultar a
 * nadie**: ni al Registro Civil, ni a una IA. Es la primera barrera y la más
 * barata, y por eso va antes que cualquier análisis de imagen.
 *
 * Lo que esto NO hace, y conviene tener claro: comprobar que el número es
 * *formalmente válido* no dice que exista, ni que sea de quien dice serlo. Eso
 * lo verifica el cotejo con el documento y, en última instancia, el operador
 * contra las fuentes oficiales (Registro Civil, SENESCYT, Foro de Abogados).
 */

/** Las 24 provincias, más 30 (consulados) y 50 (refugiados). */
const CODIGO_PROVINCIA_MAX = 24;
const CODIGOS_ESPECIALES = new Set([30, 50]);

export interface ResultadoCedula {
  valida: boolean;
  motivo?: string;
  /** Código de provincia de emisión, si el número es válido. */
  provincia?: number;
}

export function validarCedulaEcuatoriana(entrada: string): ResultadoCedula {
  const cedula = (entrada ?? "").replace(/\D/g, "");

  if (cedula.length !== 10) {
    return { valida: false, motivo: "La cédula debe tener exactamente 10 dígitos." };
  }

  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= CODIGO_PROVINCIA_MAX) || CODIGOS_ESPECIALES.has(provincia))) {
    return { valida: false, motivo: `El código de provincia «${cedula.slice(0, 2)}» no existe.` };
  }

  // El tercer dígito distingue el tipo. De 0 a 5 son personas naturales; 6 y 9
  // corresponden a sociedades y entidades públicas, que no son una cédula.
  const tercero = Number(cedula[2]);
  if (tercero > 5) {
    return { valida: false, motivo: "Ese número no corresponde a una cédula de persona natural." };
  }

  // Módulo 10: se duplican los dígitos en posición impar (1.ª, 3.ª, 5.ª…) y si
  // el doble pasa de 9 se le restan 9. El verificador es lo que falta para la
  // decena superior.
  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    const digito = Number(cedula[i]);
    if (i % 2 === 0) {
      const doble = digito * 2;
      suma += doble > 9 ? doble - 9 : doble;
    } else {
      suma += digito;
    }
  }

  const decenaSuperior = Math.ceil(suma / 10) * 10;
  const esperado = decenaSuperior - suma === 10 ? 0 : decenaSuperior - suma;

  if (esperado !== Number(cedula[9])) {
    return { valida: false, motivo: "El dígito verificador no cuadra: revisa el número." };
  }

  return { valida: true, provincia };
}

/**
 * La misma validación, pero con el contrato que necesita un formulario mientras
 * el usuario teclea: un campo vacío no es un error todavía, y un RUC de 13
 * dígitos es una identificación legítima aunque no sea una cédula.
 *
 * Existe para que el formulario y el servidor compartan algoritmo. Antes había
 * dos implementaciones del módulo 10 —una aquí y otra dentro de
 * `FormularioSolicitudSocio.tsx`— y dos copias de la misma regla acaban
 * divergiendo justo cuando importa.
 */
export function validarIdentificacion(valor: string): { esValida: boolean; advertencia?: string } {
  const c = (valor ?? "").trim();

  // Mientras no haya escrito nada no hay nada que reprochar.
  if (!c) return { esValida: true };
  if (!/^\d+$/.test(c)) return { esValida: false, advertencia: "La cédula solo debe contener dígitos numéricos." };
  if (c.length < 10) {
    return { esValida: false, advertencia: `Faltan ${10 - c.length} dígitos para completar la cédula (10 dígitos).` };
  }
  // RUC: los 10 primeros dígitos son la cédula y los tres últimos el
  // establecimiento. Se valida la parte que se puede validar.
  if (c.length > 10) {
    const base = validarCedulaEcuatoriana(c.slice(0, 10));
    return base.valida
      ? { esValida: true }
      : { esValida: false, advertencia: base.motivo };
  }

  const r = validarCedulaEcuatoriana(c);
  return r.valida ? { esValida: true } : { esValida: false, advertencia: r.motivo };
}

/**
 * Compara dos nombres de persona y devuelve cuánto se parecen, de 0 a 1.
 *
 * Nombres compuestos, tildes, orden de apellidos y segundos nombres omitidos
 * son la norma, no la excepción: «Carlos Alberto Pérez Mena» y «PEREZ MENA
 * CARLOS» son la misma persona. Por eso no se comparan cadenas, se comparan
 * conjuntos de palabras, y se mide qué porcentaje de las palabras del nombre
 * más corto aparece en el otro.
 */
export function similitudNombres(a: string, b: string): number {
  const normalizar = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z\s]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1); // fuera iniciales sueltas y basura

  const pa = normalizar(a);
  const pb = normalizar(b);
  if (pa.length === 0 || pb.length === 0) return 0;

  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  const disponibles = [...largo];
  let coincidencias = 0;

  for (const palabra of corto) {
    const i = disponibles.indexOf(palabra);
    if (i >= 0) {
      coincidencias += 1;
      disponibles.splice(i, 1); // una palabra del otro nombre solo cuenta una vez
    }
  }

  return coincidencias / corto.length;
}

/** Los tres tramos del semáforo de confianza (TRQ-ABG-005 regla 3). */
export type NivelConfianza = "APROBADO" | "OBSERVACION" | "RECHAZADO";

export const UMBRAL_APROBADO = 0.9;
export const UMBRAL_OBSERVACION = 0.7;

export function nivelDeConfianza(score: number): NivelConfianza {
  if (score >= UMBRAL_APROBADO) return "APROBADO";
  if (score >= UMBRAL_OBSERVACION) return "OBSERVACION";
  return "RECHAZADO";
}
