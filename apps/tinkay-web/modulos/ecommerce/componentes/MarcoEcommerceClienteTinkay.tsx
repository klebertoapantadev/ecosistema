'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CampanaNotificaciones } from '@eco/notificaciones';
import { GestorPushChatsOmnicanal } from '@eco/comercio';
import { ProveedorCarrito, useCarrito } from '../contexto-carrito';
import { ModalDetalleProducto } from './ModalDetalleProducto';
import { DrawerCarritoFloristeria } from './DrawerCarritoFloristeria';
import { DrawerProformaEvento } from './DrawerProformaEvento';
import { ModalCheckoutTinkay } from './ModalCheckoutTinkay';
import { ChatAriaFlotante } from './ChatAriaFlotante';
import {
  FileText,
  Gift,
  LogOut,
  MapPin,
  Menu,
  Package,
  Phone,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
  X,
} from 'lucide-react';

export interface PropsMarcoEcommerceClienteTinkay {
  children: React.ReactNode;
  usuarioId: string;
  nombreCompleto: string;
  correo: string;
  iniciales: string;
  conteoPedidosInicial?: number;
  conteoProformasInicial?: number;
  cerrarSesionAction: () => Promise<void>;
}

type ClaveMenuCliente =
  | 'tienda'
  | 'pedidos'
  | 'carrito'
  | 'proformas'
  | 'promociones'
  | 'cuenta';

function CabeceraYMenuClienteInterno({
  usuarioId,
  nombreCompleto,
  correo,
  iniciales,
  conteoPedidosInicial = 0,
  conteoProformasInicial = 0,
  cerrarSesionAction,
}: Omit<PropsMarcoEcommerceClienteTinkay, 'children'>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    cantidadTotal,
    cantidadTotalProforma,
    setDrawerAbierto,
    configLogistica,
  } = useCarrito();

  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    if (!menuMovilAbierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMenuMovilAbierto(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onEsc);
    };
  }, [menuMovilAbierto]);

  const vistaParam = (searchParams?.get('vista') || '').toLowerCase();
  const claveActiva: ClaveMenuCliente = pathname?.startsWith('/panel/cuenta')
    ? 'cuenta'
    : vistaParam === 'carrito'
    ? 'carrito'
    : vistaParam === 'proformas'
    ? 'proformas'
    : vistaParam === 'promociones'
    ? 'promociones'
    : 'pedidos';

  const totalProformasBadge =
    conteoProformasInicial + (cantidadTotalProforma > 0 ? 1 : 0);

  const opcionesMenu: Array<{
    clave: ClaveMenuCliente;
    etiqueta: string;
    href: string;
    icono: React.ReactNode;
    contador?: number;
    destacado?: boolean;
  }> = [
    {
      clave: 'tienda',
      etiqueta: 'Catálogo',
      href: '/#catalogo',
      icono: <Store size={15} />,
    },
    {
      clave: 'pedidos',
      etiqueta: 'Mis Pedidos',
      href: '/panel?vista=pedidos',
      icono: <Package size={15} />,
      contador: conteoPedidosInicial > 0 ? conteoPedidosInicial : undefined,
    },
    {
      clave: 'carrito',
      etiqueta: 'Mi Carrito',
      href: '/panel?vista=carrito',
      icono: <ShoppingCart size={15} />,
      contador: cantidadTotal > 0 ? cantidadTotal : undefined,
    },
    {
      clave: 'proformas',
      etiqueta: 'Mis Proformas',
      href: '/panel?vista=proformas',
      icono: <FileText size={15} />,
      contador: totalProformasBadge > 0 ? totalProformasBadge : undefined,
    },
    {
      clave: 'promociones',
      etiqueta: 'Promociones',
      href: '/panel?vista=promociones',
      icono: <Gift size={15} />,
      destacado: true,
    },
    {
      clave: 'cuenta',
      etiqueta: 'Mi Cuenta',
      href: '/panel/cuenta',
      icono: <User size={15} />,
    },
  ];

  return (
    <header className="cabecera-ecommerce-tinkay">
      {/* Barra superior botánica con beneficio activo de cliente registrado */}
      <div className="barra-superior-anuncio">
        <div
          className="anuncio-flex-contenido"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '8px 18px',
          }}
        >
          <span>
            🌸 Beneficio Cliente Registrado Activo: Envío Gratis en{' '}
            {configLogistica.zonaGratisNombre || 'Centro-Norte de Quito'} ($0.00)
          </span>
          <a
            href={configLogistica.origenMapaUrl || 'https://maps.app.goo.gl/D56gQohzuwha4sLf8'}
            target="_blank"
            rel="noopener noreferrer"
            className="enlace-tienda-maps-top"
            title="Ver ubicación de tienda física Tinkay en Google Maps"
          >
            📍 Tienda Física en Maps
          </a>
        </div>
      </div>

      {/* Fila principal de cabecera e-commerce */}
      <div className="contenedor-cabecera-principal">
        <div className="cabecera-marca-y-menu">
          <button
            type="button"
            className="btn-menu-movil-ecommerce"
            onClick={() => setMenuMovilAbierto(true)}
            title="Abrir menú de cliente Tinkay"
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

        {/* Navegación editorial horizontal integrada en escritorio */}
        <nav
          className="nav-enlaces-floristeria"
          aria-label="Menú de cliente Tinkay"
          style={{ gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {opcionesMenu.map((item) => {
            const activa = claveActiva === item.clave;
            return (
              <Link
                key={item.clave}
                href={item.href}
                aria-current={activa ? 'page' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 13px',
                  borderRadius: '999px',
                  textDecoration: 'none',
                  fontSize: '0.86rem',
                  fontWeight: activa ? 700 : 600,
                  background: activa
                    ? '#3D5A45'
                    : item.destacado
                    ? 'rgba(236, 127, 167, 0.14)'
                    : 'transparent',
                  color: activa
                    ? '#FFFFFF'
                    : item.destacado
                    ? '#BE185D'
                    : 'var(--tinta)',
                  border: activa
                    ? '1px solid #3D5A45'
                    : item.destacado
                    ? '1px solid rgba(236, 127, 167, 0.35)'
                    : '1px solid transparent',
                  transition: 'all 0.16s ease',
                }}
              >
                {item.icono}
                <span>{item.etiqueta}</span>
                {typeof item.contador === 'number' && item.contador > 0 && (
                  <span
                    style={{
                      minWidth: '19px',
                      height: '19px',
                      padding: '0 5px',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: activa ? '#EC7FA7' : '#221D1A',
                      color: '#FFFFFF',
                    }}
                  >
                    {item.contador}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Acciones rápidas derechas */}
        <div className="acciones-usuario-cabecera" style={{ gap: '10px' }}>
          <CampanaNotificaciones negocio="tinkay" usuarioId={usuarioId} variante="clara" />

          <button
            type="button"
            className="btn-carrito-cabecera btn-responsive-accion"
            onClick={() => setDrawerAbierto(true)}
            title="Abrir vista rápida de mi carrito floral"
            aria-label={`Abrir carrito con ${cantidadTotal} productos`}
          >
            <ShoppingBag size={19} />
            <span className="texto-carrito-btn btn-texto-responsive">Carrito</span>
            {cantidadTotal > 0 && (
              <span className="badge-cantidad-carrito">{cantidadTotal}</span>
            )}
          </button>

          <Link
            href="/panel/cuenta"
            title={`${nombreCompleto} (${correo}) — Mi Cuenta`}
            aria-label="Perfil de cliente"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              background: '#3D5A45',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 800,
              textDecoration: 'none',
              flexShrink: 0,
              border: '2px solid rgba(184, 146, 63, 0.45)',
            }}
          >
            {iniciales}
          </Link>

          <form action={cerrarSesionAction} style={{ margin: 0 }}>
            <button
              type="submit"
              className="btn-responsive-accion"
              title="Cerrar sesión en Tinkay"
              aria-label="Cerrar sesión"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: '999px',
                border: '1px solid var(--linea)',
                background: '#FFFFFF',
                color: 'var(--tinta)',
                fontFamily: 'inherit',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} />
              <span className="btn-texto-responsive">Salir</span>
            </button>
          </form>
        </div>
      </div>

      {/* Franja deslizable en móvil / tablet con todas las opciones del cliente */}
      <nav className="franja-categorias-movil" aria-label="Acceso rápido de cliente">
        {opcionesMenu.map((item) => {
          const activa = claveActiva === item.clave;
          return (
            <Link
              key={`movil-${item.clave}`}
              href={item.href}
              aria-current={activa ? 'page' : undefined}
              className={['chip-cat-cabecera-movil', activa ? 'activa' : '']
                .filter(Boolean)
                .join(' ')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                ...(activa
                  ? {
                      background: '#3D5A45',
                      color: '#FFFFFF',
                      borderColor: '#3D5A45',
                    }
                  : {}),
              }}
            >
              {item.icono}
              <span>{item.etiqueta}</span>
              {typeof item.contador === 'number' && item.contador > 0 && (
                <strong style={{ fontSize: '0.72rem' }}>({item.contador})</strong>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Drawer móvil editorial (sin estilo de consola administrativa) */}
      {menuMovilAbierto && (
        <div
          className="backdrop-menu-movil-ecommerce"
          onClick={() => setMenuMovilAbierto(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de cliente Tinkay"
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '999px',
                    background: '#3D5A45',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {iniciales}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '0.92rem',
                      color: 'var(--tinta)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nombreCompleto}
                  </strong>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.74rem',
                      color: 'var(--gris)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {correo}
                  </span>
                </div>
              </div>

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
                Mi Espacio en Tinkay
              </span>

              {opcionesMenu.map((item) => {
                const activa = claveActiva === item.clave;
                return (
                  <Link
                    key={`drawer-${item.clave}`}
                    href={item.href}
                    onClick={() => setMenuMovilAbierto(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '11px 12px',
                      borderRadius: '11px',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      fontWeight: activa ? 700 : 600,
                      background: activa ? 'rgba(61, 90, 69, 0.12)' : 'transparent',
                      color: activa ? '#2D4734' : 'var(--tinta)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                      {item.icono}
                      <span>{item.etiqueta}</span>
                    </span>
                    {typeof item.contador === 'number' && item.contador > 0 && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: activa ? '#3D5A45' : 'rgba(236, 127, 167, 0.2)',
                          color: activa ? '#FFFFFF' : '#9D174D',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}
                      >
                        {item.contador}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '14px',
                borderTop: '1px solid var(--linea)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <form action={cerrarSesionAction} style={{ margin: 0 }}>
                <button
                  type="submit"
                  title="Cerrar sesión activa"
                  aria-label="Salir"
                  style={{
                    width: '100%',
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
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={16} />
                  <span>Salir</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarcoEcommerceClienteTinkay(props: PropsMarcoEcommerceClienteTinkay) {
  const { children, ...cabeceraProps } = props;

  return (
    <ProveedorCarrito usuarioRegistradoInicial={true}>
      <div
        className="pagina-ecommerce-tinkay-layout"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--crema)',
          color: 'var(--tinta)',
        }}
      >
        <Suspense fallback={null}>
          <CabeceraYMenuClienteInterno {...cabeceraProps} />
        </Suspense>

        <main
          style={{
            flex: '1 0 auto',
            width: '100%',
            maxWidth: '1240px',
            margin: '0 auto',
            padding: 'clamp(20px, 3.5vw, 36px) clamp(14px, 4vw, 32px) 64px',
          }}
        >
          {children}
        </main>

        <footer className="pie-pagina-ecommerce">
          <div className="contenedor-maximo">
            <div className="grid-pie-columnas">
              <div className="columna-pie-marca">
                <Link href="/" className="logo-tinkay-pie-link">
                  <img
                    src="/img/logo/tinkay-logo.jpg"
                    alt="Tinkay Flores y Eventos"
                    className="logo-tinkay-imagen-pie"
                  />
                </Link>
                <p>
                  Flores con historia, para cada momento. Taller de floristería contemporánea y
                  decoración botánica en Quito y Valles.
                </p>
                <div className="telefono-contacto-pie">
                  <Phone size={15} />
                  <span>Atención &amp; WhatsApp: +593 99 292 2343</span>
                </div>
                <div className="ubicacion-contacto-pie">
                  <MapPin size={15} />
                  <a
                    href="https://maps.app.goo.gl/D56gQohzuwha4sLf8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="enlace-mapa-pie"
                  >
                    Tienda Física en Quito: Ver en Google Maps ↗
                  </a>
                </div>
              </div>

              <div className="columna-pie-links">
                <h4>Mi Espacio</h4>
                <ul>
                  <li>
                    <Link href="/panel?vista=pedidos">Mis Pedidos y Entregas</Link>
                  </li>
                  <li>
                    <Link href="/panel?vista=carrito">Ver / Editar Carrito</Link>
                  </li>
                  <li>
                    <Link href="/panel?vista=proformas">Mis Proformas de Eventos</Link>
                  </li>
                  <li>
                    <Link href="/panel?vista=promociones">Promociones y Beneficios</Link>
                  </li>
                  <li>
                    <Link href="/panel/cuenta">Mi Cuenta y Facturas SRI</Link>
                  </li>
                </ul>
              </div>

              <div className="columna-pie-links">
                <h4>Colecciones</h4>
                <ul>
                  <li>
                    <Link href="/categoria/box-florales">Box Florales de Lujo</Link>
                  </li>
                  <li>
                    <Link href="/categoria/cat-coreanos">Bouquets Estilo Coreano</Link>
                  </li>
                  <li>
                    <Link href="/categoria/cat-floreros">Ramos para Florero</Link>
                  </li>
                  <li>
                    <Link href="/categoria/eventos-y-ceremonias">Eventos &amp; Ceremonias</Link>
                  </li>
                  <li>
                    <Link href="/categoria/cat-ocas-condol">Condolencias &amp; Funerarios</Link>
                  </li>
                </ul>
              </div>

              <div className="columna-pie-links">
                <h4>Beneficios Registrados</h4>
                <ul>
                  <li>
                    <span>Envío Gratis en Centro-Norte</span>
                  </li>
                  <li>
                    <span>Obsequio en Primera Compra</span>
                  </li>
                  <li>
                    <span>Facturación Electrónica SRI</span>
                  </li>
                  <li>
                    <Link href="/terminos">Términos y Condiciones</Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="sub-pie-copyright">
              <span>
                © {new Date().getFullYear()} Tinkay Floristería. Todos los derechos reservados.
              </span>
            </div>
          </div>
        </footer>

        <GestorPushChatsOmnicanal
          negocio="tinkay"
          usuarioId={props.usuarioId}
          rolPrincipal="CLIENTE"
          puedeVerConversacionesClientes={false}
          modoClientePedidos={true}
        />
        <ModalDetalleProducto />
        <DrawerCarritoFloristeria />
        <DrawerProformaEvento />
        <ModalCheckoutTinkay />
        <ChatAriaFlotante />
      </div>
    </ProveedorCarrito>
  );
}
