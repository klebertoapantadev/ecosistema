import React from "react";
import Link from "next/link";
import {
  obtenerConfiguracionTiendaCheckoutAction,
  obtenerPasarelasCheckoutAction,
  obtenerProformaPorTokenAction,
  VistaLinkPagoCliente,
} from "@eco/comercio";

export const dynamic = "force-dynamic";

export default async function PaginaLinkPagoTinkay({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [resProforma, resPasarelas, configCheckout] = await Promise.all([
    obtenerProformaPorTokenAction(token),
    obtenerPasarelasCheckoutAction("tinkay"),
    obtenerConfiguracionTiendaCheckoutAction("tinkay").catch(() => null),
  ]);

  if (!resProforma.ok) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#FAF8F5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            padding: "28px",
            borderRadius: "16px",
            background: "#FFFFFF",
            border: "1px solid #E7E5E4",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#1C1917" }}>
            Link de pago no disponible
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: "0.9rem", color: "#57534E", lineHeight: 1.5 }}>
            {resProforma.error ||
              "El enlace puede haber expirado o no existir. Solicita un nuevo enlace a tu asesor."}
          </p>
          <Link
            href="/"
            title="Volver al catálogo de Tinkay"
            aria-label="Ir a la Tienda"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: "999px",
              background: "#2D4734",
              color: "#FFFFFF",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.88rem",
            }}
          >
            Ir a la Tienda
          </Link>
        </div>
      </main>
    );
  }

  const pasarelaPlux = resPasarelas.ok
    ? resPasarelas.data.find((p) => p.pasarela === "PLUX")
    : undefined;
  const tarjetaHabilitada = Boolean(pasarelaPlux);
  const ambientePlux = pasarelaPlux?.ambiente || "PRUEBAS";

  return (
    <VistaLinkPagoCliente
      proformaInicial={resProforma.proforma}
      ambientePlux={ambientePlux}
      tarjetaHabilitada={tarjetaHabilitada}
      configCheckoutInicial={configCheckout}
    />
  );
}
