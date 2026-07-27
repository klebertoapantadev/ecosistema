import type { Metadata } from "next";
import Link from "next/link";
import { FormularioIngreso } from "@eco/identidad";

export const metadata: Metadata = { title: "Ingresar — tinkay" };

export default function PaginaIngreso() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">tinkay</Link>
      <h1>Ingresa a tu cuenta</h1>
      <FormularioIngreso />
      <p className="enlace-auth">
        ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
      </p>
    </div>
  );
}
