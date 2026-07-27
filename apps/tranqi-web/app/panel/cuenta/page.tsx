import type { Metadata } from "next";
import { EliminarCuenta } from "@/modulos/identidad/componentes/EliminarCuenta";

export const metadata: Metadata = { title: "Mi cuenta — tranqi" };

export default function PaginaCuenta() {
  return (
    <div>
      <h1>Mi cuenta</h1>
      <EliminarCuenta />
    </div>
  );
}
