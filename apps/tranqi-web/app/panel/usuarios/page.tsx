import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { ConsultaUsuariosPerfilesWidget } from "@eco/gestion-usuarios/componentes/ConsultaUsuariosPerfilesWidget";

export const metadata: Metadata = { title: "Gestión de usuarios — tranqi" };

const NEGOCIO = "TRANQ";

export default function PaginaGestionUsuarios() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <Link
          href="/panel"
          title="Cerrar módulo y volver al menú principal"
          style={{
            background: "var(--blanco, #ffffff)",
            border: "1.5px solid var(--panel-linea, #E4E4E4)",
            color: "var(--negro, #111111)",
            borderRadius: "50%",
            width: "38px",
            height: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          }}
        >
          <X size={20} />
        </Link>
      </div>

      <ConsultaUsuariosPerfilesWidget negocio={NEGOCIO} />
    </div>
  );
}
