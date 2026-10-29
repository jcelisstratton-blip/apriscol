-- Inventario: cierra los huecos de lo que todavía no se descontaba solo.
--  · El consumo de un lote de ceba dice de qué alimento fue (`consumo_lote.producto_id`) y descuenta del inventario de alimento sin anotarlo dos veces.
--  · Un pediluvio con producto descuenta lo que se usó en el baño (la cantidad se anota una vez por baño, no por animal).
--  · Un índice para que el cálculo de medicamentos no recorra todas las compras de la finca.
-- Todo retrocompatible: columnas nuevas y opcionales, y las funciones se reemplazan con el mismo contrato.

-- 1. El alimento de cada consumo de ceba. Los registros anteriores se enlazan por el nombre del alimento cuando coincide con uno del catálogo.
alter table public.consumo_lote add column producto_id uuid;
alter table public.consumo_lote
  add constraint consumo_lote_producto_fk foreign key (producto_id, finca_id) references public.finca_productos (id, finca_id) on delete set null (producto_id);
create index consumo_lote_producto_idx on public.consumo_lote (finca_id, producto_id, fecha) where producto_id is not null;

update public.consumo_lote c
   set producto_id = p.id
  from public.finca_productos p
 where c.producto_id is null
   and p.finca_id = c.finca_id and p.tipo = 'compra' and p.rubro in ('concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada')
   and lower(btrim(p.nombre)) = lower(btrim(c.alimento));

-- 2. Las compras de un producto veterinario (el índice anterior solo cubría las que traen lote).
create index gastos_producto_vet_fecha_idx on public.gastos (finca_id, producto_vet_id, fecha) where producto_vet_id is not null;

-- 3. Medicamentos: una aplicación resta dosis × animales × días; un pediluvio, la cantidad de producto que se usó en el baño (una vez, no por animal).
create or replace function private.inventario_calculo(p_finca uuid)
returns table (producto_id uuid, lote text, vencimiento date, stock numeric, desde date)
language sql stable security definer set search_path = ''
as $$
  with desde as (
    select m.producto_vet_id as producto_id, min(m.fecha) as desde
      from public.inventario_movimientos m
     where m.finca_id = p_finca and m.tipo = 'apertura'
     group by 1),
  conteos as (
    select m.producto_vet_id as producto_id, m.lote, max(m.vencimiento) as vencimiento, sum(m.cantidad) as cant
      from public.inventario_movimientos m
     where m.finca_id = p_finca
     group by 1, 2),
  compras as (
    select g.producto_vet_id as producto_id, g.lote_producto as lote, max(g.lote_vencimiento) as vencimiento,
           sum(coalesce(g.cantidad, 0) * coalesce(p.contenido_presentacion, 0)) as cant
      from public.gastos g
      join desde d on d.producto_id = g.producto_vet_id and g.fecha >= d.desde
      join public.productos_veterinarios p on p.id = g.producto_vet_id and p.finca_id = g.finca_id
     where g.finca_id = p_finca
     group by 1, 2),
  salidas as (
    select e.producto_id, e.lote_producto as lote,
           sum(e.dosis * coalesce(e.dias_tratamiento, 1)
               * case when e.tipo = 'pediluvio' then 1 else (select count(*) from public.evento_sanitario_animales a where a.evento_id = e.id and a.finca_id = e.finca_id) end) as cant
      from public.eventos_sanitarios e
      join desde d on d.producto_id = e.producto_id and e.fecha >= d.desde
     where e.finca_id = p_finca and e.dosis is not null
     group by 1, 2),
  todo as (
    select producto_id, lote, vencimiento, cant from conteos
    union all select producto_id, lote, vencimiento, cant from compras
    union all select producto_id, lote, null::date, -cant from salidas)
  select t.producto_id, t.lote, max(t.vencimiento), sum(t.cant), d.desde
    from todo t
    join desde d on d.producto_id = t.producto_id
   group by t.producto_id, t.lote, d.desde;
$$;
revoke execute on function private.inventario_calculo(uuid) from public, anon, authenticated;

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
    select e.fecha, e.producto_id, 'aplicacion',
           -(e.dosis * coalesce(e.dias_tratamiento, 1) * case when e.tipo = 'pediluvio' then 1 else n.animales end), e.lote_producto,
           case when e.tipo = 'pediluvio'
                then 'Pediluvio: ' || n.animales || case when n.animales = 1 then ' animal' else ' animales' end
                       || case when e.dosis is null then ' (sin la cantidad de producto: no descuenta)' else ' · ' || trim_scale(e.dosis)::text || coalesce(' ' || e.unidad_dosis, '') || ' de producto en el baño' end
                else case e.tipo when 'vacunacion' then 'Vacunación' when 'desparasitacion' then 'Desparasitación' when 'tratamiento' then 'Tratamiento' when 'cirugia' then 'Cirugía' else 'Aplicación' end
                       || ': ' || n.animales || case when n.animales = 1 then ' animal' else ' animales' end
                       || case when e.dosis is null then ' (sin dosis: no descuenta)' else ' × ' || trim_scale(e.dosis)::text || coalesce(' ' || e.unidad_dosis, '') || case when coalesce(e.dias_tratamiento, 1) > 1 then ' × ' || e.dias_tratamiento || ' días' else '' end end
           end,
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

-- 4. Alimento: lo que se dio de comer son las salidas anotadas más el consumo de los lotes de ceba que dicen de qué alimento fue.
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
    dado as (
      select m.producto_id as pid, m.fecha, m.cantidad as kg
        from public.inventario_alimento_movimientos m
       where m.finca_id = p_finca and m.tipo = 'salida'
      union all
      select c.producto_id, c.fecha, c.kg_alimento
        from public.consumo_lote c
       where c.finca_id = p_finca and c.producto_id is not null),
    sal as (
      select d.pid, sum(d.kg) as total,
             sum(d.kg) filter (where d.fecha > p_hoy - 14 and d.fecha <= p_hoy) as reciente,
             count(distinct d.fecha) filter (where d.fecha > p_hoy - 14 and d.fecha <= p_hoy)::integer as dias
        from dado d
        join ap on ap.pid = d.pid and d.fecha >= ap.desde
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
     where g.finca_id = p_finca
    union all
    select c.fecha, c.producto_id, 'salida', -c.kg_alimento, l.nombre,
           'Consumo del lote de ceba' || coalesce(': ' || nullif(btrim(c.observaciones), ''), ''),
           c.created_by
      from public.consumo_lote c
      join ap on ap.pid = c.producto_id and c.fecha >= ap.desde
      join public.lotes_ceba l on l.id = c.lote_id and l.finca_id = c.finca_id
     where c.finca_id = p_finca and c.producto_id is not null)
  select t.fecha, t.pid, pr.nombre, t.tipo, t.kg, t.destino, t.detalle, pf.nombre
    from todo t
    join prod pr on pr.id = t.pid
    left join public.perfiles pf on pf.id = t.autor
   where t.fecha >= coalesce(p_desde, date '0001-01-01') and t.fecha <= coalesce(p_hasta, date '9999-12-31')
   order by t.fecha desc, pr.nombre, t.tipo
   limit 20000;
$$;
revoke execute on function private.inventario_mov_alimento(uuid, date, date) from public, anon, authenticated;
