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
roles, hato y genealogía (endogamia de Wright por método tabular), sanidad, reproducción, leche y ferias
(palmarés de cada animal con la foto del premio).

- `coef_endogamia(animal)`, `simular_endogamia(macho, hembra)` y `completitud_pedigri(animal)` son RPC.
- Un animal en periodo de retiro **no puede** entrar al tanque ni salir para consumo: lo hace cumplir la base.

## Libro genealógico compartido

Los pedigríes cruzan fincas (el padre de un animal suele ser de otro criador), así que el registro oficial vive en una tabla
global `libro_genealogico` (hoy: ~6.600 animales ANCO) y las fincas **reclaman** los suyos:

1. `scripts/importar-libro/` carga el volcado (ver su README) — corre local con la llave de servicio.
2. La finca pide la reclamación con el documento del titular (`/libro/reclamar`); la base lo compara contra un HMAC, nunca en claro.
3. El administrador de plataforma aprueba (`/admin/reclamos`); recién ahí se crean los animales en el hato de la finca.
4. La endogamia usa el grafo del libro cuando el animal viene de él, aunque sus padres estén en otra finca.

## Despliegue

GitHub (`main`) → Vercel (Next.js, raíz del repo). Variables de entorno en Vercel: las dos primeras (la URL del sitio se toma de la propia petición; `NEXT_PUBLIC_SITE_URL` es solo respaldo).
En Supabase → Authentication → URL Configuration: *Site URL* = dominio de producción y *Redirect URLs* =
`http://localhost:3000/**` y `https://*-<equipo>.vercel.app/**`.

Ver `CLAUDE.md` para las convenciones del repo.
