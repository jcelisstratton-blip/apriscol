# Apriscol

Gestión del aprisco (cabras y ovejas) desde el celular: hato, genealogía y endogamia, ordeño, sanidad con periodos de
retiro y reproducción. Multi-finca, con roles (propietario, administrador, ordeñador, veterinario, contador).

## Puesta en marcha

```bash
cp .env.example .env.local   # completar URL y publishable key del proyecto Supabase
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Llave pública (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app (enlaces de correo e invitaciones) |

## Base de datos

El esquema vive en `supabase/migrations/` y es la única fuente de verdad. Módulos de la fase 1: núcleo multi-finca y
roles, hato y genealogía (endogamia de Wright por método tabular), sanidad, reproducción y leche.

- `coef_endogamia(animal)`, `simular_endogamia(macho, hembra)` y `completitud_pedigri(animal)` son RPC.
- Un animal en periodo de retiro **no puede** entrar al tanque ni salir para consumo: lo hace cumplir la base.

## Despliegue

GitHub (`main`) → Vercel (Next.js, raíz del repo). Variables de entorno en Vercel: las tres de arriba.
En Supabase → Authentication → URL Configuration: *Site URL* = dominio de producción y *Redirect URLs* =
`http://localhost:3000/**` y `https://*-<equipo>.vercel.app/**`.

Ver `CLAUDE.md` para las convenciones del repo.
