'use client';
import { SelectConBuscador } from "@eco/comercio";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SelectorUbicacionEntrega,
  construirUrlWhatsappTienda,
  generarProformaEventoAction,
} from '@eco/comercio';
import { ModalTerminosWhatsapp } from '@eco/identidad/componentes/ModalTerminosWhatsapp';
import {
  PAISES_TELEFONO,
  PAIS_TELEFONO_DEFECTO,
} from '@eco/identidad/paises';
import {
  codigosNegocio,
  proyectarPerfilPorNegocio,
} from '@eco/identidad/negocio';
import { crearClienteNavegador } from '@eco/supabase/cliente';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import {
  X,
  Trash2,
  Plus,
  Minus,
  FileText,
  Calendar,
  MapPin,
  Sparkles,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

const TIPOS_EVENTO = [
  'Boda / Ceremonia',
  'Bautizo / Primera Comunión',
  'Evento Corporativo / Gala',
  'Cumpleaños / Aniversario',
  'Pedida de Mano / Cena Romántica',
  'Otro Evento Especial',
];

export function DrawerProformaEvento() {
  const router = useRouter();
  const {
    itemsProforma,
    cantidadTotalProforma,
    drawerProformaAbierto,
    setDrawerProformaAbierto,
    agregarItemProforma,
    eliminarItemProforma,
    actualizarCantidadProforma,
    datosEventoProforma,
    actualizarDatosEventoProforma,
    ubicacionEventoProforma,
    actualizarUbicacionEventoProforma,
    configTiendaCheckout,
    vaciarProforma,
    subtotalProforma,
    descuentoProforma,
    ivaProforma,
    fleteProforma,
    totalProforma,
    reserva70Proforma,
    configLogistica,
    productos,
  } = useCarrito();

  const [usuarioAutenticado, setUsuarioAutenticado] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [correo, setCorreo] = useState('');
  const [codigoPais, setCodigoPais] = useState(PAIS_TELEFONO_DEFECTO);
  const [whatsappDigitos, setWhatsappDigitos] = useState('');
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(false);
  const [modalTerminosWaAbierto, setModalTerminosWaAbierto] = useState(false);
  const [mostrarMapaEvento, setMostrarMapaEvento] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    if (!drawerProformaAbierto) return;
    let cancelado = false;
    const supabase = crearClienteNavegador();
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelado || !data?.user) return;

      const [{ data: perfilRaw }, { data: memTinkay }] = await Promise.all([
        supabase
          .schema('comun_seguridad')
          .from('seg_usuario')
          .select(
            'usu_nombres, usu_apellidos, usu_cedula, usu_whatsapp, usu_autorizacion_whatsapp, usu_superadmin_plataforma, usu_detalle_usuario'
          )
          .eq('usu_id', data.user.id)
          .maybeSingle(),
        supabase
          .schema('comun_seguridad')
          .from('seg_membresia')
          .select('mem_id')
          .eq('mem_usuario_id', data.user.id)
          .in('mem_negocio', codigosNegocio('tinkay'))
          .eq('mem_estado', 'ACTIVO')
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelado || !perfilRaw) return;
      const perfil = proyectarPerfilPorNegocio(perfilRaw, 'tinkay', Boolean(memTinkay));
      if (!perfil) return;

      setUsuarioAutenticado({
        id: data.user.id,
        email: data.user.email || '',
      });
      if (data.user.email) {
        setCorreo((prev) => prev || data.user.email || '');
      }

      const nom = [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(' ').trim();
      if (nom) setNombreCompleto((prev) => prev || nom);
      if (perfil.usu_cedula) setIdentificacion((prev) => prev || String(perfil.usu_cedula));
      if (perfil.usu_whatsapp) {
        const raw = String(perfil.usu_whatsapp).trim();
        const paisEncontrado = PAISES_TELEFONO.find((p) => raw.startsWith(p.prefijo));
        if (paisEncontrado) {
          setCodigoPais(paisEncontrado.codigo);
          setWhatsappDigitos((prev) => prev || raw.slice(paisEncontrado.prefijo.length));
        } else {
          setWhatsappDigitos((prev) => prev || raw.replace(/\D+/g, ''));
        }
        if (raw.replace(/\D+/g, '').length > 0) {
          setAutorizaWhatsapp(true);
        }
      } else if (perfil.usu_autorizacion_whatsapp) {
        setAutorizaWhatsapp(true);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [drawerProformaAbierto]);

  useEffect(() => {
    if (!drawerProformaAbierto) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !modalTerminosWaAbierto) {
        setDrawerProformaAbierto(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerProformaAbierto, modalTerminosWaAbierto, setDrawerProformaAbierto]);

  // Sugerir ÚNICAMENTE otros productos de Eventos (cero extras florales, cero cintas, cero renta)
  const sugerenciasEventos = useMemo(() => {
    const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
    return catalogo
      .filter((p) => {
        if (p.esExtra || p.esComplemento) return false;
        const catPrincipal = (p.categoriaPrincipal || '').toLowerCase();
        const catNombre = (p.categoriaNombre || '').toLowerCase();
        if (catPrincipal.includes('extra') || catNombre.includes('extra')) return false;

        const esRentaItem = Boolean(
          p.esRenta === true ||
            p.tipoOferta?.toUpperCase().includes('RENTA') ||
            p.tipoOferta?.toUpperCase().includes('ALQUILER') ||
            (p.etiquetas || []).some(
              (e) => e.toLowerCase().includes('renta') || e.toLowerCase().includes('alquiler')
            )
        );
        if (esRentaItem) return false;

        const esEventoItem = Boolean(
          p.esEvento === true ||
            catPrincipal.includes('evento') ||
            catNombre.includes('evento') ||
            catNombre.includes('ceremonia') ||
            (p.tipoOferta || '').toUpperCase() === 'SERVICIO'
        );
        if (!esEventoItem) return false;

        return !itemsProforma.some(
          (it) =>
            it.producto.id === p.id ||
            (p.proIdUuid && it.producto.proIdUuid === p.proIdUuid) ||
            it.producto.slug === p.slug
        );
      })
      .slice(0, 6);
  }, [productos, itemsProforma]);

  if (!drawerProformaAbierto) return null;

  const paisActual =
    PAISES_TELEFONO.find((p) => p.codigo === codigoPais) ?? PAISES_TELEFONO[0]!;

  const construirWhatsappE164 = () => {
    const limpio = whatsappDigitos.replace(/\D+/g, '').replace(/^0+/, '');
    return limpio ? `${paisActual.prefijo}${limpio}` : '';
  };

  const handleEmitirProforma = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);

    if (itemsProforma.length === 0) {
      setErrorForm('Agrega al menos un producto de eventos a tu proforma.');
      return;
    }
    if (nombreCompleto.trim().length < 2) {
      setErrorForm('Por favor ingresa tu nombre completo o empresa.');
      return;
    }
    if (!correo.trim().includes('@')) {
      setErrorForm('Por favor ingresa un correo electrónico válido para recibir tu PDF.');
      return;
    }
    const tieneWhatsapp = whatsappDigitos.replace(/\D+/g, '').length > 0;
    const waE164 = tieneWhatsapp ? construirWhatsappE164() : '';
    if (tieneWhatsapp) {
      if (waE164.length < 10) {
        setErrorForm(
          'Ingresa un número de WhatsApp válido o deja el campo vacío para recibir tu proforma por correo.'
        );
        return;
      }
      if (!autorizaWhatsapp) {
        setErrorForm(
          'Al ingresar tu número de WhatsApp debes mantener marcado el consentimiento para contactarte.'
        );
        return;
      }
    }
    if (!datosEventoProforma.fechaEvento) {
      setErrorForm('Selecciona la fecha estimada de tu evento.');
      return;
    }

    setGenerando(true);
    const res = await generarProformaEventoAction({
      negocio: 'tinkay',
      comprador: {
        nombreCompleto: nombreCompleto.trim(),
        identificacion: identificacion.trim() || undefined,
        correo: correo.trim(),
        whatsapp: waE164,
        autorizaWhatsapp: tieneWhatsapp ? Boolean(autorizaWhatsapp) : false,
      },
      evento: {
        tipoEvento: datosEventoProforma.tipoEvento || 'Evento Especial',
        fechaEvento: datosEventoProforma.fechaEvento,
        horaEvento: datosEventoProforma.horaEvento || undefined,
        invitadosEstimados: datosEventoProforma.invitadosEstimados
          ? Number(datosEventoProforma.invitadosEstimados)
          : undefined,
        paletaColores: datosEventoProforma.paletaColores || undefined,
        notasEvento: datosEventoProforma.notasEvento || undefined,
      },
      ubicacionEvento: {
        retiroEnLocal: Boolean(ubicacionEventoProforma.retiroEnLocal),
        destinatarioNombre: nombreCompleto.trim(),
        destinatarioTelefono: waE164,
        direccion:
          ubicacionEventoProforma.direccion || 'Locación del evento en Quito / Valles (por confirmar)',
        referencia: ubicacionEventoProforma.referencia || '',
        ciudad: ubicacionEventoProforma.ciudad || 'Quito',
        fechaEntrega: datosEventoProforma.fechaEvento,
        franjaHoraria: 'hora_exacta',
        horaExacta: datosEventoProforma.horaEvento || '16:00',
        enlaceMapa: ubicacionEventoProforma.enlaceMapa,
        lat: ubicacionEventoProforma.lat,
        lng: ubicacionEventoProforma.lng,
        zonaDetectadaNombre: ubicacionEventoProforma.zonaDetectadaNombre,
        reglaLogisticaAplicada: ubicacionEventoProforma.reglaLogisticaAplicada,
        distanciaVialKm: ubicacionEventoProforma.distanciaVialKm,
        costoEnvioCalculado: fleteProforma,
        etiquetaCotizacion: ubicacionEventoProforma.etiquetaCotizacion,
        formulaCalculoInterno: ubicacionEventoProforma.formulaCalculoInterno,
        detalleDireccionGeo: ubicacionEventoProforma.detalleDireccionGeo ?? null,
      },
      items: itemsProforma.map((it) => ({
        productoId: it.producto.id,
        productoNombre: it.producto.nombre,
        varianteSku: it.variante.sku,
        varianteNombre: it.variante.nombre,
        cantidad: it.cantidad,
        pvpUnitario: it.variante.pvp,
        tarifaIva: it.variante.tarifaIva,
        imagen: it.producto.fotos[0],
        deliveryIncluidoProducto: it.producto.deliveryIncluido !== false,
        recargoLogisticoUsd: it.producto.recargoLogisticoUsd || 0,
      })),
      subtotalBaseImponible: subtotalProforma,
      descuentoTotal: descuentoProforma,
      totalIva: ivaProforma,
      totalFlete: fleteProforma,
      totalPagar: totalProforma,
      vigenciaDias: 15,
      conversacionWebId:
        typeof window !== 'undefined'
          ? window.localStorage.getItem('eco_chat_conv_tinkay') || undefined
          : undefined,
    });
    setGenerando(false);

    if (!res.ok) {
      setErrorForm(res.error);
      return;
    }

    vaciarProforma();
    setDrawerProformaAbierto(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('eco:refrescar-notificaciones'));
    }
    router.push(`/proforma/${res.tokenAprobacion}`);
  };

  const rutaBaseRetorno =
    typeof window !== 'undefined' && window.location.pathname
      ? window.location.pathname
      : '/';
  const destinoConProforma = `${rutaBaseRetorno}?proforma=abierta`;
  const urlRegistroConRetorno = `/registro?destino=${encodeURIComponent(destinoConProforma)}`;
  const urlIngresoConRetorno = `/ingresar?destino=${encodeURIComponent(destinoConProforma)}`;

  const inputEstilo: React.CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    borderRadius: '9px',
    border: '1px solid #D6D3D1',
    fontSize: '0.86rem',
    color: '#1C1917',
    background: '#FFFFFF',
  };

  return (
    <>
      <div
        className="drawer-backdrop-carrito"
        onClick={() => setDrawerProformaAbierto(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          background: 'rgba(34, 29, 26, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <aside
          className="drawer-panel-carrito"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Mi Proforma de Evento"
          style={{
            width: 'min(520px, 100%)',
            maxWidth: '520px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#FAF8F5',
            boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.22)',
            overflow: 'hidden',
          }}
        >
          {/* Cabecera */}
          <div
            className="cabecera-drawer-carrito"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px',
              background: '#2D4734',
              color: '#FFFFFF',
              borderBottom: 'none',
              flexShrink: 0,
            }}
          >
            <div
              className="titulo-con-icono-drawer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}
            >
              <FileText size={20} />
              <div>
                <h2 style={{ color: '#FFFFFF', margin: 0, fontSize: '1.08rem' }}>
                  Mi Proforma de Evento ({cantidadTotalProforma})
                </h2>
                <small style={{ color: '#FDE68A', fontSize: '0.75rem' }}>
                  Autoservicio en PDF + asesoría personalizada y pago online
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-cerrar-drawer"
              onClick={() => setDrawerProformaAbierto(false)}
              title="Cerrar proforma"
              aria-label="Cerrar proforma"
              style={{
                color: '#FFFFFF',
                background: 'rgba(255, 255, 255, 0.14)',
                border: 'none',
                borderRadius: '999px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Cuerpo */}
          <div
            className="cuerpo-scroll-carrito"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {itemsProforma.length === 0 ? (
              <div
                className="cuerpo-carrito-vacio"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  textAlign: 'center',
                  gap: '10px',
                }}
              >
                <Sparkles size={40} style={{ color: '#2D4734', marginBottom: '4px' }} />
                <h3 style={{ margin: 0, color: '#1C1917' }}>Arma tu Proforma de Evento</h3>
                <p style={{ margin: 0, color: '#57534E', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Selecciona arreglos ceremoniales, carteles de bienvenida o arcos florales para
                  obtener tu proforma formal en PDF al instante.
                </p>
              </div>
            ) : (
            <form
              id="form-emitir-proforma-evento"
              onSubmit={handleEmitirProforma}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Banner Sugerencia de Registro (No bloqueante) */}
              {!usuarioAutenticado ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                      color: '#14532D',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    <UserPlus size={16} />
                    <span>Sugerencia: Guarda tus proformas y variaciones en tu cuenta</span>
                  </div>
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontSize: '0.78rem',
                      color: '#166534',
                      lineHeight: 1.45,
                    }}
                  >
                    Sin cuenta podrás descargar tu PDF al instante y escribirnos al{' '}
                    <strong>{configTiendaCheckout.whatsappTienda}</strong>. Si te registras, guardaremos tus proformas y
                    variaciones de asesor en tu panel.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link
                      href={urlRegistroConRetorno}
                      title="Crear cuenta y volver a esta proforma"
                      aria-label="Crear Cuenta"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        background: '#2D4734',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        fontSize: '0.77rem',
                        fontWeight: 700,
                      }}
                    >
                      Crear Cuenta
                    </Link>
                    <Link
                      href={urlIngresoConRetorno}
                      title="Iniciar sesión con tu cuenta"
                      aria-label="Ya tengo cuenta"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        border: '1px solid #2D4734',
                        background: '#FFFFFF',
                        color: '#2D4734',
                        textDecoration: 'none',
                        fontSize: '0.77rem',
                        fontWeight: 700,
                      }}
                    >
                      Ingresar
                    </Link>
                    <a
                      href={construirUrlWhatsappTienda(
                        configTiendaCheckout.whatsappTienda,
                        'Hola Tinkay, estoy armando una proforma de evento en su tienda web y deseo asesoría.'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Contactar a Tinkay por WhatsApp al ${configTiendaCheckout.whatsappTienda}`}
                      aria-label="Contáctanos WhatsApp"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        background: '#059669',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        fontSize: '0.77rem',
                        fontWeight: 700,
                      }}
                    >
                      Contáctanos WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#166534',
                    fontSize: '0.8rem',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    Sesión activa ({usuarioAutenticado.email}) · Esta proforma y sus variaciones
                    quedarán guardadas en tu cuenta.
                  </span>
                </div>
              )}

              {/* Lista de ítems de Evento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '0.85rem', color: '#1C1917' }}>
                  1. Elementos seleccionados para tu evento
                </strong>
                {itemsProforma.map((item) => {
                  const nominal = item.variante.pvpNominalSinVolumen ?? item.variante.pvp;
                  const ahorroLinea = Math.max(0, (nominal - item.variante.pvp) * item.cantidad);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        padding: '10px',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        border: '1px solid #E7E5E4',
                        alignItems: 'center',
                      }}
                    >
                      <img
                        src={item.producto.fotos[0] || '/img/slide4_flores_amor.jpg'}
                        alt={item.producto.nombre}
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '9px',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: '0.86rem',
                            color: '#1C1917',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.producto.nombre}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#57534E' }}>
                          {item.variante.nombre} · ${item.variante.pvp.toFixed(2)} c/u
                        </span>
                        {ahorroLinea > 0.01 && (
                          <div style={{ fontSize: '0.72rem', color: '#B45309', fontWeight: 700 }}>
                            🏷️ Ahorro volumen: -${ahorroLinea.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => actualizarCantidadProforma(item.id, item.cantidad - 1)}
                          title="Disminuir cantidad"
                          aria-label="Disminuir"
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid #D6D3D1',
                            background: '#FAFAF9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => actualizarCantidadProforma(item.id, item.cantidad + 1)}
                          title="Aumentar cantidad"
                          aria-label="Aumentar"
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid #D6D3D1',
                            background: '#FAFAF9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarItemProforma(item.id)}
                          title="Quitar de la proforma"
                          aria-label="Quitar"
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#B91C1C',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            marginLeft: '2px',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sugerencias exclusivas de OTROS productos de Eventos */}
              {sugerenciasEventos.length > 0 && (
                <div
                  style={{
                    padding: '11px 12px',
                    borderRadius: '12px',
                    background: '#FAF8F5',
                    border: '1px solid #E7E5E4',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#2D4734',
                      marginBottom: '8px',
                    }}
                  >
                    ✨ Otros elementos de Eventos que puedes sumar a tu proforma:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {sugerenciasEventos.map((sug) => {
                      const varSug = sug.variantes[0];
                      if (!varSug) return null;
                      return (
                        <div
                          key={sug.id}
                          style={{
                            minWidth: '148px',
                            maxWidth: '148px',
                            padding: '8px',
                            borderRadius: '10px',
                            background: '#FFFFFF',
                            border: '1px solid #E7E5E4',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                          }}
                        >
                          <img
                            src={sug.fotos[0] || '/img/slide4_flores_amor.jpg'}
                            alt={sug.nombre}
                            style={{
                              width: '100%',
                              height: '74px',
                              objectFit: 'cover',
                              borderRadius: '7px',
                            }}
                          />
                          <strong
                            style={{
                              fontSize: '0.75rem',
                              lineHeight: 1.25,
                              color: '#1C1917',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {sug.nombre}
                          </strong>
                          <div
                            style={{
                              marginTop: 'auto',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2D4734' }}>
                              ${varSug.pvp.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => agregarItemProforma(sug, varSug, 1)}
                              title={`Sumar ${sug.nombre} a la proforma`}
                              aria-label="Sumar"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#2D4734',
                                color: '#FFFFFF',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              + Sumar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Datos del Evento */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#FFFFFF',
                  border: '1px solid #E7E5E4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                }}
              >
                <strong style={{ fontSize: '0.85rem', color: '#1C1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} style={{ color: '#2D4734' }} />
                  <span>2. Datos de tu Evento</span>
                </strong>

                <div className="grid-form-responsive-2col">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <SelectConBuscador
                      value={datosEventoProforma.tipoEvento}
                      onChange={(e) => actualizarDatosEventoProforma({ tipoEvento: e.target.value })}
                      style={inputEstilo}
                    >
                      {TIPOS_EVENTO.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </SelectConBuscador>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', color: '#57534E', marginBottom: '3px' }}>
                      Fecha estimada *
                    </label>
                    <input
                      type="date"
                      required
                      value={datosEventoProforma.fechaEvento}
                      onChange={(e) =>
                        actualizarDatosEventoProforma({ fechaEvento: e.target.value })
                      }
                      style={inputEstilo}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', color: '#57534E', marginBottom: '3px' }}>
                      Hora de montaje / inicio
                    </label>
                    <input
                      type="time"
                      value={datosEventoProforma.horaEvento}
                      onChange={(e) =>
                        actualizarDatosEventoProforma({ horaEvento: e.target.value })
                      }
                      style={inputEstilo}
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder="N° invitados aprox."
                    value={datosEventoProforma.invitadosEstimados}
                    onChange={(e) =>
                      actualizarDatosEventoProforma({ invitadosEstimados: e.target.value })
                    }
                    style={inputEstilo}
                  />
                  <input
                    type="text"
                    placeholder="Paleta de colores (ej. blanco y olivo)"
                    value={datosEventoProforma.paletaColores}
                    onChange={(e) =>
                      actualizarDatosEventoProforma({ paletaColores: e.target.value })
                    }
                    style={inputEstilo}
                  />
                </div>

                <textarea
                  rows={2}
                  placeholder="Notas adicionales o ideas para tu asesor de eventos..."
                  value={datosEventoProforma.notasEvento}
                  onChange={(e) => actualizarDatosEventoProforma({ notasEvento: e.target.value })}
                  style={inputEstilo}
                />

                {/* Ubicación / Locación opcional con cálculo GPS */}
                <div style={{ borderTop: '1px solid #F5F5F4', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarMapaEvento(!mostrarMapaEvento)}
                    title="Indicar locación del evento en el mapa"
                    aria-label="Locación del Evento"
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #E7E5E4',
                      background: '#FAFAF9',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#2D4734',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} />
                      <span>
                        {ubicacionEventoProforma.direccion
                          ? `Locación: ${ubicacionEventoProforma.direccion.slice(0, 34)}...`
                          : 'Cotizar transporte según locación GPS (opcional)'}
                      </span>
                    </span>
                    {mostrarMapaEvento ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {mostrarMapaEvento && (
                    <div style={{ marginTop: '8px' }}>
                      <SelectorUbicacionEntrega
                        negocio="tinkay"
                        configuracionInicial={configLogistica}
                        clienteRegistrado={Boolean(usuarioAutenticado)}
                        permitirModoRetiro={true}
                        retiroEnLocal={Boolean(ubicacionEventoProforma.retiroEnLocal)}
                        enlaceMapaInicial={ubicacionEventoProforma.enlaceMapa}
                        onCambioCotizacion={(ev) => {
                          actualizarUbicacionEventoProforma({
                            retiroEnLocal: ev.retiroEnLocal,
                            enlaceMapa: ev.enlaceMapa,
                            direccion:
                              ev.direccionSugerida || ubicacionEventoProforma.direccion || '',
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
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Datos de Contacto + WhatsApp + Consentimiento LOPDP */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#FFFFFF',
                  border: '1px solid #E7E5E4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                }}
              >
                <strong style={{ fontSize: '0.85rem', color: '#1C1917' }}>
                  3. Tus datos para recibir la Proforma en PDF
                </strong>

                <div className="grid-form-responsive-2col">
                  <input
                    type="text"
                    required
                    placeholder="Nombre completo o empresa *"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    style={{ ...inputEstilo, gridColumn: '1 / -1' }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Correo electrónico (recibirás PDF) *"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    style={inputEstilo}
                  />
                  <input
                    type="text"
                    placeholder="Cédula / RUC (opcional)"
                    value={identificacion}
                    onChange={(e) => setIdentificacion(e.target.value)}
                    style={inputEstilo}
                  />
                </div>

                {/* WhatsApp opcional con selector compacto de país */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#44403C', marginBottom: '4px' }}>
                    Número de WhatsApp (opcional)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <SelectConBuscador
                      value={codigoPais}
                      onChange={(e) => setCodigoPais(e.target.value)}
                      aria-label="País de WhatsApp"
                      style={{
                        ...inputEstilo,
                        width: '108px',
                        flexShrink: 0,
                        padding: '9px 6px',
                      }}
                    >
                      {PAISES_TELEFONO.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.codigo} ({p.prefijo})
                        </option>
                      ))}
                    </SelectConBuscador>
                    <input
                      type="tel"
                      placeholder="99 123 4567 (si lo dejas vacío se envía a tu correo)"
                      value={whatsappDigitos}
                      onChange={(e) => {
                        const nuevoValor = e.target.value;
                        setWhatsappDigitos(nuevoValor);
                        const digitos = nuevoValor.replace(/\D+/g, '');
                        if (digitos.length > 0) {
                          setAutorizaWhatsapp(true);
                        } else {
                          setAutorizaWhatsapp(false);
                        }
                      }}
                      style={inputEstilo}
                    />
                  </div>
                  <small style={{ display: 'block', marginTop: '4px', fontSize: '0.71rem', color: '#57534E' }}>
                    Si no ingresas WhatsApp, enviaremos tu proforma en PDF directamente a tu correo electrónico.
                  </small>
                </div>

                {/* Consentimiento expreso LOPDP (se marca automáticamente al escribir WhatsApp) */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '9px 10px',
                    borderRadius: '9px',
                    background: '#FAF8F5',
                    border: '1px solid #E7E5E4',
                    fontSize: '0.76rem',
                    color: '#44403C',
                    lineHeight: 1.4,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autorizaWhatsapp}
                    onChange={(e) => setAutorizaWhatsapp(e.target.checked)}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    Autorizo a Tinkay a contactarme por WhatsApp y correo para enviarme esta
                    proforma, variaciones actualizadas por un asesor e información de mi evento.{' '}
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setModalTerminosWaAbierto(true);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#2D4734',
                        textDecoration: 'underline',
                        fontWeight: 700,
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '0.76rem',
                      }}
                    >
                      Ver cláusula LOPDP
                    </button>
                  </span>
                </label>
              </div>

              {errorForm && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: '0.8rem',
                  }}
                >
                  {errorForm}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Pie Fijo con Resumen y Botón Conciso */}
        {itemsProforma.length > 0 && (
          <div
            className="pie-drawer-carrito"
            style={{
              padding: '14px 16px',
              background: '#FFFFFF',
              borderTop: '1px solid #E7E5E4',
              flexShrink: 0,
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '2px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal arreglos:</span>
                <span>${(subtotalProforma + ivaProforma).toFixed(2)}</span>
              </div>
              {descuentoProforma > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B45309', fontWeight: 700 }}>
                  <span>Ahorro por volumen:</span>
                  <span>-${descuentoProforma.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Transporte / logística:</span>
                <span>{fleteProforma === 0 ? 'Incluido ($0.00)' : `$${fleteProforma.toFixed(2)}`}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px solid #E7E5E4',
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  color: '#2D4734',
                }}
              >
                <span>Total Proforma:</span>
                <span>${totalProforma.toFixed(2)} USD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#57534E' }}>
                <span>Reserva de fecha sugerida (70%):</span>
                <strong>${reserva70Proforma.toFixed(2)} USD</strong>
              </div>
            </div>

            <button
              type="submit"
              form="form-emitir-proforma-evento"
              disabled={generando}
              title="Emitir proforma numerada en PDF y abrir opciones de pago"
              aria-label="Generar Proforma"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '999px',
                border: 'none',
                background: '#2D4734',
                color: '#FFFFFF',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: generando ? 'wait' : 'pointer',
                opacity: generando ? 0.75 : 1,
              }}
            >
              {generando ? <Loader2 size={18} /> : <FileText size={18} />}
              <span>{generando ? 'Generando...' : 'Generar Proforma'}</span>
            </button>
          </div>
        )}
      </aside>
      </div>

      <ModalTerminosWhatsapp
        abierto={modalTerminosWaAbierto}
        alCerrar={() => setModalTerminosWaAbierto(false)}
        alAceptar={() => {
          setAutorizaWhatsapp(true);
          setModalTerminosWaAbierto(false);
        }}
        negocioNombre="Tinkay Floristería"
      />
    </>
  );
}
