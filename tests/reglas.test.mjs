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

import { enObservacion, servicioEsActivo, ventanaRepetirDx } from "../lib/reproduccion.ts";

test("reproducción: un servicio está activo mientras no haya un parto o aborto desde su fecha", () => {
  assert.equal(servicioEsActivo("2026-03-01", null), true);
  assert.equal(servicioEsActivo("2026-03-01", "2026-02-10"), true);
  assert.equal(servicioEsActivo("2026-03-01", "2026-03-01"), false);
  assert.equal(servicioEsActivo("2026-03-01", "2026-08-01"), false);
});

test("reproducción: un diagnóstico dudoso deja a la hembra en observación y se repite a los 14-21 días", () => {
  const base = { estado: "servida", ultimo_servicio: "2026-03-01", diagnostico: "dudoso", fecha_diagnostico: "2026-04-10" };
  assert.equal(enObservacion(base), true);
  assert.equal(enObservacion({ ...base, diagnostico: "gestante" }), false);
  assert.equal(enObservacion({ ...base, estado: "gestante" }), false);
  assert.equal(enObservacion({ ...base, fecha_diagnostico: "2026-02-20" }), false, "un dudoso de un servicio anterior no cuenta");
  assert.deepEqual(ventanaRepetirDx("2026-04-10"), { desde: "2026-04-24", hasta: "2026-05-01" });
});

import { datosPorTipoParto } from "../lib/parto-reglas.ts";

test("parto: cada tipo pide y guarda solo lo suyo", () => {
  // Cesárea y parto asistido: quién asistió es obligatorio (el veterinario de la finca u otra persona).
  assert.match(datosPorTipoParto({ tipo: "cesarea" }).error, /cesárea/);
  assert.match(datosPorTipoParto({ tipo: "asistido" }).error, /asistió/);
  const ces = datosPorTipoParto({ tipo: "cesarea", asistido_por: "Dra. Ruiz", protocolo_posoperatorio: "Penicilina 3 días", causa_aborto: "infecciosa" });
  assert.equal(ces.datos.asistido_por, "Dra. Ruiz");
  assert.equal(ces.datos.protocolo_posoperatorio, "Penicilina 3 días");
  assert.equal(ces.datos.causa_aborto, null, "una cesárea no guarda causa de aborto");
  const asi = datosPorTipoParto({ tipo: "asistido", asistido_por: "Don Pedro", protocolo_posoperatorio: "no aplica" });
  assert.equal(asi.datos.asistido_por, "Don Pedro");
  assert.equal(asi.datos.protocolo_posoperatorio, null, "el protocolo posoperatorio es solo de la cesárea");
  // Aborto: la causa es obligatoria; quién asistió es opcional y no guarda datos de cirugía.
  assert.match(datosPorTipoParto({ tipo: "aborto" }).error, /causa/);
  const ab = datosPorTipoParto({ tipo: "aborto", causa_aborto: "nutricional", complicaciones: "Retención de placenta", protocolo_posoperatorio: "x" });
  assert.equal(ab.datos.causa_aborto, "nutricional");
  assert.equal(ab.datos.asistido_por, null);
  assert.equal(ab.datos.protocolo_posoperatorio, null);
  assert.equal(datosPorTipoParto({ tipo: "aborto", causa_aborto: "toxica", asistido_por: "Dra. Ruiz" }).datos.asistido_por, "Dra. Ruiz");
  // Parto normal: sin asistencia, solo complicaciones y observaciones.
  const nor = datosPorTipoParto({ tipo: "normal", observaciones: "Todo bien", asistido_por: "X", causa_aborto: "toxica" });
  assert.deepEqual(nor.datos, { complicaciones: null, observaciones: "Todo bien", causa_aborto: null, asistido_por: null, protocolo_posoperatorio: null });
});

import { cargoDelPerfil, perfilPorRol, resumenPerfil } from "../lib/perfil-personal.ts";

test("equipo: cada perfil pide y guarda solo lo suyo", () => {
  // Veterinario: tarjeta profesional y teléfono obligatorios al agregarlo.
  assert.match(perfilPorRol("veterinario", {}, true).error, /tarjeta profesional/);
  assert.match(perfilPorRol("veterinario", { tarjeta_profesional: "MV-1234" }, true).error, /teléfono/);
  const vet = perfilPorRol("veterinario", { tarjeta_profesional: "MV-1234", telefono: "300 123 4567", especialidades: "sanidad,reproduccion", experiencia_anios: "8", turno_ordeno: "manana" }, true);
  assert.equal(vet.datos.tarjeta_profesional, "MV-1234");
  assert.deepEqual(vet.datos.especialidades, ["reproduccion", "sanidad"]);
  assert.equal(vet.datos.experiencia_anios, 8);
  assert.equal(vet.datos.turno_ordeno, null, "un veterinario no guarda turno de ordeño");
  assert.match(perfilPorRol("veterinario", { tarjeta_profesional: "MV-1234", telefono: "300 123 4567", especialidades: "magia" }, true).error, /especialidad/);
  // Al corregir a alguien que ya existía no se exige nada, pero lo que escriba se valida.
  assert.ok(perfilPorRol("veterinario", {}, false).datos);
  assert.match(perfilPorRol("veterinario", { telefono: "abc" }, false).error, /teléfono/);
  assert.match(perfilPorRol("administrador", { experiencia_anios: "-2" }, false).error, /experiencia/);
  // Ordeñador: turno y tipo de ordeño; el vencimiento del curso solo cuenta si lo tiene.
  assert.match(perfilPorRol("ordenador", { tipo_ordeno: "manual" }, true).error, /turno/);
  const ord = perfilPorRol("ordenador", { turno_ordeno: "ambos", tipo_ordeno: "manual", curso_manipulacion: "no", curso_manipulacion_vence: "2027-01-01" }, true);
  assert.equal(ord.datos.curso_manipulacion, false);
  assert.equal(ord.datos.curso_manipulacion_vence, null);
  // Contador: público exige tarjeta; auxiliar no la guarda.
  assert.match(perfilPorRol("contador", { tipo_contador: "publico" }, true).error, /tarjeta/);
  assert.equal(perfilPorRol("contador", { tipo_contador: "auxiliar", tarjeta_profesional: "123" }, true).datos.tarjeta_profesional, null);
  // Sin acceso a la app: la labor principal.
  assert.match(perfilPorRol("ninguno", {}, true).error, /labor/);
  assert.equal(perfilPorRol("ninguno", { labor_principal: "potreros" }, true).datos.labor_principal, "potreros");
  assert.equal(resumenPerfil("veterinario", { tarjeta_profesional: "MV-1234", especialidades: ["sanidad"], experiencia_anios: 8 }), "T.P. MV-1234 · Sanidad · 8 años de experiencia");
});

test("equipo: el cargo sale del perfil y no se pregunta", () => {
  const sin = { tipo_contador: null, labor_principal: null };
  assert.equal(cargoDelPerfil("veterinario", sin, "lo que sea"), "Veterinario");
  assert.equal(cargoDelPerfil("ordenador", sin), "Ordeñador");
  assert.equal(cargoDelPerfil("administrador", sin), "Administrador");
  assert.equal(cargoDelPerfil("contador", { tipo_contador: "publico", labor_principal: null }), "Contador público");
  assert.equal(cargoDelPerfil("contador", { tipo_contador: "auxiliar", labor_principal: null }), "Auxiliar contable");
  // Sin acceso a la app: su labor; con «Otra labor», la que escribió; sin labor (persona antigua), el cargo que ya tenía.
  assert.equal(cargoDelPerfil("ninguno", { tipo_contador: null, labor_principal: "potreros" }), "Potreros y cercas");
  assert.equal(cargoDelPerfil("ninguno", { tipo_contador: null, labor_principal: "otra" }, "Esquilador"), "Esquilador");
  assert.equal(cargoDelPerfil("ninguno", sin, undefined, "Jornalero"), "Jornalero");
  assert.match(perfilPorRol("ninguno", { labor_principal: "otra" }, true).error, /labor/);
  assert.ok(perfilPorRol("ninguno", { labor_principal: "otra", cargo: "Esquilador" }, true).datos);
});

import { estadoInicialAsistencia, nombreAsistencia } from "../lib/veterinarios.ts";

test("asistido por: el veterinario de la finca u otra persona, excluyentes", () => {
  const ana = { id: "v1", nombre: "Dra. Ana Ruiz", tarjeta_profesional: "MV-1" };
  const luis = { id: "v2", nombre: "Luis Peña", tarjeta_profesional: null };
  // Nuevo: con veterinarios ya viene «Veterinario» (con uno solo, ese elegido); sin veterinarios no se adivina nada.
  assert.deepEqual(estadoInicialAsistencia([ana]), { quien: "veterinario", veterinarioId: "v1", escrito: "" });
  assert.deepEqual(estadoInicialAsistencia([ana, luis]), { quien: "veterinario", veterinarioId: "", escrito: "" });
  assert.deepEqual(estadoInicialAsistencia([]), { quien: "", veterinarioId: "", escrito: "" });
  // Al corregir: el veterinario que coincide (sin importar mayúsculas) o «otra persona» con el nombre escrito.
  assert.deepEqual(estadoInicialAsistencia([ana, luis], "luis peña"), { quien: "veterinario", veterinarioId: "v2", escrito: "" });
  assert.deepEqual(estadoInicialAsistencia([ana, luis], "Don Pedro"), { quien: "otra", veterinarioId: "", escrito: "Don Pedro" });
  // El nombre que se guarda sale de una sola de las dos opciones.
  assert.equal(nombreAsistencia([ana, luis], { quien: "veterinario", veterinarioId: "v1", escrito: "ignorado" }), "Dra. Ana Ruiz");
  assert.equal(nombreAsistencia([ana, luis], { quien: "otra", veterinarioId: "v1", escrito: "  Don Pedro " }), "Don Pedro");
  assert.equal(nombreAsistencia([ana, luis], { quien: "veterinario", veterinarioId: "", escrito: "" }), "");
  assert.equal(nombreAsistencia([ana, luis], { quien: "", veterinarioId: "v1", escrito: "algo" }), "");
});
