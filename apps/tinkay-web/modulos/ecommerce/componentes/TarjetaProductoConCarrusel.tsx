'use client';

import React, { useState } from 'react';
import { ProductoEcommerce, VarianteEcommerce } from '../tipos';
import { useCarrito } from '../contexto-carrito';
import { ChevronLeft, ChevronRight, Eye, ShoppingBag, Heart } from 'lucide-react';

interface Props {
  producto: ProductoEcommerce;
  modoSobrio?: boolean;
}

export function TarjetaProductoConCarrusel({ producto, modoSobrio }: Props) {
  const { agregarItem, setProductoSeleccionadoModal } = useCarrito();
  const [fotoActualIndex, setFotoActualIndex] = useState(0);
  const varianteInicial = producto.variantes[0] ?? {
    sku: 'DEF',
    nombre: 'Estándar',
    pvp: 25,
    baseImponible: 21.74,
    tarifaIva: 15,
  };
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteEcommerce>(varianteInicial);
  const [favorito, setFavorito] = useState(false);

  const fotos = producto.fotos.length > 0 ? producto.fotos : ['/img/slide4_flores_amor.jpg'];
  const fotoActual = fotos[fotoActualIndex] ?? fotos[0] ?? '/img/slide4_flores_amor.jpg';

  const anteriorFoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFotoActualIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
  };

  const siguienteFoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFotoActualIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
  };

  const irAFoto = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setFotoActualIndex(index);
  };

  const handleAgregar = (e: React.MouseEvent) => {
    e.stopPropagation();
    agregarItem(producto, varianteSeleccionada);
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
          alt={`${producto.nombre} - Foto ${fotoActualIndex + 1}`}
          className="imagen-carrusel"
          loading="lazy"
        />

        {/* Chips de Estado */}
        <div className="chips-contenedor">
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
          onClick={(e) => {
            e.stopPropagation();
            setFavorito(!favorito);
          }}
        >
          <Heart size={16} fill={favorito ? 'currentColor' : 'none'} />
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

            {/* Indicador de dots */}
            <div className="dots-carrusel">
              {fotos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`dot ${idx === fotoActualIndex ? 'dot-activo' : ''}`}
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
          {producto.esCondolencias ? '🕊️ Condolencias Solemnes' : producto.categoriaPrincipal.replace('cat-', '').toUpperCase()}
        </span>
        <h3 className="titulo-producto-carrusel">{producto.nombre}</h3>
        <p className="descripcion-corta-carrusel">{producto.descripcionCorta}</p>

        {/* Selector de Variantes Rápidas */}
        {producto.variantes.length > 1 && (
          <div className="selector-variantes-mini" onClick={(e) => e.stopPropagation()}>
            <label className="etiqueta-variante-mini">Presentación:</label>
            <div className="chips-variantes">
              {producto.variantes.map((v) => (
                <button
                  key={v.sku}
                  type="button"
                  className={`chip-variante-opcion ${v.sku === varianteSeleccionada.sku ? 'seleccionada' : ''}`}
                  onClick={() => setVarianteSeleccionada(v)}
                >
                  {(v.nombre.split('(')[0] ?? v.nombre).trim()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Precio y Acción */}
        <div className="fila-precio-accion">
          <div className="columna-precio">
            <span className="precio-pvp-grande">
              ${varianteSeleccionada.pvp.toFixed(2)}
            </span>
            <span className="subtexto-iva">PVP con IVA 15%</span>
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
