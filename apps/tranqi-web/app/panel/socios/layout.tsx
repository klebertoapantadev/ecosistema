import { obtenerPerfiles, obtenerNivelMaximo } from "@eco/identidad";
import { obtenerNivelAal } from "../../../modulos/mfa/consultas";
import { VerificacionMFA } from "../../../modulos/mfa/componentes/VerificacionMFA";

// Gate de toda la seccion Socios (lista, detalle, solicitudes, aceptar/rechazar).
// REGLA PLT-002: SuperAdmin y Administradores Plataforma NUNCA requieren MFA (bypass directo).
export default async function LayoutSocios({ children }: { children: React.ReactNode }) {
  const perfiles = await obtenerPerfiles("TRANQ");
  const nivelMaximo = await obtenerNivelMaximo("TRANQ");
  const esExento = perfiles.some(p => {
    const u = p.toUpperCase();
    return u === "SUPERADMIN" || u === "ADMINISTRADOR";
  }) || nivelMaximo >= 80;

  if (esExento) {
    return <>{children}</>;
  }

  const { currentLevel, nextLevel } = await obtenerNivelAal();

  if (currentLevel !== "aal2") {
    return (
      <div className="pagina-mfa">
        <h1>Verificación en dos pasos requerida</h1>
        <p>Para acceder a Socios y Solicitudes, los administradores de tranqi deben verificar su identidad con un segundo factor.</p>
        <VerificacionMFA necesitaInscripcion={nextLevel !== "aal2"} />
      </div>
    );
  }

  return <>{children}</>;
}
