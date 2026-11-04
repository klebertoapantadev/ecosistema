// PLUX (PagoPlux): lógica pura del botón de pagos, sin Next ni Supabase, para
// que se pueda probar y la compartan la acción de servidor y el componente.
//
// El paybox es un script de PLUX que lee un objeto global `data` y llama a una
// función global `onAuthorize` cuando el pago termina. Lo que devuelve el
// navegador no prueba nada: el pago solo se da por bueno cuando llega el
// webhook (supabase/functions/plux-webhook).

export type AmbientePlux = "PRUEBAS" | "PRODUCCION";

export const SCRIPT_PAYBOX: Record<AmbientePlux, string> = {
  PRUEBAS: "https://sandbox-paybox.pagoplux.com/paybox/index.js",
  PRODUCCION: "https://paybox.pagoplux.com/paybox/index.js",
};

// Versión exigida por la guía del botón (PLUX 4.5, §1).
export const SCRIPT_JQUERY = "https://code.jquery.com/jquery-3.4.1.min.js";

export interface PagoPluxPreparado {
  identificador: string;
  ambiente: AmbientePlux;
  remail: string;
  nombre_comercio: string;
  descripcion: string;
  base_centavos: number;
  iva_centavos: number;
  total_centavos: number;
}

export interface PagadorPlux {
  nombre: string;
  identificacion: string;
  email: string;
  telefono: string;
  direccion: string;
}

export function centavosATexto(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error("Los montos van en centavos enteros");
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// PayboxBase12 es lo que grava IVA CON el IVA incluido; PayboxBase0, lo que no
// lo grava (guía del botón 4.5, §2). Un producto es una cosa o la otra.
export function montosPaybox(p: Pick<PagoPluxPreparado, "base_centavos" | "iva_centavos">) {
  const gravado = p.iva_centavos > 0;
  return {
    PayboxBase0: centavosATexto(gravado ? 0 : p.base_centavos),
    PayboxBase12: centavosATexto(gravado ? p.base_centavos + p.iva_centavos : 0),
  };
}

export function datosPaybox(p: PagoPluxPreparado, pagador: PagadorPlux) {
  const produccion = p.ambiente === "PRODUCCION";
  return {
    PayboxRemail: p.remail,
    PayboxSendmail: pagador.email,
    PayboxRename: p.nombre_comercio,
    PayboxSendname: pagador.nombre,
    ...montosPaybox(p),
    PayboxDescription: p.descripcion.slice(0, 120),
    PayboxLanguage: "es",
    PayboxDirection: pagador.direccion,
    PayBoxClientPhone: pagador.telefono,
    PayBoxClientIdentification: pagador.identificacion,
    PayboxProduction: produccion,
    PayboxEnvironment: produccion ? "prod" : "sandbox",
    PayboxRecurrent: false,
    PayboxPagoPlux: false,
    // Vuelve en el webhook como `extras`: liga el pago a com_transaccion_pago.
    PayboxExtras: p.identificador,
    PayboxPermitirDatosAdicionales: true,
  };
}

// El paybox llama a onAuthorize también al cerrarse el modal, con
// { status: "failed", description: "Paybox cerrado" }, incluso después de un
// pago bueno. La guía escribe "succeded" y el script envía "succeeded".
export function respuestaExitosa(respuesta: unknown): boolean {
  const status = (respuesta as { status?: unknown } | null)?.status;
  return typeof status === "string" && status.toLowerCase().startsWith("succe");
}
