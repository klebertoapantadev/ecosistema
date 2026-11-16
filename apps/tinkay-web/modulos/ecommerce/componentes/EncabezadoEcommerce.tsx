'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  obtenerEstadoRegaloPrimeraCompraAction,
  type EstadoRegaloPrimeraCompra,
} from '@eco/comercio';
import { CampanaNotificaciones } from '@eco/notificaciones';
import { useCarrito } from '../contexto-carrito';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from '../datos-catalogo';
import { expandirProductosVitrina, obtenerCategoriasVisibles } from '../filtrado-catalogo';
import { ShoppingBag, Feather, FileText, Gift, Menu, X, User, MapPin } from 'lucide-react';

export function EncabezadoEcommerce() {
  const {
    cantidadTotal,
    cantidadTotalProforma,
    setDrawerAbierto,
    setDrawerProformaAbierto,
    productos,
    categorias,
    categoriaActiva,
    navegarACategoria,
  } = useCarrito();

  const [estadoRegalo, setEstadoRegalo] = useState<EstadoRegaloPrimeraCompra | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);

  useEffect(() => {
    if (!menuMovilAbierto) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuMovilAbierto(false);
    };
    window.addEventListener('keydown', alEscape);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', alEscape);
    };
  }, [menuMovilAbierto]);

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

  const categoriasMenu = useMemo(() => {
    const prodsBase = expandirProductosVitrina(
      productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY
    );
    const catsBase = categorias && categorias.length > 0 ? categorias : CATEGORIAS_TINKAY;
    return obtenerCategoriasVisibles(catsBase, prodsBase);
  }, [productos, categorias]);

  const handleSeleccionMenu = (e: React.MouseEvent<HTMLAnchorElement>, catId: string) => {
    e.preventDefault();
    navegarACategoria(catId);
  };

  return (
    <header className="cabecera-ecommerce-tinkay">
      <div className="barra-superior-anuncio">
        <div className="anuncio-flex-contenido">
          <span>🌸 Entrega puntual hoy en Quito &amp; Valles • Rosas de exportación frescas cada mañana</span>
          <a
            href="https://maps.app.goo.gl/D56gQohzuwha4sLf8"
            target="_blank"
            rel="noopener noreferrer"
            className="enlace-tienda-maps-top"
            title="Ver ubicación de tienda física Tinkay en Google Maps"
          >
            📍 Ver Tienda Física en Quito (Maps)
          </a>
        </div>
      </div>

      {/* Anuncio de regalo en primera compra para clientes registrados */}
      {(!estadoRegalo || !estadoRegalo.autenticado || estadoRegalo.aplicaRegalo) && (
        <div
          className="barra-regalo-anuncio"
          style={{
            background:
              estadoRegalo?.autenticado && estadoRegalo.aplicaRegalo
                ? 'linear-gradient(90deg, #065F46 0%, #047857 100%)'
                : 'linear-gradient(90deg, #9D174D 0%, #BE185D 55%, #9D174D 100%)',
            color: '#FFFFFF',
            padding: '7px 16px',
            fontSize: '0.8rem',
            lineHeight: 1.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
            }}
          >
            <Gift size={15} style={{ flexShrink: 0, color: '#FDE68A' }} />
            {estadoRegalo?.autenticado && estadoRegalo.aplicaRegalo ? (
              <span>
                ¡Beneficio activo! Tu <strong>primera compra</strong> incluye{' '}
                <strong>1 Bombón de Chocolate Ferrero en Esfera GRATIS</strong>
              </span>
            ) : (
              <span>
                ¡Regalo de bienvenida! <strong>Regístrate</strong> y recibe{' '}
                <strong>1 Bombón de Chocolate en Esfera GRATIS</strong> en tu primera compra
              </span>
            )}
          </span>
          {!estadoRegalo?.autenticado && (
            <Link
              href="/registro?destino=/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 11px',
                borderRadius: '999px',
                backgroundColor: '#FDE68A',
                color: '#831843',
                fontWeight: 700,
                fontSize: '0.74rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Registrarme gratis →
            </Link>
          )}
        </div>
      )}

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
              src="/img/logo/tinkay-logo.jpg"
              alt="Tinkay Flores y Eventos"
              className="logo-tinkay-imagen-cabecera"
            />
            <span className="sr-only">Tinkay Flores y Eventos</span>
          </Link>
        </div>

        <nav className="nav-enlaces-floristeria" aria-label="Categorías principales">
          {categoriasMenu.map((cat) => {
            const esTodos = cat.id === 'cat-todos';
            const estaActiva = categoriaActiva === cat.id;
            const etiquetaMenu = esTodos
              ? 'Catálogo'
              : cat.modoVisualSobrio
              ? 'Condolencias'
              : cat.nombre;

            return (
              <a
                key={cat.id}
                href="#catalogo"
                onClick={(e) => handleSeleccionMenu(e, cat.id)}
                aria-current={estaActiva ? 'true' : undefined}
                className={[
                  cat.modoVisualSobrio ? 'enlace-condolencias' : '',
                  estaActiva ? 'enlace-categoria-activo' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {cat.modoVisualSobrio && <Feather size={14} />}
                <span>{etiquetaMenu}</span>
              </a>
            );
          })}
        </nav>

        <div className="acciones-usuario-cabecera">
          {estadoRegalo?.autenticado ? (
            <>
              <CampanaNotificaciones negocio="tinkay" variante="clara" />
              <Link
                href="/panel"
                className="enlace-ingresar-discreto btn-responsive-accion"
                title="Abrir mi panel de cuenta y pedidos"
                aria-label="Mi Panel"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <User size={17} />
                <span className="btn-texto-responsive">Mi Panel</span>
              </Link>
            </>
          ) : (
            <Link
              href="/ingresar"
              className="enlace-ingresar-discreto btn-responsive-accion"
              title="Iniciar sesión en Tinkay"
              aria-label="Ingresar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <User size={17} />
              <span className="btn-texto-responsive">Ingresar</span>
            </Link>
          )}

          {(cantidadTotalProforma > 0 ||
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

      {/* Franja rápida de categorías deslizable en móvil / tablet */}
      <nav className="franja-categorias-movil" aria-label="Categorías rápidas">
        {categoriasMenu.map((cat) => {
          const esTodos = cat.id === 'cat-todos';
          const estaActiva = categoriaActiva === cat.id;
          const etiquetaMenu = esTodos
            ? 'Catálogo'
            : cat.modoVisualSobrio
            ? 'Condolencias'
            : cat.nombre;

          return (
            <a
              key={cat.id}
              href="#catalogo"
              onClick={(e) => handleSeleccionMenu(e, cat.id)}
              aria-current={estaActiva ? 'true' : undefined}
              className={[
                'chip-cat-cabecera-movil',
                cat.modoVisualSobrio ? 'condolencias' : '',
                estaActiva ? 'activa' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {cat.modoVisualSobrio && <Feather size={13} />}
              <span>{etiquetaMenu}</span>
            </a>
          );
        })}
      </nav>

      {/* Drawer de Navegación Móvil */}
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
                Colecciones Florales
              </span>
              {categoriasMenu.map((cat) => {
                const esTodos = cat.id === 'cat-todos';
                const estaActiva = categoriaActiva === cat.id;
                const etiquetaMenu = esTodos
                  ? 'Todo el Catálogo'
                  : cat.modoVisualSobrio
                  ? 'Condolencias'
                  : cat.nombre;

                return (
                  <a
                    key={cat.id}
                    href="#catalogo"
                    onClick={(e) => {
                      handleSeleccionMenu(e, cat.id);
                      setMenuMovilAbierto(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      fontWeight: estaActiva ? 700 : 600,
                      background: estaActiva ? 'rgba(236, 127, 167, 0.14)' : 'transparent',
                      color: estaActiva ? 'var(--rosa-oscuro)' : 'var(--tinta)',
                    }}
                  >
                    {cat.modoVisualSobrio && <Feather size={15} />}
                    <span>{etiquetaMenu}</span>
                  </a>
                );
              })}
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

              <Link
                href={estadoRegalo?.autenticado ? '/panel' : '/ingresar'}
                onClick={() => setMenuMovilAbierto(false)}
                title={estadoRegalo?.autenticado ? 'Ir a mi panel de cuenta' : 'Iniciar sesión o registrarme'}
                aria-label={estadoRegalo?.autenticado ? 'Mi Panel' : 'Ingresar'}
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
                <span>{estadoRegalo?.autenticado ? 'Mi Panel y Pedidos' : 'Ingresar / Registrarme'}</span>
              </Link>

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
    </header>
  );
}
