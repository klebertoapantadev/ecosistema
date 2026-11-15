'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BotonPagoPlux,
  SelectorUbicacionEntrega,
  construirUrlWhatsappTienda,
  descargarArchivoFacturaRideSri,
  imprimirFacturaRideSri,
  obtenerConfiguracionTiendaCheckoutAction,
  obtenerEmisorDefectoPorNegocio,
  obtenerEmisorRideNegocioAction,
  obtenerEstadoRegaloPrimeraCompraAction,
  obtenerPasarelasCheckoutAction,
  registrarPedidoTiendaAction,
  subirComprobanteTransferenciaAction,
  type ComprobanteTransferenciaSubido,
  type ConfiguracionEmisorSri,
  type ConfiguracionTiendaCheckout,
  type EstadoRegaloPrimeraCompra,
  type FacturaElectronicaResumen,
  type PagoPluxConsultado,
} from '@eco/comercio';
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
import type { FranjaHoraria } from '../tipos';
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
  Truck,
  Store,
  Upload,
  AlertTriangle,
  Copy,
  Check,
  MessageCircle,
  Loader2,
  MapPin,
} from 'lucide-react';

async function comprimirImagenComprobanteSiNecesario(archivo: File): Promise<File> {
  if (!archivo.type.startsWith('image/') || archivo.size <= 1_100_000) {
    return archivo;
  }
  return new Promise((resolve) => {
    try {
      const urlObj = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(urlObj);
        const maxDim = 1400;
        let ancho = img.width;
        let alto = img.height;
        if (ancho > maxDim || alto > maxDim) {
          if (ancho >= alto) {
            alto = Math.round((alto * maxDim) / ancho);
            ancho = maxDim;
          } else {
            ancho = Math.round((ancho * maxDim) / alto);
            alto = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(archivo);
          return;
        }
        ctx.drawImage(img, 0, 0, ancho, alto);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(archivo);
              return;
            }
            const nombreBase = archivo.name.replace(/\.[^.]+$/, '') || 'comprobante';
            resolve(
              new File([blob], `${nombreBase}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
            );
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(urlObj);
        resolve(archivo);
      };
      img.src = urlObj;
    } catch {
      resolve(archivo);
    }
  });
}

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
    setModalidadEntrega,
    entregaUnificada,
    actualizarEntregaUnificada,
    configLogistica,
    configTiendaCheckout,
    vaciarCarrito,
  } = useCarrito();

  const [configCheckoutLocal, setConfigCheckoutLocal] =
    useState<ConfiguracionTiendaCheckout>(configTiendaCheckout);
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
  const [usuarioRegistradoTinkay, setUsuarioRegistradoTinkay] = useState<boolean>(false);
  const [deseaFacturaConDatos, setDeseaFacturaConDatos] = useState<boolean>(false);
  const [mostrarMapaEntrega, setMostrarMapaEntrega] = useState<boolean>(false);
  const [datoCopiado, setDatoCopiado] = useState<string | null>(null);

  // Comprobante de transferencia (imagen o PDF)
  const [subiendoComprobante, setSubiendoComprobante] = useState<boolean>(false);
  const [comprobanteSubido, setComprobanteSubido] =
    useState<ComprobanteTransferenciaSubido | null>(null);

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

  // Datos de Facturación SRI & Contacto WhatsApp
  const [paisWhatsapp, setPaisWhatsapp] = useState<string>(PAIS_TELEFONO_DEFECTO);
  const [datosFactura, setDatosFactura] = useState({
    nombreCompleto: '',
    identificacion: '',
    correo: '',
    telefono: '',
  });

  useEffect(() => {
    setConfigCheckoutLocal(configTiendaCheckout);
  }, [configTiendaCheckout]);

  useEffect(() => {
    if (!checkoutAbierto) return;
    let cancelado = false;

    obtenerConfiguracionTiendaCheckoutAction('tinkay')
      .then((cfg) => {
        if (!cancelado && cfg) setConfigCheckoutLocal(cfg);
      })
      .catch(() => {});

    obtenerPasarelasCheckoutAction('tinkay')
      .then((res) => {
        if (cancelado || !res.ok) return;
        const plux = res.data.find((p) => p.pasarela === 'PLUX');
        if (plux?.ambiente) setAmbientePlux(plux.ambiente);
      })
      .catch(() => {});

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

    // Verificar si el cliente está registrado con membresía activa en Tinkay
    (async () => {
      try {
        const supabase = crearClienteNavegador();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelado) {
          if (!cancelado) setUsuarioRegistradoTinkay(false);
          return;
        }
        const codigos = codigosNegocio('tinkay');
        const [{ data: memTinkay }, { data: perfilRaw }] = await Promise.all([
          supabase
            .schema('comun_seguridad')
            .from('seg_membresia')
            .select('mem_id')
            .eq('mem_usuario_id', user.id)
            .in('mem_negocio', codigos)
            .eq('mem_estado', 'ACTIVO')
            .limit(1)
            .maybeSingle(),
          supabase
            .schema('comun_seguridad')
            .from('seg_usuario')
            .select(
              'usu_nombres, usu_apellidos, usu_cedula, usu_whatsapp, usu_autorizacion_whatsapp, usu_superadmin_plataforma, usu_detalle_usuario'
            )
            .eq('usu_id', user.id)
            .maybeSingle(),
        ]);

        if (cancelado) return;
        const tieneMembresia = Boolean(memTinkay);
        setUsuarioRegistradoTinkay(tieneMembresia);

        if (tieneMembresia && perfilRaw) {
          const proy = proyectarPerfilPorNegocio(perfilRaw, 'tinkay', true);
          if (proy) {
            const nombreComp = [proy.usu_nombres, proy.usu_apellidos]
              .filter(Boolean)
              .join(' ')
              .trim();
            const telRaw = proy.usu_whatsapp ? String(proy.usu_whatsapp).trim() : '';
            const paisEncontrado = telRaw
              ? PAISES_TELEFONO.find((p) => telRaw.startsWith(p.prefijo))
              : undefined;
            if (paisEncontrado) {
              setPaisWhatsapp(paisEncontrado.codigo);
            }
            const digitosLocales = paisEncontrado
              ? telRaw.slice(paisEncontrado.prefijo.length)
              : telRaw;
            setDatosFactura((prev) => ({
              nombreCompleto: prev.nombreCompleto || nombreComp,
              identificacion: prev.identificacion || (proy.usu_cedula ? String(proy.usu_cedula) : ''),
              correo: prev.correo || user.email || '',
              telefono: prev.telefono || digitosLocales,
            }));
          }
        }
      } catch {
        if (!cancelado) setUsuarioRegistradoTinkay(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [checkoutAbierto]);

  const paisObj = useMemo(
    () =>
      PAISES_TELEFONO.find((p) => p.codigo === paisWhatsapp) ??
      PAISES_TELEFONO.find((p) => p.codigo === PAIS_TELEFONO_DEFECTO) ??
      { codigo: 'EC', nombre: 'Ecuador', prefijo: '+593' },
    [paisWhatsapp]
  );

  const telefonoNormalizado = useMemo(() => {
    const bruto = datosFactura.telefono.trim();
    if (!bruto) return '';
    if (bruto.startsWith('+')) return bruto;
    const soloDigitos = bruto.replace(/\D+/g, '').replace(/^0+/, '');
    if (!soloDigitos) return '';
    return `${paisObj.prefijo}${soloDigitos}`;
  }, [datosFactura.telefono, paisObj]);

  const umbralSinDatosUsd = Math.max(
    0,
    Number(configCheckoutLocal.montoMaximoPagoSinDatosUsd ?? 50)
  );
  const esMenorAlUmbral = totalPagar < umbralSinDatosUsd;
  const esRetiroEnTienda =
    modalidadEntrega === 'unificada' && Boolean(entregaUnificada.retiroEnLocal);

  // Reglas de negocio exactas:
  // 1. Si pago < $50 (umbral configurable): nombre, identificación y correo NO son obligatorios (Consumidor Final).
  // 2. Si cliente NO está registrado y elige envío a domicilio: WhatsApp es OBLIGATORIO para coordinar entrega.
  // 3. Si cliente retira en tienda: NINGUNA información de entrega/WhatsApp es requerida (y si < $50, cero campos requeridos).
  const requiereDatosFacturacion = !esMenorAlUmbral;
  const mostrarCamposFacturacion = requiereDatosFacturacion || deseaFacturaConDatos;
  const requiereWhatsappCoordinacion = !esRetiroEnTienda && !usuarioRegistradoTinkay;

  const itemsPrincipales = useMemo(
    () => items.filter((it) => !it.producto.esComplemento && !it.producto.esExtra),
    [items]
  );
  const listaBaseLogistica = itemsPrincipales.length > 0 ? itemsPrincipales : items;
  const algunoNoIncluyeDelivery = listaBaseLogistica.some(
    (it) =>
      it.producto.deliveryIncluido === false &&
      it.producto.modalidadTransporte !== 'SOLO_RETIRO'
  );
  const recargoEspecialTotal = listaBaseLogistica.reduce(
    (acc, it) => acc + (it.producto.recargoLogisticoUsd || 0) * it.cantidad,
    0
  );
  const tarifaHoraExacta = configLogistica.recargoHoraExacta ?? 10;

  const tieneUbicacionDomicilioConfirmada = Boolean(
    esRetiroEnTienda ||
      modalidadEntrega === 'individual' ||
      (typeof entregaUnificada.costoEnvioCalculado === 'number' &&
        entregaUnificada.dentroCobertura !== false) ||
      (entregaUnificada.direccion && entregaUnificada.direccion.trim().length >= 5)
  );

  const huellaActual = useMemo(
    () =>
      JSON.stringify({
        nombre: datosFactura.nombreCompleto.trim(),
        id: datosFactura.identificacion.trim(),
        correo: datosFactura.correo.trim().toLowerCase(),
        tel: telefonoNormalizado,
        retiro: esRetiroEnTienda,
        total: Math.round(totalPagar * 100),
        itemsLen: items.length,
      }),
    [datosFactura, telefonoNormalizado, esRetiroEnTienda, totalPagar, items.length]
  );

  useEffect(() => {
    if (ordenPluxPreparada && ordenPluxPreparada.huella !== huellaActual) {
      setOrdenPluxPreparada(null);
    }
  }, [huellaActual, ordenPluxPreparada]);

  if (!checkoutAbierto) return null;

  const copiarTexto = async (clave: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setDatoCopiado(clave);
      setTimeout(() => setDatoCopiado(null), 1800);
    } catch {
      // Ignorar si clipboard no está disponible
    }
  };

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

  const construirPayloadPedido = (metodo: 'plux' | 'transferencia') => {
    const usarDatosFactura = mostrarCamposFacturacion;
    const nombreEfectivo = usarDatosFactura ? datosFactura.nombreCompleto.trim() : '';
    const idEfectiva = usarDatosFactura ? datosFactura.identificacion.trim() : '';
    const correoEfectivo = usarDatosFactura ? datosFactura.correo.trim() : '';
    const telEfectivo = esRetiroEnTienda && !telefonoNormalizado ? '' : telefonoNormalizado;

    return {
      negocio: 'tinkay',
      metodoPago: metodo,
      comprador: {
        nombreCompleto: nombreEfectivo,
        identificacion: idEfectiva,
        correo: correoEfectivo,
        telefono: telEfectivo,
      },
      comprobanteTransferencia: metodo === 'transferencia' ? comprobanteSubido : null,
      modalidadEntrega,
      entregaUnificada:
        modalidadEntrega === 'unificada'
          ? {
              retiroEnLocal: entregaUnificada.retiroEnLocal,
              destinatarioNombre:
                entregaUnificada.destinatarioNombre || nombreEfectivo || 'Cliente en Tienda',
              destinatarioTelefono: entregaUnificada.destinatarioTelefono || telEfectivo,
              direccion: entregaUnificada.retiroEnLocal
                ? `Retiro en ${configLogistica.origenNombre}`
                : entregaUnificada.direccion || 'Quito, Ecuador',
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
    };
  };

  const validarCheckout = (metodo: 'plux' | 'transferencia'): string | null => {
    if (!esRetiroEnTienda && modalidadEntrega === 'unificada') {
      if (entregaUnificada.dentroCobertura === false) {
        return 'La ubicación seleccionada está fuera de nuestra cobertura de entrega.';
      }
      if (!tieneUbicacionDomicilioConfirmada) {
        setMostrarMapaEntrega(true);
        return 'Selecciona tu ubicación de entrega a domicilio o elige Retiro en Tienda.';
      }
    }

    if (requiereWhatsappCoordinacion) {
      const digitosTel = telefonoNormalizado.replace(/\D+/g, '');
      if (digitosTel.length < 9) {
        return 'Ingresa tu número de WhatsApp: es requerido para contactarte y coordinar la entrega de tu pedido.';
      }
    }

    if (requiereDatosFacturacion) {
      if (datosFactura.nombreCompleto.trim().length < 3) {
        return `Para compras desde $${umbralSinDatosUsd.toFixed(2)} USD, ingresa tu nombre o razón social.`;
      }
      if (!/^[A-Za-z0-9]{5,20}$/.test(datosFactura.identificacion.trim())) {
        return 'Ingresa una Cédula, RUC o Pasaporte válido (sin espacios ni guiones).';
      }
    } else if (deseaFacturaConDatos) {
      if (datosFactura.nombreCompleto.trim().length < 3) {
        return 'Ingresa el nombre o razón social para tu factura (o desmarca la opción para Consumidor Final).';
      }
      if (!/^[A-Za-z0-9]{5,20}$/.test(datosFactura.identificacion.trim())) {
        return 'Ingresa una Cédula, RUC o Pasaporte válido para tu factura.';
      }
    }

    if (
      mostrarCamposFacturacion &&
      datosFactura.correo.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datosFactura.correo.trim())
    ) {
      return 'Ingresa un correo electrónico válido.';
    }

    if (metodo === 'transferencia' && !comprobanteSubido?.url) {
      return 'Debes subir el comprobante de transferencia (imagen o PDF) para confirmar tu pedido.';
    }

    return null;
  };

  const handleSubirArchivoComprobante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivoOriginal = e.target.files?.[0];
    if (!archivoOriginal) return;
    setErrorPago(null);

    const mime = (archivoOriginal.type || '').toLowerCase();
    const nombreLower = archivoOriginal.name.toLowerCase();
    const esPdf = mime === 'application/pdf' || nombreLower.endsWith('.pdf');
    const esImagen = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(nombreLower);

    if (!esPdf && !esImagen) {
      setErrorPago('Formato no permitido. Sube una imagen (JPG, PNG, WEBP) o un archivo PDF.');
      return;
    }

    setSubiendoComprobante(true);
    try {
      const archivoOptimizado = esImagen
        ? await comprimirImagenComprobanteSiNecesario(archivoOriginal)
        : archivoOriginal;

      const fd = new FormData();
      fd.set('negocio', 'tinkay');
      fd.set('archivo', archivoOptimizado);

      const res = await subirComprobanteTransferenciaAction(fd);
      if (!res.ok) {
        setErrorPago(res.error);
        return;
      }
      setComprobanteSubido(res.comprobante);
    } catch {
      setErrorPago('No se pudo cargar el comprobante. Intenta nuevamente.');
    } finally {
      setSubiendoComprobante(false);
    }
  };

  const handlePrepararOrdenPlux = async () => {
    setErrorPago(null);
    const errorValidacion = validarCheckout('plux');
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

    const errorValidacion = validarCheckout('transferencia');
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
    setComprobanteSubido(null);
  };

  const urlWhatsappComprobantePrevio = construirUrlWhatsappTienda(
    configCheckoutLocal.whatsappTienda,
    `Hola Tinkay, deseo enviar el comprobante de pago de mi pedido floral por $${totalPagar.toFixed(
      2
    )} USD (${esRetiroEnTienda ? 'Retiro en tienda' : 'Envío a domicilio'}).`
  );

  const urlWhatsappExito = construirUrlWhatsappTienda(
    configCheckoutLocal.whatsappTienda,
    `Hola Tinkay, adjunto el comprobante de mi orden ${codigoOrdenGenerado} por $${(
      resumenExito?.totalPagado ?? totalPagar
    ).toFixed(2)} USD.`
  );

  const transf = configCheckoutLocal.transferencia;

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
              {resumenExito?.esTransferencia ? '¡Pedido Recibido!' : '¡Pago Confirmado con Éxito!'}
            </span>
            <h2>Gracias por tu compra en Tinkay</h2>
            <p className="codigo-orden-destacado">
              Orden de Taller: <strong>{codigoOrdenGenerado}</strong>
            </p>
            <p className="instrucciones-exito">
              {resumenExito?.esTransferencia ? (
                <>
                  Hemos recibido tu pedido y tu comprobante adjunto.{' '}
                  <strong>{transf.advertenciaAcreditacion}</strong> También puedes escribirnos por
                  WhatsApp si deseas compartir el comprobante o coordinar detalles adicionales.
                </>
              ) : (
                <>
                  Hemos acreditado tu pago con PLUX
                  {datosFactura.correo ? (
                    <>
                      {' '}
                      y enviado el comprobante a <strong>{datosFactura.correo}</strong>
                    </>
                  ) : null}
                  . Nuestro taller ha iniciado la preparación de tu orden.
                </>
              )}
            </p>

            <div className="tarjeta-resumen-confirmacion">
              <div className="fila-resumen-c">
                <span>{resumenExito?.esTransferencia ? 'Total de la orden:' : 'Total pagado:'}</span>
                <strong>${(resumenExito?.totalPagado ?? totalPagar).toFixed(2)} USD</strong>
              </div>
              <div className="fila-resumen-c">
                <span>Modalidad:</span>
                <span>{resumenExito?.entregaTexto || 'Registrada'}</span>
              </div>
            </div>

            {resumenExito?.esTransferencia && (
              <a
                href={urlWhatsappExito}
                target="_blank"
                rel="noopener noreferrer"
                title={`Escribir a WhatsApp (${configCheckoutLocal.whatsappTienda}) y adjuntar comprobante`}
                aria-label="Enviar por WhatsApp"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  marginTop: '10px',
                  marginBottom: '10px',
                  padding: '12px 18px',
                  borderRadius: '999px',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                }}
              >
                <MessageCircle size={18} />
                <span>Enviar por WhatsApp</span>
              </a>
            )}

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
                          telefono: fac.comprador?.telefono || telefonoNormalizado,
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
                          telefono: fac.comprador?.telefono || telefonoNormalizado,
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
            {/* Columna Izquierda: Entrega, Contacto/Factura y Pago */}
            <div className="columna-formulario-pago">
              <div className="cabecera-checkout">
                <h2>Caja de Pago Rápido</h2>
                <div className="sello-seguridad">
                  <ShieldCheck size={16} />
                  <span>Pago Seguro</span>
                </div>
              </div>

              <form onSubmit={handleConfirmarTransferencia} className="form-checkout-flujo">
                {/* 1. Modalidad de Recepción: Envío a Domicilio vs Retiro en Tienda */}
                {modalidadEntrega === 'unificada' && (
                  <div
                    className="grupo-campos-checkout"
                    style={{
                      background: '#FAF8F5',
                      border: '1px solid #E7E5E4',
                      borderRadius: '14px',
                      padding: '14px',
                    }}
                  >
                    <label className="titulo-seccion-form" style={{ marginBottom: '10px' }}>
                      1. ¿Cómo deseas recibir tu pedido?
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '10px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setModalidadEntrega('unificada');
                          actualizarEntregaUnificada({
                            retiroEnLocal: false,
                            direccion: entregaUnificada.direccion?.startsWith('Retiro en ')
                              ? ''
                              : entregaUnificada.direccion,
                          });
                          if (typeof entregaUnificada.costoEnvioCalculado !== 'number') {
                            setMostrarMapaEntrega(true);
                          }
                        }}
                        title="Recibir el arreglo en una dirección a domicilio"
                        aria-label="Envío Domicilio"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: !esRetiroEnTienda ? '2px solid #2D4734' : '1px solid #CBD5E1',
                          background: !esRetiroEnTienda ? '#F0FDF4' : '#FFFFFF',
                          color: '#0F172A',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Truck size={18} color={!esRetiroEnTienda ? '#166534' : '#64748B'} />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.82rem' }}>
                            Envío Domicilio
                          </strong>
                          <small style={{ fontSize: '0.7rem', color: '#475569' }}>
                            {!esRetiroEnTienda && totalFlete === 0
                              ? 'Gratis en cobertura'
                              : !esRetiroEnTienda
                              ? `$${totalFlete.toFixed(2)} USD`
                              : 'Quito y Valles'}
                          </small>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setModalidadEntrega('unificada');
                          setMostrarMapaEntrega(false);
                          setErrorPago(null);
                          actualizarEntregaUnificada({
                            retiroEnLocal: true,
                            costoEnvioCalculado: 0,
                            dentroCobertura: true,
                            direccion: `Retiro en ${configLogistica.origenNombre}`,
                            franjaHoraria:
                              entregaUnificada.franjaHoraria === 'hora_exacta'
                                ? 'manana'
                                : entregaUnificada.franjaHoraria,
                          });
                        }}
                        title="Retirar gratis en nuestra tienda sin costo de envío ni datos requeridos"
                        aria-label="Retiro Tienda"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: esRetiroEnTienda ? '2px solid #2D4734' : '1px solid #CBD5E1',
                          background: esRetiroEnTienda ? '#F0FDF4' : '#FFFFFF',
                          color: '#0F172A',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Store size={18} color={esRetiroEnTienda ? '#166534' : '#64748B'} />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.82rem' }}>
                            Retiro Tienda
                          </strong>
                          <small style={{ fontSize: '0.7rem', color: '#15803D', fontWeight: 700 }}>
                            Gratis ($0.00)
                          </small>
                        </div>
                      </button>
                    </div>

                    {esRetiroEnTienda ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                          paddingTop: '4px',
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                            Fecha de retiro
                          </label>
                          <input
                            type="date"
                            value={entregaUnificada.fechaEntrega}
                            onChange={(e) =>
                              actualizarEntregaUnificada({ fechaEntrega: e.target.value })
                            }
                            className="input-checkout"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                            Horario
                          </label>
                          <select
                            value={entregaUnificada.franjaHoraria}
                            onChange={(e) =>
                              actualizarEntregaUnificada({
                                franjaHoraria: e.target.value as FranjaHoraria,
                              })
                            }
                            className="input-checkout"
                          >
                            <option value="manana">Mañana (09:00 - 13:00)</option>
                            <option value="tarde">Tarde (14:00 - 18:00)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tieneUbicacionDomicilioConfirmada && !mostrarMapaEntrega ? (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '9px',
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <MapPin size={15} color="#166534" />
                              <span>
                                <strong>
                                  {entregaUnificada.zonaDetectadaNombre ||
                                    entregaUnificada.direccion ||
                                    'Ubicación seleccionada'}
                                </strong>{' '}
                                · {totalFlete === 0 ? 'Envío Gratis' : `Envío $${totalFlete.toFixed(2)}`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setMostrarMapaEntrega(true)}
                              title="Cambiar punto GPS o dirección de entrega"
                              aria-label="Cambiar Ubicación"
                              style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                background: '#F8FAFC',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Cambiar
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: '#FFFFFF',
                              borderRadius: '10px',
                              padding: '10px',
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            <SelectorUbicacionEntrega
                              negocio="tinkay"
                              configuracionInicial={configLogistica}
                              deliveryIncluidoProducto={!algunoNoIncluyeDelivery}
                              recargoLogisticoProducto={recargoEspecialTotal}
                              permitirModoRetiro={false}
                              retiroEnLocal={false}
                              enlaceMapaInicial={entregaUnificada.enlaceMapa || ''}
                              coordenadasIniciales={
                                typeof entregaUnificada.lat === 'number' &&
                                typeof entregaUnificada.lng === 'number'
                                  ? { lat: entregaUnificada.lat, lng: entregaUnificada.lng }
                                  : null
                              }
                              onCambioCotizacion={(ev) => {
                                setErrorPago(null);
                                actualizarEntregaUnificada({
                                  retiroEnLocal: false,
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
                                  ...(ev.direccionSugerida && !entregaUnificada.direccion
                                    ? { direccion: ev.direccionSugerida }
                                    : {}),
                                });
                              }}
                            />
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px',
                                marginTop: '8px',
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Referencia / Edificio / Casa (opcional)"
                                value={entregaUnificada.referencia}
                                onChange={(e) =>
                                  actualizarEntregaUnificada({ referencia: e.target.value })
                                }
                                className="input-checkout"
                              />
                              <input
                                type="text"
                                placeholder="Nombre de quien recibe (opcional)"
                                value={entregaUnificada.destinatarioNombre}
                                onChange={(e) =>
                                  actualizarEntregaUnificada({ destinatarioNombre: e.target.value })
                                }
                                className="input-checkout"
                              />
                              <input
                                type="date"
                                value={entregaUnificada.fechaEntrega}
                                onChange={(e) =>
                                  actualizarEntregaUnificada({ fechaEntrega: e.target.value })
                                }
                                className="input-checkout"
                              />
                              <select
                                value={entregaUnificada.franjaHoraria}
                                onChange={(e) =>
                                  actualizarEntregaUnificada({
                                    franjaHoraria: e.target.value as FranjaHoraria,
                                  })
                                }
                                className="input-checkout"
                              >
                                <option value="manana">Mañana (09:00 - 13:00)</option>
                                <option value="tarde">Tarde (14:00 - 18:00)</option>
                                <option value="hora_exacta">
                                  Hora Exacta (+${tarifaHoraExacta.toFixed(2)})
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Contacto de Coordinación & Datos de Facturación según Monto (< $50) y Retiro */}
                <div className="grupo-campos-checkout">
                  <label className="titulo-seccion-form">
                    2. Contacto y Facturación
                  </label>

                  {esRetiroEnTienda && esMenorAlUmbral && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        color: '#065F46',
                        fontSize: '0.79rem',
                        lineHeight: 1.45,
                        marginBottom: '10px',
                      }}
                    >
                      <strong>✓ Retiro en tienda y compra menor a ${umbralSinDatosUsd.toFixed(2)}:</strong>{' '}
                      Ninguna información personal es requerida (se emite como Consumidor Final).
                    </div>
                  )}

                  {!esRetiroEnTienda && esMenorAlUmbral && (
                    <div
                      style={{
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        color: '#0C4A6E',
                        fontSize: '0.78rem',
                        lineHeight: 1.45,
                        marginBottom: '10px',
                      }}
                    >
                      <strong>Compra rápida (&lt; ${umbralSinDatosUsd.toFixed(2)} USD):</strong>{' '}
                      No necesitas ingresar nombre ni cédula (Consumidor Final).
                    </div>
                  )}

                  {/* Campo WhatsApp: Obligatorio si NO está registrado y NO retira en tienda */}
                  {!esRetiroEnTienda && (
                    <div style={{ marginBottom: '10px' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#1E293B',
                          marginBottom: '4px',
                        }}
                      >
                        Número de WhatsApp {requiereWhatsappCoordinacion ? '*' : '(opcional)'}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '115px 1fr', gap: '8px' }}>
                        <select
                          value={paisWhatsapp}
                          onChange={(e) => setPaisWhatsapp(e.target.value)}
                          className="input-checkout"
                          aria-label="País de WhatsApp"
                        >
                          {PAISES_TELEFONO.map((p) => (
                            <option key={p.codigo} value={p.codigo}>
                              {p.codigo} ({p.prefijo})
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          placeholder="99 123 4567"
                          required={requiereWhatsappCoordinacion}
                          value={datosFactura.telefono}
                          onChange={(e) =>
                            setDatosFactura({ ...datosFactura, telefono: e.target.value })
                          }
                          className="input-checkout"
                        />
                      </div>
                      {requiereWhatsappCoordinacion && (
                        <small
                          style={{
                            display: 'block',
                            marginTop: '4px',
                            fontSize: '0.74rem',
                            color: '#92400E',
                            fontWeight: 600,
                          }}
                        >
                          📲 Requerido para contactarte y coordinar la entrega de tu pedido.
                        </small>
                      )}
                    </div>
                  )}

                  {/* Toggle opcional para Factura con Datos cuando el pago es < $50 */}
                  {esMenorAlUmbral && (
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontSize: '0.79rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                        marginBottom: mostrarCamposFacturacion ? '10px' : '0',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={deseaFacturaConDatos}
                        onChange={(e) => setDeseaFacturaConDatos(e.target.checked)}
                      />
                      <span>Deseo factura electrónica con mis datos (opcional)</span>
                    </label>
                  )}

                  {mostrarCamposFacturacion && (
                    <div className="grid-dos-columnas">
                      <input
                        type="text"
                        placeholder="Nombre o Razón Social *"
                        required={requiereDatosFacturacion || deseaFacturaConDatos}
                        value={datosFactura.nombreCompleto}
                        onChange={(e) =>
                          setDatosFactura({ ...datosFactura, nombreCompleto: e.target.value })
                        }
                        className="input-checkout"
                      />
                      <input
                        type="text"
                        placeholder="Cédula / RUC / Pasaporte *"
                        required={requiereDatosFacturacion || deseaFacturaConDatos}
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
                        placeholder="Correo para factura (opcional)"
                        value={datosFactura.correo}
                        onChange={(e) =>
                          setDatosFactura({ ...datosFactura, correo: e.target.value })
                        }
                        className="input-checkout"
                        style={{ gridColumn: '1 / -1' }}
                      />
                    </div>
                  )}
                </div>

                {/* 3. Selector de Método de Pago */}
                <div className="pills-metodos-pago" style={{ marginBottom: '12px' }}>
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
                      <small>Visa / Mastercard / Débito</small>
                    </div>
                  </button>

                  {transf.habilitada && (
                    <button
                      type="button"
                      className={`btn-metodo-pago ${metodoPago === 'transferencia' ? 'activo' : ''}`}
                      onClick={() => {
                        setMetodoPago('transferencia');
                        setErrorPago(null);
                      }}
                      title="Pagar mediante transferencia bancaria o QR DeUna"
                      aria-label="Transferencia o QR"
                    >
                      <Building2 size={18} />
                      <div>
                        <strong>Transferencia / DeUna</strong>
                        <small>Pichincha · Produbanco · QR</small>
                      </div>
                    </button>
                  )}
                </div>

                {/* Sección según Método de Pago */}
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
                      3. Pago con Tarjeta (PagoPlux)
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: '#475569',
                        lineHeight: 1.45,
                      }}
                    >
                      Tus datos de tarjeta se ingresan en la ventana cifrada de{' '}
                      <strong>PLUX ({ambientePlux === 'PRODUCCION' ? 'Producción' : 'Sandbox'})</strong>.
                    </p>

                    {!ordenPluxPreparada ? (
                      <button
                        type="button"
                        onClick={handlePrepararOrdenPlux}
                        disabled={preparandoOrdenPlux}
                        className="btn btn-primario btn-confirmar-pago-grande"
                        title="Habilitar pasarela de pago con tarjeta PLUX"
                        aria-label="Pagar Ahora"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                      >
                        <Lock size={16} />
                        <span>
                          {preparandoOrdenPlux
                            ? 'Preparando...'
                            : `Continuar ($${totalPagar.toFixed(2)})`}
                        </span>
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
                          Orden lista ({ordenPluxPreparada.codigoOrden}) · Total:{' '}
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
                            nombre: mostrarCamposFacturacion
                              ? datosFactura.nombreCompleto.trim()
                              : '',
                            identificacion: mostrarCamposFacturacion
                              ? datosFactura.identificacion.trim()
                              : '',
                            email: mostrarCamposFacturacion ? datosFactura.correo.trim() : '',
                            telefono: telefonoNormalizado,
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
                  <div
                    className="grupo-campos-checkout transferencia-box"
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    <label className="titulo-seccion-form" style={{ marginBottom: 0 }}>
                      3. Datos para la Transferencia y QR DeUna
                    </label>

                    {/* Advertencia de acreditación */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        color: '#92400E',
                        fontSize: '0.79rem',
                        lineHeight: 1.45,
                        fontWeight: 600,
                      }}
                    >
                      <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>{transf.advertenciaAcreditacion}</span>
                    </div>

                    {/* Datos del titular + Cuentas + QR DeUna */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: transf.qrDeunaUrl
                          ? 'repeat(auto-fit, minmax(190px, 1fr))'
                          : '1fr',
                        gap: '12px',
                        alignItems: 'start',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div
                          className="caja-datos-banco"
                          style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}
                        >
                          <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                            Datos para la transferencia
                          </div>
                          <div>
                            <strong>Nombre:</strong> {transf.nombreTitular}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span>
                              <strong>Cédula:</strong> {transf.identificacionTitular}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void copiarTexto('cedula', transf.identificacionTitular)
                              }
                              title="Copiar número de cédula"
                              aria-label="Copiar Cédula"
                              style={{
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '2px 7px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              {datoCopiado === 'cedula' ? <Check size={11} /> : <Copy size={11} />}
                              <span>{datoCopiado === 'cedula' ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div>
                            <strong>Correo:</strong> {transf.correoTitular}
                          </div>
                        </div>

                        {transf.cuentas.map((cta, idx) => (
                          <div
                            key={`${cta.banco}-${idx}`}
                            className="caja-datos-banco"
                            style={{
                              margin: 0,
                              fontSize: '0.8rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <div>
                              <strong style={{ display: 'block', color: '#0F172A' }}>
                                {cta.banco}
                              </strong>
                              <span>
                                {cta.tipoCuenta} <strong>{cta.numeroCuenta}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copiarTexto(`cta-${idx}`, cta.numeroCuenta)}
                              title={`Copiar cuenta ${cta.banco}`}
                              aria-label="Copiar Cuenta"
                              style={{
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {datoCopiado === `cta-${idx}` ? (
                                <Check size={12} />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>{datoCopiado === `cta-${idx}` ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                        ))}
                      </div>

                      {transf.qrDeunaUrl && (
                        <div
                          style={{
                            background: '#3B2045',
                            borderRadius: '12px',
                            padding: '10px',
                            textAlign: 'center',
                            color: '#FFFFFF',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              marginBottom: '6px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            Código QR DeUna
                          </div>
                          <img
                            src={transf.qrDeunaUrl}
                            alt="Código QR DeUna Tinkay"
                            style={{
                              width: '100%',
                              maxWidth: '175px',
                              borderRadius: '8px',
                              display: 'block',
                              margin: '0 auto',
                              background: '#FFFFFF',
                            }}
                          />
                          <small style={{ display: 'block', marginTop: '6px', fontSize: '0.7rem', opacity: 0.92 }}>
                            Escanea desde tu app bancaria o DeUna
                          </small>
                        </div>
                      )}
                    </div>

                    {/* Subida obligatoria de comprobante (imagen o PDF) */}
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: comprobanteSubido ? '#ECFDF5' : '#FFFFFF',
                        border: comprobanteSubido
                          ? '1.5px solid #10B981'
                          : '1.5px dashed #94A3B8',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: '#0F172A',
                          marginBottom: '6px',
                        }}
                      >
                        Adjuntar Comprobante de Pago (Imagen o PDF) *
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <label
                          title="Seleccionar imagen o PDF del comprobante bancario"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: '#2D4734',
                            color: '#FFFFFF',
                            fontSize: '0.79rem',
                            fontWeight: 700,
                            cursor: subiendoComprobante ? 'wait' : 'pointer',
                          }}
                        >
                          {subiendoComprobante ? (
                            <Loader2 size={15} />
                          ) : (
                            <Upload size={15} />
                          )}
                          <span>
                            {subiendoComprobante
                              ? 'Subiendo...'
                              : comprobanteSubido
                              ? 'Cambiar Archivo'
                              : 'Subir Comprobante'}
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            disabled={subiendoComprobante}
                            onChange={handleSubirArchivoComprobante}
                            style={{ display: 'none' }}
                          />
                        </label>

                        {comprobanteSubido && (
                          <span
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#065F46',
                            }}
                          >
                            ✓ {comprobanteSubido.nombreArchivo}
                          </span>
                        )}
                      </div>

                      {comprobanteSubido?.mimeType.startsWith('image/') && (
                        <img
                          src={comprobanteSubido.url}
                          alt="Vista previa del comprobante"
                          style={{
                            marginTop: '8px',
                            maxHeight: '110px',
                            borderRadius: '8px',
                            border: '1px solid #A7F3D0',
                          }}
                        />
                      )}
                    </div>

                    {/* Opción directa para escribir al WhatsApp de la tienda y adjuntar el comprobante */}
                    <a
                      href={urlWhatsappComprobantePrevio}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Escribir a nuestro WhatsApp (${configCheckoutLocal.whatsappTienda}) y adjuntar el comprobante`}
                      aria-label="WhatsApp Comprobante"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        padding: '9px 14px',
                        borderRadius: '9px',
                        border: '1.5px solid #16A34A',
                        background: '#F0FDF4',
                        color: '#15803D',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <MessageCircle size={16} />
                      <span>Enviar por WhatsApp ({configCheckoutLocal.whatsappTienda})</span>
                    </a>
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
                    disabled={subiendoComprobante}
                    className="btn btn-primario btn-confirmar-pago-grande"
                    title={`Confirmar pedido con comprobante adjunto ($${totalPagar.toFixed(2)} USD)`}
                    aria-label="Confirmar Pedido"
                  >
                    <span>Confirmar Pedido (${totalPagar.toFixed(2)})</span>
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
                    {esRetiroEnTienda
                      ? 'Retiro en tienda:'
                      : modalidadEntrega === 'unificada' && entregaUnificada.zonaDetectadaNombre
                      ? `Envío (${entregaUnificada.zonaDetectadaNombre}${
                          configLogistica.mostrarKilometrosCliente !== false &&
                          typeof entregaUnificada.distanciaVialKm === 'number'
                            ? ` · ${entregaUnificada.distanciaVialKm.toFixed(1)} km`
                            : ''
                        }):`
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
                {!esRetiroEnTienda &&
                  modalidadEntrega === 'unificada' &&
                  entregaUnificada.enlaceMapa && (
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
                <span>Total a pagar:</span>
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
