-- Costos, ahora con las compras separadas de las ventas:
--  · costos_base suma la compra de cada animal comprado (su valor de compra, en su fecha) como «compra_animales», y muestra el nombre del
--    tercero elegido como proveedor. La compra de un animal NO se carga a su costo por animal (es su adquisición, no lo que cuesta mantenerlo).
--  · Los ingresos de costos_indicadores y costos_por_mes salen de ventas_base (leche, animales y todo lo que se vende en `ventas`).
--  · grupo_rubro separa «Mano de obra» y «Compra de animales» de los demás gastos de operación.
--  · costos_posible_doble_conteo avisa cuando un mismo rubro entra por dos caminos (lo comprado y lo consumido en ceba o en un tratamiento).
-- Las funciones conservan sus columnas: el código anterior sigue funcionando mientras Vercel termina de desplegar.

create or replace function private.grupo_rubro(p_rubro text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_rubro in ('concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada') then 'alimentacion'
    when p_rubro in ('vacunas_desparasitantes', 'tratamientos', 'pruebas_laboratorio', 'podologia', 'bioseguridad') then 'sanidad'
    when p_rubro in ('material_reproductivo', 'asistencia_veterinaria') then 'reproduccion'
    when p_rubro in ('identificacion', 'fletes') then 'logistica'
    when p_rubro = 'mano_obra' then 'personal'
    when p_rubro = 'compra_animales' then 'animales'
    else 'operacion'
  end;
$$;

create or replace function private.costos_base(p_finca uuid, p_desde date, p_hasta date)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date)
language sql stable security definer set search_path = ''
as $$
  select 'gasto'::text, g.id, g.fecha, g.rubro, g.descripcion, coalesce(t.nombre, g.proveedor), g.monto, g.destino_tipo, g.especie, g.ubicacion_id, g.lote_id, g.animal_id,
         g.pagado_en is not null, g.vence
    from public.gastos g
    left join public.finca_terceros t on t.id = g.tercero_id and t.finca_id = g.finca_id
   where g.finca_id = p_finca and (p_desde is null or g.fecha >= p_desde) and (p_hasta is null or g.fecha <= p_hasta)
  union all
  select 'sanidad'::text, e.id, e.fecha,
         case when e.tipo in ('podologia', 'pediluvio') then 'podologia'
              when e.tipo in ('vacunacion', 'desparasitacion') then 'vacunas_desparasitantes'
              else 'tratamientos' end,
         coalesce(nullif(btrim(e.producto_nombre), ''), initcap(e.tipo)), null::text, e.costo, 'evento'::text, null::text, null::uuid, null::uuid, null::uuid, true, null::date
    from public.eventos_sanitarios e
   where e.finca_id = p_finca and e.costo is not null and e.costo > 0 and (p_desde is null or e.fecha >= p_desde) and (p_hasta is null or e.fecha <= p_hasta)
  union all
  select 'ceba'::text, c.id, c.fecha, 'concentrado', coalesce(nullif(btrim(c.alimento), ''), 'Alimento de ceba'), null::text, c.costo, 'lote'::text, null::text, null::uuid, c.lote_id, null::uuid, true, null::date
    from public.consumo_lote c
   where c.finca_id = p_finca and c.costo is not null and c.costo > 0 and (p_desde is null or c.fecha >= p_desde) and (p_hasta is null or c.fecha <= p_hasta)
  union all
  -- La compra de cada animal comprado, en su fecha. `destino_tipo = 'adquisicion'` la deja fuera del costo por animal.
  select 'compra'::text, c.id, c.fecha, 'compra_animales'::text, 'Compra de ' || c.numero_arete || coalesce(' · ' || c.nombre, ''), null::text, c.valor_compra, 'adquisicion'::text,
         null::text, null::uuid, null::uuid, c.id, true, null::date
    from (select a.id, a.numero_arete, a.nombre, a.valor_compra, coalesce(a.fecha_compra, (a.created_at at time zone 'America/Bogota')::date) as fecha
            from public.animales a
           where a.finca_id = p_finca and a.origen = 'comprado' and a.valor_compra is not null and a.valor_compra > 0 and a.deleted_at is null) c
   where (p_desde is null or c.fecha >= p_desde) and (p_hasta is null or c.fecha <= p_hasta);
$$;
revoke all on function private.costos_base(uuid, date, date) from public, anon, authenticated;

-- Mes a mes: lo que se gastó, lo que entró (leche, animales y demás ventas) y los litros producidos. «Ingresos de animales» recoge todo lo que no es leche.
create or replace function public.costos_por_mes(p_finca uuid, p_desde date, p_hasta date)
returns table (mes date, costos numeric, ingresos_leche numeric, ingresos_animales numeric, litros numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with c as (select date_trunc('month', b.fecha)::date as mes, sum(b.monto) as v from private.costos_base(p_finca, p_desde, p_hasta) b group by 1),
    l as (select date_trunc('month', s.fecha)::date as mes, sum(s.valor) as v from private.ventas_base(p_finca, p_desde, p_hasta) s where s.linea = 'leche' group by 1),
    v as (select date_trunc('month', s.fecha)::date as mes, sum(s.valor) as v from private.ventas_base(p_finca, p_desde, p_hasta) s where s.linea <> 'leche' group by 1),
    q as (select date_trunc('month', pd.fecha)::date as mes, sum(coalesce(pd.litros_tanque, 0)) as v from public.v_produccion_diaria pd
           where pd.finca_id = p_finca and (p_desde is null or pd.fecha >= p_desde) and (p_hasta is null or pd.fecha <= p_hasta) group by 1),
    m as (select c.mes from c union select l.mes from l union select v.mes from v union select q.mes from q)
    select m.mes, coalesce(c.v, 0), coalesce(l.v, 0), coalesce(v.v, 0), coalesce(q.v, 0)
      from m left join c on c.mes = m.mes left join l on l.mes = m.mes left join v on v.mes = m.mes left join q on q.mes = m.mes
     order by m.mes;
end;
$$;

create or replace function public.costos_indicadores(p_finca uuid, p_desde date, p_hasta date)
returns table (total_costos numeric, por_pagar numeric, vencido numeric, ingresos_leche numeric, ingresos_animales numeric, litros numeric, animales_activos integer)
language plpgsql stable security definer set search_path = ''
as $$
declare v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  perform private.costos_permiso(p_finca);
  return query
    select coalesce((select sum(b.monto) from private.costos_base(p_finca, p_desde, p_hasta) b), 0),
           coalesce((select sum(b.monto) from private.costos_base(p_finca, p_desde, p_hasta) b where not b.pagado), 0),
           coalesce((select sum(b.monto) from private.costos_base(p_finca, p_desde, p_hasta) b where not b.pagado and b.vence is not null and b.vence < v_hoy), 0),
           coalesce((select sum(s.valor) from private.ventas_base(p_finca, p_desde, p_hasta) s where s.linea = 'leche'), 0),
           coalesce((select sum(s.valor) from private.ventas_base(p_finca, p_desde, p_hasta) s where s.linea <> 'leche'), 0),
           coalesce((select sum(coalesce(pd.litros_tanque, 0)) from public.v_produccion_diaria pd where pd.finca_id = p_finca and (p_desde is null or pd.fecha >= p_desde) and (p_hasta is null or pd.fecha <= p_hasta)), 0),
           (select count(*)::integer from public.animales a where a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null);
end;
$$;

-- Rubros que entran por dos caminos en el periodo: lo comprado (gastos) y lo consumido (alimento de ceba o costo de un tratamiento). Puede ser
-- legítimo (alimento distinto), pero casi siempre es la misma compra contada dos veces: se avisa para que la persona lo revise.
create function public.costos_posible_doble_conteo(p_finca uuid, p_desde date, p_hasta date)
returns table (rubro text, compras numeric, consumo numeric, origen_consumo text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with b as (select * from private.costos_base(p_finca, p_desde, p_hasta)),
    g as (select x.rubro, sum(x.monto) as m from b x where x.origen = 'gasto' group by x.rubro),
    c as (select x.rubro, x.origen, sum(x.monto) as m from b x where x.origen in ('sanidad', 'ceba') group by x.rubro, x.origen)
    select g.rubro, g.m, c.m, c.origen from g join c on c.rubro = g.rubro order by g.m desc;
end;
$$;
revoke execute on function public.costos_posible_doble_conteo(uuid, date, date) from public, anon;
grant execute on function public.costos_posible_doble_conteo(uuid, date, date) to authenticated;
