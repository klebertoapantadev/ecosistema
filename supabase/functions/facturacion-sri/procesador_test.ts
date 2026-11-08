// Máquina de estados del worker con dobles: sin red, sin base y sin Storage.
// El XML se genera y se firma de verdad con un .p12 de prueba.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { encodeBase64 } from "jsr:@std/encoding@1.0.10/base64";
import { generarClaveAcceso } from "../_compartido/sri/clave-acceso.ts";
import type { RespuestaAutorizacion, RespuestaRecepcion } from "../_compartido/sri/comprobante.ts";
import { crearP12 } from "../_compartido/sri/pruebas/certificado-prueba.ts";
import { SriNoDisponible } from "../_compartido/sri/soap.ts";
import { type Dependencias, type ItemCola, Procesador } from "./procesador.ts";

const p12 = crearP12();
const AHORA = new Date("2026-11-08T15:00:00Z");
const RUC = "0993381762001";

function item(parcial: Partial<ItemCola["comprobante"]> = {}, total = 10): ItemCola {
  const numero = parcial.cmp_numero ?? 7;
  const ambiente = parcial.cmp_ambiente ?? 1;
  return {
    comprobante: {
      cmp_id: "c-1",
      cmp_negocio: "tranqi",
      cmp_tipo: "01",
      cmp_estado: "PENDIENTE",
      cmp_ambiente: ambiente,
      cmp_establecimiento: "001",
      cmp_punto_emision: "001",
      cmp_numero: numero,
      cmp_clave_acceso: generarClaveAcceso({
        fechaEmision: "2026-11-08", tipo: "01", ruc: RUC, ambiente,
        establecimiento: "001", puntoEmision: "001", numero, codigoNumerico: "12345678",
      }),
      cmp_fecha_emision: "2026-11-08",
      cmp_comprador: {
        tipo_identificacion: "05", identificacion: "1710034065", razon_social: "Maria Perez",
        direccion: null, correo: "maria@ejemplo.com", telefono: null,
      },
      cmp_formas_pago: [{ forma_pago: "19", total: null }],
      cmp_info_adicional: [],
      cmp_motivo: null,
      cmp_intentos: 0,
      cmp_emitido_en: "2026-11-08T14:59:00Z",
      ...parcial,
    },
    lineas: [{
      lin_orden: 1, lin_codigo: "PLAN", lin_codigo_auxiliar: null, lin_descripcion: "Plan mensual",
      lin_cantidad: "1", lin_precio_unitario: String(total), lin_descuento: "0", lin_codigo_iva: "4", lin_detalle_linea: [],
    }],
    emisor: {
      emi_ruc: RUC, emi_razon_social: "TRANQI S.A.S.", emi_nombre_comercial: "Tranqi",
      emi_direccion_matriz: "Quito", emi_direccion_establecimiento: null, emi_obligado_contabilidad: true,
      emi_contribuyente_especial: null, emi_agente_retencion: null, emi_regimen: "GENERAL",
      emi_certificado_id: "cert-1", emi_correo_copia: null,
    },
    modifica: null,
  };
}

const recibida: RespuestaRecepcion = { estado: "RECIBIDA", mensajes: [] };
const autorizado = (clave: string): RespuestaAutorizacion => ({
  autorizaciones: [{
    estado: "AUTORIZADO", numeroAutorizacion: clave, fechaAutorizacion: "2026-11-08T10:00:05-05:00",
    ambiente: "PRUEBAS", comprobanteXml: '<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante"/>', mensajes: [],
  }],
});

interface Registro {
  resultados: { id: string; cambios: Record<string, unknown>; evento?: string }[];
  correos: { enviado: boolean; detalle: Record<string, unknown> }[];
  subidas: string[];
  enviados: string[];
  consultas: number;
}

function dobles(opciones: {
  recepcion?: () => Promise<RespuestaRecepcion>;
  autorizacion?: (clave: string) => Promise<RespuestaAutorizacion>;
  subir?: () => Promise<void>;
  smtp?: boolean;
  permitirProduccion?: boolean;
} = {}): { dep: Dependencias; r: Registro } {
  const r: Registro = { resultados: [], correos: [], subidas: [], enviados: [], consultas: 0 };
  const dep: Dependencias = {
    tomarLote: () => Promise.resolve([]),
    registrarResultado: (id, cambios, evento) => {
      r.resultados.push({ id, cambios, evento });
      return Promise.resolve();
    },
    registrarCorreo: (_id, enviado, detalle) => {
      r.correos.push({ enviado, detalle });
      return Promise.resolve();
    },
    obtenerCertificado: () => Promise.resolve({ p12Base64: encodeBase64(p12.bytes), clave: "clave secreta" }),
    subir: async (ruta) => {
      await (opciones.subir?.() ?? Promise.resolve());
      r.subidas.push(ruta);
    },
    enviarCorreo: () => Promise.resolve(opciones.smtp === false ? "sin_smtp" : "enviado"),
    recepcion: (_ambiente, xml) => {
      r.enviados.push(xml);
      return opciones.recepcion?.() ?? Promise.resolve(recibida);
    },
    autorizacion: (_ambiente, clave) => {
      r.consultas++;
      return opciones.autorizacion?.(clave) ?? Promise.resolve(autorizado(clave));
    },
    ahora: () => AHORA,
    esperar: () => Promise.resolve(),
    permitirProduccion: opciones.permitirProduccion ?? false,
  };
  return { dep, r };
}

const estados = (r: Registro) => r.resultados.map((x) => x.cambios.estado ?? "(igual)");

Deno.test("procesador: PENDIENTE → RECIBIDO → AUTORIZADO con XML, RIDE y correo", async () => {
  const { dep, r } = dobles();
  const it = item();
  await new Procesador(dep).procesar(it);
  assertEquals(estados(r), ["RECIBIDO", "AUTORIZADO"]);
  assertEquals(r.resultados[0].cambios.importe_total, "11.50");
  assertEquals(r.resultados[0].cambios.formas_pago, [{ forma_pago: "19", total: "11.50", plazo: null, unidad_tiempo: null }]);
  assertStringIncludes(r.enviados[0], "</ds:Signature></factura>");
  assertStringIncludes(r.enviados[0], `<claveAcceso>${it.comprobante.cmp_clave_acceso}</claveAcceso>`);
  assertEquals(r.subidas, [
    `tranqi/1/2026/${it.comprobante.cmp_clave_acceso}.xml`,
    `tranqi/1/2026/${it.comprobante.cmp_clave_acceso}.pdf`,
  ]);
  assertEquals(r.resultados[1].cambios.xml_ruta, r.subidas[0]);
  assertEquals(r.correos, [{ enviado: true, detalle: { para: "maria@ejemplo.com", resultado: "enviado" } }]);
});

Deno.test("procesador: DEVUELTA del SRI → DEVUELTO con sus mensajes", async () => {
  const mensajes = [{ identificador: "35", mensaje: "ARCHIVO NO CUMPLE ESTRUCTURA XML", informacionAdicional: null, tipo: "ERROR" }];
  const { dep, r } = dobles({ recepcion: () => Promise.resolve({ estado: "DEVUELTA", mensajes }) });
  await new Procesador(dep).procesar(item());
  assertEquals(estados(r), ["DEVUELTO"]);
  assertEquals(r.resultados[0].cambios.mensajes_sri, mensajes);
  assertEquals(r.consultas, 0);
});

Deno.test("procesador: DEVUELTA 43 (clave ya registrada) pasa a consultar la autorización", async () => {
  const { dep, r } = dobles({
    recepcion: () =>
      Promise.resolve({
        estado: "DEVUELTA",
        mensajes: [{ identificador: "43", mensaje: "CLAVE ACCESO REGISTRADA", informacionAdicional: null, tipo: "ERROR" }],
      }),
  });
  await new Procesador(dep).procesar(item());
  assertEquals(estados(r), ["RECIBIDO", "AUTORIZADO"]);
});

Deno.test("procesador: SRI caído → mismo estado, reintento con backoff y un solo evento", async () => {
  const { dep, r } = dobles({ recepcion: () => Promise.reject(new SriNoDisponible("timeout")) });
  await new Procesador(dep).procesar(item());
  assertEquals(r.resultados.length, 1);
  assertEquals(r.resultados[0].cambios.estado, undefined);
  assertEquals(r.resultados[0].cambios.intentos, 1);
  assertEquals(r.resultados[0].cambios.proximo_intento, "2026-11-08T15:00:05.000Z");
  assertEquals(r.resultados[0].evento, "sri_no_disponible");

  const segundo = dobles({ recepcion: () => Promise.reject(new SriNoDisponible("timeout")) });
  await new Procesador(segundo.dep).procesar(item({ cmp_intentos: 3 }));
  assertEquals(segundo.r.resultados[0].cambios.proximo_intento, "2026-11-08T15:05:00.000Z");
  assertEquals(segundo.r.resultados[0].evento, undefined);
});

Deno.test("procesador: sin autorización todavía sigue RECIBIDO; pasadas 48 h, ERROR", async () => {
  const vacio = () => Promise.resolve({ autorizaciones: [] });
  const a = dobles({ autorizacion: vacio });
  await new Procesador(a.dep).procesar(item({ cmp_estado: "RECIBIDO", cmp_intentos: 1 }));
  assertEquals(a.r.resultados[0].cambios.estado, undefined);
  assertEquals(a.r.resultados[0].cambios.intentos, 2);

  const b = dobles({ autorizacion: vacio });
  await new Procesador(b.dep).procesar(item({ cmp_estado: "RECIBIDO", cmp_emitido_en: "2026-11-06T14:00:00Z" }));
  assertEquals(estados(b.r), ["ERROR"]);
});

Deno.test("procesador: NO AUTORIZADO → NO_AUTORIZADO", async () => {
  const mensajes = [{ identificador: "39", mensaje: "FIRMA INVALIDA", informacionAdicional: null, tipo: "ERROR" }];
  const { dep, r } = dobles({
    autorizacion: () =>
      Promise.resolve({
        autorizaciones: [{
          estado: "NO AUTORIZADO", numeroAutorizacion: null, fechaAutorizacion: null, ambiente: "PRUEBAS",
          comprobanteXml: null, mensajes,
        }],
      }),
  });
  await new Procesador(dep).procesar(item({ cmp_estado: "RECIBIDO" }));
  assertEquals(estados(r), ["NO_AUTORIZADO"]);
  assertEquals(r.subidas, []);
});

Deno.test("procesador: consumidor final por encima de 50 USD no se envía", async () => {
  const { dep, r } = dobles();
  await new Procesador(dep).procesar(item({
    cmp_comprador: {
      tipo_identificacion: "07", identificacion: "9999999999999", razon_social: "CONSUMIDOR FINAL",
      direccion: null, correo: null, telefono: null,
    },
  }, 60));
  assertEquals(estados(r), ["ERROR"]);
  assertEquals(r.enviados, []);
});

Deno.test("procesador: ambiente 2 sin permiso del despliegue no llega al SRI", async () => {
  const { dep, r } = dobles({ permitirProduccion: false });
  await new Procesador(dep).procesar(item({ cmp_ambiente: 2 }));
  assertEquals(estados(r), ["ERROR"]);
  assertStringIncludes(String((r.resultados[0].cambios.mensajes_sri as { mensaje: string }[])[0].mensaje), "producción");
  assertEquals(r.enviados, []);
});

Deno.test("procesador: formas de pago que no suman el total → ERROR", async () => {
  const { dep, r } = dobles();
  await new Procesador(dep).procesar(item({ cmp_formas_pago: [{ forma_pago: "19", total: "5.00" }] }));
  assertEquals(estados(r), ["ERROR"]);
  assertEquals(r.enviados, []);
});

Deno.test("procesador: una clave de acceso que no encaja con los datos → ERROR", async () => {
  const { dep, r } = dobles();
  const it = item();
  it.emisor.emi_ruc = "1790012345001";
  await new Procesador(dep).procesar(it);
  assertEquals(estados(r), ["ERROR"]);
});

Deno.test("procesador: si falla Storage tras autorizar, no pasa a ERROR y se reintenta", async () => {
  const { dep, r } = dobles({ subir: () => Promise.reject(new Error("Storage caído")) });
  await new Procesador(dep).procesar(item({ cmp_estado: "RECIBIDO" }));
  assertEquals(estados(r), ["(igual)"]);
  assertEquals(r.resultados[0].evento, "publicacion_pendiente");
  assert(r.resultados[0].cambios.proximo_intento);
});

Deno.test("procesador: sin SMTP el comprobante queda autorizado y se anota el correo pendiente", async () => {
  const { dep, r } = dobles({ smtp: false });
  await new Procesador(dep).procesar(item({ cmp_estado: "RECIBIDO" }));
  assertEquals(estados(r), ["AUTORIZADO"]);
  assertEquals(r.correos[0].enviado, false);
});
