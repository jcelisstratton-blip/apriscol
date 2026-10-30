import test from "node:test";
import assert from "node:assert/strict";
import { firmarJwt, leerJwt } from "../lib/notificaciones/jwt.ts";
import { escaparHtml, interpretarComando, leerEvento, secretoValido, enviarTelegram, LIMITE_MENSAJE } from "../lib/notificaciones/telegram.ts";
import { armarResumen } from "../lib/notificaciones/mensajes.ts";

test("JWT: firma de persona y de servicio, vigencia corta y firma ajena rechazada", () => {
  const ahora = 1_800_000_000_000;
  const t = firmarJwt({ sub: "u1", role: "authenticated", secreto: "s3cret", ahora });
  const c = leerJwt(t, "s3cret", ahora + 1000);
  assert.equal(c?.sub, "u1");
  assert.equal(c?.role, "authenticated");
  assert.equal(c?.aud, "authenticated");
  assert.equal(c?.exp, ahora / 1000 + 60);
  assert.equal(leerJwt(t, "otro", ahora), null);
  assert.equal(leerJwt(t, "s3cret", ahora + 61_000), null);
  assert.equal(leerJwt(t + "x", "s3cret", ahora), null);
  assert.equal(leerJwt(firmarJwt({ role: "service_role", secreto: "s3cret", ahora }), "s3cret", ahora)?.role, "service_role");
  assert.throws(() => firmarJwt({ role: "authenticated", secreto: "s3cret" }), /identificador/);
  assert.throws(() => firmarJwt({ sub: "u1", role: "authenticated", secreto: "" }), /secreto/);
});

test("Telegram: comandos, secreto y eventos", () => {
  assert.deepEqual(interpretarComando("/start AB12CD34"), { comando: "start", argumento: "AB12CD34" });
  assert.deepEqual(interpretarComando("/start@apriscolbot ab12cd34 "), { comando: "start", argumento: "ab12cd34" });
  assert.equal(interpretarComando("/HOY").comando, "hoy");
  assert.equal(interpretarComando("/help").comando, "ayuda");
  assert.equal(interpretarComando("/borrar").comando, "desconocido");
  assert.equal(interpretarComando("hola").comando, null);
  assert.equal(interpretarComando(undefined).comando, null);
  assert.equal(secretoValido("abc", "abc"), true);
  assert.equal(secretoValido("abc", "abd"), false);
  assert.equal(secretoValido("abc", "abcd"), false);
  assert.equal(secretoValido(null, "abc"), false);
  assert.equal(secretoValido("abc", undefined), false);
  assert.equal(escaparHtml("<b>a & b</b>"), "&lt;b&gt;a &amp; b&lt;/b&gt;");
  assert.deepEqual(leerEvento({ message: { text: "/hoy", chat: { id: 7, type: "private" } } }), { tipo: "mensaje", chatId: 7, privado: true, texto: "/hoy" });
  assert.equal(leerEvento({ message: { text: "hola", chat: { id: -9, type: "group" } } }).privado, false);
  assert.deepEqual(leerEvento({ my_chat_member: { chat: { id: 7, type: "private" }, new_chat_member: { status: "kicked" } } }), { tipo: "bloqueo", chatId: 7 });
  assert.equal(leerEvento({ my_chat_member: { chat: { id: 7, type: "private" }, new_chat_member: { status: "member" } } }).tipo, "otro");
  assert.equal(leerEvento(null).tipo, "otro");
  assert.equal(leerEvento({ edited_message: {} }).tipo, "otro");
});

test("Telegram: enviar distingue éxito, bloqueo y fallo de red, y no filtra el token", async () => {
  const respuesta = (estado, cuerpo) => async () => ({ ok: estado < 400, status: estado, json: async () => cuerpo });
  assert.deepEqual(await enviarTelegram("T0KEN", 1, "hola", respuesta(200, { ok: true, result: { message_id: 55 } })), { ok: true, messageId: 55 });
  const bloqueado = await enviarTelegram("T0KEN", 1, "hola", respuesta(403, { ok: false, description: "Forbidden: bot was blocked by the user" }));
  assert.equal(bloqueado.ok, false);
  assert.equal(bloqueado.bloqueado, true);
  const otro = await enviarTelegram("T0KEN", 1, "hola", respuesta(400, { ok: false, description: "Bad Request: chat not found" }));
  assert.equal(otro.bloqueado, false);
  const red = await enviarTelegram("T0KEN", 1, "hola", async () => { throw new Error("fallo en https://api.telegram.org/botT0KEN/sendMessage"); });
  assert.equal(red.ok, false);
  assert.doesNotMatch(red.error, /T0KEN/);
  let enviado;
  await enviarTelegram("T0KEN", 1, "x".repeat(LIMITE_MENSAJE + 500), async (_u, o) => { enviado = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) }; });
  assert.equal(enviado.text.length, LIMITE_MENSAJE);
  assert.equal(enviado.parse_mode, "HTML");
});

const item = (clave, nivel, orden, extra = {}) => ({ clave, etiqueta: `Animal ${clave}`, detalle: `detalle ${clave}`, nivel, href: `/hato/${clave}`, orden, ...extra });
const senal = (id, area, titulo, items) => ({ id, area, titulo, nivel: "rojo", resumen: "", items, queSignifica: "", regla: "" });

test("resumen: primero rojo, luego ámbar; con nivel mínimo rojo no llega el ámbar", () => {
  const senales = [
    senal("a", "sanidad", "Dosis y programas", [item("a1", "ambar", 2), item("a2", "rojo", 1, { queHacer: "Aplícala hoy" })]),
    senal("b", "leche", "Cadena de frío", [item("b1", "rojo", 1)]),
  ];
  const base = { nombre: "Camilo Celis", finca: "Aprisco <El Mirador>", hoy: "2026-10-30", saludo: "Buenos días", senales, urlBase: "https://apriscol.shop" };
  const todo = armarResumen({ ...base, nivelMinimo: "ambar" });
  assert.equal(todo.rojos, 2);
  assert.equal(todo.ambar, 1);
  assert.ok(todo.texto.indexOf("Rojo · actúa hoy") < todo.texto.indexOf("Ámbar · programa"));
  assert.match(todo.texto, /Buenos días, Camilo\./);
  assert.match(todo.texto, /Aprisco &lt;El Mirador&gt;/);
  assert.match(todo.texto, /↳ Aplícala hoy/);
  assert.match(todo.texto, /<a href="https:\/\/apriscol\.shop\/hato\/a2">Animal a2<\/a>/);
  const urgente = armarResumen({ ...base, nivelMinimo: "rojo" });
  assert.equal(urgente.ambar, 0);
  assert.doesNotMatch(urgente.texto, /Ámbar/);
});

test("resumen: sin casos dice que todo está en orden; con muchísimos casos corta y manda a la app", () => {
  const vacio = armarResumen({ nombre: null, finca: "Finca", hoy: "2026-10-30", saludo: "Buenas tardes", senales: [], nivelMinimo: "ambar" });
  assert.match(vacio.texto, /Todo en orden/);
  assert.doesNotMatch(vacio.texto, /, null/);
  const muchos = Array.from({ length: 60 }, (_, i) => item(`n${i}`, i % 2 ? "rojo" : "ambar", i, { detalle: "x".repeat(150) }));
  const r = armarResumen({ nombre: "Ana", finca: "Finca", hoy: "2026-10-30", saludo: "Buenos días", senales: [senal("z", "sanidad", "Sanidad", muchos)], nivelMinimo: "ambar", urlBase: "https://apriscol.shop" });
  assert.ok(r.texto.length <= LIMITE_MENSAJE);
  assert.equal(r.mostrados + r.omitidos, 60);
  assert.ok(r.omitidos > 0);
  assert.match(r.texto, /casos más en la app/);
});
