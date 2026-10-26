'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY, FRASES_DEDICATORIAS } from '../datos-catalogo';
import { ProductoEcommerce, VarianteEcommerce, MensajeChat } from '../tipos';
import {
  X,
  Send,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Check,
} from 'lucide-react';

const MENSAJES_INICIALES: MensajeChat[] = [
  {
    id: 'msg-init-1',
    remitente: 'aria',
    texto:
      '¡Hola! Soy Mía 🌿, sommelier floral de Tinkay. ¿Para qué ocasión o persona especial estamos buscando el arreglo hoy? Con gusto te sugiero la mejor opción de nuestro taller y te ayudo a coordinar la entrega.',
    timestamp: 'Ahora',
  },
];

const SUGERENCIAS_RAPIDAS = [
  { id: 'amor', texto: '🌹 Sorpresa de Amor / Aniversario' },
  { id: 'cumple', texto: '🎂 Cumpleaños Alegre' },
  { id: 'condolencias', texto: '🕊️ Condolencias y Respeto' },
  { id: 'economico', texto: '✨ Opciones de menos de $30' },
];

export function ChatAriaFlotante() {
  const {
    agregarItem,
    setProductoSeleccionadoModal,
    setDrawerAbierto,
    cantidadTotal,
    productos,
  } = useCarrito();

  const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>(MENSAJES_INICIALES);
  const [inputTexto, setInputTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [itemRecienAgregado, setItemRecienAgregado] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, abierto, escribiendo]);

  // Generador de respuestas inteligentes del agente de ventas floral Mía
  const procesarMensajeUsuario = (texto: string) => {
    const query = texto.toLowerCase();

    // 1. Caso Tienda física / Ubicación / Dirección / Maps
    if (
      query.includes('tienda') ||
      query.includes('donde') ||
      query.includes('dónde') ||
      query.includes('ubicacion') ||
      query.includes('ubicación') ||
      query.includes('direccion') ||
      query.includes('dirección') ||
      query.includes('local') ||
      query.includes('maps') ||
      query.includes('visitar') ||
      query.includes('retiro')
    ) {
      return {
        texto:
          '¡Con mucho gusto! Nuestra tienda física y taller floral principal está ubicada en Quito. Puedes visitarnos directamente, retirar tus pedidos sin costo de envío o coordinar composiciones personalizadas. Puedes abrir nuestra ubicación en Google Maps aquí: https://maps.app.goo.gl/D56gQohzuwha4sLf8. ¿Te gustaría coordinar un pedido para retiro hoy?',
      };
    }

    // 2. Caso Condolencias / Velaciones / Pésame
    if (
      query.includes('condolencia') ||
      query.includes('pesame') ||
      query.includes('pésame') ||
      query.includes('fallec') ||
      query.includes('funeral') ||
      query.includes('velaci') ||
      query.includes('duelo')
    ) {
      const prodCondol = catalogo.find((p) => p.esCondolencias) ?? catalogo[5] ?? catalogo[0]!;
      const varCondol = prodCondol.variantes[0]!;
      return {
        texto:
          'Comprendo el momento y te acompaño con profundo respeto. Para ocasiones de condolencias y velaciones preparamos composiciones sobrias con rosas blancas, liliums y follajes andinos. Nuestro Abanico Monumental incluye atril de madera y cinta solemne membretada.',
        productosSugeridos: [
          {
            producto: prodCondol,
            variantePorDefecto: varCondol,
            mensajeMotivo: 'Incluye pedestal y cinta con nombres de los remitentes.',
          },
        ],
        sugerenciaDedicatoria: {
          para: 'Familia doliente',
          mensaje: FRASES_DEDICATORIAS.condolencias?.[0] ?? 'Nuestras sentidas condolencias.',
        },
      };
    }

    // 3. Caso Amor / Aniversario / Pedida de mano / Enamorados
    if (
      query.includes('amor') ||
      query.includes('aniversario') ||
      query.includes('novia') ||
      query.includes('esposa') ||
      query.includes('pedida') ||
      query.includes('mano') ||
      query.includes('pareja') ||
      query.includes('romant')
    ) {
      const prodCoreano = catalogo.find((p) => p.id === 'tinkay-bouq-mix' || p.slug === 'bouquet-coreano') ?? catalogo[0]!;
      const prodAmor = catalogo.find((p) => p.id === 'tinkay-bouq-san-valentin' || p.slug === 'bouquets-especiales-puro-amor') ?? catalogo[3] ?? catalogo[0]!;
      return {
        texto:
          '¡Qué hermoso detalle! Para romance y fechas inolvidables, nuestro Bouquet Estilo Coreano con papeles plisados y base hidratada es el favorito. También tenemos la majestuosa edición "Puro Amor" con forma de corazón de ~180 rosas rojas.',
        productosSugeridos: [
          {
            producto: prodCoreano,
            variantePorDefecto: prodCoreano.variantes[1] ?? prodCoreano.variantes[0]!,
            mensajeMotivo: '40 rosas de exportación con base hidratada.',
          },
          {
            producto: prodAmor,
            variantePorDefecto: prodAmor.variantes[0]!,
            mensajeMotivo: 'Corazón monumental de rosas rojas de exportación.',
          },
        ],
        sugerenciaDedicatoria: {
          para: 'Mi amor',
          mensaje: FRASES_DEDICATORIAS.amor?.[0] ?? 'Te amo hoy y siempre.',
        },
      };
    }

    // 4. Caso Cumpleaños / Celebración / Alegría
    if (
      query.includes('cumple') ||
      query.includes('cumpleaños') ||
      query.includes('festejo') ||
      query.includes('amiga') ||
      query.includes('mamá') ||
      query.includes('mama')
    ) {
      const prodBox = catalogo.find((p) => p.id === 'box-florales' || p.slug === 'box-florales') ?? catalogo[1] ?? catalogo[0]!;
      const prodCoreano = catalogo.find((p) => p.id === 'tinkay-bouq-mix' || p.slug === 'bouquet-coreano') ?? catalogo[0]!;
      const varBoxM = prodBox.variantes.find((v) => v.nombre.includes('(M)') || v.sku.includes('BOXFLORA')) ?? prodBox.variantes[0]!;
      return {
        texto:
          '¡Qué gran motivo para celebrar! Para cumpleaños te recomiendo nuestros elegantes Box Florales en caja cilíndrica de alta costura o el moderno Bouquet Estilo Coreano con base hidratada.',
        productosSugeridos: [
          {
            producto: prodBox,
            variantePorDefecto: varBoxM,
            mensajeMotivo: 'Box Floral (M) con ~40 rosas de exportación por $40.00.',
          },
          {
            producto: prodCoreano,
            variantePorDefecto: prodCoreano.variantes[0]!,
            mensajeMotivo: 'Bouquet Coreano Mediano con papeles plisados por $28.00.',
          },
        ],
        sugerenciaDedicatoria: {
          para: 'En tu cumpleaños',
          mensaje: FRASES_DEDICATORIAS.cumpleanos?.[0] ?? '¡Muy feliz cumpleaños!',
        },
      };
    }

    // 5. Caso Presupuesto / Económico / Precios
    if (
      query.includes('30') ||
      query.includes('barato') ||
      query.includes('econom') ||
      query.includes('presupuesto') ||
      query.includes('precio') ||
      query.includes('cuanto') ||
      query.includes('cuánto')
    ) {
      const prodFlorero = catalogo.find((p) => p.id === 'tinkay-bouq-florero' || p.slug === 'bouquet-clasico-para-florero') ?? catalogo[2] ?? catalogo[0]!;
      const prodCoreano = catalogo.find((p) => p.id === 'tinkay-bouq-mix' || p.slug === 'bouquet-coreano') ?? catalogo[0]!;
      return {
        texto:
          'Tenemos alternativas accesibles de altísima calidad floral con precios transparentes (Tarifa IVA 0%). Por ejemplo, el ramo de 25 rosas para florero está en $23.00 y el Bouquet Coreano Mediano de 25 rosas en $28.00:',
        productosSugeridos: [
          {
            producto: prodFlorero,
            variantePorDefecto: prodFlorero.variantes[0]!,
            mensajeMotivo: '25 rosas de tallo largo de 70 cm por $23.00.',
          },
          {
            producto: prodCoreano,
            variantePorDefecto: prodCoreano.variantes[0]!,
            mensajeMotivo: '25 rosas en envoltura coreana con base hidratada por $28.00.',
          },
        ],
      };
    }

    // 6. Caso General / Consulta de entrega o compra
    const prodDestacado = catalogo[0]!;
    return {
      texto:
        'Con gusto te asesoro. En Tinkay entregamos flores frescas en Quito y Valles (Cumbayá, Tumbaco, Los Chillos) con opción de franja horaria gratuita, entrega a hora exacta o retiro gratis en nuestra tienda física (https://maps.app.goo.gl/D56gQohzuwha4sLf8). Aquí tienes nuestro arreglo más solicitado del día:',
      productosSugeridos: [
        {
          producto: prodDestacado,
          variantePorDefecto: prodDestacado.variantes[0]!,
          mensajeMotivo: 'El bouquet más pedido por nuestros clientes.',
        },
      ],
    };
  };

  const handleEnviar = (textoOpcional?: string) => {
    const texto = textoOpcional || inputTexto;
    if (!texto.trim()) return;

    const nuevoMensajeUsuario: MensajeChat = {
      id: `usr-${Date.now()}`,
      remitente: 'usuario',
      texto: texto.trim(),
      timestamp: 'Ahora',
    };

    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    setInputTexto('');
    setEscribiendo(true);

    // Simulación del tiempo de pensamiento botánico de ARIA
    setTimeout(() => {
      const respuesta = procesarMensajeUsuario(texto);
      const nuevoMensajeAria: MensajeChat = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto: respuesta.texto,
        timestamp: 'Ahora',
        productosSugeridos: respuesta.productosSugeridos,
        sugerenciaDedicatoria: respuesta.sugerenciaDedicatoria,
      };

      setMensajes((prev) => [...prev, nuevoMensajeAria]);
      setEscribiendo(false);
    }, 700);
  };

  const handleAgregarDesdeChat = (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    dedicatoriaSugerida?: { para: string; mensaje: string }
  ) => {
    agregarItem(
      producto,
      variante,
      dedicatoriaSugerida
        ? {
            para: dedicatoriaSugerida.para,
            de: '',
            mensaje: dedicatoriaSugerida.mensaje,
          }
        : undefined
    );

    setItemRecienAgregado(producto.id);
    setTimeout(() => setItemRecienAgregado(null), 2500);
  };

  return (
    <>
      {/* Botón Flotante para Abrir Chat */}
      {!abierto && (
        <button
          type="button"
          className="btn-flotante-chat-tinkay"
          onClick={() => setAbierto(true)}
          aria-label="Abrir asistente floral Mía"
        >
          <div className="chispa-badge-chat">
            <Sparkles size={13} />
          </div>
          <div className="icono-avatar-chat">
            <span role="img" aria-label="Flores">🌹</span>
          </div>
          <div className="texto-boton-flotante">
            <span className="nombre-agente">Mía — Asesora Floral</span>
            <small className="estado-en-linea">En línea • Consulta y pide aquí</small>
          </div>
        </button>
      )}

      {/* Ventana de Chat de ARIA */}
      {abierto && (
        <div className="ventana-chat-flotante" role="dialog" aria-label="Chat con Mía">
          {/* Cabecera del Chat */}
          <div className="cabecera-chat-aria">
            <div className="info-agente-cabecera">
              <div className="avatar-mia-circulo">
                <span>🌿</span>
                <span className="dot-en-linea" />
              </div>
              <div className="titulos-agente">
                <strong>Mía | Tinkay Floristería</strong>
                <span>Sommelier floral &amp; Ventas en vivo</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-cerrar-chat"
              onClick={() => setAbierto(false)}
              aria-label="Minimizar chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div className="cuerpo-mensajes-chat" ref={scrollRef}>
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`fila-mensaje-chat ${m.remitente === 'usuario' ? 'mensaje-usuario' : 'mensaje-aria'}`}
              >
                {m.remitente === 'aria' && (
                  <div className="icono-emisor-mini">🌿</div>
                )}

                <div className="burbuja-mensaje">
                  <p>{m.texto}</p>

                  {/* Tarjetas de Productos Sugeridos por ARIA */}
                  {m.productosSugeridos && m.productosSugeridos.length > 0 && (
                    <div className="sugerencias-productos-chat">
                      {m.productosSugeridos.map(({ producto, variantePorDefecto, mensajeMotivo }) => (
                        <div key={producto.id} className="tarjeta-sugerencia-chat">
                          <img
                            src={producto.fotos[0]}
                            alt={producto.nombre}
                            className="foto-sugerencia-chat"
                          />
                          <div className="info-sugerencia-chat">
                            <strong>{producto.nombre}</strong>
                            {mensajeMotivo && <small>{mensajeMotivo}</small>}
                            <span className="precio-sugerencia-chat">
                              ${variantePorDefecto.pvp.toFixed(2)} USD
                            </span>

                            <div className="botones-accion-chat">
                              <button
                                type="button"
                                className="btn-chat-ver"
                                onClick={() => setProductoSeleccionadoModal(producto)}
                              >
                                Ver fotos
                              </button>
                              <button
                                type="button"
                                className="btn-chat-agregar"
                                onClick={() =>
                                  handleAgregarDesdeChat(
                                    producto,
                                    variantePorDefecto,
                                    m.sugerenciaDedicatoria
                                  )
                                }
                              >
                                {itemRecienAgregado === producto.id ? (
                                  <>
                                    <Check size={13} />
                                    <span>¡Agregado!</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingBag size={13} />
                                    <span>Agregar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sugerencia de Dedicatoria si aplica */}
                  {m.sugerenciaDedicatoria && (
                    <div className="caja-dedicatoria-sugerida-chat">
                      <span>💌 Propuesta de dedicatoria para la tarjeta:</span>
                      <em>&quot;{m.sugerenciaDedicatoria.mensaje}&quot;</em>
                    </div>
                  )}

                  <span className="timestamp-mensaje">{m.timestamp}</span>
                </div>
              </div>
            ))}

            {escribiendo && (
              <div className="fila-mensaje-chat mensaje-aria">
                <div className="icono-emisor-mini">🌿</div>
                <div className="burbuja-mensaje burbuja-escribiendo">
                  <span className="dot-typing" />
                  <span className="dot-typing" />
                  <span className="dot-typing" />
                </div>
              </div>
            )}
          </div>

          {/* Sugerencias Rápidas de Inicio */}
          <div className="carrusel-chips-sugerencias-chat">
            {SUGERENCIAS_RAPIDAS.map((sug) => (
              <button
                key={sug.id}
                type="button"
                className="chip-pregunta-rapida"
                onClick={() => handleEnviar(sug.texto)}
              >
                {sug.texto}
              </button>
            ))}
          </div>

          {/* Barra de Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEnviar();
            }}
            className="barra-input-chat"
          >
            <input
              type="text"
              placeholder="Pregúntale a Mía sobre arreglos, entregas o dedicatorias..."
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              className="input-texto-chat"
            />
            <button
              type="submit"
              className="btn-enviar-mensaje-chat"
              disabled={!inputTexto.trim()}
              aria-label="Enviar mensaje"
            >
              <Send size={16} />
            </button>
          </form>

          {/* Banner inferior si hay ítems en el carrito */}
          {cantidadTotal > 0 && (
            <div className="banner-carrito-en-chat">
              <span>{cantidadTotal} arreglo(s) en tu carrito</span>
              <button
                type="button"
                className="btn-ir-al-carrito-chat"
                onClick={() => setDrawerAbierto(true)}
              >
                <span>Ver Carrito &amp; Pagar</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
