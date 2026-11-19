"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  Hash,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  cambiarAmbienteFacturacionSriAction,
  desactivarCertificadoFirmaSriAction,
  fijarSecuencialFacturacionSriAction,
  guardarConfiguracionFacturacionSriAction,
  habilitarProduccionFacturacionSriAction,
  obtenerConfiguracionFacturacionSriAction,
  subirCertificadoFirmaSriAction,
  type EstadoConfiguracionFacturacionSri,
} from "../acciones-facturacion-sri";
import {
  etiquetaRegimenSri,
  generarClaveAccesoSri49,
  imprimirFacturaRideSri,
  obtenerEmisorDefectoPorNegocio,
  type CertificadoFirmaSriResumen,
  type ConfiguracionEmisorSri,
  type RegimenTributarioSri,
  type SecuencialSriResumen,
} from "../ride-sri";
import { normalizarIdentificadorNegocio } from "../utils/negocio";

export interface ConfiguracionFacturacionSriProps {
  negocio?: string;
}

const ESTILO_INPUT: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #D5CFC4",
  backgroundColor: "#FFFFFF",
  color: "#1F1C19",
  fontSize: "0.875rem",
  outline: "none",
};

const ESTILO_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: "0.76rem",
  fontWeight: 700,
  color: "#57524C",
  marginBottom: "5px",
  letterSpacing: "0.01em",
};

const ESTILO_CARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E6E2DA",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
};

function diasRestantesVigencia(isoHasta: string): number {
  const f = new Date(isoHasta);
  if (Number.isNaN(f.getTime())) return 0;
  return Math.ceil((f.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function ConfiguracionFacturacionSri({
  negocio = "tinkay",
}: ConfiguracionFacturacionSriProps) {
  const negPrincipal = useMemo(
    () => normalizarIdentificadorNegocio(negocio).principal,
    [negocio],
  );
  const cacheKey = `eco_facturacion_sri_cfg_v1_${negPrincipal}`;

  const [cargando, setCargando] = useState<boolean>(true);
  const [guardandoEmisor, setGuardandoEmisor] = useState<boolean>(false);
  const [subiendoCert, setSubiendoCert] = useState<boolean>(false);
  const [procesandoAccion, setProcesandoAccion] = useState<string | null>(null);

  const [emisor, setEmisor] = useState<ConfiguracionEmisorSri>(() =>
    obtenerEmisorDefectoPorNegocio(negPrincipal),
  );
  const [secuenciales, setSecuenciales] = useState<SecuencialSriResumen[]>([]);
  const [certificados, setCertificados] = useState<CertificadoFirmaSriResumen[]>([]);
  const [esSuperadmin, setEsSuperadmin] = useState<boolean>(false);
  const [datosSugeridos, setDatosSugeridos] = useState<
    EstadoConfiguracionFacturacionSri["datosNegocioSugeridos"]
  >({
    ruc: null,
    razonSocial: null,
    nombreComercial: null,
    direccion: null,
    correo: null,
  });

  // Campos de formulario de certificado .p12
  const [archivoP12, setArchivoP12] = useState<File | null>(null);
  const [claveP12, setClaveP12] = useState<string>("");
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  // Campos editables de secuencial en el ambiente activo
  const [secFacturaInput, setSecFacturaInput] = useState<string>("0");
  const [secNotaCreditoInput, setSecNotaCreditoInput] = useState<string>("0");

  // Mensajes de retroalimentación explícitos
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const sincronizarInputsSecuencial = useCallback(
    (lista: SecuencialSriResumen[], ambienteActivo: 1 | 2) => {
      const sec01 = lista.find(
        (s) => s.ambiente === ambienteActivo && s.tipoComprobante === "01",
      );
      const sec04 = lista.find(
        (s) => s.ambiente === ambienteActivo && s.tipoComprobante === "04",
      );
      setSecFacturaInput(String(sec01?.ultimoNumero ?? 0));
      setSecNotaCreditoInput(String(sec04?.ultimoNumero ?? 0));
    },
    [],
  );

  const escribirCacheLocal = useCallback(
    (parcial: {
      emisor: ConfiguracionEmisorSri;
      secuenciales: SecuencialSriResumen[];
      certificados: CertificadoFirmaSriResumen[];
    }) => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(parcial));
      } catch {
        // Ignorar si almacenamiento privado restringido
      }
    },
    [cacheKey],
  );

  const cargarConfiguracion = useCallback(async () => {
    setCargando(true);
    // 1. Hidratación instantánea desde caché local para evitar parpadeos
    try {
      const rawLocal = localStorage.getItem(cacheKey);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed?.emisor) {
          setEmisor(parsed.emisor);
          if (Array.isArray(parsed.secuenciales)) {
            setSecuenciales(parsed.secuenciales);
            sincronizarInputsSecuencial(
              parsed.secuenciales,
              parsed.emisor.ambiente || 1,
            );
          }
          if (Array.isArray(parsed.certificados)) {
            setCertificados(parsed.certificados);
          }
        }
      }
    } catch {
      // Continuar con carga remota
    }

    // 2. Consulta autoritativa a Supabase
    try {
      const res = await obtenerConfiguracionFacturacionSriAction(negPrincipal);
      if (res.ok) {
        setEmisor(res.emisor);
        setSecuenciales(res.secuenciales);
        setCertificados(res.certificados);
        setEsSuperadmin(res.esSuperadmin);
        setDatosSugeridos(res.datosNegocioSugeridos);
        sincronizarInputsSecuencial(res.secuenciales, res.emisor.ambiente);
        escribirCacheLocal({
          emisor: res.emisor,
          secuenciales: res.secuenciales,
          certificados: res.certificados,
        });
      } else if (res.error) {
        setMensajeError(res.error);
      }
    } catch (err: any) {
      setMensajeError(
        err?.message || "No se pudo cargar la configuración de facturación SRI.",
      );
    } finally {
      setCargando(false);
    }
  }, [cacheKey, escribirCacheLocal, negPrincipal, sincronizarInputsSecuencial]);

  useEffect(() => {
    void cargarConfiguracion();
  }, [cargarConfiguracion]);

  const certificadoActivo = useMemo(
    () => certificados.find((c) => c.activo) || null,
    [certificados],
  );

  const rutaConsolaFacturas =
    negPrincipal === "tranqi"
      ? "/panel/herramientas?widget=facturacion_electronica"
      : "/panel/facturacion";

  function handleSincronizarDatosNegocio() {
    setMensajeError(null);
    setEmisor((prev) => ({
      ...prev,
      ruc:
        datosSugeridos.ruc && /^[0-9]{13}$/.test(datosSugeridos.ruc.trim())
          ? datosSugeridos.ruc.trim()
          : prev.ruc,
      razonSocial: datosSugeridos.razonSocial || prev.razonSocial,
      nombreComercial: datosSugeridos.nombreComercial || prev.nombreComercial,
      direccionMatriz: datosSugeridos.direccion || prev.direccionMatriz,
      direccionEstablecimiento:
        datosSugeridos.direccion || prev.direccionEstablecimiento,
      correoCopia: datosSugeridos.correo || prev.correoCopia,
    }));
    setMensajeExito(
      "Datos tomados de la ficha general del negocio. Pulsa «Guardar Emisor» para confirmar.",
    );
  }

  async function handleGuardarEmisor(e: React.FormEvent) {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);
    setGuardandoEmisor(true);
    try {
      const res = await guardarConfiguracionFacturacionSriAction(negPrincipal, {
        ruc: emisor.ruc,
        razonSocial: emisor.razonSocial,
        nombreComercial: emisor.nombreComercial,
        direccionMatriz: emisor.direccionMatriz,
        direccionEstablecimiento: emisor.direccionEstablecimiento,
        establecimiento: emisor.establecimiento,
        puntoEmision: emisor.puntoEmision,
        obligadoContabilidad: emisor.obligadoContabilidad,
        regimen: emisor.regimen,
        contribuyenteEspecial: emisor.contribuyenteEspecial || null,
        agenteRetencion: emisor.agenteRetencion || null,
        correoCopia: emisor.correoCopia || "",
        emisionAutomatica: emisor.emisionAutomatica,
        activo: emisor.activo,
      });

      if (!res.ok) {
        setMensajeError(res.error || "No se pudo guardar el emisor SRI.");
        return;
      }

      const actualizado = res.emisor || emisor;
      setEmisor(actualizado);
      escribirCacheLocal({
        emisor: actualizado,
        secuenciales,
        certificados,
      });
      setMensajeExito(
        "Parámetros tributarios del emisor SRI guardados correctamente en base de datos.",
      );
    } catch (err: any) {
      setMensajeError(err?.message || "Error inesperado al guardar el emisor.");
    } finally {
      setGuardandoEmisor(false);
    }
  }

  async function handleSubirCertificado(e: React.FormEvent) {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);
    if (!archivoP12) {
      setMensajeError("Selecciona primero tu archivo de firma electrónica (.p12 o .pfx).");
      return;
    }
    if (!claveP12) {
      setMensajeError("Ingresa la contraseña de apertura del archivo .p12.");
      return;
    }

    setSubiendoCert(true);
    try {
      const fd = new FormData();
      fd.set("negocio", negPrincipal);
      fd.set("clave", claveP12);
      fd.set("archivo", archivoP12);

      const res = await subirCertificadoFirmaSriAction(fd);
      if (!res.ok) {
        setMensajeError(res.error || "No se pudo registrar el certificado .p12.");
        return;
      }

      setArchivoP12(null);
      setClaveP12("");
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      await cargarConfiguracion();
      setMensajeExito(
        `Certificado de firma electrónica validado y custodiado en Supabase Vault (${res.certificado?.titular || "Vigente"}).`,
      );
    } catch (err: any) {
      setMensajeError(err?.message || "Error al procesar el archivo .p12.");
    } finally {
      setSubiendoCert(false);
    }
  }

  async function handleDesactivarCertificado(certId: string) {
    setMensajeError(null);
    setMensajeExito(null);
    setProcesandoAccion(`cert-${certId}`);
    try {
      const res = await desactivarCertificadoFirmaSriAction(negPrincipal, certId);
      if (!res.ok) {
        setMensajeError(res.error || "No se pudo desactivar el certificado.");
        return;
      }
      await cargarConfiguracion();
      setMensajeExito("Certificado desactivado y secretos retirados de Vault.");
    } catch (err: any) {
      setMensajeError(err?.message || "Error al desactivar el certificado.");
    } finally {
      setProcesandoAccion(null);
    }
  }

  async function handleCambiarAmbiente(nuevoAmbiente: 1 | 2) {
    if (emisor.ambiente === nuevoAmbiente) return;
    setMensajeError(null);
    setMensajeExito(null);
    setProcesandoAccion(`amb-${nuevoAmbiente}`);
    try {
      const res = await cambiarAmbienteFacturacionSriAction(
        negPrincipal,
        nuevoAmbiente,
      );
      if (!res.ok) {
        setMensajeError(res.error || "No se pudo conmutar el ambiente SRI.");
        return;
      }
      if (res.emisor) {
        setEmisor(res.emisor);
        sincronizarInputsSecuencial(secuenciales, res.emisor.ambiente);
        escribirCacheLocal({
          emisor: res.emisor,
          secuenciales,
          certificados,
        });
      }
      setMensajeExito(
        nuevoAmbiente === 2
          ? "Ambiente conmutado a PRODUCCIÓN SRI (CEL)."
          : "Ambiente conmutado a PRUEBAS SRI (CELCER).",
      );
    } catch (err: any) {
      setMensajeError(err?.message || "Error al cambiar el ambiente SRI.");
    } finally {
      setProcesandoAccion(null);
    }
  }

  async function handleToggleProduccionHabilitada(habilitar: boolean) {
    setMensajeError(null);
    setMensajeExito(null);
    setProcesandoAccion("toggle-prod");
    try {
      const res = await habilitarProduccionFacturacionSriAction(
        negPrincipal,
        habilitar,
      );
      if (!res.ok) {
        setMensajeError(
          res.error || "No se pudo modificar la autorización de producción.",
        );
        return;
      }
      if (res.emisor) {
        setEmisor(res.emisor);
        escribirCacheLocal({
          emisor: res.emisor,
          secuenciales,
          certificados,
        });
      }
      setMensajeExito(
        habilitar
          ? "Pase a Producción SRI autorizado para este negocio."
          : "Autorización de Producción SRI revocada (vuelve a Pruebas).",
      );
    } catch (err: any) {
      setMensajeError(err?.message || "Error al cambiar autorización de producción.");
    } finally {
      setProcesandoAccion(null);
    }
  }

  async function handleFijarSecuencial(tipoComprobante: "01" | "04") {
    setMensajeError(null);
    setMensajeExito(null);
    const valorTexto =
      tipoComprobante === "01" ? secFacturaInput : secNotaCreditoInput;
    const numero = parseInt(valorTexto, 10);
    if (Number.isNaN(numero) || numero < 0) {
      setMensajeError("Ingresa un número secuencial entero mayor o igual a 0.");
      return;
    }

    setProcesandoAccion(`sec-${tipoComprobante}`);
    try {
      const res = await fijarSecuencialFacturacionSriAction({
        negocio: negPrincipal,
        ambiente: emisor.ambiente,
        tipoComprobante,
        ultimoNumero: numero,
      });
      if (!res.ok) {
        setMensajeError(res.error || "No se pudo actualizar el secuencial.");
        return;
      }
      const nuevos = res.secuenciales || secuenciales;
      setSecuenciales(nuevos);
      sincronizarInputsSecuencial(nuevos, emisor.ambiente);
      escribirCacheLocal({
        emisor,
        secuenciales: nuevos,
        certificados,
      });
      setMensajeExito(
        `Secuencial de ${tipoComprobante === "01" ? "Facturas (01)" : "Notas de Crédito (04)"} fijado en ${numero}.`,
      );
    } catch (err: any) {
      setMensajeError(err?.message || "Error al actualizar secuencial.");
    } finally {
      setProcesandoAccion(null);
    }
  }

  function handleVistaPreviaRide() {
    const ahoraIso = new Date().toISOString();
    const sigNum = Math.max(1, (parseInt(secFacturaInput, 10) || 0) + 1);
    const numComp = `${emisor.establecimiento}-${emisor.puntoEmision}-${String(sigNum).padStart(9, "0")}`;
    const claveDemo = generarClaveAccesoSri49({
      fechaIso: ahoraIso,
      ruc: emisor.ruc,
      ambiente: emisor.ambiente,
      establecimiento: emisor.establecimiento,
      puntoEmision: emisor.puntoEmision,
      secuencialNumero: sigNum,
    });
    const esFloristeria =
      negPrincipal === "tinkay" || negPrincipal === "margaritas";

    imprimirFacturaRideSri({
      negocio: negPrincipal,
      emisor,
      numeroComprobante: numComp,
      claveAcceso: claveDemo,
      estadoSri: "AUTORIZADO (VISTA PREVIA)",
      ambiente: emisor.ambiente,
      fechaEmision: ahoraIso,
      fechaAutorizacion: ahoraIso,
      comprador: {
        razonSocial: "CONSUMIDOR DEMOSTRACIÓN S.A.",
        identificacion: "1710034065",
        correo: emisor.correoCopia || "cliente@ejemplo.com",
        telefono: "0999999999",
        direccion: "Quito, Pichincha - Ecuador",
      },
      lineas: esFloristeria
        ? [
            {
              codigo: "TNK-ARR-01",
              descripcion: "Pedestal Floral Natural de Exportación (XXL)",
              cantidad: 1,
              precio_unitario: 80,
              tarifa_iva: 0,
              subtotal: 80,
              valor_iva: 0,
            },
            {
              codigo: "ENVIO-DOM",
              descripcion: "Envío a domicilio en Quito",
              cantidad: 1,
              precio_unitario: 6,
              tarifa_iva: 0,
              subtotal: 6,
              valor_iva: 0,
            },
          ]
        : [
            {
              codigo: "SRV-001",
              descripcion: "Servicio Profesional Especializado",
              cantidad: 1,
              precio_unitario: 25,
              tarifa_iva: 15,
              subtotal: 25,
              valor_iva: 3.75,
            },
          ],
      subtotal15: esFloristeria ? 0 : 25,
      subtotal0: esFloristeria ? 86 : 0,
      iva15: esFloristeria ? 0 : 3.75,
      total: esFloristeria ? 86 : 28.75,
      formaPagoTexto: "19 - TARJETA DE CRÉDITO / DÉBITO (PLUX)",
      referenciaPago: "DEMO-RIDE-SRI",
    });
  }

  const proximoComprobante01 = `${emisor.establecimiento}-${emisor.puntoEmision}-${String(
    Math.max(1, (parseInt(secFacturaInput, 10) || 0) + 1),
  ).padStart(9, "0")}`;

  const proximoComprobante04 = `${emisor.establecimiento}-${emisor.puntoEmision}-${String(
    Math.max(1, (parseInt(secNotaCreditoInput, 10) || 0) + 1),
  ).padStart(9, "0")}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        color: "#1F1C19",
      }}
    >
      {/* Cabecera de estado operativo */}
      <div
        style={{
          ...ESTILO_CARD,
          background: "#FFFFFF",
          color: "#1F1C19",
          border: "1px solid #E6E2DA",
          borderLeft: "3px solid #2F4737",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "260px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <FileCheck2 size={18} color="#2F4737" />
            <h2 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 600, color: "#1F1C19" }}>
              Parámetros de Facturación Electrónica SRI
            </h2>
            <span
              style={{
                padding: "2.5px 9px",
                borderRadius: "999px",
                fontSize: "0.69rem",
                fontWeight: 600,
                backgroundColor: emisor.ambiente === 2 ? "#F2F6F3" : "#FAF6EE",
                border: emisor.ambiente === 2 ? "1px solid #CEDDD3" : "1px solid #E5D7BC",
                color: emisor.ambiente === 2 ? "#2B4A36" : "#745622",
              }}
            >
              {emisor.ambiente === 2 ? "PRODUCCIÓN (CEL)" : "PRUEBAS (CELCER)"}
            </span>
            <span
              style={{
                padding: "2.5px 9px",
                borderRadius: "999px",
                fontSize: "0.69rem",
                fontWeight: 600,
                backgroundColor: certificadoActivo ? "#F2F6F3" : "#FAF2F2",
                border: certificadoActivo ? "1px solid #CEDDD3" : "1px solid #E5CACA",
                color: certificadoActivo ? "#2B4A36" : "#8A2E2E",
              }}
            >
              {certificadoActivo ? "Firma .p12 Activa" : "Firma .p12 Pendiente"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#57524C", lineHeight: 1.45 }}>
            Configura el RUC, razón social, régimen RIMPE/General, serie de emisión{" "}
            <strong>
              {emisor.establecimiento}-{emisor.puntoEmision}
            </strong>{" "}
            y certificado electrónico para emitir comprobantes automáticos al cobrar con PLUX o registrar pagos manuales.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleVistaPreviaRide}
            className="btn-responsive-accion"
            title="Abrir vista previa del RIDE PDF con los parámetros actuales"
            aria-label="Vista previa RIDE PDF"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              borderRadius: "8px",
              border: "1px solid #D5CFC4",
              backgroundColor: "#FFFFFF",
              color: "#221E1B",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Eye size={15} />
            <span className="btn-texto-responsive">Vista Previa</span>
          </button>

          <a
            href={rutaConsolaFacturas}
            className="btn-responsive-accion"
            title="Abrir consola operativa de facturas emitidas y cobros"
            aria-label="Abrir consola de facturas emitidas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 14px",
              borderRadius: "10px",
              backgroundColor: "#2F4737",
              color: "#052E16",
              fontSize: "0.8rem",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            <FileCheck2 size={16} />
            <span className="btn-texto-responsive">Ver Facturas</span>
          </a>
        </div>
      </div>

      {/* Alertas de estado */}
      {mensajeError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor: "#FAF2F2",
            border: "1px solid #E5CACA",
            color: "#8A2E2E",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{mensajeError}</span>
        </div>
      )}

      {mensajeExito && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor: "#F2F6F3",
            border: "1px solid #CEDDD3",
            color: "#2B4A36",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* SECCIÓN 1: Datos Tributarios del Emisor */}
      <form onSubmit={handleGuardarEmisor} style={ESTILO_CARD}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "18px",
            paddingBottom: "12px",
            borderBottom: "1px solid #F4F2EE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#F4F2EE",
                color: "#221E1B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800 }}>
                1. Datos Tributarios del Contribuyente Emisor
              </h3>
              <p style={{ margin: 0, fontSize: "0.77rem", color: "#847D74" }}>
                Información impresa en el XML versión 2.1.0 y en el RIDE PDF del cliente ({etiquetaRegimenSri(emisor.regimen)}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSincronizarDatosNegocio}
            className="btn-responsive-accion"
            title="Autocompletar con los datos generales del negocio"
            aria-label="Sincronizar datos desde ficha general del negocio"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "9px",
              border: "1px solid #D5CFC4",
              backgroundColor: "#F8F7F4",
              color: "#57524C",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            <span className="btn-texto-responsive">Sincronizar Datos</span>
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
          }}
        >
          <div>
            <label style={ESTILO_LABEL}>RUC del Emisor (13 dígitos, termina en 001) *</label>
            <input
              type="text"
              maxLength={13}
              required
              value={emisor.ruc}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  ruc: e.target.value.replace(/\D/g, "").slice(0, 13),
                }))
              }
              placeholder="1792837465001"
              style={{ ...ESTILO_INPUT, fontFamily: "monospace", fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>Razón Social / Apellidos y Nombres (SRI) *</label>
            <input
              type="text"
              required
              value={emisor.razonSocial}
              onChange={(e) => setEmisor((p) => ({ ...p, razonSocial: e.target.value }))}
              placeholder="TINKAY FLORISTERÍA CÍA. LTDA."
              style={ESTILO_INPUT}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>Nombre Comercial</label>
            <input
              type="text"
              value={emisor.nombreComercial}
              onChange={(e) => setEmisor((p) => ({ ...p, nombreComercial: e.target.value }))}
              placeholder="Tinkay Flores y Eventos"
              style={ESTILO_INPUT}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>Régimen Tributario SRI *</label>
            <SelectConBuscador
              value={emisor.regimen}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  regimen: e.target.value as RegimenTributarioSri,
                }))
              }
              style={ESTILO_INPUT}
            >
              <option value="GENERAL">Régimen General</option>
              <option value="RIMPE_EMPRENDEDOR">Contribuyente Régimen RIMPE (Emprendedor)</option>
              <option value="RIMPE_NEGOCIO_POPULAR">RIMPE — Negocio Popular</option>
            </SelectConBuscador>
          </div>

          <div>
            <label style={ESTILO_LABEL}>Código Establecimiento (3 dígitos) *</label>
            <input
              type="text"
              maxLength={3}
              required
              value={emisor.establecimiento}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  establecimiento: e.target.value.replace(/\D/g, "").slice(0, 3),
                }))
              }
              placeholder="001"
              style={{ ...ESTILO_INPUT, fontFamily: "monospace" }}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>Punto de Emisión (3 dígitos) *</label>
            <input
              type="text"
              maxLength={3}
              required
              value={emisor.puntoEmision}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  puntoEmision: e.target.value.replace(/\D/g, "").slice(0, 3),
                }))
              }
              placeholder="001"
              style={{ ...ESTILO_INPUT, fontFamily: "monospace" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ESTILO_LABEL}>Dirección Matriz *</label>
            <input
              type="text"
              required
              value={emisor.direccionMatriz}
              onChange={(e) => setEmisor((p) => ({ ...p, direccionMatriz: e.target.value }))}
              placeholder="El Batán Alto / Monteserrín, Quito - Ecuador"
              style={ESTILO_INPUT}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ESTILO_LABEL}>Dirección Establecimiento Emisor</label>
            <input
              type="text"
              value={emisor.direccionEstablecimiento}
              onChange={(e) =>
                setEmisor((p) => ({ ...p, direccionEstablecimiento: e.target.value }))
              }
              placeholder="Taller Tinkay Floristería — Quito, Ecuador"
              style={ESTILO_INPUT}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>N° Contribuyente Especial (opcional)</label>
            <input
              type="text"
              value={emisor.contribuyenteEspecial || ""}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  contribuyenteEspecial: e.target.value || null,
                }))
              }
              placeholder="Dejar vacío si no aplica"
              style={ESTILO_INPUT}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>Resolución Agente de Retención (opcional)</label>
            <input
              type="text"
              value={emisor.agenteRetencion || ""}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  agenteRetencion: e.target.value || null,
                }))
              }
              placeholder="Ej. NAC-DNCRASC20-00000001"
              style={ESTILO_INPUT}
            />
          </div>

          <div>
            <label style={ESTILO_LABEL}>Correo Copia Contabilidad (RIDE/XML)</label>
            <input
              type="email"
              value={emisor.correoCopia || ""}
              onChange={(e) =>
                setEmisor((p) => ({ ...p, correoCopia: e.target.value || null }))
              }
              placeholder="facturacion@tinkay.com"
              style={ESTILO_INPUT}
            />
          </div>
        </div>

        {/* Interruptores booleanos */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "12px",
            marginTop: "16px",
            padding: "14px",
            borderRadius: "12px",
            backgroundColor: "#F8F7F4",
            border: "1px solid #E6E2DA",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#221E1B",
            }}
          >
            <input
              type="checkbox"
              checked={emisor.obligadoContabilidad}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  obligadoContabilidad: e.target.checked,
                }))
              }
              style={{ width: "17px", height: "17px", accentColor: "#1F1C19" }}
            />
            Obligado a llevar contabilidad ({emisor.obligadoContabilidad ? "SÍ" : "NO"})
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#221E1B",
            }}
          >
            <input
              type="checkbox"
              checked={emisor.emisionAutomatica}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  emisionAutomatica: e.target.checked,
                }))
              }
              style={{ width: "17px", height: "17px", accentColor: "#2F4737" }}
            />
            Facturar automáticamente cobros PLUX
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#221E1B",
            }}
          >
            <input
              type="checkbox"
              checked={emisor.activo}
              onChange={(e) =>
                setEmisor((p) => ({
                  ...p,
                  activo: e.target.checked,
                }))
              }
              style={{ width: "17px", height: "17px", accentColor: "#221E1B" }}
            />
            Emisor electrónico habilitado
          </label>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px",
          }}
        >
          <button
            type="submit"
            disabled={guardandoEmisor || cargando}
            className="btn-responsive-accion"
            title="Guardar parámetros tributarios del emisor en base de datos"
            aria-label="Guardar parámetros tributarios del emisor"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 20px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: guardandoEmisor ? "#847D74" : "#1F1C19",
              color: "#FFFFFF",
              fontSize: "0.86rem",
              fontWeight: 800,
              cursor: guardandoEmisor ? "wait" : "pointer",
            }}
          >
            <Save size={16} />
            <span>{guardandoEmisor ? "Guardando…" : "Guardar Emisor"}</span>
          </button>
        </div>
      </form>

      {/* SECCIÓN 2 y 3 en rejilla adaptable */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
          gap: "20px",
        }}
      >
        {/* SECCIÓN 2: Certificado de Firma Electrónica (.p12) */}
        <div style={ESTILO_CARD}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "14px",
              paddingBottom: "12px",
              borderBottom: "1px solid #F4F2EE",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#F2F6F3",
                color: "#2F4737",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KeyRound size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 800 }}>
                2. Certificado de Firma Electrónica (.p12)
              </h3>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#847D74" }}>
                Custodiado cifrado en Supabase Vault para firma XAdES-BES (BCE, Security Data, Uanataca).
              </p>
            </div>
          </div>

          {certificadoActivo ? (
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                backgroundColor: "#F2F6F3",
                border: "1px solid #BBF7D0",
                marginBottom: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    color: "#2B4A36",
                  }}
                >
                  <ShieldCheck size={16} />
                  CERTIFICADO ACTIVO EN VAULT
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    backgroundColor:
                      diasRestantesVigencia(certificadoActivo.validoHasta) <= 30
                        ? "#FAF6EE"
                        : "#F2F6F3",
                    color:
                      diasRestantesVigencia(certificadoActivo.validoHasta) <= 30
                        ? "#745622"
                        : "#2B4A36",
                  }}
                >
                  {diasRestantesVigencia(certificadoActivo.validoHasta)} días restantes
                </span>
              </div>

              <div style={{ fontSize: "0.82rem", color: "#14532D" }}>
                <strong>Titular:</strong> {certificadoActivo.titular}
              </div>
              {certificadoActivo.identificacionCertificado && (
                <div style={{ fontSize: "0.78rem", color: "#2B4A36" }}>
                  <strong>Identificación:</strong>{" "}
                  <code>{certificadoActivo.identificacionCertificado}</code>
                </div>
              )}
              <div style={{ fontSize: "0.78rem", color: "#2B4A36" }}>
                <strong>Entidad Certificadora:</strong> {certificadoActivo.emisorCa}
              </div>
              <div style={{ fontSize: "0.76rem", color: "#2F4737" }}>
                <strong>Vigente hasta:</strong>{" "}
                {new Date(certificadoActivo.validoHasta).toLocaleDateString("es-EC", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                <button
                  type="button"
                  disabled={procesandoAccion === `cert-${certificadoActivo.id}`}
                  onClick={() => handleDesactivarCertificado(certificadoActivo.id)}
                  className="btn-responsive-accion"
                  title="Revocar certificado activo y borrar clave privada de Vault"
                  aria-label="Desactivar certificado electrónico activo"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DEBABA",
                    backgroundColor: "#FFFFFF",
                    color: "#8A2E2E",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Desactivar</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                backgroundColor: "#FAF6EE",
                border: "1px solid #E5D7BC",
                color: "#745622",
                fontSize: "0.8rem",
                marginBottom: "16px",
              }}
            >
              Aún no hay un archivo <strong>.p12</strong> cargado en Vault. En ambiente de{" "}
              <strong>Pruebas</strong> los comprobantes internos y RIDE funcionan de inmediato; para autorización en línea ante el SRI sube tu firma electrónica aquí.
            </div>
          )}

          <form
            onSubmit={handleSubirCertificado}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div>
              <label style={ESTILO_LABEL}>Archivo de Firma Electrónica (.p12 / .pfx)</label>
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".p12,.pfx,application/x-pkcs12"
                onChange={(e) => setArchivoP12(e.target.files?.[0] || null)}
                style={{
                  ...ESTILO_INPUT,
                  padding: "8px 10px",
                  backgroundColor: "#F8F7F4",
                }}
              />
            </div>

            <div>
              <label style={ESTILO_LABEL}>Contraseña del Certificado .p12</label>
              <input
                type="password"
                autoComplete="new-password"
                value={claveP12}
                onChange={(e) => setClaveP12(e.target.value)}
                placeholder="Contraseña de tu firma electrónica"
                style={ESTILO_INPUT}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "0.73rem",
                  color: "#847D74",
                }}
              >
                <Lock size={13} />
                Ni el .p12 ni su clave salen de Vault
              </span>

              <button
                type="submit"
                disabled={subiendoCert}
                className="btn-responsive-accion"
                title="Validar archivo .p12 y custodiar en Supabase Vault"
                aria-label="Subir certificado de firma electrónica"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 16px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: subiendoCert ? "#847D74" : "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: subiendoCert ? "wait" : "pointer",
                }}
              >
                <Upload size={15} />
                <span>{subiendoCert ? "Validando…" : "Subir Certificado"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* SECCIÓN 3: Ambiente SRI y Secuenciales */}
        <div style={ESTILO_CARD}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "14px",
              paddingBottom: "12px",
              borderBottom: "1px solid #F4F2EE",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#FAF6EE",
                color: "#745622",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Hash size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 800 }}>
                3. Ambiente SRI y Secuenciales
              </h3>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#847D74" }}>
                Numeración independiente por ambiente para la serie{" "}
                <strong>
                  {emisor.establecimiento}-{emisor.puntoEmision}
                </strong>
                .
              </p>
            </div>
          </div>

          {/* Conmutador Pruebas vs Producción */}
          <div style={{ marginBottom: "16px" }}>
            <label style={ESTILO_LABEL}>Ambiente de Emisión Activo</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: "8px" }}>
              <button
                type="button"
                disabled={procesandoAccion === "amb-1"}
                onClick={() => handleCambiarAmbiente(1)}
                title="Emitir en el ambiente de certificaciones y pruebas del SRI (CELCER)"
                aria-label="Activar ambiente Pruebas SRI"
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border:
                    emisor.ambiente === 1
                      ? "2px solid #8F6A2E"
                      : "1px solid #D5CFC4",
                  backgroundColor: emisor.ambiente === 1 ? "#FAF6EE" : "#FFFFFF",
                  color: emisor.ambiente === 1 ? "#745622" : "#57524C",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                1 · Pruebas (CELCER)
              </button>

              <button
                type="button"
                disabled={
                  procesandoAccion === "amb-2" ||
                  (!emisor.produccionHabilitada && !esSuperadmin)
                }
                onClick={() => handleCambiarAmbiente(2)}
                title="Emitir comprobantes con validez tributaria real en Producción SRI (CEL)"
                aria-label="Activar ambiente Producción SRI"
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border:
                    emisor.ambiente === 2
                      ? "2px solid #2F4737"
                      : "1px solid #D5CFC4",
                  backgroundColor: emisor.ambiente === 2 ? "#F2F6F3" : "#FFFFFF",
                  color: emisor.ambiente === 2 ? "#2B4A36" : "#57524C",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  opacity:
                    !emisor.produccionHabilitada && emisor.ambiente !== 2 ? 0.6 : 1,
                  cursor:
                    !emisor.produccionHabilitada && !esSuperadmin
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                2 · Producción (CEL)
              </button>
            </div>

            {esSuperadmin && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  backgroundColor: "#F8F7F4",
                  border: "1px solid #E6E2DA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "#57524C",
                  }}
                >
                  <ShieldAlert size={15} color="#8F6A2E" />
                  Control SuperAdmin: Pase a Producción SRI
                </span>
                <button
                  type="button"
                  disabled={procesandoAccion === "toggle-prod"}
                  onClick={() =>
                    handleToggleProduccionHabilitada(!emisor.produccionHabilitada)
                  }
                  title="Autorizar o bloquear emisión en Producción SRI para este negocio"
                  aria-label="Autorizar o revocar pase a Producción SRI"
                  style={{
                    padding: "5px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    backgroundColor: emisor.produccionHabilitada
                      ? "#F6E9E9"
                      : "#F2F6F3",
                    color: emisor.produccionHabilitada ? "#8A2E2E" : "#2B4A36",
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {emisor.produccionHabilitada
                    ? "Revocar Producción"
                    : "Habilitar Producción"}
                </button>
              </div>
            )}
          </div>

          {/* Secuencial Facturas (01) */}
          <div
            style={{
              padding: "12px",
              borderRadius: "12px",
              backgroundColor: "#F8F7F4",
              border: "1px solid #E6E2DA",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1F1C19" }}>
                Facturas (Código SRI 01)
              </span>
              <span
                style={{
                  fontSize: "0.73rem",
                  fontFamily: "monospace",
                  color: "#2F4737",
                  fontWeight: 700,
                }}
              >
                Próxima: {proximoComprobante01}
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                min={0}
                max={999999999}
                value={secFacturaInput}
                onChange={(e) => setSecFacturaInput(e.target.value)}
                aria-label="Último número emitido de facturas"
                style={{ ...ESTILO_INPUT, fontFamily: "monospace" }}
              />
              <button
                type="button"
                disabled={procesandoAccion === "sec-01"}
                onClick={() => handleFijarSecuencial("01")}
                className="btn-responsive-accion"
                title="Guardar último número emitido de facturas (01)"
                aria-label="Fijar secuencial de facturas"
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#221E1B",
                  color: "#FFFFFF",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Fijar Secuencial
              </button>
            </div>
          </div>

          {/* Secuencial Notas de Crédito (04) */}
          <div
            style={{
              padding: "12px",
              borderRadius: "12px",
              backgroundColor: "#F8F7F4",
              border: "1px solid #E6E2DA",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1F1C19" }}>
                Notas de Crédito (Código SRI 04)
              </span>
              <span
                style={{
                  fontSize: "0.73rem",
                  fontFamily: "monospace",
                  color: "#57524C",
                  fontWeight: 700,
                }}
              >
                Próxima: {proximoComprobante04}
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                min={0}
                max={999999999}
                value={secNotaCreditoInput}
                onChange={(e) => setSecNotaCreditoInput(e.target.value)}
                aria-label="Último número emitido de notas de crédito"
                style={{ ...ESTILO_INPUT, fontFamily: "monospace" }}
              />
              <button
                type="button"
                disabled={procesandoAccion === "sec-04"}
                onClick={() => handleFijarSecuencial("04")}
                className="btn-responsive-accion"
                title="Guardar último número emitido de notas de crédito (04)"
                aria-label="Fijar secuencial de notas de crédito"
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#221E1B",
                  color: "#FFFFFF",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Fijar Secuencial
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfiguracionFacturacionSri;
