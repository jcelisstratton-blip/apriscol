-- Hato: catálogos (razas, parámetros por especie), lotes, animales, bajas y genealogía (endogamia de Wright).

-- ───────────────────────── Catálogos globales (solo lectura) ─────────────────────────
create table public.razas (
  id smallint generated always as identity primary key,
  especie public.especie not null,
  nombre text not null,
  aptitud public.vocacion_animal,
  unique (especie, nombre)
);

insert into public.razas (especie, nombre, aptitud) values
  ('caprino', 'Saanen', 'leche'),
  ('caprino', 'Alpina francesa', 'leche'),
  ('caprino', 'Toggenburg', 'leche'),
  ('caprino', 'Anglonubian', 'doble'),
  ('caprino', 'LaMancha', 'leche'),
  ('caprino', 'Boer', 'carne'),
  ('caprino', 'Criolla', 'doble'),
  ('caprino', 'Cruce', null),
  ('ovino', 'Katahdin', 'carne'),
  ('ovino', 'Dorper', 'carne'),
  ('ovino', 'Pelibuey', 'carne'),
  ('ovino', 'Santa Inés', 'carne'),
  ('ovino', 'Criollo colombiano', 'doble'),
  ('ovino', 'Hampshire', 'carne'),
  ('ovino', 'Cruce', null);

-- Constantes biológicas por especie (editables sin tocar código).
create table public.parametros_especie (
  especie public.especie primary key,
  gestacion_dias smallint not null check (gestacion_dias between 100 and 200),
  ciclo_estral_dias smallint not null check (ciclo_estral_dias between 10 and 30)
);
insert into public.parametros_especie (especie, gestacion_dias, ciclo_estral_dias) values
  ('caprino', 150, 21),
  ('ovino', 147, 17);

alter table public.razas enable row level security;
alter table public.parametros_especie enable row level security;
create policy razas_select on public.razas for select to authenticated using (true);
create policy parametros_especie_select on public.parametros_especie for select to authenticated using (true);

-- ───────────────────────── Lotes (grupos / corrales) ─────────────────────────
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id)
);
create unique index lotes_nombre_uk on public.lotes (finca_id, lower(btrim(nombre)));
create trigger lotes_updated_at before update on public.lotes
  for each row execute function private.set_updated_at();

-- ───────────────────────── Animales ─────────────────────────
create table public.animales (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  especie public.especie not null,
  numero_arete text not null check (char_length(btrim(numero_arete)) between 1 and 40),
  nombre text,
  sexo public.sexo_animal not null,
  raza_id smallint references public.razas (id),
  fecha_nacimiento date,
  fecha_nacimiento_aprox boolean not null default false,
  padre_id uuid,
  madre_id uuid,
  -- Padres que no están en el hato (semental ajeno, pajilla de semen, madre comprada sin registro).
  padre_externo text,
  madre_externa text,
  origen text not null default 'nacido_en_finca' check (origen in ('nacido_en_finca', 'comprado')),
  tipo_parto_origen smallint check (tipo_parto_origen between 1 and 6),
  peso_nacer_kg numeric(4, 2) check (peso_nacer_kg > 0),
  lote_id uuid,
  vocacion public.vocacion_animal not null default 'leche',
  estado text not null default 'activo' check (estado in ('activo', 'vendido', 'sacrificado', 'muerto', 'perdido')),
  fecha_baja date,
  foto_path text,
  notas text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint animales_id_finca_uk unique (id, finca_id),
  constraint animales_padre_fk foreign key (padre_id, finca_id)
    references public.animales (id, finca_id) on delete set null (padre_id),
  constraint animales_madre_fk foreign key (madre_id, finca_id)
    references public.animales (id, finca_id) on delete set null (madre_id),
  constraint animales_lote_fk foreign key (lote_id, finca_id)
    references public.lotes (id, finca_id) on delete set null (lote_id),
  constraint animales_parentesco_ck check (
    (padre_id is null or padre_id <> id)
    and (madre_id is null or madre_id <> id)
    and (padre_id is null or madre_id is null or padre_id <> madre_id)
  ),
  constraint animales_baja_ck check (
    (estado = 'activo' and fecha_baja is null) or (estado <> 'activo' and fecha_baja is not null)
  )
);
create unique index animales_arete_uk on public.animales (finca_id, lower(btrim(numero_arete)))
  where deleted_at is null;
create unique index animales_client_req_uk on public.animales (finca_id, client_request_id)
  where client_request_id is not null;
create index animales_finca_estado_idx on public.animales (finca_id, estado) where deleted_at is null;
create index animales_lote_idx on public.animales (lote_id) where lote_id is not null;
create index animales_padre_idx on public.animales (padre_id) where padre_id is not null;
create index animales_madre_idx on public.animales (madre_id) where madre_id is not null;

create function private.animales_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v record;
begin
  if new.raza_id is not null
     and not exists (select 1 from public.razas where id = new.raza_id and especie = new.especie) then
    raise exception 'La raza no corresponde a la especie del animal.' using errcode = 'check_violation';
  end if;

  if new.padre_id is not null then
    select sexo, especie, fecha_nacimiento into v from public.animales where id = new.padre_id;
    if v.sexo is distinct from 'macho' then
      raise exception 'El padre debe ser un macho.' using errcode = 'check_violation';
    end if;
    if v.especie <> new.especie then
      raise exception 'El padre debe ser de la misma especie.' using errcode = 'check_violation';
    end if;
    if v.fecha_nacimiento is not null and new.fecha_nacimiento is not null
       and v.fecha_nacimiento >= new.fecha_nacimiento then
      raise exception 'El padre debe haber nacido antes que la cría.' using errcode = 'check_violation';
    end if;
  end if;

  if new.madre_id is not null then
    select sexo, especie, fecha_nacimiento into v from public.animales where id = new.madre_id;
    if v.sexo is distinct from 'hembra' then
      raise exception 'La madre debe ser una hembra.' using errcode = 'check_violation';
    end if;
    if v.especie <> new.especie then
      raise exception 'La madre debe ser de la misma especie.' using errcode = 'check_violation';
    end if;
    if v.fecha_nacimiento is not null and new.fecha_nacimiento is not null
       and v.fecha_nacimiento >= new.fecha_nacimiento then
      raise exception 'La madre debe haber nacido antes que la cría.' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;
create trigger animales_validar before insert or update of especie, raza_id, padre_id, madre_id, fecha_nacimiento
  on public.animales for each row execute function private.animales_validar();
create trigger animales_updated_at before update on public.animales
  for each row execute function private.set_updated_at();

-- ───────────────────────── Bajas (venta, sacrificio, muerte, pérdida) ─────────────────────────
create table public.bajas (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  tipo text not null check (tipo in ('venta', 'sacrificio', 'muerte', 'perdida')),
  -- Por qué se decidió sacar al animal (criterio de descarte). Opcional en muerte o pérdida.
  motivo text check (motivo in ('edad', 'partos', 'baja_produccion', 'sanidad', 'reproductivo', 'accidente', 'otro')),
  fecha date not null default current_date,
  destino text,
  comprador text,
  -- La venta es para consumo (frigorífico, carnicería): obliga a respetar el retiro de carne.
  destino_consumo boolean not null default false,
  peso_kg numeric(6, 2) check (peso_kg > 0),
  valor numeric(14, 2) check (valor >= 0),
  guia_movilizacion text,
  detalle text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bajas_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  unique (animal_id)
);
create index bajas_finca_fecha_idx on public.bajas (finca_id, fecha desc);
create trigger bajas_updated_at before update on public.bajas
  for each row execute function private.set_updated_at();

create function private.baja_aplicar() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.animales
    set estado = case new.tipo
          when 'venta' then 'vendido'
          when 'sacrificio' then 'sacrificado'
          when 'muerte' then 'muerto'
          else 'perdido'
        end,
        fecha_baja = new.fecha
    where id = new.animal_id;
    return new;
  else
    update public.animales set estado = 'activo', fecha_baja = null where id = old.animal_id;
    return old;
  end if;
end;
$$;
create trigger bajas_aplicar_insert after insert on public.bajas
  for each row execute function private.baja_aplicar();
create trigger bajas_aplicar_delete after delete on public.bajas
  for each row execute function private.baja_aplicar();

-- ───────────────────────── Genealogía: endogamia de Wright (método tabular) ─────────────────────────
-- Coeficiente de parentesco aditivo a(a,b) entre dos animales, recorriendo hasta p_max_gen generaciones.
-- Ancestros más allá del límite o sin registrar se tratan como fundadores no emparentados (F subestimado:
-- por eso existe completitud_pedigri).
create function private.relacion_aditiva(p_a uuid, p_b uuid, p_max_gen int default 10)
returns double precision
language plpgsql stable set search_path = ''
as $$
declare
  ids uuid[]; sires uuid[]; dams uuid[];
  n int; i int; j int; pos int; pos2 int; passes int := 0; r int; k int;
  sidx int[]; didx int[]; rk int[]; ord int[]; a float8[]; v float8; changed boolean;
begin
  if p_a is null or p_b is null then return 0; end if;

  select array_agg(t.id), array_agg(t.padre_id), array_agg(t.madre_id)
  into ids, sires, dams
  from (
    with recursive anc (id, padre_id, madre_id, g) as (
      select x.id, x.padre_id, x.madre_id, 0
      from public.animales x where x.id in (p_a, p_b)
      union
      select y.id, y.padre_id, y.madre_id, anc.g + 1
      from anc join public.animales y on y.id in (anc.padre_id, anc.madre_id)
      where anc.g < p_max_gen
    )
    select distinct on (id) id, padre_id, madre_id from anc order by id, g
  ) t;

  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then return null; end if;

  sidx := array_fill(0, array[n]);
  didx := array_fill(0, array[n]);
  for i in 1..n loop
    sidx[i] := coalesce(array_position(ids, sires[i]), 0);
    didx[i] := coalesce(array_position(ids, dams[i]), 0);
  end loop;

  -- Rango = 1 + máximo rango de los padres: garantiza procesar padres antes que hijos.
  rk := array_fill(0, array[n]);
  loop
    changed := false;
    for i in 1..n loop
      r := 1 + greatest(
        case when sidx[i] = 0 then 0 else rk[sidx[i]] end,
        case when didx[i] = 0 then 0 else rk[didx[i]] end);
      if r <> rk[i] then rk[i] := r; changed := true; end if;
    end loop;
    exit when not changed;
    passes := passes + 1;
    if passes > n + 1 then
      raise exception 'Se detectó un ciclo en la genealogía.' using errcode = 'check_violation';
    end if;
  end loop;

  select array_agg(x order by rk[x]) into ord from generate_series(1, n) x;

  a := array_fill(0::float8, array[n * n]);
  for pos in 1..n loop
    i := ord[pos];
    for pos2 in 1..pos - 1 loop
      j := ord[pos2];
      v := 0.5 * (
        case when sidx[i] = 0 then 0 else a[(sidx[i] - 1) * n + j] end
        + case when didx[i] = 0 then 0 else a[(didx[i] - 1) * n + j] end);
      a[(i - 1) * n + j] := v;
      a[(j - 1) * n + i] := v;
    end loop;
    a[(i - 1) * n + i] := 1 + case
      when sidx[i] = 0 or didx[i] = 0 then 0
      else 0.5 * a[(sidx[i] - 1) * n + didx[i]]
    end;
  end loop;

  r := array_position(ids, p_a);
  k := array_position(ids, p_b);
  if r is null or k is null then return null; end if;
  return a[(r - 1) * n + k];
end;
$$;

-- F de un animal registrado = 0.5 · a(padre, madre). Sin ambos padres conocidos: 0.
create function public.coef_endogamia(p_animal uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v_padre uuid; v_madre uuid; r double precision;
begin
  select padre_id, madre_id into v_padre, v_madre
  from public.animales where id = p_animal and deleted_at is null;
  if not found then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if v_padre is null or v_madre is null then return 0; end if;
  r := private.relacion_aditiva(v_padre, v_madre);
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

-- F esperado de una cría de la monta macho × hembra, ANTES de hacerla.
create function public.simular_endogamia(p_macho uuid, p_hembra uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  m record; h record; r double precision;
begin
  select id, finca_id, sexo, especie into m from public.animales where id = p_macho and deleted_at is null;
  select id, finca_id, sexo, especie into h from public.animales where id = p_hembra and deleted_at is null;
  if m.id is null or h.id is null then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if m.sexo <> 'macho' or h.sexo <> 'hembra' then
    raise exception 'La simulación requiere un macho y una hembra.' using errcode = 'check_violation';
  end if;
  if m.finca_id <> h.finca_id or m.especie <> h.especie then
    raise exception 'Ambos animales deben ser de la misma finca y especie.' using errcode = 'check_violation';
  end if;
  r := private.relacion_aditiva(p_macho, p_hembra);
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

-- Fracción de ancestros conocidos en las primeras p_generaciones (0 a 1). Con poca completitud, F no es confiable.
create function public.completitud_pedigri(p_animal uuid, p_generaciones int default 4) returns numeric
language sql stable set search_path = ''
as $$
  with recursive s (id, g) as (
    select p_animal, 0
    union all
    select v.x, s.g + 1
    from s
    join public.animales a on a.id = s.id
    cross join lateral (values (a.padre_id), (a.madre_id)) v (x)
    where s.g < p_generaciones
  )
  select round(
    count(*) filter (where id is not null and g between 1 and p_generaciones)::numeric
    / (power(2::numeric, p_generaciones + 1) - 2), 3)
  from s;
$$;

revoke execute on function public.coef_endogamia(uuid), public.simular_endogamia(uuid, uuid),
  public.completitud_pedigri(uuid, int) from public, anon;
grant execute on function public.coef_endogamia(uuid), public.simular_endogamia(uuid, uuid),
  public.completitud_pedigri(uuid, int) to authenticated;

-- ───────────────────────── RLS ─────────────────────────
select private.crear_politicas_finca('lotes', 'hato');
select private.crear_politicas_finca('animales', 'hato');
select private.crear_politicas_finca('bajas', 'hato');
