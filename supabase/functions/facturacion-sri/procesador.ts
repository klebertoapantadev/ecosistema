// Máquina de estados de un comprobante en la cola (PLT-006). Port de
// ProcesadorComprobantes.cs de DOMO, con las dependencias inyectadas para
// probarla sin red ni base (ver pruebas/procesador_test.ts).
//
//   PENDIENTE ─ totales, XML, firma ─▶ recepción ─┬─ RECIBIDA / 43 / 70 ─▶ RECIBIDO ─▶ autorización
//                                                 └─ DEVUELTA ─▶ DEVUELTO (+ mensajes)
//   RECIBIDO ─▶ autorización ─┬─ AUTORIZADO ─▶ XML autorizado + RIDE a Storage ▶ correo ▶ AUTORIZADO
//                             ├─ NO AUTORIZADO ─▶ NO_AUTORIZADO (+ mensajes)
//                             └─ sin respuesta ─▶ sigue RECIBIDO, reintenta con backoff hasta 48 h
//   SRI caído (red, 5xx) ─▶ mismo estado, reintento con backoff; error de datos ─▶ ERROR.
//
// Los importes los calcula aquí calcularTotales(): nunca se firman importes
// que vengan del navegador.

import { cargarCertificado, type CertificadoFirma } from "../_compartido/sri/certificado.ts";
import { claveCoincide } from "../_compartido/sri/clave-acceso.ts";
import type {
  Ambiente,
  AutorizacionSri,
  Comprobante,
  MensajeSri,
  Pago,
  Regimen,
  RespuestaAutorizacion,
  RespuestaRecepcion,
  TipoComprobante,
  TipoIdentificacion,
  Totales,
} from "../_compartido/sri/comprobante.ts";
import { numeroVisible } from "../_compartido/sri/comprobante.ts";
import { comparar, formatearImporte, sumar } from "../_compartido/sri/decimal.ts";
import { TOPE_CONSUMIDOR_FINAL } from "../_compartido/sri/catalogos.ts";
import { generarRide } from "../_compartido/sri/ride.ts";
import { autorizacionVigente, MENSAJES_YA_RECIBIDO, SriNoDisponible } from "../_compartido/sri/soap.ts";
import { calcularTotales } from "../_compartido/sri/totales.ts";
import { firmarComprobante } from "../_compartido/sri/xades.ts";
import { generarXmlAutorizado } from "../_compartido/sri/xml-autorizado.ts";
import { generarXmlComprobante } from "../_compartido/sri/xml-comprobante.ts";
import { decodeBase64 } from "jsr:@std/encoding@1.0.10/base64";

// ── Filas tal como las devuelve fac_fn_tomar_lote ────────────────────────────
export interface FilaComprobante {
  cmp_id: string;
  cmp_negocio: string;
  cmp_tipo: TipoComprobante;
  cmp_estado: "PENDIENTE" | "RECIBIDO";
  cmp_ambiente: Ambiente;
  cmp_establecimiento: string;
  cmp_punto_emision: string;
  cmp_numero: number;
  cmp_clave_acceso: string;
  cmp_fecha_emision: string;
  cmp_comprador: {
    tipo_identificacion: TipoIdentificacion;
    identificacion: string;
    razon_social: string;
    direccion: string | null;
    correo: string | null;
    telefono: string | null;
  };
  cmp_formas_pago: { forma_pago: string; total: string | number | null; plazo?: number | null; unidad_tiempo?: string | null }[];
  cmp_info_adicional: { nombre: string; valor: string }[];
  cmp_motivo: string | null;
  cmp_intentos: number;
  cmp_emitido_en: string;
}

export interface FilaLinea {
  lin_orden: number;
  lin_codigo: string;
  lin_codigo_auxiliar: string | null;
  lin_descripcion: string;
  lin_cantidad: string;
  lin_precio_unitario: string;
  lin_descuento: string;
  lin_codigo_iva: string;
  lin_detalle_linea: { nombre: string; valor: string }[];
}

export interface FilaEmisor {
  emi_ruc: string;
  emi_razon_social: string;
  emi_nombre_comercial: string | null;
  emi_direccion_matriz: string;
  emi_direccion_establecimiento: string | null;
  emi_obligado_contabilidad: boolean;
  emi_contribuyente_especial: string | null;
  emi_agente_retencion: string | null;
  emi_regimen: Regimen;
  emi_certificado_id: string | null;
  emi_correo_copia: string | null;
}

export interface ItemCola {
  comprobante: FilaComprobante;
  lineas: FilaLinea[];
  emisor: FilaEmisor;
  modifica: { numero: string; fecha_emision: string } | null;
}

export interface Adjunto {
  nombre: string;
  contenido: Uint8Array;
  tipo: string;
}

export interface Dependencias {
  tomarLote(limite: number): Promise<ItemCola[]>;
  registrarResultado(id: string, cambios: Record<string, unknown>, evento?: string, detalle?: Record<string, unknown>): Promise<void>;
  registrarCorreo(id: string, enviado: boolean, detalle: Record<string, unknown>): Promise<void>;
  obtenerCertificado(certificadoId: string): Promise<{ p12Base64: string; clave: string } | null>;
  subir(ruta: string, contenido: Uint8Array, tipo: string): Promise<void>;
  /** "sin_smtp" si el negocio no tiene correo configurado. */
  enviarCorreo(negocio: string, correo: { para: string; copia: string | null; asunto: string; html: string; adjuntos: Adjunto[] }): Promise<"enviado" | "sin_smtp">;
  recepcion(ambiente: Ambiente, xmlFirmado: string): Promise<RespuestaRecepcion>;
  autorizacion(ambiente: Ambiente, claveAcceso: string): Promise<RespuestaAutorizacion>;
  ahora(): Date;
  esperar(ms: number): Promise<void>;
  /** Cerrojo del despliegue: sin él, nada de ambiente 2 llega al SRI. */
  permitirProduccion: boolean;
}

/** Error de datos o de configuración: el comprobante pasa a ERROR con este mensaje. */
export class ErrorComprobante extends Error {}

/**
 * Fallo pasajero después de que el SRI autorizara (Storage, RIDE): el
 * comprobante sigue RECIBIDO y se reintenta. Un comprobante autorizado nunca
 * debe quedar en ERROR.
 */
export class ErrorTransitorio extends Error {}

// Backoff de reintentos (s): 5 s, 15 s, 1 min, 5 min, 30 min y luego cada hora.
const BACKOFF_S = [5, 15, 60, 300, 1800];
const LIMITE_AUTORIZACION_MS = 48 * 3_600_000;
// Mientras este worker espera la autorización, nadie más reclama el comprobante.
const RESERVA_MS = 120_000;
const ESPERA_AUTORIZACION_MS = 3_000;

export function proximoIntento(intentos: number, ahora: Date): string {
  const segundos = BACKOFF_S[Math.max(0, intentos - 1)] ?? 3600;
  return new Date(ahora.getTime() + segundos * 1000).toISOString();
}

/** Construye el contrato del generador a partir de las filas de la base. */
export function aComprobante(item: ItemCola): Comprobante {
  const c = item.comprobante;
  const e = item.emisor;
  return {
    tipo: c.cmp_tipo,
    ambiente: c.cmp_ambiente,
    claveAcceso: c.cmp_clave_acceso,
    numero: Number(c.cmp_numero),
    fechaEmision: c.cmp_fecha_emision,
    emisor: {
      ruc: e.emi_ruc,
      razonSocial: e.emi_razon_social,
      nombreComercial: e.emi_nombre_comercial,
      direccionMatriz: e.emi_direccion_matriz,
      obligadoContabilidad: e.emi_obligado_contabilidad,
      contribuyenteEspecial: e.emi_contribuyente_especial,
      agenteRetencion: e.emi_agente_retencion,
      regimen: e.emi_regimen,
    },
    establecimiento: {
      codigo: c.cmp_establecimiento,
      direccion: e.emi_direccion_establecimiento ?? e.emi_direccion_matriz,
      nombreComercial: e.emi_nombre_comercial,
    },
    puntoEmision: c.cmp_punto_emision,
    comprador: {
      tipoIdentificacion: c.cmp_comprador.tipo_identificacion,
      identificacion: c.cmp_comprador.identificacion,
      razonSocial: c.cmp_comprador.razon_social,
      direccion: c.cmp_comprador.direccion,
      correo: c.cmp_comprador.correo,
      telefono: c.cmp_comprador.telefono,
    },
    detalles: item.lineas.map((l) => ({
      orden: l.lin_orden,
      codigo: l.lin_codigo,
      codigoAuxiliar: l.lin_codigo_auxiliar,
      descripcion: l.lin_descripcion,
      cantidad: String(l.lin_cantidad),
      precioUnitario: String(l.lin_precio_unitario),
      descuento: String(l.lin_descuento),
      codigoIva: l.lin_codigo_iva,
      detallesAdicionales: l.lin_detalle_linea ?? [],
    })),
    pagos: [],
    infoAdicional: c.cmp_info_adicional ?? [],
    modifica: c.cmp_tipo === "04" && item.modifica
      ? { codDoc: "01", numero: item.modifica.numero, fechaEmision: item.modifica.fecha_emision }
      : null,
    motivo: c.cmp_motivo,
  };
}

/** Formas de pago con el total resuelto: null = por el importe total; vacío = una del total. */
export function resolverPagos(filas: FilaComprobante["cmp_formas_pago"], tipo: TipoComprobante, importeTotal: string): Pago[] {
  if (tipo === "04") return [];
  const pagos: Pago[] = (filas ?? []).map((p) => ({
    formaPago: p.forma_pago,
    total: p.total === null || p.total === undefined ? importeTotal : formatearImporte(String(p.total)),
    plazo: p.plazo ?? null,
    unidadTiempo: p.unidad_tiempo ?? null,
  }));
  if (pagos.length === 0) {
    // Venta en línea: "otros con utilización del sistema financiero".
    return [{ formaPago: "20", total: importeTotal, plazo: null, unidadTiempo: null }];
  }
  const suma = pagos.reduce((acc, p) => sumar(acc, p.total), "0");
  if (comparar(suma, importeTotal) !== 0) {
    throw new ErrorComprobante(`Las formas de pago suman ${formatearImporte(suma)} y el total es ${importeTotal}`);
  }
  return pagos;
}

function mensajeLocal(texto: string): MensajeSri[] {
  return [{ identificador: "LOCAL", mensaje: texto, informacionAdicional: null, tipo: "ERROR" }];
}

function cambiosTotales(t: Totales, pagos: Pago[]) {
  return {
    total_sin_impuestos: t.totalSinImpuestos,
    total_descuento: t.totalDescuento,
    total_iva: t.totalIva,
    importe_total: t.importeTotal,
    lineas: t.lineas.map((l) => ({ orden: l.orden, base: l.base, valor_iva: l.valorIva })),
    formas_pago: pagos.map((p) => ({ forma_pago: p.formaPago, total: p.total, plazo: p.plazo, unidad_tiempo: p.unidadTiempo })),
  };
}

export class Procesador {
  private certificados = new Map<string, CertificadoFirma>();

  constructor(private dep: Dependencias) {}

  /** Vacía la cola mientras quede tiempo. Un comprobante por vuelta (cada uno puede tardar ~65 s si el SRI va lento). */
  async procesarCola(limiteTiempoMs: number): Promise<{ procesados: number }> {
    const inicio = this.dep.ahora().getTime();
    let procesados = 0;
    while (this.dep.ahora().getTime() - inicio < limiteTiempoMs) {
      const lote = await this.dep.tomarLote(1);
      if (lote.length === 0) break;
      for (const item of lote) {
        await this.procesar(item);
        procesados++;
      }
    }
    return { procesados };
  }

  async procesar(item: ItemCola): Promise<void> {
    const c = item.comprobante;
    try {
      if (c.cmp_ambiente === 2 && !this.dep.permitirProduccion) {
        throw new ErrorComprobante("Este despliegue no tiene permitido emitir en producción (FACTURACION_PERMITIR_PRODUCCION)");
      }
      if (c.cmp_estado === "PENDIENTE") await this.enviar(item);
      else await this.autorizar(item, null);
    } catch (e) {
      await this.fallo(item, e);
    }
  }

  private async fallo(item: ItemCola, e: unknown): Promise<void> {
    const c = item.comprobante;
    if (e instanceof SriNoDisponible || e instanceof ErrorTransitorio) {
      const intentos = c.cmp_intentos + 1;
      await this.dep.registrarResultado(
        c.cmp_id,
        { intentos, proximo_intento: proximoIntento(intentos, this.dep.ahora()) },
        // Solo el primero de cada racha: un SRI caído una hora no llena la bitácora.
        c.cmp_intentos === 0 ? (e instanceof SriNoDisponible ? "sri_no_disponible" : "publicacion_pendiente") : undefined,
        { mensaje: e.message },
      );
      return;
    }
    const mensaje = e instanceof Error ? e.message : String(e);
    if (!(e instanceof ErrorComprobante)) console.error(`facturacion-sri: fallo inesperado en ${c.cmp_id}`, e);
    await this.dep.registrarResultado(
      c.cmp_id,
      { estado: "ERROR", mensajes_sri: mensajeLocal(mensaje), proximo_intento: null },
      "error",
      { mensaje },
    );
  }

  private async certificado(id: string | null): Promise<CertificadoFirma> {
    if (!id) throw new ErrorComprobante("El emisor no tiene certificado de firma asignado");
    const enCache = this.certificados.get(id);
    if (enCache) return enCache;
    const secreto = await this.dep.obtenerCertificado(id);
    if (!secreto) throw new ErrorComprobante("El certificado de firma está desactivado o no se pudo leer de Vault");
    let cert: CertificadoFirma;
    try {
      cert = await cargarCertificado(decodeBase64(secreto.p12Base64), secreto.clave);
    } catch (e) {
      throw new ErrorComprobante(`Certificado ilegible: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (cert.metadatos.validoHasta.getTime() <= this.dep.ahora().getTime()) {
      throw new ErrorComprobante("El certificado de firma está caducado");
    }
    this.certificados.set(id, cert);
    return cert;
  }

  /** Comprobante, totales y pagos listos para el XML (y para el RIDE). */
  private preparar(item: ItemCola): { comprobante: Comprobante; totales: Totales } {
    const comprobante = aComprobante(item);
    let totales: Totales;
    try {
      totales = calcularTotales(comprobante.detalles);
    } catch (e) {
      throw new ErrorComprobante(`Totales inválidos: ${e instanceof Error ? e.message : String(e)}`);
    }
    comprobante.pagos = resolverPagos(item.comprobante.cmp_formas_pago, comprobante.tipo, totales.importeTotal);
    return { comprobante, totales };
  }

  private async enviar(item: ItemCola): Promise<void> {
    const c = item.comprobante;
    const { comprobante, totales } = this.preparar(item);

    if (comprobante.comprador.tipoIdentificacion === "07" && comparar(totales.importeTotal, TOPE_CONSUMIDOR_FINAL) > 0) {
      throw new ErrorComprobante(
        `Una factura a consumidor final no puede superar ${TOPE_CONSUMIDOR_FINAL} USD: hay que identificar al comprador`,
      );
    }
    if (comprobante.tipo === "04" && !comprobante.modifica) {
      throw new ErrorComprobante("La nota de crédito no tiene la factura que modifica");
    }
    if (
      !claveCoincide(c.cmp_clave_acceso, {
        fechaEmision: comprobante.fechaEmision,
        tipo: comprobante.tipo,
        ruc: comprobante.emisor.ruc,
        ambiente: comprobante.ambiente,
        establecimiento: comprobante.establecimiento.codigo,
        puntoEmision: comprobante.puntoEmision,
        numero: comprobante.numero,
      })
    ) {
      throw new ErrorComprobante("La clave de acceso no corresponde a los datos del comprobante (¿cambió el RUC del emisor?)");
    }

    let xmlFirmado: string;
    try {
      const raiz = generarXmlComprobante(comprobante, totales);
      xmlFirmado = await firmarComprobante(raiz, await this.certificado(item.emisor.emi_certificado_id), this.dep.ahora());
    } catch (e) {
      if (e instanceof ErrorComprobante) throw e;
      throw new ErrorComprobante(`No se pudo generar o firmar el XML: ${e instanceof Error ? e.message : String(e)}`);
    }

    const recepcion = await this.dep.recepcion(comprobante.ambiente, xmlFirmado);
    const yaRecibido = recepcion.estado === "DEVUELTA" &&
      recepcion.mensajes.length > 0 &&
      recepcion.mensajes.every((m) => MENSAJES_YA_RECIBIDO.has(m.identificador));

    if (recepcion.estado !== "RECIBIDA" && !yaRecibido) {
      await this.dep.registrarResultado(
        c.cmp_id,
        { estado: "DEVUELTO", mensajes_sri: recepcion.mensajes, proximo_intento: null, ...cambiosTotales(totales, comprobante.pagos) },
        "devuelto",
        { mensajes: recepcion.mensajes },
      );
      return;
    }

    await this.dep.registrarResultado(
      c.cmp_id,
      {
        estado: "RECIBIDO",
        intentos: 0,
        mensajes_sri: recepcion.mensajes,
        certificado_id: item.emisor.emi_certificado_id,
        proximo_intento: new Date(this.dep.ahora().getTime() + RESERVA_MS).toISOString(),
        ...cambiosTotales(totales, comprobante.pagos),
      },
      "recibido",
      { ya_registrado: yaRecibido },
    );
    await this.dep.esperar(ESPERA_AUTORIZACION_MS);
    await this.autorizar({ ...item, comprobante: { ...c, cmp_estado: "RECIBIDO", cmp_intentos: 0 } }, xmlFirmado);
  }

  private async autorizar(item: ItemCola, xmlFirmado: string | null): Promise<void> {
    const c = item.comprobante;
    const respuesta = await this.dep.autorizacion(c.cmp_ambiente, c.cmp_clave_acceso);
    const a = autorizacionVigente(respuesta);

    if (!a || (a.estado !== "AUTORIZADO" && a.estado !== "NO AUTORIZADO")) {
      // Sin respuesta todavía (o EN PROCESO): se reintenta, salvo que pasen 48 h.
      if (this.dep.ahora().getTime() - Date.parse(c.cmp_emitido_en) > LIMITE_AUTORIZACION_MS) {
        throw new ErrorComprobante("El SRI no autorizó el comprobante en 48 horas: consulte su estado en SRI en Línea");
      }
      const intentos = c.cmp_intentos + 1;
      await this.dep.registrarResultado(c.cmp_id, {
        intentos,
        proximo_intento: proximoIntento(intentos, this.dep.ahora()),
        ...(a ? { mensajes_sri: a.mensajes } : {}),
      });
      return;
    }

    if (a.estado === "NO AUTORIZADO") {
      await this.dep.registrarResultado(
        c.cmp_id,
        { estado: "NO_AUTORIZADO", mensajes_sri: a.mensajes, proximo_intento: null },
        "no_autorizado",
        { mensajes: a.mensajes },
      );
      return;
    }

    await this.publicarAutorizado(item, a, xmlFirmado);
  }

  private async publicarAutorizado(item: ItemCola, a: AutorizacionSri, xmlFirmado: string | null): Promise<void> {
    const c = item.comprobante;
    const carpeta = `${c.cmp_negocio}/${c.cmp_ambiente}/${c.cmp_fecha_emision.slice(0, 4)}`;
    const rutaXml = `${carpeta}/${c.cmp_clave_acceso}.xml`;
    const rutaRide = `${carpeta}/${c.cmp_clave_acceso}.pdf`;
    let comprobante: Comprobante;
    let totales: Totales;
    let bytesXml: Uint8Array;
    let ride: Uint8Array;
    try {
      ({ comprobante, totales } = this.preparar(item));
      bytesXml = new TextEncoder().encode(generarXmlAutorizado(a, a.comprobanteXml ?? xmlFirmado ?? ""));
      ride = await generarRide(comprobante, totales, a, null);
      // upsert: un reintento sobrescribe lo que haya quedado a medias.
      await this.dep.subir(rutaXml, bytesXml, "application/xml");
      await this.dep.subir(rutaRide, ride, "application/pdf");
    } catch (e) {
      throw new ErrorTransitorio(`Autorizado por el SRI, pero falló la publicación: ${e instanceof Error ? e.message : String(e)}`);
    }

    await this.dep.registrarResultado(
      c.cmp_id,
      {
        estado: "AUTORIZADO",
        numero_autorizacion: a.numeroAutorizacion ?? c.cmp_clave_acceso,
        fecha_autorizacion: a.fechaAutorizacion,
        mensajes_sri: a.mensajes,
        xml_ruta: rutaXml,
        ride_ruta: rutaRide,
        proximo_intento: null,
        ...cambiosTotales(totales, comprobante.pagos),
      },
      "autorizado",
      { numero_autorizacion: a.numeroAutorizacion },
    );

    await this.correo(item, comprobante, [
      { nombre: `${c.cmp_clave_acceso}.xml`, contenido: bytesXml, tipo: "application/xml" },
      { nombre: `${c.cmp_clave_acceso}.pdf`, contenido: ride, tipo: "application/pdf" },
    ]);
  }

  /** XML y RIDE al comprador (entregar solo uno de los dos es falta de entrega). Su fallo no cambia el estado. */
  private async correo(item: ItemCola, comprobante: Comprobante, adjuntos: Adjunto[]): Promise<void> {
    const c = item.comprobante;
    const para = comprobante.comprador.correo;
    if (!para) {
      await this.dep.registrarCorreo(c.cmp_id, false, { motivo: "sin_correo_del_comprador" });
      return;
    }
    const tipo = comprobante.tipo === "01" ? "Factura" : "Nota de crédito";
    const numero = numeroVisible(comprobante);
    const emisor = comprobante.emisor.nombreComercial ?? comprobante.emisor.razonSocial;
    const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    try {
      const resultado = await this.dep.enviarCorreo(c.cmp_negocio, {
        para,
        copia: item.emisor.emi_correo_copia,
        asunto: `${tipo} electrónica ${numero} de ${emisor}${comprobante.ambiente === 1 ? " (PRUEBAS)" : ""}`,
        html: `<p>Estimado/a ${escapar(comprobante.comprador.razonSocial)}:</p>` +
          `<p>Adjuntamos su ${tipo.toLowerCase()} electrónica <b>${numero}</b> autorizada por el SRI ` +
          `(clave de acceso ${c.cmp_clave_acceso}), en XML y en PDF (RIDE).</p>` +
          (comprobante.ambiente === 1 ? "<p><b>Comprobante de pruebas, sin validez tributaria.</b></p>" : "") +
          `<p>${escapar(emisor)}</p>`,
        adjuntos,
      });
      await this.dep.registrarCorreo(c.cmp_id, resultado === "enviado", { para, resultado });
    } catch (e) {
      await this.dep.registrarCorreo(c.cmp_id, false, { para, error: e instanceof Error ? e.message : String(e) });
    }
  }
}
