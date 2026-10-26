'use client';

import React, { useState } from 'react';
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
    subtotalBaseImponible,
    totalIva,
    totalFlete,
    totalRecargoHorarioExacto,
    totalPagar,
    setCheckoutAbierto,
    agregarItem,
  } = useCarrito();

  // Estados locales para edición de dedicatoria por ítem
  const [itemEditandoDedicatoria, setItemEditandoDedicatoria] = useState<string | null>(null);
  const [itemEditandoEntrega, setItemEditandoEntrega] = useState<string | null>(null);

  if (!drawerAbierto) return null;

  const productosComplementos = PRODUCTOS_TINKAY.filter((p) => p.esComplemento);

  const handleIrAlPago = () => {
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
                          <span className="variante-nombre-item">
                            {item.variante.nombre}
                          </span>
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

                          <div className="precio-linea-item">
                            ${(item.variante.pvp * item.cantidad).toFixed(2)}
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
                              {item.entregaIndividual?.direccion
                                ? `Destino: ${item.entregaIndividual.destinatarioNombre || 'Sin nombre'} (${item.entregaIndividual.fechaEntrega})`
                                : 'Coordinar Destino Individual de este Arreglo'}
                            </span>
                          </div>
                          {expandidoEntrega ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {expandidoEntrega && (
                          <div className="formulario-entrega-individual-caja">
                            <input
                              type="text"
                              placeholder="Nombre de quien recibe este arreglo"
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
                              placeholder="Teléfono móvil de quien recibe"
                              value={item.entregaIndividual?.destinatarioTelefono || ''}
                              onChange={(e) =>
                                actualizarEntregaIndividual(item.id, {
                                  ...(item.entregaIndividual || ({} as DatosEntrega)),
                                  destinatarioTelefono: e.target.value,
                                })
                              }
                              className="input-mini"
                            />

                            <input
                              type="text"
                              placeholder="Dirección exacta de entrega (Calle principal, número, intersección)"
                              value={item.entregaIndividual?.direccion || ''}
                              onChange={(e) =>
                                actualizarEntregaIndividual(item.id, {
                                  ...(item.entregaIndividual || ({} as DatosEntrega)),
                                  direccion: e.target.value,
                                })
                              }
                              className="input-mini"
                            />

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
                                  <option value="hora_exacta">Hora Exacta (+ $10.00)</option>
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
                    <small>1 solo flete ($3.00)</small>
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
                  <strong>Coordinación de Entrega en Quito / Valles</strong>
                </div>
                <div style={{ padding: '0 14px 10px', fontSize: '0.8rem', color: 'var(--verde)' }}>
                  <span>📍 ¿Prefieres retirar en persona? Visítanos en nuestra tienda física: </span>
                  <a
                    href="https://maps.app.goo.gl/D56gQohzuwha4sLf8"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'underline', fontWeight: 600, color: 'var(--verde)' }}
                  >
                    Ver en Maps
                  </a>
                </div>

                <div className="grid-campos-entrega-unificada">
                  <input
                    type="text"
                    placeholder="Nombre completo de quien recibe"
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
                  <input
                    type="text"
                    placeholder="Dirección exacta de entrega (ej. Av. González Suárez y Coruña, Edif. Ámbar dpto 4B)"
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

                  <div className="campo-fecha-entrega">
                    <label>Fecha de Entrega:</label>
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
                      <option value="hora_exacta">Hora Exacta / Madrugador (+ $10.00)</option>
                    </select>
                  </div>

                  {entregaUnificada.franjaHoraria === 'hora_exacta' && (
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
            <div className="cross-sell-carrusel-carrito">
              <span className="etiqueta-cross-sell">¿Te gustaría añadir un toque extra?</span>
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
                    >
                      <Plus size={13} />
                      <span>{comp.nombre.replace('Caja de Chocolates ', '')} (+${varComp.pvp.toFixed(2)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
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
                <span>IVA 15% (SRI Ecuador)</span>
                <span>${totalIva.toFixed(2)}</span>
              </div>
              <div className="fila-desglose">
                <span>Flete Delivery {modalidadEntrega === 'individual' ? `(${items.length} destinos)` : 'Quito/Cumbayá'}</span>
                <span>${totalFlete.toFixed(2)}</span>
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

            <button
              type="button"
              className="btn btn-primario btn-proceder-pago"
              onClick={handleIrAlPago}
            >
              <CreditCard size={18} />
              <span>Proceder al Pago en Línea</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
