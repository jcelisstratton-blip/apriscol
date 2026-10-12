-- Empadronamiento (temporada de monta): lotes con fechas, sementales y hembras asignadas a cada uno, con control de endogamia antes de
-- confirmar cada pareja y paso automático a gestación al cerrar (servicio por hembra con su fecha base → fecha prevista de parto).
-- Nada derivado se guarda: el estado de la hembra y su fecha de parto salen de v_repro_hembras (servicios), no de este módulo.

-- ───────────────────────── Condición corporal ─────────────────────────
-- Se anota al pesar (escala 1 a 5, de medio en medio). Es lo que el empadronamiento mira para decidir si una hembra está lista.
alter table public.pesajes
  add column condicion_corporal numeric(2, 1)
  check (condicion_corporal is null or (condicion_corporal between 1 and 5 and condicion_corporal * 2 = trunc(condicion_corporal * 2)));

-- ───────────────────────── Endogamia de una cruza (sin comprobar permisos: solo para triggers y funciones definer) ─────────────────────────
create function private.f_cruza(p_macho uuid, p_hembra uuid) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ml uuid; v_hl uuid; r double precision;
begin
  select libro_id into v_ml from public.animales where id = p_macho;
  select libro_id into v_hl from public.animales where id = p_hembra;
  if v_ml is not null and v_hl is not null then
    r := private.relacion_libro(v_ml, v_hl);
  else
    r := private.relacion_aditiva(p_macho, p_hembra);
  end if;
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

-- ¿Una endogamia llega al umbral de la finca? Misma regla que la pantalla: se compara con cinco decimales (lo que se ve), y llegar justo es llegar.
create function private.sobre_umbral(p_f numeric, p_umbral numeric) returns boolean
language sql immutable set search_path = ''
as $$ select round(p_f * 100000) >= round(p_umbral * 100000) $$;

-- ───────────────────────── Tablas ─────────────────────────
create table public.empadronamientos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  especie public.especie not null,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  fecha_inicio date not null default current_date,
  fecha_fin_prevista date not null,
  cerrado_en date,
  -- Fecha desde la que se cuenta la gestación al cerrar (por omisión, la del cierre: la más tardía posible).
  fecha_base date,
  edad_min_meses smallint not null check (edad_min_meses between 1 and 60),
  peso_min_kg numeric(4, 1) not null check (peso_min_kg > 0 and peso_min_kg <= 250),
  cc_min numeric(2, 1) not null default 3.0 check (cc_min between 1 and 5),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint empadronamientos_fechas_ck check (fecha_fin_prevista >= fecha_inicio and fecha_fin_prevista - fecha_inicio <= 120),
  constraint empadronamientos_cierre_ck check (cerrado_en is null or cerrado_en >= fecha_inicio),
  constraint empadronamientos_base_ck check (fecha_base is null or (cerrado_en is not null and fecha_base >= fecha_inicio))
);
create unique index empadronamientos_nombre_uk on public.empadronamientos (finca_id, lower(btrim(nombre)));
create unique index empadronamientos_client_req_uk on public.empadronamientos (finca_id, client_request_id) where client_request_id is not null;
create index empadronamientos_finca_idx on public.empadronamientos (finca_id, fecha_inicio desc);
create trigger empadronamientos_updated_at before update on public.empadronamientos for each row execute function private.set_updated_at();

create table public.empadronamiento_machos (
  finca_id uuid not null,
  empadronamiento_id uuid not null,
  macho_id uuid not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (empadronamiento_id, macho_id),
  constraint emp_machos_lote_fk foreign key (empadronamiento_id, finca_id) references public.empadronamientos (id, finca_id) on delete cascade,
  constraint emp_machos_animal_fk foreign key (macho_id, finca_id) references public.animales (id, finca_id) on delete cascade
);
create index emp_machos_macho_idx on public.empadronamiento_machos (macho_id);

create table public.empadronamiento_hembras (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null,
  empadronamiento_id uuid not null,
  hembra_id uuid not null,
  macho_id uuid not null,
  -- Lo que valía la endogamia de la pareja cuando se decidió (queda como constancia aunque cambie el pedigrí o el umbral).
  endogamia numeric(7, 6) not null check (endogamia >= 0),
  -- La pareja supera el umbral y aun así se asignó: queda registrado que fue una decisión consciente.
  excepcion boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (empadronamiento_id, hembra_id),
  constraint emp_hembras_lote_fk foreign key (empadronamiento_id, finca_id) references public.empadronamientos (id, finca_id) on delete cascade,
  constraint emp_hembras_animal_fk foreign key (hembra_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint emp_hembras_macho_fk foreign key (empadronamiento_id, macho_id) references public.empadronamiento_machos (empadronamiento_id, macho_id)
);
create index emp_hembras_hembra_idx on public.empadronamiento_hembras (hembra_id);
create index emp_hembras_macho_idx on public.empadronamiento_hembras (empadronamiento_id, macho_id);

-- ───────────────────────── Reglas (triggers) ─────────────────────────
-- Un empadronamiento cerrado queda como historia: solo se pueden corregir sus observaciones.
create function private.emp_proteger_cerrado() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.cerrado_en is not null and (
       new.nombre is distinct from old.nombre or new.especie is distinct from old.especie or new.fecha_inicio is distinct from old.fecha_inicio
       or new.fecha_fin_prevista is distinct from old.fecha_fin_prevista or new.cerrado_en is distinct from old.cerrado_en
       or new.fecha_base is distinct from old.fecha_base or new.edad_min_meses is distinct from old.edad_min_meses
       or new.peso_min_kg is distinct from old.peso_min_kg or new.cc_min is distinct from old.cc_min) then
    raise exception 'Un empadronamiento cerrado ya no se puede cambiar (solo sus observaciones).' using errcode = 'check_violation';
  end if;
  if new.especie is distinct from old.especie and exists (select 1 from public.empadronamiento_machos where empadronamiento_id = old.id) then
    raise exception 'No se puede cambiar la especie: ya tiene sementales.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger empadronamientos_proteger before update on public.empadronamientos
  for each row execute function private.emp_proteger_cerrado();

create function private.emp_machos_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record;
begin
  select * into v_lote from public.empadronamientos where id = coalesce(new.empadronamiento_id, old.empadronamiento_id);
  -- Si el lote ya no existe, es un borrado en cascada: no hay nada que proteger.
  if not found then return coalesce(new, old); end if;
  if v_lote.cerrado_en is not null then
    raise exception 'El empadronamiento ya está cerrado: no se pueden cambiar sus sementales.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  select sexo, especie, estado, deleted_at into v_a from public.animales where id = new.macho_id;
  if v_a.sexo is distinct from 'macho' then
    raise exception 'El semental debe ser un macho.' using errcode = 'check_violation';
  end if;
  if v_a.especie is distinct from v_lote.especie then
    raise exception 'El semental debe ser de la misma especie del empadronamiento.' using errcode = 'check_violation';
  end if;
  if v_a.estado <> 'activo' or v_a.deleted_at is not null then
    raise exception 'El semental ya no está en el hato.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger emp_machos_validar before insert or update or delete on public.empadronamiento_machos
  for each row execute function private.emp_machos_validar();

create function private.emp_hembras_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_umbral numeric; v_f numeric; v_otro text;
begin
  select * into v_lote from public.empadronamientos where id = coalesce(new.empadronamiento_id, old.empadronamiento_id);
  if not found then return coalesce(new, old); end if;
  if v_lote.cerrado_en is not null then
    raise exception 'El empadronamiento ya está cerrado: no se pueden cambiar sus hembras.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  select sexo, especie, estado, deleted_at into v_a from public.animales where id = new.hembra_id;
  if v_a.sexo is distinct from 'hembra' then
    raise exception 'Solo una hembra puede entrar a un empadronamiento.' using errcode = 'check_violation';
  end if;
  if v_a.especie is distinct from v_lote.especie then
    raise exception 'La hembra debe ser de la misma especie del empadronamiento.' using errcode = 'check_violation';
  end if;
  if v_a.estado <> 'activo' or v_a.deleted_at is not null then
    raise exception 'La hembra ya no está en el hato.' using errcode = 'check_violation';
  end if;

  select e.nombre into v_otro
  from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
  where h.hembra_id = new.hembra_id and e.cerrado_en is null and e.id <> new.empadronamiento_id limit 1;
  if v_otro is not null then
    raise exception 'Esa hembra ya está en otro empadronamiento abierto («%»).', v_otro using errcode = 'check_violation';
  end if;

  -- Control genético: la pareja no puede llegar al umbral de endogamia de la finca, salvo excepción registrada.
  v_f := private.f_cruza(new.macho_id, new.hembra_id);
  select umbral_endogamia into v_umbral from public.fincas where id = v_lote.finca_id;
  new.endogamia := v_f;
  if private.sobre_umbral(v_f, v_umbral) and not new.excepcion then
    raise exception 'La endogamia de esta pareja (% %%) llega al umbral de tu finca (% %%).',
      replace(to_char(v_f * 100, 'FM990.00'), '.', ','), replace(to_char(v_umbral * 100, 'FM990.00'), '.', ',') using errcode = 'check_violation';
  end if;
  if not private.sobre_umbral(v_f, v_umbral) then new.excepcion := false; end if;
  return new;
end;
$$;
create trigger emp_hembras_validar before insert or update or delete on public.empadronamiento_hembras
  for each row execute function private.emp_hembras_validar();

-- ───────────────────────── Permisos (RLS) ─────────────────────────
select private.crear_politicas_finca('empadronamientos', 'reproduccion');
select private.crear_politicas_finca('empadronamiento_machos', 'reproduccion');
select private.crear_politicas_finca('empadronamiento_hembras', 'reproduccion');
revoke all on public.empadronamientos, public.empadronamiento_machos, public.empadronamiento_hembras from anon;
grant select, insert, update, delete on public.empadronamientos, public.empadronamiento_machos, public.empadronamiento_hembras to authenticated;

-- ───────────────────────── Resumen de cada empadronamiento ─────────────────────────
create view public.v_empadronamientos with (security_invoker = true) as
select e.*,
       (select count(*)::int from public.empadronamiento_machos m where m.empadronamiento_id = e.id) as machos,
       (select count(*)::int from public.empadronamiento_hembras h where h.empadronamiento_id = e.id) as hembras,
       (select count(*)::int from public.empadronamiento_hembras h where h.empadronamiento_id = e.id and h.excepcion) as excepciones
from public.empadronamientos e;
revoke all on public.v_empadronamientos from anon;
grant select on public.v_empadronamientos to authenticated;

-- ───────────────────────── Hembras candidatas ─────────────────────────
-- Para cada hembra activa de la especie: edad, último peso, última condición corporal y si cumple cada criterio del lote
-- («ok», «no» o «sin_dato»). Además dice por qué no se puede asignar (ya servida o gestante, o en otro empadronamiento abierto).
create function public.empadronamiento_candidatas(p_lote uuid)
returns table (
  animal_id uuid, numero_arete text, nombre text, edad_meses integer,
  peso_kg numeric, fecha_peso date, cc numeric, fecha_cc date,
  estado_repro text, otro_lote text,
  edad_ok text, peso_ok text, cc_ok text
)
language sql stable set search_path = ''
as $$
  with lote as (select * from public.empadronamientos where id = p_lote),
  hoy as (select (now() at time zone 'America/Bogota')::date as d)
  select a.id, a.numero_arete::text, a.nombre::text,
         case when a.fecha_nacimiento is null then null
              else (extract(year from age(hoy.d, a.fecha_nacimiento)) * 12 + extract(month from age(hoy.d, a.fecha_nacimiento)))::int end,
         pw.peso_kg, pw.fecha, pc.condicion_corporal, pc.fecha,
         r.estado::text,
         ot.nombre::text,
         case when a.fecha_nacimiento is null then 'sin_dato'
              when (extract(year from age(hoy.d, a.fecha_nacimiento)) * 12 + extract(month from age(hoy.d, a.fecha_nacimiento))) >= l.edad_min_meses then 'ok'
              else 'no' end,
         case when pw.peso_kg is null then 'sin_dato' when pw.peso_kg >= l.peso_min_kg then 'ok' else 'no' end,
         case when pc.condicion_corporal is null then 'sin_dato' when pc.condicion_corporal >= l.cc_min then 'ok' else 'no' end
  from lote l
  cross join hoy
  join public.animales a on a.finca_id = l.finca_id and a.especie = l.especie and a.sexo = 'hembra' and a.estado = 'activo' and a.deleted_at is null
  left join public.v_repro_hembras r on r.animal_id = a.id
  left join lateral (select p.peso_kg, p.fecha from public.pesajes p where p.animal_id = a.id order by p.fecha desc, p.created_at desc limit 1) pw on true
  left join lateral (select p.condicion_corporal, p.fecha from public.pesajes p where p.animal_id = a.id and p.condicion_corporal is not null order by p.fecha desc, p.created_at desc limit 1) pc on true
  left join lateral (
    select e.nombre from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
    where h.hembra_id = a.id and e.cerrado_en is null and e.id <> l.id limit 1
  ) ot on true
  where not exists (select 1 from public.empadronamiento_hembras h where h.empadronamiento_id = l.id and h.hembra_id = a.id)
  order by a.numero_arete
$$;

-- ───────────────────────── Control genético previo a asignar ─────────────────────────
-- Endogamia que tendría la cría de cada hembra con el semental elegido, y si llega al umbral de la finca.
create function public.empadronamiento_endogamia(p_lote uuid, p_macho uuid, p_hembras uuid[])
returns table (hembra_id uuid, f numeric, sobre_umbral boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_finca uuid; v_umbral numeric;
begin
  select e.finca_id, f.umbral_endogamia into v_finca, v_umbral
  from public.empadronamientos e join public.fincas f on f.id = e.finca_id where e.id = p_lote;
  if v_finca is null or not private.puede_ver(v_finca, 'reproduccion') then
    raise exception 'Empadronamiento no encontrado.' using errcode = 'P0002';
  end if;
  if cardinality(p_hembras) > 500 then
    raise exception 'Elige hasta 500 hembras a la vez.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.animales m where m.id = p_macho and m.finca_id = v_finca and m.sexo = 'macho' and m.deleted_at is null) then
    raise exception 'Semental no encontrado.' using errcode = 'P0002';
  end if;
  return query
  select a.id, x.f, private.sobre_umbral(x.f, v_umbral)
  from public.animales a
  cross join lateral (select private.f_cruza(p_macho, a.id) as f) x
  where a.id = any (p_hembras) and a.finca_id = v_finca and a.sexo = 'hembra' and a.deleted_at is null;
end;
$$;

-- ───────────────────────── Cierre: de la monta a la gestación ─────────────────────────
-- Cierra el empadronamiento y registra, para cada hembra que aún no tenga un servicio dentro de la temporada, una monta natural con su
-- semental asignado en la fecha base (por omisión, la del cierre). Desde ahí la hembra aparece servida, con su fecha prevista de parto
-- (ovinos 147 días, caprinos 150, de parametros_especie) y pasa a gestante cuando se confirme el diagnóstico.
create function public.cerrar_empadronamiento(p_lote uuid, p_cierre date, p_base date default null)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_hoy date := (now() at time zone 'America/Bogota')::date; v_base date; v_n int; v_total int;
begin
  select * into v_lote from public.empadronamientos where id = p_lote for update;
  if not found then
    raise exception 'No encontramos ese empadronamiento.' using errcode = 'P0002';
  end if;
  if v_lote.cerrado_en is not null then
    raise exception 'Este empadronamiento ya está cerrado.' using errcode = 'check_violation';
  end if;
  v_base := coalesce(p_base, p_cierre);
  if p_cierre < v_lote.fecha_inicio or p_cierre > v_hoy then
    raise exception 'La fecha de cierre debe estar entre el inicio de la temporada y hoy.' using errcode = 'check_violation';
  end if;
  if v_base < v_lote.fecha_inicio or v_base > p_cierre then
    raise exception 'La fecha base debe estar entre el inicio de la temporada y el cierre.' using errcode = 'check_violation';
  end if;
  select count(*) into v_total from public.empadronamiento_hembras where empadronamiento_id = p_lote;
  if v_total = 0 then
    raise exception 'Agrega al menos una hembra antes de cerrar el empadronamiento.' using errcode = 'check_violation';
  end if;

  update public.empadronamientos set cerrado_en = p_cierre, fecha_base = v_base where id = p_lote;

  insert into public.servicios (finca_id, hembra_id, fecha, tipo, macho_id, observaciones)
  select h.finca_id, h.hembra_id, v_base, 'monta_natural', h.macho_id,
         'Empadronamiento «' || v_lote.nombre || '»: fecha base para calcular el parto.'
  from public.empadronamiento_hembras h
  where h.empadronamiento_id = p_lote
    and not exists (
      select 1 from public.servicios s
      where s.hembra_id = h.hembra_id and s.fecha between v_lote.fecha_inicio and p_cierre);
  get diagnostics v_n = row_count;
  return jsonb_build_object('hembras', v_total, 'servicios_creados', v_n);
end;
$$;

revoke execute on function public.empadronamiento_candidatas(uuid), public.empadronamiento_endogamia(uuid, uuid, uuid[]),
  public.cerrar_empadronamiento(uuid, date, date) from public, anon;
grant execute on function public.empadronamiento_candidatas(uuid), public.empadronamiento_endogamia(uuid, uuid, uuid[]),
  public.cerrar_empadronamiento(uuid, date, date) to authenticated;

-- ───────────────────────── Estado de la hembra: ahora dice si está en un empadronamiento abierto ─────────────────────────
-- Se agregan tres columnas al final de v_repro_hembras; lo demás queda igual.
create or replace view public.v_repro_hembras with (security_invoker = true) as
with fin_gestacion as (
  select madre_id, max(fecha) as fecha from public.partos group by madre_id
),
partos_reg as (
  select madre_id, count(*)::int as n, max(fecha) as ultimo from public.partos where tipo <> 'aborto' group by madre_id
),
servicio as (
  select distinct on (hembra_id) hembra_id, id, fecha, tipo
  from public.servicios
  order by hembra_id, fecha desc, created_at desc
),
diag as (
  select distinct on (hembra_id) hembra_id, fecha, resultado
  from public.diagnosticos_gestacion
  order by hembra_id, fecha desc, created_at desc
)
select a.id as animal_id,
       a.finca_id,
       a.especie,
       pr.ultimo as ultimo_parto,
       coalesce(pr.n, 0) as partos_registrados,
       a.partos_previos,
       case when a.partos_previos is null and coalesce(pr.n, 0) = 0 then null else coalesce(a.partos_previos, 0) + coalesce(pr.n, 0) end as partos_totales,
       v.id as servicio_id,
       v.fecha as ultimo_servicio,
       case
         when v.id is not null and v.fecha > coalesce(fg.fecha, date '0001-01-01') and not (d.fecha >= v.fecha and d.resultado = 'vacia')
           then v.fecha + p.gestacion_dias::int
       end as fecha_prevista_parto,
       d.resultado as diagnostico,
       d.fecha as fecha_diagnostico,
       case
         when v.id is null or v.fecha <= coalesce(fg.fecha, date '0001-01-01')
           then case when fg.fecha is null and pr.n is null and a.partos_previos is null then 'sin_datos' else 'vacia' end
         when d.fecha >= v.fecha and d.resultado = 'gestante' then 'gestante'
         when d.fecha >= v.fecha and d.resultado = 'vacia' then 'vacia'
         else 'servida'
       end as estado,
       exists (select 1 from public.lactancias l where l.animal_id = a.id and l.fecha_secado is null) as en_lactancia,
       emp.id as empadronamiento_id,
       emp.nombre as empadronamiento_nombre,
       emp.macho_id as empadronamiento_macho_id
from public.animales a
join public.parametros_especie p on p.especie = a.especie
left join partos_reg pr on pr.madre_id = a.id
left join fin_gestacion fg on fg.madre_id = a.id
left join servicio v on v.hembra_id = a.id
left join diag d on d.hembra_id = a.id
left join lateral (
  select e.id, e.nombre, h.macho_id
  from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
  where h.hembra_id = a.id and e.cerrado_en is null
  limit 1
) emp on true
where a.sexo = 'hembra' and a.estado = 'activo' and a.deleted_at is null;
