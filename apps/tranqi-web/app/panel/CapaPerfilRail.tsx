"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const MAPA_CLASES_PERFIL: Record<string, string> = {
  cliente: "perfil-cliente",
  operador: "perfil-operador",
  auxiliar: "perfil-operador",
  abogado: "perfil-abogado",
  socio: "perfil-abogado",
  tecnico: "perfil-tecnico",
  admin: "perfil-admin",
  administrador: "perfil-admin",
  superadmin: "perfil-superadmin"
};

export function CapaPerfilRail({
  claseBase,
  children,
}: {
  claseBase: string;
  puedeConmutar?: boolean;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const [clasePerfil, setClasePerfil] = useState<string>(claseBase);

  useEffect(() => {
    // 1. Parámetro de URL `?modo=...` tiene máxima prioridad
    const paramModo = searchParams.get("modo")?.toLowerCase();
    if (paramModo) {
      const claseUrl = MAPA_CLASES_PERFIL[paramModo];
      if (claseUrl) {
        setClasePerfil(claseUrl);
        return;
      }
    }

    // 2. Cookie de modo de rol activo
    const matchModo = document.cookie.match(/(?:^|; )tranqi_modo_rol=([^;]*)/);
    if (matchModo && matchModo[1]) {
      const modoCookieVal = matchModo[1].toLowerCase();
      const claseCookie = MAPA_CLASES_PERFIL[modoCookieVal];
      if (claseCookie) {
        setClasePerfil(claseCookie);
        return;
      }
    }

    // 3. Cookie de rol favorito
    const matchFav = document.cookie.match(/(?:^|; )tranqi_rol_favorito=([^;]*)/);
    if (matchFav && matchFav[1]) {
      const favCookieVal = matchFav[1].toLowerCase();
      const claseFav = MAPA_CLASES_PERFIL[favCookieVal];
      if (claseFav) {
        setClasePerfil(claseFav);
        return;
      }
    }

    setClasePerfil(claseBase);
  }, [searchParams, claseBase]);

  return <div className={`panel-layout ${clasePerfil}`}>{children}</div>;
}
