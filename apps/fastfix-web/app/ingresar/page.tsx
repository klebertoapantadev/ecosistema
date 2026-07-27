import type { Metadata } from "next";
import Link from "next/link";
import { FormularioIngreso } from "@eco/identidad";

export const metadata: Metadata = { title: "Ingresar — FastFix Home" };

export default function PaginaIngreso() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">FastFix Home</Link>
      <h1>Ingresa a tu cuenta</h1>
      <FormularioIngreso negocio="fastfix" />
      <p className="enlace-auth">
        ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
      </p>
    </div>
  );
}
