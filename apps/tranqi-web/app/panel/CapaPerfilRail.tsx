"use client";

import { createContext, useCallback, useContext, useState, useEffect } from "react";
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

/** Cookie y no localStorage: el layout la lee en el servidor y pinta el rail
 *  ya plegado. Con localStorage el primer HTML salía abierto y se cerraba
 *  después de hidratar, un salto visible en cada navegación completa. */
export const COOKIE_RAIL_PLEGADO = "tranqi_rail_plegado";

interface ContextoRail {
  plegado: boolean;
  alternar: () => void;
}

const RailContexto = createContext<ContextoRail>({ plegado: false, alternar: () => {} });

/** Estado del rail (TRQ-013). Lo consumen el botón de plegar y la
 *  navegación, que solo muestra tooltips cuando las etiquetas no se ven. */
export function useRail(): ContextoRail {
  return useContext(RailContexto);
}

export function CapaPerfilRail({
  claseBase,
  railPlegadoInicial = false,
  children,
}: {
  claseBase: string;
  railPlegadoInicial?: boolean;
  puedeConmutar?: boolean;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const [clasePerfil, setClasePerfil] = useState<string>(claseBase);
  const [plegado, setPlegado] = useState<boolean>(railPlegadoInicial);

  const alternar = useCallback(() => {
    setPlegado((antes) => {
      const ahora = !antes;
      document.cookie = `${COOKIE_RAIL_PLEGADO}=${ahora ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return ahora;
    });
  }, []);

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

  return (
    <RailContexto.Provider value={{ plegado, alternar }}>
      <div className={`panel-layout ${clasePerfil}${plegado ? " rail-plegado" : ""}`}>{children}</div>
    </RailContexto.Provider>
  );
}
