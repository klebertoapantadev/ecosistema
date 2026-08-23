import { redirect } from "next/navigation";
import { obtenerPerfilActual } from "@eco/identidad";
import { WidgetBilleteraDocumentos } from "@/modulos/billetera-documentos";
import Link from "next/link";
import { X } from "lucide-react";

export const metadata = {
  title: "Billetera Digital de Documentos Seguros · Tranqi",
  description: "Bóveda de documentos personales, vehiculares, contratos y profesionales con extracción OCR y enlaces efímeros (TTL)",
};

export default async function PaginaBilleteraDocumentos() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect("/ingresar?redirect=/panel/billetera-documentos");
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <Link
          href="/panel"
          title="Cerrar y volver al panel"
          aria-label="Cerrar y volver al panel"
          style={{
            background: "#FFFFFF",
            border: "1.5px solid #E2E8F0",
            color: "#1E293B",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            textDecoration: "none",
          }}
        >
          <X size={18} />
        </Link>
      </div>

      <WidgetBilleteraDocumentos negocio="TRANQ" />
    </div>
  );
}
