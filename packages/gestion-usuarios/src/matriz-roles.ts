/**
 * Matriz canónica de asignación estricta por rol y panel funcional.
 * Define qué widgets pertenecen a cada panel para cada rol en el ecosistema.
 */
export const MATRIZ_FUNCIONAL_ROLES: Record<string, { paneles: string[]; widgetsPorPanel: Record<string, string[]> }> = {
  CLIENTE: {
    paneles: ["panel_inicio", "panel_clientes", "panel_empresas", "panel_agendamiento", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsPorPanel: {
      panel_inicio: ["favoritos"],
      panel_clientes: ["vitrina_comercial_personas", "muro_informativo_comunidad", "agendar_cita", "mis_citas", "billetera_documentos", "firma_documentos_pdf"],
      panel_empresas: ["vitrina_comercial_empresas", "gestion_convenios_corporativos", "billetera_documentos", "firma_documentos_pdf"],
      panel_agendamiento: ["agendar_cita", "mis_citas"],
      panel_cuenta: ["ver_como", "mi_cuenta", "datos_facturacion", "mfa_seguridad", "historial_accesos", "historial_pagos"],
      panel_herramientas: ["catalogo_productos", "firma_documentos_pdf", "billetera_documentos", "solicitud_socio"],
      panel_configuracion: ["notificaciones"]
    }
  },
  ABOGADO: {
    paneles: ["panel_inicio", "panel_clientes", "panel_empresas", "panel_usuarios", "panel_red_profesional", "panel_agendamiento", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsPorPanel: {
      panel_inicio: ["favoritos"],
      panel_clientes: ["vitrina_comercial_personas", "muro_informativo_comunidad", "crm_clientes", "billetera_documentos", "firma_documentos_pdf"],
      panel_empresas: ["vitrina_comercial_empresas", "gestion_convenios_corporativos", "crm_clientes", "billetera_documentos", "firma_documentos_pdf"],
      panel_usuarios: ["crm_clientes"],
      panel_red_profesional: ["paquete_beneficios_abogados"],
      panel_agendamiento: ["disponibilidad_abogados", "citas_programadas", "disponibilidad", "asignaciones_agenda"],
      panel_cuenta: ["ver_como", "mi_cuenta", "datos_facturacion", "mfa_seguridad", "historial_accesos", "historial_pagos"],
      panel_herramientas: ["catalogo_productos", "disponibilidad_abogados", "firma_documentos_pdf", "billetera_documentos", "solicitud_socio"],
      panel_configuracion: ["notificaciones", "agentes_ia"]
    }
  },
  OPERADOR: {
    paneles: ["panel_inicio", "panel_clientes", "panel_empresas", "panel_usuarios", "panel_red_profesional", "panel_terminos", "panel_agendamiento", "panel_administrar", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsPorPanel: {
      panel_inicio: ["favoritos"],
      panel_clientes: ["vitrina_comercial_personas", "muro_informativo_comunidad", "crm_clientes", "agendar_cita", "mis_citas", "billetera_documentos", "firma_documentos_pdf"],
      panel_empresas: ["vitrina_comercial_empresas", "gestion_convenios_corporativos", "crm_clientes", "billetera_documentos", "firma_documentos_pdf"],
      panel_usuarios: ["consulta_usuarios_perfiles", "crm_clientes", "monitoreo_notificaciones_usuarios"],
      panel_red_profesional: ["socios", "paquete_beneficios_abogados", "solicitud_socio"],
      panel_terminos: ["gestion_terminos_consentimientos", "configuracion_contrato_abogado"],
      panel_agendamiento: ["disponibilidad_abogados", "asignaciones_agenda"],
      panel_administrar: ["gestion_informativos", "gestion_convenios_corporativos", "disponibilidad_abogados", "historial_pagos", "emision_notificaciones", "bitacora_notificaciones"],
      panel_cuenta: ["ver_como", "mi_cuenta", "datos_facturacion", "mfa_seguridad", "historial_accesos"],
      panel_herramientas: ["catalogo_productos", "disponibilidad_abogados", "firma_documentos_pdf", "billetera_documentos"],
      panel_configuracion: ["notificaciones", "agentes_ia"]
    }
  },
  ADMINISTRADOR: {
    paneles: ["panel_inicio", "panel_clientes", "panel_empresas", "panel_usuarios", "panel_red_profesional", "panel_terminos", "panel_agendamiento", "panel_administrar", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsPorPanel: {
      panel_inicio: ["favoritos"],
      panel_clientes: ["vitrina_comercial_personas", "muro_informativo_comunidad", "crm_clientes", "agendar_cita", "mis_citas", "billetera_documentos", "firma_documentos_pdf"],
      panel_empresas: ["vitrina_comercial_empresas", "gestion_convenios_corporativos", "crm_clientes", "billetera_documentos", "firma_documentos_pdf"],
      panel_usuarios: ["gestion_usuarios", "consulta_usuarios_perfiles", "crm_clientes", "monitoreo_notificaciones_usuarios"],
      panel_red_profesional: ["socios", "paquete_beneficios_abogados", "solicitud_socio"],
      panel_terminos: ["gestion_terminos_consentimientos", "configuracion_contrato_abogado"],
      panel_agendamiento: ["disponibilidad_abogados", "asignaciones_agenda"],
      panel_administrar: ["gestion_informativos", "gestion_convenios_corporativos", "disponibilidad_abogados", "historial_pagos", "emision_notificaciones", "bitacora_notificaciones", "perfiles", "auditoria"],
      panel_cuenta: ["ver_como", "mi_cuenta", "datos_facturacion", "mfa_seguridad", "historial_accesos"],
      panel_herramientas: ["catalogo_productos", "disponibilidad_abogados", "firma_documentos_pdf", "billetera_documentos"],
      panel_configuracion: ["configuracion_negocio", "configuracion_correo", "pasarela_payphone", "perfiles", "agentes_ia", "notificaciones", "tokens_mcp"]
    }
  },
  SUPERADMIN: {
    paneles: ["panel_inicio", "panel_clientes", "panel_empresas", "panel_usuarios", "panel_red_profesional", "panel_terminos", "panel_agendamiento", "panel_administrar", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsPorPanel: {
      panel_inicio: ["favoritos"],
      panel_clientes: ["vitrina_comercial_personas", "muro_informativo_comunidad", "crm_clientes", "agendar_cita", "mis_citas", "billetera_documentos", "firma_documentos_pdf"],
      panel_empresas: ["vitrina_comercial_empresas", "gestion_convenios_corporativos", "crm_clientes", "billetera_documentos", "firma_documentos_pdf"],
      panel_usuarios: ["gestion_usuarios", "consulta_usuarios_perfiles", "crm_clientes", "monitoreo_notificaciones_usuarios"],
      panel_red_profesional: ["socios", "paquete_beneficios_abogados", "solicitud_socio"],
      panel_terminos: ["gestion_terminos_consentimientos", "configuracion_contrato_abogado"],
      panel_agendamiento: ["disponibilidad_abogados", "asignaciones_agenda"],
      panel_administrar: ["gestion_informativos", "gestion_convenios_corporativos", "disponibilidad_abogados", "historial_pagos", "emision_notificaciones", "bitacora_notificaciones", "perfiles", "auditoria"],
      panel_cuenta: ["ver_como", "mi_cuenta", "datos_facturacion", "mfa_seguridad", "historial_accesos"],
      panel_herramientas: ["catalogo_productos", "disponibilidad_abogados", "firma_documentos_pdf", "billetera_documentos"],
      panel_configuracion: ["configuracion_negocio", "configuracion_correo", "pasarela_payphone", "perfiles", "agentes_ia", "notificaciones", "tokens_mcp"]
    }
  }
};
