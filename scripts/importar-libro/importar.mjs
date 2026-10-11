#!/usr/bin/env node
/**
 * Importa el libro genealógico de la asociación (volcado MariaDB de `anco_registro`) a Apriscol.
 *
 *   node scripts/importar-libro/importar.mjs <volcado.sql>                  → simulación: informe, no envía nada
 *   node scripts/importar-libro/importar.mjs <volcado.sql> --enviar         → carga la base (ver README)
 *
 * Los documentos de identidad viajan a la función de importación, que los guarda cifrados (HMAC con secreto en Vault).
 * Este script NO escribe ningún archivo con datos y el volcado nunca debe entrar al repositorio.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const ruta = args.find((a) => !a.startsWith("--"));
const ENVIAR = args.includes("--enviar");
const TAM_LOTE = Number(process.env.TAM_LOTE ?? 200);
if (!ruta) {
  console.error("Uso: node scripts/importar-libro/importar.mjs <volcado.sql> [--enviar]");
  process.exit(1);
}

import { leerFilas, limpiar } from "./limpieza.mjs";

// ───────────────────────── 3. Informe ─────────────────────────
function informe({ cargas, rechazadas, conteo }, totalLeidas) {
  const por = (f) => cargas.reduce((a, c) => ((a[f(c)] = (a[f(c)] ?? 0) + 1), a), {});
  const linea = (t, o) => console.log(`  ${t.padEnd(26)} ${Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
  const chips = new Set(cargas.map((c) => c.chip));
  const conPadre = cargas.filter((c) => c.padre_chip || c.madre_chip);
  const padreOk = cargas.filter((c) => c.padre_chip && chips.has(c.padre_chip)).length;
  const madreOk = cargas.filter((c) => c.madre_chip && chips.has(c.madre_chip)).length;
  console.log(`\nFilas leídas: ${totalLeidas} · listas para cargar: ${cargas.length} · rechazadas: ${rechazadas.length}`);
  for (const x of rechazadas) console.log(`  ✗ registro ${x.registro ?? "?"}: ${x.motivo}`);
  linea("Especie", por((c) => c.especie));
  linea("Sexo", por((c) => c.sexo));
  linea("Estado", por((c) => c.estado));
  linea("Libro", por((c) => c.libro ?? "(sin libro)"));
  linea("Titulares (documentos)", { propietarios: new Set(cargas.map((c) => c.titular.documento)).size, criadores: new Set(cargas.map((c) => c.criador.documento)).size });
  console.log(`  Con padre o madre declarados: ${conPadre.length} · padre encontrado en el archivo: ${padreOk} · madre encontrada: ${madreOk}`);
  console.log("  Correcciones y avisos por tipo:");
  for (const [k, v] of Object.entries(conteo).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`);
}

// ───────────────────────── 4. Envío ─────────────────────────
async function enviar(cargas) {
  const url = process.env.SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) {
    console.error("\nPara --enviar define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu terminal (nunca en un archivo del repo).");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

  let insertados = 0, actualizados = 0, sinRaza = 0;
  const errores = [];
  for (let i = 0; i < cargas.length; i += TAM_LOTE) {
    const lote = cargas.slice(i, i + TAM_LOTE);
    const { data, error } = await db.rpc("importar_libro_lote", { p_lote: lote, p_entidad: "ANCO" });
    if (error) { console.error(`\nLote ${i}–${i + lote.length}: ${error.message}`); process.exit(1); }
    insertados += data.insertados; actualizados += data.actualizados; sinRaza += data.sin_raza;
    errores.push(...(data.errores ?? []));
    process.stdout.write(`\r  enviados ${Math.min(i + TAM_LOTE, cargas.length)} de ${cargas.length}`);
  }
  console.log(`\n  insertados: ${insertados} · actualizados: ${actualizados} · sin raza en el catálogo: ${sinRaza} · filas con error: ${errores.length}`);
  for (const e of errores) console.log(`    ✗ registro ${e.numero_registro}: ${e.error}`);

  const { data: padres, error: ep } = await db.rpc("resolver_padres_libro", { p_entidad: "ANCO" });
  if (ep) { console.error(`\nEnlace de padres: ${ep.message}`); process.exit(1); }
  console.log("  pedigrí:", JSON.stringify(padres));
}

// ───────────────────────── Ejecución ─────────────────────────
const texto_sql = readFileSync(ruta).toString("utf8");
const { filas, columnas } = leerFilas(texto_sql);
if (!columnas) { console.error("No encontré sentencias INSERT INTO `anco_registro` en el archivo."); process.exit(1); }
const resultado = limpiar(filas);
informe(resultado, filas.length);

if (ENVIAR) {
  console.log("\nEnviando a Apriscol…");
  await enviar(resultado.cargas);
  console.log("Listo.");
} else {
  console.log("\nSimulación: no se envió nada. Repite con --enviar cuando el informe te convenza.");
}
