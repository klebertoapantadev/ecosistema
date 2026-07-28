"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Enlace del rail que se marca a sí mismo como activo.
 *
 *  El layout del panel es un Server Component y no recibe la ruta actual, así
 *  que el estado activo se resuelve aquí, en el único trozo de cliente que
 *  hace falta. El filo de color lo pinta `globals.css` a partir de
 *  `aria-current="page"` — el mismo atributo que anuncia el estado al lector
 *  de pantalla, no una clase decorativa aparte. */
export function EnlacePanel({ href, children }: { href: string; children: React.ReactNode }) {
  const ruta = usePathname();
  // `/panel` solo coincide exacto: si no, quedaría activo en todas sus hijas.
  const activo = ruta === href || (href !== "/panel" && ruta.startsWith(`${href}/`));

  return (
    <Link href={href} aria-current={activo ? "page" : undefined}>
      {children}
    </Link>
  );
}
