-- Dar de baja sin señal: la baja lleva el identificador del envío, como ventas, compras y diagnósticos, para que reenviarla desde el
-- celular (o un doble toque) nunca dé error ni se confunda con la baja que registró otra persona. Solo agrega (retrocompatible).
alter table public.bajas add column if not exists client_request_id uuid;
create unique index if not exists bajas_client_req_uk on public.bajas (finca_id, client_request_id) where client_request_id is not null;
comment on column public.bajas.client_request_id is 'Identificador del envío (registro sin señal): reenviar la misma baja no la duplica ni da error.';
