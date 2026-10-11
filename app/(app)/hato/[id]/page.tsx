import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { urlsFotosPremios } from "@/lib/fotos";
import { FilaParticipacion } from "@/components/FilaParticipacion";
import { clasesBoton } from "@/components/Boton";
import { edadTexto, formatoFecha, litros } from "@/lib/fechas";
import { ETIQUETA_VOCACION, nombreTipo } from "@/lib/animal";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { RutasEndogamia } from "@/components/RutasEndogamia";
import { describirParentesco, nivelEndogamia, pedigriTexto, porcentaje, primeraMayuscula, type AncestroEndogamia } from "@/lib/endogamia";

export const metadata: Metadata = { title: "Animal" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export default async function FichaAnimal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();

  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("*").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();

  // Un animal del libro tiene su pedigrí aunque sus padres no estén en este hato.
  const puedeCalcular = Boolean((animal.padre_id && animal.madre_id) || animal.libro_id);
  const verLeche = puedeVer(rol, "leche") && animal.sexo === "hembra";
  const verGenealogia = puedeVer(rol, "genealogia") || puedeVer(rol, "hato");
  const verFerias = puedeVer(rol, "ferias");
  const idsPadres = [animal.padre_id, animal.madre_id].filter((x): x is string => !!x);

  const [raza, padres, endo, completitud, lactancia, retiro, palmares, participaciones] = await Promise.all([
    animal.raza_id ? supabase.from("razas").select("nombre").eq("id", animal.raza_id).maybeSingle() : Promise.resolve({ data: null }),
    idsPadres.length ? supabase.from("animales").select("id, numero_arete, nombre").in("id", idsPadres) : Promise.resolve({ data: [] }),
    puedeCalcular && verGenealogia ? supabase.rpc("coef_endogamia", { p_animal: id }) : Promise.resolve({ data: null as number | null }),
    verGenealogia ? supabase.rpc("completitud_pedigri", { p_animal: id }) : Promise.resolve({ data: null as number | null }),
    verLeche
      ? supabase.from("v_lactancias_resumen").select("*").eq("animal_id", id).order("numero", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("animales_en_retiro", { p_finca: finca.id }),
    verFerias ? supabase.from("v_palmares_animal").select("*").eq("animal_id", id).maybeSingle() : Promise.resolve({ data: null }),
    verFerias
      ? supabase
          .from("participaciones_feria")
          .select("id, feria_id, categoria, resultado, puesto, puntaje, premio_descripcion, premio_en_dinero, foto_path")
          .eq("animal_id", id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const listaPremios = participaciones.data ?? [];
  const idsFerias = [...new Set(listaPremios.map((p) => p.feria_id))];
  const [feriasData, fotosPremios] = await Promise.all([
    idsFerias.length ? supabase.from("ferias").select("id, nombre, fecha_inicio").in("id", idsFerias) : Promise.resolve({ data: [] }),
    urlsFotosPremios(supabase, listaPremios.map((p) => p.foto_path)),
  ]);
  const ferias = new Map((feriasData.data ?? []).map((f) => [f.id, f]));

  const padre = padres.data?.find((p) => p.id === animal.padre_id);
  const madre = padres.data?.find((p) => p.id === animal.madre_id);
  const miRetiro = retiro.data?.find((r) => r.animal_id === id);
  const pedigri = typeof completitud.data === "number" ? completitud.data : 0;
  // Con un pedigrí vacío el 0 % no significa «sin endogamia», significa «sin datos»: no se muestra como medida.
  const f = pedigri > 0 && typeof endo.data === "number" ? endo.data : null;
  const nivel = f === null ? null : nivelEndogamia(f, finca.umbral_endogamia);
  const alertaEndogamia = nivel === "alto" || nivel === "muy_alto";
  // Por qué hay endogamia: ancestros repetidos y parentesco entre el padre y la madre.
  const origen: AncestroEndogamia[] = f !== null && f > 0 ? ((await supabase.rpc("explicar_endogamia", { p_animal: id })).data ?? []) : [];
  const parentescoPadres = describirParentesco(origen);
  const lac = lactancia.data;
  const lacAbierta = lac && !lac.fecha_secado;

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>

      <header className="pb-4 pt-1">
        <h1 className="font-display text-[2.25rem] font-semibold leading-none tracking-tight">{animal.numero_arete}</h1>
        {animal.nombre ? <p className="mt-1 text-lg text-humo">{animal.nombre}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Insignia tono="musgo">{nombreTipo(animal.especie, animal.sexo)}</Insignia>
          <Insignia>{ETIQUETA_VOCACION[animal.vocacion]}</Insignia>
          {animal.estado !== "activo" ? <Insignia tono="alerta">{animal.estado[0].toUpperCase() + animal.estado.slice(1)}</Insignia> : null}
          {lacAbierta ? <Insignia tono="ok">En lactancia</Insignia> : null}
        </div>
      </header>

      <div className="space-y-3.5">
        {miRetiro ? (
          <Aviso tipo="atencion">
            En periodo de retiro
            {miRetiro.retiro_leche_hasta ? ` · la leche no va al tanque hasta el ${formatoFecha(miRetiro.retiro_leche_hasta)}` : ""}
            {miRetiro.retiro_carne_hasta ? ` · no puede salir para consumo hasta el ${formatoFecha(miRetiro.retiro_carne_hasta)}` : ""}.
          </Aviso>
        ) : null}

        <Tarjeta titulo="Datos">
          <dl className="divide-y divide-arena">
            <Dato etiqueta="Raza">{raza.data?.nombre ?? "Sin especificar"}</Dato>
            <Dato etiqueta="Nacimiento">
              {formatoFecha(animal.fecha_nacimiento)}
              {animal.fecha_nacimiento_aprox ? " (aprox.)" : ""}
            </Dato>
            <Dato etiqueta="Edad">{edadTexto(animal.fecha_nacimiento)}</Dato>
            <Dato etiqueta="Origen">{animal.origen === "comprado" ? "Comprado" : "Nació en la finca"}</Dato>
            {animal.chip ? <Dato etiqueta="Microchip">{animal.chip}</Dato> : null}
            {animal.color ? <Dato etiqueta="Color">{animal.color}</Dato> : null}
            {animal.rasgos ? <Dato etiqueta="Rasgos">{animal.rasgos}</Dato> : null}
            {animal.marcas ? <Dato etiqueta="Marcas">{animal.marcas}</Dato> : null}
            {animal.peso_nacer_kg ? <Dato etiqueta="Peso al nacer">{litros(animal.peso_nacer_kg)} kg</Dato> : null}
          </dl>
        </Tarjeta>

        {verLeche ? (
          <Tarjeta titulo="Lactancia">
            {lac ? (
              <dl className="divide-y divide-arena">
                <Dato etiqueta="Lactancia">N.º {lac.numero}{lac.fecha_secado ? " · seca" : " · abierta"}</Dato>
                <Dato etiqueta="Desde el parto">{formatoFecha(lac.fecha_parto)}</Dato>
                <Dato etiqueta="Días en leche">{lac.dias_lactancia}</Dato>
                <Dato etiqueta="Total">{litros(lac.litros_total)} L</Dato>
                <Dato etiqueta="Promedio por día">{lac.promedio_diario == null ? "—" : `${litros(lac.promedio_diario)} L`}</Dato>
                <Dato etiqueta="Pico en un día">{lac.pico_diario == null ? "—" : `${litros(lac.pico_diario)} L`}</Dato>
              </dl>
            ) : (
              <p className="text-[0.9375rem] text-humo">Todavía no tiene lactancia registrada. Se abre sola al registrar un parto.</p>
            )}
          </Tarjeta>
        ) : null}

        {verGenealogia ? (
          <Tarjeta titulo="Genealogía">
            <dl className="divide-y divide-arena">
              <Dato etiqueta="Padre">
                {padre ? (
                  <Link href={`/hato/${padre.id}`} className="text-musgo underline-offset-4 hover:underline">
                    {padre.nombre ? `${padre.nombre} · ${padre.numero_arete}` : padre.numero_arete}
                  </Link>
                ) : (
                  (animal.padre_externo ?? "Sin registrar")
                )}
              </Dato>
              <Dato etiqueta="Madre">
                {madre ? (
                  <Link href={`/hato/${madre.id}`} className="text-musgo underline-offset-4 hover:underline">
                    {madre.nombre ? `${madre.nombre} · ${madre.numero_arete}` : madre.numero_arete}
                  </Link>
                ) : (
                  (animal.madre_externa ?? "Sin registrar")
                )}
              </Dato>
              {parentescoPadres ? <Dato etiqueta="Parentesco de sus padres">{primeraMayuscula(parentescoPadres.relacion)}</Dato> : null}
              {f !== null ? (
                <Dato etiqueta="Endogamia (F)">
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <span className="tabular-nums">{porcentaje(f)}</span>
                    <NivelEndogamia f={f} umbral={finca.umbral_endogamia} />
                  </span>
                </Dato>
              ) : null}
              <Dato etiqueta="Pedigrí conocido">
                {pedigriTexto(pedigri)} · {Math.round(pedigri * 100)} %
              </Dato>
            </dl>
            {alertaEndogamia ? (
              <Aviso tipo="atencion" className="mt-3">
                La endogamia supera el umbral de tu finca ({porcentaje(finca.umbral_endogamia)}). Conviene evitar repetir esta cruza.
              </Aviso>
            ) : null}
            {pedigri < 0.5 ? (
              <Aviso tipo="info" className="mt-3">
                {pedigri === 0
                  ? "Todavía no hay padres registrados, por eso no se puede medir la endogamia."
                  : "Con pocos ancestros registrados el cálculo puede quedarse corto. Completa el pedigrí para que sea más confiable."}
              </Aviso>
            ) : null}
            {animal.estado === "activo" ? (
              <Link
                href={animal.sexo === "macho" ? `/hato/cruza?macho=${id}` : `/hato/cruza?hembra=${id}`}
                className={`${clasesBoton("secundario")} mt-3`}
              >
                Simular una cruza
              </Link>
            ) : null}
          </Tarjeta>
        ) : null}

        {f !== null && f > 0 ? (
          <Tarjeta titulo="¿Por qué hay endogamia?">
            <p className="mb-3 text-[0.9375rem] text-humo">
              {animal.nombre ?? animal.numero_arete} tiene ancestros repetidos: animales que aparecen tanto por el lado del padre como por el de la madre.
              Esta es la ruta desde cada uno de ellos hasta el ancestro.
            </p>
            <RutasEndogamia filas={origen} />
          </Tarjeta>
        ) : null}

        {verFerias ? (
          <Tarjeta titulo="Ferias y premios">
            {listaPremios.length === 0 ? (
              <p className="text-[0.9375rem] text-humo">Todavía no tiene participaciones en ferias.</p>
            ) : (
              <>
                <dl className="mb-3 grid grid-cols-3 divide-x divide-arena text-center">
                  {[
                    ["Ferias", palmares.data?.participaciones ?? 0],
                    ["Premios", palmares.data?.premios ?? 0],
                    ["Campeonatos", palmares.data?.campeonatos ?? 0],
                  ].map(([etiqueta, valor]) => (
                    <div key={etiqueta} className="min-w-0 px-1">
                      <dd className="font-display text-2xl font-semibold tabular-nums">{valor}</dd>
                      <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
                    </div>
                  ))}
                </dl>
                <ul className="grid grid-cols-1 gap-2.5">
                  {listaPremios.map((p) => {
                    const f = ferias.get(p.feria_id);
                    return (
                      <li key={p.id} className="min-w-0">
                        <FilaParticipacion
                          p={p}
                          titulo={f?.nombre ?? "Feria"}
                          detalle={f ? formatoFecha(f.fecha_inicio) : undefined}
                          enlace={`/ferias/${p.feria_id}`}
                          fotoUrl={p.foto_path ? fotosPremios.get(p.foto_path) : undefined}
                        />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {puedeEscribir(rol, "ferias") ? (
              <Link href={`/ferias/participacion/nueva?animal=${id}`} className={`${clasesBoton("secundario")} mt-3`}>
                Registrar participación
              </Link>
            ) : null}
          </Tarjeta>
        ) : null}

        {animal.notas ? (
          <Tarjeta titulo="Notas">
            <p className="whitespace-pre-wrap text-[0.9375rem]">{animal.notas}</p>
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
