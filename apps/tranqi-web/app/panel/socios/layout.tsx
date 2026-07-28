import { obtenerNivelAal } from "../../../modulos/mfa/consultas";
import { VerificacionMFA } from "../../../modulos/mfa/componentes/VerificacionMFA";

// Gate de toda la seccion Socios (lista, detalle, solicitudes, aceptar/
// rechazar): administradores de tranqi necesitan aal2 -- alcance decidido
// para este negocio unicamente, no los otros 3. Defensa en profundidad: el
// RLS y el RPC trq_fn_decidir_solicitud tambien lo exigen (ver migracion
// socios_mfa_y_documentos) -- este layout solo evita que alguien vea una
// pantalla vacia sin explicacion.
export default async function LayoutSocios({ children }: { children: React.ReactNode }) {
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
