-- Empadronamiento: el número de hembras es POR SEMENTAL (cada semental tiene el suyo), no uno solo para toda la temporada.
--  · empadronamiento_machos.num_hembras: cuántas hembras tendrá ese semental. Si está fijado, es un tope exacto.
--    (empadronamientos.hembras_por_macho queda en desuso: solo se usa como respaldo para filas antiguas sin número.)
--  · No se puede bajar el número por debajo de las hembras que el semental ya tiene.

alter table public.empadronamiento_machos
  add column num_hembras smallint check (num_hembras is null or num_hembras between 1 and 100);
comment on column public.empadronamiento_machos.num_hembras is 'Cuántas hembras tendrá este semental en la temporada (tope exacto).';
comment on column public.empadronamientos.hembras_por_macho is 'En desuso: el número de hembras es por semental (empadronamiento_machos.num_hembras).';

create or replace function private.emp_machos_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_n int;
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
  if tg_op = 'UPDATE' and new.num_hembras is not null then
    select count(*) into v_n from public.empadronamiento_hembras h where h.empadronamiento_id = new.empadronamiento_id and h.macho_id = new.macho_id;
    if v_n > new.num_hembras then
      raise exception 'Este semental ya tiene % hembras: el número no puede ser menor.', v_n using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.emp_hembras_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_umbral numeric; v_f numeric; v_otro text; v_estado text; v_n int; v_cupo int;
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

  if tg_op = 'INSERT' then
    select coalesce(m.num_hembras, v_lote.hembras_por_macho) into v_cupo
    from public.empadronamiento_machos m where m.empadronamiento_id = new.empadronamiento_id and m.macho_id = new.macho_id;
    if v_cupo is not null then
      select count(*) into v_n from public.empadronamiento_hembras h where h.empadronamiento_id = new.empadronamiento_id and h.macho_id = new.macho_id;
      if v_n >= v_cupo then
        raise exception 'Este semental ya tiene sus % hembras: es el número que fijaste para él en la temporada.', v_cupo using errcode = 'check_violation';
      end if;
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
