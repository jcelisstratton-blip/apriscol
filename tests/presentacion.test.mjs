import test from "node:test";
import assert from "node:assert/strict";
import { destinosMenu, visibilidadMenu } from "../lib/menu.ts";
import { CONTENIDO, OMITIDAS, etiquetaDePlan, gruposDeFunciones } from "../lib/presentacion.ts";

test("presentación: cada opción del menú está descrita o explícitamente omitida", () => {
  const destinos = destinosMenu(visibilidadMenu("propietario", "hacienda")).filter((h) => h !== "/mas");
  const sinTexto = destinos.filter((h) => !(h in CONTENIDO) && !(h in OMITIDAS));
  assert.deepEqual(sinTexto, [], "agrega su descripción en lib/presentacion.ts");
});

test("presentación: los grupos siguen el orden del menú y no hay tarjetas repetidas", () => {
  const g = gruposDeFunciones();
  assert.deepEqual(g.map((x) => x.id), ["inicio", "produccion", "dinero", "genealogia", "finca"]);
  assert.deepEqual(g.find((x) => x.id === "dinero").tarjetas.map((t) => t.rotulo), ["Costos", "Reportes", "Proyecciones", "Productos y terceros"]);
  const hrefs = g.flatMap((x) => x.tarjetas.map((t) => t.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const t of g.flatMap((x) => x.tarjetas)) assert.ok(t.lema && t.puntos.length >= 2 && t.puntos.length <= 3, t.href);
});

test("presentación: la etiqueta de plan sale del plan real", () => {
  assert.equal(etiquetaDePlan(CONTENIDO["/leche"]), null);
  assert.match(etiquetaDePlan(CONTENIDO["/proyecciones"]), /^Desde /);
});
