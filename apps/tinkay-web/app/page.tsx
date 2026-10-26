'use client';

import React from 'react';
import Link from 'next/link';
import { ProveedorCarrito } from '../modulos/ecommerce/contexto-carrito';
import { EncabezadoEcommerce } from '../modulos/ecommerce/componentes/EncabezadoEcommerce';
import { CarruselHeroDestacados } from '../modulos/ecommerce/componentes/CarruselHeroDestacados';
import { CarruselProductosDestacados } from '../modulos/ecommerce/componentes/CarruselProductosDestacados';
import { VitrinaCatalogoTinkay } from '../modulos/ecommerce/componentes/VitrinaCatalogoTinkay';
import { ModalDetalleProducto } from '../modulos/ecommerce/componentes/ModalDetalleProducto';
import { DrawerCarritoFloristeria } from '../modulos/ecommerce/componentes/DrawerCarritoFloristeria';
import { ModalCheckoutTinkay } from '../modulos/ecommerce/componentes/ModalCheckoutTinkay';
import { ChatAriaFlotante } from '../modulos/ecommerce/componentes/ChatAriaFlotante';
import { Sparkles, ShieldCheck, Heart, Truck, Phone } from 'lucide-react';

export default function PaginaEcommerceTinkay() {
  return (
    <ProveedorCarrito>
      <div className="pagina-ecommerce-tinkay-layout">
        {/* Encabezado Superior con Carrito */}
        <EncabezadoEcommerce />

        {/* Carrusel Principal Hero Editorial */}
        <CarruselHeroDestacados />

        {/* Carrusel de Productos Destacados (Lo más pedido) */}
        <CarruselProductosDestacados />

        {/* Vitrina Completa con Filtros Multidimensionales y Búsqueda */}
        <VitrinaCatalogoTinkay />

        {/* Sección de Experiencia y Compromiso Botánico */}
        <section className="seccion-compromiso-tinkay">
          <div className="contenedor-maximo">
            <div className="grid-compromiso-cuatro">
              <div className="tarjeta-compromiso">
                <div className="icono-circulo-dorado">
                  <Truck size={24} />
                </div>
                <h3>Entrega en Franja o a Hora Exacta</h3>
                <p>
                  Franjas gratuitas en la mañana o tarde en Quito y Valles, o agenda tu entrega a la hora
                  exacta para dar la sorpresa soñada.
                </p>
              </div>

              <div className="tarjeta-compromiso">
                <div className="icono-circulo-dorado">
                  <Sparkles size={24} />
                </div>
                <h3>Rosas Ecuatorianas de Exportación</h3>
                <p>
                  Botones gigantes y apertura lenta cultivadas en fincas andinas de altitud, con hidratación
                  nutritiva Chrysal incluida.
                </p>
              </div>

              <div className="tarjeta-compromiso">
                <div className="icono-circulo-dorado">
                  <Heart size={24} />
                </div>
                <h3>Dedicatoria Impresa y Caligrafía</h3>
                <p>
                  Tarjetas personalizadas individuales para cada destinatario impresas en papel verjurado fino
                  con mensajes emotivos asistidos por IA.
                </p>
              </div>

              <div className="tarjeta-compromiso">
                <div className="icono-circulo-dorado">
                  <ShieldCheck size={24} />
                </div>
                <h3>Pago 100% Seguro con Payphone</h3>
                <p>
                  Aceptamos todas las tarjetas de crédito y débito Visa y Mastercard con facturación
                  electrónica avalada por el SRI.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pie de Página de la Floristería */}
        <footer className="pie-pagina-ecommerce">
          <div className="contenedor-maximo">
            <div className="grid-pie-columnas">
              <div className="columna-pie-marca">
                <span className="logo-tinkay-marca">tinkay</span>
                <p>
                  Flores con historia, para cada momento. Taller de floristería contemporánea y decoración
                  botánica en Quito y Cumbayá.
                </p>
                <div className="telefono-contacto-pie">
                  <Phone size={15} />
                  <span>Atención telefónica &amp; WhatsApp: +593 99 123 4567</span>
                </div>
              </div>

              <div className="columna-pie-links">
                <h4>Colecciones</h4>
                <ul>
                  <li><a href="#catalogo">Bouquets Estilo Coreano</a></li>
                  <li><a href="#catalogo">Ramos Clásicos para Florero</a></li>
                  <li><a href="#catalogo">Mix Exótico de Temporada</a></li>
                  <li><a href="#catalogo">Condolencias &amp; Funerarios</a></li>
                </ul>
              </div>

              <div className="columna-pie-links">
                <h4>Servicios &amp; Envíos</h4>
                <ul>
                  <li><span>Quito Urbano &amp; Cumbayá</span></li>
                  <li><span>Tumbaco, San Rafael &amp; Conocoto</span></li>
                  <li><span>Montajes para Matrimonios y Eventos</span></li>
                  <li><span>Entrega Express en Horario Exacto</span></li>
                </ul>
              </div>

              <div className="columna-pie-links">
                <h4>Legal &amp; Transparencia</h4>
                <ul>
                  <li><Link href="/terminos">Términos y Condiciones</Link></li>
                  <li><Link href="/ingresar">Portal de Clientes</Link></li>
                  <li><span>Precios B2C en USD con IVA 15%</span></li>
                  <li><span className="sello-compilacion">Tinkay v1.0 • E-Commerce</span></li>
                </ul>
              </div>
            </div>

            <div className="sub-pie-copyright">
              <span>© {new Date().getFullYear()} Tinkay Floristería Cía. Ltda. Todos los derechos reservados.</span>
            </div>
          </div>
        </footer>

        {/* Modal de Detalle de Producto */}
        <ModalDetalleProducto />

        {/* Drawer Lateral del Carrito de Compras */}
        <DrawerCarritoFloristeria />

        {/* Modal de Checkout Payphone y Transferencia */}
        <ModalCheckoutTinkay />

        {/* Agente de Chat ARIA ("Mía") */}
        <ChatAriaFlotante />
      </div>
    </ProveedorCarrito>
  );
}
