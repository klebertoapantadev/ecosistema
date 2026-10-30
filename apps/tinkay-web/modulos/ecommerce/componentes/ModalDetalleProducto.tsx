'use client';

import React, { useState } from 'react';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY, FRASES_DEDICATORIAS } from '../datos-catalogo';
import { ProductoEcommerce, VarianteEcommerce, DedicatoriaArreglo } from '../tipos';
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
  Eye,
} from 'lucide-react';

export function ModalDetalleProducto() {
  const {
    productoSeleccionadoModal,
    setProductoSeleccionadoModal,
    agregarItem,
    productos,
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
  // Estado para variantes específicas elegidas de complementos (ej. color cinta)
  const [variantesExtrasElegidas, setVariantesExtrasElegidas] = useState<Record<string, VarianteEcommerce>>({});
  // Estado para inspección en foto grande y detalles de un extra
  const [extraParaInspeccionar, setExtraParaInspeccionar] = useState<ProductoEcommerce | null>(null);
  const [varianteExtraInspeccion, setVarianteExtraInspeccion] = useState<VarianteEcommerce | null>(null);
  const [fotoExtraActivaIdx, setFotoExtraActivaIdx] = useState(0);

  // Detectar si el producto actual es de Condolencias & Funerarios
  const esProductoCondolencias = React.useMemo(() => {
    if (!producto) return false;
    const catPrincipal = (producto.categoriaPrincipal || '').toLowerCase();
    const catNombre = (producto.categoriaNombre || '').toLowerCase();
    const secundarias = (producto.categoriasSecundarias || []).map((s: string) => s.toLowerCase());
    const etiquetas = (producto.etiquetas || []).map((e: string) => e.toLowerCase());
    const usos = (producto.usos || []).map((u: string) => u.toLowerCase());
    const nombre = (producto.nombre || '').toLowerCase();

    return (
      producto.esCondolencias === true ||
      catPrincipal.includes('condol') ||
      catNombre.includes('condol') ||
      secundarias.some((s: string) => s.includes('condol')) ||
      nombre.includes('pedestal') ||
      nombre.includes('abanico') ||
      nombre.includes('condolencia') ||
      nombre.includes('pésame') ||
      usos.some((u: string) => u.includes('condol') || u.includes('duelo') || u.includes('pesame')) ||
      etiquetas.some((e: string) => e.includes('condol') || e.includes('duelo') || e.includes('fúnebre') || e.includes('funebre'))
    );
  }, [producto]);

  // Helper para verificar si un producto Extra tiene uso "Condolencias"
  const tieneUsoCondolencias = (extra: ProductoEcommerce) => {
    const usos = (extra.usos || []).map((u: string) => u.toLowerCase());
    const nombre = (extra.nombre || '').toLowerCase();
    const slug = (extra.slug || '').toLowerCase();
    const catPrincipal = (extra.categoriaPrincipal || '').toLowerCase();
    const catNombre = (extra.categoriaNombre || '').toLowerCase();
    const etiquetas = (extra.etiquetas || []).map((e: string) => e.toLowerCase());

    return (
      usos.some((u: string) => u.includes('condol') || u.includes('duelo') || u.includes('pesame')) ||
      nombre.includes('condolencia') ||
      nombre.includes('pésame') ||
      nombre.includes('cinta') ||
      slug.includes('condol') ||
      slug.includes('cinta') ||
      catPrincipal.includes('condol') ||
      catNombre.includes('condol') ||
      etiquetas.some((e: string) => e.includes('condol') || e.includes('duelo') || e.includes('fúnebre'))
    );
  };

  // Filtrar productos de categorías Extras según la regla de venta cruzada
  const productosComplementos = React.useMemo(() => {
    if (!producto || producto.esComplemento || producto.esExtra) return [];

    const catalogo = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
    const extras = catalogo.filter((p) => {
      const catPrincipal = (p.categoriaPrincipal || '').toLowerCase();
      const catNombre = (p.categoriaNombre || '').toLowerCase();
      return (
        p.esExtra === true ||
        p.esComplemento === true ||
        catPrincipal.includes('extra') ||
        catNombre.includes('extra')
      );
    });

    if (esProductoCondolencias) {
      // Condolencias & Funerarios: presenta Extras con uso "Condolencias"
      return extras.filter((extra) => tieneUsoCondolencias(extra));
    } else {
      // Resto de productos: presenta Extras con uso DIFERENTE de "Condolencias"
      return extras.filter((extra) => !tieneUsoCondolencias(extra));
    }
  }, [producto, esProductoCondolencias, productos]);

  const toggleComplemento = (id: string) => {
    setComplementosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const abrirInspeccionExtra = (extra: ProductoEcommerce, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExtraParaInspeccionar(extra);
    const elegidaPrevia = variantesExtrasElegidas[extra.id];
    const def = elegidaPrevia || obtenerVarianteComplemento(extra) || extra.variantes[0] || null;
    setVarianteExtraInspeccion(def);
    setFotoExtraActivaIdx(0);
  };

  const cerrarInspeccionExtra = () => {
    setExtraParaInspeccionar(null);
  };

  const seleccionarVarianteExtraInspeccion = (v: VarianteEcommerce) => {
    setVarianteExtraInspeccion(v);
    if (extraParaInspeccionar) {
      setVariantesExtrasElegidas((prev) => ({ ...prev, [extraParaInspeccionar.id]: v }));
      if (v.foto && extraParaInspeccionar.fotos.includes(v.foto)) {
        const fIdx = extraParaInspeccionar.fotos.indexOf(v.foto);
        if (fIdx !== -1) setFotoExtraActivaIdx(fIdx);
      }
    }
  };

  const confirmarAgregarExtraDesdeInspeccion = (extra: ProductoEcommerce) => {
    if (!complementosSeleccionados.includes(extra.id)) {
      setComplementosSeleccionados((prev) => [...prev, extra.id]);
    }
    if (varianteExtraInspeccion) {
      setVariantesExtrasElegidas((prev) => ({ ...prev, [extra.id]: varianteExtraInspeccion }));
    }
    cerrarInspeccionExtra();
  };

  const confirmarQuitarExtraDesdeInspeccion = (extra: ProductoEcommerce) => {
    setComplementosSeleccionados((prev) => prev.filter((id) => id !== extra.id));
    cerrarInspeccionExtra();
  };

  const aplicarFrase = (frase: string) => {
    setDedicatoria((prev) => ({ ...prev, mensaje: frase }));
  };

  const obtenerVarianteComplemento = (comp: ProductoEcommerce) => {
    return (
      comp.variantes.find((v: VarianteEcommerce) => v.nombre.toLowerCase().includes('cinta')) ||
      comp.variantes.find((v: VarianteEcommerce) => v.pvp > 0) ||
      comp.variantes[0]
    );
  };

  const handleAgregarAlCarrito = () => {
    if (!producto) return;

    // 1. Agregar el arreglo principal con su variante y dedicatoria
    agregarItem(
      producto,
      varianteSeleccionada,
      incluirDedicatoria && dedicatoria.mensaje.trim() ? dedicatoria : undefined
    );

    // 2. Agregar los complementos marcados con su variante elegida
    complementosSeleccionados.forEach((compId) => {
      const prodComp = productosComplementos.find((p) => p.id === compId);
      if (prodComp) {
        const varComp = variantesExtrasElegidas[compId] || obtenerVarianteComplemento(prodComp);
        if (varComp) {
          agregarItem(prodComp, varComp);
        }
      }
    });

    // Cerrar modal
    setProductoSeleccionadoModal(null);
  };

  if (!producto) return null;

  const fotos =
    producto.fotos && producto.fotos.length > 0 ? producto.fotos : ['/img/slide4_flores_amor.jpg'];

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
            {!producto.esComplemento && !producto.esExtra && productosComplementos.length > 0 && (
              <div className="bloque-complementos-modal">
                <div className="encabezado-seccion-complementos">
                  <label className="etiqueta-bloque">
                    3. ¿Deseas acompañar tu arreglo con algún detalle?
                  </label>
                  <span className="subtitulo-seccion-complementos">
                    Haz clic en cualquier producto para ver su fotografía ampliada y detalles completos antes de agregarlo.
                  </span>
                </div>

                <div className="grid-complementos-sugeridos">
                  {productosComplementos.map((comp) => {
                    const seleccionado = complementosSeleccionados.includes(comp.id);
                    const varComp = variantesExtrasElegidas[comp.id] || obtenerVarianteComplemento(comp);
                    if (!varComp) return null;
                    return (
                      <div
                        key={comp.id}
                        className={`item-complemento-card ${seleccionado ? 'complemento-elegido' : ''}`}
                        onClick={() => abrirInspeccionExtra(comp)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            abrirInspeccionExtra(comp);
                          }
                        }}
                      >
                        <div className="contenedor-foto-complemento">
                          <img
                            src={comp.fotos[0] ?? '/img/slide4_flores_amor.jpg'}
                            alt={comp.nombre}
                            className="miniatura-complemento"
                          />
                          <span className="badge-lupa-extra">
                            <Eye size={13} />
                            <span>Ver foto</span>
                          </span>
                        </div>

                        <div className="info-comp">
                          <strong>{comp.nombre}</strong>
                          <span className="precio-comp">+${varComp.pvp.toFixed(2)}</span>
                          {varComp.nombre && varComp.nombre !== comp.nombre && (
                            <small className="variante-elegida-tag" title={varComp.nombre}>
                              {varComp.nombre.replace(/Cinta condolencias personalizada/gi, '').trim() || varComp.nombre}
                            </small>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn-ver-detalle-comp"
                          onClick={(e) => abrirInspeccionExtra(comp, e)}
                          title="Ver foto grande e información"
                        >
                          <Eye size={12} />
                          <span>Ver detalle</span>
                        </button>

                        <button
                          type="button"
                          className="icono-check-comp"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComplemento(comp.id);
                          }}
                          title={seleccionado ? 'Quitar este detalle' : 'Agregar este detalle'}
                          aria-label={seleccionado ? 'Quitar este detalle' : 'Agregar este detalle'}
                        >
                          {seleccionado ? <Check size={16} /> : <Plus size={16} />}
                        </button>
                      </div>
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
                    const varC = c ? (variantesExtrasElegidas[cId] || obtenerVarianteComplemento(c)) : null;
                    return acc + (varC?.pvp ?? 0);
                  }, 0)
                ).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Diálogo de Vista Previa y Foto Grande del Extra */}
      {extraParaInspeccionar && (
        <div
          className="modal-backdrop-preview-extra"
          onClick={cerrarInspeccionExtra}
        >
          <div
            className="modal-card-preview-extra"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="btn-cerrar-preview-extra"
              onClick={cerrarInspeccionExtra}
              aria-label="Cerrar vista previa del producto"
            >
              <X size={18} />
            </button>

            {/* Visor de Foto Grande del Extra */}
            <div className="visor-foto-grande-extra">
              {extraParaInspeccionar.fotos.length > 0 ? (
                <img
                  src={
                    extraParaInspeccionar.fotos[fotoExtraActivaIdx] ??
                    extraParaInspeccionar.fotos[0]
                  }
                  alt={extraParaInspeccionar.nombre}
                  className="imagen-grande-extra"
                />
              ) : (
                <div className="placeholder-foto-extra">Sin fotografía disponible</div>
              )}

              {extraParaInspeccionar.fotos.length > 1 && (
                <div className="controles-carrusel-extra">
                  <button
                    type="button"
                    className="flecha-galeria-extra flecha-extra-izq"
                    onClick={() =>
                      setFotoExtraActivaIdx((prev) =>
                        prev === 0 ? extraParaInspeccionar.fotos.length - 1 : prev - 1
                      )
                    }
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="flecha-galeria-extra flecha-extra-der"
                    onClick={() =>
                      setFotoExtraActivaIdx((prev) =>
                        prev === extraParaInspeccionar.fotos.length - 1 ? 0 : prev + 1
                      )
                    }
                    aria-label="Foto siguiente"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}

              {/* Miniaturas si hay varias fotos */}
              {extraParaInspeccionar.fotos.length > 1 && (
                <div className="tira-miniaturas-extra">
                  {extraParaInspeccionar.fotos.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`miniatura-extra-item ${i === fotoExtraActivaIdx ? 'activa' : ''}`}
                      onClick={() => setFotoExtraActivaIdx(i)}
                    >
                      <img src={f} alt={`Miniatura ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Información Completa del Producto Extra */}
            <div className="cuerpo-detalle-extra">
              <div className="encabezado-detalle-extra">
                <span className="categoria-extra-badge">
                  {extraParaInspeccionar.categoriaNombre || 'Complemento Especial'}
                </span>
                <h3 className="titulo-extra-preview">{extraParaInspeccionar.nombre}</h3>
                <div className="precio-extra-preview">
                  <span>
                    +${(varianteExtraInspeccion?.pvp ?? obtenerVarianteComplemento(extraParaInspeccionar)?.pvp ?? 0).toFixed(2)}
                  </span>
                  <small>Precio adicional al arreglo principal</small>
                </div>
              </div>

              {/* Descripción Detallada */}
              <div className="descripcion-extra-box">
                <p className="texto-descripcion-extra">
                  {extraParaInspeccionar.descripcionLarga ||
                    extraParaInspeccionar.descripcionCorta ||
                    varianteExtraInspeccion?.detalle ||
                    'Complemento botánico exclusivo para enriquecer la presentación y significado de tu arreglo.'}
                </p>
              </div>

              {/* Variantes / Opciones si tiene más de 1 (ej. Colores de Cinta) */}
              {extraParaInspeccionar.variantes.length > 1 && (
                <div className="seccion-variantes-extra">
                  <span className="etiqueta-variantes-extra">Selecciona el modelo / presentación:</span>
                  <div className="grid-opciones-variantes-extra">
                    {extraParaInspeccionar.variantes.map((v) => {
                      const seleccionada = varianteExtraInspeccion?.sku === v.sku;
                      return (
                        <button
                          key={v.sku}
                          type="button"
                          className={`btn-variante-extra-chip ${seleccionada ? 'activa' : ''}`}
                          onClick={() => seleccionarVarianteExtraInspeccion(v)}
                        >
                          <span>{v.nombre}</span>
                          <span className="precio-chip">${v.pvp.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Beneficios / Garantías del Extra */}
              <div className="badges-beneficios-extra">
                <div className="beneficio-extra-item">
                  <Sparkles size={14} />
                  <span>Elaborado y colocado cuidadosamente en taller por floristas</span>
                </div>
                <div className="beneficio-extra-item">
                  <Truck size={14} />
                  <span>Se despacha e integra directamente en el viaje de tu arreglo</span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="acciones-preview-extra">
                {complementosSeleccionados.includes(extraParaInspeccionar.id) ? (
                  <button
                    type="button"
                    className="btn btn-quitar-extra-preview"
                    onClick={() => confirmarQuitarExtraDesdeInspeccion(extraParaInspeccionar)}
                  >
                    <Check size={16} />
                    <span>✓ Extra Agregado — Quitar de mi Pedido</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primario btn-agregar-extra-preview"
                    onClick={() => confirmarAgregarExtraDesdeInspeccion(extraParaInspeccionar)}
                  >
                    <Plus size={16} />
                    <span>
                      Agregar este Detalle (+${(varianteExtraInspeccion?.pvp ?? obtenerVarianteComplemento(extraParaInspeccionar)?.pvp ?? 0).toFixed(2)})
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-volver-arreglo"
                  onClick={cerrarInspeccionExtra}
                >
                  Volver a la selección de flores
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
