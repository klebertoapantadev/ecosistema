'use client';

import React, { useState } from 'react';
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
    totalPagar,
    modalidadEntrega,
    entregaUnificada,
    vaciarCarrito,
  } = useCarrito();

  const [metodoPago, setMetodoPago] = useState<'payphone' | 'transferencia'>('payphone');
  const [paso, setPaso] = useState<'formulario' | 'procesando' | 'exito'>('formulario');
  const [codigoOrdenGenerado, setCodigoOrdenGenerado] = useState<string>('');

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

  const handlePagar = (e: React.FormEvent) => {
    e.preventDefault();
    setPaso('procesando');

    setTimeout(() => {
      const numSecuencial = Math.floor(1000 + Math.random() * 9000);
      const codigo = `TNK-ORD-${numSecuencial}`;
      setCodigoOrdenGenerado(codigo);
      setPaso('exito');
      vaciarCarrito();
    }, 1800);
  };

  const handleCerrar = () => {
    setCheckoutAbierto(false);
    setPaso('formulario');
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
                <strong>${totalPagar.toFixed(2)} USD</strong>
              </div>
              <div className="fila-resumen-c">
                <span>Entrega:</span>
                <span>
                  {modalidadEntrega === 'unificada'
                    ? `${entregaUnificada.fechaEntrega} (${entregaUnificada.franjaHoraria})`
                    : 'Multidestino individual'}
                </span>
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

                <button type="submit" className="btn btn-primario btn-confirmar-pago-grande">
                  <span>Pagar ${totalPagar.toFixed(2)} USD Ahora</span>
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
