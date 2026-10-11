-- Sanidad: productos, eventos (con detalle por animal, para tratar un lote de una vez), pruebas diagnósticas
-- y periodos de retiro separados para leche y carne.

create table public.productos_veterinarios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  tipo text not null default 'otro'
    check (tipo in ('vacuna', 'desparasitante', 'antibiotico', 'antiinflamatorio', 'vitamina', 'otro')),
  registro_ica text,
  retiro_leche_dias smallint not null default 0 check (retiro_leche_dias >= 0),
  retiro_carne_dias smallint not null default 0 check (retiro_carne_dias >= 0),
  unidad_dosis text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id)
);
create unique index productos_veterinarios_nombre_uk on public.productos_veterinarios (finca_id, lower(btrim(nombre)));
create trigger productos_veterinarios_updated_at before update on public.productos_veterinarios
  for each row execute function private.set_updated_at();

create table public.eventos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('vacunacion', 'desparasitacion', 'tratamiento', 'cirugia', 'otro')),
  producto_id uuid,
  producto_nombre text,
  lote_producto text,
  fecha_vencimiento date,
  dosis numeric(8, 2) check (dosis > 0),
  unidad_dosis text,
  via text check (via in ('oral', 'subcutanea', 'intramuscular', 'intravenosa', 'topica', 'intramamaria', 'otra')),
  responsable text,
  costo numeric(14, 2) check (costo >= 0),
  retiro_leche_dias smallint not null default 0 check (retiro_leche_dias >= 0),
  retiro_carne_dias smallint not null default 0 check (retiro_carne_dias >= 0),
  -- Último día INCLUIDO del retiro (criterio conservador). Con 0 días no hay retiro.
  fin_retiro_leche date generated always as (fecha + retiro_leche_dias::int) stored,
  fin_retiro_carne date generated always as (fecha + retiro_carne_dias::int) stored,
  diagnostico text,
  observaciones text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint eventos_sanitarios_producto_fk foreign key (producto_id, finca_id)
    references public.productos_veterinarios (id, finca_id) on delete set null (producto_id)
);
create index eventos_sanitarios_finca_fecha_idx on public.eventos_sanitarios (finca_id, fecha desc);
create unique index eventos_sanitarios_client_req_uk on public.eventos_sanitarios (finca_id, client_request_id)
  where client_request_id is not null;
create trigger eventos_sanitarios_updated_at before update on public.eventos_sanitarios
  for each row execute function private.set_updated_at();

create table public.evento_sanitario_animales (
  evento_id uuid not null,
  animal_id uuid not null,
  finca_id uuid not null references public.fincas (id) on delete cascade,
  primary key (evento_id, animal_id),
  constraint esa_evento_fk foreign key (evento_id, finca_id)
    references public.eventos_sanitarios (id, finca_id) on delete cascade,
  constraint esa_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade
);
create index evento_sanitario_animales_animal_idx on public.evento_sanitario_animales (animal_id, evento_id);

create table public.pruebas_sanitarias (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  prueba text not null
    check (prueba in ('cae', 'brucelosis', 'cmt', 'mastitis_cultivo', 'paratuberculosis', 'otra')),
  fecha date not null default current_date,
  resultado text not null default 'pendiente'
    check (resultado in ('negativo', 'positivo', 'sospechoso', 'pendiente')),
  laboratorio text,
  -- Ruta dentro del bucket «soportes»: <finca_id>/pruebas/<archivo>
  soporte_path text,
  observaciones text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pruebas_sanitarias_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade
);
create index pruebas_sanitarias_animal_idx on public.pruebas_sanitarias (animal_id, fecha desc);
create unique index pruebas_sanitarias_client_req_uk on public.pruebas_sanitarias (finca_id, client_request_id)
  where client_request_id is not null;
create trigger pruebas_sanitarias_updated_at before update on public.pruebas_sanitarias
  for each row execute function private.set_updated_at();

-- ───────────────────────── Retiros ─────────────────────────
-- SECURITY DEFINER a propósito: el ordeñador no lee sanidad, pero el sistema sí debe saber si la leche
-- de un animal puede entrar al tanque. Solo devuelven un booleano.
create function private.en_retiro_leche(p_animal uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.evento_sanitario_animales ea
    join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
    where ea.animal_id = p_animal and e.retiro_leche_dias > 0 and p_fecha between e.fecha and e.fin_retiro_leche
  );
$$;

create function private.en_retiro_carne(p_animal uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.evento_sanitario_animales ea
    join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
    where ea.animal_id = p_animal and e.retiro_carne_dias > 0 and p_fecha between e.fecha and e.fin_retiro_carne
  );
$$;

-- Animales de una finca con retiro vigente hoy (para el ordeño y para la baja por venta).
create function public.animales_en_retiro(p_finca uuid)
returns table (animal_id uuid, retiro_leche_hasta date, retiro_carne_hasta date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_miembro(p_finca) then
    raise exception 'No perteneces a esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select ea.animal_id,
         max(e.fin_retiro_leche) filter (where e.retiro_leche_dias > 0 and current_date <= e.fin_retiro_leche),
         max(e.fin_retiro_carne) filter (where e.retiro_carne_dias > 0 and current_date <= e.fin_retiro_carne)
  from public.evento_sanitario_animales ea
  join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
  where ea.finca_id = p_finca
    and e.fecha <= current_date
    and ((e.retiro_leche_dias > 0 and current_date <= e.fin_retiro_leche)
      or (e.retiro_carne_dias > 0 and current_date <= e.fin_retiro_carne))
  group by ea.animal_id;
end;
$$;
revoke execute on function public.animales_en_retiro(uuid) from public, anon;
grant execute on function public.animales_en_retiro(uuid) to authenticated;

-- Un animal en retiro de carne no puede salir para consumo (sacrificio o venta a frigorífico).
create function private.bajas_validar_retiro() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.tipo = 'sacrificio' or (new.tipo = 'venta' and new.destino_consumo))
     and private.en_retiro_carne(new.animal_id, new.fecha) then
    raise exception 'El animal está en periodo de retiro de carne y no puede salir para consumo.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger bajas_validar_retiro before insert or update of tipo, fecha, destino_consumo on public.bajas
  for each row execute function private.bajas_validar_retiro();

-- ───────────────────────── RLS ─────────────────────────
select private.crear_politicas_finca('productos_veterinarios', 'sanidad');
select private.crear_politicas_finca('eventos_sanitarios', 'sanidad');
select private.crear_politicas_finca('evento_sanitario_animales', 'sanidad');
select private.crear_politicas_finca('pruebas_sanitarias', 'sanidad');
