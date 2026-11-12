'use client';

import React, { useState } from 'react';
import { registrarPedidoTiendaAction } from '@eco/comercio';
import { useCarrito } from '../contexto-carrito';
import {
  X,
  CreditCard,
  Building2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export function ModalCheckoutTinkay() {
  const {
    checkoutAbierto,
    setCheckoutAbierto,
    items,
    subtotalBaseImponible,
    totalIva,
    totalFlete,
    totalRecargoHorarioExacto,
    totalPagar,
    modalidadEntrega,
    entregaUnificada,
    configLogistica,
    vaciarCarrito,
  } = useCarrito();

  const [metodoPago, setMetodoPago] = useState<'payphone' | 'transferencia'>('payphone');
  const [paso, setPaso] = useState<'formulario' | 'procesando' | 'exito'>('formulario');
  const [codigoOrdenGenerado, setCodigoOrdenGenerado] = useState<string>('');
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [resumenExito, setResumenExito] = useState<{
    totalPagado: number;
    entregaTexto: string;
  } | null>(null);

  // Datos de Facturación SRI
  const [datosFactura, setDatosFactura] = useState({
    nombreCompleto: '',
    identificacion: '',
    correo: '',
    telefono: '',
  });

  // Datos Tarjeta Simulada Payphone
  const [datosTarjeta, setDatosTarjeta] = useState({
    numero: '4111 2222 3333 4444',
    titular: '',
    expiracion: '12/28',
    cvv: '123',
    diferido: '0',
  });

  if (!checkoutAbierto) return null;

  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPago(null);
    setPaso('procesando');

    const entregaTextoConfirmado =
      modalidadEntrega === 'unificada'
        ? entregaUnificada.retiroEnLocal
          ? `Retiro en ${configLogistica.origenNombre} (${entregaUnificada.fechaEntrega})`
          : `${entregaUnificada.zonaDetectadaNombre || entregaUnificada.ciudad || 'Domicilio'}${
              configLogistica.mostrarKilometrosCliente !== false &&
              typeof entregaUnificada.distanciaVialKm === 'number'
                ? ` (${entregaUnificada.distanciaVialKm.toFixed(1)} km)`
                : ''
            } — ${entregaUnificada.fechaEntrega} (${entregaUnificada.franjaHoraria})`
        : 'Multidestino individual';

    const resultado = await registrarPedidoTiendaAction({
      negocio: 'tinkay',
      metodoPago,
      comprador: {
        nombreCompleto: datosFactura.nombreCompleto,
        identificacion: datosFactura.identificacion,
        correo: datosFactura.correo,
        telefono: datosFactura.telefono,
      },
      modalidadEntrega,
      entregaUnificada:
        modalidadEntrega === 'unificada'
          ? {
              retiroEnLocal: entregaUnificada.retiroEnLocal,
              destinatarioNombre: entregaUnificada.destinatarioNombre || datosFactura.nombreCompleto,
              destinatarioTelefono: entregaUnificada.destinatarioTelefono || datosFactura.telefono,
              direccion: entregaUnificada.direccion,
              referencia: entregaUnificada.referencia,
              ciudad: entregaUnificada.ciudad,
              fechaEntrega: entregaUnificada.fechaEntrega,
              franjaHoraria: entregaUnificada.franjaHoraria,
              horaExacta: entregaUnificada.horaExacta,
              enlaceMapa: entregaUnificada.enlaceMapa,
              lat: entregaUnificada.lat,
              lng: entregaUnificada.lng,
              zonaDetectadaNombre: entregaUnificada.zonaDetectadaNombre,
              reglaLogisticaAplicada: entregaUnificada.reglaLogisticaAplicada,
              distanciaVialKm: entregaUnificada.distanciaVialKm,
              costoEnvioCalculado: totalFlete,
              etiquetaCotizacion: entregaUnificada.etiquetaCotizacion,
              formulaCalculoInterno: entregaUnificada.formulaCalculoInterno,
            }
          : undefined,
      items: items.map((it) => ({
        productoId: it.producto.id,
        productoNombre: it.producto.nombre,
        varianteSku: it.variante.sku,
        varianteNombre: it.variante.nombre,
        cantidad: it.cantidad,
        pvpUnitario: it.variante.pvp,
        tarifaIva: it.variante.tarifaIva,
        deliveryIncluidoProducto: it.producto.deliveryIncluido !== false,
        recargoLogisticoUsd: it.producto.recargoLogisticoUsd || 0,
        dedicatoria: it.dedicatoria
          ? {
              para: it.dedicatoria.para,
              de: it.dedicatoria.de,
              mensaje: it.dedicatoria.mensaje,
            }
          : undefined,
        entregaIndividual: it.entregaIndividual
          ? {
              retiroEnLocal: it.entregaIndividual.retiroEnLocal,
              destinatarioNombre: it.entregaIndividual.destinatarioNombre,
              destinatarioTelefono: it.entregaIndividual.destinatarioTelefono,
              direccion: it.entregaIndividual.direccion,
              referencia: it.entregaIndividual.referencia,
              ciudad: it.entregaIndividual.ciudad,
              fechaEntrega: it.entregaIndividual.fechaEntrega,
              franjaHoraria: it.entregaIndividual.franjaHoraria,
              horaExacta: it.entregaIndividual.horaExacta,
              enlaceMapa: it.entregaIndividual.enlaceMapa,
              lat: it.entregaIndividual.lat,
              lng: it.entregaIndividual.lng,
              zonaDetectadaNombre: it.entregaIndividual.zonaDetectadaNombre,
              reglaLogisticaAplicada: it.entregaIndividual.reglaLogisticaAplicada,
              distanciaVialKm: it.entregaIndividual.distanciaVialKm,
              costoEnvioCalculado: it.entregaIndividual.costoEnvioCalculado,
              etiquetaCotizacion: it.entregaIndividual.etiquetaCotizacion,
              formulaCalculoInterno: it.entregaIndividual.formulaCalculoInterno,
            }
          : undefined,
      })),
      subtotalBaseImponible,
      totalIva,
      totalFlete,
      totalRecargoHorarioExacto,
      totalPagar,
    });

    if (!resultado.ok) {
      setErrorPago(resultado.error);
      setPaso('formulario');
      return;
    }

    setResumenExito({
      totalPagado: totalPagar,
      entregaTexto: entregaTextoConfirmado,
    });
    setCodigoOrdenGenerado(resultado.codigoOrden);
    setPaso('exito');
    vaciarCarrito();
  };

  const handleCerrar = () => {
    setCheckoutAbierto(false);
    setPaso('formulario');
    setErrorPago(null);
  };

  return (
    <div className="modal-backdrop-ecommerce" onClick={handleCerrar}>
      <div
        className="modal-contenido-checkout"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="btn-cerrar-modal"
          onClick={handleCerrar}
          aria-label="Cerrar checkout"
        >
          <X size={20} />
        </button>

        {paso === 'procesando' && (
          <div className="pantalla-procesando-pago">
            <div className="spinner-botanico" />
            <h3>Procesando transacción segura...</h3>
            <p>Conectando con la pasarela oficial Payphone para Tinkay Floristería.</p>
          </div>
        )}

        {paso === 'exito' && (
          <div className="pantalla-exito-pago">
            <div className="circulo-icono-exito">
              <CheckCircle2 size={54} />
            </div>
            <span className="badge-exito">¡Pago Confirmado con Éxito!</span>
            <h2>Gracias por tu compra en Tinkay</h2>
            <p className="codigo-orden-destacado">
              Orden de Taller: <strong>{codigoOrdenGenerado}</strong>
            </p>
            <p className="instrucciones-exito">
              Hemos registrado tu pedido y enviado la factura electrónica a{' '}
              <strong>{datosFactura.correo || 'tu correo'}</strong>. Nuestras maestras floristas han
              iniciado la selección de flores frescas para el armado de tu arreglo.
            </p>

            <div className="tarjeta-resumen-confirmacion">
              <div className="fila-resumen-c">
                <span>Total pagado:</span>
                <strong>${(resumenExito?.totalPagado ?? totalPagar).toFixed(2)} USD</strong>
              </div>
              <div className="fila-resumen-c">
                <span>Entrega:</span>
                <span>{resumenExito?.entregaTexto || 'Registrada'}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primario btn-terminar-pedido"
              onClick={handleCerrar}
            >
              Volver a la Floristería
            </button>
          </div>
        )}

        {paso === 'formulario' && (
          <div className="grid-checkout-pasos">
            {/* Columna Izquierda: Métodos de Pago y Datos SRI */}
            <div className="columna-formulario-pago">
              <div className="cabecera-checkout">
                <h2>Caja de Pago Seguro</h2>
                <div className="sello-seguridad">
                  <ShieldCheck size={16} />
                  <span>Transacción 256-bit SSL</span>
                </div>
              </div>

              {/* Selector de Método de Pago */}
              <div className="pills-metodos-pago">
                <button
                  type="button"
                  className={`btn-metodo-pago ${metodoPago === 'payphone' ? 'activo' : ''}`}
                  onClick={() => setMetodoPago('payphone')}
                >
                  <CreditCard size={18} />
                  <div>
                    <strong>Payphone</strong>
                    <small>Tarjetas Visa / Mastercard / Saldo</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`btn-metodo-pago ${metodoPago === 'transferencia' ? 'activo' : ''}`}
                  onClick={() => setMetodoPago('transferencia')}
                >
                  <Building2 size={18} />
                  <div>
                    <strong>Transferencia Bancaria</strong>
                    <small>Pichincha / Produbanco</small>
                  </div>
                </button>
              </div>

              <form onSubmit={handlePagar} className="form-checkout-flujo">
                {/* Datos de Factura SRI */}
                <div className="grupo-campos-checkout">
                  <label className="titulo-seccion-form">
                    1. Datos de Facturación SRI &amp; Recibo
                  </label>
                  <div className="grid-dos-columnas">
                    <input
                      type="text"
                      placeholder="Nombre o Razón Social"
                      required
                      value={datosFactura.nombreCompleto}
                      onChange={(e) =>
                        setDatosFactura({ ...datosFactura, nombreCompleto: e.target.value })
                      }
                      className="input-checkout"
                    />
                    <input
                      type="text"
                      placeholder="Cédula / RUC / Pasaporte"
                      required
                      value={datosFactura.identificacion}
                      onChange={(e) =>
                        setDatosFactura({ ...datosFactura, identificacion: e.target.value })
                      }
                      className="input-checkout"
                    />
                    <input
                      type="email"
                      placeholder="Correo electrónico para factura"
                      required
                      value={datosFactura.correo}
                      onChange={(e) =>
                        setDatosFactura({ ...datosFactura, correo: e.target.value })
                      }
                      className="input-checkout"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp de contacto del comprador"
                      required
                      value={datosFactura.telefono}
                      onChange={(e) =>
                        setDatosFactura({ ...datosFactura, telefono: e.target.value })
                      }
                      className="input-checkout"
                    />
                  </div>
                </div>

                {/* Formulario según Método */}
                {metodoPago === 'payphone' ? (
                  <div className="grupo-campos-checkout payphone-box">
                    <label className="titulo-seccion-form">
                      2. Datos de Tarjeta de Crédito o Débito
                    </label>

                    <div className="tarjeta-visual-simulada">
                      <div className="chip-tarjeta-simulado" />
                      <div className="numero-tarjeta-visual">
                        {datosTarjeta.numero || '•••• •••• •••• ••••'}
                      </div>
                      <div className="pie-tarjeta-visual">
                        <span>{datosFactura.nombreCompleto || 'TITULAR DE LA TARJETA'}</span>
                        <span>{datosTarjeta.expiracion}</span>
                      </div>
                    </div>

                    <div className="grid-dos-columnas">
                      <input
                        type="text"
                        placeholder="Número de tarjeta (16 dígitos)"
                        required
                        value={datosTarjeta.numero}
                        onChange={(e) =>
                          setDatosTarjeta({ ...datosTarjeta, numero: e.target.value })
                        }
                        className="input-checkout input-col-2"
                      />
                      <input
                        type="text"
                        placeholder="MM/AA"
                        required
                        value={datosTarjeta.expiracion}
                        onChange={(e) =>
                          setDatosTarjeta({ ...datosTarjeta, expiracion: e.target.value })
                        }
                        className="input-checkout"
                      />
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="CVV"
                        required
                        value={datosTarjeta.cvv}
                        onChange={(e) =>
                          setDatosTarjeta({ ...datosTarjeta, cvv: e.target.value })
                        }
                        className="input-checkout"
                      />

                      <div className="selector-diferido-caja input-col-2">
                        <label>Plazo de pago / Diferido:</label>
                        <select
                          value={datosTarjeta.diferido}
                          onChange={(e) =>
                            setDatosTarjeta({ ...datosTarjeta, diferido: e.target.value })
                          }
                          className="input-checkout"
                        >
                          <option value="0">Corriente / Débito (1 pago)</option>
                          <option value="3">3 Meses sin intereses</option>
                          <option value="6">6 Meses sin intereses</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grupo-campos-checkout transferencia-box">
                    <label className="titulo-seccion-form">
                      2. Cuentas Bancarias Oficiales de Tinkay
                    </label>
                    <div className="caja-datos-banco">
                      <p>
                        <strong>Banco Pichincha — Cuenta Corriente:</strong>
                        <br />
                        N° 2100234567 — Tinkay Floristería Cía. Ltda.
                        <br />
                        RUC: 1792837465001 — pagos@tinkay.com
                      </p>
                    </div>
                    <div className="caja-datos-banco">
                      <p>
                        <strong>Banco Produbanco — Cuenta de Ahorros:</strong>
                        <br />
                        N° 12005678901 — Tinkay Floristería Cía. Ltda.
                      </p>
                    </div>
                    <small className="aviso-transferencia">
                      Al presionar &quot;Confirmar Pedido&quot;, reservaremos tus flores y te enviaremos
                      el enlace de WhatsApp para subir tu comprobante de transferencia.
                    </small>
                  </div>
                )}

                {errorPago && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#B91C1C',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '0.82rem',
                      marginBottom: '10px',
                    }}
                  >
                    {errorPago}
                  </div>
                )}

                <button type="submit" className="btn btn-primario btn-confirmar-pago-grande">
                  <span>Confirmar Pedido (${totalPagar.toFixed(2)})</span>
                </button>
              </form>
            </div>

            {/* Columna Derecha: Resumen de Orden */}
            <div className="columna-resumen-lateral">
              <h3>Resumen de tu Pedido</h3>
              <div className="lista-mini-resumen-checkout">
                {items.map((it) => (
                  <div key={it.id} className="item-mini-resumen">
                    <img
                      src={it.producto.fotos[0]}
                      alt={it.producto.nombre}
                      className="foto-mini-resumen"
                    />
                    <div className="info-mini-resumen">
                      <strong>{it.producto.nombre}</strong>
                      <span>
                        {it.cantidad}x {it.variante.nombre}
                      </span>
                      {it.dedicatoria?.mensaje && (
                        <small className="mini-dedicatoria-preview">
                          💌 Tarjeta: &quot;{it.dedicatoria.mensaje.slice(0, 35)}...&quot;
                        </small>
                      )}
                    </div>
                    <span className="precio-mini-resumen">
                      ${(it.variante.pvp * it.cantidad).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(61, 90, 69, 0.06)',
                  border: '1px solid rgba(61, 90, 69, 0.16)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal + IVA:</span>
                  <span>${(subtotalBaseImponible + totalIva).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>
                    {modalidadEntrega === 'unificada' && entregaUnificada.retiroEnLocal
                      ? 'Retiro en tienda:'
                      : modalidadEntrega === 'unificada' && entregaUnificada.zonaDetectadaNombre
                      ? `Envío (${entregaUnificada.zonaDetectadaNombre}${
                          configLogistica.mostrarKilometrosCliente !== false &&
                          typeof entregaUnificada.distanciaVialKm === 'number'
                            ? ` · ${entregaUnificada.distanciaVialKm.toFixed(1)} km`
                            : ''
                        }):`
                      : modalidadEntrega === 'unificada' &&
                        configLogistica.mostrarKilometrosCliente !== false &&
                        typeof entregaUnificada.distanciaVialKm === 'number'
                      ? `Envío a domicilio (${entregaUnificada.distanciaVialKm.toFixed(1)} km):`
                      : 'Envío a domicilio:'}
                  </span>
                  <span style={{ color: totalFlete === 0 ? 'var(--verde)' : 'inherit' }}>
                    {totalFlete === 0 ? 'GRATIS ($0.00)' : `$${totalFlete.toFixed(2)}`}
                  </span>
                </div>
                {totalRecargoHorarioExacto > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Horario exacto:</span>
                    <span>+${totalRecargoHorarioExacto.toFixed(2)}</span>
                  </div>
                )}
                {modalidadEntrega === 'unificada' && entregaUnificada.enlaceMapa && (
                  <a
                    href={entregaUnificada.enlaceMapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginTop: '2px',
                      color: 'var(--verde)',
                      textDecoration: 'underline',
                      fontWeight: 600,
                    }}
                  >
                    📍 Ver ubicación GPS confirmada
                  </a>
                )}
              </div>

              <div className="total-destacado-caja">
                <span>Total a facturar:</span>
                <strong>${totalPagar.toFixed(2)} USD</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
