import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  aplicarTecla, coincideBusqueda, enRetiroLeche, enviadosViejos, envioDe, errorFecha, errorLitros, errorPeso, hembrasDelTurno, jornadaDeHora, numeroDeTexto, porEnviar,
  redondearPeso, referenciaValida, referenciaVencida, registrosDe, resultadoEnvio, resumenBandeja, MAX_LITROS, MAX_PESO, RUTA_CAMPO,
  hembrasParaDiagnostico, machosPara, nombreMachoExterno, areteClave, areteRepetido, padresPosibles, ubicacionesEfectivas, ocupacion, conBajaPendiente, conPartoPendiente, aretesDeCrias, hembrasParaParto, referenciaConPendientes, REGISTROS_SIN_SENAL, textoRegistrosSinSenal, SIN_SENAL_ENTRAR,
} from "../lib/campo.ts";
import { cupoDestino, leerMovimiento, motivoPorDestino } from "../lib/movimiento-reglas.ts";
import { esquemaCompra, revisarCompra } from "../lib/compra-reglas.ts";
import { esquemaVenta, revisarVenta } from "../lib/venta-reglas.ts";
import { entradaBajaDeCampos, esquemaBaja } from "../lib/baja-reglas.ts";
import { revisarCrias } from "../lib/parto-reglas.ts";
import { esquemaAnimal, prepararAnimalNuevo } from "../lib/animal-nuevo.ts";
import { esquemaEnvio, guardarAnimalCampo, guardarBajaCampo, guardarPartoCampo, guardarCompraCampo, guardarVentaCampo, guardarDiagnosticoCampo, guardarMontaCampo, guardarMovimientoCampo, guardarSanidadCampo, guardarServicioCampo, guardarOrdenoCampo, guardarPesoCampo, leerReferenciaCampo, permisosCampo, traducirAnimalesLocales, guardarSalidaAlimentoCampo, guardarDespachoCampo } from "../lib/campo-servidor.ts";
import { reglasDiagnostico } from "../lib/diagnostico-reglas.ts";
import { ATAJOS } from "../lib/atajos.ts";
import { AYUDA_CAMPO } from "../lib/ayuda.ts";
import { TUTORIALES } from "../lib/tutoriales.ts";
import { PLANES } from "../lib/planes.ts";

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
    version: 8, generadaEn: "2026-11-20T10:00:00Z", hoy: HOY, usuario: { id: U }, finca: { id: FINCA, nombre: "La Esperanza", moneda: "COP" },
    puede: { leche: true, pesos: true, reproduccion: true, hato: true, sanidad: true, lotes: true, corrales: true, compras: true, ventas: true, alimento: true }, ordeno: [], pesar: [], hembras: [], machos: [],
    especies: ["caprino"], proposito: "leche", razas: [], animales: [], productos: [], ubicaciones: [],
    compras: { productos: [], proveedores: [], lotes: [], productosVet: [], especies: ["caprino"], ivaDefecto: 19, conSanidad: true },
    ventas: { productos: [], compradores: [] },
    alimentacion: { alimentos: [], destinos: [] },
    despachos: { compradores: [], precioHabitual: 2500, ivaDefecto: null },
  };
  assert.deepEqual(referenciaValida(ref), ref);
  for (const malo of [null, "x", { ...ref, version: 9 }, { ...ref, ordeno: null }, { ...ref, usuario: {} }, { ...ref, hembras: undefined }, { ...ref, animales: undefined }, { ...ref, productos: undefined }, { ...ref, ubicaciones: undefined }, { ...ref, compras: null }, { ...ref, compras: {} }, { ...ref, ventas: null }, { ...ref, ventas: { productos: [] } }, { ...ref, alimentacion: null }, { ...ref, despachos: {} }]) assert.equal(referenciaValida(malo), null);
  const vacias = { productos: [], proveedores: [], lotes: [], productosVet: [], especies: [], ivaDefecto: null, conSanidad: false };
  const sinVentas = { productos: [], compradores: [] };
  const nuevas = { alimentacion: { alimentos: [], destinos: [] }, despachos: { compradores: [], precioHabitual: null, ivaDefecto: null } };
  const extra = { especies: [], proposito: "leche", razas: [], animales: [], productos: [], ubicaciones: [], compras: vacias, ventas: sinVentas, ...nuevas };
  const v1 = { version: 1, generadaEn: ref.generadaEn, hoy: HOY, usuario: { id: U }, finca: ref.finca, puede: { leche: true, pesos: false }, ordeno: [], pesar: [] };
  assert.deepEqual(referenciaValida(v1), { ...v1, version: 8, puede: { leche: true, pesos: false, reproduccion: false, hato: false, sanidad: false, lotes: false, corrales: false, compras: false, ventas: false, alimento: false }, hembras: [], machos: [], ...extra });
  const v2 = { ...v1, version: 2, puede: { leche: true, pesos: true, reproduccion: true }, hembras: [], machos: [] };
  assert.deepEqual(referenciaValida(v2), { ...v2, version: 8, puede: { leche: true, pesos: true, reproduccion: true, hato: false, sanidad: false, lotes: false, corrales: false, compras: false, ventas: false, alimento: false }, ...extra });
  const v3 = { ...v2, version: 3, puede: { leche: true, pesos: true, reproduccion: true, hato: true }, especies: ["caprino"], proposito: "carne", razas: [], animales: [] };
  assert.deepEqual(referenciaValida(v3), { ...v3, version: 8, puede: { ...v3.puede, sanidad: false, lotes: false, corrales: false, compras: false, ventas: false, alimento: false }, productos: [], ubicaciones: [], compras: vacias, ventas: sinVentas, ...nuevas });
  const v4 = { ...v3, version: 4, puede: { ...v3.puede, sanidad: true, lotes: false }, productos: [] };
  assert.deepEqual(referenciaValida(v4), { ...v4, version: 8, puede: { ...v4.puede, corrales: false, compras: false, ventas: false, alimento: false }, ubicaciones: [], compras: vacias, ventas: sinVentas, ...nuevas }, "una copia de la versión 4 sirve, sin corrales hasta renovarse");
  const v5 = { ...v4, version: 5, puede: { ...v4.puede, corrales: true }, ubicaciones: [] };
  assert.deepEqual(referenciaValida(v5), { ...v5, version: 8, puede: { ...v5.puede, compras: false, ventas: false, alimento: false }, compras: vacias, ventas: sinVentas, ...nuevas }, "una copia de la versión 5 sirve, sin compras hasta renovarse");
  const v6 = { ...v5, version: 6, puede: { ...v5.puede, compras: true }, compras: vacias };
  assert.deepEqual(referenciaValida(v6), { ...v6, version: 8, puede: { ...v6.puede, ventas: false, alimento: false }, ventas: sinVentas, ...nuevas }, "una copia de la versión 6 sirve, sin ventas hasta renovarse");
  const v7 = { ...v6, version: 7, puede: { ...v6.puede, ventas: true }, ventas: sinVentas };
  assert.deepEqual(referenciaValida(v7), { ...v7, version: 8, puede: { ...v7.puede, alimento: false }, ...nuevas }, "una copia de la versión 7 sirve, sin alimento ni despachos hasta renovarse");
  assert.equal(referenciaVencida(ref, new Date("2026-11-20T10:10:00Z")), false);
  assert.equal(referenciaVencida(ref, new Date("2026-11-20T10:16:00Z")), true);
  assert.equal(referenciaVencida(null, new Date()), true);
});

test("campo: permisos por rol (los mismos módulos que con señal)", () => {
  assert.deepEqual(permisosCampo("propietario", "hacienda"), { leche: true, pesos: true, reproduccion: true, hato: true, sanidad: true, lotes: true, corrales: true, compras: true, ventas: true, alimento: true });
  assert.deepEqual(permisosCampo("administrador", "hacienda"), { leche: true, pesos: true, reproduccion: true, hato: true, sanidad: true, lotes: true, corrales: true, compras: true, ventas: true, alimento: true });
  assert.deepEqual(permisosCampo("ordenador", "hacienda"), { leche: true, pesos: false, reproduccion: false, hato: false, sanidad: false, lotes: false, corrales: false, compras: false, ventas: false, alimento: true }, "el ordeñador anota lo que se da de comer");
  assert.deepEqual(permisosCampo("veterinario", "hacienda"), { leche: false, pesos: false, reproduccion: true, hato: false, sanidad: true, lotes: false, corrales: true, compras: false, ventas: false, alimento: false });
  assert.deepEqual(permisosCampo("contador", "hacienda"), { leche: false, pesos: false, reproduccion: false, hato: false, sanidad: false, lotes: false, corrales: false, compras: true, ventas: true, alimento: false });
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
    bajas: [["animal_id"], ["finca_id", "client_request_id"]],
    inventario_alimento_movimientos: [["finca_id", "client_request_id"]],
    despachos_leche: [["finca_id", "client_request_id"]],
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
      gte: (c, v) => (filtros.push((f) => f[c] >= v), q),
      lte: (c, v) => (filtros.push((f) => f[c] <= v), q),
      ilike: (c, patron) => (filtros.push((f) => String(f[c] ?? "").toLowerCase() === patron.replace(/\\(.)/g, "$1").toLowerCase()), q),
      order: () => q,
      limit: () => q,
      range: (d, h) => ((rango = [d, h]), q),
      maybeSingle: async () => ({ data: obtener()[0] ?? null, error: null }),
      then: (ok, mal) => Promise.resolve({ data: obtener(), error: null }).then(ok, mal),
      // Como PostgREST: se puede esperar directo o pedir la fila con `.select().single()` (los terceros reciben un id, como en la base).
      insert: (entrada) => {
        const hecho = (async () => {
          const fila = tabla === "finca_terceros" ? { id: crypto.randomUUID(), activo: true, ...entrada } : entrada;
          await antesDeInsertar?.(tabla, fila);
          for (const cols of unicas[tabla] ?? []) {
            if (cols.some((c) => fila[c] == null)) continue;
            if ((tablas[tabla] ?? []).some((f) => cols.every((c) => f[c] === fila[c]))) return { error: { code: "23505", message: `duplicate key value violates unique constraint "${tabla}_${cols.join("_")}"` } };
          }
          (tablas[tabla] ??= []).push({ ...fila });
          return { error: null, fila };
        })();
        return {
          then: (ok, mal) => hecho.then((r) => ({ error: r.error }), mal).then(ok, mal),
          select: () => ({ single: async () => { const r = await hecho; return { data: r.error ? null : r.fila, error: r.error }; } }),
        };
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
    inventario_alimento: [
      { producto_id: "f2", nombre: "Sal mineralizada", rubro: "sales_suplementos", unidad: "bultos", kg_por_unidad: "40", desde: "2026-11-01", stock_kg: "120", consumo_kg: 10, dias_con_salida: 2, compras_sin_calcular: 0 },
      { producto_id: "f1", nombre: "Concentrado", rubro: "concentrado", unidad: "bultos", kg_por_unidad: null, desde: null, stock_kg: null, consumo_kg: 0, dias_con_salida: 0, compras_sin_calcular: 1 },
    ],
  };
  const v_repro_hembras = [{ finca_id: FINCA, animal_id: A1, estado: "servida", ultimo_servicio: "2026-10-01" }, { finca_id: FINCA, animal_id: A2, estado: "vacia", ultimo_servicio: null }];
  const razas = [{ id: 1, especie: "caprino", nombre: "Saanen", cobertura: null }, { id: 2, especie: "ovino", nombre: "Katahdin", cobertura: "pelo" }];
  const productos_veterinarios = [
    { id: "p1", finca_id: FINCA, nombre: "Ivermectina", tipo: "desparasitante", retiro_leche_dias: 7, retiro_carne_dias: 28, unidad_dosis: "ml", activo: true },
    { id: "p2", finca_id: FINCA, nombre: "Viejo", tipo: "otro", retiro_leche_dias: 0, retiro_carne_dias: 0, unidad_dosis: null, activo: false },
  ];
  const v_ubicaciones = [
    { id: "u2", finca_id: FINCA, nombre: "Potrero 1", tipo: "potrero", uso: "general", capacidad: null, estado: "descanso", dias_descanso: 12, dias_descanso_min: 35, activa: true },
    { id: "u1", finca_id: FINCA, nombre: "Corral 1", tipo: "corral", uso: "crias", capacidad: 10, estado: "ocupado", dias_descanso: null, dias_descanso_min: 35, activa: true },
    { id: "u3", finca_id: FINCA, nombre: "Archivado", tipo: "corral", uso: "general", capacidad: 5, estado: "vacio", dias_descanso: null, dias_descanso_min: 35, activa: false },
  ];
  const movimientos_animales = [
    { finca_id: FINCA, animal_id: A1, ubicacion_id: "u1", hasta: null },
    { finca_id: FINCA, animal_id: A2, ubicacion_id: "u2", hasta: "2026-11-01" },
    { finca_id: FINCA, animal_id: VENDIDA, ubicacion_id: "u1", hasta: null },
  ];
  const finca_productos = [
    { id: "f2", finca_id: FINCA, nombre: "Sal mineralizada", tipo: "compra", rubro: "sales_suplementos", unidad: "bultos", precio_habitual: 95000, orden: 2, activo: true },
    { id: "f1", finca_id: FINCA, nombre: "Concentrado", tipo: "compra", rubro: "concentrado", unidad: "bultos", precio_habitual: "62500", orden: 1, activo: true },
    { id: "f3", finca_id: FINCA, nombre: "Leche cruda", clave: "leche_cruda", tipo: "venta", rubro: null, linea: "leche", unidad: "litros", precio_habitual: 2000, orden: 1, activo: true, automatico: true },
    { id: "f5", finca_id: FINCA, nombre: "Queso campesino", tipo: "venta", rubro: null, linea: "derivados", unidad: "kg", precio_habitual: 18000, orden: 3, activo: true, automatico: false },
    { id: "f6", finca_id: FINCA, nombre: "Abono", tipo: "venta", rubro: null, linea: "subproductos", unidad: "bultos", precio_habitual: null, orden: 2, activo: true, automatico: false },
    { id: "f4", finca_id: FINCA, nombre: "Oculto", tipo: "compra", rubro: "forraje", unidad: "pacas", precio_habitual: null, orden: 3, activo: false },
  ];
  const finca_terceros = [
    { id: "t1", finca_id: FINCA, nombre: "Agro El Llano", tipo: "proveedor", activo: true },
    { id: "t2", finca_id: FINCA, nombre: "Quesera", tipo: "comprador", activo: true },
    { id: "t3", finca_id: FINCA, nombre: "Ambos SAS", tipo: "ambos", activo: true },
  ];
  const finca_ajustes = [{ finca_id: FINCA, iva_tarifa_defecto: 19 }];
  const db = baseFalsa({ animales: animales(), lactancias, lotes_ceba: [{ id: "l1", finca_id: FINCA, nombre: "Ceba 1", cerrado_en: null }], v_repro_hembras, razas, productos_veterinarios, v_ubicaciones, ubicaciones: v_ubicaciones, movimientos_animales, finca_productos, finca_terceros, finca_ajustes }, rpcs);
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
  assert.deepEqual(Object.keys(ref.animales[0]).sort(), ["activo", "arete", "especie", "id", "nombre", "sexo", "ubicacion"]);
  assert.deepEqual(ref.animales.map((a) => [a.arete, a.ubicacion]), [["101", "u1"], ["102", null], ["200", null], ["300", null], ["400", null]], "dónde está hoy cada animal activo (solo su fila abierta)");
  assert.deepEqual(ref.ubicaciones, [
    { id: "u1", nombre: "Corral 1", tipo: "corral", uso: "crias", capacidad: 10, estado: "ocupado", diasDescanso: null, diasDescansoMin: 35 },
    { id: "u2", nombre: "Potrero 1", tipo: "potrero", uso: "general", capacidad: null, estado: "descanso", diasDescanso: 12, diasDescansoMin: 35 },
  ], "solo las instalaciones activas, corrales primero");
  assert.deepEqual(ref.compras.productos, [
    { id: "f1", nombre: "Concentrado", rubro: "concentrado", unidad: "bultos", precio: 62500, orden: 1 },
    { id: "f2", nombre: "Sal mineralizada", rubro: "sales_suplementos", unidad: "bultos", precio: 95000, orden: 2 },
  ], "solo los productos de compra activos, en el orden del catálogo, con su último precio");
  assert.deepEqual(ref.compras.proveedores.map((t) => t.nombre), ["Agro El Llano", "Ambos SAS"], "proveedores (y los de ambos tipos), no compradores");
  assert.deepEqual(ref.compras.lotes, [{ id: "l1", nombre: "Ceba 1" }]);
  assert.deepEqual([ref.compras.ivaDefecto, ref.compras.conSanidad, ref.compras.especies], [19, true, ["caprino", "ovino"]]);
  assert.deepEqual(ref.compras.productosVet, [{ id: "p1", nombre: "Ivermectina" }]);
  assert.deepEqual(ref.ventas.productos, [
    { id: "f6", nombre: "Abono", linea: "subproductos", unidad: "bultos", precio: null, orden: 2 },
    { id: "f5", nombre: "Queso campesino", linea: "derivados", unidad: "kg", precio: 18000, orden: 3 },
  ], "solo lo que se vende a mano: nunca la leche cruda ni los animales, que entran solos");
  assert.deepEqual(ref.ventas.compradores.map((t) => t.nombre), ["Ambos SAS", "Quesera"], "compradores (y los de ambos tipos), no proveedores");

  assert.deepEqual(ref.alimentacion.alimentos, [{ producto_id: "f2", nombre: "Sal mineralizada", unidad: "bultos", kg_por_unidad: 40, stock_kg: 120 }], "solo los alimentos con su conteo de apertura (a los demás no hay de dónde descontarles)");
  assert.deepEqual(ref.alimentacion.destinos.map((d) => d.etiqueta), ["Potrero 1", "Corral 1", "Ceba 1"], "corrales activos y lotes de ceba abiertos");
  assert.deepEqual(ref.despachos, { compradores: [{ id: "t3", nombre: "Ambos SAS" }, { id: "t2", nombre: "Quesera" }], precioHabitual: 2000, ivaDefecto: 19 }, "despachos: compradores, último precio de la leche cruda e IVA");

  const ordenador = await leerReferenciaCampo(db, ctx("ordenador"), HOY);
  assert.deepEqual(ordenador.puede, { leche: true, pesos: false, reproduccion: false, hato: false, sanidad: false, lotes: false, corrales: false, compras: false, ventas: false, alimento: true });
  assert.deepEqual(ordenador.alimentacion.destinos, [], "el ordeñador no ve corrales ni lotes: su salida no lleva destino");
  assert.equal(ordenador.despachos.compradores.length, 2, "el ordeñador registra despachos: se lleva los compradores");
  assert.deepEqual(ordenador.compras.productos, [], "quien no registra compras no se lleva el catálogo de compras");
  assert.deepEqual(ordenador.ventas, { productos: [], compradores: [] }, "ni el de ventas");
  assert.deepEqual(ordenador.ubicaciones, [], "quien no mueve animales no se lleva los corrales");
  assert.deepEqual(ordenador.productos, [], "quien no registra sanidad no se lleva el catálogo de productos");
  assert.deepEqual(ref.productos, [{ id: "p1", nombre: "Ivermectina", tipo: "desparasitante", retiroLeche: 7, retiroCarne: 28, unidad: "ml" }], "solo los productos activos, con su retiro");
  assert.deepEqual([ordenador.especies, ordenador.razas, ordenador.animales], [[], [], []], "quien no crea animales no se lleva el hato ni las razas");
  assert.equal(ordenador.ordeno.length, 2);
  assert.deepEqual(ordenador.pesar, [], "quien no pesa no se lleva la lista del hato");
  assert.deepEqual([ordenador.hembras, ordenador.machos], [[], []], "quien no registra reproducción no se lleva hembras ni reproductores");
  const vet = await leerReferenciaCampo(db, ctx("veterinario"), HOY);
  assert.deepEqual(vet.puede, { leche: false, pesos: false, reproduccion: true, hato: false, sanidad: true, lotes: false, corrales: true, compras: false, ventas: false, alimento: false });
  assert.deepEqual([vet.ordeno, vet.pesar], [[], []]);
  assert.equal(vet.animales.length, 5, "el veterinario se lleva los animales para Sanidad");
  assert.deepEqual([vet.especies, vet.razas], [[], []], "pero no lo de crear animales");
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
  assert.ok(esquemaEnvio.safeParse(diagnostico({ metodo: "otro", pruebaNombre: "Kit", pruebaResultado: "Positivo", indicador: null })).success, "«otro método» llega desde la ficha (respaldo sin señal)");
  assert.ok(!esquemaEnvio.safeParse(diagnostico({ metodo: "otra cosa" })).success);
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

// ───────────────────────── Sanidad, servicio desde la ficha y extras ─────────────────────────

/** La función `guardar_evento_sanitario_detalle` en pequeño: idempotente por client_request_id y guarda los animales. */
function guardarEventoFalso(args, tablas) {
  const crid = args.p_datos.client_request_id || null;
  if (crid && (tablas.eventos_sanitarios ?? []).some((x) => x.finca_id === args.p_finca && x.client_request_id === crid)) {
    return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "eventos_sanitarios_client_req_uk"' } };
  }
  const id = `cccccccc-cccc-4ccc-8ccc-${String((tablas.eventos_sanitarios ?? []).length).padStart(12, "0")}`;
  (tablas.eventos_sanitarios ??= []).push({ id, finca_id: args.p_finca, ...args.p_datos, extra: args.p_extra, animales: args.p_animales, client_request_id: crid });
  return { data: id, error: null };
}
const PROD = "99999999-9999-4999-8999-999999999999";
const sanidad = (campos = {}, extra = {}) => ({
  tipo: "sanidad", id: uuid(80), fincaId: FINCA, animalId: A1, fecha: HOY, animales: [A1, A2],
  campos: { tipo: "desparasitacion", fecha: HOY, categoria: "gastrointestinales", motivo: "rutina", producto_id: PROD, dosis: "2,5", unidad_dosis: "ml", retiro_leche_dias: "7", retiro_carne_dias: "28", ...campos },
  ...extra,
});
const baseSanidad = () => baseFalsa(
  { animales: animales(), productos_veterinarios: [{ id: PROD, finca_id: FINCA, nombre: "Ivermectina" }], eventos_sanitarios: [], programa_sanitario_animales: [] },
  { guardar_evento_sanitario_detalle: guardarEventoFalso, lotes_sanidad: [] },
);

test("servidor: sanidad sin señal con las reglas del formulario; reenviarla no la duplica", async () => {
  const db = baseSanidad();
  assert.deepEqual(await guardarSanidadCampo(db, sanidad(), false), { ok: true, estado: "guardado" });
  const ev = db.tablas.eventos_sanitarios[0];
  assert.equal(ev.producto_nombre, "Ivermectina", "el nombre del producto se copia del catálogo");
  assert.equal(ev.dosis, 2.5, "dosis con coma decimal");
  assert.deepEqual(ev.animales, [A1, A2]);
  assert.equal(ev.client_request_id, uuid(80));
  assert.equal(ev.extra.categoria, "gastrointestinales");
  assert.deepEqual(await guardarSanidadCampo(db, sanidad(), false), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.eventos_sanitarios.length, 1);
});

test("servidor: sanidad rechaza lo que el formulario rechaza", async () => {
  const db = baseSanidad();
  assert.match((await guardarSanidadCampo(db, sanidad({ categoria: "" }), false)).error, /Elige una opción/);
  assert.match((await guardarSanidadCampo(db, sanidad({ producto_id: "" }), false)).error, /producto que se aplicó/);
  assert.match((await guardarSanidadCampo(db, sanidad({ fecha: "2099-01-01" }), false)).error, /futura/);
  assert.match((await guardarSanidadCampo(db, sanidad({ proxima_fecha: HOY }), false)).error, /próxima dosis/);
  assert.match((await guardarSanidadCampo(db, sanidad({ producto_id: uuid(5) }), false)).error, /No encontramos ese producto/);
  assert.match((await guardarSanidadCampo(db, sanidad({}, { animales: [] }), false)).error, /al menos un animal/);
  assert.equal(db.tablas.eventos_sanitarios.length, 0);
  assert.ok(!esquemaEnvio.safeParse({ ...sanidad(), animales: [] }).success);
  assert.ok(esquemaEnvio.safeParse(sanidad()).success);
});

test("servidor: un servicio hecho desde la ficha sin señal se valida igual y no se duplica", async () => {
  const db = baseFalsa({ animales: animales(), servicios: [] });
  const s = (campos = {}) => ({ tipo: "servicio", id: uuid(90), fincaId: FINCA, animalId: A1, fecha: HOY, campos: { hembra_id: A1, fecha: HOY, tipo: "inseminacion", macho_externo: "Pajilla 7", semen_lote: "L-22", tecnica_inseminacion: "cervical", ...campos } });
  assert.deepEqual(await guardarServicioCampo(db, s(), HOY), { ok: true, estado: "guardado" });
  assert.equal(db.tablas.servicios[0].semen_lote, "L-22");
  assert.equal(db.tablas.servicios[0].client_request_id, uuid(90));
  assert.deepEqual(await guardarServicioCampo(db, s(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.servicios.length, 1);
  assert.match((await guardarServicioCampo(db, { ...s({ semen_lote: "" }), id: uuid(91) }, HOY)).error, /pajilla/);
  assert.match((await guardarServicioCampo(db, { ...s({ hembra_id: MACHO }), id: uuid(92) }, HOY)).error, /hembra/);
});

test("servidor: un peso desde la ficha sin señal conserva su tipo, condición corporal y observaciones", async () => {
  const db = baseFalsa({ animales: animales(), pesajes: [] });
  const r = await guardarPesoCampo(db, { ...peso(), extras: { tipo: "destete", condicion_corporal: "3,5", observaciones: "Bien" } }, HOY);
  assert.deepEqual(r, { ok: true, estado: "guardado" });
  assert.deepEqual((({ tipo, condicion_corporal, observaciones }) => ({ tipo, condicion_corporal, observaciones }))(db.tablas.pesajes[0]), { tipo: "destete", condicion_corporal: 3.5, observaciones: "Bien" });
  assert.match((await guardarPesoCampo(db, { ...peso({ id: uuid(24), animalId: A2 }), extras: { tipo: "gigante" } }, HOY)).error, /tipo de pesaje/);
  assert.match((await guardarPesoCampo(db, { ...peso({ id: uuid(25), animalId: A2 }), extras: { condicion_corporal: "3,3" } }, HOY)).error, /condición corporal/);
});

test("servidor: un diagnóstico desde la ficha sin señal guarda «otro método», quién lo hizo y las observaciones", async () => {
  const db = baseFalsa(conServicio());
  const r = await guardarDiagnosticoCampo(db, diagnostico({ metodo: "otro", indicador: null, pruebaNombre: "Kit rápido", pruebaResultado: "Positivo", responsable: "Dra. Ruiz", observaciones: "Repetir" }), HOY);
  assert.deepEqual(r, { ok: true, estado: "guardado" });
  const f = db.tablas.diagnosticos_gestacion[0];
  assert.deepEqual([f.prueba_nombre, f.prueba_resultado, f.responsable, f.observaciones], ["Kit rápido", "Positivo", "Dra. Ruiz", "Repetir"]);
  assert.match((await guardarDiagnosticoCampo(baseFalsa(conServicio()), diagnostico({ metodo: "otro", indicador: null }), HOY)).error, /prueba/);
});

test("respaldo: ningún formulario de lo que se hace sin señal pierde lo escrito si se cae la señal", () => {
  for (const f of ["components/FormPeso.tsx", "components/FormServicio.tsx", "components/FormDiagnostico.tsx", "components/FormEvento.tsx"]) {
    const codigo = leer(f);
    assert.match(codigo, /accionConRespaldo\(/, `${f}: envuelve su acción`);
    assert.match(codigo, /<AvisoGuardadoLocal \/>/, `${f}: dice que quedó en el celular`);
    assert.doesNotMatch(codigo, /useActionState\(editando \? /, `${f}: no llama la acción directo (rompería la pantalla sin señal)`);
  }
  assert.match(leer("components/FormAnimal.tsx"), /esFallaDeRed\(e\)/);
  assert.match(leer("components/CapturaLeche.tsx"), /esFallaDeRed\(e\)/);
  assert.match(leer("components/CebaPesar.tsx"), /esFallaDeRed\(e\)/);
  const respaldo = leer("lib/offline/respaldo.ts");
  assert.match(respaldo, /if \(!esFallaDeRed\(e\)\) throw e;/, "solo un fallo de red cambia el camino; los demás errores siguen como antes");
  assert.match(respaldo, /SIN_SENAL_CORRECCION/, "una corrección sin señal da un aviso amable");
  assert.match(leer("app/(app)/reproduccion/actions.ts"), /client_request_id: l\.d\.client_request_id \?\? null/, "el diagnóstico con señal también lleva su identificador (doble toque)");
  assert.ok(ATAJOS.some((a) => a.href === "/campo#sanidad" && a.modulo === "sanidad"), "«Sanidad sin señal» en «Al grano»");
  assert.match(leer("app/(app)/hato/Sanidad.tsx"), /<EnlaceSinSenal [^>]*ancla="sanidad"/);
});

// ───────────────────────── Corrales: mover animales ─────────────────────────

const C1 = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const C2 = "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2";
const OTRA = "88888888-8888-4888-8888-888888888888";

test("corrales: dónde está cada animal suma lo movido en el celular; el cupo y el motivo son los de con señal", () => {
  const ref = {
    finca: { id: FINCA, nombre: "La Esperanza" },
    animales: [
      { id: A1, arete: "101", nombre: null, sexo: "hembra", especie: "caprino", activo: true, ubicacion: C1 },
      { id: A2, arete: "102", nombre: null, sexo: "hembra", especie: "caprino", activo: true, ubicacion: C1 },
      { id: MACHO, arete: "200", nombre: null, sexo: "macho", especie: "caprino", activo: true, ubicacion: null },
      { id: VENDIDA, arete: "300", nombre: null, sexo: "hembra", especie: "caprino", activo: false, ubicacion: null },
    ],
  };
  const mov = (id, creadoEn, animales, campos, extra = {}) => ({ id, tipo: "movimiento", usuarioId: U, fincaId: FINCA, animalId: animales[0], animales, etiqueta: "", fecha: HOY, campos, creadoEn, estado: "pendiente", intentos: 0, ...extra });
  const registros = [
    mov(uuid(2), "2026-11-20T09:00:00Z", [A1, MACHO], { destino: C2, sin_destino: "no", fecha: HOY, motivo: "rotacion" }),
    mov(uuid(1), "2026-11-20T08:00:00Z", [A1], { sin_destino: "si", fecha: HOY, motivo: "otro" }),
    mov(uuid(3), "2026-11-20T10:00:00Z", [A2], { destino: C2, sin_destino: "no", fecha: HOY, motivo: "traslado" }, { estado: "error" }),
    mov(uuid(4), "2026-11-20T10:00:00Z", [A2], { destino: C2, sin_destino: "no", fecha: HOY, motivo: "traslado" }, { usuarioId: OTRA }),
  ];
  const donde = ubicacionesEfectivas(ref, registros, U);
  assert.deepEqual([...donde.entries()], [[A1, C2], [A2, C1], [MACHO, C2]], "en orden de anotación; sin los que tienen error, los de otra cuenta ni los que salieron");
  assert.deepEqual([...ocupacion(donde).entries()], [[C2, 2], [C1, 1]]);
  assert.equal(ubicacionesEfectivas(ref, registros, U, uuid(2)).get(A1), null, "sin contar el registro que se está corrigiendo");
  assert.deepEqual(cupoDestino(10, 9, 3, 1), { libres: 1, entran: 2, sinCupo: true }, "los que ya están en el destino no cuentan");
  assert.deepEqual(cupoDestino(null, 50, 30, 0), { libres: null, entran: 30, sinCupo: false }, "un potrero sin capacidad no tiene tope");
  assert.equal(motivoPorDestino({ tipo: "potrero", uso: "general" }), "rotacion");
  assert.equal(motivoPorDestino({ tipo: "corral", uso: "cuarentena" }), "cuarentena");
  assert.equal(motivoPorDestino({ tipo: "corral", uso: "crias" }), "traslado");
  assert.match(leerMovimiento({ sin_destino: "no", fecha: HOY, motivo: "traslado" }, [A1], HOY).error, /a dónde van/);
  assert.match(leerMovimiento({ destino: C1, sin_destino: "no", fecha: "2099-01-01", motivo: "traslado" }, [A1], HOY).error, /futura/);
  assert.match(leerMovimiento({ destino: C1, sin_destino: "no", fecha: HOY, motivo: "traslado" }, [], HOY).error, /al menos un animal/);
  assert.deepEqual(leerMovimiento({ destino: C1, sin_destino: "no", fecha: HOY, motivo: "traslado" }, [A1, A1], HOY).ids, [A1]);
});

/** `mover_animales` de mentira: el cupo, y por animal cierra su fila abierta y abre otra (como la base: `created_by` = quien llama). */
function moverFalso(quien, ahora) {
  return (args, tablas) => {
    const filas = (tablas.movimientos_animales ??= []);
    const cap = (tablas.ubicaciones ?? []).find((u) => u.id === args.p_ubicacion)?.capacidad ?? null;
    if (cap !== null) {
      const ocupan = filas.filter((m) => m.ubicacion_id === args.p_ubicacion && m.hasta === null).length;
      const entran = args.p_animales.filter((a) => !filas.some((m) => m.animal_id === a && m.ubicacion_id === args.p_ubicacion && m.hasta === null)).length;
      if (entran > cap - ocupan) return { data: null, error: { code: "23514", message: `En la instalación solo caben ${cap - ocupan} animales más y quieres mover ${entran}.` } };
    }
    for (const a of args.p_animales) {
      const abierta = filas.find((m) => m.animal_id === a && m.hasta === null);
      if (abierta && abierta.ubicacion_id === args.p_ubicacion) continue;
      if (abierta) abierta.hasta = args.p_fecha;
      if (args.p_ubicacion) filas.push({ finca_id: args.p_finca, animal_id: a, ubicacion_id: args.p_ubicacion, desde: args.p_fecha, hasta: null, motivo: args.p_motivo, created_at: ahora, created_by: quien });
    }
    tablas.llamadas = (tablas.llamadas ?? 0) + 1;
    return { data: args.p_animales.length, error: null };
  };
}
const movimiento = (campos = {}, extra = {}) => ({
  tipo: "movimiento", id: uuid(70), fincaId: FINCA, animalId: A1, fecha: HOY, animales: [A1, A2], creadoEn: "2026-11-20T08:00:00.000Z",
  campos: { destino: C2, sin_destino: "no", fecha: HOY, motivo: "rotacion", ...campos },
  ...extra,
});
const baseCorrales = (movs = []) => baseFalsa(
  { animales: animales(), ubicaciones: [{ id: C1, capacidad: 10 }, { id: C2, capacidad: 3 }], movimientos_animales: movs },
  { mover_animales: moverFalso(U, "2026-11-20T12:00:00.000Z") },
);
const abierta = (animal, ubicacion, extra = {}) => ({ finca_id: FINCA, animal_id: animal, ubicacion_id: ubicacion, desde: "2026-11-10", hasta: null, created_at: "2026-11-10T08:00:00.000Z", created_by: OTRA, ...extra });

test("servidor: mover sin señal usa la función de la base; reenviarlo no mueve nada otra vez", async () => {
  const db = baseCorrales([abierta(A1, C1), abierta(A2, C1)]);
  assert.deepEqual(await guardarMovimientoCampo(db, movimiento(), HOY, U), { ok: true, estado: "guardado" });
  assert.deepEqual(db.tablas.movimientos_animales.filter((m) => m.hasta === null).map((m) => [m.animal_id, m.ubicacion_id]), [[A1, C2], [A2, C2]]);
  assert.deepEqual(await guardarMovimientoCampo(db, movimiento(), HOY, U), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.llamadas, 1, "el reenvío no llama a la base");
  const sacar = await guardarMovimientoCampo(db, movimiento({ destino: "", sin_destino: "si", motivo: "otro" }, { id: uuid(71), creadoEn: "2026-11-20T13:00:00.000Z" }), HOY, U);
  assert.deepEqual(sacar, { ok: true, estado: "guardado" });
  assert.equal(db.tablas.movimientos_animales.filter((m) => m.hasta === null).length, 0, "sacarlos cierra su fila sin abrir otra");
});

test("servidor: mover sin señal nunca pisa lo que otra persona movió después; lo propio sí se aplica en orden", async () => {
  const despues = abierta(A2, C1, { created_at: "2026-11-20T09:30:00.000Z" });
  const db = baseCorrales([abierta(A1, C1), despues]);
  const r = await guardarMovimientoCampo(db, movimiento(), HOY, U);
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /102 lo movió otra persona[\s\S]*No se movió ninguno[\s\S]*Corregir/);
  assert.equal(db.tablas.llamadas, undefined, "no tocó la base");
  const conFecha = baseCorrales([abierta(A1, C1, { desde: "2026-11-21" }), abierta(A2, C1)]);
  assert.equal((await guardarMovimientoCampo(conFecha, movimiento(), HOY, U)).codigo, "conflicto", "una entrada con fecha posterior tampoco se pisa");
  // Dos movimientos de la misma persona guardados sin señal: el primero crea filas «después» del segundo, y aun así el segundo se aplica.
  const propio = baseCorrales([abierta(A1, C1), abierta(A2, C1)]);
  assert.deepEqual(await guardarMovimientoCampo(propio, movimiento(), HOY, U), { ok: true, estado: "guardado" });
  const segundo = movimiento({ destino: C1, motivo: "traslado" }, { id: uuid(72), creadoEn: "2026-11-20T08:05:00.000Z" });
  assert.deepEqual(await guardarMovimientoCampo(propio, segundo, HOY, U), { ok: true, estado: "guardado" });
  assert.deepEqual(propio.tablas.movimientos_animales.filter((m) => m.hasta === null).map((m) => m.ubicacion_id), [C1, C1]);
});

test("servidor: mover sin señal rechaza lo que con señal se rechaza (salió del hato, sin cupo, sin destino)", async () => {
  const vendida = await guardarMovimientoCampo(baseCorrales(), movimiento({}, { animales: [A1, VENDIDA] }), HOY, U);
  assert.match(vendida.error, /300 ya salió del hato\. No se movió ninguno/);
  const lleno = await guardarMovimientoCampo(baseCorrales([abierta(MACHO, C2), abierta(OVEJO, C2)]), movimiento(), HOY, U);
  assert.match(lleno.error, /solo caben 1 animales más/, "el cupo lo exige la base");
  assert.match((await guardarMovimientoCampo(baseCorrales(), movimiento({ destino: "" }), HOY, U)).error, /a dónde van/);
  assert.match((await guardarMovimientoCampo(baseCorrales(), movimiento({ fecha: "2025-01-01" }), HOY, U)).error, /un año/);
  assert.ok(esquemaEnvio.safeParse(movimiento()).success);
  assert.ok(!esquemaEnvio.safeParse({ ...movimiento(), creadoEn: undefined }).success, "sin la hora en que se anotó no se puede saber qué es más reciente");
  assert.deepEqual(envioDe({ ...movimiento(), usuarioId: U, etiqueta: "x", estado: "pendiente", intentos: 0 }), movimiento(), "viaja con la hora en que se anotó");
});

test("corrales: la pantalla, el formulario con señal, la ayuda y los atajos están conectados", () => {
  const pantalla = leer("components/campo/PantallaCampo.tsx");
  assert.match(pantalla, /<MoverCampo /);
  assert.match(pantalla, /ancla === "corrales"/, "«#corrales» abre directo esa parte");
  assert.match(leer("components/campo/MoverCampo.tsx"), /leerMovimiento\(/, "valida con la misma regla que con señal");
  assert.match(leer("app/(app)/hato/corrales/actions.ts"), /leerMovimiento\(/);
  assert.match(leer("components/FormMover.tsx"), /tipo: "movimiento"/, "mover con señal guarda en el celular si se cae la señal");
  for (const f of ["components/FormMover.tsx", "components/FormMovimiento.tsx", "components/FormUbicacion.tsx"]) assert.match(leer(f), /accionConRespaldo\(/, `${f}: no rompe la pantalla sin señal`);
  assert.match(leer("components/FormMover.tsx"), /<AvisoGuardadoLocal \/>/);
  assert.ok(ATAJOS.some((a) => a.href === "/campo#corrales" && a.modulo === "corrales"), "«Mover animales sin señal» en «Al grano»");
  assert.match(leer("app/(app)/hato/Corrales.tsx"), /<EnlaceSinSenal [^>]*ancla="corrales"/);
  assert.match(leer("app/api/campo/enviar/route.ts"), /e\.tipo === "movimiento" && !puede\.corrales/);
  assert.match(leer("components/MotorCampo.tsx"), /referencia\.puede\.corrales/);
  assert.ok(AYUDA_CAMPO.puntos.some((p) => /corral o potrero/.test(p.texto)));
});

// ───────────────────────── Compras ─────────────────────────

const PRODUCTO = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const PROVEEDOR = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
const VET = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1";
const compra = (campos = {}, extra = {}) => ({
  tipo: "compra", id: uuid(60), fincaId: FINCA, animalId: uuid(60), fecha: HOY,
  campos: { fecha: HOY, rubro: "concentrado", descripcion: "Concentrado", producto_id: PRODUCTO, cantidad: "4", unidad: "bultos", monto: "250.000", destino_tipo: "finca", pago: "pagado", ...campos },
  ...extra,
});
const baseCompras = () => {
  const recordados = [];
  const db = baseFalsa(
    {
      gastos: [],
      finca_productos: [{ id: PRODUCTO, finca_id: FINCA, tipo: "compra", rubro: "concentrado" }],
      finca_terceros: [{ id: PROVEEDOR, finca_id: FINCA, nombre: "Agro El Llano", tipo: "proveedor", activo: true }],
      productos_veterinarios: [{ id: VET, finca_id: FINCA, nombre: "Ivermectina" }],
      animales: animales(),
    },
    { recordar_precio_producto: (args) => (recordados.push(args), { data: null, error: null }) },
  );
  db.recordados = recordados;
  return db;
};

test("compras: las reglas del formulario con señal valen sin señal (una sola definición)", () => {
  const ok = esquemaCompra.safeParse(compra().campos);
  assert.ok(ok.success);
  assert.equal(ok.data.monto, 250000, "punto de miles a la colombiana");
  assert.equal(revisarCompra(ok.data, FINCA, HOY), null);
  assert.match(revisarCompra({ ...ok.data, fecha: "2099-01-01" }, FINCA, HOY), /futura/);
  assert.match(revisarCompra({ ...ok.data, pagado_en: "2026-11-01" }, FINCA, HOY), /antes de la fecha/);
  assert.match(esquemaCompra.safeParse({ ...compra().campos, destino_tipo: "animal" }).error.issues[0].message, /Elige el animal/);
  assert.match(leer("app/(app)/hato/gastos/actions.ts"), /esquemaCompra\.safeParse\(/, "el formulario con señal usa la misma regla");
});

test("servidor: una compra sin señal se guarda con su identificador; reenviarla no la duplica", async () => {
  const db = baseCompras();
  assert.deepEqual(await guardarCompraCampo(db, compra({ tercero_id: PROVEEDOR }), "hacienda", HOY), { ok: true, estado: "guardado" });
  const g = db.tablas.gastos[0];
  assert.deepEqual([g.monto, g.cantidad, g.proveedor, g.pagado_en, g.client_request_id, g.destino_tipo], [250000, 4, "Agro El Llano", HOY, uuid(60), "finca"]);
  assert.deepEqual(db.recordados.map((r) => r.p_precio), [62500], "recuerda el precio por unidad para la próxima");
  assert.deepEqual(await guardarCompraCampo(db, compra(), "hacienda", HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.gastos.length, 1);
});

test("servidor: un proveedor nuevo anotado sin señal se crea una sola vez (o se usa el que ya existe)", async () => {
  const db = baseCompras();
  assert.equal((await guardarCompraCampo(db, compra({ proveedor_nuevo: "  agro el llano " }), "hacienda", HOY)).ok, true);
  assert.equal(db.tablas.finca_terceros.length, 1, "mismo nombre sin mayúsculas: no se duplica");
  assert.equal(db.tablas.gastos[0].tercero_id, PROVEEDOR);
  assert.equal((await guardarCompraCampo(db, compra({ proveedor_nuevo: "Veterinaria Central" }, { id: uuid(61) }), "hacienda", HOY)).ok, true);
  assert.equal(db.tablas.finca_terceros.length, 2);
  assert.equal(db.tablas.gastos[1].proveedor, "Veterinaria Central");
});

test("servidor: una compra sin señal rechaza lo que con señal se rechaza", async () => {
  const db = baseCompras();
  assert.match((await guardarCompraCampo(db, compra({ rubro: "forraje" }), "hacienda", HOY)).error, /no corresponde a ese rubro/);
  assert.match((await guardarCompraCampo(db, compra({ fecha: "2099-01-01" }), "hacienda", HOY)).error, /futura/);
  assert.match((await guardarCompraCampo(db, compra({ rubro: "mano_obra", producto_id: "" }), "hacienda", HOY)).error, /Equipo/);
  const droga = { rubro: "vacunas_desparasitantes", producto_id: "", descripcion: "Ivermectina 500 ml", monto: "80000", cantidad: "" };
  assert.match((await guardarCompraCampo(db, compra(droga), "hacienda", HOY)).error, /lote/, "con Sanidad en el plan, la droga exige su lote");
  assert.deepEqual(await guardarCompraCampo(db, compra({ ...droga, producto_vet_id: VET, lote_producto: "L-7" }, { id: uuid(62) }), "hacienda", HOY), { ok: true, estado: "guardado" });
  assert.equal(db.tablas.gastos.at(-1).lote_producto, "L-7");
  assert.equal(db.tablas.gastos.length, 1, "lo rechazado no dejó nada");
  assert.ok(esquemaEnvio.safeParse(compra()).success);
  assert.deepEqual(envioDe({ ...compra(), usuarioId: U, etiqueta: "x", creadoEn: "2026-11-20T10:00:00Z", estado: "pendiente", intentos: 0 }), compra());
});

test("compras: la pantalla, el formulario con señal, la ayuda y los atajos están conectados", () => {
  const pantalla = leer("components/campo/PantallaCampo.tsx");
  assert.match(pantalla, /<CompraCampo /);
  assert.match(pantalla, /ancla === "compra"/);
  assert.match(pantalla, /<ProveedorMoneda moneda=\{referencia\.finca\.moneda/, "el dinero se escribe en la moneda de la finca");
  assert.match(leer("components/campo/CompraCampo.tsx"), /esquemaCompra\.safeParse\([\s\S]*revisarCompra\(/, "valida con las mismas reglas que con señal");
  const form = leer("components/FormGasto.tsx");
  assert.match(form, /accionConRespaldo\(/);
  assert.match(form, /tipo: "compra"/, "una compra nueva con señal queda en el celular si se cae la señal");
  assert.match(form, /<AvisoGuardadoLocal \/>/);
  assert.match(leer("app/(app)/mas/productos/actions.ts"), /asegurarTercero\(/, "el selector de proveedores usa la misma regla que el envío sin señal");
  assert.ok(ATAJOS.some((a) => a.href === "/campo#compra" && a.modulo === "contabilidad"), "«Compra sin señal» en «Al grano»");
  assert.match(leer("app/(app)/hato/Gastos.tsx"), /<EnlaceSinSenal [^>]*ancla="compra"/);
  assert.match(leer("app/api/campo/enviar/route.ts"), /e\.tipo === "compra" && !puede\.compras/);
  assert.match(leer("components/MotorCampo.tsx"), /referencia\.puede\.compras/);
  assert.ok(AYUDA_CAMPO.puntos.some((p) => /una compra/.test(p.texto)));
});

// ───────────────────────── Ventas ─────────────────────────

const QUESO = "a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5";
const LECHE = "a6a6a6a6-a6a6-4a6a-8a6a-a6a6a6a6a6a6";
const COMPRADOR = "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5";
const venta = (campos = {}, extra = {}) => ({
  tipo: "venta", id: uuid(50), fincaId: FINCA, animalId: uuid(50), fecha: HOY,
  campos: { fecha: HOY, producto_id: QUESO, cantidad: "3,5", unidad: "kg", precio_unitario: "18.000", cobro: "por_cobrar", cobro_vence: "2026-11-30", ...campos },
  ...extra,
});
const baseVentas = () => {
  const recordados = [];
  const db = baseFalsa(
    {
      ventas: [],
      finca_productos: [{ id: QUESO, finca_id: FINCA, tipo: "venta", automatico: false }, { id: LECHE, finca_id: FINCA, tipo: "venta", automatico: true }],
      finca_terceros: [{ id: COMPRADOR, finca_id: FINCA, nombre: "Quesera La Vega", tipo: "comprador", activo: true }],
    },
    { recordar_precio_producto: (args) => (recordados.push(args), { data: null, error: null }) },
  );
  db.recordados = recordados;
  return db;
};

test("ventas: las reglas del formulario con señal valen sin señal (una sola definición)", () => {
  const ok = esquemaVenta.safeParse(venta().campos);
  assert.ok(ok.success);
  assert.deepEqual([ok.data.cantidad, ok.data.precio_unitario], [3.5, 18000], "coma decimal y punto de miles a la colombiana");
  assert.equal(revisarVenta(ok.data, HOY), null);
  assert.match(revisarVenta({ ...ok.data, fecha: "2099-01-01" }, HOY), /futura/);
  assert.match(revisarVenta({ ...ok.data, cobro_vence: "2026-11-01" }, HOY), /vencer antes/);
  assert.match(leer("app/(app)/hato/ventas/actions.ts"), /esquemaVenta\.safeParse\(/, "el formulario con señal usa la misma regla");
});

test("servidor: una venta sin señal se guarda con su identificador; reenviarla no la duplica", async () => {
  const db = baseVentas();
  assert.deepEqual(await guardarVentaCampo(db, venta({ tercero_id: COMPRADOR }), HOY), { ok: true, estado: "guardado" });
  const v = db.tablas.ventas[0];
  assert.deepEqual([v.cantidad, v.precio_unitario, v.tercero_id, v.cobrado_en, v.cobro_vence, v.client_request_id], [3.5, 18000, COMPRADOR, null, "2026-11-30", uuid(50)]);
  assert.deepEqual(db.recordados.map((r) => r.p_precio), [18000], "recuerda el precio para la próxima");
  assert.deepEqual(await guardarVentaCampo(db, venta(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.ventas.length, 1);
});

test("servidor: un comprador nuevo anotado sin señal se crea una sola vez; lo que entra solo no se vende a mano", async () => {
  const db = baseVentas();
  assert.equal((await guardarVentaCampo(db, venta({ comprador_nuevo: "QUESERA LA VEGA" }), HOY)).ok, true);
  assert.equal(db.tablas.finca_terceros.length, 1, "mismo nombre sin mayúsculas: no se duplica");
  assert.equal(db.tablas.ventas[0].tercero_id, COMPRADOR);
  assert.equal((await guardarVentaCampo(db, venta({ comprador_nuevo: "Doña Rosa" }, { id: uuid(51) }), HOY)).ok, true);
  assert.equal(db.tablas.finca_terceros.length, 2);
  assert.match((await guardarVentaCampo(db, venta({ producto_id: LECHE }, { id: uuid(52) }), HOY)).error, /se registra solo/);
  assert.match((await guardarVentaCampo(db, venta({ fecha: "2099-01-01" }, { id: uuid(53) }), HOY)).error, /futura/);
  assert.match((await guardarVentaCampo(db, venta({ cantidad: "0" }, { id: uuid(54) }), HOY)).error, /mayor que cero/);
  assert.equal(db.tablas.ventas.length, 2, "lo rechazado no dejó nada");
  assert.ok(esquemaEnvio.safeParse(venta()).success);
  assert.deepEqual(envioDe({ ...venta(), usuarioId: U, etiqueta: "x", creadoEn: "2026-11-20T10:00:00Z", estado: "pendiente", intentos: 0 }), venta());
});

test("ventas: la pantalla, el formulario con señal, la ayuda y los atajos están conectados", () => {
  const pantalla = leer("components/campo/PantallaCampo.tsx");
  assert.match(pantalla, /<VentaCampo /);
  assert.match(pantalla, /ancla === "venta"/);
  assert.match(leer("components/campo/VentaCampo.tsx"), /esquemaVenta\.safeParse\([\s\S]*revisarVenta\(/, "valida con las mismas reglas que con señal");
  const form = leer("components/FormVenta.tsx");
  assert.match(form, /accionConRespaldo\(/);
  assert.match(form, /tipo: "venta"/, "una venta nueva con señal queda en el celular si se cae la señal");
  assert.match(form, /<AvisoGuardadoLocal \/>/);
  assert.ok(ATAJOS.some((a) => a.href === "/campo#venta" && a.modulo === "contabilidad"), "«Venta sin señal» en «Al grano»");
  assert.match(leer("app/(app)/hato/Ventas.tsx"), /<EnlaceSinSenal [^>]*ancla="venta"/);
  assert.match(leer("app/api/campo/enviar/route.ts"), /e\.tipo === "venta" && !puede\.ventas/);
  assert.match(leer("components/MotorCampo.tsx"), /referencia\.puede\.ventas/);
  assert.ok(AYUDA_CAMPO.puntos.some((p) => /una venta/.test(p.texto)));
});

// ───────────────────────── Dar de baja ─────────────────────────

const baja = (campos = {}, extra = {}) => ({ tipo: "baja", id: uuid(40), fincaId: FINCA, animalId: A1, fecha: HOY, campos: { tipo: "muerte", fecha: HOY, motivo: "sanidad", ...campos }, ...extra });
const baseBajas = (extra = {}) => baseFalsa({ animales: animales(), bajas: [], finca_terceros: [{ id: COMPRADOR, finca_id: FINCA, nombre: "Quesera La Vega", tipo: "comprador", activo: true }], ...extra });

test("bajas: lo anotado en el celular se valida con la misma regla que la ficha", () => {
  const venta = entradaBajaDeCampos(A1, { tipo: "venta", fecha: HOY, valor: "450.000", ivaTarifa: "19", cobro: "por_cobrar", cobroVence: "2026-11-30", destinoConsumo: "si", pesoKg: "38,5", guiaMovilizacion: "G-1", detalle: "x" }, uuid(1));
  const d = esquemaBaja.parse(venta);
  assert.deepEqual([d.valor, d.ivaTarifa, d.cobro, d.cobroVence, d.destinoConsumo, d.pesoKg, d.clientRequestId], [450000, 19, "por_cobrar", "2026-11-30", true, 38.5, uuid(1)], "números a la colombiana y «va para consumo»");
  const muerte = esquemaBaja.parse(entradaBajaDeCampos(A1, { tipo: "muerte", fecha: HOY, valor: "1000", pesoKg: "30", destinoConsumo: "si" }));
  assert.deepEqual([muerte.valor, muerte.pesoKg, muerte.destinoConsumo], [undefined, undefined, false], "una muerte no lleva valor, peso ni consumo");
  assert.match(esquemaBaja.safeParse(entradaBajaDeCampos(A1, { fecha: HOY })).error.issues[0].message, /qué pasó/);
  assert.ok(!esquemaBaja.safeParse(entradaBajaDeCampos(A1, { tipo: "venta", fecha: HOY, valor: "mucho" })).success, "un valor que no es número no pasa");
  const r = (id, animalId, estado = "pendiente") => ({ id, tipo: "baja", usuarioId: U, fincaId: FINCA, animalId, estado });
  assert.deepEqual([...conBajaPendiente([r(uuid(1), A1), r(uuid(2), A2, "enviado"), r(uuid(3), MACHO)], U, FINCA, uuid(3))], [A1], "lo enviado y lo que se corrige vuelven a ofrecerse");
  assert.match(leer("app/(app)/hato/actions.ts"), /esquemaBaja\.safeParse\([\s\S]*filaBaja\(/, "la ficha usa la misma regla y la misma fila");
});

test("servidor: una baja sin señal se guarda con su identificador; reenviarla no la duplica ni da error", async () => {
  const db = baseBajas();
  assert.deepEqual(await guardarBajaCampo(db, baja(), HOY), { ok: true, estado: "guardado" });
  const b = db.tablas.bajas[0];
  assert.deepEqual([b.animal_id, b.tipo, b.motivo, b.client_request_id, b.valor, b.peso_kg], [A1, "muerte", "sanidad", uuid(40), null, null]);
  db.tablas.animales.find((a) => a.id === A1).estado = "muerto"; // lo hace la base al registrar la baja
  assert.deepEqual(await guardarBajaCampo(db, baja(), HOY), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.bajas.length, 1);
});

test("servidor: una baja sin señal nunca pisa la salida que registró otra persona", async () => {
  const db = baseBajas();
  db.tablas.bajas.push({ finca_id: FINCA, animal_id: A1, tipo: "venta", fecha: "2026-11-18", client_request_id: uuid(99) });
  db.tablas.animales.find((a) => a.id === A1).estado = "vendido";
  const r = await guardarBajaCampo(db, baja(), HOY);
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /101 ya salió del hato \(venta del 18 de nov\)[\s\S]*No se registró otra salida/);
  assert.equal(db.tablas.bajas.length, 1);
  // Carrera: el animal seguía activo al leerlo, pero otra baja entró antes de insertar (choca con la del animal, no con la nuestra).
  const carrera = baseBajas({ bajas: [{ finca_id: FINCA, animal_id: A2, tipo: "muerte", fecha: HOY, client_request_id: null }] });
  assert.equal((await guardarBajaCampo(carrera, baja({}, { animalId: A2, id: uuid(41) }), HOY)).codigo, "conflicto");
});

test("servidor: una venta sin señal con comprador nuevo; rechaza lo que la ficha rechaza", async () => {
  const db = baseBajas();
  const v = baja({ tipo: "venta", motivo: "", valor: "450.000", cobro: "cobrado", compradorNuevo: "Frigorífico del Norte", pesoKg: "38,5", guiaMovilizacion: "ICA-123" }, { id: uuid(42), animalId: MACHO });
  assert.deepEqual(await guardarBajaCampo(db, v, HOY), { ok: true, estado: "guardado" });
  const b = db.tablas.bajas[0];
  assert.deepEqual([b.valor, b.comprador, b.cobrado_en, b.peso_kg, b.guia_movilizacion], [450000, "Frigorífico del Norte", HOY, 38.5, "ICA-123"]);
  assert.equal(db.tablas.finca_terceros.length, 2, "el comprador nuevo queda en la lista");
  assert.match((await guardarBajaCampo(db, baja({ fecha: "2026-01-01" }, { id: uuid(43) }), HOY)).error, /anterior al nacimiento/, "Lucía nació el 10 de enero");
  assert.match((await guardarBajaCampo(db, baja({ fecha: "2099-01-01" }, { id: uuid(44) }), HOY)).error, /futura/);
  assert.match((await guardarBajaCampo(db, baja({}, { id: uuid(45), animalId: uuid(7) }), HOY)).error, /ya no está en la finca/);
  assert.ok(esquemaEnvio.safeParse(baja()).success);
  assert.deepEqual(envioDe({ ...baja(), usuarioId: U, etiqueta: "x", creadoEn: "2026-11-20T10:00:00Z", estado: "pendiente", intentos: 0 }), baja());
});

test("bajas: la pantalla, la ficha con señal, el filtro del Hato, la ayuda y los atajos están conectados", () => {
  const pantalla = leer("components/campo/PantallaCampo.tsx");
  assert.match(pantalla, /<BajaCampo /);
  assert.match(pantalla, /ancla === "baja"/);
  assert.match(leer("components/campo/BajaCampo.tsx"), /esquemaBaja\.safeParse\(entradaBajaDeCampos\(/);
  const form = leer("components/FormBaja.tsx");
  assert.match(form, /esFallaDeRed\(e\)[\s\S]*guardarRespaldo\([\s\S]*tipo: "baja"/, "si se cae la señal, la baja queda en el celular");
  assert.match(form, /clientRequestId: solicitud/, "un doble toque no registra otra baja");
  assert.match(form, /leerNumero\(valor\)/, "el valor se lee a la colombiana");
  assert.doesNotMatch(form, /replace\(",", "\."\)/);
  assert.match(leer("components/ListaHato.tsx"), /Ningún animal ha salido del hato/, "el filtro «Dados de baja» vacío tiene su propio estado vacío");
  assert.match(leer("app/(app)/hato/[id]/baja/page.tsx"), /<EnlaceSinSenal [^>]*ancla="baja"/);
  assert.ok(ATAJOS.some((a) => a.href === "/campo#baja" && a.modulo === "hato"), "«Dar de baja sin señal» en «Al grano»");
  assert.match(leer("app/api/campo/enviar/route.ts"), /e\.tipo === "baja" && !puede\.hato/);
  assert.match(leer("supabase/migrations/20261121161427_bajas_client_request_id.sql"), /add column if not exists client_request_id uuid[\s\S]*bajas_client_req_uk/);
  assert.ok(AYUDA_CAMPO.puntos.some((p) => /dar de baja/.test(p.texto)));
});

// ───────────────────────── Partos ─────────────────────────

/** `registrar_parto` de mentira: idempotente por `client_request_id`; guarda el parto, sus crías y los animales de las crías con arete. */
function registrarPartoFalso(args, tablas) {
  const crid = args.p_parto.client_request_id;
  const previo = (tablas.partos ?? []).find((x) => x.finca_id === args.p_finca && crid && x.client_request_id === crid);
  if (previo) return { data: { parto_id: previo.id, repetido: true, sin_crear: [] }, error: null };
  const id = `dddddddd-dddd-4ddd-8ddd-${String((tablas.partos ?? []).length).padStart(12, "0")}`;
  (tablas.partos ??= []).push({ id, finca_id: args.p_finca, ...args.p_parto });
  for (const c of args.p_crias) {
    if (c.arete) (tablas.animales ??= []).push({ id: crypto.randomUUID(), finca_id: args.p_finca, numero_arete: c.arete, sexo: c.sexo, madre_id: args.p_parto.madre_id, padre_id: args.p_parto.padre_id, estado: "activo", deleted_at: null, client_request_id: c.id ?? null });
    (tablas.crias ??= []).push({ parto_id: id, ...c });
  }
  return { data: { parto_id: id, repetido: false, sin_crear: [] }, error: null };
}
const SERVICIO = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";
const parto = (campos = {}, extra = {}) => ({
  tipo: "parto", id: uuid(30), fincaId: FINCA, animalId: A1, fecha: HOY,
  campos: { fecha: HOY, tipo: "normal", crias: JSON.stringify([{ sexo: "hembra", vivo: true, peso: "3,2", arete: "501" }, { sexo: "macho", vivo: false }]), ...campos },
  ...extra,
});
const basePartos = (extra = {}) => baseFalsa(
  {
    animales: animales(),
    partos: [],
    servicios: [{ id: SERVICIO, finca_id: FINCA, hembra_id: A1, fecha: "2026-06-20", macho_id: MACHO, macho_externo: null }],
    v_repro_hembras: [{ animal_id: A1, finca_id: FINCA, estado: "gestante", servicio_id: SERVICIO, ultimo_servicio: "2026-06-20" }],
    ...extra,
  },
  { registrar_parto: registrarPartoFalso },
);

test("partos: reglas del celular (crías, aretes guardados, hembras que esperan parir)", () => {
  assert.equal(revisarCrias([{ sexo: "hembra", vivo: true, arete: "A" }, { sexo: "macho", vivo: true, arete: "a" }]), "Dos crías tienen el mismo arete. Cámbialo.");
  assert.match(revisarCrias([{ sexo: "hembra", vivo: false, arete: "A" }]), /nació muerta/);
  assert.match(revisarCrias([{ vivo: true, arete: "A" }]), /sexo/);
  assert.equal(revisarCrias([{ sexo: "hembra", vivo: true }, { vivo: false }]), null);
  assert.deepEqual(aretesDeCrias(parto().campos.crias), ["501"]);
  assert.deepEqual(aretesDeCrias("no es json"), []);
  const registro = { ...parto(), usuarioId: U, etiqueta: "", creadoEn: "2026-11-20T10:00:00Z", estado: "pendiente", intentos: 0 };
  assert.equal(areteRepetido(" 501 ", { animales: [] }, [registro]), true, "el arete de una cría de un parto guardado en el celular cuenta");
  assert.equal(areteRepetido("501", { animales: [] }, [registro], registro.id), false, "salvo al corregir ese mismo parto");
  assert.deepEqual([...conPartoPendiente([registro], U, FINCA)], [A1]);
  const h = (arete, estado) => ({ id: arete, arete, nombre: null, especie: "caprino", nacimiento: null, estado, ultimoServicio: null });
  assert.deepEqual(hembrasParaParto([h("3", "vacia"), h("2", "servida"), h("1", "gestante")]).map((x) => x.arete), ["1", "2", "3"]);
  assert.match(leer("app/(app)/reproduccion/actions.ts"), /prepararParto\(/, "la ficha usa la misma regla");
});

test("servidor: un parto sin señal se liga al servicio en curso, crea la cría con arete y reenviarlo no lo duplica", async () => {
  const db = basePartos();
  assert.deepEqual(await guardarPartoCampo(db, parto()), { ok: true, estado: "guardado" });
  const pt = db.tablas.partos[0];
  assert.deepEqual([pt.madre_id, pt.servicio_id, pt.padre_id, pt.client_request_id, pt.tipo], [A1, SERVICIO, MACHO, uuid(30), "normal"]);
  assert.deepEqual(db.tablas.crias.map((c) => [c.arete, c.vivo, c.peso]), [["501", true, 3.2], [null, false, null]]);
  assert.ok(db.tablas.animales.some((a) => a.numero_arete === "501" && a.madre_id === A1));
  assert.deepEqual(await guardarPartoCampo(db, parto()), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.partos.length, 1);
});

test("servidor: la cría con arete guarda el identificador que le dio el celular (para traducir lo anotado sobre ella)", async () => {
  const db = basePartos();
  const id = uuid(95);
  assert.deepEqual(await guardarPartoCampo(db, parto({ crias: JSON.stringify([{ id, sexo: "macho", vivo: true, arete: "777" }]) })), { ok: true, estado: "guardado" });
  const cria = db.tablas.animales.find((a) => a.numero_arete === "777");
  assert.equal(cria.client_request_id, id);
  assert.equal((await traducirAnimalesLocales(db, { id: uuid(96), tipo: "peso", fincaId: FINCA, animalId: id, fecha: HOY, peso: 3 })).animalId, cria.id);
});

test("servidor: un parto sin señal nunca duplica el que registró otra persona; rechaza lo que la ficha rechaza", async () => {
  const db = basePartos({ partos: [{ id: "x", finca_id: FINCA, madre_id: A1, fecha: "2026-11-05", client_request_id: null }] });
  const r = await guardarPartoCampo(db, parto());
  assert.equal(r.codigo, "conflicto");
  assert.match(r.error, /101 ya tiene un parto el 5 de nov[\s\S]*No se registró otro/);
  assert.equal(db.tablas.partos.length, 1);
  assert.match((await guardarPartoCampo(basePartos(), parto({ crias: JSON.stringify([{ sexo: "hembra", vivo: true, arete: "101" }]) }))).error, /101 ya está en tu hato/);
  assert.match((await guardarPartoCampo(basePartos(), parto({ tipo: "asistido" }))).error, /quién asistió/);
  assert.match((await guardarPartoCampo(basePartos(), parto({ tipo: "aborto", crias: "" }))).error, /causa aparente/);
  assert.deepEqual(await guardarPartoCampo(basePartos(), parto({ tipo: "aborto", causa_aborto: "desconocida", crias: "" })), { ok: true, estado: "guardado" });
  assert.match((await guardarPartoCampo(basePartos(), parto({ fecha: "2026-06-01" }))).error, /posterior al nacimiento|posterior al servicio/);
  assert.match((await guardarPartoCampo(basePartos(), parto({}, { animalId: MACHO }))).error, /hembra/);
  assert.ok(esquemaEnvio.safeParse(parto()).success);
});

test("partos: la pantalla, la ficha con señal, la ayuda y los atajos están conectados", () => {
  const pantalla = leer("components/campo/PantallaCampo.tsx");
  assert.match(pantalla, /<PartoCampo /);
  assert.match(pantalla, /ancla === "parto"/);
  assert.match(leer("components/campo/PartoCampo.tsx"), /esquemaParto\.safeParse\([\s\S]*datosPorTipoParto\([\s\S]*revisarCrias\(/);
  const form = leer("components/FormParto.tsx");
  assert.match(form, /accionConRespaldo\(/);
  assert.match(form, /tipo: "parto"/, "un parto nuevo con señal queda en el celular si se cae la señal");
  assert.match(form, /<AvisoGuardadoLocal \/>/);
  assert.match(leer("app/(app)/hato/[id]/reproduccion/parto/nuevo/page.tsx"), /<EnlaceSinSenal [^>]*ancla="parto"/);
  assert.ok(ATAJOS.some((a) => a.href === "/campo#parto" && a.modulo === "reproduccion"), "«Parto sin señal» en «Al grano»");
  assert.match(leer("app/api/campo/enviar/route.ts"), /e\.tipo === "parto"\) && !puede\.reproduccion/);
  assert.ok(AYUDA_CAMPO.puntos.some((p) => /un parto/.test(p.texto)));
});

// ───────────────────────── Pantalla de entrada ─────────────────────────

test("entrada: la lista de lo que se anota sin señal es la de la pantalla «Registrar sin señal»", () => {
  const titulos = [...leer("components/campo/PantallaCampo.tsx").matchAll(/<TarjetaOpcion [^>]*titulo="([^"]+)"/g)].map((m) => m[1]).filter((t) => t !== "Guardado");
  assert.equal(REGISTROS_SIN_SENAL.length, titulos.length, `una entrada por opción de la pantalla (${titulos.join(", ")})`);
  assert.equal(textoRegistrosSinSenal(), "Animal nuevo, ordeño, pesos, monta, diagnóstico de gestación, parto y crías, sanidad, mover de corral, lo que se dio de comer, despacho de leche, compras, ventas y dar de baja");
});

test("entrada: el formulario no borra lo escrito y explica qué hacer sin señal", () => {
  const form = leer("components/FormAuth.tsx");
  assert.match(form, /onSubmit=\{\(e\) => \{\s*e\.preventDefault\(\)/, "se envía con onSubmit: un error no borra el correo escrito");
  assert.doesNotMatch(form, /action=\{enviar\}/);
  assert.match(form, /if \(esFallaDeRed\(e\)\) return \{ error: SIN_SENAL_ENTRAR \};\s*throw e;/, "sin señal, un aviso en vez de romper la pantalla; los demás errores siguen igual");
  assert.match(SIN_SENAL_ENTRAR, /no se puede entrar[\s\S]*sigue aquí/);
  assert.match(leer("app/login/page.tsx"), /<SinSenalAcceso \/>/);
  const acceso = leer("components/SinSenalAcceso.tsx");
  assert.match(acceso, /leerReferencia\(\)/, "ofrece «Registrar sin señal» solo si el celular ya quedó listo");
  assert.match(acceso, /href=\{RUTA_CAMPO\}/);
  assert.match(acceso, /href="#sin-senal"/);
  const pres = leer("components/presentacion/Presentacion.tsx");
  assert.match(pres, /<Seccion id="sin-senal"/);
  assert.match(pres, /REGISTROS_SIN_SENAL\.map\(\(r\) => \([\s\S]*<TarjetaOpcion [^>]*escena=\{ESCENA_OPCION_CAMPO\[r\.vista\]\}[^>]*estatica \/>/, "tarjetas con las mismas escenas de «Registrar sin señal»");
  assert.match(pres, /<FilaTarjetasDeLado /, "de lado en celular y computador");
  assert.doesNotMatch(leer("components/FilaTarjetasDeLado.tsx"), /lg:grid/, "en el computador no se vuelve rejilla: sigue de lado");
  assert.match(leer("components/FilaTarjetasDeLado.tsx"), /useArrastrarParaDesplazar/, "en el computador se arrastra con el mouse");
  assert.match(pres, /está en el menú \(en el celular, dentro de «Más»\) y en «Al grano», pestaña «Registrar»/, "el paso 2 dice dónde está de verdad");
  assert.match(leer("components/campo/PantallaCampo.tsx"), /ESCENA_OPCION_CAMPO/, "la pantalla del celular usa las mismas escenas");
  assert.match(pres, /\["#sin-senal", "Sin señal"\]/, "enlace en la barra de arriba");
  assert.match(pres, /¿Funciona donde no hay señal\?/);
  assert.match(leer("app/manifest.ts"), /name: "Registrar sin señal"[^}]*partos/, "el atajo del ícono ya no dice solo «ordeño y pesos»");
  assert.match(leer("public/offline.html"), /href="\/campo">Registrar sin señal<\/a>/);
  assert.equal(PLANES[0].id, "cria");
  assert.ok(PLANES[0].funciones.some((f) => /^Registra sin señal/.test(f)), "el plan inicial dice que se registra sin señal");
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
  const atajo = ATAJOS.find((a) => a.href === "/campo" && a.menu === "sinSenal" && a.tipo === "registrar");
  assert.ok(atajo, "«Registrar sin señal» está en «Al grano», pestaña «Registrar», para quien lo ve en el menú");
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

test("lo creado sin señal se usa de inmediato: animal nuevo, crías con arete, madre al ordeño; la baja guardada lo saca", () => {
  const puede = { leche: true, pesos: true, reproduccion: true, sanidad: true, corrales: true, hato: true, contabilidad: false };
  const ref = {
    finca: { id: FINCA, nombre: "La Esperanza" }, puede,
    animales: [{ id: A1, arete: "101", nombre: "Lucía", sexo: "hembra", especie: "caprino", activo: true, ubicacion: null }, { id: MACHO, arete: "200", nombre: "Toro", sexo: "macho", especie: "caprino", activo: true, ubicacion: null }],
    hembras: [{ id: A1, arete: "101", nombre: "Lucía", especie: "caprino", nacimiento: null, estado: "servida", ultimoServicio: "2026-06-01" }],
    machos: [{ id: MACHO, arete: "200", nombre: "Toro", especie: "caprino" }],
    pesar: [{ id: MACHO, arete: "200", nombre: "Toro", ceba: false, ultimoPeso: null, ultimaFecha: null }],
    ordeno: [],
  };
  const base = { usuarioId: U, fincaId: FINCA, etiqueta: "", fecha: HOY, creadoEn: "2026-11-20T10:00:00Z", estado: "pendiente" };
  const nuevo = { ...base, id: uuid(80), tipo: "animal", animalId: uuid(80), campos: { numero_arete: " 900 ", nombre: "Nube", sexo: "hembra", especie: "caprino", fecha_ultimo_parto: "2026-11-01" } };
  const cria = uuid(82);
  const parto = { ...base, id: uuid(81), tipo: "parto", animalId: A1, creadoEn: "2026-11-20T11:00:00Z", campos: { tipo: "normal", crias: JSON.stringify([{ id: cria, sexo: "macho", vivo: true, arete: "901" }, { sexo: "hembra", vivo: true }, { id: uuid(83), sexo: "hembra", vivo: false, arete: "902" }]) } };
  const r = referenciaConPendientes(ref, [nuevo, parto], U);
  assert.deepEqual(r.animales.map((a) => a.arete), ["101", "200", "900", "901"], "solo las crías vivas con arete y lo que no tiene error");
  assert.equal(r.animales.find((a) => a.arete === "900").origen, nuevo.id);
  assert.equal(r.animales.find((a) => a.arete === "901").especie, "caprino", "la cría toma la especie de la madre");
  assert.deepEqual(r.ordeno.map((h) => h.arete), ["900", "101"], "la nueva con último parto y la madre del parto entran al ordeño");
  assert.ok(r.hembras.some((h) => h.id === nuevo.id) && r.machos.some((m) => m.id === cria));
  assert.ok(r.pesar.some((a) => a.id === cria));
  assert.equal(areteRepetido("900", r, [nuevo, parto], nuevo.id), false, "al corregir el animal nuevo, su propio arete no cuenta");
  assert.equal(areteRepetido("901", r, [nuevo, parto], parto.id), false, "al corregir el parto, el arete de su cría no cuenta");
  assert.equal(areteRepetido("901", r, [nuevo, parto]), true);

  assert.equal(referenciaConPendientes(ref, [{ ...nuevo, estado: "error" }], U), ref, "un registro con error no crea nada");
  assert.equal(referenciaConPendientes(ref, [{ ...nuevo, usuarioId: "otro" }], U), ref, "lo de otra persona en el mismo celular no cuenta");
  assert.ok(!referenciaConPendientes(ref, [{ ...parto, campos: { tipo: "aborto", crias: "" } }], U).ordeno.length, "un aborto no abre ordeño");

  const baja = { ...base, id: uuid(84), tipo: "baja", animalId: MACHO, campos: {} };
  const sinToro = referenciaConPendientes(ref, [baja], U);
  assert.ok(!sinToro.machos.length && !sinToro.pesar.length, "la baja guardada lo saca de las listas");
  assert.equal(sinToro.animales.find((a) => a.id === MACHO).activo, false, "sigue en la copia (para corregir esa baja) pero ya no activo");
});

test("al enviar, el identificador del celular de un animal nuevo o de una cría se traduce al real", async () => {
  const REAL = uuid(90);
  const LOCAL = uuid(91);
  const db = baseFalsa({ animales: [...animales(), { id: REAL, finca_id: FINCA, numero_arete: "901", client_request_id: LOCAL }] });
  const peso = { id: uuid(92), tipo: "peso", fincaId: FINCA, animalId: LOCAL, fecha: HOY, peso: 4 };
  assert.equal((await traducirAnimalesLocales(db, peso)).animalId, REAL);
  const sanidad = { id: uuid(93), tipo: "sanidad", fincaId: FINCA, animalId: LOCAL, animales: [LOCAL, A1], fecha: HOY, campos: {} };
  assert.deepEqual((await traducirAnimalesLocales(db, sanidad)).animales, [REAL, A1], "los que ya existen no cambian");
  const animal = { id: LOCAL, tipo: "animal", fincaId: FINCA, animalId: LOCAL, fecha: HOY, campos: { madre_id: LOCAL } };
  const t = await traducirAnimalesLocales(db, animal);
  assert.equal(t.animalId, LOCAL, "el animal nuevo conserva su propio identificador");
  assert.equal(t.campos.madre_id, REAL, "su madre creada sin señal se traduce");
  const intacto = { id: uuid(94), tipo: "peso", fincaId: FINCA, animalId: A1, fecha: HOY, peso: 4 };
  assert.equal(await traducirAnimalesLocales(db, intacto), intacto, "sin nada que traducir devuelve el mismo envío");
});

test("servidor: lo que se dio de comer sin señal usa el peso del bulto que tiene la finca, valida el destino y reenviarlo no lo duplica", async () => {
  const CORRAL = uuid(50);
  const SAL = uuid(54), HENO = uuid(55), JERINGAS = uuid(56);
  const tablas = () => ({
    finca_productos: [
      { id: SAL, finca_id: FINCA, nombre: "Sal mineralizada", tipo: "compra", rubro: "sales_suplementos", unidad: "bultos", kg_por_unidad: 40 },
      { id: HENO, finca_id: FINCA, nombre: "Heno", tipo: "compra", rubro: "forraje", unidad: "pacas", kg_por_unidad: null },
      { id: JERINGAS, finca_id: FINCA, nombre: "Jeringas", tipo: "compra", rubro: "vacunas_desparasitantes", unidad: "unidades", kg_por_unidad: null },
    ],
    ubicaciones: [{ id: CORRAL, finca_id: FINCA, nombre: "Corral 1" }],
    lotes_ceba: [],
  });
  const envio = (campos) => ({ tipo: "alimento", id: uuid(51), fincaId: FINCA, animalId: uuid(51), fecha: HOY, campos: { producto_id: SAL, cantidad: "1,5", unidad: "unidad", fecha: HOY, destino: `ubicacion:${CORRAL}`, ...campos } });
  const db = baseFalsa(tablas());
  assert.deepEqual(await guardarSalidaAlimentoCampo(db, envio()), { ok: true, estado: "guardado" });
  const m = db.tablas.inventario_alimento_movimientos[0];
  assert.deepEqual([m.tipo, m.cantidad, m.ubicacion_id, m.lote_id, m.client_request_id], ["salida", 60, CORRAL, null, uuid(51)], "1,5 bultos de 40 kg = 60 kg");
  assert.deepEqual(await guardarSalidaAlimentoCampo(db, envio()), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.inventario_alimento_movimientos.length, 1);
  assert.match((await guardarSalidaAlimentoCampo(baseFalsa(tablas()), envio({ producto_id: HENO }))).error, /peso de cada unidad/);
  assert.match((await guardarSalidaAlimentoCampo(baseFalsa(tablas()), envio({ producto_id: JERINGAS }))).error, /No encontramos ese alimento/, "una compra que no es alimento no sale del inventario de alimento");
  assert.match((await guardarSalidaAlimentoCampo(baseFalsa(tablas()), envio({ destino: `lote:${uuid(52)}` }))).error, /No encontramos ese lote/);
  assert.match((await guardarSalidaAlimentoCampo(baseFalsa(tablas()), envio({ cantidad: "0" }))).error, /más de 0/);
  assert.match(leer("app/(app)/inventario/alimento/actions.ts"), /prepararSalida\(/, "con señal usa la misma regla");
});

test("servidor: un despacho de leche sin señal crea el comprador nuevo, queda por cobrar, recuerda el precio y reenviarlo no lo duplica", async () => {
  const precios = [];
  const rpcs = { recordar_precio_producto: (args) => (precios.push(args.p_precio), { data: null, error: null }) };
  const tablas = () => ({ finca_terceros: [], finca_productos: [{ id: "f3", finca_id: FINCA, clave: "leche_cruda" }] });
  const envio = (campos) => ({ tipo: "despacho", id: uuid(53), fincaId: FINCA, animalId: uuid(53), fecha: HOY, campos: { fecha: HOY, litros: "120,5", destino_tipo: "queseria", comprador_nuevo: "  Quesera   La Vega ", precio_litro: "2.500", cobro: "por_cobrar", cobro_vence: HOY, ...campos } });
  const db = baseFalsa(tablas(), rpcs);
  assert.deepEqual(await guardarDespachoCampo(db, envio()), { ok: true, estado: "guardado" });
  const d = db.tablas.despachos_leche[0];
  assert.deepEqual([d.litros, d.precio_litro, d.comprador, d.cobrado_en, d.cobro_vence, d.client_request_id], [120.5, 2500, "Quesera La Vega", null, HOY, uuid(53)]);
  assert.equal(d.tercero_id, db.tablas.finca_terceros[0].id);
  assert.deepEqual(precios, [2500], "el precio queda como el habitual de la leche");
  assert.deepEqual(await guardarDespachoCampo(db, envio()), { ok: true, estado: "ya_estaba" });
  assert.equal(db.tablas.despachos_leche.length, 1);
  const sinPrecio = baseFalsa(tablas(), rpcs);
  await guardarDespachoCampo(sinPrecio, envio({ precio_litro: "", comprador_nuevo: "" }));
  assert.deepEqual([sinPrecio.tablas.despachos_leche[0].cobrado_en, sinPrecio.tablas.despachos_leche[0].iva_tarifa], [null, null], "sin precio todavía no es una venta");
  assert.match((await guardarDespachoCampo(baseFalsa(tablas(), rpcs), envio({ litros: "" }))).error, /litros/);
  assert.match((await guardarDespachoCampo(baseFalsa(tablas(), rpcs), envio({ cobro_vence: "2026-01-01" }))).error, /no puede vencer antes/);
  assert.match(leer("app/(app)/leche/gestion.ts"), /leerDespacho\(/, "con señal usa la misma regla");
});
