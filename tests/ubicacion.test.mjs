import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PAIS_DEFECTO, codigosUbicacion } from "../lib/ubicacion.ts";
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

test("ubicación: codigosUbicacion devuelve país y códigos que calcula la base, y nunca revienta", async () => {
  const llamadas = [];
  const base = (respuesta) => ({ rpc: async (nombre, args) => (llamadas.push([nombre, args]), respuesta) });
  const sin = (pais) => ({ pais, nivel1_codigo: null, nivel2_codigo: null, departamento_dane: null, municipio_dane: null });

  const ok = await codigosUbicacion(base({ data: [{ nivel1_codigo: "05", nivel2_codigo: "05237" }], error: null }), "Antioquia", "Donmatías");
  assert.deepEqual(ok, { pais: "CO", nivel1_codigo: "05", nivel2_codigo: "05237", departamento_dane: "05", municipio_dane: "05237" });
  assert.deepEqual(llamadas[0], ["geo_codigos", { p_pais: "CO", p_nivel1: "Antioquia", p_nivel2: "Donmatías" }]);
  assert.equal(PAIS_DEFECTO, "CO");

  // Otro país: se consulta con su código y las columnas de Colombia NO se llenan.
  llamadas.length = 0;
  const ec = await codigosUbicacion(base({ data: [{ nivel1_codigo: "17", nivel2_codigo: "1701" }], error: null }), "Pichincha", "Quito", "EC");
  assert.deepEqual(ec, { pais: "EC", nivel1_codigo: "17", nivel2_codigo: "1701", departamento_dane: null, municipio_dane: null });
  assert.equal(llamadas[0][1].p_pais, "EC");

  // Sin departamento no se consulta nada.
  llamadas.length = 0;
  assert.deepEqual(await codigosUbicacion(base({ data: [], error: null }), "", "Donmatías"), sin("CO"));
  assert.deepEqual(await codigosUbicacion(base({ data: [], error: null }), null, null, "EC"), sin("EC"));
  assert.equal(llamadas.length, 0);

  // Solo departamento: el municipio queda sin código.
  const soloDepto = await codigosUbicacion(base({ data: [{ nivel1_codigo: "25", nivel2_codigo: null }], error: null }), "Cundinamarca", undefined);
  assert.deepEqual(soloDepto, { pais: "CO", nivel1_codigo: "25", nivel2_codigo: null, departamento_dane: "25", municipio_dane: null });
  assert.equal(llamadas[0][1].p_nivel2, "");

  // Una falla de la base no impide guardar: sin códigos y con una línea de aviso.
  const avisos = [];
  const original = console.warn;
  console.warn = (...a) => avisos.push(a.join(" "));
  try {
    assert.deepEqual(await codigosUbicacion(base({ data: null, error: { message: "boom" } }), "Antioquia", "Donmatías"), sin("CO"));
  } finally {
    console.warn = original;
  }
  assert.match(avisos[0], /geo_codigos.*boom/);
});

test("ubicación: todos los municipios que ofrece la app se resuelven a UN solo código del DIVIPOLA", () => {
  const catalogo = migracion("_divipola_departamentos_y_municipios.sql");
  const deptos = [...catalogo.matchAll(/^\s+\('(\d{2})', '([^']+)'\)[,;]$/gm)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  const municipios = [...catalogo.matchAll(/(?:^|')(\d{5})\|([^|\n]+)\|[MAI]/gm)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  assert.equal(deptos.length, 33);
  assert.equal(municipios.length, 1122);

  const geo = migracion("_catalogo_geografico_por_pais.sql");
  const filasAlias = [...geo.matchAll(/^\s+\('CO', '(\d{2,5})', '([a-z0-9]+)'\)/gm)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  // Equivalencias de municipio (5 dígitos) y de departamento (2 dígitos).
  const alias = filasAlias.filter((a) => a.codigo.length === 5).map((a) => ({ dep: a.codigo.slice(0, 2), nombre: a.nombre, codigo: a.codigo }));
  const aliasDepto = filasAlias.filter((a) => a.codigo.length === 2);
  assert.equal(alias.length, 25);
  assert.equal(aliasDepto.length, 3);
  for (const a of alias) assert.ok(municipios.some((m) => m.codigo === a.codigo), `la equivalencia ${a.nombre} apunta a un código que no existe`);
  for (const a of aliasDepto) assert.ok(deptos.some((d) => d.codigo === a.codigo), `la equivalencia de departamento ${a.nombre} apunta a un código que no existe`);

  const codigoDepto = (nombre) => {
    const k = nz(nombre);
    return deptos.find((d) => nz(d.nombre) === k || aliasDepto.some((a) => a.codigo === d.codigo && a.nombre === k))?.codigo;
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
  assert.equal((fincas.match(/codigosUbicacion\(supabase,/g) ?? []).length, 2, "crear y editar finca calculan los códigos");
  assert.match(fincas, /d\.municipio, finca\.pais\)/, "al editar se usa el país de la finca");
  assert.match(fincas, /\.insert\(\{ \.\.\.datos\.data, \.\.\.codigos,/);
  assert.match(fincas, /municipio: d\.municipio \?\? null, \.\.\.codigos/);

  const ferias = leer("app/(app)/ferias/actions.ts");
  assert.equal((ferias.match(/codigosUbicacion\(supabase,/g) ?? []).length, 2, "editar la feria y crearla desde un premio calculan los códigos");
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

test("ubicación: el catálogo por país queda listo para sumar otro (Ecuador conocido pero sin activar)", () => {
  const geo = migracion("_catalogo_geografico_por_pais.sql");
  assert.match(geo, /\('CO', 'Colombia', 'Departamento', 'Municipio', 'COP', 'America\/Bogota', [^)]*true\)/);
  assert.match(geo, /\('EC', 'Ecuador', 'Provincia', 'Cantón', 'USD', 'America\/Guayaquil', [^)]*false\)/, "Ecuador no se ofrece hasta tener sus divisiones");
  // La finca y la feria llevan país y llaves compuestas (país, código): los códigos de dos países pueden coincidir.
  for (const t of ["fincas", "ferias"]) {
    assert.match(geo, new RegExp(`alter table public\\.${t}\\s+add column pais text not null default 'CO' references public\\.geo_paises`));
    assert.match(geo, new RegExp(`${t}_nivel2_fkey foreign key \\(pais, nivel2_codigo\\) references public\\.geo_divisiones \\(pais, codigo\\)`));
  }
  // Retrocompatible: lo anterior no se toca ni se borra.
  assert.doesNotMatch(geo, /\bdrop\b|\bdelete\b/i);
  assert.match(geo, /create or replace function public\.divipola_codigos/);
});
