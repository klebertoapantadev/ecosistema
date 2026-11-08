import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerHistorialAccesos, obtenerPerfiles } from "@eco/identidad";
import { obtenerPerfilesAsignables } from "@eco/gestion-usuarios";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { PanelCuentaModular } from "./PanelCuentaModular";
import type { RolOpcionDef } from "../roles-sistema";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default async function PaginaCuenta() {
  const perfil = await obtenerPerfilActual();
  const supabase = await crearClienteServidor();
  const adminClient = (crearClienteAdmin() || supabase) as any;
  const historial = perfil ? await obtenerHistorialAccesos(supabase, perfil.usu_id) : [];

  const [perfilesAsignables, perfilesUsuario, materias, provincias, solicitudExistente] = await Promise.all([
    obtenerPerfilesAsignables(),
    obtenerPerfiles("tranqi"),
    listarMaterias(),
    listarProvincias(),
    perfil ? obtenerSolicitudPropia(perfil.usu_id) : Promise.resolve(null),
  ]);

  let regAbogado: { abg_id: string; abg_estado: string } | null = null;
  if (perfil?.usu_id) {
    const { data } = await adminClient
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_estado")
      .eq("abg_usuario_id", perfil.usu_id)
      .maybeSingle();
    regAbogado = data;
  }

  let perfilesEfectivos = [...(perfilesUsuario || [])];
  if (regAbogado?.abg_estado === "verificado" && !perfilesEfectivos.some((p) => p.toUpperCase() === "ABOGADO")) {
    perfilesEfectivos.push("ABOGADO");
  } else if (regAbogado?.abg_estado === "suspendido") {
    perfilesEfectivos = perfilesEfectivos.filter((p) => p.toUpperCase() !== "ABOGADO");
  }

  // Si el usuario es SuperAdmin de plataforma, puede conmutar entre todos los roles del sistema + SuperAdmin
  let rolesFinales: RolOpcionDef[] = [];
  if (perfil?.usu_superadmin_plataforma) {
    rolesFinales = [...perfilesAsignables];
    if (!rolesFinales.some(r => r.clave === "SUPERADMIN")) {
      rolesFinales.push({ clave: "SUPERADMIN", nombre: "SuperAdmin de Plataforma", nivel: 100 });
    }
  } else {
    // Para usuarios estándar, presentar únicamente los perfiles que tienen asignados en el negocio
    const setPerfiles = new Set(perfilesEfectivos.map(p => p.toUpperCase()));
    setPerfiles.add("CLIENTE");
    rolesFinales = perfilesAsignables.filter(p => setPerfiles.has(p.clave.toUpperCase()));
    if (rolesFinales.length === 0) {
      rolesFinales = [{ clave: "CLIENTE", nombre: "Cliente", nivel: 1 }];
    }
  }

  const puedeConmutar = Boolean(perfil?.usu_superadmin_plataforma || rolesFinales.length > 1);

  return (
    <div style={{ width: "100%" }}>
      {/* Componente Modular con Galería de Accesos, Hero Card condicional y Roles Dinámicos */}
      <PanelCuentaModular
        perfil={perfil}
        historial={historial}
        puedeConmutar={puedeConmutar}
        rolesDisponibles={rolesFinales}
        materias={materias}
        provincias={provincias}
        solicitudExistente={solicitudExistente}
      />
    </div>
  );
}
