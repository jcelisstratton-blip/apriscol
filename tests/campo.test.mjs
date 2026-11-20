import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  aplicarTecla, coincideBusqueda, enRetiroLeche, enviadosViejos, envioDe, errorFecha, errorLitros, errorPeso, hembrasDelTurno, jornadaDeHora, numeroDeTexto, porEnviar,
  redondearPeso, referenciaValida, referenciaVencida, registrosDe, resultadoEnvio, resumenBandeja, MAX_LITROS, MAX_PESO, RUTA_CAMPO,
} from "../lib/campo.ts";
import { esquemaEnvio, guardarOrdenoCampo, guardarPesoCampo, leerReferenciaCampo, permisosCampo } from "../lib/campo-servidor.ts";
import { ATAJOS } from "../lib/atajos.ts";
import { AYUDA_CAMPO } from "../lib/ayuda.ts";
import { TUTORIALES } from "../lib/tutoriales.ts";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
const HOY = "2026-11-20";
const FINCA = "11111111-1111-4111-8111-111111111111";
const A1 = "22222222-2222-4222-8222-222222222222";
const A2 = "33333333-3333-4333-8333-333333333333";
const MACHO = "44444444-4444-4444-8444-444444444444";
const VENDIDA = "55555555-5555-4555-8555-555555555555";
const U = "66666666-6666-4666-8666-666666666666";
const uuid = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;

// ───────────────────────── Reglas puras ─────────────────────────

test("campo: las mismas validaciones que con señal (fecha, litros y peso)", () => {
  assert.equal(errorFecha(HOY, HOY), null);
  assert.equal(errorFecha("2025-11-20", HOY), null, "hasta un año atrás");
  assert.match(errorFecha("2026-11-21", HOY), /todavía no llega/);
  assert.match(errorFecha("2025-11-19", HOY), /un año/);
  assert.match(errorFecha("20/11/2026", HOY), /no es válida/);
  assert.equal(errorLitros(0), null, "cero litros vale (una hembra que no dio)");
  assert.equal(errorLitros(MAX_LITROS), null);
  assert.match(errorLitros(15.01), /15 litros/);
  assert.match(errorLitros(-1), /Escribe/);
  assert.match(errorLitros(Number.NaN), /Escribe/);
  assert.equal(errorPeso(32.5), null);
  assert.match(errorPeso(0), /Escribe/);
  assert.match(errorPeso(MAX_PESO + 1), /250/);
  assert.equal(redondearPeso(32.46), 32.5);
});

test("campo: el teclado propio respeta el tope y los decimales", () => {
  let t = "";
  for (const k of ["1", ".", "2", "5", "9"]) t = aplicarTecla(t, k, MAX_LITROS, 2);
  assert.equal(t, "1.25", "máximo 2 decimales en litros");
  assert.equal(aplicarTecla("1", "6", MAX_LITROS, 2), "1", "no pasa de 15 L");
  assert.equal(aplicarTecla("", ".", MAX_LITROS, 2), "0.");
  assert.equal(aplicarTecla("0", "7", MAX_LITROS, 2), "7");
  assert.equal(aplicarTecla("32.5", "1", MAX_PESO, 1), "32.5", "un decimal en kilos");
  assert.equal(aplicarTecla("32.5", "borrar", MAX_PESO, 1), "32.");
  assert.equal(numeroDeTexto(""), null);
  assert.equal(numeroDeTexto("."), null);
  assert.equal(numeroDeTexto("0."), 0);
  assert.equal(numeroDeTexto("1.25"), 1.25);
});

test("campo: jornada por la hora, retiro, turnos y búsqueda sin tildes", () => {
  assert.equal(jornadaDeHora(5), "manana");
  assert.equal(jornadaDeHora(12), "tarde");
  assert.equal(jornadaDeHora(19), "noche");
  assert.equal(enRetiroLeche({ retiroLecheHasta: "2026-11-20" }, "2026-11-20"), true, "el último día de retiro todavía se descarta");
  assert.equal(enRetiroLeche({ retiroLecheHasta: "2026-11-20" }, "2026-11-21"), false);
  assert.equal(enRetiroLeche({ retiroLecheHasta: null }, HOY), false);
  const hembras = [
    { id: "a", arete: "101", nombre: "Lucía", turnos: null, retiroLecheHasta: null },
    { id: "b", arete: "102", nombre: "Pía", turnos: ["manana"], retiroLecheHasta: null },
    { id: "c", arete: "103", nombre: null, turnos: [], retiroLecheHasta: null },
  ];
  assert.deepEqual(hembrasDelTurno(hembras, "tarde", new Set()).map((h) => h.id), ["a"], "sin programar = todas las jornadas");
  assert.deepEqual(hembrasDelTurno(hembras, "manana", new Set()).map((h) => h.id), ["a", "b"]);
  assert.deepEqual(hembrasDelTurno(hembras, "tarde", new Set(["c"])).map((h) => h.id), ["a", "c"], "con registro aparece aunque no esté programada");
  assert.ok(coincideBusqueda(hembras[0], "lucia"));
  assert.ok(coincideBusqueda(hembras[1], " 10"));
  assert.ok(!coincideBusqueda(hembras[2], "pía"));
});

const registro = (extra) => ({ id: uuid(1), tipo: "ordeno", usuarioId: U, fincaId: FINCA, animalId: A1, etiqueta: "101", fecha: HOY, jornada: "manana", litros: 1.2, descartar: false, creadoEn: "2026-11-20T10:00:00.000Z", estado: "pendiente", intentos: 0, ...extra });

test("campo: la bandeja muestra el último registro de cada animal y cuenta lo de cada cuenta", () => {
  const rs = [
    registro({ id: uuid(1), litros: 1, creadoEn: "2026-11-20T10:00:00Z" }),
    registro({ id: uuid(2), litros: 1.5, creadoEn: "2026-11-20T10:05:00Z" }),
    registro({ id: uuid(3), animalId: A2, jornada: "tarde" }),
    registro({ id: uuid(4), usuarioId: "otra", estado: "pendiente" }),
    registro({ id: uuid(5), tipo: "peso", jornada: undefined, peso: 30, estado: "error", error: "x" }),
    registro({ id: uuid(6), animalId: A2, estado: "enviado", enviadoEn: "2026-11-15T10:00:00Z" }),
  ];
  const mapa = registrosDe(rs, { tipo: "ordeno", fincaId: FINCA, usuarioId: U, fecha: HOY, jornada: "manana" });
  assert.equal(mapa.get(A1).litros, 1.5, "el más reciente");
  assert.equal(mapa.get(A2).estado, "enviado");
  assert.equal(registrosDe(rs, { tipo: "peso", fincaId: FINCA, usuarioId: U, fecha: HOY }).get(A1).peso, 30);
  assert.deepEqual(resumenBandeja(rs, U), { porEnviar: 3, conError: 1, deOtraCuenta: 1 });
  assert.deepEqual(porEnviar(rs, U).map((r) => r.id), [uuid(1), uuid(3), uuid(2)].sort((a, b) => rs.find((x) => x.id === a).creadoEn.localeCompare(rs.find((x) => x.id === b).creadoEn)), "lo más viejo primero; nunca el de otra cuenta ni el que tiene error");
  assert.ok(!porEnviar(rs, U).some((r) => r.usuarioId !== U || r.estado === "error"));
  assert.deepEqual(enviadosViejos(rs, new Date("2026-11-20T12:00:00Z")).map((r) => r.id), [uuid(6)], "lo enviado hace más de 3 días se borra del celular");
  assert.deepEqual(envioDe(registro({ etiqueta: "no viaja", estado: "error" })), { tipo: "ordeno", id: uuid(1), fincaId: FINCA, animalId: A1, fecha: HOY, jornada: "manana", litros: 1.2, descartar: false });
});

test("campo: qué hacer con cada respuesta del servidor", () => {
  assert.deepEqual(resultadoEnvio(200, { ok: true, estado: "guardado" }), { estado: "enviado" });
  assert.deepEqual(resultadoEnvio(200, { ok: true, estado: "ya_estaba" }), { estado: "enviado" }, "reenviar lo que ya llegó no es un error");
  assert.deepEqual(resultadoEnvio(0, null), { estado: "pendiente", sesion: false }, "sin red: se queda y se reintenta");
  assert.deepEqual(resultadoEnvio(503, null), { estado: "pendiente", sesion: false });
  assert.deepEqual(resultadoEnvio(401, null), { estado: "pendiente", sesion: true }, "sesión vencida: se queda hasta que entre");
  assert.deepEqual(resultadoEnvio(409, { ok: false, codigo: "conflicto", error: "Ya había 1,2 L" }), { estado: "error", error: "Ya había 1,2 L" });
  assert.deepEqual(resultadoEnvio(422, { ok: false }), { estado: "error", error: "No se pudo guardar este registro." });
  assert.deepEqual(resultadoEnvio(403, "texto"), { estado: "error", error: "No se pudo guardar este registro." });
});

test("campo: la copia de la finca se descarta si es vieja o está dañada", () => {
  const ref = { version: 1, generadaEn: "2026-11-20T10:00:00Z", hoy: HOY, usuario: { id: U }, finca: { id: FINCA, nombre: "La Esperanza" }, puede: { leche: true, pesos: true }, ordeno: [], pesar: [] };
  assert.equal(referenciaValida(ref), ref);
  for (const malo of [null, "x", { ...ref, version: 2 }, { ...ref, ordeno: null }, { ...ref, usuario: {} }]) assert.equal(referenciaValida(malo), null);
  assert.equal(referenciaVencida(ref, new Date("2026-11-20T10:10:00Z")), false);
  assert.equal(referenciaVencida(ref, new Date("2026-11-20T10:16:00Z")), true);
  assert.equal(referenciaVencida(null, new Date()), true);
});

test("campo: permisos por rol (los mismos módulos que con señal)", () => {
  assert.deepEqual(permisosCampo("propietario", "hacienda"), { leche: true, pesos: true });
  assert.deepEqual(permisosCampo("ordenador", "hacienda"), { leche: true, pesos: false });
  assert.deepEqual(permisosCampo("contador", "hacienda"), { leche: false, pesos: false });
});

// ───────────────────────── Servidor con una base falsa ─────────────────────────

/**
 * Una base de mentira con lo que usa `lib/campo-servidor.ts`: select con eq/is/in/order/range/limit, maybeSingle, insert con las
 * restricciones únicas reales (`ordenos (animal_id, fecha, jornada)`, `pesajes (animal_id, fecha)` y `client_request_id` por finca) y rpc.
 */
function baseFalsa(tablas, rpcs = {}, { antesDeInsertar } = {}) {
  const unicas = {
    ordenos: [["animal_id", "fecha", "jornada"], ["finca_id", "client_request_id"]],
    pesajes: [["animal_id", "fecha"], ["finca_id", "client_request_id"]],
  };
  const consulta = (tabla) => {
    const filtros = [];
    let rango = null;
    const obtener = () => {
      let filas = (tablas[tabla] ?? []).filter((f) => filtros.every((fn) => fn(f)));
      if (rango) filas = filas.slice(rango[0], rango[1] + 1);
      return filas;
    };
    const q = {
      select: () => q,
      eq: (c, v) => (filtros.push((f) => f[c] === v), q),
      is: (c, v) => (filtros.push((f) => (f[c] ?? null) === v), q),
      in: (c, vs) => (filtros.push((f) => vs.includes(f[c])), q),
      order: () => q,
      limit: () => q,
      range: (d, h) => ((rango = [d, h]), q),
      maybeSingle: async () => ({ data: obtener()[0] ?? null, error: null }),
      then: (ok, mal) => Promise.resolve({ data: obtener(), error: null }).then(ok, mal),
      insert: async (fila) => {
        await antesDeInsertar?.(tabla, fila);
        for (const cols of unicas[tabla] ?? []) {
          if (cols.some((c) => fila[c] == null)) continue;
          if ((tablas[tabla] ?? []).some((f) => cols.every((c) => f[c] === fila[c]))) return { error: { code: "23505", message: `duplicate key value violates unique constraint "${tabla}_${cols.join("_")}"` } };
        }
        (tablas[tabla] ??= []).push({ ...fila });
        return { error: null };
      },
    };
    return q;
  };
  return { from: consulta, rpc: async (nombre) => ({ data: rpcs[nombre] ?? [], error: null }), tablas };
}

const animales = () => [
  { id: A1, finca_id: FINCA, numero_arete: "101", nombre: "Lucía", sexo: "hembra", estado: "activo", deleted_at: null, turnos_ordeno: null, uso_macho: null },
  { id: A2, finca_id: FINCA, numero_arete: "102", nombre: null, sexo: "hembra", estado: "activo", deleted_at: null, turnos_ordeno: ["manana"], uso_macho: null },
  { id: MACHO, finca_id: FINCA, numero_arete: "200", nombre: "Toro", sexo: "macho", estado: "activo", deleted_at: null, turnos_ordeno: null, uso_macho: "carne", lote_ceba_id: null },
  { id: VENDIDA, finca_id: FINCA, numero_arete: "300", nombre: null, sexo: "hembra", estado: "vendido", deleted_at: null, turnos_ordeno: null, uso_macho: null },
];
const ordeno = (extra = {}) => ({ tipo: "ordeno", id: uuid(10), fincaId: FINCA, animalId: A1, fecha: HOY, jornada: "manana", litros: 1.4, descartar: false, ...extra });
const peso = (extra = {}) => ({ tipo: "peso", id: uuid(20), fincaId: FINCA, animalId: MACHO, fecha: HOY, peso: 32.46, ...extra });

test("servidor: un ordeño nuevo se guarda con su identificador; reenviarlo no duplica", async () => {
  const db = baseFalsa({ animales: animales(), ordenos: [] });
  assert.deepEqual(await guardarOrdenoCampo(db, ordeno(), HOY), { ok: true, estado: "guardado" });
  assert.deepEqual(await guardarOrdenoCampo(db, ordeno(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.ordenos.length, 1);
  assert.equal(db.tablas.ordenos[0].client_request_id, uuid(10));
  assert.equal(db.tablas.ordenos[0].motivo_descarte, null);
  await guardarOrdenoCampo(db, ordeno({ id: uuid(11), jornada: "tarde", descartar: true }), HOY);
  assert.equal(db.tablas.ordenos[1].motivo_descarte, "otro", "leche descartada a mano");
});

test("servidor: nunca pisa un ordeño que otra persona ya registró en esa jornada", async () => {
  const db = baseFalsa({ animales: animales(), ordenos: [{ finca_id: FINCA, animal_id: A1, fecha: HOY, jornada: "manana", litros: 1.5, client_request_id: null }] });
  const r = await guardarOrdenoCampo(db, ordeno(), HOY);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /Ya había 1,5 L de 101/);
  assert.equal(db.tablas.ordenos.length, 1);
  assert.equal(db.tablas.ordenos[0].litros, 1.5, "el dato que estaba no cambia");
});

test("servidor: dos envíos a la vez del mismo ordeño quedan en uno (el segundo ve el del primero)", async () => {
  let colado = false;
  const db = baseFalsa({ animales: animales(), ordenos: [] }, {}, {
    antesDeInsertar: (tabla, fila) => {
      // Otro envío idéntico entra justo entre la revisión y el insert.
      if (!colado && tabla === "ordenos") {
        colado = true;
        db.tablas.ordenos.push({ ...fila });
      }
    },
  });
  assert.deepEqual(await guardarOrdenoCampo(db, ordeno(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.ordenos.length, 1);
});

test("servidor: rechaza el ordeño de un macho, de un animal que salió del hato, de otra finca o fuera de fecha", async () => {
  const db = baseFalsa({ animales: animales(), ordenos: [] });
  assert.match((await guardarOrdenoCampo(db, ordeno({ animalId: MACHO }), HOY)).error, /200 es macho/);
  assert.match((await guardarOrdenoCampo(db, ordeno({ animalId: VENDIDA }), HOY)).error, /300 ya salió del hato/);
  assert.match((await guardarOrdenoCampo(db, ordeno({ fincaId: uuid(99) }), HOY)).error, /ya no está en esta finca/);
  assert.match((await guardarOrdenoCampo(db, ordeno({ fecha: "2026-11-21" }), HOY)).error, /todavía no llega/);
  assert.match((await guardarOrdenoCampo(db, ordeno({ litros: 20 }), HOY)).error, /15 litros/);
  assert.equal(db.tablas.ordenos.length, 0);
});

test("servidor: un peso se guarda redondeado; un segundo peso de otro aparato el mismo día no lo pisa", async () => {
  const db = baseFalsa({ animales: animales(), pesajes: [] });
  assert.deepEqual(await guardarPesoCampo(db, peso(), HOY), { ok: true, estado: "guardado" });
  assert.equal(db.tablas.pesajes[0].peso_kg, 32.5);
  assert.deepEqual(await guardarPesoCampo(db, peso(), HOY), { ok: true, estado: "ya_estaba" });
  const otro = await guardarPesoCampo(db, peso({ id: uuid(21), peso: 40 }), HOY);
  assert.equal(otro.codigo, "conflicto");
  assert.match(otro.error, /200 ya tenía un peso ese día \(32,5 kg\)/);
  assert.equal(db.tablas.pesajes.length, 1);
  assert.match((await guardarPesoCampo(db, peso({ id: uuid(22), animalId: VENDIDA }), HOY)).error, /ya salió del hato/);
  assert.match((await guardarPesoCampo(db, peso({ id: uuid(23), peso: 300 }), HOY)).error, /250/);
});

test("servidor: lo que llega del celular se valida antes de tocar la base", () => {
  assert.ok(esquemaEnvio.safeParse(ordeno()).success);
  assert.ok(esquemaEnvio.safeParse(peso()).success);
  assert.ok(!esquemaEnvio.safeParse({ ...ordeno(), jornada: "unico" }).success, "la jornada «único» no se captura en el campo");
  assert.ok(!esquemaEnvio.safeParse({ ...ordeno(), id: "no-es-uuid" }).success);
  assert.ok(!esquemaEnvio.safeParse({ ...peso(), tipo: "parto" }).success);
  assert.ok(!esquemaEnvio.safeParse({ ...ordeno(), litros: "1,2" }).success);
});

test("servidor: la copia de la finca lleva solo lo indispensable, según lo que la persona puede registrar", async () => {
  const lactancias = [
    { id: "l1", finca_id: FINCA, animal_id: A1, fecha_secado: null },
    { id: "l2", finca_id: FINCA, animal_id: A2, fecha_secado: null },
    { id: "l3", finca_id: FINCA, animal_id: VENDIDA, fecha_secado: null },
  ];
  const rpcs = {
    animales_en_retiro: [{ animal_id: A2, retiro_leche_hasta: "2026-11-22", retiro_carne_hasta: null }],
    ceba_animales: [{ animal_id: A1, lote_id: null, n_pesajes: 2, fecha_ultimo: "2026-11-01", peso_ultimo: 41.2 }],
  };
  const db = baseFalsa({ animales: animales(), lactancias, lotes_ceba: [] }, rpcs);
  const ctx = (rol) => ({ usuarioId: U, finca: { id: FINCA, nombre: "La Esperanza", plan: "hacienda" }, rol });
  const ref = await leerReferenciaCampo(db, ctx("propietario"), HOY, new Date("2026-11-20T15:00:00Z"));
  assert.equal(ref.generadaEn, "2026-11-20T15:00:00.000Z");
  assert.deepEqual(ref.usuario, { id: U });
  assert.deepEqual(ref.finca, { id: FINCA, nombre: "La Esperanza" });
  assert.deepEqual(ref.ordeno, [
    { id: A1, arete: "101", nombre: "Lucía", turnos: null, retiroLecheHasta: null },
    { id: A2, arete: "102", nombre: null, turnos: ["manana"], retiroLecheHasta: "2026-11-22" },
  ], "solo hembras activas con lactancia abierta");
  assert.deepEqual(ref.pesar.map((a) => [a.arete, a.ceba]), [["101", true], ["200", true], ["102", false]], "los de ceba primero; ningún animal que ya salió");
  assert.equal(ref.pesar[0].ultimoPeso, 41.2);
  assert.deepEqual(Object.keys(ref.ordeno[0]).sort(), ["arete", "id", "nombre", "retiroLecheHasta", "turnos"], "nada más que lo indispensable");

  const ordenador = await leerReferenciaCampo(db, ctx("ordenador"), HOY);
  assert.deepEqual(ordenador.puede, { leche: true, pesos: false });
  assert.equal(ordenador.ordeno.length, 2);
  assert.deepEqual(ordenador.pesar, [], "quien no pesa no se lleva la lista del hato");
});

// ───────────────────────── Conexiones ─────────────────────────

test("campo: la pantalla, las rutas, el respaldo con señal, la ayuda y los atajos están conectados", () => {
  assert.equal(RUTA_CAMPO, "/campo");
  assert.ok(existsSync(new URL("../app/campo/page.tsx", import.meta.url)));
  assert.match(leer("app/campo/page.tsx"), /force-static/, "la página es estática: igual para todos y guardable");
  assert.doesNotMatch(leer("app/campo/page.tsx"), /obtenerContexto|crearClienteServidor|cookies/, "no lee la sesión en el servidor");
  for (const r of ["app/api/campo/referencia/route.ts", "app/api/campo/enviar/route.ts"]) assert.ok(existsSync(new URL(`../${r}`, import.meta.url)), r);
  const enviar = leer("app/api/campo/enviar/route.ts");
  assert.match(enviar, /getClaims/, "exige sesión");
  assert.match(enviar, /finca_miembros/, "comprueba la finca del registro, no la activa");
  assert.match(enviar, /origin/, "solo desde la propia app");
  assert.match(leer("components/CapturaLeche.tsx"), /esFallaDeRed\(e\)[\s\S]*guardarEnCelular\(\{ id: solicitud/, "la captura de leche guarda en el celular con el mismo identificador");
  assert.match(leer("components/CebaPesar.tsx"), /esFallaDeRed\(e\)[\s\S]*guardarEnCelular/);
  assert.match(leer("app/(app)/layout.tsx"), /<MotorCampo usuarioId=\{user\.id\} fincaId=\{finca\.id\} \/>/);
  assert.match(leer("app/login/actions.ts"), /redirect\("\/login\?salio=1"\)/, "al cerrar sesión se borra la copia de la finca");
  assert.match(leer("app/login/page.tsx"), /salio \? <LimpiarCampo \/>/);
  assert.match(leer("public/offline.html"), /href="\/campo"/);
  assert.match(leer("app/manifest.ts"), /url: "\/campo"/);
  const atajo = ATAJOS.find((a) => a.href === "/campo");
  assert.ok(atajo, "«Registrar sin señal» está en «Al grano»");
  assert.equal(atajo.modulo, "leche");
  assert.ok(TUTORIALES.some((t) => t.numero === AYUDA_CAMPO.tutorial && t.youtube), "el tutorial de la ayuda existe");
  assert.notEqual(AYUDA_CAMPO.enlace.href, "/campo");
  assert.ok(existsSync(new URL(`../app/(app)${AYUDA_CAMPO.enlace.href}/page.tsx`, import.meta.url)));
  for (const p of AYUDA_CAMPO.puntos) assert.doesNotMatch(p.texto, /IndexedDB|service worker|API|sincroniz/i, "nada técnico a las personas");
});
