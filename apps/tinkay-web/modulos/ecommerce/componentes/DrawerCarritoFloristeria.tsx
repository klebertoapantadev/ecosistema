'use client';

import React, { useState } from 'react';
import { SelectorUbicacionEntrega } from '@eco/comercio';
import { useCarrito } from '../contexto-carrito';
import { FRASES_DEDICATORIAS, PRODUCTOS_TINKAY } from '../datos-catalogo';
import { DatosEntrega, FranjaHoraria } from '../tipos';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  MapPin,
  Clock,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Gift,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export function DrawerCarritoFloristeria() {
  const {
    items,
    cantidadTotal,
    drawerAbierto,
    setDrawerAbierto,
    eliminarItem,
    actualizarCantidad,
    actualizarDedicatoria,
    actualizarEntregaIndividual,
    actualizarEntregaUnificada,
    modalidadEntrega,
    setModalidadEntrega,
    entregaUnificada,
    configLogistica,
    subtotalBaseImponible,
    totalIva,
    totalFlete,
    totalRecargoHorarioExacto,
    totalPagar,
    setCheckoutAbierto,
    agregarItem,
    productos,
  } = useCarrito();

  // Estados locales para edición de dedicatoria por ítem
  const [itemEditandoDedicatoria, setItemEditandoDedicatoria] = useState<string | null>(null);
  const [itemEditandoEntrega, setItemEditandoEntrega] = useState<string | null>(null);
  const [avisoValidacionEntrega, setAvisoValidacionEntrega] = useState<string | null>(null);

  if (!drawerAbierto) return null;

  const itemsPrincipales = items.filter((it) => !it.producto.esComplemento && !it.producto.esExtra);
  const listaBase = itemsPrincipales.length > 0 ? itemsPrincipales : items;

  const todosSonRenta =
    listaBase.length > 0 &&
    listaBase.every(
      (it) =>
        it.producto.esRenta === true ||
        it.producto.tipoOferta?.toUpperCase().includes('RENTA') ||
        it.producto.tipoOferta?.toUpperCase().includes('ALQUILER') ||
        (it.producto.etiquetas || []).some(
          (e: string) => e.toLowerCase().includes('renta') || e.toLowerCase().includes('alquiler')
        )
    );

  const catalogoProds = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;

  const productosComplementos = todosSonRenta
    ? catalogoProds.filter((p) => {
        if (p.esExtra || p.esComplemento) return false;
        const catPrincipal = (p.categoriaPrincipal || '').toLowerCase();
        const catNombre = (p.categoriaNombre || '').toLowerCase();
        if (catPrincipal.includes('extra') || catNombre.includes('extra')) return false;

        const esRentaItem = Boolean(
          p.esRenta === true ||
          p.tipoOferta?.toUpperCase().includes('RENTA') ||
          p.tipoOferta?.toUpperCase().includes('ALQUILER') ||
          (p.etiquetas || []).some(
            (e: string) => e.toLowerCase().includes('renta') || e.toLowerCase().includes('alquiler')
          )
        );
        if (!esRentaItem) return false;

        return !items.some(
          (it) => it.producto.id === p.id || (p.proIdUuid && it.producto.proIdUuid === p.proIdUuid)
        );
      })
    : catalogoProds.filter((p) => {
        const esRentaItem = Boolean(
          p.esRenta === true ||
          p.tipoOferta?.toUpperCase().includes('RENTA') ||
          p.tipoOferta?.toUpperCase().includes('ALQUILER')
        );
        if (esRentaItem) return false;
        return p.esComplemento;
      });
  const algunoNoIncluye = listaBase.some(
    (it) => it.producto.deliveryIncluido === false && it.producto.modalidadTransporte !== 'SOLO_RETIRO'
  );
  const algunoSoloRetiro = listaBase.some((it) => it.producto.modalidadTransporte === 'SOLO_RETIRO');
  const recargoEspecialTotal = listaBase.reduce(
    (acc, it) => acc + (it.producto.recargoLogisticoUsd || 0) * it.cantidad,
    0
  );
  const tarifaHoraExacta = configLogistica.recargoHoraExacta ?? 10;

  const handleIrAlPago = () => {
    setAvisoValidacionEntrega(null);

    if (modalidadEntrega === 'unificada') {
      if (!entregaUnificada.retiroEnLocal) {
        if (entregaUnificada.dentroCobertura === false) {
          setAvisoValidacionEntrega(
            `El punto seleccionado supera el radio automático de ${configLogistica.radioMaximoKm} km. Elige «Retiro gratis» o escríbenos en el chat para coordinar envío especial.`
          );
          return;
        }
        if (typeof entregaUnificada.costoEnvioCalculado !== 'number') {
          setAvisoValidacionEntrega(
            'Verifica la ubicación de entrega pegando un link de Google Maps / Apple / Waze o usando «Buscar en Mapa» (o selecciona «Retiro gratis»).'
          );
          return;
        }
      }
    } else {
      for (const it of listaBase) {
        const ent = it.entregaIndividual;
        if (!ent?.retiroEnLocal) {
          if (ent?.dentroCobertura === false) {
            setItemEditandoEntrega(it.id);
            setAvisoValidacionEntrega(
              `El destino de «${it.producto.nombre}» está fuera de la cobertura automática. Ajusta su ubicación o elige retiro en tienda.`
            );
            return;
          }
          if (typeof ent?.costoEnvioCalculado !== 'number') {
            setItemEditandoEntrega(it.id);
            setAvisoValidacionEntrega(
              `Confirma en el mapa o con enlace GPS el destino individual de «${it.producto.nombre}» para calcular su envío.`
            );
            return;
          }
        }
      }
    }

    setDrawerAbierto(false);
    setCheckoutAbierto(true);
  };

  return (
    <div className="drawer-backdrop-carrito" onClick={() => setDrawerAbierto(false)}>
      <div
        className="drawer-panel-carrito"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Carrito de compras"
      >
        {/* Cabecera del Drawer */}
        <div className="cabecera-drawer-carrito">
          <div className="titulo-con-icono-drawer">
            <ShoppingBag size={22} className="icono-dorado" />
            <h3>Tu Carrito Floral</h3>
            <span className="badge-contador-drawer">{cantidadTotal}</span>
          </div>
          <button
            type="button"
            className="btn-cerrar-drawer"
            onClick={() => setDrawerAbierto(false)}
            aria-label="Cerrar carrito"
          >
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cuerpo-carrito-vacio">
            <div className="icono-vacio-circulo">
              <Gift size={36} />
            </div>
            <h4>Tu carrito está vacío</h4>
            <p>Aún no has agregado arreglos florales o complementos.</p>
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => setDrawerAbierto(false)}
            >
              Explorar Catálogo
            </button>
          </div>
        ) : (
          <div className="cuerpo-scroll-carrito">
            {/* Lista de Ítems */}
            <div className="lista-items-carrito">
              {items.map((item) => {
                const tieneDedicatoria =
                  item.dedicatoria &&
                  (item.dedicatoria.para || item.dedicatoria.mensaje);
                const expandidoDedicatoria = itemEditandoDedicatoria === item.id;
                const expandidoEntrega = itemEditandoEntrega === item.id;

                return (
                  <div key={item.id} className="tarjeta-item-carrito">
                    <div className="fila-principal-item">
                      <img
                        src={item.producto.fotos[0] || '/img/slide4_flores_amor.jpg'}
                        alt={item.producto.nombre}
                        className="miniatura-item-carrito"
                      />

                      <div className="datos-principales-item">
                        <div className="titulos-item-carrito">
                          <strong>{item.producto.nombre}</strong>
                          {item.producto.esRenta && (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: '#FFFBEB',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                                padding: '1px 7px',
                                borderRadius: '999px',
                                marginTop: '2px',
                                alignSelf: 'flex-start',
                              }}
                            >
                              🪑 En renta ({item.producto.rentaConfig?.periodo || 'Por evento'})
                            </span>
                          )}
                          {item.variante.nombre && item.variante.nombre.trim() !== item.producto.nombre.trim() && (
                            <span className="variante-nombre-item">
                              {item.variante.nombre}
                            </span>
                          )}
                        </div>

                        <div className="precio-y-cantidad-fila">
                          <div className="control-cantidad-pills">
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                              aria-label="Disminuir cantidad"
                            >
                              <Minus size={14} />
                            </button>
                            <span>{item.cantidad}</span>
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                              aria-label="Aumentar cantidad"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="precio-linea-item" style={{ textAlign: 'right' }}>
                            <div>${(item.variante.pvp * item.cantidad).toFixed(2)}</div>
                            {(item.variante.pvpNominalSinVolumen ?? item.variante.pvp) >
                              item.variante.pvp && (
                              <div style={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                                <span
                                  style={{
                                    textDecoration: 'line-through',
                                    color: '#94A3B8',
                                    marginRight: '4px',
                                  }}
                                >
                                  ${((item.variante.pvpNominalSinVolumen ?? item.variante.pvp) * item.cantidad).toFixed(2)}
                                </span>
                                <span style={{ color: '#059669', fontWeight: 700 }}>
                                  (${item.variante.pvp.toFixed(2)} c/u)
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn-eliminar-linea"
                            onClick={() => eliminarItem(item.id)}
                            title="Eliminar este arreglo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Módulo Individual: Tarjeta de Dedicatoria */}
                    {!item.producto.esComplemento && (
                      <div className="seccion-individual-dedicatoria">
                        <button
                          type="button"
                          className="btn-toggle-acordeon"
                          onClick={() =>
                            setItemEditandoDedicatoria(
                              expandidoDedicatoria ? null : item.id
                            )
                          }
                        >
                          <div className="texto-toggle-icono">
                            <FileText size={15} />
                            <span>
                              {tieneDedicatoria
                                ? `Tarjeta: "${item.dedicatoria?.para || 'Para alguien especial'}"`
                                : '+ Agregar Tarjeta de Dedicatoria Individual'}
                            </span>
                          </div>
                          {expandidoDedicatoria ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {expandidoDedicatoria && (
                          <div className="panel-edicion-dedicatoria-item">
                            <div className="campos-de-para-mini">
                              <input
                                type="text"
                                placeholder="Para:"
                                value={item.dedicatoria?.para || ''}
                                onChange={(e) =>
                                  actualizarDedicatoria(item.id, {
                                    ...(item.dedicatoria || { mensaje: '', de: '' }),
                                    para: e.target.value,
                                  })
                                }
                                className="input-mini"
                              />
                              <input
                                type="text"
                                placeholder="De:"
                                value={item.dedicatoria?.de || ''}
                                onChange={(e) =>
                                  actualizarDedicatoria(item.id, {
                                    ...(item.dedicatoria || { mensaje: '', para: '' }),
                                    de: e.target.value,
                                  })
                                }
                                className="input-mini"
                              />
                            </div>

                            <textarea
                              rows={2}
                              placeholder="Escribe el mensaje para este arreglo específico..."
                              value={item.dedicatoria?.mensaje || ''}
                              onChange={(e) =>
                                actualizarDedicatoria(item.id, {
                                  ...(item.dedicatoria || { para: '', de: '' }),
                                  mensaje: e.target.value,
                                })
                              }
                              className="textarea-mini"
                            />

                            <div className="frases-inspiracion-mini">
                              <span>Frases rápidas:</span>
                              {FRASES_DEDICATORIAS.amor?.[0] && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    actualizarDedicatoria(item.id, {
                                      ...(item.dedicatoria || { para: '', de: '' }),
                                      mensaje: FRASES_DEDICATORIAS.amor![0]!,
                                    })
                                  }
                                >
                                  Amor
                                </button>
                              )}
                              {FRASES_DEDICATORIAS.cumpleanos?.[0] && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    actualizarDedicatoria(item.id, {
                                      ...(item.dedicatoria || { para: '', de: '' }),
                                      mensaje: FRASES_DEDICATORIAS.cumpleanos![0]!,
                                    })
                                  }
                                >
                                  Cumple
                                </button>
                              )}
                              {FRASES_DEDICATORIAS.condolencias?.[0] && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    actualizarDedicatoria(item.id, {
                                      ...(item.dedicatoria || { para: '', de: '' }),
                                      mensaje: FRASES_DEDICATORIAS.condolencias![0]!,
                                    })
                                  }
                                >
                                  Pésame
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Módulo Individual: Logística por Arreglo (Multidestino) */}
                    {modalidadEntrega === 'individual' && !item.producto.esComplemento && (
                      <div className="seccion-individual-entrega">
                        <button
                          type="button"
                          className="btn-toggle-acordeon entrega-acordeon"
                          onClick={() =>
                            setItemEditandoEntrega(expandidoEntrega ? null : item.id)
                          }
                        >
                          <div className="texto-toggle-icono">
                            <MapPin size={15} />
                            <span>
                              {item.entregaIndividual?.retiroEnLocal
                                ? `Retiro en tienda (${item.entregaIndividual.fechaEntrega || ''})`
                                : typeof item.entregaIndividual?.costoEnvioCalculado === 'number'
                                ? `Destino: ${item.entregaIndividual.zonaDetectadaNombre || 'Ubicación verificada'} — ${
                                    item.entregaIndividual.costoEnvioCalculado === 0
                                      ? 'Envío Gratis'
                                      : `+$${item.entregaIndividual.costoEnvioCalculado.toFixed(2)}`
                                  }`
                                : item.entregaIndividual?.direccion
                                ? `Destino: ${item.entregaIndividual.destinatarioNombre || 'Sin nombre'} (${item.entregaIndividual.fechaEntrega})`
                                : 'Coordinar Destino y Mapa de este Arreglo'}
                            </span>
                          </div>
                          {expandidoEntrega ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {expandidoEntrega && (
                          <div className="formulario-entrega-individual-caja">
                            <div style={{ marginBottom: '10px' }}>
                              <SelectorUbicacionEntrega
                                negocio="tinkay"
                                configuracionInicial={configLogistica}
                                deliveryIncluidoProducto={item.producto.deliveryIncluido !== false}
                                recargoLogisticoProducto={
                                  (item.producto.recargoLogisticoUsd || 0) * item.cantidad
                                }
                                permitirModoRetiro={configLogistica.permitirRetiroLocal}
                                retiroEnLocal={Boolean(item.entregaIndividual?.retiroEnLocal)}
                                enlaceMapaInicial={item.entregaIndividual?.enlaceMapa || ''}
                                coordenadasIniciales={
                                  typeof item.entregaIndividual?.lat === 'number' &&
                                  typeof item.entregaIndividual?.lng === 'number'
                                    ? {
                                        lat: item.entregaIndividual.lat,
                                        lng: item.entregaIndividual.lng,
                                      }
                                    : null
                                }
                                onCambioCotizacion={(ev) => {
                                  setAvisoValidacionEntrega(null);
                                  const actual = item.entregaIndividual || ({} as DatosEntrega);
                                  const dirPreviaEraAuto =
                                    !actual.direccion ||
                                    actual.direccion === actual.detalleDireccionGeo?.resumenDireccion ||
                                    actual.direccion.startsWith('Retiro en ');
                                  actualizarEntregaIndividual(item.id, {
                                    ...actual,
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
                                      actual.ciudad ||
                                      configLogistica.zonaGratisNombre,
                                    direccion:
                                      ev.retiroEnLocal
                                        ? `Retiro en ${configLogistica.origenNombre}`
                                        : dirPreviaEraAuto && ev.direccionSugerida
                                        ? ev.direccionSugerida
                                        : actual.direccion || ev.direccionSugerida || '',
                                  });
                                }}
                              />
                            </div>

                            <input
                              type="text"
                              placeholder={
                                item.entregaIndividual?.retiroEnLocal
                                  ? 'Nombre de quien retira en tienda'
                                  : 'Nombre de quien recibe este arreglo'
                              }
                              value={item.entregaIndividual?.destinatarioNombre || ''}
                              onChange={(e) =>
                                actualizarEntregaIndividual(item.id, {
                                  ...(item.entregaIndividual || ({} as DatosEntrega)),
                                  destinatarioNombre: e.target.value,
                                })
                              }
                              className="input-mini"
                            />

                            <input
                              type="tel"
                              placeholder="Teléfono móvil de contacto"
                              value={item.entregaIndividual?.destinatarioTelefono || ''}
                              onChange={(e) =>
                                actualizarEntregaIndividual(item.id, {
                                  ...(item.entregaIndividual || ({} as DatosEntrega)),
                                  destinatarioTelefono: e.target.value,
                                })
                              }
                              className="input-mini"
                            />

                            {!item.entregaIndividual?.retiroEnLocal && (
                              <input
                                type="text"
                                placeholder="Detalle de dirección / edificio / departamento"
                                value={item.entregaIndividual?.direccion || ''}
                                onChange={(e) =>
                                  actualizarEntregaIndividual(item.id, {
                                    ...(item.entregaIndividual || ({} as DatosEntrega)),
                                    direccion: e.target.value,
                                  })
                                }
                                className="input-mini"
                              />
                            )}

                            <div className="fila-fecha-franja-mini">
                              <label className="label-campo-mini">
                                Fecha:
                                <input
                                  type="date"
                                  value={item.entregaIndividual?.fechaEntrega || ''}
                                  onChange={(e) =>
                                    actualizarEntregaIndividual(item.id, {
                                      ...(item.entregaIndividual || ({} as DatosEntrega)),
                                      fechaEntrega: e.target.value,
                                    })
                                  }
                                  className="input-mini"
                                />
                              </label>

                              <label className="label-campo-mini">
                                Horario:
                                <select
                                  value={item.entregaIndividual?.franjaHoraria || 'manana'}
                                  onChange={(e) =>
                                    actualizarEntregaIndividual(item.id, {
                                      ...(item.entregaIndividual || ({} as DatosEntrega)),
                                      franjaHoraria: e.target.value as FranjaHoraria,
                                    })
                                  }
                                  className="select-mini"
                                >
                                  <option value="manana">Mañana (09:00 - 13:00)</option>
                                  <option value="tarde">Tarde (14:00 - 18:00)</option>
                                  {!item.entregaIndividual?.retiroEnLocal && (
                                    <option value="hora_exacta">
                                      Hora Exacta (+ ${tarifaHoraExacta.toFixed(2)})
                                    </option>
                                  )}
                                </select>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selector de Modalidad de Entrega (Unificada vs Multidestino) */}
            {items.length > 1 && (
              <div className="bloque-modo-entrega">
                <div className="etiqueta-bloque-logistica">
                  <MapPin size={16} />
                  <strong>Modalidad de Entrega de tus Arreglos:</strong>
                </div>

                <div className="pills-modalidad-entrega">
                  <button
                    type="button"
                    className={`pill-modalidad ${modalidadEntrega === 'unificada' ? 'activa' : ''}`}
                    onClick={() => setModalidadEntrega('unificada')}
                  >
                    <span>Todos a la misma dirección</span>
                    <small>
                      {entregaUnificada.retiroEnLocal
                        ? 'Retiro gratis en taller'
                        : totalFlete === 0
                        ? `Gratis en ${configLogistica.zonaGratisNombre}`
                        : `1 solo envío ($${totalFlete.toFixed(2)})`}
                    </small>
                  </button>
                  <button
                    type="button"
                    className={`pill-modalidad ${modalidadEntrega === 'individual' ? 'activa' : ''}`}
                    onClick={() => setModalidadEntrega('individual')}
                  >
                    <span>Cada arreglo a dirección diferente</span>
                    <small>Multidestino personalizado</small>
                  </button>
                </div>
              </div>
            )}

            {/* Formulario de Entrega Unificada (cuando aplica) */}
            {modalidadEntrega === 'unificada' && (
              <div className="caja-formulario-entrega-unificada">
                <div className="cabecera-caja-entrega">
                  <Calendar size={16} />
                  <strong>Ubicación y Coordinación de Entrega (Pichincha)</strong>
                </div>

                <div style={{ padding: '0 14px 12px' }}>
                  <SelectorUbicacionEntrega
                    negocio="tinkay"
                    configuracionInicial={configLogistica}
                    deliveryIncluidoProducto={!algunoNoIncluye}
                    recargoLogisticoProducto={recargoEspecialTotal}
                    permitirModoRetiro={configLogistica.permitirRetiroLocal}
                    retiroEnLocal={Boolean(entregaUnificada.retiroEnLocal || algunoSoloRetiro)}
                    enlaceMapaInicial={entregaUnificada.enlaceMapa || ''}
                    coordenadasIniciales={
                      typeof entregaUnificada.lat === 'number' &&
                      typeof entregaUnificada.lng === 'number'
                        ? { lat: entregaUnificada.lat, lng: entregaUnificada.lng }
                        : null
                    }
                    onCambioCotizacion={(ev) => {
                      setAvisoValidacionEntrega(null);
                      const dirPreviaEraAuto =
                        !entregaUnificada.direccion ||
                        entregaUnificada.direccion ===
                          entregaUnificada.detalleDireccionGeo?.resumenDireccion ||
                        entregaUnificada.direccion.startsWith('Retiro en ');
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
                        ...(ev.retiroEnLocal
                          ? {
                              direccion: `Retiro en ${configLogistica.origenNombre}`,
                              franjaHoraria:
                                entregaUnificada.franjaHoraria === 'hora_exacta'
                                  ? 'manana'
                                  : entregaUnificada.franjaHoraria,
                            }
                          : dirPreviaEraAuto && ev.direccionSugerida
                          ? { direccion: ev.direccionSugerida }
                          : {}),
                      });
                    }}
                  />
                </div>

                <div className="grid-campos-entrega-unificada">
                  <input
                    type="text"
                    placeholder={
                      entregaUnificada.retiroEnLocal
                        ? 'Nombre completo de quien retira en tienda'
                        : 'Nombre completo de quien recibe'
                    }
                    value={entregaUnificada.destinatarioNombre}
                    onChange={(e) =>
                      actualizarEntregaUnificada({ destinatarioNombre: e.target.value })
                    }
                    className="input-entrega"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono móvil para coordinación"
                    value={entregaUnificada.destinatarioTelefono}
                    onChange={(e) =>
                      actualizarEntregaUnificada({ destinatarioTelefono: e.target.value })
                    }
                    className="input-entrega"
                  />

                  {!entregaUnificada.retiroEnLocal && (
                    <>
                      <input
                        type="text"
                        placeholder="Complemento de dirección (ej. Edif. Ámbar dpto 4B, número de casa)"
                        value={entregaUnificada.direccion}
                        onChange={(e) =>
                          actualizarEntregaUnificada({ direccion: e.target.value })
                        }
                        className="input-entrega input-col-2"
                      />
                      <input
                        type="text"
                        placeholder="Referencia de llegada (ej. Frente a la farmacia, dejar en conserjería)"
                        value={entregaUnificada.referencia}
                        onChange={(e) =>
                          actualizarEntregaUnificada({ referencia: e.target.value })
                        }
                        className="input-entrega input-col-2"
                      />
                    </>
                  )}

                  <div className="campo-fecha-entrega">
                    <label>
                      {entregaUnificada.retiroEnLocal ? 'Fecha de Retiro:' : 'Fecha de Entrega:'}
                    </label>
                    <input
                      type="date"
                      value={entregaUnificada.fechaEntrega}
                      onChange={(e) =>
                        actualizarEntregaUnificada({ fechaEntrega: e.target.value })
                      }
                      className="input-entrega"
                    />
                  </div>

                  <div className="campo-franja-horaria">
                    <label>Franja Horaria:</label>
                    <select
                      value={entregaUnificada.franjaHoraria}
                      onChange={(e) =>
                        actualizarEntregaUnificada({
                          franjaHoraria: e.target.value as FranjaHoraria,
                        })
                      }
                      className="select-entrega"
                    >
                      <option value="manana">Mañana (09:00 - 13:00) — Sin costo</option>
                      <option value="tarde">Tarde (14:00 - 18:00) — Sin costo</option>
                      {!entregaUnificada.retiroEnLocal && (
                        <option value="hora_exacta">
                          Hora Exacta / Madrugador (+ ${tarifaHoraExacta.toFixed(2)})
                        </option>
                      )}
                    </select>
                  </div>

                  {!entregaUnificada.retiroEnLocal &&
                    entregaUnificada.franjaHoraria === 'hora_exacta' && (
                      <div className="campo-hora-exacta-aviso input-col-2">
                        <Clock size={16} />
                        <label>Hora exacta requerida:</label>
                        <input
                          type="time"
                          value={entregaUnificada.horaExacta || '07:30'}
                          onChange={(e) =>
                            actualizarEntregaUnificada({ horaExacta: e.target.value })
                          }
                          className="input-entrega input-hora"
                        />
                        <small>🚨 Asignaremos ruta exclusiva y prioridad en taller.</small>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Sugerencias de Cross-Selling Rápido en Carrito */}
            {productosComplementos.length > 0 && (
              <div className="cross-sell-carrusel-carrito">
                <span className="etiqueta-cross-sell">
                  {todosSonRenta
                    ? '¿Deseas agregar más mobiliario o artículos en renta?'
                    : '¿Te gustaría añadir un toque extra?'}
                </span>
                <div className="fila-cross-sell-chips">
                  {productosComplementos.map((comp) => {
                    const varComp = comp.variantes[0];
                    if (!varComp) return null;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        className="btn-chip-cross-sell"
                        onClick={() => agregarItem(comp, varComp)}
                        title={todosSonRenta ? `Agregar en renta: ${comp.nombre}` : `Añadir: ${comp.nombre}`}
                      >
                        <Plus size={13} />
                        <span>
                          {comp.nombre.replace('Caja de Chocolates ', '')} (+${varComp.pvp.toFixed(2)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pie del Carrito con Resumen y Checkout */}
        {items.length > 0 && (
          <div className="pie-drawer-carrito">
            <div className="desglose-totales-caja">
              <div className="fila-desglose">
                <span>Subtotal (Base Imponible)</span>
                <span>${subtotalBaseImponible.toFixed(2)}</span>
              </div>
              <div className="fila-desglose">
                <span>{totalIva > 0 ? 'IVA 15% (SRI Ecuador)' : 'IVA 0% (Flores de Exportación)'}</span>
                <span>${totalIva.toFixed(2)}</span>
              </div>
              <div className="fila-desglose">
                <span>
                  {modalidadEntrega === 'individual'
                    ? `Envío Multidestino (${listaBase.length} destinos)`
                    : entregaUnificada.retiroEnLocal
                    ? `Retiro en ${configLogistica.origenNombre}`
                    : entregaUnificada.zonaDetectadaNombre
                    ? `Envío (${entregaUnificada.zonaDetectadaNombre}${
                        configLogistica.mostrarKilometrosCliente !== false &&
                        typeof entregaUnificada.distanciaVialKm === 'number'
                          ? ` · ${entregaUnificada.distanciaVialKm.toFixed(1)} km`
                          : ''
                      })`
                    : typeof entregaUnificada.distanciaVialKm === 'number'
                    ? configLogistica.mostrarKilometrosCliente !== false
                      ? `Envío a domicilio (${entregaUnificada.distanciaVialKm.toFixed(1)} km)`
                      : 'Envío a domicilio'
                    : `Envío (${configLogistica.zonaGratisNombre})`}
                </span>
                <span
                  style={{
                    fontWeight: totalFlete === 0 ? 700 : 500,
                    color: totalFlete === 0 ? 'var(--verde)' : 'inherit',
                  }}
                >
                  {modalidadEntrega === 'unificada' && entregaUnificada.retiroEnLocal
                    ? 'GRATIS ($0.00)'
                    : typeof entregaUnificada.costoEnvioCalculado === 'number' && totalFlete === 0
                    ? 'GRATIS ($0.00)'
                    : `$${totalFlete.toFixed(2)}`}
                </span>
              </div>
              {totalRecargoHorarioExacto > 0 && (
                <div className="fila-desglose recargo-fila">
                  <span>Recargo Horario Exacto Programado</span>
                  <span>+${totalRecargoHorarioExacto.toFixed(2)}</span>
                </div>
              )}
              <div className="fila-total-definitivo">
                <strong>Total a Pagar</strong>
                <strong>${totalPagar.toFixed(2)}</strong>
              </div>
            </div>

            {avisoValidacionEntrega && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  marginBottom: '10px',
                  borderRadius: '10px',
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  color: '#92400E',
                  fontSize: '0.78rem',
                  lineHeight: 1.4,
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{avisoValidacionEntrega}</span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primario btn-proceder-pago"
              onClick={handleIrAlPago}
              title="Proceder al pago seguro en línea"
              aria-label="Proceder al pago seguro en línea"
            >
              <CreditCard size={18} />
              <span>Ir a Pagar</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
