"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  FileText,
  PlusCircle,
  Printer,
  X,
  Building2,
  UserCheck,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import {
  TransaccionPagoCRM,
  ProductoCatalogo,
  ClienteDirectorioFacturacion,
  obtenerHistorialTransaccionesAction,
  obtenerCatalogoProductosAction,
  obtenerClientesParaFacturacionAction,
  registrarPagoManualOperadorAction,
  emitirFacturaDePagoExistenteAction,
} from "../acciones";

interface Props {
  negocio?: string;
  modoVistaForzado?: "cliente" | "operador" | "auto";
}

export function WidgetFacturacionElectronica({ negocio = "tranqi", modoVistaForzado = "auto" }: Props) {
  const [transacciones, setTransacciones] = useState<TransaccionPagoCRM[]>([]);
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([]);
  const [clientesDirectorio, setClientesDirectorio] = useState<ClienteDirectorioFacturacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroMedio, setFiltroMedio] = useState<string>("todos");
  const [rolVistaActiva, setRolVistaActiva] = useState<string>("auto");

  // Modal de visualización de Factura Electrónica (RIDE)
  const [transaccionSeleccionada, setTransaccionSeleccionada] = useState<TransaccionPagoCRM | null>(null);

  // Modal de Registro Manual de Pago + Emisión de Factura (Operador)
  const [modalPagoManualAbierto, setModalPagoManualAbierto] = useState(false);
  const [guardandoPagoManual, setGuardandoPagoManual] = useState(false);
  const [errorPagoManual, setErrorPagoManual] = useState<string | null>(null);
  const [exitoFacturaReciente, setExitoFacturaReciente] = useState< string | null>(null);
  const [emitiendoId, setEmitiendoId] = useState<string | null>(null);

  // Campos del formulario de Pago Manual
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string>("");
  const [tipoIdentificacion, setTipoIdentificacion] = useState<"04" | "05" | "06" | "07">("05");
  const [identificacion, setIdentificacion] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [correoCliente, setCorreoCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [direccionCliente, setDireccionCliente] = useState("Quito - Ecuador");

  const [modoRubro, setModoRubro] = useState<"catalogo" | "personalizado">("catalogo");
  const [varianteSeleccionadaId, setVarianteSeleccionadaId] = useState<string>("");
  const [rubroDescripcion, setRubroDescripcion] = useState("");
  const [codigoRubro, setCodigoRubro] = useState("SERV-001");
  const [subtotalBase, setSubtotalBase] = useState<string>("25.00");
  const [aplicaIva15, setAplicaIva15] = useState<boolean>(true);

  const [medioPagoManual, setMedioPagoManual] = useState<
    "TRANSFERENCIA" | "EFECTIVO" | "DEUNA" | "DEPOSITO" | "TARJETA_POS" | "CHEQUE"
  >("TRANSFERENCIA");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [observacionesPago, setObservacionesPago] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const guardado = window.localStorage.getItem("tranqi_rol_vista_activa");
      if (guardado) setRolVistaActiva(guardado.toLowerCase());
    }
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const vista =
        modoVistaForzado !== "auto"
          ? modoVistaForzado
          : typeof window !== "undefined"
            ? window.localStorage.getItem("tranqi_rol_vista_activa") || "auto"
            : "auto";

      const [hist, prods, clis] = await Promise.all([
        obtenerHistorialTransaccionesAction(negocio, { modoVista: vista }),
        obtenerCatalogoProductosAction(negocio).catch(() => []),
        obtenerClientesParaFacturacionAction(negocio).catch(() => []),
      ]);

      setTransacciones(hist);
      setCatalogo(prods);
      setClientesDirectorio(clis);

      // Preseleccionar primera variante del catálogo si no hay una activa
      if (prods.length > 0 && !varianteSeleccionadaId) {
        const primerProd = prods[0];
        const primeraVar = primerProd?.variantes?.[0];
        if (primerProd && primeraVar) {
          setVarianteSeleccionadaId(primeraVar.var_id);
          setRubroDescripcion(`${primerProd.pro_nombre} — ${primeraVar.var_nombre}`);
          setCodigoRubro(primeraVar.var_sku || "SERV-001");
          setSubtotalBase(Number(primeraVar.var_precio || 25).toFixed(2));
          setAplicaIva15(Number(primeraVar.var_tarifa_iva_porcentaje ?? 15) > 0);
        }
      }
    } catch (err) {
      console.error("Error al cargar datos de facturación:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio, modoVistaForzado]);

  // Lista plana de variantes del catálogo para el selector del Operador
  const opcionesVariantes = useMemo(() => {
    const lista: Array<{
      var_id: string;
      etiqueta: string;
      rubro: string;
      sku: string;
      precioBase: number;
      ivaPorcentaje: number;
      precioTotal: number;
    }> = [];
    for (const p of catalogo) {
      for (const v of p.variantes || []) {
        if (v.var_activo === false) continue;
        const base = Number(v.var_precio || 0);
        const ivaPct = Number(v.var_tarifa_iva_porcentaje ?? 15);
        const total = Math.round(base * (1 + ivaPct / 100) * 100) / 100;
        lista.push({
          var_id: v.var_id,
          etiqueta: `${p.pro_nombre} — ${v.var_nombre} ($${total.toFixed(2)} inc. IVA)`,
          rubro: `${p.pro_nombre} — ${v.var_nombre}`,
          sku: v.var_sku || "SERV-001",
          precioBase: base,
          ivaPorcentaje: ivaPct,
          precioTotal: total,
        });
      }
    }
    return lista;
  }, [catalogo]);

  const alCambiarClienteDirectorio = (usuId: string) => {
    setClienteSeleccionadoId(usuId);
    if (!usuId) return;
    const cli = clientesDirectorio.find((c) => c.usu_id === usuId);
    if (cli) {
      setTipoIdentificacion(cli.tipo_identificacion || "05");
      setIdentificacion(cli.identificacion || "");
      setRazonSocial(cli.razon_social || cli.nombre_completo || "");
      setCorreoCliente(cli.email || "");
      setTelefonoCliente(cli.telefono || "");
      setDireccionCliente(cli.direccion || "Quito - Ecuador");
    }
  };

  const alCambiarVarianteCatalogo = (varId: string) => {
    setVarianteSeleccionadaId(varId);
    const encontrada = opcionesVariantes.find((o) => o.var_id === varId);
    if (encontrada) {
      setRubroDescripcion(encontrada.rubro);
      setCodigoRubro(encontrada.sku);
      setSubtotalBase(encontrada.precioBase.toFixed(2));
      setAplicaIva15(encontrada.ivaPorcentaje > 0);
    }
  };

  // Cálculos en vivo para el modal de registro manual
  const baseNum = Math.max(0, Number(subtotalBase) || 0);
  const ivaNum = aplicaIva15 ? Math.round(baseNum * 15) / 100 : 0;
  const totalNum = Math.round((baseNum + ivaNum) * 100) / 100;

  // KPIs de Valores Generados vs Valores Pagados
  const metricas = useMemo(() => {
    let valoresGeneradosTotal = 0;
    let valoresPagadosTotal = 0;
    let valoresPagadosTarjeta = 0;
    let valoresPagadosOtrosMedios = 0;
    let valoresPendientes = 0;
    let baseImponiblePagada = 0;
    let ivaTotalPagado = 0;
    let cantidadFacturasEmitidas = 0;
    let cantidadPagosAprobados = 0;

    for (const t of transacciones) {
      const monto = Number(t.pag_monto_total || 0);
      if (t.pag_estado !== "RECHAZADO" && t.pag_estado !== "CANCELADO") {
        valoresGeneradosTotal += monto;
      }
      if (t.pag_estado === "APROBADO") {
        valoresPagadosTotal += monto;
        cantidadPagosAprobados += 1;
        const sub =
          Number(t.pag_monto_con_iva || 0) + Number(t.pag_monto_sin_iva || 0) ||
          Math.round((monto / 1.15) * 100) / 100;
        const iva = Number(t.pag_monto_iva || 0) || Math.round((monto - sub) * 100) / 100;
        baseImponiblePagada += sub;
        ivaTotalPagado += iva;

        if (["PLUX", "PAYPHONE", "TARJETA_POS"].includes(String(t.pag_pasarela || "").toUpperCase())) {
          valoresPagadosTarjeta += monto;
        } else {
          valoresPagadosOtrosMedios += monto;
        }
      } else if (t.pag_estado === "PENDIENTE") {
        valoresPendientes += monto;
      }

      if (t.numero_comprobante) {
        cantidadFacturasEmitidas += 1;
      }
    }

    return {
      valoresGeneradosTotal,
      valoresPagadosTotal,
      valoresPagadosTarjeta,
      valoresPagadosOtrosMedios,
      valoresPendientes,
      baseImponiblePagada,
      ivaTotalPagado,
      cantidadFacturasEmitidas,
      cantidadPagosAprobados,
    };
  }, [transacciones]);

  const filtradas = useMemo(() => {
    return transacciones.filter((t) => {
      const q = busqueda.toLowerCase().trim();
      const cumpleBusqueda =
        q === "" ||
        t.pag_identificador_cliente.toLowerCase().includes(q) ||
        (t.numero_comprobante && t.numero_comprobante.toLowerCase().includes(q)) ||
        (t.clave_acceso_sri && t.clave_acceso_sri.toLowerCase().includes(q)) ||
        (t.rubro_facturado && t.rubro_facturado.toLowerCase().includes(q)) ||
        (t.cliente_nombre && t.cliente_nombre.toLowerCase().includes(q)) ||
        (t.pag_autorizacion_codigo && t.pag_autorizacion_codigo.toLowerCase().includes(q)) ||
        (t.pag_titular_email && t.pag_titular_email.toLowerCase().includes(q)) ||
        (t.pag_titular_identificacion && t.pag_titular_identificacion.toLowerCase().includes(q));

      const cumpleEstado = filtroEstado === "todos" || t.pag_estado === filtroEstado;

      const pasarelaUpper = String(t.pag_pasarela || "").toUpperCase();
      const esTarjeta = pasarelaUpper === "PLUX" || pasarelaUpper === "PAYPHONE" || pasarelaUpper === "TARJETA_POS";
      const cumpleMedio =
        filtroMedio === "todos" ||
        (filtroMedio === "TARJETA" && esTarjeta) ||
        (filtroMedio === "MANUAL" && !esTarjeta);

      return cumpleBusqueda && cumpleEstado && cumpleMedio;
    });
  }, [transacciones, busqueda, filtroEstado, filtroMedio]);

  const manejarRegistrarPagoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPagoManual(null);
    setGuardandoPagoManual(true);

    try {
      const res = await registrarPagoManualOperadorAction({
        negocio,
        clienteUsuarioId: clienteSeleccionadoId || null,
        medioPago: medioPagoManual,
        referenciaPago,
        varianteId: modoRubro === "catalogo" ? varianteSeleccionadaId || null : null,
        rubroDescripcion: rubroDescripcion || "Servicio Legal Facturado",
        codigoRubro: codigoRubro || "SERV-001",
        subtotalBase: baseNum,
        aplicaIva15,
        comprador: {
          tipoIdentificacion,
          identificacion: tipoIdentificacion === "07" ? "9999999999999" : identificacion,
          razonSocial: tipoIdentificacion === "07" && !razonSocial ? "CONSUMIDOR FINAL" : razonSocial,
          correo: correoCliente,
          telefono: telefonoCliente,
          direccion: direccionCliente,
        },
        observaciones: observacionesPago,
      });

      if (!res.ok) {
        setErrorPagoManual(res.error || "No se pudo registrar el pago manual.");
        return;
      }

      setModalPagoManualAbierto(false);
      setExitoFacturaReciente(
        `Pago manual registrado y Factura Electrónica ${res.factura?.numero_comprobante || ""} emitida exitosamente.`,
      );
      setReferenciaPago("");
      setObservacionesPago("");
      await cargarDatos();
    } catch (err: any) {
      setErrorPagoManual(err?.message || "Error inesperado al procesar el registro.");
    } finally {
      setGuardandoPagoManual(false);
    }
  };

  const manejarEmitirManualExistente = async (pagId: string) => {
    setEmitiendoId(pagId);
    try {
      const res = await emitirFacturaDePagoExistenteAction({ negocio, pagId });
      if (res.ok) {
        setExitoFacturaReciente(
          `Factura Electrónica ${res.factura?.numero_comprobante || ""} emitida correctamente.`,
        );
        await cargarDatos();
      }
    } finally {
      setEmitiendoId(null);
    }
  };

  const formatearEtiquetaMedio = (t: TransaccionPagoCRM) => {
    const p = String(t.pag_pasarela || "").toUpperCase();
    if (p === "PLUX" || p === "PAYPHONE") {
      return {
        titulo: `Tarjeta (${p})`,
        subtitulo: t.pag_tarjeta_marca
          ? `${t.pag_tarjeta_marca} •••• ${t.pag_tarjeta_ultimos_digitos || ""}`
          : "Emisión Automática",
        esAutomatica: true,
        colorBg: "#EFF6FF",
        colorText: "#1D4ED8",
      };
    }
    if (p === "TRANSFERENCIA") {
      return {
        titulo: "Transferencia Bancaria",
        subtitulo: "Registro Operador",
        esAutomatica: false,
        colorBg: "#F0FDFA",
        colorText: "#0F766E",
      };
    }
    if (p === "EFECTIVO") {
      return {
        titulo: "Efectivo en Caja",
        subtitulo: "Registro Operador",
        esAutomatica: false,
        colorBg: "#FEF3C7",
        colorText: "#B45309",
      };
    }
    if (p === "DEUNA") {
      return {
        titulo: "Deuna! / QR",
        subtitulo: "Registro Operador",
        esAutomatica: false,
        colorBg: "#F3E8FF",
        colorText: "#6D28D9",
      };
    }
    return {
      titulo: p,
      subtitulo: t.pag_detalle_transaccion?.registro_manual ? "Registro Operador" : "Pasarela",
      esAutomatica: !t.pag_detalle_transaccion?.registro_manual,
      colorBg: "#F1F5F9",
      colorText: "#334155",
    };
  };

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case "APROBADO":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.73rem",
              fontWeight: 700,
              background: "#D1FAE5",
              color: "#065F46",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <CheckCircle2 size={13} />
            Pagado
          </span>
        );
      case "RECHAZADO":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.73rem",
              fontWeight: 700,
              background: "#FEE2E2",
              color: "#991B1B",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <XCircle size={13} />
            Rechazado
          </span>
        );
      case "PENDIENTE":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.73rem",
              fontWeight: 700,
              background: "#FEF3C7",
              color: "#92400E",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Clock size={13} />
            Pendiente
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.73rem",
              fontWeight: 700,
              background: "#F1F5F9",
              color: "#475569",
            }}
          >
            {estado}
          </span>
        );
    }
  };

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Cabecera Principal */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                background: "#EDE9FE",
                color: "#5B21B6",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.73rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Receipt size={13} />
              FACTURACIÓN ELECTRÓNICA SRI & LIQUIDACIÓN
            </span>
            <span
              style={{
                background: "#DCFCE7",
                color: "#166534",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.72rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={12} />
              Emisión Automática con Tarjeta Activa
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0F172A" }}>
            Facturación, Comprobantes Electrónicos e Historial de Pagos
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Control de valores generados y valores pagados, detalle del rubro facturado y emisión automática o manual de facturas electrónicas.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setErrorPagoManual(null);
              setModalPagoManualAbierto(true);
            }}
            className="btn-responsive-accion"
            title="Registrar pago manual (transferencia, efectivo, Deuna) y emitir factura electrónica"
            aria-label="Registrar pago manual y emitir factura electrónica"
            style={{
              background: "linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)",
              color: "#FFFFFF",
              border: "none",
              padding: "9px 16px",
              borderRadius: "10px",
              fontSize: "0.84rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
            }}
          >
            <PlusCircle size={16} />
            <span className="btn-texto-responsive">Registrar Pago</span>
          </button>

          <button
            type="button"
            onClick={cargarDatos}
            className="btn-responsive-accion"
            title="Actualizar listado de facturación y pagos"
            aria-label="Actualizar listado de facturación y pagos"
            style={{
              background: "#F8FAFC",
              color: "#334155",
              border: "1px solid #CBD5E1",
              padding: "9px 14px",
              borderRadius: "10px",
              fontSize: "0.84rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={15} />
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Banner de confirmación reciente */}
      {exitoFacturaReciente && (
        <div
          style={{
            background: "#ECFDF5",
            border: "1px solid #6EE7B7",
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            color: "#065F46",
            fontSize: "0.86rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{exitoFacturaReciente}</span>
          </div>
          <button
            type="button"
            onClick={() => setExitoFacturaReciente(null)}
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
            style={{
              background: "transparent",
              border: "none",
              color: "#047857",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tarjetas KPI: Valores Generados vs Valores Pagados */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* KPI 1: Valores Generados */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              Valores Generados (Facturado)
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.55rem", fontWeight: 800, color: "#0F172A" }}>
            ${metricas.valoresGeneradosTotal.toFixed(2)}{" "}
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748B" }}>USD</span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.76rem", color: "#475569" }}>
            Subtotal Base: <strong>${metricas.baseImponiblePagada.toFixed(2)}</strong> · IVA 15%:{" "}
            <strong>${metricas.ivaTotalPagado.toFixed(2)}</strong>
          </div>
        </div>

        {/* KPI 2: Valores Pagados */}
        <div
          style={{
            background: "linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 100%)",
            border: "1px solid #A7F3D0",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: "0 1px 3px rgba(5, 150, 105, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#065F46", textTransform: "uppercase" }}>
              Valores Pagados (Recaudado)
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "#D1FAE5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.55rem", fontWeight: 800, color: "#065F46" }}>
            ${metricas.valoresPagadosTotal.toFixed(2)}{" "}
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#047857" }}>USD</span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.76rem", color: "#047857" }}>
            {metricas.cantidadPagosAprobados} pago(s) liquidado(s) · Pendiente:{" "}
            <strong>${metricas.valoresPendientes.toFixed(2)}</strong>
          </div>
        </div>

        {/* KPI 3: Desglose por Medio de Pago */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              Tarjeta vs. Otros Medios
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={17} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748B" }}>Tarjeta Crédito/Débito</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1D4ED8" }}>
                ${metricas.valoresPagadosTarjeta.toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748B" }}>Transferencia / Efectivo</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0F766E" }}>
                ${metricas.valoresPagadosOtrosMedios.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.74rem", color: "#64748B" }}>
            Ambos canales emiten factura electrónica SRI
          </div>
        </div>

        {/* KPI 4: Comprobantes Electrónicos Emitidos */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              Comprobantes SRI Emitidos
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "#F5F3FF",
                color: "#7C3AED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.55rem", fontWeight: 800, color: "#0F172A" }}>
            {metricas.cantidadFacturasEmitidas}{" "}
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#64748B" }}>Facturas (001-001)</span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "#5B21B6", fontWeight: 600 }}>
            Clave de acceso de 49 dígitos verificada
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "14px 16px",
          marginBottom: "18px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "10px" }} />
          <input
            type="text"
            placeholder="Buscar por N° de factura (001-001-...), rubro facturado, cliente, cédula/RUC o referencia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.84rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: "todos", label: "Todos los Medios" },
            { id: "TARJETA", label: "Tarjeta Crédito/Débito" },
            { id: "MANUAL", label: "Transferencia / Efectivo" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFiltroMedio(m.id)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                borderColor: filtroMedio === m.id ? "#4F46E5" : "#E2E8F0",
                background: filtroMedio === m.id ? "#EEF2FF" : "#F8FAFC",
                color: filtroMedio === m.id ? "#4338CA" : "#475569",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["todos", "APROBADO", "PENDIENTE", "RECHAZADO"].map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: filtroEstado === est ? "#0F172A" : "#F1F5F9",
                color: filtroEstado === est ? "#FFFFFF" : "#475569",
              }}
            >
              {est === "todos" ? "Todos" : est === "APROBADO" ? "Pagados" : est}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla Principal de Facturación y Pagos */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {cargando ? (
          <div style={{ padding: "50px 20px", textAlign: "center", color: "#64748B" }}>
            <RefreshCw size={26} style={{ margin: "0 auto 10px" }} />
            <div>Cargando comprobantes electrónicos e historial de pagos...</div>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <Receipt size={40} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0F172A" }}>
              No se encontraron comprobantes ni pagos con este filtro
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748B" }}>
              Las facturas electrónicas se emiten automáticamente al pagar con tarjeta o al registrar un pago manual.
            </p>
            <button
              type="button"
              onClick={() => setModalPagoManualAbierto(true)}
              className="btn-responsive-accion"
              title="Registrar un pago manual y emitir su factura electrónica"
              aria-label="Registrar un pago manual y emitir su factura electrónica"
              style={{
                background: "#4F46E5",
                color: "#FFFFFF",
                border: "none",
                padding: "9px 16px",
                borderRadius: "10px",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <PlusCircle size={15} />
              <span className="btn-texto-responsive">Registrar Pago</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.83rem" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>N° Factura Electrónica</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Fecha</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Detalle del Rubro Facturado</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Cliente / Adquirente</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Medio de Pago</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Subtotal / IVA</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Valor Pagado</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Estado</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, textAlign: "right" }}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => {
                  const infoMedio = formatearEtiquetaMedio(t);
                  const montoTotal = Number(t.pag_monto_total || 0);
                  const subtotal =
                    Number(t.factura_electronica?.subtotal) ||
                    Number(t.pag_monto_con_iva || 0) + Number(t.pag_monto_sin_iva || 0) ||
                    Math.round((montoTotal / 1.15) * 100) / 100;
                  const iva =
                    Number(t.factura_electronica?.iva) ||
                    Number(t.pag_monto_iva || 0) ||
                    Math.round((montoTotal - subtotal) * 100) / 100;

                  return (
                    <tr
                      key={t.pag_id}
                      style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.1s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Columna 1: N° Comprobante Electrónico */}
                      <td style={{ padding: "13px 14px" }}>
                        {t.numero_comprobante ? (
                          <div>
                            <div
                              style={{
                                fontFamily: "monospace",
                                fontWeight: 800,
                                fontSize: "0.85rem",
                                color: "#4338CA",
                                background: "#EEF2FF",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                display: "inline-block",
                              }}
                            >
                              {t.numero_comprobante}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#64748B", marginTop: "3px" }}>
                              SRI: {t.estado_factura || "AUTORIZADO"}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.76rem", color: "#94A3B8" }}>Sin emitir</span>
                        )}
                      </td>

                      {/* Columna 2: Fecha */}
                      <td style={{ padding: "13px 14px", color: "#475569", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600 }}>
                          {new Date(t.pag_confirmado_en || t.pag_creado_en).toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                          {new Date(t.pag_confirmado_en || t.pag_creado_en).toLocaleTimeString("es-EC", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Columna 3: Detalle del Rubro Facturado */}
                      <td style={{ padding: "13px 14px", maxWidth: "260px" }}>
                        <div style={{ fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>
                          {t.rubro_facturado || "Servicio Legal Facturado"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "2px", fontFamily: "monospace" }}>
                          Tx: {t.pag_identificador_cliente}
                        </div>
                      </td>

                      {/* Columna 4: Cliente / Adquirente */}
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A" }}>
                          {t.cliente_nombre || t.pag_titular_email || "Cliente"}
                        </div>
                        <div style={{ fontSize: "0.73rem", color: "#64748B" }}>
                          ID: {t.pag_titular_identificacion || "9999999999999"}
                        </div>
                      </td>

                      {/* Columna 5: Medio de Pago */}
                      <td style={{ padding: "13px 14px" }}>
                        <span
                          style={{
                            background: infoMedio.colorBg,
                            color: infoMedio.colorText,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            display: "inline-block",
                          }}
                        >
                          {infoMedio.titulo}
                        </span>
                        <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "3px" }}>
                          {infoMedio.subtitulo}
                          {t.pag_autorizacion_codigo ? ` · Ref: ${t.pag_autorizacion_codigo}` : ""}
                        </div>
                      </td>

                      {/* Columna 6: Subtotal / IVA */}
                      <td style={{ padding: "13px 14px", color: "#475569", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: "0.78rem" }}>Base: ${subtotal.toFixed(2)}</div>
                        <div style={{ fontSize: "0.73rem", color: "#64748B" }}>IVA 15%: ${iva.toFixed(2)}</div>
                      </td>

                      {/* Columna 7: Valor Total Pagado */}
                      <td style={{ padding: "13px 14px", fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>
                        ${montoTotal.toFixed(2)} USD
                      </td>

                      {/* Columna 8: Estado */}
                      <td style={{ padding: "13px 14px" }}>{getBadgeEstado(t.pag_estado)}</td>

                      {/* Columna 9: Acciones */}
                      <td style={{ padding: "13px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {t.numero_comprobante ? (
                          <button
                            type="button"
                            onClick={() => setTransaccionSeleccionada(t)}
                            className="btn-responsive-accion"
                            title="Ver e imprimir Factura Electrónica RIDE"
                            aria-label="Ver Factura Electrónica"
                            style={{
                              background: "#EEF2FF",
                              color: "#4338CA",
                              border: "1px solid #C7D2FE",
                              padding: "6px 11px",
                              borderRadius: "8px",
                              fontSize: "0.76rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <FileText size={14} />
                            <span className="btn-texto-responsive">Ver Factura</span>
                          </button>
                        ) : t.pag_estado === "APROBADO" ? (
                          <button
                            type="button"
                            disabled={emitiendoId === t.pag_id}
                            onClick={() => manejarEmitirManualExistente(t.pag_id)}
                            className="btn-responsive-accion"
                            title="Emitir Factura Electrónica SRI para este pago"
                            aria-label="Emitir Factura Electrónica"
                            style={{
                              background: "#059669",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "6px 11px",
                              borderRadius: "8px",
                              fontSize: "0.76rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <Receipt size={14} />
                            <span className="btn-texto-responsive">
                              {emitiendoId === t.pag_id ? "Emitiendo..." : "Emitir Factura"}
                            </span>
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.74rem", color: "#94A3B8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===========================================================================
          MODAL 1: REGISTRAR PAGO MANUAL (OPERADOR) Y EMITIR FACTURA ELECTRÓNICA
         =========================================================================== */}
      {modalPagoManualAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.3)",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Cabecera del Modal */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC",
              }}
            >
              <div>
                <div style={{ fontSize: "0.73rem", fontWeight: 800, color: "#4F46E5", textTransform: "uppercase" }}>
                  Operación de Caja & Facturación SRI
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#0F172A" }}>
                  Registrar Pago Manual y Emitir Factura Electrónica
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalPagoManualAbierto(false)}
                title="Cerrar ventana"
                aria-label="Cerrar ventana"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={manejarRegistrarPagoManual} style={{ padding: "20px 22px" }}>
              {errorPagoManual && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "0.83rem",
                    fontWeight: 600,
                    marginBottom: "16px",
                  }}
                >
                  {errorPagoManual}
                </div>
              )}

              {/* Sección 1: Datos del Cliente a Facturar */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    color: "#1E293B",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <UserCheck size={15} color="#4F46E5" />
                  1. Datos del Cliente / Adquirente para la Factura Electrónica
                </div>

                {clientesDirectorio.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Autocompletar desde Clientes Registrados (Opcional)
                    </label>
                    <select
                      value={clienteSeleccionadoId}
                      onChange={(e) => alCambiarClienteDirectorio(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        background: "#FFFFFF",
                      }}
                    >
                      <option value="">— Ingresar nuevo cliente manualmente —</option>
                      {clientesDirectorio.map((c) => (
                        <option key={c.usu_id} value={c.usu_id}>
                          {c.nombre_completo} ({c.email}) {c.identificacion ? `· ID: ${c.identificacion}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Tipo de Identificación *
                    </label>
                    <select
                      value={tipoIdentificacion}
                      onChange={(e) => setTipoIdentificacion(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        background: "#FFFFFF",
                      }}
                    >
                      <option value="05">Cédula (05)</option>
                      <option value="04">RUC (04)</option>
                      <option value="06">Pasaporte / ID Exterior (06)</option>
                      <option value="07">Consumidor Final (07)</option>
                    </select>
                  </div>

                  {tipoIdentificacion !== "07" && (
                    <div>
                      <label
                        style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                      >
                        Número Cédula / RUC *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1712345678001"
                        value={identificacion}
                        onChange={(e) => setIdentificacion(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.83rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Nombres Completos o Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre o Razón Social del cliente"
                      value={razonSocial}
                      onChange={(e) => setRazonSocial(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Correo para envío de Factura *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="cliente@correo.com"
                      value={correoCliente}
                      onChange={(e) => setCorreoCliente(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Teléfono
                    </label>
                    <input
                      type="text"
                      placeholder="0999999999"
                      value={telefonoCliente}
                      onChange={(e) => setTelefonoCliente(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Detalle del Rubro Facturado */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      color: "#1E293B",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Receipt size={15} color="#4F46E5" />
                    2. Detalle del Rubro Facturado y Valores
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setModoRubro("catalogo")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: modoRubro === "catalogo" ? "#4F46E5" : "#E2E8F0",
                        color: modoRubro === "catalogo" ? "#FFFFFF" : "#475569",
                      }}
                    >
                      Del Catálogo
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoRubro("personalizado")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: modoRubro === "personalizado" ? "#4F46E5" : "#E2E8F0",
                        color: modoRubro === "personalizado" ? "#FFFFFF" : "#475569",
                      }}
                    >
                      Rubro Libre
                    </button>
                  </div>
                </div>

                {modoRubro === "catalogo" && opcionesVariantes.length > 0 && (
                  <div style={{ marginBottom: "10px" }}>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Seleccionar Producto / Servicio del Catálogo
                    </label>
                    <select
                      value={varianteSeleccionadaId}
                      onChange={(e) => alCambiarVarianteCatalogo(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        background: "#FFFFFF",
                      }}
                    >
                      {opcionesVariantes.map((op) => (
                        <option key={op.var_id} value={op.var_id}>
                          {op.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Descripción del Rubro en la Factura *
                    </label>
                    <input
                      type="text"
                      required
                      value={rubroDescripcion}
                      onChange={(e) => setRubroDescripcion(e.target.value)}
                      placeholder="Ej: Consulta Jurídica — Consulta Presencial con Especialista"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Subtotal Base (USD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={subtotalBase}
                      onChange={(e) => setSubtotalBase(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={aplicaIva15}
                      onChange={(e) => setAplicaIva15(e.target.checked)}
                    />
                    Aplicar IVA 15% (Tarifa vigente SRI)
                  </label>

                  <div style={{ fontSize: "0.83rem", color: "#0F172A" }}>
                    Subtotal: <strong>${baseNum.toFixed(2)}</strong> · IVA 15%: <strong>${ivaNum.toFixed(2)}</strong> ·{" "}
                    <span style={{ color: "#4F46E5", fontWeight: 800 }}>Total a Facturar: ${totalNum.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Sección 3: Medio de Pago Recibido */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    color: "#1E293B",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Wallet size={15} color="#4F46E5" />
                  3. Medio de Pago y Referencia de Recaudación
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Medio de Pago *
                    </label>
                    <select
                      value={medioPagoManual}
                      onChange={(e) => setMedioPagoManual(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        background: "#FFFFFF",
                      }}
                    >
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="EFECTIVO">Efectivo en Oficina</option>
                      <option value="DEUNA">Deuna! / Pago QR</option>
                      <option value="DEPOSITO">Depósito Bancario</option>
                      <option value="TARJETA_POS">Datafast / POS Físico</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      N° Comprobante / Referencia del Pago
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: N° transferencia o recibo"
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.83rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Pie del Modal */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setModalPagoManualAbierto(false)}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "1px solid #CBD5E1",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPagoManual}
                  className="btn-responsive-accion"
                  title="Guardar pago manual y emitir automáticamente la factura electrónica"
                  aria-label="Registrar y Facturar"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "10px",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: guardandoPagoManual ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                  }}
                >
                  <Receipt size={16} />
                  <span>{guardandoPagoManual ? "Emitiendo Factura..." : "Registrar y Facturar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===========================================================================
          MODAL 2: RIDE DE FACTURA ELECTRÓNICA SRI (VISTA E IMPRESIÓN)
         =========================================================================== */}
      {transaccionSeleccionada && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "660px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.3)",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Cabecera RIDE */}
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0F172A",
                color: "#FFFFFF",
              }}
            >
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#93C5FD", textTransform: "uppercase" }}>
                  Representación Impresa de Comprobante Electrónico (RIDE - SRI)
                </div>
                <h3 style={{ margin: "2px 0 0", fontSize: "1.1rem", fontWeight: 800 }}>
                  FACTURA ELECTRÓNICA N° {transaccionSeleccionada.numero_comprobante}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => typeof window !== "undefined" && window.print()}
                  className="btn-responsive-accion"
                  title="Imprimir o guardar en PDF esta Factura Electrónica"
                  aria-label="Imprimir RIDE"
                  style={{
                    background: "#3B82F6",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Printer size={14} />
                  <span className="btn-texto-responsive">Imprimir PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransaccionSeleccionada(null)}
                  title="Cerrar comprobante"
                  aria-label="Cerrar comprobante"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px",
                    cursor: "pointer",
                    color: "#FFFFFF",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Cuerpo del Comprobante Electrónico */}
            <div style={{ padding: "22px" }}>
              {/* Datos del Emisor y Autorización SRI */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "14px",
                    background: "#F8FAFC",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0F172A", marginBottom: "4px" }}>
                    {negocio === "fastfix"
                      ? "FASTFIX HOME SERVICIOS S.A.S."
                      : negocio === "tinkay"
                        ? "TINKAY FLORISTERIA S.A.S."
                        : negocio === "margaritas"
                          ? "MARGARITAS FLORISTERIA S.A.S."
                          : "TRANQI LEGAL S.A.S."}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.5 }}>
                    <div>
                      <strong>RUC:</strong> 1790016919001
                    </div>
                    <div>
                      <strong>Matriz:</strong> Av. República del Salvador y Moscú, Quito - Ecuador
                    </div>
                    <div>
                      <strong>Obligado a llevar Contabilidad:</strong> SÍ
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #C7D2FE",
                    borderRadius: "12px",
                    padding: "14px",
                    background: "#EEF2FF",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#3730A3" }}>
                    ESTADO SRI: {transaccionSeleccionada.estado_factura || "AUTORIZADO"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#1E1B4B", marginTop: "6px", lineHeight: 1.45 }}>
                    <div>
                      <strong>Ambiente:</strong>{" "}
                      {transaccionSeleccionada.factura_electronica?.ambiente === 2 ? "PRODUCCIÓN" : "PRUEBAS / CERTIFICADO"}
                    </div>
                    <div>
                      <strong>Fecha Emisión:</strong>{" "}
                      {transaccionSeleccionada.fecha_emision_factura ||
                        new Date(transaccionSeleccionada.pag_creado_en).toLocaleDateString("es-EC")}
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <strong>Clave de Acceso (49 dígitos):</strong>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.68rem",
                          wordBreak: "break-all",
                          background: "#FFFFFF",
                          padding: "4px 6px",
                          borderRadius: "6px",
                          marginTop: "2px",
                          border: "1px solid #C7D2FE",
                        }}
                      >
                        {transaccionSeleccionada.clave_acceso_sri}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datos del Adquirente / Cliente */}
              <div
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  fontSize: "0.8rem",
                  color: "#334155",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "8px",
                }}
              >
                <div>
                  <strong>Razón Social / Comprador:</strong>{" "}
                  {transaccionSeleccionada.cliente_nombre || "CONSUMIDOR FINAL"}
                </div>
                <div>
                  <strong>Identificación (RUC/C.I.):</strong>{" "}
                  {transaccionSeleccionada.pag_titular_identificacion || "9999999999999"}
                </div>
                <div>
                  <strong>Correo Electrónico:</strong> {transaccionSeleccionada.pag_titular_email || "—"}
                </div>
                <div>
                  <strong>Medio de Pago:</strong> {transaccionSeleccionada.pag_pasarela} (Ref:{" "}
                  {transaccionSeleccionada.pag_autorizacion_codigo || transaccionSeleccionada.pag_identificador_cliente})
                </div>
              </div>

              {/* Tabla del Detalle del Rubro Facturado */}
              <div
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  overflow: "hidden",
                  marginBottom: "16px",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", color: "#334155", borderBottom: "1px solid #E2E8F0" }}>
                      <th style={{ padding: "10px 12px" }}>Código</th>
                      <th style={{ padding: "10px 12px" }}>Cant.</th>
                      <th style={{ padding: "10px 12px" }}>Detalle del Rubro Facturado</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>P. Unitario</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const total = Number(transaccionSeleccionada.pag_monto_total || 0);
                      const sub =
                        Number(transaccionSeleccionada.factura_electronica?.subtotal) ||
                        Number(transaccionSeleccionada.pag_monto_con_iva || 0) +
                          Number(transaccionSeleccionada.pag_monto_sin_iva || 0) ||
                        Math.round((total / 1.15) * 100) / 100;
                      return (
                        <tr>
                          <td style={{ padding: "12px", fontFamily: "monospace" }}>
                            {transaccionSeleccionada.factura_electronica?.codigo_rubro || "SERV-001"}
                          </td>
                          <td style={{ padding: "12px" }}>1.00</td>
                          <td style={{ padding: "12px", fontWeight: 700, color: "#0F172A" }}>
                            {transaccionSeleccionada.rubro_facturado}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right" }}>${sub.toFixed(2)}</td>
                          <td style={{ padding: "12px", textAlign: "right", fontWeight: 700 }}>${sub.toFixed(2)}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Resumen de Totales SRI */}
              {(() => {
                const total = Number(transaccionSeleccionada.pag_monto_total || 0);
                const sub =
                  Number(transaccionSeleccionada.factura_electronica?.subtotal) ||
                  Number(transaccionSeleccionada.pag_monto_con_iva || 0) +
                    Number(transaccionSeleccionada.pag_monto_sin_iva || 0) ||
                  Math.round((total / 1.15) * 100) / 100;
                const iva =
                  Number(transaccionSeleccionada.factura_electronica?.iva) ||
                  Number(transaccionSeleccionada.pag_monto_iva || 0) ||
                  Math.round((total - sub) * 100) / 100;

                return (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        width: "260px",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        background: "#F8FAFC",
                        fontSize: "0.82rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ color: "#475569" }}>Subtotal 15%:</span>
                        <strong>${sub.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ color: "#475569" }}>IVA 15%:</span>
                        <strong>${iva.toFixed(2)}</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingTop: "8px",
                          borderTop: "1px solid #CBD5E1",
                          fontSize: "0.95rem",
                          fontWeight: 800,
                          color: "#0F172A",
                        }}
                      >
                        <span>VALOR TOTAL:</span>
                        <span>${total.toFixed(2)} USD</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

