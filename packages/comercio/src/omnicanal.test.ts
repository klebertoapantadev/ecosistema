import { describe, expect, it } from "vitest";
import {
  calcularMetricasOmnicanal,
  emparejarComprasConConversacion,
  extraerSegmentosMultimediaMensaje,
  extraerTodasLasImagenesMensaje,
  interpolarRespuestaRapida,
  limpiarVistaPreviaMensajeOmnicanal,
  normalizarHandleMencion,
  normalizarTelefonoOmnicanal,
  type ContactoUnificadoOmnicanal,
  type ConversacionOmnicanal,
} from "./omnicanal";
import type { PedidoTiendaRegistrado } from "./acciones-logistica";

describe("omnicanal — normalización, plantillas y cruce cliente-compras", () => {
  it("normaliza números celulares de Ecuador (09..., 9..., +593...) a formato canónico", () => {
    expect(normalizarTelefonoOmnicanal("099 123 4567")).toBe("593991234567");
    expect(normalizarTelefonoOmnicanal("+593 99-123-4567")).toBe("593991234567");
    expect(normalizarTelefonoOmnicanal("991234567")).toBe("593991234567");
    expect(normalizarTelefonoOmnicanal("")).toBe("");
  });

  it("interpola variables en mensajes predeterminados limpiando nombres genéricos", () => {
    expect(
      interpolarRespuestaRapida("¡Hola {{nombre}}! Te atiende {{asesor}}.", {
        nombre: "Diego Veintimilla",
        asesor: "Johanna Solórzano",
      })
    ).toBe("¡Hola Diego! Te atiende Johanna Solórzano.");

    expect(
      interpolarRespuestaRapida("¡Hola {{nombre}}! Te atiende {{asesor}}.", {
        nombre: "Visitante Web #A1B2",
        asesor: "Josselyn",
      })
    ).toBe("¡Hola! Te atiende Josselyn.");
  });

  it("empareja compras web por correo o por teléfono ecuatoriano normalizado", () => {
    const pedidos = [
      {
        id: "p1",
        codigoOrden: "TNK-ORD-0001",
        compradorNombre: "Diego",
        compradorCorreo: "diego@correo.ec",
        compradorTelefono: "0991234567",
        total: 65,
        estado: "APROBADA",
      },
      {
        id: "p2",
        codigoOrden: "TNK-ORD-0002",
        compradorNombre: "Otro",
        compradorCorreo: "otro@correo.ec",
        compradorTelefono: "0980000000",
        total: 40,
        estado: "PENDIENTE_PAGO",
      },
    ] as unknown as PedidoTiendaRegistrado[];

    const coincidencias = emparejarComprasConConversacion(
      {
        remitenteNombre: "Diego V.",
        remitenteCorreo: null,
        remitenteTelefono: "+593 99 123 4567",
      },
      pedidos
    );

    expect(coincidencias).toHaveLength(1);
    expect(coincidencias[0]?.codigoOrden).toBe("TNK-ORD-0001");
  });

  it("calcula métricas diferenciando respuestas IA ARIA vs intervenciones humanas y registrados vs invitados", () => {
    const conversaciones: ConversacionOmnicanal[] = [
      {
        id: "c1",
        negocio: "tinkay",
        canal: "web",
        claveHilo: "w1",
        remitenteId: "w1",
        remitenteNombre: "Candy Abad",
        estadoAtencion: "BOT_ACTIVO",
        ultimoMensajeEn: "2026-11-15T10:00:00Z",
        noLeidosAsesora: 0,
        mensajesClienteConteo: 3,
        mensajesIaConteo: 3,
        mensajesHumanoConteo: 0,
        creadoEn: "2026-11-15T09:50:00Z",
        etiquetasIds: [],
      },
      {
        id: "c2",
        negocio: "tinkay",
        canal: "web",
        claveHilo: "w2",
        remitenteId: "w2",
        remitenteNombre: "Gaby Díaz",
        estadoAtencion: "EN_ATENCION_ASESORA",
        asesoraAsignadaId: "u-johanna",
        ultimoMensajeEn: "2026-11-15T10:15:00Z",
        noLeidosAsesora: 1,
        mensajesClienteConteo: 4,
        mensajesIaConteo: 2,
        mensajesHumanoConteo: 2,
        creadoEn: "2026-11-15T09:55:00Z",
        etiquetasIds: [],
      },
    ];

    const pedidos = [
      { id: "o1", total: 55, estado: "APROBADA", esUsuarioRegistrado: true },
      { id: "o2", total: 80, estado: "PENDIENTE_PAGO", esUsuarioRegistrado: false },
    ] as unknown as Array<PedidoTiendaRegistrado & { esUsuarioRegistrado?: boolean }>;

    const contactos: ContactoUnificadoOmnicanal[] = [
      {
        claveUnica: "usu:1",
        tipoCuenta: "USUARIO_REGISTRADO",
        nombre: "Candy Abad",
        autorizaWhatsapp: true,
        rolNegocio: "CLIENTE",
        totalCompras: 1,
        montoAcumulado: 55,
        creadoEn: "2026-11-15T08:00:00Z",
        etiquetasIds: [],
      },
    ];

    const m = calcularMetricasOmnicanal(conversaciones, pedidos, contactos);
    expect(m.totalRespuestasAria).toBe(5);
    expect(m.totalIntervencionesHumanas).toBe(2);
    expect(m.porcentajeResolucionIa).toBe(50);
    expect(m.comprasUsuariosRegistrados).toBe(1);
    expect(m.comprasInvitadosNoRegistrados).toBe(1);
    expect(m.montoTotalVentasUsd).toBe(135);
    expect(m.totalUsuariosRegistradosWeb).toBe(1);
  });

  it("extrae imágenes Markdown (incluyendo URLs con paréntesis) y limpia vistas previas", () => {
    const respuestaMia =
      "Para condolencias tengo estos arreglos solemnes:\n\n" +
      "1. Abanico/Canasta XL $45.00\n" +
      "![Abanico Canasta XL](https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/abanico_blanco_ok.jpg)\n\n" +
      "2. Abanico/Canasta L $38.00\n" +
      "![Abanico Canasta L](https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/abanico_m_(2).jpg)\n\n" +
      "¿Prefieres que reservemos alguno?";

    const segmentos = extraerSegmentosMultimediaMensaje(respuestaMia);
    expect(segmentos).toHaveLength(5);
    expect(segmentos[1]).toEqual({
      tipo: "imagen",
      alt: "Abanico Canasta XL",
      url: "https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/abanico_blanco_ok.jpg",
    });
    expect(segmentos[3]).toEqual({
      tipo: "imagen",
      alt: "Abanico Canasta L",
      url: "https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/abanico_m_(2).jpg",
    });

    const previa = limpiarVistaPreviaMensajeOmnicanal(
      "![Abanico Canasta XL](https://oaybbpdxhlxjbpwnoymy.supabase.co/abanico.jpg)"
    );
    expect(previa).toBe("📷 Abanico Canasta XL");
  });

  it("extrae fotos enviadas por el cliente (detalle.imagen_url o formato histórico) y fotos de Mía con salto entre ] y (", () => {
    const clienteMsg = extraerSegmentosMultimediaMensaje(
      "Quiero uno parecido a este",
      { imagen_url: "https://cdn.ycloud.com/whatsapp/media/inbound-abc123" }
    );
    expect(clienteMsg).toEqual([
      { tipo: "texto", texto: "Quiero uno parecido a este" },
      {
        tipo: "imagen",
        alt: "",
        url: "https://cdn.ycloud.com/whatsapp/media/inbound-abc123",
      },
    ]);

    const historicoCliente = extraerSegmentosMultimediaMensaje(
      "📷 Imagen adjunta por el cliente: https://api.ycloud.com/v2/media/xyz999"
    );
    expect(historicoCliente).toEqual([
      {
        tipo: "imagen",
        alt: "Foto enviada por el cliente",
        url: "https://api.ycloud.com/v2/media/xyz999",
      },
    ]);

    const miaConSaltoYEspacio = extraerTodasLasImagenesMensaje({
      contenido:
        "![Abanico Blanco]\n(https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/abanico m (2).jpg)",
    });
    expect(miaConSaltoYEspacio).toEqual([
      {
        tipo: "imagen",
        alt: "Abanico Blanco",
        url: "https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/abanico%20m%20(2).jpg",
      },
    ]);

    expect(normalizarHandleMencion("Kléber")).toBe("kleber");
  });
});
