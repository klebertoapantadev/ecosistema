import type { Metadata } from "next";
import { obtenerSmtpNegocio, FormularioSmtp } from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Servidor de correo — tinkay" };

const NEGOCIO = "tinkay";

// Widget `configuracion_correo` (PLT-008 regla 6). Pantalla propia y no una
// seccion de Configuracion del negocio porque su permiso es distinto: solo
// SUPERADMIN de plataforma. Quien controla el SMTP puede enviar correo en
// nombre del negocio, y eso no se equipara a editar la razon social.
// Lo que de verdad cierra la puerta no es esta ruta sino la politica
// cfg_smtp_superadmin_lectura y el chequeo dentro de cfg_fn_guardar_smtp.
export default async function PaginaServidorCorreo() {
  const smtp = await obtenerSmtpNegocio(NEGOCIO);

  return (
    <div>
      <h1>Servidor de correo</h1>
      <p className="texto-apoyo">
        Desde aquí sale el correo de este negocio: códigos de verificación y enlaces para restablecer la
        contraseña. Mientras no lo actives, esos correos no se envían.
      </p>
      <FormularioSmtp inicial={smtp} negocio={NEGOCIO} />
    </div>
  );
}
