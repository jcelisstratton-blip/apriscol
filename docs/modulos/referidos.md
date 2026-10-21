# Referidos

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Referidos

Cada persona tiene un código (`perfiles.codigo_referido`, 8 caracteres) y un enlace `/registro?ref=CODIGO` (**Más → Referidos**, `/mas/referidos`). El registro guarda el código en los datos del usuario (`ref`) y `private.handle_new_user` lo
convierte en `perfiles.referido_por`; un código que no existe no cuenta, y ni el código ni el referidor se pueden cambiar desde el navegador (disparador `perfiles_proteger_referidos`). **Términos: el 5 % del valor del plan
de la persona referida cada mes durante 6 meses**, contados desde que adquiere un plan: `lib/referidos.ts` es la fuente en la app (`PORCENTAJE_REFERIDO`, `MESES_REFERIDO`, `TEXTO_PROGRAMA`) y `admin_asignar_plan_finca` guarda 5 y 6 en cada
`comisiones_referido` al crearla (una por persona referida, con el plan de la primera activación). El referidor ve solo el primer nombre y el plan (`mis_referidos`); el superadmin ve las comisiones en `/admin/planes`
(`admin_listar_comisiones`). La comisión corre solo sobre el plan de la **primera finca** (la más antigua) de la persona referida. **Si cambian los términos, se cambia en los dos sitios, en `/terminos` y en la pantalla.** La comisión nace solo con la compra de un plan (`admin_asignar_plan_finca`); registrarse o compartir el enlace no paga nada (`TEXTO_SOLO_CON_PLAN`). Pagar la comisión es manual hasta que haya pasarela.
