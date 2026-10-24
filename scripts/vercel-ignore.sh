#!/bin/sh
# «Ignored Build Step» de Vercel: exit 0 = omitir el build, exit 1 = construir.
# Producción siempre se construye. En las demás ramas se omite solo si, desde el
# último build de esa rama, cambiaron únicamente docs/, supabase/ o archivos .md
# (nada de eso entra al build). Ante cualquier duda, construye.

[ "$VERCEL_ENV" = "production" ] && exit 1
[ -z "$VERCEL_GIT_PREVIOUS_SHA" ] && exit 1
git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null || exit 1

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':(exclude)docs' ':(exclude)supabase' ':(exclude,glob)**/*.md'
