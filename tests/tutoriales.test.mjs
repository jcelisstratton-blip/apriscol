import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { GRUPOS_TUTORIAL, TUTORIALES, anteriorDisponible, buscarTutoriales, disponible, miniatura, siguienteDisponible, urlIncrustada, urlYoutube, vistosDesde } from "../lib/tutoriales.ts";
import { sinTildes } from "../lib/texto.ts";

test("tutoriales: están todos (del 0 al 26), con su grupo, su duración y su miniatura", () => {
  assert.deepEqual(TUTORIALES.map((t) => t.numero), Array.from({ length: 27 }, (_, i) => i));
  const grupos = new Set(GRUPOS_TUTORIAL.map((g) => g.id));
  for (const t of TUTORIALES) {
    assert.ok(t.titulo.trim().length > 3 && t.resumen.trim().length > 10, `tutorial ${t.numero}: título o resumen vacío`);
    assert.match(t.duracion, /^\d{1,2}:\d{2}$/, `tutorial ${t.numero}: duración «m:ss»`);
    assert.ok(grupos.has(t.grupo), `tutorial ${t.numero}: grupo inexistente`);
    assert.ok(existsSync(new URL(`../public${miniatura(t)}`, import.meta.url)), `tutorial ${t.numero}: falta su miniatura`);
  }
  for (const g of GRUPOS_TUTORIAL) assert.ok(TUTORIALES.some((t) => t.grupo === g.id), `el grupo «${g.titulo}» no tiene tutoriales`);
  // Dentro de cada grupo van en el orden en que se recomienda verlos.
  for (const g of GRUPOS_TUTORIAL) {
    const nums = TUTORIALES.filter((t) => t.grupo === g.id).map((t) => t.numero);
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  }
  assert.equal(miniatura(TUTORIALES[5]), "/tutoriales/05.webp");
});

test("tutoriales: los enlaces de YouTube son válidos y no se repiten; sin enlace queda «próximamente»", () => {
  const ids = TUTORIALES.filter((t) => t.youtube !== null).map((t) => t.youtube);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{11}$/);
  assert.equal(new Set(ids).size, ids.length, "un mismo video en dos tutoriales");
  const sin = TUTORIALES.find((t) => t.youtube === null);
  assert.equal(disponible(sin), false);
  assert.equal(urlIncrustada(sin), null);
  assert.equal(urlYoutube(sin), null);
  const con = TUTORIALES[0];
  assert.equal(disponible(con), true);
  assert.match(urlIncrustada(con), /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?/);
  assert.equal(urlYoutube(con), `https://youtu.be/${con.youtube}`);
  // Un identificador mal escrito no se incrusta nunca.
  assert.equal(disponible({ ...con, youtube: "corto" }), false);
  assert.equal(urlIncrustada({ ...con, youtube: "abc\"><script>" }), null);
});

test("tutoriales: siguiente y anterior saltan los que todavía no se pueden ver", () => {
  const vistos = TUTORIALES.filter(disponible).map((t) => t.numero);
  assert.equal(anteriorDisponible(vistos[0]), null);
  assert.equal(siguienteDisponible(vistos[0]).numero, vistos[1]);
  assert.equal(anteriorDisponible(vistos[1]).numero, vistos[0]);
  assert.equal(siguienteDisponible(vistos.at(-1)), null);
});

test("tutoriales: la búsqueda no distingue tildes ni mayúsculas, y vacía devuelve todo", () => {
  assert.equal(buscarTutoriales("", sinTildes).length, 27);
  assert.equal(buscarTutoriales("   ", sinTildes).length, 27);
  assert.ok(buscarTutoriales("ORDENO", sinTildes).some((t) => t.titulo === "Ordeño y leche"));
  assert.ok(buscarTutoriales("excel", sinTildes).length >= 2);
  assert.equal(buscarTutoriales("xyzzy", sinTildes).length, 0);
});

test("tutoriales: lo «visto» que guarda el navegador se lee aunque venga dañado o manipulado", () => {
  assert.deepEqual(vistosDesde("[0,1,4]"), [0, 1, 4]);
  assert.deepEqual(vistosDesde("[4,1,1,0]"), [0, 1, 4]);
  assert.deepEqual(vistosDesde("[0,99,-1,2.5,\"x\",null]"), [0]);
  for (const malo of ["", "no es json", "{}", "\"texto\"", "null", "[[1]]"]) assert.deepEqual(vistosDesde(malo), []);
});

test("tutoriales: la pantalla está en el menú de «Mi finca» y la política de seguridad deja incrustar solo YouTube en privacidad reforzada", () => {
  const menu = readFileSync(new URL("../lib/menu.ts", import.meta.url), "utf8");
  assert.match(menu, /href: "\/mas\/tutoriales", etiqueta: "Tutoriales"/);
  const seguridad = readFileSync(new URL("../lib/cabeceras-seguridad.ts", import.meta.url), "utf8");
  assert.match(seguridad, /"frame-src https:\/\/www\.youtube-nocookie\.com"/);
  assert.doesNotMatch(seguridad, /frame-src[^"]*youtube\.com[^-]/);
});
