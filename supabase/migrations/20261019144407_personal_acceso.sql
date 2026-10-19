-- Equipo y nómina en un solo lugar: al invitar a alguien se registra también su contrato. La persona guarda con qué correo se invitó y qué rol de acceso tiene
-- (nulos = trabaja en la finca pero no usa la app). Aditiva: columnas opcionales.
alter table public.personal
  add column correo text check (correo is null or (correo = lower(btrim(correo)) and char_length(correo) <= 254)),
  add column rol public.rol_finca check (rol is null or rol <> 'propietario');
