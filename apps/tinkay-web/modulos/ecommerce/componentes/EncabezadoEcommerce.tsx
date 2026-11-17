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
  ChevronDown,
  ShoppingCart,
} from 'lucide-react';

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
    configLogistica,
  } = useCarrito();

  const [estadoRegalo, setEstadoRegalo] = useState<EstadoRegaloPrimeraCompra | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);
  const [menuClienteAbierto, setMenuClienteAbierto] = useState<boolean>(false);

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
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setMenuClienteAbierto((v) => !v)}
                  className="enlace-ingresar-discreto btn-responsive-accion"
                  title="Ver mis pedidos, carrito, proformas, promociones y cuenta"
                  aria-label="Mi Espacio"
                  aria-expanded={menuClienteAbierto}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid rgba(61, 90, 69, 0.28)',
                    background: 'rgba(61, 90, 69, 0.08)',
                    color: '#2D4734',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <User size={17} />
                  <span className="btn-texto-responsive">Mi Espacio</span>
                  <ChevronDown size={14} />
                </button>

                {menuClienteAbierto && (
                  <>
                    <div
                      onClick={() => setMenuClienteAbierto(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 70 }}
                    />
                    <div
                      role="menu"
                      aria-label="Opciones de cliente Tinkay"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        zIndex: 80,
                        width: '250px',
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1px solid var(--linea)',
                        boxShadow: '0 16px 36px rgba(34, 29, 26, 0.14)',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <Link
                        href="/panel?vista=pedidos"
                        onClick={() => setMenuClienteAbierto(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          padding: '9px 11px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          color: 'var(--tinta)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <Package size={16} color="#3D5A45" />
                        <span>Mis Pedidos y Facturas</span>
                      </Link>
                      <Link
                        href="/panel?vista=carrito"
                        onClick={() => setMenuClienteAbierto(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '9px',
                          padding: '9px 11px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          color: 'var(--tinta)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                          <ShoppingCart size={16} color="#3D5A45" />
                          <span>Ver / Editar Carrito</span>
                        </span>
                        {cantidadTotal > 0 && (
                          <span
                            style={{
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background: '#EC7FA7',
                              color: '#FFFFFF',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                            }}
                          >
                            {cantidadTotal}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/panel?vista=proformas"
                        onClick={() => setMenuClienteAbierto(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          padding: '9px 11px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          color: 'var(--tinta)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <FileText size={16} color="#3D5A45" />
                        <span>Mis Proformas</span>
                      </Link>
                      <Link
                        href="/panel?vista=promociones"
                        onClick={() => setMenuClienteAbierto(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          padding: '9px 11px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          background: 'rgba(236, 127, 167, 0.12)',
                          color: '#9D174D',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                        }}
                      >
                        <Gift size={16} color="#BE185D" />
                        <span>Promociones Exclusivas</span>
                      </Link>
                      <div style={{ height: '1px', background: 'var(--linea)', margin: '4px 0' }} />
                      <Link
                        href="/panel/cuenta"
                        onClick={() => setMenuClienteAbierto(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          padding: '9px 11px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          color: 'var(--tinta)',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                        }}
                      >
                        <User size={16} color="#6B7280" />
                        <span>Mi Cuenta y Datos SRI</span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
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
    </header>
  );
}
