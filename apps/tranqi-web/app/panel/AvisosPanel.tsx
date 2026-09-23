"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Check, MessageCircle, AlertTriangle, X } from "lucide-react";

/** Avisos flotantes del panel (TRQ-013, variante 9A del muestrario).
 *
 *  Abajo a la izquierda, pegados al rail: a la derecha vive la barra del
 *  asistente (PLT-004) y un aviso ahí la taparía.
 *
 *  - "ok" e "info" se van solos a los 5 s; pasar el ratón por encima pausa
 *    la cuenta (la barra inferior es una animación CSS con play-state).
 *  - "urgente" se queda hasta que el usuario lo cierra, y es el único con
 *    naranja: si se fuera solo, no sería urgente.
 *
 *  Como mucho tres a la vez: el cuarto empuja fuera al más antiguo. */

export type TipoAviso = "ok" | "info" | "urgente";

interface Aviso {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  saliendo: boolean;
}

interface ContextoAvisos {
  avisar: (tipo: TipoAviso, titulo: string, texto: string) => void;
}

const Avisos = createContext<ContextoAvisos>({ avisar: () => {} });

export function useAvisos(): ContextoAvisos {
  return useContext(Avisos);
}

const ICONO = { ok: Check, info: MessageCircle, urgente: AlertTriangle } as const;
let serie = 0;

export function ProveedorAvisos({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const quitar = useCallback((id: number) => {
    setAvisos((lista) => lista.map((a) => (a.id === id ? { ...a, saliendo: true } : a)));
    // Tras la animación de salida (300 ms en globals.css).
    window.setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), 320);
  }, []);

  const avisar = useCallback((tipo: TipoAviso, titulo: string, texto: string) => {
    setAvisos((lista) => [...lista, { id: ++serie, tipo, titulo, texto, saliendo: false }].slice(-3));
  }, []);

  return (
    <Avisos.Provider value={{ avisar }}>
      {children}
      <div className="avisos-panel">
        {avisos.map((a) => {
          const Icono = ICONO[a.tipo];
          return (
            <div
              key={a.id}
              className={`aviso-panel es-${a.tipo}${a.saliendo ? " es-saliente" : ""}`}
              role={a.tipo === "urgente" ? "alert" : "status"}
            >
              <span className="aviso-panel-icono" aria-hidden="true"><Icono size={16} strokeWidth={2.2} /></span>
              <div className="aviso-panel-texto">
                <b>{a.titulo}</b>
                <p>{a.texto}</p>
              </div>
              <button type="button" className="aviso-panel-cerrar" onClick={() => quitar(a.id)} aria-label="Cerrar aviso">
                <X size={15} aria-hidden="true" />
              </button>
              {a.tipo !== "urgente" && (
                <span className="aviso-panel-tiempo" onAnimationEnd={() => quitar(a.id)} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </Avisos.Provider>
  );
}
