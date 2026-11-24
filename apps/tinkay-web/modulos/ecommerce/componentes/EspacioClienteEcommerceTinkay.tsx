'use client';
import { SelectConBuscador } from "@eco/comercio";

import React, { Suspense, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SelectorUbicacionEntrega,
  calcularPrecioPorVolumen,
  descargarArchivoFacturaRideSri,
  eliminarVariacionesProformaClienteAction,
  imprimirFacturaRideSri,
  perteneceCampanaANegocio,
  type ArregloEntregaInmediata,
  type CampanaInformativa,
  type ConfiguracionEmisorSri,
  type ExpedientePedidoClienteCompleto,
} from '@eco/comercio';
import { useCarrito } from '../contexto-carrito';
import { FRASES_DEDICATORIAS, PRODUCTOS_TINKAY } from '../datos-catalogo';
import type { FranjaHoraria, ProductoEcommerce } from '../tipos';
import { ModalEditarProformaCliente } from './ModalEditarProformaCliente';
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Gift,
  Heart,
  MapPin,
  Minus,
  Package,
  Pencil,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  X,
  Zap,
} from 'lucide-react';

export type VistaEspacioCliente = 'pedidos' | 'carrito' | 'proformas' | 'promociones';

export interface PropsEspacioClienteEcommerceTinkay {
  saludo: string;
  nombreCliente: string;
  registrosIniciales: ExpedientePedidoClienteCompleto[];
  emisorSri: ConfiguracionEmisorSri;
  entregaInmediataInicial?: ArregloEntregaInmediata[];
  campanasInformativas?: CampanaInformativa[];
}

const ESTADOS_COMPRA_CONFIRMADA = new Set([
  'PAGADO',
  'ORDEN_CONFIRMADA',
  'EN_PREPARACION',
  'EN_RUTA',
  'DESPACHADO',
  'ENTREGADO',
  'FACTURADA',
  'RESERVADA_70',
  'APROBADA',
]);

function obtenerBadgeEstadoPedido(
  pedido: ExpedientePedidoClienteCompleto
): { etiqueta: string; bg: string; color: string; pasoActual: 1 | 2 | 3 | 4 } {
  const est = (pedido.estado || '').toUpperCase();
  const taller = (pedido.estadoTaller || '').toUpperCase();

  if (pedido.confirmacionEntrega.confirmada || est === 'ENTREGADO' || taller === 'ENTREGADO') {
    return { etiqueta: 'Entregado', bg: '#DCFCE7', color: '#15803D', pasoActual: 4 };
  }
  if (est === 'EN_RUTA' || est === 'DESPACHADO' || taller === 'LISTO_ENTREGA') {
    return { etiqueta: 'En Ruta', bg: '#FEF3C7', color: '#B45309', pasoActual: 3 };
  }
  if (est === 'EN_PREPARACION' || taller === 'EN_PREPARACION' || taller === 'EN_TALLER') {
    return { etiqueta: 'En Taller', bg: '#E0F2FE', color: '#0369A1', pasoActual: 2 };
  }
  if (est === 'RESERVADA_70') {
    return { etiqueta: 'Reserva 70%', bg: '#DBEAFE', color: '#1D4ED8', pasoActual: 1 };
  }
  if (est === 'PAGADO' || est === 'APROBADA' || est === 'FACTURADA') {
    return { etiqueta: 'Pagado', bg: '#DCFCE7', color: '#166534', pasoActual: 1 };
  }
  if (est === 'ORDEN_CONFIRMADA') {
    return { etiqueta: 'Confirmado', bg: '#DBEAFE', color: '#1D4ED8', pasoActual: 1 };
  }
  if (est === 'PENDIENTE_PAGO') {
    return { etiqueta: 'Pendiente Pago', bg: '#FEF3C7', color: '#B45309', pasoActual: 1 };
  }
  if (est === 'NO_ACEPTADA' || est === 'CANCELADO' || est === 'ANULADA') {
    return { etiqueta: 'Cancelado', bg: '#F3F4F6', color: '#6B7280', pasoActual: 1 };
  }
  return { etiqueta: 'Emitida', bg: '#FAF5FF', color: '#6B21A8', pasoActual: 1 };
}

function ContenidoEspacioCliente({
  saludo,
  registrosIniciales,
  emisorSri,
  entregaInmediataInicial = [],
  campanasInformativas = [],
}: PropsEspacioClienteEcommerceTinkay) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const {
    items: itemsCarrito,
    cantidadTotal,
    agregarItem,
    eliminarItem,
    actualizarCantidad,
    actualizarDedicatoria,
    entregaUnificada,
    actualizarEntregaUnificada,
    subtotalBaseImponible,
    totalIva,
    totalFlete,
    totalRecargoHorarioExacto,
    totalPagar,
    setCheckoutAbierto,
    setProductoSeleccionadoModal,
    productos,
    configLogistica,
    estadoRegalo,
    itemsProforma,
    cantidadTotalProforma,
    actualizarCantidadProforma,
    eliminarItemProforma,
    setDrawerProformaAbierto,
    totalProforma,
    reserva70Proforma,
  } = useCarrito();

  const vistaUrl = (searchParams?.get('vista') || '').toLowerCase();
  const pedidoUrl = (searchParams?.get('pedido') || '').trim();
  const vistaActiva: VistaEspacioCliente =
    vistaUrl === 'carrito'
      ? 'carrito'
      : vistaUrl === 'proformas'
      ? 'proformas'
      : vistaUrl === 'promociones'
      ? 'promociones'
      : 'pedidos';

  const cambiarVista = (nueva: VistaEspacioCliente) => {
    router.replace(`/panel?vista=${nueva}`, { scroll: false });
  };

  // Estados locales para modales, filtros y edición
  const [filtroPedidos, setFiltroPedidos] = useState<'todos' | 'en_curso' | 'entregados'>('todos');
  const [pedidoDetalleAbierto, setPedidoDetalleAbierto] =
    useState<ExpedientePedidoClienteCompleto | null>(null);
  const [fotoEvidenciaAmpliada, setFotoEvidenciaAmpliada] = useState<{
    url: string;
    codigo: string;
  } | null>(null);

  const [idsEliminados, setIdsEliminados] = useState<string[]>([]);
  const [gruposEliminados, setGruposEliminados] = useState<string[]>([]);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [avisoOk, setAvisoOk] = useState<string | null>(null);
  const [proformaEditando, setProformaEditando] =
    useState<ExpedientePedidoClienteCompleto | null>(null);

  const [itemDedicatoriaAbierta, setItemDedicatoriaAbierta] = useState<string | null>(null);
  const [avisoCarrito, setAvisoCarrito] = useState<string | null>(null);

  const registrosVisibles = useMemo(
    () =>
      registrosIniciales.filter(
        (r) =>
          !idsEliminados.includes(r.id) &&
          !gruposEliminados.includes(r.grupoProformaId || r.id)
      ),
    [registrosIniciales, idsEliminados, gruposEliminados]
  );

  const misPedidos = useMemo(
    () =>
      registrosVisibles.filter(
        (r) =>
          r.tipoOrigen === 'ORDEN_DIRECTA' ||
          ESTADOS_COMPRA_CONFIRMADA.has((r.estado || '').toUpperCase())
      ),
    [registrosVisibles]
  );

  const misProformas = useMemo(
    () => registrosVisibles.filter((r) => r.tipoOrigen === 'PROFORMA_EVENTO'),
    [registrosVisibles]
  );

  const pedidosFiltrados = useMemo(() => {
    if (filtroPedidos === 'entregados') {
      return misPedidos.filter(
        (p) =>
          p.confirmacionEntrega.confirmada ||
          p.estado === 'ENTREGADO' ||
          p.estadoTaller === 'ENTREGADO'
      );
    }
    if (filtroPedidos === 'en_curso') {
      return misPedidos.filter(
        (p) =>
          !p.confirmacionEntrega.confirmada &&
          p.estado !== 'ENTREGADO' &&
          p.estadoTaller !== 'ENTREGADO'
      );
    }
    return misPedidos;
  }, [misPedidos, filtroPedidos]);

  const catalogoLive = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;

  const complementosSugeridos = useMemo(
    () =>
      catalogoLive
        .filter(
          (p) =>
            p.esComplemento &&
            !p.esRenta &&
            !itemsCarrito.some((it) => it.producto.id === p.id)
        )
        .slice(0, 6),
    [catalogoLive, itemsCarrito]
  );

  // Promociones generales detectadas automáticamente del catálogo activo
  const { ofertasCatalogo, productosVolumen } = useMemo(() => {
    const ofertas: Array<{
      producto: ProductoEcommerce;
      pvpActual: number;
      pvpAnterior: number;
      ahorroPct: number;
      etiquetaPromo: string;
    }> = [];
    const volumen: Array<{
      producto: ProductoEcommerce;
      minUnidades: number;
      pvpVolumen: number;
      pvpBase: number;
    }> = [];

    const idsVistosOferta = new Set<string>();
    const idsVistosVolumen = new Set<string>();

    for (const p of catalogoLive) {
      if (p.esExtra || p.esComplemento) continue;
      const idRaiz = p.proIdUuid || p.id.split('__')[0] || p.id;
      const v0 = p.variantes[0];
      if (!v0) continue;

      if (!idsVistosOferta.has(idRaiz)) {
        const comp = v0.precioComparacion ?? 0;
        if (comp > v0.pvp + 0.25) {
          const pct = Math.max(1, Math.round(((comp - v0.pvp) / comp) * 100));
          ofertas.push({
            producto: p,
            pvpActual: v0.pvp,
            pvpAnterior: comp,
            ahorroPct: pct,
            etiquetaPromo: p.esCombo ? `🎁 SET -${pct}% OFF` : `-${pct}% OFF`,
          });
          idsVistosOferta.add(idRaiz);
        } else if (p.esCombo && (p.comboAhorroPorcentaje ?? 0) > 0) {
          const pct = Math.round(p.comboAhorroPorcentaje || 10);
          ofertas.push({
            producto: p,
            pvpActual: v0.pvp,
            pvpAnterior: p.comboSumaIndividualPvp || Math.round(v0.pvp * (1 + pct / 100)),
            ahorroPct: pct,
            etiquetaPromo: `🎁 SET -${pct}% OFF`,
          });
          idsVistosOferta.add(idRaiz);
        }
      }

      if (!idsVistosVolumen.has(idRaiz) && v0.escalasVolumen && v0.escalasVolumen.length > 0) {
        const esc = v0.escalasVolumen[0]!;
        const calcVol = calcularPrecioPorVolumen({
          pvpUnitarioNominal: v0.pvp,
          tarifaIvaPorcentaje: v0.tarifaIva,
          cantidad: esc.min_cantidad,
          escalas: v0.escalasVolumen,
        });
        if (calcVol.tieneDescuentoVolumen && calcVol.pvpUnitarioFinal < v0.pvp) {
          volumen.push({
            producto: p,
            minUnidades: esc.min_cantidad,
            pvpVolumen: calcVol.pvpUnitarioFinal,
            pvpBase: v0.pvp,
          });
          idsVistosVolumen.add(idRaiz);
        }
      }
    }

    return {
      ofertasCatalogo: ofertas.slice(0, 8),
      productosVolumen: volumen.slice(0, 6),
    };
  }, [catalogoLive]);

  const campanasExclusivasCliente = useMemo(
    () =>
      campanasInformativas.filter(
        (c) =>
          perteneceCampanaANegocio(c, 'tinkay') &&
          c.inf_activo &&
          (c.inf_tipo === 'BENEFICIO_CONVENIO' || c.inf_tipo === 'COMUNICADO_GENERAL') &&
          Array.isArray(c.inf_audiencia) &&
          (c.inf_audiencia.includes('CLIENTES') || c.inf_audiencia.includes('TODOS'))
      ),
    [campanasInformativas]
  );

  const ejecutarAccionFacturaRide = (
    pedido: ExpedientePedidoClienteCompleto,
    modo: 'imprimir' | 'descargar'
  ) => {
    const fac = pedido.facturaElectronica;
    if (!fac) return;
    const payload = {
      negocio: 'tinkay',
      emisor: emisorSri,
      numeroComprobante: fac.numero_comprobante,
      claveAcceso: fac.clave_acceso,
      estadoSri: fac.estado,
      ambiente: fac.ambiente,
      fechaEmision: fac.fecha_emision,
      fechaAutorizacion: fac.fecha_autorizacion,
      comprador: {
        razonSocial:
          fac.comprador?.razon_social || pedido.comprador.nombreCompleto || 'CONSUMIDOR FINAL',
        identificacion:
          fac.comprador?.identificacion || pedido.comprador.identificacion || '9999999999999',
        correo: fac.comprador?.correo || pedido.comprador.correo,
        telefono: fac.comprador?.telefono || pedido.comprador.telefono,
        direccion: fac.comprador?.direccion || pedido.entrega.direccion || 'Quito, Ecuador',
      },
      lineas: fac.lineas,
      rubroPrincipal: fac.rubro_facturado || `Pedido ${pedido.codigo}`,
      codigoRubroPrincipal: fac.codigo_rubro || pedido.codigo,
      subtotal15: fac.subtotal_15,
      subtotal0: fac.subtotal_0,
      subtotalGeneral: fac.subtotal,
      iva15: fac.iva,
      total: fac.total,
      formaPagoTexto:
        (pedido.metodoPago || '').toLowerCase() === 'transferencia'
          ? '20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO (TRANSFERENCIA)'
          : '19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)',
      referenciaPago: pedido.ultimoPagoPlux?.autorizacion || pedido.codigo,
    };

    if (modo === 'imprimir') {
      imprimirFacturaRideSri(payload);
    } else {
      descargarArchivoFacturaRideSri(payload);
    }
  };

  const handleEliminarProforma = (
    prf: ExpedientePedidoClienteCompleto,
    modo: 'UNA' | 'TODAS'
  ) => {
    const msg =
      modo === 'TODAS'
        ? '¿Eliminar todas las variaciones de esta proforma de evento?'
        : `¿Descartar la variación ${prf.codigo}?`;
    if (typeof window !== 'undefined' && !window.confirm(msg)) return;

    setErrorAccion(null);
    startTransition(async () => {
      const res = await eliminarVariacionesProformaClienteAction({
        tokenAprobacion: prf.tokenAprobacion,
        modo,
        proformaObjetivoId: prf.id,
      });
      if (!res.ok) {
        setErrorAccion(res.error);
        return;
      }
      if (modo === 'TODAS') {
        setGruposEliminados((prev) => [...prev, prf.grupoProformaId || prf.id]);
      } else {
        setIdsEliminados((prev) => [...prev, prf.id]);
      }
      router.refresh();
    });
  };

  const handleIrAPagarDesdeTabCarrito = () => {
    setAvisoCarrito(null);
    if (!entregaUnificada.retiroEnLocal) {
      if (entregaUnificada.dentroCobertura === false) {
        setAvisoCarrito(
          `La ubicación seleccionada supera el radio automático de ${configLogistica.radioMaximoKm} km. Elige «Retiro gratis» o coordina en el chat.`
        );
        return;
      }
      if (typeof entregaUnificada.costoEnvioCalculado !== 'number') {
        setAvisoCarrito(
          'Confirma tu ubicación en el mapa o pega un enlace de Google Maps / Waze (o selecciona «Retiro gratis»).'
        );
        return;
      }
    }
    setCheckoutAbierto(true);
  };

  const datosObsequio = estadoRegalo?.regalo ?? {
    sku: 'TIN-VAR-4',
    nombre: 'Bombón Ferrero x1 en Esfera Acrílica',
    valorReferencia: 1.5,
    imagenUrl:
      'https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1793008388305-bouquet_rojo_recostado_esferas_ferrero.jpg',
  };

  const contarHermanas = (grupoId: string) =>
    misProformas.filter((p) => (p.grupoProformaId || p.id) === grupoId).length;

  const totalProformasActivas = misProformas.length + (cantidadTotalProforma > 0 ? 1 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Hero Editorial Cálido de Bienvenida (en sintonía con el e-commerce Tinkay) */}
      <section
        style={{
          background: 'linear-gradient(135deg, #2D4334 0%, #3D5A45 62%, #486850 100%)',
          borderRadius: '22px',
          padding: 'clamp(20px, 4vw, 30px) clamp(18px, 4.5vw, 34px)',
          color: '#FFFFFF',
          boxShadow: '0 14px 32px -12px rgba(45, 67, 52, 0.32)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.14)',
                  border: '1px solid rgba(255, 255, 255, 0.24)',
                  color: '#F8E7BE',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={13} />
                <span>Club Clientes Tinkay</span>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 11px',
                  borderRadius: '999px',
                  background: 'rgba(220, 252, 231, 0.18)',
                  border: '1px solid rgba(187, 247, 208, 0.4)',
                  color: '#DCFCE7',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                }}
              >
                <Truck size={13} />
                <span>
                  Envío Gratis Activo en {configLogistica.zonaGratisNombre || 'Centro-Norte'}
                </span>
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(1.45rem, 4vw, 2rem)',
                fontWeight: 600,
                color: '#FFFFFF',
                lineHeight: 1.2,
              }}
            >
              {saludo}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.92rem',
                color: 'rgba(255, 255, 255, 0.88)',
                lineHeight: 1.5,
              }}
            >
              Revisa tus pedidos con foto de entrega y factura electrónica, edita tu carrito o tus
              proformas de eventos y aprovecha tus beneficios exclusivos de cliente registrado.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              href="/#catalogo"
              title="Explorar arreglos florales en la vitrina"
              aria-label="Ver Catálogo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 18px',
                borderRadius: '999px',
                background: '#EC7FA7',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '0.86rem',
                fontWeight: 700,
                boxShadow: '0 6px 16px rgba(236, 127, 167, 0.35)',
              }}
            >
              <ShoppingBag size={16} />
              <span>Ver Catálogo</span>
            </Link>
            <button
              type="button"
              onClick={() => cambiarVista('promociones')}
              title="Ver promociones para clientes registrados y ofertas generales"
              aria-label="Ver Promociones"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Gift size={16} />
              <span>Promociones</span>
            </button>
          </div>
        </div>

        {/* Pestañas E-Commerce de Navegación Directa */}
        <div
          role="tablist"
          aria-label="Secciones de mi compra"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(185px, 100%), 1fr))',
            gap: '10px',
            paddingTop: '6px',
          }}
        >
          {(
            [
              {
                id: 'pedidos' as const,
                titulo: 'Mis Pedidos',
                subtitulo: 'Estado, entrega y factura',
                icono: <Package size={18} />,
                badge: misPedidos.length,
              },
              {
                id: 'carrito' as const,
                titulo: 'Mi Carrito',
                subtitulo: 'Editar arreglos y envío',
                icono: <ShoppingCart size={18} />,
                badge: cantidadTotal,
              },
              {
                id: 'proformas' as const,
                titulo: 'Mis Proformas',
                subtitulo: 'Ver y editar cotizaciones',
                icono: <FileText size={18} />,
                badge: totalProformasActivas,
              },
              {
                id: 'promociones' as const,
                titulo: 'Promociones',
                subtitulo: 'Exclusivas VIP y tienda',
                icono: <Gift size={18} />,
                badge: estadoRegalo?.aplicaRegalo ? 'Regalo $0' : undefined,
              },
            ] as const
          ).map((tab) => {
            const activa = vistaActiva === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => cambiarVista(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: activa
                    ? '1.5px solid #FFFFFF'
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  background: activa ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                  color: activa ? '#221D1A' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: activa ? 'rgba(61, 90, 69, 0.12)' : 'rgba(255, 255, 255, 0.14)',
                      color: activa ? '#3D5A45' : '#FFFFFF',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {tab.icono}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem', lineHeight: 1.2 }}>
                      {tab.titulo}
                    </strong>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.73rem',
                        color: activa ? 'rgba(34, 29, 26, 0.62)' : 'rgba(255, 255, 255, 0.76)',
                        marginTop: '2px',
                      }}
                    >
                      {tab.subtitulo}
                    </span>
                  </div>
                </div>

                {tab.badge !== undefined && tab.badge !== 0 && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: activa ? '#EC7FA7' : 'rgba(236, 127, 167, 0.9)',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {errorAccion && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          {errorAccion}
        </div>
      )}

      {avisoOk && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>{avisoOk}</span>
          <button
            type="button"
            onClick={() => setAvisoOk(null)}
            aria-label="Cerrar aviso"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#065F46' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* =====================================================================
          VISTA 1: MIS PEDIDOS (DATOS COMPLETOS + CONFIRMACIÓN ENTREGA + FACTURA)
         ===================================================================== */}
      {vistaActiva === 'pedidos' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--tinta)' }}>
                Mis Pedidos y Seguimiento de Entregas
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--gris)' }}>
                Consulta cada arreglo adquirido, su tarjeta de dedicatoria, foto de confirmación de
                entrega y factura electrónica SRI.
              </p>
            </div>

            {misPedidos.length > 0 && (
              <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                {(
                  [
                    { k: 'todos' as const, label: `Todos (${misPedidos.length})` },
                    { k: 'en_curso' as const, label: 'En Curso' },
                    { k: 'entregados' as const, label: 'Entregados' },
                  ] as const
                ).map((f) => {
                  const sel = filtroPedidos === f.k;
                  return (
                    <button
                      key={f.k}
                      type="button"
                      onClick={() => setFiltroPedidos(f.k)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '999px',
                        border: sel ? '1px solid #3D5A45' : '1px solid var(--linea)',
                        background: sel ? '#3D5A45' : '#FFFFFF',
                        color: sel ? '#FFFFFF' : 'var(--tinta)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pedidoUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '11px 16px',
                borderRadius: '14px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '0.84rem',
              }}
            >
              <span>
                📦 Viendo el pedido actualizado: <strong>{pedidoUrl}</strong>
              </span>
              <button
                type="button"
                onClick={() => router.replace('/panel?vista=pedidos', { scroll: false })}
                title="Mostrar todos mis pedidos"
                aria-label="Ver todos"
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: '1px solid #6EE7B7',
                  background: '#FFFFFF',
                  color: '#047857',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver todos
              </button>
            </div>
          )}

          {pedidosFiltrados.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '32px 24px',
                border: '1px solid var(--linea)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '14px',
                    background: 'var(--crema)',
                    color: '#3D5A45',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingBag size={24} />
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '1.02rem', color: 'var(--tinta)' }}>
                    {misPedidos.length === 0
                      ? 'Aún no registras pedidos en Tinkay'
                      : 'No hay pedidos en este filtro'}
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--gris)' }}>
                    {misPedidos.length === 0
                      ? 'Explora nuestro catálogo floral y disfruta de Envío Gratis en Centro-Norte de Quito.'
                      : 'Cambia a «Todos» para ver tu historial completo de compras.'}
                  </span>
                </div>
              </div>

              <Link
                href="/#catalogo"
                title="Explorar el catálogo de arreglos florales"
                aria-label="Explorar Catálogo"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '11px 20px',
                  borderRadius: '999px',
                  background: '#EC7FA7',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                }}
              >
                <ShoppingBag size={15} />
                <span>Explorar Catálogo</span>
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))',
                gap: '16px',
              }}
            >
              {(pedidoUrl
                ? [
                    ...pedidosFiltrados.filter(
                      (p) =>
                        p.codigo.toUpperCase() === pedidoUrl.toUpperCase() ||
                        p.id === pedidoUrl
                    ),
                    ...pedidosFiltrados.filter(
                      (p) =>
                        p.codigo.toUpperCase() !== pedidoUrl.toUpperCase() &&
                        p.id !== pedidoUrl
                    ),
                  ]
                : pedidosFiltrados
              ).map((pedido) => {
                const badge = obtenerBadgeEstadoPedido(pedido);
                const esPedidoEnfocado =
                  Boolean(pedidoUrl) &&
                  (pedido.codigo.toUpperCase() === pedidoUrl.toUpperCase() ||
                    pedido.id === pedidoUrl);
                const fechaPedido = new Date(pedido.creadoEn).toLocaleDateString('es-EC', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <article
                    key={pedido.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '18px',
                      padding: '20px',
                      border: esPedidoEnfocado ? '1.5px solid #10B981' : '1px solid var(--linea)',
                      boxShadow: esPedidoEnfocado
                        ? '0 0 0 2.5px rgba(16, 185, 129, 0.25), 0 12px 28px rgba(16, 185, 129, 0.14)'
                        : '0 4px 16px rgba(34, 29, 26, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                      {/* Cabecera de orden */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '1rem',
                              color: 'var(--tinta)',
                            }}
                          >
                            <Package size={16} color="#3D5A45" />
                            <span>{pedido.codigo}</span>
                          </strong>
                          <div style={{ fontSize: '0.76rem', color: 'var(--gris)', marginTop: '2px' }}>
                            Comprado el {fechaPedido}
                            {pedido.metodoPago ? ` · ${pedido.metodoPago.toUpperCase()}` : ''}
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '4px 11px',
                            borderRadius: '999px',
                            background: badge.bg,
                            color: badge.color,
                            fontSize: '0.74rem',
                            fontWeight: 800,
                          }}
                        >
                          {badge.etiqueta}
                        </span>
                      </div>

                      {/* Barra visual de progreso de 4 etapas */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '4px',
                          paddingTop: '2px',
                        }}
                      >
                        {['Recibido', 'En Taller', 'En Ruta', 'Entregado'].map((etapa, idx) => {
                          const activo = idx + 1 <= badge.pasoActual;
                          return (
                            <div key={etapa} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div
                                style={{
                                  height: '4px',
                                  borderRadius: '999px',
                                  background: activo ? '#3D5A45' : '#E5E7EB',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: activo ? 700 : 500,
                                  color: activo ? '#2D4734' : '#9CA3AF',
                                }}
                              >
                                {etapa}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Ítems del pedido */}
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: '12px',
                          background: '#FDFBF7',
                          border: '1px solid #EFECE6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {pedido.items.map((it, idx) => {
                          const fotoIt = it.personalizacionFloral?.fotoReferenciaUrl || it.imagen;
                          return (
                            <div key={idx} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                              {fotoIt && (
                                <img
                                  src={fotoIt}
                                  alt={it.nombre}
                                  style={{
                                    width: '44px',
                                    height: '44px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: it.personalizacionFloral?.mismosColoresFoto
                                      ? '2px solid #2F4737'
                                      : '1px solid #E7E5E4',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    fontSize: '0.82rem',
                                    color: 'var(--tinta)',
                                  }}
                                >
                                  <span>
                                    <strong>{it.cantidad}x</strong> {it.nombre}
                                    {it.variante && it.variante !== it.nombre ? ` (${it.variante})` : ''}
                                  </span>
                                  <strong>${it.subtotal.toFixed(2)}</strong>
                                </div>
                                {it.personalizacionFloral?.resumenTexto && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      color: it.personalizacionFloral.mismosColoresFoto ? '#166534' : '#831843',
                                      background: it.personalizacionFloral.mismosColoresFoto ? '#F0FDF4' : '#FDF2F8',
                                      border: it.personalizacionFloral.mismosColoresFoto
                                        ? '1px solid #BBF7D0'
                                        : '1px solid #FBCFE8',
                                      borderRadius: '6px',
                                      padding: '3px 7px',
                                      display: 'inline-block',
                                      marginTop: '2px',
                                    }}
                                  >
                                    {it.personalizacionFloral.mismosColoresFoto ? '📸 ' : '🎨 '}
                                    {it.personalizacionFloral.resumenTexto}
                                  </span>
                                )}
                                {it.dedicatoria?.mensaje && (
                                  <span style={{ fontSize: '0.72rem', color: '#6B746C', fontStyle: 'italic' }}>
                                    💌 Para {it.dedicatoria.para || 'Destinatario'}: &ldquo;
                                    {it.dedicatoria.mensaje.slice(0, 65)}
                                    {it.dedicatoria.mensaje.length > 65 ? '…' : ''}&rdquo;
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {pedido.regaloPrimeraCompra && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.78rem',
                              color: '#059669',
                              fontWeight: 700,
                              paddingTop: '3px',
                              borderTop: '1px dashed #E5E7EB',
                            }}
                          >
                            <span>🎁 1x {pedido.regaloPrimeraCompra.nombre}</span>
                            <span>$0.00</span>
                          </div>
                        )}
                      </div>

                      {/* Destino y Fecha */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          fontSize: '0.78rem',
                          color: '#4A544C',
                        }}
                      >
                        <div>
                          <strong>Destinatario:</strong> {pedido.entrega.destinatarioNombre}
                          {pedido.entrega.destinatarioTelefono
                            ? ` (${pedido.entrega.destinatarioTelefono})`
                            : ''}
                        </div>
                        {pedido.entrega.fechaEntrega && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={13} color="#3D5A45" />
                            <span>
                              {pedido.entrega.fechaEntrega}
                              {pedido.entrega.franjaHoraria ? ` · ${pedido.entrega.franjaHoraria}` : ''}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '5px' }}>
                          <MapPin size={13} color="#3D5A45" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span>{pedido.entrega.direccion}</span>
                        </div>
                      </div>

                      {/* Insignias de Confirmación de Entrega y Factura SRI */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pedido.confirmacionEntrega.confirmada ? (
                          <div
                            style={{
                              padding: '8px 11px',
                              borderRadius: '10px',
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <div style={{ fontSize: '0.76rem', color: '#065F46' }}>
                              <strong>✅ Entrega confirmada</strong>
                              {pedido.confirmacionEntrega.fechaHoraConfirmacion && (
                                <span style={{ display: 'block', fontSize: '0.7rem', color: '#047857' }}>
                                  {new Date(
                                    pedido.confirmacionEntrega.fechaHoraConfirmacion
                                  ).toLocaleString('es-EC', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              )}
                            </div>

                            {pedido.confirmacionEntrega.fotoEvidenciaUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFotoEvidenciaAmpliada({
                                    url: pedido.confirmacionEntrega.fotoEvidenciaUrl!,
                                    codigo: pedido.codigo,
                                  })
                                }
                                title="Ver fotografía georreferenciada de confirmación de entrega"
                                aria-label="Ver Foto"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '5px 10px',
                                  borderRadius: '999px',
                                  border: '1px solid #059669',
                                  background: '#FFFFFF',
                                  color: '#065F46',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Camera size={13} />
                                <span>Ver Foto</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '7px 10px',
                              borderRadius: '10px',
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.74rem',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Clock size={13} color="#64748B" />
                            <span>
                              Confirmación de entrega: aparecerá aquí con foto y hora al entregarse.
                            </span>
                          </div>
                        )}

                        {pedido.facturaElectronica ? (
                          <div
                            style={{
                              padding: '8px 11px',
                              borderRadius: '10px',
                              background: '#F0FDF4',
                              border: '1px solid #BBF7D0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#166534',
                              }}
                            >
                              <Receipt size={14} />
                              <span>Factura {pedido.facturaElectronica.numero_comprobante}</span>
                            </span>
                            <div style={{ display: 'inline-flex', gap: '5px' }}>
                              <button
                                type="button"
                                onClick={() => ejecutarAccionFacturaRide(pedido, 'imprimir')}
                                title="Ver e imprimir comprobante RIDE SRI"
                                aria-label="Ver Factura"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 9px',
                                  borderRadius: '7px',
                                  border: 'none',
                                  background: '#166534',
                                  color: '#FFFFFF',
                                  fontSize: '0.71rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Printer size={12} />
                                <span>Ver RIDE</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => ejecutarAccionFacturaRide(pedido, 'descargar')}
                                title="Descargar archivo RIDE de la factura electrónica"
                                aria-label="Descargar RIDE"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 9px',
                                  borderRadius: '7px',
                                  border: '1px solid #166534',
                                  background: '#FFFFFF',
                                  color: '#166534',
                                  fontSize: '0.71rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Download size={12} />
                                <span>Factura</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '7px 10px',
                              borderRadius: '10px',
                              background: '#FAF8F5',
                              border: '1px solid #E7E5E4',
                              fontSize: '0.74rem',
                              color: '#57534E',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                            }}
                          >
                            <span>
                              🧾 Factura SRI:{' '}
                              {pedido.estado === 'PENDIENTE_PAGO' ||
                              (pedido.metodoPago || '').toLowerCase() === 'transferencia'
                                ? 'En emisión tras validar pago'
                                : 'Procesando comprobante electrónico'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pie de tarjeta: Total + Botones Concisos */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--linea)',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--tinta)' }}>
                          ${pedido.total.toFixed(2)} USD
                        </strong>
                        {pedido.costoEnvio === 0 && !pedido.entrega.retiroEnLocal && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: '0.7rem',
                              color: '#15803D',
                              fontWeight: 700,
                            }}
                          >
                            Envío Gratis incluido
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                        <button
                          type="button"
                          onClick={() => setPedidoDetalleAbierto(pedido)}
                          title="Abrir ficha completa con todos los datos del pedido, entrega y factura"
                          aria-label="Ver Detalle"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '999px',
                            border: 'none',
                            background: '#2D4334',
                            color: '#FFFFFF',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={14} />
                          <span>Ver Detalle</span>
                        </button>

                        {pedido.tokenAprobacion && (
                          <a
                            href={`/api/proforma/${pedido.tokenAprobacion}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Descargar comprobante PDF de la orden"
                            aria-label="Orden PDF"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '8px 12px',
                              borderRadius: '999px',
                              border: '1px solid var(--linea)',
                              background: '#FFFFFF',
                              color: 'var(--tinta)',
                              textDecoration: 'none',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                            }}
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          VISTA 2: MI CARRITO DE COMPRAS (VER Y EDITAR EN LÍNEA)
         ===================================================================== */}
      {vistaActiva === 'carrito' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--tinta)' }}>
              Mi Carrito Floral ({cantidadTotal})
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--gris)' }}>
              Ajusta tus arreglos, personaliza las tarjetas de dedicatoria y disfruta de tu zona de
              cobertura gratuita como cliente registrado.
            </p>
          </div>

          {itemsCarrito.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '36px 24px',
                border: '1px solid var(--linea)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '999px',
                  background: 'var(--crema)',
                  color: '#EC7FA7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingCart size={26} />
              </div>
              <strong style={{ fontSize: '1.1rem', color: 'var(--tinta)' }}>
                Tu carrito de compras está vacío
              </strong>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--gris)', maxWidth: '440px' }}>
                Agrega ramos, box florales o detalles desde el catálogo o revisa las promociones
                activas para tu cuenta.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <Link
                  href="/#catalogo"
                  title="Ir al catálogo de arreglos florales"
                  aria-label="Ir al Catálogo"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '11px 22px',
                    borderRadius: '999px',
                    background: '#EC7FA7',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}
                >
                  <ShoppingBag size={16} />
                  <span>Ir al Catálogo</span>
                </Link>
                <button
                  type="button"
                  onClick={() => cambiarVista('promociones')}
                  title="Explorar promociones activas"
                  aria-label="Ver Promociones"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '11px 20px',
                    borderRadius: '999px',
                    border: '1px solid var(--linea)',
                    background: '#FFFFFF',
                    color: 'var(--tinta)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Gift size={16} />
                  <span>Ver Promociones</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
                gap: '20px',
                alignItems: 'start',
              }}
            >
              {/* Columna Izquierda: Ítems + Dedicatorias + Complementos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {itemsCarrito.map((item) => {
                  const dedicatoriaExpandida = itemDedicatoriaAbierta === item.id;
                  const tieneDed = Boolean(
                    item.dedicatoria?.para || item.dedicatoria?.mensaje
                  );

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1px solid var(--linea)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <img
                          src={
                            item.personalizacionFloral?.fotoReferenciaUrl ||
                            item.producto.fotos[0] ||
                            '/img/slide4_flores_amor.jpg'
                          }
                          alt={item.producto.nombre}
                          style={{
                            width: '74px',
                            height: '74px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--tinta)' }}>
                            {item.producto.nombre}
                          </strong>
                          {item.variante.nombre &&
                            item.variante.nombre.trim() !== item.producto.nombre.trim() && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--gris)' }}>
                                {item.variante.nombre}
                              </span>
                            )}
                          {item.personalizacionFloral?.resumenTexto && (
                            <div
                              style={{
                                marginTop: '4px',
                                fontSize: '0.75rem',
                                color: '#831843',
                                background: '#FDF2F8',
                                border: '1px solid #FBCFE8',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                display: 'inline-block',
                              }}
                            >
                              🎨 {item.personalizacionFloral.resumenTexto}
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px',
                              marginTop: '8px',
                            }}
                          >
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '4px 10px',
                                borderRadius: '999px',
                                border: '1px solid var(--linea)',
                                background: '#FAF7F0',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                                title="Restar unidad"
                                aria-label="Restar unidad"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                }}
                              >
                                <Minus size={14} />
                              </button>
                              <strong style={{ fontSize: '0.86rem' }}>{item.cantidad}</strong>
                              <button
                                type="button"
                                onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                                title="Sumar unidad"
                                aria-label="Sumar unidad"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                              <strong style={{ fontSize: '1rem', color: 'var(--tinta)' }}>
                                ${(item.variante.pvp * item.cantidad).toFixed(2)}
                              </strong>
                              <button
                                type="button"
                                onClick={() => eliminarItem(item.id)}
                                title="Quitar arreglo del carrito"
                                aria-label="Quitar arreglo"
                                style={{
                                  border: 'none',
                                  background: '#FFF1F2',
                                  color: '#BE123C',
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {!item.producto.esComplemento && !item.producto.esRenta && (
                        <div style={{ borderTop: '1px solid #F3F0EA', paddingTop: '10px' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setItemDedicatoriaAbierta(dedicatoriaExpandida ? null : item.id)
                            }
                            title="Escribir o editar tarjeta de dedicatoria impresa gratis"
                            aria-label="Editar Dedicatoria"
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: '#3D5A45',
                              padding: 0,
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Heart size={14} color="#EC7FA7" />
                              <span>
                                {tieneDed
                                  ? `Tarjeta para ${item.dedicatoria?.para || 'Destinatario'} (Editar)`
                                  : 'Agregar tarjeta de dedicatoria impresa ($0.00)'}
                              </span>
                            </span>
                            <Pencil size={13} />
                          </button>

                          {dedicatoriaExpandida && (
                            <div
                              style={{
                                marginTop: '10px',
                                padding: '12px',
                                borderRadius: '12px',
                                background: '#FAF7F0',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                  gap: '8px',
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="Para (Destinatario)"
                                  value={item.dedicatoria?.para || ''}
                                  onChange={(e) =>
                                    actualizarDedicatoria(item.id, {
                                      para: e.target.value,
                                      de: item.dedicatoria?.de || '',
                                      mensaje: item.dedicatoria?.mensaje || '',
                                    })
                                  }
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--linea)',
                                    background: '#FFFFFF',
                                    fontSize: '0.82rem',
                                  }}
                                />
                                <input
                                  type="text"
                                  placeholder="De (Firma)"
                                  value={item.dedicatoria?.de || ''}
                                  onChange={(e) =>
                                    actualizarDedicatoria(item.id, {
                                      para: item.dedicatoria?.para || '',
                                      de: e.target.value,
                                      mensaje: item.dedicatoria?.mensaje || '',
                                    })
                                  }
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--linea)',
                                    background: '#FFFFFF',
                                    fontSize: '0.82rem',
                                  }}
                                />
                              </div>

                              <textarea
                                rows={3}
                                placeholder="Escribe el mensaje emotivo para tu tarjeta..."
                                value={item.dedicatoria?.mensaje || ''}
                                onChange={(e) =>
                                  actualizarDedicatoria(item.id, {
                                    para: item.dedicatoria?.para || '',
                                    de: item.dedicatoria?.de || '',
                                    mensaje: e.target.value,
                                  })
                                }
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--linea)',
                                  background: '#FFFFFF',
                                  fontSize: '0.82rem',
                                  fontFamily: 'inherit',
                                  resize: 'vertical',
                                }}
                              />

                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {Object.entries(FRASES_DEDICATORIAS)
                                  .slice(0, 3)
                                  .map(([ocasion, frases]) => {
                                    const frase0 = frases[0];
                                    if (!frase0) return null;
                                    return (
                                      <button
                                        key={ocasion}
                                        type="button"
                                        onClick={() =>
                                          actualizarDedicatoria(item.id, {
                                            para: item.dedicatoria?.para || '',
                                            de: item.dedicatoria?.de || '',
                                            mensaje: frase0,
                                          })
                                        }
                                        style={{
                                          padding: '4px 9px',
                                          borderRadius: '999px',
                                          border: '1px solid rgba(236, 127, 167, 0.35)',
                                          background: '#FFFFFF',
                                          color: '#9D174D',
                                          fontSize: '0.7rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        ✨ Idea {ocasion}
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {complementosSugeridos.length > 0 && (
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      padding: '15px 16px',
                      border: '1px solid var(--linea)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <strong style={{ fontSize: '0.86rem', color: 'var(--tinta)' }}>
                      🍫 Complementa tu regalo floral
                    </strong>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                        gap: '8px',
                      }}
                    >
                      {complementosSugeridos.map((comp) => {
                        const v = comp.variantes[0];
                        if (!v) return null;
                        return (
                          <div
                            key={comp.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              background: '#FAF7F0',
                              border: '1px solid #EFECE6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  color: 'var(--tinta)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {comp.nombre}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#3D5A45', fontWeight: 700 }}>
                                +${v.pvp.toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => agregarItem(comp, v, undefined, undefined, 1, false)}
                              title={`Sumar ${comp.nombre} al carrito`}
                              aria-label="Agregar complemento"
                              style={{
                                padding: '5px 10px',
                                borderRadius: '999px',
                                border: 'none',
                                background: '#3D5A45',
                                color: '#FFFFFF',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              + Sumar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Entrega + Resumen Financiero + Ir a Pagar */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '18px',
                  padding: '18px 20px',
                  border: '1px solid var(--linea)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <strong style={{ fontSize: '1rem', color: 'var(--tinta)' }}>
                  Entrega y Resumen de Compra
                </strong>

                <SelectorUbicacionEntrega
                  negocio="tinkay"
                  configuracionInicial={configLogistica}
                  clienteRegistrado={true}
                  permitirModoRetiro={configLogistica.permitirRetiroLocal}
                  retiroEnLocal={Boolean(entregaUnificada.retiroEnLocal)}
                  enlaceMapaInicial={entregaUnificada.enlaceMapa || ''}
                  coordenadasIniciales={
                    typeof entregaUnificada.lat === 'number' &&
                    typeof entregaUnificada.lng === 'number'
                      ? { lat: entregaUnificada.lat, lng: entregaUnificada.lng }
                      : null
                  }
                  onCambioCotizacion={(ev) => {
                    setAvisoCarrito(null);
                    actualizarEntregaUnificada({
                      retiroEnLocal: ev.retiroEnLocal,
                      enlaceMapa: ev.enlaceMapa,
                      lat: ev.cotizacion.destino.lat,
                      lng: ev.cotizacion.destino.lng,
                      dentroCobertura: ev.cotizacion.dentroCobertura,
                      zonaDetectadaNombre: ev.cotizacion.zonaDetectada?.nombre,
                      reglaLogisticaAplicada: ev.cotizacion.reglaAplicada,
                      distanciaVialKm: ev.cotizacion.distanciaVialKm,
                      costoEnvioCalculado: ev.cotizacion.costoTotalEnvio,
                      etiquetaCotizacion: ev.cotizacion.etiquetaResumen,
                      formulaCalculoInterno: ev.cotizacion.formulaDetalle,
                      detalleDireccionGeo: ev.detalleDireccionGeo ?? null,
                      ...(ev.direccionSugerida ? { direccion: ev.direccionSugerida } : {}),
                    });
                  }}
                />

                {!entregaUnificada.retiroEnLocal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="¿Quién recibe?"
                        value={entregaUnificada.destinatarioNombre || ''}
                        onChange={(e) =>
                          actualizarEntregaUnificada({ destinatarioNombre: e.target.value })
                        }
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--linea)',
                          fontSize: '0.82rem',
                        }}
                      />
                      <input
                        type="tel"
                        placeholder="Teléfono destinatario"
                        value={entregaUnificada.destinatarioTelefono || ''}
                        onChange={(e) =>
                          actualizarEntregaUnificada({ destinatarioTelefono: e.target.value })
                        }
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--linea)',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Dirección exacta y referencia (casa / edificio / piso)"
                      value={entregaUnificada.direccion || ''}
                      onChange={(e) => actualizarEntregaUnificada({ direccion: e.target.value })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--linea)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '8px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        color: 'var(--gris)',
                        marginBottom: '3px',
                      }}
                    >
                      Fecha de entrega
                    </label>
                    <input
                      type="date"
                      value={entregaUnificada.fechaEntrega || ''}
                      onChange={(e) => actualizarEntregaUnificada({ fechaEntrega: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--linea)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        color: 'var(--gris)',
                        marginBottom: '3px',
                      }}
                    >
                      Franja horaria
                    </label>
                    <SelectConBuscador
                      value={entregaUnificada.franjaHoraria}
                      onChange={(e) =>
                        actualizarEntregaUnificada({
                          franjaHoraria: e.target.value as FranjaHoraria,
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--linea)',
                        fontSize: '0.82rem',
                        background: '#FFFFFF',
                      }}
                    >
                      <option value="A) 09:00 - 13:00">Mañana (09:00 - 13:00)</option>
                      <option value="B) 13:00 - 17:00">Tarde (13:00 - 17:00)</option>
                      <option value="C) 17:00 - 20:00">Noche (17:00 - 20:00)</option>
                      <option value="hora_exacta">
                        Hora Exacta (+${(configLogistica.recargoHoraExacta ?? 10).toFixed(2)})
                      </option>
                    </SelectConBuscador>
                  </div>
                </div>

                {/* Desglose financiero */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#FAF7F0',
                    border: '1px solid #EFECE6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.84rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gris)' }}>Subtotal arreglos:</span>
                    <strong>${subtotalBaseImponible.toFixed(2)}</strong>
                  </div>
                  {totalIva > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--gris)' }}>IVA 15% (complementos):</span>
                      <strong>${totalIva.toFixed(2)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gris)' }}>Servicio de entrega:</span>
                    <strong style={{ color: totalFlete === 0 ? '#15803D' : 'var(--tinta)' }}>
                      {totalFlete === 0 ? 'GRATIS ($0.00)' : `$${totalFlete.toFixed(2)}`}
                    </strong>
                  </div>
                  {totalRecargoHorarioExacto > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--gris)' }}>Hora exacta programada:</span>
                      <strong>${totalRecargoHorarioExacto.toFixed(2)}</strong>
                    </div>
                  )}
                  {estadoRegalo?.aplicaRegalo && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#059669',
                        fontWeight: 700,
                      }}
                    >
                      <span>🎁 {datosObsequio.nombre} (1ra compra):</span>
                      <span>$0.00</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--linea)',
                      fontSize: '1.08rem',
                    }}
                  >
                    <strong>Total a Pagar:</strong>
                    <strong>${totalPagar.toFixed(2)} USD</strong>
                  </div>
                </div>

                {avisoCarrito && (
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{avisoCarrito}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleIrAPagarDesdeTabCarrito}
                  title="Continuar al resumen y pago de tu pedido"
                  aria-label="Ir a Pagar"
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 20px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#EC7FA7',
                    color: '#FFFFFF',
                    fontSize: '0.94rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(236, 127, 167, 0.35)',
                  }}
                >
                  <CreditCard size={17} />
                  <span>Ir a Pagar</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          VISTA 3: MIS PROFORMAS DE EVENTOS (BORRADOR EN VIVO + GUARDADAS EDITABLES)
         ===================================================================== */}
      {vistaActiva === 'proformas' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--tinta)' }}>
                Mis Proformas y Cotizaciones de Eventos
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--gris)' }}>
                Visualiza, edita tus proformas de bodas o recepciones, compara variaciones de tu
                asesora y reserva con el 70%.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDrawerProformaAbierto(true)}
              title="Abrir asistente de proforma de evento"
              aria-label="Nueva Proforma"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '10px 18px',
                borderRadius: '999px',
                border: 'none',
                background: '#3D5A45',
                color: '#FFFFFF',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={15} />
              <span>Nueva Proforma</span>
            </button>
          </div>

          {/* A. Borrador en armado actual */}
          {itemsProforma.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF7F0 100%)',
                borderRadius: '18px',
                padding: '18px 20px',
                border: '1.5px solid #B8923F',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#92400E',
                    }}
                  >
                    ✨ Borrador de Proforma en Armado ({cantidadTotalProforma} elementos)
                  </span>
                  <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--tinta)' }}>
                    Total estimado: ${totalProforma.toFixed(2)} USD (Reserva 70%: $
                    {reserva70Proforma.toFixed(2)})
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerProformaAbierto(true)}
                  title="Completar datos del evento y emitir proforma PDF"
                  aria-label="Emitir PDF"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#2D4334',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FileText size={15} />
                  <span>Editar y Emitir</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {itemsProforma.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: '#FFFFFF',
                      border: '1px solid var(--linea)',
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      {it.producto.nombre}
                      {it.variante.nombre !== it.producto.nombre ? ` (${it.variante.nombre})` : ''}
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => actualizarCantidadProforma(it.id, it.cantidad - 1)}
                        aria-label="Disminuir"
                        style={{ border: 'none', background: '#F3F4F6', borderRadius: '6px', padding: '4px 7px', cursor: 'pointer' }}
                      >
                        -
                      </button>
                      <strong style={{ fontSize: '0.84rem' }}>{it.cantidad}</strong>
                      <button
                        type="button"
                        onClick={() => actualizarCantidadProforma(it.id, it.cantidad + 1)}
                        aria-label="Aumentar"
                        style={{ border: 'none', background: '#F3F4F6', borderRadius: '6px', padding: '4px 7px', cursor: 'pointer' }}
                      >
                        +
                      </button>
                      <strong style={{ minWidth: '60px', textAlign: 'right', fontSize: '0.86rem' }}>
                        ${(it.variante.pvp * it.cantidad).toFixed(2)}
                      </strong>
                      <button
                        type="button"
                        onClick={() => eliminarItemProforma(it.id)}
                        aria-label="Eliminar elemento"
                        style={{ border: 'none', background: 'transparent', color: '#BE123C', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. Proformas emitidas y variaciones */}
          {misProformas.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '32px 24px',
                border: '1px solid var(--linea)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '14px',
                    background: 'var(--crema)',
                    color: '#B8923F',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={24} />
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '1.02rem', color: 'var(--tinta)' }}>
                    No tienes proformas emitidas en este momento
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--gris)' }}>
                    Explora nuestra colección de Eventos &amp; Ceremonias y arma tu proforma PDF al
                    instante.
                  </span>
                </div>
              </div>

              <Link
                href="/categoria/eventos-y-ceremonias"
                title="Ver montajes y arreglos para eventos"
                aria-label="Ver Eventos"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '11px 20px',
                  borderRadius: '999px',
                  background: '#3D5A45',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                }}
              >
                <Sparkles size={15} />
                <span>Ver Eventos</span>
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
                gap: '16px',
              }}
            >
              {misProformas.map((prf) => {
                const badge = obtenerBadgeEstadoPedido(prf);
                const puedeEditarOEliminar =
                  !prf.bloqueadaPorPagoGrupo && prf.tokenAprobacion.length >= 8;
                const totalHermanas = contarHermanas(prf.grupoProformaId || prf.id);

                return (
                  <article
                    key={prf.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '18px',
                      padding: '20px',
                      border: '1px solid var(--linea)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <strong
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.96rem',
                            color: 'var(--tinta)',
                          }}
                        >
                          <FileText size={16} color="#3D5A45" />
                          <span>{prf.codigo}</span>
                        </strong>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: prf.esOriginal ? '#F1F5F9' : '#ECFDF5',
                              color: prf.esOriginal ? '#334155' : '#065F46',
                            }}
                          >
                            {prf.esOriginal
                              ? `V${prf.versionNumero} · Original`
                              : `V${prf.versionNumero} · Asesor`}
                          </span>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '0.71rem',
                              fontWeight: 800,
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.etiqueta}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#4A544C' }}>
                        <strong>{prf.evento?.tipoEvento || 'Evento Especial'}</strong>
                        {prf.evento?.fechaEvento ? ` · 📅 ${prf.evento.fechaEvento}` : ''}
                        {prf.entrega.direccion ? ` · 📍 ${prf.entrega.direccion}` : ''}
                      </div>

                      {prf.items.length > 0 && (
                        <div
                          style={{
                            padding: '8px 10px',
                            borderRadius: '10px',
                            background: '#FDFBF7',
                            border: '1px solid #EFECE6',
                            fontSize: '0.78rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                          }}
                        >
                          {prf.items.slice(0, 4).map((it, idx) => (
                            <div
                              key={idx}
                              style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}
                            >
                              <span>
                                <strong>{it.cantidad}x</strong> {it.nombre}
                              </span>
                              <strong>${it.subtotal.toFixed(2)}</strong>
                            </div>
                          ))}
                          {prf.items.length > 4 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--gris)' }}>
                              +{prf.items.length - 4} elementos adicionales…
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          paddingTop: '4px',
                        }}
                      >
                        <strong style={{ fontSize: '1.12rem', color: 'var(--tinta)' }}>
                          ${prf.total.toFixed(2)} USD
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#3D5A45', fontWeight: 700 }}>
                          Reserva 70%: ${prf.montoReserva70Usd.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--linea)',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {puedeEditarOEliminar && (
                          <button
                            type="button"
                            onClick={() => setProformaEditando(prf)}
                            title="Editar ítems, cantidades, fecha o locación de esta proforma"
                            aria-label="Editar Proforma"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '7px 12px',
                              borderRadius: '999px',
                              border: '1px solid #3D5A45',
                              background: '#F5F9F6',
                              color: '#2D4734',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Pencil size={13} />
                            <span>Editar</span>
                          </button>
                        )}

                        {prf.tokenAprobacion && (
                          <Link
                            href={`/proforma/${prf.tokenAprobacion}`}
                            title="Abrir detalle completo y opciones de pago"
                            aria-label="Ver y Pagar"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '7px 13px',
                              borderRadius: '999px',
                              background: '#2D4334',
                              color: '#FFFFFF',
                              textDecoration: 'none',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>Ver / Pagar</span>
                          </Link>
                        )}

                        {prf.tokenAprobacion && (
                          <a
                            href={`/api/proforma/${prf.tokenAprobacion}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Descargar PDF oficial de esta proforma"
                            aria-label="Descargar PDF"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '7px 11px',
                              borderRadius: '999px',
                              border: '1px solid var(--linea)',
                              background: '#FFFFFF',
                              color: 'var(--tinta)',
                              textDecoration: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </a>
                        )}
                      </div>

                      {puedeEditarOEliminar && (
                        <div style={{ display: 'inline-flex', gap: '5px' }}>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleEliminarProforma(prf, 'UNA')}
                            title="Descartar esta variación antes de pagar"
                            aria-label="Descartar"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              borderRadius: '999px',
                              border: '1px solid #FECDD3',
                              background: '#FFF1F2',
                              color: '#BE123C',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Descartar</span>
                          </button>
                          {totalHermanas > 1 && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleEliminarProforma(prf, 'TODAS')}
                              title="Eliminar todas las variaciones de este evento"
                              aria-label="Eliminar Todas"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '999px',
                                border: '1px solid #FCA5A5',
                                background: '#FEF2F2',
                                color: '#991B1B',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Todas
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          VISTA 4: PROMOCIONES (CLIENTES REGISTRADOS + PROMOCIONES GENERALES)
         ===================================================================== */}
      {vistaActiva === 'promociones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* BLOQUE A: PROMOCIONES Y BENEFICIOS EXCLUSIVOS PARA CLIENTES REGISTRADOS */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: '#9D174D',
                }}
              >
                <Sparkles size={13} />
                <span>Exclusivo Club Tinkay</span>
              </span>
              <h2 style={{ margin: '2px 0 0', fontSize: '1.35rem', color: 'var(--tinta)' }}>
                Promociones y Beneficios para Clientes Registrados
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
                gap: '16px',
              }}
            >
              {/* Beneficio 1: Zona de Cobertura con Entrega Gratuita */}
              <article
                style={{
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1.5px solid #86EFAC',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: '#DCFCE7',
                        color: '#15803D',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Truck size={22} />
                    </span>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: '#15803D',
                        color: '#FFFFFF',
                        fontSize: '0.71rem',
                        fontWeight: 800,
                      }}
                    >
                      ✓ ACTIVO EN TU CUENTA
                    </span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#14532D' }}>
                    Zona de Cobertura con Entrega Gratuita ($0.00)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', lineHeight: 1.5 }}>
                    Por ser cliente registrado cuentas con{' '}
                    <strong>
                      Envío Gratis dentro de {configLogistica.zonaGratisNombre || 'Centro-Norte de Quito'}
                    </strong>
                    , ahorrándote la tarifa de compradores no registrados ($
                    {(configLogistica.tarifaBaseNoRegistradoUsd ?? 1).toFixed(2)} + $
                    {(configLogistica.tarifaPorKmNoRegistradoUsd ?? 0.5).toFixed(2)}/km).
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803D' }}>
                    Se aplica automáticamente al elegir tu ubicación
                  </span>
                  <Link
                    href="/#catalogo"
                    title="Comprar arreglos con envío gratuito en zona de cobertura"
                    aria-label="Usar Beneficio"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 15px',
                      borderRadius: '999px',
                      background: '#15803D',
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>Usar Ahora</span>
                  </Link>
                </div>
              </article>

              {/* Beneficio 2: Obsequio de Bienvenida en Primera Compra */}
              <article
                style={{
                  background: 'linear-gradient(135deg, #FDF2F8 0%, #FFFBEB 100%)',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1.5px solid #FBCFE8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <img
                    src={datosObsequio.imagenUrl}
                    alt={datosObsequio.nombre}
                    style={{
                      width: '88px',
                      height: '88px',
                      borderRadius: '14px',
                      objectFit: 'cover',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: estadoRegalo?.aplicaRegalo ? '#BE185D' : '#6B7280',
                        color: '#FFFFFF',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        marginBottom: '6px',
                      }}
                    >
                      {estadoRegalo?.aplicaRegalo ? 'DISPONIBLE 1RA COMPRA' : 'OBSEQUIO CANJEADO'}
                    </span>
                    <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#1F2937' }}>
                      {datosObsequio.nombre}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#9CA3AF',
                          textDecoration: 'line-through',
                        }}
                      >
                        ${datosObsequio.valorReferencia.toFixed(2)} USD
                      </span>
                      <strong style={{ fontSize: '1rem', color: '#059669' }}>$0.00 GRATIS</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: '#831843' }}>
                    {estadoRegalo?.aplicaRegalo
                      ? 'Se añade sin costo a tu primer pedido online.'
                      : 'Gracias por haber realizado tu primera compra con nosotros.'}
                  </span>

                  {estadoRegalo?.aplicaRegalo && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('tinkay_obsequio_bienvenida_aceptado', '1');
                        }
                        setAvisoOk(
                          `🎁 Obsequio «${datosObsequio.nombre}» activado ($0.00) para tu compra.`
                        );
                        if (itemsCarrito.length > 0) {
                          cambiarVista('carrito');
                        } else {
                          router.push('/#catalogo');
                        }
                      }}
                      title="Activar obsequio gratuito en mi pedido"
                      aria-label="Canjear Regalo"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 15px',
                        borderRadius: '999px',
                        border: 'none',
                        background: '#BE185D',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Gift size={14} />
                      <span>Canjear Regalo</span>
                    </button>
                  )}
                </div>
              </article>

              {/* Campañas dinámicas adicionales para clientes registrados */}
              {campanasExclusivasCliente.map((camp) => (
                <article
                  key={camp.inf_id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '18px',
                    padding: '20px',
                    border: '1px solid var(--linea)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: 'rgba(61, 90, 69, 0.12)',
                        color: '#2D4734',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        marginBottom: '8px',
                      }}
                    >
                      {camp.inf_detalle?.porcentaje_descuento || 'PROMOCIÓN ESPECIAL'}
                    </span>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--tinta)' }}>
                      {camp.inf_titulo}
                    </h3>
                    {camp.inf_subtitulo && (
                      <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--gris)', lineHeight: 1.45 }}>
                        {camp.inf_subtitulo}
                      </p>
                    )}
                  </div>
                  {camp.inf_detalle?.cta_url && (
                    <Link
                      href={camp.inf_detalle.cta_url}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '7px 14px',
                        borderRadius: '999px',
                        background: '#3D5A45',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                      }}
                    >
                      {camp.inf_detalle.cta_texto || 'Ver Promoción'}
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* BLOQUE B: PROMOCIONES GENERALES DE LA TIENDA */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: '#3D5A45',
                }}
              >
                <Tag size={13} />
                <span>Abiertas en Tienda</span>
              </span>
              <h2 style={{ margin: '2px 0 0', fontSize: '1.35rem', color: 'var(--tinta)' }}>
                Promociones Generales, Sets con Descuento y Entrega Inmediata
              </h2>
            </div>

            {/* 1. Arreglos de Entrega Inmediata 1-2h con Precio Especial */}
            {entregaInmediataInicial.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Zap size={16} color="#D97706" />
                  <strong style={{ fontSize: '0.96rem', color: 'var(--tinta)' }}>
                    Listos Hoy para Entrega Inmediata (1–2h) a Precio Especial
                  </strong>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))',
                    gap: '14px',
                  }}
                >
                  {entregaInmediataInicial.map((itemInm) => {
                    const prodMatch = catalogoLive.find(
                      (p) => p.proIdUuid === itemInm.productoId || p.slug === itemInm.slug
                    );
                    return (
                      <div
                        key={itemInm.productoId}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          border: '1px solid var(--linea)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={itemInm.imagenUrl}
                            alt={itemInm.nombre}
                            style={{ width: '100%', height: '190px', objectFit: 'cover', display: 'block' }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              top: '10px',
                              left: '10px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: '#D97706',
                              color: '#FFFFFF',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                            }}
                          >
                            ⚡ LISTO EN 1–2H
                          </span>
                        </div>
                        <div
                          style={{
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <strong style={{ fontSize: '0.95rem', color: 'var(--tinta)' }}>
                            {itemInm.nombre}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            {itemInm.precioComparacion && itemInm.precioComparacion > itemInm.precio && (
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  color: '#9CA3AF',
                                  textDecoration: 'line-through',
                                }}
                              >
                                ${itemInm.precioComparacion.toFixed(2)}
                              </span>
                            )}
                            <strong style={{ fontSize: '1.1rem', color: '#15803D' }}>
                              ${itemInm.precio.toFixed(2)} USD
                            </strong>
                          </div>

                          {prodMatch && prodMatch.variantes[0] ? (
                            <button
                              type="button"
                              onClick={() => agregarItem(prodMatch, prodMatch.variantes[0]!)}
                              title="Agregar este arreglo de entrega inmediata al carrito"
                              aria-label="Agregar"
                              style={{
                                width: '100%',
                                padding: '9px 14px',
                                borderRadius: '999px',
                                border: 'none',
                                background: '#EC7FA7',
                                color: '#FFFFFF',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Agregar al Carrito
                            </button>
                          ) : (
                            <Link
                              href={`/producto/${itemInm.slug}`}
                              style={{
                                textAlign: 'center',
                                padding: '9px 14px',
                                borderRadius: '999px',
                                background: '#EC7FA7',
                                color: '#FFFFFF',
                                textDecoration: 'none',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              Ver Arreglo
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Ofertas del Catálogo y Sets con Descuento */}
            {ofertasCatalogo.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(255px, 100%), 1fr))',
                  gap: '14px',
                }}
              >
                {ofertasCatalogo.map(({ producto: prod, pvpActual, pvpAnterior, etiquetaPromo }) => {
                  const v0 = prod.variantes[0];
                  return (
                    <article
                      key={prod.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--linea)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={prod.fotos[0] || '/img/slide4_flores_amor.jpg'}
                          alt={prod.nombre}
                          style={{ width: '100%', height: '190px', objectFit: 'cover', display: 'block' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: '#BE185D',
                            color: '#FFFFFF',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                          }}
                        >
                          {etiquetaPromo}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <strong style={{ fontSize: '0.95rem', color: 'var(--tinta)' }}>
                          {prod.nombre}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--gris)', lineHeight: 1.35 }}>
                          {prod.descripcionCorta.slice(0, 75)}
                          {prod.descripcionCorta.length > 75 ? '…' : ''}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              color: '#9CA3AF',
                              textDecoration: 'line-through',
                            }}
                          >
                            ${pvpAnterior.toFixed(2)}
                          </span>
                          <strong style={{ fontSize: '1.12rem', color: 'var(--tinta)' }}>
                            ${pvpActual.toFixed(2)} USD
                          </strong>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setProductoSeleccionadoModal(prod)}
                            title="Ver fotos, tamaños y detalles de esta promoción"
                            aria-label="Ver Oferta"
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: '999px',
                              border: '1px solid var(--linea)',
                              background: '#FAF7F0',
                              color: 'var(--tinta)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Ver Oferta
                          </button>

                          {v0 && !prod.esEvento && (
                            <button
                              type="button"
                              onClick={() => agregarItem(prod, v0)}
                              title="Agregar directamente al carrito"
                              aria-label="Agregar"
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                borderRadius: '999px',
                                border: 'none',
                                background: '#EC7FA7',
                                color: '#FFFFFF',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Agregar
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* 3. Descuentos por Volumen y Retiro Gratis en Tienda */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
                gap: '14px',
              }}
            >
              {productosVolumen.map(({ producto: pv, minUnidades, pvpVolumen, pvpBase }) => (
                <div
                  key={`vol-${pv.id}`}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    padding: '15px 16px',
                    border: '1px solid var(--linea)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369A1' }}>
                      🏷️ DESCUENTO POR CANTIDAD ({minUnidades}+ uds)
                    </span>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--tinta)' }}>
                      {pv.nombre}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 700 }}>
                      ${pvpVolumen.toFixed(2)} c/u{' '}
                      <span style={{ color: '#9CA3AF', textDecoration: 'line-through' }}>
                        (${pvpBase.toFixed(2)})
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductoSeleccionadoModal(pv)}
                    title="Ver escala de precios por cantidad"
                    aria-label="Ver Escala"
                    style={{
                      padding: '7px 13px',
                      borderRadius: '999px',
                      border: '1px solid #3D5A45',
                      background: '#FFFFFF',
                      color: '#3D5A45',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Ver Escala
                  </button>
                </div>
              ))}

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '15px 16px',
                  border: '1px solid var(--linea)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#FAF7F0',
                      color: '#3D5A45',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Store size={20} />
                  </span>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3D5A45' }}>
                      PROMOCIÓN PERMANENTE GENERAL
                    </span>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--tinta)' }}>
                      Retiro Gratis en Tienda Física ($0.00)
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: 'var(--gris)' }}>
                      Disponible para todo cliente en {configLogistica.origenNombre}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          MODAL: EXPEDIENTE COMPLETO DEL PEDIDO (ÍTEMS + ENTREGA + FACTURA SRI)
         ===================================================================== */}
      {pedidoDetalleAbierto && (
        <div
          onClick={() => setPedidoDetalleAbierto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle completo del pedido ${pedidoDetalleAbierto.codigo}`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1150,
            background: 'rgba(22, 28, 24, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(820px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#FAF7F0',
              borderRadius: '22px',
              border: '1px solid var(--linea)',
              boxShadow: '0 24px 48px rgba(22, 28, 24, 0.28)',
              padding: 'clamp(18px, 3.5vw, 28px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Cabecera modal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--linea)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#3D5A45' }}>
                  DETALLE COMPLETO DEL PEDIDO
                </span>
                <h3 style={{ margin: '2px 0 4px', fontSize: '1.35rem', color: 'var(--tinta)' }}>
                  {pedidoDetalleAbierto.codigo}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--gris)' }}>
                  Fecha de compra:{' '}
                  {new Date(pedidoDetalleAbierto.creadoEn).toLocaleString('es-EC', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setPedidoDetalleAbierto(null)}
                title="Cerrar detalle"
                aria-label="Cerrar"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '999px',
                  border: '1px solid var(--linea)',
                  background: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. Todos los Arreglos, Dedicatorias y Obsequios */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid var(--linea)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <strong style={{ fontSize: '0.92rem', color: 'var(--tinta)' }}>
                1. Productos y Tarjetas de Dedicatoria
              </strong>

              {pedidoDetalleAbierto.items.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: '#FDFBF7',
                    border: '1px solid #EFECE6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--tinta)' }}>
                        {it.cantidad}x {it.nombre}
                      </strong>
                      {it.variante && (
                        <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--gris)' }}>
                          Presentación: {it.variante} {it.sku ? `· SKU ${it.sku}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '0.9rem' }}>${it.subtotal.toFixed(2)}</strong>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--gris)' }}>
                        ${it.precioUnitario.toFixed(2)} c/u
                      </span>
                    </div>
                  </div>

                  {it.personalizacionFloral?.resumenTexto && (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: it.personalizacionFloral.mismosColoresFoto ? '#F0FDF4' : '#FDF2F8',
                        border: it.personalizacionFloral.mismosColoresFoto
                          ? '1px solid #BBF7D0'
                          : '1px solid #FBCFE8',
                        fontSize: '0.78rem',
                        color: it.personalizacionFloral.mismosColoresFoto ? '#166534' : '#831843',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      {(it.personalizacionFloral.fotoReferenciaUrl || it.imagen) && (
                        <img
                          src={it.personalizacionFloral.fotoReferenciaUrl || it.imagen}
                          alt={`Foto elegida ${it.nombre}`}
                          style={{
                            width: '48px',
                            height: '48px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '2px solid #2F4737',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div>
                        <strong>
                          {it.personalizacionFloral.mismosColoresFoto
                            ? '📸 Foto de referencia elegida:'
                            : '🎨 Personalización floral:'}
                        </strong>{' '}
                        {it.personalizacionFloral.resumenTexto}
                      </div>
                    </div>
                  )}

                  {it.dedicatoria &&
                    (it.dedicatoria.para || it.dedicatoria.de || it.dedicatoria.mensaje) && (
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          fontSize: '0.78rem',
                          color: '#78350F',
                        }}
                      >
                        <div>
                          <strong>Tarjeta impresa — Para:</strong> {it.dedicatoria.para || '—'}{' '}
                          · <strong>De:</strong> {it.dedicatoria.de || '—'}
                        </div>
                        {it.dedicatoria.mensaje && (
                          <div style={{ marginTop: '3px', fontStyle: 'italic' }}>
                            &ldquo;{it.dedicatoria.mensaje}&rdquo;
                          </div>
                        )}
                      </div>
                    )}
                </div>
              ))}

              {pedidoDetalleAbierto.regaloPrimeraCompra && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.84rem',
                    color: '#065F46',
                  }}
                >
                  <span>
                    🎁 <strong>Obsequio 1ra Compra:</strong> 1x{' '}
                    {pedidoDetalleAbierto.regaloPrimeraCompra.nombre}
                  </span>
                  <strong>$0.00 GRATIS</strong>
                </div>
              )}

              {/* Desglose financiero */}
              <div
                style={{
                  paddingTop: '8px',
                  borderTop: '1px solid var(--linea)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal Tarifa 0%:</span>
                  <span>${pedidoDetalleAbierto.baseIva0.toFixed(2)}</span>
                </div>
                {pedidoDetalleAbierto.baseIvaGravada > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal Gravado 15%:</span>
                    <span>${pedidoDetalleAbierto.baseIvaGravada.toFixed(2)}</span>
                  </div>
                )}
                {pedidoDetalleAbierto.iva > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>IVA 15%:</span>
                    <span>${pedidoDetalleAbierto.iva.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Envío / Logística:</span>
                  <span>
                    {pedidoDetalleAbierto.costoEnvio === 0
                      ? '$0.00 (Gratis)'
                      : `$${pedidoDetalleAbierto.costoEnvio.toFixed(2)}`}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1rem',
                    paddingTop: '4px',
                    borderTop: '1px dashed var(--linea)',
                  }}
                >
                  <strong>Total del Pedido:</strong>
                  <strong>${pedidoDetalleAbierto.total.toFixed(2)} USD</strong>
                </div>
              </div>
            </div>

            {/* 2. Datos de Entrega y Pago */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '15px 16px',
                  border: '1px solid var(--linea)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: 'var(--tinta)', marginBottom: '2px' }}>
                  2. Datos de Recepción / Entrega
                </strong>
                <div>
                  <strong>Modalidad:</strong>{' '}
                  {pedidoDetalleAbierto.entrega.retiroEnLocal
                    ? 'Retiro en Tienda Física'
                    : 'Entrega a Domicilio'}
                </div>
                <div>
                  <strong>Destinatario:</strong> {pedidoDetalleAbierto.entrega.destinatarioNombre}
                </div>
                {pedidoDetalleAbierto.entrega.destinatarioTelefono && (
                  <div>
                    <strong>Teléfono:</strong> {pedidoDetalleAbierto.entrega.destinatarioTelefono}
                  </div>
                )}
                <div>
                  <strong>Dirección:</strong> {pedidoDetalleAbierto.entrega.direccion}
                </div>
                {pedidoDetalleAbierto.entrega.referencia && (
                  <div>
                    <strong>Referencia:</strong> {pedidoDetalleAbierto.entrega.referencia}
                  </div>
                )}
                {pedidoDetalleAbierto.entrega.fechaEntrega && (
                  <div>
                    <strong>Fecha y horario:</strong> {pedidoDetalleAbierto.entrega.fechaEntrega}{' '}
                    {pedidoDetalleAbierto.entrega.franjaHoraria
                      ? `(${pedidoDetalleAbierto.entrega.franjaHoraria})`
                      : ''}
                  </div>
                )}
                {pedidoDetalleAbierto.entrega.enlaceMapa && (
                  <a
                    href={pedidoDetalleAbierto.entrega.enlaceMapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3D5A45', fontWeight: 700, marginTop: '3px' }}
                  >
                    📍 Abrir ubicación programada en Maps ↗
                  </a>
                )}
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '15px 16px',
                  border: '1px solid var(--linea)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: 'var(--tinta)', marginBottom: '2px' }}>
                  3. Datos del Comprador y Pago
                </strong>
                <div>
                  <strong>Comprador:</strong> {pedidoDetalleAbierto.comprador.nombreCompleto}
                </div>
                <div>
                  <strong>Identificación:</strong> {pedidoDetalleAbierto.comprador.identificacion}
                </div>
                {pedidoDetalleAbierto.comprador.correo && (
                  <div>
                    <strong>Correo:</strong> {pedidoDetalleAbierto.comprador.correo}
                  </div>
                )}
                <div>
                  <strong>Medio de pago:</strong>{' '}
                  {(pedidoDetalleAbierto.metodoPago || 'Online').toUpperCase()}
                </div>
                {pedidoDetalleAbierto.ultimoPagoPlux?.autorizacion && (
                  <div style={{ color: '#15803D', fontWeight: 700 }}>
                    <ShieldCheck size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Autorización PLUX: {pedidoDetalleAbierto.ultimoPagoPlux.autorizacion}
                    {pedidoDetalleAbierto.ultimoPagoPlux.ultimosDigitos
                      ? ` (•••• ${pedidoDetalleAbierto.ultimoPagoPlux.ultimosDigitos})`
                      : ''}
                  </div>
                )}
                {pedidoDetalleAbierto.comprobanteTransferencia?.url && (
                  <a
                    href={pedidoDetalleAbierto.comprobanteTransferencia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0369A1', fontWeight: 700, marginTop: '3px' }}
                  >
                    📎 Ver comprobante de transferencia adjunto ↗
                  </a>
                )}
              </div>
            </div>

            {/* 4. CONFIRMACIÓN DE ENTREGA CON EVIDENCIA FOTOGRÁFICA GPS */}
            <div
              style={{
                background: pedidoDetalleAbierto.confirmacionEntrega.confirmada
                  ? '#ECFDF5'
                  : '#FFFFFF',
                borderRadius: '16px',
                padding: '16px',
                border: pedidoDetalleAbierto.confirmacionEntrega.confirmada
                  ? '1.5px solid #6EE7B7'
                  : '1px solid var(--linea)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle2
                  size={18}
                  color={
                    pedidoDetalleAbierto.confirmacionEntrega.confirmada ? '#059669' : '#64748B'
                  }
                />
                <strong style={{ fontSize: '0.94rem', color: 'var(--tinta)' }}>
                  4. Confirmación de Entrega
                </strong>
              </div>

              {pedidoDetalleAbierto.confirmacionEntrega.confirmada ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: pedidoDetalleAbierto.confirmacionEntrega.fotoEvidenciaUrl
                      ? 'repeat(auto-fit, minmax(220px, 1fr))'
                      : '1fr',
                    gap: '14px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.83rem', color: '#065F46', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div>
                      <strong>Estado:</strong> Entregado satisfactoriamente
                    </div>
                    {pedidoDetalleAbierto.confirmacionEntrega.fechaHoraConfirmacion && (
                      <div>
                        <strong>Fecha y hora exacta:</strong>{' '}
                        {new Date(
                          pedidoDetalleAbierto.confirmacionEntrega.fechaHoraConfirmacion
                        ).toLocaleString('es-EC', {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </div>
                    )}
                    {pedidoDetalleAbierto.confirmacionEntrega.entregadorNombre && (
                      <div>
                        <strong>Entregado por:</strong>{' '}
                        {pedidoDetalleAbierto.confirmacionEntrega.entregadorNombre}
                      </div>
                    )}
                    {pedidoDetalleAbierto.confirmacionEntrega.direccionGps && (
                      <div>
                        <strong>Ubicación GPS verificada:</strong>{' '}
                        {pedidoDetalleAbierto.confirmacionEntrega.direccionGps}
                      </div>
                    )}
                    {pedidoDetalleAbierto.confirmacionEntrega.observaciones && (
                      <div>
                        <strong>Nota de entrega:</strong>{' '}
                        {pedidoDetalleAbierto.confirmacionEntrega.observaciones}
                      </div>
                    )}
                    {pedidoDetalleAbierto.confirmacionEntrega.mapaUrl && (
                      <a
                        href={pedidoDetalleAbierto.confirmacionEntrega.mapaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#047857', fontWeight: 700 }}
                      >
                        📍 Ver punto exacto de entrega en Google Maps ↗
                      </a>
                    )}
                  </div>

                  {pedidoDetalleAbierto.confirmacionEntrega.fotoEvidenciaUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <img
                        src={pedidoDetalleAbierto.confirmacionEntrega.fotoEvidenciaUrl}
                        alt={`Evidencia de entrega ${pedidoDetalleAbierto.codigo}`}
                        onClick={() =>
                          setFotoEvidenciaAmpliada({
                            url: pedidoDetalleAbierto.confirmacionEntrega.fotoEvidenciaUrl!,
                            codigo: pedidoDetalleAbierto.codigo,
                          })
                        }
                        style={{
                          width: '100%',
                          maxHeight: '240px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '2px solid #FFFFFF',
                          cursor: 'zoom-in',
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', color: '#047857', textAlign: 'center' }}>
                        Toca la fotografía para ampliarla a pantalla completa
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--gris)' }}>
                  Tu pedido se encuentra en proceso ({obtenerBadgeEstadoPedido(pedidoDetalleAbierto).etiqueta}
                  ). En cuanto nuestro repartidor realice la entrega, verás aquí la hora exacta y la
                  fotografía de confirmación georreferenciada.
                </p>
              )}
            </div>

            {/* 5. FACTURA ELECTRÓNICA SRI */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid var(--linea)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Receipt size={18} color="#3D5A45" />
                <strong style={{ fontSize: '0.94rem', color: 'var(--tinta)' }}>
                  5. Factura Electrónica SRI
                </strong>
              </div>

              {pedidoDetalleAbierto.facturaElectronica ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.82rem', color: 'var(--tinta)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div>
                      <strong>Comprobante N°:</strong>{' '}
                      {pedidoDetalleAbierto.facturaElectronica.numero_comprobante} (
                      {pedidoDetalleAbierto.facturaElectronica.estado})
                    </div>
                    <div>
                      <strong>Razón Social:</strong>{' '}
                      {pedidoDetalleAbierto.facturaElectronica.comprador?.razon_social ||
                        pedidoDetalleAbierto.comprador.nombreCompleto}{' '}
                      · <strong>ID:</strong>{' '}
                      {pedidoDetalleAbierto.facturaElectronica.comprador?.identificacion ||
                        pedidoDetalleAbierto.comprador.identificacion}
                    </div>
                    {pedidoDetalleAbierto.facturaElectronica.clave_acceso && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--gris)', wordBreak: 'break-all' }}>
                        <strong>Clave de Acceso SRI:</strong>{' '}
                        {pedidoDetalleAbierto.facturaElectronica.clave_acceso}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => ejecutarAccionFacturaRide(pedidoDetalleAbierto, 'imprimir')}
                      title="Abrir factura electrónica RIDE para imprimir o guardar PDF"
                      aria-label="Imprimir RIDE"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 15px',
                        borderRadius: '999px',
                        border: 'none',
                        background: '#2D4334',
                        color: '#FFFFFF',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Printer size={14} />
                      <span>Imprimir RIDE</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => ejecutarAccionFacturaRide(pedidoDetalleAbierto, 'descargar')}
                      title="Descargar archivo RIDE de tu factura electrónica"
                      aria-label="Descargar RIDE"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 15px',
                        borderRadius: '999px',
                        border: '1px solid #2D4334',
                        background: '#FFFFFF',
                        color: '#2D4334',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={14} />
                      <span>Descargar RIDE</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.83rem', color: 'var(--gris)' }}>
                  Tu comprobante electrónico se encuentra en cola de emisión. Puedes actualizar tus
                  datos tributarios predeterminados en{' '}
                  <Link href="/panel/cuenta" style={{ color: '#3D5A45', fontWeight: 700 }}>
                    Mi Cuenta
                  </Link>
                  .
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para Fotografía de Confirmación de Entrega */}
      {fotoEvidenciaAmpliada && (
        <div
          onClick={() => setFotoEvidenciaAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Fotografía de entrega ampliada"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            background: 'rgba(10, 14, 12, 0.88)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            gap: '14px',
          }}
        >
          <img
            src={fotoEvidenciaAmpliada.url}
            alt={`Confirmación de entrega ${fotoEvidenciaAmpliada.codigo}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(920px, 95vw)',
              maxHeight: '80vh',
              borderRadius: '14px',
              objectFit: 'contain',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
            <a
              href={fotoEvidenciaAmpliada.url}
              download={`Entrega-${fotoEvidenciaAmpliada.codigo}.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              title="Descargar fotografía de confirmación de entrega"
              aria-label="Descargar Foto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '999px',
                background: '#FFFFFF',
                color: '#111827',
                textDecoration: 'none',
                fontSize: '0.84rem',
                fontWeight: 700,
              }}
            >
              <Download size={15} />
              <span>Descargar Foto</span>
            </a>
            <button
              type="button"
              onClick={() => setFotoEvidenciaAmpliada(null)}
              title="Cerrar fotografía"
              aria-label="Cerrar"
              style={{
                padding: '9px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'transparent',
                color: '#FFFFFF',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Edición de Proforma Guardada */}
      {proformaEditando && (
        <ModalEditarProformaCliente
          proforma={{
            id: proformaEditando.id,
            codigo: proformaEditando.codigo,
            tokenAprobacion: proformaEditando.tokenAprobacion,
            evento: proformaEditando.evento || {
              tipoEvento: 'Boda / Ceremonia',
              fechaEvento: proformaEditando.entrega.fechaEntrega || '',
            },
            ubicacion: {
              retiroEnLocal: proformaEditando.entrega.retiroEnLocal,
              direccion: proformaEditando.entrega.direccion,
              referencia: proformaEditando.entrega.referencia,
              enlaceMapa: proformaEditando.entrega.enlaceMapa,
              zonaDetectada: proformaEditando.entrega.zonaDetectada,
              distanciaVialKm: proformaEditando.entrega.distanciaVialKm,
              costoEnvio: proformaEditando.costoEnvio,
            },
            items: proformaEditando.items.map((it) => ({
              productoId: it.productoId,
              sku: it.sku,
              descripcion: it.nombre,
              varianteNombre: it.variante,
              cantidad: it.cantidad,
              precioUnitario: it.precioUnitario,
              tarifaIva: it.tarifaIva,
              imagen: it.imagen,
            })),
          }}
          productosCatalogo={catalogoLive}
          configLogistica={configLogistica}
          clienteRegistrado={true}
          onCerrar={() => setProformaEditando(null)}
          onGuardadoExitoso={() => {
            setProformaEditando(null);
            setAvisoOk('✨ Tu proforma fue actualizada correctamente.');
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

export function EspacioClienteEcommerceTinkay(props: PropsEspacioClienteEcommerceTinkay) {
  return (
    <Suspense fallback={null}>
      <ContenidoEspacioCliente {...props} />
    </Suspense>
  );
}
