import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { crc32 as crc32Node } from "node:zlib";
import ExcelJS from "exceljs";
// JSZip llega con exceljs (lo usa para leer y escribir .xlsx): sirve de lector independiente para comprobar que el .zip se abre.
import JSZip from "jszip";
import { armarZip, crc32 } from "../lib/zip.ts";
import {
  ANCLA_PLANTILLAS_CAMPO, NOMBRE_LEAME, ORDEN_PLANTILLAS, RUTA_PLANTILLAS_CAMPO, TEXTO_PLANTILLA, nombreEnZip, nombreZip, plantillasDisponibles, puedeLlevarPlantillas, textoLeame,
} from "../lib/plantillas-campo.ts";
import { puedeCargar } from "../lib/importar-historia.ts";
import { construirPlantillaHistoria } from "../lib/importar-historia-excel.ts";
import { construirPlantillaAnimales } from "../lib/importar-animales-excel.ts";
import { ATAJOS } from "../lib/atajos.ts";
import { AYUDA_MIGRAR } from "../lib/ayuda.ts";
import { TUTORIALES } from "../lib/tutoriales.ts";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

test("zip: el CRC-32 es el estándar", () => {
  for (const t of ["", "a", "Apriscol", "ñandú y cabras ".repeat(50)]) {
    const b = new TextEncoder().encode(t);
    assert.equal(crc32(b), crc32Node(b), JSON.stringify(t.slice(0, 20)));
  }
});

test("zip: se abre con otro lector, con nombres con tildes y el contenido intacto (comprimido o guardado tal cual)", async () => {
  const repetido = "Arete;Fecha;Litros\r\n".repeat(400);
  const azar = new Uint8Array(2048).map((_, i) => (i * 7919 + 13) % 256 ^ (i >> 3)); // casi no se comprime: va guardado tal cual
  const zip = armarZip([
    { nombre: "Léeme primero.txt", datos: repetido },
    { nombre: "2. Ordeños.bin", datos: azar },
  ], new Date(2026, 10, 20, 9, 30, 10));
  const abierto = await JSZip.loadAsync(zip);
  assert.deepEqual(Object.keys(abierto.files), ["Léeme primero.txt", "2. Ordeños.bin"]);
  assert.equal(await abierto.file("Léeme primero.txt").async("string"), repetido);
  assert.deepEqual(new Uint8Array(await abierto.file("2. Ordeños.bin").async("uint8array")), azar);
  assert.ok(zip.length < repetido.length, "el texto repetido sale comprimido");
  const fecha = abierto.file("Léeme primero.txt").date;
  assert.equal(fecha.getUTCFullYear(), 2026);
});

test("zip: rechaza nombres que escaparían de la carpeta o repetidos", () => {
  for (const nombre of ["", "/raiz.txt", "../fuera.txt", "a\\b.txt"]) assert.throws(() => armarZip([{ nombre, datos: "x" }]), undefined, nombre);
  assert.throws(() => armarZip([{ nombre: "a.txt", datos: "1" }, { nombre: "a.txt", datos: "2" }]));
});

test("plantillas al campo: el propietario con el plan más alto lleva las 7, en el orden de «Migrar mi finca»", () => {
  assert.deepEqual(plantillasDisponibles("propietario", "hacienda"), ["corrales", "animales", "pesajes", "ordenos", "sanidad", "medicamentos", "alimento"]);
  assert.deepEqual(plantillasDisponibles("administrador", "hacienda"), plantillasDisponibles("propietario", "hacienda"));
});

test("plantillas al campo: cada persona lleva solo lo que puede cargar; quien no carga animales no lleva nada", () => {
  for (const rol of ["propietario", "administrador", "ordenador", "veterinario", "contador"]) {
    for (const plan of ["cria", "hato", "profesional", "hacienda"]) {
      const tipos = plantillasDisponibles(rol, plan);
      if (!puedeLlevarPlantillas(rol, plan)) {
        assert.deepEqual(tipos, [], `${rol}/${plan}`);
        continue;
      }
      assert.ok(tipos.includes("animales"), `${rol}/${plan}: siempre la de animales`);
      for (const t of tipos) if (t !== "animales") assert.ok(puedeCargar(t, rol, plan), `${rol}/${plan}: ${t} sin permiso`);
      for (const t of ORDEN_PLANTILLAS) if (t !== "animales" && puedeCargar(t, rol, plan)) assert.ok(tipos.includes(t), `${rol}/${plan}: falta ${t}`);
      assert.deepEqual(tipos, ORDEN_PLANTILLAS.filter((t) => tipos.includes(t)), `${rol}/${plan}: en orden`);
    }
  }
  assert.deepEqual(plantillasDisponibles("ordenador", "hacienda"), []);
  assert.deepEqual(plantillasDisponibles("contador", "hacienda"), []);
});

test("plantillas al campo: nombres numerados, el .zip con la finca y un «Léeme» que nombra cada archivo y no habla técnico", () => {
  assert.equal(nombreEnZip("corrales", 0), "1. Corrales y potreros.xlsx");
  assert.equal(nombreEnZip("ordenos", 3), "4. Ordeños.xlsx");
  assert.equal(nombreZip("La Esperanza"), "Plantillas de La Esperanza - Apriscol.zip");
  assert.equal(nombreZip('Finca "A/B"'), "Plantillas de Finca -A-B- - Apriscol.zip");
  assert.equal(nombreZip("   "), "Plantillas de mi finca - Apriscol.zip");
  const tipos = plantillasDisponibles("propietario", "hacienda");
  const leame = textoLeame("La Esperanza", tipos);
  tipos.forEach((t, i) => assert.ok(leame.includes(nombreEnZip(t, i)), t));
  assert.ok(leame.includes("\r\n"), "saltos de línea que el Bloc de notas muestra");
  assert.doesNotMatch(leame, /NEXT_PUBLIC|supabase|zip|\.ts\b|_id\b/i);
  for (const t of ORDEN_PLANTILLAS) assert.ok(TEXTO_PLANTILLA[t].nombre && TEXTO_PLANTILLA[t].que, t);
});

test("plantillas al campo: el .zip completo trae el «Léeme» y cada plantilla es un Excel que se abre con sus hojas", async () => {
  const tipos = plantillasDisponibles("propietario", "hacienda");
  const razas = [
    { id: "r1", especie: "caprino", nombre: "Saanen" },
    { id: "r2", especie: "ovino", nombre: "Katahdin" },
  ];
  const libros = await Promise.all(
    tipos.map((t) =>
      t === "animales"
        ? construirPlantillaAnimales({ finca: "La Esperanza", especies: ["caprino", "ovino"], razas, reproduccion: true, ubicaciones: [{ id: "u1", nombre: "Potrero 1", capacidad: 20, ocupantes: 0 }] })
        : construirPlantillaHistoria(t, "La Esperanza"),
    ),
  );
  const zip = armarZip([{ nombre: NOMBRE_LEAME, datos: textoLeame("La Esperanza", tipos) }, ...tipos.map((t, i) => ({ nombre: nombreEnZip(t, i), datos: libros[i] }))]);
  const abierto = await JSZip.loadAsync(zip);
  assert.deepEqual(Object.keys(abierto.files), [NOMBRE_LEAME, ...tipos.map((t, i) => nombreEnZip(t, i))]);
  for (const [i, t] of tipos.entries()) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await abierto.file(nombreEnZip(t, i)).async("nodebuffer"));
    const hojas = libro.worksheets.map((h) => h.name);
    assert.ok(hojas.includes("Instrucciones"), `${t}: ${hojas}`);
    assert.ok(hojas.length >= 2, t);
  }
});

test("plantillas al campo: la descarga, la tarjeta, la ayuda y el atajo de «Al grano» están conectados", () => {
  assert.ok(existsSync(new URL(`../app/(app)${RUTA_PLANTILLAS_CAMPO}/route.ts`, import.meta.url)), "la ruta de la descarga existe");
  const pagina = leer("app/(app)/hato/migrar/page.tsx");
  assert.match(pagina, /<LlevarPlantillas /);
  assert.match(pagina, /<AyudaModulo ayuda=\{AYUDA_MIGRAR\} \/>/);
  const tarjeta = leer("components/LlevarPlantillas.tsx");
  assert.match(tarjeta, /id=\{ANCLA_PLANTILLAS_CAMPO\}/);
  assert.match(tarjeta, /descarga/, "la tarjeta descarga (enlace común, sin navegación de la app)");
  const atajo = ATAJOS.find((a) => a.titulo === "Llevar las plantillas al campo");
  assert.ok(atajo, "tiene su atajo en «Al grano»");
  assert.equal(atajo.href, `/hato/migrar#${ANCLA_PLANTILLAS_CAMPO}`);
  assert.equal(atajo.modulo, "hato");
  // La ayuda: su video existe y está publicado, menciona las plantillas al campo y su enlace lleva a OTRA pantalla.
  assert.ok(TUTORIALES.some((t) => t.numero === AYUDA_MIGRAR.tutorial && t.youtube), "el tutorial de la ayuda existe");
  assert.ok(AYUDA_MIGRAR.puntos.some((p) => p.titulo === "Llevar las plantillas al campo"));
  assert.notEqual(AYUDA_MIGRAR.enlace.href, "/hato/migrar");
  assert.ok(existsSync(new URL(`../app/(app)${AYUDA_MIGRAR.enlace.href}/page.tsx`, import.meta.url)), "el enlace de la ayuda lleva a una pantalla que existe");
});
