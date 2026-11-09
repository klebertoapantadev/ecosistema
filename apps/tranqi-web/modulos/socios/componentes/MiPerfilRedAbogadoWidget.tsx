"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  MapPin,
  Calendar,
  CalendarPlus,
  Clock,
  Video,
  Building2,
  CheckCircle2,
  Plus,
  RotateCcw,
  Trash2,
  Save,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { huecosPorSemana, type Franja } from "@eco/agenda";
import {
  obtenerMiPerfilAbogadoCompletoAction,
  guardarMiPerfilYEspecialidadesAbogadoAction,
  guardarDisponibilidadCitasAbogadoAction,
  type AbogadoRedItem,
  type MateriaItem,
  type ProvinciaItem,
  type ConfiguracionAgendaAbogado,
  type FechaEspecialAbogado,
} from "../acciones-red-profesional";

interface FranjaSimpleDia {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

const DIAS_SEMANA_ORDENADOS: Array<{ dia: number; nombre: string }> = [
  { dia: 1, nombre: "Lunes" },
  { dia: 2, nombre: "Martes" },
  { dia: 3, nombre: "Miércoles" },
  { dia: 4, nombre: "Jueves" },
  { dia: 5, nombre: "Viernes" },
  { dia: 6, nombre: "Sábado" },
  { dia: 0, nombre: "Domingo" },
];

const FRANJAS_VIRTUAL_DEFECTO: FranjaSimpleDia[] = [
  { dia_semana: 1, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 2, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 3, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 4, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 5, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 6, hora_inicio: "09:00", hora_fin: "14:00" },
];

const FRANJAS_PRESENCIAL_DEFECTO: FranjaSimpleDia[] = [
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:30" },
];

const FECHAS_ESPECIALES_DEFECTO: FechaEspecialAbogado[] = [
  {
    fecha: "2026-12-25",
    nombre: "Navidad (Solo Teleconsultas 08:00 a 16:00)",
    cerrado_total: false,
    habilitar_virtual: true,
    franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "16:00" }],
    habilitar_presencial: false,
    franjas_presencial: [],
  },
];

const CONFIG_AGENDA_BASE: ConfiguracionAgendaAbogado = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 2,
  horizonte_dias: 60,
  modalidades: ["virtual", "presencial"],
  acepta_turno: true,
  direccion: "Despacho Central Tranqi · Quito, Ecuador",
  fechas_especiales: FECHAS_ESPECIALES_DEFECTO,
};

const PROVINCIAS_ECUADOR_INICIALES: ProvinciaItem[] = [
  { cat_id: "00000000-0000-4000-8000-000000000101", cat_nombre: "Azuay", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000102", cat_nombre: "Bolívar", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000103", cat_nombre: "Cañar", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000104", cat_nombre: "Carchi", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000105", cat_nombre: "Chimborazo", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000106", cat_nombre: "Cotopaxi", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000107", cat_nombre: "El Oro", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000108", cat_nombre: "Esmeraldas", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000109", cat_nombre: "Galápagos", cat_region: "Insular" },
  { cat_id: "00000000-0000-4000-8000-000000000110", cat_nombre: "Guayas", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000111", cat_nombre: "Imbabura", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000112", cat_nombre: "Loja", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000113", cat_nombre: "Los Ríos", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000114", cat_nombre: "Manabí", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000115", cat_nombre: "Morona Santiago", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000116", cat_nombre: "Napo", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000117", cat_nombre: "Orellana", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000118", cat_nombre: "Pastaza", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000119", cat_nombre: "Pichincha", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000120", cat_nombre: "Santa Elena", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000121", cat_nombre: "Santo Domingo de los Tsáchilas", cat_region: "Costa" },
  { cat_id: "00000000-0000-4000-8000-000000000122", cat_nombre: "Sucumbíos", cat_region: "Amazonía" },
  { cat_id: "00000000-0000-4000-8000-000000000123", cat_nombre: "Tungurahua", cat_region: "Sierra" },
  { cat_id: "00000000-0000-4000-8000-000000000124", cat_nombre: "Zamora Chinchipe", cat_region: "Amazonía" },
];

const inputBaseStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  padding: "8px 12px",
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "#0F172A",
  outline: "none",
};

const labelBaseStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "6px",
};

function descomponerFranjasPorModalidad(franjas: Franja[]): {
  virtual: FranjaSimpleDia[];
  presencial: FranjaSimpleDia[];
} {
  if (!Array.isArray(franjas) || franjas.length === 0) {
    return {
      virtual: FRANJAS_VIRTUAL_DEFECTO,
      presencial: FRANJAS_PRESENCIAL_DEFECTO,
    };
  }

  const virtual: FranjaSimpleDia[] = [];
  const presencial: FranjaSimpleDia[] = [];

  for (const f of franjas) {
    const item: FranjaSimpleDia = {
      dia_semana: Number(f.dia_semana) % 7,
      hora_inicio: String(f.hora_inicio || "09:00").slice(0, 5),
      hora_fin: String(f.hora_fin || "17:00").slice(0, 5),
    };
    if (f.modalidad === "virtual") {
      virtual.push(item);
    } else if (f.modalidad === "presencial") {
      presencial.push(item);
    } else {
      virtual.push({ ...item });
      presencial.push({ ...item });
    }
  }

  return {
    virtual: virtual.length > 0 ? virtual : FRANJAS_VIRTUAL_DEFECTO,
    presencial: presencial.length > 0 ? presencial : FRANJAS_PRESENCIAL_DEFECTO,
  };
}

function unificarFranjasDesdeColumnas(
  virtual: FranjaSimpleDia[],
  presencial: FranjaSimpleDia[]
): Franja[] {
  const resultado: Franja[] = [];
  for (const f of virtual) {
    resultado.push({
      dia_semana: Number(f.dia_semana) % 7,
      hora_inicio: f.hora_inicio.slice(0, 5),
      hora_fin: f.hora_fin.slice(0, 5),
      modalidad: "virtual",
    });
  }
  for (const f of presencial) {
    resultado.push({
      dia_semana: Number(f.dia_semana) % 7,
      hora_inicio: f.hora_inicio.slice(0, 5),
      hora_fin: f.hora_fin.slice(0, 5),
      modalidad: "presencial",
    });
  }
  return resultado;
}

export function MiPerfilRedAbogadoWidget({
  tabInicial = "especialidades",
}: {
  tabInicial?: "especialidades" | "disponibilidad" | "perfil";
}) {
  const [tab, setTab] = useState<"especialidades" | "disponibilidad">(
    tabInicial === "disponibilidad" ? "disponibilidad" : "especialidades"
  );
  const [cargando, setCargando] = useState(true);
  const [, setAbogado] = useState<AbogadoRedItem | null>(null);
  const [catalogoMaterias, setCatalogoMaterias] = useState<MateriaItem[]>([]);
  const [catalogoProvincias, setCatalogoProvincias] = useState<ProvinciaItem[]>(
    PROVINCIAS_ECUADOR_INICIALES
  );

  // Campos de Especialidades y Cobertura
  const [matricula, setMatricula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [universidad, setUniversidad] = useState("");
  const [anosExperiencia, setAnosExperiencia] = useState<number>(3);
  const [resumenProfesional, setResumenProfesional] = useState("");
  const [materiasIds, setMateriasIds] = useState<string[]>([]);
  const [provinciasIds, setProvinciasIds] = useState<string[]>([]);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  // Campos de Disponibilidad Citas (mismo diseño que el Operador: Telemáticas + Oficina + Fechas Especiales)
  const [configAgenda, setConfigAgenda] = useState<ConfiguracionAgendaAbogado>(CONFIG_AGENDA_BASE);
  const [franjasVirtual, setFranjasVirtual] = useState<FranjaSimpleDia[]>(FRANJAS_VIRTUAL_DEFECTO);
  const [franjasPresencial, setFranjasPresencial] = useState<FranjaSimpleDia[]>(
    FRANJAS_PRESENCIAL_DEFECTO
  );
  const [fechasEspeciales, setFechasEspeciales] = useState<FechaEspecialAbogado[]>(
    FECHAS_ESPECIALES_DEFECTO
  );
  const [guardandoAgenda, setGuardandoAgenda] = useState(false);

  // Formulario rápido para agregar Fecha Exacta Diferenciada (Ausencia / Feriado / Jornada Especial)
  const [nuevaFecha, setNuevaFecha] = useState<string>("2026-12-24");
  const [nuevoNombreFecha, setNuevoNombreFecha] = useState<string>(
    "Nochebuena (Horario Especial)"
  );
  const [nuevoCerradoTotal, setNuevoCerradoTotal] = useState<boolean>(false);
  const [nuevoHabilitarVirtual, setNuevoHabilitarVirtual] = useState<boolean>(true);
  const [nuevoVirtualInicio, setNuevoVirtualInicio] = useState<string>("08:00");
  const [nuevoVirtualFin, setNuevoVirtualFin] = useState<string>("14:00");
  const [nuevoHabilitarPresencial, setNuevoHabilitarPresencial] = useState<boolean>(false);
  const [nuevoPresencialInicio, setNuevoPresencialInicio] = useState<string>("09:00");
  const [nuevoPresencialFin, setNuevoPresencialFin] = useState<string>("13:00");

  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const res = await obtenerMiPerfilAbogadoCompletoAction();
      if (res.ok) {
        if (res.data.catalogoMaterias.length > 0) {
          setCatalogoMaterias(res.data.catalogoMaterias);
        }
        const listaProv =
          res.data.catalogoProvincias.length > 0
            ? res.data.catalogoProvincias
            : PROVINCIAS_ECUADOR_INICIALES;
        setCatalogoProvincias(listaProv);
        if (res.data.abogado) {
          const a = res.data.abogado;
          setAbogado(a);
          setMatricula(a.matriculaProfesional);
          setTelefono(a.telefono);
          setUniversidad(a.universidad);
          setAnosExperiencia(a.anosExperiencia || 1);
          setResumenProfesional(a.resumenProfesional);
          setMateriasIds(a.materias.map((m) => m.mat_id));
          setProvinciasIds(
            a.provincias.map((p) => {
              const porId = listaProv.find((cat) => cat.cat_id === p.cat_id);
              if (porId) return porId.cat_id;
              const porNombre = listaProv.find(
                (cat) => cat.cat_nombre.toLowerCase() === p.cat_nombre.toLowerCase()
              );
              return porNombre ? porNombre.cat_id : p.cat_id;
            })
          );
          const cfg = a.configuracionAgenda || CONFIG_AGENDA_BASE;
          setConfigAgenda({
            ...CONFIG_AGENDA_BASE,
            ...cfg,
            direccion: cfg.direccion || CONFIG_AGENDA_BASE.direccion,
          });
          const separadas = descomponerFranjasPorModalidad(a.franjas);
          setFranjasVirtual(separadas.virtual);
          setFranjasPresencial(separadas.presencial);
          setFechasEspeciales(
            Array.isArray(cfg.fechas_especiales) && cfg.fechas_especiales.length > 0
              ? cfg.fechas_especiales
              : FECHAS_ESPECIALES_DEFECTO
          );
        }
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const toggleMateria = (id: string) => {
    setMateriasIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleProvincia = (id: string) => {
    setProvinciasIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  function actualizarFranja(
    tipo: "virtual" | "presencial",
    indice: number,
    parcial: Partial<FranjaSimpleDia>
  ) {
    setMensaje(null);
    if (tipo === "virtual") {
      setFranjasVirtual((prev) => prev.map((f, i) => (i === indice ? { ...f, ...parcial } : f)));
    } else {
      setFranjasPresencial((prev) => prev.map((f, i) => (i === indice ? { ...f, ...parcial } : f)));
    }
  }

  function agregarFranja(tipo: "virtual" | "presencial") {
    setMensaje(null);
    if (tipo === "virtual") {
      setFranjasVirtual((prev) => [
        ...prev,
        { dia_semana: 1, hora_inicio: "08:00", hora_fin: "19:00" },
      ]);
    } else {
      setFranjasPresencial((prev) => [
        ...prev,
        { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:30" },
      ]);
    }
  }

  function eliminarFranja(tipo: "virtual" | "presencial", indice: number) {
    setMensaje(null);
    if (tipo === "virtual") {
      setFranjasVirtual((prev) => prev.filter((_, i) => i !== indice));
    } else {
      setFranjasPresencial((prev) => prev.filter((_, i) => i !== indice));
    }
  }

  function agregarOActualizarFechaEspecial(item: FechaEspecialAbogado) {
    setMensaje(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) {
      setMensaje({ tipo: "error", texto: "Selecciona una fecha exacta válida (AAAA-MM-DD)." });
      return;
    }
    if (!item.nombre.trim()) {
      setMensaje({
        tipo: "error",
        texto: "Ingresa un nombre o motivo para la fecha especial (ej. Navidad, Audiencia).",
      });
      return;
    }
    setFechasEspeciales((prev) => {
      const actuales = [...prev];
      const idx = actuales.findIndex((f) => f.fecha === item.fecha);
      if (idx >= 0) {
        actuales[idx] = item;
      } else {
        actuales.push(item);
      }
      actuales.sort((a, b) => a.fecha.localeCompare(b.fecha));
      return actuales;
    });
  }

  function handleAgregarFechaDesdeFormulario() {
    agregarOActualizarFechaEspecial({
      fecha: nuevaFecha,
      nombre: nuevoNombreFecha.trim() || "Horario Especial",
      cerrado_total: nuevoCerradoTotal,
      habilitar_virtual: nuevoCerradoTotal ? false : nuevoHabilitarVirtual,
      franjas_virtual:
        !nuevoCerradoTotal && nuevoHabilitarVirtual
          ? [{ hora_inicio: nuevoVirtualInicio, hora_fin: nuevoVirtualFin }]
          : [],
      habilitar_presencial: nuevoCerradoTotal ? false : nuevoHabilitarPresencial,
      franjas_presencial:
        !nuevoCerradoTotal && nuevoHabilitarPresencial
          ? [{ hora_inicio: nuevoPresencialInicio, hora_fin: nuevoPresencialFin }]
          : [],
    });
  }

  function aplicarPlantillaFechaEspecial(
    tipo: "navidad" | "nochebuena" | "fin_anio" | "anio_nuevo"
  ) {
    if (tipo === "navidad") {
      agregarOActualizarFechaEspecial({
        fecha: "2026-12-25",
        nombre: "Navidad (Solo Teleconsultas 08:00 a 16:00)",
        cerrado_total: false,
        habilitar_virtual: true,
        franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "16:00" }],
        habilitar_presencial: false,
        franjas_presencial: [],
      });
    } else if (tipo === "nochebuena") {
      agregarOActualizarFechaEspecial({
        fecha: "2026-12-24",
        nombre: "Nochebuena (Solo Teleconsultas 08:00 a 14:00)",
        cerrado_total: false,
        habilitar_virtual: true,
        franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "14:00" }],
        habilitar_presencial: false,
        franjas_presencial: [],
      });
    } else if (tipo === "fin_anio") {
      agregarOActualizarFechaEspecial({
        fecha: "2026-12-31",
        nombre: "Fin de Año (Solo Teleconsultas 08:00 a 14:00)",
        cerrado_total: false,
        habilitar_virtual: true,
        franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "14:00" }],
        habilitar_presencial: false,
        franjas_presencial: [],
      });
    } else {
      agregarOActualizarFechaEspecial({
        fecha: "2027-01-01",
        nombre: "Año Nuevo (Feriado Cerrado)",
        cerrado_total: true,
        habilitar_virtual: false,
        franjas_virtual: [],
        habilitar_presencial: false,
        franjas_presencial: [],
      });
    }
  }

  function eliminarFechaEspecial(fechaClave: string) {
    setMensaje(null);
    setFechasEspeciales((prev) => prev.filter((f) => f.fecha !== fechaClave));
  }

  const handleGuardarEspecialidades = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoPerfil(true);
    setMensaje(null);
    try {
      const res = await guardarMiPerfilYEspecialidadesAbogadoAction({
        telefono,
        matriculaProfesional: matricula,
        universidad,
        anosExperiencia,
        resumenProfesional,
        materiasIds,
        provinciasIds,
      });
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: "Especialidades legales y zonas de cobertura actualizadas correctamente.",
      });
      await cargarDatos();
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const franjasUnificadas = useMemo(
    () => unificarFranjasDesdeColumnas(franjasVirtual, franjasPresencial),
    [franjasVirtual, franjasPresencial]
  );

  const handleGuardarDisponibilidad = async () => {
    setGuardandoAgenda(true);
    setMensaje(null);
    try {
      const modalidadesActivas: ("virtual" | "presencial")[] = [];
      if (franjasVirtual.length > 0) modalidadesActivas.push("virtual");
      if (franjasPresencial.length > 0) modalidadesActivas.push("presencial");
      if (modalidadesActivas.length === 0) {
        modalidadesActivas.push("virtual", "presencial");
      }

      const res = await guardarDisponibilidadCitasAbogadoAction({
        configuracion: {
          ...configAgenda,
          modalidades: modalidadesActivas,
          fechas_especiales: fechasEspeciales,
        },
        franjas: franjasUnificadas,
      });
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto:
          "Horarios de atención (Telemático y Oficina) y fechas diferenciadas guardados correctamente.",
      });
      await cargarDatos();
    } finally {
      setGuardandoAgenda(false);
    }
  };

  const huecosSemanales = useMemo(() => {
    try {
      return huecosPorSemana({ configuracion: configAgenda, franjas: franjasUnificadas });
    } catch {
      return 0;
    }
  }, [configAgenda, franjasUnificadas]);

  if (cargando) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#6B7280", fontWeight: 600 }}>
        Cargando tu ficha profesional, especialidades y disponibilidad...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {/* Navegación de Pestañas */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          borderBottom: "1px solid #E5E7EB",
          paddingBottom: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("especialidades")}
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            border: tab === "especialidades" ? "2px solid #05876E" : "1px solid #D1D5DB",
            background: tab === "especialidades" ? "#ECFDF5" : "#ffffff",
            color: tab === "especialidades" ? "#065F46" : "#374151",
            fontWeight: 800,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Scale size={16} />
          1. Mis Especialidades y Zonas de Cobertura
        </button>

        <button
          type="button"
          onClick={() => setTab("disponibilidad")}
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            border: tab === "disponibilidad" ? "2px solid #5000BA" : "1px solid #D1D5DB",
            background: tab === "disponibilidad" ? "#F5F3FF" : "#ffffff",
            color: tab === "disponibilidad" ? "#5000BA" : "#374151",
            fontWeight: 800,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Calendar size={16} />
          2. Disponibilidad Citas (Presencial / Teleconsulta)
        </button>
      </div>

      {mensaje && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "12px",
            fontSize: "0.86rem",
            fontWeight: 700,
            background: mensaje.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
            color: mensaje.tipo === "ok" ? "#166534" : "#991B1B",
            border: mensaje.tipo === "ok" ? "1px solid #86EFAC" : "1px solid #FCA5A5",
          }}
        >
          {mensaje.tipo === "ok" ? (
            <CheckCircle2 size={18} color="#16A34A" />
          ) : (
            <AlertCircle size={18} color="#DC2626" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {tab === "especialidades" ? (
        <form
          onSubmit={handleGuardarEspecialidades}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #E5E7EB",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <h4
              style={{
                margin: "0 0 12px 0",
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "#111827",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Briefcase size={17} color="#05876E" />
              Credenciales y Contacto Profesional
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "12px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                N.° Matrícula Foro de Abogados *
                <input
                  type="text"
                  required
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Ej. 17-2019-452"
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                  }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                Teléfono / WhatsApp Profesional *
                <input
                  type="text"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="0990000000"
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                  }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                Universidad
                <input
                  type="text"
                  value={universidad}
                  onChange={(e) => setUniversidad(e.target.value)}
                  placeholder="Universidad de titulación"
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                  }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                Años de Experiencia
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={anosExperiencia}
                  onChange={(e) => setAnosExperiencia(Number(e.target.value))}
                  style={{
                    padding: "9px 11px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                  }}
                />
              </label>
            </div>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "0.8rem",
                fontWeight: 700,
                marginTop: "12px",
              }}
            >
              Resumen Profesional / Perfil para Clientes
              <textarea
                rows={2}
                value={resumenProfesional}
                onChange={(e) => setResumenProfesional(e.target.value)}
                placeholder="Breve descripción de tu trayectoria y enfoque legal..."
                style={{
                  padding: "9px 11px",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  resize: "vertical",
                }}
              />
            </label>
          </div>

          {/* Especialidades Legales */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #E5E7EB",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Scale size={17} color="#5000BA" />
                  Mis Especialidades Legales ({materiasIds.length} activas)
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#6B7280" }}>
                  Recibirás citas y casos de clientes en las materias que tengas seleccionadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setMateriasIds(
                    materiasIds.length === catalogoMaterias.length
                      ? []
                      : catalogoMaterias.map((m) => m.mat_id)
                  )
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#5000BA",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {materiasIds.length === catalogoMaterias.length
                  ? "Desmarcar todas"
                  : "Seleccionar todas"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {catalogoMaterias.map((m) => {
                const activa = materiasIds.includes(m.mat_id);
                return (
                  <button
                    key={m.mat_id}
                    type="button"
                    onClick={() => toggleMateria(m.mat_id)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: activa ? "2px solid #5000BA" : "1px solid #D1D5DB",
                      background: activa ? "#5000BA" : "#F9FAFB",
                      color: activa ? "#ffffff" : "#374151",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {activa && <CheckCircle2 size={13} />}
                    {m.mat_nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zonas de Cobertura */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #E5E7EB",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <MapPin size={17} color="#05876E" />
                  Mis Zonas de Cobertura — Provincias ({provinciasIds.length} seleccionadas)
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#6B7280" }}>
                  Define las provincias en las que atiendes patrocinios y consultas.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setProvinciasIds(
                    provinciasIds.length === catalogoProvincias.length
                      ? []
                      : catalogoProvincias.map((p) => p.cat_id)
                  )
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#05876E",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {provinciasIds.length === catalogoProvincias.length
                  ? "Desmarcar todas"
                  : "Toda la República (24 prov.)"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
              {catalogoProvincias.map((p) => {
                const activa = provinciasIds.includes(p.cat_id);
                return (
                  <button
                    key={p.cat_id}
                    type="button"
                    onClick={() => toggleProvincia(p.cat_id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "999px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: activa ? "2px solid #05876E" : "1px solid #D1D5DB",
                      background: activa ? "#05876E" : "#F9FAFB",
                      color: activa ? "#ffffff" : "#374151",
                    }}
                  >
                    {p.cat_nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={guardandoPerfil}
              className="btn-responsive-accion"
              title="Guardar mis especialidades y zonas de cobertura"
              aria-label="Guardar especialidades"
              style={{
                background: "#05876E",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "11px 20px",
                fontWeight: 800,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Save size={16} />
              <span className="btn-texto-responsive">
                {guardandoPerfil ? "Guardando..." : "Guardar Especialidades"}
              </span>
            </button>
          </div>
        </form>
      ) : (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #E2E8F0",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)",
          }}
        >
          {/* CABECERA AL ESTILO OPERADOR */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              paddingBottom: "16px",
              borderBottom: "1px solid #F1F5F9",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#F3E8FF",
                  color: "#5000BA",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                <Clock size={13} />
                <span>Mi Disponibilidad de Atención ({huecosSemanales} citas/semana)</span>
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", fontWeight: 800, color: "#0F172A" }}>
                Horarios de Atención (Telemático y Oficina) y Fechas Especiales
              </h3>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "#64748B", lineHeight: 1.45 }}>
                Configura tu horario laborable normal por defecto en consultas telemáticas y en
                oficina, así como excepciones o ausencias por fechas exactas.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGuardarDisponibilidad}
              disabled={guardandoAgenda}
              title="Guardar horarios de disponibilidad"
              aria-label="Guardar horarios de disponibilidad"
              className="btn-responsive-accion"
              style={{
                background: "#5000BA",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "12px",
                padding: "10px 18px",
                fontSize: "0.86rem",
                fontWeight: 700,
                cursor: guardandoAgenda ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(80, 0, 186, 0.22)",
                opacity: guardandoAgenda ? 0.75 : 1,
              }}
            >
              <Save size={16} />
              <span className="btn-texto-responsive">
                {guardandoAgenda ? "Guardando…" : "Guardar Horarios"}
              </span>
            </button>
          </div>

          {/* 1. HORARIO LABORABLE NORMAL (POR DEFECTO — EDITABLE): TELEMÁTICO Y OFICINA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
                1. Horario Laborable Normal (Por Defecto — Editable)
              </h3>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748B" }}>
                Se aplica todos los días del año salvo en las fechas exactas que tengan un horario
                diferenciado configurado en la sección 2.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: "18px",
              }}
            >
              {/* COLUMNA 1: HORARIO NORMAL CONSULTAS TELEMÁTICAS */}
              <section
                style={{
                  borderRadius: "16px",
                  border: "1px solid #DDD6FE",
                  background: "#FAF8FF",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "#5000BA",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Video size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#0F172A" }}>
                        Horario Normal — Consultas Telemáticas
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                        Videollamada (Por defecto Lun–Vie 08:00 a 19:00, Sáb 09:00 a 14:00)
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setFranjasVirtual(FRANJAS_VIRTUAL_DEFECTO)}
                      title="Restaurar horario telemático por defecto"
                      aria-label="Restaurar horario telemático por defecto"
                      className="btn-responsive-accion"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        padding: "6px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={13} />
                      <span className="btn-texto-responsive">Por Defecto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => agregarFranja("virtual")}
                      title="Añadir día de atención telemática"
                      aria-label="Añadir día de atención telemática"
                      className="btn-responsive-accion"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#5000BA",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                      <span className="btn-texto-responsive">Añadir Día</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {franjasVirtual.map((f, idx) => (
                    <div
                      key={`virt-${idx}`}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        background: "#FFFFFF",
                        padding: "8px 12px",
                      }}
                    >
                      <select
                        aria-label="Día de la semana telemático"
                        value={f.dia_semana}
                        onChange={(e) =>
                          actualizarFranja("virtual", idx, { dia_semana: Number(e.target.value) })
                        }
                        style={{
                          ...inputBaseStyle,
                          flex: "1 1 120px",
                          minWidth: "120px",
                          background: "#F8FAFC",
                          padding: "6px 10px",
                        }}
                      >
                        {DIAS_SEMANA_ORDENADOS.map((d) => (
                          <option key={d.dia} value={d.dia}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.8rem",
                          color: "#475569",
                        }}
                      >
                        <Clock size={14} color="#5000BA" />
                        <input
                          type="time"
                          aria-label="Hora inicio telemático"
                          value={f.hora_inicio}
                          onChange={(e) =>
                            actualizarFranja("virtual", idx, { hora_inicio: e.target.value })
                          }
                          style={{ ...inputBaseStyle, padding: "5px 8px" }}
                        />
                        <span style={{ fontWeight: 600 }}>a</span>
                        <input
                          type="time"
                          aria-label="Hora fin telemático"
                          value={f.hora_fin}
                          onChange={(e) =>
                            actualizarFranja("virtual", idx, { hora_fin: e.target.value })
                          }
                          style={{ ...inputBaseStyle, padding: "5px 8px" }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarFranja("virtual", idx)}
                        title="Eliminar franja telemática"
                        aria-label="Eliminar franja telemática"
                        style={{
                          border: "1px solid #FEE2E2",
                          background: "#FFF1F2",
                          color: "#E11D48",
                          borderRadius: "8px",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {franjasVirtual.length === 0 && (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "#FFFFFF",
                        border: "1px dashed #CBD5E1",
                        fontSize: "0.8rem",
                        color: "#64748B",
                        textAlign: "center",
                      }}
                    >
                      Sin días configurados para teleconsulta. Haz clic en{" "}
                      <strong>+ Añadir Día</strong> o <strong>Por Defecto</strong>.
                    </div>
                  )}
                </div>
              </section>

              {/* COLUMNA 2: HORARIO NORMAL CONSULTAS EN OFICINA (PRESENCIAL) */}
              <section
                style={{
                  borderRadius: "16px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "#0F172A",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#0F172A" }}>
                        Horario Normal — Consultas en Oficina
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                        Atención presencial en despacho (Por defecto Lun–Vie 09:00 a 17:30)
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setFranjasPresencial(FRANJAS_PRESENCIAL_DEFECTO)}
                      title="Restaurar horario de oficina por defecto"
                      aria-label="Restaurar horario de oficina por defecto"
                      className="btn-responsive-accion"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        padding: "6px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={13} />
                      <span className="btn-texto-responsive">Por Defecto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => agregarFranja("presencial")}
                      title="Añadir día de atención en oficina"
                      aria-label="Añadir día de atención en oficina"
                      className="btn-responsive-accion"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#0F172A",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                      <span className="btn-texto-responsive">Añadir Día</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {franjasPresencial.map((f, idx) => (
                    <div
                      key={`pres-${idx}`}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        background: "#FFFFFF",
                        padding: "8px 12px",
                      }}
                    >
                      <select
                        aria-label="Día de la semana oficina"
                        value={f.dia_semana}
                        onChange={(e) =>
                          actualizarFranja("presencial", idx, { dia_semana: Number(e.target.value) })
                        }
                        style={{
                          ...inputBaseStyle,
                          flex: "1 1 120px",
                          minWidth: "120px",
                          background: "#F8FAFC",
                          padding: "6px 10px",
                        }}
                      >
                        {DIAS_SEMANA_ORDENADOS.map((d) => (
                          <option key={d.dia} value={d.dia}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.8rem",
                          color: "#475569",
                        }}
                      >
                        <Clock size={14} color="#0F172A" />
                        <input
                          type="time"
                          aria-label="Hora inicio oficina"
                          value={f.hora_inicio}
                          onChange={(e) =>
                            actualizarFranja("presencial", idx, { hora_inicio: e.target.value })
                          }
                          style={{ ...inputBaseStyle, padding: "5px 8px" }}
                        />
                        <span style={{ fontWeight: 600 }}>a</span>
                        <input
                          type="time"
                          aria-label="Hora fin oficina"
                          value={f.hora_fin}
                          onChange={(e) =>
                            actualizarFranja("presencial", idx, { hora_fin: e.target.value })
                          }
                          style={{ ...inputBaseStyle, padding: "5px 8px" }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarFranja("presencial", idx)}
                        title="Eliminar franja de oficina"
                        aria-label="Eliminar franja de oficina"
                        style={{
                          border: "1px solid #FEE2E2",
                          background: "#FFF1F2",
                          color: "#E11D48",
                          borderRadius: "8px",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {franjasPresencial.length === 0 && (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "#FFFFFF",
                        border: "1px dashed #CBD5E1",
                        fontSize: "0.8rem",
                        color: "#64748B",
                        textAlign: "center",
                      }}
                    >
                      Sin días configurados para oficina presencial. Haz clic en{" "}
                      <strong>+ Añadir Día</strong> o <strong>Por Defecto</strong>.
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: "6px" }}>
                  <label htmlFor="input-direccion-abogado" style={labelBaseStyle}>
                    Dirección de la Oficina para Consultas Presenciales
                  </label>
                  <input
                    id="input-direccion-abogado"
                    type="text"
                    value={configAgenda.direccion ?? ""}
                    onChange={(e) =>
                      setConfigAgenda((prev) => ({ ...prev, direccion: e.target.value }))
                    }
                    placeholder="Ej.: Av. República del Salvador y Moscú, Edificio Tranqi, Piso 5"
                    style={{ ...inputBaseStyle, width: "100%" }}
                  />
                </div>
              </section>
            </div>
          </div>

          {/* 2. HORARIOS DIFERENCIADOS POR FECHAS EXACTAS (FERIADOS, AUDIENCIAS, JORNADAS ESPECIALES) */}
          <section
            style={{
              borderRadius: "16px",
              border: "1.5px solid #FDE68A",
              background: "#FFFBEB",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
              }}
            >
              <div style={{ maxWidth: "680px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#B45309",
                    marginBottom: "4px",
                  }}
                >
                  <CalendarPlus size={15} />
                  <span>Excepciones al Horario por Defecto</span>
                </div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
                  2. Horarios Diferenciados por Fechas Exactas (Navidad, Feriados, Audiencias)
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#78350F", lineHeight: 1.45 }}>
                  Si ingresas una fecha exacta aquí, su configuración reemplaza tu horario normal en
                  ese día (por ejemplo: atender solo por teleconsulta o marcar el día cerrado por
                  feriado o audiencia).
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => aplicarPlantillaFechaEspecial("navidad")}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #F59E0B",
                    background: "#FFFFFF",
                    padding: "7px 12px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "#92400E",
                    cursor: "pointer",
                  }}
                >
                  🎄 Navidad (25 Dic · Tele 08h–16h)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPlantillaFechaEspecial("nochebuena")}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #F59E0B",
                    background: "#FFFFFF",
                    padding: "7px 12px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "#92400E",
                    cursor: "pointer",
                  }}
                >
                  🎅 Nochebuena (24 Dic)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPlantillaFechaEspecial("fin_anio")}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #F59E0B",
                    background: "#FFFFFF",
                    padding: "7px 12px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "#92400E",
                    cursor: "pointer",
                  }}
                >
                  🎆 Fin de Año (31 Dic)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPlantillaFechaEspecial("anio_nuevo")}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    padding: "7px 12px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  🛑 01 Ene (Cerrado)
                </button>
              </div>
            </div>

            {/* Formulario para agregar nueva fecha exacta */}
            <div
              style={{
                borderRadius: "14px",
                border: "1px solid #FCD34D",
                background: "#FFFFFF",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0F172A" }}>
                Agregar o actualizar horario diferenciado para una fecha exacta:
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                  alignItems: "end",
                }}
              >
                <div>
                  <label style={labelBaseStyle}>Fecha Exacta</label>
                  <input
                    type="date"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
                  />
                </div>

                <div>
                  <label style={labelBaseStyle}>Motivo / Etiqueta</label>
                  <input
                    type="text"
                    value={nuevoNombreFecha}
                    onChange={(e) => setNuevoNombreFecha(e.target.value)}
                    placeholder="Ej. Audiencia / Navidad"
                    style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      ...labelBaseStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#5000BA",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!nuevoCerradoTotal && nuevoHabilitarVirtual}
                      disabled={nuevoCerradoTotal}
                      onChange={(e) => setNuevoHabilitarVirtual(e.target.checked)}
                    />
                    <span>Teleconsulta en esta fecha</span>
                  </label>
                  {!nuevoCerradoTotal && nuevoHabilitarVirtual ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="time"
                        value={nuevoVirtualInicio}
                        onChange={(e) => setNuevoVirtualInicio(e.target.value)}
                        style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                      />
                      <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>a</span>
                      <input
                        type="time"
                        value={nuevoVirtualFin}
                        onChange={(e) => setNuevoVirtualFin(e.target.value)}
                        style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: "10px",
                        border: "1px solid #E2E8F0",
                        background: "#F1F5F9",
                        padding: "8px 12px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#64748B",
                      }}
                    >
                      Sin teleconsulta
                    </div>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      ...labelBaseStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#0F172A",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!nuevoCerradoTotal && nuevoHabilitarPresencial}
                      disabled={nuevoCerradoTotal}
                      onChange={(e) => setNuevoHabilitarPresencial(e.target.checked)}
                    />
                    <span>Oficina abierta</span>
                  </label>
                  {!nuevoCerradoTotal && nuevoHabilitarPresencial ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="time"
                        value={nuevoPresencialInicio}
                        onChange={(e) => setNuevoPresencialInicio(e.target.value)}
                        style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                      />
                      <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>a</span>
                      <input
                        type="time"
                        value={nuevoPresencialFin}
                        onChange={(e) => setNuevoPresencialFin(e.target.value)}
                        style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: "10px",
                        border: "1px solid #E2E8F0",
                        background: "#F1F5F9",
                        padding: "8px 12px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#64748B",
                      }}
                    >
                      Oficina cerrada
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  paddingTop: "8px",
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#B91C1C",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={nuevoCerradoTotal}
                    onChange={(e) => setNuevoCerradoTotal(e.target.checked)}
                  />
                  <span>Cerrado todo el día (sin atención telemática ni presencial)</span>
                </label>

                <button
                  type="button"
                  onClick={handleAgregarFechaDesdeFormulario}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#D97706",
                    color: "#FFFFFF",
                    padding: "8px 16px",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={15} />
                  <span>Guardar Fecha Exacta</span>
                </button>
              </div>
            </div>

            {/* Lista de fechas especiales configuradas */}
            {fechasEspeciales.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {fechasEspeciales.map((fe) => (
                  <div
                    key={fe.fecha}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      borderRadius: "12px",
                      border: "1px solid #FDE68A",
                      background: "#FFFFFF",
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "8px",
                          background: "#FEF3C7",
                          color: "#92400E",
                          fontSize: "0.8rem",
                          fontWeight: 800,
                        }}
                      >
                        {fe.fecha}
                      </span>
                      <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>{fe.nombre}</strong>
                      {fe.cerrado_total ? (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "999px",
                            background: "#FEE2E2",
                            color: "#991B1B",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                          }}
                        >
                          Cerrado todo el día
                        </span>
                      ) : (
                        <>
                          {fe.habilitar_virtual && fe.franjas_virtual[0] && (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#F3E8FF",
                                color: "#5000BA",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                              }}
                            >
                              Teleconsulta: {fe.franjas_virtual[0].hora_inicio} a{" "}
                              {fe.franjas_virtual[0].hora_fin}
                            </span>
                          )}
                          {fe.habilitar_presencial && fe.franjas_presencial[0] ? (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#E2E8F0",
                                color: "#0F172A",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                              }}
                            >
                              Oficina: {fe.franjas_presencial[0].hora_inicio} a{" "}
                              {fe.franjas_presencial[0].hora_fin}
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#F1F5F9",
                                color: "#64748B",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                              }}
                            >
                              Oficina cerrada
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => eliminarFechaEspecial(fe.fecha)}
                      title="Eliminar fecha especial"
                      style={{
                        border: "1px solid #FEE2E2",
                        background: "#FFF1F2",
                        color: "#E11D48",
                        borderRadius: "8px",
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. PARÁMETROS DE DURACIÓN, DESCANSO Y ANTELACIÓN */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelBaseStyle}>Duración de cada Cita</label>
              <select
                value={configAgenda.duracion_cita_min}
                onChange={(e) =>
                  setConfigAgenda({ ...configAgenda, duracion_cita_min: Number(e.target.value) })
                }
                style={{ ...inputBaseStyle, width: "100%" }}
              >
                {[15, 30, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelBaseStyle}>Descanso entre Citas</label>
              <select
                value={configAgenda.holgura_min}
                onChange={(e) =>
                  setConfigAgenda({ ...configAgenda, holgura_min: Number(e.target.value) })
                }
                style={{ ...inputBaseStyle, width: "100%" }}
              >
                {[0, 5, 10, 15, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelBaseStyle}>Antelación Mínima</label>
              <select
                value={configAgenda.antelacion_minima_horas}
                onChange={(e) =>
                  setConfigAgenda({
                    ...configAgenda,
                    antelacion_minima_horas: Number(e.target.value),
                  })
                }
                style={{ ...inputBaseStyle, width: "100%" }}
              >
                {[1, 2, 6, 12, 24, 48].map((n) => (
                  <option key={n} value={n}>
                    {n} horas
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              disabled={guardandoAgenda}
              onClick={handleGuardarDisponibilidad}
              className="btn-responsive-accion"
              title="Guardar mi disponibilidad de citas"
              aria-label="Guardar disponibilidad"
              style={{
                background: "#5000BA",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                padding: "11px 22px",
                fontWeight: 800,
                fontSize: "0.88rem",
                cursor: guardandoAgenda ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(80, 0, 186, 0.22)",
              }}
            >
              <Save size={16} />
              <span className="btn-texto-responsive">
                {guardandoAgenda ? "Guardando..." : "Guardar Horarios"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
