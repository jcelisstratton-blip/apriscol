-- Planes por servicios (no por número de animales): Cría, Hato, Profesional y Hacienda.
--  · fincas.plan: el plan de cada finca. Las fincas que ya existen conservan todo (Hacienda). Una finca nueva empieza en Cría.
--  · private.puede_ver / puede_escribir: además del rol, el plan debe incluir el módulo (Cría: lo diario; Hato: + corrales, carne,
--    premios y gastos). Así la base, y no solo la pantalla, cierra lo que el plan no incluye.
--  · Equipo con roles desde Hato (disparador en invitaciones) y varias fincas solo con Hacienda (disparador en fincas).
--  · El plan solo cambia por mejora: solicitudes_plan + solicitar_mejora_plan (el propietario, solo hacia adelante) y admin_asignar_plan
--    (superadmin, al confirmarse el pago).

-- (1/3) Columna fincas.plan (las fincas que ya existen quedan en Hacienda; las nuevas empiezan en Cría) y permisos por plan.

alter table public.fincas add column plan text not null default 'hacienda' check (plan in ('cria', 'hato', 'profesional', 'hacienda'));

alter table public.fincas alter column plan set default 'cria';

create function private.plan_rango(p_plan text) returns integer
language sql immutable set search_path = ''
as $$ select case p_plan when 'cria' then 1 when 'hato' then 2 when 'profesional' then 3 when 'hacienda' then 4 else 0 end; $$;

create function private.plan_de(p_finca uuid) returns text
language sql stable security definer set search_path = ''
as $$ select f.plan from public.fincas f where f.id = p_finca; $$;

-- Desde qué plan se incluye cada módulo (1 = Cría, 2 = Hato).
create function private.modulo_rango(p_modulo public.modulo_app) returns integer
language sql immutable set search_path = ''
as $$ select case when p_modulo in ('corrales', 'carne', 'ferias', 'contabilidad', 'nutricion', 'ambiente') then 2 else 1 end; $$;

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
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo);
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
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo);
$$;
