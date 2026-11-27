"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
// la ruta de acciones ("use server"), no el índice: el índice arrastra código de servidor
import { guardarPreferenciaTema } from "@eco/identidad/acciones";

/** TRQ-040 · Tema del panel: claro, oscuro o el del sistema.
 *
 *  La elección vive en el perfil (seg_usuario.usu_preferencia_tema) para que
 *  siga al usuario entre dispositivos, y además en localStorage: el script del
 *  <head> (app/layout.tsx) la lee ANTES de pintar, así no hay un fogonazo del
 *  tema contrario en cada carga. El CSS hace el resto (color-scheme +
 *  light-dark(), ver «Tema oscuro» en globals.css).
 *
 *  Hay dos instancias: la del rail (que además alinea el navegador con el
 *  perfil) y la de Mi cuenta. Se avisan con un evento para no desincronizarse. */
export type Tema = "claro" | "oscuro" | "sistema";
export const CLAVE_TEMA = "tranqi-tema";
const EVENTO = "tranqi-tema";

const OPCIONES: { valor: Tema; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
  { valor: "sistema", etiqueta: "Sistema", Icono: Monitor },
];

export function temaValido(valor: unknown): Tema {
  return valor === "claro" || valor === "oscuro" ? valor : "sistema";
}

function aplicar(tema: Tema) {
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* modo privado: queda solo el perfil */ }
}

export function SelectorTema({
  inicial,
  variante,
}: {
  /** el tema guardado en el perfil */
  inicial: Tema;
  /** "rail": solo iconos y alinea el navegador con el perfil · "cuenta": con texto */
  variante: "rail" | "cuenta";
}) {
  const [tema, setTema] = useState<Tema>(inicial);

  useEffect(() => {
    if (variante === "rail") {
      // El perfil manda: si este navegador recordaba otra cosa (se cambió
      // desde otro dispositivo), se alinea aquí, una vez por carga.
      if (document.documentElement.dataset.tema !== inicial) aplicar(inicial);
    } else {
      setTema(temaValido(document.documentElement.dataset.tema));
    }
    const alCambiar = (e: Event) => setTema((e as CustomEvent<Tema>).detail);
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, [inicial, variante]);

  function elegir(nuevo: Tema) {
    if (nuevo === tema) return;
    setTema(nuevo);
    aplicar(nuevo);
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: nuevo }));
    // Si falla (sin red, migración pendiente) el tema ya quedó en este
    // navegador; solo no viajará a los demás dispositivos.
    void guardarPreferenciaTema(nuevo).catch(() => undefined);
  }

  return (
    <div className={`selector-tema selector-tema-${variante}`} role="radiogroup" aria-label="Tema de la interfaz">
      {OPCIONES.map(({ valor, etiqueta, Icono }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          aria-label={`Tema ${etiqueta.toLowerCase()}`}
          title={etiqueta}
          onClick={() => elegir(valor)}
        >
          <Icono aria-hidden="true" strokeWidth={1.8} />
          {variante === "cuenta" && <span>{etiqueta}</span>}
        </button>
      ))}
    </div>
  );
}
