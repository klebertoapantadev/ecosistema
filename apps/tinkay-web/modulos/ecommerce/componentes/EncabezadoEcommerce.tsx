'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  obtenerEstadoRegaloPrimeraCompraAction,
  type EstadoRegaloPrimeraCompra,
} from '@eco/comercio';
import { CampanaNotificaciones } from '@eco/notificaciones';
import { crearClienteNavegador } from '@eco/supabase';
import { useCarrito } from '../contexto-carrito';
import {
  IconoWhatsappVector,
  abrirWhatsappTiendaConPuenteOmnicanal,
} from '../puente-omnicanal-cliente';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import {
  CLASIFICACIONES_PRINCIPALES_TINKAY,
  esProductoEntregaInmediata,
  expandirProductosVitrina,
  obtenerCategoriasVisibles,
  obtenerClasificacionPrincipalDeCategoria,
  obtenerEtiquetasBusquedaDisponibles,
  obtenerPvpProducto,
  obtenerSubcategoriasDeClasificacion,
  productoCoincideConBusqueda,
  productoCoincideConCategoria,
  productoCoincideConEtiquetas,
  productoTieneOferta,
} from '../filtrado-catalogo';
import {
  ShoppingBag,
  Feather,
  FileText,
  Menu,
  X,
  User,
  MapPin,
  Package,
  Gift,
  ShoppingCart,
  Heart,
  Flame,
  Zap,
  Search,
  SlidersHorizontal,
  Sparkles,
  Layers,
  Tag,
  Hash,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

const PRESUPUESTOS_FILTRO = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'menor-30', etiqueta: 'Hasta $30' },
  { id: '30-50', etiqueta: '$30 – $50' },
  { id: '50-80', etiqueta: '$50 – $80' },
  { id: 'mayor-80', etiqueta: 'Más de $80' },
] as const;

export function EncabezadoEcommerce() {
  const {
    cantidadTotal,
    cantidadTotalProforma,
    setDrawerAbierto,
    setDrawerProformaAbierto,
    productos,
    categorias,
    categoriaActiva,
    setCategoriaActiva,
    terminoBusqueda,
    setTerminoBusqueda,
    filtroPresupuesto,
    setFiltroPresupuesto,
    criterioOrden,
    setCriterioOrden,
    etiquetasActivas,
    setEtiquetasActivas,
    toggleEtiquetaActiva,
    filtrosPanelAbierto,
    setFiltrosPanelAbierto,
    limpiarFiltrosCatalogo,
    navegarACategoria,
    configLogistica,
    configTiendaCheckout,
    productoSeleccionadoModal,
    obtenerEnlaceProducto,
    favoritosIds,
    totalFavoritos,
  } = useCarrito();

  const [estadoRegalo, setEstadoRegalo] = useState<EstadoRegaloPrimeraCompra | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);
  const yaDesplazoEnBusquedaRef = useRef<boolean>(false);

  const desplazarACatalogo = () => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById('catalogo');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Desplazar solo si el catálogo aún está debajo del borde visible superior
    if (rect.top > 180 || rect.bottom < 120) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!menuMovilAbierto && !filtrosPanelAbierto) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuMovilAbierto(false);
        setFiltrosPanelAbierto(false);
      }
    };
    window.addEventListener('keydown', alEscape);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', alEscape);
    };
  }, [menuMovilAbierto, filtrosPanelAbierto, setFiltrosPanelAbierto]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get('code');
    if (code && window.location.pathname === '/') {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=%2Fpanel`);
      return;
    }
    const hash = window.location.hash || '';
    if (hash.includes('access_token=')) {
      const supabase = crearClienteNavegador();
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (data?.session) {
            window.location.replace('/panel');
          }
        })
        .catch(() => {});
    } else if (hash.includes('error_description=') || sp.get('error_description')) {
      const hp = new URLSearchParams(hash.replace(/^#/, ''));
      const errMsg = hp.get('error_description') || sp.get('error_description') || 'Error de autenticación';
      window.location.replace(`/ingresar?error=${encodeURIComponent(errMsg)}`);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    const cargarEstado = () => {
      obtenerEstadoRegaloPrimeraCompraAction('tinkay')
        .then((res) => {
          if (!cancelado) setEstadoRegalo(res);
        })
        .catch(() => {});
    };
    cargarEstado();
    if (typeof window !== 'undefined') {
      window.addEventListener('eco:refrescar-notificaciones', cargarEstado);
    }
    return () => {
      cancelado = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('eco:refrescar-notificaciones', cargarEstado);
      }
    };
  }, []);

  const catalogoProductos = useMemo(
    () => (productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY),
    [productos]
  );
  const catalogoCategorias = useMemo(
    () => (categorias && categorias.length > 0 ? categorias : CATEGORIAS_TINKAY),
    [categorias]
  );

  const productosBaseDesplegados = useMemo(
    () => expandirProductosVitrina(catalogoProductos),
    [catalogoProductos]
  );

  const {
    categoriasVisibles,
    subcategoriasFlorales,
    totalOfertas,
    totalEntregaInmediata,
  } = useMemo(() => {
    const visibles = obtenerCategoriasVisibles(catalogoCategorias, productosBaseDesplegados);
    const subFlorales = obtenerSubcategoriasDeClasificacion(
      'grupo-arreglos-florales',
      visibles,
      productosBaseDesplegados
    );
    const ofertas = productosBaseDesplegados.filter((p) => productoTieneOferta(p)).length;
    const inmediata = productosBaseDesplegados.filter((p) => esProductoEntregaInmediata(p)).length;
    return {
      categoriasVisibles: visibles,
      subcategoriasFlorales: subFlorales,
      totalOfertas: ofertas,
      totalEntregaInmediata: inmediata,
    };
  }, [catalogoCategorias, productosBaseDesplegados]);

  const clasificacionActiva = useMemo(
    () => obtenerClasificacionPrincipalDeCategoria(categoriaActiva, categoriasVisibles),
    [categoriaActiva, categoriasVisibles]
  );

  const subcategoriasActivas = useMemo(
    () =>
      obtenerSubcategoriasDeClasificacion(
        clasificacionActiva,
        categoriasVisibles,
        productosBaseDesplegados
      ),
    [clasificacionActiva, categoriasVisibles, productosBaseDesplegados]
  );

  const coleccionesParaFiltros = useMemo(() => {
    if (subcategoriasActivas.length > 0) return subcategoriasActivas;
    return categoriasVisibles.filter((c) => c.id !== 'cat-todos');
  }, [subcategoriasActivas, categoriasVisibles]);

  const coincideConCategoria = (
    p: (typeof productosBaseDesplegados)[number],
    catId: string
  ) => {
    if (catId === 'cat-todos') return true;
    if (catId === 'grupo-favoritos') return favoritosIds.includes(p.id);
    return productoCoincideConCategoria(p, catId, catalogoCategorias);
  };

  const handleCambioBusqueda = (nuevoValor: string) => {
    setTerminoBusqueda(nuevoValor);
    const limpio = nuevoValor.trim();
    if (!limpio) {
      yaDesplazoEnBusquedaRef.current = false;
      return;
    }

    if (!yaDesplazoEnBusquedaRef.current) {
      yaDesplazoEnBusquedaRef.current = true;
      desplazarACatalogo();
    }

    const hayEnAmbitoActual = productosBaseDesplegados.some(
      (p) =>
        coincideConCategoria(p, categoriaActiva) &&
        productoCoincideConEtiquetas(p, etiquetasActivas) &&
        productoCoincideConBusqueda(p, limpio, catalogoCategorias)
    );
    if (hayEnAmbitoActual) return;

    if (etiquetasActivas.length > 0) {
      const haySinEtiquetas = productosBaseDesplegados.some(
        (p) =>
          coincideConCategoria(p, categoriaActiva) &&
          productoCoincideConBusqueda(p, limpio, catalogoCategorias)
      );
      if (haySinEtiquetas) {
        setEtiquetasActivas([]);
        return;
      }
    }

    if (categoriaActiva !== 'cat-todos') {
      const hayEnTodoCatalogo = productosBaseDesplegados.some((p) =>
        productoCoincideConBusqueda(p, limpio, catalogoCategorias)
      );
      if (hayEnTodoCatalogo) {
        setCategoriaActiva('cat-todos');
        if (etiquetasActivas.length > 0) {
          setEtiquetasActivas([]);
        }
      }
    }
  };

  const productosAmbitoFiltros = useMemo(() => {
    return productosBaseDesplegados.filter((p) => {
      if (categoriaActiva === 'grupo-favoritos') {
        if (!favoritosIds.includes(p.id)) return false;
      } else if (categoriaActiva !== 'cat-todos') {
        if (!productoCoincideConCategoria(p, categoriaActiva, catalogoCategorias)) {
          return false;
        }
      }

      if (terminoBusqueda.trim()) {
        if (!productoCoincideConBusqueda(p, terminoBusqueda, catalogoCategorias)) {
          return false;
        }
      }

      if (filtroPresupuesto !== 'todos') {
        const pvp = obtenerPvpProducto(p);
        if (filtroPresupuesto === 'menor-30' && pvp > 30) return false;
        if (filtroPresupuesto === '30-50' && (pvp < 30 || pvp > 50)) return false;
        if (filtroPresupuesto === '50-80' && (pvp < 50 || pvp > 80)) return false;
        if (filtroPresupuesto === 'mayor-80' && pvp < 80) return false;
      }

      return true;
    });
  }, [
    categoriaActiva,
    terminoBusqueda,
    filtroPresupuesto,
    favoritosIds,
    productosBaseDesplegados,
    catalogoCategorias,
  ]);

  const etiquetasDisponibles = useMemo(() => {
    const base = obtenerEtiquetasBusquedaDisponibles(productosAmbitoFiltros);
    if (etiquetasActivas.length === 0) return base;
    const existentes = new Set(base.map((e) => e.clave));
    const extrasActivas = etiquetasActivas
      .filter((cl) => !existentes.has(cl))
      .map((cl) => ({ clave: cl, etiqueta: cl, cantidad: 0 }));
    return [...extrasActivas, ...base];
  }, [productosAmbitoFiltros, etiquetasActivas]);

  const totalResultadosFiltros = useMemo(() => {
    if (etiquetasActivas.length === 0) return productosAmbitoFiltros.length;
    return productosAmbitoFiltros.filter((p) => productoCoincideConEtiquetas(p, etiquetasActivas))
      .length;
  }, [productosAmbitoFiltros, etiquetasActivas]);

  const cantidadFiltrosActivos =
    (categoriaActiva !== 'cat-todos' && categoriaActiva !== 'grupo-favoritos' ? 1 : 0) +
    etiquetasActivas.length +
    (criterioOrden !== 'recomendados' ? 1 : 0) +
    (filtroPresupuesto !== 'todos' ? 1 : 0);

  const handleSeleccionMenu = (e: React.MouseEvent<HTMLAnchorElement>, catId: string) => {
    e.preventDefault();
    navegarACategoria(catId);
  };

  const handleSeleccionCategoriaRapida = (catId: string) => {
    if (catId === 'grupo-favoritos' && categoriaActiva === 'grupo-favoritos') {
      navegarACategoria('cat-todos');
      return;
    }
    navegarACategoria(catId);
  };

  const chipFiltroEstilo = (activo: boolean, variante?: 'oscuro' | 'rosa' | 'ambar' | 'verde') => {
    if (activo) {
      if (variante === 'rosa') {
        return { background: '#BE123C', border: '1px solid #BE123C', color: '#FFFFFF' };
      }
      if (variante === 'ambar') {
        return { background: '#B45309', border: '1px solid #B45309', color: '#FFFFFF' };
      }
      if (variante === 'verde') {
        return { background: '#2F4737', border: '1px solid #2F4737', color: '#FFFFFF' };
      }
      return { background: '#1F1C19', border: '1px solid #1F1C19', color: '#FFFFFF' };
    }
    return { background: '#FAF8F5', border: '1px solid #E5DFD5', color: '#3F3A35' };
  };

  return (
    <>
      <header className="cabecera-ecommerce-tinkay">
        <div className="barra-superior-anuncio">
          <div className="anuncio-flex-contenido">
            <span>
              {estadoRegalo?.autenticado
                ? `🌸 Beneficio Cliente Registrado Activo: Envío Gratis en ${configLogistica.zonaGratisNombre || 'Centro-Norte de Quito'} ($0.00)`
                : `🌸 Regístrate gratis y activa Zona de Envío Gratis en ${configLogistica.zonaGratisNombre || 'Centro-Norte de Quito'} + Obsequio en 1ra compra`}
            </span>
            <a
              href={configLogistica.origenMapaUrl || 'https://maps.app.goo.gl/D56gQohzuwha4sLf8'}
              target="_blank"
              rel="noopener noreferrer"
              className="enlace-tienda-maps-top"
              title="Ver ubicación de tienda física Tinkay en Google Maps"
            >
              📍 Ver Tienda Física en Quito (Maps)
            </a>
          </div>
        </div>

        {/* Fila 1: Menú, Logo y Carrito */}
        <div className="contenedor-cabecera-principal">
          <div className="cabecera-marca-y-menu">
            <button
              type="button"
              className="btn-menu-movil-ecommerce"
              onClick={() => setMenuMovilAbierto(true)}
              title="Abrir menú de categorías y opciones"
              aria-label="Abrir menú"
              aria-expanded={menuMovilAbierto}
            >
              <Menu size={20} />
            </button>

            <Link href="/" className="logo-tinkay-marca" aria-label="Tinkay Flores y Eventos">
              <img
                src="/img/logo/tinkay-logo.png?v=2"
                alt="Tinkay Flores y Eventos"
                className="logo-tinkay-imagen-cabecera"
              />
              <span className="sr-only">Tinkay Flores y Eventos</span>
            </Link>
          </div>

          <div className="acciones-usuario-cabecera">
            {(cantidadTotalProforma > 0 ||
              clasificacionActiva === 'grupo-eventos' ||
              (categoriaActiva || '').toLowerCase().includes('evento')) && (
              <button
                type="button"
                className="btn-carrito-cabecera btn-responsive-accion"
                onClick={() => setDrawerProformaAbierto(true)}
                title="Abrir mi proforma de evento"
                aria-label={`Abrir proforma de evento con ${cantidadTotalProforma} elementos`}
                style={{
                  background: '#2D4734',
                  color: '#FFFFFF',
                  borderColor: '#2D4734',
                }}
              >
                <FileText size={19} />
                <span className="texto-carrito-btn btn-texto-responsive">Proforma</span>
                {cantidadTotalProforma > 0 && (
                  <span
                    className="badge-cantidad-carrito"
                    style={{ background: '#FDE68A', color: '#1F2937' }}
                  >
                    {cantidadTotalProforma}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              className="btn-carrito-cabecera btn-responsive-accion"
              onClick={() => setDrawerAbierto(true)}
              title="Ver carrito de compras"
              aria-label={`Ver carrito de compras con ${cantidadTotal} productos`}
            >
              <ShoppingBag size={20} />
              <span className="texto-carrito-btn btn-texto-responsive">Carrito</span>
              {cantidadTotal > 0 && (
                <span className="badge-cantidad-carrito">{cantidadTotal}</span>
              )}
            </button>
          </div>
        </div>

        {/* ================================================================
            BARRA ÚNICA DE BÚSQUEDA:
            - Arriba: Búsqueda libre + ícono de Filtros
            - Abajo: Me gusta (cliente) + categorías base en 1 línea deslizable
            ================================================================ */}
        <div className="barra-unificada-busqueda-cabecera">
          <div className="fila-buscador-y-filtros">
            <Search size={17} color="#78716C" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={terminoBusqueda}
              onChange={(e) => handleCambioBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  desplazarACatalogo();
                }
              }}
              placeholder="Busca por ocasión, flores, color, precio..."
              className="input-busqueda-unificada"
              aria-label="Buscar por ocasión, flores, color o precio"
            />
            {terminoBusqueda && (
              <button
                type="button"
                onClick={() => {
                  setTerminoBusqueda('');
                  yaDesplazoEnBusquedaRef.current = false;
                }}
                className="btn-limpiar-busqueda-unificada"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
            <span className="divisor-buscador-filtros" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setFiltrosPanelAbierto((prev) => !prev)}
              aria-expanded={filtrosPanelAbierto}
              aria-haspopup="dialog"
              title="Abrir filtros por categoría, colecciones, etiquetas, más solicitados y presupuesto"
              aria-label="Filtros"
              className={`btn-icono-filtros-unificado ${
                filtrosPanelAbierto || cantidadFiltrosActivos > 0 ? 'activo' : ''
              }`}
            >
              <SlidersHorizontal size={16} />
              <span className="texto-btn-filtros">Filtros</span>
              {cantidadFiltrosActivos > 0 && (
                <span className="badge-filtros-icono">{cantidadFiltrosActivos}</span>
              )}
            </button>
          </div>

          <nav
            className="franja-categorias-movil"
            aria-label="Me gusta del cliente y categorías base"
          >
            {/* 1. Me gusta (cliente) siempre al inicio de la línea deslizable */}
            <button
              type="button"
              onClick={() => handleSeleccionCategoriaRapida('grupo-favoritos')}
              aria-pressed={clasificacionActiva === 'grupo-favoritos'}
              title={
                totalFavoritos > 0
                  ? `Ver mis ${totalFavoritos} arreglos marcados con Me gusta`
                  : 'Ver mis arreglos marcados con Me gusta'
              }
              aria-label="Me gusta"
              className={[
                'chip-cat-cabecera-movil favoritos',
                totalFavoritos > 0 ? 'con-likes' : '',
                clasificacionActiva === 'grupo-favoritos' ? 'activa' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Heart
                size={13}
                fill={
                  clasificacionActiva === 'grupo-favoritos' || totalFavoritos > 0
                    ? 'currentColor'
                    : 'none'
                }
              />
              <span>Me gusta</span>
              {totalFavoritos > 0 && (
                <span className="badge-chip-movil">{totalFavoritos}</span>
              )}
            </button>

            {/* 2. Categorías base en la misma línea deslizable */}
            {CLASIFICACIONES_PRINCIPALES_TINKAY.map((clasif) => {
              const estaActiva = clasificacionActiva === clasif.id;
              return (
                <a
                  key={clasif.id}
                  href={`/categoria/${clasif.slug}`}
                  onClick={(e) => handleSeleccionMenu(e, clasif.id)}
                  aria-current={estaActiva ? 'true' : undefined}
                  title={`${clasif.nombre} (${clasif.subtitulo})`}
                  className={[
                    'chip-cat-cabecera-movil',
                    clasif.modoVisualSobrio ? 'condolencias' : '',
                    estaActiva ? 'activa' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {clasif.modoVisualSobrio && <Feather size={13} />}
                  <span>{clasif.nombre}</span>
                </a>
              );
            })}

            {totalOfertas > 0 && (
              <a
                href="/categoria/ofertas"
                onClick={(e) => handleSeleccionMenu(e, 'grupo-ofertas')}
                aria-current={clasificacionActiva === 'grupo-ofertas' ? 'true' : undefined}
                className={[
                  'chip-cat-cabecera-movil ofertas',
                  clasificacionActiva === 'grupo-ofertas' ? 'activa' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Flame size={13} />
                <span>Ofertas</span>
                <span className="badge-chip-movil">{totalOfertas}</span>
              </a>
            )}

            {totalEntregaInmediata > 0 && (
              <a
                href="/categoria/entrega-inmediata"
                onClick={(e) => handleSeleccionMenu(e, 'grupo-entrega-inmediata')}
                aria-current={
                  clasificacionActiva === 'grupo-entrega-inmediata' ? 'true' : undefined
                }
                className={[
                  'chip-cat-cabecera-movil',
                  clasificacionActiva === 'grupo-entrega-inmediata' ? 'activa' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Zap size={13} />
                <span>Entrega Inmediata</span>
              </a>
            )}

            <a
              href="#catalogo"
              onClick={(e) => handleSeleccionMenu(e, 'cat-todos')}
              aria-current={clasificacionActiva === 'cat-todos' ? 'true' : undefined}
              className={[
                'chip-cat-cabecera-movil',
                clasificacionActiva === 'cat-todos' ? 'activa' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>Todo</span>
            </a>
          </nav>
        </div>
      </header>

      {/* ====================================================================
          MODAL / HOJA DE FILTROS ESTRUCTURADOS (fuera de header para fixed 100dvh)
          ==================================================================== */}
      {filtrosPanelAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros del catálogo Tinkay"
          onClick={() => setFiltrosPanelAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(24, 20, 18, 0.5)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '12px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '86dvh',
              background: '#FFFFFF',
              borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Cabecera modal filtros */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid #ECE7DF',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={17} color="#1F1C19" />
                <strong style={{ fontSize: '0.96rem', color: '#1F1C19' }}>Filtros</strong>
                {cantidadFiltrosActivos > 0 && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: '#FDF2F8',
                      color: '#BE123C',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {cantidadFiltrosActivos} activos
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFiltrosPanelAbierto(false)}
                aria-label="Cerrar filtros"
                title="Cerrar filtros"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: '1px solid #E5DFD5',
                  background: '#FAF8F5',
                  color: '#1F1C19',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Cuerpo deslizable con las 5 secciones ordenadas */}
            <div
              style={{
                padding: '16px 18px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* 1. Categorías */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    color: '#221E1B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Sparkles size={13} />
                  <span>Categorías</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  <button
                    type="button"
                    onClick={() => setCategoriaActiva('cat-todos')}
                    style={{
                      ...chipFiltroEstilo(categoriaActiva === 'cat-todos'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Todo
                  </button>
                  {CLASIFICACIONES_PRINCIPALES_TINKAY.map((clasif) => (
                    <button
                      key={clasif.id}
                      type="button"
                      onClick={() => setCategoriaActiva(clasif.id)}
                      style={{
                        ...chipFiltroEstilo(clasificacionActiva === clasif.id),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {clasif.modoVisualSobrio && <Feather size={13} />}
                      <span>{clasif.nombre}</span>
                    </button>
                  ))}
                  {totalOfertas > 0 && (
                    <button
                      type="button"
                      onClick={() => setCategoriaActiva('grupo-ofertas')}
                      style={{
                        ...chipFiltroEstilo(clasificacionActiva === 'grupo-ofertas', 'rosa'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Flame size={13} />
                      <span>Ofertas ({totalOfertas})</span>
                    </button>
                  )}
                  {totalEntregaInmediata > 0 && (
                    <button
                      type="button"
                      onClick={() => setCategoriaActiva('grupo-entrega-inmediata')}
                      style={{
                        ...chipFiltroEstilo(
                          clasificacionActiva === 'grupo-entrega-inmediata',
                          'verde'
                        ),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Zap size={13} />
                      <span>Entrega Inmediata</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Colecciones */}
              {coleccionesParaFiltros.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    paddingTop: '10px',
                    borderTop: '1px solid #F0EBE3',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      color: '#221E1B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Layers size={13} />
                    <span>Colecciones</span>
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setCategoriaActiva(
                          clasificacionActiva === 'cat-todos' ? 'cat-todos' : clasificacionActiva
                        )
                      }
                      style={{
                        ...chipFiltroEstilo(
                          categoriaActiva === clasificacionActiva || categoriaActiva === 'cat-todos',
                          'verde'
                        ),
                        padding: '6px 11px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Todas
                    </button>
                    {coleccionesParaFiltros.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setCategoriaActiva(sub.id)}
                        style={{
                          ...chipFiltroEstilo(categoriaActiva === sub.id, 'verde'),
                          padding: '6px 11px',
                          borderRadius: '999px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {sub.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Etiquetas */}
              {etiquetasDisponibles.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    paddingTop: '10px',
                    borderTop: '1px solid #F0EBE3',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        color: '#221E1B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <Tag size={13} />
                      <span>Etiquetas</span>
                    </span>
                    {etiquetasActivas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEtiquetasActivas([])}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#BE123C',
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {etiquetasDisponibles.map((item) => {
                      const activa = etiquetasActivas.includes(item.clave);
                      return (
                        <button
                          key={item.clave}
                          type="button"
                          aria-pressed={activa}
                          onClick={() => toggleEtiquetaActiva(item.clave)}
                          style={{
                            ...chipFiltroEstilo(activa),
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Hash size={11} />
                          <span>{item.etiqueta}</span>
                          {activa && <X size={11} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Popularidad y Orden (Más solicitados / Más Me gusta) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  paddingTop: '10px',
                  borderTop: '1px solid #F0EBE3',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    color: '#221E1B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <TrendingUp size={13} />
                  <span>Popularidad y Orden</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setCriterioOrden((prev) =>
                        prev === 'mas-deseados' ? 'recomendados' : 'mas-deseados'
                      )
                    }
                    aria-pressed={criterioOrden === 'mas-deseados'}
                    style={{
                      ...chipFiltroEstilo(criterioOrden === 'mas-deseados', 'rosa'),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Heart size={13} fill="currentColor" />
                    <span>Más solicitados (Más Me gusta)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriterioOrden('recomendados')}
                    style={{
                      ...chipFiltroEstilo(criterioOrden === 'recomendados'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Recomendados
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriterioOrden('precio-asc')}
                    style={{
                      ...chipFiltroEstilo(criterioOrden === 'precio-asc'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Menor precio
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriterioOrden('precio-desc')}
                    style={{
                      ...chipFiltroEstilo(criterioOrden === 'precio-desc'),
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '0.77rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Mayor precio
                  </button>
                </div>
              </div>

              {/* 5. Presupuesto */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  paddingTop: '10px',
                  borderTop: '1px solid #F0EBE3',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    color: '#221E1B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <DollarSign size={13} />
                  <span>Presupuesto</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {PRESUPUESTOS_FILTRO.map((pres) => (
                    <button
                      key={pres.id}
                      type="button"
                      onClick={() => setFiltroPresupuesto(pres.id)}
                      style={{
                        ...chipFiltroEstilo(filtroPresupuesto === pres.id, 'ambar'),
                        padding: '6px 12px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {pres.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pie fijo del modal de filtros */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '12px 18px max(14px, env(safe-area-inset-bottom))',
                borderTop: '1px solid #ECE7DF',
                background: '#FAF8F5',
              }}
            >
              <button
                type="button"
                onClick={limpiarFiltrosCatalogo}
                style={{
                  padding: '9px 14px',
                  borderRadius: '999px',
                  border: '1px solid #D5CFC4',
                  background: '#FFFFFF',
                  color: '#57524C',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltrosPanelAbierto(false);
                  desplazarACatalogo();
                }}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#1F1C19',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver {totalResultadosFiltros}{' '}
                {totalResultadosFiltros === 1 ? 'resultado' : 'resultados'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de Navegación Lateral (fuera de header para fixed 100dvh) */}
      {menuMovilAbierto && (
        <div
          className="backdrop-menu-movil-ecommerce"
          onClick={() => setMenuMovilAbierto(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal Tinkay"
        >
          <div
            className="drawer-menu-movil-ecommerce"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--linea)',
              }}
            >
              <strong style={{ fontSize: '1.05rem', color: 'var(--tinta)' }}>
                Tinkay Floristería
              </strong>
              <button
                type="button"
                onClick={() => setMenuMovilAbierto(false)}
                title="Cerrar menú"
                aria-label="Cerrar menú"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: '1px solid var(--linea)',
                  background: '#FFFFFF',
                  color: 'var(--tinta)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--gris)',
                  marginBottom: '4px',
                }}
              >
                Clasificación Principal
              </span>
              <a
                href="/categoria/me-gusta"
                onClick={(e) => {
                  handleSeleccionMenu(e, 'grupo-favoritos');
                  setMenuMovilAbierto(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  background:
                    clasificacionActiva === 'grupo-favoritos'
                      ? 'rgba(190, 18, 60, 0.14)'
                      : '#FFF1F2',
                  color: '#BE123C',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Heart size={15} fill={totalFavoritos > 0 ? 'currentColor' : 'none'} />
                  <span>Me gusta</span>
                </span>
                {totalFavoritos > 0 && (
                  <span className="badge-nav-contador">{totalFavoritos}</span>
                )}
              </a>
              {CLASIFICACIONES_PRINCIPALES_TINKAY.map((clasif) => {
                const estaActiva = clasificacionActiva === clasif.id;
                return (
                  <a
                    key={clasif.id}
                    href={`/categoria/${clasif.slug}`}
                    onClick={(e) => {
                      handleSeleccionMenu(e, clasif.id);
                      setMenuMovilAbierto(false);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.92rem',
                      fontWeight: estaActiva ? 700 : 600,
                      background: estaActiva
                        ? clasif.modoVisualSobrio
                          ? 'rgba(61, 90, 69, 0.14)'
                          : 'rgba(236, 127, 167, 0.14)'
                        : 'transparent',
                      color: estaActiva
                        ? clasif.modoVisualSobrio
                          ? 'var(--verde)'
                          : 'var(--rosa-oscuro)'
                        : 'var(--tinta)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {clasif.modoVisualSobrio && <Feather size={15} />}
                      <span>{clasif.nombre}</span>
                    </span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--gris)' }}>
                      {clasif.subtitulo}
                    </span>
                  </a>
                );
              })}

              {totalOfertas > 0 && (
                <a
                  href="/categoria/ofertas"
                  onClick={(e) => {
                    handleSeleccionMenu(e, 'grupo-ofertas');
                    setMenuMovilAbierto(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    fontWeight: clasificacionActiva === 'grupo-ofertas' ? 700 : 600,
                    background:
                      clasificacionActiva === 'grupo-ofertas'
                        ? 'rgba(225, 29, 72, 0.14)'
                        : 'transparent',
                    color: '#BE123C',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={15} />
                    <span>Ofertas</span>
                  </span>
                  <span className="badge-nav-contador">{totalOfertas}</span>
                </a>
              )}

              {totalEntregaInmediata > 0 && (
                <a
                  href="/categoria/entrega-inmediata"
                  onClick={(e) => {
                    handleSeleccionMenu(e, 'grupo-entrega-inmediata');
                    setMenuMovilAbierto(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    fontWeight: clasificacionActiva === 'grupo-entrega-inmediata' ? 700 : 600,
                    background:
                      clasificacionActiva === 'grupo-entrega-inmediata'
                        ? 'rgba(217, 119, 6, 0.14)'
                        : 'transparent',
                    color: '#92400E',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={15} />
                    <span>Entrega Inmediata</span>
                  </span>
                </a>
              )}

              <a
                href="#catalogo"
                onClick={(e) => {
                  handleSeleccionMenu(e, 'cat-todos');
                  setMenuMovilAbierto(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '0.86rem',
                  fontWeight: clasificacionActiva === 'cat-todos' ? 700 : 600,
                  background:
                    clasificacionActiva === 'cat-todos' ? 'rgba(34, 29, 26, 0.08)' : 'transparent',
                  color: 'var(--tinta)',
                }}
              >
                <span>Todo el Catálogo</span>
              </a>

              {subcategoriasFlorales.length > 0 && (
                <>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--gris)',
                      marginTop: '10px',
                      marginBottom: '2px',
                    }}
                  >
                    Colecciones en Arreglos Florales
                  </span>
                  {subcategoriasFlorales.map((sub) => {
                    const estaActiva = categoriaActiva === sub.id;
                    return (
                      <a
                        key={sub.id}
                        href={`/categoria/${sub.slug}`}
                        onClick={(e) => {
                          handleSeleccionMenu(e, sub.id);
                          setMenuMovilAbierto(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '9px',
                          textDecoration: 'none',
                          fontSize: '0.84rem',
                          fontWeight: estaActiva ? 700 : 500,
                          background: estaActiva ? 'rgba(236, 127, 167, 0.14)' : 'transparent',
                          color: estaActiva ? 'var(--rosa-oscuro)' : 'var(--tinta)',
                        }}
                      >
                        <span>{sub.nombre}</span>
                      </a>
                    );
                  })}
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid var(--linea)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuMovilAbierto(false);
                  abrirWhatsappTiendaConPuenteOmnicanal({
                    whatsappTienda: configTiendaCheckout?.whatsappTienda,
                    productoNombre: productoSeleccionadoModal?.nombre || null,
                    productoSlug:
                      productoSeleccionadoModal?.slug || productoSeleccionadoModal?.id || null,
                    varianteNombre: productoSeleccionadoModal?.variantes?.[0]?.nombre || null,
                    precioUsd: productoSeleccionadoModal?.variantes?.[0]?.pvp ?? null,
                    urlProducto: productoSeleccionadoModal
                      ? obtenerEnlaceProducto(
                          productoSeleccionadoModal,
                          productoSeleccionadoModal.variantes?.[0]?.sku
                        )
                      : null,
                  });
                }}
                title="Contactar directo a nuestro WhatsApp"
                aria-label="WhatsApp"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid #86EFAC',
                  background: '#F0FDF4',
                  color: '#15803D',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <IconoWhatsappVector size={17} color="#16A34A" />
                <span>WhatsApp Directo</span>
              </button>

              {estadoRegalo?.autenticado && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--linea)',
                    background: '#FFFFFF',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--tinta)' }}>
                    Alertas y Notificaciones
                  </span>
                  <CampanaNotificaciones negocio="tinkay" variante="clara" />
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuMovilAbierto(false);
                  setDrawerProformaAbierto(true);
                }}
                title="Cotizar arreglos para bodas y eventos"
                aria-label="Cotizar Evento"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#2D4734',
                  color: '#FFFFFF',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <FileText size={16} />
                <span>Cotizar Evento</span>
              </button>

              {estadoRegalo?.autenticado ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--gris)',
                    }}
                  >
                    Mi Espacio Cliente
                  </span>
                  <Link
                    href="/panel"
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      background: 'rgba(61, 90, 69, 0.12)',
                      color: '#2D4734',
                    }}
                  >
                    <User size={16} />
                    <span>Abrir Mi Portal</span>
                  </Link>
                  <Link
                    href="/panel?vista=pedidos"
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      background: '#F5F9F6',
                      color: '#2D4734',
                    }}
                  >
                    <Package size={16} />
                    <span>Mis Pedidos y Entregas</span>
                  </Link>
                  <Link
                    href="/panel?vista=carrito"
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: 'var(--tinta)',
                    }}
                  >
                    <ShoppingCart size={16} />
                    <span>Ver / Editar Carrito ({cantidadTotal})</span>
                  </Link>
                  <Link
                    href="/panel?vista=proformas"
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: 'var(--tinta)',
                    }}
                  >
                    <FileText size={16} />
                    <span>Mis Proformas</span>
                  </Link>
                  <Link
                    href="/panel?vista=promociones"
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      background: 'rgba(236, 127, 167, 0.14)',
                      color: '#9D174D',
                    }}
                  >
                    <Gift size={16} />
                    <span>Promociones Exclusivas</span>
                  </Link>
                  <Link
                    href="/panel/cuenta"
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: 'var(--tinta)',
                    }}
                  >
                    <User size={16} />
                    <span>Mi Cuenta y Facturas</span>
                  </Link>
                </div>
              ) : (
                <Link
                  href="/ingresar"
                  onClick={() => setMenuMovilAbierto(false)}
                  title="Iniciar sesión o registrarme para activar zona de envío gratis"
                  aria-label="Ingresar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--linea)',
                    background: '#FFFFFF',
                    color: 'var(--tinta)',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <User size={16} />
                  <span>Ingresar / Registrarme</span>
                </Link>
              )}

              <a
                href="https://maps.app.goo.gl/D56gQohzuwha4sLf8"
                target="_blank"
                rel="noopener noreferrer"
                title="Ver tienda física de Tinkay en Google Maps"
                aria-label="Tienda en Maps"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  color: 'var(--verde)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <MapPin size={15} />
                <span>Tienda Física (Maps)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
