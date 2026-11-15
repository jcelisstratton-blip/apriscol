import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { codigosDane } from "../lib/ubicacion.ts";
import { DEPARTAMENTOS } from "../lib/colombia.ts";
import { MUNICIPIOS } from "../lib/municipios.ts";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
const migracion = (sufijo) => {
  const f = readdirSync(new URL("../supabase/migrations", import.meta.url)).find((n) => n.endsWith(sufijo));
  assert.ok(f, `falta la migración *${sufijo}`);
  return leer(`supabase/migrations/${f}`);
};

// Misma normalización que `divipola_codigos`: sin tildes, sin mayúsculas y sin signos.
const nz = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

test("ubicación: codigosDane devuelve los códigos que calcula la base y nunca revienta", async () => {
  const llamadas = [];
  const base = (respuesta) => ({ rpc: async (nombre, args) => (llamadas.push([nombre, args]), respuesta) });

  const ok = await codigosDane(base({ data: [{ departamento_dane: "05", municipio_dane: "05237" }], error: null }), "Antioquia", "Donmatías");
  assert.deepEqual(ok, { departamento_dane: "05", municipio_dane: "05237" });
  assert.deepEqual(llamadas[0], ["divipola_codigos", { p_departamento: "Antioquia", p_municipio: "Donmatías" }]);

  // Sin departamento no se consulta nada.
  llamadas.length = 0;
  assert.deepEqual(await codigosDane(base({ data: [], error: null }), "", "Donmatías"), { departamento_dane: null, municipio_dane: null });
  assert.deepEqual(await codigosDane(base({ data: [], error: null }), null, null), { departamento_dane: null, municipio_dane: null });
  assert.equal(llamadas.length, 0);

  // Solo departamento: el municipio queda sin código.
  assert.deepEqual(await codigosDane(base({ data: [{ departamento_dane: "25", municipio_dane: null }], error: null }), "Cundinamarca", undefined), { departamento_dane: "25", municipio_dane: null });
  assert.equal(llamadas[0][1].p_municipio, "");

  // Una falla de la base no impide guardar: sin códigos y con una línea de aviso.
  const avisos = [];
  const original = console.warn;
  console.warn = (...a) => avisos.push(a.join(" "));
  try {
    assert.deepEqual(await codigosDane(base({ data: null, error: { message: "boom" } }), "Antioquia", "Donmatías"), { departamento_dane: null, municipio_dane: null });
  } finally {
    console.warn = original;
  }
  assert.match(avisos[0], /divipola_codigos.*boom/);
});

test("ubicación: todos los municipios que ofrece la app se resuelven a UN solo código del DIVIPOLA", () => {
  const catalogo = migracion("_divipola_departamentos_y_municipios.sql");
  const deptos = [...catalogo.matchAll(/^\s+\('(\d{2})', '([^']+)'\)[,;]$/gm)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  const municipios = [...catalogo.matchAll(/(?:^|')(\d{5})\|([^|\n]+)\|[MAI]/gm)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  assert.equal(deptos.length, 33);
  assert.equal(municipios.length, 1122);

  const sql = migracion("_ubicacion_con_codigo_dane.sql");
  const alias = [...sql.matchAll(/^\s+\('(\d{2})', '([a-z0-9]+)', '(\d{5})'\)/gm)].map((m) => ({ dep: m[1], nombre: m[2], codigo: m[3] }));
  assert.equal(alias.length, 25);
  for (const a of alias) assert.ok(municipios.some((m) => m.codigo === a.codigo && a.codigo.startsWith(a.dep)), `la equivalencia ${a.nombre} apunta a un código que no existe o es de otro departamento`);

  const codigoDepto = (nombre) => {
    const k = nz(nombre);
    return deptos.find((d) => nz(d.nombre) === k || (d.codigo === "11" && k.startsWith("bogota")) || (d.codigo === "88" && k.startsWith("sanandres")))?.codigo;
  };

  assert.equal(DEPARTAMENTOS.length, 33);
  let total = 0;
  for (const dep of DEPARTAMENTOS) {
    const cd = codigoDepto(dep);
    assert.ok(cd, `el departamento «${dep}» no tiene código`);
    for (const nombre of MUNICIPIOS[dep]) {
      total++;
      const k = nz(nombre);
      const candidatos = new Set([
        ...municipios.filter((m) => m.codigo.startsWith(cd) && nz(m.nombre) === k).map((m) => m.codigo),
        ...alias.filter((a) => a.dep === cd && a.nombre === k).map((a) => a.codigo),
      ]);
      assert.equal(candidatos.size, 1, `«${nombre}» (${dep}) debe resolver a un solo código y resolvió a ${[...candidatos].join(", ") || "ninguno"}`);
    }
  }
  assert.equal(total, 1121);
});

test("ubicación: fincas y ferias guardan los códigos, y la feria exige departamento y municipio", () => {
  const fincas = leer("app/onboarding/actions.ts");
  assert.equal((fincas.match(/codigosDane\(supabase,/g) ?? []).length, 2, "crear y editar finca calculan los códigos");
  assert.match(fincas, /\.insert\(\{ \.\.\.datos\.data, \.\.\.codigos,/);
  assert.match(fincas, /municipio: d\.municipio \?\? null, \.\.\.codigos/);

  const ferias = leer("app/(app)/ferias/actions.ts");
  assert.equal((ferias.match(/codigosDane\(supabase,/g) ?? []).length, 2, "editar la feria y crearla desde un premio calculan los códigos");
  assert.match(ferias, /Elige el departamento de la feria\./);
  assert.match(ferias, /Elige el municipio de la feria\./);
  assert.doesNotMatch(ferias, /departamento: opcional/, "el departamento de la feria ya no es opcional");
  assert.doesNotMatch(ferias, /municipio: opcional/, "el municipio de la feria ya no es opcional");

  // El formulario de la feria no ofrece «Sin especificar»; el de la finca sí.
  assert.match(leer("components/CamposFeria.tsx"), /<CamposUbicacion [^>]*requerido \/>/);
  assert.doesNotMatch(leer("components/FormFinca.tsx"), /requerido/);
  const campos = leer("components/CamposUbicacion.tsx");
  assert.equal((campos.match(/permitirVacio=\{!requerido\}/g) ?? []).length, 2);
});
