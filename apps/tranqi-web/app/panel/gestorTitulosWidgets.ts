"use client";

import { useState, useEffect } from "react";
import {
  User,
  Users,
  Shield,
  ShieldCheck,
  History,
  KeyRound,
  Receipt,
  Briefcase,
  Settings,
  Mail,
  Bell,
  Sliders,
  Database,
  Lock,
  Folder,
  Activity,
  FileText,
  CheckSquare,
  Globe,
  Building,
  Sparkles,
  Camera,
  Phone,
  MapPin,
  CreditCard,
  Award,
  Terminal,
  Zap,
  Eye,
  Search,
  Send,
  Save,
  Pencil,
  Trash2,
  FolderTree,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export const DICCIONARIO_ICONOS_WIDGET: Record<string, { nombre: string; icono: LucideIcon }> = {
  User: { nombre: "Usuario", icono: User },
  Users: { nombre: "Equipo / Miembros", icono: Users },
  Shield: { nombre: "Escudo / Seguridad", icono: Shield },
  ShieldCheck: { nombre: "Seguridad Verificada", icono: ShieldCheck },
  History: { nombre: "Historial / Reloj", icono: History },
  KeyRound: { nombre: "Clave / Credenciales", icono: KeyRound },
  Receipt: { nombre: "Comprobantes / Factura", icono: Receipt },
  Briefcase: { nombre: "Maletín / Profesional", icono: Briefcase },
  Settings: { nombre: "Configuración / Engranaje", icono: Settings },
  Mail: { nombre: "Correo / Notificaciones", icono: Mail },
  Bell: { nombre: "Campana / Alertas", icono: Bell },
  Sliders: { nombre: "Controles / Parámetros", icono: Sliders },
  Database: { nombre: "Base de Datos", icono: Database },
  Lock: { nombre: "Candado / MFA", icono: Lock },
  Folder: { nombre: "Carpeta / Archivos", icono: Folder },
  Activity: { nombre: "Actividad / Telemetría", icono: Activity },
  FileText: { nombre: "Documentos", icono: FileText },
  CheckSquare: { nombre: "Aprobaciones", icono: CheckSquare },
  Globe: { nombre: "Red / Cobertura", icono: Globe },
  Building: { nombre: "Empresa / Organización", icono: Building },
  Sparkles: { nombre: "Inteligencia Artificial", icono: Sparkles },
  Camera: { nombre: "Cámara / Imagen", icono: Camera },
  Phone: { nombre: "Teléfono / WhatsApp", icono: Phone },
  MapPin: { nombre: "Ubicación", icono: MapPin },
  CreditCard: { nombre: "Tarjeta / Pagos", icono: CreditCard },
  Award: { nombre: "Insignia / Certificados", icono: Award },
  Terminal: { nombre: "Consola / Logs", icono: Terminal },
  Zap: { nombre: "Acción Rápida", icono: Zap },
  Eye: { nombre: "Ver / Visualizar", icono: Eye },
  Search: { nombre: "Buscar / Lupa", icono: Search },
  Send: { nombre: "Envío Correo / Despacho", icono: Send },
  Save: { nombre: "Guardar / Disco", icono: Save },
  Pencil: { nombre: "Editar / Lápiz", icono: Pencil },
  Trash2: { nombre: "Eliminar / Papelera", icono: Trash2 },
  FolderTree: { nombre: "Grupo / Árbol", icono: FolderTree },
  GraduationCap: { nombre: "Rol / Sombrero", icono: GraduationCap },
};

export interface CustomizacionWidget {
  titulo: string;
  subtitulo: string;
  iconoKey?: string;
  requiereMfa?: boolean;
  tiempoMfaMinutos?: number;
}

export type MapaCustomizacionesWidget = Record<string, CustomizacionWidget>;

const CLAVE_LOCAL_STORAGE = "tranqi_custom_widgets_config";
const NOMBRE_EVENTO_CUSTOM = "tranqi_widget_custom_updated";

/**
 * Lee todas las customizaciones almacenadas en localStorage
 */
export function obtenerCustomizacionesWidgets(): MapaCustomizacionesWidget {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL_STORAGE);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Recupera la versión personalizada para un widget específico
 */
export function obtenerCustomizacionWidget(
  id: string,
  tituloPorDefecto: string,
  subtituloPorDefecto: string,
  iconoPorDefectoKey?: string,
  mapa?: MapaCustomizacionesWidget
): {
  titulo: string;
  subtitulo: string;
  iconoKey: string | undefined;
  requiereMfa: boolean;
  tiempoMfaMinutos: number;
} {
  const customMap = mapa ?? obtenerCustomizacionesWidgets();
  const custom = customMap[id];
  return {
    titulo: custom?.titulo?.trim() ? custom.titulo : tituloPorDefecto,
    subtitulo: custom?.subtitulo?.trim() ? custom.subtitulo : subtituloPorDefecto,
    iconoKey: custom?.iconoKey || iconoPorDefectoKey,
    requiereMfa: Boolean(custom?.requiereMfa),
    tiempoMfaMinutos: custom?.tiempoMfaMinutos ?? 15,
  };
}

/**
 * Obtiene la referencia al componente Lucide según iconoKey o fallback
 */
export function obtenerIconoComponente(iconoKey?: string, fallbackIcono?: LucideIcon): LucideIcon {
  if (iconoKey && DICCIONARIO_ICONOS_WIDGET[iconoKey]) {
    return DICCIONARIO_ICONOS_WIDGET[iconoKey].icono;
  }
  return fallbackIcono || Settings;
}

/**
 * Guarda o actualiza la configuración personalizada de un widget
 */
export function guardarCustomizacionWidget(
  id: string,
  titulo: string,
  subtitulo: string,
  iconoKey?: string,
  requiereMfa?: boolean,
  tiempoMfaMinutos?: number
) {
  if (typeof window === "undefined") return;
  try {
    const mapaActual = obtenerCustomizacionesWidgets();
    mapaActual[id] = {
      titulo: titulo.trim(),
      subtitulo: subtitulo.trim(),
      iconoKey,
      requiereMfa: Boolean(requiereMfa),
      tiempoMfaMinutos: tiempoMfaMinutos ?? 15,
    };
    localStorage.setItem(CLAVE_LOCAL_STORAGE, JSON.stringify(mapaActual));
    window.dispatchEvent(
      new CustomEvent(NOMBRE_EVENTO_CUSTOM, {
        detail: {
          id,
          titulo: titulo.trim(),
          subtitulo: subtitulo.trim(),
          iconoKey,
          requiereMfa: Boolean(requiereMfa),
          tiempoMfaMinutos: tiempoMfaMinutos ?? 15,
        },
      })
    );
  } catch (err) {
    console.error("Error al guardar la customización del widget:", err);
  }
}

/**
 * Hook para consumir y mantenerse reactivo ante cambios en los títulos, íconos y parámetros MFA de los widgets
 */
export function useCustomWidgets() {
  const [customizaciones, setCustomizaciones] = useState<MapaCustomizacionesWidget>({});

  useEffect(() => {
    setCustomizaciones(obtenerCustomizacionesWidgets());

    const manejarEvento = () => {
      setCustomizaciones(obtenerCustomizacionesWidgets());
    };

    window.addEventListener(NOMBRE_EVENTO_CUSTOM, manejarEvento);
    window.addEventListener("storage", manejarEvento);

    return () => {
      window.removeEventListener(NOMBRE_EVENTO_CUSTOM, manejarEvento);
      window.removeEventListener("storage", manejarEvento);
    };
  }, []);

  const getWidgetInfo = (id: string, tituloDef: string, subtituloDef: string, iconoDefKey?: string) => {
    return obtenerCustomizacionWidget(id, tituloDef, subtituloDef, iconoDefKey, customizaciones);
  };

  return {
    customizaciones,
    getWidgetInfo,
    guardarWidget: guardarCustomizacionWidget,
    obtenerIconoComponente,
  };
}

