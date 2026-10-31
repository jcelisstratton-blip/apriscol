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

import { etapaDe, porcentajePesoAdulto, pesoAdultoReferencia, avisosMezcla, contarEtapas } from "../lib/etapas.ts";
const CRIT = { desteteDias: 60, servicioEdadMeses: 7, servicioPesoPct: 65, pesoAdultoKg: 50 };
test("etapas: lactante, levante y lista para monta según edad y peso relativo", () => {
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 30, pesoKg: 8 }, CRIT), "lactante");
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 150, pesoKg: 20 }, CRIT), "levante_hembra");
  // 7 meses pero sin el 65 % del peso adulto (32,5 kg): sigue en levante.
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 230, pesoKg: 28 }, CRIT), "levante_hembra");
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 230, pesoKg: 34 }, CRIT), "lista_monta");
  // Sin peso o sin referencia solo cuenta la edad.
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 230, pesoKg: null }, CRIT), "lista_monta");
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 230, pesoKg: 10 }, { ...CRIT, pesoAdultoKg: null }), "lista_monta");
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 400, pesoKg: 30, tienePartos: true }, CRIT), "hembra_adulta");
  assert.equal(etapaDe({ sexo: "hembra", edadDias: 800, pesoKg: 45 }, CRIT), "hembra_adulta");
  assert.equal(etapaDe({ sexo: "hembra", edadDias: null, pesoKg: 45 }, CRIT), null);
});
test("etapas: los machos se separan desde el destete", () => {
  assert.equal(etapaDe({ sexo: "macho", edadDias: 40, pesoKg: 9 }, CRIT), "lactante");
  assert.equal(etapaDe({ sexo: "macho", edadDias: 120, pesoKg: 22 }, CRIT), "levante_macho");
  assert.equal(etapaDe({ sexo: "macho", edadDias: 120, pesoKg: 22, enLoteCeba: true }, CRIT), "ceba");
  assert.equal(etapaDe({ sexo: "macho", edadDias: 120, pesoKg: 22, usoMacho: "carne" }, CRIT), "ceba");
  assert.equal(etapaDe({ sexo: "macho", edadDias: 900, pesoKg: 70, usoMacho: "reproductor" }, CRIT), "reproductor");
  assert.equal(etapaDe({ sexo: "macho", edadDias: 900, pesoKg: 70 }, CRIT), "macho_adulto");
  assert.equal(porcentajePesoAdulto(28, 45), 62);
  assert.equal(porcentajePesoAdulto(28, null), null);
  assert.equal(pesoAdultoReferencia(42, [1, 2, 3]), 42);
  assert.equal(pesoAdultoReferencia(null, [40, 50]), null);
  assert.equal(pesoAdultoReferencia(null, [40, 50, 45]), 45);
});
test("etapas: avisos de mezcla en un corral (nunca bloquean; maternidad no avisa)", () => {
  const o = (etapa, sexo, pesoKg = null) => ({ etapa, sexo, pesoKg });
  const claves = (x, uso = "general") => avisosMezcla(x, uso, 1.5).map((a) => a.clave);
  assert.deepEqual(claves([o("lactante", "hembra"), o("hembra_adulta", "hembra")]), ["lactantes_con_grandes"]);
  assert.deepEqual(claves([o("lactante", "hembra"), o("hembra_adulta", "hembra")], "maternidad"), []);
  assert.deepEqual(claves([o("levante_macho", "macho"), o("levante_hembra", "hembra")]), ["machos_con_hembras"]);
  // Un reproductor con hembras, o cualquier macho en un corral de monta, es normal.
  assert.deepEqual(claves([o("reproductor", "macho"), o("hembra_adulta", "hembra")]), []);
  assert.deepEqual(claves([o("levante_macho", "macho"), o("hembra_adulta", "hembra")], "reproductoras"), []);
  assert.deepEqual(claves([o("hembra_adulta", "hembra", 60), o("levante_hembra", "hembra", 25)]), ["pesos_distintos"]);
  assert.deepEqual(claves([o("hembra_adulta", "hembra", 40), o("levante_hembra", "hembra", 30)]), []);
  assert.deepEqual(contarEtapas([{ etapa: "ceba" }, { etapa: "lactante" }, { etapa: "ceba" }, { etapa: null }]), [{ etapa: "lactante", n: 1 }, { etapa: "ceba", n: 2 }]);
});

test("etapas: cada aviso de mezcla dice qué animales son, para filtrar la lista del corral", () => {
  const o = (id, etapa, sexo, pesoKg = null) => ({ id, etapa, sexo, pesoKg });
  const a = avisosMezcla([o("l1", "lactante", "hembra"), o("l2", "lactante", "macho"), o("m1", "levante_macho", "macho", 30), o("h1", "levante_hembra", "hembra", 15), o("h2", "levante_hembra", "hembra", 14)], "general", 1.5);
  const por = Object.fromEntries(a.map((x) => [x.clave, x.ver.ids.sort()]));
  assert.deepEqual(por.lactantes_con_grandes, ["l1", "l2"]);
  assert.deepEqual(por.machos_con_hembras, ["m1"]);
  assert.deepEqual(por.pesos_distintos, ["h2", "m1"]);
});

test("coprológico: una muestra contaminada (del piso) no cuenta en la prueba de eficacia", () => {
  const f = (m, hpg, muestra) => ({ animal_id: "a", momento: m, hpg, tipo_muestra: muestra });
  assert.equal(eficaciaDesparasitante([f("antes", 1000, "limpia"), f("despues", 10, "contaminada")]), null);
  assert.equal(eficaciaDesparasitante([f("antes", 1000, "limpia"), f("despues", 10, "limpia")]).reduccion, 99);
  // Los exámenes anteriores (sin dato) cuentan como antes.
  assert.equal(eficaciaDesparasitante([f("antes", 1000, null), f("despues", 10, undefined)]).reduccion, 99);
});

import { faltaEnNovedad, fechaDeNovedad, resumenNovedad, direccionParaRegistrar, productosParaTipo } from "../lib/novedades.ts";
test("novedades: cada tipo pide lo suyo, todo por selección", () => {
  assert.match(faltaEnNovedad({}), /qué quieres avisar/);
  assert.match(faltaEnNovedad({ tipo: "compra" }), /qué hace falta comprar/);
  assert.equal(faltaEnNovedad({ tipo: "compra", grupo_compra: "sanidad" }), null);
  assert.match(faltaEnNovedad({ tipo: "aplicacion" }), /qué se hizo/);
  assert.equal(faltaEnNovedad({ tipo: "aplicacion", tipo_evento: "vacunacion" }), null);
  assert.match(faltaEnNovedad({ tipo: "prueba", prueba: "cmt" }), /cómo salió/);
  assert.equal(faltaEnNovedad({ tipo: "prueba", prueba: "cmt", resultado_prueba: "positivo" }), null);
  assert.match(faltaEnNovedad({ tipo: "coprologico" }), /muestra/);
  assert.match(faltaEnNovedad({ tipo: "famacha" }), /puntaje/);
  assert.equal(faltaEnNovedad({ tipo: "famacha", puntaje: 4 }), null);
});
test("novedades: la fecha sale de tres opciones y el resumen se lee en una frase", () => {
  assert.equal(fechaDeNovedad("hoy", "2026-10-28"), "2026-10-28");
  assert.equal(fechaDeNovedad("ayer", "2026-10-28"), "2026-10-27");
  assert.equal(fechaDeNovedad("antes_de_ayer", "2026-10-01"), "2026-09-29");
  const base = { grupo_compra: null, compra_producto_nombre: null, tipo_evento: null, categoria: null, etapa: null, motivo: null, cojera: null, anestesia: null, categoria_producto: null, producto_nombre: null, via: null, lote: null, prueba: null, resultado_prueba: null, tipo_muestra: null, puntaje: null };
  assert.equal(resumenNovedad({ ...base, tipo: "aplicacion", tipo_evento: "vacunacion", categoria: "clostridiales", etapa: "primera", producto_nombre: "Clostridial", via: "subcutanea", lote: "CL7-1" }), "Vacunación · Clostridiosis y tétanos · Primera dosis · Clostridial · subcutánea · lote CL7-1");
  assert.equal(resumenNovedad({ ...base, tipo: "aplicacion", categoria_producto: "antibiotico", producto_nombre: "Penicilina", via: "intramuscular", lote: "ANT-1" }), "Aplicar dosis · Antibiótico · Penicilina · intramuscular · lote ANT-1");
  assert.match(resumenNovedad({ ...base, tipo: "coprologico", tipo_muestra: "contaminada" }), /contaminada \(recogida del piso\)/);
  assert.equal(resumenNovedad({ ...base, tipo: "compra", grupo_compra: "sanidad", compra_producto_nombre: "Ivermectina" }), "Comprar · Sanidad · Ivermectina");
  assert.equal(resumenNovedad({ ...base, tipo: "compra", grupo_compra: "alimentacion" }), "Comprar · Alimentación · Otro producto");
  assert.equal(direccionParaRegistrar({ id: "n1", tipo: "compra", animal_id: null, categoria_producto: null, tipo_evento: null }), "/hato/gastos/nuevo?novedad=n1");
  assert.equal(direccionParaRegistrar({ id: "n2", tipo: "aplicacion", animal_id: "a1", categoria_producto: null, tipo_evento: "vacunacion" }), "/hato/sanidad/nuevo?animal=a1&tipo=vacunacion");
});

test("novedades: el producto se ofrece según lo que se hizo", () => {
  const p = [{ tipo: "vacuna" }, { tipo: "desparasitante" }, { tipo: "antibiotico" }, { tipo: "vitamina" }];
  assert.deepEqual(productosParaTipo("vacunacion", p).map((x) => x.tipo), ["vacuna"]);
  assert.deepEqual(productosParaTipo("desparasitacion", p).map((x) => x.tipo), ["desparasitante"]);
  assert.deepEqual(productosParaTipo("tratamiento", p).map((x) => x.tipo), ["antibiotico", "vitamina"]);
  assert.equal(productosParaTipo("cirugia", p).length, 4);
});

import { atiendeNovedad, borraNovedadAjena, destinoNovedades, puedeEscribir, tiposNovedadQueCrea } from "../lib/permisos.ts";
test("novedades: cada perfil crea y atiende solo lo suyo (espejo de la base)", () => {
  assert.deepEqual(tiposNovedadQueCrea("ordenador"), ["compra", "aplicacion"]);
  assert.deepEqual(tiposNovedadQueCrea("veterinario"), ["compra"]);
  for (const rol of ["propietario", "administrador", "contador"]) assert.deepEqual(tiposNovedadQueCrea(rol), [], rol);
  assert.ok(!puedeEscribir("propietario", "novedades") && !puedeEscribir("administrador", "novedades"));
  assert.ok(puedeEscribir("propietario", "sanidad") && puedeEscribir("administrador", "contabilidad"));
  assert.ok(atiendeNovedad("administrador", "compra") && !atiendeNovedad("administrador", "aplicacion"));
  assert.ok(atiendeNovedad("veterinario", "aplicacion") && !atiendeNovedad("veterinario", "compra"));
  assert.ok(atiendeNovedad("propietario", "compra") && atiendeNovedad("propietario", "aplicacion"));
  assert.ok(!atiendeNovedad("ordenador", "compra") && !atiendeNovedad("contador", "aplicacion"));
  assert.deepEqual(["propietario", "administrador", "veterinario", "ordenador"].map(destinoNovedades), ["todas", "compra", "no_compra", null]);
  // Solo el administrador elimina novedades ajenas.
  assert.deepEqual(["propietario", "administrador", "veterinario", "ordenador", "contador"].map(borraNovedadAjena), [false, true, false, false, false]);
});

import {
  DIAS_AVISO_VENCIMIENTO,
  aUnidades,
  cambioDeAjuste,
  enPresentaciones,
  estadoStock,
  estadoVencimiento,
  faltaParaMinimo,
  pideAtencion,
  textoStock,
} from "../lib/inventario.ts";

const producto = { desde: "2026-10-01", stock: 50, stock_minimo: 20, vence_pronto: null };

test("inventario: el estado del stock sale del conteo y del mínimo", () => {
  assert.equal(estadoStock({ ...producto, desde: null, stock: null }), "sin_contar");
  assert.equal(estadoStock({ ...producto, stock: -3 }), "negativo");
  assert.equal(estadoStock({ ...producto, stock: 0 }), "agotado");
  assert.equal(estadoStock({ ...producto, stock: 20 }), "bajo", "en el mínimo ya es bajo");
  assert.equal(estadoStock({ ...producto, stock: 21 }), "ok");
  assert.equal(estadoStock({ ...producto, stock_minimo: null, stock: 1 }), "ok", "sin mínimo nunca es bajo");
});

test("inventario: vencimientos y cuándo pide atención", () => {
  const hoy = "2026-10-29";
  assert.equal(estadoVencimiento(null, hoy), null);
  assert.equal(estadoVencimiento("2026-10-28", hoy), "vencido");
  assert.equal(estadoVencimiento("2026-10-29", hoy), "pronto", "vence hoy todavía sirve, pero se avisa");
  assert.equal(estadoVencimiento("2026-11-28", hoy), DIAS_AVISO_VENCIMIENTO === 30 ? "pronto" : "ok");
  assert.equal(estadoVencimiento("2026-11-29", hoy), "ok");
  assert.equal(pideAtencion(producto, hoy), false);
  assert.equal(pideAtencion({ ...producto, vence_pronto: "2026-11-10" }, hoy), true);
  assert.equal(pideAtencion({ ...producto, stock: 5 }, hoy), true);
  assert.equal(pideAtencion({ desde: null, stock: null, stock_minimo: null, vence_pronto: null }, hoy), false, "por contar no es alerta");
});

test("inventario: presentaciones, textos y ajustes", () => {
  assert.equal(enPresentaciones(350, 100), 3.5);
  assert.equal(enPresentaciones(350, null), null);
  assert.equal(aUnidades(2.5, 100), 250);
  assert.equal(textoStock({ unidad: "ml", presentacion: "frasco", contenido_presentacion: 100 }, 350), "3,5 frascos · 350 ml");
  assert.equal(textoStock({ unidad: "ml", presentacion: "frasco", contenido_presentacion: 100 }, 100), "1 frasco · 100 ml");
  assert.equal(textoStock({ unidad: null, presentacion: null, contenido_presentacion: null }, 1250), "1.250 unidades");
  assert.equal(faltaParaMinimo({ stock: 8, stock_minimo: 20 }), 12);
  assert.equal(faltaParaMinimo({ stock: 30, stock_minimo: 20 }), null);
  // Conteo físico: lo contado menos lo que decía la app; los demás motivos siempre restan.
  assert.equal(cambioDeAjuste("conteo", 90, 100), -10);
  assert.equal(cambioDeAjuste("conteo", 110, 100), 10);
  assert.equal(cambioDeAjuste("conteo", 100, 100), null);
  assert.equal(cambioDeAjuste("vencido", 30, 100), -30);
  assert.equal(cambioDeAjuste("perdida", -5, 100), -5);
});

import {
  aKg,
  alimentoPideAtencion,
  autonomiaDias,
  consumoDiarioKg,
  estadoAlimento,
  faltaPeso,
  textoKg,
  unidadesDeCantidad,
} from "../lib/inventario-alimento.ts";

const alimento = { desde: "2026-10-01", stock_kg: 400, consumo_kg: 140, dias_con_salida: 14, unidad: "bultos", kg_por_unidad: 40 };

test("alimento: el consumo diario sale de los últimos 14 días (o de los que lleva contando)", () => {
  const hoy = "2026-10-29";
  assert.equal(consumoDiarioKg(alimento, hoy), 10);
  assert.equal(autonomiaDias(alimento, hoy), 40);
  // Lleva 5 días contando: el consumo se divide entre 5, no entre 14.
  assert.equal(consumoDiarioKg({ ...alimento, desde: "2026-10-25", consumo_kg: 50, dias_con_salida: 5 }, hoy), 10);
  // Con menos de 3 días con salidas no se inventa una cifra.
  assert.equal(consumoDiarioKg({ ...alimento, dias_con_salida: 2 }, hoy), null);
  assert.equal(autonomiaDias({ ...alimento, dias_con_salida: 2 }, hoy), null);
  assert.equal(autonomiaDias({ ...alimento, stock_kg: 0 }, hoy), null);
  assert.equal(consumoDiarioKg({ ...alimento, desde: null }, hoy), null);
});

test("alimento: el estado compara los días que alcanza con el plazo de aviso de Ajustes", () => {
  const hoy = "2026-10-29";
  assert.equal(estadoAlimento({ ...alimento, desde: null, stock_kg: null }, 7, hoy), "sin_contar");
  assert.equal(estadoAlimento({ ...alimento, stock_kg: -5 }, 7, hoy), "negativo");
  assert.equal(estadoAlimento({ ...alimento, stock_kg: 0 }, 7, hoy), "agotado");
  assert.equal(estadoAlimento({ ...alimento, stock_kg: 30 }, 7, hoy), "critico", "3 días < 3,5");
  assert.equal(estadoAlimento({ ...alimento, stock_kg: 60 }, 7, hoy), "bajo", "6 días");
  assert.equal(estadoAlimento({ ...alimento, stock_kg: 70 }, 7, hoy), "ok", "7 días ya alcanza el plazo");
  assert.equal(estadoAlimento({ ...alimento, dias_con_salida: 1 }, 7, hoy), "sin_datos");
  assert.equal(alimentoPideAtencion({ ...alimento, stock_kg: 60 }, 7, hoy), true);
  assert.equal(alimentoPideAtencion({ ...alimento, dias_con_salida: 1 }, 7, hoy), false, "sin datos no es alerta");
});

test("alimento: kg, bultos y el peso por unidad", () => {
  assert.equal(textoKg(alimento, 140), "140 kg · 3,5 bultos");
  assert.equal(textoKg({ unidad: "kg", kg_por_unidad: null }, 140), "140 kg");
  assert.equal(textoKg({ unidad: "bultos", kg_por_unidad: null }, 140), "140 kg");
  assert.equal(faltaPeso({ unidad: "bultos", kg_por_unidad: null }), true);
  assert.equal(faltaPeso({ unidad: "kg", kg_por_unidad: null }), false);
  assert.equal(faltaPeso({ unidad: "bultos", kg_por_unidad: 40 }), false);
  assert.deepEqual(unidadesDeCantidad({ unidad: "bultos", kg_por_unidad: 40 }).map((u) => [u.nombre, u.factor]), [["kg", 1], ["bultos", 40]]);
  assert.deepEqual(unidadesDeCantidad({ unidad: "kg", kg_por_unidad: null }).map((u) => u.nombre), ["kg"]);
  assert.equal(aKg(2.5, 40), 100);
});

import { singular } from "../lib/inventario-alimento.ts";
test("alimento: el singular de la unidad de compra", () => {
  assert.deepEqual(["bultos", "pacas", "unidades", "kg", "sacos"].map(singular), ["bulto", "paca", "unidad", "kg", "saco"]);
});

import { avisoCompraInventario } from "../lib/inventario-alimento.ts";
test("compras: avisa cuando no van a sumar al inventario y calla cuando sí suman", () => {
  const base = { conLoteVeterinario: false, productoVet: undefined };
  // Alimento: otra compra, sin peso por bulto, con peso y en kg.
  assert.match(avisoCompraInventario({ ...base, rubro: "concentrado", producto: null }), /elígela de la lista/);
  assert.match(avisoCompraInventario({ ...base, rubro: "forraje", producto: { unidad: "pacas", kg_por_unidad: null } }), /cuánto pesa cada paca/);
  assert.equal(avisoCompraInventario({ ...base, rubro: "concentrado", producto: { unidad: "bultos", kg_por_unidad: 40 } }), null);
  assert.equal(avisoCompraInventario({ ...base, rubro: "sales_suplementos", producto: { unidad: "kg", kg_por_unidad: null } }), null);
  // Medicamentos: sin producto veterinario, sin presentación y completo.
  const vet = { conLoteVeterinario: true, producto: null, rubro: "medicamentos" };
  assert.match(avisoCompraInventario({ ...vet, productoVet: undefined }), /Elige el producto veterinario/);
  assert.match(avisoCompraInventario({ ...vet, productoVet: { contenido_presentacion: null } }), /cómo viene el producto/);
  assert.equal(avisoCompraInventario({ ...vet, productoVet: { contenido_presentacion: 100 } }), null);
  // Lo que no es alimento ni medicamento no avisa nada.
  assert.equal(avisoCompraInventario({ ...base, rubro: "mano_obra", producto: null }), null);
});

import { diasConSalidas, marcaRepeticion, planearRepeticion } from "../lib/inventario-alimento.ts";
test("repetir raciones: solo días anteriores, del más reciente al más antiguo, y solo alimentos que el inventario sigue", () => {
  const salidas = [{ fecha: "2026-10-27" }, { fecha: "2026-10-29" }, { fecha: "2026-10-27" }, { fecha: "2026-10-25" }, { fecha: "2026-10-30" }];
  assert.deepEqual(diasConSalidas(salidas, "2026-10-29"), ["2026-10-27", "2026-10-25"]);
  assert.deepEqual(diasConSalidas([], "2026-10-29"), []);
  const origen = [
    { producto_id: "a", cantidad: 40, ubicacion_id: "c1", lote_id: null },
    { producto_id: "b", cantidad: 12, ubicacion_id: null, lote_id: null },
    { producto_id: "a", cantidad: 0, ubicacion_id: null, lote_id: null },
  ];
  assert.deepEqual(planearRepeticion(origen, new Set(["a"])), [origen[0]]);
  assert.deepEqual(planearRepeticion(origen, new Set()), []);
  assert.equal(marcaRepeticion("2026-10-28"), "Repetido del 2026-10-28");
});

import { pasosInventario, plural as pluralInv } from "../lib/inventario.ts";
test("inventario: «dosis» no cambia en plural y los pasos dicen qué hacer con cada problema", () => {
  assert.equal(pluralInv("dosis", 2), "dosis");
  assert.equal(pluralInv("dosis", 1), "dosis");
  assert.equal(pluralInv("frasco", 2), "frascos");
  assert.equal(pluralInv("tableta", 3), "tabletas");
  assert.equal(pluralInv("mol", 2), "moles");
  const f = { desde: "2026-08-01", stock: 40, stock_minimo: 10, presentacion: null, unidad: "dosis", contenido_presentacion: null };
  const lotes = [
    { lote: "A1", vencimiento: "2026-10-01", stock: 156 },
    { lote: null, vencimiento: null, stock: -116 },
    { lote: "B2", vencimiento: "2026-11-18", stock: 10 },
  ];
  const p = pasosInventario(f, lotes, "2026-10-31");
  assert.deepEqual(p.map((x) => x.clave), ["vencido-A1", "pronto-B2"]);
  assert.match(p[0].titulo, /venció el/);
  assert.match(p[1].titulo, /vence el .* \(en 18 días\) y quedan/, "el aviso de «vence pronto» dice cuántos días faltan y cuánto queda");
  assert.ok(p[1].pasos[0].includes("existencias del producto están bien"), "aclara que no es un problema de existencias");
  assert.ok(p[0].pasos.some((t) => /Vencido/.test(t)), "dice el motivo del ajuste");
  assert.ok(p[0].pasos.some((t) => /Hato → Compras/.test(t)), "dice dónde corregir una fecha mal escrita");
  // Descuadrado, agotado y bajo.
  assert.equal(pasosInventario({ ...f, stock: -5 }, [], "2026-10-31")[0].clave, "descuadrado");
  assert.equal(pasosInventario({ ...f, stock: 0 }, [], "2026-10-31")[0].clave, "agotado");
  assert.equal(pasosInventario({ ...f, stock: 8 }, [], "2026-10-31")[0].clave, "bajo");
  // Sin contar o al día: nada que hacer.
  assert.deepEqual(pasosInventario({ ...f, desde: null, stock: null }, [], "2026-10-31"), []);
  assert.deepEqual(pasosInventario({ ...f, stock: 100 }, [{ lote: "Z", vencimiento: "2027-05-01", stock: 100 }], "2026-10-31"), []);
});

import { ajusteInicial, rutaBajaLote } from "../lib/inventario.ts";
test("inventario: dar de baja un lote vencido abre el formulario con motivo, lote y cantidad ya puestos", () => {
  const f = { unidad: "ml", presentacion: "frasco", contenido_presentacion: 100 };
  const lotes = [
    { lote: "A1", vencimiento: "2026-10-01", stock: 350 },
    { lote: null, vencimiento: null, stock: -116 },
    { lote: "B2", vencimiento: "2026-12-01", stock: 200 },
  ];
  assert.equal(rutaBajaLote("p1", "A 1"), "/inventario/p1/ajustar?motivo=vencido&lote=A%201");
  assert.equal(rutaBajaLote("p1"), "/inventario/p1/ajustar?motivo=vencido");
  assert.deepEqual(ajusteInicial(f, lotes, "2026-10-31", "vencido", undefined), { motivo: "vencido", lote: "A1", cantidad: "3,5" });
  assert.deepEqual(ajusteInicial(f, lotes, "2026-10-31", "vencido", "A1"), { motivo: "vencido", lote: "A1", cantidad: "3,5" });
  assert.equal(ajusteInicial(f, lotes, "2026-10-31", undefined, undefined), null);
  assert.equal(ajusteInicial(f, [lotes[2]], "2026-10-31", "vencido", undefined), null, "sin lote vencido no se inventa uno");
});

import { LOTE_TOTAL, rutaConteoTotal } from "../lib/inventario.ts";
test("inventario: descuadrado lleva a contar todo el producto sin elegir lote", () => {
  const f = { producto_id: "p1", unidad: "ml", presentacion: "dosis", contenido_presentacion: 5, desde: "2026-08-01", stock: -150, stock_minimo: 50 };
  const lotes = [{ lote: "A", vencimiento: "2028-01-01", stock: 430 }, { lote: null, vencimiento: null, stock: -580 }];
  const p = pasosInventario(f, lotes, "2026-10-31").find((x) => x.clave === "descuadrado");
  assert.equal(p.accion.href, "/inventario/p1/ajustar?motivo=conteo&lote=total");
  assert.ok(p.pasos.some((t) => /Eliminar este ajuste/.test(t)), "dice cómo deshacer una baja que sí se usó");
  assert.ok(p.pasos.some((t) => /Hato → Compras/.test(t)), "dice dónde registrar una compra olvidada");
  assert.equal(rutaConteoTotal("p1"), p.accion.href);
  assert.deepEqual(ajusteInicial(f, lotes, "2026-10-31", "conteo", "total"), { motivo: "conteo", lote: LOTE_TOTAL, cantidad: "" });
  assert.equal(ajusteInicial(f, [lotes[0]], "2026-10-31", "conteo", "total"), null, "con un solo lote no hace falta contar el total");
  // Contar el total corrige la diferencia: la app decía -30 dosis (-150 ml) y hay 0 → +150 ml.
  assert.equal(cambioDeAjuste("conteo", 0, -150), 150);
});

import { loteSugerido, lotesVigentes } from "../lib/inventario.ts";
test("inventario: al aplicar se propone el lote vigente que vence primero y nunca uno vencido", () => {
  const lotes = [
    { id: "vencido", vencimiento: "2026-10-01" },
    { id: "tarde", vencimiento: "2028-05-01" },
    { id: "pronto", vencimiento: "2026-12-01" },
    { id: "sin", vencimiento: null },
  ];
  assert.equal(loteSugerido(lotes, "2026-10-31").id, "pronto");
  assert.deepEqual(lotesVigentes(lotes, "2026-10-31").map((l) => l.id), ["tarde", "pronto", "sin"]);
  assert.equal(loteSugerido([{ id: "sin", vencimiento: null }], "2026-10-31").id, "sin");
  assert.equal(loteSugerido([{ id: "vencido", vencimiento: "2026-10-01" }], "2026-10-31"), null);
  assert.equal(loteSugerido([], "2026-10-31"), null);
});
