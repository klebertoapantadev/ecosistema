/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "@eco/identidad";
import { obtenerEstadoRegaloPrimeraCompraAction } from "@eco/comercio";

export const metadata: Metadata = { title: "Crear cuenta — tinkay" };

interface PageProps {
  searchParams: Promise<{
    destino?: string;
    next?: string;
    obsequio?: string;
    correo?: string;
    nombre?: string;
  }>;
}

export default async function PaginaRegistro({ searchParams }: PageProps) {
  const params = await searchParams;
  const destino = params.destino || params.next || "";
  const correoInicial = (params.correo || "").trim();
  const nombresIniciales = (params.nombre || "").trim();
  const vienePorObsequio =
    params.obsequio === "1" || destino.includes("obsequio=1");

  const infoRegalo = vienePorObsequio
    ? await obtenerEstadoRegaloPrimeraCompraAction("tinkay").catch(() => null)
    : null;

  return (
    <div className="pagina-auth">
      <Link href="/" className="logo-auth">
        tinkay
      </Link>
      <h1>Crea tu cuenta</h1>

      {vienePorObsequio && infoRegalo && (
        <div
          style={{
            width: "min(440px, 100%)",
            marginBottom: "16px",
            padding: "12px 14px",
            borderRadius: "14px",
            background: "#FDF2F8",
            border: "1px solid #FBCFE8",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textAlign: "left",
          }}
        >
          <img
            src={infoRegalo.regalo.imagenUrl}
            alt={infoRegalo.regalo.nombre}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "10px",
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid #F9A8D4",
            }}
          />
          <div style={{ fontSize: "0.8rem", lineHeight: 1.4, color: "#831843" }}>
            <strong style={{ display: "block", fontSize: "0.84rem" }}>
              🎁 Obsequio de bienvenida activado
            </strong>
            <span>
              Al completar tu registro volverás a tu pedido con{" "}
              <strong>1x {infoRegalo.regalo.nombre} ($0.00)</strong> incluido sin costo.
            </span>
          </div>
        </div>
      )}

      <FormularioRegistro
        negocio="tinkay"
        destino={destino}
        correoInicial={correoInicial}
        nombresIniciales={nombresIniciales}
      />
      <p className="enlace-auth">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={`/ingresar${
            destino ? `?destino=${encodeURIComponent(destino)}` : ""
          }`}
        >
          Ingresa aquí
        </Link>
      </p>
    </div>
  );
}
