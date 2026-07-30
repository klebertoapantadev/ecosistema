import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormularioRestablecer } from "@eco/identidad";

export const metadata: Metadata = { title: "Restablecer contraseña — Margaritas Floristería" };

export default function PaginaRestablecer() {
  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">Margaritas</Link>
      <h1>Elige tu nueva contraseña</h1>
      <Suspense>
        <FormularioRestablecer />
      </Suspense>
    </div>
  );
}
