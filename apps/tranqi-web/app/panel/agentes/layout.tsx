import { obtenerNivelAal } from "../../../modulos/mfa/consultas";
import { VerificacionMFA } from "../../../modulos/mfa/componentes/VerificacionMFA";

// Gate de la consola de agentes, mismo criterio que Socios.
//
// El motivo aqui no es que se vean datos sensibles, es que se ESCRIBE el
// comportamiento del producto: el prompt de un agente es lo que se le dice a
// todos los afiliados que abren el chat. Quien lo edita debe haber probado un
// segundo factor en esta sesion.
//
// Este layout solo evita la pantalla vacia sin explicacion. La comprobacion que
// de verdad manda esta en app/api/aria/[...ruta]/route.ts, que vuelve a exigir
// aal2 antes de reenviar nada -- un layout no protege una API.
export default async function LayoutAgentes({ children }: { children: React.ReactNode }) {
  const { currentLevel, nextLevel } = await obtenerNivelAal();

  if (currentLevel !== "aal2") {
    return (
      <div className="pagina-mfa">
        <h1>Verificación en dos pasos requerida</h1>
        <p>
          Configurar los agentes cambia lo que el asistente le responde a los afiliados. Para
          entrar hace falta verificar tu identidad con un segundo factor.
        </p>
        <VerificacionMFA necesitaInscripcion={nextLevel !== "aal2"} />
      </div>
    );
  }

  return <>{children}</>;
}
