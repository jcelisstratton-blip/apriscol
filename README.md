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
- Endogamia en la app: ficha del animal (F + nivel + pedigrí conocido), `/hato/endogamia` (animales de la finca de mayor a menor F
  y umbral de alerta editable) y `/hato/cruza` (simulador macho × hembra con los ancestros que comparten). F usa hasta 10
  generaciones en el hato y 12 en el libro; la completitud se mide sobre 4. Escala: baja < ½ umbral, a vigilar < umbral, alta < 2×, muy alta.
- Un animal en periodo de retiro **no puede** entrar al tanque ni salir para consumo: lo hace cumplir la base.

## Libro genealógico (de dónde salen los animales)

Los pedigríes cruzan fincas (el padre de un animal suele ser de otro criador), así que el registro de origen (hoy ~6.600 animales
ANCO) vive en una tabla global `libro_genealogico` que **ninguna finca puede consultar**: solo el superadmin. Cada propietario es
dueño y administrador de su finca y trae sus animales sin pedirle permiso a nadie:

1. `scripts/importar-libro/` carga el volcado (ver su README) — corre local con la llave de servicio.
2. El propietario escribe su documento en `/libro/traer`; la base lo compara contra un HMAC (nunca en claro) y crea los animales en
   su hato, con solo los datos que le sirven (sin prefijo ni datos internos de la asociación) y su pedigrí enlazado.
3. La endogamia usa el grafo completo del libro aunque el padre sea de otro criador; las funciones validan que el animal sea de tu finca.
4. El superadmin ve las importaciones en `/admin/importaciones` y puede revertir una (si alguien trajo animales ajenos).

## Despliegue

GitHub (`main`) → Vercel (Next.js, raíz del repo). Variables de entorno en Vercel: las dos primeras (la URL del sitio se toma de la propia petición; `NEXT_PUBLIC_SITE_URL` es solo respaldo).
En Supabase → Authentication → URL Configuration: *Site URL* = dominio de producción y *Redirect URLs* =
`http://localhost:3000/**` y `https://*-<equipo>.vercel.app/**`.

Ver `CLAUDE.md` para las convenciones del repo.
