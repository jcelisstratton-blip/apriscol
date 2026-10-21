-- Limpieza: las funciones de plan por propietario fueron reemplazadas por las de plan por finca
-- (admin_asignar_plan_finca, admin_solicitudes_plan). Ningún código las llama.
drop function if exists public.admin_asignar_plan(text, text);
drop function if exists public.admin_listar_solicitudes_plan();
