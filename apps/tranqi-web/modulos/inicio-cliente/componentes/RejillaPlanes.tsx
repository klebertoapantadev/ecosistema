"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Clock, FileCheck, MessageCircle, ShieldCheck, UserRound, X } from "lucide-react";
import {
  obtenerProductosDestacadosClienteAction,
  type ProductoCatalogo,
  type VarianteCatalogo,
} from "@eco/comercio/acciones";
import { ModalCheckoutPayphone } from "@eco/comercio/componentes/ModalCheckoutPayphone";
import { useAvisos } from "../../../app/panel/AvisosPanel";

/** Planes y servicios del inicio del cliente (TRQ-CLI-001).
 *
 *  Maqueta aprobada el 7-nov-2026: TRANQUI/demo/planes.html.
 *  - Arriba, un carrusel con la foto del catálogo de fondo y degradado
 *    lateral: una diapositiva por modalidad del plan, cada una con su tono
 *    (correcciones del cliente, 14-nov-2026: «los planes son 3, que pase más
 *    despacio, un tono por plan»). Los servicios ya no entran al carrusel; si
 *    no hay plan, se muestran los servicios destacados.
 *  - Debajo, los trámites y servicios en tarjetas con foto y filtro por
 *    categoría.
 *  El plan corporativo (B2B) no se ofrece a personas. Los DATOS y el PAGO
 *  son de plataforma (@eco/comercio); la apariencia vive aquí y en
 *  globals.css (clases `ini-`). */

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const DURACION_DIAPO_MS = 12000;

// Tono del degradado de cada modalidad (canales RGB, ver `--tono` en
// globals.css): violeta, esmeralda y azul de la paleta de marca, en tinta.
const TONOS_PLAN = ["30, 0, 70", "5, 42, 35", "10, 32, 92"];
const MAX_DIAPOS = 5;

function esPlan(p: ProductoCatalogo) {
  return p.pro_tipo === "SUSCRIPCION";
}

// Más estrecho que el filtro de la vitrina: aquel incluye "sas" y ocultaría
// la constitución de compañía S.A.S., que sí se vende a personas.
function esCorporativo(p: ProductoCatalogo) {
  const texto = `${p.pro_nombre} ${p.categoria?.ctg_nombre ?? ""} ${p.categoria?.ctg_slug ?? ""}`;
  return /corporativ|\bb2b\b/i.test(texto);
}

function variantesActivas(p: ProductoCatalogo): VarianteCatalogo[] {
  return (p.variantes || []).filter((v) => v.var_activo !== false).sort((a, b) => a.precio_total - b.precio_total);
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

function iconoDe(p: ProductoCatalogo) {
  if (esPlan(p)) return ShieldCheck;
  if (/consulta|asesor/i.test(p.pro_nombre)) return MessageCircle;
  return FileCheck;
}

function tipoDe(p: ProductoCatalogo): string {
  if (esPlan(p)) return "Plan";
  const cat = `${p.categoria?.ctg_slug ?? ""} ${p.categoria?.ctg_nombre ?? ""}`.toLowerCase();
  if (cat.includes("consult") || /consulta|asesor/i.test(p.pro_nombre)) return "Consulta";
  if (cat.includes("proceso")) return "Proceso";
  return "Trámite";
}

const SUFIJO_FRECUENCIA: Record<string, string> = { MENSUAL: "/mes", ANUAL: "/año", QUINCENAL: "/quincena", SEMANAL: "/semana" };
const TEXTO_FRECUENCIA: Record<string, string> = { MENSUAL: "al mes", ANUAL: "al año", QUINCENAL: "a la quincena", SEMANAL: "a la semana" };
const NOTA_FRECUENCIA: Record<string, string> = { MENSUAL: "cobro mensual", ANUAL: "cobro anual", QUINCENAL: "cobro quincenal", SEMANAL: "cobro semanal" };

/** Diapositiva del carrusel: una modalidad de un plan, o un servicio. */
interface Diapo {
  clave: string;
  producto: ProductoCatalogo;
  variante?: VarianteCatalogo;
  tono?: string;
}

function frecuenciaDe(v: VarianteCatalogo): string {
  return (v.var_frecuencia_recurrencia || "").toUpperCase();
}

// «Plan Básico Individual» → «Básico Individual»; «Amparo Familiar (4 Citas +
// 2 Contratos)» → «Amparo Familiar»: el detalle ya lo cuentan los beneficios.
function nombreCorto(v: VarianteCatalogo): string {
  return v.var_nombre.replace(/\s*\(.*\)\s*$/, "").replace(/^plan\s+/i, "").trim() || v.var_nombre;
}

const PERIODO: Record<string, string> = { MENSUAL: " al mes", ANUAL: " al año", SEMANAL: " a la semana" };

// Los derechos de la variante (lo que consume com_fn_consumir_derecho) dicen
// qué incluye cada modalidad; si no hay, se usan los beneficios del producto.
function textoDerecho(d: any): string | null {
  const n: number | null = d?.incluidos ?? null;
  const per = PERIODO[String(d?.periodo || "").toUpperCase()] ?? "";
  switch (d?.concepto) {
    case "CONSULTA_TELEMATICA":
      return n === null ? "Consultas con tu abogado sin límite" : `${n} ${n === 1 ? "consulta" : "consultas"} con tu abogado${per}`;
    case "REVISION_CONTRATO":
      return n === null ? "Revisiones de contrato sin límite" : `${n} ${n === 1 ? "revisión" : "revisiones"} de contrato${per}`;
    case "PODER_NOTARIAL":
      return n === null ? "Poderes notariales sin límite" : `${n} ${n === 1 ? "poder notarial" : "poderes notariales"}${per}`;
    case "CONSULTA_ARIA_IA":
      return "Tranqi, tu asistente legal 24/7";
    case "DESCUENTO_NOTARIAL":
      return d?.porcentaje ? `${d.porcentaje} % menos en trámites notariales` : d?.nombre || null;
    default:
      return d?.nombre || null;
  }
}

function beneficiosDe(p: ProductoCatalogo, v?: VarianteCatalogo): string[] {
  const derechos = v?.var_detalle_variante?.derechos;
  if (Array.isArray(derechos) && derechos.length > 0) {
    return derechos.map(textoDerecho).filter((t): t is string => Boolean(t)).slice(0, 4);
  }
  const beneficios = p.pro_detalle_producto?.beneficios;
  return Array.isArray(beneficios) ? beneficios.filter(Boolean).slice(0, 4) : [];
}

function miembrosDe(p: ProductoCatalogo, v: VarianteCatalogo): number {
  const n = Number(v.var_detalle_variante?.miembros_cubiertos ?? p.pro_detalle_producto?.miembros_cubiertos ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 6) : 0;
}

function plazoDe(p: ProductoCatalogo): string | null {
  return p.pro_detalle_producto?.tiempo_entrega || p.pro_detalle_producto?.promesa_entrega || null;
}

function prefiereSinMovimiento() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Cifra que cuenta hasta `objetivo` al cambiar de modalidad. */
function useCifra(objetivo: number): string {
  const [valor, setValor] = useState(objetivo);
  const previo = useRef(objetivo);
  useEffect(() => {
    const desde = previo.current;
    previo.current = objetivo;
    if (desde === objetivo || prefiereSinMovimiento()) {
      setValor(objetivo);
      return;
    }
    let cuadro = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / 650);
      setValor(desde + (objetivo - desde) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [objetivo]);
  return valor.toFixed(2);
}

/** Pulgar de un control segmentado: se coloca midiendo el botón elegido. */
function usePulgar(indice: number, dependencias: unknown[]) {
  const grupo = useRef<HTMLDivElement>(null);
  const pulgar = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const colocar = () => {
      const b = grupo.current?.querySelectorAll<HTMLButtonElement>("button")[indice];
      if (b && pulgar.current) {
        pulgar.current.style.width = `${b.offsetWidth}px`;
        pulgar.current.style.transform = `translateX(${b.offsetLeft - 4}px)`;
      }
    };
    colocar();
    window.addEventListener("resize", colocar);
    return () => window.removeEventListener("resize", colocar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, ...dependencias]);
  return { grupo, pulgar };
}

const IconoCheck = () => (
  <span className="ini-ok" aria-hidden="true">
    <Check size={11} strokeWidth={3.4} />
  </span>
);

// ── Diapositiva del plan ─────────────────────────────────────────────────
function DiapoPlan({
  producto,
  variante,
  activa,
  recomendado,
  alElegir,
  alContratar,
}: {
  producto: ProductoCatalogo;
  variante: VarianteCatalogo;
  activa: boolean;
  recomendado: boolean;
  /** Las modalidades son diapositivas: elegir una lleva a la suya. */
  alElegir: (v: VarianteCatalogo) => void;
  alContratar: (v: VarianteCatalogo) => void;
}) {
  // Las mismas modalidades que tienen diapositiva (ver `diapos`).
  const variantes = variantesActivas(producto).slice(0, MAX_DIAPOS);
  const elegida = Math.max(0, variantes.findIndex((v) => v.var_id === variante.var_id));
  const { grupo, pulgar } = usePulgar(elegida, [activa, variantes.length]);
  const frecuencia = frecuenciaDe(variante);
  // Un plan anual se anuncia por su precio al año («al año» resaltado) y abajo
  // se muestra lo que equivale al mes; el cobro sigue siendo uno al año.
  const anual = frecuencia === "ANUAL";
  const precio = useCifra(anual ? Math.round((variante.precio_total / 12) * 100) / 100 : variante.precio_total);

  const familiar = /famil/i.test(variante.var_nombre);
  const beneficios = beneficiosDe(producto, variante);
  const miembros = miembrosDe(producto, variante);

  return (
    <>
      {recomendado && <span className="ini-chip-rec">Recomendado</span>}
      <div className="ini-contenido">
        <p className="ini-eyebrow" style={{ "--n": 0 } as React.CSSProperties}>
          {producto.pro_nombre}
        </p>
        <h2 style={{ "--n": 1 } as React.CSSProperties}>
          {familiar ? "Protege a tu familia" : "Protégete"} por <em>{USD.format(variante.precio_total)}</em>
          {anual ? (
            <>
              {" "}
              <span className="ini-periodo">al año</span>
            </>
          ) : TEXTO_FRECUENCIA[frecuencia] ? (
            ` ${TEXTO_FRECUENCIA[frecuencia]}`
          ) : (
            ""
          )}
        </h2>
        {producto.pro_descripcion && (
          <p className="ini-bajada" style={{ "--n": 2 } as React.CSSProperties}>
            {producto.pro_descripcion}
          </p>
        )}
        {variantes.length > 1 && (
          <div
            className="ini-modalidades"
            ref={grupo}
            role="group"
            aria-label="Modalidad del plan"
            style={{ "--n": 3 } as React.CSSProperties}
          >
            <span className="ini-pulgar" ref={pulgar} aria-hidden="true" />
            {variantes.map((v, k) => (
              <button key={v.var_id} type="button" aria-pressed={k === elegida} onClick={() => alElegir(v)}>
                {nombreCorto(v)}
              </button>
            ))}
          </div>
        )}
        {beneficios.length > 0 && (
          <ul className="ini-beneficios" key={variante.var_id} style={{ "--n": 4 } as React.CSSProperties}>
            {beneficios.map((b, k) => (
              <li key={b} style={{ "--k": k } as React.CSSProperties}>
                <IconoCheck />
                {b}
              </li>
            ))}
          </ul>
        )}
        <div className="ini-cierre" style={{ "--n": 5 } as React.CSSProperties}>
          <div>
            <div className="ini-precio">
              <small>$</small>
              <strong>{precio}</strong>
              {anual ? <span>/mes</span> : SUFIJO_FRECUENCIA[frecuencia] && <span>{SUFIJO_FRECUENCIA[frecuencia]}</span>}
            </div>
            <p className="ini-precio-nota">
              {anual
                ? `IVA incluido · un pago de ${USD.format(variante.precio_total)} al año`
                : `IVA incluido${NOTA_FRECUENCIA[frecuencia] ? ` · ${NOTA_FRECUENCIA[frecuencia]}` : ""}`}
            </p>
          </div>
          <button type="button" className="ini-btn-contratar" onClick={() => alContratar(variante)}>
            Contratar plan
          </button>
        </div>
      </div>
      <div className="ini-poliza" aria-hidden="true">
        <div>
          <p className="ini-eyebrow">Póliza tranqi</p>
          <p className="ini-poliza-nombre">Plan {nombreCorto(variante)}</p>
        </div>
        {miembros > 0 && (
          <div className="ini-miembros" key={`${variante.var_id}-m`}>
            {Array.from({ length: miembros }, (_, k) => (
              <span key={k} style={{ "--k": k } as React.CSSProperties}>
                <UserRound size={15} strokeWidth={2.2} />
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Diapositiva de un servicio ───────────────────────────────────────────
function DiapoServicio({ producto, alContratar }: { producto: ProductoCatalogo; alContratar: () => void }) {
  const variantes = variantesActivas(producto);
  const desde = variantes[0];
  if (!desde) return null;
  const plazo = plazoDe(producto);
  const incluye = beneficiosDe(producto).slice(0, 3);
  return (
    <div className="ini-contenido">
      <p className="ini-eyebrow" style={{ "--n": 0 } as React.CSSProperties}>
        {tipoDe(producto)}
        {producto.categoria?.ctg_nombre ? ` · ${producto.categoria.ctg_nombre}` : ""}
      </p>
      <h2 style={{ "--n": 1 } as React.CSSProperties}>{producto.pro_nombre}</h2>
      {producto.pro_descripcion && (
        <p className="ini-bajada" style={{ "--n": 2 } as React.CSSProperties}>
          {producto.pro_descripcion}
        </p>
      )}
      {plazo && (
        <span className="ini-plazo" style={{ "--n": 3 } as React.CSSProperties}>
          <Clock size={15} /> {plazo}
        </span>
      )}
      {incluye.length > 0 && (
        <ul className="ini-beneficios" style={{ "--n": 4 } as React.CSSProperties}>
          {incluye.map((b, k) => (
            <li key={b} style={{ "--k": k } as React.CSSProperties}>
              <IconoCheck />
              {b}
            </li>
          ))}
        </ul>
      )}
      <div className="ini-cierre" style={{ "--n": 5 } as React.CSSProperties}>
        <div>
          <div className="ini-precio">
            {variantes.length > 1 && <small className="ini-desde">desde</small>}
            <small>$</small>
            <strong>{desde.precio_total.toFixed(2)}</strong>
          </div>
          <p className="ini-precio-nota">IVA incluido · pago único</p>
        </div>
        <button type="button" className="ini-btn-contratar" onClick={alContratar}>
          {variantes.length > 1 ? "Ver opciones" : "Contratar"}
        </button>
      </div>
    </div>
  );
}

// ── Carrusel ─────────────────────────────────────────────────────────────
function Destacados({
  diapos,
  alContratarPlan,
  alContratarServicio,
}: {
  diapos: Diapo[];
  alContratarPlan: (p: ProductoCatalogo, v: VarianteCatalogo) => void;
  alContratarServicio: (p: ProductoCatalogo) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [sinMovimiento, setSinMovimiento] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const toque = useRef<number | null>(null);
  const total = diapos.length;

  useEffect(() => setSinMovimiento(prefiereSinMovimiento()), []);

  const irA = (n: number) => setIndice(((n % total) + total) % total);
  const detenido = pausado || sinMovimiento || total < 2;

  return (
    <section
      ref={raiz}
      className={`ini-carrusel${detenido ? " es-pausado" : ""}`}
      aria-roledescription="carrusel"
      aria-label="Destacados"
      tabIndex={0}
      style={{ "--dur": `${DURACION_DIAPO_MS}ms` } as React.CSSProperties}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(Boolean(raiz.current?.contains(document.activeElement)))}
      onFocus={() => setPausado(true)}
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node)) setPausado(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") irA(indice - 1);
        if (e.key === "ArrowRight") irA(indice + 1);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") toque.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (toque.current === null) return;
        const dx = e.clientX - toque.current;
        toque.current = null;
        if (Math.abs(dx) > 50) irA(indice + (dx < 0 ? 1 : -1));
      }}
    >
      {diapos.map((d, k) => {
        const p = d.producto;
        const activa = k === indice;
        const foto = obtenerFoto(p, d.variante ?? variantesActivas(p)[0]);
        return (
          <article
            key={d.clave}
            className={`ini-diapo${activa ? " es-activa" : ""}${foto ? "" : " sin-foto"}`}
            style={d.tono ? ({ "--tono": d.tono } as React.CSSProperties) : undefined}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${k + 1} de ${total}`}
            aria-hidden={!activa}
            inert={!activa}
          >
            {foto && <img className="ini-fondo" src={foto} alt="" loading={k === 0 ? "eager" : "lazy"} />}
            {esPlan(p) && d.variante ? (
              <DiapoPlan
                producto={p}
                variante={d.variante}
                activa={activa}
                recomendado={k === 0}
                alElegir={(v) => {
                  const destino = diapos.findIndex((x) => x.variante?.var_id === v.var_id);
                  if (destino >= 0) irA(destino);
                }}
                alContratar={(v) => alContratarPlan(p, v)}
              />
            ) : (
              <DiapoServicio producto={p} alContratar={() => alContratarServicio(p)} />
            )}
          </article>
        );
      })}

      {total > 1 && (
        <div className="ini-controles">
          <div className="ini-indicadores" role="tablist" aria-label="Elegir destacado">
            {diapos.map((d, k) => (
              <button
                key={d.clave}
                type="button"
                role="tab"
                aria-label={`Destacado ${k + 1}: ${d.variante && esPlan(d.producto) ? nombreCorto(d.variante) : d.producto.pro_nombre}`}
                aria-selected={k === indice}
                className={k < indice ? "es-visto" : ""}
                onClick={() => irA(k)}
              >
                <span
                  key={k === indice ? `activo-${indice}` : k}
                  className="ini-relleno"
                  onAnimationEnd={() => {
                    if (k === indice) irA(indice + 1);
                  }}
                />
              </button>
            ))}
          </div>
          <span className="ini-contador" aria-hidden="true">
            {indice + 1} / {total}
          </span>
          <div className="ini-flechas">
            <button type="button" aria-label="Anterior" onClick={() => irA(indice - 1)}>
              <ChevronLeft size={18} strokeWidth={2.4} />
            </button>
            <button type="button" aria-label="Siguiente" onClick={() => irA(indice + 1)}>
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Catálogo de Productos y Servicios Individuales ───────────────────────
interface ItemProductoIndividual {
  idUnico: string;
  producto: ProductoCatalogo;
  variante: VarianteCatalogo;
  totalVariantesProducto: number;
  categoriaSlug: string;
  categoriaNombre: string;
}

function Catalogo({
  productos,
  alContratarDirecto,
}: {
  productos: ProductoCatalogo[];
  alContratarDirecto: (p: ProductoCatalogo, v: VarianteCatalogo) => void;
}) {
  const itemsIndividuales = useMemo<ItemProductoIndividual[]>(() => {
    const lista: ItemProductoIndividual[] = [];
    for (const p of productos) {
      const vars = variantesActivas(p);
      const catSlug = esPlan(p) ? "planes" : p.categoria?.ctg_slug || "servicios";
      const catNombre = esPlan(p) ? "Planes" : p.categoria?.ctg_nombre || "Servicios";
      for (const v of vars) {
        lista.push({
          idUnico: `${p.pro_id}__${v.var_id}`,
          producto: p,
          variante: v,
          totalVariantesProducto: vars.length,
          categoriaSlug: catSlug,
          categoriaNombre: catNombre,
        });
      }
    }
    return lista;
  }, [productos]);

  const categorias = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const item of itemsIndividuales) {
      if (item.categoriaSlug && item.categoriaNombre && !vistas.has(item.categoriaSlug)) {
        vistas.set(item.categoriaSlug, item.categoriaNombre);
      }
    }
    return Array.from(vistas, ([id, nombre]) => ({ id, nombre })).slice(0, 6);
  }, [itemsIndividuales]);

  const [filtro, setFiltro] = useState("todos");
  const opciones = [{ id: "todos", nombre: "Todos" }, ...categorias];
  const { grupo, pulgar } = usePulgar(
    Math.max(0, opciones.findIndex((o) => o.id === filtro)),
    [categorias.length],
  );
  const visibles =
    filtro === "todos"
      ? itemsIndividuales
      : itemsIndividuales.filter((item) => item.categoriaSlug === filtro);

  return (
    <section className="ini-catalogo" aria-labelledby="t-catalogo">
      <header>
        <div>
          <h2 id="t-catalogo">Productos y Servicios</h2>
          <p>Todos nuestros planes, consultas jurídicas y trámites legales presentados de forma individual.</p>
        </div>
        {categorias.length > 1 && (
          <div className="ini-filtros" ref={grupo} role="group" aria-label="Filtrar por categoría">
            <span className="ini-pulgar" ref={pulgar} aria-hidden="true" />
            {opciones.map((o) => (
              <button key={o.id} type="button" aria-pressed={filtro === o.id} onClick={() => setFiltro(o.id)}>
                {o.nombre}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="ini-tarjetas">
        {visibles.map((item, k) => {
          const { producto: p, variante: v, totalVariantesProducto } = item;
          const foto = obtenerFoto(p, v);
          const Icono = iconoDe(p);
          const plazo = plazoDe(p);
          const duracionMin = v.var_detalle_variante?.duracion_min;
          const frecuencia = frecuenciaDe(v);
          const sufijoFreq = esPlan(p) ? SUFIJO_FRECUENCIA[frecuencia] || "/mes" : "";
          const tituloIndividual =
            totalVariantesProducto > 1 ? v.var_nombre : p.pro_nombre;
          const descripcionIndividual =
            v.var_detalle_variante?.descripcion_corta || p.pro_descripcion;
          const metaTexto = [
            duracionMin ? `${duracionMin} min` : plazo,
            esPlan(p)
              ? NOTA_FRECUENCIA[frecuencia] || "suscripción"
              : "IVA incluido · pago único",
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <article key={`${filtro}-${item.idUnico}`} className="ini-producto" style={{ "--n": k } as React.CSSProperties}>
              <div className="ini-imagen">
                {foto ? (
                  <img src={foto} alt="" loading="lazy" />
                ) : (
                  <span className="ini-sin-foto" aria-hidden="true">
                    <Icono size={30} strokeWidth={1.6} />
                  </span>
                )}
                <span className="ini-tipo">{tipoDe(p)}</span>
                <span className="ini-precio-foto">
                  {USD.format(v.precio_total)}
                  {sufijoFreq && <small>{sufijoFreq}</small>}
                </span>
              </div>
              <div className="ini-cuerpo">
                {totalVariantesProducto > 1 && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#6D28D9",
                    }}
                  >
                    {p.pro_nombre}
                  </span>
                )}
                <h3>{tituloIndividual}</h3>
                {descripcionIndividual && <p>{descripcionIndividual}</p>}
                {metaTexto && (
                  <span className="ini-meta">
                    <Clock size={13} />
                    {metaTexto}
                  </span>
                )}
                <div className="ini-pie">
                  <button
                    type="button"
                    className="ini-btn-linea"
                    onClick={() => alContratarDirecto(p, v)}
                  >
                    Contratar
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ── Componente principal ─────────────────────────────────────────────────
interface RejillaPlanesProps {
  negocio?: string;
  /** Se conserva por compatibilidad con panel/page.tsx; el diseño ya no filtra. */
  filtroInicial?: "todos" | "planes" | "servicios";
  /** Define si se muestra únicamente el carrusel (Inicio) o el catálogo individual (Productos Servicios). */
  modoVista?: "solo-carrusel" | "solo-catalogo" | "completo";
}

export function RejillaPlanes({ negocio = "tranqi", modoVista = "solo-carrusel" }: RejillaPlanesProps) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [productos, setProductos] = useState<ProductoCatalogo[] | null>(null);
  const [eligiendo, setEligiendo] = useState<ProductoCatalogo | null>(null);
  const [seleccion, setSeleccion] = useState<{ producto: ProductoCatalogo; variante: VarianteCatalogo } | null>(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let vigente = true;
    obtenerProductosDestacadosClienteAction(negocio, "ECOMMERCE_WEB")
      .then((data) => {
        if (vigente) setProductos(data);
      })
      .catch(() => {
        if (vigente) setProductos([]);
      });
    return () => {
      vigente = false;
    };
  }, [negocio]);

  const { planes, servicios, paraPersonas, diapos } = useMemo(() => {
    const paraPersonas = (productos || []).filter((p) => !esCorporativo(p) && variantesActivas(p).length > 0);
    const planes = paraPersonas.filter(esPlan).sort((a, b) => Number(b.pro_destacado) - Number(a.pro_destacado));
    const servicios = paraPersonas.filter((p) => !esPlan(p));
    // Carrusel: una diapositiva por modalidad del plan principal, cada una con
    // su tono. Solo si no hay plan entran los servicios destacados con foto.
    const plan = planes[0];
    let diapos: Diapo[];
    if (plan) {
      diapos = variantesActivas(plan)
        .slice(0, MAX_DIAPOS)
        .map((v, k) => ({ clave: v.var_id, producto: plan, variante: v, tono: TONOS_PLAN[k % TONOS_PLAN.length] }));
    } else {
      const conFoto = servicios.filter((p) => obtenerFoto(p, variantesActivas(p)[0]));
      const destacados = conFoto.filter((p) => p.pro_destacado);
      diapos = (destacados.length > 0 ? destacados : conFoto).slice(0, MAX_DIAPOS).map((p) => ({ clave: p.pro_id, producto: p }));
    }
    return { planes, servicios, paraPersonas, diapos };
  }, [productos]);

  // Sin productos no hay sección.
  if (!productos || (planes.length === 0 && servicios.length === 0)) return null;

  function abrirPago(producto: ProductoCatalogo, variante: VarianteCatalogo) {
    setSeleccion({ producto, variante });
    setPagoAbierto(true);
  }

  // Un servicio con varias opciones pasa antes por un selector breve; el
  // resumen con el desglose lo muestra ya el checkout.
  function contratarServicio(producto: ProductoCatalogo) {
    const variantes = variantesActivas(producto);
    if (variantes.length === 1 && variantes[0]) return abrirPago(producto, variantes[0]);
    setEligiendo(producto);
    dialogo.current?.showModal();
  }

  const mostrarCarrusel = modoVista === "solo-carrusel" || modoVista === "completo";
  const mostrarCatalogoIndividual = modoVista === "solo-catalogo" || modoVista === "completo";

  return (
    <div className="ini-planes">
      {mostrarCarrusel && diapos.length > 0 && (
        <Destacados diapos={diapos} alContratarPlan={abrirPago} alContratarServicio={contratarServicio} />
      )}

      {mostrarCatalogoIndividual && paraPersonas.length > 0 && (
        <Catalogo
          productos={paraPersonas}
          alContratarDirecto={(p, v) => abrirPago(p, v)}
        />
      )}

      <dialog
        ref={dialogo}
        className="dialogo-compra"
        aria-labelledby="t-elegir-opcion"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        {eligiendo && (
          <div className="dialogo-compra-cuerpo">
            <button type="button" className="dialogo-cerrar" onClick={() => dialogo.current?.close()} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
            <h2 id="t-elegir-opcion">{eligiendo.pro_nombre}</h2>
            <p className="dialogo-sub">Elige la opción que necesitas.</p>
            <div className="ini-opciones">
              {variantesActivas(eligiendo).map((v) => (
                <button
                  key={v.var_id}
                  type="button"
                  className="ini-opcion"
                  onClick={() => {
                    dialogo.current?.close();
                    abrirPago(eligiendo, v);
                  }}
                >
                  <span>{v.var_nombre}</span>
                  <b>{USD.format(v.precio_total)}</b>
                </button>
              ))}
            </div>
            <p className="ini-nota-iva">Precios con IVA incluido.</p>
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
            avisar("ok", "Pago recibido", `${seleccion.producto.pro_nombre}: tu pago quedó registrado.`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
