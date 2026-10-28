import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinosMenu, menuFinca, menuPrincipal, visibilidadMenu } from "../lib/menu.ts";

const etiquetas = (grupos) => grupos.map((g) => [g.titulo ?? "(inicio)", g.entradas.map((e) => e.etiqueta)]);

test("menú: el propietario con plan Profesional ve todos los grupos, en este orden", () => {
  const v = visibilidadMenu("propietario", "profesional");
  assert.deepEqual(etiquetas(menuPrincipal(v)), [
    ["(inicio)", ["Hoy", "Hato"]],
    ["Producción y manejo", ["Semáforos", "Leche", "Reproducción", "Carne", "Sanidad", "Corrales"]],
    ["Dinero y análisis", ["Costos", "Reportes", "Proyecciones", "Productos y terceros"]],
    ["Genealogía", ["Endogamia", "Premios"]],
  ]);
  assert.deepEqual(menuFinca(v).map((e) => e.etiqueta), ["Datos de la finca", "Ajustes de la finca", "Equipo", "Referidos", "Cambiar el plan", "Exportar datos", "Agregar otra finca"]);
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
    ["(inicio)", ["Hoy", "Hato"]],
    ["Producción y manejo", ["Semáforos", "Leche"]],
    ["Dinero y análisis", ["Reportes"]], // el reporte de ordeño sí lo puede abrir
    ["Genealogía", ["Endogamia"]],
  ]);
  assert.deepEqual(menuFinca(v).map((e) => e.etiqueta), ["Ajustes de la finca", "Referidos"]);
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
