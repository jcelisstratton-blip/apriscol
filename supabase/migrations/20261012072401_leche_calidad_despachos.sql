-- Leche: calidad, cadena de frío, despachos y mantenimiento del equipo de ordeño.
-- Todo es del módulo «leche» (lo ve y lo escribe quien ya maneja la leche; borrar es de propietario/administrador).
-- Lo derivado no se guarda: el valor de un despacho es una columna generada; los totales salen de funciones/consultas.

-- ───────────────────────── Análisis de calidad (grasa, proteína, RCS) ─────────────────────────
-- Un análisis es de un animal (animal_id) o de la leche mezclada: tanque o lote (animal_id nulo, `muestra` dice cuál).
-- El CMT de un animal ya vive en Sanidad → Pruebas; aquí no se duplica.
create table public.analisis_leche (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid,
  muestra text check (muestra is null or char_length(btrim(muestra)) between 1 and 80),
  fecha date not null default current_date,
  grasa_pct numeric(4, 2) check (grasa_pct >= 0 and grasa_pct <= 20),
  proteina_pct numeric(4, 2) check (proteina_pct >= 0 and proteina_pct <= 15),
  rcs_miles_ml integer check (rcs_miles_ml >= 0 and rcs_miles_ml <= 100000),
  laboratorio text check (laboratorio is null or char_length(laboratorio) <= 120),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analisis_leche_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  constraint analisis_leche_algo_ck check (grasa_pct is not null or proteina_pct is not null or rcs_miles_ml is not null),
  constraint analisis_leche_muestra_ck check (animal_id is null or muestra is null)
);
create index analisis_leche_finca_fecha_idx on public.analisis_leche (finca_id, fecha desc, created_at desc);
create index analisis_leche_animal_idx on public.analisis_leche (animal_id, fecha desc) where animal_id is not null;
create unique index analisis_leche_client_req_uk on public.analisis_leche (finca_id, client_request_id) where client_request_id is not null;
create trigger analisis_leche_updated_at before update on public.analisis_leche
  for each row execute function private.set_updated_at();

-- ───────────────────────── Cadena de frío ─────────────────────────
create table public.controles_frio (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  fecha date not null default current_date,
  hora time,
  momento text not null check (momento in ('tras_ordeno', 'almacenada', 'despacho')),
  temperatura_c numeric(4, 1) not null check (temperatura_c >= -10 and temperatura_c <= 60),
  equipo text check (equipo is null or char_length(btrim(equipo)) between 1 and 80),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index controles_frio_finca_fecha_idx on public.controles_frio (finca_id, fecha desc, hora desc nulls last);
create unique index controles_frio_client_req_uk on public.controles_frio (finca_id, client_request_id) where client_request_id is not null;
create trigger controles_frio_updated_at before update on public.controles_frio
  for each row execute function private.set_updated_at();

-- ───────────────────────── Despachos de leche ─────────────────────────
create table public.despachos_leche (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  fecha date not null default current_date,
  litros numeric(9, 2) not null check (litros > 0 and litros <= 1000000),
  destino_tipo text not null check (destino_tipo in ('industria', 'queseria', 'venta_directa', 'otro')),
  comprador text check (comprador is null or char_length(btrim(comprador)) between 1 and 120),
  tanque text check (tanque is null or char_length(btrim(tanque)) between 1 and 80),
  guia text check (guia is null or char_length(btrim(guia)) between 1 and 60),
  precio_litro numeric(10, 2) check (precio_litro >= 0 and precio_litro <= 1000000),
  valor_total numeric(14, 2) generated always as (round(litros * precio_litro, 2)) stored,
  temperatura_c numeric(4, 1) check (temperatura_c >= -10 and temperatura_c <= 60),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index despachos_leche_finca_fecha_idx on public.despachos_leche (finca_id, fecha desc, created_at desc);
create unique index despachos_leche_client_req_uk on public.despachos_leche (finca_id, client_request_id) where client_request_id is not null;
create trigger despachos_leche_updated_at before update on public.despachos_leche
  for each row execute function private.set_updated_at();

-- ───────────────────────── Mantenimiento del equipo de ordeño ─────────────────────────
create table public.mantenimiento_ordeno (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('lavado_alcalino', 'lavado_acido', 'presion_vacio', 'pulsadores', 'revision', 'otro')),
  equipo text check (equipo is null or char_length(btrim(equipo)) between 1 and 80),
  presion_kpa numeric(5, 1) check (presion_kpa >= 0 and presion_kpa <= 100),
  responsable text check (responsable is null or char_length(btrim(responsable)) between 1 and 120),
  proxima_fecha date,
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mantenimiento_ordeno_proxima_ck check (proxima_fecha is null or proxima_fecha > fecha)
);
create index mantenimiento_ordeno_finca_fecha_idx on public.mantenimiento_ordeno (finca_id, fecha desc, created_at desc);
create unique index mantenimiento_ordeno_client_req_uk on public.mantenimiento_ordeno (finca_id, client_request_id) where client_request_id is not null;
create trigger mantenimiento_ordeno_updated_at before update on public.mantenimiento_ordeno
  for each row execute function private.set_updated_at();

-- ───────────────────────── RLS y permisos ─────────────────────────
select private.crear_politicas_finca('analisis_leche', 'leche');
select private.crear_politicas_finca('controles_frio', 'leche');
select private.crear_politicas_finca('despachos_leche', 'leche');
select private.crear_politicas_finca('mantenimiento_ordeno', 'leche');

revoke all on public.analisis_leche, public.controles_frio, public.despachos_leche, public.mantenimiento_ordeno from anon;
grant select, insert, update, delete on public.analisis_leche, public.controles_frio, public.despachos_leche, public.mantenimiento_ordeno to authenticated;

-- ───────────────────────── Resumen del periodo: producida vs. despachada ─────────────────────────
-- Modo invoker: respeta RLS. «Producida» es la que entró al tanque (sin la descartada por retiro, mastitis o calostro).
create function public.leche_balance(p_finca uuid, p_desde date, p_hasta date)
returns table (producida numeric, descartada numeric, despachada numeric, valor_despachado numeric)
language plpgsql stable set search_path = ''
as $$
begin
  if p_hasta < p_desde then
    raise exception 'La fecha final no puede ser anterior a la inicial.' using errcode = 'check_violation';
  end if;
  if p_hasta - p_desde > 800 then
    raise exception 'El rango es muy largo (máximo 800 días).' using errcode = 'check_violation';
  end if;
  return query
  select
    coalesce((select sum(o.litros) filter (where not o.descartada) from public.ordenos o where o.finca_id = p_finca and o.fecha between p_desde and p_hasta), 0),
    coalesce((select sum(o.litros) filter (where o.descartada) from public.ordenos o where o.finca_id = p_finca and o.fecha between p_desde and p_hasta), 0),
    coalesce((select sum(d.litros) from public.despachos_leche d where d.finca_id = p_finca and d.fecha between p_desde and p_hasta), 0),
    coalesce((select sum(d.valor_total) from public.despachos_leche d where d.finca_id = p_finca and d.fecha between p_desde and p_hasta), 0);
end;
$$;
revoke execute on function public.leche_balance(uuid, date, date) from public, anon;
grant execute on function public.leche_balance(uuid, date, date) to authenticated;
