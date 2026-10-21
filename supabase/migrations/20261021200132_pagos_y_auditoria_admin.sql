-- Administración más robusta: registro de pagos, confirmación con vista previa, anulación y auditoría.
--  · `pagos`: una fila por cada pago confirmado (plan, periodo, valor de lista en US$, lo recibido en COP, referencia de Nequi, quién lo confirmó y el estado de la
--    finca ANTES, para poder anularlo). Plataforma, no tenant: solo el superadmin la lee (como `libro_genealogico`); se escribe únicamente con funciones.
--  · `auditoria_admin`: bitácora de solo agregar de lo que hace el superadmin con planes, vigencias y cuentas de pruebas.
--  · Retrocompatible: `admin_activar_plan_finca` conserva su firma (ahora registra el pago sin montos) y `admin_fijar_vigencia_finca` /
--    `admin_marcar_cuenta_pruebas` conservan la suya (ahora auditan).

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid references public.fincas (id) on delete set null,
  finca_nombre text not null,
  propietario_email text not null default '',
  plan text not null,
  plan_antes text not null,
  periodo text not null check (periodo in ('mensual', 'anual')),
  monto_usd numeric(10, 2) check (monto_usd is null or monto_usd >= 0),
  monto_cop numeric(14, 0) check (monto_cop is null or monto_cop > 0),
  referencia text check (referencia is null or char_length(referencia) <= 120),
  vence_antes date,
  vence_despues date not null,
  activada_antes timestamptz,
  confirmado_por uuid references auth.users (id) on delete set null,
  confirmado_por_email text not null default '',
  created_at timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por_email text,
  motivo_anulacion text check (motivo_anulacion is null or char_length(motivo_anulacion) between 5 and 300)
);
create index pagos_finca_creado_idx on public.pagos (finca_id, created_at desc);
create index pagos_creado_idx on public.pagos (created_at desc);
alter table public.pagos enable row level security;
create policy pagos_superadmin_lee on public.pagos for select to authenticated using ((select private.es_admin_plataforma()));
revoke all on public.pagos from anon, authenticated;
grant select on public.pagos to authenticated;

create table public.auditoria_admin (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text not null default '',
  accion text not null,
  finca_id uuid,
  finca_nombre text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index auditoria_admin_creado_idx on public.auditoria_admin (created_at desc);
alter table public.auditoria_admin enable row level security;
create policy auditoria_superadmin_lee on public.auditoria_admin for select to authenticated using ((select private.es_admin_plataforma()));
revoke all on public.auditoria_admin from anon, authenticated;
grant select on public.auditoria_admin to authenticated;

-- Deja una línea en la bitácora a nombre de quien llama (el superadmin). Solo la usan las funciones de abajo.
create function private.auditar(p_accion text, p_finca uuid, p_detalle jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.auditoria_admin (actor_id, actor_email, accion, finca_id, finca_nombre, detalle)
  select auth.uid(), coalesce((select u.email::text from auth.users u where u.id = auth.uid()), ''), p_accion, p_finca,
         (select f.nombre::text from public.fincas f where f.id = p_finca), coalesce(p_detalle, '{}'::jsonb);
end;
$$;

-- Qué pasaría al confirmar un pago: el plan y la vigencia de hoy y los de después, para mostrarlos antes de hacer clic.
create function public.admin_previsualizar_activacion(p_finca uuid, p_plan text, p_periodo text)
returns table (finca_nombre text, correo text, numero_finca integer, plan_actual text, estado text, vence_actual date, vence_nueva date, ultimo_pago_en timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  if p_periodo not in ('mensual', 'anual') then
    raise exception 'El periodo de pago no es válido.';
  end if;
  if private.plan_rango(p_plan) = 0 then
    raise exception 'Ese plan no existe.';
  end if;
  return query
  select f.nombre::text, coalesce(u.email::text, ''),
         (select count(*)::integer from public.fincas f2
            join public.finca_miembros m2 on m2.finca_id = f2.id and m2.user_id = o.user_id and m2.rol = 'propietario'
           where (f2.created_at, f2.id) <= (f.created_at, f.id)),
         f.plan::text, private.estado_plan(f.id), f.plan_vence_en,
         (greatest(coalesce(f.plan_vence_en, v_hoy), v_hoy) + case p_periodo when 'anual' then interval '1 year' else interval '1 month' end)::date,
         (select max(p.created_at) from public.pagos p where p.finca_id = f.id and p.anulado_en is null)
    from public.fincas f
    left join lateral (select m.user_id from public.finca_miembros m where m.finca_id = f.id and m.rol = 'propietario' order by m.created_at limit 1) o on true
    left join auth.users u on u.id = o.user_id
   where f.id = p_finca;
end;
$$;
revoke execute on function public.admin_previsualizar_activacion(uuid, text, text) from public, anon;
grant execute on function public.admin_previsualizar_activacion(uuid, text, text) to authenticated;

-- Confirmar un pago: activa el plan, corre la vigencia, activa la finca si estaba pendiente, registra el pago y audita. Todo o nada.
create function public.admin_confirmar_pago(
  p_finca uuid, p_plan text, p_periodo text default 'mensual',
  p_monto_usd numeric default null, p_monto_cop numeric default null, p_referencia text default null
) returns date
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
  v_f public.fincas%rowtype;
  v_base date;
  v_nueva date;
  v_correo text;
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if p_periodo not in ('mensual', 'anual') then
    raise exception 'El periodo de pago no es válido.';
  end if;
  if p_monto_cop is not null and p_monto_cop <= 0 then
    raise exception 'El monto recibido debe ser mayor que cero.';
  end if;
  if v_ref is not null and char_length(v_ref) > 120 then
    raise exception 'La referencia es muy larga (máximo 120 caracteres).';
  end if;
  select * into v_f from public.fincas f where f.id = p_finca for update;
  if not found then
    raise exception 'No encontramos esa finca.';
  end if;
  -- Contra el doble clic: el mismo pago de la misma finca no se confirma dos veces seguidas.
  if exists (
    select 1 from public.pagos p
     where p.finca_id = p_finca and p.anulado_en is null and p.plan = p_plan and p.periodo = p_periodo and p.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Ese pago ya se confirmó hace un momento.';
  end if;

  v_base := greatest(coalesce(v_f.plan_vence_en, v_hoy), v_hoy);
  v_nueva := (v_base + case p_periodo when 'anual' then interval '1 year' else interval '1 month' end)::date;
  select coalesce(u.email::text, '') into v_correo
    from public.finca_miembros m join auth.users u on u.id = m.user_id
   where m.finca_id = p_finca and m.rol = 'propietario' order by m.created_at limit 1;

  if public.admin_asignar_plan_finca(p_finca, p_plan) < 1 then
    raise exception 'No encontramos esa finca.';
  end if;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas set plan_vence_en = v_nueva, activada_en = coalesce(activada_en, now()) where id = p_finca;
  perform set_config('apriscol.asignando_plan', 'off', true);

  insert into public.pagos (finca_id, finca_nombre, propietario_email, plan, plan_antes, periodo, monto_usd, monto_cop, referencia,
                            vence_antes, vence_despues, activada_antes, confirmado_por, confirmado_por_email)
  values (p_finca, v_f.nombre, coalesce(v_correo, ''), p_plan, v_f.plan, p_periodo, p_monto_usd, p_monto_cop, v_ref,
          v_f.plan_vence_en, v_nueva, v_f.activada_en, auth.uid(), coalesce((select u.email::text from auth.users u where u.id = auth.uid()), ''));
  perform private.auditar('pago_confirmado', p_finca, jsonb_build_object(
    'plan_antes', v_f.plan, 'plan', p_plan, 'periodo', p_periodo, 'vence_antes', v_f.plan_vence_en, 'vence_despues', v_nueva,
    'monto_usd', p_monto_usd, 'monto_cop', p_monto_cop, 'referencia', v_ref));
  return v_nueva;
end;
$$;
revoke execute on function public.admin_confirmar_pago(uuid, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.admin_confirmar_pago(uuid, text, text, numeric, numeric, text) to authenticated;

-- La firma anterior sigue funcionando (el código viejo, mientras Vercel despliega): ahora también deja el pago registrado, sin montos.
create or replace function public.admin_activar_plan_finca(p_finca uuid, p_plan text, p_periodo text default 'mensual') returns date
language plpgsql security definer set search_path = ''
as $$
begin
  return public.admin_confirmar_pago(p_finca, p_plan, p_periodo, null, null, null);
end;
$$;

-- Anular un pago: devuelve plan, vigencia y activación a como estaban antes. Solo el último pago de la finca, y solo si la finca no se tocó a mano después.
-- No revierte una comisión de referidos que ese pago haya generado (se revisa aparte).
create function public.admin_anular_pago(p_pago uuid, p_motivo text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.pagos%rowtype;
  v_f public.fincas%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'Escribe el motivo de la anulación (entre 5 y 300 caracteres).';
  end if;
  select * into v_p from public.pagos p where p.id = p_pago for update;
  if not found then
    raise exception 'No encontramos ese pago.';
  end if;
  if v_p.anulado_en is not null then
    raise exception 'Ese pago ya está anulado.';
  end if;
  if v_p.finca_id is null then
    raise exception 'La finca de este pago ya no existe.';
  end if;
  if exists (
    select 1 from public.pagos p2
     where p2.finca_id = v_p.finca_id and p2.anulado_en is null and (p2.created_at, p2.id) > (v_p.created_at, v_p.id)
  ) then
    raise exception 'Solo se puede anular el último pago de la finca. Anula primero los más recientes.';
  end if;
  select * into v_f from public.fincas f where f.id = v_p.finca_id for update;
  if v_f.plan is distinct from v_p.plan or v_f.plan_vence_en is distinct from v_p.vence_despues then
    raise exception 'La finca cambió después de este pago (plan o fecha editados a mano). Corrígela con «Fijar fecha» en lugar de anular.';
  end if;

  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas set plan = v_p.plan_antes, plan_vence_en = v_p.vence_antes, activada_en = v_p.activada_antes where id = v_p.finca_id;
  perform set_config('apriscol.asignando_plan', 'off', true);

  update public.pagos set anulado_en = now(), motivo_anulacion = v_motivo,
         anulado_por_email = coalesce((select u.email::text from auth.users u where u.id = auth.uid()), '')
   where id = p_pago;
  perform private.auditar('pago_anulado', v_p.finca_id, jsonb_build_object(
    'pago', p_pago, 'motivo', v_motivo, 'plan_restaurado', v_p.plan_antes, 'vence_restaurado', v_p.vence_antes));
end;
$$;
revoke execute on function public.admin_anular_pago(uuid, text) from public, anon;
grant execute on function public.admin_anular_pago(uuid, text) to authenticated;

-- Fijar la fecha a mano también queda en la bitácora.
create or replace function public.admin_fijar_vigencia_finca(p_finca uuid, p_fecha date) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_antes date;
  v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if p_fecha is not null and p_fecha < date '2020-01-01' then
    raise exception 'La fecha no es válida.';
  end if;
  select f.plan_vence_en into v_antes from public.fincas f where f.id = p_finca;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas set plan_vence_en = p_fecha, activada_en = coalesce(activada_en, now()) where id = p_finca;
  get diagnostics v_n = row_count;
  perform set_config('apriscol.asignando_plan', 'off', true);
  if v_n = 0 then
    raise exception 'No encontramos esa finca.';
  end if;
  perform private.auditar('vigencia_fijada', p_finca, jsonb_build_object('vence_antes', v_antes, 'vence_despues', p_fecha));
end;
$$;

-- Marcar o quitar la cuenta de pruebas también queda en la bitácora.
create or replace function public.admin_marcar_cuenta_pruebas(p_correo text, p_exenta boolean) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  update public.perfiles p set exenta_vigencia = coalesce(p_exenta, false)
   where p.id = (select u.id from auth.users u where lower(u.email) = lower(btrim(p_correo)));
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform private.auditar('cuenta_pruebas', null, jsonb_build_object('correo', lower(btrim(p_correo)), 'exenta', coalesce(p_exenta, false)));
  end if;
  return v_n;
end;
$$;

-- Lista de pagos para el panel: con búsqueda por finca o correo (sin LIKE: el texto no se interpreta) y la marca de cuáles se pueden anular.
create function public.admin_listar_pagos(p_buscar text default null, p_desde integer default 0, p_cantidad integer default 20)
returns table (id uuid, finca_id uuid, finca_nombre text, propietario_email text, plan text, plan_antes text, periodo text, monto_usd numeric, monto_cop numeric,
               referencia text, vence_despues date, confirmado_por_email text, created_at timestamptz, anulado_en timestamptz, anulado_por_email text,
               motivo_anulacion text, se_puede_anular boolean, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_t text := lower(btrim(coalesce(p_buscar, '')));
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.id, p.finca_id, p.finca_nombre, p.propietario_email, p.plan, p.plan_antes, p.periodo, p.monto_usd, p.monto_cop, p.referencia, p.vence_despues,
         p.confirmado_por_email, p.created_at, p.anulado_en, p.anulado_por_email, p.motivo_anulacion,
         (p.anulado_en is null and p.finca_id is not null and not exists (
            select 1 from public.pagos p2 where p2.finca_id = p.finca_id and p2.anulado_en is null and (p2.created_at, p2.id) > (p.created_at, p.id))),
         count(*) over ()
    from public.pagos p
   where v_t = '' or position(v_t in lower(p.finca_nombre || ' ' || p.propietario_email)) > 0
   order by p.created_at desc, p.id desc
   offset greatest(coalesce(p_desde, 0), 0) limit least(greatest(coalesce(p_cantidad, 20), 1), 100);
end;
$$;
revoke execute on function public.admin_listar_pagos(text, integer, integer) from public, anon;
grant execute on function public.admin_listar_pagos(text, integer, integer) to authenticated;

-- Bitácora para el panel, de la más reciente a la más antigua.
create function public.admin_listar_auditoria(p_desde integer default 0, p_cantidad integer default 20)
returns table (id bigint, actor_email text, accion text, finca_id uuid, finca_nombre text, detalle jsonb, created_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.actor_email, a.accion, a.finca_id, a.finca_nombre, a.detalle, a.created_at, count(*) over ()
    from public.auditoria_admin a
   order by a.created_at desc, a.id desc
   offset greatest(coalesce(p_desde, 0), 0) limit least(greatest(coalesce(p_cantidad, 20), 1), 100);
end;
$$;
revoke execute on function public.admin_listar_auditoria(integer, integer) from public, anon;
grant execute on function public.admin_listar_auditoria(integer, integer) to authenticated;
