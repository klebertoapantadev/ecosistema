'use client';

import React, { useState } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY, FRASES_DEDICATORIAS } from '../datos-catalogo';
import { VarianteEcommerce, DedicatoriaArreglo } from '../tipos';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Truck,
  ShieldCheck,
  Plus,
  Check,
} from 'lucide-react';

export function ModalDetalleProducto() {
  const {
    productoSeleccionadoModal,
    setProductoSeleccionadoModal,
    agregarItem,
  } = useCarrito();

  const producto = productoSeleccionadoModal;

  const [fotoActivaIndex, setFotoActivaIndex] = useState(0);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteEcommerce>(
    producto?.variantes[0] || {
      sku: '',
      nombre: '',
      pvp: 0,
      baseImponible: 0,
      tarifaIva: 15,
    }
  );

  React.useEffect(() => {
    if (producto && producto.variantes[0]) {
      setVarianteSeleccionada(producto.variantes[0]);
      setFotoActivaIndex(0);
      setComplementosSeleccionados([]);
      setIncluirDedicatoria(false);
      setDedicatoria({ para: '', de: '', mensaje: '' });
    }
  }, [producto]);

  // Estado para la tarjeta de dedicatoria
  const [incluirDedicatoria, setIncluirDedicatoria] = useState(false);
  const [dedicatoria, setDedicatoria] = useState<DedicatoriaArreglo>({
    para: '',
    de: '',
    mensaje: '',
  });

  // Estado para complementos rápidos seleccionados
  const [complementosSeleccionados, setComplementosSeleccionados] = useState<string[]>([]);

  if (!producto) return null;

  const fotos = producto.fotos.length > 0 ? producto.fotos : ['/img/slide4_flores_amor.jpg'];

  const productosComplementos = PRODUCTOS_TINKAY.filter((p) => p.esComplemento);

  const toggleComplemento = (id: string) => {
    setComplementosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const aplicarFrase = (frase: string) => {
    setDedicatoria((prev) => ({ ...prev, mensaje: frase }));
  };

  const handleAgregarAlCarrito = () => {
    // 1. Agregar el arreglo principal con su variante y dedicatoria
    agregarItem(
      producto,
      varianteSeleccionada,
      incluirDedicatoria && dedicatoria.mensaje.trim() ? dedicatoria : undefined
    );

    // 2. Agregar los complementos marcados
    complementosSeleccionados.forEach((compId) => {
      const prodComp = productosComplementos.find((p) => p.id === compId);
      if (prodComp && prodComp.variantes[0]) {
        agregarItem(prodComp, prodComp.variantes[0]);
      }
    });

    // Cerrar modal
    setProductoSeleccionadoModal(null);
  };

  const cambiarFotoActiva = (nuevoIdx: number) => {
    setFotoActivaIndex(nuevoIdx);
    const url = fotos[nuevoIdx];
    const varDirecta =
      producto.variantes.find((v) => v.foto === url) || producto.variantes[nuevoIdx];
    if (varDirecta) {
      setVarianteSeleccionada(varDirecta);
    }
  };

  const seleccionarVariante = (v: VarianteEcommerce) => {
    setVarianteSeleccionada(v);
    if (v.foto) {
      const idx = fotos.indexOf(v.foto);
      if (idx !== -1) {
        setFotoActivaIndex(idx);
        return;
      }
    }
    const vIdx = producto.variantes.findIndex((it) => it.sku === v.sku);
    if (vIdx !== -1 && fotos[vIdx]) {
      setFotoActivaIndex(vIdx);
    }
  };

  return (
    <div className="modal-backdrop-ecommerce" onClick={() => setProductoSeleccionadoModal(null)}>
      <div
        className="modal-contenido-detalle-producto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="btn-cerrar-modal"
          onClick={() => setProductoSeleccionadoModal(null)}
          aria-label="Cerrar ventana de detalle"
        >
          <X size={20} />
        </button>

        <div className="grid-detalle-producto">
          {/* Columna Izquierda: Galería y Carrusel Fotográfico */}
          <div className="columna-galeria-modal">
            <div className="visor-foto-principal">
              <img
                src={fotos[fotoActivaIndex] ?? fotos[0] ?? '/img/slide4_flores_amor.jpg'}
                alt={`${producto.nombre} - Foto ${fotoActivaIndex + 1}`}
                className="imagen-modal-principal"
              />

              {fotos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="flecha-galeria flecha-izq"
                    onClick={() =>
                      cambiarFotoActiva(
                        fotoActivaIndex === 0 ? fotos.length - 1 : fotoActivaIndex - 1
                      )
                    }
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    className="flecha-galeria flecha-der"
                    onClick={() =>
                      cambiarFotoActiva(
                        fotoActivaIndex === fotos.length - 1 ? 0 : fotoActivaIndex + 1
                      )
                    }
                    aria-label="Siguiente foto"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas con Badge de Precio */}
            {fotos.length > 1 && (
              <div className="tira-miniaturas">
                {fotos.map((f, i) => {
                  const varAsoc =
                    producto.variantes.find((v) => v.foto === f) || producto.variantes[i];
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`miniatura-item ${i === fotoActivaIndex ? 'miniatura-activa' : ''}`}
                      onClick={() => cambiarFotoActiva(i)}
                      title={
                        varAsoc
                          ? `${varAsoc.nombre} — $${varAsoc.pvp.toFixed(2)}`
                          : `Foto ${i + 1}`
                      }
                    >
                      <img src={f} alt={`Miniatura ${i + 1}`} />
                      {varAsoc && (
                        <span className="miniatura-badge-precio">
                          ${varAsoc.pvp.toFixed(0)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Garantías de Taller */}
            <div className="garantias-taller-box">
              <div className="garantia-item">
                <Truck size={16} />
                <span>Entrega cuidada en vehículo climatizado de taller</span>
              </div>
              <div className="garantia-item">
                <ShieldCheck size={16} />
                <span>Rosas frescas cortadas menos de 24 horas antes</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Configuración, Variantes y Dedicatoria */}
          <div className="columna-info-modal">
            <div className="cabecera-info-producto">
              <span className="categoria-pill-modal">
                {producto.esCondolencias ? '🕊️ Condolencias Solemnes' : 'Colección Tinkay'}
              </span>
              <h2 className="titulo-modal-producto">{producto.nombre}</h2>
              <div className="fila-precio-modal">
                <span className="precio-pvp-destacado">
                  ${varianteSeleccionada.pvp.toFixed(2)}
                </span>
                {varianteSeleccionada.precioComparacion &&
                  varianteSeleccionada.precioComparacion > varianteSeleccionada.pvp && (
                    <span
                      style={{
                        textDecoration: 'line-through',
                        opacity: 0.55,
                        fontSize: '1.25rem',
                        fontWeight: 500,
                        marginLeft: '8px',
                        color: 'var(--tinta-media)',
                      }}
                    >
                      ${varianteSeleccionada.precioComparacion.toFixed(2)}
                    </span>
                  )}
                <span className="iva-etiqueta-modal">
                  {varianteSeleccionada.tarifaIva > 0
                    ? `PVP (IVA ${varianteSeleccionada.tarifaIva}% incluido)`
                    : 'PVP (Tarifa IVA 0% — Flores Frescas)'}
                </span>
              </div>
            </div>

            <p className="descripcion-larga-modal">{producto.descripcionLarga}</p>

            {/* Receta Botánica (BOM) */}
            {varianteSeleccionada.recetaBom && (
              <div className="caja-receta-bom">
                <Sparkles size={15} className="icono-bom" />
                <div>
                  <strong>Composición Floral (BOM):</strong>
                  <p>{varianteSeleccionada.recetaBom}</p>
                </div>
              </div>
            )}

            {/* Selector de Variantes / Tamaños */}
            <div className="bloque-seleccion-variante">
              <label className="etiqueta-bloque">
                1. Selecciona la Presentación / Tamaño:
              </label>
              <div className="lista-opciones-variante">
                {producto.variantes.map((v, vIdx) => {
                  const fotoVariante = v.foto || fotos[vIdx];
                  return (
                    <button
                      key={v.sku}
                      type="button"
                      className={`opcion-variante-card ${v.sku === varianteSeleccionada.sku ? 'seleccionada' : ''}`}
                      onClick={() => seleccionarVariante(v)}
                    >
                      <div className="contenedor-izq-variante">
                        {fotoVariante && (
                          <img
                            src={fotoVariante}
                            alt={v.nombre}
                            className="mini-foto-variante-selector"
                          />
                        )}
                        <div className="info-variante-texto">
                          <strong>{v.nombre}</strong>
                          {v.detalle && <small>{v.detalle}</small>}
                        </div>
                      </div>
                      <span className="precio-variante-pill">${v.pvp.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tarjeta de Dedicatoria Personalizada Opcional */}
            <div className="bloque-dedicatoria-modal">
              <div className="encabezado-dedicatoria-toggle">
                <label className="etiqueta-check-dedicatoria">
                  <input
                    type="checkbox"
                    checked={incluirDedicatoria}
                    onChange={(e) => setIncluirDedicatoria(e.target.checked)}
                  />
                  <span>2. Agregar Tarjeta de Dedicatoria Impresa (Gratis)</span>
                </label>
              </div>

              {incluirDedicatoria && (
                <div className="formulario-dedicatoria-campos">
                  <div className="fila-de-para">
                    <input
                      type="text"
                      placeholder="Para: (ej. Mi amor, Mamá, Dra. Sofia)"
                      value={dedicatoria.para}
                      onChange={(e) => setDedicatoria({ ...dedicatoria, para: e.target.value })}
                      className="input-dedicatoria"
                    />
                    <input
                      type="text"
                      placeholder="De: (ej. Carlos, Tu admirador)"
                      value={dedicatoria.de}
                      onChange={(e) => setDedicatoria({ ...dedicatoria, de: e.target.value })}
                      className="input-dedicatoria"
                    />
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Escribe el mensaje emotivo que irá impreso en papel verjurado fino..."
                    value={dedicatoria.mensaje}
                    onChange={(e) => setDedicatoria({ ...dedicatoria, mensaje: e.target.value })}
                    className="textarea-dedicatoria"
                  />

                  {/* Sugerencias Rápidas de Frases */}
                  <div className="asistente-frases-rapidas">
                    <span className="etiqueta-frases">Inspiración rápida:</span>
                    <div className="chips-frases">
                      {FRASES_DEDICATORIAS.amor?.[0] && (
                        <button
                          type="button"
                          onClick={() => aplicarFrase(FRASES_DEDICATORIAS.amor![0]!)}
                          className="chip-frase"
                        >
                          ❤️ Amor
                        </button>
                      )}
                      {FRASES_DEDICATORIAS.cumpleanos?.[0] && (
                        <button
                          type="button"
                          onClick={() => aplicarFrase(FRASES_DEDICATORIAS.cumpleanos![0]!)}
                          className="chip-frase"
                        >
                          🎂 Cumpleaños
                        </button>
                      )}
                      {FRASES_DEDICATORIAS.aniversario?.[0] && (
                        <button
                          type="button"
                          onClick={() => aplicarFrase(FRASES_DEDICATORIAS.aniversario![0]!)}
                          className="chip-frase"
                        >
                          💍 Aniversario
                        </button>
                      )}
                      {FRASES_DEDICATORIAS.condolencias?.[0] && (
                        <button
                          type="button"
                          onClick={() => aplicarFrase(FRASES_DEDICATORIAS.condolencias![0]!)}
                          className="chip-frase"
                        >
                          🕊️ Pésame
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Complementos de Cross-Selling */}
            {!producto.esComplemento && productosComplementos.length > 0 && (
              <div className="bloque-complementos-modal">
                <label className="etiqueta-bloque">
                  3. ¿Deseas acompañar tu arreglo con algún detalle?
                </label>
                <div className="grid-complementos-sugeridos">
                  {productosComplementos.map((comp) => {
                    const seleccionado = complementosSeleccionados.includes(comp.id);
                    const varComp = comp.variantes[0];
                    if (!varComp) return null;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        className={`item-complemento-card ${seleccionado ? 'complemento-elegido' : ''}`}
                        onClick={() => toggleComplemento(comp.id)}
                      >
                        <img
                          src={comp.fotos[0] ?? '/img/slide4_flores_amor.jpg'}
                          alt={comp.nombre}
                          className="miniatura-complemento"
                        />
                        <div className="info-comp">
                          <strong>{comp.nombre}</strong>
                          <span>+${varComp.pvp.toFixed(2)}</span>
                        </div>
                        <div className="icono-check-comp">
                          {seleccionado ? <Check size={16} /> : <Plus size={16} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botón Principal de Adición */}
            <div className="fila-botones-modal-accion">
              <button
                type="button"
                className="btn btn-primario btn-agregar-modal-grande"
                onClick={handleAgregarAlCarrito}
              >
                <ShoppingBag size={20} />
                <span>Agregar al Carrito — ${(
                  varianteSeleccionada.pvp +
                  complementosSeleccionados.reduce((acc, cId) => {
                    const c = productosComplementos.find((p) => p.id === cId);
                    return acc + (c?.variantes[0]?.pvp ?? 0);
                  }, 0)
                ).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
