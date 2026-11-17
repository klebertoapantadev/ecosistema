import { describe, expect, it } from "vitest";
import {
  autoCompletarDatosVentaDesdeMensajes,
  calcularFechaRecordatorioRapido,
  calcularMetricasOmnicanal,
  calcularTotalDatosVenta,
  construirHrefRetornoChatCliente,
  construirMensajeProductoCatalogoOmnicanal,
  emparejarComprasConConversacion,
  extraerSegmentosMultimediaMensaje,
  extraerTodasLasImagenesMensaje,
  formatearEtiquetaEnlaceVisible,
  interpolarRespuestaRapida,
  limpiarVistaPreviaMensajeOmnicanal,
  normalizarHandleMencion,
  normalizarTelefonoOmnicanal,
  obtenerDefinicionMotivoCierre,
  resolverConversacionPorContextoReenvio,
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

  it("no bloquea ni hace backtracking catastrófico ante URLs truncadas a 280 caracteres sin paréntesis de cierre", () => {
    const truncado280 =
      "Para condolencias tengo estos arreglos:\n" +
      "1. Abanico XL ![Abanico XL](https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/abanico_ok.jpg)\n" +
      "2. Abanico L ![Abanico L](https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/" +
      "x".repeat(600);

    const t0 = Date.now();
    const previa = limpiarVistaPreviaMensajeOmnicanal(truncado280);
    const segmentos = extraerSegmentosMultimediaMensaje(truncado280);
    const duracionMs = Date.now() - t0;

    expect(duracionMs).toBeLessThan(35);
    expect(previa).toContain("📷 Abanico XL");
    expect(previa).toContain("📷 Abanico L");
    expect(segmentos.some((s) => s.tipo === "imagen")).toBe(true);
  });

  it("calcula el total de campos de venta y autocompleta links GPS y orden desde mensajes", () => {
    expect(
      calcularTotalDatosVenta({
        precioProducto: 38,
        precioExtras: 7.5,
        costoEnvio: 3.5,
      })
    ).toBe(49);

    const autocompletado = autoCompletarDatosVentaDesdeMensajes(
      null,
      [
        {
          id: "m1",
          origen: "CLIENTE",
          contenido:
            "Mi pedido es TNK-ORD-0042 y esta es la ubicación https://maps.app.goo.gl/FX4qzrVRdJSLck5c9",
          tipoContenido: "TEXTO",
          estadoEntrega: "ENVIADO",
          creadoEn: new Date().toISOString(),
        },
      ],
      { remitenteNombre: "Martín Toapanta" }
    );

    expect(autocompletado.nombreCliente).toBe("Martín Toapanta");
    expect(autocompletado.ubicacionUrl).toBe("https://maps.app.goo.gl/FX4qzrVRdJSLck5c9");
    expect(autocompletado.codigoPedido).toBe("TNK-ORD-0042");
    expect(autocompletado.estadoCobro).toBe("COTIZANDO");
  });

  it("programa recordatorios rápidos, tipifica motivos de cierre y resuelve el enlace de retorno desde Chat Grupal", () => {
    const base = new Date("2026-11-17T10:00:00.000Z");
    expect(calcularFechaRecordatorioRapido("20m", base)).toBe("2026-11-17T10:20:00.000Z");
    expect(calcularFechaRecordatorioRapido("6h", base)).toBe("2026-11-17T16:00:00.000Z");

    const defVenta = obtenerDefinicionMotivoCierre("VENTA_COMPLETADA");
    expect(defVenta.etiqueta).toBe("Venta completada");

    const href = construirHrefRetornoChatCliente({
      conversacionId: "cnv-123",
      mensajeId: "msg-999",
      clienteNombre: "Tinkay",
      clienteTelefono: "+593984583280",
      textoOriginal: "Si tengo la copia",
    });
    expect(href).toContain("/panel/conversaciones?");
    expect(href).toContain("chat=cnv-123");
    expect(href).toContain("msg=msg-999");

    const convSimulada = {
      id: "cnv-real-1",
      remitenteNombre: "Tinkay",
      remitenteTelefono: "0984583280",
    } as ConversacionOmnicanal;

    // Incluso si un mensaje previo no tenía conversacionId, lo encuentra por teléfono normalizado
    const resuelta = resolverConversacionPorContextoReenvio([convSimulada], {
      conversacionId: null,
      clienteNombre: "Otro",
      clienteTelefono: "+593984583280",
    });
    expect(resuelta?.id).toBe("cnv-real-1");
  });

  it("evita fugas de URLs firmadas JWT crudas en burbujas móviles y compacta enlaces extensos", () => {
    const urlJwt =
      "https://api.ycloud.com/v2/whatsapp/media/6894d3b3d1947622cef?token=eyJpZCI6IjQ2OTQ4NzMzMXNjc0NjE1Iiwid2FtIjpbXSwiZmlsZSI6ImFwcGxpY2F0aW9uIn0.WNE9KRWhrWTQ3cmdQ";

    // Caso 1: corchetes anidados o URL firmada envuelta en paréntesis + detalle.imagen_url duplicada
    const segs = extraerSegmentosMultimediaMensaje(
      `![Fotografía [WhatsApp]\nen chat](${urlJwt})`,
      { imagen_url: urlJwt }
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({
      tipo: "imagen",
      alt: "Fotografía [WhatsApp] en chat",
      url: urlJwt,
    });

    // Caso 2: URL firmada suelta entre paréntesis sin Markdown
    const segsSuelta = extraerSegmentosMultimediaMensaje(
      `Adjunto comprobante (${urlJwt})`,
      { imagen_url: urlJwt }
    );
    expect(segsSuelta.filter((s) => s.tipo === "imagen")).toHaveLength(1);
    expect(
      segsSuelta.some((s) => s.tipo === "texto" && s.texto.includes("eyJpZCI6"))
    ).toBe(false);

    // Caso 3: Formateo compacto de enlaces extensos con paréntesis de cierre externo
    const enlaceCompacto = formatearEtiquetaEnlaceVisible(
      "(https://www.google.com/maps/place/Quito+Ecuador/@-0.1806532,-78.4678382,15z/data=!4m6!3m5)"
        .slice(1)
    );
    expect(enlaceCompacto.sufijo).toBe(")");
    expect(enlaceCompacto.href.endsWith("3m5")).toBe(true);
    expect(enlaceCompacto.etiqueta).toContain("🔗 google.com/");
  });

  it("extrae segmentos de nota de voz / documento y formatea el envío de productos del catálogo (foto + link web + álbum)", () => {
    const segsAudio = extraerSegmentosMultimediaMensaje(
      "🎤 Nota de voz recibida por WhatsApp",
      {
        audio_url: "https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/comun-publico/omnicanal-media/tinkay/voz-1.ogg",
        audio_mime: "audio/ogg",
        transcripcion: "Hola, cuánto cuesta el ramo coreano",
      }
    );
    expect(segsAudio.some((s) => s.tipo === "audio")).toBe(true);
    expect(segsAudio.some((s) => s.tipo === "imagen")).toBe(false);

    const ficha = construirMensajeProductoCatalogoOmnicanal({
      negocio: "tinkay",
      nombreProducto: "Bouquet Coreano Real",
      slugProducto: "bouquet-coreano-real",
      nombreVariante: "24 Rosas",
      skuVariante: "TNK-COR-24",
      precioUsd: 45,
      imagenUrl: "/imagenes/catalogo/coreano.jpg",
      albumFotosUrl: "https://photos.app.goo.gl/RhTxny2frDaV1XTv5",
      incluirFotoPrincipal: true,
      incluirLinkWeb: true,
      incluirLinkAlbum: true,
    });

    expect(ficha.imagenPrincipalUrl).toBe(
      "https://tinkay-web.vercel.app/imagenes/catalogo/coreano.jpg"
    );
    expect(ficha.textoMensaje).toContain(
      "🌐 Revisar en la web: https://tinkay-web.vercel.app/producto/bouquet-coreano-real?variante=TNK-COR-24"
    );
    expect(ficha.textoMensaje).toContain(
      "📸 Álbum del producto: https://photos.app.goo.gl/RhTxny2frDaV1XTv5"
    );
    expect(ficha.cuerpoConMarkdown).toContain(
      "![Bouquet Coreano Real (24 Rosas)](https://tinkay-web.vercel.app/imagenes/catalogo/coreano.jpg)"
    );
  });
});
