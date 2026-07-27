// Generado con: supabase gen types typescript --project-id oaybbpdxhlxjbpwnoymy
//   --schema comun_seguridad,comun_auditoria,comun_configuracion
// Regenerar en el mismo PR que aplique una migracion nueva. Esquemas
// pendientes de incluir cuando existan: comun_facturacion, comun_catalogo,
// comun_agentes, comun_comercio, y los de cada negocio.
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
  comun_configuracion: {
    Enums: {},
  },
  comun_seguridad: {
    Enums: {},
  },
} as const
