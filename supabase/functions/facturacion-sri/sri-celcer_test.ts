// Prueba real contra el ambiente de PRUEBAS del SRI (celcer.sri.gob.ec). Solo
// corre con SRI_PRUEBAS=1 y --allow-net: 2 peticiones como máximo.
//
// Con un RUC ficticio y un certificado autofirmado se espera un DEVUELTA (el
// SRI no conoce el RUC): lo que se prueba es la tubería (sobre SOAP, base64,
// XML firmado legible por el SRI y parser de la respuesta). El AUTORIZADO solo
// llega con el RUC y el .p12 reales del emisor.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { cargarCertificado } from "../_compartido/sri/certificado.ts";
import { generarClaveAcceso } from "../_compartido/sri/clave-acceso.ts";
import { crearP12 } from "../_compartido/sri/pruebas/certificado-prueba.ts";
import { factura } from "../_compartido/sri/pruebas/ayudas.ts";
import { consultarAutorizacion, enviarRecepcion } from "../_compartido/sri/soap.ts";
import { calcularTotales } from "../_compartido/sri/totales.ts";
import { firmarComprobante } from "../_compartido/sri/xades.ts";
import { generarXmlComprobante } from "../_compartido/sri/xml-comprobante.ts";

Deno.test({
  name: "celcer: el SRI de pruebas recibe y contesta a un comprobante firmado",
  ignore: Deno.env.get("SRI_PRUEBAS") !== "1",
  async fn() {
    const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
    const ruc = "1790000000001";
    const base = factura();
    const c = {
      ...base,
      fechaEmision: hoy,
      emisor: { ...base.emisor, ruc },
      claveAcceso: generarClaveAcceso({
        fechaEmision: hoy, tipo: "01", ruc, ambiente: 1, establecimiento: "002", puntoEmision: "001",
        numero: Math.floor(Math.random() * 1e6) + 1, codigoNumerico: "12345678",
      }),
    };
    c.numero = Number(c.claveAcceso.slice(30, 39));
    const p12 = crearP12();
    const xml = await firmarComprobante(
      generarXmlComprobante(c, calcularTotales(c.detalles)),
      await cargarCertificado(p12.bytes, "clave secreta"),
    );

    const recepcion = await enviarRecepcion(1, xml);
    console.log("recepción:", JSON.stringify(recepcion));
    assert(["RECIBIDA", "DEVUELTA"].includes(recepcion.estado));
    if (recepcion.estado === "DEVUELTA") {
      assert(recepcion.mensajes.length > 0, "un DEVUELTA trae al menos un mensaje");
    } else {
      const autorizacion = await consultarAutorizacion(1, c.claveAcceso);
      console.log("autorización:", JSON.stringify(autorizacion.autorizaciones.map((a) => [a.estado, a.mensajes])));
      assertEquals(Array.isArray(autorizacion.autorizaciones), true);
    }
  },
});
