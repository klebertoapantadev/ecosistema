import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "@eco/identidad";

export const metadata: Metadata = { title: "Crear cuenta — tinkay" };

export default function PaginaRegistro() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">tinkay</Link>
      <h1>Crea tu cuenta</h1>
      <FormularioRegistro negocio="tinkay" />
      <p className="enlace-auth">
        ¿Ya tienes cuenta? <Link href="/ingresar">Ingresa aquí</Link>
      </p>
    </div>
  );
}
