-- Finca adicional: nace «pendiente» y solo se activa cuando el equipo confirma el pago (hoy el pago es manual, por Nequi).
--  · La primera finca de una persona se activa al crearla. Desde la segunda, `activada_en` queda en null → estado «pendiente»:
--    se puede ver pero no escribir (`private.puede_escribir` solo deja 'vigente' y 'por_vencer').
--  · Solo se permite UNA finca pendiente a la vez por propietario.
--  · `activada_en` solo lo cambia el equipo (admin_activar_plan_finca / admin_fijar_vigencia_finca): el propietario no puede autoactivarse.
--  · Las cuentas de pruebas (`perfiles.exenta_vigencia`) no pagan: sus fincas nacen activas.
--  · Retrocompatible: la columna es nueva y las fincas que ya existían quedan activadas con su fecha de creación.

alter table public.fincas add column activada_en timestamptz;
update public.fincas set activada_en = created_at where activada_en is null;

create or replace function private.fincas_plan() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if tg_op = 'INSERT' then
    new.plan := 'cria';
    new.plan_vence_en := null;
    v_user := coalesce(auth.uid(), new.created_by);
    if v_user is not null
       and not coalesce((select p.exenta_vigencia from public.perfiles p where p.id = v_user), false)
       and exists (select 1 from public.finca_miembros m where m.user_id = v_user and m.rol = 'propietario') then
      if exists (
        select 1 from public.finca_miembros m join public.fincas f on f.id = m.finca_id
         where m.user_id = v_user and m.rol = 'propietario' and f.activada_en is null
      ) then
        raise exception 'Ya tienes una finca esperando la confirmación de su pago. Cuando se active, podrás crear otra.' using errcode = 'check_violation';
      end if;
      new.activada_en := null;
    else
      new.activada_en := now();
    end if;
  else
    if coalesce(current_setting('apriscol.asignando_plan', true), '') <> 'on' then
      if new.plan is distinct from old.plan then
        raise exception 'El plan solo cambia al mejorarlo desde «Mejorar mi plan».' using errcode = 'insufficient_privilege';
      end if;
      if new.plan_vence_en is distinct from old.plan_vence_en then
        raise exception 'La vigencia del plan solo la cambia el equipo de Apriscol al confirmar el pago.' using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Nadie activa una finca desde el navegador: solo las funciones del equipo (que marcan `apriscol.asignando_plan`).
create function private.fincas_activada_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.activada_en is distinct from old.activada_en and coalesce(current_setting('apriscol.asignando_plan', true), '') <> 'on' then
    raise exception 'La finca la activa el equipo de Apriscol al confirmar el pago.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger fincas_activada_guard before update of activada_en on public.fincas
  for each row execute function private.fincas_activada_guard();

-- Estado de la finca: «pendiente» (sin pago confirmado) manda sobre la fecha. Una cuenta de pruebas nunca queda pendiente.
create or replace function private.estado_plan(p_finca uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.finca_miembros m join public.perfiles p on p.id = m.user_id
       where m.finca_id = f.id and m.rol = 'propietario' and p.exenta_vigencia
    ) then 'vigente'
    when f.activada_en is null then 'pendiente'
    when f.plan_vence_en is null then 'vigente'
    when (now() at time zone 'America/Bogota')::date > f.plan_vence_en + 7 then 'bloqueada'
    when (now() at time zone 'America/Bogota')::date > f.plan_vence_en then 'gracia'
    when f.plan_vence_en - (now() at time zone 'America/Bogota')::date <= 7 then 'por_vencer'
    else 'vigente'
  end
  from public.fincas f where f.id = p_finca;
$$;

-- Confirmar el pago activa la finca (y corre la vigencia, como siempre).
create or replace function public.admin_activar_plan_finca(p_finca uuid, p_plan text, p_periodo text default 'mensual') returns date
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
  v_base date;
  v_nueva date;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if p_periodo not in ('mensual', 'anual') then
    raise exception 'El periodo de pago no es válido.';
  end if;
  if public.admin_asignar_plan_finca(p_finca, p_plan) < 1 then
    raise exception 'No encontramos esa finca.';
  end if;
  select greatest(coalesce(f.plan_vence_en, v_hoy), v_hoy) into v_base from public.fincas f where f.id = p_finca;
  v_nueva := (v_base + case p_periodo when 'anual' then interval '1 year' else interval '1 month' end)::date;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas set plan_vence_en = v_nueva, activada_en = coalesce(activada_en, now()) where id = p_finca;
  perform set_config('apriscol.asignando_plan', 'off', true);
  return v_nueva;
end;
$$;

create or replace function public.admin_fijar_vigencia_finca(p_finca uuid, p_fecha date) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if p_fecha is not null and p_fecha < date '2020-01-01' then
    raise exception 'La fecha no es válida.';
  end if;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas set plan_vence_en = p_fecha, activada_en = coalesce(activada_en, now()) where id = p_finca;
  get diagnostics v_n = row_count;
  perform set_config('apriscol.asignando_plan', 'off', true);
  if v_n = 0 then
    raise exception 'No encontramos esa finca.';
  end if;
end;
$$;

-- Fincas esperando el pago, las más antiguas primero, con lo que el propietario pidió al pulsar «Ya pagué».
create function public.admin_fincas_por_activar()
returns table (finca_id uuid, nombre text, correo text, numero_finca integer, creada_en timestamptz, periodo text, aviso_pago_en timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select f.id, f.nombre::text, coalesce(u.email::text, ''),
         (select count(*)::integer from public.fincas f2
            join public.finca_miembros m2 on m2.finca_id = f2.id and m2.user_id = o.user_id and m2.rol = 'propietario'
           where (f2.created_at, f2.id) <= (f.created_at, f.id)),
         f.created_at, s.periodo, s.created_at
    from public.fincas f
    left join lateral (select m.user_id from public.finca_miembros m where m.finca_id = f.id and m.rol = 'propietario' order by m.created_at limit 1) o on true
    left join auth.users u on u.id = o.user_id
    left join public.solicitudes_plan s on s.finca_id = f.id and s.estado = 'pendiente'
   where f.activada_en is null
   order by f.created_at
   limit 200;
end;
$$;
revoke execute on function public.admin_fincas_por_activar() from public, anon;
grant execute on function public.admin_fincas_por_activar() to authenticated;
