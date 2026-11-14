import test from "node:test";
import assert from "node:assert/strict";
import { esTokenValido, generarToken, huellaDeToken, prefijoVisible, tokenDeCabecera } from "../lib/mcp/token.ts";
import { crearLimitador } from "../lib/mcp/limite.ts";
import { atenderMensaje, ErrorHerramienta, SERVIDOR, VERSIONES_SOPORTADAS } from "../lib/mcp/protocolo.ts";
import { herramientasPara, senalCompacta } from "../lib/mcp/herramientas.ts";
import { armarSenal } from "../lib/semaforos.ts";
import { z } from "zod";

test("token: formato, unicidad y huella de 64 hex que no revela el token", () => {
  const a = generarToken();
  const b = generarToken();
  assert.ok(esTokenValido(a));
  assert.notEqual(a, b);
  assert.match(huellaDeToken(a), /^[0-9a-f]{64}$/);
  assert.equal(huellaDeToken(a), huellaDeToken(a));
  assert.notEqual(huellaDeToken(a), huellaDeToken(b));
  assert.ok(!huellaDeToken(a).includes(a.slice(4, 12)));
  assert.equal(prefijoVisible(a), a.slice(0, 8));
});

test("token: solo se acepta el formato exacto y la cabecera Bearer", () => {
  const t = generarToken();
  for (const malo of [undefined, null, "", "apr_corto", `apr_${"a".repeat(44)}`, `xyz_${"a".repeat(43)}`, `apr_${"a".repeat(42)}!`, 5]) assert.equal(esTokenValido(malo), false);
  assert.equal(tokenDeCabecera(`Bearer ${t}`), t);
  assert.equal(tokenDeCabecera(`bearer   ${t} `), t);
  for (const mala of [null, "", t, `Basic ${t}`, "Bearer apr_xx", `Bearer ${t} extra`]) assert.equal(tokenDeCabecera(mala), null);
});

test("límite: corta al llegar al tope, es por token y se libera con el tiempo", () => {
  const l = crearLimitador(3, 1000);
  assert.ok(l.permitir("a", 0) && l.permitir("a", 10) && l.permitir("a", 20));
  assert.equal(l.permitir("a", 30), false);
  assert.ok(l.permitir("b", 30), "otro token no se ve afectado");
  assert.ok(l.permitir("a", 1015), "pasada la ventana vuelve a dejar");
});

const herramientaSuma = { nombre: "suma", titulo: "Suma", descripcion: "suma", entrada: z.object({ a: z.number(), b: z.number().default(1) }), ejecutar: async (x) => String(x.a + x.b) };
const herramientaFalla = { nombre: "falla", titulo: "Falla", descripcion: "x", entrada: z.object({}), ejecutar: async () => { throw new ErrorHerramienta("Sin permiso."); } };
const herramientaRota = { nombre: "rota", titulo: "Rota", descripcion: "x", entrada: z.object({}), ejecutar: async () => { throw new Error("duplicate key value violates unique constraint tokens_ia"); } };
const lista = [herramientaSuma, herramientaFalla, herramientaRota];
const msg = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, params });

test("protocolo: initialize negocia versión, no inventa capacidades y no expone nada más", async () => {
  const r = await atenderMensaje(msg("initialize", { protocolVersion: "2025-03-26" }), lista);
  assert.equal(r.result.protocolVersion, "2025-03-26");
  assert.deepEqual(Object.keys(r.result.capabilities), ["tools"]);
  assert.equal(r.result.serverInfo.name, SERVIDOR.name);
  const otra = await atenderMensaje(msg("initialize", { protocolVersion: "1999-01-01" }), lista);
  assert.equal(otra.result.protocolVersion, VERSIONES_SOPORTADAS[0]);
});

test("protocolo: tools/list describe cada herramienta como solo lectura con su esquema", async () => {
  const r = await atenderMensaje(msg("tools/list"), lista);
  assert.equal(r.result.tools.length, 3);
  for (const t of r.result.tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.inputSchema.type, "object");
    assert.equal(t.inputSchema.$schema, undefined);
  }
});

test("protocolo: tools/call valida la entrada, aplica valores por defecto y separa errores esperables de los internos", async () => {
  const ok = await atenderMensaje(msg("tools/call", { name: "suma", arguments: { a: 2 } }), lista);
  assert.equal(ok.result.content[0].text, "3");
  assert.equal(ok.result.isError, undefined);
  const mal = await atenderMensaje(msg("tools/call", { name: "suma", arguments: { a: "x" } }), lista);
  assert.equal(mal.result.isError, true);
  const permiso = await atenderMensaje(msg("tools/call", { name: "falla", arguments: {} }), lista);
  assert.equal(permiso.result.content[0].text, "Sin permiso.");
  assert.equal(permiso.result.isError, true);
  const callado = console.error;
  console.error = () => {};
  const rota = await atenderMensaje(msg("tools/call", { name: "rota", arguments: {} }), lista);
  console.error = callado;
  assert.equal(rota.result.isError, true);
  assert.ok(!/duplicate|tokens_ia/.test(rota.result.content[0].text), "el texto crudo de la base no llega al asistente");
});

test("protocolo: herramienta inexistente, método desconocido, notificaciones y mensajes mal formados", async () => {
  assert.equal((await atenderMensaje(msg("tools/call", { name: "no_existe" }), lista)).error.code, -32602);
  assert.equal((await atenderMensaje(msg("resources/list"), lista)).error.code, -32601);
  assert.deepEqual((await atenderMensaje(msg("ping"), lista)).result, {});
  assert.equal(await atenderMensaje({ jsonrpc: "2.0", method: "notifications/initialized" }, lista), null);
  for (const malo of [null, 5, "hola", [], { jsonrpc: "1.0", id: 1, method: "ping" }, { jsonrpc: "2.0", id: {}, method: "ping" }, { jsonrpc: "2.0", id: 1 }]) {
    assert.equal((await atenderMensaje(malo, lista)).error.code, -32600);
  }
});

const senal = (id, area, nivel, items = []) => ({ ...armarSenal({ id, area, titulo: `T-${id}`, queHacer: "Haz algo.", queSignifica: "Significa algo.", regla: "Regla." }, items) });
const item = (n, nivel) => ({ clave: `c${n}`, etiqueta: `Animal ${n}`, detalle: `detalle ${n}`, nivel, href: "/x", orden: n });
const SENALES = [
  senal("partos", "reproduccion", "rojo", [item(1, "rojo"), item(2, "ambar"), item(3, "ambar"), item(4, "ambar"), item(5, "ambar")]),
  senal("famacha", "sanidad", "ambar", [item(6, "ambar")]),
  senal("frio", "leche", "verde", []),
];
const datos = {
  senales: async () => SENALES,
  buscarAnimales: async (t) => [{ etiqueta: `Luna · ${t}`, tipo: "Cabra", estado: "activo", nacimiento: null }],
  leche: async (dias) => ({
    desde: "2026-10-01", hasta: "2026-10-30", dias,
    totales: { tanque: 120.46, descartados: 2, ordenos: 40, diasConOrdeno: 10, promedioDia: 12.046, porJornada: {}, mejorDia: { fecha: "2026-10-05", litros: 15.04 }, animalesMax: 4 },
    previo: { tanque: 100, descartados: 0, ordenos: 30, diasConOrdeno: 10, promedioDia: 10, porJornada: {}, mejorDia: null, animalesMax: 3 },
  }),
};
const ctx = (rol, plan = "hacienda") => ({ fincaNombre: "Finca Prueba", rol, plan, hoy: "2026-11-14", moneda: "COP" });
const nombres = (rol, plan) => herramientasPara(ctx(rol, plan), datos).map((h) => h.nombre).sort();

test("herramientas: todos los roles reciben las mismas cuatro, pero cada uno solo ve las áreas de su rol", async () => {
  const todas = ["buscar_animal", "produccion_de_leche", "resumen_de_hoy", "semaforos"];
  for (const rol of ["propietario", "administrador", "veterinario", "ordenador", "contador"]) assert.deepEqual(nombres(rol), todas, rol);
  const prueba = async (rol, area) => {
    const h = herramientasPara(ctx(rol), datos).find((x) => x.nombre === "semaforos");
    return h.ejecutar(h.entrada.parse({ area }));
  };
  await assert.rejects(() => prueba("ordenador", "sanidad"), ErrorHerramienta);
  await assert.rejects(() => prueba("ordenador", "dinero"), ErrorHerramienta);
  await assert.rejects(() => prueba("contador", "reproduccion"), ErrorHerramienta);
  await assert.rejects(() => prueba("veterinario", "dinero"), ErrorHerramienta);
  await assert.doesNotReject(() => prueba("ordenador", "leche"));
  await assert.doesNotReject(() => prueba("contador", "dinero"));
  await assert.doesNotReject(() => prueba("veterinario", "sanidad"));
});

test("herramientas: resumen_de_hoy cuenta por nivel, deja primero lo rojo y recorta los casos", async () => {
  const h = herramientasPara(ctx("propietario"), datos).find((x) => x.nombre === "resumen_de_hoy");
  const r = JSON.parse(await h.ejecutar({}));
  assert.deepEqual(r.conteo, { rojo: 1, ambar: 1, verde: 1 });
  assert.equal(r.pendientes.length, 2, "lo que está en orden no se lista como pendiente");
  assert.equal(r.pendientes[0].nivel, "rojo");
  assert.equal(r.pendientes[0].casos.length, 3);
  assert.equal(r.pendientes[0].casos_total, 5);
  assert.ok(r.pendientes[0].que_hacer && r.pendientes[0].que_significa);
  assert.equal(r.finca, "Finca Prueba");
});

test("herramientas: semaforos filtra por área y nivel, y rechaza un área que el rol no tiene", async () => {
  const h = herramientasPara(ctx("propietario"), datos).find((x) => x.nombre === "semaforos");
  const sanidad = JSON.parse(await h.ejecutar(h.entrada.parse({ area: "sanidad" })));
  assert.equal(sanidad.senales.length, 1);
  const rojas = JSON.parse(await h.ejecutar(h.entrada.parse({ nivel: "rojo" })));
  assert.deepEqual(rojas.senales.map((s) => s.nivel), ["rojo"]);
  const una = JSON.parse(await h.ejecutar(h.entrada.parse({ casos_por_senal: 1 })));
  assert.ok(una.senales.every((s) => s.casos.length <= 1));
  const vet = herramientasPara(ctx("veterinario"), datos).find((x) => x.nombre === "semaforos");
  await assert.rejects(() => vet.ejecutar(vet.entrada.parse({ area: "dinero" })), ErrorHerramienta);
  assert.equal(h.entrada.safeParse({ casos_por_senal: 500 }).success, false);
  assert.equal(h.entrada.safeParse({ area: "inventada" }).success, false);
});

test("herramientas: buscar_animal exige texto corto y leche redondea y compara", async () => {
  const b = herramientasPara(ctx("propietario"), datos).find((x) => x.nombre === "buscar_animal");
  assert.equal(b.entrada.safeParse({ texto: "" }).success, false);
  assert.equal(b.entrada.safeParse({ texto: "x".repeat(41) }).success, false);
  assert.equal(JSON.parse(await b.ejecutar({ texto: "MIR-1" })).animales[0].etiqueta, "Luna · MIR-1");
  const l = herramientasPara(ctx("propietario"), datos).find((x) => x.nombre === "produccion_de_leche");
  assert.equal(l.entrada.safeParse({ dias: 15 }).success, false);
  const r = JSON.parse(await l.ejecutar(l.entrada.parse({})));
  assert.equal(r.litros_tanque, 120.5);
  assert.equal(r.promedio_litros_por_dia, 12);
  assert.equal(r.cambio_frente_al_anterior_pct, 20.5);
  assert.equal(r.mejor_dia.litros, 15);
});

test("herramientas: senalCompacta nunca lleva enlaces internos ni identificadores", () => {
  const c = senalCompacta(SENALES[0], 2);
  assert.ok(!JSON.stringify(c).includes("/x"), "sin href");
  assert.ok(!("id" in c) && !("clave" in c.casos[0]));
});

import { comandoClaudeCode, configClaudeDesktop, configGenerica, nombreValido, rutaMcp } from "../lib/mcp/conexion.ts";

test("conexión: las instrucciones llevan la dirección y el código, y el JSON es válido", () => {
  const t = generarToken();
  const url = rutaMcp("https://apriscol.shop/");
  assert.equal(url, "https://apriscol.shop/api/mcp");
  assert.ok(comandoClaudeCode(url, t).includes(url) && comandoClaudeCode(url, t).includes(`Bearer ${t}`));
  const desktop = JSON.parse(configClaudeDesktop(url, t));
  assert.equal(desktop.mcpServers.apriscol.env.APRISCOL_AUTH, `Bearer ${t}`);
  assert.ok(desktop.mcpServers.apriscol.args.includes(url));
  assert.ok(!desktop.mcpServers.apriscol.args.some((a) => a.includes(t)), "el código va por variable, no en los argumentos");
  assert.equal(JSON.parse(configGenerica(url, t)).mcpServers.apriscol.headers.Authorization, `Bearer ${t}`);
});

test("conexión: el nombre se limpia y se valida", () => {
  assert.equal(nombreValido("  Claude   en mi  PC "), "Claude en mi PC");
  assert.equal(nombreValido("   "), null);
  assert.equal(nombreValido("x".repeat(61)), null);
  assert.equal(nombreValido("x".repeat(60)), "x".repeat(60));
});

import { credencialDeCabecera } from "../lib/mcp/token.ts";
import { cabeceraNoAutorizado, metadatosRecurso, servidorAutorizacion, urlMetadatosRecurso } from "../lib/mcp/oauth.ts";
import { idAutorizacionValido } from "../lib/mcp/consentimiento.ts";

test("credencial: distingue el token personal del acceso de Claude (JWT) y rechaza el resto", () => {
  const t = generarToken();
  assert.deepEqual(credencialDeCabecera(`Bearer ${t}`), { tipo: "token", token: t });
  const jwt = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJl";
  assert.deepEqual(credencialDeCabecera(`Bearer ${jwt}`), { tipo: "oauth", jwt });
  for (const mala of [null, "", jwt, `Basic ${jwt}`, "Bearer abc", "Bearer a.b", "Bearer a.b.c.d", `Bearer ${"a".repeat(5000)}.b.c`, `Bearer ${jwt} extra`]) assert.equal(credencialDeCabecera(mala), null);
});

test("oauth: el descubrimiento apunta al Auth de Supabase y el 401 trae resource_metadata", () => {
  const sitio = "https://apriscol.shop/";
  const supabase = "https://abc.supabase.co/";
  assert.equal(servidorAutorizacion(supabase), "https://abc.supabase.co/auth/v1");
  assert.equal(urlMetadatosRecurso(sitio), "https://apriscol.shop/.well-known/oauth-protected-resource/api/mcp");
  const m = metadatosRecurso(sitio, supabase);
  assert.equal(m.resource, "https://apriscol.shop/api/mcp");
  assert.deepEqual(m.authorization_servers, ["https://abc.supabase.co/auth/v1"]);
  assert.deepEqual(m.bearer_methods_supported, ["header"]);
  const cab = cabeceraNoAutorizado(sitio);
  assert.ok(cab.startsWith("Bearer ") && cab.includes(`resource_metadata="${urlMetadatosRecurso(sitio)}"`));
});

test("consentimiento: solo se aceptan identificadores de solicitud con formato seguro", () => {
  assert.ok(idAutorizacionValido("a1b2c3d4-e5f6-7890-abcd-ef1234567890"));
  for (const malo of [undefined, null, "", "corto", "a".repeat(201), "abc def ghi", "../../etc/passwd", "a1b2c3d4;drop", 5]) assert.equal(idAutorizacionValido(malo), false);
});
