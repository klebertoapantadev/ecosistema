// Versión oscura de un color según su PAPEL (fondo, texto o borde).
//
// Un mismo hex no puede tener una sola versión oscura: #5000BA como fondo de
// botón debe quedarse (lleva texto blanco encima) y como texto sobre tarjeta
// blanca debe aclararse (sobre noche no se lee). Por eso el codemod anota el
// papel según la propiedad CSS donde aparece y aquí se decide por papel.
//
// Todo en OKLCH: L es luminosidad percibida (0 negro, 1 blanco), C croma,
// h tono. Se conserva el tono siempre; lo que se mueve es L (y se recorta C
// donde un pastel oscurecido saldría chillón).
//
// Devuelve null cuando el color se queda igual en oscuro: el codemod entonces
// no lo toca (menos variables, y es la señal para el texto que va encima).

const NEUTRO = 0.035; // croma por debajo de esto se trata como gris

export function oscuro(papel, rgba) {
  const [r, g, b, a = 1] = rgba;
  // blanco translúcido por debajo de 0,5 es un velo sobre una superficie de
  // color (tarjeta violeta, rail): se queda; por encima es "cristal" y se oscurece
  if (papel === "fondo" && esBlanco(r, g, b) && a < 0.5) return null;
  // borde blanco translúcido: filete sobre superficie de color, igual en los dos temas
  if (papel === "borde" && esBlanco(r, g, b) && a < 1) return null;
  // negro translúcido como borde o texto: el mismo velo, pero claro
  if ((papel === "borde" || papel === "texto") && esNegro(r, g, b) && a < 1) return [255, 255, 255, a];

  let [L, C, h] = rgbAOklch(r, g, b);
  const neutro = C < NEUTRO;

  if (papel === "fondo") {
    if (neutro) {
      if (L < 0.6) return null; // fondos oscuros (cabeceras, botones negros) se quedan
      // tarjeta blanca 0.215 > papel de página (token, 0.165): en oscuro la
      // elevación se lee aclarando, no oscureciendo
      L = L >= 0.95 ? 0.215 - (1 - L) * 0.5 : 0.19 + (0.95 - L) * 0.5;
    } else {
      if (!(L >= 0.88 && C < 0.12)) return null; // saturados y medios: marca, se quedan
      L = 0.27; C = Math.min(C * 0.9, 0.05); // pastel → tinta oscura del mismo tono
    }
  } else if (papel === "texto") {
    if (L >= 0.75) return null; // texto claro (blanco sobre botón) se queda
    if (neutro) L = clamp(1.13 - 0.93 * L, 0.62, 0.95);
    else { L = Math.max(0.74, 1.13 - 0.93 * L); C = Math.min(C, 0.17); }
  } else if (papel === "borde") {
    // borde blanco = anillo que separa del fondo: en oscuro, el color de la tarjeta
    if (neutro) L = L >= 0.97 ? 0.215 : L >= 0.6 ? 0.32 + (0.95 - L) * 0.3 : 0.45;
    else {
      if (!(L >= 0.6 && C < 0.12)) return null;
      L = 0.36; C = Math.min(C, 0.06);
    }
  } else return null;

  const [r2, g2, b2] = oklchARgb(L, C, h);
  return [r2, g2, b2, a];
}

const esBlanco = (r, g, b) => r > 245 && g > 245 && b > 245;
const esNegro = (r, g, b) => r < 20 && g < 20 && b < 20;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ── conversión sRGB ↔ OKLCH (Björn Ottosson) ──────────────────────────
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(clamp(v, 0, 1) * 255); };

export function rgbAOklch(r, g, b) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, Bb), Math.atan2(Bb, A)];
}

export function oklchARgb(L, C, h) {
  // si el color cae fuera de sRGB se baja el croma hasta que entre
  for (let c = C; c >= 0; c -= 0.005) {
    const A = c * Math.cos(h), Bb = c * Math.sin(h);
    const l = (L + 0.3963377774 * A + 0.2158037573 * Bb) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * Bb) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * Bb) ** 3;
    const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if ([R, G, B].every((v) => v >= -0.001 && v <= 1.001)) return [gam(R), gam(G), gam(B)];
  }
  return [0, 0, 0];
}

export const aHex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
export const aCss = (c) => (c[3] === undefined || c[3] >= 1 ? aHex(c) : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${+c[3].toFixed(3)})`);
