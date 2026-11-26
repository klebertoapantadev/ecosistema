'use client';

import React, { useState, useEffect } from 'react';
import {
  describirConfiguracionPersonalizacionCliente,
  describirEscalaVolumen,
  formatearDescripcionComposicion,
  inferirTipoEnvoltorioPorColeccion,
  resolverPersonalizacionFloralEfectiva,
} from '@eco/comercio';
import { ProductoEcommerce, VarianteEcommerce } from '../tipos';
import { useCarrito } from '../contexto-carrito';
import { ChevronLeft, ChevronRight, Eye, ShoppingBag, FileText, Heart, CreditCard, Palette } from 'lucide-react';

interface Props {
  producto: ProductoEcommerce;
  modoSobrio?: boolean;
}

export function TarjetaProductoConCarrusel({ producto, modoSobrio }: Props) {
  const {
    agregarItem,
    agregarItemProforma,
    setProductoSeleccionadoModal,
    abrirProductoParaPersonalizar,
    setDrawerAbierto,
    setCheckoutAbierto,
    esFavorito,
    obtenerMeGustaProducto,
    toggleFavorito,
  } = useCarrito();
  const [fotoActualIndex, setFotoActualIndex] = useState(0);
  const obtenerVarianteBase = () =>
    (producto.varianteInicialSku
      ? producto.variantes.find((v) => v.sku === producto.varianteInicialSku)
      : null) ??
    producto.variantes[0] ?? {
      sku: 'DEF',
      nombre: 'Estándar',
      pvp: 25,
      baseImponible: 25,
      tarifaIva: 0,
    };
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteEcommerce>(obtenerVarianteBase);
  const favorito = esFavorito(producto.id);
  const likesGlobales = obtenerMeGustaProducto(producto, varianteSeleccionada.sku);
  const [compradoReciente, setCompradoReciente] = useState(false);

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

  const esProductoRenta = Boolean(
    producto.esRenta ||
      producto.tipoOferta?.toUpperCase().includes('RENTA') ||
      producto.tipoOferta?.toUpperCase().includes('ALQUILER') ||
      (producto.etiquetas || []).some(
        (et: string) => et.toLowerCase().includes('renta') || et.toLowerCase().includes('alquiler')
      )
  );

  const esProductoEvento = Boolean(
    !esProductoRenta &&
      !producto.esExtra &&
      !producto.esComplemento &&
      (producto.esEvento === true ||
        (producto.categoriaPrincipal || '').toLowerCase().includes('evento') ||
        (producto.categoriaNombre || '').toLowerCase().includes('evento') ||
        (producto.categoriaNombre || '').toLowerCase().includes('ceremonia') ||
        (producto.tipoOferta || '').toUpperCase() === 'SERVICIO')
  );

  const configPersonalizacion = resolverPersonalizacionFloralEfectiva({
    configMaster: producto.personalizacionFloral,
    configVariante: varianteSeleccionada.personalizacionFloral,
    modoVariante: varianteSeleccionada.personalizacionFloralModo,
    habilitadaPorDefecto:
      !esProductoRenta && !esProductoEvento && !producto.esExtra && !producto.esComplemento,
    tipoEnvoltorioPorDefecto: inferirTipoEnvoltorioPorColeccion({
      categoriaNombre: producto.categoriaNombre,
      categoriaSlug: producto.categoriaPrincipal,
      productoNombre: producto.nombre,
      productoSlug: producto.slug,
    }),
  });
  const requierePersonalizacionFloral = Boolean(
    configPersonalizacion.habilitada &&
      !esProductoRenta &&
      !esProductoEvento &&
      !producto.esExtra &&
      !producto.esComplemento
  );
  const textoColoresPreferencia = requierePersonalizacionFloral
    ? describirConfiguracionPersonalizacionCliente(configPersonalizacion)
    : '';
  const textoComposicionTarjeta =
    formatearDescripcionComposicion(configPersonalizacion.composicionReceta) ||
    varianteSeleccionada.composicionDescripcion ||
    producto.composicionDescripcion ||
    '';

  const handleAgregar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requierePersonalizacionFloral) {
      abrirProductoParaPersonalizar(producto, varianteSeleccionada.sku);
      return;
    }
    const prodParaCarrito: ProductoEcommerce = {
      ...producto,
      nombre: producto.nombre,
      fotos: varianteSeleccionada.foto ? [varianteSeleccionada.foto] : producto.fotos,
    };
    if (esProductoEvento) {
      agregarItemProforma(prodParaCarrito, varianteSeleccionada);
      return;
    }
    agregarItem(prodParaCarrito, varianteSeleccionada, undefined, undefined, 1, false);
    setCompradoReciente(true);
  };

  const handleSeguirComprando = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCompradoReciente(false);
  };

  const handlePagarDirecto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!compradoReciente) {
      const prodParaCarrito: ProductoEcommerce = {
        ...producto,
        nombre: producto.nombre,
        fotos: varianteSeleccionada.foto ? [varianteSeleccionada.foto] : producto.fotos,
      };
      agregarItem(prodParaCarrito, varianteSeleccionada, undefined, undefined, 1, false);
    }
    setCompradoReciente(false);
    setDrawerAbierto(false);
    setProductoSeleccionadoModal(null);
    setCheckoutAbierto(true);
  };

  const esCondolenciasSobrio = Boolean(
    modoSobrio ||
      (producto.esCondolencias &&
        (!producto.categoriaNombre ||
          producto.categoriaNombre.toLowerCase().includes('condol')))
  );

  // Máximo 1 chip por tarjeta (y ninguno promocional en modo Condolencias sobrio)
  const chipPrincipal = (() => {
    if (esCondolenciasSobrio) return null;
    if (esProductoRenta) {
      return {
        clase: 'chip-etiqueta chip-renta',
        texto: 'En renta',
        titulo: producto.rentaConfig?.nota_condiciones || 'Mobiliario en calidad de renta para eventos',
      };
    }
    if (esProductoEvento) {
      return {
        clase: 'chip-etiqueta chip-evento',
        texto: 'Eventos',
        titulo: 'Producto de Eventos y Ceremonias bajo proforma personalizada',
      };
    }
    if (producto.esCombo) {
      return {
        clase: 'chip-etiqueta chip-oferta',
        texto: tieneOferta && porcentajeDescuento > 0 ? `Set -${porcentajeDescuento}%` : 'Set especial',
        titulo: tieneOferta ? `Set completo con ahorro de $${ahorroMonto.toFixed(2)}` : 'Set configurable',
      };
    }
    if (tieneOferta && porcentajeDescuento > 0) {
      return {
        clase: 'chip-etiqueta chip-oferta',
        texto: `-${porcentajeDescuento}%`,
        titulo: `Oferta especial: ahorras $${ahorroMonto.toFixed(2)}`,
      };
    }
    if (producto.entregaHoy) {
      return {
        clase: 'chip-etiqueta chip-entrega-hoy',
        texto: 'Entrega hoy',
        titulo: 'Disponible para entrega hoy en Quito',
      };
    }
    if (producto.destacado) {
      return {
        clase: 'chip-etiqueta chip-destacado',
        texto: 'Más pedido',
        titulo: 'Arreglo destacado de Tinkay',
      };
    }
    if (producto.nuevo) {
      return {
        clase: 'chip-etiqueta chip-nuevo',
        texto: 'Nuevo',
        titulo: 'Recién incorporado al catálogo',
      };
    }
    return null;
  })();

  return (
    <article
      className={`tarjeta-producto-ecommerce ${esCondolenciasSobrio ? 'modo-sobrio' : ''}`}
      onClick={() => setProductoSeleccionadoModal(producto)}
    >
      {/* Carrusel de Fotos */}
      <div className="contenedor-foto-carrusel">
        <img
          src={fotoActual}
          alt={`${producto.nombre} - Foto ${indiceSeguro + 1}`}
          className="imagen-carrusel"
          loading="lazy"
        />

        {/* Chip único sobrio */}
        {chipPrincipal && (
          <div className="chips-contenedor">
            <span className={chipPrincipal.clase} title={chipPrincipal.titulo}>
              {chipPrincipal.texto}
            </span>
          </div>
        )}

        {/* Botón Favorito + Contador Global de Me gusta */}
        <button
          type="button"
          className={`btn-favorito ${favorito ? 'activo' : ''} ${likesGlobales > 0 ? 'con-contador' : ''}`}
          aria-label={
            favorito
              ? `Quitar de Me gusta (${likesGlobales} Me gusta globales)`
              : `Dar Me gusta (${likesGlobales} Me gusta globales)`
          }
          aria-pressed={favorito}
          title={
            favorito
              ? `Guardado en tus Me gusta · ${likesGlobales} personas han dado Me gusta`
              : likesGlobales > 0
              ? `Guardar en Me gusta · ${likesGlobales} personas han dado Me gusta`
              : 'Guardar en Me gusta'
          }
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorito(producto, varianteSeleccionada.sku);
          }}
        >
          <Heart size={15} fill={favorito ? 'currentColor' : 'none'} />
          {likesGlobales > 0 && (
            <span className="contador-me-gusta-tarjeta">{likesGlobales}</span>
          )}
        </button>

        {/* Flechas de navegación en la foto (se revelan en hover/focus) */}
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
          {esCondolenciasSobrio
            ? 'Condolencias'
            : (producto.categoriaNombre || producto.categoriaPrincipal.replace('cat-', '')).toUpperCase()}
        </span>
        <h3 className="titulo-producto-carrusel">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setProductoSeleccionadoModal(producto);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {producto.nombre}
          </button>
        </h3>
        <p className="descripcion-corta-carrusel">{producto.descripcionCorta}</p>

        {textoComposicionTarjeta && (
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: esCondolenciasSobrio ? '#3F3F46' : '#2B4A36',
              background: esCondolenciasSobrio ? '#F4F4F5' : '#F2F6F3',
              border: esCondolenciasSobrio ? '1px solid #E4E4E7' : '1px solid #D5E4DA',
              borderRadius: '8px',
              padding: '3px 8px',
              marginTop: '4px',
              marginBottom: '4px',
              lineHeight: 1.35,
            }}
            title={`Composición floral: ${textoComposicionTarjeta}`}
          >
            🌸 {textoComposicionTarjeta}
          </div>
        )}

        {requierePersonalizacionFloral && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '4px',
              marginBottom: '6px',
              padding: '3px 9px',
              borderRadius: '999px',
              background: esCondolenciasSobrio ? '#F4F4F5' : '#F6F4EF',
              border: esCondolenciasSobrio ? '1px solid #E4E4E7' : '1px solid #E6E0D6',
              color: esCondolenciasSobrio ? '#52525B' : '#6B655E',
              fontSize: '0.69rem',
              fontWeight: 500,
              maxWidth: '100%',
            }}
            title="Al comprar podrás elegir tus colores de preferencia o los mismos colores de la foto"
          >
            <Palette
              size={12}
              style={{
                flexShrink: 0,
                color: esCondolenciasSobrio ? '#71717A' : '#8A8178',
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {textoColoresPreferencia || 'Colores y decoración según la ocasión'}
            </span>
          </div>
        )}

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
              {!esCondolenciasSobrio && tieneOferta && (
                <span className="precio-tachado-nominal" title={`Precio anterior: $${varianteSeleccionada.precioComparacion!.toFixed(2)}`}>
                  ${varianteSeleccionada.precioComparacion!.toFixed(2)}
                </span>
              )}
              {!esCondolenciasSobrio && tieneOferta && porcentajeDescuento > 0 && (
                <span className="badge-ahorro-descuento">
                  -{porcentajeDescuento}%
                </span>
              )}
            </div>
            <span className="subtexto-iva">
              {producto.esRenta
                ? `Renta (${producto.rentaConfig?.periodo || 'Por evento'}) • ${
                    varianteSeleccionada.tarifaIva > 0
                      ? `IVA ${varianteSeleccionada.tarifaIva}%`
                      : 'IVA 0%'
                  }`
                : varianteSeleccionada.tarifaIva > 0
                ? `PVP (Inc. IVA ${varianteSeleccionada.tarifaIva}%)`
                : 'PVP (Tarifa IVA 0%)'}
            </span>
            {producto.esCombo && producto.comboComponentes && producto.comboComponentes.length > 0 && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '3px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--verde)',
                }}
              >
                Incluye {producto.comboComponentes.reduce((a, c) => a + c.cantidad_base, 0)} piezas • Personalizable
              </span>
            )}
            {!producto.esCombo &&
              !esCondolenciasSobrio &&
              varianteSeleccionada.escalasVolumen &&
              varianteSeleccionada.escalasVolumen[0] && (
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '3px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--dorado)',
                  }}
                >
                  {describirEscalaVolumen(
                    varianteSeleccionada.escalasVolumen[0],
                    varianteSeleccionada.pvpNominalSinVolumen ?? varianteSeleccionada.pvp
                  )}
                </span>
              )}
          </div>

          <div
            className="acciones-tarjeta"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            {esProductoEvento ? (
              <button
                type="button"
                className="btn-agregar-rapido btn-agregar-rapido-sobrio"
                onClick={handleAgregar}
                title="Añadir este elemento a mi proforma de evento"
                aria-label="Proforma"
              >
                <FileText size={15} />
                <span>Proforma</span>
              </button>
            ) : compradoReciente ? (
              <>
                <button
                  type="button"
                  className="btn-agregar-rapido"
                  onClick={handleSeguirComprando}
                  title="Seguir explorando más arreglos"
                  aria-label="Seguir comprando"
                  style={{
                    background: 'var(--blanco)',
                    color: 'var(--verde)',
                    border: '1px solid var(--verde)',
                    padding: '7px 11px',
                    fontSize: '0.76rem',
                  }}
                >
                  <span>Seguir</span>
                </button>
                <button
                  type="button"
                  className="btn-agregar-rapido btn-agregar-rapido-sobrio"
                  onClick={handlePagarDirecto}
                  title="Ir directamente al pago"
                  aria-label="Pagar ahora"
                  style={{
                    padding: '7px 12px',
                    fontSize: '0.76rem',
                  }}
                >
                  <CreditCard size={14} />
                  <span>Pagar ahora</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`btn-agregar-rapido ${esCondolenciasSobrio ? 'btn-agregar-rapido-sobrio' : ''}`}
                onClick={handleAgregar}
                title="Comprar este arreglo floral"
                aria-label="Comprar"
                style={{
                  padding: '8px 14px',
                }}
              >
                <ShoppingBag size={15} />
                <span>Comprar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
