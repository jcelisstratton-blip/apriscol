import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  aplicarTecla, coincideBusqueda, enRetiroLeche, enviadosViejos, envioDe, errorFecha, errorLitros, errorPeso, hembrasDelTurno, jornadaDeHora, numeroDeTexto, porEnviar,
  redondearPeso, referenciaValida, referenciaVencida, registrosDe, resultadoEnvio, resumenBandeja, MAX_LITROS, MAX_PESO, RUTA_CAMPO,
  hembrasParaDiagnostico, machosPara, nombreMachoExterno, areteClave, areteRepetido, padresPosibles,
} from "../lib/campo.ts";
import { esquemaAnimal, prepararAnimalNuevo } from "../lib/animal-nuevo.ts";
import { esquemaEnvio, guardarAnimalCampo, guardarDiagnosticoCampo, guardarMontaCampo, guardarOrdenoCampo, guardarPesoCampo, leerReferenciaCampo, permisosCampo } from "../lib/campo-servidor.ts";
import { reglasDiagnostico } from "../lib/diagnostico-reglas.ts";
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

test("campo: la copia de la finca se descarta si es vieja o está dañada; las de versiones anteriores siguen sirviendo para lo que traían", () => {
  const ref = {
    version: 3, generadaEn: "2026-11-20T10:00:00Z", hoy: HOY, usuario: { id: U }, finca: { id: FINCA, nombre: "La Esperanza" },
    puede: { leche: true, pesos: true, reproduccion: true, hato: true }, ordeno: [], pesar: [], hembras: [], machos: [],
    especies: ["caprino"], proposito: "leche", razas: [], animales: [],
  };
  assert.deepEqual(referenciaValida(ref), ref);
  for (const malo of [null, "x", { ...ref, version: 4 }, { ...ref, ordeno: null }, { ...ref, usuario: {} }, { ...ref, hembras: undefined }, { ...ref, animales: undefined }]) assert.equal(referenciaValida(malo), null);
  const extra = { especies: [], proposito: "leche", razas: [], animales: [] };
  const v1 = { version: 1, generadaEn: ref.generadaEn, hoy: HOY, usuario: { id: U }, finca: ref.finca, puede: { leche: true, pesos: false }, ordeno: [], pesar: [] };
  assert.deepEqual(referenciaValida(v1), { ...v1, version: 3, puede: { leche: true, pesos: false, reproduccion: false, hato: false }, hembras: [], machos: [], ...extra });
  const v2 = { ...v1, version: 2, puede: { leche: true, pesos: true, reproduccion: true }, hembras: [], machos: [] };
  assert.deepEqual(referenciaValida(v2), { ...v2, version: 3, puede: { leche: true, pesos: true, reproduccion: true, hato: false }, ...extra });
  assert.equal(referenciaVencida(ref, new Date("2026-11-20T10:10:00Z")), false);
  assert.equal(referenciaVencida(ref, new Date("2026-11-20T10:16:00Z")), true);
  assert.equal(referenciaVencida(null, new Date()), true);
});

test("campo: permisos por rol (los mismos módulos que con señal)", () => {
  assert.deepEqual(permisosCampo("propietario", "hacienda"), { leche: true, pesos: true, reproduccion: true, hato: true });
  assert.deepEqual(permisosCampo("administrador", "hacienda"), { leche: true, pesos: true, reproduccion: true, hato: true });
  assert.deepEqual(permisosCampo("ordenador", "hacienda"), { leche: true, pesos: false, reproduccion: false, hato: false });
  assert.deepEqual(permisosCampo("veterinario", "hacienda"), { leche: false, pesos: false, reproduccion: true, hato: false });
  assert.deepEqual(permisosCampo("contador", "hacienda"), { leche: false, pesos: false, reproduccion: false, hato: false });
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
    servicios: [["finca_id", "client_request_id"]],
    diagnosticos_gestacion: [["finca_id", "client_request_id"]],
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
  const rpc = async (nombre, args) => (typeof rpcs[nombre] === "function" ? rpcs[nombre](args, tablas) : { data: rpcs[nombre] ?? [], error: null });
  return { from: consulta, rpc, tablas };
}

const OVEJO = "77777777-7777-4777-8777-777777777777";
const animales = () => [
  { id: A1, finca_id: FINCA, numero_arete: "101", nombre: "Lucía", sexo: "hembra", especie: "caprino", fecha_nacimiento: "2026-01-10", estado: "activo", deleted_at: null, turnos_ordeno: null, uso_macho: null },
  { id: A2, finca_id: FINCA, numero_arete: "102", nombre: null, sexo: "hembra", especie: "caprino", fecha_nacimiento: null, estado: "activo", deleted_at: null, turnos_ordeno: ["manana"], uso_macho: null },
  { id: MACHO, finca_id: FINCA, numero_arete: "200", nombre: "Toro", sexo: "macho", especie: "caprino", fecha_nacimiento: "2022-05-01", estado: "activo", deleted_at: null, turnos_ordeno: null, uso_macho: "carne", lote_ceba_id: null },
  { id: VENDIDA, finca_id: FINCA, numero_arete: "300", nombre: null, sexo: "hembra", especie: "caprino", fecha_nacimiento: null, estado: "vendido", deleted_at: null, turnos_ordeno: null, uso_macho: null },
  { id: OVEJO, finca_id: FINCA, numero_arete: "400", nombre: "Carnero", sexo: "macho", especie: "ovino", fecha_nacimiento: null, estado: "activo", deleted_at: null, turnos_ordeno: null, uso_macho: "reproductor", lote_ceba_id: null },
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
  const v_repro_hembras = [{ finca_id: FINCA, animal_id: A1, estado: "servida", ultimo_servicio: "2026-10-01" }, { finca_id: FINCA, animal_id: A2, estado: "vacia", ultimo_servicio: null }];
  const razas = [{ id: 1, especie: "caprino", nombre: "Saanen", cobertura: null }, { id: 2, especie: "ovino", nombre: "Katahdin", cobertura: "pelo" }];
  const db = baseFalsa({ animales: animales(), lactancias, lotes_ceba: [], v_repro_hembras, razas }, rpcs);
  const ctx = (rol) => ({ usuarioId: U, finca: { id: FINCA, nombre: "La Esperanza", plan: "hacienda", especies: ["caprino", "ovino"], proposito: "leche" }, rol });
  const ref = await leerReferenciaCampo(db, ctx("propietario"), HOY, new Date("2026-11-20T15:00:00Z"));
  assert.equal(ref.generadaEn, "2026-11-20T15:00:00.000Z");
  assert.deepEqual(ref.usuario, { id: U });
  assert.deepEqual(ref.finca, { id: FINCA, nombre: "La Esperanza" });
  assert.deepEqual(ref.ordeno, [
    { id: A1, arete: "101", nombre: "Lucía", turnos: null, retiroLecheHasta: null },
    { id: A2, arete: "102", nombre: null, turnos: ["manana"], retiroLecheHasta: "2026-11-22" },
  ], "solo hembras activas con lactancia abierta");
  assert.deepEqual(ref.pesar.map((a) => [a.arete, a.ceba]), [["101", true], ["200", true], ["102", false], ["400", false]], "los de ceba primero; ningún animal que ya salió");
  assert.deepEqual(ref.hembras, [
    { id: A1, arete: "101", nombre: "Lucía", especie: "caprino", nacimiento: "2026-01-10", estado: "servida", ultimoServicio: "2026-10-01" },
    { id: A2, arete: "102", nombre: null, especie: "caprino", nacimiento: null, estado: "vacia", ultimoServicio: null },
  ], "solo hembras activas, con su estado reproductivo");
  assert.deepEqual(ref.machos.map((m) => [m.arete, m.especie]), [["200", "caprino"], ["400", "ovino"]]);
  assert.equal(ref.pesar[0].ultimoPeso, 41.2);
  assert.deepEqual(Object.keys(ref.ordeno[0]).sort(), ["arete", "id", "nombre", "retiroLecheHasta", "turnos"], "nada más que lo indispensable");
  assert.deepEqual(ref.especies, ["caprino", "ovino"]);
  assert.equal(ref.proposito, "leche");
  assert.deepEqual(ref.razas.map((r) => r.nombre), ["Saanen", "Katahdin"]);
  assert.deepEqual(ref.animales.map((a) => [a.arete, a.activo]), [["101", true], ["102", true], ["200", true], ["300", false], ["400", true]], "para padre y madre y el arete: también los que salieron");
  assert.deepEqual(Object.keys(ref.animales[0]).sort(), ["activo", "arete", "especie", "id", "nombre", "sexo"]);

  const ordenador = await leerReferenciaCampo(db, ctx("ordenador"), HOY);
  assert.deepEqual(ordenador.puede, { leche: true, pesos: false, reproduccion: false, hato: false });
  assert.deepEqual([ordenador.especies, ordenador.razas, ordenador.animales], [[], [], []], "quien no crea animales no se lleva el hato ni las razas");
  assert.equal(ordenador.ordeno.length, 2);
  assert.deepEqual(ordenador.pesar, [], "quien no pesa no se lleva la lista del hato");
  assert.deepEqual([ordenador.hembras, ordenador.machos], [[], []], "quien no registra reproducción no se lleva hembras ni reproductores");
  const vet = await leerReferenciaCampo(db, ctx("veterinario"), HOY);
  assert.deepEqual(vet.puede, { leche: false, pesos: false, reproduccion: true, hato: false });
  assert.deepEqual([vet.ordeno, vet.pesar], [[], []]);
  assert.equal(vet.hembras.length, 2);
});

// ───────────────────────── Monta y diagnóstico ─────────────────────────

test("reproducción: ayudas puras de la monta y el diagnóstico", () => {
  assert.equal(nombreMachoExterno("  Toro   del  vecino "), "Toro del vecino");
  assert.equal(nombreMachoExterno("   "), null);
  assert.equal(nombreMachoExterno("x".repeat(100)).length, 80);
  const machos = [{ id: "m1", arete: "1", nombre: null, especie: "caprino" }, { id: "m2", arete: "2", nombre: null, especie: "ovino" }];
  assert.deepEqual(machosPara(machos, "ovino").map((m) => m.id), ["m2"]);
  const h = (id, arete, estado) => ({ id, arete, nombre: null, especie: "caprino", nacimiento: null, estado, ultimoServicio: null });
  assert.deepEqual(hembrasParaDiagnostico([h("a", "3", "vacia"), h("b", "2", "servida"), h("c", "1", "gestante"), h("d", "10", "servida")]).map((x) => x.id), ["b", "d", "c", "a"], "las servidas primero, luego por arete");
  const monta = registro({ tipo: "monta", jornada: undefined, litros: undefined, machoId: MACHO, machoExterno: null, machoEtiqueta: "200 · Toro" });
  assert.deepEqual(envioDe(monta), { tipo: "monta", id: uuid(1), fincaId: FINCA, animalId: A1, fecha: HOY, machoId: MACHO, machoExterno: null });
  const dx = registro({ tipo: "diagnostico", jornada: undefined, litros: undefined, diagnostico: { metodo: "palpacion", resultado: "vacia", indicador: "retorno_celo", condicion: 2.5 } });
  assert.deepEqual(envioDe(dx), { tipo: "diagnostico", id: uuid(1), fincaId: FINCA, animalId: A1, fecha: HOY, metodo: "palpacion", resultado: "vacia", indicador: "retorno_celo", condicion: 2.5 });
});

test("reproducción: las reglas del diagnóstico son las de la ficha (una sola definición)", () => {
  const ok = (d, s = "2026-10-01") => "propios" in reglasDiagnostico({ fecha: HOY, ...d }, s);
  const err = (d, s = "2026-10-01") => reglasDiagnostico({ fecha: HOY, ...d }, s).error;
  assert.ok(ok({ metodo: "ecografia", resultado: "vacia" }));
  assert.deepEqual(reglasDiagnostico({ fecha: HOY, metodo: "ecografia", resultado: "vacia", dias_gestacion: 40 }, "2026-10-01").propios.dias_gestacion, null, "una vacía no guarda datos de ecografía");
  assert.match(err({ metodo: "ecografia", resultado: "gestante" }), /días de gestación/);
  assert.match(err({ metodo: "ecografia", resultado: "gestante", dias_gestacion: 40, num_fetos: 1, viabilidad_fetal: "sin_actividad" }), /Sin actividad/);
  assert.ok(ok({ metodo: "ecografia", resultado: "gestante", dias_gestacion: 45, num_fetos: 2, viabilidad_fetal: "latido" }));
  assert.match(err({ metodo: "ecografia", resultado: "gestante", dias_gestacion: 90, num_fetos: 1, viabilidad_fetal: "latido" }), /hace 50 días/);
  assert.match(err({ metodo: "palpacion", resultado: "gestante" }), /indicador/);
  assert.match(err({ metodo: "palpacion", resultado: "gestante", indicador_palpacion: "retorno_celo" }), /volvió a celo/);
  assert.match(err({ metodo: "palpacion", resultado: "vacia", indicador_palpacion: "retorno_celo" }), /condición corporal/);
  assert.ok(ok({ metodo: "palpacion", resultado: "vacia", indicador_palpacion: "retorno_celo", condicion_corporal: 2.5 }));
  assert.match(err({ metodo: "palpacion", resultado: "dudoso", indicador_palpacion: "llenado_uterino" }, "2026-11-21"), /anterior al servicio/);
  assert.match(err({ metodo: "otro", resultado: "gestante" }), /prueba/);
  assert.match(leer("app/(app)/reproduccion/actions.ts"), /reglasDiagnostico\(/, "la ficha usa las mismas reglas");
});

const monta = (extra = {}) => ({ tipo: "monta", id: uuid(30), fincaId: FINCA, animalId: A1, fecha: HOY, machoId: MACHO, machoExterno: null, ...extra });

test("servidor: una monta se guarda como servicio por monta natural; reenviarla no duplica", async () => {
  const db = baseFalsa({ animales: animales(), servicios: [] });
  assert.deepEqual(await guardarMontaCampo(db, monta(), HOY), { ok: true, estado: "guardado" });
  assert.deepEqual(await guardarMontaCampo(db, monta(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.servicios.length, 1);
  assert.deepEqual(
    (({ tipo, macho_id, macho_externo, hembra_id, client_request_id }) => ({ tipo, macho_id, macho_externo, hembra_id, client_request_id }))(db.tablas.servicios[0]),
    { tipo: "monta_natural", macho_id: MACHO, macho_externo: null, hembra_id: A1, client_request_id: uuid(30) },
  );
  assert.deepEqual(await guardarMontaCampo(db, monta({ id: uuid(31), animalId: A2, machoId: null, machoExterno: "Toro del vecino" }), HOY), { ok: true, estado: "guardado" });
  assert.equal(db.tablas.servicios[1].macho_externo, "Toro del vecino");
});

test("servidor: no agrega una segunda monta si otra persona ya registró un servicio de esa hembra ese día", async () => {
  const db = baseFalsa({ animales: animales(), servicios: [{ finca_id: FINCA, hembra_id: A1, fecha: HOY, tipo: "inseminacion", client_request_id: null }] });
  const r = await guardarMontaCampo(db, monta(), HOY);
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /101 ya tenía un servicio registrado ese día/);
  assert.equal(db.tablas.servicios.length, 1);
});

test("servidor: rechaza la monta sin reproductor, con dos, de otra especie, sobre un macho, una vendida o antes de nacer", async () => {
  const db = baseFalsa({ animales: animales(), servicios: [] });
  assert.match((await guardarMontaCampo(db, monta({ machoId: null }), HOY)).error, /Elige el reproductor/);
  assert.match((await guardarMontaCampo(db, monta({ machoExterno: "Otro" }), HOY)).error, /no los dos/);
  assert.match((await guardarMontaCampo(db, monta({ machoId: OVEJO }), HOY)).error, /misma especie/);
  assert.match((await guardarMontaCampo(db, monta({ machoId: A2 }), HOY)).error, /macho de tu hato/);
  assert.match((await guardarMontaCampo(db, monta({ animalId: MACHO }), HOY)).error, /200 es macho/);
  assert.match((await guardarMontaCampo(db, monta({ animalId: VENDIDA }), HOY)).error, /300 ya salió del hato/);
  assert.match((await guardarMontaCampo(db, monta({ fecha: "2026-01-10" }), HOY)).error, /posterior al nacimiento/);
  assert.equal(db.tablas.servicios.length, 0);
});

const SERV = "88888888-8888-4888-8888-888888888888";
const diagnostico = (extra = {}) => ({ tipo: "diagnostico", id: uuid(40), fincaId: FINCA, animalId: A1, fecha: HOY, metodo: "palpacion", resultado: "gestante", indicador: "ausencia_celo", condicion: null, ...extra });
const conServicio = (extra = {}) => ({
  animales: animales(),
  servicios: [{ id: SERV, finca_id: FINCA, hembra_id: A1, fecha: "2026-10-01", tipo: "monta_natural", client_request_id: null }],
  partos: [],
  diagnosticos_gestacion: [],
  ...extra,
});

test("servidor: un diagnóstico se cuelga del servicio vigente (lo elige el servidor) y reenviarlo no duplica", async () => {
  const db = baseFalsa(conServicio());
  assert.deepEqual(await guardarDiagnosticoCampo(db, diagnostico(), HOY), { ok: true, estado: "guardado" });
  const fila = db.tablas.diagnosticos_gestacion[0];
  assert.equal(fila.servicio_id, SERV);
  assert.equal(fila.indicador_palpacion, "ausencia_celo");
  assert.equal(fila.dias_gestacion, null, "la palpación no guarda datos de ecografía");
  assert.equal(fila.client_request_id, uuid(40));
  assert.deepEqual(await guardarDiagnosticoCampo(db, diagnostico(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.diagnosticos_gestacion.length, 1);
});

test("servidor: no agrega un segundo diagnóstico del mismo servicio ese día", async () => {
  const db = baseFalsa(conServicio({ diagnosticos_gestacion: [{ finca_id: FINCA, hembra_id: A1, servicio_id: SERV, fecha: HOY, resultado: "dudoso", client_request_id: null }] }));
  const r = await guardarDiagnosticoCampo(db, diagnostico(), HOY);
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /101 ya tenía un diagnóstico el 20 de nov.*Dudoso/);
  assert.equal(db.tablas.diagnosticos_gestacion.length, 1);
});

test("servidor: rechaza el diagnóstico sin servicio vigente, con un ciclo ya cerrado en «vacía» o que rompe las reglas", async () => {
  const sin = baseFalsa(conServicio({ servicios: [] }));
  assert.match((await guardarDiagnosticoCampo(sin, diagnostico(), HOY)).error, /101: .*no tiene un servicio activo/);
  const parida = baseFalsa(conServicio({ partos: [{ finca_id: FINCA, madre_id: A1, fecha: "2026-11-01" }] }));
  assert.match((await guardarDiagnosticoCampo(parida, diagnostico(), HOY)).error, /no tiene un servicio activo/, "un parto después del servicio cierra el ciclo");
  const vacia = baseFalsa(conServicio({ diagnosticos_gestacion: [{ finca_id: FINCA, hembra_id: A1, servicio_id: SERV, fecha: "2026-11-10", resultado: "vacia", client_request_id: null }] }));
  assert.match((await guardarDiagnosticoCampo(vacia, diagnostico(), HOY)).error, /fue «Vacía»/);
  const db = baseFalsa(conServicio());
  assert.match((await guardarDiagnosticoCampo(db, diagnostico({ indicador: "retorno_celo" }), HOY)).error, /101: Si volvió a celo/);
  assert.match((await guardarDiagnosticoCampo(db, diagnostico({ animalId: VENDIDA }), HOY)).error, /300 ya salió del hato/);
  assert.equal(db.tablas.diagnosticos_gestacion.length, 0);
});

test("servidor: lo que llega de monta y diagnóstico se valida antes de tocar la base", () => {
  assert.ok(esquemaEnvio.safeParse(monta()).success);
  assert.ok(esquemaEnvio.safeParse(monta({ machoId: null, machoExterno: "Toro" })).success);
  assert.ok(!esquemaEnvio.safeParse(monta({ machoExterno: "x".repeat(81) })).success);
  assert.ok(esquemaEnvio.safeParse(diagnostico()).success);
  assert.ok(esquemaEnvio.safeParse(diagnostico({ metodo: "ecografia", diasGestacion: 45, numFetos: 2, viabilidad: "latido", indicador: null })).success);
  assert.ok(!esquemaEnvio.safeParse(diagnostico({ metodo: "otro" })).success, "«otro método» sigue siendo con señal (pide la prueba escrita)");
  assert.ok(!esquemaEnvio.safeParse(diagnostico({ condicion: 2.3 })).success, "condición corporal por medios puntos");
  assert.ok(!esquemaEnvio.safeParse(diagnostico({ diasGestacion: 0 })).success);
  assert.ok(!esquemaEnvio.safeParse(diagnostico({ numFetos: 5 })).success);
});

// ───────────────────────── Animal nuevo ─────────────────────────

const camposAnimal = (extra = {}) => ({ especie: "caprino", sexo: "hembra", numero_arete: "555", origen: "nacido_en_finca", vocacion: "leche", ...extra });

test("animal nuevo: las reglas son las del formulario con señal (una sola definición)", () => {
  const preparar = (c, especies = ["caprino"]) => prepararAnimalNuevo(esquemaAnimal.parse(c), especies);
  const macho = preparar(camposAnimal({ sexo: "macho", vocacion: "leche", uso_macho: "reproductor", fecha_ultimo_parto: undefined }));
  assert.equal(macho.animal.vocacion, "carne", "un macho no tiene aptitud de leche");
  assert.equal(macho.animal.uso_macho, "reproductor");
  assert.equal(preparar(camposAnimal({ sexo: "macho", uso_macho: "por_definir" })).animal.uso_macho, null);
  assert.equal(preparar(camposAnimal({ origen: "comprado", peso_nacer_kg: "3,2" })).animal.peso_nacer_kg, undefined, "el peso al nacer solo en los nacidos aquí");
  assert.equal(preparar(camposAnimal({ peso_nacer_kg: "3,2" })).animal.peso_nacer_kg, 3.2, "con coma decimal");
  assert.match(preparar(camposAnimal({ especie: "ovino" })).error, /especie no está activa/);
  assert.match(preparar(camposAnimal({ sexo: "macho", fecha_ultimo_parto: "2026-10-01" })).error, /Solo una hembra/);
  assert.match(preparar(camposAnimal({ fecha_nacimiento: "2026-10-01", fecha_ultimo_parto: "2026-09-01" })).error, /posterior al nacimiento/);
  assert.equal(preparar(camposAnimal({ fecha_ultimo_parto: "2026-10-01" })).fechaUltimoParto, "2026-10-01");
  assert.equal(preparar(camposAnimal({ especie: "ovino", cobertura: "lana" }), ["ovino"]).animal.cobertura, "lana");
  assert.equal(preparar(camposAnimal({ cobertura: "lana" })).animal.cobertura, null, "la cobertura solo en ovejas");
  assert.equal(esquemaAnimal.parse(camposAnimal({ fecha_nacimiento_aprox: "on" })).fecha_nacimiento_aprox, true);
  assert.ok(!esquemaAnimal.safeParse(camposAnimal({ numero_arete: "  " })).success, "el arete es obligatorio");
  const acciones = leer("app/(app)/hato/actions.ts");
  assert.match(acciones, /esquemaAnimal\.safeParse/);
  assert.match(acciones, /prepararAnimalNuevo\(/, "el formulario con señal usa las mismas reglas");
});

test("animal nuevo: avisa si el arete ya está en la finca o en otro animal guardado en el celular", () => {
  const ref = { animales: [{ id: A1, arete: " AB-01 ", nombre: null, sexo: "hembra", especie: "caprino", activo: true }] };
  assert.equal(areteClave("  Ab-01 "), "ab-01");
  assert.ok(areteRepetido("ab-01", ref, []));
  assert.ok(!areteRepetido("ab-02", ref, []));
  assert.ok(!areteRepetido("", ref, []));
  const guardado = registro({ id: uuid(70), tipo: "animal", campos: { numero_arete: "XY-9" } });
  assert.ok(areteRepetido("xy-9", ref, [guardado]));
  assert.ok(!areteRepetido("xy-9", ref, [guardado], uuid(70)), "al corregir ese mismo registro no cuenta");
  assert.ok(!areteRepetido("xy-9", ref, [{ ...guardado, estado: "enviado" }]), "lo enviado ya está en la copia la próxima vez");
});

test("animal nuevo: padres posibles de la misma especie y sexo, los activos primero (también los que salieron)", () => {
  const a = (id, arete, sexo, especie, activo = true) => ({ id, arete, nombre: null, sexo, especie, activo });
  const ref = { animales: [a("1", "20", "macho", "caprino", false), a("2", "10", "macho", "caprino"), a("3", "5", "hembra", "caprino"), a("4", "1", "macho", "ovino")] };
  assert.deepEqual(padresPosibles(ref, "caprino", "macho").map((x) => x.id), ["2", "1"]);
  assert.deepEqual(padresPosibles(ref, "caprino", "hembra").map((x) => x.id), ["3"]);
});

/** La función `registrar_animal` de la base, en pequeño: idempotente por client_request_id y con el arete único por finca. */
function registrarAnimalFalso(args, tablas) {
  const a = args.p_animal;
  const ya = (tablas.animales ?? []).find((x) => x.finca_id === args.p_finca && a.client_request_id && x.client_request_id === a.client_request_id);
  if (ya) return { data: ya.id, error: null };
  if ((tablas.animales ?? []).some((x) => x.finca_id === args.p_finca && x.deleted_at == null && x.numero_arete.trim().toLowerCase() === String(a.numero_arete).trim().toLowerCase())) {
    return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "animales_arete_uk"' } };
  }
  const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String((tablas.animales ?? []).length).padStart(12, "0")}`;
  (tablas.animales ??= []).push({ id, finca_id: args.p_finca, ...a, deleted_at: null });
  if (args.p_fecha_ultimo_parto) (tablas.lactancias ??= []).push({ animal_id: id, fecha_parto: args.p_fecha_ultimo_parto });
  return { data: id, error: null };
}
const envioAnimal = (extra = {}, campos = {}) => ({ tipo: "animal", id: uuid(60), fincaId: FINCA, animalId: uuid(60), fecha: HOY, campos: camposAnimal(campos), ...extra });

test("servidor: un animal nuevo se crea con la función de la base; reenviarlo devuelve el mismo, no otro", async () => {
  const db = baseFalsa({ animales: animales() }, { registrar_animal: registrarAnimalFalso });
  const antes = db.tablas.animales.length;
  assert.deepEqual(await guardarAnimalCampo(db, envioAnimal({}, { fecha_ultimo_parto: "2026-10-01" }), ["caprino"]), { ok: true, estado: "guardado" });
  assert.deepEqual(await guardarAnimalCampo(db, envioAnimal({}, { fecha_ultimo_parto: "2026-10-01" }), ["caprino"]), { ok: true, estado: "guardado" }, "la base devuelve el mismo animal");
  assert.equal(db.tablas.animales.length, antes + 1);
  const nuevo = db.tablas.animales.at(-1);
  assert.equal(nuevo.client_request_id, uuid(60), "el identificador del registro es el del envío");
  assert.equal(db.tablas.lactancias.length, 1, "con último parto abre su lactancia (una sola vez)");
});

test("servidor: si el arete ya existe en la finca, no crea otro y lo dice", async () => {
  const db = baseFalsa({ animales: animales() }, { registrar_animal: registrarAnimalFalso });
  const r = await guardarAnimalCampo(db, envioAnimal({}, { numero_arete: "101" }), ["caprino"]);
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /Ya hay un animal con el arete 101/);
});

test("servidor: rechaza el animal con datos que el formulario rechaza o con una foto de otra finca", async () => {
  const db = baseFalsa({ animales: animales() }, { registrar_animal: registrarAnimalFalso });
  assert.match((await guardarAnimalCampo(db, envioAnimal({}, { especie: "ovino" }), ["caprino"])).error, /especie no está activa/);
  assert.match((await guardarAnimalCampo(db, envioAnimal({}, { sexo: "jirafa" }), ["caprino"])).error, /./);
  assert.match((await guardarAnimalCampo(db, envioAnimal({}, { foto_path: `${uuid(99)}/${uuid(1)}.jpg` }), ["caprino"])).error, /foto no es válida/);
  assert.ok(esquemaEnvio.safeParse(envioAnimal()).success);
  assert.ok(!esquemaEnvio.safeParse({ ...envioAnimal(), campos: { notas: "x".repeat(1001) } }).success);
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
  const atajo = ATAJOS.find((a) => a.href === "/campo" && a.modulo === "leche");
  assert.ok(atajo, "«Registrar sin señal» está en «Al grano»");
  assert.ok(ATAJOS.some((a) => a.href === "/campo" && a.modulo === "reproduccion"), "y el de monta y diagnóstico, para quien registra reproducción (veterinario)");
  assert.match(leer("app/(app)/hato/Monta.tsx"), /<EnlaceSinSenal /, "el empadre lleva a registrar sin señal");
  assert.ok(ATAJOS.some((a) => a.href === "/campo#animal" && a.modulo === "hato"), "«Animal nuevo sin señal» en «Al grano»");
  assert.match(leer("app/(app)/hato/nuevo/page.tsx"), /<EnlaceSinSenal [^>]*ancla="animal"/);
  assert.match(leer("components/FormAnimal.tsx"), /esFallaDeRed\(e\)[\s\S]*guardarEnCelular\(\{ id: solicitud, tipo: "animal"/, "el formulario con señal guarda en el celular si se cae la señal, con el mismo identificador");
  assert.match(leer("supabase/migrations/20261120190017_diagnosticos_client_request_id.sql"), /add column if not exists client_request_id uuid[\s\S]*diagnosticos_client_req_uk/);
  assert.ok(TUTORIALES.some((t) => t.numero === AYUDA_CAMPO.tutorial && t.youtube), "el tutorial de la ayuda existe");
  assert.notEqual(AYUDA_CAMPO.enlace.href, "/campo");
  assert.ok(existsSync(new URL(`../app/(app)${AYUDA_CAMPO.enlace.href}/page.tsx`, import.meta.url)));
  for (const p of AYUDA_CAMPO.puntos) assert.doesNotMatch(p.texto, /IndexedDB|service worker|API|sincroniz/i, "nada técnico a las personas");
});
