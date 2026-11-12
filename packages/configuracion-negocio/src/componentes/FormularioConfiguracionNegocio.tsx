"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Save } from "lucide-react";
import { actualizarConfiguracionNegocio } from "../acciones";
import type { Tables } from "@eco/db";
import {
  estiloAlertaMensaje,
  estiloBotonPrimario,
  estiloCabeceraTarjeta,
  estiloCajaIconoCabecera,
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

type CfgNegocio = Tables<{ schema: "comun_configuracion" }, "cfg_negocio">;

export function FormularioConfiguracionNegocio({
  inicial,
  negocio,
}: {
  inicial: CfgNegocio | null;
  negocio: string;
}) {
  const detalleInicial = (inicial?.cfg_detalle_configuracion as Record<string, unknown> | null) ?? {};
  const [identificacion, setIdentificacion] = useState(inicial?.cfg_identificacion ?? "");
  const [nombreComercial, setNombreComercial] = useState(inicial?.cfg_nombre_comercial ?? "");
  const [razonSocial, setRazonSocial] = useState(inicial?.cfg_razon_social ?? "");
  const [correoNotificaciones, setCorreoNotificaciones] = useState(
    typeof detalleInicial.correoNotificaciones === "string" ? detalleInicial.correoNotificaciones : "",
  );
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const yaConfigurado = Boolean(nombreComercial.trim() || razonSocial.trim() || identificacion.trim());

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
        ? { tipo: "ok", texto: "Datos generales del negocio actualizados correctamente." }
        : { tipo: "error", texto: resultado.error },
    );
  }

  return (
    <form onSubmit={alEnviar} style={estiloTarjetaConfig}>
      <div style={estiloCabeceraTarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={estiloCajaIconoCabecera}>
            <Building2 size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 700, color: "#111827" }}>
              Identidad Comercial y Contacto
            </div>
            <div style={{ fontSize: "0.82rem", color: "#6B7280", marginTop: "2px" }}>
              Información fiscal, marca visible y buzón administrativo de <strong>{negocio}</strong>.
            </div>
          </div>
        </div>

        <span style={estiloPastillaEstado(yaConfigurado ? "activo" : "pendiente")}>
          <CheckCircle2 size={13} />
          {yaConfigurado ? "Ficha registrada" : "Pendiente"}
        </span>
      </div>

      <div style={estiloCuerpoTarjeta}>
        <div style={estiloSubtituloBloque}>Datos fiscales y comerciales</div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`cfg-nombre-${negocio}`} style={estiloEtiquetaCampo}>
              Nombre comercial
            </label>
            <input
              id={`cfg-nombre-${negocio}`}
              style={estiloInputCampo}
              value={nombreComercial}
              onChange={(e) => setNombreComercial(e.target.value)}
              placeholder="Ej. Tinkay Floristería"
              required
            />
            <span style={estiloTextoAyuda}>
              Nombre público que verán los clientes en correos, encabezados y comprobantes.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`cfg-ruc-${negocio}`} style={estiloEtiquetaCampo}>
              RUC / Identificación tributaria
            </label>
            <input
              id={`cfg-ruc-${negocio}`}
              style={estiloInputCampo}
              value={identificacion}
              onChange={(e) => setIdentificacion(e.target.value)}
              placeholder="Ej. 1790000000001"
            />
            <span style={estiloTextoAyuda}>
              Número de identificación fiscal o RUC del establecimiento en Ecuador.
            </span>
          </div>
        </div>

        <div style={estiloGrillaDosColumnas}>
          <div style={estiloGrupoCampo}>
            <label htmlFor={`cfg-razon-${negocio}`} style={estiloEtiquetaCampo}>
              Razón social legal
            </label>
            <input
              id={`cfg-razon-${negocio}`}
              style={estiloInputCampo}
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Razón social o representante titular"
            />
            <span style={estiloTextoAyuda}>
              Denominación oficial empleada en términos legales y documentos tributarios.
            </span>
          </div>

          <div style={estiloGrupoCampo}>
            <label htmlFor={`cfg-correo-${negocio}`} style={estiloEtiquetaCampo}>
              Correo operativo de notificaciones
            </label>
            <input
              id={`cfg-correo-${negocio}`}
              style={estiloInputCampo}
              value={correoNotificaciones}
              onChange={(e) => setCorreoNotificaciones(e.target.value)}
              type="email"
              placeholder="administracion@tudominio.com"
            />
            <span style={estiloTextoAyuda}>
              Dirección interna donde se reciben copias de alertas operativas y pedidos.
            </span>
          </div>
        </div>

        {mensaje && <div style={estiloAlertaMensaje(mensaje.tipo)}>{mensaje.texto}</div>}
      </div>

      <div style={estiloPieTarjeta}>
        <span style={{ fontSize: "0.78rem", color: "#6B7280" }}>
          Los cambios aplican únicamente al negocio <strong>{negocio}</strong>.
        </span>

        <button
          type="submit"
          className="btn-responsive-accion"
          disabled={guardando}
          title="Guardar datos comerciales del negocio"
          aria-label="Guardar datos comerciales del negocio"
          style={{ ...estiloBotonPrimario, opacity: guardando ? 0.65 : 1 }}
        >
          <Save size={15} />
          <span className="btn-texto-responsive">{guardando ? "Guardando…" : "Guardar Datos"}</span>
        </button>
      </div>
    </form>
  );
}
