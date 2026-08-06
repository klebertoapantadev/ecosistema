import type { Metadata } from "next";
import { obtenerPerfilActual } from "@eco/identidad";
import { FormularioPerfilAbogado } from "@eco/identidad/componentes/FormularioPerfilAbogado";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = { title: "Perfil Profesional de Abogado — tranqi" };

export default async function PaginaPerfilAbogado() {
  const perfil = await obtenerPerfilActual();

  return (
    <div style={{ width: "100%", maxWidth: "840px", margin: "0 auto", padding: "10px 0 40px" }}>
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "24px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Red de Abogados Verificados (PLT-002 / TRQ-001)</div>
            <div className="tarjeta-proteccion-plan">
              Perfil Profesional & Acreditación Legal — <i>tranqi</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Visualiza y actualiza tus datos de registro inicial, título SENESCYT, matrícula del Foro de Abogados y especialidades.
            </div>
          </div>
          <span className="badge-rol" style={{ background: "rgba(5, 135, 110, 0.12)", color: "var(--esmeralda, #05876e)" }}>
            <Briefcase style={{ width: 14, height: 14, marginRight: 4 }} /> Socio Profesional
          </span>
        </div>
      </section>

      <div style={{ background: "#FFF", borderRadius: "14px", padding: "24px", border: "1px solid #E4E4E4" }}>
        <FormularioPerfilAbogado
          inicial={{
            nombres: perfil?.usu_nombres || "",
            apellidos: perfil?.usu_apellidos || "",
            correo: perfil?.usu_correo || "",
            whatsapp: perfil?.usu_whatsapp || "",
            autorizaWhatsapp: Boolean(perfil?.usu_autorizacion_whatsapp),
            tituloSenescyt: "Abogado de los Tribunales de la República",
            matriculaForo: "",
            anosExperiencia: 5,
            detalles: "",
            mfaVerificadoInicial: false
          }}
        />
      </div>
    </div>
  );
}
