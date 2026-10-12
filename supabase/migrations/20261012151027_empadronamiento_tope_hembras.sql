-- Empadronamiento: el número de hembras por semental, cuando la temporada lo fija, es un tope exacto.
-- Tope de hembras por semental: si la temporada fijó `hembras_por_macho`, la base no deja asignar más (no depende de la pantalla).
-- Se bloquea la fila de la temporada mientras se asigna para que dos personas a la vez no se pasen del tope.
create or replace function private.emp_hembras_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_umbral numeric; v_f numeric; v_otro text; v_estado text; v_n int;
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

  if tg_op = 'INSERT' and v_lote.hembras_por_macho is not null then
    select count(*) into v_n from public.empadronamiento_hembras h where h.empadronamiento_id = new.empadronamiento_id and h.macho_id = new.macho_id;
    if v_n >= v_lote.hembras_por_macho then
      raise exception 'Este semental ya tiene sus % hembras: es el máximo que fijaste para la temporada.', v_lote.hembras_por_macho using errcode = 'check_violation';
    end if;
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
