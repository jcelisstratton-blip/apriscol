import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ANUNCIO_TUTORIALES_HASTA, DIAS_AVISO_FINCA_NUEVA, GRUPOS_TUTORIAL, TUTORIALES, anteriorDisponible, avisoTutorialesVisible, buscarTutoriales, disponible, miniatura, numeroDeEnlace, proximoSinVer, rutaTutorial, siguienteDisponible, urlIncrustada, urlLista, urlYoutube, vistosDesde, LISTA_YOUTUBE } from "../lib/tutoriales.ts";
import * as ayudas from "../lib/ayuda.ts";
import { sinTildes } from "../lib/texto.ts";

test("tutoriales: están todos (del 0 al 30), con su grupo, su duración y su miniatura", () => {
  assert.deepEqual(TUTORIALES.map((t) => t.numero), Array.from({ length: 31 }, (_, i) => i));
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
  assert.ok(TUTORIALES.every((t) => t.youtube !== null), "los tutoriales del 0 al 30 ya tienen su video");
  const ids = TUTORIALES.filter((t) => t.youtube !== null).map((t) => t.youtube);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{11}$/);
  assert.equal(new Set(ids).size, ids.length, "un mismo video en dos tutoriales");
  // Hoy todos tienen su video: «sin enlace» se simula para comprobar que un tutorial nuevo queda apagado.
  const sin = { ...TUTORIALES[0], youtube: null };
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
  assert.equal(buscarTutoriales("", sinTildes).length, 31);
  assert.equal(buscarTutoriales("   ", sinTildes).length, 31);
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

test("tutoriales: el enlace «?ver=N» solo abre un tutorial que existe", () => {
  assert.equal(rutaTutorial(5), "/mas/tutoriales?ver=5");
  assert.equal(numeroDeEnlace("5"), 5);
  assert.equal(numeroDeEnlace("0"), 0);
  assert.equal(numeroDeEnlace("26"), 26);
  assert.equal(numeroDeEnlace("27"), 27);
  assert.equal(numeroDeEnlace("28"), 28);
  assert.equal(numeroDeEnlace("29"), 29);
  assert.equal(numeroDeEnlace("30"), 30);
  assert.equal(numeroDeEnlace(["3", "4"]), 3);
  for (const malo of [undefined, "", "31", "99", "-1", "5.5", "abc", "5;6", "<script>", "1e1", "000"]) assert.equal(numeroDeEnlace(malo), null, `«${malo}»`);
});

test("tutoriales: Hoy los ofrece a las fincas nuevas y, por ser algo nuevo, a todas hasta el día del anuncio", () => {
  assert.equal(avisoTutorialesVisible(0, "2027-06-01"), true);
  assert.equal(avisoTutorialesVisible(DIAS_AVISO_FINCA_NUEVA, "2027-06-01"), true);
  assert.equal(avisoTutorialesVisible(DIAS_AVISO_FINCA_NUEVA + 1, "2027-06-01"), false);
  assert.equal(avisoTutorialesVisible(400, ANUNCIO_TUTORIALES_HASTA), true);
  assert.equal(avisoTutorialesVisible(400, "2026-12-21"), false);
});

test("tutoriales: el siguiente por ver es el primero disponible que la persona no ha visto", () => {
  const disponibles = TUTORIALES.filter(disponible).map((t) => t.numero);
  assert.equal(proximoSinVer(new Set()).numero, disponibles[0]);
  assert.equal(proximoSinVer(new Set([disponibles[0], disponibles[1]])).numero, disponibles[2]);
  assert.equal(proximoSinVer(new Set(disponibles)), null);
  // Lo que no se puede ver todavía nunca es «el siguiente».
  assert.equal(proximoSinVer(new Set(disponibles.slice(1))).numero, disponibles[0]);
});

test("ayudas «¿Cómo funciona?»: cada módulo apunta a un tutorial que existe, y al publicarse el video la ayuda lo ofrece sola", () => {
  const todas = Object.entries(ayudas).filter(([nombre]) => nombre.startsWith("AYUDA_")).map(([nombre, a]) => [nombre, a]);
  todas.push(["ayudaSanidad", ayudas.ayudaSanidad({ podologia_inspeccion_dias: 90, pediluvio_dias: 14, pediluvio_dias_lluvia: 7 })]);
  todas.push(["ayudaEsquila", ayudas.ayudaEsquila({ esquila_cada_meses: 12, esquila_aviso_dias: 30 })]);
  todas.push(["ayudaEsquilaOveja", ayudas.ayudaEsquilaOveja({ esquila_cada_meses: 12, esquila_aviso_dias: 30 })]);
  assert.ok(todas.length >= 13);
  for (const [nombre, a] of todas) {
    assert.ok(Number.isInteger(a.tutorial), `${nombre} no apunta a un tutorial`);
    assert.ok(TUTORIALES.some((t) => t.numero === a.tutorial), `${nombre}: el tutorial ${a.tutorial} no existe`);
  }
  assert.equal(ayudas.AYUDA_ORDENO.tutorial, 5);
  assert.equal(ayudas.AYUDA_CEBA.tutorial, 14);
  assert.equal(ayudas.AYUDA_CORRALES.tutorial, 13);
  assert.equal(ayudas.ayudaEsquila({ esquila_cada_meses: 12, esquila_aviso_dias: 30 }).tutorial, 30);
  // Los plazos de la ayuda salen de los Ajustes de la finca.
  assert.match(JSON.stringify(ayudas.ayudaEsquila({ esquila_cada_meses: 18, esquila_aviso_dias: 45 })), /cada 18 meses.*45 días antes/);
});

test("tutoriales: la lista de reproducción del canal tiene un enlace válido y uno dañado no se usa", () => {
  assert.equal(urlLista(), `https://www.youtube.com/playlist?list=${LISTA_YOUTUBE}`);
  assert.match(urlLista(), /^https:\/\/www\.youtube\.com\/playlist\?list=PL[A-Za-z0-9_-]+$/);
  assert.equal(urlLista("abc\"><script>"), null);
  assert.equal(urlLista(""), null);
});

test("ayudas «¿Cómo funciona?»: el enlace de abajo nunca lleva a la misma pantalla donde se abre", () => {
  // Pantalla donde vive cada ayuda: un enlace a sí misma no hace nada y parece «roto».
  const donde = { ayudaEsquila: "/esquila", ayudaEsquilaOveja: "/hato/[id]", AYUDA_IA: "/mas/ia", AYUDA_IMPORTAR: "/hato/importar", AYUDA_COSTOS: "/costos", AYUDA_PROYECCIONES: "/proyecciones", AYUDA_PERSONAL: "/mas/miembros", AYUDA_INVENTARIO: "/inventario", AYUDA_ALIMENTO: "/inventario" };
  const plazos = { esquila_cada_meses: 12, esquila_aviso_dias: 30 };
  for (const [nombre, ruta] of Object.entries(donde)) {
    const a = typeof ayudas[nombre] === "function" ? ayudas[nombre](plazos) : ayudas[nombre];
    assert.notEqual(a.enlace.href.split("?")[0], ruta, `${nombre}: su enlace lleva a la misma pantalla`);
  }
  assert.equal(ayudas.ayudaEsquilaOveja(plazos).enlace.href, "/esquila");
  assert.equal(ayudas.ayudaEsquilaOveja(plazos).tutorial, 30);
});
