"use client";

import { useState } from "react";
import { KeyRound, Mail, Save, Trash2 } from "lucide-react";
import { guardarSmtp, borrarContrasenaSmtp } from "../acciones-smtp";
import type { Tables } from "@eco/db";
import {
  estiloAlertaMensaje,
  estiloBotonPeligroSuave,
  estiloBotonPrimario,
  estiloCabeceraTarjeta,
  estiloCajaIconoCabecera,
  estiloCajaToggle,
  estiloCuerpoTarjeta,
  estiloEtiquetaCampo,
  estiloGrillaDosColumnas,
  estiloGrupoCampo,
  estiloInputCampo,
  estiloPastillaEstado,
  estiloPieTarjeta,
  estiloSubtituloBloque,
  estiloTarjetaConfig,
  estiloTextoAyuda,
} from "./estilos-configuracion";

type CfgSmtp = Tables<{ schema: "comun_configuracion" }, "cfg_smtp">;

// PLT-008: servidor SMTP del negocio. La contrasena nunca se precarga en el
// campo -- vive en Supabase Vault y solo la descifra la Edge Function enviar-correo.
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
    setMensaje({ tipo: "ok", texto: "Configuración del servidor de correo guardada." });
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
    setMensaje({ tipo: "ok", texto: "Contraseña eliminada de Vault. El envío quedó desactivado." });
  }

  const tonoEstado = tieneContrasena && activo ? "activo" : tieneContrasena ? "guardado" : "pendiente";

  return (
    <form onSubmit={alEnviar} style={estiloTarjetaConfig}>
      <div style={estiloCabeceraTarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={estiloCajaIconoCabecera}>
            <Mail size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#111827" }}>
              Servidor de Correo Transaccional (SMTP)
            </div>
            <div style={{ fontSize: "0.82rem", color: "#6B7280", marginTop: "2px" }}>
              Despacho de códigos de verificación, recuperación de clave y notificaciones de{" "}
              <strong>{negocio}</strong>.
            </div>
          </div>
        </div>

        <span style={estiloPastillaEstado(tonoEstado)}>
          <KeyRound size={13} />
          {tieneContrasena && activo
            ? "Activo en Vault"
            : tieneContrasena
              ? "Clave en Vault (Inactivo)"
              : "Sin configurar"}
        </span>
      </div>

      <div style={estiloCuerpoTarjeta}>
        <div style={estiloSubtituloBloque}>Conexión del servidor</div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`smtp-host-${negocio}`} style={estiloEtiquetaCampo}>
              Servidor saliente (Host)
            </label>
            <input
              id={`smtp-host-${negocio}`}
              style={estiloInputCampo}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.tudominio.com"
            />
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`smtp-puerto-${negocio}`} style={estiloEtiquetaCampo}>
              Puerto TCP
            </label>
            <input
              id={`smtp-puerto-${negocio}`}
              style={estiloInputCampo}
              value={puerto}
              onChange={(e) => setPuerto(e.target.value)}
              type="number"
              min={1}
              max={65535}
              inputMode="numeric"
            />
          </div>
        </div>

        <label style={estiloCajaToggle}>
          <input
            type="checkbox"
            checked={seguro}
            onChange={(e) => setSeguro(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1F2937" }}>
              Conexión cifrada TLS implícita (puerto 465)
            </div>
            <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "2px", lineHeight: 1.45 }}>
              Desmárcalo únicamente si tu proveedor de correo utiliza STARTTLS sobre el puerto 587.
            </div>
          </div>
        </label>

        <div style={estiloSubtituloBloque}>Autenticación y remitente</div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`smtp-usuario-${negocio}`} style={estiloEtiquetaCampo}>
              Usuario / Buzón SMTP
            </label>
            <input
              id={`smtp-usuario-${negocio}`}
              style={estiloInputCampo}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              type="email"
              placeholder="notificaciones@tudominio.com"
            />
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`smtp-remitente-${negocio}`} style={estiloEtiquetaCampo}>
              Nombre visible del remitente
            </label>
            <input
              id={`smtp-remitente-${negocio}`}
              style={estiloInputCampo}
              value={remitenteNombre}
              onChange={(e) => setRemitenteNombre(e.target.value)}
              placeholder="Ej. Tinkay Floristería"
            />
          </div>
        </div>

        <div style={estiloGrupoCampo}>
          <label htmlFor={`smtp-clave-${negocio}`} style={estiloEtiquetaCampo}>
            Contraseña del buzón (Supabase Vault)
          </label>
          <input
            id={`smtp-clave-${negocio}`}
            style={estiloInputCampo}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={
              tieneContrasena
                ? "Guardada en Vault — escribe solo si deseas reemplazarla"
                : "Escribe la contraseña o clave de aplicación SMTP"
            }
          />
          <span style={estiloTextoAyuda}>
            {tieneContrasena
              ? "La contraseña está cifrada en Supabase Vault y nunca vuelve a mostrarse; déjala en blanco para conservarla."
              : "Se cifra automáticamente en Supabase Vault al guardar."}
          </span>
        </div>

        <label
          style={{
            ...estiloCajaToggle,
            background: activo ? "#F0FDF4" : "#F9FAFB",
            borderColor: activo ? "#BBF7D0" : "#E5E7EB",
          }}
        >
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>
              Habilitar envío de correos transaccionales por este servidor
            </div>
            <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "2px" }}>
              Mientras esté desmarcado, los correos salientes de este negocio permanecerán pausados.
            </div>
          </div>
        </label>

        {mensaje && <div style={estiloAlertaMensaje(mensaje.tipo)}>{mensaje.texto}</div>}
      </div>

      <div style={estiloPieTarjeta}>
        <div>
          {tieneContrasena && (
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={alBorrarContrasena}
              disabled={guardando || borrando}
              title="Eliminar contraseña SMTP de Supabase Vault"
              aria-label="Eliminar contraseña SMTP de Supabase Vault"
              style={estiloBotonPeligroSuave}
            >
              <Trash2 size={14} />
              <span className="btn-texto-responsive">
                {borrando ? "Eliminando…" : "Eliminar Clave"}
              </span>
            </button>
          )}
        </div>

        <button
          type="submit"
          className="btn-responsive-accion"
          disabled={guardando || borrando}
          title="Guardar configuración del servidor SMTP"
          aria-label="Guardar configuración del servidor SMTP"
          style={{ ...estiloBotonPrimario, opacity: guardando || borrando ? 0.65 : 1 }}
        >
          <Save size={15} />
          <span className="btn-texto-responsive">
            {guardando ? "Guardando…" : "Guardar Servidor"}
          </span>
        </button>
      </div>
    </form>
  );
}
