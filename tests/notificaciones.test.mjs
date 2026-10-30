import test from "node:test";
import assert from "node:assert/strict";
import { escaparHtml, interpretarComando, leerEvento, secretoValido, enviarTelegram, LIMITE_MENSAJE } from "../lib/notificaciones/telegram.ts";
import { armarResumen } from "../lib/notificaciones/mensajes.ts";

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
  assert.deepEqual(await enviarTelegram("T0KEN", 1, "hola", [], respuesta(200, { ok: true, result: { message_id: 55 } })), { ok: true, messageId: 55 });
  const bloqueado = await enviarTelegram("T0KEN", 1, "hola", [], respuesta(403, { ok: false, description: "Forbidden: bot was blocked by the user" }));
  assert.equal(bloqueado.ok, false);
  assert.equal(bloqueado.bloqueado, true);
  const otro = await enviarTelegram("T0KEN", 1, "hola", [], respuesta(400, { ok: false, description: "Bad Request: chat not found" }));
  assert.equal(otro.bloqueado, false);
  const red = await enviarTelegram("T0KEN", 1, "hola", [], async () => { throw new Error("fallo en https://api.telegram.org/botT0KEN/sendMessage"); });
  assert.equal(red.ok, false);
  assert.doesNotMatch(red.error, /T0KEN/);
  let enviado;
  await enviarTelegram("T0KEN", 1, "x".repeat(LIMITE_MENSAJE + 500), [], async (_u, o) => { enviado = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) }; });
  assert.equal(enviado.text.length, LIMITE_MENSAJE);
  assert.equal(enviado.parse_mode, "HTML");
});

test("Telegram: los botones van como enlaces y, si Telegram los rechaza, el mensaje se reenvía sin ellos", async () => {
  const cuerpos = [];
  const http = (estados) => async (_u, o) => {
    cuerpos.push(JSON.parse(o.body));
    const e = estados.shift();
    return { ok: e < 400, status: e, json: async () => (e < 400 ? { ok: true, result: { message_id: 9 } } : { ok: false, description: "Bad Request: wrong HTTP URL" }) };
  };
  const botones = [[{ texto: "Sanidad · 5", url: "https://apriscol.shop/sanidad" }, { texto: "Leche · 1", url: "https://apriscol.shop/leche" }]];
  assert.deepEqual(await enviarTelegram("T0KEN", 1, "hola", botones, http([200])), { ok: true, messageId: 9 });
  assert.deepEqual(cuerpos[0].reply_markup.inline_keyboard, [[{ text: "Sanidad · 5", url: "https://apriscol.shop/sanidad" }, { text: "Leche · 1", url: "https://apriscol.shop/leche" }]]);
  cuerpos.length = 0;
  assert.deepEqual(await enviarTelegram("T0KEN", 1, "hola", botones, http([400, 200])), { ok: true, messageId: 9 });
  assert.equal(cuerpos.length, 2);
  assert.ok(cuerpos[0].reply_markup && !cuerpos[1].reply_markup);
  cuerpos.length = 0;
  await enviarTelegram("T0KEN", 1, "hola", [], http([200]));
  assert.ok(!("reply_markup" in cuerpos[0]));
});

const item = (clave, nivel, orden, extra = {}) => ({ clave, etiqueta: `Animal ${clave}`, detalle: `detalle ${clave}`, nivel, href: `/hato/${clave}`, orden, ...extra });
const senal = (id, area, titulo, items) => ({ id, area, titulo, nivel: "rojo", resumen: "", items, queSignifica: "", regla: "" });

test("resumen: arriba los totales, por área, vencido (rojo) y pendiente (ámbar) separados, con botones a cada área", () => {
  const dosis = (clave, nivel, atraso) => item(clave, nivel, nivel === "rojo" ? -atraso : 3, { etiqueta: `Producto ${clave}`, atrasoDias: atraso });
  const senales = [
    senal("dosis", "sanidad", "Dosis y programas por aplicar", [dosis("a", "rojo", 324), dosis("b", "rojo", 20), dosis("c", "rojo", 5), dosis("d", "rojo", 1), dosis("e", "ambar", 0), dosis("f", "ambar", 0)]),
    senal("copro", "sanidad", "Cargas de parásitos altas (coprológico)", [item("p1", "rojo", 1, { etiqueta: "Chispa · MIR-C0046" }), item("p2", "rojo", 2, { etiqueta: "Milagros · MIR-C0170" })]),
    senal("frio", "leche", "Cadena de frío", [item("t", "ambar", 1, { etiqueta: "Tanque de frío" })]),
  ];
  const base = { nombre: "Camilo Celis", finca: "Aprisco <El Mirador>", hoy: "2026-10-30", saludo: "Buenos días", senales, urlBase: "https://apriscol.shop" };
  const r = armarResumen({ ...base, nivelMinimo: "ambar" });
  assert.equal(r.rojos, 6);
  assert.equal(r.ambar, 3);
  assert.match(r.texto, /Aprisco &lt;El Mirador&gt;/);
  assert.match(r.texto, /Buenos días, Camilo/);
  assert.match(r.texto, /🔴 <b>6<\/b> vencidos o urgentes {3}🟠 <b>3<\/b> pendientes/);
  // Las dosis vencidas no se listan una por una: se cuentan y se dice cuál lleva más atraso.
  assert.match(r.texto, /🔴 Dosis y programas por aplicar · vencidas · <b>4<\/b>\n\s+<i>la más atrasada: hace 324 días<\/i>/);
  assert.match(r.texto, /🟠 Dosis y programas por aplicar · pendientes · <b>2<\/b>/);
  // Lo no fechado muestra nombres sin el arete, con enlace a su ficha.
  assert.match(r.texto, /<a href="https:\/\/apriscol\.shop\/hato\/p1">Chispa<\/a>, <a href="https:\/\/apriscol\.shop\/hato\/p2">Milagros<\/a>/);
  assert.doesNotMatch(r.texto, /MIR-C0046/);
  // El área con vencidos va primero.
  assert.ok(r.texto.indexOf("SANIDAD") < r.texto.indexOf("LECHE"));
  // Botones: una pareja por fila (con la cantidad de casos) y una última con Hoy y Semáforos.
  assert.deepEqual(r.botones, [
    [{ texto: "Sanidad · 8", url: "https://apriscol.shop/sanidad" }, { texto: "Leche · 1", url: "https://apriscol.shop/leche" }],
    [{ texto: "Abrir Hoy", url: "https://apriscol.shop/" }, { texto: "Ver semáforos", url: "https://apriscol.shop/semaforos" }],
  ]);
  // Con nivel mínimo rojo no llega nada pendiente.
  const urgente = armarResumen({ ...base, nivelMinimo: "rojo" });
  assert.equal(urgente.ambar, 0);
  assert.doesNotMatch(urgente.texto, /🟠/);
  assert.doesNotMatch(urgente.texto, /Leche|LECHE/);
});

test("resumen: sin casos todo está en orden; sin dirección https no hay botones; si no cabe, se quitan los nombres pero no las tareas", () => {
  const vacio = armarResumen({ nombre: null, finca: "Finca", hoy: "2026-10-30", saludo: "Buenas tardes", senales: [], nivelMinimo: "ambar", urlBase: "https://apriscol.shop" });
  assert.match(vacio.texto, /Todo en orden/);
  assert.doesNotMatch(vacio.texto, /, null/);
  assert.equal(vacio.botones.length, 1);
  const local = armarResumen({ nombre: "Ana", finca: "Finca", hoy: "2026-10-30", saludo: "Hola", senales: [senal("z", "sanidad", "Sanidad", [item("n", "rojo", 1)])], nivelMinimo: "ambar", urlBase: "http://localhost:3000" });
  assert.deepEqual(local.botones, []);
  const sinBase = armarResumen({ nombre: "Ana", finca: "Finca", hoy: "2026-10-30", saludo: "Hola", senales: [senal("z", "sanidad", "Sanidad", [item("n", "rojo", 1)])], nivelMinimo: "ambar" });
  assert.deepEqual(sinBase.botones, []);
  assert.doesNotMatch(sinBase.texto, /<a href/);
  // Muchísimas áreas con tareas de nombres largos: cabe en un mensaje y conserva cada tarea con su cantidad.
  const areas = ["reproduccion", "sanidad", "leche", "ceba", "corrales", "inventario", "alimento", "dinero"];
  const largas = areas.flatMap((area, a) => Array.from({ length: 6 }, (_, t) => senal(`s${a}${t}`, area, `Tarea número ${t} del área ${area} con un título bastante largo`, Array.from({ length: 3 }, (_, k) => item(`${a}${t}${k}`, "rojo", k, { etiqueta: `${"N".repeat(40)} ${k}`, detalle: "x".repeat(150) })))));
  const r = armarResumen({ nombre: "Ana", finca: "Finca", hoy: "2026-10-30", saludo: "Hola", senales: largas, nivelMinimo: "ambar", urlBase: "https://apriscol.shop" });
  assert.ok(r.texto.length <= LIMITE_MENSAJE);
  assert.equal(r.rojos, 8 * 6 * 3);
  assert.match(r.texto, /Tarea número 5 del área dinero/);
});

import { describirAvisos, enlaceBot, horaLegible } from "../lib/notificaciones/enlace.ts";
test("Telegram en la app: enlace del bot, hora legible y descripción de los avisos", () => {
  assert.equal(enlaceBot("apriscolbot", "AB12CD34"), "https://t.me/apriscolbot?start=AB12CD34");
  assert.equal(horaLegible("06:30:00"), "6:30 a. m.");
  assert.equal(horaLegible("00:05:00"), "12:05 a. m.");
  assert.equal(horaLegible("12:00:00"), "12:00 p. m.");
  assert.equal(horaLegible("18:45:00"), "6:45 p. m.");
  const base = { activo: true, resumen: true, resumen_hora: "06:30:00", dias: [1, 2, 3, 4, 5, 6, 7], nivel_minimo: "ambar" };
  assert.equal(describirAvisos(base), "Resumen todos los días a las 6:30 a. m., con lo urgente (rojo) y lo que se programa (ámbar).");
  assert.match(describirAvisos({ ...base, dias: [1, 2, 3, 4, 5], nivel_minimo: "rojo" }), /de lunes a viernes a las 6:30 a\. m\., con solo lo urgente \(rojo\)\./);
  assert.match(describirAvisos({ ...base, dias: [6, 1] }), /lun, sáb/);
  assert.equal(describirAvisos({ ...base, activo: false }), null);
  assert.equal(describirAvisos({ ...base, resumen: false }), null);
  assert.equal(describirAvisos(null), null);
});
