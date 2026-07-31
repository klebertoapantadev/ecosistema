"use client";

import { useSearchParams } from "next/navigation";
import type { ModoRol } from "./SelectorRolActivo";

// El conmutador "Ver como" existe para mirar el portal con los ojos de otro
// rol, pero hasta ahora solo cambiaba el contenido: el rail seguia negro. La
// vista previa quedaba a medias -- contenido de cliente con cromatica de
// administracion, justo lo que el conmutador pretende evitar.
//
// Va en un componente cliente porque un layout de Next NO recibe
// `searchParams` (solo las paginas), y `modo` viaja en la URL. La clase base
// la sigue calculando el servidor con `clasePerfilVisual()`; aqui solo se
// sustituye cuando quien mira puede conmutar de verdad.
const CLASE_POR_MODO: Record<ModoRol, string> = {
  cliente: "perfil-cliente",
  abogado: "perfil-abogado",
  admin: "perfil-admin",
};

function esModo(valor: string | null): valor is ModoRol {
  return valor === "cliente" || valor === "abogado" || valor === "admin";
}

export function CapaPerfilRail({
  claseBase,
  puedeConmutar,
  children,
}: {
  claseBase: string;
  puedeConmutar: boolean;
  children: React.ReactNode;
}) {
  const parametros = useSearchParams();
  const modo = parametros.get("modo");

  // Sin permiso para conmutar, el parametro de URL se ignora -- igual que lo
  // ignora `page.tsx` al decidir el contenido (TRQ-007). Si no, cualquiera
  // repintaria su rail escribiendo `?modo=admin`, que es apariencia, pero
  // apariencia que afirma un rol que no tiene.
  const clase = puedeConmutar && esModo(modo) ? CLASE_POR_MODO[modo] : claseBase;

  return <div className={`panel-layout ${clase}`}>{children}</div>;
}
