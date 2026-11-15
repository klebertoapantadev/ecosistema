import type { Metadata } from "next";
import { WidgetFacturacionElectronica } from "@eco/comercio";
import {
  EliminarCuenta,
  FormularioDatosFacturacion,
  HistorialAccesos,
  obtenerDatosFacturacionUsuario,
  obtenerHistorialAccesos,
  obtenerPerfilActual,
} from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const metadata: Metadata = { title: "Mi cuenta y Facturas — Tinkay Floristería" };
export const dynamic = "force-dynamic";

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual("tinkay");
  const supabase = await crearClienteServidor();
  const [historial, datosFacturacion] = perfil
    ? await Promise.all([
        obtenerHistorialAccesos(supabase, perfil.usu_id, 10, "tinkay"),
        obtenerDatosFacturacionUsuario().catch(() => null),
      ])
    : [[], null];

  return (
    <div
      style={{
        maxWidth: "1080px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h1 style={{ margin: "0 0 6px 0", fontSize: "1.45rem", fontWeight: 800, color: "#111827" }}>
          Mi Cuenta y Comprobantes Electrónicos
        </h1>
        <p style={{ margin: 0, fontSize: "0.86rem", color: "#6B7280" }}>
          Administra tus datos tributarios para facturación electrónica SRI, descarga tus comprobantes RIDE y revisa tu seguridad de acceso.
        </p>
      </div>

      <FormularioDatosFacturacion
        nombresRegistro={perfil?.usu_nombres ?? ""}
        apellidosRegistro={perfil?.usu_apellidos ?? ""}
        correoRegistro={perfil?.usu_correo ?? ""}
        inicial={datosFacturacion?.ok ? datosFacturacion.data : undefined}
      />

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "16px",
          padding: "20px 24px",
        }}
      >
        <WidgetFacturacionElectronica negocio="tinkay" modoVistaForzado="cliente" />
      </div>

      <HistorialAccesos historial={historial} />
      <EliminarCuenta negocio="tinkay" />
    </div>
  );
}
