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
    <div style={{ width: "100%", background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={22} color="#5000BA" /> Auditoría BDD & Telemetría Inmutable ({negocio})
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "3px 0 0 0" }}>
            Registro inmutable auditado por disparadores PostgreSQL (<code>{esquemaNegocio}</code> y <code>comun_seguridad</code>).
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDatos}
          style={{
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            color: "#334155",
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
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          Cargando registros inmutables de auditoría...
        </div>
      ) : error ? (
        <div style={{ padding: "20px", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "8px", color: "#b91c1c", fontSize: "0.85rem" }}>
          <strong>Error de Auditoría:</strong> {error}
        </div>
      ) : (
        <TablaAuditoria registros={registros} />
      )}
    </div>
  );
}
