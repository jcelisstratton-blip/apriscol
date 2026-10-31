import test from "node:test";
import assert from "node:assert/strict";
import { armarCola, indiceActual, rutaDe } from "../lib/cola-semaforo.ts";

const casos = [
  { etiqueta: "Cabrito 327", href: "/hato/a1" },
  { etiqueta: "Pacho", href: "/hato/a2#pesos" },
  { etiqueta: "Lola", href: "/hato/a3?x=1" },
];
const senal = { id: "ceba-gdp", titulo: "Ganancia de peso baja", area: "ceba" };

test("cola del semáforo: solo se arma con dos o más casos y arranca en el tocado", () => {
  assert.equal(armarCola(senal, casos.slice(0, 1), 0), null);
  const c = armarCola(senal, casos, 1);
  assert.equal(c.indice, 1);
  assert.equal(c.casos.length, 3);
  assert.equal(armarCola(senal, Array.from({ length: 150 }, (_, i) => ({ etiqueta: String(i), href: `/hato/${i}` })), 140).indice, 99);
});

test("cola del semáforo: la ruta actual ubica el caso; una pantalla intermedia o rutas repetidas no lo mueven", () => {
  assert.equal(rutaDe("/hato/a2#pesos"), "/hato/a2");
  assert.equal(indiceActual({ casos }, "/hato/a3", 0), 2);
  assert.equal(indiceActual({ casos }, "/hato/a1/peso/nuevo", 1), 1, "el formulario de registrar no cambia el caso");
  const iguales = [{ etiqueta: "a", href: "/hato/sanidad/programar" }, { etiqueta: "b", href: "/hato/sanidad/programar" }];
  assert.equal(indiceActual({ casos: iguales }, "/hato/sanidad/programar", 1), 1);
});
