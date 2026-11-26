"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, Flower2, X } from "lucide-react";
import {
  verificarYAlertarInventarioRosasAction,
  type ResultadoAlertaInventarioRosas,
} from "../acciones-operaciones-taller";

export interface PropsAlertaInventarioRosasBanner {
  negocio: string;
  horasLimite?: number;
}

function formatearHorasTranscurridas(horas: number | null): string {
  if (horas === null || !Number.isFinite(horas)) return "sin registro";
  if (horas >= 48) {
    const dias = Math.floor(horas / 24);
    const restoH = Math.round(horas % 24);
    return restoH > 0 ? `hace ${dias}d ${restoH}h` : `hace ${dias}d`;
  }
  return `hace ${Math.round(horas)}h`;
}

export function AlertaInventarioRosasBanner({
  negocio,
  horasLimite = 15,
}: PropsAlertaInventarioRosasBanner) {
  const pathname = usePathname();
  const negNorm = negocio.trim().toLowerCase();
  const [estado, setEstado] = useState<ResultadoAlertaInventarioRosas | null>(null);
  const [ocultoSesion, setOcultoSesion] = useState(false);

  const verificar = useCallback(async () => {
    try {
      const res = await verificarYAlertarInventarioRosasAction(negNorm, {
        horasLimite,
        cooldownHoras: 6,
      });
      if (res.ok) {
        setEstado(res);
        if (res.alertaEmitida && typeof window !== "undefined") {
          window.dispatchEvent(new Event("eco:refrescar-notificaciones"));
        }
      }
    } catch {
      // No interrumpir navegación del panel
    }
  }, [negNorm, horasLimite]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem(`eco_alerta_inv_oculta_${negNorm}`) === "1") {
          setOcultoSesion(true);
        }
      } catch {
        // Ignorar
      }
    }

    void verificar();
    const intervalo = window.setInterval(() => {
      void verificar();
    }, 15 * 60 * 1000);

    const alActualizarInventario = () => {
      setEstado((prev) => (prev ? { ...prev, requiereAlerta: false } : null));
      void verificar();
    };
    window.addEventListener("eco:inventario-rosas-actualizado", alActualizarInventario);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("eco:inventario-rosas-actualizado", alActualizarInventario);
    };
  }, [negNorm, verificar]);

  // En /panel/inventario-rosas la propia consola ya muestra su alerta dedicada
  const estaEnPaginaInventario = pathname?.startsWith("/panel/inventario-rosas");
  if (!estado?.requiereAlerta || ocultoSesion || estaEnPaginaInventario) {
    return null;
  }

  return (
    <div
      role="alert"
      style={{
        margin: "0 0 14px 0",
        padding: "11px 14px",
        borderRadius: "12px",
        background: "#FFFBEB",
        border: "1.5px solid #F59E0B",
        color: "#78350F",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
        boxSizing: "border-box",
        maxWidth: "100%",
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(217, 119, 6, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          flex: "1 1 200px",
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "9px",
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#B45309",
            flexShrink: 0,
            marginTop: "1px",
          }}
        >
          <AlertTriangle size={16} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            flex: 1,
            minWidth: 0,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.84rem", color: "#92400E" }}>
              Inventario de rosas pendiente
            </strong>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "1.5px 8px",
                borderRadius: "999px",
                background: "#FEF3C7",
                border: "1px solid #F59E0B",
                color: "#92400E",
                fontSize: "0.69rem",
                fontWeight: 700,
              }}
            >
              <Clock size={11} />
              <span>
                {formatearHorasTranscurridas(estado.horasDesdeUltimoCorte)} · límite {estado.horasLimite}h
              </span>
            </span>
          </div>
          <span style={{ fontSize: "0.76rem", color: "#78350F", lineHeight: 1.4 }}>
            No se ha registrado un inventario de rosas en las últimas {estado.horasLimite} horas.
            Realízalo para contar con los colores disponibles actualizados en la tienda.
          </span>
        </div>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
        <Link
          href="/panel/inventario-rosas"
          title="Ir a Inventario de Rosas para actualizar colores disponibles"
          aria-label="Hacer inventario"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 13px",
            borderRadius: "9px",
            background: "#B45309",
            color: "#FFFFFF",
            fontSize: "0.77rem",
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <Flower2 size={14} />
          <span>Hacer inventario</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            setOcultoSesion(true);
            try {
              window.sessionStorage.setItem(`eco_alerta_inv_oculta_${negNorm}`, "1");
            } catch {
              // Ignorar
            }
          }}
          title="Ocultar aviso durante esta sesión"
          aria-label="Ocultar aviso"
          style={{
            border: "1px solid #FCD34D",
            background: "#FFFFFF",
            color: "#92400E",
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
