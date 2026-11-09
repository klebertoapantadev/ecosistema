import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PaginaAgendar() {
  redirect("/panel/agendamiento?widget=agendar_cita");
}
