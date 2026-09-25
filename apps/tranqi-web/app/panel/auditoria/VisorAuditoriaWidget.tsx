"use client";

import React, { useState, useEffect, useCallback } from "react";
import { obtenerAuditoriaAction } from "@eco/auditoria/acciones";
import type { RegistroAuditoria } from "@eco/auditoria";
import { TablaAuditoria } from "./TablaAuditoria";
import { Shield, RefreshCw } from "lucide-react";

interface Props {
  negocio?: string;
  esquemaNegocio?: string;
}

export function VisorAuditoriaWidget({ negocio = "tranqi", esquemaNegocio = "tranqui_legal" }: Props) {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await obtenerAuditoriaAction(negocio, esquemaNegocio);
      if (res.ok && res.data) {
        setRegistros(res.data);
      } else {
        setError(res.error || "No se pudieron cargar los registros de auditoría.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al consultar auditoría";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [negocio, esquemaNegocio]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  return (
    <div style={{ width: "100%", background: "#ffffff", borderRadius: "16px", border: "1px solid var(--linea)", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--fondo-hundido)", paddingBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0, color: "var(--texto)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={22} color="#5000BA" /> Auditoría BDD & Telemetría Inmutable ({negocio})
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--texto-suave)", margin: "3px 0 0 0" }}>
            Registro inmutable auditado por disparadores PostgreSQL (<code>{esquemaNegocio}</code> y <code>comun_seguridad</code>).
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDatos}
          style={{
            background: "var(--fondo-hundido)",
            border: "1px solid var(--linea-fuerte)",
            color: "var(--texto-2)",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <RefreshCw size={14} className={cargando ? "spin" : ""} /> Actualizar
        </button>
      </div>

      {cargando ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--texto-suave)" }}>
          Cargando registros inmutables de auditoría...
        </div>
      ) : error ? (
        <div style={{ padding: "20px", background: "var(--error-diluido)", border: "1px solid var(--error-diluido)", borderRadius: "8px", color: "var(--error)", fontSize: "0.85rem" }}>
          <strong>Error de Auditoría:</strong> {error}
        </div>
      ) : (
        <TablaAuditoria registros={registros} />
      )}
    </div>
  );
}
