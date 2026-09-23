"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, FileCheck, MessageCircle, CreditCard, Check, X } from "lucide-react";
import {
  obtenerProductosDestacadosClienteAction,
  type ProductoCatalogo,
  type VarianteCatalogo,
} from "@eco/comercio/acciones";
import { ModalCheckoutPayphone } from "@eco/comercio/componentes/ModalCheckoutPayphone";
import { useAvisos } from "../../../app/panel/AvisosPanel";

/** Planes y servicios del inicio (TRQ-013, variante 3B).
 *
 *  Sustituye a `CarruselProductosCliente` de @eco/comercio en el inicio de
 *  tranqi. El carrusel cortaba la tercera tarjeta sin avisar de que había
 *  más, y traía su apariencia en `style={{}}` con la paleta de otro producto:
 *  la apariencia no se comparte entre negocios (marco-de-trabajo.md). Los
 *  DATOS y el PAGO sí son de plataforma y se reutilizan tal cual: el mismo
 *  action de productos y el mismo `ModalCheckoutPayphone`.
 *
 *  Antes del checkout va un paso de confirmación propio (7A) con el desglose
 *  del IVA: el modal de Payphone es de plataforma y no se toca aquí. */

type Filtro = "todos" | "planes" | "servicios";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function esPlan(p: ProductoCatalogo) {
  return p.pro_tipo === "SUSCRIPCION";
}

function iconoDe(p: ProductoCatalogo) {
  if (esPlan(p)) return ShieldCheck;
  if (/consulta|asesor/i.test(p.pro_nombre)) return MessageCircle;
  return FileCheck;
}

export function RejillaPlanes({ negocio = "tranqi" }: { negocio?: string }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [productos, setProductos] = useState<ProductoCatalogo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [seleccion, setSeleccion] = useState<{ producto: ProductoCatalogo; variante: VarianteCatalogo } | null>(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const segmentos = useRef<(HTMLButtonElement | null)[]>([]);
  const pulgar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let vigente = true;
    obtenerProductosDestacadosClienteAction(negocio)
      .then((data) => { if (vigente) setProductos(data); })
      .catch(() => { if (vigente) setProductos([]); });
    return () => { vigente = false; };
  }, [negocio]);

  const opciones: { valor: Filtro; nombre: string }[] = [
    { valor: "todos", nombre: "Todos" },
    { valor: "planes", nombre: "Planes" },
    { valor: "servicios", nombre: "Servicios" },
  ];

  // El pulgar del control segmentado se coloca midiendo el botón elegido.
  useLayoutEffect(() => {
    const colocar = () => {
      const b = segmentos.current[opciones.findIndex((o) => o.valor === filtro)];
      if (b && pulgar.current) {
        pulgar.current.style.width = `${b.offsetWidth}px`;
        pulgar.current.style.transform = `translateX(${b.offsetLeft}px)`;
      }
    };
    colocar();
    window.addEventListener("resize", colocar);
    return () => window.removeEventListener("resize", colocar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, productos]);

  // Sin productos no hay sección: igual que hacía el carrusel.
  if (!productos || productos.length === 0) return null;

  const visibles = productos.filter((p) =>
    filtro === "todos" ? true : filtro === "planes" ? esPlan(p) : !esPlan(p),
  );
  const hayDeAmbos = productos.some(esPlan) && productos.some((p) => !esPlan(p));
  // Un solo recomendado: el primer plan destacado. Se marca con borde y
  // fondo tenue, no con color pleno: la pantalla ya tiene su única
  // superficie de color pleno (sistema visual §2).
  const recomendado = productos.find((p) => esPlan(p) && p.pro_destacado)?.pro_id;

  function abrirConfirmacion(producto: ProductoCatalogo, variante: VarianteCatalogo) {
    setSeleccion({ producto, variante });
    dialogo.current?.showModal();
  }

  function irAPagar() {
    dialogo.current?.close();
    setPagoAbierto(true);
  }

  return (
    <section className="tarjeta-seccion planes-inicio" aria-labelledby="t-planes">
      <header>
        <h2 id="t-planes">Planes y servicios</h2>
        {hayDeAmbos && (
          <div className="segmentado" role="group" aria-label="Filtrar planes y servicios">
            <span className="segmentado-pulgar" ref={pulgar} aria-hidden="true" />
            {opciones.map((o, k) => (
              <button
                key={o.valor}
                ref={(el) => { segmentos.current[k] = el; }}
                type="button"
                aria-pressed={filtro === o.valor}
                onClick={() => setFiltro(o.valor)}
              >
                {o.nombre}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="planes-rejilla">
        {visibles.map((p) => {
          const variante = p.variantes[0];
          if (!variante) return null;
          const Icono = iconoDe(p);
          const beneficios: string[] = Array.isArray(p.pro_detalle_producto?.beneficios)
            ? p.pro_detalle_producto.beneficios.slice(0, 3)
            : [];
          return (
            <article key={`${filtro}-${p.pro_id}`} className={`plan-tarjeta${p.pro_id === recomendado ? " es-recomendado" : ""}`}>
              <div className="plan-cabecera">
                <span className="plan-icono" aria-hidden="true"><Icono size={18} strokeWidth={1.7} /></span>
                {p.pro_id === recomendado && <span className="plan-chip">Recomendado</span>}
              </div>
              <span className="plan-eyebrow">{esPlan(p) ? "Suscripción" : "Servicio puntual"}</span>
              <h3>{p.pro_nombre}</h3>
              {beneficios.length > 0 && (
                <ul className="plan-beneficios">
                  {beneficios.map((b) => (
                    <li key={b}><Check size={15} strokeWidth={2.2} aria-hidden="true" />{b}</li>
                  ))}
                </ul>
              )}
              <div className="plan-pie">
                <div className="plan-precio">
                  <b>{USD.format(variante.precio_total)}</b>
                  <small>IVA {variante.var_tarifa_iva_porcentaje} % incl.</small>
                </div>
                <button type="button" className="btn btn-primario btn-pequeno" onClick={() => abrirConfirmacion(p, variante)}>
                  {esPlan(p) ? "Contratar" : "Adquirir"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* 7A: confirmación con desglose antes de ir a Payphone. <dialog> nativo:
          foco atrapado, Esc y fondo inerte sin código propio. */}
      <dialog ref={dialogo} className="dialogo-compra" aria-labelledby="t-confirmar-compra"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        {seleccion && (
          <div className="dialogo-compra-cuerpo">
            <button type="button" className="dialogo-cerrar" onClick={() => dialogo.current?.close()} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
            <span className="dialogo-icono" aria-hidden="true"><CreditCard size={22} /></span>
            <h2 id="t-confirmar-compra">Confirmar compra</h2>
            <p className="dialogo-sub">
              Vas a adquirir <b>{seleccion.producto.pro_nombre}</b>
              {seleccion.variante.var_nombre && seleccion.variante.var_nombre !== seleccion.producto.pro_nombre
                ? ` · ${seleccion.variante.var_nombre}` : ""}.
            </p>
            <dl className="desglose-compra">
              <div><dt>Subtotal</dt><dd>{USD.format(seleccion.variante.var_precio)}</dd></div>
              <div><dt>IVA {seleccion.variante.var_tarifa_iva_porcentaje} %</dt><dd>{USD.format(seleccion.variante.monto_iva)}</dd></div>
              <div className="es-total"><dt>Total</dt><dd>{USD.format(seleccion.variante.precio_total)}</dd></div>
            </dl>
            <div className="forma-pago">
              <CreditCard size={18} aria-hidden="true" />
              <div>
                <b>Tarjeta de débito o crédito</b>
                <small>Pago seguro con Payphone</small>
              </div>
            </div>
            <div className="dialogo-acciones">
              <button type="button" className="btn btn-neutro" onClick={() => dialogo.current?.close()}>Cancelar</button>
              <button type="button" className="btn btn-primario" onClick={irAPagar}>Ir a pagar</button>
            </div>
          </div>
        )}
      </dialog>

      {seleccion && (
        <ModalCheckoutPayphone
          abierto={pagoAbierto}
          alCerrar={() => setPagoAbierto(false)}
          productoNombre={seleccion.producto.pro_nombre}
          variante={seleccion.variante}
          negocio={negocio}
          alPagoExitoso={() => {
            setPagoAbierto(false);
            avisar("ok", "Pago recibido", `${seleccion.producto.pro_nombre} ya está activo. Te enviamos el comprobante por correo.`);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
