import type { Metadata } from "next";
import Link from "next/link";
import { FormularioIngreso } from "@eco/identidad";

export const metadata: Metadata = { title: "Ingresar — tranqi" };

interface PageProps {
  searchParams: Promise<{ intencion?: string; destino?: string; rol?: string }>;
}

export default async function PaginaIngreso({ searchParams }: PageProps) {
  const params = await searchParams;
  const intencion = params.intencion || (params.rol === "abogado" ? "abogado" : "");
  const destino = params.destino || (intencion === "abogado" ? "/panel/solicitud-socio" : "");

  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">tranqi</Link>
      <h1>Ingresa a tu cuenta</h1>
      <FormularioIngreso negocio="tranqi" intencion={intencion} destino={destino} />
      <p className="enlace-auth">
        ¿No tienes cuenta? <Link href={`/registro${intencion ? `?intencion=${intencion}&destino=${encodeURIComponent(destino)}` : ""}`}>Regístrate aquí</Link>
      </p>
    </div>
  );
}
