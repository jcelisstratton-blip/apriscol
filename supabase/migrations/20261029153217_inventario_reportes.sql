-- Reportes del inventario (medicamentos y alimento): solo los lee el propietario o el administrador.
-- Tres funciones de lectura que arman lo que el stock mezcla en una sola cifra: los lotes con su vencimiento y los movimientos de un periodo
-- (compras, aplicaciones o salidas, ajustes y aperturas), con la misma regla que el stock (`private.inventario_calculo`, `inventario_alimento`):
-- solo cuentan las compras y las aplicaciones desde la apertura de cada producto. Corren con permisos propios porque leen compras (`gastos`), que el veterinario y el ordeñador no ven.

-- 1. Movimientos de medicamentos y vacunas, en la unidad de la dosis. Entradas (+), aplicaciones (−), ajustes (con signo) y aperturas.
create or replace function private.inventario_mov_med(p_finca uuid, p_desde date, p_hasta date)
returns table (fecha date, producto_id uuid, producto text, unidad text, tipo text, cantidad numeric, lote text, detalle text, quien text)
language sql stable security definer set search_path = ''
as $$
  with ap as (
    select m.producto_vet_id as pid, min(m.fecha) as desde
      from public.inventario_movimientos m
     where m.finca_id = p_finca and m.tipo = 'apertura'
     group by 1),
  todo as (
    select m.fecha, m.producto_vet_id as pid, m.tipo, m.cantidad, m.lote,
           case when m.tipo = 'apertura' then 'Conteo de apertura'
                else case m.motivo when 'conteo' then 'Conteo físico' when 'vencido' then 'Vencido' when 'perdida' then 'Pérdida' when 'dano' then 'Dañado' else 'Otro motivo' end end
             || coalesce(': ' || nullif(btrim(m.observaciones), ''), '') as detalle,
           m.created_by as autor
      from public.inventario_movimientos m
     where m.finca_id = p_finca
    union all
    select g.fecha, g.producto_vet_id, 'compra', g.cantidad * p.contenido_presentacion, g.lote_producto,
           'Compra de ' || coalesce(trim_scale(g.cantidad)::text, 'una cantidad sin anotar') || ' ' || coalesce(g.unidad, 'unidades')
             || case when g.cantidad is null or p.contenido_presentacion is null then ' (no se pudo sumar: falta la cantidad o definir cómo viene el producto)' else '' end,
           g.created_by
      from public.gastos g
      join ap on ap.pid = g.producto_vet_id and g.fecha >= ap.desde
      join public.productos_veterinarios p on p.id = g.producto_vet_id and p.finca_id = g.finca_id
     where g.finca_id = p_finca
    union all
    select e.fecha, e.producto_id, 'aplicacion', -(e.dosis * coalesce(e.dias_tratamiento, 1) * n.animales), e.lote_producto,
           case e.tipo when 'vacunacion' then 'Vacunación' when 'desparasitacion' then 'Desparasitación' when 'tratamiento' then 'Tratamiento' when 'cirugia' then 'Cirugía' else 'Aplicación' end
             || ': ' || n.animales || case when n.animales = 1 then ' animal' else ' animales' end
             || case when e.dosis is null then ' (sin dosis: no descuenta)' else ' × ' || trim_scale(e.dosis)::text || coalesce(' ' || e.unidad_dosis, '') || case when coalesce(e.dias_tratamiento, 1) > 1 then ' × ' || e.dias_tratamiento || ' días' else '' end end,
           e.created_by
      from public.eventos_sanitarios e
      join ap on ap.pid = e.producto_id and e.fecha >= ap.desde
      cross join lateral (select count(*) as animales from public.evento_sanitario_animales a where a.evento_id = e.id and a.finca_id = e.finca_id) n
     where e.finca_id = p_finca and e.producto_id is not null)
  select t.fecha, t.pid, p.nombre, p.unidad_dosis, t.tipo, t.cantidad, t.lote, t.detalle, pf.nombre
    from todo t
    join public.productos_veterinarios p on p.id = t.pid and p.finca_id = p_finca
    left join public.perfiles pf on pf.id = t.autor
   where t.fecha >= coalesce(p_desde, date '0001-01-01') and t.fecha <= coalesce(p_hasta, date '9999-12-31')
   order by t.fecha desc, p.nombre, t.tipo
   limit 20000;
$$;
revoke execute on function private.inventario_mov_med(uuid, date, date) from public, anon, authenticated;

create or replace function public.inventario_movimientos_med(p_finca uuid, p_desde date, p_hasta date)
returns table (fecha date, producto_id uuid, producto text, unidad text, tipo text, cantidad numeric, lote text, detalle text, quien text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.puede_gestionar(p_finca) and private.puede_ver(p_finca, 'inventario')) then
    raise exception 'Solo el propietario o el administrador puede ver los reportes del inventario.' using errcode = 'insufficient_privilege';
  end if;
  return query select * from private.inventario_mov_med(p_finca, p_desde, p_hasta);
end
$$;
revoke execute on function public.inventario_movimientos_med(uuid, date, date) from public, anon;
grant execute on function public.inventario_movimientos_med(uuid, date, date) to authenticated;

-- 2. Todos los lotes de medicamentos y vacunas con lo que queda de cada uno y su vencimiento.
create or replace function public.inventario_lotes_finca(p_finca uuid)
returns table (producto_id uuid, producto text, tipo text, unidad text, lote text, vencimiento date, stock numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.puede_gestionar(p_finca) and private.puede_ver(p_finca, 'inventario')) then
    raise exception 'Solo el propietario o el administrador puede ver los reportes del inventario.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select k.producto_id, p.nombre, p.tipo, p.unidad_dosis, k.lote, k.vencimiento, k.stock
      from private.inventario_calculo(p_finca) k
      join public.productos_veterinarios p on p.id = k.producto_id and p.finca_id = p_finca
     order by k.vencimiento nulls last, p.nombre, k.lote nulls last;
end
$$;
revoke execute on function public.inventario_lotes_finca(uuid) from public, anon;
grant execute on function public.inventario_lotes_finca(uuid) to authenticated;

-- 3. Movimientos de alimento, siempre en kg. Compras (+, cantidad × peso por unidad), salidas (−, con su destino), ajustes (con signo) y aperturas.
create or replace function private.inventario_mov_alimento(p_finca uuid, p_desde date, p_hasta date)
returns table (fecha date, producto_id uuid, producto text, tipo text, kg numeric, destino text, detalle text, quien text)
language sql stable security definer set search_path = ''
as $$
  with prod as (
    select p.id, p.nombre,
           case when lower(btrim(coalesce(p.unidad, ''))) = 'kg' then 1::numeric else p.kg_por_unidad end as factor
      from public.finca_productos p
     where p.finca_id = p_finca and p.tipo = 'compra' and p.rubro in ('concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada')),
  ap as (
    select m.producto_id as pid, min(m.fecha) as desde
      from public.inventario_alimento_movimientos m
     where m.finca_id = p_finca and m.tipo = 'apertura'
     group by 1),
  todo as (
    select m.fecha, m.producto_id as pid, m.tipo,
           case when m.tipo = 'salida' then -m.cantidad else m.cantidad end as kg,
           coalesce(u.nombre, l.nombre) as destino,
           case m.tipo when 'apertura' then 'Conteo de apertura' when 'salida' then 'Se dio de comer'
                else case m.motivo when 'conteo' then 'Conteo físico' when 'perdida' then 'Pérdida' when 'dano' then 'Dañado' else 'Otro motivo' end end
             || coalesce(': ' || nullif(btrim(m.observaciones), ''), '') as detalle,
           m.created_by as autor
      from public.inventario_alimento_movimientos m
      left join public.ubicaciones u on u.id = m.ubicacion_id and u.finca_id = m.finca_id
      left join public.lotes_ceba l on l.id = m.lote_id and l.finca_id = m.finca_id
     where m.finca_id = p_finca
    union all
    select g.fecha, g.producto_id, 'compra', g.cantidad * pr.factor, null::text,
           'Compra de ' || coalesce(trim_scale(g.cantidad)::text, 'una cantidad sin anotar') || ' ' || coalesce(g.unidad, 'unidades')
             || case when g.cantidad is null or pr.factor is null then ' (no se pudo sumar: falta la cantidad o el peso de cada unidad)' else '' end,
           g.created_by
      from public.gastos g
      join ap on ap.pid = g.producto_id and g.fecha >= ap.desde
      join prod pr on pr.id = g.producto_id
     where g.finca_id = p_finca)
  select t.fecha, t.pid, pr.nombre, t.tipo, t.kg, t.destino, t.detalle, pf.nombre
    from todo t
    join prod pr on pr.id = t.pid
    left join public.perfiles pf on pf.id = t.autor
   where t.fecha >= coalesce(p_desde, date '0001-01-01') and t.fecha <= coalesce(p_hasta, date '9999-12-31')
   order by t.fecha desc, pr.nombre, t.tipo
   limit 20000;
$$;
revoke execute on function private.inventario_mov_alimento(uuid, date, date) from public, anon, authenticated;

create or replace function public.inventario_movimientos_alimento(p_finca uuid, p_desde date, p_hasta date)
returns table (fecha date, producto_id uuid, producto text, tipo text, kg numeric, destino text, detalle text, quien text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.puede_gestionar(p_finca) and private.puede_ver(p_finca, 'nutricion')) then
    raise exception 'Solo el propietario o el administrador puede ver los reportes del inventario.' using errcode = 'insufficient_privilege';
  end if;
  return query select * from private.inventario_mov_alimento(p_finca, p_desde, p_hasta);
end
$$;
revoke execute on function public.inventario_movimientos_alimento(uuid, date, date) from public, anon;
grant execute on function public.inventario_movimientos_alimento(uuid, date, date) to authenticated;
