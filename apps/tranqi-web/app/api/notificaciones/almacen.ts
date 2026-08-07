export interface CampanaBitacora {
  id: string;
  asunto: string;
  contenidoHTML?: string;
  contenidoMarkdown?: string;
  tipoEmision: "MANUAL" | "AUTOMATICA";
  emisorNombre: string;
  emisorCorreo: string;
  emisorId?: string;
  procesoOrigen: string;
  audiencia: string;
  canales: string[];
  destinatariosDetalle: string[];
  enviados: number;
  leidos: number;
  ignorados: number;
  fecha: string;
  correoEnviadoReal?: boolean;
}

// Almacén compartido en memoria para sincronización inmediata entre emisión y lectura
const ALMACEN_CAMPANAS: CampanaBitacora[] = [];

export function agregarCampanaServidor(campana: CampanaBitacora): void {
  // Evitar duplicados por ID
  if (!ALMACEN_CAMPANAS.some(c => c.id === campana.id)) {
    ALMACEN_CAMPANAS.unshift(campana);
  }
}

export function obtenerCampanasServidor(): CampanaBitacora[] {
  return ALMACEN_CAMPANAS;
}
