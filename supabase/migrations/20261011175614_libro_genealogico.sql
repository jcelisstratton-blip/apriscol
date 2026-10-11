-- Libro genealógico compartido (registro de una asociación de criadores) + reclamo de animales por finca.
-- El libro NO pertenece a una finca: los pedigríes cruzan entre criaderos (≈31 % de los vínculos padre/madre en
-- los datos reales), así que vive aparte y cada finca vincula sus animales a él por microchip.
-- Los documentos de identidad de los titulares se guardan como HMAC con un secreto en Vault: sirven para comprobar
-- quién reclama, pero no se pueden leer.

-- ───────────────────────── Razas del libro ─────────────────────────
insert into public.razas (especie, nombre, aptitud) values
  ('caprino', 'Santandereana', null),
  ('ovino', 'Abisinia', null),
  ('ovino', 'Blackbelly', 'carne'),
  ('ovino', 'Cheviot', null),
  ('ovino', 'Corriedale', 'doble'),
  ('ovino', 'Dorset', 'carne'),
  ('ovino', 'Etíope', null),
  ('ovino', 'Île de France', 'carne'),
  ('ovino', 'Merino', null),
  ('ovino', 'Romney Marsh', null),
  ('ovino', 'Sudán', null),
  ('ovino', 'Suffolk', 'carne'),
  ('ovino', 'White Dorper', 'carne')
on conflict (especie, nombre) do nothing;

-- Cómo se escribe cada raza en el libro (mayúsculas, espacios colapsados) → raza del catálogo.
create table public.razas_alias (
  especie public.especie not null,
  alias text not null check (alias = upper(alias) and alias = btrim(alias)),
  raza_id smallint not null references public.razas (id),
  primary key (especie, alias)
);
create index razas_alias_raza_idx on public.razas_alias (raza_id);

insert into public.razas_alias (especie, alias, raza_id)
select r.especie, a.alias, r.id
from (values
  ('caprino', 'ALPINA', 'Alpina francesa'),
  ('caprino', 'ANGLONUBIANA', 'Anglonubian'),
  ('caprino', 'BOER', 'Boer'),
  ('caprino', 'LAMANCHA', 'LaMancha'),
  ('caprino', 'LA MANCHA', 'LaMancha'),
  ('caprino', 'SAANEN', 'Saanen'),
  ('caprino', 'SANTANDEREANA', 'Santandereana'),
  ('caprino', 'TOGGENBURG', 'Toggenburg'),
  ('ovino', 'ABISINIA', 'Abisinia'),
  ('ovino', 'BLACK BELLY', 'Blackbelly'),
  ('ovino', 'CHEVIOT', 'Cheviot'),
  ('ovino', 'CORRIEDALE', 'Corriedale'),
  ('ovino', 'DORPER', 'Dorper'),
  ('ovino', 'DORSET', 'Dorset'),
  ('ovino', 'ETIOPE', 'Etíope'),
  ('ovino', 'HAMPSHIRE', 'Hampshire'),
  ('ovino', 'ILE DE FRANCE', 'Île de France'),
  ('ovino', 'KATAHDIN', 'Katahdin'),
  ('ovino', 'MERINO', 'Merino'),
  ('ovino', 'PELIBUEY', 'Pelibuey'),
  ('ovino', 'ROMNEY MARSH', 'Romney Marsh'),
  ('ovino', 'SANTA INES', 'Santa Inés'),
  ('ovino', 'SUDAN', 'Sudán'),
  ('ovino', 'SUFFOLK', 'Suffolk'),
  ('ovino', 'WHITE DORPER', 'White Dorper'),
  ('ovino', 'WITHE DORPER', 'White Dorper')
) as a (especie, alias, raza)
join public.razas r on r.especie = a.especie::public.especie and r.nombre = a.raza;

alter table public.razas_alias enable row level security;
create policy razas_alias_select on public.razas_alias for select to authenticated using (true);

-- ───────────────────────── Administrador de plataforma ─────────────────────────
create table public.plataforma_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.plataforma_admins enable row level security;
create policy plataforma_admins_select on public.plataforma_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.es_admin_plataforma() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.plataforma_admins where user_id = (select auth.uid()));
$$;

create function private.tiene_alguna_finca() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.finca_miembros where user_id = (select auth.uid()));
$$;

-- ───────────────────────── Documentos: HMAC con secreto en Vault ─────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'apriscol_pepper_documentos') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'apriscol_pepper_documentos',
      'HMAC de los documentos de titulares del libro genealógico');
  end if;
end $$;

create function private.normalizar_documento(p_doc text) returns text
language sql immutable set search_path = ''
as $$ select regexp_replace(coalesce(p_doc, ''), '\D', '', 'g'); $$;

create function private.hash_documento(p_doc text) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_clave text;
begin
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'apriscol_pepper_documentos';
  if v_clave is null then
    raise exception 'Falta el secreto de documentos en Vault.';
  end if;
  return encode(extensions.hmac(private.normalizar_documento(p_doc), v_clave, 'sha256'), 'hex');
end;
$$;
revoke all on function private.hash_documento(text) from public, anon, authenticated;

-- ───────────────────────── Titulares (propietarios y criadores) ─────────────────────────
create table public.libro_titulares (
  id uuid primary key default gen_random_uuid(),
  entidad text not null default 'ANCO',
  documento_tipo text not null check (documento_tipo in ('CC', 'CE', 'NIT', 'OTRO')),
  documento_hash text not null,
  documento_ultimos4 text not null check (char_length(documento_ultimos4) between 1 and 4),
  persona_juridica boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entidad, documento_hash)
);

-- ───────────────────────── Libro genealógico ─────────────────────────
create table public.libro_genealogico (
  id uuid primary key default gen_random_uuid(),
  entidad text not null default 'ANCO',
  numero_registro text not null,
  chip text not null,
  nombre text not null check (char_length(btrim(nombre)) >= 1),
  prefijo text,
  especie public.especie not null,
  sexo public.sexo_animal not null,
  raza_id smallint references public.razas (id),
  -- FU fundador · PO puro de origen · C1–C4 grados de cruzamiento · PP puro por pedigrí
  composicion text check (composicion in ('FU', 'PO', 'C1', 'C2', 'C3', 'C4', 'PP')),
  libro text check (libro in ('FUNDADORES', 'PURO DE ORIGEN', 'CRUZAMIENTO', 'PURO POR PEDIGREE')),
  -- MD monta directa · IA inseminación · TE transferencia de embriones · MDG monta dirigida
  concepcion text check (concepcion in ('MD', 'IA', 'TE', 'MDG')),
  fecha_nacimiento date,
  fecha_solicitud date,
  color text,
  rasgos text,
  marcas text,
  puntaje_fundador smallint check (puntaje_fundador between 0 and 100),
  padre_id uuid references public.libro_genealogico (id) on delete set null,
  madre_id uuid references public.libro_genealogico (id) on delete set null,
  -- Chip que la asociación declara para el padre/madre (se conserva aunque no exista en el libro).
  padre_chip_origen text,
  madre_chip_origen text,
  criadero text,
  departamento_dane text,
  municipio_dane text,
  estado text not null default 'vivo' check (estado in ('vivo', 'baja')),
  fecha_baja date,
  titular_id uuid references public.libro_titulares (id),
  criador_id uuid references public.libro_titulares (id),
  foto_origen text,
  observaciones text,
  datos_origen jsonb not null default '{}'::jsonb,
  notas_importacion text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entidad, numero_registro),
  unique (chip),
  constraint libro_parentesco_ck check (
    (padre_id is null or padre_id <> id) and (madre_id is null or madre_id <> id)
    and (padre_id is null or madre_id is null or padre_id <> madre_id)
  )
);
create index libro_padre_idx on public.libro_genealogico (padre_id) where padre_id is not null;
create index libro_madre_idx on public.libro_genealogico (madre_id) where madre_id is not null;
create index libro_titular_idx on public.libro_genealogico (titular_id);
create index libro_criador_idx on public.libro_genealogico (criador_id);
create index libro_raza_idx on public.libro_genealogico (raza_id) where raza_id is not null;
create index libro_prefijo_idx on public.libro_genealogico (prefijo);
create index libro_nombre_idx on public.libro_genealogico (lower(nombre));
create trigger libro_genealogico_updated_at before update on public.libro_genealogico
  for each row execute function private.set_updated_at();

alter table public.libro_genealogico enable row level security;
alter table public.libro_titulares enable row level security;

-- El libro es de consulta para quien ya tiene una finca (es información de pedigrí, como en cualquier asociación).
-- Escribir solo es posible con la llave de servicio (importación): no hay políticas de escritura.
create policy libro_genealogico_select on public.libro_genealogico for select to authenticated
  using ((select private.tiene_alguna_finca()));
-- Los titulares (aunque estén cifrados) solo los ve el administrador de plataforma.
create policy libro_titulares_select on public.libro_titulares for select to authenticated
  using ((select private.es_admin_plataforma()));

-- ───────────────────────── Animales de la finca: identificación y vínculo al libro ─────────────────────────
alter table public.animales
  add column chip text,
  add column color text,
  add column rasgos text,
  add column marcas text,
  add column libro_id uuid references public.libro_genealogico (id) on delete set null;

create unique index animales_chip_uk on public.animales (finca_id, chip) where chip is not null and deleted_at is null;
-- Un animal del libro solo puede estar en una finca a la vez.
create unique index animales_libro_uk on public.animales (libro_id) where libro_id is not null and deleted_at is null;

-- ───────────────────────── Reclamos de animales ─────────────────────────
create table public.solicitudes_reclamo (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  titular_id uuid not null references public.libro_titulares (id),
  solicitante_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  mensaje text check (char_length(mensaje) <= 500),
  animales_disponibles integer not null default 0,
  animales_importados integer,
  motivo_rechazo text,
  resuelta_por uuid references auth.users (id) on delete set null,
  resuelta_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index solicitudes_pendiente_uk on public.solicitudes_reclamo (finca_id, titular_id) where estado = 'pendiente';
create index solicitudes_solicitante_idx on public.solicitudes_reclamo (solicitante_id, created_at desc);
create index solicitudes_estado_idx on public.solicitudes_reclamo (estado, created_at);
create index solicitudes_titular_idx on public.solicitudes_reclamo (titular_id);
create trigger solicitudes_reclamo_updated_at before update on public.solicitudes_reclamo
  for each row execute function private.set_updated_at();

create table public.intentos_reclamo (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  encontrado boolean not null,
  created_at timestamptz not null default now()
);
create index intentos_reclamo_user_idx on public.intentos_reclamo (user_id, created_at desc);

alter table public.solicitudes_reclamo enable row level security;
alter table public.intentos_reclamo enable row level security;

create policy solicitudes_reclamo_select on public.solicitudes_reclamo for select to authenticated
  using (
    solicitante_id = (select auth.uid())
    or (select private.puede_gestionar(finca_id))
    or (select private.es_admin_plataforma())
  );

-- ───────────────────────── Permisos ─────────────────────────
revoke all on public.razas_alias, public.plataforma_admins, public.libro_titulares, public.libro_genealogico,
  public.solicitudes_reclamo, public.intentos_reclamo from anon;
grant select on public.razas_alias, public.plataforma_admins, public.libro_titulares, public.libro_genealogico,
  public.solicitudes_reclamo to authenticated;
revoke all on public.intentos_reclamo from authenticated;
