import { describe, expect, it } from "vitest";
import { parsearMensajePedidoDeterministico } from "./parsearPedidoAria";

describe("parsearMensajePedidoDeterministico", () => {
  it("estructura un mensaje completo de Telegram / ManyChat en estado NUEVO_POR_CONFIRMAR", () => {
    const msg = `Pedido #3💸NUEVA VENTA💸

🛒PEDIDO
Fecha: Jueves 19 de noviembre
Hora: De 12 pm a  2pm
Arreglo: Bouquet Coreano grande de 40 rosas rojas
1 set de mariposas ll
Color: FALTA

✍🏻TARJETA
Mensaje: Te amo con un cariño que el tiempo no ha borrado.

De Oscar
Para Alejus
Firma: S/F

🚚DATOS ENTREGA
Sector: Leonisa corporate
norte de Quito para Carcelen industrial
Dirección: https://maps.app.goo.gl/JB35dyKv2uxFHeHi9?g_st=awb
Recibe: Alejandra Merino 0967361525
Envia : feliz (Feliz)  +593987746739`;

    const res = parsearMensajePedidoDeterministico(msg, "2026-11-19");
    expect(res.estadoInicial).toBe("NUEVO_POR_CONFIRMAR");
    expect(res.clasificacionPedido).toBe("FLORISTERIA_OCASIONES");
    expect(res.fechaEntrega).toBe("2026-11-19");
    expect(res.horaEspecifica).toContain("12 pm");
    expect(res.productoResumen).toContain("Bouquet Coreano grande de 40 rosas rojas");
    expect(res.productoResumen).toContain("1 set de mariposas ll");
    expect(res.dedicatoria).toContain("Te amo con un cariño");
    expect(res.enlaceMapa).toBe("https://maps.app.goo.gl/JB35dyKv2uxFHeHi9?g_st=awb");
    expect(res.clienteTelefono).toBe("+593987746739");
    expect(res.destinatarioFallecido).toBe("Alejandra Merino");
    expect(res.faltantes).toContain("Color del arreglo");
  });

  it("estructura una frase corta natural como 'Exequiales salea 4 , pedido por cristina'", () => {
    const res = parsearMensajePedidoDeterministico(
      "Exequiales salea 4 , pedido por cristina",
      "2026-11-20"
    );
    expect(res.estadoInicial).toBe("NUEVO_POR_CONFIRMAR");
    expect(res.clasificacionPedido).toBe("EXEQUIALES");
    expect(res.origenTipo).toBe("EXEQUIALES_LLAMADA");
    expect(res.salaServicio).toBe("Sala 4");
    expect(res.clienteSolicita.toLowerCase()).toBe("cristina");
    expect(res.destinatarioFallecido).toBe("Por confirmar (Sala 4)");
    expect(res.faltantes).toContain("Nombre del fallecido");
  });
});
