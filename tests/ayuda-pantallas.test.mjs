import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { destinosMenu, visibilidadMenu } from "../lib/menu.ts";
import { AYUDA_PANTALLA, SIN_AYUDA_PROPIA } from "../lib/ayuda-pantallas.ts";
import { TUTORIALES } from "../lib/tutoriales.ts";

const archivoDe = (ruta) => (ruta === "/" ? "app/(app)/page.tsx" : `app/(app)/${ruta.slice(1)}/page.tsx`);
const rutaBase = (href) => href.split("?")[0];
const ROLES = ["propietario", "administrador", "veterinario", "ordenador", "contador"];

test("ayuda: toda opción del menú explica cómo funciona (o dice por qué no)", () => {
  const rutas = new Set();
  for (const rol of ROLES) for (const h of destinosMenu(visibilidadMenu(rol, "hacienda", ["caprino", "ovino"]))) rutas.add(h);
  assert.ok(rutas.size > 15);
  for (const ruta of rutas) {
    if (ruta in SIN_AYUDA_PROPIA) {
      assert.ok(SIN_AYUDA_PROPIA[ruta].length > 20, `${ruta}: explica por qué no lleva ayuda`);
      continue;
    }
    const archivo = archivoDe(ruta);
    assert.ok(existsSync(archivo), `${ruta}: no encuentro su pantalla (${archivo})`);
    const codigo = readFileSync(archivo, "utf8");
    assert.match(codigo, /AyudaModulo/, `${ruta}: la pantalla no tiene su «¿Cómo funciona?»`);
    if (ruta in AYUDA_PANTALLA) assert.ok(codigo.includes(`AYUDA_PANTALLA["${ruta}"]`), `${ruta}: la pantalla no usa su ayuda de lib/ayuda-pantallas.ts`);
  }
});

test("ayuda: cada hoja es clara, corta, con su video y un enlace que funciona y no lleva a sí misma", () => {
  const sinJerga = /SUPABASE|NEXT_PUBLIC|service_role|\bRLS\b|\bcron\b|env\b|variable de entorno/i;
  for (const [ruta, a] of Object.entries(AYUDA_PANTALLA)) {
    assert.ok(existsSync(archivoDe(ruta)), `${ruta}: la pantalla no existe`);
    assert.ok(a.titulo.length > 2, ruta);
    assert.ok(TUTORIALES.some((t) => t.numero === a.tutorial), `${ruta}: el tutorial ${a.tutorial} no existe`);
    assert.ok(a.puntos.length >= 3 && a.puntos.length <= 5, `${ruta}: de 3 a 5 ideas (tiene ${a.puntos.length})`);
    for (const p of a.puntos) {
      assert.ok(p.titulo.length > 2 && p.titulo.length <= 40, `${ruta}: título de idea «${p.titulo}»`);
      assert.ok(p.texto.length >= 30 && p.texto.length <= 330, `${ruta}: «${p.titulo}» mide ${p.texto.length} caracteres`);
      assert.doesNotMatch(p.titulo + p.texto, sinJerga, `${ruta}: jerga técnica en «${p.titulo}»`);
    }
    assert.ok(a.enlace.href.startsWith("/") && a.enlace.texto.length > 5, `${ruta}: enlace incompleto`);
    assert.notEqual(rutaBase(a.enlace.href), ruta, `${ruta}: el enlace final lleva a la misma pantalla`);
    assert.ok(existsSync(archivoDe(rutaBase(a.enlace.href))), `${ruta}: el enlace ${a.enlace.href} no lleva a una pantalla que exista`);
  }
});
