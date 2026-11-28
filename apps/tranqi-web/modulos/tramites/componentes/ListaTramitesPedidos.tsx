import { FileCheck2 } from "lucide-react";
import type { TramitePedido } from "../esquema";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
});

function formatearUSD(monto: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(monto);
}

/** Trámites pagados por el cliente (TRQ-043). Sin seguimiento por pasos: aún no hay tabla de trámites. */
export default function ListaTramitesPedidos({ tramites }: { tramites: TramitePedido[] }) {
  if (tramites.length === 0) return null;
  return (
    <ul className="lista-tramites-pedidos">
      {tramites.map((t) => (
        <li key={t.id}>
          <span className="tramite-pedido-icono" aria-hidden="true">
            <FileCheck2 size={19} />
          </span>
          <span className="tramite-pedido-texto">
            <b>{t.nombre}</b>
            <span>
              Pedido el {FORMATO_FECHA.format(new Date(t.pedidoEn))}
              {t.tiempoEntrega ? ` · listo en ${t.tiempoEntrega}` : ""}
            </span>
          </span>
          <span className="tramite-pedido-monto">{formatearUSD(t.montoTotal)}</span>
        </li>
      ))}
    </ul>
  );
}
