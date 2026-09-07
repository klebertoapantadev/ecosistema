import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "@eco/identidad";

export const metadata: Metadata = { title: "Crear cuenta — tinkay" };

interface PageProps {
  searchParams: Promise<{ destino?: string; next?: string }>;
}

export default async function PaginaRegistro({ searchParams }: PageProps) {
  const params = await searchParams;
  const destino = params.destino || params.next || "";

  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">tinkay</Link>
      <h1>Crea tu cuenta</h1>
      <FormularioRegistro negocio="tinkay" destino={destino} />
      <p className="enlace-auth">
        ¿Ya tienes cuenta? <Link href={`/ingresar${destino ? `?destino=${encodeURIComponent(destino)}` : ""}`}>Ingresa aquí</Link>
      </p>
    </div>
  );
}
