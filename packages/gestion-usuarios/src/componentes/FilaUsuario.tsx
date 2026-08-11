"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { asignarPerfil, quitarPerfil, eliminarUsuarioSuperAdminAction } from "../acciones";
import type { UsuarioConMembresia, PerfilAsignable } from "../consultas";

export function FilaUsuario({
  usuario,
  negocio,
  perfiles,
  nivelMaximoGestor,
}: {
  usuario: UsuarioConMembresia;
  negocio: string;
  perfiles: PerfilAsignable[];
  nivelMaximoGestor: number;
}) {
  const [asignados, setAsignados] = useState<string[]>(usuario.perfiles);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function alternar(clave: string, marcado: boolean) {
    setOcupado(clave);
    setMensaje(null);
    const resultado = marcado
      ? await asignarPerfil(usuario.usu_id, clave, negocio)
      : await quitarPerfil(usuario.usu_id, clave, negocio);
    setOcupado(null);

    if (!resultado.ok) {
      setMensaje(resultado.error ?? "Error al procesar la solicitud");
      return;
    }
    setAsignados((actual) => (marcado ? [...actual, clave] : actual.filter((c) => c !== clave)));
  }

  async function handleEliminar() {
    if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR la cuenta de "${usuario.usu_correo}"?\n\nSe borrarán todas sus solicitudes, perfiles y datos.`)) {
      return;
    }
    setEliminando(true);
    const res = await eliminarUsuarioSuperAdminAction(usuario.usu_id);
    if (res.ok) {
      alert("✅ Usuario eliminado con éxito.");
      window.location.reload();
    } else {
      alert(`❌ Error al eliminar: ${res.error}`);
      setEliminando(false);
    }
  }

  const nombre = [usuario.usu_nombres, usuario.usu_apellidos].filter(Boolean).join(" ") || "—";

  return (
    <tr>
      <td>{nombre}</td>
      <td>{usuario.usu_correo}</td>
      <td>{usuario.mem_estado}</td>
      <td>
        <div className="perfiles-usuario">
          {perfiles.map((p) => {
            const tiene = asignados.includes(p.clave);
            const fueraDeAlcance = p.nivel > nivelMaximoGestor;
            const esBase = p.clave === "CLIENTE";

            return (
              <label
                key={p.clave}
                className={`perfil-casilla${tiene ? " perfil-casilla-activa" : ""}`}
                title={
                  fueraDeAlcance
                    ? `Requiere jerarquía ${p.nivel} o superior`
                    : esBase
                      ? "Perfil base, no se puede retirar"
                      : `Nivel ${p.nivel}`
                }
              >
                <input
                  type="checkbox"
                  checked={tiene}
                  disabled={ocupado !== null || fueraDeAlcance || (esBase && tiene)}
                  onChange={(e) => alternar(p.clave, e.target.checked)}
                />
                {p.nombre}
                <span className="perfil-nivel">{p.nivel}</span>
              </label>
            );
          })}
        </div>
        {mensaje && <p className="error-auth mensaje-fila">{mensaje}</p>}
      </td>
      <td>
        {usuario.usu_correo !== "kleber.toapanta.ch@gmail.com" ? (
          <button
            type="button"
            onClick={handleEliminar}
            disabled={eliminando}
            style={{
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              color: "#DC2626",
              borderRadius: "8px",
              padding: "4px 8px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <Trash2 size={13} /> {eliminando ? "Eliminando..." : "Eliminar"}
          </button>
        ) : (
          <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>Protegido</span>
        )}
      </td>
    </tr>
  );
}
