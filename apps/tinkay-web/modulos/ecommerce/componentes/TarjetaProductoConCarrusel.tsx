'use client';

import React, { useState, useEffect } from 'react';
import { describirEscalaVolumen } from '@eco/comercio';
import { ProductoEcommerce, VarianteEcommerce } from '../tipos';
import { useCarrito } from '../contexto-carrito';
import { ChevronLeft, ChevronRight, Eye, ShoppingBag, Heart, Link2, Check } from 'lucide-react';

interface Props {
  producto: ProductoEcommerce;
  modoSobrio?: boolean;
}

export function TarjetaProductoConCarrusel({ producto, modoSobrio }: Props) {
  const { agregarItem, setProductoSeleccionadoModal, obtenerEnlaceProducto } = useCarrito();
  const [fotoActualIndex, setFotoActualIndex] = useState(0);
  const obtenerVarianteBase = () =>
    (producto.varianteInicialSku
      ? producto.variantes.find((v) => v.sku === producto.varianteInicialSku)
      : null) ??
    producto.variantes[0] ?? {
      sku: 'DEF',
      nombre: 'Estándar',
      pvp: 25,
      baseImponible: 21.74,
      tarifaIva: 15,
    };
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteEcommerce>(obtenerVarianteBase);
  const [favorito, setFavorito] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const handleCopiarEnlaceProducto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = obtenerEnlaceProducto(producto, varianteSeleccionada.sku);
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  // Cálculo dinámico de Oferta y % de Descuento
  const tieneOferta = Boolean(
    varianteSeleccionada.precioComparacion &&
    varianteSeleccionada.precioComparacion > varianteSeleccionada.pvp
  );
  const ahorroMonto = tieneOferta
    ? Number((varianteSeleccionada.precioComparacion! - varianteSeleccionada.pvp).toFixed(2))
    : 0;
  const porcentajeDescuento = tieneOferta
    ? Math.round((ahorroMonto / varianteSeleccionada.precioComparacion!) * 100)
    : 0;

  // En tarjetas agrupadas (sin varianteInicialSku), si la variante elegida tiene su propia galería (>1 foto),
  // mostrar su galería o el carrusel general del producto.
  const fotosBase =
    !producto.varianteInicialSku &&
    varianteSeleccionada.fotos &&
    varianteSeleccionada.fotos.length > 1 &&
    producto.variantes.length === 1
      ? varianteSeleccionada.fotos
      : producto.fotos;

  const fotos = fotosBase.length > 0 ? fotosBase : ['/img/slide4_flores_amor.jpg'];
  const indiceSeguro = fotoActualIndex < fotos.length ? fotoActualIndex : 0;
  const fotoActual = fotos[indiceSeguro] ?? fotos[0] ?? '/img/slide4_flores_amor.jpg';

  useEffect(() => {
    const nuevaVar =
      (producto.varianteInicialSku
        ? producto.variantes.find((v) => v.sku === producto.varianteInicialSku)
        : null) ?? producto.variantes[0];
    if (nuevaVar) {
      setVarianteSeleccionada(nuevaVar);
    }
    setFotoActualIndex((prev) => (prev < producto.fotos.length ? prev : 0));
  }, [producto]);

  const cambiarFotoCard = (nuevoIdx: number) => {
    setFotoActualIndex(nuevoIdx);
    // Solo sincronizar variante cuando la tarjeta agrupa múltiples variantes (no desglosada individualmente)
    if (!producto.varianteInicialSku && producto.variantes.length > 1) {
      const url = fotos[nuevoIdx];
      if (!url) return;
      const varDirecta =
        producto.variantes.find((v) => v.foto === url) ||
        producto.variantes.find((v) => Array.isArray(v.fotos) && v.fotos.includes(url));
      if (varDirecta) {
        setVarianteSeleccionada(varDirecta);
      }
    }
  };

  const anteriorFoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    cambiarFotoCard(indiceSeguro === 0 ? fotos.length - 1 : indiceSeguro - 1);
  };

  const siguienteFoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    cambiarFotoCard(indiceSeguro === fotos.length - 1 ? 0 : indiceSeguro + 1);
  };

  const irAFoto = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    cambiarFotoCard(index);
  };

  const handleAgregar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prodParaCarrito: ProductoEcommerce = {
      ...producto,
      nombre: producto.nombre,
      fotos: varianteSeleccionada.foto ? [varianteSeleccionada.foto] : producto.fotos,
    };
    agregarItem(prodParaCarrito, varianteSeleccionada);
  };

  return (
    <div
      className={`tarjeta-producto-ecommerce ${modoSobrio ? 'modo-sobrio' : ''}`}
      onClick={() => setProductoSeleccionadoModal(producto)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setProductoSeleccionadoModal(producto)}
    >
      {/* Carrusel de Fotos */}
      <div className="contenedor-foto-carrusel">
        <img
          src={fotoActual}
          alt={`${producto.nombre} - Foto ${indiceSeguro + 1}`}
          className="imagen-carrusel"
          loading="lazy"
        />

        {/* Chips de Estado */}
        <div className="chips-contenedor">
          {producto.esCombo ? (
            <span
              className="chip-etiqueta chip-oferta"
              title={
                tieneOferta
                  ? `Set Completo con ahorro de $${ahorroMonto.toFixed(2)}`
                  : 'Set de eventos configurable'
              }
            >
              {tieneOferta && porcentajeDescuento > 0
                ? `🎁 SET -${porcentajeDescuento}% OFF`
                : '🎁 SET EVENTO'}
            </span>
          ) : (
            tieneOferta &&
            porcentajeDescuento > 0 && (
              <span
                className="chip-etiqueta chip-oferta"
                title={`¡Oferta Especial! Ahorras $${ahorroMonto.toFixed(2)}`}
              >
                🔥 -{porcentajeDescuento}% OFF
              </span>
            )
          )}
          {producto.entregaHoy && (
            <span className="chip-etiqueta chip-entrega-hoy">⚡ Entrega Hoy</span>
          )}
          {producto.destacado && (
            <span className="chip-etiqueta chip-destacado">★ Más Pedido</span>
          )}
          {producto.nuevo && (
            <span className="chip-etiqueta chip-nuevo">Nuevo</span>
          )}
        </div>

        {/* Botón Favorito */}
        <button
          type="button"
          className={`btn-favorito ${favorito ? 'activo' : ''}`}
          aria-label="Guardar en favoritos"
          title="Guardar en favoritos"
          onClick={(e) => {
            e.stopPropagation();
            setFavorito(!favorito);
          }}
        >
          <Heart size={16} fill={favorito ? 'currentColor' : 'none'} />
        </button>

        {/* Botón Copiar Link Directo del Producto (WhatsApp / Chat) */}
        <button
          type="button"
          onClick={handleCopiarEnlaceProducto}
          title={linkCopiado ? '¡Link copiado!' : 'Copiar link directo del producto para WhatsApp'}
          aria-label="Copiar link del producto"
          style={{
            position: 'absolute',
            top: '54px',
            right: '12px',
            zIndex: 7,
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: linkCopiado ? '1.5px solid #10B981' : '1px solid rgba(255,255,255,0.65)',
            background: linkCopiado ? '#ECFDF5' : 'rgba(255, 255, 255, 0.92)',
            color: linkCopiado ? '#047857' : '#27272A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            transition: 'all 0.15s ease',
          }}
        >
          {linkCopiado ? <Check size={15} /> : <Link2 size={15} />}
        </button>

        {/* Flechas de navegación en la foto */}
        {fotos.length > 1 && (
          <>
            <button
              type="button"
              className="flecha-carrusel flecha-izq"
              onClick={anteriorFoto}
              aria-label="Foto anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="flecha-carrusel flecha-der"
              onClick={siguienteFoto}
              aria-label="Siguiente foto"
            >
              <ChevronRight size={18} />
            </button>

            {/* Contador discreto + Indicador de dots */}
            <span
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                zIndex: 6,
                background: 'rgba(24, 24, 27, 0.62)',
                color: '#FFFFFF',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '999px',
                pointerEvents: 'none',
              }}
            >
              {indiceSeguro + 1}/{fotos.length}
            </span>

            <div className="dots-carrusel">
              {fotos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`dot ${idx === indiceSeguro ? 'dot-activo' : ''}`}
                  onClick={(e) => irAFoto(e, idx)}
                  aria-label={`Ver foto ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Overlay hover para ver detalles */}
        <div className="overlay-hover-detalle">
          <span><Eye size={15} /> Ver arreglo en detalle</span>
        </div>
      </div>

      {/* Información del Producto */}
      <div className="info-producto-carrusel">
        <span className="categoria-rotulo">
          {modoSobrio ||
          (producto.esCondolencias &&
            (!producto.categoriaNombre ||
              producto.categoriaNombre.toLowerCase().includes('condol')))
            ? '🕊️ Condolencias Solemnes'
            : (producto.categoriaNombre || producto.categoriaPrincipal.replace('cat-', '')).toUpperCase()}
        </span>
        <h3 className="titulo-producto-carrusel">{producto.nombre}</h3>
        <p className="descripcion-corta-carrusel">{producto.descripcionCorta}</p>

        {/* Selector de Variantes Rápidas (solo si el producto no está desplegado individualmente por variante) */}
        {!producto.varianteInicialSku && producto.variantes.length > 1 && (
          <div className="selector-variantes-mini" onClick={(e) => e.stopPropagation()}>
            <label className="etiqueta-variante-mini">Presentación:</label>
            <div className="chips-variantes">
              {producto.variantes.map((v) => (
                <button
                  key={v.sku}
                  type="button"
                  className={`chip-variante-opcion ${v.sku === varianteSeleccionada.sku ? 'seleccionada' : ''}`}
                  onClick={() => {
                    setVarianteSeleccionada(v);
                    if (v.foto) {
                      const idx = fotos.indexOf(v.foto);
                      if (idx !== -1) {
                        setFotoActualIndex(idx);
                        return;
                      }
                    }
                    const idx = producto.variantes.findIndex((it) => it.sku === v.sku);
                    if (idx !== -1 && fotos[idx]) {
                      setFotoActualIndex(idx);
                    }
                  }}
                >
                  {v.nombre.trim()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Precio y Acción */}
        <div className="fila-precio-accion">
          <div className="columna-precio">
            <div className="precios-agrupados">
              <span className="precio-pvp-grande">
                ${varianteSeleccionada.pvp.toFixed(2)}
              </span>
              {tieneOferta && (
                <span className="precio-tachado-nominal" title={`Precio anterior: $${varianteSeleccionada.precioComparacion!.toFixed(2)}`}>
                  ${varianteSeleccionada.precioComparacion!.toFixed(2)}
                </span>
              )}
              {tieneOferta && porcentajeDescuento > 0 && (
                <span className="badge-ahorro-descuento">
                  -{porcentajeDescuento}%
                </span>
              )}
            </div>
            <span className="subtexto-iva">
              {varianteSeleccionada.tarifaIva > 0
                ? `PVP (Inc. IVA ${varianteSeleccionada.tarifaIva}%)`
                : 'PVP (Tarifa IVA 0%)'}
            </span>
            {producto.esCombo && producto.comboComponentes && producto.comboComponentes.length > 0 && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '3px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#BE185D',
                }}
              >
                ✨ Incluye {producto.comboComponentes.reduce((a, c) => a + c.cantidad_base, 0)} piezas • Personalizable
              </span>
            )}
            {!producto.esCombo &&
              varianteSeleccionada.escalasVolumen &&
              varianteSeleccionada.escalasVolumen[0] && (
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '3px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#B45309',
                  }}
                >
                  🏷️ {describirEscalaVolumen(
                    varianteSeleccionada.escalasVolumen[0],
                    varianteSeleccionada.pvpNominalSinVolumen ?? varianteSeleccionada.pvp
                  )}
                </span>
              )}
          </div>

          <div className="acciones-tarjeta">
            <button
              type="button"
              className="btn-agregar-rapido"
              onClick={handleAgregar}
              title="Agregar este arreglo al carrito"
            >
              <ShoppingBag size={16} />
              <span>Agregar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
