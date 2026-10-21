// Reglas puras de la app que protegen datos de la finca (no dependen de la base).
import test from "node:test";
import assert from "node:assert/strict";
import { leerNumero } from "../lib/numeros.ts";
import { validarFilas } from "../lib/importar-animales.ts";

test("números a la colombiana", () => {
  assert.equal(leerNumero("3,6"), 3.6);
  assert.equal(leerNumero("2.500"), 2500);
  assert.equal(leerNumero("1.250.000"), 1250000);
  assert.equal(leerNumero("25.000"), 25000); // el error que corregimos: nunca 25
  assert.equal(leerNumero("3.6"), 3.6);
  assert.equal(leerNumero("$ 12.500,50"), 12500.5);
  assert.equal(leerNumero("abc"), null);
  assert.equal(leerNumero(""), null);
});

const ctx = {
  especies: ["caprino"],
  razas: [{ id: 1, especie: "caprino", nombre: "Alpina" }],
  existentes: [{ numero_arete: "A-1", sexo: "macho", especie: "caprino", fecha_nacimiento: "2022-01-01" }],
  hoy: "2026-10-21",
};
const fila = (n, valores) => ({ fila: n, valores });

test("cargue: rechaza arete repetido en el archivo y arete que ya existe en el hato", () => {
  const r = validarFilas([
    fila(2, { numero_arete: "B-1", sexo: "Hembra" }),
    fila(3, { numero_arete: "b-1", sexo: "Hembra" }),
    fila(4, { numero_arete: "A-1", sexo: "Macho" }),
  ], ctx);
  const msgs = r.errores.map((e) => `${e.fila}: ${e.mensajes.join(" ")}`).join("\n");
  assert.match(msgs, /se repite/, msgs);
  assert.match(msgs, /A-1/, msgs);
  assert.equal(r.filas.length, 0, "con errores no se guarda nada");
});

test("cargue: una cría no puede nacer antes que su padre ni tener un padre hembra", () => {
  const r = validarFilas([
    fila(2, { numero_arete: "C-1", sexo: "Hembra", fecha_nacimiento: "2021-01-01", padre_arete: "A-1" }),
    fila(3, { numero_arete: "C-2", sexo: "Hembra", padre_arete: "C-1" }),
  ], ctx);
  assert.ok(r.errores.length >= 1, "debe reportar errores");
  assert.equal(r.filas.length, 0);
});

test("cargue: un archivo correcto pasa", () => {
  const r = validarFilas([
    fila(2, { numero_arete: "D-1", sexo: "Hembra", raza: "Alpina", fecha_nacimiento: "2023-03-15", padre_arete: "A-1" }),
  ], ctx);
  assert.deepEqual(r.errores, []);
  assert.equal(r.filas.length, 1);
});

test("cargue: las filas de animales dados de baja se omiten", () => {
  const r = validarFilas([
    fila(2, { numero_arete: "E-1", sexo: "Hembra", estado: "vendido" }),
    fila(3, { numero_arete: "E-2", sexo: "Hembra", estado: "activo" }),
  ], ctx);
  assert.deepEqual(r.errores, []);
  assert.equal(r.filas.length, 1);
  assert.equal(r.resumen.omitidos, 1);
});

import { lineaDeError } from "../lib/registro-errores.ts";

test("registro de errores: solo lleva el patrón de la ruta, nunca la dirección real ni datos de la petición", () => {
  const err = Object.assign(new Error("duplicate key value violates unique constraint ".padEnd(400, "x")), { digest: "abc123" });
  const linea = lineaDeError(err, "POST", { routePath: "/invitacion/[token]", routeType: "action", renderSource: undefined });
  const o = JSON.parse(linea);
  assert.equal(o.marca, "[apriscol:error]");
  assert.equal(o.ruta, "/invitacion/[token]");
  assert.equal(o.tipo, "action");
  assert.equal(o.digest, "abc123");
  assert.equal(o.mensaje.length, 300, "el mensaje se recorta");
  assert.deepEqual(Object.keys(o).sort(), ["digest", "marca", "metodo", "mensaje", "nombre", "origen", "ruta", "tipo"].sort());
  // Un valor que no es Error tampoco rompe el registro.
  assert.equal(JSON.parse(lineaDeError("texto suelto", undefined, {})).mensaje, "texto suelto");
});

test("registro de errores: no escribe secretos", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.firmaabc";
  const m = JSON.parse(lineaDeError(new Error(`falló con ${jwt} y token=ABC123 y password: hunter2`), "GET", {})).mensaje;
  for (const secreto of [jwt, "ABC123", "hunter2"]) assert.ok(!m.includes(secreto), `se coló ${secreto}: ${m}`);
});
