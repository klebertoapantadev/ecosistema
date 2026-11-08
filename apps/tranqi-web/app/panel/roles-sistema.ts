export interface RolOpcionDef {
  clave: string;
  nombre: string;
  nivel?: number;
}

export type ModoRol = string;

export const ROLES_DEFAULT: RolOpcionDef[] = [
  { clave: "CLIENTE", nombre: "Cliente", nivel: 1 },
  { clave: "OPERADOR", nombre: "Operador / Auxiliar", nivel: 30 },
  { clave: "ABOGADO", nombre: "Socio Abogado", nivel: 50 },
  { clave: "ADMINISTRADOR", nombre: "Administrador del Negocio", nivel: 80 },
  { clave: "SUPERADMIN", nombre: "SuperAdmin de Plataforma", nivel: 100 }
];
