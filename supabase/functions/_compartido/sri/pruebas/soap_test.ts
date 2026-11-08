import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { autorizacionVigente, parsearAutorizacion, parsearRecepcion, SriNoDisponible } from "../soap.ts";

// Respuestas reales o con la forma exacta de las del SRI (las de DOMO,
// Domo.Firma.Tests/ClienteSriSoapTests.cs y Datos/sri-celcer-recepcion.xml).
const sobre = (prefijo: string, cuerpo: string) =>
  `<?xml version='1.0' encoding='UTF-8'?><${prefijo}:Envelope xmlns:${prefijo}="http://schemas.xmlsoap.org/soap/envelope/"><${prefijo}:Body>${cuerpo}</${prefijo}:Body></${prefijo}:Envelope>`;

const RECIBIDA = sobre(
  "soap",
  '<ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>RECIBIDA</estado><comprobantes/></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse>',
);

// Grabada contra celcer.sri.gob.ec (DOMO, 24-sep-2026).
const DEVUELTA_CELCER =
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>DEVUELTA</estado><comprobantes><comprobante><claveAcceso>N/A</claveAcceso><mensajes><mensaje><identificador>35</identificador><mensaje>ARCHIVO NO CUMPLE ESTRUCTURA XML</mensaje><informacionAdicional>No existe un contribuyente registrado con el RUC 1790000000001</informacionAdicional><tipo>ERROR</tipo></mensaje></mensajes></comprobante></comprobantes></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>';

const DEVUELTA_43 = sobre(
  "S",
  '<ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>DEVUELTA</estado><comprobantes><comprobante><claveAcceso>2409202601179001234500120010020000001231234567818</claveAcceso><mensajes><mensaje><identificador>43</identificador><mensaje>CLAVE ACCESO REGISTRADA</mensaje><tipo>ERROR</tipo></mensaje></mensajes></comprobante></comprobantes></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse>',
);

const AUTORIZADO = sobre(
  "soap",
  '<ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>2409202601179001234500120010020000001231234567818</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>2409202601179001234500120010020000001231234567818</numeroAutorizacion><fechaAutorizacion>2026-09-24T10:15:30.123-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>1</ambiente></infoTributaria></factura>]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse>',
);

const NO_AUTORIZADO = sobre(
  "soap",
  '<ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>2409202601179001234500120010020000001231234567818</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>NO AUTORIZADO</estado><fechaAutorizacion>2026-09-24T10:15:30-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante>&lt;?xml version="1.0" encoding="UTF-8"?&gt;&lt;factura id="comprobante"/&gt;</comprobante><mensajes><mensaje><identificador>39</identificador><mensaje>FIRMA INVALIDA</mensaje><informacionAdicional>La firma es invalida [Firma inválida (firma y/o certificados alterados)]</informacionAdicional><tipo>ERROR</tipo></mensaje></mensajes></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse>',
);

const SIN_AUTORIZACIONES = sobre(
  "soap",
  '<ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>2409202601179001234500120010020000001231234567818</claveAccesoConsultada><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse>',
);

Deno.test("soap: recepción RECIBIDA sin mensajes", () => {
  assertEquals(parsearRecepcion(RECIBIDA), { estado: "RECIBIDA", mensajes: [] });
});

Deno.test("soap: DEVUELTA real de celcer con información adicional", () => {
  assertEquals(parsearRecepcion(DEVUELTA_CELCER), {
    estado: "DEVUELTA",
    mensajes: [{
      identificador: "35",
      mensaje: "ARCHIVO NO CUMPLE ESTRUCTURA XML",
      informacionAdicional: "No existe un contribuyente registrado con el RUC 1790000000001",
      tipo: "ERROR",
    }],
  });
});

Deno.test("soap: DEVUELTA 43 sin información adicional y con otro prefijo", () => {
  const r = parsearRecepcion(DEVUELTA_43);
  assertEquals(r.estado, "DEVUELTA");
  assertEquals(r.mensajes, [{ identificador: "43", mensaje: "CLAVE ACCESO REGISTRADA", informacionAdicional: null, tipo: "ERROR" }]);
});

Deno.test("soap: AUTORIZADO con el comprobante en CDATA", () => {
  const a = autorizacionVigente(parsearAutorizacion(AUTORIZADO))!;
  assertEquals(a.estado, "AUTORIZADO");
  assertEquals(a.numeroAutorizacion, "2409202601179001234500120010020000001231234567818");
  assertEquals(a.fechaAutorizacion, "2026-09-24T10:15:30.123-05:00");
  assertEquals(a.ambiente, "PRUEBAS");
  assertEquals(
    a.comprobanteXml,
    '<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>1</ambiente></infoTributaria></factura>',
  );
  assertEquals(a.mensajes, []);
});

Deno.test("soap: NO AUTORIZADO con el comprobante escapado y su mensaje", () => {
  const a = autorizacionVigente(parsearAutorizacion(NO_AUTORIZADO))!;
  assertEquals(a.estado, "NO AUTORIZADO");
  assertEquals(a.numeroAutorizacion, null);
  assertEquals(a.comprobanteXml, '<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante"/>');
  assertEquals(a.mensajes[0].identificador, "39");
  assertEquals(a.mensajes[0].informacionAdicional, "La firma es invalida [Firma inválida (firma y/o certificados alterados)]");
});

Deno.test("soap: sin autorizaciones todavía", () => {
  assertEquals(parsearAutorizacion(SIN_AUTORIZACIONES), { autorizaciones: [] });
  assertEquals(autorizacionVigente({ autorizaciones: [] }), null);
});

Deno.test("soap: respuestas sin el cuerpo esperado son SRI no disponible", () => {
  assertThrows(() => parsearRecepcion("<html>502 Bad Gateway</html>"), SriNoDisponible);
  assertThrows(() => parsearAutorizacion(RECIBIDA), SriNoDisponible);
});

Deno.test("soap: de varias autorizaciones manda la AUTORIZADO", () => {
  const no = parsearAutorizacion(NO_AUTORIZADO).autorizaciones[0];
  const si = parsearAutorizacion(AUTORIZADO).autorizaciones[0];
  assertEquals(autorizacionVigente({ autorizaciones: [no, si] })?.estado, "AUTORIZADO");
});
