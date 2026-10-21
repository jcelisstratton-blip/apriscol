// Deja a `node --test` resolver el alias «@/» de tsconfig y las extensiones .ts sin escribirlas.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
const raiz = ${JSON.stringify(process.cwd())};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const base = path.join(raiz, spec.slice(2));
    for (const c of [base + ".ts", base + ".tsx", path.join(base, "index.ts")]) if (existsSync(c)) return next(pathToFileURL(c).href, ctx);
  }
  if (spec.startsWith(".") && !path.extname(spec) && ctx.parentURL) {
    const base = path.resolve(path.dirname(new URL(ctx.parentURL).pathname), spec);
    if (existsSync(base + ".ts")) return next(pathToFileURL(base + ".ts").href, ctx);
  }
  return next(spec, ctx);
}`));
