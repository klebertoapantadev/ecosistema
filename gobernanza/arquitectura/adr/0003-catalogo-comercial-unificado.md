# ADR-0003: Catálogo Comercial Unificado, Recetas (BOM), Proformas (CPQ), Inventarios y Suscripciones

**Fecha:** 2026-07-26 (Actualizado: 2026-11-13)  
**Estado:** aceptada (ampliada y blindada)  

## Contexto

Todos los negocios del ecosistema comercializan bienes, servicios o suscripciones bajo una misma infraestructura tecnológica:
- **Tinkay y Margaritas:** E-commerce de producto físico floral, bouquets elaborados con recetas (BOM), cross-sell (chocolates, peluches, globos) con stock y variantes propias, personalizaciones de entrega y suscripciones periódicas.
- **Tranqi:** Planes anuales y corporativos de protección jurídica (suscripciones), trámites puntuales fijos (notarizaciones, salidas del país) y liquidación de honorarios post-proceso.
- **FastFix Home:** Servicios fijos de mantenimiento, planes anuales de asistencia, jornadas de limpieza por tiempo/mano de obra, y trabajos bajo demanda mediante proformas compuestas (mano de obra + repuestos/materiales).
- **Futuros Negocios (Cafetería, Tienda Retail, etc.):** Alimentos y bebidas elaborados con recetas de insumos fraccionados (gramos, mililitros), modificadores en cascada y venta directa en mostrador.

Sin un módulo común robusto y con estricto aislamiento multitenant, cada negocio duplicaría lógica de productos, inventarios, proformas y facturación electrónica ante el SRI.

---

## Decisiones de Arquitectura

1. **El catálogo, las recetas (BOM), las proformas (CPQ), el inventario y las suscripciones son un módulo transversal de plataforma** alojado en el esquema **`comun_comercio`** (prefijo de tabla `com_`), implementando `PLT-009` y `PLT-010`.
2. **Aislamiento Multitenant Riguroso en Tablas Hijas:** Toda tabla (`com_categoria`, `com_producto`, `com_variante`, `com_media`, `com_personalizacion_campo`, `com_receta`, `com_producto_relacionado`, `com_insumo`, `com_inventario`, `com_kardex`, `com_merma`, `com_proforma`, `com_suscripcion`) incluye explícitamente la columna `*_negocio`. Esto garantiza:
   - Políticas RLS ultrarrápidas sin subconsultas complejas ni `JOINs` hacia el padre.
   - Claves de unicidad por negocio (ej. `unique(var_negocio, var_sku)` y `unique(ins_negocio, ins_codigo)`).
   - Bloqueo en base de datos para impedir que una variante de un negocio asocie insumos o productos de otro negocio.
3. **Unificación de Adicionales y Cross-Sell (`com_producto_relacionado`):** Se descarta la tabla plana `com_adicional`. Los adicionales (chocolates x4/x8, globos, tarjetas) son **productos y variantes estándar del catálogo** con sus propias fotos, códigos SRI, stock y recetas, vinculados mediante la relación `com_producto_relacionado` (`CROSS_SELL` | `UP_SELL` | `COMPONENTE`).
4. **Estándar Fiscal de Precios (`var_precio` = Base Imponible):**
   - En la base de datos, `var_precio` almacena siempre la **Base Imponible (Subtotal sin IVA)** para cuadrar al centavo con los XMLs de comprobantes electrónicos del SRI (`PLT-006`).
   - Para negocios B2C (Floristería), la interfaz administrativa permite ingresar el PVP nominal con IVA, pero el sistema calcula y almacena la base imponible y el valor del impuesto automáticamente según la configuración `precios_incluyen_iva` de `cfg_negocio`.
5. **Gestión Operativa de Recetas e Inventario (BOM):**
   - Deducción de insumos al cambiar la orden a estado **"En Elaboración" o "Despacho"**.
   - Registro de mermas y desperdicios auditados (`com_merma`) conectados al Kardex.
6. **Entidad de Suscripciones Activas (`com_suscripcion`):**
   - Control del ciclo de vida recurrente del cliente (próximo cobro, periodicidad, token de pago, reintentos).
7. **Proformas y Presupuestos Dinámicos (`com_proforma` & `com_proforma_item`):**
   - Emisión de presupuestos con token digital para aprobación del cliente. Admite variantes estándar con precios editados e ítems libres ad-hoc.
8. **Seguridad y RLS Dual:**
   - Lectura pública para catálogo activo (`pro_activo = true`, `var_activo = true`).
   - Escritura y datos operacionales (insumos, kardex, proformas, suscripciones) restringidos a roles `ADMINISTRADOR` y `OPERADOR` con membresía activa en el negocio dueño.

---

## Esquema de Base de Datos DDL: `comun_comercio`

### 1. Capa Comercial (Catálogo, Variantes y Relaciones)

```sql
-- Categorías de navegación por negocio
create table comun_comercio.com_categoria (
  ctg_id uuid primary key default gen_random_uuid(),
  ctg_secuencial bigint generated always as identity,
  ctg_negocio text not null,              -- 'tinkay' | 'margaritas' | 'tranqi' | 'fastfix' | ...
  ctg_nombre text not null,
  ctg_descripcion text,
  ctg_orden int not null default 0,
  ctg_activo boolean not null default true,
  ctg_detalle_categoria jsonb not null default '{}'::jsonb,
  ctg_creado_en timestamptz not null default now(),
  ctg_actualizado_en timestamptz not null default now()
);

-- Producto maestro abstracto
create table comun_comercio.com_producto (
  pro_id uuid primary key default gen_random_uuid(),
  pro_secuencial bigint generated always as identity,
  pro_negocio text not null,
  pro_categoria_id uuid references comun_comercio.com_categoria(ctg_id),
  pro_nombre text not null,
  pro_descripcion text,
  pro_activo boolean not null default true,
  pro_detalle_producto jsonb not null default '{}'::jsonb,
  pro_creado_en timestamptz not null default now(),
  pro_actualizado_en timestamptz not null default now()
);

-- Variante o SKU facturable
create table comun_comercio.com_variante (
  var_id uuid primary key default gen_random_uuid(),
  var_secuencial bigint generated always as identity,
  var_negocio text not null,
  var_producto_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  var_sku text not null,
  var_nombre text not null,                        -- ej. "Pequeño / 12 rosas", "Plan Anual Plus"
  var_tipo_oferta text not null,                   -- 'FISICO' | 'SERVICIO_PUNTUAL' | 'SUSCRIPCION' | 'TIEMPO_MANO_OBRA' | 'DIGITAL'
  var_precio numeric(12,4) not null,               -- Base imponible (subtotal sin IVA)
  var_precio_oferta numeric(12,4),
  var_codigo_principal text,                       -- Código principal SRI
  var_codigo_auxiliar text,
  var_impuesto text not null default 'IVA_15',      -- 'IVA_15' | 'IVA_0' | 'NO_OBJETO'
  var_detalle_suscripcion jsonb,                    -- Frecuencia, % descuento recurrente si var_tipo_oferta = 'SUSCRIPCION'
  var_activo boolean not null default true,
  var_detalle_variante jsonb not null default '{}'::jsonb,
  var_creado_en timestamptz not null default now(),
  var_actualizado_en timestamptz not null default now(),
  unique(var_negocio, var_sku)
);

-- Medios y fotografías
create table comun_comercio.com_media (
  med_id uuid primary key default gen_random_uuid(),
  med_negocio text not null,
  med_producto_id uuid references comun_comercio.com_producto(pro_id) on delete cascade,
  med_variante_id uuid references comun_comercio.com_variante(var_id) on delete cascade,
  med_origen text not null default 'local',        -- 'local' | 'url_externa'
  med_url text not null,
  med_es_portada boolean not null default false,
  med_creado_en timestamptz not null default now(),
  check (med_producto_id is not null or med_variante_id is not null)
);

-- Campos dinámicos de personalización por variante (ej. dedicatoria, fecha de entrega)
create table comun_comercio.com_personalizacion_campo (
  pzc_id uuid primary key default gen_random_uuid(),
  pzc_negocio text not null,
  pzc_producto_id uuid references comun_comercio.com_producto(pro_id) on delete cascade,
  pzc_variante_id uuid references comun_comercio.com_variante(var_id) on delete cascade,
  pzc_etiqueta text not null,
  pzc_tipo_campo text not null,                    -- 'TEXTO' | 'FECHA' | 'HORA' | 'TEXTAREA' | 'SELECT'
  pzc_es_obligatorio boolean not null default false,
  pzc_opciones jsonb not null default '[]'::jsonb,
  pzc_creado_en timestamptz not null default now()
);

-- Relaciones comerciales entre productos (Cross-Sell, Up-Sell, Sugeridos)
create table comun_comercio.com_producto_relacionado (
  prl_id uuid primary key default gen_random_uuid(),
  prl_negocio text not null,
  prl_producto_origen_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  prl_producto_destino_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  prl_tipo_relacion text not null default 'CROSS_SELL', -- 'CROSS_SELL' | 'UP_SELL' | 'COMPLEMENTO'
  prl_orden int not null default 0,
  unique(prl_producto_origen_id, prl_producto_destino_id)
);

-- Composición de Sets / Combos Configurables (ej. Sets de Eventos / Bodas compuestos por productos individuales con variantes)
create table comun_comercio.com_combo_componente (
  cbc_id uuid primary key default gen_random_uuid(),
  cbc_secuencial bigint generated always as identity,
  cbc_negocio text not null,
  cbc_combo_producto_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  cbc_item_producto_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  cbc_item_variante_id uuid references comun_comercio.com_variante(var_id) on delete set null,
  cbc_cantidad_base int not null default 1 check (cbc_cantidad_base >= 1),
  cbc_orden int not null default 1,
  cbc_es_opcional boolean not null default true,
  cbc_detalle_componente jsonb not null default '{}'::jsonb,
  cbc_creado_en timestamptz not null default now(),
  cbc_actualizado_en timestamptz not null default now(),
  check (cbc_combo_producto_id <> cbc_item_producto_id)
);
-- Nota: Adicionalmente, cada variante (`com_variante.var_detalle_variante.escalas_volumen`) soporta escalas de descuento por cantidad (`PRECIO_FIJO` | `PORCENTAJE` | `MONTO_DESCUENTO`) recalculando la base imponible antes de IVA.
```

---

### 2. Capa Operativa y BOM (Lista de Materiales y Recetas)

```sql
-- Insumos, materias primas y repuestos (rosas, papel, cinta, café en grano, repuesto calefón)
create table comun_comercio.com_insumo (
  ins_id uuid primary key default gen_random_uuid(),
  ins_negocio text not null,
  ins_codigo text not null,
  ins_nombre text not null,
  ins_unidad_medida text not null,                  -- 'UNIDAD' | 'TALLO' | 'PLIEGO' | 'METRO' | 'GRAMO' | 'MILILITRO' | 'HORA'
  ins_costo_unitario numeric(12,4) not null default 0,
  ins_activo boolean not null default true,
  ins_creado_en timestamptz not null default now(),
  unique(ins_negocio, ins_codigo)
);

-- Receta / Composición de una variante (BOM)
create table comun_comercio.com_receta (
  rec_id uuid primary key default gen_random_uuid(),
  rec_negocio text not null,
  rec_variante_id uuid not null references comun_comercio.com_variante(var_id) on delete cascade,
  rec_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  rec_cantidad numeric(12,4) not null,              -- ej. 24 tallos, 2 pliegos, 18 gramos
  rec_es_opcional boolean not null default false,
  unique(rec_variante_id, rec_insumo_id)
);
```

---

### 3. Capa de Inventario, Kardex y Mermas

```sql
-- Stock actual por local/almacén
create table comun_comercio.com_inventario (
  inv_id uuid primary key default gen_random_uuid(),
  inv_negocio text not null,
  inv_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  inv_local_codigo text not null default 'MATRIZ',
  inv_stock_actual numeric(12,4) not null default 0,
  inv_stock_minimo numeric(12,4) not null default 0,
  inv_actualizado_en timestamptz not null default now(),
  unique(inv_negocio, inv_insumo_id, inv_local_codigo)
);

-- Movimientos de Kardex
create table comun_comercio.com_kardex (
  kar_id uuid primary key default gen_random_uuid(),
  kar_negocio text not null,
  kar_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  kar_local_codigo text not null default 'MATRIZ',
  kar_tipo_movimiento text not null,               -- 'COMPRA' | 'CONSUMO_PRODUCCION' | 'MERMA' | 'AJUSTE_INVENTARIO'
  kar_cantidad numeric(12,4) not null,
  kar_costo_unitario numeric(12,4) not null,
  kar_referencia_id uuid,                          -- ID del pedido, orden de trabajo o compra
  kar_observacion text,
  kar_registrado_por uuid references comun_seguridad.seg_usuario(usu_id),
  kar_creado_en timestamptz not null default now()
);

-- Registro detallado de Mermas / Desperdicios
create table comun_comercio.com_merma (
  mrm_id uuid primary key default gen_random_uuid(),
  mrm_negocio text not null,
  mrm_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  mrm_cantidad numeric(12,4) not null,
  mrm_motivo text not null,                        -- 'MARCHITAMIENTO' | 'ROTURA' | 'CADUCIDAD' | 'DEFECTO_FABRICA'
  mrm_observacion text,
  mrm_reportado_por uuid not null references comun_seguridad.seg_usuario(usu_id),
  mrm_creado_en timestamptz not null default now()
);
```

---

### 4. Capa de Proformas y Cotizaciones (CPQ)

```sql
-- Cabecera de Proforma / Cotización
create table comun_comercio.com_proforma (
  prf_id uuid primary key default gen_random_uuid(),
  prf_secuencial bigint generated always as identity,
  prf_negocio text not null,
  prf_cliente_id uuid references comun_seguridad.seg_usuario(usu_id),
  prf_cliente_nombre text not null,
  prf_cliente_contacto jsonb not null default '{}'::jsonb,
  prf_estado text not null default 'BORRADOR',     -- 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'FACTURADA'
  prf_subtotal numeric(12,4) not null default 0,
  prf_descuento numeric(12,4) not null default 0,
  prf_iva numeric(12,4) not null default 0,
  prf_total numeric(12,4) not null default 0,
  prf_token_aprobacion text unique default gen_random_uuid()::text,
  prf_vigencia_dias int not null default 15,
  prf_observaciones text,
  prf_creado_en timestamptz not null default now(),
  prf_actualizado_en timestamptz not null default now()
);

-- Líneas de Proforma
create table comun_comercio.com_proforma_item (
  pfi_id uuid primary key default gen_random_uuid(),
  pfi_negocio text not null,
  pfi_proforma_id uuid not null references comun_comercio.com_proforma(prf_id) on delete cascade,
  pfi_variante_id uuid references comun_comercio.com_variante(var_id),
  pfi_es_item_libre boolean not null default false,
  pfi_descripcion text not null,
  pfi_cantidad numeric(12,2) not null default 1,
  pfi_precio_unitario numeric(12,4) not null,
  pfi_descuento numeric(12,4) not null default 0,
  pfi_impuesto text not null default 'IVA_15',
  pfi_total_linea numeric(12,4) not null
);
```

---

### 5. Capa de Suscripciones Activas

```sql
-- Instancias activas de suscripción recurrente de clientes
create table comun_comercio.com_suscripcion (
  sub_id uuid primary key default gen_random_uuid(),
  sub_secuencial bigint generated always as identity,
  sub_negocio text not null,
  sub_cliente_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  sub_variante_id uuid not null references comun_comercio.com_variante(var_id),
  sub_estado text not null default 'ACTIVA',       -- 'ACTIVA' | 'PAUSADA' | 'CANCELADA' | 'EN_MORA'
  sub_frecuencia text not null,                    -- 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'ANUAL'
  sub_monto_periodo numeric(12,4) not null,
  sub_proximo_cobro_en timestamptz not null,
  sub_ultimo_cobro_en timestamptz,
  sub_metodo_pago_token text,
  sub_detalle_suscripcion jsonb not null default '{}'::jsonb, -- dirección de entrega fija, preferencias
  sub_creado_en timestamptz not null default now(),
  sub_actualizado_en timestamptz not null default now()
);
```

---

### 6. Capa de Billetera Digital, Créditos Institucionales y Convenios B2B2C

```sql
-- Contrato corporativo o convenio institucional (ej. Banco Pichincha, Municipio de Quito)
create table comun_comercio.com_convenio_empresa (
  cve_id uuid primary key default gen_random_uuid(),
  cve_secuencial bigint generated always as identity,
  cve_negocio text not null,              -- 'tranqi' | 'fastfix' | 'tinkay' | ...
  cve_empresa_nombre text not null,       -- ej. "Municipio del Distrito Metropolitano de Quito"
  cve_empresa_ruc text,
  cve_dominio_correo text,                -- ej. "pichincha.com" o "quito.gob.ec"
  cve_variante_id uuid references comun_comercio.com_variante(var_id), -- Plan asociado si aplica
  cve_monto_bono_inicial numeric(12,4) not null default 0.00, -- Bono de $100.00 para trámites
  cve_porcentaje_subsidio numeric(5,2) not null default 100.00,
  cve_activo boolean not null default true,
  cve_valido_hasta timestamptz,
  cve_creado_en timestamptz not null default now()
);

-- Nómina de colaboradores / beneficiarios registrados por el convenio
create table comun_comercio.com_beneficiario_empresa (
  bnf_id uuid primary key default gen_random_uuid(),
  bnf_negocio text not null,
  bnf_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  bnf_identificacion text not null,       -- Cédula de identidad (clave de validación)
  bnf_correo_corporativo text,
  bnf_nombres text,
  bnf_usuario_vinculado_id uuid references comun_seguridad.seg_usuario(usu_id),
  bnf_estado text not null default 'PENDIENTE', -- 'PENDIENTE' | 'VINCULADO' | 'INACTIVO'
  bnf_vinculado_en timestamptz,
  bnf_creado_en timestamptz not null default now(),
  unique(bnf_convenio_id, bnf_identificacion)
);

-- Billetera de créditos y saldo por usuario y por negocio
create table comun_comercio.com_billetera (
  wlt_id uuid primary key default gen_random_uuid(),
  wlt_negocio text not null,              -- 'tranqi' | 'fastfix' | 'tinkay'
  wlt_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  wlt_saldo_total numeric(12,4) not null default 0.00,
  wlt_saldo_recarga numeric(12,4) not null default 0.00,  -- Dinero real recargado con TC
  wlt_saldo_bono numeric(12,4) not null default 0.00,     -- Bonos / subsidios institucionales
  wlt_activo boolean not null default true,
  wlt_actualizado_en timestamptz not null default now(),
  unique(wlt_negocio, wlt_usuario_id)
);

-- Kardex financiero de la billetera (inmutable)
create table comun_comercio.com_billetera_movimiento (
  wlm_id uuid primary key default gen_random_uuid(),
  wlm_negocio text not null,
  wlm_billetera_id uuid not null references comun_comercio.com_billetera(wlt_id) on delete cascade,
  wlm_tipo text not null,                 -- 'RECARGA_TC' | 'BONO_CONVENIO' | 'PAGO_SERVICIO' | 'REVERSION'
  wlm_tipo_saldo text not null,           -- 'RECARGA' | 'BONO'
  wlm_monto numeric(12,4) not null,       -- Positivo en entradas, negativo en pagos
  wlm_saldo_anterior numeric(12,4) not null,
  wlm_saldo_posterior numeric(12,4) not null,
  wlm_referencia_id uuid,                 -- ID de la orden, proforma o pago
  wlm_convenio_id uuid references comun_comercio.com_convenio_empresa(cve_id),
  wlm_expira_en timestamptz,              -- Caducidad del bono promocional
  wlm_descripcion text not null,
  wlm_creado_en timestamptz not null default now()
);
```

---

### 7. Capa de Cupones, Campañas e Influencers (`PLT-014`)

```sql
-- Catálogo de Cupones y Códigos de Campaña
create table comun_comercio.com_cupon (
  cup_id uuid primary key default gen_random_uuid(),
  cup_secuencial bigint generated always as identity,
  cup_negocio text not null,              -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas'
  cup_codigo text not null,               -- ej. 'INFLUENCER20', 'MUNICIPIO100', 'BLACKFRIDAY'
  cup_descripcion text,
  cup_tipo text not null,                 -- 'PORCENTAJE' | 'MONTO_FIJO' | 'BONO_BILLETERA' | 'ENVIO_GRATIS'
  cup_valor numeric(12,4) not null,       -- ej. 20.00 (20%) o 15.00 ($15 fijos o $15 a billetera)
  cup_monto_minimo_compra numeric(12,4) not null default 0.00,
  cup_limite_usos_global int,             -- Cupo total de canjes
  cup_usos_actuales int not null default 0,
  cup_limite_usos_por_usuario int not null default 1,
  cup_valido_desde timestamptz not null default now(),
  cup_valido_hasta timestamptz,
  cup_influencer_nombre text,             -- Atribución para liquidación de comisiones
  cup_aplica_a text not null default 'TODOS', -- 'TODOS' | 'SOLO_PLANES' | 'SOLO_PRODUCTOS'
  cup_regla_suscripcion text not null default 'SOLO_PRIMER_CICLO', -- 'SOLO_PRIMER_CICLO' | 'RECURRENTE_PERMANENTE'
  cup_activo boolean not null default true,
  cup_creado_en timestamptz not null default now(),
  unique(cup_negocio, cup_codigo)
);

-- Registro inmutable de canjes de cupones
create table comun_comercio.com_cupon_uso (
  cpu_id uuid primary key default gen_random_uuid(),
  cpu_negocio text not null,
  cpu_cupon_id uuid not null references comun_comercio.com_cupon(cup_id) on delete cascade,
  cpu_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  cpu_orden_referencia_id uuid,
  cpu_monto_descontado numeric(12,4) not null,
  cpu_creado_en timestamptz not null default now()
);
```

---

### 8. Capa de Directorio de Proveedores, Couriers y Despachos Híbridos

Permite a los negocios gestionar su logística y ejecución operativa mediante una combinación ágil de recursos propios (vehículo de taller, cuadrilla fija) y proveedores tercerizados (Uber, Cabify, taxis convencionales, couriers motorizados de documentos físicos, contratistas técnicos especializados):

```sql
-- Directorio unificado de transportistas, mensajerías y técnicos tercerizados
create table comun_comercio.com_proveedor_servicio (
  prv_id uuid primary key default gen_random_uuid(),
  prv_secuencial bigint generated always as identity,
  prv_negocio text not null,              -- 'tinkay' | 'fastfix' | 'tranqi' | 'margaritas'
  prv_tipo text not null,                 -- 'DELIVERY_PROPIO' | 'COURIER_EXTERNO' | 'APP_MOVILIDAD' | 'TECNICO_SUBCONTRATADO'
  prv_nombre_comercial text not null,     -- ej. "Don Carlos Taxi Convencional", "Uber Delivery", "Servientrega Express", "ElectroServicios Ruiz"
  prv_contacto_nombre text,
  prv_telefono text,
  prv_email text,
  prv_vehiculo_tipo text,                 -- 'MOTO' | 'AUTO' | 'FURGONETA' | 'CAMIONETA' | 'NINGUNO'
  prv_placa text,
  prv_tarifario_referencial jsonb not null default '{}'::jsonb, -- ej. {"tarifa_base": 3.00, "por_km": 0.50}
  prv_activo boolean not null default true,
  prv_detalle_proveedor jsonb not null default '{}'::jsonb,
  prv_creado_en timestamptz not null default now(),
  prv_actualizado_en timestamptz not null default now()
);

-- Asignación operativa de despachos, entrega de documentos físicos o servicios en campo
create table comun_comercio.com_despacho_asignacion (
  dsp_id uuid primary key default gen_random_uuid(),
  dsp_secuencial bigint generated always as identity,
  dsp_negocio text not null,
  dsp_orden_id uuid not null,             -- ID del pedido (Tinkay), trámite (Tranqi) o servicio técnico (FastFix)
  dsp_proveedor_id uuid references comun_comercio.com_proveedor_servicio(prv_id), -- Opcional si fue pedido ad-hoc
  dsp_modalidad text not null default 'DIRECTORIO', -- 'PROPIO' | 'DIRECTORIO' | 'UBER_CABIFY' | 'COURIER_DOCUMENTOS'
  dsp_conductor_nombre text,
  dsp_conductor_telefono text,
  dsp_tracking_url text,                  -- Enlace de seguimiento en vivo (ej. compartir viaje de Uber)
  dsp_costo_envio numeric(12,4) not null default 0.00, -- Costo real incurrido para auditoría de márgenes
  dsp_estado text not null default 'ASIGNADO', -- 'ASIGNADO' | 'EN_CAMINO' | 'ENTREGADO' | 'FALLIDO'
  dsp_observaciones_coordinacion text,
  dsp_comprobante_entrega jsonb not null default '{}'::jsonb, -- Foto de entrega / firma digital / POD
  dsp_detalle_despacho jsonb not null default '{}'::jsonb,
  dsp_creado_en timestamptz not null default now(),
  dsp_actualizado_en timestamptz not null default now()
);
```

---

## Políticas de Seguridad (RLS)

```sql
-- Habilitar RLS en todas las tablas
alter table comun_comercio.com_categoria enable row level security;
alter table comun_comercio.com_producto enable row level security;
alter table comun_comercio.com_variante enable row level security;
alter table comun_comercio.com_media enable row level security;
alter table comun_comercio.com_personalizacion_campo enable row level security;
alter table comun_comercio.com_producto_relacionado enable row level security;
alter table comun_comercio.com_insumo enable row level security;
alter table comun_comercio.com_receta enable row level security;
alter table comun_comercio.com_inventario enable row level security;
alter table comun_comercio.com_kardex enable row level security;
alter table comun_comercio.com_merma enable row level security;
alter table comun_comercio.com_proforma enable row level security;
alter table comun_comercio.com_proforma_item enable row level security;
alter table comun_comercio.com_suscripcion enable row level security;
alter table comun_comercio.com_convenio_empresa enable row level security;
alter table comun_comercio.com_beneficiario_empresa enable row level security;
alter table comun_comercio.com_billetera enable row level security;
alter table comun_comercio.com_billetera_movimiento enable row level security;
alter table comun_comercio.com_cupon enable row level security;
alter table comun_comercio.com_cupon_uso enable row level security;
alter table comun_comercio.com_proveedor_servicio enable row level security;
alter table comun_comercio.com_despacho_asignacion enable row level security;

-- 1. Vitrina Pública (Lectura anónima de catálogo activo y validación de cupones)
create policy com_categoria_lectura_publica on comun_comercio.com_categoria
  for select using (ctg_activo = true);

create policy com_producto_lectura_publica on comun_comercio.com_producto
  for select using (pro_activo = true);

create policy com_variante_lectura_publica on comun_comercio.com_variante
  for select using (var_activo = true);

create policy com_media_lectura_publica on comun_comercio.com_media
  for select using (true);

create policy com_personalizacion_lectura_publica on comun_comercio.com_personalizacion_campo
  for select using (true);

create policy com_producto_relacionado_lectura_publica on comun_comercio.com_producto_relacionado
  for select using (true);

create policy com_cupon_lectura_publica on comun_comercio.com_cupon
  for select using (cup_activo = true);

-- 2. Clientes: Lectura de su propia Billetera, Suscripciones y Cupones Canjeados
create policy com_billetera_cliente_select on comun_comercio.com_billetera
  for select using (wlt_usuario_id = auth.uid());

create policy com_billetera_movimiento_cliente_select on comun_comercio.com_billetera_movimiento
  for select using (
    exists (
      select 1 from comun_comercio.com_billetera
      where wlt_id = wlm_billetera_id and wlt_usuario_id = auth.uid()
    )
  );

create policy com_suscripcion_cliente_select on comun_comercio.com_suscripcion
  for select using (sub_cliente_id = auth.uid());

create policy com_cupon_uso_cliente_select on comun_comercio.com_cupon_uso
  for select using (cpu_usuario_id = auth.uid());

create policy com_proforma_cliente_select on comun_comercio.com_proforma
  for select using (prf_cliente_id = auth.uid());

create policy com_proforma_item_cliente_select on comun_comercio.com_proforma_item
  for select using (
    exists (
      select 1 from comun_comercio.com_proforma
      where prf_id = pfi_proforma_id and prf_cliente_id = auth.uid()
    )
  );

-- 3. Gestión Administrativa y Operativa por Membresía de Negocio
create policy com_categoria_staff on comun_comercio.com_categoria
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ctg_negocio));

create policy com_producto_staff on comun_comercio.com_producto
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(pro_negocio));

create policy com_variante_staff on comun_comercio.com_variante
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(var_negocio));

create policy com_media_staff on comun_comercio.com_media
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(med_negocio));

create policy com_insumo_staff on comun_comercio.com_insumo
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ins_negocio));

create policy com_receta_staff on comun_comercio.com_receta
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(rec_negocio));

create policy com_inventario_staff on comun_comercio.com_inventario
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(inv_negocio));

create policy com_kardex_staff on comun_comercio.com_kardex
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(kar_negocio));

create policy com_merma_staff on comun_comercio.com_merma
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(mrm_negocio));

create policy com_proforma_staff on comun_comercio.com_proforma
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(prf_negocio));

create policy com_proforma_item_staff on comun_comercio.com_proforma_item
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(pfi_negocio));

create policy com_suscripcion_staff on comun_comercio.com_suscripcion
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(sub_negocio));

create policy com_convenio_staff on comun_comercio.com_convenio_empresa
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cve_negocio));

create policy com_beneficiario_staff on comun_comercio.com_beneficiario_empresa
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(bnf_negocio));

create policy com_billetera_staff on comun_comercio.com_billetera
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(wlt_negocio));

create policy com_billetera_movimiento_staff on comun_comercio.com_billetera_movimiento
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(wlm_negocio));

create policy com_cupon_staff on comun_comercio.com_cupon
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cup_negocio));

create policy com_cupon_uso_staff on comun_comercio.com_cupon_uso
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cpu_negocio));

create policy com_proveedor_staff on comun_comercio.com_proveedor_servicio
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(prv_negocio));

create policy com_despacho_staff on comun_comercio.com_despacho_asignacion
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(dsp_negocio));
```
