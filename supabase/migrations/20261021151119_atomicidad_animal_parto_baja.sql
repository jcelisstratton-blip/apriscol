-- Atomicidad: registrar un animal con su lactancia, un parto con sus crías y dar de baja con el cierre de la lactancia
-- son UNA sola transacción en la base. Antes la app hacía varias llamadas seguidas y, si una fallaba a la mitad, quedaban
-- datos incompletos (un animal sin su lactancia, un parto sin crías). Corren con los permisos de quien llama (RLS aplica).

-- ───────── 1. Animal + primera lactancia ─────────
create or replace function public.registrar_animal(p_finca uuid, p_animal jsonb, p_fecha_ultimo_parto date default null)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
  v_solicitud uuid := nullif(p_animal ->> 'client_request_id', '')::uuid;
begin
  if not private.puede_escribir(p_finca, 'hato') then
    raise exception 'No tienes permiso para registrar animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  -- Doble toque: la misma solicitud ya se guardó → se devuelve ese animal. Se mira antes de insertar porque, si el arete
  -- también se repite, Postgres reporta primero el índice del arete y la solicitud repetida se confundiría con un arete repetido.
  if v_solicitud is not null then
    select id into v_id from public.animales where finca_id = p_finca and client_request_id = v_solicitud;
    if v_id is not null then return v_id; end if;
  end if;
  begin
    insert into public.animales (
      finca_id, especie, numero_arete, nombre, sexo, raza_id, fecha_nacimiento, fecha_nacimiento_aprox,
      padre_id, madre_id, padre_externo, madre_externa, origen, vocacion, uso_macho,
      chip, color, marcas, rasgos, notas, peso_nacer_kg, valor_compra, fecha_compra, foto_path, client_request_id
    ) values (
      p_finca,
      (p_animal ->> 'especie')::public.especie,
      btrim(p_animal ->> 'numero_arete'),
      nullif(btrim(p_animal ->> 'nombre'), ''),
      (p_animal ->> 'sexo')::public.sexo_animal,
      nullif(p_animal ->> 'raza_id', '')::smallint,
      nullif(p_animal ->> 'fecha_nacimiento', '')::date,
      coalesce((p_animal ->> 'fecha_nacimiento_aprox')::boolean, false),
      nullif(p_animal ->> 'padre_id', '')::uuid,
      nullif(p_animal ->> 'madre_id', '')::uuid,
      nullif(btrim(p_animal ->> 'padre_externo'), ''),
      nullif(btrim(p_animal ->> 'madre_externa'), ''),
      coalesce(nullif(p_animal ->> 'origen', ''), 'nacido_en_finca'),
      coalesce(nullif(p_animal ->> 'vocacion', ''), 'leche')::public.vocacion_animal,
      nullif(p_animal ->> 'uso_macho', ''),
      nullif(btrim(p_animal ->> 'chip'), ''),
      nullif(btrim(p_animal ->> 'color'), ''),
      nullif(btrim(p_animal ->> 'marcas'), ''),
      nullif(btrim(p_animal ->> 'rasgos'), ''),
      nullif(btrim(p_animal ->> 'notas'), ''),
      nullif(p_animal ->> 'peso_nacer_kg', '')::numeric,
      nullif(p_animal ->> 'valor_compra', '')::numeric,
      nullif(p_animal ->> 'fecha_compra', '')::date,
      nullif(p_animal ->> 'foto_path', ''),
      v_solicitud
    ) returning id into v_id;

    if p_fecha_ultimo_parto is not null then
      insert into public.lactancias (finca_id, animal_id, numero, fecha_parto) values (p_finca, v_id, 1, p_fecha_ultimo_parto);
    end if;
  exception when unique_violation then
    -- Doble toque: la misma solicitud ya se guardó (client_request_id único) → se devuelve ese animal.
    if v_solicitud is not null and sqlerrm like '%client_req%' then
      select id into v_id from public.animales where finca_id = p_finca and client_request_id = v_solicitud;
      if v_id is not null then return v_id; end if;
    end if;
    raise;
  end;
  return v_id;
end;
$$;
revoke execute on function public.registrar_animal(uuid, jsonb, date) from public, anon;
grant execute on function public.registrar_animal(uuid, jsonb, date) to authenticated;

-- ───────── 2. Parto + crías (+ animales de las crías con arete) ─────────
-- p_parto: madre_id, servicio_id, fecha, tipo, complicaciones, client_request_id, padre_id, padre_externo (del servicio).
-- p_crias: [{arete, nombre, sexo, peso, vivo}]. Una cría con arete se crea como animal si quien llama puede escribir en el Hato
-- (un veterinario no puede: el parto y la cría quedan y la respuesta dice cuáles aretes no se crearon).
create or replace function public.registrar_parto(p_finca uuid, p_parto jsonb, p_crias jsonb)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_madre uuid := (p_parto ->> 'madre_id')::uuid;
  v_fecha date := (p_parto ->> 'fecha')::date;
  v_solicitud uuid := nullif(p_parto ->> 'client_request_id', '')::uuid;
  v_especie public.especie;
  v_vocacion public.vocacion_animal;
  v_puede_hato boolean;
  v_parto uuid;
  v_cria jsonb;
  v_arete text;
  v_sexo text;
  v_animal uuid;
  v_sin text[] := '{}';
begin
  if not private.puede_escribir(p_finca, 'reproduccion') then
    raise exception 'No tienes permiso para registrar partos en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_crias is null or jsonb_typeof(p_crias) <> 'array' then
    raise exception 'No se entendieron los datos de las crías.' using errcode = 'check_violation';
  end if;
  select especie, vocacion into v_especie, v_vocacion from public.animales where id = v_madre and finca_id = p_finca and deleted_at is null;
  if not found then
    raise exception 'No encontramos a la hembra en tu finca.' using errcode = 'no_data_found';
  end if;
  v_puede_hato := private.puede_escribir(p_finca, 'hato');

  if v_solicitud is not null then
    select id into v_parto from public.partos where finca_id = p_finca and client_request_id = v_solicitud;
    if v_parto is not null then
      return jsonb_build_object('parto_id', v_parto, 'repetido', true, 'sin_crear', '[]'::jsonb);
    end if;
  end if;
  begin
    insert into public.partos (finca_id, madre_id, servicio_id, fecha, tipo, numero_crias, complicaciones, client_request_id)
    values (p_finca, v_madre, nullif(p_parto ->> 'servicio_id', '')::uuid, v_fecha, p_parto ->> 'tipo',
            jsonb_array_length(p_crias), nullif(btrim(p_parto ->> 'complicaciones'), ''), v_solicitud)
    returning id into v_parto;
  exception when unique_violation then
    -- Doble toque: este parto ya se guardó con sus crías; no se repite.
    if v_solicitud is not null and sqlerrm like '%client_req%' then
      select id into v_parto from public.partos where finca_id = p_finca and client_request_id = v_solicitud;
      if v_parto is not null then
        return jsonb_build_object('parto_id', v_parto, 'repetido', true, 'sin_crear', '[]'::jsonb);
      end if;
    end if;
    raise;
  end;

  for v_cria in select * from jsonb_array_elements(p_crias) loop
    v_animal := null;
    v_arete := nullif(btrim(v_cria ->> 'arete'), '');
    v_sexo := nullif(v_cria ->> 'sexo', '');
    if v_arete is not null then
      if v_puede_hato then
        begin
          insert into public.animales (
            finca_id, especie, numero_arete, nombre, sexo, origen, fecha_nacimiento, fecha_nacimiento_aprox,
            madre_id, padre_id, padre_externo, vocacion, peso_nacer_kg
          ) values (
            p_finca, v_especie, v_arete, nullif(btrim(v_cria ->> 'nombre'), ''), v_sexo::public.sexo_animal,
            'nacido_en_finca', v_fecha, false,
            v_madre, nullif(p_parto ->> 'padre_id', '')::uuid, nullif(btrim(p_parto ->> 'padre_externo'), ''),
            case when v_sexo = 'macho' then 'carne'::public.vocacion_animal else v_vocacion end,
            nullif(v_cria ->> 'peso', '')::numeric
          ) returning id into v_animal;
        exception when unique_violation then
          raise exception 'El arete % ya está en tu hato. Usa otro para la cría.', v_arete using errcode = 'unique_violation';
        end;
      else
        v_sin := v_sin || v_arete;
      end if;
    end if;
    insert into public.crias (finca_id, parto_id, animal_id, sexo, peso_nacer_kg, vivo)
    values (p_finca, v_parto, v_animal, v_sexo::public.sexo_animal, nullif(v_cria ->> 'peso', '')::numeric,
            coalesce((v_cria ->> 'vivo')::boolean, true));
  end loop;

  return jsonb_build_object('parto_id', v_parto, 'repetido', false, 'sin_crear', to_jsonb(v_sin));
end;
$$;
revoke execute on function public.registrar_parto(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_parto(uuid, jsonb, jsonb) to authenticated;

-- ───────── 3. La baja cierra la lactancia abierta en la misma transacción ─────────
-- Antes lo hacía la app con una segunda llamada que podía fallar y dejar una hembra vendida "en ordeño".
create or replace function private.baja_aplicar()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.animales
    set estado = case new.tipo
          when 'venta' then 'vendido'
          when 'sacrificio' then 'sacrificado'
          when 'muerte' then 'muerto'
          else 'perdido'
        end,
        fecha_baja = new.fecha
    where id = new.animal_id;
    -- Una hembra que sale del hato sale también del ordeño.
    update public.lactancias
       set fecha_secado = greatest(new.fecha, fecha_parto)
     where animal_id = new.animal_id and finca_id = new.finca_id and fecha_secado is null;
    return new;
  else
    update public.animales set estado = 'activo', fecha_baja = null where id = old.animal_id;
    return old;
  end if;
end;
$$;
