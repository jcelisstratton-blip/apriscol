-- Examen coprológico: conteo de huevos (HPG) y de ooquistes de un animal en una fecha. Puede ser el de diagnóstico o uno de los dos de la prueba de eficacia
-- de un desparasitante (antes y después de aplicarlo, ligados a su evento). El nivel (bajo, moderado, alto) no se guarda: sale de lib/coprologico.ts.
create table public.examenes_coprologicos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  fecha date not null,
  momento text not null default 'diagnostico' check (momento in ('diagnostico', 'antes', 'despues')),
  evento_id uuid,
  tecnica text not null default 'mcmaster' check (tecnica in ('mcmaster', 'mini_flotac', 'flotacion', 'otra')),
  hpg integer check (hpg is null or hpg between 0 and 1000000),
  opg integer check (opg is null or opg between 0 and 100000000),
  otros_parasitos text[] not null default '{}' check (otros_parasitos <@ array['moniezia', 'strongyloides', 'trichuris', 'nematodirus', 'fasciola', 'dicrocelium']::text[]),
  laboratorio text check (laboratorio is null or char_length(laboratorio) <= 120),
  observaciones text check (observaciones is null or char_length(observaciones) <= 300),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coprologico_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint coprologico_evento_fk foreign key (evento_id, finca_id) references public.eventos_sanitarios (id, finca_id) on delete set null (evento_id),
  constraint coprologico_con_resultado check (hpg is not null or opg is not null),
  constraint coprologico_eficacia_con_evento check (momento = 'diagnostico' or evento_id is not null),
  constraint coprologico_animal_fecha_momento_uk unique (animal_id, fecha, momento)
);
create index coprologico_finca_fecha_idx on public.examenes_coprologicos (finca_id, fecha desc);
create index coprologico_evento_idx on public.examenes_coprologicos (finca_id, evento_id) where evento_id is not null;
create unique index coprologico_client_req_uk on public.examenes_coprologicos (finca_id, client_request_id) where client_request_id is not null;
create trigger examenes_coprologicos_updated_at before update on public.examenes_coprologicos
  for each row execute function private.set_updated_at();
select private.crear_politicas_finca('examenes_coprologicos', 'sanidad');
revoke all on public.examenes_coprologicos from anon;
grant select, insert, update, delete on public.examenes_coprologicos to authenticated;

-- El último examen de diagnóstico de cada animal activo y, si ya se le desparasitó desde entonces, cuándo.
create view public.v_coprologico_animal with (security_invoker = true) as
select distinct on (x.animal_id)
       x.animal_id, x.finca_id, x.id as examen_id, x.fecha as ultima_fecha, x.hpg, x.opg,
       (select max(e.fecha)
          from public.evento_sanitario_animales ea
          join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
         where ea.animal_id = x.animal_id and ea.finca_id = x.finca_id and e.tipo = 'desparasitacion' and e.fecha >= x.fecha) as desparasitado_en
from public.examenes_coprologicos x
join public.animales a on a.id = x.animal_id and a.finca_id = x.finca_id and a.estado = 'activo' and a.deleted_at is null
where x.momento <> 'despues'
order by x.animal_id, x.fecha desc;
revoke all on public.v_coprologico_animal from anon;
grant select on public.v_coprologico_animal to authenticated;
