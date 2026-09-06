// Generado con: npx supabase gen types typescript --project-id oaybbpdxhlxjbpwnoymy
//   --schema public,comun_seguridad,comun_auditoria,comun_configuracion,comun_catalogo,comun_notificaciones,
//            comun_notificacion,comun_reclutamiento,comun_comercio,comun_agenda,tranqui_legal
// Regenerar en el mismo PR que cualquier migracion nueva que toque columnas
// Regenerado 2026-09-06 tras desplegar las 36 migraciones atrasadas.
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
  comun_agenda: {
    Tables: {
      age_bloqueo: {
        Row: {
          blq_actualizado_en: string
          blq_creado_en: string
          blq_eliminado_en: string | null
          blq_fin_en: string
          blq_id: string
          blq_inicio_en: string
          blq_motivo: string | null
          blq_origen: string
          blq_origen_externo_id: string | null
          blq_profesional_id: string
          blq_secuencial: number
        }
        Insert: {
          blq_actualizado_en?: string
          blq_creado_en?: string
          blq_eliminado_en?: string | null
          blq_fin_en: string
          blq_id?: string
          blq_inicio_en: string
          blq_motivo?: string | null
          blq_origen?: string
          blq_origen_externo_id?: string | null
          blq_profesional_id: string
          blq_secuencial?: never
        }
        Update: {
          blq_actualizado_en?: string
          blq_creado_en?: string
          blq_eliminado_en?: string | null
          blq_fin_en?: string
          blq_id?: string
          blq_inicio_en?: string
          blq_motivo?: string | null
          blq_origen?: string
          blq_origen_externo_id?: string | null
          blq_profesional_id?: string
          blq_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "age_bloqueo_blq_profesional_id_fkey"
            columns: ["blq_profesional_id"]
            isOneToOne: false
            referencedRelation: "age_profesional"
            referencedColumns: ["agp_id"]
          },
        ]
      }
      age_franja: {
        Row: {
          fra_actualizado_en: string
          fra_creado_en: string
          fra_dia_semana: number
          fra_eliminado_en: string | null
          fra_hora_fin: string
          fra_hora_inicio: string
          fra_id: string
          fra_modalidad: string
          fra_profesional_id: string
          fra_secuencial: number
        }
        Insert: {
          fra_actualizado_en?: string
          fra_creado_en?: string
          fra_dia_semana: number
          fra_eliminado_en?: string | null
          fra_hora_fin: string
          fra_hora_inicio: string
          fra_id?: string
          fra_modalidad?: string
          fra_profesional_id: string
          fra_secuencial?: never
        }
        Update: {
          fra_actualizado_en?: string
          fra_creado_en?: string
          fra_dia_semana?: number
          fra_eliminado_en?: string | null
          fra_hora_fin?: string
          fra_hora_inicio?: string
          fra_id?: string
          fra_modalidad?: string
          fra_profesional_id?: string
          fra_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "age_franja_fra_profesional_id_fkey"
            columns: ["fra_profesional_id"]
            isOneToOne: false
            referencedRelation: "age_profesional"
            referencedColumns: ["agp_id"]
          },
        ]
      }
      age_profesional: {
        Row: {
          agp_acepta_turno: boolean
          agp_actualizado_en: string
          agp_antelacion_minima_horas: number
          agp_configurada_en: string | null
          agp_creado_en: string
          agp_detalle_profesional: Json
          agp_direccion: string | null
          agp_duracion_cita_min: number
          agp_eliminado_en: string | null
          agp_google_calendar_id: string | null
          agp_google_credencial_ref: string | null
          agp_holgura_min: number
          agp_horizonte_dias: number
          agp_id: string
          agp_modalidades: string[]
          agp_negocio: string
          agp_secuencial: number
          agp_ultimo_turno_en: string | null
          agp_usuario_id: string
          agp_zona_horaria: string
        }
        Insert: {
          agp_acepta_turno?: boolean
          agp_actualizado_en?: string
          agp_antelacion_minima_horas?: number
          agp_configurada_en?: string | null
          agp_creado_en?: string
          agp_detalle_profesional?: Json
          agp_direccion?: string | null
          agp_duracion_cita_min?: number
          agp_eliminado_en?: string | null
          agp_google_calendar_id?: string | null
          agp_google_credencial_ref?: string | null
          agp_holgura_min?: number
          agp_horizonte_dias?: number
          agp_id?: string
          agp_modalidades?: string[]
          agp_negocio: string
          agp_secuencial?: never
          agp_ultimo_turno_en?: string | null
          agp_usuario_id: string
          agp_zona_horaria?: string
        }
        Update: {
          agp_acepta_turno?: boolean
          agp_actualizado_en?: string
          agp_antelacion_minima_horas?: number
          agp_configurada_en?: string | null
          agp_creado_en?: string
          agp_detalle_profesional?: Json
          agp_direccion?: string | null
          agp_duracion_cita_min?: number
          agp_eliminado_en?: string | null
          agp_google_calendar_id?: string | null
          agp_google_credencial_ref?: string | null
          agp_holgura_min?: number
          agp_horizonte_dias?: number
          agp_id?: string
          agp_modalidades?: string[]
          agp_negocio?: string
          agp_secuencial?: never
          agp_ultimo_turno_en?: string | null
          agp_usuario_id?: string
          agp_zona_horaria?: string
        }
        Relationships: []
      }
      age_reserva: {
        Row: {
          res_actualizado_en: string
          res_cliente_id: string | null
          res_creado_en: string
          res_detalle_reserva: Json
          res_eliminado_en: string | null
          res_estado: string
          res_fin_en: string
          res_id: string
          res_inicio_en: string
          res_modalidad: string
          res_negocio: string
          res_profesional_id: string
          res_referencia_id: string | null
          res_referencia_tabla: string | null
          res_secuencial: number
          res_usuario_id: string
          res_variante_id: string | null
        }
        Insert: {
          res_actualizado_en?: string
          res_cliente_id?: string | null
          res_creado_en?: string
          res_detalle_reserva?: Json
          res_eliminado_en?: string | null
          res_estado?: string
          res_fin_en: string
          res_id?: string
          res_inicio_en: string
          res_modalidad?: string
          res_negocio: string
          res_profesional_id: string
          res_referencia_id?: string | null
          res_referencia_tabla?: string | null
          res_secuencial?: never
          res_usuario_id: string
          res_variante_id?: string | null
        }
        Update: {
          res_actualizado_en?: string
          res_cliente_id?: string | null
          res_creado_en?: string
          res_detalle_reserva?: Json
          res_eliminado_en?: string | null
          res_estado?: string
          res_fin_en?: string
          res_id?: string
          res_inicio_en?: string
          res_modalidad?: string
          res_negocio?: string
          res_profesional_id?: string
          res_referencia_id?: string | null
          res_referencia_tabla?: string | null
          res_secuencial?: never
          res_usuario_id?: string
          res_variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "age_reserva_res_profesional_id_fkey"
            columns: ["res_profesional_id"]
            isOneToOne: false
            referencedRelation: "age_profesional"
            referencedColumns: ["agp_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      age_fn_bloquear: {
        Args: {
          p_fin: string
          p_inicio: string
          p_motivo?: string
          p_negocio: string
          p_origen?: string
        }
        Returns: string
      }
      age_fn_configurar_agenda: {
        Args: { p_config: Json; p_franjas: Json; p_negocio: string }
        Returns: string
      }
      age_fn_huecos_del_pool: {
        Args: {
          p_candidatos: string[]
          p_desde: string
          p_duracion_min?: number
          p_hasta: string
          p_limite?: number
          p_modalidad?: string
        }
        Returns: {
          disponibles: number
          hueco_fin: string
          hueco_inicio: string
        }[]
      }
      age_fn_huecos_disponibles: {
        Args: {
          p_desde: string
          p_duracion_min?: number
          p_hasta: string
          p_modalidad?: string
          p_profesional_id: string
        }
        Returns: {
          hueco_fin: string
          hueco_inicio: string
        }[]
      }
      age_fn_siguiente_en_turno: {
        Args: {
          p_candidatos: string[]
          p_fin: string
          p_inicio: string
          p_modalidad?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
  comun_comercio: {
    Tables: {
      com_beneficiario_empresa: {
        Row: {
          bnf_actualizado_en: string
          bnf_convenio_id: string
          bnf_correo_corporativo: string | null
          bnf_creado_en: string
          bnf_detalle_beneficiario: Json
          bnf_eliminado_en: string | null
          bnf_estado: string
          bnf_id: string
          bnf_identificacion: string
          bnf_negocio: string
          bnf_nombres: string | null
          bnf_secuencial: number
          bnf_usuario_vinculado_id: string | null
          bnf_vinculado_en: string | null
        }
        Insert: {
          bnf_actualizado_en?: string
          bnf_convenio_id: string
          bnf_correo_corporativo?: string | null
          bnf_creado_en?: string
          bnf_detalle_beneficiario?: Json
          bnf_eliminado_en?: string | null
          bnf_estado?: string
          bnf_id?: string
          bnf_identificacion: string
          bnf_negocio: string
          bnf_nombres?: string | null
          bnf_secuencial?: never
          bnf_usuario_vinculado_id?: string | null
          bnf_vinculado_en?: string | null
        }
        Update: {
          bnf_actualizado_en?: string
          bnf_convenio_id?: string
          bnf_correo_corporativo?: string | null
          bnf_creado_en?: string
          bnf_detalle_beneficiario?: Json
          bnf_eliminado_en?: string | null
          bnf_estado?: string
          bnf_id?: string
          bnf_identificacion?: string
          bnf_negocio?: string
          bnf_nombres?: string | null
          bnf_secuencial?: never
          bnf_usuario_vinculado_id?: string | null
          bnf_vinculado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_beneficiario_empresa_bnf_convenio_id_fkey"
            columns: ["bnf_convenio_id"]
            isOneToOne: false
            referencedRelation: "com_convenio_empresa"
            referencedColumns: ["cve_id"]
          },
        ]
      }
      com_billetera: {
        Row: {
          wlt_activo: boolean
          wlt_actualizado_en: string
          wlt_creado_en: string
          wlt_eliminado_en: string | null
          wlt_id: string
          wlt_negocio: string
          wlt_saldo_bono: number
          wlt_saldo_recarga: number
          wlt_saldo_total: number
          wlt_secuencial: number
          wlt_usuario_id: string
        }
        Insert: {
          wlt_activo?: boolean
          wlt_actualizado_en?: string
          wlt_creado_en?: string
          wlt_eliminado_en?: string | null
          wlt_id?: string
          wlt_negocio: string
          wlt_saldo_bono?: number
          wlt_saldo_recarga?: number
          wlt_saldo_total?: number
          wlt_secuencial?: never
          wlt_usuario_id: string
        }
        Update: {
          wlt_activo?: boolean
          wlt_actualizado_en?: string
          wlt_creado_en?: string
          wlt_eliminado_en?: string | null
          wlt_id?: string
          wlt_negocio?: string
          wlt_saldo_bono?: number
          wlt_saldo_recarga?: number
          wlt_saldo_total?: number
          wlt_secuencial?: never
          wlt_usuario_id?: string
        }
        Relationships: []
      }
      com_billetera_movimiento: {
        Row: {
          wlm_actualizado_en: string
          wlm_billetera_id: string
          wlm_convenio_id: string | null
          wlm_creado_en: string
          wlm_descripcion: string
          wlm_detalle_movimiento: Json
          wlm_eliminado_en: string | null
          wlm_expira_en: string | null
          wlm_id: string
          wlm_monto: number
          wlm_negocio: string
          wlm_referencia_id: string | null
          wlm_saldo_anterior: number
          wlm_saldo_posterior: number
          wlm_secuencial: number
          wlm_tipo: string
          wlm_tipo_saldo: string
        }
        Insert: {
          wlm_actualizado_en?: string
          wlm_billetera_id: string
          wlm_convenio_id?: string | null
          wlm_creado_en?: string
          wlm_descripcion: string
          wlm_detalle_movimiento?: Json
          wlm_eliminado_en?: string | null
          wlm_expira_en?: string | null
          wlm_id?: string
          wlm_monto: number
          wlm_negocio: string
          wlm_referencia_id?: string | null
          wlm_saldo_anterior: number
          wlm_saldo_posterior: number
          wlm_secuencial?: never
          wlm_tipo: string
          wlm_tipo_saldo: string
        }
        Update: {
          wlm_actualizado_en?: string
          wlm_billetera_id?: string
          wlm_convenio_id?: string | null
          wlm_creado_en?: string
          wlm_descripcion?: string
          wlm_detalle_movimiento?: Json
          wlm_eliminado_en?: string | null
          wlm_expira_en?: string | null
          wlm_id?: string
          wlm_monto?: number
          wlm_negocio?: string
          wlm_referencia_id?: string | null
          wlm_saldo_anterior?: number
          wlm_saldo_posterior?: number
          wlm_secuencial?: never
          wlm_tipo?: string
          wlm_tipo_saldo?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_billetera_movimiento_wlm_billetera_id_fkey"
            columns: ["wlm_billetera_id"]
            isOneToOne: false
            referencedRelation: "com_billetera"
            referencedColumns: ["wlt_id"]
          },
          {
            foreignKeyName: "com_billetera_movimiento_wlm_convenio_id_fkey"
            columns: ["wlm_convenio_id"]
            isOneToOne: false
            referencedRelation: "com_convenio_empresa"
            referencedColumns: ["cve_id"]
          },
        ]
      }
      com_categoria: {
        Row: {
          ctg_activo: boolean
          ctg_actualizado_en: string
          ctg_creado_en: string
          ctg_descripcion: string | null
          ctg_detalle_categoria: Json
          ctg_eliminado_en: string | null
          ctg_id: string
          ctg_negocio: string
          ctg_nombre: string
          ctg_orden: number
          ctg_padre_id: string | null
          ctg_secuencial: number
          ctg_slug: string
          ctg_tipo: string
        }
        Insert: {
          ctg_activo?: boolean
          ctg_actualizado_en?: string
          ctg_creado_en?: string
          ctg_descripcion?: string | null
          ctg_detalle_categoria?: Json
          ctg_eliminado_en?: string | null
          ctg_id?: string
          ctg_negocio: string
          ctg_nombre: string
          ctg_orden?: number
          ctg_padre_id?: string | null
          ctg_secuencial?: never
          ctg_slug: string
          ctg_tipo?: string
        }
        Update: {
          ctg_activo?: boolean
          ctg_actualizado_en?: string
          ctg_creado_en?: string
          ctg_descripcion?: string | null
          ctg_detalle_categoria?: Json
          ctg_eliminado_en?: string | null
          ctg_id?: string
          ctg_negocio?: string
          ctg_nombre?: string
          ctg_orden?: number
          ctg_padre_id?: string | null
          ctg_secuencial?: never
          ctg_slug?: string
          ctg_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_categoria_ctg_padre_id_fkey"
            columns: ["ctg_padre_id"]
            isOneToOne: false
            referencedRelation: "com_categoria"
            referencedColumns: ["ctg_id"]
          },
        ]
      }
      com_convenio_empresa: {
        Row: {
          cve_activo: boolean
          cve_actualizado_en: string
          cve_creado_en: string
          cve_detalle_convenio: Json
          cve_dominio_correo: string | null
          cve_eliminado_en: string | null
          cve_empresa_nombre: string
          cve_empresa_ruc: string | null
          cve_id: string
          cve_monto_bono_inicial: number
          cve_negocio: string
          cve_porcentaje_subsidio: number
          cve_secuencial: number
          cve_valido_hasta: string | null
          cve_variante_id: string | null
        }
        Insert: {
          cve_activo?: boolean
          cve_actualizado_en?: string
          cve_creado_en?: string
          cve_detalle_convenio?: Json
          cve_dominio_correo?: string | null
          cve_eliminado_en?: string | null
          cve_empresa_nombre: string
          cve_empresa_ruc?: string | null
          cve_id?: string
          cve_monto_bono_inicial?: number
          cve_negocio: string
          cve_porcentaje_subsidio?: number
          cve_secuencial?: never
          cve_valido_hasta?: string | null
          cve_variante_id?: string | null
        }
        Update: {
          cve_activo?: boolean
          cve_actualizado_en?: string
          cve_creado_en?: string
          cve_detalle_convenio?: Json
          cve_dominio_correo?: string | null
          cve_eliminado_en?: string | null
          cve_empresa_nombre?: string
          cve_empresa_ruc?: string | null
          cve_id?: string
          cve_monto_bono_inicial?: number
          cve_negocio?: string
          cve_porcentaje_subsidio?: number
          cve_secuencial?: never
          cve_valido_hasta?: string | null
          cve_variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_convenio_empresa_cve_variante_id_fkey"
            columns: ["cve_variante_id"]
            isOneToOne: false
            referencedRelation: "com_variante"
            referencedColumns: ["var_id"]
          },
        ]
      }
      com_cupon: {
        Row: {
          cup_activo: boolean
          cup_actualizado_en: string
          cup_aplica_a: string
          cup_codigo: string
          cup_creado_en: string
          cup_descripcion: string | null
          cup_detalle_cupon: Json
          cup_eliminado_en: string | null
          cup_id: string
          cup_influencer_nombre: string | null
          cup_limite_usos_global: number | null
          cup_limite_usos_por_usuario: number
          cup_monto_minimo_compra: number
          cup_negocio: string
          cup_regla_suscripcion: string
          cup_secuencial: number
          cup_tipo: string
          cup_usos_actuales: number
          cup_valido_desde: string
          cup_valido_hasta: string | null
          cup_valor: number
        }
        Insert: {
          cup_activo?: boolean
          cup_actualizado_en?: string
          cup_aplica_a?: string
          cup_codigo: string
          cup_creado_en?: string
          cup_descripcion?: string | null
          cup_detalle_cupon?: Json
          cup_eliminado_en?: string | null
          cup_id?: string
          cup_influencer_nombre?: string | null
          cup_limite_usos_global?: number | null
          cup_limite_usos_por_usuario?: number
          cup_monto_minimo_compra?: number
          cup_negocio: string
          cup_regla_suscripcion?: string
          cup_secuencial?: never
          cup_tipo?: string
          cup_usos_actuales?: number
          cup_valido_desde?: string
          cup_valido_hasta?: string | null
          cup_valor: number
        }
        Update: {
          cup_activo?: boolean
          cup_actualizado_en?: string
          cup_aplica_a?: string
          cup_codigo?: string
          cup_creado_en?: string
          cup_descripcion?: string | null
          cup_detalle_cupon?: Json
          cup_eliminado_en?: string | null
          cup_id?: string
          cup_influencer_nombre?: string | null
          cup_limite_usos_global?: number | null
          cup_limite_usos_por_usuario?: number
          cup_monto_minimo_compra?: number
          cup_negocio?: string
          cup_regla_suscripcion?: string
          cup_secuencial?: never
          cup_tipo?: string
          cup_usos_actuales?: number
          cup_valido_desde?: string
          cup_valido_hasta?: string | null
          cup_valor?: number
        }
        Relationships: []
      }
      com_cupon_uso: {
        Row: {
          cpu_actualizado_en: string
          cpu_creado_en: string
          cpu_cupon_id: string
          cpu_detalle_uso: Json
          cpu_eliminado_en: string | null
          cpu_id: string
          cpu_monto_descontado: number
          cpu_negocio: string
          cpu_orden_referencia_id: string | null
          cpu_secuencial: number
          cpu_usuario_id: string | null
        }
        Insert: {
          cpu_actualizado_en?: string
          cpu_creado_en?: string
          cpu_cupon_id: string
          cpu_detalle_uso?: Json
          cpu_eliminado_en?: string | null
          cpu_id?: string
          cpu_monto_descontado: number
          cpu_negocio: string
          cpu_orden_referencia_id?: string | null
          cpu_secuencial?: never
          cpu_usuario_id?: string | null
        }
        Update: {
          cpu_actualizado_en?: string
          cpu_creado_en?: string
          cpu_cupon_id?: string
          cpu_detalle_uso?: Json
          cpu_eliminado_en?: string | null
          cpu_id?: string
          cpu_monto_descontado?: number
          cpu_negocio?: string
          cpu_orden_referencia_id?: string | null
          cpu_secuencial?: never
          cpu_usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_cupon_uso_cpu_cupon_id_fkey"
            columns: ["cpu_cupon_id"]
            isOneToOne: false
            referencedRelation: "com_cupon"
            referencedColumns: ["cup_id"]
          },
        ]
      }
      com_derecho_consumo: {
        Row: {
          der_actualizado_en: string
          der_concepto: string
          der_consumidos: number
          der_creado_en: string
          der_detalle_derecho: Json
          der_eliminado_en: string | null
          der_id: string
          der_incluidos: number | null
          der_negocio: string
          der_periodo: string
          der_secuencial: number
          der_suscripcion_id: string
        }
        Insert: {
          der_actualizado_en?: string
          der_concepto: string
          der_consumidos?: number
          der_creado_en?: string
          der_detalle_derecho?: Json
          der_eliminado_en?: string | null
          der_id?: string
          der_incluidos?: number | null
          der_negocio: string
          der_periodo: string
          der_secuencial?: never
          der_suscripcion_id: string
        }
        Update: {
          der_actualizado_en?: string
          der_concepto?: string
          der_consumidos?: number
          der_creado_en?: string
          der_detalle_derecho?: Json
          der_eliminado_en?: string | null
          der_id?: string
          der_incluidos?: number | null
          der_negocio?: string
          der_periodo?: string
          der_secuencial?: never
          der_suscripcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_derecho_consumo_der_suscripcion_id_fkey"
            columns: ["der_suscripcion_id"]
            isOneToOne: false
            referencedRelation: "com_suscripcion"
            referencedColumns: ["sub_id"]
          },
        ]
      }
      com_despacho_asignacion: {
        Row: {
          dsp_actualizado_en: string
          dsp_comprobante_entrega: Json
          dsp_conductor_nombre: string | null
          dsp_conductor_telefono: string | null
          dsp_costo_envio: number
          dsp_creado_en: string
          dsp_detalle_despacho: Json
          dsp_eliminado_en: string | null
          dsp_estado: string
          dsp_id: string
          dsp_modalidad: string
          dsp_negocio: string
          dsp_observaciones_coordinacion: string | null
          dsp_orden_id: string
          dsp_proveedor_id: string | null
          dsp_secuencial: number
          dsp_tracking_url: string | null
        }
        Insert: {
          dsp_actualizado_en?: string
          dsp_comprobante_entrega?: Json
          dsp_conductor_nombre?: string | null
          dsp_conductor_telefono?: string | null
          dsp_costo_envio?: number
          dsp_creado_en?: string
          dsp_detalle_despacho?: Json
          dsp_eliminado_en?: string | null
          dsp_estado?: string
          dsp_id?: string
          dsp_modalidad?: string
          dsp_negocio: string
          dsp_observaciones_coordinacion?: string | null
          dsp_orden_id: string
          dsp_proveedor_id?: string | null
          dsp_secuencial?: never
          dsp_tracking_url?: string | null
        }
        Update: {
          dsp_actualizado_en?: string
          dsp_comprobante_entrega?: Json
          dsp_conductor_nombre?: string | null
          dsp_conductor_telefono?: string | null
          dsp_costo_envio?: number
          dsp_creado_en?: string
          dsp_detalle_despacho?: Json
          dsp_eliminado_en?: string | null
          dsp_estado?: string
          dsp_id?: string
          dsp_modalidad?: string
          dsp_negocio?: string
          dsp_observaciones_coordinacion?: string | null
          dsp_orden_id?: string
          dsp_proveedor_id?: string | null
          dsp_secuencial?: never
          dsp_tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_despacho_asignacion_dsp_proveedor_id_fkey"
            columns: ["dsp_proveedor_id"]
            isOneToOne: false
            referencedRelation: "com_proveedor_servicio"
            referencedColumns: ["prv_id"]
          },
        ]
      }
      com_insumo: {
        Row: {
          ins_activo: boolean
          ins_actualizado_en: string
          ins_codigo: string
          ins_costo_unitario: number
          ins_creado_en: string
          ins_detalle_insumo: Json
          ins_eliminado_en: string | null
          ins_id: string
          ins_negocio: string
          ins_nombre: string
          ins_secuencial: number
          ins_unidad_medida: string
        }
        Insert: {
          ins_activo?: boolean
          ins_actualizado_en?: string
          ins_codigo: string
          ins_costo_unitario?: number
          ins_creado_en?: string
          ins_detalle_insumo?: Json
          ins_eliminado_en?: string | null
          ins_id?: string
          ins_negocio: string
          ins_nombre: string
          ins_secuencial?: never
          ins_unidad_medida: string
        }
        Update: {
          ins_activo?: boolean
          ins_actualizado_en?: string
          ins_codigo?: string
          ins_costo_unitario?: number
          ins_creado_en?: string
          ins_detalle_insumo?: Json
          ins_eliminado_en?: string | null
          ins_id?: string
          ins_negocio?: string
          ins_nombre?: string
          ins_secuencial?: never
          ins_unidad_medida?: string
        }
        Relationships: []
      }
      com_inventario: {
        Row: {
          inv_actualizado_en: string
          inv_creado_en: string
          inv_eliminado_en: string | null
          inv_id: string
          inv_insumo_id: string
          inv_local_codigo: string
          inv_negocio: string
          inv_secuencial: number
          inv_stock_actual: number
          inv_stock_minimo: number
          inv_stock_reservado: number
        }
        Insert: {
          inv_actualizado_en?: string
          inv_creado_en?: string
          inv_eliminado_en?: string | null
          inv_id?: string
          inv_insumo_id: string
          inv_local_codigo?: string
          inv_negocio: string
          inv_secuencial?: never
          inv_stock_actual?: number
          inv_stock_minimo?: number
          inv_stock_reservado?: number
        }
        Update: {
          inv_actualizado_en?: string
          inv_creado_en?: string
          inv_eliminado_en?: string | null
          inv_id?: string
          inv_insumo_id?: string
          inv_local_codigo?: string
          inv_negocio?: string
          inv_secuencial?: never
          inv_stock_actual?: number
          inv_stock_minimo?: number
          inv_stock_reservado?: number
        }
        Relationships: [
          {
            foreignKeyName: "com_inventario_inv_insumo_id_fkey"
            columns: ["inv_insumo_id"]
            isOneToOne: false
            referencedRelation: "com_insumo"
            referencedColumns: ["ins_id"]
          },
        ]
      }
      com_kardex: {
        Row: {
          kar_actualizado_en: string
          kar_cantidad: number
          kar_costo_unitario: number
          kar_creado_en: string
          kar_eliminado_en: string | null
          kar_id: string
          kar_insumo_id: string
          kar_local_codigo: string
          kar_negocio: string
          kar_observacion: string | null
          kar_referencia_id: string | null
          kar_registrado_por: string | null
          kar_secuencial: number
          kar_tipo_movimiento: string
        }
        Insert: {
          kar_actualizado_en?: string
          kar_cantidad: number
          kar_costo_unitario: number
          kar_creado_en?: string
          kar_eliminado_en?: string | null
          kar_id?: string
          kar_insumo_id: string
          kar_local_codigo?: string
          kar_negocio: string
          kar_observacion?: string | null
          kar_referencia_id?: string | null
          kar_registrado_por?: string | null
          kar_secuencial?: never
          kar_tipo_movimiento: string
        }
        Update: {
          kar_actualizado_en?: string
          kar_cantidad?: number
          kar_costo_unitario?: number
          kar_creado_en?: string
          kar_eliminado_en?: string | null
          kar_id?: string
          kar_insumo_id?: string
          kar_local_codigo?: string
          kar_negocio?: string
          kar_observacion?: string | null
          kar_referencia_id?: string | null
          kar_registrado_por?: string | null
          kar_secuencial?: never
          kar_tipo_movimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_kardex_kar_insumo_id_fkey"
            columns: ["kar_insumo_id"]
            isOneToOne: false
            referencedRelation: "com_insumo"
            referencedColumns: ["ins_id"]
          },
        ]
      }
      com_media: {
        Row: {
          med_actualizado_en: string
          med_creado_en: string
          med_detalle_media: Json
          med_eliminado_en: string | null
          med_es_portada: boolean
          med_id: string
          med_negocio: string
          med_orden: number
          med_origen: string
          med_producto_id: string | null
          med_secuencial: number
          med_url: string
          med_variante_id: string | null
        }
        Insert: {
          med_actualizado_en?: string
          med_creado_en?: string
          med_detalle_media?: Json
          med_eliminado_en?: string | null
          med_es_portada?: boolean
          med_id?: string
          med_negocio: string
          med_orden?: number
          med_origen?: string
          med_producto_id?: string | null
          med_secuencial?: never
          med_url: string
          med_variante_id?: string | null
        }
        Update: {
          med_actualizado_en?: string
          med_creado_en?: string
          med_detalle_media?: Json
          med_eliminado_en?: string | null
          med_es_portada?: boolean
          med_id?: string
          med_negocio?: string
          med_orden?: number
          med_origen?: string
          med_producto_id?: string | null
          med_secuencial?: never
          med_url?: string
          med_variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_media_med_producto_id_fkey"
            columns: ["med_producto_id"]
            isOneToOne: false
            referencedRelation: "com_producto"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "com_media_med_variante_id_fkey"
            columns: ["med_variante_id"]
            isOneToOne: false
            referencedRelation: "com_variante"
            referencedColumns: ["var_id"]
          },
        ]
      }
      com_merma: {
        Row: {
          mrm_actualizado_en: string
          mrm_cantidad: number
          mrm_creado_en: string
          mrm_eliminado_en: string | null
          mrm_id: string
          mrm_insumo_id: string
          mrm_motivo: string
          mrm_negocio: string
          mrm_observacion: string | null
          mrm_reportado_por: string | null
          mrm_secuencial: number
        }
        Insert: {
          mrm_actualizado_en?: string
          mrm_cantidad: number
          mrm_creado_en?: string
          mrm_eliminado_en?: string | null
          mrm_id?: string
          mrm_insumo_id: string
          mrm_motivo: string
          mrm_negocio: string
          mrm_observacion?: string | null
          mrm_reportado_por?: string | null
          mrm_secuencial?: never
        }
        Update: {
          mrm_actualizado_en?: string
          mrm_cantidad?: number
          mrm_creado_en?: string
          mrm_eliminado_en?: string | null
          mrm_id?: string
          mrm_insumo_id?: string
          mrm_motivo?: string
          mrm_negocio?: string
          mrm_observacion?: string | null
          mrm_reportado_por?: string | null
          mrm_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "com_merma_mrm_insumo_id_fkey"
            columns: ["mrm_insumo_id"]
            isOneToOne: false
            referencedRelation: "com_insumo"
            referencedColumns: ["ins_id"]
          },
        ]
      }
      com_pasarela_configuracion: {
        Row: {
          psc_activo: boolean
          psc_actualizado_en: string
          psc_ambiente: string
          psc_comision_fija: number
          psc_comision_porcentaje: number
          psc_creado_en: string
          psc_credenciales_privadas: Json
          psc_credenciales_publicas: Json
          psc_detalle_pasarela: Json
          psc_eliminado_en: string | null
          psc_id: string
          psc_negocio: string
          psc_nombre_visible: string
          psc_orden_visual: number
          psc_pasarela: string
          psc_secuencial: number
        }
        Insert: {
          psc_activo?: boolean
          psc_actualizado_en?: string
          psc_ambiente?: string
          psc_comision_fija?: number
          psc_comision_porcentaje?: number
          psc_creado_en?: string
          psc_credenciales_privadas?: Json
          psc_credenciales_publicas?: Json
          psc_detalle_pasarela?: Json
          psc_eliminado_en?: string | null
          psc_id?: string
          psc_negocio: string
          psc_nombre_visible: string
          psc_orden_visual?: number
          psc_pasarela: string
          psc_secuencial?: never
        }
        Update: {
          psc_activo?: boolean
          psc_actualizado_en?: string
          psc_ambiente?: string
          psc_comision_fija?: number
          psc_comision_porcentaje?: number
          psc_creado_en?: string
          psc_credenciales_privadas?: Json
          psc_credenciales_publicas?: Json
          psc_detalle_pasarela?: Json
          psc_eliminado_en?: string | null
          psc_id?: string
          psc_negocio?: string
          psc_nombre_visible?: string
          psc_orden_visual?: number
          psc_pasarela?: string
          psc_secuencial?: never
        }
        Relationships: []
      }
      com_personalizacion_campo: {
        Row: {
          pzc_actualizado_en: string
          pzc_creado_en: string
          pzc_detalle_campo: Json
          pzc_eliminado_en: string | null
          pzc_es_obligatorio: boolean
          pzc_etiqueta: string
          pzc_id: string
          pzc_negocio: string
          pzc_opciones: Json
          pzc_orden: number
          pzc_producto_id: string | null
          pzc_secuencial: number
          pzc_tipo_campo: string
          pzc_variante_id: string | null
        }
        Insert: {
          pzc_actualizado_en?: string
          pzc_creado_en?: string
          pzc_detalle_campo?: Json
          pzc_eliminado_en?: string | null
          pzc_es_obligatorio?: boolean
          pzc_etiqueta: string
          pzc_id?: string
          pzc_negocio: string
          pzc_opciones?: Json
          pzc_orden?: number
          pzc_producto_id?: string | null
          pzc_secuencial?: never
          pzc_tipo_campo?: string
          pzc_variante_id?: string | null
        }
        Update: {
          pzc_actualizado_en?: string
          pzc_creado_en?: string
          pzc_detalle_campo?: Json
          pzc_eliminado_en?: string | null
          pzc_es_obligatorio?: boolean
          pzc_etiqueta?: string
          pzc_id?: string
          pzc_negocio?: string
          pzc_opciones?: Json
          pzc_orden?: number
          pzc_producto_id?: string | null
          pzc_secuencial?: never
          pzc_tipo_campo?: string
          pzc_variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_personalizacion_campo_pzc_producto_id_fkey"
            columns: ["pzc_producto_id"]
            isOneToOne: false
            referencedRelation: "com_producto"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "com_personalizacion_campo_pzc_variante_id_fkey"
            columns: ["pzc_variante_id"]
            isOneToOne: false
            referencedRelation: "com_variante"
            referencedColumns: ["var_id"]
          },
        ]
      }
      com_producto: {
        Row: {
          pro_activo: boolean
          pro_actualizado_en: string
          pro_categoria_principal_id: string | null
          pro_creado_en: string
          pro_descripcion: string | null
          pro_destacado: boolean
          pro_detalle_producto: Json
          pro_eliminado_en: string | null
          pro_id: string
          pro_negocio: string
          pro_nombre: string
          pro_secuencial: number
          pro_slug: string
          pro_tipo: string
        }
        Insert: {
          pro_activo?: boolean
          pro_actualizado_en?: string
          pro_categoria_principal_id?: string | null
          pro_creado_en?: string
          pro_descripcion?: string | null
          pro_destacado?: boolean
          pro_detalle_producto?: Json
          pro_eliminado_en?: string | null
          pro_id?: string
          pro_negocio: string
          pro_nombre: string
          pro_secuencial?: never
          pro_slug: string
          pro_tipo?: string
        }
        Update: {
          pro_activo?: boolean
          pro_actualizado_en?: string
          pro_categoria_principal_id?: string | null
          pro_creado_en?: string
          pro_descripcion?: string | null
          pro_destacado?: boolean
          pro_detalle_producto?: Json
          pro_eliminado_en?: string | null
          pro_id?: string
          pro_negocio?: string
          pro_nombre?: string
          pro_secuencial?: never
          pro_slug?: string
          pro_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_producto_pro_categoria_principal_id_fkey"
            columns: ["pro_categoria_principal_id"]
            isOneToOne: false
            referencedRelation: "com_categoria"
            referencedColumns: ["ctg_id"]
          },
        ]
      }
      com_producto_categoria: {
        Row: {
          pct_actualizado_en: string
          pct_categoria_id: string
          pct_creado_en: string
          pct_detalle_asociacion: Json
          pct_eliminado_en: string | null
          pct_es_principal: boolean
          pct_id: string
          pct_negocio: string
          pct_orden: number
          pct_producto_id: string
          pct_secuencial: number
        }
        Insert: {
          pct_actualizado_en?: string
          pct_categoria_id: string
          pct_creado_en?: string
          pct_detalle_asociacion?: Json
          pct_eliminado_en?: string | null
          pct_es_principal?: boolean
          pct_id?: string
          pct_negocio: string
          pct_orden?: number
          pct_producto_id: string
          pct_secuencial?: never
        }
        Update: {
          pct_actualizado_en?: string
          pct_categoria_id?: string
          pct_creado_en?: string
          pct_detalle_asociacion?: Json
          pct_eliminado_en?: string | null
          pct_es_principal?: boolean
          pct_id?: string
          pct_negocio?: string
          pct_orden?: number
          pct_producto_id?: string
          pct_secuencial?: never
        }
        Relationships: [
          {
            foreignKeyName: "com_producto_categoria_pct_categoria_id_fkey"
            columns: ["pct_categoria_id"]
            isOneToOne: false
            referencedRelation: "com_categoria"
            referencedColumns: ["ctg_id"]
          },
          {
            foreignKeyName: "com_producto_categoria_pct_producto_id_fkey"
            columns: ["pct_producto_id"]
            isOneToOne: false
            referencedRelation: "com_producto"
            referencedColumns: ["pro_id"]
          },
        ]
      }
      com_producto_relacionado: {
        Row: {
          prl_actualizado_en: string
          prl_creado_en: string
          prl_eliminado_en: string | null
          prl_id: string
          prl_negocio: string
          prl_orden: number
          prl_producto_destino_id: string
          prl_producto_origen_id: string
          prl_secuencial: number
          prl_tipo_relacion: string
        }
        Insert: {
          prl_actualizado_en?: string
          prl_creado_en?: string
          prl_eliminado_en?: string | null
          prl_id?: string
          prl_negocio: string
          prl_orden?: number
          prl_producto_destino_id: string
          prl_producto_origen_id: string
          prl_secuencial?: never
          prl_tipo_relacion?: string
        }
        Update: {
          prl_actualizado_en?: string
          prl_creado_en?: string
          prl_eliminado_en?: string | null
          prl_id?: string
          prl_negocio?: string
          prl_orden?: number
          prl_producto_destino_id?: string
          prl_producto_origen_id?: string
          prl_secuencial?: never
          prl_tipo_relacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_producto_relacionado_prl_producto_destino_id_fkey"
            columns: ["prl_producto_destino_id"]
            isOneToOne: false
            referencedRelation: "com_producto"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "com_producto_relacionado_prl_producto_origen_id_fkey"
            columns: ["prl_producto_origen_id"]
            isOneToOne: false
            referencedRelation: "com_producto"
            referencedColumns: ["pro_id"]
          },
        ]
      }
      com_proforma: {
        Row: {
          prf_actualizado_en: string
          prf_cliente_contacto: Json
          prf_cliente_id: string | null
          prf_cliente_nombre: string
          prf_creado_en: string
          prf_descuento: number
          prf_detalle_proforma: Json
          prf_eliminado_en: string | null
          prf_estado: string
          prf_id: string
          prf_iva: number
          prf_negocio: string
          prf_observaciones: string | null
          prf_secuencial: number
          prf_subtotal: number
          prf_token_aprobacion: string | null
          prf_total: number
          prf_vigencia_dias: number
        }
        Insert: {
          prf_actualizado_en?: string
          prf_cliente_contacto?: Json
          prf_cliente_id?: string | null
          prf_cliente_nombre: string
          prf_creado_en?: string
          prf_descuento?: number
          prf_detalle_proforma?: Json
          prf_eliminado_en?: string | null
          prf_estado?: string
          prf_id?: string
          prf_iva?: number
          prf_negocio: string
          prf_observaciones?: string | null
          prf_secuencial?: never
          prf_subtotal?: number
          prf_token_aprobacion?: string | null
          prf_total?: number
          prf_vigencia_dias?: number
        }
        Update: {
          prf_actualizado_en?: string
          prf_cliente_contacto?: Json
          prf_cliente_id?: string | null
          prf_cliente_nombre?: string
          prf_creado_en?: string
          prf_descuento?: number
          prf_detalle_proforma?: Json
          prf_eliminado_en?: string | null
          prf_estado?: string
          prf_id?: string
          prf_iva?: number
          prf_negocio?: string
          prf_observaciones?: string | null
          prf_secuencial?: never
          prf_subtotal?: number
          prf_token_aprobacion?: string | null
          prf_total?: number
          prf_vigencia_dias?: number
        }
        Relationships: []
      }
      com_proforma_item: {
        Row: {
          pfi_actualizado_en: string
          pfi_cantidad: number
          pfi_creado_en: string
          pfi_descripcion: string
          pfi_descuento: number
          pfi_detalle_item: Json
          pfi_eliminado_en: string | null
          pfi_es_item_libre: boolean
          pfi_id: string
          pfi_impuesto: string
          pfi_negocio: string
          pfi_precio_unitario: number
          pfi_proforma_id: string
          pfi_secuencial: number
          pfi_total_linea: number
          pfi_variante_id: string | null
        }
        Insert: {
          pfi_actualizado_en?: string
          pfi_cantidad?: number
          pfi_creado_en?: string
          pfi_descripcion: string
          pfi_descuento?: number
          pfi_detalle_item?: Json
          pfi_eliminado_en?: string | null
          pfi_es_item_libre?: boolean
          pfi_id?: string
          pfi_impuesto?: string
          pfi_negocio: string
          pfi_precio_unitario: number
          pfi_proforma_id: string
          pfi_secuencial?: never
          pfi_total_linea: number
          pfi_variante_id?: string | null
        }
        Update: {
          pfi_actualizado_en?: string
          pfi_cantidad?: number
          pfi_creado_en?: string
          pfi_descripcion?: string
          pfi_descuento?: number
          pfi_detalle_item?: Json
          pfi_eliminado_en?: string | null
          pfi_es_item_libre?: boolean
          pfi_id?: string
          pfi_impuesto?: string
          pfi_negocio?: string
          pfi_precio_unitario?: number
          pfi_proforma_id?: string
          pfi_secuencial?: never
          pfi_total_linea?: number
          pfi_variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "com_proforma_item_pfi_proforma_id_fkey"
            columns: ["pfi_proforma_id"]
            isOneToOne: false
            referencedRelation: "com_proforma"
            referencedColumns: ["prf_id"]
          },
          {
            foreignKeyName: "com_proforma_item_pfi_variante_id_fkey"
            columns: ["pfi_variante_id"]
            isOneToOne: false
            referencedRelation: "com_variante"
            referencedColumns: ["var_id"]
          },
        ]
      }
      com_proveedor_servicio: {
        Row: {
          prv_activo: boolean
          prv_actualizado_en: string
          prv_contacto_nombre: string | null
          prv_creado_en: string
          prv_detalle_proveedor: Json
          prv_eliminado_en: string | null
          prv_email: string | null
          prv_id: string
          prv_negocio: string
          prv_nombre_comercial: string
          prv_placa: string | null
          prv_secuencial: number
          prv_tarifario_referencial: Json
          prv_telefono: string | null
          prv_tipo: string
          prv_vehiculo_tipo: string | null
        }
        Insert: {
          prv_activo?: boolean
          prv_actualizado_en?: string
          prv_contacto_nombre?: string | null
          prv_creado_en?: string
          prv_detalle_proveedor?: Json
          prv_eliminado_en?: string | null
          prv_email?: string | null
          prv_id?: string
          prv_negocio: string
          prv_nombre_comercial: string
          prv_placa?: string | null
          prv_secuencial?: never
          prv_tarifario_referencial?: Json
          prv_telefono?: string | null
          prv_tipo: string
          prv_vehiculo_tipo?: string | null
        }
        Update: {
          prv_activo?: boolean
          prv_actualizado_en?: string
          prv_contacto_nombre?: string | null
          prv_creado_en?: string
          prv_detalle_proveedor?: Json
          prv_eliminado_en?: string | null
          prv_email?: string | null
          prv_id?: string
          prv_negocio?: string
          prv_nombre_comercial?: string
          prv_placa?: string | null
          prv_secuencial?: never
          prv_tarifario_referencial?: Json
          prv_telefono?: string | null
          prv_tipo?: string
          prv_vehiculo_tipo?: string | null
        }
        Relationships: []
      }
      com_receta: {
        Row: {
          rec_actualizado_en: string
          rec_cantidad: number
          rec_creado_en: string
          rec_detalle_receta: Json
          rec_eliminado_en: string | null
          rec_es_opcional: boolean
          rec_id: string
          rec_insumo_id: string
          rec_negocio: string
          rec_secuencial: number
          rec_variante_id: string
        }
        Insert: {
          rec_actualizado_en?: string
          rec_cantidad: number
          rec_creado_en?: string
          rec_detalle_receta?: Json
          rec_eliminado_en?: string | null
          rec_es_opcional?: boolean
          rec_id?: string
          rec_insumo_id: string
          rec_negocio: string
          rec_secuencial?: never
          rec_variante_id: string
        }
        Update: {
          rec_actualizado_en?: string
          rec_cantidad?: number
          rec_creado_en?: string
          rec_detalle_receta?: Json
          rec_eliminado_en?: string | null
          rec_es_opcional?: boolean
          rec_id?: string
          rec_insumo_id?: string
          rec_negocio?: string
          rec_secuencial?: never
          rec_variante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_receta_rec_insumo_id_fkey"
            columns: ["rec_insumo_id"]
            isOneToOne: false
            referencedRelation: "com_insumo"
            referencedColumns: ["ins_id"]
          },
          {
            foreignKeyName: "com_receta_rec_variante_id_fkey"
            columns: ["rec_variante_id"]
            isOneToOne: false
            referencedRelation: "com_variante"
            referencedColumns: ["var_id"]
          },
        ]
      }
      com_suscripcion: {
        Row: {
          sub_actualizado_en: string
          sub_cliente_id: string | null
          sub_creado_en: string
          sub_detalle_suscripcion: Json
          sub_eliminado_en: string | null
          sub_estado: string
          sub_frecuencia: string
          sub_id: string
          sub_metodo_pago_token: string | null
          sub_monto_periodo: number
          sub_negocio: string
          sub_proximo_cobro_en: string
          sub_secuencial: number
          sub_ultimo_cobro_en: string | null
          sub_variante_id: string
        }
        Insert: {
          sub_actualizado_en?: string
          sub_cliente_id?: string | null
          sub_creado_en?: string
          sub_detalle_suscripcion?: Json
          sub_eliminado_en?: string | null
          sub_estado?: string
          sub_frecuencia: string
          sub_id?: string
          sub_metodo_pago_token?: string | null
          sub_monto_periodo: number
          sub_negocio: string
          sub_proximo_cobro_en: string
          sub_secuencial?: never
          sub_ultimo_cobro_en?: string | null
          sub_variante_id: string
        }
        Update: {
          sub_actualizado_en?: string
          sub_cliente_id?: string | null
          sub_creado_en?: string
          sub_detalle_suscripcion?: Json
          sub_eliminado_en?: string | null
          sub_estado?: string
          sub_frecuencia?: string
          sub_id?: string
          sub_metodo_pago_token?: string | null
          sub_monto_periodo?: number
          sub_negocio?: string
          sub_proximo_cobro_en?: string
          sub_secuencial?: never
          sub_ultimo_cobro_en?: string | null
          sub_variante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_suscripcion_sub_variante_id_fkey"
            columns: ["sub_variante_id"]
            isOneToOne: false
            referencedRelation: "com_variante"
            referencedColumns: ["var_id"]
          },
        ]
      }
      com_transaccion_pago: {
        Row: {
          pag_actualizado_en: string
          pag_autorizacion_codigo: string | null
          pag_cliente_id: string | null
          pag_confirmado_en: string | null
          pag_creado_en: string
          pag_detalle_transaccion: Json
          pag_eliminado_en: string | null
          pag_es_diferido: boolean
          pag_estado: string
          pag_id: string
          pag_identificador_cliente: string
          pag_meses_diferido: number | null
          pag_moneda: string
          pag_monto_con_iva: number
          pag_monto_iva: number
          pag_monto_sin_iva: number
          pag_monto_total: number
          pag_negocio: string
          pag_pasarela: string
          pag_referencia_id: string | null
          pag_secuencial: number
          pag_tarjeta_marca: string | null
          pag_tarjeta_tipo: string | null
          pag_tarjeta_ultimos_digitos: string | null
          pag_titular_email: string | null
          pag_titular_identificacion: string | null
          pag_titular_telefono: string | null
          pag_transaccion_pasarela_id: string | null
        }
        Insert: {
          pag_actualizado_en?: string
          pag_autorizacion_codigo?: string | null
          pag_cliente_id?: string | null
          pag_confirmado_en?: string | null
          pag_creado_en?: string
          pag_detalle_transaccion?: Json
          pag_eliminado_en?: string | null
          pag_es_diferido?: boolean
          pag_estado?: string
          pag_id?: string
          pag_identificador_cliente: string
          pag_meses_diferido?: number | null
          pag_moneda?: string
          pag_monto_con_iva?: number
          pag_monto_iva?: number
          pag_monto_sin_iva?: number
          pag_monto_total: number
          pag_negocio: string
          pag_pasarela: string
          pag_referencia_id?: string | null
          pag_secuencial?: never
          pag_tarjeta_marca?: string | null
          pag_tarjeta_tipo?: string | null
          pag_tarjeta_ultimos_digitos?: string | null
          pag_titular_email?: string | null
          pag_titular_identificacion?: string | null
          pag_titular_telefono?: string | null
          pag_transaccion_pasarela_id?: string | null
        }
        Update: {
          pag_actualizado_en?: string
          pag_autorizacion_codigo?: string | null
          pag_cliente_id?: string | null
          pag_confirmado_en?: string | null
          pag_creado_en?: string
          pag_detalle_transaccion?: Json
          pag_eliminado_en?: string | null
          pag_es_diferido?: boolean
          pag_estado?: string
          pag_id?: string
          pag_identificador_cliente?: string
          pag_meses_diferido?: number | null
          pag_moneda?: string
          pag_monto_con_iva?: number
          pag_monto_iva?: number
          pag_monto_sin_iva?: number
          pag_monto_total?: number
          pag_negocio?: string
          pag_pasarela?: string
          pag_referencia_id?: string | null
          pag_secuencial?: never
          pag_tarjeta_marca?: string | null
          pag_tarjeta_tipo?: string | null
          pag_tarjeta_ultimos_digitos?: string | null
          pag_titular_email?: string | null
          pag_titular_identificacion?: string | null
          pag_titular_telefono?: string | null
          pag_transaccion_pasarela_id?: string | null
        }
        Relationships: []
      }
      com_variante: {
        Row: {
          var_activo: boolean
          var_actualizado_en: string
          var_codigo_impuesto_sri: string
          var_creado_en: string
          var_detalle_variante: Json
          var_eliminado_en: string | null
          var_frecuencia_recurrencia: string | null
          var_id: string
          var_negocio: string
          var_nombre: string
          var_precio: number
          var_precio_comparacion: number | null
          var_producto_id: string
          var_secuencial: number
          var_sku: string
          var_tarifa_iva_porcentaje: number
          var_tipo_oferta: string
        }
        Insert: {
          var_activo?: boolean
          var_actualizado_en?: string
          var_codigo_impuesto_sri?: string
          var_creado_en?: string
          var_detalle_variante?: Json
          var_eliminado_en?: string | null
          var_frecuencia_recurrencia?: string | null
          var_id?: string
          var_negocio: string
          var_nombre: string
          var_precio: number
          var_precio_comparacion?: number | null
          var_producto_id: string
          var_secuencial?: never
          var_sku: string
          var_tarifa_iva_porcentaje?: number
          var_tipo_oferta?: string
        }
        Update: {
          var_activo?: boolean
          var_actualizado_en?: string
          var_codigo_impuesto_sri?: string
          var_creado_en?: string
          var_detalle_variante?: Json
          var_eliminado_en?: string | null
          var_frecuencia_recurrencia?: string | null
          var_id?: string
          var_negocio?: string
          var_nombre?: string
          var_precio?: number
          var_precio_comparacion?: number | null
          var_producto_id?: string
          var_secuencial?: never
          var_sku?: string
          var_tarifa_iva_porcentaje?: number
          var_tipo_oferta?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_variante_var_producto_id_fkey"
            columns: ["var_producto_id"]
            isOneToOne: false
            referencedRelation: "com_producto"
            referencedColumns: ["pro_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      com_fn_cobertura_usuario: {
        Args: { p_negocio: string; p_periodo?: string }
        Returns: {
          concepto: string
          consumidos: number
          incluidos: number
          plan_nombre: string
          restantes: number
          suscripcion_id: string
        }[]
      }
      com_fn_consumir_derecho: {
        Args: {
          p_concepto: string
          p_periodo?: string
          p_suscripcion_id: string
        }
        Returns: string
      }
      com_fn_devolver_derecho: {
        Args: { p_derecho_id: string }
        Returns: boolean
      }
      com_fn_obtener_pasarelas_activas: {
        Args: { p_negocio: string }
        Returns: {
          ambiente: string
          comision_porcentaje: number
          credenciales_publicas: Json
          nombre_visible: string
          orden_visual: number
          pasarela: string
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
  comun_notificacion: {
    Tables: {
      not_campana: {
        Row: {
          cmp_asunto: string
          cmp_canales_jsonb: Json
          cmp_creado_en: string
          cmp_cuerpo_html: string
          cmp_cuerpo_markdown: string | null
          cmp_detalles: Json | null
          cmp_emisor_id: string
          cmp_estado: string
          cmp_id: string
          cmp_metricas_jsonb: Json | null
          cmp_negocio: string
          cmp_roles_jsonb: Json | null
          cmp_secuencial: number
          cmp_tipo_audiencia: string
          cmp_usuarios_jsonb: Json | null
        }
        Insert: {
          cmp_asunto: string
          cmp_canales_jsonb?: Json
          cmp_creado_en?: string
          cmp_cuerpo_html: string
          cmp_cuerpo_markdown?: string | null
          cmp_detalles?: Json | null
          cmp_emisor_id: string
          cmp_estado?: string
          cmp_id?: string
          cmp_metricas_jsonb?: Json | null
          cmp_negocio: string
          cmp_roles_jsonb?: Json | null
          cmp_secuencial?: never
          cmp_tipo_audiencia: string
          cmp_usuarios_jsonb?: Json | null
        }
        Update: {
          cmp_asunto?: string
          cmp_canales_jsonb?: Json
          cmp_creado_en?: string
          cmp_cuerpo_html?: string
          cmp_cuerpo_markdown?: string | null
          cmp_detalles?: Json | null
          cmp_emisor_id?: string
          cmp_estado?: string
          cmp_id?: string
          cmp_metricas_jsonb?: Json | null
          cmp_negocio?: string
          cmp_roles_jsonb?: Json | null
          cmp_secuencial?: never
          cmp_tipo_audiencia?: string
          cmp_usuarios_jsonb?: Json | null
        }
        Relationships: []
      }
      not_registro: {
        Row: {
          not_campana_id: string | null
          not_canal: string
          not_contenido_html: string
          not_creado_en: string
          not_detalles: Json | null
          not_id: string
          not_leido_en: string | null
          not_negocio: string
          not_secuencial: number
          not_titulo: string
          not_url_accion: string | null
          not_usuario_id: string
        }
        Insert: {
          not_campana_id?: string | null
          not_canal: string
          not_contenido_html: string
          not_creado_en?: string
          not_detalles?: Json | null
          not_id?: string
          not_leido_en?: string | null
          not_negocio: string
          not_secuencial?: never
          not_titulo: string
          not_url_accion?: string | null
          not_usuario_id: string
        }
        Update: {
          not_campana_id?: string | null
          not_canal?: string
          not_contenido_html?: string
          not_creado_en?: string
          not_detalles?: Json | null
          not_id?: string
          not_leido_en?: string | null
          not_negocio?: string
          not_secuencial?: never
          not_titulo?: string
          not_url_accion?: string | null
          not_usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "not_registro_not_campana_id_fkey"
            columns: ["not_campana_id"]
            isOneToOne: false
            referencedRelation: "not_campana"
            referencedColumns: ["cmp_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      not_fn_contar_no_leidas: { Args: { p_negocio: string }; Returns: number }
      not_fn_emitir_campana: {
        Args: {
          p_asunto: string
          p_canales_jsonb: Json
          p_cuerpo_html: string
          p_cuerpo_markdown?: string
          p_negocio: string
          p_roles_jsonb: Json
          p_tipo_audiencia: string
          p_usuarios_jsonb: Json
        }
        Returns: string
      }
      not_fn_marcar_leida: { Args: { p_not_id: string }; Returns: undefined }
      not_fn_marcar_todas_leidas: {
        Args: { p_negocio: string }
        Returns: undefined
      }
      not_fn_notificar_staff: {
        Args: {
          p_contenido_html: string
          p_excluir_usuario_id?: string
          p_negocio: string
          p_titulo: string
          p_url_accion?: string
        }
        Returns: number
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
  comun_reclutamiento: {
    Tables: {
      rec_postulacion: {
        Row: {
          pos_actualizado_en: string
          pos_consentimiento_lopdp: boolean
          pos_creado_en: string
          pos_cv_url: string
          pos_detalles: Json
          pos_documentos_urls: Json
          pos_estado: string
          pos_id: string
          pos_negocio: string
          pos_secuencial: number
          pos_usuario_id: string
          pos_vacante_id: string | null
        }
        Insert: {
          pos_actualizado_en?: string
          pos_consentimiento_lopdp?: boolean
          pos_creado_en?: string
          pos_cv_url: string
          pos_detalles?: Json
          pos_documentos_urls?: Json
          pos_estado?: string
          pos_id?: string
          pos_negocio: string
          pos_secuencial?: never
          pos_usuario_id: string
          pos_vacante_id?: string | null
        }
        Update: {
          pos_actualizado_en?: string
          pos_consentimiento_lopdp?: boolean
          pos_creado_en?: string
          pos_cv_url?: string
          pos_detalles?: Json
          pos_documentos_urls?: Json
          pos_estado?: string
          pos_id?: string
          pos_negocio?: string
          pos_secuencial?: never
          pos_usuario_id?: string
          pos_vacante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_postulacion_pos_vacante_id_fkey"
            columns: ["pos_vacante_id"]
            isOneToOne: false
            referencedRelation: "rec_vacante"
            referencedColumns: ["vac_id"]
          },
        ]
      }
      rec_vacante: {
        Row: {
          vac_actualizado_en: string
          vac_creado_en: string
          vac_detalles: Json
          vac_estado: string
          vac_id: string
          vac_negocio: string
          vac_notificar_email: boolean
          vac_notificar_push: boolean
          vac_secuencial: number
          vac_tipo_contrato: string
          vac_titulo: string
        }
        Insert: {
          vac_actualizado_en?: string
          vac_creado_en?: string
          vac_detalles?: Json
          vac_estado?: string
          vac_id?: string
          vac_negocio: string
          vac_notificar_email?: boolean
          vac_notificar_push?: boolean
          vac_secuencial?: never
          vac_tipo_contrato?: string
          vac_titulo: string
        }
        Update: {
          vac_actualizado_en?: string
          vac_creado_en?: string
          vac_detalles?: Json
          vac_estado?: string
          vac_id?: string
          vac_negocio?: string
          vac_notificar_email?: boolean
          vac_notificar_push?: boolean
          vac_secuencial?: never
          vac_tipo_contrato?: string
          vac_titulo?: string
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
      seg_dispositivo_push: {
        Row: {
          dsp_activo: boolean
          dsp_actualizado_en: string
          dsp_creado_en: string
          dsp_detalles: Json | null
          dsp_id: string
          dsp_plataforma: string
          dsp_secuencial: number
          dsp_token_push: string
          dsp_usuario_id: string
        }
        Insert: {
          dsp_activo?: boolean
          dsp_actualizado_en?: string
          dsp_creado_en?: string
          dsp_detalles?: Json | null
          dsp_id?: string
          dsp_plataforma: string
          dsp_secuencial?: never
          dsp_token_push: string
          dsp_usuario_id: string
        }
        Update: {
          dsp_activo?: boolean
          dsp_actualizado_en?: string
          dsp_creado_en?: string
          dsp_detalles?: Json | null
          dsp_id?: string
          dsp_plataforma?: string
          dsp_secuencial?: never
          dsp_token_push?: string
          dsp_usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seg_dispositivo_push_dsp_usuario_id_fkey"
            columns: ["dsp_usuario_id"]
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
      seg_preferencia_notificacion: {
        Row: {
          pfn_actualizado_en: string
          pfn_canal_email: boolean
          pfn_canal_in_app: boolean
          pfn_canal_push: boolean
          pfn_creado_en: string
          pfn_detalles: Json | null
          pfn_id: string
          pfn_negocio: string
          pfn_secuencial: number
          pfn_silenciado_hasta: string | null
          pfn_usuario_id: string
        }
        Insert: {
          pfn_actualizado_en?: string
          pfn_canal_email?: boolean
          pfn_canal_in_app?: boolean
          pfn_canal_push?: boolean
          pfn_creado_en?: string
          pfn_detalles?: Json | null
          pfn_id?: string
          pfn_negocio: string
          pfn_secuencial?: never
          pfn_silenciado_hasta?: string | null
          pfn_usuario_id: string
        }
        Update: {
          pfn_actualizado_en?: string
          pfn_canal_email?: boolean
          pfn_canal_in_app?: boolean
          pfn_canal_push?: boolean
          pfn_creado_en?: string
          pfn_detalles?: Json | null
          pfn_id?: string
          pfn_negocio?: string
          pfn_secuencial?: never
          pfn_silenciado_hasta?: string | null
          pfn_usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seg_preferencia_notificacion_pfn_usuario_id_fkey"
            columns: ["pfn_usuario_id"]
            isOneToOne: false
            referencedRelation: "seg_usuario"
            referencedColumns: ["usu_id"]
          },
        ]
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
      seg_fn_es_miembro_negocio: {
        Args: { p_negocio: string; p_usuario: string }
        Returns: boolean
      }
      seg_fn_es_operador_o_admin_negocio: {
        Args: { p_negocio: string }
        Returns: boolean
      }
      seg_fn_es_superadmin: { Args: never; Returns: boolean }
      seg_fn_generar_otp_registro: { Args: never; Returns: string }
      seg_fn_listar_usuarios_directorio: {
        Args: never
        Returns: {
          usu_apellidos: string
          usu_correo: string
          usu_creado_en: string
          usu_id: string
          usu_nombres: string
          usu_superadmin_plataforma: boolean
          usu_whatsapp: string
        }[]
      }
      seg_fn_nivel_maximo: { Args: { p_negocio: string }; Returns: number }
      seg_fn_obtener_staff_negocio: {
        Args: { p_negocio?: string }
        Returns: {
          perfiles: string[]
          usu_correo: string
          usu_id: string
        }[]
      }
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
      seg_fn_superadmin_reactivar_usuario: {
        Args: { p_target_usuario_id: string }
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
  public: {
    Tables: {
      [_ in never]: never
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
      trq_abogado_materia: {
        Row: {
          amt_abogado_id: string
          amt_actualizado_en: string
          amt_creado_en: string
          amt_eliminado_en: string | null
          amt_id: string
          amt_materia_id: string
        }
        Insert: {
          amt_abogado_id: string
          amt_actualizado_en?: string
          amt_creado_en?: string
          amt_eliminado_en?: string | null
          amt_id?: string
          amt_materia_id: string
        }
        Update: {
          amt_abogado_id?: string
          amt_actualizado_en?: string
          amt_creado_en?: string
          amt_eliminado_en?: string | null
          amt_id?: string
          amt_materia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_abogado_materia_amt_abogado_id_fkey"
            columns: ["amt_abogado_id"]
            isOneToOne: false
            referencedRelation: "trq_abogado"
            referencedColumns: ["abg_id"]
          },
          {
            foreignKeyName: "trq_abogado_materia_amt_materia_id_fkey"
            columns: ["amt_materia_id"]
            isOneToOne: false
            referencedRelation: "trq_materia"
            referencedColumns: ["mat_id"]
          },
        ]
      }
      trq_abogado_provincia: {
        Row: {
          apr_abogado_id: string
          apr_actualizado_en: string
          apr_creado_en: string
          apr_eliminado_en: string | null
          apr_id: string
          apr_provincia_id: string
        }
        Insert: {
          apr_abogado_id: string
          apr_actualizado_en?: string
          apr_creado_en?: string
          apr_eliminado_en?: string | null
          apr_id?: string
          apr_provincia_id: string
        }
        Update: {
          apr_abogado_id?: string
          apr_actualizado_en?: string
          apr_creado_en?: string
          apr_eliminado_en?: string | null
          apr_id?: string
          apr_provincia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_abogado_provincia_apr_abogado_id_fkey"
            columns: ["apr_abogado_id"]
            isOneToOne: false
            referencedRelation: "trq_abogado"
            referencedColumns: ["abg_id"]
          },
        ]
      }
      trq_billetera_documento: {
        Row: {
          doc_actualizado_en: string
          doc_alertar_caducidad: boolean
          doc_archivo_base64: string | null
          doc_archivo_mimetype: string
          doc_archivo_nombre: string
          doc_archivo_tamano: number
          doc_archivo_url: string | null
          doc_archivos: Json | null
          doc_categoria: string
          doc_creado_en: string
          doc_detalles: Json | null
          doc_eliminado_en: string | null
          doc_entidad_emisora: string | null
          doc_fecha_caducidad: string | null
          doc_fecha_emision: string | null
          doc_fecha_nacimiento: string | null
          doc_id: string
          doc_meses_anticipacion_alerta: number
          doc_metadatos_ocr: Json | null
          doc_negocio: string
          doc_numero_documento: string | null
          doc_secuencial: number
          doc_tipo: string
          doc_titular_identificacion: string | null
          doc_titular_nombre: string | null
          doc_titulo: string
          doc_usuario_id: string
        }
        Insert: {
          doc_actualizado_en?: string
          doc_alertar_caducidad?: boolean
          doc_archivo_base64?: string | null
          doc_archivo_mimetype?: string
          doc_archivo_nombre?: string
          doc_archivo_tamano?: number
          doc_archivo_url?: string | null
          doc_archivos?: Json | null
          doc_categoria: string
          doc_creado_en?: string
          doc_detalles?: Json | null
          doc_eliminado_en?: string | null
          doc_entidad_emisora?: string | null
          doc_fecha_caducidad?: string | null
          doc_fecha_emision?: string | null
          doc_fecha_nacimiento?: string | null
          doc_id?: string
          doc_meses_anticipacion_alerta?: number
          doc_metadatos_ocr?: Json | null
          doc_negocio?: string
          doc_numero_documento?: string | null
          doc_secuencial?: never
          doc_tipo?: string
          doc_titular_identificacion?: string | null
          doc_titular_nombre?: string | null
          doc_titulo: string
          doc_usuario_id: string
        }
        Update: {
          doc_actualizado_en?: string
          doc_alertar_caducidad?: boolean
          doc_archivo_base64?: string | null
          doc_archivo_mimetype?: string
          doc_archivo_nombre?: string
          doc_archivo_tamano?: number
          doc_archivo_url?: string | null
          doc_archivos?: Json | null
          doc_categoria?: string
          doc_creado_en?: string
          doc_detalles?: Json | null
          doc_eliminado_en?: string | null
          doc_entidad_emisora?: string | null
          doc_fecha_caducidad?: string | null
          doc_fecha_emision?: string | null
          doc_fecha_nacimiento?: string | null
          doc_id?: string
          doc_meses_anticipacion_alerta?: number
          doc_metadatos_ocr?: Json | null
          doc_negocio?: string
          doc_numero_documento?: string | null
          doc_secuencial?: never
          doc_tipo?: string
          doc_titular_identificacion?: string | null
          doc_titular_nombre?: string | null
          doc_titulo?: string
          doc_usuario_id?: string
        }
        Relationships: []
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
          cit_asignacion: string
          cit_cancelada_por: string | null
          cit_caso_id: string | null
          cit_cliente_id: string
          cit_cobertura: string
          cit_confirmada_en: string | null
          cit_creado_en: string
          cit_derecho_id: string | null
          cit_eliminado_en: string | null
          cit_enlace: string | null
          cit_estado: string
          cit_fin_en: string | null
          cit_google_evento_id: string | null
          cit_id: string
          cit_inicio_en: string
          cit_lugar: string | null
          cit_modalidad: string
          cit_motivo: string | null
          cit_notas: string | null
          cit_origen: string
          cit_pago_id: string | null
          cit_reasignada_de: string | null
          cit_reserva_id: string | null
          cit_secuencial: number
          cit_variante_id: string | null
        }
        Insert: {
          cit_abogado_id?: string | null
          cit_actualizado_en?: string
          cit_asignacion?: string
          cit_cancelada_por?: string | null
          cit_caso_id?: string | null
          cit_cliente_id: string
          cit_cobertura?: string
          cit_confirmada_en?: string | null
          cit_creado_en?: string
          cit_derecho_id?: string | null
          cit_eliminado_en?: string | null
          cit_enlace?: string | null
          cit_estado?: string
          cit_fin_en?: string | null
          cit_google_evento_id?: string | null
          cit_id?: string
          cit_inicio_en: string
          cit_lugar?: string | null
          cit_modalidad?: string
          cit_motivo?: string | null
          cit_notas?: string | null
          cit_origen?: string
          cit_pago_id?: string | null
          cit_reasignada_de?: string | null
          cit_reserva_id?: string | null
          cit_secuencial?: never
          cit_variante_id?: string | null
        }
        Update: {
          cit_abogado_id?: string | null
          cit_actualizado_en?: string
          cit_asignacion?: string
          cit_cancelada_por?: string | null
          cit_caso_id?: string | null
          cit_cliente_id?: string
          cit_cobertura?: string
          cit_confirmada_en?: string | null
          cit_creado_en?: string
          cit_derecho_id?: string | null
          cit_eliminado_en?: string | null
          cit_enlace?: string | null
          cit_estado?: string
          cit_fin_en?: string | null
          cit_google_evento_id?: string | null
          cit_id?: string
          cit_inicio_en?: string
          cit_lugar?: string | null
          cit_modalidad?: string
          cit_motivo?: string | null
          cit_notas?: string | null
          cit_origen?: string
          cit_pago_id?: string | null
          cit_reasignada_de?: string | null
          cit_reserva_id?: string | null
          cit_secuencial?: never
          cit_variante_id?: string | null
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
          {
            foreignKeyName: "trq_cita_cit_reasignada_de_fkey"
            columns: ["cit_reasignada_de"]
            isOneToOne: false
            referencedRelation: "trq_abogado"
            referencedColumns: ["abg_id"]
          },
        ]
      }
      trq_consulta_rapida: {
        Row: {
          crp_actualizado_en: string
          crp_cita_id: string | null
          crp_conversacion_id: string | null
          crp_creado_en: string
          crp_eliminado_en: string | null
          crp_escalada_en: string | null
          crp_id: string
          crp_materia_sugerida_id: string | null
          crp_pregunta: string
          crp_resuelta: boolean
          crp_secuencial: number
          crp_usuario_id: string
          crp_variante_sugerida_id: string | null
        }
        Insert: {
          crp_actualizado_en?: string
          crp_cita_id?: string | null
          crp_conversacion_id?: string | null
          crp_creado_en?: string
          crp_eliminado_en?: string | null
          crp_escalada_en?: string | null
          crp_id?: string
          crp_materia_sugerida_id?: string | null
          crp_pregunta: string
          crp_resuelta?: boolean
          crp_secuencial?: never
          crp_usuario_id: string
          crp_variante_sugerida_id?: string | null
        }
        Update: {
          crp_actualizado_en?: string
          crp_cita_id?: string | null
          crp_conversacion_id?: string | null
          crp_creado_en?: string
          crp_eliminado_en?: string | null
          crp_escalada_en?: string | null
          crp_id?: string
          crp_materia_sugerida_id?: string | null
          crp_pregunta?: string
          crp_resuelta?: boolean
          crp_secuencial?: never
          crp_usuario_id?: string
          crp_variante_sugerida_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trq_consulta_rapida_crp_conversacion_id_fkey"
            columns: ["crp_conversacion_id"]
            isOneToOne: false
            referencedRelation: "trq_conversacion"
            referencedColumns: ["cnv_id"]
          },
          {
            foreignKeyName: "trq_consulta_rapida_crp_materia_sugerida_id_fkey"
            columns: ["crp_materia_sugerida_id"]
            isOneToOne: false
            referencedRelation: "trq_materia"
            referencedColumns: ["mat_id"]
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
      trq_enlace_compartido_ttl: {
        Row: {
          ttl_activo: boolean
          ttl_creado_en: string
          ttl_detalles: Json | null
          ttl_documento_id: string | null
          ttl_expira_en: string
          ttl_id: string
          ttl_modo_expiracion: string
          ttl_pin_hash: string | null
          ttl_token: string
          ttl_una_sola_vista: boolean
          ttl_usuario_id: string
          ttl_visitas_conteo: number
          ttl_visto_en: string | null
        }
        Insert: {
          ttl_activo?: boolean
          ttl_creado_en?: string
          ttl_detalles?: Json | null
          ttl_documento_id?: string | null
          ttl_expira_en: string
          ttl_id?: string
          ttl_modo_expiracion?: string
          ttl_pin_hash?: string | null
          ttl_token: string
          ttl_una_sola_vista?: boolean
          ttl_usuario_id: string
          ttl_visitas_conteo?: number
          ttl_visto_en?: string | null
        }
        Update: {
          ttl_activo?: boolean
          ttl_creado_en?: string
          ttl_detalles?: Json | null
          ttl_documento_id?: string | null
          ttl_expira_en?: string
          ttl_id?: string
          ttl_modo_expiracion?: string
          ttl_pin_hash?: string | null
          ttl_token?: string
          ttl_una_sola_vista?: boolean
          ttl_usuario_id?: string
          ttl_visitas_conteo?: number
          ttl_visto_en?: string | null
        }
        Relationships: []
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
          mat_codigo: string | null
          mat_creado_en: string
          mat_id: string
          mat_nombre: string
        }
        Insert: {
          mat_activa?: boolean
          mat_codigo?: string | null
          mat_creado_en?: string
          mat_id?: string
          mat_nombre: string
        }
        Update: {
          mat_activa?: boolean
          mat_codigo?: string | null
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
      trq_plantilla_contrato: {
        Row: {
          pct_actualizado_en: string
          pct_contenido: string
          pct_creado_en: string
          pct_id: string
          pct_titulo: string
        }
        Insert: {
          pct_actualizado_en?: string
          pct_contenido: string
          pct_creado_en?: string
          pct_id?: string
          pct_titulo?: string
        }
        Update: {
          pct_actualizado_en?: string
          pct_contenido?: string
          pct_creado_en?: string
          pct_id?: string
          pct_titulo?: string
        }
        Relationships: []
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
      trq_version_contrato_socio: {
        Row: {
          vcs_comentarios: string | null
          vcs_contenido_md: string
          vcs_creado_en: string
          vcs_creado_por: string | null
          vcs_id: string
          vcs_numero_version: number
          vcs_path_pdf_firmado: string | null
          vcs_rol_creador: string
          vcs_secuencial: number
          vcs_solicitud_id: string
          vcs_tipo_evento: string
          vcs_titulo: string
        }
        Insert: {
          vcs_comentarios?: string | null
          vcs_contenido_md: string
          vcs_creado_en?: string
          vcs_creado_por?: string | null
          vcs_id?: string
          vcs_numero_version?: number
          vcs_path_pdf_firmado?: string | null
          vcs_rol_creador: string
          vcs_secuencial?: never
          vcs_solicitud_id: string
          vcs_tipo_evento: string
          vcs_titulo?: string
        }
        Update: {
          vcs_comentarios?: string | null
          vcs_contenido_md?: string
          vcs_creado_en?: string
          vcs_creado_por?: string | null
          vcs_id?: string
          vcs_numero_version?: number
          vcs_path_pdf_firmado?: string | null
          vcs_rol_creador?: string
          vcs_secuencial?: never
          vcs_solicitud_id?: string
          vcs_tipo_evento?: string
          vcs_titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "trq_version_contrato_socio_vcs_solicitud_id_fkey"
            columns: ["vcs_solicitud_id"]
            isOneToOne: false
            referencedRelation: "trq_solicitud_socio"
            referencedColumns: ["ssc_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      trq_fn_abogado_actual: { Args: never; Returns: string }
      trq_fn_candidatos_materia: {
        Args: { p_materia_id: string; p_provincia_id?: string }
        Returns: string[]
      }
      trq_fn_confirmar_contrato_socio: {
        Args: { p_comentario?: string; p_solicitud_id: string }
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
      trq_fn_decidir_cita: {
        Args: {
          p_cita_id: string
          p_decision: string
          p_motivo?: string
          p_nuevo_inicio?: string
        }
        Returns: string
      }
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
      trq_fn_eliminar_solicitud_propia: {
        Args: { p_solicitud_id?: string }
        Returns: boolean
      }
      trq_fn_es_admin_mfa_verificado: { Args: never; Returns: boolean }
      trq_fn_horarios_materia: {
        Args: {
          p_desde: string
          p_hasta: string
          p_materia_id: string
          p_modalidad?: string
          p_provincia_id?: string
          p_variante_id?: string
        }
        Returns: {
          disponibles: number
          hueco_fin: string
          hueco_inicio: string
        }[]
      }
      trq_fn_listar_solicitudes_admin: {
        Args: never
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
        }[]
        SetofOptions: {
          from: "*"
          to: "trq_solicitud_socio"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      trq_fn_reasignar_cita: {
        Args: {
          p_abogado_destino: string
          p_cita_id: string
          p_motivo?: string
        }
        Returns: string
      }
      trq_fn_reservar_cita: {
        Args: {
          p_caso_id?: string
          p_inicio_en: string
          p_materia_id: string
          p_modalidad?: string
          p_motivo?: string
          p_origen?: string
          p_provincia_id?: string
          p_variante_id?: string
        }
        Returns: string
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  comun_agenda: {
    Enums: {},
  },
  comun_auditoria: {
    Enums: {},
  },
  comun_catalogo: {
    Enums: {},
  },
  comun_comercio: {
    Enums: {},
  },
  comun_configuracion: {
    Enums: {},
  },
  comun_notificacion: {
    Enums: {},
  },
  comun_notificaciones: {
    Enums: {},
  },
  comun_reclutamiento: {
    Enums: {},
  },
  comun_seguridad: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  tranqui_legal: {
    Enums: {},
  },
} as const
