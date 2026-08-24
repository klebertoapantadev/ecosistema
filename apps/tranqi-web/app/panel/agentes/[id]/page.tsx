import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarMcpDeAgente,
  listarServidoresMcp,
  obtenerAgente,
} from "../../../../modulos/agentes/consultas";
import { EditorAgente } from "./EditorAgente";

export const dynamic = "force-dynamic";

export default async function PaginaAgente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [agente, todosMcp, mcpDelAgente] = await Promise.all([
    obtenerAgente(id),
    listarServidoresMcp(),
    listarMcpDeAgente(id),
  ]);

  if (!agente.ok) {
    // ARIA responde 404 tanto si el agente no existe como si es de otro tenant
    // (assert_tenant_access usa 404 para no revelar existencia ajena). Aqui se
    // trata igual: no hay nada que mostrar.
    if (agente.motivo.includes("404") || /no encontrado/i.test(agente.motivo)) notFound();
    return (
      <>
        <h1>Agente</h1>
        <p className="agentes-aviso" role="status">
          No se pudo consultar ARIA: {agente.motivo}
        </p>
      </>
    );
  }

  const enganchados = mcpDelAgente.ok ? mcpDelAgente.datos.map((m) => m.id) : [];

  return (
    <>
      <p className="miga-agentes">
        <Link href="/panel/agentes">← Agentes</Link>
      </p>
      <h1>{agente.datos.name}</h1>
      <p>{agente.datos.description ?? "Sin descripción."}</p>

      <EditorAgente
        agente={agente.datos}
        servidoresMcp={todosMcp.ok ? todosMcp.datos : []}
        mcpEnganchados={enganchados}
      />
    </>
  );
}
