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

import { mensajeAmigable } from "../lib/mensaje-amigable.ts";

test("mensajes: la contraseña filtrada de Supabase sale en español y sin jerga", () => {
  const m = mensajeAmigable("Password is known to be weak and easy to guess, please choose a different one.");
  assert.match(m, /contraseña/i);
  assert.doesNotMatch(m, /weak|guess/i);
  assert.equal(mensajeAmigable("Invalid login credentials"), "El correo o la contraseña no coinciden.");
});

import { cabecerasDeSeguridad, lineaDeViolacionCsp, origenDe, politicaDeContenido } from "../lib/cabeceras-seguridad.ts";

test("cabeceras de seguridad: siempre las simples; la política solo en producción y apuntando a Supabase", () => {
  const dev = cabecerasDeSeguridad("https://abc.supabase.co", false).map((c) => c.key);
  assert.deepEqual(dev, ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"]);
  const prod = cabecerasDeSeguridad("https://abc.supabase.co", true);
  const csp = prod.find((c) => /^Content-Security-Policy/.test(c.key));
  assert.ok(csp, "en producción hay política");
  assert.match(csp.value, /img-src 'self' data: blob: https:\/\/abc\.supabase\.co/);
  assert.match(csp.value, /connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/);
  assert.match(csp.value, /frame-ancestors 'none'/);
  assert.match(csp.value, /object-src 'none'/);
  assert.doesNotMatch(csp.value, /unsafe-eval/);
  assert.equal(origenDe("no es una dirección"), null);
  // Sin dirección de Supabase la política sigue siendo válida (solo lo propio).
  assert.doesNotMatch(politicaDeContenido(""), /undefined|null/);
});

test("reporte de la política: no deja rutas con tokens ni parámetros", () => {
  const linea = lineaDeViolacionCsp({
    "csp-report": {
      "document-uri": "https://apriscol.shop/invitacion/0123456789abcdef0123456789abcdef?x=secreto#f",
      "effective-directive": "img-src",
      "blocked-uri": "https://otro.com/foto.png?token=SECRETO",
      "disposition": "report",
    },
  });
  const o = JSON.parse(linea);
  assert.equal(o.marca, "[apriscol:csp]");
  assert.equal(o.directiva, "img-src");
  assert.equal(o.pagina, "https://apriscol.shop/invitacion/:id");
  assert.equal(o.bloqueado, "https://otro.com/foto.png");
  assert.ok(!linea.includes("SECRETO") && !linea.includes("secreto"));
  assert.equal(lineaDeViolacionCsp({ otra: 1 }), null);
  assert.equal(lineaDeViolacionCsp("texto"), null);
});

import { rutaLogoValida, urlLogo } from "../lib/logo-finca.ts";

test("logo de la finca: solo rutas de la propia finca, con nombre uuid y formato permitido", () => {
  const f = "e294e989-af7c-4cd8-9f5c-49cc3b53bffc";
  const otra = "21efbc38-ece0-4a5e-b2e5-52dd5e181b5a";
  const a = "11111111-1111-1111-1111-111111111111";
  assert.equal(rutaLogoValida(`${f}/${a}.png`, f), true);
  assert.equal(rutaLogoValida(`${f}/${a}.jpg`, f), true);
  assert.equal(rutaLogoValida(`${f}/${a}.webp`, f), true);
  assert.equal(rutaLogoValida(`${otra}/${a}.png`, f), false, "carpeta de otra finca");
  assert.equal(rutaLogoValida(`${f}/${a}.svg`, f), false, "nunca SVG");
  assert.equal(rutaLogoValida(`${f}/${a}.gif`, f), false);
  assert.equal(rutaLogoValida(`${f}/../${otra}/${a}.png`, f), false, "sin subir de carpeta");
  assert.equal(rutaLogoValida(`${f}/sub/${a}.png`, f), false, "sin subcarpetas");
  assert.equal(rutaLogoValida(`${a}.png`, f), false, "sin carpeta");
  assert.equal(rutaLogoValida(`${f}/${a}.png`, "no-es-uuid"), false);
  assert.equal(urlLogo({ id: f, logo_path: null }), null);
  assert.equal(urlLogo({ id: f, logo_path: `${f}/${a}.png` }), `/api/logo?f=${f}&v=${a}.png`);
});
