"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "@eco/identidad";

// Compartido entre el rail (layout.tsx) y /panel/cuenta -- el logout real
// vive en "Mi cuenta" (TRQ-001 correccion de UX), el rail ya no lo expone.
export async function cerrarSesionYRedirigir() {
  await cerrarSesion();
  redirect("/");
}
