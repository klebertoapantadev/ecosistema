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
  Download,
  X,
  Building2,
  UserCheck,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Wallet,
  ArrowUpRight,
  Briefcase,
  Calendar,
  FolderOpen,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Eye,
  User,
} from "lucide-react";
import {
  TransaccionPagoCRM,
  ProductoCatalogo,
  ClienteDirectorioFacturacion,
  ExpedienteCliente360,
  obtenerHistorialTransaccionesAction,
  obtenerCatalogoProductosAction,
  obtenerClientesParaFacturacionAction,
  obtenerExpedienteCliente360Action,
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

  // Modal de Análisis 360° del Cliente
  const [modal360Abierto, setModal360Abierto] = useState(false);
  const [cargando360, setCargando360] = useState(false);
  const [expediente360, setExpediente360] = useState<ExpedienteCliente360 | null>(null);
  const [pestana360, setPestana360] = useState<"resumen" | "casos" | "reuniones" | "pagos" | "documentos">("resumen");

  const abrirAnalisisCliente360 = async (t: TransaccionPagoCRM) => {
    setModal360Abierto(true);
    setCargando360(true);
    setPestana360("resumen");
    try {
      const res = await obtenerExpedienteCliente360Action({
        negocio,
        clienteId: t.pag_cliente_id || null,
        email: t.pag_titular_email || t.factura_electronica?.comprador?.correo || null,
        identificacion: t.pag_titular_identificacion || t.factura_electronica?.comprador?.identificacion || null,
        nombre: t.cliente_nombre || t.factura_electronica?.comprador?.razon_social || null,
      });
      if (res.ok && res.data) {
        setExpediente360(res.data);
      }
    } catch (err) {
      console.error("Error al abrir expediente 360 del cliente:", err);
    } finally {
      setCargando360(false);
    }
  };

  const abrirPagoManualParaCliente360 = (exp: ExpedienteCliente360) => {
    setModal360Abierto(false);
    setClienteSeleccionadoId(exp.cliente.usu_id || "");
    const idLimpia = exp.cliente.identificacion || "";
    setTipoIdentificacion(idLimpia.length === 13 ? "04" : idLimpia.length === 10 ? "05" : "05");
    setIdentificacion(idLimpia !== "9999999999999" ? idLimpia : "");
    setRazonSocial(exp.cliente.razon_social || exp.cliente.nombre_completo || "");
    setCorreoCliente(exp.cliente.correo || "");
    setTelefonoCliente(exp.cliente.whatsapp || "");
    setDireccionCliente(exp.cliente.direccion_fiscal || "Quito - Ecuador");
    setErrorPagoManual(null);
    setModalPagoManualAbierto(true);
  };

  const resolverModoVista = (): string => {
    if (modoVistaForzado !== "auto") return modoVistaForzado;
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const modoUrl = params.get("modo");
        if (modoUrl && modoUrl.trim()) return modoUrl.trim().toLowerCase();
        const cookieStr = document.cookie || "";
        const matchModo = cookieStr.match(/tranqi_modo_rol=([^;]+)/);
        if (matchModo && matchModo[1]) return decodeURIComponent(matchModo[1]).trim().toLowerCase();
        const matchFav = cookieStr.match(/tranqi_rol_favorito=([^;]+)/);
        if (matchFav && matchFav[1]) return decodeURIComponent(matchFav[1]).trim().toLowerCase();
        const guardado = window.localStorage.getItem("tranqi_rol_vista_activa");
        if (guardado) return guardado.toLowerCase();
      } catch {
        // Ignorar errores de acceso a cookies/storage
      }
    }
    return "auto";
  };

  useEffect(() => {
    setRolVistaActiva(resolverModoVista());
  }, [modoVistaForzado]);

  const esVistaCliente = rolVistaActiva === "cliente" || modoVistaForzado === "cliente";

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const vista = resolverModoVista();
      setRolVistaActiva(vista);

      const [hist, prods, clis] = await Promise.all([
        obtenerHistorialTransaccionesAction(negocio, {
          modoVista: vista,
          soloClienteActual: vista === "cliente",
        }),
        obtenerCatalogoProductosAction(negocio).catch(() => []),
        vista === "cliente"
          ? Promise.resolve([] as ClienteDirectorioFacturacion[])
          : obtenerClientesParaFacturacionAction(negocio).catch(() => []),
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

  const construirHtmlFacturaRide = (t: TransaccionPagoCRM): string => {
    const montoTotal = Number(t.pag_monto_total || 0);
    const subtotal =
      Number(t.factura_electronica?.subtotal) ||
      Number(t.pag_monto_con_iva || 0) + Number(t.pag_monto_sin_iva || 0) ||
      Math.round((montoTotal / 1.15) * 100) / 100;
    const iva =
      Number(t.factura_electronica?.iva) ||
      Number(t.pag_monto_iva || 0) ||
      Math.round((montoTotal - subtotal) * 100) / 100;
    const razonEmisor =
      negocio === "fastfix"
        ? "FASTFIX HOME SERVICIOS S.A.S."
        : negocio === "tinkay"
          ? "TINKAY FLORISTERIA S.A.S."
          : negocio === "margaritas"
            ? "MARGARITAS FLORISTERIA S.A.S."
            : "TRANQI LEGAL S.A.S.";
    const numComp = t.numero_comprobante || "001-001-000000101";
    const claveSri = t.clave_acceso_sri || "0911202601179001691900110010010000001011234567819";
    const fechaEmision =
      t.fecha_emision_factura ||
      new Date(t.pag_confirmado_en || t.pag_creado_en).toLocaleDateString("es-EC");
    const compradorNombre =
      t.factura_electronica?.comprador?.razon_social ||
      t.cliente_nombre ||
      t.pag_titular_email ||
      "CONSUMIDOR FINAL";
    const compradorId =
      t.factura_electronica?.comprador?.identificacion ||
      t.pag_titular_identificacion ||
      "9999999999999";
    const compradorCorreo =
      t.factura_electronica?.comprador?.correo || t.pag_titular_email || "";
    const compradorDir =
      t.factura_electronica?.comprador?.direccion || "Quito - Ecuador";
    const rubro = t.rubro_facturado || "Servicio Legal Facturado";
    const infoMedio = formatearEtiquetaMedio(t);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura Electrónica ${numComp} - ${razonEmisor}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0F172A; margin: 0; padding: 24px; background: #FFFFFF; }
    .contenedor { max-width: 760px; margin: 0 auto; border: 1px solid #CBD5E1; border-radius: 14px; padding: 24px; }
    .cabecera { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 16px; }
    .caja { border: 1px solid #CBD5E1; border-radius: 10px; padding: 14px; flex: 1; }
    .caja-sri { background: #EEF2FF; border-color: #C7D2FE; }
    h1 { font-size: 18px; margin: 0 0 6px; color: #0F172A; }
    h2 { font-size: 15px; margin: 0 0 6px; color: #3730A3; }
    .meta { font-size: 12px; color: #334155; line-height: 1.5; }
    .clave { font-family: monospace; font-size: 11px; background: #FFFFFF; border: 1px solid #C7D2FE; padding: 6px; border-radius: 6px; word-break: break-all; margin-top: 4px; }
    .comprador { border: 1px solid #CBD5E1; border-radius: 10px; padding: 14px; margin-bottom: 16px; background: #F8FAFC; font-size: 12px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { background: #0F172A; color: #FFFFFF; text-align: left; padding: 10px; }
    td { padding: 10px; border-bottom: 1px solid #E2E8F0; }
    .totales { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .totales-tabla { width: 280px; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden; }
    .fila-total { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #E2E8F0; }
    .fila-total.final { background: #0F172A; color: #FFFFFF; font-weight: 800; font-size: 14px; border-bottom: none; }
    .acciones-no-print { text-align: right; margin-bottom: 14px; }
    .btn-print { background: #4F46E5; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print { .acciones-no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="acciones-no-print">
    <button class="btn-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>
  <div class="contenedor">
    <div class="cabecera">
      <div class="caja">
        <h1>${razonEmisor}</h1>
        <div class="meta">
          <div><strong>RUC:</strong> 1790016919001</div>
          <div><strong>Dirección Matriz:</strong> Av. República del Salvador y Moscú, Quito - Ecuador</div>
          <div><strong>Obligado a llevar Contabilidad:</strong> SÍ</div>
        </div>
      </div>
      <div class="caja caja-sri">
        <h2>FACTURA ELECTRÓNICA N° ${numComp}</h2>
        <div class="meta">
          <div><strong>Estado SRI:</strong> ${t.estado_factura || "AUTORIZADO"}</div>
          <div><strong>Fecha de Emisión:</strong> ${fechaEmision}</div>
          <div><strong>Ambiente:</strong> ${t.factura_electronica?.ambiente === 2 ? "PRODUCCIÓN" : "CERTIFICADO SRI"}</div>
          <div><strong>Clave de Acceso (49 dígitos):</strong></div>
          <div class="clave">${claveSri}</div>
        </div>
      </div>
    </div>

    <div class="comprador">
      <div><strong>Razón Social / Nombres y Apellidos:</strong> ${compradorNombre}</div>
      <div><strong>Identificación (RUC / Cédula):</strong> ${compradorId} &nbsp;|&nbsp; <strong>Correo:</strong> ${compradorCorreo}</div>
      <div><strong>Dirección:</strong> ${compradorDir} &nbsp;|&nbsp; <strong>Referencia Transacción:</strong> ${t.pag_identificador_cliente}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Cant.</th>
          <th>Descripción del Rubro Facturado</th>
          <th style="text-align:right">P. Unitario</th>
          <th style="text-align:right">Total sin Imp.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-family:monospace">SERV-001</td>
          <td>1.00</td>
          <td><strong>${rubro}</strong></td>
          <td style="text-align:right">$${subtotal.toFixed(2)}</td>
          <td style="text-align:right"><strong>$${subtotal.toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="totales">
      <div class="caja" style="max-width:360px">
        <div class="meta">
          <div><strong>Forma de Pago SRI:</strong> ${infoMedio.esAutomatica ? "20 - Tarjeta de Crédito / Débito" : "20 - Otros con utilización del sistema financiero"}</div>
          <div><strong>Medio Registrado:</strong> ${infoMedio.titulo} (${infoMedio.subtitulo})</div>
          ${t.pag_autorizacion_codigo ? `<div><strong>Código de Autorización:</strong> ${t.pag_autorizacion_codigo}</div>` : ""}
        </div>
      </div>
      <div class="totales-tabla">
        <div class="fila-total"><span>Subtotal 15%:</span><strong>$${subtotal.toFixed(2)}</strong></div>
        <div class="fila-total"><span>Subtotal 0%:</span><strong>$0.00</strong></div>
        <div class="fila-total"><span>IVA 15%:</span><strong>$${iva.toFixed(2)}</strong></div>
        <div class="fila-total final"><span>VALOR TOTAL PAGADO:</span><span>$${montoTotal.toFixed(2)} USD</span></div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const descargarFacturaRide = (t: TransaccionPagoCRM) => {
    if (typeof window === "undefined") return;
    const html = construirHtmlFacturaRide(t);
    const numLimpio = (t.numero_comprobante || t.pag_identificador_cliente || "comprobante").replace(/[^a-zA-Z0-9_-]/g, "_");
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Factura_Electronica_${numLimpio}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const imprimirFacturaRide = (t: TransaccionPagoCRM) => {
    if (typeof window === "undefined") return;
    const html = construirHtmlFacturaRide(t);
    const win = window.open("", "_blank", "width=860,height=780");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
      }, 250);
    } else {
      descargarFacturaRide(t);
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
              {esVistaCliente ? "MIS PAGOS & COMPROBANTES SRI" : "FACTURACIÓN ELECTRÓNICA SRI & LIQUIDACIÓN"}
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
              {esVistaCliente ? "Facturas Autorizadas Descargables" : "Emisión Automática con Tarjeta Activa"}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0F172A" }}>
            {esVistaCliente
              ? "Mis Pagos Realizados & Facturas Electrónicas"
              : "Facturación, Comprobantes Electrónicos e Historial de Pagos"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            {esVistaCliente
              ? "Consulta el historial de tus pagos realizados, el detalle del servicio facturado y descarga tu factura electrónica SRI."
              : "Control de valores generados y valores pagados, detalle del rubro facturado y emisión automática o manual de facturas electrónicas."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {!esVistaCliente && (
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
          )}

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
              {esVistaCliente
                ? "Aquí aparecerán tus pagos realizados y tus facturas electrónicas listas para descargar."
                : "Las facturas electrónicas se emiten automáticamente al pagar con tarjeta o al registrar un pago manual."}
            </p>
            {!esVistaCliente && (
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
            )}
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

                      {/* Columna 4: Cliente / Adquirente con Links y Análisis 360° */}
                      <td style={{ padding: "13px 14px", minWidth: "210px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px" }}>
                          <button
                            type="button"
                            onClick={() => abrirAnalisisCliente360(t)}
                            title="Ver ficha 360° del cliente: datos, casos, reuniones y pagos"
                            aria-label="Analizar cliente 360"
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              margin: 0,
                              fontWeight: 700,
                              fontSize: "0.84rem",
                              color: "#1E1B4B",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              textDecoration: "underline",
                              textDecorationColor: "#A5B4FC",
                              textUnderlineOffset: "3px",
                            }}
                          >
                            <span>{t.cliente_nombre || t.pag_titular_email || "Cliente"}</span>
                            <ArrowUpRight size={13} color="#4F46E5" />
                          </button>

                          {t.pag_titular_email && (
                            <button
                              type="button"
                              onClick={() => abrirAnalisisCliente360(t)}
                              title={`Analizar expediente 360° de ${t.pag_titular_email}`}
                              aria-label={`Abrir expediente de ${t.pag_titular_email}`}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                margin: 0,
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                color: "#4F46E5",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Mail size={11} />
                              <span>{t.pag_titular_email}</span>
                            </button>
                          )}

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                              marginTop: "2px",
                            }}
                          >
                            <span style={{ fontSize: "0.72rem", color: "#64748B", fontFamily: "monospace" }}>
                              ID: {t.pag_titular_identificacion || "9999999999999"}
                            </span>
                            <button
                              type="button"
                              onClick={() => abrirAnalisisCliente360(t)}
                              className="btn-responsive-accion"
                              title="Analizar cliente 360°: datos personales, casos, reuniones y pagos"
                              aria-label="Cliente 360"
                              style={{
                                background: "#EEF2FF",
                                color: "#4338CA",
                                border: "1px solid #C7D2FE",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "0.69rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Eye size={11} />
                              <span className="btn-texto-responsive">Cliente 360°</span>
                            </button>
                          </div>
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
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => descargarFacturaRide(t)}
                              className="btn-responsive-accion"
                              title="Descargar Factura Electrónica RIDE"
                              aria-label="Descargar Factura Electrónica"
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
                              <Download size={14} />
                              <span className="btn-texto-responsive">Descargar Factura</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setTransaccionSeleccionada(t)}
                              className="btn-responsive-accion"
                              title="Ver Factura Electrónica RIDE"
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
                          </div>
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
                  onClick={() => descargarFacturaRide(transaccionSeleccionada)}
                  className="btn-responsive-accion"
                  title="Descargar archivo de esta Factura Electrónica"
                  aria-label="Descargar Factura"
                  style={{
                    background: "#059669",
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
                  <Download size={14} />
                  <span className="btn-texto-responsive">Descargar Factura</span>
                </button>
                <button
                  type="button"
                  onClick={() => imprimirFacturaRide(transaccionSeleccionada)}
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
                  <button
                    type="button"
                    onClick={() => {
                      const tx = transaccionSeleccionada;
                      setTransaccionSeleccionada(null);
                      abrirAnalisisCliente360(tx);
                    }}
                    title="Abrir expediente 360° de este cliente"
                    aria-label="Abrir expediente 360"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "#4338CA",
                      fontWeight: 700,
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    {transaccionSeleccionada.cliente_nombre || "CONSUMIDOR FINAL"} (Ver 360°)
                  </button>
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

      {/* ===========================================================================
          MODAL 3: ANÁLISIS 360° DEL CLIENTE (DATOS, CASOS, REUNIONES, PAGOS Y DOCS)
         =========================================================================== */}
      {modal360Abierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "920px",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Cabecera del Modal 360° */}
            <div
              style={{
                padding: "18px 24px",
                background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.16)",
                      color: "#E0E7FF",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    EXPEDIENTE CLIENTE 360°
                  </span>
                  {expediente360?.cliente.plan_activo && (
                    <span
                      style={{
                        background: "#10B981",
                        color: "#FFFFFF",
                        padding: "3px 10px",
                        borderRadius: "999px",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                      }}
                    >
                      Plan: {expediente360.cliente.plan_activo.nombre} ({expediente360.cliente.plan_activo.estado || "ACTIVA"})
                    </span>
                  )}
                </div>

                <h2 style={{ margin: 0, fontSize: "1.28rem", fontWeight: 800, color: "#FFFFFF" }}>
                  {cargando360 ? "Cargando expediente del cliente..." : expediente360?.cliente.nombre_completo || "Cliente"}
                </h2>

                {!cargando360 && expediente360 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      flexWrap: "wrap",
                      marginTop: "6px",
                      fontSize: "0.8rem",
                      color: "#C7D2FE",
                    }}
                  >
                    {expediente360.cliente.correo && (
                      <a
                        href={`mailto:${expediente360.cliente.correo}`}
                        style={{
                          color: "#E0E7FF",
                          textDecoration: "underline",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontWeight: 600,
                        }}
                      >
                        <Mail size={13} />
                        {expediente360.cliente.correo}
                      </a>
                    )}
                    {expediente360.cliente.whatsapp && (
                      <a
                        href={`https://wa.me/${expediente360.cliente.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#A7F3D0",
                          textDecoration: "underline",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontWeight: 600,
                        }}
                      >
                        <Phone size={13} />
                        {expediente360.cliente.whatsapp}
                      </a>
                    )}
                    <span style={{ fontFamily: "monospace" }}>
                      C.I./RUC: {expediente360.cliente.identificacion || "9999999999999"}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {!esVistaCliente && expediente360 && (
                  <>
                    <button
                      type="button"
                      onClick={() => abrirPagoManualParaCliente360(expediente360)}
                      className="btn-responsive-accion"
                      title="Registrar pago manual y emitir factura electrónica a este cliente"
                      aria-label="Registrar Pago"
                      style={{
                        background: "#10B981",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "7px 13px",
                        borderRadius: "9px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <PlusCircle size={14} />
                      <span className="btn-texto-responsive">Registrar Pago</span>
                    </button>

                    <a
                      href={`/panel/clientes${expediente360.cliente.correo ? `?q=${encodeURIComponent(expediente360.cliente.correo)}` : ""}`}
                      className="btn-responsive-accion"
                      title="Abrir ficha completa en el Directorio CRM Jurídico"
                      aria-label="Ir al CRM"
                      style={{
                        background: "rgba(255, 255, 255, 0.14)",
                        color: "#FFFFFF",
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        padding: "7px 12px",
                        borderRadius: "9px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <ExternalLink size={14} />
                      <span className="btn-texto-responsive">Ir al CRM</span>
                    </a>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setModal360Abierto(false)}
                  title="Cerrar análisis 360°"
                  aria-label="Cerrar análisis 360"
                  style={{
                    background: "rgba(255, 255, 255, 0.14)",
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

            {cargando360 || !expediente360 ? (
              <div style={{ padding: "50px 24px", textAlign: "center", color: "#64748B" }}>
                <RefreshCw size={26} style={{ margin: "0 auto 10px" }} />
                <div>Consultando casos, reuniones, pagos y facturas electrónicas del cliente...</div>
              </div>
            ) : (
              <div style={{ padding: "20px 24px" }}>
                {/* 4 Tarjetas KPI del Cliente 360° */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: "12px",
                    marginBottom: "18px",
                  }}
                >
                  <div
                    onClick={() => setPestana360("pagos")}
                    style={{
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      borderRadius: "14px",
                      padding: "13px 15px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#065F46", textTransform: "uppercase" }}>
                      Total Pagado / Facturado
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#065F46", marginTop: "3px" }}>
                      ${expediente360.resumen.total_pagado.toFixed(2)} USD
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#047857", marginTop: "3px" }}>
                      {expediente360.resumen.cantidad_pagos} pago(s) · Facturado: ${expediente360.resumen.total_facturado.toFixed(2)}
                    </div>
                  </div>

                  <div
                    onClick={() => setPestana360("reuniones")}
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: "14px",
                      padding: "13px 15px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#1E40AF", textTransform: "uppercase" }}>
                      Reuniones & Citas
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1E3A8A", marginTop: "3px" }}>
                      {expediente360.resumen.cantidad_citas} cita(s)
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#1D4ED8", marginTop: "3px" }}>
                      Teleconsultas y sesiones agendadas
                    </div>
                  </div>

                  <div
                    onClick={() => setPestana360("casos")}
                    style={{
                      background: "#F5F3FF",
                      border: "1px solid #DDD6FE",
                      borderRadius: "14px",
                      padding: "13px 15px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#5B21B6", textTransform: "uppercase" }}>
                      Casos / Expedientes
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#4C1D95", marginTop: "3px" }}>
                      {expediente360.resumen.cantidad_casos} caso(s)
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#6D28D9", marginTop: "3px" }}>
                      Procesos judiciales y patrocinios
                    </div>
                  </div>

                  <div
                    onClick={() => setPestana360("documentos")}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "14px",
                      padding: "13px 15px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                      Billetera Digital
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0F172A", marginTop: "3px" }}>
                      {expediente360.resumen.cantidad_documentos_billetera} doc(s)
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#64748B", marginTop: "3px" }}>
                      Documentos y contratos custodiados
                    </div>
                  </div>
                </div>

                {/* Pestañas de Navegación del Expediente 360° */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    borderBottom: "1px solid #E2E8F0",
                    paddingBottom: "10px",
                    marginBottom: "16px",
                  }}
                >
                  {[
                    { id: "resumen", label: "Vista 360° & Datos", icon: User },
                    { id: "reuniones", label: `Reuniones (${expediente360.reuniones.length})`, icon: Calendar },
                    { id: "casos", label: `Casos (${expediente360.casos.length})`, icon: Briefcase },
                    { id: "pagos", label: `Pagos & Facturas (${expediente360.pagos.length})`, icon: Receipt },
                    { id: "documentos", label: `Documentos (${expediente360.documentos_billetera.length})`, icon: FolderOpen },
                  ].map((tab) => {
                    const IconoTab = tab.icon;
                    const activa = pestana360 === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPestana360(tab.id as any)}
                        style={{
                          background: activa ? "#4F46E5" : "#F1F5F9",
                          color: activa ? "#FFFFFF" : "#475569",
                          border: "none",
                          padding: "7px 14px",
                          borderRadius: "9px",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <IconoTab size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* CONTENIDO PESTAÑA 1: RESUMEN 360° Y DATOS FISCALES */}
                {pestana360 === "resumen" && (
                  <div style={{ display: "grid", gap: "16px" }}>
                    <div
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "14px",
                        padding: "16px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                        fontSize: "0.82rem",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>NOMBRES Y APELLIDOS</div>
                        <div style={{ fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                          {expediente360.cliente.nombre_completo}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>CORREO ELECTRÓNICO</div>
                        <div style={{ fontWeight: 700, color: "#4F46E5", marginTop: "2px" }}>
                          {expediente360.cliente.correo || "—"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>CÉDULA / RUC</div>
                        <div style={{ fontWeight: 700, color: "#0F172A", fontFamily: "monospace", marginTop: "2px" }}>
                          {expediente360.cliente.identificacion}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>WHATSAPP / TELÉFONO</div>
                        <div style={{ fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                          {expediente360.cliente.whatsapp || "No registrado"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>RAZÓN SOCIAL FACTURACIÓN</div>
                        <div style={{ fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                          {expediente360.cliente.razon_social}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>DIRECCIÓN FISCAL</div>
                        <div style={{ fontWeight: 600, color: "#334155", marginTop: "2px" }}>
                          {expediente360.cliente.direccion_fiscal}
                        </div>
                      </div>
                    </div>

                    {/* Vista rápida de Reuniones y Pagos en el Resumen */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      {/* Últimas Reuniones */}
                      <div
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "14px",
                          padding: "14px",
                          background: "#FFFFFF",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            color: "#0F172A",
                            marginBottom: "10px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>Últimas Reuniones / Citas ({expediente360.reuniones.length})</span>
                          <button
                            type="button"
                            onClick={() => setPestana360("reuniones")}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#4F46E5",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Ver todas →
                          </button>
                        </div>
                        {expediente360.reuniones.length === 0 ? (
                          <div style={{ fontSize: "0.8rem", color: "#64748B", padding: "12px 0" }}>
                            Sin reuniones registradas para este cliente.
                          </div>
                        ) : (
                          expediente360.reuniones.slice(0, 3).map((r) => (
                            <div
                              key={r.id}
                              style={{
                                padding: "9px 0",
                                borderBottom: "1px solid #F1F5F9",
                                fontSize: "0.8rem",
                              }}
                            >
                              <div style={{ fontWeight: 700, color: "#0F172A" }}>
                                {r.modalidad === "PRESENCIAL" ? "Cita Presencial" : "Teleconsulta"} — {r.motivo}
                              </div>
                              <div style={{ fontSize: "0.73rem", color: "#64748B", marginTop: "2px" }}>
                                {new Date(r.inicio_en).toLocaleString("es-EC", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}{" "}
                                · Estado: <strong>{r.estado}</strong> · {r.abogado_nombre}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Últimos Pagos y Facturas */}
                      <div
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "14px",
                          padding: "14px",
                          background: "#FFFFFF",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            color: "#0F172A",
                            marginBottom: "10px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>Últimos Pagos & Facturas ({expediente360.pagos.length})</span>
                          <button
                            type="button"
                            onClick={() => setPestana360("pagos")}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#4F46E5",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Ver todos →
                          </button>
                        </div>
                        {expediente360.pagos.length === 0 ? (
                          <div style={{ fontSize: "0.8rem", color: "#64748B", padding: "12px 0" }}>
                            Sin pagos registrados para este cliente.
                          </div>
                        ) : (
                          expediente360.pagos.slice(0, 3).map((p) => (
                            <div
                              key={p.pag_id}
                              style={{
                                padding: "9px 0",
                                borderBottom: "1px solid #F1F5F9",
                                fontSize: "0.8rem",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, color: "#0F172A" }}>
                                  {p.numero_comprobante || p.pag_identificador_cliente} · ${Number(p.pag_monto_total).toFixed(2)} USD
                                </div>
                                <div style={{ fontSize: "0.73rem", color: "#64748B" }}>
                                  {p.rubro_facturado}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => descargarFacturaRide(p)}
                                className="btn-responsive-accion"
                                title="Descargar Factura Electrónica"
                                aria-label="Descargar Factura"
                                style={{
                                  background: "#059669",
                                  color: "#FFFFFF",
                                  border: "none",
                                  padding: "5px 9px",
                                  borderRadius: "7px",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Download size={12} />
                                <span className="btn-texto-responsive">Factura</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTENIDO PESTAÑA 2: REUNIONES Y CITAS DEL CLIENTE */}
                {pestana360 === "reuniones" && (
                  <div>
                    {expediente360.reuniones.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                        Este cliente aún no registra reuniones ni citas agendadas.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {expediente360.reuniones.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              border: "1px solid #E2E8F0",
                              borderRadius: "12px",
                              padding: "12px 16px",
                              background: "#F8FAFC",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "10px",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    background: "#EEF2FF",
                                    color: "#4338CA",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    fontSize: "0.72rem",
                                    fontWeight: 800,
                                  }}
                                >
                                  {r.modalidad}
                                </span>
                                <span
                                  style={{
                                    background: r.estado === "CONFIRMADA" ? "#D1FAE5" : "#FEF3C7",
                                    color: r.estado === "CONFIRMADA" ? "#065F46" : "#92400E",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    fontSize: "0.72rem",
                                    fontWeight: 800,
                                  }}
                                >
                                  {r.estado}
                                </span>
                                <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
                                  {new Date(r.inicio_en).toLocaleString("es-EC", {
                                    dateStyle: "full",
                                    timeStyle: "short",
                                  })}
                                </strong>
                              </div>
                              <div style={{ fontSize: "0.82rem", color: "#334155", marginTop: "5px" }}>
                                <strong>Motivo / Caso:</strong> {r.motivo}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "3px" }}>
                                Especialista asignado: <strong>{r.abogado_nombre}</strong>
                              </div>
                            </div>

                            {r.enlace && (
                              <a
                                href={r.enlace}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-responsive-accion"
                                title="Abrir enlace de sala telemática"
                                aria-label="Unirse a Sala"
                                style={{
                                  background: "#2563EB",
                                  color: "#FFFFFF",
                                  padding: "7px 12px",
                                  borderRadius: "8px",
                                  fontSize: "0.76rem",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <ExternalLink size={13} />
                                <span className="btn-texto-responsive">Sala Virtual</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENIDO PESTAÑA 3: CASOS JURÍDICOS DEL CLIENTE */}
                {pestana360 === "casos" && (
                  <div>
                    {expediente360.casos.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                        Este cliente no tiene expedientes o procesos judiciales abiertos actualmente.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {expediente360.casos.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              border: "1px solid #E2E8F0",
                              borderRadius: "12px",
                              padding: "12px 16px",
                              background: "#F8FAFC",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <strong style={{ fontSize: "0.88rem", color: "#0F172A" }}>
                                #{c.secuencial} — {c.titulo}
                              </strong>
                              <span
                                style={{
                                  background: "#EDE9FE",
                                  color: "#5B21B6",
                                  padding: "3px 9px",
                                  borderRadius: "999px",
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                }}
                              >
                                {c.estado}
                              </span>
                            </div>
                            {c.numero_proceso && (
                              <div style={{ fontSize: "0.76rem", color: "#4F46E5", fontFamily: "monospace", marginTop: "3px" }}>
                                Proceso Judicial SATJE: {c.numero_proceso}
                              </div>
                            )}
                            {c.descripcion && (
                              <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "5px" }}>
                                {c.descripcion}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENIDO PESTAÑA 4: PAGOS Y FACTURAS ELECTRÓNICAS DEL CLIENTE */}
                {pestana360 === "pagos" && (
                  <div>
                    {expediente360.pagos.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                        No se registran pagos ni facturas para este cliente.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {expediente360.pagos.map((p) => (
                          <div
                            key={p.pag_id}
                            style={{
                              border: "1px solid #E2E8F0",
                              borderRadius: "12px",
                              padding: "12px 16px",
                              background: "#F8FAFC",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "10px",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontWeight: 800,
                                    fontSize: "0.82rem",
                                    color: "#4338CA",
                                    background: "#EEF2FF",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                  }}
                                >
                                  {p.numero_comprobante || "Sin comprobante"}
                                </span>
                                <strong style={{ fontSize: "0.9rem", color: "#0F172A" }}>
                                  ${Number(p.pag_monto_total).toFixed(2)} USD
                                </strong>
                                {getBadgeEstado(p.pag_estado)}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "4px", fontWeight: 600 }}>
                                {p.rubro_facturado}
                              </div>
                              <div style={{ fontSize: "0.73rem", color: "#64748B", marginTop: "2px" }}>
                                Fecha: {new Date(p.pag_confirmado_en || p.pag_creado_en).toLocaleString("es-EC")} · Medio:{" "}
                                {p.pag_pasarela}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => descargarFacturaRide(p)}
                                className="btn-responsive-accion"
                                title="Descargar Factura Electrónica RIDE"
                                aria-label="Descargar Factura"
                                style={{
                                  background: "#059669",
                                  color: "#FFFFFF",
                                  border: "none",
                                  padding: "6px 11px",
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <Download size={13} />
                                <span className="btn-texto-responsive">Descargar Factura</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setModal360Abierto(false);
                                  setTransaccionSeleccionada(p);
                                }}
                                className="btn-responsive-accion"
                                title="Ver Factura Electrónica RIDE"
                                aria-label="Ver Factura"
                                style={{
                                  background: "#EEF2FF",
                                  color: "#4338CA",
                                  border: "1px solid #C7D2FE",
                                  padding: "6px 11px",
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <FileText size={13} />
                                <span className="btn-texto-responsive">Ver Factura</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENIDO PESTAÑA 5: DOCUMENTOS EN BILLETERA DIGITAL */}
                {pestana360 === "documentos" && (
                  <div>
                    {expediente360.documentos_billetera.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                        El cliente aún no tiene documentos cargados en su Billetera Digital.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "8px" }}>
                        {expediente360.documentos_billetera.map((d) => (
                          <div
                            key={d.id}
                            style={{
                              border: "1px solid #E2E8F0",
                              borderRadius: "10px",
                              padding: "10px 14px",
                              background: "#F8FAFC",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.82rem",
                            }}
                          >
                            <div>
                              <strong style={{ color: "#0F172A" }}>{d.titulo}</strong>
                              <span style={{ marginLeft: "8px", fontSize: "0.73rem", color: "#64748B" }}>
                                ({d.categoria})
                              </span>
                            </div>
                            <span style={{ fontSize: "0.74rem", color: "#475569" }}>
                              {d.fecha_caducidad ? `Vence: ${d.fecha_caducidad}` : "Vigente"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

