"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarCuenta } from "../acciones";

const PALABRA_CONFIRMACION = "ELIMINAR";

// PLT-012: zona de peligro del panel. Exige escribir la palabra de
// confirmacion antes de habilitar el boton -- es una accion irreversible,
// no basta un solo click. La decision real (borrar vs. rechazar por
// historial transaccional) la toma seg_fn_eliminar_cuenta() en el servidor.
export function EliminarCuenta() {
  const router = useRouter();
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function confirmar() {
    setError(null);
    setCargando(true);
    const resultado = await eliminarCuenta();
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!mostrarConfirmacion) {
    return (
      <div className="zona-peligro">
        <h2>Eliminar mi cuenta</h2>
        <p>
          Esto elimina tu cuenta y tus datos personales de forma permanente. Si ya tienes compras registradas, en
          su lugar anonimizamos tus datos y conservamos solo lo que exige la ley.
        </p>
        <button type="button" className="btn-peligro" onClick={() => setMostrarConfirmacion(true)}>
          Eliminar mi cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="zona-peligro">
      <h2>¿Seguro que quieres eliminar tu cuenta?</h2>
      <p>
        Esta acción no se puede deshacer. Escribe <strong>{PALABRA_CONFIRMACION}</strong> para confirmar.
      </p>
      <input
        value={textoConfirmacion}
        onChange={(e) => setTextoConfirmacion(e.target.value)}
        placeholder={PALABRA_CONFIRMACION}
        autoComplete="off"
      />
      {error && (
        <p className="error-auth" role="alert">
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="btn-peligro"
          disabled={textoConfirmacion !== PALABRA_CONFIRMACION || cargando}
          onClick={confirmar}
        >
          {cargando ? "Eliminando…" : "Sí, eliminar mi cuenta"}
        </button>
        <button
          type="button"
          className="btn-mini"
          onClick={() => {
            setMostrarConfirmacion(false);
            setTextoConfirmacion("");
            setError(null);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
