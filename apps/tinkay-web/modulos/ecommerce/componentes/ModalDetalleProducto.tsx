'use client';

import React, { useState } from 'react';
import {
  calcularPrecioPorVolumen,
  describirEscalaVolumen,
} from '@eco/comercio';
import { useCarrito } from '../contexto-carrito';
import { PRODUCTOS_TINKAY, FRASES_DEDICATORIAS } from '../datos-catalogo';
import { ProductoEcommerce, VarianteEcommerce, DedicatoriaArreglo } from '../tipos';
import { obtenerNombreProductoIndividual } from './VitrinaCatalogoTinkay';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Truck,
  ShieldCheck,
  Plus,
  Minus,
  Gift,
  Sliders,
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
  const [cantidadModal, setCantidadModal] = useState<number>(1);
  const [modoCompraCombo, setModoCompraCombo] = useState<'set_completo' | 'personalizado'>('set_completo');
  const [seleccionCombo, setSeleccionCombo] = useState<
    Record<number, { sku: string; cantidad: number }>
  >({});
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
    if (producto && producto.variantes && producto.variantes.length > 0) {
      const varInicial =
        producto.variantes.find((v) => v.sku === producto.varianteInicialSku) ||
        producto.variantes[0]!;
      setVarianteSeleccionada(varInicial);
      setFotoActivaIndex(0);
      setCantidadModal(1);
      setModoCompraCombo('set_completo');

      if (producto.esCombo && Array.isArray(producto.comboComponentes)) {
        const catalogoRef = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;
        const inicial: Record<number, { sku: string; cantidad: number }> = {};
        producto.comboComponentes.forEach((comp, idx) => {
          const prodHijo = catalogoRef.find(
            (item) =>
              item.proIdUuid === comp.producto_id ||
              item.id === comp.producto_id ||
              (comp.producto_slug && item.slug === comp.producto_slug)
          );
          const varDef =
            prodHijo?.variantes.find(
              (v) =>
                (comp.variante_id && v.varId === comp.variante_id) ||
                (comp.variante_sku && v.sku === comp.variante_sku)
            ) || prodHijo?.variantes[0];
          inicial[idx] = {
            sku: varDef?.sku || comp.variante_sku || '',
            cantidad: Math.max(1, comp.cantidad_base || 1),
          };
        });
        setSeleccionCombo(inicial);
      } else {
        setSeleccionCombo({});
      }

      setComplementosSeleccionados([]);
      setIncluirDedicatoria(false);
      setDedicatoria({ para: '', de: '', mensaje: '' });
    }
  }, [producto, productos]);

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

  const nombreBaseProducto =
    producto?.nombreBase ||
    producto?.nombre.split(' — ')[0] ||
    producto?.nombre || '';

  const tituloModal =
    varianteSeleccionada?.nombre
      ? obtenerNombreProductoIndividual(nombreBaseProducto, varianteSeleccionada.nombre)
      : producto?.nombre || '';

  // Resolver elementos del Set / Combo Configurable (Hook de nivel superior)
  const componentesComboResueltos = React.useMemo(() => {
    if (!producto?.esCombo || !Array.isArray(producto.comboComponentes) || producto.comboComponentes.length === 0) {
      return [];
    }
    const catalogoRef = productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY;

    return producto.comboComponentes
      .map((comp, idx) => {
        const prodHijo = catalogoRef.find(
          (item) =>
            item.proIdUuid === comp.producto_id ||
            item.id === comp.producto_id ||
            (comp.producto_slug && item.slug === comp.producto_slug)
        );
        if (!prodHijo || prodHijo.variantes.length === 0) return null;

        const varBaseSet =
          prodHijo.variantes.find(
            (v) =>
              (comp.variante_id && v.varId === comp.variante_id) ||
              (comp.variante_sku && v.sku === comp.variante_sku)
          ) || prodHijo.variantes[0]!;

        const selUsuario = seleccionCombo[idx];
        const varElegida =
          modoCompraCombo === 'personalizado' && selUsuario?.sku
            ? prodHijo.variantes.find((v) => v.sku === selUsuario.sku) || varBaseSet
            : varBaseSet;

        const cantidadElegida =
          modoCompraCombo === 'personalizado' && selUsuario !== undefined
            ? Math.max(0, selUsuario.cantidad)
            : Math.max(1, comp.cantidad_base);

        const pvpBaseSetUnit = varBaseSet.pvpNominalSinVolumen ?? varBaseSet.pvp;
        const subtotalBaseNominal = Number((pvpBaseSetUnit * comp.cantidad_base).toFixed(2));

        const calcPersonalizado = calcularPrecioPorVolumen({
          pvpUnitarioNominal: varElegida.pvpNominalSinVolumen ?? varElegida.pvp,
          tarifaIvaPorcentaje: varElegida.tarifaIva,
          cantidad: cantidadElegida,
          escalas: varElegida.escalasVolumen,
        });

        const miniatura =
          varElegida.foto ||
          varElegida.fotos?.[0] ||
          prodHijo.fotos[0] ||
          '/img/slide4_flores_amor.jpg';

        return {
          idx,
          comp,
          prodHijo,
          varBaseSet,
          varElegida,
          cantidadElegida,
          pvpBaseSetUnit,
          subtotalBaseNominal,
          calcPersonalizado,
          miniatura,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [producto, productos, seleccionCombo, modoCompraCombo]);

  const esComboActivo = Boolean(producto?.esCombo && componentesComboResueltos.length > 0);

  const resumenFinancieroCombo = React.useMemo(() => {
    const sumaSetNominal = Number(
      componentesComboResueltos
        .reduce((acc, item) => acc + item.subtotalBaseNominal, 0)
        .toFixed(2)
    );
    const pvpSet = varianteSeleccionada.pvp;
    const ahorroSet = Math.max(0, Number((sumaSetNominal - pvpSet).toFixed(2)));
    const porcentajeDescuentoSet =
      sumaSetNominal > 0 && ahorroSet > 0 ? Math.round((ahorroSet / sumaSetNominal) * 100) : 0;

    const sumaPersonalizadaNominal = Number(
      componentesComboResueltos
        .reduce((acc, item) => acc + item.calcPersonalizado.subtotalLineaNominal, 0)
        .toFixed(2)
    );
    const sumaPersonalizadaFinal = Number(
      componentesComboResueltos
        .reduce((acc, item) => acc + item.calcPersonalizado.subtotalLineaFinal, 0)
        .toFixed(2)
    );
    const ahorroVolumenPersonalizado = Math.max(
      0,
      Number((sumaPersonalizadaNominal - sumaPersonalizadaFinal).toFixed(2))
    );
    const totalPiezasPersonalizadas = componentesComboResueltos.reduce(
      (acc, item) => acc + item.cantidadElegida,
      0
    );

    const coincideExactoConSetBase =
      componentesComboResueltos.length > 0 &&
      componentesComboResueltos.every(
        (item) =>
          item.varElegida.sku === item.varBaseSet.sku &&
          item.cantidadElegida === item.comp.cantidad_base
      );

    return {
      sumaSetNominal,
      pvpSet,
      ahorroSet,
      porcentajeDescuentoSet,
      sumaPersonalizadaNominal,
      sumaPersonalizadaFinal,
      ahorroVolumenPersonalizado,
      totalPiezasPersonalizadas,
      coincideExactoConSetBase,
    };
  }, [componentesComboResueltos, varianteSeleccionada.pvp]);

  const calculoVolumenIndividual = React.useMemo(() => {
    return calcularPrecioPorVolumen({
      pvpUnitarioNominal: varianteSeleccionada.pvpNominalSinVolumen ?? varianteSeleccionada.pvp,
      tarifaIvaPorcentaje: varianteSeleccionada.tarifaIva,
      cantidad: cantidadModal,
      escalas: varianteSeleccionada.escalasVolumen,
    });
  }, [varianteSeleccionada, cantidadModal]);

  const handleAgregarAlCarrito = () => {
    if (!producto) return;

    const dedicatoriaActiva =
      incluirDedicatoria && dedicatoria.mensaje.trim() ? dedicatoria : undefined;

    if (esComboActivo) {
      const usarSetCerrado =
        modoCompraCombo === 'set_completo' ||
        (resumenFinancieroCombo.coincideExactoConSetBase &&
          resumenFinancieroCombo.pvpSet <= resumenFinancieroCombo.sumaPersonalizadaFinal);

      if (usarSetCerrado) {
        const resumenPiezas = componentesComboResueltos
          .map((it) => {
            const sufijoVar =
              it.prodHijo.variantes.length > 1 ? ` (${it.varBaseSet.nombre})` : '';
            return `${it.comp.cantidad_base}× ${it.prodHijo.nombre}${sufijoVar}`;
          })
          .join(' + ');

        const productoSetCarrito: ProductoEcommerce = {
          ...producto,
          id: `${producto.id}__${varianteSeleccionada.sku}`,
          nombre: producto.nombre,
          fotos: varianteSeleccionada.foto ? [varianteSeleccionada.foto] : producto.fotos,
        };

        const varianteSetCarrito: VarianteEcommerce = {
          ...varianteSeleccionada,
          nombre: `Set Completo: ${resumenPiezas}`,
        };

        agregarItem(productoSetCarrito, varianteSetCarrito, dedicatoriaActiva, undefined, 1);
      } else {
        if (resumenFinancieroCombo.totalPiezasPersonalizadas <= 0) return;
        let dedicatoriaAsignada = false;

        componentesComboResueltos.forEach((fila) => {
          if (fila.cantidadElegida <= 0) return;
          const tituloItem = obtenerNombreProductoIndividual(
            fila.prodHijo.nombreBase || fila.prodHijo.nombre,
            fila.varElegida.nombre
          );
          const prodItemCarrito: ProductoEcommerce = {
            ...fila.prodHijo,
            id: `${fila.prodHijo.id}__${fila.varElegida.sku}`,
            nombre: tituloItem,
            fotos: fila.varElegida.foto ? [fila.varElegida.foto] : fila.prodHijo.fotos,
          };
          agregarItem(
            prodItemCarrito,
            fila.varElegida,
            !dedicatoriaAsignada ? dedicatoriaActiva : undefined,
            undefined,
            fila.cantidadElegida
          );
          dedicatoriaAsignada = true;
        });
      }
    } else {
      const productoParaCarrito: ProductoEcommerce = {
        ...producto,
        id: `${producto.id}__${varianteSeleccionada.sku}`,
        nombre: tituloModal,
        fotos: varianteSeleccionada.foto ? [varianteSeleccionada.foto] : producto.fotos,
      };

      // 1. Agregar el arreglo principal con su variante, cantidad y dedicatoria
      agregarItem(
        productoParaCarrito,
        varianteSeleccionada,
        dedicatoriaActiva,
        undefined,
        cantidadModal
      );
    }

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

  const todasLasFotosProducto =
    producto.fotosModal && producto.fotosModal.length > 0
      ? producto.fotosModal
      : producto.fotos && producto.fotos.length > 0
      ? producto.fotos
      : ['/img/slide4_flores_amor.jpg'];

  const fotosVarianteActual =
    varianteSeleccionada.fotos && varianteSeleccionada.fotos.length > 0
      ? varianteSeleccionada.fotos
      : varianteSeleccionada.foto
      ? [varianteSeleccionada.foto]
      : [];

  const esProductoMultivariante = producto.variantes.length > 1;
  const mostrandoGaleriaPropia = esProductoMultivariante
    ? fotosVarianteActual.length > 0
    : true;

  const fotosProductoSimple = Array.from(
    new Set([...fotosVarianteActual, ...todasLasFotosProducto])
  );

  const fotos = esProductoMultivariante
    ? mostrandoGaleriaPropia
      ? fotosVarianteActual
      : todasLasFotosProducto
    : fotosProductoSimple.length > 0
    ? fotosProductoSimple
    : ['/img/slide4_flores_amor.jpg'];

  const indiceFotoSeguro = fotoActivaIndex < fotos.length ? fotoActivaIndex : 0;

  const seleccionarVarianteModal = (v: VarianteEcommerce) => {
    setVarianteSeleccionada(v);
    setFotoActivaIndex(0);
  };

  const cambiarFotoActiva = (nuevoIdx: number) => {
    setFotoActivaIndex(nuevoIdx);
    if (!mostrandoGaleriaPropia && producto.variantes.length > 1) {
      const url = fotos[nuevoIdx];
      if (!url) return;
      const varDirecta = producto.variantes.find((v) => v.foto === url);
      if (varDirecta) {
        setVarianteSeleccionada(varDirecta);
      }
    }
  };

  const descripcionProducto = (producto.descripcionLarga || producto.descripcionCorta || '').trim();
  const beneficiosMostrados =
    varianteSeleccionada.beneficiosCustom && varianteSeleccionada.beneficiosCustom.length > 0
      ? varianteSeleccionada.beneficiosCustom
      : producto.beneficios && producto.beneficios.length > 0
      ? producto.beneficios
      : [];

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
                src={fotos[indiceFotoSeguro] ?? fotos[0] ?? '/img/slide4_flores_amor.jpg'}
                alt={`${producto.nombre} - Foto ${indiceFotoSeguro + 1}`}
                className="imagen-modal-principal"
              />

              {fotos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="flecha-galeria flecha-izq"
                    onClick={() =>
                      cambiarFotoActiva(
                        indiceFotoSeguro === 0 ? fotos.length - 1 : indiceFotoSeguro - 1
                      )
                    }
                    title="Foto anterior"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    className="flecha-galeria flecha-der"
                    onClick={() =>
                      cambiarFotoActiva(
                        indiceFotoSeguro === fotos.length - 1 ? 0 : indiceFotoSeguro + 1
                      )
                    }
                    title="Siguiente foto"
                    aria-label="Siguiente foto"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'rgba(24, 24, 27, 0.68)',
                      color: '#FFFFFF',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      pointerEvents: 'none',
                    }}
                  >
                    Foto {indiceFotoSeguro + 1} de {fotos.length}
                  </span>
                </>
              )}
            </div>

            {/* Miniaturas de la Galería */}
            {fotos.length > 1 && (
              <div className="tira-miniaturas">
                {fotos.map((f, i) => {
                  const varPorPortada = !mostrandoGaleriaPropia
                    ? producto.variantes.find((v) => v.foto === f)
                    : undefined;
                  const estaActiva = i === indiceFotoSeguro;
                  return (
                    <button
                      key={`${f}-${i}`}
                      type="button"
                      className={`miniatura-item ${estaActiva ? 'miniatura-activa' : ''}`}
                      onClick={() => cambiarFotoActiva(i)}
                      aria-label={`Ver fotografía ${i + 1}`}
                      title={
                        varPorPortada
                          ? `${varPorPortada.nombre} — $${varPorPortada.pvp.toFixed(2)}`
                          : `Fotografía ${i + 1} de ${fotos.length}`
                      }
                    >
                      <img src={f} alt={`Miniatura ${i + 1}`} />
                      {varPorPortada && (
                        <span className="miniatura-badge-precio">
                          ${varPorPortada.pvp.toFixed(0)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Descripción y Beneficios del Producto */}
            {(descripcionProducto || beneficiosMostrados.length > 0) && (
              <div className="caja-descripcion-beneficios-producto">
                {descripcionProducto && (
                  <div className="bloque-descripcion-producto">
                    <span className="subtitulo-seccion-detalle">Descripción</span>
                    <p className="texto-descripcion-producto">{descripcionProducto}</p>
                  </div>
                )}

                {descripcionProducto && beneficiosMostrados.length > 0 && (
                  <div className="separador-detalle-producto" />
                )}

                {beneficiosMostrados.length > 0 && (
                  <div className="bloque-beneficios-producto">
                    <span className="subtitulo-seccion-detalle">Beneficios / ¿Qué incluye?</span>
                    <ul className="lista-beneficios-producto">
                      {beneficiosMostrados.map((beneficio, idx) => (
                        <li key={idx} className="item-beneficio-producto">
                          <Check size={14} className="icono-check-beneficio" />
                          <span>{beneficio}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna Derecha: Configuración, Variantes y Dedicatoria */}
          <div className="columna-info-modal">
            <div className="cabecera-info-producto">
              <span className="categoria-pill-modal">
                {esComboActivo
                  ? '🎁 Set / Combo para Eventos'
                  : producto.esCondolencias
                  ? '🕊️ Condolencias Solemnes'
                  : 'Colección Tinkay'}
              </span>
              <h2 className="titulo-modal-producto">{tituloModal}</h2>
              {(() => {
                const usarPrecioSet =
                  esComboActivo &&
                  (modoCompraCombo === 'set_completo' ||
                    (resumenFinancieroCombo.coincideExactoConSetBase &&
                      resumenFinancieroCombo.pvpSet <= resumenFinancieroCombo.sumaPersonalizadaFinal));

                const precioCabecera = esComboActivo
                  ? usarPrecioSet
                    ? resumenFinancieroCombo.pvpSet
                    : resumenFinancieroCombo.sumaPersonalizadaFinal
                  : calculoVolumenIndividual.pvpUnitarioFinal;

                const precioTachadoCabecera = esComboActivo
                  ? usarPrecioSet
                    ? resumenFinancieroCombo.sumaSetNominal > resumenFinancieroCombo.pvpSet
                      ? resumenFinancieroCombo.sumaSetNominal
                      : varianteSeleccionada.precioComparacion
                    : resumenFinancieroCombo.sumaPersonalizadaNominal >
                      resumenFinancieroCombo.sumaPersonalizadaFinal
                    ? resumenFinancieroCombo.sumaPersonalizadaNominal
                    : undefined
                  : calculoVolumenIndividual.tieneDescuentoVolumen
                  ? calculoVolumenIndividual.pvpUnitarioNominal
                  : varianteSeleccionada.precioComparacion;

                const pctDescuentoCabecera =
                  precioTachadoCabecera && precioTachadoCabecera > precioCabecera
                    ? Math.round(
                        ((precioTachadoCabecera - precioCabecera) / precioTachadoCabecera) * 100
                      )
                    : 0;

                return (
                  <div className="fila-precio-modal" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                    <span className="precio-pvp-destacado">${precioCabecera.toFixed(2)}</span>
                    {!esComboActivo && cantidadModal > 1 && (
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#047857',
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          marginLeft: '6px',
                        }}
                      >
                        c/u × {cantidadModal} = ${calculoVolumenIndividual.subtotalLineaFinal.toFixed(2)}
                      </span>
                    )}
                    {precioTachadoCabecera && precioTachadoCabecera > precioCabecera && (
                      <>
                        <span
                          style={{
                            textDecoration: 'line-through',
                            opacity: 0.55,
                            fontSize: '1.2rem',
                            fontWeight: 500,
                            marginLeft: '8px',
                            color: 'var(--tinta-media)',
                          }}
                          title={`Suma / precio individual sin descuento: $${precioTachadoCabecera.toFixed(2)}`}
                        >
                          ${precioTachadoCabecera.toFixed(2)}
                        </span>
                        {pctDescuentoCabecera > 0 && (
                          <span
                            style={{
                              background: esComboActivo ? '#7C3AED' : '#E11D48',
                              color: '#FFFFFF',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '999px',
                              marginLeft: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: esComboActivo
                                ? '0 2px 6px rgba(124, 58, 237, 0.3)'
                                : '0 2px 6px rgba(225, 29, 72, 0.35)',
                            }}
                          >
                            {esComboActivo
                              ? usarPrecioSet
                                ? `🎁 Set -${pctDescuentoCabecera}% OFF`
                                : `🏷️ Volumen -${pctDescuentoCabecera}% OFF`
                              : calculoVolumenIndividual.tieneDescuentoVolumen
                              ? `🏷️ Volumen -${pctDescuentoCabecera}% OFF`
                              : `🔥 -${pctDescuentoCabecera}% OFF`}
                          </span>
                        )}
                      </>
                    )}
                    <span className="iva-etiqueta-modal">
                      {varianteSeleccionada.tarifaIva > 0
                        ? `PVP (IVA ${varianteSeleccionada.tarifaIva}% incluido)`
                        : 'PVP (Tarifa IVA 0% — Flores Frescas)'}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Configurador Interactivo de Set / Combo para Eventos */}
            {esComboActivo && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '14px',
                  background: 'linear-gradient(180deg, #FDFCFE 0%, #FAF7FF 100%)',
                  border: '1.5px solid #DDD6FE',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Conmutador: Set Completo vs Personalizar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    background: '#EDE9FE',
                    padding: '4px',
                    borderRadius: '10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setModoCompraCombo('set_completo')}
                    title="Llevar el Set Completo con precio especial de paquete"
                    aria-label="Seleccionar Set Completo"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: modoCompraCombo === 'set_completo' ? '#5B21B6' : 'transparent',
                      color: modoCompraCombo === 'set_completo' ? '#FFFFFF' : '#4C1D95',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow:
                        modoCompraCombo === 'set_completo'
                          ? '0 2px 6px rgba(91, 33, 182, 0.25)'
                          : 'none',
                    }}
                  >
                    <Gift size={15} />
                    <span>Set Completo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCompraCombo('personalizado')}
                    title="Personalizar tamaños y cantidades individuales del evento"
                    aria-label="Personalizar elementos"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: modoCompraCombo === 'personalizado' ? '#18181B' : 'transparent',
                      color: modoCompraCombo === 'personalizado' ? '#FFFFFF' : '#3F3F46',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow:
                        modoCompraCombo === 'personalizado'
                          ? '0 2px 6px rgba(24, 24, 27, 0.22)'
                          : 'none',
                    }}
                  >
                    <Sliders size={15} />
                    <span>Personalizar</span>
                  </button>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#52525B', lineHeight: 1.4 }}>
                  {modoCompraCombo === 'set_completo' ? (
                    <span>
                      Incluye todas las piezas mostradas con{' '}
                      <strong style={{ color: '#5B21B6' }}>
                        descuento especial de Set (${resumenFinancieroCombo.ahorroSet.toFixed(2)} de ahorro)
                      </strong>
                      . Haz clic en <strong>Personalizar</strong> si deseas elegir tamaños o cantidades a medida.
                    </span>
                  ) : (
                    <span>
                      Elige el <strong>tamaño</strong> y la <strong>cantidad</strong> de cada elemento (pon{' '}
                      <code>0</code> si no requieres alguno). Se suman los costos reales aplicando descuentos por volumen automáticamente.
                    </span>
                  )}
                </div>

                {/* Lista de elementos individuales del Set */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {componentesComboResueltos.map((fila) => {
                    const escalasVar = fila.varElegida.escalasVolumen ?? [];
                    const excluido = modoCompraCombo === 'personalizado' && fila.cantidadElegida === 0;
                    const pvpUnitSinDesc =
                      modoCompraCombo === 'personalizado'
                        ? fila.calcPersonalizado.pvpUnitarioNominal
                        : fila.pvpBaseSetUnit;
                    const pvpUnitConDesc =
                      modoCompraCombo === 'personalizado'
                        ? fila.calcPersonalizado.pvpUnitarioFinal
                        : fila.pvpBaseSetUnit;
                    const subtotalElemento =
                      modoCompraCombo === 'personalizado'
                        ? fila.calcPersonalizado.subtotalLineaFinal
                        : fila.subtotalBaseNominal;

                    return (
                      <div
                        key={`${fila.comp.producto_id}-${fila.idx}`}
                        style={{
                          background: excluido ? '#F4F4F5' : '#FFFFFF',
                          border: excluido ? '1px dashed #D4D4D8' : '1px solid #E4E4E7',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          opacity: excluido ? 0.68 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            justifyContent: 'space-between',
                          }}
                        >
                          {/* Miniatura con vista ampliada */}
                          <button
                            type="button"
                            onClick={() => abrirInspeccionExtra(fila.prodHijo)}
                            title={`Ver foto ampliada de ${fila.prodHijo.nombre}`}
                            aria-label={`Ver foto de ${fila.prodHijo.nombre}`}
                            style={{
                              position: 'relative',
                              width: '54px',
                              height: '54px',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '1px solid #E4E4E7',
                              padding: 0,
                              background: '#F4F4F5',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={fila.miniatura}
                              alt={fila.prodHijo.nombre}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                background: 'rgba(24,24,27,0.72)',
                                color: '#FFFFFF',
                                borderRadius: '999px',
                                padding: '2px 4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <Eye size={10} />
                            </span>
                          </button>

                          {/* Nombre y precio individual */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.86rem',
                                fontWeight: 700,
                                color: '#18181B',
                                lineHeight: 1.25,
                              }}
                            >
                              {modoCompraCombo === 'set_completo' && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    background: '#EDE9FE',
                                    color: '#5B21B6',
                                    borderRadius: '6px',
                                    padding: '1px 6px',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    marginRight: '6px',
                                  }}
                                >
                                  {fila.comp.cantidad_base}×
                                </span>
                              )}
                              {fila.prodHijo.nombreBase || fila.prodHijo.nombre}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '6px',
                                marginTop: '3px',
                                fontSize: '0.76rem',
                                color: '#52525B',
                              }}
                            >
                              {modoCompraCombo === 'set_completo' &&
                                fila.prodHijo.variantes.length > 1 && (
                                  <span
                                    style={{
                                      background: '#F4F4F5',
                                      color: '#3F3F46',
                                      padding: '1px 7px',
                                      borderRadius: '999px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {fila.varBaseSet.nombre}
                                  </span>
                                )}
                              <span>
                                Unitario:{' '}
                                {modoCompraCombo === 'personalizado' &&
                                fila.calcPersonalizado.tieneDescuentoVolumen ? (
                                  <>
                                    <span
                                      style={{
                                        textDecoration: 'line-through',
                                        opacity: 0.6,
                                        marginRight: '4px',
                                      }}
                                    >
                                      ${pvpUnitSinDesc.toFixed(2)}
                                    </span>
                                    <strong style={{ color: '#047857' }}>
                                      ${pvpUnitConDesc.toFixed(2)}
                                    </strong>
                                  </>
                                ) : (
                                  <strong>${pvpUnitSinDesc.toFixed(2)}</strong>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Subtotal o Controles de Cantidad */}
                          {modoCompraCombo === 'set_completo' ? (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.86rem',
                                  fontWeight: 700,
                                  color: '#27272A',
                                }}
                              >
                                ${subtotalElemento.toFixed(2)}
                              </div>
                              {fila.comp.cantidad_base > 1 && (
                                <div style={{ fontSize: '0.68rem', color: '#71717A' }}>
                                  ({fila.comp.cantidad_base} × ${fila.pvpBaseSetUnit.toFixed(2)})
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: '4px',
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  border: '1px solid #D4D4D8',
                                  borderRadius: '999px',
                                  background: '#FFFFFF',
                                  overflow: 'hidden',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSeleccionCombo((prev) => ({
                                      ...prev,
                                      [fila.idx]: {
                                        sku: fila.varElegida.sku,
                                        cantidad: Math.max(0, fila.cantidadElegida - 1),
                                      },
                                    }))
                                  }
                                  title="Disminuir cantidad"
                                  aria-label={`Disminuir cantidad de ${fila.prodHijo.nombre}`}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '5px 8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: '#27272A',
                                  }}
                                >
                                  <Minus size={13} />
                                </button>
                                <span
                                  style={{
                                    minWidth: '24px',
                                    textAlign: 'center',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    color: '#18181B',
                                  }}
                                >
                                  {fila.cantidadElegida}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSeleccionCombo((prev) => ({
                                      ...prev,
                                      [fila.idx]: {
                                        sku: fila.varElegida.sku,
                                        cantidad: fila.cantidadElegida + 1,
                                      },
                                    }))
                                  }
                                  title="Aumentar cantidad"
                                  aria-label={`Aumentar cantidad de ${fila.prodHijo.nombre}`}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '5px 8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: '#27272A',
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  color: excluido ? '#A1A1AA' : '#18181B',
                                }}
                              >
                                {excluido ? 'No incluido' : `$${subtotalElemento.toFixed(2)}`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Selector de Variación (S / M / L / XL) en modo Personalizar */}
                        {modoCompraCombo === 'personalizado' &&
                          fila.prodHijo.variantes.length > 1 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                paddingTop: '6px',
                                borderTop: '1px dashed #F4F4F5',
                              }}
                            >
                              {fila.prodHijo.variantes.map((vHijo) => {
                                const activaVar = vHijo.sku === fila.varElegida.sku;
                                return (
                                  <button
                                    key={vHijo.sku}
                                    type="button"
                                    onClick={() =>
                                      setSeleccionCombo((prev) => ({
                                        ...prev,
                                        [fila.idx]: {
                                          sku: vHijo.sku,
                                          cantidad:
                                            fila.cantidadElegida > 0 ? fila.cantidadElegida : 1,
                                        },
                                      }))
                                    }
                                    title={`Elegir ${vHijo.nombre} ($${vHijo.pvp.toFixed(2)})`}
                                    aria-label={`Elegir ${vHijo.nombre}`}
                                    style={{
                                      padding: '4px 9px',
                                      borderRadius: '999px',
                                      border: activaVar
                                        ? '1.5px solid #18181B'
                                        : '1px solid #E4E4E7',
                                      background: activaVar ? '#18181B' : '#FAFAFA',
                                      color: activaVar ? '#FFFFFF' : '#3F3F46',
                                      fontSize: '0.73rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {vHijo.nombre} · ${vHijo.pvp.toFixed(2)}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        {/* Etiquetas de descuento por volumen del componente */}
                        {escalasVar.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '6px',
                              alignItems: 'center',
                            }}
                          >
                            {escalasVar.map((esc, idxEsc) => {
                              const activaEsc =
                                modoCompraCombo === 'personalizado' &&
                                fila.calcPersonalizado.escalaAplicada?.min_cantidad ===
                                  esc.min_cantidad;
                              return (
                                <span
                                  key={idxEsc}
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    background: activaEsc ? '#DCFCE7' : '#F0FDF4',
                                    color: '#047857',
                                    border: activaEsc
                                      ? '1px solid #34D399'
                                      : '1px dashed #A7F3D0',
                                  }}
                                >
                                  🏷️ {describirEscalaVolumen(esc, pvpUnitSinDesc)}{' '}
                                  {activaEsc ? '✓ Aplicado' : ''}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Resumen Financiero del Set / Selección */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #DDD6FE',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '0.8rem',
                  }}
                >
                  {modoCompraCombo === 'set_completo' ? (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: '#71717A',
                        }}
                      >
                        <span>Suma de elementos por separado:</span>
                        <span style={{ textDecoration: 'line-through' }}>
                          ${resumenFinancieroCombo.sumaSetNominal.toFixed(2)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 800,
                          color: '#5B21B6',
                          fontSize: '0.9rem',
                        }}
                      >
                        <span>
                          Precio Set Completo (-{resumenFinancieroCombo.porcentajeDescuentoSet}%):
                        </span>
                        <span>${resumenFinancieroCombo.pvpSet.toFixed(2)}</span>
                      </div>
                    </>
                  ) : resumenFinancieroCombo.coincideExactoConSetBase &&
                    resumenFinancieroCombo.pvpSet <
                      resumenFinancieroCombo.sumaPersonalizadaFinal ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#5B21B6',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>
                        Tu selección coincide con el Set Completo: aplicamos automáticamente la tarifa preferencial de{' '}
                        <strong>${resumenFinancieroCombo.pvpSet.toFixed(2)}</strong>.
                      </span>
                    </div>
                  ) : (
                    <>
                      {resumenFinancieroCombo.ahorroVolumenPersonalizado > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: '#047857',
                            fontWeight: 600,
                          }}
                        >
                          <span>Ahorro automático por cantidad:</span>
                          <span>
                            -${resumenFinancieroCombo.ahorroVolumenPersonalizado.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 800,
                          color: '#18181B',
                          fontSize: '0.9rem',
                        }}
                      >
                        <span>
                          Total selección ({resumenFinancieroCombo.totalPiezasPersonalizadas}{' '}
                          {resumenFinancieroCombo.totalPiezasPersonalizadas === 1
                            ? 'pieza'
                            : 'piezas'}
                          ):
                        </span>
                        <span>${resumenFinancieroCombo.sumaPersonalizadaFinal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {!esComboActivo && producto.variantes.length > 1 && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  background: '#FAF8F5',
                  border: '1px solid #EAE6DF',
                  borderRadius: '14px',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#52525B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '8px',
                  }}
                >
                  Presentación / Tamaño
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {producto.variantes.map((v) => {
                    const activa = v.sku === varianteSeleccionada.sku;
                    return (
                      <button
                        key={v.sku}
                        type="button"
                        onClick={() => seleccionarVarianteModal(v)}
                        title={`Seleccionar ${v.nombre} ($${v.pvp.toFixed(2)})`}
                        aria-label={`Seleccionar ${v.nombre}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 12px',
                          borderRadius: '999px',
                          border: activa ? '1.5px solid #27272A' : '1px solid #E4E4E7',
                          background: activa ? '#27272A' : '#FFFFFF',
                          color: activa ? '#FFFFFF' : '#27272A',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{v.nombre.trim()}</span>
                        <span
                          style={{
                            fontWeight: 700,
                            opacity: activa ? 0.9 : 0.72,
                          }}
                        >
                          ${v.pvp.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cantidad y Escalas de Descuento por Volumen (Producto Individual) */}
            {!esComboActivo && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  background:
                    (varianteSeleccionada.escalasVolumen?.length ?? 0) > 0 ? '#F0FDF4' : '#FAF8F5',
                  border:
                    (varianteSeleccionada.escalasVolumen?.length ?? 0) > 0
                      ? '1px solid #A7F3D0'
                      : '1px solid #EAE6DF',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#3F3F46',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Cantidad
                    </span>
                    {calculoVolumenIndividual.tieneDescuentoVolumen && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#047857',
                        }}
                      >
                        ✓ Ahorras ${calculoVolumenIndividual.ahorroTotalLinea.toFixed(2)} por volumen
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      border: '1px solid #D4D4D8',
                      borderRadius: '999px',
                      background: '#FFFFFF',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCantidadModal((prev) => Math.max(1, prev - 1))}
                      title="Disminuir cantidad"
                      aria-label="Disminuir cantidad"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: '#27272A',
                      }}
                    >
                      <Minus size={14} />
                    </button>
                    <span
                      style={{
                        minWidth: '28px',
                        textAlign: 'center',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: '#18181B',
                      }}
                    >
                      {cantidadModal}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCantidadModal((prev) => prev + 1)}
                      title="Aumentar cantidad"
                      aria-label="Aumentar cantidad"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: '#27272A',
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {varianteSeleccionada.escalasVolumen &&
                  varianteSeleccionada.escalasVolumen.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        paddingTop: '6px',
                        borderTop: '1px dashed #A7F3D0',
                      }}
                    >
                      {varianteSeleccionada.escalasVolumen.map((esc, idxEsc) => {
                        const activaEsc =
                          calculoVolumenIndividual.escalaAplicada?.min_cantidad ===
                          esc.min_cantidad;
                        return (
                          <button
                            key={idxEsc}
                            type="button"
                            onClick={() => setCantidadModal(esc.min_cantidad)}
                            title={`Seleccionar ${esc.min_cantidad} unidades para activar este descuento`}
                            aria-label={`Aplicar descuento llevando ${esc.min_cantidad} unidades`}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              border: activaEsc ? '1.5px solid #059669' : '1px solid #6EE7B7',
                              background: activaEsc ? '#059669' : '#FFFFFF',
                              color: activaEsc ? '#FFFFFF' : '#047857',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            🏷️{' '}
                            {describirEscalaVolumen(
                              esc,
                              varianteSeleccionada.pvpNominalSinVolumen ??
                                varianteSeleccionada.pvp
                            )}{' '}
                            {activaEsc ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            {varianteSeleccionada.detalle &&
              !varianteSeleccionada.detalle.toLowerCase().includes('payphone') &&
              !varianteSeleccionada.detalle.toLowerCase().includes('tarjeta') && (
                <div
                  className="detalle-variante-destacado"
                  style={{
                    background: 'rgba(235, 78, 126, 0.08)',
                    borderLeft: '3px solid #eb4e7e',
                    padding: '9px 14px',
                    borderRadius: '6px',
                    margin: '10px 0 14px',
                    fontSize: '0.92rem',
                    fontWeight: 500,
                    color: 'var(--tinta-fuerte, #222)',
                  }}
                >
                  ✨ <strong>Detalle:</strong> {varianteSeleccionada.detalle}
                </div>
              )}

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

            {/* Tarjeta de Dedicatoria Personalizada Opcional */}
            <div className="bloque-dedicatoria-modal">
              <div className="encabezado-dedicatoria-toggle">
                <label className="etiqueta-check-dedicatoria">
                  <input
                    type="checkbox"
                    checked={incluirDedicatoria}
                    onChange={(e) => setIncluirDedicatoria(e.target.checked)}
                  />
                  <span>1. Agregar Tarjeta de Dedicatoria Impresa (Gratis)</span>
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
                    2. ¿Deseas acompañar tu arreglo con algún detalle?
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
              {(() => {
                const sumaExtras = complementosSeleccionados.reduce((acc, cId) => {
                  const c = productosComplementos.find((p) => p.id === cId);
                  const varC = c
                    ? variantesExtrasElegidas[cId] || obtenerVarianteComplemento(c)
                    : null;
                  return acc + (varC?.pvp ?? 0);
                }, 0);

                const usarSetCerradoBtn =
                  esComboActivo &&
                  (modoCompraCombo === 'set_completo' ||
                    (resumenFinancieroCombo.coincideExactoConSetBase &&
                      resumenFinancieroCombo.pvpSet <=
                        resumenFinancieroCombo.sumaPersonalizadaFinal));

                const subtotalBaseBoton = esComboActivo
                  ? usarSetCerradoBtn
                    ? resumenFinancieroCombo.pvpSet
                    : resumenFinancieroCombo.sumaPersonalizadaFinal
                  : calculoVolumenIndividual.subtotalLineaFinal;

                const totalBoton = Number((subtotalBaseBoton + sumaExtras).toFixed(2));
                const sinPiezasCombo =
                  esComboActivo &&
                  modoCompraCombo === 'personalizado' &&
                  resumenFinancieroCombo.totalPiezasPersonalizadas <= 0;

                const etiquetaAccion = sinPiezasCombo
                  ? 'Elige 1 pieza'
                  : esComboActivo
                  ? usarSetCerradoBtn
                    ? `Agregar Set — $${totalBoton.toFixed(2)}`
                    : `Agregar Selección — $${totalBoton.toFixed(2)}`
                  : `Agregar al Carrito — $${totalBoton.toFixed(2)}`;

                return (
                  <button
                    type="button"
                    className="btn btn-primario btn-agregar-modal-grande"
                    onClick={handleAgregarAlCarrito}
                    disabled={sinPiezasCombo}
                    title={etiquetaAccion}
                    aria-label={etiquetaAccion}
                    style={
                      sinPiezasCombo
                        ? { opacity: 0.55, cursor: 'not-allowed' }
                        : undefined
                    }
                  >
                    <ShoppingBag size={20} />
                    <span>{etiquetaAccion}</span>
                  </button>
                );
              })()}
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
                {esComboActivo &&
                componentesComboResueltos.some((c) => c.prodHijo.id === extraParaInspeccionar.id) ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primario btn-agregar-extra-preview"
                      onClick={() => {
                        setModoCompraCombo('personalizado');
                        cerrarInspeccionExtra();
                      }}
                      title="Personalizar cantidades o tamaños en el Set"
                      aria-label="Personalizar en el Set"
                    >
                      <Sliders size={16} />
                      <span>Personalizar en Set</span>
                    </button>
                    <button
                      type="button"
                      className="btn-volver-arreglo"
                      onClick={cerrarInspeccionExtra}
                      title="Volver al Set"
                      aria-label="Volver al Set"
                    >
                      Volver al Set
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
