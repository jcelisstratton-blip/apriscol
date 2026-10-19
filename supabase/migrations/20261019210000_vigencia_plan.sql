-- Vigencia del plan de cada finca. Regla de producto:
--  · `plan_vence_en` es el ÚLTIMO día pagado (inclusive). Sin fecha = sin vencimiento registrado: no se bloquea nada (así las fincas de hoy siguen igual
--    hasta que el equipo les fije su fecha).
--  · Faltando 7 días o menos: «por_vencer» (solo aviso). Pasada la fecha: «gracia», 7 días en SOLO LECTURA. Después: «bloqueada»: la app no se puede usar,
--    pero el propietario puede descargar sus datos todas las veces que quiera y pedir la renovación.
--  · El estado no se guarda: sale de la fecha y del día de hoy en Colombia (`private.estado_plan`). La lectura nunca se cierra en la base (la exportación
--    corre con la sesión de la persona y necesita leer); lo que se cierra es la ESCRITURA (`puede_escribir`), y la app bloquea las pantallas.
--  · CUENTA DE PRUEBAS: una cuenta marcada (`perfiles.exenta_vigencia`, solo la cambia el superadmin) no se bloquea nunca, ni ella ni sus fincas (las que ya tiene y las que cree
--    después); un socio de una finca de esa cuenta tampoco. Es temporal y se quita con `admin_marcar_cuenta_pruebas(correo, false)`.
-- Retrocompatible: columna nueva nula, funciones nuevas; `puede_escribir` solo suma una condición que hoy se cumple para todas las fincas.

alter table public.fincas add column plan_vence_en date;

-- Cuenta de pruebas: exenta de toda regla de vigencia. Cada quien edita su perfil, pero no esto (igual que el código de referidos).
alter table public.perfiles add column exenta_vigencia boolean not null default false;
create or replace function private.perfiles_proteger_referidos() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.codigo_referido := old.codigo_referido;
    new.referido_por := old.referido_por;
    new.exenta_vigencia := old.exenta_vigencia;
  end if;
  return new;
end;
$$;

-- La vigencia, como el plan, solo la cambia el equipo al confirmar el pago (nunca el propietario desde su sesión).
create or replace function private.fincas_plan() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.plan := 'cria';
    new.plan_vence_en := null;
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

-- El disparador ahora también vigila la fecha (antes solo se disparaba al cambiar `plan`).
drop trigger fincas_plan_upd on public.fincas;
create trigger fincas_plan_upd before update of plan, plan_vence_en on public.fincas
  for each row execute function private.fincas_plan();

create function private.estado_plan(p_finca uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when f.plan_vence_en is null then 'vigente'
    when exists (
      select 1 from public.finca_miembros m join public.perfiles p on p.id = m.user_id
       where m.finca_id = f.id and m.rol = 'propietario' and p.exenta_vigencia
    ) then 'vigente'
    when (now() at time zone 'America/Bogota')::date > f.plan_vence_en + 7 then 'bloqueada'
    when (now() at time zone 'America/Bogota')::date > f.plan_vence_en then 'gracia'
    when f.plan_vence_en - (now() at time zone 'America/Bogota')::date <= 7 then 'por_vencer'
    else 'vigente'
  end
  from public.fincas f where f.id = p_finca;
$$;

-- Lo que la app consulta para decidir si avisa, deja en solo lectura o bloquea (una sola fuente de verdad, con la exención de las cuentas de pruebas).
-- Solo responde a quien es miembro de la finca.
create function public.estado_vigencia_finca(p_finca uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case when private.es_miembro(p_finca) then private.estado_plan(p_finca) end;
$$;
revoke execute on function public.estado_vigencia_finca(uuid) from public, anon;
grant execute on function public.estado_vigencia_finca(uuid) to authenticated;

-- Escribir exige que el plan esté al día (vigente o por vencer). En gracia y bloqueada solo se lee.
create or replace function private.puede_escribir(p_finca uuid, p_modulo public.modulo_app) returns boolean
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
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo)
  and coalesce(private.estado_plan(p_finca), 'vigente') in ('vigente', 'por_vencer');
$$;

-- El propietario pide renovar el plan que ya tiene (también estando vencido). Si ya había una solicitud de mejora pendiente, se conserva y solo
-- cambia el periodo de pago.
create function public.solicitar_renovacion_plan(p_finca uuid, p_periodo text default 'mensual')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actual text;
begin
  if auth.uid() is null or private.rol_en(p_finca) is distinct from 'propietario' then
    raise exception 'Solo el propietario de la finca puede renovar el plan.' using errcode = 'insufficient_privilege';
  end if;
  if p_periodo not in ('mensual', 'anual') then
    raise exception 'El periodo de pago no es válido.';
  end if;
  select f.plan into v_actual from public.fincas f where f.id = p_finca;
  insert into public.solicitudes_plan (finca_id, user_id, plan_actual, plan_nuevo, periodo)
  values (p_finca, auth.uid(), v_actual, v_actual, p_periodo)
  on conflict (finca_id) where estado = 'pendiente'
  do update set periodo = excluded.periodo, user_id = excluded.user_id, created_at = now();
end;
$$;
revoke execute on function public.solicitar_renovacion_plan(uuid, text) from public, anon;
grant execute on function public.solicitar_renovacion_plan(uuid, text) to authenticated;

-- Superadmin: confirma un pago. Activa el plan (con su comisión de referidos si corresponde) y corre la vigencia un mes o un año a partir del día
-- siguiente a la fecha actual de vencimiento (o de hoy, si ya venció o no tenía). Devuelve la nueva fecha.
create function public.admin_activar_plan_finca(p_finca uuid, p_plan text, p_periodo text default 'mensual')
returns date
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
  update public.fincas set plan_vence_en = v_nueva where id = p_finca;
  perform set_config('apriscol.asignando_plan', 'off', true);
  return v_nueva;
end;
$$;
revoke execute on function public.admin_activar_plan_finca(uuid, text, text) from public, anon;
grant execute on function public.admin_activar_plan_finca(uuid, text, text) to authenticated;

-- Superadmin: fija la fecha de vencimiento a mano (para las fincas que ya existían) o la quita (sin vencimiento).
create function public.admin_fijar_vigencia_finca(p_finca uuid, p_fecha date)
returns void
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
  update public.fincas set plan_vence_en = p_fecha where id = p_finca;
  get diagnostics v_n = row_count;
  perform set_config('apriscol.asignando_plan', 'off', true);
  if v_n = 0 then
    raise exception 'No encontramos esa finca.';
  end if;
end;
$$;
revoke execute on function public.admin_fijar_vigencia_finca(uuid, date) from public, anon;
grant execute on function public.admin_fijar_vigencia_finca(uuid, date) to authenticated;

-- Superadmin: marca o desmarca una cuenta como de pruebas (no se bloquea). Devuelve cuántas cuentas cambió (0 si el correo no existe).
create function public.admin_marcar_cuenta_pruebas(p_correo text, p_exenta boolean)
returns integer
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
  return v_n;
end;
$$;
revoke execute on function public.admin_marcar_cuenta_pruebas(text, boolean) from public, anon;
grant execute on function public.admin_marcar_cuenta_pruebas(text, boolean) to authenticated;

-- Superadmin: vigencia de todas las fincas, las que vencen primero arriba (y si el propietario es una cuenta de pruebas).
create function public.admin_vigencias()
returns table (finca_id uuid, nombre text, propietario_email text, plan text, plan_vence_en date, estado text, cuenta_pruebas boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select f.id, f.nombre::text, coalesce(u.email::text, ''), f.plan::text, f.plan_vence_en, private.estado_plan(f.id), coalesce(p.exenta_vigencia, false)
    from public.fincas f
    left join lateral (select m.user_id from public.finca_miembros m where m.finca_id = f.id and m.rol = 'propietario' order by m.created_at limit 1) o on true
    left join auth.users u on u.id = o.user_id
    left join public.perfiles p on p.id = o.user_id
   order by f.plan_vence_en nulls last, f.created_at
   limit 1000;
end;
$$;
revoke execute on function public.admin_vigencias() from public, anon;
grant execute on function public.admin_vigencias() to authenticated;
