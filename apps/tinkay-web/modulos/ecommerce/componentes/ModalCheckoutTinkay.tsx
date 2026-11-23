'use client';
import { SelectConBuscador } from "@eco/comercio";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BotonPagoPlux,
  SelectorUbicacionEntrega,
  construirUrlWhatsappTienda,
  descargarArchivoFacturaRideSri,
  dispararEventoPixelNavegador,
  imprimirFacturaRideSri,
  leerAtribucionNavegador,
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
  Trash2,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
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
    actualizarCantidad,
    eliminarItem,
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
  const [pasarelaPluxActiva, setPasarelaPluxActiva] = useState<boolean>(
    configTiendaCheckout.tarjetaCreditoHabilitada !== false
  );
  const [metodoPago, setMetodoPago] = useState<'plux' | 'transferencia'>(
    configTiendaCheckout.transferencia?.habilitada === false &&
      configTiendaCheckout.tarjetaCreditoHabilitada !== false
      ? 'plux'
      : 'transferencia'
  );
  const [ambientePlux, setAmbientePlux] = useState<string>('PRUEBAS');
  const [paso, setPaso] = useState<'formulario' | 'procesando' | 'exito'>('formulario');
  const [pasoWizard, setPasoWizard] = useState<1 | 2 | 3 | 4>(1);
  const [codigoOrdenGenerado, setCodigoOrdenGenerado] = useState<string>('');
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [preparandoOrdenPlux, setPreparandoOrdenPlux] = useState<boolean>(false);
  const huellaAutoPluxRef = useRef<string | null>(null);
  const [ordenPluxPreparada, setOrdenPluxPreparada] = useState<{
    id: string;
    codigoOrden: string;
    tokenAprobacion: string;
    respaldoFirmado?: string;
    huella: string;
  } | null>(null);
  const [estadoRegalo, setEstadoRegalo] = useState<EstadoRegaloPrimeraCompra | null>(null);
  const [usuarioRegistradoTinkay, setUsuarioRegistradoTinkay] = useState<boolean>(false);
  const [verificandoEstadoCuenta, setVerificandoEstadoCuenta] = useState<boolean>(true);
  const [omitirInvitacionRegistro, setOmitirInvitacionRegistro] = useState<boolean>(false);
  const [aceptoObsequioBienvenida, setAceptoObsequioBienvenida] = useState<boolean>(true);
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
    incluyoObsequio?: boolean;
    nombreObsequio?: string;
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

  const tarjetaHabilitada =
    pasarelaPluxActiva && configCheckoutLocal.tarjetaCreditoHabilitada !== false;

  useEffect(() => {
    setConfigCheckoutLocal(configTiendaCheckout);
  }, [configTiendaCheckout]);

  useEffect(() => {
    if (!tarjetaHabilitada && metodoPago === 'plux') {
      setMetodoPago('transferencia');
      setOrdenPluxPreparada(null);
    } else if (!configCheckoutLocal.transferencia?.habilitada && tarjetaHabilitada && metodoPago === 'transferencia') {
      setMetodoPago('plux');
    }
  }, [tarjetaHabilitada, configCheckoutLocal.transferencia?.habilitada, metodoPago]);

  useEffect(() => {
    if (!checkoutAbierto) return;
    let cancelado = false;
    setPasoWizard(1);
    setErrorPago(null);
    huellaAutoPluxRef.current = null;
    setVerificandoEstadoCuenta(true);
    setOmitirInvitacionRegistro(false);

    if (typeof window !== 'undefined') {
      const prefGuardada = window.localStorage.getItem('tinkay_obsequio_bienvenida_aceptado');
      setAceptoObsequioBienvenida(prefGuardada !== '0');
    }

    obtenerConfiguracionTiendaCheckoutAction('tinkay')
      .then((cfg) => {
        if (!cancelado && cfg) {
          setConfigCheckoutLocal(cfg);
          if (cfg.tarjetaCreditoHabilitada === false) {
            setPasarelaPluxActiva(false);
            setMetodoPago('transferencia');
            setOrdenPluxPreparada(null);
          }
        }
      })
      .catch(() => {});

    obtenerPasarelasCheckoutAction('tinkay')
      .then((res) => {
        if (cancelado || !res.ok) return;
        const plux = res.data.find((p) => p.pasarela === 'PLUX');
        const habilitada = Boolean(plux);
        setPasarelaPluxActiva(habilitada);
        if (plux?.ambiente) setAmbientePlux(plux.ambiente);
        if (!habilitada) {
          setMetodoPago('transferencia');
          setOrdenPluxPreparada(null);
        }
      })
      .catch(() => {});

    obtenerEmisorRideNegocioAction('tinkay')
      .then((emi) => {
        if (!cancelado && emi) setEmisorNegocio(emi);
      })
      .catch(() => {});

    // Verificar estado de registro en Tinkay + elegibilidad e imagen real del obsequio de bienvenida
    (async () => {
      try {
        const supabase = crearClienteNavegador();
        const [resRegalo, authRes] = await Promise.all([
          obtenerEstadoRegaloPrimeraCompraAction('tinkay').catch(() => null),
          supabase.auth.getUser(),
        ]);

        if (!cancelado && resRegalo) {
          setEstadoRegalo(resRegalo);
        }

        const user = authRes.data?.user;
        if (!user || cancelado) {
          if (!cancelado) {
            setUsuarioRegistradoTinkay(false);
            setVerificandoEstadoCuenta(false);
          }
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
        const tieneMembresia = Boolean(memTinkay || perfilRaw?.usu_superadmin_plataforma);
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
      } finally {
        if (!cancelado) setVerificandoEstadoCuenta(false);
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
    Number(configCheckoutLocal.montoMaximoPagoSinDatosUsd ?? 0)
  );
  const tieneControlMontoFacturacion = umbralSinDatosUsd > 0;
  const esMenorAlUmbral = !tieneControlMontoFacturacion || totalPagar < umbralSinDatosUsd;
  const esRetiroEnTienda =
    modalidadEntrega === 'unificada' && Boolean(entregaUnificada.retiroEnLocal);

  // Reglas de negocio exactas:
  // 1. Únicos requisitos obligatorios para pagar: al menos 1 producto en el carrito y número de WhatsApp para coordinar la entrega.
  // 2. La restricción por monto (`montoMaximoPagoSinDatosUsd`) es configurable: si está en 0, NO se aplica ningún control de datos de factura.
  // 3. Si es > 0 y totalPagar >= umbral, nombre y cédula/RUC son requeridos.
  const requiereDatosFacturacion = tieneControlMontoFacturacion && totalPagar >= umbralSinDatosUsd;
  const mostrarCamposFacturacion = requiereDatosFacturacion || deseaFacturaConDatos;
  const requiereWhatsappCoordinacion = true;

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

  const tieneUbicacionDomicilioConfirmada = Boolean(
    esRetiroEnTienda ||
      modalidadEntrega === 'individual' ||
      (typeof entregaUnificada.costoEnvioCalculado === 'number' &&
        entregaUnificada.dentroCobertura !== false) ||
      (entregaUnificada.direccion && entregaUnificada.direccion.trim().length >= 5)
  );

  const datosObsequio = useMemo(
    () =>
      estadoRegalo?.regalo ?? {
        sku: 'TIN-VAR-4',
        nombre: 'Bombón Ferrero x1 en Esfera Acrílica',
        valorReferencia: 1.5,
        imagenUrl:
          'https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1793008388305-bouquet_rojo_recostado_esferas_ferrero.jpg',
      },
    [estadoRegalo]
  );

  const carritoTieneCondolencias = useMemo(
    () =>
      items.some((it) =>
        Boolean(
          it.producto.esCondolencias ||
            (it.producto.categoriaNombre || '').toLowerCase().includes('condol') ||
            (it.producto.categoriaPrincipal || '').toLowerCase().includes('condol')
        )
      ),
    [items]
  );

  const incluyeExtraObsequio = Boolean(
    !carritoTieneCondolencias &&
      usuarioRegistradoTinkay &&
      estadoRegalo?.aplicaRegalo &&
      aceptoObsequioBienvenida
  );
  const mostrarBannerBeneficioRegistro =
    !carritoTieneCondolencias &&
    !verificandoEstadoCuenta &&
    !usuarioRegistradoTinkay &&
    !omitirInvitacionRegistro;

  useEffect(() => {
    if (!checkoutAbierto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paso !== 'procesando') {
        setCheckoutAbierto(false);
        setPaso('formulario');
        setErrorPago(null);
        setOrdenPluxPreparada(null);
        setComprobanteSubido(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkoutAbierto, paso, setCheckoutAbierto]);

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
        obsequio: incluyeExtraObsequio,
      }),
    [
      datosFactura,
      telefonoNormalizado,
      esRetiroEnTienda,
      totalPagar,
      items.length,
      incluyeExtraObsequio,
    ]
  );

  useEffect(() => {
    if (ordenPluxPreparada && ordenPluxPreparada.huella !== huellaActual) {
      setOrdenPluxPreparada(null);
      huellaAutoPluxRef.current = null;
    }
  }, [huellaActual, ordenPluxPreparada]);

  // Al seleccionar Tarjeta (PLUX) en el paso de Pago, preparar automáticamente la orden
  // para visualizar directamente el botón oficial "Pagar ahora" de PLUX sin pasos intermedios.
  useEffect(() => {
    if (
      !checkoutAbierto ||
      paso !== 'formulario' ||
      verificandoEstadoCuenta ||
      pasoWizard !== 4 ||
      metodoPago !== 'plux' ||
      !tarjetaHabilitada ||
      ordenPluxPreparada ||
      preparandoOrdenPlux ||
      items.length === 0
    ) {
      return;
    }
    if (huellaAutoPluxRef.current === huellaActual) return;
    huellaAutoPluxRef.current = huellaActual;
    void handlePrepararOrdenPlux();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    checkoutAbierto,
    paso,
    verificandoEstadoCuenta,
    pasoWizard,
    metodoPago,
    tarjetaHabilitada,
    ordenPluxPreparada,
    preparandoOrdenPlux,
    huellaActual,
    items.length,
  ]);

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
        : `${entregaUnificada.zonaDetectadaNombre || entregaUnificada.ciudad || 'Domicilio'} — ${entregaUnificada.fechaEntrega} (${entregaUnificada.franjaHoraria})`
      : 'Multidestino individual';

  const construirPayloadPedido = (metodo: 'plux' | 'transferencia') => {
    const usarDatosFactura = mostrarCamposFacturacion;
    const nombreEfectivo = usarDatosFactura ? datosFactura.nombreCompleto.trim() : '';
    const idEfectiva = usarDatosFactura ? datosFactura.identificacion.trim() : '';
    const correoCandidato = datosFactura.correo.trim();
    const correoEfectivo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoCandidato)
      ? correoCandidato
      : '';
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
              colores: entregaUnificada.colores || undefined,
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
      regaloPrimeraCompra: incluyeExtraObsequio ? datosObsequio : null,
      conversacionWebId:
        typeof window !== 'undefined'
          ? window.localStorage.getItem('eco_chat_conv_tinkay') || undefined
          : undefined,
      atribucionPublicitaria:
        typeof window !== 'undefined'
          ? {
              ...leerAtribucionNavegador('tinkay'),
              eventSourceUrl: window.location.href,
            }
          : null,
    };
  };

  const validarPasoActual = (pasoObjetivo: 1 | 2 | 3): string | null => {
    if (items.length === 0) {
      return 'Debes tener al menos un producto en tu carrito para continuar.';
    }
    if (pasoObjetivo === 1) return null;

    if (pasoObjetivo === 2) {
      if (!esRetiroEnTienda && modalidadEntrega === 'unificada' && entregaUnificada.dentroCobertura === false) {
        return 'La ubicación seleccionada está fuera de nuestra cobertura de entrega.';
      }
      return null;
    }

    const digitosTel = telefonoNormalizado.replace(/\D+/g, '');
    if (digitosTel.length < 9) {
      return 'Ingresa tu número de WhatsApp: es obligatorio para coordinar la entrega de tu pedido.';
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

    return null;
  };

  const validarCheckout = (metodo: 'plux' | 'transferencia'): string | null => {
    const errPaso1 = validarPasoActual(1);
    if (errPaso1) return errPaso1;
    const errPaso2 = validarPasoActual(2);
    if (errPaso2) return errPaso2;
    const errPaso3 = validarPasoActual(3);
    if (errPaso3) return errPaso3;

    if (metodo === 'transferencia' && !comprobanteSubido?.url) {
      return 'Debes subir el comprobante de transferencia (imagen o PDF) para confirmar tu pedido.';
    }

    return null;
  };

  const irAlPaso = (destino: 1 | 2 | 3 | 4) => {
    setErrorPago(null);
    if (destino <= pasoWizard) {
      setPasoWizard(destino);
      return;
    }
    for (let p = 1; p < destino; p += 1) {
      const err = validarPasoActual(p as 1 | 2 | 3);
      if (err) {
        setErrorPago(err);
        setPasoWizard(p as 1 | 2 | 3);
        return;
      }
    }
    setPasoWizard(destino);
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
    if (!tarjetaHabilitada) {
      setErrorPago('El procesamiento con tarjeta de crédito/débito está temporalmente deshabilitado.');
      return;
    }
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
      incluyoObsequio: incluyeExtraObsequio,
      nombreObsequio: incluyeExtraObsequio ? datosObsequio.nombre : undefined,
    });
    setCodigoOrdenGenerado(resultado.codigoOrden);
    setPaso('exito');
    vaciarCarrito();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('tinkay_obsequio_bienvenida_aceptado');
      window.dispatchEvent(new CustomEvent('eco:refrescar-notificaciones'));
    }
  };

  const handleCerrar = () => {
    setCheckoutAbierto(false);
    setPaso('formulario');
    setPasoWizard(1);
    setErrorPago(null);
    setOrdenPluxPreparada(null);
    huellaAutoPluxRef.current = null;
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
        aria-label="Caja de pago rápido"
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
              {resumenExito?.incluyoObsequio && (
                <div className="fila-resumen-c">
                  <span>Obsequio de bienvenida:</span>
                  <strong style={{ color: '#059669' }}>
                    1x {resumenExito.nombreObsequio || datosObsequio.nombre} ($0.00)
                  </strong>
                </div>
              )}
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

        {paso === 'formulario' && verificandoEstadoCuenta && (
          <div className="pantalla-procesando-pago">
            <div className="spinner-botanico" />
            <h3>Preparando tu caja de pago...</h3>
            <p>Verificando beneficios de tu cuenta en Tinkay Floristería.</p>
          </div>
        )}

        {paso === 'formulario' && !verificandoEstadoCuenta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="cabecera-checkout" style={{ paddingRight: '38px', marginBottom: '12px' }}>
              <h2>{carritoTieneCondolencias ? 'Confirmación de Pedido' : 'Caja de Pago Rápido'}</h2>
              <div className="sello-seguridad">
                <ShieldCheck size={16} />
                <span>Pago Seguro</span>
              </div>
            </div>

            {/* Indicador de 4 Pasos del Checkout */}
            <nav className="checkout-stepper-pasos" aria-label="Pasos del proceso de pago">
              {(
                [
                  { num: 1, label: 'Pedido' },
                  { num: 2, label: 'Entrega' },
                  { num: 3, label: 'Contacto' },
                  { num: 4, label: 'Pago' },
                ] as const
              ).map((st) => {
                const activo = pasoWizard === st.num;
                const completado = pasoWizard > st.num;
                return (
                  <button
                    key={st.num}
                    type="button"
                    disabled={items.length === 0 && st.num > 1}
                    onClick={() => irAlPaso(st.num)}
                    aria-current={activo ? 'step' : undefined}
                    className={`checkout-step-item ${activo ? 'activo' : ''} ${
                      completado ? 'completado' : ''
                    }`}
                  >
                    <span className="checkout-step-num">
                      {completado ? <Check size={12} /> : st.num}
                    </span>
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </nav>

            <form
              onSubmit={handleConfirmarTransferencia}
              className="form-checkout-flujo"
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {/* ============================================================
                  PASO 1: VISUALIZAR Y EDITAR PRODUCTOS DEL CARRITO
                 ============================================================ */}
              {pasoWizard === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Aviso compacto no bloqueante de beneficio por registro (nunca en Condolencias) */}
                  {mostrarBannerBeneficioRegistro && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: '#F8F7F4',
                        border: '1px solid #E6E2DA',
                        fontSize: '0.8rem',
                        color: '#3A3530',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 220px', minWidth: 0 }}>
                        <Gift size={16} color="var(--verde)" style={{ flexShrink: 0 }} />
                        <span>
                          <strong>¿Primera compra?</strong> Regístrate y recibe{' '}
                          <strong>{datosObsequio.nombre}</strong> ($0.00) + envío gratis en{' '}
                          {configLogistica.zonaGratisNombre || 'Centro-Norte de Quito'}.
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <Link
                          href="/registro?destino=%2F%3Fcheckout%3D1%26obsequio%3D1&obsequio=1"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.localStorage.setItem('tinkay_obsequio_bienvenida_aceptado', '1');
                              document.cookie = `tranqi_destino=${encodeURIComponent(
                                '/?checkout=1&obsequio=1'
                              )}; path=/; max-age=86400`;
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '999px',
                            background: 'var(--verde)',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          Crear cuenta
                        </Link>
                        <Link
                          href="/ingresar?destino=%2F%3Fcheckout%3D1%26obsequio%3D1"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.localStorage.setItem('tinkay_obsequio_bienvenida_aceptado', '1');
                              document.cookie = `tranqi_destino=${encodeURIComponent(
                                '/?checkout=1&obsequio=1'
                              )}; path=/; max-age=86400`;
                            }
                          }}
                          style={{
                            color: 'var(--verde)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          Ingresar
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOmitirInvitacionRegistro(true)}
                          aria-label="Ocultar aviso de registro"
                          title="Ocultar aviso"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#847D74',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {items.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '32px 16px',
                        borderRadius: '14px',
                        background: '#FAF8F5',
                        border: '1px dashed var(--linea)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <ShoppingBag size={30} color="#94A3B8" />
                      <strong style={{ fontSize: '0.96rem', color: 'var(--tinta)' }}>
                        Tu carrito está vacío
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--gris)' }}>
                        Agrega al menos un arreglo floral para continuar con el pago.
                      </p>
                      <button
                        type="button"
                        onClick={handleCerrar}
                        className="btn btn-primario"
                        style={{ marginTop: '4px', padding: '9px 18px', fontSize: '0.84rem' }}
                      >
                        Volver a Tienda
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          background: '#FAF8F5',
                          border: '1px solid #E7E5E4',
                          borderRadius: '14px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <label className="titulo-seccion-form" style={{ marginBottom: 0 }}>
                            1. Revisa y edita tu pedido ({items.reduce((s, it) => s + it.cantidad, 0)})
                          </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {items.map((it) => (
                            <div
                              key={it.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px',
                                borderRadius: '12px',
                                background: '#FFFFFF',
                                border: '1px solid #E7E5E4',
                              }}
                            >
                              <img
                                src={it.producto.fotos[0]}
                                alt={it.producto.nombre}
                                className="foto-mini-resumen"
                                style={{ flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ display: 'block', fontSize: '0.86rem', color: '#1C1917' }}>
                                  {it.producto.nombre}
                                </strong>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#57534E' }}>
                                  {it.variante.nombre} · ${it.variante.pvp.toFixed(2)} c/u
                                </span>
                                {it.dedicatoria?.mensaje && (
                                  <small className="mini-dedicatoria-preview" style={{ display: 'block', marginTop: '2px' }}>
                                    💌 Tarjeta: &quot;{it.dedicatoria.mensaje.slice(0, 40)}&quot;
                                  </small>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '7px' }}>
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      border: '1px solid #D6D3D1',
                                      borderRadius: '999px',
                                      background: '#FAF8F5',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => actualizarCantidad(it.id, it.cantidad - 1)}
                                      title="Disminuir cantidad"
                                      aria-label={`Disminuir cantidad de ${it.producto.nombre}`}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        color: '#1C1917',
                                      }}
                                    >
                                      <Minus size={13} />
                                    </button>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '22px', textAlign: 'center' }}>
                                      {it.cantidad}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => actualizarCantidad(it.id, it.cantidad + 1)}
                                      title="Aumentar cantidad"
                                      aria-label={`Aumentar cantidad de ${it.producto.nombre}`}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        color: '#1C1917',
                                      }}
                                    >
                                      <Plus size={13} />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => eliminarItem(it.id)}
                                    title="Eliminar producto del carrito"
                                    aria-label={`Eliminar ${it.producto.nombre}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 8px',
                                      borderRadius: '8px',
                                      border: '1px solid #FECACA',
                                      background: '#FEF2F2',
                                      color: '#B91C1C',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={12} />
                                    <span>Eliminar</span>
                                  </button>
                                </div>
                              </div>
                              <strong style={{ fontSize: '0.92rem', color: '#1C1917', flexShrink: 0 }}>
                                ${(it.variante.pvp * it.cantidad).toFixed(2)}
                              </strong>
                            </div>
                          ))}

                          {incluyeExtraObsequio && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                borderRadius: '12px',
                                padding: '8px 10px',
                              }}
                            >
                              <img
                                src={datosObsequio.imagenUrl}
                                alt={datosObsequio.nombre}
                                className="foto-mini-resumen"
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ display: 'block', fontSize: '0.82rem', color: '#065F46' }}>
                                  {datosObsequio.nombre}
                                </strong>
                                <span style={{ color: '#047857', fontWeight: 700, fontSize: '0.72rem' }}>
                                  1x Obsequio por registro y primera compra
                                </span>
                              </div>
                              <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.86rem' }}>
                                $0.00
                              </span>
                            </div>
                          )}
                        </div>

                        {usuarioRegistradoTinkay && estadoRegalo?.aplicaRegalo && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              background: incluyeExtraObsequio ? '#ECFDF5' : '#FFFFFF',
                              border: incluyeExtraObsequio ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                              color: incluyeExtraObsequio ? '#065F46' : '#475569',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Gift size={14} style={{ flexShrink: 0 }} />
                              <span>
                                {incluyeExtraObsequio
                                  ? `Obsequio incluido ($0.00): ${datosObsequio.nombre}`
                                  : 'Obsequio de bienvenida disponible sin costo'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const siguiente = !aceptoObsequioBienvenida;
                                setAceptoObsequioBienvenida(siguiente);
                                if (typeof window !== 'undefined') {
                                  window.localStorage.setItem(
                                    'tinkay_obsequio_bienvenida_aceptado',
                                    siguiente ? '1' : '0'
                                  );
                                }
                              }}
                              style={{
                                border: '1px solid currentColor',
                                background: '#FFFFFF',
                                color: 'inherit',
                                borderRadius: '999px',
                                padding: '3px 9px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              {incluyeExtraObsequio ? 'Quitar' : 'Agregar'}
                            </button>
                          </div>
                        )}

                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'rgba(61, 90, 69, 0.06)',
                            border: '1px solid rgba(61, 90, 69, 0.16)',
                            fontSize: '0.8rem',
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
                                : totalFlete > 0
                                ? 'Envío estimado:'
                                : 'Envío:'}
                            </span>
                            <span style={{ color: totalFlete === 0 ? 'var(--verde)' : 'inherit' }}>
                              {totalFlete === 0 ? 'GRATIS ($0.00)' : `+$${totalFlete.toFixed(2)}`}
                            </span>
                          </div>
                          {totalRecargoHorarioExacto > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Horario exacto:</span>
                              <span>+${totalRecargoHorarioExacto.toFixed(2)}</span>
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              marginTop: '4px',
                              paddingTop: '6px',
                              borderTop: '1px solid rgba(61, 90, 69, 0.16)',
                              fontSize: '0.96rem',
                            }}
                          >
                            <strong>Total a pagar:</strong>
                            <strong style={{ color: '#2D4734' }}>${totalPagar.toFixed(2)} USD</strong>
                          </div>
                        </div>
                      </div>

                      <div className="checkout-nav-pasos">
                        <button
                          type="button"
                          onClick={handleCerrar}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: '1px solid var(--linea)',
                            background: '#FFFFFF',
                            color: 'var(--tinta)',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Seguir comprando
                        </button>
                        <button
                          type="button"
                          onClick={() => irAlPaso(2)}
                          className="btn btn-primario"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '11px 20px',
                            borderRadius: '12px',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                          }}
                        >
                          <span>Continuar</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ============================================================
                  PASO 2: MODALIDAD DE ENTREGA
                 ============================================================ */}
              {pasoWizard === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        2. ¿Cómo deseas recibir tu pedido?
                      </label>
                    <div className="grid-toggle-entrega">
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
                                ? 'A) 09:00 - 13:00'
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
                      <div className="grid-form-responsive-2col" style={{ paddingTop: '4px' }}>
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
                            Rango de Horario
                          </label>
                          <SelectConBuscador
                            value={entregaUnificada.franjaHoraria}
                            onChange={(e) =>
                              actualizarEntregaUnificada({
                                franjaHoraria: e.target.value as FranjaHoraria,
                              })
                            }
                            className="input-checkout"
                          >
                            <option value="A) 09:00 - 13:00">A) 09:00 - 13:00</option>
                            <option value="B) 13:00 - 17:00">B) 13:00 - 17:00</option>
                            <option value="C) 17:00 - 20:00">C) 17:00 - 20:00</option>
                          </SelectConBuscador>
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
                              clienteRegistrado={usuarioRegistradoTinkay}
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
                            <div className="grid-form-responsive-2col" style={{ marginTop: '8px' }}>
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
                              <SelectConBuscador
                                value={entregaUnificada.franjaHoraria}
                                onChange={(e) =>
                                  actualizarEntregaUnificada({
                                    franjaHoraria: e.target.value as FranjaHoraria,
                                  })
                                }
                                className="input-checkout"
                              >
                                <option value="A) 09:00 - 13:00">A) 09:00 - 13:00</option>
                                <option value="B) 13:00 - 17:00">B) 13:00 - 17:00</option>
                                <option value="C) 17:00 - 20:00">C) 17:00 - 20:00</option>
                              </SelectConBuscador>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                      }}
                    >
                      {errorPago}
                    </div>
                  )}

                  <div className="checkout-nav-pasos">
                    <button
                      type="button"
                      onClick={() => irAlPaso(1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--linea)',
                        background: '#FFFFFF',
                        color: 'var(--tinta)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ChevronLeft size={15} />
                      <span>Atrás</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => irAlPaso(3)}
                      className="btn btn-primario"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '11px 20px',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>Continuar</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  PASO 3: CONTACTO (WHATSAPP OBLIGATORIO) Y FACTURACIÓN
                 ============================================================ */}
              {pasoWizard === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    className="grupo-campos-checkout"
                    style={{
                      background: '#FAF8F5',
                      border: '1px solid #E7E5E4',
                      borderRadius: '14px',
                      padding: '14px',
                    }}
                  >
                    <label className="titulo-seccion-form">
                      3. Contacto y Facturación
                    </label>

                    {!requiereDatosFacturacion && (
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: '10px',
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          color: '#065F46',
                          fontSize: '0.78rem',
                          lineHeight: 1.45,
                          marginBottom: '10px',
                        }}
                      >
                        <strong>✓ Compra rápida:</strong> Solo necesitamos tu WhatsApp para coordinar la entrega. Los datos de factura son opcionales.
                      </div>
                    )}

                    {/* Campo WhatsApp: Único dato personal obligatorio para coordinar la entrega */}
                    <div style={{ marginBottom: '12px' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.79rem',
                          fontWeight: 700,
                          color: '#1E293B',
                          marginBottom: '4px',
                        }}
                      >
                        Número de WhatsApp *
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '115px 1fr', gap: '8px' }}>
                        <SelectConBuscador
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
                        </SelectConBuscador>
                        <input
                          type="tel"
                          placeholder="99 123 4567"
                          required={requiereWhatsappCoordinacion}
                          value={datosFactura.telefono}
                          onChange={(e) => {
                            setErrorPago(null);
                            setDatosFactura({ ...datosFactura, telefono: e.target.value });
                          }}
                          className="input-checkout"
                        />
                      </div>
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
                    </div>

                    {/* Toggle opcional para Factura con Datos (cuando no hay restricción de monto o es menor al umbral) */}
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

                  {errorPago && (
                    <div
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#B91C1C',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        fontSize: '0.82rem',
                      }}
                    >
                      {errorPago}
                    </div>
                  )}

                  <div className="checkout-nav-pasos">
                    <button
                      type="button"
                      onClick={() => irAlPaso(2)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--linea)',
                        background: '#FFFFFF',
                        color: 'var(--tinta)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ChevronLeft size={15} />
                      <span>Atrás</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => irAlPaso(4)}
                      className="btn btn-primario"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '11px 20px',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>Ir al Pago</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  PASO 4: MÉTODO DE PAGO (TRANSFERENCIA POR DEFECTO / PLUX DIRECTO)
                 ============================================================ */}
              {pasoWizard === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Barra compacta de resumen con acceso rápido a editar pedido */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: '#FAF8F5',
                      border: '1px solid #E7E5E4',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ color: '#1C1917' }}>
                        {items.reduce((s, it) => s + it.cantidad, 0)}{' '}
                        {items.reduce((s, it) => s + it.cantidad, 0) === 1 ? 'producto' : 'productos'} ·{' '}
                        <span style={{ color: '#2D4734' }}>${totalPagar.toFixed(2)} USD</span>
                      </strong>
                      <span style={{ fontSize: '0.73rem', color: '#57534E' }}>
                        {esRetiroEnTienda
                          ? 'Retiro en tienda ($0.00)'
                          : totalFlete > 0
                          ? `Envío incluido (+$${totalFlete.toFixed(2)})`
                          : 'Envío gratis ($0.00)'}{' '}
                        · WhatsApp: {telefonoNormalizado}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => irAlPaso(1)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        border: '1px solid #D6D3D1',
                        background: '#FFFFFF',
                        color: '#1C1917',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Editar pedido
                    </button>
                  </div>

                  {/* Selector de Método de Pago (Transferencia por defecto) */}
                  <div className="pills-metodos-pago" style={{ marginBottom: '2px' }}>
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

                    {tarjetaHabilitada && (
                      <button
                        type="button"
                        className={`btn-metodo-pago ${metodoPago === 'plux' ? 'activo' : ''}`}
                        onClick={() => {
                          setMetodoPago('plux');
                          setErrorPago(null);
                          huellaAutoPluxRef.current = null;
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
                    )}
                  </div>

                {/* Sección según Método de Pago */}
                {!tarjetaHabilitada && !transf.habilitada ? (
                  <div
                    className="grupo-campos-checkout"
                    style={{
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      color: '#92400E',
                      fontSize: '0.84rem',
                    }}
                  >
                    <strong>Coordina el pago directamente con un asesor</strong>
                    <span>
                      Por el momento los medios de pago en línea no están habilitados. Escríbenos por
                      WhatsApp para completar tu pedido de inmediato.
                    </span>
                    <a
                      href={urlWhatsappComprobantePrevio}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Coordinar pago por WhatsApp"
                      aria-label="Pagar por WhatsApp"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        background: '#2F4737',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        fontWeight: 700,
                      }}
                    >
                      <span>Escribir por WhatsApp</span>
                    </a>
                  </div>
                ) : tarjetaHabilitada && metodoPago === 'plux' ? (
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
                      Pago con Tarjeta (PagoPlux)
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

                    {preparandoOrdenPlux ? (
                      <div
                        role="status"
                        aria-live="polite"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '9px',
                          padding: '13px 16px',
                          borderRadius: '12px',
                          background: '#F0FDF4',
                          border: '1px solid #86EFAC',
                          color: '#166534',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                        }}
                      >
                        <Loader2 size={18} className="icono-girar-checkout" />
                        <span>Preparando botón seguro de PLUX…</span>
                      </div>
                    ) : !ordenPluxPreparada ? (
                      <button
                        type="button"
                        onClick={() => {
                          huellaAutoPluxRef.current = huellaActual;
                          void handlePrepararOrdenPlux();
                        }}
                        className="btn btn-primario btn-confirmar-pago-grande"
                        title="Cargar botón oficial de pago con tarjeta PLUX"
                        aria-label="Cargar PLUX"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                      >
                        <Lock size={16} />
                        <span>Cargar botón de PLUX (${totalPagar.toFixed(2)})</span>
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          paddingTop: '2px',
                        }}
                      >
                        <BotonPagoPlux
                          negocio="tinkay"
                          proformaId={ordenPluxPreparada.id}
                          tokenAprobacion={ordenPluxPreparada.tokenAprobacion}
                          respaldoFirmado={ordenPluxPreparada.respaldoFirmado}
                          modalidadCobro="TOTAL_100"
                          ambiente={ambientePlux}
                          autoIniciar
                          autoAbrirModal={false}
                          pagador={{
                            nombre: mostrarCamposFacturacion
                              ? datosFactura.nombreCompleto.trim()
                              : '',
                            identificacion: mostrarCamposFacturacion
                              ? datosFactura.identificacion.trim()
                              : '',
                            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datosFactura.correo.trim())
                              ? datosFactura.correo.trim()
                              : '',
                            telefono: telefonoNormalizado,
                            direccion:
                              (modalidadEntrega === 'unificada' && entregaUnificada.direccion) ||
                              'Quito, Ecuador',
                          }}
                          etiqueta={`Pagar con PLUX ($${totalPagar.toFixed(2)})`}
                          alPagoAprobado={(_identificador: string, pago: PagoPluxConsultado) => {
                            dispararEventoPixelNavegador(
                              'Purchase',
                              {
                                content_ids: items.map((it) => it.variante.sku).filter(Boolean),
                                contents: items.map((it) => ({
                                  id: it.variante.sku,
                                  quantity: it.cantidad,
                                  item_price: it.variante.pvp,
                                  title: it.producto.nombre,
                                })),
                                content_type: 'product',
                                value: totalPagar,
                                currency: 'USD',
                                num_items: items.reduce((acc, it) => acc + it.cantidad, 0),
                              },
                              ordenPluxPreparada.codigoOrden
                            );
                            setResumenExito({
                              totalPagado: totalPagar,
                              entregaTexto: entregaTextoConfirmado,
                              esTransferencia: false,
                              incluyoObsequio: incluyeExtraObsequio,
                              nombreObsequio: incluyeExtraObsequio ? datosObsequio.nombre : undefined,
                              autorizacionPlux: pago.autorizacion,
                              facturaElectronica: pago.facturaElectronica || null,
                              emisorFactura: pago.emisorFactura || emisorNegocio,
                            });
                            setCodigoOrdenGenerado(ordenPluxPreparada.codigoOrden);
                            setPaso('exito');
                            vaciarCarrito();
                            if (typeof window !== 'undefined') {
                              window.localStorage.removeItem('tinkay_obsequio_bienvenida_aceptado');
                              window.dispatchEvent(new CustomEvent('eco:refrescar-notificaciones'));
                            }
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
                      Datos para la Transferencia y QR DeUna
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

                  <div className="checkout-nav-pasos">
                    <button
                      type="button"
                      onClick={() => irAlPaso(3)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--linea)',
                        background: '#FFFFFF',
                        color: 'var(--tinta)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ChevronLeft size={15} />
                      <span>Atrás</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
