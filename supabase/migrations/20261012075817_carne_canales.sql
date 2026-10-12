-- Carne: rendimiento en canal de los animales sacrificados. La canal es de un animal con baja por sacrificio (una por animal); si se
-- deshace la baja, la canal se va con ella. El rendimiento (canal ÷ peso vivo) y la merma de oreo salen de la vista, no se guardan.
alter table public.bajas add constraint bajas_animal_tipo_uk unique (animal_id, tipo);

create table public.canales (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  tipo_baja text generated always as ('sacrificio') stored,
  fecha date not null default current_date,
  peso_vivo_kg numeric(5, 1) check (peso_vivo_kg > 0 and peso_vivo_kg <= 250),
  peso_canal_caliente_kg numeric(5, 1) not null check (peso_canal_caliente_kg > 0 and peso_canal_caliente_kg <= 200),
  peso_canal_fria_kg numeric(5, 1) check (peso_canal_fria_kg > 0 and peso_canal_fria_kg <= 200),
  -- Conformación muscular en la escala EUROP (E = excelente … P = pobre) y cobertura de grasa de 1 (muy poca) a 5 (muy alta).
  conformacion text check (conformacion in ('E', 'U', 'R', 'O', 'P')),
  engrasamiento smallint check (engrasamiento between 1 and 5),
  grasa_dorsal_mm numeric(4, 1) check (grasa_dorsal_mm >= 0 and grasa_dorsal_mm <= 40),
  grasa_visceral text check (grasa_visceral in ('baja', 'media', 'alta')),
  planta text check (planta is null or char_length(btrim(planta)) between 1 and 120),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canales_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint canales_baja_fk foreign key (animal_id, tipo_baja) references public.bajas (animal_id, tipo) on delete cascade,
  constraint canales_animal_uk unique (animal_id),
  constraint canales_caliente_ck check (peso_vivo_kg is null or peso_canal_caliente_kg <= peso_vivo_kg),
  constraint canales_fria_ck check (peso_canal_fria_kg is null or peso_canal_fria_kg <= peso_canal_caliente_kg)
);
create index canales_finca_fecha_idx on public.canales (finca_id, fecha desc, created_at desc);
create unique index canales_client_req_uk on public.canales (finca_id, client_request_id) where client_request_id is not null;
create trigger canales_updated_at before update on public.canales for each row execute function private.set_updated_at();

select private.crear_politicas_finca('canales', 'carne');
revoke all on public.canales from anon;
grant select, insert, update, delete on public.canales to authenticated;

create view public.v_canales with (security_invoker = true) as
select c.*,
       round(c.peso_canal_caliente_kg * 100 / c.peso_vivo_kg, 1) as rendimiento_caliente_pct,
       round(c.peso_canal_fria_kg * 100 / c.peso_vivo_kg, 1) as rendimiento_frio_pct,
       round((c.peso_canal_caliente_kg - c.peso_canal_fria_kg) * 100 / c.peso_canal_caliente_kg, 1) as merma_oreo_pct
from public.canales c;
revoke all on public.v_canales from anon;
grant select on public.v_canales to authenticated;
