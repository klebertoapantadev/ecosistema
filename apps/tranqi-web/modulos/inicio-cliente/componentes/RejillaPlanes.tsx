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

function obtenerFoto(p: ProductoCatalogo, v?: VarianteCatalogo): string | null {
  return (
    v?.var_detalle_variante?.portada_url ||
    v?.var_detalle_variante?.imagen_url ||
    p.pro_detalle_producto?.portada_url ||
    p.pro_detalle_producto?.foto_portada ||
    p.pro_detalle_producto?.imagen_url ||
    (Array.isArray(p.pro_detalle_producto?.galeria_imagenes) && p.pro_detalle_producto.galeria_imagenes[0]) ||
    null
  );
}

interface RejillaPlanesProps {
  negocio?: string;
  filtroInicial?: Filtro;
}

export function RejillaPlanes({ negocio = "tranqi", filtroInicial = "todos" }: RejillaPlanesProps) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [productos, setProductos] = useState<ProductoCatalogo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [variantesSeleccionadas, setVariantesSeleccionadas] = useState<Record<string, string>>({});
  const [seleccion, setSeleccion] = useState<{ producto: ProductoCatalogo; variante: VarianteCatalogo } | null>(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const segmentos = useRef<(HTMLButtonElement | null)[]>([]);
  const pulgar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let vigente = true;
    obtenerProductosDestacadosClienteAction(negocio, "ECOMMERCE_WEB")
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

  const visibles = productos.filter((p) => {
    const canales = Array.isArray(p.canales_visibilidad) ? p.canales_visibilidad : [];
    if (canales.length > 0 && !canales.includes("ECOMMERCE_WEB")) {
      return false;
    }
    return filtro === "todos" ? true : filtro === "planes" ? esPlan(p) : !esPlan(p);
  });
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
          const varianteIdActual = variantesSeleccionadas[p.pro_id];
          const variante = (p.variantes || []).find((v) => v.var_id === varianteIdActual) || p.variantes[0];
          if (!variante) return null;

          const Icono = iconoDe(p);
          const foto = obtenerFoto(p, variante);
          const beneficios: string[] = Array.isArray(p.pro_detalle_producto?.beneficios)
            ? p.pro_detalle_producto.beneficios.filter(Boolean).slice(0, 4)
            : [];
          const tiempoEntrega = p.pro_detalle_producto?.tiempo_entrega || p.pro_detalle_producto?.promesa_entrega;

          return (
            <article key={`${filtro}-${p.pro_id}`} className={`plan-tarjeta${p.pro_id === recomendado ? " es-recomendado" : ""}`}>
              {/* Foto de portada o encabezado con ícono */}
              {foto ? (
                <div style={{ position: "relative", width: "100%", height: "135px", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
                  <img
                    src={foto}
                    alt={p.pro_nombre}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                  {p.pro_id === recomendado && (
                    <span className="plan-chip" style={{ position: "absolute", top: "8px", right: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                      Recomendado
                    </span>
                  )}
                  {p.variantes.length > 1 && (
                    <span style={{ position: "absolute", bottom: "6px", left: "6px", background: "rgba(15,23,42,0.85)", color: "#FFFFFF", fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: "6px" }}>
                      {p.variantes.length} modalidades
                    </span>
                  )}
                </div>
              ) : (
                <div className="plan-cabecera">
                  <span className="plan-icono" aria-hidden="true"><Icono size={18} strokeWidth={1.7} /></span>
                  {p.pro_id === recomendado && <span className="plan-chip">Recomendado</span>}
                </div>
              )}

              <span className="plan-eyebrow">{esPlan(p) ? "Suscripción" : "Servicio puntual"}</span>
              <h3 style={{ fontSize: "0.98rem", lineHeight: 1.25, margin: "2px 0 4px" }}>{p.pro_nombre}</h3>

              {tiempoEntrega && (
                <div style={{ fontSize: "0.72rem", color: "var(--panel-gris)", display: "flex", alignItems: "center", gap: "4px", margin: "2px 0 6px", fontWeight: 600 }}>
                  <span aria-hidden="true">⏱️</span>
                  <span>{tiempoEntrega}</span>
                </div>
              )}

              {/* Selector de variantes si tiene más de 1 opción */}
              {p.variantes.length > 1 && (
                <div style={{ margin: "4px 0 8px", display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label htmlFor={`var-select-${p.pro_id}`} style={{ fontSize: "0.688rem", fontWeight: 700, color: "var(--panel-gris)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Opción / Nivel:
                  </label>
                  <select
                    id={`var-select-${p.pro_id}`}
                    value={variante.var_id}
                    onChange={(e) => {
                      const vId = e.target.value;
                      setVariantesSeleccionadas((prev) => ({ ...prev, [p.pro_id]: vId }));
                    }}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "7px",
                      border: "1.5px solid var(--panel-linea)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      background: "var(--panel-papel)",
                      color: "var(--negro)",
                      cursor: "pointer",
                    }}
                  >
                    {p.variantes.map((v) => (
                      <option key={v.var_id} value={v.var_id}>
                        {v.var_nombre} ({USD.format(v.precio_total)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {beneficios.length > 0 ? (
                <ul className="plan-beneficios">
                  {beneficios.map((b) => (
                    <li key={b}><Check size={15} strokeWidth={2.2} aria-hidden="true" />{b}</li>
                  ))}
                </ul>
              ) : p.pro_descripcion ? (
                <p style={{ fontSize: "0.813rem", color: "var(--panel-gris)", margin: "4px 0 10px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.pro_descripcion}
                </p>
              ) : null}

              <div className="plan-pie">
                <div className="plan-precio">
                  <b>{USD.format(variante.precio_total)}</b>
                  <small>
                    IVA {variante.var_tarifa_iva_porcentaje} % incl.
                    {variante.var_frecuencia_recurrencia ? ` · ${variante.var_frecuencia_recurrencia.toLowerCase()}` : ""}
                  </small>
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

            {obtenerFoto(seleccion.producto, seleccion.variante) ? (
              <div style={{ width: "100%", height: "120px", borderRadius: "12px", overflow: "hidden", marginBottom: "4px" }}>
                <img
                  src={obtenerFoto(seleccion.producto, seleccion.variante)!}
                  alt={seleccion.producto.pro_nombre}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ) : (
              <span className="dialogo-icono" aria-hidden="true"><CreditCard size={22} /></span>
            )}

            <h2 id="t-confirmar-compra" style={{ margin: "2px 0 0" }}>Confirmar compra</h2>
            <p className="dialogo-sub" style={{ margin: 0 }}>
              Vas a adquirir <b>{seleccion.producto.pro_nombre}</b>
            </p>

            {/* Selector de variantes dentro del modal si hay más de 1 */}
            {seleccion.producto.variantes.length > 1 && (
              <div style={{ background: "var(--panel-papel)", padding: "12px 14px", borderRadius: "12px", display: "grid", gap: "8px" }}>
                <b style={{ fontSize: "0.82rem", color: "var(--negro)" }}>Selecciona tu modalidad o plan:</b>
                <div style={{ display: "grid", gap: "6px" }}>
                  {seleccion.producto.variantes.map((v) => {
                    const estaElegida = v.var_id === seleccion.variante.var_id;
                    return (
                      <button
                        key={v.var_id}
                        type="button"
                        onClick={() => {
                          setSeleccion({ ...seleccion, variante: v });
                          setVariantesSeleccionadas((prev) => ({ ...prev, [seleccion.producto.pro_id]: v.var_id }));
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: estaElegida ? "1.5px solid var(--panel-accion)" : "1px solid var(--panel-linea)",
                          background: estaElegida ? "var(--panel-tenue)" : "var(--blanco)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: estaElegida ? "var(--panel-accion)" : "var(--negro)" }}>
                            {v.var_nombre}
                          </div>
                          {v.var_frecuencia_recurrencia && (
                            <div style={{ fontSize: "0.72rem", color: "var(--panel-gris)" }}>
                              Cobro {v.var_frecuencia_recurrencia.toLowerCase()}
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--negro)" }}>
                          {USD.format(v.precio_total)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {seleccion.producto.pro_descripcion && (
              <p style={{ fontSize: "0.83rem", color: "var(--panel-gris)", lineHeight: 1.45, margin: 0 }}>
                {seleccion.producto.pro_descripcion}
              </p>
            )}

            {Array.isArray(seleccion.producto.pro_detalle_producto?.beneficios) && seleccion.producto.pro_detalle_producto.beneficios.length > 0 && (
              <div style={{ background: "var(--panel-papel)", padding: "10px 14px", borderRadius: "10px", fontSize: "0.813rem" }}>
                <b style={{ display: "block", marginBottom: "6px", color: "var(--negro)" }}>¿Qué incluye?</b>
                <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "4px", color: "var(--panel-gris)" }}>
                  {seleccion.producto.pro_detalle_producto.beneficios.map((b: string) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="desglose-compra">
              <div><dt>Subtotal</dt><dd>{USD.format(seleccion.variante.var_precio)}</dd></div>
              <div><dt>IVA {seleccion.variante.var_tarifa_iva_porcentaje} %</dt><dd>{USD.format(seleccion.variante.monto_iva)}</dd></div>
              <div className="es-total"><dt>Total a pagar</dt><dd>{USD.format(seleccion.variante.precio_total)}</dd></div>
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
