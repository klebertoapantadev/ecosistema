import type { Metadata } from "next";
import {
  obtenerConfiguracionNegocio,
  obtenerSmtpNegocio,
  FormularioConfiguracionNegocio,
  FormularioSmtp,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Configuración del negocio — FastFix Home" };

const NEGOCIO = "fastfix";

export default async function PaginaConfiguracionNegocio() {
  const [configuracion, smtp] = await Promise.all([obtenerConfiguracionNegocio(NEGOCIO), obtenerSmtpNegocio(NEGOCIO)]);

  return (
    <div>
      <h1>Configuración del negocio</h1>
      <FormularioConfiguracionNegocio inicial={configuracion} negocio={NEGOCIO} />

      {/* PLT-008: servidor SMTP propio del negocio. Seccion aparte y no campos
          sueltos del formulario de arriba porque se guarda por otra via -- la
          contrasena va a Vault, no a cfg_negocio (ver ADR-0005). */}
      <section className="seccion-panel">
        <h2>Servidor de correo (SMTP)</h2>
        <p className="texto-apoyo">
          Desde aquí sale el correo de este negocio: códigos de verificación y enlaces para restablecer la
          contraseña. Mientras no lo actives, esos correos no se envían.
        </p>
        <FormularioSmtp inicial={smtp} negocio={NEGOCIO} />
      </section>
    </div>
  );
}
