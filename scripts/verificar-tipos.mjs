// Compara los tipos escritos a mano (lib/tipos.ts) con los generados desde la base (lib/database.types.ts).
// Uso: node scripts/verificar-tipos.mjs   → sale con código 1 si una tabla/vista/función difiere en columnas.
import ts from "typescript";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const cfg = ts.readConfigFile(path.join(raiz, "tsconfig.json"), ts.sys.readFile);
const opts = ts.parseJsonConfigFileContent(cfg.config, ts.sys, raiz).options;
const prog = ts.createProgram([path.join(raiz, "lib/tipos.ts"), path.join(raiz, "lib/database.types.ts")], opts);
const chk = prog.getTypeChecker();

function dbType(archivo) {
  const sf = prog.getSourceFile(path.join(raiz, archivo));
  const sym = chk.getSymbolAtLocation(sf).exports.get("Database");
  return chk.getDeclaredTypeOfSymbol(sym);
}
const prop = (t, n) => { const s = t.getProperty(n); return s ? chk.getTypeOfSymbol(s) : undefined; };
const nombres = (t) => (t ? t.getProperties().map((p) => p.name) : []);

const mano = dbType("lib/tipos.ts");
const gen = dbType("lib/database.types.ts");
const pub = (db) => prop(db, "public");

// Excepciones deliberadas: columnas que la app oculta o tipa distinto a propósito (Omit en tipos.ts).
const IGNORAR = {
  libro_genealogico: ["created_at", "criador_id", "datos_origen", "foto_origen", "titular_id", "updated_at"], // solo el superadmin vía funciones; la app no lo consulta
  despachos_leche: ["valor_total"], // columna generada: no se escribe
  canales: ["tipo_baja"], // viene de la baja, no se escribe
};
let fallos = 0;
const reporte = [];

for (const seccion of ["Tables", "Views"]) {
  const m = prop(pub(mano), seccion), g = prop(pub(gen), seccion);
  for (const nombre of nombres(m)) {
    const gt = prop(g, nombre);
    if (!gt) { reporte.push(`✗ ${seccion}.${nombre}: no existe en la base`); fallos++; continue; }
    const filaM = prop(prop(m, nombre), "Row"), filaG = prop(gt, "Row");
    const km = new Set(nombres(filaM)), kg = new Set(nombres(filaG));
    const ig = new Set(IGNORAR[nombre] ?? []);
    const soloMano = [...km].filter((k) => !kg.has(k) && !ig.has(k));
    const soloBase = [...kg].filter((k) => !km.has(k) && !ig.has(k));
    const distintos = [];
    for (const k of km) {
      if (!kg.has(k) || ig.has(k)) continue;
      const a = chk.getTypeOfSymbol(filaM.getProperty(k)), b = chk.getTypeOfSymbol(filaG.getProperty(k));
      // La base tipa enums/texto como string; la app los estrecha. Se exige que lo de la app sea asignable a lo de la base.
      if (!chk.isTypeAssignableTo(a, b)) distintos.push(`${k}: app=${chk.typeToString(a)} base=${chk.typeToString(b)}`);
    }
    if (soloMano.length || soloBase.length || distintos.length) {
      fallos++;
      reporte.push(`✗ ${seccion}.${nombre}` + (soloMano.length ? `\n    solo en la app: ${soloMano.join(", ")}` : "") + (soloBase.length ? `\n    solo en la base: ${soloBase.join(", ")}` : "") + (distintos.length ? `\n    tipos incompatibles: ${distintos.join(" | ")}` : ""));
    }
  }
}

const fm = prop(pub(mano), "Functions"), fg = prop(pub(gen), "Functions");
for (const nombre of nombres(fm)) if (!prop(fg, nombre)) { reporte.push(`✗ Functions.${nombre}: no existe en la base`); fallos++; }

console.log(reporte.join("\n") || "Tipos de la app alineados con la base.");
console.log(`\n${fallos} diferencia(s).`);
process.exit(fallos ? 1 : 0);
