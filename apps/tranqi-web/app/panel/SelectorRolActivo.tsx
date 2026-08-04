"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Shield, ShieldCheck, UserCheck, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";

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

  // Asegurar que la lista de roles tenga al menos los configurados
  const listaRoles = roles && roles.length > 0 ? roles : ROLES_DEFAULT;

  useEffect(() => {
    // 1. Parámetro en URL tiene prioridad
    const paramModo = searchParams.get("modo")?.toLowerCase();
    if (paramModo) {
      setModoActual(paramModo);
      return;
    }
    // 2. Cookie de sesión persistente
    const match = document.cookie.match(/(?:^|; )tranqi_modo_rol=([^;]*)/);
    if (match && match[1]) {
      setModoActual(match[1].toLowerCase());
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

  return (
    <div className="selector-rol-activo">
      {!ocultarEtiqueta && <span className="selector-rol-etiqueta">Ver como:</span>}
      <div className="selector-rol-botones">
        {listaRoles.map((rol) => {
          const claveUpper = rol.clave.toUpperCase();
          const modoSlug = rol.clave.toLowerCase();
          const esActivo = modoActual === modoSlug || modoActual === claveUpper.toLowerCase();
          const IconoRol = MAPA_ICONOS_ROL[claveUpper] || Shield;

          return (
            <button
              key={rol.clave}
              type="button"
              className={`btn-rol ${esActivo ? "activo" : ""}`}
              onClick={() => cambiarModo(rol.clave)}
              title={`Vista del perfil ${rol.nombre} ${rol.nivel ? `(Nivel ${rol.nivel})` : ""}`}
            >
              <IconoRol className="icono-btn-rol" strokeWidth={2} />
              <span>{rol.nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
