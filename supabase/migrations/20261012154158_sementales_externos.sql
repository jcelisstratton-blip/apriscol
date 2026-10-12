-- Empadronamiento con sementales de OTRO hato (prestados): sus datos (chip, nombre, hato de origen, dueño, contacto, préstamo, sanidad…)
-- viven en `sementales_externos`; la temporada los referencia desde `empadronamiento_machos` con `externo = true` (su `macho_id` es el id
-- del semental externo). De un semental de otro hato no se tiene genealogía: no se calcula endogamia para sus parejas.
-- (La llave foránea de `macho_id` a `animales` se quita en la migración siguiente: ahora puede apuntar a un semental externo, y el
-- disparador `emp_machos_validar` comprueba que exista en la tabla que corresponde y que sea de la misma finca.)

create table public.sementales_externos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  especie public.especie not null,
  chip text not null check (char_length(btrim(chip)) between 1 and 40),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  hato_origen text not null check (char_length(btrim(hato_origen)) between 1 and 120),
  propietario text check (propietario is null or char_length(propietario) <= 120),
  telefono text check (telefono is null or char_length(telefono) <= 30),
  raza text check (raza is null or char_length(raza) <= 60),
  fecha_nacimiento date,
  prestamo_desde date not null,
  prestamo_hasta date not null,
  sanidad text check (sanidad is null or char_length(sanidad) <= 500),
  condiciones text check (condiciones is null or char_length(condiciones) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint sementales_externos_prestamo_ck check (prestamo_hasta >= prestamo_desde and prestamo_hasta - prestamo_desde <= 400)
);
create index sementales_externos_finca_idx on public.sementales_externos (finca_id, prestamo_hasta desc);
create trigger sementales_externos_updated_at before update on public.sementales_externos for each row execute function private.set_updated_at();
select private.crear_politicas_finca('sementales_externos', 'reproduccion');
revoke all on public.sementales_externos from anon;
grant select, insert, update, delete on public.sementales_externos to authenticated;

alter table public.empadronamiento_machos add column externo boolean not null default false;

create or replace function private.emp_machos_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_e record; v_n int;
begin
  select * into v_lote from public.empadronamientos where id = coalesce(new.empadronamiento_id, old.empadronamiento_id);
  -- Si el lote ya no existe, es un borrado en cascada: no hay nada que proteger.
  if not found then return coalesce(new, old); end if;
  if v_lote.cerrado_en is not null then
    raise exception 'El empadronamiento ya está cerrado: no se pueden cambiar sus sementales.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and (new.macho_id <> old.macho_id or new.externo <> old.externo) then
    raise exception 'No se puede cambiar el semental de esta fila: quítalo y agrega otro.' using errcode = 'check_violation';
  end if;
  if new.externo then
    select finca_id, especie into v_e from public.sementales_externos where id = new.macho_id;
    if not found or v_e.finca_id <> new.finca_id then
      raise exception 'No encontramos ese semental de otro hato.' using errcode = 'check_violation';
    end if;
    if v_e.especie is distinct from v_lote.especie then
      raise exception 'El semental debe ser de la misma especie del empadronamiento.' using errcode = 'check_violation';
    end if;
  else
    select sexo, especie, estado, deleted_at, finca_id into v_a from public.animales where id = new.macho_id;
    if not found or v_a.finca_id <> new.finca_id then
      raise exception 'El semental no es de tu hato.' using errcode = 'check_violation';
    end if;
    if v_a.sexo is distinct from 'macho' then
      raise exception 'El semental debe ser un macho.' using errcode = 'check_violation';
    end if;
    if v_a.especie is distinct from v_lote.especie then
      raise exception 'El semental debe ser de la misma especie del empadronamiento.' using errcode = 'check_violation';
    end if;
    if v_a.estado <> 'activo' or v_a.deleted_at is not null then
      raise exception 'El semental ya no está en el hato.' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.num_hembras is not null then
    select count(*) into v_n from public.empadronamiento_hembras h where h.empadronamiento_id = new.empadronamiento_id and h.macho_id = new.macho_id;
    if v_n > new.num_hembras then
      raise exception 'Este semental ya tiene % hembras: el número no puede ser menor.', v_n using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Hembras: con un semental de otro hato no hay genealogía, así que no se calcula endogamia (queda en 0 y sin excepción).
create or replace function private.emp_hembras_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_umbral numeric; v_f numeric; v_otro text; v_estado text; v_n int; v_cupo int; v_ext boolean;
begin
  select * into v_lote from public.empadronamientos where id = coalesce(new.empadronamiento_id, old.empadronamiento_id) for update;
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

  if tg_op = 'INSERT' then
    select r.estado into v_estado from public.v_repro_hembras r where r.animal_id = new.hembra_id;
    if v_estado = 'gestante' then
      raise exception 'Una hembra gestante no puede entrar a un empadronamiento: solo entran hembras libres.' using errcode = 'check_violation';
    elsif v_estado = 'servida' then
      raise exception 'Una hembra servida que espera su diagnóstico no puede entrar a un empadronamiento: solo entran hembras libres.' using errcode = 'check_violation';
    end if;
  end if;

  select m.externo, coalesce(m.num_hembras, v_lote.hembras_por_macho) into v_ext, v_cupo
  from public.empadronamiento_machos m where m.empadronamiento_id = new.empadronamiento_id and m.macho_id = new.macho_id;
  if tg_op = 'INSERT' and v_cupo is not null then
    select count(*) into v_n from public.empadronamiento_hembras h where h.empadronamiento_id = new.empadronamiento_id and h.macho_id = new.macho_id;
    if v_n >= v_cupo then
      raise exception 'Este semental ya tiene sus % hembras: es el número que fijaste para él en la temporada.', v_cupo using errcode = 'check_violation';
    end if;
  end if;

  select e.nombre into v_otro
  from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
  where h.hembra_id = new.hembra_id and e.cerrado_en is null and e.id <> new.empadronamiento_id limit 1;
  if v_otro is not null then
    raise exception 'Esa hembra ya está en otro empadronamiento abierto («%»).', v_otro using errcode = 'check_violation';
  end if;

  if coalesce(v_ext, false) then
    new.endogamia := 0;
    new.excepcion := false;
    return new;
  end if;
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

-- Cierre: con un semental de otro hato el servicio queda con su nombre, chip y hato escritos (`macho_externo`), no con un animal del hato.
create or replace function public.cerrar_empadronamiento(p_lote uuid, p_cierre date, p_base date default null)
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

  insert into public.servicios (finca_id, hembra_id, fecha, tipo, macho_id, macho_externo, observaciones)
  select h.finca_id, h.hembra_id, v_base, 'monta_natural',
         case when m.externo then null else h.macho_id end,
         case when m.externo then left(format('%s (chip %s, hato %s)', se.nombre, se.chip, se.hato_origen), 200) end,
         'Empadronamiento «' || v_lote.nombre || '»: fecha base para calcular el parto.'
  from public.empadronamiento_hembras h
  join public.empadronamiento_machos m on m.empadronamiento_id = h.empadronamiento_id and m.macho_id = h.macho_id
  left join public.sementales_externos se on m.externo and se.id = m.macho_id
  where h.empadronamiento_id = p_lote
    and not exists (
      select 1 from public.servicios s
      where s.hembra_id = h.hembra_id and s.fecha between v_lote.fecha_inicio and p_cierre);
  get diagnostics v_n = row_count;
  return jsonb_build_object('hembras', v_total, 'servicios_creados', v_n);
end;
$$;
