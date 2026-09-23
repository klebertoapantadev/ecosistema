"use client";

import { useRef, useState } from "react";
import Link from "next/link";
// Solo iconos que el panel ya usa: lucide 1.x retiró varios alias antiguos.
import { FileText, CreditCard, FileCheck, Upload } from "lucide-react";

/** Estado vacío de la billetera en el inicio (TRQ-013, variante 10E: la idea
 *  de Folder de React Bits, reescrita en CSS). La carpeta se abre al pasar
 *  el ratón o al tocarla, y los papeles siguen al cursor. Es decoración: el
 *  contenido útil es el texto y el botón, que funcionan igual sin ella. */
export function BilleteraVacia() {
  const [abierta, setAbierta] = useState(false);
  const carpeta = useRef<HTMLButtonElement>(null);

  function imantar(mx: number, my: number) {
    carpeta.current?.style.setProperty("--papel-x", `${mx}px`);
    carpeta.current?.style.setProperty("--papel-y", `${my}px`);
  }

  return (
    <div className="billetera-vacia">
      <button
        ref={carpeta}
        type="button"
        className={`carpeta-billetera${abierta ? " es-abierta" : ""}`}
        onClick={() => setAbierta((a) => !a)}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          imantar((e.clientX - r.left - r.width / 2) * 0.15, (e.clientY - r.top - r.height / 2) * 0.15);
        }}
        onPointerLeave={() => imantar(0, 0)}
        aria-expanded={abierta}
        aria-label={abierta ? "Cerrar la carpeta" : "Abrir la carpeta"}
      >
        <span className="carpeta-fondo" />
        <span className="carpeta-papel papel-1"><CreditCard size={19} aria-hidden="true" /></span>
        <span className="carpeta-papel papel-2"><FileText size={19} aria-hidden="true" /></span>
        <span className="carpeta-papel papel-3"><FileCheck size={19} aria-hidden="true" /></span>
        <span className="carpeta-frente frente-izq" />
        <span className="carpeta-frente frente-der" />
      </button>
      <b>Tu billetera está vacía</b>
      <p>Guarda aquí tu cédula, tus contratos y tus escrituras. Te avisamos antes de que venzan.</p>
      <Link href="/panel/billetera-documentos" className="btn btn-primario btn-pequeno">
        <Upload size={16} aria-hidden="true" />
        Subir documento
      </Link>
    </div>
  );
}
