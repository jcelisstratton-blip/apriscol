-- Carne (ceba): pesajes, lotes de ceba, consumo de alimento y los cálculos de ganancia diaria de peso (GDP), conversión alimenticia y
-- animales listos para beneficio. Lo derivado (GDP, conversión, listos) no se guarda: sale de funciones en modo invoker.

-- ───────────────────────── Lotes de ceba ─────────────────────────
create table public.lotes_ceba (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  fecha_inicio date not null default current_date,
  peso_meta_kg numeric(5, 1) check (peso_meta_kg > 0 and peso_meta_kg <= 250),
  cerrado_en date,
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint lotes_ceba_cierre_ck check (cerrado_en is null or cerrado_en >= fecha_inicio)
);
create unique index lotes_ceba_nombre_uk on public.lotes_ceba (finca_id, lower(btrim(nombre)));
create unique index lotes_ceba_client_req_uk on public.lotes_ceba (finca_id, client_request_id) where client_request_id is not null;
create trigger lotes_ceba_updated_at before update on public.lotes_ceba for each row execute function private.set_updated_at();

alter table public.animales add column lote_ceba_id uuid;
alter table public.animales
  add constraint animales_lote_ceba_fk foreign key (lote_ceba_id, finca_id) references public.lotes_ceba (id, finca_id) on delete set null (lote_ceba_id);
create index animales_lote_ceba_idx on public.animales (lote_ceba_id) where lote_ceba_id is not null;

-- ───────────────────────── Pesajes ─────────────────────────
-- El peso al nacer vive en animales.peso_nacer_kg; aquí van el destete, los controles y el peso antes del beneficio.
create table public.pesajes (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  fecha date not null default current_date,
  peso_kg numeric(5, 1) not null check (peso_kg > 0 and peso_kg <= 250),
  tipo text not null default 'control' check (tipo in ('destete', 'control', 'pre_beneficio')),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pesajes_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint pesajes_animal_fecha_uk unique (animal_id, fecha)
);
create index pesajes_finca_fecha_idx on public.pesajes (finca_id, fecha desc, created_at desc);
create unique index pesajes_client_req_uk on public.pesajes (finca_id, client_request_id) where client_request_id is not null;
create trigger pesajes_updated_at before update on public.pesajes for each row execute function private.set_updated_at();

-- ───────────────────────── Consumo de alimento por lote ─────────────────────────
create table public.consumo_lote (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  lote_id uuid not null,
  fecha date not null default current_date,
  kg_alimento numeric(8, 1) not null check (kg_alimento > 0 and kg_alimento <= 100000),
  alimento text check (alimento is null or char_length(btrim(alimento)) between 1 and 80),
  costo numeric(14, 0) check (costo >= 0),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumo_lote_lote_fk foreign key (lote_id, finca_id) references public.lotes_ceba (id, finca_id) on delete cascade
);
create index consumo_lote_lote_idx on public.consumo_lote (lote_id, fecha desc);
create unique index consumo_lote_client_req_uk on public.consumo_lote (finca_id, client_request_id) where client_request_id is not null;
create trigger consumo_lote_updated_at before update on public.consumo_lote for each row execute function private.set_updated_at();

select private.crear_politicas_finca('lotes_ceba', 'carne');
select private.crear_politicas_finca('pesajes', 'carne');
select private.crear_politicas_finca('consumo_lote', 'carne');
revoke all on public.lotes_ceba, public.pesajes, public.consumo_lote from anon;
grant select, insert, update, delete on public.lotes_ceba, public.pesajes, public.consumo_lote to authenticated;

-- ───────────────────────── GDP por animal ─────────────────────────
-- Para cada animal activo con pesajes (o en un lote de ceba): primer y último peso, GDP total y GDP reciente (entre los dos últimos
-- pesos), en gramos por día. El peso al nacer cuenta como primer punto si la fecha de nacimiento es exacta. La GDP solo se calcula
-- con 7 días o más entre los dos pesos: con menos, la báscula pesa más que lo que el animal ganó.
create function public.ceba_animales(p_finca uuid)
returns table (
  animal_id uuid, lote_id uuid, n_pesajes integer,
  peso_primero numeric, fecha_primero date, peso_ultimo numeric, fecha_ultimo date,
  gdp_total_g numeric, gdp_reciente_g numeric
)
language sql stable set search_path = ''
as $$
  with puntos as (
    select p.animal_id, p.fecha, p.peso_kg from public.pesajes p where p.finca_id = p_finca
    union
    select a.id, a.fecha_nacimiento, a.peso_nacer_kg
    from public.animales a
    where a.finca_id = p_finca and a.peso_nacer_kg is not null and a.fecha_nacimiento is not null and not a.fecha_nacimiento_aprox
  ),
  ordenados as (
    select animal_id, fecha, peso_kg,
           row_number() over (partition by animal_id order by fecha asc) as rn_asc,
           row_number() over (partition by animal_id order by fecha desc) as rn_desc
    from puntos
  )
  select a.id, a.lote_ceba_id,
         (select count(*)::int from public.pesajes x where x.animal_id = a.id and x.finca_id = a.finca_id),
         f.peso_kg, f.fecha, u.peso_kg, u.fecha,
         case when u.fecha - f.fecha >= 7 then round((u.peso_kg - f.peso_kg) * 1000 / (u.fecha - f.fecha), 0) end,
         case when u.fecha - s.fecha >= 7 then round((u.peso_kg - s.peso_kg) * 1000 / (u.fecha - s.fecha), 0) end
  from public.animales a
  left join ordenados f on f.animal_id = a.id and f.rn_asc = 1
  left join ordenados u on u.animal_id = a.id and u.rn_desc = 1
  left join ordenados s on s.animal_id = a.id and s.rn_desc = 2
  where a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null
    and (u.animal_id is not null or a.lote_ceba_id is not null)
  order by a.numero_arete;
$$;

-- ───────────────────────── Resumen por lote ─────────────────────────
-- Pesos y ganancia de los animales que hoy están en el lote, desde su primer peso dentro del lote (desde la fecha de inicio).
-- Conversión alimenticia = kg de alimento consumidos desde el inicio ÷ kg ganados por esos animales (se calcula en la pantalla).
create function public.ceba_lotes(p_finca uuid)
returns table (
  lote_id uuid, animales integer, pesados integer, peso_promedio numeric, gdp_g numeric,
  kg_ganados numeric, kg_alimento numeric, costo_alimento numeric, listos integer
)
language sql stable set search_path = ''
as $$
  select l.id,
         count(a.id)::int,
         count(u.peso_kg)::int,
         round(avg(u.peso_kg), 1),
         round(avg(case when u.fecha - pi.fecha >= 7 then (u.peso_kg - pi.peso_kg) * 1000 / (u.fecha - pi.fecha) end), 0),
         coalesce(sum(u.peso_kg - pi.peso_kg) filter (where u.fecha > pi.fecha), 0),
         (select coalesce(sum(c.kg_alimento), 0) from public.consumo_lote c where c.lote_id = l.id and c.finca_id = l.finca_id and c.fecha >= l.fecha_inicio),
         (select coalesce(sum(c.costo), 0) from public.consumo_lote c where c.lote_id = l.id and c.finca_id = l.finca_id and c.fecha >= l.fecha_inicio),
         (count(*) filter (where l.peso_meta_kg is not null and u.peso_kg >= l.peso_meta_kg))::int
  from public.lotes_ceba l
  left join public.animales a on a.lote_ceba_id = l.id and a.finca_id = l.finca_id and a.estado = 'activo' and a.deleted_at is null
  left join lateral (select p.peso_kg, p.fecha from public.pesajes p where p.animal_id = a.id and p.fecha >= l.fecha_inicio order by p.fecha asc limit 1) pi on true
  left join lateral (select p.peso_kg, p.fecha from public.pesajes p where p.animal_id = a.id order by p.fecha desc limit 1) u on true
  where l.finca_id = p_finca
  group by l.id;
$$;

revoke execute on function public.ceba_animales(uuid), public.ceba_lotes(uuid) from public, anon;
grant execute on function public.ceba_animales(uuid), public.ceba_lotes(uuid) to authenticated;
