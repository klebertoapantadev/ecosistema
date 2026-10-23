import { NextResponse } from "next/server";
import { obtenerPlanesDestacadosLandingTranqiAction } from "@eco/comercio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await obtenerPlanesDestacadosLandingTranqiAction();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al obtener planes destacados";
    return NextResponse.json({
      ok: false,
      error: errorMsg,
      familiar: {
        categoria: "familiar",
        categoriaNombre: "Planes Familiares",
        productoId: "prod-trq-plan-proteccion",
        nombre: "Planes de Protección Jurídica Continua",
        descripcion: "Membresías de cobertura legal preventiva para personas naturales y familias.",
        precioDesde: 23,
        precioDesdeTexto: "23.00",
        destacado: true,
      },
      corporativo: {
        categoria: "corporativo",
        categoriaNombre: "Planes Corporativos",
        productoId: "prod-trq-plan-corporativo",
        nombre: "Cobertura Legal Corporativa Empresas (B2B)",
        descripcion: "Licenciamiento legal por tramos de empleados con abogado empresarial dedicado.",
        precioDesde: 10.35,
        precioDesdeTexto: "10.35",
        destacado: true,
      },
    });
  }
}
