// Lo que antes estaba copiado en varias pantallas y ahora tiene una sola definición: leer filas por páginas, texto, descargas y reglas de seguimiento.
import test from "node:test";
import assert from "node:assert/strict";
import { enTramos, leerTodo, paginar, traerTodo } from "../lib/consultas.ts";
import { sinTildes } from "../lib/texto.ts";
import { cabecerasExcel, nombreAscii } from "../lib/archivos.ts";
import { diasDesde } from "../lib/fechas.ts";
import { entraEnCeba } from "../lib/ceba-candidatos.ts";
import { conRevisionAtrasada, plazosRevisionPezuna, revisionAtrasada } from "../lib/sanidad.ts";
import { contarFamacha, FAMACHA, PUNTAJES_FAMACHA, GUIA_FAMACHA } from "../lib/famacha.ts";
import { enUltimoTercio, partoAtrasado, partoProximo, porConfirmar, porRepetir, porSecar, seguimientoServida } from "../lib/reproduccion.ts";

const hoy = "2026-10-24";

// ───────────────────────── Leer filas por páginas ─────────────────────────
/** Una «base» de n filas que responde como PostgREST: nunca más de 1000 por llamada. */
const base = (n, { falla = null } = {}) => {
  const llamadas = [];
  const pagina = async (desde, hasta) => {
    llamadas.push([desde, hasta]);
    if (falla !== null && llamadas.length === falla) return { data: null, error: { message: "se cayó" } };
    const hasta2 = Math.min(hasta, n - 1, desde + 999);
    return { data: desde >= n ? [] : Array.from({ length: hasta2 - desde + 1 }, (_, i) => desde + i), error: null };
  };
  return { pagina, llamadas };
};

test("traerTodo: trae todas las filas aunque la base corte en 1000, sin repetir ni perder ninguna", async () => {
  const b = base(2500);
  const { filas, truncado } = await traerTodo(b.pagina);
  assert.equal(filas.length, 2500);
  assert.equal(new Set(filas).size, 2500, "ninguna repetida");
  assert.equal(truncado, false);
  assert.equal(b.llamadas.length, 3, "1000 + 1000 + 500");
});

test("traerTodo: una cantidad exacta de páginas termina con una página vacía y no se cuelga", async () => {
  const b = base(2000);
  const { filas } = await traerTodo(b.pagina);
  assert.equal(filas.length, 2000);
  assert.equal(b.llamadas.length, 3);
  assert.equal((await traerTodo(base(0).pagina)).filas.length, 0);
});

test("traerTodo: si llega al tope avisa que quedó incompleto en vez de fingir que es todo", async () => {
  const { filas, truncado } = await traerTodo(base(10_000).pagina, { tope: 3000 });
  assert.equal(filas.length, 3000);
  assert.equal(truncado, true);
  const justo = await traerTodo(base(3000).pagina, { tope: 3000 });
  assert.equal(justo.truncado, false, "3000 filas con tope 3000 no es truncar");
});

test("traerTodo: un error de la base se propaga y no devuelve datos a medias", async () => {
  await assert.rejects(() => traerTodo(base(5000, { falla: 2 }).pagina), /se cayó/);
});

test("paginar: sin tope trae todo (la exportación de la finca) y respeta el tamaño de página de las funciones de la base", async () => {
  const b = base(2500);
  let total = 0;
  for await (const p of paginar(b.pagina, 1000, Infinity)) total += p.filas.length;
  assert.equal(total, 2500);
  // Una función de la base que devuelve hasta 5000 por llamada.
  const llamadas = [];
  const rpc = async (d, h) => {
    llamadas.push(h - d + 1);
    return { data: Array.from({ length: d >= 7000 ? 0 : Math.min(5000, 7000 - d) }, (_, i) => d + i), error: null };
  };
  assert.equal((await traerTodo(rpc, { porPagina: 5000, tope: 50_000 })).filas.length, 7000);
  assert.deepEqual(llamadas, [5000, 5000]);
});

test("leerTodo: tiene la forma { data } de una respuesta, así reemplaza a un .limit() sin cambiar el resto del código, y trae más de 1000", async () => {
  const r = await leerTodo(base(1800).pagina);
  assert.equal(r.data.length, 1800);
  assert.equal(r.truncado, false);
  await assert.rejects(() => leerTodo(base(3000, { falla: 2 }).pagina), /se cayó/, "un error se lanza, no deja una lista vacía que parezca cierta");
});

test("enTramos: parte una lista sin perder ni repetir", () => {
  const t = enTramos(Array.from({ length: 250 }, (_, i) => i));
  assert.deepEqual(t.map((x) => x.length), [100, 100, 50]);
  assert.deepEqual(enTramos([]), []);
});

// ───────────────────────── Texto y descargas ─────────────────────────
test("sinTildes: busca «cabra» y encuentra «Cábra»", () => {
  assert.equal(sinTildes("Cábra Ñandú"), "cabra nandu");
  assert.equal(sinTildes("Rendimiento DE sementales"), "rendimiento de sementales");
});

test("descargas: el nombre lleva tildes completas y una versión ASCII de respaldo, sin comillas que rompan la cabecera", () => {
  assert.equal(nombreAscii('Aprisco "La Ñapa" - Inventario.xlsx'), "Aprisco 'La Napa' - Inventario.xlsx");
  const h = cabecerasExcel("Finca Año - Partos.xlsx");
  assert.match(h["Content-Disposition"], /^attachment; filename="Finca Ano - Partos\.xlsx"; filename\*=UTF-8''Finca%20A%C3%B1o%20-%20Partos\.xlsx$/);
  assert.equal(h["Cache-Control"], "no-store");
  assert.match(h["Content-Type"], /spreadsheetml/);
});

test("diasDesde: positivo si ya pasó, negativo si aún no llega", () => {
  assert.equal(diasDesde("2026-10-14", hoy), 10);
  assert.equal(diasDesde("2026-10-30", hoy), -6);
  assert.equal(diasDesde(hoy, hoy), 0);
});

// ───────────────────────── Sanidad: revisiones de pezuñas y FAMACHA ─────────────────────────
test("revisión atrasada: nunca hecha o más vieja que los días de la finca; el último día todavía está al día", () => {
  assert.deepEqual(revisionAtrasada(null, 120, hoy), { vence: null, diasAtraso: null });
  assert.equal(revisionAtrasada("2026-06-26", 120, hoy), null, "vence el 24 de octubre: hoy todavía está al día");
  assert.deepEqual(revisionAtrasada("2026-06-25", 120, hoy), { vence: "2026-10-23", diasAtraso: 1 });
  assert.equal(revisionAtrasada("2026-10-01", 30, hoy), null);
});

test("revisión atrasada: es exactamente la cuenta que antes se hacía a mano en cuatro pantallas", () => {
  // La regla vieja: sin fecha, o fecha anterior a (hoy − días). Se prueba con muchas fechas para que no cambie en ningún borde.
  const limite = (dias) => new Date(Date.UTC(2026, 9, 24) - dias * 86_400_000).toISOString().slice(0, 10);
  for (const dias of [7, 30, 120]) {
    for (let atras = 0; atras < 400; atras++) {
      const fecha = new Date(Date.UTC(2026, 9, 24) - atras * 86_400_000).toISOString().slice(0, 10);
      const vieja = !fecha || fecha < limite(dias);
      assert.equal(revisionAtrasada(fecha, dias, hoy) !== null, vieja, `${dias} días, hace ${atras}`);
    }
  }
  const lista = [{ animal_id: "a", ultima_fecha: null }, { animal_id: "b", ultima_fecha: "2026-10-20" }, { animal_id: "c", ultima_fecha: "2026-01-01" }];
  assert.deepEqual(conRevisionAtrasada(lista, 30, hoy).map((r) => r.animal_id), ["a", "c"]);
});

test("plazos de pezuñas: el pediluvio es más seguido en los meses de lluvia", () => {
  const ajustes = { podologia_inspeccion_dias: 120, pediluvio_dias: 30, pediluvio_dias_lluvia: 15, meses_lluvia: [4, 5, 10, 11] };
  assert.deepEqual(plazosRevisionPezuna(ajustes, "2026-10-24"), { podologiaDias: 120, pediluvioDias: 15 });
  assert.deepEqual(plazosRevisionPezuna(ajustes, "2026-02-10"), { podologiaDias: 120, pediluvioDias: 30 });
});

test("FAMACHA: cuenta por desparasitar y por vigilar; lo ya tratado no cuenta", () => {
  const f = (puntaje, desparasitado_en = null) => ({ puntaje, ultima_fecha: "2026-10-10", desparasitado_en });
  assert.deepEqual(contarFamacha([f(4), f(5), f(3), f(5, "2026-10-12"), f(3, "2026-10-12"), f(1)]), { desparasitar: 2, vigilar: 1 });
  assert.deepEqual(contarFamacha([]), { desparasitar: 0, vigilar: 0 });
});

test("FAMACHA: cada puntaje trae su descripción, su acción y su color para la guía del formulario", () => {
  for (const n of PUNTAJES_FAMACHA) {
    const f = FAMACHA[n];
    assert.ok(f.color && f.texto && f.detalle && f.accion, `puntaje ${n}`);
    assert.match(f.mucosa, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(new Set(PUNTAJES_FAMACHA.map((n) => FAMACHA[n].mucosa)).size, 5, "cinco colores distintos");
  assert.ok(GUIA_FAMACHA.pasos.length >= 3 && GUIA_FAMACHA.notas.length >= 3);
});

// ───────────────────────── Reproducción: seguimiento ─────────────────────────
const hembra = (extra) => ({ estado: "gestante", diagnostico: null, fecha_diagnostico: null, ultimo_servicio: "2026-06-01", fecha_prevista_parto: "2026-10-29", en_lactancia: false, ...extra });
const ventana = { desde: 45, hasta: 60 };

test("parto próximo y atrasado: los bordes de 45 días y de 7 días de atraso", () => {
  const con = (prevista, estado = "gestante") => hembra({ estado, fecha_prevista_parto: prevista });
  assert.equal(partoProximo(con("2026-12-08"), hoy), true, "en 45 días");
  assert.equal(partoProximo(con("2026-12-09"), hoy), false, "en 46");
  assert.equal(partoProximo(con("2026-10-17"), hoy), true, "debió parir hace 7 días: aún es «próximo»");
  assert.equal(partoProximo(con("2026-10-16"), hoy), false);
  assert.equal(partoAtrasado(con("2026-10-17"), hoy), false);
  assert.equal(partoAtrasado(con("2026-10-16"), hoy), true, "8 días de atraso");
  assert.equal(partoProximo(con("2026-10-29", "servida"), hoy), true, "una servida también tiene fecha prevista");
  assert.equal(partoProximo(con("2026-10-29", "vacia"), hoy), false);
  assert.equal(partoProximo(con(null), hoy), false);
});

test("último tercio y por secar: solo gestantes confirmadas, y secar solo las que están en lactancia", () => {
  assert.equal(enUltimoTercio(hembra({}), hoy, 100), true, "145 días de gestación");
  assert.equal(enUltimoTercio(hembra({}), hoy, 150), false);
  assert.equal(enUltimoTercio(hembra({ estado: "servida" }), hoy, 100), false);
  assert.equal(enUltimoTercio(hembra({ fecha_prevista_parto: "2026-10-20" }), hoy, 100), false, "ya pasó la fecha: no es «último tercio», es atrasada");
  assert.equal(porSecar(hembra({ en_lactancia: true }), hoy, 60), true);
  assert.equal(porSecar(hembra({ en_lactancia: false }), hoy, 60), false);
  assert.equal(porSecar(hembra({ en_lactancia: true, fecha_prevista_parto: "2027-01-10" }), hoy, 60), false, "faltan 78 días");
});

test("seguimiento de una servida: ventana del diagnóstico, diagnósticos dudosos y quién no aplica", () => {
  const servida = (ultimo_servicio, extra = {}) => hembra({ estado: "servida", ultimo_servicio, fecha_prevista_parto: null, ...extra });
  assert.deepEqual(seguimientoServida(servida("2026-09-24"), hoy, ventana), { clase: "diagnostico", estado: "pronto", dias: 30, desde: "2026-11-08", hasta: "2026-11-23" });
  assert.equal(seguimientoServida(servida("2026-09-09"), hoy, ventana).estado, "toca", "45 días: el primer día de la ventana");
  assert.equal(seguimientoServida(servida("2026-08-25"), hoy, ventana).estado, "toca", "60 días: el último");
  assert.equal(seguimientoServida(servida("2026-08-24"), hoy, ventana).estado, "atrasado");
  const dudosa = servida("2026-09-20", { diagnostico: "dudoso", fecha_diagnostico: "2026-10-06" });
  assert.deepEqual(seguimientoServida(dudosa, hoy, ventana), { clase: "repetir", estado: "toca", dias: 18, desde: "2026-10-20", hasta: "2026-10-27" });
  assert.equal(seguimientoServida(hembra({ estado: "gestante" }), hoy, ventana), null);
  assert.equal(seguimientoServida(servida(null), hoy, ventana), null);
});

test("por confirmar y por repetir: lo que cuenta el Resumen de Reproducción y la alerta de la ficha", () => {
  const servida = (ultimo_servicio, extra = {}) => hembra({ estado: "servida", ultimo_servicio, fecha_prevista_parto: null, ...extra });
  assert.equal(porConfirmar(servida("2026-09-24"), hoy, ventana), false, "todavía es pronto");
  assert.equal(porConfirmar(servida("2026-09-09"), hoy, ventana), true);
  assert.equal(porConfirmar(servida("2026-06-01"), hoy, ventana), true, "atrasada también cuenta como por confirmar");
  const dudosa = servida("2026-09-20", { diagnostico: "dudoso", fecha_diagnostico: "2026-10-06" });
  assert.equal(porConfirmar(dudosa, hoy, ventana), false, "una dudosa se repite, no se confirma");
  assert.equal(porRepetir(dudosa, hoy, ventana), true);
  assert.equal(porRepetir(servida("2026-09-20", { diagnostico: "dudoso", fecha_diagnostico: "2026-10-15" }), hoy, ventana), false, "9 días: aún no");
});

test("Ceba: una cría con solo el peso al nacer no aparece; un animal pesado de verdad o en un lote abierto, sí", () => {
  const abiertos = new Set(["lote-1"]);
  const reciente = "2026-07-29";
  // Cría nacida hace 10 días: su único «peso» es el del nacimiento (n_pesajes = 0).
  assert.deepEqual(entraEnCeba({ lote_id: null, n_pesajes: 0, fecha_ultimo: "2026-10-17" }, abiertos, reciente), { entra: false, enLoteAbierto: false });
  // Pesado de verdad hace poco, sin lote.
  assert.deepEqual(entraEnCeba({ lote_id: null, n_pesajes: 2, fecha_ultimo: "2026-10-01" }, abiertos, reciente), { entra: true, enLoteAbierto: false });
  // Pesado hace mucho, sin lote: sale.
  assert.equal(entraEnCeba({ lote_id: null, n_pesajes: 3, fecha_ultimo: "2026-05-01" }, abiertos, reciente).entra, false);
  // En un lote abierto entra aunque no tenga pesos.
  assert.deepEqual(entraEnCeba({ lote_id: "lote-1", n_pesajes: 0, fecha_ultimo: null }, abiertos, reciente), { entra: true, enLoteAbierto: true });
  // Lote ya cerrado: cuenta como sin lote y solo entra si lo pesaron hace poco.
  assert.deepEqual(entraEnCeba({ lote_id: "lote-0", n_pesajes: 1, fecha_ultimo: "2026-10-01" }, abiertos, reciente), { entra: true, enLoteAbierto: false });
  assert.equal(entraEnCeba({ lote_id: "lote-0", n_pesajes: 0, fecha_ultimo: "2026-10-01" }, abiertos, reciente).entra, false);
});

test("invitación: solo se ofrece aceptar con el correo invitado; con otra sesión se explica y se deja cambiar de cuenta", async () => {
  const { estadoInvitacion } = await import("../lib/invitacion.ts");
  const resumen = { email: "Vet@Correo.com", rol: "veterinario", finca_nombre: "El Mirador" };
  assert.deepEqual(estadoInvitacion(resumen, "vet@correo.com "), { tipo: "lista", invitado: "Vet@Correo.com" }, "no importan mayúsculas ni espacios");
  assert.deepEqual(estadoInvitacion(resumen, "propietario@correo.com"), { tipo: "otro_correo", invitado: "Vet@Correo.com", sesion: "propietario@correo.com" });
  assert.deepEqual(estadoInvitacion(null, "vet@correo.com"), { tipo: "no_valida" }, "vencida, usada o inexistente");
});

test("invitación: el acceso de una persona es sin invitación, pendiente, vencida o aceptada", async () => {
  const { estadoAcceso } = await import("../lib/invitacion.ts");
  const ahora = new Date("2026-10-28T12:00:00Z");
  assert.equal(estadoAcceso(null, ahora), "sin_invitacion");
  assert.equal(estadoAcceso({ aceptada_en: null, expira_en: "2026-11-04T00:00:00Z" }, ahora), "pendiente");
  assert.equal(estadoAcceso({ aceptada_en: null, expira_en: "2026-10-27T00:00:00Z" }, ahora), "vencida", "una vencida sigue ocupando el correo: hay que poder renovarla");
  assert.equal(estadoAcceso({ aceptada_en: "2026-10-20T00:00:00Z", expira_en: "2026-10-27T00:00:00Z" }, ahora), "aceptada", "aceptada manda aunque ya haya vencido");
});

test("invitación: el correo prellenado en Entrar y Crear cuenta solo vale si se llega desde una invitación", async () => {
  const { correoDeInvitacion } = await import("../lib/invitacion.ts");
  assert.equal(correoDeInvitacion("/invitacion/abc", " Vet@Correo.com "), "vet@correo.com");
  assert.equal(correoDeInvitacion("/hato", "vet@correo.com"), undefined, "otro destino: no se rellena");
  assert.equal(correoDeInvitacion("/invitacion/abc", "no-es-correo"), undefined);
  assert.equal(correoDeInvitacion("/invitacion/abc", undefined), undefined);
  assert.equal(correoDeInvitacion(undefined, "vet@correo.com"), undefined);
});

import { agruparPorTipo } from "../lib/animal.ts";
test("listas de animales: se agrupan en cabras, cabros, ovejas y carneros, en ese orden", () => {
  const g = agruparPorTipo([
    { id: 1, especie: "ovino", sexo: "macho" },
    { id: 2, especie: "caprino", sexo: "macho" },
    { id: 3, especie: "caprino", sexo: "hembra" },
    { id: 4, especie: "ovino", sexo: "hembra" },
    { id: 5, especie: "caprino", sexo: "hembra" },
  ]);
  assert.deepEqual(g.map((x) => [x.titulo, x.items.map((i) => i.id)]), [["Cabras", [3, 5]], ["Cabros", [2]], ["Ovejas", [4]], ["Carneros", [1]]]);
  // Sin especie ni sexo (listas que no los traen) queda un solo grupo sin título, en el orden recibido.
  assert.deepEqual(agruparPorTipo([{ id: 1 }, { id: 2 }]).map((x) => [x.titulo, x.items.length]), [[null, 2]]);
});

import { interpretarHpg, eficaciaDesparasitante, textoResultado } from "../lib/coprologico.ts";
test("coprológico: el nivel de HPG sigue los cortes de referencia", () => {
  assert.equal(interpretarHpg(0).nivel, "bajo");
  assert.equal(interpretarHpg(249).nivel, "bajo");
  assert.equal(interpretarHpg(250).nivel, "moderado");
  assert.equal(interpretarHpg(999).nivel, "moderado");
  assert.equal(interpretarHpg(1000).nivel, "alto");
  assert.equal(interpretarHpg(2999).nivel, "alto");
  assert.equal(interpretarHpg(3000).nivel, "muy_alto");
  assert.equal(textoResultado({ hpg: 1200, opg: null }), "1.200 HPG");
  assert.equal(textoResultado({ hpg: 300, opg: 5000 }), "300 HPG · 5.000 OPG");
});

test("coprológico: la prueba de eficacia compara promedios de los animales con examen antes y después", () => {
  assert.equal(eficaciaDesparasitante([{ animal_id: "a", momento: "antes", hpg: 1000 }]), null);
  const filas = (antes, despues) => antes.flatMap((h, i) => [{ animal_id: `a${i}`, momento: "antes", hpg: h }, { animal_id: `a${i}`, momento: "despues", hpg: despues[i] }]);
  const eficaz = eficaciaDesparasitante(filas([1000, 2000], [20, 40]));
  assert.equal(eficaz.reduccion, 98);
  assert.equal(eficaz.veredicto, "eficaz");
  assert.equal(eficaz.orientativo, true);
  assert.equal(eficaciaDesparasitante(filas([1000], [70])).veredicto, "dudoso");
  assert.equal(eficaciaDesparasitante(filas([1000], [300])).veredicto, "resistencia");
  // Un animal sin examen «después» no cuenta.
  assert.equal(eficaciaDesparasitante([...filas([1000], [10]), { animal_id: "x", momento: "antes", hpg: 5000 }]).n, 1);
});

import { estanciaEn, ordenarHitos, textoEdad, diasEntre } from "../lib/trazabilidad.ts";
test("trazabilidad: dónde estaba en una fecha según sus movimientos", () => {
  const m = [
    { ubicacion_id: "maternidad", desde: "2026-03-01", hasta: "2026-03-20" },
    { ubicacion_id: "crias", desde: "2026-03-20", hasta: "2026-06-01" },
    { ubicacion_id: "levante", desde: "2026-06-01", hasta: null },
  ];
  assert.equal(estanciaEn(m, "2026-02-28"), null);
  assert.equal(estanciaEn(m, "2026-03-01").ubicacion_id, "maternidad");
  assert.equal(estanciaEn(m, "2026-03-19").ubicacion_id, "maternidad");
  // El día del traslado ya está en la nueva instalación.
  assert.equal(estanciaEn(m, "2026-03-20").ubicacion_id, "crias");
  assert.equal(estanciaEn(m, "2026-10-28").ubicacion_id, "levante");
});

test("trazabilidad: hitos en orden de fecha y edad en texto", () => {
  const h = ordenarHitos([
    { clave: "b", fecha: "2026-03-02", tipo: "peso", titulo: "Pesaje" },
    { clave: "a", fecha: "2026-03-01", tipo: "ubicacion", titulo: "Entró" },
    { clave: "n", fecha: "2026-03-01", tipo: "nacimiento", titulo: "Nació" },
  ]);
  assert.deepEqual(h.map((x) => x.clave), ["n", "a", "b"]);
  assert.equal(diasEntre("2026-03-01", "2026-03-11"), 10);
  assert.equal(textoEdad("2026-03-01", "2026-03-02"), "1 día");
  assert.equal(textoEdad("2026-03-01", "2026-03-11"), "10 días");
  assert.equal(textoEdad("2026-03-01", "2026-06-01"), "3 meses");
  assert.equal(textoEdad("2026-03-01", "2026-02-01"), "aún no había nacido");
});
