import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperacion } from "@eco/identidad";

export const metadata: Metadata = { title: "Recuperar contraseña — FastFix Home" };

export default function PaginaRecuperar() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">FastFix Home</Link>
      <h1>Recupera tu contraseña</h1>
      <FormularioRecuperacion />
      <p className="enlace-auth">
        <Link href="/ingresar">Volver a ingresar</Link>
      </p>
    </div>
  );
}
