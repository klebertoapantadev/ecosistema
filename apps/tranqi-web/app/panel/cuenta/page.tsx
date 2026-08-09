import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerHistorialAccesos } from "@eco/identidad";
import { obtenerPerfilesAsignables } from "@eco/gestion-usuarios";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { PanelCuentaModular } from "./PanelCuentaModular";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  const [perfilesAsignables, materias, provincias, solicitudExistente] = await Promise.all([
    obtenerPerfilesAsignables(),
    listarMaterias(),
    listarProvincias(),
    perfil ? obtenerSolicitudPropia(perfil.usu_id) : Promise.resolve(null),
  ]);

  // Garantizar que si el usuario es SuperAdmin de plataforma, SuperAdmin aparezca como opción elegible
  const rolesFinales = [...perfilesAsignables];
  if (perfil?.usu_superadmin_plataforma && !rolesFinales.some(r => r.clave === "SUPERADMIN")) {
    rolesFinales.push({ clave: "SUPERADMIN", nombre: "SuperAdmin de Plataforma", nivel: 100 });
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Componente Modular con Galería de Accesos, Hero Card condicional y Roles Dinámicos */}
      <PanelCuentaModular
        perfil={perfil}
        historial={historial}
        rolesDisponibles={rolesFinales}
        materias={materias}
        provincias={provincias}
        solicitudExistente={solicitudExistente}
      />
    </div>
  );
}
