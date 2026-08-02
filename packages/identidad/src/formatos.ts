// Funciones puras de formato compartidas para componentes de cliente y servidor
export function etiquetaDispositivo(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";

  let sistema = "Dispositivo";
  if (/windows/i.test(userAgent)) sistema = "Windows";
  else if (/mac os|macintosh/i.test(userAgent)) sistema = "Mac";
  else if (/android/i.test(userAgent)) sistema = "Android";
  else if (/iphone|ipad|ios/i.test(userAgent)) sistema = "iOS";
  else if (/linux/i.test(userAgent)) sistema = "Linux";

  let navegador = "";
  if (/edg\//i.test(userAgent)) navegador = "Edge";
  else if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) navegador = "Chrome";
  else if (/firefox\//i.test(userAgent)) navegador = "Firefox";
  else if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) navegador = "Safari";

  return navegador ? `${navegador} en ${sistema}` : sistema;
}

const NOMBRES_NEGOCIO: Record<string, string> = {
  tranqi: "Tranqi",
  fastfix: "FastFix Home",
  tinkay: "Tinkay",
  margaritas: "Margaritas",
};

export function etiquetaNegocio(negocio: string | null): string | null {
  if (!negocio) return null;
  return NOMBRES_NEGOCIO[negocio] ?? negocio;
}
