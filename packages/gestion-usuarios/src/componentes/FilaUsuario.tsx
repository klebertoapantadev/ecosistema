"use client";

import { useState } from "react";
import { asignarPerfil, quitarPerfil } from "../acciones";
import type { UsuarioConMembresia, PerfilAsignable } from "../consultas";

// PLT-003 regla 3: casillas y no un desplegable. Un `<select>` obliga a elegir
// UNO, que es exactamente lo que el requerimiento descarta -- "CLIENTE y
// ABOGADO simultáneamente" no era expresable en el control anterior.
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
    // Se refleja solo si el servidor aceptó: el techo jerárquico lo decide el
    // RPC, no esta pantalla.
    setAsignados((actual) => (marcado ? [...actual, clave] : actual.filter((c) => c !== clave)));
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
            // Regla 5: no se ofrece siquiera lo que el gestor no podría
            // asignar. El RPC lo rechazaría igual, pero un control que
            // siempre falla es peor que un control ausente.
            const fueraDeAlcance = p.nivel > nivelMaximoGestor;
            // Regla 2: CLIENTE es el nivel base y no se retira.
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
    </tr>
  );
}
