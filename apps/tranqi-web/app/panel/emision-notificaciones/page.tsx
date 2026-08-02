import type { Metadata } from "next";
import { EmisionNotificacionesWidget } from "@eco/notificaciones";

export const metadata: Metadata = { title: "Emisión Notificaciones — tranqi" };

export default function EmisionNotificacionesPage() {
  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <EmisionNotificacionesWidget negocio="tranqi" />
    </div>
  );
}
