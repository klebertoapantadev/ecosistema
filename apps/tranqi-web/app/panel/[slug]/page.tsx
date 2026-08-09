import { redirect } from "next/navigation";
import { obtenerPerfilActual } from "@eco/identidad";
import { PanelDinamicoModular } from "./PanelDinamicoModular";

const NEGOCIO = "TRANQ";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PaginaPanelDinamico({ params }: Props) {
  const { slug } = await params;
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect(`/ingresar?redirect=/panel/${slug}`);
  }

  // Prevenir colisión con rutas estáticas existentes
  if (slug === "administrar" || slug === "configuracion" || slug === "cuenta" || slug === "auditoria") {
    redirect(`/panel/${slug}`);
  }

  return <PanelDinamicoModular slug={slug} negocio={NEGOCIO} />;
}
