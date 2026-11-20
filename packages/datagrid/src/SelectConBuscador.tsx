"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface OpcionSelectBuscador {
  value: string;
  label: string;
  disabled: boolean;
  grupo?: string;
  textoNormalizado: string;
}

export interface SelectConBuscadorProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> {
  placeholderBusqueda?: string;
  tituloModal?: string;
  /** Muestra el buscador solo cuando la cantidad de opciones supera este umbral (por defecto 6). */
  umbralBuscador?: number;
  /** Ordena alfabéticamente las opciones manteniendo las opciones placeholder (value="") arriba (por defecto true). */
  ordenarAlfabeticamente?: boolean;
}

export function normalizarTextoBusquedaSelect(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extraerTextoNodoReact(nodo: React.ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(extraerTextoNodoReact).join("");
  if (React.isValidElement(nodo)) {
    const props = nodo.props as { children?: React.ReactNode };
    return extraerTextoNodoReact(props?.children);
  }
  return "";
}

export function extraerOpcionesDeChildrenSelect(
  children: React.ReactNode,
  grupoActual?: string
): OpcionSelectBuscador[] {
  const resultado: OpcionSelectBuscador[] = [];

  React.Children.forEach(children, (hijo) => {
    if (!React.isValidElement(hijo)) return;

    if (hijo.type === React.Fragment) {
      const fragProps = hijo.props as { children?: React.ReactNode };
      resultado.push(...extraerOpcionesDeChildrenSelect(fragProps.children, grupoActual));
      return;
    }

    if (hijo.type === "optgroup") {
      const groupProps = hijo.props as { label?: string; children?: React.ReactNode };
      resultado.push(
        ...extraerOpcionesDeChildrenSelect(groupProps.children, groupProps.label || grupoActual)
      );
      return;
    }

    if (hijo.type === "option") {
      const optProps = hijo.props as {
        value?: string | number | readonly string[];
        disabled?: boolean;
        label?: string;
        children?: React.ReactNode;
      };
      const textoCrudo = (optProps.label ?? extraerTextoNodoReact(optProps.children))
        .replace(/\s+/g, " ")
        .trim();
      const val =
        optProps.value !== undefined
          ? Array.isArray(optProps.value)
            ? String(optProps.value[0] ?? "")
            : String(optProps.value)
          : textoCrudo;

      resultado.push({
        value: val,
        label: textoCrudo || val,
        disabled: Boolean(optProps.disabled),
        grupo: grupoActual,
        textoNormalizado: normalizarTextoBusquedaSelect(
          `${textoCrudo} ${val} ${grupoActual || ""}`
        ),
      });
    }
  });

  return resultado;
}

function claveOrdenAlfabeticoOpcion(texto: string): string {
  const sinSimbolosIniciales = (texto || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return sinSimbolosIniciales || (texto || "").trim();
}

function compararEtiquetasAlfabeticamente(a: string, b: string): number {
  return claveOrdenAlfabeticoOpcion(a).localeCompare(claveOrdenAlfabeticoOpcion(b), "es", {
    sensitivity: "base",
    numeric: true,
  });
}

export function ordenarOpcionesSelectAlfabeticamente(
  opciones: OpcionSelectBuscador[]
): OpcionSelectBuscador[] {
  if (opciones.length <= 1) return opciones;

  const fijas: OpcionSelectBuscador[] = [];
  const restantes: OpcionSelectBuscador[] = [];

  for (const op of opciones) {
    if (!op.grupo && op.value === "") {
      fijas.push(op);
    } else {
      restantes.push(op);
    }
  }

  const tieneGrupos = restantes.some((op) => Boolean(op.grupo));
  if (!tieneGrupos) {
    restantes.sort((a, b) => compararEtiquetasAlfabeticamente(a.label, b.label));
    return [...fijas, ...restantes];
  }

  const porGrupo = new Map<string, OpcionSelectBuscador[]>();
  for (const op of restantes) {
    const claveGrupo = op.grupo ?? "";
    const lista = porGrupo.get(claveGrupo);
    if (lista) {
      lista.push(op);
    } else {
      porGrupo.set(claveGrupo, [op]);
    }
  }

  const clavesGrupoOrdenadas = Array.from(porGrupo.keys()).sort((a, b) => {
    if (a === "" && b !== "") return -1;
    if (b === "" && a !== "") return 1;
    return compararEtiquetasAlfabeticamente(a, b);
  });

  const ordenadas: OpcionSelectBuscador[] = [...fijas];
  for (const claveGrupo of clavesGrupoOrdenadas) {
    const items = porGrupo.get(claveGrupo) ?? [];
    items.sort((a, b) => compararEtiquetasAlfabeticamente(a.label, b.label));
    ordenadas.push(...items);
  }
  return ordenadas;
}

export function filtrarOpcionesSelectPorBusqueda(
  opciones: OpcionSelectBuscador[],
  termino: string
): OpcionSelectBuscador[] {
  const limpio = normalizarTextoBusquedaSelect(termino);
  if (!limpio) return opciones;
  const tokens = limpio.split(" ").filter(Boolean);
  if (tokens.length === 0) return opciones;

  return opciones.filter((op) => tokens.every((tk) => op.textoNormalizado.includes(tk)));
}

export function SelectConBuscador({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  disabled,
  required,
  name,
  id,
  className,
  style,
  title,
  placeholderBusqueda = "Buscar opción…",
  tituloModal,
  umbralBuscador = 6,
  ordenarAlfabeticamente = true,
  children,
  ...restProps
}: SelectConBuscadorProps) {
  const opciones = useMemo(() => {
    const extraidas = extraerOpcionesDeChildrenSelect(children);
    return ordenarAlfabeticamente
      ? ordenarOpcionesSelectAlfabeticamente(extraidas)
      : extraidas;
  }, [children, ordenarAlfabeticamente]);

  const mostrarBuscador = opciones.length > umbralBuscador;

  const esControlado = value !== undefined;
  const [valorInterno, setValorInterno] = useState<string>(() => {
    if (defaultValue !== undefined) {
      return Array.isArray(defaultValue) ? String(defaultValue[0] ?? "") : String(defaultValue);
    }
    return opciones[0]?.value ?? "";
  });

  const valorEfectivo = esControlado
    ? Array.isArray(value)
      ? String(value[0] ?? "")
      : String(value ?? "")
    : valorInterno;

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [indiceActivo, setIndiceActivo] = useState<number>(0);
  const [esMovil, setEsMovil] = useState<boolean>(false);
  const [posicionPopover, setPosicionPopover] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ top: 0, left: 0, width: 280, maxHeight: 300 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const opcionSeleccionada = useMemo(
    () => opciones.find((o) => o.value === valorEfectivo) ?? opciones[0] ?? null,
    [opciones, valorEfectivo]
  );

  const opcionesFiltradas = useMemo(
    () => (mostrarBuscador ? filtrarOpcionesSelectPorBusqueda(opciones, busqueda) : opciones),
    [mostrarBuscador, opciones, busqueda]
  );

  const recalcularPosicion = () => {
    if (typeof window === "undefined") return;
    const movil = window.innerWidth <= 640;
    setEsMovil(movil);
    if (movil || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const baseRect = backdropRef.current?.getBoundingClientRect();
    const baseLeft = baseRect ? baseRect.left : 0;
    const baseTop = baseRect ? baseRect.top : 0;
    const baseWidth = baseRect && baseRect.width > 0 ? baseRect.width : window.innerWidth;
    const baseHeight = baseRect && baseRect.height > 0 ? baseRect.height : window.innerHeight;

    const margenPantalla = 12;
    const anchoDeseado = Math.min(
      Math.max(rect.width, 250),
      Math.min(460, baseWidth - margenPantalla * 2)
    );
    const relLeft = rect.left - baseLeft;
    const relTop = rect.top - baseTop;
    const relBottom = rect.bottom - baseTop;

    const leftClamped = Math.max(
      margenPantalla,
      Math.min(relLeft, baseWidth - anchoDeseado - margenPantalla)
    );

    const espacioAbajo = baseHeight - relBottom - 14;
    const espacioArriba = relTop - 14;
    const abrirHaciaArriba = espacioAbajo < 220 && espacioArriba > espacioAbajo;

    if (abrirHaciaArriba) {
      setPosicionPopover({
        bottom: baseHeight - relTop + 5,
        left: leftClamped,
        width: anchoDeseado,
        maxHeight: Math.max(180, Math.min(340, espacioArriba - 8)),
      });
    } else {
      setPosicionPopover({
        top: relBottom + 5,
        left: leftClamped,
        width: anchoDeseado,
        maxHeight: Math.max(180, Math.min(340, espacioAbajo - 8)),
      });
    }
  };

  const abrirMenu = () => {
    if (disabled) return;
    setBusqueda("");
    const idxActual = Math.max(
      0,
      opciones.findIndex((o) => o.value === valorEfectivo)
    );
    setIndiceActivo(idxActual);
    recalcularPosicion();
    setAbierto(true);
  };

  const cerrarMenu = () => {
    setAbierto(false);
    setBusqueda("");
  };

  useEffect(() => {
    if (!abierto || typeof window === "undefined") return;
    recalcularPosicion();
    const t = window.setTimeout(() => {
      recalcularPosicion();
      if (mostrarBuscador) {
        inputBusquedaRef.current?.focus({ preventScroll: true });
      } else {
        listaRef.current?.focus({ preventScroll: true });
      }
    }, 20);

    const alRedimensionar = () => recalcularPosicion();
    window.addEventListener("resize", alRedimensionar);
    window.addEventListener("scroll", alRedimensionar, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", alRedimensionar);
      window.removeEventListener("scroll", alRedimensionar, true);
    };
  }, [abierto, mostrarBuscador]);

  useEffect(() => {
    setIndiceActivo(0);
  }, [busqueda]);

  const seleccionarOpcion = (op: OpcionSelectBuscador) => {
    if (op.disabled) return;
    if (!esControlado) {
      setValorInterno(op.value);
    }
    if (onChange) {
      const eventoSintetico = {
        target: {
          value: op.value,
          name: name || "",
          id: id || "",
        },
        currentTarget: {
          value: op.value,
          name: name || "",
          id: id || "",
        },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(eventoSintetico);
    }
    cerrarMenu();
    triggerRef.current?.focus({ preventScroll: true });
  };

  const manejarTecladoBusqueda = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cerrarMenu();
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (opcionesFiltradas.length === 0) return;
      setIndiceActivo((prev) => (prev + 1) % opcionesFiltradas.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (opcionesFiltradas.length === 0) return;
      setIndiceActivo((prev) => (prev - 1 + opcionesFiltradas.length) % opcionesFiltradas.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const candidata = opcionesFiltradas[indiceActivo];
      if (candidata && !candidata.disabled) {
        seleccionarOpcion(candidata);
      }
    }
  };

  const ocultarFlechaInterna =
    style?.appearance === "none" || style?.WebkitAppearance === "none";

  const ariaLabelEfectivo =
    (restProps["aria-label"] as string | undefined) ||
    tituloModal ||
    title ||
    "Seleccionar opción";

  const displayTrigger =
    style?.display === "none"
      ? "none"
      : style?.width === "100%" || Boolean(style?.flex)
        ? "flex"
        : "inline-flex";

  const renderListaOpciones = () => {
    if (opcionesFiltradas.length === 0) {
      return (
        <div
          style={{
            padding: "18px 12px",
            textAlign: "center",
            color: "#71717A",
            fontSize: "0.8rem",
          }}
        >
          Sin coincidencias para «{busqueda}»
        </div>
      );
    }

    let ultimoGrupo: string | undefined = undefined;
    return opcionesFiltradas.map((op, idx) => {
      const seleccionada = op.value === valorEfectivo;
      const resaltada = idx === indiceActivo;
      const mostrarCabeceraGrupo = Boolean(op.grupo && op.grupo !== ultimoGrupo);
      ultimoGrupo = op.grupo;

      return (
        <React.Fragment key={`${op.grupo || "g"}-${op.value}-${idx}`}>
          {mostrarCabeceraGrupo && (
            <div
              style={{
                padding: "6px 10px 3px",
                fontSize: "0.68rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#71717A",
              }}
            >
              {op.grupo}
            </div>
          )}
          <button
            type="button"
            role="option"
            aria-selected={seleccionada}
            disabled={op.disabled}
            onMouseEnter={() => setIndiceActivo(idx)}
            onClick={() => seleccionarOpcion(op)}
            style={{
              width: "100%",
              minHeight: esMovil ? "42px" : "34px",
              padding: esMovil ? "9px 11px" : "7px 10px",
              borderRadius: "8px",
              border: seleccionada ? "1px solid #D4D4D8" : "1px solid transparent",
              background: seleccionada
                ? "#F4F4F5"
                : resaltada
                  ? "#FAFAFA"
                  : "#FFFFFF",
              color: op.disabled ? "#A1A1AA" : "#18181B",
              fontSize: esMovil ? "0.86rem" : "0.81rem",
              fontWeight: seleccionada ? 700 : 500,
              fontFamily: "inherit",
              lineHeight: 1.35,
              textAlign: "left",
              cursor: op.disabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {op.label}
            </span>
            {seleccionada && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </React.Fragment>
      );
    });
  };

  return (
    <>
      <style>{`
        :where(.eco-select-buscador) {
          box-sizing: border-box;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid #CBD5E1;
          background: #FFFFFF;
          color: #0F172A;
          font-size: 0.84rem;
          font-weight: 500;
          font-family: inherit;
          line-height: 1.35;
          text-align: left;
          cursor: pointer;
        }
        :where(.eco-select-buscador:disabled) {
          background: #F1F5F9;
          cursor: not-allowed;
          opacity: 0.65;
        }
      `}</style>
      {name && (
        <input type="hidden" name={name} value={valorEfectivo} required={required} />
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        title={title || opcionSeleccionada?.label}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={ariaLabelEfectivo}
        aria-labelledby={restProps["aria-labelledby"]}
        className={["eco-select-buscador", className].filter(Boolean).join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          if (abierto) {
            cerrarMenu();
          } else {
            abrirMenu();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!abierto) abrirMenu();
          } else if (e.key === "Escape" && abierto) {
            e.preventDefault();
            cerrarMenu();
          }
        }}
        onFocus={(e) => {
          if (onFocus) {
            onFocus(e as unknown as React.FocusEvent<HTMLSelectElement>);
          }
        }}
        onBlur={(e) => {
          if (onBlur && !abierto) {
            onBlur(e as unknown as React.FocusEvent<HTMLSelectElement>);
          }
        }}
        style={{
          ...style,
          display: displayTrigger,
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          minWidth: style?.minWidth ?? 0,
          maxWidth: style?.maxWidth ?? "100%",
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {opcionSeleccionada ? opcionSeleccionada.label : "Seleccionar…"}
        </span>

        {!ocultarFlechaInterna && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              flexShrink: 0,
              opacity: 0.68,
              transform: abierto ? "rotate(180deg)" : "none",
              transition: "transform 140ms ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {abierto &&
        (() => {
          const contenidoMenu = (
            <div
              ref={backdropRef}
              onClick={(e) => {
                e.stopPropagation();
                cerrarMenu();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={
                esMovil
                  ? {
                      position: "fixed",
                      inset: 0,
                      zIndex: 10060,
                      background: "rgba(24, 24, 27, 0.45)",
                      backdropFilter: "blur(2px)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }
                  : {
                      position: "fixed",
                      inset: 0,
                      zIndex: 10055,
                      background: "transparent",
                    }
              }
            >
              <div
                role="listbox"
                aria-label={ariaLabelEfectivo}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={
                  esMovil
                    ? {
                        width: "100%",
                        maxHeight: "80dvh",
                        background: "#FFFFFF",
                        borderRadius: "18px 18px 0 0",
                        borderTop: "1px solid #E4E4E7",
                        boxShadow: "0 -14px 36px rgba(24, 24, 27, 0.22)",
                        display: "flex",
                        flexDirection: "column",
                        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                        overflow: "hidden",
                      }
                    : {
                        position: "fixed",
                        top: posicionPopover.top,
                        bottom: posicionPopover.bottom,
                        left: posicionPopover.left,
                        width: `${posicionPopover.width}px`,
                        maxWidth: "calc(100vw - 24px)",
                        background: "#FFFFFF",
                        border: "1px solid #D4D4D8",
                        borderRadius: "12px",
                        boxShadow: "0 14px 34px rgba(24, 24, 27, 0.16)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        zIndex: 10060,
                      }
                }
              >
                {esMovil && (
                  <div
                    style={{
                      padding: "10px 14px 6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      borderBottom: "1px solid #F4F4F5",
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "4px",
                        borderRadius: "999px",
                        background: "#D4D4D8",
                        margin: "0 auto",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "0.88rem",
                          color: "#18181B",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ariaLabelEfectivo}
                      </strong>
                      <button
                        type="button"
                        onClick={cerrarMenu}
                        aria-label="Cerrar selector"
                        title="Cerrar"
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "8px",
                          border: "1px solid #E4E4E7",
                          background: "#FAFAFA",
                          color: "#3F3F46",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Barra fija de búsqueda (solo cuando supera umbralBuscador) */}
                {mostrarBuscador && (
                  <div
                    style={{
                      padding: esMovil ? "8px 12px" : "8px",
                      borderBottom: "1px solid #F4F4F5",
                      background: "#FAFAFA",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#71717A"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      ref={inputBusquedaRef}
                      type="text"
                      inputMode="search"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      onKeyDown={manejarTecladoBusqueda}
                      placeholder={placeholderBusqueda}
                      aria-label="Filtrar opciones"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: "#18181B",
                        fontSize: esMovil ? "16px" : "0.81rem",
                        fontFamily: "inherit",
                        padding: "2px 0",
                      }}
                    />
                    {busqueda && (
                      <button
                        type="button"
                        onClick={() => {
                          setBusqueda("");
                          inputBusquedaRef.current?.focus({ preventScroll: true });
                        }}
                        title="Limpiar búsqueda"
                        aria-label="Limpiar búsqueda"
                        style={{
                          border: "none",
                          background: "#E4E4E7",
                          color: "#3F3F46",
                          width: "22px",
                          height: "22px",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Lista desplazable de opciones */}
                <div
                  ref={listaRef}
                  tabIndex={mostrarBuscador ? undefined : -1}
                  onKeyDown={mostrarBuscador ? undefined : manejarTecladoBusqueda}
                  style={{
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    maxHeight: esMovil ? "62dvh" : `${posicionPopover.maxHeight}px`,
                    padding: "5px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    outline: "none",
                  }}
                >
                  {renderListaOpciones()}
                </div>
              </div>
            </div>
          );

          return typeof document !== "undefined"
            ? createPortal(contenidoMenu, document.body)
            : contenidoMenu;
        })()}
    </>
  );
}
