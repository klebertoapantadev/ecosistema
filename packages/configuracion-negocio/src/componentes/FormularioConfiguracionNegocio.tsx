"use client";

import { useState } from "react";
import { actualizarConfiguracionNegocio } from "../acciones";
import type { Tables } from "@eco/db";

type CfgNegocio = Tables<{ schema: "comun_configuracion" }, "cfg_negocio">;

export function FormularioConfiguracionNegocio({ inicial, negocio }: { inicial: CfgNegocio | null; negocio: string }) {
  const detalleInicial = (inicial?.cfg_detalle_configuracion as Record<string, unknown> | null) ?? {};
  const [identificacion, setIdentificacion] = useState(inicial?.cfg_identificacion ?? "");
  const [nombreComercial, setNombreComercial] = useState(inicial?.cfg_nombre_comercial ?? "");
  const [razonSocial, setRazonSocial] = useState(inicial?.cfg_razon_social ?? "");
  const [correoNotificaciones, setCorreoNotificaciones] = useState(
    typeof detalleInicial.correoNotificaciones === "string" ? detalleInicial.correoNotificaciones : "",
  );
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setGuardando(true);
    const resultado = await actualizarConfiguracionNegocio(
      { identificacion, nombreComercial, razonSocial, correoNotificaciones },
      negocio,
    );
    setGuardando(false);
    setMensaje(
      resultado.ok
        ? { tipo: "ok", texto: "Guardado." }
        : { tipo: "error", texto: resultado.error },
    );
  }

  return (
    <form onSubmit={alEnviar} className="form-panel">
      <label>
        Identificación / NIT
        <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} />
      </label>
      <label>
        Nombre comercial
        <input value={nombreComercial} onChange={(e) => setNombreComercial(e.target.value)} required />
      </label>
      <label>
        Razón social
        <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
      </label>
      <label>
        Correo de notificaciones
        <input
          value={correoNotificaciones}
          onChange={(e) => setCorreoNotificaciones(e.target.value)}
          type="email"
          placeholder="notificaciones@tudominio.com"
        />
      </label>
      {mensaje && (
        <p className={mensaje.tipo === "error" ? "error-auth" : "mensaje-ok"}>{mensaje.texto}</p>
      )}
      <button type="submit" className="btn btn-negro" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
