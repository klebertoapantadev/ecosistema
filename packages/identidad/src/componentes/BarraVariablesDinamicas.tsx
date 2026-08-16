"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Copy, Check, X, Tag } from "lucide-react";

export interface VariableDinamicaDef {
  clave: string;
  etiqueta: string;
  ejemploValor?: string;
  esPersonalizada?: boolean;
}

export const VARIABLES_ESTANDAR: VariableDinamicaDef[] = [
  { clave: "nombre_completo", etiqueta: "Nombre Completo", ejemploValor: "Dra. Carolina Colcha" },
  { clave: "cedula", etiqueta: "Cédula / RUC", ejemploValor: "1715489623" },
  { clave: "negocio", etiqueta: "Negocio / Marca", ejemploValor: "TRANQI" },
  { clave: "correo", etiqueta: "Correo Electrónico", ejemploValor: "abogada.carolina@gmail.com" },
  { clave: "telefono", etiqueta: "Teléfono", ejemploValor: "0998765432" },
  { clave: "whatsapp", etiqueta: "WhatsApp", ejemploValor: "+593 998765432" },
  { clave: "fecha_actual", etiqueta: "Fecha Actual", ejemploValor: new Date().toLocaleDateString("es-EC") },
  { clave: "ciudad", etiqueta: "Ciudad", ejemploValor: "Quito, D.M." },
  { clave: "matricula_profesional", etiqueta: "Matrícula Foro", ejemploValor: "17-2020-89" },
  { clave: "universidad", etiqueta: "Universidad", ejemploValor: "Universidad Central del Ecuador" },
  { clave: "titulo_profesional", etiqueta: "Título", ejemploValor: "Abogada de los Tribunales y Juzgados de la República" },
  { clave: "representante_legal", etiqueta: "Representante Legal", ejemploValor: "Dr. Kleber Toapanta" },
];

interface Props {
  onInsertarVariable: (variableClave: string) => void;
  negocio?: string;
}

export function BarraVariablesDinamicas({ onInsertarVariable, negocio = "tranqi" }: Props) {
  const [variables, setVariables] = useState<VariableDinamicaDef[]>(VARIABLES_ESTANDAR);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [copiadoClave, setCopiadoClave] = useState<string | null>(null);

  const STORAGE_KEY = `eco_variables_dinamicas_${negocio.toLowerCase()}`;

  // Cargar variables personalizadas guardadas
  useEffect(() => {
    try {
      const guardadas = localStorage.getItem(STORAGE_KEY);
      if (guardadas) {
        const parsed: VariableDinamicaDef[] = JSON.parse(guardadas);
        if (Array.isArray(parsed)) {
          const personalizadas = parsed.filter(
            (p) => !VARIABLES_ESTANDAR.some((std) => std.clave === p.clave)
          );
          setVariables([...VARIABLES_ESTANDAR, ...personalizadas]);
        }
      }
    } catch {
      /* Ignorar */
    }
  }, [STORAGE_KEY]);

  const agregarNuevaVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaClave.trim()) return;

    const claveSaneada = nuevaClave
      .toLowerCase()
      .trim()
      .replace(/[\{\}]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    if (!claveSaneada) return;

    if (variables.some((v) => v.clave === claveSaneada)) {
      setNuevaClave("");
      setNuevaEtiqueta("");
      setMostrarAgregar(false);
      return;
    }

    const nueva: VariableDinamicaDef = {
      clave: claveSaneada,
      etiqueta: nuevaEtiqueta.trim() || claveSaneada,
      esPersonalizada: true,
      ejemploValor: `[${claveSaneada.toUpperCase()}]`,
    };

    const actualizadas = [...variables, nueva];
    setVariables(actualizadas);

    try {
      const soloPersonalizadas = actualizadas.filter((v) => v.esPersonalizada);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(soloPersonalizadas));
    } catch {
      /* Ignorar */
    }

    setNuevaClave("");
    setNuevaEtiqueta("");
    setMostrarAgregar(false);
  };

  const eliminarVariablePersonalizada = (claveAEliminar: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const actualizadas = variables.filter((v) => v.clave !== claveAEliminar);
    setVariables(actualizadas);
    try {
      const soloPersonalizadas = actualizadas.filter((v) => v.esPersonalizada);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(soloPersonalizadas));
    } catch {
      /* Ignorar */
    }
  };

  const copiarVariable = (clave: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`{{${clave}}}`);
      setCopiadoClave(clave);
      setTimeout(() => setCopiadoClave(null), 2000);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)",
        border: "1px solid #E9D5FF",
        borderRadius: "12px",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={16} color="#6B21A8" />
          <strong style={{ fontSize: "0.82rem", color: "#6B21A8", fontWeight: 800 }}>
            Variables Dinámicas Disponibles (Haz clic para insertar en el texto libremente):
          </strong>
        </div>

        <button
          type="button"
          onClick={() => setMostrarAgregar(!mostrarAgregar)}
          style={{
            background: "#FFFFFF",
            border: "1px dashed #A855F7",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "0.74rem",
            fontWeight: 700,
            color: "#6B21A8",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <Plus size={13} /> {mostrarAgregar ? "Cerrar" : "Agregar Variable"}
        </button>
      </div>

      {/* Formulario para Crear Nueva Variable Dinámica */}
      {mostrarAgregar && (
        <form
          onSubmit={agregarNuevaVariable}
          style={{
            background: "#FFFFFF",
            border: "1px solid #D8B4FE",
            borderRadius: "8px",
            padding: "10px",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: "1 1 180px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6B21A8" }}>{"{{"}</span>
            <input
              type="text"
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
              placeholder="nombre_variable"
              required
              style={{
                width: "100%",
                height: "30px",
                padding: "0 8px",
                borderRadius: "6px",
                border: "1px solid #E4E4E4",
                fontSize: "0.78rem",
                fontFamily: "monospace",
              }}
            />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6B21A8" }}>{"}}"}</span>
          </div>

          <input
            type="text"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            placeholder="Etiqueta descriptiva (opcional)"
            style={{
              flex: "1 1 180px",
              height: "30px",
              padding: "0 8px",
              borderRadius: "6px",
              border: "1px solid #E4E4E4",
              fontSize: "0.78rem",
            }}
          />

          <button
            type="submit"
            style={{
              background: "#6B21A8",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "0.76rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Guardar
          </button>
        </form>
      )}

      {/* Lista de Pastillas / Chips de Variables Dinámicas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {variables.map((v) => {
          const esCopiado = copiadoClave === v.clave;
          return (
            <div
              key={v.clave}
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#FFFFFF",
                border: v.esPersonalizada ? "1px solid #A855F7" : "1px solid #D8B4FE",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(107, 33, 168, 0.05)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => onInsertarVariable(v.clave)}
                title={`Insertar {{${v.clave}}} en la posición del cursor`}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "5px 9px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  color: "#581C87",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Tag size={12} color="#7E22CE" />
                <span>{`{{${v.clave}}}`}</span>
                <span style={{ fontSize: "0.68rem", opacity: 0.65, fontWeight: 500 }}>
                  ({v.etiqueta})
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => copiarVariable(v.clave, e)}
                title="Copiar marcador al portapapeles"
                style={{
                  background: esCopiado ? "#ECFDF5" : "transparent",
                  border: "none",
                  borderLeft: "1px solid #E9D5FF",
                  padding: "5px 6px",
                  cursor: "pointer",
                  color: esCopiado ? "#059669" : "#9333EA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {esCopiado ? <Check size={12} /> : <Copy size={12} />}
              </button>

              {v.esPersonalizada && (
                <button
                  type="button"
                  onClick={(e) => eliminarVariablePersonalizada(v.clave, e)}
                  title="Eliminar variable personalizada"
                  style={{
                    background: "transparent",
                    border: "none",
                    borderLeft: "1px solid #E9D5FF",
                    padding: "5px 6px",
                    cursor: "pointer",
                    color: "#DC2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
