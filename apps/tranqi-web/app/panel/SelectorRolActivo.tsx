"use client";

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
  const modoActual = (searchParams.get("modo") as ModoRol) || modoInicial;

  const cambiarModo = (nuevoModo: ModoRol) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("modo", nuevoModo);
    router.push(`/panel?${params.toString()}`);
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
