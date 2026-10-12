-- Un análisis que respalda un control de un despacho no puede perder su documento ni el resultado que respalda: si no, la constancia
-- quedaría sin prueba. (El análisis tampoco se puede borrar: la llave foránea del control lo impide.)
create function private.analisis_leche_falta(a public.analisis_leche, p_tipo text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when a.animal_id is not null then 'Para un despacho se usa un análisis del tanque o del lote, no de un animal.'
    when a.soporte_path is null then 'Ese análisis no tiene su documento adjunto. Adjúntalo para usarlo como respaldo.'
    when (p_tipo = 'residuos_antibioticos' and a.residuos_antibioticos is null)
      or (p_tipo = 'crioscopia' and a.crioscopia_c is null)
      or (p_tipo = 'composicion' and a.grasa_pct is null and a.proteina_pct is null and a.solidos_totales_pct is null and a.lactosa_pct is null)
      or (p_tipo = 'celulas_somaticas' and a.rcs_miles_ml is null) then 'Ese análisis no incluye el resultado de este control.'
  end;
$$;

create or replace function private.controles_calidad_validar()
returns trigger
language plpgsql set search_path = ''
as $$
declare a public.analisis_leche; motivo text;
begin
  if new.analisis_id is null then
    return new;
  end if;
  select * into a from public.analisis_leche where id = new.analisis_id and finca_id = new.finca_id;
  if not found then
    raise exception 'No encontramos ese análisis.' using errcode = 'check_violation';
  end if;
  motivo := private.analisis_leche_falta(a, new.tipo);
  if motivo is not null then
    raise exception '%', motivo using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create function private.analisis_leche_proteger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare c record; motivo text;
begin
  for c in select tipo from public.controles_calidad where analisis_id = new.id and finca_id = new.finca_id loop
    motivo := private.analisis_leche_falta(new, c.tipo);
    if motivo is not null then
      raise exception 'Este análisis respalda un despacho y no se puede dejar sin su respaldo. %', motivo using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;
create trigger analisis_leche_proteger before update on public.analisis_leche
  for each row execute function private.analisis_leche_proteger();
