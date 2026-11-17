'use client';

import React, { useMemo, useState } from 'react';
import {
  SelectorUbicacionEntrega,
  actualizarProformaEventoClienteAction,
  type ConfiguracionLogisticaNegocio,
} from '@eco/comercio';
import type { ProductoEcommerce } from '../tipos';
import { PRODUCTOS_TINKAY } from '../datos-catalogo';
import {
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

const TIPOS_EVENTO = [
  'Boda / Ceremonia',
  'Bautizo / Primera Comunión',
  'Evento Corporativo / Gala',
  'Cumpleaños / Aniversario',
  'Pedida de Mano / Cena Romántica',
  'Otro Evento Especial',
];

export interface DatosInicialesEdicionProforma {
  id: string;
  codigo: string;
  tokenAprobacion: string;
  evento: {
    tipoEvento: string;
    fechaEvento: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  };
  ubicacion: {
    retiroEnLocal: boolean;
    direccion: string;
    referencia?: string;
    enlaceMapa?: string;
    zonaDetectada?: string;
    distanciaVialKm?: number;
    costoEnvio: number;
  };
  items: Array<{
    productoId?: string;
    sku?: string;
    descripcion: string;
    varianteNombre?: string;
    cantidad: number;
    precioUnitario: number;
    tarifaIva: number;
    imagen?: string;
  }>;
}

interface PropsModalEditarProformaCliente {
  proforma: DatosInicialesEdicionProforma;
  productosCatalogo?: ProductoEcommerce[];
  configLogistica?: ConfiguracionLogisticaNegocio;
  clienteRegistrado?: boolean;
  onCerrar: () => void;
  onGuardadoExitoso: () => void;
}

export function ModalEditarProformaCliente({
  proforma,
  productosCatalogo,
  configLogistica,
  clienteRegistrado = true,
  onCerrar,
  onGuardadoExitoso,
}: PropsModalEditarProformaCliente) {
  const [tipoEvento, setTipoEvento] = useState(proforma.evento.tipoEvento || 'Boda / Ceremonia');
  const [fechaEvento, setFechaEvento] = useState(proforma.evento.fechaEvento || '');
  const [horaEvento, setHoraEvento] = useState(proforma.evento.horaEvento || '16:00');
  const [invitadosEstimados, setInvitadosEstimados] = useState(
    proforma.evento.invitadosEstimados ? String(proforma.evento.invitadosEstimados) : ''
  );
  const [paletaColores, setPaletaColores] = useState(proforma.evento.paletaColores || '');
  const [notasEvento, setNotasEvento] = useState(proforma.evento.notasEvento || '');

  const [retiroEnLocal, setRetiroEnLocal] = useState(Boolean(proforma.ubicacion.retiroEnLocal));
  const [direccion, setDireccion] = useState(proforma.ubicacion.direccion || '');
  const [referencia, setReferencia] = useState(proforma.ubicacion.referencia || '');
  const [enlaceMapa, setEnlaceMapa] = useState(proforma.ubicacion.enlaceMapa || '');
  const [zonaDetectada, setZonaDetectada] = useState(proforma.ubicacion.zonaDetectada || '');
  const [distanciaVialKm, setDistanciaVialKm] = useState<number | undefined>(
    proforma.ubicacion.distanciaVialKm
  );
  const [costoEnvio, setCostoEnvio] = useState<number>(
    Number(proforma.ubicacion.costoEnvio || 0)
  );
  const [mostrarMapa, setMostrarMapa] = useState(false);

  const [items, setItems] = useState(() =>
    proforma.items.map((it, idx) => ({
      uid: `${idx}-${it.sku || it.descripcion}`,
      productoId: it.productoId,
      sku: it.sku,
      descripcion: it.descripcion,
      varianteNombre: it.varianteNombre || '',
      cantidad: Math.max(1, Math.round(Number(it.cantidad) || 1)),
      precioUnitario: Number(it.precioUnitario || 0),
      tarifaIva: Number(it.tarifaIva || 0),
      imagen: it.imagen,
    }))
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const catalogoEventos = useMemo(() => {
    const base =
      productosCatalogo && productosCatalogo.length > 0 ? productosCatalogo : PRODUCTOS_TINKAY;
    return base.filter((p) => {
      if (p.esExtra || p.esComplemento) return false;
      const catP = (p.categoriaPrincipal || '').toLowerCase();
      const catN = (p.categoriaNombre || '').toLowerCase();
      return Boolean(
        p.esEvento === true ||
          catP.includes('evento') ||
          catN.includes('evento') ||
          catN.includes('ceremonia') ||
          (p.tipoOferta || '').toUpperCase() === 'SERVICIO'
      );
    });
  }, [productosCatalogo]);

  const totales = useMemo(() => {
    let subtotalSinIva = 0;
    let iva = 0;
    for (const it of items) {
      const totalLinea = Math.round(it.precioUnitario * it.cantidad * 100) / 100;
      const base =
        it.tarifaIva > 0
          ? Math.round((totalLinea / (1 + it.tarifaIva / 100)) * 100) / 100
          : totalLinea;
      subtotalSinIva += base;
      iva += Math.max(0, Math.round((totalLinea - base) * 100) / 100);
    }
    const flete = retiroEnLocal ? 0 : Math.max(0, costoEnvio);
    const total = Math.round((subtotalSinIva + iva + flete) * 100) / 100;
    const reserva70 = Math.round(total * 0.7 * 100) / 100;
    return {
      subtotal: Math.round(subtotalSinIva * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      flete: Math.round(flete * 100) / 100,
      total,
      reserva70,
    };
  }, [items, retiroEnLocal, costoEnvio]);

  const cambiarCantidad = (uid: string, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      if (items.length <= 1) {
        setError('Tu proforma debe conservar al menos un elemento.');
        return;
      }
      setError(null);
      setItems((prev) => prev.filter((x) => x.uid !== uid));
      return;
    }
    setError(null);
    setItems((prev) =>
      prev.map((x) => (x.uid === uid ? { ...x, cantidad: nuevaCantidad } : x))
    );
  };

  const agregarProductoCatalogo = (prod: ProductoEcommerce) => {
    const varBase = prod.variantes[0];
    if (!varBase) return;
    setError(null);
    setItems((prev) => {
      const idx = prev.findIndex(
        (x) => (x.sku && x.sku === varBase.sku) || x.descripcion === prod.nombre
      );
      if (idx >= 0) {
        return prev.map((x, i) => (i === idx ? { ...x, cantidad: x.cantidad + 1 } : x));
      }
      return [
        ...prev,
        {
          uid: `add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productoId: prod.proIdUuid || prod.id,
          sku: varBase.sku,
          descripcion: prod.nombre,
          varianteNombre: varBase.nombre !== prod.nombre ? varBase.nombre : '',
          cantidad: 1,
          precioUnitario: varBase.pvp,
          tarifaIva: varBase.tarifaIva,
          imagen: prod.fotos[0],
        },
      ];
    });
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (items.length === 0) {
      setError('Agrega al menos un elemento a la proforma.');
      return;
    }
    if (!fechaEvento) {
      setError('Selecciona la fecha estimada del evento.');
      return;
    }

    setGuardando(true);
    try {
      const res = await actualizarProformaEventoClienteAction({
        negocio: 'tinkay',
        proformaId: proforma.id,
        tokenAprobacion: proforma.tokenAprobacion,
        evento: {
          tipoEvento,
          fechaEvento,
          horaEvento: horaEvento || undefined,
          invitadosEstimados: invitadosEstimados ? Number(invitadosEstimados) : undefined,
          paletaColores: paletaColores || undefined,
          notasEvento: notasEvento || undefined,
        },
        ubicacion: {
          retiroEnLocal,
          direccion: retiroEnLocal
            ? 'Retiro en Tienda Física Tinkay'
            : direccion || 'Locación en Quito / Valles (por confirmar)',
          referencia,
          enlaceMapa: enlaceMapa || undefined,
          zonaDetectada: zonaDetectada || undefined,
          distanciaVialKm,
          costoEnvio: retiroEnLocal ? 0 : costoEnvio,
        },
        items: items.map((it) => ({
          productoId: it.productoId,
          sku: it.sku,
          descripcion: it.descripcion,
          varianteNombre: it.varianteNombre || undefined,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          tarifaIva: it.tarifaIva,
          imagen: it.imagen,
        })),
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setExito(true);
      setTimeout(() => {
        onGuardadoExitoso();
      }, 650);
    } catch {
      setError('No se pudo actualizar la proforma. Intenta nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const estiloCampo: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(34, 29, 26, 0.18)',
    background: '#FFFFFF',
    color: '#221D1A',
    fontSize: '0.86rem',
    fontFamily: 'inherit',
  };

  const estiloEtiqueta: React.CSSProperties = {
    display: 'block',
    fontSize: '0.76rem',
    fontWeight: 700,
    color: '#3D5A45',
    marginBottom: '4px',
  };

  return (
    <div
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Editar proforma ${proforma.codigo}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(22, 28, 24, 0.58)',
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
          width: 'min(760px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#FAF7F0',
          borderRadius: '20px',
          border: '1px solid rgba(34, 29, 26, 0.14)',
          boxShadow: '0 24px 48px rgba(22, 28, 24, 0.25)',
          padding: 'clamp(18px, 3.5vw, 28px)',
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
            gap: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(34, 29, 26, 0.1)',
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#3D5A45',
                marginBottom: '4px',
              }}
            >
              <Sparkles size={13} />
              <span>Edición de Proforma de Evento</span>
            </span>
            <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#221D1A' }}>
              {proforma.codigo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ventana de edición"
            aria-label="Cerrar"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              border: '1px solid rgba(34, 29, 26, 0.15)',
              background: '#FFFFFF',
              color: '#221D1A',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleGuardar}
          style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
        >
          {/* 1. Elementos de la Proforma */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid rgba(34, 29, 26, 0.1)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <strong style={{ fontSize: '0.88rem', color: '#221D1A' }}>
              1. Arreglos y Montajes Cotizados ({items.length})
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((it) => (
                <div
                  key={it.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '11px',
                    background: '#FDFBF7',
                    border: '1px solid #EFECE6',
                  }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#221D1A' }}>
                      {it.descripcion}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#6B746C' }}>
                      {it.varianteNombre ? `${it.varianteNombre} · ` : ''}$
                      {it.precioUnitario.toFixed(2)} c/u
                    </div>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        border: '1px solid rgba(34, 29, 26, 0.16)',
                        background: '#FFFFFF',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(it.uid, it.cantidad - 1)}
                        title="Disminuir cantidad"
                        aria-label="Disminuir cantidad"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: '#221D1A',
                        }}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                        {it.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(it.uid, it.cantidad + 1)}
                        title="Aumentar cantidad"
                        aria-label="Aumentar cantidad"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: '#221D1A',
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <strong style={{ fontSize: '0.88rem', color: '#221D1A', minWidth: '64px', textAlign: 'right' }}>
                      ${(it.precioUnitario * it.cantidad).toFixed(2)}
                    </strong>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(it.uid, 0)}
                        title="Quitar elemento de la proforma"
                        aria-label="Quitar"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#BE123C',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {catalogoEventos.length > 0 && (
              <div style={{ paddingTop: '6px' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B746C', marginBottom: '6px' }}>
                  + Agregar más elementos de eventos:
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                  }}
                >
                  {catalogoEventos.slice(0, 8).map((p) => {
                    const v0 = p.variantes[0];
                    if (!v0) return null;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => agregarProductoCatalogo(p)}
                        title={`Agregar ${p.nombre} ($${v0.pvp.toFixed(2)})`}
                        aria-label={`Agregar ${p.nombre}`}
                        style={{
                          flex: '0 0 auto',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          borderRadius: '999px',
                          border: '1px solid rgba(61, 90, 69, 0.28)',
                          background: '#F5F9F6',
                          color: '#2D4734',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={12} />
                        <span>
                          {p.nombre} (${v0.pvp.toFixed(0)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Datos del Evento */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid rgba(34, 29, 26, 0.1)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="#3D5A45" />
              <strong style={{ fontSize: '0.88rem', color: '#221D1A' }}>
                2. Detalles de tu Evento
              </strong>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '10px',
              }}
            >
              <div>
                <label style={estiloEtiqueta}>Tipo de evento</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  style={estiloCampo}
                >
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={estiloEtiqueta}>Fecha del evento</label>
                <input
                  type="date"
                  value={fechaEvento}
                  onChange={(e) => setFechaEvento(e.target.value)}
                  required
                  style={estiloCampo}
                />
              </div>
              <div>
                <label style={estiloEtiqueta}>Hora estimada</label>
                <input
                  type="time"
                  value={horaEvento}
                  onChange={(e) => setHoraEvento(e.target.value)}
                  style={estiloCampo}
                />
              </div>
              <div>
                <label style={estiloEtiqueta}>Invitados aprox.</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej. 80"
                  value={invitadosEstimados}
                  onChange={(e) => setInvitadosEstimados(e.target.value)}
                  style={estiloCampo}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
              }}
            >
              <div>
                <label style={estiloEtiqueta}>Paleta de colores preferida</label>
                <input
                  type="text"
                  placeholder="Ej. Blanco marfil, verde olivo y dorado"
                  value={paletaColores}
                  onChange={(e) => setPaletaColores(e.target.value)}
                  style={estiloCampo}
                />
              </div>
              <div>
                <label style={estiloEtiqueta}>Notas especiales para floristas</label>
                <input
                  type="text"
                  placeholder="Detalles de salón, montaje o temática..."
                  value={notasEvento}
                  onChange={(e) => setNotasEvento(e.target.value)}
                  style={estiloCampo}
                />
              </div>
            </div>
          </div>

          {/* 3. Locación y Transporte */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid rgba(34, 29, 26, 0.1)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} color="#3D5A45" />
                <strong style={{ fontSize: '0.88rem', color: '#221D1A' }}>
                  3. Locación del Evento
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setMostrarMapa((v) => !v)}
                title="Cotizar o actualizar ubicación con mapa GPS"
                aria-label="Seleccionar Mapa"
                style={{
                  padding: '5px 11px',
                  borderRadius: '999px',
                  border: '1px solid #3D5A45',
                  background: mostrarMapa ? '#3D5A45' : '#FFFFFF',
                  color: mostrarMapa ? '#FFFFFF' : '#3D5A45',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {mostrarMapa ? 'Ocultar Mapa' : 'Actualizar GPS'}
              </button>
            </div>

            {mostrarMapa && (
              <SelectorUbicacionEntrega
                negocio="tinkay"
                configuracionInicial={configLogistica}
                clienteRegistrado={clienteRegistrado}
                permitirModoRetiro={true}
                retiroEnLocal={retiroEnLocal}
                enlaceMapaInicial={enlaceMapa}
                onCambioCotizacion={(ev) => {
                  setRetiroEnLocal(ev.retiroEnLocal);
                  setEnlaceMapa(ev.enlaceMapa);
                  setZonaDetectada(ev.cotizacion.zonaDetectada?.nombre || '');
                  setDistanciaVialKm(ev.cotizacion.distanciaVialKm);
                  setCostoEnvio(ev.cotizacion.costoTotalEnvio);
                  if (ev.direccionSugerida) {
                    setDireccion(ev.direccionSugerida);
                  }
                }}
              />
            )}

            {!retiroEnLocal && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                }}
              >
                <div>
                  <label style={estiloEtiqueta}>Dirección / Quinta / Salón</label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej. Hacienda La María, Cumbayá"
                    style={estiloCampo}
                  />
                </div>
                <div>
                  <label style={estiloEtiqueta}>Referencia</label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Salón principal / contacto en sitio"
                    style={estiloCampo}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Resumen actualizado */}
          <div
            style={{
              background: '#2D4334',
              color: '#FFFFFF',
              borderRadius: '14px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.78)' }}>
                Subtotal ${totales.subtotal.toFixed(2)} · IVA ${totales.iva.toFixed(2)} · Envío $
                {totales.flete.toFixed(2)}
              </span>
              <strong style={{ fontSize: '1.15rem' }}>
                Total Proforma: ${totales.total.toFixed(2)} USD
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#FDE68A', fontWeight: 600 }}>
                Reserva 70%: ${totales.reserva70.toFixed(2)} USD
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onCerrar}
                title="Cancelar sin guardar cambios"
                aria-label="Cancelar"
                style={{
                  padding: '10px 16px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: 'transparent',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || exito}
                title="Guardar los cambios realizados en tu proforma"
                aria-label="Guardar Proforma"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '10px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  background: exito ? '#16A34A' : '#EC7FA7',
                  color: '#FFFFFF',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  cursor: guardando ? 'wait' : 'pointer',
                }}
              >
                {guardando ? (
                  <Loader2 size={16} />
                ) : exito ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Save size={16} />
                )}
                <span>{exito ? '¡Actualizada!' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
