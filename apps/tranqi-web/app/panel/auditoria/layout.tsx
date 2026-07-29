import { obtenerNivelAal } from "../../../modulos/mfa/consultas";
import { VerificacionMFA } from "../../../modulos/mfa/componentes/VerificacionMFA";

// Mismo gate que /panel/socios (ver ese layout.tsx) -- Auditoria vivia ahi
// adentro y heredaba esta proteccion; al moverla a top-level (TRQ-001
// correccion de UX) hay que replicarla explicitamente o el aal2 deja de
// exigirse para esta ruta. Defensa en profundidad: la politica RLS nueva
// (aud_registro_administrador_tranqi_select) exige rol, no aal2 -- este
// layout es lo que evita ver la pantalla sin el segundo factor.
export default async function LayoutAuditoria({ children }: { children: React.ReactNode }) {
  const { currentLevel, nextLevel } = await obtenerNivelAal();

  if (currentLevel !== "aal2") {
    return (
      <div className="pagina-mfa">
        <h1>Verificación en dos pasos requerida</h1>
        <p>Para acceder a Auditoría, los administradores de tranqi deben verificar su identidad con un segundo factor.</p>
        <VerificacionMFA necesitaInscripcion={nextLevel !== "aal2"} />
      </div>
    );
  }

  return <>{children}</>;
}
