// Lectura del volcado MariaDB de `anco_registro` y limpieza fila por fila. Sin efectos: no toca red ni disco.
const ESC = { n: "\n", r: "\r", t: "\t", 0: "\0", Z: "\x1a", b: "\b" };

export function leerFilas(texto) {
  const filas = [];
  let columnas = null;
  const cabecera = /INSERT INTO `anco_registro` \(([^)]*)\) VALUES/g;
  let m;
  while ((m = cabecera.exec(texto))) {
    const cols = m[1].split(",").map((c) => c.trim().replace(/`/g, ""));
    columnas ??= cols;
    let i = m.index + m[0].length;
    const n = texto.length;
    for (;;) {
      while (i < n && " \n\r,".includes(texto[i])) i++;
      if (i >= n || texto[i] === ";") break;
      if (texto[i] !== "(") throw new Error(`Formato inesperado cerca de la posición ${i}`);
      i++;
      const fila = [];
      for (;;) {
        while (" \n\r".includes(texto[i])) i++;
        if (texto[i] === "'") {
          i++;
          let buf = "";
          for (;;) {
            const c = texto[i];
            if (c === "\\") {
              const s = texto[i + 1];
              buf += ESC[s] ?? s;
              i += 2;
            } else if (c === "'") {
              if (texto[i + 1] === "'") { buf += "'"; i += 2; } else { i++; break; }
            } else { buf += c; i++; }
          }
          fila.push(buf);
        } else {
          let j = i;
          while (texto[j] !== "," && texto[j] !== ")") j++;
          const tok = texto.slice(i, j).trim();
          i = j;
          fila.push(tok.toUpperCase() === "NULL" ? null : Number(tok));
        }
        if (texto[i] === ",") { i++; continue; }
        if (texto[i] === ")") { i++; break; }
      }
      filas.push(Object.fromEntries(cols.map((c, k) => [c, fila[k]])));
    }
    cabecera.lastIndex = i;
  }
  return { filas, columnas };
}

// ── Limpieza ──
const HOY = new Date().toISOString().slice(0, 10);

/** Caracteres de Windows-1252 en 0x80–0x9F que no existen como U+0080–U+009F. */
const CP1252 = new Map(Object.entries({
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b,
  "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99,
  "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
}));
const decodificador = new TextDecoder("utf-8", { fatal: true });

/**
 * El volcado trae textos UTF-8 guardados dos veces («informaciÃ³n», «MUÃ‘ECO»): alguien leyó los bytes UTF-8 como
 * Windows-1252. Se deshace volviendo a bytes con esa tabla y decodificando como UTF-8; si algo no cuadra, se deja igual.
 */
function repararTexto(s) {
  if (typeof s !== "string" || !/[ÃÂ]/.test(s)) return s;
  const bytes = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp < 256) bytes.push(cp);
    else if (CP1252.has(ch)) bytes.push(CP1252.get(ch));
    else return s;
  }
  try {
    return decodificador.decode(Uint8Array.from(bytes));
  } catch {
    return s;
  }
}
const SENTINELAS = new Set(["", "''", "'.'", ".", "NULL", "' '"]);
function texto(v) {
  if (v === null || v === undefined) return null;
  const s = repararTexto(String(v)).replace(/\s+/g, " ").trim();
  return SENTINELAS.has(s) ? null : s;
}
function chip(v) {
  const s = texto(v);
  return s && s !== "0" ? s : null;
}
function fechaValida(v, minAnio, maxIso = HOY) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const anio = Number(v.slice(0, 4));
  if (anio < minAnio || v > maxIso || Number.isNaN(Date.parse(v))) return null;
  return v;
}

const CAPRINAS = new Set(["ALPINA", "ANGLONUBIANA", "BOER", "LAMANCHA", "LA MANCHA", "SAANEN", "SANTANDEREANA", "TOGGENBURG"]);
const COMPOSICIONES = new Set(["FU", "PO", "C1", "C2", "C3", "C4", "PP"]);
const LIBROS = new Set(["FUNDADORES", "PURO DE ORIGEN", "CRUZAMIENTO", "PURO POR PEDIGREE"]);
const CONCEPCIONES = new Set(["MD", "IA", "TE", "MDG"]);

export function limpiar(filas) {
  // Para deducir el sexo de quien lo trae mal: si figura como padre es macho; si figura como madre, hembra.
  const comoPadre = new Set(filas.map((r) => chip(r.CHIP_PADRE)).filter(Boolean));
  const comoMadre = new Set(filas.map((r) => chip(r.CHIP_MADRE)).filter(Boolean));

  const cargas = [];
  const rechazadas = [];
  const conteo = {};
  const nota = (notas, clave) => { notas.push(clave); conteo[clave] = (conteo[clave] ?? 0) + 1; };

  for (const r of filas) {
    const notas = [];
    const registro = texto(r.CONSECUTIVO);
    const chipAnimal = chip(r.CHIP);
    const nombre = texto(r.NOMBRE);
    const razaRaw = texto(r.RAZA);
    const razaClave = razaRaw ? razaRaw.toUpperCase() : null;

    if (!registro || !chipAnimal || !nombre) {
      rechazadas.push({ registro, motivo: "falta consecutivo, chip o nombre" });
      continue;
    }

    // Especie
    let especie = { C: "caprino", O: "ovino" }[String(r.ESPECIE ?? "").trim().toUpperCase()];
    if (!especie) {
      if (!razaClave) { rechazadas.push({ registro, motivo: "especie inválida y sin raza para deducirla" }); continue; }
      especie = CAPRINAS.has(razaClave) ? "caprino" : "ovino";
      nota(notas, "dato:especie_deducida_de_la_raza");
    }

    // Sexo
    let sexo = { H: "hembra", M: "macho" }[String(r.SEXO ?? "").trim().toUpperCase()];
    if (!sexo) {
      if (comoPadre.has(chipAnimal) && !comoMadre.has(chipAnimal)) sexo = "macho";
      else if (comoMadre.has(chipAnimal) && !comoPadre.has(chipAnimal)) sexo = "hembra";
      if (!sexo) { rechazadas.push({ registro, motivo: "sexo inválido y sin pistas en el pedigrí" }); continue; }
      nota(notas, "dato:sexo_deducido_del_pedigri");
    }

    // Fechas
    const rawNac = r.FECHA_NACIMIENTO;
    const nacimiento = fechaValida(rawNac, 1990);
    if (rawNac && !nacimiento) nota(notas, "dato:nacimiento_descartado");
    const solicitud = fechaValida(r.FECHA_SOLICITUD, 2000);
    if (r.FECHA_SOLICITUD && !solicitud) nota(notas, "dato:solicitud_descartada");
    if (nacimiento && solicitud && nacimiento > solicitud) nota(notas, "dato:nacimiento_posterior_a_la_solicitud");

    // Estado (el libro lo repite por sexo y para «fundador»: se lee la columna del sexo del animal)
    const estadoCol = sexo === "macho" ? r.ESTADO_ANIMAL_MACHO : r.ESTADO_ANIMAL_HEMBRA;
    const muerteCol = sexo === "macho" ? r.FECHA_MUERTE_MACHO : r.FECHA_MUERTE_HEMBRA;
    const baja = estadoCol === 2;
    const fechaBaja = baja ? fechaValida(muerteCol, 2000) : null;
    if (baja && !fechaBaja) nota(notas, "dato:baja_sin_fecha");

    // Texto descriptivo
    const colorTxt = texto(r.COLOR);
    const color = colorTxt && !/^sin informaci/i.test(colorTxt) ? colorTxt : null;
    const marcasTxt = texto(r.MARCAS_HATO);
    const puntaje = Number.isInteger(r.PUNTAJE_FUNDADORES) && r.PUNTAJE_FUNDADORES > 0 && r.PUNTAJE_FUNDADORES <= 100 ? r.PUNTAJE_FUNDADORES : null;

    // Ubicación (códigos DANE; el municipio llega como código parcial)
    const dep = Number.isInteger(r.DEPARTAMENTO) && r.DEPARTAMENTO > 0 ? r.DEPARTAMENTO : null;
    const mun = Number.isInteger(r.MUNICIPIO) && r.MUNICIPIO > 0 ? r.MUNICIPIO : null;
    const depDane = dep ? String(dep).padStart(2, "0") : null;
    const munDane = dep && mun ? (mun >= 1000 ? String(mun).padStart(5, "0") : depDane + String(mun).padStart(3, "0")) : null;

    const padre = chip(r.CHIP_PADRE);
    const madre = chip(r.CHIP_MADRE);
    const abuelos = {
      abuelo_paterno: chip(r.CHIP_ABUELO_PATERNO), abuela_paterna: chip(r.CHIP_ABUELA_PATERNA),
      abuelo_materno: chip(r.CHIP_ABUELO_MATERNO), abuela_materna: chip(r.CHIP_ABUELA_MATERNA),
    };
    const foto = texto(r.FOTO);
    const composicion = COMPOSICIONES.has(texto(r.COMPOSICION)) ? texto(r.COMPOSICION) : null;
    const libroTxt = texto(r.LIBRO) === "ORIGEN" ? "PURO DE ORIGEN" : texto(r.LIBRO);
    const libro = LIBROS.has(libroTxt) ? libroTxt : null;
    if (!libro) nota(notas, "dato:sin_libro");

    cargas.push({
      numero_registro: registro,
      chip: chipAnimal,
      nombre,
      prefijo: texto(r.PREFIJO)?.toUpperCase() ?? null,
      especie,
      sexo,
      raza: razaRaw,
      composicion,
      libro,
      concepcion: CONCEPCIONES.has(texto(r.CONCEPCION)) ? texto(r.CONCEPCION) : null,
      fecha_nacimiento: nacimiento,
      fecha_solicitud: solicitud,
      color,
      rasgos: texto(r.RASGOS_PARTICULARES),
      marcas: marcasTxt,
      puntaje_fundador: puntaje,
      padre_chip: padre,
      madre_chip: madre,
      criadero: texto(r.CRIADERO),
      departamento_dane: depDane,
      municipio_dane: munDane,
      estado: baja ? "baja" : "vivo",
      fecha_baja: fechaBaja,
      titular: { tipo: texto(r.TID_PROPIETARIO) ?? "CC", documento: texto(r.NID_PROPIETARIO) },
      criador: { tipo: texto(r.TID_CRIADOR) ?? "CC", documento: texto(r.NID_CRIADOR) },
      foto_origen: foto && /^https?:\/\//i.test(foto) ? foto : null,
      observaciones: texto(r.OBSERVACIONES),
      datos_origen: Object.fromEntries(Object.entries({
        raza_original: razaRaw,
        consec_nacimiento: texto(r.CONSEC_NACIMIENTO) && texto(r.CONSEC_NACIMIENTO) !== "0" ? texto(r.CONSEC_NACIMIENTO) : null,
        numero_crg: r.NUMERO_CRG ?? null,
        nacimiento_original: rawNac && !nacimiento ? String(rawNac) : null,
        solicitud_original: r.FECHA_SOLICITUD && !solicitud ? String(r.FECHA_SOLICITUD) : null,
        abuelos: Object.values(abuelos).some(Boolean) ? abuelos : null,
        direccion_criadero_registrada: texto(r.DIRECCION) ? true : null,
      }).filter(([, v]) => v !== null)),
      notas,
    });
  }
  return { cargas, rechazadas, conteo };
}

