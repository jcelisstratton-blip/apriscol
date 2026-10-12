-- Hacinamiento bloqueado y movimientos editables.
--  · Una instalación con capacidad no admite más animales de los que caben: lo exigen mover_animales (mensaje claro, antes de tocar nada),
--    un disparador sobre movimientos_animales (por si se escribe directo) y otro sobre ubicaciones (no se baja la capacidad por debajo de los
--    animales que hay).
--  · editar_movimiento corrige a qué instalación fue un animal, desde cuándo, el motivo y la nota, sin dejar fechas cruzadas.

create function private.movimiento_cupo() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_cap integer; v_nombre text; v_n integer;
begin
  if new.hasta is not null then return new; end if;
  if tg_op = 'UPDATE' and old.hasta is null and old.ubicacion_id = new.ubicacion_id then return new; end if;
  select capacidad, nombre into v_cap, v_nombre from public.ubicaciones where id = new.ubicacion_id;
  if v_cap is null then return new; end if;
  select count(*) into v_n from public.movimientos_animales where ubicacion_id = new.ubicacion_id and hasta is null and id <> new.id;
  if v_n + 1 > v_cap then
    raise exception '% está llena: caben % animales y ya tiene %.', v_nombre, v_cap, v_n using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger movimientos_cupo before insert or update of ubicacion_id, hasta on public.movimientos_animales
  for each row execute function private.movimiento_cupo();

create function private.ubicacion_capacidad_minima() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  select count(*) into v_n from public.movimientos_animales where ubicacion_id = new.id and hasta is null;
  if v_n > new.capacidad then
    raise exception 'Hoy hay % animales en %: no puedes bajar la capacidad a % sin mover antes a algunos.', v_n, new.nombre, new.capacidad using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger ubicaciones_capacidad_minima before update of capacidad on public.ubicaciones
  for each row when (new.capacidad is not null and new.capacidad is distinct from old.capacidad)
  execute function private.ubicacion_capacidad_minima();

-- Mover animales: ahora comprueba el cupo del destino (contando solo a los que de verdad entran) y bloquea la instalación mientras mueve.
create or replace function public.mover_animales(p_finca uuid, p_ubicacion uuid, p_animales uuid[], p_fecha date, p_motivo text, p_observaciones text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_n integer := 0; v_a uuid; v_actual record;
  v_cap integer; v_nombre text; v_ocupan integer; v_entran integer; v_libres integer;
begin
  if not private.puede_escribir(p_finca, 'corrales') then
    raise exception 'No tienes permiso para mover animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_animales is null or cardinality(p_animales) = 0 then
    raise exception 'Elige al menos un animal.' using errcode = 'check_violation';
  end if;
  if cardinality(p_animales) > 1000 then
    raise exception 'Son demasiados animales a la vez (máximo 1000).' using errcode = 'check_violation';
  end if;
  if p_fecha is null or p_fecha > v_hoy or p_fecha < v_hoy - 366 then
    raise exception 'La fecha del movimiento debe ser de hoy o de hasta un año atrás.' using errcode = 'check_violation';
  end if;
  if p_ubicacion is not null then
    select u.capacidad, u.nombre into v_cap, v_nombre from public.ubicaciones u
      where u.id = p_ubicacion and u.finca_id = p_finca and u.activa for update;
    if not found then
      raise exception 'Esa instalación no existe o está archivada.' using errcode = 'check_violation';
    end if;
    if v_cap is not null then
      select count(*) into v_ocupan from public.movimientos_animales where ubicacion_id = p_ubicacion and hasta is null;
      select count(*) into v_entran from (select distinct unnest(p_animales) as a) t
        where not exists (select 1 from public.movimientos_animales m where m.animal_id = t.a and m.ubicacion_id = p_ubicacion and m.hasta is null);
      v_libres := greatest(0, v_cap - v_ocupan);
      if v_entran > v_libres then
        if v_libres = 0 then
          raise exception '% está llena: caben % animales y ya tiene %. Elige otra instalación o saca a algunos antes.', v_nombre, v_cap, v_ocupan using errcode = 'check_violation';
        end if;
        raise exception 'En % solo caben % animales más y quieres mover %. Quita % o elige otra instalación.', v_nombre, v_libres, v_entran, v_entran - v_libres using errcode = 'check_violation';
      end if;
    end if;
  end if;

  for v_a in select distinct unnest(p_animales) loop
    if not exists (select 1 from public.animales a where a.id = v_a and a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null) then
      raise exception 'Hay un animal que no está activo en esta finca.' using errcode = 'check_violation';
    end if;
    select id, ubicacion_id, desde into v_actual from public.movimientos_animales where animal_id = v_a and hasta is null;
    if found then
      if p_ubicacion is not null and v_actual.ubicacion_id = p_ubicacion then continue; end if;
      if p_fecha < v_actual.desde then
        raise exception 'La fecha no puede ser anterior a la entrada del animal a su ubicación actual (%).', to_char(v_actual.desde, 'DD/MM/YYYY') using errcode = 'check_violation';
      end if;
      update public.movimientos_animales set hasta = p_fecha where id = v_actual.id;
    elsif p_ubicacion is null then
      continue;
    end if;
    if p_ubicacion is not null then
      insert into public.movimientos_animales (finca_id, animal_id, ubicacion_id, desde, motivo, observaciones)
      values (p_finca, v_a, p_ubicacion, p_fecha, coalesce(nullif(p_motivo, ''), 'traslado'), nullif(p_observaciones, ''));
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Corregir un movimiento: la instalación, la fecha de entrada, el motivo y la nota. La fecha de salida no se toca (la fija el movimiento
-- siguiente); si el movimiento anterior terminaba justo cuando este empezaba, su salida se mueve con la entrada para no dejar huecos ni cruces.
create function public.editar_movimiento(p_id uuid, p_ubicacion uuid, p_desde date, p_motivo text, p_observaciones text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  m record; prev record; nxt record; v_adj boolean := false; v_min date;
begin
  select * into m from public.movimientos_animales where id = p_id;
  if not found then
    raise exception 'No encontramos ese movimiento.' using errcode = 'no_data_found';
  end if;
  if not private.puede_escribir(m.finca_id, 'corrales') then
    raise exception 'No tienes permiso para editar movimientos en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_desde is null or p_desde > v_hoy then
    raise exception 'La fecha de entrada no puede ser futura.' using errcode = 'check_violation';
  end if;
  if m.hasta is not null and p_desde > m.hasta then
    raise exception 'La entrada no puede ser después de la salida (%).', to_char(m.hasta, 'DD/MM/YYYY') using errcode = 'check_violation';
  end if;
  if p_motivo is null or p_motivo not in ('ingreso', 'traslado', 'rotacion', 'cuarentena', 'maternidad', 'otro') then
    raise exception 'Elige un motivo válido.' using errcode = 'check_violation';
  end if;
  perform 1 from public.ubicaciones u
    where u.id = p_ubicacion and u.finca_id = m.finca_id and (u.activa or u.id = m.ubicacion_id) for update;
  if not found then
    raise exception 'Esa instalación no existe o está archivada.' using errcode = 'check_violation';
  end if;

  select * into prev from public.movimientos_animales
    where animal_id = m.animal_id and id <> m.id and (desde, created_at) < (m.desde, m.created_at)
    order by desde desc, created_at desc limit 1;
  if found then
    v_adj := prev.hasta is not distinct from m.desde;
    v_min := case when v_adj then prev.desde else coalesce(prev.hasta, prev.desde) end;
    if p_desde < v_min then
      raise exception 'La entrada no puede ser antes del %, cuando entró al movimiento anterior.', to_char(v_min, 'DD/MM/YYYY') using errcode = 'check_violation';
    end if;
    if v_adj and prev.ubicacion_id = p_ubicacion then
      raise exception 'Justo antes ya estaba en esa instalación: edita ese movimiento en lugar de este.' using errcode = 'check_violation';
    end if;
  end if;
  select * into nxt from public.movimientos_animales
    where animal_id = m.animal_id and id <> m.id and (desde, created_at) > (m.desde, m.created_at)
    order by desde, created_at limit 1;
  if found and m.hasta is not null and nxt.desde = m.hasta and nxt.ubicacion_id = p_ubicacion then
    raise exception 'Justo después pasó a esa misma instalación: edita ese movimiento en lugar de este.' using errcode = 'check_violation';
  end if;

  if v_adj and p_desde <> m.desde then
    update public.movimientos_animales set hasta = p_desde where id = prev.id;
  end if;
  update public.movimientos_animales
     set ubicacion_id = p_ubicacion, desde = p_desde, motivo = p_motivo, observaciones = nullif(btrim(coalesce(p_observaciones, '')), '')
   where id = m.id;
end;
$$;
revoke execute on function public.editar_movimiento(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.editar_movimiento(uuid, uuid, date, text, text) to authenticated;
