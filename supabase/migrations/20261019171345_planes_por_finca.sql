-- Planes por finca: cada finca tiene su propio plan y paga lo suyo. Se pueden tener todas las fincas que se quiera; una finca nueva empieza en Cría y se mejora
-- desde «Mejorar mi plan». La comisión de referidos solo corre sobre la primera finca que creó la persona referida (la más antigua).
-- Además, el reparto de servicios entre planes cambia: Carne y Contabilidad (compras, ventas, personal y costos) pasan de Hato a Profesional.
-- Retrocompatible: no se quita ninguna función; `admin_asignar_plan(correo, plan)` sigue existiendo para el código anterior, pero la app nueva usa la de por finca.

-- 1) Una finca nueva ya no exige Hacienda ni hereda el plan de otra: empieza en Cría.
create or replace function private.fincas_plan() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.plan := 'cria';
  elsif new.plan is distinct from old.plan and coalesce(current_setting('apriscol.asignando_plan', true), '') <> 'on' then
    raise exception 'El plan solo cambia al mejorarlo desde «Mejorar mi plan».' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- 2) Desde qué plan se incluye cada módulo (espejo de moduloEnPlan en lib/planes.ts): Hato (2) trae corrales, premios, nutrición y ambiente;
-- Profesional (3) trae Carne y Contabilidad.
create or replace function private.modulo_rango(p_modulo public.modulo_app) returns integer
language sql immutable set search_path = ''
as $$
  select case
    when p_modulo in ('carne', 'contabilidad') then 3
    when p_modulo in ('corrales', 'ferias', 'nutricion', 'ambiente') then 2
    else 1
  end;
$$;

-- 3) Activar el plan de UNA finca (no de todas las del propietario). Cierra su solicitud pendiente y, si es la primera finca de una persona que llegó
-- por un enlace de referidos, empieza a correr la comisión (5 % del plan durante 6 meses). Las demás fincas no generan comisión.
create function public.admin_asignar_plan_finca(p_finca uuid, p_plan text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_dueno uuid;
  v_primera uuid;
  v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if private.plan_rango(p_plan) = 0 then
    raise exception 'Ese plan no existe.';
  end if;
  select m.user_id into v_dueno from public.finca_miembros m where m.finca_id = p_finca and m.rol = 'propietario' order by m.created_at limit 1;
  if v_dueno is null then
    raise exception 'No encontramos esa finca.';
  end if;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas f set plan = p_plan where f.id = p_finca;
  get diagnostics v_n = row_count;
  update public.solicitudes_plan s set estado = 'activada', atendida_en = now() where s.estado = 'pendiente' and s.finca_id = p_finca;
  perform set_config('apriscol.asignando_plan', 'off', true);

  select f.id into v_primera
    from public.fincas f
    join public.finca_miembros m on m.finca_id = f.id and m.user_id = v_dueno and m.rol = 'propietario'
   order by f.created_at, f.id
   limit 1;
  if v_n > 0 and v_primera = p_finca then
    insert into public.comisiones_referido (referidor_id, referido_id, finca_id, plan, porcentaje, meses)
    select p.referido_por, p.id, p_finca, p_plan, 5, 6
      from public.perfiles p
     where p.id = v_dueno and p.referido_por is not null and p.referido_por <> p.id
    on conflict (referido_id) do nothing;
  end if;
  return v_n;
end;
$$;
revoke execute on function public.admin_asignar_plan_finca(uuid, text) from public, anon;
grant execute on function public.admin_asignar_plan_finca(uuid, text) to authenticated;

-- 4) Solicitudes pendientes con el id de la finca y su número entre las del propietario (1 = la primera; desde la 2 hay 10 % menos).
create function public.admin_solicitudes_plan()
returns table (id uuid, finca_id uuid, finca text, numero_finca integer, correo text, nombre text, plan_actual text, plan_nuevo text, periodo text, creada_en timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select s.id, s.finca_id, f.nombre::text, (
           select count(*)::integer from public.fincas f2
             join public.finca_miembros m2 on m2.finca_id = f2.id and m2.user_id = s.user_id and m2.rol = 'propietario'
            where (f2.created_at, f2.id) <= (f.created_at, f.id)),
         coalesce(u.email::text, ''), coalesce(p.nombre::text, ''), s.plan_actual, s.plan_nuevo, s.periodo, s.created_at
    from public.solicitudes_plan s
    join public.fincas f on f.id = s.finca_id
    left join auth.users u on u.id = s.user_id
    left join public.perfiles p on p.id = s.user_id
   where s.estado = 'pendiente'
   order by s.created_at
   limit 200;
end;
$$;
revoke execute on function public.admin_solicitudes_plan() from public, anon;
grant execute on function public.admin_solicitudes_plan() to authenticated;
