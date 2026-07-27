"use client";

import { useState } from "react";
import { asignarRol } from "../acciones";
import type { UsuarioConMembresia } from "../consultas";

export function FilaUsuario({
  usuario,
  negocio,
  roles,
}: {
  usuario: UsuarioConMembresia;
  negocio: string;
  roles: string[];
}) {
  const [rol, setRol] = useState(usuario.mem_rol);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function alGuardar() {
    setGuardando(true);
    setMensaje(null);
    const resultado = await asignarRol(usuario.usu_id, rol, negocio);
    setGuardando(false);
    setMensaje(resultado.ok ? "Actualizado" : resultado.error);
  }

  const nombre = [usuario.usu_nombres, usuario.usu_apellidos].filter(Boolean).join(" ") || "—";

  return (
    <tr>
      <td>{nombre}</td>
      <td>{usuario.usu_correo}</td>
      <td>{usuario.mem_estado}</td>
      <td>
        <select value={rol} onChange={(e) => setRol(e.target.value)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="btn-mini"
          onClick={alGuardar}
          disabled={guardando || rol === usuario.mem_rol}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {mensaje && <span className="mensaje-fila"> {mensaje}</span>}
      </td>
    </tr>
  );
}
