'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BotonPagoPlux,
  confirmarOrdenTransferenciaProformaAction,
  descargarArchivoFacturaRideSri,
  eliminarVariacionesProformaClienteAction,
  imprimirFacturaRideSri,
  type ConfiguracionEmisorSri,
  type FacturaElectronicaResumen,
  type ModalidadCobroProforma,
  type PagoPluxConsultado,
  type ProformaEventoPublica,
} from '@eco/comercio';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  MapPin,
  Printer,
  ShieldCheck,
  Store,
  Trash2,
} from 'lucide-react';

interface PropsVistaProformaEventoCliente {
  proformaInicial: ProformaEventoPublica;
  variacionesIniciales: ProformaEventoPublica[];
  bloqueadaPorPagoInicial: boolean;
  ambientePlux: string;
}

export function VistaProformaEventoCliente({
  proformaInicial,
  variacionesIniciales,
  bloqueadaPorPagoInicial,
  ambientePlux,
}: PropsVistaProformaEventoCliente) {
  const router = useRouter();
  const [variaciones, setVariaciones] = useState<ProformaEventoPublica[]>(
    variacionesIniciales.length > 0 ? variacionesIniciales : [proformaInicial]
  );
  const [idSeleccionado, setIdSeleccionado] = useState<string>(proformaInicial.id);
  const [bloqueadaPorPagoGrupo, setBloqueadaPorPagoGrupo] = useState<boolean>(
    bloqueadaPorPagoInicial
  );

  const proformaActiva = useMemo(() => {
    return variaciones.find((v) => v.id === idSeleccionado) ?? variaciones[0] ?? proformaInicial;
  }, [variaciones, idSeleccionado, proformaInicial]);

  const originalRef = useMemo(() => {
    return variaciones.find((v) => v.esOriginal || v.versionNumero === 1) ?? variaciones[0];
  }, [variaciones]);

  const [linkCopiado, setLinkCopiado] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'plux' | 'transferencia'>('plux');
  const [modalidadCobro, setModalidadCobro] = useState<ModalidadCobroProforma>(() => {
    if (proformaActiva.estado === 'RESERVADA_70' && proformaActiva.saldoPendienteUsd > 0.01) {
      return 'SALDO_30';
    }
    return 'RESERVA_70';
  });

  const [datosPagador, setDatosPagador] = useState({
    nombre: proformaInicial.comprador.nombreCompleto || '',
    identificacion:
      proformaInicial.comprador.identificacion &&
      proformaInicial.comprador.identificacion !== '9999999999'
        ? proformaInicial.comprador.identificacion
        : '',
    email: proformaInicial.comprador.correo || '',
    telefono: proformaInicial.comprador.whatsapp || '',
    direccion: proformaInicial.ubicacion.direccion || 'Quito, Ecuador',
  });

  const [notaTransferencia, setNotaTransferencia] = useState('');
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);
  const [facturaEmitidaReciente, setFacturaEmitidaReciente] = useState<{
    factura: FacturaElectronicaResumen;
    emisor?: ConfiguracionEmisorSri | null;
    autorizacion?: string | null;
  } | null>(null);
  const [proformasEliminadasTodas, setProformasEliminadasTodas] = useState(false);

  const seleccionarVariacion = (v: ProformaEventoPublica) => {
    setIdSeleccionado(v.id);
    setMensajeFeedback(null);
    if (v.estado === 'RESERVADA_70' && v.saldoPendienteUsd > 0.01) {
      setModalidadCobro('SALDO_30');
    } else if (modalidadCobro === 'SALDO_30') {
      setModalidadCobro('RESERVA_70');
    }
    if (typeof window !== 'undefined' && v.tokenAprobacion) {
      window.history.replaceState(null, '', `/proforma/${v.tokenAprobacion}`);
    }
  };

  const handleCopiarLink = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/proforma/${proformaActiva.tokenAprobacion}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2200);
    } catch {
      // Ignorar
    }
  };

  const handleEliminarVariaciones = async (modo: 'UNA' | 'OTRAS' | 'TODAS') => {
    if (bloqueadaPorPagoGrupo) return;

    const mensajeConfirm =
      modo === 'TODAS'
        ? '¿Deseas eliminar todas las variaciones y anular esta proforma por completo? Esta acción solo puede hacerse antes de confirmar el pedido o pago.'
        : modo === 'OTRAS'
        ? `¿Deseas eliminar todas las demás variaciones no aceptadas y quedarte únicamente con ${proformaActiva.codigoProforma}?`
        : `¿Deseas descartar y eliminar la variación ${proformaActiva.codigoProforma}?`;

    if (typeof window !== 'undefined' && !window.confirm(mensajeConfirm)) {
      return;
    }

    setProcesandoAccion(true);
    setMensajeFeedback(null);
    const res = await eliminarVariacionesProformaClienteAction({
      tokenAprobacion: proformaActiva.tokenAprobacion,
      modo,
      proformaObjetivoId: proformaActiva.id,
    });
    setProcesandoAccion(false);

    if (!res.ok) {
      setMensajeFeedback({ tipo: 'error', texto: res.error });
      return;
    }

    if (modo === 'TODAS' || !res.tokenRestante) {
      setProformasEliminadasTodas(true);
      return;
    }

    if (modo === 'OTRAS') {
      setVariaciones([proformaActiva]);
      setMensajeFeedback({
        tipo: 'ok',
        texto: `Se eliminaron las variaciones no aceptadas. Conservas únicamente ${proformaActiva.codigoProforma}.`,
      });
      return;
    }

    const restantes = variaciones.filter((v) => v.id !== proformaActiva.id);
    if (restantes.length === 0) {
      setProformasEliminadasTodas(true);
      return;
    }
    setVariaciones(restantes);
    const nuevaActiva =
      restantes.find((r) => r.tokenAprobacion === res.tokenRestante) ?? restantes[0]!;
    seleccionarVariacion(nuevaActiva);
    setMensajeFeedback({
      tipo: 'ok',
      texto: 'Variación descartada correctamente.',
    });
  };

  const handleConfirmarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesandoAccion(true);
    setMensajeFeedback(null);
    const mod = modalidadCobro === 'TOTAL_100' ? 'TOTAL_100' : 'RESERVA_70';
    const res = await confirmarOrdenTransferenciaProformaAction({
      tokenAprobacion: proformaActiva.tokenAprobacion,
      modalidadCobro: mod,
      notaTransferencia,
    });
    setProcesandoAccion(false);

    if (!res.ok) {
      setMensajeFeedback({ tipo: 'error', texto: res.error });
      return;
    }

    setBloqueadaPorPagoGrupo(true);
    setVariaciones((prev) =>
      prev.map((v) =>
        v.id === proformaActiva.id
          ? { ...v, estado: 'ORDEN_CONFIRMADA' }
          : ['ENVIADA', 'PENDIENTE_PAGO'].includes(v.estado)
          ? { ...v, estado: 'NO_ACEPTADA' }
          : v
      )
    );
    setMensajeFeedback({
      tipo: 'ok',
      texto:
        '¡Pedido confirmado! Esta variación quedó aceptada y reservada. Envíanos el comprobante de transferencia por WhatsApp para validar el abono.',
    });
    router.refresh();
  };

  const handlePagoPluxExitoso = (_identificador: string, pago: PagoPluxConsultado) => {
    const montoCobrado =
      modalidadCobro === 'RESERVA_70'
        ? proformaActiva.montoReserva70Usd
        : modalidadCobro === 'SALDO_30'
        ? proformaActiva.saldoPendienteUsd
        : proformaActiva.total;
    const nuevoAbono = Number((proformaActiva.montoAbonadoUsd + montoCobrado).toFixed(2));
    const nuevoSaldo = Math.max(0, Number((proformaActiva.total - nuevoAbono).toFixed(2)));
    const nuevoEstado =
      modalidadCobro === 'RESERVA_70' && nuevoSaldo > 0.02 ? 'RESERVADA_70' : 'APROBADA';

    setBloqueadaPorPagoGrupo(true);
    setVariaciones((prev) =>
      prev.map((v) =>
        v.id === proformaActiva.id
          ? {
              ...v,
              estado: nuevoEstado,
              montoAbonadoUsd: nuevoAbono,
              saldoPendienteUsd: nuevoSaldo,
              ultimoPagoPlux: {
                identificador: _identificador,
                autorizacion: pago.autorizacion || 'APROBADO',
                marca: pago.marcaTarjeta || undefined,
                ultimosDigitos: pago.ultimosDigitos || undefined,
                montoUsd: montoCobrado,
              },
            }
          : ['ENVIADA', 'PENDIENTE_PAGO'].includes(v.estado)
          ? { ...v, estado: 'NO_ACEPTADA' }
          : v
      )
    );
    if (pago.facturaElectronica) {
      setFacturaEmitidaReciente({
        factura: pago.facturaElectronica,
        emisor: pago.emisorFactura || null,
        autorizacion: pago.autorizacion,
      });
    }
    setMensajeFeedback({
      tipo: 'ok',
      texto: `¡Pago aprobado en PLUX! Autorización: ${pago.autorizacion || 'Confirmada'}.${
        pago.facturaElectronica?.numero_comprobante
          ? ` Factura Electrónica N° ${pago.facturaElectronica.numero_comprobante} emitida.`
          : ''
      }`,
    });
    router.refresh();
  };

  if (proformasEliminadasTodas) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#FAF8F5',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            width: '100%',
            padding: '28px',
            borderRadius: '16px',
            background: '#FFFFFF',
            border: '1px solid #E7E5E4',
            textAlign: 'center',
          }}
        >
          <CheckCircle2 size={44} style={{ color: '#2D4734', marginBottom: '10px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: '#1C1917' }}>
            Proformas eliminadas
          </h2>
          <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: '#57534E', lineHeight: 1.5 }}>
            Se han eliminado todas las variaciones de esta solicitud sin generar ningún cargo ni
            pedido. Cuando gustes puedes armar una nueva proforma en nuestro catálogo.
          </p>
          <Link
            href="/"
            title="Volver al catálogo de Tinkay"
            aria-label="Volver a Tinkay"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: '999px',
              background: '#2D4734',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
            }}
          >
            Volver a Tinkay
          </Link>
        </div>
      </main>
    );
  }

  const fechaEmision = new Date(proformaActiva.creadoEn);
  const fechaVencimiento = new Date(fechaEmision.getTime());
  fechaVencimiento.setDate(fechaVencimiento.getDate() + (proformaActiva.vigenciaDias || 15));

  const estaPagadaTotal =
    proformaActiva.estado === 'APROBADA' && proformaActiva.saldoPendienteUsd <= 0.02;
  const tieneReserva70 =
    proformaActiva.estado === 'RESERVADA_70' && proformaActiva.saldoPendienteUsd > 0.02;
  const esNoAceptada = proformaActiva.estado === 'NO_ACEPTADA';

  const importeModalidadActual =
    modalidadCobro === 'RESERVA_70'
      ? proformaActiva.montoReserva70Usd
      : modalidadCobro === 'SALDO_30'
      ? proformaActiva.saldoPendienteUsd
      : proformaActiva.total;

  const urlWhatsappAsesor = `https://wa.me/593991234567?text=${encodeURIComponent(
    `Hola Tinkay, revisé mi proforma de evento ${proformaActiva.codigoProforma} (${proformaActiva.evento.tipoEvento} — $${proformaActiva.total.toFixed(2)}) y deseo conversar con un asesor: ${
      typeof window !== 'undefined' ? window.location.origin : 'https://tinkay-web.vercel.app'
    }/proforma/${proformaActiva.tokenAprobacion}`
  )}`;

  const inputEstilo: React.CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    borderRadius: '8px',
    border: '1px solid #D6D3D1',
    fontSize: '0.86rem',
    color: '#1C1917',
    background: '#FFFFFF',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F6F4EF',
        padding: '24px 16px 60px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1C1917',
      }}
    >
      {/* Reglas nativas para impresión limpia sin barras ni formularios (sin transform en ancestros de PLUX) */}
      <style>{`
        @media print {
          .ocultar-en-impresion { display: none !important; }
          body { background: #FFFFFF !important; }
          .hoja-proforma-imprimible {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '940px', margin: '0 auto' }}>
        {/* Barra Superior de Acciones (Oculta en impresión) */}
        <div
          className="ocultar-en-impresion"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <Link
            href="/"
            title="Volver a la tienda Tinkay"
            aria-label="Tienda Tinkay"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: '#FFFFFF',
              border: '1px solid #D6D3D1',
              color: '#1C1917',
              textDecoration: 'none',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <Store size={15} />
            <span>Tienda</span>
          </Link>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={`/api/proforma/${proformaActiva.tokenAprobacion}/pdf`}
              title="Descargar archivo PDF oficial de esta variación"
              aria-label="Descargar PDF"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                background: '#2D4734',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <Download size={15} />
              <span>Descargar PDF</span>
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              title="Imprimir proforma actual"
              aria-label="Imprimir"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: '1px solid #D6D3D1',
                background: '#FFFFFF',
                color: '#1C1917',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarLink}
              title="Copiar link directo de esta proforma"
              aria-label="Copiar Link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: '1px solid #D6D3D1',
                background: '#FFFFFF',
                color: '#1C1917',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {linkCopiado ? <Check size={15} /> : <Copy size={15} />}
              <span>{linkCopiado ? 'Copiado' : 'Copiar Link'}</span>
            </button>

            <a
              href={urlWhatsappAsesor}
              target="_blank"
              rel="noopener noreferrer"
              title="Hablar con un asesor de eventos para ajustar o actualizar tu proforma"
              aria-label="Asesor WhatsApp"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                background: '#059669',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <span>WhatsApp</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Selector de Variaciones Almacenadas + Gestión / Eliminación por el Cliente */}
        <div
          className="ocultar-en-impresion"
          style={{
            padding: '16px 18px',
            borderRadius: '16px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: '#2D4734' }} />
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#1C1917' }}>
                  Variaciones de tu Proforma ({variaciones.length})
                </strong>
                <span style={{ display: 'block', fontSize: '0.77rem', color: '#57534E' }}>
                  Elige cuál variación deseas aceptar y pagar. Antes de confirmar el pedido o pago
                  puedes eliminar las no aceptadas o todas.
                </span>
              </div>
            </div>

            {/* Acciones de Eliminación (habilitadas únicamente antes de confirmar pedido/pago) */}
            {!bloqueadaPorPagoGrupo && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {variaciones.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={procesandoAccion}
                      onClick={() => handleEliminarVariaciones('UNA')}
                      title="Descartar únicamente esta variación"
                      aria-label="Descartar Esta"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 11px',
                        borderRadius: '8px',
                        border: '1px solid #FECACA',
                        background: '#FFF1F2',
                        color: '#BE123C',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Descartar Esta</span>
                    </button>
                    <button
                      type="button"
                      disabled={procesandoAccion}
                      onClick={() => handleEliminarVariaciones('OTRAS')}
                      title="Eliminar todas las demás variaciones no aceptadas y conservar solo esta"
                      aria-label="Dejar Solo Esta"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 11px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#F8FAFC',
                        color: '#0F172A',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Check size={13} />
                      <span>Dejar Solo Esta</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={procesandoAccion}
                  onClick={() => handleEliminarVariaciones('TODAS')}
                  title="Eliminar todas las variaciones y cancelar esta solicitud de proforma"
                  aria-label="Eliminar Todas"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 11px',
                    borderRadius: '8px',
                    border: '1px solid #FCA5A5',
                    background: '#FEF2F2',
                    color: '#991B1B',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                  <span>Eliminar Todas</span>
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            {variaciones.map((v) => {
              const activa = v.id === proformaActiva.id;
              const diffContraOriginal =
                originalRef && v.id !== originalRef.id
                  ? Number((v.total - originalRef.total).toFixed(2))
                  : 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => seleccionarVariacion(v)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: activa ? '2px solid #2D4734' : '1px solid #E2E8F0',
                    background: activa ? '#F0FDF4' : '#FAFAFA',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: v.esOriginal ? '#E2E8F0' : '#EDE9FE',
                        color: v.esOriginal ? '#1E293B' : '#5B21B6',
                      }}
                    >
                      {v.esOriginal ? `V${v.versionNumero ?? 1} · Original` : `V${v.versionNumero ?? 2} · Asesor`}
                    </span>
                    <strong style={{ fontSize: '0.96rem', color: '#2D4734' }}>
                      ${v.total.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1C1917' }}>
                    {v.codigoProforma}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#57534E', marginTop: '2px' }}>
                    {v.etiquetaVersion}
                  </div>
                  {diffContraOriginal !== 0 && (
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: diffContraOriginal < 0 ? '#15803D' : '#7C3AED',
                      }}
                    >
                      {diffContraOriginal > 0
                        ? `+$${diffContraOriginal.toFixed(2)} vs. original`
                        : `-$${Math.abs(diffContraOriginal).toFixed(2)} vs. original`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {mensajeFeedback && (
          <div
            className="ocultar-en-impresion"
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              background: mensajeFeedback.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${mensajeFeedback.tipo === 'ok' ? '#BBF7D0' : '#FECACA'}`,
              color: mensajeFeedback.tipo === 'ok' ? '#166534' : '#B91C1C',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <div>{mensajeFeedback.texto}</div>
            {facturaEmitidaReciente && mensajeFeedback.tipo === 'ok' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const f = facturaEmitidaReciente.factura;
                    imprimirFacturaRideSri({
                      negocio: 'tinkay',
                      emisor: facturaEmitidaReciente.emisor,
                      numeroComprobante: f.numero_comprobante,
                      claveAcceso: f.clave_acceso,
                      estadoSri: f.estado,
                      ambiente: f.ambiente,
                      fechaEmision: f.fecha_emision,
                      fechaAutorizacion: f.fecha_autorizacion,
                      comprador: {
                        razonSocial:
                          f.comprador?.razon_social || datosPagador.nombre || 'CONSUMIDOR FINAL',
                        identificacion:
                          f.comprador?.identificacion ||
                          datosPagador.identificacion ||
                          '9999999999999',
                        correo: f.comprador?.correo || datosPagador.email,
                        telefono: f.comprador?.telefono || datosPagador.telefono,
                        direccion: f.comprador?.direccion || datosPagador.direccion,
                      },
                      lineas: f.lineas,
                      rubroPrincipal: f.rubro_facturado,
                      codigoRubroPrincipal: f.codigo_rubro,
                      subtotal15: f.subtotal_15,
                      subtotal0: f.subtotal_0,
                      subtotalGeneral: f.subtotal,
                      iva15: f.iva,
                      total: f.total,
                      formaPagoTexto: '19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)',
                      referenciaPago:
                        facturaEmitidaReciente.autorizacion || proformaActiva.codigoProforma,
                    });
                  }}
                  title="Imprimir o guardar en PDF la Factura Electrónica SRI"
                  aria-label="Imprimir Factura"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#166534',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={14} />
                  <span>Imprimir Factura</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const f = facturaEmitidaReciente.factura;
                    descargarArchivoFacturaRideSri({
                      negocio: 'tinkay',
                      emisor: facturaEmitidaReciente.emisor,
                      numeroComprobante: f.numero_comprobante,
                      claveAcceso: f.clave_acceso,
                      estadoSri: f.estado,
                      ambiente: f.ambiente,
                      fechaEmision: f.fecha_emision,
                      fechaAutorizacion: f.fecha_autorizacion,
                      comprador: {
                        razonSocial:
                          f.comprador?.razon_social || datosPagador.nombre || 'CONSUMIDOR FINAL',
                        identificacion:
                          f.comprador?.identificacion ||
                          datosPagador.identificacion ||
                          '9999999999999',
                        correo: f.comprador?.correo || datosPagador.email,
                        telefono: f.comprador?.telefono || datosPagador.telefono,
                        direccion: f.comprador?.direccion || datosPagador.direccion,
                      },
                      lineas: f.lineas,
                      rubroPrincipal: f.rubro_facturado,
                      codigoRubroPrincipal: f.codigo_rubro,
                      subtotal15: f.subtotal_15,
                      subtotal0: f.subtotal_0,
                      subtotalGeneral: f.subtotal,
                      iva15: f.iva,
                      total: f.total,
                      formaPagoTexto: '19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)',
                      referenciaPago:
                        facturaEmitidaReciente.autorizacion || proformaActiva.codigoProforma,
                    });
                  }}
                  title="Descargar comprobante electrónico RIDE"
                  aria-label="Descargar RIDE"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #166534',
                    backgroundColor: '#FFFFFF',
                    color: '#166534',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} />
                  <span>Descargar RIDE</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hoja Principal de Proforma (Imprimible) */}
        <div
          className="hoja-proforma-imprimible"
          style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 10px 30px rgba(28, 25, 23, 0.06)',
            overflow: 'hidden',
            marginBottom: '22px',
          }}
        >
          {/* Membrete Tinkay */}
          <div
            style={{
              background: '#2D4734',
              color: '#FFFFFF',
              padding: '26px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: '#FDE68A',
                  fontWeight: 700,
                }}
              >
                Tinkay Floristería &amp; Eventos · Quito
              </span>
              <h1 style={{ margin: '6px 0 4px', fontSize: '1.5rem', fontWeight: 800 }}>
                Proforma {proformaActiva.codigoProforma}
              </h1>
              <span style={{ fontSize: '0.84rem', color: '#E2E8F0' }}>
                {proformaActiva.etiquetaVersion}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: estaPagadaTotal
                    ? '#DCFCE7'
                    : tieneReserva70
                    ? '#DBEAFE'
                    : proformaActiva.estado === 'ORDEN_CONFIRMADA'
                    ? '#FEF9C3'
                    : esNoAceptada
                    ? '#F1F5F9'
                    : '#FEF3C7',
                  color: estaPagadaTotal
                    ? '#166534'
                    : tieneReserva70
                    ? '#1D4ED8'
                    : proformaActiva.estado === 'ORDEN_CONFIRMADA'
                    ? '#854D0E'
                    : esNoAceptada
                    ? '#64748B'
                    : '#92400E',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  marginBottom: '8px',
                }}
              >
                {estaPagadaTotal
                  ? '✓ PAGADA 100%'
                  : tieneReserva70
                  ? '✓ RESERVA 70% CONFIRMADA'
                  : proformaActiva.estado === 'ORDEN_CONFIRMADA'
                  ? '✓ PEDIDO CONFIRMADO (TRANSFERENCIA)'
                  : esNoAceptada
                  ? 'NO ACEPTADA'
                  : 'VIGENTE PARA APROBACIÓN'}
              </span>
              <div style={{ fontSize: '0.8rem', color: '#E2E8F0' }}>
                Emitida: {fechaEmision.toLocaleDateString('es-EC')}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#FDE68A', fontWeight: 600 }}>
                Válida hasta: {fechaVencimiento.toLocaleDateString('es-EC')}
              </div>
            </div>
          </div>

          <div style={{ padding: '26px 28px' }}>
            {/* Nota del Asesor si existe */}
            {proformaActiva.notaAsesor && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#78350F',
                  marginBottom: '20px',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                }}
              >
                <strong>
                  ✨ Nota de tu Asesor de Eventos
                  {proformaActiva.asesorNombre ? ` (${proformaActiva.asesorNombre})` : ''}:
                </strong>
                <div style={{ marginTop: '4px' }}>{proformaActiva.notaAsesor}</div>
              </div>
            )}

            {/* Resumen Cliente y Evento */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: '#FAF8F5',
                border: '1px solid #E7E5E4',
                marginBottom: '22px',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    color: '#2D4734',
                    marginBottom: '6px',
                  }}
                >
                  Cliente Solicitante
                </strong>
                <div>
                  <strong>{proformaActiva.comprador.nombreCompleto}</strong>
                </div>
                {proformaActiva.comprador.identificacion &&
                  proformaActiva.comprador.identificacion !== '9999999999' && (
                    <div>ID / RUC: {proformaActiva.comprador.identificacion}</div>
                  )}
                <div>Correo: {proformaActiva.comprador.correo}</div>
                <div>WhatsApp: {proformaActiva.comprador.whatsapp}</div>
              </div>

              <div>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    color: '#2D4734',
                    marginBottom: '6px',
                  }}
                >
                  Datos del Evento &amp; Locación
                </strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <Calendar size={14} style={{ color: '#2D4734' }} />
                  <span>
                    {proformaActiva.evento.tipoEvento} · {proformaActiva.evento.fechaEvento || 'Por definir'}
                    {proformaActiva.evento.horaEvento ? ` (${proformaActiva.evento.horaEvento})` : ''}
                  </span>
                </div>
                {proformaActiva.evento.invitadosEstimados && (
                  <div>Invitados estimados: {proformaActiva.evento.invitadosEstimados}</div>
                )}
                {proformaActiva.evento.paletaColores && (
                  <div>Paleta floral: {proformaActiva.evento.paletaColores}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                  <MapPin size={14} style={{ color: '#2D4734', flexShrink: 0 }} />
                  <span>{proformaActiva.ubicacion.direccion}</span>
                </div>
              </div>
            </div>

            {/* Tabla de Ítems */}
            <div style={{ overflowX: 'auto', marginBottom: '22px' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.86rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '2px solid #2D4734',
                      textAlign: 'left',
                      color: '#2D4734',
                      fontSize: '0.76rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '10px 8px' }}>Cant.</th>
                    <th style={{ padding: '10px 8px' }}>Arreglo / Decoración de Evento</th>
                    <th style={{ padding: '10px 8px' }}>IVA</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>P. Unitario</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Línea</th>
                  </tr>
                </thead>
                <tbody>
                  {proformaActiva.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E7E5E4' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 700 }}>{it.cantidad}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {it.imagen && (
                            <img
                              src={it.imagen}
                              alt={it.descripcion}
                              className="ocultar-en-impresion"
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <div>
                            <strong>{it.descripcion}</strong>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: '#57534E' }}>
                        {it.impuesto.includes('15') ? '15%' : '0%'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        ${it.precioUnitario.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>
                        ${it.totalLinea.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Desglose Financiero SRI */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#FAF8F5',
                  border: '1px solid #E7E5E4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.86rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal Tarifa 0%:</span>
                  <span>${proformaActiva.baseIva0.toFixed(2)}</span>
                </div>
                {proformaActiva.baseIvaGravada > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal Gravado 15%:</span>
                    <span>${proformaActiva.baseIvaGravada.toFixed(2)}</span>
                  </div>
                )}
                {proformaActiva.descuento > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B45309', fontWeight: 700 }}>
                    <span>Descuento aplicado:</span>
                    <span>-${proformaActiva.descuento.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Logística / Transporte:</span>
                  <span>
                    {proformaActiva.flete === 0
                      ? 'Incluido ($0.00)'
                      : `$${proformaActiva.flete.toFixed(2)}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IVA (15%):</span>
                  <span>${proformaActiva.iva.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '2px solid #2D4734',
                    paddingTop: '8px',
                    marginTop: '4px',
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: '#2D4734',
                  }}
                >
                  <span>TOTAL PROFORMA:</span>
                  <span>${proformaActiva.total.toFixed(2)} USD</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: '#44403C',
                  }}
                >
                  <span>Reserva de Fecha (70%):</span>
                  <strong>${proformaActiva.montoReserva70Usd.toFixed(2)} USD</strong>
                </div>
                {proformaActiva.montoAbonadoUsd > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803D', fontWeight: 700 }}>
                      <span>Abonado a la fecha:</span>
                      <span>${proformaActiva.montoAbonadoUsd.toFixed(2)} USD</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Saldo pendiente:</span>
                      <span>${proformaActiva.saldoPendienteUsd.toFixed(2)} USD</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Aprobación y Pago en Línea PLUX / Transferencia (Oculta al imprimir) */}
        {!estaPagadaTotal && !esNoAceptada && proformaActiva.estado !== 'ORDEN_CONFIRMADA' && (
          <div
            className="ocultar-en-impresion"
            style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E7E5E4',
              padding: '24px 28px',
              boxShadow: '0 10px 30px rgba(28, 25, 23, 0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1C1917' }}>
                  Aceptar y Reservar {proformaActiva.codigoProforma}
                </h2>
                <span style={{ fontSize: '0.82rem', color: '#57534E' }}>
                  Al confirmar el pago de esta variación quedará fijada para tu evento en Tinkay.
                </span>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#2D4734',
                  background: '#F0FDF4',
                  padding: '6px 12px',
                  borderRadius: '999px',
                }}
              >
                <ShieldCheck size={15} />
                <span>Pasarela Segura PLUX · Tinkay</span>
              </div>
            </div>

            {/* Modalidad de Cobro (70% Reserva vs 100% Total o Liquidación 30%) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              {tieneReserva70 ? (
                <button
                  type="button"
                  onClick={() => setModalidadCobro('SALDO_30')}
                  style={{
                    textAlign: 'left',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '2px solid #2D4734',
                    background: '#F0FDF4',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '0.92rem', color: '#2D4734' }}>
                    Liquidar Saldo Restante (30%) — ${proformaActiva.saldoPendienteUsd.toFixed(2)}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#57534E' }}>
                    Completa el 100% del pago de tu evento reservado.
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setModalidadCobro('RESERVA_70')}
                    style={{
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: '12px',
                      border:
                        modalidadCobro === 'RESERVA_70'
                          ? '2px solid #2D4734'
                          : '1px solid #D6D3D1',
                      background: modalidadCobro === 'RESERVA_70' ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#2D4734' }}>
                      Reservar Evento (70%) — ${proformaActiva.montoReserva70Usd.toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#57534E' }}>
                      Congela tu fecha y flores hoy; el 30% restante se liquida antes del evento.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalidadCobro('TOTAL_100')}
                    style={{
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: '12px',
                      border:
                        modalidadCobro === 'TOTAL_100'
                          ? '2px solid #2D4734'
                          : '1px solid #D6D3D1',
                      background: modalidadCobro === 'TOTAL_100' ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#2D4734' }}>
                      Pago Total (100%) — ${proformaActiva.total.toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#57534E' }}>
                      Deja tu evento pagado en su totalidad en un solo paso.
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Selector Método de Pago */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setMetodoPago('plux')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: metodoPago === 'plux' ? '2px solid #2D4734' : '1px solid #D6D3D1',
                  background: metodoPago === 'plux' ? '#F0FDF4' : '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                <CreditCard size={17} />
                <span>Tarjeta Crédito / Débito (PLUX)</span>
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago('transferencia')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border:
                    metodoPago === 'transferencia' ? '2px solid #2D4734' : '1px solid #D6D3D1',
                  background: metodoPago === 'transferencia' ? '#F0FDF4' : '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                <Building2 size={17} />
                <span>Transferencia Bancaria</span>
              </button>
            </div>

            {metodoPago === 'plux' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                      Razón Social / Nombre Factura *
                    </label>
                    <input
                      type="text"
                      value={datosPagador.nombre}
                      onChange={(e) => setDatosPagador({ ...datosPagador, nombre: e.target.value })}
                      style={inputEstilo}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                      Cédula o RUC *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 1712345678"
                      value={datosPagador.identificacion}
                      onChange={(e) =>
                        setDatosPagador({ ...datosPagador, identificacion: e.target.value })
                      }
                      style={inputEstilo}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                      Correo para Factura SRI *
                    </label>
                    <input
                      type="email"
                      value={datosPagador.email}
                      onChange={(e) => setDatosPagador({ ...datosPagador, email: e.target.value })}
                      style={inputEstilo}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={datosPagador.telefono}
                      onChange={(e) =>
                        setDatosPagador({ ...datosPagador, telefono: e.target.value })
                      }
                      style={inputEstilo}
                    />
                  </div>
                </div>

                {datosPagador.nombre.trim().length >= 2 &&
                datosPagador.identificacion.trim().length >= 5 &&
                datosPagador.email.includes('@') ? (
                  <BotonPagoPlux
                    negocio="tinkay"
                    proformaId={proformaActiva.id}
                    tokenAprobacion={proformaActiva.tokenAprobacion}
                    modalidadCobro={modalidadCobro}
                    ambiente={ambientePlux}
                    pagador={{
                      nombre: datosPagador.nombre.trim(),
                      identificacion: datosPagador.identificacion.trim(),
                      email: datosPagador.email.trim(),
                      telefono: datosPagador.telefono.trim() || '0999999999',
                      direccion: datosPagador.direccion.trim() || 'Quito, Ecuador',
                    }}
                    etiqueta={`Pagar con PLUX — $${importeModalidadActual.toFixed(2)} USD`}
                    alPagoAprobado={handlePagoPluxExitoso}
                  />
                ) : (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      fontSize: '0.82rem',
                    }}
                  >
                    Completa tu Cédula/RUC, Nombre y Correo para habilitar el botón oficial de pago
                    con tarjeta PLUX.
                  </div>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleConfirmarTransferencia}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#FAF8F5',
                    border: '1px solid #E7E5E4',
                    fontSize: '0.84rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Banco Pichincha — Cuenta Corriente N° 2100234567</strong>
                  <br />
                  Titular: Tinkay Floristería Cía. Ltda. · RUC: 1792837465001 · pagos@tinkay.com
                  <br />
                  Importe seleccionado: <strong>${importeModalidadActual.toFixed(2)} USD</strong>
                </div>

                <input
                  type="text"
                  placeholder="Número de comprobante o referencia bancaria (opcional)"
                  value={notaTransferencia}
                  onChange={(e) => setNotaTransferencia(e.target.value)}
                  style={inputEstilo}
                />

                <button
                  type="submit"
                  disabled={procesandoAccion}
                  title="Confirmar pedido con esta variación mediante transferencia"
                  aria-label="Confirmar Pedido"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#2D4734',
                    color: '#FFFFFF',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: procesandoAccion ? 'wait' : 'pointer',
                  }}
                >
                  {procesandoAccion ? <Loader2 size={17} /> : <FileText size={17} />}
                  <span>Confirmar Pedido (${importeModalidadActual.toFixed(2)})</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

