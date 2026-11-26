import type { Metadata } from "next";
import { obtenerPerfilActual } from "@eco/identidad";
import { FormularioPerfilAbogado } from "@eco/identidad/componentes/FormularioPerfilAbogado";
import { FormularioSolicitudSocio } from "../../../modulos/socios/componentes/FormularioSolicitudSocio";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = { title: "Perfil Profesional de Abogado — tranqi" };

export default async function PaginaPerfilAbogado() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return null;

  const [solicitudExistente, materias, provincias] = await Promise.all([
    obtenerSolicitudPropia(perfil.usu_id),
    listarMaterias(),
    listarProvincias(),
  ]);

  return (
    <div style={{ width: "100%", maxWidth: "840px", margin: "0 auto", padding: "10px 0 40px" }}>
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "24px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="tarjeta-proteccion-plan">
              Perfil profesional
            </div>
            <div className="tarjeta-proteccion-meta">
              Tu foto, formación, título SENESCYT, matrícula del Foro de Abogados, especialidades y provincias.
            </div>
          </div>
          <span className="badge-rol" style={{ background: "rgba(14, 102, 72, 0.12)", color: "var(--esmeralda, #0E6648)" }}>
            <Briefcase style={{ width: 14, height: 14, marginRight: 4 }} /> Socio Profesional
          </span>
        </div>
      </section>

      <div style={{ background: "#FFF", borderRadius: "14px", padding: "24px", border: "1px solid var(--linea)" }}>
        <FormularioPerfilAbogado
          inicial={{
            nombres: perfil.usu_nombres || "",
            apellidos: perfil.usu_apellidos || "",
            correo: perfil.usu_correo || "",
            whatsapp: perfil.usu_whatsapp || "",
            autorizaWhatsapp: Boolean(perfil.usu_autorizacion_whatsapp),
            mfaVerificadoInicial: false
          }}
        >
          <FormularioSolicitudSocio
            usuarioId={perfil.usu_id}
            materias={materias}
            provincias={provincias}
            correoInicial={perfil.usu_correo}
            solicitudExistente={solicitudExistente}
          />
        </FormularioPerfilAbogado>
      </div>
    </div>
  );
}
