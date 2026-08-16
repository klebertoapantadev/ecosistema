import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerHistorialAccesos, obtenerPerfiles } from "@eco/identidad";
import { obtenerPerfilesAsignables } from "@eco/gestion-usuarios";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { PanelCuentaModular } from "./PanelCuentaModular";
import type { RolOpcionDef } from "../SelectorRolActivo";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  const [perfilesAsignables, perfilesUsuario, materias, provincias, solicitudExistente] = await Promise.all([
    obtenerPerfilesAsignables(),
    obtenerPerfiles("TRANQ"),
    listarMaterias(),
    listarProvincias(),
    perfil ? obtenerSolicitudPropia(perfil.usu_id) : Promise.resolve(null),
  ]);

  // Si el usuario es SuperAdmin de plataforma, puede conmutar entre todos los roles del sistema + SuperAdmin
  let rolesFinales: RolOpcionDef[] = [];
  if (perfil?.usu_superadmin_plataforma) {
    rolesFinales = [...perfilesAsignables];
    if (!rolesFinales.some(r => r.clave === "SUPERADMIN")) {
      rolesFinales.push({ clave: "SUPERADMIN", nombre: "SuperAdmin de Plataforma", nivel: 100 });
    }
  } else {
    // Para usuarios estándar, presentar los perfiles que tienen asignados en el negocio
    const setPerfiles = new Set((perfilesUsuario || []).map(p => p.toUpperCase()));
    setPerfiles.add("CLIENTE");
    rolesFinales = perfilesAsignables.filter(p => setPerfiles.has(p.clave.toUpperCase()));
    if (rolesFinales.length === 0) {
      rolesFinales = [{ clave: "CLIENTE", nombre: "Cliente", nivel: 1 }];
    }
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
