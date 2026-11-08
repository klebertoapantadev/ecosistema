import type { Metadata } from "next";
import Link from "next/link";
import { Users, X } from "lucide-react";
import { listarSolicitudes } from "../../../modulos/socios/consultas";
import { GestionRedProfesionalWidget } from "../../../modulos/socios/componentes/GestionRedProfesionalWidget";

export const metadata: Metadata = { title: "Red Profesional & Socios — tranqi" };

export default async function PaginaSocios() {
  // Al listar se ejecuta también la purga automática de solicitudes previas
  await listarSolicitudes();

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Users size={22} color="#05876E" />
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Red Profesional & Registro de Abogados</h1>
        </div>
        <Link
          href="/panel/administrar"
          title="Cerrar módulo y volver a Administrar"
          style={{
            background: "var(--blanco, #ffffff)",
            border: "1.5px solid var(--panel-linea, #E4E4E4)",
            color: "var(--negro, #111111)",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <X size={18} />
        </Link>
      </div>

      <GestionRedProfesionalWidget />
    </div>
  );
}
