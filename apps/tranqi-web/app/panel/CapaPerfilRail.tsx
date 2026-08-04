"use client";

import { useSearchParams } from "next/navigation";

const MAPA_CLASES_PERFIL: Record<string, string> = {
  cliente: "perfil-cliente",
  operador: "perfil-operador",
  abogado: "perfil-abogado",
  socio: "perfil-abogado",
  admin: "perfil-admin",
  administrador: "perfil-admin",
  superadmin: "perfil-superadmin"
};

export function CapaPerfilRail({
  claseBase,
  puedeConmutar,
  children,
}: {
  claseBase: string;
  puedeConmutar: boolean;
  children: React.ReactNode;
}) {
  const parametros = useSearchParams();
  const modo = parametros.get("modo")?.toLowerCase();

  const claseDinamica = modo ? (MAPA_CLASES_PERFIL[modo] || `perfil-${modo}`) : null;
  const clase = puedeConmutar && claseDinamica ? claseDinamica : claseBase;

  return <div className={`panel-layout ${clase}`}>{children}</div>;
}
