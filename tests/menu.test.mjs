import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { destinosMenu, menuFinca, menuPrincipal, visibilidadMenu } from "../lib/menu.ts";

const etiquetas = (grupos) => grupos.map((g) => [g.titulo ?? "(inicio)", g.entradas.map((e) => e.etiqueta)]);

test("menú: el propietario con plan Profesional ve todos los grupos, en este orden", () => {
  const v = visibilidadMenu("propietario", "profesional");
  assert.deepEqual(etiquetas(menuPrincipal(v)), [
    ["(inicio)", ["Novedades", "Hoy", "Semáforos", "Hato", "Registrar sin señal"]],
    ["Producción y manejo", ["Leche", "Reproducción", "Carne", "Sanidad", "Corrales", "Inventario"]],
    ["Dinero y análisis", ["Costos", "Reportes", "Proyecciones", "Productos y terceros"]],
    ["Genealogía", ["Endogamia", "Premios"]],
  ]);
  assert.deepEqual(menuFinca(v).map((e) => e.etiqueta), ["Datos de la finca", "Ajustes de la finca", "Equipo", "Telegram", "Conexión con IA", "Tutoriales", "Referidos", "Cambiar el plan", "Exportar datos", "Instalar la app", "Agregar otra finca"]);
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
    ["(inicio)", ["Mis novedades", "Hoy", "Semáforos", "Hato", "Registrar sin señal"]], // anota el ordeño sin señal
    ["Producción y manejo", ["Leche", "Inventario"]], // el ordeñador ve el inventario de alimento, no el de medicamentos
    ["Dinero y análisis", ["Reportes"]], // el reporte de ordeño sí lo puede abrir
    ["Genealogía", ["Endogamia"]],
  ]);
  assert.deepEqual(menuFinca(v).map((e) => e.etiqueta), ["Ajustes de la finca", "Telegram", "Conexión con IA", "Tutoriales", "Referidos", "Instalar la app"]);
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

import { ATAJOS, atajosPara } from "../lib/atajos.ts";
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


const ruta = (href) => href.split("?")[0];
const ROLES = ["propietario", "administrador", "veterinario", "ordenador", "contador"];
const PLANES = ["cria", "hato", "profesional", "hacienda"];

test("«Al grano»: toda entrada del menú que ve una persona tiene su atajo (misma pantalla), en cada rol y plan", () => {
  const faltan = [];
  for (const rol of ROLES) {
    for (const plan of PLANES) {
      const v = visibilidadMenu(rol, plan);
      const entradas = [...menuPrincipal(v).flatMap((g) => g.entradas), ...menuFinca(v)];
      const rutas = new Set(atajosPara(rol, plan).map((a) => ruta(a.href)));
      for (const e of entradas) if (!rutas.has(ruta(e.href))) faltan.push(`${rol}/${plan}: ${e.etiqueta} (${e.href})`);
    }
  }
  assert.deepEqual([...new Set(faltan)], [], "una entrada del menú se agrega también en lib/atajos.ts (Al grano)");
});

/** Rutas de «crear» que no llevan atajo propio, y por qué: son de un solo animal o de un lote (se entra por su ficha) o solo redirigen a otra pantalla que sí lo tiene. */
const SIN_ATAJO = [
  ["/hato/[id]/calidad/nuevo", "de un animal: desde su ficha"],
  ["/hato/[id]/canal/nuevo", "de un animal: desde su ficha"],
  ["/hato/[id]/peso/nuevo", "de un animal: «Pesar animales» y su ficha"],
  ["/hato/[id]/reproduccion/diagnostico/nuevo", "de un animal: «Hembras del hato»"],
  ["/hato/[id]/reproduccion/parto/nuevo", "de un animal: «Hembras del hato»"],
  ["/hato/[id]/reproduccion/servicio/nuevo", "de un animal: «Hembras del hato»"],
  ["/carne/lotes/[id]/consumo/nuevo", "de un lote: desde «Lotes de ceba»"],
  ["/personal/nueva", "redirige a Equipo (que sí tiene atajo)"],
  ["/sanidad/nuevo", "redirige a «Vacuna o tratamiento» (que sí tiene atajo)"],
].map(([r]) => r);

function rutasDeCrear(dir, base = "") {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre);
    if (!statSync(p).isDirectory()) continue;
    const segmento = nombre.startsWith("(") ? "" : `/${nombre}`;
    if (nombre === "nuevo" || nombre === "nueva") salida.push(`${base}${segmento}`);
    salida.push(...rutasDeCrear(p, `${base}${segmento}`));
  }
  return salida;
}

test("«Al grano»: toda pantalla de «crear» tiene su atajo, salvo las de un solo animal o lote (se entra por su ficha) y las que redirigen", () => {
  const conAtajo = new Set(ATAJOS.map((a) => ruta(a.href)));
  const sinAtajo = rutasDeCrear("app/(app)").filter((r) => !conAtajo.has(r) && !SIN_ATAJO.includes(r));
  assert.deepEqual(sinAtajo, [], "una pantalla nueva con botón de «crear» se agrega en lib/atajos.ts (o se justifica en SIN_ATAJO)");
});

test("menú: «Registrar sin señal» lo ve quien anota algo sin señal, y no quien no registra nada", () => {
  const ve = (rol, plan = "profesional") => menuPrincipal(visibilidadMenu(rol, plan)).flatMap((g) => g.entradas).some((e) => e.href === "/campo");
  for (const rol of ["propietario", "administrador", "veterinario", "ordenador", "contador"]) assert.ok(ve(rol), rol);
  assert.equal(menuPrincipal(visibilidadMenu("propietario", "profesional"))[0].entradas.at(-1).etiqueta, "Registrar sin señal", "en el primer bloque, después de Hato");
});

