import type { Metadata } from "next";
import Link from "next/link";
import { FormularioIngreso } from "@eco/identidad";

export const metadata: Metadata = { title: "Ingresar — FastFix Home" };

interface PageProps {
  searchParams: Promise<{ destino?: string; next?: string }>;
}

export default async function PaginaIngreso({ searchParams }: PageProps) {
  const params = await searchParams;
  const destino = params.destino || params.next || "";

  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">FastFix Home</Link>
      <h1>Ingresa a tu cuenta</h1>
      <FormularioIngreso negocio="fastfix" destino={destino} />
      <p className="enlace-auth">
        ¿No tienes cuenta? <Link href={`/registro${destino ? `?destino=${encodeURIComponent(destino)}` : ""}`}>Regístrate</Link>
      </p>
    </div>
  );
}
