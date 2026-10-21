import Link from "next/link";
import { textoCC } from "@/lib/empadronamiento";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha, litros } from "@/lib/fechas";
import { ETIQUETA_PESAJE, faltaParaMeta, gdp, kg } from "@/lib/carne";
import { LoteAnimal } from "@/components/LoteAnimal";
import { AplazadoCeba, CandidatoCeba as AvisoCandidatoCeba } from "@/components/CandidatoCeba";
import { textosAdvertencias, textosMotivos } from "@/lib/ceba-candidatos";
import type { CandidatoCeba, ReglaCeba } from "@/lib/tipos";
import type { CtxFicha } from "./contexto";
import { Dato } from "./Dato";

/** Peso, ganancia y ceba del animal. */
export async function TarjetaCrecimiento({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, ajustes, supabase, hoy } = c;
  const verCarne = puedeVer(rol, "carne", finca.plan);
  const [pesosDB, cebaDB, lotesDB, candidatoDB, reglasDB] = verCarne
    ? await Promise.all([
        supabase.from("pesajes").select("*").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(50),
        supabase.rpc("ceba_animales", { p_finca: finca.id }),
        supabase.from("lotes_ceba").select("id, nombre, peso_meta_kg, cerrado_en").eq("finca_id", finca.id).order("nombre").limit(500),
        animal.estado === "activo" ? supabase.rpc("candidatos_ceba", { p_finca: finca.id, p_animal: id }) : Promise.resolve({ data: [] as CandidatoCeba[] }),
        animal.estado === "activo" ? supabase.rpc("reglas_ceba_efectivas", { p_finca: finca.id }) : Promise.resolve({ data: [] as ReglaCeba[] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] as CandidatoCeba[] }, { data: [] as ReglaCeba[] }];
  const miCandidato = (candidatoDB.data ?? [])[0] ?? null;
  const reglaCandidato = miCandidato ? (reglasDB.data ?? []).find((r) => r.especie === miCandidato.especie) ?? null : null;
  const miCeba = (cebaDB.data ?? []).find((c) => c.animal_id === id);
  const listaPesos = pesosDB.data ?? [];
  const lotesCeba = lotesDB.data ?? [];
  const miLote = lotesCeba.find((l) => l.id === animal.lote_ceba_id);
  const esCeba = animal.sexo === "macho" ? animal.uso_macho === "carne" : animal.vocacion !== "leche";
  const mostrarCrecimiento = verCarne && (animal.estado === "activo" || listaPesos.length > 0);
  if (!(mostrarCrecimiento)) return null;

  return (
    <Tarjeta titulo="Peso y ceba" id="crecimiento">
      {miCandidato && reglaCandidato ? (
        <AvisoCandidatoCeba
          animalId={id}
          sexo={animal.sexo}
          usoMacho={animal.uso_macho}
          nivel={miCandidato.nivel}
          motivos={textosMotivos(miCandidato, reglaCandidato)}
          advertencias={textosAdvertencias(miCandidato, reglaCandidato, hoy)}
          puedeEditar={puedeEscribir(rol, "carne", finca.plan) && puedeEscribir(rol, "hato", finca.plan)}
        />
      ) : null}
      {animal.ceba_pospuesto_hasta && animal.ceba_pospuesto_hasta > hoy && animal.estado === "activo" ? (
        <AplazadoCeba animalId={id} hasta={animal.ceba_pospuesto_hasta} puedeEditar={puedeEscribir(rol, "carne", finca.plan) && puedeEscribir(rol, "hato", finca.plan)} />
      ) : null}
      <dl className="divide-y divide-arena">
        {animal.peso_nacer_kg ? <Dato etiqueta="Peso al nacer">{litros(animal.peso_nacer_kg)} kg</Dato> : null}
        <Dato etiqueta="Último peso">
          {miCeba?.peso_ultimo != null && miCeba.n_pesajes > 0 ? `${kg(miCeba.peso_ultimo)} · ${formatoFecha(miCeba.fecha_ultimo, { day: "numeric", month: "short", year: "numeric" })}` : "Sin pesos todavía"}
        </Dato>
        {miCeba?.gdp_total_g != null ? (
          <Dato etiqueta="Ganancia por día">
            {gdp(miCeba.gdp_total_g)}
            {miLote && !miLote.cerrado_en && miCeba.gdp_total_g < ajustes.general.gdp_minima_g ? <Insignia tono="aviso">{`Bajo el mínimo de ${ajustes.general.gdp_minima_g} g`}</Insignia> : null}
          </Dato>
        ) : null}
        {miCeba?.gdp_reciente_g != null && miCeba.gdp_reciente_g !== miCeba.gdp_total_g ? (
          <Dato etiqueta="Entre los dos últimos pesos">
            {gdp(miCeba.gdp_reciente_g)}
            {miLote && !miLote.cerrado_en && miCeba.gdp_reciente_g < ajustes.general.gdp_minima_g ? <Insignia tono="aviso">{`Bajo el mínimo de ${ajustes.general.gdp_minima_g} g`}</Insignia> : null}
          </Dato>
        ) : null}
        {miLote ? (
          <Dato etiqueta="Lote de ceba">
            <Link href={`/carne/lotes/${miLote.id}`} className="font-semibold text-musgo underline-offset-4 hover:underline [overflow-wrap:anywhere]">
              {miLote.nombre}
            </Link>
          </Dato>
        ) : null}
        {miLote?.peso_meta_kg != null && miCeba?.peso_ultimo != null ? (
          <Dato etiqueta="Meta del lote">
            {Number(miCeba.peso_ultimo) >= Number(miLote.peso_meta_kg) ? <Insignia tono="ok">Listo para beneficio</Insignia> : `Faltan ${kg(faltaParaMeta(miCeba.peso_ultimo, miLote.peso_meta_kg))} para ${kg(miLote.peso_meta_kg)}`}
          </Dato>
        ) : null}
      </dl>
      {miCeba && miCeba.n_pesajes > 0 && miCeba.gdp_total_g == null ? (
        <p className="mt-2 text-sm text-humo">La ganancia por día se calcula con dos pesos separados al menos 7 días.</p>
      ) : null}
      {listaPesos.length > 0 ? (
        <ul className="mt-3 divide-y divide-arena">
          {listaPesos.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">
                <span className="font-semibold">{kg(p.peso_kg)}</span>
                <span className="text-humo"> · {formatoFecha(p.fecha, { day: "numeric", month: "short", year: "numeric" })}{p.tipo !== "control" ? ` · ${ETIQUETA_PESAJE[p.tipo]}` : ""}{p.condicion_corporal != null ? ` · CC ${textoCC(p.condicion_corporal)}` : ""}</span>
              </span>
              {puedeEscribir(rol, "carne", finca.plan) ? (
                <Link href={`/carne/pesajes/${p.id}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  Editar
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {listaPesos.length > 8 ? <p className="mt-1 text-sm text-humo">Y {listaPesos.length - 8} pesos más en Carne → Pesos.</p> : null}
      {puedeEscribir(rol, "carne", finca.plan) && animal.estado === "activo" ? (
        <div className="mt-3 space-y-3">
          {esCeba || miLote || miCandidato ? <LoteAnimal animalId={id} loteId={miLote && !miLote.cerrado_en ? miLote.id : null} lotes={lotesCeba.filter((l) => !l.cerrado_en).map((l) => ({ id: l.id, nombre: l.nombre }))} /> : null}
          <Link href={`/hato/${id}/peso/nuevo`} className={clasesBoton("secundario")}>
            Registrar peso
          </Link>
        </div>
      ) : null}
    </Tarjeta>
  );
}
