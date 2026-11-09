import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PaginaMisCitas() {
  redirect("/panel/agendamiento?widget=mis_citas");
}
