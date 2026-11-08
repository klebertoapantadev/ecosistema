"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  MapPin,
  Calendar,
  Clock,
  Video,
  Building2,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Briefcase,
} from "lucide-react";
import { DIAS_SEMANA, huecosPorSemana, type Franja } from "@eco/agenda";
import {
  obtenerMiPerfilAbogadoCompletoAction,
  guardarMiPerfilYEspecialidadesAbogadoAction,
  guardarDisponibilidadCitasAbogadoAction,
  type AbogadoRedItem,
  type MateriaItem,
  type ProvinciaItem,
  type ConfiguracionAgendaAbogado,
} from "../acciones-red-profesional";

const CONFIG_AGENDA_BASE: ConfiguracionAgendaAbogado = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 12,
  horizonte_dias: 60,
  modalidades: ["virtual", "presencial"],
  acepta_turno: true,
  direccion: "Quito — Atención Presencial y Teleconsulta",
};

const FRANJAS_OFICINA: Franja[] = [
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:00", modalidad: "ambas" },
];

const FRANJAS_HIBRIDAS: Franja[] = [
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "virtual" },
  { dia_semana: 1, hora_inicio: "14:00", hora_fin: "18:00", modalidad: "presencial" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "virtual" },
  { dia_semana: 2, hora_inicio: "14:00", hora_fin: "18:00", modalidad: "presencial" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "virtual" },
  { dia_semana: 3, hora_inicio: "14:00", hora_fin: "18:00", modalidad: "presencial" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "virtual" },
  { dia_semana: 4, hora_inicio: "14:00", hora_fin: "18:00", modalidad: "presencial" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "virtual" },
  { dia_semana: 5, hora_inicio: "14:00", hora_fin: "18:00", modalidad: "presencial" },
];

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

export function MiPerfilRedAbogadoWidget({
  tabInicial = "especialidades",
}: {
  tabInicial?: "especialidades" | "disponibilidad" | "perfil";
}) {
  const [tab, setTab] = useState<"especialidades" | "disponibilidad">(
    tabInicial === "disponibilidad" ? "disponibilidad" : "especialidades"
  );
  const [cargando, setCargando] = useState(true);
  const [abogado, setAbogado] = useState<AbogadoRedItem | null>(null);
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

  // Campos de Disponibilidad Citas (Presencial / Teleconsulta)
  const [configAgenda, setConfigAgenda] = useState<ConfiguracionAgendaAbogado>(CONFIG_AGENDA_BASE);
  const [franjas, setFranjas] = useState<Franja[]>(FRANJAS_OFICINA);
  const [guardandoAgenda, setGuardandoAgenda] = useState(false);

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
          setConfigAgenda(a.configuracionAgenda || CONFIG_AGENDA_BASE);
          setFranjas(a.franjas.length > 0 ? a.franjas : FRANJAS_OFICINA);
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

  const handleGuardarDisponibilidad = async () => {
    setGuardandoAgenda(true);
    setMensaje(null);
    try {
      const res = await guardarDisponibilidadCitasAbogadoAction({
        configuracion: configAgenda,
        franjas,
      });
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: "Disponibilidad de citas presenciales y teleconsulta guardada y activa.",
      });
      await cargarDatos();
    } finally {
      setGuardandoAgenda(false);
    }
  };

  const huecosSemanales = useMemo(() => {
    try {
      return huecosPorSemana({ configuracion: configAgenda, franjas });
    } catch {
      return 0;
    }
  }, [configAgenda, franjas]);

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
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "0.85rem",
            fontWeight: 700,
            background: mensaje.tipo === "ok" ? "#ECFDF5" : "#FEF2F2",
            color: mensaje.tipo === "ok" ? "#065F46" : "#991B1B",
            border: mensaje.tipo === "ok" ? "1px solid #10B981" : "1px solid #F87171",
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {tab === "especialidades" ? (
        <form onSubmit={handleGuardarEspecialidades} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", padding: "18px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <Briefcase size={17} color="#05876E" />
              Credenciales y Contacto Profesional
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                N.° Matrícula Foro de Abogados *
                <input
                  type="text"
                  required
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Ej. 17-2019-452"
                  style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                Teléfono / WhatsApp Profesional *
                <input
                  type="text"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="0990000000"
                  style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                Universidad
                <input
                  type="text"
                  value={universidad}
                  onChange={(e) => setUniversidad(e.target.value)}
                  placeholder="Universidad de titulación"
                  style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                Años de Experiencia
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={anosExperiencia}
                  onChange={(e) => setAnosExperiencia(Number(e.target.value))}
                  style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                />
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700, marginTop: "12px" }}>
              Resumen Profesional / Perfil para Clientes
              <textarea
                rows={2}
                value={resumenProfesional}
                onChange={(e) => setResumenProfesional(e.target.value)}
                placeholder="Breve descripción de tu trayectoria y enfoque legal..."
                style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid #D1D5DB", resize: "vertical" }}
              />
            </label>
          </div>

          {/* Especialidades Legales */}
          <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
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
                style={{ background: "none", border: "none", color: "#5000BA", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}
              >
                {materiasIds.length === catalogoMaterias.length ? "Desmarcar todas" : "Seleccionar todas"}
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
          <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
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
                style={{ background: "none", border: "none", color: "#05876E", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}
              >
                {provinciasIds.length === catalogoProvincias.length ? "Desmarcar todas" : "Toda la República (24 prov.)"}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Modalidades de Atención */}
          <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", padding: "18px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>
              Modalidades de Atención de Citas
            </h4>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.8rem", color: "#6B7280" }}>
              Activa cómo deseas atender a los afiliados: por videollamada (teleconsulta), en tu despacho (presencial) o ambas.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: configAgenda.modalidades.includes("virtual") ? "2px solid #0284C7" : "1px solid #D1D5DB",
                  background: configAgenda.modalidades.includes("virtual") ? "#F0F9FF" : "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={configAgenda.modalidades.includes("virtual")}
                  onChange={(e) => {
                    const nuevas = e.target.checked
                      ? Array.from(new Set([...configAgenda.modalidades, "virtual" as const]))
                      : configAgenda.modalidades.filter((m) => m !== "virtual");
                    setConfigAgenda({ ...configAgenda, modalidades: nuevas });
                  }}
                />
                <Video size={17} color="#0284C7" />
                Teleconsulta (Videollamada)
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: configAgenda.modalidades.includes("presencial") ? "2px solid #05876E" : "1px solid #D1D5DB",
                  background: configAgenda.modalidades.includes("presencial") ? "#ECFDF5" : "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={configAgenda.modalidades.includes("presencial")}
                  onChange={(e) => {
                    const nuevas = e.target.checked
                      ? Array.from(new Set([...configAgenda.modalidades, "presencial" as const]))
                      : configAgenda.modalidades.filter((m) => m !== "presencial");
                    setConfigAgenda({ ...configAgenda, modalidades: nuevas });
                  }}
                />
                <Building2 size={17} color="#05876E" />
                Atención Presencial (En Despacho)
              </label>
            </div>

            {configAgenda.modalidades.includes("presencial") && (
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem", fontWeight: 700, marginTop: "14px" }}>
                Dirección de tu Despacho / Consultorio para Citas Presenciales *
                <input
                  type="text"
                  value={configAgenda.direccion ?? ""}
                  onChange={(e) => setConfigAgenda({ ...configAgenda, direccion: e.target.value })}
                  placeholder="Ej. Av. Amazonas y Naciones Unidas, Edif. Previsora, Of. 604, Quito"
                  style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                />
              </label>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginTop: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 700 }}>
                Duración de cada Cita
                <select
                  value={configAgenda.duracion_cita_min}
                  onChange={(e) => setConfigAgenda({ ...configAgenda, duracion_cita_min: Number(e.target.value) })}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                >
                  {[15, 30, 45, 60, 90].map((n) => (
                    <option key={n} value={n}>{n} minutos</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 700 }}>
                Descanso entre Citas
                <select
                  value={configAgenda.holgura_min}
                  onChange={(e) => setConfigAgenda({ ...configAgenda, holgura_min: Number(e.target.value) })}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                >
                  {[0, 5, 10, 15, 30].map((n) => (
                    <option key={n} value={n}>{n} minutos</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 700 }}>
                Antelación Mínima
                <select
                  value={configAgenda.antelacion_minima_horas}
                  onChange={(e) => setConfigAgenda({ ...configAgenda, antelacion_minima_horas: Number(e.target.value) })}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                >
                  {[1, 2, 6, 12, 24, 48].map((n) => (
                    <option key={n} value={n}>{n} horas</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Franjas Horarias */}
          <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock size={17} color="#5000BA" />
                  Franjas de Atención Semanal ({huecosSemanales} citas disponibles por semana)
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#6B7280" }}>
                  Elige qué días y en qué horas atiendes presencialmente, por teleconsulta o ambas.
                </p>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setFranjas(FRANJAS_OFICINA)}
                  style={{
                    background: "#F5F3FF",
                    color: "#5000BA",
                    border: "1px solid #DDD6FE",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Plantilla Lun–Vie 09:00–17:00
                </button>
                <button
                  type="button"
                  onClick={() => setFranjas(FRANJAS_HIBRIDAS)}
                  style={{
                    background: "#F0F9FF",
                    color: "#0369A1",
                    border: "1px solid #BAE6FD",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mañanas Teleconsulta + Tardes Presencial
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFranjas((prev) => [
                      ...prev,
                      { dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
                    ])
                  }
                  style={{
                    background: "#05876E",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Plus size={13} /> Añadir Franja
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {franjas.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr 1.3fr auto",
                    gap: "8px",
                    alignItems: "center",
                    background: "#F9FAFB",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <select
                    value={f.dia_semana}
                    onChange={(e) =>
                      setFranjas((arr) =>
                        arr.map((item, i) =>
                          i === idx ? { ...item, dia_semana: Number(e.target.value) } : item
                        )
                      )
                    }
                    style={{ padding: "7px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.82rem" }}
                  >
                    {DIAS_SEMANA.map((d: string, n: number) => (
                      <option key={n} value={n}>{d}</option>
                    ))}
                  </select>

                  <input
                    type="time"
                    value={f.hora_inicio.slice(0, 5)}
                    onChange={(e) =>
                      setFranjas((arr) =>
                        arr.map((item, i) =>
                          i === idx ? { ...item, hora_inicio: e.target.value } : item
                        )
                      )
                    }
                    style={{ padding: "7px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.82rem" }}
                  />

                  <input
                    type="time"
                    value={f.hora_fin.slice(0, 5)}
                    onChange={(e) =>
                      setFranjas((arr) =>
                        arr.map((item, i) =>
                          i === idx ? { ...item, hora_fin: e.target.value } : item
                        )
                      )
                    }
                    style={{ padding: "7px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.82rem" }}
                  />

                  <select
                    value={f.modalidad}
                    onChange={(e) =>
                      setFranjas((arr) =>
                        arr.map((item, i) =>
                          i === idx
                            ? { ...item, modalidad: e.target.value as Franja["modalidad"] }
                            : item
                        )
                      )
                    }
                    style={{ padding: "7px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "0.82rem" }}
                  >
                    <option value="ambas">Presencial y Teleconsulta</option>
                    <option value="virtual">Solo Teleconsulta</option>
                    <option value="presencial">Solo Presencial</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setFranjas((arr) => arr.filter((_, i) => i !== idx))}
                    title="Quitar franja"
                    style={{
                      background: "#FEF2F2",
                      color: "#DC2626",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              disabled={guardandoAgenda}
              onClick={handleGuardarDisponibilidad}
              className="btn-responsive-accion"
              title="Guardar mi disponibilidad de citas presenciales y teleconsulta"
              aria-label="Guardar disponibilidad"
              style={{
                background: "#5000BA",
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
                {guardandoAgenda ? "Guardando..." : "Guardar Disponibilidad"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

