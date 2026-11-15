# Al grano

El botón del rayo (⚡): en el celular, el centro de la barra de abajo (`BottomNav`); en el computador, el botón «Al grano» arriba del menú lateral (`NavLateral`). Abre `HojaAlGrano`: una hoja con buscador y filtros Todo / Registrar / Abrir que lleva **directo** a lo que haya que hacer o abrir, según el rol y el plan de la persona.

## La regla (`lib/atajos.ts`, exigida por `tests/menu.test.mjs`)

- **Toda entrada del menú que ve una persona tiene su atajo** (la misma pantalla), en cada rol y plan. El atajo sigue la regla de visibilidad del menú con `Atajo.menu` (→ `visibilidadMenu`), para que nunca se contradigan.
- **Toda pantalla de «crear» (`nuevo` / `nueva`) tiene su atajo**, salvo las de un solo animal o lote (se entra por su ficha) y las que solo redirigen: están listadas con su razón en la prueba (`SIN_ATAJO`).
- Una pantalla nueva con menú o con botón de «crear» se agrega en `ATAJOS`; si no, la prueba falla.
- No lleva «¿Cómo funciona?»: es un buscador de atajos, no una vista de trabajo con reglas; una hoja de ayuda sobre otra hoja se siente torpe.

## Aviso de primera vez (`components/AvisoAlGrano.tsx`, `lib/al-grano.ts`)

Una tarjeta en **Hoy** que dice dónde está el botón y para qué sirve («Toca el botón del rayo, en el centro de la barra de abajo» / «Toca “Al grano”, arriba en el menú de la izquierda», y escribe «ordeño», «vacuna», «compra»…).

- **Quién la ve:** durante el **primer mes de su cuenta** (`perfil.created_at`, `DIAS_AVISO_AL_GRANO = 30`): también quien entra por invitación a una finca antigua. Las personas con cuenta más vieja no la ven.
- **Cuándo desaparece:** al abrir «Al grano» una vez (desde cualquier botón) o al tocar «Entendido». Se recuerda en este navegador (`apriscol:al-grano-visto`); sin almacenamiento, vuelve en la próxima visita.
- **«Probarlo ahora»** abre la hoja de verdad: `abrirAlGrano()` manda un evento que dice si se ve el computador (≥ 1024 px) o el celular, y `useHojaAlGrano` hace que la abra **solo** el menú que corresponde (los dos están en la página y uno se oculta con CSS).
- Tarjeta suave (no un cuadro de color): es una sugerencia, no un problema.
