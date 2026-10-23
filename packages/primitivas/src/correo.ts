/**
 * Validación robusta de correo electrónico para el Ecosistema.
 * Verifica sintaxis RFC, estructura de etiquetas, TLD y detecta errores tipográficos comunes en dominios (ej. gmailc.om, .con).
 */

export interface ResultadoValidacionCorreo {
  esValido: boolean;
  error?: string;
  sugerencia?: string;
  correoNormalizado?: string;
}

const DOMINIOS_TYPO: Record<string, string> = {
  // Gmail typos
  "gmailc.om": "gmail.com",
  "gmail.con": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmaild.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmaik.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmail.om": "gmail.com",
  "gmai.co": "gmail.com",
  "gmaill.co": "gmail.com",
  // Hotmail typos
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmial.con": "hotmail.com",
  "hormail.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.om": "hotmail.com",
  // Outlook typos
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlok.es": "outlook.es",
  "outlook.con": "outlook.com",
  // Yahoo typos
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yaho.es": "yahoo.es",
  "yahoo.con": "yahoo.com",
  // iCloud typos
  "iclod.com": "icloud.com",
  "icluod.com": "icloud.com"
};

export function validarCorreoEstructurado(emailRaw: unknown): ResultadoValidacionCorreo {
  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return { esValido: false, error: "El correo electrónico es obligatorio." };
  }

  const email = emailRaw.trim().toLowerCase();

  // Longitud mínima (a@b.co) y máxima
  if (email.length < 5 || email.length > 254) {
    return { esValido: false, error: "El correo debe tener entre 5 y 254 caracteres." };
  }

  // Exactamente un símbolo @
  const partes = email.split("@");
  if (partes.length !== 2) {
    return { esValido: false, error: "El correo debe contener exactamente un símbolo '@'." };
  }

  const [usuario, dominio] = partes;

  // Validaciones del usuario
  if (!usuario || usuario.length > 64) {
    return { esValido: false, error: "La parte del usuario antes del '@' no es válida." };
  }
  if (usuario.startsWith(".") || usuario.endsWith(".")) {
    return { esValido: false, error: "El nombre de usuario no puede iniciar ni terminar con un punto." };
  }
  if (usuario.includes("..")) {
    return { esValido: false, error: "El nombre de usuario no puede contener puntos consecutivos." };
  }
  const regexUsuario = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
  if (!regexUsuario.test(usuario)) {
    return { esValido: false, error: "El correo contiene caracteres no permitidos antes del '@'." };
  }

  // Validaciones del dominio
  if (!dominio || dominio.length > 253) {
    return { esValido: false, error: "El dominio del correo no es válido." };
  }
  if (dominio.startsWith(".") || dominio.endsWith(".") || dominio.startsWith("-") || dominio.endsWith("-")) {
    return { esValido: false, error: "El dominio del correo tiene un formato inválido." };
  }
  if (dominio.includes("..")) {
    return { esValido: false, error: "El dominio no puede tener puntos consecutivos." };
  }

  // Detección directa de typos de dominio conocidos (ej. gmailc.om)
  if (DOMINIOS_TYPO[dominio]) {
    const sugerido = `${usuario}@${DOMINIOS_TYPO[dominio]}`;
    return {
      esValido: false,
      error: `El dominio '@${dominio}' parece incorrecto. ¿Quisiste decir '@${DOMINIOS_TYPO[dominio]}'?`,
      sugerencia: sugerido
    };
  }

  // Estructura de etiquetas
  const etiquetas = dominio.split(".");
  if (etiquetas.length < 2) {
    return { esValido: false, error: "El dominio del correo debe incluir una extensión (ej. .com, .ec)." };
  }

  for (const etiqueta of etiquetas) {
    if (!etiqueta || etiqueta.length > 63) {
      return { esValido: false, error: "El dominio contiene segmentos inválidos." };
    }
    if (etiqueta.startsWith("-") || etiqueta.endsWith("-")) {
      return { esValido: false, error: "Los segmentos del dominio no pueden iniciar ni terminar con guion." };
    }
    if (!/^[a-z0-9-]+$/.test(etiqueta)) {
      return { esValido: false, error: "El dominio contiene caracteres no válidos." };
    }
  }

  const tld = etiquetas[etiquetas.length - 1] ?? "";

  // El TLD debe ser alfabético y de 2 a 24 caracteres (no numérico)
  if (!tld || !/^[a-z]{2,24}$/.test(tld)) {
    return { esValido: false, error: `La extensión del correo '.${tld}' no es válida.` };
  }

  // Verificación de TLD típico mal escrito como .con
  if (tld === "con") {
    const dominioCorregido = dominio.replace(/\.con$/, ".com");
    return {
      esValido: false,
      error: "El correo termina en '.con' en lugar de '.com'. Por favor verifica la escritura.",
      sugerencia: `${usuario}@${dominioCorregido}`
    };
  }

  return {
    esValido: true,
    correoNormalizado: email
  };
}
