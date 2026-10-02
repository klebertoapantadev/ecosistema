"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  PackagePlus,
  Flower2,
  Scale,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Video,
  Clock,
  BookOpen,
  Loader2,
  Wand2,
  FolderPlus,
  Share2,
  Target,
  Tag,
  Hash,
  Upload,
  Calendar,
  Power,
} from "lucide-react";
import {
  crearProductoAction,
  resolverUrlImagenDirectaAction,
  subirImagenCatalogoAction,
  CategoriaCatalogo,
  ProductoCatalogo,
} from "../acciones";
import {
  CANALES_CATALOGO_OFICIALES,
  CANALES_POR_DEFECTO,
  CANALES_REQUIEREN_IMAGEN,
  CanalVisibilidad,
} from "../canales";
import { TipoVigenciaTemporal } from "../utils/vigencia";
import { ModalCrearCategoria } from "./ModalCrearCategoria";
import { ModalGaleriaMedios } from "./ModalGaleriaMedios";
import { detectarTipoNegocio } from "../utils/negocio";


interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onProductoCreado: (prod: ProductoCatalogo) => void;
  onCategoriaCreada?: (cat: CategoriaCatalogo) => void;
  categorias: CategoriaCatalogo[];
  negocio?: string;
}

export function ModalCrearProducto({
  abierto,
  onCerrar,
  onProductoCreado,
  onCategoriaCreada,
  categorias,
  negocio = "tranqi",
}: Props) {
  const { esFloristeria, esLegal, esMantenimiento } = detectarTipoNegocio(negocio);

  const [categoriasLocales, setCategoriasLocales] = useState<CategoriaCatalogo[]>(categorias || []);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);

  useEffect(() => {
    if (categorias && categorias.length > 0) {
      setCategoriasLocales(categorias);
    }
  }, [categorias]);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.ctg_id || "");
  const [tipo, setTipo] = useState<"SERVICIO" | "SUSCRIPCION" | "FISICO" | "DIGITAL">(
    esFloristeria ? "FISICO" : "SERVICIO"
  );
  const [precioBase, setPrecioBase] = useState<number | "">("");
  const [tarifaIva, setTarifaIva] = useState<number>(15);
  const [sku, setSku] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [icono, setIcono] = useState<string>(esFloristeria ? "Sparkles" : "Scale");
  const [modalidadPago, setModalidadPago] = useState("Botón Payphone / Tarjeta / Saldo");

  // Recursos Digitales y Multimedia
  const [imagenUrl, setImagenUrl] = useState("");
  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tiempoEntrega, setTiempoEntrega] = useState(
    esFloristeria ? "🌸 Pide hoy, recibe hoy (Mismo Día)" : "24 a 48 horas hábiles"
  );
  const [beneficiosTexto, setBeneficiosTexto] = useState(
    esFloristeria
      ? "Rosas de exportación seleccionadas de tallo largo\nEnvoltura en fino papel coreano plisado\nTarjeta dedicatoria y preservante floral gratis"
      : esLegal
      ? "Asignación de abogado especialista acreditado\nRevisión jurídica previa y asesoría continua\nConstancia digital con validez legal"
      : "Diagnóstico técnico en sitio\nGarantía de servicio por 90 días"
  );
  const [requisitosTexto, setRequisitosTexto] = useState(
    esFloristeria
      ? "Dirección exacta y número de contacto del destinatario\nMensaje para la tarjeta dedicatoria"
      : "Cédula de ciudadanía o pasaporte vigente\nDocumentación básica de soporte"
  );

  // Estado Activo y Temporalidad / Vigencia Estacional
  const [proActivo, setProActivo] = useState(true);
  const [vigenciaTipo, setVigenciaTipo] = useState<TipoVigenciaTemporal>("SIEMPRE");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mensajeFueraTemporada, setMensajeFueraTemporada] = useState("");
  const [etiquetaTemporada, setEtiquetaTemporada] = useState("");

  const [resolviendoImagen, setResolviendoImagen] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [modalGaleriaAbierto, setModalGaleriaAbierto] = useState(false);
  const [exitoAutoConvertir, setExitoAutoConvertir] = useState<string | null>(null);
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<CanalVisibilidad[]>([...CANALES_POR_DEFECTO]);

  // Presets de Usos / Casos de Aplicación contextuales por industria
  const PRESETS_USOS_FLORISTERIA = [
    { clave: "cumpleanos", label: "🎂 Cumpleaños" },
    { clave: "aniversario", label: "💍 Aniversario" },
    { clave: "amor_romance", label: "❤️ Amor y Romance" },
    { clave: "pedida_mano", label: "💍 Pedida de Mano" },
    { clave: "recuperate", label: "🏥 Recupérate Pronto" },
    { clave: "agradecimiento", label: "💐 Agradecimiento" },
    { clave: "graduacion", label: "🎓 Graduación" },
    { clave: "condolencias", label: "🕊️ Condolencias / Duelo" },
    { clave: "corporativo", label: "🏢 Corporativo / Eventos" },
    { clave: "nacimiento_bebe", label: "🍼 Nacimiento / Baby" },
    { clave: "dia_madre_mujer", label: "🌸 Día Madre / Mujer" },
    { clave: "sorpresa_diaria", label: "✨ Sorpresa / Detalle" },
  ];

  const PRESETS_USOS_LEGAL = [
    { clave: "contratos_mercantil", label: "📄 Revisión de Contratos & Blindaje" },
    { clave: "tramite_notarial", label: "🏛️ Trámites Notariales & Poderes" },
    { clave: "salida_menores", label: "✈️ Salida del País de Menores" },
    { clave: "divorcio_familia", label: "💔 Divorcio por Mutuo Acuerdo / Familia" },
    { clave: "consulta_especialista", label: "⚖️ Consulta Jurídica Telemática 1 a 1" },
    { clave: "amparo_familiar", label: "🛡️ Planes de Cobertura Legal Continua" },
    { clave: "asesoria_corporativa", label: "🏢 Asesoría Corporativa & B2B" },
    { clave: "disputa_laboral", label: "💼 Asuntos Laborales & Liquidaciones" },
    { clave: "cobro_deudas", label: "💳 Cobranza y Cartera Judicial" },
    { clave: "creacion_empresa", label: "🚀 Constitución de Compañías / SAS" },
    { clave: "propiedad_intelectual", label: "💡 Registro de Marcas & Patentes (SENADI)" },
    { clave: "defensa_penal", label: "🚨 Asistencia Flagrancia & Penal" },
  ];

  const PRESETS_USOS_MANTENIMIENTO = [
    { clave: "fuga_agua", label: "🚰 Fuga de Agua / Grifería" },
    { clave: "cortocircuito_electrico", label: "⚡ Red Eléctrica / Luces" },
    { clave: "calefon_calentador", label: "🔥 Calefones y Gas" },
    { clave: "mantenimiento_preventivo", label: "🛠️ Mantenimiento Preventivo" },
    { clave: "remodelacion_hogar", label: "🧱 Remodelación / Pintura" },
    { clave: "cerrajeria_seguridad", label: "🚪 Cerrajería y Puertas" },
    { clave: "climatizacion_ac", label: "❄️ Aires y Clima" },
    { clave: "destape_tuberias", label: "🚽 Destape de Cañerías" },
    { clave: "inspeccion_diagnostico", label: "🔍 Diagnóstico Técnico" },
  ];

  const presetsUsosActivos = esFloristeria
    ? PRESETS_USOS_FLORISTERIA
    : esLegal
    ? PRESETS_USOS_LEGAL
    : PRESETS_USOS_MANTENIMIENTO;

  // Estado de Usos y Etiquetas Semánticas
  const [usosSeleccionados, setUsosSeleccionados] = useState<string[]>([]);
  const [nuevoUsoTexto, setNuevoUsoTexto] = useState("");
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [nuevaEtiquetaTexto, setNuevaEtiquetaTexto] = useState("");

  const toggleUso = (clave: string) => {
    const normalizada = clave.toLowerCase().trim();
    setUsosSeleccionados((prev) =>
      prev.includes(normalizada)
        ? prev.filter((u) => u !== normalizada)
        : [...prev, normalizada]
    );
  };

  const handleAgregarUsoPersonalizado = () => {
    const limpio = nuevoUsoTexto.trim().toLowerCase().replace(/\s+/g, "_");
    if (limpio && !usosSeleccionados.includes(limpio)) {
      setUsosSeleccionados((prev) => [...prev, limpio]);
      setNuevoUsoTexto("");
    }
  };

  const handleEliminarUso = (usoAEliminar: string) => {
    setUsosSeleccionados((prev) => prev.filter((u) => u !== usoAEliminar));
  };

  const handleAgregarEtiqueta = () => {
    const limpia = nuevaEtiquetaTexto.trim();
    if (limpia && !etiquetasSeleccionadas.includes(limpia)) {
      setEtiquetasSeleccionadas((prev) => [...prev, limpia]);
      setNuevaEtiquetaTexto("");
    }
  };

  const handleEliminarEtiqueta = (tagAEliminar: string) => {
    setEtiquetasSeleccionadas((prev) => prev.filter((t) => t !== tagAEliminar));
  };

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificación reactiva de al menos una imagen
  const tieneAlMenosUnaImagen = useMemo(() => {
    if (imagenUrl && imagenUrl.trim().length > 0) return true;
    if (albumFotosUrl && albumFotosUrl.trim().length > 0) return true;
    return false;
  }, [imagenUrl, albumFotosUrl]);

  const toggleCanal = (clave: CanalVisibilidad) => {
    if (CANALES_REQUIEREN_IMAGEN.includes(clave) && !canalesSeleccionados.includes(clave) && !tieneAlMenosUnaImagen) {
      setError("Para activar la visibilidad en E-Commerce Web o App Clientes, es obligatorio configurar al menos una imagen de portada.");
      return;
    }
    setError(null);
    setCanalesSeleccionados((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    );
  };

  const presetsEntrega = esFloristeria
    ? [
        { label: "⚡ Entrega Inmediata (45-90 min)", val: "⚡ Entrega Inmediata Express (45 - 90 min)" },
        { label: "🌸 Pide hoy, recibe hoy (Mismo Día)", val: "🌸 Pide hoy, recibe hoy (Mismo Día)" },
        { label: "✨ Elaboración Especial (24h)", val: "✨ Elaboración Especial en Taller (24 horas)" },
        { label: "📅 Entrega Programada / Fecha Especial", val: "📅 Entrega Programada / Fecha Especial" },
      ]
    : esLegal
    ? [
        { label: "⚡ Agendamiento Inmediato / Mismo Día", val: "Agendamiento inmediato / Mismo día" },
        { label: "📄 Menos de 24 horas (Dictamen Express)", val: "Menos de 24 horas" },
        { label: "⚖️ 24 a 48 horas hábiles", val: "24 a 48 horas hábiles" },
        { label: "🏛️ 7 a 15 días hábiles (Procesal / Notarial)", val: "7 a 15 días hábiles" },
      ]
    : [
        { label: "⚡ Emergencia Técnica (45-60 min)", val: "⚡ Emergencia Técnica (45 - 60 min)" },
        { label: "🔧 Turno Mismo Día", val: "🔧 Mismo Día / Turno Tarde" },
        { label: "📅 Visita Programada", val: "📅 Visita Programada" },
      ];


  if (!abierto) return null;

  // Cálculos en vivo
  const baseNum = typeof precioBase === "number" ? precioBase : 0;
  const montoIvaCalc = Number(((baseNum * tarifaIva) / 100).toFixed(2));
  const totalCalc = Number((baseNum + montoIvaCalc).toFixed(2));

  const handleNombreChange = (val: string) => {
    setNombre(val);
    const prefijo = negocio.toUpperCase().substring(0, 3);
    const clean = val
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "")
      .substring(0, 8);
    setSku(clean ? `${prefijo}-${clean}` : "");
  };

  const handleConvertirImagenGlobal = async (urlAConvertir?: string) => {
    const target = urlAConvertir !== undefined ? urlAConvertir : imagenUrl;
    if (!target.trim()) return;
    setResolviendoImagen(true);
    setExitoAutoConvertir(null);
    setError(null);
    try {
      const res = await resolverUrlImagenDirectaAction(target);
      if (res.ok && res.urlDirecta) {
        setImagenUrl(res.urlDirecta);
        setExitoAutoConvertir("¡Enlace de Google Fotos convertido con éxito a imagen directa!");
      } else {
        setError(res.error || "No se pudo convertir automáticamente la URL de Google Fotos.");
      }
    } catch (e: any) {
      setError(`Error al convertir: ${e.message || e}`);
    } finally {
      setResolviendoImagen(false);
    }
  };

  const handleSubirArchivoLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoImagen(true);
    setError(null);
    setExitoAutoConvertir(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("negocio", negocio || "comun");
      formData.append("carpeta", "portadas");
      const res = await subirImagenCatalogoAction(formData);
      if (res.ok && res.urlPublica) {
        setImagenUrl(res.urlPublica);
        setExitoAutoConvertir(`¡Imagen "${res.nombreArchivo || file.name}" cargada con éxito desde tu equipo!`);
      } else {
        setError(res.error || "No se pudo cargar la imagen seleccionada.");
      }
    } catch (err: any) {
      setError(`Error al cargar la imagen: ${err.message || err}`);
    } finally {
      setSubiendoImagen(false);
      e.target.value = "";
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("Ingresa el nombre del producto.");
      return;
    }
    if (!precioBase || Number(precioBase) <= 0) {
      setError("El precio base debe ser mayor a 0.");
      return;
    }

    setGuardando(true);

    // Validación y auto-conversión de portada si es de Google Fotos
    let imagenUrlFinal = imagenUrl.trim();
    if (
      imagenUrlFinal.includes("photos.google.com") ||
      imagenUrlFinal.includes("photos.app.goo.gl")
    ) {
      const resImg = await resolverUrlImagenDirectaAction(imagenUrlFinal);
      if (resImg.ok && resImg.urlDirecta) {
        imagenUrlFinal = resImg.urlDirecta;
        setImagenUrl(imagenUrlFinal);
      } else {
        setGuardando(false);
        setError(
          `⚠️ Advertencia de Imagen: La URL de portada es un visor web de Google Fotos que no pudo resolverse automáticamente (${resImg.error}). Asegúrate de que el álbum sea público o haz clic derecho en la foto para 'Copiar dirección de la imagen' (lh3.googleusercontent.com).`
        );
        return;
      }
    }

    const beneficios = beneficiosTexto
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const requisitos = requisitosTexto
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    try {
      const res = await crearProductoAction({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId || categorias[0]?.ctg_id,
        tipo,
        precioBase: Number(precioBase),
        tarifaIva,
        sku: sku.trim() || undefined,
        destacado,
        icono: icono as any,
        imagenUrl: imagenUrlFinal || undefined,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        beneficios,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        requisitos,
        modalidadPago,
        pro_activo: proActivo,
        vigencia_tipo: vigenciaTipo,
        fecha_inicio: fechaInicio.trim() || undefined,
        fecha_fin: fechaFin.trim() || undefined,
        mensaje_fuera_temporada: mensajeFueraTemporada.trim() || undefined,
        etiqueta_temporada: etiquetaTemporada.trim() || undefined,
        usos: usosSeleccionados,
        etiquetas: etiquetasSeleccionadas,
        canales_visibilidad: canalesSeleccionados,
        negocio,
      });

      if (res.ok && res.producto) {
        onProductoCreado(res.producto);
        onCerrar();
      } else {
        setError(res.error || "No se pudo registrar el producto.");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la creación.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: esFloristeria ? "#FFFDF8" : "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: esFloristeria ? "#FEF2F2" : "#E0F2FE",
                color: esFloristeria ? "#E11D48" : "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {esFloristeria ? <Flower2 size={20} /> : esMantenimiento ? <Wrench size={20} /> : <PackagePlus size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0F172A" }}>
                {esFloristeria
                  ? "Nuevo Arreglo / Producto Floral"
                  : esMantenimiento
                  ? "Nuevo Servicio de Mantenimiento"
                  : "Nuevo Servicio / Honorario Profesional"}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Registra tarifas, fotos de muestra, promesa de entrega y botón Payphone
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748B",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                padding: "10px 14px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Nombre */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
              Nombre del {esFloristeria ? "Arreglo / Producto Floral" : "Servicio"} *
            </label>
            <input
              type="text"
              required
              placeholder={esFloristeria ? "Ej. Bouquet Diseño Estilo Coreano" : "Ej. Elaboración de Minuta"}
              value={nombre}
              onChange={(e) => handleNombreChange(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.9rem",
                boxSizing: "border-box",
                fontWeight: 600,
              }}
            />
          </div>

          {/* Categoría y Tipo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                  Categoría / Colección *
                </label>
                <button
                  type="button"
                  onClick={() => setModalCatAbierto(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: esFloristeria ? "#E11D48" : "#0284C7",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title={esFloristeria ? "Crear nueva colección floral" : "Crear nueva categoría"}
                >
                  <FolderPlus size={13} />
                  <span>+ Nueva</span>
                </button>
              </div>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                  background: "#FFFFFF",
                }}
              >
                {categoriasLocales.map((c) => (
                  <option key={c.ctg_id} value={c.ctg_id}>
                    {c.ctg_nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Tipo de Oferta Comercial
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                  background: "#FFFFFF",
                }}
              >
                <option value="FISICO">
                  {esFloristeria
                    ? "Producto Físico / Entrega Floral a Domicilio"
                    : esMantenimiento
                    ? "Producto Físico / Repuesto"
                    : "Físico / Entrega Notarial"}
                </option>
                <option value="SERVICIO">
                  {esFloristeria
                    ? "Servicio de Decoración / Eventos"
                    : esMantenimiento
                    ? "Servicio Técnico / Reparación"
                    : "Servicio / Trámite Puntual"}
                </option>
                <option value="SUSCRIPCION">
                  {esFloristeria
                    ? "Suscripción Floral (Semanal / Mensual)"
                    : "Suscripción / Plan Periódico"}
                </option>
                <option value="DIGITAL">
                  {esFloristeria
                    ? "Tarjeta Dedicatoria Digital / Gift Card"
                    : "Producto Digital / Formato"}
                </option>
              </select>
            </div>
          </div>

          {/* CONTROL DE ESTADO ACTIVO & TEMPORALIDAD ESTACIONAL */}
          <div
            style={{
              background: !proActivo ? "#FEF2F2" : vigenciaTipo !== "SIEMPRE" ? "#FFFBEB" : "#F8FAFC",
              border: !proActivo
                ? "1.5px solid #FCA5A5"
                : vigenciaTipo !== "SIEMPRE"
                ? "1.5px solid #FDE68A"
                : "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Calendar size={16} color={!proActivo ? "#DC2626" : vigenciaTipo !== "SIEMPRE" ? "#D97706" : "#0284C7"} />
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: !proActivo ? "#991B1B" : "#1E293B", textTransform: "uppercase" }}>
                  Disponibilidad & Temporalidad Estacional
                </span>
              </div>

              {/* Switch Principal Activar / Desactivar Producto */}
              <button
                type="button"
                onClick={() => setProActivo(!proActivo)}
                style={{
                  background: proActivo ? "#ECFDF5" : "#FEF2F2",
                  border: proActivo ? "1.5px solid #10B981" : "1.5px solid #EF4444",
                  color: proActivo ? "#065F46" : "#991B1B",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <Power size={13} color={proActivo ? "#10B981" : "#EF4444"} />
                <span>{proActivo ? "🟢 Producto Activo en Catálogo" : "⚪ Producto Desactivado (Oculto)"}</span>
              </button>
            </div>

            <p style={{ fontSize: "0.73rem", color: "#64748B", margin: "0 0 10px 0" }}>
              Configura si el producto se ofrece todo el año o en una temporada especial (ej. "Bouquet San Valentín" del 10 al 15 de febrero):
            </p>

            {/* 3 Modos de Vigencia */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "10px" }}>
              <button
                type="button"
                onClick={() => setVigenciaTipo("SIEMPRE")}
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  border: vigenciaTipo === "SIEMPRE" ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                  background: vigenciaTipo === "SIEMPRE" ? "#E0F2FE" : "#FFFFFF",
                  color: vigenciaTipo === "SIEMPRE" ? "#0369A1" : "#475569",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                🌐 Todo el Año
              </button>

              <button
                type="button"
                onClick={() => setVigenciaTipo("RANGO_FECHAS")}
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  border: vigenciaTipo === "RANGO_FECHAS" ? "1.5px solid #8B5CF6" : "1px solid #CBD5E1",
                  background: vigenciaTipo === "RANGO_FECHAS" ? "#F5F3FF" : "#FFFFFF",
                  color: vigenciaTipo === "RANGO_FECHAS" ? "#5B21B6" : "#475569",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                📅 Rango Fechas
              </button>

              <button
                type="button"
                onClick={() => {
                  setVigenciaTipo("ESTACIONAL_ANUAL");
                  if (!fechaInicio) setFechaInicio("02-10");
                  if (!fechaFin) setFechaFin("02-15");
                  if (!etiquetaTemporada) setEtiquetaTemporada(esFloristeria ? "San Valentín" : "Temporada Anual");
                  if (!mensajeFueraTemporada) setMensajeFueraTemporada("Disponible únicamente del 10 al 15 de febrero de cada año.");
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  border: vigenciaTipo === "ESTACIONAL_ANUAL" ? "1.5px solid #E11D48" : "1px solid #CBD5E1",
                  background: vigenciaTipo === "ESTACIONAL_ANUAL" ? "#FFF1F2" : "#FFFFFF",
                  color: vigenciaTipo === "ESTACIONAL_ANUAL" ? "#9F1239" : "#475569",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <Clock size={13} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                Estacional Anual
              </button>
            </div>

            {/* Campos contextuales para Rango de Fechas o Estacional Anual */}
            {vigenciaTipo === "RANGO_FECHAS" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                    Fecha de Inicio (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                      background: "#FFFFFF",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                    Fecha de Fin (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                      background: "#FFFFFF",
                    }}
                  />
                </div>
              </div>
            )}

            {vigenciaTipo === "ESTACIONAL_ANUAL" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      Fecha Inicio Anual (MM-DD, ej. 02-10)
                    </label>
                    <input
                      type="text"
                      placeholder="MM-DD (ej. 02-10)"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      Fecha Fin Anual (MM-DD, ej. 02-15)
                    </label>
                    <input
                      type="text"
                      placeholder="MM-DD (ej. 02-15)"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      Etiqueta de Temporada
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. San Valentín"
                      value={etiquetaTemporada}
                      onChange={(e) => setEtiquetaTemporada(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      Mensaje fuera de temporada
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Disponible únicamente del 10 al 15 de febrero."
                      value={mensajeFueraTemporada}
                      onChange={(e) => setMensajeFueraTemporada(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tarifa Base e IVA */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Precio Base Imponible ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={precioBase}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setPrecioBase("");
                      return;
                    }
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                      setPrecioBase(Math.round(num * 100) / 100);
                    }
                  }}
                  onBlur={() => {
                    if (typeof precioBase === "number" && !isNaN(precioBase)) {
                      setPrecioBase(parseFloat(precioBase.toFixed(2)));
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    boxSizing: "border-box",
                    color: "#0F172A",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Tarifa IVA SRI (Ecuador)
                </label>
                <select
                  value={tarifaIva}
                  onChange={(e) => setTarifaIva(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                    background: "#FFFFFF",
                  }}
                >
                  <option value={15}>IVA 15% (Estándar SRI)</option>
                  <option value={0}>IVA 0% (Exento SRI)</option>
                </select>
              </div>
            </div>

            {/* Resumen en vivo */}
            <div
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span style={{ color: "#64748B" }}>Base: </span>
                <strong style={{ color: "#0F172A" }}>${baseNum.toFixed(2)}</strong>
                <span style={{ margin: "0 6px", color: "#CBD5E1" }}>|</span>
                <span style={{ color: "#64748B" }}>IVA ({tarifaIva}%): </span>
                <strong style={{ color: "#0F172A" }}>${montoIvaCalc.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", marginRight: "6px" }}>Total Payphone:</span>
                <strong style={{ color: "#059669", fontSize: "1.05rem", fontWeight: 800 }}>
                  ${totalCalc.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          {/* Recursos Digitales */}
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <ImageIcon size={16} color="#15803D" />
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#15803D", textTransform: "uppercase" }}>
                Recursos Digitales (Fotos Reales, Álbum y Video/GIF)
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                    URL Imagen de Portada Principal *
                  </label>
                  {(imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl")) && (
                    <span style={{ fontSize: "0.68rem", color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                      <AlertCircle size={12} /> Requiere Extracción
                    </span>
                  )}
                  {imagenUrl.includes("lh3.googleusercontent.com") && (
                    <span style={{ fontSize: "0.68rem", color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                      <CheckCircle2 size={12} /> Imagen Directa
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="url"
                    placeholder="https://... o sube una imagen desde tu PC ➔"
                    value={imagenUrl}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
                      if (driveMatch && driveMatch[1]) {
                        setImagenUrl(`https://lh3.googleusercontent.com/d/${driveMatch[1]}=w1200`);
                      } else {
                        setImagenUrl(raw);
                      }
                      setExitoAutoConvertir(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: (imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl")) ? "1.5px solid #F59E0B" : "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                    }}
                  />

                  <label
                    style={{
                      background: subiendoImagen ? "#94A3B8" : "#15803D",
                      color: "#FFFFFF",
                      padding: "7px 11px",
                      borderRadius: "6px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: subiendoImagen ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}
                    title="Seleccionar foto desde tu disco local o Google Drive en PC"
                  >
                    {subiendoImagen ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={13} />
                        <span>📁 Subir PC</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={subiendoImagen}
                      onChange={handleSubirArchivoLocal}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setModalGaleriaAbierto(true)}
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "7px 11px",
                      borderRadius: "6px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      boxShadow: "0 1px 2px rgba(2, 132, 199, 0.2)",
                    }}
                    title="Abrir galería de imágenes del negocio"
                  >
                    <ImageIcon size={13} />
                    <span>🖼️ Galería</span>
                  </button>
                </div>

                {exitoAutoConvertir && (
                  <div style={{ marginTop: "4px", fontSize: "0.7rem", color: "#15803D", background: "#DCFCE7", padding: "4px 8px", borderRadius: "4px", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={13} /> {exitoAutoConvertir}
                  </div>
                )}

                {(imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl") || imagenUrl.includes("drive.google.com/drive")) && (
                  <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "#92400E", background: "#FEF3C7", padding: "8px 10px", borderRadius: "6px", border: "1px solid #FDE68A", lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 800, marginBottom: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertCircle size={13} color="#D97706" /> Enlace de Álbum Web Detectado
                    </div>
                    <div>Este enlace abre el visor web de Google Fotos, no un archivo de imagen directo (.jpg).</div>
                    <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        disabled={resolviendoImagen}
                        onClick={() => handleConvertirImagenGlobal()}
                        style={{
                          background: "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "4px 9px",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          cursor: resolviendoImagen ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {resolviendoImagen ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Extrayendo Directa...
                          </>
                        ) : (
                          <>
                            <Wand2 size={12} /> 🪄 Auto-Convertir Foto
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAlbumFotosUrl(imagenUrl);
                          setImagenUrl("");
                        }}
                        style={{
                          background: "#B45309",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        📁 Mover a "Álbum de Muestras"
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                  URL Álbum de Fotos / Muestras (Google Photos)
                </label>
                <input
                  type="url"
                  placeholder="https://photos.app.goo.gl/... o drive"
                  value={albumFotosUrl}
                  onChange={(e) => setAlbumFotosUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                URL Video / GIF Demostrativo (YouTube / MP4)
              </label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=... o archivo .mp4 / .gif"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.8rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Tiempo de Entrega */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
              Promesa y Tiempo de Entrega al Cliente *
            </label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
              {presetsEntrega.map((pr) => (
                <button
                  key={pr.val}
                  type="button"
                  onClick={() => setTiempoEntrega(pr.val)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    border: tiempoEntrega === pr.val ? "1.5px solid #16A34A" : "1px solid #CBD5E1",
                    background: tiempoEntrega === pr.val ? "#DCFCE7" : "#FFFFFF",
                    color: tiempoEntrega === pr.val ? "#15803D" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {pr.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              placeholder="Ej. 🌸 Pide hoy, recibe hoy (Mismo Día)"
              value={tiempoEntrega}
              onChange={(e) => setTiempoEntrega(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Canales de Visibilidad y Distribución */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1.5px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Share2 size={16} color="#0284C7" />
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                  Canales de Visibilidad y Distribución
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
                {canalesSeleccionados.length} de {CANALES_CATALOGO_OFICIALES.length} activos
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "0 0 10px 0" }}>
              Indica en qué plataformas, aplicaciones y agentes de IA estará disponible este producto:
            </p>

            {!tieneAlMenosUnaImagen && (
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "0.74rem",
                  color: "#92400E",
                  lineHeight: "1.35",
                }}
              >
                <AlertCircle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ fontWeight: 800 }}>Control de Calidad Visual:</strong> Los canales <strong>E-Commerce Web</strong> y <strong>App Clientes</strong> requieren al menos 1 imagen configurada para poder activarse y ser visibles al público.
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {CANALES_CATALOGO_OFICIALES.map((c) => {
                const activo = canalesSeleccionados.includes(c.clave);
                const exigeImagenYFalta = CANALES_REQUIEREN_IMAGEN.includes(c.clave) && !tieneAlMenosUnaImagen;

                return (
                  <button
                    key={c.clave}
                    type="button"
                    onClick={() => toggleCanal(c.clave)}
                    title={
                      exigeImagenYFalta
                        ? `Requiere al menos 1 imagen configurada para activarse en ${c.nombre}`
                        : undefined
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: `1.5px solid ${activo ? c.color : exigeImagenYFalta ? "#CBD5E1" : "#E2E8F0"}`,
                      background: activo ? `${c.color}12` : exigeImagenYFalta ? "#F1F5F9" : "#FFFFFF",
                      color: activo ? "#0F172A" : exigeImagenYFalta ? "#94A3B8" : "#64748B",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: activo ? 700 : 500,
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      opacity: exigeImagenYFalta && !activo ? 0.75 : 1,
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: activo ? c.color : "#CBD5E1",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.nombre}
                      </div>
                      {exigeImagenYFalta && (
                        <span style={{ fontSize: "0.65rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "4px", padding: "1px 4px", marginLeft: "4px", fontWeight: 700 }}>
                          📷 Foto req.
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Usos y Aplicaciones Recomendadas */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1.5px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Target size={16} color="#0284C7" />
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                  {esFloristeria ? "Usos y Ocasiones Recomendadas (IA & Filtros)" : "Usos y Casos de Aplicación (IA & Filtros)"}
                </span>
              </div>
              <span style={{ fontSize: "0.74rem", color: "#0369A1", fontWeight: 700, background: "#E0F2FE", padding: "2px 8px", borderRadius: "12px" }}>
                {usosSeleccionados.length} usos activos
              </span>
            </div>
            <p style={{ fontSize: "0.73rem", color: "#64748B", margin: "0 0 10px 0", lineHeight: 1.4 }}>
              Marca los escenarios donde los agentes de IA (como ARIA) deben recomendar este ítem:
            </p>

            {/* Grid de Presets */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "6px", marginBottom: "10px" }}>
              {presetsUsosActivos.map((u) => {
                const activo = usosSeleccionados.includes(u.clave);
                return (
                  <button
                    key={u.clave}
                    type="button"
                    onClick={() => toggleUso(u.clave)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: activo ? 700 : 500,
                      border: activo ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                      background: activo ? "#F0F9FF" : "#FFFFFF",
                      color: activo ? "#0369A1" : "#475569",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.label}
                    </span>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: activo ? "#0284C7" : "#CBD5E1",
                        flexShrink: 0,
                        marginLeft: "6px",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Usos Personalizados */}
            {usosSeleccionados.filter((u) => !presetsUsosActivos.some((p) => p.clave === u)).length > 0 && (
              <div style={{ marginBottom: "10px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "#64748B", fontWeight: 600 }}>Personalizados:</span>
                {usosSeleccionados
                  .filter((u) => !presetsUsosActivos.some((p) => p.clave === u))
                  .map((u) => (
                    <span
                      key={u}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        border: "1px solid #BFDBFE",
                        borderRadius: "12px",
                        padding: "2px 8px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      🏷️ {u.replace(/_/g, " ")}
                      <button
                        type="button"
                        onClick={() => handleEliminarUso(u)}
                        style={{ background: "none", border: "none", color: "#93C5FD", cursor: "pointer", padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
              </div>
            )}

            {/* Input para agregar uso libre */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Escribir otro uso personalizado..."
                value={nuevoUsoTexto}
                onChange={(e) => setNuevoUsoTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAgregarUsoPersonalizado();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.76rem",
                  background: "#FFFFFF",
                }}
              />
              <button
                type="button"
                onClick={handleAgregarUsoPersonalizado}
                style={{
                  background: "#0F172A",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Agregar Uso
              </button>
            </div>
          </div>

          {/* Etiquetas Semánticas */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1.5px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Tag size={16} color="#0284C7" />
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                  Etiquetas Semánticas de Búsqueda (Keywords IA)
                </span>
              </div>
              <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: 600 }}>
                {etiquetasSeleccionadas.length} etiquetas
              </span>
            </div>
            <p style={{ fontSize: "0.73rem", color: "#64748B", margin: "0 0 10px 0" }}>
              Palabras clave adicionales para búsqueda por texto y lenguaje natural (ej. <em>coreano</em>, <em>rosas rojas</em>):
            </p>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px", minHeight: "26px", alignItems: "center" }}>
              {etiquetasSeleccionadas.length === 0 ? (
                <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontStyle: "italic" }}>
                  Sin etiquetas asignadas.
                </span>
              ) : (
                etiquetasSeleccionadas.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#F1F5F9",
                      color: "#334155",
                      border: "1px solid #CBD5E1",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                    }}
                  >
                    <Hash size={12} color="#64748B" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleEliminarEtiqueta(tag)}
                      style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Escribir etiqueta y presionar Enter..."
                value={nuevaEtiquetaTexto}
                onChange={(e) => setNuevaEtiquetaTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAgregarEtiqueta();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.76rem",
                  background: "#FFFFFF",
                }}
              />
              <button
                type="button"
                onClick={handleAgregarEtiqueta}
                style={{
                  background: "#0284C7",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Añadir Tag
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              paddingTop: "14px",
              borderTop: "1px solid #E2E8F0",
            }}
          >
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: "#F1F5F9",
                color: "#475569",
                border: "none",
                padding: "9px 16px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              style={{
                background: esFloristeria ? "#E11D48" : "#0284C7",
                color: "#FFFFFF",
                border: "none",
                padding: "9px 20px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <CheckCircle2 size={16} />
              <span>{guardando ? "Registrando..." : "Crear Producto"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal para Crear Nueva Categoría / Colección en línea */}
      <ModalCrearCategoria
        abierto={modalCatAbierto}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => {
          setCategoriasLocales((prev) => [...prev, nueva]);
          setCategoriaId(nueva.ctg_id);
          if (onCategoriaCreada) {
            onCategoriaCreada(nueva);
          }
        }}
        negocio={negocio}
      />

      {/* Modal Galería y Biblioteca Multimedia por Negocio */}
      <ModalGaleriaMedios
        abierto={modalGaleriaAbierto}
        onCerrar={() => setModalGaleriaAbierto(false)}
        negocio={negocio}
        onSeleccionarImagen={(url) => {
          setImagenUrl(url);
          setExitoAutoConvertir("¡Imagen seleccionada desde la galería del negocio!");
        }}
        titulo={`Biblioteca de Medios (${negocio.toUpperCase()})`}
      />
    </div>
  );
}
