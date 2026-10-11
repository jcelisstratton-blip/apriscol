# Importador del libro genealógico (ANCO)

Carga el volcado MariaDB `anco_registro` al libro genealógico compartido (`libro_genealogico`).
Se ejecuta **en tu computador**, nunca en Vercel ni en el repo.

## Reglas

- El volcado contiene cédulas y NIT reales: **no se versiona** (`.gitignore` ya excluye `*.sql` fuera de migraciones).
- La llave `service_role` solo vive en tu terminal (variable de entorno); nunca en un archivo del repo.
- Los documentos no se guardan en claro: la base los convierte en HMAC-SHA256 con un secreto del Vault
  (`apriscol_pepper_documentos`) y solo conserva los últimos 4 dígitos.

## Uso

```bash
# 1. Simulación (no envía nada, imprime el informe de calidad)
node scripts/importar-libro/importar.mjs /ruta/anco_registro.sql

# 2. Envío real (idempotente: se puede repetir)
export SUPABASE_URL="https://iswkorshpobqhtpekgwl.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="…"      # Supabase → Settings → API (secret)
node scripts/importar-libro/importar.mjs /ruta/anco_registro.sql --enviar
```

Envía lotes de 200 a `importar_libro_lote` y al final llama `resolver_padres_libro` (enlaza padre/madre por chip).
Los registros con datos irrecuperables se rechazan y se listan en el informe.

## Después

1. Un administrador de plataforma (fila en `plataforma_admins`) aprueba las solicitudes en `/admin/reclamos`.
2. Cada finca solicita sus animales en `/libro/reclamar` con el documento del titular; al aprobarse se crean en su hato
   con el pedigrí enlazado.
