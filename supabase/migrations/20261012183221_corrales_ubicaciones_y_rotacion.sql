-- Corrales, instalaciones y rotación de animales (guía del aprisco): dónde está cada animal, cuántos caben en cada corral (hacinamiento),
-- la cuarentena de los animales nuevos y la rotación de potreros (días de ocupación y de descanso). Módulo «corrales».
--  · ubicaciones: corrales (bajo techo) y potreros (pastoreo) con su uso, capacidad, piso, agua y reglas de rotación.
--  · movimientos_animales: historial de dónde ha estado cada animal; el que tiene `hasta` nulo es su ubicación actual (una sola por animal).
--  · v_ubicaciones: ocupantes, hacinamiento y estado de rotación (calculados, no guardados). v_cuarentena_alerta: animales en cuarentena o
--    nuevos que aún no pasaron por ella.
--  · mover_animales: cierra la ubicación actual y abre la nueva (o saca de la ubicación) para muchos animales a la vez.

create or replace function private.puede_ver(p_finca uuid, p_modulo public.modulo_app)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('hato', 'leche')
      when 'veterinario' then p_modulo in ('hato', 'genealogia', 'sanidad', 'reproduccion', 'leche', 'carne', 'corrales')
      when 'contador' then p_modulo in ('hato', 'leche', 'carne', 'contabilidad')
      else false
    end, false);
$$;

create or replace function private.puede_escribir(p_finca uuid, p_modulo public.modulo_app)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo = 'leche'
      when 'veterinario' then p_modulo in ('sanidad', 'reproduccion', 'corrales')
      when 'contador' then p_modulo = 'contabilidad'
      else false
    end, false);
$$;

create or replace function private.finca_creada() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.finca_miembros (finca_id, user_id, rol) values (new.id, new.created_by, 'propietario');
    update public.perfiles set finca_activa_id = new.id
      where id = new.created_by and finca_activa_id is null;
  end if;

  insert into public.finca_modulos (finca_id, modulo, activo)
  select new.id, m, m in ('hato', 'genealogia', 'leche', 'sanidad', 'reproduccion', 'ferias', 'corrales')
  from unnest(enum_range(null::public.modulo_app)) as m;
  return new;
end;
$$;

insert into public.finca_modulos (finca_id, modulo, activo)
select f.id, 'corrales', true from public.fincas f
on conflict (finca_id, modulo) do nothing;

create table public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  tipo text not null check (tipo in ('corral', 'potrero')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  uso text not null default 'general' check (uso in ('general', 'ordeno', 'maternidad', 'crias', 'cuarentena', 'alta_produccion', 'secas', 'reproductoras', 'ceba', 'reemplazos')),
  capacidad integer check (capacidad is null or capacidad between 1 and 5000),
  area_m2 numeric(10, 1) check (area_m2 is null or area_m2 > 0),
  piso text check (piso is null or piso in ('elevado', 'emparrillado', 'tierra', 'cemento', 'pasto', 'otro')),
  agua boolean not null default true,
  -- Rotación de potreros: ocupación corta y descanso largo para cortar el ciclo de los parásitos (guía: 3 a 5 días y 30 a 45 días).
  dias_ocupacion_max smallint not null default 5 check (dias_ocupacion_max between 1 and 60),
  dias_descanso_min smallint not null default 35 check (dias_descanso_min between 1 and 180),
  activa boolean not null default true,
  observaciones text check (observaciones is null or char_length(observaciones) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint ubicaciones_corral_capacidad_ck check (tipo <> 'corral' or capacidad is not null)
);
create unique index ubicaciones_nombre_uk on public.ubicaciones (finca_id, lower(btrim(nombre)));
create trigger ubicaciones_updated_at before update on public.ubicaciones for each row execute function private.set_updated_at();

create table public.movimientos_animales (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  ubicacion_id uuid not null,
  desde date not null,
  hasta date,
  motivo text not null default 'traslado' check (motivo in ('ingreso', 'traslado', 'rotacion', 'cuarentena', 'maternidad', 'otro')),
  observaciones text check (observaciones is null or char_length(observaciones) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint movimientos_fechas_ck check (hasta is null or hasta >= desde),
  constraint movimientos_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint movimientos_ubicacion_fk foreign key (ubicacion_id, finca_id) references public.ubicaciones (id, finca_id) on delete restrict
);
-- Cada animal está en una sola ubicación a la vez: la que tiene `hasta` nulo.
create unique index movimientos_actual_uk on public.movimientos_animales (animal_id) where hasta is null;
create index movimientos_ubicacion_idx on public.movimientos_animales (ubicacion_id, hasta);
create index movimientos_finca_fecha_idx on public.movimientos_animales (finca_id, desde desc);

select private.crear_politicas_finca('ubicaciones', 'corrales');
select private.crear_politicas_finca('movimientos_animales', 'corrales');
revoke all on public.ubicaciones, public.movimientos_animales from anon;
grant select, insert, update, delete on public.ubicaciones, public.movimientos_animales to authenticated;

-- Cuando un animal sale del hato (vendido, muerto…), deja la ubicación en la que estaba.
create function private.animal_baja_deja_ubicacion() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.movimientos_animales
     set hasta = greatest(desde, coalesce(new.fecha_baja, (now() at time zone 'America/Bogota')::date))
   where animal_id = new.id and hasta is null;
  return new;
end;
$$;
create trigger animales_baja_ubicacion after update of estado on public.animales
  for each row when (old.estado = 'activo' and new.estado <> 'activo') execute function private.animal_baja_deja_ubicacion();

-- Cada ubicación con sus ocupantes y su estado: hacinada (más animales que su capacidad) y, en potreros, la rotación
-- (ocupado, debe salir si pasó los días de ocupación, en descanso, o lista si ya descansó lo suficiente).
create view public.v_ubicaciones with (security_invoker = true) as
with hoy as (select (now() at time zone 'America/Bogota')::date as d),
actuales as (
  select m.ubicacion_id, count(*)::int as ocupantes, min(m.desde) as ocupado_desde
  from public.movimientos_animales m
  join public.animales a on a.id = m.animal_id and a.finca_id = m.finca_id and a.estado = 'activo' and a.deleted_at is null
  where m.hasta is null
  group by m.ubicacion_id
),
salidas as (
  select ubicacion_id, max(hasta) as ultimo_retiro from public.movimientos_animales where hasta is not null group by ubicacion_id
)
select u.*,
       coalesce(ac.ocupantes, 0) as ocupantes,
       ac.ocupado_desde,
       sa.ultimo_retiro,
       case when ac.ocupantes > 0 then hoy.d - ac.ocupado_desde end as dias_ocupacion,
       case when coalesce(ac.ocupantes, 0) = 0 and sa.ultimo_retiro is not null then hoy.d - sa.ultimo_retiro end as dias_descanso,
       (u.capacidad is not null and coalesce(ac.ocupantes, 0) > u.capacidad) as hacinada,
       case
         when u.tipo = 'corral' then case when coalesce(ac.ocupantes, 0) > 0 then 'ocupado' else 'vacio' end
         when coalesce(ac.ocupantes, 0) > 0 then case when hoy.d - ac.ocupado_desde > u.dias_ocupacion_max then 'debe_salir' else 'ocupado' end
         when sa.ultimo_retiro is null then 'listo'
         when hoy.d - sa.ultimo_retiro >= u.dias_descanso_min then 'listo'
         else 'descanso'
       end as estado
from public.ubicaciones u
cross join hoy
left join actuales ac on ac.ubicacion_id = u.id
left join salidas sa on sa.ubicacion_id = u.id;
revoke all on public.v_ubicaciones from anon;
grant select on public.v_ubicaciones to authenticated;

-- Cuarentena: los animales que están en un corral de cuarentena (con sus días) y los comprados hace menos de 30 días que aún no pasaron por una.
create view public.v_cuarentena_alerta with (security_invoker = true) as
with hoy as (select (now() at time zone 'America/Bogota')::date as d)
select m.finca_id, m.animal_id, 'en_cuarentena'::text as situacion, m.desde, (hoy.d - m.desde)::int as dias, m.ubicacion_id
from public.movimientos_animales m
join public.ubicaciones u on u.id = m.ubicacion_id and u.finca_id = m.finca_id and u.uso = 'cuarentena'
join public.animales a on a.id = m.animal_id and a.finca_id = m.finca_id and a.estado = 'activo' and a.deleted_at is null
cross join hoy
where m.hasta is null
union all
select a.finca_id, a.id, 'falta_cuarentena'::text, (a.created_at at time zone 'America/Bogota')::date, (hoy.d - (a.created_at at time zone 'America/Bogota')::date)::int, null::uuid
from public.animales a
cross join hoy
where a.estado = 'activo' and a.deleted_at is null and a.origen = 'comprado'
  and (a.created_at at time zone 'America/Bogota')::date >= hoy.d - 30
  and not exists (
    select 1 from public.movimientos_animales m
    join public.ubicaciones u on u.id = m.ubicacion_id and u.finca_id = m.finca_id and u.uso = 'cuarentena'
    where m.animal_id = a.id);
revoke all on public.v_cuarentena_alerta from anon;
grant select on public.v_cuarentena_alerta to authenticated;

-- Mover muchos animales a una ubicación (o sacarlos de la que tienen, si no hay destino). Cierra su ubicación actual el día del
-- movimiento y abre la nueva; los que ya están en el destino no cambian. Devuelve cuántos se movieron.
create function public.mover_animales(p_finca uuid, p_ubicacion uuid, p_animales uuid[], p_fecha date, p_motivo text, p_observaciones text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_n integer := 0; v_a uuid; v_actual record;
begin
  if not private.puede_escribir(p_finca, 'corrales') then
    raise exception 'No tienes permiso para mover animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_animales is null or cardinality(p_animales) = 0 then
    raise exception 'Elige al menos un animal.' using errcode = 'check_violation';
  end if;
  if cardinality(p_animales) > 1000 then
    raise exception 'Son demasiados animales a la vez (máximo 1000).' using errcode = 'check_violation';
  end if;
  if p_fecha is null or p_fecha > v_hoy or p_fecha < v_hoy - 366 then
    raise exception 'La fecha del movimiento debe ser de hoy o de hasta un año atrás.' using errcode = 'check_violation';
  end if;
  if p_ubicacion is not null and not exists (select 1 from public.ubicaciones u where u.id = p_ubicacion and u.finca_id = p_finca and u.activa) then
    raise exception 'Esa instalación no existe o está archivada.' using errcode = 'check_violation';
  end if;

  for v_a in select distinct unnest(p_animales) loop
    if not exists (select 1 from public.animales a where a.id = v_a and a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null) then
      raise exception 'Hay un animal que no está activo en esta finca.' using errcode = 'check_violation';
    end if;
    select id, ubicacion_id, desde into v_actual from public.movimientos_animales where animal_id = v_a and hasta is null;
    if found then
      if p_ubicacion is not null and v_actual.ubicacion_id = p_ubicacion then continue; end if;
      if p_fecha < v_actual.desde then
        raise exception 'La fecha no puede ser anterior a la entrada del animal a su ubicación actual (%).', to_char(v_actual.desde, 'DD/MM/YYYY') using errcode = 'check_violation';
      end if;
      update public.movimientos_animales set hasta = p_fecha where id = v_actual.id;
    elsif p_ubicacion is null then
      continue;
    end if;
    if p_ubicacion is not null then
      insert into public.movimientos_animales (finca_id, animal_id, ubicacion_id, desde, motivo, observaciones)
      values (p_finca, v_a, p_ubicacion, p_fecha, coalesce(nullif(p_motivo, ''), 'traslado'), nullif(p_observaciones, ''));
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.mover_animales(uuid, uuid, uuid[], date, text, text) from public, anon;
grant execute on function public.mover_animales(uuid, uuid, uuid[], date, text, text) to authenticated;
