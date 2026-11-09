"use client";

// Checkout de la plataforma (TRQ-ADM-004): facturación → pago → recibo.
//
// Sirve a PLUX y a Payphone; el negocio tiene una sola pasarela activa y aquí
// se muestra esa. La tarjeta nunca pasa por este componente: PLUX la pide en
// su propio modal y Payphone en su página (o en el simulador de pruebas).
//
// El diseño sale de la maqueta aprobada en el taller (TRANQUI/demo/checkout.html).
// La apariencia de cada producto se define en su app con variables `--ckt-*`
// (ver checkout/estilos.ts).
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ExternalLink, Lock, Receipt, RefreshCw, ShieldCheck, ShoppingBag, Smartphone, X } from "lucide-react";
import {
  type VarianteCatalogo,
  prepararPagoPayphoneAction,
  confirmarPagoPayphoneAction,
  obtenerDatosFacturacionAction,
  guardarDatosFacturacionAction,
} from "../acciones";
import { obtenerPasarelasCheckoutAction, type PasarelaCheckout } from "../acciones-plux";
import { normalizarIdentificadorNegocio } from "../utils/negocio";
import { BotonPagoPlux, type FasePlux } from "./BotonPagoPlux";
import { ESTILOS_CHECKOUT } from "./checkout/estilos";
import {
  errorCampo,
  normalizarTipoIdentificacion,
  type CampoFacturacion,
  type TipoIdentificacion,
} from "./checkout/validacion";
import {
  Alerta,
  Campo,
  Interruptor,
  PanelProcesando,
  PanelRechazo,
  Pasos,
  ReciboPago,
  Segmentos,
  TarjetaVisual,
  dinero,
  useContador,
  type DatosRecibo,
  type PasoSiguiente,
} from "./checkout/piezas";

export type { PasoSiguiente } from "./checkout/piezas";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  productoNombre: string;
  variante: VarianteCatalogo | null;
  negocio?: string;
  /**
   * Se llama al cerrar el checkout tras un pago aprobado (no en el instante del
   * pago): si el llamador refresca o desmonta el modal, el cliente ya vio su recibo.
   */
  alPagoExitoso?: (transaccion: any) => void;
  /** «¿Qué sigue?» del recibo. Sin él se muestran pasos genéricos y ciertos. */
  pasosSiguientes?: PasoSiguiente[];
}

type Etapa = "facturacion" | "pago" | "procesando" | "recibo" | "rechazo";

interface ResultadoPago {
  estado?: string;
  mensaje?: string | null;
  clientTransactionId?: string;
  autorizacionCodigo?: string | null;
  marcaTarjeta?: string | null;
  ultimosDigitos?: string | null;
  /** Motivo de PLUX; MONTO_DISTINTO significa que hubo cobro y queda en revisión. */
  motivo?: string | null;
  [clave: string]: unknown;
}

/**
 * Payphone devuelve `codigoAutorizacion` y `tarjeta` («Visa •••• 1234»); PLUX,
 * `autorizacionCodigo`, `marcaTarjeta` y `ultimosDigitos`. El recibo usa las de PLUX.
 */
function normalizarResultado(res: Record<string, any>): ResultadoPago {
  const tarjeta = typeof res.tarjeta === "string" ? res.tarjeta : "";
  const [marcaTexto, digitos] = tarjeta.split("••••").map((t: string) => t.trim());
  return {
    ...res,
    autorizacionCodigo: res.autorizacionCodigo ?? res.codigoAutorizacion ?? null,
    marcaTarjeta: res.marcaTarjeta ?? (marcaTexto || null),
    ultimosDigitos: res.ultimosDigitos ?? (digitos || null),
  };
}

const ORDEN: Record<Etapa, number> = { facturacion: 0, pago: 1, procesando: 1, rechazo: 1, recibo: 2 };
// Si la pasarela responde al instante, la animación de «procesando» se ve
// igual lo suficiente para entender qué pasó.
const MIN_PROCESANDO_MS = 2200;
const CAMPOS: CampoFacturacion[] = ["identificacion", "razonSocial", "email", "telefono", "direccion"];
const TIPOS_DOCUMENTO: { valor: TipoIdentificacion; texto: string }[] = [
  { valor: "cedula", texto: "Cédula" },
  { valor: "ruc", texto: "RUC" },
  { valor: "pasaporte", texto: "Pasaporte" },
];
const NOMBRE_DOCUMENTO: Record<TipoIdentificacion, string> = { cedula: "Cédula", ruc: "RUC", pasaporte: "Pasaporte" };
const NOMBRE_MARCA: Record<string, string> = { tranqi: "tranqi", tinkay: "tinkay", fastfix: "FastFix", margaritas: "Margaritas" };
const TARJETA_OCULTA = "•••• •••• •••• ••••";

// Tarjetas del simulador de Payphone (sin cobro real). La Diners se rechaza.
const PRESET_INICIAL = { texto: "Visa aprobada", numero: "4500 8912 3456 7890", exp: "08/29", cvv: "456", marca: "Visa" };
const PRESETS_SIMULADOR = [
  PRESET_INICIAL,
  { texto: "Mastercard aprobada", numero: "5412 7534 8901 2345", exp: "11/28", cvv: "123", marca: "Mastercard" },
  { texto: "Diners rechazada", numero: "3612 3456 7890 12", exp: "04/27", cvv: "890", marca: "Diners Club" },
];

function detectarMarca(numero: string): string {
  const limpio = numero.replace(/\s+/g, "");
  if (/^5[1-5]/.test(limpio) || /^2[2-7]/.test(limpio)) return "Mastercard";
  if (/^3[47]/.test(limpio)) return "American Express";
  if (/^3(?:0[0-5]|[68])/.test(limpio)) return "Diners Club";
  return "Visa";
}

function textoOferta(variante: VarianteCatalogo): string {
  const tipo = (variante.var_tipo_oferta || "").toUpperCase();
  if (tipo === "SUSCRIPCION" || tipo === "RECURRENTE") {
    const f = (variante.var_frecuencia_recurrencia || "").toLowerCase();
    return f ? `Suscripción ${f}` : "Suscripción";
  }
  return "Pago único";
}

function medioDePago(r: ResultadoPago): string {
  const marca = r.marcaTarjeta || "Tarjeta";
  return r.ultimosDigitos ? `${marca} •••• ${r.ultimosDigitos}` : marca;
}

const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

export function ModalCheckoutPayphone({
  abierto,
  alCerrar,
  productoNombre,
  variante,
  negocio = "tranqi",
  alPagoExitoso,
  pasosSiguientes,
}: Props) {
  const router = useRouter();
  // Facturación
  const [razonSocial, setRazonSocial] = useState("");
  const [tipoIdentificacion, setTipoIdentificacion] = useState<TipoIdentificacion>("cedula");
  const [identificacion, setIdentificacion] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tienePerfilFacturacion, setTienePerfilFacturacion] = useState(false);
  const [guardarEnPerfil, setGuardarEnPerfil] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [tocados, setTocados] = useState<Partial<Record<CampoFacturacion, boolean>>>({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const [sacudir, setSacudir] = useState(0);

  // Simulador de Payphone
  const [tarjetaNumero, setTarjetaNumero] = useState(PRESET_INICIAL.numero);
  const [tarjetaTitular, setTarjetaTitular] = useState("");
  const [tarjetaExp, setTarjetaExp] = useState(PRESET_INICIAL.exp);
  const [tarjetaCvv, setTarjetaCvv] = useState(PRESET_INICIAL.cvv);
  const [tarjetaMarca, setTarjetaMarca] = useState(PRESET_INICIAL.marca);

  // Flujo
  const [etapa, setEtapa] = useState<Etapa>("facturacion");
  const [sentido, setSentido] = useState<"adelante" | "atras">("adelante");
  const [modoSimulado, setModoSimulado] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prepData, setPrepData] = useState<{
    paymentId: string;
    clientTransactionId: string;
    payWithPayPhone: string | null;
    payWithCard: string | null;
    esSimulado: boolean;
  } | null>(null);
  const [resultadoPago, setResultadoPago] = useState<ResultadoPago | null>(null);
  const [fechaPago, setFechaPago] = useState<Date | null>(null);
  const [avisoPendiente, setAvisoPendiente] = useState<string | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [fasePlux, setFasePlux] = useState<FasePlux>("inicio");

  const etapaActual = useRef<Etapa>("facturacion");
  const inicioProcesando = useRef(0);
  // Cambia al cerrar: un pago que termine después ya no toca este checkout.
  const sesion = useRef(0);
  const caja = useRef<HTMLDivElement>(null);
  const alEscape = useRef<() => void>(() => {});
  // Pago aprobado que aún no se notificó al llamador (se notifica al cerrar).
  const pagoAprobado = useRef<ResultadoPago | null>(null);

  // Pasarela activa del negocio (PLUX o Payphone, nunca las dos a la vez).
  const [plux, setPlux] = useState<PasarelaCheckout | null>(null);
  const [cargandoPasarela, setCargandoPasarela] = useState(true);
  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setCargandoPasarela(true);
    obtenerPasarelasCheckoutAction(negocio)
      .then((r) => {
        if (!cancelado) setPlux(r.ok ? r.data.find((p) => p.pasarela === "PLUX") ?? null : null);
      })
      .catch(() => {
        if (!cancelado) setPlux(null);
      })
      .finally(() => {
        if (!cancelado) setCargandoPasarela(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, negocio]);

  // Datos de facturación guardados (perfil o, como respaldo, este navegador).
  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setCargandoPerfil(true);
    obtenerDatosFacturacionAction()
      .then((res) => {
        if (cancelado) return;
        if (res.ok && res.tienePerfilFacturacion) {
          setTienePerfilFacturacion(true);
          setRazonSocial(res.razonSocial || "");
          setTipoIdentificacion(normalizarTipoIdentificacion(res.tipoIdentificacion));
          setIdentificacion(res.identificacion || "");
          setEmail(res.correoFacturacion || "");
          setTelefono(res.telefono || "");
          setDireccion(res.direccion || "");
          setGuardarEnPerfil(false);
        } else if (res.ok && !res.tienePerfilFacturacion) {
          let local: any = null;
          try {
            const guardado = localStorage.getItem("tranqi_datos_facturacion");
            if (guardado) local = JSON.parse(guardado);
          } catch {
            /* sin respaldo local */
          }
          if (local?.identificacion || local?.razonSocial) {
            setTienePerfilFacturacion(true);
            setRazonSocial(local.razonSocial || res.razonSocial || "");
            setTipoIdentificacion(normalizarTipoIdentificacion(local.tipoIdentificacion));
            setIdentificacion(local.identificacion || "");
            setEmail(local.correoFacturacion || res.correoFacturacion || "");
            setTelefono(local.telefono || res.telefono || "");
            setDireccion(local.direccion || "");
            setGuardarEnPerfil(false);
          } else {
            setTienePerfilFacturacion(false);
            setRazonSocial(res.razonSocial || "");
            setEmail(res.correoFacturacion || "");
            setTelefono(res.telefono || "");
            setGuardarEnPerfil(true); // invita a guardar sus datos
          }
        }
      })
      .catch(() => {
        if (cancelado) return;
        setTienePerfilFacturacion(false);
        setGuardarEnPerfil(true);
      })
      .finally(() => {
        if (!cancelado) setCargandoPerfil(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto]);

  // Mientras está abierto: sin scroll detrás, foco atrapado dentro y Escape para cerrar.
  const visible = abierto && Boolean(variante);
  useEffect(() => {
    if (!visible) return;
    const overflowPrevio = document.body.style.overflow;
    const focoPrevio = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    caja.current?.focus();
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") return alEscape.current();
      if (e.key !== "Tab" || !caja.current) return;
      const enfocables = Array.from(
        caja.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (!primero || !ultimo) return;
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || !caja.current.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !caja.current.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener("keydown", alPulsar);
      focoPrevio?.focus?.();
    };
  }, [visible]);

  const totalResumen = useContador(abierto && variante ? variante.precio_total : 0, 350);

  if (!abierto || !variante) return null;

  const marca = NOMBRE_MARCA[normalizarIdentificadorNegocio(negocio).principal] ?? negocio;
  const nombrePasarela = plux ? "PLUX" : "Payphone";
  const total = variante.precio_total;
  const tarifaIva = Number.isFinite(variante.var_tarifa_iva_porcentaje)
    ? variante.var_tarifa_iva_porcentaje
    : variante.var_precio > 0
      ? Math.round((variante.monto_iva / variante.var_precio) * 100)
      : 0;
  const esSuscripcion = ["SUSCRIPCION", "RECURRENTE"].includes((variante.var_tipo_oferta || "").toUpperCase());

  // ── Validación ──
  const valores: Record<CampoFacturacion, string> = { identificacion, razonSocial, email, telefono, direccion };
  const opcionesValidacion = { tipoIdentificacion, direccionObligatoria: Boolean(plux) };
  const errores = Object.fromEntries(CAMPOS.map((c) => [c, errorCampo(c, valores[c], opcionesValidacion)])) as Record<
    CampoFacturacion,
    string | null
  >;
  const errorVisible = (c: CampoFacturacion) => (intentoEnvio || tocados[c] ? errores[c] : null);
  const esValido = (c: CampoFacturacion) => !errores[c] && valores[c].trim() !== "";
  const tocar = (c: CampoFacturacion) => setTocados((t) => (t[c] ? t : { ...t, [c]: true }));

  // ── Navegación ──
  const irA = (nueva: Etapa) => {
    setSentido(ORDEN[nueva] < ORDEN[etapaActual.current] ? "atras" : "adelante");
    etapaActual.current = nueva;
    setEtapa(nueva);
    setErrorMsg(null);
  };

  const iniciarProcesando = () => {
    inicioProcesando.current = Date.now();
    setAvisoPendiente(null);
    irA("procesando");
  };

  const terminarPago = async (res: ResultadoPago) => {
    const mia = sesion.current;
    const resta = MIN_PROCESANDO_MS - (Date.now() - inicioProcesando.current);
    if (resta > 0) await esperar(resta);
    if (mia !== sesion.current) return;
    setResultadoPago(res);
    if (res.estado === "APROBADO") {
      pagoAprobado.current = res;
      setFechaPago(new Date());
      irA("recibo");
    } else {
      irA("rechazo");
    }
  };

  const volverAPagoConError = (mensaje: string, mia: number) => {
    if (mia !== sesion.current) return;
    irA("pago");
    setErrorMsg(mensaje);
  };

  const reiniciarYCerrar = () => {
    sesion.current++;
    const aprobado = pagoAprobado.current;
    pagoAprobado.current = null;
    // Sin restos del pago anterior; al reabrir se recargan los datos del perfil.
    setRazonSocial("");
    setTipoIdentificacion("cedula");
    setIdentificacion("");
    setEmail("");
    setTelefono("");
    setDireccion("");
    setTarjetaTitular("");
    etapaActual.current = "facturacion";
    setEtapa("facturacion");
    setSentido("adelante");
    setPrepData(null);
    setResultadoPago(null);
    setFechaPago(null);
    setErrorMsg(null);
    setAvisoPendiente(null);
    setIntentoEnvio(false);
    setTocados({});
    setDetalleAbierto(false);
    setFasePlux("inicio");
    alCerrar();
    if (aprobado) {
      alPagoExitoso?.(aprobado);
      // Las acciones de pago ya no revalidan /panel (desmontaba el checkout a
      // medio pago): se refresca aquí, con el recibo ya visto.
      router.refresh();
    }
  };

  // Cerrar a media confirmación cortaría la espera de PLUX (el botón vive en
  // el modal); con el aviso de «sin confirmar» ya se puede cerrar.
  const cierreBloqueado = etapa === "procesando" && !avisoPendiente;

  // Escape no cierra mientras se cobra ni con la ventana de PLUX en curso:
  // cerrar desmontaría el botón y con él la espera de la confirmación.
  const pluxEnCurso = Boolean(plux) && etapa === "pago" && fasePlux !== "inicio" && fasePlux !== "error";
  alEscape.current = () => {
    if (!cierreBloqueado && !pluxEnCurso) reiniciarYCerrar();
  };

  // ── Paso 1: facturación ──
  const continuarFacturacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIntentoEnvio(true);
    const conError = CAMPOS.find((c) => errores[c]);
    if (conError) {
      setSacudir((n) => n + 1);
      document.getElementById(`ckt-${conError}`)?.focus();
      return;
    }
    setTarjetaTitular(razonSocial.trim().toUpperCase());

    if (plux) {
      if (guardarEnPerfil) {
        setProcesando(true);
        // No bloquea el pago: si no se guarda, se factura igual con estos datos.
        await guardarDatosFacturacionAction({
          razonSocial,
          tipoIdentificacion,
          identificacion,
          correoFacturacion: email,
          telefono,
          direccion,
        }).catch(() => null);
        setProcesando(false);
      }
      irA("pago");
      return;
    }

    setProcesando(true);
    try {
      const res = await prepararPagoPayphoneAction({
        negocio,
        varianteId: variante.var_id,
        nombreServicio: `${productoNombre} - ${variante.var_nombre}`,
        montoBase: variante.var_precio,
        montoIva: variante.monto_iva,
        montoTotal: variante.precio_total,
        pagador: {
          nombres: razonSocial.trim(),
          apellidos: "",
          identificacion: identificacion.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          tipoIdentificacion,
          razonSocial: razonSocial.trim(),
          direccion: direccion.trim(),
          guardarEnPerfil,
        },
        esSimulado: modoSimulado,
      });
      if (!res.ok || !res.paymentId || !res.clientTransactionId) {
        setErrorMsg(res.error || "No se pudo preparar el pago.");
        return;
      }
      setPrepData({
        paymentId: res.paymentId,
        clientTransactionId: res.clientTransactionId,
        payWithPayPhone: res.payWithPayPhone ?? null,
        payWithCard: res.payWithCard ?? null,
        esSimulado: Boolean(res.esSimulado),
      });
      irA("pago");
      // Pasarela real en pestaña aparte (PCI DSS): la tarjeta no pasa por aquí.
      if (!res.esSimulado && res.payWithCard) window.open(res.payWithCard, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setErrorMsg(err?.message || "No pudimos conectar con la pasarela.");
    } finally {
      setProcesando(false);
    }
  };

  // ── Paso 2: Payphone ──
  const aplicarPreset = (p: (typeof PRESETS_SIMULADOR)[number]) => {
    setTarjetaNumero(p.numero);
    setTarjetaExp(p.exp);
    setTarjetaCvv(p.cvv);
    setTarjetaMarca(p.marca);
    if (!tarjetaTitular) setTarjetaTitular((razonSocial.trim() || "CLIENTE").toUpperCase());
  };

  const pagarSimulado = async (forzado?: "APROBADO" | "RECHAZADO") => {
    if (!prepData) return;
    if (tarjetaNumero.replace(/\s+/g, "").length < 14) return setErrorMsg("Escribe un número de tarjeta válido.");
    if (!/^\d{2}\/\d{2}$/.test(tarjetaExp)) return setErrorMsg("Escribe el vencimiento como MM/AA.");
    if (tarjetaCvv.length < 3) return setErrorMsg("Escribe el código de seguridad (CVV).");

    const resultado = forzado || (tarjetaNumero.includes("3612") ? "RECHAZADO" : "APROBADO");
    const mia = sesion.current;
    iniciarProcesando();
    try {
      const res = await confirmarPagoPayphoneAction({
        negocio,
        id: prepData.paymentId,
        clientTxId: prepData.clientTransactionId,
        esSimulado: true,
        resultadoSimulacion: resultado,
        marcaTarjetaSimulada: tarjetaMarca,
        ultimosDigitos: tarjetaNumero.replace(/\s+/g, "").slice(-4),
        titularNombre: tarjetaTitular || razonSocial || "CLIENTE",
        varianteId: variante.var_id,
        productoNombre,
        clienteEmail: email,
      });
      // Un rechazo llega con ok:false y estado: es un resultado, no un error técnico.
      if (!res.ok && !(res as any).estado) return volverAPagoConError(res.error || "No se pudo procesar la simulación.", mia);
      await terminarPago(normalizarResultado(res));
    } catch (err: any) {
      volverAPagoConError(err?.message || "No se pudo confirmar la simulación.", mia);
    }
  };

  const confirmarPagoReal = async () => {
    if (!prepData) return;
    const mia = sesion.current;
    iniciarProcesando();
    try {
      const res = await confirmarPagoPayphoneAction({
        negocio,
        id: prepData.paymentId,
        clientTxId: prepData.clientTransactionId,
        esSimulado: false,
      });
      if (!res.ok && !(res as any).estado) {
        return volverAPagoConError(res.error || "El pago aún no se completa en Payphone o fue rechazado.", mia);
      }
      await terminarPago(normalizarResultado(res));
    } catch (err: any) {
      volverAPagoConError(err?.message || "No pudimos consultar el estado en Payphone.", mia);
    }
  };

  // ── Paso 2: PLUX ──
  const alAprobarPlux = (
    identificador: string,
    pago: {
      pagoId?: string | null;
      pasarela?: string;
      autorizacion: string | null;
      marcaTarjeta: string | null;
      ultimosDigitos: string | null;
    },
  ) => {
    const res: ResultadoPago = {
      ok: true,
      estado: "APROBADO",
      pagoId: pago.pagoId ?? null,
      pasarela: pago.pasarela || "PLUX",
      clientTransactionId: identificador,
      autorizacionCodigo: pago.autorizacion,
      marcaTarjeta: pago.marcaTarjeta,
      ultimosDigitos: pago.ultimosDigitos,
    };
    void terminarPago(res);
  };

  const alCambiarFasePlux = (fase: FasePlux, mensaje: string | null, motivo: string | null) => {
    setFasePlux(fase);
    if (fase === "esperando") iniciarProcesando();
    else if (fase === "rechazado") {
      void terminarPago(
        motivo === "MONTO_DISTINTO"
          ? { estado: "EN_REVISION", motivo, mensaje }
          : { estado: "RECHAZADO", motivo, mensaje: "PLUX no aprobó la operación." },
      );
    }
    else if (fase === "sin_confirmar") setAvisoPendiente(mensaje);
  };

  const revisarDatos = () => {
    setPrepData(null);
    irA("facturacion");
  };
  // Un pago de Payphone rechazado ya no se puede confirmar: se prepara otro.
  const reintentar = () => (plux ? irA("pago") : revisarDatos());

  // ── Recibo ──
  const datosRecibo: DatosRecibo | null =
    resultadoPago && fechaPago
      ? {
          negocio: marca,
          productoNombre,
          varianteNombre: variante.var_nombre,
          subtotal: variante.var_precio,
          iva: variante.monto_iva,
          tarifaIva,
          total,
          cliente: razonSocial.trim(),
          documento: `${NOMBRE_DOCUMENTO[tipoIdentificacion]} ${identificacion.trim()}`,
          medio: medioDePago(resultadoPago),
          autorizacion: resultadoPago.autorizacionCodigo || null,
          referencia: resultadoPago.clientTransactionId || prepData?.clientTransactionId || "—",
          fecha: fechaPago,
        }
      : null;

  const pasosDelRecibo: PasoSiguiente[] = pasosSiguientes ?? [
    { titulo: "Pago confirmado", detalle: `${datosRecibo?.medio ?? "Tarjeta"} · ${dinero(total)}` },
    esSuscripcion
      ? { titulo: "Plan activado", detalle: "Tu cobertura queda asociada a tu cuenta." }
      : { titulo: "Te contactamos", detalle: `${marca} te escribirá a ${email.trim()} para empezar.` },
    { titulo: "Aviso en tu panel", detalle: "La confirmación queda en tus notificaciones." },
  ];

  const montoBoton = <span className="ckt-monto">{dinero(total)}</span>;
  const botonVolver = (accion: () => void) => (
    <button type="button" className="ckt-btn ckt-btn-secundario" onClick={accion} title="Volver" aria-label="Volver">
      <ArrowLeft size={18} /> Volver
    </button>
  );

  return (
    <div className="ckt-velo">
      <style>{ESTILOS_CHECKOUT}</style>
      <div className="ckt-caja" role="dialog" aria-modal="true" aria-labelledby="ckt-titulo" tabIndex={-1} ref={caja}>
        {/* ═══ Resumen ═══ */}
        <aside className={`ckt-resumen ${etapa === "recibo" ? "es-pagado" : ""} ${detalleAbierto ? "es-abierto" : ""}`}>
          <svg className="ckt-cinta" viewBox="0 0 340 700" preserveAspectRatio="none" aria-hidden="true">
            <path pathLength={1} d="M 380 250 C 250 260 120 330 150 430 C 180 530 330 520 300 620 C 285 670 220 700 200 760" />
          </svg>
          <p className="ckt-marca">{marca}</p>
          <p className="ckt-etiqueta">Tu compra</p>
          <div className="ckt-producto">
            <span className="ckt-producto-icono">
              <ShoppingBag size={24} />
            </span>
            <div>
              <h2 id="ckt-titulo">{productoNombre}</h2>
              <p>
                {variante.var_nombre} · {textoOferta(variante)}
              </p>
            </div>
          </div>
          <div className="ckt-desglose" id="ckt-desglose">
            <div>
              <span>Subtotal</span>
              <span>{dinero(variante.var_precio)}</span>
            </div>
            <div>
              <span>IVA {tarifaIva} %</span>
              <span>{dinero(variante.monto_iva)}</span>
            </div>
            <div className="ckt-total">
              <span>Total</span>
              <strong>
                <small>$</small>
                {totalResumen}
              </strong>
            </div>
          </div>
          <span className="ckt-chip-pagado">
            <Check size={14} strokeWidth={3} /> Pagado
          </span>
          <button
            type="button"
            className="ckt-ver-detalle"
            aria-expanded={detalleAbierto}
            aria-controls="ckt-desglose"
            onClick={() => setDetalleAbierto((v) => !v)}
          >
            Ver detalle <ChevronDown size={14} />
          </button>
          <p className="ckt-seguridad">
            <ShieldCheck size={20} />
            <span>
              Pago procesado por {nombrePasarela}. {marca} nunca ve ni guarda tu tarjeta.
            </span>
          </p>
        </aside>

        {/* ═══ Flujo ═══ */}
        <div className="ckt-flujo">
          <button
            type="button"
            className="ckt-cerrar"
            onClick={reiniciarYCerrar}
            disabled={cierreBloqueado}
            aria-label="Cerrar"
            title={cierreBloqueado ? "Espera a que termine el pago" : "Cerrar"}
          >
            <X size={18} />
          </button>

          <Pasos indice={ORDEN[etapa]} />

          {errorMsg && <Alerta>{errorMsg}</Alerta>}

          {/* Paso 1: facturación */}
          {etapa === "facturacion" && (
            <form className="ckt-paso" data-dir={sentido} onSubmit={continuarFacturacion} noValidate>
              <h3>Datos de facturación</h3>
              <p className="ckt-bajada">Con ellos emitimos tu comprobante electrónico.</p>

              {cargandoPerfil ? (
                <div className="ckt-aviso es-neutro">
                  <RefreshCw size={18} className="ckt-girar" /> Cargando tus datos…
                </div>
              ) : tienePerfilFacturacion ? (
                <div className="ckt-aviso">
                  <Check size={18} /> Usamos los datos de tu perfil. Puedes cambiarlos.
                </div>
              ) : (
                <div className="ckt-aviso es-neutro">
                  <Receipt size={18} /> Complétalos una vez y los recordamos.
                </div>
              )}

              <div className="ckt-rejilla">
                <Segmentos
                  nombre="ckt-tipo-documento"
                  etiqueta="Tipo de documento"
                  opciones={TIPOS_DOCUMENTO}
                  valor={tipoIdentificacion}
                  alCambiar={setTipoIdentificacion}
                />
                <Campo
                  id="ckt-identificacion"
                  etiqueta={`Número de ${NOMBRE_DOCUMENTO[tipoIdentificacion].toLowerCase()}`}
                  valor={identificacion}
                  alCambiar={(v) => setIdentificacion(tipoIdentificacion === "pasaporte" ? v.toUpperCase() : v.replace(/\D/g, "").slice(0, 13))}
                  alSalir={() => tocar("identificacion")}
                  error={errorVisible("identificacion")}
                  valido={esValido("identificacion")}
                  sacudir={sacudir}
                  inputMode={tipoIdentificacion === "pasaporte" ? "text" : "numeric"}
                  autoComplete="off"
                  deshabilitado={cargandoPerfil}
                />
                <Campo
                  id="ckt-razonSocial"
                  etiqueta="Nombre o razón social"
                  valor={razonSocial}
                  alCambiar={setRazonSocial}
                  alSalir={() => tocar("razonSocial")}
                  error={errorVisible("razonSocial")}
                  valido={esValido("razonSocial")}
                  sacudir={sacudir}
                  autoComplete="name"
                  deshabilitado={cargandoPerfil}
                />
                <Campo
                  id="ckt-email"
                  etiqueta="Correo"
                  tipo="email"
                  valor={email}
                  alCambiar={setEmail}
                  alSalir={() => tocar("email")}
                  error={errorVisible("email")}
                  valido={esValido("email")}
                  sacudir={sacudir}
                  autoComplete="email"
                  inputMode="email"
                  deshabilitado={cargandoPerfil}
                />
                <Campo
                  id="ckt-telefono"
                  etiqueta="Celular"
                  tipo="tel"
                  valor={telefono}
                  alCambiar={setTelefono}
                  alSalir={() => tocar("telefono")}
                  error={errorVisible("telefono")}
                  valido={esValido("telefono")}
                  sacudir={sacudir}
                  autoComplete="tel"
                  inputMode="tel"
                  deshabilitado={cargandoPerfil}
                />
                <Campo
                  id="ckt-direccion"
                  className="ckt-ancho"
                  etiqueta={plux ? "Dirección" : "Dirección (opcional)"}
                  valor={direccion}
                  alCambiar={setDireccion}
                  alSalir={() => tocar("direccion")}
                  error={errorVisible("direccion")}
                  valido={esValido("direccion")}
                  sacudir={sacudir}
                  autoComplete="street-address"
                  deshabilitado={cargandoPerfil}
                />
              </div>

              <Interruptor
                marcado={guardarEnPerfil}
                alCambiar={setGuardarEnPerfil}
                titulo={tienePerfilFacturacion ? "Actualizar mis datos guardados" : "Guardar para próximas compras"}
              />
              {!plux && !cargandoPasarela && (
                <Interruptor
                  marcado={modoSimulado}
                  alCambiar={setModoSimulado}
                  titulo="Modo de prueba"
                  detalle="Simula el cobro con Payphone, sin débito real."
                />
              )}

              <div className="ckt-pie">
                <button type="submit" className="ckt-btn ckt-btn-primario" disabled={procesando || cargandoPasarela || cargandoPerfil}>
                  {(procesando || cargandoPasarela) && <RefreshCw size={18} className="ckt-girar" />}
                  Continuar {montoBoton}
                </button>
              </div>
            </form>
          )}

          {/* Paso 2: pago con PLUX. Sigue montado (oculto) mientras se procesa:
              el botón espera ahí la confirmación de PLUX. */}
          {plux && (etapa === "pago" || etapa === "procesando") && (
            <div className="ckt-paso" data-dir={sentido} hidden={etapa !== "pago"}>
              <h3>Paga con tarjeta</h3>
              <p className="ckt-bajada">Crédito o débito. Escribirás la tarjeta en la ventana segura de PLUX.</p>
              {plux.ambiente !== "PRODUCCION" && <span className="ckt-insignia">Modo prueba · solo tarjetas de prueba</span>}
              <TarjetaVisual numero={TARJETA_OCULTA} titular={razonSocial.trim().toUpperCase()} vence="" marca={marca} />
              <div className="ckt-medios" aria-hidden="true">
                <span>Crédito</span>
                <span>Débito</span>
                <span>3-D Secure</span>
              </div>
              <div className="ckt-garantias">
                <div>
                  <ShieldCheck />
                  <span>Tu banco puede pedirte una verificación adicional.</span>
                </div>
                <div>
                  <Receipt />
                  <span>
                    Facturamos a <b>{razonSocial.trim()}</b> · {email.trim()}
                  </span>
                </div>
              </div>
              <div className="ckt-pie">
                {botonVolver(revisarDatos)}
                <BotonPagoPlux
                  negocio={negocio}
                  varianteId={variante.var_id}
                  ambiente={plux.ambiente}
                  pagador={{
                    nombre: razonSocial.trim(),
                    identificacion: identificacion.trim(),
                    email: email.trim(),
                    telefono: telefono.trim(),
                    direccion: direccion.trim(),
                  }}
                  alPagoAprobado={alAprobarPlux}
                  alCambiarFase={alCambiarFasePlux}
                  etiqueta={<>Pagar {montoBoton}</>}
                />
              </div>
            </div>
          )}

          {/* Paso 2: simulador de Payphone */}
          {!plux && etapa === "pago" && prepData?.esSimulado && (
            <div className="ckt-paso" data-dir={sentido}>
              <h3>Paga con tarjeta</h3>
              <p className="ckt-bajada">Simulación de Payphone: no se cobra nada.</p>
              <span className="ckt-insignia">Modo prueba · sin cobro real</span>
              <TarjetaVisual numero={tarjetaNumero || TARJETA_OCULTA} titular={tarjetaTitular} vence={tarjetaExp} marca={tarjetaMarca} />
              <div className="ckt-medios">
                {PRESETS_SIMULADOR.map((p) => (
                  <button key={p.texto} type="button" onClick={() => aplicarPreset(p)}>
                    {p.texto}
                  </button>
                ))}
              </div>
              <div className="ckt-rejilla" style={{ marginTop: 16 }}>
                <Campo
                  id="ckt-tarjeta-numero"
                  className="ckt-ancho"
                  etiqueta="Número de tarjeta"
                  valor={tarjetaNumero}
                  alCambiar={(v) => {
                    const digitos = v.replace(/\D/g, "").slice(0, 16);
                    setTarjetaNumero(digitos.match(/.{1,4}/g)?.join(" ") || digitos);
                    setTarjetaMarca(detectarMarca(digitos));
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <Campo
                  id="ckt-tarjeta-titular"
                  className="ckt-ancho"
                  etiqueta="Titular"
                  valor={tarjetaTitular}
                  alCambiar={setTarjetaTitular}
                  mayusculas
                  autoComplete="off"
                />
                <Campo
                  id="ckt-tarjeta-vence"
                  etiqueta="Vence (MM/AA)"
                  valor={tarjetaExp}
                  alCambiar={(v) => {
                    const d = v.replace(/\D/g, "").slice(0, 4);
                    setTarjetaExp(d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <Campo
                  id="ckt-tarjeta-cvv"
                  etiqueta="CVV"
                  tipo="password"
                  valor={tarjetaCvv}
                  alCambiar={(v) => setTarjetaCvv(v.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div className="ckt-pie">
                {botonVolver(revisarDatos)}
                <button type="button" className="ckt-btn ckt-btn-alerta" onClick={() => pagarSimulado("RECHAZADO")}>
                  Simular rechazo
                </button>
                <button type="button" className="ckt-btn ckt-btn-primario" onClick={() => pagarSimulado()}>
                  <Lock size={18} /> Pagar {montoBoton}
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: Payphone real, en otra pestaña */}
          {!plux && etapa === "pago" && prepData && !prepData.esSimulado && (
            <div className="ckt-paso" data-dir={sentido}>
              <h3>Completa el pago en Payphone</h3>
              <p className="ckt-bajada">Lo abrimos en otra pestaña. Paga allí y vuelve para confirmar.</p>
              <TarjetaVisual numero={TARJETA_OCULTA} titular={razonSocial.trim().toUpperCase()} vence="" marca="Payphone" />
              <div className="ckt-medios">
                {prepData.payWithCard && (
                  <a className="ckt-btn ckt-btn-secundario" href={prepData.payWithCard} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={18} /> Abrir tarjeta
                  </a>
                )}
                {prepData.payWithPayPhone && (
                  <a className="ckt-btn ckt-btn-secundario" href={prepData.payWithPayPhone} target="_blank" rel="noopener noreferrer">
                    <Smartphone size={18} /> App Payphone
                  </a>
                )}
              </div>
              <div className="ckt-pie">
                {botonVolver(revisarDatos)}
                <button type="button" className="ckt-btn ckt-btn-primario" onClick={confirmarPagoReal}>
                  <ShieldCheck size={18} /> Ya pagué
                </button>
              </div>
            </div>
          )}

          {etapa === "procesando" && <PanelProcesando pasarela={nombrePasarela} aviso={avisoPendiente} alCerrar={reiniciarYCerrar} />}

          {etapa === "recibo" && datosRecibo && (
            <ReciboPago datos={datosRecibo} pasosSiguientes={pasosDelRecibo} alCerrar={reiniciarYCerrar} />
          )}

          {etapa === "rechazo" && (
            <PanelRechazo
              mensaje={resultadoPago?.mensaje ?? null}
              enRevision={resultadoPago?.estado === "EN_REVISION"}
              alRevisar={revisarDatos}
              alReintentar={reintentar}
              alCerrar={reiniciarYCerrar}
            />
          )}
        </div>
      </div>
    </div>
  );
}
