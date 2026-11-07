import { describe, expect, it } from "vitest";
import { firmarCapsula } from "@eco/agentes-ia";
import { firmarEnlaceDocumento, urlEnlaceDocumento, verificarEnlaceDocumento } from "./documentos";

const SECRETO = "secreto-de-pruebas";
const REF = {
  origen: "billetera" as const,
  documentoId: "fccf8fd8-8ed6-4571-9d39-a01d00c78f99",
  archivo: 1,
  usuarioId: "d291f861-232d-4fbd-a790-9e868012820e",
};

describe("enlace de documento", () => {
  it("ida y vuelta: lo firmado es lo que se verifica", async () => {
    const token = await firmarEnlaceDocumento(REF, SECRETO);
    expect(await verificarEnlaceDocumento(token, SECRETO)).toEqual(REF);
  });

  it("otro secreto o un token manipulado no valen", async () => {
    const token = await firmarEnlaceDocumento(REF, SECRETO);
    expect(await verificarEnlaceDocumento(token, "otro")).toBeNull();
    expect(await verificarEnlaceDocumento(token.slice(0, -3) + "abc", SECRETO)).toBeNull();
  });

  it("una capsula de sesion NO sirve como enlace de documento, aunque comparta secreto", async () => {
    const capsula = await firmarCapsula(
      { usuarioId: REF.usuarioId, rol: "CLIENTE", conversacionId: "cnv" },
      SECRETO,
    );
    expect(await verificarEnlaceDocumento(capsula, SECRETO)).toBeNull();
  });

  it("la URL cuelga del origen del MCP, sin barra doble", () => {
    expect(urlEnlaceDocumento("https://www.tranqi24.com/", "abc")).toBe(
      "https://www.tranqi24.com/api/asistente/documento/abc",
    );
  });
});
