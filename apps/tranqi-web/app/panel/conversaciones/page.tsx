import { redirect } from "next/navigation";

export default function PaginaConversacionesOmnicanalRedirect() {
  redirect("/panel/administrar?widget=consola_chat");
}
