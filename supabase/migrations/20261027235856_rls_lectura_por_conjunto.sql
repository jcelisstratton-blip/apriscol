-- Rendimiento de lectura bajo RLS.
--
-- Problema medido: las políticas de SELECT llamaban `private.puede_ver(finca_id, módulo)` con una COLUMNA de la fila.
-- Aunque estuviera envuelta en `(select …)`, al depender de la fila Postgres la evalúa una vez por fila
-- (≈0,2 ms cada una): leer 16.548 ordeños costaba 3,2 s, y un mes de 1.378 filas 270 ms.
-- Con el conjunto de fincas visibles calculado UNA vez por consulta (hashed SubPlan) cuesta 3 ms (≈1000× menos).
--
-- Semántica idéntica: `fincas_ver(m)` devuelve las fincas donde la persona es miembro y `puede_ver(finca, m)` es verdadero;
-- `fincas_miembro()` las fincas donde es miembro. Solo se reescriben las políticas de SELECT; INSERT/UPDATE/DELETE
-- evalúan pocas filas y se dejan igual.

create or replace function private.fincas_ver(p_modulo public.modulo_app)
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.finca_id
  from public.finca_miembros m
  where m.user_id = (select auth.uid())
    and private.puede_ver(m.finca_id, p_modulo);
$$;

create or replace function private.fincas_miembro()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.finca_id from public.finca_miembros m where m.user_id = (select auth.uid());
$$;

revoke execute on function private.fincas_ver(public.modulo_app) from public, anon;
revoke execute on function private.fincas_miembro() from public, anon;
grant execute on function private.fincas_ver(public.modulo_app) to authenticated;
grant execute on function private.fincas_miembro() to authenticated;

-- Las tablas nuevas nacen con el patrón rápido.
create or replace function private.crear_politicas_finca(p_tabla text, p_modulo public.modulo_app)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', p_tabla);
  execute format(
    'create policy %I on public.%I for select to authenticated using (finca_id in (select private.fincas_ver(%L::public.modulo_app)))',
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

-- Reescribe las políticas de SELECT existentes que siguen exactamente el patrón por fila.
do $$
declare
  p record;
  v_modulo text;
begin
  for p in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public' and cmd = 'SELECT'
  loop
    if p.qual ~ '^\( SELECT private\.puede_ver\(\w+\.finca_id, ''\w+''::modulo_app\) AS puede_ver\)$' then
      v_modulo := substring(p.qual from '''(\w+)''::modulo_app');
      execute format(
        'alter policy %I on public.%I using (finca_id in (select private.fincas_ver(%L::public.modulo_app)))',
        p.policyname, p.tablename, v_modulo);
    elsif p.qual ~ '^\( SELECT private\.es_miembro\(\w+\.finca_id\) AS es_miembro\)$' then
      execute format(
        'alter policy %I on public.%I using (finca_id in (select private.fincas_miembro()))',
        p.policyname, p.tablename);
    end if;
  end loop;
end
$$;

-- Índices de apoyo para las llaves foráneas compuestas (x_id, finca_id) que no tienen ninguno que empiece por su primera columna
-- (la comprobación al borrar o actualizar el padre y los joins por animal/parto/lote recorrían la tabla entera).
do $$
declare
  c record;
  v_cols text;
begin
  for c in
    select con.conrelid, con.conrelid::regclass::text as tabla, con.conname, con.conkey
    from pg_constraint con
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and array_length(con.conkey, 1) = 2
  loop
    if not exists (
      select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
    ) then
      select string_agg(quote_ident(a.attname), ', ' order by array_position(c.conkey, a.attnum))
        into v_cols
      from pg_attribute a
      where a.attrelid = c.conrelid and a.attnum = any (c.conkey);
      execute format('create index if not exists %I on %s (%s)', left(c.conname || '_idx', 63), c.tabla, v_cols);
    end if;
  end loop;
end
$$;
