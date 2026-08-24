// Generado con: npx supabase gen types typescript --project-id oaybbpdxhlxjbpwnoymy
//   --schema comun_seguridad,comun_auditoria,comun_configuracion,comun_catalogo,comun_notificaciones,tranqui_legal
// Regenerar en el mismo PR que cualquier migracion nueva que toque columnas
// (no hace falta si la migracion solo reescribe el cuerpo de una funcion).
// Pendientes de incluir cuando se migren: comun_facturacion, comun_agentes, comun_comercio.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  comun_auditoria: {
    Tables: {
      aud_log_api: {
        Row: {
          log_creado_en: string
          log_detalle_log: Json
          log_id: string
          log_metodo: string
          log_ruta: string
          log_secuencial: number
          log_status_code: number | null
          log_usuario_id: string | null
        }
        Insert: {
          log_creado_en?: string
          log_detalle_log?: Json
          log_id?: string
          log_metodo: string
          log_ruta: string
          log_secuencial?: never
          log_status_code?: number | null
          log_usuario_id?: string | null
        }
        Update: {
          log_creado_en?: string
          log_detalle_log?: Json
          log_id?: string
          log_metodo?: string
          log_ruta?: string
          log_secuencial?: never
          log_status_code?: number | null
          log_usuario_id?: string | null
        }
        Relationships: []
      }
      aud_registro: {
        Row: {
          reg_creado_en: string
          reg_datos_anteriores: Json | null
          reg_datos_nuevos: Json | null
          reg_detalle_registro: Json
          reg_esquema: string
          reg_id: string
          reg_operacion: string
          reg_secuencial: number
          reg_tabla: string
          reg_usuario_id: string | null
        }
        Insert: {
          reg_creado_en?: string
          reg_datos_anteriores?: Json | null
          reg_datos_nuevos?: Json | null
          reg_detalle_registro?: Json
          reg_esquema: string
          reg_id?: string
          reg_operacion: string
          reg_secuencial?: never
          reg_tabla: string
          reg_usuario_id?: string | null
        }
        Update: {
          reg_creado_en?: string
          reg_datos_anteriores?: Json | null
          reg_datos_nuevos?: Json | null
          reg_detalle_registro?: Json
          reg_esquema?: string
          reg_id?: string
          reg_operacion?: string
          reg_secuencial?: never
          reg_tabla?: string
          reg_usuario_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aud_fn_listar_auditoria_negocio: {
        Args: {
          p_correo_actor?: string
          p_desde?: string
          p_esquema_negocio: string
          p_hasta?: string
          p_limite?: number
          p_negocio: string
          p_operacion?: string
          p_tabla?: string
        }
        Returns: {
          actor_apellidos: string
          actor_correo: string
          actor_nombres: string
          reg_creado_en: string
          reg_datos_anteriores: Json
          reg_datos_nuevos: Json
          reg_esquema: string
          reg_id: string
          reg_operacion: string
          reg_tabla: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  comun_catalogo: {
    Tables: {
      cat_provincia: {
        Row: {
          cat_creado_en: string
          cat_id: string
          cat_nombre: string
        }
        Insert: {
          cat_creado_en?: string
          cat_id?: string
          cat_nombre: string
        }
        Update: {
          cat_creado_en?: string
          cat_id?: string
          cat_nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  comun_configuracion: {
    Tables: {
      cfg_negocio: {
        Row: {
          cfg_actualizado_en: string
          cfg_creado_en: string
          cfg_detalle_configuracion: Json
          cfg_id: string
          cfg_identificacion: string | null
          cfg_negocio: string
          cfg_nombre_comercial: string | null
          cfg_razon_social: string | null
          cfg_secuencial: number
        }
        Insert: {
          cfg_actualizado_en?: string
          cfg_creado_en?: string
          cfg_detalle_configuracion?: Json
          cfg_id?: string
          cfg_identificacion?: string | null
          cfg_negocio: string
          cfg_nombre_comercial?: string | null
          cfg_razon_social?: string | null
          cfg_secuencial?: never
        }
        Update: {
          cfg_actualizado_en?: string
          cfg_creado_en?: string
          cfg_detalle_configuracion?: Json
          cfg_id?: string
          cfg_identificacion?: string | null
          cfg_negocio?: string
          cfg_nombre_comercial?: string | null
          cfg_razon_social?: string | null
          cfg_secuencial?: never
        }
        Relationships: []
      }
      cfg_smtp: {
        Row: {
          smt_activo: boolean
          smt_actualizado_en: string
          smt_creado_en: string
          smt_detalle_smtp: Json
          smt_host: string | null
          smt_id: string
          smt_negocio: string
          smt_puerto: number
          smt_remitente_nombre: string | null
          smt_secreto_id: string | null
          smt_secuencial: number
          smt_seguro: boolean
          smt_usuario: string | null
        }
        Insert: {
          smt_activo?: boolean
          smt_actualizado_en?: string
          smt_creado_en?: string
          smt_detalle_smtp?: Json
          smt_host?: string | null
          smt_id?: string
          smt_negocio: string
          smt_puerto?: number
          smt_remitente_nombre?: string | null
          smt_secreto_id?: string | null
          smt_secuencial?: never
          smt_seguro?: boolean
          smt_usuario?: string | null
        }
        Update: {
          smt_activo?: boolean
          smt_actualizado_en?: string
          smt_creado_en?: string
          smt_detalle_smtp?: Json
          smt_host?: string | null
          smt_id?: string
          smt_negocio?: string
          smt_puerto?: number
          smt_remitente_nombre?: string | null
          smt_secreto_id?: string | null
          smt_secuencial?: never
          smt_seguro?: boolean
          smt_usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfg_smtp_smt_negocio_fkey"
            columns: ["smt_negocio"]
            isOneToOne: true
            referencedRelation: "cfg_negocio"
            referencedColumns: ["cfg_negocio"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cfg_fn_borrar_smtp_contrasena: {
        Args: { p_negocio: string }
        Returns: undefined
      }
      cfg_fn_guardar_smtp: {
        Args: {
          p_activo: boolean
          p_contrasena?: string
          p_host: string
          p_negocio: string
          p_puerto: number
          p_remitente_nombre: string
          p_seguro: boolean
          p_usuario: string
        }
        Returns: undefined
      }
      cfg_fn_obtener_smtp_credenciales: {
        Args: { p_negocio: string }
        Returns: {
          contrasena: string
          host: string
          puerto: number
          remitente_nombre: string
          seguro: boolean
          usuario: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  comun_notificaciones: {
    Tables: {
      not_cola_correo: {
        Row: {
          not_asunto: string
          not_creado_en: string
          not_datos: Json
          not_destinatario_correo: string
          not_destinatario_usuario_id: string | null
          not_enviado_en: string | null
          not_error: string | null
          not_estado: string
          not_id: string
          not_intentos: number
          not_negocio: string
          not_plantilla: string
          not_secuencial: number
        }
        Insert: {
          not_asunto: string
          not_creado_en?: string
          not_datos?: Json
          not_destinatario_correo: string
          not_destinatario_usuario_id?: string | null
          not_enviado_en?: string | null
          not_error?: string | null
          not_estado?: string
          not_id?: string
          not_intentos?: number
          not_negocio: string
          not_plantilla: string
          not_secuencial?: never
        }
        Update: {
          not_asunto?: string
          not_creado_en?: string
          not_datos?: Json
          not_destinatario_correo?: string
          not_destinatario_usuario_id?: string | null
          not_enviado_en?: string | null
          not_error?: string | null
          not_estado?: string
          not_id?: string
          not_intentos?: number
          not_negocio?: string
          not_plantilla?: string
          not_secuencial?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  comun_seguridad: {
    Tables: {
      seg_acceso: {
        Row: {
          acc_creado_en: string
          acc_id: string
          acc_ip: string | null
          acc_negocio: string | null
          acc_secuencial: number
          acc_user_agent: string | null
          acc_usuario_id: string
        }
        Insert: {
          acc_creado_en?: string
          acc_id?: string
          acc_ip?: string | null
          acc_negocio?: string | null
          acc_secuencial?: never
          acc_user_agent?: string | null
          acc_usuario_id: string
        }
        Update: {
          acc_creado_en?: string
          acc_id?: string
          acc_ip?: string | null
          acc_negocio?: string | null
          acc_secuencial?: never
          acc_user_agent?: string | null
          acc_usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seg_acceso_acc_usuario_id_fkey"
            columns: ["acc_usuario_id"]
            isOneToOne: false
            referencedRelation: "seg_usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      seg_membresia: {
        Row: {
          mem_actualizado_en: string
          mem_creado_en: string
          mem_detalle_membresia: Json
          mem_estado: string
          mem_fecha_registro: string
          mem_id: string
          mem_negocio: string
          mem_rol: string
          mem_secuencial: number
          mem_usuario_id: string
        }
        Insert: {
          mem_actualizado_en?: string
          mem_creado_en?: string
          mem_detalle_membresia?: Json
          mem_estado?: string
          mem_fecha_registro?: string
          mem_id?: string
          mem_negocio: string
          mem_rol?: string
          mem_secuencial?: never
          mem_usuario_id: string
        }
        Update: {
          mem_actualizado_en?: string
          mem_creado_en?: string
          mem_detalle_membresia?: Json
          mem_estado?: string
          mem_fecha_registro?: string
          mem_id?: string
          mem_negocio?: string
          mem_rol?: string
          mem_secuencial?: never
          mem_usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seg_membresia_mem_usuario_id_fkey"
            columns: ["mem_usuario_id"]
            isOneToOne: false
            referencedRelation: "seg_usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      seg_membresia_perfil: {
        Row: {
          mpe_actualizado_en: string
          mpe_asignado_por: string | null
          mpe_creado_en: string
          mpe_detalle_membresia_perfil: Json
          mpe_id: string
          mpe_membresia_id: string
          mpe_perfil_id: string
          mpe_secuencial: number
        }
        Insert: {
          mpe_actualizado_en?: string
          mpe_asignado_por?: string | null
          mpe_creado_en?: string
          mpe_detalle_membresia_perfil?: Json
          mpe_id?: string
          mpe_membresia_id: string
          mpe_perfil_id: string
          mpe_secuencial?: never
        }
        Update: {
          mpe_actualizado_en?: string
          mpe_asignado_por?: string | null
          mpe_creado_en?: string
          mpe_detalle_membresia_perfil?: Json
          mpe_id?: string
          mpe_membresia_id?: string
          mpe_perfil_id?: string
          mpe_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "seg_membresia_perfil_mpe_asignado_por_fkey"
            columns: ["mpe_asignado_por"]
            isOneToOne: false
            referencedRelation: "seg_usuario"
            referencedColumns: ["usu_id"]
          },
          {
            foreignKeyName: "seg_membresia_perfil_mpe_membresia_id_fkey"
            columns: ["mpe_membresia_id"]
            isOneToOne: false
            referencedRelation: "seg_membresia"
            referencedColumns: ["mem_id"]
          },
          {
            foreignKeyName: "seg_membresia_perfil_mpe_perfil_id_fkey"
            columns: ["mpe_perfil_id"]
            isOneToOne: false
            referencedRelation: "seg_perfil"
            referencedColumns: ["per_id"]
          },
        ]
      }
      seg_otp_correo: {
        Row: {
          otp_codigo_hash: string
          otp_creado_en: string
          otp_expira_en: string
          otp_id: string
          otp_intentos: number
          otp_secuencial: number
          otp_usuario_id: string
          otp_verificado_en: string | null
        }
        Insert: {
          otp_codigo_hash: string
          otp_creado_en?: string
          otp_expira_en: string
          otp_id?: string
          otp_intentos?: number
          otp_secuencial?: never
          otp_usuario_id: string
          otp_verificado_en?: string | null
        }
        Update: {
          otp_codigo_hash?: string
          otp_creado_en?: string
          otp_expira_en?: string
          otp_id?: string
          otp_intentos?: number
          otp_secuencial?: never
          otp_usuario_id?: string
          otp_verificado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seg_otp_correo_otp_usuario_id_fkey"
            columns: ["otp_usuario_id"]
            isOneToOne: false
            referencedRelation: "seg_usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      seg_perfil: {
        Row: {
          per_activo: boolean
          per_actualizado_en: string
          per_asignable: boolean
          per_clave: string
          per_creado_en: string
          per_detalle_perfil: Json
          per_id: string
          per_nivel: number
          per_nombre: string
          per_secuencial: number
        }
        Insert: {
          per_activo?: boolean
          per_actualizado_en?: string
          per_asignable?: boolean
          per_clave: string
          per_creado_en?: string
          per_detalle_perfil?: Json
          per_id?: string
          per_nivel: number
          per_nombre: string
          per_secuencial?: never
        }
        Update: {
          per_activo?: boolean
          per_actualizado_en?: string
          per_asignable?: boolean
          per_clave?: string
          per_creado_en?: string
          per_detalle_perfil?: Json
          per_id?: string
          per_nivel?: number
          per_nombre?: string
          per_secuencial?: never
        }
        Relationships: []
      }
      seg_recuperacion_correo: {
        Row: {
          rec_creado_en: string
          rec_expira_en: string
          rec_id: string
          rec_secuencial: number
          rec_token_hash: string
          rec_usado_en: string | null
          rec_usuario_id: string
        }
        Insert: {
          rec_creado_en?: string
          rec_expira_en: string
          rec_id?: string
          rec_secuencial?: never
          rec_token_hash: string
          rec_usado_en?: string | null
          rec_usuario_id: string
        }
        Update: {
          rec_creado_en?: string
          rec_expira_en?: string
          rec_id?: string
          rec_secuencial?: never
          rec_token_hash?: string
          rec_usado_en?: string | null
          rec_usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seg_recuperacion_correo_rec_usuario_id_fkey"
            columns: ["rec_usuario_id"]
            isOneToOne: false
            referencedRelation: "seg_usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      seg_rol_widget: {
        Row: {
          rlw_actualizado_en: string
          rlw_creado_en: string
          rlw_id: string
          rlw_negocio: string
          rlw_rol: string
          rlw_secuencial: number
          rlw_visible: boolean
          rlw_widget_id: string
        }
        Insert: {
          rlw_actualizado_en?: string
          rlw_creado_en?: string
          rlw_id?: string
          rlw_negocio: string
          rlw_rol: string
          rlw_secuencial?: never
          rlw_visible?: boolean
          rlw_widget_id: string
        }
        Update: {
          rlw_actualizado_en?: string
          rlw_creado_en?: string
          rlw_id?: string
          rlw_negocio?: string
          rlw_rol?: string
          rlw_secuencial?: never
          rlw_visible?: boolean
          rlw_widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seg_rol_widget_rlw_widget_id_fkey"
            columns: ["rlw_widget_id"]
            isOneToOne: false
            referencedRelation: "seg_widget"
            referencedColumns: ["wdg_id"]
          },
        ]
      }
      seg_usuario: {
        Row: {
          usu_actualizado_en: string
          usu_apellidos: string | null
          usu_autorizacion_whatsapp: boolean
          usu_cedula: string | null
          usu_ciudad_id: string | null
          usu_correo: string
          usu_correo_verificado_en: string | null
          usu_creado_en: string
          usu_detalle_usuario: Json
          usu_eliminado_en: string | null
          usu_id: string
          usu_nombres: string | null
          usu_onboarding_completo: boolean
          usu_provincia_id: string | null
          usu_secuencial: number
          usu_superadmin_plataforma: boolean
          usu_terminos_aceptados_en: string | null
          usu_terminos_version: string | null
          usu_whatsapp: string | null
        }
        Insert: {
          usu_actualizado_en?: string
          usu_apellidos?: string | null
          usu_autorizacion_whatsapp?: boolean
          usu_cedula?: string | null
          usu_ciudad_id?: string | null
          usu_correo: string
          usu_correo_verificado_en?: string | null
          usu_creado_en?: string
          usu_detalle_usuario?: Json
          usu_eliminado_en?: string | null
          usu_id: string
          usu_nombres?: string | null
          usu_onboarding_completo?: boolean
          usu_provincia_id?: string | null
          usu_secuencial?: never
          usu_superadmin_plataforma?: boolean
          usu_terminos_aceptados_en?: string | null
          usu_terminos_version?: string | null
          usu_whatsapp?: string | null
        }
        Update: {
          usu_actualizado_en?: string
          usu_apellidos?: string | null
          usu_autorizacion_whatsapp?: boolean
          usu_cedula?: string | null
          usu_ciudad_id?: string | null
          usu_correo?: string
          usu_correo_verificado_en?: string | null
          usu_creado_en?: string
          usu_detalle_usuario?: Json
          usu_eliminado_en?: string | null
          usu_id?: string
          usu_nombres?: string | null
          usu_onboarding_completo?: boolean
          usu_provincia_id?: string | null
          usu_secuencial?: never
          usu_superadmin_plataforma?: boolean
          usu_terminos_aceptados_en?: string | null
          usu_terminos_version?: string | null
          usu_whatsapp?: string | null
        }
        Relationships: []
      }
      seg_widget: {
        Row: {
          wdg_activo: boolean
          wdg_actualizado_en: string
          wdg_clave: string
          wdg_creado_en: string
          wdg_detalle_widget: Json
          wdg_id: string
          wdg_negocio: string
          wdg_nombre: string
          wdg_secuencial: number
        }
        Insert: {
          wdg_activo?: boolean
          wdg_actualizado_en?: string
          wdg_clave: string
          wdg_creado_en?: string
          wdg_detalle_widget?: Json
          wdg_id?: string
          wdg_negocio: string
          wdg_nombre: string
          wdg_secuencial?: never
        }
        Update: {
          wdg_activo?: boolean
          wdg_actualizado_en?: string
          wdg_clave?: string
          wdg_creado_en?: string
          wdg_detalle_widget?: Json
          wdg_id?: string
          wdg_negocio?: string
          wdg_nombre?: string
          wdg_secuencial?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seg_fn_asegurar_membresia_cliente: {
        Args: { p_negocio: string }
        Returns: undefined
      }
      seg_fn_asignar_perfil: {
        Args: { p_negocio: string; p_perfil: string; p_usuario_id: string }
        Returns: undefined
      }
      seg_fn_asignar_rol: {
        Args: { p_negocio: string; p_rol: string; p_usuario_id: string }
        Returns: {
          mem_actualizado_en: string
          mem_creado_en: string
          mem_detalle_membresia: Json
          mem_estado: string
          mem_fecha_registro: string
          mem_id: string
          mem_negocio: string
          mem_rol: string
          mem_secuencial: number
          mem_usuario_id: string
        }
        SetofOptions: {
          from: "*"
          to: "seg_membresia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seg_fn_eliminar_cuenta: { Args: never; Returns: string }
      seg_fn_es_admin_negocio: { Args: { p_negocio: string }; Returns: boolean }
      seg_fn_es_operador_o_admin_negocio: {
        Args: { p_negocio: string }
        Returns: boolean
      }
      seg_fn_es_superadmin: { Args: never; Returns: boolean }
      seg_fn_generar_otp_registro: { Args: never; Returns: string }
      seg_fn_nivel_maximo: { Args: { p_negocio: string }; Returns: number }
      seg_fn_perfiles: { Args: { p_negocio: string }; Returns: string[] }
      seg_fn_perfiles_de: {
        Args: { p_negocio: string; p_usuario_id: string }
        Returns: string[]
      }
      seg_fn_quitar_perfil: {
        Args: { p_negocio: string; p_perfil: string; p_usuario_id: string }
        Returns: undefined
      }
      seg_fn_solicitar_recuperacion: {
        Args: { p_correo: string }
        Returns: string
      }
      seg_fn_superadmin_eliminar_usuario: {
        Args: { p_target_usu_id?: string; p_target_usuario_id?: string }
        Returns: string
      }
      seg_fn_superadmin_resetear_sistema: {
        Args: { p_negocio?: string }
        Returns: string
      }
      seg_fn_tiene_perfil: {
        Args: { p_clave: string; p_negocio: string }
        Returns: boolean
      }
      seg_fn_verificar_otp_registro: {
        Args: { p_codigo: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  tranqui_legal: {
    Tables: {
      trq_abogado: {
        Row: {
          abg_actualizado_en: string
          abg_creado_en: string
          abg_estado: string
          abg_id: string
          abg_mfa_verificado: boolean
          abg_solicitud_id: string
          abg_usuario_id: string
          abg_verificado_en: string
        }
        Insert: {
          abg_actualizado_en?: string
          abg_creado_en?: string
          abg_estado?: string
          abg_id?: string
          abg_mfa_verificado?: boolean
          abg_solicitud_id: string
          abg_usuario_id: string
          abg_verificado_en?: string
        }
        Update: {
          abg_actualizado_en?: string
          abg_creado_en?: string
          abg_estado?: string
          abg_id?: string
          abg_mfa_verificado?: boolean
          abg_solicitud_id?: string
          abg_usuario_id?: string
          abg_verificado_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_abogado_abg_solicitud_id_fkey"
            columns: ["abg_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
      trq_caso_judicial: {
        Row: {
          cas_abierto_en: string
          cas_abogado_id: string | null
          cas_actualizado_en: string
          cas_cerrado_en: string | null
          cas_cliente_id: string
          cas_creado_en: string
          cas_descripcion: string | null
          cas_detalle_caso: Json
          cas_eliminado_en: string | null
          cas_estado: string
          cas_id: string
          cas_materia_id: string | null
          cas_numero_proceso: string | null
          cas_prioridad: string
          cas_provincia_id: string | null
          cas_secuencial: number
          cas_titulo: string
        }
        Insert: {
          cas_abierto_en?: string
          cas_abogado_id?: string | null
          cas_actualizado_en?: string
          cas_cerrado_en?: string | null
          cas_cliente_id: string
          cas_creado_en?: string
          cas_descripcion?: string | null
          cas_detalle_caso?: Json
          cas_eliminado_en?: string | null
          cas_estado?: string
          cas_id?: string
          cas_materia_id?: string | null
          cas_numero_proceso?: string | null
          cas_prioridad?: string
          cas_provincia_id?: string | null
          cas_secuencial?: never
          cas_titulo: string
        }
        Update: {
          cas_abierto_en?: string
          cas_abogado_id?: string | null
          cas_actualizado_en?: string
          cas_cerrado_en?: string | null
          cas_cliente_id?: string
          cas_creado_en?: string
          cas_descripcion?: string | null
          cas_detalle_caso?: Json
          cas_eliminado_en?: string | null
          cas_estado?: string
          cas_id?: string
          cas_materia_id?: string | null
          cas_numero_proceso?: string | null
          cas_prioridad?: string
          cas_provincia_id?: string | null
          cas_secuencial?: never
          cas_titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_caso_judicial_cas_abogado_id_fkey"
            columns: ["cas_abogado_id"]
            isOneToOne: false
            referencedRelation: "trq_abogado"
            referencedColumns: ["abg_id"]
          },
          {
            foreignKeyName: "trq_caso_judicial_cas_materia_id_fkey"
            columns: ["cas_materia_id"]
            isOneToOne: false
            referencedRelation: "trq_materia"
            referencedColumns: ["mat_id"]
          },
        ]
      }
      trq_cita: {
        Row: {
          cit_abogado_id: string | null
          cit_actualizado_en: string
          cit_caso_id: string | null
          cit_cliente_id: string
          cit_creado_en: string
          cit_eliminado_en: string | null
          cit_enlace: string | null
          cit_estado: string
          cit_fin_en: string | null
          cit_id: string
          cit_inicio_en: string
          cit_lugar: string | null
          cit_modalidad: string
          cit_motivo: string | null
          cit_notas: string | null
          cit_secuencial: number
        }
        Insert: {
          cit_abogado_id?: string | null
          cit_actualizado_en?: string
          cit_caso_id?: string | null
          cit_cliente_id: string
          cit_creado_en?: string
          cit_eliminado_en?: string | null
          cit_enlace?: string | null
          cit_estado?: string
          cit_fin_en?: string | null
          cit_id?: string
          cit_inicio_en: string
          cit_lugar?: string | null
          cit_modalidad?: string
          cit_motivo?: string | null
          cit_notas?: string | null
          cit_secuencial?: never
        }
        Update: {
          cit_abogado_id?: string | null
          cit_actualizado_en?: string
          cit_caso_id?: string | null
          cit_cliente_id?: string
          cit_creado_en?: string
          cit_eliminado_en?: string | null
          cit_enlace?: string | null
          cit_estado?: string
          cit_fin_en?: string | null
          cit_id?: string
          cit_inicio_en?: string
          cit_lugar?: string | null
          cit_modalidad?: string
          cit_motivo?: string | null
          cit_notas?: string | null
          cit_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "trq_cita_cit_abogado_id_fkey"
            columns: ["cit_abogado_id"]
            isOneToOne: false
            referencedRelation: "trq_abogado"
            referencedColumns: ["abg_id"]
          },
          {
            foreignKeyName: "trq_cita_cit_caso_id_fkey"
            columns: ["cit_caso_id"]
            isOneToOne: false
            referencedRelation: "trq_caso_judicial"
            referencedColumns: ["cas_id"]
          },
        ]
      }
      trq_conversacion: {
        Row: {
          cnv_actualizado_en: string
          cnv_agente_slug: string | null
          cnv_creado_en: string
          cnv_eliminado_en: string | null
          cnv_id: string
          cnv_rol: string
          cnv_titulo: string | null
          cnv_ultimo_mensaje_en: string
          cnv_usuario_id: string
        }
        Insert: {
          cnv_actualizado_en?: string
          cnv_agente_slug?: string | null
          cnv_creado_en?: string
          cnv_eliminado_en?: string | null
          cnv_id?: string
          cnv_rol: string
          cnv_titulo?: string | null
          cnv_ultimo_mensaje_en?: string
          cnv_usuario_id: string
        }
        Update: {
          cnv_actualizado_en?: string
          cnv_agente_slug?: string | null
          cnv_creado_en?: string
          cnv_eliminado_en?: string | null
          cnv_id?: string
          cnv_rol?: string
          cnv_titulo?: string | null
          cnv_ultimo_mensaje_en?: string
          cnv_usuario_id?: string
        }
        Relationships: []
      }
      trq_documento_caso: {
        Row: {
          dcc_actualizado_en: string
          dcc_caso_id: string
          dcc_creado_en: string
          dcc_dictamen: Json
          dcc_dictaminado_en: string | null
          dcc_eliminado_en: string | null
          dcc_estado_revision: string
          dcc_id: string
          dcc_mime: string | null
          dcc_nombre_archivo: string | null
          dcc_ruta_storage: string
          dcc_subido_por: string | null
          dcc_tamano_bytes: number | null
          dcc_tipo: string
        }
        Insert: {
          dcc_actualizado_en?: string
          dcc_caso_id: string
          dcc_creado_en?: string
          dcc_dictamen?: Json
          dcc_dictaminado_en?: string | null
          dcc_eliminado_en?: string | null
          dcc_estado_revision?: string
          dcc_id?: string
          dcc_mime?: string | null
          dcc_nombre_archivo?: string | null
          dcc_ruta_storage: string
          dcc_subido_por?: string | null
          dcc_tamano_bytes?: number | null
          dcc_tipo?: string
        }
        Update: {
          dcc_actualizado_en?: string
          dcc_caso_id?: string
          dcc_creado_en?: string
          dcc_dictamen?: Json
          dcc_dictaminado_en?: string | null
          dcc_eliminado_en?: string | null
          dcc_estado_revision?: string
          dcc_id?: string
          dcc_mime?: string | null
          dcc_nombre_archivo?: string | null
          dcc_ruta_storage?: string
          dcc_subido_por?: string | null
          dcc_tamano_bytes?: number | null
          dcc_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_documento_caso_dcc_caso_id_fkey"
            columns: ["dcc_caso_id"]
            isOneToOne: false
            referencedRelation: "trq_caso_judicial"
            referencedColumns: ["cas_id"]
          },
        ]
      }
      trq_documento_socio: {
        Row: {
          dcs_comentario: string | null
          dcs_creado_en: string
          dcs_id: string
          dcs_nombre_archivo: string | null
          dcs_solicitud_id: string
          dcs_subido_por: string | null
          dcs_tipo: string
          dcs_url: string
        }
        Insert: {
          dcs_comentario?: string | null
          dcs_creado_en?: string
          dcs_id?: string
          dcs_nombre_archivo?: string | null
          dcs_solicitud_id: string
          dcs_subido_por?: string | null
          dcs_tipo: string
          dcs_url: string
        }
        Update: {
          dcs_comentario?: string | null
          dcs_creado_en?: string
          dcs_id?: string
          dcs_nombre_archivo?: string | null
          dcs_solicitud_id?: string
          dcs_subido_por?: string | null
          dcs_tipo?: string
          dcs_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_documento_socio_dcs_solicitud_id_fkey"
            columns: ["dcs_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
      trq_experiencia_laboral: {
        Row: {
          exp_cargo: string
          exp_creado_en: string
          exp_descripcion: string | null
          exp_empresa: string
          exp_fecha_fin: string | null
          exp_fecha_inicio: string
          exp_id: string
          exp_solicitud_id: string
        }
        Insert: {
          exp_cargo: string
          exp_creado_en?: string
          exp_descripcion?: string | null
          exp_empresa: string
          exp_fecha_fin?: string | null
          exp_fecha_inicio: string
          exp_id?: string
          exp_solicitud_id: string
        }
        Update: {
          exp_cargo?: string
          exp_creado_en?: string
          exp_descripcion?: string | null
          exp_empresa?: string
          exp_fecha_fin?: string | null
          exp_fecha_inicio?: string
          exp_id?: string
          exp_solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_experiencia_laboral_exp_solicitud_id_fkey"
            columns: ["exp_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
      trq_honorario: {
        Row: {
          hon_abogado_id: string
          hon_actualizado_en: string
          hon_caso_id: string | null
          hon_concepto: string
          hon_creado_en: string
          hon_eliminado_en: string | null
          hon_estado: string
          hon_id: string
          hon_liquidado_en: string | null
          hon_moneda: string
          hon_monto: number
          hon_periodo: string
          hon_secuencial: number
        }
        Insert: {
          hon_abogado_id: string
          hon_actualizado_en?: string
          hon_caso_id?: string | null
          hon_concepto: string
          hon_creado_en?: string
          hon_eliminado_en?: string | null
          hon_estado?: string
          hon_id?: string
          hon_liquidado_en?: string | null
          hon_moneda?: string
          hon_monto: number
          hon_periodo: string
          hon_secuencial?: never
        }
        Update: {
          hon_abogado_id?: string
          hon_actualizado_en?: string
          hon_caso_id?: string | null
          hon_concepto?: string
          hon_creado_en?: string
          hon_eliminado_en?: string | null
          hon_estado?: string
          hon_id?: string
          hon_liquidado_en?: string | null
          hon_moneda?: string
          hon_monto?: number
          hon_periodo?: string
          hon_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "trq_honorario_hon_abogado_id_fkey"
            columns: ["hon_abogado_id"]
            isOneToOne: false
            referencedRelation: "trq_abogado"
            referencedColumns: ["abg_id"]
          },
          {
            foreignKeyName: "trq_honorario_hon_caso_id_fkey"
            columns: ["hon_caso_id"]
            isOneToOne: false
            referencedRelation: "trq_caso_judicial"
            referencedColumns: ["cas_id"]
          },
        ]
      }
      trq_materia: {
        Row: {
          mat_activa: boolean
          mat_creado_en: string
          mat_id: string
          mat_nombre: string
        }
        Insert: {
          mat_activa?: boolean
          mat_creado_en?: string
          mat_id?: string
          mat_nombre: string
        }
        Update: {
          mat_activa?: boolean
          mat_creado_en?: string
          mat_id?: string
          mat_nombre?: string
        }
        Relationships: []
      }
      trq_mensaje: {
        Row: {
          msg_autor: string
          msg_contenido: string
          msg_conversacion_id: string
          msg_creado_en: string
          msg_id: string
          msg_run_id: string | null
        }
        Insert: {
          msg_autor: string
          msg_contenido: string
          msg_conversacion_id: string
          msg_creado_en?: string
          msg_id?: string
          msg_run_id?: string | null
        }
        Update: {
          msg_autor?: string
          msg_contenido?: string
          msg_conversacion_id?: string
          msg_creado_en?: string
          msg_id?: string
          msg_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trq_mensaje_msg_conversacion_id_fkey"
            columns: ["msg_conversacion_id"]
            isOneToOne: false
            referencedRelation: "trq_conversacion"
            referencedColumns: ["cnv_id"]
          },
        ]
      }
      trq_revision_solicitud: {
        Row: {
          rev_admin_id: string | null
          rev_comentario: string | null
          rev_creado_en: string
          rev_decision: string
          rev_id: string
          rev_solicitud_id: string
        }
        Insert: {
          rev_admin_id?: string | null
          rev_comentario?: string | null
          rev_creado_en?: string
          rev_decision: string
          rev_id?: string
          rev_solicitud_id: string
        }
        Update: {
          rev_admin_id?: string | null
          rev_comentario?: string | null
          rev_creado_en?: string
          rev_decision?: string
          rev_id?: string
          rev_solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_revision_solicitud_rev_solicitud_id_fkey"
            columns: ["rev_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
      trq_solicitud_materia: {
        Row: {
          sma_id: string
          sma_materia_id: string
          sma_solicitud_id: string
        }
        Insert: {
          sma_id?: string
          sma_materia_id: string
          sma_solicitud_id: string
        }
        Update: {
          sma_id?: string
          sma_materia_id?: string
          sma_solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_solicitud_materia_sma_materia_id_fkey"
            columns: ["sma_materia_id"]
            isOneToOne: false
            referencedRelation: "trq_materia"
            referencedColumns: ["mat_id"]
          },
          {
            foreignKeyName: "trq_solicitud_materia_sma_solicitud_id_fkey"
            columns: ["sma_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
      trq_solicitud_provincia: {
        Row: {
          spr_id: string
          spr_provincia_id: string
          spr_solicitud_id: string
        }
        Insert: {
          spr_id?: string
          spr_provincia_id: string
          spr_solicitud_id: string
        }
        Update: {
          spr_id?: string
          spr_provincia_id?: string
          spr_solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_solicitud_provincia_spr_solicitud_id_fkey"
            columns: ["spr_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
      trq_solicitud_socio: {
        Row: {
          ssc_actualizado_en: string
          ssc_anio_graduacion: number
          ssc_anos_experiencia: number
          ssc_cedula: string
          ssc_contrato_confirmado_en: string | null
          ssc_contrato_confirmado_por: string | null
          ssc_creado_en: string
          ssc_eliminado_en: string | null
          ssc_enlace_foro_verificado: boolean
          ssc_enlace_senescyt_verificado: boolean
          ssc_enviada_en: string
          ssc_estado: string
          ssc_id: string
          ssc_matricula_profesional: string
          ssc_resumen_profesional: string
          ssc_secuencial: number
          ssc_telefono_contacto: string | null
          ssc_universidad: string
          ssc_usuario_id: string
        }
        Insert: {
          ssc_actualizado_en?: string
          ssc_anio_graduacion: number
          ssc_anos_experiencia?: number
          ssc_cedula: string
          ssc_contrato_confirmado_en?: string | null
          ssc_contrato_confirmado_por?: string | null
          ssc_creado_en?: string
          ssc_eliminado_en?: string | null
          ssc_enlace_foro_verificado?: boolean
          ssc_enlace_senescyt_verificado?: boolean
          ssc_enviada_en?: string
          ssc_estado?: string
          ssc_id?: string
          ssc_matricula_profesional: string
          ssc_resumen_profesional: string
          ssc_secuencial?: never
          ssc_telefono_contacto?: string | null
          ssc_universidad: string
          ssc_usuario_id: string
        }
        Update: {
          ssc_actualizado_en?: string
          ssc_anio_graduacion?: number
          ssc_anos_experiencia?: number
          ssc_cedula?: string
          ssc_contrato_confirmado_en?: string | null
          ssc_contrato_confirmado_por?: string | null
          ssc_creado_en?: string
          ssc_eliminado_en?: string | null
          ssc_enlace_foro_verificado?: boolean
          ssc_enlace_senescyt_verificado?: boolean
          ssc_enviada_en?: string
          ssc_estado?: string
          ssc_id?: string
          ssc_matricula_profesional?: string
          ssc_resumen_profesional?: string
          ssc_secuencial?: never
          ssc_telefono_contacto?: string | null
          ssc_universidad?: string
          ssc_usuario_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      trq_fn_abogado_actual: { Args: never; Returns: string }
      trq_fn_decidir_solicitud: {
        Args: {
          p_comentario?: string
          p_decision: string
          p_solicitud_id: string
        }
        Returns: {
          ssc_actualizado_en: string
          ssc_anio_graduacion: number
          ssc_anos_experiencia: number
          ssc_cedula: string
          ssc_contrato_confirmado_en: string | null
          ssc_contrato_confirmado_por: string | null
          ssc_creado_en: string
          ssc_eliminado_en: string | null
          ssc_enlace_foro_verificado: boolean
          ssc_enlace_senescyt_verificado: boolean
          ssc_enviada_en: string
          ssc_estado: string
          ssc_id: string
          ssc_matricula_profesional: string
          ssc_resumen_profesional: string
          ssc_secuencial: number
          ssc_telefono_contacto: string | null
          ssc_universidad: string
          ssc_usuario_id: string
        }
        SetofOptions: {
          from: "*"
          to: "trq_solicitud_socio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      trq_fn_es_admin_mfa_verificado: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  comun_auditoria: {
    Enums: {},
  },
  comun_catalogo: {
    Enums: {},
  },
  comun_configuracion: {
    Enums: {},
  },
  comun_notificaciones: {
    Enums: {},
  },
  comun_seguridad: {
    Enums: {},
  },
  tranqui_legal: {
    Enums: {},
  },
} as const
