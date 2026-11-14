-- Conexión con IA (MCP de Apriscol): el token personal con el que una persona deja que su asistente (Claude Desktop, Claude Code…) consulte su finca.
--  · Solo se guarda la huella (SHA-256) del token: el token entero se muestra una única vez al crearlo y no se puede recuperar.
--  · Cada token es de una persona en una finca (llave compuesta a finca_miembros: si la sacan de la finca, sus tokens desaparecen).
--  · El rol y los permisos NO se guardan aquí: se leen de finca_miembros en cada consulta, así que un cambio de rol aplica de inmediato.
--  · La persona ve y revoca solo los suyos; crear exige ser el dueño del token y tener un tope de tokens activos. Quien consulta con el token
--    (la ruta /api/mcp) lo busca por su huella con la llave de servicio.
-- Retrocompatible: solo una tabla nueva.

create table public.tokens_ia (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null,
  user_id uuid not null,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  /** Los primeros caracteres del token, para reconocerlo en la lista sin poder usarlo. */
  prefijo text not null check (char_length(prefijo) between 4 and 16),
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  creado_en timestamptz not null default now(),
  ultimo_uso timestamptz,
  revocado_en timestamptz,
  constraint tokens_ia_miembro_fk foreign key (finca_id, user_id) references public.finca_miembros (finca_id, user_id) on delete cascade
);
create unique index tokens_ia_huella_uk on public.tokens_ia (huella);
create index tokens_ia_persona_idx on public.tokens_ia (user_id, finca_id) where revocado_en is null;

-- Tope de tokens activos por persona y finca (evita acumular llaves olvidadas). Corre con los permisos de quien inserta.
create function public.tokens_ia_tope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.tokens_ia t where t.user_id = new.user_id and t.finca_id = new.finca_id and t.revocado_en is null) >= 5 then
    raise exception 'Ya tienes 5 conexiones activas en esta finca. Revoca una para crear otra.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.tokens_ia_tope() from public, anon, authenticated;
create trigger tokens_ia_tope before insert on public.tokens_ia for each row execute function public.tokens_ia_tope();

alter table public.tokens_ia enable row level security;

create policy tokens_ia_leer on public.tokens_ia for select to authenticated using (user_id = (select auth.uid()));
create policy tokens_ia_crear on public.tokens_ia for insert to authenticated
  with check (user_id = (select auth.uid()) and revocado_en is null and ultimo_uso is null);
create policy tokens_ia_revocar on public.tokens_ia for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Permisos por columna: la persona crea con lo suyo y solo puede cambiar `revocado_en` (nunca la huella ni el dueño).
revoke all on public.tokens_ia from anon, authenticated;
grant select on public.tokens_ia to authenticated;
grant insert (finca_id, user_id, nombre, prefijo, huella) on public.tokens_ia to authenticated;
grant update (revocado_en) on public.tokens_ia to authenticated;
grant select, update on public.tokens_ia to service_role;
