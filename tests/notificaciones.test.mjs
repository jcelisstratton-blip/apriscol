import test from "node:test";
import assert from "node:assert/strict";
import { escaparHtml, interpretarComando, leerEvento, secretoValido, enviarTelegram, editarTelegram, responderAccion, LIMITE_MENSAJE } from "../lib/notificaciones/telegram.ts";
import { validarParametros, horaCorta } from "../lib/notificaciones/parametros.ts";
import { createHmac } from "node:crypto";
import { verificarInitData, rutaDeDestino, rutaInternaSegura, DESTINOS_CLAVE, MAX_EDAD_FIRMA_SEG } from "../lib/notificaciones/miniapp.ts";
import { armarDetalleArea, armarResumen, datosArea, datosResumen, leerAccion } from "../lib/notificaciones/mensajes.ts";

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
  const FINCA = "5e1f0a11-0000-4000-8000-000000000001";
  assert.deepEqual(leerEvento({ callback_query: { id: "cb1", data: `res:${FINCA}`, message: { message_id: 42, chat: { id: 7, type: "private" } } } }), { tipo: "accion", id: "cb1", chatId: 7, messageId: 42, datos: `res:${FINCA}` });
  assert.equal(leerEvento({ callback_query: { id: "cb1", data: "x", message: { message_id: 42, chat: { id: -9, type: "group" } } } }).tipo, "otro");
  assert.equal(leerEvento({ callback_query: { id: "cb1", data: "x" } }).tipo, "otro");
  assert.equal(leerEvento({ callback_query: { id: "cb1", data: "x".repeat(200), message: { message_id: 1, chat: { id: 7, type: "private" } } } }).datos.length, 64);
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
  // Un botón de acción viaja como callback_data; uno de enlace, como url.
  cuerpos.length = 0;
  await enviarTelegram("T0KEN", 1, "hola", [[{ texto: "Sanidad", accion: "ar:sanidad:x" }, { texto: "Abrir", url: "https://apriscol.shop/" }]], http([200]));
  assert.deepEqual(cuerpos[0].reply_markup.inline_keyboard, [[{ text: "Sanidad", callback_data: "ar:sanidad:x" }, { text: "Abrir", url: "https://apriscol.shop/" }]]);
  // Un botón de Mini App viaja como web_app: abre Apriscol dentro de Telegram, sin el aviso de dirección.
  cuerpos.length = 0;
  await enviarTelegram("T0KEN", 1, "hola", [[{ texto: "Ver estas tareas en la app", miniApp: "https://apriscol.shop/telegram/entrar?f=x&d=sanidad" }]], http([200]));
  assert.deepEqual(cuerpos[0].reply_markup.inline_keyboard, [[{ text: "Ver estas tareas en la app", web_app: { url: "https://apriscol.shop/telegram/entrar?f=x&d=sanidad" } }]]);
});

test("Telegram: editar un mensaje y responder a un botón", async () => {
  const llamadas = [];
  const http = (estado, cuerpo) => async (u, o) => { llamadas.push({ u, cuerpo: JSON.parse(o.body) }); return { ok: estado < 400, status: estado, json: async () => cuerpo }; };
  assert.deepEqual(await editarTelegram("T0KEN", 7, 42, "nuevo", [[{ texto: "← Volver", accion: "res:x" }]], http(200, { ok: true, result: { message_id: 42 } })), { ok: true });
  assert.match(llamadas[0].u, /editMessageText$/);
  assert.deepEqual([llamadas[0].cuerpo.chat_id, llamadas[0].cuerpo.message_id], [7, 42]);
  // Pedir el mismo contenido que ya está no es un error.
  assert.deepEqual(await editarTelegram("T0KEN", 7, 42, "igual", [], http(400, { ok: false, description: "Bad Request: message is not modified" })), { ok: true });
  const mal = await editarTelegram("T0KEN", 7, 42, "x", [], http(400, { ok: false, description: "Bad Request: message to edit not found" }));
  assert.equal(mal.ok, false);
  llamadas.length = 0;
  await responderAccion("T0KEN", "cb1", "Ese botón ya no sirve", http(200, { ok: true }));
  assert.match(llamadas[0].u, /answerCallbackQuery$/);
  assert.deepEqual(llamadas[0].cuerpo, { callback_query_id: "cb1", text: "Ese botón ya no sirve" });
});

const item = (clave, nivel, orden, extra = {}) => ({ clave, etiqueta: `Animal ${clave}`, detalle: `detalle ${clave}`, nivel, href: `/hato/${clave}`, orden, ...extra });
const senal = (id, area, titulo, items) => ({ id, area, titulo, nivel: "rojo", resumen: "", items, queSignifica: "", regla: "" });

const FINCA = "5e1f0a11-0000-4000-8000-000000000001";
const dosisItem = (clave, nivel, atraso) => item(clave, nivel, nivel === "rojo" ? -atraso : 3, { etiqueta: `Producto ${clave}`, atrasoDias: atraso });
const SENALES = [
  senal("dosis", "sanidad", "Dosis y programas por aplicar", [dosisItem("a", "rojo", 324), dosisItem("b", "rojo", 20), dosisItem("c", "rojo", 5), dosisItem("d", "rojo", 1), dosisItem("e", "ambar", 0), dosisItem("f", "ambar", 0)]),
  senal("copro", "sanidad", "Cargas de parásitos altas (coprológico)", [item("p1", "rojo", 1, { etiqueta: "Chispa · MIR-C0046" }), item("p2", "rojo", 2, { etiqueta: "Milagros · MIR-C0170" })]),
  senal("famacha", "sanidad", "Anemia por parásitos (FAMACHA)", [item("m1", "rojo", 1), item("m2", "ambar", 2), item("m3", "ambar", 3)]),
  senal("frio", "leche", "Cadena de frío", [item("t", "ambar", 1, { etiqueta: "Tanque de frío" })]),
];
const BASE = { nombre: "Camilo Celis", finca: "Aprisco <El Mirador>", fincaId: FINCA, hoy: "2026-10-30", saludo: "Buenos días", senales: SENALES, urlBase: "https://apriscol.shop" };

test("resumen automático: corto, con los totales arriba, lo más urgente (una línea por tarea) y un botón por área", () => {
  const r = armarResumen({ ...BASE, nivelMinimo: "ambar" });
  assert.equal(r.rojos, 7);
  assert.equal(r.ambar, 5);
  assert.match(r.texto, /Aprisco &lt;El Mirador&gt;/);
  assert.match(r.texto, /Buenos días, Camilo/);
  assert.match(r.texto, /🔴 <b>7<\/b> vencidos o urgentes {3}🟠 <b>5<\/b> pendientes/);
  assert.match(r.texto, /<b>Lo más urgente<\/b>/);
  // Una sola línea por tarea, con el número de casos vencidos; las fechadas dicen cuál lleva más atraso.
  assert.match(r.texto, /🔴 <b>4<\/b> · Dosis y programas por aplicar <i>\(la más atrasada: hace 324 días\)<\/i>/);
  assert.match(r.texto, /🔴 <b>2<\/b> · Cargas de parásitos altas \(coprológico\)/);
  assert.equal((r.texto.match(/Anemia por parásitos/g) ?? []).length, 1);
  // El resumen no lista nombres: eso se ve al tocar el área.
  assert.doesNotMatch(r.texto, /Chispa|<a href/);
  assert.match(r.texto, /Toca un área para ver el detalle/);
  // Botones: un botón de acción por área (con sus conteos), de a dos por fila, y al final Hoy y Semáforos como enlaces.
  assert.deepEqual(r.botones, [
    [{ texto: "Sanidad · 🔴 7 · 🟠 4", accion: datosArea("sanidad", FINCA) }, { texto: "Leche · 🟠 1", accion: datosArea("leche", FINCA) }],
    [{ texto: "Abrir Hoy", miniApp: `https://apriscol.shop/telegram/entrar?f=${FINCA}&d=%2F` }, { texto: "Ver semáforos", miniApp: `https://apriscol.shop/telegram/entrar?f=${FINCA}&d=%2Fsemaforos` }],
  ]);
  for (const fila of r.botones) for (const b of fila) if ("accion" in b) assert.ok(b.accion.length <= 64);
  // Con nivel mínimo rojo no llega nada pendiente, y un área sin vencidos ni pendientes visibles no tiene botón.
  const urgente = armarResumen({ ...BASE, nivelMinimo: "rojo" });
  assert.equal(urgente.ambar, 0);
  assert.doesNotMatch(urgente.texto, /🟠/);
  assert.ok(!JSON.stringify(urgente.botones).includes("leche"));
});

test("resumen automático: sin casos todo está en orden; sin https no hay enlaces pero sí botones de área; muchísimas tareas se recortan", () => {
  const vacio = armarResumen({ ...BASE, senales: [], nombre: null, saludo: "Buenas tardes", nivelMinimo: "ambar" });
  assert.match(vacio.texto, /Todo en orden/);
  assert.doesNotMatch(vacio.texto, /, null/);
  assert.equal(vacio.botones.length, 1);
  const local = armarResumen({ ...BASE, nivelMinimo: "ambar", urlBase: "http://localhost:3000" });
  assert.ok(local.botones.length > 0 && local.botones.flat().every((b) => "accion" in b));
  const areas = ["reproduccion", "sanidad", "leche", "ceba", "corrales", "inventario", "alimento", "dinero"];
  const largas = areas.flatMap((area, a) => Array.from({ length: 6 }, (_, t) => senal(`s${a}${t}`, area, `Tarea número ${t} del área ${area} con un título bastante largo`, Array.from({ length: 3 }, (_, k) => item(`${a}${t}${k}`, "rojo", k)))));
  const r = armarResumen({ ...BASE, senales: largas, nivelMinimo: "ambar" });
  assert.ok(r.texto.length <= LIMITE_MENSAJE);
  assert.equal(r.rojos, 8 * 6 * 3);
  assert.match(r.texto, /… y 42 tareas más/);
  assert.equal(r.botones.flat().filter((b) => "accion" in b).length, 8);
});

test("detalle de un área: tareas con sus vencidos y pendientes, nombres como texto (sin enlaces dentro del mensaje), y botones para abrir la app y volver", () => {
  const r = armarDetalleArea({ ...BASE, area: "sanidad", nivelMinimo: "ambar" });
  assert.match(r.texto, /^<b>SANIDAD<\/b> · 🔴 7 · 🟠 4/);
  // Cada tarea una vez, con una línea por nivel.
  assert.equal((r.texto.match(/<b>Anemia por parásitos \(FAMACHA\)<\/b>/g) ?? []).length, 1);
  assert.match(r.texto, /🔴 <b>1<\/b> · Animal m1/);
  assert.match(r.texto, /🟠 <b>2<\/b> · /);
  assert.match(r.texto, /Chispa, Milagros/);
  assert.doesNotMatch(r.texto, /<a |https?:\/\//); // ningún enlace en el texto: Telegram no muestra su aviso de dirección
  assert.doesNotMatch(r.texto, /MIR-C0046|LECHE/);
  assert.match(r.texto, /🔴 <b>4<\/b> vencidas · <i>la más atrasada: hace 324 días<\/i>/);
  assert.match(r.texto, /🟠 <b>2<\/b> pendientes · /);
  // Un botón por cada tarea listada, en el mismo orden del texto (con cuántos casos tiene), a SU lista en Semáforos con solo esa área; y al final «Ver toda el área» y volver.
  const app = (ruta) => `https://apriscol.shop/telegram/entrar?f=${FINCA}&d=${encodeURIComponent(ruta)}`;
  assert.deepEqual(r.botones, [
    [{ texto: "Dosis y programas por aplicar (6)", miniApp: app("/semaforos?area=sanidad&s=dosis") }],
    [{ texto: "Cargas de parásitos altas (coprológico) (2)", miniApp: app("/semaforos?area=sanidad&s=copro") }],
    [{ texto: "Anemia por parásitos (FAMACHA) (3)", miniApp: app("/semaforos?area=sanidad&s=famacha") }],
    [{ texto: "Ver toda el área", miniApp: app("/semaforos?area=sanidad") }, { texto: "← Volver al resumen", accion: datosResumen(FINCA) }],
  ]);
  // Una tarea con UN solo caso lleva directo a la pantalla de ese caso; si su ruta no fuera segura, cae a la lista de la tarea.
  const leche = armarDetalleArea({ ...BASE, area: "leche", nivelMinimo: "ambar" });
  assert.deepEqual(leche.botones[0], [{ texto: "Cadena de frío · Tanque de frío", miniApp: app("/hato/t") }]);
  // Un solo caso: el mensaje dice por qué está ahí y qué hacer, sin abrir la app. Con varios casos no se repite en cada uno.
  const corral = armarDetalleArea({ ...BASE, area: "corrales", nivelMinimo: "ambar", senales: [senal("corrales", "corrales", "Cupo y rotación", [item("c1", "rojo", 0, { etiqueta: "Potrero Ovinos 1", detalle: "Pasó su cupo: tiene 13 animales y le caben 10", queHacer: "Pasa 3 animales a otra instalación." })])] });
  assert.match(corral.texto, /🔴 <b>1<\/b> · Potrero Ovinos 1\n   Pasó su cupo: tiene 13 animales y le caben 10\. <b>Qué hacer:<\/b> Pasa 3 animales a otra instalación\./);
  assert.doesNotMatch(r.texto, /Qué hacer/);
  const rara = armarDetalleArea({ ...BASE, area: "leche", nivelMinimo: "ambar", senales: [senal("frio", "leche", "Cadena de frío", [item("t", "ambar", 1, { etiqueta: "Tanque", href: "https://malo.example/x" })])] });
  assert.deepEqual(rara.botones[0], [{ texto: "Cadena de frío (1)", miniApp: app("/semaforos?area=leche&s=frio") }]);
  // Un área sin nada: lo dice y deja volver; sin https solo queda «volver».
  const vacia = armarDetalleArea({ ...BASE, area: "corrales", nivelMinimo: "ambar", urlBase: "http://localhost:3000" });
  assert.match(vacia.texto, /Nada pide atención/);
  assert.deepEqual(vacia.botones, [[{ texto: "← Volver al resumen", accion: datosResumen(FINCA) }]]);
  // Con demasiadas tareas se corta con «… y N tareas más».
  const largas = Array.from({ length: 80 }, (_, t) => senal(`z${t}`, "sanidad", `Tarea ${t} ${"muy larga ".repeat(8)}`, Array.from({ length: 9 }, (_, k) => item(`z${t}${k}`, "rojo", k, { etiqueta: `Nombre ${t}-${k} ${"X".repeat(30)}` }))));
  const grande = armarDetalleArea({ ...BASE, senales: largas, area: "sanidad", nivelMinimo: "ambar" });
  assert.ok(grande.texto.length <= LIMITE_MENSAJE);
  assert.match(grande.texto, /… y \d+ tareas más en la app/);
});

test("botones de acción: lo que llega de Telegram se valida (área, finca y forma) antes de usarlo", () => {
  assert.deepEqual(leerAccion(datosArea("sanidad", FINCA)), { tipo: "area", area: "sanidad", fincaId: FINCA });
  assert.deepEqual(leerAccion(datosResumen(FINCA)), { tipo: "resumen", fincaId: FINCA });
  for (const malo of ["", "ar:sanidad", "ar:inventada:" + FINCA, "ar:__proto__:" + FINCA, "ar:toString:" + FINCA, "ar:sanidad:no-es-uuid", "res:no-es-uuid", "res:" + FINCA + ":extra", "x:y:z", "ar:sanidad:" + FINCA + ":mas"]) assert.equal(leerAccion(malo), null, malo);
  assert.ok(datosArea("alimento", FINCA).length <= 64);
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

test("Parámetros de aviso (superadmin): se validan antes de llegar a la base", () => {
  const base = { activo: true, resumen: true, resumen_hora: "06:30", dias: [6, 1, 1, 3], nivel_minimo: "ambar", alertas: true, semanal: false, silencio_desde: "20:00", silencio_hasta: "05:00", max_diarios: 8 };
  const ok = validarParametros(base);
  assert.ok(ok.ok);
  assert.deepEqual(ok.datos.dias, [1, 3, 6]);
  assert.equal(horaCorta("06:30:00"), "06:30");
  for (const malo of [{ resumen_hora: "6:30" }, { resumen_hora: "24:00" }, { silencio_desde: "" }, { silencio_hasta: "20:60" }, { dias: [] }, { dias: [0] }, { dias: [8] }, { dias: [1.5] }, { nivel_minimo: "todo" }, { max_diarios: 0 }, { max_diarios: 31 }, { max_diarios: 2.5 }]) {
    assert.equal(validarParametros({ ...base, ...malo }).ok, false, JSON.stringify(malo));
  }
});

// Firma de Telegram escrita aparte del código de producción, siguiendo la especificación: llave = HMAC("WebAppData", token); hash = HMAC(llave, campos ordenados «k=v» unidos con salto de línea).
function initDataFirmado(campos, token, { incluirSignature = true } = {}) {
  const llave = createHmac("sha256", "WebAppData").update(token).digest();
  const cadena = Object.entries(campos).filter(([k]) => incluirSignature || k !== "signature").sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const hash = createHmac("sha256", llave).update(cadena).digest("hex");
  return new URLSearchParams({ ...campos, hash }).toString();
}

test("Mini App: la firma de Telegram se comprueba (válida, alterada, vencida, de otro bot, sin persona)", () => {
  const TOKEN = "123456:TOKEN-DE-PRUEBA";
  const AHORA = 1_800_000_000;
  const campos = { auth_date: String(AHORA - 30), query_id: "AAH", signature: "firma-ed25519-ejemplo", user: JSON.stringify({ id: 777001, first_name: "Camilo" }) };

  assert.deepEqual(verificarInitData(initDataFirmado(campos, TOKEN), TOKEN, AHORA), { ok: true, userId: 777001, authDate: AHORA - 30 });
  // Si la versión de Telegram firma sin el campo «signature», también vale.
  assert.equal(verificarInitData(initDataFirmado(campos, TOKEN, { incluirSignature: false }), TOKEN, AHORA).ok, true);

  // Firma de otro bot, o un dato cambiado después de firmar (otro usuario, otra fecha): rechazada.
  assert.deepEqual(verificarInitData(initDataFirmado(campos, "999:OTRO-BOT"), TOKEN, AHORA), { ok: false, motivo: "firma" });
  const buena = new URLSearchParams(initDataFirmado(campos, TOKEN));
  const otroUsuario = new URLSearchParams(buena);
  otroUsuario.set("user", JSON.stringify({ id: 1, first_name: "Intruso" }));
  assert.deepEqual(verificarInitData(otroUsuario.toString(), TOKEN, AHORA), { ok: false, motivo: "firma" });
  const otraFecha = new URLSearchParams(buena);
  otraFecha.set("auth_date", String(AHORA));
  assert.deepEqual(verificarInitData(otraFecha.toString(), TOKEN, AHORA), { ok: false, motivo: "firma" });
  // Un hash de otro largo o con letras que no son hexadecimales no rompe la comparación: simplemente no vale.
  for (const hash of ["", "abc", "zz".repeat(32), "0".repeat(63), "0".repeat(65)]) {
    const p = new URLSearchParams(buena);
    p.set("hash", hash);
    assert.equal(verificarInitData(p.toString(), TOKEN, AHORA).ok, false, hash);
  }
  const sinHash = new URLSearchParams(buena);
  sinHash.delete("hash");
  assert.deepEqual(verificarInitData(sinHash.toString(), TOKEN, AHORA), { ok: false, motivo: "formato" });

  // Vieja (más de 10 minutos) o fechada en el futuro: rechazada aunque la firma sea de verdad.
  const vieja = initDataFirmado({ ...campos, auth_date: String(AHORA - MAX_EDAD_FIRMA_SEG - 1) }, TOKEN);
  assert.deepEqual(verificarInitData(vieja, TOKEN, AHORA), { ok: false, motivo: "vencido" });
  assert.equal(verificarInitData(initDataFirmado({ ...campos, auth_date: String(AHORA - MAX_EDAD_FIRMA_SEG) }, TOKEN), TOKEN, AHORA).ok, true);
  assert.deepEqual(verificarInitData(initDataFirmado({ ...campos, auth_date: String(AHORA + 3600) }, TOKEN), TOKEN, AHORA), { ok: false, motivo: "vencido" });

  // Firmada pero sin persona utilizable.
  for (const user of [undefined, "no-es-json", "null", JSON.stringify({ first_name: "Sin id" }), JSON.stringify({ id: "777001" }), JSON.stringify({ id: -5 }), JSON.stringify({ id: 1.5 })]) {
    const c = { ...campos };
    if (user === undefined) delete c.user;
    else c.user = user;
    assert.deepEqual(verificarInitData(initDataFirmado(c, TOKEN), TOKEN, AHORA), { ok: false, motivo: "usuario" }, String(user));
  }
  // Entradas absurdas.
  for (const x of ["", "a".repeat(5000), "hash=abc"]) assert.equal(verificarInitData(x, TOKEN, AHORA).ok, false);
  assert.equal(verificarInitData(initDataFirmado(campos, TOKEN), "", AHORA).ok, false);
});

test("Mini App: el botón solo puede llevar a rutas internas permitidas", () => {
  // Las claves de los botones que ya están en chats viejos siguen sirviendo y llevan a lo mismo que ahora.
  assert.equal(rutaDeDestino("hoy"), "/");
  assert.equal(rutaDeDestino("semaforos"), "/semaforos");
  assert.equal(rutaDeDestino("sanidad"), "/semaforos?area=sanidad");
  assert.equal(rutaDeDestino("alimento"), "/semaforos?area=alimento");
  for (const ruta of Object.values(DESTINOS_CLAVE)) assert.equal(rutaInternaSegura(ruta), ruta);
  // Rutas internas de la app: con consulta y ancla, las que genera el servidor.
  for (const buena of ["/", "/semaforos?area=sanidad&s=dosis", "/hato/abc-123#sanidad", "/hato/sanidad/nuevo?refuerzo=5e1f0a11-0000-4000-8000-000000000001", "/inventario?vista=alimento"]) assert.equal(rutaDeDestino(buena), buena, buena);
  // Nada que salga del sitio, suba carpetas, use otro esquema o toque lo que un botón del bot nunca necesita.
  const malas = ["", "https://malo.example", "//malo.example", "/\\malo.example", "javascript:alert(1)", "/../admin", "/hato/../x", "/hato/%2e%2e/x", "/hato/a:b", "/hato/a b", "/api/telegram/sesion", "/telegram/entrar", "/admin/fincas", "/login", "/auth/callback", "/cambiar-clave", "__proto__", "toString", "constructor", "SANIDAD", "/" + "a".repeat(400)];
  for (const mala of malas) assert.equal(rutaDeDestino(mala), null, mala);
  assert.equal(rutaDeDestino(undefined), null);
});

