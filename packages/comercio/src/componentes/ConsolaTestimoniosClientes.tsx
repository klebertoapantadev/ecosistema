'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquareHeart,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Camera,
  Star,
  CheckCircle2,
  X,
  Upload,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  obtenerTestimoniosNegocioAction,
  guardarTestimonioAction,
  eliminarTestimonioAction,
  alternarEstadoTestimonioAction,
  type TestimonioDB,
  type DatosGuardarTestimonio,
} from '../acciones-testimonios';
import { subirImagenCatalogoAction } from '../acciones';

interface Props {
  negocio?: string;
  enlaceAlbumGoogleDefecto?: string;
}

const OCASIONES_PREDETERMINADAS = [
  '🌻 Arreglo Especial de Girasoles',
  '🎂 Cumpleaños Sorpresa',
  '🌹 Aniversario de Bodas',
  '🕊️ Arreglo de Condolencias',
  '🎪 Montaje y Decoración de Evento',
  '🎁 Detalle de Agradecimiento',
  '💖 Sorpresa Romántica',
  '💐 Ramos y Bouquets de Rosas',
  '🌿 Decoración de Espacios',
];

export function ConsolaTestimoniosClientes({
  negocio = 'tinkay',
  enlaceAlbumGoogleDefecto = 'https://photos.app.goo.gl/pARRDFJCASyUW4vRA',
}: Props) {
  const [testimonios, setTestimonios] = useState<TestimonioDB[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [testimonioEnEdicion, setTestimonioEnEdicion] = useState<DatosGuardarTestimonio | null>(null);

  // Subida de imagen
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  // Enlace del álbum
  const [enlaceAlbum, setEnlaceAlbum] = useState(enlaceAlbumGoogleDefecto);

  const cargarTestimonios = async () => {
    setCargando(true);
    setMensajeError(null);
    try {
      const res = await obtenerTestimoniosNegocioAction(negocio, false);
      if (res.ok) {
        setTestimonios(res.testimonios);
      } else {
        setMensajeError(res.error || 'Error al cargar testimonios.');
      }
    } catch (e: any) {
      setMensajeError(e.message || 'Error de conexión.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTestimonios();
  }, [negocio]);

  const abrirModalNuevo = () => {
    setTestimonioEnEdicion({
      tes_nombre_cliente: '',
      tes_ciudad: 'Quito',
      tes_ocasion: OCASIONES_PREDETERMINADAS[0] || '🌻 Arreglo Especial de Girasoles',
      tes_comentario: '',
      tes_imagen_url: '',
      tes_calificacion: 5,
      tes_activo: true,
      tes_destacado: true,
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (t: TestimonioDB) => {
    setTestimonioEnEdicion({
      tes_id: t.tes_id,
      tes_nombre_cliente: t.tes_nombre_cliente,
      tes_ciudad: t.tes_ciudad,
      tes_ocasion: t.tes_ocasion,
      tes_comentario: t.tes_comentario,
      tes_imagen_url: t.tes_imagen_url,
      tes_calificacion: t.tes_calificacion,
      tes_activo: t.tes_activo,
      tes_destacado: t.tes_destacado,
      tes_orden: t.tes_orden,
    });
    setModalAbierto(true);
  };

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubiendoFoto(true);
    setMensajeError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('negocio', negocio);
      formData.append('carpeta', 'testimonios');

      const res = await subirImagenCatalogoAction(formData);
      if (res.ok && res.urlPublica) {
        setTestimonioEnEdicion((prev) => (prev ? { ...prev, tes_imagen_url: res.urlPublica! } : null));
        setMensajeExito('Captura subida con éxito.');
        setTimeout(() => setMensajeExito(null), 3500);
      } else {
        setMensajeError(res.error || 'No se pudo subir la imagen.');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error al procesar la captura.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonioEnEdicion) return;

    if (!testimonioEnEdicion.tes_nombre_cliente.trim()) {
      setMensajeError('Por favor ingresa el nombre del cliente.');
      return;
    }
    if (!testimonioEnEdicion.tes_comentario.trim()) {
      setMensajeError('Por favor ingresa el texto del testimonio o extracto del chat.');
      return;
    }
    if (!testimonioEnEdicion.tes_imagen_url.trim()) {
      setMensajeError('Por favor sube una captura o ingresa la URL de la imagen.');
      return;
    }

    setGuardando(true);
    setMensajeError(null);
    try {
      const res = await guardarTestimonioAction(testimonioEnEdicion, negocio);
      if (res.ok) {
        setMensajeExito('Testimonio guardado exitosamente.');
        setModalAbierto(false);
        setTestimonioEnEdicion(null);
        cargarTestimonios();
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setMensajeError(res.error || 'Error al guardar el testimonio.');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el testimonio de "${nombre}"?`)) return;

    try {
      const res = await eliminarTestimonioAction(id, negocio);
      if (res.ok) {
        setTestimonios((prev) => prev.filter((t) => t.tes_id !== id));
        setMensajeExito('Testimonio eliminado.');
        setTimeout(() => setMensajeExito(null), 3000);
      } else {
        setMensajeError(res.error || 'No se pudo eliminar.');
      }
    } catch (e: any) {
      setMensajeError(e.message || 'Error al eliminar.');
    }
  };

  const handleAlternarEstado = async (id: string, estadoActual: boolean) => {
    const nuevoEstado = !estadoActual;
    try {
      const res = await alternarEstadoTestimonioAction(id, nuevoEstado, negocio);
      if (res.ok) {
        setTestimonios((prev) =>
          prev.map((t) => (t.tes_id === id ? { ...t, tes_activo: nuevoEstado } : t))
        );
      } else {
        setMensajeError(res.error || 'No se pudo actualizar el estado.');
      }
    } catch (e: any) {
      setMensajeError(e.message || 'Error al actualizar.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Cabecera del Módulo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          background: '#ffffff',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#D97706',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            <MessageSquareHeart size={16} />
            <span>Social Proof &amp; Conversión Ecommerce</span>
          </div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              color: '#0F172A',
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Testimonios y Capturas de Clientes
          </h1>
          <p style={{ margin: 0, fontSize: '0.92rem', color: '#64748B', maxWidth: '650px' }}>
            Gestiona los screenshots reales de WhatsApp, fotos de entregas y valoraciones visibles en el
            carrusel de la tienda pública y el enlace a tu álbum de Google Photos.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href={enlaceAlbum}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir álbum oficial en Google Photos"
            aria-label="Ver álbum en Google Photos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#F1F5F9',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.84rem',
              textDecoration: 'none',
              border: '1px solid #CBD5E1',
            }}
          >
            <Camera size={16} color="#D97706" />
            <span>Álbum Google Photos</span>
            <ExternalLink size={14} />
          </a>

          <button
            type="button"
            onClick={abrirModalNuevo}
            title="Subir nuevo testimonio o captura de chat"
            aria-label="Agregar nuevo testimonio"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#0F172A',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.86rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
            }}
          >
            <Plus size={18} />
            <span>+ Nueva Captura</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.88rem',
          }}
        >
          <Check size={18} />
          <span>{mensajeExito}</span>
        </div>
      )}
      {mensajeError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.88rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{mensajeError}</span>
        </div>
      )}

      {/* Grid de Testimonios */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748B', fontSize: '0.95rem' }}>
          Cargando testimonios y capturas reales...
        </div>
      ) : testimonios.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px dashed #CBD5E1',
          }}
        >
          <Camera size={44} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#0F172A' }}>
            No hay testimonios registrados
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#64748B' }}>
            Sube tu primera captura de WhatsApp para comenzar a mostrar prueba social en el ecommerce.
          </p>
          <button
            type="button"
            onClick={abrirModalNuevo}
            style={{
              padding: '10px 20px',
              borderRadius: '999px',
              background: '#0F172A',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Subir Primera Captura
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {testimonios.map((t) => (
            <div
              key={t.tes_id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: t.tes_activo ? '1px solid #E2E8F0' : '1px dashed #CBD5E1',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                opacity: t.tes_activo ? 1 : 0.65,
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Marco de Imagen */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '240px',
                  background: '#0F172A',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={t.tes_imagen_url}
                  alt={`Captura de ${t.tes_nombre_cliente}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  {t.tes_ocasion}
                </span>

                <span
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: t.tes_activo ? '#ECFDF5' : '#FEF2F2',
                    color: t.tes_activo ? '#065F46' : '#991B1B',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: t.tes_activo ? '1px solid #A7F3D0' : '1px solid #FECACA',
                  }}
                >
                  {t.tes_activo ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>{t.tes_activo ? 'Público' : 'Oculto'}</span>
                </span>
              </div>

              {/* Contenido */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '2px', color: '#D97706' }}>
                    {[...Array(t.tes_calificacion)].map((_, i) => (
                      <Star key={i} size={15} fill="currentColor" />
                    ))}
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#ECFDF5',
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Verificado</span>
                  </span>
                </div>

                <blockquote
                  style={{
                    margin: 0,
                    fontSize: '0.86rem',
                    lineHeight: 1.5,
                    color: '#334155',
                    fontStyle: 'italic',
                    flex: 1,
                  }}
                >
                  {t.tes_comentario}
                </blockquote>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid #F1F5F9',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0F172A' }}>{t.tes_nombre_cliente}</strong>
                    <span style={{ color: '#94A3B8', margin: '0 4px' }}>•</span>
                    <span style={{ color: '#64748B' }}>{t.tes_ciudad}</span>
                  </div>
                </div>

                {/* Acciones */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    paddingTop: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleAlternarEstado(t.tes_id, t.tes_activo)}
                    title={t.tes_activo ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
                    aria-label="Alternar visibilidad"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      color: '#475569',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {t.tes_activo ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{t.tes_activo ? 'Ocultar' : 'Publicar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirModalEditar(t)}
                    title="Editar información del testimonio"
                    aria-label="Editar testimonio"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#0F172A',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit3 size={13} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEliminar(t.tes_id, t.tes_nombre_cliente)}
                    title="Eliminar testimonio"
                    aria-label="Eliminar testimonio"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Testimonio */}
      {modalAbierto && testimonioEnEdicion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setModalAbierto(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A', fontWeight: 700 }}>
                {testimonioEnEdicion.tes_id ? 'Editar Testimonio' : 'Nueva Captura / Testimonio'}
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '999px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Carga de Imagen */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Captura de Pantalla / Fotografía de Entrega *
                </label>

                {testimonioEnEdicion.tes_imagen_url ? (
                  <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', background: '#0F172A', marginBottom: '8px' }}>
                    <img
                      src={testimonioEnEdicion.tes_imagen_url}
                      alt="Vista previa"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <button
                      type="button"
                      onClick={() => setTestimonioEnEdicion((prev) => prev ? { ...prev, tes_imagen_url: '' } : null)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '999px',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cambiar Foto
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => inputFotoRef.current?.click()}
                    style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '12px',
                      padding: '24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#F8FAFC',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <Upload size={32} color="#64748B" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 600, color: '#0F172A' }}>
                      {subiendoFoto ? 'Subiendo imagen a Supabase Storage...' : 'Haz clic o arrastra tu captura de WhatsApp'}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      Formatos soportados: JPG, PNG o WebP (máx. 10MB)
                    </span>
                  </div>
                )}

                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleSubirArchivo}
                />

                <div style={{ marginTop: '6px' }}>
                  <input
                    type="text"
                    placeholder="O pega una URL directa de imagen (ej. /img/testimonios/...)"
                    value={testimonioEnEdicion.tes_imagen_url}
                    onChange={(e) =>
                      setTestimonioEnEdicion((prev) => (prev ? { ...prev, tes_imagen_url: e.target.value } : null))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Nombre y Ciudad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Angelo Carvajal"
                    value={testimonioEnEdicion.tes_nombre_cliente}
                    onChange={(e) =>
                      setTestimonioEnEdicion((prev) =>
                        prev ? { ...prev, tes_nombre_cliente: e.target.value } : null
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '0.88rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Ciudad / Sector
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Quito Norte, Cumbayá"
                    value={testimonioEnEdicion.tes_ciudad}
                    onChange={(e) =>
                      setTestimonioEnEdicion((prev) => (prev ? { ...prev, tes_ciudad: e.target.value } : null))
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '0.88rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Ocasión */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Ocasión o Tipo de Entrega
                </label>
                <select
                  value={testimonioEnEdicion.tes_ocasion}
                  onChange={(e) =>
                    setTestimonioEnEdicion((prev) => (prev ? { ...prev, tes_ocasion: e.target.value } : null))
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    boxSizing: 'border-box',
                    background: '#fff',
                  }}
                >
                  {OCASIONES_PREDETERMINADAS.map((oc) => (
                    <option key={oc} value={oc}>
                      {oc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comentario / Frase del Chat */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Comentario / Frase Destacada del Chat *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="«El arreglo está muy lindo, le gustó mucho a mi esposa. Muchas gracias por la puntualidad.»"
                  value={testimonioEnEdicion.tes_comentario}
                  onChange={(e) =>
                    setTestimonioEnEdicion((prev) => (prev ? { ...prev, tes_comentario: e.target.value } : null))
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Calificación */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Calificación (Estrellas)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setTestimonioEnEdicion((prev) => (prev ? { ...prev, tes_calificacion: star } : null))
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: star <= testimonioEnEdicion.tes_calificacion ? '#D97706' : '#CBD5E1',
                      }}
                    >
                      <Star size={24} fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes de Estado */}
              <div style={{ display: 'flex', gap: '20px', paddingTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={testimonioEnEdicion.tes_activo}
                    onChange={(e) =>
                      setTestimonioEnEdicion((prev) =>
                        prev ? { ...prev, tes_activo: e.target.checked } : null
                      )
                    }
                  />
                  <span>Mostrar en el carrusel público</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={testimonioEnEdicion.tes_destacado}
                    onChange={(e) =>
                      setTestimonioEnEdicion((prev) =>
                        prev ? { ...prev, tes_destacado: e.target.checked } : null
                      )
                    }
                  />
                  <span>Destacado</span>
                </label>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || subiendoFoto}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                  }}
                >
                  {guardando ? 'Guardando...' : 'Guardar Testimonio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
