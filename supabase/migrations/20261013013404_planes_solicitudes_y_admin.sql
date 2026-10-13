-- (3/3) Solicitudes de mejora (propietario, solo hacia adelante) y funciones del superadmin para activar el plan.

-- Solicitudes de mejora: el propietario pide pasar a un plan superior; se activa al confirmarse el pago.
create table public.solicitudes_plan (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_actual text not null check (plan_actual in ('cria', 'hato', 'profesional', 'hacienda')),
  plan_nuevo text not null check (plan_nuevo in ('cria', 'hato', 'profesional', 'hacienda')),
  periodo text not null default 'mensual' check (periodo in ('mensual', 'anual')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activada', 'cancelada')),
  created_at timestamptz not null default now(),
  atendida_en timestamptz
);
create unique index solicitudes_plan_pendiente_uk on public.solicitudes_plan (finca_id) where estado = 'pendiente';
alter table public.solicitudes_plan enable row level security;
create policy solicitudes_plan_select on public.solicitudes_plan for select to authenticated
  using (private.rol_en(finca_id) = 'propietario');
revoke insert, update, delete on public.solicitudes_plan from anon, authenticated;
revoke select on public.solicitudes_plan from anon;

create function public.solicitar_mejora_plan(p_finca uuid, p_plan text, p_periodo text default 'mensual')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actual text;
begin
  if auth.uid() is null or private.rol_en(p_finca) is distinct from 'propietario' then
    raise exception 'Solo el propietario de la finca puede mejorar el plan.' using errcode = 'insufficient_privilege';
  end if;
  if p_periodo not in ('mensual', 'anual') then
    raise exception 'El periodo de pago no es válido.';
  end if;
  if private.plan_rango(p_plan) = 0 then
    raise exception 'Ese plan no existe.';
  end if;
  select f.plan into v_actual from public.fincas f where f.id = p_finca;
  if private.plan_rango(p_plan) <= private.plan_rango(v_actual) then
    raise exception 'Solo puedes mejorar hacia un plan superior al tuyo.';
  end if;
  insert into public.solicitudes_plan (finca_id, user_id, plan_actual, plan_nuevo, periodo)
  values (p_finca, auth.uid(), v_actual, p_plan, p_periodo)
  on conflict (finca_id) where estado = 'pendiente'
  do update set plan_nuevo = excluded.plan_nuevo, plan_actual = excluded.plan_actual, periodo = excluded.periodo,
                user_id = excluded.user_id, created_at = now();
end;
$$;
revoke execute on function public.solicitar_mejora_plan(uuid, text, text) from public, anon;
grant execute on function public.solicitar_mejora_plan(uuid, text, text) to authenticated;

-- Superadmin: activa un plan para todas las fincas de las que la persona es propietaria y cierra su solicitud pendiente.
create function public.admin_asignar_plan(p_correo text, p_plan text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if private.plan_rango(p_plan) = 0 then
    raise exception 'Ese plan no existe.';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_correo));
  if v_user is null then
    raise exception 'No hay una cuenta con ese correo.';
  end if;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas f set plan = p_plan
  where f.id in (select m.finca_id from public.finca_miembros m where m.user_id = v_user and m.rol = 'propietario');
  get diagnostics v_n = row_count;
  update public.solicitudes_plan s set estado = 'activada', atendida_en = now()
  where s.estado = 'pendiente' and s.finca_id in (select m.finca_id from public.finca_miembros m where m.user_id = v_user and m.rol = 'propietario');
  perform set_config('apriscol.asignando_plan', 'off', true);
  return v_n;
end;
$$;
revoke execute on function public.admin_asignar_plan(text, text) from public, anon;
grant execute on function public.admin_asignar_plan(text, text) to authenticated;

create function public.admin_listar_solicitudes_plan()
returns table (id uuid, finca text, correo text, nombre text, plan_actual text, plan_nuevo text, periodo text, creada_en timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select s.id, f.nombre::text, coalesce(u.email::text, ''), coalesce(p.nombre::text, ''), s.plan_actual, s.plan_nuevo, s.periodo, s.created_at
  from public.solicitudes_plan s
  join public.fincas f on f.id = s.finca_id
  left join auth.users u on u.id = s.user_id
  left join public.perfiles p on p.id = s.user_id
  where s.estado = 'pendiente'
  order by s.created_at
  limit 200;
end;
$$;
revoke execute on function public.admin_listar_solicitudes_plan() from public, anon;
grant execute on function public.admin_listar_solicitudes_plan() to authenticated;
