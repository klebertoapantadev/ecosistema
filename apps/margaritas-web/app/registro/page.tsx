import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "@eco/identidad";

export const metadata: Metadata = { title: "Crear cuenta — Margaritas Floristería" };

export default function PaginaRegistro() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">Margaritas</Link>
      <h1>Crea tu cuenta</h1>
      <FormularioRegistro negocio="margaritas" />
      <p className="enlace-auth">
        ¿Ya tienes cuenta? <Link href="/ingresar">Ingresa aquí</Link>
      </p>
    </div>
  );
}
