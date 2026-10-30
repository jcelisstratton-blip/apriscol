import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { destinosMenu, menuFinca, menuPrincipal, visibilidadMenu } from "../lib/menu.ts";

const etiquetas = (grupos) => grupos.map((g) => [g.titulo ?? "(inicio)", g.entradas.map((e) => e.etiqueta)]);

test("menú: el propietario con plan Profesional ve todos los grupos, en este orden", () => {
  const v = visibilidadMenu("propietario", "profesional");
  assert.deepEqual(etiquetas(menuPrincipal(v)), [
    ["(inicio)", ["Novedades", "Hoy", "Hato"]],
    ["Producción y manejo", ["Semáforos", "Leche", "Reproducción", "Carne", "Sanidad", "Corrales", "Inventario"]],
    ["Dinero y análisis", ["Costos", "Reportes", "Proyecciones", "Productos y terceros"]],
    ["Genealogía", ["Endogamia", "Premios"]],
  ]);
  assert.deepEqual(menuFinca(v).map((e) => e.etiqueta), ["Datos de la finca", "Ajustes de la finca", "Equipo", "Telegram", "Referidos", "Cambiar el plan", "Exportar datos", "Agregar otra finca"]);
});

test("menú: en el plan más alto la entrada del plan dice «Plan de esta finca»", () => {
  assert.ok(menuFinca(visibilidadMenu("propietario", "hacienda")).some((e) => e.etiqueta === "Plan de esta finca"));
});

test("menú: Leche y Productos y terceros están en el menú del que salen el computador y el celular", () => {
  const v = visibilidadMenu("propietario", "profesional");
  const todas = menuPrincipal(v).flatMap((g) => g.entradas.map((e) => e.href));
  assert.ok(todas.includes("/leche") && todas.includes("/mas/productos"));
});

test("menú: un ordeñador no ve lo que no puede abrir y los grupos vacíos desaparecen", () => {
  const v = visibilidadMenu("ordenador", "profesional");
  assert.deepEqual(etiquetas(menuPrincipal(v)), [
    ["(inicio)", ["Mis novedades", "Hoy", "Hato"]],
    ["Producción y manejo", ["Semáforos", "Leche", "Inventario"]], // el ordeñador ve el inventario de alimento, no el de medicamentos
    ["Dinero y análisis", ["Reportes"]], // el reporte de ordeño sí lo puede abrir
    ["Genealogía", ["Endogamia"]],
  ]);
  assert.deepEqual(menuFinca(v).map((e) => e.etiqueta), ["Ajustes de la finca", "Telegram", "Referidos"]);
  assert.ok(!menuFinca(visibilidadMenu("veterinario", "profesional")).some((e) => e.etiqueta === "Agregar otra finca"));
  assert.ok(!menuFinca(visibilidadMenu("contador", "profesional")).some((e) => e.etiqueta === "Agregar otra finca" || e.etiqueta === "Datos de la finca"));
  assert.ok(menuFinca(visibilidadMenu("administrador", "profesional")).some((e) => e.etiqueta === "Agregar otra finca"));
});

test("menú: un administrador no ve el plan ni exportar; un plan Cría no ve carne, costos ni proyecciones", () => {
  const admin = menuFinca(visibilidadMenu("administrador", "profesional")).map((e) => e.etiqueta);
  assert.ok(!admin.includes("Cambiar el plan") && !admin.includes("Exportar datos") && admin.includes("Equipo"));
  const cria = menuPrincipal(visibilidadMenu("propietario", "cria")).flatMap((g) => g.entradas.map((e) => e.etiqueta));
  for (const no of ["Carne", "Costos", "Proyecciones", "Productos y terceros", "Corrales"]) assert.ok(!cria.includes(no), no);
});

test("menú: ningún destino se repite y la lista de destinos incluye «Más»", () => {
  for (const [rol, plan] of [["propietario", "profesional"], ["administrador", "hato"], ["veterinario", "profesional"], ["contador", "profesional"], ["ordenador", "cria"]]) {
    const v = visibilidadMenu(rol, plan);
    const hrefs = [...menuPrincipal(v).flatMap((g) => g.entradas), ...menuFinca(v)].map((e) => e.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `${rol}/${plan}`);
    assert.ok(destinosMenu(v).includes("/mas"));
  }
});

test("menú: el computador y el celular lo dibujan desde lib/menu.ts y no tienen entradas escritas a mano", () => {
  for (const archivo of ["../components/NavLateral.tsx", "../app/(app)/mas/page.tsx"]) {
    const fuente = readFileSync(new URL(archivo, import.meta.url), "utf8");
    assert.match(fuente, /@\/lib\/menu/, archivo);
    for (const href of ['"/leche"', '"/costos"', '"/mas/productos"', '"/reportes"', '"/hato/endogamia"', '"/ferias"']) assert.ok(!fuente.includes(`href=${href}`) && !fuente.includes(`href: ${href}`), `${archivo} escribe ${href} a mano`);
  }
});

import { ESCENA_PESTANA } from "../lib/escenas.ts";
test("pestañas: toda pestaña de un módulo tiene su escena (si falta, la pantalla se rompe)", () => {
  const archivos = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/page\.tsx$/.test(nombre)) archivos.push(ruta);
    }
  };
  recorrer(new URL("../app", import.meta.url).pathname);
  let revisadas = 0;
  for (const f of archivos) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("armarPestanas(")) continue;
    const bloque = src.match(/const PESTANAS = \[([\s\S]*?)\] as const/);
    if (!bloque) continue;
    for (const m of bloque[1].matchAll(/valor: "([a-z_]+)"/g)) {
      revisadas++;
      assert.ok(ESCENA_PESTANA[m[1]], `${f}: la pestaña «${m[1]}» no tiene escena en ESCENA_PESTANA`);
    }
  }
  assert.ok(revisadas > 5);
});

test("novedades: es lo primero del menú; quien las revisa ve «Novedades», el ordeñador «Mis novedades» y el contador no la ve", () => {
  for (const [rol, esperado] of [["propietario", "Novedades"], ["administrador", "Novedades"], ["veterinario", "Novedades"], ["ordenador", "Mis novedades"]]) {
    const primero = menuPrincipal(visibilidadMenu(rol, "hato"))[0].entradas[0];
    assert.equal(primero.etiqueta, esperado, rol);
    assert.equal(primero.href, "/novedades");
  }
  assert.ok(!menuPrincipal(visibilidadMenu("contador", "hato"))[0].entradas.some((e) => e.href === "/novedades"));
});

import { atajosPara } from "../lib/atajos.ts";
test("novedades: «Crear una novedad» está en «Al grano» solo para el ordeñador y el veterinario; el administrador y el propietario las atienden, no las crean", () => {
  for (const rol of ["ordenador", "veterinario"]) {
    const a = atajosPara(rol, "hato").find((x) => x.href === "/novedades/nueva");
    assert.ok(a, rol);
    assert.equal(a.titulo, "Crear una novedad");
  }
  for (const rol of ["administrador", "propietario", "contador"]) assert.ok(!atajosPara(rol, "hato").some((x) => x.href === "/novedades/nueva"), rol);
  // Todos los que las atienden ven «Novedades» en «Al grano».
  for (const rol of ["administrador", "propietario", "veterinario"]) assert.ok(atajosPara(rol, "hato").some((x) => x.href === "/novedades"), rol);
});
