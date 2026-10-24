-- Proyecciones: el módulo del propietario y el administrador para simular el hato, el alimento y el dinero a 12-36 meses.
-- Se guardan solo los AJUSTES de la persona (lo que cambió frente a los valores de su finca); los demás se recalculan con datos al día.

-- 1. El módulo entra desde el plan Profesional (espejo: lib/planes.ts#moduloEnPlan).
create or replace function private.modulo_rango(p_modulo public.modulo_app)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_modulo in ('carne', 'contabilidad', 'proyecciones') then 3
    when p_modulo in ('corrales', 'ferias', 'nutricion', 'ambiente') then 2
    else 1
  end;
$$;

-- 2. La tabla: una fila por escenario (Fase 1 usa uno solo, el «base»).
create table public.proyecciones (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  horizonte_meses smallint not null default 24 check (horizonte_meses between 6 and 36),
  ajustes jsonb not null default '{}'::jsonb check (jsonb_typeof(ajustes) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id)
);
create unique index proyecciones_nombre_finca on public.proyecciones (finca_id, lower(btrim(nombre)));

create trigger proyecciones_updated_at before update on public.proyecciones
  for each row execute function private.set_updated_at();

select private.crear_politicas_finca('proyecciones', 'proyecciones');
grant select, insert, update, delete on public.proyecciones to authenticated;
