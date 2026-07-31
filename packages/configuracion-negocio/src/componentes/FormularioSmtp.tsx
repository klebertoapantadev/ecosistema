"use client";

import { useState } from "react";
import { guardarSmtp, borrarContrasenaSmtp } from "../acciones-smtp";
import type { Tables } from "@eco/db";

type CfgSmtp = Tables<{ schema: "comun_configuracion" }, "cfg_smtp">;

// PLT-008: servidor SMTP del negocio. La contrasena nunca se precarga en el
// campo -- no se puede, porque el servidor tampoco la puede leer: vive en
// Supabase Vault y solo la descifra la Edge Function enviar-correo. Lo que se
// muestra es si existe o no, y el campo vacio significa "no la cambies".
export function FormularioSmtp({ inicial, negocio }: { inicial: CfgSmtp | null; negocio: string }) {
  const [host, setHost] = useState(inicial?.smt_host ?? "");
  const [puerto, setPuerto] = useState(String(inicial?.smt_puerto ?? 465));
  const [seguro, setSeguro] = useState(inicial?.smt_seguro ?? true);
  const [usuario, setUsuario] = useState(inicial?.smt_usuario ?? "");
  const [remitenteNombre, setRemitenteNombre] = useState(inicial?.smt_remitente_nombre ?? "");
  const [contrasena, setContrasena] = useState("");
  const [activo, setActivo] = useState(inicial?.smt_activo ?? false);
  const [tieneContrasena, setTieneContrasena] = useState(inicial?.smt_secreto_id != null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setGuardando(true);
    const resultado = await guardarSmtp(
      { host, puerto: Number(puerto), seguro, usuario, remitenteNombre, contrasena, activo },
      negocio,
    );
    setGuardando(false);
    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.error });
      return;
    }
    if (contrasena) setTieneContrasena(true);
    setContrasena("");
    setMensaje({ tipo: "ok", texto: "Configuración guardada." });
  }

  async function alBorrarContrasena() {
    setMensaje(null);
    setBorrando(true);
    const resultado = await borrarContrasenaSmtp(negocio);
    setBorrando(false);
    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.error });
      return;
    }
    setTieneContrasena(false);
    setActivo(false);
    setMensaje({ tipo: "ok", texto: "Contraseña eliminada. El envío quedó desactivado." });
  }

  return (
    <form onSubmit={alEnviar} className="form-panel">
      <label>
        Servidor (host)
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.tudominio.com" />
      </label>

      <label>
        Puerto
        <input
          value={puerto}
          onChange={(e) => setPuerto(e.target.value)}
          type="number"
          min={1}
          max={65535}
          inputMode="numeric"
        />
      </label>

      <label className="campo-casilla">
        <input type="checkbox" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} />
        Conexión cifrada desde el inicio (TLS implícito, normalmente puerto 465). Desmárcalo si tu proveedor usa
        STARTTLS, normalmente puerto 587.
      </label>

      <label>
        Usuario
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          type="email"
          placeholder="notificaciones@tudominio.com"
        />
      </label>

      <label>
        Nombre del remitente
        <input
          value={remitenteNombre}
          onChange={(e) => setRemitenteNombre(e.target.value)}
          placeholder="Soporte"
        />
        <small>Es el nombre que verá quien reciba el correo, junto a la dirección del usuario.</small>
      </label>

      <label>
        Contraseña
        <input
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          type="password"
          autoComplete="new-password"
          placeholder={tieneContrasena ? "Guardada — escribe solo si quieres cambiarla" : "Escribe la contraseña"}
        />
        <small>
          {tieneContrasena
            ? "Hay una contraseña guardada y cifrada. Ni siquiera esta pantalla puede volver a mostrarla; déjalo en blanco para conservarla."
            : "Se guarda cifrada. No vuelve a mostrarse después de guardar."}
        </small>
      </label>

      <label className="campo-casilla">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Enviar los correos de este negocio por este servidor
      </label>

      {mensaje && <p className={mensaje.tipo === "error" ? "error-auth" : "mensaje-ok"}>{mensaje.texto}</p>}

      <div className="fila-botones">
        <button type="submit" className="btn btn-negro" disabled={guardando || borrando}>
          {guardando ? "Guardando…" : "Guardar configuración"}
        </button>
        {tieneContrasena && (
          <button type="button" className="btn-mini" onClick={alBorrarContrasena} disabled={guardando || borrando}>
            {borrando ? "Eliminando…" : "Eliminar contraseña"}
          </button>
        )}
      </div>
    </form>
  );
}
