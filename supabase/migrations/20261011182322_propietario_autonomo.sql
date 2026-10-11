-- El propietario es dueño y administrador de su finca: trae sus animales del libro sin aprobación de nadie.
-- El libro completo (otros criaderos, documentos) deja de ser consultable por las fincas; solo lo ve el superadmin.
-- Las fincas solo reciben el cálculo (endogamia, completitud) a través de funciones que validan su propia finca.

-- ───────────────────────── 1. El libro ya no es legible por las fincas ─────────────────────────
-- (la política del libro y el retiro de las funciones de aprobación van en la migración siguiente)

revoke execute on function public.coef_endogamia_libro(uuid), public.simular_endogamia_libro(uuid, uuid),
  public.completitud_pedigri_libro(uuid, int) from authenticated;

-- ───────────────────────── 2. Endogamia sobre el pedigrí completo, validando la finca ─────────────────────────
create or replace function public.coef_endogamia(p_animal uuid) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_padre uuid; v_madre uuid; v_libro uuid; lp uuid; lm uuid; r double precision;
begin
  select padre_id, madre_id, libro_id into v_padre, v_madre, v_libro
  from public.animales
  where id = p_animal and deleted_at is null and private.puede_ver(finca_id, 'hato');
  if not found then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if v_libro is not null then
    select padre_id, madre_id into lp, lm from public.libro_genealogico where id = v_libro;
    if lp is not null and lm is not null then
      return round((0.5 * coalesce(private.relacion_libro(lp, lm), 0))::numeric, 6);
    end if;
  end if;
  if v_padre is null or v_madre is null then return 0; end if;
  r := private.relacion_aditiva(v_padre, v_madre);
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

create or replace function public.simular_endogamia(p_macho uuid, p_hembra uuid) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  m record; h record; r double precision;
begin
  select id, finca_id, sexo, especie, libro_id into m
  from public.animales where id = p_macho and deleted_at is null and private.puede_ver(finca_id, 'hato');
  select id, finca_id, sexo, especie, libro_id into h
  from public.animales where id = p_hembra and deleted_at is null and private.puede_ver(finca_id, 'hato');
  if m.id is null or h.id is null then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if m.sexo <> 'macho' or h.sexo <> 'hembra' then
    raise exception 'La simulación requiere un macho y una hembra.' using errcode = 'check_violation';
  end if;
  if m.finca_id <> h.finca_id or m.especie <> h.especie then
    raise exception 'Ambos animales deben ser de la misma finca y especie.' using errcode = 'check_violation';
  end if;
  if m.libro_id is not null and h.libro_id is not null then
    r := private.relacion_libro(m.libro_id, h.libro_id);
  else
    r := private.relacion_aditiva(p_macho, p_hembra);
  end if;
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

create or replace function public.completitud_pedigri(p_animal uuid, p_generaciones int default 4) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_libro uuid; v_ok boolean; v numeric;
begin
  select libro_id, true into v_libro, v_ok
  from public.animales where id = p_animal and deleted_at is null and private.puede_ver(finca_id, 'hato');
  if v_ok is not true then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if v_libro is not null then
    return private.completitud_libro(v_libro, p_generaciones);
  end if;
  with recursive s (id, g) as (
    select p_animal, 0
    union all
    select x.v, s.g + 1
    from s
    join public.animales a on a.id = s.id
    cross join lateral (values (a.padre_id), (a.madre_id)) x (v)
    where s.g < p_generaciones
  )
  select round(
    count(*) filter (where id is not null and g between 1 and p_generaciones)::numeric
    / (power(2::numeric, p_generaciones + 1) - 2), 3)
  into v from s;
  return v;
end;
$$;

revoke execute on function public.coef_endogamia(uuid), public.simular_endogamia(uuid, uuid),
  public.completitud_pedigri(uuid, int) from public, anon;
grant execute on function public.coef_endogamia(uuid), public.simular_endogamia(uuid, uuid),
  public.completitud_pedigri(uuid, int) to authenticated;

-- ───────────────────────── 3. Traer los animales propios (sin aprobación) ─────────────────────────
-- Copia solo lo que le sirve al propietario: nombre, identificación (chip), raza, sexo, nacimiento, color, rasgos,
-- marcas, padre y madre, estado. El prefijo, el libro, el puntaje y demás datos de la asociación se quedan en el libro.
create function private.traer_titular_a_finca(p_finca uuid, p_titular uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prop public.vocacion_animal; v_importados int; v_padres int; v_madres int;
begin
  select proposito into v_prop from public.fincas where id = p_finca;

  update public.fincas f set especies = (
    select array_agg(distinct e) from unnest(
      f.especies || array(select distinct l.especie from public.libro_genealogico l where l.titular_id = p_titular)) e)
  where f.id = p_finca;

  with src as (
    select l.*, r.aptitud, pl.nombre as padre_nombre, ml.nombre as madre_nombre
    from public.libro_genealogico l
    left join public.razas r on r.id = l.raza_id
    left join public.libro_genealogico pl on pl.id = l.padre_id
    left join public.libro_genealogico ml on ml.id = l.madre_id
    where l.titular_id = p_titular
      and not exists (select 1 from public.animales a where a.libro_id = l.id and a.deleted_at is null)
  ), ins as (
    insert into public.animales (
      finca_id, especie, numero_arete, nombre, sexo, raza_id, fecha_nacimiento, origen, vocacion, estado, fecha_baja,
      notas, chip, color, rasgos, marcas, libro_id, padre_externo, madre_externa)
    select p_finca, l.especie, coalesce(nullif(l.chip, ''), l.numero_registro), l.nombre, l.sexo,
           l.raza_id, l.fecha_nacimiento,
           case when l.criador_id is not null and l.criador_id = l.titular_id then 'nacido_en_finca' else 'comprado' end,
           coalesce(l.aptitud, v_prop),
           case when l.estado = 'vivo' then 'activo' else 'muerto' end,
           case when l.estado = 'vivo' then null else coalesce(l.fecha_baja, current_date) end,
           nullif(concat_ws(E'\n', l.observaciones,
             case when l.estado = 'baja' and l.fecha_baja is null then 'Baja sin fecha en el registro de origen.' end), ''),
           l.chip, l.color, l.rasgos, l.marcas, l.id,
           case when l.padre_id is not null then l.padre_nombre else l.padre_chip_origen end,
           case when l.madre_id is not null then l.madre_nombre else l.madre_chip_origen end
    from src l
    on conflict do nothing
    returning 1)
  select count(*) into v_importados from ins;

  with u as (
    update public.animales a set padre_id = pa.id
    from public.libro_genealogico l
    join public.animales pa on pa.libro_id = l.padre_id and pa.finca_id = p_finca and pa.deleted_at is null
    where a.libro_id = l.id and a.finca_id = p_finca and a.deleted_at is null and a.padre_id is null
      and pa.sexo = 'macho' and pa.especie = a.especie and pa.id <> a.id
      and (pa.fecha_nacimiento is null or a.fecha_nacimiento is null or pa.fecha_nacimiento < a.fecha_nacimiento)
    returning 1)
  select count(*) into v_padres from u;

  with u as (
    update public.animales a set madre_id = ma.id
    from public.libro_genealogico l
    join public.animales ma on ma.libro_id = l.madre_id and ma.finca_id = p_finca and ma.deleted_at is null
    where a.libro_id = l.id and a.finca_id = p_finca and a.deleted_at is null and a.madre_id is null
      and ma.sexo = 'hembra' and ma.especie = a.especie and ma.id <> a.id
      and (ma.fecha_nacimiento is null or a.fecha_nacimiento is null or ma.fecha_nacimiento < a.fecha_nacimiento)
    returning 1)
  select count(*) into v_madres from u;

  return jsonb_build_object('importados', v_importados, 'padres_enlazados', v_padres, 'madres_enlazadas', v_madres);
end;
$$;
revoke all on function private.traer_titular_a_finca(uuid, uuid) from public, anon, authenticated;

create function public.traer_animales_libro(p_finca uuid, p_documento text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_digitos text := private.normalizar_documento(p_documento);
  v_titular uuid; v_total int; v_intentos int; v_sol uuid; v_res jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  if not private.puede_gestionar(p_finca) then
    raise exception 'Solo el propietario o un administrador de la finca puede traer animales.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_digitos) < 5 then
    raise exception 'Escribe el número de documento completo.' using errcode = 'check_violation';
  end if;

  select count(*) into v_intentos from public.intentos_reclamo
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_intentos >= 10 then
    raise exception 'Demasiados intentos. Espera un rato antes de volver a probar.' using errcode = 'P0001';
  end if;

  -- Los NIT a veces se registran con o sin dígito de verificación.
  select id into v_titular from public.libro_titulares
  where entidad = 'ANCO'
    and documento_hash in (
      private.hash_documento(v_digitos),
      case when char_length(v_digitos) = 10 then private.hash_documento(left(v_digitos, 9)) end)
  limit 1;

  insert into public.intentos_reclamo (user_id, encontrado) values (v_uid, v_titular is not null);
  if v_titular is null then
    return jsonb_build_object('encontrado', false);
  end if;

  select count(*) into v_total
  from public.libro_genealogico l
  where l.titular_id = v_titular
    and not exists (select 1 from public.animales a where a.libro_id = l.id and a.deleted_at is null);
  if v_total = 0 then
    return jsonb_build_object('encontrado', true, 'importados', 0);
  end if;

  -- Queda constancia para el superadmin (quién, en qué finca, cuántos).
  insert into public.solicitudes_reclamo (finca_id, titular_id, solicitante_id, estado, animales_disponibles, resuelta_por, resuelta_en)
  values (p_finca, v_titular, v_uid, 'aprobada', v_total, v_uid, now())
  returning id into v_sol;

  v_res := private.traer_titular_a_finca(p_finca, v_titular);
  update public.solicitudes_reclamo set animales_importados = (v_res ->> 'importados')::int where id = v_sol;
  return jsonb_build_object('encontrado', true) || v_res;
end;
$$;

-- ───────────────────────── 4. Superadmin: ya no aprueba, supervisa y puede revertir ─────────────────────────
create function public.admin_revertir_importacion(p_solicitud uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  s public.solicitudes_reclamo; v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede revertir una importación.' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.solicitudes_reclamo where id = p_solicitud for update;
  if not found or s.estado <> 'aprobada' then
    raise exception 'La importación no existe o ya fue revertida.' using errcode = 'P0002';
  end if;
  update public.animales a set deleted_at = now()
  from public.libro_genealogico l
  where a.libro_id = l.id and l.titular_id = s.titular_id and a.finca_id = s.finca_id and a.deleted_at is null;
  get diagnostics v_n = row_count;
  update public.solicitudes_reclamo set estado = 'cancelada', motivo_rechazo = 'Revertida por administración',
    resuelta_por = (select auth.uid()), resuelta_en = now()
  where id = s.id;
  return v_n;
end;
$$;


revoke execute on function public.traer_animales_libro(uuid, text), public.admin_revertir_importacion(uuid) from public, anon;
grant execute on function public.traer_animales_libro(uuid, text), public.admin_revertir_importacion(uuid) to authenticated;

-- El historial de importaciones lo ve el dueño de la finca y el superadmin; ya no hay estado «pendiente» ni «rechazada».
alter table public.solicitudes_reclamo alter column estado set default 'aprobada';
