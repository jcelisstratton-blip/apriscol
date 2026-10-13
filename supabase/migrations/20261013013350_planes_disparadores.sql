-- (2/3) Una finca nueva hereda el mejor plan de las que ya tiene su creador; la segunda finca exige Hacienda; el equipo con roles empieza en Hato.

-- Una finca nueva hereda el mejor plan de las que ya tiene su creador; la segunda finca exige Hacienda. El plan no se cambia a mano.
create function private.fincas_plan() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_mejor text;
begin
  if tg_op = 'INSERT' then
    select f.plan into v_mejor
    from public.fincas f
    join public.finca_miembros m on m.finca_id = f.id and m.user_id = new.created_by and m.rol = 'propietario'
    order by private.plan_rango(f.plan) desc
    limit 1;
    if v_mejor is not null and private.plan_rango(v_mejor) < 4 then
      raise exception 'Para manejar varias fincas necesitas el plan Hacienda.' using errcode = 'check_violation';
    end if;
    new.plan := coalesce(v_mejor, 'cria');
  elsif new.plan is distinct from old.plan and coalesce(current_setting('apriscol.asignando_plan', true), '') <> 'on' then
    raise exception 'El plan solo cambia al mejorarlo desde «Mejorar mi plan».' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger fincas_plan_ins before insert on public.fincas for each row execute function private.fincas_plan();
create trigger fincas_plan_upd before update of plan on public.fincas for each row execute function private.fincas_plan();

-- El equipo con roles empieza en el plan Hato.
create function private.invitaciones_plan() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.plan_rango(private.plan_de(new.finca_id)) < 2 then
    raise exception 'Tu plan no incluye equipo con roles. Mejora a Hato para invitar a más personas.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger invitaciones_plan before insert on public.invitaciones for each row execute function private.invitaciones_plan();
