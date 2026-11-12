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
  RefreshCw,
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

type ResultadoConsultaAria =
  | { estado: 'ok'; texto: string }
  | { estado: 'sin_configurar' }
  | { estado: 'error_temporal' };

function crearConversacionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// La burbuja muestra texto limpio sin asteriscos ni enlaces markdown crudos.
function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/!\[[^\]]*\]\(https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function seleccionarVarianteMencionada(
  producto: ProductoEcommerce,
  textoNormalizado: string
): VarianteEcommerce | undefined {
  if (producto.variantes.length === 0) return undefined;
  if (producto.variantes.length === 1) return producto.variantes[0];

  for (const variante of producto.variantes) {
    const nombreVar = normalizar(variante.nombre);
    if (nombreVar.length >= 4 && textoNormalizado.includes(nombreVar)) {
      return variante;
    }
  }

  if (/\b100\s*(tallos|rosas)\b/.test(textoNormalizado)) {
    const v100 = producto.variantes.find((v) => normalizar(v.nombre).includes('100'));
    if (v100) return v100;
  }
  if (/\b50\s*(tallos|rosas)\b/.test(textoNormalizado)) {
    const v50 = producto.variantes.find((v) => normalizar(v.nombre).includes('50'));
    if (v50) return v50;
  }
  if (/\b(grande|talla l|\(l\))\b/.test(textoNormalizado)) {
    const vL = producto.variantes.find((v) => /\b(grande|\(l\))\b/.test(normalizar(v.nombre)));
    if (vL) return vL;
  }
  if (/\b(mediano|mediana|talla m|\(m\))\b/.test(textoNormalizado)) {
    const vM = producto.variantes.find((v) => /\b(mediano|\(m\))\b/.test(normalizar(v.nombre)));
    if (vM) return vM;
  }

  return producto.variantes[0];
}

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
  const conversacionId = useRef<string>(crearConversacionId());

  useEffect(() => {
    if (abierto && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, abierto, escribiendo]);

  // Respaldo estático usado ÚNICAMENTE cuando el negocio aún no tiene ningún
  // agente ARIA configurado (HTTP 503). Nunca sustituye silenciosamente a ARIA
  // en errores de timeout para no contradecir el hilo conversacional.
  const procesarRespaldoSinAgente = (texto: string) => {
    const query = normalizar(texto);
    const soloArreglosPrincipales = catalogo.filter(
      (p) => !p.esComplemento && !p.esExtra && p.categoriaPrincipal !== 'cat-detalles'
    );
    const baseFloral = soloArreglosPrincipales.length > 0 ? soloArreglosPrincipales : catalogo;

    if (
      query.includes('tienda') ||
      query.includes('donde') ||
      query.includes('ubicacion') ||
      query.includes('direccion') ||
      query.includes('local') ||
      query.includes('maps') ||
      query.includes('visitar') ||
      query.includes('retiro')
    ) {
      return {
        texto:
          '¡Con mucho gusto! Nuestra tienda física y taller floral principal está ubicada en Quito. Puedes visitarnos directamente o retirar tus pedidos sin costo de envío aquí: https://maps.app.goo.gl/D56gQohzuwha4sLf8. ¿Te gustaría coordinar un pedido hoy?',
      };
    }

    const niegaCondolencias = /\b(no|ya no|sin|nada de)\b[^.?!]{0,35}\b(condolenc|pesame|duelo|velaci)/.test(query);

    if (
      query.includes('cumple') ||
      query.includes('festejo') ||
      query.includes('amiga') ||
      query.includes('mama')
    ) {
      const prodBox =
        baseFloral.find((p) => p.id === 'box-florales' || p.slug === 'box-florales') ??
        baseFloral.find((p) => !p.esCondolencias) ??
        baseFloral[0]!;
      const prodCoreano =
        baseFloral.find((p) => p.id === 'tinkay-bouq-mix' || p.slug === 'bouquet-coreano') ??
        baseFloral[0]!;
      const varBoxM =
        prodBox.variantes.find((v) => v.nombre.includes('(M)') || v.sku.includes('BOXFLORA')) ??
        prodBox.variantes[0]!;
      return {
        texto:
          '¡Qué gran motivo para celebrar! Para cumpleaños te recomiendo nuestros Box Florales en caja cilíndrica o el Bouquet Estilo Coreano con base hidratada.',
        productosSugeridos: [
          {
            producto: prodBox,
            variantePorDefecto: varBoxM,
            mensajeMotivo: 'Box Floral con rosas de exportación hidratadas.',
          },
          ...(prodCoreano.id !== prodBox.id
            ? [
                {
                  producto: prodCoreano,
                  variantePorDefecto: prodCoreano.variantes[0]!,
                  mensajeMotivo: 'Bouquet Coreano con papeles plisados y base hidratada.',
                },
              ]
            : []),
        ],
        sugerenciaDedicatoria: {
          para: 'En tu cumpleaños',
          mensaje: FRASES_DEDICATORIAS.cumpleanos?.[0] ?? '¡Muy feliz cumpleaños!',
        },
      };
    }

    if (
      !niegaCondolencias &&
      (query.includes('condolencia') ||
        query.includes('pesame') ||
        query.includes('fallec') ||
        query.includes('funeral') ||
        query.includes('velaci') ||
        query.includes('duelo'))
    ) {
      const prodCondol =
        baseFloral.find((p) => p.esCondolencias) ??
        catalogo.find((p) => p.esCondolencias) ??
        baseFloral[0]!;
      const varCondol = prodCondol.variantes[0]!;
      return {
        texto:
          'Comprendo el momento y te acompaño con profundo respeto. Para ocasiones de condolencias y velaciones preparamos composiciones sobrias con rosas blancas, liliums y follajes andinos.',
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

    if (
      query.includes('amor') ||
      query.includes('aniversario') ||
      query.includes('novia') ||
      query.includes('esposa') ||
      query.includes('pedida') ||
      query.includes('pareja') ||
      query.includes('romant')
    ) {
      const prodCoreano =
        baseFloral.find((p) => p.id === 'tinkay-bouq-mix' || p.slug === 'bouquet-coreano') ??
        baseFloral[0]!;
      return {
        texto:
          '¡Qué hermoso detalle! Para romance y aniversarios, nuestro Bouquet Estilo Coreano con papeles plisados y base hidratada es uno de los favoritos.',
        productosSugeridos: [
          {
            producto: prodCoreano,
            variantePorDefecto: prodCoreano.variantes[1] ?? prodCoreano.variantes[0]!,
            mensajeMotivo: 'Rosas de exportación con base hidratada.',
          },
        ],
        sugerenciaDedicatoria: {
          para: 'Mi amor',
          mensaje: FRASES_DEDICATORIAS.amor?.[0] ?? 'Te amo hoy y siempre.',
        },
      };
    }

    const prodDestacado =
      baseFloral.find((p) => !p.esCondolencias && p.destacado) ??
      baseFloral.find((p) => !p.esCondolencias) ??
      baseFloral[0]!;
    return {
      texto:
        'Con gusto te asesoro. En Tinkay entregamos arreglos frescos en Quito y Valles (Cumbayá, Tumbaco, Los Chillos) o con retiro sin costo en nuestra tienda física. Aquí tienes uno de nuestros arreglos florales recomendados:',
      productosSugeridos: [
        {
          producto: prodDestacado,
          variantePorDefecto: prodDestacado.variantes[0]!,
          mensajeMotivo: prodDestacado.descripcionCorta,
        },
      ],
    };
  };

  // Consulta a ARIA con 1 reintento automático ante micro-cortes o timeouts transitorios (502/504).
  const consultarAria = async (texto: string): Promise<ResultadoConsultaAria> => {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: texto, conversation_id: conversacionId.current }),
        });

        if (r.status === 503) {
          return { estado: 'sin_configurar' };
        }

        if (r.ok) {
          const data = (await r.json()) as { response?: string };
          const respuesta = data.response?.trim();
          if (respuesta) {
            return { estado: 'ok', texto: limpiarMarkdown(respuesta) };
          }
        }
      } catch {
        // Reintentar en el segundo paso si fue corte de red
      }

      if (intento === 0) {
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }

    return { estado: 'error_temporal' };
  };

  // Empareja las tarjetas interactivas del catálogo con los arreglos que Mía
  // menciona en su respuesta, evitando sugerir extras/chocolates salvo mención explícita.
  const productosMencionados = (texto: string): MensajeChat['productosSugeridos'] => {
    const normalizado = normalizar(texto);
    const mencionaComplementos = /\b(chocolate|ferrero|globo|mariposa|peluche)\b/.test(normalizado);
    const vistos = new Set<string>();
    const encontrados: NonNullable<MensajeChat['productosSugeridos']> = [];

    const aliasFamilias: Array<{ patron: RegExp; buscar: (p: ProductoEcommerce) => boolean }> = [
      {
        patron: /\b(bouquet coreano|estilo coreano|ramo coreano)\b/,
        buscar: (p) => normalizar(p.nombre).includes('coreano') || p.slug.includes('coreano'),
      },
      {
        patron: /\b(box floral|box florales|caja floral|caja cilindrica)\b/,
        buscar: (p) => normalizar(p.nombre).includes('box') || p.slug.includes('box'),
      },
      {
        patron: /\b(para florero|bouquet clasico|ramo para florero)\b/,
        buscar: (p) => normalizar(p.nombre).includes('florero') || p.slug.includes('florero'),
      },
      {
        patron: /\b(puro amor|corazon de rosas)\b/,
        buscar: (p) => normalizar(p.nombre).includes('puro amor') || p.slug.includes('puro-amor'),
      },
      {
        patron: /\b(pedestal floral|abanico monumental|corona funebre|pedestal)\b/,
        buscar: (p) =>
          Boolean(p.esCondolencias) ||
          normalizar(p.nombre).includes('pedestal') ||
          normalizar(p.nombre).includes('abanico'),
      },
    ];

    for (const producto of catalogo) {
      if ((producto.esComplemento || producto.esExtra || producto.categoriaPrincipal === 'cat-detalles') && !mencionaComplementos) {
        continue;
      }
      const nombre = normalizar(producto.nombreBase ?? producto.nombre);
      if (nombre.length < 5 || vistos.has(producto.id) || !normalizado.includes(nombre)) continue;
      const variante = seleccionarVarianteMencionada(producto, normalizado);
      if (!variante) continue;
      vistos.add(producto.id);
      encontrados.push({ producto, variantePorDefecto: variante });
      if (encontrados.length === 2) return encontrados;
    }

    for (const regla of aliasFamilias) {
      if (!regla.patron.test(normalizado)) continue;
      const producto = catalogo.find(
        (p) =>
          !vistos.has(p.id) &&
          !(p.esComplemento || p.esExtra || p.categoriaPrincipal === 'cat-detalles') &&
          regla.buscar(p)
      );
      if (!producto) continue;
      const variante = seleccionarVarianteMencionada(producto, normalizado);
      if (!variante) continue;
      vistos.add(producto.id);
      encontrados.push({ producto, variantePorDefecto: variante });
      if (encontrados.length === 2) break;
    }

    return encontrados.length > 0 ? encontrados : undefined;
  };

  const handleEnviar = async (textoOpcional?: string, omitirEcoUsuario = false) => {
    const texto = (textoOpcional || inputTexto).trim();
    if (!texto || escribiendo) return;

    if (!omitirEcoUsuario) {
      const nuevoMensajeUsuario: MensajeChat = {
        id: `usr-${Date.now()}`,
        remitente: 'usuario',
        texto,
        timestamp: 'Ahora',
      };
      setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
      setInputTexto('');
    }

    setEscribiendo(true);

    const resultado = await consultarAria(texto);

    let nuevoMensajeAria: MensajeChat;
    if (resultado.estado === 'ok') {
      nuevoMensajeAria = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto: resultado.texto,
        timestamp: 'Ahora',
        productosSugeridos: productosMencionados(resultado.texto),
      };
    } else if (resultado.estado === 'sin_configurar') {
      const respaldo = procesarRespaldoSinAgente(texto);
      nuevoMensajeAria = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto: respaldo.texto,
        timestamp: 'Ahora',
        productosSugeridos: respaldo.productosSugeridos,
        sugerenciaDedicatoria:
          'sugerenciaDedicatoria' in respaldo ? respaldo.sugerenciaDedicatoria : undefined,
      };
    } else {
      nuevoMensajeAria = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto:
          'Disculpa, nuestro catálogo en vivo tardó unos segundos más de lo habitual en responder. Pulsa «Reintentar» para retomar exactamente tu consulta.',
        timestamp: 'Ahora',
        reintentarTexto: texto,
      };
    }

    setMensajes((prev) => [...prev, nuevoMensajeAria]);
    setEscribiendo(false);
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
                  <p style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</p>

                  {m.reintentarTexto && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        disabled={escribiendo}
                        onClick={() => void handleEnviar(m.reintentarTexto, true)}
                        className="btn-responsive-accion"
                        title="Reintentar envío a Mía"
                        aria-label="Reintentar envío a Mía"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          border: '1px solid #3D5A45',
                          background: '#3D5A45',
                          color: '#FFFFFF',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: escribiendo ? 'wait' : 'pointer',
                        }}
                      >
                        <RefreshCw size={13} />
                        <span className="btn-texto-responsive">Reintentar</span>
                      </button>
                    </div>
                  )}

                  {/* Tarjetas de Productos Sugeridos por ARIA */}
                  {m.productosSugeridos && m.productosSugeridos.length > 0 && (
                    <div className="sugerencias-productos-chat">
                      {m.productosSugeridos.map(({ producto, variantePorDefecto, mensajeMotivo }) => (
                        <div key={producto.id} className="tarjeta-sugerencia-chat">
                          <img
                            src={variantePorDefecto.foto ?? producto.fotos[0]}
                            alt={producto.nombre}
                            className="foto-sugerencia-chat"
                          />
                          <div className="info-sugerencia-chat">
                            <strong>{producto.nombre}</strong>
                            <small>{mensajeMotivo ?? variantePorDefecto.nombre}</small>
                            <span className="precio-sugerencia-chat">
                              ${variantePorDefecto.pvp.toFixed(2)} USD
                            </span>

                            <div className="botones-accion-chat">
                              <button
                                type="button"
                                className="btn-chat-ver"
                                onClick={() =>
                                  setProductoSeleccionadoModal({
                                    ...producto,
                                    varianteInicialSku: variantePorDefecto.sku,
                                  })
                                }
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
