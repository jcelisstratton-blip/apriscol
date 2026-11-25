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

test("presentación: la esquila aparece en Producción y manejo aunque el menú dependa de la especie", () => {
  const prod = gruposDeFunciones().find((x) => x.id === "produccion");
  assert.ok(prod.tarjetas.some((t) => t.href === "/esquila"), "Esquila debe estar en la presentación");
});

test("presentación: la portada entra animada y los carruseles se deslizan solos, con pausa y respetando «Reducir movimiento»", async () => {
  const { readFileSync } = await import("node:fs");
  const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
  const css = leer("app/globals.css");
  assert.match(css, /\.anim-asentar \{ animation: asentar/, "la entrada es CSS puro: no depende de JavaScript");
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.anim-asentar \{ animation: aparecer/, "con «Reducir movimiento» solo aparece, sin desplazarse");
  assert.match(leer("components/presentacion/Presentacion.tsx"), /id="acceso" style=\{asentar\(\d+\)\.style\} className="anim-asentar/, "el formulario de acceso entra animado");
  assert.match(leer("components/FormAuth.tsx"), /className="form-acceso /);
  const mov = leer("lib/desplazamiento-continuo.ts");
  assert.match(mov, /prefers-reduced-motion: reduce/, "con «Reducir movimiento» la fila no se mueve sola");
  assert.match(mov, /e\.pointerType === "mouse"\) s\.encima = true/, "solo el mouse la detiene al pasar: en el celular un toque no la deja quieta para siempre");
  for (const archivo of ["components/presentacion/CarruselCubre.tsx", "components/FilaTarjetasDeLado.tsx"]) {
    const c = leer(archivo);
    assert.match(c, /useDesplazamientoContinuo\(/, `${archivo} se desliza solo`);
    assert.match(c, /<BotonPausaMovimiento /, `${archivo}: todo lo que se mueve solo se puede pausar`);
    assert.match(c, /aria-hidden[\s\S]*inert/, `${archivo}: la copia de las tarjetas no la leen los lectores de pantalla ni el teclado`);
  }
});
