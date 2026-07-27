import type { Metadata } from "next";
import Link from "next/link";
import { TERMINOS_VERSION } from "@eco/identidad";

export const metadata: Metadata = { title: "Términos de Servicio — tinkay" };

// PLT-001 regla 6: texto de consentimiento que el registro enlaza y cuya
// versión (TERMINOS_VERSION) se guarda por usuario en usu_terminos_version.
// BORRADOR: contenido de referencia para habilitar el flujo de registro,
// no reemplaza una revisión legal formal antes de operar con clientes reales.
// Correo/dominio de contacto sin decidir todavia -- placeholder explicito.
export default function PaginaTerminos() {
  return (
    <div className="pagina-legal">
      <Link href="/" className="logo-auth">
        tinkay
      </Link>

      <div className="aviso-borrador">
        Documento en borrador (versión {TERMINOS_VERSION}) — pendiente de revisión por un profesional legal antes
        de considerarse vinculante en firme.
      </div>

      <h1>Términos de Servicio y Política de Privacidad</h1>
      <p className="fecha-legal">Última actualización: 27 de julio de 2026</p>

      <div className="seccion-legal">
        <h2>1. Qué es tinkay</h2>
        <p>
          tinkay es una floristería que ofrece productos y servicios de entrega. Al crear una cuenta, aceptas
          estos Términos y nuestra Política de Privacidad.
        </p>
      </div>

      <div className="seccion-legal">
        <h2>2. Datos que recogemos</h2>
        <p>Al registrarte (por correo o con Google) guardamos:</p>
        <ul>
          <li>Nombres y apellidos que nos proporcionas o confirmas.</li>
          <li>Correo electrónico.</li>
          <li>Número de WhatsApp, únicamente si autorizas explícitamente que te contactemos por ese medio.</li>
          <li>Fecha y versión de aceptación de estos Términos.</li>
        </ul>
      </div>

      <div className="seccion-legal">
        <h2>3. Cómo eliminar tu cuenta</h2>
        <p>
          Puedes solicitar la eliminación de tu cuenta y tus datos personales en cualquier momento desde tu panel
          (sección &ldquo;Eliminar mi cuenta&rdquo;). Si no tienes historial de compras o transacciones asociado,
          tu cuenta y datos se eliminan de forma permanente e inmediata.
        </p>
        <p>
          Si ya realizaste una compra o transacción, la ley nos exige conservar los registros contables y
          tributarios asociados durante el plazo legal correspondiente. En ese caso, anonimizamos tus datos
          personales y conservamos únicamente lo necesario para cumplir esa obligación legal.
        </p>
      </div>

      <div className="seccion-legal">
        <h2>4. Contacto</h2>
        <p>Para preguntas sobre estos Términos o el tratamiento de tus datos: [correo de contacto pendiente].</p>
      </div>
    </div>
  );
}
