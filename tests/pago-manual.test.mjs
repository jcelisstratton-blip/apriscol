// Pago manual por Nequi: la TRM del día para mostrar el valor en pesos, con respaldo, y que toda pantalla de pago diga a dónde pagar.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerTrm, pesosPorDolar } from "../lib/pago-manual.ts";
import { pesos } from "../lib/planes.ts";

test("leerTrm: toma el primer valor y rechaza lo que no tiene sentido", () => {
  assert.equal(leerTrm([{ valor: "3309.55", unidad: "COP" }]), 3309.55);
  assert.equal(leerTrm([{ valor: "3316.7" }, { valor: "1" }]), 3316.7);
  for (const malo of [null, [], {}, [{}], [{ valor: "abc" }], [{ valor: "0" }], [{ valor: "12" }], [{ valor: "999999" }]]) assert.equal(leerTrm(malo), null);
});

test("pesosPorDolar: TRM del día; si no responde, PESOS_POR_DOLAR; si tampoco, nada", async () => {
  const fetchOriginal = globalThis.fetch;
  const envOriginal = process.env.PESOS_POR_DOLAR;
  try {
    let url = "";
    globalThis.fetch = async (u) => { url = String(u); return new Response(JSON.stringify([{ valor: "3309.55" }]), { status: 200 }); };
    assert.equal(await pesosPorDolar(), 3309.55);
    assert.match(url, /datos\.gov\.co\/resource\/32sa-8pi3\.json/);
    assert.match(url, /%24limit=1/);

    process.env.PESOS_POR_DOLAR = "3800,5";
    globalThis.fetch = async () => { throw new Error("fetch failed"); };
    assert.equal(await pesosPorDolar(), 3800.5, "sin conexión usa el respaldo");
    globalThis.fetch = async () => new Response("no", { status: 503 });
    assert.equal(await pesosPorDolar(), 3800.5, "error del servicio usa el respaldo");
    globalThis.fetch = async () => new Response(JSON.stringify([{ valor: "7" }]), { status: 200 });
    assert.equal(await pesosPorDolar(), 3800.5, "un valor absurdo no se usa");

    delete process.env.PESOS_POR_DOLAR;
    globalThis.fetch = async () => { throw new Error("fetch failed"); };
    assert.equal(await pesosPorDolar(), null, "sin TRM ni respaldo no se inventa un cambio");
  } finally {
    globalThis.fetch = fetchOriginal;
    if (envOriginal === undefined) delete process.env.PESOS_POR_DOLAR; else process.env.PESOS_POR_DOLAR = envOriginal;
  }
});

test("pesos: punto de miles y sin decimales", () => {
  assert.equal(pesos(3309.55 * 10), "$ 33.096");
});

test("Todas las pantallas de pago muestran a dónde pagar (Nequi), cuánto y la referencia, y el cambio sale de la TRM", () => {
  const vista = readFileSync(new URL("../components/PlanVencidoVista.tsx", import.meta.url), "utf8");
  const pagina = readFileSync(new URL("../app/plan-vencido/page.tsx", import.meta.url), "utf8");
  assert.match(vista, /Paga por Nequi/);
  assert.match(vista, /datos\.nequi\.numero/);
  assert.match(vista, /datos\.referencia/);
  assert.match(vista, /datos\.pesosMes/);
  assert.match(pagina, /datosNequi\(\)/);
  assert.match(pagina, /await pesosPorDolar\(\)/);
  for (const f of ["../app/activar-finca/page.tsx", "../app/(app)/mas/plan/page.tsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /await pesosPorDolar\(\)/, f);
  }
});
