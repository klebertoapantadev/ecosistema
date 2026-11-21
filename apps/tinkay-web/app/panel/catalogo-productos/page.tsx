import { redirect } from "next/navigation";
import { CatalogoProductosComercio } from "@eco/comercio";
import Link from "next/link";
import { X } from "lucide-react";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Catálogo Comercial y Portafolio · Tinkay Floristería",
  description: "Arreglos florales, bouquets coreanos, variantes y cross-selling con IVA 15% desglozado",
};

export default async function PaginaCatalogoProductosTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();

  if (!ctx.perfil) {
    redirect("/ingresar?redirect=/panel/catalogo-productos");
  }
  if (!ctx.clavesAutorizadas.has("catalogo_productos")) {
    redirect("/panel");
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
      <div
        className="catalogo-solo-pantalla-grande"
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}
      >
        <Link
          href="/panel"
          title="Cerrar y volver al panel"
          aria-label="Cerrar y volver al panel"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D5CFC4",
            color: "#1F1C19",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          <X size={16} />
        </Link>
      </div>

      <CatalogoProductosComercio negocio="tinkay" />
    </div>
  );
}
