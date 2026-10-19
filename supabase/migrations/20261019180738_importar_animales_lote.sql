-- Cargue masivo de animales desde una plantilla de Excel. La app valida y ordena las filas (padres antes que crías);
-- esta función solo las inserta, todas o ninguna, respetando los mismos disparadores que el formulario de un animal.
-- Corre con los permisos de quien llama (RLS aplica) y además exige poder escribir en el Hato de esa finca.
create function public.importar_animales_lote(p_finca uuid, p_filas jsonb)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  c_max constant integer := 500;
  v_fila jsonb;
  v_i integer := 0;
  v_nfila text;
  v_arete text;
  v_padre uuid;
  v_madre uuid;
  v_id uuid;
  v_sexo public.sexo_animal;
  v_uso text;
  v_parto date;
  v_nuevos integer := 0;
  v_con_padres integer := 0;
  v_partos integer := 0;
begin
  if not private.puede_escribir(p_finca, 'hato') then
    raise exception 'No tienes permiso para registrar animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene animales para cargar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_filas) > c_max then
    raise exception 'Son demasiados animales a la vez (máximo %).', c_max using errcode = 'check_violation';
  end if;

  for v_fila in select * from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;
    v_arete := btrim(v_fila ->> 'numero_arete');
    -- `fila` es la fila del Excel de la persona (las filas llegan reordenadas: padres primero).
    v_nfila := coalesce(nullif(v_fila ->> 'fila', ''), (v_i + 1)::text);
    begin
      v_padre := null; v_madre := null; v_uso := null; v_parto := null;
      v_sexo := (v_fila ->> 'sexo')::public.sexo_animal;

      if nullif(btrim(v_fila ->> 'padre_arete'), '') is not null then
        select id into v_padre from public.animales
        where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'padre_arete'));
        if v_padre is null then
          raise exception 'El padre con arete «%» no está en el hato ni antes en el archivo.', btrim(v_fila ->> 'padre_arete') using errcode = 'check_violation';
        end if;
      end if;
      if nullif(btrim(v_fila ->> 'madre_arete'), '') is not null then
        select id into v_madre from public.animales
        where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'madre_arete'));
        if v_madre is null then
          raise exception 'La madre con arete «%» no está en el hato ni antes en el archivo.', btrim(v_fila ->> 'madre_arete') using errcode = 'check_violation';
        end if;
      end if;

      if v_sexo = 'macho' and v_fila ->> 'uso_macho' in ('reproductor', 'carne') then v_uso := v_fila ->> 'uso_macho'; end if;
      if v_sexo = 'hembra' then v_parto := nullif(v_fila ->> 'fecha_ultimo_parto', '')::date; end if;

      insert into public.animales (
        finca_id, especie, numero_arete, nombre, sexo, raza_id, fecha_nacimiento, fecha_nacimiento_aprox,
        padre_id, madre_id, padre_externo, madre_externa, origen, vocacion, uso_macho,
        chip, color, marcas, notas, peso_nacer_kg, valor_compra, fecha_compra
      ) values (
        p_finca,
        (v_fila ->> 'especie')::public.especie,
        v_arete,
        nullif(btrim(v_fila ->> 'nombre'), ''),
        v_sexo,
        nullif(v_fila ->> 'raza_id', '')::smallint,
        nullif(v_fila ->> 'fecha_nacimiento', '')::date,
        coalesce((v_fila ->> 'fecha_nacimiento_aprox')::boolean, false),
        v_padre, v_madre,
        case when v_padre is null then nullif(btrim(v_fila ->> 'padre_externo'), '') end,
        case when v_madre is null then nullif(btrim(v_fila ->> 'madre_externa'), '') end,
        coalesce(nullif(v_fila ->> 'origen', ''), 'nacido_en_finca'),
        case when v_sexo = 'macho' then 'carne'::public.vocacion_animal
             else coalesce(nullif(v_fila ->> 'vocacion', ''), 'leche')::public.vocacion_animal end,
        v_uso,
        nullif(btrim(v_fila ->> 'chip'), ''),
        nullif(btrim(v_fila ->> 'color'), ''),
        nullif(btrim(v_fila ->> 'marcas'), ''),
        nullif(btrim(v_fila ->> 'notas'), ''),
        nullif(v_fila ->> 'peso_nacer_kg', '')::numeric,
        nullif(v_fila ->> 'valor_compra', '')::numeric,
        nullif(v_fila ->> 'fecha_compra', '')::date
      ) returning id into v_id;

      v_nuevos := v_nuevos + 1;
      if v_padre is not null or v_madre is not null then v_con_padres := v_con_padres + 1; end if;

      if v_parto is not null then
        insert into public.lactancias (finca_id, animal_id, numero, fecha_parto) values (p_finca, v_id, 1, v_parto);
        v_partos := v_partos + 1;
      end if;
    exception when others then
      if sqlstate = '23505' and sqlerrm like '%animales_arete_uk%' then
        raise exception 'Fila %, arete «%»: ya existe un animal con ese arete en esta finca.', v_nfila, v_arete using errcode = 'unique_violation';
      end if;
      raise exception 'Fila %, arete «%»: %', v_nfila, v_arete, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  return jsonb_build_object('animales', v_nuevos, 'con_padres', v_con_padres, 'con_parto', v_partos);
end;
$$;
revoke execute on function public.importar_animales_lote(uuid, jsonb) from public, anon;
grant execute on function public.importar_animales_lote(uuid, jsonb) to authenticated;
