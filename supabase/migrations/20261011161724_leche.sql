-- Producción de leche: lactancias (entidad central), ordeños por jornada, y vistas de producción.
-- Unidades: litros; células somáticas en MILES de células por mililitro (rcs_miles_ml).

create table public.lactancias (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  numero smallint not null check (numero >= 1),
  fecha_parto date not null,
  fecha_secado date,
  parto_id uuid,
  notas text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  unique (animal_id, numero),
  constraint lactancias_secado_ck check (fecha_secado is null or fecha_secado >= fecha_parto),
  constraint lactancias_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  constraint lactancias_parto_fk foreign key (parto_id, finca_id)
    references public.partos (id, finca_id) on delete set null (parto_id)
);
-- Una sola lactancia abierta por animal.
create unique index lactancias_una_abierta_uk on public.lactancias (animal_id) where fecha_secado is null;
create index lactancias_finca_idx on public.lactancias (finca_id, fecha_parto desc);
create trigger lactancias_updated_at before update on public.lactancias
  for each row execute function private.set_updated_at();

create table public.ordenos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  lactancia_id uuid,
  fecha date not null default current_date,
  jornada text not null check (jornada in ('manana', 'tarde', 'noche', 'unico')),
  litros numeric(5, 2) not null check (litros >= 0 and litros <= 15),
  -- Leche que NO va al tanque (retiro por medicamento, mastitis, calostro...).
  descartada boolean not null default false,
  motivo_descarte text check (motivo_descarte in ('retiro', 'mastitis', 'calostro', 'otro')),
  rcs_miles_ml integer check (rcs_miles_ml >= 0),
  grasa_pct numeric(4, 2) check (grasa_pct between 0 and 20),
  proteina_pct numeric(4, 2) check (proteina_pct between 0 and 15),
  cmt text check (cmt in ('negativo', 'traza', '1', '2', '3')),
  observaciones text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordenos_descarte_ck check (descartada = (motivo_descarte is not null)),
  constraint ordenos_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  constraint ordenos_lactancia_fk foreign key (lactancia_id, finca_id)
    references public.lactancias (id, finca_id) on delete set null (lactancia_id),
  unique (animal_id, fecha, jornada)
);
create index ordenos_finca_fecha_idx on public.ordenos (finca_id, fecha desc);
create index ordenos_animal_fecha_idx on public.ordenos (animal_id, fecha desc);
create unique index ordenos_client_req_uk on public.ordenos (finca_id, client_request_id)
  where client_request_id is not null;
create trigger ordenos_updated_at before update on public.ordenos
  for each row execute function private.set_updated_at();

create function private.ordenos_preparar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_sexo public.sexo_animal;
begin
  select sexo into v_sexo from public.animales where id = new.animal_id;
  if v_sexo is distinct from 'hembra' then
    raise exception 'El ordeño debe registrarse sobre una hembra.' using errcode = 'check_violation';
  end if;

  if new.lactancia_id is null then
    select l.id into new.lactancia_id
    from public.lactancias l
    where l.animal_id = new.animal_id
      and l.fecha_parto <= new.fecha
      and (l.fecha_secado is null or l.fecha_secado >= new.fecha)
    order by l.fecha_parto desc
    limit 1;
  end if;

  -- La leche de un animal en retiro nunca entra al tanque.
  if private.en_retiro_leche(new.animal_id, new.fecha) then
    new.descartada := true;
    new.motivo_descarte := coalesce(new.motivo_descarte, 'retiro');
  end if;
  if new.descartada and new.motivo_descarte is null then
    new.motivo_descarte := 'otro';
  end if;
  if not new.descartada and new.motivo_descarte is not null then
    new.descartada := true;
  end if;
  return new;
end;
$$;
create trigger ordenos_preparar before insert or update on public.ordenos
  for each row execute function private.ordenos_preparar();

create function private.lactancias_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_sexo public.sexo_animal;
begin
  select sexo into v_sexo from public.animales where id = new.animal_id;
  if v_sexo is distinct from 'hembra' then
    raise exception 'La lactancia debe registrarse sobre una hembra.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger lactancias_validar before insert or update of animal_id on public.lactancias
  for each row execute function private.lactancias_validar();

-- Un parto (no aborto) de una hembra lechera cierra la lactancia abierta y abre la siguiente.
-- SECURITY DEFINER: el veterinario registra el parto pero no escribe en leche.
create function private.parto_abre_lactancia() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_vocacion public.vocacion_animal;
begin
  if new.tipo = 'aborto' then return new; end if;

  select vocacion into v_vocacion from public.animales where id = new.madre_id;
  if v_vocacion not in ('leche', 'doble') then return new; end if;

  update public.lactancias
  set fecha_secado = greatest(fecha_parto, new.fecha - 1)
  where animal_id = new.madre_id and fecha_secado is null;

  insert into public.lactancias (finca_id, animal_id, numero, fecha_parto, parto_id)
  values (
    new.finca_id, new.madre_id,
    coalesce((select max(numero) from public.lactancias where animal_id = new.madre_id), 0) + 1,
    new.fecha, new.id);
  return new;
end;
$$;
create trigger partos_abre_lactancia after insert on public.partos
  for each row execute function private.parto_abre_lactancia();

-- ───────────────────────── Vistas ─────────────────────────
create view public.v_produccion_diaria with (security_invoker = true) as
select o.finca_id,
       o.animal_id,
       o.fecha,
       o.lactancia_id,
       coalesce(sum(o.litros) filter (where not o.descartada), 0) as litros_tanque,
       coalesce(sum(o.litros) filter (where o.descartada), 0) as litros_descartados,
       sum(o.litros) as litros_total,
       o.fecha - l.fecha_parto as dias_en_leche
from public.ordenos o
left join public.lactancias l on l.id = o.lactancia_id
group by o.finca_id, o.animal_id, o.fecha, o.lactancia_id, l.fecha_parto;

create view public.v_lactancias_resumen with (security_invoker = true) as
select l.id as lactancia_id,
       l.finca_id,
       l.animal_id,
       l.numero,
       l.fecha_parto,
       l.fecha_secado,
       coalesce(l.fecha_secado, current_date) - l.fecha_parto + 1 as dias_lactancia,
       count(d.fecha) as dias_con_registro,
       coalesce(sum(d.litros_total), 0) as litros_total,
       round(coalesce(sum(d.litros_total), 0) / nullif(count(d.fecha), 0), 2) as promedio_diario,
       max(d.litros_total) as pico_diario
from public.lactancias l
left join public.v_produccion_diaria d on d.lactancia_id = l.id
group by l.id;

-- ───────────────────────── RLS ─────────────────────────
select private.crear_politicas_finca('lactancias', 'leche');
select private.crear_politicas_finca('ordenos', 'leche');
