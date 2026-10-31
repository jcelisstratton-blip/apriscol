import test from "node:test";
import assert from "node:assert/strict";
import { precioDeCada, singular, textoPorUnidad } from "../lib/unidades.ts";
import { UNIDADES_GASTO } from "../lib/costos.ts";
import { UNIDADES_DOSIS } from "../lib/sanidad.ts";

test("unidades: el singular de cada unidad de medida que la app ofrece (antes salía «animale», «dosi», «galone», «mese»)", () => {
  const esperado = {
    bultos: "bulto", kg: "kg", toneladas: "tonelada", pacas: "paca", litros: "litro", galones: "galón", dosis: "dosis", pajillas: "pajilla", aretes: "arete",
    jornales: "jornal", horas: "hora", visitas: "visita", viajes: "viaje", meses: "mes", animales: "animal", unidades: "unidad",
  };
  // Cada unidad de compra y de venta del catálogo tiene su singular comprobado: si alguien agrega una unidad nueva, esta prueba obliga a revisarla.
  assert.deepEqual(Object.keys(esperado).sort(), [...UNIDADES_GASTO].sort());
  for (const [plural, singularEsperado] of Object.entries(esperado)) assert.equal(singular(plural), singularEsperado, plural);
  // Las unidades de dosis ya vienen abreviadas o en singular y no se tocan.
  for (const u of UNIDADES_DOSIS) assert.equal(singular(u), u === "tableta" ? "tableta" : u, u);
  // Otras palabras que llegan como unidad de compra del alimento.
  assert.deepEqual(["sacos", "kilos", "cajas", "frascos", "arrobas", "libras", "tarros"].map(singular), ["saco", "kilo", "caja", "frasco", "arroba", "libra", "tarro"]);
  assert.equal(singular("  litros "), "litro");
});

test("unidades: los textos «Precio de cada…» y «Por…» usan el singular y tienen respaldo", () => {
  assert.equal(precioDeCada("litros"), "Precio de cada litro");
  assert.equal(precioDeCada("galones"), "Precio de cada galón");
  assert.equal(precioDeCada("animales"), "Precio de cada animal");
  assert.equal(precioDeCada("kg"), "Precio de cada kg");
  assert.equal(precioDeCada(""), "Precio de cada unidad");
  assert.equal(precioDeCada(null), "Precio de cada unidad");
  assert.equal(textoPorUnidad("meses"), "Por mes");
  assert.equal(textoPorUnidad("dosis"), "Por dosis");
  assert.equal(textoPorUnidad(null), undefined);
});

import { readdirSync, readFileSync } from "node:fs";
test("unidades: el catálogo con el que nace cada finca usa unidades que existen, y lo líquido se mide en litros", () => {
  // La lista vigente es la de la última migración que redefine la siembra de productos.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const ultima = readdirSync(dir).filter((f) => /create (or replace )?function private\.productos_sembrar/.test(readFileSync(new URL(f, dir), "utf8"))).sort().at(-1);
  const sql = readFileSync(new URL(ultima, dir), "utf8");
  const filas = [...sql.matchAll(/\('([a-z_]+)', '(compra|venta)', '([^']+)', ([^,]+), ([^,]+), '([a-zñ]+)', (true|false), (\d+)\)/g)].map((m) => ({ clave: m[1], tipo: m[2], nombre: m[3], unidad: m[6] }));
  assert.ok(filas.length >= 40, `se leyeron ${filas.length} productos`);
  for (const f of filas) assert.ok(UNIDADES_GASTO.includes(f.unidad), `${f.nombre}: «${f.unidad}» no es una unidad de la app`);
  const unidad = (clave) => filas.find((f) => f.clave === clave)?.unidad;
  // Lo líquido, en litros: la leche, el yogur y demás bebidas lácteas, el desinfectante. (La leche maternizada es polvo: va en kg.)
  assert.equal(unidad("leche_cruda"), "litros");
  assert.equal(unidad("yogur_lacteos"), "litros");
  assert.equal(unidad("desinfectante"), "litros");
  assert.equal(unidad("leche_maternizada"), "kg");
  for (const f of filas) if (/leche|yogur|kumis|bebida/i.test(f.nombre) && !/maternizada/i.test(f.nombre)) assert.equal(f.unidad, "litros", `${f.nombre} se mide en litros, no en ${f.unidad}`);
  // Lo sólido, en kg; los animales, por animal; los combustibles, en galones.
  for (const c of ["queso", "carne_canal", "carne_cortes", "lana", "derivados_solidos"]) assert.equal(unidad(c), "kg", c);
  assert.equal(unidad("animal_pie"), "animales");
  assert.equal(unidad("animal_sacrificado"), "animales");
  assert.equal(unidad("combustible"), "galones");
  // La clave del yogur no se repite ni se pierde el producto nuevo.
  assert.equal(filas.filter((f) => f.clave === "yogur_lacteos").length, 1);
  assert.ok(unidad("derivados_solidos"));
});
