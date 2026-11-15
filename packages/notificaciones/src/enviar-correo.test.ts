import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@eco/supabase/servidor", () => ({
  crearClienteServidor: vi.fn(async () => ({
    functions: {
      invoke: invokeMock,
    },
  })),
}));

import { enviarCorreo } from "./enviar-correo";

describe("enviarCorreo", () => {
  const claveOriginal = process.env.CORREO_FUNCION_CLAVE;

  beforeEach(() => {
    invokeMock.mockReset();
    process.env.CORREO_FUNCION_CLAVE = "clave-prueba-unitaria";
  });

  afterEach(() => {
    process.env.CORREO_FUNCION_CLAVE = claveOriginal;
  });

  it("reintenta por el transporte SMTP verificado de plataforma cuando el negocio aún no tiene SMTP activo (409)", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { error: "El negocio no tiene un servidor SMTP activo" },
        error: { message: "Edge Function returned a non-2xx status code", context: { status: 409 } },
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        error: null,
      });

    const resultado = await enviarCorreo({
      negocio: "tinkay",
      para: "familiammtg@gmail.com",
      asunto: "[Tinkay Flores y Eventos] ¡Gracias por tu compra! Orden TNK-ORD-0008",
      html: "<p>Comprobante TNK-ORD-0008</p>",
    });

    expect(resultado).toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0]?.[1]?.body?.negocio).toBe("tinkay");
    expect(invokeMock.mock.calls[1]?.[1]?.body).toEqual({
      negocio: "tranqi",
      para: "familiammtg@gmail.com",
      asunto: "[Tinkay Flores y Eventos] ¡Gracias por tu compra! Orden TNK-ORD-0008",
      html: "<p>Comprobante TNK-ORD-0008</p>",
      adjuntos: undefined,
    });
  });

  it("envía en una sola llamada cuando el negocio tiene SMTP activo", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    const resultado = await enviarCorreo({
      negocio: "tinkay",
      para: "tinkay.uio@gmail.com",
      asunto: "Nueva venta TNK-ORD-0009",
      html: "<p>Detalle</p>",
    });

    expect(resultado).toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});
