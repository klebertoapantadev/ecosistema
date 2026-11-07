import type { Herramienta, ContextoMcpCatalogo } from "@eco/agentes-ia";

export const herramientaRegistrarContacto: Herramienta<ContextoMcpCatalogo> & { alcanceRequerido: string } = {
  alcanceRequerido: "prospectos:crear",
  descripcion:
    "Registra los datos de contacto de una persona interesada para que el equipo de Tranqi la llame. Úsala solo cuando la persona haya dado su nombre, su WhatsApp y su autorización expresa para ser contactada. Devuelve ok o el motivo del rechazo.",
  esquema: {
    type: "object",
    properties: {
      nombre: {
        type: "string",
        description: "Nombre completo de la persona interesada.",
      },
      whatsapp: {
        type: "string",
        description: "Número de teléfono celular o WhatsApp de contacto.",
      },
      autoriza_contacto: {
        type: "boolean",
        description: "true solo si la persona dijo explícitamente que sí acepta ser contactada",
      },
      correo: {
        type: "string",
        description: "Correo electrónico opcional de la persona interesada.",
      },
      ciudad: {
        type: "string",
        description: "Ciudad de residencia o ubicación del interesado en Ecuador (opcional).",
      },
      servicio_sku: {
        type: "string",
        description: "SKU de la variante del catálogo si se identificó, p. ej. TRQ-DIV-MUT",
      },
      interes: {
        type: "string",
        description: "resumen en una o dos frases de lo que necesita",
      },
      canal: {
        type: "string",
        enum: ["buddy_web", "whatsapp_aria"],
        description: "Por dónde llegó la persona: 'buddy_web' (chat de la página) o 'whatsapp_aria' (conversación de WhatsApp). Por defecto buddy_web.",
      },
    },
    required: ["nombre", "whatsapp", "autoriza_contacto"],
  },
  async ejecutar(args, ctx) {
    const urlBase = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://oaybbpdxhlxjbpwnoymy.supabase.co"
    ).replace(/\/$/, "");

    const apiKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS";

    const endpoint = `${urlBase}/rest/v1/rpc/trq_fn_registrar_prospecto`;

    try {
      const respuesta = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          p_token_texto: ctx.token,
          p_nombre: typeof args.nombre === "string" ? args.nombre.trim() : "",
          p_whatsapp: typeof args.whatsapp === "string" ? args.whatsapp.trim() : "",
          p_autoriza_contacto: Boolean(args.autoriza_contacto),
          p_correo: typeof args.correo === "string" && args.correo.trim().length > 0 ? args.correo.trim() : null,
          p_ciudad: typeof args.ciudad === "string" && args.ciudad.trim().length > 0 ? args.ciudad.trim() : null,
          p_servicio_sku: typeof args.servicio_sku === "string" && args.servicio_sku.trim().length > 0 ? args.servicio_sku.trim() : null,
          p_interes: typeof args.interes === "string" && args.interes.trim().length > 0 ? args.interes.trim() : null,
          p_canal: args.canal === "whatsapp_aria" ? "whatsapp_aria" : "buddy_web",
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!respuesta.ok) {
        return {
          registrado: false,
          motivo: "No se pudo registrar ahora; pide que lo intente más tarde o que escriba por WhatsApp.",
        };
      }

      const data = await respuesta.json();

      if (data && data.ok === true) {
        return {
          registrado: true,
          duplicado: Boolean(data.duplicado),
        };
      }

      const errorCodigo = String(data?.error || "");
      let motivo = "No se pudo registrar el contacto.";

      if (errorCodigo === "sin_consentimiento") {
        motivo = "Pide primero su autorización para contactarle.";
      } else if (errorCodigo === "whatsapp_invalido") {
        motivo = "Pide de nuevo el número de WhatsApp.";
      } else if (errorCodigo === "correo_invalido") {
        motivo = "El correo electrónico no es válido.";
      } else if (errorCodigo === "nombre_invalido") {
        motivo = "El nombre debe tener entre 2 y 120 caracteres.";
      } else if (errorCodigo === "limite_excedido") {
        motivo = "Se ha alcanzado el límite de solicitudes. Inténtalo más tarde.";
      } else if (errorCodigo === "no_autorizado") {
        motivo = "Token no autorizado para registrar contactos.";
      }

      return {
        registrado: false,
        motivo,
      };
    } catch {
      return {
        registrado: false,
        motivo: "No se pudo registrar ahora; pide que lo intente más tarde o que escriba por WhatsApp.",
      };
    }
  },
};
