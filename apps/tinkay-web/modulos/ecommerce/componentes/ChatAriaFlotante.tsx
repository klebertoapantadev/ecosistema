'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  SelectorUbicacionEntrega,
  construirEnlaceCategoriaTienda,
  interpretarEnlaceTienda,
  leerAtribucionNavegador,
  nombreCanalRealtimeOmnicanal,
  obtenerSaludoInicialChatPorIntencion,
  type EventoBroadcastChatWeb,
  type EventoBroadcastIntervencionAsesor,
} from '@eco/comercio';
import { crearClienteNavegador } from '@eco/supabase/cliente';
import { useCarrito } from '../contexto-carrito';
import {
  IconoWhatsappVector,
  abrirWhatsappTiendaConPuenteOmnicanal,
} from '../puente-omnicanal-cliente';
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
  MapPin,
  Link2,
} from 'lucide-react';

const MENSAJES_INICIALES: MensajeChat[] = [
  {
    id: 'msg-init-1',
    remitente: 'aria',
    texto:
      '¡Hola! Soy Mía 🌿, sommelier floral de Tinkay. ¿Para qué ocasión o evento especial buscamos flores hoy? Si prefieres hablar directo por WhatsApp, toca el ícono verde de WhatsApp abajo a la izquierda.',
    timestamp: 'Ahora',
  },
];

const SUGERENCIAS_RAPIDAS = [
  { id: 'whatsapp_directo', texto: 'WhatsApp directo' },
  { id: 'inmediata', texto: '⚡ Entrega Inmediata (1–2h)' },
  { id: 'eventos', texto: '🎉 Eventos y Bodas' },
  { id: 'amor', texto: '🌹 Sorpresa de Amor / Aniversario' },
  { id: 'cumple', texto: '🎂 Cumpleaños Alegre' },
  { id: 'condolencias', texto: '🕊️ Condolencias y Respeto' },
];

type CotizacionChat = NonNullable<MensajeChat['cotizacionEnvio']>;

type ResultadoConsultaAria =
  | {
      estado: 'ok';
      texto: string;
      conversacionOmnicanalId?: string | null;
      cotizacionEnvio?: CotizacionChat;
    }
  | {
      estado: 'modo_humano';
      asesoraNombre: string;
      conversacionOmnicanalId?: string | null;
      cotizacionEnvio?: CotizacionChat;
    }
  | { estado: 'sin_configurar'; cotizacionEnvio?: CotizacionChat }
  | { estado: 'error_temporal'; cotizacionEnvio?: CotizacionChat };

const CLAVE_CONVERSACION_STORAGE = 'eco_chat_conv_tinkay';
const CLAVE_VISITANTE_STORAGE = 'eco_chat_visitante_tinkay';

interface PerfilVisitanteChat {
  nombre: string;
  correo?: string;
  telefono?: string;
  esRegistrado?: boolean;
}

function crearConversacionId(): string {
  if (typeof window !== 'undefined') {
    const existente = window.localStorage.getItem(CLAVE_CONVERSACION_STORAGE);
    if (existente && /^[A-Za-z0-9_-]{8,64}$/.test(existente)) {
      return existente;
    }
  }
  const nuevo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CLAVE_CONVERSACION_STORAGE, nuevo);
    } catch {
      // Ignorar modo privado sin storage
    }
  }
  return nuevo;
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

/** Canal de Supabase Realtime tal como lo devuelve `supabase.channel()`. */
type CanalRealtimeChat = ReturnType<ReturnType<typeof crearClienteNavegador>['channel']>;

export function ChatAriaFlotante() {
  const {
    agregarItem,
    productoSeleccionadoModal,
    setProductoSeleccionadoModal,
    setDrawerAbierto,
    cantidadTotal,
    productos,
    categorias,
    categoriaActiva,
    navegarACategoria,
    abrirProductoPorIdentificador,
    obtenerEnlaceProducto,
    configLogistica,
    configTiendaCheckout,
    entregaUnificada,
    actualizarEntregaUnificada,
    usuarioRegistrado,
  } = useCarrito();

  const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>(MENSAJES_INICIALES);
  const [inputTexto, setInputTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [itemRecienAgregado, setItemRecienAgregado] = useState<string | null>(null);
  const [linkChatCopiadoId, setLinkChatCopiadoId] = useState<string | null>(null);
  const [selectorMapaAbierto, setSelectorMapaAbierto] = useState(false);
  const [ubicacionAplicadaId, setUbicacionAplicadaId] = useState<string | null>(null);
  const [asesoraHumanaActiva, setAsesoraHumanaActiva] = useState<string | null>(null);
  const [perfilVisitante, setPerfilVisitante] = useState<PerfilVisitanteChat | null>(null);
  const [editandoVisitante, setEditandoVisitante] = useState(false);
  const [formNombreVisitante, setFormNombreVisitante] = useState('');
  const [formContactoVisitante, setFormContactoVisitante] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const conversacionId = useRef<string>(crearConversacionId());
  const idsHumanosVistos = useRef<Set<string>>(new Set());
  const canalRealtimeRef = useRef<CanalRealtimeChat | null>(null);
  const realtimeConectadoRef = useRef<boolean>(false);

  const emitirEventoRealtimeCliente = (payload: EventoBroadcastChatWeb) => {
    try {
      const canal = canalRealtimeRef.current;
      if (!canal) return;
      void canal.send({
        type: 'broadcast',
        event: 'actividad_chat_web',
        payload,
      });
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const guardado = window.localStorage.getItem(CLAVE_CONVERSACION_STORAGE);
        if (guardado && /^[A-Za-z0-9_-]{8,64}$/.test(guardado)) {
          conversacionId.current = guardado;
        } else {
          window.localStorage.setItem(CLAVE_CONVERSACION_STORAGE, conversacionId.current);
        }

        const visRaw = window.localStorage.getItem(CLAVE_VISITANTE_STORAGE);
        if (visRaw) {
          const vis = JSON.parse(visRaw) as PerfilVisitanteChat;
          if (vis?.nombre) {
            setPerfilVisitante(vis);
            setFormNombreVisitante(vis.nombre);
            setFormContactoVisitante(vis.telefono || vis.correo || '');
          }
        }
      } catch {
        // Ignorar modo privado
      }
    }

    let cancelado = false;
    try {
      const supabase = crearClienteNavegador();
      supabase.auth.getUser().then(async ({ data }) => {
        if (cancelado || !data?.user) return;
        const { data: u } = await supabase
          .schema('comun_seguridad')
          .from('seg_usuario')
          .select('usu_nombres, usu_apellidos, usu_correo, usu_whatsapp')
          .eq('usu_id', data.user.id)
          .maybeSingle();
        if (cancelado) return;
        const nombreReg =
          [u?.usu_nombres, u?.usu_apellidos].filter(Boolean).join(' ').trim() ||
          data.user.email?.split('@')[0] ||
          'Cliente';
        const perfilAuth: PerfilVisitanteChat = {
          nombre: nombreReg,
          correo: u?.usu_correo || data.user.email || undefined,
          telefono: u?.usu_whatsapp || undefined,
          esRegistrado: true,
        };
        setPerfilVisitante(perfilAuth);
        setFormNombreVisitante(perfilAuth.nombre);
        setFormContactoVisitante(perfilAuth.telefono || perfilAuth.correo || '');
      });
    } catch {
      // Continuar como visitante invitado
    }
    return () => {
      cancelado = true;
    };
  }, []);

  const handleGuardarIdentidadVisitante = (e: React.FormEvent) => {
    e.preventDefault();
    const nom = formNombreVisitante.trim();
    if (nom.length < 2) return;
    const cont = formContactoVisitante.trim();
    const esCorreo = cont.includes('@');
    const nuevo: PerfilVisitanteChat = {
      nombre: nom,
      correo: esCorreo ? cont.toLowerCase() : perfilVisitante?.correo,
      telefono: !esCorreo && cont ? cont : perfilVisitante?.telefono,
      esRegistrado: perfilVisitante?.esRegistrado,
    };
    setPerfilVisitante(nuevo);
    setEditandoVisitante(false);
    try {
      window.localStorage.setItem(CLAVE_VISITANTE_STORAGE, JSON.stringify(nuevo));
    } catch {
      // Ignorar modo privado
    }
  };

  // Canal WebSocket Supabase Realtime instantáneo (<50ms) bidireccional con /panel/conversaciones
  useEffect(() => {
    let supabase: ReturnType<typeof crearClienteNavegador> | null = null;
    let canal: CanalRealtimeChat | null = null;
    try {
      supabase = crearClienteNavegador();
      canal = supabase
        .channel(nombreCanalRealtimeOmnicanal('tinkay'), {
          config: { broadcast: { self: false } },
        })
        .on(
          'broadcast',
          { event: 'intervencion_asesor' },
          ({ payload }: { payload: EventoBroadcastIntervencionAsesor }) => {
            if (!payload || payload.claveHilo !== conversacionId.current) return;

            if (payload.estadoAtencion === 'EN_ATENCION_ASESORA') {
              setAsesoraHumanaActiva(payload.asesoraNombre || 'Asesora Tinkay');
            } else if (payload.estadoAtencion === 'BOT_ACTIVO') {
              setAsesoraHumanaActiva(null);
            }

            if (payload.mensaje && !payload.esNotaInterna && payload.mensaje.id) {
              if (!idsHumanosVistos.current.has(payload.mensaje.id)) {
                idsHumanosVistos.current.add(payload.mensaje.id);
                const contenidoMsg = payload.mensaje.contenido;
                setMensajes((prev) => [
                  ...prev,
                  {
                    id: `hum-${payload.mensaje!.id}`,
                    remitente: 'asesora',
                    autorNombre:
                      payload.mensaje!.autorNombre || payload.asesoraNombre || 'Asesora Tinkay',
                    texto: contenidoMsg,
                    timestamp: 'En vivo',
                    productosSugeridos: productosMencionados(contenidoMsg),
                  },
                ]);
                setAbierto(true);
              }
            }
          }
        )
        .subscribe((status: string) => {
          realtimeConectadoRef.current = status === 'SUBSCRIBED';
        });
      canalRealtimeRef.current = canal;
    } catch {
      // Respaldo por polling activo abajo
    }

    return () => {
      realtimeConectadoRef.current = false;
      canalRealtimeRef.current = null;
      if (supabase && canal) {
        void supabase.removeChannel(canal);
      }
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;

    const sincronizarMensajesAsesora = async () => {
      try {
        const res = await fetch(
          `/api/chat?conversation_id=${encodeURIComponent(conversacionId.current)}`,
          { method: 'GET', cache: 'no-store' }
        );
        if (!res.ok || cancelado) return;
        const data = (await res.json()) as {
          existe?: boolean;
          estadoAtencion?: string;
          asesoraNombre?: string | null;
          mensajesHumanos?: Array<{
            id: string;
            autorNombre: string;
            contenido: string;
            creadoEn: string;
          }>;
        };
        if (cancelado) return;

        if (data.estadoAtencion === 'EN_ATENCION_ASESORA') {
          setAsesoraHumanaActiva(data.asesoraNombre || 'Asesora Tinkay');
        } else if (data.estadoAtencion === 'BOT_ACTIVO') {
          setAsesoraHumanaActiva(null);
        }

        const recibidos = Array.isArray(data.mensajesHumanos) ? data.mensajesHumanos : [];
        const nuevos = recibidos.filter((m) => m.id && !idsHumanosVistos.current.has(m.id));
        if (nuevos.length > 0) {
          nuevos.forEach((m) => idsHumanosVistos.current.add(m.id));
          setMensajes((prev) => [
            ...prev,
            ...nuevos.map((m) => ({
              id: `hum-${m.id}`,
              remitente: 'asesora' as const,
              autorNombre: m.autorNombre || data.asesoraNombre || 'Asesora Tinkay',
              texto: m.contenido,
              timestamp: 'En vivo',
              productosSugeridos: productosMencionados(m.contenido),
            })),
          ]);
        }
      } catch {
        // Silencioso en caso de desconexión temporal
      }
    };

    let ultimoRespaldoMs = Date.now();
    void sincronizarMensajesAsesora();

    // Realtime entrega mensajes humanos al instante; el polling actúa solo como
    // respaldo (60 s si Realtime está conectado, 12 s si no) y se pausa si la pestaña está oculta.
    const intervalo = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const intervaloObjetivoMs = realtimeConectadoRef.current ? 60000 : 12000;
      if (Date.now() - ultimoRespaldoMs >= intervaloObjetivoMs) {
        ultimoRespaldoMs = Date.now();
        void sincronizarMensajesAsesora();
      }
    }, 12000);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimoRespaldoMs >= 10000) {
        ultimoRespaldoMs = Date.now();
        void sincronizarMensajesAsesora();
      }
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [abierto]);

  useEffect(() => {
    if (abierto && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, abierto, escribiendo, selectorMapaAbierto]);

  // Respaldo estático usado ÚNICAMENTE cuando el negocio aún no tiene ningún
  // agente ARIA configurado (HTTP 503). Nunca sustituye silenciosamente a ARIA
  // en errores de timeout para no contradecir el hilo conversacional.
  const procesarRespaldoSinAgente = (texto: string, cotizacionEnvio?: CotizacionChat) => {
    const mostrarKm = configLogistica.mostrarKilometrosCliente !== false;
    if (cotizacionEnvio) {
      return {
        texto: cotizacionEnvio.dentroCobertura
          ? `¡Ubicación verificada! El costo de envío es ${
              cotizacionEnvio.costoTotalEnvio === 0
                ? 'GRATIS'
                : `$${cotizacionEnvio.costoTotalEnvio.toFixed(2)} USD`
            }. Puedes pulsar «Usar ubicación» para aplicarla directo a tu carrito.`
          : `Revisé tu ubicación${
              mostrarKm && typeof cotizacionEnvio.distanciaVialKm === 'number'
                ? ` (${cotizacionEnvio.distanciaVialKm.toFixed(1)} km)`
                : ''
            } y supera nuestra cobertura automática. Podemos coordinar entrega especial o retiro sin costo en nuestra tienda física (${
              configLogistica.origenMapaUrl
            }).`,
      };
    }

    const query = normalizar(texto);
    const soloArreglosPrincipales = catalogo.filter(
      (p) => !p.esComplemento && !p.esExtra && p.categoriaPrincipal !== 'cat-detalles'
    );
    const baseFloral = soloArreglosPrincipales.length > 0 ? soloArreglosPrincipales : catalogo;

    if (
      query.includes('domicilio') ||
      query.includes('envio') ||
      query.includes('delivery') ||
      query.includes('transporte') ||
      query.includes('cobertura') ||
      query.includes('flete')
    ) {
      return {
        texto:
          `¡Sí! Entregamos a domicilio en Quito y Pichincha:\n` +
          `• Envío GRATIS en ${configLogistica.zonaGratisNombre}.\n` +
          `• Para valles y otros sectores de Pichincha cotizamos el valor exacto según tu ubicación en el mapa.\n` +
          `• También tienes retiro gratis en tienda: ${configLogistica.origenMapaUrl}\n\n` +
          `Pégame tu link de Google Maps / Apple Maps / Waze o toca el botón 📍 de abajo para darte el valor exacto.`,
      };
    }

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
        texto: `¡Con mucho gusto! Nuestra tienda física y taller floral principal (${configLogistica.origenNombre}) está en Quito. Puedes visitarnos o retirar tus pedidos gratis aquí: ${configLogistica.origenMapaUrl}. ¿Te ayudo a cotizar envío a domicilio con el pin 📍?`,
      };
    }

    const niegaCondolencias = /\b(no|ya no|sin|nada de)\b[^.?!]{0,35}\b(condolenc|pesame|duelo|velaci)/.test(query);

    if (
      query.includes('evento') ||
      query.includes('boda') ||
      query.includes('ceremonia') ||
      query.includes('arco') ||
      query.includes('aro') ||
      query.includes('backing') ||
      query.includes('cartel')
    ) {
      const catEvento = categorias.find(
        (c) => normalizar(c.nombre).includes('evento') || normalizar(c.slug).includes('evento')
      );
      const urlCatEventos = construirEnlaceCategoriaTienda({
        negocio: 'tinkay',
        slugCategoria: catEvento?.slug || 'eventos-y-ceremonias',
      });
      const prodsEventos = baseFloral.filter(
        (p) =>
          normalizar(p.categoriaNombre || '').includes('evento') ||
          normalizar(p.categoriaPrincipal || '').includes('evento') ||
          p.esCombo
      );
      return {
        texto:
          `¡Nos encanta acompañar tus eventos y ceremonias! Contamos con arcos florales, backings, carteles de bienvenida y sets configurables a medida.\n\n` +
          `Puedes ver toda la colección de Eventos aquí: ${urlCatEventos}`,
        ...(prodsEventos.length > 0
          ? {
              productosSugeridos: prodsEventos.slice(0, 2).map((pe) => ({
                producto: pe,
                variantePorDefecto: pe.variantes[0]!,
                mensajeMotivo: pe.descripcionCorta,
              })),
            }
          : {}),
      };
    }

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const catObj = categorias.find((c) => c.id === categoriaActiva || c.slug === categoriaActiva);
    const attr = leerAtribucionNavegador('tinkay', {
      categoriaActiva: catObj?.slug || catObj?.nombre || categoriaActiva,
      productoVistoSlug: productoSeleccionadoModal?.slug || undefined,
      productoVistoNombre: productoSeleccionadoModal?.nombre || undefined,
      varianteSku: productoSeleccionadoModal?.variantes?.[0]?.sku || undefined,
    });
    const saludoContextual = obtenerSaludoInicialChatPorIntencion(attr.intencionDetectada, {
      nombreAgente: 'Mía',
      nombreNegocio: 'Tinkay',
      productoNombre: attr.productoVistoNombre,
    });
    setMensajes((prev) => {
      if (prev.length === 1 && prev[0]?.id === 'msg-init-1' && prev[0].texto !== saludoContextual) {
        return [{ ...prev[0], texto: saludoContextual }];
      }
      return prev;
    });
  }, [categoriaActiva, categorias, productoSeleccionadoModal]);

  // Consulta a ARIA con 1 reintento automático ante micro-cortes o timeouts transitorios (502/504).
  const consultarAria = async (texto: string): Promise<ResultadoConsultaAria> => {
    let ultimaCotizacion: CotizacionChat | undefined;
    const catObj = categorias.find((c) => c.id === categoriaActiva || c.slug === categoriaActiva);
    const atribucionActual =
      typeof window !== 'undefined'
        ? leerAtribucionNavegador('tinkay', {
            categoriaActiva: catObj?.slug || catObj?.nombre || categoriaActiva,
            productoVistoSlug: productoSeleccionadoModal?.slug || undefined,
            productoVistoNombre: productoSeleccionadoModal?.nombre || undefined,
            varianteSku: productoSeleccionadoModal?.variantes?.[0]?.sku || undefined,
          })
        : undefined;

    for (let intento = 0; intento < 2; intento++) {
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: texto,
            conversation_id: conversacionId.current,
            ...(atribucionActual ? { atribucion: atribucionActual } : {}),
            ...(perfilVisitante
              ? {
                  visitante: {
                    nombre: perfilVisitante.nombre,
                    correo: perfilVisitante.correo,
                    telefono: perfilVisitante.telefono,
                  },
                }
              : {}),
          }),
        });

        const data = (await r.json().catch(() => ({}))) as {
          response?: string | null;
          modoHumano?: boolean;
          asesoraNombre?: string;
          conversacionOmnicanalId?: string | null;
          cotizacionEnvio?: CotizacionChat;
        };
        if (data.cotizacionEnvio) {
          ultimaCotizacion = data.cotizacionEnvio;
        }

        if (r.ok && data.modoHumano) {
          return {
            estado: 'modo_humano',
            asesoraNombre: data.asesoraNombre || 'Asesora Tinkay',
            conversacionOmnicanalId: data.conversacionOmnicanalId ?? null,
            cotizacionEnvio: ultimaCotizacion,
          };
        }

        if (r.status === 503) {
          return { estado: 'sin_configurar', cotizacionEnvio: ultimaCotizacion };
        }

        if (r.ok) {
          const respuesta = data.response?.trim();
          if (respuesta) {
            return {
              estado: 'ok',
              texto: limpiarMarkdown(respuesta),
              conversacionOmnicanalId: data.conversacionOmnicanalId ?? null,
              cotizacionEnvio: ultimaCotizacion,
            };
          }
        }
      } catch {
        // Reintentar en el segundo paso si fue corte de red
      }

      if (intento === 0) {
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }

    return { estado: 'error_temporal', cotizacionEnvio: ultimaCotizacion };
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

      // Notificación instantánea (<50ms) a la Consola de Ventas antes de que responda la IA
      const ahoraCli = new Date().toISOString();
      emitirEventoRealtimeCliente({
        eventoId: `cli-${conversacionId.current}-${Date.now()}`,
        claveHilo: conversacionId.current,
        fase: 'ENTRADA_CLIENTE',
        contenido: texto,
        autorNombre: perfilVisitante?.nombre || null,
        remitenteNombre: perfilVisitante?.nombre || null,
        remitenteCorreo: perfilVisitante?.correo || null,
        remitenteTelefono: perfilVisitante?.telefono || null,
        creadoEn: ahoraCli,
      });
    }

    setEscribiendo(true);

    const resultado = await consultarAria(texto);

    if (resultado.estado === 'modo_humano') {
      setAsesoraHumanaActiva(resultado.asesoraNombre);
      if (resultado.cotizacionEnvio) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `cot-hum-${Date.now()}`,
            remitente: 'asesora',
            autorNombre: resultado.asesoraNombre,
            texto: `📍 Ubicación recibida por ${resultado.asesoraNombre}. Puedes aplicarla a tu carrito mientras te responde en vivo:`,
            timestamp: 'En vivo',
            cotizacionEnvio: resultado.cotizacionEnvio,
          },
        ]);
      }
      setEscribiendo(false);
      return;
    }

    let nuevoMensajeAria: MensajeChat;
    if (resultado.estado === 'ok') {
      nuevoMensajeAria = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto: resultado.texto,
        timestamp: 'Ahora',
        productosSugeridos: productosMencionados(resultado.texto),
        cotizacionEnvio: resultado.cotizacionEnvio,
      };
    } else if (resultado.estado === 'sin_configurar') {
      const respaldo = procesarRespaldoSinAgente(texto, resultado.cotizacionEnvio);
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversacionId.current,
          respuesta_respaldo: respaldo.texto,
        }),
      }).catch(() => {});
      nuevoMensajeAria = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto: respaldo.texto,
        timestamp: 'Ahora',
        productosSugeridos: 'productosSugeridos' in respaldo ? respaldo.productosSugeridos : undefined,
        sugerenciaDedicatoria:
          'sugerenciaDedicatoria' in respaldo ? respaldo.sugerenciaDedicatoria : undefined,
        cotizacionEnvio: resultado.cotizacionEnvio,
      };
    } else {
      nuevoMensajeAria = {
        id: `aria-${Date.now()}`,
        remitente: 'aria',
        texto:
          'Disculpa, nuestro catálogo en vivo tardó unos segundos más de lo habitual en responder. Pulsa «Reintentar» para retomar exactamente tu consulta.',
        timestamp: 'Ahora',
        reintentarTexto: texto,
        cotizacionEnvio: resultado.cotizacionEnvio,
      };
    }

    setMensajes((prev) => [...prev, nuevoMensajeAria]);
    setEscribiendo(false);

    if (resultado.estado === 'ok' || resultado.estado === 'sin_configurar') {
      emitirEventoRealtimeCliente({
        eventoId: `ia-${conversacionId.current}-${Date.now()}`,
        claveHilo: conversacionId.current,
        conversacionId:
          resultado.estado === 'ok' ? resultado.conversacionOmnicanalId ?? null : null,
        fase: 'RESPUESTA_ARIA',
        contenido: nuevoMensajeAria.texto,
        autorNombre: 'Mía (ARIA IA)',
        creadoEn: new Date().toISOString(),
      });
    }
  };

  const aplicarCotizacionAlCarrito = (mensajeId: string, cot: CotizacionChat) => {
    const dirPreviaEraAuto =
      !entregaUnificada.direccion ||
      entregaUnificada.direccion === entregaUnificada.detalleDireccionGeo?.resumenDireccion ||
      entregaUnificada.direccion.startsWith('Retiro en ');
    actualizarEntregaUnificada({
      retiroEnLocal: false,
      enlaceMapa: cot.enlaceMapa,
      lat: cot.lat,
      lng: cot.lng,
      zonaDetectadaNombre: cot.zonaDetectadaNombre,
      distanciaVialKm: cot.distanciaVialKm,
      costoEnvioCalculado: cot.costoTotalEnvio,
      dentroCobertura: cot.dentroCobertura,
      etiquetaCotizacion: cot.etiquetaResumen,
      ciudad: cot.parroquia || cot.zonaDetectadaNombre || configLogistica.zonaGratisNombre,
      detalleDireccionGeo: cot.direccionReferencial
        ? {
            resumenDireccion: cot.direccionReferencial,
            callePrincipal: cot.callePrincipal,
            sectorBarrio: cot.sectorBarrio,
            parroquia: cot.parroquia,
          }
        : null,
      ...(dirPreviaEraAuto && cot.direccionReferencial
        ? { direccion: cot.direccionReferencial }
        : {}),
    });
    setUbicacionAplicadaId(mensajeId);
    setTimeout(() => setUbicacionAplicadaId(null), 2500);
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

  const handleCopiarLinkDesdeChat = async (claveId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkChatCopiadoId(claveId);
      setTimeout(() => setLinkChatCopiadoId(null), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  const detectarCategoriasMencionadas = (textoMensaje: string) => {
    const normMsg = normalizar(textoMensaje);
    return (categorias || [])
      .filter((c) => c.id !== 'cat-todos' && c.slug !== 'todos' && !normalizar(c.nombre).includes('extra'))
      .filter((c) => {
        const nomCat = normalizar(c.nombre);
        const slugCat = normalizar(c.slug).replace(/-/g, ' ');
        return (
          (nomCat.length >= 4 && normMsg.includes(nomCat)) ||
          (slugCat.length >= 5 && normMsg.includes(slugCat)) ||
          (nomCat.includes('evento') && /\b(eventos|ceremonias)\b/.test(normMsg))
        );
      })
      .slice(0, 2);
  };

  const renderizarTextoConEnlaces = (texto: string) => {
    const partes = texto.split(/(https?:\/\/[^\s)]+)/g);
    return partes.map((parte, idx) => {
      if (!/^https?:\/\//i.test(parte)) {
        return <React.Fragment key={idx}>{parte}</React.Fragment>;
      }
      const matchFinal = parte.match(/[.,;!?]+$/);
      const puntuacionFinal = matchFinal ? matchFinal[0] : '';
      const urlLimpia = puntuacionFinal ? parte.slice(0, -puntuacionFinal.length) : parte;
      const destino = interpretarEnlaceTienda(urlLimpia);

      if (destino.tipo === 'categoria' && destino.categoria) {
        return (
          <React.Fragment key={idx}>
            <a
              href={urlLimpia}
              onClick={(e) => {
                e.preventDefault();
                navegarACategoria(destino.categoria!);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setAbierto(false);
                }
              }}
              style={{
                color: '#15803D',
                fontWeight: 700,
                textDecoration: 'underline',
                wordBreak: 'break-all',
              }}
            >
              {urlLimpia}
            </a>
            {puntuacionFinal}
          </React.Fragment>
        );
      }

      if (destino.tipo === 'producto' && destino.producto) {
        return (
          <React.Fragment key={idx}>
            <a
              href={urlLimpia}
              onClick={(e) => {
                e.preventDefault();
                const abrio = abrirProductoPorIdentificador(destino.producto!, destino.variante);
                if (abrio && typeof window !== 'undefined' && window.innerWidth < 768) {
                  setAbierto(false);
                }
              }}
              style={{
                color: '#BE185D',
                fontWeight: 700,
                textDecoration: 'underline',
                wordBreak: 'break-all',
              }}
            >
              {urlLimpia}
            </a>
            {puntuacionFinal}
          </React.Fragment>
        );
      }

      return (
        <React.Fragment key={idx}>
          <a
            href={urlLimpia}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0369A1',
              fontWeight: 600,
              textDecoration: 'underline',
              wordBreak: 'break-all',
            }}
          >
            {urlLimpia}
          </a>
          {puntuacionFinal}
        </React.Fragment>
      );
    });
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
                <strong>
                  {asesoraHumanaActiva
                    ? `${asesoraHumanaActiva} | Tinkay en Vivo`
                    : 'Mía | Tinkay Floristería'}
                </strong>
                <span>
                  {asesoraHumanaActiva
                    ? '👩‍💼 Asesora humana conectada contigo'
                    : 'Sommelier floral & Ventas en vivo'}
                </span>
              </div>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  const ultimoUsuario = [...mensajes]
                    .reverse()
                    .find((msg) => msg.remitente === 'usuario');
                  abrirWhatsappTiendaConPuenteOmnicanal({
                    whatsappTienda: configTiendaCheckout?.whatsappTienda,
                    productoNombre: productoSeleccionadoModal?.nombre || null,
                    productoSlug:
                      productoSeleccionadoModal?.slug || productoSeleccionadoModal?.id || null,
                    varianteNombre: productoSeleccionadoModal?.variantes?.[0]?.nombre || null,
                    precioUsd: productoSeleccionadoModal?.variantes?.[0]?.pvp ?? null,
                    urlProducto: productoSeleccionadoModal
                      ? obtenerEnlaceProducto(
                          productoSeleccionadoModal,
                          productoSeleccionadoModal.variantes?.[0]?.sku
                        )
                      : null,
                    consultaInicial:
                      inputTexto.trim() ||
                      (ultimoUsuario?.texto
                        ? `Hola Tinkay 🌿, continuando mi consulta web: "${ultimoUsuario.texto.slice(0, 140)}"`
                        : null),
                  });
                }}
                title="Continuar atención directa en nuestro WhatsApp"
                aria-label="WhatsApp"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  background: '#25D366',
                  color: '#FFFFFF',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <IconoWhatsappVector size={14} color="#FFFFFF" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                className="btn-cerrar-chat"
                onClick={() => setAbierto(false)}
                aria-label="Minimizar chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Franja ligera opcional de identificación para atención personalizada en vivo */}
          <div
            style={{
              padding: '7px 14px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              fontSize: '0.75rem',
              color: '#334155',
            }}
          >
            {!editandoVisitante ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {perfilVisitante
                    ? `👤 ${perfilVisitante.nombre}${
                        perfilVisitante.esRegistrado ? ' (Cuenta Tinkay)' : ''
                      }`
                    : '💬 ¿Deseas dejar tu nombre para atención personalizada?'}
                </span>
                {!perfilVisitante?.esRegistrado && (
                  <button
                    type="button"
                    onClick={() => setEditandoVisitante(true)}
                    title="Indicar tu nombre y contacto para seguimiento de tu pedido"
                    aria-label={perfilVisitante ? 'Editar datos' : 'Identifícate'}
                    style={{
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      borderRadius: '999px',
                      padding: '2px 9px',
                      fontSize: '0.71rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {perfilVisitante ? 'Cambiar' : 'Identifícate'}
                  </button>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleGuardarIdentidadVisitante}
                style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}
              >
                <input
                  type="text"
                  value={formNombreVisitante}
                  onChange={(e) => setFormNombreVisitante(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  style={{
                    flex: '1 1 110px',
                    padding: '5px 8px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.75rem',
                    background: '#FFFFFF',
                  }}
                />
                <input
                  type="text"
                  value={formContactoVisitante}
                  onChange={(e) => setFormContactoVisitante(e.target.value)}
                  placeholder="Celular o correo (opcional)"
                  style={{
                    flex: '1 1 130px',
                    padding: '5px 8px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.75rem',
                    background: '#FFFFFF',
                  }}
                />
                <button
                  type="submit"
                  title="Guardar tus datos en este chat"
                  aria-label="Guardar"
                  style={{
                    padding: '5px 10px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoVisitante(false)}
                  title="Cerrar formulario"
                  aria-label="Cancelar"
                  style={{
                    padding: '4px 7px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </form>
            )}
          </div>

          {/* Historial de Mensajes */}
          <div className="cuerpo-mensajes-chat" ref={scrollRef}>
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`fila-mensaje-chat ${m.remitente === 'usuario' ? 'mensaje-usuario' : 'mensaje-aria'}`}
              >
                {m.remitente !== 'usuario' && (
                  <div className="icono-emisor-mini">
                    {m.remitente === 'asesora' ? '👩‍💼' : '🌿'}
                  </div>
                )}

                <div className="burbuja-mensaje">
                  {m.remitente === 'asesora' && m.autorNombre && (
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#BE185D',
                        marginBottom: '4px',
                      }}
                    >
                      👩‍💼 {m.autorNombre} • Atención personalizada
                    </div>
                  )}
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {m.remitente !== 'usuario' ? renderizarTextoConEnlaces(m.texto) : m.texto}
                  </p>

                  {m.remitente === 'aria' && (() => {
                    const catsDetectadas = detectarCategoriasMencionadas(m.texto);
                    if (catsDetectadas.length === 0) return null;
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginTop: '8px',
                        }}
                      >
                        {catsDetectadas.map((cat) => {
                          const urlCat = construirEnlaceCategoriaTienda({
                            negocio: 'tinkay',
                            slugCategoria: cat.slug || cat.id,
                          });
                          const keyCopy = `cat-${m.id}-${cat.id}`;
                          return (
                            <div
                              key={cat.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  navegarACategoria(cat.id);
                                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                    setAbierto(false);
                                  }
                                }}
                                title={`Abrir categoría ${cat.nombre} en la tienda`}
                                aria-label={`Ver ${cat.nombre}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '5px 10px',
                                  borderRadius: '999px',
                                  border: '1px solid #86EFAC',
                                  background: '#F0FDF4',
                                  color: '#14532D',
                                  fontSize: '0.73rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>Ver {cat.nombre}</span>
                                <ArrowRight size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopiarLinkDesdeChat(keyCopy, urlCat)}
                                title={`Copiar link de ${cat.nombre} para WhatsApp`}
                                aria-label={`Copiar link de ${cat.nombre}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '999px',
                                  border: '1px solid #CBD5E1',
                                  background: linkChatCopiadoId === keyCopy ? '#ECFDF5' : '#FFFFFF',
                                  color: linkChatCopiadoId === keyCopy ? '#047857' : '#475569',
                                  cursor: 'pointer',
                                }}
                              >
                                {linkChatCopiadoId === keyCopy ? (
                                  <Check size={12} />
                                ) : (
                                  <Link2 size={12} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {m.cotizacionEnvio && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: m.cotizacionEnvio.dentroCobertura ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${
                          m.cotizacionEnvio.dentroCobertura ? '#86EFAC' : '#FECACA'
                        }`,
                        fontSize: '0.78rem',
                        color: '#1E293B',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <strong style={{ color: '#14532D' }}>
                          📍 {m.cotizacionEnvio.etiquetaResumen}
                        </strong>
                        <span style={{ fontWeight: 700, color: '#15803D' }}>
                          {m.cotizacionEnvio.costoTotalEnvio === 0
                            ? 'GRATIS'
                            : `$${m.cotizacionEnvio.costoTotalEnvio.toFixed(2)}`}
                        </span>
                      </div>
                      {m.cotizacionEnvio.direccionReferencial && (
                        <div style={{ fontSize: '0.72rem', color: '#334155', lineHeight: 1.35 }}>
                          {m.cotizacionEnvio.direccionReferencial}
                        </div>
                      )}
                      {m.cotizacionEnvio.dentroCobertura && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => aplicarCotizacionAlCarrito(m.id, m.cotizacionEnvio!)}
                            title="Aplicar esta ubicación verificada al carrito"
                            aria-label="Aplicar esta ubicación verificada al carrito"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 11px',
                              borderRadius: '999px',
                              border: 'none',
                              background: '#3D5A45',
                              color: '#FFFFFF',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {ubicacionAplicadaId === m.id ? (
                              <>
                                <Check size={12} />
                                <span>Aplicada</span>
                              </>
                            ) : (
                              <>
                                <MapPin size={12} />
                                <span>Usar ubicación</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

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
                                onClick={() =>
                                  handleCopiarLinkDesdeChat(
                                    `prod-${m.id}-${producto.id}`,
                                    obtenerEnlaceProducto(producto, variantePorDefecto.sku)
                                  )
                                }
                                title="Copiar link directo de este producto"
                                aria-label="Copiar link del producto"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 8px',
                                  borderRadius: '8px',
                                  border: '1px solid #E2E8F0',
                                  background:
                                    linkChatCopiadoId === `prod-${m.id}-${producto.id}`
                                      ? '#ECFDF5'
                                      : '#FFFFFF',
                                  color:
                                    linkChatCopiadoId === `prod-${m.id}-${producto.id}`
                                      ? '#047857'
                                      : '#475569',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {linkChatCopiadoId === `prod-${m.id}-${producto.id}` ? (
                                  <Check size={12} />
                                ) : (
                                  <Link2 size={12} />
                                )}
                                <span>Link</span>
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
                onClick={() => {
                  if (sug.id === 'whatsapp_directo') {
                    abrirWhatsappTiendaConPuenteOmnicanal({
                      whatsappTienda: configTiendaCheckout?.whatsappTienda,
                      productoNombre: productoSeleccionadoModal?.nombre || null,
                      productoSlug:
                        productoSeleccionadoModal?.slug || productoSeleccionadoModal?.id || null,
                      varianteNombre: productoSeleccionadoModal?.variantes?.[0]?.nombre || null,
                      precioUsd: productoSeleccionadoModal?.variantes?.[0]?.pvp ?? null,
                      urlProducto: productoSeleccionadoModal
                        ? obtenerEnlaceProducto(
                            productoSeleccionadoModal,
                            productoSeleccionadoModal.variantes?.[0]?.sku
                          )
                        : null,
                    });
                  } else {
                    void handleEnviar(sug.texto);
                  }
                }}
                style={
                  sug.id === 'whatsapp_directo'
                    ? {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#F0FDF4',
                        border: '1px solid #86EFAC',
                        color: '#15803D',
                        fontWeight: 700,
                      }
                    : undefined
                }
              >
                {sug.id === 'whatsapp_directo' && (
                  <IconoWhatsappVector size={13} color="#16A34A" />
                )}
                <span>{sug.texto}</span>
              </button>
            ))}
          </div>

          {/* Panel compacto de Mapa / Enlace GPS integrado en el Chat */}
          {selectorMapaAbierto && (
            <div
              style={{
                padding: '10px 12px',
                borderTop: '1px solid rgba(61, 90, 69, 0.16)',
                background: '#FAF8F5',
                maxHeight: '310px',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <strong style={{ fontSize: '0.78rem', color: '#2F4837' }}>
                  📍 Cotizar entrega (Link GPS o Mapa Pichincha)
                </strong>
                <button
                  type="button"
                  onClick={() => setSelectorMapaAbierto(false)}
                  title="Cerrar selector de mapa"
                  aria-label="Cerrar selector de mapa"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#64748B',
                    padding: '2px',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              <SelectorUbicacionEntrega
                negocio="tinkay"
                configuracionInicial={configLogistica}
                clienteRegistrado={usuarioRegistrado}
                permitirModoRetiro={configLogistica.permitirRetiroLocal}
                retiroEnLocal={Boolean(entregaUnificada.retiroEnLocal)}
                enlaceMapaInicial={entregaUnificada.enlaceMapa || ''}
                coordenadasIniciales={
                  typeof entregaUnificada.lat === 'number' &&
                  typeof entregaUnificada.lng === 'number'
                    ? { lat: entregaUnificada.lat, lng: entregaUnificada.lng }
                    : null
                }
                mostrarMapaPorDefecto={true}
                onCambioCotizacion={(ev) => {
                  const mostrarKm = configLogistica.mostrarKilometrosCliente !== false;
                  actualizarEntregaUnificada({
                    retiroEnLocal: ev.retiroEnLocal,
                    enlaceMapa: ev.enlaceMapa,
                    lat: ev.cotizacion.destino.lat,
                    lng: ev.cotizacion.destino.lng,
                    zonaDetectadaNombre: ev.cotizacion.zonaDetectada?.nombre,
                    reglaLogisticaAplicada: ev.cotizacion.reglaAplicada,
                    distanciaVialKm: ev.cotizacion.distanciaVialKm,
                    costoEnvioCalculado: ev.cotizacion.costoTotalEnvio,
                    dentroCobertura: ev.cotizacion.dentroCobertura,
                    etiquetaCotizacion: ev.cotizacion.etiquetaResumen,
                    formulaCalculoInterno: ev.cotizacion.formulaDetalle,
                    detalleDireccionGeo: ev.detalleDireccionGeo ?? null,
                    ciudad:
                      ev.detalleDireccionGeo?.parroquia ||
                      ev.cotizacion.zonaDetectada?.nombre ||
                      configLogistica.zonaGratisNombre,
                    ...(ev.direccionSugerida &&
                    (!entregaUnificada.direccion ||
                      entregaUnificada.direccion ===
                        entregaUnificada.detalleDireccionGeo?.resumenDireccion)
                      ? { direccion: ev.direccionSugerida }
                      : {}),
                  });

                  const resumenMsg: MensajeChat = {
                    id: `aria-loc-${Date.now()}`,
                    remitente: 'aria',
                    texto: ev.retiroEnLocal
                      ? `Perfecto 🌿, dejé configurado el retiro sin costo en ${configLogistica.origenNombre} en tu carrito.`
                      : ev.cotizacion.dentroCobertura
                      ? `¡Listo! Guardé tu ubicación de entrega en el carrito: ${ev.cotizacion.etiquetaResumen}${
                          ev.direccionSugerida ? ` (${ev.direccionSugerida})` : ''
                        }.`
                      : `El punto elegido${
                          mostrarKm ? ` (${ev.cotizacion.distanciaVialKm.toFixed(1)} km)` : ''
                        } supera nuestra cobertura automática. Escríbeme aquí para ayudarte con una coordinación especial o retiro en tienda.`,
                    timestamp: 'Ahora',
                    cotizacionEnvio: ev.retiroEnLocal
                      ? undefined
                      : {
                          etiquetaResumen: ev.cotizacion.etiquetaResumen,
                          costoTotalEnvio: ev.cotizacion.costoTotalEnvio,
                          dentroCobertura: ev.cotizacion.dentroCobertura,
                          zonaDetectadaNombre: ev.cotizacion.zonaDetectada?.nombre,
                          ...(mostrarKm ? { distanciaVialKm: ev.cotizacion.distanciaVialKm } : {}),
                          ...(ev.direccionSugerida
                            ? { direccionReferencial: ev.direccionSugerida }
                            : {}),
                          ...(ev.detalleDireccionGeo?.callePrincipal
                            ? { callePrincipal: ev.detalleDireccionGeo.callePrincipal }
                            : {}),
                          ...(ev.detalleDireccionGeo?.sectorBarrio
                            ? { sectorBarrio: ev.detalleDireccionGeo.sectorBarrio }
                            : {}),
                          ...(ev.detalleDireccionGeo?.parroquia
                            ? { parroquia: ev.detalleDireccionGeo.parroquia }
                            : {}),
                          enlaceMapa: ev.enlaceMapa,
                          lat: ev.cotizacion.destino.lat,
                          lng: ev.cotizacion.destino.lng,
                        },
                  };
                  setMensajes((prev) => [...prev, resumenMsg]);
                }}
              />
            </div>
          )}

          {/* Barra de Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleEnviar();
            }}
            className="barra-input-chat"
          >
            <button
              type="button"
              onClick={() => {
                const ultimoUsuario = [...mensajes]
                  .reverse()
                  .find((msg) => msg.remitente === 'usuario');
                abrirWhatsappTiendaConPuenteOmnicanal({
                  whatsappTienda: configTiendaCheckout?.whatsappTienda,
                  productoNombre: productoSeleccionadoModal?.nombre || null,
                  productoSlug:
                    productoSeleccionadoModal?.slug || productoSeleccionadoModal?.id || null,
                  varianteNombre: productoSeleccionadoModal?.variantes?.[0]?.nombre || null,
                  precioUsd: productoSeleccionadoModal?.variantes?.[0]?.pvp ?? null,
                  urlProducto: productoSeleccionadoModal
                    ? obtenerEnlaceProducto(
                        productoSeleccionadoModal,
                        productoSeleccionadoModal.variantes?.[0]?.sku
                      )
                    : null,
                  consultaInicial:
                    inputTexto.trim() ||
                    (ultimoUsuario?.texto
                      ? `Hola Tinkay 🌿, continuando mi consulta web: "${ultimoUsuario.texto.slice(0, 140)}"`
                      : null),
                });
              }}
              title="Contactar directo a nuestro WhatsApp"
              aria-label="Contactar por WhatsApp"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid #16A34A',
                background: '#25D366',
                color: '#FFFFFF',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.28)',
              }}
            >
              <IconoWhatsappVector size={18} color="#FFFFFF" />
            </button>
            <input
              type="text"
              placeholder="Pregúntale a Mía o escribe aquí..."
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              className="input-texto-chat"
            />
            <button
              type="submit"
              className="btn-enviar-mensaje-chat"
              disabled={!inputTexto.trim()}
              aria-label="Enviar mensaje"
              title="Enviar mensaje"
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
