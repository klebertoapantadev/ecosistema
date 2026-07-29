"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Enlace del rail que se marca a sí mismo como activo.
 *
 *  El layout del panel es un Server Component y no recibe la ruta actual, así
 *  que el estado activo se resuelve aquí, en el único trozo de cliente que
 *  hace falta. El filo de color lo pinta `globals.css` a partir de
 *  `aria-current="page"` — el mismo atributo que anuncia el estado al lector
 *  de pantalla, no una clase decorativa aparte.
 *
 *  `icono` recibe el elemento ya renderizado (`<Home ... />`), no el
 *  componente (`Home`): un componente es una función, y una función no se
 *  puede pasar de Server a Client Component (falla la serialización RSC) --
 *  un elemento sí, porque ya es un objeto plano serializable.
 *
 *  En móvil (`app/globals.css`, ≤600px) la etiqueta de texto se oculta
 *  visualmente y solo queda el icono -- el rail horizontal no soportaba bien
 *  6 enlaces con texto (scroll largo). El texto sigue en el DOM (accesible
 *  a lector de pantalla) y como `title` (tooltip en desktop). */
export function EnlacePanel({
  href,
  icono,
  children,
}: {
  href: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  // `/panel` solo coincide exacto: si no, quedaría activo en todas sus hijas.
  const activo = ruta === href || (href !== "/panel" && ruta.startsWith(`${href}/`));

  return (
    <Link href={href} aria-current={activo ? "page" : undefined} title={typeof children === "string" ? children : undefined}>
      {icono}
      <span className="etiqueta-nav">{children}</span>
    </Link>
  );
}
