-- Avisos por Telegram (primera entrega): quién recibe, cuándo y qué se envió.
--  · Un solo bot de la plataforma. Cada persona lo vincula desde la app con un código de un solo uso (nadie pone un token).
--  · Los parámetros de envío (hora, días, nivel, silencio) por persona los fija el superadministrador en el piloto.
--  · Todo lo que escribe el bot (vincular, pausar, registrar envíos) pasa por funciones que solo ejecuta `service_role`.
-- Retrocompatible: solo tablas y funciones nuevas.

-- 1. El vínculo de cada persona con el bot, por finca (la misma persona puede estar en varias fincas).
create table public.telegram_vinculos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null,
  user_id uuid not null,
  chat_id bigint,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'pausado', 'bloqueado')),
  codigo_hash text,
  codigo_expira timestamptz,
  vinculado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (finca_id, user_id),
  constraint telegram_vinculos_miembro_fk foreign key (finca_id, user_id) references public.finca_miembros (finca_id, user_id) on delete cascade,
  constraint telegram_vinculos_activo_ck check (estado = 'pendiente' or chat_id is not null)
);
-- Dos personas de la misma finca no pueden compartir un chat; un código vigente es único.
create unique index telegram_vinculos_chat_uk on public.telegram_vinculos (finca_id, chat_id) where chat_id is not null;
create unique index telegram_vinculos_codigo_uk on public.telegram_vinculos (codigo_hash) where codigo_hash is not null;
create index telegram_vinculos_chat_idx on public.telegram_vinculos (chat_id) where chat_id is not null;
create trigger telegram_vinculos_updated_at before update on public.telegram_vinculos
  for each row execute function private.set_updated_at();

-- 2. Los parámetros de envío de cada persona. Los edita el superadministrador; la persona solo los ve.
create table public.notificacion_preferencias (
  finca_id uuid not null,
  user_id uuid not null,
  activo boolean not null default false,
  resumen boolean not null default true,
  resumen_hora time not null default '06:30',
  dias smallint[] not null default '{1,2,3,4,5,6,7}' check (dias <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(dias) between 1 and 7),
  nivel_minimo text not null default 'ambar' check (nivel_minimo in ('rojo', 'ambar')),
  alertas boolean not null default true,
  semanal boolean not null default false,
  silencio_desde time not null default '20:00',
  silencio_hasta time not null default '05:00',
  max_diarios smallint not null default 8 check (max_diarios between 1 and 30),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (finca_id, user_id),
  constraint notificacion_pref_miembro_fk foreign key (finca_id, user_id) references public.finca_miembros (finca_id, user_id) on delete cascade
);
create trigger notificacion_preferencias_updated_at before update on public.notificacion_preferencias
  for each row execute function private.set_updated_at();

-- 3. Lo que se envió (o se intentó): evita repetir un aviso y deja rastro. Solo el servidor la toca.
create table public.notificacion_envios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null,
  user_id uuid not null,
  tipo text not null check (tipo in ('resumen', 'alerta', 'recordatorio', 'semanal', 'comando')),
  clave text not null check (char_length(clave) between 1 and 200),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido', 'omitido')),
  intentos smallint not null default 1,
  error text check (error is null or char_length(error) <= 300),
  telegram_message_id bigint,
  enviado_en timestamptz,
  created_at timestamptz not null default now(),
  unique (finca_id, user_id, tipo, clave),
  constraint notificacion_envios_miembro_fk foreign key (finca_id, user_id) references public.finca_miembros (finca_id, user_id) on delete cascade
);
create index notificacion_envios_dia_idx on public.notificacion_envios (finca_id, user_id, created_at desc);

-- 4. Seguridad. La persona ve solo lo suyo; nadie escribe directo (se escribe con las funciones de abajo).
alter table public.telegram_vinculos enable row level security;
alter table public.notificacion_preferencias enable row level security;
alter table public.notificacion_envios enable row level security;
create policy telegram_vinculos_select on public.telegram_vinculos for select to authenticated
  using (user_id = (select auth.uid()));
create policy notificacion_preferencias_select on public.notificacion_preferencias for select to authenticated
  using (user_id = (select auth.uid()));
-- `notificacion_envios` no tiene políticas: solo el servidor la lee y la escribe.
-- Supabase concede acceso por defecto a las tablas nuevas: se quita todo y se devuelve solo lo que la persona puede leer.
revoke all on public.telegram_vinculos, public.notificacion_preferencias, public.notificacion_envios from anon, authenticated;
-- El código y su hash nunca viajan al navegador.
grant select (id, finca_id, user_id, estado, vinculado_en, created_at, updated_at) on public.telegram_vinculos to authenticated;
grant select on public.notificacion_preferencias to authenticated;

-- 5. Crear el código de vinculación (lo pide la persona desde la app). Devuelve el código en claro una sola vez; se guarda solo su hash.
create function public.telegram_crear_codigo(p_finca uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text := '';
  i integer;
begin
  if v_user is null or not exists (select 1 from public.finca_miembros where finca_id = p_finca and user_id = v_user) then
    raise exception 'No perteneces a esta finca.' using errcode = 'insufficient_privilege';
  end if;
  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into public.telegram_vinculos (finca_id, user_id, codigo_hash, codigo_expira)
  values (p_finca, v_user, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + interval '15 minutes')
  on conflict (finca_id, user_id) do update set codigo_hash = excluded.codigo_hash, codigo_expira = excluded.codigo_expira;
  return v_codigo;
end
$$;
revoke execute on function public.telegram_crear_codigo(uuid) from public, anon;
grant execute on function public.telegram_crear_codigo(uuid) to authenticated;

-- 6. La persona se desvincula desde la app.
create function public.telegram_desvincular(p_finca uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.telegram_vinculos
     set chat_id = null, estado = 'pendiente', codigo_hash = null, codigo_expira = null, vinculado_en = null
   where finca_id = p_finca and user_id = (select auth.uid());
end
$$;
revoke execute on function public.telegram_desvincular(uuid) from public, anon;
grant execute on function public.telegram_desvincular(uuid) to authenticated;

-- 7. Lo que usa el servidor del bot (solo service_role). Vincular: el bot recibe «/start CODIGO» con el chat de la persona.
create function public.telegram_vincular(p_codigo text, p_chat_id bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.telegram_vinculos;
  v_finca text;
begin
  select * into v from public.telegram_vinculos
   where codigo_hash = encode(extensions.digest(upper(btrim(coalesce(p_codigo, ''))), 'sha256'), 'hex') and codigo_expira > now()
   for update;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  begin
    update public.telegram_vinculos
       set chat_id = p_chat_id, estado = 'activo', codigo_hash = null, codigo_expira = null, vinculado_en = now()
     where id = v.id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'chat_en_uso');
  end;
  select nombre into v_finca from public.fincas where id = v.finca_id;
  return jsonb_build_object('ok', true, 'finca', v_finca, 'finca_id', v.finca_id, 'user_id', v.user_id);
end
$$;

-- Pausar o reanudar todos los vínculos de un chat (/pausar, /reanudar, o Telegram avisa que el bot fue bloqueado).
create function public.telegram_chat_estado(p_chat_id bigint, p_estado text) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if p_estado not in ('activo', 'pausado', 'bloqueado') then
    raise exception 'Estado no válido.';
  end if;
  update public.telegram_vinculos set estado = p_estado
   where chat_id = p_chat_id and estado <> 'pendiente' and estado <> p_estado;
  get diagnostics n = row_count;
  return n;
end
$$;

-- A quién le toca el resumen ahora (hora de Bogotá): vinculado y activo, en un día elegido, ya pasó su hora (hasta 3 horas de margen) y no se envió hoy.
create function public.notificaciones_destinos(p_ahora timestamptz default now())
returns table (finca_id uuid, user_id uuid, chat_id bigint, rol text, finca_nombre text, tipo text, clave text)
language sql stable security definer set search_path = ''
as $$
  with t as (select (p_ahora at time zone 'America/Bogota') as local)
  select v.finca_id, v.user_id, v.chat_id, m.rol::text, f.nombre, 'resumen'::text, (t.local::date)::text
    from public.telegram_vinculos v
    join public.notificacion_preferencias p on p.finca_id = v.finca_id and p.user_id = v.user_id and p.activo and p.resumen
    join public.finca_miembros m on m.finca_id = v.finca_id and m.user_id = v.user_id
    join public.fincas f on f.id = v.finca_id
    cross join t
   where v.estado = 'activo' and v.chat_id is not null
     and extract(isodow from t.local)::smallint = any (p.dias)
     and t.local::time >= p.resumen_hora and t.local::time < p.resumen_hora + interval '3 hours'
     and not exists (
       select 1 from public.notificacion_envios e
        where e.finca_id = v.finca_id and e.user_id = v.user_id and e.tipo = 'resumen' and e.clave = (t.local::date)::text
          and (e.estado <> 'fallido' or e.intentos >= 3));
$$;

-- Reservar un envío antes de mandarlo (si ya existe y no falló, devuelve null: no se manda dos veces) y registrar su resultado.
create function public.notificacion_reservar(p_finca uuid, p_user uuid, p_tipo text, p_clave text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.notificacion_envios (finca_id, user_id, tipo, clave) values (p_finca, p_user, p_tipo, p_clave)
  on conflict (finca_id, user_id, tipo, clave) do update set estado = 'pendiente', intentos = public.notificacion_envios.intentos + 1
    where public.notificacion_envios.estado = 'fallido' and public.notificacion_envios.intentos < 3
  returning id into v_id;
  return v_id;
end
$$;

create function public.notificacion_resultado(p_id uuid, p_estado text, p_error text default null, p_message_id bigint default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_estado not in ('enviado', 'fallido', 'omitido') then
    raise exception 'Estado no válido.';
  end if;
  update public.notificacion_envios
     set estado = p_estado, error = left(p_error, 300), telegram_message_id = p_message_id,
         enviado_en = case when p_estado = 'enviado' then now() else enviado_en end
   where id = p_id;
end
$$;

revoke execute on function public.telegram_vincular(text, bigint) from public, anon, authenticated;
revoke execute on function public.telegram_chat_estado(bigint, text) from public, anon, authenticated;
revoke execute on function public.notificaciones_destinos(timestamptz) from public, anon, authenticated;
revoke execute on function public.notificacion_reservar(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.notificacion_resultado(uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.telegram_vincular(text, bigint) to service_role;
grant execute on function public.telegram_chat_estado(bigint, text) to service_role;
grant execute on function public.notificaciones_destinos(timestamptz) to service_role;
grant execute on function public.notificacion_reservar(uuid, uuid, text, text) to service_role;
grant execute on function public.notificacion_resultado(uuid, text, text, bigint) to service_role;

-- 8. El superadministrador: ve el equipo de una finca con su vínculo y sus parámetros, y los cambia.
create function public.admin_notificaciones(p_finca uuid)
returns table (user_id uuid, nombre text, email text, rol text, vinculo text, vinculado_en timestamptz, activo boolean, resumen boolean, resumen_hora time, dias smallint[], nivel_minimo text, alertas boolean, semanal boolean, silencio_desde time, silencio_hasta time, max_diarios smallint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el superadministrador puede ver los avisos de una finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select m.user_id, pf.nombre, u.email::text, m.rol::text, coalesce(v.estado, 'pendiente'), v.vinculado_en,
           coalesce(p.activo, false), coalesce(p.resumen, true), coalesce(p.resumen_hora, time '06:30'), coalesce(p.dias, array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
           coalesce(p.nivel_minimo, 'ambar'), coalesce(p.alertas, true), coalesce(p.semanal, false), coalesce(p.silencio_desde, time '20:00'), coalesce(p.silencio_hasta, time '05:00'), coalesce(p.max_diarios, 8::smallint)
      from public.finca_miembros m
      join auth.users u on u.id = m.user_id
      left join public.perfiles pf on pf.id = m.user_id
      left join public.telegram_vinculos v on v.finca_id = m.finca_id and v.user_id = m.user_id
      left join public.notificacion_preferencias p on p.finca_id = m.finca_id and p.user_id = m.user_id
     where m.finca_id = p_finca
     order by pf.nombre nulls last, u.email;
end
$$;

create function public.admin_guardar_notificaciones(p_finca uuid, p_user uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dias smallint[];
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el superadministrador puede cambiar los avisos de una finca.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.finca_miembros where finca_id = p_finca and user_id = p_user) then
    raise exception 'Esa persona no pertenece a la finca.';
  end if;
  select coalesce(array_agg(d::smallint order by d), array[1, 2, 3, 4, 5, 6, 7]::smallint[]) into v_dias
    from (select distinct jsonb_array_elements_text(coalesce(p_datos -> 'dias', '[1,2,3,4,5,6,7]'::jsonb))::int d) x;
  insert into public.notificacion_preferencias (finca_id, user_id, activo, resumen, resumen_hora, dias, nivel_minimo, alertas, semanal, silencio_desde, silencio_hasta, max_diarios, updated_by)
  values (
    p_finca, p_user,
    coalesce((p_datos ->> 'activo')::boolean, false), coalesce((p_datos ->> 'resumen')::boolean, true),
    coalesce((p_datos ->> 'resumen_hora')::time, time '06:30'), v_dias,
    coalesce(p_datos ->> 'nivel_minimo', 'ambar'), coalesce((p_datos ->> 'alertas')::boolean, true), coalesce((p_datos ->> 'semanal')::boolean, false),
    coalesce((p_datos ->> 'silencio_desde')::time, time '20:00'), coalesce((p_datos ->> 'silencio_hasta')::time, time '05:00'),
    coalesce((p_datos ->> 'max_diarios')::smallint, 8::smallint), (select auth.uid()))
  on conflict (finca_id, user_id) do update set
    activo = excluded.activo, resumen = excluded.resumen, resumen_hora = excluded.resumen_hora, dias = excluded.dias, nivel_minimo = excluded.nivel_minimo,
    alertas = excluded.alertas, semanal = excluded.semanal, silencio_desde = excluded.silencio_desde, silencio_hasta = excluded.silencio_hasta,
    max_diarios = excluded.max_diarios, updated_by = excluded.updated_by;
end
$$;
revoke execute on function public.admin_notificaciones(uuid) from public, anon;
revoke execute on function public.admin_guardar_notificaciones(uuid, uuid, jsonb) from public, anon;
grant execute on function public.admin_notificaciones(uuid) to authenticated;
grant execute on function public.admin_guardar_notificaciones(uuid, uuid, jsonb) to authenticated;
