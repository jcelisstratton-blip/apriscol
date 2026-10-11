-- Núcleo multi-tenant: perfiles, fincas, miembros con rol, módulos activos e invitaciones.
-- La FINCA es el tenant. Un usuario puede pertenecer a varias fincas con roles distintos.
-- Toda tabla con datos de finca lleva finca_id y su RLS se basa en la pertenencia, nunca en un id_propietario duplicado.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ───────────────────────── Tipos ─────────────────────────
create type public.especie as enum ('caprino', 'ovino');
create type public.sexo_animal as enum ('hembra', 'macho');
create type public.vocacion_animal as enum ('leche', 'carne', 'doble');
create type public.rol_finca as enum ('propietario', 'administrador', 'ordenador', 'veterinario', 'contador');
create type public.modulo_app as enum (
  'hato', 'genealogia', 'leche', 'carne', 'sanidad', 'reproduccion', 'nutricion', 'ambiente', 'contabilidad'
);

-- ───────────────────────── Utilidades ─────────────────────────
create function private.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── Perfiles ─────────────────────────
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  telefono text,
  finca_activa_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger perfiles_updated_at before update on public.perfiles
  for each row execute function private.set_updated_at();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ───────────────────────── Fincas ─────────────────────────
create table public.fincas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  departamento text,
  municipio text,
  vereda text,
  latitud numeric(9, 6) check (latitud between -90 and 90),
  longitud numeric(9, 6) check (longitud between -180 and 180),
  especies public.especie[] not null default array['caprino']::public.especie[]
    check (cardinality(especies) > 0),
  proposito public.vocacion_animal not null default 'leche',
  -- Coeficiente de endogamia (Wright) a partir del cual se marca alerta roja. 0.0625 = 6.25 %.
  umbral_endogamia numeric(5, 4) not null default 0.0625 check (umbral_endogamia between 0 and 1),
  zona_horaria text not null default 'America/Bogota',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger fincas_updated_at before update on public.fincas
  for each row execute function private.set_updated_at();

alter table public.perfiles
  add constraint perfiles_finca_activa_fk foreign key (finca_activa_id)
  references public.fincas (id) on delete set null;

create table public.finca_miembros (
  finca_id uuid not null references public.fincas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rol public.rol_finca not null,
  created_at timestamptz not null default now(),
  primary key (finca_id, user_id)
);
create index finca_miembros_user_idx on public.finca_miembros (user_id);

create table public.finca_modulos (
  finca_id uuid not null references public.fincas (id) on delete cascade,
  modulo public.modulo_app not null,
  activo boolean not null default false,
  primary key (finca_id, modulo)
);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  rol public.rol_finca not null check (rol <> 'propietario'),
  token uuid not null unique default gen_random_uuid(),
  invitado_por uuid default auth.uid() references auth.users (id) on delete set null,
  expira_en timestamptz not null default now() + interval '7 days',
  aceptada_en timestamptz,
  aceptada_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index invitaciones_pendiente_uk on public.invitaciones (finca_id, email) where aceptada_en is null;

-- ───────────────────────── Helpers de permisos (RLS) ─────────────────────────
-- SECURITY DEFINER para leer finca_miembros sin disparar su propia RLS (evita recursión).
create function private.rol_en(p_finca uuid) returns public.rol_finca
language sql stable security definer set search_path = ''
as $$
  select m.rol from public.finca_miembros m
  where m.finca_id = p_finca and m.user_id = (select auth.uid());
$$;

create function private.es_miembro(p_finca uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.finca_miembros m
    where m.finca_id = p_finca and m.user_id = (select auth.uid())
  );
$$;

create function private.puede_gestionar(p_finca uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.rol_en(p_finca) in ('propietario', 'administrador'), false);
$$;

-- Qué módulos puede LEER cada rol.
create function private.puede_ver(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('hato', 'leche')
      when 'veterinario' then p_modulo in ('hato', 'genealogia', 'sanidad', 'reproduccion', 'leche')
      when 'contador' then p_modulo in ('hato', 'leche', 'contabilidad')
      else false
    end, false);
$$;

-- Qué módulos puede ESCRIBIR cada rol.
create function private.puede_escribir(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo = 'leche'
      when 'veterinario' then p_modulo in ('sanidad', 'reproduccion')
      when 'contador' then p_modulo = 'contabilidad'
      else false
    end, false);
$$;

-- Crea las 4 políticas estándar de una tabla con finca_id:
-- leer según puede_ver, insertar/actualizar según puede_escribir, borrar solo propietario/administrador.
create function private.crear_politicas_finca(p_tabla text, p_modulo public.modulo_app) returns void
language plpgsql set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', p_tabla);
  execute format(
    'create policy %I on public.%I for select to authenticated using ((select private.puede_ver(finca_id, %L::public.modulo_app)))',
    p_tabla || '_select', p_tabla, p_modulo);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check ((select private.puede_escribir(finca_id, %L::public.modulo_app)))',
    p_tabla || '_insert', p_tabla, p_modulo);
  execute format(
    'create policy %I on public.%I for update to authenticated using ((select private.puede_escribir(finca_id, %L::public.modulo_app))) with check ((select private.puede_escribir(finca_id, %L::public.modulo_app)))',
    p_tabla || '_update', p_tabla, p_modulo, p_modulo);
  execute format(
    'create policy %I on public.%I for delete to authenticated using ((select private.puede_gestionar(finca_id)))',
    p_tabla || '_delete', p_tabla);
end;
$$;

-- ───────────────────────── Alta de finca: propietario + módulos ─────────────────────────
create function private.finca_creada() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.finca_miembros (finca_id, user_id, rol) values (new.id, new.created_by, 'propietario');
    update public.perfiles set finca_activa_id = new.id
      where id = new.created_by and finca_activa_id is null;
  end if;

  insert into public.finca_modulos (finca_id, modulo, activo)
  select new.id, m, m in ('hato', 'genealogia', 'leche', 'sanidad', 'reproduccion')
  from unnest(enum_range(null::public.modulo_app)) as m;
  return new;
end;
$$;
create trigger fincas_after_insert after insert on public.fincas
  for each row execute function private.finca_creada();

-- Protege contra dejar una finca sin propietario y contra que un administrador toque propietarios.
create function private.miembros_guardia() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Borrado en cascada de la finca: se permite.
  if tg_op = 'DELETE' and not exists (select 1 from public.fincas where id = old.finca_id) then
    return old;
  end if;

  if (select auth.uid()) is not null
     and (old.rol = 'propietario' or (tg_op = 'UPDATE' and new.rol = 'propietario'))
     and private.rol_en(old.finca_id) is distinct from 'propietario' then
    raise exception 'Solo un propietario puede cambiar o quitar a otro propietario.' using errcode = 'insufficient_privilege';
  end if;

  if old.rol = 'propietario' and (tg_op = 'DELETE' or new.rol <> 'propietario')
     and not exists (
       select 1 from public.finca_miembros m
       where m.finca_id = old.finca_id and m.rol = 'propietario' and m.user_id <> old.user_id
     ) then
    raise exception 'La finca debe conservar al menos un propietario.' using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger finca_miembros_guardia before update or delete on public.finca_miembros
  for each row execute function private.miembros_guardia();

-- ───────────────────────── Invitaciones: aceptar ─────────────────────────
create function public.aceptar_invitacion(p_token uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invitaciones;
  v_email text := lower(btrim((select auth.jwt() ->> 'email')));
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_inv from public.invitaciones
  where token = p_token and aceptada_en is null and expira_en > now()
  for update;

  if not found then
    raise exception 'La invitación no existe o ya venció.' using errcode = 'P0002';
  end if;
  if v_inv.email is distinct from v_email then
    raise exception 'Esta invitación es para otro correo.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.finca_miembros (finca_id, user_id, rol)
  values (v_inv.finca_id, v_uid, v_inv.rol)
  on conflict (finca_id, user_id) do nothing;

  update public.invitaciones set aceptada_en = now(), aceptada_por = v_uid where id = v_inv.id;
  update public.perfiles set finca_activa_id = coalesce(finca_activa_id, v_inv.finca_id) where id = v_uid;
  return v_inv.finca_id;
end;
$$;
revoke execute on function public.aceptar_invitacion(uuid) from public, anon;
grant execute on function public.aceptar_invitacion(uuid) to authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.perfiles enable row level security;
alter table public.fincas enable row level security;
alter table public.finca_miembros enable row level security;
alter table public.finca_modulos enable row level security;
alter table public.invitaciones enable row level security;

-- perfiles: cada quien ve y edita el suyo; los compañeros de finca se ven entre sí (nombre).
create policy perfiles_select on public.perfiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.finca_miembros a
    join public.finca_miembros b on b.finca_id = a.finca_id
    where a.user_id = (select auth.uid()) and b.user_id = perfiles.id
  )
);
create policy perfiles_update on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- fincas: created_by se admite en el SELECT para que INSERT ... RETURNING funcione antes de que el trigger agregue la membresía.
create policy fincas_select on public.fincas for select to authenticated using (
  created_by = (select auth.uid()) or (select private.es_miembro(id))
);
create policy fincas_insert on public.fincas for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy fincas_update on public.fincas for update to authenticated
  using ((select private.puede_gestionar(id))) with check ((select private.puede_gestionar(id)));
create policy fincas_delete on public.fincas for delete to authenticated
  using ((select private.rol_en(id)) = 'propietario');

create policy finca_miembros_select on public.finca_miembros for select to authenticated
  using ((select private.es_miembro(finca_id)));
create policy finca_miembros_update on public.finca_miembros for update to authenticated
  using ((select private.puede_gestionar(finca_id))) with check ((select private.puede_gestionar(finca_id)));
create policy finca_miembros_delete on public.finca_miembros for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.puede_gestionar(finca_id)));

create policy finca_modulos_select on public.finca_modulos for select to authenticated
  using ((select private.es_miembro(finca_id)));
create policy finca_modulos_update on public.finca_modulos for update to authenticated
  using ((select private.puede_gestionar(finca_id))) with check ((select private.puede_gestionar(finca_id)));

create policy invitaciones_select on public.invitaciones for select to authenticated
  using ((select private.puede_gestionar(finca_id)));
create policy invitaciones_insert on public.invitaciones for insert to authenticated
  with check ((select private.puede_gestionar(finca_id)) and invitado_por = (select auth.uid()));
create policy invitaciones_delete on public.invitaciones for delete to authenticated
  using ((select private.puede_gestionar(finca_id)));
