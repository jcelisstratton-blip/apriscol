-- Definir si varias ovejas son de lana o de pelo de una sola vez (todo o nada). Solo ovejas activas de esa finca; quien llama debe poder escribir en el Hato.
-- Retrocompatible: solo agrega una función. Sirve para las criollas y los cruces, que la raza no define.
create function public.definir_cobertura(p_finca uuid, p_animales uuid[], p_cobertura text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_distintos uuid[];
  v_n integer;
begin
  if not private.puede_escribir(p_finca, 'hato') then
    raise exception 'No tienes permiso para cambiar animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_cobertura is null or p_cobertura not in ('lana', 'pelo') then
    raise exception 'Elige si son de lana o de pelo.' using errcode = 'check_violation';
  end if;
  if p_animales is null or cardinality(p_animales) = 0 then
    raise exception 'Elige al menos una oveja.' using errcode = 'check_violation';
  end if;
  if cardinality(p_animales) > 1000 then
    raise exception 'Son demasiadas ovejas a la vez (máximo 1000).' using errcode = 'check_violation';
  end if;
  select array_agg(distinct a) into v_distintos from unnest(p_animales) as a;

  update public.animales set cobertura = p_cobertura
  where finca_id = p_finca and id = any (v_distintos) and especie = 'ovino' and estado = 'activo' and deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n <> cardinality(v_distintos) then
    raise exception 'Hay un animal que no es una oveja activa de esta finca.' using errcode = 'check_violation';
  end if;
  return v_n;
end;
$$;
revoke execute on function public.definir_cobertura(uuid, uuid[], text) from public, anon;
grant execute on function public.definir_cobertura(uuid, uuid[], text) to authenticated;
