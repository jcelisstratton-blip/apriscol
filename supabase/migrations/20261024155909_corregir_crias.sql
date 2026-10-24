-- Corregir las crías de un parto ya registrado: sexo, peso y si nació viva o muerta. Solo las que todavía no son un animal del hato (una cría que ya es animal se
-- corrige en su propia ficha). Corre con los permisos de quien llama (RLS aplica) y comprueba `private.puede_escribir`. Todo o nada.
create or replace function public.corregir_crias(p_finca uuid, p_parto uuid, p_crias jsonb)
returns integer
language plpgsql set search_path = ''
as $$
declare
  v_cria jsonb;
  v_n integer := 0;
  v_filas integer;
begin
  if not private.puede_escribir(p_finca, 'reproduccion') then
    raise exception 'No tienes permiso para corregir partos en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_crias is null or jsonb_typeof(p_crias) <> 'array' then
    raise exception 'No se entendieron los datos de las crías.' using errcode = 'check_violation';
  end if;
  for v_cria in select * from jsonb_array_elements(p_crias) loop
    update public.crias
       set sexo = nullif(v_cria ->> 'sexo', '')::public.sexo_animal,
           peso_nacer_kg = nullif(v_cria ->> 'peso', '')::numeric,
           vivo = coalesce((v_cria ->> 'vivo')::boolean, vivo)
     where id = (v_cria ->> 'id')::uuid and parto_id = p_parto and finca_id = p_finca and animal_id is null;
    get diagnostics v_filas = row_count;
    v_n := v_n + v_filas;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.corregir_crias(uuid, uuid, jsonb) from public, anon;
grant execute on function public.corregir_crias(uuid, uuid, jsonb) to authenticated;
