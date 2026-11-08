import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
import { claveAccesoValida, claveCoincide, generarClaveAcceso } from "../clave-acceso.ts";

// Vectores reales de la ficha técnica (los mismos que usa DOMO y la migración SQL).
const V1 = "1111202401099338176200110020010000003961234567815";
const V2_NOTA_DEBITO = "2111202405176001321000110010010000001241234567810";
const V3 = "1211202401092554321700110021000000000790925543211";
const V4 = "0211202401050306179800120010020000000677300995216";

Deno.test("genera los vectores reales de la ficha", () => {
  assertEquals(
    generarClaveAcceso({
      fechaEmision: "2024-11-11", tipo: "01", ruc: "0993381762001", ambiente: 1,
      establecimiento: "002", puntoEmision: "001", numero: 396, codigoNumerico: "12345678",
    }),
    V1,
  );
  assertEquals(
    generarClaveAcceso({
      fechaEmision: "2024-11-12", tipo: "01", ruc: "0925543217001", ambiente: 1,
      establecimiento: "002", puntoEmision: "100", numero: 79, codigoNumerico: "09255432",
    }),
    V3,
  );
  assertEquals(
    generarClaveAcceso({
      fechaEmision: "2024-11-02", tipo: "01", ruc: "0503061798001", ambiente: 2,
      establecimiento: "001", puntoEmision: "002", numero: 67, codigoNumerico: "73009952",
    }),
    V4,
  );
});

Deno.test("los cuatro vectores son válidos y se detectan las alteraciones", () => {
  for (const v of [V1, V2_NOTA_DEBITO, V3, V4]) assert(claveAccesoValida(v), v);
  assertFalse(claveAccesoValida(V1.slice(0, 48) + "9"));
  assertFalse(claveAccesoValida(V1.slice(0, 48)));
  assertFalse(claveAccesoValida(V1 + "0"));
  assertFalse(claveAccesoValida("A" + V1.slice(1)));
  assertFalse(claveAccesoValida(""));
});

Deno.test("claveCoincide compara con los datos del comprobante", () => {
  const datos = {
    fechaEmision: "2024-11-11", tipo: "01" as const, ruc: "0993381762001", ambiente: 1 as const,
    establecimiento: "002", puntoEmision: "001", numero: 396,
  };
  assert(claveCoincide(V1, datos));
  assertFalse(claveCoincide(V1, { ...datos, numero: 397 }));
  assertFalse(claveCoincide(V1, { ...datos, ambiente: 2 }));
});
