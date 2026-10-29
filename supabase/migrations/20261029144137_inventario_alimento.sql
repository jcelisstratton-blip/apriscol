-- Inventario de alimento (segunda entrega del inventario de bodega): concentrado, forraje, sales y suplementos, leche maternizada.
-- Igual que con los medicamentos, solo se guarda lo que la persona cuenta o anota (el conteo de apertura, los ajustes y las SALIDAS: lo que se le dio de comer
-- al hato). Las existencias se calculan: conteos + compras (gastos del producto × peso de cada unidad) − salidas, desde la fecha de apertura. Todo en kg.

-- 1. Permisos. El ordeñador es quien suele dar el alimento: ve el módulo «nutricion» y puede escribir en él, pero las políticas de la tabla le dejan crear solo salidas.
create or replace function private.puede_ver(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('hato', 'leche', 'novedades', 'nutricion')
      when 'veterinario' then p_modulo in ('hato', 'genealogia', 'sanidad', 'reproduccion', 'leche', 'carne', 'corrales', 'novedades', 'inventario')
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
      when 'ordenador' then p_modulo in ('leche', 'novedades', 'nutricion')
      when 'veterinario' then p_modulo in ('sanidad', 'reproduccion', 'corrales', 'novedades')
      when 'contador' then p_modulo = 'contabilidad'
      else false
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo)
  and coalesce(private.estado_plan(p_finca), 'vigente') in ('vigente', 'por_vencer');
$$;

-- 2. Cuánto pesa cada unidad en que se compra (un bulto, una paca). Sin ella, lo que se compra en bultos no se puede pasar a kg.
alter table public.finca_productos
  add column kg_por_unidad numeric(10, 2) check (kg_por_unidad is null or (kg_por_unidad > 0 and kg_por_unidad <= 100000));

-- 3. Los movimientos, siempre en kg. «apertura»: lo que había al empezar. «ajuste»: cambio con signo (conteo físico, pérdida, daño). «salida»: lo que se dio de comer, con su destino opcional.
create table public.inventario_alimento_movimientos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  producto_id uuid not null,
  tipo text not null check (tipo in ('apertura', 'ajuste', 'salida')),
  fecha date not null,
  cantidad numeric(14, 2) not null check (cantidad between -100000000 and 100000000),
  motivo text check (motivo is null or motivo in ('conteo', 'perdida', 'dano', 'otro')),
  ubicacion_id uuid,
  lote_id uuid,
  observaciones text check (observaciones is null or char_length(observaciones) <= 300),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint inv_alimento_producto_fk foreign key (producto_id, finca_id) references public.finca_productos (id, finca_id) on delete cascade,
  constraint inv_alimento_ubicacion_fk foreign key (ubicacion_id, finca_id) references public.ubicaciones (id, finca_id) on delete set null (ubicacion_id),
  constraint inv_alimento_lote_fk foreign key (lote_id, finca_id) references public.lotes_ceba (id, finca_id) on delete set null (lote_id),
  constraint inv_alimento_tipo_ck check (
    (tipo = 'apertura' and cantidad >= 0 and motivo is null and ubicacion_id is null and lote_id is null)
    or (tipo = 'ajuste' and cantidad <> 0 and motivo is not null and ubicacion_id is null and lote_id is null)
    or (tipo = 'salida' and cantidad > 0 and motivo is null and (ubicacion_id is null or lote_id is null)))
);
create unique index inv_alimento_apertura_uk on public.inventario_alimento_movimientos (finca_id, producto_id) where tipo = 'apertura';
create unique index inv_alimento_client_req_uk on public.inventario_alimento_movimientos (finca_id, client_request_id) where client_request_id is not null;
create index inv_alimento_producto_idx on public.inventario_alimento_movimientos (finca_id, producto_id, fecha desc);
create trigger inventario_alimento_movimientos_updated_at before update on public.inventario_alimento_movimientos
  for each row execute function private.set_updated_at();

-- 4. Quién escribe qué: todos los que ven el módulo leen. Crear: el ordeñador solo salidas (y a su nombre); el propietario y el administrador, cualquier movimiento.
-- Corregir o eliminar: el propietario y el administrador cualquiera; quien anotó una salida, la suya.
alter table public.inventario_alimento_movimientos enable row level security;
create policy inventario_alimento_select on public.inventario_alimento_movimientos for select to authenticated
  using (finca_id in (select private.fincas_ver('nutricion'::public.modulo_app)));
create policy inventario_alimento_insert on public.inventario_alimento_movimientos for insert to authenticated
  with check ((select private.puede_escribir(finca_id, 'nutricion'::public.modulo_app))
              and created_by = (select auth.uid())
              and (tipo = 'salida' or (select private.puede_gestionar(finca_id))));
create policy inventario_alimento_update on public.inventario_alimento_movimientos for update to authenticated
  using ((select private.puede_escribir(finca_id, 'nutricion'::public.modulo_app))
         and ((select private.puede_gestionar(finca_id)) or (created_by = (select auth.uid()) and tipo = 'salida')))
  with check ((select private.puede_escribir(finca_id, 'nutricion'::public.modulo_app))
              and ((select private.puede_gestionar(finca_id)) or (created_by = (select auth.uid()) and tipo = 'salida')));
create policy inventario_alimento_delete on public.inventario_alimento_movimientos for delete to authenticated
  using ((select private.puede_escribir(finca_id, 'nutricion'::public.modulo_app))
         and ((select private.puede_gestionar(finca_id)) or (created_by = (select auth.uid()) and tipo = 'salida')));
grant select, insert, update, delete on public.inventario_alimento_movimientos to authenticated;

-- 5. Las existencias de cada alimento. Corre con permisos propios para que quien da el alimento vea cuánto queda sin ver las compras (precios, proveedores).
-- «Alimento» son las compras del catálogo en los rubros concentrado, forraje, sales y suplementos, y leche maternizada.
-- Compra en kg: cuenta tal cual; en otra unidad (bultos, pacas): × kg_por_unidad; sin ese peso no se puede sumar y se cuenta en `compras_sin_calcular`.
-- El consumo es lo que se dio en los últimos 14 días (incluido `p_hoy`), y `dias_con_salida` cuántos días distintos tuvieron salidas.
create or replace function public.inventario_alimento(p_finca uuid, p_hoy date)
returns table (
  producto_id uuid, nombre text, rubro text, unidad text, kg_por_unidad numeric,
  desde date, stock_kg numeric, consumo_kg numeric, dias_con_salida integer, compras_sin_calcular integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.puede_ver(p_finca, 'nutricion') then
    raise exception 'No tienes permiso para ver el inventario de alimento de esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    with prod as (
      select p.id, p.nombre, p.rubro, p.unidad, p.kg_por_unidad,
             case when lower(btrim(coalesce(p.unidad, ''))) = 'kg' then 1::numeric else p.kg_por_unidad end as factor
        from public.finca_productos p
       where p.finca_id = p_finca and p.tipo = 'compra' and p.activo
         and p.rubro in ('concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada')),
    ap as (
      select m.producto_id as pid, min(m.fecha) as desde
        from public.inventario_alimento_movimientos m
       where m.finca_id = p_finca and m.tipo = 'apertura'
       group by 1),
    conteos as (
      select m.producto_id as pid, sum(m.cantidad) as kg
        from public.inventario_alimento_movimientos m
       where m.finca_id = p_finca and m.tipo in ('apertura', 'ajuste')
       group by 1),
    compras as (
      select g.producto_id as pid, sum(coalesce(g.cantidad, 0) * coalesce(pr.factor, 0)) as kg,
             count(*) filter (where g.cantidad is null or pr.factor is null)::integer as sin_calcular
        from public.gastos g
        join ap on ap.pid = g.producto_id and g.fecha >= ap.desde
        join prod pr on pr.id = g.producto_id
       where g.finca_id = p_finca
       group by 1),
    sal as (
      select m.producto_id as pid, sum(m.cantidad) as total,
             sum(m.cantidad) filter (where m.fecha > p_hoy - 14 and m.fecha <= p_hoy) as reciente,
             count(distinct m.fecha) filter (where m.fecha > p_hoy - 14 and m.fecha <= p_hoy)::integer as dias
        from public.inventario_alimento_movimientos m
        join ap on ap.pid = m.producto_id and m.fecha >= ap.desde
       where m.finca_id = p_finca and m.tipo = 'salida'
       group by 1)
    select pr.id, pr.nombre, pr.rubro, pr.unidad, pr.kg_por_unidad,
           ap.desde,
           case when ap.desde is null then null else coalesce(c.kg, 0) + coalesce(co.kg, 0) - coalesce(s.total, 0) end,
           coalesce(s.reciente, 0), coalesce(s.dias, 0), coalesce(co.sin_calcular, 0)
      from prod pr
      left join ap on ap.pid = pr.id
      left join conteos c on c.pid = pr.id
      left join compras co on co.pid = pr.id
      left join sal s on s.pid = pr.id
     order by pr.nombre;
end
$$;
revoke execute on function public.inventario_alimento(uuid, date) from public, anon;
grant execute on function public.inventario_alimento(uuid, date) to authenticated;
