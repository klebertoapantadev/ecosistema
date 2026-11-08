-- PLT-006: facturación electrónica SRI (esquema comun_facturacion).
--
-- Hasta aquí el ecosistema cobraba (comun_comercio.com_transaccion_pago) pero
-- no emitía ningún comprobante ante el SRI. Este esquema guarda el emisor de
-- cada negocio, su certificado .p12 (en Vault), la numeración y los
-- comprobantes; la firma XAdES-BES y el envío al SRI los hace la Edge Function
-- facturacion-sri, que vacía la cola de esta tabla (ver ADR-0007).
--
-- Decisiones que condicionan el diseño:
--   - Un emisor por negocio (decisiones-validadas-negocio.md §B): cada negocio
--     factura con su propio RUC, certificado y secuenciales.
--   - Ninguna sesión escribe en estas tablas: todo pasa por RPC (regla 5 de
--     AGENTS.md). La emisión asigna número y clave de acceso de forma atómica y
--     una sola vez; el worker nunca renumera.
--   - Tres cerrojos para no emitir en producción por accidente: ambiente 1 por
--     defecto, emi_produccion_habilitada solo la activa un superadmin, y el
--     paso a ambiente 2 exige MFA (aal2), certificado vigente y una factura ya
--     autorizada en pruebas.
--   - El .p12 y su contraseña viven en Vault: aquí solo quedan los uuid de los
--     secretos. Solo service_role los descifra (fac_fn_obtener_certificado).
--   - Cada pago APROBADO de un negocio con emisión automática genera y emite
--     su factura (PLT-006 regla 2), sin poder romper la confirmación del pago.

create schema if not exists comun_facturacion;
create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ═══════════ 1. Emisor (uno por negocio) ═══════════
create table comun_facturacion.fac_emisor (
  emi_id uuid primary key default gen_random_uuid(),
  emi_secuencial bigint generated always as identity,
  emi_negocio text not null unique references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  emi_ruc text not null check (emi_ruc ~ '^[0-9]{10}001$'),
  emi_razon_social text not null check (length(btrim(emi_razon_social)) between 1 and 300),
  emi_nombre_comercial text,
  emi_direccion_matriz text not null check (length(btrim(emi_direccion_matriz)) between 1 and 300),
  emi_direccion_establecimiento text,
  -- Punto de emisión exclusivo de la modalidad electrónica (normativa SRI).
  emi_establecimiento text not null default '001' check (emi_establecimiento ~ '^[0-9]{3}$' and emi_establecimiento <> '000'),
  emi_punto_emision text not null default '001' check (emi_punto_emision ~ '^[0-9]{3}$' and emi_punto_emision <> '000'),
  emi_obligado_contabilidad boolean not null default false,
  emi_contribuyente_especial text,
  emi_agente_retencion text,
  emi_regimen text not null default 'GENERAL'
    check (emi_regimen in ('GENERAL', 'RIMPE_EMPRENDEDOR', 'RIMPE_NEGOCIO_POPULAR')),
  -- 1 = pruebas (celcer), 2 = producción (cel). Ver fac_fn_cambiar_ambiente.
  emi_ambiente smallint not null default 1 check (emi_ambiente in (1, 2)),
  -- Solo un superadmin la activa (fac_fn_habilitar_produccion).
  emi_produccion_habilitada boolean not null default false,
  emi_certificado_id uuid,
  -- true = cada pago APROBADO del negocio genera y emite su factura.
  emi_emision_automatica boolean not null default false,
  emi_activo boolean not null default false,
  emi_correo_copia text,
  emi_detalle_emisor jsonb not null default '{}'::jsonb,
  emi_creado_en timestamptz not null default now(),
  emi_actualizado_en timestamptz not null default now(),
  check (emi_ambiente = 1 or emi_produccion_habilitada)
);

-- ═══════════ 2. Certificados de firma (.p12 en Vault) ═══════════
create table comun_facturacion.fac_certificado (
  cer_id uuid primary key default gen_random_uuid(),
  cer_secuencial bigint generated always as identity,
  cer_negocio text not null references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  cer_titular text not null,
  cer_identificacion text,
  cer_emisor text not null,
  cer_serial text not null,
  cer_huella_sha1 text not null check (cer_huella_sha1 ~ '^[0-9A-F]{40}$'),
  cer_valido_desde timestamptz not null,
  cer_valido_hasta timestamptz not null,
  cer_cadena_verificada boolean,
  -- uuid de vault.secrets; null cuando el certificado se desactiva (se borran los secretos).
  cer_p12_secreto_id uuid,
  cer_clave_secreto_id uuid,
  cer_activo boolean not null default true,
  cer_subido_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cer_detalle_certificado jsonb not null default '{}'::jsonb,
  cer_creado_en timestamptz not null default now(),
  cer_actualizado_en timestamptz not null default now(),
  unique (cer_negocio, cer_huella_sha1),
  check (not cer_activo or (cer_p12_secreto_id is not null and cer_clave_secreto_id is not null))
);

alter table comun_facturacion.fac_emisor
  add constraint fac_emisor_certificado_fk
  foreign key (emi_certificado_id) references comun_facturacion.fac_certificado(cer_id) on delete set null;

-- ═══════════ 3. Numeración (por negocio, ambiente, tipo y punto) ═══════════
-- Separada por ambiente: las pruebas no gastan números reales.
create table comun_facturacion.fac_secuencial (
  sec_id uuid primary key default gen_random_uuid(),
  sec_secuencial bigint generated always as identity,
  sec_negocio text not null references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  sec_ambiente smallint not null check (sec_ambiente in (1, 2)),
  sec_tipo text not null check (sec_tipo in ('01', '04')),
  sec_establecimiento text not null,
  sec_punto_emision text not null,
  sec_ultimo bigint not null default 0 check (sec_ultimo between 0 and 999999999),
  sec_creado_en timestamptz not null default now(),
  sec_actualizado_en timestamptz not null default now(),
  unique (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision)
);

-- ═══════════ 4. Comprobantes ═══════════
create table comun_facturacion.fac_comprobante (
  cmp_id uuid primary key default gen_random_uuid(),
  cmp_secuencial bigint generated always as identity,
  cmp_negocio text not null references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  cmp_tipo text not null check (cmp_tipo in ('01', '04')),
  -- Los cinco siguientes se fijan al emitir (fac_fn_emitir_interno) y ya no cambian.
  cmp_ambiente smallint check (cmp_ambiente in (1, 2)),
  cmp_establecimiento text,
  cmp_punto_emision text,
  cmp_numero bigint check (cmp_numero between 1 and 999999999),
  cmp_clave_acceso text unique check (cmp_clave_acceso ~ '^[0-9]{49}$'),
  cmp_fecha_emision date,
  -- Copia del adquirente al crear el comprobante (no cambia si cambia su perfil).
  cmp_comprador jsonb not null,
  -- [{forma_pago, total (null = por el importe total), plazo, unidad_tiempo}]
  cmp_formas_pago jsonb not null default '[]'::jsonb,
  -- [{nombre, valor}], máximo 15 campos.
  cmp_info_adicional jsonb not null default '[]'::jsonb,
  cmp_modifica_id uuid references comun_facturacion.fac_comprobante(cmp_id) on delete restrict,
  cmp_motivo text,
  -- Una factura por pago como mucho.
  cmp_transaccion_pago_id uuid unique references comun_comercio.com_transaccion_pago(pag_id) on delete restrict,
  -- El comprador con cuenta: puede ver sus comprobantes autorizados.
  cmp_cliente_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cmp_estado text not null default 'BORRADOR' check (cmp_estado in (
    'BORRADOR', 'PENDIENTE', 'RECIBIDO', 'AUTORIZADO', 'DEVUELTO', 'NO_AUTORIZADO', 'ERROR', 'ANULADO')),
  -- Totales: los calcula y fija el worker (única fuente de verdad, no el navegador).
  cmp_total_sin_impuestos numeric(12,2),
  cmp_total_descuento numeric(12,2),
  cmp_total_iva numeric(12,2),
  cmp_importe_total numeric(12,2),
  cmp_mensajes_sri jsonb not null default '[]'::jsonb,
  cmp_numero_autorizacion text,
  cmp_fecha_autorizacion timestamptz,
  cmp_certificado_id uuid references comun_facturacion.fac_certificado(cer_id) on delete restrict,
  cmp_xml_ruta text,
  cmp_ride_ruta text,
  cmp_correo_enviado_en timestamptz,
  cmp_intentos int not null default 0,
  cmp_proximo_intento timestamptz,
  cmp_bloqueado_en timestamptz,
  cmp_emitido_en timestamptz,
  cmp_anulado_en timestamptz,
  -- Nº de solicitud de anulación en SRI en Línea (no hay web service para anular).
  cmp_anulacion_referencia text,
  cmp_creado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cmp_detalle_comprobante jsonb not null default '{}'::jsonb,
  cmp_creado_en timestamptz not null default now(),
  cmp_actualizado_en timestamptz not null default now(),
  unique (cmp_negocio, cmp_ambiente, cmp_tipo, cmp_establecimiento, cmp_punto_emision, cmp_numero),
  check (cmp_estado = 'BORRADOR' or (cmp_numero is not null and cmp_clave_acceso is not null and cmp_ambiente is not null)),
  check ((cmp_tipo = '04') = (cmp_modifica_id is not null))
);

create index idx_fac_comprobante_negocio on comun_facturacion.fac_comprobante(cmp_negocio, cmp_estado, cmp_creado_en desc);
create index idx_fac_comprobante_cola on comun_facturacion.fac_comprobante(cmp_proximo_intento)
  where cmp_estado in ('PENDIENTE', 'RECIBIDO');
create index idx_fac_comprobante_cliente on comun_facturacion.fac_comprobante(cmp_cliente_usuario_id);

create table comun_facturacion.fac_comprobante_linea (
  lin_id uuid primary key default gen_random_uuid(),
  lin_secuencial bigint generated always as identity,
  lin_comprobante_id uuid not null references comun_facturacion.fac_comprobante(cmp_id) on delete cascade,
  lin_negocio text not null,
  lin_orden int not null check (lin_orden > 0),
  lin_codigo text not null check (length(btrim(lin_codigo)) between 1 and 25),
  lin_codigo_auxiliar text,
  lin_descripcion text not null check (length(btrim(lin_descripcion)) between 1 and 300),
  lin_cantidad numeric(18,6) not null check (lin_cantidad > 0),
  lin_precio_unitario numeric(18,6) not null check (lin_precio_unitario >= 0),
  lin_descuento numeric(12,2) not null default 0 check (lin_descuento >= 0),
  -- codigoPorcentaje del IVA (Tabla 17): 0, 4 (15 %), 5, 6 (no objeto), 7 (exento), 10 (13 %).
  lin_codigo_iva text not null check (lin_codigo_iva in ('0', '4', '5', '6', '7', '10')),
  lin_base_imponible numeric(12,2),
  lin_valor_iva numeric(12,2),
  -- [{nombre, valor}] → detallesAdicionales del XML.
  lin_detalle_linea jsonb not null default '[]'::jsonb,
  lin_creado_en timestamptz not null default now(),
  lin_actualizado_en timestamptz not null default now(),
  unique (lin_comprobante_id, lin_orden)
);

-- Bitácora de cada transición (la escriben solo las funciones). evt_comprobante_id
-- es null cuando falla la facturación de un pago antes de crear el comprobante.
create table comun_facturacion.fac_evento (
  evt_id uuid primary key default gen_random_uuid(),
  evt_secuencial bigint generated always as identity,
  evt_comprobante_id uuid references comun_facturacion.fac_comprobante(cmp_id) on delete cascade,
  evt_negocio text not null,
  evt_tipo text not null,
  evt_detalle_evento jsonb not null default '{}'::jsonb,
  evt_creado_por uuid,
  evt_creado_en timestamptz not null default now(),
  evt_actualizado_en timestamptz not null default now()
);

create index idx_fac_evento_comprobante on comun_facturacion.fac_evento(evt_comprobante_id, evt_creado_en);

-- ═══════════ Quién administra la facturación de un negocio ═══════════
-- No se usa comun_seguridad.seg_fn_es_admin_negocio: desde 20260812000001
-- también devuelve true para OPERADOR, AUXILIAR y TECNICO. Subir el
-- certificado de firma, pasar a producción o registrar anulaciones exige el
-- perfil ADMINISTRADOR (o superadmin). Emitir sí lo puede hacer un operador.
create or replace function comun_facturacion.fac_fn_negocio_canonico(p_negocio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') then 'tranqi'
    when upper(p_negocio) in ('FFH', 'FASTFIX') then 'fastfix'
    when upper(p_negocio) in ('TNK', 'TINKAY') then 'tinkay'
    when upper(p_negocio) in ('MRG', 'MARGARITAS') then 'margaritas'
    else lower(p_negocio) end;
$$;

-- Para un usuario dado: las funciones que llama una Edge Function con
-- service_role no tienen auth.uid().
create or replace function comun_facturacion.fac_fn_usuario_es_admin(p_usuario uuid, p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from comun_seguridad.seg_usuario u where u.usu_id = p_usuario and u.usu_superadmin_plataforma
  ) or exists (
    select 1 from comun_seguridad.seg_membresia m
     where m.mem_usuario_id = p_usuario
       and m.mem_estado = 'ACTIVO'
       and comun_facturacion.fac_fn_negocio_canonico(m.mem_negocio) = comun_facturacion.fac_fn_negocio_canonico(p_negocio)
       and (m.mem_rol = 'ADMINISTRADOR' or exists (
         select 1 from comun_seguridad.seg_membresia_perfil mp
           join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
          where mp.mpe_membresia_id = m.mem_id and upper(p.per_clave) = 'ADMINISTRADOR'))
  );
$$;

create or replace function comun_facturacion.fac_fn_es_admin(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_facturacion.fac_fn_usuario_es_admin(auth.uid(), p_negocio);
$$;

-- ═══════════ RLS, auditoría y grants ═══════════
alter table comun_facturacion.fac_emisor enable row level security;
alter table comun_facturacion.fac_certificado enable row level security;
alter table comun_facturacion.fac_secuencial enable row level security;
alter table comun_facturacion.fac_comprobante enable row level security;
alter table comun_facturacion.fac_comprobante_linea enable row level security;
alter table comun_facturacion.fac_evento enable row level security;

-- Solo lectura para sesiones; ninguna política de escritura: todo va por RPC.
create policy fac_emisor_lectura on comun_facturacion.fac_emisor
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(emi_negocio));
create policy fac_certificado_lectura on comun_facturacion.fac_certificado
  for select using (comun_facturacion.fac_fn_es_admin(cer_negocio));
create policy fac_secuencial_lectura on comun_facturacion.fac_secuencial
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(sec_negocio));
create policy fac_comprobante_lectura on comun_facturacion.fac_comprobante
  for select using (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio(cmp_negocio)
    or (cmp_cliente_usuario_id = auth.uid() and cmp_estado in ('AUTORIZADO', 'ANULADO'))
  );
create policy fac_comprobante_linea_lectura on comun_facturacion.fac_comprobante_linea
  for select using (exists (
    select 1 from comun_facturacion.fac_comprobante c where c.cmp_id = lin_comprobante_id
  ));
create policy fac_evento_lectura on comun_facturacion.fac_evento
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(evt_negocio));

create trigger trg_auditoria_fac_emisor after insert or update or delete on comun_facturacion.fac_emisor for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_fac_certificado after insert or update or delete on comun_facturacion.fac_certificado for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_fac_secuencial after insert or update or delete on comun_facturacion.fac_secuencial for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_fac_comprobante after insert or update or delete on comun_facturacion.fac_comprobante for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_fac_comprobante_linea after insert or update or delete on comun_facturacion.fac_comprobante_linea for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_fac_evento after insert or update or delete on comun_facturacion.fac_evento for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant usage on schema comun_facturacion to authenticated, service_role;
grant select on all tables in schema comun_facturacion to authenticated, service_role;
revoke insert, update, delete, truncate on all tables in schema comun_facturacion from authenticated, anon;

-- ═══════════ Utilidades ═══════════
create or replace function comun_facturacion.fac_fn_evento(p_comprobante uuid, p_negocio text, p_tipo text, p_detalle jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into comun_facturacion.fac_evento (evt_comprobante_id, evt_negocio, evt_tipo, evt_detalle_evento, evt_creado_por)
  values (p_comprobante, p_negocio, p_tipo, coalesce(p_detalle, '{}'::jsonb), auth.uid());
$$;

create or replace function comun_facturacion.fac_fn_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', '') = 'aal2';
$$;

-- Módulo 11 con pesos 2..7 de derecha a izquierda; 11 → 0, 10 → 1.
create or replace function comun_facturacion.fac_fn_digito_verificador(p_base text)
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_suma int := 0;
  v_peso int := 2;
  v_dv int;
begin
  for i in reverse length(p_base)..1 loop
    v_suma := v_suma + substr(p_base, i, 1)::int * v_peso;
    v_peso := case when v_peso = 7 then 2 else v_peso + 1 end;
  end loop;
  v_dv := 11 - (v_suma % 11);
  return case v_dv when 11 then 0 when 10 then 1 else v_dv end;
end;
$$;

create or replace function comun_facturacion.fac_fn_clave_acceso(
  p_fecha date, p_tipo text, p_ruc text, p_ambiente smallint,
  p_establecimiento text, p_punto text, p_numero bigint, p_codigo text
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base text;
begin
  v_base := to_char(p_fecha, 'DDMMYYYY') || p_tipo || p_ruc || p_ambiente::text || p_establecimiento
    || p_punto || lpad(p_numero::text, 9, '0') || p_codigo || '1';
  if v_base !~ '^[0-9]{48}$' then
    raise exception 'Datos de la clave de acceso con formato invalido';
  end if;
  return v_base || comun_facturacion.fac_fn_digito_verificador(v_base)::text;
end;
$$;

-- Cédula ecuatoriana: provincia 01-24 o 30, tercer dígito < 6, coeficientes 2-1-2-1…
create or replace function comun_facturacion.fac_fn_cedula_valida(p_cedula text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_suma int := 0;
  v_valor int;
begin
  if p_cedula !~ '^[0-9]{10}$' then return false; end if;
  if substr(p_cedula, 1, 2)::int not between 1 and 24 and substr(p_cedula, 1, 2) <> '30' then return false; end if;
  if substr(p_cedula, 3, 1)::int >= 6 then return false; end if;
  for i in 1..9 loop
    v_valor := substr(p_cedula, i, 1)::int * case when i % 2 = 1 then 2 else 1 end;
    v_suma := v_suma + case when v_valor > 9 then v_valor - 9 else v_valor end;
  end loop;
  return (10 - v_suma % 10) % 10 = substr(p_cedula, 10, 1)::int;
end;
$$;

-- Normaliza y valida el adquirente. Mismas reglas que identificacion.ts.
-- El RUC de sociedades y extranjeros no tiene algoritmo oficial: solo formato.
create or replace function comun_facturacion.fac_fn_normalizar_comprador(p_comprador jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tipo text := btrim(coalesce(p_comprador ->> 'tipo_identificacion', ''));
  v_id text := upper(btrim(coalesce(p_comprador ->> 'identificacion', '')));
  v_razon text := btrim(regexp_replace(coalesce(p_comprador ->> 'razon_social', ''), '\s+', ' ', 'g'));
  v_correo text := nullif(lower(btrim(coalesce(p_comprador ->> 'correo', ''))), '');
begin
  if v_tipo = '07' then
    v_id := '9999999999999';
    v_razon := 'CONSUMIDOR FINAL';
  elsif v_tipo = '05' then
    if not comun_facturacion.fac_fn_cedula_valida(v_id) then raise exception 'Cedula invalida'; end if;
  elsif v_tipo = '04' then
    if v_id !~ '^[0-9]{10}001$' then raise exception 'RUC invalido: deben ser 13 digitos terminados en 001'; end if;
    if substr(v_id, 3, 1)::int < 6 and not comun_facturacion.fac_fn_cedula_valida(left(v_id, 10)) then
      raise exception 'RUC de persona natural invalido';
    end if;
  elsif v_tipo in ('06', '08') then
    if v_id !~ '^[A-Z0-9-]{3,20}$' then raise exception 'Identificacion invalida'; end if;
  else
    raise exception 'Tipo de identificacion invalido';
  end if;

  if v_razon = '' then raise exception 'Falta la razon social del comprador'; end if;
  if v_correo is not null and v_correo !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$' then
    raise exception 'Correo del comprador invalido';
  end if;

  return jsonb_build_object(
    'tipo_identificacion', v_tipo,
    'identificacion', v_id,
    'razon_social', left(v_razon, 300),
    'direccion', nullif(left(btrim(coalesce(p_comprador ->> 'direccion', '')), 300), ''),
    'correo', v_correo,
    'telefono', nullif(left(btrim(coalesce(p_comprador ->> 'telefono', '')), 20), '')
  );
end;
$$;

-- ═══════════ Configuración del emisor (admin del negocio) ═══════════
create or replace function comun_facturacion.fac_fn_guardar_emisor(p_negocio text, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not comun_facturacion.fac_fn_es_admin(p_negocio) then
    raise exception 'No autorizado';
  end if;

  insert into comun_facturacion.fac_emisor as e (
    emi_negocio, emi_ruc, emi_razon_social, emi_nombre_comercial, emi_direccion_matriz,
    emi_direccion_establecimiento, emi_establecimiento, emi_punto_emision, emi_obligado_contabilidad,
    emi_contribuyente_especial, emi_agente_retencion, emi_regimen, emi_emision_automatica, emi_activo,
    emi_correo_copia
  )
  values (
    p_negocio,
    btrim(p_datos ->> 'ruc'),
    btrim(p_datos ->> 'razon_social'),
    nullif(btrim(coalesce(p_datos ->> 'nombre_comercial', '')), ''),
    btrim(p_datos ->> 'direccion_matriz'),
    nullif(btrim(coalesce(p_datos ->> 'direccion_establecimiento', '')), ''),
    coalesce(nullif(p_datos ->> 'establecimiento', ''), '001'),
    coalesce(nullif(p_datos ->> 'punto_emision', ''), '001'),
    coalesce((p_datos ->> 'obligado_contabilidad')::boolean, false),
    nullif(btrim(coalesce(p_datos ->> 'contribuyente_especial', '')), ''),
    nullif(btrim(coalesce(p_datos ->> 'agente_retencion', '')), ''),
    coalesce(nullif(p_datos ->> 'regimen', ''), 'GENERAL'),
    coalesce((p_datos ->> 'emision_automatica')::boolean, false),
    coalesce((p_datos ->> 'activo')::boolean, false),
    nullif(lower(btrim(coalesce(p_datos ->> 'correo_copia', ''))), '')
  )
  on conflict (emi_negocio) do update set
    emi_ruc = excluded.emi_ruc,
    emi_razon_social = excluded.emi_razon_social,
    emi_nombre_comercial = excluded.emi_nombre_comercial,
    emi_direccion_matriz = excluded.emi_direccion_matriz,
    emi_direccion_establecimiento = excluded.emi_direccion_establecimiento,
    emi_establecimiento = excluded.emi_establecimiento,
    emi_punto_emision = excluded.emi_punto_emision,
    emi_obligado_contabilidad = excluded.emi_obligado_contabilidad,
    emi_contribuyente_especial = excluded.emi_contribuyente_especial,
    emi_agente_retencion = excluded.emi_agente_retencion,
    emi_regimen = excluded.emi_regimen,
    emi_emision_automatica = excluded.emi_emision_automatica,
    emi_activo = excluded.emi_activo,
    emi_correo_copia = excluded.emi_correo_copia,
    emi_actualizado_en = now()
  returning emi_id into v_id;

  return v_id;
end;
$$;

-- Superadmin: autoriza (o retira) que un negocio emita en producción.
-- Retirarlo devuelve el emisor a pruebas.
create or replace function comun_facturacion.fac_fn_habilitar_produccion(p_negocio text, p_habilitar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'No autorizado';
  end if;
  update comun_facturacion.fac_emisor
     set emi_produccion_habilitada = p_habilitar,
         emi_ambiente = case when p_habilitar then emi_ambiente else 1 end,
         emi_actualizado_en = now()
   where emi_negocio = p_negocio;
  if not found then
    raise exception 'El negocio no tiene emisor configurado';
  end if;
end;
$$;

-- Admin con MFA: pasa el emisor a producción (2) o lo devuelve a pruebas (1).
create or replace function comun_facturacion.fac_fn_cambiar_ambiente(p_negocio text, p_ambiente smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor comun_facturacion.fac_emisor%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(p_negocio) then
    raise exception 'No autorizado';
  end if;
  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = p_negocio for update;
  if not found then
    raise exception 'El negocio no tiene emisor configurado';
  end if;

  if p_ambiente = 2 then
    if not comun_facturacion.fac_fn_aal2() then
      raise exception 'Se requiere verificacion MFA (aal2) para emitir en produccion';
    end if;
    if not v_emisor.emi_produccion_habilitada then
      raise exception 'Produccion no habilitada para este negocio: la habilita un superadmin';
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_certificado
       where cer_id = v_emisor.emi_certificado_id and cer_activo and cer_valido_hasta > now()
    ) then
      raise exception 'El emisor no tiene un certificado vigente';
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_comprobante
       where cmp_negocio = p_negocio and cmp_ambiente = 1 and cmp_estado = 'AUTORIZADO'
    ) then
      raise exception 'Antes de pasar a produccion hace falta una factura autorizada en pruebas';
    end if;
  elsif p_ambiente <> 1 then
    raise exception 'Ambiente invalido';
  end if;

  update comun_facturacion.fac_emisor
     set emi_ambiente = p_ambiente, emi_actualizado_en = now()
   where emi_negocio = p_negocio;
end;
$$;

-- Admin: numeración previa (si el negocio ya facturaba con otro sistema en este
-- punto de emisión). Solo hacia arriba: bajar reutilizaría números (error 45 del SRI).
create or replace function comun_facturacion.fac_fn_fijar_secuencial(p_negocio text, p_ambiente smallint, p_tipo text, p_ultimo bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor comun_facturacion.fac_emisor%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(p_negocio) then
    raise exception 'No autorizado';
  end if;
  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = p_negocio;
  if not found then
    raise exception 'El negocio no tiene emisor configurado';
  end if;

  insert into comun_facturacion.fac_secuencial as s (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo)
  values (p_negocio, p_ambiente, p_tipo, v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, p_ultimo)
  on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision) do update
    set sec_ultimo = excluded.sec_ultimo, sec_actualizado_en = now()
    where s.sec_ultimo <= excluded.sec_ultimo;
  if not found then
    raise exception 'La numeracion solo puede avanzar';
  end if;
end;
$$;

-- ═══════════ Certificados (los registra la Edge Function facturacion-certificado) ═══════════
-- service_role only: la función ya validó el .p12 y la contraseña, extrajo los
-- metadatos y comprobó el JWT (admin con aal2) del usuario que lo sube.
create or replace function comun_facturacion.fac_fn_registrar_certificado(
  p_negocio text,
  p_usuario uuid,
  p_metadatos jsonb,
  p_p12_base64 text,
  p_clave text,
  p_asignar boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_huella text := upper(p_metadatos ->> 'huella_sha1');
  v_id uuid;
  v_p12 uuid;
  v_clave uuid;
begin
  if not comun_facturacion.fac_fn_usuario_es_admin(p_usuario, p_negocio) then
    raise exception 'No autorizado';
  end if;
  if (p_metadatos ->> 'valido_hasta')::timestamptz <= now() then
    raise exception 'El certificado esta caducado';
  end if;

  select cer_id, cer_p12_secreto_id, cer_clave_secreto_id into v_id, v_p12, v_clave
    from comun_facturacion.fac_certificado
   where cer_negocio = p_negocio and cer_huella_sha1 = v_huella
   for update;

  -- El nombre del secreto es único en vault.secrets: negocio + huella.
  if v_p12 is null then
    v_p12 := vault.create_secret(p_p12_base64, 'fac_p12_' || p_negocio || '_' || v_huella, 'Certificado .p12 SRI de ' || p_negocio);
  else
    perform vault.update_secret(v_p12, p_p12_base64);
  end if;
  if v_clave is null then
    v_clave := vault.create_secret(p_clave, 'fac_clave_' || p_negocio || '_' || v_huella, 'Clave del .p12 SRI de ' || p_negocio);
  else
    perform vault.update_secret(v_clave, p_clave);
  end if;

  insert into comun_facturacion.fac_certificado as c (
    cer_negocio, cer_titular, cer_identificacion, cer_emisor, cer_serial, cer_huella_sha1,
    cer_valido_desde, cer_valido_hasta, cer_cadena_verificada, cer_p12_secreto_id, cer_clave_secreto_id,
    cer_activo, cer_subido_por, cer_detalle_certificado
  )
  values (
    p_negocio, p_metadatos ->> 'titular', p_metadatos ->> 'identificacion', p_metadatos ->> 'emisor',
    p_metadatos ->> 'serial', v_huella, (p_metadatos ->> 'valido_desde')::timestamptz,
    (p_metadatos ->> 'valido_hasta')::timestamptz, (p_metadatos ->> 'cadena_verificada')::boolean,
    v_p12, v_clave, true, p_usuario,
    jsonb_build_object('identificaciones_candidatas', coalesce(p_metadatos -> 'identificaciones_candidatas', '[]'::jsonb))
  )
  on conflict (cer_negocio, cer_huella_sha1) do update set
    cer_p12_secreto_id = excluded.cer_p12_secreto_id,
    cer_clave_secreto_id = excluded.cer_clave_secreto_id,
    cer_activo = true,
    cer_subido_por = excluded.cer_subido_por,
    cer_actualizado_en = now()
  returning cer_id into v_id;

  if p_asignar then
    update comun_facturacion.fac_emisor
       set emi_certificado_id = v_id, emi_actualizado_en = now()
     where emi_negocio = p_negocio;
  end if;
  return v_id;
end;
$$;

-- Admin: desactiva un certificado y borra sus secretos de Vault. Los metadatos
-- se conservan (los comprobantes firmados lo referencian).
create or replace function comun_facturacion.fac_fn_desactivar_certificado(p_negocio text, p_certificado uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cer comun_facturacion.fac_certificado%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(p_negocio) then
    raise exception 'No autorizado';
  end if;
  select * into v_cer from comun_facturacion.fac_certificado
   where cer_id = p_certificado and cer_negocio = p_negocio for update;
  if not found then
    raise exception 'Certificado no encontrado';
  end if;

  update comun_facturacion.fac_emisor
     set emi_certificado_id = null,
         emi_ambiente = 1,
         emi_actualizado_en = now()
   where emi_negocio = p_negocio and emi_certificado_id = p_certificado;
  update comun_facturacion.fac_certificado
     set cer_activo = false, cer_p12_secreto_id = null, cer_clave_secreto_id = null, cer_actualizado_en = now()
   where cer_id = p_certificado;
  delete from vault.secrets where id in (v_cer.cer_p12_secreto_id, v_cer.cer_clave_secreto_id);
end;
$$;

-- service_role only: el .p12 (base64) y su contraseña en claro, para firmar.
create or replace function comun_facturacion.fac_fn_obtener_certificado(p_certificado uuid)
returns table (p12_base64 text, clave text, valido_hasta timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.decrypted_secret, k.decrypted_secret, c.cer_valido_hasta
    from comun_facturacion.fac_certificado c
    join vault.decrypted_secrets p on p.id = c.cer_p12_secreto_id
    join vault.decrypted_secrets k on k.id = c.cer_clave_secreto_id
   where c.cer_id = p_certificado and c.cer_activo;
$$;

-- ═══════════ Comprobantes: creación, emisión y ciclo de vida ═══════════
create or replace function comun_facturacion.fac_fn_crear_comprobante_interno(
  p_negocio text,
  p_tipo text,
  p_comprador jsonb,
  p_lineas jsonb,
  p_formas_pago jsonb,
  p_info_adicional jsonb,
  p_modifica uuid,
  p_motivo text,
  p_cliente_usuario uuid,
  p_transaccion_pago uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_comprador jsonb;
  v_factura comun_facturacion.fac_comprobante%rowtype;
  v_linea jsonb;
  v_orden int := 0;
begin
  if p_tipo not in ('01', '04') then
    raise exception 'Tipo de comprobante invalido';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'El comprobante necesita al menos una linea';
  end if;
  if jsonb_array_length(p_lineas) > 500 then
    raise exception 'Demasiadas lineas';
  end if;
  if jsonb_array_length(coalesce(p_info_adicional, '[]'::jsonb)) > 14 then
    -- 15 como máximo en el XSD; se reserva uno para el correo del comprador.
    raise exception 'Como maximo 14 campos adicionales';
  end if;

  if p_tipo = '04' then
    select * into v_factura from comun_facturacion.fac_comprobante
     where cmp_id = p_modifica and cmp_negocio = p_negocio and cmp_tipo = '01';
    if not found or v_factura.cmp_estado <> 'AUTORIZADO' then
      raise exception 'La nota de credito debe modificar una factura autorizada del negocio';
    end if;
    if v_factura.cmp_fecha_emision < (now() at time zone 'America/Guayaquil')::date - interval '12 months' then
      raise exception 'Han pasado mas de 12 meses desde la emision de la factura';
    end if;
    if v_factura.cmp_comprador ->> 'tipo_identificacion' = '07' then
      raise exception 'Las facturas a consumidor final no admiten nota de credito';
    end if;
    if coalesce(btrim(p_motivo), '') = '' then
      raise exception 'La nota de credito necesita un motivo';
    end if;
    v_comprador := v_factura.cmp_comprador;
  else
    v_comprador := comun_facturacion.fac_fn_normalizar_comprador(p_comprador);
  end if;

  insert into comun_facturacion.fac_comprobante (
    cmp_negocio, cmp_tipo, cmp_comprador, cmp_formas_pago, cmp_info_adicional, cmp_modifica_id,
    cmp_motivo, cmp_cliente_usuario_id, cmp_transaccion_pago_id, cmp_creado_por
  )
  values (
    p_negocio, p_tipo, v_comprador,
    case when p_tipo = '04' then '[]'::jsonb else coalesce(p_formas_pago, '[]'::jsonb) end,
    coalesce(p_info_adicional, '[]'::jsonb), p_modifica, nullif(btrim(p_motivo), ''),
    coalesce(p_cliente_usuario, v_factura.cmp_cliente_usuario_id), p_transaccion_pago, auth.uid()
  )
  returning cmp_id into v_id;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_orden := v_orden + 1;
    insert into comun_facturacion.fac_comprobante_linea (
      lin_comprobante_id, lin_negocio, lin_orden, lin_codigo, lin_codigo_auxiliar, lin_descripcion,
      lin_cantidad, lin_precio_unitario, lin_descuento, lin_codigo_iva, lin_detalle_linea
    )
    values (
      v_id, p_negocio, v_orden,
      left(btrim(v_linea ->> 'codigo'), 25),
      nullif(left(btrim(coalesce(v_linea ->> 'codigo_auxiliar', '')), 25), ''),
      left(btrim(regexp_replace(v_linea ->> 'descripcion', '\s+', ' ', 'g')), 300),
      (v_linea ->> 'cantidad')::numeric,
      (v_linea ->> 'precio_unitario')::numeric,
      coalesce((v_linea ->> 'descuento')::numeric, 0),
      v_linea ->> 'codigo_iva',
      coalesce(v_linea -> 'detalles_adicionales', '[]'::jsonb)
    );
  end loop;

  perform comun_facturacion.fac_fn_evento(v_id, p_negocio, 'creado',
    jsonb_build_object('transaccion_pago', p_transaccion_pago));
  return v_id;
end;
$$;

-- Asigna número y clave de acceso (una sola vez) y deja el comprobante en la cola.
create or replace function comun_facturacion.fac_fn_emitir_interno(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_numero bigint;
  v_fecha date := (now() at time zone 'America/Guayaquil')::date;
  v_codigo text := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
  v_clave text;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_cmp.cmp_estado <> 'BORRADOR' then
    raise exception 'Solo se emite un comprobante en borrador';
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_cmp.cmp_negocio;
  if not found or not v_emisor.emi_activo then
    raise exception 'La facturacion electronica no esta activa para este negocio';
  end if;
  if not exists (
    select 1 from comun_facturacion.fac_certificado
     where cer_id = v_emisor.emi_certificado_id and cer_activo and cer_valido_hasta > now()
  ) then
    raise exception 'El emisor no tiene un certificado de firma vigente';
  end if;
  if v_emisor.emi_ambiente = 2 and not v_emisor.emi_produccion_habilitada then
    raise exception 'Produccion no habilitada para este negocio';
  end if;
  if v_cmp.cmp_tipo = '04' and exists (
    select 1 from comun_facturacion.fac_comprobante f
     where f.cmp_id = v_cmp.cmp_modifica_id and f.cmp_ambiente is distinct from v_emisor.emi_ambiente
  ) then
    raise exception 'La nota de credito debe emitirse en el mismo ambiente que la factura';
  end if;

  insert into comun_facturacion.fac_secuencial as s (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo)
  values (v_cmp.cmp_negocio, v_emisor.emi_ambiente, v_cmp.cmp_tipo, v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, 1)
  on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision)
  do update set sec_ultimo = s.sec_ultimo + 1, sec_actualizado_en = now()
  returning sec_ultimo into v_numero;

  v_clave := comun_facturacion.fac_fn_clave_acceso(
    v_fecha, v_cmp.cmp_tipo, v_emisor.emi_ruc, v_emisor.emi_ambiente,
    v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, v_numero, v_codigo);

  update comun_facturacion.fac_comprobante
     set cmp_estado = 'PENDIENTE',
         cmp_ambiente = v_emisor.emi_ambiente,
         cmp_establecimiento = v_emisor.emi_establecimiento,
         cmp_punto_emision = v_emisor.emi_punto_emision,
         cmp_numero = v_numero,
         cmp_clave_acceso = v_clave,
         cmp_fecha_emision = v_fecha,
         cmp_emitido_en = now(),
         cmp_proximo_intento = now(),
         cmp_actualizado_en = now()
   where cmp_id = p_id;

  perform comun_facturacion.fac_fn_evento(p_id, v_cmp.cmp_negocio, 'emitido',
    jsonb_build_object('numero', v_numero, 'ambiente', v_emisor.emi_ambiente));
  perform comun_facturacion.fac_fn_despertar_worker();
  return v_clave;
end;
$$;

-- Operador/admin del negocio: crea un borrador y, si p_emitir, lo emite en la misma transacción.
create or replace function comun_facturacion.fac_fn_crear_comprobante(
  p_negocio text,
  p_tipo text,
  p_comprador jsonb,
  p_lineas jsonb,
  p_formas_pago jsonb default '[]'::jsonb,
  p_info_adicional jsonb default '[]'::jsonb,
  p_modifica uuid default null,
  p_motivo text default null,
  p_cliente_usuario uuid default null,
  p_emitir boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(p_negocio) then
    raise exception 'No autorizado';
  end if;
  v_id := comun_facturacion.fac_fn_crear_comprobante_interno(
    p_negocio, p_tipo, p_comprador, p_lineas, p_formas_pago, p_info_adicional, p_modifica, p_motivo,
    p_cliente_usuario, null);
  if p_emitir then
    perform comun_facturacion.fac_fn_emitir_interno(v_id);
  end if;
  return v_id;
end;
$$;

create or replace function comun_facturacion.fac_fn_emitir(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text;
begin
  select cmp_negocio into v_negocio from comun_facturacion.fac_comprobante where cmp_id = p_id;
  if v_negocio is null or not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    raise exception 'No autorizado';
  end if;
  return comun_facturacion.fac_fn_emitir_interno(p_id);
end;
$$;

-- Operador/admin: borra un borrador que no se llegó a emitir.
create or replace function comun_facturacion.fac_fn_descartar_borrador(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found or not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_cmp.cmp_negocio) then
    raise exception 'No autorizado';
  end if;
  if v_cmp.cmp_estado <> 'BORRADOR' then
    raise exception 'Solo se descarta un borrador';
  end if;
  delete from comun_facturacion.fac_comprobante where cmp_id = p_id;
end;
$$;

-- Operador/admin: DEVUELTO o ERROR vuelve a la cola con el mismo número y la
-- misma clave (el SRI no la registró). p_comprador corrige los datos del
-- adquirente si ese fue el motivo del rechazo (la clave no los incluye).
create or replace function comun_facturacion.fac_fn_reintentar(p_id uuid, p_comprador jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found or not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_cmp.cmp_negocio) then
    raise exception 'No autorizado';
  end if;
  if v_cmp.cmp_estado not in ('DEVUELTO', 'ERROR') then
    raise exception 'Solo se reintenta un comprobante devuelto o con error';
  end if;
  if p_comprador is not null and v_cmp.cmp_tipo = '04' then
    raise exception 'El comprador de una nota de credito es el de su factura';
  end if;

  update comun_facturacion.fac_comprobante
     set cmp_estado = 'PENDIENTE',
         cmp_comprador = case when p_comprador is null then cmp_comprador
                              else comun_facturacion.fac_fn_normalizar_comprador(p_comprador) end,
         cmp_intentos = 0,
         cmp_proximo_intento = now(),
         cmp_bloqueado_en = null,
         cmp_actualizado_en = now()
   where cmp_id = p_id;
  perform comun_facturacion.fac_fn_evento(p_id, v_cmp.cmp_negocio, 'reintento',
    jsonb_build_object('comprador_corregido', p_comprador is not null));
  perform comun_facturacion.fac_fn_despertar_worker();
end;
$$;

-- Admin: registra una anulación hecha en SRI en Línea (no hay web service;
-- plazo: hasta el día 7 del mes siguiente). Las NC necesitan además la
-- aceptación del receptor; las facturas a consumidor final no se anulan.
create or replace function comun_facturacion.fac_fn_registrar_anulacion(p_id uuid, p_referencia text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found or not comun_facturacion.fac_fn_es_admin(v_cmp.cmp_negocio) then
    raise exception 'No autorizado';
  end if;
  if v_cmp.cmp_estado <> 'AUTORIZADO' then
    raise exception 'Solo se anula un comprobante autorizado';
  end if;
  if v_cmp.cmp_comprador ->> 'tipo_identificacion' = '07' then
    raise exception 'Las facturas a consumidor final no se pueden anular';
  end if;
  if coalesce(btrim(p_referencia), '') = '' then
    raise exception 'Falta el numero de solicitud de anulacion del SRI';
  end if;

  update comun_facturacion.fac_comprobante
     set cmp_estado = 'ANULADO', cmp_anulado_en = now(), cmp_anulacion_referencia = btrim(p_referencia),
         cmp_actualizado_en = now()
   where cmp_id = p_id;
  perform comun_facturacion.fac_fn_evento(p_id, v_cmp.cmp_negocio, 'anulado',
    jsonb_build_object('referencia', btrim(p_referencia)));
end;
$$;

-- ═══════════ Worker (service_role, Edge Function facturacion-sri) ═══════════
-- Reclama un lote con SKIP LOCKED y lo devuelve con todo lo necesario para
-- generar el XML. Un bloqueo de más de 5 minutos se da por abandonado.
create or replace function comun_facturacion.fac_fn_tomar_lote(p_limite int default 5)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidatos as (
    select cmp_id from comun_facturacion.fac_comprobante
     where cmp_estado in ('PENDIENTE', 'RECIBIDO')
       and coalesce(cmp_proximo_intento, '-infinity'::timestamptz) <= now()
       and (cmp_bloqueado_en is null or cmp_bloqueado_en < now() - interval '5 minutes')
     order by cmp_proximo_intento nulls first, cmp_creado_en
     for update skip locked
     limit greatest(1, least(p_limite, 20))
  ), bloqueados as (
    update comun_facturacion.fac_comprobante c
       set cmp_bloqueado_en = now()
      from candidatos
     where c.cmp_id = candidatos.cmp_id
    returning c.*
  )
  select jsonb_build_object(
    'comprobante', to_jsonb(b),
    -- Importes como texto: en JSON serían number y en JS perderían precisión.
    'lineas', (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object(
                   'lin_cantidad', l.lin_cantidad::text,
                   'lin_precio_unitario', l.lin_precio_unitario::text,
                   'lin_descuento', l.lin_descuento::text) order by l.lin_orden), '[]'::jsonb)
                 from comun_facturacion.fac_comprobante_linea l where l.lin_comprobante_id = b.cmp_id),
    'emisor', (select to_jsonb(e) from comun_facturacion.fac_emisor e where e.emi_negocio = b.cmp_negocio),
    'modifica', (select jsonb_build_object(
                   'numero', f.cmp_establecimiento || '-' || f.cmp_punto_emision || '-' || lpad(f.cmp_numero::text, 9, '0'),
                   'fecha_emision', f.cmp_fecha_emision)
                 from comun_facturacion.fac_comprobante f where f.cmp_id = b.cmp_modifica_id),
    'negocio', (select jsonb_build_object('nombre_comercial', n.cfg_nombre_comercial,
                                          'detalle', n.cfg_detalle_configuracion)
                  from comun_configuracion.cfg_negocio n where n.cfg_negocio = b.cmp_negocio)
  )
  from bloqueados b;
end;
$$;

-- Aplica el resultado de una vuelta del worker y libera el bloqueo. Solo
-- columnas de proceso: el número, la clave y los datos del comprobante no se tocan.
create or replace function comun_facturacion.fac_fn_registrar_resultado(
  p_id uuid,
  p_cambios jsonb,
  p_evento text default null,
  p_detalle jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
  v_estado text := coalesce(p_cambios ->> 'estado', null);
  v_linea jsonb;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_cmp.cmp_estado not in ('PENDIENTE', 'RECIBIDO') then
    raise exception 'El comprobante ya no esta en la cola (estado %)', v_cmp.cmp_estado;
  end if;
  if v_estado is not null and v_estado not in ('PENDIENTE', 'RECIBIDO', 'AUTORIZADO', 'DEVUELTO', 'NO_AUTORIZADO', 'ERROR') then
    raise exception 'Estado invalido para el worker: %', v_estado;
  end if;

  update comun_facturacion.fac_comprobante set
    cmp_estado = coalesce(v_estado, cmp_estado),
    cmp_total_sin_impuestos = coalesce((p_cambios ->> 'total_sin_impuestos')::numeric, cmp_total_sin_impuestos),
    cmp_total_descuento = coalesce((p_cambios ->> 'total_descuento')::numeric, cmp_total_descuento),
    cmp_total_iva = coalesce((p_cambios ->> 'total_iva')::numeric, cmp_total_iva),
    cmp_importe_total = coalesce((p_cambios ->> 'importe_total')::numeric, cmp_importe_total),
    cmp_formas_pago = coalesce(p_cambios -> 'formas_pago', cmp_formas_pago),
    cmp_mensajes_sri = coalesce(p_cambios -> 'mensajes_sri', cmp_mensajes_sri),
    cmp_numero_autorizacion = coalesce(p_cambios ->> 'numero_autorizacion', cmp_numero_autorizacion),
    cmp_fecha_autorizacion = coalesce((p_cambios ->> 'fecha_autorizacion')::timestamptz, cmp_fecha_autorizacion),
    cmp_certificado_id = coalesce((p_cambios ->> 'certificado_id')::uuid, cmp_certificado_id),
    cmp_xml_ruta = coalesce(p_cambios ->> 'xml_ruta', cmp_xml_ruta),
    cmp_ride_ruta = coalesce(p_cambios ->> 'ride_ruta', cmp_ride_ruta),
    cmp_intentos = coalesce((p_cambios ->> 'intentos')::int, cmp_intentos),
    cmp_proximo_intento = case when p_cambios ? 'proximo_intento'
                               then (p_cambios ->> 'proximo_intento')::timestamptz else cmp_proximo_intento end,
    cmp_bloqueado_en = null,
    cmp_actualizado_en = now()
  where cmp_id = p_id;

  for v_linea in select value from jsonb_array_elements(coalesce(p_cambios -> 'lineas', '[]'::jsonb)) loop
    update comun_facturacion.fac_comprobante_linea
       set lin_base_imponible = (v_linea ->> 'base')::numeric,
           lin_valor_iva = (v_linea ->> 'valor_iva')::numeric,
           lin_actualizado_en = now()
     where lin_comprobante_id = p_id and lin_orden = (v_linea ->> 'orden')::int;
  end loop;

  if p_evento is not null then
    perform comun_facturacion.fac_fn_evento(p_id, v_cmp.cmp_negocio, p_evento, p_detalle);
  end if;
end;
$$;

-- El correo va después de AUTORIZADO y su fallo no cambia el estado.
create or replace function comun_facturacion.fac_fn_registrar_correo(p_id uuid, p_enviado boolean, p_detalle jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text;
begin
  update comun_facturacion.fac_comprobante
     set cmp_correo_enviado_en = case when p_enviado then now() else cmp_correo_enviado_en end,
         cmp_actualizado_en = now()
   where cmp_id = p_id
  returning cmp_negocio into v_negocio;
  if v_negocio is null then
    raise exception 'Comprobante no encontrado';
  end if;
  perform comun_facturacion.fac_fn_evento(p_id, v_negocio,
    case when p_enviado then 'correo_enviado' else 'correo_fallido' end, p_detalle);
end;
$$;

-- Despierta a la Edge Function si hay trabajo vencido. La URL y la clave
-- compartida viven en Vault ('facturacion_funcion_url', 'facturacion_funcion_clave');
-- sin ellas no hace nada (p. ej. en local). pg_net solo envía tras el commit.
create or replace function comun_facturacion.fac_fn_despertar_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_clave text;
begin
  if not exists (
    select 1 from comun_facturacion.fac_comprobante
     where cmp_estado in ('PENDIENTE', 'RECIBIDO')
       and coalesce(cmp_proximo_intento, '-infinity'::timestamptz) <= now() + interval '5 seconds'
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'facturacion_funcion_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'facturacion_funcion_clave';
  if v_url is null or v_clave is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-facturacion-clave', v_clave),
    body := jsonb_build_object('accion', 'procesar'),
    timeout_milliseconds := 150000
  );
end;
$$;

-- ═══════════ Factura automática al aprobarse un pago (PLT-006 regla 2) ═══════════
-- Nunca rompe la confirmación del pago: cualquier fallo queda en fac_evento y
-- un operador lo resuelve desde el panel.
create or replace function comun_facturacion.fac_fn_facturar_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_detalle jsonb := coalesce(new.pag_detalle_transaccion, '{}'::jsonb);
  v_datos jsonb := v_detalle -> 'datos_facturacion';
  v_variante comun_comercio.com_variante%rowtype;
  v_producto text;
  v_codigo_iva text;
  v_porcentaje numeric;
  v_descripcion text;
  v_codigo text;
  v_lineas jsonb := '[]'::jsonb;
  v_comprador jsonb;
  v_forma text;
  v_info jsonb;
  v_id uuid;
begin
  if new.pag_estado <> 'APROBADO' or old.pag_estado = 'APROBADO' then
    return new;
  end if;
  select * into v_emisor from comun_facturacion.fac_emisor
   where emi_negocio = new.pag_negocio and emi_activo and emi_emision_automatica;
  if not found then
    return new;
  end if;
  if exists (select 1 from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = new.pag_id) then
    return new;
  end if;
  -- Un pago simulado o de una pasarela en sandbox (PLUX de tranqi está en
  -- PRUEBAS y abierto a todos desde el 5-nov-2026) no es una venta real: con
  -- el emisor en producción no se factura.
  if v_emisor.emi_ambiente = 2 and (
    v_detalle ->> 'modo_simulado' = 'true'
    or exists (
      select 1 from comun_comercio.com_pasarela_configuracion
       where psc_negocio = new.pag_negocio and psc_pasarela = new.pag_pasarela and psc_ambiente <> 'PRODUCCION'
    )
  ) then
    insert into comun_facturacion.fac_evento (evt_comprobante_id, evt_negocio, evt_tipo, evt_detalle_evento)
    values (null, new.pag_negocio, 'pago_de_prueba_no_facturado', jsonb_build_object('pago', new.pag_id));
    return new;
  end if;

  begin
    -- Qué se vendió: la variante del catálogo, si el pago la registró.
    if (v_detalle ->> 'variante_id') ~ '^[0-9a-f-]{36}$' then
      select * into v_variante from comun_comercio.com_variante where var_id = (v_detalle ->> 'variante_id')::uuid;
      select pro_nombre into v_producto from comun_comercio.com_producto where pro_id = v_variante.var_producto_id;
    end if;
    v_codigo := coalesce(nullif(v_variante.var_sku, ''), 'PAGO');
    v_descripcion := coalesce(
      nullif(v_detalle ->> 'nombre_servicio', ''),
      nullif(concat_ws(' - ', v_producto, v_variante.var_nombre), ''),
      'Servicio ' || new.pag_negocio);
    v_porcentaje := coalesce(v_variante.var_tarifa_iva_porcentaje, 15);
    v_codigo_iva := case
      when v_variante.var_codigo_impuesto_sri = 'NO_OBJETO' then '6'
      when v_variante.var_codigo_impuesto_sri = 'EXENTO' then '7'
      when v_variante.var_codigo_impuesto_sri = 'IVA_0' or v_porcentaje = 0 then '0'
      when v_porcentaje = 5 then '5'
      when v_porcentaje = 13 then '10'
      else '4' end;

    -- Bases tal como se cobraron: gravada (pag_monto_con_iva) y 0 % (pag_monto_sin_iva).
    if coalesce(new.pag_monto_con_iva, 0) > 0 and v_codigo_iva in ('4', '5', '10') then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
        'precio_unitario', round(new.pag_monto_con_iva, 2), 'descuento', 0, 'codigo_iva', v_codigo_iva));
    end if;
    if coalesce(new.pag_monto_sin_iva, 0) > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
        'precio_unitario', round(new.pag_monto_sin_iva, 2), 'descuento', 0,
        'codigo_iva', case when v_codigo_iva in ('6', '7') then v_codigo_iva else '0' end));
    end if;
    if jsonb_array_length(v_lineas) = 0 then
      -- Sin desglose: base = PVP / (1 + tarifa), redondeada (estándar 05).
      v_lineas := jsonb_build_array(jsonb_build_object(
        'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
        'precio_unitario', case when v_codigo_iva in ('4', '5', '10')
                                then round(new.pag_monto_total / (1 + v_porcentaje / 100), 2)
                                else round(new.pag_monto_total, 2) end,
        'descuento', 0, 'codigo_iva', v_codigo_iva));
    end if;

    if v_datos is not null and coalesce(v_datos ->> 'identificacion', '') <> '' then
      v_comprador := jsonb_build_object(
        'tipo_identificacion', case lower(v_datos ->> 'tipo_identificacion')
                                 when 'ruc' then '04' when 'cedula' then '05' when 'pasaporte' then '06'
                                 else v_datos ->> 'tipo_identificacion' end,
        'identificacion', v_datos ->> 'identificacion',
        'razon_social', v_datos ->> 'razon_social',
        'direccion', v_datos ->> 'direccion',
        'correo', coalesce(nullif(v_datos ->> 'correo_facturacion', ''), new.pag_titular_email),
        'telefono', v_datos ->> 'telefono');
    else
      v_comprador := jsonb_build_object('tipo_identificacion', '07', 'correo', new.pag_titular_email);
    end if;

    v_forma := case
      when new.pag_pasarela in ('DEUNA', 'TRANSFERENCIA') then '20'
      when new.pag_tarjeta_tipo = 'DEBITO' then '16'
      else '19' end;
    v_info := jsonb_build_array(jsonb_build_object('nombre', 'Referencia de pago', 'valor', new.pag_identificador_cliente));

    v_id := comun_facturacion.fac_fn_crear_comprobante_interno(
      new.pag_negocio, '01', v_comprador, v_lineas,
      jsonb_build_array(jsonb_build_object('forma_pago', v_forma, 'total', null)),
      v_info, null, null, new.pag_cliente_id, new.pag_id);

    -- Consumidor final por encima de 50 USD exige identificar al adquirente
    -- (ficha p. 29): queda en borrador para que un operador complete los datos.
    if v_comprador ->> 'tipo_identificacion' = '07' and new.pag_monto_total > 50 then
      perform comun_facturacion.fac_fn_evento(v_id, new.pag_negocio, 'requiere_datos_comprador',
        jsonb_build_object('importe', new.pag_monto_total));
    else
      perform comun_facturacion.fac_fn_emitir_interno(v_id);
    end if;
  exception when others then
    insert into comun_facturacion.fac_evento (evt_comprobante_id, evt_negocio, evt_tipo, evt_detalle_evento)
    values (null, new.pag_negocio, 'facturacion_pago_fallida',
            jsonb_build_object('pago', new.pag_id, 'error', sqlerrm));
  end;
  return new;
end;
$$;

create trigger trg_fac_facturar_pago
  after update of pag_estado on comun_comercio.com_transaccion_pago
  for each row execute function comun_facturacion.fac_fn_facturar_pago();

-- ═══════════ Cron: barrido cada minuto (reintentos y autorizaciones diferidas) ═══════════
select cron.unschedule('facturacion-sri')
where exists (select 1 from cron.job where jobname = 'facturacion-sri');

select cron.schedule('facturacion-sri', '* * * * *', $$select comun_facturacion.fac_fn_despertar_worker();$$);

-- ═══════════ Storage: XML autorizados y RIDE ═══════════
-- Privado y sin borrado desde la app: los comprobantes se conservan 7 años.
-- Rutas: {negocio}/{ambiente}/{aaaa}/{clave}.xml|.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturacion', 'facturacion', false, 5242880, array['application/xml', 'text/xml', 'application/pdf'])
on conflict (id) do nothing;

create policy fac_storage_lectura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'facturacion'
    and (
      comun_seguridad.seg_fn_es_operador_o_admin_negocio(split_part(name, '/', 1))
      or exists (
        select 1 from comun_facturacion.fac_comprobante c
         where c.cmp_cliente_usuario_id = auth.uid()
           and c.cmp_estado in ('AUTORIZADO', 'ANULADO')
           and name in (c.cmp_xml_ruta, c.cmp_ride_ruta)
      )
    )
  );

-- ═══════════ Permisos de ejecución ═══════════
revoke execute on all functions in schema comun_facturacion from public, anon, authenticated;

grant execute on function comun_facturacion.fac_fn_guardar_emisor(text, jsonb) to authenticated;
grant execute on function comun_facturacion.fac_fn_habilitar_produccion(text, boolean) to authenticated;
grant execute on function comun_facturacion.fac_fn_cambiar_ambiente(text, smallint) to authenticated;
grant execute on function comun_facturacion.fac_fn_fijar_secuencial(text, smallint, text, bigint) to authenticated;
grant execute on function comun_facturacion.fac_fn_desactivar_certificado(text, uuid) to authenticated;
grant execute on function comun_facturacion.fac_fn_crear_comprobante(text, text, jsonb, jsonb, jsonb, jsonb, uuid, text, uuid, boolean) to authenticated;
grant execute on function comun_facturacion.fac_fn_emitir(uuid) to authenticated;
grant execute on function comun_facturacion.fac_fn_descartar_borrador(uuid) to authenticated;
grant execute on function comun_facturacion.fac_fn_reintentar(uuid, jsonb) to authenticated;
grant execute on function comun_facturacion.fac_fn_registrar_anulacion(uuid, text) to authenticated;
-- La usa la política RLS de fac_certificado y la interfaz (mostrar u ocultar la configuración).
grant execute on function comun_facturacion.fac_fn_es_admin(text) to authenticated;
-- Utilidades puras que también usa la interfaz (vista previa, validación).
grant execute on function comun_facturacion.fac_fn_cedula_valida(text) to authenticated;
grant execute on function comun_facturacion.fac_fn_digito_verificador(text) to authenticated;
grant execute on function comun_facturacion.fac_fn_clave_acceso(date, text, text, smallint, text, text, bigint, text) to authenticated;

-- Solo la Edge Function (service_role).
grant execute on function comun_facturacion.fac_fn_registrar_certificado(text, uuid, jsonb, text, text, boolean) to service_role;
grant execute on function comun_facturacion.fac_fn_obtener_certificado(uuid) to service_role;
grant execute on function comun_facturacion.fac_fn_tomar_lote(int) to service_role;
grant execute on function comun_facturacion.fac_fn_registrar_resultado(uuid, jsonb, text, jsonb) to service_role;
grant execute on function comun_facturacion.fac_fn_registrar_correo(uuid, boolean, jsonb) to service_role;
grant execute on function comun_facturacion.fac_fn_despertar_worker() to service_role;
