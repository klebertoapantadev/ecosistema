import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, FormularioBienvenida } from "@eco/identidad";

export const metadata: Metadata = { title: "Bienvenida — tranqi" };

interface PageProps {
  searchParams: Promise<{ intencion?: string; destino?: string }>;
}

export default async function PaginaBienvenida({ searchParams }: PageProps) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");

  const resolvedParams = await searchParams;
  const cookieStore = await cookies();

  const intencionCookie = cookieStore.get("tranqi_intencion")?.value;
  const destinoCookie = cookieStore.get("tranqi_destino")?.value;

  const intencion = resolvedParams.intencion || intencionCookie || "";
  const destino = resolvedParams.destino || destinoCookie || "";

  const esAbogado = intencion === "abogado" || destino.includes("solicitud-socio");
  const destinoFinal = destino || (esAbogado ? "/panel/solicitud-socio" : "/panel");

  if (perfil.usu_onboarding_completo) {
    redirect(destinoFinal);
  }

  return (
    <div className="pagina-bienvenida">
      <div className="tarjeta-bienvenida">
        {esAbogado ? (
          <>
            <div style={{ background: "rgba(80,0,186,0.1)", border: "1px solid rgba(80,0,186,0.25)", color: "#5000BA", borderRadius: "8px", padding: "6px 12px", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px", display: "inline-block" }}>
              ⚖️ Incorporación al Equipo Jurídico
            </div>
            <div className="saludo-bienvenida">¡Bienvenido(a), Doctor(a)!</div>
            <p style={{ marginTop: "8px", marginBottom: "16px", fontSize: "0.88rem", color: "#555" }}>
              Estás a un paso de completar tu solicitud para unirte a la <strong>Red de Abogados Verificados de tranqi</strong>. Confirma tus nombres y apellidos completos tal como constan en tu matrícula profesional / SENESCYT.
            </p>
          </>
        ) : (
          <>
            <div className="saludo-bienvenida">hola,</div>
            <p>
              Antes de empezar, confirma cómo quieres que te llamemos — a veces tu cuenta de Google no lo deja del
              todo claro.
            </p>
          </>
        )}

        <FormularioBienvenida
          nombresIniciales={perfil.usu_nombres ?? ""}
          apellidosIniciales={perfil.usu_apellidos ?? ""}
          intencion={intencion}
          destinoFinal={destinoFinal}
        />
      </div>
    </div>
  );
}
