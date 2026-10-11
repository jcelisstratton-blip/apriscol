-- Ferias y premios: palmarés de cada animal, con la foto del premio recibido.
-- Una feria es un evento (local a internacional); una participación es un animal en una feria, en una categoría,
-- con su resultado. Solo propietario y administrador ven y escriben este módulo (los demás roles no lo incluyen).

-- Las fincas nuevas nacen con el módulo activo (es parte del negocio); las existentes lo reciben por relleno.
create or replace function private.finca_creada() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.finca_miembros (finca_id, user_id, rol) values (new.id, new.created_by, 'propietario');
    update public.perfiles set finca_activa_id = new.id
      where id = new.created_by and finca_activa_id is null;
  end if;

  insert into public.finca_modulos (finca_id, modulo, activo)
  select new.id, m, m in ('hato', 'genealogia', 'leche', 'sanidad', 'reproduccion', 'ferias')
  from unnest(enum_range(null::public.modulo_app)) as m;
  return new;
end;
$$;

insert into public.finca_modulos (finca_id, modulo, activo)
select f.id, 'ferias', true from public.fincas f
on conflict (finca_id, modulo) do nothing;

create table public.ferias (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 160),
  nivel text not null default 'nacional' check (nivel in ('local', 'regional', 'nacional', 'internacional')),
  departamento text,
  municipio text,
  fecha_inicio date not null,
  fecha_fin date,
  organizador text,
  notas text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint ferias_fechas_ck check (fecha_fin is null or fecha_fin >= fecha_inicio)
);
create unique index ferias_nombre_fecha_uk on public.ferias (finca_id, lower(btrim(nombre)), fecha_inicio);
create index ferias_finca_fecha_idx on public.ferias (finca_id, fecha_inicio desc);
create trigger ferias_updated_at before update on public.ferias
  for each row execute function private.set_updated_at();

create table public.participaciones_feria (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  feria_id uuid not null,
  animal_id uuid not null,
  -- Categoría del jurado, tal como la publica la feria (p. ej. «Hembra joven en leche»).
  categoria text not null check (char_length(btrim(categoria)) between 1 and 160),
  resultado text not null default 'participacion' check (resultado in (
    'gran_campeon', 'campeon', 'subcampeon', 'reservado_campeon', 'mejor_ejemplar', 'mencion_honor', 'participacion', 'otro'
  )),
  puesto smallint check (puesto between 1 and 99),
  puntaje numeric(6, 2) check (puntaje >= 0),
  premio_descripcion text,
  premio_en_dinero numeric(14, 2) check (premio_en_dinero >= 0),
  -- Ruta dentro del bucket «premios»: <finca_id>/<uuid>.<ext>
  foto_path text,
  observaciones text,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participaciones_feria_fk foreign key (feria_id, finca_id)
    references public.ferias (id, finca_id) on delete cascade,
  constraint participaciones_animal_fk foreign key (animal_id, finca_id)
    references public.animales (id, finca_id) on delete cascade,
  -- La foto solo puede vivir en la carpeta de la propia finca y con el nombre que arma el servidor.
  constraint participaciones_foto_ck check (
    foto_path is null
    or foto_path ~ ('^' || finca_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
  ),
  unique (feria_id, animal_id, categoria)
);
create index participaciones_animal_idx on public.participaciones_feria (animal_id, created_at desc);
create index participaciones_feria_idx on public.participaciones_feria (feria_id);
create index participaciones_finca_idx on public.participaciones_feria (finca_id);
create unique index participaciones_client_req_uk on public.participaciones_feria (finca_id, client_request_id)
  where client_request_id is not null;
create trigger participaciones_updated_at before update on public.participaciones_feria
  for each row execute function private.set_updated_at();

-- Palmarés por animal: participaciones, premios (todo lo que no sea solo participar) y campeonatos.
create view public.v_palmares_animal with (security_invoker = true) as
select p.finca_id,
       p.animal_id,
       count(*) as participaciones,
       count(*) filter (where p.resultado <> 'participacion') as premios,
       count(*) filter (where p.resultado in ('gran_campeon', 'campeon')) as campeonatos,
       min(p.puesto) as mejor_puesto
from public.participaciones_feria p
group by p.finca_id, p.animal_id;

select private.crear_politicas_finca('ferias', 'ferias');
select private.crear_politicas_finca('participaciones_feria', 'ferias');

-- Las tablas nuevas nacen con permisos por defecto para anon: se cierran de inmediato.
revoke all on public.ferias, public.participaciones_feria, public.v_palmares_animal from anon;
grant select, insert, update, delete on public.ferias, public.participaciones_feria to authenticated;
grant select on public.v_palmares_animal to authenticated;

-- ───────────────────────── Storage: bucket «premios» ─────────────────────────
-- Políticas acotadas a la carpeta de la finca: solo quien puede escribir el módulo en ESA finca sube,
-- y solo con el nombre <finca_id>/<uuid>.<ext>. Así no hace falta una llave de servicio en el servidor web.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('premios', 'premios', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function private.carpeta_finca(p_ruta text) returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return ((storage.foldername(p_ruta))[1])::uuid;
exception when others then
  return null;
end;
$$;

create policy premios_ver on storage.objects for select to authenticated
  using (bucket_id = 'premios' and (select private.puede_ver(private.carpeta_finca(name), 'ferias')));

create policy premios_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'premios'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and (select private.puede_escribir(private.carpeta_finca(name), 'ferias'))
  );

create policy premios_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'premios' and (select private.puede_gestionar(private.carpeta_finca(name))));
