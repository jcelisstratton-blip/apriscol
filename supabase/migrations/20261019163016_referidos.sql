-- Referidos: cada persona tiene un código y un enlace (/registro?ref=CODIGO). Quien se registra con él queda como referido, y cuando adquiere un plan quien lo
-- refirió recibe el 5 % del valor de ese plan cada mes durante 6 meses. El plan lo activa el superadmin (admin_asignar_plan): ahí nace la comisión.
-- Los términos (5 % y 6 meses) se guardan en cada comisión al crearla, para que un cambio futuro no altere las ya pactadas.

alter table public.perfiles
  add column codigo_referido text unique check (codigo_referido is null or codigo_referido ~ '^[A-Z0-9]{8}$'),
  add column referido_por uuid references auth.users (id) on delete set null;

-- Un código corto, sin 0/O/1/I para que se pueda dictar.
create function private.nuevo_codigo_referido() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
begin
  loop
    v_codigo := '';
    for i in 1..8 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.perfiles p where p.codigo_referido = v_codigo);
  end loop;
  return v_codigo;
end;
$$;
revoke execute on function private.nuevo_codigo_referido() from public, anon, authenticated;

update public.perfiles set codigo_referido = private.nuevo_codigo_referido() where codigo_referido is null;

-- El código y quién refirió a la persona no se tocan desde el navegador (cada quien puede editar su perfil, pero no estos dos datos).
create function private.perfiles_proteger_referidos() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.codigo_referido := old.codigo_referido;
    new.referido_por := old.referido_por;
  end if;
  return new;
end;
$$;
revoke execute on function private.perfiles_proteger_referidos() from public, anon, authenticated;
create trigger perfiles_proteger_referidos before update on public.perfiles for each row execute function private.perfiles_proteger_referidos();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ref uuid;
begin
  -- Quien lo refirió: el código viaja en los datos del registro (`ref`); un código que no existe simplemente no cuenta.
  select p.id into v_ref from public.perfiles p where p.codigo_referido = upper(btrim(new.raw_user_meta_data ->> 'ref'));
  insert into public.perfiles (id, nombre, codigo_referido, referido_por)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)), private.nuevo_codigo_referido(), v_ref);
  return new;
end;
$$;

-- Una fila por persona referida que adquirió un plan: de qué plan y desde cuándo corre el 5 % durante 6 meses.
create table public.comisiones_referido (
  id uuid primary key default gen_random_uuid(),
  referidor_id uuid not null references auth.users (id) on delete cascade,
  referido_id uuid not null unique references auth.users (id) on delete cascade,
  finca_id uuid references public.fincas (id) on delete set null,
  plan text not null,
  porcentaje numeric(5, 2) not null check (porcentaje > 0 and porcentaje <= 100),
  meses smallint not null check (meses > 0),
  desde timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (referidor_id <> referido_id)
);
create index comisiones_referido_referidor_idx on public.comisiones_referido (referidor_id);
alter table public.comisiones_referido enable row level security;
revoke all on public.comisiones_referido from anon, authenticated;
grant select on public.comisiones_referido to authenticated;
-- Cada quien ve las suyas; nadie escribe desde el navegador (las crea admin_asignar_plan).
create policy comisiones_referido_select on public.comisiones_referido for select to authenticated using (referidor_id = (select auth.uid()));

-- Al activar un plan, si la persona llegó por un enlace de referido y todavía no tiene comisión, empieza a correr su 5 % durante 6 meses.
create or replace function public.admin_asignar_plan(p_correo text, p_plan text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_n integer;
  v_finca uuid;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if private.plan_rango(p_plan) = 0 then
    raise exception 'Ese plan no existe.';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_correo));
  if v_user is null then
    raise exception 'No hay una cuenta con ese correo.';
  end if;
  perform set_config('apriscol.asignando_plan', 'on', true);
  update public.fincas f set plan = p_plan
  where f.id in (select m.finca_id from public.finca_miembros m where m.user_id = v_user and m.rol = 'propietario');
  get diagnostics v_n = row_count;
  update public.solicitudes_plan s set estado = 'activada', atendida_en = now()
  where s.estado = 'pendiente' and s.finca_id in (select m.finca_id from public.finca_miembros m where m.user_id = v_user and m.rol = 'propietario');
  perform set_config('apriscol.asignando_plan', 'off', true);

  if v_n > 0 then
    select m.finca_id into v_finca from public.finca_miembros m where m.user_id = v_user and m.rol = 'propietario' order by m.created_at limit 1;
    insert into public.comisiones_referido (referidor_id, referido_id, finca_id, plan, porcentaje, meses)
    select p.referido_por, p.id, v_finca, p_plan, 5, 6
      from public.perfiles p
     where p.id = v_user and p.referido_por is not null and p.referido_por <> p.id
    on conflict (referido_id) do nothing;
  end if;
  return v_n;
end;
$$;

-- Lo que ve quien refirió: sus referidos con solo el primer nombre, cuándo se registraron y, si ya compraron plan, cuál y desde cuándo.
create function public.mis_referidos()
returns table (nombre text, registrado_en timestamptz, plan text, porcentaje numeric, meses smallint, desde timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select split_part(coalesce(nullif(btrim(p.nombre), ''), 'Sin nombre'), ' ', 1), p.created_at, c.plan, c.porcentaje, c.meses, c.desde
      from public.perfiles p
      left join public.comisiones_referido c on c.referido_id = p.id
     where p.referido_por = (select auth.uid())
     order by p.created_at desc
     limit 500;
end;
$$;
revoke execute on function public.mis_referidos() from public, anon;
grant execute on function public.mis_referidos() to authenticated;

-- Para el superadmin: quién debe cobrar comisión, por quién, de qué plan y desde cuándo.
create function public.admin_listar_comisiones()
returns table (referidor text, referido text, plan text, porcentaje numeric, meses smallint, desde timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select coalesce(a.email::text, ''), coalesce(b.email::text, ''), c.plan, c.porcentaje, c.meses, c.desde
      from public.comisiones_referido c
      left join auth.users a on a.id = c.referidor_id
      left join auth.users b on b.id = c.referido_id
     order by c.desde desc
     limit 500;
end;
$$;
revoke execute on function public.admin_listar_comisiones() from public, anon;
grant execute on function public.admin_listar_comisiones() to authenticated;
