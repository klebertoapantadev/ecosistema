import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperacion } from "@eco/identidad";

export const metadata: Metadata = { title: "Recuperar contraseña — tranqi" };

export default function PaginaRecuperar() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">tranqi</Link>
      <h1>Recupera tu contraseña</h1>
      <FormularioRecuperacion negocio="tranqi" />
      <p className="enlace-auth">
        <Link href="/ingresar">Volver a ingresar</Link>
      </p>
    </div>
  );
}
