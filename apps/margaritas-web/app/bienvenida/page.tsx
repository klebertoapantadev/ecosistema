import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, FormularioBienvenida } from "@eco/identidad";

export const metadata: Metadata = { title: "Hola — Margaritas Floristería" };

interface PageProps {
  searchParams: Promise<{ destino?: string }>;
}

export default async function PaginaBienvenida({ searchParams }: PageProps) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");

  const params = await searchParams;
  const cookieStore = await cookies();
  const destinoCookie = cookieStore.get("tranqi_destino")?.value;
  const destinoDecodificado = destinoCookie ? decodeURIComponent(destinoCookie) : "";
  const destinoCandidato = params.destino || destinoDecodificado || "/panel";
  const destinoFinal =
    destinoCandidato.startsWith("/") && !destinoCandidato.startsWith("//")
      ? destinoCandidato
      : "/panel";

  if (perfil.usu_onboarding_completo) redirect(destinoFinal);

  return (
    <div className="pagina-bienvenida">
      <div className="tarjeta-bienvenida">
        <div className="saludo-bienvenida">hola,</div>
        <p>
          Antes de empezar, confirma cómo quieres que te llamemos y tu número de WhatsApp para recibir cotizaciones o notificaciones.
        </p>
        <FormularioBienvenida
          nombresIniciales={perfil.usu_nombres ?? ""}
          apellidosIniciales={perfil.usu_apellidos ?? ""}
          destinoFinal={destinoFinal}
        />
      </div>
    </div>
  );
}
