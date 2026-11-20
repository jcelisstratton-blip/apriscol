-- Registrar sin señal (modo sin señal, paso 3): el diagnóstico de gestación lleva el identificador del envío, como servicios, ordeños y pesajes,
-- para que reenviar el mismo registro desde el celular nunca lo duplique. Solo agrega (retrocompatible).
alter table public.diagnosticos_gestacion add column if not exists client_request_id uuid;
create unique index if not exists diagnosticos_client_req_uk on public.diagnosticos_gestacion (finca_id, client_request_id) where client_request_id is not null;
comment on column public.diagnosticos_gestacion.client_request_id is 'Identificador del envío (registro sin señal): reenviar el mismo diagnóstico no lo duplica.';
