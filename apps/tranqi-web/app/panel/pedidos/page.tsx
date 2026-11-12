import { redirect } from "next/navigation";

export default function PaginaPedidosTiendaRedirect() {
  redirect("/panel/administrar?widget=pedidos_tienda");
}

