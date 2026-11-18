-- Esquila de ovejas (parte 2): las esquilas, las ovejas esquiladas y las funciones para registrarlas, corregirlas y anularlas.
-- Lo de la cobertura por raza y por oveja está en la migración anterior (esquila_de_ovejas).

-- 3) La esquila y las ovejas esquiladas.
create table public.esquilas (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id),
  fecha date not null,
  esquilador text check (esquilador is null or char_length(btrim(esquilador)) between 1 and 120),
  costo numeric(14, 2) check (costo is null or costo >= 0),
  notas text check (notas is null or char_length(notas) <= 1000),
  client_request_id uuid,
  anulada_en timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id)
);
create index esquilas_finca_fecha_idx on public.esquilas (finca_id, fecha desc) where anulada_en is null;
create unique index esquilas_client_req_uk on public.esquilas (finca_id, client_request_id) where client_request_id is not null;
create trigger esquilas_updated_at before update on public.esquilas
  for each row execute function private.set_updated_at();

create table public.esquila_animales (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id),
  esquila_id uuid not null,
  animal_id uuid not null,
  /** Kilos de vellón de esa oveja; vacío = no se pesó. */
  peso_vellon_kg numeric(5, 2) check (peso_vellon_kg is null or (peso_vellon_kg >= 0.05 and peso_vellon_kg <= 25)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint esquila_animales_esquila_fk foreign key (esquila_id, finca_id) references public.esquilas (id, finca_id),
  constraint esquila_animales_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id),
  unique (esquila_id, animal_id)
);
create index esquila_animales_animal_idx on public.esquila_animales (animal_id);
create index esquila_animales_finca_idx on public.esquila_animales (finca_id);
create trigger esquila_animales_updated_at before update on public.esquila_animales
  for each row execute function private.set_updated_at();

-- Última esquila de cada oveja y lo que ha dado en total (solo esquilas vigentes). Respeta RLS.
create view public.v_esquila_animal with (security_invoker = true) as
select ea.finca_id,
       ea.animal_id,
       max(e.fecha) as ultima_fecha,
       count(*) as esquilas,
       sum(ea.peso_vellon_kg) as vellon_total_kg
from public.esquila_animales ea
join public.esquilas e on e.id = ea.esquila_id and e.finca_id = ea.finca_id
where e.anulada_en is null
group by ea.finca_id, ea.animal_id;

select private.crear_politicas_finca('esquilas', 'hato');
select private.crear_politicas_finca('esquila_animales', 'hato');

revoke all on public.esquilas, public.esquila_animales, public.v_esquila_animal from anon;
grant select, insert, update on public.esquilas, public.esquila_animales to authenticated;
grant select on public.v_esquila_animal to authenticated;

-- 4) Registrar una esquila: todo o nada. Corre con permisos de la función, pero comprueba quién llama y que cada oveja sea de esa finca.
-- p_animales: [{"animal_id": "<uuid>", "peso_kg": 2.4}, …]; peso_kg es opcional.
create function public.registrar_esquila(
  p_finca uuid, p_fecha date, p_animales jsonb, p_esquilador text, p_costo numeric, p_notas text, p_client_request_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_id uuid;
  v_item jsonb;
  v_animal uuid;
  v_peso numeric;
  v_a record;
  v_cob text;
  v_vistos uuid[] := '{}';
begin
  if not private.puede_escribir(p_finca, 'hato') then
    raise exception 'No tienes permiso para registrar esquilas en esta finca.' using errcode = 'insufficient_privilege';
  end if;

  -- Idempotente: el mismo envío (doble toque, sin señal) devuelve la esquila ya creada, antes de validar nada más.
  if p_client_request_id is not null then
    select id into v_id from public.esquilas where finca_id = p_finca and client_request_id = p_client_request_id;
    if found then return v_id; end if;
  end if;

  if p_fecha is null or p_fecha > v_hoy then
    raise exception 'La fecha de la esquila no puede ser futura.' using errcode = 'check_violation';
  end if;
  if p_fecha < v_hoy - 1100 then
    raise exception 'La fecha de la esquila no puede ser de hace más de tres años.' using errcode = 'check_violation';
  end if;
  if p_animales is null or jsonb_typeof(p_animales) <> 'array' or jsonb_array_length(p_animales) = 0 then
    raise exception 'Elige al menos una oveja.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_animales) > 1000 then
    raise exception 'Son demasiadas ovejas a la vez (máximo 1000).' using errcode = 'check_violation';
  end if;

  -- Antes de escribir nada, todas las ovejas deben poder esquilarse.
  for v_item in select * from jsonb_array_elements(p_animales) loop
    begin
      v_animal := (v_item ->> 'animal_id')::uuid;
    exception when others then
      raise exception 'Hay una oveja que no se reconoce.' using errcode = 'check_violation';
    end;
    if v_animal is null or v_animal = any (v_vistos) then
      raise exception 'Una oveja está repetida en la lista.' using errcode = 'check_violation';
    end if;
    v_vistos := v_vistos || v_animal;

    select a.id, a.numero_arete, a.nombre, a.especie, a.estado, a.deleted_at, a.fecha_nacimiento, a.cobertura as cob_animal, r.cobertura as cob_raza
      into v_a
      from public.animales a left join public.razas r on r.id = a.raza_id
      where a.id = v_animal and a.finca_id = p_finca;
    if not found or v_a.deleted_at is not null or v_a.estado <> 'activo' then
      raise exception 'Hay una oveja que no está activa en esta finca.' using errcode = 'check_violation';
    end if;
    if v_a.especie <> 'ovino' then
      raise exception '«%» es una cabra: las cabras no se esquilan.', v_a.numero_arete using errcode = 'check_violation';
    end if;
    v_cob := coalesce(v_a.cob_animal, v_a.cob_raza);
    if v_cob = 'pelo' then
      raise exception '«%» es de pelo: las ovejas de pelo no se esquilan. Si de verdad es de lana, cámbialo en su ficha.', v_a.numero_arete using errcode = 'check_violation';
    end if;
    if v_cob is distinct from 'lana' then
      raise exception 'Define si «%» es de lana o de pelo en su ficha antes de registrar su esquila.', v_a.numero_arete using errcode = 'check_violation';
    end if;
    if v_a.fecha_nacimiento is not null and p_fecha < v_a.fecha_nacimiento then
      raise exception 'La fecha de la esquila no puede ser anterior al nacimiento de «%».', v_a.numero_arete using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.esquila_animales ea join public.esquilas e on e.id = ea.esquila_id and e.finca_id = ea.finca_id
      where ea.animal_id = v_animal and e.fecha = p_fecha and e.anulada_en is null
    ) then
      raise exception '«%» ya tiene una esquila registrada ese día.', v_a.numero_arete using errcode = 'check_violation';
    end if;
    if v_item ? 'peso_kg' and nullif(v_item ->> 'peso_kg', '') is not null then
      begin
        v_peso := (v_item ->> 'peso_kg')::numeric;
      exception when others then
        raise exception 'El peso del vellón de «%» no es un número.', v_a.numero_arete using errcode = 'check_violation';
      end;
      if v_peso < 0.05 or v_peso > 25 then
        raise exception 'El peso del vellón de «%» debe estar entre 0,05 y 25 kg.', v_a.numero_arete using errcode = 'check_violation';
      end if;
    end if;
  end loop;

  insert into public.esquilas (finca_id, fecha, esquilador, costo, notas, client_request_id)
  values (p_finca, p_fecha, nullif(btrim(p_esquilador), ''), p_costo, nullif(btrim(p_notas), ''), p_client_request_id)
  returning id into v_id;

  insert into public.esquila_animales (finca_id, esquila_id, animal_id, peso_vellon_kg)
  select p_finca, v_id, (e ->> 'animal_id')::uuid, nullif(e ->> 'peso_kg', '')::numeric
  from jsonb_array_elements(p_animales) e;

  return v_id;
end;
$$;

-- 5) Corregir una esquila: la fecha, quién esquiló, el costo, las notas y los kilos de cada oveja. Las ovejas de la esquila no cambian (para
-- eso se anula y se registra de nuevo). p_pesos: [{"animal_id": "<uuid>", "peso_kg": 2.4 | null}, …]
create function public.actualizar_esquila(
  p_esquila uuid, p_fecha date, p_esquilador text, p_costo numeric, p_notas text, p_pesos jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_e record;
  v_item jsonb;
  v_peso numeric;
  v_arete text;
begin
  select id, finca_id, anulada_en into v_e from public.esquilas where id = p_esquila;
  if not found then
    raise exception 'Esa esquila no existe.' using errcode = 'check_violation';
  end if;
  if not private.puede_escribir(v_e.finca_id, 'hato') then
    raise exception 'No tienes permiso para cambiar esquilas en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if v_e.anulada_en is not null then
    raise exception 'Esa esquila está anulada y no se puede cambiar.' using errcode = 'check_violation';
  end if;
  if p_fecha is null or p_fecha > v_hoy then
    raise exception 'La fecha de la esquila no puede ser futura.' using errcode = 'check_violation';
  end if;
  if p_fecha < v_hoy - 1100 then
    raise exception 'La fecha de la esquila no puede ser de hace más de tres años.' using errcode = 'check_violation';
  end if;

  select a.numero_arete into v_arete
  from public.esquila_animales ea
  join public.animales a on a.id = ea.animal_id and a.finca_id = ea.finca_id
  where ea.esquila_id = p_esquila
    and (a.fecha_nacimiento > p_fecha
         or exists (
           select 1 from public.esquila_animales ea2 join public.esquilas e2 on e2.id = ea2.esquila_id and e2.finca_id = ea2.finca_id
           where ea2.animal_id = ea.animal_id and e2.id <> p_esquila and e2.fecha = p_fecha and e2.anulada_en is null))
  limit 1;
  if found then
    raise exception 'Con esa fecha «%» quedaría esquilada antes de nacer o dos veces el mismo día.', v_arete using errcode = 'check_violation';
  end if;

  update public.esquilas
    set fecha = p_fecha, esquilador = nullif(btrim(p_esquilador), ''), costo = p_costo, notas = nullif(btrim(p_notas), '')
    where id = p_esquila;

  if p_pesos is not null and jsonb_typeof(p_pesos) = 'array' then
    for v_item in select * from jsonb_array_elements(p_pesos) loop
      v_peso := nullif(v_item ->> 'peso_kg', '')::numeric;
      if v_peso is not null and (v_peso < 0.05 or v_peso > 25) then
        raise exception 'El peso del vellón debe estar entre 0,05 y 25 kg.' using errcode = 'check_violation';
      end if;
      update public.esquila_animales set peso_vellon_kg = v_peso
        where esquila_id = p_esquila and animal_id = (v_item ->> 'animal_id')::uuid;
    end loop;
  end if;
end;
$$;

-- 6) Anular una esquila mal registrada: queda guardada pero ya no cuenta (ni en la ficha ni en los avisos).
create function public.anular_esquila(p_esquila uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finca uuid;
begin
  select finca_id into v_finca from public.esquilas where id = p_esquila;
  if not found then
    raise exception 'Esa esquila no existe.' using errcode = 'check_violation';
  end if;
  if not private.puede_escribir(v_finca, 'hato') then
    raise exception 'No tienes permiso para anular esquilas en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  update public.esquilas set anulada_en = now() where id = p_esquila and anulada_en is null;
end;
$$;

revoke execute on function public.registrar_esquila(uuid, date, jsonb, text, numeric, text, uuid) from public, anon;
revoke execute on function public.actualizar_esquila(uuid, date, text, numeric, text, jsonb) from public, anon;
revoke execute on function public.anular_esquila(uuid) from public, anon;
grant execute on function public.registrar_esquila(uuid, date, jsonb, text, numeric, text, uuid) to authenticated;
grant execute on function public.actualizar_esquila(uuid, date, text, numeric, text, jsonb) to authenticated;
grant execute on function public.anular_esquila(uuid) to authenticated;
