-- Atomicidad (segunda entrega, parte B): eliminar un parto, eliminar un empadronamiento y quitar un semental son UNA sola
-- transacción (antes la app encadenaba un borrado tras otro). Corren con los permisos de quien llama (RLS aplica).

-- ───────── 1. Eliminar un parto (y la lactancia que abrió) ─────────
create or replace function public.eliminar_parto(p_finca uuid, p_parto uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_madre uuid;
begin
  if not private.puede_gestionar(p_finca) then
    raise exception 'Solo el propietario o un administrador puede eliminar partos.' using errcode = 'insufficient_privilege';
  end if;
  select madre_id into v_madre from public.partos where id = p_parto and finca_id = p_finca;
  if not found then
    raise exception 'No encontramos ese parto.' using errcode = 'no_data_found';
  end if;
  if exists (
    select 1 from public.lactancias l join public.ordenos o on o.lactancia_id = l.id
     where l.parto_id = p_parto and l.finca_id = p_finca
  ) then
    raise exception 'Este parto abrió una lactancia que ya tiene ordeños registrados, así que no se puede eliminar.' using errcode = 'restrict_violation';
  end if;
  delete from public.lactancias where parto_id = p_parto and finca_id = p_finca;
  delete from public.partos where id = p_parto and finca_id = p_finca;
  return v_madre;
end;
$$;
revoke execute on function public.eliminar_parto(uuid, uuid) from public, anon;
grant execute on function public.eliminar_parto(uuid, uuid) to authenticated;

-- ───────── 2. Eliminar un empadronamiento (y los sementales de otro hato que solo vivían en él) ─────────
create or replace function public.eliminar_empadronamiento(p_finca uuid, p_lote uuid)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_cerrado date;
  v_externos uuid[];
begin
  if not private.puede_gestionar(p_finca) then
    raise exception 'Solo el propietario o un administrador puede eliminar empadronamientos.' using errcode = 'insufficient_privilege';
  end if;
  select cerrado_en into v_cerrado from public.empadronamientos where id = p_lote and finca_id = p_finca;
  if not found then
    raise exception 'No encontramos ese empadronamiento.' using errcode = 'no_data_found';
  end if;
  if v_cerrado is not null then
    raise exception 'Un empadronamiento cerrado queda como historia: ya generó los servicios de sus hembras y no se elimina.' using errcode = 'restrict_violation';
  end if;
  select coalesce(array_agg(macho_id), '{}') into v_externos
    from public.empadronamiento_machos where empadronamiento_id = p_lote and finca_id = p_finca and externo;
  delete from public.empadronamientos where id = p_lote and finca_id = p_finca;
  delete from public.sementales_externos where id = any (v_externos) and finca_id = p_finca;
end;
$$;
revoke execute on function public.eliminar_empadronamiento(uuid, uuid) from public, anon;
grant execute on function public.eliminar_empadronamiento(uuid, uuid) to authenticated;

-- ───────── 4. Quitar un semental de una temporada abierta (y sus datos si era de otro hato) ─────────
create or replace function public.quitar_semental(p_finca uuid, p_lote uuid, p_macho uuid)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_cerrado date;
  v_hembras integer;
  v_externo boolean;
begin
  if not private.puede_gestionar(p_finca) then
    raise exception 'Solo el propietario o un administrador puede quitar sementales.' using errcode = 'insufficient_privilege';
  end if;
  select cerrado_en into v_cerrado from public.empadronamientos where id = p_lote and finca_id = p_finca;
  if not found then
    raise exception 'No encontramos ese empadronamiento.' using errcode = 'no_data_found';
  end if;
  if v_cerrado is not null then
    raise exception 'Este empadronamiento ya está cerrado: es parte de la historia y no se cambia.' using errcode = 'restrict_violation';
  end if;
  select count(*) into v_hembras from public.empadronamiento_hembras where empadronamiento_id = p_lote and macho_id = p_macho;
  if v_hembras > 0 then
    raise exception 'Ese semental tiene % % Quítalas primero.', v_hembras, case when v_hembras = 1 then 'hembra asignada.' else 'hembras asignadas.' end
      using errcode = 'restrict_violation';
  end if;
  delete from public.empadronamiento_machos
   where empadronamiento_id = p_lote and macho_id = p_macho and finca_id = p_finca
  returning externo into v_externo;
  if coalesce(v_externo, false) then
    delete from public.sementales_externos where id = p_macho and finca_id = p_finca;
  end if;
end;
$$;
revoke execute on function public.quitar_semental(uuid, uuid, uuid) from public, anon;
grant execute on function public.quitar_semental(uuid, uuid, uuid) to authenticated;
