import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { esCookieDeSesion, RUTA_SALIR } from "../lib/supabase/sesion.ts";

test("sesión: se reconocen las cookies de Supabase, con sus trozos, y no otras", () => {
  for (const n of ["sb-iswkorshpobqhtpekgwl-auth-token", "sb-iswkorshpobqhtpekgwl-auth-token.0", "sb-iswkorshpobqhtpekgwl-auth-token.1", "sb-iswkorshpobqhtpekgwl-auth-token-code-verifier"]) assert.ok(esCookieDeSesion(n), n);
  for (const n of ["finca_activa", "theme", "_ga", "xsb-token"]) assert.ok(!esCookieDeSesion(n), n);
});

test("sesión: sin usuario la pantalla pasa por la ruta que borra las cookies y esa ruta es pública para el filtro de entrada", () => {
  assert.equal(RUTA_SALIR, "/auth/salir");
  const contexto = readFileSync(new URL("../lib/contexto.ts", import.meta.url), "utf8");
  assert.match(contexto, /redirect\(RUTA_SALIR\)/);
  assert.ok(!/redirect\("\/login"\)/.test(contexto), "contexto.ts no debe mandar a /login a quien tiene una cookie que no sirve");
  const proxy = readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
  const publicas = proxy.match(/const PUBLICAS = \[([^\]]*)\]/)?.[1] ?? "";
  assert.ok(publicas.includes('"/auth"'), "/auth tiene que ser pública, o /auth/salir se mandaría a /login en bucle");
});

test("sesión: las redirecciones del filtro de entrada llevan las cookies que Supabase escribió", () => {
  const proxy = readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /respuesta\.cookies\.getAll\(\)\.forEach/);
  assert.ok(!/return NextResponse\.redirect\(url\)/.test(proxy), "toda redirección pasa por redirigir()");
});
