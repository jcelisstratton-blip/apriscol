-- Sanidad: programar tratamientos para los animales que aplican (antes de aplicarlos) y podología como tipo de evento.
--  · programas_sanitarios + programa_sanitario_animales: qué se va a aplicar, cuándo y a qué animales; cada animal queda «aplicado»
--    cuando se registra el evento que lo cubrió (`evento_id`). El estado del programa se calcula (vista), no se guarda.
--  · v_podologia_animal: la última podología de cada animal (recorte de pezuñas, pediluvio, gabatillo): la guía pide una inspección semestral.
--    (El tipo «podologia» de eventos_sanitarios se habilita en la migración siguiente.)

create table public.programas_sanitarios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  tipo text not null check (tipo = any (array['vacunacion', 'desparasitacion', 'tratamiento', 'cirugia', 'podologia', 'otro'])),
  fecha_programada date not null,
  producto_id uuid,
  producto_nombre text check (producto_nombre is null or char_length(producto_nombre) <= 120),
  dosis numeric check (dosis is null or dosis > 0),
  unidad_dosis text check (unidad_dosis is null or char_length(unidad_dosis) <= 20),
  via text check (via is null or via = any (array['oral', 'subcutanea', 'intramuscular', 'intravenosa', 'topica', 'intramamaria', 'otra'])),
  retiro_leche_dias smallint not null default 0 check (retiro_leche_dias >= 0),
  retiro_carne_dias smallint not null default 0 check (retiro_carne_dias >= 0),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  cancelado_en timestamptz,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint programas_sanitarios_producto_fk foreign key (producto_id, finca_id) references public.productos_veterinarios (id, finca_id) on delete set null (producto_id)
);
create unique index programas_sanitarios_client_req_uk on public.programas_sanitarios (finca_id, client_request_id) where client_request_id is not null;
create index programas_sanitarios_finca_idx on public.programas_sanitarios (finca_id, fecha_programada);
create trigger programas_sanitarios_updated_at before update on public.programas_sanitarios for each row execute function private.set_updated_at();

create table public.programa_sanitario_animales (
  programa_id uuid not null,
  animal_id uuid not null,
  finca_id uuid not null references public.fincas (id) on delete cascade,
  -- El evento que aplicó esta programación a este animal (nulo = pendiente). Si el evento se elimina, vuelve a quedar pendiente.
  evento_id uuid,
  primary key (programa_id, animal_id),
  constraint psa_programa_fk foreign key (programa_id, finca_id) references public.programas_sanitarios (id, finca_id) on delete cascade,
  constraint psa_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint psa_evento_fk foreign key (evento_id, finca_id) references public.eventos_sanitarios (id, finca_id) on delete set null (evento_id)
);
create index psa_animal_pendiente_idx on public.programa_sanitario_animales (animal_id) where evento_id is null;

select private.crear_politicas_finca('programas_sanitarios', 'sanidad');
select private.crear_politicas_finca('programa_sanitario_animales', 'sanidad');
revoke all on public.programas_sanitarios, public.programa_sanitario_animales from anon;
grant select, insert, update, delete on public.programas_sanitarios, public.programa_sanitario_animales to authenticated;

-- Una fila por programa, con cuántos animales tiene y cuántos ya se aplicaron; el estado sale de ahí.
create view public.v_programas_sanitarios with (security_invoker = true) as
select p.*,
       (select count(*)::int from public.programa_sanitario_animales a where a.programa_id = p.id and a.finca_id = p.finca_id) as animales,
       (select count(*)::int from public.programa_sanitario_animales a where a.programa_id = p.id and a.finca_id = p.finca_id and a.evento_id is not null) as aplicados,
       case when p.cancelado_en is not null then 'cancelado'
            when exists (select 1 from public.programa_sanitario_animales a where a.programa_id = p.id and a.finca_id = p.finca_id and a.evento_id is null) then 'abierto'
            else 'completado' end as estado
from public.programas_sanitarios p;
revoke all on public.v_programas_sanitarios from anon;
grant select on public.v_programas_sanitarios to authenticated;

-- Podología: la última vez que se le hizo a cada animal activo (la guía pide una inspección semestral).
create view public.v_podologia_animal with (security_invoker = true) as
select a.id as animal_id, a.finca_id,
       (select max(e.fecha) from public.evento_sanitario_animales ea join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
         where ea.animal_id = a.id and ea.finca_id = a.finca_id and e.tipo = 'podologia') as ultima_fecha
from public.animales a
where a.estado = 'activo' and a.deleted_at is null;
revoke all on public.v_podologia_animal from anon;
grant select on public.v_podologia_animal to authenticated;

-- Crear o corregir un programa y sumarle animales. Los animales que ya se aplicaron no se tocan.
create function public.guardar_programa_sanitario(p_finca uuid, p_programa uuid, p_datos jsonb, p_animales uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.puede_escribir(p_finca, 'sanidad') then
    raise exception 'No tienes permiso para programar sanidad en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_animales is null or cardinality(p_animales) = 0 then
    raise exception 'Elige al menos un animal.' using errcode = 'check_violation';
  end if;
  if cardinality(p_animales) > 1000 then
    raise exception 'Son demasiados animales a la vez (máximo 1000).' using errcode = 'check_violation';
  end if;

  if p_programa is null then
    insert into public.programas_sanitarios (finca_id, tipo, fecha_programada, producto_id, producto_nombre, dosis, unidad_dosis, via, retiro_leche_dias, retiro_carne_dias, observaciones, client_request_id)
    values (p_finca, p_datos ->> 'tipo', (p_datos ->> 'fecha_programada')::date, nullif(p_datos ->> 'producto_id', '')::uuid, nullif(p_datos ->> 'producto_nombre', ''),
            nullif(p_datos ->> 'dosis', '')::numeric, nullif(p_datos ->> 'unidad_dosis', ''), nullif(p_datos ->> 'via', ''),
            coalesce(nullif(p_datos ->> 'retiro_leche_dias', '')::smallint, 0), coalesce(nullif(p_datos ->> 'retiro_carne_dias', '')::smallint, 0),
            nullif(p_datos ->> 'observaciones', ''), nullif(p_datos ->> 'client_request_id', '')::uuid)
    returning id into v_id;
  else
    update public.programas_sanitarios set
      tipo = p_datos ->> 'tipo',
      fecha_programada = (p_datos ->> 'fecha_programada')::date,
      producto_id = nullif(p_datos ->> 'producto_id', '')::uuid,
      producto_nombre = nullif(p_datos ->> 'producto_nombre', ''),
      dosis = nullif(p_datos ->> 'dosis', '')::numeric,
      unidad_dosis = nullif(p_datos ->> 'unidad_dosis', ''),
      via = nullif(p_datos ->> 'via', ''),
      retiro_leche_dias = coalesce(nullif(p_datos ->> 'retiro_leche_dias', '')::smallint, 0),
      retiro_carne_dias = coalesce(nullif(p_datos ->> 'retiro_carne_dias', '')::smallint, 0),
      observaciones = nullif(p_datos ->> 'observaciones', '')
    where id = p_programa and finca_id = p_finca and cancelado_en is null
    returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos esa programación o ya está cancelada.' using errcode = 'no_data_found';
    end if;
    -- Quitar de la programación a los pendientes que ya no van lo hace la acción del servidor (con los permisos de quien edita).
  end if;

  insert into public.programa_sanitario_animales (programa_id, animal_id, finca_id)
  select v_id, a, p_finca from (select distinct unnest(p_animales) as a) t
  on conflict (programa_id, animal_id) do nothing;
  return v_id;
end;
$$;
revoke execute on function public.guardar_programa_sanitario(uuid, uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.guardar_programa_sanitario(uuid, uuid, jsonb, uuid[]) to authenticated;
