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
import { ShoppingBag, Feather, FileText, Gift } from 'lucide-react';

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
        <Link href="/" className="logo-tinkay-marca" aria-label="Tinkay Flores y Eventos">
          <img
            src="/img/logo/tinkay-logo.jpg"
            alt="Tinkay Flores y Eventos"
            className="logo-tinkay-imagen-cabecera"
          />
          <span className="sr-only">Tinkay Flores y Eventos</span>
        </Link>

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
                className="enlace-ingresar-discreto"
                title="Abrir mi panel de cuenta y pedidos"
                aria-label="Mi Panel"
              >
                Mi Panel
              </Link>
            </>
          ) : (
            <Link
              href="/ingresar"
              className="enlace-ingresar-discreto"
              title="Iniciar sesión en Tinkay"
              aria-label="Ingresar"
            >
              Ingresar
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
    </header>
  );
}
