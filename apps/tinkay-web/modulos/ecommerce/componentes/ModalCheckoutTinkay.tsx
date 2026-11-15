'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BotonPagoPlux,
  descargarArchivoFacturaRideSri,
  imprimirFacturaRideSri,
  obtenerEmisorDefectoPorNegocio,
  obtenerEmisorRideNegocioAction,
  obtenerEstadoRegaloPrimeraCompraAction,
  obtenerPasarelasCheckoutAction,
  registrarPedidoTiendaAction,
  type ConfiguracionEmisorSri,
  type EstadoRegaloPrimeraCompra,
  type FacturaElectronicaResumen,
  type PagoPluxConsultado,
} from '@eco/comercio';
import { useCarrito } from '../contexto-carrito';
import {
  X,
  CreditCard,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Download,
  Printer,
  FileText,
  Gift,
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

  const [metodoPago, setMetodoPago] = useState<'plux' | 'transferencia'>('plux');
  const [ambientePlux, setAmbientePlux] = useState<string>('PRUEBAS');
  const [paso, setPaso] = useState<'formulario' | 'procesando' | 'exito'>('formulario');
  const [codigoOrdenGenerado, setCodigoOrdenGenerado] = useState<string>('');
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [preparandoOrdenPlux, setPreparandoOrdenPlux] = useState<boolean>(false);
  const [ordenPluxPreparada, setOrdenPluxPreparada] = useState<{
    id: string;
    codigoOrden: string;
    tokenAprobacion: string;
    respaldoFirmado?: string;
    huella: string;
  } | null>(null);
  const [estadoRegalo, setEstadoRegalo] = useState<EstadoRegaloPrimeraCompra | null>(null);
  const [resumenExito, setResumenExito] = useState<{
    totalPagado: number;
    entregaTexto: string;
    esTransferencia?: boolean;
    autorizacionPlux?: string | null;
    facturaElectronica?: FacturaElectronicaResumen | null;
    emisorFactura?: ConfiguracionEmisorSri | null;
  } | null>(null);
  const [emisorNegocio, setEmisorNegocio] = useState<ConfiguracionEmisorSri>(() =>
    obtenerEmisorDefectoPorNegocio('tinkay')
  );

  // Datos de Facturación SRI
  const [datosFactura, setDatosFactura] = useState({
    nombreCompleto: '',
    identificacion: '',
    correo: '',
    telefono: '',
  });

  useEffect(() => {
    if (!checkoutAbierto) return;
    let cancelado = false;
    obtenerPasarelasCheckoutAction('tinkay')
      .then((res) => {
        if (cancelado || !res.ok) return;
        const plux = res.data.find((p) => p.pasarela === 'PLUX');
        if (plux?.ambiente) setAmbientePlux(plux.ambiente);
      })
      .catch(() => {
        // Mantiene PRUEBAS por defecto si no hay conexión
      });
    obtenerEmisorRideNegocioAction('tinkay')
      .then((emi) => {
        if (!cancelado && emi) setEmisorNegocio(emi);
      })
      .catch(() => {});
    obtenerEstadoRegaloPrimeraCompraAction('tinkay')
      .then((res) => {
        if (!cancelado) setEstadoRegalo(res);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [checkoutAbierto]);

  const huellaActual = useMemo(
    () =>
      JSON.stringify({
        nombre: datosFactura.nombreCompleto.trim(),
        id: datosFactura.identificacion.trim(),
        correo: datosFactura.correo.trim().toLowerCase(),
        tel: datosFactura.telefono.trim(),
        total: Math.round(totalPagar * 100),
        itemsLen: items.length,
      }),
    [datosFactura, totalPagar, items.length]
  );

  useEffect(() => {
    if (ordenPluxPreparada && ordenPluxPreparada.huella !== huellaActual) {
      setOrdenPluxPreparada(null);
    }
  }, [huellaActual, ordenPluxPreparada]);

  if (!checkoutAbierto) return null;

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

  const construirPayloadPedido = (metodo: 'plux' | 'transferencia') => ({
    negocio: 'tinkay',
    metodoPago: metodo,
    comprador: {
      nombreCompleto: datosFactura.nombreCompleto.trim(),
      identificacion: datosFactura.identificacion.trim(),
      correo: datosFactura.correo.trim(),
      telefono: datosFactura.telefono.trim(),
    },
    modalidadEntrega,
    entregaUnificada:
      modalidadEntrega === 'unificada'
        ? {
            retiroEnLocal: entregaUnificada.retiroEnLocal,
            destinatarioNombre:
              entregaUnificada.destinatarioNombre || datosFactura.nombreCompleto.trim(),
            destinatarioTelefono:
              entregaUnificada.destinatarioTelefono || datosFactura.telefono.trim(),
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
            detalleDireccionGeo: entregaUnificada.detalleDireccionGeo ?? null,
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
            detalleDireccionGeo: it.entregaIndividual.detalleDireccionGeo ?? null,
          }
        : undefined,
    })),
    subtotalBaseImponible,
    totalIva,
    totalFlete,
    totalRecargoHorarioExacto,
    totalPagar,
    regaloPrimeraCompra:
      estadoRegalo?.autenticado && estadoRegalo.aplicaRegalo ? estadoRegalo.regalo : null,
    conversacionWebId:
      typeof window !== 'undefined'
        ? window.localStorage.getItem('eco_chat_conv_tinkay') || undefined
        : undefined,
  });

  const validarDatosFacturacion = (): string | null => {
    if (datosFactura.nombreCompleto.trim().length < 3) {
      return 'Ingresa el nombre completo o razón social para la factura.';
    }
    if (!/^[A-Za-z0-9]{5,20}$/.test(datosFactura.identificacion.trim())) {
      return 'Ingresa una Cédula, RUC o Pasaporte válido (sin espacios ni guiones).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datosFactura.correo.trim())) {
      return 'Ingresa un correo electrónico válido para enviar tu factura.';
    }
    if (datosFactura.telefono.trim().length < 7) {
      return 'Ingresa un número de WhatsApp o teléfono válido.';
    }
    return null;
  };

  const handlePrepararOrdenPlux = async () => {
    setErrorPago(null);
    const errorValidacion = validarDatosFacturacion();
    if (errorValidacion) {
      setErrorPago(errorValidacion);
      return;
    }

    setPreparandoOrdenPlux(true);
    try {
      const resultado = await registrarPedidoTiendaAction(construirPayloadPedido('plux'));
      if (!resultado.ok || !resultado.tokenAprobacion) {
        setErrorPago(
          !resultado.ok
            ? resultado.error
            : 'No se pudo generar el token seguro de orden para PLUX.'
        );
        return;
      }

      setOrdenPluxPreparada({
        id: resultado.id,
        codigoOrden: resultado.codigoOrden,
        tokenAprobacion: resultado.tokenAprobacion,
        respaldoFirmado: resultado.respaldoFirmado,
        huella: huellaActual,
      });
    } finally {
      setPreparandoOrdenPlux(false);
    }
  };

  const handleConfirmarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPago(null);

    if (metodoPago === 'plux') {
      await handlePrepararOrdenPlux();
      return;
    }

    const errorValidacion = validarDatosFacturacion();
    if (errorValidacion) {
      setErrorPago(errorValidacion);
      return;
    }

    setPaso('procesando');
    const resultado = await registrarPedidoTiendaAction(construirPayloadPedido('transferencia'));

    if (!resultado.ok) {
      setErrorPago(resultado.error);
      setPaso('formulario');
      return;
    }

    setResumenExito({
      totalPagado: totalPagar,
      entregaTexto: entregaTextoConfirmado,
      esTransferencia: true,
    });
    setCodigoOrdenGenerado(resultado.codigoOrden);
    setPaso('exito');
    vaciarCarrito();
  };

  const handleCerrar = () => {
    setCheckoutAbierto(false);
    setPaso('formulario');
    setErrorPago(null);
    setOrdenPluxPreparada(null);
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
          title="Cerrar ventana de pago"
          aria-label="Cerrar checkout"
        >
          <X size={20} />
        </button>

        {paso === 'procesando' && (
          <div className="pantalla-procesando-pago">
            <div className="spinner-botanico" />
            <h3>Registrando tu pedido seguro...</h3>
            <p>Conectando con la plataforma de Tinkay Floristería.</p>
          </div>
        )}

        {paso === 'exito' && (
          <div className="pantalla-exito-pago">
            <div className="circulo-icono-exito">
              <CheckCircle2 size={54} />
            </div>
            <span className="badge-exito">
              {resumenExito?.esTransferencia ? '¡Pedido Reservado!' : '¡Pago Confirmado con Éxito!'}
            </span>
            <h2>Gracias por tu compra en Tinkay</h2>
            <p className="codigo-orden-destacado">
              Orden de Taller: <strong>{codigoOrdenGenerado}</strong>
            </p>
            <p className="instrucciones-exito">
              {resumenExito?.esTransferencia ? (
                <>
                  Hemos reservado tu pedido y enviado el detalle a{' '}
                  <strong>{datosFactura.correo || 'tu correo'}</strong>. Envía tu comprobante de
                  transferencia por WhatsApp indicando la orden <strong>{codigoOrdenGenerado}</strong>.
                </>
              ) : (
                <>
                  Hemos acreditado tu pago con PLUX y enviado el comprobante a{' '}
                  <strong>{datosFactura.correo || 'tu correo'}</strong>. Nuestro taller ha iniciado
                  la preparación de tu orden.
                </>
              )}
            </p>

            <div className="tarjeta-resumen-confirmacion">
              <div className="fila-resumen-c">
                <span>{resumenExito?.esTransferencia ? 'Total de la orden:' : 'Total pagado:'}</span>
                <strong>${(resumenExito?.totalPagado ?? totalPagar).toFixed(2)} USD</strong>
              </div>
              <div className="fila-resumen-c">
                <span>Entrega:</span>
                <span>{resumenExito?.entregaTexto || 'Registrada'}</span>
              </div>
            </div>

            {resumenExito?.facturaElectronica && (
              <div
                style={{
                  width: '100%',
                  marginTop: '12px',
                  marginBottom: '12px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#065F46',
                    marginBottom: '4px',
                  }}
                >
                  <FileText size={16} />
                  <span>
                    Factura Electrónica SRI N° {resumenExito.facturaElectronica.numero_comprobante}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginBottom: '10px' }}>
                  Emisor:{' '}
                  <strong>
                    {resumenExito.emisorFactura?.razonSocial || emisorNegocio.razonSocial}
                  </strong>{' '}
                  (RUC {resumenExito.emisorFactura?.ruc || emisorNegocio.ruc})
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const fac = resumenExito.facturaElectronica!;
                      imprimirFacturaRideSri({
                        negocio: 'tinkay',
                        emisor: resumenExito.emisorFactura || emisorNegocio,
                        numeroComprobante: fac.numero_comprobante,
                        claveAcceso: fac.clave_acceso,
                        estadoSri: fac.estado,
                        ambiente: fac.ambiente,
                        fechaEmision: fac.fecha_emision,
                        fechaAutorizacion: fac.fecha_autorizacion,
                        comprador: {
                          razonSocial:
                            fac.comprador?.razon_social ||
                            datosFactura.nombreCompleto ||
                            'CONSUMIDOR FINAL',
                          identificacion:
                            fac.comprador?.identificacion ||
                            datosFactura.identificacion ||
                            '9999999999999',
                          correo: fac.comprador?.correo || datosFactura.correo,
                          telefono: fac.comprador?.telefono || datosFactura.telefono,
                          direccion: fac.comprador?.direccion || 'Quito, Ecuador',
                        },
                        lineas: fac.lineas,
                        rubroPrincipal: fac.rubro_facturado,
                        codigoRubroPrincipal: fac.codigo_rubro,
                        subtotal15: fac.subtotal_15,
                        subtotal0: fac.subtotal_0,
                        subtotalGeneral: fac.subtotal,
                        iva15: fac.iva,
                        total: fac.total,
                        formaPagoTexto: '19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)',
                        referenciaPago: resumenExito.autorizacionPlux || codigoOrdenGenerado,
                      });
                    }}
                    title="Abrir comprobante electrónico RIDE para imprimir o guardar como PDF"
                    aria-label="Imprimir PDF"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#065F46',
                      color: '#FFFFFF',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Printer size={14} />
                    <span>Imprimir PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const fac = resumenExito.facturaElectronica!;
                      descargarArchivoFacturaRideSri({
                        negocio: 'tinkay',
                        emisor: resumenExito.emisorFactura || emisorNegocio,
                        numeroComprobante: fac.numero_comprobante,
                        claveAcceso: fac.clave_acceso,
                        estadoSri: fac.estado,
                        ambiente: fac.ambiente,
                        fechaEmision: fac.fecha_emision,
                        fechaAutorizacion: fac.fecha_autorizacion,
                        comprador: {
                          razonSocial:
                            fac.comprador?.razon_social ||
                            datosFactura.nombreCompleto ||
                            'CONSUMIDOR FINAL',
                          identificacion:
                            fac.comprador?.identificacion ||
                            datosFactura.identificacion ||
                            '9999999999999',
                          correo: fac.comprador?.correo || datosFactura.correo,
                          telefono: fac.comprador?.telefono || datosFactura.telefono,
                          direccion: fac.comprador?.direccion || 'Quito, Ecuador',
                        },
                        lineas: fac.lineas,
                        rubroPrincipal: fac.rubro_facturado,
                        codigoRubroPrincipal: fac.codigo_rubro,
                        subtotal15: fac.subtotal_15,
                        subtotal0: fac.subtotal_0,
                        subtotalGeneral: fac.subtotal,
                        iva15: fac.iva,
                        total: fac.total,
                        formaPagoTexto: '19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)',
                        referenciaPago: resumenExito.autorizacionPlux || codigoOrdenGenerado,
                      });
                    }}
                    title="Descargar archivo RIDE de la factura electrónica"
                    aria-label="Descargar RIDE"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #059669',
                      backgroundColor: '#FFFFFF',
                      color: '#065F46',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={14} />
                    <span>Descargar RIDE</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primario btn-terminar-pedido"
              onClick={handleCerrar}
              title="Cerrar y volver a la floristería"
              aria-label="Volver a Tienda"
            >
              Volver a Tienda
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
                  <span>PLUX 256-bit SSL</span>
                </div>
              </div>

              {/* Selector de Método de Pago */}
              <div className="pills-metodos-pago">
                <button
                  type="button"
                  className={`btn-metodo-pago ${metodoPago === 'plux' ? 'activo' : ''}`}
                  onClick={() => {
                    setMetodoPago('plux');
                    setErrorPago(null);
                  }}
                  title="Pagar en línea con tarjeta de crédito o débito mediante PLUX"
                  aria-label="Tarjeta PLUX"
                >
                  <CreditCard size={18} />
                  <div>
                    <strong>Tarjeta (PLUX)</strong>
                    <small>Visa / Mastercard / Diners / Débito</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`btn-metodo-pago ${metodoPago === 'transferencia' ? 'activo' : ''}`}
                  onClick={() => {
                    setMetodoPago('transferencia');
                    setErrorPago(null);
                  }}
                  title="Pagar mediante transferencia o depósito bancario"
                  aria-label="Transferencia Bancaria"
                >
                  <Building2 size={18} />
                  <div>
                    <strong>Transferencia Bancaria</strong>
                    <small>Pichincha / Produbanco</small>
                  </div>
                </button>
              </div>

              <form onSubmit={handleConfirmarTransferencia} className="form-checkout-flujo">
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
                        setDatosFactura({
                          ...datosFactura,
                          identificacion: e.target.value.replace(/[\s-]/g, ''),
                        })
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
                {metodoPago === 'plux' ? (
                  <div
                    className="grupo-campos-checkout"
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <label className="titulo-seccion-form" style={{ marginBottom: 0 }}>
                      2. Pasarela Oficial PagoPlux — Tinkay Floristería
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        color: '#475569',
                        lineHeight: 1.5,
                      }}
                    >
                      Tus datos de tarjeta se ingresan directamente en la ventana cifrada de{' '}
                      <strong>PLUX ({ambientePlux === 'PRODUCCION' ? 'Producción' : 'Sandbox'})</strong>{' '}
                      y nunca pasan por nuestros servidores.
                    </p>

                    {!ordenPluxPreparada ? (
                      <button
                        type="button"
                        onClick={handlePrepararOrdenPlux}
                        disabled={preparandoOrdenPlux}
                        className="btn btn-primario btn-confirmar-pago-grande"
                        title="Validar datos de facturación y habilitar botón de pago seguro PLUX"
                        aria-label="Continuar a PLUX"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                      >
                        <Lock size={16} />
                        <span>{preparandoOrdenPlux ? 'Preparando...' : 'Continuar a PLUX'}</span>
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          paddingTop: '4px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: '#166534',
                            background: '#DCFCE7',
                            border: '1px solid #BBF7D0',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontWeight: 600,
                          }}
                        >
                          Orden lista ({ordenPluxPreparada.codigoOrden}) · Importe exacto:{' '}
                          <strong>${totalPagar.toFixed(2)} USD</strong>
                        </div>
                        <BotonPagoPlux
                          negocio="tinkay"
                          proformaId={ordenPluxPreparada.id}
                          tokenAprobacion={ordenPluxPreparada.tokenAprobacion}
                          respaldoFirmado={ordenPluxPreparada.respaldoFirmado}
                          modalidadCobro="TOTAL_100"
                          ambiente={ambientePlux}
                          pagador={{
                            nombre: datosFactura.nombreCompleto.trim(),
                            identificacion: datosFactura.identificacion.trim(),
                            email: datosFactura.correo.trim(),
                            telefono: datosFactura.telefono.trim(),
                            direccion:
                              (modalidadEntrega === 'unificada' && entregaUnificada.direccion) ||
                              'Quito, Ecuador',
                          }}
                          etiqueta={`Pagar $${totalPagar.toFixed(2)}`}
                          alPagoAprobado={(_identificador: string, pago: PagoPluxConsultado) => {
                            setResumenExito({
                              totalPagado: totalPagar,
                              entregaTexto: entregaTextoConfirmado,
                              esTransferencia: false,
                              autorizacionPlux: pago.autorizacion,
                              facturaElectronica: pago.facturaElectronica || null,
                              emisorFactura: pago.emisorFactura || emisorNegocio,
                            });
                            setCodigoOrdenGenerado(ordenPluxPreparada.codigoOrden);
                            setPaso('exito');
                            vaciarCarrito();
                          }}
                        />
                      </div>
                    )}
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
                        N° 2100234567 — {emisorNegocio.razonSocial}
                        <br />
                        RUC: {emisorNegocio.ruc} — {emisorNegocio.correoCopia || 'pagos@tinkay.com'}
                      </p>
                    </div>
                    <div className="caja-datos-banco">
                      <p>
                        <strong>Banco Produbanco — Cuenta de Ahorros:</strong>
                        <br />
                        N° 12005678901 — {emisorNegocio.razonSocial}
                      </p>
                    </div>
                    <small className="aviso-transferencia">
                      Al presionar &quot;Confirmar Pedido&quot;, reservaremos tu orden y podrás
                      enviar el comprobante de transferencia por WhatsApp.
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

                {metodoPago === 'transferencia' && (
                  <button
                    type="submit"
                    className="btn btn-primario btn-confirmar-pago-grande"
                    title={`Confirmar pedido por transferencia bancaria ($${totalPagar.toFixed(2)} USD)`}
                    aria-label="Confirmar Pedido"
                  >
                    <span>Confirmar Pedido</span>
                  </button>
                )}
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

              {estadoRegalo && (!estadoRegalo.autenticado || estadoRegalo.aplicaRegalo) && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: estadoRegalo.autenticado ? '#ECFDF5' : '#FDF2F8',
                    border: estadoRegalo.autenticado ? '1px solid #A7F3D0' : '1px solid #FBCFE8',
                    color: estadoRegalo.autenticado ? '#065F46' : '#831843',
                    fontSize: '0.76rem',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <Gift size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    {estadoRegalo.autenticado ? (
                      <>
                        <strong>Regalo 1ra Compra incluido:</strong> 1x Bombón de Chocolate Ferrero
                        en Esfera Acrílica (<strong>GRATIS $0.00</strong>).
                      </>
                    ) : (
                      <>
                        <strong>¡Regalo de 1ra Compra!</strong>{' '}
                        <Link
                          href="/registro?destino=/"
                          style={{ color: '#9D174D', fontWeight: 700, textDecoration: 'underline' }}
                        >
                          Regístrate
                        </Link>{' '}
                        y recibe <strong>1 Bombón de Chocolate en Esfera GRATIS</strong>. (No es
                        obligatorio registrarse para comprar).
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
