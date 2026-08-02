import type { Metadata } from "next";
import { PreferenciasNotificacionWidget } from "@eco/notificaciones";

export const metadata: Metadata = { title: "Mis Notificaciones & Preferencias — tranqi" };

export default function PreferenciasNotificacionesPage() {
  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <PreferenciasNotificacionWidget negocio="tranqi" />
    </div>
  );
}
