import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "@eco/identidad";

export const metadata: Metadata = { title: "Crear cuenta — tranqi" };

interface PageProps {
  searchParams: Promise<{ intencion?: string; destino?: string; rol?: string }>;
}

export default async function PaginaRegistro({ searchParams }: PageProps) {
  const params = await searchParams;
  const intencion = params.intencion || (params.rol === "abogado" ? "abogado" : "");
  const destino = params.destino || (intencion === "abogado" ? "/panel/solicitud-socio" : "");

  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">tranqi</Link>
      <h1>Crea tu cuenta</h1>
      <FormularioRegistro negocio="tranqi" intencion={intencion} destino={destino} />
      <p className="enlace-auth">
        ¿Ya tienes cuenta? <Link href={`/ingresar${intencion ? `?intencion=${intencion}&destino=${encodeURIComponent(destino)}` : ""}`}>Ingresa aquí</Link>
      </p>
    </div>
  );
}
