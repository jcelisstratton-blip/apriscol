-- Sanidad por animal: FAMACHA y pediluvio.
--  · «pediluvio» (baño de patas con sulfato de cobre o de zinc) pasa a ser un tipo de evento y de programación, propio y aparte de la podología.
--  · evaluaciones_famacha: el puntaje FAMACHA (1 a 5, color de la mucosa del ojo) de un animal en una fecha. Sirve para desparasitar solo a quien
--    lo necesita. El estado (al día, vigilar, desparasitar) no se guarda: sale de v_famacha_animal.

alter table public.eventos_sanitarios drop constraint eventos_sanitarios_tipo_check;
alter table public.eventos_sanitarios
  add constraint eventos_sanitarios_tipo_check check (tipo = any (array['vacunacion', 'desparasitacion', 'tratamiento', 'cirugia', 'podologia', 'pediluvio', 'otro']));
alter table public.programas_sanitarios drop constraint programas_sanitarios_tipo_check;
alter table public.programas_sanitarios
  add constraint programas_sanitarios_tipo_check check (tipo = any (array['vacunacion', 'desparasitacion', 'tratamiento', 'cirugia', 'podologia', 'pediluvio', 'otro']));

create table public.evaluaciones_famacha (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  fecha date not null,
  puntaje smallint not null check (puntaje between 1 and 5),
  observaciones text check (observaciones is null or char_length(observaciones) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint famacha_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint famacha_animal_fecha_uk unique (animal_id, fecha)
);
create index famacha_finca_fecha_idx on public.evaluaciones_famacha (finca_id, fecha desc);
create trigger evaluaciones_famacha_updated_at before update on public.evaluaciones_famacha
  for each row execute function private.set_updated_at();
select private.crear_politicas_finca('evaluaciones_famacha', 'sanidad');
revoke all on public.evaluaciones_famacha from anon;
grant select, insert, update, delete on public.evaluaciones_famacha to authenticated;

-- La última evaluación FAMACHA de cada animal activo y, si ya se le desparasitó desde entonces, cuándo.
create view public.v_famacha_animal with (security_invoker = true) as
select distinct on (f.animal_id)
       f.animal_id, f.finca_id, f.id as evaluacion_id, f.fecha as ultima_fecha, f.puntaje,
       (select max(e.fecha)
          from public.evento_sanitario_animales ea
          join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
         where ea.animal_id = f.animal_id and ea.finca_id = f.finca_id and e.tipo = 'desparasitacion' and e.fecha >= f.fecha) as desparasitado_en
from public.evaluaciones_famacha f
join public.animales a on a.id = f.animal_id and a.finca_id = f.finca_id and a.estado = 'activo' and a.deleted_at is null
order by f.animal_id, f.fecha desc;
revoke all on public.v_famacha_animal from anon;
grant select on public.v_famacha_animal to authenticated;
