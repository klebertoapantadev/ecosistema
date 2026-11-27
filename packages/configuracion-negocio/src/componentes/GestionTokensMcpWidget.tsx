"use client";
import { SelectConBuscador } from "@eco/comercio";

import React, { useState, useEffect, useTransition } from "react";
import { KeyRound, Plus, Copy, Check, AlertTriangle, ShieldCheck, Trash2, RefreshCw, Terminal } from "lucide-react";
import type { TokenMcpItem, RespuestaGenerarTokenMcp } from "@eco/agentes-ia";
import {
  listarTokensMcpAction,
  generarTokenMcpAction,
  revocarTokenMcpAction,
} from "../acciones-tokens-mcp";

interface Props {
  negocio: string;
}

export function GestionTokensMcpWidget({ negocio }: Props) {
  const [tokens, setTokens] = useState<TokenMcpItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [tokenGenerado, setTokenGenerado] = useState<RespuestaGenerarTokenMcp | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Formulario nuevo token
  const [nombre, setNombre] = useState("");
  const [alcanceCatalogo, setAlcanceCatalogo] = useState(true);
  const [alcancePedidos, setAlcancePedidos] = useState(false);
  const [alcanceProspectos, setAlcanceProspectos] = useState(false);
  const [expiracionDias, setExpiracionDias] = useState<number | 0>(0);
  const [isPending, startTransition] = useTransition();

  async function cargarTokens() {
    setCargando(true);
    setError(null);
    const res = await listarTokensMcpAction(negocio);
    if (res.ok) {
      setTokens(res.datos);
    } else {
      setError(res.error);
    }
    setCargando(false);
  }

  useEffect(() => {
    void cargarTokens();
  }, [negocio]);

  function handleCrearToken(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;

    const alcances: string[] = [];
    if (alcanceCatalogo) alcances.push("catalogo:leer");
    if (alcancePedidos) alcances.push("pedidos:crear");
    if (alcanceProspectos) alcances.push("prospectos:crear");
    if (alcances.length === 0) alcances.push("catalogo:leer");

    startTransition(async () => {
      const res = await generarTokenMcpAction(
        negocio,
        nombre.trim(),
        alcances,
        expiracionDias > 0 ? expiracionDias : null
      );

      if (res.ok) {
        setTokenGenerado(res.datos);
        setModalCrear(false);
        setNombre("");
        setExpiracionDias(0);
        setAlcanceProspectos(false);
        void cargarTokens();
      } else {
        setError(res.error);
      }
    });
  }

  function handleRevocar(tokenId: string, nombreToken: string) {
    if (!confirm(`¿Estás seguro de revocar el token "${nombreToken}"? Toda integración que lo use perderá acceso de inmediato.`)) {
      return;
    }

    startTransition(async () => {
      const res = await revocarTokenMcpAction(negocio, tokenId);
      if (res.ok) {
        void cargarTokens();
      } else {
        setError(res.error);
      }
    });
  }

  async function copiarAlPortapapeles(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback
      alert("Copia manual: " + texto);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Cabecera del Widget */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "0.94rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)", display: "flex", alignItems: "center", gap: "8px" }}>
            <KeyRound size={20} color="var(--violeta, #221E1B)" />
            Tokens de Integración & Servidor MCP
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--ct-847d74, #847D74)" }}>
            Credenciales de acceso seguro para conectar el catálogo con bots de WhatsApp (YCloud), n8n, Claude o Cursor.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => void cargarTokens()}
            className="btn-responsive-accion"
            title="Recargar listado"
            aria-label="Recargar listado"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-57524c, #57524C)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} />
            <span className="btn-texto-responsive">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalCrear(true)}
            className="btn-responsive-accion"
            title="Crear nuevo Token MCP"
            aria-label="Crear nuevo Token MCP"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: "var(--violeta, #221E1B)",
              color: "#FFFFFF",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <Plus size={16} />
            <span className="btn-texto-responsive">Crear Token</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo de Endpoint */}
      <div
        style={{
          background: "var(--cf-f8f7f4, #F8F7F4)",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          borderRadius: "10px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <Terminal size={18} color="#4B5563" style={{ marginTop: "2px" }} />
        <div style={{ fontSize: "0.85rem", color: "var(--ct-57524c, #57524C)", lineHeight: 1.5 }}>
          <strong>Endpoint MCP HTTP:</strong>{" "}
          <code style={{ background: "var(--cf-f4f2ee, #F4F2EE)", color: "var(--ct-221e1b, #221E1B)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.82rem" }}>
            POST /api/mcp/catalogo
          </code>
          <br />
          <span style={{ color: "var(--ct-847d74, #847D74)", fontSize: "0.8rem" }}>
            Autenticación requerida: Encabezado <code>Authorization: Bearer eco_live_...</code>
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--cf-faf2f2, #FAF2F2)", border: "1px solid var(--cb-debaba, #DEBABA)", borderRadius: "8px", padding: "12px 14px", color: "var(--ct-8a2e2e, #8A2E2E)", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {/* Listado de Tokens */}
      {cargando ? (
        <p style={{ fontSize: "0.88rem", color: "var(--ct-847d74, #847D74)", textAlign: "center", padding: "30px 0" }}>Cargando credenciales MCP...</p>
      ) : tokens.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--cf-f8f7f4, #F8F7F4)", borderRadius: "12px", border: "1px dashed var(--cb-d5cfc4, #D5CFC4)" }}>
          <KeyRound size={36} color="#9B948B" style={{ marginBottom: "10px" }} />
          <h4 style={{ margin: "0 0 6px 0", color: "var(--ct-57524c, #57524C)" }}>No hay tokens generados</h4>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ct-847d74, #847D74)" }}>
            Crea tu primer token de acceso para conectar bots y asistentes al catálogo de {negocio.toUpperCase()}.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--cf-f8f7f4, #F8F7F4)", borderBottom: "2px solid var(--cb-e6e2da, #E6E2DA)", color: "var(--ct-4b5563, #4B5563)", fontWeight: 700 }}>
                <th style={{ padding: "10px 12px" }}>Nombre & Integración</th>
                <th style={{ padding: "10px 12px" }}>Identificador (Prefijo)</th>
                <th style={{ padding: "10px 12px" }}>Alcances</th>
                <th style={{ padding: "10px 12px" }}>Estado</th>
                <th style={{ padding: "10px 12px" }}>Último Uso</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)" }}>
                  <td style={{ padding: "12px", fontWeight: 600, color: "var(--ct-1f1c19, #1F1C19)" }}>
                    {t.nombre}
                    <div style={{ fontSize: "0.75rem", color: "var(--ct-9b948b, #9B948B)", fontWeight: 400 }}>
                      Creado: {new Date(t.creado_en).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <code style={{ background: "var(--cf-f4f2ee, #F4F2EE)", padding: "3px 6px", borderRadius: "4px", fontSize: "0.8rem", color: "var(--ct-57524c, #57524C)" }}>
                      {t.prefijo}
                    </code>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {(t.alcances || []).map((alcance: string) => (
                        <span
                          key={alcance}
                          style={{
                            background: "var(--cf-efece6, #EFECE6)",
                            color: "var(--ct-3a3530, #3A3530)",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {alcance}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {t.revocado_en ? (
                      <span style={{ color: "var(--ct-8a2e2e, #8A2E2E)", fontWeight: 700, fontSize: "0.75rem", background: "var(--cf-f6e9e9, #F6E9E9)", padding: "3px 8px", borderRadius: "12px" }}>
                        Revocado
                      </span>
                    ) : t.expira_en && new Date(t.expira_en) <= new Date() ? (
                      <span style={{ color: "var(--ct-8f6a2e, #8F6A2E)", fontWeight: 700, fontSize: "0.75rem", background: "var(--cf-faf6ee, #FAF6EE)", padding: "3px 8px", borderRadius: "12px" }}>
                        Expirado
                      </span>
                    ) : (
                      <span style={{ color: "var(--ct-2f4737, #2F4737)", fontWeight: 700, fontSize: "0.75rem", background: "var(--cf-eaf1ec, #EAF1EC)", padding: "3px 8px", borderRadius: "12px" }}>
                        Activo
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px", color: "var(--ct-847d74, #847D74)", fontSize: "0.8rem" }}>
                    {t.ultimo_uso_en ? new Date(t.ultimo_uso_en).toLocaleString() : "Sin uso aún"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    {!t.revocado_en && (
                      <button
                        type="button"
                        onClick={() => handleRevocar(t.id, t.nombre)}
                        disabled={isPending}
                        className="btn-responsive-accion"
                        title="Revocar credencial"
                        aria-label="Revocar credencial"
                        style={{
                          background: "var(--cf-f6e9e9, #F6E9E9)",
                          color: "var(--ct-8a2e2e, #8A2E2E)",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Trash2 size={13} />
                        <span className="btn-texto-responsive">Revocar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Crear Nuevo Token */}
      {modalCrear && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "0.96rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Generar Token MCP ({negocio.toUpperCase()})
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "0.85rem", color: "var(--ct-847d74, #847D74)" }}>
              Crea una credencial con permisos específicos para interactuar con las herramientas de catálogo.
            </p>

            <form onSubmit={handleCrearToken} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)", marginBottom: "6px" }}>
                  Nombre descriptivo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Agente WhatsApp YCloud / n8n Flujo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)", marginBottom: "6px" }}>
                  Alcances de acceso (Scopes):
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--ct-57524c, #57524C)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={alcanceCatalogo}
                      onChange={(e) => setAlcanceCatalogo(e.target.checked)}
                    />
                    <code>catalogo:leer</code> — Consultar productos, existencias y precios
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--ct-57524c, #57524C)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={alcancePedidos}
                      onChange={(e) => setAlcancePedidos(e.target.checked)}
                    />
                    <code>pedidos:crear</code> — Generar cotizaciones y pedidos agénticos
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--ct-57524c, #57524C)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={alcanceProspectos}
                      onChange={(e) => setAlcanceProspectos(e.target.checked)}
                    />
                    <code>prospectos:crear</code> — Registrar contactos captados por asistentes de chat
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)", marginBottom: "6px" }}>
                  Vigencia / Caducidad:
                </label>
                <SelectConBuscador
                  value={expiracionDias}
                  onChange={(e) => setExpiracionDias(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    fontSize: "0.9rem",
                    background: "var(--cf-ffffff, #FFFFFF)",
                  }}
                >
                  <option value={0}>Sin expiración (Permanente hasta revocación)</option>
                  <option value={30}>30 días</option>
                  <option value={90}>90 días</option>
                  <option value={365}>1 año (365 días)</option>
                </SelectConBuscador>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setModalCrear(false)}
                  disabled={isPending}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-57524c, #57524C)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--violeta, #221E1B)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  {isPending ? "Generando..." : "Generar Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Visualización Segura de Token Generado (Una única vez) */}
      {tokenGenerado && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              borderRadius: "16px",
              padding: "26px",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", color: "var(--ct-2f4737, #2F4737)" }}>
              <ShieldCheck size={24} />
              <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                Token Creado Exitosamente
              </h3>
            </div>

            <div
              style={{
                background: "var(--cf-faf6ee, #FAF6EE)",
                border: "1px solid #8F6A2E",
                borderRadius: "10px",
                padding: "12px 14px",
                color: "var(--ct-745622, #745622)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                marginBottom: "18px",
              }}
            >
              <AlertTriangle size={18} style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <strong>Copia este token ahora:</strong> Por estrictas políticas de seguridad criptográfica,
                este secreto <strong>no volverá a mostrarse jamás</strong>. Si lo extravías, deberás revocarlo y crear uno nuevo.
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)", marginBottom: "6px" }}>
                Bearer Token ({tokenGenerado.nombre}):
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  readOnly
                  value={tokenGenerado.token_secreto}
                  style={{
                    flex: "1 1 200px",
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    color: "var(--ct-1f1c19, #1F1C19)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void copiarAlPortapapeles(tokenGenerado.token_secreto)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: copiado ? "#2F4737" : "var(--violeta, #221E1B)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                  {copiado ? "Copiado" : "Copiar Clave"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setTokenGenerado(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1F1C19",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Entendido y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
