import type { Metadata } from "next";
import Link from "next/link";
import { TERMINOS_VERSION } from "@/modulos/identidad/esquema";

export const metadata: Metadata = { title: "Términos de Servicio — tranqi" };

// PLT-001 regla 6: texto de consentimiento que el registro enlaza y cuya
// versión (TERMINOS_VERSION) se guarda por usuario en usu_terminos_version.
// BORRADOR: contenido de referencia para habilitar el flujo de registro,
// no reemplaza una revisión legal formal antes de operar con clientes reales.
export default function PaginaTerminos() {
  return (
    <div className="pagina-legal">
      <Link href="/" className="logo-auth">
        tranqi
      </Link>

      <div className="aviso-borrador">
        Documento en borrador (versión {TERMINOS_VERSION}) — pendiente de revisión por un profesional legal antes
        de considerarse vinculante en firme.
      </div>

      <h1>Términos de Servicio y Política de Privacidad</h1>
      <p className="fecha-legal">Última actualización: 27 de julio de 2026</p>

      <section>
        <h2>1. Qué es tranqi</h2>
        <p>
          tranqi es una plataforma que conecta personas con abogados independientes para resolver consultas y
          gestionar trámites legales. Al crear una cuenta, aceptas estos Términos y nuestra Política de
          Privacidad.
        </p>
      </section>

      <section>
        <h2>2. Datos que recogemos</h2>
        <p>Al registrarte (por correo o con Google) guardamos:</p>
        <ul>
          <li>Nombres y apellidos que nos proporcionas o confirmas.</li>
          <li>Correo electrónico.</li>
          <li>Número de WhatsApp, únicamente si autorizas explícitamente que te contactemos por ese medio.</li>
          <li>Fecha y versión de aceptación de estos Términos.</li>
        </ul>
        <p>
          Usamos estos datos para identificarte, darte acceso a la plataforma y, si lo autorizaste, contactarte
          por WhatsApp sobre tu consulta o trámite.
        </p>
      </section>

      <section>
        <h2>3. Cómo eliminar tu cuenta</h2>
        <p>
          Puedes solicitar la eliminación de tu cuenta y tus datos personales en cualquier momento desde tu panel
          (sección &ldquo;Eliminar mi cuenta&rdquo;). Si no tienes historial de compras o transacciones asociado,
          tu cuenta y datos se eliminan de forma permanente e inmediata.
        </p>
        <p>
          Si ya realizaste una compra o transacción, la ley nos exige conservar los registros contables y
          tributarios asociados durante el plazo legal correspondiente. En ese caso, anonimizamos tus datos
          personales (nombre, correo, WhatsApp) y conservamos únicamente lo necesario para cumplir esa
          obligación legal, sin que quede vinculado a tu identidad.
        </p>
      </section>

      <section>
        <h2>4. Contacto</h2>
        <p>
          Para preguntas sobre estos Términos o el tratamiento de tus datos, escríbenos a{" "}
          <a href="mailto:hola@tranqi24.com">hola@tranqi24.com</a>.
        </p>
      </section>
    </div>
  );
}
