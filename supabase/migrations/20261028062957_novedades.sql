-- Novedades: avisos informativos que envían el ordeñador, el veterinario y los demás con acceso (solo por selección, sin escribir datos) sobre un animal: una aplicación,
-- una prueba, un examen coprológico o una evaluación FAMACHA. No son registros oficiales de Sanidad (no generan retiros, costos ni historial). Los ven el propietario, el
-- administrador y el veterinario; el ordeñador solo ve las suyas.

create or replace function private.puede_ver(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('hato', 'leche', 'novedades')
      when 'veterinario' then p_modulo in ('hato', 'genealogia', 'sanidad', 'reproduccion', 'leche', 'carne', 'corrales', 'novedades')
      when 'contador' then p_modulo in ('hato', 'leche', 'carne', 'contabilidad')
      else false
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo);
$$;

create or replace function private.puede_escribir(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('leche', 'novedades')
      when 'veterinario' then p_modulo in ('sanidad', 'reproduccion', 'corrales', 'novedades')
      when 'contador' then p_modulo = 'contabilidad'
      else false
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo)
  and coalesce(private.estado_plan(p_finca), 'vigente') in ('vigente', 'por_vencer');
$$;

-- Las fincas donde la persona revisa TODAS las novedades (propietario, administrador y veterinario); el resto solo ve las suyas.
create or replace function private.fincas_revisan_novedades() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.finca_id
  from public.finca_miembros m
  where m.user_id = (select auth.uid())
    and m.rol in ('propietario', 'administrador', 'veterinario')
    and private.puede_ver(m.finca_id, 'novedades');
$$;
revoke execute on function private.fincas_revisan_novedades() from public, anon;
grant execute on function private.fincas_revisan_novedades() to authenticated;

create table public.novedades (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  animal_id uuid not null,
  tipo text not null check (tipo in ('aplicacion', 'prueba', 'coprologico', 'famacha')),
  fecha date not null,
  categoria_producto text check (categoria_producto is null or categoria_producto in ('vacuna', 'desparasitante', 'antibiotico', 'antiinflamatorio', 'vitamina', 'otro')),
  producto_id uuid,
  producto_nombre text check (producto_nombre is null or char_length(producto_nombre) <= 120),
  via text check (via is null or via in ('oral', 'subcutanea', 'intramuscular', 'intravenosa', 'topica', 'intramamaria', 'otra')),
  lote text check (lote is null or char_length(lote) <= 60),
  prueba text check (prueba is null or prueba in ('cae', 'brucelosis', 'cmt', 'mastitis_cultivo', 'paratuberculosis', 'otra')),
  resultado_prueba text check (resultado_prueba is null or resultado_prueba in ('negativo', 'positivo', 'sospechoso', 'pendiente')),
  tipo_muestra text check (tipo_muestra is null or tipo_muestra in ('limpia', 'contaminada')),
  puntaje smallint check (puntaje is null or puntaje between 1 and 5),
  enviada_por_nombre text not null check (char_length(enviada_por_nombre) between 1 and 120),
  estado text not null default 'nueva' check (estado in ('nueva', 'vista', 'atendida')),
  revisada_por uuid references auth.users (id) on delete set null,
  revisada_en timestamptz,
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint novedades_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  constraint novedades_producto_fk foreign key (producto_id, finca_id) references public.productos_veterinarios (id, finca_id) on delete set null (producto_id),
  constraint novedades_segun_tipo check (
    (tipo = 'aplicacion' and categoria_producto is not null)
    or (tipo = 'prueba' and prueba is not null and resultado_prueba is not null)
    or (tipo = 'coprologico' and tipo_muestra is not null)
    or (tipo = 'famacha' and puntaje is not null))
);
create index novedades_finca_estado_idx on public.novedades (finca_id, estado, created_at desc);
create index novedades_animal_idx on public.novedades (finca_id, animal_id, created_at desc);
create index novedades_autor_idx on public.novedades (created_by, created_at desc);
create unique index novedades_client_req_uk on public.novedades (finca_id, client_request_id) where client_request_id is not null;
create trigger novedades_updated_at before update on public.novedades for each row execute function private.set_updated_at();

alter table public.novedades enable row level security;
create policy novedades_select on public.novedades for select to authenticated
  using (finca_id in (select private.fincas_ver('novedades'::public.modulo_app))
         and (finca_id in (select private.fincas_revisan_novedades()) or created_by = (select auth.uid())));
create policy novedades_insert on public.novedades for insert to authenticated
  with check ((select private.puede_escribir(finca_id, 'novedades'::public.modulo_app)) and created_by = (select auth.uid()));
create policy novedades_update on public.novedades for update to authenticated
  using (finca_id in (select private.fincas_revisan_novedades()))
  with check (finca_id in (select private.fincas_revisan_novedades()));
create policy novedades_delete on public.novedades for delete to authenticated
  using ((select private.puede_gestionar(finca_id)));
revoke all on public.novedades from anon;
grant select, insert, update, delete on public.novedades to authenticated;

-- Quien envía una novedad también elige el lote de la lista (sin ver compras ni precios): la lista de lotes se abre a quien puede enviar novedades.
create or replace function public.lotes_sanidad(p_finca uuid)
returns table (gasto_id uuid, producto_id uuid, lote text, vencimiento date, comprado date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.puede_ver(p_finca, 'sanidad') or private.puede_ver(p_finca, 'novedades')) then
    raise exception 'No tienes permiso para ver la sanidad de esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select g.id, g.producto_vet_id, g.lote_producto, g.lote_vencimiento, g.fecha
      from public.gastos g
     where g.finca_id = p_finca and g.producto_vet_id is not null and g.lote_producto is not null
       and (g.lote_vencimiento is null or g.lote_vencimiento >= (now() at time zone 'America/Bogota')::date)
     order by g.fecha desc, g.created_at desc
     limit 1000;
end
$$;
