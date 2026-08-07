"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Shield, ShieldCheck, UserCheck, ShieldAlert, Sparkles, Star, type LucideIcon } from "lucide-react";

export interface RolOpcionDef {
  clave: string;
  nombre: string;
  nivel?: number;
}

export type ModoRol = string;

// Mapeo predeterminado de iconos e identificadores según la clave del perfil
const MAPA_ICONOS_ROL: Record<string, LucideIcon> = {
  CLIENTE: User,
  OPERADOR: UserCheck,
  ABOGADO: Shield,
  SOCIO: Shield,
  TECNICO: Shield,
  FLORISTA: Sparkles,
  ADMINISTRADOR: ShieldCheck,
  SUPERADMIN: ShieldAlert
};

// Roles predeterminados del sistema en caso de no especificarse
export const ROLES_DEFAULT: RolOpcionDef[] = [
  { clave: "CLIENTE", nombre: "Cliente", nivel: 1 },
  { clave: "OPERADOR", nombre: "Operador / Auxiliar", nivel: 30 },
  { clave: "ABOGADO", nombre: "Socio Abogado", nivel: 50 },
  { clave: "ADMINISTRADOR", nombre: "Administrador del Negocio", nivel: 80 },
  { clave: "SUPERADMIN", nombre: "SuperAdmin de Plataforma", nivel: 100 }
];

interface Props {
  modoInicial?: ModoRol;
  ocultarEtiqueta?: boolean;
  roles?: RolOpcionDef[];
}

export function SelectorRolActivo({ modoInicial = "cliente", ocultarEtiqueta = false, roles = ROLES_DEFAULT }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modoActual, setModoActual] = useState<ModoRol>(modoInicial.toLowerCase());
  const [rolFavorito, setRolFavorito] = useState<string | null>(null);

  // Asegurar que la lista de roles tenga al menos los configurados
  const listaRoles = roles && roles.length > 0 ? roles : ROLES_DEFAULT;

  useEffect(() => {
    // 1. Parámetro en URL tiene prioridad
    const paramModo = searchParams.get("modo")?.toLowerCase();
    if (paramModo) {
      setModoActual(paramModo);
    } else {
      // 2. Cookie de sesión de modo activo
      const match = document.cookie.match(/(?:^|; )tranqi_modo_rol=([^;]*)/);
      if (match && match[1]) {
        setModoActual(match[1].toLowerCase());
      }
    }

    // 3. Cargar rol favorito predeterminado
    const matchFav = document.cookie.match(/(?:^|; )tranqi_rol_favorito=([^;]*)/);
    if (matchFav && matchFav[1]) {
      setRolFavorito(matchFav[1].toLowerCase());
    } else {
      const localFav = localStorage.getItem("tranqi_rol_favorito");
      if (localFav) setRolFavorito(localFav.toLowerCase());
    }
  }, [searchParams, modoInicial]);

  const cambiarModo = (nuevoModoClave: string) => {
    const modoSlug = nuevoModoClave.toLowerCase();
    // Guardar cookie persistente en todo el dominio por 1 año
    document.cookie = `tranqi_modo_rol=${modoSlug}; path=/; max-age=31536000; SameSite=Lax`;
    setModoActual(modoSlug);

    // Actualizar la URL de la vista actual y refrescar componentes del servidor
    const params = new URLSearchParams(searchParams.toString());
    params.set("modo", modoSlug);
    router.push(`${window.location.pathname}?${params.toString()}`);
    router.refresh();
  };

  const marcarComoFavorito = (e: React.MouseEvent, nuevoModoClave: string) => {
    e.stopPropagation();
    const modoSlug = nuevoModoClave.toLowerCase();
    document.cookie = `tranqi_rol_favorito=${modoSlug}; path=/; max-age=31536000; SameSite=Lax`;
    localStorage.setItem("tranqi_rol_favorito", modoSlug);
    setRolFavorito(modoSlug);
  };

  return (
    <div className="selector-rol-activo">
      {!ocultarEtiqueta && <span className="selector-rol-etiqueta">Ver como:</span>}
      <div className="selector-rol-botones">
        {listaRoles.map((rol) => {
          const claveUpper = rol.clave.toUpperCase();
          const modoSlug = rol.clave.toLowerCase();
          const esActivo = modoActual === modoSlug || modoActual === claveUpper.toLowerCase();
          const esFavorito = rolFavorito === modoSlug || rolFavorito === claveUpper.toLowerCase();
          const IconoRol = MAPA_ICONOS_ROL[claveUpper] || Shield;

          return (
            <div key={rol.clave} style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
              <button
                type="button"
                className={`btn-rol ${esActivo ? "activo" : ""}`}
                onClick={() => cambiarModo(rol.clave)}
                title={`Vista del perfil ${rol.nombre} ${rol.nivel ? `(Nivel ${rol.nivel})` : ""}`}
                style={{ paddingRight: "28px" }}
              >
                <IconoRol className="icono-btn-rol" strokeWidth={2} />
                <span>{rol.nombre}</span>
              </button>

              {/* Botón de Estrella Favorito por Rol */}
              <button
                type="button"
                onClick={(e) => marcarComoFavorito(e, rol.clave)}
                title={esFavorito ? "Este es tu rol favorito predeterminado al ingresar" : "Establecer como rol favorito por defecto al ingresar"}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: esFavorito ? "#FEE300" : esActivo ? "rgba(255,255,255,0.6)" : "var(--panel-gris, #737373)",
                  zIndex: 2
                }}
              >
                <Star
                  size={14}
                  fill={esFavorito ? "#FEE300" : "none"}
                  stroke={esFavorito ? "#D97706" : "currentColor"}
                  strokeWidth={2}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
