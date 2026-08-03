"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Shield, ShieldCheck } from "lucide-react";

export type ModoRol = "cliente" | "abogado" | "admin";

interface Props {
  modoInicial?: ModoRol;
  ocultarEtiqueta?: boolean;
}

export function SelectorRolActivo({ modoInicial = "cliente", ocultarEtiqueta = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modoActual, setModoActual] = useState<ModoRol>(modoInicial);

  useEffect(() => {
    // 1. Parámetro en URL tiene prioridad
    const paramModo = searchParams.get("modo") as ModoRol | null;
    if (paramModo && ["cliente", "abogado", "admin"].includes(paramModo)) {
      setModoActual(paramModo);
      return;
    }
    // 2. Cookie de sesión persistente
    const match = document.cookie.match(/(?:^|; )tranqi_modo_rol=([^;]*)/);
    if (match && match[1] && ["cliente", "abogado", "admin"].includes(match[1])) {
      setModoActual(match[1] as ModoRol);
    }
  }, [searchParams, modoInicial]);

  const cambiarModo = (nuevoModo: ModoRol) => {
    // Guardar cookie persistente en todo el dominio por 1 año
    document.cookie = `tranqi_modo_rol=${nuevoModo}; path=/; max-age=31536000; SameSite=Lax`;
    setModoActual(nuevoModo);

    // Actualizar la URL de la vista actual y refrescar componentes del servidor
    const params = new URLSearchParams(searchParams.toString());
    params.set("modo", nuevoModo);
    router.push(`${window.location.pathname}?${params.toString()}`);
    router.refresh();
  };

  return (
    <div className="selector-rol-activo">
      {!ocultarEtiqueta && <span className="selector-rol-etiqueta">Ver como:</span>}
      <div className="selector-rol-botones">
        <button
          type="button"
          className={`btn-rol ${modoActual === "cliente" ? "activo" : ""}`}
          onClick={() => cambiarModo("cliente")}
          title="Vista del rol Cliente"
        >
          <User className="icono-btn-rol" strokeWidth={2} />
          <span>Cliente</span>
        </button>

        <button
          type="button"
          className={`btn-rol ${modoActual === "abogado" ? "activo" : ""}`}
          onClick={() => cambiarModo("abogado")}
          title="Vista del rol Socio Abogado"
        >
          <Shield className="icono-btn-rol" strokeWidth={2} />
          <span>Socio Abogado</span>
        </button>

        <button
          type="button"
          className={`btn-rol ${modoActual === "admin" ? "activo" : ""}`}
          onClick={() => cambiarModo("admin")}
          title="Vista del rol Administrador / SuperAdmin"
        >
          <ShieldCheck className="icono-btn-rol" strokeWidth={2} />
          <span>Administrador</span>
        </button>
      </div>
    </div>
  );
}
