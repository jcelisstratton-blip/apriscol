-- Reproducción: celos, servicios, diagnósticos de gestación, partos y crías (una fila por cría: gemelos y trillizos).

create table public.celos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  hembra_id uuid not null,
  fecha date not null default current_date,
  observaciones text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint celos_hembra_fk foreign key (hembra_id, finca_id)
    references public.animales (id, finca_id) on delete cascade
);
create index celos_hembra_idx on public.celos (hembra_id, fecha desc);
create trigger celos_updated_at before update on public.celos
  for each row execute function private.set_updated_at();

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  hembra_id uuid not null,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('monta_natural', 'inseminacion', 'transferencia_embrionaria')),
  macho_id uuid,
  macho_externo text,
  semen_lote text,
  responsable text,
  observaciones text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint servicios_hembra_fk foreign key (hembra_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  constraint servicios_macho_fk foreign key (macho_id, finca_id)
    references public.animales (id, finca_id) on delete set null (macho_id)
);
create index servicios_hembra_idx on public.servicios (hembra_id, fecha desc);
create unique index servicios_client_req_uk on public.servicios (finca_id, client_request_id)
  where client_request_id is not null;
create trigger servicios_updated_at before update on public.servicios
  for each row execute function private.set_updated_at();

create table public.diagnosticos_gestacion (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  hembra_id uuid not null,
  servicio_id uuid,
  fecha date not null default current_date,
  metodo text not null default 'ecografia' check (metodo in ('ecografia', 'palpacion', 'otro')),
  resultado text not null check (resultado in ('gestante', 'vacia', 'dudoso')),
  observaciones text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnosticos_hembra_fk foreign key (hembra_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  constraint diagnosticos_servicio_fk foreign key (servicio_id, finca_id)
    references public.servicios (id, finca_id) on delete set null (servicio_id)
);
create index diagnosticos_hembra_idx on public.diagnosticos_gestacion (hembra_id, fecha desc);
create trigger diagnosticos_updated_at before update on public.diagnosticos_gestacion
  for each row execute function private.set_updated_at();

create table public.partos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  madre_id uuid not null,
  servicio_id uuid,
  fecha date not null default current_date,
  tipo text not null default 'normal' check (tipo in ('normal', 'asistido', 'cesarea', 'aborto')),
  numero_crias smallint not null default 1 check (numero_crias between 0 and 8),
  complicaciones text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint partos_madre_fk foreign key (madre_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  constraint partos_servicio_fk foreign key (servicio_id, finca_id)
    references public.servicios (id, finca_id) on delete set null (servicio_id)
);
create index partos_madre_idx on public.partos (madre_id, fecha desc);
create index partos_finca_fecha_idx on public.partos (finca_id, fecha desc);
create unique index partos_client_req_uk on public.partos (finca_id, client_request_id)
  where client_request_id is not null;
create trigger partos_updated_at before update on public.partos
  for each row execute function private.set_updated_at();

create table public.crias (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  parto_id uuid not null,
  -- Animal creado en el hato para esta cría (null si murió al nacer o aún no se registra).
  animal_id uuid,
  sexo public.sexo_animal,
  peso_nacer_kg numeric(4, 2) check (peso_nacer_kg > 0),
  vivo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crias_parto_fk foreign key (parto_id, finca_id)
    references public.partos (id, finca_id) on delete cascade,
  constraint crias_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete set null (animal_id)
);
create index crias_parto_idx on public.crias (parto_id);
create trigger crias_updated_at before update on public.crias
  for each row execute function private.set_updated_at();

-- Sexo correcto de los animales involucrados.
create function private.repro_validar_sexo() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_sexo public.sexo_animal;
begin
  if tg_table_name = 'servicios' then
    select sexo into v_sexo from public.animales where id = new.hembra_id;
    if v_sexo is distinct from 'hembra' then
      raise exception 'El servicio debe registrarse sobre una hembra.' using errcode = 'check_violation';
    end if;
    if new.macho_id is not null then
      select sexo into v_sexo from public.animales where id = new.macho_id;
      if v_sexo is distinct from 'macho' then
        raise exception 'El reproductor debe ser un macho.' using errcode = 'check_violation';
      end if;
    end if;
  elsif tg_table_name = 'partos' then
    select sexo into v_sexo from public.animales where id = new.madre_id;
    if v_sexo is distinct from 'hembra' then
      raise exception 'El parto debe registrarse sobre una hembra.' using errcode = 'check_violation';
    end if;
  else
    select sexo into v_sexo from public.animales where id = new.hembra_id;
    if v_sexo is distinct from 'hembra' then
      raise exception 'El registro debe hacerse sobre una hembra.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger servicios_validar_sexo before insert or update of hembra_id, macho_id on public.servicios
  for each row execute function private.repro_validar_sexo();
create trigger partos_validar_sexo before insert or update of madre_id on public.partos
  for each row execute function private.repro_validar_sexo();
create trigger celos_validar_sexo before insert or update of hembra_id on public.celos
  for each row execute function private.repro_validar_sexo();
create trigger diagnosticos_validar_sexo before insert or update of hembra_id on public.diagnosticos_gestacion
  for each row execute function private.repro_validar_sexo();

-- Servicios con fecha prevista de parto según la especie de la hembra.
create view public.v_servicios with (security_invoker = true) as
select s.*,
       p.gestacion_dias,
       s.fecha + p.gestacion_dias::int as fecha_prevista_parto
from public.servicios s
join public.animales a on a.id = s.hembra_id
join public.parametros_especie p on p.especie = a.especie;

-- ───────────────────────── RLS ─────────────────────────
select private.crear_politicas_finca('celos', 'reproduccion');
select private.crear_politicas_finca('servicios', 'reproduccion');
select private.crear_politicas_finca('diagnosticos_gestacion', 'reproduccion');
select private.crear_politicas_finca('partos', 'reproduccion');
select private.crear_politicas_finca('crias', 'reproduccion');
