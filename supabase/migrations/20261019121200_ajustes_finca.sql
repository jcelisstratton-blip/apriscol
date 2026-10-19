-- Ajustes de la finca: umbrales, tiempos y criterios zootécnicos que define el PROPIETARIO de cada finca.
-- Dos capas: los valores de fábrica (estándares zootécnicos de la industria) viven en la propia definición (defaults de columna para lo
-- general; `parametros_especie` para lo que cambia entre ovinos y caprinos) y cada finca guarda su copia, que solo el propietario modifica.
-- Cada finca tiene SIEMPRE su fila (la crea un disparador al nacer la finca y esta migración la crea para las existentes), así que nada
-- repite los valores de fábrica en el código: «restablecer» es volver a `default`.
-- El umbral de endogamia NO se duplica aquí: sigue siendo `fincas.umbral_endogamia`.

-- ───────────────────────── Valores de fábrica por especie ─────────────────────────
-- Antes solo guardaba la gestación; ahora también lo demás que difiere entre ovinos y caprinos. Nulo = el estándar no fija un valor.
alter table public.parametros_especie
  add column gestacion_min smallint,
  add column gestacion_max smallint,
  add column grasa_min_pct numeric(3, 1),
  add column grasa_max_pct numeric(3, 1),
  add column proteina_min_pct numeric(3, 1),
  add column proteina_max_pct numeric(3, 1),
  add column peso_faena_min_kg numeric(4, 1),
  add column peso_faena_max_kg numeric(4, 1);

update public.parametros_especie set
  gestacion_min = 142, gestacion_max = 152,
  grasa_min_pct = 4.0, grasa_max_pct = 6.5,
  proteina_min_pct = 3.5, proteina_max_pct = 5.5,
  peso_faena_min_kg = 40, peso_faena_max_kg = 45
where especie = 'ovino';
-- Caprinos: el estándar solo fija el peso de faena para ovinos de pelo; el de la cabra lo define cada finca.
update public.parametros_especie set
  gestacion_min = 145, gestacion_max = 155,
  grasa_min_pct = 3.5, grasa_max_pct = 5.0,
  proteina_min_pct = 3.0, proteina_max_pct = 4.2
where especie = 'caprino';

alter table public.parametros_especie
  alter column gestacion_min set not null,
  alter column gestacion_max set not null,
  add constraint parametros_especie_gestacion_rango_ck check (gestacion_min <= gestacion_max and gestacion_dias between gestacion_min and gestacion_max);

-- ───────────────────────── Ajustes generales de la finca ─────────────────────────
create table public.finca_ajustes (
  finca_id uuid primary key references public.fincas (id) on delete cascade,

  -- Reproducción
  servicio_edad_min_meses smallint not null default 8 check (servicio_edad_min_meses between 4 and 24),
  servicio_peso_adulto_pct smallint not null default 65 check (servicio_peso_adulto_pct between 40 and 100),
  servicio_cc_min numeric(2, 1) not null default 3.0 check (servicio_cc_min between 1 and 5),
  dx_prenez_dia_desde smallint not null default 35 check (dx_prenez_dia_desde between 15 and 90),
  dx_prenez_dia_hasta smallint not null default 60 check (dx_prenez_dia_hasta between 15 and 120),
  ultimo_tercio_dia smallint not null default 100 check (ultimo_tercio_dia between 60 and 140),

  -- Ceba y carne
  gdp_minima_g smallint not null default 150 check (gdp_minima_g between 0 and 1000),
  cc_venta_min numeric(2, 1) not null default 3.5 check (cc_venta_min between 1 and 5),
  cc_venta_max numeric(2, 1) not null default 4.0 check (cc_venta_max between 1 and 5),

  -- Leche
  ccs_limite_miles_ml integer not null default 500 check (ccs_limite_miles_ml between 50 and 5000),
  secado_dias_antes_parto smallint not null default 60 check (secado_dias_antes_parto between 30 and 90),

  -- Sanidad
  pediluvio_dias smallint not null default 60 check (pediluvio_dias between 7 and 180),
  pediluvio_dias_lluvia smallint not null default 30 check (pediluvio_dias_lluvia between 7 and 180),
  meses_lluvia smallint[] not null default '{4,5,10,11}' check (meses_lluvia <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::smallint[]),
  podologia_inspeccion_dias smallint not null default 182 check (podologia_inspeccion_dias between 30 and 730),
  -- Cada cuántos días se repite la vacuna. Nulo = sin aviso (el estándar no fija una frecuencia).
  vacuna_rabia_dias smallint check (vacuna_rabia_dias between 30 and 1095),
  vacuna_clostridiosis_dias smallint check (vacuna_clostridiosis_dias between 30 and 1095),

  -- Nutrición e inventarios
  ms_mantenimiento_pct numeric(3, 1) not null default 3.0 check (ms_mantenimiento_pct between 1 and 8),
  ms_produccion_min_pct numeric(3, 1) not null default 3.5 check (ms_produccion_min_pct between 1 and 8),
  ms_produccion_max_pct numeric(3, 1) not null default 4.5 check (ms_produccion_max_pct between 1 and 8),
  stock_autonomia_dias smallint not null default 7 check (stock_autonomia_dias between 1 and 90),

  -- Personal y nómina (Colombia): multiplicador sobre el salario o jornal para reflejar las cargas de ley.
  factor_prestacional numeric(4, 2) not null default 1.63 check (factor_prestacional between 1 and 3),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint finca_ajustes_dx_ck check (dx_prenez_dia_desde <= dx_prenez_dia_hasta),
  constraint finca_ajustes_cc_venta_ck check (cc_venta_min <= cc_venta_max),
  constraint finca_ajustes_ms_ck check (ms_mantenimiento_pct <= ms_produccion_min_pct and ms_produccion_min_pct <= ms_produccion_max_pct)
);

-- ───────────────────────── Ajustes por especie ─────────────────────────
-- Una fila por finca y especie. Los valores de fábrica salen de `parametros_especie`.
create table public.finca_ajustes_especie (
  finca_id uuid not null references public.fincas (id) on delete cascade,
  especie public.especie not null,

  gestacion_dias smallint not null,
  -- Peso de una hembra adulta de la finca: base del «porcentaje del peso adulto» para el primer servicio. Nulo = sin definir.
  peso_adulto_hembra_kg numeric(5, 1) check (peso_adulto_hembra_kg between 10 and 150),
  peso_faena_min_kg numeric(4, 1) check (peso_faena_min_kg between 5 and 150),
  peso_faena_max_kg numeric(4, 1) check (peso_faena_max_kg between 5 and 150),
  grasa_min_pct numeric(3, 1) check (grasa_min_pct between 0 and 15),
  grasa_max_pct numeric(3, 1) check (grasa_max_pct between 0 and 15),
  proteina_min_pct numeric(3, 1) check (proteina_min_pct between 0 and 15),
  proteina_max_pct numeric(3, 1) check (proteina_max_pct between 0 and 15),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  primary key (finca_id, especie),
  constraint finca_ajustes_especie_faena_ck check (peso_faena_min_kg is null or peso_faena_max_kg is null or peso_faena_min_kg <= peso_faena_max_kg),
  constraint finca_ajustes_especie_grasa_ck check (grasa_min_pct is null or grasa_max_pct is null or grasa_min_pct <= grasa_max_pct),
  constraint finca_ajustes_especie_proteina_ck check (proteina_min_pct is null or proteina_max_pct is null or proteina_min_pct <= proteina_max_pct)
);

-- La gestación solo se mueve dentro del rango biológico que fija el catálogo de la especie.
create function private.ajustes_especie_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_min smallint;
  v_max smallint;
begin
  select gestacion_min, gestacion_max into v_min, v_max from public.parametros_especie where especie = new.especie;
  if new.gestacion_dias < v_min or new.gestacion_dias > v_max then
    raise exception 'La gestación de % debe estar entre % y % días.', case new.especie when 'ovino' then 'las ovejas' else 'las cabras' end, v_min, v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger finca_ajustes_especie_validar before insert or update on public.finca_ajustes_especie
  for each row execute function private.ajustes_especie_validar();

-- Quién y cuándo cambió el ajuste; la finca y la especie de una fila no se reasignan.
create function private.ajustes_sellar() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.finca_id is distinct from old.finca_id then
      raise exception 'Los ajustes no se pueden pasar a otra finca.' using errcode = 'check_violation';
    end if;
    -- to_jsonb porque `finca_ajustes` no tiene columna `especie` y plpgsql no evalúa a medias.
    if to_jsonb(new) ->> 'especie' is distinct from to_jsonb(old) ->> 'especie' then
      raise exception 'Los ajustes no se pueden pasar a otra especie.' using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger finca_ajustes_sellar before update on public.finca_ajustes
  for each row execute function private.ajustes_sellar();
create trigger finca_ajustes_especie_sellar before update on public.finca_ajustes_especie
  for each row execute function private.ajustes_sellar();

-- ───────────────────────── Filas de cada finca ─────────────────────────
-- Crea (si faltan) los ajustes de una finca con los valores de fábrica. Idempotente.
create function private.ajustes_crear(p_finca uuid) returns void
language sql security definer set search_path = ''
as $$
  insert into public.finca_ajustes (finca_id) values (p_finca) on conflict do nothing;
  insert into public.finca_ajustes_especie (finca_id, especie, gestacion_dias, peso_faena_min_kg, peso_faena_max_kg, grasa_min_pct, grasa_max_pct, proteina_min_pct, proteina_max_pct)
  select p_finca, p.especie, p.gestacion_dias, p.peso_faena_min_kg, p.peso_faena_max_kg, p.grasa_min_pct, p.grasa_max_pct, p.proteina_min_pct, p.proteina_max_pct
  from public.parametros_especie p
  on conflict do nothing;
$$;
revoke execute on function private.ajustes_crear(uuid) from public, anon, authenticated;

create function private.finca_ajustes_nueva() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.ajustes_crear(new.id);
  return new;
end;
$$;
create trigger fincas_ajustes_after_insert after insert on public.fincas
  for each row execute function private.finca_ajustes_nueva();

-- Las fincas que ya existen.
select private.ajustes_crear(id) from public.fincas;

-- Red de seguridad para la aplicación: si por cualquier razón una finca no tuviera sus ajustes, un miembro los puede pedir con los valores de fábrica.
create function public.asegurar_ajustes_finca(p_finca uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.es_miembro(p_finca) then
    raise exception 'No perteneces a esta finca.' using errcode = 'insufficient_privilege';
  end if;
  perform private.ajustes_crear(p_finca);
end;
$$;
revoke execute on function public.asegurar_ajustes_finca(uuid) from public, anon;
grant execute on function public.asegurar_ajustes_finca(uuid) to authenticated;

-- ───────────────────────── Permisos (RLS) ─────────────────────────
-- Son la configuración básica de la finca, no un módulo: la leen todos los miembros (cada rol necesita los umbrales para ver sus avisos)
-- y SOLO el propietario los cambia. Las filas las crea el disparador; nadie las inserta ni las borra desde la aplicación.
alter table public.finca_ajustes enable row level security;
alter table public.finca_ajustes_especie enable row level security;
revoke all on public.finca_ajustes, public.finca_ajustes_especie from anon, authenticated;
grant select, update on public.finca_ajustes, public.finca_ajustes_especie to authenticated;

create policy finca_ajustes_select on public.finca_ajustes for select to authenticated
  using ((select private.es_miembro(finca_id)));
create policy finca_ajustes_update on public.finca_ajustes for update to authenticated
  using ((select private.rol_en(finca_id)) = 'propietario') with check ((select private.rol_en(finca_id)) = 'propietario');
create policy finca_ajustes_especie_select on public.finca_ajustes_especie for select to authenticated
  using ((select private.es_miembro(finca_id)));
create policy finca_ajustes_especie_update on public.finca_ajustes_especie for update to authenticated
  using ((select private.rol_en(finca_id)) = 'propietario') with check ((select private.rol_en(finca_id)) = 'propietario');

-- ───────────────────────── Restablecer un grupo a los valores de fábrica ─────────────────────────
-- Modo invoker: la RLS ya exige ser propietario, así que a otro rol no le cambia ninguna fila y se le avisa.
create function public.restablecer_ajustes_finca(p_finca uuid, p_grupo text) returns void
language plpgsql set search_path = ''
as $$
declare
  v_filas integer;
begin
  case p_grupo
    when 'reproduccion' then
      update public.finca_ajustes set servicio_edad_min_meses = default, servicio_peso_adulto_pct = default, servicio_cc_min = default,
        dx_prenez_dia_desde = default, dx_prenez_dia_hasta = default, ultimo_tercio_dia = default
      where finca_id = p_finca;
      get diagnostics v_filas = row_count;
      update public.finca_ajustes_especie f set gestacion_dias = p.gestacion_dias, peso_adulto_hembra_kg = null
      from public.parametros_especie p where p.especie = f.especie and f.finca_id = p_finca;
    when 'ceba' then
      update public.finca_ajustes set gdp_minima_g = default, cc_venta_min = default, cc_venta_max = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
      update public.finca_ajustes_especie f set peso_faena_min_kg = p.peso_faena_min_kg, peso_faena_max_kg = p.peso_faena_max_kg
      from public.parametros_especie p where p.especie = f.especie and f.finca_id = p_finca;
    when 'leche' then
      update public.finca_ajustes set ccs_limite_miles_ml = default, secado_dias_antes_parto = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
      update public.finca_ajustes_especie f set grasa_min_pct = p.grasa_min_pct, grasa_max_pct = p.grasa_max_pct,
        proteina_min_pct = p.proteina_min_pct, proteina_max_pct = p.proteina_max_pct
      from public.parametros_especie p where p.especie = f.especie and f.finca_id = p_finca;
    when 'sanidad' then
      update public.finca_ajustes set pediluvio_dias = default, pediluvio_dias_lluvia = default, meses_lluvia = default,
        podologia_inspeccion_dias = default, vacuna_rabia_dias = default, vacuna_clostridiosis_dias = default
      where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    when 'nutricion' then
      update public.finca_ajustes set ms_mantenimiento_pct = default, ms_produccion_min_pct = default, ms_produccion_max_pct = default,
        stock_autonomia_dias = default
      where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    when 'personal' then
      update public.finca_ajustes set factor_prestacional = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    else
      raise exception 'Ese grupo de ajustes no existe.' using errcode = 'invalid_parameter_value';
  end case;
  if v_filas = 0 then
    raise exception 'Solo el propietario puede cambiar los ajustes de la finca.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;
revoke execute on function public.restablecer_ajustes_finca(uuid, text) from public, anon;
grant execute on function public.restablecer_ajustes_finca(uuid, text) to authenticated;
