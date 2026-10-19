-- Nómina: la mano de obra, separada de las compras.
--  · personal: quién trabaja en la finca, con qué vinculación (contrato laboral o prestación de servicios) y cómo se le paga (mensual, jornal o por servicio).
--  · pagos_personal: cada pago. Lo que recibe la persona sale de su contrato (cantidad × valor base); lo que le cuesta a la finca multiplica por el factor
--    prestacional de los ajustes de la finca (solo contrato laboral; en prestación de servicios es 1). El factor se fija al registrar el pago.
--  · A quien está por prestación de servicios no se le registra un pago como hecho sin el soporte de pago de su seguridad social (PILA).
--  · costos_base suma estos pagos como «mano_obra» (origen «nomina»), y costos_posible_doble_conteo avisa si hay mano de obra también como compra.
-- Módulo «contabilidad» (propietario, administrador y contador): los sueldos son información sensible y no los ve el resto del equipo.
-- No se guardan documentos de identidad de las personas ni se fija ninguna tarifa legal: el factor lo define el propietario en Ajustes.

create table public.personal (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  cargo text check (cargo is null or char_length(btrim(cargo)) between 1 and 60),
  -- laboral: contrato de trabajo (lleva factor prestacional). servicios: prestación de servicios (la seguridad social la paga la persona; se exige su PILA).
  vinculacion text not null check (vinculacion in ('laboral', 'servicios')),
  forma_pago text not null check (forma_pago in ('mensual', 'jornal', 'por_servicio')),
  -- Salario mensual, valor del jornal (un día) u honorario por servicio, según la forma de pago.
  valor_base numeric(14, 2) not null check (valor_base >= 0 and valor_base <= 100000000000),
  fecha_ingreso date,
  fecha_retiro date,
  activo boolean not null default true,
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint personal_forma_ck check (vinculacion = 'servicios' or forma_pago in ('mensual', 'jornal')),
  constraint personal_fechas_ck check (fecha_retiro is null or fecha_ingreso is null or fecha_retiro >= fecha_ingreso)
);
create unique index personal_nombre_uk on public.personal (finca_id, lower(btrim(nombre)));
create trigger personal_updated_at before update on public.personal for each row execute function private.set_updated_at();
select private.crear_politicas_finca('personal', 'contabilidad');
revoke all on public.personal from anon;
grant select, insert, update, delete on public.personal to authenticated;

create table public.pagos_personal (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  personal_id uuid not null,
  -- Fecha del pago (o de cuando se causa, si todavía está por pagar).
  fecha date not null,
  periodo_desde date,
  periodo_hasta date,
  -- Meses, días de jornal o servicios, según la forma de pago de la persona.
  cantidad numeric(8, 2) not null check (cantidad > 0 and cantidad <= 9999),
  -- Lo que se aplicó en este pago (copia del contrato al registrarlo: si después sube el salario, los pagos viejos no cambian).
  valor_base numeric(14, 2) not null check (valor_base >= 0 and valor_base <= 100000000000),
  -- Multiplicador de cargas de ley. Lo fija el disparador al registrar el pago; el navegador no lo elige.
  factor numeric(4, 2) not null default 1 check (factor between 1 and 3),
  valor_pago numeric(14, 2) generated always as (round(cantidad * valor_base, 2)) stored,
  costo_total numeric(14, 2) generated always as (round(cantidad * valor_base * factor, 2)) stored,
  pagado_en date,
  -- Soporte de pago de la seguridad social (ruta en el bucket «soportes», carpeta «nomina»).
  soporte_pila text check (soporte_pila is null or char_length(soporte_pila) <= 200),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pagos_personal_persona_fk foreign key (personal_id, finca_id) references public.personal (id, finca_id) on delete restrict,
  constraint pagos_personal_periodo_ck check (periodo_desde is null or periodo_hasta is null or periodo_hasta >= periodo_desde),
  constraint pagos_personal_pago_ck check (pagado_en is null or pagado_en >= fecha)
);
create index pagos_personal_finca_fecha_idx on public.pagos_personal (finca_id, fecha desc, created_at desc);
create index pagos_personal_persona_idx on public.pagos_personal (personal_id, fecha desc);
create index pagos_personal_por_pagar_idx on public.pagos_personal (finca_id) where pagado_en is null;
create unique index pagos_personal_client_req_uk on public.pagos_personal (finca_id, client_request_id) where client_request_id is not null;
create trigger pagos_personal_updated_at before update on public.pagos_personal for each row execute function private.set_updated_at();
select private.crear_politicas_finca('pagos_personal', 'contabilidad');
revoke all on public.pagos_personal from anon;
grant select, insert, update, delete on public.pagos_personal to authenticated;

-- Al registrar un pago (o cambiar de persona): fija el factor según la vinculación y exige el PILA a quien está por prestación de servicios.
create function private.pagos_personal_validar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_vinc text;
  v_factor numeric;
begin
  select vinculacion into v_vinc from public.personal where id = new.personal_id and finca_id = new.finca_id;
  if v_vinc is null then
    raise exception 'No encontramos a esa persona.' using errcode = 'foreign_key_violation';
  end if;
  if tg_op = 'INSERT' or new.personal_id is distinct from old.personal_id then
    if v_vinc = 'laboral' then
      select factor_prestacional into v_factor from public.finca_ajustes where finca_id = new.finca_id;
      new.factor := coalesce(v_factor, 1);
    else
      new.factor := 1;
    end if;
  else
    new.factor := old.factor;
  end if;
  if v_vinc = 'servicios' and new.pagado_en is not null and new.soporte_pila is null then
    raise exception 'Para registrar el pago a alguien por prestación de servicios, adjunta el soporte de pago de su seguridad social (PILA).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.pagos_personal_validar() from public, anon, authenticated;
create trigger pagos_personal_validar before insert or update on public.pagos_personal for each row execute function private.pagos_personal_validar();

-- La vinculación de una persona con pagos no cambia (el factor de esos pagos quedaría incoherente): se crea otra persona o se corrige el pago.
create function private.personal_vinculacion_fija() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.vinculacion is distinct from old.vinculacion and exists (select 1 from public.pagos_personal p where p.personal_id = old.id and p.finca_id = old.finca_id) then
    raise exception 'Esta persona ya tiene pagos registrados: no se puede cambiar el tipo de vinculación.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.personal_vinculacion_fija() from public, anon, authenticated;
create trigger personal_vinculacion_fija before update on public.personal for each row execute function private.personal_vinculacion_fija();
