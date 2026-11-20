import { deflateRawSync } from "node:zlib";

/**
 * Un archivo .zip armado en memoria, sin dependencias: cada entrada va comprimida (deflate) o guardada tal cual si comprimirla no ahorra
 * nada (un .xlsx ya viene comprimido por dentro). Los nombres van en UTF-8 (bit 11), así que tildes y eñes se ven bien en Windows, macOS,
 * Android e iOS. Sin ZIP64: está pensado para unos pocos archivos de menos de 4 GB en total.
 */
export type EntradaZip = { nombre: string; datos: Uint8Array | string };

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en el formato de MS-DOS que usa el zip (resolución de 2 s; desde 1980). */
function fechaDos(f: Date): { hora: number; dia: number } {
  const anio = Math.max(1980, f.getFullYear());
  return {
    hora: (f.getHours() << 11) | (f.getMinutes() << 5) | Math.floor(f.getSeconds() / 2),
    dia: ((anio - 1980) << 9) | ((f.getMonth() + 1) << 5) | f.getDate(),
  };
}

/** Arma el .zip. `fecha` es la que muestran los archivos al abrirlo (por defecto, ahora). */
export function armarZip(entradas: EntradaZip[], fecha: Date = new Date()): Uint8Array {
  const codificador = new TextEncoder();
  const { hora, dia } = fechaDos(fecha);
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  const nombres = new Set<string>();
  let desplazamiento = 0;

  for (const e of entradas) {
    if (!e.nombre || e.nombre.startsWith("/") || e.nombre.includes("..") || e.nombre.includes("\\")) throw new Error(`Nombre de archivo no válido dentro del zip: ${e.nombre}`);
    if (nombres.has(e.nombre)) throw new Error(`Nombre repetido dentro del zip: ${e.nombre}`);
    nombres.add(e.nombre);
    const nombre = codificador.encode(e.nombre);
    const datos = typeof e.datos === "string" ? codificador.encode(e.datos) : e.datos;
    const crc = crc32(datos);
    const comprimido = deflateRawSync(datos, { level: 9 });
    const usaDeflate = comprimido.length < datos.length;
    const cuerpo = usaDeflate ? comprimido : datos;
    const metodo = usaDeflate ? 8 : 0;

    const local = new Uint8Array(30 + nombre.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versión necesaria: 2.0
    l.setUint16(6, 0x0800, true); // nombres en UTF-8
    l.setUint16(8, metodo, true);
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, cuerpo.length, true);
    l.setUint32(22, datos.length, true);
    l.setUint16(26, nombre.length, true);
    l.setUint16(28, 0, true);
    local.set(nombre, 30);

    const central = new Uint8Array(46 + nombre.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // hecho con: 2.0
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, metodo, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, cuerpo.length, true);
    c.setUint32(24, datos.length, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);

    locales.push(local, cuerpo);
    centrales.push(central);
    desplazamiento += local.length + cuerpo.length;
  }

  const tamanoCentral = centrales.reduce((s, b) => s + b.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, entradas.length, true);
  f.setUint16(10, entradas.length, true);
  f.setUint32(12, tamanoCentral, true);
  f.setUint32(16, desplazamiento, true);

  const salida = new Uint8Array(desplazamiento + tamanoCentral + fin.length);
  let i = 0;
  for (const b of [...locales, ...centrales, fin]) {
    salida.set(b, i);
    i += b.length;
  }
  return salida;
}
